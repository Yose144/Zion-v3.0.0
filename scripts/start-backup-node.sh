#!/usr/bin/env bash
# ============================================================================
#  ZION V3 — Local Backup Node (syncs with Edge via P2P)
#  P2P  : 0.0.0.0:8333
#  RPC  : 127.0.0.1:8446  (8443 is SSH tunnel to Edge)
#  WS   : 127.0.0.1:8447  (8445 is SSH tunnel to Edge)
#  Seed : 62.171.141.136:8333 (Edge server P2P)
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

mkdir -p logs V3/data

# ── Node identity ──────────────────────────────────────────────────────────
export ZION_NODE_ID='local-backup-node'
export ZION_P2P_BIND='0.0.0.0:8333'
export ZION_RPC_BIND='127.0.0.1:8446'
export ZION_WEBSOCKET_BIND='127.0.0.1:8447'
export ZION_NODE_STATE_PATH="${REPO_ROOT}/V3/data/zion-node-state.db"

# ── Network — peer with Edge server ────────────────────────────────────────
export ZION_SEED_PEERS='62.171.141.136:8333,62.171.141.136:8334'

# ── Wallets (same as Edge — constitutional emission) ───────────────────────
export ZION_MINER_ADDRESS='zion1d6m0h2r8m7k8k2d8n072y7j3j4m0254323vq0e3'
export ZION_HUMANITARIAN_WALLET='zion1e0u5q5s660k4m4a634p2c2v358r8g59564054z7'
export ZION_ISSOBELLA_WALLET='zion1f7y7l5k678y0v408e8s654d2282346k375526t2'

# ── Security (same as Edge — active from genesis) ──────────────────────────
export ZION_MAX_TX_AMOUNT_HEIGHT=1
export ZION_BALANCE_CHECK_HEIGHT=0
export ZION_MIGRATION_HEIGHT=1

# ── Logging ────────────────────────────────────────────────────────────────
export RUST_LOG='info'

echo "==========================================================="
echo "  ZION Backup Node :: P2P 0.0.0.0:8333  RPC 127.0.0.1:8446"
echo "  Seed: 62.171.141.136:8333 (Edge)"
echo "  State: ${ZION_NODE_STATE_PATH}"
echo "  Started: $(date)"
echo "==========================================================="

if [[ "${1:-}" == "--foreground" ]]; then
  # systemd mode — run in foreground, logs to stdout
  exec "${REPO_ROOT}/V3/target/release/node"
else
  # standalone mode — background with nohup
  nohup "${REPO_ROOT}/V3/target/release/node" >> "${REPO_ROOT}/logs/node-backup.log" 2>&1 &
  PID=$!
  echo "[OK] Backup node started  PID=$PID"
  echo "[OK] Log: ${REPO_ROOT}/logs/node-backup.log"
  echo $PID > "${REPO_ROOT}/logs/node-backup.pid"
fi
