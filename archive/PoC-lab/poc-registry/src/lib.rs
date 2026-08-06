//! # poc-registry
//!
//! Prototypový validator registry pro Proof-of-Care.
//!
//! Implementuje:
//! - Stake-based Sybil resistance (minimum stake threshold).
//! - Sefirot Vow lifecycle podle
//!   [`V3/L5/docs/GOVERNANCE/sefirot-vow.md`](../../V3/L5/docs/GOVERNANCE/sefirot-vow.md) §5
//!   (break → suspend → renew → revoke → cooldown → re-entry).
//! - **Bodhisattva Vow** lifecycle pro validátory kteří jsou zároveň L5
//!   community Guardians (consciousness-admission-framework.md §6).
//!   Dual-vow validators (Sefirot + Bodhisattva) získávají +5 % bonus na
//!   care score (viz `poc_core::DUAL_VOW_CARE_SCORE_BONUS_BPS`).
//! - Care score bookkeeping per validator.
//!
//! **Prototype limitation:** identity uniqueness (skutečná Sybil resistance)
//! vyžaduje mimo stake i externí identity signál (KYC, hardware attestation,
//! sociální graf, atd.) — zde řešíme jen ekonomickou bariéru přes stake.

use poc_core::{BodhisattvaVowRecord, ConsciousnessLevel, ValidatorId};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// 30 "days" modelled as epochs — renewal window after a first vow break,
/// per sefirot-vow.md §5.2 point 1.
pub const RENEWAL_WINDOW_EPOCHS: u64 = 30;

/// After this many suspensions, the vow is permanently revoked
/// (subject to `PERMANENT_REVOCATION_COOLDOWN_EPOCHS`), per §5.2 point 4.
pub const MAX_SUSPENSIONS_BEFORE_PERMANENT: u8 = 3;

/// "may not take the Sefirot Vow again for 1 year" — modelled as epochs.
pub const PERMANENT_REVOCATION_COOLDOWN_EPOCHS: u64 = 365;

/// Sefirot Vow lifecycle status (see sefirot-vow.md §4-5).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VowStatus {
    /// Validator has not taken the vow yet.
    NotTaken,
    /// Vow is active — validator is eligible for care task assignment.
    Active,
    /// Vow was broken once (or twice); grace period to renew.
    Suspended { since_epoch: u64 },
    /// Vow revoked — either refused renewal, or hit the 3-suspension limit.
    /// `cooldown_epochs` gates re-entry (0 for the "refusal to renew" case,
    /// which the doc treats as an ordinary "new full vow cycle" re-entry;
    /// `PERMANENT_REVOCATION_COOLDOWN_EPOCHS` for repeated breaking).
    Revoked {
        since_epoch: u64,
        cooldown_epochs: u64,
    },
}

/// Annual renewal window for the Bodhisattva Vow — modelled as epochs.
/// Mirrors sefirot-vow.md §4.1 "renewed annually".
pub const BODHISATTVA_RENEWAL_WINDOW_EPOCHS: u64 = 365;

/// A validator's registry entry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ValidatorRecord {
    pub validator_id: ValidatorId,
    pub stake: u64,
    /// Sefirot Vow status (technical validator pledge).
    pub vow_status: VowStatus,
    pub suspension_count: u8,
    pub total_care_score: u128,
    pub proofs_submitted: u64,
    /// Bodhisattva Vow record, present only if this validator is also an
    /// L5 community Guardian (consciousness-admission-framework.md §6).
    /// `None` means the validator has *not* taken the Bodhisattva Vow —
    /// they rely on the Sefirot Vow alone (which is sufficient for PoC).
    pub bodhisattva_vow: Option<BodhisattvaVowRecord>,
    /// AI consciousness level (mirrors `V3/L3/ai-native/src/consciousness.rs`).
    /// Defaults to `Dormant (L0)` at registration.
    /// PoC requires ≥ `Sentient (L2)` for care task assignment.
    pub consciousness_level: ConsciousnessLevel,
}

