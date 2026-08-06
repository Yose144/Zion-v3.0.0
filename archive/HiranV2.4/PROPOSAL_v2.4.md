# Hiran v2.4 — Zion Ecosystem Orchestrator

> **Status:** Proposal / Design Phase  
> **Date:** 2026-06-13  
> **Previous:** Hiran v2.3 (Qwen3-32B Full FT, in training now on 2x A100)  
> **Codename:** "Maestro"

---

## 1. Vision: The Brain of Zion

Hiran v2.3 is a **domain-specific chatbot** — it answers questions about Zion.  
Hiran v2.4 becomes the **central orchestrator** of the entire Zion ecosystem — it monitors, manages, and optimizes every layer of the stack autonomously.

> **Analogy:** If Zion OS is the body, Hiran v2.4 is the brain + nervous system.

### What "Full Orchestrator" Means

| Layer | Service | v2.4 Orchestration |
|---|---|---|
| **L1** | Zion Node | Start/stop, health monitor, peer discovery, sync status |
| **L1** | Cosmic Harmony Miner | Auto-algo selection, thermal management, profitability optimization |
| **L2** | Mining Pool | Worker monitoring, share validation, payout scheduling, difficulty adjustment |
| **L2** | Bridge | Validator health, cross-chain tx monitoring, 3/5 consensus tracking |
| **L3** | DAO Governance | Proposal analysis, voting recommendations, treasury alerts |
| **L4** | RAG Knowledge Base | Auto-indexing, document updates, semantic search optimization |
| **L5** | Web/App Services | Uptime monitoring, CDN optimization, error alerting |
| **L6** | Edge/IoT | Device fleet management, OTA updates, resource allocation |

### User Experience

```
User: "Zion, start mining with optimal settings."

Hiran v2.4:
  1. Checks GPU (A100 detected)
  2. Benchmarks all 3 algorithms (Ekam: 9.7 KH/s, Fire: 18.1 KH/s, Lite: 3.2 KH/s)
  3. Checks thermal limits (room temp 22C → Fire viable)
  4. Checks pool connection (77.42.71.94:8444 healthy)
  5. Calculates profitability ($/kWh vs expected ZION earnings)
  6. Starts miner with best algorithm + optimal params
  7. Monitors in real-time, auto-switches if conditions change
  8. Reports: "Started Fire mode. 18.1 KH/s. Est. $12.40/day. Thermal OK."

User: "Zion, is everything healthy?"

Hiran v2.4:
  "System status:
   Node: SYNCED (height 1,847,291, 12 peers)
   Pool: ONLINE (47 workers, 2.3 TH/s total)
   Bridge: 4/5 validators active (1 lagging in Seoul)
   Miner: RUNNING (Fire, 18.1 KH/s, temp 68C)
   Web: OK (99.9% uptime, 0 errors)
   Alerts: 1 LOW — bridge validator #3 delayed 2 blocks"
```

---

## 2. Architecture: Central Nervous System

```
                          ┌──────────────────────┐
                          │   User Interfaces     │
                          │  (Chat, Voice, API)   │
                          └──────────┬───────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
        ┌─────────────────────────────────────────────────────┐
        │         HIRAN v2.4 — ORCHESTRATOR CORE              │
        ├─────────────────────────────────────────────────────┤
        │                                                      │
        │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
        │  │  Planner    │  │   Monitor    │  │  Executor  │ │
        │  │  (ReAct)     │  │  (Metrics)   │  │  (Actions) │ │
        │  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
        │         │                │                │        │
        │         └────────────────┼────────────────┘        │
        │                        │                          │
        │  ┌─────────────────────┴─────────────────────┐   │
        │  │         Unified Service Bus               │   │
        │  │    (gRPC / NATS / Unix sockets)        │   │
        │  └─────────────────────┬─────────────────────┘   │
        │                        │                          │
        └────────────────────────┼──────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
   ┌────────────┐      ┌────────────┐        ┌────────────┐
   │   L1 Node  │      │  Pool /    │        │   Bridge   │
   │  + Miner   │      │  Workers   │        │ Validators │
   └────────────┘      └────────────┘        └────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │    Zion OS Dashboard    │
                    │  (Real-time metrics)    │
                    └─────────────────────────┘
```

### Core Components

#### A. Planner (ReAct Engine)
- Decomposes user goals into sub-tasks
- Plans execution order with dependencies
- Handles failures with fallback strategies

#### B. Monitor (Observability)
- Polls all services every N seconds
- Collects metrics: CPU, RAM, GPU, network, blockchain state
- Detects anomalies: lagging sync, dropped peers, thermal throttling

