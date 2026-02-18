/// ZION Emission Schedule — Decade Decay (Model A)
///
/// Total Supply:      144,000,000,000 ZION (144B)
/// Genesis Premine:    16,280,000,000 ZION (16.28B — 11.31%)
/// Mining Emission:   127,720,000,000 ZION (127.72B — 88.69%)
///
/// Block time:   60 seconds
/// Mining years: 100+ (2026–2126+)
/// Decade Decay: -20% every 5,256,000 blocks (10 years)
/// Tail emission: 725 ZION/block from decade 11+ (forever)
///
/// Decade schedule:
///   D1  2026-2036   5,400.067 ZION   100%     ~28.38B
///   D2  2036-2046   4,320.054 ZION    80%     ~22.71B
///   D3  2046-2056   3,456.043 ZION    64%     ~18.16B
///   D4  2056-2066   2,764.834 ZION    51.2%   ~14.53B
///   D5  2066-2076   2,211.867 ZION    41.0%   ~11.63B
///   D6  2076-2086   1,769.494 ZION    32.8%    ~9.30B
///   D7  2086-2096   1,415.595 ZION    26.2%    ~7.44B
///   D8  2096-2106   1,132.476 ZION    21.0%    ~5.95B
///   D9  2106-2116     905.981 ZION    16.8%    ~4.76B
///   D10 2116-2126     724.785 ZION    13.4%    ~3.81B
///   D11 2126+         724.785 ZION    tail     ∞
///
/// Block reward distribution:
///   89%  Miner
///    5%  Humanitarian tithe
///    5%  L5/L6 ZION Issobella fund
///    1%  Pool fee
///
/// Additional funding (off-chain): ZION Oasis (L4) revenue share
///
/// All values in atomic units (1 ZION = 1,000,000 atomic units).

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// 1 ZION = 1,000,000 atomic units (6 decimal places)
pub const ATOMIC_UNITS_PER_ZION: u64 = 1_000_000;

/// Total supply: 144,000,000,000 ZION
pub const TOTAL_SUPPLY: u64 = 144_000_000_000 * ATOMIC_UNITS_PER_ZION;

/// Genesis premine: 16,280,000,000 ZION
pub const GENESIS_PREMINE: u64 = 16_280_000_000 * ATOMIC_UNITS_PER_ZION;

/// Mining emission: 127,720,000,000 ZION (TOTAL_SUPPLY − GENESIS_PREMINE)
pub const MINING_EMISSION: u64 = TOTAL_SUPPLY - GENESIS_PREMINE;

/// Block time target: 60 seconds
pub const BLOCK_TIME_SECONDS: u64 = 60;

/// Blocks per year (365 days × 24h × 60min = 525,600)
pub const BLOCKS_PER_YEAR: u64 = 525_600;

/// Blocks per decade (10 × 525,600 = 5,256,000)
pub const BLOCKS_PER_DECADE: u64 = 10 * BLOCKS_PER_YEAR;

/// Decade Decay factor: multiply by 80% (= ×4/5) each decade
pub const DECAY_NUMERATOR: u64 = 4;
pub const DECAY_DENOMINATOR: u64 = 5;

/// Maximum number of decay steps before tail emission
pub const MAX_DECAY_DECADES: u64 = 10;

/// Base block reward (Decade 1): 5,400.067 ZION = 5,400,067,000 atomic units
pub const BASE_BLOCK_REWARD_ATOMIC: u64 = 5_400_067_000;

/// Tail emission reward: ~725 ZION = 724,785,000 atomic units
/// Computed: BASE × (4/5)^10 ≈ 724.785 ZION
/// This reward continues forever after decade 10.
pub const TAIL_REWARD_ATOMIC: u64 = 724_785_000;

/// Humanitarian tithe: 5% of block reward
pub const TITHE_PERCENT: u64 = 5;

/// L5/L6 ZION Issobella fund: 5% of block reward
pub const ISSOBELLA_FUND_PERCENT: u64 = 5;

/// Pool fee: 1% of block reward
pub const POOL_FEE_PERCENT: u64 = 1;

/// Miner share: 89% of block reward
pub const MINER_SHARE_PERCENT: u64 = 89;

// Legacy alias for backward compatibility
pub const BLOCK_REWARD_ATOMIC: u64 = BASE_BLOCK_REWARD_ATOMIC;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Calculate the block reward for a given height using Decade Decay.
///
/// Every 5,256,000 blocks (10 years), the reward decreases by 20%.
/// After decade 10 (block 52,560,000), a perpetual tail emission of ~725 ZION
/// continues forever.
///
/// Height 0 is the genesis block (premine only, no coinbase mining reward).
///
/// The `_difficulty` parameter is accepted for API compatibility but does not
/// affect the reward.
pub fn calculate(height: u64, _difficulty: u64) -> u64 {
    if height == 0 {
        // Genesis block — reward is handled by premine, not coinbase
        return 0;
    }

    let decade = (height - 1) / BLOCKS_PER_DECADE;

    if decade >= MAX_DECAY_DECADES {
        // Tail emission — perpetual
        return TAIL_REWARD_ATOMIC;
    }

    // Apply decay: BASE × (4/5)^decade
    let mut reward = BASE_BLOCK_REWARD_ATOMIC;
    for _ in 0..decade {
        reward = reward * DECAY_NUMERATOR / DECAY_DENOMINATOR;
    }
    reward
}

