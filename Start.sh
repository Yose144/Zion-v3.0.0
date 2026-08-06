#!/usr/bin/env bash
# ============================================================================
#  ZION V31 Mainnet Alpha — Miner Launcher with Built-in Pro TUI Dashboard
#  Updated: 2026-08-06 — Claymore-style sticky header + ZION banner + algorithm
#
#  The miner binary now has a built-in professional TUI (just like V3):
#    - ZION ASCII art banner with version, backend, threads, "Ekam Deeksha"
#    - Hardware detection table (CPU cores, SIMD, GPU CUs/VRAM/clock)
#    - Algorithm display (deeksha_lite_v1 / cosmic_harmony_ekam_deeksha_v2)
#    - Claymore-style sticky header with trinity stats box:
#      per-stream hashrate, shares, bar chart, pool info, GPU details
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
#    ./Start.sh --autonomous — Enable autonomous profit switching (Stream 2/3)
# ============================================================================

set -euo pipefail

# ── Configuration ───────────────────────────────────────────────────────────
REPO_ROOT="/home/zionserver/2.9.6-main"
MINER_BIN="${REPO_ROOT}/V31/target/release/zion-miner"
SCREEN_NAME="zion-miner"
LOG_FILE="/tmp/zion-miner.log"
CRASH_LOG="/tmp/zion-miner-crash.log"

# Pool (Edge primary — V31 mainnet)
ZION_POOL_ADDR="${ZION_POOL_ADDR:-62.171.141.136:8444}"
ZION_MINER_WORKER="${ZION_MINER_WORKER:-zionserver-gpu}"
ZION_MINER_THREADS="${ZION_MINER_THREADS:-2}"
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
    WALLET_ADDRESS="zion1u4a82230m0a267r785m822u5a3g7n753d7eu5n0"
    echo "[WARN] No wallet backup found — using Edge default miner address"
    echo "       $WALLET_ADDRESS"
fi

# ── Stream configuration ────────────────────────────────────────────────────
# GPU backend for Stream 1 (ZION deeksha) — CUDA for NVIDIA GPUs
# Override with: ZION_GPU_BACKEND=opencl|cuda|cpu|auto
GPU_BACKEND="${ZION_GPU_BACKEND:-cuda}"
GPU_FLAG="--gpu ${GPU_BACKEND}"

# CUDA work size — number of GPU threads per kernel launch.
# Each thread uses 128 KiB scratchpad, so work_size=4096 = 512 MB VRAM.
# GTX 1070 Ti (8GB): 4096 is optimal. Smaller GPUs: use 2048 or 1024.
export ZION_CUDA_WORK_CAP="${ZION_CUDA_WORK_CAP:-4096}"
export ZION_GPU_WORK_SIZE="${ZION_GPU_WORK_SIZE:-4096}"

# Stream 2/3 (AuxPoW external coins) — disabled by default, enable with --autonomous
STREAM2_FLAG=""
STREAM3_FLAG=""

if [[ "${1:-}" == "--autonomous" || "${ZION_AUTONOMOUS:-0}" == "1" ]]; then
    export ZION_AUTONOMOUS=1
    echo "[AUTONOMOUS] Profit switching enabled for Stream 2/3"
else
    STREAM2_FLAG="--no-gpu"
    STREAM3_FLAG="--no-cpu"
fi

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

    --autonomous)
        ;;
esac

# ── Binary check ─────────────────────────────────────────────────────────────
if [[ ! -x "$MINER_BIN" ]]; then
    echo "[BUILD] V31 miner binary not found at $MINER_BIN"
    echo "        Building with GPU + TUI..."
    cd "$REPO_ROOT/V31"
    cargo build --release -p zion-miner --features gpu-cuda,gpu-opencl,tui,native-hashers,native-verushash,native-randomx
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
