# Hiran v2.4 — Agent & Sub-Agent Hierarchy

> **Status:** Design Specification  
> **Date:** 2026-06-13  
> **Based on:** V3 `zion-ai-native` crate (`orchestrator.rs`, `task.rs`, `types.rs`) + 20-crate workspace

---

## 1. Hierarchy Overview

```
Maestro (1)
├── L1 Agent — Blockchain & Mining
│   ├── NodeSync Sub-Agent
│   ├── NodeConsensus Sub-Agent
│   ├── PoolWorkers Sub-Agent
│   ├── PoolEconomics Sub-Agent
│   ├── MinerThermal Sub-Agent
│   ├── MinerPerformance Sub-Agent
│   └── WalletOps Sub-Agent
├── L2 Agent — DeFi & Governance
│   ├── BridgeValidators Sub-Agent
│   ├── BridgeWatcher Sub-Agent
│   ├── DaoProposals Sub-Agent
│   ├── DaoTreasury Sub-Agent
│   ├── SwapExecutor Sub-Agent
│   └── SwapMarket Sub-Agent
├── L3 Agent — AI & Cross-Chain
│   ├── NclScheduler Sub-Agent
│   ├── NclMarket Sub-Agent
│   ├── WarpRouter Sub-Agent
│   ├── WarpValidators Sub-Agent
│   ├── AiNativeRuntime Sub-Agent
│   └── AiNativeMemory Sub-Agent
├── L4 Agent — Game & Metaverse
│   └── OasisManager Sub-Agent
├── L5 Agent — Humanitarian
│   └── FreeWorldOps Sub-Agent
├── L6 Agent — Space & Edge
│   └── IsobellaOps Sub-Agent
└── System Agent — Infrastructure
    ├── DockerHealth Sub-Agent
    ├── PrometheusAlerts Sub-Agent
    ├── ResourceOptimizer Sub-Agent
    ├── BackupManager Sub-Agent
    └── UpdateEngine Sub-Agent
```

**Totals:** 1 Maestro + 7 Layer Agents + 33 Sub-Agents = 41 agent instances

---

## 2. Maestro (Root Orchestrator)

```rust
// Based on V3: ai-native/src/orchestrator.rs
// Extended for v2.4 with hierarchical dispatch

pub struct Maestro {
    intent_router: IntentRouter,      // Qwen3-8B quantized
    planner: PlannerEngine,           // Qwen3-32B + v2.3 FT
    context: ContextManager,          // 4-tier memory
    agents: HashMap<Layer, LayerAgent>,
    message_bus: MessageBus,        // gRPC / NATS
    audit_log: AuditLog,             // Immutable action log
}

impl Maestro {
    pub async fn handle(&mut self, input: UserInput) -> Response {
        // 1. Classify intent (fast, 8B model)
        let intent = self.intent_router.classify(&input).await;
        
        // 2. Load context
        let context = self.context.load(&input.session_id).await;
        
        // 3. Plan (32B model, if complex)
        let plan = if intent.complexity > Threshold::Simple {
            self.planner.generate(&intent, &context).await
        } else {
            Plan::single_step(intent)
        };
        
        // 4. Dispatch to layer agent
        let agent = self.agents.get_mut(&plan.target_layer).unwrap();
        let result = agent.execute(plan, context).await;
        
        // 5. Log & respond
        self.audit_log.record(&result).await;
        Response::from(result)
    }
}
```

### Maestro Capabilities

| Capability | Description | Model |
|---|---|---|
| Intent Classification | Maps user input to Layer + Sub-Agent | Qwen3-8B (quantized, 4-bit) |
| Plan Generation | Creates dependency graph of sub-tasks | Qwen3-32B + v2.3 factual |
| Context Synthesis | Merges conversation + system + episodic memory | Qwen3-32B |
| Cross-Layer Coordination | When a task spans L1+L2+L3 | Qwen3-32B |
| Emergency Response | Critical alerts bypass planning | Hard-coded rules |

---