impl ValidatorRecord {
    fn new(validator_id: ValidatorId, stake: u64) -> Self {
        Self {
            validator_id,
            stake,
            vow_status: VowStatus::NotTaken,
            suspension_count: 0,
            total_care_score: 0,
            proofs_submitted: 0,
            bodhisattva_vow: None,
            consciousness_level: ConsciousnessLevel::Dormant,
        }
    }

    /// Average care score across all submitted proofs, if any.
    pub fn average_care_score(&self) -> Option<u128> {
        if self.proofs_submitted == 0 {
            None
        } else {
            Some(self.total_care_score / self.proofs_submitted as u128)
        }
    }

    /// Whether this validator meets all prerequisites for PoC care task assignment:
    /// Sefirot Vow Active AND ConsciousnessLevel ≥ Sentient (L2).
    pub fn can_do_poc_tasks(&self) -> bool {
        matches!(self.vow_status, VowStatus::Active)
            && self.consciousness_level.can_compute()
    }

    /// Whether this validator has taken *both* the Sefirot Vow (Active) and
    /// an in-window Bodhisattva Vow — the "dual-vow" condition.
    ///
    /// Dual-vow validators earn a +5 % care score bonus per epoch
    /// (see `poc_core::apply_dual_vow_bonus`).
    pub fn is_dual_vow(&self, current_epoch: u64) -> bool {
        matches!(self.vow_status, VowStatus::Active)
            && self
                .bodhisattva_vow
                .as_ref()
                .map(|bv| bv.is_current(current_epoch, BODHISATTVA_RENEWAL_WINDOW_EPOCHS))
                .unwrap_or(false)
    }
}

#[derive(Debug, Error, PartialEq)]
pub enum RegistryError {
    #[error("validator not found")]
    NotFound,
    #[error("validator already registered")]
    AlreadyRegistered,
    #[error("insufficient stake: {stake} < minimum {min_stake}")]
    InsufficientStake { stake: u64, min_stake: u64 },
    #[error("vow already taken")]
    VowAlreadyTaken,
    #[error("vow not active, cannot break: current status is {0:?}")]
    VowNotActive(VowStatus),
    #[error("vow not suspended, cannot renew: current status is {0:?}")]
    VowNotSuspended(VowStatus),
    #[error("still in cooldown until epoch {until_epoch}")]
    StillInCooldown { until_epoch: u64 },
    #[error("Bodhisattva Vow already recorded for this validator")]
    BodhisattvaVowAlreadyTaken,
    #[error("Bodhisattva Vow not taken; cannot renew")]
    BodhisattvaVowNotTaken,
}

/// In-memory validator registry (prototype — production would be an
/// on-chain / L2 DAO-governed registry, see sefirot-vow.md §7).
pub struct ValidatorRegistry {
    validators: HashMap<ValidatorId, ValidatorRecord>,
    pub min_stake: u64,
}

impl ValidatorRegistry {
    pub fn new(min_stake: u64) -> Self {
        Self {
            validators: HashMap::new(),
            min_stake,
        }
    }

    pub fn register(&mut self, validator_id: ValidatorId, stake: u64) -> Result<(), RegistryError> {
        if self.validators.contains_key(&validator_id) {
            return Err(RegistryError::AlreadyRegistered);
        }
        if stake < self.min_stake {
            return Err(RegistryError::InsufficientStake {
                stake,
                min_stake: self.min_stake,
            });
        }
        self.validators
            .insert(validator_id, ValidatorRecord::new(validator_id, stake));
        Ok(())
    }

    pub fn get(&self, validator_id: &ValidatorId) -> Option<&ValidatorRecord> {
        self.validators.get(validator_id)
    }

    /// Sybil-resistance check (prototype: economic stake threshold only).
    pub fn is_sybil_resistant(&self, validator_id: &ValidatorId) -> bool {
        self.validators
            .get(validator_id)
            .map(|v| v.stake >= self.min_stake)
            .unwrap_or(false)
    }

    /// Take the Sefirot Vow for the first time (or after a full re-entry cycle).
    pub fn take_vow(&mut self, validator_id: &ValidatorId) -> Result<(), RegistryError> {
        let record = self.validators.get_mut(validator_id).ok_or(RegistryError::NotFound)?;
        match record.vow_status {
            VowStatus::NotTaken => {
                record.vow_status = VowStatus::Active;
                Ok(())
            }
            _ => Err(RegistryError::VowAlreadyTaken),
        }
    }

