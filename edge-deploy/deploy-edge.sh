#!/usr/bin/env bash
# ZION Edge Server — Full Stack Deployment
# Pushes latest code to Edge (Hetzner) and restarts all services.
#
# Run from any machine with SSH access to Edge:
#   bash edge-deploy/deploy-edge.sh
#
# Prerequisites:
#   - Edge server reachable via SSH (62.171.141.136)
#   - SSH key at ../ssh-key-zion-edge
#
# Deploys:
#   - 2 P2P nodes (primary + follower)
#   - Primary mining pool
#   - L2/L3 services (DAO, WARP)
#   - Next.js website (PM2)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EDGE_USER="root"
EDGE_HOST="62.171.141.136"
SSH_KEY="${REPO_ROOT}/ssh-key-zion-edge"
REMOTE_ROOT="/root/zion-2.9.6-main"
REMOTE_WEB="/root/APP\&WEB/website-v2.9"
BACKUP_PATH="/root/zion-backup-$(date +%Y%m%d-%H%M%S)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
info() { echo -e "${CYAN}[info]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[err]${NC} $*"; exit 1; }

SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

# ── Step 0: Verify SSH ──
log "Verifying SSH access to Edge..."
if ! ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "echo 'SSH OK'" &>/dev/null; then
    err "Cannot SSH to Edge. Check key at ${SSH_KEY}"
fi

# ── Step 1: Backup current installation ──
log "Backing up current installation to ${BACKUP_PATH}..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "mkdir -p ${BACKUP_PATH} && cp -r ${REMOTE_ROOT} ${BACKUP_PATH}/ 2>/dev/null || true"

# ── Step 2: Sync V3 code ──
if command -v rsync &>/dev/null; then
    log "Syncing V3 code via rsync..."
    rsync -avz --exclude='target' --exclude='.git' --exclude='data' --exclude='logs' \
        -e "ssh ${SSH_OPTS}" \
        "${REPO_ROOT}/V3/" \
        "${EDGE_USER}@${EDGE_HOST}:${REMOTE_ROOT}/V3/"
else
    log "Syncing V3 code via tar+ssh..."
    tar czf - -C "${REPO_ROOT}" V3/ 2>/dev/null | \
        ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "cd ${REMOTE_ROOT} && tar xzf -"
fi

# ── Step 3: Sync web code ──
log "Syncing website code..."
tar czf - \
    --exclude='node_modules' --exclude='.next' --exclude='out' \
    -C "${REPO_ROOT}/APP\&WEB" website-v2.9/ 2>/dev/null | \
    ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} \
    "mkdir -p /root/APP\&WEB && cd /root/APP\&WEB && tar xzf -"

# ── Step 4: Upload environment config ──
log "Uploading environment config..."
scp ${SSH_OPTS} "${REPO_ROOT}/edge-deploy/config/edge-environment.sh" \
    "${EDGE_USER}@${EDGE_HOST}:${REMOTE_ROOT}/edge-deploy/config/edge-environment.sh" 2>/dev/null || true

# ── Step 5: Rebuild V3 binaries on Edge ──
log "Rebuilding V3 binaries on Edge..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    . /root/.cargo/env
    cd ${REMOTE_ROOT}/V3
    # Fix workspace if needed
    if [ ! -d L5/free-world ]; then
        sed -i '/\"L5\/free-world\",/d;/\"L6\/issobella\",/d;/\"L4\/oasis\",/d' Cargo.toml 2>/dev/null || true
        sed -i '/\"L1\/native-ffi\",/d' Cargo.toml 2>/dev/null || true
    fi
    cargo build --release --bin node --bin server --bin zion-dao --bin zion-warp-server 2>&1
    # Build agent
    cd ${REMOTE_ROOT}/ZION_OS/agent
    cargo build --release 2>&1
    # Build dashboard
    cd ${REMOTE_ROOT}/ZION_OS/dashboard/infra
    cargo build --release 2>&1
"

