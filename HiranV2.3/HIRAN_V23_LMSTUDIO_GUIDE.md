# Hiran v2.3 — LM Studio Setup Guide

> Complete pipeline: LoRA checkpoint → merged model → GGUF → LM Studio

---

## Overview

This guide takes a trained Hiran v2.3 LoRA checkpoint (e.g. `checkpoint-6500`) and produces a single `.gguf` file that runs natively in **LM Studio** on your local Windows machine.

**Why this pipeline?**
- LoRA adapter (~2 GB) + Base model Qwen3-32B (~60 GB) → merged HF model (~60 GB)
- Merged model → GGUF quantization (~20 GB for q5_k_m)
- Final GGUF is the only file you need to download (~20 GB vs 60 GB+)

---

## Architecture

```
checkpoint-6500/
  adapter_model.safetensors   (2 GB LoRA weights)
  adapter_config.json         (LoRA config)
       ↓
   [merge on Vast AI A100]
       ↓
merged HF model (~60 GB)
       ↓
   [convert with llama.cpp]
       ↓
hiran-v2.3-6500-q5.gguf     (~20 GB)
       ↓
   [scp download to Windows]
       ↓
LM Studio
```

---

## Step 1: Build on Vast AI Server

### 1.1 SSH to the training server

```bash
ssh -p 31384 -i ~/.ssh/vast/hiran_v2.4_key root@ssh1.vast.ai
```

### 1.2 Verify checkpoint exists

```bash
ls -lh /workspace/hiran-v2.3/checkpoints/stage1_factual/checkpoint-6500/adapter_model.safetensors
```

### 1.3 Run merge + GGUF export

The script is already uploaded at `/workspace/hiran-v2.3/scripts/merge_and_export.py`.

```bash
cd /workspace/hiran-v2.3

# Full pipeline: merge + GGUF q5_k_m (~40-60 min on A100)
python scripts/merge_and_export.py \
  --checkpoint checkpoints/stage1_factual/checkpoint-6500 \
  --base-model Qwen/Qwen3-32B \
  --output /workspace/hiran-v2.3-merged \
  --gguf-output /workspace/hiran-v2.3-6500-q5.gguf \
  --quantization q5_k_m
```

**What it does:**
1. Downloads Qwen3-32B base model from HuggingFace (if not cached)
2. Loads LoRA adapter from checkpoint-6500
3. `merge_and_unload()` → saves merged HF model to `/workspace/hiran-v2.3-merged`
4. Runs `llama.cpp/convert_hf_to_gguf.py` → produces `hiran-v2.3-6500-q5.gguf`

**Disk requirements on server:**
- Base model cache: ~60 GB
- Merged model: ~60 GB
- GGUF output: ~20 GB
- Total: ~140 GB (server has 390 GB free — OK)

### 1.4 Optional: Build multiple quantizations

```bash
# q4_k_m (smaller, slightly lower quality ~14 GB)
python scripts/merge_and_export.py \
  --skip-merge \
  --gguf-output /workspace/hiran-v2.3-6500-q4.gguf \
  --quantization q4_k_m

# q8_0 (higher quality, larger ~26 GB)
python scripts/merge_and_export.py \
  --skip-merge \
  --gguf-output /workspace/hiran-v2.3-6500-q8.gguf \
  --quantization q8_0
```

---

## Step 2: Download GGUF to Windows

### 2.1 Create local directory

```powershell
mkdir -Force "$env:USERPROFILE\HiranModels"
```

### 2.2 Download with scp

```powershell
scp -P 31384 -i $env:USERPROFILE\.ssh\vast\hiran_v2.4_key `
  -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null `
  root@ssh1.vast.ai:/workspace/hiran-v2.3-6500-q5.gguf `
  $env:USERPROFILE\HiranModels\
```

**Download time:** ~20-30 min for 20 GB (depends on your connection).

**Or use the automated script:**

```powershell
# From the repo root
.\HiranV2.3\scripts\setup-lmstudio.ps1 -CheckpointStep 6500 -Quantization q5_k_m
```

---

## Step 3: Configure LM Studio

### 3.1 Place the model

Copy or move the `.gguf` file to LM Studio's models folder:

```
%USERPROFILE%\.cache\lm-studio\models\ZION\Hiran-v2.3-6500\
  ├── model.gguf
  └── config.json
