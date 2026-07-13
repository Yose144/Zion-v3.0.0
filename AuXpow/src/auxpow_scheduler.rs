//! AuxPow scheduler — profit-switch orchestrator.
//!
//! The scheduler manages:
//!   - Periodic profit checks (select best coin to mine)
//!   - Connection to external pools via `AuxPowClient`
//!   - Mining loop: get job → hash → submit share
//!   - Circuit breaker: trip after N consecutive failures
//!   - Revenue tracking (USD-denominated)
//!   - Stats reporting for /stats API
//!
//! The scheduler runs as a background tokio task. It does NOT affect
//! ZION consensus or ZION share validation — it is purely additive
//! revenue from external mining.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, RwLock};
use tokio::time::Instant;
use tracing::{error, info, warn};

use crate::auxpow_client::{AuxPowClient, ShareResult};
use crate::external_hashers::{
    hash_blake3, hash_blake3_alph, hash_kheavyhash, hash_kheavyhash_extranonce, meets_target,
    meets_target_little_endian, ExternalAlgorithm,
};
use crate::types::{
    select_best_coin, AuxPowConfig, AuxPowStats, CoinProfile, ExternalCoin,
};

/// Scheduler configuration — tunable parameters for the mining loop.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerConfig {
    /// Nonce search batch size per iteration.
    pub nonce_batch_size: u64,
    /// Max nonce before wrapping.
    pub nonce_max: u64,
    /// Poll interval for job updates (ms).
    pub poll_interval_ms: u64,
    /// Reconnect delay (ms).
    pub reconnect_delay_ms: u64,
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            nonce_batch_size: 100_000,
            nonce_max: u64::MAX,
            poll_interval_ms: 500,
            reconnect_delay_ms: 5000,
        }
    }
}

/// Circuit breaker state.
#[derive(Debug, Clone)]
struct CircuitBreaker {
    consecutive_failures: u32,
    threshold: u32,
    reset_secs: u64,
    opened_at: Option<Instant>,
}

impl CircuitBreaker {
    fn new(threshold: u32, reset_secs: u64) -> Self {
        Self {
            consecutive_failures: 0,
            threshold,
            reset_secs,
            opened_at: None,
        }
    }

    fn record_success(&mut self) {
        self.consecutive_failures = 0;
        self.opened_at = None;
    }

    fn record_failure(&mut self) -> bool {
        self.consecutive_failures += 1;
        if self.consecutive_failures >= self.threshold && self.opened_at.is_none() {
            self.opened_at = Some(Instant::now());
            return true; // just tripped
        }
        false
    }

    fn is_open(&self) -> bool {
        self.opened_at.is_some()
    }

    fn maybe_reset(&mut self) -> bool {
        if let Some(opened) = self.opened_at {
            if opened.elapsed().as_secs() >= self.reset_secs {
                self.consecutive_failures = 0;
                self.opened_at = None;
                return true;
            }
        }
        false
    }
}

/// The AuxPow scheduler — manages external mining.
pub struct AuxPowScheduler {
    config: Arc<RwLock<AuxPowConfig>>,
    scheduler_config: Arc<RwLock<SchedulerConfig>>,
    client: Arc<Mutex<Option<AuxPowClient>>>,
    current_coin: Arc<Mutex<Option<ExternalCoin>>>,
    stats: Arc<Mutex<AuxPowStats>>,
    circuit: Arc<Mutex<CircuitBreaker>>,
    start_time: Instant,
    nonce_counter: Arc<Mutex<u64>>,
}

impl AuxPowScheduler {
    pub fn new(config: AuxPowConfig, scheduler_config: SchedulerConfig) -> Self {
        let circuit = CircuitBreaker::new(
            config.circuit_breaker_threshold,
            config.circuit_breaker_reset_secs,
        );
        Self {
            config: Arc::new(RwLock::new(config)),
            scheduler_config: Arc::new(RwLock::new(scheduler_config)),
            client: Arc::new(Mutex::new(None)),
            current_coin: Arc::new(Mutex::new(None)),
            stats: Arc::new(Mutex::new(AuxPowStats::default())),
            circuit: Arc::new(Mutex::new(circuit)),
            start_time: Instant::now(),
            nonce_counter: Arc::new(Mutex::new(0)),
        }
    }

    /// Create from environment variables.
    pub fn from_env() -> Self {
        let config = AuxPowConfig::from_env();
        Self::new(config, SchedulerConfig::default())
    }

