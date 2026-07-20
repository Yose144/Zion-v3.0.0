# Hiran v2.4 Maestro — Development Plan

> **Created:** 2026-07-20
> **Last updated:** 2026-07-20 (MVP COMPLETE — ecosystem expansion)
> **Scope:** Konkrétní plán vývoje v2.4 Maestro orchestratoru nad existujícím `V3/L3/ai-native` crate (9925 řádků PLNÉ implementace).
> **Source:** `HiranV2.4/` (5 design docs), `docs/3.0.5/archive-root-md/HIRAN_EVOLUTION_2.3_TO_2.5_AMATHABOJ.md` (fáze 2 a 3), `docs/3.0.1Genesis/HIRAN_CLI_PLAN.md`, průzkum ai-native crate

---

## 0. Status — MVP COMPLETE (2026-07-20)

**Fáze 1 (MVP) hotová.** 6 komponent implementováno v `V3/L3/ai-native/src/`:

| Komponenta | Soubor | Řádky | Stav |
|-----------|--------|-------|------|
| **Tool Registry** (55 tools, 32 Sub-Agents, 14 Intents, async reqwest executor s retry) | `tool_registry.rs` | ~1508 | ✅ |
| **Intent Router** (rule-based + LLM klasifikace, EN+CS, 14 intentů) | `intent.rs` | ~794 | ✅ |
| **Planner Engine** (14 plan templates, DAG, cycle detection, topological sort, approval gating) | `planner.rs` | ~661 | ✅ |
| **Health Poller** (26 služeb — node1/2 RPC+P2P+metrics, pool, dashboard, nginx, web, DeFi, watchdog) | `health_poller.rs` | ~716 | ✅ |
| **Layer Agents** (7 Layer Agents, 32 Sub-Agents, dispatch) | `layer_agents.rs` | ~601 | ✅ |
| **Maestro** (apex orchestrator: classify → plan → execute → respond, health cache) | `maestro.rs` | ~536 | ✅ |

**Testy:** 337 unit + 8 doc = **345 tests, 0 failures** (`cargo test -p zion-ai-native`)
**Build:** `cargo build -p zion-ai-native` ✅ (jen pre-existing warnings)
**Target dir:** `CARGO_TARGET_DIR=/tmp/ai-native-target` (V3/target je root-owned)

### Ecosystem coverage (rozšíření MVP)

Původní MVP (37 tools, 27 sub-agents, 10 intents) rozšířeno na **kompletní Zion ekosystém**:

| Vrstva | Původní | Rozšířeno | Nové |
|--------|---------|-----------|------|
| Tools | 37 | 55 | +18 (DeFi staking/farm, dashboard health/alerts/revenue, db list/inspect, backup list/status, watchdog status/run, nginx reload/status, node2 getblockcount, pool stats, node1 metrics, db_backup_status/list) |
| Sub-Agents | 27 | 32 | +5 (NodeMetrics L1, DefiMonitor L2, DashboardOps System, DatabaseInspector System, WatchdogController System) |
| Intents | 10 | 14 | +4 (DefiStatus, BackupQuery, DatabaseInspect, WatchdogStatus) |
| Health services | 17 | 26 | +9 (node1/2 metrics, pool stats, dashboard, nginx, web-next, atd.) |

### Co CHYBÍ pro production deploy (Fáze 2–4)

- **Fáze 2:** gRPC transport Maestro↔Layer Agents, Audit Log (SQLite), Emergency Response, Auto-remediation rules engine (YAML)
- **Fáze 3:** CLI `zion agent`, E2E testy, Human approval gate, Dashboard orchestrator tab
- **Fáze 4:** LlamaCppBackend FFI, Load test, Security audit
- **Binárka/service:** Neexistuje `bin/maestro` ani `zion-edge-maestro.service` — MVP je zatím knihovna

---

## 1. Startovní pozice — co UŽ existuje

Průzkum `V3/L3/ai-native/` ukázal, že **crate je 9925 řádků PLNÉ implementace** (ne skeletony). To mění plán: v2.4 Maestro není „napsat od nuly", ale „dopsat chybějící části k existujícímu foundation".

