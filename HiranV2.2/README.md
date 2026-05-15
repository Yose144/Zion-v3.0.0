# Hiran v2.2 - Multi-Domain AI Native Agent

## Overview

Hiran v2.2 je robustní upgrade nad v2.1 s důrazem na multi-domain learning, dynamický QLoRA training a hybrid inference. Tato verze je navržena pro lepší generalizaci, robustnější inference a efektivnější deployment.

## Key Improvements over v2.1

| Feature | v2.1 | v2.2 |
|---------|------|------|
| Training Approach | Single-domain fine-tuning | Multi-domain curriculum learning |
| LoRA Configuration | Static (rank 32, alpha 64) | Dynamic (16-64 adaptive) |
| Dataset Size | ~3056 pairs | 5001 pairs (target met) |
| Quantization | Q5_K_M only | Hybrid (Q4_K_M + Q8_0) |
| Inference Backends | llama.cpp only | llama.cpp + ONNX + TensorRT |
| RAG Integration | Basic | Advanced hybrid RAG |
| Evaluation | Basic perplexity | Multi-domain accuracy + cross-domain |

## Directory Structure

```
HiranV2.2/
├── README.md                          # Tento soubor
├── HIRAN_V2.2_ROBUST_UPGRADE.md      # Architektura a design
├── TRAINING_IMPLEMENTATION_PLAN.md   # Detailní implementační plán
├── curriculum/                        # Curriculum learning pipeline
│   ├── curriculum_pipeline.py         # Hlavní pipeline
│   ├── stages/                       # Definice fází
│   └── config/                       # Konfigurace
├── data/                             # Dataset management
│   ├── curriculum/                   # Curriculum data files
│   │   ├── foundation.jsonl
│   │   ├── zion_core.jsonl
│   │   ├── zion_advanced.jsonl
│   │   ├── cross_domain.jsonl
│   │   └── rag_synthesis.jsonl
│   ├── build_dataset.py              # Dataset builder
│   ├── validate_dataset.py           # Dataset validator
│   ├── scrape_v3_docs.py            # V3 docs scraper
│   └── dataset_stats.json            # Statistiky
├── config/                           # Training configurations
│   ├── dynamic_lora.py               # Dynamic QLoRA config
│   └── training_configs/             # Training configs
├── scripts/                          # Training a deployment skripty
│   ├── prepare_dataset.sh            # Dataset preparation
│   ├── train_v2.2.py                 # QLoRA curriculum training
│   ├── sync_curriculum_to_vast.sh   # rsync dat na Vast
│   └── deploy_vast.sh                # Vast.ai deployment
├── evaluate/                         # Evaluation a testing
│   ├── evaluate_v2.2.py              # Evaluation script
│   ├── benchmark_dataset.py          # Train/eval split helper
│   └── test_backends.py              # Backend testing
├── quantization/                     # Model quantization
│   └── hybrid_quant.py               # Hybrid quantization
├── inference/                        # Inference backends
│   └── multi_backend.py              # Multi-backend support
└── models/                           # Trained models
    ├── hiran-v2.2-f16.gguf
    ├── hiran-v2.2-q8_0.gguf
    ├── hiran-v2.2-q5_k_m.gguf
    ├── hiran-v2.2-q4_k_m.gguf
    └── hiran-v2.2-onnx/
```

## Quick Start

### 1. Dataset Preparation

```bash
# Spustit dataset preparation
cd HiranV2.2
bash scripts/prepare_dataset.sh

# Nebo manuálně:
python3 data/scrape_v3_docs.py
python3 data/validate_dataset.py
```

### 2. Training (Phase 2 — QLoRA curriculum)

Z lokálního stroje s NVIDIA GPU (nebo po syncu na Vast, viz níže):

```bash
pip install -r HiranV2.2/requirements-train.txt
python3 HiranV2.2/scripts/train_v2.2.py --dry_run
# plný běh + TensorBoard
python3 HiranV2.2/scripts/train_v2.2.py \
  --output_dir HiranV2.2/checkpoints \
  --data_dir HiranV2.2/data/curriculum \
  --tensorboard --logging_steps 20 --save_steps 500
# TensorBoard: tensorboard --logdir HiranV2.2/checkpoints/logs
```

**Nová Vast instance (doporučeno ≥100 GB disk pro HF cache + checkpointy):**

