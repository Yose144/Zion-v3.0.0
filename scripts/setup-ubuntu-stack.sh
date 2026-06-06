#!/usr/bin/env bash
set -euo pipefail

# ZION V3 — Ubuntu Setup & Stack Launcher
# Supports both AMD GPU (OpenCL) and NVIDIA GPU (CUDA)
# Usage: ./scripts/setup-ubuntu-stack.sh [--docker|--native|--benchmark]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
V3_DIR="${REPO_ROOT}/V3"
DOCKER_DIR="${V3_DIR}/docker"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ---------------------------------------------------------------------------
# Detect GPU vendor
# ---------------------------------------------------------------------------
detect_gpu() {
    local gpu_info=""
    if command -v lspci &>/dev/null; then
        gpu_info=$(lspci | grep -i 'vga\|3d\|display' || true)
    fi
    if echo "$gpu_info" | grep -iq 'amd\|ati\|radeon'; then
        echo "amd"
    elif echo "$gpu_info" | grep -iq 'nvidia'; then
        echo "nvidia"
    elif echo "$gpu_info" | grep -iq 'intel'; then
        echo "intel"
    else
        echo "unknown"
    fi
}

# ---------------------------------------------------------------------------
# Install Docker
# ---------------------------------------------------------------------------
install_docker() {
    if command -v docker &>/dev/null && command -v docker-compose &>/dev/null; then
        log_ok "Docker already installed: $(docker --version)"
        return 0
    fi

    log_info "Installing Docker..."
    sudo apt-get update
    sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    sudo apt-get install -y ca-certificates curl gnupg lsb-release

    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
        sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    local codename
    codename=$(lsb_release -cs)
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu ${codename} stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin

    sudo usermod -aG docker "$USER"
    log_ok "Docker installed. Log out and back in for group changes, or run: newgrp docker"
    newgrp docker 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Install AMD ROCm / OpenCL
# ---------------------------------------------------------------------------
install_amd_gpu() {
    log_info "AMD GPU detected. Setting up ROCm / OpenCL..."

    # Try to install ROCm (best performance for mining)
    if ! command -v rocminfo &>/dev/null; then
        log_info "Installing ROCm..."
        sudo mkdir -p --mode=0755 /etc/apt/keyrings
        wget -q -O - https://repo.radeon.com/rocm/rocm.gpg.key | \
            sudo gpg --dearmor -o /etc/apt/keyrings/rocm.gpg

        local codename
        codename=$(lsb_release -cs)
        # ROCm 6.x supports Ubuntu 22.04/24.04; for 26.04 fallback to noble
        local rocm_distro="${codename}"
        if [[ "$codename" == "resolute" ]]; then
            rocm_distro="noble"
        fi

        echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/rocm.gpg] \
https://repo.radeon.com/rocm/apt/latest ${rocm_distro} main" | \
            sudo tee /etc/apt/sources.list.d/rocm.list

        sudo apt-get update
        sudo apt-get install -y rocm-opencl-runtime rocminfo clinfo
    else
        log_ok "ROCm already installed"
    fi

    # Also install Mesa OpenCL as fallback
    sudo apt-get install -y ocl-icd-libopencl1 clinfo mesa-opencl-icd 2>/dev/null || \
        sudo apt-get install -y ocl-icd-libopencl1 clinfo

    # Add user to render and video groups for GPU access
    sudo usermod -aG render,video "$USER" 2>/dev/null || true

    log_info "GPU info:"
    rocminfo 2>/dev/null | head -20 || clinfo 2>/dev/null | head -20 || \
        log_warn "Could not query GPU info. You may need to log out and back in."
}

# ---------------------------------------------------------------------------
# Install NVIDIA Container Toolkit
# ---------------------------------------------------------------------------
install_nvidia_gpu() {
    log_info "NVIDIA GPU detected. Setting up NVIDIA Container Toolkit..."
    if command -v nvidia-smi &>/dev/null; then
        log_ok "NVIDIA drivers already installed: $(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)"
    else
        log_warn "NVIDIA drivers not detected. Install them first from ubuntu-drivers."
        sudo ubuntu-drivers autoinstall 2>/dev/null || \
            log_warn "ubuntu-drivers not available; please install drivers manually."
    fi

    if ! command -v nvidia-ctk &>/dev/null; then
        log_info "Installing NVIDIA Container Toolkit..."
        curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
            sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
        curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
            sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
            sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
        sudo apt-get update
        sudo apt-get install -y nvidia-container-toolkit
        sudo nvidia-ctk runtime configure --runtime=docker
        sudo systemctl restart docker
        log_ok "NVIDIA Container Toolkit installed"
    else
        log_ok "NVIDIA Container Toolkit already installed"
    fi
}

