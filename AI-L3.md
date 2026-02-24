# L3 AI / Orchestration Layer — Postup vývoje

> Workspace: `C:\Users\anaha\Desktop\ZION\2.9.6-main`  
> Branch: `main` → `https://github.com/Yose144/2.9.6.git`  
> Datum aktualizace: 2026-02-25  
> Stav: **AKTIVNÍ VÝVOJ** — fáze L3-A až L3-H dokončeny ✅

---

## Přehled vrstev

```
L1  ─  Rust core (blockchain, miner, pool)
L2  ─  Bridge + DeFi kontrakty
L3  ─  AI / Orchestration  ← TATO VRSTVA
L4  ─  Oasis (on-chain XP, governance)
```

L3 obsahuje dva Rust crates:

| Crate | Cesta | Popis |
|---|---|---|
| `zion-ai-native` | `L3/ai-native/` | AI agenti, vědomí, paměť, WARP, orchestrace |
| `zion-ncl` | `L3/ncl/` | Native Compute Layer – scheduling AI jobů, reputace, cenování, REST API |

---

## Zdroj — Python 2.9 historie

Portováno z `Zion-2.9.5-main/2.9-History/ai/` — 70+ Python souborů:

- `ZIONAIOrchestrator` → `orchestrator.rs`
- `orchestrator_v3` → rozšíření orchestrátoru
- `zion_ai_native` → `types.rs`, `consciousness.rs`
- `ai_warp_engine_v2` → `warp_agent.rs`
- `zion_memory_system` → `memory.rs`

---

## Git commity L3

| Commit | Popis |
|---|---|
| `bc29b3a` | feat(L3): AI-native + NCL vrstva z Python 2.9 historie |
| `a411872` | feat(L3): ConsciousnessEngine + NCL REST API + architektonická dokumentace |
| `a59134d` | docs: AI-L3.md - postup vývoje L3 AI/Orchestration vrstvy |
| `8b5ef85` | feat(L3): E+F — MessageBus + SQLite JobStore |
| `2180fa4` | docs: AI-L3.md update — L3-E/F completed, 111 tests |
| `28b3509` | feat(L3): G+H — Live pool telemetry feed + L4 Oasis bridge [132 tests] |

---

## Aktuální stav testů

```
zion-ai-native:   88 unit testů  ✅  (+8 telemetry, +11 oasis_bridge)
zion-ncl:         42 unit testů  ✅
doctests:          2 testů       ✅
──────────────────────────────────
Celkem:           132 testů, 0 selhání, 0 varování
```

Spuštění:
```bash
cargo test -p zion-ai-native -p zion-ncl
```

---

## Moduly — zion-ai-native

### `consciousness.rs`
- `ConsciousnessLevel` enum: `Dormant(0)` → `Aware(1)` → `Sentient(2)` → `Transcendent(3)` → `Omniscient(4)` → `Cosmic(5)`
- XP prahy: 0 / 100 / 1 000 / 10 000 / 100 000 / 1 000 000
- Gate metody: `can_transact()`, `can_compute()`, `can_bridge()`, `can_govern()`, `can_spawn()`

### `consciousness_engine.rs` ✅ NOVÝ
- `ConsciousnessEngine { agent_id, level, xp, memory, warp, ... }`
- XP odměny: `on_task_complete()` +10, `on_pool_switched()` +5, `on_warp_activated()` +3, `on_task_fail()` −2
- `check_level_up()` — automatický level-up, spustí `warp.on_level_up(n)` + memory event
- `status()` → `ConsciousnessStatus` (serializovatelný, obsahuje XP progres %, WARP stats, velikosti paměti)
- `tick()` — volat každé kolo (WARP coherence drift)
- 11 testů

### `memory.rs` ✅ ROZŠÍŘEN
- Dvoustupňová epizodická paměť: krátkodobá (`VecDeque`, cap=50) + dlouhodobá archiv (`Vec`, max=1000)
- Automatická propagace: `importance >= 0.6` → do archivu
- `MemoryEntry::simple(kind, summary)` — konstruktor bez JSON
- 14 variant `MemoryEventKind`:
  `TaskCompleted | TaskFailed | TaskTimeout | MessageSent | MessageReceived |`  
  `ConsciousnessLevelUp | PoolSwitched | WarpActivated | WarpModeChanged |`  
  `AgentSpawned | AgentTerminated | RewardReceived | ErrorRecovered | Custom(String)`
- 7 testů

