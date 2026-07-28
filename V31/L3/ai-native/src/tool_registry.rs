//! # 🛠️ Hiran v2.4 Maestro — Tool Registry
//!
//! Registry of 37 tools that Hiran v2.4 Maestro can invoke across L1–L6 + System.
//! Each tool is a typed RPC/HTTP call to a ZION service with JSON Schema I/O,
//! timeout, retry policy, and owning sub-agent.
//!
//! ## Design
//! ```text
//! ┌──────────────────────┐
//! │   Maestro (Planner)  │
//! └──────────┬───────────┘
//!            │ selects tool by name
//!            ▼
//! ┌──────────────────────┐
//! │   ToolRegistry       │  HashMap<name, Tool>
//! └──────────┬───────────┘
//!            │ dispatch
//!            ▼
//! ┌──────────────────────┐
//! │   ToolExecutor       │  async reqwest, retry, timeout
//! └──────────┬───────────┘
//!            │ HTTP/JSON-RPC
//!            ▼
//! ┌──────────────────────┐
//! │   ZION Service       │  node:8443, pool:8444, bridge:9101, ...
//! └──────────────────────┘
//! ```
//!
//! ## Status
//! - ✅ Tool struct, ToolRegistry, ToolExecutor
//! - ✅ 37 tool definitions (L1×12, L2×8, L3×6, L4-L6×6, System×5)
//! - ✅ Intent enum (10 intents for Intent Router)
//! - ✅ Layer enum (L1-L6 + System)
//! - ✅ Sub-agent name mapping
//! - ⚠️ ToolExecutor: HTTP transport implemented, but actual ZION service
//!   endpoints must be verified against live Edge deployment
//! - ⚠️ Dharma Validator hook: pre/post check stubs (full impl in hiranyagarbha.rs)

use crate::error::{AiError, AiResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::time::Duration;

// ============================================================================
// Enums — Layer, Sub-Agent, Intent
// ============================================================================

/// ZION ecosystem layer. Maps to Layer Agents in v2.4 Maestro hierarchy.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Layer {
    L1,
    L2,
    L3,
    L4,
    L5,
    L6,
    System,
}

impl Layer {
    pub fn as_str(&self) -> &'static str {
        match self {
            Layer::L1 => "L1",
            Layer::L2 => "L2",
            Layer::L3 => "L3",
            Layer::L4 => "L4",
            Layer::L5 => "L5",
            Layer::L6 => "L6",
            Layer::System => "System",
        }
    }
}

/// Sub-agent name (specialists across 7 layers). Maps to AGENT_HIERARCHY_v2.4.md.
/// Extended for full Zion ecosystem coverage (dashboard, backup, DB, DeFi, watchdog).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SubAgent {
    // L1 (8) — Consensus + Pool + Miner + Wallet
    NodeSync,
    NodeConsensus,
    PoolWorkers,
    PoolEconomics,
    MinerThermal,
    MinerPerformance,
    WalletOps,
    NodeMetrics, // NEW: Prometheus node1/node2 metrics scraper
    // L2 (7) — Bridge + DAO + Swap + DEX + DeFi
    BridgeValidators,
    BridgeWatcher,
    DaoProposals,
    DaoTreasury,
    SwapExecutor,
    SwapMarket,
    DefiMonitor, // NEW: Base Mainnet DeFi contracts (wZION, Staking, Farm, Governance, Treasury)
    // L3 (6) — NCL + WARP + AI
    NclScheduler,
    NclMarket,
    WarpRouter,
    WarpValidators,
    AiNativeRuntime,
    AiNativeMemory,
    // L4 (1) — OASIS
    OasisManager,
    // L5 (1) — Free World
    FreeWorldOps,
    // L6 (1) — Issobella
    IsobellaOps,
    // System (8) — Docker + Prometheus + Resources + Backup + Update + Dashboard + DB + Watchdog
    DockerHealth,
    PrometheusAlerts,
    ResourceOptimizer,
    BackupManager,
    UpdateEngine,
    DashboardOps,   // NEW: Dashboard API (port 8766) — service health, launch, logs
    DatabaseInspector, // NEW: SQLite/JSON DB inspector (9 databases)
    WatchdogController, // NEW: Watchdog timer + auto-heal control
}

impl SubAgent {
    pub fn layer(&self) -> Layer {
        match self {
            SubAgent::NodeSync
            | SubAgent::NodeConsensus
            | SubAgent::PoolWorkers
            | SubAgent::PoolEconomics
            | SubAgent::MinerThermal
            | SubAgent::MinerPerformance
            | SubAgent::WalletOps
            | SubAgent::NodeMetrics => Layer::L1,
            SubAgent::BridgeValidators
            | SubAgent::BridgeWatcher
            | SubAgent::DaoProposals
            | SubAgent::DaoTreasury
            | SubAgent::SwapExecutor
            | SubAgent::SwapMarket
            | SubAgent::DefiMonitor => Layer::L2,
            SubAgent::NclScheduler
            | SubAgent::NclMarket
            | SubAgent::WarpRouter
            | SubAgent::WarpValidators
            | SubAgent::AiNativeRuntime
            | SubAgent::AiNativeMemory => Layer::L3,
            SubAgent::OasisManager => Layer::L4,
            SubAgent::FreeWorldOps => Layer::L5,
            SubAgent::IsobellaOps => Layer::L6,
            SubAgent::DockerHealth
            | SubAgent::PrometheusAlerts
            | SubAgent::ResourceOptimizer
            | SubAgent::BackupManager
            | SubAgent::UpdateEngine
            | SubAgent::DashboardOps
            | SubAgent::DatabaseInspector
            | SubAgent::WatchdogController => Layer::System,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            SubAgent::NodeSync => "NodeSync",
            SubAgent::NodeConsensus => "NodeConsensus",
            SubAgent::PoolWorkers => "PoolWorkers",
            SubAgent::PoolEconomics => "PoolEconomics",
            SubAgent::MinerThermal => "MinerThermal",
            SubAgent::MinerPerformance => "MinerPerformance",
            SubAgent::WalletOps => "WalletOps",
            SubAgent::NodeMetrics => "NodeMetrics",
            SubAgent::BridgeValidators => "BridgeValidators",
            SubAgent::BridgeWatcher => "BridgeWatcher",
            SubAgent::DaoProposals => "DaoProposals",
            SubAgent::DaoTreasury => "DaoTreasury",
            SubAgent::SwapExecutor => "SwapExecutor",
            SubAgent::SwapMarket => "SwapMarket",
            SubAgent::DefiMonitor => "DefiMonitor",
            SubAgent::NclScheduler => "NclScheduler",
            SubAgent::NclMarket => "NclMarket",
            SubAgent::WarpRouter => "WarpRouter",
            SubAgent::WarpValidators => "WarpValidators",
            SubAgent::AiNativeRuntime => "AiNativeRuntime",
            SubAgent::AiNativeMemory => "AiNativeMemory",
            SubAgent::OasisManager => "OasisManager",
            SubAgent::FreeWorldOps => "FreeWorldOps",
            SubAgent::IsobellaOps => "IsobellaOps",
            SubAgent::DockerHealth => "DockerHealth",
            SubAgent::PrometheusAlerts => "PrometheusAlerts",
            SubAgent::ResourceOptimizer => "ResourceOptimizer",
            SubAgent::BackupManager => "BackupManager",
            SubAgent::UpdateEngine => "UpdateEngine",
            SubAgent::DashboardOps => "DashboardOps",
            SubAgent::DatabaseInspector => "DatabaseInspector",
            SubAgent::WatchdogController => "WatchdogController",
        }
    }
}

