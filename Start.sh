#!/usr/bin/env bash
# ============================================================================
#  ZION V31 Mainnet Alpha — Miner Launcher with Built-in Pro TUI Dashboard
#  Updated: 2026-08-10 — ZION GPU enabled + auto-detect + structured logging
#
#  Trinity hashrate: 22-24 MH/s total (ZION 3.1 + ZANO 9.1 + VRSC 11.8)
#  Accept rates: ZION 100%, ZANO 100%, VRSC 100%, Overall 100%
#
#  Build: ZION_CPU_TARGET=native cargo build --release -p zion-miner \
#         --features gpu-cuda,native-all,tui (REQUIRED)
#
#  V31 Trinity: single V3 protocol connection to the pool carries all 3 streams:
#    Stream 1: ZION (GPU CUDA deeksha_lite_v1 — work_size=4096, 2GB scratchpad)
#    Stream 2: ZANO (GPU CUDA ProgPoW — AuxPoW via pool → HeroMiners)
#    Stream 3: VRSC (CPU VerusHash v2.2 — AuxPoW via pool → LuckPool)
#
#  GPU sharing: ZION + ZANO share the same GPU (CUDA driver time-slices).
#    GTX 1070 Ti (8GB): ZION scratchpad 2GB + ZANO DAG 2GB = 4GB used.
#    Duty-cycle gap: 50ms when ZION has GPU, 300ms when ZION is CPU-only.
#
#  Auto-detect: miner auto-detects CPU/GPU/RAM and derives optimal config.
#    GPU detected → Triple Parallel (3 streams), CPU-only → Dual Stream (2).
#    All values overridable with env vars (see auto_detect.rs).
#
#  Structured logging: tracing::info/warn/debug + periodic 30s metrics summary
#    (per-stream hashrate, shares, accept rate) — works in both TUI and --bg.
#
#  The miner binary has a built-in professional TUI:
#    - ZION ASCII art banner with version, backend, threads, "Ekam Deeksha"
#    - Hardware detection table (CPU cores, SIMD, GPU CUs/VRAM/clock)
#    - Claymore-style sticky header with trinity stats box
#    - Scrolling log lines below the fixed header
#    - Alternate screen buffer (like Claymore/GMiner)
#
#  Usage:
#    ./Start.sh              — Start miner with built-in TUI (foreground)
#    ./Start.sh --bg         — Start miner in screen (background, no TUI)
#    ./Start.sh --attach     — Attach to running miner screen (see TUI)
#    ./Start.sh --stop       — Stop running miner
#    ./Start.sh --status     — Show one-shot status snapshot from metrics
#    ./Start.sh --log        — Tail miner log (Ctrl+C to exit)
# ============================================================================

set -euo pipefail

# ── Configuration ───────────────────────────────────────────────────────────
REPO_ROOT="/home/zionserver/2.9.6-main"
MINER_BIN="${HOME}/Desktop/zion-miner"
SCREEN_NAME="zion-miner"
LOG_FILE="/tmp/zion-miner.log"
CRASH_LOG="/tmp/zion-miner-crash.log"

# Pool (Edge primary — V31 mainnet)
ZION_POOL_ADDR="${ZION_POOL_ADDR:-62.171.141.136:8444}"
ZION_MINER_WORKER="${ZION_MINER_WORKER:-1070ti}"
ZION_MINER_THREADS="${ZION_MINER_THREADS:-10}"
ZION_LOG_INTERVAL="${ZION_LOG_INTERVAL:-5}"
ZION_METRICS_BIND="${ZION_METRICS_BIND:-127.0.0.1:9101}"

# ── Wallet resolution ──────────────────────────────────────────────────────
WALLET_ADDRESS="${WALLET_ADDRESS:-}"

if [[ -z "$WALLET_ADDRESS" ]]; then
    DESKTOP="${HOME}/Desktop"
    BACKUP_FILE="$(find "$DESKTOP" -maxdepth 1 -name 'zion-miner-wallet-backup-*.json' -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"
    if [[ -f "$BACKUP_FILE" ]]; then
        WALLET_ADDRESS="$(grep -oP '"ed25519_address"\s*:\s*"\Kzion1[0-9a-z]+' "$BACKUP_FILE" 2>/dev/null | head -1 || true)"
        if [[ -n "$WALLET_ADDRESS" ]]; then
            echo "[OK] Wallet loaded from backup: $BACKUP_FILE"
            echo "     Address: $WALLET_ADDRESS"
        fi
    fi
fi

