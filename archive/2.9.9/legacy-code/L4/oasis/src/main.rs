//! ZION OASIS — L4 Consciousness Mining Game Server
//!
//! Usage:
//!   zion-oasis [--config path/to/oasis.toml]
//!
//! Environment variables:
//!   OASIS_PORT    — override API port (default: 8094)
//!   OASIS_DB      — path to SQLite database (default: ./oasis.db)
//!   OASIS_BIND    — bind address (default: 0.0.0.0)
//!   RUST_LOG      — log level (default: info)

use tracing::info;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};
use zion_oasis::{
    config::OasisConfig,
    db::OasisDb,
    server::{start_server, OasisState},
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

    // Database
    let db_path = std::env::var("OASIS_DB").unwrap_or_else(|_| "./oasis.db".to_string());
    info!("Opening OASIS database: {}", db_path);
    let db = OasisDb::open(&db_path)?;

    let state = OasisState::new(db, config);

    info!(
        "Consciousness levels: 9 (Physical → OnTheStar)"
    );
    info!(
        "Reward pool: 8,250,000,000 ZION over 10 years"
    );

    start_server(state).await
}
