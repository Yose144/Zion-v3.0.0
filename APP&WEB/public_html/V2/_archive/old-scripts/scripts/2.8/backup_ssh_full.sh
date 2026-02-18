#!/bin/bash
##
## 🔥 ZION SSH FULL BACKUP SCRIPT 🔥
## Kompletní záloha SSH serveru 91.98.122.165 před čistým deployem
##
## Version: 2.8.0
## Date: 2025-10-21
##

set -e  # Exit on any error

SSH_HOST="root@91.98.122.165"
BACKUP_DIR="./ssh_backup_$(date +%Y%m%d_%H%M%S)"
BACKUP_LOG="${BACKUP_DIR}/backup.log"

echo "🔥 ZION SSH FULL BACKUP 🔥"
echo "=========================="
echo "SSH Host: ${SSH_HOST}"
echo "Backup Dir: ${BACKUP_DIR}"
echo ""

# Create backup directory
mkdir -p "${BACKUP_DIR}"
echo "✅ Created backup directory: ${BACKUP_DIR}" | tee -a "${BACKUP_LOG}"

# Function to backup with logging
backup_file() {
    local src="$1"
    local desc="$2"
    echo "📦 Backing up ${desc}..." | tee -a "${BACKUP_LOG}"
    if scp -r "${SSH_HOST}:${src}" "${BACKUP_DIR}/" 2>&1 | tee -a "${BACKUP_LOG}"; then
        echo "   ✅ ${desc} backed up" | tee -a "${BACKUP_LOG}"
        return 0
    else
        echo "   ⚠️  ${desc} backup failed (may not exist)" | tee -a "${BACKUP_LOG}"
        return 1
    fi
}

# 1. Blockchain Database
echo "" | tee -a "${BACKUP_LOG}"
echo "⛓️  BLOCKCHAIN DATA" | tee -a "${BACKUP_LOG}"
echo "==================" | tee -a "${BACKUP_LOG}"
backup_file "zion_blockchain.db" "Blockchain Database"
backup_file "zion_blockchain.db-journal" "Blockchain Journal"

# 2. Pool Database
echo "" | tee -a "${BACKUP_LOG}"
echo "⛏️  POOL DATA" | tee -a "${BACKUP_LOG}"
echo "=============" | tee -a "${BACKUP_LOG}"
backup_file "zion_pool.db" "Pool Database"
backup_file "zion_pool.db-journal" "Pool Journal"

# 3. Configuration Files
echo "" | tee -a "${BACKUP_LOG}"
echo "⚙️  CONFIGURATION" | tee -a "${BACKUP_LOG}"
echo "=================" | tee -a "${BACKUP_LOG}"
backup_file "seednodes.py" "Seed Nodes Config"
backup_file "config.json" "General Config"
backup_file ".env" "Environment Variables"

# 4. Python Scripts
echo "" | tee -a "${BACKUP_LOG}"
echo "🐍 PYTHON SCRIPTS" | tee -a "${BACKUP_LOG}"
echo "=================" | tee -a "${BACKUP_LOG}"
backup_file "new_zion_blockchain.py" "Blockchain Core"
backup_file "zion_universal_pool_v2.py" "Universal Pool"
backup_file "run_blockchain_production.py" "Blockchain Runner"
backup_file "zion_rpc_server.py" "RPC Server"
backup_file "zion_p2p_network.py" "P2P Network"
backup_file "crypto_utils.py" "Crypto Utils"
backup_file "blockchain_rpc_client.py" "RPC Client"

# 5. Logs
echo "" | tee -a "${BACKUP_LOG}"
echo "📋 LOGS" | tee -a "${BACKUP_LOG}"
echo "=======" | tee -a "${BACKUP_LOG}"
backup_file "pool.log" "Pool Log"
backup_file "blockchain_rpc.log" "Blockchain RPC Log"
backup_file "*.log" "All Logs"

# 6. Wallet Keys (if exist)
echo "" | tee -a "${BACKUP_LOG}"
echo "🔑 WALLET DATA" | tee -a "${BACKUP_LOG}"
echo "==============" | tee -a "${BACKUP_LOG}"
backup_file "wallets/" "Wallet Directory"
backup_file "*.key" "Key Files"

# 7. Process Status
echo "" | tee -a "${BACKUP_LOG}"
echo "📊 PROCESS STATUS" | tee -a "${BACKUP_LOG}"
echo "=================" | tee -a "${BACKUP_LOG}"
ssh "${SSH_HOST}" "ps aux | grep -E 'python|zion|pool|blockchain' | grep -v grep" > "${BACKUP_DIR}/process_status.txt" 2>&1 || true
echo "   ✅ Process status saved" | tee -a "${BACKUP_LOG}"

