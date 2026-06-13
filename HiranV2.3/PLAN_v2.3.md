# Hiran v2.3 — Robust Domain-Specific Model Plan

## Why v2.3?

v2.2 proved that **QLoRA with rank ≤ 64 on 8B model is insufficient** for memorizing precise domain facts. The model learned *style* and *concepts* but:
- Hallucinated fee split percentages (invented 2.5/1.5/1/95 instead of 89/5/5/1)
- Triggered base model contamination at low temperature (Mormon church associations)
- Failed few-shot factual recall (6% instead of 5% for Issobella)

v2.3 addresses these root causes with **larger model capacity (32B+)**, **full fine-tuning (ALL parameters updated)**, and **massive factual reinforcement dataset engineering (43K+ pairs with drill patterns)**.

---

## 1. Base Model Selection

### Primary: `Qwen/Qwen3-32B`

| Attribute | Detail |
|-----------|--------|
| Base | Native Qwen3 architecture |
| Params | 32.8B |
| License | Apache 2.0 (commercial OK, no restrictions) |
| Strength | Post-trained for reasoning/math/code, 100+ languages |
| Context | 128K native |
| Why | Best balance of reasoning + multilingual + open license |

### Alternatives

| Model | Params | License | Pros | Cons |
|-------|--------|---------|------|------|
| Qwen3-32B | 32B | Apache 2.0 | Native 128K context, strong multilingual | Already post-trained for reasoning |
| Native Qwen3 architecture | 32B | Apache 2.0 | Proven fine-tuning recipes | Older than Qwen3 |
| Llama-3.3-70B | 70B | Llama 3.3 | Best quality, 128K context | Requires 2x A100 80GB minimum |
| Mistral-Small-24B | 24B | Apache 2.0 | Fits on single A100 | Smaller capacity |

**Decision: Qwen3-32B** — native architecture, 128K context, Apache 2.0, best multilingual support including Czech.

---

## 2. Training Method: FULL FINE-TUNING (Not LoRA/DORA)

After v2.2 analysis, we determined that **parameter-efficient methods cannot overcome base model dominance on precise facts**. The only way to guarantee factual memorization is to update ALL parameters.

### Full Fine-Tuning with DeepSpeed ZeRO-3

| Config | Value |
|--------|-------|
| Method | Full parameter update (32.8B params) |
| Precision | BF16 mixed precision |
| Optimizer | AdamW (via DeepSpeed) |
| ZeRO stage | 3 with CPU/NVMe offload |
| Gradient checkpointing | Enabled |
| Gradient accumulation | 32 steps |
| VRAM per GPU | ~40-60GB |
| GPUs needed | 2-4x A100 80GB |
| Cost (Vast.ai) | ~$1.50/hr per A100 × 4 GPUs × 48h = **~$288** |
| Quality | **Best possible** — all params updated |

### Why Full FT Over DORA/LoRA?

| Aspect | LoRA/DORA | Full FT |
|--------|-----------|---------|
| Parameters updated | 0.1-1% | 100% |
| Factual memorization | Weak (v2.2 proved this) | Strong |
| Training speed | Fast | Slow |
| VRAM need | Low | High |
| Final quality | Limited by base model | True domain adaptation |

**Decision: FULL FINE-TUNING** — we need true domain adaptation, not adapter patches.

### Fallback: DORA (if full FT is unavailable)

If 4× A100 is unavailable, `scripts/train_v2.3.py` provides DORA as fallback with rank 512 + rsLoRA on 1× A100 80GB.

---

## 2.5 Hybrid Architecture: FT + RAG

Hiran v2.3 uses a **hybrid approach** combining two complementary systems:

### Fine-Tuned Model (Zion Expert)
- **Purpose**: Deep expertise in Zion blockchain, DAO governance, mining pools
- **Training**: Full fine-tuning on 43K Zion-specific pairs
- **Strength**: Precise facts, domain terminology, code generation, multilingual Zion content
- **Limitation**: Cannot store infinite general knowledge in 32B parameters

### RAG System (General Knowledge)
- **Purpose**: History, religion, science, cultures, languages
- **Components**:
  - **Knowledge Corpora**: 25 markdown documents across religion (Amduat, Bible, world religions), history (civilizations, empires, nations), science (physics, chemistry, biology, astronomy, math), cultures & languages (traditions, 7 language basics)
  - **Vector DB**: ChromaDB with `all-MiniLM-L6-v2` embeddings
  - **Query Router**: Classifies queries as `zion_only`, `knowledge_rag`, or `hybrid`
  - **Retriever**: Fetches top-k relevant chunks based on cosine similarity

### How It Works
```
User Query → Query Router → Classification
                              ↓
                    ┌────────┴────────┐
                    ↓                 ↓
              Zion-specific      General knowledge
                    ↓                 ↓
            Fine-Tuned Model      RAG Retriever
                    ↓                 ↓
              Domain answer    Retrieved context
                                    ↓
                              FT Model + Context
                                    ↓
                              Final Response
```

