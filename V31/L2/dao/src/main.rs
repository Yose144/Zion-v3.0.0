//! `zion-dao` — DAO governance server binary.
//!
//! Runs the DAO HTTP API with the in-memory governance runtime
//! and optionally spawns the L1 memo scanner.

use std::env;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Mutex;

use zion_dao::api;
use zion_dao::config::DaoConfig;
use zion_dao::db::DaoDb;
use zion_dao::l1_scanner::{L1Scanner, ScannerConfig};
use zion_dao::metrics::DaoMetrics;
use zion_dao::types::FLOWERS_PER_ZION;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let config = DaoConfig::load(None);

    // Circulating supply from env or default (4B ZION)
    let circulating_supply = env::var("DAO_CIRCULATING_SUPPLY")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(4_000_000_000 * FLOWERS_PER_ZION);

    // Open DAO persistence. If the path cannot be opened the server still starts
    // in-memory-only mode so that development / testing is not blocked.
    let db = match DaoDb::open(&config.db_path) {
        Ok(db) => Some(Arc::new(Mutex::new(db))),
        Err(e) => {
            tracing::warn!(
                "Could not open DAO db at {}: {} — running without L1 scanner persistence",
                config.db_path,
                e
            );
            None
        }
    };

    let metrics = DaoMetrics::new();

    tracing::info!(
        "starting zion-dao: port={}, rpc={}, supply={}",
        config.api_port,
        config.l1_rpc_url,
        circulating_supply
    );

    // Spawn the L1 memo scanner when a database is available.
    if let Some(db) = db {
        let scanner_cfg = ScannerConfig {
            rpc_url: config.l1_rpc_url.clone(),
            poll_interval: Duration::from_secs(config.scan_interval_secs),
            min_vote_weight: config.min_vote_weight,
            finality_blocks: config.finality_blocks,
        };
        let scanner = L1Scanner::new(scanner_cfg, db).with_metrics(metrics.clone());
        tokio::spawn(async move {
            scanner.run().await;
        });
    }

    api::serve(config, circulating_supply, metrics).await
}
