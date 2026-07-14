//! # Real care task executors
//!
//! Modul obsahuje [`TaskExecutor`] trait a konkrétní implementace executorů,
//! které produkují smysluplný, hashovatelný a verifikovatelný output pro care
//! tasky — na rozdíl od [`crate::DummyExecutor`], který generuje pouze
//! placeholder text.
//!
//! Architektura (viz `docs/PHASE1_PLAN.md` §3.2–3.4):
//! - [`TaskExecutor`] — společný trait pro všechny executory.
//! - [`ExecutorError`] — chybový enum pro selhání executoru.
//! - [`warp::WarpBridgeAuditExecutor`] — audit WARP bridge consistency.
//! - [`anomaly::L1AnomalyDetectionExecutor`] — detekce anomálií v L1 mempoolu.
//! - [`liquidity::LiquidityHealthExecutor`] — kontrola DEX liquidity pool health.
//! - [`constitutional::ConstitutionalAuditExecutor`] — audit DAO proposal vs constitution.
//! - [`CompositeExecutor`] — router který dispatchuje na správný executor podle task typu.

pub mod anomaly;
pub mod constitutional;
pub mod liquidity;
pub mod warp;

pub use anomaly::L1AnomalyDetectionExecutor;
pub use constitutional::ConstitutionalAuditExecutor;
pub use liquidity::LiquidityHealthExecutor;
pub use warp::WarpBridgeAuditExecutor;

use poc_core::CareTask;

use crate::{DummyExecutor, TaskInput, TaskOutput};

/// Chyby, které může executor vrátit při zpracování [`TaskInput`].
#[derive(Debug, thiserror::Error, PartialEq)]
pub enum ExecutorError {
    /// Task typ není podporován tímto executorem.
    #[error("task type {0:?} not supported by this executor")]
    UnsupportedTask(CareTask),
    /// Vstupní data jsou neplatná (např. nulový input_hash).
    #[error("invalid input: {0}")]
    InvalidInput(String),
    /// Audit selhal na interní chybě (např. přetečení, nekonzistentní stav).
    #[error("audit failed: {0}")]
    AuditFailed(String),
}

/// Executor, který produkuje reálný výstup pro care task.
///
/// Na rozdíl od [`crate::DummyExecutor`] generuje smysluplná data a výsledek
/// je deterministický — stejný [`TaskInput`] vždy produkuje stejný
/// [`TaskOutput`].
///
/// Každý executor deklaruje které [`CareTask`] typy podporuje přes [`supports`].
pub trait TaskExecutor {
    /// Spustí task nad vstupními daty a vrátí výsledek.
    ///
    /// # Determinismus
    ///
    /// Implementace musí být deterministické: stejný `input` → stejný výstup.
    /// To je klíčové pro cross-validaci — dva honest validátoři se stejným
    /// vstupem musí produkovat identický [`TaskOutput::bytes`].
    fn execute(&self, input: &TaskInput) -> Result<TaskOutput, ExecutorError>;

    /// Které task typy tento executor podporuje.
    fn supports(&self) -> &'static [CareTask];
}

/// Router executor — dispatches na správný executor podle task typu.
///
/// Pro tasky s reálným executorem (WarpBridgeAudit, L1AnomalyDetection,
/// LiquidityHealth, ConstitutionalAudit) používá specifickou implementaci.
/// Pro ostatní tasky (NpuInferenceQuality, HiranInference, SmartContractVerify,
/// CommunityHealth, LongHorizonMonitoring, MythCodeConsistency) fallbackuje
/// na [`DummyExecutor`].
///
/// Tohle umožňuje postupně nahrazovat DummyExecutor reálnou logikou bez
/// nutnosti implementovat všechny executory najednou.
#[derive(Debug, Clone, Default)]
pub struct CompositeExecutor {
    warp: WarpBridgeAuditExecutor,
    anomaly: L1AnomalyDetectionExecutor,
    liquidity: LiquidityHealthExecutor,
    constitutional: ConstitutionalAuditExecutor,
    dummy: DummyExecutor,
}

impl CompositeExecutor {
    pub fn new() -> Self {
        Self::default()
    }

