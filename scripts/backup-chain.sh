#!/usr/bin/env bash
# ZION V31 — Chain State Backup (manual / dashboard-triggered)
# Creates a timestamped, consistent archive of V31/data/ using sqlite3 .backup.
# Optionally includes logs/ and .env* files. Keeps the last 20 backups.
#
# Flags (mirror backup-chain.ps1, accepted from the dashboard):
#   -Name <label>    optional label embedded in the archive name
#   -IncludeLogs     also archive logs/
#   -IncludeEnv      also archive .env* files
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$REPO_ROOT/V31/data"
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

STAGING_DIR="$BACKUP_DIR/.staging/chain_${TIMESTAMP}"
rm -rf "$STAGING_DIR" 2>/dev/null || true
mkdir -p "$STAGING_DIR"

# ── 1. Consistent SQLite backups of every .db in V31/data ───────────────────
for db in "$DATA_DIR"/*.db; do
    [[ -e "$db" ]] || continue
    base=$(basename "$db")
    # Skip symlinks and stale copies
    if [[ -L "$db" ]] || [[ "$base" == *.stale-* ]]; then
        echo "[backup]  skipping $base (symlink/stale)"
        continue
    fi
    dest="$STAGING_DIR/$base"
    if command -v sqlite3 >/dev/null 2>&1 && sqlite3 "$db" ".backup '${dest}'" 2>/dev/null; then
        echo "[backup]  ✓ $base"
    else
        echo "[backup]  ⚠ sqlite3 .backup failed for $base, falling back to cp"
        cp "$db" "$dest" 2>/dev/null || true
    fi
done

# ── 2. JSON / TOML state files ──────────────────────────────────────────────
for f in "$DATA_DIR"/*.json "$DATA_DIR"/*.toml; do
    [[ -e "$f" ]] || continue
    [[ -L "$f" ]] && continue
    cp "$f" "$STAGING_DIR/"
    echo "[backup]  ✓ $(basename "$f")"
done

# ── 3. Revenue journal directory ────────────────────────────────────────────
if [[ -d "$DATA_DIR/revenue_journal" ]]; then
    cp -r "$DATA_DIR/revenue_journal" "$STAGING_DIR/"
    echo "[backup]  ✓ revenue_journal/"
fi

# ── 4. Optional logs and env files ──────────────────────────────────────────
if [[ $INCLUDE_LOGS -eq 1 && -d "$REPO_ROOT/logs" ]]; then
    cp -r "$REPO_ROOT/logs" "$STAGING_DIR/"
    echo "[backup]  ✓ logs/"
fi
if [[ $INCLUDE_ENV -eq 1 ]]; then
    while IFS= read -r f; do
        cp "$f" "$STAGING_DIR/"
        echo "[backup]  ✓ $(basename "$f")"
    done < <(find "$REPO_ROOT" -maxdepth 1 -name '.env*' -type f 2>/dev/null)
fi

# ── 5. Create archive with files at the archive root ────────────────────────
tar -czf "$ARCHIVE" -C "$STAGING_DIR" .
SIZE_MB="$(du -m "$ARCHIVE" | cut -f1)"

echo "[backup] Done. Size: ${SIZE_MB} MB"
echo "[backup] Path: $ARCHIVE"

# ── 6. Cleanup staging and rotate old backups ───────────────────────────────
rm -rf "$STAGING_DIR"

mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | tail -n +21)
if [[ ${#OLD[@]} -gt 0 ]]; then
    echo "[backup] Cleaning up ${#OLD[@]} old backup(s)..."
    rm -f "${OLD[@]}"
fi

exit 0
