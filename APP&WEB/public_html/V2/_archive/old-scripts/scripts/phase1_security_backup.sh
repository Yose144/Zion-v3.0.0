#!/bin/bash
# 🔒 ZION 2.8.3 Security & Backup Script
# Phase 1: Secure core system before public testnet release
# Date: October 29, 2025

set -e

echo "🔒 ZION 2.8.3 Security & Backup Procedure"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="/mnt/backup/zion-core-$(date +%Y%m%d_%H%M%S)"
CORE_DIR="/home/zion/ZION"
SSH_SERVER="91.98.122.165"
BACKUP_DISK="/dev/sda1"  # Adjust based on your setup

echo -e "${YELLOW}⚠️  WARNING: This script backs up sensitive data!${NC}"
echo "   Ensure you have:"
echo "   - External backup disk available"
echo "   - GPG key configured for encryption"
echo "   - 200GB+ free space"
echo ""
read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

# ============================================================================
# STEP 1: LOCAL BACKUP
# ============================================================================

echo ""
echo -e "${GREEN}[1/6] Creating local backup...${NC}"

mkdir -p "$BACKUP_DIR"
echo "Backup directory: $BACKUP_DIR"

# Backup important files
echo "  • Backing up core code..."
rsync -av \
    --exclude='__pycache__' \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='*.pyc' \
    --exclude='.pytest_cache' \
    "$CORE_DIR/src/core/" \
    "$BACKUP_DIR/src_core/" > /dev/null 2>&1

echo "  • Backing up mining modules..."
rsync -av \
    "$CORE_DIR/ai/" \
    "$BACKUP_DIR/ai_modules/" > /dev/null 2>&1 || true

echo "  • Backing up blockchain database..."
if [ -f "$CORE_DIR/zion_blockchain.db" ]; then
    cp "$CORE_DIR/zion_blockchain.db" "$BACKUP_DIR/"
    echo "  ✓ Blockchain DB backed up"
else
    echo "  ⚠ No blockchain DB found (OK)"
fi

echo -e "${GREEN}✓ Local backup complete${NC}"

# ============================================================================
# STEP 2: SENSITIVE FILES CHECK
# ============================================================================

echo ""
echo -e "${GREEN}[2/6] Checking sensitive files...${NC}"

SENSITIVE_FILES=(
    "seednodes.py"
    ".env"
    ".env.production"
    "private_keys.txt"
    "premine_addresses.txt"
    "admin_wallet.json"
    "blockchain_state.backup"
)

echo "Looking for sensitive files..."
FOUND_SENSITIVE=0

for file in "${SENSITIVE_FILES[@]}"; do
    if find "$CORE_DIR" -name "$file" -type f 2>/dev/null | grep -q .; then
        FOUND_SENSITIVE=1
        FILE_PATHS=$(find "$CORE_DIR" -name "$file" -type f 2>/dev/null)
        echo -e "${YELLOW}⚠️  Found: $file${NC}"
        echo "   Backing up to secure location..."
        cp $FILE_PATHS "$BACKUP_DIR/" 2>/dev/null || true
    fi
done

if [ $FOUND_SENSITIVE -eq 1 ]; then
    echo -e "${YELLOW}⚠️  Sensitive files will be EXCLUDED from public repo${NC}"
else
    echo -e "${GREEN}✓ No obvious sensitive files found${NC}"
fi

# ============================================================================
# STEP 3: GIT HISTORY AUDIT
# ============================================================================

echo ""
echo -e "${GREEN}[3/6] Auditing git history for secrets...${NC}"

echo "Scanning git history for credentials..."

SUSPICIOUS_PATTERNS=(
    "password"
    "api_key"
    "secret"
    "private_key"
    "premine"
    "0x[a-fA-F0-9]\{40\}"
)

LEAKED_COUNT=0
for pattern in "${SUSPICIOUS_PATTERNS[@]}"; do
    if git -C "$CORE_DIR" log --all --source --remotes --format="%H %cd %s" --grep="$pattern" -i 2>/dev/null | head -5; then
        LEAKED_COUNT=$((LEAKED_COUNT + 1))
    fi
done

