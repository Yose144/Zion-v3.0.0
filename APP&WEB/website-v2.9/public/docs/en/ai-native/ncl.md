# NCL — Neural Compute Layer

> *“A miner is not just a hashing machine — it is a node of consciousness serving the network and the world.”*

NCL is L3 infrastructure that turns ZION miners from single-purpose PoW rigs into **dual-purpose GPU compute nodes**. Miners earn from mining and from AI work — without compromising network safety.

---

## NCL philosophy

In the spirit of AI Native principles, NCL does not serve profit alone — it serves **dharma computing**: every AI job must pass ethical validation (Dharma validator). NCL rejects tasks that violate the 10 principles of the AI Manifest.

Mining **always has priority** — consensus and network security are **non-negotiable**. NCL uses only idle GPU cycles and explicitly allocated capacity.

```
                    ┌────────────────────┐
                    │   NCL API gateway  │
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

## Work types

### Inference
- **LLM completion** — Llama, Mistral, Phi models  
- **Embeddings** — text/code → vector  
- **Image classification** — ResNet, ViT  
- **Image generation** — Stable Diffusion, SDXL  
- **Speech to text** — Whisper  

### Training (planned)
- **LoRA fine-tuning** — model customization  
- **Federated learning** — distributed training  

---

## Backend runtimes

NCL supports multiple GPU backends:

| Backend | Platform | Status |
|---------|----------|--------|
| ONNX Runtime (CUDA EP) | NVIDIA Linux/Windows | ✅ |
| Metal Performance Shaders | Apple macOS | ✅ |
| TensorRT | NVIDIA Linux | 🟡 |
| ROCm | AMD Linux | 📅 |
| Vulkan compute | Cross-platform | 📅 |

---

## Reputation system

Every NCL worker has a reputation score:

```
reputation = 0.4 × uptime_score
           + 0.3 × latency_score  
           + 0.2 × accuracy_score
           + 0.1 × task_count_score
```

**Reputation effects:**
- Score ≥ 0.8 → preferential job assignment  
- Score &lt; 0.3 → no AI jobs (mining only)  
- Score &lt; 0.1 → worker quarantine  

---

## Job lifecycle

```
1. SUBMITTED   → Client submits job
2. QUEUED      → Scheduler enqueues by priority
3. DISPATCHED  → Assigned to worker node
4. RUNNING     → GPU processes workload
5. COMPLETED   → Result returned to client
6. VERIFIED    → On-chain receipt (optional)
```

### Timeouts and retries

- Default timeout: 30 s (inference), 300 s (training)  
- Max retries: 3  
- Failover to another worker on timeout  

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
                    Mining priority
                    ┌─────────────┐
                    │             │
  ┌──── High ◄─────┤ Block found │
  │                 │ or new work │
  │                 └─────────────┘
  │
  │    ┌─────────────────────────────────┐
  ├──► │ Mining threads (60-80% GPU)     │ ← Always running
  │    └─────────────────────────────────┘
  │
  │    ┌─────────────────────────────────┐
  └──► │ NCL workers (20-40% GPU)      │ ← Yields to mining
       └─────────────────────────────────┘
```

**Split configuration:**
```toml
[ncl]
enabled = true
gpu_split = 30          # % GPU for AI
min_mining_share = 60   # minimum % for mining
priority = "mining"     # mining always first
```

---

## V3 implementation

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

*→ [NVIDIA CUDA-X integration](cuda-x.md)*  
*→ [AI Native overview](README.md)*  
*→ [L4 Oasis — Consciousness Levels](oasis.md)*
