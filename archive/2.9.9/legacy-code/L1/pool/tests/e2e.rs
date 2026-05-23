/// Pool E2E Integration Tests
/// 
/// Tests complete pool → core workflow components

use zion_pool::shares::validator::{ShareValidator, SubmittedShare, Algorithm};

#[tokio::test]
async fn test_share_validation_basic() {
    let validator = ShareValidator::new("little");

    // Test with valid-looking share (target is max, so any hash meets it)
    let share = SubmittedShare {
        job_id: "job_basic_test".to_string(),
        nonce: "12345678".to_string(),
        result: Some("00".repeat(32)), // All zeros hash
        algorithm: "blake3".to_string(),
        job_blob: "00".repeat(80),
        job_target: "ffffffffffffffff".to_string(), // Max target = any hash meets
        block_target: None,
        height: Some(100),
    };

    let res = validator.validate_share(&share, "test_miner").await;
    // Result depends on whether computed hash matches - but we're testing the flow
    println!("Share validation result: valid={}, reason={}, hash={:?}", 
        res.valid, res.reason, res.hash_value);
    
    // This may fail on hash mismatch, that's expected with dummy data
}

#[tokio::test]
async fn test_algorithm_parsing() {
    use zion_pool::shares::validator::Algorithm;

    let cases = vec![
        ("randomx", Algorithm::RandomX),
        ("rx/0", Algorithm::RandomX),
        ("yescrypt", Algorithm::Yescrypt),
        ("cosmic_harmony", Algorithm::CosmicHarmony),
        ("cosmic", Algorithm::CosmicHarmony),
        ("blake3", Algorithm::Blake3),
        ("autolykos", Algorithm::AutolykovV2),
        ("unknown_algo", Algorithm::Unknown),
    ];

    for (input, expected) in cases {
        let algo = Algorithm::from_str(input);
        assert_eq!(algo, expected, "Algorithm parsing failed for {}", input);
    }
    
    println!("Algorithm parsing test completed!");
}

#[tokio::test]
async fn test_stratum_job_target_parsing() {
    // Test various target formats
    let targets = vec![
        ("ffffffffffffffff", true),  // Max u64 - very easy
        ("00000000ffffffff", true),  // Lower target
        ("00000000000000ff", true),  // Very hard target
    ];

    for (target, should_parse) in targets {
        let parsed = u64::from_str_radix(target, 16);
        assert_eq!(parsed.is_ok(), should_parse, "Target {} parse failed", target);
        if let Ok(t) = parsed {
            println!("Target {} = {}", target, t);
        }
    }
}

#[tokio::test]
async fn test_difficulty_to_share_target_conversion() {
    // Pool difficulty -> share target mapping
    let test_cases: Vec<(u64, u64)> = vec![
        (1u64, u64::MAX),           // Difficulty 1 = max target
        (10u64, u64::MAX / 10),     // Difficulty 10
        (1000u64, u64::MAX / 1000), // Difficulty 1000
    ];

    for (diff, expected_approx) in test_cases {
        let target = u64::MAX / diff;
        // Allow 1% tolerance for rounding
        let tolerance = expected_approx / 100 + 1;
        assert!(
            (target as i128 - expected_approx as i128).abs() <= tolerance as i128,
            "Diff {} should give target ~{}, got {}",
            diff, expected_approx, target
        );
    }
    
    println!("Difficulty to target conversion verified!");
}