#### C. Executor (Action Engine)
- Executes commands across all services
- Validates results before confirming success
- Rolls back on failure

#### D. Memory (Context Layer)
- **Short-term:** Current session, active tasks
- **Long-term:** User preferences, historical decisions
- **Episodic:** Past incidents, how they were resolved
- **System-state:** Last known good configuration for each service

---

## 3. Service Mesh Integration

### Service Registry

Every Zion service registers itself on startup:

```json
{
  "service_id": "zion-node-01",
  "service_type": "l1_node",
  "version": "3.0.1",
  "status": "running",
  "endpoints": {
    "rpc": "127.0.0.1:8443",
    "p2p": "0.0.0.0:8333",
    "metrics": "127.0.0.1:9090"
  },
  "health": {
    "last_block": 1847291,
    "peers": 12,
    "sync_status": "synced",
    "uptime_seconds": 86400
  },
  "resources": {
    "cpu_percent": 23.5,
    "ram_mb": 4096,
    "disk_gb": 120
  }
}
```

### Health Check Matrix

| Service | Check | Frequency | Action on Failure |
|---|---|---|---|
| L1 Node | RPC `getblockcount` | 10s | Restart, alert if 3× |
| Pool | Stratum port 8444 | 10s | Restart, check firewall |
| Miner | Process alive + hashrate | 30s | Restart with fallback algo |
| Bridge | Validator signatures | 60s | Alert, propose replacement |
| Web | HTTP 200 on `/health` | 30s | Restart container |
| Dashboard | WebSocket connection | 60s | Reload, check backend |

### Auto-Remediation Rules

```yaml
rules:
  - name: "miner_zero_hashrate"
    condition: "miner.hashrate == 0 for 2m"
    action: 
      - "miner.restart()"
      - "if still 0: switch_algorithm('deeksha_lite_v1')"
      - "if still 0: alert_operator()"
    
  - name: "node_lagging_sync"
    condition: "node.blocks_behind > 5 for 5m"
    action:
      - "node.restart()"
      - "if still lagging: add_bootstrap_peers()"
      - "if still lagging: alert_operator()"
  
  - name: "bridge_validator_down"
    condition: "bridge.active_validators < 4 for 2m"
    action:
      - "alert: CRITICAL — Bridge consensus at risk"
      - "initiate_emergency_validator_rotation()"
      
  - name: "gpu_overheating"
    condition: "gpu.temp > 85C"
    action:
      - "miner.switch_algorithm('deeksha_lite_v1')"
      - "if still > 85C: miner.pause()"
      - "alert: GPU thermal throttling"
```

---

## 4. Tool Registry (Zion Native Tools)

### L1 Tools

| Tool | Description | Example |
|---|---|---|
| `zion_rpc` | Blockchain queries | `getblockcount`, `getbalance`, `getmininginfo` |
| `zion_node_ctrl` | Node lifecycle | `start`, `stop`, `restart`, `status` |
| `zion_miner_ctrl` | Miner lifecycle | `start`, `stop`, `set_algorithm`, `benchmark` |
| `zion_wallet` | Wallet operations | `getnewaddress`, `getbalance`, `send` (with confirmation) |

### L2-L3 Tools

| Tool | Description | Example |
|---|---|---|
| `pool_ctrl` | Pool management | `status`, `restart`, `payout_now` |
| `bridge_ctrl` | Bridge operations | `validator_status`, `propose_rotation` |
| `dao_query` | Governance data | `active_proposals`, `treasury_balance` |
| `dao_vote` | Voting (with confirmation) | `vote(proposal_id, choice)` |

### L4-L6 Tools

| Tool | Description | Example |
|---|---|---|
| `rag_query` | Knowledge search | `search("fee split")` |
| `rag_index` | Document indexing | `index_new_docs()` |
| `web_health` | Web service check | `status()`, `restart()` |
| `edge_deploy` | Edge device update | `deploy_ota(device_id)` |

### Analysis Tools

| Tool | Description | Example |
|---|---|---|
| `code_exec` | Python/Rust sandbox | Calculate profitability, analyze data |
| `chart_read` | Vision + OCR | "What does this hashrate chart show?" |
| `web_search` | External knowledge | Latest crypto news, pool comparisons |
| `price_feed` | Market data | ZION/USD, BTC/USD, mining profitability |

---

## 5. Training Plan: From Chatbot to Orchestrator

### Phase 1: Zion OS Grounding (DORA, rank 512)

**Goal:** Model understands every Zion service, its config, and how services interact.

