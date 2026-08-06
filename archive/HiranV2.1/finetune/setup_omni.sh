#!/bin/bash
# ZION MainNet Omni-Learning Setup Script
# This script prepares the environment for Hiranyagarbha v2 Deep Learning

set -e

echo "=== ZION MainNet Omni-Learning Environment Setup ==="

# 1. Install system dependencies
echo "Installing system dependencies..."
apt-get update
apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    libcurl4-openssl-dev \
    libelf-dev \
    libdw-dev \
    cmake \
    git \
    curl \
    wget \
    jq \
    rsync \
    openssh-server

# 2. Install Rust toolchain
echo "Installing Rust toolchain..."
if ! command -v rustc &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

# Add essential Rust components
rustup component add rust-src llvm-tools-preview
rustup target add x86_64-unknown-linux-gnu

# 3. Install Python AI stack
echo "Installing Python AI stack..."
pip install --upgrade pip
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install transformers datasets accelerate peft bitsandbytes sentence-transformers einops

# 4. Install debugging tools
echo "Installing debugging tools..."
apt-get install -y gdb lldb valgrind strace ltrace

# 5. Create workspace structure
echo "Creating workspace structure..."
mkdir -p /workspace/zion_learning/{data,docs,src,models}
mkdir -p /workspace/ai_native_manifest
mkdir -p /workspace/mainnet_architecture

# 6. Copy ZION documentation
echo "Copying ZION documentation..."
if [ -d "/workspace/zion_docs" ]; then
    cp -r /workspace/zion_docs/* /workspace/zion_learning/docs/
fi

# 7. Copy AI Native Manifest
echo "Copying AI Native Manifest..."
if [ -f "/workspace/AI_NATIVE_CONCEPT_2.9.md" ]; then
    cp /workspace/AI_NATIVE_CONCEPT_2.9.md /workspace/ai_native_manifest/
fi

# 8. Copy MainNet source code
echo "Copying MainNet source code..."
if [ -d "/workspace/V3" ]; then
    cp -r /workspace/V3 /workspace/mainnet_architecture/
fi

# 9. Install additional Rust tools for debugging
echo "Installing additional Rust debugging tools..."
cargo install cargo-bloat cargo-llvm-cov

# 10. Final verification
echo "=== Environment Setup Complete ==="
echo "System information:"
uname -a
nvidia-smi
rustc --version
cargo --version
python3 --version
pip list | grep -E "torch|transformers|datasets"

echo ""
echo "=== Ready for Deep Learning ==="
echo "Workspace: /workspace"
echo "AI Native Manifest: /workspace/ai_native_manifest"
echo "MainNet Architecture: /workspace/mainnet_architecture"
echo "Documentation: /workspace/zion_learning/docs"
