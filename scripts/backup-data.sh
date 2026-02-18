#!/bin/bash
# ZION TerraNova — Automated Data Backup Script
# P1-39: Backup Redis + LMDB data
#
# Usage: ./backup-data.sh [server_ip]
# Cron:  0 */6 * * * /path/to/backup-data.sh >> /var/log/zion-backup.log 2>&1
#
# Backs up:
#   1. Redis RDB snapshot (BGSAVE → dump.rdb)
#   2. LMDB blockchain data (data.mdb copy)
#   3. Pool data directory
#
# Retention: 7 daily + 4 weekly backups

set -euo pipefail

# --- Configuration ---
BACKUP_DIR="${ZION_BACKUP_DIR:-/var/backups/zion}"
LMDB_DATA_DIR="${ZION_DATA_DIR:-/data/zion}"
POOL_DATA_DIR="${ZION_POOL_DIR:-/data/zion-pool}"
REDIS_CLI="${REDIS_CLI:-redis-cli}"
RETENTION_DAILY=7
RETENTION_WEEKLY=4

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday

# --- Colors ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

# --- Setup ---
DAILY_DIR="${BACKUP_DIR}/daily"
WEEKLY_DIR="${BACKUP_DIR}/weekly"
mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}"

log "${GREEN}=== ZION Backup Started ===${NC}"

# --- 1. Redis Backup ---
log "Backing up Redis..."
if command -v ${REDIS_CLI} &>/dev/null; then
    REDIS_PASSWORD="${REDIS_PASSWORD:-}"
    REDIS_AUTH=""
    [ -n "${REDIS_PASSWORD}" ] && REDIS_AUTH="-a ${REDIS_PASSWORD}"

    # Trigger background save
    ${REDIS_CLI} ${REDIS_AUTH} BGSAVE 2>/dev/null || true
    
    # Wait for save to complete (max 60s)
    for i in $(seq 1 60); do
        LAST_SAVE=$(${REDIS_CLI} ${REDIS_AUTH} LASTSAVE 2>/dev/null || echo "0")
        sleep 1
        NEW_SAVE=$(${REDIS_CLI} ${REDIS_AUTH} LASTSAVE 2>/dev/null || echo "0")
        [ "${NEW_SAVE}" != "${LAST_SAVE}" ] || [ "${i}" -ge 5 ] && break
    done

    # Find and copy dump.rdb
    REDIS_DIR=$(${REDIS_CLI} ${REDIS_AUTH} CONFIG GET dir 2>/dev/null | tail -1 || echo "/var/lib/redis")
    if [ -f "${REDIS_DIR}/dump.rdb" ]; then
        cp "${REDIS_DIR}/dump.rdb" "${DAILY_DIR}/redis_dump_${TIMESTAMP}.rdb"
        log "${GREEN}  ✅ Redis backup: redis_dump_${TIMESTAMP}.rdb${NC}"
    else
        log "${YELLOW}  ⚠️  Redis dump.rdb not found at ${REDIS_DIR}${NC}"
    fi
else
    log "${YELLOW}  ⚠️  redis-cli not found, skipping Redis backup${NC}"
fi

# --- 2. LMDB Backup ---
log "Backing up LMDB blockchain data..."
if [ -d "${LMDB_DATA_DIR}" ]; then
    # LMDB is safe to copy while running (MVCC architecture)
    # But we use cp --reflink for CoW filesystems (btrfs/xfs)
    LMDB_BACKUP="${DAILY_DIR}/lmdb_${TIMESTAMP}"
    mkdir -p "${LMDB_BACKUP}"
    
    if [ -f "${LMDB_DATA_DIR}/data.mdb" ]; then
        cp --reflink=auto "${LMDB_DATA_DIR}/data.mdb" "${LMDB_BACKUP}/" 2>/dev/null \
            || cp "${LMDB_DATA_DIR}/data.mdb" "${LMDB_BACKUP}/"
        log "${GREEN}  ✅ LMDB data.mdb copied ($(du -sh "${LMDB_BACKUP}/data.mdb" | cut -f1))${NC}"
    fi
    
    if [ -f "${LMDB_DATA_DIR}/lock.mdb" ]; then
        cp "${LMDB_DATA_DIR}/lock.mdb" "${LMDB_BACKUP}/" 2>/dev/null || true
    fi
    
    # Compress
    tar -czf "${LMDB_BACKUP}.tar.gz" -C "${DAILY_DIR}" "lmdb_${TIMESTAMP}" 2>/dev/null && rm -rf "${LMDB_BACKUP}"
    log "${GREEN}  ✅ LMDB backup compressed: lmdb_${TIMESTAMP}.tar.gz${NC}"
else
    log "${YELLOW}  ⚠️  LMDB data dir not found: ${LMDB_DATA_DIR}${NC}"
fi

# --- 3. Pool Data Backup ---
log "Backing up pool data..."
if [ -d "${POOL_DATA_DIR}" ]; then
    tar -czf "${DAILY_DIR}/pool_data_${TIMESTAMP}.tar.gz" -C "$(dirname ${POOL_DATA_DIR})" "$(basename ${POOL_DATA_DIR})" 2>/dev/null
    log "${GREEN}  ✅ Pool backup: pool_data_${TIMESTAMP}.tar.gz${NC}"
else
    log "${YELLOW}  ⚠️  Pool data dir not found: ${POOL_DATA_DIR}${NC}"
fi

# --- 4. Weekly Rotation (Sunday) ---
if [ "${DAY_OF_WEEK}" = "7" ]; then
    log "Creating weekly backup snapshot..."
    WEEK_NUM=$(date +%Y_W%V)
    for f in "${DAILY_DIR}"/*_${TIMESTAMP}*; do
        [ -f "${f}" ] && cp "${f}" "${WEEKLY_DIR}/weekly_${WEEK_NUM}_$(basename ${f})"
    done
    log "${GREEN}  ✅ Weekly backup created for ${WEEK_NUM}${NC}"
fi

# --- 5. Cleanup Old Backups ---
log "Cleaning up old backups..."
# Daily: keep last N days
find "${DAILY_DIR}" -type f -mtime +${RETENTION_DAILY} -delete 2>/dev/null
DAILY_COUNT=$(find "${DAILY_DIR}" -type f | wc -l)
log "  Daily backups retained: ${DAILY_COUNT}"

# Weekly: keep last N weeks
find "${WEEKLY_DIR}" -type f -mtime +$((RETENTION_WEEKLY * 7)) -delete 2>/dev/null
WEEKLY_COUNT=$(find "${WEEKLY_DIR}" -type f | wc -l)
log "  Weekly backups retained: ${WEEKLY_COUNT}"

# --- Summary ---
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1 || echo "unknown")
log "${GREEN}=== Backup Complete === Total size: ${TOTAL_SIZE}${NC}"
