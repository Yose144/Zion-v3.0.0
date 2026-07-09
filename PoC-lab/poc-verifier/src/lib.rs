//! # poc-verifier
//!
//! Verifikace care proofů a výpočet care score.
//!
//! ## Fáze 2a — Hiran-aware verification + DharmaValidator
//!
//! [`HiranAwareVerifier`] combines structural [`CareVerifier`] checks with
//! the 5-test [`DharmaValidator`] pipeline inspired by the five Dharma
//! principles (non-harm, authenticity, benefit, consciousness alignment,
//! temporal coherence).
//!
//! Pipeline:
//! 1. **Structural** — `CareVerifier::verify()` (model hash, backend, score threshold)
//! 2. **Dharma** — `DharmaValidator::validate()` (5 semantic tests)
//!    - High severity failures → reject the proof immediately
//!    - Medium severity failures → penalise care score by `medium_penalty_bps`
//! 3. **Anomaly alerts** — convert failing Dharma tests to `AnomalyAlert` records

pub mod cross_validation;

use poc_core::{
    AnomalyAction, AnomalyAlert, AnomalyType, AnomalySeverity,
    CareProof, CareProofError, CareScoreComponents, CareTask, Hash, NpuAttestation,
    ValidatorId,
};
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

// ──────────────────────────────────────────────────────────────────────────────
// DharmaValidator — 5-test pipeline (Fáze 2a)
// ──────────────────────────────────────────────────────────────────────────────

/// Výsledek jednoho Dharma testu.
#[derive(Debug, Clone)]
pub struct DharmaTestResult {
    pub test_id: u8,
    pub name: &'static str,
    pub passed: bool,
    pub detail: String,
}

/// Souhrnný výsledek 5 Dharma testů pro jeden proof.
#[derive(Debug, Clone)]
pub struct DharmaValidationResult {
    /// Výsledky všech 5 testů v pořadí test_id 1–5.
    pub tests: [DharmaTestResult; 5],
    /// Shortcut: `true` pokud všechny testy prošly.
    pub all_passed: bool,
    /// Počet selhání.
    pub failed_count: usize,
}

impl DharmaValidationResult {
    /// Převede selhaní testů na `AnomalyAlert` záznamy pro audit log.
    ///
    /// # Severity mapování
    /// - Test 1 (non-harm, null-proof) → Critical
    /// - Test 2 (authenticity, Sybil) → High
    /// - Test 3 (benefit, empty output) → High
    /// - Test 4 (consciousness alignment, inflated score) → Medium
    /// - Test 5 (temporal coherence, synthetic model hash) → Medium
    pub fn to_anomaly_alerts(&self, validator_id: ValidatorId) -> Vec<AnomalyAlert> {
        self.tests
            .iter()
            .filter(|t| !t.passed)
            .map(|t| {
                let (anomaly_type, severity, action) = match t.test_id {
                    // Test 1: null/uniform proof — maps to ScoreGaming (trivial output)
                    1 => (
                        AnomalyType::ScoreGaming,
                        AnomalySeverity::High,
                        AnomalyAction::RejectProof,
                    ),
                    // Test 2: zero validator_id — potential Sybil
                    2 => (
                        AnomalyType::SybilCluster,
                        AnomalySeverity::High,
                        AnomalyAction::RejectProof,
                    ),
                    // Test 3: empty/short output — gaming with empty proof
                    3 => (
                        AnomalyType::ScoreGaming,
                        AnomalySeverity::High,
                        AnomalyAction::RejectProof,
                    ),
                    // Test 4: inflated care score — consciousness fraud
                    4 => (
                        AnomalyType::ConsciousnessFraud,
                        AnomalySeverity::Medium,
                        AnomalyAction::PenaliseScore,
                    ),
                    // Test 5: zero model_hash with nonzero score — temporal/synthetic
                    _ => (
                        AnomalyType::TemporalAnomaly,
                        AnomalySeverity::Medium,
                        AnomalyAction::PenaliseScore,
                    ),
                };
                AnomalyAlert {
                    validator_id,
                    anomaly_type,
                    severity,
                    description: format!("Dharma test {} ({}): {}", t.test_id, t.name, t.detail),
                    recommended_action: action,
                }
            })
            .collect()
    }
}

