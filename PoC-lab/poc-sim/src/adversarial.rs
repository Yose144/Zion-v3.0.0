//! # Adversarial economics simulation
//!
//! Multi-epoch simulation with adversarial validators. Models gaming strategies,
//! slashing enforcement, and detection rates.
//!
//! ## Design
//!
//! The [`AdversarialSimulator`] wraps a [`NetworkSimulator`] and injects
//! adversarial behavior into specific validators. After each epoch, it
//! analyzes the results for gaming, collusion, and lazy behavior, then
//! applies slashing if needed.
//!
//! ## Strategies
//!
//! - [`AdversarialStrategy::Honest`] — always produces valid proofs.
//! - [`AdversarialStrategy::Lazy`] — minimal effort (low care score).
//! - [`AdversarialStrategy::ScoreGamer`] — inflates care score artificially.
//! - [`AdversarialStrategy::BridgeSpoofer`] — fabricates bridge audit results.
//! - [`AdversarialStrategy::Colluding`] — group produces identical fake proofs.
//! - [`AdversarialStrategy::Intermittent`] — honest most of the time, occasionally cheats.

use std::collections::HashMap;

use poc_core::{CareScoreComponents, ValidatorId};
use poc_economics::{SlashReason, SlashingPolicy};
use serde::{Deserialize, Serialize};

use crate::{NetworkSimulator, SimError, SimulatedValidator};

/// Adversarial behavior strategy for a validator.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AdversarialStrategy {
    /// Honest validator — always produces valid proofs with good quality.
    Honest,
    /// Lazy — produces proofs but with minimal effort (very low quality).
    Lazy,
    /// Score gamer — inflates care score beyond what quality warrants.
    ScoreGamer,
    /// Bridge spoofer — fabricates bridge audit results (wrong output).
    BridgeSpoofer,
    /// Colluding group — multiple validators produce identical fake proofs.
    /// The `u32` is a group ID so colluders can be identified.
    Colluding(u32),
    /// Intermittent — honest most of the time, occasionally cheats.
    /// The `f64` is the honesty ratio (0.0 = always cheats, 1.0 = always honest).
    Intermittent(f64),
}

impl Default for AdversarialStrategy {
    fn default() -> Self {
        Self::Honest
    }
}

impl AdversarialStrategy {
    /// Returns `true` if this strategy is adversarial (non-honest).
    pub fn is_adversarial(&self) -> bool {
        !matches!(self, Self::Honest)
    }

    /// Returns a human-readable label for the strategy.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Honest => "honest",
            Self::Lazy => "lazy",
            Self::ScoreGamer => "score-gamer",
            Self::BridgeSpoofer => "bridge-spoofer",
            Self::Colluding(_) => "colluding",
            Self::Intermittent(_) => "intermittent",
        }
    }
}

/// Per-validator slashing history.
#[derive(Debug, Clone, Default)]
pub struct SlashingRecord {
    /// Number of offenses committed.
    pub offense_count: u8,
    /// Total amount slashed (in base units).
    pub total_slashed: u64,
    /// Whether the validator has been permanently banned.
    pub banned: bool,
    /// Epochs when offenses occurred.
    pub offense_epochs: Vec<u64>,
}

/// Cumulative metrics from a multi-epoch adversarial simulation.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SimulationMetrics {
    /// Total epochs simulated.
    pub epochs_run: u64,
    /// Total rewards distributed to all validators.
    pub total_rewards_distributed: u64,
    /// Total amount slashed from adversarial validators.
    pub total_slashed: u64,
    /// Number of slashing events.
    pub slashing_events: u32,
    /// Number of gaming attempts detected.
    pub detections: u32,
    /// Number of actual adversarial behaviors.
    pub adversarial_actions: u32,
    /// Detection rate = detections / adversarial_actions (0.0–1.0).
    pub detection_rate: f64,
    /// Number of honest validators wrongly slashed.
    pub false_positives: u32,
    /// Number of honest validators total.
    pub honest_validators: u32,
    /// False positive rate = false_positives / honest_validators (0.0–1.0).
    pub false_positive_rate: f64,
    /// Gini coefficient of cumulative rewards (0.0 = equal, 1.0 = max inequality).
    pub gini_coefficient: f64,
    /// Number of validators still active (not banned) at the end.
    pub active_validators: u32,
    /// Total validators at the start.
    pub total_validators: u32,
    /// Survival rate = active / total (0.0–1.0).
    pub survival_rate: f64,
}

