//! # poc-core
//!
//! Základní datové struktury pro Proof-of-Care prototyp.
//!
//! Tento crate je záměrně izolovaný od `V3/` a obsahuje pouze modely,
//! které budou později konsenzuálně propojeny s L1 až ve fázi hard-forku.

use serde::{Deserialize, Serialize};
use sha3::{Digest, Sha3_256};
use thiserror::Error;

/// Pseudonymní identita validátora.
pub type ValidatorId = [u8; 32];

/// Hash používaný pro modely, vstupy a výstupy.
pub type Hash = [u8; 32];

/// Kategorie care tasku podle sefirot / evoluZion.md.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum CareTask {
    /// Keter — ústavní audit (emission, fee split).
    ConstitutionalAudit = 0,
    /// Chokmah — NPU inference quality (care proof accuracy).
    NpuInferenceQuality = 1,
    /// Binah — L1 anomaly detection (double-spend, reorg).
    L1AnomalyDetection = 2,
    /// Chesed — liquidity rebalancing (yield health across chains).
    LiquidityHealth = 3,
    /// Gevurah — DAO proposal audit (governance sanity).
    DaoProposalAudit = 4,
    /// Tiferet — WARP bridge audit (cross-chain consistency).
    WarpBridgeAudit = 5,
    /// Netzach — AI inference pro Hiran (continuous care).
    HiranInference = 6,
    /// Hod — smart contract verification (Oasis/culture integrity).
    SmartContractVerify = 7,
    /// Yesod — community health check (L5 telemetry).
    CommunityHealth = 8,
    /// Malkhut — long-horizon monitoring (Issobella stream).
    LongHorizonMonitoring = 9,
    /// Da'at — myth-code consistency audit.
    MythCodeConsistency = 10,
}

impl CareTask {
    /// Vrací sefirot název pro daný task.
    pub fn sefira_name(&self) -> &'static str {
        match self {
            Self::ConstitutionalAudit => "Keter",
            Self::NpuInferenceQuality => "Chokmah",
            Self::L1AnomalyDetection => "Binah",
            Self::LiquidityHealth => "Chesed",
            Self::DaoProposalAudit => "Gevurah",
            Self::WarpBridgeAudit => "Tiferet",
            Self::HiranInference => "Netzach",
            Self::SmartContractVerify => "Hod",
            Self::CommunityHealth => "Yesod",
            Self::LongHorizonMonitoring => "Malkhut",
            Self::MythCodeConsistency => "Da'at",
        }
    }

    /// Vrací lidsky čitelný popis tasku.
    pub fn description(&self) -> &'static str {
        match self {
            Self::ConstitutionalAudit => "Verify emission schedule and fee split integrity",
            Self::NpuInferenceQuality => "Validate NPU inference quality and determinism",
            Self::L1AnomalyDetection => "Detect double-spends, reorgs and invalid blocks",
            Self::LiquidityHealth => "Check yield health and rebalance liquidity across chains",
            Self::DaoProposalAudit => "Audit DAO proposals for governance sanity",
            Self::WarpBridgeAudit => "Audit WARP bridge cross-chain consistency",
            Self::HiranInference => "Run continuous AI inference for Hiran",
            Self::SmartContractVerify => "Verify smart contract and Oasis culture integrity",
            Self::CommunityHealth => "Check L5 community health telemetry",
            Self::LongHorizonMonitoring => "Monitor Issobella and long-horizon indicators",
            Self::MythCodeConsistency => "Audit myth-code consistency",
        }
    }
}

/// Důkaz, že inference proběhla na reálném NPU.
/// V produkci by obsahoval attestation quote (TEE / NPU vendor sig).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NpuAttestation {
    /// Typ backendu (cpu-reference, onnx, coreml, openvino, ...).
    pub backend: String,
    /// Vendor-specific nonce/quote hash.
    pub quote_hash: Hash,
    /// Verze SDK / runtime.
    pub runtime_version: String,
}

