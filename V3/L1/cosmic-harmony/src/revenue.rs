use std::collections::{HashMap, HashSet};
use std::sync::{Arc, RwLock};

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::revenue_journal::{JournalPayload, RevenueJournal};

// ── Constants ──────────────────────────────────────────────────────
pub const ZION_ALLOCATION: f64 = 0.50;
pub const MULTI_ALGO_ALLOCATION: f64 = 0.25;
pub const NCL_ALLOCATION: f64 = 0.25;
pub const MIN_ZION_ALLOCATION: f64 = 0.50;

pub const MERGED_MINING_FEE: f64 = 0.05;
pub const PROFIT_SWITCH_FEE: f64 = 0.02;
pub const BLAKE3_EXTERNAL_FEE: f64 = 0.02;
pub const NCL_FEE: f64 = 0.10;

/// Protocol fee split for canonical ZION blocks (percentages).
pub const ZION_MINER_PCT: u64 = 89;
pub const ZION_HUMANITARIAN_PCT: u64 = 5;
pub const ZION_ISSOBELLA_PCT: u64 = 5;
pub const ZION_POOL_PCT: u64 = 1;

/// Circuit breaker threshold: consecutive failures before opening.
pub const CIRCUIT_BREAKER_THRESHOLD: u32 = 10;
/// Seconds before a tripped circuit breaker can be retried.
pub const CIRCUIT_BREAKER_RESET_SECS: u64 = 60;

// ── RevenueSource ──────────────────────────────────────────────────
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RevenueSource {
    Zion,
    KeccakBonus,
    Sha3Bonus,
    ProfitSwitch,
    /// Revenue from Blake3-compatible external coins (DCR, ALPH).
    /// Same fee rate as ProfitSwitch (2 %) since our algo already uses Blake3
    /// internally and the hash function is shared infrastructure.
    Blake3External,
    NclAi,
}

impl RevenueSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Zion => "zion",
            Self::KeccakBonus => "keccak_bonus",
            Self::Sha3Bonus => "sha3_bonus",
            Self::ProfitSwitch => "profit_switch",
            Self::Blake3External => "blake3_external",
            Self::NclAi => "ncl_ai",
        }
    }

    pub fn fee_rate(self) -> f64 {
        match self {
            Self::Zion | Self::KeccakBonus | Self::Sha3Bonus => MERGED_MINING_FEE,
            Self::ProfitSwitch | Self::Blake3External => BLAKE3_EXTERNAL_FEE,
            Self::NclAi => NCL_FEE,
        }
    }
}

// ── RevenueEvent ───────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevenueEvent {
    pub source: RevenueSource,
    pub value_usd: f64,
    pub qualifies: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_height: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tx_hash: Option<String>,
}

impl RevenueEvent {
    pub fn new(source: RevenueSource, value_usd: f64, qualifies: bool) -> Self {
        Self {
            source,
            value_usd,
            qualifies,
            timestamp: None,
            block_height: None,
            tx_hash: None,
        }
    }

    pub fn with_height(mut self, height: u64) -> Self {
        self.block_height = Some(height);
        self
    }

    pub fn with_tx_hash(mut self, tx_hash: impl Into<String>) -> Self {
        self.tx_hash = Some(tx_hash.into());
        self
    }
}

// ── RevenueHealth ──────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevenueHealth {
    pub source: RevenueSource,
    pub last_success_ts: Option<String>,
    pub consecutive_failures: u32,
    pub total_events: u64,
    pub circuit_open: bool,
}

impl RevenueHealth {
    pub fn new(source: RevenueSource) -> Self {
        Self {
            source,
            last_success_ts: None,
            consecutive_failures: 0,
            total_events: 0,
            circuit_open: false,
        }
    }

    pub fn record_success(&mut self) {
        self.consecutive_failures = 0;
        self.last_success_ts = Some(Utc::now().to_rfc3339());
        self.total_events += 1;
        self.circuit_open = false;
    }

    /// Records a failure. Returns `true` if the circuit breaker just opened.
    pub fn record_failure(&mut self) -> bool {
        self.consecutive_failures += 1;
        if self.consecutive_failures >= CIRCUIT_BREAKER_THRESHOLD {
            if !self.circuit_open {
                self.circuit_open = true;
                return true;
            }
        }
        false
    }

    pub fn reset(&mut self) {
        self.consecutive_failures = 0;
        self.circuit_open = false;
    }
}

