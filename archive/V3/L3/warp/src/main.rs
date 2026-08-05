//! # WARP Bridge Daemon — L3
//!
//! Starts the WARP REST API server and initializes the bridge router.
//!
//! ## Usage
//!
//! ```bash
//! # Default (reads from config/warp-testnet.toml or uses defaults)
//! cargo run -p zion-warp
//!
//! # With custom config
//! WARP_CONFIG=config/warp-mainnet.toml cargo run -p zion-warp
//! ```
//!
//! ## Default server address: `0.0.0.0:9333`

use chrono::Timelike;
use std::net::SocketAddr;
use tracing::info;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};
use zion_warp::{
    create_api_router, OutboundExecutor, TimelockMonitor, WarpConfig, WarpState, WarpWatcher,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // ── Logging ───────────────────────────────────────────────────────────────
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_default_env().add_directive("zion_warp=info".parse().unwrap()))
        .init();

    // ── Config ────────────────────────────────────────────────────────────────
    let config = load_config();
    info!(
        node_id = %config.node_id,
        port    = config.listen_port,
        quorum  = config.quorum,
        "WARP bridge daemon starting"
    );

    // ── Shared State ──────────────────────────────────────────────────────────
    // Create shared state with validator set inside router
    let state = if config.database_path.is_empty() {
        info!("No database_path configured — using in-memory storage");
        WarpState::new(config.clone())
    } else {
        // Ensure parent directory exists
        if let Some(parent) = std::path::Path::new(&config.database_path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        match WarpState::with_db(config.clone(), &config.database_path) {
            Ok(s) => {
                info!(path = %config.database_path, "SQLite persistence enabled");
                s
            }
            Err(e) => {
                tracing::warn!(err = %e, "Failed to open database — falling back to in-memory");
                WarpState::new(config.clone())
            }
        }
    };

    // The validator_set is already shared inside the router (Arc<Mutex<WarpValidatorSet>>)
    // We extract it for the executor and timelock monitor
    let validators = {
        let router = state.router.lock().await;
        router.validator_set.clone()
    };

    // ── Background Tasks ──────────────────────────────────────────────────────

    // 1. Chain Watcher (watches external chains for inbound deposits)
    let watcher_router = state.router.clone();
    let watcher_db = state.db.clone();
    let watcher = WarpWatcher::from_config(config.clone(), watcher_router, watcher_db);
    tokio::spawn(watcher.run());
    info!("Chain watcher spawned");

    // 2. Outbound Executor (executes mint on destination chains after quorum)
    let executor = OutboundExecutor::new(state.router.clone(), validators.clone());
    tokio::spawn(executor.run());
    info!("Outbound executor spawned");

    // 3. Timelock Monitor (releases transfers from 24h hold)
    // Config is in ZION (1 ZION = 1,000,000 flowers), timelock needs seconds
    let timelock_hold_seconds = config.timelock_threshold_zion * 86400; // 1 ZION day = 86400 seconds
    let timelock_monitor = TimelockMonitor::new(state.router.clone(), timelock_hold_seconds);
    tokio::spawn(timelock_monitor.run());
    info!("Timelock monitor spawned");

    // 4. Daily Volume Reset (resets daily limits at midnight UTC)
    let daily_router = state.router.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600)); // Check hourly
        loop {
            interval.tick().await;
            let now = chrono::Utc::now();
            // Reset at midnight UTC (hour 0, minute 0-5)
            if now.hour() == 0 && now.minute() < 5 {
                let mut router = daily_router.lock().await;
                router.reset_daily_volumes();
                info!("[DailyReset] Daily volume counters reset at midnight UTC");
                // Sleep a bit to avoid multiple resets in same window
                tokio::time::sleep(tokio::time::Duration::from_secs(300)).await;
            }
        }
    });
    info!("Daily volume reset task spawned");

    // ── Router ────────────────────────────────────────────────────────────────
    let app = create_api_router(state);

    // ── Bind ──────────────────────────────────────────────────────────────────
    let addr: SocketAddr = format!("{}:{}", config.listen_addr, config.listen_port)
        .parse()
        .expect("Invalid listen address");

    info!(addr = %addr, "WARP server listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

fn load_config() -> WarpConfig {
    // 1. Try env var pointing to a TOML file
    if let Ok(path) = std::env::var("WARP_CONFIG") {
        if let Ok(content) = std::fs::read_to_string(&path) {
            match WarpConfig::load_from_str(&content) {
                Ok(cfg) => {
                    info!(path = %path, "Loaded WARP config from file");
                    return cfg;
                }
                Err(e) => {
                    eprintln!("Failed to parse config at {}: {}", path, e);
                }
            }
        }
    }

    // 2. Try default config paths
    for path in &["config/warp-testnet.toml", "config/warp-mainnet.toml"] {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(cfg) = WarpConfig::load_from_str(&content) {
                info!(path = %path, "Loaded WARP config from default path");
                return cfg;
            }
        }
    }

    // 3. Built-in defaults (development mode)
    info!("No config file found — using built-in defaults (dev mode)");
    WarpConfig::default()
}
