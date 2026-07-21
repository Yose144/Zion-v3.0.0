#!/usr/bin/env bash
# ============================================================================
#  ZION V3 Miner — Triple Stream + Autotune Launcher
#  Spustí miner s autotune (vybere nejlepší algoritmus) + triple stream.
#  Wallet se načte z nejnovejsi zalohy na plose.
# ============================================================================

set -euo pipefail

REPO_ROOT="/home/zionserver/2.9.6-main"
MINER_BIN="${REPO_ROOT}/V3/target/release/zion-miner"
DESKTOP_BIN="${HOME}/Desktop/zion-miner"

# ── Pool & defaults ────────────────────────────────────────────────────────
ZION_POOL_ADDR="${ZION_POOL_ADDR:-62.171.141.136:8444}"
ZION_MINER_WORKER="${ZION_MINER_WORKER:-local-gpu}"
ZION_MINER_LOOPS="${ZION_MINER_LOOPS:-999999}"

# ── Interactive TUI (pro-style dashboard) ───────────────────────────────────
export ZION_INTERACTIVE="${ZION_INTERACTIVE:-1}"
export ZION_TUI_WIDTH="${ZION_TUI_WIDTH:-60}"

# ── Triple-Stream tuning ────────────────────────────────────────────────────
# Hardware autotuning is now built into the miner binary!
# The miner auto-detects GPU CUs, VRAM, CPU vendor/model, physical/logical cores,
# and RAM, then computes optimal work sizes, thread count, AND nonce batch size.
# No manual tuning needed — works on AMD Zen, Intel, Apple Silicon, and other CPUs.
#
# Formula (benchmark-derived):
#   gpu_work_size      = nearest_pow2(CUs * 512), clamped [1024, 65536]
#   secondary_gpu_ws   = clamp(VRAM_MiB * 0.75 / 1024, 1, 8) * 1M
#   threads            = auto-tuned per CPU arch (AmdZen: all logical, Intel: all logical,
#                        Apple: physical-1 if GPU, Other: physical only)
#   nonce_count        = auto-tuned (5M if ≥8T, 2M if ≥4T, 1M else)
#
# To override: set ZION_THREADS, ZION_EXT_CPU_NONCE_COUNT, ZION_GPU_WORK_SIZE, etc.
# To disable autotune: set ZION_AUTOTUNE=0
export ZION_AUTOTUNE="${ZION_AUTOTUNE:-1}"
export ZION_STREAM1_ENABLED="${ZION_STREAM1_ENABLED:-1}"
# Stream 2 (GPU external) — ZANO (ProgPoWZ, DAG ~2.5 GB).
# Fits in 6 GB VRAM alongside deeksha (~2 GB scratchpad): ~4.5 GB total.
# KawPow (RVN) was 5.6 GB and OOM'd — ZANO is much smaller.
# ZION_STREAM2_FORCE_COIN pins Stream 2 to ZANO regardless of autonomous router.
export ZION_STREAM2_ENABLED="${ZION_STREAM2_ENABLED:-1}"
export ZION_STREAM2_FORCE_COIN="${ZION_STREAM2_FORCE_COIN:-ZANO}"
export ZION_STREAM3_ENABLED="${ZION_STREAM3_ENABLED:-1}"
export ZION_METRICS_REPORT_SECS="${ZION_METRICS_REPORT_SECS:-15}"
export ZION_STATS_FILE="${ZION_STATS_FILE:-/tmp/zion-miner-stats.json}"

# ── Autonomous profit routing ────────────────────────────────────────────────
# When ZION_AUTONOMOUS=1, the miner auto-selects the most profitable compatible
# coins for Stream 2 (GPU) and Stream 3 (CPU) based on:
#   - Hardware compatibility (VRAM size, CPU features, kernel availability)
#   - Live profitability data (revenue - electricity cost)
#   - Hysteresis (only switches if new coin is >15% more profitable)
#
# Env vars:
#   ZION_AUTONOMOUS=1          — enable autonomous mode
#   ZION_ELECTRICITY_PRICE=0.12 — USD per kWh (default: 0.12)
#   ZION_PROFIT_INTERVAL=300    — re-evaluation interval in seconds (default: 300 = 5 min)
#   ZION_PROFIT_HYSTERESIS=15   — only switch if new coin is X% more profitable (default: 15)
#
# Usage: ./Start.sh --autonomous
if [[ "${1:-}" == "--autonomous" || "${ZION_AUTONOMOUS:-0}" == "1" ]]; then
    export ZION_AUTONOMOUS=1
    export ZION_STREAM2_ENABLED=1  # Autonomous router will filter by VRAM compat
    export ZION_ELECTRICITY_PRICE="${ZION_ELECTRICITY_PRICE:-0.12}"
    export ZION_PROFIT_INTERVAL="${ZION_PROFIT_INTERVAL:-300}"
    export ZION_PROFIT_HYSTERESIS="${ZION_PROFIT_HYSTERESIS:-15}"
    echo "[AUTONOMOUS] Autonomous profit routing enabled"