// ── RevenueStats ───────────────────────────────────────────────────
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RevenueStats {
    pub total_earnings_usd: f64,
    pub zion_fees_usd: f64,
    pub miner_payout_usd: f64,
    pub by_source: HashMap<String, f64>,
    // ZION-denominated tracking for canonical Deeksha mining (flowers).
    pub total_zion: u64,
    pub zion_fees_zion: u64,
    pub humanitarian_zion: u64,
    pub issobella_zion: u64,
    pub miner_payout_zion: u64,
    pub blocks_found: u64,
    // Audit fields.
    pub last_block_height: u64,
    pub last_block_ts: Option<String>,
}

// ── RevenueCollector ───────────────────────────────────────────────
#[derive(Debug, Clone)]
pub struct RevenueCollector {
    stats: Arc<RwLock<RevenueStats>>,
    pending_fees_usd: Arc<RwLock<f64>>,
    pending_fees_zion: Arc<RwLock<u64>>,
    seen_heights: Arc<RwLock<HashSet<u64>>>,
    health: Arc<RwLock<HashMap<RevenueSource, RevenueHealth>>>,
    journal: Option<Arc<RevenueJournal>>,
}

impl Default for RevenueCollector {
    fn default() -> Self {
        Self::new()
    }
}

impl RevenueCollector {
    pub fn new() -> Self {
        Self {
            stats: Arc::new(RwLock::new(RevenueStats::default())),
            pending_fees_usd: Arc::new(RwLock::new(0.0)),
            pending_fees_zion: Arc::new(RwLock::new(0)),
            seen_heights: Arc::new(RwLock::new(HashSet::new())),
            health: Arc::new(RwLock::new(HashMap::new())),
            journal: None,
        }
    }

    pub fn with_journal(journal: RevenueJournal) -> Self {
        let mut collector = Self::new();
        collector.journal = Some(Arc::new(journal));
        collector
    }

    /// Enable journaling from environment defaults.
    pub fn with_env_journal() -> Self {
        Self::with_journal(RevenueJournal::from_env_or_default())
    }

    // ── Tracking ─────────────────────────────────────────────────────

    /// Track a multi-chain revenue event (denominated in USD).
    pub fn track_event(&self, event: RevenueEvent) {
        if !event.qualifies {
            self.update_health_failure(event.source);
            return;
        }

        let fee = Self::calculate_fee(event.source, event.value_usd);
        let miner_share = event.value_usd - fee;

        let mut stats = self.stats.write().expect("revenue stats lock poisoned");
        stats.total_earnings_usd += event.value_usd;
        stats.zion_fees_usd += fee;
        stats.miner_payout_usd += miner_share;
        *stats
            .by_source
            .entry(event.source.as_str().to_string())
            .or_insert(0.0) += event.value_usd;

        let mut pending = self
            .pending_fees_usd
            .write()
            .expect("revenue pending-fees lock poisoned");
        *pending += fee;

        drop(stats);
        drop(pending);

        self.update_health_success(event.source);

        if let Some(ref journal) = self.journal {
            let _ = journal.append(JournalPayload::Event {
                source: event.source.as_str().to_string(),
                value_usd: event.value_usd,
                qualifies: event.qualifies,
                block_height: event.block_height,
            });
        }
    }

    /// Track a canonical ZION Deeksha block reward (denominated in flowers).
    /// Uses the protocol fee split: 89 % miner / 5 % humanitarian / 5 % issobella / 1 % pool.
    /// Idempotent: the same `height` is ignored if already seen.
    pub fn track_zion_block(
        &self,
        height: u64,
        subsidy: u64,
        _pool_fee_pct: u64,
        tx_hash: Option<String>,
    ) {
        {
            let mut seen = self
                .seen_heights
                .write()
                .expect("seen_heights lock poisoned");
            if !seen.insert(height) {
                // Already recorded — deduplicate.
                return;
            }
        }

        let miner_share = subsidy * ZION_MINER_PCT / 100;
        let humanitarian = subsidy * ZION_HUMANITARIAN_PCT / 100;
        let issobella = subsidy * ZION_ISSOBELLA_PCT / 100;
        let pool_fee = subsidy * ZION_POOL_PCT / 100;

        // Adjust for rounding so total equals subsidy.
        let sum = miner_share + humanitarian + issobella + pool_fee;
        let miner_share = if sum < subsidy {
            miner_share + (subsidy - sum)
        } else {
            miner_share
        };

        let now = Utc::now().to_rfc3339();

        {
            let mut stats = self.stats.write().expect("revenue stats lock poisoned");
            stats.total_zion += subsidy;
            stats.zion_fees_zion += pool_fee;
            stats.humanitarian_zion += humanitarian;
            stats.issobella_zion += issobella;
            stats.miner_payout_zion += miner_share;
            stats.blocks_found += 1;
            stats.last_block_height = height;
            stats.last_block_ts = Some(now.clone());
            *stats
                .by_source
                .entry("zion_canonical".to_string())
                .or_insert(0.0) += subsidy as f64;

            let mut pending = self
                .pending_fees_zion
                .write()
                .expect("revenue pending-fees-zion lock poisoned");
            *pending += pool_fee;
        }

        self.update_health_success(RevenueSource::Zion);

        if let Some(ref journal) = self.journal {
            let _ = journal.append(JournalPayload::ZionBlock {
                height,
                subsidy,
                pool_fee,
                humanitarian,
                issobella,
                miner: miner_share,
                tx_hash,
            });
        }
    }

