#!/usr/bin/env bash
# ============================================================================
#  ZION V3 — Backup System (local + edge server)
#  Timer: zion-backup.timer (every 4 hours)
#
#  1. Local backup:  chain state DB + peers → backups/backup_local_<ts>.tar.gz
#  2. Edge backup:   SSH download all Edge DBs + config → backups/backup_edge_<ts>.tar.gz
#  3. Retention:     keep last 20 local + 20 edge backups
#
#  Edge files backed up:
#    /data/zion/state              — Node 1 chain state
#    /data/zion/state-node2        — Node 2 chain state
#    /data/zion/bridge-mainnet.db  — Bridge watcher
#    /data/zion/dao-mainnet.db     — DAO governance
#    /data/zion/atomic-swap.db     — Atomic swap escrow
#    /data/zion/warp-mainnet.db    — WARP relay
#    /data/zion/pplns-state.json   — PPLNS pool state
#    /data/zion/oasis.db           — L4 Oasis
#    /data/zion/free_world.db      — L5 Free World
#    /data/zion/issobella.db       — L6 Issobella
#    /data/zion/peers.json         — P2P peers
#    /root/zion/edge-environment.sh — Secrets, wallet keys, fee split
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${REPO_ROOT}/backups"
LOG_FILE="${REPO_ROOT}/logs/backup.log"
EDGE_SSH="zion-new"
EDGE_DATA_DIR="/data/zion"
EDGE_ENV_FILE="/root/zion/edge-environment.sh"

mkdir -p "$BACKUP_DIR" "${REPO_ROOT}/logs"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

# ── 1. Local chain state backup ────────────────────────────────────────────
log "=== Backup started ==="

LOCAL_ARCHIVE="${BACKUP_DIR}/backup_local_${TIMESTAMP}.tar.gz"
LOCAL_ITEMS=()
if [[ -f "${REPO_ROOT}/V3/data/zion-node-state.db" ]]; then
    LOCAL_ITEMS+=("V3/data/zion-node-state.db")
fi
if [[ -f "${REPO_ROOT}/V3/data/peers.json" ]]; then
    LOCAL_ITEMS+=("V3/data/peers.json")
fi
if [[ ${#LOCAL_ITEMS[@]} -gt 0 ]]; then
    tar -czf "$LOCAL_ARCHIVE" -C "${REPO_ROOT}" "${LOCAL_ITEMS[@]}" 2>/dev/null
    SIZE=$(du -m "$LOCAL_ARCHIVE" | cut -f1)
    log "Local backup: ${LOCAL_ARCHIVE} (${SIZE} MB) — ${LOCAL_ITEMS[*]}"
else
    log "WARN: No local state files found, skipping local backup"
fi

# ── 2. Edge server full backup (download via SSH) ──────────────────────────
EDGE_ARCHIVE="${BACKUP_DIR}/backup_edge_${TIMESTAMP}.tar.gz"

# Check if Edge is reachable
if ssh -o ConnectTimeout=5 -o BatchMode=yes "$EDGE_SSH" "true" 2>/dev/null; then
    # Build a remote script that tars all existing Edge data files.
    # We use a heredoc to avoid local variable expansion.
    ssh -o ConnectTimeout=10 -o BatchMode=yes "$EDGE_SSH" 'bash -s' <<'REMOTE_SCRIPT' > "$EDGE_ARCHIVE" 2>/dev/null
files=""
for f in /data/zion/state /data/zion/state-node2 /data/zion/bridge-mainnet.db \
         /data/zion/dao-mainnet.db /data/zion/atomic-swap.db /data/zion/warp-mainnet.db \
         /data/zion/pplns-state.json /data/zion/oasis.db /data/zion/free_world.db \
         /data/zion/issobella.db /data/zion/peers.json /root/zion/edge-environment.sh; do
    if [ -f "$f" ]; then
        files="$files $f"
    fi
done
if [ -n "$files" ]; then
    tar -czf - -C / $files
fi
REMOTE_SCRIPT

    if [[ -s "$EDGE_ARCHIVE" ]]; then
        SIZE=$(du -m "$EDGE_ARCHIVE" | cut -f1)
        log "Edge backup: ${EDGE_ARCHIVE} (${SIZE} MB) — all DBs + config"
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