# ---------------------------------------------------------------------------
# Install Rust toolchain
# ---------------------------------------------------------------------------
install_rust() {
    if command -v cargo &>/dev/null; then
        log_ok "Rust already installed: $(cargo --version)"
        return 0
    fi
    log_info "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    rustup default stable
    log_ok "Rust installed: $(cargo --version)"
}

# ---------------------------------------------------------------------------
# Setup .env files
# ---------------------------------------------------------------------------
setup_env() {
    log_info "Setting up environment files..."

    if [[ ! -f "${DOCKER_DIR}/.env" ]]; then
        cp "${DOCKER_DIR}/.env.example" "${DOCKER_DIR}/.env"
        log_ok "Created ${DOCKER_DIR}/.env from example"
    else
        log_ok "${DOCKER_DIR}/.env already exists"
    fi

    # Create a local native env file too
    cat > "${REPO_ROOT}/.env.zion-native" << 'EOF'
# ZION V3 — Native Stack Environment (AMD GPU optimized)
export RUST_LOG=info,zion_core=debug,zion_pool=debug

# Node
export ZION_NODE_ID=v3-mainnet-local
export ZION_P2P_BIND=0.0.0.0:8333
export ZION_RPC_BIND=0.0.0.0:8443
export ZION_NODE_STATE_PATH=/tmp/zion-node-state
export ZION_SEED_PEERS=

# Wallets (defaults from docker-compose; override with your own)
export ZION_MINER_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790
export ZION_HUMANITARIAN_WALLET=zion165a527w5d0n085t775x3w8n8q20742a6w7xr0z3
export ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702
export ZION_POOL_FEE_WALLET=zion196m4n8x764v7a0s406j40094a8z5j8m6z7nk342

# Pool
export ZION_POOL_BIND=0.0.0.0:8444
export ZION_NODE_RPC_ADDR=127.0.0.1:8443
export ZION_POOL_LOOP_COUNT=1000000
export ZION_NONCE_COUNT=4096
export ZION_VARDIFF_START_DIFF=1
export ZION_VARDIFF_MAX_DIFF=1000000

# Pool wallet
export ZION_POOL_WALLET=zion1l56685k280p364g686j88644g3j4r375755e8p7
export ZION_POOL_PAYOUT_SK_HEX=a3bc7452beb612e2f3a59f85d31905cc2e8e28f3450e4892c9c0ea445e913ee9

# Miner — AMD GPU OpenCL settings
export ZION_GPU_BACKEND=opencl
export ZION_GPU_WORK_SIZE=4096
export ZION_LOOP_COUNT=1000000
export ZION_MINER_THREADS=2

# Miner identity
export ZION_WORKER_NAME=worker1
export ZION_MINER_ID=local-miner-01
EOF
    log_ok "Created ${REPO_ROOT}/.env.zion-native"
}

# ---------------------------------------------------------------------------
# Build native binaries with AMD GPU support
# ---------------------------------------------------------------------------
build_native() {
    log_info "Building native binaries with GPU-OpenCL support..."
    cd "${V3_DIR}"

    # Node
    cargo build --release -p zion-core --bin node
    log_ok "zion-node built"

    # Pool
    cargo build --release -p zion-pool --bin server
    log_ok "zion-pool built"

    # Miner with OpenCL for AMD GPU
    cargo build --release -p zion-miner --features gpu-opencl
    log_ok "zion-miner built (with OpenCL GPU support)"
}

# ---------------------------------------------------------------------------
# Docker: build AMD-aware miner image
# ---------------------------------------------------------------------------
build_docker_amd() {
    log_info "Building Docker images (AMD GPU aware)..."
    cd "${V3_DIR}"

    # Build node + pool (no GPU needed)
    docker build -f docker/Dockerfile.node -t zion-v3-node:latest .
    docker build -f docker/Dockerfile.pool -t zion-v3-pool:latest .

    # Build miner with OpenCL support
    # The Dockerfile.miner-amd has OpenCL runtime
    if [[ -f docker/Dockerfile.miner-amd ]]; then
        docker build -f docker/Dockerfile.miner-amd -t zion-v3-miner:latest .
    else
        docker build -f docker/Dockerfile.miner -t zion-v3-miner:latest .
    fi

    log_ok "Docker images built"
}

# ---------------------------------------------------------------------------
# Run native stack
# ---------------------------------------------------------------------------
run_native() {
    log_info "Starting native ZION V3 stack..."
    source "${REPO_ROOT}/.env.zion-native"
    mkdir -p "$ZION_NODE_STATE_PATH"

    # Launch node in background
    "${V3_DIR}/target/release/node" &
    NODE_PID=$!
    echo "$NODE_PID" > /tmp/zion-node.pid
    log_ok "Node started (PID $NODE_PID) — RPC at http://127.0.0.1:8443"
    sleep 3

    # Launch pool in background
    "${V3_DIR}/target/release/server" &
    POOL_PID=$!
    echo "$POOL_PID" > /tmp/zion-pool.pid
    log_ok "Pool started (PID $POOL_PID) — Stratum at 127.0.0.1:8444"
    sleep 2

    # Launch miner with AMD GPU
    log_info "Launching miner with OpenCL backend..."
    "${V3_DIR}/target/release/zion-miner"
}

