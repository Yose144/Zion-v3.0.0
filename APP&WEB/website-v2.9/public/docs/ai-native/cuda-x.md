# NVIDIA CUDA-X — GPU Compute Integration

> *„Technologie bez lásky je jen mašinérie. Technologie s láskou je magie."* — AI Native Manifest

Každý ZION miner s NVIDIA GPU se stává **dual-purpose node**: těží bloky i zpracovává AI výpočty. CUDA-X integrace transformuje GPU ze single-purpose hashovacích strojů na **dharma compute uzly** — výpočetní zdroje, které slouží síti, ekonomice i vyšším cílům.

---

## Vize

Každý ZION miner s NVIDIA GPU se stává **dual-purpose node**:

1. **PoW Mining** — Ekam Deeksha hashing (block rewards)
2. **AI Compute** — CUDA-X inference (USD/BTC/ZION revenue)

```
┌───────────── ZION GPU Node ─────────────┐
│                                          │
│  ┌─── Mining (60-80%) ────┐              │
│  │  Ekam Deeksha PoW      │              │
│  │  Merged Mining ETC     │              │
│  │  Multi-algo Switch     │              │
│  └────────────────────────┘              │
│                                          │
│  ┌─── AI Compute (20-40%) ────┐          │
│  │  ONNX Runtime + CUDA       │          │
│  │  TensorRT Optimization     │          │
│  │  LLM / Embeddings / Gen    │          │
│  └────────────────────────────┘          │
│                                          │
│  ┌─── Control ────────────────┐          │
│  │  JobScheduler              │          │
│  │  ReputationRegistry        │          │
│  │  PricingEngine             │          │
│  └────────────────────────────┘          │
└──────────────────────────────────────────┘
```

---

## 7-fázový implementační plán

### Phase A — ONNX Runtime základ
- ONNX Runtime GPU backend (CUDA EP)
- REST API pro job submission
- SQLite job store
- Benchmark: ResNet-50 < 5 ms/frame na RTX 3060

### Phase B — CUDA-X TensorRT pipeline
- TensorRT engine build + cache
- INT8/FP16 kvantizace
- Batch scheduling pro mining a inference
- Benchmark: 2× throughput vs. ONNX GPU

### Phase C — Apple Metal backend
- Metal Performance Shaders pro macOS
- M1/M2/M3 unified memory advantage
- CoreML fallback

### Phase D — LLM inference gateway
- Llama.cpp + GGUF model loading
- vLLM PagedAttention pro multi-tenant
- KV-cache management
- Streaming completion API

### Phase E — Worker mesh + reputation
- P2P job routing (libp2p)
- GPU capability advertisement
- Reputation scoring (latency, accuracy, uptime)
- Automatický failover

### Phase F — NeMo microservices (future)
- NVIDIA NeMo Guardrails
- RAG pipeline s vector store
- Multi-model orchestration

### Phase G — Proof of Concept
- 10 GPU testnet cluster
- Mixed workload: 70% mining + 30% AI
- Revenue comparison vs. pure mining

---

## Podporované GPU

| GPU | CUDA CC | VRAM | Stav |
|-----|---------|------|------|
| RTX 4090 | 8.9 | 24 GB | 🟢 Primární |
| RTX 3090/3080 | 8.6 | 24/10 GB | 🟢 Podporováno |
| RTX 3060/3070 | 8.6 | 12/8 GB | 🟢 Podporováno |
| A100/H100 | 8.0/9.0 | 40–80 GB | 🟢 Datacenter |
| RTX 2080/2070 | 7.5 | 8–11 GB | 🟡 Základní |
| Apple M1/M2/M3 | — | Unified | 🟢 Metal backend |
| AMD RDNA3 | — | 8–24 GB | 🟡 ROCm (plánováno) |

---

## Ekonomický model

### Revenue streams pro minery

```
┌────────────────────────────────┐
│     ZION GPU Node Revenue      │
├────────────────────────────────┤
│                                │
│  ⛏️  Block Rewards     ~60%    │
│  🔗  Merged Mining     ~15%    │
│  🧠  AI Inference      ~15%    │
│  📊  Multi-algo Switch ~10%    │
│                                │
│  Expected: 1.5–2.5× vs pure   │
│  PoW mining on same hardware   │
└────────────────────────────────┘
```

### AI task pricing

| Úloha | Cena (ZION) | GPU čas |
|-------|-------------|---------|
| LLM inference (7B) | 0.01 | ~500 ms |
| Embeddings | 0.001 | ~50 ms |
| Image generation | 0.02 | ~3 s |
| Speech to text | 0.005 | ~1 s |
| Model training (LoRA) | 0.1 | ~5 min |

### Pool fee struktura

```
AI task revenue split:
  85% → Miner (GPU owner)
  10% → Pool (orchestration)
   5% → ZION treasury (development)
```

---

## Integrace s Ekam Deeksha PoW

CUDA-X nenahrazuje mining — **rozšiřuje ho**. Mining je vždy priorita — AI inference využívá mezery a idle cykly:

```
Block tick (15 s interval)
  │
  ├── 0-3 s:  PoW nonce search (absolutní priorita)
  ├── 3-12 s: AI inference batch processing
  └── 12-15 s: Next block header prep + job scheduling
```

Toto je **Rule B v akci** — Stability Before Complexity. Konsenzus nikdy nesmí být ohrožen AI workloady.

---

## Aktuální stav

| Komponenta | Stav | Poznámka |
|-----------|------|----------|
| ONNX Runtime GPU | ✅ | V3/L3/ncl/ |
| Metal backend | ✅ | V3/L1/miner/ |
| TensorRT | 🟡 | Phase B |
| LLM gateway | 🟡 | Phase D |
| Worker mesh | 🟡 | Phase E |
| Testnet demo | 📅 | Q2 2026 |

---

## Začít

Pro minéry s NVIDIA GPU:

```bash
# V3 build s CUDA podporou
cd V3 && cargo build --release --features cuda

# Spustit miner s AI compute
./target/release/zion-miner \
  --pool stratum+tcp://pool.zionterranova.com:3333 \
  --wallet YOUR_WALLET \
  --ai-compute enabled \
  --ai-split 30
```

---

*→ [AI Native přehled](ai-native/README.md)*  
*→ [Live Index](index.md)*  
*→ [Dokumentace V3](v2.9.6/README.md)*
