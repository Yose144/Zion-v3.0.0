//! ZION Revenue Proxy — standalone Stratum proxy for external multi-algo pools.
//!
//! Usage:
//!   ZION_PROXY_COIN=KAS ZION_PROXY_WALLET=YOUR_BTC_WALLET cargo run --bin revenue-proxy
//!
//! Supports multiple coins via comma-separated `ZION_PROXY_COINS`.

use std::sync::Arc;
use tokio::signal;
use tracing::{error, info};
use zion_cosmic_harmony::profit_router::{CoinProfile, ExternalCoin, PoolPreference};
use zion_pool::revenue_proxy::{client_from_profile, ExternalPoolClient};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let coins_env = std::env::var("ZION_PROXY_COINS").unwrap_or_else(|_| "KAS".to_string());
    let wallet = std::env::var("ZION_PROXY_WALLET").unwrap_or_default();
    let worker = std::env::var("ZION_PROXY_WORKER").unwrap_or_else(|_| "zion_pool".to_string());
    let region = std::env::var("ZION_PROXY_REGION").unwrap_or_else(|_| "eu".to_string());
    let preference = std::env::var("ZION_PROXY_PREFERENCE")
        .ok()
        .map(|s| PoolPreference::from_str_loose(&s))
        .unwrap_or(PoolPreference::Default);

    if wallet.is_empty() {
        eprintln!("Error: ZION_PROXY_WALLET is required (BTC payout address).");
        std::process::exit(1);
    }

    let coin_names: Vec<&str> = coins_env.split(',').map(|s| s.trim()).collect();
    let mut handles = vec![];

    for name in coin_names {
        let Some(coin) = ExternalCoin::from_str_loose(name) else {
            error!("Unknown coin '{}', skipping", name);
            continue;
        };
        let profile = CoinProfile::for_preference(coin, preference, &region);
        let client = client_from_profile(&profile, &wallet, &worker);

        info!(
            "Starting proxy for {} → {} (algo={})",
            coin.ticker(),
            profile.pool_address(),
            profile.algorithm
        );

        handles.push(tokio::spawn({
            let client = Arc::clone(&client);
            async move {
                client.run_loop().await;
            }
        }));
    }

    if handles.is_empty() {
        eprintln!("No valid coins configured. Set ZION_PROXY_COINS (e.g. KAS,ETC,ALPH).");
        std::process::exit(1);
    }

    info!("Revenue proxy running. Press Ctrl-C to stop.");
    signal::ctrl_c().await?;
    info!("Shutdown signal received.");

    // Tasks are detached; they'll exit when the process terminates.
    Ok(())
}
