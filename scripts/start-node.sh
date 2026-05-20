#!/usr/bin/env bash
# ZION V3 — Start Node 1 (Genesis) with log redirect
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

export ZION_NODE_ID='w11-native-node'
export ZION_P2P_BIND='0.0.0.0:8333'
export ZION_RPC_BIND='0.0.0.0:8443'
export ZION_NODE_STATE_PATH="/tmp/zion-node-state.db"
export ZION_SEED_PEERS='none'
export ZION_MINER_ADDRESS='zion1e2z646u403s6c7k8m6m8m4q0a6r2a5h5j8534d8'
export ZION_HUMANITARIAN_WALLET='zion1t4w447d7k4c600h3x893m5r55645w4p057yf4d7'
export ZION_ISSOBELLA_WALLET='zion1e4t5a390m2r427a8f3s39885v4f2v6n8u3mj3f5'
export ZION_POOL_FEE_WALLET='zion1f3d840y886x6r658j3t0f583j347l2e2h84z402'

# Clean persisted peers
rm -f /tmp/peers.json /tmp/zion-node-state.db /tmp/zion-node-state.db-lock

NODE_EXE="$REPO_ROOT/V3/target/release/node"
if [[ ! -x "$NODE_EXE" ]]; then
    echo "[ERROR] Node binary not found: $NODE_EXE"
    echo "        Run Install / Build first (cargo build --release)."
    exit 1
fi

nohup "$NODE_EXE" > "$LOG_DIR/node1.log" 2> "$LOG_DIR/node1.err" &
echo "Started Node1  PID=$!"
