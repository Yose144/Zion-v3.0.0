//! PPLNS (Pay Per Last N Shares) payout engine.
//!
//! Tracks per-miner accepted shares in a sliding window and computes
//! proportional payout splits when a block is found.

use std::collections::{HashMap, VecDeque};
use std::time::{SystemTime, UNIX_EPOCH};

/// Single accepted share recorded in the PPLNS window.
#[derive(Debug, Clone)]
pub struct PplnsShare {
    pub miner_id: String,
    pub worker_name: String,
    pub timestamp_ms: u64,
    pub height: u64,
}

/// Per-miner payout entry produced by [`PplnsEngine::compute_payouts`].
#[derive(Debug, Clone, PartialEq)]
pub struct PayoutEntry {
    pub miner_id: String,
    pub address: String,
    /// Amount in flowers (1 ZION = 1_000_000_000_000_000 flowers).
    pub amount: u64,
    pub share_count: u64,
}

/// PPLNS engine configuration.
#[derive(Debug, Clone)]
pub struct PplnsConfig {
    /// Maximum number of shares in the sliding window.
    pub window_size: usize,
    /// Minimum payout amount in flowers. Miners below this accumulate.
    pub min_payout_flowers: u64,
}

impl Default for PplnsConfig {
    fn default() -> Self {
        Self {
            window_size: 1_000,
            min_payout_flowers: zion_core::wallet::MIN_PAYOUT_AMOUNT,
        }
    }
}

/// Miner address registry and PPLNS share window.
#[derive(Debug)]
pub struct PplnsEngine {
    config: PplnsConfig,
    /// Sliding window of recent accepted shares (newest at back).
    window: VecDeque<PplnsShare>,
    /// Registered payout addresses per miner_id.
    addresses: HashMap<String, String>,
    /// Accumulated unpaid balance per miner_id (flowers).
    unpaid: HashMap<String, u64>,
    /// Total block rewards distributed via this engine (flowers).
    total_paid_flowers: u64,
    /// Number of payout rounds executed.
    payout_rounds: u64,
}

impl PplnsEngine {
    pub fn new(config: PplnsConfig) -> Self {
        Self {
            config,
            window: VecDeque::with_capacity(1_024),
            addresses: HashMap::new(),
            unpaid: HashMap::new(),
            total_paid_flowers: 0,
            payout_rounds: 0,
        }
    }

    /// Register (or update) the payout address for a miner.
    pub fn register_address(&mut self, miner_id: &str, address: &str) {
        self.addresses
            .insert(miner_id.to_string(), address.to_string());
    }

    /// Returns the registered payout address for a miner, if any.
    pub fn address_for(&self, miner_id: &str) -> Option<&str> {
        self.addresses.get(miner_id).map(|s| s.as_str())
    }

    /// Record an accepted share into the PPLNS window.
    pub fn record_share(&mut self, miner_id: &str, worker_name: &str, height: u64) {
        let timestamp_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        self.window.push_back(PplnsShare {
            miner_id: miner_id.to_string(),
            worker_name: worker_name.to_string(),
            timestamp_ms,
            height,
        });

        // Evict oldest shares beyond the window.
        while self.window.len() > self.config.window_size {
            self.window.pop_front();
        }
    }

    /// Like [`record_share`] but with an explicit timestamp (for testing).
    pub fn record_share_at(
        &mut self,
        miner_id: &str,
        worker_name: &str,
        height: u64,
        timestamp_ms: u64,
    ) {
        self.window.push_back(PplnsShare {
            miner_id: miner_id.to_string(),
            worker_name: worker_name.to_string(),
            timestamp_ms,
            height,
        });
        while self.window.len() > self.config.window_size {
            self.window.pop_front();
        }
    }

    /// Number of shares currently in the window.
    pub fn window_len(&self) -> usize {
        self.window.len()
    }

