#!/usr/bin/env bash
# ============================================================================
#  ZION GPU Miner — background launcher (for start-all or manual use)
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

mkdir -p logs

export ZION_POOL_ADDR='100.76.16.108:8444'
export ZION_LOOP_COUNT='1000000'
export ZION_WORKER_NAME='worker1'
export ZION_MINER_ID='ubuntu-gpu-miner-01'
export ZION_PAYOUT_ADDRESS='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'
export ZION_MINER_ALGORITHM='deeksha_lite_fire'
export ZION_GPU_BACKEND='opencl'
export ZION_MINER_THREADS='1'
export ZION_GPU_WORK_SIZE='4096'
export ZION_NONCE_COUNT='4096'

nohup "${REPO_ROOT}/V3/target/release/zion-miner" >> "${REPO_ROOT}/logs/miner.log" 2>&1 &
PID=$!
echo "[OK] Miner started  PID=$PID  Pool 100.76.16.108:8444  ALGO=${ZION_MINER_ALGORITHM}"