/// User intent — output of Intent Router (Qwen3-8B classifier).
/// Maps natural language → structured intent for Planner Engine.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Intent {
    /// "Je vše zdravé?" — aggregate health across all layers
    SystemHealth,
    /// "Začni těžit" / "stop mining" — miner control + optimization
    MinerControl,
    /// "Jaká je výška bloku?" / "kolik peerů?" — node info queries
    NodeInfo,
    /// "Kolik mám na účtu?" — wallet/balance queries
    WalletQuery,
    /// "Stav bridge" / "kolik validátorů?" — bridge monitoring
    BridgeStatus,
    /// "Aktivní DAO návrhy" / "hlasuj pro X" — governance
    DaoGovernance,
    /// "Cena swapu" / "proveď swap" — atomic swap operations
    SwapOperation,
    /// "WARP routes" / "NCL providers" — L3 cross-chain + compute
    L3Query,
    /// "Stav Oasis" / "Free World report" / "Issobella data" — L4-L6
    L456Status,
    /// "Restartuj kontejner X" / "zálohuj" — system ops
    SystemOps,
    /// "Stav DeFi" / "staking APR" / "farm rewards" — Base Mainnet DeFi
    DefiStatus,
    /// "Zálohy" / "poslední backup" / "obnovit ze zálohy" — backup management
    BackupQuery,
    /// "Databáze" / "tabulky" / "inspect DB" — database inspection
    DatabaseInspect,
    /// "Watchdog" / "auto-heal" / "alert history" — watchdog status
    WatchdogStatus,
}

impl Intent {
    /// Which sub-agents are typically needed to fulfill this intent.
    pub fn required_sub_agents(&self) -> &'static [SubAgent] {
        match self {
            Intent::SystemHealth => &[
                SubAgent::NodeSync,
                SubAgent::PoolWorkers,
                SubAgent::BridgeValidators,
                SubAgent::WarpRouter,
                SubAgent::OasisManager,
                SubAgent::FreeWorldOps,
                SubAgent::IsobellaOps,
                SubAgent::DockerHealth,
            ],
            Intent::MinerControl => &[
                SubAgent::MinerThermal,
                SubAgent::MinerPerformance,
                SubAgent::PoolEconomics,
            ],
            Intent::NodeInfo => &[SubAgent::NodeSync, SubAgent::NodeConsensus],
            Intent::WalletQuery => &[SubAgent::WalletOps],
            Intent::BridgeStatus => &[SubAgent::BridgeValidators, SubAgent::BridgeWatcher],
            Intent::DaoGovernance => &[SubAgent::DaoProposals, SubAgent::DaoTreasury],
            Intent::SwapOperation => &[SubAgent::SwapExecutor, SubAgent::SwapMarket],
            Intent::L3Query => &[SubAgent::WarpRouter, SubAgent::NclMarket],
            Intent::L456Status => &[
                SubAgent::OasisManager,
                SubAgent::FreeWorldOps,
                SubAgent::IsobellaOps,
            ],
            Intent::SystemOps => &[
                SubAgent::DockerHealth,
                SubAgent::PrometheusAlerts,
                SubAgent::BackupManager,
                SubAgent::DashboardOps,
                SubAgent::WatchdogController,
            ],
            Intent::DefiStatus => &[SubAgent::DefiMonitor, SubAgent::DaoTreasury],
            Intent::BackupQuery => &[SubAgent::BackupManager, SubAgent::DashboardOps],
            Intent::DatabaseInspect => &[SubAgent::DatabaseInspector],
            Intent::WatchdogStatus => &[SubAgent::WatchdogController, SubAgent::PrometheusAlerts],
        }
    }
}

// ============================================================================
// Tool struct + Registry
// ============================================================================

/// HTTP method for tool invocation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Delete,
}

