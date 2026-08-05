//! Miner telemetry module for the V31 pool.
//!
//! Tracks per-miner hashrate samples, share counts, block finds, and payout
//! lifecycle records.  Ported from the V3 pool's `server.rs` monolith into a
//! standalone module so the V31 pool server can consume it without a giant
//! binary crate.

use std::collections::{HashMap, VecDeque};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::v3_pplns::PayoutEntry;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// 1-hour hashrate window in seconds.
pub const HASHRATE_WINDOW_1H_S: u64 = 3600;
/// 24-hour hashrate window in seconds (also the sample retention horizon).
pub const HASHRATE_WINDOW_24H_S: u64 = 86400;
/// "Live" hashrate window (10 minutes) in seconds.
pub const HASHRATE_WINDOW_LIVE_S: u64 = 600;
/// Maximum number of payout records retained per miner.
pub const PAYOUT_HISTORY_LIMIT: usize = 50;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/// Current UNIX timestamp in seconds.
pub fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// Data structs
// ---------------------------------------------------------------------------

/// A single completed work unit used for hashrate calculation.
#[derive(Debug, Clone)]
pub struct WorkSample {
    pub completed_at_s: u64,
    pub attempted_hashes: u64,
    pub elapsed_ms: u64,
}

/// Per-stream share counters keyed by stream name ("zion", "kheavyhash", ...).
#[derive(Debug, Default, Clone)]
pub struct StreamStats {
    pub valid_shares: u64,
    pub invalid_shares: u64,
    pub last_share_time_s: u64,
}

/// A payout record tracked through its lifecycle (pending → submitted →
/// confirmed / failed).
#[derive(Debug, Clone)]
pub struct MinerPayoutRecord {
    pub amount_atomic: u64,
    pub share_count: u64,
    pub created_ts: u64,
    pub height: u64,
    pub status: String,
    pub tx_id: Option<String>,
    pub error: Option<String>,
}

/// Per-miner telemetry aggregate.
#[derive(Debug, Clone)]
pub struct MinerTelemetry {
    pub worker_name: String,
    pub algorithm: String,
    pub backend: String,
    pub first_seen_s: u64,
    pub last_seen_s: u64,
    pub last_share_time_s: u64,
    pub valid_shares: u64,
    pub invalid_shares: u64,
    pub no_solution_jobs: u64,
    pub blocks_found: u64,
    pub completed_jobs: u64,
    pub total_attempted_hashes: u64,
    pub total_elapsed_ms: u64,
    pub paid_total_atomic: u64,
    pub samples: VecDeque<WorkSample>,
    pub payouts: VecDeque<MinerPayoutRecord>,
    /// Per-stream share counters keyed by stream name ("zion", "kheavyhash",
    /// "verushash", etc.)
    pub streams: HashMap<String, StreamStats>,
}

/// Registry of all known miners keyed by `"{miner_id}/{worker_name}"`.
#[derive(Debug, Default)]
pub struct MinerTelemetryRegistry {
    pub miners: HashMap<String, MinerTelemetry>,
}

// ---------------------------------------------------------------------------
// impl MinerTelemetry
// ---------------------------------------------------------------------------

impl MinerTelemetry {
    pub fn new(worker_name: &str, algorithm: &str, backend: &str, now_s: u64) -> Self {
        Self {
            worker_name: worker_name.to_string(),
            algorithm: algorithm.to_string(),
            backend: backend.to_string(),
            first_seen_s: now_s,
            last_seen_s: now_s,
            last_share_time_s: 0,
            valid_shares: 0,
            invalid_shares: 0,
            no_solution_jobs: 0,
            blocks_found: 0,
            completed_jobs: 0,
            total_attempted_hashes: 0,
            total_elapsed_ms: 0,
            paid_total_atomic: 0,
            samples: VecDeque::new(),
            payouts: VecDeque::new(),
            streams: HashMap::new(),
        }
    }

    /// Refresh worker/algorithm/backend metadata and timestamps.
    pub fn touch(&mut self, worker_name: &str, algorithm: &str, backend: &str, now_s: u64) {
        self.worker_name = worker_name.to_string();
        self.algorithm = algorithm.to_string();
        self.backend = backend.to_string();
        if self.first_seen_s == 0 {
            self.first_seen_s = now_s;
        }
        self.last_seen_s = now_s;
    }

    /// Record a completed work sample and prune old ones.
    pub fn push_sample(&mut self, attempted_hashes: u64, elapsed_ms: u64, now_s: u64) {
        if attempted_hashes == 0 || elapsed_ms == 0 {
            return;
        }
        self.total_attempted_hashes = self.total_attempted_hashes.saturating_add(attempted_hashes);
        self.total_elapsed_ms = self.total_elapsed_ms.saturating_add(elapsed_ms);
        self.samples.push_back(WorkSample {
            completed_at_s: now_s,
            attempted_hashes,
            elapsed_ms,
        });
        self.prune_samples(now_s);
    }

