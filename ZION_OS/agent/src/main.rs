use axum::{
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

mod api;
mod command_queue;
mod config;
mod gpu_telemetry;
mod miner_ctl;
mod miner_parser;
mod node_discovery;
mod oc_manager;
mod telemetry;
mod updater;
mod watchdog;

use config::AgentConfig;

/// Globální stav agenta
#[derive(Debug)]
pub struct AgentState {
    pub config: RwLock<AgentConfig>,
    pub miner_pid: RwLock<Option<u32>>,
    pub miner_stats: Arc<RwLock<miner_parser::MinerStats>>,
    pub rig_id: String,
    pub version: String,
    pub discovery: Arc<node_discovery::DiscoveryState>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StatusResponse {
    pub rig_id: String,
    pub version: String,
    pub uptime_sec: u64,
    pub mode: String,
    pub miner_running: bool,
    pub gpu_count: usize,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StartMinerRequest {
    pub flight_sheet_id: Option<String>,
    pub pool: Option<String>,
    pub wallet: Option<String>,
    pub worker: Option<String>,
    pub gpu_backend: Option<String>,
    pub algorithm: Option<String>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::new("zion_agent=info,tower_http=debug"))
        .init();

    info!("=== ZION Agent v1.0.0 starting ===");

    // Nacti konfiguraci
    let config = config::load_config().await.unwrap_or_else(|e| {
        warn!("Nemohu nacist konfiguraci ({}), pouzivam defaults", e);
        AgentConfig::default()
    });

    let rig_id = config.rig_id.clone().unwrap_or_else(|| {
        let id = format!("rig-{}", uuid::Uuid::new_v4().to_string()[..8].to_string());
        warn!("rig_id neni nastaveno, generuji: {}", id);
        id
    });

    let state = Arc::new(AgentState {
        config: RwLock::new(config),
        miner_pid: RwLock::new(None),
        miner_stats: Arc::new(RwLock::new(miner_parser::MinerStats::default())),
        rig_id,
        version: "1.0.0".to_string(),
        discovery: node_discovery::DiscoveryState::new(),
    });

    // Spust pozadi tasky
    let telemetry_handle = tokio::spawn(telemetry::collector_loop(state.clone()));
    let watchdog_handle = tokio::spawn(watchdog::engine_loop(state.clone()));
    let updater_handle = tokio::spawn(updater::check_loop(state.clone()));
    let discovery_handle = tokio::spawn(node_discovery::discovery_loop(state.discovery.clone()));

    // Vytvor HTTP API
    let app = Router::new()
        .route("/api/status", get(api::status_handler))
        .route("/api/miner/start", post(api::start_miner_handler))
        .route("/api/miner/stop", post(api::stop_miner_handler))
        .route("/api/miner/restart", post(api::restart_miner_handler))
        .route("/api/telemetry", get(api::telemetry_handler))
        .route("/api/gpu", get(api::gpu_handler))
        .route("/api/config", get(api::get_config_handler).post(api::post_config_handler))
        .route("/api/commands/pending", get(api::pending_commands_handler))
        .route("/api/commands/:id/ack", post(api::ack_command_handler))
        .route("/api/commands/:id/result", post(api::command_result_handler))
        .route("/api/nodes/discovered", get(api::discovered_nodes_handler))
        .route("/api/nodes/rewards", get(api::node_rewards_handler))
        .route("/health", get(|| async { "OK" }))
        .with_state(state.clone());

    // Bind
    let bind = {
        let cfg = state.config.read().await;
        cfg.api_bind.clone()
    };
    let listener = tokio::net::TcpListener::bind(&bind).await?;
    info!("HTTP API nasloucha na {}", bind);

    // Graceful shutdown
    let shutdown = tokio::spawn(async move {
        tokio::signal::ctrl_c().await.ok();
        info!("SIGINT prijat, ukoncuji...");
    });

    // Pokud je autonomni mod a auto_start_miner, spust miner
    {
        let cfg = state.config.read().await;
        if cfg.autonomous_mode && cfg.auto_start_miner {
            info!("Autonomni mod: spoustim miner...");
            if let Err(e) = miner_ctl::start_miner(state.clone(), None).await {
                warn!("Auto-start mineru selhal: {}", e);
            }
        }
    }

    // Run server + pozadi tasky
    tokio::select! {
        _ = axum::serve(listener, app) => {},
        _ = shutdown => {},
    }

    // Cleanup
    telemetry_handle.abort();
    watchdog_handle.abort();
    updater_handle.abort();
    discovery_handle.abort();
    info!("ZION Agent ukoncen");
    Ok(())
}
