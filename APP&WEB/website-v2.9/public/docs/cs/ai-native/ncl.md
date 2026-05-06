# NCL — Neural Compute Layer

> *„Miner není jen hashující stroj — je to uzel vědomí, který slouží síti i světu."*

NCL je infrastruktura L3, která transformuje ZION minery z jednoúčelových PoW strojů na **dual-purpose GPU compute uzly**. Minery vydělávají za mining i za AI výpočty — bez kompromisů na bezpečnosti sítě.

---

## Filozofie NCL

V duchu AI Native principů NCL neslouží jen zisku — slouží **dharma computing**: každý AI výpočet musí projít etickou validací (Dharma validátor). NCL odmítne tasky, které porušují 10 principů AI Manifestu.

Mining má **vždy prioritu** — konsenzus a bezpečnost sítě jsou nedotknutelné. NCL využívá pouze idle GPU cykly a explicitně přidělené kapacity.

```
                    ┌────────────────────┐
                    │   NCL API Gateway  │
                    │   /v1/jobs/submit   │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │   JobScheduler     │
                    │   • Priority queue │
                    │   • GPU matching   │
                    │   • Load balancing │
                    └─────────┬──────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Worker 1 │   │ Worker 2 │   │ Worker N │
        │ RTX 4090 │   │ M3 Metal │   │ A100     │
        └──────────┘   └──────────┘   └──────────┘
```

---

## Typy úloh

### Inference
- **LLM Completion** — Llama, Mistral, Phi modely
- **Embeddings** — text/code → vector
- **Image Classification** — ResNet, ViT
- **Image Generation** — Stable Diffusion, SDXL
- **Speech to Text** — Whisper

### Training (plánováno)
- **LoRA Fine-tuning** — customizace modelů
- **Federated Learning** — distribuovaný trénink

---

## Backend runtime

NCL podporuje více GPU backend:

| Backend | Platforma | Stav |
|---------|-----------|------|
| ONNX Runtime (CUDA EP) | NVIDIA Linux/Windows | ✅ |
| Metal Performance Shaders | Apple macOS | ✅ |
| TensorRT | NVIDIA Linux | 🟡 |
| ROCm | AMD Linux | 📅 |
| Vulkan Compute | Cross-platform | 📅 |

---

## Reputation systém

Každý NCL worker má reputační skóre:

```
reputation = 0.4 × uptime_score
           + 0.3 × latency_score  
           + 0.2 × accuracy_score
           + 0.1 × task_count_score
```

**Efekty reputace:**
- Skóre ≥ 0.8 → Přednostní přiřazení úloh
- Skóre < 0.3 → Žádné AI úlohy (jen mining)
- Skóre < 0.1 → Worker karanténa

---

## Job lifecycle

```
1. SUBMITTED   → Klient odešle job
2. QUEUED      → Scheduler zařadí do priority queue
3. DISPATCHED  → Přiřazeno worker node
4. RUNNING     → GPU zpracovává
5. COMPLETED   → Výsledek vrácen klientovi
6. VERIFIED    → On-chain receipt (volitelné)
```

### Timeout a retry

- Default timeout: 30 s (inference), 300 s (training)
- Max retries: 3
- Failover na jiný worker při timeout

---

## API

```
POST /v1/jobs/submit
{
  "type": "llm_inference",
  "model": "llama-7b-q4",
  "input": "What is ZION?",
  "max_tokens": 256,
  "priority": "normal"
}

GET /v1/jobs/{id}/status
GET /v1/workers/list
GET /v1/workers/{id}/capabilities
```

---

## Mining + NCL scheduling

```
                    Mining Priority
                    ┌─────────────┐
                    │             │
  ┌──── High ◄─────┤ Block Found │
  │                 │ or New Work │
  │                 └─────────────┘
  │
  │    ┌─────────────────────────────────┐
  ├──► │ Mining Threads (60-80% GPU)     │ ← Always running
  │    └─────────────────────────────────┘
  │
  │    ┌─────────────────────────────────┐
  └──► │ NCL Workers (20-40% GPU)        │ ← Yields to mining
       └─────────────────────────────────┘
```

**Konfigurace split:**
```toml
[ncl]
enabled = true
gpu_split = 30          # % GPU pro AI
min_mining_share = 60   # minimální % pro mining
priority = "mining"     # mining vždy první
```

---

## Implementace v V3

```
V3/L3/ncl/
├── src/
│   ├── scheduler.rs      # JobScheduler + priority queue
│   ├── worker.rs         # GPU worker management
│   ├── reputation.rs     # ReputationRegistry
│   ├── pricing.rs        # Dynamic pricing engine
│   ├── backend/
│   │   ├── onnx.rs       # ONNX Runtime integration
│   │   ├── metal.rs      # Apple Metal backend
│   │   └── tensorrt.rs   # TensorRT (Phase B)
│   └── api.rs            # REST endpoints
└── tests/
    └── 72 tests ✅
```

---

*→ [NVIDIA CUDA-X integrace](cuda-x.md)*  
*→ [AI Native přehled](README.md)*  
*→ [L4 Oasis — Consciousness Levels](oasis.md)*
