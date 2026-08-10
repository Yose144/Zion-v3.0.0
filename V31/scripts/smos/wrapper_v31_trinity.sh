#!/bin/bash
set -euo pipefail

# ── V31 Trinity Miner Wrapper for SMOS ──────────────────────────────────────
# Triple-stream: ZION (GPU) + ZANO (GPU AuxPoW) + VRSC (CPU AuxPoW)
# Multi-GPU DEDICATED: RX 5600 XT → ZION Deeksha, Vega 64 → ZANO ProgPoWZ.
# Both GPUs at 100% load, no time-slicing, no OpenCL context contention.
# VRSC on CPU (Stream 3). Max performance: 1x ZION + 1x ZANO + 1x VRSC.
# NOTE: PARALLEL mode (RESERVE=0, both GPUs both coins) tested 2026-08-10 —
# 1000x slower ZANO due to OpenCL context contention on AMD driver.
# DEDICATED mode is optimal for AMD multi-GPU.
# V3 Trinity architecture: single V3 protocol connection to ZION pool.
# Pool embeds external_stream jobs and forwards AuxPoW shares to external pools.
# All revenue flows through the pool's AuxPoW bridge and revenue system.
# Date: 2026-08-10 (V3.2 Trinity multi-GPU DEDICATED, max performance)

# Pool wallet — miner uses this for ZION coinbase. Pool handles ZANO/VRSC wallets.
WALLET_ADDR="zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6"
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
# NOTE: Do NOT set ZION_NO_GCN_S4_MODE — s4_mode is the default and REQUIRED
# for Vega 64 (GCN/gfx900).  Forcing full GPU pipeline on GCN produces 0%
# accepted shares due to compiler bugs in NPU/fusion stages (stages 5-6).
# See docs/3.0.1Genesis/VEGA64_S4_MEMHARD_DEBUG_GUIDE.md
# RX 5600 XT (RDNA1/gfx1010) uses full GPU pipeline by default (not GCN).
export ZION_OCL_BUILD_OPTS="${ZION_OCL_BUILD_OPTS:--cl-std=CL1.2 -cl-mad-enable}"

# Deeksha (ZION) GPU stream — work_size=8192 (RDNA1 cap, GCN auto-caps to 4096).
# Auto-tune per-device: Vega 64 (GCN) → 4096, RX 5600 XT (RDNA1) → 8192.
# LOCAL_SIZE=128 for RDNA1 (optimal for 512KB scratchpad, 2 WGs per CU).
# GCN needs 64 (wave64). Auto-tune handles this per-device.
# See docs/3.0.1Genesis/VEGA64_S4_MEMHARD_DEBUG_GUIDE.md (work size table)
# See docs/3.0.6/VEGA_SMOS_DUAL_GPU_REPORT.md (v90 config)
export ZION_MINER_ALGORITHM=deeksha_lite_v1
export ZION_GPU_WORK_SIZE=8192
export ZION_NONCE_AUTOTUNE=1
export ZION_NONCE_COUNT=262144
export ZION_NONCE_COUNT_MIN=65536
export ZION_NONCE_COUNT_MAX=524288
export ZION_GPU_MAX_BATCH=262144
export ZION_GPU_EARLY_BREAK=0
export ZION_GPU_NO_STREAM_BYPRODUCT=1

# ── Triple-stream config ──────────────────────────────────────────────────
# In V3 Trinity mode, the pool decides which coins to send based on its
# auxpow_runtime configuration (ZANO + VRSC). No direct stream URLs needed.
export ZION_STREAM1_ENABLED=1
export ZION_STREAM2_ENABLED=1
export ZION_STREAM3_ENABLED=1

# GPU AuxPoW tuning (ZANO ProgPoWZ)
# DEDICATED mode: Vega 64 exclusively mines ZANO ProgPoWZ.
# GWS cap: 524288 (512K) — Vega 64 has 64 CUs, 524288/128 = 4096 WGs,
# 4096/64 = 64 WGs per CU. Safe from amdgpu TTD (timeout detection) since
# dedicated GPU has no ZION contention. Was 262144 (conservative for parallel).
# Vega 64 (GCN): GROUP_SIZE=128, bpermute auto-disabled (GCN-safe)
export ZION_STREAM2_BATCH=4194304
export ZION_STREAM2_FORCE_COIN=ZANO
export ZION_AUXPOW_GPU_WORK_SIZE=1048576
export ZION_AUXPOW_GPU_GROUP_SIZE=128
export ZION_AUXPOW_GPU_VRAM_PCT=50
export ZION_AUXPOW_GPU_BYTES_PER_ITEM=64
export ZION_AUXPOW_PROGPOW_MAX_GWS=524288
export ZION_ZANO_STALE_SECS=30

# Multi-GPU DEDICATED mode: Vega 64 reserved for ZANO ProgPoWZ,
# RX 5600 XT dedicated to ZION Deeksha. Both at 100%, no time-slicing.
# ZION_ZANO_RESERVE=1: reserve Vega 64 for ZANO (no OpenCL context contention).
# GAP_MS=0: no sleep needed — GPUs are dedicated, not shared.
export ZION_ZANO_RESERVE=1
export ZION_ZANO_DEVICE_NAME=vega
export ZION_EXT_GPU_TIME_DUTY_PCT=100
export ZION_EXT_GPU_GAP_MS=0
export ZION_EXT_GPU_MAX_GAP_MS=0

# CPU AuxPoW tuning (VRSC VerusHash — pool sends jobs, miner mines)
# Pentium G4560: 2C/4T @ 3.5GHz. 4 threads = max (hyperthreading).
# Larger batch = less host overhead, CPU can pre-compute more nonces.
export ZION_MINER_CPU_COIN=VRSC
export ZION_STREAM3_BATCH=4000000
export ZION_EXT_CPU_NONCE_COUNT=4000000
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

echo "[smos-wrapper] starting V3 TRINITY multi-GPU DEDICATED: RX5600→ZION + Vega→ZANO + VRSC CPU"
exec "${LOCAL_MINER}" \
  --pool "${ZION_POOL_ADDR:-62.171.141.136:8444}" \
  --wallet "${WALLET_ADDR}" \
  --worker "${WORKER_NAME}" \
  --gpu "${ZION_GPU_BACKEND}" \
  --threads "${ZION_MINER_THREADS}" \
  --v3-trinity \
  "$@"
