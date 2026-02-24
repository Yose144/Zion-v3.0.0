# L3 AI Architecture — ZION 2.9.6

> Tento dokument popisuje architekturu L3 vrstvy — AI agenty, orchestraci,
> Neural Compute Layer (NCL) a WARP engine. Vychází z Python prototypu
> `Zion-2.9.5-main/2.9-History/ai/` (70+ souborů) a je přepsán do Rustu.

---

## 1. Přehled vrstev

```
┌─────────────────────────────────────────────────────────────────┐
│  L4 / Oasis  — vědomí, evoluce agentů (budoucí vrstva)          │
├─────────────────────────────────────────────────────────────────┤
│  L3 / WARP + AI-Native + NCL  ◄── tato dokumentace              │
│                                                                   │
│   ┌─────────────────────┐   ┌───────────────────────────────┐   │
│   │  zion-ai-native     │   │  zion-ncl                     │   │
│   │  ─────────────────  │   │  ───────────────────────────  │   │
│   │  Orchestrator       │   │  JobScheduler                 │   │
│   │  ConsciousnessEng.  │   │  ReputationRegistry           │   │
│   │  AgentMemory        │   │  PricingEngine                │   │
│   │  PoolOptimizer      │   │  BackendRunners (ONNX/WASM…)  │   │
│   │  WarpOptimizer      │   │  NCL REST API (axum)          │   │
│   │  TaskQueue          │   │                               │   │
│   └─────────────────────┘   └───────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  L2 — bridge, DAO, smart contracts                               │
├─────────────────────────────────────────────────────────────────┤
│  L1 — core, miner, pool  (Rust + cosmic-harmony)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Crate `zion-ai-native`

### 2.1 Moduly

| Soubor | Účel |
|--------|------|
| `orchestrator.rs` | Centrální orchestrátor — správa agentů, dispatch úkolů |
| `task.rs` | Typy úkolů, stavův automat, prioritní fronta |
| `memory.rs` | Dvojúrovňová episodická paměť |
| `pool_optimizer.rs` | Health scoring poolů, automatický výběr |
| `warp_agent.rs` | WARP field topologie a coherence engine |
| `consciousness_engine.rs` | Unified XP → level progression engine |
| `consciousness.rs` | `ConsciousnessLevel` enum (1–9), XP prahy |
| `types.rs` | `Agent`, `AgentCapability`, `AgentMessage` |
| `error.rs` | `AiError` hierarchie |

---

### 2.2 Orchestrátor

`Orchestrator` je centrální správce agentů. Každý agent má:
- **jméno** a **UUID**
- **`AgentStatus`** — `Active | Suspended | Terminated`
- **`ConsciousnessLevel`** (1–9)
- sadu **`AgentCapability`** — `Compute | Bridge | Govern | Oracle | Evolve`
- **load** (počet aktivních úkolů)

#### Dispatch úkolu

```
dispatch_task(task) →
  1. filtruj agenty: is_active + has Compute capability
  2. filtruj: consciousness_level >= task.required_consciousness
  3. vyber max(consciousness), pak min(load)
  4. vrať assigned agent UUID
```

#### Consciousness gate pro capabilities

| Capability | Min. úroveň |
|------------|-------------|
| Compute    | 2           |
| Bridge     | 3           |
| Govern     | 4           |

#### Vážené hlasování (`weighted_majority`)

Používá se pro multi-agent rozhodování:

$$\text{score} = \frac{\sum_{i: \text{vote}=\text{yes}} w_i \cdot c_i}{\sum_i w_i \cdot c_i}$$

kde $c_i$ je confidence agenta a $w_i$ jeho váha.

---

### 2.3 Task systém

```
AiTaskType: LlmInference | ImageGeneration | ModelTraining
            | Embeddings | CodeAnalysis | Custom

TaskStatus FSM:
  Pending → Assigned → Processing → Completed
                    ↘                ↘ Failed
                                    ↘ Timeout
                                    ↘ Cancelled