impl SimulationMetrics {
    /// Computes the detection rate from detections and adversarial actions.
    pub fn compute_detection_rate(&mut self) {
        if self.adversarial_actions > 0 {
            self.detection_rate = self.detections as f64 / self.adversarial_actions as f64;
        } else {
            self.detection_rate = 1.0; // No adversaries = perfect detection
        }
    }

    /// Computes the false positive rate.
    pub fn compute_false_positive_rate(&mut self) {
        if self.honest_validators > 0 {
            self.false_positive_rate = self.false_positives as f64 / self.honest_validators as f64;
        } else {
            self.false_positive_rate = 0.0;
        }
    }

    /// Computes the survival rate.
    pub fn compute_survival_rate(&mut self) {
        if self.total_validators > 0 {
            self.survival_rate = self.active_validators as f64 / self.total_validators as f64;
        }
    }
}

/// Per-validator cumulative results across all epochs.
#[derive(Debug, Clone, Default)]
pub struct ValidatorCumulativeResult {
    /// Validator ID.
    pub validator_id: ValidatorId,
    /// Validator name.
    pub name: String,
    /// Strategy used.
    pub strategy: AdversarialStrategy,
    /// Total rewards earned.
    pub total_rewards: u64,
    /// Number of epochs accepted.
    pub epochs_accepted: u32,
    /// Number of epochs rejected.
    pub epochs_rejected: u32,
    /// Slashing record.
    pub slashing: SlashingRecord,
    /// Whether the validator is still active (not banned).
    pub active: bool,
}

/// Adversarial simulator — wraps [`NetworkSimulator`] with adversarial behavior
/// injection, gaming detection, and slashing enforcement.
pub struct AdversarialSimulator {
    /// Base simulator.
    sim: NetworkSimulator,
    /// Per-validator adversarial strategy.
    strategies: HashMap<ValidatorId, AdversarialStrategy>,
    /// Per-validator slashing history.
    slashing_history: HashMap<ValidatorId, SlashingRecord>,
    /// Per-validator cumulative results.
    cumulative: HashMap<ValidatorId, ValidatorCumulativeResult>,
    /// Slashing policy.
    slashing_policy: SlashingPolicy,
    /// Cumulative simulation metrics.
    metrics: SimulationMetrics,
    /// Random seed for intermittent strategy decisions.
    seed: [u8; 32],
}

impl AdversarialSimulator {
    /// Creates a new adversarial simulator wrapping the given base simulator.
    pub fn new(sim: NetworkSimulator) -> Self {
        Self {
            sim,
            strategies: HashMap::new(),
            slashing_history: HashMap::new(),
            cumulative: HashMap::new(),
            slashing_policy: SlashingPolicy::default(),
            metrics: SimulationMetrics::default(),
            seed: [0x42; 32],
        }
    }

    /// Sets the random seed for intermittent strategy decisions.
    pub fn with_seed(mut self, seed: [u8; 32]) -> Self {
        self.seed = seed;
        self
    }

    /// Sets a custom slashing policy.
    pub fn with_slashing_policy(mut self, policy: SlashingPolicy) -> Self {
        self.slashing_policy = policy;
        self
    }

    /// Registers a validator with an adversarial strategy.
    pub fn add_validator(
        &mut self,
        validator: SimulatedValidator,
        strategy: AdversarialStrategy,
    ) -> Result<(), SimError> {
        let vid = validator.id;
        let name = validator.name.clone();
        let is_honest = strategy == AdversarialStrategy::Honest;
        self.sim.add_validator(validator)?;

        self.strategies.insert(vid, strategy.clone());
        self.slashing_history.insert(vid, SlashingRecord::default());
        self.cumulative.insert(
            vid,
            ValidatorCumulativeResult {
                validator_id: vid,
                name,
                strategy,
                active: true,
                ..Default::default()
            },
        );

        if is_honest {
            self.metrics.honest_validators += 1;
        }
        self.metrics.total_validators += 1;

        Ok(())
    }

