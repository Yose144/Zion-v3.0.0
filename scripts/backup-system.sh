#!/usr/bin/env bash
# ============================================================================
#  ZION V3 — Backup System (local + edge server)
#  Cron: 0 */6 * * * /home/zionserver/2.9.6-main/scripts/backup-system.sh
#
#  1. Local backup:  chain state DB → backups/backup_local_<ts>.tar.gz
#  2. Edge backup:   SSH download edge state → backups/backup_edge_<ts>.tar.gz
#  3. Retention:     keep last 20 local + 20 edge backups
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${REPO_ROOT}/backups"
LOG_FILE="${REPO_ROOT}/logs/backup.log"
EDGE_SSH="zion-new"
EDGE_STATE_PATH="/data/zion/state"

mkdir -p "$BACKUP_DIR" "${REPO_ROOT}/logs"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

# ── 1. Local chain state backup ────────────────────────────────────────────
log "=== Backup started ==="

LOCAL_ARCHIVE="${BACKUP_DIR}/backup_local_${TIMESTAMP}.tar.gz"
if [[ -f "${REPO_ROOT}/V3/data/zion-node-state.db" ]]; then
    tar -czf "$LOCAL_ARCHIVE" -C "${REPO_ROOT}" V3/data/zion-node-state.db V3/data/peers.json 2>/dev/null
    SIZE=$(du -m "$LOCAL_ARCHIVE" | cut -f1)
    log "Local backup: ${LOCAL_ARCHIVE} (${SIZE} MB)"
else
    log "WARN: Local state DB not found, skipping local backup"
fi

# ── 2. Edge server state backup (download via SSH) ─────────────────────────
EDGE_ARCHIVE="${BACKUP_DIR}/backup_edge_${TIMESTAMP}.tar.gz"
if ssh -o ConnectTimeout=5 -o BatchMode=yes "$EDGE_SSH" "test -f ${EDGE_STATE_PATH}" 2>/dev/null; then
    ssh -o ConnectTimeout=5 -o BatchMode=yes "$EDGE_SSH" \
        "tar -czf - -C $(dirname $EDGE_STATE_PATH) $(basename $EDGE_STATE_PATH) 2>/dev/null" \
        > "$EDGE_ARCHIVE" 2>/dev/null
    if [[ -s "$EDGE_ARCHIVE" ]]; then
        SIZE=$(du -m "$EDGE_ARCHIVE" | cut -f1)
        log "Edge backup: ${EDGE_ARCHIVE} (${SIZE} MB)"
    else
        log "WARN: Edge backup failed (empty archive)"
        rm -f "$EDGE_ARCHIVE"
    fi
else
    log "WARN: Edge server unreachable, skipping edge backup"
fi

# ── 3. Retention — keep last 20 of each ────────────────────────────────────
for prefix in "backup_local_" "backup_edge_"; do
    mapfile -t OLD < <(ls -1t "${BACKUP_DIR}"/${prefix}*.tar.gz 2>/dev/null | tail -n +21)
    if [[ ${#OLD[@]} -gt 0 ]]; then
        log "Cleanup: removing ${#OLD[@]} old ${prefix} backup(s)"
        rm -f "${OLD[@]}"
    fi
done

# ── Summary ────────────────────────────────────────────────────────────────
LOCAL_COUNT=$(ls -1 "${BACKUP_DIR}"/backup_local_*.tar.gz 2>/dev/null | wc -l)
EDGE_COUNT=$(ls -1 "${BACKUP_DIR}"/backup_edge_*.tar.gz 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
log "Done. Local: ${LOCAL_COUNT}, Edge: ${EDGE_COUNT}, Total: ${TOTAL_SIZE}"
