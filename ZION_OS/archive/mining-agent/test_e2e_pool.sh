#!/bin/bash
# E2E Test: Mining Agent on Pool
# Tests actual zion-miner binary with Metal backend on Edge pool

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
MINER_BIN="$REPO_ROOT/V3/target/release/zion-miner"
WALLET="zion1a59644y2a2z3p5p2f88308d2u536f0e2e3rd5a8"
POOL="100.76.16.108:8444"
WORKER="e2e-metal-test"
LOG_FILE="$REPO_ROOT/logs/miner-e2e-metal.log"

echo "╔══════════════════════════════════════════════╗"
echo "║     E2E Test: Mining Agent on Pool         ║"
echo "╚══════════════════════════════════════════════╝"
echo "Miner binary: $MINER_BIN"
echo "Pool: $POOL"
echo "Worker: $WORKER"
echo "Wallet: $WALLET"
echo "Log: $LOG_FILE"

# Check binary exists
if [ ! -f "$MINER_BIN" ]; then
    echo "❌ Error: Miner binary not found at $MINER_BIN"
    echo "Build first: cd V3 && cargo build --release --manifest-path Cargo.toml -p zion-miner --features gpu-metal"
    exit 1
fi

# Stop existing miners
echo "Stopping existing miners..."
pkill -f zion-miner || true
sleep 2

# Run miner with Metal backend
echo "Starting miner with Metal backend..."
ZION_POOL_ADDR="$POOL" \
ZION_WORKER_NAME="$WORKER" \
ZION_MINER_ID="$WALLET" \
ZION_LOOP_COUNT=1000000 \
ZION_GPU_BACKEND=metal \
$MINER_BIN > "$LOG_FILE" 2>&1 &
MINER_PID=$!

echo "Miner PID: $MINER_PID"

# Wait for miner to start
echo "Waiting for miner to start..."
sleep 5

# Check if miner is running
if ! kill -0 $MINER_PID 2>/dev/null; then
    echo "❌ Error: Miner failed to start. Check log: $LOG_FILE"
    tail -20 "$LOG_FILE"
    exit 1
fi

echo "✅ Miner started successfully (PID: $MINER_PID)"

# Wait for mining results
echo "Mining for 30 seconds..."
sleep 30

# Check mining results
echo "Checking mining results..."
tail -30 "$LOG_FILE"

# Stop miner
echo "Stopping miner..."
kill $MINER_PID 2>/dev/null
sleep 2

echo "✅ E2E Test completed"
