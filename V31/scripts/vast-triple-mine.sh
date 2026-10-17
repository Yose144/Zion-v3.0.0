#!/bin/bash
# Triple mining on vast.ai RTX 3060 (SM86) — EVERYTHING through zion pool :8444,
# single miner process, three GPU streams inside zion-miner:
#   ZION — stream1 (deeksha CUDA-lite)
#   PRL  — stream2 (pearl PoUW CUDA kernel, k=2048) → V3 PearlSubmit
#          (pool serves native pearld ~10% + LuckyPool prlu: ~90%)
#   QTU  — stream4 (native qpow_cuda) → V3 → pool QTU bridge
#          (pool serves native qtun: ~10% + lproute upstream ~90%)
# No SRBMiner sidecar — GPU timeshared across the three streams via
# per-stream duty knobs (EXT_GPU2 = stream4 override).
# See docs/3.2/PEARL-POUW-INTEGRATION.md §15 for benchmarks + gotchas
# (OpenCL ICD + cuda-nvrtc required on a clean box!).
set -uo pipefail
cd "$(dirname "$0")"

EDGE_BASE="http://62.171.141.136/zion-miner"
WALLET_ADDR="zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6"
WORKER="${WORKER_NAME:-vast-3060}"
POOL="${ZION_POOL_ADDR:-62.171.141.136:8444}"

echo "[triple] downloading binaries ..."
curl --http1.1 --retry 10 --retry-delay 5 --connect-timeout 20 -fsSL \
     -o zion-miner.tmp "${EDGE_BASE}/zion-miner-v31-cuda" || { echo "FATAL zion-miner dl"; exit 1; }
chmod +x zion-miner.tmp && mv zion-miner.tmp zion-miner
echo "[triple] binary ready: zion-miner $(stat -c%s zion-miner)B"
md5sum zion-miner

# ── zion-miner env (mirrors teamredminer-zion-trinity-srb-v1.7, NVIDIA path) ──
export ZION_MINER_ID="${WORKER}"
export ZION_GPU_BACKEND=cuda
export ZION_PROFILE=pool
export ZION_VERBOSE=1
export ZION_INTERACTIVE=0
export ZION_NO_STICKY=1
export ZION_LOG_INTERVAL=15
export ZION_STATS_FILE="/root/zion-miner-stats.json"
export ZION_V3_TRINITY=1
export ZION_AUTOTUNE=1
export ZION_AUTOTUNE_SECS=3
export ZION_IGNORE_GPU_SELF_TEST_FAIL=1
export ZION_OCL_BUILD_OPTS="-cl-std=CL1.2 -cl-mad-enable"
export ZION_MINER_ALGORITHM=ekam_deeksha
export ZION_GPU_WORK_SIZE=8192
export ZION_NONCE_AUTOTUNE=1
export ZION_NONCE_COUNT=262144
export ZION_NONCE_COUNT_MIN=65536
export ZION_NONCE_COUNT_MAX=524288
export ZION_GPU_MAX_BATCH=262144
export ZION_GPU_EARLY_BREAK=0
export ZION_GPU_NO_STREAM_BYPRODUCT=1
# streams: 1=ZION, 2=PRL (pearl PoUW), 3=off, 4=QTU (native qpow_cuda)
export ZION_STREAM1_ENABLED=1
export ZION_STREAM2_ENABLED=1
export ZION_STREAM2_FORCE_COIN=PRL
export ZION_PEARL_K=2048
# attempts queued per spawn on the CUDA batch path (on-device seed derive +
# async queueing — see PEARL-OPTIMIZATION.md); 1 = legacy per-attempt mode
export ZION_PEARL_BATCH=16
export ZION_STREAM2_BATCH=8388608
export ZION_STREAM3_ENABLED=0
export ZION_STREAM4_ENABLED=1
export ZION_STREAM4_FORCE_COIN=QTU
export ZION_QPOW_BACKEND=cuda
# GPU split ~ 5 / 35 / 60 (ZION / PRL / QTU): each stream self-sleeps
# batch*(100-duty)/duty after its GPU batch; QTU dominates the card.
export ZION_GPU_TIME_DUTY_PCT=5
export ZION_EXT_GPU_TIME_DUTY_PCT=35
export ZION_EXT_GPU2_TIME_DUTY_PCT=60
export ZION_EXT_GPU_GAP_MS=0
export ZION_EXT_GPU_MAX_GAP_MS=5000
export ZION_MINER_THREADS=4

exec ./zion-miner \
  --pool "${POOL}" \
  --wallet "${WALLET_ADDR}" \
  --worker "${WORKER}" \
  --gpu cuda \
  --threads 4 \
  --log-interval 15 \
  --v3-trinity