### Hotové komponenty (production-ready)

| Komponenta | Soubor | Řádky | Stav |
|-----------|--------|-------|------|
| **Orchestrator** (agent dispatch, NCL, bridge ops s safety limits) | `orchestrator.rs` | 923 | ✅ plný |
| **Hiranyagarbha Agent** (MML, Dharma Validator, Deeksha, 10 principů) | `hiranyagarbha.rs` | 1561 | ✅ plný |
| **LLM Backends** (RemoteHttp=NVIDIA NIM, Echo, ConsciousnessAware, LlamaCpp stub) | `llm_backend.rs` | 799 | ✅ plný (LlamaCpp FFI chybí) |
| **Message Bus** (tokio::broadcast, 201 testů) | `message_bus.rs` | 370 | ✅ plný |
| **Task Management** (7 stavů, priority queue, timeout) | `task.rs` | 361 | ✅ plný |
| **Consciousness Engine** (XP, level-up, WARP integration) | `consciousness_engine.rs` | 429 | ✅ plný |
| **Pool Optimizer** (health score, hysteresis) | `pool_optimizer.rs` | 343 | ✅ plný |
| **WARP Agent** (5 topologií, 5 módů) | `warp_agent.rs` | 336 | ✅ plný |
| **RAG Pipeline** (VectorStore, NVIDIA NIM embeddings, 6 corpus roots) | `rag.rs` + `knowledge_base.rs` | 1620 | ✅ plný |
| **Memory** (2-tier: short/long-term) | `memory.rs` | 365 | ✅ plný |
| **Oasis Bridge** (L3↔L4 XP mapping) | `oasis_bridge.rs` | 431 | ✅ plný |
| **REST API** (Axum, 30+ endpoints) | `bin/zion-ai-native-api.rs` | 1110 | ✅ plný |
| **Hiran Inference Client** (HTTP, chat, embeddings) | `hiran_inference.rs` | 443 | ✅ plný |
| **In-Context Learning** (ContextSnapshot, ContextAssembler) | `in_context.rs` | 496 | ✅ plný |
| **Ekam Field** (Deeksha mesh, φ=0.618) | `ekam_field.rs` | 554 | ✅ plný |
| **Telemetry** (L1 pool stats ingestion) | `telemetry.rs` | 420 | ✅ plný |
| **Autotuner** (self-improvement) | `autotuner.rs` | 93 | ✅ plný |

**Celkem hotovo:** ~9900 řádků, 195 testů PASS, crate kompiluje v workspace.

### Chybějící komponenty pro v2.4 Maestro

| Komponenta | Estimace | Priorita |
|-----------|----------|----------|
| **A. Hierarchical Agent Dispatch** (Maestro → Layer Agents → Sub-Agents) | ~500 řádků | P0 |
| **B. Intent Router** (Qwen3-8B klasifikace user input → Intent enum) | ~300 řádků | P0 |
| **C. Planner Engine** (decomposition goals → dependency graphs) | ~400 řádků | P0 |
| **D. Layer Agents** (L1–L6 + System = 7 agentů) | ~1500 řádků | P0 |
| **E. Sub-Agents** (33 specialistů) | ~3000 řádků | P1 |
| **F. Tool Registry** (37 tools, JSON Schema, dispatch) | ~800 řádků | P0 |
| **G. Service Mesh Health Poller** (10s/30s/60s polling) | ~400 řádků | P0 |
| **H. gRPC transport** (Maestro ↔ Layer Agents) | ~400 řádků | P1 |
| **I. Audit Log** (immutable append-only, SQLite) | ~200 řádků | P1 |
| **J. Emergency Response** (critical alert router, remediation rules) | ~300 řádků | P1 |
| **K. CLI `zion agent`** (run, session, review, monitor) | ~600 řádků | P1 |
| **L. Dashboard integration** (orchestrator tab) | ~400 řádků | P2 |
| **M. Auto-remediation rules engine** (YAML rules) | ~300 řádků | P1 |
| **N. LlamaCppBackend FFI** (pro lokální inference bez NVIDIA NIM) | ~200 řádků | P2 |

