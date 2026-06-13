# Hiran v2.3 Hardware Cost Analysis — Vast.ai

> **Date:** 2026-06-13  
> **Model:** nvidia/OpenReasoning-Nemotron-32B (32.8B params)  
> **Training options:** Full Fine-Tuning (preferred) vs DORA fallback

---

## Memory Requirements Deep-Dive

### Full Fine-Tuning (all 32.8B parameters updated)

Using **DeepSpeed ZeRO-3** with CPU/NVMe offload of optimizer states:

```
BF16 Weights:  32.8B × 2 bytes = 65.6 GB
BF16 Grads:    32.8B × 2 bytes = 65.6 GB
AdamW States:  32.8B × 8 bytes = 262.4 GB  → offload to CPU/NVMe
Activations:   ~5-20 GB per GPU (with gradient checkpointing)
```

**With N GPUs, per-GPU memory = (65.6 + 65.6) / N + activations**

| GPUs | Per-GPU weights+grads | +Activations (~15GB) | **Min VRAM per GPU** |
|------|------------------------|----------------------|---------------------|
| 2x   | 65.6 GB                | 80.6 GB              | **Need 80GB+ GPUs** |
| 4x   | 32.8 GB                | 47.8 GB              | **Need 48GB+ GPUs** |
| 8x   | 16.4 GB                | 31.4 GB              | **Need 32GB+ GPUs** |

### DORA Fallback (adapter only)

Using `train_v2.3.py` — 8-bit quantized base model + rank-512 DORA adapters:

```
8-bit Weights:    32.8B × 1 byte  = 32.8 GB
DORA Adapters:    ~2-4 GB
Optimizer states: ~6 GB (only adapters)
Activations:      ~2-5 GB
Total:            ~43-48 GB
```

**Fits comfortably on single A100 40GB or RTX 6000 Ada 48GB.**

---

## Viable Hardware Configurations

### Config A: Budget DORA (Recommended if $ < $100)

| Spec | Value |
|------|-------|
| GPUs | 1x A100 40GB or 1x RTX 6000 Ada 48GB |
| VRAM | 40-48 GB |
| Method | DORA (8-bit base + rank-512 adapters) |
| Duration | ~72 hours (3 stages) |
| Cost/hr | ~$0.50-1.50 |
| **Total** | **~$36-108** |
| Pros | Cheapest, no multi-GPU complexity |
| Cons | Not full FT — may still struggle on precise facts vs Full FT |

### Config B: Cost-Optimized Full FT (Sweet Spot)

| Spec | Value |
|------|-------|
| GPUs | 4x A100 40GB |
| VRAM | 160 GB total |
| Method | DeepSpeed ZeRO-3 Full FT |
| Duration | ~48 hours |
| Cost/hr | ~$2.00-3.00 |
| **Total** | **~$96-144** |
| Pros | True full FT, cheapest viable config |
| Cons | 40GB A100s are less common on Vast.ai than 80GB |

### Config C: Standard Full FT (Recommended if budget allows)

| Spec | Value |
|------|-------|
| GPUs | 2x A100 80GB |
| VRAM | 160 GB total |
| Method | DeepSpeed ZeRO-3 Full FT |
| Duration | ~48 hours |
| Cost/hr | ~$3.00-4.50 |
| **Total** | **~$144-216** |
| Pros | Most common offering, well-tested config |
| Cons | More expensive than 4x A100 40GB |

### Config D: Fast Full FT

| Spec | Value |
|------|-------|
| GPUs | 4x A100 80GB |
| VRAM | 320 GB total |
| Method | DeepSpeed ZeRO-3 Full FT |
| Duration | ~36 hours |
| Cost/hr | ~$6.00-8.00 |
| **Total** | **~$216-288** |
| Pros | Fastest, most headroom for experiments |
| Cons | Most expensive |

### Config E: 2x RTX 6000 Ada — WILL NOT WORK

| Spec | Value |
|------|-------|
| GPUs | 2x RTX 6000 Ada 48GB |
| VRAM | 96 GB total |
| Per-GPU needs | 65.6 GB weights+grads + 15 GB activations = **80.6 GB** |
| Result | ❌ **OOM** — Even with ZeRO-3, weights+grads alone exceed 48GB per GPU |

To make RTX 6000 Ada work for Full FT, you'd need **4x** (192GB total, ~32GB per GPU) or **3x** (144GB, ~43GB per GPU) — but 3x/4x RTX 6000 Ada configs are rare on Vast.ai.

---

## Vast.ai Search Strategy

### Recommended search queries:

```bash
# Config B: Cost-optimized Full FT (best bang for buck)
vastai search offers "num_gpus>=4 gpu_name=A100 gpu_ram>=40 cuda_vers>=12"

# Config C: Standard Full FT
vastai search offers "num_gpus>=2 gpu_name=A100 gpu_ram>=80 cuda_vers>=12"

# Config A: Budget DORA
vastai search offers "num_gpus>=1 gpu_name=A100 gpu_ram>=40 cuda_vers>=12"

# Alternative for DORA: RTX 6000 Ada
vastai search offers "num_gpus>=1 gpu_name='RTX 6000' gpu_ram>=48 cuda_vers>=12"

# Config D: Fast Full FT
vastai search offers "num_gpus>=4 gpu_name=A100 gpu_ram>=80 cuda_vers>=12"
```

### Sort by value:
```bash
# Show cheapest options sorted by total $/hr
vastai search offers "num_gpus>=2 gpu_name=A100 gpu_ram>=80" --raw | jq 'sort_by(.dph_total) | .[:10]'
```

---

## Recommendation

| Budget | Config | Expected Cost | Confidence in Results |
|--------|--------|--------------|---------------------|
| <$50   | Config A (DORA, 1x A100 40GB) | ~$36-54 | Medium — better than v2.2, but not guaranteed fact-perfect |
| $50-150 | Config B (4x A100 40GB Full FT) | ~$96-144 | **High — true full FT, best value** |
| $150-250 | Config C (2x A100 80GB Full FT) | ~$144-216 | **High — proven, most available** |
| $250+ | Config D (4x A100 80GB Full FT) | ~$216-288 | **High — fastest iteration** |

**My pick:** If 4x A100 40GB is available on Vast.ai, go with Config B. It's often 30-50% cheaper than 2x A100 80GB and trains in similar time (slightly slower due to more GPU communication, but parallelization compensates).

If 4x A100 40GB is not available, Config C (2x A100 80GB) is the safe choice.

---

## Risk Mitigation

1. **Always do dry-run first:**
   ```bash
   python scripts/provision_vast.py --gpus 4 --gpu_name A100 --gpu_ram 40 --dry_run
   ```

2. **Start with 1 epoch:** Edit `train_v2.3_fullft.py` to `epochs: 1`, verify loss converges, then resume with full 3 epochs.

3. **Checkpoint every 250 steps:** The default is 500 — for expensive instances, save more frequently.

4. **Set up auto-rsync:** Cron job every 30 min to rsync checkpoints to local storage or S3.

---

*Analysis created: 2026-06-13*  
*See PRE_FLIGHT_CHECKLIST.md for step-by-step pre-training verification.*