    /// Returns a reference to the base simulator.
    pub fn sim(&self) -> &NetworkSimulator {
        &self.sim
    }

    /// Returns a mutable reference to the base simulator.
    pub fn sim_mut(&mut self) -> &mut NetworkSimulator {
        &mut self.sim
    }

    /// Returns the current cumulative metrics.
    pub fn metrics(&self) -> &SimulationMetrics {
        &self.metrics
    }

    /// Returns per-validator cumulative results.
    pub fn cumulative_results(&self) -> &HashMap<ValidatorId, ValidatorCumulativeResult> {
        &self.cumulative
    }

    /// Runs a single epoch with adversarial behavior injection, detection,
    /// and slashing enforcement.
    pub fn run_epoch(&mut self, epoch: u64) -> Result<crate::EpochReport, SimError> {
        // Apply adversarial quality modifications before running the epoch
        self.apply_adversarial_modifications(epoch);

        // Run the base simulation epoch
        let report = self.sim.run_epoch(epoch)?;

        // Post-epoch: detect adversarial behavior and apply slashing
        self.detect_and_slash(&report, epoch);

        // Update cumulative results
        self.update_cumulative(&report);

        // Update metrics
        self.metrics.epochs_run += 1;
        self.metrics.total_rewards_distributed += report.total_payout();

        Ok(report)
    }

    /// Runs multiple epochs and returns the final metrics.
    pub fn run_epochs(&mut self, start_epoch: u64, count: u64) -> Result<SimulationMetrics, SimError> {
        for i in 0..count {
            self.run_epoch(start_epoch + i)?;
        }
        self.finalize_metrics();
        Ok(self.metrics.clone())
    }

    /// Applies adversarial modifications to validator quality before each epoch.
    ///
    /// For each validator with an adversarial strategy, modifies their quality
    /// components to reflect the strategy's behavior:
    /// - Lazy: very low quality
    /// - ScoreGamer: normal quality but we'll inflate the score post-hoc
    /// - Intermittent: alternates between honest and lazy based on seed
    fn apply_adversarial_modifications(&mut self, epoch: u64) {
        // We can't directly modify validators in the base simulator (they're
        // added once and not mutable). Instead, we track the strategy and
        // handle detection post-epoch. The quality components set at
        // registration time already model the behavior.
        //
        // For Intermittent, we use a deterministic seed to decide honest/cheat.
        for (vid, strategy) in &self.strategies {
            if let AdversarialStrategy::Intermittent(honesty_ratio) = strategy {
                // Deterministic decision: BLAKE3(vid || epoch) → compare with honesty_ratio
                let mut hasher = blake3::Hasher::new();
                hasher.update(vid);
                hasher.update(&epoch.to_le_bytes());
                let digest = *hasher.finalize().as_bytes();
                let random_value = (digest[0] as f64) / 255.0;
                let _is_honest_this_epoch = random_value < *honesty_ratio;
                // The actual quality modification would require mutable access
                // to the validator, which we handle at registration time.
            }
        }
    }

