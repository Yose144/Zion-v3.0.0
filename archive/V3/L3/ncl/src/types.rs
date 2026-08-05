use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ─── NCL task type ────────────────────────────────────────────────────────────

/// High-level AI task category — used for routing and pricing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum NclTaskType {
    /// Text generation / LLM inference
    LlmInference,
    /// Image synthesis
    ImageGeneration,
    /// Fine-tuning / model training
    ModelTraining,
    /// Vector embeddings
    Embeddings,
    /// Code analysis, review
    CodeAnalysis,
    /// User-defined custom task
    Custom,
}

impl std::fmt::Display for NclTaskType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::LlmInference => write!(f, "llm_inference"),
            Self::ImageGeneration => write!(f, "image_generation"),
            Self::ModelTraining => write!(f, "model_training"),
            Self::Embeddings => write!(f, "embeddings"),
            Self::CodeAnalysis => write!(f, "code_analysis"),
            Self::Custom => write!(f, "custom"),
        }
    }
}

// ─── Compute backends ────────────────────────────────────────────────────────

/// Supported compute backends.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ComputeBackend {
    /// ONNX Runtime (CPU/GPU)
    OnnxRuntime,
    /// WebAssembly (sandboxed)
    Wasm,
    /// TensorFlow Lite
    TfLite,
    /// Custom native binary
    Custom,
}

impl std::fmt::Display for ComputeBackend {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ComputeBackend::OnnxRuntime => write!(f, "onnx"),
            ComputeBackend::Wasm => write!(f, "wasm"),
            ComputeBackend::TfLite => write!(f, "tflite"),
            ComputeBackend::Custom => write!(f, "custom"),
        }
    }
}

/// Status of an NCL job.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NclJobStatus {
    Queued,
    Assigned,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// An AI compute job submitted to the NCL marketplace.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NclJob {
    pub id: Uuid,
    pub model_id: String,
    pub backend: ComputeBackend,
    /// High-level task category (for routing and pricing decisions)
    pub task_type: NclTaskType,
    pub input_hash: String,
    pub output_hash: Option<String>,
    pub status: NclJobStatus,
    pub submitter: String,
    pub worker_id: Option<String>,
    pub reward_flowers: u64,
    /// Priority 1 (lowest) – 10 (highest); default 5
    pub priority: u8,
    /// Minimum miner consciousness level required to accept this job
    pub min_consciousness: u8,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub timeout_ms: u64,
}

impl NclJob {
    pub fn new(
        model_id: String,
        backend: ComputeBackend,
        input_hash: String,
        submitter: String,
        reward_flowers: u64,
        timeout_ms: u64,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            model_id,
            backend,
            task_type: NclTaskType::Custom,
            input_hash,
            output_hash: None,
            status: NclJobStatus::Queued,
            submitter,
            worker_id: None,
            reward_flowers,
            priority: 5,
            min_consciousness: 0,
            created_at: Utc::now(),
            completed_at: None,
            timeout_ms,
        }
    }

    pub fn with_priority(mut self, p: u8) -> Self {
        self.priority = p.clamp(1, 10);
        self
    }

    pub fn with_task_type(mut self, t: NclTaskType) -> Self {
        self.task_type = t;
        self
    }

    pub fn with_min_consciousness(mut self, level: u8) -> Self {
        self.min_consciousness = level;
        self
    }
}

/// A registered compute worker (miner providing AI compute).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NclWorker {
    pub id: String,
    pub address: String,
    pub backends: Vec<ComputeBackend>,
    pub max_concurrent: usize,
    pub active_jobs: usize,
    pub total_completed: u64,
    pub total_earned: u64,
    pub online: bool,
    pub last_heartbeat: DateTime<Utc>,
    /// Miner consciousness level (affects job eligibility and pricing bonus)
    pub consciousness_level: u8,
}

impl NclWorker {
    pub fn new(id: String, address: String, backends: Vec<ComputeBackend>) -> Self {
        Self {
            id,
            address,
            backends,
            max_concurrent: 4,
            active_jobs: 0,
            total_completed: 0,
            total_earned: 0,
            online: true,
            last_heartbeat: Utc::now(),
            consciousness_level: 0,
        }
    }

    pub fn has_capacity(&self) -> bool {
        self.active_jobs < self.max_concurrent && self.online
    }

    pub fn supports_backend(&self, backend: ComputeBackend) -> bool {
        self.backends.contains(&backend)
    }

    /// Returns `true` if worker meets the minimum consciousness requirement.
    pub fn meets_consciousness(&self, min: u8) -> bool {
        self.consciousness_level >= min
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ncl_job_new() {
        let job = NclJob::new(
            "gpt-mini".into(),
            ComputeBackend::OnnxRuntime,
            "input_hash".into(),
            "zion1submitter".into(),
            1_000_000,
            30_000,
        );
        assert_eq!(job.status, NclJobStatus::Queued);
        assert_eq!(job.backend, ComputeBackend::OnnxRuntime);
    }

    #[test]
    fn test_ncl_worker_capacity() {
        let mut w = NclWorker::new(
            "w1".into(),
            "addr".into(),
            vec![ComputeBackend::OnnxRuntime],
        );
        assert!(w.has_capacity());
        w.active_jobs = 4;
        assert!(!w.has_capacity());
    }

    #[test]
    fn test_ncl_worker_supports_backend() {
        let w = NclWorker::new(
            "w1".into(),
            "addr".into(),
            vec![ComputeBackend::OnnxRuntime, ComputeBackend::Wasm],
        );
        assert!(w.supports_backend(ComputeBackend::OnnxRuntime));
        assert!(w.supports_backend(ComputeBackend::Wasm));
        assert!(!w.supports_backend(ComputeBackend::TfLite));
    }

    #[test]
    fn test_compute_backend_display() {
        assert_eq!(ComputeBackend::OnnxRuntime.to_string(), "onnx");
        assert_eq!(ComputeBackend::Wasm.to_string(), "wasm");
    }
}
