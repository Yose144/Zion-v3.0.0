# Hiran v2.4 Architecture — Zion Ecosystem Orchestrator

> **Codename:** Maestro  
> **Status:** Design Phase  
> **Date:** 2026-06-13  
> **Based on:** V3 workspace `zion-ai-native` crate + 20-crate Rust workspace + Docker Compose stack

---

## 1. Vision

Hiran v2.4 is the **central nervous system** of Zion OS. It does not replace any V3 service — it **orchestrates** them.

> If Zion OS is a city, Hiran v2.4 is the traffic control center + emergency response + city planner + public information desk combined.

### Relationship to V3

| V3 Component | Hiran v2.4 Role |
|---|---|
| `L1/core` (node, blockchain) | Monitor sync, peer health, restart on lag |
| `L1/pool` (stratum server) | Monitor workers, adjust difficulty, payout alerts |
| `L1/miner` (GPU/CPU miner) | Auto-algo select, thermal management, benchmark |
| `L2/bridge` (wZION bridge) | Monitor validators, track cross-chain txs |
| `L2/dao` (governance) | Analyze proposals, treasury alerts, vote recommendations |
| `L3/ncl` (AI compute marketplace) | Schedule compute jobs, optimize pricing |
| `L3/warp` (7-chain bridge) | Route cross-chain ops, monitor adapters |
| `L3/ai-native` (agent framework) | **Foundation — v2.4 upgrades this** |
| `L4/oasis` (game server) | Monitor player economy, NPC AI quality |
| `L5/free-world` (humanitarian) | Track donations, report impact metrics |
| `L6/issobella` (space layer) | Monitor satellite links, orbital data |
| `cli` (22 commands) | All CLI ops become natural language commands |
| Docker stack (11 services) | Health monitoring, auto-remediation, resource optimization |

---

## 2. High-Level Architecture

```
                    User Input Layer
              (Chat, Voice, CLI, API, Events)
                           │
                           ▼
         ┌─────────────────────────────────────┐
         │      HIRAN v2.4 ORCHESTRATOR        │
         │         (Maestro Core)              │
         ├─────────────────────────────────────┤
         │  ┌────────┐ ┌────────┐ ┌────────┐  │
         │  │Intent  │ │Planner │ │Context │  │
         │  │Router  │ │Engine  │ │Manager │  │
         │  └───┬────┘ └────┬───┘ └────┬───┘  │
         │      └───────────┼──────────┘       │
         │                  │                    │
         │  ┌───────────────┴───────────────┐   │
         │  │     Agent Dispatch Layer      │   │
         │  │  (specialist agent selection)  │   │
         │  └───────────────┬───────────────┘   │
         └──────────────────┼───────────────────┘
                            │
         ┌──────────────────┼───────────────────┐
         │                  │                   │
         ▼                  ▼                   ▼
    ┌─────────┐      ┌──────────┐       ┌──────────┐
    │ L1 Agent │      │ L2 Agent  │       │ L3 Agent  │
    │(Node+   │      │(Bridge+  │       │(NCL+WARP+│
    │ Miner)  │      │ DAO)     │       │ AI-native)│
    └────┬────┘      └────┬─────┘       └─────┬─────┘
         │                │                    │
    ┌────┴────┐      ┌────┴─────┐       ┌────┴─────┐
    │ L1 Sub  │      │ L2 Sub   │       │ L3 Sub   │
    │ Agents  │      │ Agents   │       │ Agents   │
    │(Sync,   │      │(Valid8, │       │(Compute, │
    │ Pool,   │      │ Treasury,│       │ Router,  │
    │ Thermo) │      │ Prop)    │       │ Optim)   │
    └────┬────┘      └────┬─────┘       └────┬─────┘
         │                │                    │
         └────────────────┼────────────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │   V3 Service Bus    │
              │ (gRPC / NATS / HTTP)│
              └─────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
    ┌─────────┐    ┌──────────┐    ┌──────────┐
    │  V3 L1  │    │  V3 L2   │    │  V3 L3   │
    │Services │    │ Services │    │ Services │
    │node,   │    │bridge,  │    │ncl,     │
    │pool,   │    │dao,     │    │warp,    │
    │miner   │    │swap     │    │ai-native│
    └─────────┘    └──────────┘    └──────────┘
```

---

## 3. Core Components

### 3.1 Intent Router

