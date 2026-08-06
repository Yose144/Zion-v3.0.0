#!/usr/bin/env bash
# ============================================================================
#  ZION V31 Mainnet Alpha — Miner Launcher with TUI Dashboard
#  Updated: 2026-08-06 — Post hard genesis reset, V31 cutover
#
#  Usage:
#    ./Start.sh              — Start miner in screen (detach)
#    ./Start.sh --attach     — Start and attach immediately
#    ./Start.sh --stop       — Stop running miner
#    ./Start.sh --status     — Show live status without attaching
#    ./Start.sh --log        — Tail miner log
#    ./Start.sh --autonomous — Enable autonomous profit switching
# ============================================================================

set -euo pipefail

# ── Configuration ───────────────────────────────────────────────────────────
REPO_ROOT="/home/zionserver/2.9.6-main"
MINER_BIN="${REPO_ROOT}/V31/target/release/zion-miner"
SCREEN_NAME="zion-miner"
LOG_FILE="/tmp/zion-miner.log"
CRASH_LOG="/tmp/zion-miner-crash.log"
STATS_FILE="/tmp/zion-miner-stats.json"

# Pool (Edge primary — V31 mainnet)
ZION_POOL_ADDR="${ZION_POOL_ADDR:-62.171.141.136:8444}"
ZION_MINER_WORKER="${ZION_MINER_WORKER:-zionserver-gpu}"
ZION_MINER_THREADS="${ZION_MINER_THREADS:-2}"
ZION_LOG_INTERVAL="${ZION_LOG_INTERVAL:-10}"
ZION_METRICS_BIND="${ZION_METRICS_BIND:-127.0.0.1:9101}"

# ── Wallet resolution ──────────────────────────────────────────────────────
# Priority: WALLET_ADDRESS env > Desktop backup JSON > Edge default miner
WALLET_ADDRESS="${WALLET_ADDRESS:-}"

if [[ -z "$WALLET_ADDRESS" ]]; then
    DESKTOP="${HOME}/Desktop"
    BACKUP_FILE="$(find "$DESKTOP" -maxdepth 1 -name 'zion-miner-wallet-backup-*.json' -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"
    if [[ -f "$BACKUP_FILE" ]]; then
        # Extract ed25519_address — file may have extra text after JSON, use grep
        WALLET_ADDRESS="$(grep -oP '"ed25519_address"\s*:\s*"\Kzion1[0-9a-z]+' "$BACKUP_FILE" 2>/dev/null | head -1 || true)"
        if [[ -n "$WALLET_ADDRESS" ]]; then
            echo "[OK] Wallet loaded from backup: $BACKUP_FILE"
            echo "     Address: $WALLET_ADDRESS"
        fi
    fi
fi

if [[ -z "$WALLET_ADDRESS" ]]; then
    # Fallback: Edge default miner address (post-hard-reset)
    WALLET_ADDRESS="zion1u4a82230m0a267r785m822u5a3g7n753d7eu5n0"
    echo "[WARN] No wallet backup found — using Edge default miner address"
    echo "       $WALLET_ADDRESS"
fi

# ── GPU detection ────────────────────────────────────────────────────────────
GPU_NAME="$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 || echo 'N/A')"
GPU_VRAM="$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1 || echo '0')"
CPU_CORES="$(nproc 2>/dev/null || echo '?')"
TOTAL_RAM="$(free -h 2>/dev/null | awk '/^Mem:/{print $2}' || echo '?')"

# ── Stream configuration ────────────────────────────────────────────────────
# V31 miner supports triple-stream: ZION (Stream 1) + GPU AuxPoW (Stream 2) + CPU AuxPoW (Stream 3)
# By default: ZION only (Stream 1). Enable Stream 2/3 with --autonomous or env vars.
STREAM2_FLAG=""
STREAM3_FLAG=""

if [[ "${1:-}" == "--autonomous" || "${ZION_AUTONOMOUS:-0}" == "1" ]]; then
    export ZION_AUTONOMOUS=1
    echo "[AUTONOMOUS] Profit switching enabled for Stream 2/3"