```bash
export VAST_SSH="root@<host>.vast.ai"
export VAST_PORT="<ssh_port_z_konzole>"
export SSH_IDENTITY="$HOME/.ssh/vast_hiran_key"
bash HiranV2.2/scripts/sync_curriculum_to_vast.sh
```

Na instanci pak `cd` do vypísaného `VAST_REMOTE_DIR` a spusť `pip install` + `train_v2.2.py` jako výše (cesty `data/curriculum` a `scripts` jsou relativní k tomu adresáři).

**Holdout pro eval (volitelné):**

```bash
python3 HiranV2.2/evaluate/benchmark_dataset.py \
  --input HiranV2.2/data/curriculum/foundation.jsonl \
  --train_out /tmp/foundation_train.jsonl \
  --eval_out /tmp/foundation_eval.jsonl
```

### 3. Quantization

```bash
# Vytvořit GGUF variants
python3 quantization/hybrid_quant.py
```

### 4. Deployment

```bash
# Deploy na Vast.ai
bash scripts/deploy_vast.sh
```

## Curriculum Learning Stages

### Stage 1: Foundation (20%)
- **Cíl:** Obecné znalosti a základní reasoning
- **Data:** Obecné technické dokumenty, základní koncepty
- **LoRA:** Rank 16, Alpha 32, Dropout 0.1
- **Epochs:** 2

### Stage 2: ZION Core (30%)
- **Cíl:** ZION specifické koncepty a terminologie
- **Data:** V3 dokumentace, CLI příkazy, architektura
- **LoRA:** Rank 32, Alpha 64, Dropout 0.05
- **Epochs:** 3

### Stage 3: ZION Advanced (20%)
- **Cíl:** Pokročilé ZION témata a operace
- **Data:** Deployment, monitoring, advanced konfigurace
- **LoRA:** Rank 32, Alpha 64, Dropout 0.05
- **Epochs:** 2

### Stage 4: Cross-Domain (20%)
- **Cíl:** Vícenásobné domény a generalizace
- **Data:** External RAG corpora, Buddhism, academic
- **LoRA:** Rank 64, Alpha 128, Dropout 0.02
- **Epochs:** 2

### Stage 5: RAG Synthesis (10%)
- **Cíl:** Syntéza s RAG kontextem
- **Data:** RAG-enriched Q&A pairs
- **LoRA:** Rank 64, Alpha 128, Dropout 0.02
- **Epochs:** 1

## Dataset Strategy

### Data Sources

1. **V3 Documentation** (~1500 pairs)
   - V3/docs/ kompletní dokumentace
   - CLI guides, API reference
   - Deployment guides

2. **v2.1 Data** (~3056 pairs)
   - Re-use existujícího datasetu
   - Validace a čištění

3. **OASIS Profiles** (~500 pairs)
   - Avatar personality a knowledge
   - Rozšířené profily

4. **External RAG** (~1000-2000 pairs)
   - Licencované Buddhism corpus
   - Open source technical docs
   - Academic papers (s citacemi)

### Target Dataset Size

- **Minimum:** 5000 pairs
- **Optimal:** 8000 pairs
- **Distribution:** Podle curriculum fází

## Training Requirements

### Hardware
- **GPU:** RTX 4090 (24GB) nebo A100 (40GB)
- **RAM:** 64GB+
- **Storage:** 100GB+
- **CPU:** 8+ cores

### Software
- **Python:** 3.9+
- **PyTorch:** 2.0+
- **Transformers:** 4.30+
- **PEFT:** 0.6+
- **BitsAndBytes:** 0.41+

### Training Time
- **Foundation stage:** ~12 hodin
- **ZION core stage:** ~18 hodin
- **Advanced stages:** ~24 hodin
- **Total:** ~3-5 dní (v závislosti na datasetu)

## Inference Requirements

### Minimum (CPU)
- **CPU:** 8+ cores
- **RAM:** 32GB
- **Model:** Q4_K_M quantization
- **Latency:** ~2-5s

### Recommended (GPU)
- **GPU:** 8GB+ VRAM (RTX 3060+)
- **RAM:** 16GB
- **Model:** Q5_K_M quantization
- **Latency:** ~100-500ms

### High Performance
- **GPU:** 16GB+ VRAM (RTX 4090)
- **RAM:** 32GB
- **Model:** Q8_0 nebo F16
- **Latency:** ~50-100ms

