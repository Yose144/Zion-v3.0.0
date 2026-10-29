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

/// Minimum share samples for a fixed-window hashrate estimate to be
/// statistically meaningful — below this, `stream_hashrate` stretches the
/// effective window backward (up to 1h) to reach this count.
pub const MIN_RATE_SAMPLES: usize = 6;
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
    /// Expected-hashes samples for accepted shares on this stream. External
    /// algos have incompatible difficulty scales, so each share carries its
    /// own expected work (`2^(8*len(target))/target`) instead of using the
    /// ZION job estimator.
    pub work: VecDeque<WorkSample>,
    /// Reject counts by normalized bucket — see
    /// [`MinerTelemetryRegistry::record_reject_reason`]. Bounded to ~6 keys.
    pub reject_reasons: HashMap<String, u64>,
    /// Accepts credited on an unverifiable upstream reply
    /// (`accepted_unknown` / `accepted_stale_upstream`) — the
    /// upstream-quality metric the 2026-10-26 pool audit asked for
    /// (P-05 residual); these count inside `valid_shares` too.
    pub unverified_shares: u64,
}

/// Normalize a reject reason string into a stable, bounded bucket label —
/// upstream pools return free-form error text, so bucketing keeps the
/// per-stream map small regardless of wording.
pub fn reject_bucket(reason: &str) -> &'static str {
    let r = reason.to_ascii_lowercase();
    if r.contains("duplic") {
        "duplicate"
    } else if r.contains("difficult")
        || r.split(|c: char| !c.is_ascii_alphanumeric())
            .any(|t| t == "low")
    {
        "low_difficulty"
    } else if r.contains("stale") || r.contains("job") || r.contains("unknown") {
        "stale"
    } else if r.contains("unauthor") || r.contains("rate_limit") || r.contains("banned") {
        "unauthorized"
    } else if r.contains("solution") || r.contains("parse") || r.contains("malform") {
        "malformed"
    } else {
        "other"
    }
}

/// Expected hashes per share for a big-endian target byte string:
/// `2^(8*len)/target`. Width-aware — a 32-byte target divides the 2^256
/// space, a 64-byte (poseidon2) target divides 2^512. Returns 0.0 for
/// empty/zero targets so callers can skip the sample.
pub fn expected_hashes_for_target(target_be: &[u8]) -> f64 {
    use num_bigint::BigUint;
    if target_be.is_empty() || target_be.iter().all(|b| *b == 0) {
        return 0.0;
    }
    let space = BigUint::from(1u8) << (target_be.len() * 8);
    let target = BigUint::from_bytes_be(target_be);
    let eh = space / target;
    eh.iter_u64_digits()
        .rev()
        .fold(0.0f64, |acc, d| acc * 18446744073709551616.0 + d as f64)
}

/// Hex convenience wrapper for [`expected_hashes_for_target`].
pub fn expected_hashes_for_target_hex(target_hex: &str) -> f64 {
    hex::decode(target_hex.trim_start_matches("0x"))
        .map(|b| expected_hashes_for_target(&b))
        .unwrap_or(0.0)
}

