#!/usr/bin/env bash
# ZION V3 — Start Node 2 (Follower) with log redirect
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

export ZION_NODE_ID='w11-native-node2'
export ZION_P2P_BIND='0.0.0.0:8334'
export ZION_RPC_BIND='0.0.0.0:8446'
export ZION_NODE_STATE_PATH="/tmp/zion-node2-state.db"
export ZION_SEED_PEERS='127.0.0.1:8333'
export ZION_MINER_ADDRESS='zion1e2z646u403s6c7k8m6m8m4q0a6r2a5h5j8534d8'
export ZION_HUMANITARIAN_WALLET='zion1t4w447d7k4c600h3x893m5r55645w4p057yf4d7'
export ZION_ISSOBELLA_WALLET='zion1e4t5a390m2r427a8f3s39885v4f2v6n8u3mj3f5'
export ZION_POOL_FEE_WALLET='zion1f3d840y886x6r658j3t0f583j347l2e2h84z402'

rm -f /tmp/peers.json /tmp/zion-node2-state.db /tmp/zion-node2-state.db-lock

NODE_EXE="$REPO_ROOT/V3/target/release/node"
if [[ ! -x "$NODE_EXE" ]]; then
    echo "[ERROR] Node binary not found: $NODE_EXE"
    echo "        Run Install / Build first."
    exit 1
fi

nohup "$NODE_EXE" > "$LOG_DIR/node2.log" 2> "$LOG_DIR/node2.err" &
echo "Started Node2  PID=$!"
