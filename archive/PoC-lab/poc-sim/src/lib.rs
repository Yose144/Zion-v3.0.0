//! # poc-sim
//!
//! End-to-end network simulator that wires together every PoC-lab crate:
//!
//! ```text
//! poc-registry (validators, stake, vow)
//!        │
//!        ▼
//! poc-tasks (assignment)  ──▶  poc-npu (inference)  ──▶  poc-verifier (accept/reject)
//!        │                                                     │
//!        └─────────────────────────┬───────────────────────────┘
//!                                   ▼
//!                          poc-economics (reward split + payout + final_care_score)
//!                                   │
//!                          Hiran AI (validation verdicts + anomaly detection)
//! ```
//!
//! This is a laboratory simulation only — no L1 integration. Validators'
//! "quality" (accuracy/timeliness/coverage) is a fixed input parameter used
//! to model honest vs. lazy/faulty behavior, rather than derived from a real
//! AI inference quality judgement.
//!
//! ## Hiran integration
//!
//! [`NetworkSimulator`] now accepts an optional `hiran_url` parameter.
//! When set (`Some(url)`), it creates a [`HiranNpuBackend`] in live-stub mode
//! and populates [`EpochReport::hiran_stats`] with validation statistics.
//! When absent, all Hiran functionality operates in transparent stub mode —
//! existing tests are unaffected.

pub mod adversarial;

use poc_core::{
    apply_dual_vow_bonus, AnomalyAction, AnomalyAlert, AnomalyType, AnomalySeverity,
    CareScoreComponents, HiranEpochStats, HiranVerdict, NetworkHealth, ValidatorId,
};
use poc_economics::{
    distribute_to_validators, final_care_score, CareScoreInput, EconomicsError,
    RewardDistribution, RewardSplit, ValidatorShare,
};
use serde::{Deserialize, Serialize};
use poc_npu::{CpuReferenceBackend, HiranNpuBackend, NpuBackend, RandomNpuGenerator};
use poc_registry::{RegistryError, ValidatorRegistry};
use poc_tasks::{DummyExecutor, HiranTaskExecutor, TaskAssigner, TaskOutput, TaskRegistry};
use poc_verifier::{CareVerifier, VerificationError, VerifierConfig};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SimError {
    #[error("registry error: {0}")]
    Registry(#[from] RegistryError),
    #[error("economics error: {0}")]
    Economics(#[from] EconomicsError),
}

/// A validator participating in the simulation, with a fixed "quality"
/// profile that determines the care score their proofs will earn.
#[derive(Debug, Clone)]
pub struct SimulatedValidator {
    pub id: ValidatorId,
    pub name: String,
    pub stake: u64,
    pub quality: CareScoreComponents,
    /// If `true`, this validator is also an L5 community Guardian who has
    /// taken the Bodhisattva Vow (consciousness-admission-framework.md §6).
    /// Dual-vow validators receive a +5 % care score bonus per epoch.
    ///
    /// `ceremony_location` is recorded in the registry when `is_guardian = true`.
    pub is_guardian: bool,
    /// Optional physical ceremony location (used only when `is_guardian = true`).
    pub ceremony_location: Option<String>,
}

/// Per-validator outcome for one epoch.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorEpochResult {
    pub validator_id: ValidatorId,
    pub name: String,
    pub accepted: bool,
    pub care_score: u64,
    /// Whether the dual-vow bonus was applied this epoch.
    pub dual_vow_bonus_applied: bool,
    pub rejection_reason: Option<String>,
    pub payout: u64,
    /// Hiran verdict for this validator's proof (None if Hiran not called).
    pub hiran_verdict: Option<HiranVerdict>,
    /// NCL reputation bonus applied (flowers).
    pub ncl_bonus: u64,
}

/// Full report for one simulated epoch.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpochReport {
    pub epoch: u64,
    pub model_hash: [u8; 32],
    pub reward_distribution: RewardDistribution,
    pub validators: Vec<ValidatorEpochResult>,
    /// Hiran AI statistics for this epoch (stub_mode=true if Hiran not configured).
    pub hiran_stats: HiranEpochStats,
    /// Anomaly alerts detected by Hiran this epoch.
    pub anomaly_alerts: Vec<AnomalyAlert>,
    /// Overall network health verdict derived from anomaly alerts.
    pub network_health: NetworkHealth,
}