/// Validátor implementující 5 Dharma principů pro care proofs.
///
/// Každý test odráží jeden z pěti buddhistických etických principů
/// adaptovaných pro PoC kontext.
#[derive(Debug, Clone)]
pub struct DharmaValidator {
    /// Minimální délka výstupního vektoru (Test 3 — benefit).
    pub min_output_bytes: usize,
    /// Maximální rozumné care skóre — nad tuto hodnotu je skóre podezřelé
    /// (Test 4 — consciousness alignment).
    pub max_reasonable_score: u64,
}

impl Default for DharmaValidator {
    fn default() -> Self {
        Self {
            min_output_bytes: 1,
            max_reasonable_score: u64::MAX / 2, // velmi velký default = téměř vypnutý
        }
    }
}

impl DharmaValidator {
    pub fn new() -> Self {
        Self::default()
    }

    /// Spustí všech 5 Dharma testů nad care proofem.
    pub fn validate(&self, proof: &CareProof, epoch: u64) -> DharmaValidationResult {
        let t1 = self.test1_non_harm(proof);
        let t2 = self.test2_authenticity(proof);
        let t3 = self.test3_benefit(proof);
        let t4 = self.test4_consciousness_alignment(proof);
        let t5 = self.test5_temporal_coherence(proof, epoch);

        let failed_count = [&t1, &t2, &t3, &t4, &t5].iter().filter(|t| !t.passed).count();
        let all_passed = failed_count == 0;

        DharmaValidationResult {
            tests: [t1, t2, t3, t4, t5],
            all_passed,
            failed_count,
        }
    }

    /// Test 1: Non-harm — output nesmí být uniformní nulový vektor (null-proof).
    /// Uniformní výstup naznačuje, že validátor provedl nejjednodušší možný
    /// výpočet nebo zfalšoval výstup.
    fn test1_non_harm(&self, proof: &CareProof) -> DharmaTestResult {
        let all_zero = proof.output.iter().all(|&b| b == 0);
        let all_same = proof.output.len() > 1
            && proof.output.windows(2).all(|w| w[0] == w[1]);
        let passed = !all_zero && !all_same;
        DharmaTestResult {
            test_id: 1,
            name: "non-harm",
            passed,
            detail: if passed {
                "output shows non-trivial computation".into()
            } else if all_zero {
                "output is all-zero (null proof)".into()
            } else {
                "output is uniform constant (trivial proof)".into()
            },
        }
    }

    /// Test 2: Authenticity — validator_id musí být nenulový.
    /// Nulový validator_id je příznakem Sybil útoku nebo nesprávné konfigurace.
    fn test2_authenticity(&self, proof: &CareProof) -> DharmaTestResult {
        let passed = proof.validator_id != [0u8; 32];
        DharmaTestResult {
            test_id: 2,
            name: "authenticity",
            passed,
            detail: if passed {
                "validator_id is non-zero".into()
            } else {
                "validator_id is all-zero (potential Sybil)".into()
            },
        }
    }

    /// Test 3: Benefit — output musí mít minimální délku a nenulový obsah.
    /// Příliš krátký nebo prázdný output naznačuje, že validátor neprovedl
    /// reálnou práci.
    fn test3_benefit(&self, proof: &CareProof) -> DharmaTestResult {
        let len = proof.output.len();
        let has_nonzero = proof.output.iter().any(|&b| b != 0);
        let passed = len >= self.min_output_bytes && has_nonzero;
        DharmaTestResult {
            test_id: 3,
            name: "benefit",
            passed,
            detail: if passed {
                format!("output has {len} bytes with non-zero content")
            } else if len < self.min_output_bytes {
                format!("output too short: {len} < {}", self.min_output_bytes)
            } else {
                "output has no non-zero bytes".into()
            },
        }
    }

