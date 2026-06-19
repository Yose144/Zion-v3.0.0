#!/usr/bin/env bash
# ============================================================================
#  ZION Node — background launcher (for start-all or manual use)
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

mkdir -p logs V3/data

export ZION_NODE_ID='local-backup-node'
export ZION_P2P_BIND='0.0.0.0:8333'
export ZION_RPC_BIND='0.0.0.0:8443'
export ZION_WEBSOCKET_BIND='0.0.0.0:8445'
export ZION_NODE_STATE_PATH="${REPO_ROOT}/V3/data/zion-node-state.db"
export ZION_SEED_PEERS='100.76.16.108:8333'
export ZION_MINER_ADDRESS='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'
export ZION_HUMANITARIAN_WALLET='zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4'
export ZION_ISSOBELLA_WALLET='zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702'

nohup "${REPO_ROOT}/V3/target/release/node" >> "${REPO_ROOT}/logs/node1.log" 2>&1 &
PID=$!
echo "[OK] Node started  PID=$PID  P2P 0.0.0.0:8333  RPC 0.0.0.0:8443"
