use zion_pool::shares::validator::{ShareValidator, SubmittedShare};

#[tokio::test]
async fn validates_share_and_detects_duplicate() {
    let validator = ShareValidator::new("little");

    // Use a max target so any low hash meets difficulty.
    // For RandomX target check, `job_target` is parsed as u64 hex.
    let share = SubmittedShare {
        job_id: "job1".to_string(),
        nonce: "00000001".to_string(),
        result: Some("00".repeat(32)),
        algorithm: "randomx".to_string(),
        job_blob: "00".repeat(152),
        job_target: "ffffffffffffffff".to_string(),
        block_target: None,
        height: None,
    };

    let res1 = validator.validate_share(&share).await;
    assert!(res1.valid, "expected valid share, got: {}", res1.reason);

    let res2 = validator.validate_share(&share).await;
    assert!(!res2.valid);
    assert_eq!(res2.reason, "Duplicate share");
}