/// A single tool definition. See TOOL_REGISTRY_v2.4.md for spec.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    /// Unique tool name, e.g. "zion_rpc_getblockcount"
    pub name: &'static str,
    /// Human-readable description (for LLM tool-use prompts)
    pub description: &'static str,
    /// Owning sub-agent
    pub sub_agent: SubAgent,
    /// Layer (derived from sub_agent, denormalized for convenience)
    pub layer: Layer,
    /// Endpoint URL, e.g. "http://127.0.0.1:9443/rpc"
    pub endpoint: String,
    /// HTTP method
    pub method: HttpMethod,
    /// JSON-RPC method name (for POST JSON-RPC tools, e.g. "getblockcount")
    pub rpc_method: Option<&'static str>,
    /// Input JSON schema (Value for flexibility)
    pub input_schema: Value,
    /// Output JSON schema
    pub output_schema: Value,
    /// Timeout for a single attempt
    pub timeout_ms: u64,
    /// Max retries on transient failure
    pub retry: u32,
    /// Whether this tool requires human approval (critical ops)
    pub requires_approval: bool,
}

impl Tool {
    pub fn timeout(&self) -> Duration {
        Duration::from_millis(self.timeout_ms)
    }
}

/// Registry of all 37 tools. Lookup by name.
#[derive(Debug, Clone, Default)]
pub struct ToolRegistry {
    tools: HashMap<&'static str, Tool>,
}

impl ToolRegistry {
    /// Create empty registry.
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }

    /// Create registry pre-populated with all 37 v2.4 Maestro tools.
    /// Endpoints use 127.0.0.1 + canonical ports (Edge deployment).
    pub fn with_all_tools() -> Self {
        let mut reg = Self::new();
        for tool in all_tools() {
            reg.register(tool);
        }
        reg
    }

    pub fn register(&mut self, tool: Tool) {
        self.tools.insert(tool.name, tool);
    }

    pub fn get(&self, name: &str) -> Option<&Tool> {
        self.tools.get(name)
    }

    pub fn list(&self) -> Vec<&Tool> {
        self.tools.values().collect()
    }

    pub fn len(&self) -> usize {
        self.tools.len()
    }

    pub fn is_empty(&self) -> bool {
        self.tools.is_empty()
    }

    /// All tools owned by a given sub-agent.
    pub fn tools_for_sub_agent(&self, sa: SubAgent) -> Vec<&Tool> {
        self.tools.values().filter(|t| t.sub_agent == sa).collect()
    }

    /// All tools in a given layer.
    pub fn tools_for_layer(&self, layer: Layer) -> Vec<&Tool> {
        self.tools.values().filter(|t| t.layer == layer).collect()
    }

    /// All tools required to fulfill an intent.
    pub fn tools_for_intent(&self, intent: &Intent) -> Vec<&Tool> {
        let needed = intent.required_sub_agents();
        self.tools
            .values()
            .filter(|t| needed.contains(&t.sub_agent))
            .collect()
    }

    /// All tools that require human approval.
    pub fn approval_required_tools(&self) -> Vec<&Tool> {
        self.tools.values().filter(|t| t.requires_approval).collect()
    }
}

// ============================================================================
// Tool Executor — async HTTP transport with retry + timeout
// ============================================================================

/// Result of a tool invocation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub tool_name: String,
    pub success: bool,
    pub status_code: Option<u16>,
    pub body: Value,
    pub attempts: u32,
    pub elapsed_ms: u64,
    pub timestamp: DateTime<Utc>,
    pub error: Option<String>,
}

impl ToolResult {
    pub fn ok(tool_name: &str, status: u16, body: Value, attempts: u32, elapsed_ms: u64) -> Self {
        Self {
            tool_name: tool_name.to_string(),
            success: true,
            status_code: Some(status),
            body,
            attempts,
            elapsed_ms,
            timestamp: Utc::now(),
            error: None,
        }
    }

    pub fn err(tool_name: &str, attempts: u32, elapsed_ms: u64, error: String) -> Self {
        Self {
            tool_name: tool_name.to_string(),
            success: false,
            status_code: None,
            body: Value::Null,
            attempts,
            elapsed_ms,
            timestamp: Utc::now(),
            error: Some(error),
        }
    }
}

/// Async tool executor. Uses reqwest for HTTP transport.
///
/// For JSON-RPC tools (rpc_method = Some), builds:
/// ```json
/// {"jsonrpc":"2.0","id":1,"method":"<rpc_method>","params":<input>}
/// ```
/// For REST tools (rpc_method = None), sends input as JSON body (POST) or
/// query string (GET).
pub struct ToolExecutor {
    client: reqwest::Client,
}

impl ToolExecutor {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("reqwest client build");
        Self { client }
    }

    /// Execute a tool by name with given input. Retries on transient failure.
    pub async fn execute(
        &self,
        registry: &ToolRegistry,
        tool_name: &str,
        input: Value,
    ) -> AiResult<ToolResult> {
        let tool = registry
            .get(tool_name)
            .ok_or_else(|| AiError::ToolNotFound(tool_name.to_string()))?;
        self.execute_tool(tool, input).await
    }

    /// Execute a concrete Tool struct.
    pub async fn execute_tool(&self, tool: &Tool, input: Value) -> AiResult<ToolResult> {
        let started = std::time::Instant::now();
        let mut last_err: Option<String> = None;
        let mut attempts = 0u32;

        while attempts <= tool.retry {
            attempts += 1;
            match self.attempt(tool, &input).await {
                Ok((status, body)) => {
                    return Ok(ToolResult::ok(
                        tool.name,
                        status,
                        body,
                        attempts,
                        started.elapsed().as_millis() as u64,
                    ));
                }
                Err(e) => {
                    last_err = Some(e.to_string());
                    if attempts <= tool.retry {
                        tokio::time::sleep(Duration::from_millis(200 * attempts as u64)).await;
                    }
                }
            }
        }
        Ok(ToolResult::err(
            tool.name,
            attempts,
            started.elapsed().as_millis() as u64,
            last_err.unwrap_or_else(|| "unknown error".to_string()),
        ))
    }

    async fn attempt(
        &self,
        tool: &Tool,
        input: &Value,
    ) -> Result<(u16, Value), reqwest::Error> {
        let req = match tool.method {
            HttpMethod::Get => {
                let mut r = self.client.get(&tool.endpoint).timeout(tool.timeout());
                if let Some(obj) = input.as_object() {
                    for (k, v) in obj {
                        if !v.is_null() {
                            r = r.query(&[(k.as_str(), v.to_string())]);
                        }
                    }
                }
                r
            }
            HttpMethod::Post => {
                let body = if let Some(rpc) = tool.rpc_method {
                    serde_json::json!({
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": rpc,
                        "params": input,
                    })
                } else {
                    input.clone()
                };
                self.client
                    .post(&tool.endpoint)
                    .timeout(tool.timeout())
                    .json(&body)
            }
            HttpMethod::Put => self
                .client
                .put(&tool.endpoint)
                .timeout(tool.timeout())
                .json(input),
            HttpMethod::Delete => {
                let mut r = self.client.delete(&tool.endpoint).timeout(tool.timeout());
                if !input.is_null() {
                    r = r.json(input);
                }
                r
            }
        };
        let resp = req.send().await?;
        let status = resp.status().as_u16();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        Ok((status, body))
    }
}

