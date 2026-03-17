#!/bin/bash
# Deploy Tier 1+2 ASIC resistance changes to testnet canary (91.98.122.165)
# Uses docker-compose.testnet.yml which passes --features testnet to builds.
# NPU_EPOCH_LENGTH = 100 blocks (rapid epoch rotation for testing).
set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/zion_hetzner_key}"
DEPLOY_USER="${DEPLOY_USER:-root}"
PRIMARY_HOST="91.98.122.165"
DEPLOY_DIR="/root/zion-2.9.6"
COMPOSE_FILE="docker/docker-compose.testnet.yml"

ssh_run() {
    ssh -F /dev/null -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=20 \
        -o StrictHostKeyChecking=accept-new \
        "$DEPLOY_USER@$PRIMARY_HOST" "$1"
}

LOCAL_SRC="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Tier 2 Canary Deploy ==="
echo "Host:     $PRIMARY_HOST"
echo "Features: testnet (NPU_EPOCH_LENGTH=100)"
echo "Compose:  $COMPOSE_FILE"
echo ""

# 1. Sync workspace
echo "[1/5] Syncing workspace to $PRIMARY_HOST..."
rsync -az --delete \
    --exclude 'target/' \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude 'Zion-2.9.5-main/' \
    --chmod=Du=rwx,Fu=rw \
    -e "ssh -F /dev/null -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
    "$LOCAL_SRC/" "$DEPLOY_USER@$PRIMARY_HOST:$DEPLOY_DIR/"

# 2. Stop existing stack
echo "[2/5] Stopping existing testnet stack..."
ssh_run "cd $DEPLOY_DIR && docker compose -f $COMPOSE_FILE down --remove-orphans 2>/dev/null || true"

# 3. Build with testnet feature
echo "[3/5] Building images with testnet feature..."
ssh_run "cd $DEPLOY_DIR && docker compose -f $COMPOSE_FILE build --no-cache core pool miner"

# 4. Start stack
echo "[4/5] Starting canary stack..."
ssh_run "cd $DEPLOY_DIR && docker compose -f $COMPOSE_FILE up -d"

# 5. Verify
echo "[5/5] Stack status:"
ssh_run "cd $DEPLOY_DIR && docker compose -f $COMPOSE_FILE ps"
echo ""
echo "=== Deploy complete ==="
echo ""
echo "Monitor commands:"
echo "  ssh -i $SSH_KEY $DEPLOY_USER@$PRIMARY_HOST"
echo "  docker logs -f zion-miner"
echo "  docker logs -f zion-pool | grep -E 'accept|reject|epoch'"
echo ""
echo "Acceptance criteria:"
echo "  - Share accept rate >= 99.5%"
echo "  - 0 rejected shares at epoch boundary (every 100 blocks)"
echo "  - Hashrate variance <= 10% over 24h"
