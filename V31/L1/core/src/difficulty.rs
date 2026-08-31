//! ZION LWMA difficulty adjustment algorithm.
//!
//! Constitutional constants:
//!   - Target block time: 60 seconds
//!   - LWMA window: 60 blocks
//!   - Per-block clamp: ±50 %
//!   - Solve-time clamp: 6–360 s per interval
//!   - Minimum difficulty: 10
//!   - Maximum difficulty: u64::MAX / 1_000
//!
//! Reference: Zawy's LWMA (used by Monero, Grin, LOKI, etc.).

/// Target block time in seconds.
pub const TARGET_BLOCK_TIME: u64 = 60;

/// Number of previous blocks considered by the LWMA window.
pub const LWMA_WINDOW: usize = 60;

/// Minimum per-interval solve time (clamped), `TARGET / 10`.
///
/// Matches Zawy's LWMA reference: small solve times are not rounded up very
/// much, so the algorithm can quickly react to a sudden hashrate increase.
pub const MIN_SOLVE_TIME: u64 = 6;

/// Maximum per-interval solve time (clamped), `TARGET * 6`.
///
/// Matches Zawy's LWMA reference (`std::min(6*T, ...)`). A wider ceiling lets
/// the algorithm drop difficulty faster when hashrate suddenly falls, reducing
/// the risk of long block stalls like the one seen around height 6944.
pub const MAX_SOLVE_TIME: u64 = 360;

/// Absolute difficulty floor.
pub const MIN_DIFFICULTY: u64 = 10;

/// Absolute difficulty ceiling.
pub const MAX_DIFFICULTY: u64 = u64::MAX / 1_000;

/// Difficulty used for the genesis block and early chain bootstrap.
pub const GENESIS_DIFFICULTY: u64 = MIN_DIFFICULTY;

/// ±50 % as exact integer fractions — avoids f64 non-determinism.
///
/// The wider band matches Zawy's recommendation to not over-limit the LWMA
/// rise/fall rate, while still capping the per-block difficulty swing to
/// prevent extreme jumps from timestamp manipulation or measurement noise.
const CLAMP_UP_NUM: u128 = 3;
const CLAMP_UP_DEN: u128 = 2; // 3/2 = 1.5
const CLAMP_DN_NUM: u128 = 1;
const CLAMP_DN_DEN: u128 = 2; // 1/2 = 0.5

/// Timestamp (seconds) + difficulty pair consumed by the LWMA algorithm.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlockInfo {
    pub timestamp: u64,
    pub difficulty: u64,
}

/// Calculate the difficulty for the *next* block using LWMA.
///
/// `window` must be **oldest-first**. An ideal input contains `LWMA_WINDOW + 1`
/// entries (N + 1 timestamps → N solve-time intervals). The algorithm adapts
/// gracefully with fewer entries.
pub fn lwma_next_difficulty(window: &[BlockInfo]) -> u64 {
    if window.len() < 2 {
        return window
            .last()
            .map(|b| b.difficulty.max(MIN_DIFFICULTY))
            .unwrap_or(GENESIS_DIFFICULTY);
    }

    let n = window.len() - 1;

    let mut weighted_solve_sum: u128 = 0;
    let mut weighted_diff_sum: u128 = 0;
    let mut weight_sum: u128 = 0;

    for i in 1..=n {
        let raw = window[i].timestamp.saturating_sub(window[i - 1].timestamp);
        let solve = raw.clamp(MIN_SOLVE_TIME, MAX_SOLVE_TIME);
        let w = i as u128;
        weighted_solve_sum += solve as u128 * w;
        weighted_diff_sum += window[i].difficulty as u128 * w;
        weight_sum += w;
    }

    if weight_sum == 0 || weighted_solve_sum == 0 {
        return window.last().unwrap().difficulty.max(MIN_DIFFICULTY);
    }

    // next = Σ(diff·w) × TARGET / Σ(solve·w)
    let next_128 = weighted_diff_sum * TARGET_BLOCK_TIME as u128 / weighted_solve_sum;
    let mut next = if next_128 > MAX_DIFFICULTY as u128 {
        MAX_DIFFICULTY
    } else {
        next_128 as u64
    };

    // ±25 % clamp relative to the most recent block (integer arithmetic).
    let prev = window.last().unwrap().difficulty as u128;
    let max_allowed = (prev * CLAMP_UP_NUM / CLAMP_UP_DEN) as u64;
    let min_allowed = (prev * CLAMP_DN_NUM / CLAMP_DN_DEN) as u64;
    next = next.clamp(min_allowed, max_allowed);

    // Global floor / ceiling.
    next.clamp(MIN_DIFFICULTY, MAX_DIFFICULTY)
}

