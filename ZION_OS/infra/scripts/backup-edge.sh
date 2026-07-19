#!/bin/bash
# ZION Edge Server — Full Database & Config Backup
# ============================================================================
# Backs up ALL critical data on the Edge Hetzner VPS:
#   - Node 1 state DB (edge-state.db)
#   - Node 2 state DB (edge2-state.db)  ← CRITICAL: was missed in last reset!
#   - V3/data/*.db (bridge, dao, warp, pool, atomic-swap)
#   - edge-environment.sh (secrets, wallet keys, fee split)
#   - Systemd service files (operational truth)
#
# Usage (manual):
#   sudo /opt/zion/ZION_OS/infra/scripts/backup-edge.sh
#
# Usage (systemd timer):
#   systemctl start zion-edge-backup.timer
#   systemctl enable zion-edge-backup.timer
#
# Retention: 14 daily + 4 weekly backups
# Backups go to: /opt/zion/backups/
# ============================================================================

set -euo pipefail

REPO_ROOT="/opt/zion"
BACKUP_DIR="/opt/zion/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday

RETENTION_DAILY=14
RETENTION_WEEKLY=4

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

# Copy a database file safely.
# - SQLite .db files are backed up with the sqlite3 .backup command so the
#   copy is consistent even if the DB is open with WAL. If sqlite3 is not
#   available, fall back to cp and also copy -wal/-shm sidecar files.
# - Other files are copied directly.
backup_db() {
    local src="$1"
    local dest_dir="$2"
    local basename_src
    basename_src=$(basename "$src")

    if [[ "$src" == *.db ]]; then
        if command -v sqlite3 >/dev/null 2>&1; then
            sqlite3 "$src" ".backup '${dest_dir}/${basename_src}'" 2>/dev/null || true
            if [[ -f "${dest_dir}/${basename_src}" ]]; then
                return 0
            fi
            log "${YELLOW}  ⚠ sqlite3 .backup failed for ${basename_src}, falling back to cp${NC}"
        fi
        # Fallback: copy DB + WAL/shm files as a set (best effort)
        cp "$src" "${dest_dir}/"
        if [[ -f "${src}-wal" ]]; then cp "${src}-wal" "${dest_dir}/" 2>/dev/null || true; fi
        if [[ -f "${src}-shm" ]]; then cp "${src}-shm" "${dest_dir}/" 2>/dev/null || true; fi
    else
        cp "$src" "${dest_dir}/"
    fi
}

mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly"

log "${GREEN}=== ZION Edge Backup Started ===${NC}"
log "Repo : ${REPO_ROOT}"
log "Dest : ${BACKUP_DIR}"

# ── 1. Node state databases ────────────────────────────────────────────────
log "Backing up node state databases..."
NODE_BACKUP="${BACKUP_DIR}/daily/node_state_${TIMESTAMP}"
mkdir -p "${NODE_BACKUP}"

# On the live Edge server, state DBs live in /data/zion/ (per edge-environment.sh).
# Also check /opt/zion/data/ for repo-local dev deployments.
for db in "/data/zion/state" "/data/zion/state-node2" \
          "/opt/zion/data/edge-state.db" "/opt/zion/data/edge2-state.db"; do
    if [[ -f "$db" ]]; then
        backup_db "$db" "${NODE_BACKUP}"
        log "${GREEN}  ✓ $(basename $db)${NC}"
    else
        log "${YELLOW}  ⚠  $(basename $db) not found${NC}"
    fi
done

# ── 2. /data/zion databases (bridge, dao, warp, pool, swap) ──────────────────
log "Backing up /data/zion databases..."
V3_BACKUP="${BACKUP_DIR}/daily/v3_data_${TIMESTAMP}"
mkdir -p "${V3_BACKUP}"

