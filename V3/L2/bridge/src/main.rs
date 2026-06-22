//! Bridge relay entry point.
//!
//! Usage:
//!   zion-bridge --config config/bridge.toml
//!
//! Or with env vars:
//!   ZION_BRIDGE_CONFIG=config/bridge.toml zion-bridge

use anyhow::Result;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info};

use zion_bridge::config::BridgeConfig;
use zion_bridge::db::BridgeDb;
use zion_bridge::evm_watcher::EvmWatcher;
use zion_bridge::l1_watcher::L1Watcher;
use zion_bridge::metrics::{serve_metrics, BridgeMetrics};
use zion_bridge::relayer::Relayer;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    info!("🌉 ZION Bridge Relay v{}", env!("CARGO_PKG_VERSION"));
    info!("   L1 ↔ EVM cross-chain bridge");

    // Load config
    let config_path = std::env::var("ZION_BRIDGE_CONFIG").unwrap_or_else(|_| {
        std::env::args()
            .nth(2)
            .unwrap_or_else(|| "config/bridge.toml".into())
    });

    let config = BridgeConfig::load(&config_path)?;
    config.validate_runtime()?;
    let config = Arc::new(config);

    info!("📋 Network: {}", config.bridge.network);
    info!("📋 L1 RPC: {}", config.l1.rpc_url);
    info!("📋 Bridge address: {}", config.l1.bridge_address);
    info!(
        "📋 Validator threshold: {}/{}",
        config.validator.threshold, config.validator.total_validators
    );

    for chain in config.active_chains() {
        info!(
            "📋 EVM chain: {} (ID: {}) — wZION: {}, Bridge: {}",
            chain.name, chain.evm_chain_id, chain.wzion_address, chain.bridge_contract_address,
        );
    }

    // Open database
    let db = BridgeDb::open(&config.database.path)?;
    let last_l1_height = db.get_last_l1_height()?;
    let last_l1_height = if last_l1_height == 0 {
        config.l1.start_block_height.unwrap_or(0)
    } else {
        last_l1_height
    };

    // Initialize metrics
    let metrics = BridgeMetrics::new();

    // Start Prometheus metrics endpoint
    let metrics_port = config.metrics.port;
    tokio::spawn(serve_metrics(Arc::clone(&metrics), metrics_port));

    // Create channels
    let (lock_tx, lock_rx) = mpsc::channel(100);
    let (burn_tx, burn_rx) = mpsc::channel(100);

    // Start L1 watcher
    let l1_config = config.l1.clone();
    let _l1_handle = tokio::spawn(async move {
        let mut watcher = L1Watcher::new(l1_config, Some(last_l1_height));
        if let Err(e) = watcher.run(lock_tx).await {
            error!("L1 watcher crashed: {:?}", e);
        }
    });

    // Start EVM watchers (one per active chain via Ankr HTTP)
    let mut evm_handles = vec![];
    for chain in config.active_chains() {
        let chain_config = chain.clone();
        let start_block = chain_config.start_block;
        let ankr_config = config.ankr.clone();
        let burn_tx = burn_tx.clone();
        let evm_metrics = Arc::clone(&metrics);
        let handle = tokio::spawn(async move {
            let mut watcher = EvmWatcher::new(chain_config, ankr_config, start_block);
            if let Err(e) = watcher.run(burn_tx, evm_metrics).await {
                error!("EVM watcher crashed: {:?}", e);
            }
        });
        evm_handles.push(handle);
    }
    drop(burn_tx); // Drop extra sender

    // Start relayer
    let relayer_config = config.clone();
    let relayer_metrics = Arc::clone(&metrics);
    let _relayer_handle = tokio::spawn(async move {
        let relayer = Relayer::new(relayer_config, relayer_metrics);
        if let Err(e) = relayer.run(lock_rx, burn_rx).await {
            error!("Relayer crashed: {:?}", e);
        }
    });

    info!("🟢 Bridge relay running — Ctrl+C to stop");

    // Wait for shutdown signal
    tokio::signal::ctrl_c().await?;
    info!("🛑 Shutting down bridge relay...");

    // In production, we'd gracefully shutdown watchers and relayer here
    Ok(())
}