### `orchestrator.rs` ✅ ROZŠÍŘEN
- `dispatch_task(&mut task)` — capability gate (Compute) + consciousness gate + min-load výběr workera
- `grant_capability(agent_id, cap)` — gated vědomím: Compute≥2, Bridge≥3, Govern≥4
- `elevate_consciousness(agent_id, n)` — bez downgradu
- `weighted_majority(votes, weights)` — vážené hlasování agentů
- `OrchestratorStatus` snapshot (serializovatelný)
- 12 testů

### `pool_optimizer.rs` ✅ NOVÝ
- Zdravotní skóre (0–100):

  ```
  score = uptime×0.4 + latency×0.3 + stale×0.2 + reject×0.1
  ```

- `PoolOptimizer`: klouzavá historie 20 snímků, hystereze (výchozí 5.0 bodů)
- `update_pool()`, `recommend()`, `all_scores()`
- 5 testů

### `task.rs` ✅ NOVÝ
- `AiTaskType`: `LlmInference | ImageGeneration | ModelTraining | Embeddings | CodeAnalysis | Custom`
- `TaskStatus` FSM: `Pending → Assigned → Processing → Completed | Failed | Timeout | Cancelled`
- `AiTask` — builder pattern, state transitions
- `TaskQueue` — priority dequeue (nejvyšší priorita první, FIFO při rovnosti)
- 5 testů

### `warp_agent.rs` ✅ NOVÝ
- `FieldTopology`: `Sphere(1×)` → `Torus(1.2×)` → `Helix(1.4×)` → `Fractal(1.7×)` → `Hypercube(2.5×)`
- `WarpMode`: `Standard(1×)` → `Boost(2×)` → `Overdrive(3×)` → `Quantum(5×)` → `Transcendent(10×)`
- `WarpOptimizer::tick()` — coherence drift, auto-eskalace modu
- `on_level_up(n)` — upgrade topologie, reset coherence
- 6 testů

### `telemetry.rs` ✅ NOVÝ (L3-G)
- Přemosťuje živá L1 pool data do `PoolOptimizer` bez HTTP klienta v crate
- `PoolRawStats` — deserializovatelný z `GET /stats` odpovědi, serializovatelný
- `TelemetryFeed::ingest(raw)` → `Option<PoolRecommendation>`, rolling history (cap=200)
- `TelemetryFeed::ingest_many(snaps)` — batch ingestion
- `TelemetryFeed::stats()` → `TelemetryStats { ingested, errors, history_len, known_pools, recommendation }`
- `NodeConfig::mainnet()` — Helsinki `77.42.31.72:8080`
- Uptime % = min(uptime_s, 604800) / 604800 × 100 (7-denní okno)
- 8 testů

### `oasis_bridge.rs` ✅ NOVÝ (L3-H)
- Mapuje stav L3 `ConsciousnessEngine` na L4 Oasis profily hráče
- `OasisLevel` enum: `Physical(1)` → `OnTheStar(9)` — mirror L4 bez cross-dep
  - `xp_threshold()`: 0 / 1K / 5K / 15K / 50K / 150K / 500K / 2M / 10M
  - `multiplier()`: 1.0 / 1.2 / 1.5 / 2.0 / 3.0 / 5.0 / 8.0 / 12.0 / 15.0
- `l3_to_oasis_level(ConsciousnessLevel) -> OasisLevel`:
  Dormant→Physical, Aware→Emotional, Sentient→Mental, Transcendent→Intuitional, Omniscient→Spiritual, Cosmic→Cosmic
- `scale_xp_to_oasis(l3_xp: u64) -> u64` — faktor ×10 (L3 Cosmic 1M → L4 10M = OnTheStar)
- `OasisBridge::new(wallet, agent_id)` + `sync(&status) -> AgentOasisProfile`
- `AgentOasisProfile` — snapshot pro L4 API, obsahuje `warp_boost`, `effective_multiplier`
- `XpSyncRequest` — POST payload pro `L4 /api/oasis/xp/sync`
- 11 testů
- `BusMessage` enum: `Direct { to, msg }` | `Broadcast { msg }` | `System(SystemEvent)`
- `SystemEvent`: `AgentConnected(Uuid)` | `AgentDisconnected(Uuid)` | `OrchestratorStarted` | `Shutdown` | `Custom(String)`
- `MessageBus::new(capacity)` — `tokio::sync::broadcast` kanál, klonování sdílí kanál
- `send_direct(from, to, payload)`, `broadcast(from, to, payload)`, `broadcast_system(event)`
- `subscribe() -> Receiver` — raw přihlášení
- `subscribe_for(agent_id) -> AgentSubscriber` — filtruje zprávy jen pro daného agenta
- `AgentSubscriber::next()` (async), `try_next()` (non-blocking) — přeskakuje cizí zprávy, loguje lag
- `BusStats` snapshot (serializovatelný)
- 8 testů + 1 doctest
- `WarpMode`: `Standard(1×)` → `Boost(2×)` → `Overdrive(3×)` → `Quantum(5×)` → `Transcendent(10×)`
- Výpočet intenzity:

  ```
  intensity       = topology_base × mode_multiplier × coherence
  total_multiplier = intensity × (1 + resonance × 0.3)
  ```