Maps user input to the correct agent layer.

```rust
// V3 ai-native already has AgentCapability enum
// v2.4 extends it with orchestration-level routing

pub enum Intent {
    // L1 — Blockchain & Mining
    NodeStatus, NodeControl, MinerControl, PoolStatus,
    WalletQuery, WalletAction, BlockExplorer,
    
    // L2 — DeFi & Governance
    BridgeQuery, BridgeAction, DaoQuery, DaoVote,
    SwapQuery, SwapAction, TreasuryQuery,
    
    // L3 — AI & Cross-Chain
    NclJob, NclMarket, WarpRoute, WarpStatus,
    AiNativeQuery, AiNativeControl,
    
    // L4-L6 — Application Layers
    OasisQuery, OasisControl,
    FreeWorldQuery, FreeWorldAction,
    IsobellaQuery, IsobellaControl,
    
    // Meta — System-wide
    SystemHealth, SystemOptimize, SystemDeploy,
    EmergencyResponse, ReportGenerate,
}
```

### 3.2 Planner Engine

Decomposes complex goals into actionable sub-tasks with dependency graphs.

**Example:** "Set up a complete mining rig"

```yaml
plan_id: "setup_mining_rig_001"
goal: "Deploy node + pool + miner on single machine"
steps:
  - id: 1
    task: "Start zion-node"
    agent: "l1_node_agent"
    dependencies: []
    verify: "rpc.getblockcount > 0"
    
  - id: 2
    task: "Wait for sync (or use bootstrap)"
    agent: "l1_node_agent.sync_subagent"
    dependencies: [1]
    verify: "sync_status == 'synced' or blocks_behind < 10"
    
  - id: 3
    task: "Start zion-pool"
    agent: "l1_pool_agent"
    dependencies: [1]
    verify: "pool.healthcheck == 200"
    
  - id: 4
    task: "Benchmark GPU algorithms"
    agent: "l1_miner_agent"
    dependencies: [3]
    verify: "all 3 algorithms benchmarked"
    
  - id: 5
    task: "Start miner with optimal algo"
    agent: "l1_miner_agent"
    dependencies: [4]
    verify: "hashrate > 0 and temperature < 80C"
    
  - id: 6
    task: "Verify end-to-end"
    agent: "l1_pool_agent"
    dependencies: [5]
    verify: "worker accepted shares > 0"
```

### 3.3 Context Manager

Maintains conversation state + system state + user preferences.

| Context Type | Storage | TTL | Source |
|---|---|---|---|
| Conversation | Redis | Session | User chat |
| Active Tasks | Redis | Task lifetime | Planner |
| User Preferences | SQLite | Persistent | User settings |
| Service State | Prometheus | 15d | V3 metrics |
| Historical Incidents | ChromaDB | Persistent | Past events |
| Network Topology | SQLite | 1h | Auto-discovery |

---

## 4. Agent Hierarchy

Hiran v2.4 uses a **hierarchical multi-agent** architecture:

### Level 0: Maestro (Root Orchestrator)
- Single instance per deployment
- Owns the Intent Router, Planner, and Context Manager
- Dispatches to Layer Agents
- Never directly interacts with V3 services

### Level 1: Layer Agents (7 total)

| Agent | Scope | V3 Crates Managed |
|---|---|---|
| **L1 Agent** | Blockchain & Mining | `L1/core`, `L1/pool`, `L1/miner`, `L1/cosmic-harmony` |
| **L2 Agent** | DeFi & Governance | `L2/bridge`, `L2/dao`, `L2/atomic-swap` |
| **L3 Agent** | AI & Cross-Chain | `L3/ncl`, `L3/warp`, `L3/ai-native` |
| **L4 Agent** | Game & Metaverse | `L4/oasis` |
| **L5 Agent** | Humanitarian | `L5/free-world` |
| **L6 Agent** | Space & Edge | `L6/issobella` |
| **System Agent** | Infrastructure | Docker, monitoring, CLI |

### Level 2: Sub-Agents (specialist)

Each Layer Agent manages 3-8 Sub-Agents:

**L1 Sub-Agents:**
- `NodeSync` — sync status, peer management, bootstrap
- `NodeConsensus` — block validation, difficulty, emission
- `PoolWorkers` — stratum sessions, share validation, payouts
- `PoolEconomics` — fee split tracking, PPLNS, revenue
- `MinerThermal` — GPU temp, algorithm switching, cooling
- `MinerPerformance` — hashrate optimization, benchmark
- `WalletOps` — UTXO management, transaction building

