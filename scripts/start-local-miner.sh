#!/usr/bin/env bash
# ============================================================================
#  ZION V3 — Local GPU/CPU Miner Launcher
#  One-click mining to the wallet backup on the Desktop.
#  Connects to the main Edge pool (62.171.141.136:8444).
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MINER_BIN="${REPO_ROOT}/V3/target/release/zion-miner"

# ── Pool & defaults ────────────────────────────────────────────────────────
ZION_POOL_ADDR="${ZION_POOL_ADDR:-62.171.141.136:8444}"
ZION_MINER_WORKER="${ZION_MINER_WORKER:-local-gpu}"
ZION_MINER_LOOPS="${ZION_MINER_LOOPS:-999999}"

# ── Triple-Stream tuning ────────────────────────────────────────────────────
# Hardware autotuning is now built into the miner binary!
# The miner auto-detects GPU CUs, VRAM, CPU cores, and RAM, then computes
# optimal work sizes and thread count. No manual tuning needed.
#
# Formula (benchmark-derived):
#   gpu_work_size      = nearest_pow2(CUs * 512), clamped [1024, 65536]
#   secondary_gpu_ws   = clamp(VRAM_MiB * 0.75 / 1024, 1, 8) * 1M
#   threads            = all logical cores (up to 64)
#
# To override: set ZION_GPU_WORK_SIZE, ZION_SECONDARY_GPU_WORK_SIZE, ZION_THREADS
# To disable autotune: set ZION_AUTOTUNE=0
export ZION_AUTOTUNE="${ZION_AUTOTUNE:-1}"
export ZION_STREAM1_ENABLED="${ZION_STREAM1_ENABLED:-1}"
export ZION_STREAM2_ENABLED="${ZION_STREAM2_ENABLED:-1}"
export ZION_STREAM3_ENABLED="${ZION_STREAM3_ENABLED:-1}"
export ZION_METRICS_REPORT_SECS="${ZION_METRICS_REPORT_SECS:-15}"

# ── Wallet resolution ──────────────────────────────────────────────────────
# 1. Use WALLET_ADDRESS env var if set
# 2. Find newest zion-miner-wallet-backup-*.json on Desktop and read address
# 3. Fail with instructions
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

# ── Validate binary ──────────────────────────────────────────────────────────
if [[ ! -x "$MINER_BIN" ]]; then
    echo "[BUILD] Miner binary missing, building release with OpenCL GPU support..."
    cd "$REPO_ROOT/V3"
    cargo build --release --bin zion-miner --features full,native-hashers
    echo "[OK] Miner built: $MINER_BIN"
fi

# ── GPU/CPU backend selection ────────────────────────────────────────────────
# Try OpenCL first (AMD/Intel/NVIDIA on Linux). If the env var is set, respect it.
BACKEND="${ZION_MINER_GPU:-auto}"
if [[ "$BACKEND" == "auto" ]]; then
    # Auto-detect: try opencl, fallback to cpu
    BACKEND="opencl"
fi

echo "==========================================================="
echo "  ZION Local Miner  |  Pool: $ZION_POOL_ADDR"
echo "  Wallet: $WALLET_ADDRESS"
echo "  Worker: $ZION_MINER_WORKER"
echo "  GPU:    $BACKEND"
echo "  Tuning: AUTO (hardware autodetect — GPU CUs/VRAM, CPU cores, RAM)"
echo "  Started: $(date)"
echo "==========================================================="

# ── Huge pages check (for RandomX/VerusHash performance) ────────────────────
HUGE_PAGES=$(grep HugePages_Total /proc/meminfo | awk '{print $2}')
if [[ "$HUGE_PAGES" -lt 768 ]]; then
    echo "[WARN] Huge pages: $HUGE_PAGES (recommended: 768 for 6 threads)"
    echo "       Run: sudo sysctl -w vm.nr_hugepages=768"
fi

# ── Launch miner inside screen so it survives terminal close ────────────────
SCREEN_NAME="zion-miner"
# Kill any existing screen session with the same name
screen -S "$SCREEN_NAME" -X quit 2>/dev/null || true

screen -dmS "$SCREEN_NAME" bash -c "
cd '$REPO_ROOT/V3'
exec './target/release/zion-miner' \\
    --pool '$ZION_POOL_ADDR' \\
    --wallet '$WALLET_ADDRESS' \\
    --worker '$ZION_MINER_WORKER' \\
    --gpu '$BACKEND' \\
    --no-tui \\
    --profile pool \\
    --loops '$ZION_MINER_LOOPS'
"

echo "[OK] Miner started in screen session: $SCREEN_NAME"
echo "[OK] Attach with: screen -r $SCREEN_NAME"
echo "[OK] Detach with: Ctrl+A then D"
echo ""
echo "Logs will appear in the screen session."

# Optionally attach immediately if --attach was passed
if [[ "${1:-}" == "--attach" ]]; then
    exec screen -r "$SCREEN_NAME"
fi
