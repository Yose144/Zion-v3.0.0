#!/bin/bash
# ZION V3 — Local Node Launcher (macOS)
# Starts local node + miner on macOS for development/testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
NODE_BIN="$REPO_ROOT/V3/target/release/node"
MINER_BIN="$REPO_ROOT/V3/target/release/zion-miner"
DATA_DIR="$REPO_ROOT/V3/data"
LOG_DIR="$REPO_ROOT/logs"

# Ensure directories exist
mkdir -p "$DATA_DIR"
mkdir -p "$LOG_DIR"

echo "Starting ZION V3 Local Node on macOS..."
echo "Node binary: $NODE_BIN"
echo "Miner binary: $MINER_BIN"
echo "Data directory: $DATA_DIR"
echo "Log directory: $LOG_DIR"

# Check binaries exist
if [ ! -f "$NODE_BIN" ]; then
    echo "Error: Node binary not found at $NODE_BIN"
    echo "Build first: cd V3 && cargo build --release"
    exit 1
fi

if [ ! -f "$MINER_BIN" ]; then
    echo "Error: Miner binary not found at $MINER_BIN"
    echo "Build first: cd V3 && cargo build --release"
    exit 1
fi

# Stop existing processes
echo "Stopping existing processes..."
pkill -f zion-node || true
pkill -f zion-miner || true
sleep 2

# Start node
echo "Starting node..."
cd "$REPO_ROOT"
ZION_NODE_ID=macos-local-node \
ZION_P2P_BIND=0.0.0.0:8333 \
ZION_RPC_BIND=127.0.0.1:8443 \
ZION_SEED_PEERS=100.76.16.108:8333 \
ZION_MINER_ADDRESS=zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3 \
ZION_HUMANITARIAN_WALLET=zion1m4v5z8z850u480c5c208z274e334369275n5y20 \
ZION_ISSOBELLA_WALLET=zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702 \
$NODE_BIN > "$LOG_DIR/node-macos.log" 2>&1 &
NODE_PID=$!

echo "Node PID: $NODE_PID"

# Wait for node to start
echo "Waiting for node to start..."
sleep 5

# Check if node is running
if ! kill -0 $NODE_PID 2>/dev/null; then
    echo "Error: Node failed to start. Check log: $LOG_DIR/node-macos.log"
    tail -20 "$LOG_DIR/node-macos.log"
    exit 1
fi

echo "✅ Node started successfully (PID: $NODE_PID)"
echo "P2P: 0.0.0.0:8333"
echo "RPC: 127.0.0.1:8443"

# Start miner (connect to Edge pool via Tailscale with GPU Metal)
echo "Starting miner (connecting to Edge pool via Tailscale with GPU Metal)..."
ZION_POOL_ADDR=100.76.16.108:8444 \
ZION_WORKER_NAME=macos-miner-gpu \
ZION_LOOP_COUNT=1000000 \
ZION_MINER_ID=zion1a59644y2a2z3p5p2f88308d2u536f0e2e3rd5a8 \
ZION_GPU_BACKEND=metal \
$MINER_BIN > "$LOG_DIR/miner-macos.log" 2>&1 &
MINER_PID=$!

echo "Miner PID: $MINER_PID"

# Wait for miner to start
echo "Waiting for miner to start..."
sleep 3

# Check if miner is running
if ! kill -0 $MINER_PID 2>/dev/null; then
    echo "Error: Miner failed to start. Check log: $LOG_DIR/miner-macos.log"
    tail -20 "$LOG_DIR/miner-macos.log"
    # Stop node before exit
    kill $NODE_PID 2>/dev/null
    exit 1
fi

echo "✅ Miner started successfully (PID: $MINER_PID)"
echo "Pool: 100.76.16.108:8444 (Edge pool via Tailscale)"
echo ""
echo "=== Local Node Running ==="
echo "Node PID: $NODE_PID"
echo "Miner PID: $MINER_PID"
echo "Node log: $LOG_DIR/node-macos.log"
echo "Miner log: $LOG_DIR/miner-macos.log"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Trap to stop both processes on exit
trap "echo 'Stopping services...'; kill $NODE_PID $MINER_PID 2>/dev/null; echo 'Services stopped.'; exit 0" INT TERM

# Keep script running
wait
