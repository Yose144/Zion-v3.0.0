//! Worker reputation tracking for the NCL marketplace.
//!
//! Reputation drives worker selection when multiple workers support the same
//! backend. Higher-reputation workers are preferred, rewarding reliability
//! and punishing failures.
//!
//! ## Scoring model
//! ```text
//! score = base_score * success_rate * (1 + consciousness_bonus)
//!       * recency_factor
//! ```
//! - `success_rate`   = accepted / (accepted + failed)
//! - `consciousness_bonus` = `consciousness_level * 0.05`  (max +25 % at level 5)
//! - `recency_factor` = soft decay when worker has been idle
//!
//! Score is clamped to [0.0, 100.0].

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─── ReputationRecord ────────────────────────────────────────────────────────

/// Per-worker reputation record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationRecord {
    pub worker_id: String,
    pub wallet_address: String,
    /// Consciousness level of the miner (0–5); higher = bonus multiplier
    pub consciousness_level: u8,
    /// Cumulative successfully completed jobs
    pub jobs_completed: u64,
    /// Cumulative failed / rejected jobs
    pub jobs_failed: u64,
    /// Cumulative timed-out jobs
    pub jobs_timeout: u64,
    /// Total ZION atomic units earned (for display/ranking)
    pub total_earned: u64,
    /// Average completion time in milliseconds (EMA)
    pub avg_completion_ms: f64,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    /// Track per-backend success for specialisation detection
    pub backend_success: HashMap<String, u64>,
    pub backend_failure: HashMap<String, u64>,
}

impl ReputationRecord {
    pub fn new(worker_id: impl Into<String>, wallet_address: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            worker_id: worker_id.into(),
            wallet_address: wallet_address.into(),
            consciousness_level: 0,
            jobs_completed: 0,
            jobs_failed: 0,
            jobs_timeout: 0,
            total_earned: 0,
            avg_completion_ms: 0.0,
            first_seen: now,
            last_seen: now,
            backend_success: HashMap::new(),
            backend_failure: HashMap::new(),
        }
    }

    // ─── Counters ────────────────────────────────────────────────────────

    /// Record a successful job completion.
    pub fn record_success(&mut self, backend: &str, completion_ms: f64, reward_flowers: u64) {
        self.jobs_completed += 1;
        self.total_earned += reward_flowers;
        self.last_seen = Utc::now();
        *self.backend_success.entry(backend.into()).or_default() += 1;

        // Update avg_completion_ms using EMA (α = 0.2)
        if self.avg_completion_ms == 0.0 {
            self.avg_completion_ms = completion_ms;
        } else {
            self.avg_completion_ms = 0.8 * self.avg_completion_ms + 0.2 * completion_ms;
        }
    }

    /// Record a failed job.
    pub fn record_failure(&mut self, backend: &str) {
        self.jobs_failed += 1;
        self.last_seen = Utc::now();
        *self.backend_failure.entry(backend.into()).or_default() += 1;
    }

    /// Record a timed-out job.
    pub fn record_timeout(&mut self) {
        self.jobs_timeout += 1;
        self.last_seen = Utc::now();
    }

    // ─── Metrics ─────────────────────────────────────────────────────────

    /// Total jobs attempted (success + failure + timeout).
    pub fn total_jobs(&self) -> u64 {
        self.jobs_completed + self.jobs_failed + self.jobs_timeout
    }

    /// Success rate 0.0–1.0.
    pub fn success_rate(&self) -> f64 {
        let total = self.total_jobs();
        if total == 0 {
            return 1.0; // new worker — assume trustworthy
        }
        self.jobs_completed as f64 / total as f64
    }

    /// Composite reputation score 0.0–100.0.
    pub fn score(&self) -> f64 {
        const BASE: f64 = 100.0;

        let success = self.success_rate();
        let consciousness_bonus = self.consciousness_level as f64 * 0.05; // +5% per level

        // Recency decay: score is full within 24 h of last activity,
        // then decays by 1 % per extra hour of inactivity (floor 50 %).
        let hours_idle = Utc::now()
            .signed_duration_since(self.last_seen)
            .num_hours()
            .max(0) as f64;
        let recency = if hours_idle <= 24.0 {
            1.0
        } else {
            (1.0 - (hours_idle - 24.0) * 0.01).max(0.5)
        };

        let score = BASE * success * (1.0 + consciousness_bonus) * recency;
        score.clamp(0.0, 100.0)
    }

    /// Best backend for this worker (most successes).
    pub fn best_backend(&self) -> Option<&str> {
        self.backend_success
            .iter()
            .max_by_key(|(_, &v)| v)
            .map(|(k, _)| k.as_str())
    }
}

// ─── ReputationRegistry ──────────────────────────────────────────────────────

/// Central registry of all worker reputation records.
pub struct ReputationRegistry {
    records: HashMap<String, ReputationRecord>,
    /// Minimum score below which a worker is considered unreliable
    pub ban_threshold: f64,
}

impl ReputationRegistry {
    pub fn new() -> Self {
        Self {
            records: HashMap::new(),
            ban_threshold: 20.0,
        }
    }

    /// Ensure a record exists for this worker.
    pub fn ensure(&mut self, worker_id: &str, wallet: &str) {
        self.records
            .entry(worker_id.into())
            .or_insert_with(|| ReputationRecord::new(worker_id, wallet));
    }