**Celkem k napsání:** ~8800 řádků (z toho ~3000 P0 pro MVP)

---

## 2. Agent hierarchie (41 agentů)

```
                    ┌─────────────┐
                    │   Maestro   │  (root orchestrator)
                    │   (1×)      │
                    └──────┬──────┘
                           │
        ┌──────┬───────┬───┴───┬───────┬───────┬───────┐
        ▼      ▼       ▼       ▼       ▼       ▼       ▼
     ┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌───────┐
     │ L1  ││ L2  ││ L3  ││ L4  ││ L5  ││ L6  ││System │
     │(7)  ││(6)  ││(6)  ││(1)  ││(1)  ││(1)  ││ (5)   │
     └─────┘└─────┘└─────┘└─────┘└─────┘└─────┘└───────┘
```

| Layer | Agent | Sub-Agents | Počet |
|-------|-------|-----------|-------|
| **L1** | Node+Miner | NodeSync, NodeConsensus, PoolWorkers, PoolEconomics, MinerThermal, MinerPerformance, WalletOps | 7 |
| **L2** | Bridge+DAO | BridgeValidators, BridgeWatcher, DaoProposals, DaoTreasury, SwapExecutor, SwapMarket | 6 |
| **L3** | NCL+WARP+AI | NclScheduler, NclMarket, WarpRouter, WarpValidators, AiNativeRuntime, AiNativeMemory | 6 |
| **L4** | Oasis | OasisManager | 1 |
| **L5** | FreeWorld | FreeWorldOps | 1 |
| **L6** | Issobella | IsobellaOps | 1 |
| **System** | System | DockerHealth, PrometheusAlerts, ResourceOptimizer, BackupManager, UpdateEngine | 5 |
| **Total** | | | **41** |

---

## 3. Tool Registry — 37 tools

### L1 Tools (12)
1. `zion_rpc_getblockcount` — POST node:8443/rpc
2. `zion_rpc_getnetworkinfo` — peers, sync status
3. `zion_rpc_getmininginfo` — difficulty, hashrate, block reward
4. `zion_rpc_getaccountbalance` — address balance (account + UTXO)
5. `zion_rpc_getsupplyinfo` — supply data
6. `zion_rpc_getpeerinfo` — peer list
7. `zion_node_ctrl` — start/stop/restart node
8. `zion_miner_ctrl` — start/stop/set_algorithm
9. `zion_miner_benchmark` — benchmark all 3 algorithms (30s each)
10. `zion_miner_get_temps` — GPU temperatures
11. `zion_wallet_ops` — UTXO management, TX building
12. `zion_pool_get_sessions` — active stratum sessions

### L2 Tools (8)
13. `zion_bridge_get_validators` — 3/5 consensus status
14. `zion_bridge_track_tx` — cross-chain TX tracking
15. `zion_dao_get_proposals` — active proposals
16. `zion_dao_get_treasury` — treasury balance + tithe
17. `zion_dao_vote` — voting (with confirmation)
18. `zion_swap_status` — atomic swap status
19. `zion_swap_execute` — HTLC execution
20. `zion_swap_market_rates` — liquidity data

### L3 Tools (6)
21. `zion_ncl_list_providers` — AI compute providers
22. `zion_ncl_submit_job` — job scheduling
23. `zion_warp_get_routes` — 7-chain routing
24. `zion_warp_status` — adapter health
25. `zion_ai_native_get_state` — consciousness, memory state
26. `zion_ai_native_query` — RAG retrieval

### L4–L6 Tools (6)
27. `zion_oasis_economy_status` — game economy
28. `zion_oasis_npc_quality` — NPC AI quality
29. `zion_free_world_donation_status` — fund status
30. `zion_free_world_impact_report` — humanitarian metrics
31. `zion_issobella_link_status` — satellite links
32. `zion_issobella_data_quality` — orbital data

### System Tools (5)
33. `docker_list_containers` — list all containers
34. `docker_restart_container` — restart service
35. `prometheus_query` — metrics query
36. `prometheus_alerts` — active alerts
37. `backup_trigger` — manual backup

