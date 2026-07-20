#!/bin/bash
# ZION Edge Server — Comprehensive L1-L6 Backup
# ============================================================================
# Backs up ALL critical data on the Edge VPS (62.171.141.136):
#
#   L1 (Consensus):
#     - Node 1 state DB (/data/zion/state)
#     - Node 2 state DB (/data/zion/state-node2)
#     - peers.json, pplns-state.json, pplns-state-test.json
#
#   L2 (Bridge / DAO / Atomic Swap / DEX):
#     - bridge-mainnet.db (+WAL/SHM)
#     - dao-mainnet.db (+WAL/SHM)
#     - atomic-swap.db (+WAL/SHM)
#     - ziondex-router.db (+WAL/SHM)
#     - L2 config TOMLs (bridge, dao, swap, warp)
#
#   L3 (WARP):
#     - warp-mainnet.db (+WAL/SHM)
#     - chains.toml
#
#   L4 (OASIS): oasis.db + game state JSONs (golden_egg, avatars, world, prize_tiers)
#   L5 (Free World): free_world.db
#   L6 (Issobella): issobella.db
#
#   Operations:
#     - /etc/zion/edge-environment.sh (secrets, wallet keys, fee split)
#     - /etc/zion/edge-node2-environment.sh
#     - /etc/zion/test-pool-environment.sh, xmr-pool-environment.sh
#     - /etc/zion/keys/ (if populated)
#     - /etc/zion/config/*.toml (canonical config copies)
#     - Systemd service files (zion-edge-*.service)
#     - nginx site configs (/etc/nginx/sites-enabled/)
#     - fail2ban configs (/etc/fail2ban/jail.d/)
#     - Let's Encrypt certs (/etc/letsencrypt/live/ + archive)
#
#   Application state:
#     - /opt/zion/data/dashboard/state.json
#     - /opt/zion/data/revenue_journal/*.jsonl
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
#   copy is consistent even if the DB is open in WAL mode. If sqlite3 is not
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

# Copy a file if it exists, log warning otherwise.
copy_if_exists() {
    local src="$1"
    local dest_dir="$2"
    if [[ -f "$src" ]]; then
        cp "$src" "${dest_dir}/"
        log "${GREEN}  ✓ $(basename $src)${NC}"
    else
        log "${YELLOW}  ⚠  $(basename $src) not found${NC}"
    fi
}

# Copy a directory recursively if it exists.
copy_dir_if_exists() {
    local src="$1"
    local dest_dir="$2"
    local name
    name=$(basename "$src")
    if [[ -d "$src" ]]; then
        cp -r "$src" "${dest_dir}/${name}"
        log "${GREEN}  ✓ ${name}/${NC}"
    else
        log "${YELLOW}  ⚠  ${name}/ not found${NC}"
    fi
}

mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly"

log "${GREEN}=== ZION Edge Backup Started ===${NC}"
log "Repo : ${REPO_ROOT}"
log "Dest : ${BACKUP_DIR}"

# ── 1. L1 — Node state databases + P2P/PPLNS state ──────────────────────────
log "Backing up L1 node state databases..."
NODE_BACKUP="${BACKUP_DIR}/daily/node_state_${TIMESTAMP}"
mkdir -p "${NODE_BACKUP}"

for db in "/data/zion/state" "/data/zion/state-node2" \
          "/opt/zion/data/edge-state.db" "/opt/zion/data/edge2-state.db"; do
    if [[ -f "$db" ]]; then
        backup_db "$db" "${NODE_BACKUP}"
        log "${GREEN}  ✓ $(basename $db)${NC}"
    else
        log "${YELLOW}  ⚠  $(basename $db) not found${NC}"
    fi
done

# P2P peers + PPLNS state (pool payment tracking)
for f in "/data/zion/peers.json" \
         "/data/zion/pplns-state.json" \
         "/data/zion/pplns-state-test.json"; do
    copy_if_exists "$f" "${NODE_BACKUP}"
done

# ── 2. L2-L6 — All /data/zion/*.db databases (+WAL/SHM) ─────────────────────
log "Backing up L2-L6 databases..."
V3_BACKUP="${BACKUP_DIR}/daily/v3_data_${TIMESTAMP}"
mkdir -p "${V3_BACKUP}"

