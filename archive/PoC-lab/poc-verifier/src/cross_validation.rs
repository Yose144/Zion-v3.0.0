//! Multi-backend cross-validation ("honest majority") — see
//! `PoC-lab/docs/ANALYSIS.md` §3.3, option 4: honest majority cross-validation
//! as the pragmatic prototype-stage NPU attestation strategy.
//!
//! Instead of trusting a single vendor NPU quote, we run the same
//! `(model_hash, input)` pair across multiple [`NpuBackend`] implementations
//! and require that at least `quorum` of them agree on the output before it
//! is accepted. Any backend that disagrees with the majority is flagged as
//! a potential fault (or dishonest report) for that round.

use poc_core::Hash;
use poc_npu::{NpuBackend, NpuError};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CrossValidationError {
    #[error("backend {backend} failed: {source}")]
    BackendFailed { backend: String, source: NpuError },
    #[error("no quorum reached: best agreement {best} < required {required}")]
    NoQuorum { best: usize, required: usize },
    #[error("no backends provided")]
    EmptyBackendSet,
}

/// Result of a cross-validation round.
#[derive(Debug, Clone)]
pub struct CrossValidationReport {
    /// The output accepted by majority agreement.
    pub accepted_output: Vec<u8>,
    /// Names of backends that agreed with the accepted output.
    pub agreeing_backends: Vec<String>,
    /// Names of backends that disagreed (potential fault / dishonesty).
    pub disagreeing_backends: Vec<String>,
}

/// Runs `(model_hash, input)` across all given backends and requires
/// `quorum` backends to agree on the exact same output bytes.
pub fn cross_validate(
    backends: &[Box<dyn NpuBackend>],
    model_hash: Hash,
    input: &[u8],
    quorum: usize,
) -> Result<CrossValidationReport, CrossValidationError> {
    if backends.is_empty() {
        return Err(CrossValidationError::EmptyBackendSet);
    }

    let mut groups: HashMap<Vec<u8>, Vec<String>> = HashMap::new();
    for backend in backends {
        let (output, _att) = backend
            .infer(model_hash, input)
            .map_err(|source| CrossValidationError::BackendFailed {
                backend: backend.name().to_string(),
                source,
            })?;
        groups.entry(output).or_default().push(backend.name().to_string());
    }

    let (best_output, best_group) = groups
        .into_iter()
        .max_by_key(|(_, names)| names.len())
        .expect("groups is non-empty because backends is non-empty");

    if best_group.len() < quorum {
        return Err(CrossValidationError::NoQuorum {
            best: best_group.len(),
            required: quorum,
        });
    }

    let all_names: Vec<String> = backends.iter().map(|b| b.name().to_string()).collect();
    let disagreeing = all_names
        .into_iter()
        .filter(|n| !best_group.contains(n))
        .collect();

    Ok(CrossValidationReport {
        accepted_output: best_output,
        agreeing_backends: best_group,
        disagreeing_backends: disagreeing,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use poc_core::NpuAttestation;
    use poc_npu::CpuReferenceBackend;

    /// A backend that always returns the same wrong output, to simulate a
    /// faulty / dishonest NPU implementation.
    struct FaultyBackend;

    impl NpuBackend for FaultyBackend {
        fn name(&self) -> &str {
            "faulty"
        }

        fn infer(&self, _model_hash: Hash, _input: &[u8]) -> Result<(Vec<u8>, NpuAttestation), NpuError> {
            Ok((
                vec![0xFF; 64],
                NpuAttestation {
                    backend: "faulty".into(),
                    quote_hash: [9u8; 32],
                    runtime_version: "0.0.0".into(),
                },
            ))
        }
    }

    fn make_backends() -> Vec<Box<dyn NpuBackend>> {
        vec![
            Box::new(CpuReferenceBackend::new()),
            Box::new(poc_npu::OnnxBackend::new()),
            Box::new(FaultyBackend),
        ]
    }

    #[test]
    fn majority_agrees_and_flags_faulty_backend() {
        let backends = make_backends();
        let report = cross_validate(&backends, [1u8; 32], b"input", 2).unwrap();
        assert_eq!(report.agreeing_backends.len(), 2);
        assert!(report.agreeing_backends.contains(&"cpu-reference".to_string()));
        assert!(report.agreeing_backends.contains(&"onnx".to_string()));
        assert_eq!(report.disagreeing_backends, vec!["faulty".to_string()]);
    }

    #[test]
    fn quorum_not_reached_returns_error() {
        let backends = make_backends();
        let err = cross_validate(&backends, [1u8; 32], b"input", 3).unwrap_err();
        match err {
            CrossValidationError::NoQuorum { best, required } => {
                assert_eq!(best, 2);
                assert_eq!(required, 3);
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[test]
    fn empty_backend_set_errors() {
        let backends: Vec<Box<dyn NpuBackend>> = vec![];
        assert!(matches!(
            cross_validate(&backends, [1u8; 32], b"input", 1),
            Err(CrossValidationError::EmptyBackendSet)
        ));
    }
}
