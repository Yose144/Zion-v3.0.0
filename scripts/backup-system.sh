#!/usr/bin/env bash
# ZION V31 — Local Backup System
# ============================================================================
# Backs up the LOCAL V31 databases + state on this machine.
#
#   V31 data:  V31/data/*.db (SQLite, backed up consistently via .backup)
#              V31/data/*.json, V31/data/*.toml
#              V31/data/revenue_journal/
#
# Uses sqlite3 .backup for each DB so the archive is consistent even while
# services are running. Keeps the last 20 local backups.
#
# Timer: zion-backup.timer (every 4 hours)
# Output: backups/backup_local_<timestamp>.tar.gz
#
# Edge/off-site backups are handled separately by:
#   ZION_OS/infra/scripts/sync-edge-backups.sh (zion-offsite-sync.timer)
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${REPO_ROOT}/V31/data"
BACKUP_DIR="${REPO_ROOT}/backups"
LOG_FILE="${REPO_ROOT}/logs/backup.log"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

mkdir -p "$BACKUP_DIR" "${REPO_ROOT}/logs"

log "=== V31 local backup started ==="

if [[ ! -d "$DATA_DIR" ]]; then
    log "ERROR: Data directory not found: $DATA_DIR"
    exit 1
fi

STAGING_DIR="${BACKUP_DIR}/.staging/v31_local_${TIMESTAMP}"
rm -rf "$STAGING_DIR" 2>/dev/null || true
mkdir -p "$STAGING_DIR"

# ── 1. Consistent SQLite backups of every .db in V31/data ───────────────────
log "Backing up V31 SQLite databases..."
DB_COUNT=0
for db in "$DATA_DIR"/*.db; do
    [[ -e "$db" ]] || continue
    base=$(basename "$db")
    # Skip symlinks and stale copies
    if [[ -L "$db" ]] || [[ "$base" == *.stale-* ]]; then
        log "  skipping $base (symlink/stale)"
        continue
    fi
    dest="${STAGING_DIR}/${base}"
    if command -v sqlite3 >/dev/null 2>&1; then
        if sqlite3 "$db" ".backup '${dest}'" 2>/dev/null; then
            log "  ✓ $base"
            DB_COUNT=$((DB_COUNT + 1))
        else
            log "  ⚠ sqlite3 .backup failed for $base, falling back to cp"
            cp "$db" "$dest" 2>/dev/null || true
        fi
    else
        cp "$db" "$dest" 2>/dev/null || true
    fi
done

# ── 2. JSON / TOML state files ──────────────────────────────────────────────
log "Backing up state files..."
for f in "$DATA_DIR"/*.json "$DATA_DIR"/*.toml; do
    [[ -e "$f" ]] || continue
    [[ -L "$f" ]] && continue
    cp "$f" "$STAGING_DIR/"
    log "  ✓ $(basename "$f")"
done

# ── 3. Revenue journal directory ────────────────────────────────────────────
if [[ -d "$DATA_DIR/revenue_journal" ]]; then
    cp -r "$DATA_DIR/revenue_journal" "$STAGING_DIR/"
    log "  ✓ revenue_journal/"
fi

# ── 4. Create archive (paths relative to REPO_ROOT for portability) ─────────
LOCAL_ARCHIVE="${BACKUP_DIR}/backup_local_${TIMESTAMP}.tar.gz"

tar -czf "$LOCAL_ARCHIVE" -C "$STAGING_DIR" .
SIZE_MB=$(du -m "$LOCAL_ARCHIVE" | cut -f1)

log "Local backup: ${LOCAL_ARCHIVE} (${SIZE_MB} MB) — ${DB_COUNT} DBs"

# ── 5. Cleanup staging ──────────────────────────────────────────────────────
rm -rf "$STAGING_DIR"

# ── 6. Retention — keep last 20 local backups ───────────────────────────────
mapfile -t OLD < <(ls -1t "${BACKUP_DIR}"/backup_local_*.tar.gz 2>/dev/null | tail -n +21)
if [[ ${#OLD[@]} -gt 0 ]]; then
    log "Cleanup: removing ${#OLD[@]} old local backup(s)"
    rm -f "${OLD[@]}"
fi

LOCAL_COUNT=$(ls -1 "${BACKUP_DIR}"/backup_local_*.tar.gz 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "?")
log "Done. Local backups: ${LOCAL_COUNT}, Total backup dir: ${TOTAL_SIZE}"