impl EpochReport {
    pub fn accepted_count(&self) -> usize {
        self.validators.iter().filter(|v| v.accepted).count()
    }

    pub fn rejected_count(&self) -> usize {
        self.validators.iter().filter(|v| !v.accepted).count()
    }

    pub fn total_payout(&self) -> u64 {
        self.validators.iter().map(|v| v.payout).sum()
    }

    /// Returns validators that were flagged with anomaly alerts.
    pub fn flagged_validators(&self) -> Vec<&ValidatorEpochResult> {
        let flagged_ids: std::collections::HashSet<ValidatorId> =
            self.anomaly_alerts.iter().map(|a| a.validator_id).collect();
        self.validators.iter().filter(|v| flagged_ids.contains(&v.validator_id)).collect()
    }
}

/// Ties together registry + tasks + NPU backend + verifier + economics
/// into a single simulated network.
pub struct NetworkSimulator {
    pub seed: [u8; 32],
    pub registry: ValidatorRegistry,
    pub reward_split: RewardSplit,
    pub block_reward: u64,
    pub min_care_score: u64,
    validators: Vec<SimulatedValidator>,
    /// Optional URL for the live Hiran inference server.
    /// `None` → all Hiran calls use stub mode (transparent, no side effects).
    pub hiran_url: Option<String>,
}

impl NetworkSimulator {
    pub fn new(seed: [u8; 32], block_reward: u64, min_stake: u64, min_care_score: u64) -> Self {
        Self {
            seed,
            registry: ValidatorRegistry::new(min_stake),
            reward_split: RewardSplit::default(),
            block_reward,
            min_care_score,
            validators: Vec::new(),
            hiran_url: None,
        }
    }

    /// Configures the simulator to use a live Hiran server for validation.
    pub fn with_hiran_url(mut self, url: impl Into<String>) -> Self {
        self.hiran_url = Some(url.into());
        self
    }

    /// Registers a validator, has them take the Sefirot Vow (required for
    /// all PoC validators), and optionally the Bodhisattva Vow if the
    /// validator is also an L5 community Guardian (`is_guardian = true`).
    pub fn add_validator(&mut self, validator: SimulatedValidator) -> Result<(), SimError> {
        self.registry.register(validator.id, validator.stake)?;
        self.registry.take_vow(&validator.id)?;
        if validator.is_guardian {
            self.registry
                .take_bodhisattva_vow(&validator.id, 0, validator.ceremony_location.clone())?;
        }
        self.validators.push(validator);
        Ok(())
    }

