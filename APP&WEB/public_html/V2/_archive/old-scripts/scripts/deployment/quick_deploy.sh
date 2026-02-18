#!/bin/bash
# Quick Deploy - Direct Commands
set -e

SERVER="root@91.98.122.165"
SSH="ssh -i ~/.ssh/id_ed25519_hetzner"

echo "🚀 Quick Deploy - Dual Port + Pool v2.9"
echo ""

# Install ecdsa on server
echo "1. Installing ecdsa on server..."
$SSH $SERVER "cd /opt/zion/Zion-2.9 && venv/bin/pip install -q ecdsa==0.19.0 2>&1 | tail -1"
echo "✅ ecdsa installed"

# Stop old processes
echo "2. Stopping old processes..."
$SSH $SERVER "docker stop zion-2.8.9-node 2>/dev/null || true"
$SSH $SERVER "pkill -f 'new_zion_blockchain' || true"
$SSH $SERVER "pkill -f 'zion_universal_pool' || true"
sleep 3
echo "✅ Old processes stopped"

# Start blockchain
echo "3. Starting ZION Core (dual port)..."
$SSH $SERVER "cd /opt/zion/Zion-2.9 && nohup venv/bin/python -m src.core.new_zion_blockchain > logs/blockchain_dual.log 2>&1 &"
sleep 12
echo "✅ Blockchain started"

# Check ports
echo "4. Checking ports..."
$SSH $SERVER "ss -tlnp | grep ':8545\|:18081'" || echo "⚠️  Waiting for ports..."
echo ""

# Test RPC
echo "5. Testing RPC..."
$SSH $SERVER "curl -s http://127.0.0.1:18081/json_rpc -d '{\"method\":\"getblockcount\"}' -H 'Content-Type: application/json' | grep -q result && echo '✅ Port 18081 OK' || echo '❌ Port 18081 failed'"
$SSH $SERVER "curl -s http://127.0.0.1:8545 -d '{\"method\":\"getblockcount\"}' -H 'Content-Type: application/json' | grep -q result && echo '✅ Port 8545 OK' || echo '❌ Port 8545 failed'"
echo ""

# Start pool
echo "6. Starting Pool v2.9..."
$SSH $SERVER "cd /opt/zion/Zion-2.9 && nohup venv/bin/python start_pool.py config/pool_production.json > logs/pool_v2.9.log 2>&1 &"
sleep 10
echo "✅ Pool started"

# Final status
echo ""
echo "=============================================="
echo "📊 Final Status:"
echo ""
$SSH $SERVER "ps aux | grep -E 'new_zion_blockchain|start_pool' | grep -v grep"
echo ""
echo "📝 Recent Pool Log:"
$SSH $SERVER "tail -15 /opt/zion/Zion-2.9/logs/pool_v2.9.log"
echo ""
echo "=============================================="
echo "✅ Deployment Complete!"
echo "   Pool: stratum+tcp://91.98.122.165:3333"
echo "   RPC: http://91.98.122.165:18081"
