//! # WarpBridgeAuditExecutor
//!
//! Audit WARP bridge cross-chain consistency (Tiferet / `CareTask::WarpBridgeAudit`).
//!
//! Executor ověřuje tři invarianty bridge state:
//! 1. `locked_zion == minted_wzion ± tolerance` — konzistence collateral.
//! 2. Žádný pending lock není starší než 24h threshold — žádné "zaseknuté" locky.
//! 3. TVL je v rozumném range — detekce anomálií v celkovém objemu.
//!
//! V izolované laboratoři (Fáze 1) se bridge state generuje deterministicky
//! z `input_hash` + `epoch` přes [`generate_mock_bridge_state`]. V Fázi 2 bude
//! nahrazeno reálným napojením na L3 WARP API (`/api/bridge/status`).
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

/// Tolerance pro rozdíl `locked_zion` vs `minted_wzion` (v base units).
///
/// Reprezentuje povolenou overhead z bridge fees / pending confirmations.
/// 1_000 base units na typickém TVL ~100K–1.1M je ~0.1–1 % — konzervativní.
const BALANCE_TOLERANCE: u128 = 1_000;

/// Threshold pro "stale" pending lock — 24 hodin v sekundách.
const STALE_THRESHOLD_SECONDS: u64 = 24 * 60 * 60; // 86_400

/// Rozumný range pro TVL (base units). Pod 10K = podezřele nízký,
/// nad 10M = podezřele vysoký (anomálie / manipulace).
const TVL_MIN: u128 = 10_000;
const TVL_MAX: u128 = 10_000_000;

/// Podporovaný task typ tímto executorem.
const SUPPORTED: &[CareTask] = &[CareTask::WarpBridgeAudit];

/// Executor pro `CareTask::WarpBridgeAudit`.
///
/// Generuje deterministický mock bridge state z `input_hash` + `epoch`,
/// provede tři invariantní kontroly a vrátí [`TaskOutput`] kde:
/// - `bytes` = BLAKE3 hash kanonického encodings audit výsledku,
/// - `summary` = lidsky čitelný popis (`"bridge OK"` / `"bridge DRIFT ..."` /
///   `"bridge STALE ..."`).
#[derive(Debug, Clone, Default)]
pub struct WarpBridgeAuditExecutor;

impl WarpBridgeAuditExecutor {
    /// Vytvoří nový executor.
    pub fn new() -> Self {
        Self
    }
}

impl TaskExecutor for WarpBridgeAuditExecutor {
    fn execute(&self, input: &TaskInput) -> Result<TaskOutput, ExecutorError> {
        // 1. Ověř že task typ je podporován.
        if input.task != CareTask::WarpBridgeAudit {
            return Err(ExecutorError::UnsupportedTask(input.task));
        }
        // 2. Ověř že input_hash není nulový (jinak seed by byl triviální).
        if input.input_hash == [0u8; 32] {
            return Err(ExecutorError::InvalidInput(
                "input_hash is zero — cannot derive bridge state".into(),
            ));
        }

        // 3. Generuj deterministický mock bridge state.
        let state = generate_mock_bridge_state(&input.input_hash, input.epoch);

        // 4. Proveď invariantní kontroly (priorita: STALE > DRIFT > TVL > OK).
        let summary = audit_bridge(&state);

        // 5. Kanonický encoding výsledku pro hash (zahrnuje bridge state +
        //    verdict, takže dva různé bridge se stejným verdict dají různý hash).
        let canonical = canonical_encoding(&state, &summary);
        let bytes = blake3::hash(&canonical).as_bytes().to_vec();

        Ok(TaskOutput { bytes, summary })
    }

