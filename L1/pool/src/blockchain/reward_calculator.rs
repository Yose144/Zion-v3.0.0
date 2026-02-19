/// Reward Calculator — Decade Decay (Model A) with L5/L6 Issobella fund
///
/// Block reward: Decade Decay -20% / 10 years, tail 725 ZION
/// Distribution: 89% miner, 5% humanitarian, 5% L5/L6 Issobella, 1% pool fee
/// Additional funding: ZION Oasis (L4) revenue share (off-chain)
use anyhow::Result;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::{Deserialize, Serialize};

/// Base block reward (Decade 1): 5,400.067 ZION
pub const BASE_BLOCK_REWARD: Decimal = dec!(5400.067);

/// Decay factor per decade: ×0.8
pub const DECAY_FACTOR: Decimal = dec!(0.8);

/// Blocks per decade: 5,256,000
pub const BLOCKS_PER_DECADE: u64 = 5_256_000;

/// Maximum decay decades before tail emission
pub const MAX_DECAY_DECADES: u64 = 10;

/// Tail emission: ~724.785 ZION
pub const TAIL_REWARD: Decimal = dec!(724.785);

/// Default pool fee: 1%
pub const DEFAULT_POOL_FEE_PERCENT: Decimal = dec!(1.0);

/// Default humanitarian tithe: 5%
pub const DEFAULT_TITHE_PERCENT: Decimal = dec!(5.0);

/// Default L5/L6 ZION Issobella fund: 5%
pub const DEFAULT_ISSOBELLA_FUND_PERCENT: Decimal = dec!(5.0);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardBreakdown {
    pub total_reward: String,
    pub miner_share: String,
    pub humanitarian_tithe: String,
    pub issobella_fund: String,
    pub pool_fee: String,
}

pub struct RewardCalculator {
    pool_fee_percent: Decimal,
    tithe_percent: Decimal,
    issobella_fund_percent: Decimal,
}

impl RewardCalculator {
    /// Create new RewardCalculator
    pub fn new(pool_fee_percent: Option<f64>, tithe_percent: Option<f64>) -> Self {
        let pool_fee = pool_fee_percent
            .map(|p| Decimal::from_f64_retain(p).unwrap_or(DEFAULT_POOL_FEE_PERCENT))
            .unwrap_or(DEFAULT_POOL_FEE_PERCENT);

        let tithe = tithe_percent
            .map(|p| Decimal::from_f64_retain(p).unwrap_or(DEFAULT_TITHE_PERCENT))
            .unwrap_or(DEFAULT_TITHE_PERCENT);

        tracing::info!(
            "RewardCalculator: pool_fee={}%, tithe={}%, issobella_fund={}%",
            pool_fee,
            tithe,
            DEFAULT_ISSOBELLA_FUND_PERCENT,
        );

        Self {
            pool_fee_percent: pool_fee,
            tithe_percent: tithe,
            issobella_fund_percent: DEFAULT_ISSOBELLA_FUND_PERCENT,
        }
    }

    /// Calculate block reward at given height using Decade Decay
    pub fn calculate_block_reward_at_height(&self, height: u64) -> Decimal {
        if height == 0 {
            return Decimal::ZERO;
        }
        let decade = (height - 1) / BLOCKS_PER_DECADE;
        if decade >= MAX_DECAY_DECADES {
            return TAIL_REWARD;
        }
        let mut reward = BASE_BLOCK_REWARD;
        for _ in 0..decade {
            reward *= DECAY_FACTOR;
        }
        reward
    }

    /// Calculate total block reward (for backward compatibility, returns Decade 1)
    pub fn calculate_block_reward(&self) -> Decimal {
        BASE_BLOCK_REWARD
    }

    /// Calculate complete reward breakdown at a given height
    pub fn calculate_reward_breakdown_at_height(&self, height: u64) -> RewardBreakdown {
        let total_reward = self.calculate_block_reward_at_height(height);
        let humanitarian_tithe = total_reward * (self.tithe_percent / dec!(100));
        let issobella_fund = total_reward * (self.issobella_fund_percent / dec!(100));
        let pool_fee = total_reward * (self.pool_fee_percent / dec!(100));
        let miner_share = total_reward - humanitarian_tithe - issobella_fund - pool_fee;

        RewardBreakdown {
            total_reward: total_reward.to_string(),
            miner_share: miner_share.to_string(),
            humanitarian_tithe: humanitarian_tithe.to_string(),
            issobella_fund: issobella_fund.to_string(),
            pool_fee: pool_fee.to_string(),
        }
    }