**Dataset:** 30,000 examples covering:
- Service architecture (L1-L6)
- Configuration parameters and their effects
- Inter-service dependencies
- Common failure modes and solutions
- CLI commands and expected outputs

```json
{
  "messages": [
    {"role": "user", "content": "How do I optimize mining on an RX 5700 XT?"},
    {"role": "assistant", "content": "Let me check your hardware and network conditions..."},
    {"role": "assistant", "tool_calls": [
      {"name": "zion_miner_ctrl", "arguments": {"action": "benchmark", "gpu": "rx5700xt"}},
      {"name": "pool_ctrl", "arguments": {"action": "status"}}
    ]},
    {"role": "tool", "content": "{\"deeksha_lite_v1\": \"9.7 KH/s\", \"deeksha_lite_fire\": \"18.1 KH/s\", \"ekam_deeksha_v2\": \"7.2 KH/s\"}"},
    {"role": "tool", "content": "{\"pool_status\": \"healthy\", \"difficulty\": 845M}"},
    {"role": "assistant", "content": "For RX 5700 XT (RDNA1):\n\n**Recommended: Fire Mode**\n- Hashrate: 18.1 KH/s\n- Power: ~180W\n- VRAM: 85% (7GB/8GB)\n- Thermal: Monitor if room >25C\n\nTo start:\n```bash\nZION_MINER_ALGORITHM=deeksha_lite_fire ZION_LOOP_COUNT=1000000 ./miner\n```\n\nExpected: ~18 KH/s, 0.72 ZION/day at current difficulty."}
  ]
}
```

### Phase 2: Orchestration Reasoning (DORA, rank 512)

**Goal:** Model can plan multi-step operations across services.

**Dataset:** 20,000 orchestration tasks

```json
{
  "messages": [
    {"role": "user", "content": "I want to set up a complete Zion node + miner + pool on one machine."},
    {"role": "assistant", "content": "I'll orchestrate the full setup. This requires sequential dependency management..."},
    {"role": "assistant", "tool_calls": [
      {"name": "zion_node_ctrl", "arguments": {"action": "start", "config": "mainnet"}}
    ]},
    {"role": "tool", "content": "{\"status\": \"started\", \"rpc\": \"127.0.0.1:8443\", \"sync\": \"in_progress\"}"},
    {"role": "assistant", "tool_calls": [
      {"name": "zion_rpc", "arguments": {"method": "getblockcount"}}
    ]},
    {"role": "tool", "content": "{\"result\": 1847290, \"headers\": 1847291}"},
    {"role": "assistant", "content": "Node is synced (1 block behind, catching up). Starting pool..."},
    {"role": "assistant", "tool_calls": [
      {"name": "pool_ctrl", "arguments": {"action": "start", "node_rpc": "127.0.0.1:8443"}}
    ]},
    {"role": "tool", "content": "{\"status\": \"started\", \"bind\": \"0.0.0.0:8444\"}"},
    {"role": "assistant", "tool_calls": [
      {"name": "zion_miner_ctrl", "arguments": {"action": "start", "pool": "127.0.0.1:8444"}}
    ]},
    {"role": "tool", "content": "{\"status\": \"started\", \"algorithm\": \"deeksha_lite_v1\", \"hashrate\": \"9.7 KH/s\"}"},
    {"role": "assistant", "content": "**Setup complete!**\n- Node: Synced (127.0.0.1:8443)\n- Pool: Online (0.0.0.0:8444)\n- Miner: Running (9.7 KH/s)\n\nAll services operational. Use `Zion, status` anytime."}
  ]
}
```

### Phase 3: Incident Response (DORA, rank 256)

**Goal:** Model detects problems and responds autonomously.

**Dataset:** 15,000 incident scenarios

```json
{
  "messages": [
    {"role": "system", "content": "ALERT: node.sync_status = 'lagging', blocks_behind = 12"},
    {"role": "assistant", "content": "Node is falling behind. Investigating..."},
    {"role": "assistant", "tool_calls": [
      {"name": "zion_rpc", "arguments": {"method": "getpeerinfo"}}
    ]},
    {"role": "tool", "content": "{\"peers\": 2, \"max_peers\": 50, \"all_inbound\": true}"},
    {"role": "assistant", "content": "Only 2 inbound peers. Need more outbound connections. Adding bootstrap peers..."},
    {"role": "assistant", "tool_calls": [
      {"name": "zion_node_ctrl", "arguments": {"action": "add_peers", "peers": ["77.42.71.94:8333", "seed2.zion.network:8333"]}},
      {"name": "zion_rpc", "arguments": {"method": "getnetworkinfo"}}
    ]},
    {"role": "tool", "content": "{\"peers\": 14, \"sync_status\": \"catching_up\"}"},
    {"role": "assistant", "content": "Resolved. Added bootstrap peers. Now connected to 14 peers. Sync is catching up. Monitoring..."}
  ]
}
```

