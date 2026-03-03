/// F-04: CHv4 E2E Test Suite
///
/// Verifies that CHv4 (NPU Mixing INT8 MLP) is active from genesis (height 0)
/// and that the pool ShareValidator correctly accepts CHv4 shares at genesis height.
///
/// Key invariant: CHV4_NPU_FORK_HEIGHT = 0
///   → cosmic_harmony_with_height(blob, nonce, h) uses CHv4 for ALL h ≥ 0
///   → No miner or pool should ever produce a CHv3-only hash after chain reset.
///
/// Run: cargo test -p zion-pool -- chv4 --nocapture

use zion_cosmic_harmony_v3::{
    algorithms_opt,
    cosmic_harmony_v3, cosmic_harmony_v4, cosmic_harmony_with_height,
    CHV4_NPU_FORK_HEIGHT,
};
use zion_pool::shares::validator::{Algorithm, ShareValidator, SubmittedShare};

// ── Group A: CHv4 fork-height constant ──────────────────────────────────────

/// Fork height must be 0 — CHv4 is active from genesis.
#[test]
fn test_chv4_fork_height_is_zero() {
    assert_eq!(
        CHV4_NPU_FORK_HEIGHT, 0,
        "CHV4_NPU_FORK_HEIGHT must be 0 (active from genesis). \
         If this fails, algorithms_npu.rs was not updated correctly."
    );
}

// ── Group B: CHv4 hash correctness ──────────────────────────────────────────

/// cosmic_harmony_with_height at h=0 must equal cosmic_harmony_v4 directly.
#[test]
fn test_chv4_with_height_zero_equals_v4() {
    let blob = [0xABu8; 80];
    let nonce: u64 = 0x1234_5678_9ABC_DEF0;

    let h_height = cosmic_harmony_with_height(&blob, nonce, 0);
    let h_v4 = cosmic_harmony_v4(&blob, nonce);

    assert_eq!(
        h_height.data, h_v4.data,
        "cosmic_harmony_with_height(blob, nonce, 0) must equal cosmic_harmony_v4(blob, nonce)"
    );
}

/// CHv4 must be deterministic — same input always produces same hash.
#[test]
fn test_chv4_hash_is_deterministic() {
    let blob = [0x5Au8; 80];
    let nonce: u64 = 0xDEAD_BEEF_CAFE_1234;

    let h1 = cosmic_harmony_with_height(&blob, nonce, 0);
    let h2 = cosmic_harmony_with_height(&blob, nonce, 0);
    let h3 = cosmic_harmony_v4(&blob, nonce);

    assert_eq!(h1.data, h2.data, "CHv4 must be deterministic (call 1 == call 2)");
    assert_eq!(h1.data, h3.data, "cosmic_harmony_with_height(0) must equal cosmic_harmony_v4");
}

/// CHv4 hash must differ from CHv3 for the same (blob, nonce).
/// NPU Mixing step is what distinguishes CHv4 from CHv3.
#[test]
fn test_chv4_differs_from_chv3() {
    let blob = [0x42u8; 80];
    let nonce: u64 = 0x0000_0001;

    let h_chv3 = cosmic_harmony_v3(&blob, nonce);
    let h_chv4 = cosmic_harmony_v4(&blob, nonce);

    assert_ne!(
        h_chv3.data, h_chv4.data,
        "CHv4 hash (with NPU Mixing) must differ from CHv3 ASIC-hardened hash"
    );
}

/// CHv4 hash must differ from CHv3 legacy for the same (blob, nonce).
#[test]
fn test_chv4_differs_from_chv3_legacy() {
    let blob = [0x7Fu8; 80];
    let nonce: u64 = 0xCAFE_BABE;

    // access legacy directly via algorithms_opt (not re-exported at crate level)
    let h_legacy = algorithms_opt::cosmic_harmony_v3_legacy(&blob, nonce);
    let h_chv4 = cosmic_harmony_with_height(&blob, nonce, 0);

    assert_ne!(
        h_legacy.data, h_chv4.data,
        "CHv4 hash must differ from CHv3-legacy hash"
    );
}

/// Different nonces must produce different hashes (sanity check).
#[test]
fn test_chv4_different_nonces_produce_different_hashes() {
    let blob = [0x11u8; 80];

    let h1 = cosmic_harmony_v4(&blob, 1);
    let h2 = cosmic_harmony_v4(&blob, 2);
    let h3 = cosmic_harmony_v4(&blob, 100_000);

    assert_ne!(h1.data, h2.data, "nonce=1 and nonce=2 must produce different hashes");
    assert_ne!(h1.data, h3.data, "nonce=1 and nonce=100_000 must produce different hashes");
}

// ── Group C: Pool ShareValidator with CHv4 ──────────────────────────────────

