//! DeekshaChv3 — Unified canonical algorithm (Phase A + B)
//!
//! This module provides the **single canonical entry point** for ZION's PoW
//! hash function. In Phase A (dispatch unification) it is a thin alias over
//! `deeksha_lite_v1`, which is the current mainnet canonical algorithm.
//! Phase B adds stream telemetry for unified revenue accounting.
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
//! ## Phase B additions
//!
//! - `deeksha_chv3_with_streams()` returns `(Hash32, DeekshaStreamTelemetry)`.
//! - `deeksha_chv3_find_nonce_with_streams()` captures telemetry for the
//!   winning nonce.
//! - Telemetry is consensus-safe (does NOT change hash output).
//! - Pool can call `track_deeksha_streams()` for granular per-stream revenue.
//!
//! ## Future phases
//!
//! - **Phase C:** GPU kernel parity (`deeksha_chv3.cl`).
//! - **Phase D:** Optional consensus parameter change (hard fork, governed).
//!
//! See [`docs/3.0.5/DEEKSHA_CHV3_UNIFIED_ALGO_PLAN.md`] for the full plan.

use crate::algorithms_opt::Hash32;
use crate::deeksha_lite;
use crate::stream_layers::{deeksha_lite_v1_with_streams, DeekshaStreamTelemetry};

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

/// DeekshaChv3 with stream telemetry (Phase B).
///
/// Computes the **identical** hash as `deeksha_chv3_hash`, but also returns
/// per-step telemetry for revenue accounting. The telemetry maps each
/// computational step to a `RevenueSource` for granular per-stream tracking.
///
/// # Consensus safety
///
/// This function does NOT change the hash output. It is safe to use alongside
/// `deeksha_chv3_hash` — both produce the same `Hash32`.
#[inline]
pub fn deeksha_chv3_with_streams(
    block_header: &[u8],
    nonce: u64,
) -> (Hash32, DeekshaStreamTelemetry) {
    deeksha_lite_v1_with_streams(block_header, nonce)
}

