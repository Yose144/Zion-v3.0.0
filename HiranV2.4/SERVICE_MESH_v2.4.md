# Hiran v2.4 — Service Mesh Integration

> **Status:** Integration Spec  
> **Date:** 2026-06-13  
> **Based on:** V3 Docker Compose (`docker-compose.yml`) + 20-crate Rust workspace

---

## 1. V3 Service Registry

Every V3 service auto-registers on startup. Hiran v2.4 consumes this registry.

### Discovery Protocol

```rust
pub struct ServiceRegistration {
    pub service_id: String,       // e.g., "zion-v3-node"
    pub service_type: ServiceType, // L1_NODE, L1_POOL, etc.
    pub version: String,          // "3.0.1"
    pub endpoints: Endpoints,
    pub health: HealthStatus,
    pub resources: ResourceUsage,
}

pub enum ServiceType {
    L1Node, L1Pool, L1Miner,
    L2Bridge, L2Dao, L2AtomicSwap, L2SwapAggregator,
    L3Ncl, L3Warp, L3AiNative,
    L4Oasis, L5FreeWorld, L6Isobella,
    Infrastructure,  // prometheus, grafana
}
```

### Real V3 Services (from `docker-compose.yml`)

| Service | Type | Port | Healthcheck | Hiran Monitors |
|---|---|---|---|---|
| `zion-v3-node` | L1_NODE | 8443 RPC, 8333 P2P | `curl localhost:8443/health` | ✅ sync, peers, blocks |
| `zion-v3-pool` | L1_POOL | 8444 Stratum | `curl localhost:8444/health` | ✅ workers, shares, difficulty |
| `zion-v3-miner` | L1_MINER | — (no port) | Process check | ✅ hashrate, temp, algo |
| `zion-v3-oasis` | L4_OASIS | 8094 | `curl localhost:8094/health` | ✅ player economy |
| `zion-v3-free-world` | L5_FREEWORLD | 8095 | `curl localhost:8095/health` | ✅ donations, impact |
| `zion-v3-issobella` | L6_ISOBELLA | 8096 | `curl localhost:8096/health` | ✅ satellite links |
| `zion-hiran-inference` | INFRA | 8002 | `curl localhost:8002/health` | ✅ model loaded, latency |
| `zion-prometheus` | INFRA | 9090 | HTTP 200 | ✅ metrics collection |
| `zion-grafana` | INFRA | 3000 | HTTP 200 | ✅ dashboards |
| `zion-alertmanager` | INFRA | 9093 | HTTP 200 | ✅ alert routing |

---

## 2. Communication Patterns

### Pattern A: Request-Response (synchronous)

Used for user-facing queries.

```
User → Maestro → L1 Agent → NodeSync Sub-Agent
                    │              │
                    │              ▼
                    │         HTTP GET /rpc/getblockcount
                    │              │
                    │              ▼
                    │         zion-v3-node:8443
                    │              │
                    │              ▼
                    │         JSON-RPC response
                    │              │
                    ▼              ▼
              Response aggregation
```

**Timeout:** 5s for simple queries, 30s for complex operations

### Pattern B: Event-Driven (asynchronous)

Used for monitoring and auto-remediation.

```
zion-v3-node ──> Prometheus ──> Alert Rule ──> Alertmanager
                                               │
                                               ▼
                                         Maestro (event subscriber)
                                               │
                                               ▼
                                         L1 Agent → NodeSync Sub-Agent
                                               │
                                               ▼
                                         Auto-remediation or user alert
```

### Pattern C: Pub-Sub (broadcast)

Used for system-wide state changes.

```
Maestro publishes: "miner_algorithm_changed"
  ├── L1 Agent → updates hashrate expectations
  ├── L2 Agent → updates pool difficulty calc
  ├── L3 Agent → updates NCL job scheduling
  └── System Agent → updates Prometheus metrics
```

---

## 3. API Integration Points

### 3.1 L1 Core JSON-RPC (17 methods)

Source: `V3/L1/core/src/rpc.rs`

