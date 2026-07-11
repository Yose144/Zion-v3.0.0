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
#   sudo /root/zion-2.9.6-main/edge-deploy/scripts/backup-edge.sh
#
# Usage (systemd timer):
#   systemctl start zion-edge-backup.timer
#   systemctl enable zion-edge-backup.timer
#
# Retention: 14 daily + 4 weekly backups
# Backups go to: /root/zion-backups/
# ============================================================================

set -euo pipefail

REPO_ROOT="/root/zion/2.9.6"
BACKUP_DIR="/root/zion-backups"
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

mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly"

log "${GREEN}=== ZION Edge Backup Started ===${NC}"
log "Repo : ${REPO_ROOT}"
log "Dest : ${BACKUP_DIR}"

# ── 1. Node state databases ────────────────────────────────────────────────
log "Backing up node state databases..."
NODE_BACKUP="${BACKUP_DIR}/daily/node_state_${TIMESTAMP}"
mkdir -p "${NODE_BACKUP}"

# On the new Edge server, state DBs live in /data/zion/
for db in "/data/zion/state" "/data/zion/state-node2"; do
    if [[ -f "$db" ]]; then
        cp "$db" "${NODE_BACKUP}/"
        log "${GREEN}  ✓ $(basename $db)${NC}"
    else
        log "${YELLOW}  ⚠  $(basename $db) not found${NC}"
    fi
done

# ── 2. /data/zion databases (bridge, dao, warp, pool, swap) ──────────────────
log "Backing up /data/zion databases..."
V3_BACKUP="${BACKUP_DIR}/daily/v3_data_${TIMESTAMP}"
mkdir -p "${V3_BACKUP}"

if [[ -d "/data/zion" ]]; then
    for db in /data/zion/*.db /data/zion/pplns-state.json; do
        if [[ -f "$db" ]]; then
            cp "$db" "${V3_BACKUP}/"
            log "${GREEN}  ✓ $(basename $db)${NC}"
        fi
    done
else
    log "${YELLOW}  ⚠  /data/zion directory not found${NC}"
fi

# ── 3. Critical config files ───────────────────────────────────────────────
log "Backing up config files..."
CONFIG_BACKUP="${BACKUP_DIR}/daily/config_${TIMESTAMP}"
mkdir -p "${CONFIG_BACKUP}"

for cfg in \
    "/root/zion/edge-environment.sh" \
    "/root/zion/edge-node2-environment.sh" \
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
tar -czf "${DAILY_TAR}" -C "${BACKUP_DIR}/daily" \
    "node_state_${TIMESTAMP}" "v3_data_${TIMESTAMP}" \
    "config_${TIMESTAMP}" "systemd_${TIMESTAMP}" 2>/dev/null || true

# Cleanup uncompressed dirs
rm -rf "${NODE_BACKUP}" "${V3_BACKUP}" "${CONFIG_BACKUP}" "${SYSTEMD_BACKUP}"

if [[ -f "${DAILY_TAR}" ]]; then
    SIZE=$(du -sh "${DAILY_TAR}" | cut -f1)
    log "${GREEN}  ✓ Daily backup: ${DAILY_TAR} (${SIZE})${NC}"
else
    log "${RED}  ✗ Failed to create daily backup${NC}"
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