    fn supports(&self) -> &'static [CareTask] {
        SUPPORTED
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock bridge state
// ──────────────────────────────────────────────────────────────────────────────

/// Jeden pending lock na bridge (čeká na confirm / mint / release).
#[derive(Debug, Clone, PartialEq, Eq)]
struct PendingLock {
    /// Kolik ZION je v locku (base units).
    amount: u128,
    /// Stáří locku v sekundách od odeslání.
    age_seconds: u64,
}

/// Mock snapshot bridge state — deterministicky generovaný z seedu.
#[derive(Debug, Clone, PartialEq, Eq)]
struct BridgeState {
    /// ZION locked na L1 (collateral).
    locked_zion: u128,
    /// wZION minted na L2 (mirror).
    minted_wzion: u128,
    /// Pending locky čekající na zpracování.
    pending_locks: Vec<PendingLock>,
    /// Total Value Locked (suma locked + pending).
    tvl: u128,
}

/// Deterministicky vygeneruje mock bridge state z `input_hash` + `epoch`.
///
/// BLAKE3 seed → 32 bajtů, ze kterých se odvozují všechny pole. Jeden bajt
/// seedu (`seed[31] % 3`) určuje "scénář" bridge state — simuluje tři
/// realistické situace, které se v praxi vyskytují:
///
/// | mode | scénář     | locked vs minted | pending locky       |
/// |------|-----------|------------------|---------------------|
/// | 0    | healthy   | ≈ vyvážené       | čerstvé (< 24h)     |
/// | 1    | drift     | velký rozdíl     | čerstvé             |
/// | 2    | stale     | vyvážené         | staré (> 24h)       |
///
/// Tento design garantuje že audit produkuje všechny tři výsledky (OK / DRIFT
/// / STALE) pro vhodně zvolené vstupy, což je klíčové pro testovatelnost.
fn generate_mock_bridge_state(input_hash: &Hash, epoch: u64) -> BridgeState {
    // Seed = BLAKE3(input_hash || epoch_le).
    let mut hasher = Hasher::new();
    hasher.update(input_hash);
    hasher.update(&epoch.to_le_bytes());
    let seed = *hasher.finalize().as_bytes();

    // Base TVL: 100_000 .. 1_099_999 (z prvních 16 bajtů seedu).
    let base = u128::from_le_bytes(
        seed[0..16].try_into().expect("seed[0..16] is 16 bytes"),
    ) % 1_000_000
        + 100_000;

    // Scénář určený jedním bajtem — simuluje různé bridge podmínky.
    let mode = seed[31] % 3;

    match mode {
        0 => {
            // Healthy bridge: minted ≈ locked (drift v tolerance), čerstvé locky.
            let drift = (seed[16] as i128) % 50; // -49 .. 49, vždy v tolerance
            let locked = base;
            let minted = ((locked as i128) + drift).max(0) as u128;
            let pending_locks = vec![
                PendingLock {
                    amount: base / 4,
                    age_seconds: 3_600, // 1h
                },
                PendingLock {
                    amount: base / 8,
                    age_seconds: 7_200, // 2h
                },
            ];
            let tvl = locked + pending_locks.iter().map(|l| l.amount).sum::<u128>();
            BridgeState {
                locked_zion: locked,
                minted_wzion: minted,
                pending_locks,
                tvl,
            }
        }
        1 => {
            // Drift: velký rozdíl mezi locked a minted (mimo tolerance).
            let drift = (seed[17] as i128) * 1_000 + 5_000; // 5_000 .. 332_670
            let locked = base;
            let minted = ((locked as i128) + drift).max(0) as u128;
            let pending_locks = vec![PendingLock {
                amount: base / 4,
                age_seconds: 1_800, // 30min — čerstvé
            }];
            let tvl = locked + pending_locks.iter().map(|l| l.amount).sum::<u128>();
            BridgeState {
                locked_zion: locked,
                minted_wzion: minted,
                pending_locks,
                tvl,
            }
        }
        2 => {
            // Stale: vyvážené balance, ale pending locky starší než 24h.
            let locked = base;
            let minted = locked; // konzistentní collateral
            let pending_locks = vec![
                PendingLock {
                    amount: base / 4,
                    age_seconds: 100_000, // ~27.8h > 24h
                },
                PendingLock {
                    amount: base / 8,
                    age_seconds: 50_000, // ~13.9h
                },
            ];
            let tvl = locked + pending_locks.iter().map(|l| l.amount).sum::<u128>();
            BridgeState {
                locked_zion: locked,
                minted_wzion: minted,
                pending_locks,
                tvl,
            }
        }
        _ => unreachable!("mode = seed[31] % 3 is always 0, 1, or 2"),
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Audit logic
// ──────────────────────────────────────────────────────────────────────────────

/// Provede invariantní kontroly nad bridge state a vrátí lidsky čitelný
/// `summary` string.
///
/// Priorita kontrol: **STALE > DRIFT > TVL > OK** (nejurgentnější problém
/// se reportuje jako první — zaseknuté locky jsou kritičtější než drobný
/// drift).
fn audit_bridge(state: &BridgeState) -> String {
    // 1. Stale check: počet pending locků starších než threshold.
    let stale_count = state
        .pending_locks
        .iter()
        .filter(|l| l.age_seconds > STALE_THRESHOLD_SECONDS)
        .count();
    if stale_count > 0 {
        return format!(
            "bridge STALE: {} pending locks > 24h",
            stale_count
        );
    }

    // 2. Drift check: |locked - minted| > tolerance.
    let diff = state.locked_zion.abs_diff(state.minted_wzion);
    if diff > BALANCE_TOLERANCE {
        return format!(
            "bridge DRIFT detected: locked={} minted={} diff={}",
            state.locked_zion, state.minted_wzion, diff
        );
    }

    // 3. TVL range check.
    if state.tvl < TVL_MIN || state.tvl > TVL_MAX {
        return format!(
            "bridge TVL OUT OF RANGE: tvl={} (expected {}..{})",
            state.tvl, TVL_MIN, TVL_MAX
        );
    }

    // 4. Vše OK.
    "bridge OK".to_string()
}

/// Kanonický encoding bridge state + verdict pro BLAKE3 hash.
///
/// Zahrnuje všechna pole bridge state + výsledný summary, takže dva různé
/// bridge se stejným verdictem dají různý hash (verifikovatelnost na úrovni
/// dat, ne jen verdictu).
fn canonical_encoding(state: &BridgeState, summary: &str) -> Vec<u8> {
    let mut buf = Vec::with_capacity(128);
    buf.extend_from_slice(&state.locked_zion.to_le_bytes());
    buf.extend_from_slice(&state.minted_wzion.to_le_bytes());
    buf.extend_from_slice(&state.tvl.to_le_bytes());
    buf.extend_from_slice(&(state.pending_locks.len() as u64).to_le_bytes());
    for lock in &state.pending_locks {
        buf.extend_from_slice(&lock.amount.to_le_bytes());
        buf.extend_from_slice(&lock.age_seconds.to_le_bytes());
    }
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
    use crate::{DummyExecutor, TaskInput};
    use poc_core::CareTask;

    /// Výsledek auditu bridge — klasifikuje `summary` string (test helper).
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    enum AuditVerdict {
        /// Vše v pořádku.
        Ok,
        /// Detekován drift mezi locked a minted.
        Drift,
        /// Detekovány stale pending locky.
        Stale,
        /// TVL mimo rozumný range.
        TvlOutOfRange,
    }

    /// Pomocná funkce: vytvoří `TaskInput` pro WarpBridgeAudit s daným
    /// `input_hash` (poslední bajt = `tag`, zbytek nulový) a epochou.
    fn warp_input(tag: u8, epoch: u64) -> TaskInput {
        let mut input_hash = [0u8; 32];
        // Nenulový hash (jinak executor odmítne) — poslední bajt = tag.
        input_hash[31] = tag;
        // A ještě jeden bajt aby to nebylo jen 0..0,tag — lépe se distribuuje.
        input_hash[0] = 0x42;
        TaskInput {
            task: CareTask::WarpBridgeAudit,
            input_hash,
            epoch,
        }
    }

    /// Najde první `input_hash` (scan přes tag 1..=255) jehož audit verdict
    /// odpovídá `wanted`. Vrací odpovídající `TaskInput`.
    fn find_input_with_verdict(wanted: AuditVerdict, epoch: u64) -> TaskInput {
        for tag in 1u8..=255u8 {
            let input = warp_input(tag, epoch);
            let state = generate_mock_bridge_state(&input.input_hash, epoch);
            let summary = audit_bridge(&state);
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
        if summary.starts_with("bridge OK") {
            AuditVerdict::Ok
        } else if summary.starts_with("bridge DRIFT") {
            AuditVerdict::Drift
        } else if summary.starts_with("bridge STALE") {
            AuditVerdict::Stale
        } else if summary.starts_with("bridge TVL") {
            AuditVerdict::TvlOutOfRange
        } else {
            panic!("unknown summary: {summary}");
        }
    }

    #[test]
    fn warp_executor_detects_drift() {
        // Najdi vstup který produkuje DRIFT (mode 1 → velký rozdíl locked/minted).
        let input = find_input_with_verdict(AuditVerdict::Drift, 42);
        let executor = WarpBridgeAuditExecutor::new();
        let output = executor.execute(&input).expect("execute should succeed");

        assert!(
            output.summary.starts_with("bridge DRIFT"),
            "expected DRIFT, got: {}",
            output.summary
        );
        // Summary musí obsahovat locked, minted, diff hodnoty.
        assert!(output.summary.contains("locked="));
        assert!(output.summary.contains("minted="));
        assert!(output.summary.contains("diff="));
        // bytes musí být neprázdné (BLAKE3 hash = 32 bajtů).
        assert_eq!(output.bytes.len(), 32);
        assert!(!output.bytes.iter().all(|&b| b == 0));
    }

    #[test]
    fn warp_executor_healthy_bridge() {
        // Najdi vstup který produkuje OK (mode 0 → vyvážené, čerstvé locky).
        let input = find_input_with_verdict(AuditVerdict::Ok, 7);
        let executor = WarpBridgeAuditExecutor::new();
        let output = executor.execute(&input).expect("execute should succeed");

        assert_eq!(
            output.summary, "bridge OK",
            "expected OK, got: {}",
            output.summary
        );
        assert_eq!(output.bytes.len(), 32);
    }

    #[test]
    fn warp_executor_stale_locks() {
        // Najdi vstup který produkuje STALE (mode 2 → staré pending locky).
        let input = find_input_with_verdict(AuditVerdict::Stale, 99);
        let executor = WarpBridgeAuditExecutor::new();
        let output = executor.execute(&input).expect("execute should succeed");

        assert!(
            output.summary.starts_with("bridge STALE"),
            "expected STALE, got: {}",
            output.summary
        );
        // Summary musí obsahovat počet stale locků.
        assert!(output.summary.contains("pending locks > 24h"));
        assert_eq!(output.bytes.len(), 32);
    }

    #[test]
    fn executor_outputs_are_deterministic() {
        // Stejný input → stejný output (bytes i summary).
        let input = find_input_with_verdict(AuditVerdict::Ok, 10);
        let executor = WarpBridgeAuditExecutor::new();

        let out1 = executor.execute(&input).expect("execute 1");
        let out2 = executor.execute(&input).expect("execute 2");

        assert_eq!(out1.bytes, out2.bytes, "bytes must be identical");
        assert_eq!(out1.summary, out2.summary, "summary must be identical");
    }

    #[test]
    fn executor_outputs_differ_per_epoch() {
        // Stejný input_hash ale jiná epocha → jiný seed → jiný output.
        // Použijeme vstup který je OK v jedné epoše; v jiné epoše se seed
        // změní, takže i verdict/bytes se mohou lišit. Klíčové: bytes se změní.
        let input_e1 = warp_input(1, 1);
        let input_e2 = TaskInput {
            task: CareTask::WarpBridgeAudit,
            input_hash: input_e1.input_hash,
            epoch: 2,
        };
        let executor = WarpBridgeAuditExecutor::new();

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
        let executor = WarpBridgeAuditExecutor::new();
        let out1 = executor.execute(&warp_input(1, 5)).expect("execute 1");
        let out2 = executor.execute(&warp_input(2, 5)).expect("execute 2");
        assert_ne!(out1.bytes, out2.bytes);
    }

    #[test]
    fn executor_rejects_unsupported_task() {
        let executor = WarpBridgeAuditExecutor::new();
        let input = TaskInput {
            task: CareTask::LiquidityHealth,
            input_hash: [1u8; 32],
            epoch: 1,
        };
        let err = executor.execute(&input).expect_err("should reject");
        assert_eq!(err, ExecutorError::UnsupportedTask(CareTask::LiquidityHealth));
    }

    #[test]
    fn executor_rejects_zero_input_hash() {
        let executor = WarpBridgeAuditExecutor::new();
        let input = TaskInput {
            task: CareTask::WarpBridgeAudit,
            input_hash: [0u8; 32],
            epoch: 1,
        };
        let err = executor.execute(&input).expect_err("should reject zero hash");
        assert!(matches!(err, ExecutorError::InvalidInput(_)));
    }

    #[test]
    fn executor_supports_warp_bridge_audit() {
        let executor = WarpBridgeAuditExecutor::new();
        assert_eq!(executor.supports(), &[CareTask::WarpBridgeAudit]);
    }

    // ── Composite / routing test ──────────────────────────────────────────────

    /// Composite router — dispatches na správný executor podle task typu.
    /// Verifikuje že [`TaskExecutor`] trait funguje pro polymorfní routing.
    fn route_execute(
        warp: &WarpBridgeAuditExecutor,
        dummy: &DummyExecutor,
        input: &TaskInput,
    ) -> crate::TaskOutput {
        match input.task {
            CareTask::WarpBridgeAudit => {
                warp.execute(input).expect("warp executor should not fail")
            }
            _ => dummy.execute(input),
        }
    }

    #[test]
    fn composite_or_routing_test() {
        // Verifikuj že trait-based routing funguje: WarpBridgeAudit → warp
        // executor (reálný output), ostatní tasky → DummyExecutor fallback.
        let warp = WarpBridgeAuditExecutor::new();
        let dummy = DummyExecutor;

        // WarpBridgeAudit → warp executor (reálný audit output).
        let warp_input = find_input_with_verdict(AuditVerdict::Ok, 3);
        let warp_out = route_execute(&warp, &dummy, &warp_input);
        assert_eq!(warp_out.bytes.len(), 32, "warp output is BLAKE3 hash");
        assert!(warp_out.summary.starts_with("bridge"));

        // Jiný task → DummyExecutor (placeholder output).
        let other_input = TaskInput {
            task: CareTask::NpuInferenceQuality,
            input_hash: [2u8; 32],
            epoch: 3,
        };
        let other_out = route_execute(&warp, &dummy, &other_input);
        // DummyExecutor output = summary string jako bytes (ne BLAKE3 hash).
        assert_ne!(other_out.bytes.len(), 32);
        assert!(other_out.summary.contains("Chokmah"));

        // Trait object dispatch také funguje (verifikace dyn compatibility).
        let executors: Vec<Box<dyn TaskExecutor>> = vec![Box::new(WarpBridgeAuditExecutor::new())];
        for exec in &executors {
            assert_eq!(exec.supports(), &[CareTask::WarpBridgeAudit]);
        }
        let dyn_out = executors[0].execute(&warp_input).expect("dyn execute");
        assert_eq!(dyn_out.bytes, warp_out.bytes, "dyn dispatch must match");
    }

    #[test]
    fn all_three_verdicts_are_reachable() {
        // Sanity check: pro tag 1..=255 existuje alespoň jeden vstup pro
        // každý z verdictů OK, DRIFT, STALE. Zaručuje že mock generátor
        // pokrývá všechny scénáře.
        let epoch = 1;
        let mut found_ok = false;
        let mut found_drift = false;
        let mut found_stale = false;
        for tag in 1u8..=255u8 {
            let input = warp_input(tag, epoch);
            let state = generate_mock_bridge_state(&input.input_hash, epoch);
            let verdict = verdict_from_summary(&audit_bridge(&state));
            match verdict {
                AuditVerdict::Ok => found_ok = true,
                AuditVerdict::Drift => found_drift = true,
                AuditVerdict::Stale => found_stale = true,
                AuditVerdict::TvlOutOfRange => {}
            }
        }
        assert!(found_ok, "OK verdict must be reachable");
        assert!(found_drift, "DRIFT verdict must be reachable");
        assert!(found_stale, "STALE verdict must be reachable");
    }

    #[test]
    fn mock_bridge_state_is_deterministic() {
        // Stejný input_hash + epoch → identický bridge state.
        let input = warp_input(5, 10);
        let s1 = generate_mock_bridge_state(&input.input_hash, 10);
        let s2 = generate_mock_bridge_state(&input.input_hash, 10);
        assert_eq!(s1, s2);
    }

    #[test]
    fn mock_bridge_state_differs_per_epoch() {
        let input = warp_input(5, 10);
        let s1 = generate_mock_bridge_state(&input.input_hash, 10);
        let s2 = generate_mock_bridge_state(&input.input_hash, 11);
        assert_ne!(s1, s2, "different epoch must produce different state");
    }
}