else
    # Disable external streams by default (no real AuxPoW pools configured)
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
            echo "         Attach: screen -r $SCREEN_NAME"
        else
            echo "[INACTIVE] Miner not running."
            echo "           Start: ./Start.sh"
        fi
        echo
        echo "=== Last 15 log lines ==="
        tail -15 "$LOG_FILE" 2>/dev/null || echo "(no log file)"
        echo
        echo "=== Metrics ==="
        curl -s "http://${ZION_METRICS_BIND}/metrics" 2>/dev/null | grep -E 'zion_miner_(shares|hashrate|blocks|uptime)' | head -10 || echo "(metrics not available)"
        exit 0
        ;;

    --log)
        echo "[LOG] Tailing $LOG_FILE (Ctrl+C to exit)"
        tail -f "$LOG_FILE" 2>/dev/null || echo "(no log file — miner not started?)"
        exit 0
        ;;

    --attach)
        ACTION="start-attach"
        ;;

    start|--start)
        ;;
esac

# ── Binary check ─────────────────────────────────────────────────────────────
if [[ ! -x "$MINER_BIN" ]]; then
    echo "[BUILD] V31 miner binary not found at $MINER_BIN"
    echo "        Building with CUDA + OpenCL..."
    cd "$REPO_ROOT/V31"
    cargo build --release -p zion-miner --features gpu-cuda,gpu-opencl,native-hashers,native-verushash,native-randomx
fi

MINER_VERSION="$("$MINER_BIN" --version 2>&1 || echo 'unknown')"