**Tool signature (JSON Schema):**
```json
{
  "name": "zion_rpc_getblockcount",
  "endpoint": "http://node:8443/rpc",
  "method": "POST",
  "input_schema": {},
  "output_schema": {"result": "integer", "error": "string|null"},
  "timeout_ms": 5000,
  "retry": 2,
  "sub_agent": "NodeSync"
}
```

---

## 4. Service Mesh — health check matrix

| Service | Type | Port | Health Check | Poll Freq | Action on Fail |
|---------|------|------|--------------|-----------|----------------|
| zion-node (primary) | L1_NODE | 8333 P2P, 9443 RPC | `getblockcount` | 10s | Restart, alert if 3× |
| zion-node (follower) | L1_NODE | 8334 P2P, 8448 RPC | `getblockcount` | 10s | Restart |
| zion-pool | L1_POOL | 8444 Stratum | `/health` | 10s | Restart, check firewall |
| zion-miner | L1_MINER | — (process) | Process alive + hashrate | 30s | Restart s fallback algo |
| zion-bridge | L2_BRIDGE | 9101 metrics | `/validators` | 60s | Alert, propose replacement |
| zion-dao | L2_DAO | 8450 | `/proposals` | 60s | Restart |
| zion-atomic-swap | L2_SWAP | 8452 | `/health` | 60s | Restart |
| zion-warp | L3_WARP | 8453 | `/routes` | 60s | Restart |
| zion-dex | L3_DEX | 8454 | `/health` | 60s | Restart |
| zion-oasis | L4_OASIS | 8094 | `/health` | 30s | Restart |
| zion-free-world | L5_FREEWORLD | 8095 | `/health` | 30s | Restart |
| zion-issobella | L6_ISOBELLA | 8096 | `/health` | 60s | Restart |
| zion-web | WEB | 3000 (Docker) | HTTP 200 `/health` | 30s | Restart container |
| zion-dashboard | DASH | 8766 | WebSocket | 60s | Reload |
| hiran-orchestrator | HIRAN | 8004 REST, 8005 gRPC | `/health` | 10s | Restart |
| hiran-inference | INFRA | 8002 | `/health` | 10s | Fallback na echo backend |
| prometheus | INFRA | 9090 | HTTP 200 | 60s | Alert |

---

## 5. E2E testy (3 definované v PROPOSAL_v2.4.md)

### Test 1: „Je vše zdravé?" (System Health)
```
User → Maestro → Intent: SystemHealth
├── L1 Agent: getblockcount, getnetworkinfo, getpeerinfo
├── L1 Agent: pool /health, worker stats
├── L2 Agent: bridge validators (3/5 check)
├── L3 Agent: WARP routes, NCL providers
├── L4–L6 Agents: Oasis, FreeWorld, Issobella health
└── System Agent: Docker container status
→ Aggregate → Natural language response
```

### Test 2: „Začni těžit optimálně" (Miner Optimization)
```
User → Maestro → Intent: MinerControl + Optimize
├── Benchmark all 3 algorithms (30s each)
├── Check GPU thermal status
├── Calculate profitability ($/kWh vs ZION earnings)
├── Select best algorithm
├── Start miner with optimal params
└── Report: hashrate, temp, est. daily earnings
```

### Test 3: Emergency Bridge Alert
```
Alertmanager fires: bridge.active_validators < 4
→ Maestro receives (priority: CRITICAL)
├── BridgeValidators.check_consensus()
├── If 3/5: Alert user, do NOT rotate
├── If 2/5: Trigger emergency validator rotation
└── Notify bridge operators
```

---

## 6. Vývojové fáze (revised podle existujícího kódu)

### Fáze 1: Foundation Extension (2–3 týdny) — P0

