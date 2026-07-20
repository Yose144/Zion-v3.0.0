#!/usr/bin/env bash
# ============================================================================
#  ZION V3 Miner — Triple Stream + Autotune Launcher
#  Spustí miner s autotune (vybere nejlepší algoritmus) + triple stream.
#  Wallet se načte z nejnovejsi zalohy na plose.
# ============================================================================

set -euo pipefail

REPO_ROOT="/home/zionserver/2.9.6-main"
MINER_BIN="${REPO_ROOT}/target/release/zion-miner"
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
# Stream 2 (GPU external/KawPow) disabled — KawPow DAG (5.6 GB) too large for 6 GB VRAM.
# Re-enable with ZION_STREAM2_ENABLED=1 if VRAM permits.
# In autonomous mode (ZION_AUTONOMOUS=1), Stream 2 is auto-selected based on VRAM compat.
export ZION_STREAM2_ENABLED="${ZION_STREAM2_ENABLED:-0}"
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

# ── Autotune: GPU memory budget auto-tune is always ON.
#  Algorithm autotune (--algorithm auto) benchmarks all GPU algorithms and
#  picks the fastest.  NOTE: on ROCm OpenCL, ProgPow/KawPow kernels use
#  amd_bpermute which fails to compile — those benchmarks error out and are
#  skipped, so autotune still works for ZION algorithms.
#  Default: deeksha_lite_v1 (best for RX 5700 XT).
#  Set ZION_MINER_ALGORITHM=auto to enable full algorithm autotune.
export ZION_MINER_ALGORITHM="${ZION_MINER_ALGORITHM:-deeksha_lite_v1}"
export ZION_AUTOTUNE_SECS="${ZION_AUTOTUNE_SECS:-3}"

# ── GPU nonce batch size ────────────────────────────────────────────────────
# Must be ≥ 4× GPU work_size (8192) to activate double-buffered async readback.
# Default: 32768 (4×8192). The miner binary auto-sets this if not specified,
# but we set it here too for clarity and to ensure it survives restarts.
# nonce_count_min must be ≥ 2× work_size (16384) so autotune never shrinks
# below the double-buffering threshold.
export ZION_NONCE_COUNT="${ZION_NONCE_COUNT:-32768}"
export ZION_NONCE_COUNT_MIN="${ZION_NONCE_COUNT_MIN:-16384}"

# ── GPU max batch cap ───────────────────────────────────────────────────────
# Caps the GPU batch size to avoid stale jobs.  The pool may send a large
# nonce_count (e.g. 262144), but processing that many nonces in one batch
# takes 10+ seconds, by which time the pool may have moved to a new block
# height (stale share).  Capping to 32768 (4× work_size) keeps each batch
# under ~2 seconds, well within the job TTL.  The miner loops back to get
# a fresh job after each batch.
export ZION_GPU_MAX_BATCH="${ZION_GPU_MAX_BATCH:-32768}"

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
    echo "  Triple Stream: ZION GPU + VRSC CPU (Stream 2/KawPow OFF — 6GB VRAM)"
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
    './target/release/zion-miner' \\
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
