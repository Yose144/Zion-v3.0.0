use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use serde::{Deserialize, Serialize};

pub const ZION_ALLOCATION: f64 = 0.50;
pub const MULTI_ALGO_ALLOCATION: f64 = 0.25;
pub const NCL_ALLOCATION: f64 = 0.25;
pub const MIN_ZION_ALLOCATION: f64 = 0.50;

pub const MERGED_MINING_FEE: f64 = 0.05;
pub const PROFIT_SWITCH_FEE: f64 = 0.02;
pub const NCL_FEE: f64 = 0.10;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RevenueSource {
    Zion,
    KeccakBonus,
    Sha3Bonus,
    ProfitSwitch,
    NclAi,
}

impl RevenueSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Zion => "zion",
            Self::KeccakBonus => "keccak_bonus",
            Self::Sha3Bonus => "sha3_bonus",
            Self::ProfitSwitch => "profit_switch",
            Self::NclAi => "ncl_ai",
        }
    }

    pub fn fee_rate(self) -> f64 {
        match self {
            Self::Zion | Self::KeccakBonus | Self::Sha3Bonus => MERGED_MINING_FEE,
            Self::ProfitSwitch => PROFIT_SWITCH_FEE,
            Self::NclAi => NCL_FEE,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevenueEvent {
    pub source: RevenueSource,
    pub value_usd: f64,
    pub qualifies: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RevenueStats {
    pub total_earnings_usd: f64,
    pub zion_fees_usd: f64,
    pub miner_payout_usd: f64,
    pub by_source: HashMap<String, f64>,
}

#[derive(Debug, Clone)]
pub struct RevenueCollector {
    stats: Arc<RwLock<RevenueStats>>,
    pending_fees_usd: Arc<RwLock<f64>>,
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
        }
    }

    pub fn track_event(&self, event: RevenueEvent) {
        if !event.qualifies {
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
    }

    pub fn track_ncl_task(&self, value_usd: f64) {
        self.track_event(RevenueEvent {
            source: RevenueSource::NclAi,
            value_usd,
            qualifies: true,
        });
    }

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

    pub fn process_payout(&self) -> f64 {
        let mut pending = self
            .pending_fees_usd
            .write()
            .expect("revenue pending-fees lock poisoned");
        let amount = *pending;
        *pending = 0.0;
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
    fn non_qualifying_revenue_is_ignored() {
        let collector = RevenueCollector::new();
        collector.track_event(RevenueEvent {
            source: RevenueSource::Zion,
            value_usd: 12.5,
            qualifies: false,
        });

        let stats = collector.get_stats();
        assert_eq!(stats.total_earnings_usd, 0.0);
        assert_eq!(stats.zion_fees_usd, 0.0);
    }
}
