#!/usr/bin/env bash
# pull-edge2-backups.sh — Mirror EDGE2 local backups to this machine.
#
# Why this exists (2026-11-15):
#   pull-edge-backups.sh mirrors EDGE1 {daily,weekly,node-db-bak}. EDGE2 keeps
#   its own backup tree at /opt/zion/backups/{pg,zis,services} — pg_dump -Fc
#   dumps of the ZIS identity DB and MarketPlace DBs (zion-pg-backup.timer,
#   daily 03:20), ZIS file backups, and systemd unit snapshots. Those dumps
#   also ride inside EDGE1's daily tarball, but a direct file-level mirror is
#   cheaper to restore from (no 600 MB tarball extraction).
#
# Runs via launchd (com.zion.pull-edge2-backups) hourly; rsync is incremental.
# Local retention mirrors pull-edge-backups.sh: newest N dumps per dir.

set -euo pipefail

EDGE2_HOST="${ZION_EDGE2_HOST:-207.180.217.100}"
EDGE2_PORT="${ZION_EDGE2_PORT:-22}"
EDGE2_USER="${ZION_EDGE2_USER:-root}"
SSH_KEY="${ZION_EDGE2_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
DEST="${ZION_EDGE2_BACKUP_DEST:-$HOME/backups/edge2}"
KEEP_PG="${ZION_EDGE2_BACKUP_KEEP_PG:-30}"        # ~30 days of daily pg dumps

# Single-instance lock (mkdir is atomic on macOS+Linux).
LOCKDIR="${DEST}.lock"
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  echo "$(date -Is) another pull-edge2-backups instance is running — skipping"
  exit 0
fi
trap 'rmdir "$LOCKDIR" 2>/dev/null' EXIT

mkdir -p "$DEST"

for sub in pg zis services; do
  rsync -az --timeout=60 \
    -e "ssh -i $SSH_KEY -p $EDGE2_PORT -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15" \
    "${EDGE2_USER}@${EDGE2_HOST}:/opt/zion/backups/${sub}/" "${DEST}/${sub}/"
done

# ── Local retention for pg dumps (daily cadence) ────────────────────────────
# Portable across GNU/BSD find: `ls -t` sorts by mtime desc (filenames here
# never contain spaces).
prune_newest() {
  local dir="$1" keep="$2"
  [ -d "$dir" ] || return 0
  ls -1t "$dir"/* 2>/dev/null | tail -n "+$((keep + 1))" \
    | while IFS= read -r old; do rm -f "$old"; done
}
prune_newest "$DEST/pg" "$KEEP_PG"

echo "$(date -Is) edge2 backups synced to ${DEST} (keep_pg=${KEEP_PG})"
