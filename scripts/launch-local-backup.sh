#!/usr/bin/env bash
# ZION V3 — Local Backup Node + Miners (Edge-Primary Topology)
#
# This script is for the LOCAL PC acting as backup + miner host.
# Edge (Hetzner VPS, 100.76.16.108) runs the primary node + pool 24/7.
# Local PC runs:
#   - 1 node (backup, syncing from Edge via Tailscale VPN)
#   - 1+ miners (connecting to Edge pool via Tailscale VPN)
#
# Prerequisites:
#   - Tailscale VPN active on both Edge and local PC
#   - Edge node is running and accessible at 100.76.16.108:8333
#   - Edge pool is running and accessible at 100.76.16.108:8444
#
# Usage:
#   bash scripts/launch-local-backup.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

# Clean old logs
rm -f "$LOG_DIR"/*.log "$LOG_DIR"/*.err

NODE_EXE="$REPO_ROOT/V3/target/release/node"
MINER_EXE="$REPO_ROOT/V3/target/release/zion-miner"

for exe in "$NODE_EXE" "$MINER_EXE"; do
    if [[ ! -x "$exe" ]]; then
        echo "[ERROR] Binary not found: $exe"
        echo "        Run: cargo build --release --manifest-path V3/Cargo.toml --workspace"
        exit 1
    fi
done

# ── Backup Node (syncs from Edge primary) ──
export ZION_NODE_ID='local-backup-node'
export ZION_P2P_BIND='0.0.0.0:8333'
export ZION_RPC_BIND='0.0.0.0:8443'
export ZION_NODE_STATE_PATH="$REPO_ROOT/V3/data/zion-node-state.db"
# Connect to Edge primary via Tailscale VPN
export ZION_SEED_PEERS='100.76.16.108:8333'
# Burn model: 89/5/5/1 — canonical fee split addresses (must match Edge)
export ZION_MINER_ADDRESS='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'
export ZION_HUMANITARIAN_WALLET='zion1c245e7f5d8h427r4p4s2s607d7v4c255z7x96t3'
export ZION_ISSOBELLA_WALLET='zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702'

mkdir -p "$REPO_ROOT/V3/data"

nohup "$NODE_EXE" > "$LOG_DIR/node1.log" 2> "$LOG_DIR/node1.err" &
P1=$!
echo "Started Backup Node  PID=$P1 (seeding from 100.76.16.108:8333)"
sleep 3

# ── Miner 1: CPU (minimal load, distinct payout address) ──
# Connects to Edge pool via Tailscale VPN
export ZION_POOL_ADDR='100.76.16.108:8444'
export ZION_LOOP_COUNT='1000000'
export ZION_MINER_THREADS='1'
export ZION_WORKER_NAME='cpu-worker-local'
export ZION_MINER_ID='cpu-miner-local-01'
export ZION_GPU_BACKEND='cpu'
export ZION_PAYOUT_ADDRESS='zion1q044z2h8q0s742y87428d3q0r638s357h8385w4'

# nice -n 19 keeps the system responsive while CPU mining
nice -n 19 nohup "$MINER_EXE" > "$LOG_DIR/miner.log" 2> "$LOG_DIR/miner.err" &
PM=$!
echo "Started Miner CPU (1 thread)  PID=$PM -> Edge pool 100.76.16.108:8444"
sleep 1

# ── Miner 2: GPU (OpenCL, distinct payout address) ──
export ZION_WORKER_NAME='gpu-worker-local'
export ZION_MINER_ID='gpu-miner-local-01'
export ZION_GPU_BACKEND='opencl'
export ZION_GPU_WORK_SIZE='4096'
export ZION_PAYOUT_ADDRESS='zion100y03888k3k467t228j0t8r675l8r2t2h00y7a2'

nohup "$MINER_EXE" > "$LOG_DIR/miner-gpu.log" 2> "$LOG_DIR/miner-gpu.err" &
PG=$!
echo "Started Miner GPU (OpenCL)    PID=$PG -> Edge pool 100.76.16.108:8444"

echo ""
echo "[launch] All processes started. PIDs: backup-node=$P1 cpu-miner=$PM gpu-miner=$PG"
echo "[launch] Logs: $LOG_DIR"
echo "[launch] To watch live:   bash scripts/watch-logs.sh"
echo "[launch] Quick overview:  bash scripts/live-logs.sh"
echo "[launch] To stop:         bash scripts/stop-stack.sh"
echo ""
echo "[topology] Edge (100.76.16.108) = primary node + pool"
echo "[topology] Local PC       = backup node + miners"