    pub fn get(&self, worker_id: &str) -> Option<&ReputationRecord> {
        self.records.get(worker_id)
    }

    pub fn get_mut(&mut self, worker_id: &str) -> Option<&mut ReputationRecord> {
        self.records.get_mut(worker_id)
    }

    /// Set consciousness level for a worker (called on miner level-up events).
    pub fn set_consciousness(&mut self, worker_id: &str, level: u8) {
        if let Some(r) = self.records.get_mut(worker_id) {
            r.consciousness_level = level;
        }
    }

    /// Returns `true` when the worker's score is below `ban_threshold`.
    pub fn is_banned(&self, worker_id: &str) -> bool {
        self.records
            .get(worker_id)
            .map(|r| r.score() < self.ban_threshold)
            .unwrap_or(false)
    }

    /// Return sorted leaderboard (highest score first).
    pub fn leaderboard(&self) -> Vec<(&str, f64)> {
        let mut board: Vec<(&str, f64)> = self
            .records
            .iter()
            .map(|(id, r)| (id.as_str(), r.score()))
            .collect();
        board.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        board
    }

    /// Select the best available worker from a candidate list, filtered by
    /// whether their reputation is above the ban threshold.
    pub fn best_worker<'a>(&self, candidates: &[&'a str]) -> Option<&'a str> {
        candidates
            .iter()
            .filter(|&&id| !self.is_banned(id))
            .max_by(|&&a, &&b| {
                let sa = self.records.get(a).map(|r| r.score()).unwrap_or(100.0);
                let sb = self.records.get(b).map(|r| r.score()).unwrap_or(100.0);
                sa.partial_cmp(&sb).unwrap_or(std::cmp::Ordering::Equal)
            })
            .copied()
    }

    pub fn worker_count(&self) -> usize {
        self.records.len()
    }
}

impl Default for ReputationRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_worker(id: &str) -> ReputationRecord {
        ReputationRecord::new(id, "zion1test")
    }

    #[test]
    fn test_new_worker_score_is_full() {
        let w = make_worker("w1");
        let score = w.score();
        assert!(
            score > 90.0,
            "new worker should have near-full score, got {score}"
        );
    }

    #[test]
    fn test_failures_lower_score() {
        let mut w = make_worker("w1");
        // 10 successes
        for _ in 0..10 {
            w.record_success("onnx", 100.0, 10_000);
        }
        let good_score = w.score();
        // Then 20 failures
        for _ in 0..20 {
            w.record_failure("onnx");
        }
        let bad_score = w.score();
        assert!(
            bad_score < good_score,
            "failures should lower score: {bad_score} < {good_score}"
        );
    }

    #[test]
    fn test_consciousness_bonus() {
        // Both workers have identical job history (5 failures + 1 success → rate ~16.7%)
        // so neither hits the 100.0 clamp and the consciousness bonus is visible.
        let mut low = make_worker("low");
        low.consciousness_level = 0;
        for _ in 0..5 {
            low.record_failure("onnx");
        }
        low.record_success("onnx", 100.0, 0);

        let mut high = make_worker("high");
        high.consciousness_level = 5;
        for _ in 0..5 {
            high.record_failure("onnx");
        }
        high.record_success("onnx", 100.0, 0);

        assert!(
            high.score() > low.score(),
            "high consciousness should score higher: {} vs {}",
            high.score(),
            low.score()
        );
    }

    #[test]
    fn test_ban_threshold() {
        let mut reg = ReputationRegistry::new();
        reg.ensure("bad_worker", "zion1bad");
        // Record 90 % failures
        for _ in 0..90 {
            reg.get_mut("bad_worker").unwrap().record_failure("onnx");
        }
        for _ in 0..10 {
            reg.get_mut("bad_worker")
                .unwrap()
                .record_success("onnx", 100.0, 0);
        }
        assert!(
            reg.is_banned("bad_worker"),
            "worker with 90% failure rate should be banned"
        );
    }

    #[test]
    fn test_best_worker() {
        let mut reg = ReputationRegistry::new();
        reg.ensure("average", "zion1a");
        reg.ensure("great", "zion1b");
        // Give "great" more successes
        for _ in 0..50 {
            reg.get_mut("great")
                .unwrap()
                .record_success("onnx", 80.0, 0);
        }
        let best = reg.best_worker(&["average", "great"]).unwrap();
        assert_eq!(best, "great");
    }

    #[test]
    fn test_leaderboard_sorted() {
        let mut reg = ReputationRegistry::new();
        reg.ensure("alpha", "zion1a");
        reg.ensure("beta", "zion1b");
        for _ in 0..5 {
            reg.get_mut("beta").unwrap().record_success("wasm", 50.0, 0);
        }
        for _ in 0..5 {
            reg.get_mut("alpha").unwrap().record_failure("wasm");
        }
        let board = reg.leaderboard();
        assert_eq!(board[0].0, "beta");
    }

    #[test]
    fn test_best_backend() {
        let mut w = make_worker("w1");
        w.record_success("onnx", 100.0, 0);
        w.record_success("onnx", 100.0, 0);
        w.record_success("wasm", 100.0, 0);
        assert_eq!(w.best_backend(), Some("onnx"));
    }
}
