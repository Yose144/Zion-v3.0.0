# Hiran v2.2 — Autonomous Training Plan

> **Created:** 2026-05-18  
> **Agent:** Devin (Kimi K2.6)  
> **Status:** Instance provisioned, awaiting SSH readiness

---

## 1. What We Built (Session History)

### Dataset Generation
- Created `HiranV2.2/scripts/build_curriculum.py` — robust local dataset builder.
- Scanned **698 files** from the ZION repo including `docs/docs2.9/ZION_OASIS/` (219 .md docs).
- Generated **22,181 unique instruction/output pairs** with multi-variant Q&A.
- 5 curriculum stages:
  - `foundation`: 3,869 pairs (blockchain basics, ZION overview)
  - `zion_core`: 2,368 pairs (node, pool, miner, consensus, CLI)
  - `zion_advanced`: 2,458 pairs (deploy, bridge, DAO, warp, monitoring)
  - `cross_domain`: 11,434 pairs (AI Native, Hiran, Oasis, Rust programming)
  - `rag_synthesis`: 2,052 pairs (status, roadmaps, audits, guides)

### Vast.ai Instance
- **Contract ID:** `37028568` (Iceland RTX 4090)
- **GPU:** 1x RTX 4090 (24 GB VRAM)
- **Cost:** ~$0.46/hr
- **Image:** `pytorch/pytorch:2.3.0-cuda12.1-cudnn8-runtime`
- **Status:** `loading` (wait for SSH readiness before sync)

### Access Credentials (local machine only — NOT committed)

| Credential | Location | Notes |
|------------|----------|-------|
| Vast API Key | Environment / local memory | Used for instance management |
| SSH Private Key | `~/.ssh/vast_hiran_key` | Ed25519, attached to instance |
| SSH Public Key | `~/.ssh/vast_hiran_key.pub` | Registered in Vast account |
| SSH Host | `ssh1.vast.ai` | Dynamic per instance |
| SSH Port | `24132` | Dynamic per instance |

### Committed Artifacts
- `HiranV2.2/scripts/build_curriculum.py` — dataset builder
- `HiranV2.2/scripts/sync_to_current_vast.sh` — sync to this instance
- `HiranV2.2/TRAINING_RUNBOOK.md` — step-by-step training guide
- `HiranV2.2/data/curriculum/*.jsonl` — 22K training pairs
- `HIRAN_V2.2_COMPLETION_PLAN.md` — updated status

---

## 2. Autonomous Execution Steps

When the user says "go autonomous", execute in this order:

### Step 1: Wait for SSH readiness
Loop until this succeeds:
```bash
ssh -i ~/.ssh/vast_hiran_key -p 28568 -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 \
  root@ssh7.vast.ai "echo ready"
```

### Step 2: Sync data + scripts
```bash
bash HiranV2.2/scripts/sync_to_current_vast.sh
```

### Step 3: Connect and setup environment
```bash
ssh -i ~/.ssh/vast_hiran_key -p 28568 -o StrictHostKeyChecking=no \
  root@ssh7.vast.ai

cd /workspace/hiran-v2.2
nvidia-smi
pip install -r requirements-train.txt
python3 -c "import torch; print(torch.cuda.is_available())"
```

### Step 4: Dry run
```bash
python3 scripts/train_v2.2.py --dry_run
```

### Step 5: Full training (all 5 stages)
```bash
bash scripts/run_training.sh
# OR manually:
python3 scripts/train_v2.2.py \
  --base_model unsloth/Meta-Llama-3.1-8B-Instruct \
  --data_dir data/curriculum \
  --output_dir checkpoints \
  --tensorboard --logging_steps 10 --save_steps 500
```

### Step 6: Monitor & poll
Every 5-10 minutes check:
```bash
ssh -i ~/.ssh/vast_hiran_key -p 28568 -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null root@ssh7.vast.ai \
  "tail -n 20 /workspace/hiran-v2.2/checkpoints/training_history.json"
```

### Step 7: Post-training
```bash
# On instance
python3 scripts/merge_and_quantize.py \
  --base_model unsloth/Meta-Llama-3.1-8B-Instruct \
  --adapter checkpoints/rag_synthesis/final \
  --output hiran-v2.2-merged

python3 evaluate/evaluate_v2.2.py --model hiran-v2.2-merged
```

### Step 8: Download artifacts
```bash
rsync -avz -e "ssh -i ~/.ssh/vast_hiran_key -p 28568" \
  root@ssh7.vast.ai:/workspace/hiran-v2.2/checkpoints/ \
  ./HiranV2.2/checkpoints_vast/

rsync -avz -e "ssh -i ~/.ssh/vast_hiran_key -p 28568" \
  root@ssh7.vast.ai:/workspace/hiran-v2.2/hiran-v2.2-merged/ \
  ./HiranV2.2/models/
```

### Step 9: Commit & push results
```bash
git add HiranV2.2/checkpoints_vast/ HiranV2.2/models/ planHv2.2train.md
git commit -m "feat(hiran-v2.2): complete training on Vast.ai RTX 4090"
git push origin main
```

### Step 10: Cleanup (optional)
```bash
vastai destroy instance 37028568
```

---

## 3. Safety Rules for Autonomous Mode

- **DO NOT** expose Vast API key or SSH private key in any output.
- **DO NOT** run destructive commands on local machine (rm -rf, git reset, etc).
- **DO** poll the instance every few minutes to detect preemption or crashes.
- **DO** save checkpoints frequently (every 500 steps is already configured).
- **DO** commit results immediately after download.
- **DO** report cost incurred and total runtime at the end.
- **DO** ask user before destroying the instance if training is incomplete.

---

## 4. Troubleshooting

| Problem | Action |
|---------|--------|
| SSH connection refused | Instance still loading. Wait 30-60s and retry. |
| `pip install` fails | Try `pip install --upgrade pip` first, then retry. |
| Out of CUDA memory | Reduce batch size or enable gradient accumulation in config. |
| Preemption | Resume from last checkpoint: `RESUME_STAGE=zion_core bash scripts/run_training.sh` |
| Disk full | Clear HF cache: `rm -rf ~/.cache/huggingface/hub/` |

---

*Plan version: 2026-05-18-v1*
*Next action: Wait for user to say "go autonomous"*