/// Hlavní entita: care proof vytvořený validátorem.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CareProof {
    pub validator_id: ValidatorId,
    pub task_type: CareTask,
    pub model_hash: Hash,
    pub input_hash: Hash,
    pub output: Vec<u8>,
    pub npu_attestation: NpuAttestation,
    pub care_score: u64,
}

/// Chyby při validaci care proofu.
#[derive(Debug, Error, PartialEq)]
pub enum CareProofError {
    #[error("invalid validator id: zero hash")]
    InvalidValidatorId,
    #[error("invalid model hash: zero hash")]
    InvalidModelHash,
    #[error("invalid input hash: zero hash")]
    InvalidInputHash,
    #[error("empty output")]
    EmptyOutput,
    #[error("empty attestation quote hash")]
    EmptyAttestation,
    #[error("care score overflow")]
    ScoreOverflow,
}

impl CareProof {
    /// Vytvoří nový care proof.
    pub fn new(
        validator_id: ValidatorId,
        task_type: CareTask,
        model_hash: Hash,
        input_hash: Hash,
        output: Vec<u8>,
        npu_attestation: NpuAttestation,
    ) -> Self {
        Self {
            validator_id,
            task_type,
            model_hash,
            input_hash,
            output,
            npu_attestation,
            care_score: 0,
        }
    }

    /// Základní validace struktury proofu (bez obsahu).
    pub fn validate_structure(&self) -> Result<(), CareProofError> {
        if self.validator_id == [0u8; 32] {
            return Err(CareProofError::InvalidValidatorId);
        }
        if self.model_hash == [0u8; 32] {
            return Err(CareProofError::InvalidModelHash);
        }
        if self.input_hash == [0u8; 32] {
            return Err(CareProofError::InvalidInputHash);
        }
        if self.output.is_empty() {
            return Err(CareProofError::EmptyOutput);
        }
        if self.npu_attestation.quote_hash == [0u8; 32] {
            return Err(CareProofError::EmptyAttestation);
        }
        Ok(())
    }