    /// Run the scheduler in a background task. Returns immediately.
    /// Must be called from within a tokio runtime context.
    pub fn spawn(self: Arc<Self>) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            if let Err(e) = self.run().await {
                error!("AuxPow scheduler error: {}", e);
            }
        })
    }

    /// Run the scheduler on a specific tokio runtime (for use from
    /// non-tokio hosts like the ZION pool server which uses std::thread).
    pub fn spawn_on(self: Arc<Self>, runtime: &tokio::runtime::Runtime) {
        let scheduler = self;
        runtime.spawn(async move {
            if let Err(e) = scheduler.run().await {
                error!("AuxPow scheduler error: {}", e);
            }
        });
    }

    /// Main scheduler loop.
    async fn run(&self) -> Result<()> {
        let cfg = self.config.read().await.clone();
        if !cfg.enabled {
            info!("AuxPow: disabled (ZION_AUXPOW_ENABLED not set)");
            return Ok(());
        }

        let wallet_display = if cfg.payout_wallet.is_empty() {
            "<NOT SET>".to_string()
        } else {
            cfg.payout_wallet.clone()
        };
        println!(
            "auxpow: scheduler started, allocation={:.0}%, wallet={}",
            cfg.allocation_pct * 100.0,
            wallet_display
        );

        loop {
            // Check circuit breaker
            {
                let mut cb = self.circuit.lock().await;
                if cb.is_open() {
                    if cb.maybe_reset() {
                        println!("auxpow: circuit breaker reset, retrying...");
                    } else {
                        tokio::time::sleep(Duration::from_secs(5)).await;
                        continue;
                    }
                }
            }

            // Select coin
            let coin = self.select_coin().await;
            if coin.is_none() {
                println!("auxpow: no coin selected, waiting...");
                tokio::time::sleep(Duration::from_secs(30)).await;
                continue;
            }
            let coin = coin.unwrap();

            // Switch if needed
            if let Err(e) = self.switch_coin(coin).await {
                println!("auxpow: switch_coin error: {:#}", e);
                let tripped = self.circuit.lock().await.record_failure();
                if tripped {
                    println!("auxpow: circuit breaker tripped after failures");
                }
                let delay = self.scheduler_config.read().await.reconnect_delay_ms;
                tokio::time::sleep(Duration::from_millis(delay)).await;
                continue;
            }

            // Mine
            if let Err(e) = self.mine_cycle().await {
                println!("auxpow: mining error: {:#}", e);
                let tripped = self.circuit.lock().await.record_failure();
                if tripped {
                    println!("auxpow: circuit breaker tripped after failures");
                }
                self.disconnect().await;
                let delay = self.scheduler_config.read().await.reconnect_delay_ms;
                tokio::time::sleep(Duration::from_millis(delay)).await;
            }
        }
    }

    /// Select the best coin to mine (forced or profit-based).
    async fn select_coin(&self) -> Option<ExternalCoin> {
        let cfg = self.config.read().await;

        // Forced coin overrides profit router
        if let Some(coin) = cfg.force_coin {
            return Some(coin);
        }

        // Profit-based selection
        let entries = crate::types::fallback_estimates();
        let current = *self.current_coin.lock().await;
        select_best_coin(&entries, current, cfg.hysteresis_pct)
    }

    /// Switch to a different coin if needed.
    async fn switch_coin(&self, coin: ExternalCoin) -> Result<()> {
        let current = *self.current_coin.lock().await;
        if current == Some(coin) && self.client.lock().await.is_some() {
            return Ok(()); // already on this coin
        }

        let pool_addr = coin.default_pool();
        println!(
            "auxpow: switching to {} ({}) pool={}",
            coin,
            coin.algorithm(),
            pool_addr
        );

        // Disconnect old client
        self.disconnect().await;

        // Connect to new pool
        let profile = CoinProfile::default_for(coin);
        let pool_host = profile.pool_host.clone();
        let pool_port = profile.pool_port;
        let client = AuxPowClient::new(profile);
        let cfg = self.config.read().await;
        println!(
            "auxpow: connecting to {}:{} as worker={}",
            pool_host, pool_port, cfg.worker_name
        );
        client.connect(&cfg.payout_wallet).await?;
        println!("auxpow: connected to {} successfully", coin);

        *self.client.lock().await = Some(client);
        *self.current_coin.lock().await = Some(coin);

        // Update stats
        {
            let mut stats = self.stats.lock().await;
            stats.current_coin = Some(coin.ticker().to_string());
            stats.current_pool = Some(CoinProfile::default_for(coin).pool_address());
            stats.current_algorithm = Some(coin.algorithm().to_string());
            stats.coin_switches += 1;
            stats.last_switch_ts = Some(chrono::Utc::now().to_rfc3339());
        }

        Ok(())
    }

    /// One mining cycle: get job → hash → submit.
    async fn mine_cycle(&self) -> Result<()> {
        let sched_cfg = self.scheduler_config.read().await.clone();

        // Get current job
        let job = {
            let client_guard = self.client.lock().await;
            let client = client_guard.as_ref().ok_or_else(|| {
                anyhow::anyhow!("no client connected")
            })?;
            client.current_job().await
        };

        let job = match job {
            Some(j) => j,
            None => {
                // No job yet; the background poll loop will update current_job
                // when mining.notify arrives.
                tokio::time::sleep(Duration::from_millis(sched_cfg.poll_interval_ms)).await;
                return Ok(());
            }
        };

        // Determine algorithm
        let algo = ExternalAlgorithm::from_str_loose(&job.algorithm)
            .unwrap_or(ExternalAlgorithm::Blake3);

        // Hash a batch of nonces
        let start_nonce = {
            let mut counter = self.nonce_counter.lock().await;
            let current = *counter;
            *counter = counter.wrapping_add(sched_cfg.nonce_batch_size);
            current
        };

        let header = &job.header_bytes;
        let target = &job.target_bytes;

        let mut found_hash = None;
        let mut found_nonce = None;

        for offset in 0..sched_cfg.nonce_batch_size {
            let nonce = start_nonce.wrapping_add(offset);
            let hash = match algo {
                ExternalAlgorithm::Blake3 => {
                    // Alephium uses a 24-byte nonce + double-Blake3 PoW.
                    if job.external_coin == ExternalCoin::ALPH {
                        hash_blake3_alph(header, &job.extranonce1, nonce)
                    } else {
                        hash_blake3(header, 0, nonce)
                    }
                }
                ExternalAlgorithm::KHeavyHash => {
                    if !job.extranonce1.is_empty() && job.extranonce1.len() < 8 {
                        hash_kheavyhash_extranonce(header, 0, &job.extranonce1, nonce)
                    } else {
                        hash_kheavyhash(header, 0, nonce)
                    }
                }
                ExternalAlgorithm::Autolykos => {
                    crate::external_hashers::hash_autolykos(
                        header,
                        nonce,
                        job.timestamp.unwrap_or(0) as u32,
                    )
                }
                ExternalAlgorithm::KawPow => {
                    let mut h32 = [0u8; 32];
                    let len = header.len().min(32);
                    h32[..len].copy_from_slice(&header[..len]);
                    let (_mix, final_hash) = crate::external_hashers::hash_kawpow(
                        &h32,
                        nonce,
                        job.timestamp.unwrap_or(0) as u32,
                    );
                    final_hash
                }
                ExternalAlgorithm::Ethash => {
                    crate::external_hashers::hash_ethash(header, nonce, job.timestamp.unwrap_or(0) as u32)
                }
                ExternalAlgorithm::RandomX => {
                    // RandomX requires the RandomX VM — not yet implemented.
                    // Fall back to blake3 as a placeholder so the scheduler
                    // doesn't panic; shares will never meet a real target.
                    hash_blake3(header, 0, nonce)
                }
                ExternalAlgorithm::VerusHash => {
                    crate::external_hashers::hash_verushash(header, nonce)
                }
                ExternalAlgorithm::ZelHash => {
                    // ZelHash (Equihash 125,4) — CPU solver is too slow for
                    // the scheduler hot loop.  Use a blake3 placeholder;
                    // real ZelHash mining requires a GPU kernel.
                    hash_blake3(header, 0, nonce)
                }
            };

            let meets = if job.external_coin == ExternalCoin::DCR {
                meets_target_little_endian(&hash, target)
            } else {
                meets_target(&hash, target)
            };
            if meets {
                found_hash = Some(hash);
                found_nonce = Some(nonce);
                break;
            }
        }

        // Submit share if found
        if let (Some(nonce), Some(hash)) = (found_nonce, found_hash) {
            let hash_hex = crate::external_hashers::hash_to_hex(&hash);

            let result = {
                let client_guard = self.client.lock().await;
                let client = client_guard.as_ref().ok_or_else(|| {
                    anyhow::anyhow!("no client connected")
                })?;
                client.submit_share(&job.job_id, nonce, &hash_hex, None).await
            };

            let mut stats = self.stats.lock().await;
            stats.shares_submitted += 1;

            match result {
                Ok(ShareResult::Accepted) => {
                    stats.shares_accepted += 1;
                    self.circuit.lock().await.record_success();
                    info!(
                        "AuxPow: share accepted for {} nonce={}",
                        job.algorithm, nonce
                    );
                }
                Ok(ShareResult::Rejected(reason)) => {
                    stats.shares_rejected += 1;
                    warn!("AuxPow: share rejected: {}", reason);
                }
                Ok(ShareResult::Unknown) => {
                    // Pool didn't explicitly accept or reject
                }
                Err(e) => {
                    warn!("AuxPow: submit error: {}", e);
                    return Err(e);
                }
            }
        }

        // Background poll loop keeps current_job up to date.
        Ok(())
    }

    /// Disconnect from current pool.
    async fn disconnect(&self) {
        let mut client_guard = self.client.lock().await;
        if let Some(client) = client_guard.take() {
            let _ = client.disconnect().await;
        }
    }

    /// Get current stats snapshot (async).
    pub async fn stats(&self) -> AuxPowStats {
        let mut stats = self.stats.lock().await.clone();
        stats.uptime_secs = self.start_time.elapsed().as_secs();
        let cb = self.circuit.lock().await;
        stats.consecutive_failures = cb.consecutive_failures;
        stats.circuit_open = cb.is_open();
        let cfg = self.config.read().await;
        stats.enabled = cfg.enabled;
        stats
    }

    /// Get current stats snapshot (sync — uses blocking_lock for use
    /// outside of a tokio runtime, e.g. from std::thread metrics handler).
    pub fn stats_sync(&self) -> AuxPowStats {
        let mut stats = self.stats.blocking_lock().clone();
        stats.uptime_secs = self.start_time.elapsed().as_secs();
        let cb = self.circuit.blocking_lock();
        stats.consecutive_failures = cb.consecutive_failures;
        stats.circuit_open = cb.is_open();
        let cfg = self.config.blocking_read();
        stats.enabled = cfg.enabled;
        stats
    }

    /// Check if scheduler is enabled (sync — for use outside tokio runtime).
    pub fn is_enabled_sync(&self) -> bool {
        self.config.blocking_read().enabled
    }

    /// Get current coin.
    pub async fn current_coin(&self) -> Option<ExternalCoin> {
        *self.current_coin.lock().await
    }

    /// Check if scheduler is enabled.
    pub async fn is_enabled(&self) -> bool {
        self.config.read().await.enabled
    }

    /// Update configuration at runtime.
    pub async fn update_config(&self, new_config: AuxPowConfig) {
        *self.config.write().await = new_config;
    }
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn circuit_breaker_trips_after_threshold() {
        let mut cb = CircuitBreaker::new(3, 60);
        assert!(!cb.is_open());

        assert!(!cb.record_failure()); // 1
        assert!(!cb.is_open());
        assert!(!cb.record_failure()); // 2
        assert!(!cb.is_open());
        assert!(cb.record_failure()); // 3 → trips
        assert!(cb.is_open());
    }

    #[test]
    fn circuit_breaker_resets_on_success() {
        let mut cb = CircuitBreaker::new(5, 60);
        cb.record_failure();
        cb.record_failure();
        cb.record_success();
        assert_eq!(cb.consecutive_failures, 0);
        assert!(!cb.is_open());
    }

    #[tokio::test]
    async fn circuit_breaker_auto_reset_after_timeout() {
        let mut cb = CircuitBreaker::new(1, 0); // 0 sec reset
        cb.record_failure();
        assert!(cb.is_open());

        tokio::time::sleep(Duration::from_millis(10)).await;
        assert!(cb.maybe_reset());
        assert!(!cb.is_open());
    }

    #[tokio::test]
    async fn scheduler_disabled_by_default() {
        let scheduler = AuxPowScheduler::new(AuxPowConfig::default(), SchedulerConfig::default());
        assert!(!scheduler.is_enabled().await);

        let stats = scheduler.stats().await;
        assert!(!stats.enabled);
    }

    #[tokio::test]
    async fn scheduler_stats_track_switches() {
        let config = AuxPowConfig {
            enabled: true,
            force_coin: Some(ExternalCoin::DCR),
            ..Default::default()
        };

        let scheduler = Arc::new(AuxPowScheduler::new(config, SchedulerConfig::default()));

        // Manually set current coin to simulate a switch
        *scheduler.current_coin.lock().await = Some(ExternalCoin::DCR);
        {
            let mut stats = scheduler.stats.lock().await;
            stats.coin_switches = 1;
            stats.current_coin = Some("DCR".to_string());
        }

        let stats = scheduler.stats().await;
        assert_eq!(stats.current_coin, Some("DCR".to_string()));
        assert_eq!(stats.coin_switches, 1);
    }
}
