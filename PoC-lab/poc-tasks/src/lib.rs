//! # poc-tasks
//!
//! Definice care tasků, generátor assignmentů a jednoduché runtime simulace.
//!
//! Tento crate nově obsahuje [`HiranTaskExecutor`], který obaluje [`DummyExecutor`]
//! a po každém `execute()` volání uloží [`HiranVerdict`] pro audit trail.

use blake3::Hasher;
use poc_core::{CareProof, CareTask, Hash, HiranVerdict, NpuAttestation, ValidatorId};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Vstupní data pro care task.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaskInput {
    /// Task, který má validátor vykonat.
    pub task: CareTask,
    /// Hash vstupních dat pro inference (např. bridge state digest).
    pub input_hash: Hash,
    /// Block height / epoch pro který je task určen.
    pub epoch: u64,
}

/// Výstup care tasku před zabalením do `CareProof`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaskOutput {
    /// Raw bytes z inference / audit funkce.
    pub bytes: Vec<u8>,
    /// Krátký popis výsledku pro lidské čtení.
    pub summary: String,
}

/// Assigner přiřazuje care tasky validátorům deterministicky z epoch seedu.
pub struct TaskAssigner {
    /// Každému validátoru přiřadíme maximální počet tasků per epoch.
    pub tasks_per_validator: usize,
}

impl Default for TaskAssigner {
    fn default() -> Self {
        Self {
            tasks_per_validator: 3,
        }
    }
}

impl TaskAssigner {
    /// Vrátí seznam tasků přiřazených validátorovi pro danou epochu.
    pub fn assign(&self, validator: ValidatorId, epoch: u64, pool: &[CareTask]) -> Vec<TaskInput> {
        let mut inputs = Vec::with_capacity(self.tasks_per_validator);
        for i in 0..self.tasks_per_validator {
            let mut hasher = Hasher::new();
            hasher.update(&epoch.to_le_bytes());
            hasher.update(&validator);
            hasher.update(&[i as u8]);
            let digest = hasher.finalize();
            let idx = (u64::from_le_bytes(digest.as_bytes()[0..8].try_into().unwrap())
                % pool.len() as u64) as usize;
            let task = pool[idx];
            let input_hash = Self::derive_input_hash(task, epoch, validator, i as u64);
            inputs.push(TaskInput {
                task,
                input_hash,
                epoch,
            });
        }
        inputs
    }

    fn derive_input_hash(task: CareTask, epoch: u64, validator: ValidatorId, nonce: u64) -> Hash {
        let mut hasher = Hasher::new();
        hasher.update(&[task as u8]);
        hasher.update(&epoch.to_le_bytes());
        hasher.update(&validator);
        hasher.update(&nonce.to_le_bytes());
        *hasher.finalize().as_bytes()
    }
}

/// Prototypový executor care tasků — prozatím generuje dummy výstupy.
/// V budoucnu nahradí reálnou inference / audit logikou.
pub struct DummyExecutor;

impl DummyExecutor {
    /// Spustí task a vrátí jeho výstup.
    pub fn execute(&self, input: &TaskInput) -> TaskOutput {
        let summary = format!(
            "[epoch {}] {} — {}",
            input.epoch,
            input.task.sefira_name(),
            input.task.description()
        );
        TaskOutput {
            bytes: summary.as_bytes().to_vec(),
            summary,
        }
    }

    /// Zabalí výstup do `CareProof` s nulovým care_score.
    pub fn into_proof(
        &self,
        validator_id: ValidatorId,
        input: &TaskInput,
        output: TaskOutput,
        model_hash: Hash,
    ) -> CareProof {
        let att = NpuAttestation {
            backend: "cpu-reference".into(),
            quote_hash: *blake3::hash(b"dummy-attestation").as_bytes(),
            runtime_version: "0.1.0".into(),
        };
        CareProof::new(
            validator_id,
            input.task,
            model_hash,
            input.input_hash,
            output.bytes,
            att,
        )
    }
}