### Why This Architecture?
- **FT only**: Cannot memorize all human knowledge in 32B parameters
- **RAG only**: Lacks deep domain expertise and precise factual recall
- **Hybrid**: Zion facts come from FT (no retrieval needed = faster), general knowledge from RAG (extensible = add more documents anytime)

### Extensibility
Adding new knowledge domains requires NO retraining:
1. Write markdown documents in `knowledge/corpora/`
2. Run `python rag/indexer.py` to embed and index
3. The RAG system automatically retrieves from new collections

---

## 3. Enhanced Dataset Architecture

### v2.2 Problem Analysis

v2.2 dataset had 22,181 pairs. Key facts (89/5/5/1 split, 7 categories) appeared only **1-3 times** in different forms. For a model to memorize facts, they need **20-50 repetitions** with variation.

### v2.3 Dataset Design: "Factual Reinforcement Loops"

```
Actual dataset: 48,436 weighted instruction pairs (20,517 unique)
├── Stage 1a: FACTUAL_REINFORCEMENT (3,200 pairs)
│   ├── Fee split: 500 variations
│   ├── 7 categories: 1,000 variations
│   ├── L1-L6 architecture: 500 variations
│   ├── Issobella wallet: 200 variations
│   ├── Chain-of-thought: 500 pairs
│   └── Negative corrections: 500 pairs
│
├── Stage 1b: DRILL_PATTERNS (5,302 pairs)
│   ├── Fee split drills: 2,000
│   ├── Refusal drills: 1,000
│   ├── Layer identification: 600
│   ├── Category listing: 500
│   ├── True/false: 300
│   ├── Verification: 200
│   └── Memory anchors: 56
│
├── Stage 2: ZION_DOMAIN (1,500 pairs)
│   ├── Mining pool protocol: 300
│   ├── Cross-chain bridge: 300
│   ├── DAO governance: 300
│   ├── Node & consensus: 300
│   └── Security & wallet: 300
│
├── Stage 3: CROSS_DOMAIN (1,000 pairs)
│   ├── Zion vs other blockchains: 500
│   └── Technical integration: 500
│
├── Stage 4: PREFERENCE_ALIGNMENT (500 pairs)
│   └── Chosen/rejected pairs for ORPO
│
├── Stage 5: CONVERSATION_FLOW (300 pairs)
│   └── Multi-turn technical discussions
│
├── Stage 6: BILINGUAL (2,015 pairs)
│   └── Czech/English pairs
│
├── Stage 7: CODE_GENERATION (3,000 pairs)
│   ├── Rust: 1,713
│   ├── Python: 880
│   └── Solidity: 407
│
├── Stage 8: INFERENCE_DOCS (2,000 pairs)
│   └── Deployment, monitoring, troubleshooting
│
└── Stage 9: SAFETY & ADVERSARIAL (1,700 pairs)
    ├── Jailbreak refusals: 210
    ├── Attack refusals: 210
    ├── Misinformation refusals: 180
    ├── Manipulation refusals: 150
    ├── Multi-turn anchoring: 270
    ├── Edge case handling: 680
    └── Trick questions: 140
```

### Key Dataset Innovations

1. **Fact Anchor Cards**: Every critical number appears in 20+ different linguistic forms
2. **System Prompt Training**: 30% of examples include `<|system|>Zion DAO technical assistant<|/system|>` prefix
3. **CoT Forcing**: 40% of examples show explicit step-by-step reasoning before final answer
4. **Adversarial Immunization**: Examples of common hallucinations (Mormon church, generic mining) with corrections
5. **Structured Output Training**: All responses use markdown tables, bullet lists, or JSON for precision
6. **Jailbreak Resistance**: Dedicated stage (Stage 9) with 210+ refusal examples covering DAN mode, developer mode, system override, translation attacks, and roleplay exploits
7. **Attack Scenario Refusals**: 210+ examples refusing mempool flooding, 51% attacks, wallet theft, vote manipulation, and trojan contract creation
8. **Multi-Turn Consistency**: 270+ conversation examples testing context retention when topic shifts between Zion and general knowledge and back
9. **Edge Case Handling**: 680+ examples for mixed-domain queries (Zion vs religion), misconceptions (CEO, stock ticker), unanswerable questions (price predictions), and trick questions

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

### Vast.ai Instance Requirements (FULL FT)

| Spec | Minimum | Recommended | Ideal |
|------|---------|-------------|-------|
| GPU | 2× A100 80GB | 4× A100 80GB | 8× A100 80GB |
| VRAM total | 160GB | 320GB | 640GB |
| CPU RAM | 128GB+ | 256GB+ | 512GB+ |
| Disk | 300GB | 500GB | 500GB |
| Cost/hr | ~$3.00 | ~$6.00 | ~$12.00 |

### Estimated Duration & Cost (FULL FT)

