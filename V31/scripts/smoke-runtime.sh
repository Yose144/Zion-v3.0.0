#!/usr/bin/env bash
# V31 runtime smoke: node + pool + miner (E2E) on staging ports.
# Safe to run locally; uses non-default ports so it does not clash with V3.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RELEASE_DIR="${ROOT_DIR}/target/release"
DATA_DIR="${DATA_DIR:-/tmp/zion-v31-smoke}"

NODE_DB="${DATA_DIR}/node.db"
POOL_STATE="${DATA_DIR}/pool.json"
MULTICHAIN_DB="${DATA_DIR}/multichain.db"
MULTICHAIN_TOML="${DATA_DIR}/multichain.toml"
LOG_DIR="${DATA_DIR}/logs"

NODE_RPC="127.0.0.1:9444"
NODE_P2P="0.0.0.0:8335"
POOL_BIND="0.0.0.0:8445"
MINER_WORKER="zion1smokeminer.worker1"
MINER_REWARD="zion1smokeminer"
POOL_COINBASE="zion1smokepool"

cd "${ROOT_DIR}"

# Ensure cargo is available on minimal server images.
export PATH="${HOME}/.cargo/bin:${PATH}"

mkdir -p "${DATA_DIR}" "${LOG_DIR}"
rm -f "${NODE_DB}" "${POOL_STATE}" "${MULTICHAIN_DB}"

cat > "${MULTICHAIN_TOML}" <<TOML
[server]
bind = "127.0.0.1"
port = 8455

[database]
path = "${MULTICHAIN_DB}"

l1_rpc_url = "http://${NODE_RPC}"
adapters = []
TOML

# Ensure Python helper for raw TCP JSON-RPC is available.
STATUS_HELPER="${DATA_DIR}/status.py"
cat > "${STATUS_HELPER}" <<'PY'
import json, socket, sys
method = sys.argv[1]
host, port = sys.argv[2].split(":")
req = json.dumps({"jsonrpc":"2.0","method":method,"params":[],"id":1}) + "\n"
s = socket.create_connection((host, int(port)))
s.sendall(req.encode())
resp = s.recv(8192).decode().strip()
s.close()
d = json.loads(resp)
print(d.get("result",{}).get("chain_height",0))
PY

echo "[smoke] Building release binaries..."
cargo build --release -p zion-cli -p zion-core -p zion-pool -p zion-multichain >/dev/null 2>&1 || true

run_logged() {
  local log="$1"; shift
  RUST_LOG=info stdbuf -oL -eL "$@" >>"${LOG_DIR}/${log}" 2>&1 &
}

echo "[smoke] Starting zion-node on RPC=${NODE_RPC} P2P=${NODE_P2P}..."
run_logged node.log "${RELEASE_DIR}/zion-node" \
  --db-path "${NODE_DB}" \
  --rpc "${NODE_RPC}" \
  --p2p "${NODE_P2P}" \
  --human zion1smokehuman \
  --issobella zion1smokeissobella
NODE_PID=$!

sleep 3

echo "[smoke] Starting zion-pool on ${POOL_BIND}..."
run_logged pool.log "${RELEASE_DIR}/zion-pool" \
  --bind "${POOL_BIND}" \
  --l1-rpc-url "http://${NODE_RPC}" \
  --miner-address "${POOL_COINBASE}" \
  --state-path "${POOL_STATE}"
POOL_PID=$!

sleep 2

echo "[smoke] Starting triple-stream miner (ZION only) for up to 90s..."
run_logged miner.log "${RELEASE_DIR}/zion" \
  --config "${MULTICHAIN_TOML}" \
  miner start \
  --pool-url "stratum+tcp://127.0.0.1:8445" \
  --worker "${MINER_WORKER}" \
  --reward-address "${MINER_REWARD}" \
  --no-gpu --no-cpu
MINER_PID=$!

# Wait until the pool successfully submits a block to the node.
SMOKED=false
for i in $(seq 1 90); do
  sleep 1
  if grep -q '"accepted":true' "${LOG_DIR}/pool.log" 2>/dev/null; then
    SMOKED=true
    echo "[smoke] Block submitted and accepted"
    break
  fi
done

# Also try the canonical chain height through raw JSON-RPC if available.
HEIGHT=$(python3 "${STATUS_HELPER}" getStatus "${NODE_RPC}" 2>/dev/null || echo 0)

# Give in-flight submits a moment to flush.
sleep 2

kill -INT "${MINER_PID}" 2>/dev/null || true
sleep 2
kill "${POOL_PID}" 2>/dev/null || true
kill "${NODE_PID}" 2>/dev/null || true
wait 2>/dev/null || true

if $SMOKED; then
  echo "[smoke] PASS — V31 node+pool+miner produced and submitted a block"
  echo "  V3 chain_height=${HEIGHT} (canonical height is tracked separately)"
  echo "  logs: ${LOG_DIR}"
  exit 0
else
  echo "[smoke] FAIL — no block submitted within 90s"
  echo "  logs: ${LOG_DIR}"
  exit 1
fi
