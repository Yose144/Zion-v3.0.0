//! `zion-dao` — DAO governance server binary.
//!
//! Runs the DAO HTTP API with the in-memory governance runtime
//! and optionally spawns the L1 memo scanner.

use std::env;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;

use tokio::sync::Mutex as TokioMutex;

use zion_dao::api;
use zion_dao::config::DaoConfig;
use zion_dao::db::DaoDb;
use zion_dao::l1_scanner::{L1Scanner, ScannerConfig};
use zion_dao::metrics::DaoMetrics;
use zion_dao::runtime::GovernanceRuntime;
use zion_dao::types::FLOWERS_PER_ZION;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    let config = DaoConfig::load(None);

    // Circulating supply from env or default (4B ZION)
    let circulating_supply = env::var("DAO_CIRCULATING_SUPPLY")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(4_000_000_000 * FLOWERS_PER_ZION);

    let metrics = DaoMetrics::new();

    // Build governance runtime, loading persisted state when possible.
    let mut runtime =
        GovernanceRuntime::new(config.clone(), circulating_supply).with_metrics(metrics.clone());

    if let Some(db) = DaoDb::open(&config.db_path).map(Some).unwrap_or_else(|e| {
        tracing::warn!(
            "Could not open runtime DAO db at {}: {} — running without persistence",
            config.db_path,
            e
        );
        None
    }) {
        let db = Arc::new(StdMutex::new(db));
        runtime = runtime.with_db(db);
        if let Err(e) = runtime.load_from_db() {
            return Err(anyhow::anyhow!("failed to load DAO state from DB: {e}"));
        }
    }

    let runtime = Arc::new(TokioMutex::new(runtime));

    // Open a second DB connection for the L1 memo scanner.
    let scanner_db = match DaoDb::open(&config.db_path) {
        Ok(db) => Some(Arc::new(TokioMutex::new(db))),
        Err(e) => {
            tracing::warn!(
                "Could not open DAO db at {}: {} — running without L1 scanner",
                config.db_path,
                e
            );
            None
        }
    };

    tracing::info!(
        "starting zion-dao: port={}, rpc={}, supply={}",
        config.api_port,
        config.l1_rpc_url,
        circulating_supply
    );

    // Spawn the L1 memo scanner when a database is available.
    if let Some(db) = scanner_db {
        let scanner_cfg = ScannerConfig {
            rpc_url: config.l1_rpc_url.clone(),
            poll_interval: Duration::from_secs(config.scan_interval_secs),
            min_vote_weight: config.min_vote_weight,
            finality_blocks: config.finality_blocks,
        };
        let scanner = L1Scanner::new(scanner_cfg, db)
            .with_runtime(runtime.clone())
            .with_metrics(metrics.clone());
        tokio::spawn(async move {
            scanner.run().await;
        });
    }

    api::serve(config, runtime, metrics).await
}