fi
# VRSC/VerusHash nonce batch size — now auto-tuned by CPU profile.
# Override only if you want to experiment. Auto-tune picks 5M for 12-thread Ryzen.
# Smaller batches (2M) make the ext_cpu_thread check for new VRSC jobs more
# frequently, reducing stale-share rejections from LuckPool ("job not found").
# With 6 threads at ~5 MH/s, 2M nonces takes ~0.4s per scan vs ~2s for 10M.
export ZION_EXT_CPU_NONCE_COUNT="${ZION_EXT_CPU_NONCE_COUNT:-2000000}"

# ── CPU external coin (Stream 3) ───────────────────────────────────────────
# VRSC (VerusHash v2.2) — LuckPool, ASIC/GPU-resistant, PBaaS merge mining.
# Pool already has VRSC bridge active (ZION_POOL_AUXPOW_CPU_COIN=VRSC).
# Alternatives: XMR (RandomX, MoneroOcean), RTM (GhostRider, ZPool).
export ZION_MINER_CPU_COIN="${ZION_MINER_CPU_COIN:-VRSC}"

# ── Autotune: GPU memory budget auto-tune is always ON.
#  Algorithm: deeksha_lite_v1 (pool sends deeksha_lite_v1 job headers — other
#  deeksha variants like chv3 cannot find ZION blocks because the pool fixes
#  the algorithm to deeksha_lite_v1 in the job template).
#  Benchmark results on RX 5700 XT: deeksha_chv3=35.5 KH/s, deeksha_lite_fire=34.1 KH/s,
#  deeksha_lite_v1=37 KH/s (real-world, with optimized batching).
#  To re-benchmark: zion-miner --gpu-benchmark-all
export ZION_MINER_ALGORITHM="${ZION_MINER_ALGORITHM:-deeksha_lite_v1}"
export ZION_AUTOTUNE_SECS="${ZION_AUTOTUNE_SECS:-3}"

# ── GPU duty-cycle: 50/50 split between Stream 1 (deeksha) and Stream 2 (ZANO) ──
#  Time-based duty cycle sleeps after each external batch so Stream 2 gets
#  ZION_EXT_GPU_TIME_DUTY_PCT % of wall-clock GPU time. This is accurate for
#  ProgPoMHZ (ZANO) where batch times differ from deeksha.
export ZION_ADAPTIVE_DUTY_CYCLE="${ZION_ADAPTIVE_DUTY_CYCLE:-0}"
export ZION_EXT_GPU_TIME_DUTY_PCT="${ZION_EXT_GPU_TIME_DUTY_PCT:-50}"
export ZION_EXT_GPU_MAX_GAP_MS="${ZION_EXT_GPU_MAX_GAP_MS:-5000}"
# Legacy fallback (only used when ZION_EXT_GPU_TIME_DUTY_PCT is unset):
export ZION_EXT_GPU_BURST="${ZION_EXT_GPU_BURST:-3}"
export ZION_EXT_GPU_GAP_MS="${ZION_EXT_GPU_GAP_MS:-150}"

