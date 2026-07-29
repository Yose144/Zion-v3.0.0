#!/bin/bash
# ZION Off-Site Backup Sync — Edge → Local Machine
# ============================================================================
# Pulls Edge server backups to the local machine for off-site redundancy.
#
# Syncs:
#   - /opt/zion/backups/daily/    → ~/2.9.6-main/backups/edge/daily/
#   - /opt/zion/backups/weekly/   → ~/2.9.6-main/backups/edge/weekly/
#
# Uses rsync over SSH (IPv6 preferred — IPv4 sometimes blocked by fail2ban).
# Local retention: 30 daily + 8 weekly (longer than Edge's 14/4 so we keep
#   history even after Edge rotates).
#
# Usage:
#   ./sync-edge-backups.sh            # one-shot sync
#   systemctl --user start zion-offsite-sync.timer   # via timer
#
# Requires: ssh key at ~/.ssh/zion-edge-2026-07-29 with root access to Edge.
# ============================================================================

set -euo pipefail

# Edge SSH connection (IPv6 — reliable, not affected by fail2ban IPv4 bans)
EDGE_HOST="2a02:c207:2342:5821::1"
EDGE_PORT="2222"
EDGE_USER="root"
SSH_KEY="${HOME}/.ssh/zion-edge-2026-07-29"
SSH_OPTS="-6 -p ${EDGE_PORT} -i ${SSH_KEY} -o ConnectTimeout=30 -o StrictHostKeyChecking=no -o ServerAliveInterval=60"
# rsync requires IPv6 addresses wrapped in brackets
EDGE_RSYNC_HOST="[${EDGE_HOST}]"

# Local destination
LOCAL_BASE="${HOME}/2.9.6-main/backups/edge"
LOCAL_DAILY="${LOCAL_BASE}/daily"
LOCAL_WEEKLY="${LOCAL_BASE}/weekly"

# Retention (longer than Edge — off-site is the long-term archive)
RETENTION_DAILY=30
RETENTION_WEEKLY=8

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

mkdir -p "${LOCAL_DAILY}" "${LOCAL_WEEKLY}"

log "${GREEN}=== ZION Off-Site Backup Sync Started ===${NC}"
log "Source : ${EDGE_USER}@${EDGE_HOST}:/opt/zion/backups/"
log "Dest   : ${LOCAL_BASE}"

# Verify SSH connectivity first
if ! ssh ${SSH_OPTS} "${EDGE_USER}@${EDGE_HOST}" 'echo ok' >/dev/null 2>&1; then
    log "${RED}  ✗ Cannot connect to Edge via SSH. Aborting.${NC}"
    exit 1
fi

# ── 1. Sync daily backups ───────────────────────────────────────────────────
log "Syncing daily backups..."
rsync -avz --partial --timeout=300 \
    -e "ssh ${SSH_OPTS}" \
    "${EDGE_USER}@${EDGE_RSYNC_HOST}:/opt/zion/backups/daily/" \
    "${LOCAL_DAILY}/" \
    --include='zion-edge-*.tar.gz' --exclude='*'

DAILY_COUNT=$(find "${LOCAL_DAILY}" -name 'zion-edge-*.tar.gz' -type f | wc -l)
DAILY_SIZE=$(du -sh "${LOCAL_DAILY}" 2>/dev/null | cut -f1 || echo "?")
log "${GREEN}  ✓ Daily: ${DAILY_COUNT} backups, ${DAILY_SIZE}${NC}"

# ── 2. Sync weekly backups ──────────────────────────────────────────────────
log "Syncing weekly backups..."
rsync -avz --partial --timeout=300 \
    -e "ssh ${SSH_OPTS}" \
    "${EDGE_USER}@${EDGE_RSYNC_HOST}:/opt/zion/backups/weekly/" \
    "${LOCAL_WEEKLY}/" \
    --include='zion-edge-*.tar.gz' --exclude='*'

WEEKLY_COUNT=$(find "${LOCAL_WEEKLY}" -name 'zion-edge-*.tar.gz' -type f | wc -l)
WEEKLY_SIZE=$(du -sh "${LOCAL_WEEKLY}" 2>/dev/null | cut -f1 || echo "?")
log "${GREEN}  ✓ Weekly: ${WEEKLY_COUNT} backups, ${WEEKLY_SIZE}${NC}"

# ── 3. Rotate local backups (keep longer than Edge) ─────────────────────────
log "Rotating local backups..."

DAILY_LEFT=$(find "${LOCAL_DAILY}" -name 'zion-edge-*.tar.gz' -type f | wc -l)
if [[ ${DAILY_LEFT} -gt ${RETENTION_DAILY} ]]; then
    find "${LOCAL_DAILY}" -name 'zion-edge-*.tar.gz' -type f -printf '%T@ %p\n' | \
        sort -n | head -n -${RETENTION_DAILY} | cut -d' ' -f2- | \
        xargs -r rm -f
    log "${GREEN}  ✓ Rotated daily (keep ${RETENTION_DAILY})${NC}"
fi

WEEKLY_LEFT=$(find "${LOCAL_WEEKLY}" -name 'zion-edge-*.tar.gz' -type f | wc -l)
if [[ ${WEEKLY_LEFT} -gt ${RETENTION_WEEKLY} ]]; then
    find "${LOCAL_WEEKLY}" -name 'zion-edge-*.tar.gz' -type f -printf '%T@ %p\n' | \
        sort -n | head -n -${RETENTION_WEEKLY} | cut -d' ' -f2- | \
        xargs -r rm -f
    log "${GREEN}  ✓ Rotated weekly (keep ${RETENTION_WEEKLY})${NC}"
fi

# ── 4. Verify latest backup integrity ───────────────────────────────────────
LATEST=$(find "${LOCAL_DAILY}" -name 'zion-edge-*.tar.gz' -type f -printf '%T@ %p\n' | \
    sort -rn | head -1 | cut -d' ' -f2-)
if [[ -n "${LATEST}" && -f "${LATEST}" ]]; then
    log "Verifying latest backup: $(basename ${LATEST})"
    if tar tzf "${LATEST}" >/dev/null 2>&1; then
        FILE_COUNT=$(tar tzf "${LATEST}" | wc -l)
        log "${GREEN}  ✓ Integrity OK (${FILE_COUNT} files)${NC}"
    else
        log "${RED}  ✗ Integrity check FAILED for ${LATEST}${NC}"
        exit 1
    fi
fi

# ── Summary ─────────────────────────────────────────────────────────────────
TOTAL_SIZE=$(du -sh "${LOCAL_BASE}" 2>/dev/null | cut -f1 || echo "unknown")
log "${GREEN}=== Off-Site Sync Complete ===${NC}"
log "  Daily backups : $(find "${LOCAL_DAILY}" -name 'zion-edge-*.tar.gz' -type f | wc -l)"
log "  Weekly backups: $(find "${LOCAL_WEEKLY}" -name 'zion-edge-*.tar.gz' -type f | wc -l)"
log "  Total size    : ${TOTAL_SIZE}"