if [[ -z "$WALLET_ADDRESS" ]]; then
    WALLET_ADDRESS="zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2"
    echo "[WARN] No wallet backup found — using V3.2 genesis pool wallet"
    echo "       $WALLET_ADDRESS"
fi

# ── Stream configuration ────────────────────────────────────────────────────
# V31 Trinity mode: all 3 streams through a single V3 protocol connection.
#   Stream 1: ZION (GPU CUDA deeksha_lite_v1 — 2.46 MH/s on 1070 Ti)
#   Stream 2: ZANO (GPU CUDA ProgPoW — 8.37 MH/s, AuxPoW via pool → HeroMiners)
#   Stream 3: VRSC (CPU VerusHash v2.2 — 10.39 MH/s, AuxPoW via pool → LuckPool)
#
# Auto-detect: miner detects CPU/GPU and auto-configures streams.
#   GPU present → all 3 streams enabled (Triple Parallel).
#   CPU-only → Stream 2 disabled, Stream 1+3 enabled (Dual Stream).
# Override: ZION_STREAM1_ENABLED, ZION_STREAM2_ENABLED, ZION_STREAM3_ENABLED
GPU_BACKEND="${ZION_GPU_BACKEND:-cuda}"
GPU_FLAG="--gpu ${GPU_BACKEND}"

# CUDA work size — number of GPU threads per kernel launch chunk.
# Each thread uses 512 KiB scratchpad (v3.2 ASIC-hardened deeksha_lite).
# work_size=4096 → 2 GB VRAM for ZION scratchpad.
# GTX 1070 Ti (8GB): ZION 2GB + ZANO DAG 2GB = 4GB, fits comfortably.
# When sharing GPU with ZANO (Stream 2), miner auto-selects 4096.
# Without ZANO: miner auto-selects 8192 (4GB scratchpad, more throughput).
export ZION_CUDA_WORK_CAP="${ZION_CUDA_WORK_CAP:-4096}"
export ZION_GPU_WORK_SIZE="${ZION_GPU_WORK_SIZE:-4096}"

# ZION GPU is now AUTO-ENABLED even when ZANO (Stream 2) is active.
# The miner shares the GPU between ZION and ZANO via CUDA driver time-slicing.
# To force ZION CPU-only (old behavior): export ZION_ZION_GPU=0
# To force ZION GPU with larger work_size: export ZION_GPU_WORK_SIZE=8192

# ProgPoW max GWS — limits GPU work size for ProgPoW (ZANO).
# GTX 1070 Ti (8GB): 262144 is safe. Lower if DAG generation OOMs.
export ZION_AUXPOW_PROGPOW_MAX_GWS="${ZION_AUXPOW_PROGPOW_MAX_GWS:-262144}"

# Duty-cycle gap for GPU sharing (Stream 2 ZANO yields to Stream 1 ZION).
# When ZION has GPU: 50ms (short — CUDA driver handles scheduling).
# When ZION is CPU-only: 300ms (longer — gives CPU mining a chance).
# Override: export ZION_EXT_GPU_GAP_MS=0 (disable gap entirely)
export ZION_EXT_GPU_GAP_MS="${ZION_EXT_GPU_GAP_MS:-0}"

# VRSC (VerusHash) CPU tuning — Stream 3 uses arch-aware autotune by default.
# AMD Ryzen 5 3600: 12 threads, 10M nonce batch → ~11.5 MH/s.
# Override with ZION_EXT_CPU_THREADS to limit VRSC thread count.
# Override with ZION_EXT_CPU_NONCE_COUNT for batch size.
export ZION_EXT_CPU_NONCE_COUNT="${ZION_EXT_CPU_NONCE_COUNT:-10000000}"
export ZION_NONCE_COUNT="${ZION_NONCE_COUNT:-10000000}"
if [[ -n "${ZION_EXT_CPU_THREADS:-}" ]]; then
    export ZION_EXT_CPU_THREADS
fi

# Trinity mode flag — all 3 streams enabled
TRINITY_FLAG="--v3-trinity"
export ZION_V3_TRINITY=1
export ZION_AUXPOW_ENABLED=1
# ZION GPU enabled — shares GPU with ZANO via CUDA driver time-slicing
export ZION_ZION_GPU=1
STREAM2_FLAG=""
STREAM3_FLAG=""

# ── Actions ──────────────────────────────────────────────────────────────────
ACTION="${1:-start}"