**L2 Sub-Agents:**
- `BridgeValidators` — 3/5 consensus monitoring, rotation
- `BridgeWatcher` — L1↔EVM tx tracking, confirmations
- `DaoProposals` — proposal analysis, voting deadlines
- `DaoTreasury` — balance tracking, tithe verification
- `SwapExecutor` — HTLC lifecycle, refund handling
- `SwapMarket` — rate discovery, liquidity monitoring

**L3 Sub-Agents:**
- `NclScheduler` — compute job scheduling, pricing
- `NclMarket` — provider reputation, capacity tracking
- `WarpRouter` — 7-chain route optimization
- `WarpValidators` — adapter health, consensus
- `AiNativeRuntime` — consciousness engine, inference
- `AiNativeMemory` — RAG, episodic memory, knowledge base

**System Sub-Agents:**
- `DockerHealth` — container status, restart, logs
- `PrometheusAlerts` — metric thresholds, alert routing
- `ResourceOptimizer` — CPU/RAM/GPU allocation
- `BackupManager` — snapshot, off-site, recovery
- `UpdateEngine` — CLI auto-update, checksum verification

### Communication Protocol

```
Maestro ──gRPC──> Layer Agent ──internal bus──> Sub-Agent ──HTTP/gRPC──> V3 Service

Message format:
{
  "msg_id": "uuid",
  "from": "maestro",
  "to": "l1_agent.miner_thermal",
  "intent": "check_thermal_status",
  "payload": {"gpu_id": 0},
  "timeout_ms": 5000,
  "priority": "normal"  // normal | urgent | critical
}
```

---

## 5. Memory Architecture

Hiran v2.4 has a **4-tier memory system** (extends V3 `ai-native/src/memory.rs`):

### Tier 1: Working Memory (Redis, <1s latency)
- Current conversation turn
- Active task state
- Real-time metrics cache

### Tier 2: Episodic Memory (SQLite + ChromaDB, <10ms)
- Past user sessions
- Successful/failed plans
- Incident reports and resolutions

### Tier 3: Semantic Memory (ChromaDB + RAG, <100ms)
- Zion documentation (indexed)
- Constitutional parameters
- Whitepapers and technical docs

### Tier 4: Constitutional Memory (Immutable, in-context)
- Fee split: 89/5/5/1
- Emission schedule
- Genesis block hash
- Canonical wallet addresses
- Never changes without governance

---

## 6. Inference Architecture

### Model Stack

```
User Query
    │
    ▼
┌─────────────────────────────────────┐
│  Intent Router (Qwen3-8B quantized) │  <- Fast, cheap
│  Classifies intent + urgency        │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Maestro Core (Qwen3-32B + v2.3 FT)│  <- Main reasoning
│  Generates plan, selects agents     │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Layer Agent (Qwen3-32B + adapter)│  <- Specialist reasoning
│  Executes sub-tasks                 │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Tool Executor (code, deterministic)│  <- No LLM, pure code
│  Calls V3 APIs, parses responses    │
└─────────────────────────────────────┘
```

### Deployment Modes

| Mode | Hardware | Latency | Cost/Month | Use Case |
|---|---|---|---|---|
| Edge | Local RTX 4090/5090 | <500ms | $0 | Personal node operator |
| Core | 1× A100 80GB | <1s | ~$300 | Small pool / validator |
| Cloud | 2× A100 80GB | <2s | ~$500 | Pool operator, bridge |
| Enterprise | 4× A100 80GB | <3s | ~$900 | Large pool, multi-chain |

---

## 7. Safety & Governance

### The "3 Rings" of Authority

```
Ring 1 (Green) — Auto-execute:
  - Check status, read metrics
  - Restart failed service
  - Switch miner algorithm
  - Clear mempool
  - Query blockchain

Ring 2 (Yellow) — Require Confirmation:
  - Change mining pool
  - Update node config
  - Modify difficulty params
  - Rotate bridge validators
  - Deploy new service version

Ring 3 (Red) — Governance Only:
  - Change fee split (89/5/5/1)
  - Modify emission schedule
  - Update genesis parameters
  - Spend DAO treasury
  - Emergency hard fork
```

### Audit & Compliance

Every action produces an **auditable log entry**:

```json
{
  "timestamp": "2026-06-13T12:34:56Z",
  "agent_path": "maestro.l1_agent.miner_thermal",
  "action": "switch_algorithm",
  "from_value": "deeksha_lite_fire",
  "to_value": "deeksha_lite_v1",
  "trigger": "gpu_temp > 85C for 30s",
  "user_approval": "auto",  // or "confirmed" or "governance_vote"
  "tx_hash": null,
  "result": "success",
  "before_state": {"temp": 87, "hashrate": 18100},
  "after_state": {"temp": 72, "hashrate": 9700}
}
```

---

## 8. V3 Integration Points

### Docker Compose Integration

Hiran v2.4 runs as an additional service in the V3 docker-compose stack:

```yaml
# Addition to V3/docker/docker-compose.yml
services:
  hiran-orchestrator:
    build:
      context: ../HiranV2.4
      dockerfile: Dockerfile
    container_name: zion-hiran-orchestrator
    restart: unless-stopped
    profiles: ["mainnet", "dev"]
    ports:
      - "8004:8004"  # Orchestrator API
      - "8005:8005"  # Agent bus (gRPC)
    environment:
      - HIRAN_MODE=orchestrator
      - HIRAN_BASE_MODEL=/models/hiran-v2.3-final
      - HIRAN_V2_4_ADAPTERS=/models/v2.4-adapters
      - HIRAN_MEMORY_REDIS=redis:6379
      - HIRAN_PROMETHEUS=prometheus:9090
      - ZION_NODE_RPC=http://node:8443
      - ZION_POOL_RPC=http://pool:8444
      - ZION_BRIDGE_RPC=http://bridge:8545
      - ZION_NCL_RPC=http://ncl:8080
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # Container control
      - hiran-models:/models
      - hiran-memory:/data/memory
    depends_on:
      node:
        condition: service_healthy
      pool:
        condition: service_healthy
      hiran-inference:
        condition: service_healthy
    networks:
      - zion-v3
```

### CLI Integration

All 22 V3 CLI commands become natural language inputs:

```
V3 CLI:                    v2.4 Natural Language:
────────────────────────────────────────────────────
zion node status     →     "How is the node doing?"
zion mine start      →     "Start mining with optimal settings"
zion pool workers    →     "Show pool worker stats"
zion bridge status   →     "Is the bridge healthy?"
zion dao proposals   →     "What DAO proposals are active?"
zion doctor          →     "Run system diagnostics"
zion deploy          →     "Deploy the full stack"
zion monitor         →     "Show real-time metrics"
```

### Prometheus Metrics

Hiran v2.4 exposes its own metrics:

```
# HELP hiran_agents_active Number of active agent instances
# TYPE hiran_agents_active gauge
hiran_agents_active{layer="l1"} 3
hiran_agents_active{layer="l2"} 2
hiran_agents_active{layer="l3"} 2

# HELP hiran_tasks_completed Tasks completed by agent layer
# TYPE hiran_tasks_completed counter
hiran_tasks_completed{layer="l1",status="success"} 152
hiran_tasks_completed{layer="l1",status="failure"} 3

# HELP hiran_incidents_detected Auto-detected incidents
# TYPE hiran_incidents_detected counter
hiran_incidents_detected{severity="low"} 12
hiran_incidents_detected{severity="critical"} 1

# HELP hiran_llm_tokens_total Tokens processed
# TYPE hiran_llm_tokens_total counter
hiran_llm_tokens_total{model="qwen3-32b"} 4523400
hiran_llm_tokens_total{model="qwen3-8b"} 890000
```

---

## 9. File Structure

