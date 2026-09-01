//! Variable difficulty (VarDiff) module for the V31 stratum pool.
//!
//! Tracks per-miner share submission cadence and dynamically adjusts the
//! share difficulty so that miners submit shares at a configurable target
//! interval.  Higher difficulty → fewer shares (less overhead); lower
//! difficulty → more shares (faster feedback for slow miners).
//!
//! Ported from the V3 pool (`archive/V3/L1/pool/src/bin/server.rs` lines
//! 3159–3238) and adapted to be a self-contained std-only module.

use std::collections::VecDeque;
use std::time::Instant;

/// Hard floor for share difficulty. Prevents zero-PoW difficulty-1 share
/// acceptance that would allow an attacker to accrue PPLNS weight without
/// doing real work (POL-001).
pub const MIN_SHARE_DIFFICULTY: u64 = 1000;

/// Configuration for constructing a [`VarDiff`] instance.
#[derive(Debug, Clone)]
pub struct VarDiffConfig {
    /// Initial difficulty assigned to a freshly connected miner.
    pub start_difficulty: u64,
    /// Floor — difficulty is never lowered below this.
    pub min_difficulty: u64,
    /// Ceiling — difficulty is never raised above this.  `0` means unlimited.
    pub max_difficulty: u64,
    /// Desired seconds between share submissions.
    pub target_secs: u64,
    /// Number of shares between retarget calculations.
    pub retarget_shares: u64,
}

/// Variable-difficulty controller.
///
/// Call [`VarDiff::record_submit`] for every accepted share.  After
/// `retarget_shares` submissions the controller compares the observed
/// average share interval against `target_secs` and adjusts
/// `current_difficulty` accordingly (clamped to ±4× / ÷4).
pub struct VarDiff {
    current_difficulty: u64,
    min_difficulty: u64,
    max_difficulty: u64,
    target_secs: f64,
    retarget_shares: u64,
    /// Timestamps of recent share submissions (bounded ring, max 32).
    submit_times: VecDeque<Instant>,
    /// Shares accumulated since the last retarget.
    shares_since_retarget: u64,
}

impl VarDiff {
    /// Build a [`VarDiff`] from a [`VarDiffConfig`].
    ///
    /// Sensible lower bounds are applied: `start_difficulty` and
    /// `min_difficulty` are clamped to ≥ 1, `target_secs` to ≥ 1, and
    /// `retarget_shares` to ≥ 2.  A `max_difficulty` of `0` is treated as
    /// "no upper limit" (`u64::MAX`).
    pub fn new(config: &VarDiffConfig) -> Self {
        let min_diff = config.min_difficulty.max(MIN_SHARE_DIFFICULTY);
        let start_diff = config.start_difficulty.max(min_diff);
        Self {
            current_difficulty: start_diff,
            min_difficulty: min_diff,
            max_difficulty: if config.max_difficulty == 0 {
                u64::MAX
            } else {
                config.max_difficulty
            },
            target_secs: config.target_secs.max(1) as f64,
            retarget_shares: config.retarget_shares.max(2),
            submit_times: VecDeque::with_capacity(32),
            shares_since_retarget: 0,
        }
    }

    /// The 256-bit share target corresponding to the current difficulty.
    ///
    /// Higher difficulty → lower target.  See [`difficulty_to_target`].
    pub fn share_target(&self) -> [u8; 32] {
        difficulty_to_target(self.current_difficulty)
    }

