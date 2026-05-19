#!/bin/bash
set -euo pipefail

# Hiran v2.3 Training Launcher
# Runs full DORA curriculum training pipeline

echo "========================================"
echo "  Hiran v2.3 DORA Training Pipeline"
echo "========================================"
echo ""

# Check GPU
if ! command -v nvidia-smi &> /dev/null; then
    echo "ERROR: nvidia-smi not found. GPU required."
    exit 1
fi

echo "GPU Status:"
nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader
echo ""

# Install dependencies
echo "Installing dependencies..."
pip install -q transformers accelerate peft bitsandbytes datasets trl tensorboard 2>&1 | tail -3

# Verify torch
echo ""
echo "PyTorch check:"
python3 -c "import torch; print(f'  CUDA available: {torch.cuda.is_available()}'); print(f'  CUDA version: {torch.version.cuda}'); print(f'  Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"CPU\"}')"

# Create workspace
echo ""
echo "Setting up workspace..."
mkdir -p checkpoints logs tensorboard

# Run dry run first
echo ""
echo "Running dry run to verify config..."
python3 scripts/train_v2.3.py --stage all --dry_run

# Training
echo ""
echo "Starting full curriculum training..."
echo "This will take approximately 48-72 hours on 1x A100 80GB"
echo ""

python3 scripts/train_v2.3.py --stage all 2>&1 | tee logs/training_$(date +%Y%m%d_%H%M%S).log

echo ""
echo "========================================"
echo "  Training Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Merge adapters: python3 scripts/merge_model.py --adapter checkpoints/stage3_cross/final"
echo "  2. Evaluate: python3 scripts/evaluate_v2.3.py"
echo "  3. Quantize: python3 scripts/merge_model.py --adapter checkpoints/stage3_cross/final --gguf"
