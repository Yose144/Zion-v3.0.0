# Hiran v2.3 + v2.4 — Master Operations Guide

> **Created:** 2026-06-13  
> **Active Instance:** 40791384 (Vast.ai)  
> **Hardware:** 2x NVIDIA A100 SXM4 80GB, AMD EPYC 7513, 1.4TB RAM, 500GB disk  
> **Cost:** ~$1.18/hr (~$50 for 36-48h full training)  
> **Repository:** `github.com/Yose144/Zion-v3.0.0` (branch: `main`)

---

## Table of Contents

1. [Quick Status Check](#1-quick-status-check)
2. [SSH Access](#2-ssh-access)
3. [Instance Lifecycle](#3-instance-lifecycle)
4. [Training Monitoring](#4-training-monitoring)
5. [Disk Management (CRITICAL)](#5-disk-management-critical)
6. [Time & Cost Estimates](#6-time--cost-estimates)
7. [Post-Training: Download Model](#7-post-training-download-model)
8. [Troubleshooting](#8-troubleshooting)
9. [V2.4 Roadmap (Maestro)](#9-v24-roadmap-maestro)
10. [Emergency Procedures](#10-emergency-procedures)

---

## 1. Quick Status Check

### One-liner (run from your local PC):
```bash
ssh -p 31384 -i ~/.ssh/vast/hiran_v2.4_key root@ssh1.vast.ai \
  "echo '=== INSTANCE ==='; uptime; echo '=== DISK ==='; df -h /workspace; \
   echo '=== GPU ==='; nvidia-smi --query-gpu=name,memory.used,temperature.gpu,utilization.gpu --format=csv,noheader; \
   echo '=== TRAINING ==='; ps aux | grep -E 'train|deepspeed' | grep -v grep | head -5 || echo 'No training running'; \
   echo '=== LOG (last 5 lines) ==='; tail -n 5 /workspace/hiran-training.log"
```

### Expected output when training:
```
=== INSTANCE ===
 08:30:00 up 2:30,  0 users,  load average: 12.5, 10.2, 8.1
=== DISK ===
Filesystem  Size  Used Avail Use%
overlay     500G  380G  120G  76%
=== GPU ===
NVIDIA A100-SXM4-80GB, 65536 MiB, 68, 99 %
NVIDIA A100-SXM4-80GB, 65536 MiB, 66, 98 %
=== TRAINING ===
... python3 -u scripts/train_v2.3_fullft.py --local_rank=0 ...
... python3 -u scripts/train_v2.3_fullft.py --local_rank=1 ...
=== LOG ===
[08:29:55] Step 450/2270 | Loss: 1.234 | LR: 1.89e-05 | ETA: 28h
```

---

## 2. SSH Access

### Current SSH Config
```
Host:       ssh1.vast.ai
Port:       31384
User:       root
Key:        ~/.ssh/vast/hiran_v2.4_key
Fingerprint: SHA256:nwasu/3QGBGgHklFguoqsr3+hS8+MmpWsv3ZEzvOFCQ
```

### Quick connect
```bash
ssh -p 31384 -i ~/.ssh/vast/hiran_v2.4_key root@ssh1.vast.ai
```

### If port changes (instance restart)
```bash
API_KEY="4f86b4afa3f1219cc18708d6a6a2e6476793ae088d0e4e39d2a0baacacd592fd"
INSTANCE_ID="40791384"

curl -s "https://console.vast.ai/api/v0/instances/${INSTANCE_ID}/?api_key=${API_KEY}" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print(f'ssh -p {d.get(\"ssh_port\")} -i ~/.ssh/vast/hiran_v2.4_key root@{d.get(\"ssh_host\")}')"
```

### Dashboard
https://cloud.vast.ai/ — instance **40791384**

---

## 3. Instance Lifecycle

### Create new instance (if this one dies)
```bash
# Find cheapest 2x A100
API_KEY="4f86b4afa3f1219cc18708d6a6a2e6476793ae088d0e4e39d2a0baacacd592fd"
curl -s "https://console.vast.ai/api/v0/bundles/?api_key=${API_KEY}" | \
  python3 -c "import json,sys; data=json.load(sys.stdin); offers=[o for o in data.get('offers',[]) if 'A100' in o.get('gpu_name','') and o.get('num_gpus',0)==2]; offers.sort(key=lambda x:x.get('dph_total',999)); print(f'Offer {offers[0][\"id\"]}: {offers[0][\"gpu_name\"]} x{offers[0][\"num_gpus\"]} at ${offers[0][\"dph_total\"]:.2f}/hr')"

# Create instance (replace OFFER_ID with the cheapest)
curl -s -X PUT "https://console.vast.ai/api/v0/asks/OFFER_ID/?api_key=${API_KEY}&image=nvidia%2Fcuda%3A12.1.0-devel-ubuntu22.04&disk=500"
```

### Attach SSH key to existing instance
```bash
PUBKEY=$(cat ~/.ssh/vast/hiran_v2.4_key.pub)
curl -s -X POST \
  -H "Authorization: Bearer 4f86b4afa3f1219cc18708d6a6a2e6476793ae088d0e4e39d2a0baacacd592fd" \
  -H "Content-Type: application/json" \
  --data "{\"ssh_key\": \"${PUBKEY}\"}" \
  "https://console.vast.ai/api/v0/instances/40791384/ssh/"
```

### Destroy instance (stop billing)
```bash
API_KEY="4f86b4afa3f1219cc18708d6a6a2e6476793ae088d0e4e39d2a0baacacd592fd"
INSTANCE_ID="40791384"

curl -s -X DELETE \
  "https://console.vast.ai/api/v0/instances/${INSTANCE_ID}/?api_key=${API_KEY}"

# Or via dashboard: https://cloud.vast.ai/
```

> **⚠️ CRITICAL:** Download model BEFORE destroying! Data is permanently lost.

---

## 4. Training Monitoring

### Real-time log tail
```bash
ssh -p 31384 -i ~/.ssh/vast/hiran_v2.4_key root@ssh1.vast.ai \
  "tail -f /workspace/hiran-training.log"
```

### GPU utilization (watch mode)
```bash
ssh -p 31384 -i ~/.ssh/vast/hiran_v2.4_key root@ssh1.vast.ai \
  "watch -n 2 nvidia-smi"
```

### Disk space check
```bash
ssh -p 31384 -i ~/.ssh/vast/hiran_v2.4_key root@ssh1.vast.ai \
  "df -h /workspace && du -sh /workspace/hiran-v2.3/checkpoints/ 2>/dev/null"
```

### Process list
```bash
ssh -p 31384 -i ~/.ssh/vast/hiran_v2.4_key root@ssh1.vast.ai \
  "ps aux | grep -E 'train|deepspeed' | grep -v grep"
```

---

## 5. Disk Management (CRITICAL)

### The Problem
| Item | Size |
|---|---|
| Base model (Qwen3-32B) cache | ~65 GB |
| One DeepSpeed ZeRO-3 checkpoint | ~320 GB (BF16 model + Adam FP32 optimizer) |
| `save_total_limit=3` (default) | ~960 GB |
| Final model + dataset + venv | ~75 GB |
| **Total needed** | **~1.1 TB** |
| **Available on instance** | **~500 GB** |

**Result:** Training CRASHES on "No space left on device" at checkpoint save.

### Fixes Applied
1. **autostart.sh** clears HF cache after model load (~60GB freed)
2. **train_v2.3_fullft.py** patched to `save_total_limit=1` (only 1 checkpoint kept)
3. **Disk monitoring** in autostart.sh warns at <100GB

### Manual disk cleanup (if needed)
```bash
# On instance:
rm -rf /workspace/.cache/huggingface/models--Qwen--Qwen3-32B   # ~60GB
rm -rf /workspace/hiran-v2.3/checkpoints/stage1_factual/checkpoint-*   # old checkpoints
```

### Disk usage by checkpoint size
```
Phase                Disk Used    Free    Status
-------------------------------------------------
Start                ~70 GB       ~430GB  OK
After model load     ~130 GB      ~370GB  OK
After 1st checkpoint ~450 GB      ~50GB   ⚠️ LOW
After training       ~200 GB      ~300GB  OK (checkpoint deleted, final kept)
```

---

## 6. Time & Cost Estimates

### Training Parameters
```
Dataset:      48,436 instruction pairs
Base model:   Qwen/Qwen3-32B (32.8B parameters)
Method:       DeepSpeed ZeRO-3 Full Fine-Tuning (NOT LoRA/DORA)
Batch size:   1 per GPU x 32 grad accum = effective batch 64
Epochs:       3
Total steps:  ~48,436 / 64 * 3 = ~2,270 steps
Save every:   500 steps (~3 checkpoints total)
Eval every:   200 steps
Hardware:     2x A100 SXM4 80GB
```

### Time Breakdown
| Phase | Duration | Notes |
|---|---|---|
| System setup + deps | ~5 min | One-time per instance |
| Git clone repo | ~1 min | One-time |
| Python venv + pip install | ~3-5 min | transformers, accelerate, deepspeed |
| Model download (HF) | ~5-10 min | Qwen3-32B ~65GB |
| Model load to GPU | ~2-3 min | DeepSpeed sharding across 2 GPUs |
| Dataset tokenization | ~2-3 min | 48,436 pairs |
| **Actual training** | **~28-36 hours** | ~45-60 sec/step on 2x A100 |
| Checkpoint saves (3x) | ~30 min total | Each ~10 min |
| Evaluation | ~1-2 hours | 8 benchmark domains |
| Factual benchmark | ~30 min | |
| Quantization (GGUF) | ~1-2 hours | |
| **TOTAL** | **~32-42 hours** | |

### Cost Breakdown
| Item | Calculation | Cost |
|---|---|---|
| Training (36h avg) | 36h x $1.18/hr | **~$42.50** |
| Range | 32-42h x $1.18/hr | **$38-50** |
| Internet egress (model download) | ~100GB x $0.0026/GB | ~$0.25 |
| **Estimated total** | | **~$43** |

### Credit Check
```bash
# Check your Vast.ai balance
curl -s -H "Authorization: Bearer 4f86b4afa3f1219cc18708d6a6a2e6476793ae088d0e4e39d2a0baacacd592fd" \
  "https://console.vast.ai/api/v0/user/" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Balance: ${d.get(\"credit_balance\",0):.2f}')"
```

**If balance < $50:** Top up at https://cloud.vast.ai/billing/ or training will be killed mid-run.

---

## 7. Post-Training: Download Model

### Option A: rsync (recommended — resumable)
```bash
# 1. Check SSH port (may change after restart)
API_KEY="4f86b4afa3f1219cc18708d6a6a2e6476793ae088d0e4e39d2a0baacacd592fd"
PORT=$(curl -s "https://console.vast.ai/api/v0/instances/40791384/?api_key=${API_KEY}" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ssh_port',''))")

# 2. Download everything
rsync -avz --progress \
  -e "ssh -p ${PORT} -i ~/.ssh/vast/hiran_v2.4_key -o StrictHostKeyChecking=no" \
  root@ssh1.vast.ai:/workspace/hiran-v2.3-release/ \
  ~/HiranV2.3-Release/

# 3. OR download just GGUF (smaller, ~16-20GB)
rsync -avz --progress \
  -e "ssh -p ${PORT} -i ~/.ssh/vast/hiran_v2.4_key -o StrictHostKeyChecking=no" \
  root@ssh1.vast.ai:/workspace/hiran-v2.3-release/models-gguf/ \
  ~/HiranV2.3-Model/
```

### Option B: HuggingFace Hub upload
```bash
# On instance, after training:
ssh -p 31384 -i ~/.ssh/vast/hiran_v2.4_key root@ssh1.vast.ai

pip install huggingface_hub
huggingface-cli login  # enter your HF token

python -c "
from transformers import AutoModelForCausalLM, AutoTokenizer
model_path = '/workspace/hiran-v2.3/checkpoints/stage1_factual/final'
model = AutoModelForCausalLM.from_pretrained(model_path, trust_remote_code=True)
tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
model.push_to_hub('yose144/hiran-v2.3-qwen3-32b')
tokenizer.push_to_hub('yose144/hiran-v2.3-qwen3-32b')
print('Uploaded!')
"
```

---

## 8. Troubleshooting

### Compatibility Fixes (2026-06-13)

These fixes were applied to make the training pipeline work with the latest `transformers`, `torch`, and `deepspeed` versions. All fixes are already in `train_v2.3_fullft.py` and `autostart.sh` on `main`.

| # | Error / Problem | Root Cause | Fix Applied |
|---|---|---|---|
| 1 | `evaluation_strategy` deprecated | transformers >= 4.45 renamed param | Changed to `eval_strategy="steps"` |
| 2 | `group_by_length=True` deprecated | transformers >= 4.45 removed param | Commented out |
| 3 | `save_steps` not multiple of `eval_steps` | transformers validates alignment | Changed `eval_steps=200` → `250` (500/250=2) |
| 4 | `Trainer` rejects `tokenizer=` kwarg | transformers >= 4.45 removed param | Commented out in Trainer init |
| 5 | `report_to=["tensorboard"]` requires tensorboard | tensorboard not installed | Changed to `report_to="none"` |
| 6 | PyTorch CUDA mismatch (cu130 vs CUDA 12.1) | `pip install torch` pulled cu130 | Installed `torch==2.4.1+cu121` |
| 7 | NumPy 2.x crash with PyTorch 2.4 | NumPy 2.2 incompatible with compiled modules | Downgraded to `numpy<2` |
| 8 | DeepSpeed CPU Adam compile fail | CUDA version mismatch during JIT compile | Set `DS_SKIP_CUDA_CHECK=1` |
| 9 | CRLF line endings in autostart.sh | Windows git checkout | `sed -i 's/\r$//'` on instance |
| 10 | Disk full (500GB insufficient) | 3x checkpoints ~960GB + model ~65GB | `save_total_limit=1`, HF cache cleanup |
| 11 | `flash-attn` build failure | Missing build tools / CUDA mismatch | Continue without (slower but works) |
| 12 | `load_best_model_at_end` requires save multiple of eval | transformers validation | Ensure `save_steps % eval_steps == 0` |

### Environment Setup (manual, if autostart fails)
```bash
# On instance:
source /workspace/hiran-v2.3/venv/bin/activate
pip install 'numpy<2'
pip install torch==2.4.1 torchvision --index-url https://download.pytorch.org/whl/cu121
pip install transformers accelerate datasets deepspeed
export DS_SKIP_CUDA_CHECK=1
export CUDA_VISIBLE_DEVICES=0,1
export WANDB_DISABLED=true
export HF_HOME=/workspace/.cache/huggingface
```

### Restart training from checkpoint
```bash
# On instance — DeepSpeed auto-resumes if checkpoint exists:
ssh -p 31384 -i ~/.ssh/vast/hiran_v2.4_key root@ssh1.vast.ai
bash /workspace/hiran-v2.3/scripts/autostart.sh
```

### Emergency: Kill all training processes
```bash
ssh -p 31384 -i ~/.ssh/vast/hiran_v2.4_key root@ssh1.vast.ai \
  "pkill -f train_v2.3_fullft.py; pkill -f deepspeed; rm -f /tmp/hiran-autostart.lock"
```

---

## 9. V2.4 Roadmap (Maestro)

### What is v2.4
Hiran v2.3 is a **domain-specific chatbot** (answers Zion questions).  
Hiran v2.4 becomes the **central orchestrator** of the entire Zion ecosystem.

### Architecture
```
User Input (Chat/Voice/API)
         |
         v
  HIRAN v2.4 ORCHESTRATOR
  ├─ Intent Router
  ├─ Planner Engine (ReAct)
  ├─ Context Manager
  └─ Agent Dispatch Layer
         |
         v
  ├─ L1 Agent (Node + Miner)
  ├─ L2 Agent (Bridge + DAO)
  └─ L3 Agent (NCL + WARP + AI)
         |
         v
     V3 Service Bus
```

### Base Model Strategy
**Recommended: Option A**
- **Base:** v2.3 checkpoint (Qwen3-32B Full FT)
- **Adapters:** 4x DORA stacked (factual + grounding + orchestration + incidents)
- **Total rank:** 512 + 512 + 256 + 128 = 1,408 trainable layers
- **Inference:** 1x A100 80GB (8-bit base + adapters)
- **Training cost:** ~$100-150

### Timeline (after v2.3 complete)
| Phase | Duration | Depends On |
|---|---|---|
| Service API schemas (L1-L6) | 1 week | v2.3 eval passed |
| Zion OS Grounding dataset | 2 weeks | API schemas |
| Grounding DORA training | 5 days | Dataset ready |
| Orchestration dataset | 2 weeks | Grounding model |
| Orchestration DORA training | 5 days | Dataset ready |
| Incident Response dataset | 1 week | Orchestration model |
| Incident Response DORA training | 3 days | Dataset ready |
| Integration testing | 2 weeks | All models ready |
| **Total v2.4** | **~10-12 weeks** | **v2.3 checkpoint** |

### Key Files
| File | Purpose |
|---|---|
| `HiranV2.4/PROPOSAL_v2.4.md` | Full vision & architecture |
| `HiranV2.4/ARCHITECTURE_v2.4.md` | Technical design |
| `HiranV2.4/SERVICE_MESH_v2.4.md` | Service discovery & health |
| `HiranV2.4/AGENT_HIERARCHY_v2.4.md` | Agent roles & permissions |
| `HiranV2.4/TOOL_REGISTRY_v2.4.md` | Tools & API schemas |

---

## 10. Emergency Procedures

### If instance crashes mid-training
1. Check if checkpoint exists: `ls /workspace/hiran-v2.3/checkpoints/stage1_factual/`
2. If yes: autostart will auto-resume
3. If no: restart from scratch (36-48h lost)

### If disk fills up
```bash
# On instance:
df -h /workspace
# If < 50GB free:
rm -rf /workspace/.cache/huggingface/models--Qwen--Qwen3-32B
rm -rf /workspace/hiran-v2.3/checkpoints/stage1_factual/checkpoint-*
# Then restart training
```

### If Vast AI kills instance (out of credit)
1. Top up credit at https://cloud.vast.ai/billing/
2. Instance may auto-resume if within grace period
3. If not: create new instance, copy SSH key, re-deploy autostart

### If you need to stop and resume later
```bash
# Stop training (preserves checkpoint):
ssh -p 31384 -i ~/.ssh/vast/hiran_v2.4_key root@ssh1.vast.ai \
  "pkill -f train_v2.3_fullft.py; pkill -f deepspeed"

# Resume later:
ssh -p 31384 -i ~/.ssh/vast/hiran_v2.4_key root@ssh1.vast.ai \
  "bash /workspace/hiran-v2.3/scripts/autostart.sh"
```

---

*Last updated: 2026-06-13 07:00 UTC*  
*Instance: 40791384 | Training status: RUNNING*  
*Current step: 0/2226 | GPUs: 2x A100 100% util | ETA: ~34-36h*  
*Cost so far: ~$2 | Estimated total: ~$42*
