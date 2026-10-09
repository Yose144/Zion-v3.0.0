# Hiran 2.4 — Maestro Wiring Map (verified against live Edge)

> 2026-10-09. Ground truth: `ss -tlnp` + `systemctl` on Edge (62.171.141.136).
> Code: `V31/L3/ai-native` (29 modulů, ~17k ř.) — lokální strom = kanonický.

## 1. Stav implementace — co už existuje

| Komponenta | Soubor | Řádků | Stav |
|---|---|---|---|
| **Maestro** (intent→plan→DAG exec) | `src/maestro.rs` | 537 | ✅ kompletní — topological order, dep-skip, critical-fail, PartialSuccess |
| **Maestro CLI** | `src/bin/maestro.rs` | 205 | ✅ `orchestrate/classify/plan/health/info` → JSON stdout |
| Tool registry | `src/tool_registry.rs` | 1554 | ✅ 60+ tools, reqwest executor, retry+timeout per tool, approval flags |
| Health poller | `src/health_poller.rs` | 919 | ✅ 26 probes (HttpGet/TcpConnect), HealthMatrix + overall() |
| Layer agents | `src/layer_agents.rs` | 613 | ✅ 7 vrstev (L1–L6+System), parallel tool exec per step |
| Planner | `src/planner.rs` | 829 | ✅ intent→PlanStep templates, DAG, approval marks |
| Intent router | `src/intent.rs` | 996 | ✅ rule-based classifier (+LLM fallback ready) |
| Orchestrator (legacy agent registry) | `src/orchestrator.rs` | 923 | ✅ agents, NCL marketplace, warp router, emergency stop, `with_audit_dir` |
| Telemetry→optimizer | `src/telemetry.rs` | 420 | ✅ pool `/stats` → PoolOptimizer |
| REST API | `src/bin/zion-ai-native-api.rs` | 1211 | ✅ deployed :8001 — ale **Maestro NENÍ mountnutý** |

**Klíčový gap:** Maestro existuje jen jako CLI. `zion-ai-native-api` (:8001)
exposes starší Orchestrator + RAG + NCL router; `hiran-orchestrator` :8004
v health_poller neexistuje → port volný pro dedikovaný Maestro servis.

## 2. Live Edge topology vs code consts — DIFF

`tool_registry.rs` + `health_poller.rs` mají hardcoded porty — ověřeno proti
live `ss`/`systemctl` (2026-10-09):

| Service | Code port | **Live port** | Stav |
|---|---|---|---|
| node1 RPC | 9445 | **9445** ✓ (`zion-node --rpc 127.0.0.1:9445`) | OK |
| node1 P2P | 8333 | **8335** ❌ | fix |
| node1 metrics | 9100 | 9100 ⚠️ listening (owner unverified) | verify |
| node2 RPC | 8448 | **9446** ❌ | fix |
| node2 P2P | 8334 | **8336** ❌ | fix |
| node2 metrics | 9116 | — ❌ dead | remove/remap 9105 |
| **node3** | — | **9447 RPC / 8337 P2P** ❌ chybí | add |
| pool stratum | 8444 | **8444** ✓ (0.0.0.0 public) | OK |
| POOL_API | 8080 | **8080** ✓ (`zion-pool` owns 8080) | OK |
| POOL_STATS_API | 8455 | **8080** ❌ (8455 dead) | fix →8080 |
| BRIDGE_API | 9101 | — ❌ dead (bridge = warpd) | remove/remap 8453 |
| DAO_API | 8450 | **8456** ❌ (`DAO_API_PORT=8456`, `zion-dao` running) | fix |
| SWAP_API | 8452 | **8454** ❌ (swap API = warpd listen_port+1) | fix |
| WARP_API | 8453 | **8453** ✓ (warpd) | OK |
| DEX_API | 8454 | **8454** ✓ (warpd api server) | OK |
| NCL_API | 8080 | in-proc router on **:8001** (`/ncl/*`) | remap →8001 |
| OASIS_API | 8094 | **8094** ✓ + metrics **9102** ✓ | OK |
| FREE_WORLD_API | 8095 | **8095** ✓ | OK |
| ISOBELLA_API | 8096 | **8097** ❌ (`ISSOBELLA_PORT=8097`) | fix |
| HIRAN_ORCH | 8004 | — volný (cíl pro Maestro HTTP) | new |
| HIRAN_INFER | 8002 | ⚠️ **současně drží `sshd` tunnel** — inference běžela tunelovaná z lokální GPU boxu (`zion-hiran-tunnel` key) → po ztrátě mrtvé | reclaim |
| PROMETHEUS | 9090 | **9090** ✓ (prometheus proc; `/` 404 normální — použít `/-/healthy`) | verify path |
| DASHBOARD_API | 8766 | **8766** ✓ | OK |
| web-next | 3000 | **3000** ✓ (zion-website) | OK |
| nginx 80/443 | 80/443 | ✓ (**8443 = nginx proxy**, ne samostatná služba) | OK |
| docker | 2375 | ❌ not exposed (správně — security) | drop probe / socket check |

### Služby živé, ale v probe mapě chybí

`zion-quantus-node` (RPC **:9944 [::1]**, P2P :30333, QUIC miner — port
neviditelný v ss, ověřit), `zion-bitcoind` :8332 + regtest :18443,
`zion-zis` (identity), `zion-marketplace` :3100, `zion-db-sync`,
`zion-pool-wedgewatch`, `zion-g8-{probe,alert-sink}` (:9094/:9105/:8779 python),
`zion-btcunlock-coord`, `zion-website` :3000. **Backup timer** (user systemd).

## 3. Robustní wiring — návrh

### 3.1 Endpoint config (hardcoded → env)