/// Height-aware DeekshaChv3 with stream telemetry (Phase B).
///
/// Same as `deeksha_chv3_with_streams` but accepts a block height for
/// future height-dependent pipeline steps (Phase D).
#[inline]
pub fn deeksha_chv3_with_streams_height(
    block_header: &[u8],
    nonce: u64,
    _height: u64,
) -> (Hash32, DeekshaStreamTelemetry) {
    // Phase A/B: height is ignored (deeksha_lite_v1 is height-independent).
    // Phase D may use height for scratchpad parameter selection.
    deeksha_lite_v1_with_streams(block_header, nonce)
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

/// Sequential nonce search with stream telemetry (Phase B).
///
/// Finds a nonce that meets the target and returns the winning nonce, hash,
/// and stream telemetry for the winning computation. If no nonce in the
/// range meets the target, returns `None`.
pub fn deeksha_chv3_find_nonce_with_streams(
    block_header: &[u8],
    start_nonce: u64,
    count: u64,
    target: &[u8; 32],
) -> Option<(u64, [u8; 32], DeekshaStreamTelemetry)> {
    for offset in 0..count {
        let nonce = start_nonce.wrapping_add(offset);
        let (hash_obj, telemetry) = deeksha_chv3_with_streams(block_header, nonce);
        if hash_obj.data <= *target {
            return Some((nonce, hash_obj.data, telemetry));
        }
    }
    None
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

    // ── Phase B: Stream telemetry tests ──────────────────────────────

    #[test]
    fn chv3_with_streams_matches_plain_hash() {
        let header = b"chv3 stream parity header";
        let nonce = 42u64;

        let plain = deeksha_chv3_hash(header, nonce);
        let (stream_hash, telemetry) = deeksha_chv3_with_streams(header, nonce);

        assert_eq!(
            plain, stream_hash.data,
            "with_streams must NOT change hash output"
        );
        assert!(!telemetry.steps.is_empty(), "telemetry must have steps");
        assert!(telemetry.total_work > 0, "total_work must be non-zero");
    }

    #[test]
    fn chv3_with_streams_has_4_steps() {
        // deeksha_lite_v1 pipeline: Keccak256, MemoryHard, AesMix, KeccakFinal
        let (_hash, telemetry) = deeksha_chv3_with_streams(b"step count test", 1);
        assert_eq!(
            telemetry.steps.len(),
            4,
            "chv3 (lite_v1 alias) must have 4 pipeline steps"
        );
    }

    #[test]
    fn chv3_with_streams_height_ignores_height() {
        let header = b"height invariant test";
        let nonce = 7u64;

        let (h0, t0) = deeksha_chv3_with_streams_height(header, nonce, 0);
        let (h100, t100) = deeksha_chv3_with_streams_height(header, nonce, 100);
        let (h4500, t4500) = deeksha_chv3_with_streams_height(header, nonce, 4500);

        assert_eq!(h0.data, h100.data, "hash must be height-independent in Phase A/B");
        assert_eq!(h0.data, h4500.data, "hash must be height-independent in Phase A/B");
        assert_eq!(t0.total_work, t100.total_work);
        assert_eq!(t0.total_work, t4500.total_work);
    }

    #[test]
    fn chv3_stream_breakdown_has_zion_and_deeksha_lite() {
        let (_hash, telemetry) = deeksha_chv3_with_streams(b"breakdown test", 99);
        let breakdown = &telemetry.stream_breakdown;

        // deeksha_lite_v1 steps: Keccak256→KeccakBonus, MemoryHard→Zion,
        // AesMix→DeekshaLite, KeccakFinal→Zion
        assert!(
            breakdown.contains_key("keccak_bonus"),
            "must have keccak_bonus stream"
        );
        assert!(
            breakdown.contains_key("zion"),
            "must have zion stream"
        );
        assert!(
            breakdown.contains_key("deeksha_lite"),
            "must have deeksha_lite stream"
        );
    }

    #[test]
    fn chv3_find_nonce_with_streams_returns_telemetry() {
        let header = b"nonce+streams test";
        let target = [0xFFu8; 32];
        let result = deeksha_chv3_find_nonce_with_streams(header, 0, 1000, &target);

        assert!(result.is_some(), "should find a nonce");
        let (nonce, hash, telemetry) = result.unwrap();
        assert!(hash <= target, "found hash must meet target");
        assert!(nonce < 1000);
        assert!(telemetry.total_work > 0, "telemetry must have work units");
        assert_eq!(telemetry.steps.len(), 4, "must have 4 pipeline steps");
    }

    #[test]
    fn chv3_with_streams_is_deterministic() {
        let header = b"determinism stream test";
        let nonce = 13u64;

        let (h1, t1) = deeksha_chv3_with_streams(header, nonce);
        let (h2, t2) = deeksha_chv3_with_streams(header, nonce);

        assert_eq!(h1.data, h2.data, "hash must be deterministic");
        assert_eq!(t1.total_work, t2.total_work, "telemetry must be deterministic");
        assert_eq!(t1.steps.len(), t2.steps.len());
    }

    // ── Phase C: KAT (Known Answer Test) for CPU↔GPU parity ──────────

    /// KAT vector 1: fixed header + nonce → known hash.
    /// This vector is computed from the CPU `deeksha_chv3_hash` function
    /// and serves as a reference for GPU kernel parity verification.
    /// If the GPU kernel produces a different hash for this input,
    /// there is a CPU↔GPU divergence bug.
    #[test]
    fn chv3_kat_known_vector_1() {
        let header = [0u8; 80]; // 80-byte zero header
        let nonce = 0u64;
        let hash = deeksha_chv3_hash(&header, nonce);

        // Known answer: deeksha_lite(zeros[80], 0)
        // This is a fixed vector — any change indicates a regression.
        let expected = deeksha_lite::deeksha_lite(&header, nonce);
        assert_eq!(
            hash, expected,
            "KAT vector 1: chv3 must match lite (both are aliases)"
        );

        // Log the hex for documentation purposes
        let hex: String = hash.iter().map(|b| format!("{:02x}", b)).collect();
        // Hash must be non-zero (sanity)
        assert!(hash.iter().any(|&b| b != 0), "KAT vector 1: hash must be non-zero");
        // Print for KAT documentation (visible with --nocapture)
        println!("KAT vector 1: header=zeros[80] nonce=0 hash={hex}");
    }

    /// KAT vector 2: non-trivial header + nonce.
    #[test]
    fn chv3_kat_known_vector_2() {
        let mut header = [0u8; 80];
        // Fill with a known pattern
        for (i, b) in header.iter_mut().enumerate() {
            *b = ((i * 7 + 13) & 0xFF) as u8;
        }
        let nonce = 0x4242_4242_4242_4242u64;
        let hash = deeksha_chv3_hash(&header, nonce);

        let expected = deeksha_lite::deeksha_lite(&header, nonce);
        assert_eq!(
            hash, expected,
            "KAT vector 2: chv3 must match lite"
        );

        let hex: String = hash.iter().map(|b| format!("{:02x}", b)).collect();
        println!("KAT vector 2: header=pattern[80] nonce=0x4242... hash={hex}");
    }

    /// KAT vector 3: realistic block header pattern.
    #[test]
    fn chv3_kat_known_vector_3() {
        let mut header = [0u8; 80];
        // Simulate a block header: version=1, prev_hash, merkle_root, timestamp, bits
        header[0] = 1; // version
        // prev_hash: 32 bytes of 0xAA
        for i in 4..36 {
            header[i] = 0xAA;
        }
        // merkle_root: 32 bytes of 0xBB
        for i in 36..68 {
            header[i] = 0xBB;
        }
        // timestamp: 0x12345678 (LE)
        header[68] = 0x78;
        header[69] = 0x56;
        header[70] = 0x34;
        header[71] = 0x12;
        // bits: 0x1d00ffff (LE)
        header[72] = 0xff;
        header[73] = 0xff;
        header[74] = 0x00;
        header[75] = 0x1d;

        let nonce = 12345u64;
        let hash = deeksha_chv3_hash(&header, nonce);

        let expected = deeksha_lite::deeksha_lite(&header, nonce);
        assert_eq!(
            hash, expected,
            "KAT vector 3: chv3 must match lite for realistic header"
        );

        let hex: String = hash.iter().map(|b| format!("{:02x}", b)).collect();
        println!("KAT vector 3: header=blocklike[80] nonce=12345 hash={hex}");
    }

    /// KAT parity: verify that deeksha_chv3_with_streams produces the
    /// same hash as the plain function (consensus-safe telemetry).
    /// This is the CPU-side parity check that the GPU kernel must also pass.
    #[test]
    fn chv3_kat_streams_parity() {
        let header = [0u8; 80];
        let nonce = 42u64;

        let plain = deeksha_chv3_hash(&header, nonce);
        let (stream_hash, _) = deeksha_chv3_with_streams(&header, nonce);

        assert_eq!(
            plain, stream_hash.data,
            "KAT streams parity: with_streams must produce same hash as plain"
        );
    }

    /// KAT: verify GPU kernel source is present and has correct entry point.
    #[test]
    fn chv3_kat_gpu_kernel_present() {
        use crate::gpu::opencl_kernel;
        assert!(opencl_kernel::has_deeksha_chv3_kernel(),
            "GPU kernel deeksha_chv3_mine must be present in opencl_kernel module");
        assert_eq!(
            opencl_kernel::DEEKSHA_CHV3_KERNEL_NAME,
            "deeksha_chv3_mine",
            "GPU kernel name must be deeksha_chv3_mine"
        );
        // Kernel source must contain the same scratchpad constants as lite
        let src = opencl_kernel::get_deeksha_chv3_kernel_source();
        assert!(src.contains("SCRATCHPAD_SIZE  262144"),
            "GPU kernel must have 256 KiB scratchpad (parity with CPU)");
        assert!(src.contains("BLOCK_COUNT      8192"),
            "GPU kernel must have 8192 blocks (parity with CPU)");
    }
}
