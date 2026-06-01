#!/usr/bin/env bash
# ZION V3 — Start Miner with GPU backend (OpenCL on Linux, Metal on macOS)
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

export ZION_POOL_ADDR="${ZION_POOL_ADDR:-127.0.0.1:8444}"
export ZION_LOOP_COUNT="${ZION_LOOP_COUNT:-1000000}"
export ZION_MINER_THREADS="${ZION_MINER_THREADS:-2}"
export ZION_WORKER_NAME="${ZION_WORKER_NAME:-worker1}"
export ZION_MINER_ID="${ZION_MINER_ID:-${ZION_OS}-gpu-miner-01}"
export ZION_GPU_BACKEND="${ZION_GPU_BACKEND:-$(default_gpu_backend)}"
export ZION_GPU_WORK_SIZE="${ZION_GPU_WORK_SIZE:-4096}"

MINER_EXE="$(find_exe zion-miner)" || { zlog "[ERROR] zion-miner not built. Run Install / Build first."; exit 1; }
zlog "GPU backend: $ZION_GPU_BACKEND"
start_bg "miner" "$MINER_EXE" >/dev/null
