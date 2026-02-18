#!/bin/bash
# Deploy Dual Port ZION Core + Pool v2.9 to Production Server
# Server: 91.98.122.165

set -e

SERVER="root@91.98.122.165"
SERVER_PATH="/opt/zion/Zion-2.9"
SSH_KEY="~/.ssh/id_ed25519_hetzner"

echo "🚀 Deploying ZION Dual Port Core + Pool v2.9"
echo "=============================================="
echo "Server: $SERVER"
echo "Path: $SERVER_PATH"
echo ""

# 1. Upload změněné soubory
echo "📤 Uploading modified files..."

# Upload Core soubory (dual port RPC)
echo "   • Uploading ZION Core files..."
rsync -avz -e "ssh -i $SSH_KEY" \
    src/core/zion_rpc_server.py \
    src/core/seednodes.py \
    src/core/new_zion_blockchain.py \
    $SERVER:$SERVER_PATH/src/core/

# Upload Pool v2.9
echo "   • Uploading Pool v2.9..."
rsync -avz -e "ssh -i $SSH_KEY" \
    src/pool/ \
    $SERVER:$SERVER_PATH/src/pool/

# Upload configs
echo "   • Uploading configs..."
rsync -avz -e "ssh -i $SSH_KEY" \
    config/pool_production.json \
    $SERVER:$SERVER_PATH/config/

# Upload pool starter
rsync -avz -e "ssh -i $SSH_KEY" \
    start_pool.py \
    $SERVER:$SERVER_PATH/

echo "✅ Files uploaded"
echo ""

# 2. Install dependencies on server
echo "🔧 Installing dependencies on server..."
ssh -i $SSH_KEY -T $SERVER << 'ENDSSH'
cd /opt/zion/Zion-2.9

# Create venv if not exists
if [ ! -d "venv" ]; then
    echo "   Creating virtual environment..."
    python3 -m venv venv
fi

# Activate and install
source venv/bin/activate
echo "   Installing ecdsa..."
pip install --quiet ecdsa==0.19.0
echo "   Installing aiohttp..."
pip install --quiet aiohttp==3.13.2
echo "   Installing aiosqlite..."
pip install --quiet aiosqlite==0.21.0
echo "✅ Dependencies installed"
ENDSSH

echo ""

# 3. Check current processes
echo "🔍 Checking current processes..."
ssh -i $SSH_KEY -T $SERVER 'ps aux | grep -E "new_zion_blockchain|zion_universal_pool" | grep -v grep' || echo "   No old processes found"
echo ""

# 4. Restart ZION Core with dual port
echo "🔄 Restarting ZION Core with dual port..."
ssh -i $SSH_KEY -T $SERVER << 'ENDSSH'
cd /opt/zion/Zion-2.9

# Stop old blockchain (if running in Docker)
echo "   Stopping old Docker containers..."
docker stop zion-2.8.9-node 2>/dev/null || true

# Kill any standalone processes
echo "   Stopping standalone processes..."
pkill -f "new_zion_blockchain" 2>/dev/null || true
sleep 3

# Start new blockchain with dual port
echo "   Starting ZION Core with dual port (8545 + 18081)..."
source venv/bin/activate
nohup venv/bin/python -m src.core.new_zion_blockchain > logs/blockchain_dual.log 2>&1 &
BLOCKCHAIN_PID=$!
echo "   Blockchain PID: $BLOCKCHAIN_PID"

# Wait for startup
sleep 10
ENDSSH

echo ""

# 5. Verify both ports
echo "🔍 Verifying dual ports..."
ssh -i $SSH_KEY -T $SERVER << 'ENDSSH'
echo "   Checking ports..."
ss -tlnp | grep -E ":8545|:18081" || echo "   ⚠️  Ports not yet listening"

echo "   Testing port 8545..."
curl -s http://127.0.0.1:8545 -d '{"method":"getblockcount"}' -H "Content-Type: application/json" | grep -q "result" && echo "   ✅ Port 8545 OK" || echo "   ❌ Port 8545 failed"

echo "   Testing port 18081..."
curl -s http://127.0.0.1:18081/json_rpc -d '{"method":"getblockcount"}' -H "Content-Type: application/json" | grep -q "result" && echo "   ✅ Port 18081 OK" || echo "   ❌ Port 18081 failed"
ENDSSH

echo ""

# 6. Stop old pool
echo "🛑 Stopping old pool v2.8..."
ssh -i $SSH_KEY -T $SERVER 'pkill -f "zion_universal_pool_v2" 2>/dev/null || true'
sleep 2
echo ""

# 7. Start Pool v2.9
echo "🏊 Starting Pool v2.9..."
ssh -i $SSH_KEY -T $SERVER << 'ENDSSH'
cd /opt/zion/Zion-2.9

source venv/bin/activate
nohup venv/bin/python start_pool.py config/pool_production.json > logs/pool_v2.9.log 2>&1 &
POOL_PID=$!
echo "   Pool PID: $POOL_PID"

# Wait for startup
sleep 8
ENDSSH

echo ""

# 8. Check status
echo "📊 Deployment Status:"
ssh -i $SSH_KEY -T $SERVER << 'ENDSSH'
echo ""
echo "=== Running Processes ==="
ps aux | grep -E "new_zion_blockchain|start_pool" | grep -v grep

echo ""
echo "=== Listening Ports ==="
ss -tlnp | grep -E ":8545|:18081|:3333"

echo ""
echo "=== Recent Pool Log (last 20 lines) ==="
tail -20 /opt/zion/Zion-2.9/logs/pool_v2.9.log

echo ""
echo "=== Recent Blockchain Log (last 10 lines) ==="
tail -10 /opt/zion/Zion-2.9/logs/blockchain_dual.log
ENDSSH

echo ""
echo "=============================================="
echo "✅ Deployment Complete!"
echo ""
echo "🌐 Services:"
echo "   • ZION Core RPC (Ethereum): http://91.98.122.165:8545"
echo "   • ZION Core RPC (Monero):   http://91.98.122.165:18081"
echo "   • Pool v2.9 Stratum:        stratum+tcp://91.98.122.165:3333"
echo ""
echo "📝 To monitor:"
echo "   ssh -i $SSH_KEY $SERVER 'tail -f /opt/zion/Zion-2.9/logs/pool_v2.9.log'"
echo "   ssh -i $SSH_KEY $SERVER 'tail -f /opt/zion/Zion-2.9/logs/blockchain_dual.log'"
echo ""