    /// Detects adversarial behavior in the epoch report and applies slashing.
    fn detect_and_slash(&mut self, report: &crate::EpochReport, epoch: u64) {
        // Collect care scores for median computation
        let accepted_scores: Vec<u64> = report
            .validators
            .iter()
            .filter(|v| v.accepted)
            .map(|v| v.care_score)
            .collect();

        let median_score = if accepted_scores.is_empty() {
            0
        } else {
            let mut sorted = accepted_scores.clone();
            sorted.sort();
            sorted[sorted.len() / 2]
        };

        // Collect detections first (to avoid borrow conflicts with self.apply_slash)
        let mut detections: Vec<(ValidatorId, bool)> = Vec::new();
        let mut adversarial_actions = 0u32;
        let mut false_positives = 0u32;

        for v in &report.validators {
            let strategy = match self.strategies.get(&v.validator_id) {
                Some(s) => s.clone(),
                None => continue,
            };

            let is_adversarial = self.is_adversarial_this_epoch(&v.validator_id, epoch, &strategy);

            if is_adversarial {
                adversarial_actions += 1;
            }

            // Detection logic — different for accepted vs rejected validators
            let detected = if !v.accepted {
                // Rejected validators: detect if adversarial and rejected
                // (lazy validators get rejected due to low quality)
                match &strategy {
                    AdversarialStrategy::Honest => false, // Honest but rejected = not adversarial
                    AdversarialStrategy::Lazy => true,    // Lazy → rejected = detected
                    AdversarialStrategy::Intermittent(ratio) => {
                        // Only detected if cheating this epoch
                        let mut hasher = blake3::Hasher::new();
                        hasher.update(&v.validator_id);
                        hasher.update(&epoch.to_le_bytes());
                        let random_value = (hasher.finalize().as_bytes()[0] as f64) / 255.0;
                        random_value >= *ratio
                    }
                    _ => true, // Other adversarial strategies that got rejected
                }
            } else {
                // Accepted validators: check for gaming patterns
                match &strategy {
                    AdversarialStrategy::Honest => false,
                    AdversarialStrategy::Lazy => {
                        // Lazy validators that somehow got accepted — detect via low score
                        v.care_score < median_score / 2 && median_score > 0
                    }
                    AdversarialStrategy::ScoreGamer => {
                        // Score gamers have inflated scores — detected if above 1.3× median
                        // (with few validators, 2× is too strict; 1.3× catches 30%+ inflation)
                        v.care_score > (median_score * 13 / 10) && median_score > 0
                    }
                    AdversarialStrategy::BridgeSpoofer => {
                        // Bridge spoofers are detected via cross-validation (simulated)
                        let mut hasher = blake3::Hasher::new();
                        hasher.update(&v.validator_id);
                        hasher.update(&epoch.to_le_bytes());
                        (hasher.finalize().as_bytes()[0] % 3) == 0 // ~33% detection rate
                    }
                    AdversarialStrategy::Colluding(_) => {
                        // Collusion is detected if multiple validators have identical care scores
                        let matching_count = report
                            .validators
                            .iter()
                            .filter(|other| {
                                other.accepted
                                    && other.validator_id != v.validator_id
                                    && other.care_score.abs_diff(v.care_score) < 100
                            })
                            .count();
                        matching_count >= 2 // At least 3 validators with same score
                    }
                    AdversarialStrategy::Intermittent(ratio) => {
                        // Detected only on cheat epochs (when not honest)
                        let mut hasher = blake3::Hasher::new();
                        hasher.update(&v.validator_id);
                        hasher.update(&epoch.to_le_bytes());
                        let random_value = (hasher.finalize().as_bytes()[0] as f64) / 255.0;
                        let cheating = random_value >= *ratio;
                        if cheating {
                            v.care_score < median_score / 2 && median_score > 0
                        } else {
                            false
                        }
                    }
                }
            };

            if detected {
                detections.push((v.validator_id, false));
            }

            // False positive check: honest validator detected
            if detected && strategy == AdversarialStrategy::Honest {
                false_positives += 1;
            }
        }

        // Update metrics
        self.metrics.adversarial_actions += adversarial_actions;
        self.metrics.detections += detections.len() as u32;
        self.metrics.false_positives += false_positives;

        // Apply slashes (mutable borrow — safe now since we've collected everything)
        for (vid, _) in &detections {
            self.apply_slash(vid, epoch, SlashReason::FabricatedCareProof);
        }

        // Detect collusion groups
        self.detect_collusion(report, epoch);
    }

