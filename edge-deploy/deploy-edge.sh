#!/usr/bin/env bash
# ZION Edge Server Deployment Script
# Pushes latest code to Edge (Hetzner) and restarts the primary node + pool.
#
# Run from any machine with SSH access to Edge:
#   bash edge-deploy/deploy-edge.sh
#
# Prerequisites:
#   - Edge server reachable via SSH (77.42.71.94 or Tailscale 100.76.16.108)
#   - SSH key at ../ssh-key-zion-edge (or use SSH agent)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EDGE_USER="root"
EDGE_HOST="77.42.71.94"
SSH_KEY="${REPO_ROOT}/ssh-key-zion-edge"
REMOTE_ROOT="/root/zion-2.9.6-main"
BACKUP_PATH="/root/zion-backup-$(date +%Y%m%d-%H%M%S)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Use Tailscale as fallback if available
if command -v tailscale &>/dev/null && tailscale ping 100.76.16.108 &>/dev/null; then
    EDGE_HOST="100.76.16.108"
    echo -e "${GREEN}[deploy] Using Tailscale VPN: ${EDGE_HOST}${NC}"
else
    echo -e "${GREEN}[deploy] Using public IP: ${EDGE_HOST}${NC}"
fi

SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

# ── Step 0: Verify SSH ──
echo -e "${YELLOW}[deploy] Verifying SSH access to Edge...${NC}"
if ! ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "echo 'SSH OK'" &>/dev/null; then
    echo -e "${RED}[ERROR] Cannot SSH to Edge. Check key and VPN.${NC}"
    exit 1
fi

# ── Step 1: Stop services ──
echo -e "${YELLOW}[deploy] Stopping Edge services...${NC}"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl stop zion-edge-pool zion-edge-node || true"

# ── Step 2: Backup current installation ──
echo -e "${YELLOW}[deploy] Backing up current installation to ${BACKUP_PATH}...${NC}"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "mkdir -p ${BACKUP_PATH} && cp -r ${REMOTE_ROOT} ${BACKUP_PATH}/ || true"

# ── Step 3: Sync code via rsync (faster than scp for many files) ──
if command -v rsync &>/dev/null; then
    echo -e "${YELLOW}[deploy] Syncing code via rsync...${NC}"
    rsync -avz --exclude='target' --exclude='.git' --exclude='data' --exclude='logs' \
        -e "ssh ${SSH_OPTS}" \
        "${REPO_ROOT}/" \
        "${EDGE_USER}@${EDGE_HOST}:${REMOTE_ROOT}/"
else
    echo -e "${YELLOW}[deploy] Syncing critical files via scp...${NC}"
    scp ${SSH_OPTS} -r \
        "${REPO_ROOT}/V3/L1/core/src/genesis.rs" \
        "${REPO_ROOT}/V3/L1/pool/src/" \
        "${REPO_ROOT}/V3/L1/core/src/emission.rs" \
        "${REPO_ROOT}/V3/L1/core/src/lib.rs" \
        "${REPO_ROOT}/edge-deploy/" \
        "${EDGE_USER}@${EDGE_HOST}:${REMOTE_ROOT}/"
fi

# ── Step 4: Upload environment config ──
echo -e "${YELLOW}[deploy] Uploading environment config...${NC}"
scp ${SSH_OPTS} "${REPO_ROOT}/edge-deploy/config/edge-environment.sh" \
    "${EDGE_USER}@${EDGE_HOST}:${REMOTE_ROOT}/edge-environment.sh"

# ── Step 5: Clean data (ONLY for genesis resets — comment out for normal deploy) ──
# echo -e "${YELLOW}[deploy] Cleaning data for genesis reset...${NC}"
# ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "rm -f ${REMOTE_ROOT}/data/edge-state.db* || true"

# ── Step 6: Rebuild on Edge server ──
echo -e "${YELLOW}[deploy] Rebuilding binaries on Edge...${NC}"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "cd ${REMOTE_ROOT}/V3 && ~/.cargo/bin/cargo build --release --bin node --bin server"

# ── Step 7: Install systemd services ──
echo -e "${YELLOW}[deploy] Installing systemd services...${NC}"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "cp ${REMOTE_ROOT}/edge-deploy/systemd/zion-edge-node.service /etc/systemd/system/"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "cp ${REMOTE_ROOT}/edge-deploy/systemd/zion-edge-pool.service /etc/systemd/system/"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "cp ${REMOTE_ROOT}/edge-deploy/systemd/zion-edge-watchdog.service /etc/systemd/system/"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "cp ${REMOTE_ROOT}/edge-deploy/systemd/zion-edge-watchdog.timer /etc/systemd/system/"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl daemon-reload"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl enable zion-edge-node zion-edge-pool zion-edge-watchdog.timer || true"

# ── Step 8: Start services ──
echo -e "${YELLOW}[deploy] Starting Edge services...${NC}"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl start zion-edge-node"
sleep 5
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl start zion-edge-pool"

# ── Step 9: Wait and verify ──
echo -e "${YELLOW}[deploy] Waiting for services to come up...${NC}"
sleep 15

NODE_STATUS=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl is-active zion-edge-node" || true)
POOL_STATUS=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl is-active zion-edge-pool" || true)

echo ""
echo "=== Deployment Status ==="
if [[ "$NODE_STATUS" == "active" ]]; then
    echo -e "${GREEN}  zion-edge-node : ACTIVE${NC}"
else
    echo -e "${RED}  zion-edge-node : $NODE_STATUS${NC}"
fi
if [[ "$POOL_STATUS" == "active" ]]; then
    echo -e "${GREEN}  zion-edge-pool : ACTIVE${NC}"
else
    echo -e "${RED}  zion-edge-pool : $POOL_STATUS${NC}"
fi

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo "Backup: ${BACKUP_PATH}"
echo ""
echo "Quick checks:"
echo "  ssh -i ${SSH_KEY} ${EDGE_USER}@${EDGE_HOST} 'journalctl -u zion-edge-node -n 20 --no-pager'"
echo "  ssh -i ${SSH_KEY} ${EDGE_USER}@${EDGE_HOST} 'journalctl -u zion-edge-pool -n 20 --no-pager'"
echo "  ssh -i ${SSH_KEY} ${EDGE_USER}@${EDGE_HOST} 'curl -s http://127.0.0.1:8443/health'"
echo ""
echo "Pool endpoint: ${EDGE_HOST}:8444 (miners connect here)"
