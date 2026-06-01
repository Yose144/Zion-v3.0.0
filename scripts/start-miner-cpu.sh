#!/usr/bin/env bash
# ZION V3 — Start Miner with CPU backend (env overrides honoured)
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

export ZION_POOL_ADDR="${ZION_POOL_ADDR:-127.0.0.1:8444}"
export ZION_LOOP_COUNT="${ZION_LOOP_COUNT:-1000000}"
export ZION_MINER_THREADS="${ZION_MINER_THREADS:-4}"
export ZION_WORKER_NAME="${ZION_WORKER_NAME:-worker1}"
export ZION_MINER_ID="${ZION_MINER_ID:-${ZION_OS}-cpu-miner-01}"
export ZION_GPU_BACKEND="cpu"   # CPU only — miner skips GPU init

MINER_EXE="$(find_exe zion-miner)" || { zlog "[ERROR] zion-miner not built. Run Install / Build first."; exit 1; }
start_bg "miner" "$MINER_EXE" >/dev/null
