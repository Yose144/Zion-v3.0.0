#!/usr/bin/env bash
# ZION V3 — Start Miner with log redirect
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

export ZION_POOL_ADDR='127.0.0.1:8444'
export ZION_LOOP_COUNT='1000000'
export ZION_MINER_THREADS='4'
export ZION_WORKER_NAME='worker1'
export ZION_MINER_ID='w11-gpu-miner-01'
export ZION_GPU_BACKEND='opencl'
export ZION_GPU_WORK_SIZE='4096'

MINER_EXE="$REPO_ROOT/V3/target/release/zion-miner"
if [[ ! -x "$MINER_EXE" ]]; then
    echo "[ERROR] Miner binary not found: $MINER_EXE"
    echo "        Run Install / Build first."
    exit 1
fi

nohup "$MINER_EXE" > "$LOG_DIR/miner.log" 2> "$LOG_DIR/miner.err" &
echo $! > "$LOG_DIR/miner.pid"
echo "Started Miner  PID=$!"