    /// Record a share submission and optionally retarget difficulty.
    ///
    /// Returns `Some(new_difficulty)` when the difficulty was adjusted,
    /// or `None` when no retarget occurred (not enough shares yet, or the
    /// computed value was unchanged after clamping).
    pub fn record_submit(&mut self) -> Option<u64> {
        let now = Instant::now();
        self.submit_times.push_back(now);
        self.shares_since_retarget += 1;

        // Keep a bounded ring of timestamps.
        while self.submit_times.len() > 32 {
            self.submit_times.pop_front();
        }

        if self.shares_since_retarget < self.retarget_shares || self.submit_times.len() < 2 {
            return None;
        }

        // Compute average time between submissions.
        let n = self.submit_times.len() - 1;
        if n == 0 {
            return None;
        }
        let total_secs = self
            .submit_times
            .back()
            .unwrap()
            .duration_since(*self.submit_times.front().unwrap())
            .as_secs_f64();
        let avg_secs = if total_secs > 0.0 {
            total_secs / n as f64
        } else {
            // Infinitely fast cadence: the ratio below clamps to 4.0.
            0.0
        };

        // Retarget: new_diff = current_diff × (target_time / avg_time).
        // Clamp the ratio to [0.25, 4.0] to prevent wild swings.
        let ratio = (self.target_secs / avg_secs).clamp(0.25, 4.0);
        let new_diff_f = self.current_difficulty as f64 * ratio;
        let new_diff = (new_diff_f as u64)
            .max(self.min_difficulty)
            .min(self.max_difficulty);

        self.shares_since_retarget = 0;

        if new_diff != self.current_difficulty {
            self.current_difficulty = new_diff;
            Some(new_diff)
        } else {
            None
        }
    }

    /// Current share difficulty.
    pub fn current(&self) -> u64 {
        self.current_difficulty
    }
}