## 3. L1 Agent — Blockchain & Mining

**V3 Crates:** `L1/core`, `L1/pool`, `L1/miner`, `L1/cosmic-harmony`

**Docker Services:** `node`, `pool`, `miner`

### L1 Agent Core

```rust
pub struct L1Agent {
    node_sync: NodeSyncSubAgent,
    node_consensus: NodeConsensusSubAgent,
    pool_workers: PoolWorkersSubAgent,
    pool_economics: PoolEconomicsSubAgent,
    miner_thermal: MinerThermalSubAgent,
    miner_perf: MinerPerformanceSubAgent,
    wallet: WalletOpsSubAgent,
    rpc_client: ZionRpcClient,  // node:8443
}
```

### 3.1 NodeSync Sub-Agent

**Responsibility:** Node lifecycle, sync status, peer management

```rust
pub struct NodeSyncSubAgent {
    // V3 sources: core/src/ibd.rs, core/src/peer_manager.rs
    rpc: RpcClient,  // node:8443
    last_sync_status: SyncStatus,
    bootstrap_peers: Vec<String>,  // ZION_SEED_PEERS
}

impl NodeSyncSubAgent {
    pub async fn check_sync(&self) -> SyncReport {
        let info = self.rpc.getnetworkinfo().await;
        let blockcount = self.rpc.getblockcount().await;
        let peers = self.rpc.getpeerinfo().await;
        
        SyncReport {
            status: info.sync_status,
            height: blockcount.result,
            peers: peers.len(),
            peers_inbound: peers.iter().filter(|p| p.inbound).count(),
            peers_outbound: peers.iter().filter(|p| !p.inbound).count(),
            blocks_behind: info.headers - blockcount.result,
            recommendation: self.recommend_action(&info, &peers),
        }
    }
    
    pub async fn fix_lagging_sync(&self) -> Result<()> {
        // V3: core/src/ibd.rs — batch sync (500 blocks/request)
        self.rpc.addnode(&self.bootstrap_peers).await?;
        tokio::time::sleep(Duration::from_secs(60)).await;
        
        let info = self.rpc.getnetworkinfo().await;
        if info.sync_status != SyncStatus::Synced {
            return Err(AiError::SyncStillLagging);
        }
        Ok(())
    }
}
```

**Auto-remediation rules:**
- `blocks_behind > 5 for 5m` → restart node, add bootstrap peers
- `peers < 3 for 2m` → add ZION_SEED_PEERS, check firewall
- `sync_status == Ibd for 30m` → check disk space, verify genesis hash

**Example conversation:**

```
User: "Is my node synced?"
→ NodeSync.check_sync()
→ Response: "Node is SYNCED at height 1,847,291. 12 peers (8 in, 4 out)."

User: "Why is my node falling behind?"
→ NodeSync.check_sync() → detects 14 blocks behind, 2 peers
→ NodeSync.fix_lagging_sync() → adds 4 bootstrap peers
→ Response: "Only 2 peers connected. Added 4 bootstrap nodes. Sync is catching up."
```

### 3.2 NodeConsensus Sub-Agent

**Responsibility:** Block validation, difficulty, emission, constitutional checks

```rust
pub struct NodeConsensusSubAgent {
    // V3 sources: core/src/validation.rs, core/src/emission.rs
    //              core/src/difficulty.rs, core/src/consensus.rs
    rpc: RpcClient,
}

impl NodeConsensusSubAgent {
    pub async fn verify_emission(&self, block_height: u64) -> EmissionReport {
        let mining_info = self.rpc.getmininginfo().await;
        let subsidy = calculate_subsidy(block_height);  // V3 emission.rs
        
        EmissionReport {
            block_reward: subsidy,
            fee_split: FeeSplit {
                miner: 0.89,
                humanitarian: 0.05,
                issobella: 0.05,
                pool: 0.01,
            },
            next_decay_height: ((block_height / 5_256_000) + 1) * 5_256_000,
            decades_remaining: 10 - (block_height / 5_256_000),
            constitutional: subsidy == expected_subsidy(block_height),
        }
    }
}
```

