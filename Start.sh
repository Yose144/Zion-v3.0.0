#!/usr/bin/env bash
# ============================================================================
#  ZION V31 Mainnet Alpha — Miner Launcher with Live TUI Dashboard
#  Updated: 2026-08-06 — Post hard genesis reset, V31 cutover, GPU+TUI build
#
#  Usage:
#    ./Start.sh              — Start miner + live TUI dashboard
#    ./Start.sh --bg         — Start miner in screen (background, no TUI)
#    ./Start.sh --attach     — Attach to running miner screen
#    ./Start.sh --stop       — Stop running miner
#    ./Start.sh --status     — Show one-shot status snapshot
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

# ── Hardware detection ──────────────────────────────────────────────────────
GPU_NAME="$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 || echo 'N/A')"
GPU_VRAM="$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1 || echo '0')"
GPU_UTIL="$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 || echo '0')"
GPU_TEMP="$(nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 || echo '0')"
GPU_FAN="$(nvidia-smi --query-gpu=fan.speed --format=csv,noheader,nounits 2>/dev/null | head -1 || echo '0')"
CPU_CORES="$(nproc 2>/dev/null || echo '?')"
CPU_MODEL="$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs || echo 'N/A')"
TOTAL_RAM="$(free -h 2>/dev/null | awk '/^Mem:/{print $2}' || echo '?')"
HUGE_PAGES="$(grep HugePages_Total /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")"

# ── Stream configuration ────────────────────────────────────────────────────
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
        _print_status_snapshot
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
if [[ ! -x "$MINER_BIN" ]]; then
    echo "[BUILD] V31 miner binary not found at $MINER_BIN"
    echo "        Building with GPU + TUI..."
    cd "$REPO_ROOT/V31"
    cargo build --release -p zion-miner --features gpu-cuda,gpu-opencl,tui,native-hashers,native-verushash,native-randomx
fi

MINER_VERSION="$("$MINER_BIN" --version 2>&1 || echo 'unknown')"

# ── Kill existing miner ─────────────────────────────────────────────────────
screen -S "$SCREEN_NAME" -X quit 2>/dev/null || true
pkill -f "zion-miner.*--pool.*$ZION_POOL_ADDR" 2>/dev/null || true
rm -f "$CRASH_LOG" "$LOG_FILE"

# ── Huge pages warning ─────────────────────────────────────────────────────
if [[ "$HUGE_PAGES" -lt 768 ]]; then
    echo "[WARN] Huge pages: $HUGE_PAGES (recommended: 768+)"
    echo "       Run: sudo sysctl -w vm.nr_hugepages=768"
fi

# ── Launch miner in screen with crash watchdog ──────────────────────────────
export RUST_LOG="${RUST_LOG:-info}"

screen -dmS "$SCREEN_NAME" bash -c "
cd '$REPO_ROOT'
export RUST_LOG='${RUST_LOG}'
export ZION_POOL_ADDR='${ZION_POOL_ADDR}'
export ZION_MINER_WORKER='${ZION_MINER_WORKER}'
export ZION_GPU_BACKEND=cuda

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

echo "[OK] Miner started in screen: $SCREEN_NAME"

# ── Background mode: no TUI ─────────────────────────────────────────────────
if [[ "$ACTION" == "bg" ]]; then
    echo "[OK] Attach:  screen -r $SCREEN_NAME"
    echo "[OK] Status:  ./Start.sh --status"
    echo "[OK] Stop:    ./Start.sh --stop"
    exit 0
fi

# ── Live TUI Dashboard ──────────────────────────────────────────────────────
# Wait for miner to start and metrics to become available
sleep 3

