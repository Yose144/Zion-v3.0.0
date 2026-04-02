# CUDA-X → L3 AI Native — Implementační Plán

**Datum:** 25. března 2026  
**Autor:** AI Native Team  
**Základ:** `CudaX.md` (GPU compute + NeMo Agent Toolkit) → `L3/` (AI orchestration + NCL compute)  
**Cíl:** GPU-akcelerované AI agenty jako monetizovatelná služba ZION sítě

---

## 1. Executive Summary

CudaX.md definuje vizi GPU compute node, který:
- běží AI modely na NVIDIA GPU přes CUDA-X stack
- komunikuje s blockchainem (validace, důvěra, platby)
- využívá NeMo Agent Toolkit pro autonomní agenty

L3 AI Native vrstva už má:
- ✅ **Consciousness engine** — 6-level XP systém s gating
- ✅ **NCL (Neural Compute Layer)** — job scheduler, reputation, REST API, SQLite
- ✅ **BackendRunner trait** — pluggable inference backends (ONNX/WASM/TFLite stuby)
- ✅ **Orchestrator** — multi-agent dispatch s capability gating
- ✅ **WARP** — cross-chain bridge s XP rewards (50–275 XP)

**Chybí:**
- ❌ Reálný GPU backend (CUDA, TensorRT, Metal inference)
- ❌ ONNX Runtime integrace (existuje jen stub)  
- ❌ LLM inference pipeline (llama.cpp / vLLM / NeMo)
- ❌ Worker daemon (GPU node, který přijímá NCL joby)
- ❌ Proof-of-compute (verifikace GPU výsledků)
- ❌ Ekonomický model (pricing, fee burn, odměny)

---

## 2. Architektura — Kde CUDA-X přistane

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ZION L3 AI NATIVE                             │
│                                                                      │
│  ┌─────────────┐    ┌──────────────────────────────────────────────┐ │
│  │ ai-native/  │    │               ncl/                           │ │
│  │             │    │  ┌────────────────────────────────────────┐  │ │
│  │ Orchestrator│───▶│  │ JobScheduler (priority + reputation)  │  │ │
│  │ Conscious-  │    │  └──────────┬─────────────────────────────┘  │ │
│  │ ness Engine │    │             │                                 │ │
│  │ Memory      │    │  ┌──────────▼─────────────────────────────┐  │ │
│  │ MessageBus  │    │  │ BackendRunner (trait dispatch)         │  │ │
│  └─────────────┘    │  │                                        │  │ │
│                     │  │  ┌────────────┐  ┌───────────────────┐ │  │ │
│                     │  │  │ OnnxBackend│  │ CudaXBackend  NEW │ │  │ │
│                     │  │  │ (CPU/GPU)  │  │ (NVIDIA GPU)      │ │  │ │
│                     │  │  └────────────┘  └───────────────────┘ │  │ │
│                     │  │  ┌────────────┐  ┌───────────────────┐ │  │ │
│                     │  │  │ MetalBack- │  │ LlamaBackend  NEW │ │  │ │
│                     │  │  │ end  NEW   │  │ (llama.cpp)       │ │  │ │
│                     │  │  └────────────┘  └───────────────────┘ │  │ │
│                     │  │  ┌────────────┐  ┌───────────────────┐ │  │ │
│                     │  │  │WasmBackend │  │ NemoAgentBack  NEW│ │  │ │
│                     │  │  │ (sandbox)  │  │(NeMo Toolkit)     │ │  │ │
│                     │  │  └────────────┘  └───────────────────┘ │  │ │
│                     │  └────────────────────────────────────────┘  │ │
│                     │                                              │ │
│                     │  ┌───────────────────────────────────────┐   │ │
│                     │  │ GPU Worker Daemon            NEW      │   │ │
│                     │  │ - přijímá joby z JobScheduler         │   │ │
│                     │  │ - spouští inference na GPU            │   │ │
│                     │  │ - reportuje výsledky + metriky        │   │ │
│                     │  │ - proof-of-compute hash               │   │ │
│                     │  └───────────────────────────────────────┘   │ │
│                     └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Fáze implementace

### Fáze A — ONNX Runtime backend (základ)
**Priorita:** P0 — první reálný inference backend  
**Závislost:** `ort` crate (ONNX Runtime Rust bindings)  
**Rozsah:**

| Úkol | Soubor | Popis |
|------|--------|-------|
| A-01 | `L3/ncl/Cargo.toml` | Přidat `ort = { version = "2", optional = true }`, feature `gpu-onnx` |
| A-02 | `L3/ncl/src/backend.rs` | Implementovat `OnnxBackend::new()` s reálným ONNX session init |
| A-03 | `L3/ncl/src/backend.rs` | `run_inference()` — load model, run session, return output bytes |
| A-04 | `L3/ncl/src/backend.rs` | GPU execution provider: `CUDAExecutionProvider` / `CoreMLExecutionProvider` |
| A-05 | `L3/ncl/tests/` | Integration test s malým ONNX modelem (add.onnx) |