    /// Calculate complete reward breakdown (Decade 1 / backward compat)
    pub fn calculate_reward_breakdown(&self) -> RewardBreakdown {
        self.calculate_reward_breakdown_at_height(1)
    }

    /// Calculate PPLNS payout for a miner
    pub fn calculate_pplns_payout(&self, miner_shares: u64, total_shares: u64) -> Result<Decimal> {
        if total_shares == 0 {
            return Ok(Decimal::ZERO);
        }

        let breakdown = self.calculate_reward_breakdown();
        let miner_share: Decimal = breakdown.miner_share.parse()?;

        let share_ratio = Decimal::from(miner_shares) / Decimal::from(total_shares);
        let payout = miner_share * share_ratio;

        Ok(payout)
    }

    /// Get pool fee percentage
    pub fn pool_fee_percent(&self) -> Decimal {
        self.pool_fee_percent
    }

    /// Get tithe percentage
    pub fn tithe_percent(&self) -> Decimal {
        self.tithe_percent
    }
}

impl Default for RewardCalculator {
    fn default() -> Self {
        Self::new(None, None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_block_reward() {
        let calc = RewardCalculator::default();
        assert_eq!(calc.calculate_block_reward(), dec!(5400.067));
    }

    #[test]
    fn test_decade_decay() {
        let calc = RewardCalculator::default();
        // Decade 1
        assert_eq!(calc.calculate_block_reward_at_height(1), dec!(5400.067));
        // Decade 2 = 80%
        let d2 = calc.calculate_block_reward_at_height(BLOCKS_PER_DECADE + 1);
        assert_eq!(d2, dec!(5400.067) * dec!(0.8));
        // Tail
        let tail = calc.calculate_block_reward_at_height(MAX_DECAY_DECADES * BLOCKS_PER_DECADE + 1);
        assert_eq!(tail, TAIL_REWARD);
    }

    #[test]
    fn test_reward_breakdown() {
        let calc = RewardCalculator::default();
        let breakdown = calc.calculate_reward_breakdown();

        let total: Decimal = breakdown.total_reward.parse().unwrap();
        let miner: Decimal = breakdown.miner_share.parse().unwrap();
        let tithe: Decimal = breakdown.humanitarian_tithe.parse().unwrap();
        let issobella: Decimal = breakdown.issobella_fund.parse().unwrap();
        let fee: Decimal = breakdown.pool_fee.parse().unwrap();

        // Must add up
        assert_eq!(total, miner + tithe + issobella + fee);
        assert_eq!(total, dec!(5400.067));

        // Verify percentages
        let tithe_pct = (tithe / total) * dec!(100);
        let issobella_pct = (issobella / total) * dec!(100);
        let fee_pct = (fee / total) * dec!(100);
        assert!((tithe_pct - dec!(5)).abs() < dec!(0.1));
        assert!((issobella_pct - dec!(5)).abs() < dec!(0.1));
        assert!((fee_pct - dec!(1)).abs() < dec!(0.1));
    }

    #[test]
    fn test_pplns_payout() {
        let calc = RewardCalculator::default();
        let payout = calc.calculate_pplns_payout(100, 1000).unwrap();

        let breakdown = calc.calculate_reward_breakdown();
        let miner_share: Decimal = breakdown.miner_share.parse().unwrap();
        let expected = miner_share * dec!(0.1);

        assert_eq!(payout, expected);
    }

    #[test]
    fn test_zero_shares() {
        let calc = RewardCalculator::default();
        let payout = calc.calculate_pplns_payout(0, 1000).unwrap();
        assert_eq!(payout, Decimal::ZERO);
    }

    #[test]
    fn test_zero_total_shares() {
        let calc = RewardCalculator::default();
        let payout = calc.calculate_pplns_payout(100, 0).unwrap();
        assert_eq!(payout, Decimal::ZERO);
    }
}
