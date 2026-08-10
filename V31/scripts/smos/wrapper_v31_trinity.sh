#!/bin/bash
set -euo pipefail

# ── V31 Trinity Miner Wrapper for SMOS ──────────────────────────────────────
# Triple-stream: ZION (GPU) + ZANO (GPU AuxPoW) + VRSC (CPU AuxPoW)
# Multi-GPU parallel: BOTH GPUs mine BOTH ZION Deeksha and ZANO ProgPoW.
# VRSC stays CPU-only (Stream 3).
# V3 Trinity architecture: single V3 protocol connection to ZION pool.
# Pool embeds external_stream jobs and forwards AuxPoW shares to external pools.
# All revenue flows through the pool's AuxPoW bridge and revenue system.
# Date: 2026-08-10 (V3.2 Trinity multi-GPU parallel)

# Pool wallet — miner uses this for ZION coinbase. Pool handles ZANO/VRSC wallets.
WALLET_ADDR="zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5"
WORKER_NAME="vega-smos"
export ZION_MINER_ID="vega-smos"

# ── Core miner config ─────────────────────────────────────────────────────
export ZION_GPU_BACKEND="${ZION_GPU_BACKEND:-opencl}"
export ZION_PROFILE="${ZION_PROFILE:-pool}"
export ZION_VERBOSE=1
export ZION_INTERACTIVE=1
export ZION_NO_STICKY=1
export ZION_METRICS_REPORT_SECS=15
export ZION_STATS_FILE="/tmp/zion-miner-stats.json"

# ── V3 Trinity mode ────────────────────────────────────────────────────────
# All 3 streams through a single V3 protocol connection to the pool.
# The pool distributes ZANO (GPU) and VRSC (CPU) jobs via external_stream fields.
export ZION_V3_TRINITY=1

# ── GPU / autotune ────────────────────────────────────────────────────────
export ZION_AUTOTUNE=1
export ZION_AUTOTUNE_SECS=3
export ZION_IGNORE_GPU_SELF_TEST_FAIL=1
export ZION_NO_GCN_S4_MODE=1
export ZION_OCL_BUILD_OPTS="${ZION_OCL_BUILD_OPTS:--cl-std=CL1.2 -cl-mad-enable}"

# Deeksha (ZION) GPU stream — reduced work_size so both GPUs can host ZION
# AND the ZANO ProgPoW DAG (~2 GB at current epoch) in their VRAM.
# Vega 8 GB → OK, RX 5600 6 GB → tight, needs 2 GB ZION scratchpad + 2 GB DAG.
export ZION_MINER_ALGORITHM=deeksha_lite_v1
export ZION_GPU_WORK_SIZE=4096
export ZION_NONCE_AUTOTUNE=1
export ZION_NONCE_COUNT=8192
export ZION_NONCE_COUNT_MIN=8192
export ZION_NONCE_COUNT_MAX=8192
export ZION_GPU_MAX_BATCH=65536
export ZION_GPU_EARLY_BREAK=0
export ZION_GPU_NO_STREAM_BYPRODUCT=1

# ── Triple-stream config ──────────────────────────────────────────────────
# In V3 Trinity mode, the pool decides which coins to send based on its
# auxpow_runtime configuration (ZANO + VRSC). No direct stream URLs needed.
export ZION_STREAM1_ENABLED=1
export ZION_STREAM2_ENABLED=1
export ZION_STREAM3_ENABLED=1

# GPU AuxPoW tuning (ZANO ProgPoWZ — GPU time-slicing with Stream 1)
# Stream 2 uses GPU with burst/gap duty-cycle: runs batch, then sleeps
# gap_ms to yield GPU to Stream 1 (ZION deeksha). This mirrors the V3
# reference external_gpu_thread architecture.
export ZION_STREAM2_BATCH=262144
export ZION_AUXPOW_GPU_WORK_SIZE=1048576
export ZION_AUXPOW_GPU_GROUP_SIZE=128
export ZION_AUXPOW_GPU_VRAM_PCT=50
export ZION_AUXPOW_GPU_BYTES_PER_ITEM=64

# Multi-GPU parallel mode: both GPUs mine ZION and ZANO, VRSC is CPU only.
# ZION_ZANO_RESERVE=0 disables device reservation so MultiGpuMiner uses all
# OpenCL GPUs for both the ZION Deeksha and ZANO ProgPoW streams.
# gap_ms > 0 is required: external ProgPoW must yield the GPU to ZION Deeksha.
export ZION_ZANO_RESERVE=0
export ZION_EXT_GPU_TIME_DUTY_PCT=50
export ZION_EXT_GPU_GAP_MS=1000
export ZION_EXT_GPU_MAX_GAP_MS=5000

# CPU AuxPoW tuning (VRSC VerusHash — pool sends jobs, miner mines)
export ZION_STREAM3_BATCH=2000000
export ZION_EXT_CPU_NONCE_COUNT=2000000
export ZION_MINER_THREADS=4

# ── Download V31 miner binary ─────────────────────────────────────────────
LOCAL_MINER="/tmp/zion-miner-v31"
rm -f "${LOCAL_MINER}"

EDGE_BASE="http://62.171.141.136/zion-miner"
echo "[smos-wrapper] downloading V31 miner binary ..."
rm -f "${LOCAL_MINER}.tmp"
curl --http1.1 --retry 20 --retry-delay 5 --connect-timeout 30 \
     --speed-time 60 --speed-limit 10000 \
     -fsSL -o "${LOCAL_MINER}.tmp" "${EDGE_BASE}/zion-miner-v31" || {
    echo "[smos-wrapper] FATAL: could not download V31 miner binary"
    exit 1
}
chmod +x "${LOCAL_MINER}.tmp"
mv "${LOCAL_MINER}.tmp" "${LOCAL_MINER}"
echo "[smos-wrapper] V31 miner binary ready ($(stat -c%s "${LOCAL_MINER}") bytes)"

echo "[smos-wrapper] starting V3 TRINITY multi-GPU parallel: 2x ZION + 2x ZANO + VRSC CPU"
exec "${LOCAL_MINER}" \
  --pool "${ZION_POOL_ADDR:-62.171.141.136:8444}" \
  --wallet "${WALLET_ADDR}" \
  --worker "${WORKER_NAME}" \
  --gpu "${ZION_GPU_BACKEND}" \
  --threads "${ZION_MINER_THREADS}" \
  --v3-trinity \
  "$@"
