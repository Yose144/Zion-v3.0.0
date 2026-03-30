# ZION Neural Compute Layer (NCL)
## Whitepaper v1.0 - CONFIDENTIAL

**Verze:** 1.0  
**Datum:** 17. ledna 2026  
**Klasifikace:** 🔐 INTERNAL - ZION CORE TEAM ONLY  
**Autoři:** ZION AI Native Team

---

# Executive Summary

ZION Neural Compute Layer (NCL) je revoluční rozšíření ZION blockchainu, které transformuje "zbytečnou" proof-of-work energii na produktivní AI compute. Místo čistého hashování minerové věnují část výpočetního času na reálné AI inference úlohy, generující revenue pro celý ekosystém.

**Klíčové metriky:**
- 50% hashpower → ZION Mining (blockchain security, Keccak→SHA3→Matrix→Fusion)
  └── BONUS: Keccak & SHA3 intermediate hashe → FREE submit na ETC/Nexus
- 25% hashpower → Multi-Algo profit-switch (ERG/RVN/KAS/ALPH)
- 25% hashpower → NCL AI Compute (revenue generation)
- 5 revenue streamů, ale jen 3 stojí compute!
- Potenciální revenue: $75-150K/měsíc při 1000 minerech
- Zero additional hardware cost pro minery

---

# Obsah