/// Executor care tasků integrující Hiran AI.
///
/// Obaluje [`DummyExecutor`] a přidává:
/// - Uložení [`HiranVerdict`] pro každý zpracovaný task (audit trail).
/// - Volitelný Hiran NPU backend pro věrnou simulaci s `HiranNpuBackend`.
///
/// V stub módu (výchozí) používá `HiranVerdict::stub_accepted()`, takže
/// chování je identické s `DummyExecutor`.
pub struct HiranTaskExecutor {
    inner: DummyExecutor,
    /// Verdikty uložené pro každý zpracovaný task (validator_id → verdict).
    pub verdicts: std::collections::HashMap<ValidatorId, HiranVerdict>,
    /// Stub mode: pokud `true`, Hiran volání se neuskuteční.
    pub stub_mode: bool,
}

impl HiranTaskExecutor {
    /// Vytvoří executor v stub módu.
    pub fn new() -> Self {
        Self {
            inner: DummyExecutor,
            verdicts: std::collections::HashMap::new(),
            stub_mode: true,
        }
    }

    /// Vytvoří executor s live Hiran napojením (stub_mode = false).
    pub fn live() -> Self {
        Self {
            inner: DummyExecutor,
            verdicts: std::collections::HashMap::new(),
            stub_mode: false,
        }
    }

    /// Spustí task, zaznamená Hiran verdict a vrátí výstup.
    pub fn execute_with_hiran(&mut self, validator_id: ValidatorId, input: &TaskInput) -> TaskOutput {
        let output = self.inner.execute(input);
        let verdict = if self.stub_mode {
            HiranVerdict::stub_accepted()
        } else {
            // V live módu by se zde volalo Hiran API přes HTTP.
            // Prozatím simulujeme úspěšné přijetí s nízkým penalizačním
            // justifikačním bonusem (simulace "nominálního" live provozu).
            HiranVerdict {
                verdict: poc_core::ValidationVerdict::Accepted,
                confidence: 0.95,
                care_score_adjustment: 0,
                flags: vec![],
                reasoning: "hiran-live-placeholder: task output structurally sound".into(),
                latency_ms: 2,
            }
        };
        self.verdicts.insert(validator_id, verdict);
        output
    }

    /// Zabalí výstup do `CareProof` (deleguje na inner executor).
    pub fn into_proof(
        &self,
        validator_id: ValidatorId,
        input: &TaskInput,
        output: TaskOutput,
        model_hash: Hash,
    ) -> CareProof {
        self.inner.into_proof(validator_id, input, output, model_hash)
    }

    /// Vrátí poslední Hiran verdict pro daného validátora (nebo `None`).
    pub fn verdict_for(&self, validator_id: &ValidatorId) -> Option<&HiranVerdict> {
        self.verdicts.get(validator_id)
    }

    /// Vymaže uložené verdikty (pro novou epochu).
    pub fn clear_verdicts(&mut self) {
        self.verdicts.clear();
    }
}

impl Default for HiranTaskExecutor {
    fn default() -> Self {
        Self::new()
    }
}

/// Registry všech dostupných care tasků.
pub struct TaskRegistry {
    tasks: Vec<CareTask>,
    descriptions: HashMap<CareTask, &'static str>,
}

impl Default for TaskRegistry {
    fn default() -> Self {
        let tasks = vec![
            CareTask::ConstitutionalAudit,
            CareTask::NpuInferenceQuality,
            CareTask::L1AnomalyDetection,
            CareTask::LiquidityHealth,
            CareTask::DaoProposalAudit,
            CareTask::WarpBridgeAudit,
            CareTask::HiranInference,
            CareTask::SmartContractVerify,
            CareTask::CommunityHealth,
            CareTask::LongHorizonMonitoring,
            CareTask::MythCodeConsistency,
        ];
        let mut descriptions = HashMap::new();
        for t in &tasks {
            descriptions.insert(*t, t.description());
        }
        Self { tasks, descriptions }
    }
}

impl TaskRegistry {
    pub fn all(&self) -> &[CareTask] {
        &self.tasks
    }