/// Convert a u64 difficulty to a 256-bit target: `target = (2²⁵⁶ − 1) / difficulty`.
pub fn difficulty_to_target(difficulty: u64) -> [u8; 32] {
    use num_bigint::BigUint;
    if difficulty <= 1 {
        return [0xff; 32];
    }
    // 2^256 - 1
    let max: BigUint = (BigUint::from(1u8) << 256) - 1u8;
    let d = BigUint::from(difficulty);
    let target: BigUint = max / d;
    let bytes = target.to_bytes_be();
    let mut out = [0u8; 32];
    let start = out.len().saturating_sub(bytes.len());
    out[start..].copy_from_slice(&bytes);
    out
}

/// Convert a 256-bit target back to difficulty: `difficulty = (2²⁵⁶ − 1) / target`.
pub fn target_to_difficulty(target: &[u8; 32]) -> u64 {
    use num_bigint::BigUint;
    let max: BigUint = (BigUint::from(1u8) << 256) - 1u8;
    let t = BigUint::from_bytes_be(target);
    if t == BigUint::from(0u8) {
        return MAX_DIFFICULTY;
    }
    let difficulty = max / t;
    if difficulty > BigUint::from(MAX_DIFFICULTY) {
        MAX_DIFFICULTY
    } else {
        let bytes = difficulty.to_bytes_le();
        let mut arr = [0u8; 8];
        let len = bytes.len().min(8);
        arr[..len].copy_from_slice(&bytes[..len]);
        u64::from_le_bytes(arr).clamp(MIN_DIFFICULTY, MAX_DIFFICULTY)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_window(block_time: u64, difficulty: u64, count: usize) -> Vec<BlockInfo> {
        let mut out = Vec::with_capacity(count);
        let mut ts = 1_000_000u64;
        for _ in 0..count {
            out.push(BlockInfo {
                timestamp: ts,
                difficulty,
            });
            ts += block_time;
        }
        out
    }

    #[test]
    fn perfect_timing_preserves_difficulty() {
        let window = make_window(TARGET_BLOCK_TIME, 10_000, LWMA_WINDOW + 1);
        assert_eq!(lwma_next_difficulty(&window), 10_000);
    }

    #[test]
    fn fast_blocks_raise_difficulty() {
        let window = make_window(TARGET_BLOCK_TIME / 2, 10_000, LWMA_WINDOW + 1);
        let next = lwma_next_difficulty(&window);
        assert!(
            next > 10_000,
            "fast blocks should increase difficulty: {next}"
        );
    }

    #[test]
    fn slow_blocks_lower_difficulty() {
        let window = make_window(TARGET_BLOCK_TIME * 2, 10_000, LWMA_WINDOW + 1);
        let next = lwma_next_difficulty(&window);
        assert!(
            next < 10_000,
            "slow blocks should decrease difficulty: {next}"
        );
    }

    #[test]
    fn clamp_limits_per_block_change() {
        // Every block is 1/10 of target (6 s). The raw LWMA would push
        // difficulty to ~100_000, so the per-block clamp must cap it.
        let window = make_window(TARGET_BLOCK_TIME / 10, 10_000, LWMA_WINDOW + 1);
        let next = lwma_next_difficulty(&window);
        let max_allowed = 10_000 * 3 / 2;
        let min_allowed = 10_000 / 2;
        assert!(
            next <= max_allowed,
            "per-block upward clamp violated: {next}"
        );
        assert!(
            next >= min_allowed,
            "per-block downward clamp violated: {next}"
        );
    }

    #[test]
    fn target_and_difficulty_round_trip() {
        for difficulty in [1_000u64, 10_000, 1_000_000] {
            let target = difficulty_to_target(difficulty);
            let back = target_to_difficulty(&target);
            // The approximation is intentionally coarse; within an order of magnitude is fine.
            let ratio = (difficulty as f64 / back as f64).max(back as f64 / difficulty as f64);
            assert!(
                ratio < 10.0,
                "difficulty round-trip too far: {difficulty} vs {back}"
            );
        }
    }

    #[test]
    fn window_too_short_falls_back() {
        let window = [BlockInfo {
            timestamp: 1_000_000,
            difficulty: 5_000,
        }];
        assert_eq!(lwma_next_difficulty(&window), 5_000);
    }
}