    /// Drop samples older than the 24h retention horizon.
    pub fn prune_samples(&mut self, now_s: u64) {
        while matches!(self.samples.front(), Some(sample) if sample.completed_at_s.saturating_add(HASHRATE_WINDOW_24H_S) < now_s)
        {
            self.samples.pop_front();
        }
    }

    /// Hashes/second over the trailing `window_s` ending at `now_s`.
    pub fn hashrate_for_window(&self, window_s: u64, now_s: u64) -> f64 {
        let mut hashes = 0u64;
        let mut elapsed_ms = 0u64;
        for sample in self.samples.iter().rev() {
            if sample.completed_at_s.saturating_add(window_s) < now_s {
                break;
            }
            hashes = hashes.saturating_add(sample.attempted_hashes);
            elapsed_ms = elapsed_ms.saturating_add(sample.elapsed_ms);
        }
        if elapsed_ms == 0 {
            0.0
        } else {
            hashes as f64 / (elapsed_ms as f64 / 1000.0)
        }
    }

    /// Total shares (valid + invalid + no-solution jobs).
    pub fn total_shares(&self) -> u64 {
        self.valid_shares
            .saturating_add(self.invalid_shares)
            .saturating_add(self.no_solution_jobs)
    }

    /// Convenience: 1-hour trailing hashrate.
    pub fn hashrate_1h(&self, now_s: u64) -> f64 {
        self.hashrate_for_window(HASHRATE_WINDOW_1H_S, now_s)
    }

    /// Convenience: "live" (10-minute) trailing hashrate.
    pub fn hashrate_live(&self, now_s: u64) -> f64 {
        self.hashrate_for_window(HASHRATE_WINDOW_LIVE_S, now_s)
    }
}

// ---------------------------------------------------------------------------
// impl MinerTelemetryRegistry
// ---------------------------------------------------------------------------

impl MinerTelemetryRegistry {
    pub fn new() -> Self {
        Self {
            miners: HashMap::new(),
        }
    }

    /// Create or refresh a miner session entry.
    pub fn touch_session(
        &mut self,
        miner_id: &str,
        worker_name: &str,
        algorithm: &str,
        backend: &str,
    ) {
        let now_s = now_unix_seconds();
        let key = format!("{miner_id}/{worker_name}");
        self.miners
            .entry(key)
            .and_modify(|miner| miner.touch(worker_name, algorithm, backend, now_s))
            .or_insert_with(|| MinerTelemetry::new(worker_name, algorithm, backend, now_s));
    }

    /// Record a job result on the default "zion" stream.
    pub fn record_job_result(
        &mut self,
        miner_id: &str,
        worker_name: &str,
        accepted: bool,
        attempted_hashes: u64,
        elapsed_ms: u64,
    ) {
        self.record_job_result_stream(
            miner_id,
            worker_name,
            accepted,
            attempted_hashes,
            elapsed_ms,
            "zion",
        );
    }

    /// Record a job result on a named stream.
    pub fn record_job_result_stream(
        &mut self,
        miner_id: &str,
        worker_name: &str,
        accepted: bool,
        attempted_hashes: u64,
        elapsed_ms: u64,
        stream: &str,
    ) {
        let now_s = now_unix_seconds();
        let key = format!("{miner_id}/{worker_name}");
        let miner = self
            .miners
            .entry(key)
            .or_insert_with(|| MinerTelemetry::new(worker_name, "", "", now_s));
        miner.touch(worker_name, "", "", now_s);
        miner.completed_jobs = miner.completed_jobs.saturating_add(1);
        miner.push_sample(attempted_hashes, elapsed_ms, now_s);
        if accepted {
            miner.valid_shares = miner.valid_shares.saturating_add(1);
            miner.last_share_time_s = now_s;
        } else {
            miner.invalid_shares = miner.invalid_shares.saturating_add(1);
        }
        // Per-stream tracking
        let stats = miner.streams.entry(stream.to_string()).or_default();
        if accepted {
            stats.valid_shares = stats.valid_shares.saturating_add(1);
            stats.last_share_time_s = now_s;
        } else {
            stats.invalid_shares = stats.invalid_shares.saturating_add(1);
        }
    }

    /// Record a block found by the miner.
    pub fn record_block_found(&mut self, miner_id: &str, worker_name: &str) {
        let now_s = now_unix_seconds();
        let key = format!("{miner_id}/{worker_name}");
        let miner = self
            .miners
            .entry(key)
            .or_insert_with(|| MinerTelemetry::new(worker_name, "", "", now_s));
        miner.touch(worker_name, "", "", now_s);
        miner.blocks_found = miner.blocks_found.saturating_add(1);
    }

