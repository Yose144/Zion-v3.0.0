//! DeekshaChv3 — Unified canonical algorithm (Phase A: alias wrapper)
//!
//! This module provides the **single canonical entry point** for ZION's PoW
//! hash function. In Phase A (dispatch unification) it is a thin alias over
//! `deeksha_lite_v1`, which is the current mainnet canonical algorithm.
//!
//! ## Why a wrapper?
//!
//! The codebase historically dispatched on algorithm strings (`deeksha_lite_v1`,
//! `cosmic_harmony_ekam_deeksha_v2`, `deeksha_lite_fire`).  Phase A of the
//! DeekshaChv3 unification plan introduces ONE canonical name — `deeksha_chv3` —
//! that all subsystems (pool, miner, GPU, core) can standardise on, without
//! changing the hash output or breaking the existing chain.
//!
//! ## Phase A guarantees
//!
//! - `deeksha_chv3_hash(h, n, height) == deeksha_lite(h, n)` — bit-identical.
//! - No consensus change, no hard fork, no chain reset.
//! - Existing miners sending `deeksha_lite_v1` continue to work.
//! - New miners can advertise `deeksha_chv3` and the pool accepts it.
//!
//! ## Future phases
//!
//! - **Phase B:** Add stream telemetry (`deeksha_chv3_with_streams`).
//! - **Phase C:** GPU kernel parity (`deeksha_chv3.cl`).
//! - **Phase D:** Optional consensus parameter change (hard fork, governed).
//!
//! See [`docs/3.0.5/DEEKSHA_CHV3_UNIFIED_ALGO_PLAN.md`] for the full plan.

use crate::algorithms_opt::Hash32;
use crate::deeksha_lite;

/// Canonical profile name for the unified DeekshaChv3 algorithm.
pub const DEEKSHA_CHV3_PROFILE: &str = "deeksha_chv3";

/// DeekshaChv3 canonical hash.
///
/// Phase A: delegates to `deeksha_lite::deeksha_lite` — bit-identical output.
pub fn deeksha_chv3_hash(block_header: &[u8], nonce: u64) -> [u8; 32] {
    deeksha_lite::deeksha_lite(block_header, nonce)
}

/// Height-aware DeekshaChv3 hash (returns `Hash32`).
///
/// Phase A: delegates to `deeksha_lite::deeksha_lite_with_height`.
pub fn deeksha_chv3_with_height(block_header: &[u8], nonce: u64, height: u64) -> Hash32 {
    deeksha_lite::deeksha_lite_with_height(block_header, nonce, height)
}

/// Sequential nonce search using DeekshaChv3.
///
/// Phase A: delegates to `deeksha_lite::deeksha_lite_find_nonce`.
pub fn deeksha_chv3_find_nonce(
    block_header: &[u8],
    start_nonce: u64,
    count: u64,
    target: &[u8; 32],
) -> Option<(u64, [u8; 32])> {
    deeksha_lite::deeksha_lite_find_nonce(block_header, start_nonce, count, target)
}

/// Self-test: hash twice, verify determinism + non-zero.
pub fn deeksha_chv3_self_test() -> bool {
    deeksha_lite::deeksha_lite_self_test()
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chv3_matches_deeksha_lite() {
        let header = b"deeksha_chv3 parity test header";
        let nonce = 12345u64;

        let chv3 = deeksha_chv3_hash(header, nonce);
        let lite = deeksha_lite::deeksha_lite(header, nonce);

        assert_eq!(
            chv3, lite,
            "deeksha_chv3 must be bit-identical to deeksha_lite in Phase A"
        );
    }

    #[test]
    fn chv3_with_height_matches_lite() {
        let header = b"height-aware parity test";
        let nonce = 99u64;
        let height = 42u64;

        let chv3 = deeksha_chv3_with_height(header, nonce, height);
        let lite = deeksha_lite::deeksha_lite_with_height(header, nonce, height);

        assert_eq!(chv3.data, lite.data);
    }

    #[test]
    fn chv3_is_deterministic() {
        let header = b"determinism check";
        let nonce = 7u64;

        let h1 = deeksha_chv3_hash(header, nonce);
        let h2 = deeksha_chv3_hash(header, nonce);

        assert_eq!(h1, h2, "hash must be deterministic");
        assert!(h1.iter().any(|&b| b != 0), "hash must not be all zeros");
    }

    #[test]
    fn chv3_self_test_passes() {
        assert!(deeksha_chv3_self_test());
    }

    #[test]
    fn chv3_profile_name() {
        assert_eq!(DEEKSHA_CHV3_PROFILE, "deeksha_chv3");
    }

    #[test]
    fn chv3_find_nonce_finds_solution() {
        // Use a very easy target (high value) so a solution is found quickly.
        let header = b"nonce search test header";
        let target = [0xFFu8; 32];
        let result = deeksha_chv3_find_nonce(header, 0, 1000, &target);
        assert!(result.is_some(), "should find a nonce within 1000 attempts");
        let (nonce, hash) = result.unwrap();
        assert!(hash <= target, "found hash must meet target");
        assert!(nonce < 1000);
    }
}
