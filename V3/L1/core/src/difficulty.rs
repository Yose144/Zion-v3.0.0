//! ZION V3 — LWMA Difficulty Adjustment Algorithm
//!
//! Constitutional requirements (MAINNET_CONSTITUTION §3):
//!   - Target block time:    60 seconds
//!   - LWMA window:          60 blocks
//!   - Per-block clamp:      ±25 %
//!   - Solve-time clamp:     30–120 s per interval
//!   - Minimum difficulty:   1 000
//!   - Maximum difficulty:   u64::MAX / 1 000
//!
//! Reference: Zawy's LWMA (used by Monero, Grin, LOKI, etc.)

use crate::DifficultyTarget;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Target block time in seconds.
pub const TARGET_BLOCK_TIME: u64 = 60;

/// Number of previous blocks considered by the LWMA window.
pub const LWMA_WINDOW: usize = 60;

/// Minimum per-interval solve time (clamped), TARGET / 2.
pub const MIN_SOLVE_TIME: u64 = 30;

/// Maximum per-interval solve time (clamped), TARGET × 2.
pub const MAX_SOLVE_TIME: u64 = 120;

/// Absolute difficulty floor.
pub const MIN_DIFFICULTY: u64 = 1_000;

/// Absolute difficulty ceiling.
pub const MAX_DIFFICULTY: u64 = u64::MAX / 1_000;

/// Difficulty used for the genesis block and early chain bootstrap.
pub const GENESIS_DIFFICULTY: u64 = MIN_DIFFICULTY;

// ±25 % as exact integer fractions — avoids f64 non-determinism.
const CLAMP_UP_NUM: u128 = 5;
const CLAMP_UP_DEN: u128 = 4; // 5/4 = 1.25
const CLAMP_DN_NUM: u128 = 3;
const CLAMP_DN_DEN: u128 = 4; // 3/4 = 0.75

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Timestamp (seconds) + difficulty pair consumed by the LWMA algorithm.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlockInfo {
    pub timestamp: u64,
    pub difficulty: u64,
}

// ---------------------------------------------------------------------------
// LWMA core
// ---------------------------------------------------------------------------

/// Calculate the difficulty for the *next* block using LWMA.
///
/// `window` must be **oldest-first**.  An ideal input contains
/// `LWMA_WINDOW + 1` entries (N + 1 timestamps → N solve-time intervals).
/// The algorithm adapts gracefully with fewer entries.
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

// ---------------------------------------------------------------------------
// Target ↔ difficulty conversion
// ---------------------------------------------------------------------------

/// Convert a u64 difficulty to a 256-bit target: `target = (2²⁵⁶ − 1) / difficulty`.
pub fn difficulty_to_target(difficulty: u64) -> DifficultyTarget {
    if difficulty <= 1 {
        return DifficultyTarget::MAX;
    }
    let d = difficulty as u128;
    let mut bytes = [0u8; 32];
    let mut remainder: u128 = 0;

    // Long division of [0xFF; 32] (= 2²⁵⁶ − 1) by d, 8 bytes per iteration.
    for chunk in 0..4 {
        let dividend = (remainder << 64) | 0xFFFF_FFFF_FFFF_FFFFu128;
        let quotient = dividend / d;
        remainder = dividend % d;
        bytes[chunk * 8..(chunk + 1) * 8].copy_from_slice(&(quotient as u64).to_be_bytes());
    }

    DifficultyTarget { bytes }
}

