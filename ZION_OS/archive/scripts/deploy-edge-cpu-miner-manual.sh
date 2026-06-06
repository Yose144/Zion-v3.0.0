#!/bin/bash
# Manual deployment script for Edge CPU miner
# Run this ON THE EDGE SERVER (77.42.71.94)

set -euo pipefail

echo "═══ Edge CPU Miner Deployment (Manual) ═══"
echo ""

# Step 1: Build miner
echo "[1/3] Building zion-miner..."
cd /root/zion-2.9.6-main/V3
cargo build --manifest-path Cargo.toml -p zion-miner --release
echo "✓ Build complete"
echo ""

# Step 2: Create service file (if not exists)
echo "[2/3] Installing systemd service..."
cat > /tmp/edge-cpu-miner.service << 'EOF'
[Unit]
Description=ZION V3 CPU Miner (Edge Server)
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/zion-2.9.6-main/V3
Environment="RUST_LOG=info"
Environment="ZION_POOL_ADDR=127.0.0.1:8444"
Environment="ZION_MINER_ID=zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3"
Environment="ZION_WORKER_NAME=edge-cpu-miner"
Environment="ZION_MINER_THREADS=2"
Environment="ZION_LOOP_COUNT=1000000"
Environment="ZION_GPU_BACKEND=cpu"
ExecStart=/root/zion-2.9.6-main/V3/target/release/zion-miner
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo mv /tmp/edge-cpu-miner.service /etc/systemd/system/
echo "✓ Service file installed"
echo ""

# Step 3: Enable and start
echo "[3/3] Enabling and starting service..."
sudo systemctl daemon-reload
sudo systemctl enable edge-cpu-miner.service
sudo systemctl restart edge-cpu-miner.service
echo "✓ Service started"
echo ""

echo "═══ Deployment Complete ═══"
echo "Check status: sudo systemctl status edge-cpu-miner.service"
echo "View logs: sudo journalctl -u edge-cpu-miner.service -f"
