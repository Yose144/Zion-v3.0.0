#!/usr/bin/env bash
# ============================================================================
#  ZION V31 — Local Backup Node (syncs with Edge V31 nodes via P2P)
#  Binary : V31/target/release/zion-node (3.1.0-alpha)
#  P2P    : 0.0.0.0:8333
#  RPC    : 127.0.0.1:8446
#  Seed   : 62.171.141.136:8335,8336,8337 (Edge V31 nodes)
#  DB     : V31/data/v31-backup-node.db (fresh V31 chain)
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

mkdir -p logs V31/data

# ── Node identity ──────────────────────────────────────────────────────────
export ZION_NODE_ID='local-v31-backup-node'
export ZION_NODE_DB="${REPO_ROOT}/V31/data/v31-backup-node.db"
export ZION_NODE_RPC='127.0.0.1:8446'
export ZION_NODE_P2P='0.0.0.0:8333'

# ── Network — peer with Edge V31 nodes ──────────────────────────────────────
export ZION_SEED_PEERS='62.171.141.136:8335,62.171.141.136:8336,62.171.141.136:8337'

# ── Wallets (same as Edge — constitutional emission) ───────────────────────
export ZION_MINER_ADDRESS='zion1d6e3a4s6t856z042q2m6h5h2j4k3v7f8f2a94h7'
export ZION_HUMANITARIAN_WALLET='zion1j0j5d0c70056u678j7g4p686e7r3w5k0y8vy0m0'
export ZION_ISSOBELLA_WALLET='zion1g3g0k2j665r075g5j077z0w3u4g3w0d5837j3f6'

# ── Security (same as Edge — active from genesis) ──────────────────────────
export ZION_MAX_TX_AMOUNT_HEIGHT=1
export ZION_BALANCE_CHECK_HEIGHT=0
export ZION_MIGRATION_HEIGHT=1

# ── Block retention: 0 = NO pruning (keep full history) ────────────────────
# Backup node is the canonical full-history archive.
export ZION_BLOCK_RETENTION=0

# ── Logging ────────────────────────────────────────────────────────────────
export RUST_LOG='info'

echo "==========================================================="
echo "  ZION V31 Backup Node :: P2P 0.0.0.0:8333  RPC 127.0.0.1:8446"
echo "  Seed: 62.171.141.136:8335,8336,8337 (Edge V31)"
echo "  DB: ${ZION_NODE_DB}"
echo "  Started: $(date)"
echo "==========================================================="

NODE_BIN="${REPO_ROOT}/V31/target/release/zion-node"
if [[ ! -x "${NODE_BIN}" ]]; then
  echo "[ERROR] V31 node binary not found at ${NODE_BIN}"
  echo "        Build with: cd V31 && cargo build --release -p zion-core"
  exit 1
fi

if [[ "${1:-}" == "--foreground" ]]; then
  # systemd mode — run in foreground, logs to stdout
  exec "${NODE_BIN}"
else
  # standalone mode — background with nohup
  nohup "${NODE_BIN}" >> "${REPO_ROOT}/logs/v31-backup-node.log" 2>&1 &
  PID=$!
  echo "[OK] V31 backup node started  PID=$PID"
  echo "[OK] Log: ${REPO_ROOT}/logs/v31-backup-node.log"
  echo $PID > "${REPO_ROOT}/logs/v31-backup-node.pid"
fi
