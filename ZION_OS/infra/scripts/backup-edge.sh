#!/bin/bash
# ZION Edge Server — Comprehensive L1-L6 Backup (V31-aware)
# ============================================================================
# Backs up ALL critical data on the Edge VPS (62.171.141.136):
#
#   L1 (Consensus / V31 nodes):
#     - V31 node DBs: /opt/zion/data/v31/node.db, node2.db, node3.db
#     - V31 pool DBs: /opt/zion/data/v31/pool.db, pool-store.db
#     - V31 pool state: /opt/zion/data/v31/pool-pplns.json
#     - peers.json, pplns-state.json, pplns-state-test.json
#
#   L2 (Bridge / DAO / Atomic Swap / DEX):
#     - bridge-mainnet.db (+WAL/SHM)
#     - dao.db, dao-v31.db (+WAL/SHM)
#
#   L3 (WARP / multichain):
#     - warp.db, warp_multichain.db, warp-v31.db, warp-v31_multichain.db
#
#   L4 (OASIS): oasis-v31.db + game state JSONs
#   L5 (Free World): free_world.db
#   L6 (Issobella): issobella.db
#
#   Operations:
#     - /etc/zion/edge-environment.sh and related env files
#     - /etc/zion/keys/ (if populated)
#     - /etc/zion/config/*.toml
#     - V31 Systemd service files (zion-v31-*.service) + drop-ins + timers
#     - nginx site configs, fail2ban, Let's Encrypt certs
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

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

# Backup a SQLite DB consistently using sqlite3 .backup if possible.
backup_db() {
    local src="$1"
    local dest_dir="$2"
    local rel="$3"
    local dest="${dest_dir}/${rel}"
    mkdir -p "$(dirname "$dest")"
    if command -v sqlite3 >/dev/null 2>&1; then
        sqlite3 "$src" ".backup '${dest}'" 2>/dev/null || true
        if [[ -f "$dest" ]]; then
            return 0
        fi
        log "${YELLOW}  ⚠ sqlite3 .backup failed for ${rel}, falling back to cp${NC}"
    fi
    cp "$src" "$dest"
    if [[ -f "${src}-wal" ]]; then cp "${src}-wal" "$(dirname "$dest")/" 2>/dev/null || true; fi
    if [[ -f "${src}-shm" ]]; then cp "${src}-shm" "$(dirname "$dest")/" 2>/dev/null || true; fi
}

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

NODE_BACKUP="${BACKUP_DIR}/daily/node_state_${TIMESTAMP}"
V31_BACKUP="${BACKUP_DIR}/daily/v31_data_${TIMESTAMP}"
APP_BACKUP="${BACKUP_DIR}/daily/app_state_${TIMESTAMP}"
CONFIG_BACKUP="${BACKUP_DIR}/daily/config_${TIMESTAMP}"
SYSTEMD_BACKUP="${BACKUP_DIR}/daily/systemd_${TIMESTAMP}"
NGINX_BACKUP="${BACKUP_DIR}/daily/nginx_${TIMESTAMP}"
F2B_BACKUP="${BACKUP_DIR}/daily/fail2ban_${TIMESTAMP}"
CERT_BACKUP="${BACKUP_DIR}/daily/letsencrypt_${TIMESTAMP}"
mkdir -p "${NODE_BACKUP}" "${V31_BACKUP}" "${APP_BACKUP}" "${CONFIG_BACKUP}" \
         "${SYSTEMD_BACKUP}" "${NGINX_BACKUP}" "${F2B_BACKUP}" "${CERT_BACKUP}"

# ── 1. V31 data + all DBs (deduplicated by realpath) ────────────────────────
log "Backing up V31 /data databases..."

# Collect all .db files under /data/zion and /opt/zion/data, avoiding
# historical backup/restore directories and symlinks.
mapfile -t DB_FILES < <(
    find /data/zion /opt/zion/data \
        -maxdepth 3 -type f -name '*.db' \
        ! -path '*/backup-*' \
        ! -path '*/restore-*' \
        ! -path '*/pre-*' \
        -print0 2>/dev/null | \
    xargs -0 -I{} realpath -e {} 2>/dev/null | \
    sort -u
)

