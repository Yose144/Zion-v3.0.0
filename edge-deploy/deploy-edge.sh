#!/usr/bin/env bash
# ZION Edge Server — Multi-Node Deployment
# Pushes latest code to Edge (Hetzner) and restarts all services.
#
# Run from any machine with SSH access to Edge:
#   bash edge-deploy/deploy-edge.sh
#
# Prerequisites:
#   - Edge server reachable via SSH (77.42.71.94 or Tailscale 100.76.16.108)
#   - SSH key at ../ssh-key-zion-edge (or use SSH agent)
#
# Deploys:
#   - 2 P2P nodes (primary + follower)
#   - Primary mining pool
#   - L2/L3 services (bridge, DAO, atomic-swap, WARP)

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

SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

# ── Step 0: Verify SSH ──
echo -e "${YELLOW}[deploy] Verifying SSH access to Edge...${NC}"
if ! ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "echo 'SSH OK'" &>/dev/null; then
    echo -e "${RED}[ERROR] Cannot SSH to Edge. Check key and VPN.${NC}"
    exit 1
fi

# ── Step 1: Stop ALL services ──
echo -e "${YELLOW}[deploy] Stopping all Edge services...${NC}"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl stop zion-edge-warp zion-edge-atomic-swap zion-edge-dao zion-edge-bridge zion-edge-pool zion-edge-node2 zion-edge-node1 zion-edge-node || true"

# ── Step 2: Backup current installation ──
echo -e "${YELLOW}[deploy] Backing up current installation to ${BACKUP_PATH}...${NC}"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "mkdir -p ${BACKUP_PATH} && cp -r ${REMOTE_ROOT} ${BACKUP_PATH}/ || true"

# ── Step 3: Sync code via rsync ──
if command -v rsync &>/dev/null; then
    echo -e "${YELLOW}[deploy] Syncing code via rsync...${NC}"
    rsync -avz --exclude='target' --exclude='.git' --exclude='data' --exclude='logs' \
        -e "ssh ${SSH_OPTS}" \
        "${REPO_ROOT}/" \
        "${EDGE_USER}@${EDGE_HOST}:${REMOTE_ROOT}/"
else
    echo -e "${YELLOW}[deploy] Syncing critical files via scp...${NC}"
    scp ${SSH_OPTS} -r \
        "${REPO_ROOT}/V3/" \
        "${REPO_ROOT}/edge-deploy/" \
        "${EDGE_USER}@${EDGE_HOST}:${REMOTE_ROOT}/"
fi

# ── Step 4: Upload environment config ──
echo -e "${YELLOW}[deploy] Uploading environment config...${NC}"
scp ${SSH_OPTS} "${REPO_ROOT}/edge-deploy/config/edge-environment.sh" \
    "${EDGE_USER}@${EDGE_HOST}:${REMOTE_ROOT}/edge-deploy/config/edge-environment.sh"

# ── Step 5: Clean data (ONLY for genesis resets — comment out for normal deploy) ──
# echo -e "${YELLOW}[deploy] Cleaning data for genesis reset...${NC}"
# ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "rm -f ${REMOTE_ROOT}/data/edge-state.db* ${REMOTE_ROOT}/data/edge2-state.db* || true"

# ── Step 6: Rebuild on Edge server ──
echo -e "${YELLOW}[deploy] Rebuilding binaries on Edge...${NC}"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "cd ${REMOTE_ROOT}/V3 && ~/.cargo/bin/cargo build --release --bin node --bin server --bin zion-bridge --bin zion-dao --bin zion-atomic-swap --bin zion-warp-server"

# ── Step 7: Install systemd services ──
echo -e "${YELLOW}[deploy] Installing systemd services...${NC}"
SERVICES=(
    zion-edge-node1
    zion-edge-node2
    zion-edge-pool
    zion-edge-bridge
    zion-edge-dao
    zion-edge-atomic-swap
    zion-edge-warp
    zion-edge-watchdog
)
for svc in "${SERVICES[@]}"; do
    ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "cp ${REMOTE_ROOT}/edge-deploy/systemd/${svc}.service /etc/systemd/system/ 2>/dev/null || true"
done
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl daemon-reload"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl disable zion-edge-node zion-edge-pool 2>/dev/null || true"
for svc in "${SERVICES[@]}"; do
    ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl enable ${svc}.service 2>/dev/null || true"
done

# ── Step 8: Start services in order ──
echo -e "${YELLOW}[deploy] Starting Edge Node 1 (Primary)...${NC}"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl start zion-edge-node1"
sleep 5

echo -e "${YELLOW}[deploy] Starting Edge Node 2 (Follower)...${NC}"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl start zion-edge-node2"
sleep 5

echo -e "${YELLOW}[deploy] Starting Edge Pool...${NC}"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl start zion-edge-pool"
sleep 5

echo -e "${YELLOW}[deploy] Starting L2/L3 services...${NC}"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl start zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp || true"

# ── Step 9: Wait and verify ──
echo -e "${YELLOW}[deploy] Waiting for services to come up...${NC}"
sleep 20

echo ""
echo "=== Deployment Status ==="
for svc in zion-edge-node1 zion-edge-node2 zion-edge-pool zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp; do
    STATUS=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl is-active ${svc}" 2>/dev/null || true)
    if [[ "$STATUS" == "active" ]]; then
        echo -e "${GREEN}  ${svc} : ACTIVE${NC}"
    else
        echo -e "${RED}  ${svc} : ${STATUS}${NC}"
    fi
done

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo "Backup: ${BACKUP_PATH}"
echo ""
echo "Quick checks:"
echo "  ssh ${EDGE_USER}@${EDGE_HOST} 'journalctl -u zion-edge-node1 -n 20 --no-pager'"
echo "  ssh ${EDGE_USER}@${EDGE_HOST} 'journalctl -u zion-edge-node2 -n 20 --no-pager'"
echo "  ssh ${EDGE_USER}@${EDGE_HOST} 'curl -s http://127.0.0.1:8443/health'"
echo ""
echo "Pool endpoint: ${EDGE_HOST}:8444 (miners connect here)"
echo "Node 1 P2P:    100.76.16.108:8333 (local backup seeds here)"
echo "Node 2 P2P:    100.76.16.108:8334"