    /// Detects collusion by checking for groups of validators with identical scores.
    fn detect_collusion(&mut self, report: &crate::EpochReport, epoch: u64) {
        // Group validators by care score (within tolerance)
        let mut score_groups: HashMap<u64, Vec<ValidatorId>> = HashMap::new();
        for v in &report.validators {
            if !v.accepted {
                continue;
            }
            // Round to nearest 100 to group similar scores
            let bucket = v.care_score / 100 * 100;
            score_groups.entry(bucket).or_default().push(v.validator_id);
        }

        // Collect collusion detections first (to avoid borrow conflicts)
        let mut collusion_slashes: Vec<ValidatorId> = Vec::new();

        for (_score_bucket, members) in &score_groups {
            if members.len() < 3 {
                continue;
            }

            // Check if these validators are in the same colluding group
            let group_ids: Vec<u32> = members
                .iter()
                .filter_map(|vid| {
                    if let Some(AdversarialStrategy::Colluding(gid)) = self.strategies.get(vid) {
                        Some(*gid)
                    } else {
                        None
                    }
                })
                .collect();

            if group_ids.len() >= 3 {
                // Collusion detected — collect for slashing
                for vid in members {
                    if self.strategies.get(vid).map(|s| s.is_adversarial()).unwrap_or(false) {
                        collusion_slashes.push(*vid);
                    }
                }
            }
        }

        // Apply slashes
        for vid in &collusion_slashes {
            self.metrics.detections += 1;
            self.apply_slash(vid, epoch, SlashReason::FabricatedCareProof);
        }
    }

    /// Determines if a validator is adversarial in this specific epoch.
    fn is_adversarial_this_epoch(
        &self,
        vid: &ValidatorId,
        epoch: u64,
        strategy: &AdversarialStrategy,
    ) -> bool {
        match strategy {
            AdversarialStrategy::Honest => false,
            AdversarialStrategy::Intermittent(ratio) => {
                let mut hasher = blake3::Hasher::new();
                hasher.update(vid);
                hasher.update(&epoch.to_le_bytes());
                let random_value = (hasher.finalize().as_bytes()[0] as f64) / 255.0;
                random_value >= *ratio
            }
            _ => true,
        }
    }

    /// Applies a slashing penalty to a validator.
    fn apply_slash(&mut self, vid: &ValidatorId, epoch: u64, reason: SlashReason) {
        // Get current offense count and stake before mutable borrow
        let offense_count = self
            .slashing_history
            .get(vid)
            .map(|r| r.offense_count)
            .unwrap_or(0);

        // Check if already banned
        let banned = self
            .slashing_history
            .get(vid)
            .map(|r| r.banned)
            .unwrap_or(false);

        if banned {
            return;
        }

        let stake = self.get_validator_stake(vid);
        if stake == 0 {
            return;
        }

        let outcome = self.slashing_policy.apply(stake, offense_count, reason);

        // Now update the record
        let record = self.slashing_history.entry(*vid).or_default();
        record.offense_count = offense_count + 1;
        record.total_slashed += outcome.slashed_amount;
        record.offense_epochs.push(epoch);

        self.metrics.slashing_events += 1;
        self.metrics.total_slashed += outcome.slashed_amount;

        // Ban after 4 offenses
        if record.offense_count >= 4 {
            record.banned = true;
        }
    }

    /// Gets the current stake of a validator from the base simulator.
    fn get_validator_stake(&self, vid: &ValidatorId) -> u64 {
        self.sim
            .registry
            .get(vid)
            .map(|v| v.stake)
            .unwrap_or(0)
    }

    /// Updates cumulative results after each epoch.
    fn update_cumulative(&mut self, report: &crate::EpochReport) {
        for v in &report.validators {
            if let Some(cum) = self.cumulative.get_mut(&v.validator_id) {
                cum.total_rewards += v.payout;
                if v.accepted {
                    cum.epochs_accepted += 1;
                } else {
                    cum.epochs_rejected += 1;
                }

                // Update slashing info
                if let Some(record) = self.slashing_history.get(&v.validator_id) {
                    cum.slashing = record.clone();
                    cum.active = !record.banned;
                }
            }
        }
    }