# ── GPU nonce batch size ────────────────────────────────────────────────────
# Must be ≥ 4× GPU work_size (8192) to activate double-buffered async readback.
# Default: 32768 (4×8192). The miner binary auto-sets this if not specified,
# but we set it here too for clarity and to ensure it survives restarts.
# nonce_count_min must be ≥ 2× work_size (16384) so autotune never shrinks
# below the double-buffering threshold.
#
# CRITICAL: nonce_count must be small enough that one batch completes BEFORE
# the pool rotates to the next iteration.  Pool rotates every ~2s, deeksha
# hashrate ~28 KH/s (with 50/50 ZANO split):
#   32768 / 28000 = ~1.2s per batch  ← OK (under 2s)
#   262144 / 28000 = ~9.4s per batch ← STALE (pool 4-5 iterations ahead)
# ZION_NONCE_AUTOTUNE grows the batch when no share is found and shrinks it
# when a share lands in the first quarter. A higher ZION_NONCE_COUNT_MAX lets
# the GPU pipeline stay fuller on large windows; the pool TTL + max_batch cap
# still protect against stale shares.
export ZION_NONCE_COUNT="${ZION_NONCE_COUNT:-32768}"
export ZION_NONCE_COUNT_MIN="${ZION_NONCE_COUNT_MIN:-16384}"
export ZION_NONCE_COUNT_MAX="${ZION_NONCE_COUNT_MAX:-131072}"
export ZION_NONCE_AUTOTUNE="${ZION_NONCE_AUTOTUNE:-1}"

# ── GPU max batch cap ───────────────────────────────────────────────────────
# Caps the GPU batch size to avoid stale jobs and to free GPU time for ZANO.
# With deeksha ~28 KH/s, 16384 nonces take ~0.6 s, giving ZANO a larger
# share of the GPU while keeping ZION responsive.
export ZION_GPU_MAX_BATCH="${ZION_GPU_MAX_BATCH:-16384}"

# ── GPU pipelining ──────────────────────────────────────────────────────────
# ZION_GPU_PIPELINE=0 (default) — synchronous mine_batch: blocks until batch
# is done, then submits immediately with the CURRENT job_id. No staleness.
# ZION_GPU_PIPELINE=1 — pipelined launch_batch/collect_batch: overlaps GPU
# compute with pool I/O BUT introduces a 1-iteration lag (submit happens
# after the next job arrives → pool already rotated → StaleJob rejects).
# Keep DISABLED for pools that rotate job_id every few seconds.
export ZION_GPU_PIPELINE="${ZION_GPU_PIPELINE:-0}"

# ── Wallet resolution ──────────────────────────────────────────────────────
WALLET_ADDRESS="${WALLET_ADDRESS:-}"
if [[ -z "$WALLET_ADDRESS" ]]; then
    DESKTOP="${HOME}/Desktop"
    BACKUP_FILE="$(find "$DESKTOP" -maxdepth 1 -name 'zion-miner-wallet-backup-*.json' -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"
    if [[ -f "$BACKUP_FILE" ]]; then
        WALLET_ADDRESS="$(python3 -c "import json; print(json.load(open('$BACKUP_FILE'))['wallet']['ed25519_address'])" 2>/dev/null || true)"
        echo "[OK] Wallet loaded from backup: $BACKUP_FILE"
    fi
fi

if [[ -z "$WALLET_ADDRESS" ]]; then
    echo "[ERROR] No wallet address found."
    echo "Either:"
    echo "  1. Set WALLET_ADDRESS environment variable"
    echo "  2. Place a zion-miner-wallet-backup-*.json file on the Desktop"
    echo "  3. Generate a new wallet backup with gen-all-keys-mnemonic"
    exit 1
fi

# ── Copy binary to Desktop (standalone copy) ───────────────────────────────
if [[ -x "$MINER_BIN" ]]; then
    cp "$MINER_BIN" "$DESKTOP_BIN"
    chmod +x "$DESKTOP_BIN"
    echo "[OK] Miner binary copied to Desktop: $DESKTOP_BIN"
else
    echo "[BUILD] Miner binary missing, building..."
    cd "$REPO_ROOT"
    cargo build --release -p zion-miner --features gpu-opencl,native-hashers,native-verushash,native-randomx
    cp "$MINER_BIN" "$DESKTOP_BIN"
    chmod +x "$DESKTOP_BIN"
fi

# ── Huge pages check ───────────────────────────────────────────────────────
HUGE_PAGES=$(grep HugePages_Total /proc/meminfo | awk '{print $2}')
if [[ "$HUGE_PAGES" -lt 768 ]]; then
    echo "[WARN] Huge pages: $HUGE_PAGES (recommended: 768 for 6 threads)"
    echo "       Run: sudo sysctl -w vm.nr_hugepages=768"
fi

# ── GPU backend ────────────────────────────────────────────────────────────
BACKEND="${ZION_MINER_GPU:-opencl}"

