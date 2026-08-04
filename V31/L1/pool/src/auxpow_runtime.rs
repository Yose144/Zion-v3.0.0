//! AuxPoW bridge runtime — spawns a tokio task per external coin to connect
//! to upstream pools, fetch jobs, and forward shares.
//!
//! Ported from V3/L1/pool/src/bin/server.rs `run_auxpow_bridge` (lines 1119-1345).
//! V31 uses `AuxPowClient` directly instead of V3's `JobMultiplexer`.

use std::collections::HashSet;
use std::time::Duration;

use zion_cosmic_harmony::{CoinProfile, ExternalCoin};
use zion_miner::auxpow::client::{AuxPowClient, AuxPowClientConfig, ExternalJob};

use crate::auxpow_bridge::{
    JobPackage, MultiAuxPowBridge, ShareForwardOutcome, ShareForwardRequest,
};
use crate::share_forwarder::ShareForwardResult;

/// Configuration for the AuxPoW bridge runtime.
#[derive(Clone, Debug)]
pub struct AuxPowRuntimeConfig {
    /// Wallet address for upstream pool authentication.
    pub payout_wallet: String,
    /// Worker name for upstream pool authentication.
    pub worker_name: String,
    /// Password for upstream pool authentication.
    pub password: String,
    /// Coins to start bridges for (subset of ExternalCoin variants).
    pub enabled_coins: HashSet<ExternalCoin>,
    /// Profit check interval in seconds (0 = disabled).
    pub profit_check_interval_secs: u64,
    /// Hysteresis percentage for profit switching (0.0 = no hysteresis).
    pub hysteresis_pct: f64,
    /// Reconnect base delay (seconds).
    pub reconnect_base_delay_secs: u64,
    /// Reconnect max delay (seconds).
    pub reconnect_max_delay_secs: u64,
}

impl Default for AuxPowRuntimeConfig {
    fn default() -> Self {
        Self {
            payout_wallet: String::new(),
            worker_name: "zion-pool".to_string(),
            password: "x".to_string(),
            enabled_coins: HashSet::new(),
            profit_check_interval_secs: 300,
            hysteresis_pct: 15.0,
            reconnect_base_delay_secs: 5,
            reconnect_max_delay_secs: 600,
        }
    }
}

/// Build the runtime config from environment variables.
pub fn config_from_env() -> AuxPowRuntimeConfig {
    let mut cfg = AuxPowRuntimeConfig::default();

    cfg.payout_wallet = std::env::var("ZION_POOL_AUXPOW_WALLET").unwrap_or_default();
    cfg.worker_name =
        std::env::var("ZION_POOL_AUXPOW_WORKER").unwrap_or_else(|_| "zion-pool".to_string());
    cfg.password = std::env::var("ZION_POOL_AUXPOW_PASSWORD").unwrap_or_else(|_| "x".to_string());

    // Parse enabled coins from ZION_POOL_AUXPOW_COINS (comma-separated tickers)
    // or from individual ZION_POOL_AUXPOW_WALLET_<COIN> env vars.
    if let Ok(coins_str) = std::env::var("ZION_POOL_AUXPOW_COINS") {
        for ticker in coins_str.split(',') {
            if let Some(coin) = ExternalCoin::from_str_loose(ticker.trim()) {
                cfg.enabled_coins.insert(coin);
            }
        }
    }

    // Also check per-coin wallet env vars
    for profile in CoinProfile::defaults() {
        let env_var = format!(
            "ZION_POOL_AUXPOW_WALLET_{}",
            profile.coin.as_str().to_uppercase()
        );
        if std::env::var(&env_var).is_ok() {
            cfg.enabled_coins.insert(profile.coin);
        }
    }

    // Force-coin env var
    if let Ok(coin_str) = std::env::var("ZION_POOL_AUXPOW_COIN") {
        if let Some(coin) = ExternalCoin::from_str_loose(&coin_str) {
            cfg.enabled_coins.insert(coin);
        }
    }
    if let Ok(coin_str) = std::env::var("ZION_POOL_AUXPOW_CPU_COIN") {
        if let Some(coin) = ExternalCoin::from_str_loose(&coin_str) {
            cfg.enabled_coins.insert(coin);
        }
    }

    cfg.profit_check_interval_secs = std::env::var("ZION_POOL_PROFIT_INTERVAL")
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(300);

    cfg.hysteresis_pct = std::env::var("ZION_POOL_PROFIT_HYSTERESIS")
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(15.0);

    cfg
}

