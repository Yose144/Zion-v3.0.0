#!/usr/bin/env bash
# Deploy Hiran v2.2 trained model to Vast.ai for inference.
#
# Usage:
#   export VAST_SSH="root@ssh7.vast.ai"
#   export VAST_PORT="15084"
#   export SSH_IDENTITY="$HOME/.ssh/vast_hiran_key"
#   export MODEL_PATH="HiranV2.2/checkpoints/foundation/final"
#   bash scripts/deploy_vast.sh

set -euo pipefail

HIRAN22="$(cd "$(dirname "$0")/.." && pwd)"

VAST_SSH="${VAST_SSH:?Set VAST_SSH e.g. root@ssh7.vast.ai}"
VAST_PORT="${VAST_PORT:-22}"
SSH_IDENTITY="${SSH_IDENTITY:-$HOME/.ssh/id_ed25519}"
MODEL_PATH="${MODEL_PATH:-$HIRAN22/checkpoints/foundation/final}"
REMOTE="${VAST_REMOTE_DIR:-/workspace/hiran-v2.2-inference}"

SSH=(ssh -i "$SSH_IDENTITY" -p "$VAST_PORT" -o StrictHostKeyChecking=accept-new)
RSYNC=(rsync -az --mkpath -e "ssh -i $SSH_IDENTITY -p $VAST_PORT -o StrictHostKeyChecking=accept-new")

echo "Deploying Hiran v2.2 to Vast.ai for inference"
echo "Remote: ${VAST_SSH}:${REMOTE}"
echo "Model: $MODEL_PATH"

# Create remote directory structure
"${SSH[@]}" "$VAST_SSH" "mkdir -p '$REMOTE/models' '$REMOTE/inference'"

# Copy model
echo "Copying model..."
"${RSYNC[@]}" "$MODEL_PATH/" "$VAST_SSH:$REMOTE/models/final/"

# Copy inference scripts
echo "Copying inference scripts..."
"${RSYNC[@]}" "$HIRAN22/inference/"*.py "$VAST_SSH:$REMOTE/inference/"

# Copy quantization scripts
echo "Copying quantization scripts..."
"${RSYNC[@]}" "$HIRAN22/quantization/"*.py "$VAST_SSH:$REMOTE/quantization/"

# Create startup script
echo "Creating startup script..."
"${SSH[@]}" "$VAST_SSH" "cat > '$REMOTE/start_inference.sh' << 'EOF'
#!/bin/bash
cd /workspace/hiran-v2.2-inference

# Install dependencies if needed
if ! pip show llama-cpp-python > /dev/null 2>&1; then
    echo "Installing llama-cpp-python..."
    CMAKE_ARGS=\"-DGGML_CUDA=on\" pip install llama-cpp-python
fi

# Start inference server
echo "Starting Hiran v2.2 inference server..."
python3 inference/serve.py --model_path models/final --port 8002
EOF
chmod +x '$REMOTE/start_inference.sh'"

echo "✅ Deployment completed!"
echo ""
echo "On the Vast instance:"
echo "  cd $REMOTE"
echo "  bash start_inference.sh"
