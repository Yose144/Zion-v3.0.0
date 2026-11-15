#!/usr/bin/env bash
# pull-edge-backups.sh — Mirror Edge server backups to the local machine.
# Pulls /opt/zion/backups/{daily,weekly,node-db-bak} from Edge over SSH into
# ~/backups/edge/. Runs via cron; rsync is incremental so frequent runs are cheap.
#
# Local retention (2026-10-31): the mirror used to grow without bound — every
# Edge snapshot stayed forever locally (44 daily tarballs = 19 G + 35 G of raw
# `v31_data_*` trees). Two guards now apply:
#
#   1. Raw `v31_data_*/` trees are EXCLUDED from the sync. Edge's
#      `zion-edge-<ts>.tar.gz` snapshots already contain the same
#      `v31_data_<ts>/` payload, so the raw trees are a redundant duplicate
#      (2 G each). Anything still needed locally is kept as
#      `v31_data_<ts>.tar.zst` (zstd, ~21 % of raw).
#   2. After the sync, `daily/` is pruned to the newest KEEP_DAILY tarballs
#      and `weekly/` to KEEP_WEEKLY — the local mirror is a *secondary*
#      archive, Edge itself keeps its own retention window.
#
# No --delete on the rsync itself: Edge-side pruning must never delete local
# copies before the local prune step runs.
set -euo pipefail

EDGE_HOST="${ZION_EDGE_HOST:-62.171.141.136}"
EDGE_PORT="${ZION_EDGE_PORT:-2222}"
EDGE_USER="${ZION_EDGE_USER:-root}"
SSH_KEY="${ZION_EDGE_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
DEST="${ZION_EDGE_BACKUP_DEST:-$HOME/backups/edge}"
KEEP_DAILY="${ZION_EDGE_BACKUP_KEEP_DAILY:-21}"   # ~7 days at 3 snapshots/day
KEEP_WEEKLY="${ZION_EDGE_BACKUP_KEEP_WEEKLY:-8}" # ~8 weeks

# Single-instance lock (mkdir is atomic on macOS+Linux) — launchd and manual
# runs must never overlap two rsyncs into the same DEST.
LOCKDIR="${DEST}.lock"
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  echo "$(date -Is) another pull-edge-backups instance is running — skipping"
  exit 0
fi
trap 'rmdir "$LOCKDIR" 2>/dev/null' EXIT

mkdir -p "$DEST"

for sub in daily weekly node-db-bak; do
  rsync -az --timeout=60 \
    --exclude 'v31_data_*/' \
    -e "ssh -i $SSH_KEY -p $EDGE_PORT -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15" \
    "${EDGE_USER}@${EDGE_HOST}:/opt/zion/backups/${sub}/" "${DEST}/${sub}/"
done

# ── Local retention ────────────────────────────────────────────────────────
prune_newest() {
  # $1 = dir, $2 = glob, $3 = keep count
  # Portable across GNU/BSD find: `ls -t` sorts by mtime desc (filenames here
  # never contain spaces).
  local dir="$1" glob="$2" keep="$3"
  [ -d "$dir" ] || return 0
  ls -1t "$dir"/$glob 2>/dev/null | tail -n "+$((keep + 1))" \
    | while IFS= read -r old; do rm -f "$old"; done
}
prune_newest "$DEST/daily" 'zion-edge-*.tar.gz' "$KEEP_DAILY"
prune_newest "$DEST/weekly" 'zion-edge-weekly-*.tar.gz' "$KEEP_WEEKLY"

# Raw v31_data trees that predate the exclusion are zstd-compressed once and
# then removed — the payload is preserved, the footprint drops ~5x.
if [ -d "$DEST/daily" ]; then
  for d in "$DEST/daily"/v31_data_*/; do
    [ -d "$d" ] || continue
    base="${d%/}"
    if command -v zstd >/dev/null 2>&1; then
      tar cf - -C "$DEST/daily" "$(basename "$base")" \
        | zstd -3 -T4 -q -o "${base}.tar.zst"
    else
      tar czf "${base}.tar.gz" -C "$DEST/daily" "$(basename "$base")"
    fi
    rm -rf "$base"
  done
fi

echo "$(date -Is) edge backups synced to ${DEST} (keep_daily=${KEEP_DAILY} keep_weekly=${KEEP_WEEKLY})"
