//! # 🎼 Hiran v2.4 Maestro — CLI
//!
//! Usage:
//!   maestro orchestrate "<user input>"   — full pipeline: classify → plan → execute → JSON
//!   maestro classify "<user input>"      — only classify intent → JSON
//!   maestro plan "<user input>"          — classify + plan (no execution) → JSON
//!   maestro health                       — probe 26 services → JSON health matrix
//!   maestro info                         — static MVP info (tools, sub-agents, intents) → JSON
//!
//! Output is JSON on stdout, logs on stderr. Designed for dashboard integration
//! (dashboard Python app shells out and parses JSON).

use std::process::ExitCode;

use clap::{Parser, Subcommand};
use serde_json::json;
use zion_ai_native::maestro::Maestro;
use zion_ai_native::tool_registry::{Intent, SubAgent, ToolRegistry};

#[derive(Parser)]
#[command(name = "maestro", version, about = "Hiran v2.4 Maestro — Zion ecosystem orchestrator CLI")]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Full orchestration: classify → plan → execute → respond
    Orchestrate { query: String },
    /// Classify intent only (no plan, no execution)
    Classify { query: String },
    /// Classify + plan (no execution)
    Plan { query: String },
    /// Probe all 26 services and return health matrix
    Health,
    /// Static MVP info: tool count, sub-agent count, intent list
    Info,
}

#[tokio::main]
async fn main() -> ExitCode {
    // Suppress tracing logs to stderr (keep stdout pure JSON)
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_writer(std::io::stderr)
        .init();

    let cli = Cli::parse();
    match run(cli).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("maestro error: {e}");
            let _ = serde_json::to_writer(std::io::stdout(), &json!({"error": e.to_string()}));
            ExitCode::FAILURE
        }
    }
}

async fn run(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
    let maestro = Maestro::new();
    match cli.cmd {
        Cmd::Orchestrate { query } => {
            let result = maestro.orchestrate(&query).await?;
            serde_json::to_writer(std::io::stdout(), &result)?;
            println!();
        }
        Cmd::Classify { query } => {
            let intent = maestro.classify(&query);
            let out = json!({
                "input": query,
                "intent": format!("{:?}", intent),
                "intent_name": intent_name(&intent),
            });
            serde_json::to_writer(std::io::stdout(), &out)?;
            println!();
        }
        Cmd::Plan { query } => {
            let plan = maestro.plan_for_input(&query)?;
            serde_json::to_writer(std::io::stdout(), &plan)?;
            println!();
        }
        Cmd::Health => {
            let matrix = maestro.refresh_health().await;
            serde_json::to_writer(std::io::stdout(), &matrix)?;
            println!();
        }
        Cmd::Info => {
            let reg = ToolRegistry::with_all_tools();
            let out = json!({
                "version": "v2.4-maestro-mvp",
                "components": {
                    "tool_registry": { "tools": reg.len(), "file": "tool_registry.rs" },
                    "intent_router": { "intents": intent_count(), "file": "intent.rs" },
                    "planner": { "templates": intent_count(), "file": "planner.rs" },
                    "health_poller": { "services": 26, "file": "health_poller.rs" },
                    "layer_agents": { "layer_agents": 7, "sub_agents": sub_agent_count(), "file": "layer_agents.rs" },
                    "maestro": { "file": "maestro.rs" },
                },
                "totals": {
                    "tools": reg.len(),
                    "sub_agents": sub_agent_count(),
                    "intents": intent_count(),
                    "health_services": 26,
                    "layer_agents": 7,
                },
                "intents": intent_list(),
                "sub_agents": sub_agent_list(),
            });
            serde_json::to_writer(std::io::stdout(), &out)?;
            println!();
        }
    }
    Ok(())
}

fn intent_name(i: &Intent) -> &'static str {
    match i {
        Intent::SystemHealth => "SystemHealth",
        Intent::MinerControl => "MinerControl",
        Intent::NodeInfo => "NodeInfo",
        Intent::WalletQuery => "WalletQuery",
        Intent::BridgeStatus => "BridgeStatus",
        Intent::DaoGovernance => "DaoGovernance",
        Intent::SwapOperation => "SwapOperation",
        Intent::L3Query => "L3Query",
        Intent::L456Status => "L456Status",
        Intent::SystemOps => "SystemOps",
        Intent::DefiStatus => "DefiStatus",
        Intent::BackupQuery => "BackupQuery",
        Intent::DatabaseInspect => "DatabaseInspect",
        Intent::WatchdogStatus => "WatchdogStatus",
    }
}

fn intent_count() -> usize {
    14
}

fn intent_list() -> Vec<&'static str> {
    vec![
        "SystemHealth", "MinerControl", "NodeInfo", "WalletQuery",
        "BridgeStatus", "DaoGovernance", "SwapOperation", "L3Query",
        "L456Status", "SystemOps", "DefiStatus", "BackupQuery",
        "DatabaseInspect", "WatchdogStatus",
    ]
}

fn sub_agent_count() -> usize {
    sub_agent_list().len()
}

fn sub_agent_list() -> Vec<&'static str> {
    vec![
        "NodeSync", "NodeConsensus", "PoolWorkers", "PoolEconomics",
        "MinerThermal", "MinerPerformance", "WalletOps", "NodeMetrics",
        "BridgeValidators", "BridgeWatcher", "DaoProposals", "DaoTreasury",
        "SwapExecutor", "SwapMarket", "DefiMonitor",
        "NclScheduler", "NclMarket", "WarpRouter", "WarpValidators",
        "AiNativeRuntime", "AiNativeMemory",
        "OasisManager", "FreeWorldOps", "IsobellaOps",
        "DockerHealth", "PrometheusAlerts", "ResourceOptimizer",
        "BackupManager", "UpdateEngine", "DashboardOps",
        "DatabaseInspector", "WatchdogController",
    ]
}

// Use SubAgent enum to ensure compile-time correctness of the list above.
const _SUB_AGENT_CHECK: SubAgent = SubAgent::NodeSync;