    pub fn description(&self, task: CareTask) -> Option<&&'static str> {
        self.descriptions.get(&task)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn assigner_is_deterministic() {
        let assigner = TaskAssigner::default();
        let registry = TaskRegistry::default();
        let validator = [7u8; 32];
        let a = assigner.assign(validator, 42, registry.all());
        let b = assigner.assign(validator, 42, registry.all());
        assert_eq!(a, b);
    }

    #[test]
    fn assigner_differs_per_epoch() {
        let assigner = TaskAssigner::default();
        let registry = TaskRegistry::default();
        let validator = [7u8; 32];
        let a = assigner.assign(validator, 42, registry.all());
        let b = assigner.assign(validator, 43, registry.all());
        assert_ne!(a, b);
    }

    #[test]
    fn dummy_executor_produces_proof() {
        let executor = DummyExecutor;
        let registry = TaskRegistry::default();
        let assigner = TaskAssigner::default();
        let validator = [9u8; 32];
        let inputs = assigner.assign(validator, 1, registry.all());
        let model_hash = [5u8; 32];
        let out = executor.execute(&inputs[0]);
        let proof = executor.into_proof(validator, &inputs[0], out, model_hash);
        assert_eq!(proof.validator_id, validator);
        assert_eq!(proof.model_hash, model_hash);
        assert!(proof.validate_structure().is_ok());
    }

    // ── HiranTaskExecutor tests ──────────────────────────────────────────────

    #[test]
    fn hiran_executor_stub_records_accepted_verdict() {
        use poc_core::ValidationVerdict;
        let mut executor = HiranTaskExecutor::new();
        let registry = TaskRegistry::default();
        let assigner = TaskAssigner::default();
        let validator = [11u8; 32];
        let inputs = assigner.assign(validator, 2, registry.all());
        let _out = executor.execute_with_hiran(validator, &inputs[0]);
        let verdict = executor.verdict_for(&validator).unwrap();
        assert_eq!(verdict.verdict, ValidationVerdict::Accepted);
        assert!((verdict.confidence - 1.0).abs() < 1e-9);
    }

    #[test]
    fn hiran_executor_stub_produces_valid_proof() {
        let mut executor = HiranTaskExecutor::new();
        let registry = TaskRegistry::default();
        let assigner = TaskAssigner::default();
        let validator = [12u8; 32];
        let inputs = assigner.assign(validator, 3, registry.all());
        let model_hash = [7u8; 32];
        let out = executor.execute_with_hiran(validator, &inputs[0]);
        let proof = executor.into_proof(validator, &inputs[0], out, model_hash);
        assert!(proof.validate_structure().is_ok());
    }

    #[test]
    fn hiran_executor_clear_verdicts_removes_all() {
        let mut executor = HiranTaskExecutor::new();
        let registry = TaskRegistry::default();
        let assigner = TaskAssigner::default();
        let validator = [13u8; 32];
        let inputs = assigner.assign(validator, 4, registry.all());
        executor.execute_with_hiran(validator, &inputs[0]);
        assert!(executor.verdict_for(&validator).is_some());
        executor.clear_verdicts();
        assert!(executor.verdict_for(&validator).is_none());
    }

    #[test]
    fn hiran_executor_live_mode_has_lower_confidence_than_stub() {
        let mut stub_executor = HiranTaskExecutor::new();
        let mut live_executor = HiranTaskExecutor::live();
        let registry = TaskRegistry::default();
        let assigner = TaskAssigner::default();
        let v = [14u8; 32];
        let inputs = assigner.assign(v, 5, registry.all());
        stub_executor.execute_with_hiran(v, &inputs[0]);
        live_executor.execute_with_hiran(v, &inputs[0]);
        let stub_conf = stub_executor.verdict_for(&v).unwrap().confidence;
        let live_conf = live_executor.verdict_for(&v).unwrap().confidence;
        // Stub is 1.0, live placeholder is 0.95 — live should be strictly lower.
        assert!(stub_conf > live_conf, "stub={stub_conf}, live={live_conf}");
    }
}
