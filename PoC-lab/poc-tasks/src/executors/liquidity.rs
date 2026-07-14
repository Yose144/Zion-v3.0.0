//! # LiquidityHealthExecutor
//!
//! Kontrola DEX liquidity pool health (Chesed / `CareTask::LiquidityHealth`).
//!
//! Executor ověřuje dva invarianty pool state:
//! 1. **Constant product** — `reserve_a * reserve_b == k_expected ± tolerance`
//!    (detekce driftu v k-hodnotě, indikace manipulace nebo bugu).
//! 2. **Slippage** — slippage pro test swap nesmí překročit threshold
//!    (detekce poolů s nedostatečnou likviditou).
//!
//! V izolované laboratoři (Fáze 1) se pool state generuje deterministicky
//! z `input_hash` + `epoch` přes [`generate_mock_pool_state`]. V Fázi 2 bude
//! nahrazeno reálným napojením na DEX API.
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

/// Počet poolů v mock pool state.
const N_POOLS: usize = 5;

/// Velikost test swapu (v base units token A).
const SWAP_AMOUNT: u128 = 1_000;

/// Tolerance pro k drift v parts-per-million (1000 ppm = 0.1 %).
const K_DRIFT_TOLERANCE_PPM: u128 = 1_000;

/// Threshold pro "high slippage" v procentech.
const SLIPPAGE_THRESHOLD_PCT: f64 = 5.0;

/// Podporovaný task typ tímto executorem.
const SUPPORTED: &[CareTask] = &[CareTask::LiquidityHealth];

/// Executor pro `CareTask::LiquidityHealth`.
///
/// Generuje deterministický mock pool state z `input_hash` + `epoch`,
/// provede constant product a slippage kontroly, a vrátí [`TaskOutput`] kde:
/// - `bytes` = BLAKE3 hash kanonického encodings audit výsledku,
/// - `summary` = lidsky čitelný popis (`"pools healthy"` /
///   `"pool N drifted: k_expected=X k_actual=Y"` /
///   `"pool N high slippage: slippage=Z%"`).
#[derive(Debug, Clone, Default)]
pub struct LiquidityHealthExecutor;

impl LiquidityHealthExecutor {
    /// Vytvoří nový executor.
    pub fn new() -> Self {
        Self
    }
}

impl TaskExecutor for LiquidityHealthExecutor {
    fn execute(&self, input: &TaskInput) -> Result<TaskOutput, ExecutorError> {
        // 1. Ověř že task typ je podporován.
        if input.task != CareTask::LiquidityHealth {
            return Err(ExecutorError::UnsupportedTask(input.task));
        }
        // 2. Ověř že input_hash není nulový (jinak seed by byl triviální).
        if input.input_hash == [0u8; 32] {
            return Err(ExecutorError::InvalidInput(
                "input_hash is zero — cannot derive pool state".into(),
            ));
        }

        // 3. Generuj deterministický mock pool state.
        let state = generate_mock_pool_state(&input.input_hash, input.epoch);

        // 4. Proveď invariantní kontroly (priorita: Drift > Slippage > Healthy).
        let summary = audit_pools(&state);

        // 5. Kanonický encoding výsledku pro hash.
        let canonical = canonical_encoding(&state, &summary);
        let bytes = blake3::hash(&canonical).as_bytes().to_vec();

        Ok(TaskOutput { bytes, summary })
    }

    fn supports(&self) -> &'static [CareTask] {
        SUPPORTED
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock pool state
// ──────────────────────────────────────────────────────────────────────────────

/// Jeden liquidity pool s reserves a očekávaným k.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Pool {
    /// Index poolu (0-based).
    index: usize,
    /// Reserve tokenu A (base units).
    reserve_a: u128,
    /// Reserve tokenu B (base units).
    reserve_b: u128,
    /// Očekávané k = reserve_a * reserve_b (z doby inicializace poolu).
    k_expected: u128,
}

/// Mock pool state snapshot — deterministicky generovaný z seedu.
#[derive(Debug, Clone, PartialEq, Eq)]
struct PoolState {
    /// Pooly v snapshotu.
    pools: Vec<Pool>,
    /// Velikost test swapu (token A → token B).
    swap_amount: u128,
}

/// PRNG helper: deterministicky vygeneruje 32 bajtů z seedu + counteru.
fn prng(seed: &[u8; 32], counter: u64) -> [u8; 32] {
    let mut hasher = Hasher::new();
    hasher.update(seed);
    hasher.update(&counter.to_le_bytes());
    *hasher.finalize().as_bytes()
}

