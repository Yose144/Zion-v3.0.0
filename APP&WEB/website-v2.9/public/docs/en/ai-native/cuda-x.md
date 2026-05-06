# NVIDIA CUDA-X — GPU compute integration

> *“Technology without love is only machinery. Technology with love is magic.”* — AI Native Manifest

Every ZION miner with an NVIDIA GPU becomes a **dual-purpose node**: it mines blocks and runs AI workloads. CUDA-X turns the GPU from a single-purpose hash machine into **dharma compute nodes** — capacity that serves the network, the economy, and higher goals.

---

## Vision

Every ZION miner with an NVIDIA GPU becomes a **dual-purpose node**:

1. **PoW mining** — Ekam Deeksha hashing (block rewards)  
2. **AI compute** — CUDA-X inference (USD/BTC/ZION revenue)  

```
┌───────────── ZION GPU Node ─────────────┐
│                                          │
│  ┌─── Mining (60-80%) ────┐              │
│  │  Ekam Deeksha PoW      │              │
│  │  Merged mining ETC     │              │
│  │  Multi-algo switch     │              │
│  └────────────────────────┘              │
│                                          │
│  ┌─── AI compute (20-40%) ────┐          │
│  │  ONNX Runtime + CUDA       │          │
│  │  TensorRT optimization    │          │
│  │  LLM / embeddings / gen     │          │
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

## Seven-phase implementation plan

### Phase A — ONNX Runtime baseline
- ONNX Runtime GPU backend (CUDA EP)  
- REST API for job submission  
- SQLite job store  
- Benchmark: ResNet-50 &lt; 5 ms/frame on RTX 3060  

### Phase B — CUDA-X TensorRT pipeline
- TensorRT engine build + cache  
- INT8/FP16 quantization  
- Batch scheduling for mining and inference  
- Benchmark: 2× throughput vs ONNX GPU  

### Phase C — Apple Metal backend
- Metal Performance Shaders on macOS  
- M1/M2/M3 unified memory advantage  
- CoreML fallback  

### Phase D — LLM inference gateway
- Llama.cpp + GGUF model loading  
- vLLM PagedAttention for multi-tenant  
- KV-cache management  
- Streaming completion API  

### Phase E — Worker mesh + reputation
- P2P job routing (libp2p)  
- GPU capability advertisement  
- Reputation scoring (latency, accuracy, uptime)  
- Automatic failover  

### Phase F — NeMo microservices (future)
- NVIDIA NeMo Guardrails  
- RAG pipeline with vector store  
- Multi-model orchestration  

### Phase G — Proof of concept
- 10-GPU testnet cluster  
- Mixed workload: 70% mining + 30% AI  
- Revenue comparison vs pure mining  

---

## Supported GPUs

| GPU | CUDA CC | VRAM | Status |
|-----|---------|------|--------|
| RTX 4090 | 8.9 | 24 GB | 🟢 Primary |
| RTX 3090/3080 | 8.6 | 24/10 GB | 🟢 Supported |
| RTX 3060/3070 | 8.6 | 12/8 GB | 🟢 Supported |
| A100/H100 | 8.0/9.0 | 40–80 GB | 🟢 Datacenter |
| RTX 2080/2070 | 7.5 | 8–11 GB | 🟡 Baseline |
| Apple M1/M2/M3 | — | Unified | 🟢 Metal backend |
| AMD RDNA3 | — | 8–24 GB | 🟡 ROCm (planned) |

---

## Economic model

### Revenue streams for miners

```
┌────────────────────────────────┐
│     ZION GPU node revenue      │
├────────────────────────────────┤
│                                │
│  ⛏️  Block rewards     ~60%    │
│  🔗  Merged mining     ~15%    │
│  🧠  AI inference      ~15%    │
│  📊  Multi-algo switch ~10%    │
│                                │
│  Expected: 1.5–2.5× vs pure   │
│  PoW mining on same hardware   │
└────────────────────────────────┘
```

### AI task pricing

| Task | Price (ZION) | GPU time |
|------|--------------|----------|
| LLM inference (7B) | 0.01 | ~500 ms |
| Embeddings | 0.001 | ~50 ms |
| Image generation | 0.02 | ~3 s |
| Speech to text | 0.005 | ~1 s |
| Model training (LoRA) | 0.1 | ~5 min |

### Pool fee structure

```
AI task revenue split:
  85% → Miner (GPU owner)
  10% → Pool (orchestration)
   5% → ZION treasury (development)
```

---

## Integration with Ekam Deeksha PoW

CUDA-X does not replace mining — **it extends it**. Mining always comes first; AI inference uses slack and idle cycles:

```
Block tick (15 s interval)
  │
  ├── 0-3 s:   PoW nonce search (absolute priority)
  ├── 3-12 s:  AI inference batch processing
  └── 12-15 s: Next block header prep + job scheduling
```

This is **Rule B in action** — stability before complexity. Consensus must never be put at risk by AI workloads.

---

## Current status

| Component | Status | Note |
|-----------|--------|------|
| ONNX Runtime GPU | ✅ | V3/L3/ncl/ |
| Metal backend | ✅ | V3/L1/miner/ |
| TensorRT | 🟡 | Phase B |
| LLM gateway | 🟡 | Phase D |
| Worker mesh | 🟡 | Phase E |
| Testnet demo | 📅 | Q2 2026 |

---

## Getting started

For miners with NVIDIA GPUs:

```bash
# V3 build with CUDA support
cd V3 && cargo build --release --features cuda

# Run miner with AI compute
./target/release/zion-miner \
  --pool stratum+tcp://pool.zionterranova.com:3333 \
  --wallet YOUR_WALLET \
  --ai-compute enabled \
  --ai-split 30
```

---

*→ [AI Native overview](README.md)*  
*→ [Live Index](../index.md)*  
*→ [V3 documentation](../v2.9.6/README.md)*
