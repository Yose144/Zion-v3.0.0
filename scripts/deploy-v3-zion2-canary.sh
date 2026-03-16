#!/bin/bash
set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/zion_hetzner_key}"
DEPLOY_USER="${DEPLOY_USER:-root}"
PRIMARY_HOST="91.98.122.165"
DEPLOY_DIR="/root/zion-2.9.6"
LOCAL_SRC="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="V3/docker/docker-compose.v3-zion2-canary.yml"

ssh_run() {
    ssh -F /dev/null -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new "$DEPLOY_USER@$PRIMARY_HOST" "$1"
}

echo "[v3-canary] syncing workspace to $PRIMARY_HOST"
rsync -az --delete \
    --exclude 'target/' \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude 'Zion-2.9.5-main/' \
    --chmod=Du=rwx,Fu=rw \
    -e "ssh -F /dev/null -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
    "$LOCAL_SRC/" "$DEPLOY_USER@$PRIMARY_HOST:$DEPLOY_DIR/"

echo "[v3-canary] building V3 images"
ssh_run "cd $DEPLOY_DIR/V3 && docker compose -f docker/docker-compose.v3-zion2-canary.yml build"

echo "[v3-canary] starting canary stack"
ssh_run "cd $DEPLOY_DIR/V3 && docker compose -f docker/docker-compose.v3-zion2-canary.yml up -d"

echo "[v3-canary] status"
ssh_run "cd $DEPLOY_DIR/V3 && docker compose -f docker/docker-compose.v3-zion2-canary.yml ps"