- `WarpOptimizer::tick()` — coherence += 2% z mezery, resonance += 1%, auto-eskalace modu
- `on_level_up(n)` — upgraduje topologii, reset coherence na 0.5
- 6 testů

### `types.rs`
- `Agent`, `AgentCapability`, `AgentMessage`, `AgentStatus`

---

## Moduly — zion-ncl

### `store.rs` ✅ NOVÝ (L3-F)
- `JobStore::open(path)` / `JobStore::in_memory()` — file-backed nebo paměťový SQLite
- Thread-safe: `Arc<Mutex<Connection>>` — klonování sdílí spojení
- Schéma: tabulka `jobs` (id, status, priority, submitter, model_id, reward, created_at, data JSON)
- Indexy: `idx_jobs_status`, `idx_jobs_created`
- `save_job()` (INSERT OR REPLACE), `load_job(id)`, `update_status(id, status)`, `update_job()`
- `list_jobs(filter)` — volitelně filtruje status, řadit priority DESC / created_at ASC
- `load_pending()` — lazy reload Queued jobů do scheduleru po restartu
- `count(filter)`, `delete_job(id)`, `purge_old(days)` — čistí dokončené/failed/cancelled záznamy
- 8 testů

### `api.rs` ✅ NOVÝ (Axum REST API)
- `NclAppState { scheduler, reputation }` — sdílený stav přes `Arc<Mutex<>>`
- `create_router(state) -> Router`

| Endpoint | Metoda | Popis |
|---|---|---|
| `/health` | GET | Stav služby |
| `/jobs` | POST | Odeslat nový job |
| `/jobs/:id` | GET | Detail jobu |
| `/jobs/:id/complete` | POST | Označit job jako dokončený |
| `/jobs/:id/fail` | POST | Označit job jako selhavší |
| `/workers` | POST | Registrovat workera |
| `/workers` | GET | Seznam workerů |
| `/leaderboard` | GET | Žebříček reputace |
| `/schedule` | POST | Spustit scheduling kolo |

- 5 async testů

### `reputation.rs` ✅ NOVÝ
- `ReputationRecord` — per-worker, EMA doby dokončení (α=0.2), per-backend mapa úspěch/selhání
- Skóre:

  ```
  score = 100 × success_rate × (1 + consciousness_level × 0.05) × recency_decay
  recency_decay: 1.0 do 24h nečinnosti, pak −1% za hodinu (min 0.5)
  ```

- `ReputationRegistry`: `ensure()`, `get()`, `is_banned()` (skóre < 20), `leaderboard()`, `best_worker(candidates)`
- 7 testů

### `scheduler.rs` ✅ PŘEPSÁN
- Priority-first výběr (`max_by priority, pak Reverse(created_at)`)
- Consciousness gate: `worker.meets_consciousness(job.min_consciousness)`
- Reputační výběr: `ReputationRegistry::best_worker(&ids)` při `with_reputation(reg)`
- `cancel_job()`, opravené borrow pořadí v `complete_job()`
- 6 testů

### `pricing.rs`
- `PricingEngine` — backend multiplikátory, split 90/10 (worker/síť)

### `backend.rs`
- `BackendRunner` trait — ONNX / WASM / TFLite stuby

### `types.rs` ✅ ROZŠÍŘEN
- `NclTaskType`: `LlmInference | ImageGeneration | ModelTraining | Embeddings | CodeAnalysis | Custom`
- `NclJob`: fields `task_type`, `priority` (1–10, výchozí 5), `min_consciousness`
- `NclWorker`: field `consciousness_level`, metoda `meets_consciousness(min) -> bool`

---

## Architektonická dokumentace