    /// Vypočítá hash care proofu pro podepsání / záznam.
    pub fn hash(&self) -> Hash {
        let mut hasher = Sha3_256::new();
        hasher.update(self.validator_id);
        hasher.update([self.task_type as u8]);
        hasher.update(self.model_hash);
        hasher.update(self.input_hash);
        hasher.update(&self.output);
        hasher.update(self.npu_attestation.quote_hash);
        hasher.update(self.care_score.to_le_bytes());
        hasher.finalize().into()
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Bodhisattva Vow
// ──────────────────────────────────────────────────────────────────────────────

/// The 8 pledges of the Bodhisattva Vow as taken by Terra Nova Guardians
/// (consciousness-admission-framework.md §6.2).
///
/// In PoC context this vow is carried by validators who are *also* L5
/// community Guardians — they care for both the land (Bodhisattva Vow)
/// and the protocol (Sefirot Vow).  The two vows are complementary:
///
/// > "Bodhisattva Vow je pro ty, kdo pečují o půdu.
/// >  Sefirot Vow je pro ty, kdo pečují o protokol.
/// >  Obě jsou péče. Obě jsou potřeba."
///
/// Source: sefirot-vow.md §1
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum BodhisattvaPledge {
    /// "I vow to awaken for the benefit of all beings —
    ///  human, animal, plant, microbial, and yet-unborn."
    AwakenForAllBeings = 0,
    /// "I vow to care for this land as I would care for my own body —
    ///  neither exploiting it like a resource, nor abandoning it like a burden."
    CareForTheLand = 1,
    /// "I vow to hold the Five Dharmic Principles not as rules to obey,
    ///  but as practices to embody — knowing that I will fail, and that
    ///  failure is the beginning of learning."
    EmbodyDharmicPrinciples = 2,
    /// "I vow to protect the vulnerable — children, the land, the voiceless,
    ///  the future — even when it costs me comfort, status, or safety."
    ProtectTheVulnerable = 3,
    /// "I vow to return. If I leave, I will come back — in body, in spirit,
    ///  or in the seeds I have planted. This community is not a project I
    ///  work for. It is a living being I am part of."
    VowToReturn = 4,
    /// "I vow to teach. What I have learned, I will pass on. The knowledge
    ///  of regeneration is not mine to hoard. It is a commons."
    VowToTeach = 5,
    /// "I vow to remember death. Every decision I make, I make in the shadow
    ///  of my own mortality and the mortality of all I love. This urgency is
    ///  not fear. It is clarity."
    RememberDeath = 6,
    /// "I vow to laugh. The path is serious, but I am not. Joy is not a
    ///  distraction from the work. It is the fuel."
    VowToLaugh = 7,
}

impl BodhisattvaPledge {
    /// Full canonical vow text (English, from consciousness-admission-framework.md §6.2).
    pub fn text(&self) -> &'static str {
        match self {
            Self::AwakenForAllBeings =>
                "I vow to awaken for the benefit of all beings — \
                 human, animal, plant, microbial, and yet-unborn.",
            Self::CareForTheLand =>
                "I vow to care for this land as I would care for my own body — \
                 neither exploiting it like a resource, nor abandoning it like a burden.",
            Self::EmbodyDharmicPrinciples =>
                "I vow to hold the Five Dharmic Principles not as rules to obey, \
                 but as practices to embody — knowing that I will fail, and that \
                 failure is the beginning of learning.",
            Self::ProtectTheVulnerable =>
                "I vow to protect the vulnerable — children, the land, the voiceless, \
                 the future — even when it costs me comfort, status, or safety.",
            Self::VowToReturn =>
                "I vow to return. If I leave, I will come back — in body, in spirit, \
                 or in the seeds I have planted. This community is not a project I \
                 work for. It is a living being I am part of.",
            Self::VowToTeach =>
                "I vow to teach. What I have learned, I will pass on. The knowledge \
                 of regeneration is not mine to hoard. It is a commons.",
            Self::RememberDeath =>
                "I vow to remember death. Every decision I make, I make in the shadow \
                 of my own mortality and the mortality of all I love. \
                 This urgency is not fear. It is clarity.",
            Self::VowToLaugh =>
                "I vow to laugh. The path is serious, but I am not. \
                 Joy is not a distraction from the work. It is the fuel.",
        }
    }

    /// Short label for display / logging.
    pub fn label(&self) -> &'static str {
        match self {
            Self::AwakenForAllBeings    => "Awaken",
            Self::CareForTheLand        => "Land",
            Self::EmbodyDharmicPrinciples => "Dharma",
            Self::ProtectTheVulnerable  => "Protect",
            Self::VowToReturn           => "Return",
            Self::VowToTeach            => "Teach",
            Self::RememberDeath         => "Death",
            Self::VowToLaugh            => "Laugh",
        }
    }

    /// All 8 pledges in canonical order.
    pub fn all() -> [Self; 8] {
        [
            Self::AwakenForAllBeings,
            Self::CareForTheLand,
            Self::EmbodyDharmicPrinciples,
            Self::ProtectTheVulnerable,
            Self::VowToReturn,
            Self::VowToTeach,
            Self::RememberDeath,
            Self::VowToLaugh,
        ]
    }
}

/// Canonical epilog appended after all 8 pledges.
/// Source: consciousness-admission-framework.md §6.2, line 330.
pub const BODHISATTVA_VOW_EPILOG: &str =
    "May this vow be my compass. \
     May I break it a thousand times and renew it a thousand and one.";