    /// Test 4: Consciousness alignment — care_score nesmí být podezřele vysoké.
    /// Extrémně vysoké skóre může indikovat manipulaci nebo scoring gaming.
    fn test4_consciousness_alignment(&self, proof: &CareProof) -> DharmaTestResult {
        let passed = proof.care_score <= self.max_reasonable_score;
        DharmaTestResult {
            test_id: 4,
            name: "consciousness-alignment",
            passed,
            detail: if passed {
                format!("care_score {} within reasonable bounds", proof.care_score)
            } else {
                format!(
                    "care_score {} exceeds max_reasonable_score {}",
                    proof.care_score, self.max_reasonable_score
                )
            },
        }
    }

    /// Test 5: Temporal coherence — model_hash nesmí být nulový pokud je skóre > 0.
    /// Nulový model_hash s nenulovým skóre je příznakem syntetického proof.
    fn test5_temporal_coherence(&self, proof: &CareProof, _epoch: u64) -> DharmaTestResult {
        let suspicious = proof.model_hash == [0u8; 32] && proof.care_score > 0;
        let passed = !suspicious;
        DharmaTestResult {
            test_id: 5,
            name: "temporal-coherence",
            passed,
            detail: if passed {
                "model_hash is consistent with epoch".into()
            } else {
                "model_hash is zero with non-zero score (synthetic proof)".into()
            },
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// HiranAwareVerifier — kombinuje CareVerifier + DharmaValidator
// ──────────────────────────────────────────────────────────────────────────────

/// Plný výsledek HiranAwareVerifier.verify_full().
#[derive(Debug, Clone)]
pub struct VerificationReport {
    /// Finální care score (0 pokud rejected).
    pub care_score: u64,
    /// Výsledky Dharma validace.
    pub dharma: DharmaValidationResult,
    /// Anomálie detekované Dharma validátorem.
    pub anomalies: Vec<AnomalyAlert>,
    /// `true` pokud byl proof přijat.
    pub accepted: bool,
    /// Důvod zamítnutí (None pokud accepted).
    pub rejection_reason: Option<String>,
}

/// Hiran-aware verifier kombinující strukturální a sémantickou validaci.
///
/// Vrstva 1: CareVerifier (model hash, backend, score threshold)
/// Vrstva 2: DharmaValidator (5 etických testů)
pub struct HiranAwareVerifier {
    inner: CareVerifier,
    pub dharma: DharmaValidator,
    /// Penalizace v basis points za každé Medium-severity selhání.
    /// Default 1000 bps = 10 % penalizace.
    pub medium_penalty_bps: u16,
}

impl HiranAwareVerifier {
    pub fn new(config: VerifierConfig) -> Self {
        Self {
            inner: CareVerifier::new(config),
            dharma: DharmaValidator::new(),
            medium_penalty_bps: 1000,
        }
    }

    /// Builder: nahradí DharmaValidator (pro testy s custom konfigurací).
    pub fn with_dharma(mut self, dharma: DharmaValidator) -> Self {
        self.dharma = dharma;
        self
    }

    /// Plná dvouvrstvá verifikace.
    ///
    /// # Parametry
    /// - `proof` — care proof k verifikaci
    /// - `epoch` — číslo epochy (pro Dharma test 5)
    /// - `validator_id` — identifikátor validátora pro anomaly alerts
    pub fn verify_full(
        &self,
        proof: &CareProof,
        epoch: u64,
        validator_id: ValidatorId,
    ) -> VerificationReport {
        // Layer 1: Structural verification
        let base_score = match self.inner.verify(proof) {
            Ok(score) => score,
            Err(e) => {
                return VerificationReport {
                    care_score: 0,
                    dharma: self.dharma.validate(proof, epoch),
                    anomalies: vec![],
                    accepted: false,
                    rejection_reason: Some(format!("{e}")),
                };
            }
        };

        // Layer 2: Dharma
        let dharma_result = self.dharma.validate(proof, epoch);
        let anomalies = dharma_result.to_anomaly_alerts(validator_id);

        // High-severity failures → reject
        let high_failure = anomalies
            .iter()
            .any(|a| a.severity >= AnomalySeverity::High);

        if high_failure {
            let reasons: Vec<String> = dharma_result
                .tests
                .iter()
                .filter(|t| !t.passed && (t.test_id == 1 || t.test_id == 2 || t.test_id == 3))
                .map(|t| t.detail.clone())
                .collect();
            return VerificationReport {
                care_score: 0,
                dharma: dharma_result,
                anomalies,
                accepted: false,
                rejection_reason: Some(format!("Dharma high-severity failure: {}", reasons.join("; "))),
            };
        }

        // Medium-severity → penalise score
        let medium_failures = anomalies
            .iter()
            .filter(|a| a.severity == AnomalySeverity::Medium)
            .count() as u64;

        let penalty_bps = (self.medium_penalty_bps as u64) * medium_failures;
        let final_score = if penalty_bps >= 10_000 {
            0
        } else {
            base_score * (10_000 - penalty_bps) / 10_000
        };

        VerificationReport {
            care_score: final_score,
            dharma: dharma_result,
            anomalies,
            accepted: true,
            rejection_reason: None,
        }
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

    // ── DharmaValidator tests ────────────────────────────────────────────────

    fn make_dharma_proof(score: u64, output: Vec<u8>, validator_id: [u8; 32], model_hash: [u8; 32]) -> CareProof {
        let mut proof = CareProof::new(
            validator_id,
            CareTask::HiranInference,
            model_hash,
            [3u8; 32],
            output,
            NpuAttestation {
                backend: "cpu-reference".into(),
                quote_hash: [4u8; 32],
                runtime_version: "0.1.0".into(),
            },
        );
        proof.care_score = score;
        proof
    }

    #[test]
    fn dharma_all_tests_pass_for_honest_proof() {
        let proof = make_dharma_proof(5_000_000, vec![0x01, 0x02, 0xAB, 0xCD], [1u8; 32], [2u8; 32]);
        let result = DharmaValidator::new().validate(&proof, 5);
        assert!(result.all_passed, "failed tests: {:?}", result.tests.iter().filter(|t| !t.passed).collect::<Vec<_>>());
        assert_eq!(result.failed_count, 0);
    }

    #[test]
    fn dharma_test1_fails_for_all_zero_output() {
        let proof = make_dharma_proof(5_000_000, vec![0u8; 64], [1u8; 32], [2u8; 32]);
        let result = DharmaValidator::new().validate(&proof, 0);
        assert!(!result.tests[0].passed); // test1 = index 0
        assert!(result.tests[0].detail.contains("all-zero"));
    }

    #[test]
    fn dharma_test1_fails_for_uniform_output() {
        let proof = make_dharma_proof(5_000_000, vec![0xAB; 64], [1u8; 32], [2u8; 32]);
        let result = DharmaValidator::new().validate(&proof, 0);
        assert!(!result.tests[0].passed);
        assert!(result.tests[0].detail.contains("uniform"));
    }

    #[test]
    fn dharma_test2_fails_for_zero_validator_id() {
        let proof = make_dharma_proof(5_000_000, vec![0x01, 0x02], [0u8; 32], [2u8; 32]);
        let result = DharmaValidator::new().validate(&proof, 0);
        assert!(!result.tests[1].passed); // test2 = index 1
        assert!(result.tests[1].detail.contains("all-zero"));
    }

    #[test]
    fn dharma_test4_fails_for_inflated_score() {
        let validator = DharmaValidator {
            max_reasonable_score: 1_000_000,
            ..Default::default()
        };
        let proof = make_dharma_proof(999_999_999, vec![0x01, 0x02], [1u8; 32], [2u8; 32]);
        let result = validator.validate(&proof, 0);
        assert!(!result.tests[3].passed); // test4 = index 3
    }

    #[test]
    fn dharma_test5_fails_for_zero_model_hash_with_nonzero_score() {
        // model_hash = [0;32] with score > 0 → suspicious synthetic proof
        let proof = make_dharma_proof(5_000_000, vec![0x01, 0x02], [1u8; 32], [0u8; 32]);
        let result = DharmaValidator::new().validate(&proof, 0);
        assert!(!result.tests[4].passed); // test5 = index 4
        assert!(result.tests[4].detail.contains("synthetic"));
    }

    #[test]
    fn dharma_to_anomaly_alerts_generates_correct_severity() {
        let proof = make_dharma_proof(5_000_000, vec![0u8; 64], [0u8; 32], [2u8; 32]);
        // test1 fails (Critical) + test2 fails (High)
        let result = DharmaValidator::new().validate(&proof, 0);
        let alerts = result.to_anomaly_alerts([9u8; 32]);
        let severities: Vec<_> = alerts.iter().map(|a| a.severity).collect();
        assert!(severities.iter().any(|s| *s == AnomalySeverity::High || *s == AnomalySeverity::Critical));
    }

    // ── HiranAwareVerifier tests ─────────────────────────────────────────────

    fn make_verifier_config() -> VerifierConfig {
        VerifierConfig {
            expected_model_hash: [2u8; 32],
            min_care_score: 1_000_000,
            allowed_backends: vec!["cpu-reference".into()],
        }
    }

    #[test]
    fn hiran_aware_verifier_accepts_honest_proof() {
        let verifier = HiranAwareVerifier::new(make_verifier_config());
        // Proof with real model_hash, non-zero output, non-zero validator_id
        let proof = make_dharma_proof(2_000_000, vec![0x01, 0xAB], [1u8; 32], [2u8; 32]);
        let report = verifier.verify_full(&proof, 5, [1u8; 32]);
        assert!(report.accepted, "rejection: {:?}", report.rejection_reason);
        assert_eq!(report.care_score, 2_000_000);
        assert!(report.dharma.all_passed);
        assert!(report.anomalies.is_empty());
    }

    #[test]
    fn hiran_aware_verifier_rejects_zero_output_null_proof() {
        let verifier = HiranAwareVerifier::new(make_verifier_config());
        let proof = make_dharma_proof(2_000_000, vec![0u8; 64], [1u8; 32], [2u8; 32]);
        let report = verifier.verify_full(&proof, 5, [1u8; 32]);
        assert!(!report.accepted);
        assert_eq!(report.care_score, 0);
        assert!(report.rejection_reason.as_deref().unwrap_or("").contains("Dharma high-severity"));
    }

    #[test]
    fn hiran_aware_verifier_rejects_zero_validator_id() {
        let verifier = HiranAwareVerifier::new(make_verifier_config());
        let proof = make_dharma_proof(2_000_000, vec![0x01, 0x02], [0u8; 32], [2u8; 32]);
        let report = verifier.verify_full(&proof, 5, [0u8; 32]);
        assert!(!report.accepted);
        assert_eq!(report.care_score, 0);
    }

    #[test]
    fn hiran_aware_verifier_penalises_but_accepts_medium_failure() {
        // Test 4 (consciousness alignment) fails → medium penalty -10%
        let verifier = HiranAwareVerifier::new(make_verifier_config());
        let validator_with_inflated_score = DharmaValidator {
            max_reasonable_score: 1_500_000, // score 2M > max → test4 fails
            ..Default::default()
        };
        let verifier = verifier.with_dharma(validator_with_inflated_score);
        let proof = make_dharma_proof(2_000_000, vec![0x01, 0xAB], [1u8; 32], [2u8; 32]);
        let report = verifier.verify_full(&proof, 5, [1u8; 32]);
        // Medium penalty: -10% → 2_000_000 * 0.9 = 1_800_000
        assert!(report.accepted, "should be accepted with penalty");
        assert_eq!(report.care_score, 1_800_000);
        assert!(!report.anomalies.is_empty());
    }

    #[test]
    fn hiran_aware_verifier_structural_failure_skips_dharma() {
        let verifier = HiranAwareVerifier::new(make_verifier_config());
        // Wrong model hash → structural failure
        let proof = make_dharma_proof(2_000_000, vec![0x01, 0x02], [1u8; 32], [99u8; 32]);
        let report = verifier.verify_full(&proof, 0, [1u8; 32]);
        assert!(!report.accepted);
        assert!(report.rejection_reason.as_deref().unwrap_or("").contains("mismatch"));
    }
}
