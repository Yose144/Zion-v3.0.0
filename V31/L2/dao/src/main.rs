//! `zion-dao` — DAO governance server binary.
//!
//! Runs the DAO HTTP API with the in-memory governance runtime.

use std::env;

use zion_dao::api;
use zion_dao::config::DaoConfig;
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

    tracing::info!(
        "starting zion-dao: port={}, rpc={}, supply={}",
        config.api_port,
        config.l1_rpc_url,
        circulating_supply
    );

    api::serve(config, circulating_supply).await
}
