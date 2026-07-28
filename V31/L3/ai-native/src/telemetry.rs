//! # Pool Telemetry Feed — L3-G
//!
//! Bridges live L1 pool data into the [`PoolOptimizer`] without pulling in
//! an HTTP client library.  The caller (binary / integration layer) is
//! responsible for fetching the raw JSON; this module owns the *conversion
//! and ingestion* logic.
//!
//! ## Data flow
//! ```text
//!   L1 Pool API (/stats)
//!        │  reqwest / hyper (outside this crate)
//!        ▼
//!   PoolRawStats ──ingest()──► TelemetryFeed ──► PoolOptimizer
//!                                                      │
//!                                               recommendation
//! ```
//!
//! ## Node configuration (mainnet)
//! | Node     | Base URL                  |
//! |----------|---------------------------|
//! | Helsinki | `http://77.42.31.72:8080` |
//!
//! The pool `/stats` endpoint returns:
//! ```json
//! {
//!   "ok": true,
//!   "hashrate": { "pool": 1.5e9, "pool_24h": 1.4e9 },
//!   "miners": { "active": 12, "total": 40 },
//!   "blocks": { "found": 7200 },
//!   "shares": { "valid": 982340, "invalid": 102, "stale": 85 },
//!   "uptime": 9871234
//! }
//! ```

use crate::pool_optimizer::{PoolOptimizer, PoolRecommendation, PoolStats};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ─── Raw API shape ────────────────────────────────────────────────────────────

