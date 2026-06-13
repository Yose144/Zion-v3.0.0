#!/bin/bash
# Hiran v2.3 Autonomous Training Launcher
# Full autonomous pipeline: setup → validate → train → evaluate → quantize
# Run: bash /workspace/hiran-v2.3/scripts/autostart.sh
# Auto-run on login: echo "bash /workspace/hiran-v2.3/scripts/autostart.sh" >> ~/.bashrc

set -euo pipefail

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

HIRAN_DIR="/workspace/hiran-v2.3"
REPO_URL="https://github.com/Yose144/Zion-v3.0.0.git"
LOG_FILE="/workspace/hiran-training.log"
MODEL_NAME="Qwen/Qwen3-32B"
FINAL_CHECKPOINT="$HIRAN_DIR/checkpoints/stage1_factual/final"

log() { echo -e "${GREEN}[$(date '+%H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[$(date '+%H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"; exit 1; }

# Prevent double-run
LOCK_FILE="/tmp/hiran-autostart.lock"
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE" 2>/dev/null)
    if ps -p "$PID" > /dev/null 2>&1; then
        log "Training already running (PID $PID). Exiting."
        log "Monitor: tail -f $LOG_FILE"
        exit 0
    fi
fi
echo $$ > "$LOCK_FILE"

log "========================================"
log "  Hiran v2.3 Autonomous Training"
log "  Base: Qwen3-32B | GPUs: $(nvidia-smi -L 2>/dev/null | wc -l) | Disk: $(df -h / | awk 'NR==2{print $4}')"
log "  Start: $(date)"
log "========================================"

# --- 1. System Setup ---
log "[1/10] System setup..."
apt-get update -qq
apt-get install -y -qq git wget htop nvtop rsync curl python3-pip python3-venv p7zip-full 2>&1 | tail -3
nvidia-smi --query-gpu=name,memory.total,compute_cap,temperature.gpu --format=csv,noheader || true
log "System ready"

# --- 2. Disk Check ---
log "[2/10] Disk space check..."
AVAILABLE_GB=$(df / | awk 'NR==2{printf "%.0f", $4/1024/1024}')
log "Available disk: ${AVAILABLE_GB} GB"
if [ "$AVAILABLE_GB" -lt 300 ]; then
    error "Only ${AVAILABLE_GB}GB available. Need 300GB+. Cannot continue."
fi
if [ "$AVAILABLE_GB" -lt 400 ]; then
    warn "Only ${AVAILABLE_GB}GB available. Training possible but checkpoint cleanup recommended mid-training."
fi