/// Calculate the miner's share of the block reward (89%).
pub fn miner_reward(height: u64, difficulty: u64) -> u64 {
    let total = calculate(height, difficulty);
    total * MINER_SHARE_PERCENT / 100
}

/// Calculate the humanitarian tithe (5%).
pub fn tithe_reward(height: u64, difficulty: u64) -> u64 {
    let total = calculate(height, difficulty);
    total * TITHE_PERCENT / 100
}

/// Calculate the L5/L6 ZION Issobella fund (5%).
pub fn issobella_fund_reward(height: u64, difficulty: u64) -> u64 {
    let total = calculate(height, difficulty);
    total * ISSOBELLA_FUND_PERCENT / 100
}

/// Calculate the pool fee (1%).
pub fn pool_fee_reward(height: u64, difficulty: u64) -> u64 {
    let total = calculate(height, difficulty);
    total * POOL_FEE_PERCENT / 100
}

/// Calculate the theoretical total mining emission over 100 years + tail.
/// Returns value in ZION (not atomic units).
pub fn max_mining_supply_100y() -> f64 {
    let mut total: u128 = 0;
    // Sum over 10 decades
    let mut reward = BASE_BLOCK_REWARD_ATOMIC as u128;
    for _ in 0..MAX_DECAY_DECADES {
        total += reward * BLOCKS_PER_DECADE as u128;
        reward = reward * DECAY_NUMERATOR as u128 / DECAY_DENOMINATOR as u128;
    }
    total as f64 / ATOMIC_UNITS_PER_ZION as f64
}

/// Returns the total supply in ZION (not atomic units).
pub fn total_supply() -> f64 {
    TOTAL_SUPPLY as f64 / ATOMIC_UNITS_PER_ZION as f64
}

/// Returns the block at which tail emission begins.
pub fn tail_emission_start_block() -> u64 {
    MAX_DECAY_DECADES * BLOCKS_PER_DECADE + 1
}

/// Returns the estimated year when tail emission begins (assuming launch 2026).
pub fn tail_emission_start_year() -> u64 {
    2026 + MAX_DECAY_DECADES * 10
}

// Legacy aliases for backward compatibility
pub fn max_mining_supply() -> f64 {
    max_mining_supply_100y()
}

pub fn emission_end_block() -> u64 {
    // Emission never truly ends (tail), but this returns the last decay block
    MAX_DECAY_DECADES * BLOCKS_PER_DECADE
}

