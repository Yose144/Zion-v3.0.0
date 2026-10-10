# HiranInterface.md — Hiran (Hiranyagarbha) Interface Contract

> **2026-10-10 · Maestro 2.4 prep.** Kanonická specifikace rozhraní, přes které
> Hiran mluví se světem: inference API, orchestrace `/v2`, AI-facing endpointy
> ve službách, env wiring a deployment topologie.
> Strojová data: **`Hiran/2.4/service-map.json`** · audit: `Hiran/2.4/AUDIT_2026-10-10.md`.

## 1. Topologie

```
klienti: desktop-agent · dashboard · CLI · L4/L5/L6 služby
        │
        ▼  Edge 62.171.141.136
┌─ :8001 zion-ai-native-api (Hiranyagarbha, RAG, /v2 Maestro) ─┐
│  LLM_BASE_URL=http://127.0.0.1:8002/v1  LLM_MODEL=zion-l3  │
└──────────────────────────┬─────────────────────────────────┘
                           ▼
        :8002 ←── ssh reverse tunnel (hirantunnel@edge:2222)
                           │
        ▼  lokální rig (Vega64 gfx900 8G + RX5600XT gfx1010 6G)
   llama-server :8002  Qwen3-8B Q5_K_M   → Maestro core / reasoning
   llama-server :8012  Qwen3-4B/1.7B     → intent router / syntéza
```

Tunnel už existuje — stačí nasměrovat `-R 8002:127.0.0.1:8002` na core
server. Backend: **llama.cpp Vulkan** (gfx900/gfx1010, viz audit §6).

## 2. Inference API — `:8002` (OpenAI-compatible)

| Endpoint | Metoda | Kontrakt |
|---|---|---|
| `/v1/models` | GET | seznam modelů (aliasy níže) |
| `/v1/chat/completions` | POST | `{model, messages[], temperature, max_tokens}` → `choices[0].message.content` |
| `/v1/embeddings` | POST | `{input}` → `data[0].embedding` |
| `/health` | GET | liveness |
| `/completion` | POST | llama.cpp legacy `{prompt, n_predict}` |

**Model aliasy (povinné):** `zion-l3` (primary — tak ho volá `:8001`),
`hiran-v2.2` (tak ho volá desktop-agent `ai-chat-ask`).

**Konzumenti:** `:8001` (`LLM_BASE_URL` → `RemoteHttpBackend` /
`HiranInferenceClient`), desktop-agent IPC `ai-chat-ask`
(`HIRAN_INFERENCE_URL`, default `http://localhost:8002`).

## 3. Hiranyagarbha API — `:8001` (live)

Existující: `/health /status /config · POST /chat /rag/{index,query,autotune}
/tasks(/dispatch) /agents(/:id/*) /orchestrator/status /warp/status
/ncl/* (router) /oasis/status /telemetry · POST /optimizer/run`.

### `/v2` — Maestro (plánovaný mount, varianta A: sdílený AppState)

| Endpoint | Metoda | Vstup → Výstup |
|---|---|---|
| `/v2/orchestrate` | POST | `{q}` → `PlanExecutionResult` (plan, step_results, skipped, status Success/PartialSuccess/Failed/Cancelled, response) |
| `/v2/plan` | POST | `{q}` nebo `{intent}` → `ExecutionPlan` (DAG, requires_approval) |
| `/v2/classify` | POST | `{q}` → `{intent, confidence, source}` |
| `/v2/health-matrix` | GET | → `HealthMatrix` (26+ probes, 30 s cache + last-good) |
| `/v2/info` | GET | → maestro verze, tool count, enabled flags |
| `/v2/tools`, `/v2/tools/:name` | GET | → tool specy (schema, approval flag) |

**Mutation gate (fail-closed):**
- `HIRAN_MAESTRO_ENABLED=1` — mount zapnutý
- `HIRAN_MAESTRO_MUTATIONS=0` (default) → mutating steps (`requires_approval`
  tools + Post/Put/Delete na control endpoints) = `Skipped{reason:"mutations disabled"}`
- `=1` → mutace jen s headerem `X-Maestro-Approve: $MAESTRO_APPROVAL_TOKEN`,
  per-call auditováno do `ZION_L3_AUDIT_DIR` (JSONL: plan, steps, approvals,
  latency).

