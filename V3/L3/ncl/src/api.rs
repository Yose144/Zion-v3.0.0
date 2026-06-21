//! NCL REST API — Axum handler functions.
//!
//! ## Endpoints
//!
//! ```text
//! GET  /health
//! POST /jobs
//! GET  /jobs/:id
//! POST /jobs/:id/complete
//! POST /jobs/:id/fail
//! POST /workers
//! GET  /workers
//! GET  /leaderboard
//! POST /schedule
//! ```
//!
//! ## Usage
//!
//! ```rust,no_run
//! use zion_ncl::api::{create_router, NclAppState};
//! use zion_ncl::{JobScheduler, ReputationRegistry};
//! use std::sync::{Arc, Mutex};
//!
//! let scheduler = Arc::new(Mutex::new(JobScheduler::new(1000)));
//! let reputation = Arc::new(Mutex::new(ReputationRegistry::new()));
//! let state = NclAppState { scheduler, reputation };
//! let app = create_router(state);
//! // axum::serve(listener, app).await.unwrap();
//! ```

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use crate::reputation::ReputationRegistry;
use crate::scheduler::JobScheduler;
use crate::types::{ComputeBackend, NclJob, NclJobStatus, NclTaskType, NclWorker};

// ─── App state ───────────────────────────────────────────────────────────────

/// Shared application state injected into every handler via `axum::extract::State`.
#[derive(Clone)]
pub struct NclAppState {
    pub scheduler: Arc<Mutex<JobScheduler>>,
    pub reputation: Arc<Mutex<ReputationRegistry>>,
}

// ─── Request / Response types ─────────────────────────────────────────────────

/// `POST /jobs` request body.
#[derive(Debug, Deserialize)]
pub struct SubmitJobRequest {
    pub submitter: String,
    pub model_id: String,
    pub backend: ComputeBackend,
    pub input_hash: String,
    pub reward_flowers: u64,
    /// Maximum job execution time in seconds
    pub max_duration_secs: u64,
    #[serde(default = "default_priority")]
    pub priority: u8,
    #[serde(default)]
    pub min_consciousness: u8,
    #[serde(default = "default_task_type")]
    pub task_type: NclTaskType,
}

fn default_priority() -> u8 {
    5
}
fn default_task_type() -> NclTaskType {
    NclTaskType::Custom
}

/// `POST /jobs` response.
#[derive(Debug, Serialize)]
pub struct SubmitJobResponse {
    pub job_id: Uuid,
    pub status: NclJobStatus,
}

/// `GET /jobs/:id` response.
#[derive(Debug, Serialize)]
pub struct JobStatusResponse {
    pub job_id: Uuid,
    pub status: NclJobStatus,
    pub worker_id: Option<String>,
    pub output_hash: Option<String>,
    pub completed_at: Option<String>,
}

/// `POST /jobs/:id/complete` request.
#[derive(Debug, Deserialize)]
pub struct CompleteJobRequest {
    pub worker_id: String,
    pub output_hash: String,
    /// Actual completion time in milliseconds
    pub duration_ms: f64,
}

/// `POST /jobs/:id/fail` request.
#[derive(Debug, Deserialize)]
pub struct FailJobRequest {
    pub worker_id: String,
    pub reason: String,
}

/// `POST /workers` request — register a new worker.
#[derive(Debug, Deserialize)]
pub struct RegisterWorkerRequest {
    pub address: String,
    pub backends: Vec<ComputeBackend>,
    pub max_concurrent: usize,
    #[serde(default)]
    pub consciousness_level: u8,
}

/// Generic success reply.
#[derive(Debug, Serialize)]
pub struct OkResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl OkResponse {
    fn ok() -> Self {
        Self {
            ok: true,
            message: None,
        }
    }
    fn msg(m: impl Into<String>) -> Self {
        Self {
            ok: true,
            message: Some(m.into()),
        }
    }
}

/// `GET /health` response.
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub queued: usize,
    pub active: usize,
    pub total_workers: usize,
    pub online_workers: usize,
}

/// Leaderboard entry.
#[derive(Debug, Serialize)]
pub struct LeaderboardEntry {
    pub rank: usize,
    pub worker_id: String,
    pub wallet_address: String,
    pub score: f64,
    pub jobs_completed: u64,
    pub avg_completion_ms: f64,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ApiResult<T> = Result<Json<T>, (StatusCode, Json<serde_json::Value>)>;

fn lock_err() -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": "lock poisoned" })),
    )
}

fn not_found(id: &str) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({ "error": format!("not found: {id}") })),
    )
}

fn bad_request(msg: impl Into<String>) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::BAD_REQUEST,
        Json(serde_json::json!({ "error": msg.into() })),
    )
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/// `GET /health`
pub async fn health(State(state): State<NclAppState>) -> ApiResult<HealthResponse> {
    let sched = state.scheduler.lock().map_err(|_| lock_err())?;
    Ok(Json(HealthResponse {
        status: "ok",
        queued: sched.queued_count(),
        active: sched.active_count(),
        total_workers: sched.worker_count(),
        online_workers: sched.online_workers(),
    }))
}

