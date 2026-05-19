#!/bin/bash
set -euo pipefail

# Hiran v2.3 FULL FINE-TUNING Launcher
# WARNING: This updates ALL 32.8 billion parameters. NOT LoRA/DORA.

echo "========================================"
echo "  Hiran v2.3 FULL FINE-TUNING"
echo "  Model: Nemotron-32B (32.8B params)"
echo "  Method: DeepSpeed ZeRO-3"
echo "========================================"
echo ""

# Check GPUs
if ! command -v nvidia-smi &> /dev/null; then
    echo "ERROR: nvidia-smi not found. GPU required."
    exit 1
fi

GPU_COUNT=$(nvidia-smi --query-gpu=name --format=csv,noheader | wc -l)
echo "GPUs detected: $GPU_COUNT"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
echo ""

if [ "$GPU_COUNT" -lt 2 ]; then
    echo "WARNING: Only $GPU_COUNT GPU(s) detected!"
    echo "Full fine-tuning 32B requires at least 2x A100 80GB."
    echo "Recommended: 4x A100 80GB"
    echo ""
    echo "Options:"
    echo "  1. Provision more GPUs on Vast.ai"
    echo "  2. Use DORA script instead (train_v2.3.py) for single GPU"
    echo "  3. Continue with aggressive CPU offload (VERY SLOW)"
    echo ""
    read -p "Continue anyway? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Aborted."
        exit 1
    fi
fi

# Install dependencies
echo "Installing dependencies..."
pip install -q transformers accelerate datasets deepspeed tensorboard 2>&1 | tail -3

# Verify torch and deepspeed
echo ""
echo "Environment check:"
python3 -c "
import torch
import deepspeed
print(f'  PyTorch: {torch.__version__}')
print(f'  CUDA available: {torch.cuda.is_available()}')
print(f'  CUDA version: {torch.version.cuda}')
print(f'  GPUs: {torch.cuda.device_count()}')
print(f'  DeepSpeed: {deepspeed.__version__}')
"

# Check DeepSpeed config
DEEPSPEED_CONFIG="config/deepspeed_zero3.json"
if [ ! -f "$DEEPSPEED_CONFIG" ]; then
    echo "ERROR: DeepSpeed config not found: $DEEPSPEED_CONFIG"
    exit 1
fi

# Create workspace
mkdir -p checkpoints logs tensorboard

# Run dry run first
echo ""
echo "Running dry run to verify config..."
python3 scripts/train_v2.3_fullft.py --stage all --dry_run

# Training
echo ""
echo "Starting FULL FINE-TUNING..."
echo "WARNING: This will update ALL 32.8 billion parameters!"
echo "Estimated time: 24-96 hours depending on GPU count"
echo ""

# Launch with DeepSpeed
deepspeed scripts/train_v2.3_fullft.py \
    --stage all \
    --deepspeed_config config/deepspeed_zero3.json \
    2>&1 | tee logs/training_fullft_$(date +%Y%m%d_%H%M%S).log

echo ""
echo "========================================"
echo "  Training Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Evaluate: python3 scripts/evaluate_v2.3.py --model checkpoints/stage1_factual/final"
echo "  2. Quantize to GGUF for inference"
echo "  3. Test factual recall at temperature 0.1"
