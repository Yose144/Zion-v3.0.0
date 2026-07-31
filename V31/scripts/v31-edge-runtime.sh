#!/usr/bin/env bash
# V31 Mainnet Alpha — lightweight runtime launcher for Edge dashboard.
# This script intentionally does NOT compete with V3; it binds to isolated ports.
# Usage: v31-edge-runtime.sh {start|stop|status}

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="${ROOT_DIR}/V31/scripts"
RELEASE_DIR="${ROOT_DIR}/V31/target/release"
DATA_DIR="${ROOT_DIR}/data/v31"
LOG_DIR="${ROOT_DIR}/logs"
PID_DIR="${DATA_DIR}"

NODE_RPC="127.0.0.1:9445"
NODE_P2P="0.0.0.0:8335"
POOL_BIND="0.0.0.0:8446"

NODE_PID="${PID_DIR}/v31-node.pid"
POOL_PID="${PID_DIR}/v31-pool.pid"

cmd_for_pid() {
  cat "/proc/${1}/cmdline" 2>/dev/null | tr '\0' ' '
}

start() {
  mkdir -p "${DATA_DIR}" "${LOG_DIR}"

  if [[ -f "${NODE_PID}" ]] && kill -0 "$(cat "${NODE_PID}")" 2>/dev/null; then
    echo "V31 node already running (PID $(cat "${NODE_PID}"))"
  else
    rm -f "${NODE_PID}"
    RUST_LOG=info stdbuf -oL -eL "${RELEASE_DIR}/zion-node" \
      --db-path "${DATA_DIR}/node.db" \
      --rpc "${NODE_RPC}" \
      --p2p "${NODE_P2P}" \
      --human zion1v31human \
      --issobella zion1v31issobella \
      > "${LOG_DIR}/v31-node.log" 2>&1 &
    echo $! > "${NODE_PID}"
    echo "V31 node started (PID $(cat "${NODE_PID}"))"
  fi

  # Give the node a moment before the pool connects.
  sleep 2

  if [[ -f "${POOL_PID}" ]] && kill -0 "$(cat "${POOL_PID}")" 2>/dev/null; then
    echo "V31 pool already running (PID $(cat "${POOL_PID}"))"
  else
    rm -f "${POOL_PID}"
    RUST_LOG=info stdbuf -oL -eL "${RELEASE_DIR}/zion-pool" \
      --bind "${POOL_BIND}" \
      --l1-rpc-url "http://${NODE_RPC}" \
      --miner-address zion1v31pool \
      --state-path "${DATA_DIR}/pool.json" \
      > "${LOG_DIR}/v31-pool.log" 2>&1 &
    echo $! > "${POOL_PID}"
    echo "V31 pool started (PID $(cat "${POOL_PID}"))"
  fi
}

stop() {
  for pid_file in "${POOL_PID}" "${NODE_PID}"; do
    if [[ -f "${pid_file}" ]]; then
      pid=$(cat "${pid_file}")
      if kill -0 "${pid}" 2>/dev/null; then
        kill -INT "${pid}" 2>/dev/null || true
        echo "Stopped ${pid_file} (PID ${pid})"
      fi
      rm -f "${pid_file}"
    fi
  done
  # Give them a moment, then force-kill any remaining stragglers on our ports.
  sleep 2
  pkill -f '[z]ion-node.*--db-path.*v31/node\.db' || true
  pkill -f '[z]ion-pool.*--state-path.*v31/pool\.json' || true
}

status() {
  local node_running=false pool_running=false
  [[ -f "${NODE_PID}" ]] && kill -0 "$(cat "${NODE_PID}")" 2>/dev/null && node_running=true
  [[ -f "${POOL_PID}" ]] && kill -0 "$(cat "${POOL_PID}")" 2>/dev/null && pool_running=true
  printf '{"node":%s,"pool":%s}\n' "${node_running}" "${pool_running}"
}

case "${1:-status}" in
  start) start ;;
  stop)  stop  ;;
  status) status ;;
  *) echo "Usage: $0 {start|stop|status}"; exit 1 ;;
esac