# ── Step 6: Rebuild website on Edge ──
log "Rebuilding website on Edge..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    cd ${REMOTE_WEB}
    rm -f package-lock.json
    npm install 2>&1 | tail -n 5
    npm run build 2>&1 | tail -n 20
"

# ── Step 7: Install systemd services ──
log "Installing systemd services..."
SERVICES=(
    zion-edge-node1
    zion-edge-node2
    zion-edge-pool
    zion-edge-dao
    zion-edge-warp
    zion-edge-watchdog
    zion-edge-miner
    zion-edge-agent
    zion-edge-dashboard
)
for svc in "${SERVICES[@]}"; do
    if [[ "$svc" == "zion-edge-agent" ]]; then
        ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} \
            "cp ${REMOTE_ROOT}/ZION_OS/agent/systemd/${svc}.service /etc/systemd/system/ 2>/dev/null || true"
    else
        ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} \
            "cp ${REMOTE_ROOT}/edge-deploy/systemd/${svc}.service /etc/systemd/system/ 2>/dev/null || true"
    fi
done

# Cleanup old/duplicate service
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} \
    "systemctl disable zion-edge-node 2>/dev/null || true; systemctl reset-failed zion-edge-node 2>/dev/null || true"

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl daemon-reload"
for svc in "${SERVICES[@]}"; do
    ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl enable ${svc}.service 2>/dev/null || true"
done

# ── Step 8: Restart services in order ──
log "Restarting Edge services..."

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-node1"
sleep 3

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-node2"
sleep 3

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-pool"
sleep 3

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-dao zion-edge-warp || true"

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-miner || true"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-agent || true"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-dashboard || true"

# ── Step 9: Restart website (PM2) ──
log "Restarting website (PM2)..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "pm2 restart zion-website 2>/dev/null || pm2 start ${REMOTE_WEB}/node_modules/next/dist/bin/next --name zion-website -- start 2>/dev/null || true"

# ── Step 10: Wait and verify ──
log "Waiting for services to come up..."
sleep 10

echo ""
echo "=== Deployment Status ==="
for svc in zion-edge-node1 zion-edge-node2 zion-edge-pool zion-edge-dao zion-edge-warp zion-edge-miner zion-edge-agent zion-edge-dashboard; do
    STATUS=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl is-active ${svc}" 2>/dev/null || true)
    if [[ "$STATUS" == "active" ]]; then
        echo -e "${GREEN}  ${svc} : ACTIVE${NC}"
    else
        echo -e "${RED}  ${svc} : ${STATUS}${NC}"
    fi
done

WEB_STATUS=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "pm2 show zion-website 2>/dev/null | grep status" || true)
if echo "$WEB_STATUS" | grep -q "online"; then
    echo -e "${GREEN}  zion-website : ONLINE (PM2)${NC}"
else
    echo -e "${RED}  zion-website : OFFLINE${NC}"
fi

# Agent health check
AGENT_HEALTH=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "curl -s http://127.0.0.1:8767/health" 2>/dev/null || true)
if [[ "$AGENT_HEALTH" == "OK" ]]; then
    echo -e "${GREEN}  zion-agent : HEALTHY (port 8767)${NC}"
else
    echo -e "${RED}  zion-agent : NO RESPONSE${NC}"
fi

echo ""
log "=== Deployment Complete ==="
echo "Backup: ${BACKUP_PATH}"
echo ""
echo "Quick checks:"
echo "  ssh ${EDGE_USER}@${EDGE_HOST} 'curl -s http://127.0.0.1:8443/health'"
echo "  ssh ${EDGE_USER}@${EDGE_HOST} 'curl -s http://127.0.0.1:8450/health'"
echo "  ssh ${EDGE_USER}@${EDGE_HOST} 'curl -s http://127.0.0.1:8453/health'"
echo ""
echo "Pool endpoint: ${EDGE_HOST}:8444"
echo "Website:       ${EDGE_HOST}:3000"