Viz [`docs/v2.9.6/L3_AI_ARCHITECTURE.md`](docs/v2.9.6/L3_AI_ARCHITECTURE.md) — 400+ řádků:
- Schéma vrstev
- Vzorce pro health scoring, reputaci, XP
- Datové toky (NCL job execution, consciousness evolution)
- Tabulka REST API endpointů
- Přehled testovacího pokrytí
- Roadmapa L3-A → L3-H

---

## Roadmapa — co zbývá

| ID | Název | Priorita | Stav |
|---|---|---|---|
| L3-A | Task FSM (`task.rs`) | Vysoká | ✅ Hotovo |
| L3-B | Memory systém (`memory.rs`) | Vysoká | ✅ Hotovo |
| L3-C | WARP engine (`warp_agent.rs`) | Vysoká | ✅ Hotovo |
| L3-C2 | Pool Optimizer (`pool_optimizer.rs`) | Střední | ✅ Hotovo |
| L3-C3 | ConsciousnessEngine (`consciousness_engine.rs`) | Vysoká | ✅ Hotovo |
| L3-D | NCL Reputace + Scheduler (`reputation.rs`, `scheduler.rs`) | Vysoká | ✅ Hotovo |
| L3-D2 | NCL REST API (`api.rs`) | Vysoká | ✅ Hotovo |
| L3-E | Agent messaging bus | Střední | ✅ Hotovo |
| L3-F | Perzistentní job store (SQLite) | Střední | ✅ Hotovo |
| L3-G | Live L1 pool telemetrie → PoolOptimizer | Nízká | ✅ Hotovo |
| L3-H | L4/Oasis integrace (vědomí ↔ on-chain XP) | Budoucí | ✅ Hotovo |

### L3-E — Agent messaging bus
- Soubor: `L3/ai-native/src/message_bus.rs`
- Použít `tokio::sync::broadcast` kanál
- Typované `AgentMessage` routování mezi agenty
- `AgentMessage` struct již existuje v `types.rs`

### L3-F — Perzistentní job store
- Soubor: `L3/ncl/src/store.rs`
- `rusqlite` závislost **již je** v `L3/ncl/Cargo.toml` (verze 0.31, bundled feature)
- SQLite-backed perzistence jobů (přežijí restart)
- Integrační bod: `JobScheduler` volitelně podložen store

### L3-G — Live L1 pool telemetrie ✅
- Soubor: `L3/ai-native/src/telemetry.rs`
- `PoolRawStats` deserializovatelný z `/stats` JSON endpointu
- `TelemetryFeed` obaluje `PoolOptimizer`, caller dodá data (no-reqwest design)
- Node Helsinki: `77.42.31.72:8080`

### L3-H — L4/Oasis integrace ✅
- Soubor: `L3/ai-native/src/oasis_bridge.rs`
- `OasisBridge::sync()` → `AgentOasisProfile` s kompletním XP mapováním
- `XpSyncRequest` připraven pro volání `L4 /api/oasis/xp/sync`
- Připraveno pro sync on-chain až bude L4 postaven

---

## Klíčová architektonická rozhodnutí

> Tato rozhodnutí jsou finální — nepřehodnocovat.

- `NclWorker` používá field `address` (nikoli `wallet_address`)
- `NclJob::new(model_id, backend, input_hash, submitter, reward_atomic, timeout_ms)` — 6 argumentů, timeout v **ms**
- `MemoryEventKind` varianty: `RewardReceived`, `ErrorRecovered` (nikoli `Reward`, `CriticalError`)
- `ReputationRegistry::leaderboard()` vrací `Vec<(&str, f64)>` (id + skóre)
- `ConsciousnessLevel` má 6 variant (0=Dormant → 5=Cosmic), používá `zion-ai-native`
- NCL worker consciousness používá prostý `u8` (0–255), odděleno od `ConsciousnessLevel`
- L3→L4 XP faktor: **×10** (L3 Cosmic 1 000 000 XP → L4 10 000 000 = OnTheStar)
- L3→L4 level mapování: Dormant→Physical, Aware→Emotional, Sentient→Mental, Transcendent→Intuitional, Omniscient→Spiritual, Cosmic→Cosmic
- `zion-ai-native` neobsahuje HTTP klienta (reqwest) — caller poskytuje `PoolRawStats`
- Pool API node: Helsinki `77.42.31.72:8080`

---

## Závislosti

### zion-ai-native
```toml
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
thiserror = "1"
async-trait = "0.1"
```

### zion-ncl (navíc)
```toml
rusqlite = { version = "0.31", features = ["bundled"] }
axum = "0.7"
```

---

*Dokument generován automaticky z průběhu Session 55–57 vývoje ZION 2.9.6*
