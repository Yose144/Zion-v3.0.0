#!/usr/bin/env bash
# ============================================================================
#  ZION GPU Miner — RESTART (foreground, no log file)
#  Use for manual restart / debugging.
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

mkdir -p logs

# ── Stop any running miner ───────────────────────────────────────────────────
MINER_PIDS=$(pgrep -f "zion-miner" || true)
if [[ -n "$MINER_PIDS" ]]; then
    echo "[STOP] Killing existing miner(s): $MINER_PIDS"
    echo "$MINER_PIDS" | xargs kill 2>/dev/null || true
    sleep 2
fi

# ── Network ─────────────────────────────────────────────────────────────────
export ZION_POOL_ADDR='62.171.141.136:8444'
export ZION_LOOP_COUNT='1000000'
export ZION_WORKER_NAME='worker1'
export ZION_MINER_ID='ubuntu-gpu-miner-01'
export ZION_PAYOUT_ADDRESS='zion1k603m783j2w0l45506e0t4v7a797t7l0d78l3m2'

# ── Algorithm ───────────────────────────────────────────────────────────────
export ZION_MINER_ALGORITHM='deeksha_lite_fire'

# ── GPU (OpenCL) ────────────────────────────────────────────────────────────
export ZION_GPU_BACKEND='opencl'
export ZION_MINER_THREADS='1'
export ZION_GPU_WORK_SIZE='4096'
export ZION_NONCE_COUNT='4096'

echo "[START] Miner starting at $(date +%H:%M:%S)"
echo "[ENV]   POOL=${ZION_POOL_ADDR}  ALGO=${ZION_MINER_ALGORITHM}  BACKEND=${ZION_GPU_BACKEND}  WORK_SIZE=${ZION_GPU_WORK_SIZE}"
echo ""

exec "${REPO_ROOT}/V3/target/release/zion-miner"
