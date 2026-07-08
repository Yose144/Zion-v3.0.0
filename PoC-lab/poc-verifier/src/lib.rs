//! # poc-verifier
//!
//! Verifikace care proofů a výpočet care score.

pub mod cross_validation;

use poc_core::{CareProof, CareProofError, CareScoreComponents, CareTask, Hash, NpuAttestation};
use thiserror::Error;

/// Chyby při verifikaci care proofu.
#[derive(Debug, Error, PartialEq)]
pub enum VerificationError {
    #[error("structure validation failed: {0}")]
    Structure(#[from] CareProofError),
    #[error("model hash mismatch: expected {expected}, got {actual}")]
    ModelHashMismatch { expected: String, actual: String },
    #[error("NPU backend {0} is not in the allowlist")]
    BackendNotAllowed(String),
    #[error("care score below threshold: {0} < {1}")]
    ScoreTooLow(u64, u64),
    #[error("attestation quote verification failed")]
    AttestationFailed,
    #[error("task {0:?} is not eligible for this epoch")]
    TaskNotEligible(CareTask),
}

/// Konfigurace verifieru.
#[derive(Debug, Clone)]
pub struct VerifierConfig {
    /// Povolené NPU backendy.
    pub allowed_backends: Vec<String>,
    /// Minimální care score pro akceptaci proofu.
    pub min_care_score: u64,
    /// Očekávaný hash modelu pro tuto epochu.
    pub expected_model_hash: Hash,
}

impl Default for VerifierConfig {
    fn default() -> Self {
        Self {
            allowed_backends: vec![
                "cpu-reference".into(),
                "onnx".into(),
                "coreml".into(),
                "openvino".into(),
            ],
            min_care_score: 1_000_000,
            expected_model_hash: [0u8; 32],
        }
    }
}

/// Verifikátor care proofů.
pub struct CareVerifier {
    config: VerifierConfig,
}

impl CareVerifier {
    pub fn new(config: VerifierConfig) -> Self {
        Self { config }
    }

    /// Hlavní verifikační funkce.
    pub fn verify(&self, proof: &CareProof) -> Result<u64, VerificationError> {
        // 1. Strukturální validace.
        proof.validate_structure()?;

        // 2. Model hash musí odpovídat očekávanému.
        if proof.model_hash != self.config.expected_model_hash {
            return Err(VerificationError::ModelHashMismatch {
                expected: hex::encode(self.config.expected_model_hash),
                actual: hex::encode(proof.model_hash),
            });
        }

        // 3. Backend allowlist.
        if !self
            .config
            .allowed_backends
            .contains(&proof.npu_attestation.backend)
        {
            return Err(VerificationError::BackendNotAllowed(
                proof.npu_attestation.backend.clone(),
            ));
        }

        // 4. Attestation quote kontrola (stub).
        if !verify_attestation_quote(&proof.npu_attestation) {
            return Err(VerificationError::AttestationFailed);
        }

        // 5. Care score threshold.
        if proof.care_score < self.config.min_care_score {
            return Err(VerificationError::ScoreTooLow(
                proof.care_score,
                self.config.min_care_score,
            ));
        }

        Ok(proof.care_score)
    }

    /// Vypočítá care score z komponent a zkontroluje threshold.
    pub fn score_and_verify(
        &self,
        components: &CareScoreComponents,
    ) -> Result<u64, VerificationError> {
        let score = components.compute().map_err(VerificationError::Structure)?;
        if score < self.config.min_care_score {
            return Err(VerificationError::ScoreTooLow(score, self.config.min_care_score));
        }
        Ok(score)
    }
}

/// Stub verifikace attestation quote.
/// V produkci by ověřoval podpis vendor quote (CoreML / OpenVINO / TEE).
fn verify_attestation_quote(att: &NpuAttestation) -> bool {
    // Jednoduchá kontrola: quote hash nesmí být nulový a backend musí být neprázdný.
    att.quote_hash != [0u8; 32] && !att.backend.is_empty() && !att.runtime_version.is_empty()
}

/// Agreguje care score napříč sadou proofů.
pub struct ScoreAggregator;

impl ScoreAggregator {
    /// Vrací součet a průměrný care score.
    pub fn aggregate(proofs: &[CareProof]) -> Option<(u64, u64)> {
        if proofs.is_empty() {
            return None;
        }
        let total = proofs.iter().map(|p| p.care_score as u128).sum::<u128>();
        let avg = total / proofs.len() as u128;
        Some((total as u64, avg as u64))
    }

/// Vrací vážený agregát s důrazem na nejnovější epochu (zde pouze suma).
    pub fn weighted_by_recency(_proofs: &[CareProof]) -> u64 {
        // TODO: implementovat expirační váhy podle epochy.
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use poc_core::{CareProof, CareTask, NpuAttestation};

    fn make_proof(score: u64, backend: &str) -> CareProof {
        let mut proof = CareProof::new(
            [1u8; 32],
            CareTask::WarpBridgeAudit,
            [2u8; 32],
            [3u8; 32],
            vec![0x01],
            NpuAttestation {
                backend: backend.into(),
                quote_hash: [4u8; 32],
                runtime_version: "0.1.0".into(),
            },
        );
        proof.care_score = score;
        proof
    }

    #[test]
    fn verify_accepts_valid_proof() {
        let config = VerifierConfig {
            expected_model_hash: [2u8; 32],
            min_care_score: 1_000_000,
            allowed_backends: vec!["cpu-reference".into()],
        };
        let verifier = CareVerifier::new(config);
        let proof = make_proof(2_000_000, "cpu-reference");
        assert_eq!(verifier.verify(&proof).unwrap(), 2_000_000);
    }

    #[test]
    fn verify_rejects_low_score() {
        let config = VerifierConfig {
            expected_model_hash: [2u8; 32],
            min_care_score: 1_000_000,
            allowed_backends: vec!["cpu-reference".into()],
        };
        let verifier = CareVerifier::new(config);
        let proof = make_proof(500_000, "cpu-reference");
        assert_eq!(
            verifier.verify(&proof),
            Err(VerificationError::ScoreTooLow(500_000, 1_000_000))
        );
    }

    #[test]
    fn verify_rejects_bad_backend() {
        let config = VerifierConfig {
            expected_model_hash: [2u8; 32],
            min_care_score: 1_000_000,
            allowed_backends: vec!["cpu-reference".into()],
        };
        let verifier = CareVerifier::new(config);
        let proof = make_proof(2_000_000, "rogue-backend");
        assert_eq!(
            verifier.verify(&proof),
            Err(VerificationError::BackendNotAllowed("rogue-backend".into()))
        );
    }

    #[test]
    fn aggregate_computes_average() {
        let p1 = make_proof(1_000_000, "cpu-reference");
        let p2 = make_proof(3_000_000, "cpu-reference");
        assert_eq!(ScoreAggregator::aggregate(&[p1, p2]), Some((4_000_000, 2_000_000)));
    }
}