    pub fn track_ncl_task(&self, value_usd: f64) {
        self.track_event(RevenueEvent {
            source: RevenueSource::NclAi,
            value_usd,
            qualifies: true,
            timestamp: Some(Utc::now().to_rfc3339()),
            block_height: None,
            tx_hash: None,
        });
    }

    /// Track a Deeksha stream-telemetry bundle.
    ///
    /// Each step in the Deeksha pipeline is mapped to a revenue stream and
    /// recorded as a fractional revenue event. The total `value_usd` is split
    /// across streams proportionally to their work-unit weights.
    ///
    /// This is used by the pool to do granular per-stream accounting when a
    /// share or block is accepted.
    pub fn track_deeksha_streams(
        &self,
        telemetry: &crate::stream_layers::DeekshaStreamTelemetry,
        total_value_usd: f64,
        block_height: Option<u64>,
    ) {
        if telemetry.total_work == 0 || total_value_usd <= 0.0 {
            return;
        }
        for (source_name, units) in &telemetry.stream_breakdown {
            let source = match source_name.as_str() {
                "zion" => RevenueSource::Zion,
                "keccak_bonus" => RevenueSource::KeccakBonus,
                "sha3_bonus" => RevenueSource::Sha3Bonus,
                "ncl_ai" => RevenueSource::NclAi,
                _ => continue,
            };
            let share = total_value_usd * (*units as f64 / telemetry.total_work as f64);
            self.track_event(RevenueEvent {
                source,
                value_usd: share,
                qualifies: true,
                timestamp: Some(Utc::now().to_rfc3339()),
                block_height,
                tx_hash: None,
            });
        }
    }

    // ── Replay (for startup recovery) ────────────────────────────────

    pub fn replay_zion_block(
        &self,
        height: u64,
        subsidy: u64,
        pool_fee: u64,
        humanitarian: u64,
        issobella: u64,
        miner: u64,
    ) {
        let mut seen = self
            .seen_heights
            .write()
            .expect("seen_heights lock poisoned");
        if !seen.insert(height) {
            return;
        }
        drop(seen);

        let mut stats = self.stats.write().expect("revenue stats lock poisoned");
        stats.total_zion += subsidy;
        stats.zion_fees_zion += pool_fee;
        stats.humanitarian_zion += humanitarian;
        stats.issobella_zion += issobella;
        stats.miner_payout_zion += miner;
        stats.blocks_found += 1;
        stats.last_block_height = height;
        *stats
            .by_source
            .entry("zion_canonical".to_string())
            .or_insert(0.0) += subsidy as f64;

        let mut pending = self
            .pending_fees_zion
            .write()
            .expect("revenue pending-fees-zion lock poisoned");
        *pending += pool_fee;
    }

    pub fn replay_event(&self, source: RevenueSource, value_usd: f64, qualifies: bool) {
        if !qualifies {
            return;
        }
        let fee = Self::calculate_fee(source, value_usd);
        let miner_share = value_usd - fee;

        let mut stats = self.stats.write().expect("revenue stats lock poisoned");
        stats.total_earnings_usd += value_usd;
        stats.zion_fees_usd += fee;
        stats.miner_payout_usd += miner_share;
        *stats
            .by_source
            .entry(source.as_str().to_string())
            .or_insert(0.0) += value_usd;

        let mut pending = self
            .pending_fees_usd
            .write()
            .expect("revenue pending-fees lock poisoned");
        *pending += fee;
    }

    // ── Health ───────────────────────────────────────────────────────