    /// Record a job that produced no solution (still counts as work done).
    pub fn record_no_solution(
        &mut self,
        miner_id: &str,
        worker_name: &str,
        attempted_hashes: u64,
        elapsed_ms: u64,
    ) {
        let now_s = now_unix_seconds();
        let key = format!("{miner_id}/{worker_name}");
        let miner = self
            .miners
            .entry(key)
            .or_insert_with(|| MinerTelemetry::new(worker_name, "", "", now_s));
        miner.touch(worker_name, "", "", now_s);
        miner.completed_jobs = miner.completed_jobs.saturating_add(1);
        miner.no_solution_jobs = miner.no_solution_jobs.saturating_add(1);
        miner.push_sample(attempted_hashes, elapsed_ms, now_s);
    }

    /// Record a batch of pending payouts awaiting execution.
    pub fn record_pending_payouts(&mut self, height: u64, payouts: &[PayoutEntry]) {
        let now_s = now_unix_seconds();
        for payout in payouts {
            let miner = self
                .miners
                .entry(payout.miner_id.clone())
                .or_insert_with(|| MinerTelemetry::new("", "", "", now_s));
            miner.last_seen_s = now_s;
            miner.payouts.push_front(MinerPayoutRecord {
                amount_atomic: payout.amount,
                share_count: payout.share_count,
                created_ts: now_s,
                height,
                status: "pending_execution".to_string(),
                tx_id: None,
                error: None,
            });
            while miner.payouts.len() > PAYOUT_HISTORY_LIMIT {
                miner.payouts.pop_back();
            }
        }
    }

    /// Mark a batch of pending payouts as submitted to the node with a tx id.
    pub fn record_submitted_payouts(
        &mut self,
        height: u64,
        payouts: &[PayoutEntry],
        tx_id: &str,
    ) {
        for payout in payouts {
            let Some(miner) = self.miners.get_mut(&payout.miner_id) else {
                continue;
            };
            if let Some(record) = miner.payouts.iter_mut().find(|record| {
                record.height == height
                    && record.amount_atomic == payout.amount
                    && record.share_count == payout.share_count
                    && record.status == "pending_execution"
            }) {
                record.status = "submitted_to_node".to_string();
                record.tx_id = Some(tx_id.to_string());
                record.error = None;
                miner.paid_total_atomic = miner.paid_total_atomic.saturating_add(payout.amount);
            }
        }
    }

    /// Mark a batch of pending payouts as failed with an error message.
    pub fn record_failed_payouts(
        &mut self,
        height: u64,
        payouts: &[PayoutEntry],
        error: &str,
    ) {
        for payout in payouts {
            let Some(miner) = self.miners.get_mut(&payout.miner_id) else {
                continue;
            };
            if let Some(record) = miner.payouts.iter_mut().find(|record| {
                record.height == height
                    && record.amount_atomic == payout.amount
                    && record.share_count == payout.share_count
                    && record.status == "pending_execution"
            }) {
                record.status = "submit_failed".to_string();
                record.tx_id = None;
                record.error = Some(error.to_string());
            }
        }
    }

    /// Collect all payouts with `submitted_to_node` status.
    ///
    /// Returns `(miner_id, height, tx_id)` tuples used by the confirmation
    /// sweep thread to check which TXs are on chain.
    pub fn collect_submitted_payouts(&self) -> Vec<(String, u64, String)> {
        let mut out = Vec::new();
        for (miner_id, miner) in &self.miners {
            for record in &miner.payouts {
                if record.status == "submitted_to_node" {
                    if let Some(ref tx_id) = record.tx_id {
                        out.push((miner_id.clone(), record.height, tx_id.clone()));
                    }
                }
            }
        }
        out
    }

    /// Mark a submitted payout as confirmed on chain.
    pub fn confirm_payout(&mut self, miner_id: &str, height: u64, tx_id: &str) {
        let Some(miner) = self.miners.get_mut(miner_id) else {
            return;
        };
        for record in miner.payouts.iter_mut() {
            if record.height == height
                && record.status == "submitted_to_node"
                && record.tx_id.as_deref() == Some(tx_id)
            {
                record.status = "confirmed".to_string();
                break;
            }
        }
    }

    /// Sum of all miners' hashrates over the given window.
    pub fn pool_hashrate_for_window(&self, window_s: u64, now_s: u64) -> f64 {
        self.miners
            .values()
            .map(|miner| miner.hashrate_for_window(window_s, now_s))
            .sum()
    }

    /// Convenience: pool-wide 1-hour hashrate.
    pub fn pool_hashrate_1h(&self) -> f64 {
        self.pool_hashrate_for_window(HASHRATE_WINDOW_1H_S, now_unix_seconds())
    }

