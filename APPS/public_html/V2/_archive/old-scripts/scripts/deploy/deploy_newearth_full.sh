#!/bin/bash

# =============================================================================
# ZION NEW EARTH Full Deployment Script
# =============================================================================
# Deploys complete public_html directory to newearth.cz server
# Includes: Stargate index + V2 application + all assets
# =============================================================================

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Server configuration
SSH_HOST="dw214.webglobe.com"
SSH_PORT="20002"
SSH_USER="ssh-685961"
REMOTE_PATH="/home/html/newearth.cz/public_html"
BACKUP_PATH="/home/html/newearth.cz/backup"

# Local paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOCAL_PUBLIC_HTML="$PROJECT_ROOT/public_html"

# Timestamp for backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="public_html_backup_$TIMESTAMP.tar.gz"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ZION NEW EARTH - Full Deployment Script                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Validation
echo -e "${YELLOW}[1/6] Validating local files...${NC}"
if [ ! -d "$LOCAL_PUBLIC_HTML" ]; then
    echo -e "${RED}✗ Error: public_html directory not found at $LOCAL_PUBLIC_HTML${NC}"
    exit 1
fi

if [ ! -f "$LOCAL_PUBLIC_HTML/index.html" ]; then
    echo -e "${RED}✗ Error: Main index.html not found${NC}"
    exit 1
fi

if [ ! -f "$LOCAL_PUBLIC_HTML/V2/main.html" ]; then
    echo -e "${RED}✗ Error: V2 application not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Local files validated${NC}"
echo -e "  - Main index: index.html (Stargate)"
echo -e "  - V2 app: V2/main.html"
echo -e "  - Assets: assets/, images/, shop/"
echo ""

# Test SSH connection
echo -e "${YELLOW}[2/6] Testing SSH connection...${NC}"
if ssh -p $SSH_PORT $SSH_USER@$SSH_HOST "echo 'Connected successfully'" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ SSH connection successful${NC}"
else
    echo -e "${RED}✗ SSH connection failed${NC}"
    echo -e "${YELLOW}Run: ssh-copy-id -p $SSH_PORT $SSH_USER@$SSH_HOST${NC}"
    exit 1
fi
echo ""

# Create remote backup
echo -e "${YELLOW}[3/6] Creating server backup...${NC}"
ssh -p $SSH_PORT $SSH_USER@$SSH_HOST "mkdir -p $BACKUP_PATH"

BACKUP_EXISTS=$(ssh -p $SSH_PORT $SSH_USER@$SSH_HOST "[ -d '$REMOTE_PATH' ] && echo 'yes' || echo 'no'")

if [ "$BACKUP_EXISTS" = "yes" ]; then
    echo -e "${BLUE}Creating backup: $BACKUP_NAME${NC}"
    ssh -p $SSH_PORT $SSH_USER@$SSH_HOST "cd /home/html/newearth.cz && tar -czf $BACKUP_PATH/$BACKUP_NAME public_html/ 2>/dev/null || echo 'Backup created with warnings'"
    echo -e "${GREEN}✓ Backup created: $BACKUP_PATH/$BACKUP_NAME${NC}"
else
    echo -e "${YELLOW}⚠ No existing public_html found (first deploy)${NC}"
fi
echo ""

# Deploy files
echo -e "${YELLOW}[4/6] Deploying files to server...${NC}"
echo -e "${BLUE}This may take a few minutes for large files...${NC}"

# Create target directory structure
ssh -p $SSH_PORT $SSH_USER@$SSH_HOST "mkdir -p $REMOTE_PATH"

# Deploy using rsync for efficient transfer
rsync -avz --progress \
    -e "ssh -p $SSH_PORT" \
    --exclude='.DS_Store' \
    --exclude='*.md' \
    --exclude='ftp.md' \
    --exclude='.git*' \
    --exclude='node_modules' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.env*' \
    --exclude='ai.key' \
    --exclude='git.key' \
    "$LOCAL_PUBLIC_HTML/" \
    "$SSH_USER@$SSH_HOST:$REMOTE_PATH/"

echo -e "${GREEN}✓ Files deployed successfully${NC}"
echo ""

# Set permissions
echo -e "${YELLOW}[5/6] Setting file permissions...${NC}"
ssh -p $SSH_PORT $SSH_USER@$SSH_HOST << 'ENDSSH'
    # Set directory permissions
    find /home/html/newearth.cz/public_html -type d -exec chmod 755 {} \;
    
    # Set file permissions
    find /home/html/newearth.cz/public_html -type f -exec chmod 644 {} \;
    
    # Make PHP files executable
    find /home/html/newearth.cz/public_html -name "*.php" -exec chmod 755 {} \;
    
    # Secure sensitive directories
    if [ -d /home/html/newearth.cz/public_html/V2/api ]; then
        chmod 700 /home/html/newearth.cz/public_html/V2/api/*.php 2>/dev/null || true
    fi
    
    if [ -d /home/html/newearth.cz/public_html/V2/wallets ]; then
        chmod 700 /home/html/newearth.cz/public_html/V2/wallets
    fi
    
    if [ -d /home/html/newearth.cz/public_html/V2/orders ]; then
        chmod 700 /home/html/newearth.cz/public_html/V2/orders
    fi
    
    if [ -d /home/html/newearth.cz/public_html/V2/invoices ]; then
        chmod 700 /home/html/newearth.cz/public_html/V2/invoices
    fi
ENDSSH

echo -e "${GREEN}✓ Permissions set${NC}"
echo ""

# Verify deployment
echo -e "${YELLOW}[6/6] Verifying deployment...${NC}"
REMOTE_INDEX=$(ssh -p $SSH_PORT $SSH_USER@$SSH_HOST "[ -f '$REMOTE_PATH/index.html' ] && echo 'yes' || echo 'no'")
REMOTE_V2=$(ssh -p $SSH_PORT $SSH_USER@$SSH_HOST "[ -f '$REMOTE_PATH/V2/main.html' ] && echo 'yes' || echo 'no'")
REMOTE_API=$(ssh -p $SSH_PORT $SSH_USER@$SSH_HOST "[ -d '$REMOTE_PATH/V2/api' ] && echo 'yes' || echo 'no'")

echo -e "${BLUE}Deployment verification:${NC}"
if [ "$REMOTE_INDEX" = "yes" ]; then
    echo -e "${GREEN}✓ Main index.html deployed${NC}"
else
    echo -e "${RED}✗ Main index.html missing${NC}"
fi

if [ "$REMOTE_V2" = "yes" ]; then
    echo -e "${GREEN}✓ V2 application deployed${NC}"
else
    echo -e "${RED}✗ V2 application missing${NC}"
fi

if [ "$REMOTE_API" = "yes" ]; then
    echo -e "${GREEN}✓ API directory deployed${NC}"
else
    echo -e "${YELLOW}⚠ API directory missing${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Deployment completed successfully!                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Deployed to:${NC} https://newearth.cz"
echo -e "${BLUE}Backup saved:${NC} $BACKUP_PATH/$BACKUP_NAME"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Test main page: https://newearth.cz"
echo -e "  2. Test V2 app: https://newearth.cz/V2/"
echo -e "  3. Check API config: V2/api/config.php"
echo -e "  4. Verify database connection"
echo -e "  5. Test Stripe integration"
echo ""
echo -e "${BLUE}To rollback:${NC}"
echo -e "  ssh -p $SSH_PORT $SSH_USER@$SSH_HOST"
echo -e "  cd /home/html/newearth.cz"
echo -e "  rm -rf public_html"
echo -e "  tar -xzf $BACKUP_PATH/$BACKUP_NAME"
echo ""