    /// Compute proportional payouts for a block reward.
    ///
    /// Splits `block_reward_flowers` among miners proportional to their share
    /// count in the current window. Miners without a registered address have
    /// their portion held in `unpaid` balances until an address is set.
    ///
    /// Returns the list of miners whose accumulated balance meets the minimum
    /// payout threshold.
    pub fn compute_payouts(&mut self, block_reward_flowers: u64) -> Vec<PayoutEntry> {
        if self.window.is_empty() || block_reward_flowers == 0 {
            return Vec::new();
        }

        // Count shares per miner in the current window.
        let mut share_counts: HashMap<&str, u64> = HashMap::new();
        let total_shares = self.window.len() as u64;
        for share in &self.window {
            *share_counts.entry(&share.miner_id).or_insert(0) += 1;
        }

        // Distribute reward proportionally and accumulate in `unpaid`.
        let mut distributed = 0u64;
        let miners: Vec<(&str, u64)> = share_counts.iter().map(|(k, v)| (*k, *v)).collect();
        for (i, &(miner_id, count)) in miners.iter().enumerate() {
            let amount = if i == miners.len() - 1 {
                // Last miner gets the remainder to avoid rounding dust.
                block_reward_flowers.saturating_sub(distributed)
            } else {
                block_reward_flowers
                    .saturating_mul(count)
                    .saturating_div(total_shares)
            };
            distributed = distributed.saturating_add(amount);
            *self.unpaid.entry(miner_id.to_string()).or_insert(0) += amount;
        }

        // Collect payouts for miners above the minimum threshold with a registered address.
        let mut payouts = Vec::new();
        let mut paid_miners = Vec::new();
        for (miner_id, balance) in &self.unpaid {
            if *balance >= self.config.min_payout_flowers {
                if let Some(address) = self.addresses.get(miner_id) {
                    let share_count = share_counts.get(miner_id.as_str()).copied().unwrap_or(0);
                    payouts.push(PayoutEntry {
                        miner_id: miner_id.clone(),
                        address: address.clone(),
                        amount: *balance,
                        share_count,
                    });
                    paid_miners.push(miner_id.clone());
                }
            }
        }

        // Clear paid balances.
        for miner_id in &paid_miners {
            self.unpaid.remove(miner_id);
        }

        if !payouts.is_empty() {
            self.payout_rounds = self.payout_rounds.saturating_add(1);
            let round_total: u64 = payouts.iter().map(|p| p.amount).sum();
            self.total_paid_flowers = self.total_paid_flowers.saturating_add(round_total);
        }

        payouts
    }

    /// Get the unpaid balance for a miner (flowers).
    pub fn unpaid_balance(&self, miner_id: &str) -> u64 {
        self.unpaid.get(miner_id).copied().unwrap_or(0)
    }

