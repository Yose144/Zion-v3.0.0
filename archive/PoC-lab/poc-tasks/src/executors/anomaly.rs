//! # L1AnomalyDetectionExecutor
//!
//! Detekce anomálií v L1 mempool / transaction patterns (Binah /
//! `CareTask::L1AnomalyDetection`).
//!
//! Executor ověřuje dva typy anomálií v mempool snapshotu:
//! 1. **Fee outlier** — transakce s fee která má z-score > 3 vůči zbytku
//!    mempoolu (statistická detekce neobvyklých fee spikes).
//! 2. **Circular transfer** — skupina transakcí tvořící cyklus
//!    (A→B→C→A), indikace potenciálního wash-trading / circular transfer.
//!
//! V izolované laboratoři (Fáze 1) se mempool generuje deterministicky
//! z `input_hash` + `epoch` přes [`generate_mock_mempool`]. V Fázi 2 bude
//! nahrazeno reálným napojením na L1 mempool API.
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

/// Počet transakcí v mock mempoolu.
const N_TX: usize = 20;

/// Z-score threshold pro outlier detekci (|z| > 3 → outlier).
const Z_SCORE_THRESHOLD: f64 = 3.0;

/// Podporovaný task typ tímto executorem.
const SUPPORTED: &[CareTask] = &[CareTask::L1AnomalyDetection];

/// Executor pro `CareTask::L1AnomalyDetection`.
///
/// Generuje deterministický mock mempool z `input_hash` + `epoch`,
/// provede statistickou analýzu fee a detekci circular transfers,
/// a vrátí [`TaskOutput`] kde:
/// - `bytes` = BLAKE3 hash kanonického encodings audit výsledku,
/// - `summary` = lidsky čitelný popis (`"mempool clean"` /
///   `"mempool ANOMALY: outlier fee tx N z-score=Z"` /
///   `"mempool ANOMALY: circular transfer detected: ..."`).
#[derive(Debug, Clone, Default)]
pub struct L1AnomalyDetectionExecutor;

impl L1AnomalyDetectionExecutor {
    /// Vytvoří nový executor.
    pub fn new() -> Self {
        Self
    }
}

impl TaskExecutor for L1AnomalyDetectionExecutor {
    fn execute(&self, input: &TaskInput) -> Result<TaskOutput, ExecutorError> {
        // 1. Ověř že task typ je podporován.
        if input.task != CareTask::L1AnomalyDetection {
            return Err(ExecutorError::UnsupportedTask(input.task));
        }
        // 2. Ověř že input_hash není nulový (jinak seed by byl triviální).
        if input.input_hash == [0u8; 32] {
            return Err(ExecutorError::InvalidInput(
                "input_hash is zero — cannot derive mempool state".into(),
            ));
        }

        // 3. Generuj deterministický mock mempool.
        let txs = generate_mock_mempool(&input.input_hash, input.epoch);

        // 4. Proveď anomálie detekce (priorita: Circular > Outlier > Clean).
        let summary = audit_mempool(&txs);

        // 5. Kanonický encoding výsledku pro hash.
        let canonical = canonical_encoding(&txs, &summary);
        let bytes = blake3::hash(&canonical).as_bytes().to_vec();

        Ok(TaskOutput { bytes, summary })
    }

