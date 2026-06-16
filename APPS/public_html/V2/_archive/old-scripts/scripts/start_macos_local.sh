#!/usr/bin/env bash
#
# ZION 2.7.5 macOS Local Stack Launcher
# Spustí blockchain node a mining pool lokálně na macOS
#

set -e

echo "🚀 ZION 2.7.5 macOS Local Stack"
echo "==============================="

# macOS konfigurace
ZION_ROOT="/Users/yeshuae/Desktop/Zion/Zion-TestNet-2.7.5-github"
VENV_PATH="/Users/yeshuae/Desktop/Zion/.venv"
LOG_DIR="/tmp/zion_local_logs"

# Porty
BLOCKCHAIN_RPC_PORT=18089
P2P_PORT=18090
MINING_POOL_PORT=3335

mkdir -p "$LOG_DIR"
cd "$ZION_ROOT"

echo "🧹 Cleaning up old processes..."
pkill -f "new_zion_blockchain" 2>/dev/null || true
pkill -f "zion_universal_pool" 2>/dev/null || true
sleep 2

echo "🐍 Activating Python environment..."
source "$VENV_PATH/bin/activate"

echo ""
echo "1️⃣  Starting Blockchain Node..."

# Start blockchain node
nohup python3 -c "
import sys
import os
sys.path.append('.')
from new_zion_blockchain import NewZionBlockchain
import time

print('🚀 Starting ZION Blockchain Node...')
blockchain = NewZionBlockchain(
    db_file='$LOG_DIR/blockchain.db',
    enable_p2p=True,
    p2p_port=$P2P_PORT,
    enable_rpc=True,
    rpc_port=$BLOCKCHAIN_RPC_PORT
)

print(f'📊 Block height: {len(blockchain.blocks)}')
print(f'💰 Total supply: {blockchain.get_total_supply():.2f} ZION (Max)')
print(f'🔄 Circulating supply: {blockchain.get_circulating_supply():.2f} ZION')

# Start services
blockchain.start_p2p_network()
blockchain.start_rpc_server()

print('✅ ZION Blockchain services started')
print(f'🔌 RPC: http://127.0.0.1:$BLOCKCHAIN_RPC_PORT')
print(f'🌐 P2P: 127.0.0.1:$P2P_PORT')

try:
    while True:
        time.sleep(30)
        print(f'📈 Height: {len(blockchain.blocks)}, Circulating: {blockchain.get_circulating_supply():.2f} ZION')
except KeyboardInterrupt:
    print('🛑 Stopping blockchain node...')
    blockchain.stop_p2p_network()
    blockchain.stop_rpc_server()
" > "$LOG_DIR/blockchain.log" 2>&1 &

BLOCKCHAIN_PID=$!
echo "✅ Blockchain Node started (PID: $BLOCKCHAIN_PID)"
sleep 5

echo ""
echo "2️⃣  Starting Mining Pool..."

# Start mining pool
nohup python3 -c "
import sys
import asyncio
sys.path.append('.')
from zion_universal_pool_v2 import ZionUniversalPool

async def run_pool():
    print('⛏️  Starting ZION Mining Pool...')
    pool = ZionUniversalPool(port=$MINING_POOL_PORT)
    print(f'⛏️  Pool listening on port $MINING_POOL_PORT')
    print(f'📊 API available on port $(($MINING_POOL_PORT + 1))')
    await pool.start_server()

if __name__ == '__main__':
    try:
        asyncio.run(run_pool())
    except KeyboardInterrupt:
        print('🛑 Mining pool stopped')
" > "$LOG_DIR/mining_pool.log" 2>&1 &

MINING_POOL_PID=$!
echo "✅ Mining Pool started (PID: $MINING_POOL_PID)"
sleep 3

echo ""
echo "3️⃣  Testing connectivity..."

# Test RPC
echo -n "📡 Blockchain RPC: "
if curl -s "http://127.0.0.1:$BLOCKCHAIN_RPC_PORT" >/dev/null 2>&1; then
    echo "✅ Responding"
else
    echo "❌ Not responding"
fi

# Test Pool API
echo -n "⛏️  Pool API: "
if curl -s "http://127.0.0.1:$(($MINING_POOL_PORT + 1))/api/stats" >/dev/null 2>&1; then
    echo "✅ Responding"
else
    echo "❌ Not responding"
fi

# Test P2P port
echo -n "🌐 P2P Port: "
if timeout 3 bash -c "</dev/tcp/127.0.0.1/$P2P_PORT" 2>/dev/null; then
    echo "✅ Open"
else
    echo "❌ Closed"
fi

echo ""
echo "🎉 ZION 2.7.5 macOS Local Stack Running!"
echo ""
echo "📋 Process IDs:"
echo "  🔗 Blockchain: $BLOCKCHAIN_PID"
echo "  ⛏️  Mining Pool: $MINING_POOL_PID"
echo ""
echo "📊 Service URLs:"
echo "  🔗 Blockchain RPC: http://127.0.0.1:$BLOCKCHAIN_RPC_PORT"
echo "  📊 Pool Stats: http://127.0.0.1:$(($MINING_POOL_PORT + 1))/api/stats"
echo "  ⛏️  Mining: stratum+tcp://127.0.0.1:$MINING_POOL_PORT"
echo ""
echo "📋 Logs (real-time):"
echo "  🔗 Blockchain: tail -f $LOG_DIR/blockchain.log"
echo "  ⛏️  Mining Pool: tail -f $LOG_DIR/mining_pool.log"
echo ""
echo "🧪 Test XMRig connection:"
echo "  xmrig --url 127.0.0.1:$MINING_POOL_PORT --user testWorker --algo rx/0 --keepalive"
echo ""
echo "🛑 Stop all services:"
echo "  kill $BLOCKCHAIN_PID $MINING_POOL_PID"