for db in "${DB_FILES[@]}"; do
    # Preserve directory structure under the backup root, e.g.:
    # /opt/zion/data/v31/node.db -> v31_data/opt/zion/data/v31/node.db
    rel=$(realpath --relative-to=/ "$db")
    rel=${rel#/}
    backup_db "$db" "${V31_BACKUP}" "$rel"
    log "${GREEN}  ✓ ${rel}${NC}"
done

# ── 2. Node / pool / app state JSONs ────────────────────────────────────────
log "Backing up node / pool / app state..."
for f in /data/zion/peers.json /data/zion/pplns-state.json \
         /data/zion/pplns-state-test.json \
         /opt/zion/data/v31/peers.json \
         /opt/zion/data/v31/pplns-state.json \
         /data/zion/g8_run.json \
         /opt/zion/data/v31/pool-pplns.json; do
    copy_if_exists "$f" "${NODE_BACKUP}"
done

# ── 3. OASIS game state JSONs (V31 primary, V3 fallback) ────────────────────
log "Backing up OASIS game state..."
OASIS_DATA="${V31_BACKUP}/oasis_data"
mkdir -p "${OASIS_DATA}"
for f in golden_egg.json avatars.json world.json prize_tiers.json; do
    if [[ -f "${REPO_ROOT}/V31/L4/oasis/data/${f}" ]]; then
        cp "${REPO_ROOT}/V31/L4/oasis/data/${f}" "${OASIS_DATA}/"
        log "${GREEN}  ✓ ${f} (V31)${NC}"
    elif [[ -f "${REPO_ROOT}/V3/L4/oasis/data/${f}" ]]; then
        cp "${REPO_ROOT}/V3/L4/oasis/data/${f}" "${OASIS_DATA}/"
        log "${YELLOW}  ✓ ${f} (V3 fallback)${NC}"
    else
        log "${YELLOW}  ⚠  ${f} not found${NC}"
    fi
done

# ── 4. Application state (dashboard + revenue journal) ──────────────────────
log "Backing up application state..."
copy_if_exists "/opt/zion/data/dashboard/state.json" "${APP_BACKUP}"
copy_if_exists "/opt/zion/data/v31/dashboard-state.json" "${APP_BACKUP}"
copy_dir_if_exists "/opt/zion/data/revenue_journal" "${APP_BACKUP}"
copy_dir_if_exists "/opt/zion/data/v31/revenue_journal" "${APP_BACKUP}"

# ── 5. Critical config files ────────────────────────────────────────────────
log "Backing up config files..."
for cfg in \
    "/etc/zion/edge-environment.sh" \
    "/etc/zion/edge-node2-environment.sh" \
    "/etc/zion/test-pool-environment.sh" \
    "/etc/zion/xmr-pool-environment.sh" \
    "/etc/zion/edge-env-no-auxpow.sh"; do
    copy_if_exists "$cfg" "${CONFIG_BACKUP}"
done

if [[ -d /etc/zion/keys ]] && [[ -n "$(ls -A /etc/zion/keys 2>/dev/null)" ]]; then
    cp -r /etc/zion/keys "${CONFIG_BACKUP}/keys"
    log "${GREEN}  ✓ keys/ (populated)${NC}"
fi

if [[ -d /etc/zion/config ]]; then
    cp -r /etc/zion/config "${CONFIG_BACKUP}/config"
    log "${GREEN}  ✓ config/${NC}"
fi

# Repo-local canonical V31 configs
if [[ -d "${REPO_ROOT}/V31/L2/multichain/config" ]]; then
    cp -r "${REPO_ROOT}/V31/L2/multichain/config" "${CONFIG_BACKUP}/multichain-config" 2>/dev/null || true
fi

# ── 6. V31 Systemd service files and timers ─────────────────────────────────
log "Backing up V31 systemd service files..."

if ls /etc/systemd/system/zion-v31-*.service >/dev/null 2>&1; then
    cp /etc/systemd/system/zion-v31-*.service "${SYSTEMD_BACKUP}/" 2>/dev/null || true
fi
if ls /etc/systemd/system/zion-v31-*.timer >/dev/null 2>&1; then
    cp /etc/systemd/system/zion-v31-*.timer "${SYSTEMD_BACKUP}/" 2>/dev/null || true
fi
# Drop-ins
for d in /etc/systemd/system/zion-v31-*.service.d /etc/systemd/system/zion-v31-*.timer.d; do
    [[ -d "$d" ]] && cp -r "$d" "${SYSTEMD_BACKUP}/" 2>/dev/null || true
done

# Legacy V3/V2 service files (keep if still present)
if ls /etc/systemd/system/zion-edge-*.service >/dev/null 2>&1; then
    cp /etc/systemd/system/zion-edge-*.service "${SYSTEMD_BACKUP}/" 2>/dev/null || true
fi
if ls /etc/systemd/system/zion-edge-*.timer >/dev/null 2>&1; then
    cp /etc/systemd/system/zion-edge-*.timer "${SYSTEMD_BACKUP}/" 2>/dev/null || true
fi

# Repo-local V31 service files
if [[ -d "${REPO_ROOT}/V31/deploy/systemd" ]]; then
    cp "${REPO_ROOT}/V31/deploy/systemd/"zion-v31-* "${SYSTEMD_BACKUP}/" 2>/dev/null || true
fi
log "${GREEN}  ✓ $(ls -1 ${SYSTEMD_BACKUP}/ 2>/dev/null | wc -l) service/timer files${NC}"

# ── 7. nginx / fail2ban / letsencrypt ───────────────────────────────────────
log "Backing up nginx configs..."
if [[ -d "/etc/nginx/sites-enabled" ]]; then
    cp /etc/nginx/sites-enabled/* "${NGINX_BACKUP}/" 2>/dev/null || true
    log "${GREEN}  ✓ nginx sites-enabled${NC}"
fi
copy_if_exists "/etc/nginx/nginx.conf" "${NGINX_BACKUP}"

log "Backing up fail2ban configs..."
if [[ -d "/etc/fail2ban/jail.d" ]]; then
    cp /etc/fail2ban/jail.d/* "${F2B_BACKUP}/" 2>/dev/null || true
    log "${GREEN}  ✓ fail2ban jail.d${NC}"
fi
copy_if_exists "/etc/fail2ban/jail.conf" "${F2B_BACKUP}"

log "Backing up Let's Encrypt certs..."
if [[ -d "/etc/letsencrypt/live" ]]; then
    tar -czf "${CERT_BACKUP}/letsencrypt-live.tar.gz" -C /etc/letsencrypt live 2>/dev/null || true
    tar -czf "${CERT_BACKUP}/letsencrypt-archive.tar.gz" -C /etc/letsencrypt archive 2>/dev/null || true
    copy_if_exists "/etc/letsencrypt/options-ssl-nginx.conf" "${CERT_BACKUP}"
    log "${GREEN}  ✓ Let's Encrypt certs${NC}"
else
    log "${YELLOW}  ⚠  /etc/letsencrypt/live not found${NC}"
fi

# ── 8. Compress daily backup ────────────────────────────────────────────────
DAILY_TAR="${BACKUP_DIR}/daily/zion-edge-${TIMESTAMP}.tar.gz"
if tar -czf "${DAILY_TAR}" -C "${BACKUP_DIR}/daily" \
       "node_state_${TIMESTAMP}" "v31_data_${TIMESTAMP}" \
       "app_state_${TIMESTAMP}" "config_${TIMESTAMP}" \
       "systemd_${TIMESTAMP}" "nginx_${TIMESTAMP}" \
       "fail2ban_${TIMESTAMP}" "letsencrypt_${TIMESTAMP}"; then
    rm -rf "${NODE_BACKUP}" "${V31_BACKUP}" "${APP_BACKUP}" \
           "${CONFIG_BACKUP}" "${SYSTEMD_BACKUP}" \
           "${NGINX_BACKUP}" "${F2B_BACKUP}" "${CERT_BACKUP}"
    SIZE=$(du -sh "${DAILY_TAR}" | cut -f1)
    chown zion:zion "${DAILY_TAR}" 2>/dev/null || true
    log "${GREEN}  ✓ Daily backup: ${DAILY_TAR} (${SIZE})${NC}"
else
    log "${RED}  ✗ Failed to create daily backup${NC}"
    exit 1
fi

# ── 9. Weekly snapshot (Sunday) ─────────────────────────────────────────────
if [[ "${DAY_OF_WEEK}" == "7" ]]; then
    WEEK_NUM=$(date +%Y_W%V)
    WEEKLY_TAR="${BACKUP_DIR}/weekly/zion-edge-weekly-${WEEK_NUM}.tar.gz"
    if [[ -f "${DAILY_TAR}" ]]; then
        cp "${DAILY_TAR}" "${WEEKLY_TAR}"
        log "${GREEN}  ✓ Weekly snapshot: ${WEEKLY_TAR}${NC}"
    fi
fi

# ── 10. Cleanup old backups ─────────────────────────────────────────────────
log "Cleaning up old backups..."

DAILY_COUNT=$(find "${BACKUP_DIR}/daily" -name 'zion-edge-*.tar.gz' -type f | wc -l)
if [[ ${DAILY_COUNT} -gt ${RETENTION_DAILY} ]]; then
    find "${BACKUP_DIR}/daily" -name 'zion-edge-*.tar.gz' -type f -printf '%T@ %p\n' | \
        sort -n | head -n -${RETENTION_DAILY} | cut -d' ' -f2- | \
        xargs -r rm -f
    log "${GREEN}  ✓ Rotated daily backups (keep ${RETENTION_DAILY})${NC}"
fi

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