```

### 3.2 Create `config.json`

```json
{
  "name": "Hiran v2.3 (Checkpoint 6500)",
  "description": "ZION Hiran v2.3 fine-tuned on Qwen3-32B. LoRA checkpoint 6500 merged and quantized to q5_k_m.",
  "version": "2.3.0",
  "author": "ZION Project",
  "model": {
    "GGUF": "model.gguf",
    "architecture": "Qwen3ForCausalLM",
    "parameters": "32B",
    "quantization": "q5_k_m"
  },
  "context_length": 128000,
  "chat_format": "ChatML"
}
```

### 3.3 Open LM Studio

1. Launch **LM Studio**
2. Go to **"My Models"** (left sidebar)
3. Click **"Add Model" → "From Folder"**
4. Select: `%USERPROFILE%\.cache\lm-studio\models\ZION\Hiran-v2.3-6500`
5. The model appears as: **"Hiran v2.3 (Checkpoint 6500)"**

### 3.4 Recommended settings

| Setting | Value | Notes |
|---------|-------|-------|
| GPU offload | Max layers | Needs 16+ GB VRAM for full offload |
| Context length | 8192 | Up to 32768 if you have enough VRAM |
| Temperature | 0.7 | Default for creative tasks |
| Top-P | 0.9 | Default |
| Repeat penalty | 1.1 | Prevents repetition |

**VRAM requirements:**

| Quantization | VRAM for 32B | VRAM for 8K ctx |
|---|---|---|
| q4_k_m | ~18 GB | ~20 GB |
| q5_k_m | ~22 GB | ~24 GB |
| q8_0 | ~30 GB | ~32 GB |

If you have **RTX 4090 24 GB**: q5_k_m with 8K context works perfectly.
If you have **RTX 3090 24 GB**: q5_k_m works, q8_0 might be tight.
If you have **16 GB VRAM**: Use q4_k_m with 4K context.

---

## Step 4: Test the Model

Try these prompts to verify Hiran knowledge:

```
What is the consensus mechanism of ZION?
→ Should answer: Proof of Work (deeksha_lite_v1 / deeksha_lite_fire)

What are the canonical subsidy addresses?
→ Should list: miner (89%), humanitarian (5%), issobella (5%), pool fee (1%)

How do I optimize mining on an RX 5700 XT?
→ Should recommend Fire mode, 18.1 KH/s, thermal checks

Explain the Decade Decay emission schedule.
→ Should describe: -20% per decade, D1 5400 ZION → tail 725 ZION
```

If answers are accurate, the merge succeeded.

---

## Troubleshooting

### "Model loads but outputs gibberish"
- Check that the base model was **Qwen3-32B**, not Qwen3-30B or another variant.
- Verify `chat_template.jinja` was copied to the merged model dir.

### "LM Studio says 'failed to load model'"
- Ensure your LM Studio version supports Qwen3 architecture (update if needed).
- Try a different quantization (q4_k_m is most compatible).

### "GPU offload not working"
- LM Studio → Settings → GPU → "Maximum GPU layers" → drag to max.
- If it crashes, reduce context length to 4096.

### "Download interrupted"
- Resume with rsync (if available) or re-run scp (it will overwrite).

### "Server out of disk space during merge"
- Check: `df -h /workspace`
- If < 150 GB free, delete old checkpoints: `rm -rf /workspace/hiran-v2.3/checkpoints/stage1_factual/checkpoint-5500`

---

## Quick Reference

### All-in-one server command

```bash
cd /workspace/hiran-v2.3
python scripts/merge_and_export.py \
  --checkpoint checkpoints/stage1_factual/checkpoint-6500 \
  --gguf-output /workspace/hiran-v2.3-6500-q5.gguf \
  --quantization q5_k_m
```

### Download command (Windows PowerShell)

```powershell
scp -P 31384 -i $env:USERPROFILE\.ssh\vast\hiran_v2.4_key `
  root@ssh1.vast.ai:/workspace/hiran-v2.3-6500-q5.gguf `
  $env:USERPROFILE\HiranModels\
```

### Automated setup (PowerShell)

```powershell
.\HiranV2.3\scripts\setup-lmstudio.ps1 -CheckpointStep 6500
```

---

## File Map

| File | Purpose |
|------|---------|
| `HiranV2.3/scripts/merge_and_export_server.py` | Merge + GGUF on Vast server |
| `HiranV2.3/scripts/setup-lmstudio.ps1` | Download + LM Studio config on Windows |
| `HiranV2.3/HIRAN_V23_LMSTUDIO_GUIDE.md` | This guide |

---

*Last updated: 2026-06-14*
*Target: Hiran v2.3 checkpoint-6500 → LM Studio*
