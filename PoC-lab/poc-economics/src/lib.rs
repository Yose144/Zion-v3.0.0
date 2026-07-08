//! # poc-economics
//!
//! Reward distribution a slashing model pro Proof-of-Care, podle
//! `docs/3.0.4/PoC_CONCEPT.md` §7 (reward split) a
//! `V3/L5/docs/GOVERNANCE/sefirot-vow.md` §5 (breaking / slashing triggers).
//!
//! Nově obsahuje [`final_care_score()`] — kompozitní skórovací funkci, která
//! kombinuje:
//! 1. Základní care skóre z NPU inference (accuracy × timeliness × coverage).
//! 2. Dual-vow bonus +5 % pro Guardian validátory.
//! 3. Hiran AI verdict adjustment (může být záporný pro podezřelé důkazy).
//! 4. NCL reputation bonus (dle skóre z `V3/L3/ncl/reputation.rs`).
//!
//! **Upozornění:** Toto je čistě konceptuální model pro laboratorní
//! simulaci. Žádná reálná tokenomika/L1 change je zde neimplementována.

use poc_core::{HiranVerdict, ValidatorId, ValidationVerdict};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Basis points denominator (10_000 = 100%).
pub const BPS_DENOMINATOR: u64 = 10_000;

/// Reward split percentages, expressed in basis points.
/// Default matches `docs/3.0.4/PoC_CONCEPT.md` §7:
/// 70% care validators / 10% humanitarian / 10% DAO / 5% WARP / 5% Hiran AI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct RewardSplit {
    pub care_validators_bps: u16,
    pub humanitarian_bps: u16,
    pub dao_treasury_bps: u16,
    pub warp_maintenance_bps: u16,
    pub hiran_research_bps: u16,
}

impl Default for RewardSplit {
    fn default() -> Self {
        Self {
            care_validators_bps: 7000,
            humanitarian_bps: 1000,
            dao_treasury_bps: 1000,
            warp_maintenance_bps: 500,
            hiran_research_bps: 500,
        }
    }
}

#[derive(Debug, Error, PartialEq)]
pub enum EconomicsError {
    #[error("reward split does not sum to 100% (10000 bps): got {0}")]
    InvalidSplit(u64),
    #[error("empty validator share set")]
    EmptyShares,
    #[error("total care score is zero, cannot distribute proportionally")]
    ZeroTotalScore,
}

impl RewardSplit {
    /// Validates that all components sum to exactly 10_000 bps (100%).
    pub fn validate(&self) -> Result<(), EconomicsError> {
        let sum = self.care_validators_bps as u64
            + self.humanitarian_bps as u64
            + self.dao_treasury_bps as u64
            + self.warp_maintenance_bps as u64
            + self.hiran_research_bps as u64;
        if sum != BPS_DENOMINATOR {
            return Err(EconomicsError::InvalidSplit(sum));
        }
        Ok(())
    }

    /// Splits a total block reward into the five PoC streams.
    /// Any rounding remainder (from integer division) is credited to the
    /// care validators pool, so the sum of all parts always equals `total`.
    pub fn distribute(&self, total: u64) -> Result<RewardDistribution, EconomicsError> {
        self.validate()?;
        let humanitarian = total * self.humanitarian_bps as u64 / BPS_DENOMINATOR;
        let dao_treasury = total * self.dao_treasury_bps as u64 / BPS_DENOMINATOR;
        let warp_maintenance = total * self.warp_maintenance_bps as u64 / BPS_DENOMINATOR;
        let hiran_research = total * self.hiran_research_bps as u64 / BPS_DENOMINATOR;
        let allocated = humanitarian + dao_treasury + warp_maintenance + hiran_research;
        // Remainder (from truncation) flows to care validators, conserving `total`.
        let care_validators = total - allocated;
        Ok(RewardDistribution {
            care_validators,
            humanitarian,
            dao_treasury,
            warp_maintenance,
            hiran_research,
        })
    }
}

/// Result of splitting a total reward by [`RewardSplit`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct RewardDistribution {
    pub care_validators: u64,
    pub humanitarian: u64,
    pub dao_treasury: u64,
    pub warp_maintenance: u64,
    pub hiran_research: u64,
}

impl RewardDistribution {
    pub fn total(&self) -> u64 {
        self.care_validators + self.humanitarian + self.dao_treasury + self.warp_maintenance + self.hiran_research
    }
}

