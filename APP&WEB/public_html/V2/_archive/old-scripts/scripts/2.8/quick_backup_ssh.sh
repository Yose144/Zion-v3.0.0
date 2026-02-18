#!/usr/bin/env bash
#
# ZION SSH Quick Backup Script  
#

set -e

echo "💾 ZION SSH Quick Backup"
echo "========================"

SERVER_HOST="91.98.122.165"
SERVER_USER="root"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/maitreya/zion_backups"
BACKUP_NAME="zion_ssh_backup_$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "📅 Backup timestamp: $TIMESTAMP"
echo "📂 Backup file: $BACKUP_DIR/$BACKUP_NAME"

echo ""
echo "📦 Creating server-side backup archive..."

# Create backup on server and download
ssh "$SERVER_USER@$SERVER_HOST" << 'EOF'
cd /root
echo "🗂️  Creating backup archive..."

tar -czf /tmp/zion_backup.tar.gz \
    --exclude='*.log' \
    --exclude='*.db-journal' \
    --exclude='venv/' \
    --exclude='node_modules/' \
    --exclude='.git/' \
    --exclude='*.tmp' \
    --exclude='__pycache__/' \
    . 2>/dev/null

echo "✅ Archive created: $(du -h /tmp/zion_backup.tar.gz | cut -f1)"
EOF

echo "📥 Downloading backup..."
scp "$SERVER_USER@$SERVER_HOST:/tmp/zion_backup.tar.gz" "$BACKUP_DIR/$BACKUP_NAME"

# Cleanup server temp file
ssh "$SERVER_USER@$SERVER_HOST" "rm -f /tmp/zion_backup.tar.gz"

# Create Docker info backup
echo "🐳 Saving Docker information..."
ssh "$SERVER_USER@$SERVER_HOST" << 'EOF' > "$BACKUP_DIR/docker_info_$TIMESTAMP.txt"
echo "=== Docker Status at $(date) ==="
echo ""
echo "📦 Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🖼️  Images:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

echo ""
echo "💿 Volumes:"
docker volume ls

echo ""
echo "🌐 Networks:"
docker network ls

echo ""
echo "📊 System info:"
docker system df

echo ""
echo "🔧 Compose config (if exists):"
if [ -f docker-compose.yml ]; then
    echo "--- docker-compose.yml ---"
    cat docker-compose.yml
fi

if [ -f docker-compose.production.yml ]; then
    echo "--- docker-compose.production.yml ---"
    cat docker-compose.production.yml
fi
EOF

# Create restore instructions
cat > "$BACKUP_DIR/restore_instructions_$TIMESTAMP.md" << EOF
# ZION SSH Stack Restore Instructions

**Backup Date:** $(date)
**Backup File:** $BACKUP_NAME
**Server:** $SERVER_HOST

## Quick Restore

### 1. Extract backup to server:
\`\`\`bash
scp $BACKUP_DIR/$BACKUP_NAME root@$SERVER_HOST:/tmp/
ssh root@$SERVER_HOST "cd /root && tar -xzf /tmp/$BACKUP_NAME && rm /tmp/$BACKUP_NAME"
\`\`\`

### 2. Start Docker services:
\`\`\`bash
ssh root@$SERVER_HOST "cd /root/Zion-TestNet-2.7.5 && docker-compose up -d"
\`\`\`

## Manual Restore Steps

1. **Backup current state** (if any):
   \`\`\`bash
   ssh root@$SERVER_HOST "mv /root /root.backup.\$(date +%Y%m%d_%H%M%S)"
   \`\`\`

2. **Create new root directory**:
   \`\`\`bash
   ssh root@$SERVER_HOST "mkdir /root"
   \`\`\`

3. **Extract backup**:
   \`\`\`bash
   scp $BACKUP_DIR/$BACKUP_NAME root@$SERVER_HOST:/root/
   ssh root@$SERVER_HOST "cd /root && tar -xzf $BACKUP_NAME && rm $BACKUP_NAME"
   \`\`\`

4. **Restore Docker services**:
   \`\`\`bash
   ssh root@$SERVER_HOST "cd /root/Zion-TestNet-2.7.5"
   ssh root@$SERVER_HOST "docker-compose down || true"
   ssh root@$SERVER_HOST "docker-compose up -d"
   \`\`\`

## Backup Contents

- Complete /root directory structure
- All ZION source code and configurations  
- Docker Compose files
- Database files (excluding journals)
- Scripts and documentation

## Verification After Restore

\`\`\`bash
ssh root@$SERVER_HOST "docker ps"
ssh root@$SERVER_HOST "curl -s http://localhost:3336/api/stats"
\`\`\`

EOF

# Create quick restore script
cat > "$BACKUP_DIR/quick_restore_$TIMESTAMP.sh" << EOF
#!/bin/bash
#
# Quick ZION Restore Script
#

set -e

echo "🔄 Restoring ZION Stack from $BACKUP_NAME"
echo "=========================================="

SERVER_HOST="$SERVER_HOST"
SERVER_USER="$SERVER_USER"
BACKUP_FILE="$BACKUP_DIR/$BACKUP_NAME"

read -p "⚠️  This will overwrite /root on \$SERVER_HOST. Continue? (y/N): " -n 1 -r
echo
if [[ ! \$REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Restore cancelled"
    exit 1
fi

echo "📤 Uploading backup..."
scp "\$BACKUP_FILE" "\$SERVER_USER@\$SERVER_HOST:/tmp/"

echo "🗂️  Extracting on server..."
ssh "\$SERVER_USER@\$SERVER_HOST" "cd /root && tar -xzf /tmp/$BACKUP_NAME && rm /tmp/$BACKUP_NAME"

echo "🐳 Starting Docker services..."
ssh "\$SERVER_USER@\$SERVER_HOST" "cd /root/Zion-TestNet-2.7.5 && docker-compose down || true"
sleep 2
ssh "\$SERVER_USER@\$SERVER_HOST" "cd /root/Zion-TestNet-2.7.5 && docker-compose up -d"

echo ""
echo "✅ Restore completed!"
echo "🧪 Testing services..."
ssh "\$SERVER_USER@\$SERVER_HOST" "docker ps"
EOF

chmod +x "$BACKUP_DIR/quick_restore_$TIMESTAMP.sh"

echo ""
echo "✅ Backup completed successfully!"
echo ""
echo "📊 Backup Summary:"
echo "  📄 Main backup: $BACKUP_DIR/$BACKUP_NAME ($(du -h "$BACKUP_DIR/$BACKUP_NAME" | cut -f1))"
echo "  🐳 Docker info: $BACKUP_DIR/docker_info_$TIMESTAMP.txt"
echo "  📖 Instructions: $BACKUP_DIR/restore_instructions_$TIMESTAMP.md"
echo "  🔄 Quick restore: $BACKUP_DIR/quick_restore_$TIMESTAMP.sh"
echo ""
echo "💡 To restore backup:"
echo "  bash $BACKUP_DIR/quick_restore_$TIMESTAMP.sh"
echo ""
echo "🎉 SSH stack safely backed up! Now you can proceed with cleanup."