/// All CHv4 algorithm name aliases must parse as Algorithm::CosmicHarmony.
#[test]
fn test_chv4_algorithm_aliases_parse_correctly() {
    let chv4_aliases = [
        "cosmic_harmony",
        "cosmic_harmony_v4",
        "chv4",
        "ch4",
        "cosmic",
        "cosmicharmonyv4",
        "cosmic-harmony-v4",
        // Also CHv3 aliases — same validator handles both
        "cosmic_harmony_v3",
        "chv3",
        "ch3",
    ];

    for alias in &chv4_aliases {
        assert_eq!(
            Algorithm::from_str(alias),
            Algorithm::CosmicHarmony,
            "Algorithm alias '{}' must parse as CosmicHarmony",
            alias
        );
    }
}

/// CHv4 share at genesis height (0) must be accepted by the pool ShareValidator.
/// Uses max target (ffffffff) so any valid hash passes difficulty.
#[tokio::test]
async fn test_chv4_share_accepted_at_genesis_height() {
    let validator = ShareValidator::new("little");

    // Compute a real CHv4 hash so result matches
    let blob_bytes = vec![0xBEu8; 80];
    let nonce: u64 = 0x0000_0001;
    let hash = cosmic_harmony_with_height(&blob_bytes, nonce, 0);

    let share = SubmittedShare {
        job_id: "f04_genesis_test".to_string(),
        nonce: format!("{:08x}", nonce as u32), // pool stratum uses 32-bit nonce in hex
        result: Some(hex::encode(hash.data)),
        algorithm: "cosmic_harmony".to_string(),
        job_blob: hex::encode(&blob_bytes),
        job_target: "ffffffff".to_string(), // max target — any hash passes
        block_target: None,
        height: Some(0), // genesis block — CHV4_NPU_FORK_HEIGHT = 0
    };

    let result = validator.validate_share(&share, "f04_miner").await;
    assert!(
        result.valid,
        "CHv4 share at genesis height=0 must be accepted by ShareValidator. Reason: {}",
        result.reason
    );
}

/// CHv4 share using "chv4" alias must also be accepted at genesis height.
#[tokio::test]
async fn test_chv4_alias_share_accepted_at_genesis() {
    let validator = ShareValidator::new("little");

    let blob_bytes = vec![0xCDu8; 80];
    let nonce: u64 = 0x0000_0042;
    let hash = cosmic_harmony_v4(&blob_bytes, nonce);

    let share = SubmittedShare {
        job_id: "f04_alias_test".to_string(),
        nonce: format!("{:08x}", nonce as u32),
        result: Some(hex::encode(hash.data)),
        algorithm: "chv4".to_string(), // CHv4-specific alias
        job_blob: hex::encode(&blob_bytes),
        job_target: "ffffffff".to_string(),
        block_target: None,
        height: Some(0),
    };

    let result = validator.validate_share(&share, "f04_miner_alias").await;
    assert!(
        result.valid,
        "CHv4 share with 'chv4' alias at height=0 must be accepted. Reason: {}",
        result.reason
    );
}

/// Verify hash_value returned by ShareValidator matches expected CHv4 hash.
#[tokio::test]
async fn test_chv4_validator_returns_correct_hash() {
    let validator = ShareValidator::new("little");

    let blob_bytes = vec![0x99u8; 80];
    let nonce: u64 = 0x0000_7777;
    let expected_hash = cosmic_harmony_with_height(&blob_bytes, nonce, 0);
    let expected_hex = hex::encode(expected_hash.data);

    let share = SubmittedShare {
        job_id: "f04_hash_check".to_string(),
        nonce: format!("{:08x}", nonce as u32),
        result: Some(expected_hex.clone()),
        algorithm: "cosmic_harmony".to_string(),
        job_blob: hex::encode(&blob_bytes),
        job_target: "ffffffff".to_string(),
        block_target: None,
        height: Some(0),
    };

    let result = validator.validate_share(&share, "f04_hash_miner").await;
    assert!(result.valid, "Share must be valid. Reason: {}", result.reason);

    if let Some(hash_val) = &result.hash_value {
        assert_eq!(
            hash_val, &expected_hex,
            "Validator hash_value must match direct cosmic_harmony_with_height output"
        );
    }
}

// ── Group D: CHv4 from-genesis invariant ────────────────────────────────────

/// cosmic_harmony_with_height must return CHv4 (same as v4) for ALL heights,
/// because CHV4_NPU_FORK_HEIGHT = 0.
#[test]
fn test_chv4_active_for_all_heights() {
    let blob = [0x33u8; 80];
    let nonce: u64 = 0xABCD_EF01;

    let h_v4 = cosmic_harmony_v4(&blob, nonce);

    // Test multiple heights — all should equal v4 since fork_height=0
    for &height in &[0u64, 1, 100, 1_000, 10_000, 100_000, 200_000, 999_999] {
        let h = cosmic_harmony_with_height(&blob, nonce, height);
        assert_eq!(
            h.data, h_v4.data,
            "cosmic_harmony_with_height at height={} must equal cosmic_harmony_v4 \
             (CHV4_NPU_FORK_HEIGHT=0 means CHv4 always active)",
            height
        );
    }
}
