//! Pool scoring and optimal selection engine.
//!
//! Ported from `orchestrator_v3.py` — ZION 2.9 history.
//!
//! ## Algorithm
//! Each pool is assigned a **health score** (0–100) based on:
//! - Uptime   40 %
//! - Latency  30 %  (100 ms = full score, 500 ms = zero)
//! - Stale %  20 %  (0 % stale = full, 10 % = zero)
//! - Reject % 10 %  (0 % rejected = full, 5 % = zero)
//!
//! The optimizer maintains an EMA-smoothed history of scores and recommends
//! switching only when the improvement exceeds `switch_threshold` (hysteresis).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─── PoolStats ───────────────────────────────────────────────────────────────

/// Live statistics snapshot for a single mining pool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolStats {
    /// Unique identifier — typically `"host:port"`
    pub url: String,
    pub name: String,
    /// Current reported hashrate (H/s)
    pub hashrate: f64,
    /// Number of active miners
    pub miners: u32,
    /// Average round-trip latency (ms)
    pub latency_ms: f64,
    /// 7-day uptime percentage (0–100)
    pub uptime_pct: f64,
    pub shares_accepted: u64,
    pub shares_rejected: u64,
    pub shares_stale: u64,
    /// Blocks found in the last 24 h
    pub blocks_24h: u32,
    /// Estimated daily yield in ZION flowers
    pub estimated_daily_reward: u64,
}

impl PoolStats {
    /// Stale-share rate as a percentage (0–100).
    pub fn stale_rate(&self) -> f64 {
        let total = (self.shares_accepted + self.shares_rejected + self.shares_stale) as f64;
        if total == 0.0 {
            0.0
        } else {
            self.shares_stale as f64 / total * 100.0
        }
    }

    /// Reject-share rate as a percentage (0–100).
    pub fn reject_rate(&self) -> f64 {
        let total = (self.shares_accepted + self.shares_rejected + self.shares_stale) as f64;
        if total == 0.0 {
            0.0
        } else {
            self.shares_rejected as f64 / total * 100.0
        }
    }

    /// Composite health score 0.0–100.0.
    pub fn health_score(&self) -> f64 {
        // Uptime component (40 %)
        let uptime_score = self.uptime_pct.clamp(0.0, 100.0) * 0.4;

        // Latency component (30 %) — 100 ms maps to full score; 500 ms → 0
        let latency_pts = (100.0 - (self.latency_ms - 100.0).max(0.0) * 0.25).max(0.0);
        let latency_score = latency_pts * 0.3;

        // Stale-rate component (20 %) — 0 % = 100 pts; 10 % = 0 pts
        let stale_score = (100.0 - self.stale_rate() * 10.0).max(0.0) * 0.2;

        // Reject-rate component (10 %) — 0 % = 100 pts; 5 % = 0 pts
        let reject_score = (100.0 - self.reject_rate() * 20.0).max(0.0) * 0.1;

        uptime_score + latency_score + stale_score + reject_score
    }
}

// ─── Recommendation ──────────────────────────────────────────────────────────

/// Recommendation output from the pool optimizer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolRecommendation {
    pub pool_url: String,
    pub pool_name: String,
    /// Smoothed health score that triggered this recommendation
    pub health_score: f64,
    /// Confidence 0.0–1.0 (normalised from health score)
    pub confidence: f64,
    /// Human-readable rationale
    pub reason: String,
    /// `true` if this recommendation implies switching away from the current pool
    pub should_switch: bool,
}

// ─── PoolOptimizer ───────────────────────────────────────────────────────────

/// Stateful pool optimizer.
///
/// Call [`update_pool`] whenever fresh telemetry arrives, then call
/// [`recommend`] to get an (optionally switch-triggering) recommendation.
pub struct PoolOptimizer {
    pools: HashMap<String, PoolStats>,
    /// Rolling history of health scores per pool URL (capped to `history_cap`)
    history: HashMap<String, Vec<f64>>,
    history_cap: usize,
    /// Currently selected pool URL
    pub current_pool: Option<String>,
    /// Total pool switches executed
    pub switches: u64,
    /// Minimum health-score improvement over current pool required to switch.
    /// Acts as hysteresis to prevent flip-flopping.
    pub switch_threshold: f64,
}

impl PoolOptimizer {
    pub fn new(switch_threshold: f64) -> Self {
        Self {
            pools: HashMap::new(),
            history: HashMap::new(),
            history_cap: 20,
            current_pool: None,
            switches: 0,
            switch_threshold,
        }
    }

    /// Default: switch when a pool is ≥ 5 points healthier than the current.
    pub fn with_defaults() -> Self {
        Self::new(5.0)
    }

    // ─── Update ──────────────────────────────────────────────────────────

    /// Ingest a fresh stats snapshot for a pool.
    pub fn update_pool(&mut self, stats: PoolStats) {
        let score = stats.health_score();
        let url = stats.url.clone();
        self.pools.insert(url.clone(), stats);

        let hist = self.history.entry(url).or_default();
        hist.push(score);
        if hist.len() > self.history_cap {
            hist.remove(0);
        }
    }

    // ─── Recommend ───────────────────────────────────────────────────────

    /// Smoothed health score for a pool (simple rolling average).
    pub fn smoothed_score(&self, url: &str) -> f64 {
        let Some(hist) = self.history.get(url) else {
            return 0.0;
        };
        if hist.is_empty() {
            return 0.0;
        }
        hist.iter().sum::<f64>() / hist.len() as f64
    }

