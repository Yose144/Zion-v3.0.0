#!/usr/bin/env bash
# pull-edge-backups.sh — Mirror Edge server backups to the local machine.
# Pulls /opt/zion/backups/{daily,weekly,node-db-bak} from Edge over SSH into
# ~/backups/edge/. Runs via cron; rsync is incremental so frequent runs are cheap.
#
# No --delete: local keeps archives even after Edge retention prunes them.
set -euo pipefail

EDGE_HOST="${ZION_EDGE_HOST:-62.171.141.136}"
EDGE_PORT="${ZION_EDGE_PORT:-2222}"
EDGE_USER="${ZION_EDGE_USER:-root}"
SSH_KEY="${ZION_EDGE_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
DEST="${ZION_EDGE_BACKUP_DEST:-$HOME/backups/edge}"

mkdir -p "$DEST"

for sub in daily weekly node-db-bak; do
  rsync -az --timeout=60 \
    -e "ssh -i $SSH_KEY -p $EDGE_PORT -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15" \
    "${EDGE_USER}@${EDGE_HOST}:/opt/zion/backups/${sub}/" "${DEST}/${sub}/"
done

echo "$(date -Is) edge backups synced to ${DEST}"