**Constitutional checks (never auto-modify, only report):**
- Fee split must be exactly 89/5/5/1
- Emission must match decade decay schedule
- Genesis hash must be frozen
- Difficulty must follow LWMA 60-block window

### 3.3 PoolWorkers Sub-Agent

**Responsibility:** Stratum sessions, worker monitoring, share validation

```rust
pub struct PoolWorkersSubAgent {
    // V3 sources: pool/src/stratum.rs, pool/src/session.rs
    pool_rpc: PoolRpcClient,  // pool:8444
}

impl PoolWorkersSubAgent {
    pub async fn get_worker_stats(&self) -> Vec<WorkerStats> {
        // Pool exposes: active sessions, shares submitted, rejected
        let sessions = self.pool_rpc.get_sessions().await;
        sessions.into_iter().map(|s| WorkerStats {
            worker_id: s.worker_name,
            ip: s.ip,
            algorithm: s.algorithm,  // V3: dual-algo support
            accepted_shares: s.accepted,
            rejected_shares: s.rejected,
            stale_shares: s.stale,
            last_share_time: s.last_share,
            status: if s.last_share.elapsed() < 60s { "active" } else { "idle" },
        }).collect()
    }
}
```

**Auto-remediation:**
- `worker.idle > 5m` → check miner process, alert if dead
- `worker.rejected_rate > 10%` → check algorithm mismatch (V3 dual-algo fix)
- `pool.sessions > 1000` → alert capacity, suggest load balancer

### 3.4 PoolEconomics Sub-Agent

**Responsibility:** PPLNS tracking, fee split verification, revenue analysis

```rust
pub struct PoolEconomicsSubAgent {
    // V3: pool/src/payout.rs, fee.rs (89/5/5/1)
    rpc: RpcClient,  // node:8443 for chain data
    pool_rpc: PoolRpcClient,  // pool:8444
}

impl PoolEconomicsSubAgent {
    pub async fn verify_fee_split(&self, block_height: u64) -> SplitVerification {
        let block = self.rpc.getblock(block_height).await;
        let coinbase = block.coinbase_tx;
        
        // V3: 4 outputs: miner(89%), humanitarian(5%), issobella(5%), pool(1%)
        let outputs = coinbase.outputs;
        assert_eq!(outputs.len(), 4, "Coinbase must have 4 outputs");
        
        let total = outputs.iter().map(|o| o.value).sum::<u64>();
        let miner_pct = outputs[0].value as f64 / total as f64;
        let hum_pct = outputs[1].value as f64 / total as f64;
        let iso_pct = outputs[2].value as f64 / total as f64;
        let pool_pct = outputs[3].value as f64 / total as f64;
        
        SplitVerification {
            miner: (miner_pct - 0.89).abs() < 0.001,
            humanitarian: (hum_pct - 0.05).abs() < 0.001,
            issobella: (iso_pct - 0.05).abs() < 0.001,
            pool: (pool_pct - 0.01).abs() < 0.001,
            total: total,
        }
    }
}
```

### 3.5 MinerThermal Sub-Agent

**Responsibility:** GPU temperature monitoring, algorithm switching for thermal safety

```rust
pub struct MinerThermalSubAgent {
    // V3: miner/src/gpu_thermal.rs
    miner_rpc: MinerRpcClient,  // miner process
    thermal_limits: ThermalProfile,
}

impl MinerThermalSubAgent {
    pub async fn check_thermal(&self) -> ThermalReport {
        let temps = self.miner_rpc.get_gpu_temps().await;
        let max_temp = temps.iter().max().unwrap_or(&0);
        
        let recommendation = if *max_temp > 85 {
            ThermalAction::SwitchToLite  // deeksha_lite_v1 (cooler)
        } else if *max_temp > 75 {
            ThermalAction::ReduceIntensity
        } else {
            ThermalAction::Optimal
        };
        
        ThermalReport { temps, max: *max_temp, recommendation }
    }
    
    pub async fn auto_thermal_manage(&self) -> Result<()> {
        let report = self.check_thermal().await;
        match report.recommendation {
            ThermalAction::SwitchToLite => {
                self.miner_rpc.set_algorithm("deeksha_lite_v1").await?;
                self.miner_rpc.restart().await?;
            }
            ThermalAction::ReduceIntensity => {
                self.miner_rpc.set_work_size(2048).await?;  // reduce batch
            }
            ThermalAction::Optimal => {}  // do nothing
        }
        Ok(())
    }
}
```

