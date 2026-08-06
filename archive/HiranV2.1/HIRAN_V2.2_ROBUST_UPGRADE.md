# Hiran v2.2: Robustní Upgrade Plán

## Přehled

Hiran v2.2 je navržen jako robustnější upgrade nad v2.1 s důrazem na:
- Lepší generalizaci přes různé domény
- Robustnější inference na různém hardware (CPU/GPU)
- Zlepšené RAG integrace
- Efektivnější trénink a deployment

## Architektura v2.2 vs v2.1

### v2.1 (Current)
- Single-domain fine-tuning (ZION specifický)
- QLoRA rank 32, alpha 64
- GGUF Q5_K_M quantization
- ~3056 training pairs
- Single inference backend (llama.cpp)

### v2.2 (Proposed)
- Multi-domain curriculum learning
- Dynamické QLoRA rank (16-64 adaptivní)
- Hybrid quantization (Q4_K_M + Q8_0 pro kritické části)
- Expanded dataset (~5000+ pairs)
- Multi-backend inference (llama.cpp + ONNX + TensorRT)

## Dataset Strategie

### 1. Curriculum Learning Pipeline

```python
# HiranV2.2/curriculum/curriculum_pipeline.py
class CurriculumStage(Enum):
    FOUNDATION = "foundation"      # Obecné znalosti
    ZION_CORE = "zion_core"        # ZION specifické koncepty
    ZION_ADVANCED = "zion_advanced" # Pokročilé ZION témata
    CROSS_DOMAIN = "cross_domain"  # Vícenásobné domény
    RAG_SYNTHESIS = "rag_synthesis" # Syntéza s RAG kontextem

curriculum = [
    (CurriculumStage.FOUNDATION, 0.2),      # 20% tréninku
    (CurriculumStage.ZION_CORE, 0.3),      # 30% tréninku
    (CurriculumStage.ZION_ADVANCED, 0.2),  # 20% tréninku
    (CurriculumStage.CROSS_DOMAIN, 0.2),   # 20% tréninku
    (CurriculumStage.RAG_SYNTHESIS, 0.1),  # 10% tréninku
]
```

### 2. Dataset Expansion

**Zdroje dat:**
- ZION dokumentace (v2.1 + nové V3 dokumenty)
- OASIS avatar profily (rozšířené)
- External RAG corpora (licencované, citované)
- Syntetická data pro reinforcement

**Cílová velikost:** 5000-8000 training pairs

## Model Architektura

### 1. Dynamic QLoRA Configuration

```python
# HiranV2.2/config/dynamic_lora.py
class DynamicLoRAConfig:
    def __init__(self, stage: CurriculumStage):
        if stage == CurriculumStage.FOUNDATION:
            self.rank = 16
            self.alpha = 32
            self.dropout = 0.1
        elif stage in [CurriculumStage.ZION_CORE, CurriculumStage.ZION_ADVANCED]:
            self.rank = 32
            self.alpha = 64
            self.dropout = 0.05
        else:
            self.rank = 64
            self.alpha = 128
            self.dropout = 0.02
```

### 2. Hybrid Quantization Strategy

```python
# HiranV2.2/quantization/hybrid_quant.py
class HybridQuantization:
    def __init__(self):
        self.critical_layers = [
            "lm_head",  # Output layer
            "embed_tokens",  # Embeddings
            "layers.0-3.mlp",  # Early layers
        ]
    
    def quantize_model(self, model_path):
        # Critical layers: Q8_0 (vyšší přesnost)
        # Remaining layers: Q4_K_M (vyšší efektivita)
        pass
```

## Training Pipeline

### 1. Multi-Stage Training

```bash
# HiranV2.2/scripts/train_v2.2.sh
#!/bin/bash

# Stage 1: Foundation
python train.py \
    --stage foundation \
    --data data/curriculum/foundation.jsonl \
    --lora_rank 16 \
    --epochs 2 \
    --output checkpoints/foundation

# Stage 2: ZION Core
python train.py \
    --stage zion_core \
    --data data/curriculum/zion_core.jsonl \
    --lora_rank 32 \
    --epochs 3 \
    --checkpoint checkpoints/foundation \
    --output checkpoints/zion_core

# Stage 3-5: Pokračování podle curriculum
# ...
```

### 2. Evaluation Protocol

**Metriky:**
- Perplexity (validation set)
- Domain-specific accuracy
- Cross-domain generalization
- Inference latency (CPU/GPU)
- Memory footprint

**Validation Sets:**
- ZION validation (20% from ZION data)
- Cross-domain validation (external data)
- RAG retrieval accuracy

## Inference Robustness

### 1. Multi-Backend Support

