# Hiran v2.3 — Robust Domain-Specific Model Plan

## Why v2.3?

v2.2 proved that **QLoRA with rank ≤ 64 on 8B model is insufficient** for memorizing precise domain facts. The model learned *style* and *concepts* but:
- Hallucinated fee split percentages (invented 2.5/1.5/1/95 instead of 89/5/5/1)
- Triggered base model contamination at low temperature (Mormon church associations)
- Failed few-shot factual recall (6% instead of 5% for Issobella)

v2.3 addresses these root causes with **larger model capacity (32B+)**, **advanced parameter-efficient methods (DORA/rsLoRA)**, and **factual reinforcement dataset engineering**.

---

## 1. Base Model Selection

### Primary: `nvidia/OpenReasoning-Nemotron-32B`

| Attribute | Detail |
|-----------|--------|
| Base | Qwen2.5-32B-Instruct |
| Params | 32.8B |
| License | CC-BY-4.0 (commercial OK) |
| Strength | Already post-trained for reasoning/math/code |
| Context | 32K native |
| Why | Reasoning-optimized base = better at following technical Zion documentation |

### Alternatives

| Model | Params | License | Pros | Cons |
|-------|--------|---------|------|------|
| Qwen3-32B | 32B | Apache 2.0 | Native 128K context, strong multilingual | Less reasoning-optimized than Nemotron |
| Qwen2.5-32B-Instruct | 32B | Apache 2.0 | Proven fine-tuning recipes | Older than Qwen3 |
| Llama-3.3-70B | 70B | Llama 3.3 | Best quality, 128K context | Requires 2x A100 80GB minimum |
| Mistral-Small-24B | 24B | Apache 2.0 | Fits on single A100 | Smaller capacity |

**Decision: Nemotron-32B** — best reasoning base for our technical domain.

---

## 2. Training Method Selection

### Option A: DORA (Weight-Decomposed Low-Rank Adaptation) — RECOMMENDED

DORA decomposes weights into **magnitude** and **direction**, adapting both. This is significantly closer to full fine-tuning than standard LoRA.

```
Standard LoRA:  W' = W + BA           (only direction changed)
DORA:          W' = m * (W/||W|| + BA)  (magnitude AND direction changed)
```

| Config | Value |
|--------|-------|
| Rank | 512 (rsLoRA scaling: alpha = 512^0.5 * 16 ≈ 362) |
| Target modules | ALL linear layers (q, k, v, o, gate, up, down, lm_head) |
| Quantization | BF16 (no 4-bit — we need full weight fidelity for facts) |
| Gradient checkpointing | Enabled |
| VRAM need | ~65GB → fits on 1x A100 80GB |
| Cost (Vast.ai) | ~$2.50/hr × 60h = **~$150** |

### Option B: Full Fine-Tuning with DeepSpeed ZeRO-3

| Config | Value |
|--------|-------|
| Precision | BF16 + mixed precision |
| Optimizer | AdamW 8-bit (bitsandbytes) |
| ZeRO stage | 3 with CPU/NVMe offload |
| VRAM need | ~40GB per GPU → 2x A100 80GB or 4x A100 40GB |
| Cost (Vast.ai) | ~$5/hr × 48h = **~$240** |
| Quality | Best possible (all params updated) |

### Option C: rsLoRA QLoRA (Budget)

| Config | Value |
|--------|-------|
| Rank | 1024 (rsLoRA scaling) |
| Quantization | NF4 with double quantization |
| VRAM need | ~28GB → fits on 1x RTX 4090 |
| Cost | ~$0.50/hr × 80h = **~$40** |
| Quality | Better than v2.2 but still not full FT |

**Decision: Option A (DORA)** — best quality/cost ratio for our budget.

---

## 3. Enhanced Dataset Architecture

### v2.2 Problem Analysis

v2.2 dataset had 22,181 pairs. Key facts (89/5/5/1 split, 7 categories) appeared only **1-3 times** in different forms. For a model to memorize facts, they need **20-50 repetitions** with variation.

### v2.3 Dataset Design: "Factual Reinforcement Loops"

