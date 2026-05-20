#!/usr/bin/env bash
# ZION V3 Full Stack — Linux/macOS with Log Files
# Launches node1 + node2 + pool + miner and redirects all output to logs/

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

# Clean old logs
rm -f "$LOG_DIR"/*.log "$LOG_DIR"/*.err

NODE_EXE="$REPO_ROOT/V3/target/release/node"
POOL_EXE="$REPO_ROOT/V3/target/release/server"
MINER_EXE="$REPO_ROOT/V3/target/release/zion-miner"

for exe in "$NODE_EXE" "$POOL_EXE" "$MINER_EXE"; do
    if [[ ! -x "$exe" ]]; then
        echo "[ERROR] Binary not found: $exe"
        echo "        Run: cargo build --release --manifest-path V3/Cargo.toml --workspace"
        exit 1
    fi
done

# ── Node 1 ──
export ZION_NODE_ID='native-node'
export ZION_P2P_BIND='0.0.0.0:8333'
export ZION_RPC_BIND='0.0.0.0:8443'
export ZION_NODE_STATE_PATH="/tmp/zion-node-state.db"
export ZION_SEED_PEERS='none'
export ZION_MINER_ADDRESS='zion1e2z646u403s6c7k8m6m8m4q0a6r2a5h5j8534d8'
export ZION_HUMANITARIAN_WALLET='zion1t4w447d7k4c600h3x893m5r55645w4p057yf4d7'
export ZION_ISSOBELLA_WALLET='zion1e4t5a390m2r427a8f3s39885v4f2v6n8u3mj3f5'
export ZION_POOL_FEE_WALLET='zion1f3d840y886x6r658j3t0f583j347l2e2h84z402'
rm -f /tmp/peers.json /tmp/zion-node-state.db /tmp/zion-node-state.db-lock

nohup "$NODE_EXE" > "$LOG_DIR/node1.log" 2> "$LOG_DIR/node1.err" &
P1=$!
echo "Started Node1  PID=$P1"
sleep 3

# ── Node 2 ──
export ZION_NODE_ID='native-node2'
export ZION_P2P_BIND='0.0.0.0:8334'
export ZION_RPC_BIND='0.0.0.0:8446'
export ZION_NODE_STATE_PATH="/tmp/zion-node2-state.db"
export ZION_SEED_PEERS='127.0.0.1:8333'
rm -f /tmp/zion-node2-state.db /tmp/zion-node2-state.db-lock

nohup "$NODE_EXE" > "$LOG_DIR/node2.log" 2> "$LOG_DIR/node2.err" &
P2=$!
echo "Started Node2  PID=$P2"
sleep 2

# ── Pool ──
export ZION_POOL_BIND='0.0.0.0:8444'
export ZION_NODE_RPC_ADDR='127.0.0.1:8443'
export ZION_POOL_LOOP_COUNT='1000000'
export ZION_MAX_SESSIONS_PER_IP='10'
export ZION_POOL_WALLET='zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8'
export ZION_POOL_PAYOUT_SK_HEX='[REDACTED — pool SK removed for security]'
export ZION_NONCE_COUNT='4096'

nohup "$POOL_EXE" > "$LOG_DIR/pool.log" 2> "$LOG_DIR/pool.err" &
PP=$!
echo "Started Pool   PID=$PP"
sleep 2

# ── Miner ──
export ZION_POOL_ADDR='127.0.0.1:8444'
export ZION_LOOP_COUNT='1000000'
export ZION_MINER_THREADS='2'
export ZION_WORKER_NAME='worker1'
export ZION_MINER_ID='gpu-miner-01'
export ZION_GPU_BACKEND='opencl'
export ZION_GPU_WORK_SIZE='4096'

nohup "$MINER_EXE" > "$LOG_DIR/miner.log" 2> "$LOG_DIR/miner.err" &
PM=$!
echo "Started Miner  PID=$PM"

echo ""
echo "[launch] All processes started. PIDs: node1=$P1 node2=$P2 pool=$PP miner=$PM"
echo "[launch] Logs: $LOG_DIR"
echo "[launch] To watch live:   bash scripts/watch-logs.sh"
echo "[launch] Quick overview:  bash scripts/live-logs.sh"
echo "[launch] To stop:         bash scripts/stop-stack.sh"