case "$ACTION" in
    --stop)
        screen -S "$SCREEN_NAME" -X quit 2>/dev/null || true
        pkill -f "zion-miner.*--pool.*$ZION_POOL_ADDR" 2>/dev/null || true
        echo "[OK] Miner stopped."
        exit 0
        ;;

    --status)
        if screen -S "$SCREEN_NAME" -Q select . >/dev/null 2>&1; then
            echo "[ACTIVE] Miner running in screen '$SCREEN_NAME'"
        else
            echo "[INACTIVE] Miner not running."
        fi
        echo
        METRICS="$(curl -s "http://${ZION_METRICS_BIND}/metrics" 2>/dev/null || echo '')"
        if [[ -n "$METRICS" ]]; then
            HR="$(echo "$METRICS" | grep 'zion_miner_hash_rate' | grep -oP '\d+\.?\d*' | tail -1 || echo '0')"
            ACCEPTED="$(echo "$METRICS" | grep 'zion_miner_shares_accepted' | grep -oP '\d+' | tail -1 || echo '0')"
            REJECTED="$(echo "$METRICS" | grep 'zion_miner_shares_rejected' | grep -oP '\d+' | tail -1 || echo '0')"
            SUBMITTED="$(echo "$METRICS" | grep 'zion_miner_shares_submitted' | grep -oP '\d+' | tail -1 || echo '0')"
            TOTAL_HASHES="$(echo "$METRICS" | grep 'zion_miner_total_hashes' | grep -oP '\d+' | tail -1 || echo '0')"
            echo "  Hashrate:      $HR H/s"
            echo "  Total hashes:  $TOTAL_HASHES"
            echo "  Shares:        accepted=$ACCEPTED rejected=$REJECTED submitted=$SUBMITTED"
        else
            echo "  (metrics endpoint not available)"
        fi
        exit 0
        ;;

    --log)
        echo "[LOG] Tailing $LOG_FILE (Ctrl+C to exit)"
        tail -f "$LOG_FILE" 2>/dev/null || echo "(no log file)"
        exit 0
        ;;

    --attach)
        exec screen -r "$SCREEN_NAME" 2>/dev/null || echo "[ERROR] No screen session found. Start with: ./Start.sh"
        exit 0
        ;;

    --bg)
        ACTION="bg"
        ;;

    start|--start)
        ;;
esac

# ── Binary check ─────────────────────────────────────────────────────────────
# The miner binary MUST be built with --features gpu-cuda,native-all,tui.
#   gpu-cuda    — ZION + ZANO GPU kernels (CUDA)
#   native-all  — VerusHash v2.2 native CPU (REQUIRED for VRSC)
#   tui         — built-in Claymore-style dashboard
# Always use the freshly built target/release binary to avoid stale copies.
MINER_BIN="${REPO_ROOT}/V31/target/release/zion-miner"
if [[ ! -x "$MINER_BIN" ]]; then
    echo "[BUILD] V31 miner binary not found at $MINER_BIN"
    echo "        Building with CUDA + native-verushash + TUI + native CPU target..."
    cd "$REPO_ROOT/V31"
    ZION_CPU_TARGET=native cargo build --release -p zion-miner --bin zion-miner \
        --features gpu-cuda,native-all,tui
fi

# Keep the Desktop copy in sync (for manual ./zion-miner runs)
if [[ -x "$MINER_BIN" ]]; then
    cp -f -v "$MINER_BIN" "${HOME}/Desktop/zion-miner" 2>/dev/null || true
    chmod +x "${HOME}/Desktop/zion-miner" 2>/dev/null || true
fi

# ── Kill existing miner ─────────────────────────────────────────────────────
screen -S "$SCREEN_NAME" -X quit 2>/dev/null || true
pkill -f "zion-miner.*--pool.*$ZION_POOL_ADDR" 2>/dev/null || true
rm -f "$CRASH_LOG" "$LOG_FILE"

# ── Huge pages warning ─────────────────────────────────────────────────────
HUGE_PAGES="$(grep HugePages_Total /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")"
if [[ "$HUGE_PAGES" -lt 768 ]]; then
    echo "[WARN] Huge pages: $HUGE_PAGES (recommended: 768+)"
    echo "       Run: sudo sysctl -w vm.nr_hugepages=768"
fi

# ── TUI mode selection ──────────────────────────────────────────────────────
# Foreground (default): built-in Claymore-style TUI with ZION banner
# Background (--bg):    no TUI, logs to file, crash watchdog auto-restart
if [[ "$ACTION" == "bg" ]]; then
    TUI_FLAG="--no-tui"
    export ZION_INTERACTIVE=0
else
    TUI_FLAG="--interactive"
    export ZION_INTERACTIVE=1
fi

# ── Launch miner ─────────────────────────────────────────────────────────────
export RUST_LOG="${RUST_LOG:-info}"