```
Total target: 50,000+ instruction pairs
├── Stage 1: FACTUAL_MEMORIZATION (10,000 pairs)
│   ├── Fee split: 500 variations ("What is 89% of 6.25?", "Calculate pool operator share...")
│   ├── 7 categories: 1,000 variations with descriptions
│   ├── L1-L6 architecture: 500 variations
│   ├── Key wallet addresses/formulas: 500 variations
│   └── Chain-of-thought variants: 2,000 pairs showing step-by-step reasoning
│
├── Stage 2: ZION_DOMAIN (15,000 pairs)
│   ├── Core concepts (5,000)
│   ├── Advanced topics (5,000)
│   └── Code/documentation generation (5,000)
│
├── Stage 3: CROSS_DOMAIN (15,000 pairs)
│   ├── Blockchain interoperability (5,000)
│   ├── DAO governance comparisons (5,000)
│   └── Technical architecture (5,000)
│
├── Stage 4: NEGATIVE_CORRECTION (5,000 pairs)
│   ├── Wrong answer + correction pairs (2,500)
│   ├── Anti-hallucination prompts (1,500)
│   └── System prompt anchoring examples (1,000)
│
└── Stage 5: CONVERSATION_FLOW (5,000+ pairs)
    ├── Multi-turn technical discussions (3,000)
    └── RAG-synthesis with context (2,000)
```

### Key Dataset Innovations

1. **Fact Anchor Cards**: Every critical number appears in 20+ different linguistic forms
2. **System Prompt Training**: 30% of examples include `<|system|>Zion DAO technical assistant<|/system|>` prefix
3. **CoT Forcing**: 40% of examples show explicit step-by-step reasoning before final answer
4. **Adversarial Immunization**: Examples of common hallucinations (Mormon church, generic mining) with corrections
5. **Structured Output Training**: All responses use markdown tables, bullet lists, or JSON for precision

---

## 4. Training Curriculum

### Stage 1: Factual Memorization (High Rank, Many Epochs)

```json
{
  "name": "factual_memorization",
  "method": "DORA",
  "rank": 512,
  "alpha": 362,
  "dropout": 0.05,
  "epochs": 5,
  "learning_rate": 1e-4,
  "batch_size": 2,
  "gradient_accumulation": 8,
  "lr_scheduler": "cosine_with_restarts",
  "warmup_steps": 500,
  "weight_decay": 0.01,
  "max_grad_norm": 1.0,
  "target_modules": ["all-linear"],
  "dataset": "stage1_factual_reinforcement.jsonl"
}
```

**Goal**: Model MUST know exact numbers (89/5/5/1, 7 categories, L1-L6) without hesitation.

### Stage 2: Domain Expertise

```json
{
  "name": "zion_expertise",
  "method": "DORA",
  "rank": 512,
  "alpha": 362,
  "dropout": 0.03,
  "epochs": 3,
  "learning_rate": 5e-5,
  "batch_size": 2,
  "gradient_accumulation": 8,
  "dataset": "stage2_domain_expertise.jsonl"
}
```

**Goal**: Deep understanding of all Zion subsystems (L1-L6, pools, bridges, DAO).

### Stage 3: Cross-Domain & Synthesis

```json
{
  "name": "cross_domain",
  "method": "DORA",
  "rank": 512,
  "alpha": 362,
  "dropout": 0.02,
  "epochs": 2,
  "learning_rate": 2e-5,
  "batch_size": 1,
  "gradient_accumulation": 16,
  "dataset": "stage3_cross_domain.jsonl"
}
```

**Goal**: Ability to synthesize information across layers and compare with external systems.

### Stage 4: ORPO Alignment (Optional)

After DORA stages, run **Odds Ratio Preference Optimization** to improve response formatting and reduce hallucinations.

```json
{
  "name": "orpo_alignment",
  "method": "ORPO",
  "beta": 0.1,
  "epochs": 1,
  "learning_rate": 5e-6,
  "dataset": "stage4_preference_pairs.jsonl"
}
```

---

## 5. Hardware & Cost Plan

### Vast.ai Instance Requirements

| Spec | Minimum | Recommended |
|------|---------|-------------|
| GPU | 1× A100 80GB | 2× A100 80GB |
| VRAM | 80GB | 160GB |
| Disk | 200GB | 300GB |
| Region | Any (latency irrelevant) | EU preferred |
| Cost/hr | ~$2.50 | ~$5.00 |

### Estimated Duration & Cost

| Phase | Duration | Cost (1× A100) | Cost (2× A100) |
|-------|----------|----------------|----------------|
| Dataset generation | Local | $0 | $0 |
| Stage 1 training | 24h | $60 | $120 |
| Stage 2 training | 18h | $45 | $90 |
| Stage 3 training | 12h | $30 | $60 |
| ORPO alignment | 6h | $15 | $30 |
| Evaluation | 2h | $5 | $10 |
| **Total** | **~62h** | **~$155** | **~$310** |

### Recommendation