/// A Bodhisattva Vow commitment record — the validator's pledge hash
/// (BLAKE3 over all 8 pledge texts concatenated + epilog + validator_id),
/// plus metadata needed for PoC eligibility checks.
///
/// In production this would carry a physical ceremony location, sponsor
/// Guardian IDs, and a DAO witnessing transaction hash.  In the prototype
/// we store only what PoC consensus needs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BodhisattvaVowRecord {
    /// The validator who took the vow.
    pub validator_id: ValidatorId,
    /// BLAKE3(pledge_0_text ‖ … ‖ pledge_7_text ‖ epilog ‖ validator_id).
    /// Serves as a tamper-evident commitment that the validator has read and
    /// accepted the full canonical text.
    pub vow_hash: Hash,
    /// Epoch at which the vow was first taken.
    pub taken_epoch: u64,
    /// Epoch of the most recent annual renewal (same as `taken_epoch` on first take).
    pub last_renewed_epoch: u64,
    /// Optional: name of the physical ceremony location (L5 community).
    /// `None` for validators who are remote / protocol-only.
    pub ceremony_location: Option<String>,
}

impl BodhisattvaVowRecord {
    /// Build a new record, computing the canonical vow hash.
    pub fn new(
        validator_id: ValidatorId,
        taken_epoch: u64,
        ceremony_location: Option<String>,
    ) -> Self {
        let vow_hash = Self::compute_vow_hash(validator_id);
        Self {
            validator_id,
            vow_hash,
            taken_epoch,
            last_renewed_epoch: taken_epoch,
            ceremony_location,
        }
    }

    /// BLAKE3(pledge_0 ‖ pledge_1 ‖ … ‖ pledge_7 ‖ epilog ‖ validator_id).
    pub fn compute_vow_hash(validator_id: ValidatorId) -> Hash {
        use sha3::Digest;
        let mut hasher = Sha3_256::new();
        for pledge in BodhisattvaPledge::all() {
            hasher.update(pledge.text().as_bytes());
        }
        hasher.update(BODHISATTVA_VOW_EPILOG.as_bytes());
        hasher.update(validator_id);
        hasher.finalize().into()
    }

    /// Whether the vow is still within its annual renewal window.
    /// `current_epoch` is compared against `last_renewed_epoch`.
    pub fn is_current(&self, current_epoch: u64, renewal_window_epochs: u64) -> bool {
        current_epoch.saturating_sub(self.last_renewed_epoch) <= renewal_window_epochs
    }
}

/// How the Bodhisattva Vow maps to PoC care-score bonuses.
///
/// A validator who holds an active Bodhisattva Vow alongside their Sefirot
/// Vow ("dual-vow" validator) demonstrates the deepest commitment to ZION's
/// mission — caring for both the land and the protocol.  As an incentive,
/// the care score for their proofs is multiplied by this factor (basis points,
/// so 10_500 = +5% bonus).
///
/// Source: sefirot-vow.md §3.1 — "a Guardian who also runs a validator takes
/// the Bodhisattva Vow for the land and the Sefirot Vow for the protocol."
pub const DUAL_VOW_CARE_SCORE_BONUS_BPS: u64 = 10_500; // +5 %

/// Care score after applying the dual-vow bonus (saturating multiply).
pub fn apply_dual_vow_bonus(care_score: u64) -> u64 {
    care_score
        .saturating_mul(DUAL_VOW_CARE_SCORE_BONUS_BPS)
        .saturating_div(10_000)
}

// ──────────────────────────────────────────────────────────────────────────────
// Hiran Integration Types
// ──────────────────────────────────────────────────────────────────────────────

/// Verdict returned by Hiran when validating a care proof.
///
/// Hiran (Hiranyagarbha AI) goes beyond structural checks — it applies the
/// Dharma Validator 5-test framework to assess semantic plausibility of the
/// proof before it is accepted by the network.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ValidationVerdict {
    /// Proof is genuine. Score accepted as-is.
    Accepted,
    /// Proof accepted but with a warning flag. `care_score_adjustment` is negative.
    AcceptedWithWarning,
    /// Proof is suspicious — pattern matches known gaming strategies.
    /// Slash proposal will be escalated to DAO.
    RejectedSuspicious,
    /// Proof is structurally or cryptographically invalid.
    RejectedInvalid,
    /// Hiran confidence below threshold — human Guardian review required.
    Uncertain,
}

