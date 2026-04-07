#!/bin/bash
# PPLNS test miner deployment script for VAST.ai GPU instances
# Usage: ./deploy_vast_miner.sh <wallet_address> <worker_name>

set -e

WALLET="${1:?Usage: $0 <wallet_address> <worker_name>}"
WORKER="${2:?Usage: $0 <wallet_address> <worker_name>}"
POOL_ADDR="91.98.122.165:3333"

echo "=== ZION V3 GPU Miner Deployment ==="
echo "Wallet: $WALLET"
echo "Worker: $WORKER"
echo "Pool:   $POOL_ADDR"

# Ensure Rust is available
export PATH="$HOME/.cargo/bin:$PATH"
if ! command -v cargo &>/dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# Clone repo if not present
if [ ! -d "/root/zion" ]; then
    echo "Cloning ZION repo..."
    cd /root
    git clone --depth 1 https://github.com/Yose144/2.9.6.git zion
fi

cd /root/zion

# Check for OpenCL (prefer over CUDA for compatibility)
FEATURES=""
if [ -f /usr/lib/x86_64-linux-gnu/libOpenCL.so ] || ldconfig -p 2>/dev/null | grep -q libOpenCL; then
    echo "OpenCL detected, building with gpu-opencl"
    FEATURES="gpu-opencl"
    apt-get install -y ocl-icd-opencl-dev 2>/dev/null || true
elif nvidia-smi &>/dev/null; then
    echo "NVIDIA GPU detected, building with gpu-cuda"
    FEATURES="gpu-cuda"
else
    echo "No GPU libraries found, building CPU-only"
fi

# Build the miner
echo "Building zion-miner (features: ${FEATURES:-none})..."
if [ -n "$FEATURES" ]; then
    cargo build --release -p zion-miner --features "$FEATURES" 2>&1
else
    cargo build --release -p zion-miner 2>&1
fi

echo "Build complete!"

# Run the miner
echo "Starting miner..."
export ZION_POOL_ADDR="$POOL_ADDR"
export ZION_MINER_ID="$WALLET"
export ZION_WORKER_NAME="$WORKER"
export ZION_LOOP_COUNT=4294967295
export ZION_NONCE_AUTOTUNE=true
export ZION_NONCE_COUNT=100000
export ZION_MAX_RECONNECT=0
export ZION_RECONNECT=true
export ZION_READ_TIMEOUT_SECS=1200
export ZION_JOB_TTL_MS=1200000
export ZION_MINER_VERBOSE=1
export RUST_LOG=info

exec /root/zion/target/release/zion-miner