if [[ "$ACTION" == "bg" ]]; then
    # ── Background mode: screen + crash watchdog ──
    screen -dmS "$SCREEN_NAME" bash -c "
cd '$REPO_ROOT'
export RUST_LOG='${RUST_LOG}'
export ZION_INTERACTIVE=0

RESTART_COUNT=0
MAX_RESTARTS=\${ZION_MAX_RESTARTS:-999999}
RESTART_DELAY=\${ZION_RESTART_DELAY:-5}

while true; do
    echo ''
    echo '[WATCHDOG] Miner starting... (attempt '\$((RESTART_COUNT + 1))')'
    echo '[$(date '+%Y-%m-%d %H:%M:%S')]'

    '$MINER_BIN' \\
        --pool '${ZION_POOL_ADDR}' \\
        --wallet '${WALLET_ADDRESS}' \\
        --worker '${ZION_MINER_WORKER}' \\
        --threads '${ZION_MINER_THREADS}' \\
        --gpu '${GPU_BACKEND}' \\
        --v3-trinity \\
        --no-tui \\
        ${STREAM2_FLAG} ${STREAM3_FLAG} \\
        --metrics '${ZION_METRICS_BIND}' \\
        --log-interval '${ZION_LOG_INTERVAL}' \\
        2>&1 | tee -a '${LOG_FILE}'

    EXIT_CODE=\${PIPESTATUS[0]}

    if [ \$EXIT_CODE -eq 0 ]; then
        echo '[WATCHDOG] Miner exited normally.'
        break
    fi

    if [ \$EXIT_CODE -gt 128 ]; then
        SIGNAL=\$((EXIT_CODE - 128))
        echo \"[WATCHDOG] Miner CRASHED with signal \$SIGNAL\" | tee -a '${CRASH_LOG}'
        echo \"[WATCHDOG] Crash at \$(date)\" >> '${CRASH_LOG}'
    else
        echo \"[WATCHDOG] Miner exited with code \$EXIT_CODE\"
    fi

    RESTART_COUNT=\$((RESTART_COUNT + 1))
    if [ \$RESTART_COUNT -ge \$MAX_RESTARTS ]; then
        echo '[WATCHDOG] Max restarts reached — giving up.'
        break
    fi

    echo \"[WATCHDOG] Restarting in \${RESTART_DELAY}s...\"
    sleep \$RESTART_DELAY
done
"
    echo "[OK] Miner started in screen: $SCREEN_NAME (background, no TUI)"
    echo "[OK] Attach:  screen -r $SCREEN_NAME"
    echo "[OK] Status:  ./Start.sh --status"
    echo "[OK] Stop:    ./Start.sh --stop"
    exit 0
fi

# ── Foreground mode: built-in TUI with crash watchdog ──
# The miner runs in a restart loop directly in the terminal.
# The built-in TUI shows the ZION banner + Claymore-style sticky header.

RESTART_COUNT=0
MAX_RESTARTS="${ZION_MAX_RESTARTS:-999999}"
RESTART_DELAY="${ZION_RESTART_DELAY:-5}"

while true; do
    "$MINER_BIN" \
        --pool "$ZION_POOL_ADDR" \
        --wallet "$WALLET_ADDRESS" \
        --worker "$ZION_MINER_WORKER" \
        --threads "$ZION_MINER_THREADS" \
        --gpu "$GPU_BACKEND" \
        --v3-trinity \
        --interactive \
        ${STREAM2_FLAG} ${STREAM3_FLAG} \
        --metrics "$ZION_METRICS_BIND" \
        --log-interval "$ZION_LOG_INTERVAL" \
        2>&1 | tee -a "$LOG_FILE"

    EXIT_CODE=${PIPESTATUS[0]}

    if [ $EXIT_CODE -eq 0 ]; then
        echo "[WATCHDOG] Miner exited normally."
        break
    fi

    if [ $EXIT_CODE -gt 128 ]; then
        SIGNAL=$((EXIT_CODE - 128))
        echo "[WATCHDOG] Miner CRASHED with signal $SIGNAL" | tee -a "$CRASH_LOG"
        echo "[WATCHDOG] Crash at $(date)" >> "$CRASH_LOG"
    else
        echo "[WATCHDOG] Miner exited with code $EXIT_CODE"
    fi

    RESTART_COUNT=$((RESTART_COUNT + 1))
    if [ $RESTART_COUNT -ge $MAX_RESTARTS ]; then
        echo "[WATCHDOG] Max restarts reached — giving up."
        break
    fi

    echo "[WATCHDOG] Restarting in ${RESTART_DELAY}s..."
    sleep "$RESTART_DELAY"
done