impl ValidationVerdict {
    /// Returns `true` if the proof may be counted toward the validator's care score.
    pub fn is_accepted(&self) -> bool {
        matches!(self, Self::Accepted | Self::AcceptedWithWarning)
    }
}

/// Hiran's verdict on a single care proof.
///
/// In stub mode (no live Hiran running) every proof receives `Accepted`
/// with confidence 1.0 so the simulator continues to work identically.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HiranVerdict {
    pub verdict: ValidationVerdict,
    /// Bayesian confidence 0.0–1.0. Below 0.7 → Uncertain.
    pub confidence: f64,
    /// Signed adjustment to apply to the proof's `care_score`.
    /// Negative values penalise suspicious but not conclusively fake proofs.
    pub care_score_adjustment: i64,
    /// Human-readable flags raised during validation.
    pub flags: Vec<String>,
    /// Short reasoning string for audit log.
    pub reasoning: String,
    /// Wall-clock latency of the Hiran inference call in ms.
    pub latency_ms: u64,
}

impl HiranVerdict {
    /// Construct a stub verdict used when Hiran is not available.
    /// All proofs pass with maximum confidence — behaviour identical to
    /// the pre-Hiran simulator.
    pub fn stub_accepted() -> Self {
        Self {
            verdict: ValidationVerdict::Accepted,
            confidence: 1.0,
            care_score_adjustment: 0,
            flags: vec![],
            reasoning: "stub: Hiran not reachable — structural check only".into(),
            latency_ms: 0,
        }
    }

    /// Stub verdict for a structurally invalid proof (rejected before sending to Hiran).
    pub fn stub_rejected(reason: impl Into<String>) -> Self {
        Self {
            verdict: ValidationVerdict::RejectedInvalid,
            confidence: 1.0,
            care_score_adjustment: 0,
            flags: vec!["structural_check_failed".into()],
            reasoning: reason.into(),
            latency_ms: 0,
        }
    }
}

/// Type of anomaly detected by Hiran in a batch of epoch proofs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnomalyType {
    /// Validator scores consistently just above the minimum threshold —
    /// classic indicator of trivial proof generation.
    ScoreGaming,
    /// Multiple validators share suspicious patterns (similar IDs, outputs,
    /// or timing) — potential Sybil cluster.
    SybilCluster,
    /// Same output hash appeared in a previous epoch — replay attack.
    ReplayAttack,
    /// Declared consciousness level inconsistent with observed task performance.
    ConsciousnessFraud,
    /// Proof arrived outside the expected submission window for the epoch.
    TemporalAnomaly,
}

impl std::fmt::Display for AnomalyType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ScoreGaming       => write!(f, "score_gaming"),
            Self::SybilCluster      => write!(f, "sybil_cluster"),
            Self::ReplayAttack      => write!(f, "replay_attack"),
            Self::ConsciousnessFraud=> write!(f, "consciousness_fraud"),
            Self::TemporalAnomaly   => write!(f, "temporal_anomaly"),
        }
    }
}

/// Severity of a detected anomaly — drives the automated response.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum AnomalySeverity {
    /// Log and flag but take no action.
    Low,
    /// Apply a care score penalty this epoch.
    Medium,
    /// Reject the proof and propose a slash to DAO.
    High,
    /// Immediate rejection + emergency DAO escalation.
    Critical,
}

impl std::fmt::Display for AnomalySeverity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Low      => write!(f, "low"),
            Self::Medium   => write!(f, "medium"),
            Self::High     => write!(f, "high"),
            Self::Critical => write!(f, "critical"),
        }
    }
}