/// Deterministicky vygeneruje mock pool state z `input_hash` + `epoch`.
///
/// BLAKE3 seed → 32 bajtů, ze kterých se odvozují všechny pooly.
/// Jeden bajt seedu (`seed[31] % 3`) určuje "scénář" pool state:
///
/// | mode | scénář        | k drift          | slippage         |
/// |------|---------------|------------------|------------------|
/// | 0    | healthy       | v tolerance      | nízká (< 5 %)    |
/// | 1    | drift         | pool 0 velký drift | nízká          |
/// | 2    | high slippage | v tolerance      | pool 0 vysoká    |
fn generate_mock_pool_state(input_hash: &Hash, epoch: u64) -> PoolState {
    // Seed = BLAKE3(input_hash || epoch_le).
    let mut hasher = Hasher::new();
    hasher.update(input_hash);
    hasher.update(&epoch.to_le_bytes());
    let seed = *hasher.finalize().as_bytes();

    // Scénář určený jedním bajtem.
    let mode = seed[31] % 3;

    match mode {
        0 => {
            // Healthy: všechny pooly mají k matching, nízká slippage.
            let pools = (0..N_POOLS)
                .map(|i| {
                    let r = prng(&seed, i as u64);
                    let base = 50_000
                        + (u128::from_le_bytes(
                            r[0..16].try_into().expect("16 bytes"),
                        ) % 100_000);
                    let reserve_a = base;
                    let reserve_b = base;
                    let k_expected = reserve_a * reserve_b;
                    Pool {
                        index: i,
                        reserve_a,
                        reserve_b,
                        k_expected,
                    }
                })
                .collect();
            PoolState {
                pools,
                swap_amount: SWAP_AMOUNT,
            }
        }
        1 => {
            // Drift: pool 0 má k_actual != k_expected (velký drift).
            let pools = (0..N_POOLS)
                .map(|i| {
                    let r = prng(&seed, i as u64);
                    let base = 50_000
                        + (u128::from_le_bytes(
                            r[0..16].try_into().expect("16 bytes"),
                        ) % 100_000);
                    if i == 0 {
                        // Pool 0: reserve_b = base * 2 → k_actual = base * base * 2
                        // (100 % drift, daleko mimo tolerance).
                        let reserve_a = base;
                        let reserve_b = base * 2;
                        let k_expected = base * base; // očekávané k
                        Pool {
                            index: i,
                            reserve_a,
                            reserve_b,
                            k_expected,
                        }
                    } else {
                        let reserve_a = base;
                        let reserve_b = base;
                        let k_expected = reserve_a * reserve_b;
                        Pool {
                            index: i,
                            reserve_a,
                            reserve_b,
                            k_expected,
                        }
                    }
                })
                .collect();
            PoolState {
                pools,
                swap_amount: SWAP_AMOUNT,
            }
        }
        2 => {
            // High slippage: pool 0 má velmi nízké reserves (slippage > 5 %).
            let pools = (0..N_POOLS)
                .map(|i| {
                    let r = prng(&seed, i as u64);
                    if i == 0 {
                        // Pool 0: reserves = 100 → slippage ≈ 90.9 % >> 5 %.
                        let reserve_a = 100u128;
                        let reserve_b = 100u128;
                        let k_expected = reserve_a * reserve_b;
                        Pool {
                            index: i,
                            reserve_a,
                            reserve_b,
                            k_expected,
                        }
                    } else {
                        let base = 50_000
                            + (u128::from_le_bytes(
                                r[0..16].try_into().expect("16 bytes"),
                            ) % 100_000);
                        let reserve_a = base;
                        let reserve_b = base;
                        let k_expected = reserve_a * reserve_b;
                        Pool {
                            index: i,
                            reserve_a,
                            reserve_b,
                            k_expected,
                        }
                    }
                })
                .collect();
            PoolState {
                pools,
                swap_amount: SWAP_AMOUNT,
            }
        }
        _ => unreachable!("mode = seed[31] % 3 is always 0, 1, or 2"),
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Audit logic
// ──────────────────────────────────────────────────────────────────────────────

/// Provede invariantní kontroly nad pool state a vrátí lidsky čitelný
/// `summary` string.
///
/// Priorita kontrol: **Drift > Slippage > Healthy** (k drift je kritičtější
/// — indikuje manipulaci nebo bug v AMM kontraktu).
fn audit_pools(state: &PoolState) -> String {
    // 1. Constant product check: k_actual vs k_expected.
    for pool in &state.pools {
        let k_actual = pool.reserve_a * pool.reserve_b;
        let drift = k_actual.abs_diff(pool.k_expected);
        // drift / k_expected > tolerance_ppm / 1_000_000
        if pool.k_expected > 0
            && drift.saturating_mul(1_000_000) > pool.k_expected.saturating_mul(K_DRIFT_TOLERANCE_PPM)
        {
            return format!(
                "pool {} drifted: k_expected={} k_actual={}",
                pool.index, pool.k_expected, k_actual
            );
        }
    }

    // 2. Slippage check pro test swap.
    for pool in &state.pools {
        let slippage = compute_slippage(pool, state.swap_amount);
        if slippage > SLIPPAGE_THRESHOLD_PCT {
            return format!(
                "pool {} high slippage: slippage={:.1}%",
                pool.index, slippage
            );
        }
    }

    // 3. Vše OK.
    "pools healthy".to_string()
}

/// Vypočítá slippage (%) pro swap `delta_a` tokenů A → B v poolu.
///
/// Slippage = delta_a / (reserve_a + delta_a) * 100 (pro constant product AMM).
/// S nulovou likviditou (reserve_a = 0) je slippage 100 %.
fn compute_slippage(pool: &Pool, delta_a: u128) -> f64 {
    if pool.reserve_a == 0 {
        return 100.0;
    }
    let r = pool.reserve_a as f64;
    let d = delta_a as f64;
    d / (r + d) * 100.0
}

/// Kanonický encoding pool state + verdict pro BLAKE3 hash.
fn canonical_encoding(state: &PoolState, summary: &str) -> Vec<u8> {
    let mut buf = Vec::with_capacity(256);
    buf.extend_from_slice(&(state.pools.len() as u64).to_le_bytes());
    buf.extend_from_slice(&state.swap_amount.to_le_bytes());
    for pool in &state.pools {
        buf.extend_from_slice(&(pool.index as u64).to_le_bytes());
        buf.extend_from_slice(&pool.reserve_a.to_le_bytes());
        buf.extend_from_slice(&pool.reserve_b.to_le_bytes());
        buf.extend_from_slice(&pool.k_expected.to_le_bytes());
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
    use crate::TaskInput;
    use poc_core::CareTask;

    /// Výsledek auditu poolů — klasifikuje `summary` string (test helper).
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    enum AuditVerdict {
        /// Vše v pořádku.
        Healthy,
        /// Detekován k drift.
        Drift,
        /// Detekována vysoká slippage.
        HighSlippage,
    }

    /// Pomocná funkce: vytvoří `TaskInput` pro LiquidityHealth s daným
    /// `input_hash` (poslední bajt = `tag`, zbytek nulový) a epochou.
    fn liquidity_input(tag: u8, epoch: u64) -> TaskInput {
        let mut input_hash = [0u8; 32];
        input_hash[31] = tag;
        input_hash[0] = 0x42;
        TaskInput {
            task: CareTask::LiquidityHealth,
            input_hash,
            epoch,
        }
    }

    /// Najde první `input_hash` (scan přes tag 1..=255) jehož audit verdict
    /// odpovídá `wanted`. Vrací odpovídající `TaskInput`.
    fn find_input_with_verdict(wanted: AuditVerdict, epoch: u64) -> TaskInput {
        for tag in 1u8..=255u8 {
            let input = liquidity_input(tag, epoch);
            let state = generate_mock_pool_state(&input.input_hash, epoch);
            let summary = audit_pools(&state);
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
        if summary.starts_with("pools healthy") {
            AuditVerdict::Healthy
        } else if summary.contains("drifted") {
            AuditVerdict::Drift
        } else if summary.contains("high slippage") {
            AuditVerdict::HighSlippage
        } else {
            panic!("unknown summary: {summary}");
        }
    }

    #[test]
    fn executor_detects_drift() {
        // Najdi vstup který produkuje Drift (mode 1 → pool 0 k mismatch).
        let input = find_input_with_verdict(AuditVerdict::Drift, 42);
        let executor = LiquidityHealthExecutor::new();
        let output = executor.execute(&input).expect("execute should succeed");

        assert!(
            output.summary.contains("drifted"),
            "expected Drift, got: {}",
            output.summary
        );
        assert!(output.summary.contains("k_expected="));
        assert!(output.summary.contains("k_actual="));
        assert_eq!(output.bytes.len(), 32);
        assert!(!output.bytes.iter().all(|&b| b == 0));
    }

    #[test]
    fn executor_detects_high_slippage() {
        // Najdi vstup který produkuje HighSlippage (mode 2 → pool 0 nízké reserves).
        let input = find_input_with_verdict(AuditVerdict::HighSlippage, 7);
        let executor = LiquidityHealthExecutor::new();
        let output = executor.execute(&input).expect("execute should succeed");

        assert!(
            output.summary.contains("high slippage"),
            "expected HighSlippage, got: {}",
            output.summary
        );
        assert!(output.summary.contains("slippage="));
        assert!(output.summary.contains("%"));
        assert_eq!(output.bytes.len(), 32);
    }

    #[test]
    fn executor_healthy_pools() {
        // Najdi vstup který produkuje Healthy (mode 0 → k matching, nízká slippage).
        let input = find_input_with_verdict(AuditVerdict::Healthy, 99);
        let executor = LiquidityHealthExecutor::new();
        let output = executor.execute(&input).expect("execute should succeed");

        assert_eq!(
            output.summary, "pools healthy",
            "expected Healthy, got: {}",
            output.summary
        );
        assert_eq!(output.bytes.len(), 32);
    }

    #[test]
    fn executor_outputs_are_deterministic() {
        // Stejný input → stejný output (bytes i summary).
        let input = find_input_with_verdict(AuditVerdict::Healthy, 10);
        let executor = LiquidityHealthExecutor::new();

        let out1 = executor.execute(&input).expect("execute 1");
        let out2 = executor.execute(&input).expect("execute 2");

        assert_eq!(out1.bytes, out2.bytes, "bytes must be identical");
        assert_eq!(out1.summary, out2.summary, "summary must be identical");
    }

    #[test]
    fn executor_outputs_differ_per_epoch() {
        // Stejný input_hash ale jiná epocha → jiný seed → jiný output.
        let input_e1 = liquidity_input(1, 1);
        let input_e2 = TaskInput {
            task: CareTask::LiquidityHealth,
            input_hash: input_e1.input_hash,
            epoch: 2,
        };
        let executor = LiquidityHealthExecutor::new();

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
        let executor = LiquidityHealthExecutor::new();
        let out1 = executor.execute(&liquidity_input(1, 5)).expect("execute 1");
        let out2 = executor.execute(&liquidity_input(2, 5)).expect("execute 2");
        assert_ne!(out1.bytes, out2.bytes);
    }

    #[test]
    fn executor_rejects_unsupported_task() {
        let executor = LiquidityHealthExecutor::new();
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
        let executor = LiquidityHealthExecutor::new();
        let input = TaskInput {
            task: CareTask::LiquidityHealth,
            input_hash: [0u8; 32],
            epoch: 1,
        };
        let err = executor.execute(&input).expect_err("should reject zero hash");
        assert!(matches!(err, ExecutorError::InvalidInput(_)));
    }

    #[test]
    fn executor_supports_correct_task() {
        let executor = LiquidityHealthExecutor::new();
        assert_eq!(executor.supports(), &[CareTask::LiquidityHealth]);
    }

    #[test]
    fn all_three_verdicts_are_reachable() {
        // Sanity check: pro tag 1..=255 existuje alespoň jeden vstup pro
        // každý z verdictů Healthy, Drift, HighSlippage.
        let epoch = 1;
        let mut found_healthy = false;
        let mut found_drift = false;
        let mut found_slippage = false;
        for tag in 1u8..=255u8 {
            let input = liquidity_input(tag, epoch);
            let state = generate_mock_pool_state(&input.input_hash, epoch);
            let verdict = verdict_from_summary(&audit_pools(&state));
            match verdict {
                AuditVerdict::Healthy => found_healthy = true,
                AuditVerdict::Drift => found_drift = true,
                AuditVerdict::HighSlippage => found_slippage = true,
            }
        }
        assert!(found_healthy, "Healthy verdict must be reachable");
        assert!(found_drift, "Drift verdict must be reachable");
        assert!(found_slippage, "HighSlippage verdict must be reachable");
    }

    #[test]
    fn mock_pool_state_is_deterministic() {
        // Stejný input_hash + epoch → identický pool state.
        let input = liquidity_input(5, 10);
        let s1 = generate_mock_pool_state(&input.input_hash, 10);
        let s2 = generate_mock_pool_state(&input.input_hash, 10);
        assert_eq!(s1, s2);
    }

    #[test]
    fn mock_pool_state_differs_per_epoch() {
        let input = liquidity_input(5, 10);
        let s1 = generate_mock_pool_state(&input.input_hash, 10);
        let s2 = generate_mock_pool_state(&input.input_hash, 11);
        assert_ne!(s1, s2, "different epoch must produce different state");
    }
}