### Phase 4: Multi-User & Governance (DORA, rank 128)

**Goal:** Model handles DAO governance, proposals, and multi-stakeholder decisions.

**Dataset:** 10,000 governance scenarios

```json
{
  "messages": [
    {"role": "user", "content": "Analyze proposal #42: increase block reward by 10%"},
    {"role": "assistant", "content": "Analyzing proposal #42 across all dimensions..."},
    {"role": "assistant", "tool_calls": [
      {"name": "dao_query", "arguments": {"proposal_id": 42}},
      {"name": "zion_rpc", "arguments": {"method": "getmininginfo"}},
      {"name": "price_feed", "arguments": {"pair": "ZION/USD"}}
    ]},
    {"role": "tool", "content": "{\"proposer\": \"zion1abc...\", \"votes_for\": 156, \"votes_against\": 89, \"quorum\": 66%}"},
    {"role": "tool", "content": "{\"block_reward\": 50, \"difficulty\": 845M, \"network_hashrate\": \"12.5 TH/s\"}"},
    {"role": "tool", "content": "{\"price\": 0.42, \"market_cap\": \"$42M\"}"},
    {"role": "assistant", "content": "**Proposal #42 Analysis**\n\n**Change:** Block reward 50 → 55 ZION (+10%)\n\n**Impact:**\n- Inflation: +10% new supply daily\n- Miner incentive: Short-term boost\n- Sell pressure: Likely increase (miners sell more)\n- Price impact: Potentially -5-8% short term\n\n**Governance:**\n- Current votes: 156 for, 89 against (64% approval)\n- Quorum: 66% — **not yet reached**\n- Proposer reputation: Established (3 previous proposals)\n\n**Recommendation:** NEUTRAL — marginal benefit for miners, inflation risk. Suggest waiting for more data on network growth before reward changes.\n\n**How do you want to vote?**"}
  ]
}
```

---

## 6. Base Model Strategy

### Option A: Qwen3-32B + Heavy DORA (Recommended)

- **Base:** v2.3 checkpoint (already training)
- **Adapters:** 4× DORA stacked (factual + grounding + orchestration + incidents)
- **Total rank:** 512 + 512 + 256 + 128 = 1408 trainable layers
- **Inference:** 1× A100 80GB (8-bit base + adapters)
- **Training cost:** ~$100-150

### Option B: Qwen3-72B Full FT

- **Pros:** Better at complex multi-step reasoning
- **Cons:** 4× A100 needed for training, inference slower
- **Cost:** ~$400-600
- **When:** If v2.4-A proves insufficient for orchestration

### Option C: Mixture of Experts (MoE)

- **Router model:** Qwen3-8B (cheap, fast)
- **Specialist models:**
  - Facts: v2.3 Qwen3-32B
  - Tools: Qwen3-14B DORA
  - Code: Qwen3-14B DORA
  - Vision: Qwen3-VL
- **Pros:** Each model optimized for its domain
- **Cons:** Complex routing logic, higher infra cost
- **When:** Scale beyond what single model can handle

---

## 7. Infrastructure

### Orchestrator Deployment

```yaml
# docker-compose.orchestrator.yml
services:
  hiran-orchestrator:
    image: hiran-v2.4:latest
    runtime: nvidia
    environment:
      - HIRAN_MODE=orchestrator
      - HIRAN_BASE_MODEL=/models/hiran-v2.3-final
      - HIRAN_ADAPTERS=/models/v2.4-adapters
      - ZION_NODE_RPC=http://zion-node:8443
      - ZION_POOL_RPC=http://zion-pool:8444
      - ZION_BRIDGE_RPC=http://zion-bridge:8545
      - HIRAN_MEMORY_DB=redis://redis:6379
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # Control other services
      - ./models:/models
    networks:
      - zion-internal
    depends_on:
      - redis
      - prometheus
```

### Service Discovery

```python
# Hiran discovers all Zion services automatically
class ZionServiceDiscovery:
    def __init__(self):
        self.registry = {}
    
    def scan(self):
        """Auto-discover all running Zion services."""
        services = {
            'zion-node': self._check_port(8443),
            'zion-pool': self._check_port(8444),
            'zion-bridge': self._check_port(8545),
            'zion-web': self._check_http(3000, '/health'),
            'zion-dashboard': self._check_ws(8766),
        }
        return services
    
    def _check_port(self, port):
        return socket.connect_ex(('127.0.0.1', port)) == 0
```

