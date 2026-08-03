use std::sync::Arc;
use tracing_subscriber::EnvFilter;

use ziondex_router::{
    api::{build_router, AppState},
    config::RouterConfig,
    db,
    executor::Executor,
    quote::QuoteEngine,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,ziondex_router=debug")),
        )
        .init();

    let config = RouterConfig::load("ziondex-router.toml").unwrap_or_else(|e| {
        tracing::warn!("Failed to load config ({}), using defaults", e);
        RouterConfig::default()
    });

    tracing::info!("ZionDex Router starting...");
    tracing::info!("Bind address: {}", config.bind_address);
    tracing::info!("Database: {}", config.db_path);
    tracing::info!("Chains configured: {}", config.dex_registry.len());

    // Initialize database
    let db = db::shared_db(&config.db_path)?;

    // Initialize components
    let quote_engine = Arc::new(QuoteEngine::new(config.clone()));
    let executor = Arc::new(Executor::new(config.clone(), db.clone()));

    let state = AppState {
        quote_engine,
        executor,
        db,
        start_time: std::time::Instant::now(),
    };

    // Build router (includes WebSocket /stream route)
    let app = build_router(state.clone());

    // Start server
    let listener = tokio::net::TcpListener::bind(&config.bind_address).await?;
    tracing::info!("ZionDex Router listening on {}", config.bind_address);

    axum::serve(listener, app).await?;

    Ok(())
}
