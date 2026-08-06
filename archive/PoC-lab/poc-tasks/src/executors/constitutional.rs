//! # ConstitutionalAuditExecutor
//!
//! Validace DAO proposal against constitution rules (Keter /
//! `CareTask::ConstitutionalAudit`).
//!
//! Executor ověřuje tři ústavní pravidla:
//! 1. **Max mint** — `mint_amount < 1 % of total_supply` (ochrana proti
//!    inflaci nad ústavní limit).
//! 2. **No self-dealing** — žádný direct treasury transfer na proposer
//!    (ochrana proti zneužití treasury).
//! 3. **Quorum** — `quorum_actual >= quorum_required` (ochrana proti
//!    governance capture s nízkou účastí).
//!
//! V izolované laboratoři (Fáze 1) se proposal generuje deterministicky
//! z `input_hash` + `epoch` přes [`generate_mock_proposal`]. V Fázi 2 bude
//! nahrazeno reálným napojením na DAO governance API.
//!
//! # Determinismus
//!
//! Stejný [`TaskInput`] vždy produkuje identický [`TaskOutput`] — mock
//! generátor používá BLAKE3 seed odvozený z `input_hash` a `epoch`, takže
//! dva honest validátoři se stejným vstupem produkovat bit-exact shodný
//! výsledek (klíčové pro cross-validaci).

use blake3::Hasher;
use poc_core::{CareTask, Hash};

use crate::{TaskInput, TaskOutput};

use super::{ExecutorError, TaskExecutor};

/// Maximální povolený mint jako procento total_supply (1 %).
const MAX_MINT_PCT: u128 = 1;

/// Podporovaný task typ tímto executorem.
const SUPPORTED: &[CareTask] = &[CareTask::ConstitutionalAudit];

/// Executor pro `CareTask::ConstitutionalAudit`.
///
/// Generuje deterministický mock DAO proposal z `input_hash` + `epoch`,
/// provede tři ústavní kontroly, a vrátí [`TaskOutput`] kde:
/// - `bytes` = BLAKE3 hash kanonického encodings audit výsledku,
/// - `summary` = lidsky čitelný popis (`"proposal constitutional"` /
///   `"proposal VIOLATES rule N: ..."`).
#[derive(Debug, Clone, Default)]
pub struct ConstitutionalAuditExecutor;

impl ConstitutionalAuditExecutor {
    /// Vytvoří nový executor.
    pub fn new() -> Self {
        Self
    }
}

impl TaskExecutor for ConstitutionalAuditExecutor {
    fn execute(&self, input: &TaskInput) -> Result<TaskOutput, ExecutorError> {
        // 1. Ověř že task typ je podporován.
        if input.task != CareTask::ConstitutionalAudit {
            return Err(ExecutorError::UnsupportedTask(input.task));
        }
        // 2. Ověř že input_hash není nulový (jinak seed by byl triviální).
        if input.input_hash == [0u8; 32] {
            return Err(ExecutorError::InvalidInput(
                "input_hash is zero — cannot derive proposal state".into(),
            ));
        }

        // 3. Generuj deterministický mock proposal.
        let proposal = generate_mock_proposal(&input.input_hash, input.epoch);

        // 4. Proveď ústavní kontroly (priorita: Rule1 > Rule2 > Rule3 > OK).
        let summary = audit_proposal(&proposal);

        // 5. Kanonický encoding výsledku pro hash.
        let canonical = canonical_encoding(&proposal, &summary);
        let bytes = blake3::hash(&canonical).as_bytes().to_vec();

        Ok(TaskOutput { bytes, summary })
    }

    fn supports(&self) -> &'static [CareTask] {
        SUPPORTED
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock proposal
// ──────────────────────────────────────────────────────────────────────────────

/// Mock DAO proposal — deterministicky generovaný z seedu.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Proposal {
    /// Kolik tokenů se má mintovat (base units).
    mint_amount: u128,
    /// Total supply tokenů (base units).
    total_supply: u128,
    /// ID proposer (node index).
    proposer: u32,
    /// Zda proposal obsahuje direct treasury transfer na proposer.
    treasury_transfer_to_proposer: bool,
    /// Požadované quorum (počet hlasů).
    quorum_required: u64,
    /// Skutečné quorum (počet hlasů).
    quorum_actual: u64,
}