**V3 algorithms:**
- `deeksha_lite_v1` — 256 KiB scratchpad, cool, 9.7 KH/s (RX 5700 XT)
- `deeksha_lite_fire` — 128 KiB, 16 passes, 512 reads, hot, 18.1 KH/s
- `cosmic_harmony_ekam_deeksha_v2` — full Deeksha, 7.2 KH/s

### 3.6 MinerPerformance Sub-Agent

**Responsibility:** Benchmark, hashrate optimization, profitability

```rust
pub struct MinerPerformanceSubAgent {
    miner_rpc: MinerRpcClient,
    price_feed: PriceFeedClient,
}

impl MinerPerformanceSubAgent {
    pub async fn benchmark_all_algorithms(&self) -> Vec<BenchmarkResult> {
        let algorithms = vec![
            "deeksha_lite_v1",
            "deeksha_lite_fire",
            "cosmic_harmony_ekam_deeksha_v2",
        ];
        
        let mut results = Vec::new();
        for algo in &algorithms {
            self.miner_rpc.set_algorithm(algo).await.unwrap();
            tokio::time::sleep(Duration::from_secs(30)).await;
            let hashrate = self.miner_rpc.get_hashrate().await.unwrap();
            results.push(BenchmarkResult {
                algorithm: algo,
                hashrate: hashrate,
                power_estimate: estimate_power(algo, &self.detect_gpu()),
            });
        }
        results
    }
    
    pub async fn calculate_profitability(&self, kwh_cost: f64) -> ProfitabilityReport {
        let benchmarks = self.benchmark_all_algorithms().await;
        let zion_price = self.price_feed.get("ZION/USD").await;
        let difficulty = self.miner_rpc.get_network_difficulty().await.unwrap();
        
        // V3: block_reward = 5,400.067 ZION (initial), decays every 5,256,000 blocks
        let block_reward = get_current_block_reward();
        let blocks_per_day = 86400.0 / 120.0;  // 120s block time
        
        benchmarks.into_iter().map(|b| {
            let daily_zion = (b.hashrate as f64 / difficulty as f64) * block_reward * blocks_per_day;
            let daily_usd = daily_zion * zion_price;
            let daily_power_cost = b.power_estimate * 24.0 * kwh_cost / 1000.0;
            
            ProfitabilityResult {
                algorithm: b.algorithm,
                daily_revenue_usd: daily_usd,
                daily_cost_usd: daily_power_cost,
                daily_profit_usd: daily_usd - daily_power_cost,
                roi_percent: ((daily_usd - daily_power_cost) / daily_power_cost) * 100.0,
            }
        }).collect()
    }
}
```

### 3.7 WalletOps Sub-Agent

**Responsibility:** UTXO management, transaction building, balance tracking

```rust
pub struct WalletOpsSubAgent {
    // V3: core/src/wallet.rs
    rpc: RpcClient,
}

impl WalletOpsSubAgent {
    pub async fn get_balance(&self, address: &str) -> Balance {
        // V3: hybrid balance (account + UTXO)
        let chain_balance = self.rpc.getaccountbalance(address).await;
        let utxo_balance = self.rpc.getutxobalance(address).await;
        
        Balance {
            chain: chain_balance,
            utxo: utxo_balance,
            total: chain_balance + utxo_balance,
        }
    }
    
    pub async fn build_transaction(&self, inputs: Vec<TxInput>, outputs: Vec<TxOutput>) 
        -> Result<SignedTransaction> {
        // V3: wallet.rs — largest-first UTXO selection, Ed25519 signing
        self.rpc.buildandsign(inputs, outputs).await
    }
}
```

