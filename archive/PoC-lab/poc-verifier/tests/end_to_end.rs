//! End-to-end test celého PoC flow:
//!
//! 1. Vygenerovat epoch seed a model hash (RandomNPU).
//! 2. Přiřadit care task validátorovi.
//! 3. Spustit inference přes CPU backend.
//! 4. Vypočítat care score.
//! 5. Zabalit do CareProof a verifikovat.

use poc_core::CareScoreComponents;
use poc_npu::{CpuReferenceBackend, NpuBackend, RandomNpuGenerator};
use poc_tasks::{DummyExecutor, TaskAssigner, TaskOutput, TaskRegistry};
use poc_verifier::{CareVerifier, VerifierConfig};

#[test]
fn end_to_end_care_proof_flow() {
    // 1. Epoch setup.
    let seed = [42u8; 32];
    let epoch = 7u64;
    let validator = [123u8; 32];
    let model_hash = RandomNpuGenerator::model_hash_for_epoch(seed, epoch);

    // 2. Assign tasks.
    let registry = TaskRegistry::default();
    let assigner = TaskAssigner::default();
    let tasks = assigner.assign(validator, epoch, registry.all());
    assert!(!tasks.is_empty());

    // 3. Execute first task using CPU reference NPU.
    let task = &tasks[0];
    let backend = CpuReferenceBackend::new();
    let (output, att) = backend.infer(model_hash, &task.input_hash).unwrap();
    assert_eq!(output.len(), 64);

    // 4. Wrap into CareProof with a dummy score for the structural test.
    let executor = DummyExecutor;
    let task_output = TaskOutput {
        bytes: output,
        summary: "cpu-reference inference".into(),
    };
    let mut proof = executor.into_proof(validator, task, task_output, model_hash);
    proof.npu_attestation = att;

    // 5. Compute care score.
    let score_components = CareScoreComponents {
        accuracy_bps: 9000,
        timeliness_bps: 8000,
        coverage_bps: 7000,
    };
    proof.care_score = score_components.compute().unwrap();
    assert!(proof.care_score >= 8_000_000);

    // 6. Verify.
    let config = VerifierConfig {
        expected_model_hash: model_hash,
        min_care_score: 1_000_000,
        allowed_backends: vec!["cpu-reference".into()],
    };
    let verifier = CareVerifier::new(config);
    let accepted_score = verifier.verify(&proof).unwrap();
    assert_eq!(accepted_score, proof.care_score);

    // Sanity: task is a known sefirot care task category.
    let _ = task.task.sefira_name();
}
