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

# ── Network — peer with Edge V31 primary node ───────────────────────────────
# Only 8335 is active; 8336/8337 are not listening and repeated refused
# connections trigger fail2ban / P2P reconnect-storm rate limits.
export ZION_SEED_PEERS='62.171.141.136:8335'

# ── Wallets (same as Edge — constitutional emission) ───────────────────────
export ZION_MINER_ADDRESS='zion1074344t7k686j6n8a0l6t0f4c8d828y083xh4m2'
export ZION_HUMANITARIAN_WALLET='zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8'
export ZION_ISSOBELLA_WALLET='zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0'

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
echo "  Seed: 62.171.141.136:8335 (Edge V31 primary)"
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
  exec "${NODE_BIN}" --v3-no-genesis
else
  # standalone mode — background with nohup
  nohup "${NODE_BIN}" --v3-no-genesis >> "${REPO_ROOT}/logs/v31-backup-node.log" 2>&1 &
  PID=$!
  echo "[OK] V31 backup node started  PID=$PID"
  echo "[OK] Log: ${REPO_ROOT}/logs/v31-backup-node.log"
  echo $PID > "${REPO_ROOT}/logs/v31-backup-node.pid"
fi
