#!/usr/bin/env bash
# ZION V3 — Start Node 2 (Local Dev / Optional)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

export ZION_NODE_ID='w11-native-node2'
export ZION_P2P_BIND='0.0.0.0:8334'
export ZION_RPC_BIND='0.0.0.0:8446'
export ZION_METRICS_BIND='0.0.0.0:9116'
export ZION_WEBSOCKET_BIND='0.0.0.0:8447'
export ZION_NODE_STATE_PATH="$REPO_ROOT/V3/data/zion-node2-state.db"
export ZION_SEED_PEERS='127.0.0.1:8333'
# Pool payout wallet receives the 89% miner share so PPLNS can redistribute
export ZION_MINER_ADDRESS='zion1w523a76830x2t5m7f3j023w265e8g5c400a4790'
export ZION_HUMANITARIAN_WALLET='zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4'
export ZION_ISSOBELLA_WALLET='zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702'
# Note: 89/5/5/0 burn model — no pool fee wallet (1% is burned, never minted)

mkdir -p "$REPO_ROOT/V3/data"

NODE_EXE="$REPO_ROOT/V3/target/release/node"
if [[ ! -x "$NODE_EXE" ]]; then
    echo "[ERROR] Node binary not found: $NODE_EXE"
    echo "        Run Install / Build first."
    exit 1
fi

nohup "$NODE_EXE" > "$LOG_DIR/node2.log" 2> "$LOG_DIR/node2.err" &
echo $! > "$LOG_DIR/node2.pid"
echo "Started Node2  PID=$!"
