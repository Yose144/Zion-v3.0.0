#!/bin/bash
# Hiran v2.3 Autonomous Training Launcher
# Run once after SSH login: bash /workspace/hiran-v2.3/scripts/autostart.sh
# Or auto-run via: echo "bash /workspace/hiran-v2.3/scripts/autostart.sh" >> ~/.bashrc

set -euo pipefail

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

HIRAN_DIR="/workspace/hiran-v2.3"
REPO_URL="https://github.com/Yose144/Zion-v3.0.0.git"
LOG_FILE="/workspace/hiran-training.log"
MODEL_NAME="Qwen/Qwen3-32B"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Hiran v2.3 Autonomous Training${NC}"
echo -e "${GREEN}  Base: Qwen3-32B | GPUs: $(nvidia-smi -L 2>/dev/null | wc -l) | Disk: $(df -h / | awk 'NR==2{print $4}')${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# --- 1. System Setup ---
echo -e "${YELLOW}[1/8] System setup...${NC}"
apt-get update -qq
apt-get install -y -qq git wget htop nvtop rsync curl python3-pip python3-venv 2>&1 | tail -5
nvidia-smi --query-gpu=name,memory.total,compute_cap --format=csv,noheader
echo ""

# --- 2. Disk Check ---
echo -e "${YELLOW}[2/8] Disk space check...${NC}"
AVAILABLE=$(df / | awk 'NR==2{print $4}')
if [ "$AVAILABLE" -lt 419430400 ]; then  # 400GB in KB
    echo -e "${RED}WARNING: Only $(df -h / | awk 'NR==2{print $4}') available. Need 400GB+${NC}"
    echo -e "${RED}Expanding filesystem...${NC}"
    # Try to resize if possible
    resize2f /dev/sda1 2>/dev/null || true
fi

# --- 3. Clone Repo ---
echo -e "${YELLOW}[3/8] Cloning repository...${NC}"
if [ ! -d "$HIRAN_DIR/.git" ]; then
    git clone --depth=1 "$REPO_URL" /tmp/zion-repo 2>&1 | tail -3
    mkdir -p "$HIRAN_DIR"
    cp -r /tmp/zion-repo/HiranV2.3/* "$HIRAN_DIR/"
    rm -rf /tmp/zion-repo
fi
cd "$HIRAN_DIR"

# --- 4. Python Environment ---
echo -e "${YELLOW}[4/8] Setting up Python environment...${NC}"
python3 -m venv venv
source venv/bin/activate
pip install -q --upgrade pip 2>&1 | tail -1

# Install training deps
pip install -q transformers accelerate datasets deepspeed 2>&1 | tail -5
pip install -q bitsandbytes peft trl 2>&1 | tail -3

# Verify
echo -e "${GREEN}Python packages OK:${NC}"
python3 -c "import torch; import transformers; import deepspeed; print(f'  PyTorch {torch.__version__} CUDA={torch.cuda.is_available()} GPUs={torch.cuda.device_count()}')"
echo ""

# --- 5. Dataset Validation ---
echo -e "${YELLOW}[5/8] Validating dataset...${NC}"
python3 data/validate_v2.3.py | tee -a "$LOG_FILE"
if [ $? -ne 0 ]; then
    echo -e "${RED}Dataset validation FAILED. Stopping.${NC}"
    exit 1
fi
echo ""

# --- 6. Base Model Pre-download (optional but recommended) ---
echo -e "${YELLOW}[6/8] Checking base model availability...${NC}"
python3 -c "
from transformers import AutoTokenizer
try:
    tok = AutoTokenizer.from_pretrained('$MODEL_NAME', trust_remote_code=True)
    print('  Tokenizer OK')
except Exception as e:
    print(f'  Tokenizer download needed: {e}')
"
echo ""

# --- 7. Dry Run ---
echo -e "${YELLOW}[7/8] Dry run...${NC}"
python3 scripts/train_v2.3_fullft.py --stage all --dry_run | tee -a "$LOG_FILE"
echo ""

# --- 8. Start Training ---
echo -e "${GREEN}[8/8] Starting FULL FINE-TUNING...${NC}"
echo -e "${GREEN}This will take ~36-48 hours. Logs: tail -f $LOG_FILE${NC}"
echo ""

mkdir -p checkpoints logs
export WANDB_DISABLED=true
export CUDA_VISIBLE_DEVICES=0,1

deepspeed --num_gpus=2 scripts/train_v2.3_fullft.py \
  --stage all \
  --deepspeed_config config/deepspeed_zero3.json \
  2>&1 | tee -a "$LOG_FILE"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Training complete!${NC}"
echo -e "${GREEN}  Checkpoints: $HIRAN_DIR/checkpoints/${NC}"
echo -e "${GREEN}  Logs: $LOG_FILE${NC}"
echo -e "${GREEN}========================================${NC}"