    /// Convenience: pool-wide "live" (10-minute) hashrate.
    pub fn pool_hashrate_live(&self) -> f64 {
        self.pool_hashrate_for_window(HASHRATE_WINDOW_LIVE_S, now_unix_seconds())
    }

    /// Total blocks found across all miners.
    pub fn total_blocks_found(&self) -> u64 {
        self.miners.values().map(|miner| miner.blocks_found).sum()
    }

    /// Number of tracked miners.
    pub fn miner_count(&self) -> usize {
        self.miners.len()
    }

    /// Look up a miner by id.
    pub fn get_miner(&self, miner_id: &str) -> Option<&MinerTelemetry> {
        self.miners.get(miner_id)
    }

    /// Iterate over all miners.
    pub fn all_miners(&self) -> impl Iterator<Item = (&String, &MinerTelemetry)> {
        self.miners.iter()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_telemetry() {
        let m = MinerTelemetry::new("worker1", "sha256", "cpu", 1000);
        assert_eq!(m.worker_name, "worker1");
        assert_eq!(m.algorithm, "sha256");
        assert_eq!(m.backend, "cpu");
        assert_eq!(m.first_seen_s, 1000);
        assert_eq!(m.last_seen_s, 1000);
        assert_eq!(m.last_share_time_s, 0);
        assert_eq!(m.valid_shares, 0);
        assert_eq!(m.invalid_shares, 0);
        assert_eq!(m.blocks_found, 0);
        assert!(m.samples.is_empty());
        assert!(m.payouts.is_empty());
        assert!(m.streams.is_empty());
    }

    #[test]
    fn test_push_sample_calculates_hashrate() {
        let mut m = MinerTelemetry::new("w", "sha256", "cpu", 1000);
        // 1_000_000 hashes in 1000 ms = 1_000_000 H/s
        m.push_sample(1_000_000, 1000, 1100);
        let hr = m.hashrate_for_window(HASHRATE_WINDOW_LIVE_S, 1200);
        assert!((hr - 1_000_000.0).abs() < 1.0, "hashrate={hr}");
    }

    #[test]
    fn test_record_job_result_increments_shares() {
        let mut reg = MinerTelemetryRegistry::new();
        reg.record_job_result("minerA", "w1", true, 100, 10);
        reg.record_job_result("minerA", "w1", false, 100, 10);
        let m = reg.get_miner("minerA/w1").expect("miner exists");
        assert_eq!(m.valid_shares, 1);
        assert_eq!(m.invalid_shares, 1);
        assert_eq!(m.completed_jobs, 2);
        assert_eq!(m.total_shares(), 2);
        // default stream "zion" should have matching counts
        let s = m.streams.get("zion").expect("zion stream");
        assert_eq!(s.valid_shares, 1);
        assert_eq!(s.invalid_shares, 1);
    }

    #[test]
    fn test_record_block_found() {
        let mut reg = MinerTelemetryRegistry::new();
        reg.record_block_found("minerB", "w2");
        reg.record_block_found("minerB", "w2");
        let m = reg.get_miner("minerB/w2").expect("miner exists");
        assert_eq!(m.blocks_found, 2);
        assert_eq!(reg.total_blocks_found(), 2);
    }

    #[test]
    fn test_pool_hashrate_sums_all_miners() {
        let mut reg = MinerTelemetryRegistry::new();
        reg.record_job_result("minerA", "w1", true, 1_000_000, 1000);
        reg.record_job_result("minerB", "w2", true, 2_000_000, 1000);
        let now_s = now_unix_seconds();
        let pool_hr = reg.pool_hashrate_for_window(HASHRATE_WINDOW_LIVE_S, now_s);
        // Each miner contributed 1_000_000 and 2_000_000 H/s respectively.
        assert!(
            (pool_hr - 3_000_000.0).abs() < 1.0,
            "pool_hashrate={pool_hr}"
        );
    }

    #[test]
    fn test_prune_old_samples() {
        let mut m = MinerTelemetry::new("w", "sha256", "cpu", 1000);
        // Sample completed at t=1100 (the now_s passed to push_sample).
        m.push_sample(1_000_000, 1000, 1100);
        assert_eq!(m.samples.len(), 1);
        // Advance well beyond 24h from the sample's completion time — it
        // should be pruned.
        let far_future = 1100 + HASHRATE_WINDOW_24H_S + 1;
        m.prune_samples(far_future);
        assert!(m.samples.is_empty(), "samples should be pruned");
        // hashrate should now be zero
        assert_eq!(m.hashrate_for_window(HASHRATE_WINDOW_1H_S, far_future), 0.0);
    }
}
