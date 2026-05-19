#!/bin/bash
set -euo pipefail

# Hiran v2.3 Vast.ai Sync Script
# Syncs local HiranV2.3 to remote Vast.ai instance

VAST_IP="${VAST_IP:-}"
VAST_PORT="${VAST_PORT:-32264}"
VAST_USER="${VAST_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/vast_hiran_key}"

if [ -z "$VAST_IP" ]; then
    echo "ERROR: Set VAST_IP environment variable"
    echo "Usage: VAST_IP=213.181.123.6 ./scripts/sync_to_vast.sh"
    exit 1
fi

SSH_OPTS="-i $SSH_KEY -p $VAST_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
REMOTE_DIR="/workspace/hiran-v2.3"

echo "Syncing Hiran v2.3 to Vast.ai instance..."
echo "  Target: $VAST_USER@$VAST_IP:$VAST_PORT"
echo ""

# Create remote directory
echo "Creating remote workspace..."
ssh $SSH_OPTS $VAST_USER@$VAST_IP "mkdir -p $REMOTE_DIR && df -h /workspace"

# Sync code and data
echo ""
echo "Syncing training pipeline..."
rsync -avz --progress \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='checkpoints' \
    --exclude='logs' \
    --exclude='tensorboard' \
    --exclude='models' \
    -e "ssh $SSH_OPTS" \
    ./ "$VAST_USER@$VAST_IP:$REMOTE_DIR/"

echo ""
echo "Sync complete!"
echo ""
echo "To start training, SSH into the instance and run:"
echo "  ssh $SSH_OPTS $VAST_USER@$VAST_IP"
echo "  cd $REMOTE_DIR"
echo "  bash scripts/run_training.sh"