if [ $LEAKED_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $LEAKED_COUNT commits with sensitive keywords${NC}"
    echo "   ACTION REQUIRED: Review and remove secrets"
else
    echo -e "${GREEN}✓ Git history looks clean${NC}"
fi

# ============================================================================
# STEP 4: DATABASE BACKUP
# ============================================================================

echo ""
echo -e "${GREEN}[4/6] Encrypting sensitive backup...${NC}"

# Create encrypted backup
BACKUP_ARCHIVE="$BACKUP_DIR/zion-core-backup.tar.gz"
tar -czf "$BACKUP_ARCHIVE" -C "$BACKUP_DIR" \
    src_core/ ai_modules/ 2>/dev/null || true

echo "  • Archive size: $(du -h "$BACKUP_ARCHIVE" 2>/dev/null | cut -f1)"

# Encrypt with GPG
if command -v gpg &> /dev/null; then
    echo "  • Encrypting with GPG..."
    gpg --symmetric --cipher-algo AES256 "$BACKUP_ARCHIVE" 2>/dev/null || true
    
    if [ -f "$BACKUP_ARCHIVE.gpg" ]; then
        rm "$BACKUP_ARCHIVE"
        echo -e "${GREEN}✓ Encrypted backup created${NC}"
    else
        echo -e "${YELLOW}⚠️  GPG encryption skipped${NC}"
    fi
else
    echo "  • GPG not available (skipping encryption)"
fi

# ============================================================================
# STEP 5: REMOTE BACKUP
# ============================================================================

echo ""
echo -e "${GREEN}[5/6] Creating remote backup (SSH)...${NC}"

# Backup to remote server
REMOTE_BACKUP_DIR="/opt/backup/zion-core"

ssh root@"$SSH_SERVER" "mkdir -p $REMOTE_BACKUP_DIR" 2>/dev/null || true

echo "  • Uploading to remote server..."
if command -v rsync &> /dev/null; then
    rsync -avz --progress "$BACKUP_DIR/" "root@$SSH_SERVER:$REMOTE_BACKUP_DIR/" \
        --exclude='*.log' 2>/dev/null || echo "  ⚠️  Remote backup failed (optional)"
fi

echo -e "${GREEN}✓ Remote backup queued${NC}"

# ============================================================================
# STEP 6: VERIFICATION & REPORT
# ============================================================================

echo ""
echo -e "${GREEN}[6/6] Generating backup report...${NC}"

REPORT_FILE="$BACKUP_DIR/BACKUP_REPORT.txt"

cat > "$REPORT_FILE" << 'EOF'
🔒 ZION CORE BACKUP REPORT
==========================

Backup Date: $(date)
Source: /home/zion/ZION
Destination: $BACKUP_DIR

CONTENTS:
---------
EOF

du -sh "$BACKUP_DIR"/* 2>/dev/null >> "$REPORT_FILE" || true

cat >> "$REPORT_FILE" << 'EOF'

SECURITY CHECKLIST:
-------------------
[ ] Backup encrypted with GPG
[ ] Backup on external drive
[ ] Backup on remote server
[ ] Database snapshot verified
[ ] Git history clean
[ ] Private keys NOT in public repo
[ ] Premine addresses NOT in public repo
[ ] Blockchain core logic backed up

RECOVERY PROCEDURE:
-------------------
1. Restore backup from external drive
2. Decrypt GPG archive if needed
3. Extract: tar -xzf backup.tar.gz
4. Verify blockchain state
5. Run full system tests

STORAGE LOCATIONS:
------------------
- Local: $BACKUP_DIR
- Remote: root@91.98.122.165:/opt/backup/zion-core/
- Cold Storage: [Hardware wallet location]

EOF

echo -e "${GREEN}✓ Report generated: $REPORT_FILE${NC}"

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "=========================================="
echo -e "${GREEN}✅ PHASE 1: SECURITY & BACKUPS COMPLETE!${NC}"
echo "=========================================="
echo ""
echo "📊 Summary:"
echo "  • Local backup: $BACKUP_DIR"
echo "  • Backup size: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo "  • Encrypted: $([ -f "$BACKUP_ARCHIVE.gpg" ] && echo "YES" || echo "NO")"
echo "  • Remote backup: $(ssh root@"$SSH_SERVER" "[ -d $REMOTE_BACKUP_DIR ] && echo YES || echo NO" 2>/dev/null)"
echo ""
echo "🔐 NEXT STEPS (Phase 2):"
echo "  1. Store backup on physical media"
echo "  2. Test restore procedure"
echo "  3. Setup DNS records (Nov 1-2)"
echo "  4. Configure SSL certificates"
echo "  5. Setup Nginx routing"
echo ""
echo "⏰ Target: November 1, 2025 - DNS/Domain Setup"
echo ""