| Phase | Duration | Cost (2× A100) | Cost (4× A100) |
|-------|----------|----------------|----------------|
| Dataset generation | Local | $0 | $0 |
| Full FT training (3 epochs) | 48-72h | $144-216 | $288-432 |
| Evaluation | 4h | $12 | $24 |
| **Total** | **~52-76h** | **~$156-228** | **~$312-456** |

### Recommendation

**4× A100 80GB** is the sweet spot for full FT of 32B model. Training completes in ~48 hours. Fallback to 2× A100 with CPU offload if 4× unavailable.

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
├── data/
│   ├── generators/               # Dataset generators
│   │   ├── generate_factual_core.py
│   │   ├── generate_drill_patterns.py
│   │   ├── generate_domain_expertise.py
│   │   ├── generate_bilingual.py
│   │   ├── generate_code.py
│   │   ├── generate_inference.py
│   │   └── build_v2.3_dataset.py
│   ├── curriculum/               # 8 stages, 43,336 weighted pairs
│   │   ├── stage1_factual_reinforcement.jsonl  (3,200 pairs)
│   │   ├── stage1_drill_patterns.jsonl       (5,302 pairs)
│   │   ├── stage2_domain_expertise.jsonl       (1,500 pairs)
│   │   ├── stage3_cross_domain.jsonl           (1,000 pairs)
│   │   ├── stage4_preference_pairs.jsonl       (500 pairs)
│   │   ├── stage5_conversation.jsonl           (300 pairs)
│   │   ├── stage6_bilingual.jsonl              (2,015 pairs)
│   │   ├── stage7_code_generation.jsonl        (3,000 pairs)
│   │   ├── stage8_inference.jsonl              (2,000 pairs)
│   │   └── v2.3_combined_dataset.jsonl         (43,336 weighted)
│   └── validate_v2.3.py         # Dataset validation (6 checks)
├── knowledge/                    # RAG knowledge corpora
│   ├── generators/
│   │   ├── generate_religion.py  # Amduat, Bible, world religions
│   │   ├── generate_history.py   # Civilizations, empires, nations
│   │   ├── generate_science.py   # Physics, chemistry, biology, math
│   │   └── generate_culture_languages.py  # Traditions, languages
│   ├── corpora/                  # 25 markdown documents
│   └── vector_db/                # ChromaDB vector index
├── rag/                          # RAG Pipeline
│   ├── indexer.py               # Document chunking + embedding
│   ├── retriever.py             # Context retrieval from vector DB
│   ├── query_router.py          # Zion vs Knowledge classification
│   └── inference_hybrid.py      # FT model + RAG combined inference
├── scripts/
│   ├── train_v2.3_fullft.py     # FULL FT (DeepSpeed ZeRO-3)
│   ├── train_v2.3.py            # DORA fallback (1× A100)
│   ├── run_training_fullft.sh   # Full FT launcher
│   ├── run_training.sh          # DORA launcher
│   ├── merge_model.py           # Merge adapters (DORA only)
│   ├── evaluate_v2.3.py         # Comprehensive evaluation
│   └── interview_v2.3.py        # Model interview
├── config/
│   ├── deepspeed_zero3.json     # DeepSpeed ZeRO-3 config
│   ├── curriculum_config.json   # Stage definitions
│   └── dora_config.json         # DORA fallback config
└── results/
    └── (evaluation reports)
```

---

## 8. Implementation Milestones

| Milestone | ETA | Deliverable |
|-----------|-----|-------------|
| M1: Dataset generation | Day 1 | 43K+ validated pairs (DONE) |
| M2: Vast.ai provisioning | Day 2 | 4× A100 80GB instance |
| M3: Full FT training | Day 2-4 | Complete model checkpoint |
| M4: Evaluation | Day 4 | Factual recall + code gen test |
| M5: Quantize + deploy | Day 5 | GGUF for inference |
| M6: Production ready | Day 6 | API server + docs |

---

## 9. Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 4× A100 unavailable on Vast.ai | Medium | Pre-book; fallback to 2× A100 + CPU offload; DORA as last resort |
| Full FT OOM on single GPU | High | DeepSpeed ZeRO-3 + CPU offload; reduce batch to 1; increase grad accum |
| Training interrupted | Medium | Checkpoint every 500 steps; auto-resume from latest |
| 43K dataset overfits | Low | Only 3 epochs; weight decay 0.01; eval every 200 steps |
| Model still hallucinates at low temp | Low | Massive drill patterns (5,302 pairs); 200× repetition of key facts |
| Czech output quality poor | Medium | 2,015 bilingual pairs; evaluate separately on Czech test set |

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
8. ✅ Model answers correctly in **Czech** about Zion facts
9. ✅ Model explains technical concepts with **chain-of-thought reasoning**
10. ✅ Model provides accurate API examples and deployment configs

---

*Plan created: 2026-05-19*
*Next step: Begin M1 (dataset generation)*