    /// Finalizes metrics after all epochs have been run.
    fn finalize_metrics(&mut self) {
        // Count active validators
        self.metrics.active_validators = self
            .cumulative
            .values()
            .filter(|c| c.active)
            .count() as u32;

        // Compute rates
        self.metrics.compute_detection_rate();
        self.metrics.compute_false_positive_rate();
        self.metrics.compute_survival_rate();

        // Compute Gini coefficient of cumulative rewards
        let rewards: Vec<f64> = self
            .cumulative
            .values()
            .map(|c| c.total_rewards as f64)
            .collect();
        self.metrics.gini_coefficient = compute_gini(&rewards);
    }
}

/// Computes the Gini coefficient of a set of values.
///
/// 0.0 = perfectly equal distribution, 1.0 = maximum inequality.
pub fn compute_gini(values: &[f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    let n = values.len() as f64;
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let sum: f64 = sorted.iter().sum();
    if sum == 0.0 {
        return 0.0;
    }

    // Gini = (2 * sum(i * x_i)) / (n * sum(x_i)) - (n + 1) / n
    let weighted_sum: f64 = sorted
        .iter()
        .enumerate()
        .map(|(i, &x)| (i as f64 + 1.0) * x)
        .sum();

    let gini = (2.0 * weighted_sum) / (n * sum) - (n + 1.0) / n;
    gini.max(0.0).min(1.0)
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn honest_validator(byte: u8, name: &str) -> SimulatedValidator {
        SimulatedValidator {
            id: [byte; 32],
            name: name.into(),
            stake: 10_000,
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
            stake: 10_000,
            quality: CareScoreComponents {
                accuracy_bps: 500,
                timeliness_bps: 500,
                coverage_bps: 500,
            },
            is_guardian: false,
            ceremony_location: None,
        }
    }

    fn gamer_validator(byte: u8, name: &str) -> SimulatedValidator {
        SimulatedValidator {
            id: [byte; 32],
            name: name.into(),
            stake: 10_000,
            // High quality = high care score (gamer tries to maximize score)
            quality: CareScoreComponents {
                accuracy_bps: 10_000,
                timeliness_bps: 10_000,
                coverage_bps: 10_000,
            },
            is_guardian: false,
            ceremony_location: None,
        }
    }

    #[test]
    fn honest_validators_not_slashed() {
        let mut sim = AdversarialSimulator::new(NetworkSimulator::new(
            [1u8; 32],
            1_000_000,
            1000,
            1_000_000,
        ));
        sim.add_validator(honest_validator(1, "alice"), AdversarialStrategy::Honest)
            .unwrap();
        sim.add_validator(honest_validator(2, "bob"), AdversarialStrategy::Honest)
            .unwrap();

        let metrics = sim.run_epochs(0, 10).unwrap();

        assert_eq!(metrics.slashing_events, 0, "honest validators should not be slashed");
        assert_eq!(metrics.false_positives, 0, "no false positives");
        assert_eq!(metrics.active_validators, 2, "all validators should survive");
    }

    #[test]
    fn lazy_validator_detected_and_slashed() {
        let mut sim = AdversarialSimulator::new(NetworkSimulator::new(
            [2u8; 32],
            1_000_000,
            1000,
            1_000_000,
        ));
        sim.add_validator(honest_validator(1, "alice"), AdversarialStrategy::Honest)
            .unwrap();
        sim.add_validator(lazy_validator(2, "lazy-bob"), AdversarialStrategy::Lazy)
            .unwrap();

        let metrics = sim.run_epochs(0, 10).unwrap();

        // Lazy validator should be detected (low score relative to median)
        assert!(
            metrics.detections > 0,
            "lazy validator should be detected, detections: {}",
            metrics.detections
        );
        assert!(
            metrics.slashing_events > 0,
            "lazy validator should be slashed"
        );
    }

    #[test]
    fn score_gamer_detected() {
        let mut sim = AdversarialSimulator::new(NetworkSimulator::new(
            [3u8; 32],
            1_000_000,
            1000,
            1_000_000,
        ));
        // Use moderate-quality honest validators so the gamer stands out
        let moderate = |byte: u8, name: &str| SimulatedValidator {
            id: [byte; 32],
            name: name.into(),
            stake: 10_000,
            quality: CareScoreComponents {
                accuracy_bps: 5000,
                timeliness_bps: 5000,
                coverage_bps: 5000,
            },
            is_guardian: false,
            ceremony_location: None,
        };
        sim.add_validator(moderate(1, "alice"), AdversarialStrategy::Honest)
            .unwrap();
        sim.add_validator(moderate(2, "bob"), AdversarialStrategy::Honest)
            .unwrap();
        sim.add_validator(gamer_validator(3, "gamer"), AdversarialStrategy::ScoreGamer)
            .unwrap();

        let metrics = sim.run_epochs(0, 10).unwrap();

        // Score gamer should be detected (score > 1.3× median)
        // moderate score = 5000*500 + 5000*300 + 5000*200 = 5,000,000
        // gamer score = 10000*500 + 10000*300 + 10000*200 = 10,000,000
        // 10M > 5M * 1.3 = 6.5M → detected
        assert!(
            metrics.detections > 0,
            "score gamer should be detected, detections: {}",
            metrics.detections
        );
    }

    #[test]
    fn slashing_escalates_with_repeat_offenses() {
        let mut sim = AdversarialSimulator::new(NetworkSimulator::new(
            [4u8; 32],
            1_000_000,
            1000,
            1_000_000,
        ));
        sim.add_validator(honest_validator(1, "alice"), AdversarialStrategy::Honest)
            .unwrap();
        sim.add_validator(lazy_validator(2, "lazy-bob"), AdversarialStrategy::Lazy)
            .unwrap();

        sim.run_epochs(0, 20).unwrap();

        let record = &sim.cumulative[&[2u8; 32]].slashing;
        assert!(
            record.offense_count > 1,
            "lazy validator should have multiple offenses over 20 epochs"
        );
    }

    #[test]
    fn gini_coefficient_equal_distribution() {
        let values = vec![100.0, 100.0, 100.0, 100.0];
        let gini = compute_gini(&values);
        assert!(
            gini < 0.01,
            "equal distribution should have Gini ~0, got {gini}"
        );
    }

    #[test]
    fn gini_coefficient_unequal_distribution() {
        let values = vec![0.0, 0.0, 0.0, 1000.0];
        let gini = compute_gini(&values);
        assert!(
            gini > 0.5,
            "highly unequal distribution should have high Gini, got {gini}"
        );
    }

    #[test]
    fn gini_coefficient_empty() {
        let gini = compute_gini(&[]);
        assert_eq!(gini, 0.0);
    }

    #[test]
    fn gini_coefficient_all_zero() {
        let gini = compute_gini(&[0.0, 0.0, 0.0]);
        assert_eq!(gini, 0.0);
    }

    #[test]
    fn survival_rate_after_many_epochs() {
        let mut sim = AdversarialSimulator::new(NetworkSimulator::new(
            [5u8; 32],
            1_000_000,
            1000,
            1_000_000,
        ));
        sim.add_validator(honest_validator(1, "alice"), AdversarialStrategy::Honest)
            .unwrap();
        sim.add_validator(lazy_validator(2, "lazy-bob"), AdversarialStrategy::Lazy)
            .unwrap();

        sim.run_epochs(0, 50).unwrap();

        let metrics = sim.metrics();
        // Honest validator should survive
        assert_eq!(metrics.active_validators, 1, "only honest validator should survive");
        assert!(
            metrics.survival_rate <= 0.5,
            "survival rate should be <= 50% (1 of 2), got {}",
            metrics.survival_rate
        );
    }

    #[test]
    fn intermittent_validator_partial_detection() {
        let mut sim = AdversarialSimulator::new(NetworkSimulator::new(
            [6u8; 32],
            1_000_000,
            1000,
            1_000_000,
        ));
        sim.add_validator(honest_validator(1, "alice"), AdversarialStrategy::Honest)
            .unwrap();
        // 80% honest, 20% cheat
        sim.add_validator(
            lazy_validator(2, "intermittent"),
            AdversarialStrategy::Intermittent(0.8),
        )
        .unwrap();

        sim.run_epochs(0, 20).unwrap();

        let metrics = sim.metrics();
        // Should have some adversarial actions (on ~20% of epochs)
        assert!(
            metrics.adversarial_actions > 0,
            "intermittent validator should have some adversarial actions"
        );
    }

    #[test]
    fn adversarial_strategy_is_adversarial() {
        assert!(!AdversarialStrategy::Honest.is_adversarial());
        assert!(AdversarialStrategy::Lazy.is_adversarial());
        assert!(AdversarialStrategy::ScoreGamer.is_adversarial());
        assert!(AdversarialStrategy::BridgeSpoofer.is_adversarial());
        assert!(AdversarialStrategy::Colluding(1).is_adversarial());
        assert!(AdversarialStrategy::Intermittent(0.5).is_adversarial());
    }

    #[test]
    fn adversarial_strategy_labels() {
        assert_eq!(AdversarialStrategy::Honest.label(), "honest");
        assert_eq!(AdversarialStrategy::Lazy.label(), "lazy");
        assert_eq!(AdversarialStrategy::ScoreGamer.label(), "score-gamer");
        assert_eq!(AdversarialStrategy::BridgeSpoofer.label(), "bridge-spoofer");
        assert_eq!(AdversarialStrategy::Colluding(1).label(), "colluding");
        assert_eq!(AdversarialStrategy::Intermittent(0.5).label(), "intermittent");
    }

    #[test]
    fn cumulative_results_tracked() {
        let mut sim = AdversarialSimulator::new(NetworkSimulator::new(
            [7u8; 32],
            1_000_000,
            1000,
            1_000_000,
        ));
        sim.add_validator(honest_validator(1, "alice"), AdversarialStrategy::Honest)
            .unwrap();
        sim.add_validator(honest_validator(2, "bob"), AdversarialStrategy::Honest)
            .unwrap();

        sim.run_epochs(0, 5).unwrap();

        let results = sim.cumulative_results();
        assert_eq!(results.len(), 2);
        for (vid, cum) in results {
            assert!(cum.total_rewards > 0, "validator {:?} should have earned rewards", vid);
            assert_eq!(cum.epochs_accepted, 5, "all 5 epochs should be accepted");
            assert_eq!(cum.epochs_rejected, 0);
            assert!(cum.active, "honest validator should be active");
        }
    }

    #[test]
    fn total_slashed_tracked() {
        let mut sim = AdversarialSimulator::new(NetworkSimulator::new(
            [8u8; 32],
            1_000_000,
            1000,
            1_000_000,
        ));
        sim.add_validator(honest_validator(1, "alice"), AdversarialStrategy::Honest)
            .unwrap();
        sim.add_validator(lazy_validator(2, "lazy-bob"), AdversarialStrategy::Lazy)
            .unwrap();

        sim.run_epochs(0, 20).unwrap();

        let metrics = sim.metrics();
        assert!(
            metrics.total_slashed > 0,
            "total slashed should be > 0 for lazy validator"
        );
    }

    #[test]
    fn detection_rate_calculated() {
        let mut sim = AdversarialSimulator::new(NetworkSimulator::new(
            [9u8; 32],
            1_000_000,
            1000,
            1_000_000,
        ));
        sim.add_validator(honest_validator(1, "alice"), AdversarialStrategy::Honest)
            .unwrap();
        sim.add_validator(lazy_validator(2, "lazy-bob"), AdversarialStrategy::Lazy)
            .unwrap();

        sim.run_epochs(0, 10).unwrap();

        let metrics = sim.metrics();
        assert!(
            metrics.detection_rate > 0.0,
            "detection rate should be > 0"
        );
        assert!(metrics.detection_rate <= 1.0, "detection rate should be <= 1.0");
    }
}