# Live server uses /data/zion/ for all DBs; /opt/zion/data is the repo-local fallback.
# Includes: bridge, dao, atomic-swap, ziondex-router (L2), warp (L3),
#           oasis (L4), free_world (L5), issobella (L6)
for data_dir in "/data/zion" "/opt/zion/data"; do
    if [[ -d "$data_dir" ]]; then
        for db in "$data_dir"/*.db; do
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

# ── 3. L4 OASIS game state JSONs ────────────────────────────────────────────
log "Backing up L4 OASIS game state..."
OASIS_DATA="${V3_BACKUP}/oasis_data"
mkdir -p "${OASIS_DATA}"
for f in golden_egg.json avatars.json world.json prize_tiers.json; do
    copy_if_exists "${REPO_ROOT}/V3/L4/oasis/data/${f}" "${OASIS_DATA}"
done

# ── 4. Application state (dashboard + revenue journal) ──────────────────────
log "Backing up application state..."
APP_BACKUP="${BACKUP_DIR}/daily/app_state_${TIMESTAMP}"
mkdir -p "${APP_BACKUP}"

copy_if_exists "/opt/zion/data/dashboard/state.json" "${APP_BACKUP}"
copy_dir_if_exists "/opt/zion/data/revenue_journal" "${APP_BACKUP}"

# ── 5. Critical config files (secrets + TOMLs) ──────────────────────────────
log "Backing up config files..."
CONFIG_BACKUP="${BACKUP_DIR}/daily/config_${TIMESTAMP}"
mkdir -p "${CONFIG_BACKUP}"

# /etc/zion/ environment files (secrets, wallet keys, fee split)
for cfg in \
    "/etc/zion/edge-environment.sh" \
    "/etc/zion/edge-node2-environment.sh" \
    "/etc/zion/test-pool-environment.sh" \
    "/etc/zion/xmr-pool-environment.sh" \
    "/etc/zion/edge-env-no-auxpow.sh"; do
    copy_if_exists "$cfg" "${CONFIG_BACKUP}"
done

# /etc/zion/keys/ (private keys directory — usually empty but back up if populated)
if [[ -d "/etc/zion/keys" ]] && [[ -n "$(ls -A /etc/zion/keys 2>/dev/null)" ]]; then
    cp -r /etc/zion/keys "${CONFIG_BACKUP}/keys"
    log "${GREEN}  ✓ keys/ (populated)${NC}"
fi

# /etc/zion/config/ canonical TOML copies
for cfg in \
    "/etc/zion/config/bridge-mainnet.toml" \
    "/etc/zion/config/dao-mainnet.toml" \
    "/etc/zion/config/swap-mainnet.toml" \
    "/etc/zion/config/warp-mainnet.toml"; do
    copy_if_exists "$cfg" "${CONFIG_BACKUP}"
done

# Repo-local config TOMLs (fallback / source of truth)
for cfg in \
    "${REPO_ROOT}/V3/L2/bridge/config/bridge-mainnet.toml" \
    "${REPO_ROOT}/V3/L2/dao/config/dao-mainnet.toml" \
    "${REPO_ROOT}/V3/L2/atomic-swap/config/swap-mainnet.toml" \
    "${REPO_ROOT}/V3/L3/warp/config/warp-mainnet.toml" \
    "${REPO_ROOT}/V3/L3/warp/config/chains.toml"; do
    copy_if_exists "$cfg" "${CONFIG_BACKUP}"
done

# ── 6. Systemd service files ────────────────────────────────────────────────
log "Backing up systemd service files..."
SYSTEMD_BACKUP="${BACKUP_DIR}/daily/systemd_${TIMESTAMP}"
mkdir -p "${SYSTEMD_BACKUP}"

# Live deployed service files
if ls /etc/systemd/system/zion-edge-*.service >/dev/null 2>&1; then
    cp /etc/systemd/system/zion-edge-*.service "${SYSTEMD_BACKUP}/" 2>/dev/null || true
fi
# Timer files
if ls /etc/systemd/system/zion-edge-*.timer >/dev/null 2>&1; then
    cp /etc/systemd/system/zion-edge-*.timer "${SYSTEMD_BACKUP}/" 2>/dev/null || true
fi
# Repo-local service files (canonical source)
if [[ -d "${REPO_ROOT}/edge-deploy/systemd" ]]; then
    cp "${REPO_ROOT}/edge-deploy/systemd/"*.service "${SYSTEMD_BACKUP}/" 2>/dev/null || true
fi
if [[ -d "${REPO_ROOT}/ZION_OS/infra/systemd" ]]; then
    cp "${REPO_ROOT}/ZION_OS/infra/systemd/"*.service "${SYSTEMD_BACKUP}/" 2>/dev/null || true
    cp "${REPO_ROOT}/ZION_OS/infra/systemd/"*.timer "${SYSTEMD_BACKUP}/" 2>/dev/null || true
fi
log "${GREEN}  ✓ $(ls -1 ${SYSTEMD_BACKUP}/ 2>/dev/null | wc -l) service/timer files${NC}"

# ── 7. nginx site configs ───────────────────────────────────────────────────
log "Backing up nginx configs..."
NGINX_BACKUP="${BACKUP_DIR}/daily/nginx_${TIMESTAMP}"
mkdir -p "${NGINX_BACKUP}"

if [[ -d "/etc/nginx/sites-enabled" ]]; then
    cp /etc/nginx/sites-enabled/* "${NGINX_BACKUP}/" 2>/dev/null || true
    log "${GREEN}  ✓ nginx sites-enabled${NC}"
fi
copy_if_exists "/etc/nginx/nginx.conf" "${NGINX_BACKUP}"

# ── 8. fail2ban configs ─────────────────────────────────────────────────────
log "Backing up fail2ban configs..."
F2B_BACKUP="${BACKUP_DIR}/daily/fail2ban_${TIMESTAMP}"
mkdir -p "${F2B_BACKUP}"

if [[ -d "/etc/fail2ban/jail.d" ]]; then
    cp /etc/fail2ban/jail.d/* "${F2B_BACKUP}/" 2>/dev/null || true
    log "${GREEN}  ✓ fail2ban jail.d${NC}"
fi
copy_if_exists "/etc/fail2ban/jail.conf" "${F2B_BACKUP}"

# ── 9. Let's Encrypt certificates ───────────────────────────────────────────
log "Backing up Let's Encrypt certs..."
CERT_BACKUP="${BACKUP_DIR}/daily/letsencrypt_${TIMESTAMP}"
mkdir -p "${CERT_BACKUP}"

if [[ -d "/etc/letsencrypt/live" ]]; then
    # Back up live symlinks + the actual archive (private keys live here)
    tar -czf "${CERT_BACKUP}/letsencrypt-live.tar.gz" -C /etc/letsencrypt live 2>/dev/null || true
    tar -czf "${CERT_BACKUP}/letsencrypt-archive.tar.gz" -C /etc/letsencrypt archive 2>/dev/null || true
    if [[ -f "/etc/letsencrypt/options-ssl-nginx.conf" ]]; then
        cp /etc/letsencrypt/options-ssl-nginx.conf "${CERT_BACKUP}/" 2>/dev/null || true
    fi
    log "${GREEN}  ✓ Let's Encrypt certs${NC}"
else
    log "${YELLOW}  ⚠  /etc/letsencrypt/live not found${NC}"
fi

# ── 10. Compress daily backup ───────────────────────────────────────────────
DAILY_TAR="${BACKUP_DIR}/daily/zion-edge-${TIMESTAMP}.tar.gz"
if tar -czf "${DAILY_TAR}" -C "${BACKUP_DIR}/daily" \
       "node_state_${TIMESTAMP}" "v3_data_${TIMESTAMP}" \
       "app_state_${TIMESTAMP}" "config_${TIMESTAMP}" \
       "systemd_${TIMESTAMP}" "nginx_${TIMESTAMP}" \
       "fail2ban_${TIMESTAMP}" "letsencrypt_${TIMESTAMP}"; then
    # Cleanup uncompressed dirs only after successful tar
    rm -rf "${NODE_BACKUP}" "${V3_BACKUP}" "${APP_BACKUP}" \
           "${CONFIG_BACKUP}" "${SYSTEMD_BACKUP}" \
           "${NGINX_BACKUP}" "${F2B_BACKUP}" "${CERT_BACKUP}"
    SIZE=$(du -sh "${DAILY_TAR}" | cut -f1)
    log "${GREEN}  ✓ Daily backup: ${DAILY_TAR} (${SIZE})${NC}"
else
    log "${RED}  ✗ Failed to create daily backup${NC}"
    exit 1
fi

# ── 11. Weekly snapshot (Sunday) ────────────────────────────────────────────
if [[ "${DAY_OF_WEEK}" == "7" ]]; then
    WEEK_NUM=$(date +%Y_W%V)
    WEEKLY_TAR="${BACKUP_DIR}/weekly/zion-edge-weekly-${WEEK_NUM}.tar.gz"
    if [[ -f "${DAILY_TAR}" ]]; then
        cp "${DAILY_TAR}" "${WEEKLY_TAR}"
        log "${GREEN}  ✓ Weekly snapshot: ${WEEKLY_TAR}${NC}"
    fi
fi

# ── 12. Cleanup old backups ─────────────────────────────────────────────────
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

# ── Summary ─────────────────────────────────────────────────────────────────
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1 || echo "unknown")
DAILY_LEFT=$(find "${BACKUP_DIR}/daily" -name 'zion-edge-*.tar.gz' -type f | wc -l)
WEEKLY_LEFT=$(find "${BACKUP_DIR}/weekly" -name 'zion-edge-*.tar.gz' -type f | wc -l)

log "${GREEN}=== Backup Complete ===${NC}"
log "  Daily backups : ${DAILY_LEFT}"
log "  Weekly backups: ${WEEKLY_LEFT}"
log "  Total size    : ${TOTAL_SIZE}"
