#!/usr/bin/env bash
# V31 ↔ V3 sync helper.
# Usage:
#   v31-sync-v3.sh state              # import V3 state snapshot + checkpoint
#   v31-sync-v3.sh p2p 127.0.0.1:8333 # start V31 with V3 P2P seed peer(s)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RELEASE_DIR="${ROOT_DIR}/V31/target/release"
DATA_DIR="${ROOT_DIR}/data/v31"
LOG_DIR="${ROOT_DIR}/logs"
STATE_FILE="${ROOT_DIR}/data/state"
MIGRATE_BIN="${RELEASE_DIR}/zion-migrate"
NODE_BIN="${RELEASE_DIR}/zion-node"
POOL_BIN="${RELEASE_DIR}/zion-pool"
V31_DATA_DIR="${DATA_DIR}"

mkdir -p "${V31_DATA_DIR}" "${LOG_DIR}"

NODE_PID_FILE="${V31_DATA_DIR}/v31-node.pid"
POOL_PID_FILE="${V31_DATA_DIR}/v31-pool.pid"

stop_runtime() {
  if [[ -f "${NODE_PID_FILE}" ]]; then
    pid=$(cat "${NODE_PID_FILE}" 2>/dev/null) || true
    if [[ -n "${pid:-}" ]]; then
      kill "${pid}" 2>/dev/null || true
    fi
    rm -f "${NODE_PID_FILE}"
  fi
  if [[ -f "${POOL_PID_FILE}" ]]; then
    pid=$(cat "${POOL_PID_FILE}" 2>/dev/null) || true
    if [[ -n "${pid:-}" ]]; then
      kill "${pid}" 2>/dev/null || true
    fi
    rm -f "${POOL_PID_FILE}"
  fi
  pkill -f '[z]ion-node.*--db-path.*v31' || true
  pkill -f '[z]ion-pool.*port.*8446' || true
  sleep 2
}

start_pool() {
  RUST_LOG=info stdbuf -oL -eL "${POOL_BIN}" \
    --bind "0.0.0.0:8446" \
    --l1-rpc-url "http://127.0.0.1:9445" \
    --miner-address zion1v31pool \
    --state-path "${V31_DATA_DIR}/pool.json" \
    >"${LOG_DIR}/v31-pool.log" 2>&1 &
  POOL_PID=$!
  echo "${POOL_PID}" >"${POOL_PID_FILE}"
}

start_node() {
  local db_path="${1}"
  shift
  RUST_LOG=info stdbuf -oL -eL "${NODE_BIN}" \
    --db-path "${db_path}" \
    --rpc 127.0.0.1:9445 \
    --p2p 0.0.0.0:8335 \
    "$@" \
    >"${LOG_DIR}/v31-node.log" 2>&1 &
  NODE_PID=$!
  echo "${NODE_PID}" >"${NODE_PID_FILE}"
}

sync_state() {
  if [[ ! -f "${STATE_FILE}" ]]; then
    echo "ERROR: V3 state file not found: ${STATE_FILE}" >&2
    exit 1
  fi
  if [[ ! -x "${MIGRATE_BIN}" ]]; then
    echo "ERROR: zion-migrate binary not found: ${MIGRATE_BIN}" >&2
    exit 1
  fi
  stop_runtime
  DB="${V31_DATA_DIR}/node.db"
  rm -f "${DB}"* "${V31_DATA_DIR}/v3-checkpoint.json"

  echo "[v31-sync] Migrating V3 state -> ${DB}"
  "${MIGRATE_BIN}" --v3-state "${STATE_FILE}" --db-path "${DB}"

  echo "[v31-sync] Building V3 checkpoint JSON"
  python3 "${SCRIPT_DIR}/v3-state-to-checkpoint.py" "${STATE_FILE}" "${V31_DATA_DIR}/v3-checkpoint.json"

  echo "[v31-sync] Starting V31 node with V3 checkpoint"
  start_node "${DB}" --v3-checkpoint "${V31_DATA_DIR}/v3-checkpoint.json"
  sleep 5

  start_pool
  sleep 1
  echo "[v31-sync] State sync complete. Node PID $(cat "${NODE_PID_FILE}"), Pool PID $(cat "${POOL_PID_FILE}")."
}

sync_p2p() {
  shift
  peers=()
  for p in "$@"; do
    peers+=("--peer" "${p}")
  done
  stop_runtime
  DB="${V31_DATA_DIR}/node.db"
  # Keep existing DB (fresh genesis or migrated) and just add P2P seeds.
  start_node "${DB}" "${peers[@]}"
  sleep 5
  start_pool
  sleep 1
  echo "[v31-sync] P2P sync started with seeds: $*. Node PID $(cat "${NODE_PID_FILE}"), Pool PID $(cat "${POOL_PID_FILE}")."
}

MODE="${1:-state}"

if [[ "${MODE}" == "state" ]]; then
  sync_state
elif [[ "${MODE}" == "p2p" ]]; then
  sync_p2p "$@"
else
  echo "Usage: $0 {state | p2p <peer> [peer...]}" >&2
  exit 1
fi