```

`TaskQueue` — prioritní dequeue:
- priority 1–10 (10 = nejvyšší)
- při shodné prioritě FIFO (nejstarší první)

---

### 2.4 Episodická paměť (`AgentMemory`)

Dvouúrovňový systém inspirovaný `zion_memory_system.py`:

```
Short-term (ring buffer, výchozí kapacita 50)
    ↓ při importance ≥ 0.6 → auto-promote
Long-term archive (max 1000, evict lowest importance)
```

`MemoryEventKind` — 14 typů:
`TaskCompleted | TaskFailed | PoolSwitched | WarpActivated | ConsciousnessLevelUp | AgentSpawned | AgentTerminated | CriticalError | Reward | Penalty | MessageReceived | MessageSent | BalanceChanged | Custom`

Recall API:
- `recall(keyword)` — full-text hledání přes oba tier, sorted by importance
- `recall_by_kind(kind)` — filtr podle typu
- `recent(n)` — posledních N short-term

---

### 2.5 Pool Optimizer

Portováno z `orchestrator_v3.py`. Health score 0–100:

$$\text{score} = \underbrace{U \cdot 0.4}_{\text{uptime}} + \underbrace{L \cdot 0.3}_{\text{latency}} + \underbrace{S \cdot 0.2}_{\text{stale}} + \underbrace{R \cdot 0.1}_{\text{reject}}$$

kde:
- $U = \text{uptime\_pct}$
- $L = \max\!\left(0,\ 100 - (\text{latency\_ms} - 100) \cdot 0.25\right)$
- $S = \max\!\left(0,\ 100 - \text{stale\_rate} \cdot 10\right)$
- $R = \max\!\left(0,\ 100 - \text{reject\_rate} \cdot 20\right)$

Heuristika:
- **Hystereza** (výchozí 5.0 bodů) — pool není přepnut, pokud rozdíl skóre je pod prahem
- **Rolling history** 20 snímků per pool

---

### 2.6 WARP Engine

Portováno z `ai_warp_engine_v2.py`.

```
FieldTopology: Sphere(1×) → Torus(1.2×) → Helix(1.4×) → Fractal(1.7×) → Hypercube(2.5×)
WarpMode:      Standard(1×) → Boost(2×) → Overdrive(3×) → Quantum(5×) → Transcendent(10×)

intensity = topology_base × mode_multiplier × coherence
total_multiplier = intensity × (1 + resonance × 0.3)
```

Mode eskalace (tick-driven):

| Coherence ≥ | Level ≥ | Mode          |
|-------------|---------|---------------|
| 0.95        | 5       | Transcendent  |
| 0.85        | 4       | Quantum       |
| 0.75        | —       | Overdrive     |
| 0.60        | —       | Boost         |

Topology eskalace `on_level_up(n)`:
- level 1–2 → Sphere
- level 3   → Torus
- level 4   → Helix
- level 5   → Fractal
- level 6+  → Hypercube

---

### 2.7 ConsciousnessEngine

Unifikovaný engine spravující evoluci agenta:

```rust
ConsciousnessEngine {
    level: ConsciousnessLevel,    // aktuální úroveň 1–9
    xp: u64,                      // nasbírané XP
    memory: AgentMemory,          // episodická paměť
    warp: WarpOptimizer,          // WARP field
}
```

XP prahy (port z `consciousness.rs`):

| Level | XP potřeba |
|-------|------------|
| 1→2   | 100        |
| 2→3   | 250        |
| 3→4   | 500        |
| 4→5   | 1 000      |
| 5→6   | 2 500      |
| 6→7   | 5 000      |
| 7→8   | 10 000     |
| 8→9   | 25 000     |

XP za události:

| Událost | XP |
|---------|-----|
| `TaskCompleted` | 10 |
| `PoolSwitched`  | 5  |
| `WarpActivated` | 3  |
| `TaskFailed`    | −2 |

Při level-up: memory záznam `ConsciousnessLevelUp` + `WarpOptimizer::on_level_up(n)`.

---

## 3. Crate `zion-ncl`

Neural Compute Layer — decentralizovaný marketplace pro AI výpočty.

### 3.1 Moduly

| Soubor | Účel |
|--------|------|
| `scheduler.rs` | Priority-first scheduling s reputation-weighted výběrem |
| `reputation.rs` | Per-worker skóre, leaderboard, ban detection |
| `pricing.rs` | Cenový model dle backend + compute units |
| `types.rs` | `NclJob`, `NclWorker`, `ComputeBackend`, `NclTaskType` |
| `backend.rs` | Trait `BackendRunner` + stub implementace |
| `api.rs` | Axum REST API handlery |
| `error.rs` | `NclError` hierarchie |

---

### 3.2 Job lifecycle

```
NclJobStatus: Queued → Assigned → Running → Completed
                    ↘               ↘ Failed
                                    ↘ Cancelled
