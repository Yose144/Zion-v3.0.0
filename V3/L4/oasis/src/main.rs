//! ZION OASIS — V3 L4 Consciousness Mining Game Server
//!
//! Usage:
//!   zion-oasis [--config path/to/oasis.toml]
//!
//! Environment variables:
//!   OASIS_PORT    — override API port (default: 8094)
//!   OASIS_DB      — path to SQLite database (default: ./oasis.db)
//!   OASIS_BIND    — bind address (default: 0.0.0.0)
//!   RUST_LOG      — log level (default: info)

use std::sync::Arc;
use tracing::info;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};
use zion_oasis::{
    blockchain_listener::L1BlockListener,
    config::OasisConfig,
    db::OasisDb,
    metrics::OasisMetrics,
    quests::{QuestManager, QuestRegistry},
    server::{start_server, OasisState},
    websocket::{WsEvent, WsHub},
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Logging
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    info!("🎮 Starting ZION OASIS v{}", env!("CARGO_PKG_VERSION"));

    // Config — defaults + env overrides
    let mut config = OasisConfig::default();

    if let Ok(port) = std::env::var("OASIS_PORT") {
        config.port = port.parse().unwrap_or(config.port);
    }
    if let Ok(bind) = std::env::var("OASIS_BIND") {
        config.bind = bind;
    }
    if let Ok(url) = std::env::var("OASIS_HIRAN_URL") {
        config.hiran_endpoint = Some(url);
    }
    if let Ok(enabled) = std::env::var("OASIS_HIRAN_ENABLED") {
        config.hiran_enabled = enabled.eq_ignore_ascii_case("true");
    }

    // Database
    let db_path = std::env::var("OASIS_DB").unwrap_or_else(|_| "./oasis.db".to_string());
    info!("Opening OASIS database: {}", db_path);
    let db = OasisDb::open(&db_path)?;

    // Load quest definitions from avatars.json
    let avatars_path =
        std::env::var("OASIS_AVATARS_PATH").unwrap_or_else(|_| "data/avatars.json".to_string());
    let quest_mgr = match std::fs::read_to_string(&avatars_path) {
        Ok(data) => match QuestRegistry::from_avatars_json(&data) {
            Ok(registry) => {
                info!("Loaded {} quests from {}", registry.len(), avatars_path);
                Arc::new(QuestManager::new(registry))
            }
            Err(e) => {
                tracing::warn!("Failed to parse quest registry: {}", e);
                Arc::new(QuestManager::new(QuestRegistry::default()))
            }
        },
        Err(e) => {
            tracing::warn!("Could not read {}: {}", avatars_path, e);
            Arc::new(QuestManager::new(QuestRegistry::default()))
        }
    };

    // Metrics
    let metrics = OasisMetrics::new();

    // Seed active_quests gauge from quest registry
    metrics.active_quests.store(
        quest_mgr.registry.len() as u64,
        std::sync::atomic::Ordering::Relaxed,
    );

    // WebSocket broadcast hub
    let ws_hub = WsHub::new();

    info!("Consciousness levels: 9 (Physical → OnTheStar)");
    info!("Reward pool: 8,250,000,000 ZION over 10 years");
    if config.hiran_enabled {
        info!(
            "🤖 Hiran AI enabled — endpoint: {}",
            config
                .hiran_endpoint
                .as_deref()
                .unwrap_or("http://localhost:8002")
        );
    } else {
        info!("Hiran AI disabled (set OASIS_HIRAN_ENABLED=true to enable)");
    }

    let state = OasisState::new(db, config, quest_mgr, metrics, Some(ws_hub.clone()));

    // Spawn L1 blockchain listener (awards XP to miners + broadcasts WS events)
    if let Ok(rpc_url) = std::env::var("OASIS_L1_RPC_URL") {
        if !rpc_url.is_empty() {
            info!("🔗 Spawning L1 blockchain listener — rpc_url={}", rpc_url);
            let ws_hub_for_listener = ws_hub.clone();
            let db_for_listener = state.db.clone();
            tokio::spawn(async move {
                L1BlockListener::new(rpc_url)
                    .with_poll_interval(10)
                    .start(move |event| {
                        info!(
                            "L1 block #{} mined by {} ({} flowers)",
                            event.block_height, event.miner_address, event.subsidy_flowers
                        );
                        // Award XP to the miner
                        if let Ok(mut player) = db_for_listener.get_or_create_player(&event.miner_address) {
                            let xp_gain = event.subsidy_flowers / 1_000_000; // 1 XP per ZION mined
                            if xp_gain > 0 {
                                player.total_xp = player.total_xp.saturating_add(xp_gain);
                                player.level =
                                    zion_oasis::consciousness::ConsciousnessLevel::from_xp(player.total_xp);
                                let _ = db_for_listener.save_player(&player);
                            }
                        }
                        // Broadcast BlockMined event to WebSocket subscribers
                        ws_hub_for_listener.broadcast(WsEvent::BlockMined {
                            block_height: event.block_height,
                            miner_address: event.miner_address,
                            subsidy_flowers: event.subsidy_flowers,
                        });
                    })
                    .await;
            });
        }
    } else {
        info!("OASIS_L1_RPC_URL not set — L1 blockchain listener disabled");
    }

    start_server(state).await
}
