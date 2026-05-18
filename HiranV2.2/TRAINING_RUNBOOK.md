# Hiran v2.2 — Training Runbook (Autonomous)

> **Instance:** Vast.ai contract #37028568
> **SSH:** `ssh -i ~/.ssh/vast_hiran_key -p 28568 root@ssh7.vast.ai`
> **GPU:** 1x RTX 4090 (24 GB VRAM)
> **Cost:** ~$0.46/hr
> **Dataset:** 22,181 pairs across 5 curriculum stages

---

## 1. Quick Connect

```bash
# Connect to instance
ssh -i ~/.ssh/vast_hiran_key -p 28568 -o StrictHostKeyChecking=no root@ssh7.vast.ai

# On instance
cd /workspace/hiran-v2.2
```

## 2. Environment Setup

```bash
# Check CUDA
nvidia-smi

# Install dependencies
pip install -r requirements-train.txt

# Verify
python3 -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

## 3. Dry Run (verify config)

```bash
python3 scripts/train_v2.2.py --dry_run
```

Expected output: all 5 stages listed with row counts.

## 4. Full Curriculum Training

```bash
# All 5 stages with TensorBoard
bash scripts/run_training.sh

# Or manual:
python3 scripts/train_v2.2.py \
  --base_model unsloth/Meta-Llama-3.1-8B-Instruct \
  --data_dir data/curriculum \
  --output_dir checkpoints \
  --tensorboard \
  --logging_steps 10 \
  --save_steps 500
```

**Stages:**
1. `foundation` — 3,869 pairs (blockchain basics)
2. `zion_core` — 2,368 pairs (node, pool, miner, L1)
3. `zion_advanced` — 2,458 pairs (deploy, bridge, DAO, L2/L3)
4. `cross_domain` — 11,434 pairs (AI Native, Hiran, Oasis, Rust)
5. `rag_synthesis` — 2,052 pairs (status, roadmaps, guides)

**Estimated time:** ~12-18 hours for all stages on RTX 4090

## 5. Monitoring

```bash
# TensorBoard
tensorboard --logdir checkpoints/logs --bind_all

# Or just watch logs
tail -f checkpoints/training_history.json
```

## 6. Post-Training

```bash
# Merge + quantize
python3 scripts/merge_and_quantize.py \
  --base_model unsloth/Meta-Llama-3.1-8B-Instruct \
  --adapter checkpoints/rag_synthesis/final \
  --output hiran-v2.2-merged

# Evaluate
python3 evaluate/evaluate_v2.2.py --model hiran-v2.2-merged
```

## 7. Download to Local

```bash
# From local machine
rsync -avz -e "ssh -i ~/.ssh/vast_hiran_key -p 28568" \
  root@ssh7.vast.ai:/workspace/hiran-v2.2/checkpoints/ \
  ./HiranV2.2/checkpoints_vast/
```

## 8. Shutdown Instance

```bash
# On local machine
vastai destroy instance 37028568
```

---

*Generated: 2026-05-18*