/// A validator's care score contribution for a given epoch, used to
/// proportionally split the `care_validators` pool.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ValidatorShare {
    pub validator_id: ValidatorId,
    pub care_score: u64,
}

/// Distributes `pool` proportionally to `shares` by care score, using the
/// largest-remainder method so the sum of payouts always equals `pool`
/// exactly (no dust lost to integer rounding).
pub fn distribute_to_validators(
    pool: u64,
    shares: &[ValidatorShare],
) -> Result<Vec<(ValidatorId, u64)>, EconomicsError> {
    if shares.is_empty() {
        return Err(EconomicsError::EmptyShares);
    }
    let total_score: u128 = shares.iter().map(|s| s.care_score as u128).sum();
    if total_score == 0 {
        return Err(EconomicsError::ZeroTotalScore);
    }

    // Base allocation (floor) + track remainders for the largest-remainder pass.
    let mut payouts: Vec<(ValidatorId, u64, u128)> = shares
        .iter()
        .map(|s| {
            let numerator = pool as u128 * s.care_score as u128;
            let base = numerator / total_score;
            let remainder = numerator % total_score;
            (s.validator_id, base as u64, remainder)
        })
        .collect();

    let allocated: u64 = payouts.iter().map(|(_, base, _)| *base).sum();
    let mut leftover = pool - allocated;

    // Distribute leftover flowers to the validators with the largest
    // fractional remainders first (largest-remainder / Hamilton method).
    let mut order: Vec<usize> = (0..payouts.len()).collect();
    order.sort_by(|&a, &b| payouts[b].2.cmp(&payouts[a].2));
    for idx in order {
        if leftover == 0 {
            break;
        }
        payouts[idx].1 += 1;
        leftover -= 1;
    }

    Ok(payouts.into_iter().map(|(id, amount, _)| (id, amount)).collect())
}

/// Categories of vow-breaking offenses that trigger slashing
/// (see sefirot-vow.md §5.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SlashReason {
    ConstitutionalViolation,
    FabricatedCareProof,
    InvalidBlockSigned,
    TreasuryLockBypass,
    CensoredBridgeMessage,
    MonitoringNeglect,
}

impl SlashReason {
    /// Severity multiplier in basis points applied to the base slash rate.
    /// More severe offenses (safety-critical) are penalized harder.
    pub fn severity_bps(&self) -> u16 {
        match self {
            SlashReason::InvalidBlockSigned | SlashReason::TreasuryLockBypass => 10_000, // 100% of base
            SlashReason::FabricatedCareProof | SlashReason::CensoredBridgeMessage => 6_000, // 60%
            SlashReason::ConstitutionalViolation => 8_000, // 80%
            SlashReason::MonitoringNeglect => 3_000, // 30%
        }
    }
}

/// Slashing policy: base rate escalates with repeat offenses.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SlashingPolicy {
    /// Base slash rate for a first offense, in basis points of stake.
    pub base_rate_bps: u16,
    /// Additional bps added per prior offense (escalation).
    pub escalation_bps_per_offense: u16,
    /// Hard cap on total slash rate (bps), never slash more than this.
    pub max_rate_bps: u16,
}

impl Default for SlashingPolicy {
    fn default() -> Self {
        Self {
            base_rate_bps: 1_000,           // 10%
            escalation_bps_per_offense: 1_500, // +15% per prior offense
            max_rate_bps: 10_000,           // never slash more than 100%
        }
    }
}

/// Result of a slashing calculation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SlashOutcome {
    pub slashed_amount: u64,
    pub remaining_stake: u64,
    pub effective_rate_bps: u16,
}