| Krok | Co | Soubor | Estimace |
|------|-----|--------|----------|
| 1.1 | **Intent Router** — Intent enum, klasifikace user input | `intent.rs` (nový) | 300 řádků |
| 1.2 | **Planner Engine** — task graph, dependency resolution | `planner.rs` (nový) | 400 řádků |
| 1.3 | **Hierarchical Agent Dispatch** — rozšířit orchestrator.rs | `orchestrator.rs` (edit) | +500 řádků |
| 1.4 | **Tool Registry** — 37 tools, JSON Schema, dispatch | `tool_registry.rs` (nový) | 800 řádků |
| 1.5 | **Service Mesh Health Poller** — polling všech 17 services | `health_poller.rs` (nový) | 400 řádků |
| 1.6 | **Layer Agents** (L1–L6 + System = 7) — skeleton s dispatch | `layer_agents.rs` (nový) | 1500 řádků |

**Kritérium:** crate kompiluje, Intent Router klasifikuje 10 intentů s >90% přesností, health poller monitoruje Edge services

### Fáze 2: MVP Integration (2–3 týdny) — P0

| Krok | Co | Soubor | Estimace |
|------|-----|--------|----------|
| 2.1 | **L1 Sub-Agents** (7) — NodeSync, PoolWorkers, MinerThermal, ... | `sub_agents_l1.rs` (nový) | 800 řádků |
| 2.2 | **L2 Sub-Agents** (6) — BridgeValidators, DaoProposals, ... | `sub_agents_l2.rs` (nový) | 700 řádků |
| 2.3 | **System Sub-Agents** (5) — DockerHealth, PrometheusAlerts, ... | `sub_agents_system.rs` (nový) | 500 řádků |
| 2.4 | **Auto-remediation rules engine** (YAML) | `remediation.rs` (nový) | 300 řádků |
| 2.5 | **Audit Log** (immutable, SQLite) | `audit_log.rs` (nový) | 200 řádků |
| 2.6 | **E2E Test 1: „Je vše zdravé?"** | `tests/e2e_health.rs` | 200 řádků |

**Kritérium:** Test 1 PASS — Maestro odpoví na „Je vše zdravé?" agregovaným health reportem z reálných Edge services

### Fáze 3: Production Features (3–4 týdny) — P1

| Krok | Co | Soubor | Estimace |
|------|-----|--------|----------|
| 3.1 | **L3–L6 Sub-Agents** (zbývajících 20) | `sub_agents_l3456.rs` | 1000 řádků |
| 3.2 | **gRPC transport** (Maestro ↔ Layer Agents) | `grpc_transport.rs` | 400 řádků |
| 3.3 | **Emergency Response** (critical alert router) | `emergency.rs` | 300 řádků |
| 3.4 | **CLI `zion agent`** (run, session, monitor, review) | `V3/L1/cli/src/agent_cmd.rs` | 600 řádků |
| 3.5 | **E2E Test 2: „Začni těžit"** | `tests/e2e_mine.rs` | 200 řádků |
| 3.6 | **E2E Test 3: Emergency bridge alert** | `tests/e2e_bridge_alert.rs` | 200 řádků |
| 3.7 | **Human approval gate** (kritické operace) | `approval_gate.rs` | 200 řádků |

**Kritérium:** 3 E2E testy PASS, auto-remediation 90% úspěšnost, CLI funkční

### Fáze 4: Hardening (2 týdny) — P2

| Krok | Co | Soubor | Estimace |
|------|-----|--------|----------|
| 4.1 | **LlamaCppBackend FFI** (lokální inference bez NVIDIA NIM) | `llm_backend.rs` (edit) | +200 řádků |
| 4.2 | **Dashboard integration** (orchestrator tab) | `APP&WEB/...` | 400 řádků |
| 4.3 | **Load test** (100 concurrent users) | `tests/load_test.rs` | 200 řádků |
| 4.4 | **Security audit** (Dharma Validator bypass test) | `tests/security.rs` | 200 řádků |

**Kritérium:** 41 agentů aktivních, 0 Dharma Validator bypass, audit log kompletní, dashboard live

---

## 7. CLI interface (`zion agent`)