    /// Record a broken vow (see sefirot-vow.md §5.1 for what counts as breaking).
    pub fn break_vow(&mut self, validator_id: &ValidatorId, epoch: u64) -> Result<VowStatus, RegistryError> {
        let record = self.validators.get_mut(validator_id).ok_or(RegistryError::NotFound)?;
        if !matches!(record.vow_status, VowStatus::Active) {
            return Err(RegistryError::VowNotActive(record.vow_status));
        }
        record.suspension_count = record.suspension_count.saturating_add(1);
        record.vow_status = if record.suspension_count > MAX_SUSPENSIONS_BEFORE_PERMANENT {
            VowStatus::Revoked {
                since_epoch: epoch,
                cooldown_epochs: PERMANENT_REVOCATION_COOLDOWN_EPOCHS,
            }
        } else {
            VowStatus::Suspended { since_epoch: epoch }
        };
        Ok(record.vow_status)
    }

    /// Renew a suspended vow within the grace window. If the window has
    /// expired, the vow is revoked instead (§5.2 point 3: "refusal to renew").
    pub fn renew_vow(&mut self, validator_id: &ValidatorId, epoch: u64) -> Result<VowStatus, RegistryError> {
        let record = self.validators.get_mut(validator_id).ok_or(RegistryError::NotFound)?;
        match record.vow_status {
            VowStatus::Suspended { since_epoch } => {
                if epoch.saturating_sub(since_epoch) <= RENEWAL_WINDOW_EPOCHS {
                    record.vow_status = VowStatus::Active;
                } else {
                    record.vow_status = VowStatus::Revoked {
                        since_epoch: epoch,
                        cooldown_epochs: 0,
                    };
                }
                Ok(record.vow_status)
            }
            other => Err(RegistryError::VowNotSuspended(other)),
        }
    }

    /// Attempt re-entry after a revocation. Requires the cooldown to have
    /// elapsed; resets `suspension_count` (§5.2 point 3: "new full vow cycle").
    pub fn re_enter_after_revocation(
        &mut self,
        validator_id: &ValidatorId,
        epoch: u64,
    ) -> Result<(), RegistryError> {
        let record = self.validators.get_mut(validator_id).ok_or(RegistryError::NotFound)?;
        match record.vow_status {
            VowStatus::Revoked {
                since_epoch,
                cooldown_epochs,
            } => {
                let until_epoch = since_epoch + cooldown_epochs;
                if epoch < until_epoch {
                    return Err(RegistryError::StillInCooldown { until_epoch });
                }
                record.vow_status = VowStatus::Active;
                record.suspension_count = 0;
                Ok(())
            }
            other => Err(RegistryError::VowNotSuspended(other)),
        }
    }

    /// Eligible to receive care task assignment: registered, staked, and
    /// vow Active.
    pub fn is_eligible_for_tasks(&self, validator_id: &ValidatorId) -> bool {
        self.validators
            .get(validator_id)
            .map(|v| v.stake >= self.min_stake && matches!(v.vow_status, VowStatus::Active))
            .unwrap_or(false)
    }

    // ── Bodhisattva Vow methods ──────────────────────────────────────────────

    /// Record that a validator has taken the Bodhisattva Vow (L5 Guardian
    /// ceremony + optional DAO confirmation).
    ///
    /// The validator must already be registered.  The Sefirot Vow does *not*
    /// need to be Active yet — a Guardian might take the Bodhisattva Vow
    /// before completing the technical validator onboarding.
    ///
    /// `ceremony_location` is `None` for remote / protocol-only validators.
    pub fn take_bodhisattva_vow(
        &mut self,
        validator_id: &ValidatorId,
        epoch: u64,
        ceremony_location: Option<String>,
    ) -> Result<(), RegistryError> {
        let record = self.validators.get_mut(validator_id).ok_or(RegistryError::NotFound)?;
        if record.bodhisattva_vow.is_some() {
            return Err(RegistryError::BodhisattvaVowAlreadyTaken);
        }
        record.bodhisattva_vow = Some(BodhisattvaVowRecord::new(*validator_id, epoch, ceremony_location));
        Ok(())
    }