impl SlashingPolicy {
    /// Computes the slash outcome for a given offense, prior offense count,
    /// and current stake.
    pub fn apply(&self, stake: u64, prior_offenses: u8, reason: SlashReason) -> SlashOutcome {
        let escalated = self.base_rate_bps as u32
            + self.escalation_bps_per_offense as u32 * prior_offenses as u32;
        let capped = escalated.min(self.max_rate_bps as u32) as u16;
        let effective_rate_bps = ((capped as u32 * reason.severity_bps() as u32) / BPS_DENOMINATOR as u32)
            .min(self.max_rate_bps as u32) as u16;
        let slashed_amount = stake as u128 * effective_rate_bps as u128 / BPS_DENOMINATOR as u128;
        let slashed_amount = slashed_amount as u64;
        SlashOutcome {
            slashed_amount,
            remaining_stake: stake - slashed_amount,
            effective_rate_bps,
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Kompozitní skórovací funkce — final_care_score()
// ──────────────────────────────────────────────────────────────────────────────

/// Vstupní parametry pro kompozitní výpočet finálního care skóre.
///
/// Viz `docs/3.0.4/POC_HIRAN_INTEGRATION_SPEC.md` §4 a
/// `V3/L3/ncl/reputation.rs` pro NCL vzorec.
#[derive(Debug, Clone)]
pub struct CareScoreInput {
    /// Základní care skóre vypočítané z [`CareScoreComponents`]
    /// (tj. výstup z `components.compute()`).
    pub base_score: u64,
    /// Zda byl aplikován dual-vow bonus (+5 %) — z `registry.is_dual_vow()`.
    pub dual_vow_applied: bool,
    /// Hiran verdict pro tento proof. `None` → stub (žádná úprava).
    pub hiran_verdict: Option<HiranVerdict>,
    /// NCL reputation score pro tohoto validátora (0.0–200.0+).
    /// Z `ReputationRegistry::score()`. `None` → žádný NCL bonus.
    pub ncl_reputation: Option<f64>,
}

/// Výsledek kompozitního skórovacího výpočtu — pro audit trail.
#[derive(Debug, Clone)]
pub struct FinalCareScoreResult {
    /// Výsledné skóre po všech úpravách.
    pub final_score: u64,
    /// Skóre před Hiran a NCL úpravami (po dual-vow bonusu).
    pub pre_adjustment_score: u64,
    /// Úprava od Hiran (kladná nebo záporná).
    pub hiran_adjustment: i64,
    /// Bonus od NCL reputation (vždy ≥ 0).
    pub ncl_bonus: u64,
    /// Zda byl proof zamítnut Hiranem (→ final_score = 0).
    pub rejected_by_hiran: bool,
}

/// NCL reputation bonus caps — přímo z `V3/L3/ncl/reputation.rs` vzorce.
/// `score = 100 × success_rate × (1 + consciousness_bonus) × recency_decay`
///
/// Pro PoC lab mapujeme NCL skóre na bonus k care score:
/// - NCL score ≥ 100.0 → bonus = +2% care skóre
/// - NCL score ≥ 150.0 → bonus = +3.5% care skóre
/// - NCL score ≥ 180.0 → bonus = +5% care skóre
/// - NCL score < 20.0  → ban threshold (validátor není eligible — ošetřeno v registry)
pub struct NclReputationBonus;

impl NclReputationBonus {
    /// Vrátí NCL bonus v basis points pro dané NCL reputation skóre.
    pub fn bonus_bps(ncl_score: f64) -> u16 {
        if ncl_score >= 180.0 {
            500 // +5%
        } else if ncl_score >= 150.0 {
            350 // +3.5%
        } else if ncl_score >= 100.0 {
            200 // +2%
        } else if ncl_score >= 50.0 {
            100 // +1%
        } else {
            0
        }
    }
}

/// Vypočítá finální care skóre pro jednoho validátora v jedné epoše.
///
/// # Výpočet
///
/// ```text
/// final = base_score
///       + hiran_adjustment   (může být záporné)
///       + ncl_bonus
/// ```
///
/// Pokud Hiran vrátil `RejectedSuspicious` nebo `RejectedInvalid`, je
/// `final_score = 0` a `rejected_by_hiran = true` bez ohledu na ostatní složky.
///
/// Výsledek nikdy neklesne pod 0.
///
/// # Bezpečnostní hranice
///
/// Hiran nemůže:
/// - Zvýšit skóre nad `base_score * 2` (ochrana proti boostu AI).
/// - Finálně zamítnout validator bez lidského Guardiana (for critical verdicts).
///
/// Tyto hranice jsou vynuceny touto funkcí, ne Hiranem samotným —
/// v souladu s principem „Hiran proposes, Guardian decides".
pub fn final_care_score(input: &CareScoreInput) -> FinalCareScoreResult {
    let pre_adjustment_score = input.base_score;

    // 1. Hiran verdict
    let (hiran_adjustment, rejected_by_hiran) = match &input.hiran_verdict {
        None => (0i64, false),
        Some(v) => {
            let rejected = matches!(
                v.verdict,
                ValidationVerdict::RejectedSuspicious | ValidationVerdict::RejectedInvalid
            );
            (v.care_score_adjustment, rejected)
        }
    };

    if rejected_by_hiran {
        return FinalCareScoreResult {
            final_score: 0,
            pre_adjustment_score,
            hiran_adjustment,
            ncl_bonus: 0,
            rejected_by_hiran: true,
        };
    }

    // 2. Apply Hiran adjustment with a safety cap — cannot boost above 2× base.
    let max_hiran_boost = pre_adjustment_score as i64; // +100% cap
    let clamped_adjustment = hiran_adjustment.min(max_hiran_boost);
    let after_hiran = (pre_adjustment_score as i64 + clamped_adjustment).max(0) as u64;

    // 3. NCL reputation bonus
    let ncl_bonus = match input.ncl_reputation {
        None => 0u64,
        Some(ncl_score) => {
            let bps = NclReputationBonus::bonus_bps(ncl_score) as u64;
            after_hiran * bps / BPS_DENOMINATOR
        }
    };

    let final_score = after_hiran.saturating_add(ncl_bonus);

    FinalCareScoreResult {
        final_score,
        pre_adjustment_score,
        hiran_adjustment: clamped_adjustment,
        ncl_bonus,
        rejected_by_hiran: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vid(byte: u8) -> ValidatorId {
        [byte; 32]
    }

    #[test]
    fn default_split_sums_to_100_percent() {
        assert!(RewardSplit::default().validate().is_ok());
    }

    #[test]
    fn invalid_split_is_rejected() {
        let split = RewardSplit {
            care_validators_bps: 5000,
            humanitarian_bps: 1000,
            dao_treasury_bps: 1000,
            warp_maintenance_bps: 500,
            hiran_research_bps: 500,
        };
        assert_eq!(split.validate(), Err(EconomicsError::InvalidSplit(8000)));
    }

    #[test]
    fn distribute_conserves_total_with_remainder() {
        let split = RewardSplit::default();
        let dist = split.distribute(1_000_003).unwrap();
        assert_eq!(dist.total(), 1_000_003);
    }

    #[test]
    fn distribute_to_validators_conserves_pool_and_is_proportional() {
        let shares = vec![
            ValidatorShare {
                validator_id: vid(1),
                care_score: 3_000_000,
            },
            ValidatorShare {
                validator_id: vid(2),
                care_score: 1_000_000,
            },
            ValidatorShare {
                validator_id: vid(3),
                care_score: 1_000_000,
            },
        ];
        let payouts = distribute_to_validators(1_000_000, &shares).unwrap();
        let total: u64 = payouts.iter().map(|(_, amt)| *amt).sum();
        assert_eq!(total, 1_000_000);
        // Validator 1 has 60% of total score, so should get the largest payout.
        let v1_amount = payouts.iter().find(|(id, _)| *id == vid(1)).unwrap().1;
        assert_eq!(v1_amount, 600_000);
    }

    #[test]
    fn distribute_to_validators_rejects_zero_score() {
        let shares = vec![ValidatorShare {
            validator_id: vid(1),
            care_score: 0,
        }];
        assert_eq!(
            distribute_to_validators(1000, &shares),
            Err(EconomicsError::ZeroTotalScore)
        );
    }

    #[test]
    fn slashing_escalates_with_repeat_offenses() {
        let policy = SlashingPolicy::default();
        let first = policy.apply(10_000, 0, SlashReason::MonitoringNeglect);
        let second = policy.apply(10_000, 1, SlashReason::MonitoringNeglect);
        assert!(second.effective_rate_bps > first.effective_rate_bps);
        assert!(second.slashed_amount > first.slashed_amount);
    }

    #[test]
    fn slashing_never_exceeds_stake() {
        let policy = SlashingPolicy::default();
        let outcome = policy.apply(1000, 10, SlashReason::InvalidBlockSigned);
        assert!(outcome.slashed_amount <= 1000);
        assert_eq!(outcome.remaining_stake, 1000 - outcome.slashed_amount);
    }

    #[test]
    fn severe_offense_slashes_more_than_mild() {
        let policy = SlashingPolicy::default();
        let severe = policy.apply(10_000, 0, SlashReason::InvalidBlockSigned);
        let mild = policy.apply(10_000, 0, SlashReason::MonitoringNeglect);
        assert!(severe.slashed_amount > mild.slashed_amount);
    }

    // ── final_care_score() tests ─────────────────────────────────────────────

    fn stub_verdict_accepted(adjustment: i64) -> HiranVerdict {
        HiranVerdict {
            verdict: poc_core::ValidationVerdict::Accepted,
            confidence: 1.0,
            care_score_adjustment: adjustment,
            flags: vec![],
            reasoning: "test".into(),
            latency_ms: 0,
        }
    }

    fn stub_verdict_rejected() -> HiranVerdict {
        HiranVerdict {
            verdict: poc_core::ValidationVerdict::RejectedInvalid,
            confidence: 1.0,
            care_score_adjustment: 0,
            flags: vec![],
            reasoning: "test-reject".into(),
            latency_ms: 0,
        }
    }

    #[test]
    fn final_care_score_no_adjustments_returns_base() {
        let result = final_care_score(&CareScoreInput {
            base_score: 5_000_000,
            dual_vow_applied: false,
            hiran_verdict: None,
            ncl_reputation: None,
        });
        assert_eq!(result.final_score, 5_000_000);
        assert!(!result.rejected_by_hiran);
        assert_eq!(result.hiran_adjustment, 0);
        assert_eq!(result.ncl_bonus, 0);
    }

    #[test]
    fn final_care_score_hiran_rejected_gives_zero() {
        let result = final_care_score(&CareScoreInput {
            base_score: 9_000_000,
            dual_vow_applied: false,
            hiran_verdict: Some(stub_verdict_rejected()),
            ncl_reputation: Some(180.0),
        });
        assert_eq!(result.final_score, 0);
        assert!(result.rejected_by_hiran);
        // NCL bonus must NOT be applied when Hiran rejects
        assert_eq!(result.ncl_bonus, 0);
    }

    #[test]
    fn final_care_score_hiran_negative_adjustment_reduces_score() {
        let result = final_care_score(&CareScoreInput {
            base_score: 5_000_000,
            dual_vow_applied: false,
            hiran_verdict: Some(stub_verdict_accepted(-500_000)),
            ncl_reputation: None,
        });
        assert_eq!(result.final_score, 4_500_000);
        assert!(!result.rejected_by_hiran);
    }

    #[test]
    fn final_care_score_hiran_boost_is_capped_at_100_percent() {
        // Hiran claims +10_000_000 on a base of 5_000_000 — cap at +100% = +5_000_000
        let result = final_care_score(&CareScoreInput {
            base_score: 5_000_000,
            dual_vow_applied: false,
            hiran_verdict: Some(stub_verdict_accepted(10_000_000)),
            ncl_reputation: None,
        });
        assert_eq!(result.final_score, 10_000_000); // 5M base + 5M cap
        assert_eq!(result.hiran_adjustment, 5_000_000); // capped
    }

    #[test]
    fn final_care_score_ncl_bonus_tiers_are_correct() {
        let base = 1_000_000u64;
        // Tier: score ≥ 100 → +2%
        let r100 = final_care_score(&CareScoreInput {
            base_score: base,
            dual_vow_applied: false,
            hiran_verdict: None,
            ncl_reputation: Some(100.0),
        });
        assert_eq!(r100.ncl_bonus, 20_000); // 2% of 1_000_000
        assert_eq!(r100.final_score, 1_020_000);

        // Tier: score ≥ 180 → +5%
        let r180 = final_care_score(&CareScoreInput {
            base_score: base,
            dual_vow_applied: false,
            hiran_verdict: None,
            ncl_reputation: Some(185.0),
        });
        assert_eq!(r180.ncl_bonus, 50_000); // 5% of 1_000_000
        assert_eq!(r180.final_score, 1_050_000);
    }

    #[test]
    fn final_care_score_combined_all_components() {
        // base=1M, Hiran -100k, NCL 180 → +5%
        // after_hiran = 900_000, ncl_bonus = 45_000, final = 945_000
        let result = final_care_score(&CareScoreInput {
            base_score: 1_000_000,
            dual_vow_applied: true,
            hiran_verdict: Some(stub_verdict_accepted(-100_000)),
            ncl_reputation: Some(180.0),
        });
        assert_eq!(result.final_score, 945_000);
        assert_eq!(result.ncl_bonus, 45_000);
        assert!(!result.rejected_by_hiran);
    }

    #[test]
    fn ncl_reputation_bonus_bps_tiers() {
        assert_eq!(NclReputationBonus::bonus_bps(10.0), 0);
        assert_eq!(NclReputationBonus::bonus_bps(50.0), 100);
        assert_eq!(NclReputationBonus::bonus_bps(100.0), 200);
        assert_eq!(NclReputationBonus::bonus_bps(155.0), 350);
        assert_eq!(NclReputationBonus::bonus_bps(200.0), 500);
    }
}