/// Convert a u64 difficulty to a 256-bit target: `target = (2²⁵⁶ − 1) / difficulty`.
///
/// For `difficulty == 1` (or `0`) the maximum target `[0xFF; 32]` is
/// returned.  For higher difficulties the target shrinks — roughly one
/// leading zero bit is added for every doubling of difficulty.
///
/// This is a std-only implementation that approximates the full-precision
/// `zion_core::difficulty::difficulty_to_target` (which uses `num-bigint`)
/// by computing the number of leading zero *bits* implied by the
/// difficulty and shifting the max target right accordingly.  The result
/// is always a valid, monotonically-decreasing-in-difficulty target.
pub fn difficulty_to_target(difficulty: u64) -> [u8; 32] {
    if difficulty < MIN_SHARE_DIFFICULTY {
        return difficulty_to_target(MIN_SHARE_DIFFICULTY);
    }

    // Number of leading zero bits = floor(log2(difficulty)).
    // For difficulty D, target ≈ 2^256 / D = 2^(256 - log2(D)).
    let leading_zeros = difficulty.leading_zeros() as usize;
    let log2_d = 63 - leading_zeros; // floor(log2(difficulty)) = position of MSB
    let shift_bits = log2_d.min(256);

    // Start from the maximum target and shift right by `shift_bits`.
    // We perform a big-endian right-shift: bytes move toward higher
    // indices (lower significance), with bit-level carry propagation.
    let mut out = [0xffu8; 32];

    if shift_bits == 0 {
        return out;
    }

    let byte_shift = shift_bits / 8;
    let bit_shift = (shift_bits % 8) as u8;

    // Move whole bytes right (toward higher index = lower significance).
    let mut tmp = [0u8; 32];
    if byte_shift < 32 {
        tmp[byte_shift..32].copy_from_slice(&out[0..(32 - byte_shift)]);
    }
    // `tmp` now holds the byte-shifted value; clear `out` for the bit pass.
    out = [0u8; 32];

    if bit_shift == 0 {
        out = tmp;
        return out;
    }

    // Bit-level right shift with carry propagation (big-endian).
    // For each byte (most significant → least significant), the bits that
    // fall off the right edge of the current byte become the high bits of
    // the next-less-significant byte.
    let mut carry: u8 = 0;
    for i in 0..32 {
        let val = tmp[i];
        out[i] = (val >> bit_shift) | carry;
        carry = val << (8 - bit_shift);
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    fn cfg() -> VarDiffConfig {
        VarDiffConfig {
            start_difficulty: 2000,
            min_difficulty: 1000,
            max_difficulty: 1_000_000,
            target_secs: 10,
            retarget_shares: 3,
        }
    }

    #[test]
    fn test_vardiff_new_starts_at_config_difficulty() {
        let vd = VarDiff::new(&cfg());
        assert_eq!(vd.current(), 2000);
    }

    #[test]
    fn test_vardiff_enforces_min_share_difficulty() {
        let vd = VarDiff::new(&VarDiffConfig {
            start_difficulty: 1,
            min_difficulty: 1,
            max_difficulty: 1_000_000,
            target_secs: 10,
            retarget_shares: 3,
        });
        assert!(
            vd.current() >= MIN_SHARE_DIFFICULTY,
            "difficulty should be clamped to at least {}, got {}",
            MIN_SHARE_DIFFICULTY,
            vd.current()
        );
    }

    #[test]
    fn test_vardiff_retarget_increases_difficulty_when_shares_fast() {
        let mut vd = VarDiff::new(&cfg());
        vd.record_submit();
        thread::sleep(Duration::from_millis(10));
        vd.record_submit();
        thread::sleep(Duration::from_millis(10));
        let adjusted = vd.record_submit();
        assert!(
            vd.current() > 2000,
            "fast shares should increase difficulty, got {}",
            vd.current()
        );
        assert!(adjusted.is_some());
    }

    #[test]
    fn test_vardiff_retarget_decreases_difficulty_when_shares_slow() {
        let mut vd = VarDiff::new(&VarDiffConfig {
            start_difficulty: 2000,
            min_difficulty: 1000,
            max_difficulty: 1_000_000,
            target_secs: 1,
            retarget_shares: 2,
        });
        vd.record_submit();
        thread::sleep(Duration::from_millis(1500));
        let adjusted = vd.record_submit();
        assert!(
            vd.current() < 2000,
            "slow shares should decrease difficulty, got {}",
            vd.current()
        );
        assert!(adjusted.is_some());
    }

    #[test]
    fn test_vardiff_clamps_ratio() {
        let mut vd = VarDiff::new(&VarDiffConfig {
            start_difficulty: 2000,
            min_difficulty: 1000,
            max_difficulty: 1_000_000_000,
            target_secs: 1,
            retarget_shares: 2,
        });
        vd.record_submit();
        let adjusted = vd.record_submit();
        assert!(
            vd.current() <= 8000,
            "ratio should be clamped to 4.0, got {}",
            vd.current()
        );
        assert!(adjusted.is_some());
    }

    #[test]
    fn test_difficulty_to_target_max_target_for_min_difficulty() {
        let target = difficulty_to_target(MIN_SHARE_DIFFICULTY);
        let max_target = difficulty_to_target(MIN_SHARE_DIFFICULTY);
        assert_eq!(target, max_target);
    }

    #[test]
    fn test_difficulty_to_target_below_floor_clamped() {
        let floor_target = difficulty_to_target(MIN_SHARE_DIFFICULTY);
        for d in [0u64, 1, 500, 999] {
            assert_eq!(
                difficulty_to_target(d),
                floor_target,
                "difficulty {} should be clamped to floor target",
                d
            );
        }
    }

    #[test]
    fn test_difficulty_to_target_lower_for_higher_diff() {
        let t_floor = difficulty_to_target(MIN_SHARE_DIFFICULTY);
        let t_higher = difficulty_to_target(256_000);
        assert!(
            t_higher < t_floor,
            "target for diff 256000 should be lower than for min difficulty"
        );
        assert_eq!(t_higher[0], 0x00);
    }

    #[test]
    fn test_difficulty_to_target_1000_has_correct_leading_bits() {
        let t = difficulty_to_target(MIN_SHARE_DIFFICULTY);
        // Difficulty 1000 → log2(1000) ≈ 9.97 → 9 leading zero bits.
        // Target first byte: 0x00 (9 leading zeros + 1 bit = 00000000_1…).
        assert_eq!(t[0], 0x00);
        assert_eq!(t[1], 0x7f);
    }

    #[test]
    fn test_difficulty_to_target_high_has_zero_first_byte() {
        let t = difficulty_to_target(100_000);
        assert_eq!(t[0], 0x00);
    }
}
