use std::sync::Arc;

use tokio::sync::Mutex;
use tracing::info;

use zion_swap_aggregator::{
    api::{router, AppState},
    db::SwapDb,
    orchestrator::{OrchestratorConfig, SwapOrchestrator},
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter("zion_swap_aggregator=info,tower=warn")
        .init();

    info!(
        "Starting ZION Swap Aggregator v{}",
        env!("CARGO_PKG_VERSION")
    );

    // Load configuration
    let config = load_config();
    let bind_addr = std::env::var("SWAP_AGGREGATOR_BIND").unwrap_or_else(|_| "0.0.0.0:8456".into());

    // Open database
    let db_path =
        std::env::var("SWAP_AGGREGATOR_DB").unwrap_or_else(|_| "swap-aggregator.db".into());
    info!("Opening database: {}", db_path);
    let db = Arc::new(Mutex::new(SwapDb::open(&db_path)?));

    // Create orchestrator
    let orchestrator = Arc::new(SwapOrchestrator::new(config, Arc::clone(&db)));

    // Build app state
    let state = AppState { orchestrator, db };

    // Build router
    let app = router(state);

    info!("Listening on http://{}", bind_addr);
    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

fn load_config() -> OrchestratorConfig {
    let mut config = OrchestratorConfig::default();

    if let Ok(url) = std::env::var("BRIDGE_API_URL") {
        config.bridge_api_url = url;
    }
    if let Ok(url) = std::env::var("BASE_RPC_URL") {
        config.base_rpc_url = url;
    }
    if let Ok(addr) = std::env::var("WZION_ADDRESS") {
        config.wzion_address = addr;
    }
    if let Ok(addr) = std::env::var("UNIV3_POOL_ADDRESS") {
        config.univ3_pool_address = addr;
    }
    if let Ok(addr) = std::env::var("UNIV3_ROUTER_ADDRESS") {
        config.univ3_router_address = addr;
    }
    if let Ok(addr) = std::env::var("QUOTER_V2_ADDRESS") {
        config.quoter_v2_address = addr;
    }
    if let Ok(v) = std::env::var("MAX_SLIPPAGE_BPS")
        .and_then(|s| s.parse().map_err(|_| std::env::VarError::NotPresent))
    {
        config.max_slippage_bps = v;
    }

    config
}