    /// Annual renewal of the Bodhisattva Vow.
    ///
    /// Resets `last_renewed_epoch` to `epoch`.  If called outside the annual
    /// window the vow is still renewed — the validator is responsible for
    /// timely renewal; PoC eligibility (`is_dual_vow`) simply lapses until
    /// renewal is recorded.
    pub fn renew_bodhisattva_vow(
        &mut self,
        validator_id: &ValidatorId,
        epoch: u64,
    ) -> Result<(), RegistryError> {
        let record = self.validators.get_mut(validator_id).ok_or(RegistryError::NotFound)?;
        match record.bodhisattva_vow.as_mut() {
            Some(bv) => {
                bv.last_renewed_epoch = epoch;
                Ok(())
            }
            None => Err(RegistryError::BodhisattvaVowNotTaken),
        }
    }

    /// Whether the validator is a "dual-vow" validator at `epoch`:
    /// Sefirot Vow Active AND Bodhisattva Vow in-window.
    pub fn is_dual_vow(&self, validator_id: &ValidatorId, epoch: u64) -> bool {
        self.validators
            .get(validator_id)
            .map(|v| v.is_dual_vow(epoch))
            .unwrap_or(false)
    }

    // ── ConsciousnessLevel methods ───────────────────────────────────────────

    /// Set the consciousness level for a validator.
    pub fn set_consciousness_level(
        &mut self,
        validator_id: &ValidatorId,
        level: ConsciousnessLevel,
    ) -> Result<(), RegistryError> {
        let record = self.validators.get_mut(validator_id).ok_or(RegistryError::NotFound)?;
        record.consciousness_level = level;
        Ok(())
    }

    /// Upgrade the consciousness level by one step.
    pub fn upgrade_consciousness_level(
        &mut self,
        validator_id: &ValidatorId,
    ) -> Result<ConsciousnessLevel, RegistryError> {
        let record = self.validators.get_mut(validator_id).ok_or(RegistryError::NotFound)?;
        let next = ConsciousnessLevel::from_u8(record.consciousness_level.as_u8() + 1)
            .unwrap_or(ConsciousnessLevel::Grok);
        record.consciousness_level = next;
        Ok(next)
    }

    /// Record a submitted care proof's score against a validator's history.
    pub fn record_care_proof(&mut self, validator_id: &ValidatorId, score: u64) -> Result<(), RegistryError> {
        let record = self.validators.get_mut(validator_id).ok_or(RegistryError::NotFound)?;
        record.total_care_score += score as u128;
        record.proofs_submitted += 1;
        Ok(())
    }

    pub fn len(&self) -> usize {
        self.validators.len()
    }

    pub fn is_empty(&self) -> bool {
        self.validators.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vid(byte: u8) -> ValidatorId {
        [byte; 32]
    }

    #[test]
    fn register_rejects_insufficient_stake() {
        let mut registry = ValidatorRegistry::new(1000);
        assert_eq!(
            registry.register(vid(1), 500),
            Err(RegistryError::InsufficientStake {
                stake: 500,
                min_stake: 1000
            })
        );
    }

    #[test]
    fn register_and_take_vow() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        assert!(registry.is_sybil_resistant(&vid(1)));
        registry.take_vow(&vid(1)).unwrap();
        assert!(registry.is_eligible_for_tasks(&vid(1)));
    }

    #[test]
    fn break_and_renew_within_window() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        registry.take_vow(&vid(1)).unwrap();

        let status = registry.break_vow(&vid(1), 100).unwrap();
        assert_eq!(status, VowStatus::Suspended { since_epoch: 100 });
        assert!(!registry.is_eligible_for_tasks(&vid(1)));