```rust
pub fn build_node_router() -> RpcRouter {
    let mut router = RpcRouter::new();
    
    router.register("getblockcount", handle_get_block_count);
    router.register("getblock", handle_get_block);
    router.register("getblockhash", handle_get_block_hash);
    router.register("getnetworkinfo", handle_get_network_info);
    router.register("getmininginfo", handle_get_mining_info);
    router.register("getpeerinfo", handle_get_peer_info);
    router.register("getaccountbalance", handle_get_account_balance);
    router.register("getaccounttransaction", handle_get_account_transaction);
    router.register("submitaccounttransaction", handle_submit_account_transaction);
    router.register("getmempoolinfo", handle_get_mempool_info);
    router.register("getsupplyinfo", handle_get_supply_info);
    router.register("sendrawtransaction", handle_send_raw_transaction);
    router.register("getrawtransaction", handle_get_raw_transaction);
    router.register("gettransaction", handle_get_transaction);
    router.register("getutxosetinfo", handle_get_utxo_set_info);
    router.register("getdifficulty", handle_get_difficulty);
    router.register("getblockchaininfo", handle_get_blockchain_info);
    
    router
}
```

**Hiran wrappers:**

| V3 RPC Method | Hiran Tool | Sub-Agent |
|---|---|---|
| `getblockcount` | `zion_rpc_getblockcount` | NodeSync |
| `getnetworkinfo` | `zion_rpc_getnetworkinfo` | NodeSync |
| `getmininginfo` | `zion_rpc_getmininginfo` | NodeConsensus, MinerPerformance |
| `getpeerinfo` | `zion_rpc_getpeerinfo` | NodeSync |
| `getaccountbalance` | `zion_rpc_getbalance` | WalletOps |
| `getsupplyinfo` | `zion_rpc_getsupplyinfo` | NodeConsensus |
| `getmempoolinfo` | `zion_rpc_getmempoolinfo` | NodeConsensus |

### 3.2 Pool Stratum API

Source: `V3/L1/pool/src/stratum.rs`, `session.rs`

```rust
// Pool exposes HTTP health + stratum protocol
pub struct PoolApi {
    pub health_endpoint: "http://pool:8444/health",
    pub stratum_port: 8444,
    pub metrics: PoolMetrics,
}

pub struct PoolMetrics {
    pub active_sessions: u32,
    pub total_shares_submitted: u64,
    pub total_shares_accepted: u64,
    pub total_shares_rejected: u64,
    pub current_difficulty: u64,
    pub network_hashrate: f64,  // TH/s
}
```

**Hiran access:** PoolWorkers Sub-Agent polls every 10s

### 3.3 Bridge API

Source: `V3/L2/bridge/src/handlers.rs`, `config/bridge-mainnet.toml`

```rust
pub struct BridgeApi {
    pub rpc_endpoint: "http://bridge:8545",
    pub validators: Vec<Validator>,  // 5 validators, 3/5 threshold
    pub chains: Vec<ChainConfig>,    // L1 + EVM (Base mainnet, chain 8453)
}

pub struct Validator {
    pub id: String,
    pub pubkey: String,
    pub location: String,
    pub status: ValidatorStatus,
}
```

**Hiran access:** BridgeValidators Sub-Agent polls every 60s

### 3.4 Docker Control API

```rust
// Hiran needs docker.sock access
pub struct DockerApi {
    pub socket: "/var/run/docker.sock",
}

impl DockerApi {
    pub async fn list_services(&self) -> Vec<Container>;
    pub async fn restart_service(&self, name: &str) -> Result<()>;
    pub async fn get_logs(&self, name: &str, tail: usize) -> Vec<String>;
    pub async fn get_stats(&self, name: &str) -> ContainerStats;
}
```

---

## 4. Data Flows

### Flow 1: "Is everything healthy?"

```
User query
  │
  ▼
Maestro → Intent: SystemHealth
  │
  ├── L1 Agent → NodeSync.check_sync()
  │              ├── HTTP GET node:8443/health
  │              ├── RPC getblockcount, getnetworkinfo, getpeerinfo
  │              └── Return: synced, height, peers
  │
  ├── L1 Agent → PoolWorkers.get_worker_stats()
  │              ├── HTTP GET pool:8444/health
  │              └── Return: sessions, shares, difficulty
  │
  ├── L2 Agent → BridgeValidators.check_consensus()
  │              ├── HTTP GET bridge:8545/validators
  │              └── Return: active validators, consensus status
  │
  └── System Agent → DockerHealth.check_all_services()
                  ├── Docker API: list_containers()
                  └── Return: container statuses, restart counts
  │
  ▼
Maestro aggregates → Natural language response
```

### Flow 2: "Start mining optimally"