### Memory & State

| Store | Type | Purpose |
|---|---|---|
| Redis | Short-term | Active tasks, session context |
| SQLite | Long-term | User preferences, service configs |
| Prometheus | Metrics | Time-series health data |
| ChromaDB | Semantic | Document memory, past incidents |

---

## 8. Safety & Governance

### The "Big Red Button"

Hiran v2.4 can **monitor everything** but can only **modify** with explicit approval:

| Action | Auto-allowed | Requires confirmation |
|---|---|---|
| Check status, read metrics | ✅ | — |
| Restart failed service | ✅ | — |
| Switch miner algorithm | ✅ | — |
| Change mining pool | ⚠️ (if same owner) | If external |
| Send transaction | ❌ | ✅ (2FA) |
| Vote on DAO proposal | ❌ | ✅ (user must confirm) |
| Modify fee split | ❌ | ❌ (constitutional — never) |
| Rotate bridge validators | ❌ | ✅ (multisig) |

### Audit Trail

Every action logged immutably:

```json
{
  "timestamp": "2026-06-13T12:34:56Z",
  "agent": "hiran-v2.4",
  "user": "zion1abc...",
  "action": "miner.restart",
  "reason": "zero_hashrate_detected",
  "before": {"status": "running", "hashrate": 0},
  "after": {"status": "running", "hashrate": 18100},
  "confirmation": "auto",  // or "user_approved"
  "tx_hash": null
}
```

---

## 9. Success Metrics

### System Health

| Metric | Target |
|---|---|
| Node uptime (managed by Hiran) | 99.9% |
| Mean time to recovery (MTTR) | <2 min |
| False positive alerts | <5% |
| Auto-remediation success rate | 95% |

### User Experience

| Metric | Target |
|---|---|
| "Set up complete node" — time to operational | <5 min |
| "Is everything healthy?" — response completeness | 100% services reported |
| "Optimize my miner" — profitability improvement | +15% vs default |
| Multi-step task completion (no human intervention) | 90% |

### Intelligence

| Metric | Target |
|---|---|
| Factual accuracy (Zion domain) | 98% |
| Tool call success rate | 95% |
| Incident detection rate | 99% |
| Incident false positive rate | <3% |
| Governance proposal analysis quality | Expert-level |

---

## 10. Timeline

| Phase | Duration | Dependencies |
|---|---|---|
| v2.3 training complete & eval | ~2 days | In progress now |
| Service API schemas (all L1-L6) | 1 week | v2.3 eval passed |
| Zion OS Grounding dataset | 2 weeks | API schemas ready |
| Grounding DORA training | 5 days | Dataset ready |
| Orchestration dataset | 2 weeks | Grounding model ready |
| Orchestration DORA training | 5 days | Dataset ready |
| Incident Response dataset | 1 week | Orchestration model ready |
| Incident Response DORA training | 3 days | Dataset ready |
| Integration testing (all services) | 2 weeks | All models ready |
| **Total** | **~10-12 weeks** | **v2.3 complete** |

---

## 11. Open Questions

1. **Should Hiran have an on-chain identity?**  
   A dedicated Zion wallet for micro-tx, staking, validator bonds?

2. **How to handle conflicting user goals?**  
   "Maximize my mining profit" vs "Support network decentralization"

3. **What happens if Hiran itself fails?**  
   Watchdog service? Fallback to manual mode? Backup orchestrator?

4. **Multi-tenant vs. personal?**  
   One Hiran per user, or shared pool orchestrator for the whole network?

5. **Voice / real-time operation?**  
   "Hey Zion, what's my hashrate?" — Whisper + TTS integration

6. **Should Hiran participate in DAO governance as an entity?**  
   AI-assisted voting, proposal generation, treasury analysis?

7. **Edge orchestration?**  
   Managing 1000s of IoT devices, ASICs, mobile miners?

---

## 12. Next Steps

1. ✅ Wait for v2.3 training to complete (~40-50h remaining)
2. ✅ Evaluate v2.3 factual accuracy
3. 🔄 Design unified service API schema (gRPC/REST)
4. 🔄 Implement service discovery in Zion OS
5. 🔄 Build Prometheus metrics exporter for all services
6. 🔄 Generate Zion OS Grounding dataset (30k examples)
7. 🔄 Start v2.4 Phase 1 DORA training

---

*Proposal created: 2026-06-13*  
*v2.3 currently training on Vast.ai (2x A100 SXM4, port 21742)*
*Codename: "Maestro"*
