//! ZionDex Solver Daemon — CLI entry point.
//!
//! The solver is a standalone off-chain service that:
//! 1. Listens for `SwapIntent`s (via its REST API on port 8455).
//! 2. Queries the ZionDex Router (`GET /quote/multi`) for optimal paths.
//! 3. Computes a competitive bid using a [`BiddingStrategy`].
//! 4. Submits the bid to the auction and, on winning, executes the swap via
//!    the Router's `POST /swap`.
//!
//! Run with `--help` for options. Configuration can also be supplied via
//! `ZION_SOLVER_*` environment variables.

use std::sync::Arc;

use tokio::sync::Mutex;
use tracing_subscriber::EnvFilter;

use ziondex_solver::api;
use ziondex_solver::config::SolverConfig;
use ziondex_solver::errors;
use ziondex_solver::node::SolverNode;

#[tokio::main]
async fn main() -> errors::Result<()> {
    // Initialize tracing.
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,ziondex_solver=debug")),
        )
        .init();

    // Load + validate config.
    let raw = SolverConfig::parse_cli();
    let config = raw.resolve()?;

    tracing::info!("ZionDex Solver Daemon starting...");
    tracing::info!("Router URL: {}", config.router_url);
    tracing::info!("Bind address: {}", config.bind_address);
    tracing::info!(
        "min_profit_bps={} max_gas_gwei={} auction_timeout={}s",
        config.min_profit_bps,
        config.max_gas_gwei,
        config.auction_timeout_secs,
    );
    if config.solver_key.is_none() {
        tracing::warn!(
            "no solver key configured — running in dry-run mode (will not execute swaps)"
        );
    }

    // Construct the solver node.
    let node: Arc<Mutex<SolverNode>> = SolverNode::new(config.clone()).await?;

    // Liveness check against the router (non-fatal if it fails at boot).
    {
        let n = node.lock().await;
        match n.router_client.health().await {
            Ok(true) => tracing::info!("router health: ok"),
            Ok(false) => tracing::warn!("router health: reported not-ok"),
            Err(e) => tracing::warn!("router health check failed: {}", e),
        }
    }

    // Build the solver REST API.
    let app = api::build_api(node.clone());

    // Spawn the stats-logging loop.
    let node_loop = node.clone();
    tokio::spawn(async move {
        if let Err(e) = SolverNode::run(node_loop).await {
            tracing::error!("solver node loop exited: {}", e);
        }
    });

    // Start serving.
    let listener = tokio::net::TcpListener::bind(&config.bind_address)
        .await
        .map_err(|e| errors::Error::Other(format!("bind {}: {}", config.bind_address, e)))?;
    tracing::info!("ZionDex Solver listening on {}", config.bind_address);

    axum::serve(listener, app)
        .await
        .map_err(|e| errors::Error::Other(format!("axum serve: {}", e)))?;

    Ok(())
}
