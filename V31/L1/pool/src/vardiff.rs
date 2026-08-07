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
        Self {
            current_difficulty: config.start_difficulty.max(1),
            min_difficulty: config.min_difficulty.max(1),
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
        let new_diff = (new_diff_f as u64).max(self.min_difficulty).min(self.max_difficulty);

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
    if difficulty <= 1 {
        return [0xff; 32];
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
            start_difficulty: 100,
            min_difficulty: 1,
            max_difficulty: 1_000_000,
            target_secs: 10,
            retarget_shares: 3,
        }
    }

    #[test]
    fn test_vardiff_new_starts_at_config_difficulty() {
        let vd = VarDiff::new(&cfg());
        assert_eq!(vd.current(), 100);
    }

    #[test]
    fn test_vardiff_retarget_increases_difficulty_when_shares_fast() {
        let mut vd = VarDiff::new(&cfg());
        // Shares arrive much faster than the 10s target.
        // retarget_shares = 3 → retarget fires on the 3rd submit.
        vd.record_submit(); // ssr 1 → None
        thread::sleep(Duration::from_millis(10));
        vd.record_submit(); // ssr 2 → None
        thread::sleep(Duration::from_millis(10));
        let adjusted = vd.record_submit(); // ssr 3 → retarget
        assert!(
            vd.current() > 100,
            "fast shares should increase difficulty, got {}",
            vd.current()
        );
        assert!(adjusted.is_some());
    }

    #[test]
    fn test_vardiff_retarget_decreases_difficulty_when_shares_slow() {
        // Use a small target so we can make shares "slow" without
        // sleeping for tens of seconds.
        let mut vd = VarDiff::new(&VarDiffConfig {
            start_difficulty: 100,
            min_difficulty: 1,
            max_difficulty: 1_000_000,
            target_secs: 1,
            retarget_shares: 2,
        });
        // Shares arrive slower than the 1s target.
        vd.record_submit(); // ssr 1 → None
        thread::sleep(Duration::from_millis(1500));
        let adjusted = vd.record_submit(); // ssr 2 → retarget
        assert!(
            vd.current() < 100,
            "slow shares should decrease difficulty, got {}",
            vd.current()
        );
        assert!(adjusted.is_some());
    }

    #[test]
    fn test_vardiff_clamps_ratio() {
        // With a tiny target_secs and extremely fast shares the ratio
        // would be huge, but it must be clamped to 4.0.
        let mut vd = VarDiff::new(&VarDiffConfig {
            start_difficulty: 100,
            min_difficulty: 1,
            max_difficulty: 1_000_000_000,
            target_secs: 1,
            retarget_shares: 2,
        });
        // Fire shares as fast as possible.
        vd.record_submit(); // ssr 1 → None
        let adjusted = vd.record_submit(); // ssr 2 → retarget
        // Max increase is 4× → 400.
        assert!(
            vd.current() <= 400,
            "ratio should be clamped to 4.0, got {}",
            vd.current()
        );
        assert!(adjusted.is_some());
    }

    #[test]
    fn test_difficulty_to_target_max_target_for_diff_1() {
        let target = difficulty_to_target(1);
        assert_eq!(target, [0xff; 32]);
    }

    #[test]
    fn test_difficulty_to_target_lower_for_higher_diff() {
        let t1 = difficulty_to_target(1);
        let t256 = difficulty_to_target(256);
        // Higher difficulty must produce a numerically smaller target.
        // Big-endian byte comparison == numeric comparison.
        assert!(
            t256 < t1,
            "target for diff 256 should be lower than for diff 1"
        );
        // Difficulty 256 → 8 leading zero bits → first byte should be 0.
        assert_eq!(t256[0], 0x00);
        // The remaining bytes should still be 0xFF (shifted by exactly 1 byte).
        assert_eq!(t256[1], 0xff);
    }

    #[test]
    fn test_difficulty_to_target_100_has_correct_leading_bits() {
        // Difficulty 100 → log2(100) ≈ 6.6 → 6 leading zero bits.
        // Target should be 0x03FFFF...FF (first byte 0x03 = 00000011).
        let t100 = difficulty_to_target(100);
        assert_eq!(
            t100[0], 0x03,
            "difficulty 100 should produce target starting with 0x03, got 0x{:02x}",
            t100[0]
        );
        assert_eq!(t100[1], 0xff);
        assert_eq!(t100[31], 0xff);
    }

    #[test]
    fn test_difficulty_to_target_10_first_byte() {
        // Difficulty 10 → log2(10) ≈ 3.3 → 3 leading zero bits.
        // Target should be 0x1FFFF...FF (first byte 0x1F = 00011111).
        let t10 = difficulty_to_target(10);
        assert_eq!(
            t10[0], 0x1f,
            "difficulty 10 should produce target starting with 0x1F, got 0x{:02x}",
            t10[0]
        );
        assert_eq!(t10[1], 0xff);
    }
}