/// Encode a `DifficultyTarget` as compact nBits (Bitcoin-style).
///
/// Format: `(size << 24) | mantissa` where
/// `target ≈ mantissa × 256^(size − 3)`.
pub fn target_to_compact(target: &DifficultyTarget) -> u32 {
    let first_nz = match target.bytes.iter().position(|&b| b != 0) {
        Some(i) => i,
        None => return 0,
    };

    let mut size = (32 - first_nz) as u32;
    let b0 = target.bytes[first_nz] as u32;
    let b1 = if first_nz + 1 < 32 { target.bytes[first_nz + 1] as u32 } else { 0 };
    let b2 = if first_nz + 2 < 32 { target.bytes[first_nz + 2] as u32 } else { 0 };
    let mut compact = (b0 << 16) | (b1 << 8) | b2;

    // If top bit of mantissa is set, shift right to avoid sign ambiguity.
    if compact & 0x0080_0000 != 0 {
        compact >>= 8;
        size += 1;
    }

    (size << 24) | (compact & 0x007F_FFFF)
}

/// Decode compact nBits into a `DifficultyTarget`.
pub fn compact_to_target(bits: u32) -> DifficultyTarget {
    let size = (bits >> 24) as usize;
    let mantissa = bits & 0x007F_FFFF;

    if size == 0 || mantissa == 0 {
        return DifficultyTarget { bytes: [0u8; 32] };
    }

    let mut bytes = [0u8; 32];

    if size <= 3 {
        let word = mantissa >> (8 * (3 - size));
        for i in (0..size).rev() {
            let byte_pos = 32 - 1 - i;
            bytes[byte_pos] = ((word >> (8 * i)) & 0xFF) as u8;
        }
    } else {
        let start = 32 - size;
        bytes[start] = ((mantissa >> 16) & 0xFF) as u8;
        if start + 1 < 32 {
            bytes[start + 1] = ((mantissa >> 8) & 0xFF) as u8;
        }
        if start + 2 < 32 {
            bytes[start + 2] = (mantissa & 0xFF) as u8;
        }
    }

    DifficultyTarget { bytes }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_window(n: usize, base_diff: u64, solve_time: u64) -> Vec<BlockInfo> {
        (0..=n)
            .map(|i| BlockInfo {
                timestamp: 1_000_000 + (i as u64) * solve_time,
                difficulty: base_diff,
            })
            .collect()
    }

    // --- LWMA algorithm tests ---

    #[test]
    fn perfect_timing_preserves_difficulty() {
        let window = make_window(60, 10_000, TARGET_BLOCK_TIME);
        assert_eq!(lwma_next_difficulty(&window), 10_000);
    }

    #[test]
    fn fast_blocks_increase_clamped() {
        let window = make_window(60, 10_000, 30);
        assert_eq!(lwma_next_difficulty(&window), 12_500);
    }

    #[test]
    fn slow_blocks_decrease_clamped() {
        let window = make_window(60, 10_000, 120);
        assert_eq!(lwma_next_difficulty(&window), 7_500);
    }

    #[test]
    fn extreme_fast_clamped_up() {
        let window = make_window(60, 10_000, 1);
        // Solve times clamped to MIN_SOLVE_TIME=30, so ratio=60/30=2× but ±25% clamp
        assert_eq!(lwma_next_difficulty(&window), 12_500);
    }

    #[test]
    fn extreme_slow_clamped_down() {
        let window = make_window(60, 10_000, 600);
        // Solve times clamped to MAX_SOLVE_TIME=120, so ratio=60/120=0.5× but ±25% clamp
        assert_eq!(lwma_next_difficulty(&window), 7_500);
    }

    #[test]
    fn minimum_difficulty_floor() {
        let window = make_window(60, MIN_DIFFICULTY, 120);
        assert!(lwma_next_difficulty(&window) >= MIN_DIFFICULTY);
    }

    #[test]
    fn short_window_two_blocks() {
        let window = vec![
            BlockInfo { timestamp: 1000, difficulty: 5_000 },
            BlockInfo { timestamp: 1060, difficulty: 5_000 },
        ];
        assert_eq!(lwma_next_difficulty(&window), 5_000);
    }

    #[test]
    fn single_block_returns_its_difficulty() {
        let window = vec![BlockInfo { timestamp: 1000, difficulty: 8_000 }];
        assert_eq!(lwma_next_difficulty(&window), 8_000);
    }

    #[test]
    fn empty_window_returns_genesis() {
        assert_eq!(lwma_next_difficulty(&[]), GENESIS_DIFFICULTY);
    }

    #[test]
    fn recent_blocks_weighted_more() {
        let mut window = Vec::new();
        let mut ts = 1_000_000u64;
        window.push(BlockInfo { timestamp: ts, difficulty: 10_000 });
        for _ in 1..=50 {
            ts += 60;
            window.push(BlockInfo { timestamp: ts, difficulty: 10_000 });
        }
        for _ in 51..=60 {
            ts += 30;
            window.push(BlockInfo { timestamp: ts, difficulty: 10_000 });
        }
        assert!(
            lwma_next_difficulty(&window) > 10_000,
            "recent fast blocks should increase difficulty"
        );
    }

    #[test]
    fn stability_simulation_200_blocks() {
        let solve_times = [55u64, 65, 58, 62, 50, 70, 57, 63, 59, 61];
        let mut blocks = vec![BlockInfo { timestamp: 1_000_000, difficulty: 10_000 }];
        let mut ts = 1_000_000u64;

        for i in 0..200 {
            ts += solve_times[i % solve_times.len()];
            let start = blocks.len().saturating_sub(LWMA_WINDOW + 1);
            let diff = lwma_next_difficulty(&blocks[start..]);
            blocks.push(BlockInfo { timestamp: ts, difficulty: diff });
        }

        let final_diff = blocks.last().unwrap().difficulty;
        assert!(
            final_diff >= 5_000 && final_diff <= 20_000,
            "after 200 varied blocks, difficulty {final_diff} should stabilize near 10k"
        );
    }

    #[test]
    fn no_overflow_high_difficulty() {
        let window = make_window(60, MAX_DIFFICULTY / 2, 30);
        let next = lwma_next_difficulty(&window);
        assert!(next > 0 && next <= MAX_DIFFICULTY);
    }

    #[test]
    fn deterministic() {
        let window = make_window(60, 10_000, 45);
        let r1 = lwma_next_difficulty(&window);
        let r2 = lwma_next_difficulty(&window);
        assert_eq!(r1, r2);
    }

    // --- Target conversion tests ---

    #[test]
    fn difficulty_1_is_max_target() {
        assert_eq!(difficulty_to_target(1), DifficultyTarget::MAX);
    }

    #[test]
    fn higher_difficulty_lower_target() {
        let t1 = difficulty_to_target(100);
        let t2 = difficulty_to_target(1000);
        assert!(t2.bytes < t1.bytes);
    }

    #[test]
    fn target_allows_low_hash() {
        let target = difficulty_to_target(1_000);
        assert!(target.allows(&[0u8; 32]));
    }

    #[test]
    fn target_rejects_high_hash() {
        let target = difficulty_to_target(1_000_000);
        assert!(!target.allows(&[0xFF; 32]));
    }

    // --- Compact nBits round-trip tests ---

    #[test]
    fn compact_round_trip_high_target() {
        let bits = 0x1f00ffff_u32;
        let target = compact_to_target(bits);
        assert_eq!(target_to_compact(&target), bits);
    }

    #[test]
    fn compact_round_trip_genesis_difficulty() {
        let target = difficulty_to_target(GENESIS_DIFFICULTY);
        let bits = target_to_compact(&target);
        let recovered = compact_to_target(bits);
        // Compact encoding loses low-order bits; compare only leading 3 significant bytes.
        assert_eq!(&recovered.bytes[..4], &target.bytes[..4]);
    }

    #[test]
    fn compact_round_trip_medium_difficulty() {
        let target = difficulty_to_target(100_000);
        let bits = target_to_compact(&target);
        let recovered = compact_to_target(bits);
        assert_eq!(&recovered.bytes[..4], &target.bytes[..4]);
    }

    #[test]
    fn compact_zero_returns_zero_target() {
        let target = compact_to_target(0);
        assert_eq!(target.bytes, [0u8; 32]);
    }
}