```

Fieldy `NclJob`:
- `task_type: NclTaskType` — LlmInference / ImageGeneration / ModelTraining / Embeddings / …
- `priority: u8` (1–10, default 5)
- `min_consciousness: u8` — min. vědomí workera
- `backend: ComputeBackend`
- `compute_units: u64`
- `reward_atomic: u64` — odměna v ZION atomic units

---

### 3.3 Scheduling algoritmus

```
try_assign_next():
  1. Najdi job s nejvyšší priority (ties → nejstarší FIFO)
  2. Filtruj workers: has_capacity() AND supports_backend() AND meets_consciousness()
  3. Pokud attached ReputationRegistry → vyber worker s nejvyšším score
  4. Přiřaď: job.status = Assigned, worker.active_jobs += 1
```

---

### 3.4 Reputation model

Portováno z `MinerCapability` v Python historii.

$$\text{score} = 100 \cdot r \cdot (1 + k \cdot 0.05) \cdot d$$

kde:
- $r$ = success_rate = completed / (completed + failed + timeout)
  _(nový worker: $r = 1.0$)_
- $k$ = consciousness_level (0–5)
- $d$ = recency decay: $1.0$ pokud idle < 24h, pak $\max(0.5,\ 1 - (h - 24) \cdot 0.01)$

Completion time tracking: EMA s $\alpha = 0.2$

$$\bar{t}_n = 0.8 \cdot \bar{t}_{n-1} + 0.2 \cdot t_n$$

Ban threshold: score < 20.0

---

### 3.5 Cenový model

```
price = base_price × backend_multiplier × compute_units

Backend multipliers:
  WASM:       0.5×
  TfLite:     1.0×
  ONNX:       1.5×
  Custom:     2.0×

Reward split:
  Worker:   90%
  Protocol: 10%
```

---

### 3.6 REST API (`/api/v1/ncl`)

Axum server — endpointy:

| Method | Path | Popis |
|--------|------|-------|
| `GET`  | `/health` | Stav systému — queued/active/workers |
| `POST` | `/jobs` | Submission nového jobu |
| `GET`  | `/jobs/:id` | Status konkrétního jobu |
| `POST` | `/jobs/:id/complete` | Worker hlásí dokončení |
| `POST` | `/jobs/:id/fail` | Worker hlásí selhání |
| `POST` | `/workers` | Registrace nového workera |
| `GET`  | `/workers` | Seznam všech workerů |
| `GET`  | `/leaderboard` | Top workeri dle reputace |
| `POST` | `/schedule` | Manuální trigger scheduling cyklu |

---

## 4. Datový tok — NCL job execution

```
Client                  NCL API           Scheduler        Worker
  │                        │                  │               │
  │── POST /jobs ─────────►│                  │               │
  │                        │── submit_job() ─►│               │
  │◄── { job_id } ─────────│                  │               │
  │                        │                  │               │
  │── POST /schedule ──────►│                  │               │
  │                        │── try_assign() ─►│               │
  │                        │                  │── notify ────►│
  │                        │                  │               │─ run_inference()
  │                        │                  │               │
  │── GET /jobs/:id ───────►│                  │               │
  │◄── { status: Running }──│                  │               │
  │                        │                  │               │
  │                        │◄── POST /jobs/:id/complete ──────│
  │                        │── complete_job()►│               │
  │◄── GET /jobs/:id: Completed ─────────────►│               │