echo "==========================================================="
echo "  ZION Miner  |  Pool: $ZION_POOL_ADDR"
echo "  Wallet: $WALLET_ADDRESS"
echo "  Worker: $ZION_MINER_WORKER"
echo "  GPU:    $BACKEND"
echo "  Autotune: Hardware auto-detect ON | Algorithm: $ZION_MINER_ALGORITHM"
if [[ "${ZION_AUTONOMOUS:-0}" == "1" ]]; then
    echo "  Autonomous: ON (auto-selects profit coins | electricity=\$${ZION_ELECTRICITY_PRICE}/kWh)"
    echo "  Triple Stream: ZION GPU + AUTO GPU coin + AUTO CPU coin"
else
    echo "  Triple Stream: ZION GPU (Deeksha) + ${ZION_STREAM2_FORCE_COIN:-ZANO} GPU + ${ZION_MINER_CPU_COIN:-VRSC} CPU"
fi
echo "  Tuning: AUTO (detects GPU CUs/VRAM, CPU cores, RAM)"
echo "  Sticky Header: ON (Claymore-style fixed metrics)"
echo "  Crash Watchdog: ON (auto-restart on GPU driver crash)"
echo "  Started: $(date)"
echo "==========================================================="

# ── Launch miner inside screen with crash watchdog ──────────────────────────
# The miner runs in a restart loop. If it crashes (SIGABRT/SIGSEGV from
# AMD OpenCL driver), the watchdog waits 5 seconds and restarts it.
# Crash log is written to /tmp/zion-miner-crash.log by the signal handler.
SCREEN_NAME="zion-miner"
screen -S "$SCREEN_NAME" -X quit 2>/dev/null || true

# Clear previous crash log
rm -f /tmp/zion-miner-crash.log

screen -dmS "$SCREEN_NAME" bash -c "
cd '$REPO_ROOT'

# ── Crash watchdog loop ────────────────────────────────────────────────────
RESTART_COUNT=0
MAX_RESTARTS=\${ZION_MAX_RESTARTS:-999999}
RESTART_DELAY=\${ZION_RESTART_DELAY:-5}

while true; do
    # Run the miner
    '$MINER_BIN' \\
        --pool '$ZION_POOL_ADDR' \\
        --wallet '$WALLET_ADDRESS' \\
        --worker '$ZION_MINER_WORKER' \\
        --gpu '$BACKEND' \\
        --algorithm '$ZION_MINER_ALGORITHM' \\
        --profile pool \\
        --loops '$ZION_MINER_LOOPS'
    EXIT_CODE=\$?

    # Check if it was a crash (signal-based exit: 128 + signal number)
    if [ \$EXIT_CODE -gt 128 ]; then
        SIGNAL=\$((EXIT_CODE - 128))
        echo \"[WATCHDOG] Miner crashed with signal \$SIGNAL (exit \$EXIT_CODE) — restarting in \${RESTART_DELAY}s...\"
        RESTART_COUNT=\$((RESTART_COUNT + 1))
        if [ \$RESTART_COUNT -ge \$MAX_RESTARTS ]; then
            echo \"[WATCHDOG] Max restarts (\$MAX_RESTARTS) reached — giving up.\"
            break
        fi
        sleep \$RESTART_DELAY
        echo \"[WATCHDOG] Restart #\$RESTART_COUNT starting...\"
    elif [ \$EXIT_CODE -eq 0 ]; then
        echo \"[WATCHDOG] Miner exited normally (exit 0).\"
        break
    else
        echo \"[WATCHDOG] Miner exited with code \$EXIT_CODE — restarting in \${RESTART_DELAY}s...\"
        RESTART_COUNT=\$((RESTART_COUNT + 1))
        if [ \$RESTART_COUNT -ge \$MAX_RESTARTS ]; then
            echo \"[WATCHDOG] Max restarts (\$MAX_RESTARTS) reached — giving up.\"
            break
        fi
        sleep \$RESTART_DELAY
    fi
done
"

echo "[OK] Miner started in screen session: $SCREEN_NAME (with crash watchdog)"
echo "[OK] Attach with: screen -r $SCREEN_NAME"
echo "[OK] Detach with: Ctrl+A then D"
echo "[OK] Crash log: /tmp/zion-miner-crash.log"
echo ""

# Optionally attach immediately if --attach was passed
if [[ "${1:-}" == "--attach" ]]; then
    exec screen -r "$SCREEN_NAME"
fi