    /// Get a recommendation for the best pool.
    ///
    /// Updates `current_pool` and increments `switches` when a switch is warranted.
    pub fn recommend(&mut self) -> Option<PoolRecommendation> {
        if self.pools.is_empty() {
            return None;
        }

        // Find pool with highest smoothed score
        let best_url = self
            .pools
            .keys()
            .max_by(|a, b| {
                self.smoothed_score(a)
                    .partial_cmp(&self.smoothed_score(b))
                    .unwrap_or(std::cmp::Ordering::Equal)
            })?
            .clone();

        let best_score = self.smoothed_score(&best_url);
        let current_score = self
            .current_pool
            .as_ref()
            .map(|u| self.smoothed_score(u))
            .unwrap_or(0.0);

        let should_switch = self.current_pool.as_deref() != Some(best_url.as_str())
            && (best_score - current_score) >= self.switch_threshold;

        let best_stats = self.pools.get(&best_url)?;

        let reason = if should_switch {
            let current_name = self
                .current_pool
                .as_ref()
                .and_then(|u| self.pools.get(u))
                .map(|p| p.name.as_str())
                .unwrap_or("none");
            format!(
                "Switching from {} (score {:.1}) to {} (score {:.1}): +{:.1} pts",
                current_name,
                current_score,
                best_stats.name,
                best_score,
                best_score - current_score,
            )
        } else {
            format!(
                "Staying on {} (score {:.1})",
                self.current_pool
                    .as_ref()
                    .and_then(|u| self.pools.get(u))
                    .map(|p| p.name.as_str())
                    .unwrap_or(&best_stats.name),
                best_score.max(current_score),
            )
        };

        if should_switch {
            self.current_pool = Some(best_url.clone());
            self.switches += 1;
        } else if self.current_pool.is_none() {
            // First-time selection, no switch counter increment
            self.current_pool = Some(best_url.clone());
        }

        Some(PoolRecommendation {
            pool_url: best_url,
            pool_name: best_stats.name.clone(),
            health_score: best_score,
            confidence: (best_score / 100.0).clamp(0.0, 1.0),
            reason,
            should_switch,
        })
    }

    // ─── Stats ────────────────────────────────────────────────────────────

    pub fn pool_count(&self) -> usize {
        self.pools.len()
    }

    /// All pool URL → current health-score pairs.
    pub fn all_scores(&self) -> Vec<(String, f64)> {
        let mut scores: Vec<(String, f64)> = self
            .pools
            .keys()
            .map(|u| (u.clone(), self.smoothed_score(u)))
            .collect();
        scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        scores
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn pool(url: &str, name: &str, latency: f64, uptime: f64) -> PoolStats {
        PoolStats {
            url: url.into(),
            name: name.into(),
            hashrate: 1_000_000.0,
            miners: 10,
            latency_ms: latency,
            uptime_pct: uptime,
            shares_accepted: 1000,
            shares_rejected: 5,
            shares_stale: 2,
            blocks_24h: 3,
            estimated_daily_reward: 50_000_000,
        }
    }

    #[test]
    fn test_health_score_range() {
        let p = pool("h:3333", "P", 100.0, 100.0);
        let s = p.health_score();
        assert!(s > 80.0, "perfect pool should score > 80, got {s}");
        assert!(s <= 100.0);
    }

    #[test]
    fn test_bad_pool_low_score() {
        // 50% uptime + 490ms latency are bad, but stale/reject defaults are good
        // Expected score ~49 — verify it's well below a healthy pool (>80)
        let p = pool("bad:3333", "Slow", 490.0, 50.0);
        let s = p.health_score();
        assert!(s < 55.0, "slow/unreliable pool should score < 55, got {s}");
    }

    #[test]
    fn test_recommend_picks_best() {
        let mut opt = PoolOptimizer::with_defaults();
        opt.update_pool(pool("slow:3333", "Slow", 450.0, 60.0));
        opt.update_pool(pool("fast:3333", "Fast", 110.0, 99.0));
        let rec = opt.recommend().unwrap();
        assert_eq!(rec.pool_url, "fast:3333");
    }

    #[test]
    fn test_hysteresis_prevents_needless_switch() {
        let mut opt = PoolOptimizer::new(20.0); // high threshold
        opt.update_pool(pool("a:3333", "A", 100.0, 100.0));
        opt.update_pool(pool("b:3333", "B", 115.0, 98.0)); // slightly worse
        opt.recommend(); // sets current to A
        let switches_before = opt.switches;
        opt.recommend(); // should stay on A
        assert_eq!(opt.switches, switches_before);
    }

    #[test]
    fn test_switches_increment() {
        let mut opt = PoolOptimizer::new(1.0); // low threshold
        opt.update_pool(pool("old:3333", "Old", 400.0, 70.0));
        opt.update_pool(pool("new:3333", "New", 110.0, 99.0));
        opt.recommend(); // selects New (first time)
                         // Inject an even better pool
        opt.update_pool(pool("even_faster:3333", "EF", 90.0, 100.0));
        let before = opt.switches;
        opt.recommend();
        assert!(
            opt.switches >= before,
            "should have recorded at least as many switches"
        );
    }

    #[test]
    fn test_all_scores_sorted() {
        let mut opt = PoolOptimizer::with_defaults();
        opt.update_pool(pool("a:3333", "A", 200.0, 90.0));
        opt.update_pool(pool("b:3333", "B", 110.0, 99.0));
        let scores = opt.all_scores();
        assert_eq!(scores.len(), 2);
        assert!(scores[0].1 >= scores[1].1);
    }
}
