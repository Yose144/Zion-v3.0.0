#!/usr/bin/env bash
# ============================================================================
#  ZION OS — Complete Stack Launcher (Ubuntu / Linux)
#  Each service starts in the background.
#
#  Algorithm: deeksha_lite_fire (edit run-miner.sh to change)
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

mkdir -p logs V3/data

echo "==========================================================="
echo "  ZION OS — Complete Stack Launcher (Linux)"
echo "==========================================================="
echo "  1. ZION Dashboard  :: http://127.0.0.1:8766"
echo "  2. ZION Node       :: P2P 8333  RPC 8443  WS 8445"
echo "  3. ZION GPU Miner  :: Pool 100.76.16.108:8444  (deeksha_lite_fire)"
echo "==========================================================="
echo ""

# ── Helper: wait for port ──────────────────────────────────────────────────
wait_port() {
    local host="$1" port="$2" label="$3" max="${4:-30}"
    for i in $(seq 1 "$max"); do
        if nc -z -w 1 "$host" "$port" 2>/dev/null; then
            echo "[OK] $label ready (${host}:${port})"
            return 0
        fi
        sleep 1
    done
    echo "[WARN] $label not ready after ${max}s (${host}:${port})"
    return 1
}

# ── 1. Dashboard ───────────────────────────────────────────────────────────
echo "[1/3] Starting ZION Dashboard..."
nohup python3 "${REPO_ROOT}/ZION_OS/dashboard/app.py" > "${REPO_ROOT}/logs/dashboard.log" 2>&1 &
DASH_PID=$!
echo "       PID=$DASH_PID  http://127.0.0.1:8766"
wait_port 127.0.0.1 8766 "Dashboard" 10

# ── 2. Node ────────────────────────────────────────────────────────────────
echo ""
echo "[2/3] Starting ZION Node..."
export ZION_NODE_ID='local-backup-node'
export ZION_P2P_BIND='0.0.0.0:8333'
export ZION_RPC_BIND='0.0.0.0:8443'
export ZION_WEBSOCKET_BIND='0.0.0.0:8445'
export ZION_NODE_STATE_PATH="${REPO_ROOT}/V3/data/zion-node-state.db"
export ZION_SEED_PEERS='100.76.16.108:8333'
export ZION_MINER_ADDRESS='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'
export ZION_HUMANITARIAN_WALLET='zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4'
export ZION_ISSOBELLA_WALLET='zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702'
nohup "${REPO_ROOT}/V3/target/release/node" > "${REPO_ROOT}/logs/node1.log" 2>&1 &
NODE_PID=$!
echo "       PID=$NODE_PID  P2P 0.0.0.0:8333  RPC 0.0.0.0:8443"
wait_port 127.0.0.1 8443 "Node RPC" 30

# ── 3. Miner ───────────────────────────────────────────────────────────────
echo ""
echo "[3/3] Starting ZION GPU Miner..."
export ZION_POOL_ADDR='100.76.16.108:8444'
export ZION_LOOP_COUNT='1000000'
export ZION_WORKER_NAME='worker1'
export ZION_MINER_ID='ubuntu-gpu-miner-01'
export ZION_PAYOUT_ADDRESS='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'
export ZION_MINER_ALGORITHM='deeksha_lite_fire'
export ZION_GPU_BACKEND='opencl'
export ZION_MINER_THREADS='1'
export ZION_GPU_WORK_SIZE='4096'
export ZION_NONCE_COUNT='4096'
nohup "${REPO_ROOT}/V3/target/release/zion-miner" > "${REPO_ROOT}/logs/miner.log" 2>&1 &
MINER_PID=$!
echo "       PID=$MINER_PID  Pool 100.76.16.108:8444"
sleep 3

echo ""
echo "==========================================================="
echo "  All services started in background!"
echo "==========================================================="
echo "  Dashboard : http://127.0.0.1:8766"
echo "  Node RPC  : http://127.0.0.1:8443/jsonrpc"
echo "  Logs      : ${REPO_ROOT}/logs/"
echo ""
echo "  To stop:  bash ${REPO_ROOT}/stop-all.sh"
echo "==========================================================="
echo ""

# Write PID file for easy stopping
cat > "${REPO_ROOT}/logs/.stack-pids" <<EOF
DASH_PID=${DASH_PID}
NODE_PID=${NODE_PID}
MINER_PID=${MINER_PID}
EOF