---

## 4. L2 Agent — DeFi & Governance

**V3 Crates:** `L2/bridge`, `L2/dao`, `L2/atomic-swap`

### 4.1 BridgeValidators Sub-Agent

**Responsibility:** Monitor 3/5 validator consensus, health checks

```rust
pub struct BridgeValidatorsSubAgent {
    // V3: bridge/src/validator.rs, config/bridge-mainnet.toml
    bridge_rpc: BridgeRpcClient,
    validators: Vec<ValidatorConfig>,  // 5 validators, 3/5 threshold
}

impl BridgeValidatorsSubAgent {
    pub async fn check_consensus(&self) -> ConsensusReport {
        let active = self.bridge_rpc.get_active_validators().await;
        let total = self.validators.len();
        
        ConsensusReport {
            active: active.len(),
            required: 3,  // 3/5 threshold
            healthy: active.len() >= 3,
            status: if active.len() >= 4 { "HEALTHY" }
                    else if active.len() == 3 { "DEGRADED" }
                    else { "CRITICAL — consensus at risk" },
            validators: active.iter().map(|v| ValidatorStatus {
                id: v.id,
                location: v.location,  // e.g., "Seoul", "Prague", "USA"
                last_seen: v.last_seen,
                lag_blocks: v.lag_blocks,
            }).collect(),
        }
    }
}
```

### 4.2 BridgeWatcher Sub-Agent

**Responsibility:** Track cross-chain transactions L1↔EVM

```rust
pub struct BridgeWatcherSubAgent {
    bridge_rpc: BridgeRpcClient,
    l1_rpc: RpcClient,
    evm_rpc: EvmRpcClient,  // Base mainnet (chain 8453)
}

impl BridgeWatcherSubAgent {
    pub async fn track_transaction(&self, tx_hash: &str) -> BridgeTxStatus {
        // Monitor on both sides
        let l1_status = self.l1_rpc.gettransaction(tx_hash).await;
        let evm_status = self.evm_rpc.gettransactionreceipt(tx_hash).await;
        
        BridgeTxStatus {
            l1_confirmed: l1_status.confirmations > 6,
            evm_confirmed: evm_status.is_some(),
            total_confirmations: l1_status.confirmations,
            status: if l1_status.confirmations > 6 && evm_status.is_some() {
                "COMPLETE"
            } else {
                "PENDING"
            },
        }
    }
}
```

### 4.3 DaoProposals Sub-Agent

**Responsibility:** Proposal analysis, voting deadlines, quorum tracking

```rust
pub struct DaoProposalsSubAgent {
    // V3: dao/src/proposal.rs
    dao_rpc: DaoRpcClient,
}

impl DaoProposalsSubAgent {
    pub async fn analyze_proposal(&self, proposal_id: u64) -> ProposalAnalysis {
        let proposal = self.dao_rpc.getproposal(proposal_id).await;
        let votes = self.dao_rpc.getvotes(proposal_id).await;
        let quorum = self.dao_rpc.getquorum().await;
        
        let for_pct = votes.for as f64 / (votes.for + votes.against) as f64;
        let quorum_met = (votes.for + votes.against) as f64 >= quorum as f64;
        
        ProposalAnalysis {
            id: proposal_id,
            proposer: proposal.proposer,
            title: proposal.title,
            description: proposal.description,
            votes_for: votes.for,
            votes_against: votes.against,
            for_percentage: for_pct * 100.0,
            quorum_required: quorum,
            quorum_met: quorum_met,
            deadline: proposal.deadline,
            status: if quorum_met && for_pct > 0.5 { "LIKELY PASS" }
                    else if !quorum_met { "QUORUM PENDING" }
                    else { "LIKELY FAIL" },
        }
    }
}
```

### 4.4 DaoTreasury Sub-Agent