## Model Variants

| Variant | Size | VRAM | Use Case |
|---------|------|------|----------|
| F16 | 16GB | 16GB+ | Reference, high quality |
| Q8_0 | 8.5GB | 8GB+ | High quality inference |
| Q5_K_M | 5.4GB | 6GB+ | Balanced (default) |
| Q4_K_M | 4.5GB | 4GB+ | Edge, mobile |
| ONNX | 5-8GB | Variable | Cross-platform |

## Evaluation Metrics

### Primary Metrics
- **Perplexity:** < 1.2 (validation set)
- **Cross-domain accuracy:** > 80%
- **Inference latency:** < 100ms (GPU), < 2s (CPU)
- **Memory footprint:** < 8GB (Q4_K_M)

### Secondary Metrics
- **Dataset size:** > 5000 pairs
- **Multi-backend support:** 3+ backends
- **Platform coverage:** cloud + edge + local
- **Documentation completeness:** 100%

## Deployment Options

### Cloud Deployment
- **Vast.ai:** RTX 3060/4090, pay-as-you-go
- **RunPod:** Pod-grade GPUs, reserved instances
- **Hugging Face:** Managed endpoints

### Edge Deployment
- **ONNX Runtime:** CPU/GPU inference
- **TensorRT:** NVIDIA GPU acceleration
- **llama.cpp:** Multi-platform support

### Local Deployment
- **Docker:** Containerized inference
- **CLI integration:** ZION CLI `zion hiran` commands
- **Monitoring:** Prometheus + Grafana

## Troubleshooting

### Training Issues
- **CUDA OOM:** Snižte batch size nebo použijte gradient checkpointing
- **Slow training:** Zkontrolujte GPU utilization, zvažte mixed precision
- **Poor convergence:** Upravte learning rate, zkontrolujte data quality

### Inference Issues
- **Model corruption:** Ověřte SHA256 hash modelu
- **Slow inference:** Zkontrolujte quantization, použijte GPU
- **Poor quality:** Zkontrolujte prompt format, zvažte fine-tuning

### Deployment Issues
- **Port conflicts:** Změňte port v config
- **Permission denied:** Zkontrolujte file permissions
- **GPU not detected:** Ověřte NVIDIA drivers, Docker GPU access

## Timeline

### Fáze 1: Dataset & Curriculum (2-3 dny)
- [x] Design curriculum pipeline
- [x] Expand dataset to 5000+ pairs (5001 pairs, 0 duplicates, 0 toxic content)
- [x] Validate data quality
- [x] Create curriculum configs

### Fáze 2: Training Pipeline (3-5 dní)
- [x] Implement dynamic QLoRA (`config/dynamic_lora.py`)
- [x] Multi-stage training (`scripts/train_v2.2.py`)
- [x] Evaluation protocol (initial `evaluate/`)
- [ ] Full training run + convergence report

### Fáze 3: Quantization (1 den)
- [ ] Hybrid quantization
- [ ] Multi-variant GGUF
- [ ] ONNX conversion
- [ ] Quantization validation

### Fáze 4: Inference Testing (1-2 dny)
- [ ] Multi-backend testing
- [ ] Performance benchmarking
- [ ] Platform compatibility
- [ ] Memory analysis

### Fáze 5: Deployment (1 den)
- [ ] Vast.ai deployment
- [ ] Docker deployment
- [ ] Documentation update
- [ ] Git push & release

## References

- **v2.1 Plan:** `../HiranV2.1/PLAN_v2.1.md`
- **v2.1 Upgrade:** `HIRAN_V2.2_ROBUST_UPGRADE.md`
- **Training Plan:** `TRAINING_IMPLEMENTATION_PLAN.md`
- **CLI Integration:** `../HIRAN_V2.2_CLI_INTEGRATION.md`
- **V3 Status:** `../StatusV3.md`

## Contributing

Při přidávání nových features:
1. Aktualizuj tento README
2. Přidejte relevantní testy
3. Aktualizujte dokumentaci
4. Commit s clear message

## License

Stejná jako hlavní ZION projekt.

---

**Status:** Active Development  
**Version:** 2.2-alpha  
**Last Updated:** 2026-05-12  
**Maintainers:** ZION AI Team