# ── Huge pages check ───────────────────────────────────────────────────────
HUGE_PAGES=$(grep HugePages_Total /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")
if [[ "$HUGE_PAGES" -lt 768 ]]; then
    echo "[WARN] Huge pages: $HUGE_PAGES (recommended: 768+ for RandomX/VerusHash)"
    echo "       Run: sudo sysctl -w vm.nr_hugepages=768"
fi

# ── Kill existing miner ─────────────────────────────────────────────────────
screen -S "$SCREEN_NAME" -X quit 2>/dev/null || true
pkill -f "zion-miner.*--pool.*$ZION_POOL_ADDR" 2>/dev/null || true
rm -f "$CRASH_LOG"

# ── TUI Dashboard Header ────────────────────────────────────────────────────
clear 2>/dev/null || true
cat << 'HEADER'
 ╔══════════════════════════════════════════════════════════════════════════╗
 ║                                                                          ║
 ║    ███████╗██╗██████╗ ███████╗██╗   ██╗  ██████╗ ██╗   ██╗██╗███████╗   ║
 ║    ╚══███╔╝██║██╔══██╗██╔════╝██║   ██║  ██╔══██╗██║   ██║██║██╔════╝   ║
 ║      ███╔╝ ██║██████╔╝█████╗  ██║   ██║  ██║  ██║██║   ██║██║███████╗   ║
 ║     ███╔╝  ██║██╔══██╗██╔══╝  ╚██╗ ██╔╝  ██║  ██║██║   ██║██║╚════██║   ║
 ║    ███████╗██║██║  ██║███████╗ ╚████╔╝██╗╚██████╔╝╚██████╔╝██║███████║   ║
 ║    ╚══════╝╚═╝╚═╝  ╚═╝╚══════╝  ╚═══╝ ╚═╝ ╚═════╝  ╚═════╝ ╚═╝╚══════╝   ║
 ║                                                                          ║
 ║              V31 Mainnet Alpha v3.1.0 — Triple Stream Miner              ║
 ║                                                                          ║
 ╚══════════════════════════════════════════════════════════════════════════╝
HEADER

echo "  ┌─ Hardware ──────────────────────────────────────────────────────────┐"
printf "  │ GPU:    %-58s │\n" "$GPU_NAME (${GPU_VRAM} MiB)"
printf "  │ CPU:    %-58s │\n" "$CPU_CORES cores"
printf "  │ RAM:    %-58s │\n" "$TOTAL_RAM"
printf "  │ HugeP:  %-58s │\n" "$HUGE_PAGES pages"
echo "  └──────────────────────────────────────────────────────────────────────┘"
echo
echo "  ┌─ Mining Config ─────────────────────────────────────────────────────┐"
printf "  │ Binary:  %-57s │\n" "$MINER_VERSION"
printf "  │ Pool:    %-57s │\n" "$ZION_POOL_ADDR"
printf "  │ Wallet:  %-57s │\n" "$WALLET_ADDRESS"
printf "  │ Worker:  %-57s │\n" "$ZION_MINER_WORKER"
printf "  │ Threads: %-57s │\n" "$ZION_MINER_THREADS"
printf "  │ Stream1: %-57s │\n" "ZION (cosmic_harmony_ekam_deeksha_v2) — ENABLED"
if [[ -z "$STREAM2_FLAG" ]]; then
    printf "  │ Stream2: %-57s │\n" "GPU AuxPoW — AUTONOMOUS"
    printf "  │ Stream3: %-57s │\n" "CPU AuxPoW — AUTONOMOUS"
else
    printf "  │ Stream2: %-57s │\n" "GPU AuxPoW — disabled"
    printf "  │ Stream3: %-57s │\n" "CPU AuxPoW — disabled"
fi
printf "  │ Metrics: %-57s │\n" "http://${ZION_METRICS_BIND}/metrics"
echo "  └──────────────────────────────────────────────────────────────────────┘"
echo
echo "  Started: $(date)"
echo "  Log:     $LOG_FILE"
echo "  Screen:  $SCREEN_NAME (attach: screen -r $SCREEN_NAME)"
echo
echo "  ═══════════════════════════════════════════════════════════════════════"
echo

# ── Launch miner in screen with crash watchdog ──────────────────────────────
export RUST_LOG="${RUST_LOG:-info}"

screen -dmS "$SCREEN_NAME" bash -c "
cd '$REPO_ROOT'
export RUST_LOG='${RUST_LOG}'
export ZION_POOL_ADDR='${ZION_POOL_ADDR}'
export ZION_MINER_WORKER='${ZION_MINER_WORKER}'

RESTART_COUNT=0
MAX_RESTARTS=\${ZION_MAX_RESTARTS:-999999}
RESTART_DELAY=\${ZION_RESTART_DELAY:-5}

while true; do
    echo ''
    echo '═══════════════════════════════════════════════════════════════════════'
    echo \"  [WATCHDOG] Miner starting... (attempt \$((RESTART_COUNT + 1)))\"
    echo \"  [$(date '+%Y-%m-%d %H:%M:%S')]\"
    echo '═══════════════════════════════════════════════════════════════════════'

    '$MINER_BIN' \\
        --pool '${ZION_POOL_ADDR}' \\
        --wallet '${WALLET_ADDRESS}' \\
        --worker '${ZION_MINER_WORKER}' \\
        --threads '${ZION_MINER_THREADS}' \\
        ${STREAM2_FLAG} ${STREAM3_FLAG} \\
        --metrics '${ZION_METRICS_BIND}' \\
        --log-interval '${ZION_LOG_INTERVAL}' \\
        2>&1 | tee -a '${LOG_FILE}'

    EXIT_CODE=\${PIPESTATUS[0]}

    if [ \$EXIT_CODE -eq 0 ]; then
        echo \"[WATCHDOG] Miner exited normally.\"
        break
    fi

    if [ \$EXIT_CODE -gt 128 ]; then
        SIGNAL=\$((EXIT_CODE - 128))
        echo \"[WATCHDOG] Miner CRASHED with signal \$SIGNAL (exit \$EXIT_CODE)\" | tee -a '${CRASH_LOG}'
        echo \"[WATCHDOG] Crash at \$(date)\" >> '${CRASH_LOG}'
    else
        echo \"[WATCHDOG] Miner exited with code \$EXIT_CODE\"
    fi

    RESTART_COUNT=\$((RESTART_COUNT + 1))
    if [ \$RESTART_COUNT -ge \$MAX_RESTARTS ]; then
        echo \"[WATCHDOG] Max restarts (\$MAX_RESTARTS) reached — giving up.\"
        break
    fi

    echo \"[WATCHDOG] Restarting in \${RESTART_DELAY}s... (attempt \$((RESTART_COUNT + 1))/\$MAX_RESTARTS)\"
    sleep \$RESTART_DELAY
done
"

echo "[OK] Miner started in screen session: $SCREEN_NAME"
echo "[OK] Attach:  screen -r $SCREEN_NAME"
echo "[OK] Detach:  Ctrl+A then D"
echo "[OK] Status:  ./Start.sh --status"
echo "[OK] Log:     ./Start.sh --log"
echo "[OK] Stop:    ./Start.sh --stop"

# Optionally attach immediately
if [[ "$ACTION" == "start-attach" ]]; then
    echo
    echo "  Attaching to screen... (Ctrl+A then D to detach)"
    sleep 1
    exec screen -r "$SCREEN_NAME"
fi