Všechny consts → `env` override s live defaults:

```
ZION_NODE{1,2,3}_RPC   http://127.0.0.1:944{5,6,7}
ZION_NODE{1,2,3}_P2P   127.0.0.1:833{5,6,7}
ZION_POOL_API          http://127.0.0.1:8080
ZION_DAO_API           http://127.0.0.1:8456
ZION_WARP_API          http://127.0.0.1:8453
ZION_DEX_API           http://127.0.0.1:8454   (= SWAP)
ZION_OASIS_API/FREE_WORLD_API/ISOBELLA_API  :8094/:8095/:8097
ZION_QUANTUS_RPC       http://127.0.0.1:9944   (nový — L1-adjacent)
HIRAN_INFERENCE_URL    http://127.0.0.1:8002
```

Implementace: `Endpoints::from_env()` builder sdílený `health_poller` +
`tool_registry` (single source — žádné duplicitní consts).

### 3.2 Maestro surface — doporučení: mount in-process na :8001

Dva varianty:
- **A (doporučeno):** přidat do `zion-ai-native-api` routy
  `POST /v2/orchestrate`, `POST /v2/plan`, `GET /v2/health-matrix`,
  `GET /v2/info` — sdílí ToolRegistry + health cache + jedna systemd unit.
  Gate: `HIRAN_MAESTRO_ENABLED=1`.
- **B:** standalone `:8004` service (zodpovídá existujícímu probe) — izolace,
  ale další binárka+unit. Nechat jako pozdější split.

CLI `maestro` zůstává pro ops/debug.

### 3.3 Mutation gate (fail-closed)

`execute_plan` dnes auto-approves `requires_approval` (MVP comment). Navrženo:

- `HIRAN_MAESTRO_MUTATIONS=0` (default) → mutating tools (`HttpMethod::Post`/
  `Put`/`Delete` na control endpoints + `approval_required_tools()`)
  **odmítnuty** s `StepStatus::Skipped{reason:"mutations disabled"}`.
- `=1` → mutace povoleny jen s `X-Maestro-Approve: <token>` headerem
  (`MAESTRO_APPROVAL_TOKEN` env), per-call auditováno.
- Read-only profil je default → **žádný LLM/plan nemůže omylem restartovat
  pool nebo poslat payout**.

### 3.4 Audit + durability

- `ZION_L3_AUDIT_DIR=/opt/zion/data/l3-audit` → JSONL per plan execution
  (plan, step_results, latency, approvals). `orchestrator.rs::with_audit_dir`
  vzor. Rotace + zahrnutí do `zion-backup.sh` DB staging.
- Health matrix cache TTL 30 s + last-good fallback (fail-soft read).

### 3.5 Resilience

- ToolExecutor už má per-tool retry+timeout — doplnit **per-service circuit
  breaker** (3 fail za 60 s → open 120 s → skip s degraded status) a globální
  concurrency cap (semaphore ~8) na step tools.
- `compose_response` MVP → LLM synthesis přes `hiran_inference` client s
  **template fallback** (dnešní text) když model down.
- Dharma Validator stub → pre-check před mutating step, post-check po.
- systemd: `zion-v31-ai-native` už má NoNewPrivileges/PrivateTmp/MemoryMax
  — doplnit `Restart=always`→on-failure drží, watchdog `TimeoutStartSec`,
  `systemctl is-active` probe pro služby bez portu (miner, db-sync).

### 3.6 Nové probes (pokrytí)

Přidat do `SERVICES`: node3-rpc/p2p, quantus-rpc (9944 `/health` — ověřit path),
bitcoind :8332, zis, marketplace :3100, backup timer (probe přes soubor
`last-status.json` mtime nebo `systemctl --user`), plus `systemd`-type probe
pro portless služby (v31-miner, db-sync, wedgewatch, g8-*).

Odebrat/přemapovat: 8450→8456, 8452→8454, 8096→8097, 8448→9446,
8333→8335, 8334→8336, 8455→8080, 9101→8453(/metrics pokud existuje) nebo drop,
9116→9105 (verify), 2375 → drop (docker socket není tcp).

## 4. Flow po zapojení (cílový stav)

```
dashboard/CLI/user
  │ POST /v2/orchestrate {"q":"why is pool share down?"}
  ▼
zion-ai-native-api :8001 ── HIRAN_MAESTRO_ENABLED
  │ Maestro.orchestrate()
  │   IntentRouter (rule → LLM upgrade path)
  │   Planner → ExecutionPlan (DAG)
  │   [Dharma pre-check] [approval gate na mutace]
  │   LayerAgentRegistry.execute_step → ToolExecutor (retry/timeout/breaker)
  │      → live Edge services (mapa §2 — opravené porty)
  │   compose_response (LLM synthesis → template fallback)
  │   audit JSONL → l3-audit/
  ▼
PlanExecutionResult → caller + health_poller background refresh (30 s TTL)
```

## 5. Ověření (když se implementuje)

1. `cargo test -p zion-ai-native` (maestro/health_poller/tool_registry suity)
2. `maestro health` na Edge — matrix musí ukázat ≥90 % Healthy po opravě portů
3. `POST /v2/plan` read-only intents → Success; mutating bez tokenu → Skipped
4. Kill jedné služby → probe Degraded, breaker open, plan PartialSuccess
5. `zion-backup` staging zahrnuje l3-audit JSONL

## 6. Rozdíl design vs realita

`SERVICE_MESH_v2.4.md` počítal s docker-compose stackem (porty 8443/8545/8081,
auto-registrace). Realita je systemd na Edge s jinými porty — service
mesh/discovery zůstává v2.5 scope; v2.4 použije statickou env mapu (§3.1).