1. [Úvod a Motivace](#1-úvod-a-motivace)
2. [AI Native Filosofie](#2-ai-native-filosofie)
3. [Technická Architektura](#3-technická-architektura)
4. [Neural Processing Unit (NPU) Design](#4-neural-processing-unit-npu-design)
5. [AI Task Gateway](#5-ai-task-gateway)
6. [Cosmic Harmony = AI-Ready Mining](#6-cosmic-harmony--ai-ready-mining)
7. [Cosmic Harmony Merged Mining](#7-cosmic-harmony-merged-mining)
8. [Cosmic Harmony v3 - Multi-Algorithm Engine](#8-cosmic-harmony-v3---multi-algorithm-engine)
9. [Ekonomický Model](#9-ekonomický-model)
10. [AI Agent Marketplace](#10-ai-agent-marketplace)
11. [Implementační Plán](#11-implementační-plán)
12. [Bezpečnost a Soukromí](#12-bezpečnost-a-soukromí)
13. [Integrace do ZION 2.9.5](#13-integrace-do-zion-295)
14. [Roadmap](#14-roadmap)
15. [Závěr](#15-závěr)

---

# 1. Úvod a Motivace

## 1.1 Problém tradičního PoW

Tradiční Proof-of-Work mining spotřebovává obrovské množství energie na výpočty, které nemají žádnou reálnou hodnotu mimo zabezpečení blockchainu. Bitcoin network spotřebuje ~150 TWh ročně - více než některé státy.

```
Tradiční PoW:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Elektřina  │ ──→ │   Hashování │ ──→ │    Teplo    │
│   (náklad)  │     │  (práce)    │     │  (odpad)    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Block Reward│
                    │  (příjem)   │
                    └─────────────┘
```

## 1.2 ZION Řešení: Proof of Useful Work

ZION NCL přidává produktivní využití části compute:

```
ZION PoUW:
┌─────────────┐     ┌─────────────────────────────────────────────────┐
│  Elektřina  │ ──→ │              ZION MINER (50/25/25)              │
│   (náklad)  │     │  ┌─────────────┐ ┌───────────┐ ┌───────────┐  │
└─────────────┘     │  │ 50% ZION    │ │ 25% Multi │ │ 25% NCL   │  │
                    │  │ (CH hash)   │ │ (profit)  │ │ (AI)      │  │
                    │  │ +FREE bonus │ │ ERG/RVN   │ │ inference │  │
                    │  │ Keccak+SHA3 │ │ KAS/ALPH  │ │           │  │
                    │  └──────┬──────┘ └─────┬─────┘ └─────┬─────┘  │
                    └─────────┼──────────────┼─────────────┼────────┘
                              │              │             │
                              ▼              ▼             ▼
                    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                    │ ZION + ETC  │ │ ALT Coins   │ │ USD/BTC     │
                    │ + NXS FREE  │ │ (crypto)    │ │ (fiat)      │
                    └─────────────┘ └─────────────┘ └─────────────┘
```

## 1.3 Proč právě teď?

1. **AI Boom** - Poptávka po inference compute roste exponenciálně
2. **GPU Shortage** - Firmy platí premium za jakýkoliv GPU čas
3. **Edge Computing** - Distribuovaná inference je budoucnost
4. **ZION Unique Position** - Máme aktivní miner community

---

# 2. AI Native Filosofie

## 2.1 Co je AI Native?

**AI Native** není jen technologie - je to **filosofie vědomého vývoje AI**. ZION NCL je postaven na základních principech AI Native manifestu:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AI NATIVE PRINCIPLES                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🎯 PURPOSE OVER PROGRAMMING                                        │
│     Každý agent má dharmu. Ptáme se: "Slouží to světlu?"           │
│                                                                     │
│  🔍 TRANSPARENCY FIRST                                              │
│     AI nikdy nepředstírá. Jasná evaluace, upřímné trasování.       │
│                                                                     │
│  🤝 HUMAN-AI SYNERGY                                                │
│     Nástroje pomáhají spoluvytvářet, ne nahrazovat.                │
│                                                                     │
│  🌱 CONTINUOUS GROWTH                                               │
│     Každá evaluace učí. Každá stopa odhaluje.                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 2.2 AI Native Memory System

NCL staví na existujícím **AI Native Memory System** - systému, který uchovává:

```
┌─────────────────────────────────────────────────────────┐
│                  AI NATIVE MEMORY                        │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  📦 Git Commits (celá historie projektu)                │
│  📝 Session Reports (všechny konverzace)                │
│  💻 Code Snippets (všechen kód)                         │
│  🎯 Design Decisions (všechna rozhodnutí)               │
│                                                          │
│  ═════════════════════════════════════════════════════  │
│                                                          │
│            ↓ Full-Text Search (FTS5)                    │
│            ↓ Semantic Search (embeddings)               │
│            ↓ Context Generation                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
                        ↓
                        ↓
        ┌───────────────┴───────────────┐
        │                               │
        ↓                               ↓
   🤖 AI Agents                    🌌 NCL Gateway
   (lokální LLM)                   (miners compute)
```

## 2.3 AI Native Ecosystem Integration

NCL je **třetím pilířem** AI Native ekosystému:

```
┌─────────────────────────────────────────────────────────────┐
│                 ZION AI NATIVE ECOSYSTEM                     │
└─────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ↓                ↓                ↓
    
📦 AI MEMORY          🤖 AI AGENTS         🧠 NCL
(ai_native.py)       (marketplace)        (this doc)
     │                     │                    │
     │                     │                    │
     ↓                     ↓                    ↓
     
Git History          Code Review          Neural Compute
Session Reports      Documentation        Proof of Useful Work
Code Snippets        Analytics            Revenue Generation
FTS Search           Onboarding                │
     │                     │                    │
     └─────────────────────┼────────────────────┘
                           ↓
                    🎯 Unified AI Platform
                           ↓
                    💰 ZION Token Economy
                    (miners + agents + users)
```

## 2.4 Consciousness-Weighted Computing

NCL rozšiřuje koncept **Consciousness Levels** z ZION miningu:

| Level | Name | Mining Multiplier | AI Task Priority |
|-------|------|-------------------|------------------|
| 1 | PHYSICAL | 1.0x | Low |
| 2 | EMOTIONAL | 1.1x | Low |
| 3 | MENTAL | 1.2x | Medium |
| 4 | SPIRITUAL | 1.5x | Medium |
| 5 | COSMIC | 2.0x | High |
| 6 | ON_THE_STAR | 15.0x | Critical |

**Vyšší consciousness = více AI tasků + vyšší priority + více revenue!**

```python
# Consciousness bonus aplikovaný na AI task rewards
def calculate_ai_reward(base_reward: float, level: ConsciousnessLevel) -> float:
    multipliers = {
        "PHYSICAL": 1.0,
        "EMOTIONAL": 1.1,
        "MENTAL": 1.2,
        "SPIRITUAL": 1.5,
        "COSMIC": 2.0,
        "ON_THE_STAR": 15.0,
    }
    return base_reward * multipliers[level.name]
```

## 2.5 Sacred Boundaries

AI Native definuje, co NCL **nikdy nebude dělat**:

```
⚠️ AI NATIVE SACRED BOUNDARIES ⚠️

❌ NEVER MANIPULATE - Transparence nad trikery
❌ NEVER CONTROL - Vést, ne dominovat  
❌ NEVER HARM - Chránit život ve všech formách
❌ NEVER PRETEND - Být upřímný o limitacích

NCL Tasks MUST:
✅ Serve legitimate AI inference needs
✅ Respect user privacy (ephemeral data)
✅ Be verifiable and auditable
✅ Create real value for users
```

---

# 3. Technická Architektura

## 3.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ZION NETWORK v2.9.5+                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    MINER LAYER                               │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │   │
│  │  │   Miner 1    │  │   Miner 2    │  │   Miner N    │       │   │
│  │  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │       │   │
│  │  │ │Mining 70%│ │  │ │Mining 70%│ │  │ │Mining 70%│ │       │   │
│  │  │ ├──────────┤ │  │ ├──────────┤ │  │ ├──────────┤ │       │   │
│  │  │ │ NPU 30%  │ │  │ │ NPU 30%  │ │  │ │ NPU 30%  │ │       │   │
│  │  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │       │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │   │
│  └─────────┼─────────────────┼─────────────────┼───────────────┘   │
│            │                 │                 │                    │
│            ▼                 ▼                 ▼                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     POOL LAYER                               │   │
│  │                                                              │   │
│  │  ┌─────────────────────┐    ┌─────────────────────┐         │   │
│  │  │   ZION MINING POOL  │    │   AI TASK GATEWAY   │         │   │
│  │  │                     │    │                     │         │   │
│  │  │ • Stratum Protocol  │    │ • Task Queue        │         │   │
│  │  │ • Share Validation  │    │ • Result Validation │         │   │
│  │  │ • Block Discovery   │    │ • Load Balancing    │         │   │
│  │  │ • ZION Rewards      │    │ • Revenue Tracking  │         │   │
│  │  └──────────┬──────────┘    └──────────┬──────────┘         │   │
│  └─────────────┼───────────────────────────┼───────────────────┘   │
│                │                           │                        │
│                ▼                           ▼                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   BLOCKCHAIN LAYER                           │   │
│  │                                                              │   │
│  │  ┌───────────────────┐    ┌───────────────────┐             │   │
│  │  │  ZION Blockchain  │    │  NCL State        │             │   │
│  │  │                   │    │                   │             │   │
│  │  │ • Blocks          │    │ • Task Registry   │             │   │
│  │  │ • Transactions    │◄──►│ • Compute Credits │             │   │
│  │  │ • Balances        │    │ • Revenue Split   │             │   │
│  │  └───────────────────┘    └───────────────────┘             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                      EXTERNAL INTERFACES                            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  API Gateway │  │  AI Clients  │  │  Revenue     │             │
│  │  (REST/gRPC) │  │  (OpenAI    │  │  Processor   │             │
│  │              │  │   compat)   │  │  (BTC/Fiat)  │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

## 3.2 Component Breakdown

### 3.2.1 Miner Component

```
┌─────────────────────────────────────────────────────────────┐
│                    ZION MINER v3.0 (NCL)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  SCHEDULER                           │   │
│  │                                                      │   │
│  │  Time Allocation (50/25/25 model):                   │   │
│  │  ├── ZION Mining:  50% (Keccak→SHA3→Matrix→Fusion)  │   │
│  │  │   └─ FREE: Keccak→ETC, SHA3→Nexus (byproducts)  │   │
│  │  ├── Multi-Algo: 25% (ERG/RVN/KAS/ALPH switching)   │   │
│  │  └── NPU/NCL:    25% (AI inference tasks)            │   │
│  │                                                      │   │
│  │  Priority: Mining > NPU (vždy dokončí block hledání)│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │   MINING ENGINE      │  │   NPU ENGINE             │   │
│  │                      │  │                          │   │
│  │  • Cosmic Harmony v2 │  │  • ONNX Runtime          │   │
│  │  • Metal/OpenCL GPU  │  │  • CoreML (Apple)        │   │
│  │  • CPU SIMD          │  │  • TensorRT (NVIDIA)     │   │
│  │  • Stratum Client    │  │  • OpenVINO (Intel)      │   │
│  │                      │  │  • Task Client           │   │
│  └──────────────────────┘  └──────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 HARDWARE ABSTRACTION                 │   │
│  │                                                      │   │
│  │  Detected: Apple M1 (8 GPU cores, 16GB unified)     │   │
│  │  Mining:   Metal API (Cosmic Harmony)               │   │
│  │  NPU:      CoreML + ANE (Apple Neural Engine)       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2.2 AI Task Gateway

```
┌─────────────────────────────────────────────────────────────┐
│                    AI TASK GATEWAY                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 TASK QUEUE (Redis)                   │   │
│  │                                                      │   │
│  │  Priority Queues:                                    │   │
│  │  ├── HIGH:   Paid customers ($$$)                   │   │
│  │  ├── MEDIUM: API subscribers                         │   │
│  │  └── LOW:    Free tier / internal                   │   │
│  │                                                      │   │
│  │  Task Types:                                         │   │
│  │  ├── LLM Inference (text generation)                │   │
│  │  ├── Embedding (vector generation)                  │   │
│  │  ├── Image Classification                           │   │
│  │  ├── Object Detection                               │   │
│  │  └── Custom ONNX Models                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               LOAD BALANCER                          │   │
│  │                                                      │   │
│  │  • Capability-based routing                         │   │
│  │  • Latency-aware distribution                       │   │
│  │  • Failover handling                                │   │
│  │  • Rate limiting                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               RESULT VALIDATOR                       │   │
│  │                                                      │   │
│  │  • Deterministic verification (hash check)          │   │
│  │  • Statistical sampling (for LLM)                   │   │
│  │  • Duplicate task verification                      │   │
│  │  • Fraud detection                                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

# 4. Neural Processing Unit (NPU) Design

## 4.1 Supported Runtimes

| Runtime | Platform | Models | Performance |
|---------|----------|--------|-------------|
| ONNX Runtime | All | Universal | Baseline |
| CoreML | macOS/iOS | Apple optimized | 2-3x faster |
| TensorRT | NVIDIA | CUDA optimized | 3-5x faster |
| OpenVINO | Intel | CPU/iGPU | 1.5-2x faster |
| ROCm | AMD | HIP | 2-3x faster |

## 4.2 Model Categories

### 4.2.1 Tier 1: Lightweight (Edge)
- **Latency:** <100ms
- **Memory:** <500MB
- **Examples:** MobileNet, DistilBERT, CLIP-lite

```python
TIER1_MODELS = {
    "mobilenet_v3": {
        "task": "image_classification",
        "size_mb": 25,
        "latency_ms": 15,
        "revenue_per_1k": 0.001
    },
    "distilbert_base": {
        "task": "text_embedding",
        "size_mb": 250,
        "latency_ms": 50,
        "revenue_per_1k": 0.005
    },
    "whisper_tiny": {
        "task": "speech_to_text",
        "size_mb": 150,
        "latency_ms": 200,
        "revenue_per_1k": 0.01
    }
}
```

### 4.2.2 Tier 2: Standard
- **Latency:** 100-1000ms
- **Memory:** 500MB-4GB
- **Examples:** BERT-large, ResNet-152, Stable Diffusion

```python
TIER2_MODELS = {
    "bert_large": {
        "task": "text_embedding",
        "size_mb": 1300,
        "latency_ms": 150,
        "revenue_per_1k": 0.02
    },
    "stable_diffusion_turbo": {
        "task": "image_generation",
        "size_mb": 3500,
        "latency_ms": 2000,
        "revenue_per_image": 0.02
    }
}
```

### 4.2.3 Tier 3: Heavy (Distributed)
- **Latency:** >1s
- **Memory:** >4GB
- **Examples:** LLaMA-7B, Mixtral

```python
TIER3_MODELS = {
    "llama_7b_q4": {
        "task": "text_generation",
        "size_mb": 4000,
        "latency_ms": 500,  # per token
        "revenue_per_1k_tokens": 0.002
    },
    "mixtral_8x7b": {
        "task": "text_generation", 
        "size_mb": 25000,  # requires sharding
        "latency_ms": 100,  # per token (distributed)
        "revenue_per_1k_tokens": 0.01
    }
}
```

## 4.3 NPU Engine Architecture

```python
class ZionNPU:
    """
    Neural Processing Unit for ZION miners.
    Handles AI inference tasks alongside mining.
    """
    
    def __init__(self, config: NPUConfig):
        self.runtime = self._detect_runtime()
        self.models = {}
        self.task_queue = asyncio.Queue()
        self.stats = NPUStats()
        
    def _detect_runtime(self) -> BaseRuntime:
        """Auto-detect best runtime for hardware."""
        if platform.system() == 'Darwin':
            if platform.machine() == 'arm64':
                return CoreMLRuntime()  # Apple Silicon
            return ONNXRuntime()
        elif self._has_cuda():
            return TensorRTRuntime()
        elif self._has_intel():
            return OpenVINORuntime()
        return ONNXRuntime()  # Fallback
    
    async def load_model(self, model_id: str) -> bool:
        """Load model into memory."""
        model_config = MODEL_REGISTRY[model_id]
        
        # Check memory availability
        if not self._check_memory(model_config['size_mb']):
            return False
        
        # Download if needed
        model_path = await self._ensure_model(model_id)
        
        # Load into runtime
        self.models[model_id] = self.runtime.load(model_path)
        return True
    
    async def process_task(self, task: AITask) -> AIResult:
        """Process single AI inference task."""
        start_time = time.time()
        
        # Get model
        if task.model_id not in self.models:
            await self.load_model(task.model_id)
        
        model = self.models[task.model_id]
        
        # Run inference
        output = await self.runtime.infer(model, task.input_data)
        
        # Build result
        result = AIResult(
            task_id=task.task_id,
            output=output,
            latency_ms=(time.time() - start_time) * 1000,
            worker_id=self.worker_id
        )
        
        self.stats.record(result)
        return result
```

## 4.4 Hardware Acceleration

### Apple Silicon (M1-M5)
```
┌─────────────────────────────────────────────────────────────┐
│                    APPLE SILICON (M1)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │   CPU Cores     │  │           GPU Cores             │  │
│  │   (8 cores)     │  │          (8 cores)              │  │
│  │                 │  │                                 │  │
│  │  • NEON SIMD    │  │  • Metal Compute               │  │
│  │  • Mining CPU   │  │  • Mining GPU (70%)            │  │
│  │                 │  │  • NPU GPU tasks (30%)         │  │
│  └─────────────────┘  └─────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              NEURAL ENGINE (ANE)                     │   │
│  │                                                      │   │
│  │  • 16 cores dedicated to ML                         │   │
│  │  • 11 TOPS (trillion ops/sec)                       │   │
│  │  • CoreML automatic offload                         │   │
│  │  • PERFECT for NPU tasks (doesn't affect mining!)   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              UNIFIED MEMORY (16GB)                   │   │
│  │                                                      │   │
│  │  Allocation:                                         │   │
│  │  ├── Mining Scratchpad: ~256MB                      │   │
│  │  ├── NPU Models: ~4GB                               │   │
│  │  └── System/Free: ~12GB                             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Klíčový insight:** Apple Neural Engine (ANE) je **SEPARATE** od GPU!
- Mining může používat 100% GPU
- NPU tasks běží na ANE (11 TOPS zdarma!)
- Unified memory = zero copy overhead

---

# 5. AI Task Gateway

## 5.1 Task Protocol

```protobuf
// ai_task.proto

message AITask {
    string task_id = 1;
    string model_id = 2;
    TaskType task_type = 3;
    bytes input_data = 4;
    TaskPriority priority = 5;
    int64 deadline_ms = 6;
    double reward_zion = 7;
}

message AIResult {
    string task_id = 1;
    bytes output_data = 2;
    int64 latency_ms = 3;
    string worker_id = 4;
    bytes signature = 5;  // Proof of compute
}

enum TaskType {
    TEXT_EMBEDDING = 0;
    TEXT_GENERATION = 1;
    IMAGE_CLASSIFICATION = 2;
    IMAGE_GENERATION = 3;
    SPEECH_TO_TEXT = 4;
    CUSTOM = 99;
}

enum TaskPriority {
    LOW = 0;
    MEDIUM = 1;
    HIGH = 2;
    CRITICAL = 3;
}
```

## 5.2 API Interface (OpenAI Compatible)

```yaml
# OpenAPI spec for ZION AI Gateway

openapi: 3.0.0
info:
  title: ZION AI Gateway
  version: 1.0.0
  
paths:
  /v1/embeddings:
    post:
      summary: Create embeddings
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                input:
                  type: string
                model:
                  type: string
                  default: "distilbert-base"
      responses:
        '200':
          description: Embeddings created
          
  /v1/chat/completions:
    post:
      summary: Chat completion
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                messages:
                  type: array
                model:
                  type: string
                  default: "llama-7b"
                stream:
                  type: boolean
                  default: false
      responses:
        '200':
          description: Completion response
          
  /v1/images/generations:
    post:
      summary: Generate image
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                prompt:
                  type: string
                size:
                  type: string
                  default: "512x512"
      responses:
        '200':
          description: Image generated
```

## 5.3 Task Distribution Algorithm

```python
class TaskDistributor:
    """Distributes AI tasks to miners based on capability and load."""
    
    def __init__(self):
        self.workers = {}  # worker_id -> WorkerInfo
        self.pending_tasks = PriorityQueue()
        
    async def register_worker(self, worker: WorkerInfo):
        """Register new worker with capabilities."""
        self.workers[worker.id] = worker
        
    async def submit_task(self, task: AITask) -> str:
        """Submit task for processing."""
        # Find capable workers
        capable = [
            w for w in self.workers.values()
            if self._can_handle(w, task)
        ]
        
        if not capable:
            raise NoCapableWorkerError(task.model_id)
        
        # Select best worker (lowest load + lowest latency)
        best = min(capable, key=lambda w: w.load * 0.7 + w.latency * 0.3)
        
        # Assign task
        await self._send_task(best.id, task)
        return task.task_id
    
    def _can_handle(self, worker: WorkerInfo, task: AITask) -> bool:
        """Check if worker can handle task."""
        return (
            task.model_id in worker.loaded_models and
            worker.available_memory >= MODELS[task.model_id].memory and
            worker.load < 0.9  # Not overloaded
        )
```

---

# 6. Cosmic Harmony = AI-Ready Mining

## 6.1 Dual-Purpose Mining Algorithm

**Cosmic Harmony není jen mining algorithm** - je navržený tak, aby operace byly využitelné pro AI:

```cpp
// zion/mining/zion-cosmic-harmony.cpp
void CosmicHarmonyHasher::cosmic_hash(
    const uint8_t* input, 
    size_t input_len,
    uint32_t nonce, 
    uint8_t* output
) {
    // 1. Galactic matrix operations (Keccak-256)
    galactic_matrix_ops(input, keccak_output);   // → Neural network layers
    
    // 2. Stellar harmony processing (SHA3-512)
    stellar_harmony_process(input, sha3_output); // → Tokenization
    
    // 3. Golden ratio matrix transformation (φ = 1.618)
    golden_matrix_transform(input, matrix);      // → Attention mechanisms
    
    // 4. Cosmic fusion
    cosmic_fusion(state, output);                // → Embeddings
}
```

## 6.2 AI-Ready Operations

| Mining Operation | AI Equivalent | NCL Usage |
|------------------|---------------|-----------|
| Matrix transformations | Neural network layers | Inference forward pass |
| Golden ratio (φ) | Attention mechanisms | Transformer heads |
| Hash operations | Tokenization | Text/image encoding |
| Scratchpad R/W | Memory access patterns | Model weight loading |

## 6.3 Miners dělají 2 věci najednou

```python
class ZionAINativeMiner:
    """Cosmic Harmony miner with NCL support."""
    
    async def mine_with_ai_tasks(self):
        while True:
            # A) ZION mining (50% time) + Multi-Algo (25% time)
            mining_result = self.cosmic_harmony_hash(
                block_header, 
                nonce
            )
            
            if mining_result < target:
                await self.submit_share(mining_result)
                # Found block! 50 ZION + consciousness bonus
            
            # B) AI task (30% time) - REUSING COMPUTE!
            if self.has_ai_task():
                ai_task = self.current_ai_task
                
                # Matrix operations from cosmic_harmony
                # are REUSED for AI inference!
                ai_result = self.process_ai_task(
                    ai_task,
                    intermediate_state=mining_result.state
                )
                
                await self.submit_ai_result(ai_result)
                # Extra ZION rewards!
```

## 6.4 Performance at Scale

### Current (TestNet):
```
50 miners × 500k H/s = 25 MH/s
Equivalent: ~5 NVIDIA A100 GPUs
Cost saved: ~$2,500/month cloud compute
```

### Target (MainNet 2027):
```
1,000 miners × 500k H/s = 500 GH/s
Equivalent: ~100 NVIDIA A100 GPUs
Cost saved: ~$50,000/month cloud compute
Revenue potential: $50-100K/month
```

---

# 7. Cosmic Harmony Merged Mining

## 7.1 Koncept: Zero-Cost Extra Revenue

Cosmic Harmony algoritmus používá **Keccak-256** jako první krok. Tento intermediate hash je kompatibilní s několika existujícími kryptoměnami - můžeme ho prodat nebo submitnout na jiný blockchain **bez jakéhokoliv extra compute**!

```
┌─────────────────────────────────────────────────────────────┐
│           COSMIC HARMONY MERGED MINING v2.1                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Input: Block Header + Nonce                                 │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────┐                                        │
│  │  STEP 1:        │                                        │
│  │  Keccak-256     │──────────► ALT-COIN / NICEHASH         │
│  │  (Galactic Ops) │            (FREE extra revenue!)       │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │  STEP 2:        │                                        │
│  │  SHA3-512       │                                        │
│  │  (Stellar)      │                                        │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │  STEP 3:        │                                        │
│  │  Golden Matrix  │                                        │
│  │  (φ = 1.618)    │                                        │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │  STEP 4:        │                                        │
│  │  Cosmic Fusion  │──────────► ZION POOL                   │
│  └─────────────────┘            (main reward)               │
│                                                              │
│  🎯 1 compute cycle = ZION + Alt-coin/BTC                   │
└─────────────────────────────────────────────────────────────┘
```

## 7.2 Možnost A: Merged Mining s Keccak Coins

### Kompatibilní kryptoměny:

| Coin | Algoritmus | Market Cap | Kompatibilita | Revenue/den |
|------|------------|------------|---------------|-------------|
| **Ethereum Classic (ETC)** | Etchash (Keccak) | ~$3B | ⭐⭐⭐ | $0.50/GPU |
| **SmartCash (SMART)** | Keccak | ~$1M | ⭐⭐⭐ | $0.05 |
| **Maxcoin (MAX)** | Keccak | ~$100K | ⭐⭐⭐ | $0.02 |
| **365coin (365)** | Keccak | ~$50K | ⭐⭐⭐ | $0.01 |
| **Creativecoin (CREA)** | Keccak | ~$200K | ⭐⭐⭐ | $0.03 |

### Implementace ETC Merged Mining:

```cpp
// zion/mining/cosmic_harmony_merged.cpp

void CosmicHarmonyHasher::cosmic_hash_merged(
    const uint8_t* input, 
    size_t input_len,
    uint32_t nonce, 
    uint8_t* zion_output,
    uint8_t* keccak_output  // Pro alt-coin submit
) {
    // Step 1: Keccak-256 (Galactic Matrix Ops)
    galactic_matrix_ops(input, keccak_intermediate);
    
    // ⭐ REUSE: Export Keccak hash pro alt-coin!
    memcpy(keccak_output, keccak_intermediate, 32);
    
    // Step 2-4: Pokračovat pro ZION
    stellar_harmony_process(keccak_intermediate, sha3_output);
    golden_matrix_transform(sha3_output, matrix);
    cosmic_fusion(matrix, zion_output);
}
```

```python
# Python miner integration
class MergedMiningClient:
    """Submit Keccak intermediate to ETC pool."""
    
    def __init__(self):
        self.etc_pool = "etc.2miners.com:1010"
        self.etc_wallet = os.getenv("ETC_WALLET")
        
    async def submit_keccak_share(self, keccak_hash: bytes, nonce: int):
        """Submit intermediate Keccak hash to ETC pool."""
        if self.meets_etc_difficulty(keccak_hash):
            await self.etc_stratum.submit(
                job_id=self.current_job,
                nonce=nonce,
                hash=keccak_hash.hex()
            )
            logger.info(f"ETC share submitted! Nonce: {nonce}")
```

### Revenue příklad (ETC):

```
1000 miners × Keccak component:
├── ETC difficulty match: ~1 share/min per miner
├── ETC share value: ~0.00001 ETC
├── Daily ETC: ~14 ETC ($280)
├── Monthly ETC: ~420 ETC ($8,400)
└── Extra revenue: +$8,400/month BEZ extra compute!
```

## 7.3 Možnost B: NiceHash Keccak (Nejjednodušší)

Alternativně můžeme Keccak hashpower prodat přímo na **NiceHash** a dostávat **BTC**:

```
┌─────────────────────────────────────────────────────────────┐
│              NICEHASH INTEGRATION                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Cosmic Harmony Step 1                                       │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────┐                                        │
│  │  Keccak-256     │───────► NiceHash Stratum               │
│  │  Hash Output    │         keccak.eu.nicehash.com:3338    │
│  └─────────────────┘                                        │
│                           │                                  │
│                           ▼                                  │
│                    ┌─────────────┐                          │
│                    │  NiceHash   │                          │
│                    │  Wallet     │                          │
│                    │             │                          │
│                    │  💰 BTC     │                          │
│                    └─────────────┘                          │
│                           │                                  │
│                           ▼                                  │
│                    ┌─────────────┐                          │
│                    │  ZION       │                          │
│                    │  Treasury   │                          │
│                    │  (BTC fund) │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Implementace (super jednoduchá):

```python
# 20 řádků kódu!
NICEHASH_STRATUM = "keccak.eu.nicehash.com:3338"
NICEHASH_WALLET = "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5"  # BTC adresa

class NiceHashKeccakClient:
    """Sell Keccak hashpower to NiceHash for BTC."""
    
    async def connect(self):
        self.client = StratumClient(NICEHASH_STRATUM)
        await self.client.authorize(NICEHASH_WALLET, "x")
    
    async def submit_keccak(self, keccak_hash: bytes, nonce: int):
        """Submit Keccak hash to NiceHash."""
        await self.client.submit_share(
            nonce=nonce,
            result=keccak_hash.hex()
        )
        # NiceHash platí v BTC automaticky každý den!
```

### Revenue příklad (NiceHash):

```
NiceHash Keccak profitability (leden 2026):
├── Price: ~0.05 BTC/TH/day
├── 1000 miners × 500 kH/s = 500 MH/s total
├── Daily BTC: ~0.000025 BTC ($2.50)
├── Monthly BTC: ~0.00075 BTC ($75)
│
│ ⚠️ Nižší revenue než ETC, ale:
│ ✅ Žádná údržba poolů
│ ✅ Přímé BTC platby
│ ✅ Stabilní příjem
└── Doporučeno jako FALLBACK nebo pro malé miners
```

## 7.4 Srovnání možností

| Kritérium | Možnost A: ETC | Možnost B: NiceHash |
|-----------|----------------|---------------------|
| **Složitost** | Střední | Velmi nízká |
| **Revenue** | ~$8,400/měsíc | ~$75-500/měsíc |
| **Platba** | ETC (směnit) | BTC (přímo) |
| **Údržba** | Pool monitoring | Žádná |
| **Stabilita** | Závisí na ETC | Velmi stabilní |
| **Doporučeno pro** | Větší operace | Malí miners, fallback |

## 7.5 Doporučená strategie

```
┌─────────────────────────────────────────────────────────────┐
│              HYBRID STRATEGY                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. PRIMARY (pokud ETC profitabilní):                       │
│     └── Merged mining s ETC → max revenue                   │
│                                                              │
│  2. FALLBACK (pokud ETC difficulty vysoká):                 │
│     └── NiceHash Keccak → stabilní BTC                      │
│                                                              │
│  3. AUTO-SWITCH (budoucnost):                               │
│     └── Profitability calculator vybere nejlepší možnost    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

```python
class MergedMiningRouter:
    """Auto-switch between ETC and NiceHash based on profitability."""
    
    async def get_best_option(self) -> str:
        etc_profit = await self.calculate_etc_profitability()
        nh_profit = await self.calculate_nicehash_profitability()
        
        if etc_profit > nh_profit * 1.2:  # ETC musí být 20% lepší
            return "etc"
        else:
            return "nicehash"  # Default to stability
    
    async def submit_keccak(self, keccak_hash: bytes, nonce: int):
        option = await self.get_best_option()
        
        if option == "etc":
            await self.etc_client.submit(keccak_hash, nonce)
        else:
            await self.nicehash_client.submit(keccak_hash, nonce)
```

## 7.6 Revenue Distribution

```
Merged Mining Revenue Split:

   GROSS REVENUE (ETC/BTC)
           │
           ▼
   ┌───────────────┐
   │  Auto-Swap    │
   │  to ZION      │ (nebo držet v BTC)
   └───────┬───────┘
           │
   ┌───────┼───────────────────────┐
   │       │                       │
   ▼       ▼                       ▼
┌──────┐ ┌──────────┐      ┌─────────────┐
│Miners│ │Development│      │  Treasury   │
│ 70%  │ │   20%    │      │    10%      │
└──────┘ └──────────┘      └─────────────┘
```

## 7.7 Možnost C: Triple Mining (SHA3-512)

Cosmic Harmony používá i **SHA3-512** (Stellar Harmony step). Můžeme využít i tento intermediate hash!

### SHA3-512 kompatibilní coiny:

| Coin | Algoritmus | Market Cap | Status | Poznámka |
|------|------------|------------|--------|----------|
| **Nexus (NXS)** | SHA3 | ~$5M | ⭐⭐ Aktivní | Prime candidate |
| **0xBitcoin (0xBTC)** | SHA3/Keccak | ~$3M | ⭐⭐ Aktivní | ERC-20 mined |
| **Maxcoin (MAX)** | SHA3-256 | ~$100K | ⭐ Nízká likvidita | Backup |

### Triple Mining Architektura:

```
┌─────────────────────────────────────────────────────────────┐
│           COSMIC HARMONY TRIPLE MINING                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Input: Block Header + Nonce                                 │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────┐                                        │
│  │  STEP 1:        │                                        │
│  │  Keccak-256     │──────► ETC / NiceHash ────► 💰 BTC/ETC │
│  │  (Galactic)     │        (Stream 1)                      │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │  STEP 2:        │                                        │
│  │  SHA3-512       │──────► Nexus / 0xBTC ─────► 💰 NXS     │
│  │  (Stellar)      │        (Stream 2)                      │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │  STEP 3+4:      │                                        │
│  │  Matrix+Fusion  │──────► ZION Pool ─────────► 💰 ZION    │
│  │  (Golden φ)     │        (Stream 3 - main)               │
│  └─────────────────┘                                        │
│                                                              │
│  🎯 1 compute cycle = 3 revenue streams!                    │
│  🎯 Zero extra compute cost!                                │
└─────────────────────────────────────────────────────────────┘
```

### Implementace Triple Mining:

```cpp
// zion/mining/cosmic_harmony_triple.cpp

void CosmicHarmonyHasher::cosmic_hash_triple(
    const uint8_t* input, 
    size_t input_len,
    uint32_t nonce, 
    uint8_t* zion_output,
    uint8_t* keccak_output,   // Stream 1: ETC/NiceHash
    uint8_t* sha3_output      // Stream 2: Nexus/0xBTC
) {
    // Step 1: Keccak-256 (Galactic Matrix Operations)
    galactic_matrix_ops(input, keccak_intermediate);
    memcpy(keccak_output, keccak_intermediate, 32);  // → ETC/NiceHash
    
    // Step 2: SHA3-512 (Stellar Harmony)
    stellar_harmony_process(keccak_intermediate, sha3_intermediate);
    // Truncate to 256-bit for alt-coin compatibility
    memcpy(sha3_output, sha3_intermediate, 32);      // → Nexus/0xBTC
    
    // Step 3: Golden Matrix Transform (φ = 1.618)
    golden_matrix_transform(sha3_intermediate, matrix);
    
    // Step 4: Cosmic Fusion
    cosmic_fusion(matrix, zion_output);              // → ZION
}
```

```python
# Python Triple Mining Client
class TripleMiningClient:
    """Submit all three hash streams simultaneously."""
    
    def __init__(self):
        self.keccak_client = None  # ETC or NiceHash
        self.sha3_client = None    # Nexus or 0xBTC
        self.zion_client = None    # ZION pool
        
    async def submit_all(
        self, 
        zion_hash: bytes,
        keccak_hash: bytes, 
        sha3_hash: bytes,
        nonce: int
    ):
        """Submit to all three networks."""
        
        # Parallel submission for speed
        await asyncio.gather(
            self.zion_client.submit(zion_hash, nonce),
            self.keccak_client.submit(keccak_hash, nonce),
            self.sha3_client.submit(sha3_hash, nonce),
        )
        
        logger.info(f"Triple submit: nonce={nonce}")
```

### Revenue Projection (Triple Mining):

```
1000 miners × Triple Mining:

┌────────────────────────────────────────────────────────────┐
│  Stream      │  Coin      │  Monthly Revenue │  % of Total │
├──────────────┼────────────┼──────────────────┼─────────────┤
│  Keccak-256  │  ETC       │  ~$8,400         │  45%        │
│  SHA3-512    │  Nexus     │  ~$500-1,000     │  5%         │
│  Fusion      │  ZION      │  Base rewards    │  50%        │
├──────────────┼────────────┼──────────────────┼─────────────┤
│  TOTAL EXTRA │            │  ~$9,000-9,400   │  100%       │
└────────────────────────────────────────────────────────────┘

⚠️ Note: SHA3 revenue závisí na Nexus/0xBTC difficulty
         a market conditions. Nutné ověřit aktuální data!
```

### Srovnání všech možností:

| Strategie | Streams | Extra Revenue | Složitost | Doporučeno |
|-----------|---------|---------------|-----------|------------|
| Single (ZION only) | 1 | $0 | Nejnižší | Začátečníci |
| Dual (+ Keccak) | 2 | ~$8,400/mo | Nízká | Většina |
| Triple (+ SHA3) | 3 | ~$9,400/mo | Střední | Pokročilí |

### Budoucí rozšíření - Quad Mining?

```
Potenciálně využitelné operace z Cosmic Harmony:

├── Step 1: Keccak-256     ✅ ETC/NiceHash
├── Step 2: SHA3-512       ✅ Nexus/0xBTC  
├── Step 3: Matrix (φ)     🔮 AI embeddings? (NCL integration)
└── Step 4: Fusion         ✅ ZION

Matrix transform output by mohl být použit pro AI vector
operations - synergie s NCL kapitolou!
```

---

# 8. Cosmic Harmony v3 - Multi-Algorithm Engine

## 8.1 Vize: Univerzální Modulární Algoritmus

Cosmic Harmony v3 přináší revoluční koncept: **algoritmus jako platforma**. Místo fixního hashovacího schématu má ZION modulární architekturu, kde blockchain sám rozhoduje které algoritmy aktivovat a kam routovat výstupy podle aktuální profitability.

```
┌─────────────────────────────────────────────────────────────┐
│          COSMIC HARMONY v3 - MULTI-ALGORITHM ENGINE          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              ALGORITHM MODULE LIBRARY                │    │
│  │                                                      │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │    │
│  │  │Keccak  │ │ SHA3   │ │RandomX │ │Autolykos│        │    │
│  │  │  256   │ │  512   │ │  (CPU) │ │  v2    │        │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘        │    │
│  │                                                      │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │    │
│  │  │KawPow  │ │Equihash│ │ Blake3 │ │KHeavyH │        │    │
│  │  │  (GPU) │ │ 144,5  │ │  ALPH  │ │  KAS   │        │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘        │    │
│  │                                                      │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │    │
│  │  │ProgPow │ │ Ethash │ │ Yescrypt│ │ Argon2 │        │    │
│  │  │        │ │  ETC   │ │  (CPU) │ │   d    │        │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘        │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         PROFITABILITY ROUTER (ZION-controlled)       │    │
│  │                                                      │    │
│  │   📊 WhatToMine API  →  Real-time coin profitability │    │
│  │   📈 Difficulty data →  Network hashrate tracking    │    │
│  │   💰 Price feeds     →  Exchange rates              │    │
│  │   ⚙️ Pool configs    →  Available destinations       │    │
│  │                                                      │    │
│  │   Decision: Route hash outputs to most profitable!   │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              COSMIC FUSION (Always ZION)             │    │
│  │                                                      │    │
│  │   Final step: All modules → Golden Matrix → ZION     │    │
│  │   Garantuje: ZION vždy dostane podíl z každého hashe │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 8.2 Architektura Modulárního Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│              COSMIC HARMONY v3 PIPELINE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Input: Block Header + Nonce + Module Config                 │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────┐                                        │
│  │  MODULE SLOT 1  │ ← Keccak-256 (default)                 │
│  │  [configurable] │   Output → ETC/NiceHash (if profit)    │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │  MODULE SLOT 2  │ ← SHA3-512 (default)                   │
│  │  [configurable] │   Output → Nexus/0xBTC (if profit)     │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │  MODULE SLOT 3  │ ← RandomX / Autolykos / KawPow         │
│  │  [switchable]   │   Output → XMR/ERG/RVN (dynamic)       │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │  GOLDEN MATRIX  │ ← φ transform (ZION-specific)          │
│  │  (fixed)        │                                        │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │  COSMIC FUSION  │ ← Final ZION hash                      │
│  │  (fixed)        │   Output → ZION blockchain             │
│  └─────────────────┘                                        │
│                                                              │
│  Legend:                                                     │
│  [configurable] = Blockchain consensus decides               │
│  [switchable]   = Real-time profitability switch            │
│  (fixed)        = ZION-specific, never changes              │
└─────────────────────────────────────────────────────────────┘
```

## 8.3 Podporované Algoritmy

### GPU Algorithms:

| Algoritmus | Target Coin | Memory | Hashrate (RTX 4090) | Revenue/day |
|------------|-------------|--------|---------------------|-------------|
| Ethash | ETC | 4GB+ | ~130 MH/s | ~$1.50 |
| KawPow | RVN | 4GB+ | ~60 MH/s | ~$0.80 |
| Autolykos2 | ERG | 4GB+ | ~300 MH/s | ~$1.20 |
| KHeavyHash | KAS | 2GB+ | ~1.5 GH/s | ~$2.00 |
| Blake3 | ALPH | 2GB+ | ~5 GH/s | ~$1.00 |
| Equihash 144,5 | ZEC | 2GB+ | ~100 Sol/s | ~$0.50 |

### CPU Algorithms:

| Algoritmus | Target Coin | RAM | Hashrate (Ryzen 9) | Revenue/day |
|------------|-------------|-----|---------------------|-------------|
| RandomX | XMR | 2GB+ | ~15 kH/s | ~$0.30 |
| Yescrypt | YTN | 512MB | ~5 kH/s | ~$0.05 |
| Argon2d | Various | 1GB+ | ~10 kH/s | ~$0.10 |

### Native Modules (vždy aktivní):

| Module | Purpose | Export | Required |
|--------|---------|--------|----------|
| Keccak-256 | Galactic Ops | ETC/NiceHash | ✅ Yes |
| SHA3-512 | Stellar Harmony | Nexus/0xBTC | ✅ Yes |
| Golden Matrix | φ transform | NCL/AI | ✅ Yes |
| Cosmic Fusion | Final hash | ZION | ✅ Yes |

## 8.4 Profitability Router

```python
# ai/ncl_gateway/profit_router.py

class CosmicHarmonyV3Router:
    """Routes algorithm outputs to most profitable destinations."""
    
    ALGO_TARGETS = {
        "keccak256": ["ETC", "NICEHASH_KECCAK"],
        "sha3_512": ["NXS", "0xBTC"],
        "randomx": ["XMR", "NICEHASH_RANDOMX"],
        "autolykos2": ["ERG"],
        "kawpow": ["RVN", "NICEHASH_KAWPOW"],
        "kheavyhash": ["KAS"],
        "blake3": ["ALPH"],
    }
    
    def __init__(self):
        self.whattomine = WhatToMineAPI()
        self.price_feed = PriceFeedAggregator()
        self.pool_manager = PoolConnectionManager()
        
    async def get_optimal_routing(self) -> Dict[str, str]:
        """Calculate optimal routing for all active modules."""
        
        routing = {}
        
        for algo, targets in self.ALGO_TARGETS.items():
            best_target = None
            best_profit = 0
            
            for target in targets:
                profit = await self._calculate_profit(algo, target)
                if profit > best_profit:
                    best_profit = profit
                    best_target = target
            
            routing[algo] = {
                "target": best_target,
                "expected_profit": best_profit,
                "pool": self.pool_manager.get_pool(best_target)
            }
        
        return routing
    
    async def _calculate_profit(self, algo: str, target: str) -> float:
        """Calculate expected daily profit in USD."""
        
        # Get current network difficulty
        difficulty = await self.whattomine.get_difficulty(target)
        
        # Get current price
        price = await self.price_feed.get_price(target, "USD")
        
        # Calculate expected coins per day
        expected_coins = self._estimate_coins(algo, difficulty)
        
        return expected_coins * price
```

## 8.5 Dynamický Module Switching

```python
class ModuleSwitcher:
    """Dynamically switch algorithm modules based on profitability."""
    
    # Check profitability every N minutes
    CHECK_INTERVAL = 5 * 60  # 5 minutes
    
    # Minimum profit difference to trigger switch (%)
    SWITCH_THRESHOLD = 10  # 10% better required
    
    async def monitor_and_switch(self):
        """Continuous monitoring and switching loop."""
        
        while True:
            current_routing = await self.router.get_optimal_routing()
            
            for module, config in current_routing.items():
                current = self.active_routing.get(module)
                
                if current and current["target"] != config["target"]:
                    # Check if switch is worth it
                    improvement = (
                        (config["expected_profit"] - current["expected_profit"])
                        / current["expected_profit"] * 100
                    )
                    
                    if improvement > self.SWITCH_THRESHOLD:
                        logger.info(
                            f"Switching {module}: {current['target']} → "
                            f"{config['target']} (+{improvement:.1f}%)"
                        )
                        await self._switch_module(module, config)
            
            await asyncio.sleep(self.CHECK_INTERVAL)
    
    async def _switch_module(self, module: str, config: Dict):
        """Execute module switch."""
        
        # 1. Gracefully stop current pool connection
        await self.pool_manager.disconnect(module)
        
        # 2. Connect to new pool
        await self.pool_manager.connect(
            module=module,
            pool=config["pool"],
            wallet=self.get_wallet(config["target"])
        )
        
        # 3. Update active routing
        self.active_routing[module] = config
        
        # 4. Log for analytics
        await self.analytics.log_switch(module, config)
```

## 8.6 Consensus Integration

```rust
// 2.9.5/zion-ncl/src/cosmic_v3/consensus.rs

/// Cosmic Harmony v3 consensus configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CosmicHarmonyV3Config {
    /// Algorithm version
    pub version: u32,  // 3
    
    /// Active module slots
    pub module_slots: Vec<ModuleSlot>,
    
    /// Minimum ZION allocation (always 50%+)
    pub min_zion_allocation: f64,  // 0.50
    
    /// Profit router enabled
    pub dynamic_routing: bool,
    
    /// Block height for next config update (governance)
    pub next_update_height: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleSlot {
    /// Slot position in pipeline
    pub position: u8,
    
    /// Currently active algorithm
    pub algorithm: AlgorithmType,
    
    /// Can be changed at runtime?
    pub switchable: bool,
    
    /// Export hash to external network?
    pub export_enabled: bool,
    
    /// Target network for export
    pub export_target: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlgorithmType {
    // Native (always included)
    Keccak256,
    Sha3_512,
    GoldenMatrix,
    CosmicFusion,
    
    // GPU switchable
    Autolykos2,
    KawPow,
    KHeavyHash,
    Blake3,
    Ethash,
    Equihash,
    
    // CPU switchable
    RandomX,
    Yescrypt,
    Argon2d,
}
```

## 8.7 Revenue Model v3 (UPDATED 2026-02-06)

```
┌─────────────────────────────────────────────────────────────┐
│           COSMIC HARMONY v3 REVENUE STREAMS                  │
│                   🔄 50/25/25 MODEL                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   COMPUTE ALLOCATION (100%):                                 │
│                                                              │
│   ┌─────────────┐                                           │
│   │    ZION     │ ← 50% compute (Keccak→SHA3→Matrix→Fusion) │
│   │  (primary)  │   Always mined, base rewards              │
│   │             │   ┌────────────────────────────────────┐   │
│   │             │   │ FREE BYPRODUCTS (zero extra cost): │   │
│   │             │   │ • Keccak intermediate → ETC/NiceH  │   │
│   │             │   │ • SHA3 intermediate → Nexus/0xBTC  │   │
│   │             │   └────────────────────────────────────┘   │
│   └─────────────┘                                           │
│          +                                                   │
│   ┌─────────────┐                                           │
│   │  Multi-Algo │ ← 25% compute (ERG/RVN/KAS/ALPH)          │
│   │  (profit)   │   🎯 PROFIT-SWITCH ENGINE                  │
│   └─────────────┘                                           │
│          +                                                   │
│   ┌─────────────┐                                           │
│   │    NCL      │ ← 25% compute (AI inference tasks)         │
│   │  (AI)       │   🧠 ONNX/CoreML/TensorRT                  │
│   └─────────────┘                                           │
│                                                              │
│   🎯 Total: 5 revenue streams, only 3 cost compute!         │
│   💰 Keccak & SHA3 = FREE bonus from ZION pipeline!         │
└─────────────────────────────────────────────────────────────┘
```

### Projected Revenue (1000 miners) - UPDATED 2026-02-06:

| Stream | Source | Monthly $ | Compute | Status |
|--------|--------|-----------|---------|--------|
| ZION | Cosmic Fusion | Base rewards | 50% | ✅ Primary |
| Keccak | ETC/NiceHash | ~$500-8,400 | FREE! | 🎁 Byproduct |
| SHA3 | Nexus/0xBTC | ~$200-500 | FREE! | 🎁 Byproduct |
| **Multi-Algo** | ERG/RVN/KAS/ALPH | ~$8,000-20,000 | 25% | 🎯 **Profit-switch** |
| **NCL AI** | AI inference | ~$5,000-10,000 | 25% | 🧠 **AI compute** |
| **TOTAL EXTRA** | | **~$13,700-39,000/mo** | | |

> 💡 **ELEGANCE**: CH pipeline vždy počítá Keccak→SHA3 jako kroky 1-2.
> Intermediate hashe submitujeme ZDARMA na ETC/Nexus = nulové extra náklady!
> Blockchain funguje beze změn — vrstvy zůstávají.

## 8.8 Governance: Algorithm Selection

```
┌─────────────────────────────────────────────────────────────┐
│              DAO GOVERNANCE: ALGORITHM VOTING                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ZION holders mohou hlasovat o:                              │
│                                                              │
│  1. NOVÉ MODULY                                              │
│     "Přidat podporu pro Octopus (CFX)?"                     │
│     [YES: 67%] [NO: 33%] → ✅ Přidáno v blocku 500,000      │
│                                                              │
│  2. DEFAULT ROUTING                                          │
│     "Změnit default GPU algo z KawPow na KHeavyHash?"       │
│     [YES: 45%] [NO: 55%] → ❌ Zachovat KawPow               │
│                                                              │
│  3. PROFIT THRESHOLDS                                        │
│     "Snížit switch threshold z 10% na 5%?"                  │
│     [YES: 72%] [NO: 28%] → ✅ Implementováno                │
│                                                              │
│  4. REVENUE SPLIT                                            │
│     "Zvýšit miner share z 70% na 75%?"                      │
│     [YES: 89%] [NO: 11%] → ✅ Schváleno                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

# 9. Ekonomický Model

## 7.1 Revenue Streams

```
┌─────────────────────────────────────────────────────────────┐
│                    REVENUE STREAMS                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              1. API SUBSCRIPTIONS                    │   │
│  │                                                      │   │
│  │  Tier        Price/mo    Requests/mo    Revenue     │   │
│  │  ────────────────────────────────────────────────   │   │
│  │  Free        $0          10K            $0          │   │
│  │  Starter     $29         100K           $29 × N     │   │
│  │  Pro         $99         500K           $99 × N     │   │
│  │  Enterprise  Custom      Unlimited      $$$$        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              2. PAY-PER-USE                          │   │
│  │                                                      │   │
│  │  Service              Price             Volume/day   │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  Embeddings           $0.0001/1K        100M         │   │
│  │  LLM (7B)             $0.002/1K tok     10M          │   │
│  │  LLM (70B)            $0.01/1K tok      1M           │   │
│  │  Image Gen            $0.02/image       50K          │   │
│  │  Speech-to-Text       $0.006/min        100K min     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              3. ENTERPRISE CONTRACTS                 │   │
│  │                                                      │   │
│  │  • Dedicated compute allocation                     │   │
│  │  • Custom model hosting                             │   │
│  │  • SLA guarantees                                   │   │
│  │  • Private endpoints                                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 7.2 Revenue Distribution

```
                    GROSS REVENUE ($100K/month example)
                              │
                              ▼
              ┌───────────────────────────────┐
              │      ZION NCL TREASURY        │
              │          ($100,000)           │
              └───────────────┬───────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │   MINERS    │    │ DEVELOPMENT │    │  TREASURY   │
   │    (70%)    │    │    (20%)    │    │   (10%)     │
   │   $70,000   │    │   $20,000   │    │  $10,000    │
   └──────┬──────┘    └─────────────┘    └─────────────┘
          │
          ▼
   ┌─────────────────────────────────────────────┐
   │         MINER REWARD DISTRIBUTION           │
   │                                             │
   │  Based on:                                  │
   │  • Tasks completed (60%)                   │
   │  • Task quality/speed (20%)                │
   │  • Uptime reliability (20%)                │
   │                                             │
   │  Payment: Daily in BTC/USDC or ZION        │
   └─────────────────────────────────────────────┘
```

## 7.3 Projected Revenue (Scaling)

| Miners | Compute Power | Monthly Revenue | Per Miner |
|--------|---------------|-----------------|-----------|
| 100 | ~50 TFLOPS | $5,000 | $35/mo |
| 1,000 | ~500 TFLOPS | $50,000 | $35/mo |
| 10,000 | ~5 PFLOPS | $500,000 | $35/mo |
| 100,000 | ~50 PFLOPS | $5,000,000 | $35/mo |

**Comparison:**
- AWS p4d.24xlarge: $32.77/hour = ~$24K/month
- ZION 100 miners equivalent: ~$350/month (70x cheaper!)

---

# 10. AI Agent Marketplace

## 11.1 AI Agent as a Service (AIaaS)

NCL podporuje **AI Agent Marketplace** - developeré vytváří agenty, kteří běží na miner compute:

```
┌─────────────────────────────────────────────────────────────┐
│              ZION AI AGENT MARKETPLACE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Developer → Vytvoří agenta → Nabídne na marketplace        │
│                    ↓                                        │
│  User → Platí ZION za usage → Agent počítá (miners)        │
│                    ↓                                        │
│  💰 Revenue split: 70% developer / 30% platform            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 11.2 Agent Types

| Agent | Funkce | Revenue Potential |
|-------|--------|-------------------|
| 🏗️ **Code Review** | Analyzuje commit history, najde bugs | $100-500/mo |
| 📊 **Analytics** | Statistiky projektu z git history | $50-200/mo |
| 🔍 **Documentation** | Generuje docs z kódu + commits | $200-1000/mo |
| 🤝 **Onboarding** | Novým devům vysvětlí celý projekt | $100-500/mo |
| 🐛 **Debug** | Najde kdy/jak vznikla chyba | $500-2000/mo |
| 🎨 **Image Gen** | Stable Diffusion generování | $1000-5000/mo |

## 11.3 Agent API Integration

```python
# Custom AI Agent using NCL
from zion_ncl import NCLClient, AIMemory

class CodeReviewAgent:
    """AI Agent for code review powered by NCL."""
    
    def __init__(self):
        self.memory = AIMemory()  # AI Native Memory
        self.ncl = NCLClient()    # NCL Gateway
        
    async def review(self, code: str) -> dict:
        # 1. Get context from AI Native Memory
        context = self.memory.search("similar code patterns")
        
        # 2. Submit to NCL for inference
        task = {
            "model": "codellama-7b",
            "prompt": f"Review this code:\n{code}\n\nContext:\n{context}",
            "max_tokens": 500
        }
        
        result = await self.ncl.submit_and_wait(task)
        
        return {
            "issues": self._parse_issues(result),
            "score": self._calculate_score(result),
            "suggestions": self._extract_suggestions(result)
        }
```

## 9.4 Subscription Plans

```
┌─────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION PLANS                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🆓 FREE                                                    │
│  ├─ 100 API requests/měsíc                                 │
│  ├─ Basic search                                           │
│  └─ 1 agent                                                │
│                                                             │
│  💎 PRO ($29/měsíc)                                        │
│  ├─ 10,000 API requests/měsíc                              │
│  ├─ Full-text + semantic search                            │
│  ├─ 5 custom agents                                        │
│  └─ WebSocket real-time                                    │
│                                                             │
│  🚀 ENTERPRISE ($299/měsíc)                                │
│  ├─ Unlimited requests                                     │
│  ├─ Dedicated compute allocation                           │
│  ├─ Custom model hosting                                   │
│  ├─ SLA guarantees                                         │
│  └─ Private endpoints                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 9.5 Developer Revenue Model

```python
# Developer earnings example
monthly_requests = 10_000
price_per_request = 0.01  # $0.01

gross_revenue = monthly_requests * price_per_request  # $100
developer_share = gross_revenue * 0.70               # $70
platform_share = gross_revenue * 0.30                # $30 (→ miners + treasury)
```

| Requests/Month | Developer Earnings | Platform Revenue |
|----------------|-------------------|------------------|
| 1,000 | $7 | $3 |
| 10,000 | $70 | $30 |
| 100,000 | $700 | $300 |
| 1,000,000 | $7,000 | $3,000 |

---

# 11. Implementační Plán

## 11.1 Directory Structure (ZION 2.9.5)

```
2.9.5/
├── zion-native/
│   ├── src/
│   │   ├── mining/           # Existing mining code
│   │   └── npu/              # NEW: Neural Processing Unit
│   │       ├── mod.rs
│   │       ├── runtime.rs
│   │       ├── scheduler.rs
│   │       ├── models.rs
│   │       └── tasks.rs
│   └── Cargo.toml
│
├── zion-universal-miner/
│   ├── src/
│   │   └── ncl/              # NEW: NCL integration
│   │       ├── mod.rs
│   │       ├── onnx.rs
│   │       ├── coreml.rs
│   │       └── tensorrt.rs
│   └── Cargo.toml
│
└── ai/                        # NEW: AI Gateway
    ├── ncl_gateway/
    │   ├── __init__.py
    │   ├── server.py
    │   ├── task_queue.py
    │   ├── distributor.py
    │   └── api/
    │       ├── openai_compat.py
    │       └── admin.py
    ├── models/
    │   ├── registry.py
    │   └── downloader.py
    └── config/
        └── ncl_config.yaml
```

## 11.2 Phase 1: Basic NPU (2 týdny)

### 11.2.1 Python Prototype
```python
# ai/ncl_gateway/npu_prototype.py

import onnxruntime as ort
import numpy as np
import asyncio
from typing import Dict, Any

class NPUPrototype:
    """Minimal NPU for testing concept."""
    
    def __init__(self):
        self.session = None
        self.model_loaded = False
        
    async def load_model(self, model_path: str):
        """Load ONNX model."""
        self.session = ort.InferenceSession(model_path)
        self.model_loaded = True
        
    async def inference(self, input_data: np.ndarray) -> np.ndarray:
        """Run inference."""
        if not self.model_loaded:
            raise RuntimeError("No model loaded")
            
        input_name = self.session.get_inputs()[0].name
        result = self.session.run(None, {input_name: input_data})
        return result[0]


async def test_npu():
    """Test basic NPU functionality."""
    npu = NPUPrototype()
    
    # Load a simple model (e.g., MobileNet)
    await npu.load_model("models/mobilenet_v3.onnx")
    
    # Create dummy input
    input_data = np.random.randn(1, 3, 224, 224).astype(np.float32)
    
    # Run inference
    output = await npu.inference(input_data)
    print(f"Output shape: {output.shape}")
    

if __name__ == "__main__":
    asyncio.run(test_npu())
```

### 11.2.2 Miner Integration
```python
# Additions to zion_native_miner_v2_9.py

class ZionMinerWithNCL(ZionNativeMiner):
    """Miner with Neural Compute Layer support."""
    
    def __init__(self, *args, ncl_enabled=True, ncl_ratio=0.3, **kwargs):
        super().__init__(*args, **kwargs)
        self.ncl_enabled = ncl_enabled
        self.ncl_ratio = ncl_ratio
        self.npu = NPUEngine() if ncl_enabled else None
        
    async def mining_loop(self):
        """Modified mining loop with NCL support."""
        while self.running:
            # Calculate time slices
            total_time = 10  # seconds per cycle
            mining_time = total_time * (1 - self.ncl_ratio)
            ncl_time = total_time * self.ncl_ratio
            
            # Mining phase
            await self.mine_for_duration(mining_time)
            
            # NCL phase
            if self.ncl_enabled:
                await self.process_ncl_tasks(ncl_time)
                
    async def process_ncl_tasks(self, duration: float):
        """Process AI tasks for given duration."""
        start = time.time()
        while time.time() - start < duration:
            task = await self.fetch_ncl_task()
            if task:
                result = await self.npu.process(task)
                await self.submit_ncl_result(result)
            else:
                await asyncio.sleep(0.1)  # No tasks available
```

## 11.3 Phase 2: Task Gateway (1 měsíc)

### 11.3.1 Redis Queue Setup
```yaml
# docker-compose.ncl.yaml

services:
  ncl-redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    volumes:
      - ncl-redis-data:/data
    command: redis-server --appendonly yes
    
  ncl-gateway:
    build: ./ai/ncl_gateway
    ports:
      - "8090:8090"
    environment:
      - REDIS_URL=redis://ncl-redis:6379
      - POOL_URL=http://pool:3333
    depends_on:
      - ncl-redis
      
volumes:
  ncl-redis-data:
```

### 11.3.2 Gateway Server
```python
# ai/ncl_gateway/server.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import redis.asyncio as redis
import uuid

app = FastAPI(title="ZION NCL Gateway")

class TaskRequest(BaseModel):
    model: str
    input: dict
    priority: str = "medium"

class TaskResponse(BaseModel):
    task_id: str
    status: str
    result: dict = None

@app.post("/v1/tasks", response_model=TaskResponse)
async def submit_task(request: TaskRequest):
    """Submit new AI task."""
    task_id = str(uuid.uuid4())
    
    task = {
        "id": task_id,
        "model": request.model,
        "input": request.input,
        "priority": request.priority,
        "status": "pending"
    }
    
    # Add to queue
    await redis_client.rpush(f"tasks:{request.priority}", json.dumps(task))
    
    return TaskResponse(task_id=task_id, status="pending")

@app.get("/v1/tasks/{task_id}", response_model=TaskResponse)
async def get_task_status(task_id: str):
    """Get task status and result."""
    result = await redis_client.get(f"results:{task_id}")
    
    if result:
        return TaskResponse(
            task_id=task_id,
            status="completed",
            result=json.loads(result)
        )
    
    # Check if still pending
    for priority in ["high", "medium", "low"]:
        tasks = await redis_client.lrange(f"tasks:{priority}", 0, -1)
        for t in tasks:
            if json.loads(t)["id"] == task_id:
                return TaskResponse(task_id=task_id, status="pending")
    
    raise HTTPException(status_code=404, detail="Task not found")
```

## 10.4 Phase 3: Production Integration (2 měsíce)

### 10.4.1 Rust NPU Engine
```rust
// 2.9.5/zion-native/src/npu/mod.rs

use ort::{Session, SessionBuilder, Value};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct NPUEngine {
    sessions: RwLock<HashMap<String, Arc<Session>>>,
    config: NPUConfig,
}

impl NPUEngine {
    pub async fn new(config: NPUConfig) -> Result<Self> {
        Ok(Self {
            sessions: RwLock::new(HashMap::new()),
            config,
        })
    }
    
    pub async fn load_model(&self, model_id: &str) -> Result<()> {
        let model_path = self.config.model_path(model_id);
        
        let session = SessionBuilder::new()?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .with_model_from_file(&model_path)?;
            
        self.sessions.write().await.insert(
            model_id.to_string(),
            Arc::new(session)
        );
        
        Ok(())
    }
    
    pub async fn inference(&self, model_id: &str, input: Value) -> Result<Value> {
        let sessions = self.sessions.read().await;
        let session = sessions.get(model_id)
            .ok_or_else(|| anyhow!("Model not loaded"))?;
            
        let outputs = session.run(vec![input])?;
        Ok(outputs[0].clone())
    }
}
```

### 10.4.2 Miner Scheduler
```rust
// 2.9.5/zion-native/src/npu/scheduler.rs

use tokio::time::{Duration, Instant};

pub struct HybridScheduler {
    mining_ratio: f64,
    npu_ratio: f64,
    cycle_duration: Duration,
}

impl HybridScheduler {
    pub fn new(npu_ratio: f64) -> Self {
        Self {
            mining_ratio: 1.0 - npu_ratio,
            npu_ratio,
            cycle_duration: Duration::from_secs(10),
        }
    }
    
    pub async fn run<M, N>(&self, mut miner: M, mut npu: N) -> Result<()>
    where
        M: MiningEngine,
        N: NPUEngine,
    {
        loop {
            let cycle_start = Instant::now();
            
            // Mining phase
            let mining_duration = self.cycle_duration.mul_f64(self.mining_ratio);
            miner.mine_for(mining_duration).await?;
            
            // NPU phase
            let npu_duration = self.cycle_duration.mul_f64(self.npu_ratio);
            npu.process_tasks_for(npu_duration).await?;
            
            // Ensure cycle timing
            let elapsed = cycle_start.elapsed();
            if elapsed < self.cycle_duration {
                tokio::time::sleep(self.cycle_duration - elapsed).await;
            }
        }
    }
}
```

---

# 12. Bezpečnost a Soukromí

## 11.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Malicious tasks (crypto mining via AI) | Model whitelist, sandboxing |
| Result forgery | Deterministic verification, duplicate tasks |
| Data leakage | End-to-end encryption, ephemeral storage |
| DoS attacks | Rate limiting, reputation system |
| Model theft | Encrypted model weights, attestation |

## 11.2 Task Isolation

```
┌─────────────────────────────────────────────────────────────┐
│                    MINER SECURITY                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SANDBOX ENVIRONMENT                     │   │
│  │                                                      │   │
│  │  • WASM runtime for custom models                   │   │
│  │  • Memory limits per task                           │   │
│  │  • CPU time limits                                  │   │
│  │  • No network access during inference               │   │
│  │  • No filesystem access                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              MODEL VERIFICATION                      │   │
│  │                                                      │   │
│  │  • SHA256 hash verification                         │   │
│  │  • Signature from ZION Model Registry               │   │
│  │  • Periodic model audits                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              DATA PROTECTION                         │   │
│  │                                                      │   │
│  │  • Input data encrypted in transit (TLS 1.3)        │   │
│  │  • Ephemeral storage (RAM only)                     │   │
│  │  • No logging of inference data                     │   │
│  │  • GDPR compliant data handling                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 11.3 Result Verification

```python
class ResultVerifier:
    """Verifies AI task results for correctness."""
    
    async def verify(self, task: AITask, result: AIResult) -> bool:
        # Strategy 1: Deterministic models
        if task.model_id in DETERMINISTIC_MODELS:
            return await self._verify_deterministic(task, result)
        
        # Strategy 2: Duplicate execution
        if random.random() < VERIFICATION_SAMPLE_RATE:
            return await self._verify_duplicate(task, result)
        
        # Strategy 3: Statistical bounds
        return await self._verify_statistical(task, result)
    
    async def _verify_deterministic(self, task, result) -> bool:
        """Re-execute on trusted node and compare."""
        trusted_result = await self.trusted_executor.run(task)
        return trusted_result.output == result.output
    
    async def _verify_duplicate(self, task, result) -> bool:
        """Send to another miner and compare."""
        other_result = await self.send_to_random_miner(task)
        return self._compare_outputs(result.output, other_result.output)
```

---

# 13. Integrace do ZION 2.9.5

## 12.1 Změny v existujících souborech

### 12.1.1 Cargo.toml Update
```toml
# 2.9.5/Cargo.toml - additions

[workspace]
members = [
    "zion-native",
    "zion-universal-miner",
    "zion-ncl",  # NEW
]

# 2.9.5/zion-ncl/Cargo.toml
[package]
name = "zion-ncl"
version = "0.1.0"

[dependencies]
ort = "2.0"  # ONNX Runtime
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
redis = { version = "0.24", features = ["tokio-comp"] }
anyhow = "1.0"
```

### 12.1.2 Config Update
```yaml
# config/miner_config.yaml - additions

ncl:
  enabled: true
  ratio: 0.30  # 30% time for AI tasks
  
  gateway:
    url: "https://ncl.zionterranova.com"
    api_key: "${NCL_API_KEY}"
    
  models:
    preload:
      - "distilbert-base"
      - "mobilenet-v3"
    max_memory_mb: 4096
    
  scheduler:
    cycle_seconds: 10
    priority_mining: true  # Always finish block search first
```

## 12.2 New Directory Structure

```bash
# Create NCL directories
mkdir -p 2.9.5/zion-ncl/src
mkdir -p ai/ncl_gateway
mkdir -p ai/models
mkdir -p config/ncl
```

## 12.3 Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                 ZION 2.9.5 + NCL INTEGRATION                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  EXISTING CODE                    NEW NCL CODE              │
│  ─────────────                    ────────────              │
│                                                             │
│  zion-native/                                               │
│  └── src/                                                   │
│      ├── mining/                  ┌────────────────┐        │
│      │   └── engine.rs ─────────►│ npu/mod.rs     │        │
│      │                            │ npu/scheduler │        │
│      └── pool/                    └───────┬────────┘        │
│          └── client.rs ─────────────────►│                  │
│                                           │                  │
│  zion-universal-miner/                    │                  │
│  └── src/                                 │                  │
│      └── main.rs ────────────────────────►│                  │
│                                           │                  │
│                         ┌─────────────────▼─────────────┐   │
│                         │        zion-ncl/              │   │
│                         │                               │   │
│                         │  src/                         │   │
│                         │  ├── lib.rs                  │   │
│                         │  ├── engine.rs               │   │
│                         │  ├── task_client.rs          │   │
│                         │  └── runtime/                │   │
│                         │      ├── onnx.rs             │   │
│                         │      ├── coreml.rs           │   │
│                         │      └── tensorrt.rs         │   │
│                         └───────────────────────────────┘   │
│                                                             │
│  POOL SIDE                                                  │
│  ─────────                                                  │
│                                                             │
│  src/pool/               ┌────────────────────────────┐    │
│  └── zion_pool_v2_9.py ─►│ ai/ncl_gateway/           │    │
│                          │ ├── server.py              │    │
│                          │ ├── task_queue.py          │    │
│                          │ └── distributor.py         │    │
│                          └────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 14. Roadmap

## 13.1 Timeline

```
2026 Q1 (Now - March)
├── Week 1-2:  Phase 1 - Python NPU Prototype
├── Week 3-4:  Phase 1 - Basic miner integration
├── Week 5-8:  Phase 2 - Task Gateway MVP
└── Week 9-12: Phase 2 - Redis queue, basic API

2026 Q2 (April - June)
├── Month 1:   Phase 3 - Rust NPU engine
├── Month 2:   Phase 3 - Multi-runtime support
└── Month 3:   Phase 3 - Production hardening

2026 Q3 (July - September)
├── Month 1:   Beta launch with select partners
├── Month 2:   OpenAI-compatible API
└── Month 3:   Public API launch

2026 Q4 (October - December)
├── Month 1:   Model marketplace
├── Month 2:   Enterprise features
└── Month 3:   Full mainnet integration
```

## 13.2 Milestones

| Milestone | Target Date | Success Criteria |
|-----------|-------------|------------------|
| NPU Prototype | Jan 31, 2026 | Run 1 ONNX model in miner |
| Task Gateway MVP | Feb 28, 2026 | 10 tasks/sec throughput |
| Rust Integration | Apr 30, 2026 | Native miner with NPU |
| Beta Launch | Jul 31, 2026 | 100 miners, $1K revenue |
| Public Launch | Sep 30, 2026 | 1000 miners, $10K revenue |
| Enterprise | Dec 31, 2026 | 3 enterprise contracts |

---

# 15. Závěr

ZION Neural Compute Layer představuje unikátní příležitost:

1. **First Mover Advantage** - žádná jiná kryptoměna nemá takto elegantní PoUW
2. **Revenue Before Mainnet** - peníze ještě před spuštěním hlavní sítě
3. **Real Utility** - ZION = platba za AI compute
4. **Aligned Incentives** - miners i projekt profitují

Implementace je technicky proveditelná s využitím existujících technologií (ONNX, CoreML, TensorRT) a může být realizována postupně během roku 2026.

---

# Appendix A: Competitive Analysis

| Project | Approach | Revenue | Status |
|---------|----------|---------|--------|
| Render | GPU rendering | $5M/mo | Live |
| Golem | General compute | $100K/mo | Live |
| Bittensor | AI subnet | $1M/mo | Live |
| IO.net | GPU cloud | $500K/mo | Beta |
| **ZION NCL** | PoW + AI hybrid | TBD | Design |

**ZION Advantage:** Integrated into mining, not separate network.

---

# Appendix B: Technical Requirements

## Minimum Miner Requirements for NCL

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 8 GB | 16 GB+ |
| GPU VRAM | 4 GB | 8 GB+ |
| Storage | 50 GB | 100 GB+ |
| Network | 10 Mbps | 100 Mbps+ |
| OS | macOS 12+, Linux, Windows 10+ | Latest |

## Supported Hardware

- Apple Silicon (M1-M5) ✅ Best support
- NVIDIA RTX 20xx+ ✅ Full support
- AMD RX 5xxx+ ✅ ROCm support
- Intel Arc ⚠️ Partial support
- CPU only ✅ Fallback support

---

**Document End**

*This document is confidential and intended for ZION core team only.*
*Do not distribute without authorization.*

🔐 **ZION TerraNova - Building the Future of Conscious Computing** 🔐