**Výstup:** `cargo test -p zion-ncl --features gpu-onnx` prochodí s reálnou inference.

---

### Fáze B — CUDA-X Backend (NVIDIA specifický)
**Priorita:** P1 — NVIDIA GPU akcelerace  
**Závislost:** `cudarc` crate nebo `ort` s CUDA EP  
**Rozsah:**

| Úkol | Soubor | Popis |
|------|--------|-------|
| B-01 | `L3/ncl/src/types.rs` | Přidat `ComputeBackend::CudaX` variantu |
| B-02 | `L3/ncl/src/backend.rs` | `CudaXBackend` struct — TensorRT inference pipeline |
| B-03 | `L3/ncl/src/backend.rs` | Device discovery (`cudarc::driver::CudaDevice::new(0)`) |
| B-04 | `L3/ncl/src/backend.rs` | Batched inference (multiple requests → single GPU dispatch) |
| B-05 | `L3/ncl/src/pricing.rs` | GPU-tier pricing: VRAM-based (8GB/24GB/80GB → tier 1/2/3) |

**Výstup:** NVIDIA GPU node může registrovat se jako NCL worker s `CudaX` backend.

---

### Fáze C — Metal Inference Backend (Apple Silicon)
**Priorita:** P1 — macOS/iOS native AI  
**Závislost:** ONNX Runtime `CoreMLExecutionProvider` nebo `metal` crate  
**Rozsah:**

| Úkol | Soubor | Popis |
|------|--------|-------|
| C-01 | `L3/ncl/src/types.rs` | Přidat `ComputeBackend::Metal` variantu |
| C-02 | `L3/ncl/src/backend.rs` | `MetalInferenceBackend` — CoreML/ANE dispatch |
| C-03 | `L3/ncl/src/backend.rs` | Auto-detect: Apple Silicon → Metal, NVIDIA → CUDA, else → CPU |
| C-04 | Desktop agent | NCL worker mode v desktop agentovi (mine + AI jobs) |

**Výstup:** MacBook s M1+ může sloužit jako AI compute node.

---

### Fáze D — LLM Inference Pipeline
**Priorita:** P1 — hlavní monetizační případ  
**Závislost:** `llama-cpp-rs` nebo HTTP bridge k `vLLM`/`ollama`  
**Rozsah:**

| Úkol | Soubor | Popis |
|------|--------|-------|
| D-01 | `L3/ncl/src/types.rs` | Přidat `NclJobType::LlmInference` payload varianty |
| D-02 | `L3/ncl/src/backend.rs` | `LlamaBackend` — llama.cpp bindings, GGUF model loading |
| D-03 | `L3/ncl/src/backend.rs` | Streaming token output (SSE/WebSocket) |
| D-04 | `L3/ncl/src/api.rs` | `/v1/chat/completions` endpoint (OpenAI-kompatibilní) |
| D-05 | `L3/ncl/src/pricing.rs` | Token-based pricing (input/output tokens × rate) |
| D-06 | `L3/ncl/src/scheduler.rs` | Model preload + warm cache management |

**Výstup:** ZION node =LLM API server, platby v ZION tokenech.

---

### Fáze E — GPU Worker Daemon
**Priorita:** P2 — infrastruktura pro DePIN  
**Rozsah:**

| Úkol | Soubor | Popis |
|------|--------|-------|
| E-01 | `L3/ncl/src/worker.rs` (NEW) | `GpuWorkerDaemon` — hlavní loop: poll jobs → execute → report |
| E-02 | `L3/ncl/src/worker.rs` | Auto-registration: detect GPU → register capabilities → heartbeat |
| E-03 | `L3/ncl/src/worker.rs` | Metrics export: GPU utilization, VRAM, temperature, throughput |
| E-04 | `L3/ncl/src/worker.rs` | Graceful shutdown + job recovery (přerušené joby → re-queue) |
| E-05 | `L3/ncl/src/main.rs` (NEW) | `zion-ncl-worker` binary, CLI pro standalone GPU node |

**Výstup:** `zion-ncl-worker --gpu auto --pool 91.98.122.165:9333` → autonomní GPU node.

---

### Fáze F — NeMo Agent Toolkit Integration
**Priorita:** P2 — autonomní AI agenti  
**Závislost:** NVIDIA NeMo via Python bridge nebo gRPC  
**Rozsah:**