# --- 3. Clone Repo ---
log "[3/10] Cloning repository..."
if [ ! -f "$HIRAN_DIR/scripts/train_v2.3_fullft.py" ]; then
    # Save our autostart.sh before removing dir
    cp "$HIRAN_DIR/scripts/autostart.sh" /tmp/autostart.sh.backup 2>/dev/null || true
    if [ -d "$HIRAN_DIR" ]; then
        rm -rf "$HIRAN_DIR"
    fi
    git clone --depth=1 "$REPO_URL" /tmp/zion-repo 2>&1 | tail -5
    mkdir -p "$HIRAN_DIR"
    cp -r /tmp/zion-repo/HiranV2.3/* "$HIRAN_DIR/"
    rm -rf /tmp/zion-repo
    # Restore our autostart.sh
    cp /tmp/autostart.sh.backup "$HIRAN_DIR/scripts/autostart.sh" 2>/dev/null || true
    log "Repository cloned"
else
    log "Repository already exists"
fi
cd "$HIRAN_DIR"

# --- 4. Python Environment ---
log "[4/10] Setting up Python environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q --upgrade pip 2>&1 | tail -1

# Core training deps
log "  Installing transformers, accelerate, datasets, deepspeed..."
pip install -q transformers accelerate datasets deepspeed 2>&1 | tail -3

# Optional: flash-attn for speedup
echo "  Installing flash-attn (optional, may take 5-10 min)..."
pip install -q flash-attn --no-build-isolation 2>&1 | tail -3 || warn "flash-attn install failed, continuing without"

# Verify
cat > /tmp/verify_deps.py << 'PYEOF'
import sys
try:
    import torch
    import transformers
    import deepspeed
    import datasets
    print(f"  PyTorch {torch.__version__} CUDA={torch.cuda.is_available()} GPUs={torch.cuda.device_count()}")
    print(f"  Transformers {transformers.__version__}")
    print(f"  DeepSpeed {deepspeed.__version__}")
    sys.exit(0)
except Exception as e:
    print(f"  ERROR: {e}")
    sys.exit(1)
PYEOF
python3 /tmp/verify_deps.py || error "Dependency verification failed"
rm /tmp/verify_deps.py
log "Environment ready"

# --- 5. Dataset Validation ---
log "[5/10] Validating dataset..."
python3 data/validate_v2.3.py 2>&1 | tee -a "$LOG_FILE"
if [ "${PIPESTATUS[0]}" -ne 0 ]; then
    error "Dataset validation FAILED. Check data/curriculum/"
fi
log "Dataset OK — $(wc -l < data/curriculum/v2.3_combined_dataset.jsonl) pairs"

# --- 6. Base Model Pre-download ---
log "[6/10] Pre-downloading base model tokenizer..."
python3 -c "
from transformers import AutoTokenizer
import os
cache_dir = '/workspace/.cache/huggingface'
os.makedirs(cache_dir, exist_ok=True)
try:
    tok = AutoTokenizer.from_pretrained('$MODEL_NAME', trust_remote_code=True, cache_dir=cache_dir)
    print('  Tokenizer cached OK')
except Exception as e:
    print(f'  Warning: {e}')
"
log "Model tokenizer ready"

# --- 7. Resume Check ---
log "[7/10] Checking for existing checkpoints..."
RESUME_FROM=""
if [ -d "$FINAL_CHECKPOINT" ] && [ "$(ls -A "$FINAL_CHECKPOINT")" ]; then
    log "  Found existing final checkpoint! Training already complete."
    SKIP_TRAIN=1
else
    # Find latest intermediate checkpoint
    LATEST_CKPT=$(find checkpoints/stage1_factual -maxdepth 1 -name "checkpoint-*" -type d 2>/dev/null | sort -V | tail -1)
    if [ -n "$LATEST_CKPT" ]; then
        warn "  Found checkpoint: $(basename "$LATEST_CKPT")"
        warn "  DeepSpeed will auto-resume from this checkpoint."
        RESUME_FROM="$LATEST_CKPT"
    else
        log "  No checkpoints found. Starting from scratch."
    fi
    SKIP_TRAIN=0
fi

# --- 8. Dry Run ---
if [ "$SKIP_TRAIN" -eq 0 ]; then
    log "[8/10] Dry run to verify config..."
    python3 scripts/train_v2.3_fullft.py --stage all --dry_run 2>&1 | tee -a "$LOG_FILE"
    log "Dry run OK"
else
    log "[8/10] SKIPPED — Training already complete"
fi

# --- 9. Training ---
if [ "$SKIP_TRAIN" -eq 0 ]; then
    log "[9/10] Starting FULL FINE-TUNING Qwen3-32B..."
    log "  This will take ~36-48 hours"
    log "  Monitor: tail -f $LOG_FILE"
    log "  DeepSpeed ZeRO-3 will auto-save every 500 steps"
    log "  Crash recovery: DeepSpeed auto-resumes from latest checkpoint"
    echo ""

    mkdir -p checkpoints logs
    export WANDB_DISABLED=true
    export CUDA_VISIBLE_DEVICES=0,1
    export HF_HOME=/workspace/.cache/huggingface
    export TRANSFORMERS_CACHE=/workspace/.cache/huggingface

    # Trap signals for graceful shutdown
    cleanup() {
        log "Received shutdown signal. DeepSpeed will save checkpoint and exit."
        exit 0
    }
    trap cleanup SIGTERM SIGINT

    deepspeed --num_gpus=2 scripts/train_v2.3_fullft.py \
      --stage all \
      --deepspeed_config config/deepspeed_zero3.json \
      2>&1 | tee -a "$LOG_FILE"

    TRAIN_EXIT=${PIPESTATUS[0]}
    if [ "$TRAIN_EXIT" -ne 0 ]; then
        error "Training failed with exit code $TRAIN_EXIT. Check $LOG_FILE"
    fi
    log "Training completed successfully!"
else
    log "[9/10] SKIPPED — Using existing checkpoint"
fi

# --- 10. Post-Training Pipeline ---
log "[10/10] Post-training: evaluation + quantization + packaging"

# Check if final checkpoint exists
if [ ! -d "$FINAL_CHECKPOINT" ] || [ ! "$(ls -A "$FINAL_CHECKPOINT")" ]; then
    # Find latest checkpoint as fallback
    FINAL_CHECKPOINT=$(find checkpoints/stage1_factual -maxdepth 1 -name "checkpoint-*" -type d | sort -V | tail -1)
    if [ -z "$FINAL_CHECKPOINT" ]; then
        error "No checkpoint found for evaluation!"
    fi
    warn "Using latest checkpoint: $(basename "$FINAL_CHECKPOINT")"
fi

log "  Checkpoint: $(basename "$FINAL_CHECKPOINT")"

# Evaluation
echo ""
log "  Running evaluation..."
mkdir -p evaluation_results
python3 scripts/evaluate.py \
  --model_path "$FINAL_CHECKPOINT" \
  --benchmarks all \
  --output_dir evaluation_results 2>&1 | tee -a "$LOG_FILE" || warn "Evaluation had issues"

# Factual benchmark
echo ""
log "  Running factual recall benchmark..."
mkdir -p benchmark_results
python3 scripts/benchmark_factual.py \
  --model_path "$FINAL_CHECKPOINT" 2>&1 | tee -a "$LOG_FILE" || warn "Benchmark had issues"

# Quantization
echo ""
log "  Quantizing to GGUF..."
mkdir -p models
python3 scripts/quantize.py \
  --checkpoint "$FINAL_CHECKPOINT" \
  --formats gguf \
  --output_dir models 2>&1 | tee -a "$LOG_FILE" || warn "Quantization had issues"

# Package everything
echo ""
log "  Packaging results..."
PACKAGE_DIR="/workspace/hiran-v2.3-release"
mkdir -p "$PACKAGE_DIR"

# Copy key files
[ -d "$FINAL_CHECKPOINT" ] && cp -r "$FINAL_CHECKPOINT" "$PACKAGE_DIR/model-bf16/"
[ -d "models" ] && cp -r models/ "$PACKAGE_DIR/models-gguf/"
[ -d "evaluation_results" ] && cp -r evaluation_results/ "$PACKAGE_DIR/"
[ -d "benchmark_results" ] && cp -r benchmark_results/ "$PACKAGE_DIR/"
cp data/curriculum/v2.3_combined_dataset.jsonl "$PACKAGE_DIR/" 2>/dev/null || true
cp config/curriculum_v2.3.json "$PACKAGE_DIR/" 2>/dev/null || true
cp requirements-train.txt "$PACKAGE_DIR/" 2>/dev/null || true

# Create README
cat > "$PACKAGE_DIR/README.txt" << 'EOF'
Hiran v2.3 — Trained Model Release
====================================
Base: Qwen/Qwen3-32B (32.8B params)
Method: DeepSpeed ZeRO-3 Full Fine-Tuning
Hardware: 2x NVIDIA A100 SXM4 80GB

Contents:
  model-bf16/      — Full precision model (BF16, ~65 GB)
  models-gguf/     — Quantized models for inference
  evaluation_results/ — Benchmark scores
  benchmark_results/  — Factual recall tests
  v2.3_combined_dataset.jsonl — Training dataset

GGUF Models:
  hiran-v2.3-q4_k_m.gguf — ~16-20 GB, good balance
  hiran-v2.3-q5_k_m.gguf — ~20-25 GB, higher quality

Inference (llama.cpp):
  ./main -m hiran-v2.3-q4_k_m.gguf --color -f prompt.txt

Inference (Transformers):
  from transformers import AutoModelForCausalLM, AutoTokenizer
  model = AutoModelForCausalLM.from_pretrained("model-bf16/", trust_remote_code=True)
EOF

# Size report
echo "" >> "$LOG_FILE"
echo "=== PACKAGE CONTENTS ===" >> "$LOG_FILE"
du -sh "$PACKAGE_DIR/"/* 2>/dev/null | tee -a "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Summary
log "========================================"
log "  HIRAN V2.3 TRAINING COMPLETE!"
log "========================================"
log "  Model (BF16):   $PACKAGE_DIR/model-bf16/"
log "  Model (GGUF):   $PACKAGE_DIR/models-gguf/"
log "  Evaluations:    $PACKAGE_DIR/evaluation_results/"
log "  Benchmarks:     $PACKAGE_DIR/benchmark_results/"
log "  Full log:       $LOG_FILE"
log ""
log "  To download to your local PC:"
log "    rsync -avz -e 'ssh -p <PORT> -i ~/.ssh/vast/hiran_v2.3_key' \\"
log "      root@ssh5.vast.ai:/workspace/hiran-v2.3-release/ \\"
log "      ~/HiranV2.3-Release/"
log ""
log "  To destroy instance (stop billing):"
log "    curl -X DELETE 'https://console.vast.ai/api/v0/instances/40780492/?api_key=<API_KEY>'"
log ""
log "  End: $(date)"
log "========================================"

# Remove lock
rm -f "$LOCK_FILE"