```
User query
  │
  ▼
Maestro → Intent: MinerControl + Optimize
  │
  ├── L1 Agent → MinerPerformance.benchmark_all_algorithms()
  │              ├── Miner RPC: set_algorithm("deeksha_lite_v1")
  │              ├── Wait 30s, measure hashrate
  │              ├── Miner RPC: set_algorithm("deeksha_lite_fire")
  │              ├── Wait 30s, measure hashrate
  │              └── Return: benchmark results
  │
  ├── L1 Agent → MinerThermal.check_thermal()
  │              ├── Miner RPC: get_gpu_temps()
  │              └── Return: max temp, recommendation
  │
  ├── L1 Agent → Planner selects best algorithm
  │              ├── If temp < 75C AND fire_profit > lite_profit: select Fire
  │              ├── Else: select Lite
  │              └── Return: selected algorithm
  │
  └── L1 Agent → Miner RPC: start_mining(algorithm)
  │
  ▼
Maestro reports: started, hashrate, estimated daily earnings
```

### Flow 3: Emergency — bridge validator down

```
Alertmanager fires: bridge.active_validators < 4
  │
  ▼
Maestro receives event (priority: CRITICAL)
  │
  ├── System Agent → PrometheusAlerts.fetch_details()
  │
  ├── L2 Agent → BridgeValidators.check_consensus()
  │              ├── Returns: 3/5 active, validator #3 (Seoul) lagging 2 blocks
  │              └── Status: DEGRADED (still functional)
  │
  ├── Maestro → Decision: do NOT rotate yet (3/5 is above threshold)
  │              └── Alert user: "Bridge degraded, 3/5 validators active"
  │
  └── If drops to 2/5:
      ├── Trigger emergency validator rotation
      ├── L2 Agent → Bridge RPC: propose_emergency_rotation()
      └── Notify all bridge operators
```

---

## 5. Health Check Matrix

| Service | Check Method | Frequency | Healthy | Degraded | Critical |
|---|---|---|---|---|---|
| `zion-v3-node` | HTTP 200 + getblockcount > 0 | 10s | Synced, >5 peers | Lagging, 3-5 peers | Stuck, <3 peers |
| `zion-v3-pool` | HTTP 200 + stratum accept | 10s | Workers active | 0 workers, still up | Down |
| `zion-v3-miner` | Process + hashrate > 0 | 30s | Hashrate > 0 | Hashrate 0, process alive | Process dead |
| `zion-hiran-inf` | HTTP 200 + model loaded | 30s | Model ready | Loading | Down |
| `zion-prometheus` | HTTP 200 | 60s | Scraping | — | Down |
| `zion-grafana` | HTTP 200 | 60s | Dashboards | — | Down |
| `zion-v3-oasis` | HTTP 200 + WS connect | 30s | Players online | High latency | Down |
| `zion-v3-free-world` | HTTP 200 + DB connect | 30s | Donations flowing | — | Down |
| `zion-v3-issobella` | HTTP 200 + satellite ping | 60s | Links active | 1 link down | All down |

---

## 6. Network Topology

### Docker Network: `zion-v3`

```
┌─────────────────────────────────────────────────────────┐
│                     zion-v3 network                     │
│                                                          │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐           │
│   │  node   │◄───►│  pool   │◄───►│  miner  │           │
│   │ :8443   │     │ :8444   │     │         │           │
│   │ :8333   │     │         │     │         │           │
│   └────┬────┘     └────┬────┘     └─────────┘           │
│        │               │                                 │
│        ▼               ▼                                 │
│   ┌─────────────────────────────────────┐               │
│   │     hiran-orchestrator (v2.4)      │               │
│   │         :8004 (REST API)            │               │
│   │         :8005 (gRPC Agent Bus)      │               │
│   └─────────────────────────────────────┘               │
│        │               │               │                 │
│        ▼               ▼               ▼                 │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐           │
│   │  oasis  │     │free-world│    │issobella│           │
│   │ :8094   │     │ :8095   │     │ :8096   │           │
│   └─────────┘     └─────────┘     └─────────┘           │
│                                                          │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐           │
│   │prometheus│    │ grafana │     │alertmgr │           │
│   │ :9090   │     │ :3000   │     │ :9093   │           │
│   └─────────┘     └─────────┘     └─────────┘           │
│                                                          │
│   ┌─────────┐                                           │
│   │ hiran-  │                                           │
│   │inference│                                           │
│   │ :8002   │                                           │
│   └─────────┘                                           │
└─────────────────────────────────────────────────────────┘
```