    fn supports(&self) -> &'static [CareTask] {
        SUPPORTED
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock mempool
// ──────────────────────────────────────────────────────────────────────────────

/// Jedna transakce v mock mempoolu.
#[derive(Debug, Clone, PartialEq, Eq)]
struct MempoolTx {
    /// Odesílatel (node index).
    sender: u32,
    /// Příjemce (node index).
    receiver: u32,
    /// Fee v base units.
    fee: u128,
    /// Amount v base units.
    amount: u128,
}

/// Mock mempool snapshot — deterministicky generovaný z seedu.
#[derive(Debug, Clone, PartialEq, Eq)]
struct MempoolState {
    /// Transakce v mempoolu.
    txs: Vec<MempoolTx>,
}

/// PRNG helper: deterministicky vygeneruje 32 bajtů z seedu + counteru.
///
/// Používá BLAKE3 jako PRNG — stejný seed + counter → stejný output.
fn prng(seed: &[u8; 32], counter: u64) -> [u8; 32] {
    let mut hasher = Hasher::new();
    hasher.update(seed);
    hasher.update(&counter.to_le_bytes());
    *hasher.finalize().as_bytes()
}

/// Deterministicky vygeneruje mock mempool z `input_hash` + `epoch`.
///
/// BLAKE3 seed → 32 bajtů, ze kterých se odvozují všechny transakce.
/// Jeden bajt seedu (`seed[31] % 3`) určuje "scénář" mempoolu — simuluje
/// tři realistické situace:
///
/// | mode | scénář   | fee distribution   | circular transfers |
/// |------|----------|--------------------|--------------------|
/// | 0    | clean    | normální (100-199) | žádné              |
/// | 1    | outlier  | 1 tx s obrovskou fee | žádné            |
/// | 2    | circular | normální (100-199) | 3 txs tvoří cyklus |
fn generate_mock_mempool(input_hash: &Hash, epoch: u64) -> MempoolState {
    // Seed = BLAKE3(input_hash || epoch_le).
    let mut hasher = Hasher::new();
    hasher.update(input_hash);
    hasher.update(&epoch.to_le_bytes());
    let seed = *hasher.finalize().as_bytes();

    // Scénář určený jedním bajtem.
    let mode = seed[31] % 3;

    match mode {
        0 => {
            // Clean mempool: normální fees, žádné cykly (sender < receiver).
            let txs = (0..N_TX)
                .map(|i| {
                    let r = prng(&seed, i as u64);
                    let fee = 100 + (r[0] as u128) % 100; // 100-199
                    let amount = 1_000 + (u64::from_le_bytes(
                        r[1..9].try_into().expect("8 bytes"),
                    ) as u128 % 10_000);
                    let sender = i as u32;
                    let receiver = sender + 1 + (r[9] % 3) as u32; // receiver > sender
                    MempoolTx {
                        sender,
                        receiver,
                        fee,
                        amount,
                    }
                })
                .collect();
            MempoolState { txs }
        }
        1 => {
            // Outlier: 1 transakce s obrovskou fee, zbytek normální.
            let txs = (0..N_TX)
                .map(|i| {
                    let r = prng(&seed, i as u64);
                    let fee = if i == 0 {
                        // Outlier fee: 50_000 + náhodný offset → z-score > 3.
                        50_000 + (u64::from_le_bytes(
                            r[1..9].try_into().expect("8 bytes"),
                        ) as u128 % 200_000)
                    } else {
                        100 + (r[0] as u128) % 100 // 100-199
                    };
                    let amount = 1_000 + (u64::from_le_bytes(
                        r[10..18].try_into().expect("8 bytes"),
                    ) as u128 % 10_000);
                    let sender = i as u32;
                    let receiver = sender + 1 + (r[18] % 3) as u32;
                    MempoolTx {
                        sender,
                        receiver,
                        fee,
                        amount,
                    }
                })
                .collect();
            MempoolState { txs }
        }
        2 => {
            // Circular: 3 transakce tvoří cyklus (0→1, 1→2, 2→0), zbytek normální.
            let mut txs = Vec::with_capacity(N_TX);
            // Cyklus: 0→1, 1→2, 2→0.
            for (s, r_node) in [(0u32, 1u32), (1u32, 2u32), (2u32, 0u32)] {
                let r = prng(&seed, s as u64);
                let fee = 100 + (r[0] as u128) % 100; // 100-199, žádný outlier
                let amount = 1_000 + (u64::from_le_bytes(
                    r[1..9].try_into().expect("8 bytes"),
                ) as u128 % 10_000);
                txs.push(MempoolTx {
                    sender: s,
                    receiver: r_node,
                    fee,
                    amount,
                });
            }
            // Zbytek: normální transakce, sender < receiver (nodes >= 3, žádné cykly).
            for i in 3..N_TX {
                let r = prng(&seed, i as u64);
                let fee = 100 + (r[0] as u128) % 100;
                let amount = 1_000 + (u64::from_le_bytes(
                    r[1..9].try_into().expect("8 bytes"),
                ) as u128 % 10_000);
                let sender = i as u32;
                let receiver = sender + 1 + (r[9] % 3) as u32;
                txs.push(MempoolTx {
                    sender,
                    receiver,
                    fee,
                    amount,
                });
            }
            MempoolState { txs }
        }
        _ => unreachable!("mode = seed[31] % 3 is always 0, 1, or 2"),
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Audit logic
// ──────────────────────────────────────────────────────────────────────────────

/// Provede anomálie detekce nad mempoolem a vrátí lidsky čitelný
/// `summary` string.
///
/// Priorita kontrol: **Circular > Outlier > Clean** (circular transfers
/// jsou kritičtější než fee outliers — indikují potenciální manipulaci).
fn audit_mempool(state: &MempoolState) -> String {
    // 1. Circular transfer detection.
    if let Some(cycle) = detect_circular_transfer(&state.txs) {
        return format!("mempool ANOMALY: {}", cycle);
    }

    // 2. Fee outlier detection (z-score > 3).
    if let Some(outlier) = detect_fee_outliers(&state.txs) {
        return format!("mempool ANOMALY: {}", outlier);
    }

    // 3. Vše čisté.
    "mempool clean".to_string()
}

/// Detekuje circular transfers v mempool transakcích.
///
/// Hledá 2-cykly (A→B, B→A) a 3-cykly (A→B, B→C, C→A). Deterministické —
/// vždy reportuje nejmenší cyklus v kanonickém pořadí.
fn detect_circular_transfer(txs: &[MempoolTx]) -> Option<String> {
    // Seřazený seznam unikátních hran (pro deterministické pořadí).
    let mut edges: Vec<(u32, u32)> = txs.iter().map(|t| (t.sender, t.receiver)).collect();
    edges.sort();
    edges.dedup();

    // 2-cyklus: A→B a B→A (A < B pro kanonické pořadí).
    for &(a, b) in &edges {
        if a < b && edges.contains(&(b, a)) {
            return Some(format!("circular transfer detected: {}→{}→{}", a, b, a));
        }
    }

    // 3-cyklus: A→B, B→C, C→A.
    for &(a, b) in &edges {
        for &(s2, c) in &edges {
            if s2 == b && c != a && c != b {
                if edges.contains(&(c, a)) {
                    return Some(format!(
                        "circular transfer detected: {}→{}→{}→{}",
                        a, b, c, a
                    ));
                }
            }
        }
    }

    None
}

/// Detekuje fee outliers pomocí z-score (|z| > threshold).
///
/// Počítá mean a population stddev fee, pak hledá transakce s |z-score| >
/// [`Z_SCORE_THRESHOLD`]. Vrací popis prvního nalezeného outlieru
/// (deterministické — prochází transakce v pořadí).
fn detect_fee_outliers(txs: &[MempoolTx]) -> Option<String> {
    let n = txs.len() as f64;
    if n == 0.0 {
        return None;
    }

    let fees: Vec<f64> = txs.iter().map(|t| t.fee as f64).collect();
    let mean = fees.iter().sum::<f64>() / n;
    let variance = fees.iter().map(|f| (f - mean).powi(2)).sum::<f64>() / n;
    let stddev = variance.sqrt();

    if stddev == 0.0 {
        return None; // všechny fees stejné — žádný outlier
    }

    for (i, tx) in txs.iter().enumerate() {
        let z = ((tx.fee as f64) - mean).abs() / stddev;
        if z > Z_SCORE_THRESHOLD {
            return Some(format!("outlier fee tx {} z-score={:.2}", i, z));
        }
    }

    None
}

/// Kanonický encoding mempool state + verdict pro BLAKE3 hash.
fn canonical_encoding(state: &MempoolState, summary: &str) -> Vec<u8> {
    let mut buf = Vec::with_capacity(512);
    buf.extend_from_slice(&(state.txs.len() as u64).to_le_bytes());
    for tx in &state.txs {
        buf.extend_from_slice(&tx.sender.to_le_bytes());
        buf.extend_from_slice(&tx.receiver.to_le_bytes());
        buf.extend_from_slice(&tx.fee.to_le_bytes());
        buf.extend_from_slice(&tx.amount.to_le_bytes());
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
    use crate::{TaskInput};
    use poc_core::CareTask;

    /// Výsledek auditu mempoolu — klasifikuje `summary` string (test helper).
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    enum AuditVerdict {
        /// Mempool je čistý.
        Clean,
        /// Detekován fee outlier.
        Outlier,
        /// Detekován circular transfer.
        Circular,
    }

    /// Pomocná funkce: vytvoří `TaskInput` pro L1AnomalyDetection s daným
    /// `input_hash` (poslední bajt = `tag`, zbytek nulový) a epochou.
    fn anomaly_input(tag: u8, epoch: u64) -> TaskInput {
        let mut input_hash = [0u8; 32];
        input_hash[31] = tag;
        input_hash[0] = 0x42;
        TaskInput {
            task: CareTask::L1AnomalyDetection,
            input_hash,
            epoch,
        }
    }

    /// Najde první `input_hash` (scan přes tag 1..=255) jehož audit verdict
    /// odpovídá `wanted`. Vrací odpovídající `TaskInput`.
    fn find_input_with_verdict(wanted: AuditVerdict, epoch: u64) -> TaskInput {
        for tag in 1u8..=255u8 {
            let input = anomaly_input(tag, epoch);
            let state = generate_mock_mempool(&input.input_hash, epoch);
            let summary = audit_mempool(&state);
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
        if summary.starts_with("mempool clean") {
            AuditVerdict::Clean
        } else if summary.contains("circular transfer") {
            AuditVerdict::Circular
        } else if summary.contains("outlier fee") {
            AuditVerdict::Outlier
        } else {
            panic!("unknown summary: {summary}");
        }
    }

    #[test]
    fn executor_detects_anomaly() {
        // Najdi vstup který produkuje Outlier (mode 1 → obrovská fee).
        let input = find_input_with_verdict(AuditVerdict::Outlier, 42);
        let executor = L1AnomalyDetectionExecutor::new();
        let output = executor.execute(&input).expect("execute should succeed");

        assert!(
            output.summary.contains("outlier fee"),
            "expected Outlier, got: {}",
            output.summary
        );
        assert!(output.summary.contains("z-score="));
        assert_eq!(output.bytes.len(), 32);
        assert!(!output.bytes.iter().all(|&b| b == 0));
    }

    #[test]
    fn executor_detects_circular() {
        // Najdi vstup který produkuje Circular (mode 2 → cyklus transakcí).
        let input = find_input_with_verdict(AuditVerdict::Circular, 7);
        let executor = L1AnomalyDetectionExecutor::new();
        let output = executor.execute(&input).expect("execute should succeed");

        assert!(
            output.summary.contains("circular transfer"),
            "expected Circular, got: {}",
            output.summary
        );
        assert!(output.summary.contains("→"));
        assert_eq!(output.bytes.len(), 32);
    }

    #[test]
    fn executor_clean_mempool() {
        // Najdi vstup který produkuje Clean (mode 0 → normální fees, žádné cykly).
        let input = find_input_with_verdict(AuditVerdict::Clean, 99);
        let executor = L1AnomalyDetectionExecutor::new();
        let output = executor.execute(&input).expect("execute should succeed");

        assert_eq!(
            output.summary, "mempool clean",
            "expected Clean, got: {}",
            output.summary
        );
        assert_eq!(output.bytes.len(), 32);
    }

    #[test]
    fn executor_outputs_are_deterministic() {
        // Stejný input → stejný output (bytes i summary).
        let input = find_input_with_verdict(AuditVerdict::Clean, 10);
        let executor = L1AnomalyDetectionExecutor::new();

        let out1 = executor.execute(&input).expect("execute 1");
        let out2 = executor.execute(&input).expect("execute 2");

        assert_eq!(out1.bytes, out2.bytes, "bytes must be identical");
        assert_eq!(out1.summary, out2.summary, "summary must be identical");
    }

    #[test]
    fn executor_outputs_differ_per_epoch() {
        // Stejný input_hash ale jiná epocha → jiný seed → jiný output.
        let input_e1 = anomaly_input(1, 1);
        let input_e2 = TaskInput {
            task: CareTask::L1AnomalyDetection,
            input_hash: input_e1.input_hash,
            epoch: 2,
        };
        let executor = L1AnomalyDetectionExecutor::new();

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
        let executor = L1AnomalyDetectionExecutor::new();
        let out1 = executor.execute(&anomaly_input(1, 5)).expect("execute 1");
        let out2 = executor.execute(&anomaly_input(2, 5)).expect("execute 2");
        assert_ne!(out1.bytes, out2.bytes);
    }

    #[test]
    fn executor_rejects_unsupported_task() {
        let executor = L1AnomalyDetectionExecutor::new();
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
        let executor = L1AnomalyDetectionExecutor::new();
        let input = TaskInput {
            task: CareTask::L1AnomalyDetection,
            input_hash: [0u8; 32],
            epoch: 1,
        };
        let err = executor.execute(&input).expect_err("should reject zero hash");
        assert!(matches!(err, ExecutorError::InvalidInput(_)));
    }

    #[test]
    fn executor_supports_correct_task() {
        let executor = L1AnomalyDetectionExecutor::new();
        assert_eq!(executor.supports(), &[CareTask::L1AnomalyDetection]);
    }

    #[test]
    fn all_three_verdicts_are_reachable() {
        // Sanity check: pro tag 1..=255 existuje alespoň jeden vstup pro
        // každý z verdictů Clean, Outlier, Circular.
        let epoch = 1;
        let mut found_clean = false;
        let mut found_outlier = false;
        let mut found_circular = false;
        for tag in 1u8..=255u8 {
            let input = anomaly_input(tag, epoch);
            let state = generate_mock_mempool(&input.input_hash, epoch);
            let verdict = verdict_from_summary(&audit_mempool(&state));
            match verdict {
                AuditVerdict::Clean => found_clean = true,
                AuditVerdict::Outlier => found_outlier = true,
                AuditVerdict::Circular => found_circular = true,
            }
        }
        assert!(found_clean, "Clean verdict must be reachable");
        assert!(found_outlier, "Outlier verdict must be reachable");
        assert!(found_circular, "Circular verdict must be reachable");
    }

    #[test]
    fn mock_mempool_is_deterministic() {
        // Stejný input_hash + epoch → identický mempool state.
        let input = anomaly_input(5, 10);
        let s1 = generate_mock_mempool(&input.input_hash, 10);
        let s2 = generate_mock_mempool(&input.input_hash, 10);
        assert_eq!(s1, s2);
    }

    #[test]
    fn mock_mempool_differs_per_epoch() {
        let input = anomaly_input(5, 10);
        let s1 = generate_mock_mempool(&input.input_hash, 10);
        let s2 = generate_mock_mempool(&input.input_hash, 11);
        assert_ne!(s1, s2, "different epoch must produce different state");
    }
}