| Úkol | Soubor | Popis |
|------|--------|-------|
| F-01 | `L3/ai-native/src/nemo_bridge.rs` (NEW) | Python⟷Rust bridge (PyO3 nebo subprocess) |
| F-02 | `L3/ai-native/src/nemo_bridge.rs` | NeMo agent spawn + tool registration |
| F-03 | `L3/ai-native/src/orchestrator.rs` | NeMo agent jako `AgentCapability::NemoAgent` |
| F-04 | `L3/ai-native/src/types.rs` | `AiTaskType::NemoAgent` varianta |
| F-05 | `L3/ncl/src/backend.rs` | `NemoAgentBackend` — NeMo inference via gRPC |
| F-06 | Config | NeMo Docker kontejner (`nvcr.io/nvidia/nemo:latest`) v compose |

**Výstup:** AI agent v ZION síti může autonomně:
- analyzovat blockchain data
- optimalizovat mining strategii
- reagovat na DeFi příležitosti
- spravovat cross-chain pozice přes WARP

---

### Fáze G — Proof-of-Compute
**Priorita:** P2 — důvěra v GPU výsledky  
**Rozsah:**

| Úkol | Soubor | Popis |
|------|--------|-------|
| G-01 | `L3/ncl/src/proof.rs` (NEW) | `ComputeProof` struct (job_id, output_hash, gpu_attestation) |
| G-02 | `L3/ncl/src/proof.rs` | Deterministic replay (ONNX s fixed seed → reproducible output) |
| G-03 | `L3/ncl/src/proof.rs` | Redundant execution (2/3 nodes musí souhlasit) |
| G-04 | `L3/ncl/src/reputation.rs` | Penalizace za nesouhlasný výsledek |
| G-05 | `L3/ncl/src/api.rs` | `/proof/:job_id` → verifikační endpoint |

**Výstup:** Klient ví, že GPU výsledek je správný, bez důvěry konkrétnímu workeru.

---

## 4. Ekonomický model

### Revenue sources (GPU node operator)

```
┌─────────────────────────────────────────────────────────────────┐
│                     ZION GPU Node Revenue                        │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Mining rewards   │  │ AI inference fees │  │ WARP bridge    │ │
│  │ (L1 PoW)        │  │ (NCL jobs)        │  │ relay fees     │ │
│  │ ~5400 ZION/blk  │  │ per-token/request │  │ 0.1–0.5%      │ │
│  └────────┬────────┘  └────────┬──────────┘  └───────┬────────┘ │
│           │                    │                      │          │
│           ▼                    ▼                      ▼          │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │              GPU Worker Wallet                               ││
│  │              (auto-compound or payout)                       ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Pricing tiers

| Tier | GPU | VRAM | Rate (ZION/request) | Rate (ZION/1K tokens) |
|------|-----|------|--------------------|-----------------------|
| T1 – Entry | RTX 3060 | 8 GB | 0.5 | 2.0 |
| T2 – Pro | RTX 3090/4090 | 24 GB | 0.3 | 1.0 |
| T3 – Enterprise | A100/H100 | 80 GB | 0.1 | 0.5 |
| Metal – Apple | M1–M4 | 16–192 GB | 0.4 | 1.5 |

### Fee distribution

```
Total fee = 100%
  ├── 75% → GPU worker (operator)
  ├── 15% → NCL protocol (fee burn → deflationary)
  └── 10% → Reputation staking reward pool
```

---

## 5. Consciousness integration

GPU compute capability se váže na consciousness level:

| Level | Name | Min XP | GPU Capabilities |
|-------|------|--------|-----------------|
| 0 | Dormant | 0 | ❌ No AI access |
| 1 | Aware | 100 | Embeddings only |
| 2 | Sentient | 1,000 | LLM inference, image gen |
| 3 | Transcendent | 10,000 | Model training, batched jobs |
| 4 | Omniscient | 100,000 | NeMo agents, autonomous trading |
| 5 | Cosmic | 1,000,000 | Full orchestration, cross-chain AI |

**XP nové zdroje z GPU:**

| Akce | XP |
|------|----|
| GPU job completed | +15 XP |
| GPU proof verified | +5 XP |
| GPU benchmark top 10% | +25 XP |
| GPU job failed/timeout | −5 XP |
| NeMo agent task success | +30 XP |

---

## 6. Desktop Agent integrace

Desktop agent (`APP&WEB/desktop-agent`) bude mít **dual mode:**

```
┌───────────────────────────────────────────┐
│          ZION Desktop Agent               │
│                                           │
│  [Toggle: Mining | AI Compute | Both]     │
│                                           │
│  Mining tab:                              │
│    GPU hashrate, shares, revenue          │
│                                           │
│  AI Compute tab:                          │
│    Jobs completed, tokens served          │
│    Revenue earned, reputation score       │
│    GPU utilization %                      │
│                                           │
│  Combined mode:                           │
│    Mining 75% GPU + AI 25% GPU            │
│    (or user-configurable split)           │
└───────────────────────────────────────────┘
```

### Env vars (nové)

```bash
ZION_NCL_ENABLED=true              # zapne AI compute worker
ZION_NCL_POOL=91.98.122.165:9333   # NCL scheduler endpoint
ZION_NCL_GPU_SPLIT=25              # % GPU pro AI (zbytek mining)
ZION_NCL_MODELS_DIR=~/zion-models  # cache pro ONNX/GGUF modely
ZION_NCL_MAX_VRAM_MB=4096          # VRAM limit pro AI
```

---

## 7. Stack & dependencies

### Rust crates (nové)

```toml
# L3/ncl/Cargo.toml — nové optional deps
ort = { version = "2", optional = true }           # ONNX Runtime
llama-cpp-rs = { version = "0.3", optional = true } # llama.cpp
cudarc = { version = "0.12", optional = true }      # CUDA device API
pyo3 = { version = "0.22", optional = true }         # NeMo Python bridge