    /// Spustí task a vrátí výstup. Pro tasky s reálným executorem vrací
    /// `Ok(TaskOutput)`, pro ostatní fallbackuje na DummyExecutor (vždy `Ok`).
    ///
    /// Pokud reálný executor vrátí chybu (např. unsupported task po změně
    /// task typu), fallbackuje na DummyExecutor.
    pub fn execute(&self, input: &TaskInput) -> TaskOutput {
        match input.task {
            CareTask::WarpBridgeAudit => self
                .warp
                .execute(input)
                .unwrap_or_else(|_| self.dummy.execute(input)),
            CareTask::L1AnomalyDetection => self
                .anomaly
                .execute(input)
                .unwrap_or_else(|_| self.dummy.execute(input)),
            CareTask::LiquidityHealth => self
                .liquidity
                .execute(input)
                .unwrap_or_else(|_| self.dummy.execute(input)),
            CareTask::ConstitutionalAudit => self
                .constitutional
                .execute(input)
                .unwrap_or_else(|_| self.dummy.execute(input)),
            // Tasky bez specifického executoru → DummyExecutor fallback.
            _ => self.dummy.execute(input),
        }
    }
}

#[cfg(test)]
mod composite_tests {
    use super::*;
    use crate::{TaskInput, TaskRegistry, TaskAssigner};

    #[test]
    fn composite_routes_warp_to_warp_executor() {
        let executor = CompositeExecutor::new();
        let input = TaskInput {
            task: CareTask::WarpBridgeAudit,
            input_hash: [0x42; 32],
            epoch: 1,
        };
        let output = executor.execute(&input);
        // Warp executor produces BLAKE3 hash (32 bytes) + "bridge ..." summary.
        assert_eq!(output.bytes.len(), 32, "warp output should be BLAKE3 hash");
        assert!(output.summary.starts_with("bridge"), "summary: {}", output.summary);
    }

    #[test]
    fn composite_routes_anomaly_to_anomaly_executor() {
        let executor = CompositeExecutor::new();
        let input = TaskInput {
            task: CareTask::L1AnomalyDetection,
            input_hash: [0x42; 32],
            epoch: 1,
        };
        let output = executor.execute(&input);
        assert_eq!(output.bytes.len(), 32, "anomaly output should be BLAKE3 hash");
        assert!(
            output.summary.starts_with("mempool"),
            "summary: {}",
            output.summary
        );
    }

    #[test]
    fn composite_routes_liquidity_to_liquidity_executor() {
        let executor = CompositeExecutor::new();
        let input = TaskInput {
            task: CareTask::LiquidityHealth,
            input_hash: [0x42; 32],
            epoch: 1,
        };
        let output = executor.execute(&input);
        assert_eq!(output.bytes.len(), 32, "liquidity output should be BLAKE3 hash");
        assert!(
            output.summary.starts_with("pool"),
            "summary: {}",
            output.summary
        );
    }

    #[test]
    fn composite_routes_constitutional_to_constitutional_executor() {
        let executor = CompositeExecutor::new();
        let input = TaskInput {
            task: CareTask::ConstitutionalAudit,
            input_hash: [0x42; 32],
            epoch: 1,
        };
        let output = executor.execute(&input);
        assert_eq!(
            output.bytes.len(), 32,
            "constitutional output should be BLAKE3 hash"
        );
        assert!(
            output.summary.starts_with("proposal"),
            "summary: {}",
            output.summary
        );
    }

    #[test]
    fn composite_falls_back_to_dummy_for_unimplemented_tasks() {
        let executor = CompositeExecutor::new();
        let input = TaskInput {
            task: CareTask::NpuInferenceQuality,
            input_hash: [0x42; 32],
            epoch: 1,
        };
        let output = executor.execute(&input);
        // DummyExecutor output = summary string as bytes (not 32-byte hash).
        assert_ne!(output.bytes.len(), 32, "dummy output should not be BLAKE3 hash");
    }

    #[test]
    fn composite_is_deterministic() {
        let executor = CompositeExecutor::new();
        let input = TaskInput {
            task: CareTask::WarpBridgeAudit,
            input_hash: [0x42; 32],
            epoch: 7,
        };
        let out1 = executor.execute(&input);
        let out2 = executor.execute(&input);
        assert_eq!(out1.bytes, out2.bytes, "composite must be deterministic");
        assert_eq!(out1.summary, out2.summary);
    }

    #[test]
    fn composite_handles_all_task_types_in_registry() {
        let executor = CompositeExecutor::new();
        let registry = TaskRegistry::default();
        let assigner = TaskAssigner::default();
        let validator = [99u8; 32];
        let inputs = assigner.assign(validator, 1, registry.all());

        for input in &inputs {
            // Every task type should produce a non-empty output.
            let output = executor.execute(input);
            assert!(
                !output.bytes.is_empty(),
                "task {:?} produced empty output",
                input.task
            );
            assert!(
                !output.summary.is_empty(),
                "task {:?} produced empty summary",
                input.task
            );
        }
    }
}