pub fn emission_end_year() -> u64 {
    tail_emission_start_year()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_genesis_no_reward() {
        assert_eq!(calculate(0, 1000), 0);
    }

    #[test]
    fn test_block_1_reward() {
        assert_eq!(calculate(1, 1000), BASE_BLOCK_REWARD_ATOMIC);
        assert_eq!(calculate(1, 1000), 5_400_067_000);
    }

    #[test]
    fn test_decade_1_constant() {
        // All blocks in decade 1 have the same reward
        assert_eq!(calculate(1, 0), BASE_BLOCK_REWARD_ATOMIC);
        assert_eq!(calculate(1_000_000, 0), BASE_BLOCK_REWARD_ATOMIC);
        assert_eq!(calculate(BLOCKS_PER_DECADE, 0), BASE_BLOCK_REWARD_ATOMIC);
    }

    #[test]
    fn test_decade_2_decay() {
        // Decade 2 starts at block 5,256,001
        let d2_start = BLOCKS_PER_DECADE + 1;
        let expected = BASE_BLOCK_REWARD_ATOMIC * 4 / 5; // 80%
        assert_eq!(calculate(d2_start, 0), expected);
        assert_eq!(expected, 4_320_053_600); // 4,320.0536 ZION
    }

    #[test]
    fn test_decade_3_decay() {
        let d3_start = 2 * BLOCKS_PER_DECADE + 1;
        let expected = BASE_BLOCK_REWARD_ATOMIC * 4 / 5 * 4 / 5; // 64%
        assert_eq!(calculate(d3_start, 0), expected);
    }

    #[test]
    fn test_decade_10_is_last_decay() {
        let d10_start = 9 * BLOCKS_PER_DECADE + 1;
        let mut expected = BASE_BLOCK_REWARD_ATOMIC;
        for _ in 0..9 {
            expected = expected * 4 / 5;
        }
        assert_eq!(calculate(d10_start, 0), expected);
    }

    #[test]
    fn test_tail_emission() {
        // After decade 10, tail emission kicks in
        let tail_start = 10 * BLOCKS_PER_DECADE + 1;
        assert_eq!(calculate(tail_start, 0), TAIL_REWARD_ATOMIC);
        assert_eq!(calculate(tail_start + 1_000_000, 0), TAIL_REWARD_ATOMIC);
        assert_eq!(calculate(u64::MAX, 0), TAIL_REWARD_ATOMIC);
    }

    #[test]
    fn test_tail_reward_value() {
        let tail_zion = TAIL_REWARD_ATOMIC as f64 / ATOMIC_UNITS_PER_ZION as f64;
        assert!((tail_zion - 724.785).abs() < 0.001,
            "Tail reward should be ~724.785 ZION, got {}", tail_zion);
    }

    #[test]
    fn test_difficulty_ignored() {
        assert_eq!(calculate(1, 0), calculate(1, u64::MAX));
        assert_eq!(calculate(1, 1), calculate(1, 1_000_000));
    }

    #[test]
    fn test_reward_decreases_each_decade() {
        let mut prev = calculate(1, 0);
        for d in 1..MAX_DECAY_DECADES {
            let height = d * BLOCKS_PER_DECADE + 1;
            let curr = calculate(height, 0);
            assert!(curr < prev, "Decade {} reward should be less than decade {}", d + 1, d);
            prev = curr;
        }
    }

    #[test]
    fn test_100y_mining_supply() {
        let supply = max_mining_supply_100y();
        // Should be approximately 122-124B ZION
        assert!(supply > 120_000_000_000.0, "Supply too low: {}", supply);
        assert!(supply < 130_000_000_000.0, "Supply too high: {}", supply);
        println!("100-year mining supply: {:.2} ZION", supply);
    }

    #[test]
    fn test_total_supply() {
        assert_eq!(total_supply(), 144_000_000_000.0);
    }

    #[test]
    fn test_reward_distribution_sums_to_100() {
        assert_eq!(
            MINER_SHARE_PERCENT + TITHE_PERCENT + ISSOBELLA_FUND_PERCENT + POOL_FEE_PERCENT,
            100
        );
    }

    #[test]
    fn test_miner_reward() {
        let mr = miner_reward(1, 0);
        assert_eq!(mr, BASE_BLOCK_REWARD_ATOMIC * 89 / 100);
    }

    #[test]
    fn test_tithe_reward() {
        let tr = tithe_reward(1, 0);
        assert_eq!(tr, BASE_BLOCK_REWARD_ATOMIC * 5 / 100);
    }

    #[test]
    fn test_issobella_fund_reward() {
        let ifr = issobella_fund_reward(1, 0);
        assert_eq!(ifr, BASE_BLOCK_REWARD_ATOMIC * 5 / 100);
    }

    #[test]
    fn test_pool_fee() {
        let pf = pool_fee_reward(1, 0);
        assert_eq!(pf, BASE_BLOCK_REWARD_ATOMIC * 1 / 100);
    }

    #[test]
    fn test_tail_emission_start() {
        assert_eq!(tail_emission_start_block(), 52_560_001);
        assert_eq!(tail_emission_start_year(), 2126);
    }

    #[test]
    fn test_block_reward_value() {
        let reward_zion = BASE_BLOCK_REWARD_ATOMIC as f64 / ATOMIC_UNITS_PER_ZION as f64;
        assert!((reward_zion - 5400.067).abs() < 0.001);
    }

    #[test]
    fn test_constants_consistency() {
        assert_eq!(MINING_EMISSION, TOTAL_SUPPLY - GENESIS_PREMINE);
        assert_eq!(BLOCKS_PER_DECADE, 5_256_000);
        assert_eq!(BLOCKS_PER_YEAR, 525_600);
    }

    #[test]
    fn test_decade_boundary_exact() {
        // Last block of decade 1 should still have decade 1 reward
        assert_eq!(calculate(BLOCKS_PER_DECADE, 0), BASE_BLOCK_REWARD_ATOMIC);
        // First block of decade 2 should have decayed reward
        let d2_reward = BASE_BLOCK_REWARD_ATOMIC * 4 / 5;
        assert_eq!(calculate(BLOCKS_PER_DECADE + 1, 0), d2_reward);
    }

    #[test]
    fn test_never_zero_reward() {
        // After genesis, reward is never 0 (tail emission)
        for h in [1u64, 100, 1_000_000, 52_560_000, 52_560_001, 100_000_000, u64::MAX] {
            assert!(calculate(h, 0) > 0, "Reward at height {} should be > 0", h);
        }
    }
}
