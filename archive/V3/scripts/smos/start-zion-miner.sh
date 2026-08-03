#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/smos.env"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

# SMOS variables are usually exposed as custom params.
# Accept both classic and explicit names.
POOL_HOST="${POOL_HOST:-${SERVER:-}}"
POOL_PORT="${POOL_PORT:-${PORT:-}}"
WALLET_FROM_SMOS="${WALLET:-${WAL:-}}"
WORKER_FROM_SMOS="${WORKER:-${WORKER_NAME:-${rig_name:-}}}"

if [[ -z "${ZION_POOL_ADDR:-}" && -n "${POOL_HOST}" && -n "${POOL_PORT}" ]]; then
  export ZION_POOL_ADDR="${POOL_HOST}:${POOL_PORT}"
fi

if [[ -z "${ZION_MINER_ID:-}" && -n "${WALLET_FROM_SMOS}" ]]; then
  export ZION_MINER_ID="${WALLET_FROM_SMOS}"
fi

if [[ -z "${ZION_WORKER_NAME:-}" && -n "${WORKER_FROM_SMOS}" ]]; then
  export ZION_WORKER_NAME="${WORKER_FROM_SMOS}"
fi

export ZION_POOL_ADDR="${ZION_POOL_ADDR:-62.171.141.136:8444}"
export ZION_PROFILE="${ZION_PROFILE:-pool}"
export ZION_LOOP_COUNT="${ZION_LOOP_COUNT:-1}"
export ZION_NONCE_AUTOTUNE="${ZION_NONCE_AUTOTUNE:-true}"
export ZION_METRICS_REPORT_SECS="${ZION_METRICS_REPORT_SECS:-30}"
export ZION_GPU_BACKEND="${ZION_GPU_BACKEND:-auto}"

if [[ -z "${ZION_MINER_ID:-}" ]]; then
  echo "ERROR: ZION_MINER_ID is missing (wallet address)."
  echo "Set it in smos.env or pass WAL/WALLET from SimpleMining custom params."
  exit 1
fi

if [[ -z "${ZION_WORKER_NAME:-}" ]]; then
  export ZION_WORKER_NAME="smos-rig"
fi

if [[ "${ZION_THREADS:-0}" != "0" ]]; then
  export ZION_THREADS
fi

MINER_BIN="${MINER_BIN:-${SCRIPT_DIR}/zion-miner}"
if [[ ! -x "${MINER_BIN}" ]]; then
  echo "ERROR: miner binary not found or not executable: ${MINER_BIN}"
  echo "Place zion-miner next to this script or set MINER_BIN path."
  exit 1
fi

echo "Starting zion-miner on SimpleMining OS"
echo "Pool:   ${ZION_POOL_ADDR}"
echo "Wallet: ${ZION_MINER_ID}"
echo "Worker: ${ZION_WORKER_NAME}"
echo "Profile:${ZION_PROFILE}"

ARGS=(
  --pool "${ZION_POOL_ADDR}"
  --wallet "${ZION_MINER_ID}"
  --worker "${ZION_WORKER_NAME}"
  --profile "${ZION_PROFILE}"
)

if [[ "${ZION_THREADS:-0}" != "0" ]]; then
  ARGS+=(--threads "${ZION_THREADS}")
fi

exec "${MINER_BIN}" "${ARGS[@]}"