    fn update_health_success(&self, source: RevenueSource) {
        let mut health = self.health.write().expect("health lock poisoned");
        health
            .entry(source)
            .or_insert_with(|| RevenueHealth::new(source))
            .record_success();
    }

    fn update_health_failure(&self, source: RevenueSource) {
        let mut health = self.health.write().expect("health lock poisoned");
        let h = health
            .entry(source)
            .or_insert_with(|| RevenueHealth::new(source));
        let _ = h.record_failure();
    }

    pub fn health_for(&self, source: RevenueSource) -> RevenueHealth {
        let health = self.health.read().expect("health lock poisoned");
        health.get(&source).cloned().unwrap_or_else(|| RevenueHealth::new(source))
    }

    pub fn all_health(&self) -> Vec<RevenueHealth> {
        let health = self.health.read().expect("health lock poisoned");
        health.values().cloned().collect()
    }

    // ── Getters / Payouts ──────────────────────────────────────────

    pub fn get_stats(&self) -> RevenueStats {
        self.stats
            .read()
            .expect("revenue stats lock poisoned")
            .clone()
    }

    pub fn get_pending_fees(&self) -> f64 {
        *self
            .pending_fees_usd
            .read()
            .expect("revenue pending-fees lock poisoned")
    }

    pub fn get_pending_fees_zion(&self) -> u64 {
        *self
            .pending_fees_zion
            .read()
            .expect("revenue pending-fees-zion lock poisoned")
    }

    pub fn process_payout(&self) -> f64 {
        let mut pending = self
            .pending_fees_usd
            .write()
            .expect("revenue pending-fees lock poisoned");
        let amount = *pending;
        *pending = 0.0;
        if let Some(ref journal) = self.journal {
            let _ = journal.append(JournalPayload::Payout { amount_usd: amount });
        }
        amount
    }

    pub fn process_payout_zion(&self) -> u64 {
        let mut pending = self
            .pending_fees_zion
            .write()
            .expect("revenue pending-fees-zion lock poisoned");
        let amount = *pending;
        *pending = 0;
        if let Some(ref journal) = self.journal {
            let _ = journal.append(JournalPayload::PayoutZion { amount });
        }
        amount
    }