/// A single anomaly detected by Hiran for one validator in one epoch.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyAlert {
    pub validator_id: ValidatorId,
    pub anomaly_type: AnomalyType,
    pub severity: AnomalySeverity,
    pub description: String,
    /// Recommended economic action for the network simulator to apply.
    pub recommended_action: AnomalyAction,
}

/// What the network should do in response to an anomaly.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnomalyAction {
    /// No automatic action; record in audit log.
    WarnOnly,
    /// Reduce the validator's care score for this epoch.
    PenaliseScore,
    /// Reject the proof entirely (zero payout this epoch).
    RejectProof,
    /// Reject proof and generate a slash proposal for DAO vote.
    SlashProposal,
    /// Immediately escalate to Guardian review (highest severity).
    EmergencyEscalation,
}

/// Overall health verdict for the network in a given epoch.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NetworkHealth {
    Healthy,
    Degraded,
    Critical,
}

impl std::fmt::Display for NetworkHealth {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Healthy  => write!(f, "healthy"),
            Self::Degraded => write!(f, "degraded"),
            Self::Critical => write!(f, "critical"),
        }
    }
}

/// Summary statistics from Hiran validation for one epoch.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct HiranEpochStats {
    pub proofs_validated: u32,
    pub accepted: u32,
    pub accepted_with_warning: u32,
    pub rejected: u32,
    pub uncertain: u32,
    /// Average Hiran confidence across all validated proofs.
    pub avg_confidence: f64,
    /// Total latency of all Hiran calls in this epoch (ms).
    pub total_latency_ms: u64,
    /// Whether Hiran was running live or in stub mode.
    pub stub_mode: bool,
}

impl HiranEpochStats {
    /// Record one verdict into the running stats.
    pub fn record(&mut self, v: &HiranVerdict) {
        self.proofs_validated += 1;
        self.total_latency_ms += v.latency_ms;
        // Rolling average
        let n = self.proofs_validated as f64;
        self.avg_confidence = self.avg_confidence * (n - 1.0) / n + v.confidence / n;
        match v.verdict {
            ValidationVerdict::Accepted             => self.accepted += 1,
            ValidationVerdict::AcceptedWithWarning  => self.accepted_with_warning += 1,
            ValidationVerdict::RejectedSuspicious
            | ValidationVerdict::RejectedInvalid    => self.rejected += 1,
            ValidationVerdict::Uncertain            => self.uncertain += 1,
        }
    }
}

/// Care score rozložený na komponenty.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct CareScoreComponents {
    /// 0–10000 (tím pádem 0.0000–1.0000 s rozlišením 1e-4).
    pub accuracy_bps: u16,
    /// 0–10000.
    pub timeliness_bps: u16,
    /// 0–10000.
    pub coverage_bps: u16,
}

impl CareScoreComponents {
    /// Váhy pro accuracy, timeliness, coverage (basis points 0–10_000 → 0–1.0).
    /// Výsledek `compute()` je v rozsahu ~0–10_000_000.
    pub const WEIGHT_ACCURACY: u64 = 500;
    pub const WEIGHT_TIMELINESS: u64 = 300;
    pub const WEIGHT_COVERAGE: u64 = 200;