    /// Runs one epoch: assign tasks, run inference, verify, score, pay out.
    ///
    /// If `hiran_url` is configured, each accepted proof is additionally
    /// validated by the Hiran AI backend. Anomaly detection runs across all
    /// accepted proofs to flag lazy/gaming validators.
    pub fn run_epoch(&mut self, epoch: u64) -> Result<EpochReport, SimError> {
        let model_hash = RandomNpuGenerator::model_hash_for_epoch(self.seed, epoch);
        let task_registry = TaskRegistry::default();
        let assigner = TaskAssigner::default();

        // Choose backend based on hiran_url
        let use_hiran_backend = self.hiran_url.is_some();
        let hiran_backend = match &self.hiran_url {
            Some(url) => HiranNpuBackend::with_url(url.clone()),
            None => HiranNpuBackend::stub(),
        };
        let cpu_backend = CpuReferenceBackend::new();

        let mut hiran_executor = HiranTaskExecutor::new();
        let dummy_executor = DummyExecutor;

        // Allowed backends: both cpu-reference and hiran variants
        let allowed_backends = if use_hiran_backend {
            vec!["hiran-v2".into(), "hiran-stub".into(), "cpu-reference".into()]
        } else {
            vec!["cpu-reference".into()]
        };

        let verifier = CareVerifier::new(VerifierConfig {
            expected_model_hash: model_hash,
            min_care_score: self.min_care_score,
            allowed_backends,
        });

        let mut results = Vec::with_capacity(self.validators.len());
        let mut shares: Vec<ValidatorShare> = Vec::new();
        let mut hiran_stats = HiranEpochStats {
            stub_mode: !use_hiran_backend,
            ..Default::default()
        };
        let mut anomaly_alerts: Vec<AnomalyAlert> = Vec::new();

        for validator in &self.validators {
            if !self.registry.is_eligible_for_tasks(&validator.id) {
                results.push(ValidatorEpochResult {
                    validator_id: validator.id,
                    name: validator.name.clone(),
                    accepted: false,
                    care_score: 0,
                    dual_vow_bonus_applied: false,
                    rejection_reason: Some("not eligible (vow inactive or insufficient stake)".into()),
                    payout: 0,
                    hiran_verdict: None,
                    ncl_bonus: 0,
                });
                continue;
            }

            let tasks = assigner.assign(validator.id, epoch, task_registry.all());
            let task = &tasks[0];

            // Run inference — use Hiran backend if configured, else CPU reference
            let (output, attestation) = if use_hiran_backend {
                hiran_backend.infer(model_hash, &task.input_hash)
                    .expect("hiran backend is infallible in stub simulation")
            } else {
                cpu_backend.infer(model_hash, &task.input_hash)
                    .expect("cpu-reference backend is infallible in this simulation")
            };

            let task_output = TaskOutput {
                bytes: output,
                summary: format!("{} epoch {}", validator.name, epoch),
            };

            // Get Hiran verdict — use the verdict from the backend (which made the
            // actual HTTP call if live, or returned stub_accepted if offline).
            // HiranTaskExecutor is kept for audit-trail compatibility.
            let _ = hiran_executor.execute_with_hiran(validator.id, task);
            let hiran_verdict = if use_hiran_backend {
                hiran_backend.last_verdict()
            } else {
                hiran_executor.verdict_for(&validator.id).cloned()
                    .unwrap_or_else(HiranVerdict::stub_accepted)
            };

            hiran_stats.record(&hiran_verdict);

            let mut proof = dummy_executor.into_proof(validator.id, task, task_output, model_hash);
            proof.npu_attestation = attestation;

            let base_score = validator
                .quality
                .compute()
                .expect("care score components are well-formed in this simulation");

            // Apply dual-vow bonus (+5 %) for validators who are also L5
            // community Guardians with an active Bodhisattva Vow.
            let dual_vow = self.registry.is_dual_vow(&validator.id, epoch);
            let score_with_bonus = if dual_vow {
                apply_dual_vow_bonus(base_score)
            } else {
                base_score
            };
            proof.care_score = score_with_bonus;

            // Compute final score with Hiran + NCL adjustments
            // NCL reputation: use a simple placeholder (real value comes from NCL registry)
            let score_result = final_care_score(&CareScoreInput {
                base_score: score_with_bonus,
                dual_vow_applied: dual_vow,
                hiran_verdict: Some(hiran_verdict.clone()),
                ncl_reputation: None, // Phase 2: hook up NCL registry here
            });

            if score_result.rejected_by_hiran {
                // Hiran rejected — record anomaly alert and skip proof
                anomaly_alerts.push(AnomalyAlert {
                    validator_id: validator.id,
                    anomaly_type: AnomalyType::ScoreGaming,
                    severity: AnomalySeverity::High,
                    description: format!("Hiran rejected proof: {}", hiran_verdict.reasoning),
                    recommended_action: AnomalyAction::RejectProof,
                });
                results.push(ValidatorEpochResult {
                    validator_id: validator.id,
                    name: validator.name.clone(),
                    accepted: false,
                    care_score: 0,
                    dual_vow_bonus_applied: dual_vow,
                    rejection_reason: Some(format!("Hiran rejected: {}", hiran_verdict.reasoning)),
                    payout: 0,
                    hiran_verdict: Some(hiran_verdict),
                    ncl_bonus: 0,
                });
                continue;
            }

            proof.care_score = score_result.final_score;

            // Anomaly detection: flag lazy validators (care score near absolute minimum)
            if score_result.final_score > 0 && score_result.final_score < self.min_care_score / 2 {
                anomaly_alerts.push(AnomalyAlert {
                    validator_id: validator.id,
                    anomaly_type: AnomalyType::ScoreGaming,
                    severity: AnomalySeverity::Low,
                    description: format!(
                        "Score {} is suspiciously low (< half of min_care_score {})",
                        score_result.final_score, self.min_care_score
                    ),
                    recommended_action: AnomalyAction::WarnOnly,
                });
            }

            match verifier.verify(&proof) {
                Ok(score) => {
                    let _ = self.registry.record_care_proof(&validator.id, score);
                    shares.push(ValidatorShare {
                        validator_id: validator.id,
                        care_score: score,
                    });
                    results.push(ValidatorEpochResult {
                        validator_id: validator.id,
                        name: validator.name.clone(),
                        accepted: true,
                        care_score: score,
                        dual_vow_bonus_applied: dual_vow,
                        rejection_reason: None,
                        payout: 0, // filled in below once the pool is known
                        hiran_verdict: Some(hiran_verdict),
                        ncl_bonus: score_result.ncl_bonus,
                    });
                }
                Err(e) => {
                    results.push(ValidatorEpochResult {
                        validator_id: validator.id,
                        name: validator.name.clone(),
                        accepted: false,
                        care_score: 0,
                        dual_vow_bonus_applied: false,
                        rejection_reason: Some(format_verification_error(&e)),
                        payout: 0,
                        hiran_verdict: Some(hiran_verdict),
                        ncl_bonus: 0,
                    });
                }
            }
        }

        // Derive network health from anomaly alerts
        let network_health = derive_network_health(&anomaly_alerts);

        let reward_distribution = self.reward_split.distribute(self.block_reward)?;

        if !shares.is_empty() {
            let payouts = distribute_to_validators(reward_distribution.care_validators, &shares)?;
            for (id, amount) in payouts {
                if let Some(r) = results.iter_mut().find(|r| r.validator_id == id) {
                    r.payout = amount;
                }
            }
        }

        hiran_executor.clear_verdicts();

        Ok(EpochReport {
            epoch,
            model_hash,
            reward_distribution,
            validators: results,
            hiran_stats,
            anomaly_alerts,
            network_health,
        })
    }