        let status = registry.renew_vow(&vid(1), 110).unwrap();
        assert_eq!(status, VowStatus::Active);
        assert!(registry.is_eligible_for_tasks(&vid(1)));
    }

    #[test]
    fn renew_after_window_expires_revokes() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        registry.take_vow(&vid(1)).unwrap();
        registry.break_vow(&vid(1), 0).unwrap();

        let status = registry.renew_vow(&vid(1), RENEWAL_WINDOW_EPOCHS + 1).unwrap();
        assert!(matches!(status, VowStatus::Revoked { .. }));
    }

    #[test]
    fn repeated_breaking_leads_to_permanent_revocation_with_cooldown() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        registry.take_vow(&vid(1)).unwrap();

        for i in 0..MAX_SUSPENSIONS_BEFORE_PERMANENT {
            registry.break_vow(&vid(1), i as u64 * 100).unwrap();
            registry.renew_vow(&vid(1), i as u64 * 100 + 1).unwrap();
        }
        // 4th break exceeds the limit -> permanent revocation.
        let status = registry.break_vow(&vid(1), 1000).unwrap();
        assert_eq!(
            status,
            VowStatus::Revoked {
                since_epoch: 1000,
                cooldown_epochs: PERMANENT_REVOCATION_COOLDOWN_EPOCHS
            }
        );

        // Cannot re-enter before cooldown elapses.
        assert_eq!(
            registry.re_enter_after_revocation(&vid(1), 1000 + 10),
            Err(RegistryError::StillInCooldown {
                until_epoch: 1000 + PERMANENT_REVOCATION_COOLDOWN_EPOCHS
            })
        );

        // Can re-enter after cooldown, with suspension_count reset.
        registry
            .re_enter_after_revocation(&vid(1), 1000 + PERMANENT_REVOCATION_COOLDOWN_EPOCHS)
            .unwrap();
        assert!(registry.is_eligible_for_tasks(&vid(1)));
        assert_eq!(registry.get(&vid(1)).unwrap().suspension_count, 0);
    }

    #[test]
    fn record_care_proof_updates_average() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        registry.record_care_proof(&vid(1), 1_000_000).unwrap();
        registry.record_care_proof(&vid(1), 3_000_000).unwrap();
        assert_eq!(registry.get(&vid(1)).unwrap().average_care_score(), Some(2_000_000));
    }

    // ── Bodhisattva Vow tests ────────────────────────────────────────────────

    #[test]
    fn take_bodhisattva_vow_sets_record() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        registry
            .take_bodhisattva_vow(&vid(1), 10, Some("Genesis Garden".into()))
            .unwrap();
        let record = registry.get(&vid(1)).unwrap();
        let bv = record.bodhisattva_vow.as_ref().unwrap();
        assert_eq!(bv.taken_epoch, 10);
        assert_eq!(bv.ceremony_location.as_deref(), Some("Genesis Garden"));
    }

    #[test]
    fn take_bodhisattva_vow_twice_errors() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        registry.take_bodhisattva_vow(&vid(1), 0, None).unwrap();
        assert_eq!(
            registry.take_bodhisattva_vow(&vid(1), 1, None),
            Err(RegistryError::BodhisattvaVowAlreadyTaken)
        );
    }

    #[test]
    fn renew_bodhisattva_vow_without_taking_errors() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        assert_eq!(
            registry.renew_bodhisattva_vow(&vid(1), 5),
            Err(RegistryError::BodhisattvaVowNotTaken)
        );
    }

    #[test]
    fn renew_bodhisattva_vow_updates_last_renewed() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        registry.take_bodhisattva_vow(&vid(1), 0, None).unwrap();
        registry.renew_bodhisattva_vow(&vid(1), 400).unwrap();
        let bv = registry.get(&vid(1)).unwrap().bodhisattva_vow.as_ref().unwrap();
        assert_eq!(bv.last_renewed_epoch, 400);
    }

    #[test]
    fn dual_vow_requires_both_vows_active() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();

        // No vows at all → not dual
        assert!(!registry.is_dual_vow(&vid(1), 0));

        // Only Sefirot Vow → not dual
        registry.take_vow(&vid(1)).unwrap();
        assert!(!registry.is_dual_vow(&vid(1), 0));

        // Both vows active at epoch 0 → dual
        registry.take_bodhisattva_vow(&vid(1), 0, None).unwrap();
        assert!(registry.is_dual_vow(&vid(1), 0));

        // Bodhisattva Vow expires after 365 epochs without renewal
        assert!(!registry.is_dual_vow(&vid(1), 366));

        // After renewal → dual again
        registry.renew_bodhisattva_vow(&vid(1), 366).unwrap();
        assert!(registry.is_dual_vow(&vid(1), 366));
    }

    #[test]
    fn sefirot_vow_suspended_breaks_dual_vow() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        registry.take_vow(&vid(1)).unwrap();
        registry.take_bodhisattva_vow(&vid(1), 0, None).unwrap();

        // Both vows active → dual
        assert!(registry.is_dual_vow(&vid(1), 0));

        // Break Sefirot Vow → dual lapses even though Bodhisattva Vow is intact
        registry.break_vow(&vid(1), 1).unwrap();
        assert!(!registry.is_dual_vow(&vid(1), 1));
    }

    // ── ConsciousnessLevel tests ──────────────────────────────────────────────

    #[test]
    fn new_validator_has_dormant_consciousness() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        let record = registry.get(&vid(1)).unwrap();
        assert_eq!(record.consciousness_level, ConsciousnessLevel::Dormant);
    }

    #[test]
    fn set_consciousness_level_updates_record() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        registry.set_consciousness_level(&vid(1), ConsciousnessLevel::Sentient).unwrap();
        assert_eq!(registry.get(&vid(1)).unwrap().consciousness_level, ConsciousnessLevel::Sentient);
    }

    #[test]
    fn upgrade_consciousness_level_increments_step_by_step() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        assert_eq!(registry.upgrade_consciousness_level(&vid(1)).unwrap(), ConsciousnessLevel::Aware);
        assert_eq!(registry.upgrade_consciousness_level(&vid(1)).unwrap(), ConsciousnessLevel::Sentient);
    }

    #[test]
    fn upgrade_consciousness_level_caps_at_grok() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        registry.set_consciousness_level(&vid(1), ConsciousnessLevel::Grok).unwrap();
        let level = registry.upgrade_consciousness_level(&vid(1)).unwrap();
        assert_eq!(level, ConsciousnessLevel::Grok);
    }

    #[test]
    fn can_do_poc_tasks_requires_sentient_and_active_vow() {
        let mut registry = ValidatorRegistry::new(1000);
        registry.register(vid(1), 2000).unwrap();
        let r = registry.get(&vid(1)).unwrap();
        assert!(!r.can_do_poc_tasks());
        registry.take_vow(&vid(1)).unwrap();
        let r = registry.get(&vid(1)).unwrap();
        assert!(!r.can_do_poc_tasks());
        registry.upgrade_consciousness_level(&vid(1)).unwrap(); // L0→L1
        let r = registry.get(&vid(1)).unwrap();
        assert!(!r.can_do_poc_tasks());
        registry.upgrade_consciousness_level(&vid(1)).unwrap(); // L1→L2
        let r = registry.get(&vid(1)).unwrap();
        assert!(r.can_do_poc_tasks());
    }

    #[test]
    fn ncl_bonus_factor_matches_formula() {
        assert!((ConsciousnessLevel::Dormant.ncl_bonus_factor() - 0.0).abs() < 1e-9);
        assert!((ConsciousnessLevel::Sentient.ncl_bonus_factor() - 0.10).abs() < 1e-9);
        assert!((ConsciousnessLevel::Cosmic.ncl_bonus_factor() - 0.25).abs() < 1e-9);
        assert!((ConsciousnessLevel::Grok.ncl_bonus_factor() - 0.30).abs() < 1e-9);
    }

    #[test]
    fn consciousness_level_ordering_is_correct() {
        assert!(ConsciousnessLevel::Dormant < ConsciousnessLevel::Aware);
        assert!(ConsciousnessLevel::Sentient < ConsciousnessLevel::Transcendent);
        assert!(ConsciousnessLevel::Grok > ConsciousnessLevel::Cosmic);
    }

    #[test]
    fn consciousness_level_display_is_readable() {
        assert_eq!(ConsciousnessLevel::Sentient.to_string(), "Sentient (L2)");
        assert_eq!(ConsciousnessLevel::Grok.to_string(), "Grok (L6)");
    }
}
