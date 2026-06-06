#!/usr/bin/env bash
# Deploy CPU miner on Edge server (77.42.71.94)
# This script builds and installs a lightweight CPU miner that connects to the local pool

set -euo pipefail

EDGE_HOST="root@77.42.71.94"
REPO_DIR="/root/zion-2.9.6-main"
SERVICE_FILE="edge-cpu-miner.service"

echo "═══ Deploying CPU Miner on Edge Server ═══"
echo ""

# Step 1: Build miner on Edge
echo "[1/4] Building zion-miner on Edge server..."
ssh $EDGE_HOST "cd $REPO_DIR/V3 && cargo build --manifest-path Cargo.toml -p zion-miner --release"
echo "✓ Build complete"
echo ""

# Step 2: Copy service file to Edge
echo "[2/4] Installing systemd service file..."
scp "$SERVICE_FILE" "${EDGE_HOST}:/tmp/${SERVICE_FILE}"
ssh $EDGE_HOST "sudo mv /tmp/${SERVICE_FILE} /etc/systemd/system/"
echo "✓ Service file installed"
echo ""

# Step 3: Enable and start service
echo "[3/4] Enabling and starting CPU miner service..."
ssh $EDGE_HOST "sudo systemctl daemon-reload"
ssh $EDGE_HOST "sudo systemctl enable edge-cpu-miner.service"
ssh $EDGE_HOST "sudo systemctl restart edge-cpu-miner.service"
echo "✓ Service started"
echo ""

# Step 4: Check status
echo "[4/4] Checking service status..."
ssh $EDGE_HOST "sudo systemctl status edge-cpu-miner.service --no-pager"
echo ""

echo "═══ Deployment Complete ═══"
echo "View logs: ssh $EDGE_HOST 'sudo journalctl -u edge-cpu-miner.service -f'"
echo "Stop: ssh $EDGE_HOST 'sudo systemctl stop edge-cpu-miner.service'"
echo "Restart: ssh $EDGE_HOST 'sudo systemctl restart edge-cpu-miner.service'"
