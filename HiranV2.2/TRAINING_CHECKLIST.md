# Hiran v2.2 — Training Checklist

> One-page reference for launching the 5-stage curriculum training.

---

## Pre-flight (before GPU time)

| # | Check | How |
|---|-------|-----|
| 1 | Dataset exists | `wc -l HiranV2.2/data/curriculum/*.jsonl` → 5001 total |
| 2 | Python ≥3.9 | `python3 --version` |
| 3 | CUDA visible | `nvidia-smi` shows GPU with ≥16 GB VRAM |
| 4 | Disk space | `df -h .` → ≥100 GB free (HF cache + checkpoints) |
| 5 | HF token (optional) | `echo $HF_TOKEN` — only if base model is gated |

---

## Quick Start (local or Vast)

```bash
# 1. Dry run — verify configs & dataset sizes (no GPU load)
cd HiranV2.2
bash scripts/run_training.sh   # DRY_RUN is empty → will start training
# Or explicit dry run:
DRY_RUN=1 bash scripts/run_training.sh

# 2. Real training — all 5 stages, QLoRA, TensorBoard
bash scripts/run_training.sh

# 3. Resume from a specific stage (e.g. after pre-emption)
RESUME_STAGE=zion_core bash scripts/run_training.sh

# 4. Short smoke test (5 steps per stage)
MAX_STEPS=5 bash scripts/run_training.sh

# 5. Full fine-tune (no 4-bit, needs 24 GB+ VRAM)
FULL_FINETUNE=1 bash scripts/run_training.sh
```

---

## Manual run (without the wrapper)

```bash
cd HiranV2.2
pip install -r requirements-train.txt

# Dry run
python3 scripts/train_v2.2.py --dry_run

# Foundation only, 5 steps (smoke)
python3 scripts/train_v2.2.py \
  --stages foundation \
  --max_steps 5 \
  --tensorboard

# All stages
python3 scripts/train_v2.2.py \
  --stages foundation zion_core zion_advanced cross_domain rag_synthesis \
  --tensorboard \
  --logging_steps 10 \
  --save_steps 200

# Resume from zion_core (skips foundation)
python3 scripts/train_v2.2.py \
  --resume_stage zion_core \
  --tensorboard
```

---

## Sync to Vast.ai

```bash
export VAST_SSH="root@ssh5.vast.ai"
export VAST_PORT="31284"
export SSH_IDENTITY="$HOME/.ssh/vast_hiran_key"
export VAST_REMOTE_DIR="/workspace/hiran-v2.2"

bash HiranV2.2/scripts/sync_curriculum_to_vast.sh

# Then on Vast:
cd /workspace/hiran-v2.2
bash scripts/run_training.sh
```

---

## Monitor

```bash
# TensorBoard (local or port-forward from Vast)
tensorboard --logdir HiranV2.2/checkpoints/logs

# Watch GPU usage
watch -n 1 nvidia-smi

# Tail training history
cat HiranV2.2/checkpoints/training_history.json | jq .
```

---

## Stage Quick Reference

| Stage | Pairs | Rank | Epochs | LR | Est. Time (RTX 4090) |
|-------|-------|------|--------|-----|----------------------|
| foundation | 1,021 | 16 | 2 | 2e-4 | ~2 h |
| zion_core | 1,544 | 32 | 3 | 1e-4 | ~5 h |
| zion_advanced | 891 | 32 | 2 | 5e-5 | ~3 h |
| cross_domain | 1,033 | 64 | 2 | 2e-5 | ~4 h |
| rag_synthesis | 512 | 64 | 1 | 1e-5 | ~2 h |

**Total:** ~16 h na RTX 4090 (24 GB)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `CUDA out of memory` | Snížit `batch_size` nebo zapnout gradient checkpointing (už je) |
| `Model not found` | Ověřit `HF_TOKEN` nebo stáhnout base model ručně |
| Training killed (Vast pre-empt) | Skript auto-resume z posledního `checkpoint-*` — spusť znovu |
| Loss diverges (>1.0) | Snížit LR o polovinu, resume z posledního dobrého checkpointu |
| Slow GPU util (<50%) | Zvýšit `batch_size` nebo snížit `gradient_accumulation_steps` |

---

## Post-training

1. **Merge adapters** (volitelné):
   ```bash
   python3 scripts/merge_and_quantize.py \
     --base_model unsloth/Meta-Llama-3.1-8B-Instruct \
     --adapter checkpoints/rag_synthesis/final \
     --output_dir checkpoints/hiran-v2.2-merged
   ```

2. **Quantize**:
   ```bash
   python3 quantization/hybrid_quant.py
   ```

3. **Evaluate**:
   ```bash
   python3 evaluate/evaluate_v2.2.py \
     --model checkpoints/hiran-v2.2-merged \
     --benchmarks perplexity,quality
   ```

4. **Update docs**: označit `HIRAN_V2.2_COMPLETION_PLAN.md` jako hotové.

---

*Last updated: 2026-05-14*
