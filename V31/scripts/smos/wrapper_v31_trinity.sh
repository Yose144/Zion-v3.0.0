#!/bin/bash
set -euo pipefail

# ── SMOS arg passthrough ────────────────────────────────────────────────────
# minerOptions tokens after the zip URL land in "$@".  Tokens shaped
# ZION_*=VALUE / RUST_*=VALUE become env overrides (applied before the config
# block so ${VAR:-default} expansion sees them); anything else is forwarded to
# the miner binary as a CLI arg.
passthru_args=()
for arg in "$@"; do
  case "$arg" in
    ZION_*=*|RUST_*=*) export "$arg" ;;
    *) passthru_args+=("$arg") ;;
  esac
done
set -- "${passthru_args[@]+"${passthru_args[@]}"}"

# ── V31 Trinity Miner Wrapper for SMOS ──────────────────────────────────────
# Triple-stream: ZION (GPU) + QTU/QPoW (GPU AuxPoW) + VRSC (CPU AuxPoW)
# Multi-GPU DEDICATED: RX 5600 XT → ZION Deeksha, Vega 64 → QTU Poseidon2.
# Both GPUs at 100% load, no time-slicing, no OpenCL context contention.
# VRSC on CPU (Stream 3). Max performance: 1x ZION + 1x QTU + 1x VRSC.
# NOTE: PARALLEL mode (RESERVE=0, both GPUs both coins) tested 2026-08-10 —
# 1000x slower ext due to OpenCL context contention on AMD driver.
# DEDICATED mode is optimal for AMD multi-GPU.
# V3 Trinity architecture: single V3 protocol connection to ZION pool.
# Pool embeds external_stream jobs and forwards AuxPoW shares to external pools.
# All revenue flows through the pool's AuxPoW bridge and revenue system.
# QPoW OpenCL backend: commit 789d30e02 (poseidon2_kernel.cl, bit-exact vs
# CPU reference on hash-1/hash/hash+1 boundaries incl. nonzero nonces).
# Rollback to ZANO: flip ZION_STREAM2_FORCE_COIN back to ZANO.
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
# sgminer/TRM-compatible stats API (built into zion-miner) — SMOS polls this
# for packages named teamredminer-*.zip: 4028 = primary (QTU), 4029 = dual (ZION).
export ZION_API_ADDR="${ZION_API_ADDR:-127.0.0.1:4028}"
export ZION_API_ADDR_DUAL="${ZION_API_ADDR_DUAL:-127.0.0.1:4029}"

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
export ZION_MINER_ALGORITHM=ekam_deeksha
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

# GPU AuxPoW tuning — QTU QPoW (Poseidon2-Goldilocks) on the reserved Vega.
# ZION_STREAM2_BATCH doubles as the QPoW launch size (nonces per kernel
# dispatch). 4M ≈ ~1 s/launch on Vega-class GPUs; keep low enough that a
# new job doesn't wait long on the in-flight batch.
export ZION_STREAM2_BATCH=4194304
export ZION_STREAM2_FORCE_COIN=QTU
# QPoW OpenCL work partitioning (gfx900 wave64): one wavefront per group,
# 1 nonce per work-item — the 12-lane u64 sponge is register-hungry on GCN.
export ZION_QPOW_OCL_LOCAL_SIZE="${ZION_QPOW_OCL_LOCAL_SIZE:-64}"
export ZION_QPOW_OCL_NPT="${ZION_QPOW_OCL_NPT:-1}"
# ProgPoW-era knobs kept for instant ZANO rollback — unused by QPoW.
export ZION_AUXPOW_GPU_WORK_SIZE=1048576
export ZION_AUXPOW_GPU_GROUP_SIZE=128
export ZION_AUXPOW_GPU_VRAM_PCT=50
export ZION_AUXPOW_GPU_BYTES_PER_ITEM=64
export ZION_AUXPOW_PROGPOW_MAX_GWS=1048576
export ZION_ZANO_STALE_SECS=30

# Multi-GPU SHARED mode (ZION_ZANO_RESERVE=0): BOTH GPUs run BOTH streams —
# ZION Deeksha on Vega+5600 XT via MultiGpuMiner, QTU QPoW on both via
# QpowGpuMiner::Multi (one kernel launch per device per batch). The driver
# timeshares the two kernel queues on each card; a small ext gap lets
# ZION launches stay fair.
# ZION_ZANO_DEVICE_NAME is ignored with RESERVE=0 (kept for rollback docs).
export ZION_ZANO_RESERVE=0
export ZION_ZANO_DEVICE_NAME=vega
# 100 = QPoW free contention; <100 yields GPU time to ZION per batch
# (gap = batch_ms*(100-duty)/duty). Tune via minerOptions, e.g. "60".
export ZION_EXT_GPU_TIME_DUTY_PCT="${ZION_EXT_GPU_TIME_DUTY_PCT:-100}"
export ZION_EXT_GPU_GAP_MS="${ZION_EXT_GPU_GAP_MS:-0}"
export ZION_EXT_GPU_MAX_GAP_MS="${ZION_EXT_GPU_MAX_GAP_MS:-0}"

# CPU AuxPoW tuning (VRSC VerusHash — pool sends jobs, miner mines)
# Pentium G4560: 2C/4T @ 3.5GHz. 4 threads = max (hyperthreading).
# 2M batch is optimal — 4M caused stale share rejects (VRSC block time ~60s).
export ZION_MINER_CPU_COIN=VRSC
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

# ── SMOS stats API (sgminer/TRM-compatible) ──────────────────────────────────
# Two providers race for the port — whichever binds first serves SMOS:
#   1. smos_api.py sidecar (python3, reads ZION_STATS_FILE) — proven on rig
#   2. built-in zion-miner API (ZION_API_ADDR) — binds second, else warns only
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIDECAR_PID=""
if command -v python3 >/dev/null 2>&1 && [ -f "${SCRIPT_DIR}/smos_api.py" ]; then
  ZION_STATS_FILE="${ZION_STATS_FILE}" python3 "${SCRIPT_DIR}/smos_api.py" 2>&1 &
  SIDECAR_PID=$!
  echo "[smos-wrapper] stats API sidecar started (pid ${SIDECAR_PID})"
fi
echo "[smos-wrapper] API listening on ${ZION_API_ADDR} (dual ${ZION_API_ADDR_DUAL})"
echo "[smos-wrapper] starting V3 TRINITY multi-GPU DEDICATED: RX5600→ZION + Vega→QTU + VRSC CPU"

# Foreground miner + signal forwarding (SMOS stops the script, not the miner).
MINER_PID=""
_term() { [ -n "${MINER_PID}" ] && kill -TERM "${MINER_PID}" 2>/dev/null || true; }
trap '_term' TERM INT

"${LOCAL_MINER}" \
  --pool "${ZION_POOL_ADDR:-62.171.141.136:8444}" \
  --wallet "${WALLET_ADDR}" \
  --worker "${WORKER_NAME}" \
  --gpu "${ZION_GPU_BACKEND}" \
  --threads "${ZION_MINER_THREADS}" \
  --v3-trinity \
  "$@" &
MINER_PID=$!
wait "${MINER_PID}"
STATUS=$?
[ -n "${SIDECAR_PID:-}" ] && kill "${SIDECAR_PID}" 2>/dev/null || true
exit "${STATUS}"
