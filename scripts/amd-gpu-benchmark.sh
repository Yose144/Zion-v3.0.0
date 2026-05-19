#!/usr/bin/env bash
set -euo pipefail

# ZION V3 — AMD GPU Mining Benchmark & Diagnostics
# Tests OpenCL backend detection, kernel compilation, and hashrate.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
V3_DIR="${REPO_ROOT}/V3"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_title() { echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"; }

# ── Ensure miner is built ──────────────────────────────────────────────────
ensure_miner() {
    local miner_bin="${V3_DIR}/target/release/zion-miner"
    if [[ ! -f "$miner_bin" ]]; then
        log_info "Miner binary not found. Building with OpenCL support..."
        cd "$V3_DIR"
        cargo build --release -p zion-miner --features gpu-opencl
    fi
    echo "$miner_bin"
}

# ── 1. System GPU detection ────────────────────────────────────────────────
section_gpu_info() {
    log_title "1. GPU Hardware Detection"

    if command -v lspci &>/dev/null; then
        echo "--- PCI GPU devices ---"
        lspci | grep -i 'vga\|3d\|display' || log_warn "No GPU found via lspci"
    fi

    if command -v rocminfo &>/dev/null; then
        echo ""
        echo "--- ROCm GPU Info ---"
        rocminfo 2>/dev/null | grep -E "Name:|Marketing|Device|Compute" | head -20 || true
    fi

    if command -v clinfo &>/dev/null; then
        echo ""
        echo "--- OpenCL Platforms & Devices ---"
        clinfo 2>/dev/null | grep -E "Platform|Device Name|Device Vendor|Device Version|Driver Version" | head -40 || \
            log_warn "clinfo failed — OpenCL runtime may not be installed"
    else
        log_warn "clinfo not installed (sudo apt install clinfo)"
    fi
}

# ── 2. OpenCL smoke test ───────────────────────────────────────────────────
section_opencl_smoke() {
    log_title "2. OpenCL Smoke Test"
    cd "$V3_DIR"

    # Try running the built-in OpenCL smoke example if it exists
    if [[ -f target/release/examples/verify_gpu ]]; then
        log_info "Running verify_gpu example..."
        ZION_GPU_BACKEND=opencl target/release/examples/verify_gpu 2>&1 || \
            log_warn "verify_gpu example failed (non-fatal)"
    else
        log_info "verify_gpu example not built; skipping"
    fi

    # Check if ocl crate can enumerate platforms
    log_info "Attempting ocl platform enumeration via miner --list-devices..."
    # The miner has a device listing in gpu_backend
    ZION_GPU_BACKEND=opencl target/release/zion-miner --help 2>&1 | head -5
}

# ── 3. Ekam Deeksha GPU benchmark ──────────────────────────────────────────
section_ekam_bench() {
    log_title "3. Ekam Deeksha v2 GPU Benchmark"
    local miner_bin
    miner_bin=$(ensure_miner)

    export ZION_GPU_BACKEND=opencl
    export ZION_GPU_WORK_SIZE=${ZION_GPU_WORK_SIZE:-4096}

    log_info "Work size: $ZION_GPU_WORK_SIZE"
    log_info "Backend: OpenCL (AMD)"
    echo ""

    "$miner_bin" --ekam-bench 2>&1 || {
        log_error "GPU benchmark failed. Possible causes:"
        echo "  - OpenCL runtime not installed (rocm-opencl-runtime or mesa-opencl-icd)"
        echo "  - User not in 'video' / 'render' group"
        echo "  - Kernel compilation error (check miner logs)"
        return 1
    }
}

# ── 4. Legacy GPU benchmark ────────────────────────────────────────────────
section_legacy_bench() {
    log_title "4. Legacy GPU Benchmark"
    local miner_bin
    miner_bin=$(ensure_miner)

    export ZION_GPU_BACKEND=opencl
    "$miner_bin" --gpu-bench 2>&1 || log_warn "Legacy benchmark failed (non-fatal)"
}

# ── 5. Work-size sweep ─────────────────────────────────────────────────────
section_worksize_sweep() {
    log_title "5. Work-Size Sweep (tuning for your AMD GPU)"
    local miner_bin
    miner_bin=$(ensure_miner)

    local -a sizes=(1024 2048 4096 8192 16384)
    echo "Testing different ZION_GPU_WORK_SIZE values..."
    echo ""
    printf "%-10s %-20s %-15s\n" "WORK_SIZE" "NONCES" "HASHRATE"
    printf "%-10s %-20s %-15s\n" "--------" "------" "--------"

    for ws in "${sizes[@]}"; do
        export ZION_GPU_BACKEND=opencl
        export ZION_GPU_WORK_SIZE=$ws
        # Run benchmark for 3 seconds and parse output
        local output
        output=$(timeout 10 "$miner_bin" --ekam-bench 2>&1) || true
        local hashrate=$(echo "$output" | grep -oP '(?<=hashrate=)[0-9.]+' || echo "N/A")
        local nonces=$(echo "$output" | grep -oP '(?<=nonces=)[0-9]+' || echo "N/A")
        printf "%-10s %-20s %-15s\n" "$ws" "$nonces" "$hashrate"
    done

    echo ""
    log_info "Recommendation: use the highest work size that doesn't crash"
    log_info "and yields stable hashrate. Add to .env: ZION_GPU_WORK_SIZE=<value>"
}

# ── 6. Stratum connection test ────────────────────────────────────────────
section_stratum_test() {
    log_title "6. Pool Stratum Connection Test"
    local miner_bin
    miner_bin=$(ensure_miner)

    log_info "Testing miner -> pool connection (requires pool running)..."
    export ZION_POOL_ADDR=127.0.0.1:8444
    export ZION_WORKER_NAME=bench-worker
    export ZION_MINER_ID=bench-$(date +%s)
    export ZION_GPU_BACKEND=opencl
    export ZION_LOOP_COUNT=10

    timeout 15 "$miner_bin" 2>&1 | head -30 || {
        log_warn "Stratum test timed out or failed (pool may not be running)"
    }
}

# ── Main ───────────────────────────────────────────────────────────────────
main() {
    cd "$REPO_ROOT"

    case "${1:-all}" in
        info)
            section_gpu_info
            ;;
        opencl)
            section_opencl_smoke
            ;;
        ekam)
            section_ekam_bench
            ;;
        legacy)
            section_legacy_bench
            ;;
        sweep)
            section_worksize_sweep
            ;;
        stratum)
            section_stratum_test
            ;;
        all|*)
            section_gpu_info
            section_opencl_smoke
            section_ekam_bench
            section_legacy_bench
            section_worksize_sweep
            # stratum test skipped in 'all' unless pool is known running
            ;;
    esac

    log_title "Benchmark Complete"
    log_info "To run specific test: ./scripts/amd-gpu-benchmark.sh [info|opencl|ekam|legacy|sweep|stratum]"
}

main "$@"
