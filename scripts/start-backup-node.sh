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

# ── Block retention: 0 = NO pruning (keep full history) ────────────────────
# Backup node is the canonical full-history archive. Edge runs retention=1000
# for performance; this node preserves every block from now on.
export ZION_BLOCK_RETENTION=0

# ── Bridge validator config (required for P2P sync — same as Edge) ──────────
export ZION_BRIDGE_VALIDATOR_PUBKEYS='0x02d6406dab8cc71d88f55abca3fe8bae91c26a60162ad3dd1ee55a6aa9cfc96368,0x03e45622f0bad22e34bd1f331219f8d39ed20c4720ce70363b65560df408fc2081,0x025e4b708a7c6dacd484c4fb2a93e80c18f0288aa9b736d4251c6eb8f09d045611,0x02eb3f020ac5a4a647061ffc38b69013a7969c21241e7153a3b196186efd3b185e,0x02a6b18aa50814ac9e9e1f70a69e49ee9a61407a48f83ad2ae914e7676f440ca97'
export ZION_BRIDGE_VALIDATOR_THRESHOLD=5

# ── Logging ────────────────────────────────────────────────────────────────
export RUST_LOG='info'

echo "==========================================================="
echo "  ZION Backup Node :: P2P 0.0.0.0:8333  RPC 127.0.0.1:8446"
echo "  Seed: 62.171.141.136:8333 (Edge)"
echo "  State: ${ZION_NODE_STATE_PATH}"
echo "  Started: $(date)"
echo "==========================================================="

NODE_BIN="${REPO_ROOT}/target/release/node"
if [[ ! -x "${NODE_BIN}" ]]; then
  # Fallback: V3 workspace target (used when built via `cargo build` from V3/)
  NODE_BIN="${REPO_ROOT}/V3/target/release/node"
fi

if [[ "${1:-}" == "--foreground" ]]; then
  # systemd mode — run in foreground, logs to stdout
  exec "${NODE_BIN}"
else
  # standalone mode — background with nohup
  nohup "${NODE_BIN}" >> "${REPO_ROOT}/logs/node-backup.log" 2>&1 &
  PID=$!
  echo "[OK] Backup node started  PID=$PID"
  echo "[OK] Log: ${REPO_ROOT}/logs/node-backup.log"
  echo $PID > "${REPO_ROOT}/logs/node-backup.pid"
fi