# ---------------------------------------------------------------------------
# Run Docker stack
# ---------------------------------------------------------------------------
run_docker() {
    log_info "Starting Docker ZION V3 stack..."
    cd "${DOCKER_DIR}"

    local gpu_type
    gpu_type=$(detect_gpu)

    if [[ "$gpu_type" == "amd" ]]; then
        log_info "AMD GPU detected — using docker-compose with /dev/dri passthrough"
        docker compose --profile mainnet up -d
        log_info "To follow miner logs (GPU): docker compose logs -f miner"
    elif [[ "$gpu_type" == "nvidia" ]]; then
        log_info "NVIDIA GPU detected — using docker-compose with GPU reservations"
        docker compose --profile mainnet up -d
    else
        log_warn "Unknown GPU — starting stack without GPU passthrough (CPU mining only)"
        docker compose --profile mainnet up -d
    fi

    docker compose ps
    log_ok "Stack running. Logs: docker compose logs -f [node|pool|miner]"
}

# ---------------------------------------------------------------------------
# GPU benchmark
# ---------------------------------------------------------------------------
run_benchmark() {
    log_info "Running GPU mining benchmark..."
    source "${REPO_ROOT}/.env.zion-native"

    local miner_bin="${V3_DIR}/target/release/zion-miner"
    if [[ ! -f "$miner_bin" ]]; then
        log_warn "Miner not built. Building now..."
        build_native
    fi

    log_info "=== Ekam Deeksha GPU Benchmark ==="
    export ZION_GPU_WORK_SIZE=4096
    export ZION_GPU_BACKEND=opencl
    "$miner_bin" --ekam-bench

    log_info "=== Legacy GPU Benchmark ==="
    "$miner_bin" --gpu-bench
}

# ---------------------------------------------------------------------------
# Main menu
# ---------------------------------------------------------------------------
show_menu() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║      ZION V3 — Ubuntu Stack Setup & Launcher                 ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║                                                              ║"
    echo "║  GPU detected: $(detect_gpu | tr '[:lower:]' '[:upper:]')                                      ║"
    echo "║                                                              ║"
    echo "║  [1] Full setup (install deps + build + run native)          ║"
    echo "║  [2] Full setup (install deps + build + run Docker)          ║"
    echo "║  [3] Build native binaries only (with GPU-OpenCL)            ║"
    echo "║  [4] Run native stack (assumes already built)                  ║"
    echo "║  [5] Run Docker stack                                        ║"
    echo "║  [6] GPU benchmark                                           ║"
    echo "║  [7] Run cargo tests                                         ║"
    echo "║  [0] Exit                                                    ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
}

main() {
    local gpu_type
    gpu_type=$(detect_gpu)
    log_info "Detected GPU vendor: $gpu_type"

    # Auto mode from CLI arg
    case "${1:-}" in
        --docker)
            install_docker
            setup_env
            build_docker_amd
            run_docker
            exit 0
            ;;
        --native)
            install_rust
            if [[ "$gpu_type" == "amd" ]]; then install_amd_gpu; fi
            if [[ "$gpu_type" == "nvidia" ]]; then install_nvidia_gpu; fi
            setup_env
            build_native
            run_native
            exit 0
            ;;
        --benchmark)
            run_benchmark
            exit 0
            ;;
        --test)
            cd "$V3_DIR"
            cargo test --workspace -- --test-threads=1
            exit 0
            ;;
    esac

    # Interactive menu
    while true; do
        show_menu
        read -rp "Select option: " choice
        case "$choice" in
            1)
                install_rust
                if [[ "$gpu_type" == "amd" ]]; then install_amd_gpu; fi
                if [[ "$gpu_type" == "nvidia" ]]; then install_nvidia_gpu; fi
                setup_env
                build_native
                run_native
                break
                ;;
            2)
                install_docker
                if [[ "$gpu_type" == "amd" ]]; then install_amd_gpu; fi
                if [[ "$gpu_type" == "nvidia" ]]; then install_nvidia_gpu; fi
                setup_env
                build_docker_amd
                run_docker
                break
                ;;
            3)
                install_rust
                if [[ "$gpu_type" == "amd" ]]; then install_amd_gpu; fi
                setup_env
                build_native
                break
                ;;
            4)
                run_native
                break
                ;;
            5)
                run_docker
                break
                ;;
            6)
                run_benchmark
                break
                ;;
            7)
                cd "$V3_DIR"
                cargo test --workspace -- --test-threads=1
                break
                ;;
            0)
                log_info "Exiting."
                exit 0
                ;;
            *)
                log_error "Invalid option"
                ;;
        esac
    done
}

main "$@"
