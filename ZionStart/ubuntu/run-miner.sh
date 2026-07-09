#!/usr/bin/env bash
# ============================================================================
#  ZION GPU Miner — main launcher (Edge pool, OpenCL)
#
#  Algorithms:
#    deeksha_lite_v1           (default)  256 KiB scratchpad
#    deeksha_lite_fire                    256 KiB scratchpad, thermal
#    cosmic_harmony_ekam_deeksha_v2       original multi-phase hash
#
#  To change algorithm, edit ZION_MINER_ALGORITHM below.
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

mkdir -p logs

# ── Network ─────────────────────────────────────────────────────────────────
export ZION_POOL_ADDR='62.171.141.136:8444'
export ZION_LOOP_COUNT='1000000'

# ── Miner identity ──────────────────────────────────────────────────────────
export ZION_WORKER_NAME='worker1'
export ZION_MINER_ID='ubuntu-gpu-miner-01'
export ZION_PAYOUT_ADDRESS='zion1k603m783j2w0l45506e0t4v7a797t7l0d78l3m2'

# ── Algorithm ───────────────────────────────────────────────────────────────
export ZION_MINER_ALGORITHM='deeksha_lite_fire'

# ── GPU (OpenCL) ─────────────────────────────────────────────────────────────
export ZION_GPU_BACKEND='opencl'
export ZION_MINER_THREADS='1'
export ZION_GPU_WORK_SIZE='4096'
export ZION_NONCE_COUNT='4096'

echo "==========================================================="
echo "  ZION GPU Miner :: ${ZION_POOL_ADDR}"
echo "  Algorithm : ${ZION_MINER_ALGORITHM}"
echo "  Backend   : ${ZION_GPU_BACKEND}   WorkSize: ${ZION_GPU_WORK_SIZE}"
echo "  Payout    : ${ZION_PAYOUT_ADDRESS}"
echo "==========================================================="
echo ""

"${REPO_ROOT}/V3/target/release/zion-miner" >> "${REPO_ROOT}/logs/miner.log" 2>&1

echo "[EXIT] Miner exited with code $? at $(date +%H:%M:%S)"
read -r -p "Press ENTER to close..."
