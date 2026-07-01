#!/bin/bash
# Fire Algorithm Hard Fork Deployment Script for Edge Server
# Run this on the Edge server (77.42.71.94) via SSH or console

set -e

echo "============================================================"
echo "  Fire Algorithm Hard Fork Deployment"
echo "  Target: Edge Server (77.42.71.94)"
echo "  Fork Height: Block 5000"
echo "============================================================"
echo ""

cd /root/zion-2.9.6-main

echo "Step 1: Pull latest changes from GitHub..."
git pull origin main

echo ""
echo "Step 2: Build V3 workspace with Fire fork changes..."
cargo build --release --manifest-path V3/Cargo.toml --workspace

echo ""
echo "Step 3: Stop ZION services..."
systemctl stop zion-node
systemctl stop zion-pool

echo ""
echo "Step 4: Start ZION services with new Fire fork code..."
systemctl start zion-node
systemctl start zion-pool

echo ""
echo "Step 5: Verify Fire fork is active..."
sleep 5
curl -s -X POST http://127.0.0.1:8443/jsonrpc -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}'

echo ""
echo "============================================================"
echo "  Deployment Complete!"
echo "  Fire algorithm will activate at block 5000"
echo "  Current chain height: $(curl -s -X POST http://127.0.0.1:8443/jsonrpc -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' | jq -r '.result.chain_height')"
echo "  Blocks until Fire fork: $((5000 - $(curl -s -X POST http://127.0.0.1:8443/jsonrpc -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' | jq -r '.result.chain_height')))"
echo "============================================================"