    /// Summary statistics.
    pub fn stats(&self) -> PplnsStats {
        PplnsStats {
            window_size: self.config.window_size,
            window_used: self.window.len(),
            registered_miners: self.addresses.len(),
            miners_with_unpaid: self.unpaid.len(),
            total_unpaid_flowers: self.unpaid.values().sum(),
            total_paid_flowers: self.total_paid_flowers,
            payout_rounds: self.payout_rounds,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct PplnsStats {
    pub window_size: usize,
    pub window_used: usize,
    pub registered_miners: usize,
    pub miners_with_unpaid: usize,
    pub total_unpaid_flowers: u64,
    pub total_paid_flowers: u64,
    pub payout_rounds: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn engine(window_size: usize, min_payout: u64) -> PplnsEngine {
        PplnsEngine::new(PplnsConfig {
            window_size,
            min_payout_flowers: min_payout,
        })
    }

    #[test]
    fn empty_window_returns_no_payouts() {
        let mut e = engine(100, 1);
        let payouts = e.compute_payouts(1_000_000);
        assert!(payouts.is_empty());
    }

    #[test]
    fn zero_reward_returns_no_payouts() {
        let mut e = engine(100, 1);
        e.record_share_at("alice", "rig1", 1, 1000);
        let payouts = e.compute_payouts(0);
        assert!(payouts.is_empty());
    }

    #[test]
    fn single_miner_gets_full_reward() {
        let mut e = engine(100, 1);
        e.register_address("alice", "zion1alice");
        for i in 0..10 {
            e.record_share_at("alice", "rig1", 1, 1000 + i);
        }
        let payouts = e.compute_payouts(1_000_000);
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].miner_id, "alice");
        assert_eq!(payouts[0].amount, 1_000_000);
        assert_eq!(payouts[0].share_count, 10);
    }

    #[test]
    fn two_miners_split_proportionally() {
        let mut e = engine(100, 1);
        e.register_address("alice", "zion1alice");
        e.register_address("bob", "zion1bob");

        // Alice: 3 shares, Bob: 1 share → 75%/25%
        for i in 0..3 {
            e.record_share_at("alice", "rig1", 1, 1000 + i);
        }
        e.record_share_at("bob", "rig2", 1, 2000);

        let payouts = e.compute_payouts(1_000_000);
        assert_eq!(payouts.len(), 2);

        let alice = payouts.iter().find(|p| p.miner_id == "alice").unwrap();
        let bob = payouts.iter().find(|p| p.miner_id == "bob").unwrap();

        // Total must equal the reward exactly (no dust lost).
        assert_eq!(alice.amount + bob.amount, 1_000_000);
        assert_eq!(alice.share_count, 3);
        assert_eq!(bob.share_count, 1);
    }

    #[test]
    fn min_payout_threshold_holds_back_small_balances() {
        let mut e = engine(100, 500_000);
        e.register_address("alice", "zion1alice");
        e.register_address("bob", "zion1bob");

        // Alice: 3 shares, Bob: 1 share → reward 1M → alice 750k, bob 250k
        for i in 0..3 {
            e.record_share_at("alice", "rig1", 1, 1000 + i);
        }
        e.record_share_at("bob", "rig2", 1, 2000);

        let payouts = e.compute_payouts(1_000_000);
        // Only Alice (750k >= 500k threshold). Bob (250k) held back.
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].miner_id, "alice");
        assert_eq!(e.unpaid_balance("bob"), 250_000);
    }

    #[test]
    fn unpaid_accumulates_across_rounds() {
        let mut e = engine(100, 500_000);
        e.register_address("bob", "zion1bob");

        // Round 1: Bob gets 250k (below threshold)
        e.record_share_at("bob", "rig1", 1, 1000);
        let p1 = e.compute_payouts(250_000);
        assert!(p1.is_empty());
        assert_eq!(e.unpaid_balance("bob"), 250_000);

        // Round 2: Bob gets another 300k → total 550k (above threshold)
        e.record_share_at("bob", "rig1", 2, 2000);
        let p2 = e.compute_payouts(300_000);
        assert_eq!(p2.len(), 1);
        assert_eq!(p2[0].amount, 550_000);
        assert_eq!(e.unpaid_balance("bob"), 0);
    }

    #[test]
    fn unregistered_miner_balance_held() {
        let mut e = engine(100, 1);
        // No address registered for alice.
        e.record_share_at("alice", "rig1", 1, 1000);
        let payouts = e.compute_payouts(1_000_000);
        assert!(payouts.is_empty());
        assert_eq!(e.unpaid_balance("alice"), 1_000_000);

        // Now register and trigger another round (even with 0 new reward).
        e.register_address("alice", "zion1alice");
        e.record_share_at("alice", "rig1", 2, 2000);
        let payouts = e.compute_payouts(0);
        // 0 reward this round, but previous unpaid is still there.
        // Only the new round's allocation is 0, unpaid stays.
        assert!(payouts.is_empty() || payouts[0].amount == 1_000_000);
        // Verify balance is still 1M (nothing new from 0-reward round).
        assert_eq!(e.unpaid_balance("alice"), 1_000_000);
    }

    #[test]
    fn window_evicts_oldest_shares() {
        let mut e = engine(5, 1);
        e.register_address("alice", "zion1alice");
        e.register_address("bob", "zion1bob");

        // Fill window with Alice (5 shares).
        for i in 0..5 {
            e.record_share_at("alice", "rig1", 1, 1000 + i);
        }
        assert_eq!(e.window_len(), 5);

        // Add 5 Bob shares — Alice shares should be evicted.
        for i in 0..5 {
            e.record_share_at("bob", "rig2", 2, 2000 + i);
        }
        assert_eq!(e.window_len(), 5);

        // Now Bob has 100% of the window.
        let payouts = e.compute_payouts(1_000_000);
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].miner_id, "bob");
        assert_eq!(payouts[0].amount, 1_000_000);
    }

    #[test]
    fn stats_reflect_state() {
        let mut e = engine(100, 500);
        e.register_address("alice", "zion1alice");
        e.record_share_at("alice", "rig1", 1, 1000);
        e.record_share_at("alice", "rig1", 2, 2000);

        let s = e.stats();
        assert_eq!(s.window_size, 100);
        assert_eq!(s.window_used, 2);
        assert_eq!(s.registered_miners, 1);
        assert_eq!(s.payout_rounds, 0);

        e.compute_payouts(1_000_000);
        let s2 = e.stats();
        assert_eq!(s2.payout_rounds, 1);
        assert_eq!(s2.total_paid_flowers, 1_000_000);
    }

    #[test]
    fn no_dust_lost_with_many_miners() {
        let mut e = engine(1000, 1);
        for i in 0..7 {
            let id = format!("miner{i}");
            e.register_address(&id, &format!("zion1addr{i}"));
            e.record_share_at(&id, "rig", 1, 1000 + i as u64);
        }

        let reward = 1_000_003u64; // indivisible by 7
        let payouts = e.compute_payouts(reward);
        let total: u64 = payouts.iter().map(|p| p.amount).sum();
        assert_eq!(total, reward, "no flowers lost to rounding");
    }

    #[test]
    fn payout_clears_balance_then_accumulates_fresh() {
        let mut e = engine(100, 1);
        e.register_address("alice", "zion1alice");

        e.record_share_at("alice", "rig1", 1, 1000);
        e.compute_payouts(500);
        assert_eq!(e.unpaid_balance("alice"), 0);

        e.record_share_at("alice", "rig1", 2, 2000);
        e.compute_payouts(300);
        assert_eq!(e.unpaid_balance("alice"), 0);
        assert_eq!(e.stats().total_paid_flowers, 800);
    }

    #[test]
    fn register_address_updates_existing() {
        let mut e = engine(100, 1);
        e.register_address("alice", "zion1old");
        assert_eq!(e.address_for("alice"), Some("zion1old"));
        e.register_address("alice", "zion1new");
        assert_eq!(e.address_for("alice"), Some("zion1new"));
    }

    #[test]
    fn default_config_uses_core_constants() {
        let cfg = PplnsConfig::default();
        assert_eq!(cfg.window_size, 1_000);
        assert_eq!(cfg.min_payout_flowers, zion_core::wallet::MIN_PAYOUT_AMOUNT);
    }
}
