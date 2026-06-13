# Hiran v2.3 Pre-Flight Checklist — Vast.ai Training

> **Purpose:** Verify everything before spending $300-500 on GPU cluster rental.  
> **Last Updated:** 2026-06-13  
> **Status:** Ready for execution (dataset complete, scripts ready, awaiting GPU)

---

## 1. Dataset Validation (Local, 5 min)

```bash
cd /path/to/repo
python HiranV2.3/data/validate_v2.3.py
```

**Expected:** ALL CHECKS PASSED  
**What it checks:**
- All 10 critical facts present (89%, 5%, 1%, 7 categories, L1-L6, WARP, Issobella, hardcoded, quadratic, PPLNS)
- Category balance (drill patterns ~30-40%)
- No empty instructions/outputs
- Duplicate ratio acceptable
- Response length distribution OK
- Fee split variety (>500 questions, >10 unique phrasings)

**If fails:** Fix dataset generators and rebuild before training.

---

## 2. Script Dry-Run (Local, 2 min)

### DORA fallback:
```bash
python HiranV2.3/scripts/train_v2.3.py --stage all --dry_run
```

### Full FT:
```bash
python HiranV2.3/scripts/train_v2.3_fullft.py --stage all --dry_run
```

**Expected:** Config prints without errors.  
**What it verifies:** Python dependencies, path resolution, config parsing.

---

## 3. Vast.ai Instance Selection

**Target spec:**

| Requirement | Minimum | Recommended |
|---|---|---|
| GPU | 2x A100 80GB | 4x A100 80GB |
| VRAM total | 160 GB | 320 GB |
| CPU RAM | 128 GB | 256 GB+ |
| Disk | 300 GB | 500 GB NVMe |
| Cost/hr | ~$3.00 | ~$6.00 |

**Search query on Vast.ai:**
```
gpu_name:A100 num_gpus:4 reliability>0.9 disk_space>500
```

**Pre-booking tip:** Instances disappear fast. Have backup options (2x A100 + CPU offload, or 8x A40 as last resort).

---

## 4. Environment Setup (On Vast.ai instance, 10 min)

```bash
# 1. Clone repo (or rsync from local)
git clone https://github.com/Yose144/Zion-v3.0.0.git
# OR: rsync -avz --exclude='*.gguf' --exclude='checkpoints' local/HiranV2.3/ remote:/workspace/hiran-v2.3/

# 2. Install dependencies
pip install transformers accelerate datasets deepspeed
pip install bitsandbytes peft trl  # For DORA fallback only

# 3. Optional but recommended
pip install flash-attn --no-build-isolation

# 4. Verify GPU visibility
python -c "import torch; print(f'GPUs: {torch.cuda.device_count()}')"
```

---

## 5. DeepSpeed Config Verification

```bash
cat HiranV2.3/config/deepspeed_zero3.json
```

**Critical settings:**
- `zero_optimization.stage`: 3
- `offload_optimizer.device`: cpu
- `offload_param.device`: cpu
- `bf16.enabled`: true
- `gradient_clipping`: auto (will be set by TrainingArguments)

---

## 6. Base Model Download (On instance, 15-30 min)

```bash
python -c "
from transformers import AutoTokenizer
AutoTokenizer.from_pretrained('nvidia/OpenReasoning-Nemotron-32B', trust_remote_code=True)
print('Tokenizer OK')
"
```

**Disk space check:** Model is ~64 GB (BF16 weights). Ensure 100+ GB free before training starts.

---

## 7. Dataset Upload / Verification

```bash
# Check dataset line count
wc -l HiranV2.3/data/curriculum/v2.3_combined_dataset.jsonl
# Expected: 48436

# Check file sizes
ls -lh HiranV2.3/data/curriculum/
```

---

## 8. Training Launch (Full FT)

```bash
cd /workspace/Zion-v3.0.0  # or wherever repo is

deepspeed --num_gpus=4 HiranV2.3/scripts/train_v2.3_fullft.py \
  --stage all \
  --deepspeed_config HiranV2.3/config/deepspeed_zero3.json
```

**Monitor:**
- `nvidia-smi` — GPU utilization should be >90%
- `tail -f checkpoints/stage1_factual/training.log` — loss should decrease
- DeepSpeed logs — no OOM, no gradient overflow warnings

---

## 9. Checkpointing & Recovery

**Auto-save:** Every 500 steps (configurable in `train_v2.3_fullft.py`).  
**Resume from crash:**
```bash
deepspeed --num_gpus=4 HiranV2.3/scripts/train_v2.3_fullft.py \
  --stage all \
  --deepspeed_config HiranV2.3/config/deepspeed_zero3.json
# DeepSpeed auto-resumes from latest checkpoint in output_dir
```

---

## 10. Post-Training (Evaluation + Quantization)

```bash
# 1. Evaluate
python HiranV2.3/scripts/evaluate.py \
  --model_path checkpoints/stage1_factual/final \
  --benchmarks all

# 2. Benchmark factual recall
python HiranV2.3/scripts/benchmark_factual.py \
  --model_path checkpoints/stage1_factual/final

# 3. Quantize to GGUF
python HiranV2.3/scripts/quantize.py \
  --checkpoint checkpoints/stage1_factual/final \
  --formats gguf \
  --output_dir HiranV2.3/models
```

---

## 11. Known Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 4x A100 unavailable | Medium | Pre-book; fallback 2x A100 + CPU offload; DORA as last resort |
| Full FT OOM on single GPU | High | DeepSpeed ZeRO-3 + CPU offload; reduce batch to 1; increase grad accum |
| Training interrupted | Medium | Checkpoint every 500 steps; auto-resume from latest |
| 43K dataset overfits | Low | Only 3 epochs; weight decay 0.01; eval every 200 steps |
| Model still hallucinates | Low | Massive drill patterns (5,302 pairs); 200x repetition of key facts |
| Czech output poor | Medium | 2,015 bilingual pairs; evaluate separately on Czech test set |
| Vast.ai instance terminated | Medium | rsync checkpoints every hour to persistent storage |

---

## 12. Cost Estimate

| Phase | Duration | Cost (4x A100) |
|-------|----------|----------------|
| Dataset validation | Local | $0 |
| Full FT (3 epochs) | 48-72h | $288-432 |
| Evaluation | 4h | $24 |
| Quantization | 2h | $12 |
| **Total** | **~54-78h** | **~$324-468** |

---

## Sign-Off

Before launching, confirm:

- [ ] Dataset validation passed
- [ ] Dry-run completed without errors
- [ ] Vast.ai instance booked and accessible
- [ ] Base model tokenizer downloaded successfully
- [ ] Disk space > 200 GB free
- [ ] `nvidia-smi` shows all GPUs
- [ ] Backup strategy for checkpoints (rsync to persistent volume)
- [ ] Cost budget approved ($500 max)

---

*Checklist created: 2026-06-13*  
*Next review: Before every training run*
