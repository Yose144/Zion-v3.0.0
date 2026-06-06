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
export ZION_NODE_STATE_PATH="$REPO_ROOT/V3/data/zion-node-state.db"
export ZION_SEED_PEERS='none'
# Pool payout wallet receives the 89% miner share so PPLNS can redistribute.
# Coinbase mints 89/5/5 (miner/humanitarian/issobella); the 1% pool fee is
# BURNED (never minted), so no ZION_POOL_FEE_WALLET is configured.
export ZION_MINER_ADDRESS='zion1w523a76830x2t5m7f3j023w265e8g5c400a4790'
export ZION_HUMANITARIAN_WALLET='zion165a527w5d0n085t775x3w8n8q20742a6w7xr0z3'
export ZION_ISSOBELLA_WALLET='zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702'

mkdir -p "$REPO_ROOT/V3/data"

nohup "$NODE_EXE" > "$LOG_DIR/node1.log" 2> "$LOG_DIR/node1.err" &
P1=$!
echo "Started Node1  PID=$P1"
sleep 3

# ── Node 2 ──
export ZION_NODE_ID='native-node2'
export ZION_P2P_BIND='0.0.0.0:8334'
export ZION_RPC_BIND='0.0.0.0:8446'
export ZION_METRICS_BIND='0.0.0.0:9116'
export ZION_WEBSOCKET_BIND='0.0.0.0:8447'
export ZION_NODE_STATE_PATH="$REPO_ROOT/V3/data/zion-node2-state.db"
export ZION_SEED_PEERS='127.0.0.1:8333'

mkdir -p "$REPO_ROOT/V3/data"

nohup "$NODE_EXE" > "$LOG_DIR/node2.log" 2> "$LOG_DIR/node2.err" &
P2=$!
echo "Started Node2  PID=$P2"
sleep 2

# ── Pool ──
# Pool fee (1%) is burned at the coinbase level, so ZION_POOL_FEE_WALLET is
# intentionally NOT set here.
export ZION_POOL_BIND='0.0.0.0:8444'
export ZION_NODE_RPC_ADDR='127.0.0.1:8443'
export ZION_POOL_LOOP_COUNT='1000000'
export ZION_MAX_SESSIONS_PER_IP='10'
export ZION_POOL_WALLET='zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8'
export ZION_POOL_PAYOUT_SK_HEX='[REDACTED — pool SK removed for security]'
export ZION_NONCE_COUNT='4096'
export ZION_VARDIFF_START_DIFF='1'
export ZION_VARDIFF_MAX_DIFF='10000'
export ZION_PPLNS_WINDOW_SIZE='500000'
export ZION_ROUTING_METRICS_BIND='0.0.0.0:8455'

nohup "$POOL_EXE" > "$LOG_DIR/pool.log" 2> "$LOG_DIR/pool.err" &
PP=$!
echo "Started Pool   PID=$PP"
sleep 2

# ── Miner 1: CPU (minimal load, distinct payout address) ──
export ZION_POOL_ADDR='127.0.0.1:8444'
export ZION_LOOP_COUNT='1000000'
export ZION_MINER_THREADS='1'
export ZION_WORKER_NAME='cpu-worker1'
export ZION_MINER_ID='cpu-miner-01'
export ZION_GPU_BACKEND='cpu'
export ZION_PAYOUT_ADDRESS='zion1q044z2h8q0s742y87428d3q0r638s357h8385w4'

# nice -n 19 keeps the system responsive while CPU mining
nice -n 19 nohup "$MINER_EXE" > "$LOG_DIR/miner.log" 2> "$LOG_DIR/miner.err" &
PM=$!
echo "Started Miner CPU (1 thread)  PID=$PM"
sleep 1

# ── Miner 2: GPU (OpenCL, distinct payout address) ──
export ZION_WORKER_NAME='gpu-worker1'
export ZION_MINER_ID='gpu-miner-01'
export ZION_GPU_BACKEND='opencl'
export ZION_GPU_WORK_SIZE='4096'
export ZION_PAYOUT_ADDRESS='zion100y03888k3k467t228j0t8r675l8r2t2h00y7a2'

nohup "$MINER_EXE" > "$LOG_DIR/miner-gpu.log" 2> "$LOG_DIR/miner-gpu.err" &
PG=$!
echo "Started Miner GPU (OpenCL)    PID=$PG"

echo ""
echo "[launch] All processes started. PIDs: node1=$P1 node2=$P2 pool=$PP cpu-miner=$PM gpu-miner=$PG"
echo "[launch] Logs: $LOG_DIR"
echo "[launch] To watch live:   bash scripts/watch-logs.sh"
echo "[launch] Quick overview:  bash scripts/live-logs.sh"
echo "[launch] To stop:         bash scripts/stop-stack.sh"
