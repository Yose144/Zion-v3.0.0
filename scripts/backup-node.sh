#!/usr/bin/env bash
# ZION V3 — Local Node Backup
# ============================================================================
# Backs up all local node + L2/L3/L4/L5/L6 state from V3/data/:
#   - SQLite DBs (*.db)
#   - JSON state files (*.json)
#   - revenue_journal/ directory
# Optional: include logs/ and .env* files.
#
# Usage:
#   scripts/backup-node.sh                    # basic backup
#   scripts/backup-node.sh --with-env --logs  # include env + logs
#
# Retention: keeps the last 20 node backups.
# Backups go to: <repo>/backups/node/
# Recommended schedule: every 4 hours via systemd/Launchd/cron.
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/backups/node"
LOG_DIR="$REPO_ROOT/logs"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
ARCHIVE="$BACKUP_DIR/backup_node_$TIMESTAMP.tar.gz"

WITH_ENV=0
WITH_LOGS=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --with-env) WITH_ENV=1; shift ;;
        --logs)     WITH_LOGS=1; shift ;;
        *)          echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

mkdir -p "$BACKUP_DIR" "$LOG_DIR"

ITEMS=()

# Core state files in V3/data/
for f in "$REPO_ROOT"/V3/data/*.db "$REPO_ROOT"/V3/data/*.json; do
    [ -e "$f" ] && ITEMS+=("$f")
done

# Revenue journal
if [ -d "$REPO_ROOT/V3/data/revenue_journal" ]; then
    ITEMS+=("$REPO_ROOT/V3/data/revenue_journal")
fi

# Optional env files
if [ "$WITH_ENV" -eq 1 ]; then
    for f in "$REPO_ROOT"/.env*; do
        [ -e "$f" ] && ITEMS+=("$f")
    done
fi

# Optional logs
if [ "$WITH_LOGS" -eq 1 ] && [ -d "$REPO_ROOT/logs" ]; then
    ITEMS+=("$REPO_ROOT/logs")
fi

if [ ${#ITEMS[@]} -eq 0 ]; then
    echo "[backup-node] No local node data found, skipping"
    exit 0
fi

# Convert absolute paths to repo-relative for tar
REL_ITEMS=()
for f in "${ITEMS[@]}"; do
    REL_ITEMS+=("${f#$REPO_ROOT/}")
done

tar -czf "$ARCHIVE" -C "$REPO_ROOT" "${REL_ITEMS[@]}"
SIZE=$(du -m "$ARCHIVE" | cut -f1)
echo "[backup-node] $ARCHIVE (${SIZE} MB)"

# Retention — keep last 20 node backups
mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/backup_node_*.tar.gz 2>/dev/null | tail -n +21)
if [ ${#OLD[@]} -gt 0 ]; then
    echo "[backup-node] Cleaning up ${#OLD[@]} old backup(s)"
    rm -f "${OLD[@]}"
fi

exit 0
