#!/usr/bin/env bash
# ZION TerraNova — legacy data backup script
# NOTE: This script previously backed up Redis + LMDB data, which are no longer
# used by the V3 mainnet stack. It is kept as a compatibility wrapper that
# delegates to the current backup implementation.
#
# Current canonical backup: scripts/backup-system.sh (run by zion-backup.timer)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Forward to the maintained backup script
exec "${SCRIPT_DIR}/backup-system.sh" "$@"