**Responsibility:** Treasury balance, tithe verification, humanitarian fund tracking

```rust
pub struct DaoTreasurySubAgent {
    // V3: dao/src/treasury.rs, core/src/emission.rs (5% humanitarian)
    rpc: RpcClient,
    dao_rpc: DaoRpcClient,
}

impl DaoTreasurySubAgent {
    pub async fn verify_tithe(&self, block_height: u64) -> TitheVerification {
        // V3: Every block has 5% → humanitarian wallet (zion1m4v5z...)
        let block = self.rpc.getblock(block_height).await;
        let coinbase = block.coinbase_tx;
        
        let humanitarian_output = &coinbase.outputs[1];  // index 1 = 5%
        let expected_amount = (block.subsidy as f64 * 0.05) as u64;
        
        TitheVerification {
            block: block_height,
            amount: humanitarian_output.value,
            expected: expected_amount,
            address: humanitarian_output.address.clone(),
            valid: humanitarian_output.value == expected_amount,
            cumulative_humanitarian: self.dao_rpc.get_tithe_balance().await,
        }
    }
}
```

---

## 5. L3 Agent — AI & Cross-Chain

**V3 Crates:** `L3/ncl`, `L3/warp`, `L3/ai-native`

### 5.1 NclScheduler Sub-Agent

**Responsibility:** AI compute job scheduling on NCL marketplace

```rust
pub struct NclSchedulerSubAgent {
    // V3: ncl/src/scheduler.rs, ncl/src/compute.rs
    ncl_rpc: NclRpcClient,
}

impl NclSchedulerSubAgent {
    pub async fn schedule_inference(&self, model: &str, prompt: &str) -> JobResult {
        // Find cheapest provider with required GPU
        let providers = self.ncl_rpc.list_providers().await;
        let best = providers.into_iter()
            .filter(|p| p.available_gpus.contains(model))
            .min_by(|a, b| a.price_per_token.partial_cmp(&b.price_per_token).unwrap());
        
        let job = NclJob {
            model: model.to_string(),
            prompt: prompt.to_string(),
            provider: best.unwrap().id,
            max_tokens: 1024,
        };
        
        self.ncl_rpc.submit_job(job).await
    }
}
```

### 5.2 WarpRouter Sub-Agent

**Responsibility:** 7-chain route optimization

```rust
pub struct WarpRouterSubAgent {
    // V3: warp/src/router.rs (7 adapters: EVM, Bitcoin, Solana, Tron, Stellar, Cardano, Cosmos)
    warp_rpc: WarpRpcClient,
}

impl WarpRouterSubAgent {
    pub async fn find_best_route(
        &self, 
        from_chain: ChainId, 
        to_chain: ChainId, 
        amount: u64
    ) -> Route {
        // Check all 7 chain adapters for best path
        let adapters = self.warp_rpc.list_adapters().await;
        let routes = adapters.iter().filter_map(|a| {
            self.warp_rpc.estimate_route(from_chain, to_chain, amount, a.id).ok()
        }).collect::<Vec<_>>();
        
        routes.into_iter()
            .min_by(|a, b| a.fee.partial_cmp(&b.fee).unwrap())
            .unwrap()
    }
}
```

### 5.3 AiNativeRuntime Sub-Agent

**Responsibility:** V3 ai-native crate runtime management

```rust
pub struct AiNativeRuntimeSubAgent {
    // V3: ai-native/src/consciousness_engine.rs, ai-native/src/orchestrator.rs
    ai_native_rpc: AiNativeRpcClient,
}

impl AiNativeRuntimeSubAgent {
    pub async fn get_consciousness_state(&self) -> ConsciousnessReport {
        // V3: consciousness.rs — agent awareness, self-reflection
        let state = self.ai_native_rpc.get_consciousness().await;
        
        ConsciousnessReport {
            awareness_level: state.awareness,
            active_thoughts: state.active_thoughts.len(),
            emotional_state: state.emotional_state,  // V3: Ekam field
            self_reflection: state.last_reflection,
        }
    }
}
```

