#!/usr/bin/env bash
# ZION V3 — Chain State Restore (Linux/macOS)
# Restores V3/data/ from a backup ZIP. WARNING: stops all services first.
# Usage: restore-chain.sh <backup-name>[.zip]
set -uo pipefail
source "$(dirname "$0")/_lib.sh"

BACKUP_NAME="${1:-}"
if [[ -z "$BACKUP_NAME" ]]; then
    zlog "[restore] Backup name required"
    exit 1
fi

BACKUP_DIR="$REPO_ROOT/backups"
ZIP_PATH="$BACKUP_DIR/$BACKUP_NAME"
[[ -f "$ZIP_PATH" ]] || ZIP_PATH="$BACKUP_DIR/$BACKUP_NAME.zip"
if [[ ! -f "$ZIP_PATH" ]]; then
    zlog "[restore] Backup not found: $ZIP_PATH"
    exit 1
fi

zlog "[restore] WARNING: this will replace current chain state."
zlog "[restore] Stopping all ZION processes first..."
bash "$SCRIPTS_DIR/stop-stack.sh" || true
sleep 2

# Emergency backup of current state
if [[ -d "$DATA_DIR" ]]; then
    EMERG="emergency_$(date '+%Y-%m-%d_%H-%M-%S')"
    zlog "[restore] Emergency backup of current state: $EMERG.zip"
    bash "$SCRIPTS_DIR/backup-chain.sh" --name "$EMERG" || true
fi

zlog "[restore] Removing current data..."
rm -rf "$DATA_DIR"
mkdir -p "$DATA_DIR"

zlog "[restore] Extracting $ZIP_PATH ..."
cd "$REPO_ROOT"
if command -v unzip >/dev/null 2>&1; then
    unzip -o -q "$ZIP_PATH" -d "$REPO_ROOT"
else
    python3 - "$ZIP_PATH" "$REPO_ROOT" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    z.extractall(sys.argv[2])
PY
fi

zlog "[restore] Done. Chain state restored from $BACKUP_NAME"
exit 0
