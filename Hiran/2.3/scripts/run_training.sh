#!/usr/bin/env bash
# Hiran v2.2 — unified curriculum training launcher.
# Works locally or on a fresh Vast.ai / RunPod / bare-metal GPU node.
#
# Usage:
#   cd HiranV2.2
#   bash scripts/run_training.sh
#
# Environment overrides:
#   STAGES            space-separated list  (default: all 5)
#   BASE_MODEL        HF model ID           (default: unsloth/Meta-Llama-3.1-8B-Instruct)
#   OUTPUT_DIR        checkpoint root         (default: checkpoints)
#   MAX_STEPS         cap steps per stage     (unset = full epochs)
#   RESUME_STAGE      skip earlier stages     (unset = start from beginning)
#   DRY_RUN           1 = config dump only    (unset = real training)
#   FULL_FINETUNE     1 = disable 4-bit       (unset = QLoRA)
#   HF_HOME           HF cache dir            (default: /workspace/.cache/huggingface)
#   HF_TOKEN          HuggingFace token       (optional, for gated models)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HIRAN22="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$HIRAN22"

STAGES="${STAGES:-foundation zion_core zion_advanced cross_domain rag_synthesis}"
BASE_MODEL="${BASE_MODEL:-unsloth/Meta-Llama-3.1-8B-Instruct}"
OUTPUT_DIR="${OUTPUT_DIR:-$HIRAN22/checkpoints}"
DATA_DIR="${DATA_DIR:-$HIRAN22/data/curriculum}"
MAX_STEPS="${MAX_STEPS:-}"
RESUME_STAGE="${RESUME_STAGE:-}"
DRY_RUN="${DRY_RUN:-}"
FULL_FINETUNE="${FULL_FINETUNE:-}"
HF_HOME="${HF_HOME:-/workspace/.cache/huggingface}"

export HF_HOME
if [[ -n "${HF_TOKEN:-}" ]]; then
  export HF_TOKEN
  echo "HF_TOKEN is set (gated model access enabled)"
fi

# ── 0. Python / venv check ────────────────────────────────────────────────────
PYTHON="${PYTHON:-python3}"
if ! command -v "$PYTHON" &>/dev/null; then
  echo "ERROR: Python not found ($PYTHON)" >&2
  exit 1
fi
PY_VER=$($PYTHON -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "Python version: $PY_VER"

# ── 1. Install dependencies ───────────────────────────────────────────────────
echo ""
echo "=== Installing / verifying dependencies ==="
pip install -q --upgrade pip
pip install -q -r "$HIRAN22/requirements-train.txt"

# ── 2. Quick GPU sanity check ─────────────────────────────────────────────────
echo ""
echo "=== GPU check ==="
$PYTHON - <<'PYEOF'
import torch, sys
print(f"PyTorch: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"CUDA version: {torch.version.cuda}")
    for i in range(torch.cuda.device_count()):
        print(f"  GPU {i}: {torch.cuda.get_device_name(i)}")
else:
    print("WARNING: No CUDA GPU detected — training will be extremely slow!")
PYEOF

# ── 2.5 Data sanity check ────────────────────────────────────────────────────
echo ""
echo "=== Data check ==="
MISSING=0
for stage in $STAGES; do
  f="$DATA_DIR/${stage}.jsonl"
  if [[ -f "$f" ]]; then
    lines=$(wc -l < "$f" | tr -d ' ')
    echo "  $stage: $lines rows"
  else
    echo "  $stage: MISSING ($f)"
    MISSING=$((MISSING + 1))
  fi
done
if [[ $MISSING -gt 0 ]]; then
  echo "ERROR: $MISSING stage data files missing. Run dataset preparation first." >&2
  exit 1
fi

# ── 3. Dry-run (config + dataset sizes) ─────────────────────────────────────
echo ""
echo "=== Dry run ==="
DRY_ARG=""
if [[ "$DRY_RUN" == "1" ]]; then
  DRY_ARG="--dry_run"
fi

$PYTHON "$HIRAN22/scripts/train_v2.2.py" \
  --base_model "$BASE_MODEL" \
  --data_dir "$DATA_DIR" \
  --output_dir "$OUTPUT_DIR" \
  --stages $STAGES \
  $DRY_ARG

if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry run complete. Set DRY_RUN= to start real training."
  exit 0
fi

# ── 4. Build training CLI ─────────────────────────────────────────────────────
echo ""
echo "=== Starting curriculum training ==="
TRAIN_CMD="$PYTHON $HIRAN22/scripts/train_v2.2.py \
  --base_model $BASE_MODEL \
  --data_dir $DATA_DIR \
  --output_dir $OUTPUT_DIR \
  --stages $STAGES \
  --tensorboard \
  --logging_steps 10 \
  --save_steps 200"

if [[ -n "$MAX_STEPS" ]]; then
  TRAIN_CMD="$TRAIN_CMD --max_steps $MAX_STEPS"
fi

if [[ -n "$RESUME_STAGE" ]]; then
  TRAIN_CMD="$TRAIN_CMD --resume_stage $RESUME_STAGE"
fi

if [[ "$FULL_FINETUNE" == "1" ]]; then
  TRAIN_CMD="$TRAIN_CMD --full_finetune"
fi

echo "Command: $TRAIN_CMD"
echo ""

# ── 5. Run with trap for graceful save on SIGTERM (Vast pre-empt) ─────────
trap 'echo "SIGTERM/SIGINT caught — training will exit after current step (Trainer handles checkpoint save)."' SIGTERM SIGINT

eval "$TRAIN_CMD"

echo ""
echo "=== Training finished ==="
echo "Checkpoints: $OUTPUT_DIR"
echo "TensorBoard: tensorboard --logdir $OUTPUT_DIR/logs"