---

## 6. System Agent — Infrastructure

### 6.1 DockerHealth Sub-Agent

**Responsibility:** Monitor all Docker containers in V3 stack

```rust
pub struct DockerHealthSubAgent {
    docker: DockerClient,
}

impl DockerHealthSubAgent {
    pub async fn check_all_services(&self) -> Vec<ContainerHealth> {
        let containers = self.docker.list_containers().await;
        containers.into_iter().map(|c| ContainerHealth {
            name: c.name,
            status: c.status,
            health: c.health,
            uptime: c.uptime,
            restart_count: c.restart_count,
            cpu_percent: c.stats.cpu,
            mem_percent: c.stats.memory,
        }).collect()
    }
    
    pub async fn restart_service(&self, name: &str) -> Result<()> {
        self.docker.restart_container(name).await
    }
}
```

**Monitored containers (from V3 docker-compose.yml):**
- `zion-v3-node` — port 8443/8333
- `zion-v3-pool` — port 8444
- `zion-v3-miner`
- `zion-v3-oasis` — port 8094
- `zion-v3-free-world` — port 8095
- `zion-v3-issobella` — port 8096
- `zion-hiran-inference` — port 8002 (v2.2 GGUF)
- `zion-prometheus` — port 9090
- `zion-grafana` — port 3000
- `zion-alertmanager` — port 9093

### 6.2 ResourceOptimizer Sub-Agent

**Responsibility:** CPU, RAM, GPU allocation across services

```rust
pub struct ResourceOptimizerSubAgent {
    docker: DockerClient,
    node_exporter: NodeExporterClient,
}

impl ResourceOptimizerSubAgent {
    pub async fn optimize_resources(&self) -> OptimizationPlan {
        let metrics = self.node_exporter.get_metrics().await;
        
        let plan = OptimizationPlan::new();
        
        if metrics.cpu > 90.0 {
            plan.add_action("reduce_miner_threads", "1");
        }
        if metrics.memory > 85.0 {
            plan.add_action("clear_mempool", "");
        }
        if metrics.gpu_temp > 80.0 {
            plan.add_action("miner_switch_lite", "");
        }
        
        plan
    }
}
```

---

## 7. Agent Lifecycle

```
Created → Idle → Active → Busy → Idle → Sleep → Terminated
   │        │       │      │      │      │        │
   │        │       │      │      │      │        │
   ▼        ▼       ▼      ▼      ▼      ▼        ▼
 Maestro Maestro  Task   Task  Done  Inactive  Max
 creates dispatches started done  wait  timeout agents
```

**Auto-scaling:** If a Layer Agent is overloaded (>10 concurrent tasks), Maestro spawns a second instance.

**Health check:** Every agent reports heartbeat every 5s. Missing 3 heartbeats → Maestro recreates.

---

## 8. Message Format

```json
{
  "msg_id": "uuid-v4",
  "timestamp": "2026-06-13T12:34:56Z",
  "trace_id": "parent-uuid",
  "from": "maestro",
  "to": "l1_agent.miner_thermal",
  "intent": "check_and_manage_thermal",
  "payload": {
    "gpu_ids": [0, 1],
    "action": "auto"
  },
  "timeout_ms": 10000,
  "priority": "normal",
  "reply_to": "maestro.inbox"
}
```

---

## References

- V3 AI-Native: `V3/L3/ai-native/src/orchestrator.rs`, `task.rs`, `types.rs`
- V3 Core: `V3/L1/core/src/rpc.rs`, `metrics.rs`, `peer_manager.rs`
- V3 Pool: `V3/L1/pool/src/` (stratum, session, payout)
- V3 Miner: `V3/L1/miner/src/` (gpu_thermal, benchmark)
- V3 Bridge: `V3/L2/bridge/src/validator.rs`, `config/bridge-mainnet.toml`
- V3 DAO: `V3/L2/dao/src/proposal.rs`, `treasury.rs`
- V3 Docker: `V3/docker/docker-compose.yml`