```
HiranV2.4/
├── ARCHITECTURE_v2.4.md          # This file
├── AGENT_HIERARCHY_v2.4.md       # Agent + sub-agent spec
├── SERVICE_MESH_v2.4.md          # V3 integration details
├── TOOL_REGISTRY_v2.4.md         # Tool definitions + schemas
├── TRAINING_PLAN_v2.4.md        # 4-phase training
├── PROPOSAL_v2.4.md             # Executive summary
│
├── src/
│   ├── maestro/                  # Root orchestrator
│   │   ├── intent_router.rs
│   │   ├── planner.rs
│   │   ├── context_manager.rs
│   │   └── dispatch.rs
│   │
│   ├── agents/                   # Layer agents
│   │   ├── l1/                   # Node, pool, miner
│   │   ├── l2/                   # Bridge, DAO, swap
│   │   ├── l3/                   # NCL, WARP, ai-native
│   │   ├── l4/                   # Oasis
│   │   ├── l5/                   # Free World
│   │   ├── l6/                   # Issobella
│   │   └── system/              # Docker, monitoring
│   │
│   ├── subagents/               # Specialist sub-agents
│   │   ├── l1/
│   │   │   ├── node_sync.rs
│   │   │   ├── node_consensus.rs
│   │   │   ├── pool_workers.rs
│   │   │   ├── pool_economics.rs
│   │   │   ├── miner_thermal.rs
│   │   │   ├── miner_performance.rs
│   │   │   └── wallet_ops.rs
│   │   ├── l2/
│   │   │   ├── bridge_validators.rs
│   │   │   ├── bridge_watcher.rs
│   │   │   ├── dao_proposals.rs
│   │   │   ├── dao_treasury.rs
│   │   │   ├── swap_executor.rs
│   │   │   └── swap_market.rs
│   │   ├── l3/
│   │   │   ├── ncl_scheduler.rs
│   │   │   ├── ncl_market.rs
│   │   │   ├── warp_router.rs
│   │   │   ├── warp_validators.rs
│   │   │   ├── ai_native_runtime.rs
│   │   │   └── ai_native_memory.rs
│   │   └── system/
│   │       ├── docker_health.rs
│   │       ├── prometheus_alerts.rs
│   │       ├── resource_optimizer.rs
│   │       ├── backup_manager.rs
│   │       └── update_engine.rs
│   │
│   ├── memory/                   # 4-tier memory
│   │   ├── working.rs
│   │   ├── episodic.rs
│   │   ├── semantic.rs
│   │   └── constitutional.rs
│   │
│   ├── tools/                    # Tool executor
│   │   ├── registry.rs
│   │   ├── schemas/             # OpenAPI-style schemas
│   │   └── executor.rs
│   │
│   ├── inference/               # Model stack
│   │   ├── router.rs            # Qwen3-8B intent
│   │   ├── maestro.rs           # Qwen3-32B core
│   │   └── agent.rs             # Specialist adapters
│   │
│   ├── bus/                     # Message bus
│   │   ├── grpc_server.rs
│   │   ├── nats_client.rs
│   │   └── internal.rs
│   │
│   └── api/                     # Public API
│       ├── rest.rs              # FastAPI/Axum
│       ├── websocket.rs         # Real-time events
│       └── cli_bridge.rs        # V3 CLI proxy
│
├── config/
│   ├── maestro.default.toml
│   ├── agents.default.toml
│   └── rules.default.yml        # Auto-remediation rules
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.orchestrator.yml
│
└── tests/
    ├── e2e/                     # End-to-end scenarios
    ├── integration/             # V3 service mocks
    └── unit/                    # Agent unit tests
```

---

## 10. Key Design Decisions

| Decision | Rationale |
|---|---|
| Hierarchical agents, not flat | V3 has 20 crates across 6 layers — flat agent would be overwhelmed |
| Sub-agents per service | Each V3 crate has unique domain knowledge (mining vs governance vs AI) |
| Intent router separate from core | 8B model is fast enough for routing; 32B model only for complex reasoning |
| 4-tier memory | Matches human cognition + V3's varied data access patterns |
| 3 rings of authority | Protects constitutional parameters while allowing automation |
| Extends V3 `ai-native`, doesn't replace | `zion-ai-native` already has orchestrator.rs, consciousness.rs, pool_optimizer.rs — v2.4 upgrades them |

---

## References

- V3 Workspace: `V3/Cargo.toml` (20 crates, L1-L6)
- V3 Docker Stack: `V3/docker/docker-compose.yml` (11 services)
- V3 CLI: `V3/cli/src/commands/mod.rs` (22 commands)
- V3 AI-Native: `V3/L3/ai-native/src/` (orchestrator.rs, consciousness.rs, etc.)
- V3 Core RPC: `V3/L1/core/src/rpc.rs` (17 JSON-RPC methods)
- V3 Metrics: `V3/L1/core/src/metrics.rs` (Prometheus format)
- AGENTS.md: Operational rules for this repo
- StatusV3.md: Live topology and blockers

---

*Architecture based on real V3 codebase data. Last updated: 2026-06-13*