/// Convert an ExternalJob from the upstream pool client into a JobPackage
/// for the bridge queue.
fn external_job_to_package(job: &ExternalJob, coin: ExternalCoin) -> JobPackage {
    JobPackage {
        external_job_id: job.job_id.clone(),
        coin,
        header_hex: job.header_hex.clone(),
        target_hex: job.target_hex.clone(),
        height: job.block_number.unwrap_or(0),
        algorithm: job.algorithm.clone(),
        extranonce1_hex: hex::encode(&job.extranonce1),
        ntime: "00000000".to_string(),
    }
}

/// Spawn the AuxPoW bridge runtime.
///
/// For each enabled coin, spawns a dedicated tokio task that:
/// 1. Connects to the upstream pool via `AuxPowClient`
/// 2. Subscribes and authorizes
/// 3. Fetches jobs and pushes them into the bridge job queue
/// 4. Forwards shares from `share_rx` to the upstream pool
/// 5. Reconnects with exponential backoff on failure
pub fn spawn_auxpow_runtime(
    multi_bridge: MultiAuxPowBridge,
    cfg: AuxPowRuntimeConfig,
) {
    if cfg.enabled_coins.is_empty() {
        tracing::info!("auxpow_runtime: no coins enabled, skipping");
        return;
    }

    let profiles = CoinProfile::defaults();
    let enabled: Vec<ExternalCoin> = cfg.enabled_coins.iter().copied().collect();

    for coin in enabled {
        let profile = profiles.iter().find(|p| p.coin == coin);
        let profile = match profile {
            Some(p) => p.clone(),
            None => {
                tracing::warn!(
                    "auxpow_runtime: no CoinProfile for {:?}, skipping",
                    coin
                );
                continue;
            }
        };

        // Check if a per-coin wallet override exists
        let per_coin_wallet = std::env::var(format!(
            "ZION_POOL_AUXPOW_WALLET_{}",
            coin.as_str().to_uppercase()
        ))
        .ok()
        .filter(|s| !s.is_empty());

        let wallet = per_coin_wallet
            .as_deref()
            .unwrap_or(&cfg.payout_wallet)
            .to_string();

        if wallet.is_empty() {
            tracing::warn!(
                "auxpow_runtime: no wallet for {:?}, skipping (set ZION_POOL_AUXPOW_WALLET or ZION_POOL_AUXPOW_WALLET_{})",
                coin,
                coin.as_str().to_uppercase()
            );
            continue;
        }

        let pool_addr = profile.pool_address();
        if pool_addr.is_empty() || pool_addr.contains("example") {
            tracing::warn!(
                "auxpow_runtime: no real pool URL for {:?} (got '{}'), skipping",
                coin,
                pool_addr
            );
            continue;
        }

        let coin_label = coin.as_str().to_string();
        let worker = format!("{}.{}", cfg.worker_name, coin_label.to_lowercase());
        let bridge = multi_bridge.clone();
        let reconnect_base = cfg.reconnect_base_delay_secs;
        let reconnect_max = cfg.reconnect_max_delay_secs;

        // Insert bridge for this coin
        let (aux_bridge, share_rx, touch_rx) =
            crate::auxpow_bridge::AuxPowBridge::new(true);
        bridge.insert(coin, aux_bridge);

        tracing::info!(
            "auxpow_runtime: spawning bridge for {} pool={} wallet={}",
            coin_label,
            pool_addr,
            wallet
        );

        let pool_addr_clone = pool_addr.clone();
        let password = cfg.password.clone();

        std::thread::spawn(move || {
            let rt = match tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .thread_name(format!("auxpow-{}", coin_label.to_lowercase()))
                .build()
            {
                Ok(rt) => rt,
                Err(e) => {
                    tracing::error!(
                        "auxpow_runtime[{}]: failed to create tokio runtime: {}",
                        coin_label,
                        e
                    );
                    return;
                }
            };
            rt.block_on(run_bridge_task(
                &coin_label,
                &pool_addr_clone,
                &wallet,
                &worker,
                &password,
                coin,
                bridge,
                share_rx,
                touch_rx,
                reconnect_base,
                reconnect_max,
            ));
        });
    }
}

