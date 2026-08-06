//! TUI compatibility shim — provides `MinerMetricsSnapshot` and `TuiMetrics`
//! for the ported V3 TUI modules (`interactive.rs`, `banner.rs`).
//!
//! V31's native metrics live in `crate::metrics::Metrics`, which is a
//! lightweight atomic-counter struct. The V3 TUI expects a richer snapshot
//! with per-stream telemetry, GPU details, and an `as_tui()` method.
//! This shim bridges the gap without rewriting 2500+ lines of TUI code.

use std::time::Instant;

/// Rich metrics snapshot for TUI display (V3 compatibility).
#[derive(Debug, Clone)]
pub struct MinerMetricsSnapshot {
    pub started_at: Instant,
    pub last_update_at: Instant,
    pub miner_id: String,
    pub worker_name: String,
    pub pool_addr: String,
    pub backend: String,
    pub status: String,
    pub streams: Vec<StreamStatsInfo>,
    pub current_iteration: u32,
    pub last_job_id: u64,
    pub threads: usize,
    pub nonce_window: u64,
    pub session_active: bool,
    pub accepted_shares: u64,
    pub rejected_shares: u64,
    pub attempted_hashes: u64,
    pub hashrate_hps: f64,
    pub hashrate_10s_hps: f64,
    pub hashrate_60s_hps: f64,
    pub hashrate_15m_hps: f64,
    pub accept_rate_pct: f64,
    pub submit_avg_latency_ms: f64,
    pub submit_max_latency_ms: u64,
    pub gpu_hashrate_hps: f64,
    pub current_epoch: u64,
    pub pool_height: u64,
    pub best_batch_ms: u64,
    pub remote_ttl_ms: u64,
    pub hashrate_max: f64,
    pub algorithm: String,
    pub gpu_name: String,
    pub gpu_compute_units: u32,
    pub gpu_vram_bytes: u64,
    pub gpu_clock_mhz: u32,
    pub gpu_temp_c: Option<u32>,
    pub gpu_power_w: Option<u32>,
}

/// Per-stream telemetry info (trinity architecture).
#[derive(Debug, Clone, Default)]
pub struct StreamStatsInfo {
    pub stream_id: u8,
    pub algorithm: String,
    pub hashrate_hps: f64,
    pub accepted: u64,
    pub rejected: u64,
    pub active: bool,
    pub coin: String,
}

/// Lightweight TUI-facing metrics (V3 compatibility).
#[derive(Debug, Clone, Default)]
pub struct TuiMetrics {
    pub submit_avg_ms: f64,
    pub submit_max_ms: u64,
    pub best_batch_ms: u64,
    pub remote_ttl_ms: u64,
    pub hashrate_max: f64,
    pub current_iteration: u32,
    pub threads: usize,
    pub nonce_window: u64,
    pub status: String,
    pub backend: String,
}

impl MinerMetricsSnapshot {
    /// Create a new snapshot from basic miner config.
    pub fn new(worker_name: &str, pool_addr: &str, threads: usize, algorithm: &str) -> Self {
        let now = Instant::now();
        Self {
            started_at: now,
            last_update_at: now,
            miner_id: format!("zion-miner-{}", std::process::id()),
            worker_name: worker_name.to_string(),
            pool_addr: pool_addr.to_string(),
            backend: "cpu".to_string(),
            status: "starting".to_string(),
            streams: Vec::new(),
            current_iteration: 0,
            last_job_id: 0,
            threads,
            nonce_window: 0,
            session_active: false,
            accepted_shares: 0,
            rejected_shares: 0,
            attempted_hashes: 0,
            hashrate_hps: 0.0,
            hashrate_10s_hps: 0.0,
            hashrate_60s_hps: 0.0,
            hashrate_15m_hps: 0.0,
            accept_rate_pct: 0.0,
            submit_avg_latency_ms: 0.0,
            submit_max_latency_ms: 0,
            gpu_hashrate_hps: 0.0,
            current_epoch: 0,
            pool_height: 0,
            best_batch_ms: 0,
            remote_ttl_ms: 0,
            hashrate_max: 0.0,
            algorithm: algorithm.to_string(),
            gpu_name: String::new(),
            gpu_compute_units: 0,
            gpu_vram_bytes: 0,
            gpu_clock_mhz: 0,
            gpu_temp_c: None,
            gpu_power_w: None,
        }
    }

    /// Update from V31 `Metrics` (lightweight sync).
    pub fn update_from_metrics(&mut self, m: &crate::metrics::Metrics) {
        self.accepted_shares = m.shares_accepted();
        self.rejected_shares = m.shares_rejected();
        self.attempted_hashes = m.total_hashes();
        self.hashrate_hps = m.hashrate();
        self.hashrate_10s_hps = m.hashrate();
        self.hashrate_60s_hps = m.hashrate();
        self.hashrate_15m_hps = m.hashrate();
        let total = self.accepted_shares + self.rejected_shares;
        self.accept_rate_pct = if total > 0 {
            self.accepted_shares as f64 / total as f64 * 100.0
        } else {
            0.0
        };
        self.last_update_at = Instant::now();
    }

    /// Convert to TuiMetrics for dashboard display.
    pub fn as_tui(&self) -> TuiMetrics {
        TuiMetrics {
            submit_avg_ms: self.submit_avg_latency_ms,
            submit_max_ms: self.submit_max_latency_ms,
            best_batch_ms: self.best_batch_ms,
            remote_ttl_ms: self.remote_ttl_ms,
            hashrate_max: self.hashrate_max,
            current_iteration: self.current_iteration,
            threads: self.threads,
            nonce_window: self.nonce_window,
            status: self.status.clone(),
            backend: self.backend.clone(),
        }
    }

    /// Seconds since last update.
    pub fn seconds_since_update(&self) -> u64 {
        self.last_update_at.elapsed().as_secs()
    }
}

impl Default for MinerMetricsSnapshot {
    fn default() -> Self {
        Self::new("worker", "", num_cpus::get(), "ekam_deeksha")
    }
}