```python
# HiranV2.2/inference/multi_backend.py
class InferenceBackend(Enum):
    LLAMA_CPP = "llama_cpp"    # CPU + GPU (OpenCL/CUDA)
    ONNX_RUNTIME = "onnx"     # CPU/GPU (ONNX Runtime)
    TENSORRT = "tensorrt"       # GPU only (NVIDIA)
    VULKAN = "vulkan"          # GPU (multi-vendor)

class RobustInference:
    def __init__(self, model_path: str):
        self.backends = self._init_backends(model_path)
        self.primary = self._select_best_backend()
    
    def _select_best_backend(self):
        # Auto-detect available hardware
        if torch.cuda.is_available():
            return InferenceBackend.TENSORRT
        elif self._check_vulkan():
            return InferenceBackend.VULKAN
        else:
            return InferenceBackend.LLAMA_CPP
```

### 2. Fallback Strategy

```python
class FallbackInference:
    def generate(self, prompt: str, max_tokens: int = 512):
        try:
            return self.primary.generate(prompt, max_tokens)
        except Exception as e:
            logger.warning(f"Primary backend failed: {e}")
            return self.fallback.generate(prompt, max_tokens)
```

## Deployment Strategie

### 1. Model Variants

```
Hiran v2.2 Variants:
├── hiran-v2.2-f16.gguf (16-bit float - reference)
├── hiran-v2.2-q8_0.gguf (8-bit - high quality)
├── hiran-v2.2-q5_k_m.gguf (5-bit - balanced)
├── hiran-v2.2-q4_k_m.gguf (4-bit - efficient)
└── hiran-v2.2-onnx/ (ONNX format for edge deployment)
```

### 2. Platform Targets

- **Cloud:** Vast.ai, RunPod, Hugging Face Endpoints
- **Edge:** ONNX Runtime, TensorRT
- **Local:** llama.cpp (CPU + GPU)
- **Mobile:** Quantized GGUF (Q4_K_M)

## Timeline

### Fáze 1: Příprava (1-2 dny)
- [ ] Curriculum pipeline design
- [ ] Dataset expansion (5000+ pairs)
- [ ] Config templates pro v2.2

### Fáze 2: Training (3-5 dní)
- [ ] Foundation stage training
- [ ] ZION core stage training
- [ ] Advanced stages training
- [ ] Evaluation a tuning

### Fáze 3: Quantization (1 den)
- [ ] Hybrid quantization implementace
- [ ] Multi-variant GGUF export
- [ ] ONNX conversion

### Fáze 4: Inference Testing (1-2 dny)
- [ ] Multi-backend testing
- [ ] Platform compatibility testing
- [ ] Performance benchmarking

### Fáze 5: Deployment (1 den)
- [ ] Vast.ai deployment skripty
- [ ] Documentation update
- [ ] Git push a release

## Resource Requirements

### Training
- **GPU:** RTX 4090 (24GB) nebo A100 (40GB)
- **RAM:** 64GB+
- **Storage:** 100GB+
- **Čas:** 3-5 dní (v závislosti na datasetu)

### Inference
- **CPU:** 8+ cores, 32GB RAM (pro Q4_K_M)
- **GPU:** 8GB+ VRAM (pro Q5_K_M a lepší)
- **Storage:** 10GB+ (pro model)

## Risk Mitigation

### 1. Training Stability
- Gradient clipping
- Learning rate scheduling
- Checkpointing každých 100 steps
- Mixed precision training

### 2. Data Quality
- Automated validation checks
- Deduplication
- Toxicity filtering
- Balance checking

### 3. Deployment Robustness
- Multi-backend fallback
- Health checks
- Graceful degradation
- Monitoring alerts

## Success Criteria

### Primární metriky
- [ ] Perplexity < 1.2 (validation set)
- [ ] Cross-domain accuracy > 80%
- [ ] Inference latency < 100ms (GPU), < 2s (CPU)
- [ ] Memory footprint < 8GB (Q4_K_M)

### Sekundární metriky
- [ ] Dataset size > 5000 pairs
- [ ] Multi-backend support (3+ backends)
- [ ] Platform coverage (cloud + edge + local)
- [ ] Documentation completeness

## Next Steps

1. **Okamžité:** Vytvořit curriculum pipeline šablony
2. **Dataset:** Expandovat existující dataset o 2000+ pairs
3. **Config:** Připravit dynamic LoRA konfigurace
4. **Training:** Spustit foundation stage na Vast.ai
5. **Evaluation:** Implementovat multi-stage evaluation

---

**Status:** Draft - Pending Review
**Created:** 2026-05-12
**Author:** Devin (ZION AI Team)
**Version:** 0.1