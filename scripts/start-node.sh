#!/usr/bin/env bash
# ZION V3 — Start Local Backup Node (syncs from Edge primary)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

export ZION_NODE_ID='w11-native-node'
export ZION_P2P_BIND='0.0.0.0:8333'
export ZION_RPC_BIND='0.0.0.0:8443'
export ZION_NODE_STATE_PATH="$REPO_ROOT/V3/data/zion-node-state.db"
export ZION_SEED_PEERS='none'
# Pool payout wallet receives the 89% miner share so PPLNS can redistribute
export ZION_MINER_ADDRESS='zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3'
export ZION_HUMANITARIAN_WALLET='zion1m4v5z8z850u480c5c208z274e334369275n5y20'
export ZION_ISSOBELLA_WALLET='zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702'
# Note: 89/5/5/0 burn model — no pool fee wallet (1% is burned, never minted)

mkdir -p "$REPO_ROOT/V3/data"

NODE_EXE="$REPO_ROOT/V3/target/release/node"
if [[ ! -x "$NODE_EXE" ]]; then
    echo "[ERROR] Node binary not found: $NODE_EXE"
    echo "        Run Install / Build first (cargo build --release)."
    exit 1
fi

nohup "$NODE_EXE" > "$LOG_DIR/node1.log" 2> "$LOG_DIR/node1.err" &
echo $! > "$LOG_DIR/node1.pid"
echo "Started Node1  PID=$!"
