use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

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
    pub input_hash: String,
    pub output_hash: Option<String>,
    pub status: NclJobStatus,
    pub submitter: String,
    pub worker_id: Option<String>,
    pub reward_atomic: u64,
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
        reward_atomic: u64,
        timeout_ms: u64,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            model_id,
            backend,
            input_hash,
            output_hash: None,
            status: NclJobStatus::Queued,
            submitter,
            worker_id: None,
            reward_atomic,
            created_at: Utc::now(),
            completed_at: None,
            timeout_ms,
        }
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
        }
    }

    pub fn has_capacity(&self) -> bool {
        self.active_jobs < self.max_concurrent && self.online
    }

    pub fn supports_backend(&self, backend: ComputeBackend) -> bool {
        self.backends.contains(&backend)
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
        let mut w = NclWorker::new("w1".into(), "addr".into(), vec![ComputeBackend::OnnxRuntime]);
        assert!(w.has_capacity());
        w.active_jobs = 4;
        assert!(!w.has_capacity());
    }

    #[test]
    fn test_ncl_worker_supports_backend() {
        let w = NclWorker::new("w1".into(), "addr".into(), vec![
            ComputeBackend::OnnxRuntime,
            ComputeBackend::Wasm,
        ]);
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
