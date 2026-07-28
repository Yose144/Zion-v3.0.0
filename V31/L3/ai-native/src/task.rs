//! AI task types and lifecycle management.
//!
//! Ported from `ai_compute_orchestrator.py` — ZION 2.9 history.
//! Represents a single unit of AI work flowing through the orchestration pipeline.
//!
//! ## Task lifecycle
//! ```text
//! Pending → Assigned → Processing → Completed
//!                                 → Failed
//!                    → Timeout
//!         → Cancelled
//! ```

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ─── Task types ──────────────────────────────────────────────────────────────

/// Types of AI computational tasks dispatched through L3.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AiTaskType {
    /// Text generation / chat-completion (LLM)
    LlmInference,
    /// Image synthesis (Stable Diffusion, etc.)
    ImageGeneration,
    /// Fine-tuning / local training loop
    ModelTraining,
    /// Sentence / document vector embeddings
    Embeddings,
    /// Static analysis, code review, refactoring hints
    CodeAnalysis,
    /// Custom user-defined AI workload
    Custom,
}

impl std::fmt::Display for AiTaskType {
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

// ─── Priority ────────────────────────────────────────────────────────────────

/// Task priority in range 1 (lowest) … 10 (highest).
pub type Priority = u8;

// ─── Task status ─────────────────────────────────────────────────────────────

/// Lifecycle state of an AI task.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskStatus {
    /// Waiting in queue
    Pending,
    /// Assigned to an agent, not yet started
    Assigned,
    /// Agent is actively processing
    Processing,
    /// Successfully completed — `output` field is populated
    Completed,
    /// Processing failed — agent reported error
    Failed,
    /// Deadline exceeded before completion
    Timeout,
    /// Cancelled by submitter before assignment
    Cancelled,
}

impl std::fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Assigned => write!(f, "assigned"),
            Self::Processing => write!(f, "processing"),
            Self::Completed => write!(f, "completed"),
            Self::Failed => write!(f, "failed"),
            Self::Timeout => write!(f, "timeout"),
            Self::Cancelled => write!(f, "cancelled"),
        }
    }
}

// ─── AiTask ──────────────────────────────────────────────────────────────────

/// An AI task submitted to the orchestration pipeline.
///
/// Uses builder-style setters (`with_*`) for optional fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiTask {
    /// Unique task identifier
    pub id: Uuid,
    pub task_type: AiTaskType,
    /// Model identifier — e.g. `"llama3:8b"`, `"stable-diffusion-xl"`, `"bge-small-en"`
    pub model_id: String,
    /// ZION wallet address of the submitter
    pub submitter: String,
    /// Raw input payload (JSON)
    pub input: serde_json::Value,
    /// Completed output payload (JSON) — set when `status == Completed`
    pub output: Option<serde_json::Value>,
    pub status: TaskStatus,
    /// ZION flowers offered as reward to executing worker
    pub reward_flowers: u64,
    /// Priority 1–10 (default: 5)
    pub priority: Priority,
    /// Minimum consciousness level of the executing agent
    pub required_consciousness: u8,
    /// Seconds until the task is marked as `Timeout`
    pub timeout_secs: u64,
    pub created_at: DateTime<Utc>,
    pub assigned_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    /// UUID of the agent currently handling this task
    pub assigned_agent: Option<Uuid>,
    /// Optional error message (populated on `Failed`)
    pub error: Option<String>,
}