```bash
# Task execution
zion agent run "<task>"              # autonomous task
zion agent run --plan-only "<task>"  # show plan, ask before execute
zion agent run --file task.md        # read from markdown

# Interactive session
zion agent session                   # REPL-like session

# Code review
zion agent review                    # review working tree
zion agent review --branch feat-xyz  # review branch vs main

# Monitoring & ops
zion agent monitor                   # start monitoring daemon
zion agent monitor --watch node,pool # watch specific services
zion agent train-status              # check remote training
zion agent checkpoint-backup         # pull & verify checkpoint

# Memory & config
zion agent memory                    # show what agent knows
zion agent memory --forget "old task"# remove from memory
zion agent config                    # agent settings

# Safety
zion agent approve                   # approve pending action
zion agent cancel                    # cancel running task
```

---

## 8. Inference backend strategie (bez GPU nákupu)

| Backend | Kdy | Náklad | Latence |
|---------|-----|--------|---------|
| **EchoBackend** (existuje) | development, unit testy | $0 | ~0ms |
| **RemoteHttpBackend → NVIDIA NIM cloud** | production reasoning | $0.30/hod | ~500ms |
| **RemoteHttpBackend → Vast A100** | Hiran v2.3 inference testy | $0.30/hod | ~200ms |
| **LlamaCppBackend FFI** (chybí) | lokální inference na Spark (Q1 2027) | $0 | ~50ms |
| **CPU Q4_K_M** (pomalé) | fallback | $0 | ~2 t/s |

**Strategie:** pro v2.4 development použít EchoBackend pro unit testy + RemoteHttpBackend (Vast A100) pro integration testy. Na Sparku pak LlamaCppBackend FFI.

---

## 9. Edge deployment (co nasadit na 62.171.141.136)

**Aktuální stav (z průzkumu):** na Edge neběží Hiran inference (porty 8001/8002/11434 definované v docker-compose ale nespuštěné). ai-native crate je kompilován ale API není nasazené.

| Krok | Co | Port | Stav |
|------|-----|------|------|
| E1 | Nasadit `zion-ai-native-api` binárku na Edge | 8001 | ❌ chybí |
| E2 | Nasadit Hiran v2.3 inference (cloud proxy na Vast A100) | 8002 | ❌ chybí |
| E3 | Přidat `hiran` profil do docker-compose na Edge | — | definováno, nespuštěno |
| E4 | Propojit L4 Oasis, L5 Free World, L6 Issobella na Hiran | — | depends_on definováno, ale Hiran neběží |
| E5 | Dashboard orchestrator tab | 8766 | ❌ chybí |

**Pořadí:** E1 (ai-native API) → E2 (inference proxy) → E4 (L4–L6 propojení) → E5 (dashboard)

---

## 10. Akční kroky (co dělat hned)

1. **Ověřit build ai-native crate** na současném stroji (`cargo build -p ai-native`)
2. **Napsat Intent Router** (`intent.rs`) — první P0 komponenta
3. **Napsat Tool Registry** (`tool_registry.rs`) — druhá P0 komponenta
4. **Rozšířit orchestrator.rs** o hierarchical dispatch
5. **Napsat health poller** a otestovat proti Edge services
6. **Nasadit ai-native API na Edge** (port 8001)
7. **E2E Test 1: „Je vše zdravé?"**

---

## 11. Zdroje

- `V3/L3/ai-native/` — existující crate (9925 řádků)
- `HiranV2.4/PROPOSAL_v2.4.md` — vision, UX příklady
- `HiranV2.4/ARCHITECTURE_v2.4.md` — technická architektura
- `HiranV2.4/AGENT_HIERARCHY_v2.4.md` — 41 agentů
- `HiranV2.4/SERVICE_MESH_v2.4.md` — service mesh
- `HiranV2.4/TOOL_REGISTRY_v2.4.md` — 37 tools
- `docs/3.0.1Genesis/HIRAN_CLI_PLAN.md` — `zion agent` CLI spec
- `docs/3.0.5/archive-root-md/HIRAN_EVOLUTION_2.3_TO_2.5_AMATHABOJ.md` — fáze 2 a 3
- `HIRAN_HARDWARE_ROADMAP.md` — hardware plán
