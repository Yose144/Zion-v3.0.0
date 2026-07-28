//! ZION emission schedule — Decade Decay.
//!
//! All values are in flowers (1 ZION = 1_000_000 flowers).
//! Height 0 is the genesis block (premine only, no mining reward).
//! Reward decays by ×(4/5) every 5,256,000 blocks.
//! After decade 10 a perpetual tail emission continues.

/// 1 ZION = 1_000_000 flowers (6 decimal places).
pub const FLOWERS_PER_ZION: u64 = 1_000_000;

/// Total supply: 144,000,000,000 ZION in flowers.
pub const TOTAL_SUPPLY: u128 = 144_000_000_000_u128 * FLOWERS_PER_ZION as u128;

/// Genesis premine: 16,780,000,000 ZION in flowers.
pub const GENESIS_PREMINE: u128 = 16_780_000_000_u128 * FLOWERS_PER_ZION as u128;

/// Mining emission: total supply minus premine.
pub const MINING_EMISSION: u128 = TOTAL_SUPPLY - GENESIS_PREMINE;

/// Block time target in seconds.
pub const BLOCK_TIME_SECONDS: u64 = 60;

/// Blocks per year: 365 × 24 × 60 = 525,600.
pub const BLOCKS_PER_YEAR: u64 = 525_600;

/// Blocks per decade: 10 × 525,600 = 5,256,000.
pub const BLOCKS_PER_DECADE: u64 = 10 * BLOCKS_PER_YEAR;

/// Decay numerator (reward × 4/5 each decade).
pub const DECAY_NUMERATOR: u64 = 4;

/// Decay denominator.
pub const DECAY_DENOMINATOR: u64 = 5;

/// Number of decades with active decay before tail emission.
pub const MAX_DECAY_DECADES: u64 = 10;

/// Base block reward (Decade 1): 5,400.067 ZION = 5,400,067,000 flowers.
pub const BASE_REWARD: u64 = 5_400_067_000;

/// Tail emission reward: `BASE_REWARD × (4/5)^9` ≈ 724.785 ZION.
pub const TAIL_REWARD: u64 = 724_784_723;

/// Coinbase maturity: outputs unspendable for this many blocks.
pub const COINBASE_MATURITY: u64 = 100;

/// Miner share: 89% of block subsidy.
pub const MINER_PCT: u64 = 89;

/// Humanitarian tithe: 5% of block subsidy.
pub const HUMANITARIAN_PCT: u64 = 5;

/// Issobella fund: 5% of block subsidy.
pub const ISSOBELLA_PCT: u64 = 5;

/// Pool fee / burn: 1% of block subsidy. Never minted.
pub const POOL_FEE_PCT: u64 = 1;

/// Compute the fee split for a given block subsidy.
/// Returns `(miner, humanitarian, issobella, pool_fee)` in flowers.
///
/// `pool_fee` is the burned amount. The miner portion absorbs rounding dust so
/// the four parts always sum to `subsidy`.
pub fn fee_split(subsidy: u64) -> (u64, u64, u64, u64) {
    let humanitarian = subsidy * HUMANITARIAN_PCT / 100;
    let issobella = subsidy * ISSOBELLA_PCT / 100;
    let pool_fee = subsidy * POOL_FEE_PCT / 100;
    let miner = subsidy - humanitarian - issobella - pool_fee;
    (miner, humanitarian, issobella, pool_fee)
}

/// Amount burned per block: the 1% pool-fee slot that is never minted.
pub fn burned_subsidy(subsidy: u64) -> u64 {
    fee_split(subsidy).3
}

/// Total newly-minted coinbase amount per block (99% of subsidy).
pub fn minted_subsidy(subsidy: u64) -> u64 {
    subsidy - burned_subsidy(subsidy)
}

/// Block subsidy for a given height in flowers.
///
/// Height 0 is genesis (premine only — returns 0).
/// Heights 1..=5,256,000 earn the base reward (Decade 1).
/// Each subsequent decade decays by ×(4/5).
/// After decade 10 the tail reward continues forever.
pub fn block_subsidy(height: u64) -> u64 {
    if height == 0 {
        return 0;
    }

    let decade = (height - 1) / BLOCKS_PER_DECADE;
    if decade >= MAX_DECAY_DECADES {
        return TAIL_REWARD;
    }

    let mut reward = BASE_REWARD;
    for _ in 0..decade {
        reward = reward * DECAY_NUMERATOR / DECAY_DENOMINATOR;
    }
    reward
}

/// Convert flowers to whole ZION (truncating).
pub fn flowers_to_zion(flowers: u64) -> u64 {
    flowers / FLOWERS_PER_ZION
}

/// Convert whole ZION to flowers.
pub fn zion_to_flowers(zion: u64) -> u64 {
    zion.saturating_mul(FLOWERS_PER_ZION)
}

/// Display a flower amount as a human-readable ZION string (e.g. "5400.067000").
pub fn format_zion(flowers: u64) -> String {
    let whole = flowers / FLOWERS_PER_ZION;
    let frac = flowers % FLOWERS_PER_ZION;
    format!("{whole}.{frac:06}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn genesis_no_reward() {
        assert_eq!(block_subsidy(0), 0);
    }

    #[test]
    fn block_1_base_reward() {
        assert_eq!(block_subsidy(1), BASE_REWARD);
        assert_eq!(block_subsidy(1), 5_400_067_000);
    }

    #[test]
    fn decade_1_constant() {
        assert_eq!(block_subsidy(1), BASE_REWARD);
        assert_eq!(block_subsidy(1_000_000), BASE_REWARD);
        assert_eq!(block_subsidy(BLOCKS_PER_DECADE), BASE_REWARD);
    }

    #[test]
    fn decade_2_decay() {
        let d2 = BLOCKS_PER_DECADE + 1;
        let expected = BASE_REWARD * 4 / 5;
        assert_eq!(block_subsidy(d2), expected);
    }

    #[test]
    fn tail_emission_starts_at_decade_11() {
        let tail_start = 10 * BLOCKS_PER_DECADE + 1;
        assert_eq!(block_subsidy(tail_start), TAIL_REWARD);
        assert_eq!(block_subsidy(tail_start + 1_000_000), TAIL_REWARD);
        assert_eq!(block_subsidy(u64::MAX), TAIL_REWARD);
    }

    #[test]
    fn fee_split_sums_to_subsidy() {
        let (miner, humanitarian, issobella, pool_fee) = fee_split(BASE_REWARD);
        assert_eq!(miner + humanitarian + issobella + pool_fee, BASE_REWARD);
        assert!(humanitarian > 0);
        assert!(issobella > 0);
        assert!(pool_fee > 0);
    }

    #[test]
    fn constants_consistency() {
        assert_eq!(MINING_EMISSION, TOTAL_SUPPLY - GENESIS_PREMINE);
        assert_eq!(TOTAL_SUPPLY, 144_000_000_000_000_000_u128);
        assert_eq!(GENESIS_PREMINE, 16_780_000_000_000_000_u128);
        assert_eq!(MINING_EMISSION, 127_220_000_000_000_000_u128);
    }
}