[features]
gpu-onnx   = ["dep:ort"]
gpu-cuda   = ["dep:cudarc"]
gpu-llama  = ["dep:llama-cpp-rs"]
nemo-agent = ["dep:pyo3"]
```

### Docker stack (nové kontejnery)

```yaml
# docker/docker-compose.gpu-ai.yml
services:
  ncl-worker:
    image: zion-ncl-worker:latest
    runtime: nvidia  # NVIDIA Container Runtime
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - ZION_NCL_POOL=pool:9333
      - ZION_BACKEND=auto
    volumes:
      - models:/data/models

  nemo-agent:
    image: nvcr.io/nvidia/nemo:latest
    runtime: nvidia
    ports:
      - "8000:8000"  # NeMo API
    volumes:
      - models:/data/models
```

---

## 8. Timeline

```
                    2026
    Mar         Apr         May         Jun         Jul
    |           |           |           |           |
    ├── A ──────┤                                      Fáze A: ONNX backend
                ├── B ──────┤                          Fáze B: CUDA-X backend
                ├── C ──────┤                          Fáze C: Metal inference
                            ├── D ──────┤              Fáze D: LLM pipeline
                            ├── E ──────┤              Fáze E: Worker daemon
                                        ├── F ──────┤  Fáze F: NeMo agents
                                        ├── G ──────┤  Fáze G: Proof-of-compute
```

**Milestones:**

| Milestone | Target | Gate |
|-----------|--------|------|
| M1 — First real inference | Apr 2026 | ONNX model runs on NCL worker |
| M2 — GPU marketplace live | May 2026 | Workers earn ZION for compute jobs |
| M3 — LLM API public | Jun 2026 | OpenAI-compatible endpoint on ZION |
| M4 — Autonomous agents | Jul 2026 | NeMo agent completes chain task |

---

## 9. Rizika

| Riziko | Dopad | Mitigace |
|--------|-------|----------|
| NVIDIA vendor lock-in | Pouze NVIDIA GPU | Metal + ONNX CPU fallback |
| GPU paměťový limit | Velké modely se nevejdou | Model quantization (GGUF Q4) |
| Latence inference | Pomalé odpovědi | Batching + TensorRT optimalizace |
| Fake compute výsledky | Špatná data v síti | Proof-of-compute (Fáze G) |
| NeMo licence | Omezení komerčního použití | Ověřit NVIDIA EULA pro DePIN |
| Elektřina vs. revenue | GPU provoz je drahý | Tier pricing + auto-shutdown při nízké poptávce |

---

## 10. Immediate next steps (po schválení)

1. **Přidat `ComputeBackend::CudaX` a `ComputeBackend::Metal`** do `L3/ncl/src/types.rs`
2. **Implementovat `OnnxBackend` s reálným `ort` crate** v `L3/ncl/src/backend.rs`
3. **Přidat `gpu-onnx` feature** do `L3/ncl/Cargo.toml`
4. **Napsat integration test** s malým ONNX modelem
5. **Přidat GPU metriky** do NCL scheduler (VRAM available, utilization)
6. **Dokumentovat API** pro registraci GPU workerů

---

## Reference

- [CudaX.md](CudaX.md) — původní nápad a CUDA-X ekosystém
- [docs/L1-L4_ROADMAP.md](docs/L1-L4_ROADMAP.md) — master layer plan
- [L3/ncl/src/backend.rs](L3/ncl/src/backend.rs) — stávající BackendRunner trait
- [L3/ncl/src/types.rs](L3/ncl/src/types.rs) — ComputeBackend enum
- [L3/ai-native/src/orchestrator.rs](L3/ai-native/src/orchestrator.rs) — multi-agent dispatch
- [L3/ai-native/src/consciousness.rs](L3/ai-native/src/consciousness.rs) — XP/level gating
- [NVIDIA NeMo Agent Toolkit](https://developer.nvidia.com/nemo-agent-toolkit)
- [ONNX Runtime Rust](https://github.com/pykeio/ort)