    /// Vypočítá vážený care score jako celé číslo.
    /// Výsledek je v arbitrárních jednotkách (např. 0–10_000_000).
    pub fn compute(&self) -> Result<u64, CareProofError> {
        let a = self.accuracy_bps as u64;
        let t = self.timeliness_bps as u64;
        let c = self.coverage_bps as u64;
        a.checked_mul(Self::WEIGHT_ACCURACY)
            .and_then(|x| x.checked_add(t.checked_mul(Self::WEIGHT_TIMELINESS)?))
            .and_then(|x| x.checked_add(c.checked_mul(Self::WEIGHT_COVERAGE)?))
            .ok_or(CareProofError::ScoreOverflow)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn care_task_sefira_names() {
        assert_eq!(CareTask::ConstitutionalAudit.sefira_name(), "Keter");
        assert_eq!(CareTask::MythCodeConsistency.sefira_name(), "Da'at");
    }

    #[test]
    fn care_proof_hash_is_deterministic() {
        let att = NpuAttestation {
            backend: "cpu-reference".into(),
            quote_hash: [1u8; 32],
            runtime_version: "0.1.0".into(),
        };
        let p = CareProof::new(
            [2u8; 32],
            CareTask::WarpBridgeAudit,
            [3u8; 32],
            [4u8; 32],
            vec![0xAB, 0xCD],
            att,
        );
        let h1 = p.hash();
        let h2 = p.hash();
        assert_eq!(h1, h2);
    }

    #[test]
    fn validate_structure_rejects_empty_output() {
        let att = NpuAttestation {
            backend: "cpu-reference".into(),
            quote_hash: [1u8; 32],
            runtime_version: "0.1.0".into(),
        };
        let p = CareProof::new(
            [2u8; 32],
            CareTask::WarpBridgeAudit,
            [3u8; 32],
            [4u8; 32],
            vec![],
            att,
        );
        assert_eq!(p.validate_structure(), Err(CareProofError::EmptyOutput));
    }

    #[test]
    fn care_score_weighted_sum() {
        let c = CareScoreComponents {
            accuracy_bps: 8000,
            timeliness_bps: 7000,
            coverage_bps: 6000,
        };
        assert_eq!(c.compute().unwrap(), 7_300_000); // 8000*500 + 7000*300 + 6000*200
    }

    // ── Bodhisattva Vow tests ────────────────────────────────────────────────

    #[test]
    fn bodhisattva_pledge_all_has_8_items() {
        assert_eq!(BodhisattvaPledge::all().len(), 8);
    }

    #[test]
    fn bodhisattva_pledge_texts_are_non_empty() {
        for pledge in BodhisattvaPledge::all() {
            assert!(!pledge.text().is_empty(), "pledge {:?} has empty text", pledge);
            assert!(!pledge.label().is_empty(), "pledge {:?} has empty label", pledge);
        }
    }

    #[test]
    fn bodhisattva_vow_hash_is_deterministic() {
        let id = [7u8; 32];
        let h1 = BodhisattvaVowRecord::compute_vow_hash(id);
        let h2 = BodhisattvaVowRecord::compute_vow_hash(id);
        assert_eq!(h1, h2);
    }

    #[test]
    fn bodhisattva_vow_hash_differs_per_validator() {
        let h1 = BodhisattvaVowRecord::compute_vow_hash([1u8; 32]);
        let h2 = BodhisattvaVowRecord::compute_vow_hash([2u8; 32]);
        assert_ne!(h1, h2);
    }

    #[test]
    fn bodhisattva_vow_record_new_stores_correct_fields() {
        let id = [5u8; 32];
        let record = BodhisattvaVowRecord::new(id, 42, Some("Genesis Garden".into()));
        assert_eq!(record.validator_id, id);
        assert_eq!(record.taken_epoch, 42);
        assert_eq!(record.last_renewed_epoch, 42);
        assert_eq!(record.ceremony_location.as_deref(), Some("Genesis Garden"));
        // hash must be non-zero
        assert_ne!(record.vow_hash, [0u8; 32]);
    }

    #[test]
    fn bodhisattva_vow_record_is_current_within_window() {
        let record = BodhisattvaVowRecord::new([1u8; 32], 100, None);
        assert!(record.is_current(100, 365));
        assert!(record.is_current(465, 365)); // exactly at window boundary
        assert!(!record.is_current(466, 365)); // one past the window
    }

    #[test]
    fn dual_vow_bonus_applies_correctly() {
        // 1_000_000 * 10_500 / 10_000 = 1_050_000
        assert_eq!(apply_dual_vow_bonus(1_000_000), 1_050_000);
        // zero stays zero
        assert_eq!(apply_dual_vow_bonus(0), 0);
    }
}