/// Raw deserialized payload from `GET /stats`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PoolRawStats {
    /// Identifier for this pool / node (set by caller, e.g. "helsinki").
    #[serde(default)]
    pub node_id: String,
    /// Display name (e.g. "Helsinki (EU-North)").
    #[serde(default)]
    pub node_name: String,
    /// Base URL of this node (e.g. `http://77.42.31.72:8080`).
    #[serde(default)]
    pub node_url: String,
    /// API response health.
    #[serde(default)]
    pub ok: bool,
    /// Hashrate sub-object.
    #[serde(default)]
    pub hashrate: RawHashrate,
    /// Miner counts.
    #[serde(default)]
    pub miners: RawMiners,
    /// Block counts.
    #[serde(default)]
    pub blocks: RawBlocks,
    /// Share counts.
    #[serde(default)]
    pub shares: RawShares,
    /// Process uptime in seconds (since pool process start).
    #[serde(default)]
    pub uptime: u64,
    /// Round-trip latency to this node (millis), filled in by caller.
    #[serde(default)]
    pub latency_ms: f64,
    /// Timestamp when this snapshot was acquired.
    #[serde(default = "Utc::now")]
    pub fetched_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RawHashrate {
    pub pool: f64,
    #[serde(alias = "pool_24h")]
    pub pool_24h: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RawMiners {
    pub active: u32,
    pub total: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RawBlocks {
    pub found: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RawShares {
    pub valid: u64,
    pub invalid: u64,
    pub stale: u64,
}

// ─── Conversion ───────────────────────────────────────────────────────────────

impl PoolRawStats {
    /// Convert to `PoolStats` consumable by `PoolOptimizer`.
    ///
    /// `uptime_seconds` → uptime percentage (capped 7-day window, 604 800 s).
    pub fn to_pool_stats(&self) -> PoolStats {
        // Derive uptime % (cap at 7 days = 604 800 s)
        let seven_days = 604_800.0_f64;
        let uptime_pct = (self.uptime as f64).min(seven_days) / seven_days * 100.0;

        PoolStats {
            url: self.node_url.clone(),
            name: self.node_name.clone(),
            hashrate: self.hashrate.pool,
            miners: self.miners.active,
            latency_ms: self.latency_ms,
            uptime_pct,
            shares_accepted: self.shares.valid,
            shares_rejected: self.shares.invalid,
            shares_stale: self.shares.stale,
            blocks_24h: 0, // not available in this endpoint
            estimated_daily_reward: 0,
        }
    }

    /// Build a synthetic `PoolRawStats` for testing / simulation.
    pub fn mock(
        node_id: impl Into<String>,
        hashrate: f64,
        active_miners: u32,
        latency_ms: f64,
        uptime_hours: u64,
    ) -> Self {
        Self {
            node_id: node_id.into(),
            node_name: "MockNode".into(),
            node_url: "http://mock:8080".into(),
            ok: true,
            hashrate: RawHashrate {
                pool: hashrate,
                pool_24h: hashrate * 0.95,
            },
            miners: RawMiners {
                active: active_miners,
                total: active_miners + 5,
            },
            blocks: RawBlocks { found: 100 },
            shares: RawShares {
                valid: 100_000,
                invalid: 50,
                stale: 30,
            },
            uptime: uptime_hours * 3600,
            latency_ms,
            fetched_at: Utc::now(),
        }
    }
}

// ─── TelemetryFeed ────────────────────────────────────────────────────────────

/// Connects live pool telemetry to `PoolOptimizer`.
///
/// Call [`TelemetryFeed::ingest`] whenever a new `PoolRawStats` snapshot
/// arrives (e.g. from an HTTP polling task) to update scores and get the
/// latest recommendation.
pub struct TelemetryFeed {
    optimizer: PoolOptimizer,
    /// History of raw snapshots (most recent last), capped at `max_history`.
    history: Vec<PoolRawStats>,
    max_history: usize,
    /// Total snapshots ingested since creation.
    ingested: u64,
    errors: u32,
}

impl TelemetryFeed {
    pub fn new() -> Self {
        Self::with_threshold(5.0)
    }

    pub fn with_threshold(switch_threshold: f64) -> Self {
        Self {
            optimizer: PoolOptimizer::new(switch_threshold),
            history: Vec::new(),
            max_history: 200,
            ingested: 0,
            errors: 0,
        }
    }

    /// Ingest one snapshot. Returns the current recommendation.
    pub fn ingest(&mut self, raw: PoolRawStats) -> Option<PoolRecommendation> {
        if !raw.ok {
            self.errors += 1;
            return self.optimizer.recommend();
        }
        let stats = raw.to_pool_stats();
        self.optimizer.update_pool(stats);

        // Keep rolling history
        self.history.push(raw);
        if self.history.len() > self.max_history {
            self.history.remove(0);
        }
        self.ingested += 1;
        self.optimizer.recommend()
    }

    /// Ingest multiple snapshots at once (e.g. for batch polling).
    pub fn ingest_many(&mut self, snapshots: Vec<PoolRawStats>) -> Option<PoolRecommendation> {
        for snap in snapshots {
            self.ingest(snap);
        }
        self.optimizer.recommend()
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    pub fn recommend(&mut self) -> Option<PoolRecommendation> {
        self.optimizer.recommend()
    }

    pub fn all_scores(&self) -> Vec<(String, f64)> {
        self.optimizer.all_scores()
    }

    pub fn ingested_count(&self) -> u64 {
        self.ingested
    }

    pub fn error_count(&self) -> u32 {
        self.errors
    }

    /// Last raw snapshot for a given node, if any.
    pub fn last_snapshot(&self, node_url: &str) -> Option<&PoolRawStats> {
        self.history.iter().rev().find(|s| s.node_url == node_url)
    }

    pub fn stats(&mut self) -> TelemetryStats {
        TelemetryStats {
            ingested: self.ingested,
            errors: self.errors,
            history_len: self.history.len(),
            known_pools: self.optimizer.all_scores().len(),
            recommendation: self.optimizer.recommend(),
        }
    }
}

impl Default for TelemetryFeed {
    fn default() -> Self {
        Self::new()
    }
}

/// Snapshot of the feed's state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryStats {
    pub ingested: u64,
    pub errors: u32,
    pub history_len: usize,
    pub known_pools: usize,
    pub recommendation: Option<PoolRecommendation>,
}

// ─── Node config helpers ─────────────────────────────────────────────────────

/// Runtime node descriptor — mirrors the config in `APP&WEB/website-v2.9`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub pool_api_port: u16,
    pub enabled: bool,
}

impl NodeConfig {
    pub fn base_url(&self) -> String {
        format!("http://{}:{}", self.host, self.pool_api_port)
    }

    /// Known mainnet nodes.
    pub fn mainnet() -> Vec<NodeConfig> {
        vec![NodeConfig {
            id: "helsinki".into(),
            name: "Helsinki (EU-North)".into(),
            host: "77.42.31.72".into(),
            pool_api_port: 8080,
            enabled: true,
        }]
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn helsinki_snap(latency: f64, uptime_h: u64, valid: u64, invalid: u64) -> PoolRawStats {
        PoolRawStats {
            node_id: "helsinki".into(),
            node_name: "Helsinki (EU-North)".into(),
            node_url: "http://77.42.31.72:8080".into(),
            ok: true,
            hashrate: RawHashrate {
                pool: 1_500_000_000.0,
                pool_24h: 1_400_000_000.0,
            },
            miners: RawMiners {
                active: 12,
                total: 40,
            },
            blocks: RawBlocks { found: 7200 },
            shares: RawShares {
                valid,
                invalid,
                stale: 10,
            },
            uptime: uptime_h * 3600,
            latency_ms: latency,
            fetched_at: Utc::now(),
        }
    }

    #[test]
    fn test_to_pool_stats_uptime_scaling() {
        // 7 days uptime → 100%
        let snap = helsinki_snap(50.0, 168, 100_000, 50);
        let ps = snap.to_pool_stats();
        assert!((ps.uptime_pct - 100.0).abs() < 0.01);

        // 3.5 days → 50%
        let snap2 = helsinki_snap(50.0, 84, 100_000, 50);
        let ps2 = snap2.to_pool_stats();
        assert!((ps2.uptime_pct - 50.0).abs() < 0.01);
    }

    #[test]
    fn test_ingest_updates_optimizer() {
        let mut feed = TelemetryFeed::new();
        feed.ingest(helsinki_snap(50.0, 168, 100_000, 10));
        let stats = feed.stats();
        assert_eq!(stats.ingested, 1);
        assert_eq!(stats.known_pools, 1);
    }

    #[test]
    fn test_ingest_error_snapshot_not_counted() {
        let mut feed = TelemetryFeed::new();
        let mut bad = helsinki_snap(50.0, 168, 0, 0);
        bad.ok = false;
        feed.ingest(bad);
        assert_eq!(feed.ingested_count(), 0);
        assert_eq!(feed.error_count(), 1);
    }

    #[test]
    fn test_ingest_many() {
        let mut feed = TelemetryFeed::new();
        let snaps = vec![
            helsinki_snap(50.0, 168, 100_000, 10),
            helsinki_snap(60.0, 168, 101_000, 11),
        ];
        feed.ingest_many(snaps);
        assert_eq!(feed.ingested_count(), 2);
    }

    #[test]
    fn test_mock_constructor() {
        let m = PoolRawStats::mock("test", 1e9, 5, 100.0, 24);
        assert!(m.ok);
        assert_eq!(m.miners.active, 5);
        let ps = m.to_pool_stats();
        assert!(ps.uptime_pct > 0.0);
        assert!(ps.health_score() > 0.0);
    }

    #[test]
    fn test_last_snapshot() {
        let mut feed = TelemetryFeed::new();
        feed.ingest(helsinki_snap(40.0, 168, 100_000, 10));
        let last = feed.last_snapshot("http://77.42.31.72:8080");
        assert!(last.is_some());
        assert!((last.unwrap().latency_ms - 40.0).abs() < 0.01);
    }

    #[test]
    fn test_node_config_base_url() {
        let nodes = NodeConfig::mainnet();
        assert_eq!(nodes[0].base_url(), "http://77.42.31.72:8080");
    }

    #[test]
    fn test_multiple_nodes_scored() {
        let mut feed = TelemetryFeed::new();
        // Helsinki — good (override mock URL to the real address)
        let mut hel = PoolRawStats::mock("helsinki", 1.5e9, 12, 50.0, 168);
        hel.node_url = "http://77.42.31.72:8080".into();
        feed.ingest(hel);
        // Hypothetical backup — slightly worse
        let mut backup = PoolRawStats::mock("backup", 0.5e9, 3, 200.0, 48);
        backup.node_url = "http://backup:8080".into();
        feed.ingest(backup);

        let scores = feed.all_scores();
        assert_eq!(scores.len(), 2);
        // Helsinki should score better (lower latency, higher uptime)
        let hel = scores.iter().find(|(k, _)| k.contains("77.42")).unwrap().1;
        let bak = scores.iter().find(|(k, _)| k.contains("backup")).unwrap().1;
        assert!(hel > bak, "Helsinki should score higher than backup");
    }
}
