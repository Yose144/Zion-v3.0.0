#!/bin/bash
# ZION PostgreSQL backup — EDGE2 (vmi3684458)
# ============================================================================
# Why this exists (2026-11-01):
#   The EDGE backup (zion-edge-backup.timer) tars /opt/zion/data/*.db on EDGE.
#   ZIS and MarketPlace moved to PostgreSQL on EDGE2 during the v3 split, so
#   their live databases (`zion`, `zion_marketplace`) were covered by NO backup
#   while the green daily archive on EDGE looked healthy. This unit dumps them
#   with pg_dump -Fc and keeps a rolling window.
#
# What it dumps:
#   - role/global objects   (pg_dumpall --globals-only)  → needed to restore
#   - zion                  (ZIS identity: users, sessions, audit)
#   - zion_marketplace      (orders, invoices, artifacts, listings)
#
# Integrity: every dump is verified with `pg_restore --list` before it counts.
# Retention: 14 daily dumps (hourly timer is deliberately not used — these DBs
#   are small and change slowly; adjust RETENTION_DAYS if that changes).
#
# Usage (manual):  sudo -u postgres /opt/zion/scripts/backup-pg-edge2.sh
# Usage (timer):   systemctl start zion-pg-backup.timer
#
# Disk: /opt/zion/backups/pg — dumps are custom-format (compressed) and tiny
#   (~1–3 MB per database today).
# ============================================================================

set -uo pipefail

# Zálohy obsahují credentials (edge-environment.sh) a DB — nikdy nesmí být
# world-readable. Fresh tar/dump by jinak zdědil 0644 z umasku shellu.
umask 077

BACKUP_DIR="${ZION_PG_BACKUP_DIR:-/opt/zion/backups/pg}"
RETENTION_DAYS="${ZION_PG_BACKUP_RETENTION_DAYS:-14}"
DBS="${ZION_PG_BACKUP_DBS:-zion zion_marketplace}"
PSQL="${PSQL:-psql}"
PG_DUMP="${PG_DUMP:-pg_dump}"
PG_DUMPALL="${PG_DUMPALL:-pg_dumpall}"
PG_RESTORE="${PG_RESTORE:-pg_restore}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; DIM='\033[2m'; NC='\033[0m'
STAMP="$(date +%Y%m%dT%H%M%SZ)"
FAILED=0

log() { printf '[pg-backup] %b%s%b\n' "${DIM}" "$*" "${NC}"; }
ok()  { printf '[pg-backup] %b✓%b %s\n' "${GREEN}" "${NC}" "$*"; }
warn(){ printf '[pg-backup] %b!%b %s\n' "${YELLOW}" "${NC}" "$*"; }
err() { printf '[pg-backup] %b✗%b %s\n' "${RED}" "${NC}" "$*" >&2; }

mkdir -p "${BACKUP_DIR}" || { err "cannot create ${BACKUP_DIR}"; exit 1; }

# ── globals (roles/passwords live only here) ────────────────────────────────
GLOBALS="${BACKUP_DIR}/globals-${STAMP}.sql"
if "${PG_DUMPALL}" --globals-only -f "${GLOBALS}.tmp" 2>/dev/null && [[ -s "${GLOBALS}.tmp" ]]; then
  mv -f "${GLOBALS}.tmp" "${GLOBALS}"
  ok "globals → $(basename "${GLOBALS}")"
else
  rm -f "${GLOBALS}.tmp"
  err "pg_dumpall --globals-only failed"
  FAILED=1
fi

# ── databases ──────────────────────────────────────────────────────────────
for db in ${DBS}; do
  out="${BACKUP_DIR}/${db}-${STAMP}.dump"
  if ! "${PSQL}" -d "${db}" -Atc 'select 1' >/dev/null 2>&1; then
    warn "database ${db} not reachable — skipped"
    continue
  fi
  if "${PG_DUMP}" -Fc -d "${db}" -f "${out}.tmp" 2>/dev/null && [[ -s "${out}.tmp" ]]; then
    # integrity: a truncated custom dump fails to list its TOC
    if "${PG_RESTORE}" --list "${out}.tmp" >/dev/null 2>&1; then
      mv -f "${out}.tmp" "${out}"
      size=$(du -h "${out}" | cut -f1)
      ok "${db} → $(basename "${out}") (${size})"
    else
      rm -f "${out}.tmp"
      err "${db}: dump present but pg_restore --list failed"
      FAILED=1
    fi
  else
    rm -f "${out}.tmp"
    err "${db}: pg_dump failed"
    FAILED=1
  fi
done

# ── retention ──────────────────────────────────────────────────────────────
find "${BACKUP_DIR}" -maxdepth 1 -type f \( -name '*.dump' -o -name 'globals-*.sql' \) \
  -mtime "+${RETENTION_DAYS}" -print -delete 2>/dev/null | while read -r f; do
  log "rotated $(basename "${f}")"
done

TOTAL=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
COUNT=$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name '*.dump' | wc -l | tr -d ' ')
log "dir=${BACKUP_DIR} files=${COUNT} size=${TOTAL:-?}"

if [[ ${FAILED} -ne 0 ]]; then
  err "finished with errors"
  exit 1
fi
ok "finished clean"
