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

use std::net::SocketAddr;
use tracing::info;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};
use zion_warp::WarpConfig;

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

    // ── State ─────────────────────────────────────────────────────────────────
    // Prefer persistent SQLite storage; fall back to in-memory if path is empty.
    let state = if config.database_path.is_empty() {
        info!("No database_path configured — using in-memory storage");
        zion_warp::WarpState::new(config.clone())
    } else {
        // Ensure parent directory exists
        if let Some(parent) = std::path::Path::new(&config.database_path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        match zion_warp::WarpState::with_db(config.clone(), &config.database_path) {
            Ok(s) => {
                info!(path = %config.database_path, "SQLite persistence enabled");
                s
            }
            Err(e) => {
                tracing::warn!(err = %e, "Failed to open database — falling back to in-memory");
                zion_warp::WarpState::new(config.clone())
            }
        }
    };

    // ── Watcher ───────────────────────────────────────────────────────────────
    // Extract router/db references before consuming `state` into Axum
    let watcher_router = state.router.clone();
    let watcher_db = state.db.clone();
    let watcher = zion_warp::WarpWatcher::from_config(config.clone(), watcher_router, watcher_db);
    tokio::spawn(watcher.run());
    info!("Chain watcher spawned");

    // ── Router ────────────────────────────────────────────────────────────────
    let app = zion_warp::create_api_router(state);

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