/// `POST /jobs`
pub async fn submit_job(
    State(state): State<NclAppState>,
    Json(req): Json<SubmitJobRequest>,
) -> ApiResult<SubmitJobResponse> {
    let job = NclJob::new(
        req.model_id,
        req.backend,
        req.input_hash,
        req.submitter,
        req.reward_flowers,
        req.max_duration_secs * 1_000, // convert secs → ms
    )
    .with_priority(req.priority)
    .with_task_type(req.task_type)
    .with_min_consciousness(req.min_consciousness);

    let mut sched = state.scheduler.lock().map_err(|_| lock_err())?;
    let job_id = sched
        .submit_job(job)
        .map_err(|e| bad_request(e.to_string()))?;

    Ok(Json(SubmitJobResponse {
        job_id,
        status: NclJobStatus::Queued,
    }))
}

/// `GET /jobs/:id`
pub async fn get_job(
    State(state): State<NclAppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<JobStatusResponse> {
    let sched = state.scheduler.lock().map_err(|_| lock_err())?;
    let job = sched
        .get_job(&id)
        .ok_or_else(|| not_found(&id.to_string()))?;

    Ok(Json(JobStatusResponse {
        job_id: job.id,
        status: job.status,
        worker_id: job.worker_id.clone(),
        output_hash: job.output_hash.clone(),
        completed_at: job.completed_at.map(|dt| dt.to_rfc3339()),
    }))
}

/// `POST /jobs/:id/complete`
pub async fn complete_job(
    State(state): State<NclAppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<CompleteJobRequest>,
) -> ApiResult<OkResponse> {
    let mut sched = state.scheduler.lock().map_err(|_| lock_err())?;
    let reward = sched
        .get_job(&id)
        .ok_or_else(|| not_found(&id.to_string()))
        .map(|j| j.reward_flowers)?;

    sched
        .complete_job(id, req.output_hash)
        .map_err(|e| bad_request(e.to_string()))?;
    drop(sched);

    // Update reputation
    if let Ok(mut rep) = state.reputation.lock() {
        rep.ensure(&req.worker_id, ""); // ensure record exists
        if let Some(record) = rep.get_mut(&req.worker_id) {
            record.record_success("ncl", req.duration_ms, reward);
        }
    }

    Ok(Json(OkResponse::ok()))
}

/// `POST /jobs/:id/fail`
pub async fn fail_job(
    State(state): State<NclAppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<FailJobRequest>,
) -> ApiResult<OkResponse> {
    let mut sched = state.scheduler.lock().map_err(|_| lock_err())?;
    sched
        .fail_job(id, &req.reason)
        .map_err(|e| bad_request(e.to_string()))?;
    drop(sched);

    if let Ok(mut rep) = state.reputation.lock() {
        if let Some(record) = rep.get_mut(&req.worker_id) {
            record.record_failure("ncl");
        }
    }

    Ok(Json(OkResponse::msg(format!("job {id} marked failed"))))
}

/// `POST /workers`
pub async fn register_worker(
    State(state): State<NclAppState>,
    Json(req): Json<RegisterWorkerRequest>,
) -> ApiResult<OkResponse> {
    let worker_id = Uuid::new_v4().to_string();

    let mut worker = NclWorker::new(worker_id.clone(), req.address.clone(), req.backends);
    worker.max_concurrent = req.max_concurrent;
    worker.consciousness_level = req.consciousness_level;

    state
        .scheduler
        .lock()
        .map_err(|_| lock_err())?
        .register_worker(worker);

    // Pre-create reputation record
    state
        .reputation
        .lock()
        .map_err(|_| lock_err())?
        .ensure(&worker_id, &req.address);

    Ok(Json(OkResponse::msg(format!("registered {worker_id}"))))
}

/// `GET /workers`
pub async fn list_workers(State(state): State<NclAppState>) -> ApiResult<serde_json::Value> {
    let rep = state.reputation.lock().map_err(|_| lock_err())?;
    let board: Vec<_> = rep
        .leaderboard()
        .iter()
        .map(|(id, score)| {
            let r = rep.get(id);
            serde_json::json!({
                "worker_id": id,
                "score": score,
                "jobs_completed": r.map(|r| r.jobs_completed).unwrap_or(0),
                "jobs_failed": r.map(|r| r.jobs_failed).unwrap_or(0),
                "consciousness_level": r.map(|r| r.consciousness_level).unwrap_or(0),
            })
        })
        .collect();
    Ok(Json(serde_json::json!({ "workers": board })))
}

/// `GET /leaderboard`
pub async fn leaderboard(State(state): State<NclAppState>) -> ApiResult<serde_json::Value> {
    let rep = state.reputation.lock().map_err(|_| lock_err())?;
    let entries: Vec<LeaderboardEntry> = rep
        .leaderboard()
        .iter()
        .enumerate()
        .map(|(i, (id, score))| {
            let r = rep.get(id);
            LeaderboardEntry {
                rank: i + 1,
                worker_id: id.to_string(),
                wallet_address: r.map(|r| r.wallet_address.clone()).unwrap_or_default(),
                score: *score,
                jobs_completed: r.map(|r| r.jobs_completed).unwrap_or(0),
                avg_completion_ms: r.map(|r| r.avg_completion_ms).unwrap_or(0.0),
            }
        })
        .collect();
    Ok(Json(serde_json::json!({ "leaderboard": entries })))
}

/// `POST /schedule` — trigger one scheduling cycle.
pub async fn schedule(State(state): State<NclAppState>) -> ApiResult<serde_json::Value> {
    let mut sched = state.scheduler.lock().map_err(|_| lock_err())?;
    let mut assigned = 0usize;
    let mut errors = Vec::new();

    loop {
        match sched.try_assign_next() {
            Ok(Some(_)) => assigned += 1,
            Ok(None) => break,
            Err(e) => {
                errors.push(e.to_string());
                break;
            }
        }
    }

    Ok(Json(serde_json::json!({
        "assigned": assigned,
        "queued_remaining": sched.queued_count(),
        "errors": errors,
    })))
}

// ─── Router ──────────────────────────────────────────────────────────────────

/// Build the Axum router for the NCL API.
///
/// Mount at `/api/v1/ncl` or any other prefix in your main server.
pub fn create_router(state: NclAppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/jobs", post(submit_job))
        .route("/jobs/:id", get(get_job))
        .route("/jobs/:id/complete", post(complete_job))
        .route("/jobs/:id/fail", post(fail_job))
        .route("/workers", post(register_worker).get(list_workers))
        .route("/leaderboard", get(leaderboard))
        .route("/schedule", post(schedule))
        .with_state(state)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_state() -> NclAppState {
        NclAppState {
            scheduler: Arc::new(Mutex::new(JobScheduler::new(100))),
            reputation: Arc::new(Mutex::new(ReputationRegistry::new())),
        }
    }

    #[tokio::test]
    async fn test_health_empty() {
        let state = make_state();
        let resp = health(State(state)).await.unwrap();
        assert_eq!(resp.0.queued, 0);
        assert_eq!(resp.0.status, "ok");
    }

    #[tokio::test]
    async fn test_submit_and_get_job() {
        let state = make_state();
        let req = SubmitJobRequest {
            submitter: "zion1test".into(),
            model_id: "gpt-mini".into(),
            backend: ComputeBackend::OnnxRuntime,
            input_hash: "def456".into(),
            reward_flowers: 50_000,
            max_duration_secs: 60,
            priority: 7,
            min_consciousness: 0,
            task_type: NclTaskType::LlmInference,
        };
        let submit_resp = submit_job(State(state.clone()), Json(req)).await.unwrap();
        let job_id = submit_resp.0.job_id;
        assert_eq!(submit_resp.0.status, NclJobStatus::Queued);

        let status_resp = get_job(State(state.clone()), Path(job_id)).await.unwrap();
        assert_eq!(status_resp.0.job_id, job_id);
        assert_eq!(status_resp.0.status, NclJobStatus::Queued);
    }

    #[tokio::test]
    async fn test_register_worker_and_list() {
        let state = make_state();
        let req = RegisterWorkerRequest {
            address: "zion1worker".into(),
            backends: vec![ComputeBackend::OnnxRuntime],
            max_concurrent: 4,
            consciousness_level: 3,
        };
        let resp = register_worker(State(state.clone()), Json(req))
            .await
            .unwrap();
        assert!(resp.0.ok);

        let workers = list_workers(State(state)).await.unwrap();
        let arr = workers.0["workers"].as_array().unwrap();
        assert_eq!(arr.len(), 1);
    }

    #[tokio::test]
    async fn test_schedule_assigns_job() {
        let state = make_state();

        // Register worker
        let _ = register_worker(
            State(state.clone()),
            Json(RegisterWorkerRequest {
                address: "zion1gpu".into(),
                backends: vec![ComputeBackend::OnnxRuntime],
                max_concurrent: 2,
                consciousness_level: 0,
            }),
        )
        .await
        .unwrap();

        // Submit job
        let _ = submit_job(
            State(state.clone()),
            Json(SubmitJobRequest {
                submitter: "zion1user".into(),
                model_id: "bge-small".into(),
                backend: ComputeBackend::OnnxRuntime,
                input_hash: "i1".into(),
                reward_flowers: 10_000,
                max_duration_secs: 30,
                priority: 5,
                min_consciousness: 0,
                task_type: NclTaskType::Embeddings,
            }),
        )
        .await
        .unwrap();

        // Schedule
        let sched_resp = schedule(State(state.clone())).await.unwrap();
        assert_eq!(sched_resp.0["assigned"], 1);
    }

    #[tokio::test]
    async fn test_get_nonexistent_job_404() {
        let state = make_state();
        let result = get_job(State(state), Path(Uuid::new_v4())).await;
        assert!(result.is_err());
        let (status, _) = result.unwrap_err();
        assert_eq!(status, StatusCode::NOT_FOUND);
    }
}