impl AiTask {
    /// Create a new task with sensible defaults (priority 5, timeout 120 s).
    pub fn new(
        task_type: AiTaskType,
        model_id: impl Into<String>,
        submitter: impl Into<String>,
        input: serde_json::Value,
        reward_flowers: u64,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            task_type,
            model_id: model_id.into(),
            submitter: submitter.into(),
            input,
            output: None,
            status: TaskStatus::Pending,
            reward_flowers,
            priority: 5,
            required_consciousness: 1,
            timeout_secs: 120,
            created_at: Utc::now(),
            assigned_at: None,
            completed_at: None,
            assigned_agent: None,
            error: None,
        }
    }

    /// Override priority (clamped to 1–10).
    pub fn with_priority(mut self, p: Priority) -> Self {
        self.priority = p.clamp(1, 10);
        self
    }

    /// Set minimum required agent consciousness level.
    pub fn with_consciousness(mut self, level: u8) -> Self {
        self.required_consciousness = level;
        self
    }

    /// Override timeout.
    pub fn with_timeout(mut self, secs: u64) -> Self {
        self.timeout_secs = secs;
        self
    }

    // ─── State transitions ────────────────────────────────────────────────

    /// Assign to an agent.
    pub fn assign(&mut self, agent_id: Uuid) {
        self.status = TaskStatus::Assigned;
        self.assigned_agent = Some(agent_id);
        self.assigned_at = Some(Utc::now());
    }

    /// Mark as actively processing.
    pub fn start_processing(&mut self) {
        self.status = TaskStatus::Processing;
    }

    /// Mark as successfully completed.
    pub fn complete(&mut self, output: serde_json::Value) {
        self.status = TaskStatus::Completed;
        self.output = Some(output);
        self.completed_at = Some(Utc::now());
    }

    /// Mark as failed with an error message.
    pub fn fail(&mut self, reason: impl Into<String>) {
        self.status = TaskStatus::Failed;
        self.error = Some(reason.into());
        self.completed_at = Some(Utc::now());
    }

    /// Mark as timed-out.
    pub fn mark_timeout(&mut self) {
        self.status = TaskStatus::Timeout;
        self.completed_at = Some(Utc::now());
    }

    // ─── Queries ──────────────────────────────────────────────────────────

    /// Returns `true` if the task is in a terminal state (no further transitions).
    pub fn is_terminal(&self) -> bool {
        matches!(
            self.status,
            TaskStatus::Completed
                | TaskStatus::Failed
                | TaskStatus::Timeout
                | TaskStatus::Cancelled
        )
    }

    /// Returns `true` if the task has exceeded its timeout window.
    ///
    /// Clock starts from `assigned_at` (if assigned) or `created_at`.
    pub fn is_timed_out(&self) -> bool {
        if self.is_terminal() {
            return false;
        }
        let reference = self.assigned_at.unwrap_or(self.created_at);
        let elapsed = Utc::now().signed_duration_since(reference).num_seconds();
        elapsed > self.timeout_secs as i64
    }

    /// Duration from creation to completion (if complete).
    pub fn duration_secs(&self) -> Option<i64> {
        self.completed_at
            .map(|c| c.signed_duration_since(self.created_at).num_seconds())
    }
}

// ─── Task queue helper ───────────────────────────────────────────────────────

/// A simple in-memory priority queue for AI tasks.
///
/// Higher priority → dequeued first.  Equal priority → FIFO (oldest first).
#[derive(Default)]
pub struct TaskQueue {
    tasks: Vec<AiTask>,
}

impl TaskQueue {
    pub fn new() -> Self {
        Self::default()
    }

    /// Enqueue a task.
    pub fn push(&mut self, task: AiTask) {
        self.tasks.push(task);
    }

    /// Dequeue the next task (highest priority, then oldest).
    pub fn pop_next(&mut self) -> Option<AiTask> {
        if self.tasks.is_empty() {
            return None;
        }
        // Find index of best candidate
        let idx = self
            .tasks
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| {
                a.priority
                    .cmp(&b.priority)
                    .then(b.created_at.cmp(&a.created_at)) // oldest first on tie
            })
            .map(|(i, _)| i)?;
        Some(self.tasks.remove(idx))
    }

    pub fn len(&self) -> usize {
        self.tasks.len()
    }

    pub fn is_empty(&self) -> bool {
        self.tasks.is_empty()
    }

    /// Count tasks in a specific status.
    pub fn count_by_status(&self, status: TaskStatus) -> usize {
        self.tasks.iter().filter(|t| t.status == status).count()
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn new_task(priority: u8) -> AiTask {
        AiTask::new(
            AiTaskType::LlmInference,
            "llama3:8b",
            "zion1abc",
            serde_json::json!({"prompt": "hello"}),
            50_000,
        )
        .with_priority(priority)
    }

    #[test]
    fn test_task_new_defaults() {
        let t = new_task(5);
        assert_eq!(t.status, TaskStatus::Pending);
        assert_eq!(t.priority, 5);
        assert_eq!(t.required_consciousness, 1);
        assert!(!t.is_terminal());
    }

    #[test]
    fn test_priority_clamped() {
        let t = new_task(99);
        assert_eq!(t.priority, 10);
        let t2 = new_task(0);
        assert_eq!(t2.priority, 1);
    }

    #[test]
    fn test_lifecycle() {
        let mut t = new_task(5);
        let agent_id = Uuid::new_v4();
        t.assign(agent_id);
        assert_eq!(t.status, TaskStatus::Assigned);
        t.start_processing();
        assert_eq!(t.status, TaskStatus::Processing);
        t.complete(serde_json::json!({"answer": "42"}));
        assert_eq!(t.status, TaskStatus::Completed);
        assert!(t.is_terminal());
        assert!(t.output.is_some());
        assert!(t.duration_secs().is_some());
    }

    #[test]
    fn test_task_queue_priority() {
        let mut q = TaskQueue::new();
        q.push(new_task(3));
        q.push(new_task(8));
        q.push(new_task(5));
        let first = q.pop_next().unwrap();
        assert_eq!(first.priority, 8);
        let second = q.pop_next().unwrap();
        assert_eq!(second.priority, 5);
    }

    #[test]
    fn test_timeout_detection() {
        let mut t =
            AiTask::new(AiTaskType::Embeddings, "m", "s", serde_json::json!({}), 0).with_timeout(0); // Expire immediately
                                                                                                     // Force created_at to be way in the past
        t.created_at = Utc::now() - chrono::Duration::seconds(999);
        assert!(t.is_timed_out());
    }
}
