#!/usr/bin/env bash
# replicate-pool-state.sh — push a consistent PPLNS/store snapshot from
# the primary pool host to an off-box standby target.  Run periodically
# (systemd timer / cron) so a cold-standby bring-up loses at most one
# interval of unpaid-share drift instead of a whole backup day.
#
# Env:
#   STANDBY_STATE_TARGET  — rsync destination, e.g.
#                           "root@10.0.0.5:/opt/zion/data/v31/" or, via
#                           the rig reverse tunnel on this host,
#                           "-e 'ssh -p 8322 -i /root/.ssh/rig-admin' root@127.0.0.1:/opt/llm/pool-standby/"
#   POOL_DATA_DIR         — source dir (default /opt/zion/data/v31)
#
# sqlite is copied via `VACUUM INTO` when sqlite3 is present (crash-safe,
# WAL folded in); otherwise a plain cp after sync — a standby seed may
# be one checkpoint stale, never corrupt-in-a-bad-way (sqlite self-heals
# WAL on open anyway).

set -euo pipefail

POOL_DATA_DIR="${POOL_DATA_DIR:-/opt/zion/data/v31}"
TARGET="${STANDBY_STATE_TARGET:?set STANDBY_STATE_TARGET}"
STAGE="$(mktemp -d /tmp/pool-state-XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$POOL_DATA_DIR/pool-store.db" "VACUUM INTO '$STAGE/pool-store.db';"
else
  cp "$POOL_DATA_DIR/pool-store.db" "$STAGE/pool-store.db"
fi
[[ -f "$POOL_DATA_DIR/pool-pplns.json" ]] && cp "$POOL_DATA_DIR/pool-pplns.json" "$STAGE/"

# shellcheck disable=SC2086
rsync -az $TARGET_SSH_OPTS "$STAGE"/ "$TARGET"

logger -t zion-pool-standby "state replicated -> ${TARGET%%:*}"
