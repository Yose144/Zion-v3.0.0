#!/bin/bash
# Deep Learning Setup for Hiranyagarbha v2 on H100/A100/RTX 4090

echo "--- Starting ZION Deep Learning Environment Setup ---"

# 1. System Updates & Essential Tools
apt-get update && apt-get install -y rsync curl git jq build-essential pkg-config libssl-dev openssh-server

# 2. Rust & LLVM Toolchain (For debugging and code analysis learning)
if ! command -v rustc &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi
rustup component add rust-src llvm-tools-preview

# 3. Python Environment for Fine-tuning
pip install --upgrade pip
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install transformers datasets accelerate peft bitsandbytes sentence-pipeline einops

# 4. Workspace Preparation
mkdir -p /workspace/zion_learning/data
mkdir -p /workspace/zion_learning/docs
mkdir -p /workspace/zion_learning/src

echo "--- System ready for Deep Learning & Fine-tuning ---"