impl Default for ToolExecutor {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// All 37 tool definitions
// ============================================================================
//
// Endpoints use 127.0.0.1 + canonical Edge ports:
//   L1 node (primary): 9443 RPC, 8333 P2P
//   L1 node (follower): 8448 RPC, 8334 P2P
//   L1 pool: 8444 Stratum, 8080 metrics
//   L2 bridge: 9101, L2 dao: 8450, L2 swap: 8452
//   L3 warp: 8453, L3 dex: 8454, L3 ncl: 8080
//   L4 oasis: 8094, L5 free-world: 8095, L6 issobella: 8096
//   hiran-orchestrator: 8004, hiran-inference: 8002
//   prometheus: 9090
//
// Override via env vars in production (see ToolExecutor::with_env).

const NODE_RPC: &str = "http://127.0.0.1:9443/rpc";
const POOL_API: &str = "http://127.0.0.1:8080";
const BRIDGE_API: &str = "http://127.0.0.1:9101";
const DAO_API: &str = "http://127.0.0.1:8450";
const SWAP_API: &str = "http://127.0.0.1:8452";
const WARP_API: &str = "http://127.0.0.1:8453";
#[allow(dead_code)]
const DEX_API: &str = "http://127.0.0.1:8454";
const NCL_API: &str = "http://127.0.0.1:8080";
const OASIS_API: &str = "http://127.0.0.1:8094";
const FREE_WORLD_API: &str = "http://127.0.0.1:8095";
const ISOBELLA_API: &str = "http://127.0.0.1:8096";
const HIRAN_ORCH: &str = "http://127.0.0.1:8004";
#[allow(dead_code)]
const HIRAN_INFER: &str = "http://127.0.0.1:8002";
const PROMETHEUS_API: &str = "http://127.0.0.1:9090";
// NEW endpoints for full ecosystem coverage
const DASHBOARD_API: &str = "http://127.0.0.1:8766";
#[allow(dead_code)]
const NODE1_RPC: &str = "http://127.0.0.1:9443/rpc";
const NODE2_RPC: &str = "http://127.0.0.1:8448/rpc";
const NODE1_METRICS: &str = "http://127.0.0.1:9100";
#[allow(dead_code)]
const NODE2_METRICS: &str = "http://127.0.0.1:9116";
const POOL_STATS_API: &str = "http://127.0.0.1:8455";
#[allow(dead_code)]
const BASE_RPC: &str = "https://mainnet.base.org";
#[allow(dead_code)]
const BASESCAN_API: &str = "https://api.basescan.org/api";

/// Returns all v2.4 Maestro tools (37 original + 18 new = 55 total).
pub fn all_tools() -> Vec<Tool> {
    vec![
        // ===== L1 Tools (12) =====
        Tool {
            name: "zion_rpc_getblockcount",
            description: "Get current blockchain height",
            sub_agent: SubAgent::NodeSync,
            layer: Layer::L1,
            endpoint: NODE_RPC.to_string(),
            method: HttpMethod::Post,
            rpc_method: Some("getblockcount"),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"result": "integer", "error": "string|null"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_rpc_getnetworkinfo",
            description: "Get network info: peers, sync status, version",
            sub_agent: SubAgent::NodeSync,
            layer: Layer::L1,
            endpoint: NODE_RPC.to_string(),
            method: HttpMethod::Post,
            rpc_method: Some("getnetworkinfo"),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"result": "object", "error": "string|null"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_rpc_getmininginfo",
            description: "Get mining info: difficulty, hashrate, block reward",
            sub_agent: SubAgent::MinerPerformance,
            layer: Layer::L1,
            endpoint: NODE_RPC.to_string(),
            method: HttpMethod::Post,
            rpc_method: Some("getmininginfo"),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"result": "object", "error": "string|null"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_rpc_getaccountbalance",
            description: "Get address balance (account + UTXO)",
            sub_agent: SubAgent::WalletOps,
            layer: Layer::L1,
            endpoint: NODE_RPC.to_string(),
            method: HttpMethod::Post,
            rpc_method: Some("getaccountbalance"),
            input_schema: serde_json::json!({"address": "string"}),
            output_schema: serde_json::json!({"result": "object", "error": "string|null"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_rpc_getsupplyinfo",
            description: "Get supply data: circulating, total, burned",
            sub_agent: SubAgent::WalletOps,
            layer: Layer::L1,
            endpoint: NODE_RPC.to_string(),
            method: HttpMethod::Post,
            rpc_method: Some("getsupplyinfo"),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"result": "object", "error": "string|null"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_rpc_getpeerinfo",
            description: "Get peer list with connection details",
            sub_agent: SubAgent::NodeSync,
            layer: Layer::L1,
            endpoint: NODE_RPC.to_string(),
            method: HttpMethod::Post,
            rpc_method: Some("getpeerinfo"),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"result": "array", "error": "string|null"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_node_ctrl",
            description: "Start/stop/restart zion node service",
            sub_agent: SubAgent::NodeConsensus,
            layer: Layer::L1,
            endpoint: HIRAN_ORCH.to_string(),
            method: HttpMethod::Post,
            rpc_method: None,
            input_schema: serde_json::json!({"action": "start|stop|restart", "node": "primary|follower"}),
            output_schema: serde_json::json!({"ok": "boolean", "error": "string|null"}),
            timeout_ms: 15000,
            retry: 0,
            requires_approval: true,
        },
        Tool {
            name: "zion_miner_ctrl",
            description: "Start/stop/set_algorithm on miner",
            sub_agent: SubAgent::MinerPerformance,
            layer: Layer::L1,
            endpoint: HIRAN_ORCH.to_string(),
            method: HttpMethod::Post,
            rpc_method: None,
            input_schema: serde_json::json!({"action": "start|stop|set_algorithm", "algorithm": "ekam|fire|lite"}),
            output_schema: serde_json::json!({"ok": "boolean", "hashrate": "number|null"}),
            timeout_ms: 10000,
            retry: 1,
            requires_approval: true,
        },
        Tool {
            name: "zion_miner_benchmark",
            description: "Benchmark all 3 algorithms (30s each): ekam, fire, lite",
            sub_agent: SubAgent::MinerPerformance,
            layer: Layer::L1,
            endpoint: HIRAN_ORCH.to_string(),
            method: HttpMethod::Post,
            rpc_method: None,
            input_schema: serde_json::json!({"duration_s": 30}),
            output_schema: serde_json::json!({"ekam": "number", "fire": "number", "lite": "number"}),
            timeout_ms: 120000,
            retry: 0,
            requires_approval: false,
        },
        Tool {
            name: "zion_miner_get_temps",
            description: "Get GPU temperatures",
            sub_agent: SubAgent::MinerThermal,
            layer: Layer::L1,
            endpoint: HIRAN_ORCH.to_string(),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"gpus": "array"}),
            timeout_ms: 5000,
            retry: 1,
            requires_approval: false,
        },
        Tool {
            name: "zion_wallet_ops",
            description: "UTXO management, TX building",
            sub_agent: SubAgent::WalletOps,
            layer: Layer::L1,
            endpoint: NODE_RPC.to_string(),
            method: HttpMethod::Post,
            rpc_method: Some("sendrawtransaction"),
            input_schema: serde_json::json!({"tx_hex": "string"}),
            output_schema: serde_json::json!({"txid": "string", "error": "string|null"}),
            timeout_ms: 10000,
            retry: 1,
            requires_approval: true,
        },
        Tool {
            name: "zion_pool_get_sessions",
            description: "Get active stratum sessions + worker stats",
            sub_agent: SubAgent::PoolWorkers,
            layer: Layer::L1,
            endpoint: format!("{}/sessions", POOL_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"sessions": "array", "total_hashrate": "number"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        // ===== L2 Tools (8) =====
        Tool {
            name: "zion_bridge_get_validators",
            description: "Get 3/5 consensus validator status",
            sub_agent: SubAgent::BridgeValidators,
            layer: Layer::L2,
            endpoint: format!("{}/validators", BRIDGE_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"validators": "array", "active_count": "integer", "threshold": 3}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_bridge_track_tx",
            description: "Track cross-chain TX status",
            sub_agent: SubAgent::BridgeWatcher,
            layer: Layer::L2,
            endpoint: format!("{}/track", BRIDGE_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({"tx_hash": "string"}),
            output_schema: serde_json::json!({"status": "string", "confirmations": "integer"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_dao_get_proposals",
            description: "Get active DAO proposals",
            sub_agent: SubAgent::DaoProposals,
            layer: Layer::L2,
            endpoint: format!("{}/proposals", DAO_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"proposals": "array"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_dao_get_treasury",
            description: "Get treasury balance + tithe tracking",
            sub_agent: SubAgent::DaoTreasury,
            layer: Layer::L2,
            endpoint: format!("{}/treasury", DAO_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"balance": "number", "tithe": "number"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_dao_vote",
            description: "Vote on DAO proposal (requires approval)",
            sub_agent: SubAgent::DaoProposals,
            layer: Layer::L2,
            endpoint: format!("{}/vote", DAO_API),
            method: HttpMethod::Post,
            rpc_method: None,
            input_schema: serde_json::json!({"proposal_id": "integer", "vote": "yes|no|abstain"}),
            output_schema: serde_json::json!({"ok": "boolean", "error": "string|null"}),
            timeout_ms: 10000,
            retry: 0,
            requires_approval: true,
        },
        Tool {
            name: "zion_swap_status",
            description: "Get atomic swap status",
            sub_agent: SubAgent::SwapExecutor,
            layer: Layer::L2,
            endpoint: format!("{}/status", SWAP_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({"swap_id": "string"}),
            output_schema: serde_json::json!({"state": "string", "htlc": "object"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_swap_execute",
            description: "Execute HTLC atomic swap (requires approval)",
            sub_agent: SubAgent::SwapExecutor,
            layer: Layer::L2,
            endpoint: format!("{}/execute", SWAP_API),
            method: HttpMethod::Post,
            rpc_method: None,
            input_schema: serde_json::json!({"swap_id": "string", "secret": "string"}),
            output_schema: serde_json::json!({"ok": "boolean", "txid": "string|null"}),
            timeout_ms: 15000,
            retry: 0,
            requires_approval: true,
        },
        Tool {
            name: "zion_swap_market_rates",
            description: "Get liquidity data + market rates",
            sub_agent: SubAgent::SwapMarket,
            layer: Layer::L2,
            endpoint: format!("{}/rates", SWAP_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"pairs": "array"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        // ===== L3 Tools (6) =====
        Tool {
            name: "zion_ncl_list_providers",
            description: "List AI compute providers in NCL marketplace",
            sub_agent: SubAgent::NclMarket,
            layer: Layer::L3,
            endpoint: format!("{}/providers", NCL_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"providers": "array"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_ncl_submit_job",
            description: "Submit NCL compute job (requires approval)",
            sub_agent: SubAgent::NclScheduler,
            layer: Layer::L3,
            endpoint: format!("{}/jobs", NCL_API),
            method: HttpMethod::Post,
            rpc_method: None,
            input_schema: serde_json::json!({"job_spec": "object"}),
            output_schema: serde_json::json!({"job_id": "string"}),
            timeout_ms: 10000,
            retry: 1,
            requires_approval: true,
        },
        Tool {
            name: "zion_warp_get_routes",
            description: "Get 7-chain routing options (EVM, BTC, Solana, Tron, Stellar, Cardano, Cosmos)",
            sub_agent: SubAgent::WarpRouter,
            layer: Layer::L3,
            endpoint: format!("{}/routes", WARP_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({"from": "string", "to": "string", "amount": "number"}),
            output_schema: serde_json::json!({"routes": "array"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_warp_status",
            description: "Get WARP adapter health per chain",
            sub_agent: SubAgent::WarpValidators,
            layer: Layer::L3,
            endpoint: format!("{}/status", WARP_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"adapters": "object"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_ai_native_get_state",
            description: "Get Hiran consciousness + memory state",
            sub_agent: SubAgent::AiNativeRuntime,
            layer: Layer::L3,
            endpoint: format!("{}/state", HIRAN_ORCH),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"consciousness": "object", "memory": "object"}),
            timeout_ms: 5000,
            retry: 1,
            requires_approval: false,
        },
        Tool {
            name: "zion_ai_native_query",
            description: "RAG retrieval over ZION docs",
            sub_agent: SubAgent::AiNativeMemory,
            layer: Layer::L3,
            endpoint: format!("{}/rag/query", HIRAN_ORCH),
            method: HttpMethod::Post,
            rpc_method: None,
            input_schema: serde_json::json!({"query": "string", "top_k": 5}),
            output_schema: serde_json::json!({"results": "array"}),
            timeout_ms: 10000,
            retry: 1,
            requires_approval: false,
        },
        // ===== L4-L6 Tools (6) =====
        Tool {
            name: "zion_oasis_economy_status",
            description: "Get Oasis game economy status",
            sub_agent: SubAgent::OasisManager,
            layer: Layer::L4,
            endpoint: format!("{}/economy", OASIS_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"gdp": "number", "players": "integer"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_oasis_npc_quality",
            description: "Get NPC AI quality metrics",
            sub_agent: SubAgent::OasisManager,
            layer: Layer::L4,
            endpoint: format!("{}/npc-quality", OASIS_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"score": "number", "incidents": "array"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_free_world_donation_status",
            description: "Get Free World humanitarian fund status",
            sub_agent: SubAgent::FreeWorldOps,
            layer: Layer::L5,
            endpoint: format!("{}/donations", FREE_WORLD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"total": "number", "recipients": "array"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_free_world_impact_report",
            description: "Get humanitarian impact metrics",
            sub_agent: SubAgent::FreeWorldOps,
            layer: Layer::L5,
            endpoint: format!("{}/impact", FREE_WORLD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"metrics": "object"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_issobella_link_status",
            description: "Get Issobella satellite link status",
            sub_agent: SubAgent::IsobellaOps,
            layer: Layer::L6,
            endpoint: format!("{}/links", ISOBELLA_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"links": "array"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_issobella_data_quality",
            description: "Get orbital data quality metrics",
            sub_agent: SubAgent::IsobellaOps,
            layer: Layer::L6,
            endpoint: format!("{}/data-quality", ISOBELLA_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"quality": "number", "gaps": "array"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        // ===== System Tools (5) =====
        Tool {
            name: "docker_list_containers",
            description: "List all Docker containers + status",
            sub_agent: SubAgent::DockerHealth,
            layer: Layer::System,
            endpoint: "unix:///var/run/docker.sock/containers/json".to_string(),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"containers": "array"}),
            timeout_ms: 5000,
            retry: 1,
            requires_approval: false,
        },
        Tool {
            name: "docker_restart_container",
            description: "Restart a Docker container (requires approval)",
            sub_agent: SubAgent::DockerHealth,
            layer: Layer::System,
            endpoint: "unix:///var/run/docker.sock/containers/{id}/restart".to_string(),
            method: HttpMethod::Post,
            rpc_method: None,
            input_schema: serde_json::json!({"container_id": "string"}),
            output_schema: serde_json::json!({"ok": "boolean"}),
            timeout_ms: 15000,
            retry: 0,
            requires_approval: true,
        },
        Tool {
            name: "prometheus_query",
            description: "Run PromQL query against Prometheus",
            sub_agent: SubAgent::PrometheusAlerts,
            layer: Layer::System,
            endpoint: format!("{}/api/v1/query", PROMETHEUS_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({"query": "string"}),
            output_schema: serde_json::json!({"result": "object"}),
            timeout_ms: 10000,
            retry: 1,
            requires_approval: false,
        },
        Tool {
            name: "prometheus_alerts",
            description: "Get active Prometheus alerts",
            sub_agent: SubAgent::PrometheusAlerts,
            layer: Layer::System,
            endpoint: format!("{}/api/v1/alerts", PROMETHEUS_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"alerts": "array"}),
            timeout_ms: 5000,
            retry: 1,
            requires_approval: false,
        },
        Tool {
            name: "backup_trigger",
            description: "Trigger manual backup (requires approval)",
            sub_agent: SubAgent::BackupManager,
            layer: Layer::System,
            endpoint: HIRAN_ORCH.to_string(),
            method: HttpMethod::Post,
            rpc_method: None,
            input_schema: serde_json::json!({"target": "string"}),
            output_schema: serde_json::json!({"ok": "boolean", "path": "string"}),
            timeout_ms: 60000,
            retry: 0,
            requires_approval: true,
        },
        // ===== NEW L1 Tools (3) — Node2 + Pool Stats + Node Metrics =====
        Tool {
            name: "zion_node2_getblockcount",
            description: "Get blockchain height from Node 2 (follower)",
            sub_agent: SubAgent::NodeSync,
            layer: Layer::L1,
            endpoint: NODE2_RPC.to_string(),
            method: HttpMethod::Post,
            rpc_method: Some("getblockcount"),
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"result": "integer", "error": "string|null"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_pool_stats",
            description: "Get pool stats: hashrate, shares, miners, payouts",
            sub_agent: SubAgent::PoolWorkers,
            layer: Layer::L1,
            endpoint: format!("{}/stats", POOL_STATS_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"hashrate": "number", "miners": "integer", "shares": "object"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_node1_metrics",
            description: "Scrape Prometheus metrics from Node 1 (port 9100)",
            sub_agent: SubAgent::NodeMetrics,
            layer: Layer::L1,
            endpoint: format!("{}/metrics", NODE1_METRICS),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"metrics": "string"}),
            timeout_ms: 5000,
            retry: 1,
            requires_approval: false,
        },
        // ===== NEW L2 Tools (2) — DeFi Contracts on Base =====
        Tool {
            name: "zion_defi_staking_status",
            description: "Get ZION Staking status (12% APR, 100K wZION funded) on Base",
            sub_agent: SubAgent::DefiMonitor,
            layer: Layer::L2,
            endpoint: format!("{}/api/defi/staking", DASHBOARD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"tvl": "string", "apr": "number", "stakers": "integer"}),
            timeout_ms: 10000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "zion_defi_farm_status",
            description: "Get ZION Farm status (1 wZION/s, 500K wZION funded) on Base",
            sub_agent: SubAgent::DefiMonitor,
            layer: Layer::L2,
            endpoint: format!("{}/api/defi/farm", DASHBOARD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"rewards_per_second": "number", "tvl": "string"}),
            timeout_ms: 10000,
            retry: 2,
            requires_approval: false,
        },
        // ===== NEW System Tools (13) — Dashboard + DB + Backup + Watchdog + Nginx =====
        Tool {
            name: "dashboard_health",
            description: "Get dashboard aggregate health (all services)",
            sub_agent: SubAgent::DashboardOps,
            layer: Layer::System,
            endpoint: format!("{}/api/health", DASHBOARD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"services": "array", "overall": "string"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "dashboard_services",
            description: "List all Zion services with health + status",
            sub_agent: SubAgent::DashboardOps,
            layer: Layer::System,
            endpoint: format!("{}/api/services", DASHBOARD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"services": "array"}),
            timeout_ms: 5000,
            retry: 2,
            requires_approval: false,
        },
        Tool {
            name: "dashboard_resource_usage",
            description: "Get Edge server resource usage (RAM, disk, CPU)",
            sub_agent: SubAgent::DashboardOps,
            layer: Layer::System,
            endpoint: format!("{}/api/resources", DASHBOARD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"ram": "object", "disk": "object", "cpu": "number"}),
            timeout_ms: 5000,
            retry: 1,
            requires_approval: false,
        },
        Tool {
            name: "dashboard_alerts",
            description: "Get alert history from dashboard",
            sub_agent: SubAgent::DashboardOps,
            layer: Layer::System,
            endpoint: format!("{}/api/alerts", DASHBOARD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"alerts": "array"}),
            timeout_ms: 5000,
            retry: 1,
            requires_approval: false,
        },
        Tool {
            name: "dashboard_revenue",
            description: "Get revenue journal (R4 stream telemetry report)",
            sub_agent: SubAgent::DashboardOps,
            layer: Layer::System,
            endpoint: format!("{}/api/revenue", DASHBOARD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"entries": "array", "total": "string"}),
            timeout_ms: 5000,
            retry: 1,
            requires_approval: false,
        },
        Tool {
            name: "db_list",
            description: "List all 9 Zion databases (SQLite + JSON) with size + mtime",
            sub_agent: SubAgent::DatabaseInspector,
            layer: Layer::System,
            endpoint: format!("{}/api/databases", DASHBOARD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"databases": "array"}),
            timeout_ms: 5000,
            retry: 1,
            requires_approval: false,
        },
        Tool {
            name: "db_inspect",
            description: "Inspect a specific database (tables, row counts, sample rows)",
            sub_agent: SubAgent::DatabaseInspector,
            layer: Layer::System,
            endpoint: format!("{}/api/database/inspect", DASHBOARD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({"path": "string", "limit": "integer?"}),
            output_schema: serde_json::json!({"tables": "array"}),
            timeout_ms: 10000,
            retry: 1,
            requires_approval: false,
        },
        Tool {
            name: "backup_list",
            description: "List all backups (daily + weekly) with size + timestamp",
            sub_agent: SubAgent::BackupManager,
            layer: Layer::System,
            endpoint: format!("{}/api/backups", DASHBOARD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"backups": "array"}),
            timeout_ms: 5000,
            retry: 1,
            requires_approval: false,
        },
        Tool {
            name: "backup_status",
            description: "Get backup timer status (last run, next run, retention)",
            sub_agent: SubAgent::BackupManager,
            layer: Layer::System,
            endpoint: format!("{}/api/backup/status", DASHBOARD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"last_run": "string", "next_run": "string", "count": "integer"}),
            timeout_ms: 5000,
            retry: 1,
            requires_approval: false,
        },
        Tool {
            name: "watchdog_status",
            description: "Get watchdog timer status + last check results",
            sub_agent: SubAgent::WatchdogController,
            layer: Layer::System,
            endpoint: format!("{}/api/watchdog", DASHBOARD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"last_run": "string", "alerts": "array", "autoheal": "boolean"}),
            timeout_ms: 5000,
            retry: 1,
            requires_approval: false,
        },
        Tool {
            name: "watchdog_run",
            description: "Trigger immediate watchdog check (requires approval)",
            sub_agent: SubAgent::WatchdogController,
            layer: Layer::System,
            endpoint: format!("{}/api/watchdog/run", DASHBOARD_API),
            method: HttpMethod::Post,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"ok": "boolean", "alerts": "array"}),
            timeout_ms: 30000,
            retry: 0,
            requires_approval: true,
        },
        Tool {
            name: "nginx_reload",
            description: "Reload nginx config (requires approval)",
            sub_agent: SubAgent::DockerHealth,
            layer: Layer::System,
            endpoint: format!("{}/api/nginx/reload", DASHBOARD_API),
            method: HttpMethod::Post,
            rpc_method: None,
            input_schema: serde_json::json!({}),
            output_schema: serde_json::json!({"ok": "boolean", "message": "string"}),
            timeout_ms: 10000,
            retry: 0,
            requires_approval: true,
        },
        Tool {
            name: "service_logs",
            description: "Get recent log lines for a service (tail)",
            sub_agent: SubAgent::DashboardOps,
            layer: Layer::System,
            endpoint: format!("{}/api/logs", DASHBOARD_API),
            method: HttpMethod::Get,
            rpc_method: None,
            input_schema: serde_json::json!({"service": "string", "lines": "integer?"}),
            output_schema: serde_json::json!({"lines": "array"}),
            timeout_ms: 5000,
            retry: 1,
            requires_approval: false,
        },
    ]
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_has_55_tools() {
        let reg = ToolRegistry::with_all_tools();
        assert_eq!(reg.len(), 55, "v2.4 Maestro expanded spec requires 55 tools");
    }

    #[test]
    fn test_layer_distribution() {
        let reg = ToolRegistry::with_all_tools();
        assert_eq!(reg.tools_for_layer(Layer::L1).len(), 15, "L1 should have 15 tools");
        assert_eq!(reg.tools_for_layer(Layer::L2).len(), 10, "L2 should have 10 tools");
        assert_eq!(reg.tools_for_layer(Layer::L3).len(), 6, "L3 should have 6 tools");
        assert_eq!(reg.tools_for_layer(Layer::L4).len(), 2, "L4 should have 2 tools");
        assert_eq!(reg.tools_for_layer(Layer::L5).len(), 2, "L5 should have 2 tools");
        assert_eq!(reg.tools_for_layer(Layer::L6).len(), 2, "L6 should have 2 tools");
        assert_eq!(reg.tools_for_layer(Layer::System).len(), 18, "System should have 18 tools");
    }

    #[test]
    fn test_sub_agent_layer_mapping() {
        assert_eq!(SubAgent::NodeSync.layer(), Layer::L1);
        assert_eq!(SubAgent::BridgeValidators.layer(), Layer::L2);
        assert_eq!(SubAgent::WarpRouter.layer(), Layer::L3);
        assert_eq!(SubAgent::OasisManager.layer(), Layer::L4);
        assert_eq!(SubAgent::FreeWorldOps.layer(), Layer::L5);
        assert_eq!(SubAgent::IsobellaOps.layer(), Layer::L6);
        assert_eq!(SubAgent::DockerHealth.layer(), Layer::System);
    }

    #[test]
    fn test_intent_to_sub_agents() {
        assert!(Intent::SystemHealth
            .required_sub_agents()
            .contains(&SubAgent::NodeSync));
        assert!(Intent::MinerControl
            .required_sub_agents()
            .contains(&SubAgent::MinerThermal));
        assert_eq!(Intent::WalletQuery.required_sub_agents(), &[SubAgent::WalletOps]);
    }

    #[test]
    fn test_intent_to_tools() {
        let reg = ToolRegistry::with_all_tools();
        let tools = reg.tools_for_intent(&Intent::NodeInfo);
        assert!(!tools.is_empty(), "NodeInfo intent should resolve to tools");
        assert!(tools.iter().any(|t| t.name == "zion_rpc_getblockcount"));
    }

    #[test]
    fn test_approval_required_tools() {
        let reg = ToolRegistry::with_all_tools();
        let approval = reg.approval_required_tools();
        // Critical ops: node_ctrl, miner_ctrl, wallet_ops, dao_vote, swap_execute,
        // ncl_submit_job, docker_restart, backup_trigger
        assert!(approval.len() >= 8, "At least 8 tools should require approval");
        assert!(approval.iter().any(|t| t.name == "zion_node_ctrl"));
        assert!(approval.iter().any(|t| t.name == "zion_dao_vote"));
        assert!(approval.iter().any(|t| t.name == "docker_restart_container"));
    }

    #[test]
    fn test_tool_lookup() {
        let reg = ToolRegistry::with_all_tools();
        let t = reg.get("zion_rpc_getblockcount").expect("tool exists");
        assert_eq!(t.sub_agent, SubAgent::NodeSync);
        assert_eq!(t.method, HttpMethod::Post);
        assert_eq!(t.rpc_method, Some("getblockcount"));
        assert!(!t.requires_approval);
    }

    #[test]
    fn test_tool_not_found() {
        let reg = ToolRegistry::with_all_tools();
        assert!(reg.get("nonexistent_tool").is_none());
    }

    #[test]
    fn test_tool_executor_construction() {
        let _exec = ToolExecutor::new();
        let _exec2 = ToolExecutor::default();
    }

    #[tokio::test]
    async fn test_executor_tool_not_found() {
        let reg = ToolRegistry::new(); // empty
        let exec = ToolExecutor::new();
        let res = exec.execute(&reg, "nope", serde_json::json!({})).await;
        assert!(res.is_err(), "Should error on unknown tool");
    }

    #[test]
    fn test_all_tools_unique_names() {
        let tools = all_tools();
        let mut names: Vec<&str> = tools.iter().map(|t| t.name).collect();
        names.sort();
        let initial = names.len();
        names.dedup();
        assert_eq!(names.len(), initial, "All tool names must be unique");
    }

    #[test]
    fn test_layer_as_str() {
        assert_eq!(Layer::L1.as_str(), "L1");
        assert_eq!(Layer::System.as_str(), "System");
    }

    #[test]
    fn test_sub_agent_as_str() {
        assert_eq!(SubAgent::NodeSync.as_str(), "NodeSync");
        assert_eq!(SubAgent::DockerHealth.as_str(), "DockerHealth");
    }
}
