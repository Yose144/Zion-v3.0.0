#!/bin/bash
set -euo pipefail

WALLET_ADDR="zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5"
WORKER_NAME="vega-smos"
export ZION_MINER_ID="vega-smos"

# ── Core miner config ─────────────────────────────────────────────────────
export ZION_GPU_BACKEND="${ZION_GPU_BACKEND:-opencl}"
export ZION_PROFILE="${ZION_PROFILE:-pool}"
export ZION_LOOP_COUNT="${ZION_LOOP_COUNT:-1000000}"
export ZION_VERBOSE=0
export ZION_INTERACTIVE=0
export ZION_NO_STICKY=1
export ZION_METRICS_REPORT_SECS=15
export ZION_STATS_FILE="/tmp/zion-miner-stats.json"

# ── GPU / autotune ────────────────────────────────────────────────────────
export ZION_AUTOTUNE=1
export ZION_AUTOTUNE_SECS=3
export ZION_IGNORE_GPU_SELF_TEST_FAIL=1
export ZION_OCL_BUILD_OPTS="${ZION_OCL_BUILD_OPTS:--cl-std=CL1.2 -cl-mad-enable}"

# Deeksha (ZION) GPU stream
export ZION_MINER_ALGORITHM=deeksha_lite_v1
export ZION_GPU_WORK_SIZE=16384
export ZION_NONCE_AUTOTUNE=1
export ZION_NONCE_COUNT=32768
export ZION_NONCE_COUNT_MIN=16384
export ZION_NONCE_COUNT_MAX=131072
export ZION_GPU_MAX_BATCH=16384
export ZION_GPU_EARLY_BREAK=1
export ZION_GPU_NO_STREAM_BYPRODUCT=1

# ── Triple-stream (ZION GPU + ZANO GPU + VRSC CPU) ───────────────────────────
# ZANO ProgPoWZ on Vega 64 (gfx900/GCN, wave64) needs ds_bpermute disabled and
# a smaller group size to avoid kernel hangs. RDNA1+ can re-enable bpermute.
export ZION_STREAM1_ENABLED=1
export ZION_STREAM2_ENABLED=1
export ZION_STREAM3_ENABLED=1
export ZION_STREAM2_FORCE_COIN=ZANO
export ZION_MINER_CPU_COIN=VRSC
export ZION_EXT_CPU_NONCE_COUNT=2000000

# ZANO / ProgPoWZ tuning for Vega 64 8GB (GCN/wave64)
# Group 128 keeps VGPR pressure low; bpermute enabled for speed.
# Fallback: if it hangs, set USE_BPERMUTE=0 and GROUP_SIZE=128.
export ZION_EXT_GPU_TIME_DUTY_PCT=100
# 1M work size: highest stable ProgPoWZ hashrate on Vega 64 (~9.5 MH/s with bpermute).
export ZION_SECONDARY_GPU_WORK_SIZE=1000000
export ZION_AUXPOW_GPU_WORK_SIZE=1000000
export ZION_AUXPOW_GPU_GROUP_SIZE=128
export ZION_AUXPOW_GPU_USE_BPERMUTE=1
export ZION_AUXPOW_GPU_VRAM_PCT=40
export ZION_AUXPOW_GPU_BYTES_PER_ITEM=64
export ZION_ZANO_STALE_SECS=30

LOCAL_MINER="/tmp/zion-miner-real"
rm -f "${LOCAL_MINER}"

EDGE_BASE="http://62.171.141.136/zion-miner"
echo "[smos-wrapper] downloading real miner binary ..."
rm -f "${LOCAL_MINER}.tmp"
curl --http1.1 --retry 20 --retry-delay 5 --connect-timeout 30 \
     --speed-time 60 --speed-limit 10000 \
     -fsSL -o "${LOCAL_MINER}.tmp" "${EDGE_BASE}/zion-miner" || {
    echo "[smos-wrapper] FATAL: could not download miner binary"
    exit 1
}
chmod +x "${LOCAL_MINER}.tmp"
mv "${LOCAL_MINER}.tmp" "${LOCAL_MINER}"
echo "[smos-wrapper] miner binary ready ($(stat -c%s "${LOCAL_MINER}") bytes)"

echo "[smos-wrapper] starting TRIPLE STREAM: ZION + ZANO + VRSC"
exec "${LOCAL_MINER}" --pool "${ZION_POOL_ADDR:-62.171.141.136:8444}" \
  --wallet "${WALLET_ADDR}" \
  --worker "${WORKER_NAME}" \
  --profile "${ZION_PROFILE}" \
  "$@"
