#!/usr/bin/env bash
# ZION V3 — Chain State Backup
# Creates a timestamped archive of V3/data/ (chain state + LMDB + pool DBs).
# Optionally includes logs and env files. Keeps the last 20 backups.
#
# Flags (mirror backup-chain.ps1, accepted from the dashboard):
#   -Name <label>    optional label embedded in the archive name
#   -IncludeLogs     also archive logs/
#   -IncludeEnv      also archive .env* files
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$REPO_ROOT/V3/data"
BACKUP_DIR="$REPO_ROOT/backups"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"

NAME=""
INCLUDE_LOGS=0
INCLUDE_ENV=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        -Name)        NAME="${2:-}"; shift 2 ;;
        -IncludeLogs) INCLUDE_LOGS=1; shift ;;
        -IncludeEnv)  INCLUDE_ENV=1; shift ;;
        *)            shift ;;
    esac
done

if [[ ! -d "$DATA_DIR" ]]; then
    echo "[backup] Data directory not found: $DATA_DIR" >&2
    exit 1
fi
mkdir -p "$BACKUP_DIR"

if [[ -n "$NAME" ]]; then
    BACKUP_NAME="backup_${NAME}_${TIMESTAMP}"
else
    BACKUP_NAME="backup_${TIMESTAMP}"
fi
ARCHIVE="$BACKUP_DIR/$BACKUP_NAME.tar.gz"

echo "[backup] Creating $ARCHIVE ..."

# Build tar input list (paths relative to REPO_ROOT for portable archives)
ITEMS=("V3/data")
[[ $INCLUDE_LOGS -eq 1 && -d "$REPO_ROOT/logs" ]] && ITEMS+=("logs")
if [[ $INCLUDE_ENV -eq 1 ]]; then
    while IFS= read -r f; do
        ITEMS+=("$(basename "$f")")
    done < <(find "$REPO_ROOT" -maxdepth 1 -name '.env*' 2>/dev/null)
fi

tar -czf "$ARCHIVE" -C "$REPO_ROOT" "${ITEMS[@]}"

SIZE_MB="$(du -m "$ARCHIVE" | cut -f1)"
echo "[backup] Done. Size: ${SIZE_MB} MB"
echo "[backup] Path: $ARCHIVE"

# Keep only the last 20 backups (auto-cleanup)
mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | tail -n +21)
if [[ ${#OLD[@]} -gt 0 ]]; then
    echo "[backup] Cleaning up ${#OLD[@]} old backup(s)..."
    rm -f "${OLD[@]}"
fi

exit 0