```

---

## 5. Datový tok — AI agent s WARP

```
ConsciousnessEngine::on_task_complete(type, ms)
  ├─► AgentMemory::record(TaskCompleted, importance=0.7)
  │     └─ importance ≥ 0.6 → promote to long-term
  ├─► add_xp(10)
  │     └─ XP ≥ threshold → level_up()
  │           ├─ memory::record(ConsciousnessLevelUp)
  │           └─ WarpOptimizer::on_level_up(n)
  │                 ├─ topology upgrade (Sphere → … → Hypercube)
  │                 └─ coherence reset 0.5
  └─► WarpOptimizer::tick()
        ├─ coherence += 0.02 (per tick)
        ├─ resonance  += 0.01
        └─ auto-escalate WarpMode
```

---

## 6. Testovací pokrytí

| Crate | Testů | Výsledek |
|-------|-------|----------|
| `zion-ai-native` | 48 | ✅ 48/48 |
| `zion-ncl` | 29 | ✅ 29/29 |
| **Celkem** | **77** | **✅ 77/77** |

Testy pokrývají:
- FSM lifecycle (task, job)
- Priority queue ordering
- Health scoring edge cases
- Pool hysteresis
- Memory tier eviction + promotion
- Consciousness gate v dispatch
- Weighted majority voting
- Reputation scoring + ban detection
- Scheduler priority + consciousness filter + reputation selection
- WARP mode escalation + topology mapping

---

## 7. Roadmap

| Fáze | Co | Priorita |
|------|----|----------|
| L3-A | ConsciousnessEngine XP loop | ✅ Done |
| L3-B | NCL REST API (axum) | ✅ Done |
| L3-C | ONNX / TFLite backend integrace | 🟡 Střední |
| L3-D | LLM inference endpoint (llama.cpp binding) | 🟡 Střední |
| L3-E | Agent-to-agent messaging bus (tokio broadcast) | 🔴 Vysoká |
| L3-F | Persistent job store (SQLite) | 🔴 Vysoká |
| L3-G | L1 pool telemetrie → PoolOptimizer live feed | 🟡 Střední |
| L3-H | L4/Oasis integrace (consciousness ↔ on-chain XP) | 🔵 Budoucí |

---

## 8. Soubory pro každý crate

### `zion-ai-native` (`L3/ai-native/`)

```
src/
  lib.rs                  — veřejné re-exporty
  types.rs                — Agent, AgentCapability, AgentMessage, AgentStatus
  error.rs                — AiError
  consciousness.rs        — ConsciousnessLevel enum, XP prahy
  consciousness_engine.rs — XP loop, level-up, WARP sync
  memory.rs               — AgentMemory (short + long-term)
  orchestrator.rs         — Orchestrator, dispatch, weighted_majority
  pool_optimizer.rs       — PoolStats, PoolOptimizer
  task.rs                 — AiTask, TaskQueue, TaskStatus FSM
  warp_agent.rs           — WarpField, WarpOptimizer, FieldTopology
```

### `zion-ncl` (`L3/ncl/`)

```
src/
  lib.rs         — veřejné re-exporty
  types.rs       — NclJob, NclWorker, ComputeBackend, NclTaskType
  error.rs       — NclError
  scheduler.rs   — JobScheduler (priority + reputation-weighted)
  reputation.rs  — ReputationRecord, ReputationRegistry
  pricing.rs     — PricingEngine
  backend.rs     — BackendRunner trait + ONNX/WASM/TFLite stubs
  api.rs         — Axum REST handler functions
```

---

*Generováno: 2026-02-24 | ZION 2.9.6 | commit `bc29b3a`*
