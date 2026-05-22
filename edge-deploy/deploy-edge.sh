#!/bin/bash
# ZION Edge Server Deployment Script
# Updated: 2026-05-22 - Genesis and fee split update

set -e

echo "=== ZION Edge Server Deployment ==="
echo "Date: $(date)"
echo ""

# Variables
EDGE_USER="root"
EDGE_HOST="77.42.71.94"
SSH_KEY="../ssh-key-zion-edge"
REMOTE_V3_PATH="/root/V3"
REMOTE_DATA_PATH="/root/zion-2.9.6-main/data"
BACKUP_PATH="/root/zion-backup-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Stopping Edge services${NC}"
ssh -i $SSH_KEY ${EDGE_USER}@${EDGE_HOST} "systemctl stop zion-edge zion-edge-pool || true"

echo -e "${YELLOW}Step 2: Backing up current installation${NC}"
ssh -i $SSH_KEY ${EDGE_USER}@${EDGE_HOST} "mkdir -p $BACKUP_PATH && cp -r $REMOTE_V3_PATH $BACKUP_PATH/ || true"

echo -e "${YELLOW}Step 3: Uploading updated genesis.rs${NC}"
scp -i $SSH_KEY ../V3/L1/core/src/genesis.rs ${EDGE_USER}@${EDGE_HOST}:${REMOTE_V3_PATH}/L1/core/src/genesis.rs

echo -e "${YELLOW}Step 4: Uploading updated configuration${NC}"
scp -i $SSH_KEY config/edge-environment.sh ${EDGE_USER}@${EDGE_HOST}:/root/zion-2.9.6-main/edge-environment.sh

echo -e "${YELLOW}Step 5: Cleaning data directories${NC}"
ssh -i $SSH_KEY ${EDGE_USER}@${EDGE_HOST} "rm -f $REMOTE_DATA_PATH/edge-state.db $REMOTE_DATA_PATH/edge-state.db-lock || true"

echo -e "${YELLOW}Step 6: Rebuilding on Edge server${NC}"
ssh -i $SSH_KEY ${EDGE_USER}@${EDGE_HOST} "cd $REMOTE_V3_PATH && ~/.cargo/bin/cargo build --release --bin node --bin server"

echo -e "${YELLOW}Step 7: Updating systemd services with new environment${NC}"
ssh -i $SSH_KEY ${EDGE_USER}@${EDGE_HOST} "cat > /etc/systemd/system/zion-edge.service << 'EOF'
[Unit]
Description=ZION Edge Node
After=network.target tailscaled.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/zion-2.9.6-main
EnvironmentFile=/root/zion-2.9.6-main/edge-environment.sh
ExecStart=/root/V3/target/release/node
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF"

ssh -i $SSH_KEY ${EDGE_USER}@${EDGE_HOST} "cat > /etc/systemd/system/zion-edge-pool.service << 'EOF'
[Unit]
Description=ZION Edge Pool
After=network.target tailscaled.service zion-edge.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/zion-2.9.6-main
EnvironmentFile=/root/zion-2.9.6-main/edge-environment.sh
ExecStart=/root/V3/target/release/server
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF"

echo -e "${YELLOW}Step 8: Reloading systemd daemon${NC}"
ssh -i $SSH_KEY ${EDGE_USER}@${EDGE_HOST} "systemctl daemon-reload"

echo -e "${YELLOW}Step 9: Starting Edge services${NC}"
ssh -i $SSH_KEY ${EDGE_USER}@${EDGE_HOST} "systemctl start zion-edge zion-edge-pool"

echo -e "${YELLOW}Step 10: Waiting for services to start${NC}"
sleep 15

echo -e "${YELLOW}Step 11: Checking service status${NC}"
ssh -i $SSH_KEY ${EDGE_USER}@${EDGE_HOST} "systemctl status zion-edge --no-pager"
ssh -i $SSH_KEY ${EDGE_USER}@${EDGE_HOST} "systemctl status zion-edge-pool --no-pager"

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo "Backup location: $BACKUP_PATH"
echo "Please check logs: journalctl -u zion-edge -f"