/// Main bridge task for a single coin — runs in its own tokio runtime.
async fn run_bridge_task(
    coin_label: &str,
    pool_addr: &str,
    wallet: &str,
    worker: &str,
    password: &str,
    coin: ExternalCoin,
    bridge: MultiAuxPowBridge,
    share_rx: std::sync::mpsc::Receiver<(
        ShareForwardRequest,
        std::sync::mpsc::Sender<ShareForwardOutcome>,
    )>,
    touch_rx: std::sync::mpsc::Receiver<String>,
    reconnect_base_secs: u64,
    reconnect_max_secs: u64,
) {
    let mut reconnect_delay = reconnect_base_secs;
    let client_config = AuxPowClientConfig::new(coin, pool_addr, worker, password);
    let client = AuxPowClient::new(client_config);

    loop {
        // Connect to upstream pool
        tracing::info!("auxpow[{}]: connecting to {}", coin_label, pool_addr);
        match client.connect(wallet).await {
            Ok(()) => {
                tracing::info!("auxpow[{}]: connected", coin_label);
                reconnect_delay = reconnect_base_secs;
            }
            Err(e) => {
                tracing::warn!(
                    "auxpow[{}]: connect failed: {} — retrying in {}s",
                    coin_label,
                    e,
                    reconnect_delay
                );
                tokio::time::sleep(Duration::from_secs(reconnect_delay)).await;
                reconnect_delay = (reconnect_delay * 2).min(reconnect_max_secs);
                continue;
            }
        }

        // Main loop: fetch jobs + forward shares + touch timestamps
        let mut last_job_fetch = std::time::Instant::now();
        loop {
            // Check if still connected
            if !client.is_connected().await {
                tracing::warn!("auxpow[{}]: disconnected", coin_label);
                break;
            }

            // Fetch new jobs (5s timeout)
            match tokio::time::timeout(
                Duration::from_secs(5),
                client.wait_for_job(Duration::from_secs(5)),
            )
            .await
            {
                Ok(Ok(job)) => {
                    let pkg = external_job_to_package(&job, coin);
                    tracing::debug!(
                        "auxpow[{}]: got job id={} height={}",
                        coin_label,
                        pkg.external_job_id,
                        pkg.height
                    );
                    // Push to bridge queue
                    bridge.push_job_for_coin(&coin, pkg);
                    last_job_fetch = std::time::Instant::now();
                }
                Ok(Err(e)) => {
                    tracing::warn!("auxpow[{}]: wait_for_job error: {}", coin_label, e);
                    break;
                }
                Err(_) => {
                    // Timeout — no new job, continue
                }
            }

            // Forward any pending shares (non-blocking drain)
            while let Ok((req, reply_tx)) = share_rx.try_recv() {
                let result = forward_share_to_upstream(&client, coin, &req).await;
                let _ = reply_tx.send(result);
            }

            // Touch job timestamps (non-blocking drain)
            while let Ok(job_id) = touch_rx.try_recv() {
                tracing::trace!(
                    "auxpow[{}]: touch job_id={}",
                    coin_label,
                    job_id
                );
            }

            // Small yield to prevent busy-looping
            tokio::task::yield_now().await;
        }

        // Reconnect with backoff
        tracing::warn!(
            "auxpow[{}]: reconnecting in {}s",
            coin_label,
            reconnect_delay
        );
        tokio::time::sleep(Duration::from_secs(reconnect_delay)).await;
        reconnect_delay = (reconnect_delay * 2).min(reconnect_max_secs);
    }
}