# 8. Network Status
echo "" | tee -a "${BACKUP_LOG}"
echo "🌐 NETWORK STATUS" | tee -a "${BACKUP_LOG}"
echo "=================" | tee -a "${BACKUP_LOG}"
ssh "${SSH_HOST}" "netstat -tulpn | grep -E '18080|18081|3333|8332|8333'" > "${BACKUP_DIR}/network_status.txt" 2>&1 || true
echo "   ✅ Network status saved" | tee -a "${BACKUP_LOG}"

# 9. Disk Usage
echo "" | tee -a "${BACKUP_LOG}"
echo "💾 DISK USAGE" | tee -a "${BACKUP_LOG}"
echo "=============" | tee -a "${BACKUP_LOG}"
ssh "${SSH_HOST}" "df -h" > "${BACKUP_DIR}/disk_usage.txt" 2>&1 || true
echo "   ✅ Disk usage saved" | tee -a "${BACKUP_LOG}"

# 10. Database Stats
echo "" | tee -a "${BACKUP_LOG}"
echo "📈 DATABASE STATISTICS" | tee -a "${BACKUP_LOG}"
echo "======================" | tee -a "${BACKUP_LOG}"
ssh "${SSH_HOST}" "python3 << 'EOF' > /tmp/db_stats.txt 2>&1
import sqlite3

print('=' * 60)
print('BLOCKCHAIN DATABASE')
print('=' * 60)
try:
    conn = sqlite3.connect('zion_blockchain.db')
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM blocks')
    print(f'Blocks: {c.fetchone()[0]}')
    c.execute('SELECT COUNT(*) FROM balances')
    print(f'Balances: {c.fetchone()[0]}')
    c.execute('SELECT COUNT(*) FROM transactions')
    print(f'Transactions: {c.fetchone()[0]}')
    conn.close()
except Exception as e:
    print(f'Error: {e}')

print()
print('=' * 60)
print('POOL DATABASE')
print('=' * 60)
try:
    conn = sqlite3.connect('zion_pool.db')
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM shares')
    print(f'Shares: {c.fetchone()[0]}')
    c.execute('SELECT COUNT(*) FROM blocks')
    print(f'Blocks: {c.fetchone()[0]}')
    c.execute('SELECT COUNT(DISTINCT address) FROM miners')
    print(f'Miners: {c.fetchone()[0]}')
    conn.close()
except Exception as e:
    print(f'Error: {e}')
EOF
cat /tmp/db_stats.txt
" > "${BACKUP_DIR}/database_stats.txt" 2>&1 || true
echo "   ✅ Database stats saved" | tee -a "${BACKUP_LOG}"

# Create archive
echo "" | tee -a "${BACKUP_LOG}"
echo "📦 Creating compressed archive..." | tee -a "${BACKUP_LOG}"
tar -czf "${BACKUP_DIR}.tar.gz" "${BACKUP_DIR}/"
ARCHIVE_SIZE=$(du -h "${BACKUP_DIR}.tar.gz" | cut -f1)
echo "   ✅ Archive created: ${BACKUP_DIR}.tar.gz (${ARCHIVE_SIZE})" | tee -a "${BACKUP_LOG}"

# Summary
echo "" | tee -a "${BACKUP_LOG}"
echo "================================================================================" | tee -a "${BACKUP_LOG}"
echo "✅ BACKUP COMPLETE" | tee -a "${BACKUP_LOG}"
echo "================================================================================" | tee -a "${BACKUP_LOG}"
echo "Backup Location: ${BACKUP_DIR}/" | tee -a "${BACKUP_LOG}"
echo "Archive: ${BACKUP_DIR}.tar.gz (${ARCHIVE_SIZE})" | tee -a "${BACKUP_LOG}"
echo "Log File: ${BACKUP_LOG}" | tee -a "${BACKUP_LOG}"
echo "" | tee -a "${BACKUP_LOG}"
echo "To restore:" | tee -a "${BACKUP_LOG}"
echo "  tar -xzf ${BACKUP_DIR}.tar.gz" | tee -a "${BACKUP_LOG}"
echo "  scp -r ${BACKUP_DIR}/* ${SSH_HOST}:~/" | tee -a "${BACKUP_LOG}"
echo "" | tee -a "${BACKUP_LOG}"
echo "🌟 Ready for clean deployment! 🌟" | tee -a "${BACKUP_LOG}"
echo "================================================================================" | tee -a "${BACKUP_LOG}"