    pub fn calculate_fee(source: RevenueSource, value_usd: f64) -> f64 {
        value_usd * source.fee_rate()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merged_mining_fee_rate_is_preserved() {
        let collector = RevenueCollector::new();
        collector.track_event(RevenueEvent {
            source: RevenueSource::KeccakBonus,
            value_usd: 10.0,
            qualifies: true,
            timestamp: None,
            block_height: None,
            tx_hash: None,
        });

        let stats = collector.get_stats();
        assert_eq!(stats.total_earnings_usd, 10.0);
        assert!((stats.zion_fees_usd - 0.5).abs() < 0.001);
    }

    #[test]
    fn profit_switch_uses_lower_fee() {
        let fee = RevenueCollector::calculate_fee(RevenueSource::ProfitSwitch, 100.0);
        assert!((fee - 2.0).abs() < 0.001);
    }

    #[test]
    fn blake3_external_uses_same_fee_as_profit_switch() {
        let fee = RevenueCollector::calculate_fee(RevenueSource::Blake3External, 100.0);
        assert!((fee - 2.0).abs() < 0.001);
    }

    #[test]
    fn non_qualifying_revenue_is_ignored() {
        let collector = RevenueCollector::new();
        collector.track_event(RevenueEvent {
            source: RevenueSource::Zion,
            value_usd: 12.5,
            qualifies: false,
            timestamp: None,
            block_height: None,
            tx_hash: None,
        });

        let stats = collector.get_stats();
        assert_eq!(stats.total_earnings_usd, 0.0);
        assert_eq!(stats.zion_fees_usd, 0.0);
    }

    #[test]
    fn track_zion_block_records_subsidy_and_split() {
        let collector = RevenueCollector::new();
        let subsidy = 5_400_067_000_000_000_u64;
        collector.track_zion_block(42, subsidy, 1, None);

        let stats = collector.get_stats();
        let expected_pool_fee = subsidy * ZION_POOL_PCT / 100;
        let expected_humanitarian = subsidy * ZION_HUMANITARIAN_PCT / 100;
        let expected_issobella = subsidy * ZION_ISSOBELLA_PCT / 100;
        let expected_miner = subsidy - expected_pool_fee - expected_humanitarian - expected_issobella;

        assert_eq!(stats.total_zion, subsidy);
        assert_eq!(stats.zion_fees_zion, expected_pool_fee);
        assert_eq!(stats.humanitarian_zion, expected_humanitarian);
        assert_eq!(stats.issobella_zion, expected_issobella);
        assert_eq!(stats.miner_payout_zion, expected_miner);
        assert_eq!(stats.blocks_found, 1);
        assert_eq!(stats.last_block_height, 42);
        assert_eq!(stats.total_earnings_usd, 0.0); // USD side untouched
        assert_eq!(collector.get_pending_fees_zion(), expected_pool_fee);
    }

    #[test]
    fn track_zion_block_zero_pool_fee_gives_all_to_miner() {
        let collector = RevenueCollector::new();
        let subsidy = 1_000_000_000_000_u64;
        collector.track_zion_block(1, subsidy, 0, None);

        let stats = collector.get_stats();
        assert_eq!(stats.total_zion, subsidy);
        assert_eq!(stats.zion_fees_zion, subsidy * ZION_POOL_PCT / 100);
        assert_eq!(
            stats.miner_payout_zion,
            subsidy - stats.zion_fees_zion - stats.humanitarian_zion - stats.issobella_zion
        );
    }

    #[test]
    fn idempotence_guard_prevents_double_counting() {
        let collector = RevenueCollector::new();
        let subsidy = 1_000_000_u64;
        collector.track_zion_block(100, subsidy, 1, None);
        collector.track_zion_block(100, subsidy, 1, None); // duplicate

        let stats = collector.get_stats();
        assert_eq!(stats.blocks_found, 1);
        assert_eq!(stats.total_zion, subsidy);
    }

    #[test]
    fn health_tracks_success_and_failure() {
        let collector = RevenueCollector::new();
        let source = RevenueSource::Blake3External;

        collector.track_event(RevenueEvent::new(source, 10.0, true));
        let h = collector.health_for(source);
        assert_eq!(h.consecutive_failures, 0);
        assert_eq!(h.total_events, 1);
        assert!(!h.circuit_open);

        collector.track_event(RevenueEvent::new(source, 5.0, false));
        let h = collector.health_for(source);
        assert_eq!(h.consecutive_failures, 1);
        assert!(!h.circuit_open);
    }

    #[test]
    fn revenue_event_builder_works() {
        let e = RevenueEvent::new(RevenueSource::Zion, 1.0, true)
            .with_height(99)
            .with_tx_hash("abc123");
        assert_eq!(e.block_height, Some(99));
        assert_eq!(e.tx_hash, Some("abc123".to_string()));
    }

    #[test]
    fn track_deeksha_streams_splits_value_proportionally() {
        let collector = RevenueCollector::new();

        // Build synthetic telemetry matching a full Deeksha pipeline.
        let mut telemetry = crate::stream_layers::DeekshaStreamTelemetry::default();
        telemetry.steps.push((crate::stream_layers::DeekshaStep::Keccak256, 5));
        telemetry.steps.push((crate::stream_layers::DeekshaStep::Sha3_512, 5));
        telemetry.steps.push((crate::stream_layers::DeekshaStep::GoldenMatrix, 10));
        telemetry.steps.push((crate::stream_layers::DeekshaStep::MemoryHard, 55));
        telemetry.steps.push((crate::stream_layers::DeekshaStep::NpuMix, 15));
        telemetry.steps.push((crate::stream_layers::DeekshaStep::CosmicFusion, 10));
        telemetry.total_work = 100;
        telemetry
            .stream_breakdown
            .insert("zion".to_string(), 75);
        telemetry
            .stream_breakdown
            .insert("keccak_bonus".to_string(), 5);
        telemetry
            .stream_breakdown
            .insert("sha3_bonus".to_string(), 5);
        telemetry
            .stream_breakdown
            .insert("ncl_ai".to_string(), 15);

        collector.track_deeksha_streams(&telemetry, 100.0, Some(123));

        let stats = collector.get_stats();
        // 100 USD split: 75 ZION, 5 Keccak, 5 SHA3, 15 NCL
        // Fees: ZION 5% = 3.75, Keccak 5% = 0.25, SHA3 5% = 0.25, NCL 10% = 1.5
        // Total fees = 5.75
        assert!((stats.total_earnings_usd - 100.0).abs() < 0.001);
        assert!((stats.zion_fees_usd - 5.75).abs() < 0.1);
        assert!((stats.miner_payout_usd - 94.25).abs() < 0.1);
    }
}
