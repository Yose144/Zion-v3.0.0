#!/usr/bin/env bash
# ZION Miner v3.0.6 — easy desktop start script
# Triple stream runs in the backend; this wrapper just asks for the basics.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MINER="${SCRIPT_DIR}/zion-miner"

if [[ ! -x "${MINER}" ]]; then
    echo "[ERROR] zion-miner not found in ${SCRIPT_DIR}"
    exit 1
fi

# Non-interactive / headless: pass arguments straight through
if [[ ! -t 0 ]] || [[ "${ZION_EASY_MENU:-1}" == "0" ]]; then
    exec "${MINER}" "$@"
fi

echo "============================================================"
echo "  ZION Miner v3.0.6 — Desktop Quick Start"
echo "============================================================"
echo ""

# Hardware autodetect (optional but helpful)
if [[ "${ZION_DETECT_HARDWARE:-1}" != "0" ]]; then
    echo "[INFO] Detecting hardware..."
    "${MINER}" --detect-hardware 2>/dev/null || true
    echo ""
fi

# Defaults
DEFAULT_POOL="62.171.141.136:8444"
DEFAULT_WORKER="desktop-rig"
DEFAULT_GPU="auto"
DEFAULT_THREADS="auto"
DEFAULT_ALGO="deeksha_lite_v1"
DEFAULT_PROFILE="pool"

# Platform-specific GPU backend hint
OS="$(uname -s)"
ARCH="$(uname -m)"
if [[ "${OS}" == "Linux" && "${ARCH}" == "aarch64" ]]; then
    GPU_HINT="auto/cuda/cpu"
elif [[ "${OS}" == "Linux" ]]; then
    GPU_HINT="auto/opencl/cuda/cpu"
elif [[ "${OS}" == "Darwin" ]]; then
    GPU_HINT="auto/metal/opencl/cpu"
else
    GPU_HINT="auto/cpu"
fi

read -rp "Pool address [${DEFAULT_POOL}]: " pool
pool="${pool:-${DEFAULT_POOL}}"

read -rp "Wallet address (required): " wallet
if [[ -z "${wallet}" ]]; then
    echo "[ERROR] Wallet address is required."
    exit 1
fi

read -rp "Worker name [${DEFAULT_WORKER}]: " worker
worker="${worker:-${DEFAULT_WORKER}}"

read -rp "GPU backend (${GPU_HINT}) [${DEFAULT_GPU}]: " gpu
gpu="${gpu:-${DEFAULT_GPU}}"

read -rp "CPU threads (auto or number) [${DEFAULT_THREADS}]: " threads
threads="${threads:-${DEFAULT_THREADS}}"

read -rp "Algorithm [${DEFAULT_ALGO}]: " algo
algo="${algo:-${DEFAULT_ALGO}}"

read -rp "Profile (pool/solo/benchmark) [${DEFAULT_PROFILE}]: " profile
profile="${profile:-${DEFAULT_PROFILE}}"

echo ""
echo "[INFO] Starting ZION miner..."
echo "  pool:    ${pool}"
echo "  wallet:  ${wallet}"
echo "  worker:  ${worker}"
echo "  gpu:     ${gpu}"
echo "  threads: ${threads}"
echo "  algo:    ${algo}"
echo "  profile: ${profile}"
echo ""

THREADS_ARG="${threads}"
if [[ "${threads}" == "auto" ]]; then
    THREADS_ARG=""
fi

GPU_ARG="${gpu}"
if [[ "${gpu}" == "auto" ]]; then
    GPU_ARG=""
fi

exec "${MINER}" \
    --pool "${pool}" \
    --wallet "${wallet}" \
    --worker "${worker}" \
    ${GPU_ARG:+--gpu "${GPU_ARG}"} \
    ${THREADS_ARG:+--threads "${THREADS_ARG}"} \
    --algorithm "${algo}" \
    --profile "${profile}" \
    "$@"