_tui_loop() {
    local prev_accepted=0
    local prev_rejected=0
    local start_time="$(date +%s)"
    local shares_per_min=0
    local last_accepted=0
    local last_check="$(date +%s)"

    while true; do
        # Clear screen
        clear 2>/dev/null || true

        # ── Fetch metrics ──
        local metrics=""
        metrics="$(curl -s "http://${ZION_METRICS_BIND}/metrics" 2>/dev/null || echo '')"

        local hr="0"
        local total_hashes="0"
        local accepted="0"
        local rejected="0"
        local submitted="0"
        local jobs="0"
        local reconnects="0"

        if [[ -n "$metrics" ]]; then
            hr="$(echo "$metrics" | grep 'zion_miner_hash_rate' | grep -oP '\d+\.?\d*' | tail -1 || echo '0')"
            total_hashes="$(echo "$metrics" | grep 'zion_miner_total_hashes' | grep -oP '\d+' | tail -1 || echo '0')"
            submitted="$(echo "$metrics" | grep 'zion_miner_shares_submitted' | grep -oP '\d+' | tail -1 || echo '0')"
            accepted="$(echo "$metrics" | grep 'zion_miner_shares_accepted' | grep -oP '\d+' | tail -1 || echo '0')"
            rejected="$(echo "$metrics" | grep 'zion_miner_shares_rejected' | grep -oP '\d+' | tail -1 || echo '0')"
            jobs="$(echo "$metrics" | grep 'zion_miner_jobs_received' | grep -oP '\d+' | tail -1 || echo '0')"
            reconnects="$(echo "$metrics" | grep 'zion_miner_reconnect_count' | grep -oP '\d+' | tail -1 || echo '0')"
        fi

        # ── GPU live stats ──
        local gpu_util="0" gpu_temp="0" gpu_fan="0" gpu_pwr="0"
        if command -v nvidia-smi &>/dev/null; then
            gpu_util="$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 || echo '0')"
            gpu_temp="$(nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 || echo '0')"
            gpu_fan="$(nvidia-smi --query-gpu=fan.speed --format=csv,noheader,nounits 2>/dev/null | head -1 || echo '0')"
            gpu_pwr="$(nvidia-smi --query-gpu=power.draw --format=csv,noheader,nounits 2>/dev/null | head -1 || echo '0')"
        fi

        # ── Calculate shares/min ──
        local now="$(date +%s)"
        local elapsed=$((now - last_check))
        if [[ $elapsed -ge 60 ]]; then
            shares_per_min=$(( (accepted - last_accepted) * 60 / elapsed ))
            last_accepted=$accepted
            last_check=$now
        elif [[ $accepted -gt 0 && $((now - start_time)) -ge 10 ]]; then
            local total_elapsed=$((now - start_time))
            shares_per_min=$(( accepted * 60 / total_elapsed ))
        fi

        # ── Format hashrate ──
        local hr_str=""
        if (( $(echo "$hr >= 1000000" | bc -l 2>/dev/null || echo 0) )); then
            hr_str="$(echo "scale=2; $hr / 1000000" | bc 2>/dev/null) MH/s"
        elif (( $(echo "$hr >= 1000" | bc -l 2>/dev/null || echo 0) )); then
            hr_str="$(echo "scale=2; $hr / 1000" | bc 2>/dev/null) kH/s"
        else
            hr_str="$(echo "scale=1; $hr / 1" | bc 2>/dev/null) H/s"
        fi

        # ── Uptime ──
        local uptime_sec=$(( $(date +%s) - start_time ))
        local uptime_str=""
        if [[ $uptime_sec -ge 3600 ]]; then
            uptime_str="$((uptime_sec / 3600))h $((uptime_sec % 3600 / 60))m"
        else
            uptime_str="$((uptime_sec / 60))m $((uptime_sec % 60))s"
        fi

        # ── Last log lines ──
        local last_logs=""
        last_logs="$(tail -4 "$LOG_FILE" 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | cut -c1-72 || echo '')"

        # ════════════════════════════════════════════════════════════════════
        #  PRINT TUI
        # ════════════════════════════════════════════════════════════════════
        cat << TUI
$(tput bold)$(tput setaf 2)
 ███████╗██╗██████╗ ███████╗██╗   ██╗  ██████╗ ██╗   ██╗██╗███████╗
 ╚══███╔╝██║██╔══██╗██╔════╝██║   ██║  ██╔══██╗██║   ██║██║██╔════╝
   ███╔╝ ██║██████╔╝█████╗  ██║   ██║  ██║  ██║██║   ██║██║███████╗
  ███╔╝  ██║██╔══██╗██╔══╝  ╚██╗ ██╔╝  ██║  ██║██║   ██║██║╚════██║
 ███████╗██║██║  ██║███████╗ ╚████╔╝██╗╚██████╔╝╚██████╔╝██║███████║
 ╚══════╝╚═╝╚═╝  ╚═╝╚══════╝  ╚═══╝ ╚═╝ ╚═════╝  ╚═════╝ ╚═╝╚══════╝
$(tput sgr0)$(tput bold)              V31 Mainnet Alpha v3.1.0 — Triple Stream Miner$(tput sgr0)

$(tput setaf 6)┌─ Hardware ──────────────────────────────────────────────────────────┐$(tput sgr0)
$(tput setaf 6)│$(tput sgr0) GPU:    $(tput bold)$GPU_NAME$(tput sgr0)                                          $(tput setaf 6)│$(tput sgr0)
$(tput setaf 6)│$(tput sgr0) VRAM:   ${GPU_VRAM} MiB    Util: ${gpu_util}%    Temp: ${gpu_temp}C    Fan: ${gpu_fan}%    $(tput setaf 6)│$(tput sgr0)
$(tput setaf 6)│$(tput sgr0) CPU:    $CPU_CORES cores                                                    $(tput setaf 6)│$(tput sgr0)
$(tput setaf 6)│$(tput sgr0) RAM:    $TOTAL_RAM    HugePages: $HUGE_PAGES                                       $(tput setaf 6)│$(tput sgr0)
$(tput setaf 6)└──────────────────────────────────────────────────────────────────────┘$(tput sgr0)

$(tput setaf 3)┌─ Mining ────────────────────────────────────────────────────────────┐$(tput sgr0)
$(tput setaf 3)│$(tput sgr0) Pool:    $ZION_POOL_ADDR                                              $(tput setaf 3)│$(tput sgr0)
$(tput setaf 3)│$(tput sgr0) Wallet:  $WALLET_ADDRESS                    $(tput setaf 3)│$(tput sgr0)
$(tput setaf 3)│$(tput sgr0) Worker:  $ZION_MINER_WORKER                                              $(tput setaf 3)│$(tput sgr0)
$(tput setaf 3)│$(tput sgr0) Binary:  $MINER_VERSION                                              $(tput setaf 3)│$(tput sgr0)
$(tput setaf 3)└──────────────────────────────────────────────────────────────────────┘$(tput sgr0)

$(tput setaf 2)┌─ Live Stats ───────────────────────────────────────────────────────┐$(tput sgr0)
$(tput setaf 2)│$(tput sgr0)  $(tput bold)Hashrate:    $hr_str$(tput sgr0)                                              $(tput setaf 2)│$(tput sgr0)
$(tput setaf 2)│$(tput sgr0)  Shares:     $(tput setaf 2)Accepted: $accepted$(tput sgr0)  Rejected: $rejected  Submitted: $submitted     $(tput setaf 2)│$(tput sgr0)
$(tput setaf 2)│$(tput sgr0)  Share rate: ~$shares_per_min shares/min                                       $(tput setaf 2)│$(tput sgr0)
$(tput setaf 2)│$(tput sgr0)  Uptime:     $uptime_str    Reconnects: $reconnects                              $(tput setaf 2)│$(tput sgr0)
$(tput setaf 2)│$(tput sgr0)  GPU Power:  ${gpu_pwr}W                                                      $(tput setaf 2)│$(tput sgr0)
$(tput setaf 2)└──────────────────────────────────────────────────────────────────────┘$(tput sgr0)

$(tput setaf 4)┌─ Recent Log ───────────────────────────────────────────────────────┐$(tput sgr0)
$(tput setaf 4)│$(tput sgr0) $(echo "$last_logs" | head -1 | cut -c1-68)                              $(tput setaf 4)│$(tput sgr0)
$(tput setaf 4)│$(tput sgr0) $(echo "$last_logs" | head -2 | tail -1 | cut -c1-68)                              $(tput setaf 4)│$(tput sgr0)
$(tput setaf 4)│$(tput sgr0) $(echo "$last_logs" | head -3 | tail -1 | cut -c1-68)                              $(tput setaf 4)│$(tput sgr0)
$(tput setaf 4)│$(tput sgr0) $(echo "$last_logs" | head -4 | tail -1 | cut -c1-68)                              $(tput setaf 4)│$(tput sgr0)
$(tput setaf 4)└──────────────────────────────────────────────────────────────────────┘$(tput sgr0)

  $(tput dim)Ctrl+C to exit TUI (miner keeps running in screen)$(tput sgr0)  $(tput dim)Attach: screen -r $SCREEN_NAME$(tput sgr0)
  $(tput dim)Stop: ./Start.sh --stop    Status: ./Start.sh --status$(tput sgr0)
TUI

        sleep 2
    done
}

# Run TUI (Ctrl+C exits, miner keeps running in screen)
trap 'echo; echo "[OK] TUI closed. Miner still running in screen '"$SCREEN_NAME"'."; echo "     Stop: ./Start.sh --stop  |  Attach: screen -r '"$SCREEN_NAME"'"' INT
_tui_loop