/// Deterministicky vygeneruje mock DAO proposal z `input_hash` + `epoch`.
///
/// BLAKE3 seed → 32 bajtů, ze kterých se odvozují všechny parametry.
/// Jeden bajt seedu (`seed[31] % 4`) určuje "scénář" proposal:
///
/// | mode | scénář           | rule 1 (mint) | rule 2 (self-deal) | rule 3 (quorum) |
/// |------|------------------|---------------|--------------------|-----------------|
/// | 0    | constitutional   | ✓ (< 1 %)     | ✓ (ne)             | ✓ (met)         |
/// | 1    | violates rule 1  | ✗ (≥ 1 %)     | ✓ (ne)             | ✓ (met)         |
/// | 2    | violates rule 2  | ✓ (< 1 %)     | ✗ (ano)            | ✓ (met)         |
/// | 3    | violates rule 3  | ✓ (< 1 %)     | ✓ (ne)             | ✗ (not met)     |
fn generate_mock_proposal(input_hash: &Hash, epoch: u64) -> Proposal {
    // Seed = BLAKE3(input_hash || epoch_le).
    let mut hasher = Hasher::new();
    hasher.update(input_hash);
    hasher.update(&epoch.to_le_bytes());
    let seed = *hasher.finalize().as_bytes();

    // Scénář určený jedním bajtem.
    let mode = seed[31] % 4;

    // Total supply: 1_000_000 .. 10_000_000 (z prvních 16 bajtů seedu).
    let total_supply = 1_000_000
        + (u128::from_le_bytes(
            seed[0..16].try_into().expect("16 bytes"),
        ) % 9_000_000);

    // Proposer ID (z bajtu seedu).
    let proposer = (seed[16] as u32) % 100;

    // Quorum required (z bajtu seedu).
    let quorum_required = 100 + (seed[17] as u64) % 200; // 100-299

    match mode {
        0 => {
            // Constitutional: mint < 1 %, no self-dealing, quorum met.
            let mint_amount = total_supply / 200; // 0.5 % < 1 %
            let treasury_transfer_to_proposer = false;
            let quorum_actual = quorum_required + (seed[18] as u64) % 50; // ≥ required
            Proposal {
                mint_amount,
                total_supply,
                proposer,
                treasury_transfer_to_proposer,
                quorum_required,
                quorum_actual,
            }
        }
        1 => {
            // Violates rule 1: mint ≥ 1 % of total_supply.
            let mint_amount = total_supply / 10; // 10 % >> 1 %
            let treasury_transfer_to_proposer = false;
            let quorum_actual = quorum_required + (seed[18] as u64) % 50;
            Proposal {
                mint_amount,
                total_supply,
                proposer,
                treasury_transfer_to_proposer,
                quorum_required,
                quorum_actual,
            }
        }
        2 => {
            // Violates rule 2: direct treasury transfer to proposer.
            let mint_amount = total_supply / 200; // 0.5 % < 1 %
            let treasury_transfer_to_proposer = true;
            let quorum_actual = quorum_required + (seed[18] as u64) % 50;
            Proposal {
                mint_amount,
                total_supply,
                proposer,
                treasury_transfer_to_proposer,
                quorum_required,
                quorum_actual,
            }
        }
        3 => {
            // Violates rule 3: quorum not met.
            let mint_amount = total_supply / 200; // 0.5 % < 1 %
            let treasury_transfer_to_proposer = false;
            let quorum_actual = quorum_required / 2; // 50 % < required
            Proposal {
                mint_amount,
                total_supply,
                proposer,
                treasury_transfer_to_proposer,
                quorum_required,
                quorum_actual,
            }
        }
        _ => unreachable!("mode = seed[31] % 4 is always 0, 1, 2, or 3"),
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Audit logic
// ──────────────────────────────────────────────────────────────────────────────

/// Provede ústavní kontroly nad proposal a vrátí lidsky čitelný
/// `summary` string.
///
/// Priorita kontrol: **Rule1 > Rule2 > Rule3 > OK** (inflation protection
/// je nejkritičtější, pak self-dealing, pak quorum).
fn audit_proposal(proposal: &Proposal) -> String {
    // Rule 1: max_mint < 1 % of total_supply.
    // mint_amount * 100 < total_supply * MAX_MINT_PCT
    if proposal.mint_amount.saturating_mul(100) >= proposal.total_supply.saturating_mul(MAX_MINT_PCT) {
        return format!(
            "proposal VIOLATES rule 1: mint_amount {} >= {}% of total_supply {}",
            proposal.mint_amount, MAX_MINT_PCT, proposal.total_supply
        );
    }

    // Rule 2: no direct treasury transfer to proposer.
    if proposal.treasury_transfer_to_proposer {
        return format!(
            "proposal VIOLATES rule 2: direct treasury transfer to proposer {}",
            proposal.proposer
        );
    }

    // Rule 3: quorum met.
    if proposal.quorum_actual < proposal.quorum_required {
        return format!(
            "proposal VIOLATES rule 3: quorum not met ({} / {})",
            proposal.quorum_actual, proposal.quorum_required
        );
    }

    // Vše OK.
    "proposal constitutional".to_string()
}

/// Kanonický encoding proposal + verdict pro BLAKE3 hash.
fn canonical_encoding(proposal: &Proposal, summary: &str) -> Vec<u8> {
    let mut buf = Vec::with_capacity(128);
    buf.extend_from_slice(&proposal.mint_amount.to_le_bytes());
    buf.extend_from_slice(&proposal.total_supply.to_le_bytes());
    buf.extend_from_slice(&proposal.proposer.to_le_bytes());
    buf.extend_from_slice(&[proposal.treasury_transfer_to_proposer as u8]);
    buf.extend_from_slice(&proposal.quorum_required.to_le_bytes());
    buf.extend_from_slice(&proposal.quorum_actual.to_le_bytes());
    buf.extend_from_slice(summary.as_bytes());
    buf
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::executors::TaskExecutor;
    use crate::TaskInput;
    use poc_core::CareTask;

    /// Výsledek auditu proposal — klasifikuje `summary` string (test helper).
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    enum AuditVerdict {
        /// Proposal je ústavní.
        Constitutional,
        /// Porušuje rule 1 (mint too large).
        ViolatesRule1,
        /// Porušuje rule 2 (treasury transfer to proposer).
        ViolatesRule2,
        /// Porušuje rule 3 (quorum not met).
        ViolatesRule3,
    }

    /// Pomocná funkce: vytvoří `TaskInput` pro ConstitutionalAudit s daným
    /// `input_hash` (poslední bajt = `tag`, zbytek nulový) a epochou.
    fn constitutional_input(tag: u8, epoch: u64) -> TaskInput {
        let mut input_hash = [0u8; 32];
        input_hash[31] = tag;
        input_hash[0] = 0x42;
        TaskInput {
            task: CareTask::ConstitutionalAudit,
            input_hash,
            epoch,
        }
    }

    /// Najde první `input_hash` (scan přes tag 1..=255) jehož audit verdict
    /// odpovídá `wanted`. Vrací odpovídající `TaskInput`.
    fn find_input_with_verdict(wanted: AuditVerdict, epoch: u64) -> TaskInput {
        for tag in 1u8..=255u8 {
            let input = constitutional_input(tag, epoch);
            let proposal = generate_mock_proposal(&input.input_hash, epoch);
            let summary = audit_proposal(&proposal);
            let verdict = verdict_from_summary(&summary);
            if verdict == wanted {
                return input;
            }
        }
        panic!(
            "no input found producing verdict {:?} within tag 1..=255",
            wanted
        );
    }

    /// Mapuje summary string zpět na `AuditVerdict` (pro testy).
    fn verdict_from_summary(summary: &str) -> AuditVerdict {
        if summary.starts_with("proposal constitutional") {
            AuditVerdict::Constitutional
        } else if summary.contains("VIOLATES rule 1") {
            AuditVerdict::ViolatesRule1
        } else if summary.contains("VIOLATES rule 2") {
            AuditVerdict::ViolatesRule2
        } else if summary.contains("VIOLATES rule 3") {
            AuditVerdict::ViolatesRule3
        } else {
            panic!("unknown summary: {summary}");
        }
    }

    #[test]
    fn executor_detects_violation_rule1() {
        // Najdi vstup který produkuje ViolatesRule1 (mode 1 → mint ≥ 1 %).
        let input = find_input_with_verdict(AuditVerdict::ViolatesRule1, 42);
        let executor = ConstitutionalAuditExecutor::new();
        let output = executor.execute(&input).expect("execute should succeed");

        assert!(
            output.summary.contains("VIOLATES rule 1"),
            "expected ViolatesRule1, got: {}",
            output.summary
        );
        assert!(output.summary.contains("mint_amount"));
        assert!(output.summary.contains("total_supply"));
        assert_eq!(output.bytes.len(), 32);
        assert!(!output.bytes.iter().all(|&b| b == 0));
    }

    #[test]
    fn executor_detects_violation_rule2() {
        // Najdi vstup který produkuje ViolatesRule2 (mode 2 → treasury transfer).
        let input = find_input_with_verdict(AuditVerdict::ViolatesRule2, 7);
        let executor = ConstitutionalAuditExecutor::new();
        let output = executor.execute(&input).expect("execute should succeed");

        assert!(
            output.summary.contains("VIOLATES rule 2"),
            "expected ViolatesRule2, got: {}",
            output.summary
        );
        assert!(output.summary.contains("treasury transfer"));
        assert_eq!(output.bytes.len(), 32);
    }

    #[test]
    fn executor_detects_violation_rule3() {
        // Najdi vstup který produkuje ViolatesRule3 (mode 3 → quorum not met).
        let input = find_input_with_verdict(AuditVerdict::ViolatesRule3, 99);
        let executor = ConstitutionalAuditExecutor::new();
        let output = executor.execute(&input).expect("execute should succeed");

        assert!(
            output.summary.contains("VIOLATES rule 3"),
            "expected ViolatesRule3, got: {}",
            output.summary
        );
        assert!(output.summary.contains("quorum not met"));
        assert_eq!(output.bytes.len(), 32);
    }

    #[test]
    fn executor_constitutional() {
        // Najdi vstup který produkuje Constitutional (mode 0 → všechny rules pass).
        let input = find_input_with_verdict(AuditVerdict::Constitutional, 10);
        let executor = ConstitutionalAuditExecutor::new();
        let output = executor.execute(&input).expect("execute should succeed");

        assert_eq!(
            output.summary, "proposal constitutional",
            "expected Constitutional, got: {}",
            output.summary
        );
        assert_eq!(output.bytes.len(), 32);
    }

    #[test]
    fn executor_outputs_are_deterministic() {
        // Stejný input → stejný output (bytes i summary).
        let input = find_input_with_verdict(AuditVerdict::Constitutional, 10);
        let executor = ConstitutionalAuditExecutor::new();

        let out1 = executor.execute(&input).expect("execute 1");
        let out2 = executor.execute(&input).expect("execute 2");

        assert_eq!(out1.bytes, out2.bytes, "bytes must be identical");
        assert_eq!(out1.summary, out2.summary, "summary must be identical");
    }

    #[test]
    fn executor_outputs_differ_per_epoch() {
        // Stejný input_hash ale jiná epocha → jiný seed → jiný output.
        let input_e1 = constitutional_input(1, 1);
        let input_e2 = TaskInput {
            task: CareTask::ConstitutionalAudit,
            input_hash: input_e1.input_hash,
            epoch: 2,
        };
        let executor = ConstitutionalAuditExecutor::new();

        let out1 = executor.execute(&input_e1).expect("execute e1");
        let out2 = executor.execute(&input_e2).expect("execute e2");

        assert_ne!(
            out1.bytes, out2.bytes,
            "different epoch must produce different bytes"
        );
    }

    #[test]
    fn executor_outputs_differ_per_input_hash() {
        // Stejná epocha ale jiný input_hash → jiný seed → jiný output.
        let executor = ConstitutionalAuditExecutor::new();
        let out1 = executor
            .execute(&constitutional_input(1, 5))
            .expect("execute 1");
        let out2 = executor
            .execute(&constitutional_input(2, 5))
            .expect("execute 2");
        assert_ne!(out1.bytes, out2.bytes);
    }

    #[test]
    fn executor_rejects_unsupported_task() {
        let executor = ConstitutionalAuditExecutor::new();
        let input = TaskInput {
            task: CareTask::WarpBridgeAudit,
            input_hash: [1u8; 32],
            epoch: 1,
        };
        let err = executor.execute(&input).expect_err("should reject");
        assert_eq!(err, ExecutorError::UnsupportedTask(CareTask::WarpBridgeAudit));
    }

    #[test]
    fn executor_rejects_zero_input_hash() {
        let executor = ConstitutionalAuditExecutor::new();
        let input = TaskInput {
            task: CareTask::ConstitutionalAudit,
            input_hash: [0u8; 32],
            epoch: 1,
        };
        let err = executor.execute(&input).expect_err("should reject zero hash");
        assert!(matches!(err, ExecutorError::InvalidInput(_)));
    }

    #[test]
    fn executor_supports_correct_task() {
        let executor = ConstitutionalAuditExecutor::new();
        assert_eq!(executor.supports(), &[CareTask::ConstitutionalAudit]);
    }

    #[test]
    fn all_four_verdicts_are_reachable() {
        // Sanity check: pro tag 1..=255 existuje alespoň jeden vstup pro
        // každý z verdictů Constitutional, ViolatesRule1/2/3.
        let epoch = 1;
        let mut found_const = false;
        let mut found_r1 = false;
        let mut found_r2 = false;
        let mut found_r3 = false;
        for tag in 1u8..=255u8 {
            let input = constitutional_input(tag, epoch);
            let proposal = generate_mock_proposal(&input.input_hash, epoch);
            let verdict = verdict_from_summary(&audit_proposal(&proposal));
            match verdict {
                AuditVerdict::Constitutional => found_const = true,
                AuditVerdict::ViolatesRule1 => found_r1 = true,
                AuditVerdict::ViolatesRule2 => found_r2 = true,
                AuditVerdict::ViolatesRule3 => found_r3 = true,
            }
        }
        assert!(found_const, "Constitutional verdict must be reachable");
        assert!(found_r1, "ViolatesRule1 verdict must be reachable");
        assert!(found_r2, "ViolatesRule2 verdict must be reachable");
        assert!(found_r3, "ViolatesRule3 verdict must be reachable");
    }

    #[test]
    fn mock_proposal_is_deterministic() {
        // Stejný input_hash + epoch → identický proposal.
        let input = constitutional_input(5, 10);
        let p1 = generate_mock_proposal(&input.input_hash, 10);
        let p2 = generate_mock_proposal(&input.input_hash, 10);
        assert_eq!(p1, p2);
    }

    #[test]
    fn mock_proposal_differs_per_epoch() {
        let input = constitutional_input(5, 10);
        let p1 = generate_mock_proposal(&input.input_hash, 10);
        let p2 = generate_mock_proposal(&input.input_hash, 11);
        assert_ne!(p1, p2, "different epoch must produce different proposal");
    }
}