### External Connections

| From | To | Protocol | Purpose |
|---|---|---|---|
| `node` | seed peers (77.42.71.94:8333) | P2P TCP | Blockchain sync |
| `bridge` | Base mainnet (chain 8453) | EVM JSON-RPC | Cross-chain txs |
| `miner` | pool (77.42.71.94:8444) | Stratum TCP | Mining jobs |
| `hiran-inference` | HuggingFace Hub | HTTPS | Model download |
| `prometheus` | all services | HTTP | Metrics scraping |

---

## 7. Prometheus Integration

### Scraping Configuration

```yaml
# V3: docker/prometheus.yml
scrape_configs:
  - job_name: 'zion-node'
    static_configs:
      - targets: ['node:9090']  # V3 metrics.rs exposes on :9090
    scrape_interval: 10s
    
  - job_name: 'zion-pool'
    static_configs:
      - targets: ['pool:9090']
    scrape_interval: 10s

  - job_name: 'hiran-orchestrator'
    static_configs:
      - targets: ['hiran-orchestrator:9090']
    scrape_interval: 10s
```

### Hiran Custom Metrics

Hiran v2.4 exposes `/metrics` endpoint for Prometheus:

```
# HELP hiran_agent_health Agent layer health (1=healthy, 0=degraded)
# TYPE hiran_agent_health gauge
hiran_agent_health{layer="l1"} 1
hiran_agent_health{layer="l2"} 1
hiran_agent_health{layer="l3"} 0  # NCL job queue backed up

# HELP hiran_tasks_in_flight Active tasks per layer
# TYPE hiran_tasks_in_flight gauge
hiran_tasks_in_flight{layer="l1"} 3
hiran_tasks_in_flight{layer="l2"} 1

# HELP hiran_auto_remediation_count Auto-fixes performed
# TYPE hiran_auto_remediation_count counter
hiran_auto_remediation_count{service="miner",action="restart"} 2
hiran_auto_remediation_count{service="node",action="add_peers"} 1

# HELP hiran_llm_inference_latency_ms LLM inference latency
# TYPE hiran_llm_inference_latency_ms histogram
hiran_llm_inference_latency_ms_bucket{model="qwen3-8b",le="100"} 95
hiran_llm_inference_latency_ms_bucket{model="qwen3-32b",le="1000"} 78
```

---

## 8. Configuration

### Environment Variables

Hiran v2.4 reads these from V3 `.env`:

```bash
# V3 services (from docker-compose.yml)
ZION_NODE_RPC=http://node:8443
ZION_POOL_RPC=http://pool:8444
ZION_BRIDGE_RPC=http://bridge:8545
ZION_NCL_RPC=http://ncl:8080
ZION_WARP_RPC=http://warp:8081

# Hiran-specific
HIRAN_MODE=orchestrator
HIRAN_BASE_MODEL=/models/hiran-v2.3-final
HIRAN_V2_4_ADAPTERS=/models/v2.4-adapters
HIRAN_MEMORY_REDIS=redis:6379
HIRAN_PROMETHEUS_URL=http://prometheus:9090
HIRAN_ALERTMANAGER_URL=http://alertmanager:9093
HIRAN_LOG_LEVEL=info
HIRAN_MAX_AGENTS=20
HIRAN_TASK_TIMEOUT_MS=30000
```

### Profiles

```yaml
# V3/docker/docker-compose.yml profiles
profiles:
  dev:         # All services, hot reload, debug
  mainnet:     # Production: node + pool + miner + L4-L6 + hiran
  monitoring:  # Prometheus + Grafana + Alertmanager
  hiran:       # Only hiran-inference (v2.2)
```

---

## References

- V3 Docker Compose: `V3/docker/docker-compose.yml`
- V3 Core RPC: `V3/L1/core/src/rpc.rs`
- V3 Core Metrics: `V3/L1/core/src/metrics.rs`
- V3 Pool: `V3/L1/pool/src/stratum.rs`
- V3 Bridge Config: `V3/L2/bridge/config/bridge-mainnet.toml`
- V3 CLI: `V3/cli/src/commands/mod.rs`
- V3 AGENTS.md: Operational rules and safety