/// U256 variant (pearl share targets are `BigUint` in the 2^256 space) —
/// pads the big-endian encoding to 32 bytes so the width is always right.
pub fn expected_hashes_for_u256(target: &num_bigint::BigUint) -> f64 {
    let bytes = target.to_bytes_be();
    if bytes.is_empty() {
        return 0.0;
    }
    if bytes.len() >= 32 {
        return expected_hashes_for_target(&bytes);
    }
    let mut padded = [0u8; 32];
    padded[32 - bytes.len()..].copy_from_slice(&bytes);
    expected_hashes_for_target(&padded)
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
    /// ZIS user id bound at V3 Hello (phase C auth); "" = anonymous session.
    pub zis_user: String,
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
            zis_user: String::new(),
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

    /// Expected hashes/sec for one coin stream over `window_s`. Each
    /// accepted external share contributes its own expected work, so
    /// different algos yield honest rates despite incompatible scales.
    ///
    /// Low-share-rate streams (e.g. PRL at ~1 share/5 min) leave the 10-min
    /// window with 2–4 samples, so the plain estimate swings wildly between
    /// readings. When the window holds fewer than [`MIN_RATE_SAMPLES`],
    /// older samples (up to 1h back) are folded in until the count is met
    /// and the divisor becomes the actual covered span — the estimate then
    /// uses ~35 min of history instead of two lucky/unlucky samples. Dense
    /// streams are unaffected: all in-window samples count exactly as before.
    pub fn stream_hashrate(&self, stream: &str, window_s: u64, now_s: u64) -> f64 {
        let Some(s) = self.streams.get(stream) else {
            return 0.0;
        };
        let mut work = 0f64;
        let mut n = 0usize;
        let mut oldest_t = now_s;
        for sample in s.work.iter().rev() {
            let in_window = sample.completed_at_s.saturating_add(window_s) >= now_s;
            let in_cap = sample.completed_at_s.saturating_add(HASHRATE_WINDOW_1H_S) >= now_s;
            if !in_window && (n >= MIN_RATE_SAMPLES || !in_cap) {
                break;
            }
            work += sample.attempted_hashes as f64;
            n += 1;
            oldest_t = sample.completed_at_s;
        }
        if n == 0 {
            return 0.0;
        }
        // Denominator covers the real span when the window had to stretch —
        // and keeps growing past the newest sample if the stream stalls, so
        // the estimate decays rather than freezing at a stale rate.
        let span = now_s.saturating_sub(oldest_t);
        work / window_s.max(span) as f64
    }

    /// Per-stream live (10-minute) hashrates — `{coin: hps}`.
    pub fn stream_hashrates(&self, window_s: u64, now_s: u64) -> HashMap<String, f64> {
        self.streams
            .iter()
            .filter(|(_, s)| !s.work.is_empty())
            .map(|(name, _)| (name.clone(), self.stream_hashrate(name, window_s, now_s)))
            .collect()
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

    /// Create or refresh a miner session entry. `zis_user` carries the ZIS
    /// user id bound at V3 Hello ("" for anonymous / v1 sessions).
    pub fn touch_session(
        &mut self,
        miner_id: &str,
        worker_name: &str,
        algorithm: &str,
        backend: &str,
        zis_user: &str,
    ) {
        let now_s = now_unix_seconds();
        let key = format!("{miner_id}/{worker_name}");
        self.miners
            .entry(key)
            .and_modify(|miner| {
                miner.touch(worker_name, algorithm, backend, now_s);
                miner.zis_user = zis_user.to_string();
            })
            .or_insert_with(|| {
                let mut m = MinerTelemetry::new(worker_name, algorithm, backend, now_s);
                m.zis_user = zis_user.to_string();
                m
            });
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
            // Same work accounting as `record_external_share` — without this
            // `stream_hashrate` returns 0 for native (ZION) shares and the
            // coin is absent from `hashrate_by_coin` / `miner_history` hps.
            if attempted_hashes > 0 {
                stats.work.push_back(WorkSample {
                    completed_at_s: now_s,
                    attempted_hashes,
                    elapsed_ms,
                });
                while matches!(stats.work.front(), Some(s) if s.completed_at_s.saturating_add(HASHRATE_WINDOW_24H_S) < now_s)
                {
                    stats.work.pop_front();
                }
            }
        } else {
            stats.invalid_shares = stats.invalid_shares.saturating_add(1);
        }
    }

    /// Record an external (AuxPoW) share result on a named coin stream.
    /// Unlike `record_job_result_stream`, this does not touch the aggregate
    /// valid/invalid totals or the ZION hashrate estimator — external shares
    /// use different difficulty/hashrate scales. `expected_hashes` is the
    /// per-share work of the served target (0 = unknown, skips sampling);
    /// it drives the per-stream hashrate estimator.
    pub fn record_external_share(
        &mut self,
        miner_id: &str,
        worker_name: &str,
        coin: &str,
        accepted: bool,
        expected_hashes: f64,
    ) {
        let now_s = now_unix_seconds();
        let key = format!("{miner_id}/{worker_name}");
        let miner = self
            .miners
            .entry(key)
            .or_insert_with(|| MinerTelemetry::new(worker_name, "", "", now_s));
        miner.touch(worker_name, "", "", now_s);
        let stats = miner.streams.entry(coin.to_ascii_lowercase()).or_default();
        if accepted {
            stats.valid_shares = stats.valid_shares.saturating_add(1);
            stats.last_share_time_s = now_s;
            if expected_hashes > 0.0 {
                stats.work.push_back(WorkSample {
                    completed_at_s: now_s,
                    attempted_hashes: expected_hashes.min(u64::MAX as f64) as u64,
                    elapsed_ms: 0,
                });
                while matches!(stats.work.front(), Some(s) if s.completed_at_s.saturating_add(HASHRATE_WINDOW_24H_S) < now_s)
                {
                    stats.work.pop_front();
                }
            }
        } else {
            stats.invalid_shares = stats.invalid_shares.saturating_add(1);
        }
    }

    /// Count a share credited despite an unverifiable upstream outcome
    /// (`accepted_unknown`/`accepted_stale_upstream`). Called alongside
    /// `record_external_share` on those status strings — the counter feeds
    /// the per-stream `unverified_shares` field in `/miners` and is the
    /// upstream-quality signal for alert tuning.
    pub fn record_unverified_credit(&mut self, miner_id: &str, worker_name: &str, stream: &str) {
        let key = format!("{miner_id}/{worker_name}");
        if let Some(miner) = self.miners.get_mut(&key) {
            let stats = miner
                .streams
                .entry(stream.to_ascii_lowercase())
                .or_default();
            stats.unverified_shares = stats.unverified_shares.saturating_add(1);
        }
    }

    /// Increment a stream's reject-reason bucket. Called alongside the
    /// `accepted=false` paths of `record_job_result*`/`record_external_share`
    /// with the protocol-level reason string; the reason is normalized by
    /// [`reject_bucket`].
    pub fn record_reject_reason(
        &mut self,
        miner_id: &str,
        worker_name: &str,
        stream: &str,
        reason: &str,
    ) {
        let key = format!("{miner_id}/{worker_name}");
        let Some(miner) = self.miners.get_mut(&key) else {
            return;
        };
        let stats = miner
            .streams
            .entry(stream.to_ascii_lowercase())
            .or_default();
        *stats
            .reject_reasons
            .entry(reject_bucket(reason).to_string())
            .or_insert(0) += 1;
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
    pub fn record_submitted_payouts(&mut self, height: u64, payouts: &[PayoutEntry], tx_id: &str) {
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
    pub fn record_failed_payouts(&mut self, height: u64, payouts: &[PayoutEntry], error: &str) {
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
    fn test_stream_hashrate_external() {
        let mut reg = MinerTelemetryRegistry::new();
        // Two accepted shares at 5e6 expected-hashes each inside the live
        // window ≈ 10e6/window hps; rejected shares contribute no work.
        reg.record_external_share("m", "w", "qtu", true, 5e6);
        reg.record_external_share("m", "w", "qtu", true, 5e6);
        reg.record_external_share("m", "w", "qtu", false, 5e6);
        let now_s = now_unix_seconds();
        let m = reg.get_miner("m/w").expect("miner");
        let hps = m.stream_hashrate("qtu", HASHRATE_WINDOW_LIVE_S, now_s);
        assert!(hps > 0.0);
        assert!(
            (hps - 1e7 / HASHRATE_WINDOW_LIVE_S as f64).abs() < 1.0,
            "hps={hps}"
        );
        let s = m.streams.get("qtu").unwrap();
        assert_eq!(s.valid_shares, 2);
        assert_eq!(s.invalid_shares, 1);
        // Aggregate ZION estimator is untouched by external shares.
        assert_eq!(m.hashrate_live(now_s), 0.0);
    }

    #[test]
    fn test_stream_hashrate_sparse_window_stretches() {
        // Fewer than MIN_RATE_SAMPLES in the nominal window → older samples
        // (up to 1h) fold in and the divisor covers the real span.
        let now_s = now_unix_seconds();
        let mut m = MinerTelemetry::new("w", "", "", now_s);
        let stats = m.streams.entry("prl".to_string()).or_default();
        // 2 samples inside the 10-min window, 4 older ones behind it —
        // cadence ~300 s, eh=6 each → true rate ≈ 6/300 = 0.02/s.
        // Pushed oldest→newest so the deque mirrors production order.
        for i in (0..6u64).rev() {
            stats.work.push_back(WorkSample {
                completed_at_s: now_s - 60 - i * 300,
                attempted_hashes: 6,
                elapsed_ms: 0,
            });
        }
        let hps = m.stream_hashrate("prl", HASHRATE_WINDOW_LIVE_S, now_s);
        // Span from oldest included sample (~1560s ago) to now dominates the
        // nominal 600s window → rate ≈ 36/~1560 ≈ 0.023, not 12/600 = 0.02…
        // wait: 2 in-window + 4 extended → 6 samples, work=36,
        // span = 60+5*300 = 1560 → 36/1560.
        let expect = 36.0 / 1560.0;
        assert!(
            (hps - expect).abs() < expect * 0.15,
            "hps={hps} expect≈{expect}"
        );
    }

    #[test]
    fn test_stream_hashrate_stalled_stream_decays() {
        // When the stream goes quiet the denominator keeps growing past the
        // newest sample, so the displayed rate decays toward zero rather
        // than freezing at the last value.
        let now_s = now_unix_seconds();
        let mut m = MinerTelemetry::new("w", "", "", now_s);
        let stats = m.streams.entry("qtu".to_string()).or_default();
        for i in 0..6u64 {
            stats.work.push_back(WorkSample {
                // all samples ~45–47 min old — stream stopped long ago
                completed_at_s: now_s - 2700 - i * 10,
                attempted_hashes: 6,
                elapsed_ms: 0,
            });
        }
        let hps = m.stream_hashrate("qtu", HASHRATE_WINDOW_LIVE_S, now_s);
        // span ≈ 2750s → 36/2750 ≈ 0.013 — far below the naive 36/600.
        assert!(hps < 36.0 / 600.0 * 0.5, "stalled hps={hps} should decay");
    }

    #[test]
    fn test_stream_hashrate_native_zion() {
        // Regression: record_job_result_stream must push work samples so the
        // native "zion" stream is visible to stream_hashrate /
        // hashrate_by_coin / miner_history (previously external-only).
        let mut reg = MinerTelemetryRegistry::new();
        reg.record_job_result("m", "w", true, 2_000_000, 100);
        reg.record_job_result("m", "w", true, 2_000_000, 100);
        reg.record_job_result("m", "w", false, 2_000_000, 100);
        let now_s = now_unix_seconds();
        let m = reg.get_miner("m/w").expect("miner");
        let hps = m.stream_hashrate("zion", HASHRATE_WINDOW_LIVE_S, now_s);
        assert!(
            (hps - 4e6 / HASHRATE_WINDOW_LIVE_S as f64).abs() < 1.0,
            "zion hps={hps}"
        );
        let rates = m.stream_hashrates(HASHRATE_WINDOW_LIVE_S, now_s);
        assert!(rates.contains_key("zion"), "zion key missing: {rates:?}");
    }

    #[test]
    fn test_expected_hashes_for_target() {
        // 32-byte target = full 2^256 space → 1 expected hash.
        let mut t = [0xFFu8; 32];
        let eh = expected_hashes_for_target(&t);
        assert!((eh - 1.0).abs() < 1e-12, "eh={eh}");
        // Halving the target doubles expected work.
        t[0] = 0x7F;
        let eh2 = expected_hashes_for_target(&t);
        assert!(eh2 > 1.9 && eh2 < 2.2, "eh2={eh2}");
        // Width-aware: 64-byte (poseidon2) full target → 1 hash.
        assert_eq!(expected_hashes_for_target(&[0xFFu8; 64]), 1.0);
        // Zero / empty → 0 (caller skips the sample).
        assert_eq!(expected_hashes_for_target(&[0u8; 32]), 0.0);
        assert_eq!(expected_hashes_for_target(&[]), 0.0);
        // Hex wrapper + u256 padding.
        assert_eq!(expected_hashes_for_target_hex(&"ff".repeat(32)), 1.0);
        let big = num_bigint::BigUint::from(1u8) << 255;
        assert_eq!(expected_hashes_for_u256(&big), 2.0);
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
    fn test_reject_reason_buckets() {
        let mut reg = MinerTelemetryRegistry::new();
        reg.record_external_share("m", "w", "qtu", false, 0.0);
        reg.record_reject_reason("m", "w", "qtu", "rejected:low difficulty");
        reg.record_reject_reason("m", "w", "qtu", "duplicate");
        reg.record_reject_reason("m", "w", "qtu", "stale");
        // Accepted share must not enter reject buckets.
        reg.record_external_share("m", "w", "qtu", true, 1e6);
        let m = reg.get_miner("m/w").expect("miner");
        let s = m.streams.get("qtu").expect("qtu stream");
        assert_eq!(s.reject_reasons.get("low_difficulty"), Some(&1));
        assert_eq!(s.reject_reasons.get("duplicate"), Some(&1));
        assert_eq!(s.reject_reasons.get("stale"), Some(&1));
        assert_eq!(s.reject_reasons.len(), 3);
        assert_eq!(s.valid_shares, 1);
        assert_eq!(s.invalid_shares, 1);
    }

    /// Regression for QTU/SRB local-dedup path (2026-10-29): each local
    /// `duplicate` must bump both `invalid_shares` and the duplicate bucket
    /// — previously `qtu_handle_submit` returned before telemetry, so
    /// `/miners` showed accept_rate=1.0 while SRB reported ~30% rejects.
    #[test]
    fn test_local_duplicate_rejects_accumulate() {
        let mut reg = MinerTelemetryRegistry::new();
        for _ in 0..5 {
            reg.record_external_share("qz…", "qz….dest-zion", "QTU", false, 0.0);
            reg.record_reject_reason("qz…", "qz….dest-zion", "qtu", "duplicate");
        }
        for _ in 0..10 {
            reg.record_external_share("qz…", "qz….dest-zion", "QTU", true, 1e9);
        }
        let s = reg
            .get_miner("qz…/qz….dest-zion")
            .expect("miner")
            .streams
            .get("qtu")
            .expect("qtu")
            .clone();
        assert_eq!(s.valid_shares, 10);
        assert_eq!(s.invalid_shares, 5);
        assert_eq!(s.reject_reasons.get("duplicate"), Some(&5));
        let total = s.valid_shares + s.invalid_shares;
        let rate = s.valid_shares as f64 / total as f64;
        assert!((rate - (10.0 / 15.0)).abs() < 1e-9, "rate={rate}");
    }

    /// P-05 audit residual: unverifiable upstream accepts count in
    /// `unverified_shares` (and stay inside `valid_shares` — they ARE
    /// credited, just flagged as upstream-quality signal).
    #[test]
    fn test_unverified_credit_counter() {
        let mut reg = MinerTelemetryRegistry::new();
        reg.record_external_share("m", "w", "prl", true, 1e6);
        reg.record_unverified_credit("m", "w", "prl");
        reg.record_external_share("m", "w", "prl", true, 1e6);
        reg.record_unverified_credit("m", "w", "prl");
        // A fully verified accept must not bump the counter.
        reg.record_external_share("m", "w", "prl", true, 1e6);
        let s = reg.get_miner("m/w").unwrap().streams["prl"].clone();
        assert_eq!(s.unverified_shares, 2);
        assert_eq!(s.valid_shares, 3);
        // Unknown miner key is a no-op (credit recorded before telemetry
        // in some orderings must not panic).
        reg.record_unverified_credit("nobody", "w", "qtu");
    }

    #[test]
    fn test_reject_reason_independent_per_stream() {
        let mut reg = MinerTelemetryRegistry::new();
        reg.record_external_share("m", "w", "qtu", false, 0.0);
        reg.record_external_share("m", "w", "prl", false, 0.0);
        reg.record_reject_reason("m", "w", "qtu", "timeout");
        reg.record_reject_reason("m", "w", "prl", "rejected:bad proof");
        let m = reg.get_miner("m/w").expect("miner");
        assert_eq!(
            m.streams["qtu"].reject_reasons.get("other"),
            Some(&1),
            "qtu timeout buckets to 'other' (no keyword match)"
        );
        assert_eq!(m.streams["prl"].reject_reasons.get("other"), Some(&1));
        assert!(!m.streams["qtu"]
            .reject_reasons
            .contains_key("low_difficulty"));
    }

    #[test]
    fn test_reject_bucket_normalization() {
        assert_eq!(reject_bucket("duplicate"), "duplicate");
        assert_eq!(reject_bucket("Job is a duplicate"), "duplicate");
        assert_eq!(reject_bucket("low difficulty"), "low_difficulty");
        assert_eq!(
            reject_bucket("rejected:difficulty too low"),
            "low_difficulty"
        );
        assert_eq!(reject_bucket("below_target"), "other");
        assert_eq!(reject_bucket("stale"), "stale");
        assert_eq!(reject_bucket("unknown job"), "stale");
        assert_eq!(reject_bucket("job not found"), "stale");
        assert_eq!(reject_bucket("unauthorized_miner"), "unauthorized");
        assert_eq!(reject_bucket("rate_limited"), "unauthorized");
        assert_eq!(
            reject_bucket("banned: too many invalid shares"),
            "unauthorized"
        );
        assert_eq!(reject_bucket("invalid solution"), "malformed");
        assert_eq!(reject_bucket("parse error"), "malformed");
        // Upstream free-form strings must stay bounded.
        assert_eq!(reject_bucket("some exotic upstream text"), "other");
        assert_eq!(reject_bucket("timeout"), "other");
        assert_eq!(reject_bucket("not_connected"), "other");
        assert_eq!(reject_bucket("channel_closed"), "other");
        assert_eq!(reject_bucket("external_not_enabled"), "other");
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