/// Forward a share to the upstream pool via AuxPowClient.
async fn forward_share_to_upstream(
    client: &AuxPowClient,
    coin: ExternalCoin,
    req: &ShareForwardRequest,
) -> ShareForwardOutcome {
    let _ = coin; // coin is implicit in the client config
    match client
        .submit_share(&req.job_id, req.nonce, "", "00000000")
        .await
    {
        Ok(zion_miner::auxpow::client::ShareResult::Accepted) => {
            ShareForwardOutcome::Result(ShareForwardResult::Accepted)
        }
        Ok(zion_miner::auxpow::client::ShareResult::Rejected(reason)) => {
            ShareForwardOutcome::Result(ShareForwardResult::Rejected(reason))
        }
        Ok(zion_miner::auxpow::client::ShareResult::Unknown) | Ok(zion_miner::auxpow::client::ShareResult::NoShare) => {
            ShareForwardOutcome::Result(ShareForwardResult::Unknown)
        }
        Err(e) => {
            tracing::warn!("auxpow share forward error: {}", e);
            ShareForwardOutcome::Result(ShareForwardResult::Unknown)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_from_env_defaults() {
        // Clear all auxpow env vars to test defaults
        std::env::remove_var("ZION_POOL_AUXPOW_WALLET");
        std::env::remove_var("ZION_POOL_AUXPOW_COINS");
        std::env::remove_var("ZION_POOL_AUXPOW_COIN");
        std::env::remove_var("ZION_POOL_AUXPOW_CPU_COIN");
        // Also clear per-coin wallet vars
        for profile in CoinProfile::defaults() {
            std::env::remove_var(format!(
                "ZION_POOL_AUXPOW_WALLET_{}",
                profile.coin.as_str().to_uppercase()
            ));
        }
        let cfg = config_from_env();
        assert!(cfg.enabled_coins.is_empty());
        assert_eq!(cfg.profit_check_interval_secs, 300);
        assert!((cfg.hysteresis_pct - 15.0).abs() < 0.01);
    }

    #[test]
    fn config_parses_coins() {
        // Clear any env vars that might pollute this test
        for profile in CoinProfile::defaults() {
            std::env::remove_var(format!(
                "ZION_POOL_AUXPOW_WALLET_{}",
                profile.coin.as_str().to_uppercase()
            ));
        }
        std::env::remove_var("ZION_POOL_AUXPOW_COIN");
        std::env::remove_var("ZION_POOL_AUXPOW_CPU_COIN");

        std::env::set_var("ZION_POOL_AUXPOW_COINS", "KAS,XMR,VRSC");
        let cfg = config_from_env();
        assert!(cfg.enabled_coins.contains(&ExternalCoin::Kaspa));
        assert!(cfg.enabled_coins.contains(&ExternalCoin::Monero));
        assert!(cfg.enabled_coins.contains(&ExternalCoin::Verus));
        // Clean up
        std::env::remove_var("ZION_POOL_AUXPOW_COINS");
    }

    #[test]
    fn external_job_to_package_converts() {
        let job = ExternalJob {
            job_id: "ext123".to_string(),
            header_hex: "aabb".to_string(),
            target_hex: "ffff".to_string(),
            block_number: Some(42),
            algorithm: "kheavyhash".to_string(),
            external_coin: ExternalCoin::Kaspa,
            extranonce1: vec![0x01, 0x02],
            ..Default::default()
        };
        let pkg = external_job_to_package(&job, ExternalCoin::Kaspa);
        assert_eq!(pkg.external_job_id, "ext123");
        assert_eq!(pkg.coin, ExternalCoin::Kaspa);
        assert_eq!(pkg.height, 42);
        assert_eq!(pkg.algorithm, "kheavyhash");
        assert_eq!(pkg.extranonce1_hex, "0102");
    }
}