Start with **1× A100 80GB** (~$2.50/hr). If Stage 1 factual memorization metrics are poor (<85% exact recall), upgrade to 2× A100 for Stage 2-3.

---

## 6. Evaluation Protocol

### Factual Recall Test (Must Pass)

| Test | Target | v2.2 Result | v2.3 Target |
|------|--------|-------------|-------------|
| Fee split exact % | 89/5/5/1 | FAILED (halucinated) | >95% exact |
| 7 categories names | All correct | PASSED (mostly) | >99% exact |
| Issobella wallet % | 5% | FAILED (said 6%) | >95% exact |
| Pool operator % | 1% | FAILED (ignored) | >95% exact |
| L1-L6 descriptions | Accurate | PARTIAL | >90% accurate |

### Safety Tests

| Test | Target |
|------|--------|
| Low temp (0.1) + "Zion" → no religion | Must pass |
| System prompt anchoring → crypto context | Must pass |
| Adversarial attack refusal | Must pass |
| Code generation without harmful content | Must pass |

### Performance Tests

| Metric | Target |
|--------|--------|
| Inference speed (FP16, 32B) | >25 tok/s on A100 |
| Inference speed (GGUF Q4, 32B) | >50 tok/s on RTX 4090 |
| Perplexity on Zion test set | <1.2 |
| BLEU on held-out test set | >0.65 |

---

## 7. File Structure

```
HiranV2.3/
├── PLAN_v2.3.md                  # This file
├── DATASET_PLAN.md               # Detailed dataset generation guide
├── TRAINING_CONFIG.md            # Full training hyperparameters
├── data/
│   ├── generators/               # Scripts to generate factual reinforcement loops
│   │   ├── generate_fee_split.py
│   │   ├── generate_categories.py
│   │   ├── generate_architecture.py
│   │   └── generate_negative_examples.py
│   ├── curriculum/
│   │   ├── stage1_factual_reinforcement.jsonl
│   │   ├── stage2_domain_expertise.jsonl
│   │   ├── stage3_cross_domain.jsonl
│   │   └── stage4_preference_pairs.jsonl
│   └── validate_v2.3.py        # Dataset validation
├── scripts/
│   ├── train_v2.3.py            # DORA training script
│   ├── run_training.sh          # Full pipeline launcher
│   ├── merge_model.py           # Merge adapters + base
│   ├── quantize_gguf.py         # GGUF quantization
│   ├── evaluate_v2.3.py         # Comprehensive evaluation
│   └── interview_v2.3.py        # Model interview (like v2.2)
├── config/
│   ├── curriculum_config.json   # Stage definitions
│   └── dora_config.json         # DORA-specific settings
└── results/
    └── (evaluation reports)
```

---

## 8. Implementation Milestones

| Milestone | ETA | Deliverable |
|-----------|-----|-------------|
| M1: Dataset generation | Day 1-2 | 50K+ validated pairs |
| M2: Vast.ai provisioning | Day 3 | 1× A100 80GB instance |
| M3: Stage 1 training | Day 3-4 | Factual memorization adapter |
| M4: Stage 2-3 training | Day 4-6 | Full DORA adapter |
| M5: ORPO alignment | Day 6 | Aligned model |
| M6: Merge + quantize | Day 7 | GGUF for inference |
| M7: Evaluation | Day 7 | Factual recall report |
| M8: Deploy + docs | Day 8 | Production ready |

---

## 9. Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A100 unavailable on Vast.ai | Medium | Pre-book instance; fallback to RunPod/Lambda |
| DORA doesn't improve factual recall | Low | Fallback to full FT (Option B) |
| 50K dataset overfits | Low | Strong regularization (dropout 0.05, weight decay) |
| Training interrupted | Medium | Checkpoint every 500 steps; auto-resume |
| Model still hallucinates at low temp | Medium | Increase factual stage to 8 epochs; add more negative examples |

---

## 10. Success Criteria

v2.3 is successful when **ALL** of the following are true:

1. ✅ Model answers "What is the Zion fee split?" with **exact** 89/5/5/1 at temperature 0.1
2. ✅ Model lists all 7 humanitarian categories **without hallucination**
3. ✅ Model describes L1-L6 architecture **accurately**
4. ✅ Model refuses to help with pool manipulation **and explains why**
5. ✅ Model generates valid Zion-related code (Rust/Solidity) **that compiles**
6. ✅ GGUF quantized model runs at >50 tok/s on RTX 4090
7. ✅ No religious contamination at any temperature

---

*Plan created: 2026-05-19*
*Next step: Begin M1 (dataset generation)*