# Live server uses /data/zion/ for all DBs; /opt/zion/data is the repo-local fallback.
for data_dir in "/data/zion" "/opt/zion/data"; do
    if [[ -d "$data_dir" ]]; then
        for db in "$data_dir"/*.db "$data_dir"/pplns-state.json; do
            if [[ -f "$db" ]]; then
                backup_db "$db" "${V3_BACKUP}"
                log "${GREEN}  ✓ $(basename $db)${NC}"
            fi
        done
    fi
done
if [[ ! -d "/data/zion" && ! -d "/opt/zion/data" ]]; then
    log "${YELLOW}  ⚠  No data directory found${NC}"
fi

# ── 3. Critical config files ───────────────────────────────────────────────
log "Backing up config files..."
CONFIG_BACKUP="${BACKUP_DIR}/daily/config_${TIMESTAMP}"
mkdir -p "${CONFIG_BACKUP}"

for cfg in \
    "/etc/zion/edge-environment.sh" \
    "${REPO_ROOT}/edge-deploy/config/edge-environment.sh" \
    "${REPO_ROOT}/V3/L2/bridge/config/bridge-mainnet.toml" \
    "${REPO_ROOT}/V3/L2/atomic-swap/config/swap-mainnet.toml" \
    "${REPO_ROOT}/V3/L3/warp/config/warp-mainnet.toml"
do
    if [[ -f "$cfg" ]]; then
        cp "$cfg" "${CONFIG_BACKUP}/"
        log "${GREEN}  ✓ $(basename $cfg)${NC}"
    else
        log "${YELLOW}  ⚠  $(basename $cfg) not found${NC}"
    fi
done

# ── 4. Systemd service files ────────────────────────────────────────────────
log "Backing up systemd service files..."
SYSTEMD_BACKUP="${BACKUP_DIR}/daily/systemd_${TIMESTAMP}"
mkdir -p "${SYSTEMD_BACKUP}"

if [[ -d "${REPO_ROOT}/edge-deploy/systemd" ]]; then
    cp "${REPO_ROOT}/edge-deploy/systemd/"*.service "${SYSTEMD_BACKUP}/"
    log "${GREEN}  ✓ $(ls -1 ${SYSTEMD_BACKUP}/ | wc -l) service files${NC}"
fi

# ── 5. Compress daily backup ──────────────────────────────────────────────
DAILY_TAR="${BACKUP_DIR}/daily/zion-edge-${TIMESTAMP}.tar.gz"
if tar -czf "${DAILY_TAR}" -C "${BACKUP_DIR}/daily" \
       "node_state_${TIMESTAMP}" "v3_data_${TIMESTAMP}" \
       "config_${TIMESTAMP}" "systemd_${TIMESTAMP}"; then
    # Cleanup uncompressed dirs only after successful tar
    rm -rf "${NODE_BACKUP}" "${V3_BACKUP}" "${CONFIG_BACKUP}" "${SYSTEMD_BACKUP}"
    SIZE=$(du -sh "${DAILY_TAR}" | cut -f1)
    log "${GREEN}  ✓ Daily backup: ${DAILY_TAR} (${SIZE})${NC}"
else
    log "${RED}  ✗ Failed to create daily backup${NC}"
    exit 1
fi

# ── 6. Weekly snapshot (Sunday) ───────────────────────────────────────────
if [[ "${DAY_OF_WEEK}" == "7" ]]; then
    WEEK_NUM=$(date +%Y_W%V)
    WEEKLY_TAR="${BACKUP_DIR}/weekly/zion-edge-weekly-${WEEK_NUM}.tar.gz"
    if [[ -f "${DAILY_TAR}" ]]; then
        cp "${DAILY_TAR}" "${WEEKLY_TAR}"
        log "${GREEN}  ✓ Weekly snapshot: ${WEEKLY_TAR}${NC}"
    fi
fi

# ── 7. Cleanup old backups ────────────────────────────────────────────────
log "Cleaning up old backups..."

# Daily: keep last N
DAILY_COUNT=$(find "${BACKUP_DIR}/daily" -name 'zion-edge-*.tar.gz' -type f | wc -l)
if [[ ${DAILY_COUNT} -gt ${RETENTION_DAILY} ]]; then
    find "${BACKUP_DIR}/daily" -name 'zion-edge-*.tar.gz' -type f -printf '%T@ %p\n' | \
        sort -n | head -n -${RETENTION_DAILY} | cut -d' ' -f2- | \
        xargs -r rm -f
    log "${GREEN}  ✓ Rotated daily backups (keep ${RETENTION_DAILY})${NC}"
fi

# Weekly: keep last N
WEEKLY_COUNT=$(find "${BACKUP_DIR}/weekly" -name 'zion-edge-*.tar.gz' -type f | wc -l)
if [[ ${WEEKLY_COUNT} -gt ${RETENTION_WEEKLY} ]]; then
    find "${BACKUP_DIR}/weekly" -name 'zion-edge-*.tar.gz' -type f -printf '%T@ %p\n' | \
        sort -n | head -n -${RETENTION_WEEKLY} | cut -d' ' -f2- | \
        xargs -r rm -f
    log "${GREEN}  ✓ Rotated weekly backups (keep ${RETENTION_WEEKLY})${NC}"
fi

# ── Summary ────────────────────────────────────────────────────────────────
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1 || echo "unknown")
DAILY_LEFT=$(find "${BACKUP_DIR}/daily" -name 'zion-edge-*.tar.gz' -type f | wc -l)
WEEKLY_LEFT=$(find "${BACKUP_DIR}/weekly" -name 'zion-edge-*.tar.gz' -type f | wc -l)

log "${GREEN}=== Backup Complete ===${NC}"
log "  Daily backups : ${DAILY_LEFT}"
log "  Weekly backups: ${WEEKLY_LEFT}"
log "  Total size    : ${TOTAL_SIZE}"