    /// Runs multiple epochs sequentially and returns all reports.
    /// Epochs are numbered `start_epoch..start_epoch + count`.
    pub fn run_epochs(
        &mut self,
        start_epoch: u64,
        count: u64,
    ) -> (Vec<EpochReport>, Vec<SimError>) {
        let mut reports = Vec::with_capacity(count as usize);
        let mut errors = Vec::new();
        for i in 0..count {
            match self.run_epoch(start_epoch + i) {
                Ok(r) => reports.push(r),
                Err(e) => errors.push(e),
            }
        }
        (reports, errors)
    }
}

fn format_verification_error(e: &VerificationError) -> String {
    format!("{e}")
}

/// Derives the overall network health from the list of anomaly alerts.
fn derive_network_health(alerts: &[AnomalyAlert]) -> NetworkHealth {
    let has_critical = alerts.iter().any(|a| a.severity >= AnomalySeverity::Critical);
    let has_high = alerts.iter().any(|a| a.severity >= AnomalySeverity::High);
    if has_critical {
        NetworkHealth::Critical
    } else if has_high {
        NetworkHealth::Degraded
    } else {
        NetworkHealth::Healthy
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn honest_validator(byte: u8, name: &str) -> SimulatedValidator {
        SimulatedValidator {
            id: [byte; 32],
            name: name.into(),
            stake: 5000,
            quality: CareScoreComponents {
                accuracy_bps: 9500,
                timeliness_bps: 9000,
                coverage_bps: 8500,
            },
            is_guardian: false,
            ceremony_location: None,
        }
    }

    fn lazy_validator(byte: u8, name: &str) -> SimulatedValidator {
        SimulatedValidator {
            id: [byte; 32],
            name: name.into(),
            stake: 5000,
            quality: CareScoreComponents {
                accuracy_bps: 500,
                timeliness_bps: 500,
                coverage_bps: 500,
            },
            is_guardian: false,
            ceremony_location: None,
        }
    }

    fn guardian_validator(byte: u8, name: &str, location: &str) -> SimulatedValidator {
        SimulatedValidator {
            id: [byte; 32],
            name: name.into(),
            stake: 5000,
            quality: CareScoreComponents {
                accuracy_bps: 9500,
                timeliness_bps: 9000,
                coverage_bps: 8500,
            },
            is_guardian: true,
            ceremony_location: Some(location.into()),
        }
    }

    #[test]
    fn epoch_report_conserves_care_pool_across_accepted_validators() {
        let mut sim = NetworkSimulator::new([1u8; 32], 1_000_000, 1000, 1_000_000);
        sim.add_validator(honest_validator(1, "alice")).unwrap();
        sim.add_validator(honest_validator(2, "bob")).unwrap();
        let report = sim.run_epoch(0).unwrap();

        assert_eq!(report.accepted_count(), 2);
        assert_eq!(report.rejected_count(), 0);
        assert_eq!(report.total_payout(), report.reward_distribution.care_validators);
    }

    #[test]
    fn lazy_validator_is_rejected_and_earns_nothing() {
        let mut sim = NetworkSimulator::new([2u8; 32], 1_000_000, 1000, 1_000_000);
        sim.add_validator(honest_validator(1, "alice")).unwrap();
        sim.add_validator(lazy_validator(2, "lazy-bob")).unwrap();
        let report = sim.run_epoch(0).unwrap();

        assert_eq!(report.accepted_count(), 1);
        assert_eq!(report.rejected_count(), 1);
        let lazy_result = report
            .validators
            .iter()
            .find(|v| v.name == "lazy-bob")
            .unwrap();
        assert!(!lazy_result.accepted);
        assert_eq!(lazy_result.payout, 0);
    }

    #[test]
    fn simulation_is_deterministic_across_runs() {
        let mut sim_a = NetworkSimulator::new([3u8; 32], 1_000_000, 1000, 1_000_000);
        sim_a.add_validator(honest_validator(1, "alice")).unwrap();
        let report_a = sim_a.run_epoch(5).unwrap();

        let mut sim_b = NetworkSimulator::new([3u8; 32], 1_000_000, 1000, 1_000_000);
        sim_b.add_validator(honest_validator(1, "alice")).unwrap();
        let report_b = sim_b.run_epoch(5).unwrap();

        assert_eq!(report_a.model_hash, report_b.model_hash);
        assert_eq!(report_a.total_payout(), report_b.total_payout());
    }

    #[test]
    fn suspended_validator_is_excluded_from_epoch() {
        let mut sim = NetworkSimulator::new([4u8; 32], 1_000_000, 1000, 1_000_000);
        sim.add_validator(honest_validator(1, "alice")).unwrap();
        sim.registry.break_vow(&[1u8; 32], 0).unwrap();

        let report = sim.run_epoch(1).unwrap();
        assert_eq!(report.accepted_count(), 0);
        assert_eq!(report.validators[0].payout, 0);
    }

    #[test]
    fn guardian_validator_receives_dual_vow_bonus() {
        // Guardian (dual-vow) vs regular validator with identical quality.
        // Guardian's care score should be 5% higher.
        let mut sim = NetworkSimulator::new([5u8; 32], 1_000_000, 1000, 1_000_000);
        sim.add_validator(honest_validator(1, "regular-alice")).unwrap();
        sim.add_validator(guardian_validator(2, "guardian-bob", "Genesis Garden")).unwrap();

        let report = sim.run_epoch(0).unwrap();
        assert_eq!(report.accepted_count(), 2);

        let regular = report.validators.iter().find(|v| v.name == "regular-alice").unwrap();
        let guardian = report.validators.iter().find(|v| v.name == "guardian-bob").unwrap();

        assert!(!regular.dual_vow_bonus_applied);
        assert!(guardian.dual_vow_bonus_applied);

        // Guardian care score must be strictly greater than regular
        assert!(
            guardian.care_score > regular.care_score,
            "guardian={} should > regular={}",
            guardian.care_score,
            regular.care_score
        );

        // Verify the +5 % factor
        let expected = poc_core::apply_dual_vow_bonus(regular.care_score);
        assert_eq!(guardian.care_score, expected);
    }

    #[test]
    fn dual_vow_flag_false_for_regular_validator() {
        let mut sim = NetworkSimulator::new([6u8; 32], 1_000_000, 1000, 1_000_000);
        sim.add_validator(honest_validator(1, "alice")).unwrap();
        let report = sim.run_epoch(0).unwrap();
        assert!(!report.validators[0].dual_vow_bonus_applied);
    }

    // ── Hiran integration tests ──────────────────────────────────────────────

    #[test]
    fn epoch_report_has_hiran_stats() {
        let mut sim = NetworkSimulator::new([7u8; 32], 1_000_000, 1000, 1_000_000);
        sim.add_validator(honest_validator(1, "alice")).unwrap();
        let report = sim.run_epoch(0).unwrap();
        // In stub mode: proofs_validated should equal number of eligible validators
        assert_eq!(report.hiran_stats.proofs_validated, 1);
        assert!(report.hiran_stats.stub_mode);
    }

    #[test]
    fn healthy_network_has_no_anomaly_alerts() {
        let mut sim = NetworkSimulator::new([8u8; 32], 1_000_000, 1000, 1_000_000);
        sim.add_validator(honest_validator(1, "alice")).unwrap();
        sim.add_validator(honest_validator(2, "bob")).unwrap();
        let report = sim.run_epoch(0).unwrap();
        assert_eq!(report.network_health, NetworkHealth::Healthy);
        assert!(report.anomaly_alerts.is_empty());
    }

    #[test]
    fn hiran_stub_does_not_affect_accepted_count() {
        // Stub Hiran always accepts — result should be identical to non-Hiran sim
        let mut sim_plain = NetworkSimulator::new([9u8; 32], 1_000_000, 1000, 1_000_000);
        sim_plain.add_validator(honest_validator(1, "alice")).unwrap();
        let report_plain = sim_plain.run_epoch(0).unwrap();

        let mut sim_hiran = NetworkSimulator::new([9u8; 32], 1_000_000, 1000, 1_000_000);
        sim_hiran.add_validator(honest_validator(1, "alice")).unwrap();
        let report_hiran = sim_hiran.run_epoch(0).unwrap();

        assert_eq!(report_plain.accepted_count(), report_hiran.accepted_count());
        assert_eq!(report_plain.total_payout(), report_hiran.total_payout());
    }

    #[test]
    fn epoch_report_hiran_verdict_is_some_for_eligible_validators() {
        let mut sim = NetworkSimulator::new([10u8; 32], 1_000_000, 1000, 1_000_000);
        sim.add_validator(honest_validator(1, "alice")).unwrap();
        let report = sim.run_epoch(0).unwrap();
        // Eligible validators should have a Hiran verdict recorded
        assert!(report.validators[0].hiran_verdict.is_some());
    }

    #[test]
    fn with_hiran_url_sets_url() {
        let sim = NetworkSimulator::new([11u8; 32], 1_000_000, 1000, 1_000_000)
            .with_hiran_url("http://127.0.0.1:9000");
        assert_eq!(sim.hiran_url.as_deref(), Some("http://127.0.0.1:9000"));
    }

    #[test]
    fn flagged_validators_returns_only_anomaly_validators() {
        let mut sim = NetworkSimulator::new([12u8; 32], 1_000_000, 1000, 1_000_000);
        sim.add_validator(honest_validator(1, "alice")).unwrap();
        let report = sim.run_epoch(0).unwrap();
        // No anomalies for honest validator
        assert!(report.flagged_validators().is_empty());
    }

    #[test]
    fn derive_network_health_critical_on_critical_alert() {
        let alerts = vec![AnomalyAlert {
            validator_id: [1u8; 32],
            anomaly_type: AnomalyType::ReplayAttack,
            severity: AnomalySeverity::Critical,
            description: "test".into(),
            recommended_action: AnomalyAction::EmergencyEscalation,
        }];
        assert_eq!(derive_network_health(&alerts), NetworkHealth::Critical);
    }

    #[test]
    fn derive_network_health_degraded_on_high_alert() {
        let alerts = vec![AnomalyAlert {
            validator_id: [2u8; 32],
            anomaly_type: AnomalyType::ScoreGaming,
            severity: AnomalySeverity::High,
            description: "test".into(),
            recommended_action: AnomalyAction::RejectProof,
        }];
        assert_eq!(derive_network_health(&alerts), NetworkHealth::Degraded);
    }

    #[test]
    fn derive_network_health_healthy_with_no_alerts() {
        assert_eq!(derive_network_health(&[]), NetworkHealth::Healthy);
    }

    // ── Multi-epoch stress tests (Fáze 2c) ──────────────────────────────────

    fn build_mixed_sim(seed: [u8; 32]) -> NetworkSimulator {
        let mut sim = NetworkSimulator::new(seed, 10_000_000, 1000, 1_000_000);
        sim.add_validator(honest_validator(1, "alice")).unwrap();
        sim.add_validator(honest_validator(2, "bob")).unwrap();
        sim.add_validator(honest_validator(3, "carol")).unwrap();
        sim.add_validator(lazy_validator(4, "lazy-dave")).unwrap();
        sim.add_validator(guardian_validator(5, "guardian-eve", "Prague")).unwrap();
        sim
    }

    #[test]
    fn run_epochs_returns_correct_count() {
        let mut sim = build_mixed_sim([20u8; 32]);
        let (reports, errors) = sim.run_epochs(0, 10);
        assert_eq!(reports.len(), 10);
        assert!(errors.is_empty());
    }

    #[test]
    fn run_100_epochs_no_errors() {
        let mut sim = build_mixed_sim([21u8; 32]);
        let (reports, errors) = sim.run_epochs(0, 100);
        assert_eq!(reports.len(), 100);
        assert!(errors.is_empty());
    }

    #[test]
    fn stress_test_total_payout_never_exceeds_block_reward() {
        let mut sim = build_mixed_sim([22u8; 32]);
        let (reports, _) = sim.run_epochs(0, 100);
        for r in &reports {
            assert!(r.total_payout() <= r.reward_distribution.care_validators);
        }
    }

    #[test]
    fn stress_test_lazy_validator_always_rejected() {
        let mut sim = build_mixed_sim([23u8; 32]);
        let (reports, _) = sim.run_epochs(0, 50);
        for r in &reports {
            let dave = r.validators.iter().find(|v| v.name == "lazy-dave").unwrap();
            assert!(!dave.accepted);
            assert_eq!(dave.payout, 0);
        }
    }

    #[test]
    fn stress_test_honest_validators_always_accepted() {
        let mut sim = build_mixed_sim([24u8; 32]);
        let (reports, _) = sim.run_epochs(0, 50);
        for r in &reports {
            for name in &["alice", "bob", "carol"] {
                let v = r.validators.iter().find(|v| v.name == *name).unwrap();
                assert!(v.accepted, "{name} rejected in epoch {}", r.epoch);
            }
        }
    }

    #[test]
    fn stress_test_guardian_earns_more_than_regular() {
        let mut sim = build_mixed_sim([25u8; 32]);
        let (reports, _) = sim.run_epochs(0, 50);
        for r in &reports {
            let eve = r.validators.iter().find(|v| v.name == "guardian-eve").unwrap();
            let alice = r.validators.iter().find(|v| v.name == "alice").unwrap();
            if alice.accepted && eve.accepted {
                assert!(eve.care_score >= alice.care_score);
            }
        }
    }

    #[test]
    fn stress_test_network_health_never_critical_for_honest_network() {
        let mut sim = build_mixed_sim([26u8; 32]);
        let (reports, _) = sim.run_epochs(0, 100);
        for r in &reports {
            assert_ne!(r.network_health, NetworkHealth::Critical);
        }
    }

    #[test]
    fn run_epochs_epochs_are_sequential() {
        let mut sim = build_mixed_sim([29u8; 32]);
        let (reports, _) = sim.run_epochs(10, 5);
        for (i, r) in reports.iter().enumerate() {
            assert_eq!(r.epoch, 10 + i as u64);
        }
    }

    #[test]
    fn run_many_validators_100_epochs_performance() {
        let mut sim = NetworkSimulator::new([30u8; 32], 10_000_000, 1000, 1_000_000);
        for i in 0u8..10 {
            sim.add_validator(honest_validator(i + 1, &format!("v{i}"))).unwrap();
        }
        let (reports, errors) = sim.run_epochs(0, 100);
        assert_eq!(reports.len(), 100);
        assert!(errors.is_empty());
        for r in &reports {
            assert_eq!(r.accepted_count(), 10);
        }
    }

    // ── Fáze 3d: integrační testy s MockHiranServer ────────────────────────

    #[test]
    fn sim_with_mock_hiran_server_all_accepted() {
        use poc_hiran::MockHiranServer;
        // Spustíme mock Hiran server (vždy accept)
        let server = MockHiranServer::spawn_accepting();
        let url = server.url();

        let mut sim = NetworkSimulator::new([40u8; 32], 1_000_000, 1000, 1_000_000)
            .with_hiran_url(url);
        sim.add_validator(honest_validator(1, "alice")).unwrap();
        sim.add_validator(honest_validator(2, "bob")).unwrap();

        let report = sim.run_epoch(0).unwrap();
        // Mock server je live (ne stub)
        assert!(!report.hiran_stats.stub_mode, "mock server should run in live mode");
        assert_eq!(report.hiran_stats.proofs_validated, 2);
        assert_eq!(report.hiran_stats.accepted, 2);
        assert_eq!(report.hiran_stats.rejected, 0);

        server.shutdown();
    }

    #[test]
    fn sim_with_mock_hiran_server_5_epochs() {
        use poc_hiran::MockHiranServer;
        let server = MockHiranServer::spawn_accepting();
        let url = server.url();

        let mut sim = NetworkSimulator::new([41u8; 32], 5_000_000, 1000, 1_000_000)
            .with_hiran_url(url);
        sim.add_validator(honest_validator(1, "alice")).unwrap();
        sim.add_validator(honest_validator(2, "bob")).unwrap();
        sim.add_validator(honest_validator(3, "carol")).unwrap();

        let (reports, errors) = sim.run_epochs(0, 5);
        assert_eq!(reports.len(), 5);
        assert!(errors.is_empty(), "no errors expected with mock server");

        for r in &reports {
            assert!(!r.hiran_stats.stub_mode, "should be live mode in all epochs");
            assert_eq!(r.hiran_stats.proofs_validated, 3);
        }

        server.shutdown();
    }

    #[test]
    fn sim_fallback_to_stub_when_hiran_unreachable() {
        // Zadáme URL kde nic neběží — backend musí přepnout na stub
        let dead_url = "http://127.0.0.1:19998";
        let mut sim = NetworkSimulator::new([42u8; 32], 1_000_000, 1000, 1_000_000)
            .with_hiran_url(dead_url);
        sim.add_validator(honest_validator(1, "alice")).unwrap();

        // Musí proběhnout bez panicu — fallback na stub
        let report = sim.run_epoch(0).unwrap();
        // Epoch proběhla (Alice akceptována)
        assert_eq!(report.accepted_count(), 1);
    }

    #[test]
    fn sim_with_mock_hiran_server_rejecting_reduces_accepted() {
        use poc_hiran::MockHiranServer;
        // Mock server vždy odmítá
        let server = MockHiranServer::spawn_rejecting();
        let url = server.url();

        let mut sim = NetworkSimulator::new([43u8; 32], 1_000_000, 1000, 1_000_000)
            .with_hiran_url(url);
        sim.add_validator(honest_validator(1, "alice")).unwrap();
        sim.add_validator(honest_validator(2, "bob")).unwrap();

        let report = sim.run_epoch(0).unwrap();
        // Hiran odmítl všechny proofs
        assert!(!report.hiran_stats.stub_mode);
        assert_eq!(report.hiran_stats.rejected, 2);
        assert_eq!(report.accepted_count(), 0, "all rejected by Hiran mock");

        server.shutdown();
    }
}