## 4. AI-facing endpointy ve službách (existují — stačí env)

| Služba | Env k zapnutí | Endpointy |
|---|---|---|
| OASIS :8094 | `OASIS_HIRAN_URL=http://127.0.0.1:8001` + `OASIS_HIRAN_ENABLED=1` | `POST /api/v1/oasis/ai/{hiran-health,npc-dialogue,quest-narrative}` |
| Issobella :8097 | `ISSOBELLA_HIRAN_URL=http://127.0.0.1:8001` + `ISSOBELLA_HIRAN_ENABLED=1` | `POST /api/v1/ai/{hiran-health,analyze-proposal,evaluate-mission,optimize-network}`, `GET /api/v1/ai/mission-log` |
| Free-World :8095 | (vestavěné) | `/ai/{analyze-grant,suggest-projects}` |

Volají `:8001` (`/chat` + RAG); při nedostupném LLM vrací
`{enabled:true, reachable:false}` / degraded odpověď — fail-soft.

## 5. Service endpoints (orchestrace čte z `service-map.json`)

Klíčové: node1/2/3 RPC `:9445/9446/9447` (JSON-RPC **camelCase**:
`getChainInfo getNodeInfo getPeerInfo getNetworkStats getSupplyInfo
getAccountBalance getMempoolInfo …`), node P2P `:8335-8337`,
pool API `:8080` (`/stats /miners /blocks`, auth `/api/v1/*`), stratum
`:8444`, warp `:8453` + dex `:8454` (warpd), dao `:8456` (`/api/dao/*`),
quantus `:9944` (substrate RPC `system_health`) + `:9615` metrics,
bitcoind `:8332` / regtest `:18443`, zis `:8096`, dashboard `:8766`,
prometheus `:9090`, alertmanager `:9093`, g8 `:9105/:9094`, grafana
`:3001`, website `:3000`, marketplace `:3100`, nginx `80/443/8443`,
postgres `:5432`.

## 6. Env blok (single source — `Endpoints::from_env()`)

```
ZION_NODE1_RPC=http://127.0.0.1:9445  ZION_NODE1_P2P=127.0.0.1:8335
ZION_NODE2_RPC=http://127.0.0.1:9446  ZION_NODE2_P2P=127.0.0.1:8336
ZION_NODE3_RPC=http://127.0.0.1:9447  ZION_NODE3_P2P=127.0.0.1:8337
ZION_POOL_API=http://127.0.0.1:8080   ZION_DAO_API=http://127.0.0.1:8456
ZION_WARP_API=http://127.0.0.1:8453   ZION_DEX_API=http://127.0.0.1:8454
ZION_OASIS_API=http://127.0.0.1:8094  ZION_FREE_WORLD_API=http://127.0.0.1:8095
ZION_ISOBELLA_API=http://127.0.0.1:8097  ZION_ZIS_API=http://127.0.0.1:8096
ZION_QUANTUS_RPC=http://127.0.0.1:9944
ZION_DASHBOARD_API=http://127.0.0.1:8766  ZION_PROMETHEUS_API=http://127.0.0.1:9090
HIRAN_INFERENCE_URL=http://127.0.0.1:8002  LLM_BASE_URL=http://127.0.0.1:8002/v1
LLM_MODEL=zion-l3
HIRANYAGARBHA_BIND=127.0.0.1:8001  HIRAN_MAESTRO_ENABLED=1
HIRAN_MAESTRO_MUTATIONS=0  MAESTRO_APPROVAL_TOKEN=<secret>
ZION_L3_AUDIT_DIR=/opt/zion/data/l3-audit
# aktivace AI-facing v L4/L6:
OASIS_HIRAN_URL=http://127.0.0.1:8001  OASIS_HIRAN_ENABLED=1
ISSOBELLA_HIRAN_URL=http://127.0.0.1:8001  ISSOBELLA_HIRAN_ENABLED=1
```

## 7. Ring model (authority)

- **Green (auto):** read-only tools — všechny GET + JSON-RPC read metody.
- **Yellow (token):** mutace — restart služby, vote, swap execute, tx submit,
  miner ctrl → vyžadují `X-Maestro-Approve` (gate §3).
- **Red (mimo scope):** fee split / emise / genesis / treasury spend —
  v2.4 neexportuje vůbec (DAO governance only).
