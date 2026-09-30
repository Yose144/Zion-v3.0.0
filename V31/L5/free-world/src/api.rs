//! REST API handlers for zion-free-world.

use crate::config::FreeWorldConfig;
use crate::dao_client::{DaoClient, DaoClientConfig, GrantProposalInput};
use crate::db::{
    FreeWorldDb, GrantRecord, ProjectRecord, QvBallotStore, QvRoundRecord, QvTransition,
};
use crate::hiran_bridge::FreeWorldHiranBridge;
use crate::metrics::serve_metrics_text;
use crate::metrics::FreeWorldMetrics;
use crate::quadratic::{self, BallotEntry};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<FreeWorldDb>>,
    pub api_key: String,
    pub metrics: Arc<FreeWorldMetrics>,
    pub hiran: Arc<FreeWorldHiranBridge>,
    pub config: FreeWorldConfig,
}

/// Generic API response wrapper using serde_json::Value for data.
#[derive(Serialize)]
pub struct ApiResponse {
    pub success: bool,
    pub data: Option<Value>,
    pub error: Option<String>,
}

impl ApiResponse {
    pub fn ok<T: Serialize>(data: T) -> Self {
        Self {
            success: true,
            data: serde_json::to_value(data).ok(),
            error: None,
        }
    }
    pub fn err(msg: &str) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(msg.to_string()),
        }
    }
}

// ── Routes ──

pub fn free_world_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/metrics", get(metrics_handler))
        .route("/api/v1/grants", get(list_grants).post(create_grant))
        .route("/api/v1/grants/:id/approve", post(approve_grant))
        .route("/api/v1/grants/:id/reject", post(reject_grant))
        .route(
            "/api/v1/grants/:id/submit-to-dao",
            post(submit_grant_to_dao),
        )
        .route("/api/v1/projects", get(list_projects).post(create_project))
        .route("/api/v1/fund/balance", get(fund_balance))
        .route("/api/v1/rounds", get(qv_list_rounds).post(qv_create_round))
        .route("/api/v1/rounds/:id", get(qv_get_round))
        .route("/api/v1/rounds/:id/open", post(qv_open_round))
        .route("/api/v1/rounds/:id/ballots", post(qv_cast_ballot))
        .route("/api/v1/rounds/:id/close", post(qv_close_round))
        .route("/api/v1/rounds/:id/results", get(qv_get_results))
        .route("/ai/analyze-grant", post(ai_analyze_grant))
        .route("/ai/suggest-projects", post(ai_suggest_projects))
        .with_state(state)
}

// ── Write auth ──
//
// Every POST route requires the `X-API-Key` header matching the configured
// FREE_WORLD_API_KEY (constant-time comparison). GET routes, /health and
// /metrics stay public (nginx IP allowlist governs exposure).

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    // Hand-rolled: no early exit; length difference folds into the diff.
    let max = a.len().max(b.len());
    let mut diff = a.len() ^ b.len();
    for i in 0..max {
        let x = a.get(i).copied().unwrap_or(0);
        let y = b.get(i).copied().unwrap_or(0);
        diff |= usize::from(x ^ y);
    }
    diff == 0
}

type ApiErr = (StatusCode, Json<ApiResponse>);

/// Recompute the count gauges from the DB — restart-safe and idempotent,
/// unlike incrementing counters per request (which drifts on restart and
/// can underflow on pre-existing rows).
fn sync_gauges(db: &FreeWorldDb, metrics: &FreeWorldMetrics) {
    use std::sync::atomic::Ordering::Relaxed;
    if let Ok(counts) = db.grant_status_counts() {
        let get = |s: &str| {
            counts
                .iter()
                .find(|(k, _)| k == s)
                .map(|(_, n)| *n)
                .unwrap_or(0)
        };
        metrics.grants_pending.store(get("pending"), Relaxed);
        metrics.grants_approved.store(get("approved"), Relaxed);
        metrics.grants_disbursed.store(get("disbursed"), Relaxed);
    }
    if let Ok(counts) = db.project_status_counts() {
        let active: u64 = counts
            .iter()
            .filter(|(s, _)| s == "active")
            .map(|(_, n)| *n)
            .sum();
        metrics.projects_active.store(active, Relaxed);
    }
}

/// Grants in these statuses can still be moved to a review outcome.
fn is_reviewable(status: &str) -> bool {
    matches!(status, "pending" | "under_review")
}

fn require_write_key(state: &AppState, headers: &HeaderMap) -> Result<(), ApiErr> {
    if state.api_key.is_empty() {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ApiResponse::err(
                "write API disabled: FREE_WORLD_API_KEY not set",
            )),
        ));
    }
    let provided = headers
        .get("x-api-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !constant_time_eq(provided.as_bytes(), state.api_key.as_bytes()) {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse::err("invalid or missing API key")),
        ));
    }
    Ok(())
}

// ── Handlers ──

async fn health(State(state): State<AppState>) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    match db.get_fund_balance() {
        Ok(_) => (StatusCode::OK, Json(ApiResponse::ok("ok"))),
        Err(e) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

async fn metrics_handler(State(state): State<AppState>) -> impl IntoResponse {
    let text = serve_metrics_text(&state.metrics);
    ([("content-type", "text/plain; charset=utf-8")], text)
}

async fn list_grants(State(state): State<AppState>) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    match db.list_grants(None) {
        // The list is served through the public proxy — keep applicant
        // names (shown in the registry) but redact payout addresses,
        // which are never displayed and would be a financial PII leak.
        Ok(mut grants) => {
            for g in &mut grants {
                g.applicant_address = None;
            }
            (StatusCode::OK, Json(ApiResponse::ok(grants)))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

#[derive(Deserialize)]
pub struct CreateGrantRequest {
    pub title: String,
    pub category: String,
    pub amount_zion: u64,
    pub description: Option<String>,
    pub applicant_name: Option<String>,
    pub applicant_address: Option<String>,
}

async fn create_grant(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateGrantRequest>,
) -> impl IntoResponse {
    if let Err(e) = require_write_key(&state, &headers) {
        return e;
    }
    if req.title.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err("title must not be empty")),
        );
    }
    // amount_zion is flowers (1e-6 ZION) — a zero grant can never be
    // funded and would be excluded from QV allocation anyway.
    if req.amount_zion == 0 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err("amount_zion must be > 0")),
        );
    }
    let mut grant = GrantRecord::new(&req.title, &req.category, req.amount_zion);
    grant.description = req.description;
    grant.applicant_name = req.applicant_name;
    grant.applicant_address = req.applicant_address;

    let db = state.db.lock().unwrap();
    match db.insert_grant(&grant) {
        Ok(_) => {
            sync_gauges(&db, &state.metrics);
            (StatusCode::CREATED, Json(ApiResponse::ok(grant)))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

#[derive(Deserialize)]
pub struct ReviewGrantRequest {
    pub notes: Option<String>,
}

/// Shared guard for review transitions: the grant must exist and be in a
/// reviewable status (pending | under_review).
fn reviewable_grant(db: &FreeWorldDb, id: &str) -> Result<GrantRecord, ApiErr> {
    match db.get_grant(id) {
        Ok(Some(g)) if is_reviewable(&g.status) => Ok(g),
        Ok(Some(g)) => Err((
            StatusCode::CONFLICT,
            Json(ApiResponse::err(&format!(
                "grant is not reviewable (status: {})",
                g.status
            ))),
        )),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(ApiResponse::err("grant not found")),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        )),
    }
}

fn review_grant(
    state: &AppState,
    headers: &HeaderMap,
    id: &str,
    notes: Option<&str>,
    target_status: &'static str,
) -> ApiErrResult {
    if let Err(e) = require_write_key(state, headers) {
        return e;
    }
    let db = state.db.lock().unwrap();
    if let Err(e) = reviewable_grant(&db, id) {
        return e;
    }
    match db.update_grant_status(id, target_status, notes) {
        Ok(_) => {
            sync_gauges(&db, &state.metrics);
            (StatusCode::OK, Json(ApiResponse::ok(target_status)))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

type ApiErrResult = (StatusCode, Json<ApiResponse>);

async fn approve_grant(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<ReviewGrantRequest>,
) -> impl IntoResponse {
    review_grant(&state, &headers, &id, req.notes.as_deref(), "approved")
}

async fn reject_grant(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<ReviewGrantRequest>,
) -> impl IntoResponse {
    review_grant(&state, &headers, &id, req.notes.as_deref(), "rejected")
}

async fn submit_grant_to_dao(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> (StatusCode, Json<ApiResponse>) {
    if let Err(e) = require_write_key(&state, &headers) {
        return e;
    }
    let grant = {
        let db = state.db.lock().unwrap();
        match db.get_grant(&id) {
            Ok(g) => g,
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ApiResponse::err(&e.to_string())),
                )
            }
        }
    };
    let grant = match grant {
        Some(g) => g,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(ApiResponse::err("Grant not found")),
            )
        }
    };
    // Only reviewed grants may go on-chain; submitting also moves the
    // grant to `on_dao`, which prevents duplicate proposals.
    if grant.status != "approved" {
        return (
            StatusCode::CONFLICT,
            Json(ApiResponse::err(&format!(
                "grant must be approved before DAO submission (status: {})",
                grant.status
            ))),
        );
    }
    let client = DaoClient::new(DaoClientConfig::from(&state.config));
    let req = GrantProposalInput {
        title: format!("Grant: {}", grant.title),
        description: grant.description.clone().unwrap_or_default(),
        category: grant.category.clone(),
        amount_zion: grant.amount_zion,
        recipient_address: grant.applicant_address.clone().unwrap_or_default(),
    };
    match client.submit_grant_proposal(&req).await {
        Ok(resp) => {
            let db = state.db.lock().unwrap();
            if let Err(e) = db.set_grant_dao_proposal(&id, resp.proposal_id) {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ApiResponse::err(&format!(
                        "proposal {} submitted but failed to persist: {}",
                        resp.proposal_id, e
                    ))),
                );
            }
            sync_gauges(&db, &state.metrics);
            (StatusCode::OK, Json(ApiResponse::ok(resp)))
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

async fn list_projects(State(state): State<AppState>) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    match db.list_projects(None) {
        Ok(projects) => (StatusCode::OK, Json(ApiResponse::ok(projects))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

/// Project statuses the operator API accepts. `vision` marks an
/// unfunded aspirational site (e.g. Uluru) — the only status allowed
/// to carry `budget_zion == 0`.
const PROJECT_STATUSES: &[&str] = &[
    "planning",
    "vision",
    "active",
    "on_hold",
    "completed",
    "cancelled",
];

#[derive(Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub category: String,
    pub budget_zion: u64,
    pub status: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
}

async fn create_project(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateProjectRequest>,
) -> impl IntoResponse {
    if let Err(e) = require_write_key(&state, &headers) {
        return e;
    }
    let status = req.status.as_deref().unwrap_or("planning");
    if req.name.trim().is_empty() || !PROJECT_STATUSES.contains(&status) {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err(
                "name must not be empty and status must be one of planning|vision|active|on_hold|completed|cancelled",
            )),
        );
    }
    if req.budget_zion == 0 && status != "vision" {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err(
                "budget_zion must be > 0 (only 'vision' projects may be unfunded)",
            )),
        );
    }
    let mut project = ProjectRecord::new(&req.name, &req.category, req.budget_zion);
    project.status = status.to_string();
    project.description = req.description;
    project.location = req.location;

    let db = state.db.lock().unwrap();
    match db.insert_project(&project) {
        Ok(_) => {
            sync_gauges(&db, &state.metrics);
            (StatusCode::CREATED, Json(ApiResponse::ok(project)))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

async fn fund_balance(State(state): State<AppState>) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    match db.get_fund_balance() {
        Ok(balance) => (StatusCode::OK, Json(ApiResponse::ok(balance))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

// ── AI / Hiran endpoints ──────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct AiAnalyzeGrantRequest {
    pub title: String,
    pub description: String,
    pub amount_zion: u64,
}

async fn ai_analyze_grant(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<AiAnalyzeGrantRequest>,
) -> impl IntoResponse {
    if let Err(e) = require_write_key(&state, &headers) {
        return e;
    }
    match state
        .hiran
        .analyze_grant_proposal(&req.title, &req.description, req.amount_zion)
        .await
    {
        Ok(analysis) => (StatusCode::OK, Json(ApiResponse::ok(analysis))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

#[derive(Deserialize)]
pub struct AiSuggestProjectsRequest {
    pub need: String,
    pub region: String,
}

async fn ai_suggest_projects(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<AiSuggestProjectsRequest>,
) -> impl IntoResponse {
    if let Err(e) = require_write_key(&state, &headers) {
        return e;
    }
    match state
        .hiran
        .suggest_community_projects(&req.need, &req.region)
        .await
    {
        Ok(suggestions) => (StatusCode::OK, Json(ApiResponse::ok(suggestions))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

// ── Quadratic voting rounds ──

fn qv_round_json(round: &QvRoundRecord, ballot_count: u64) -> Value {
    json!({
        "id": round.id,
        "title": round.title,
        "credits_per_voter": round.credits_per_voter,
        "matching_pool_zion": round.matching_pool_zion,
        "status": round.status,
        "created_at": round.created_at,
        "opened_at": round.opened_at,
        "closed_at": round.closed_at,
        "ballot_count": ballot_count,
    })
}

async fn qv_list_rounds(State(state): State<AppState>) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    match db.qv_list_rounds() {
        Ok(rounds) => {
            let list: Vec<Value> = rounds
                .iter()
                .map(|(r, count)| qv_round_json(r, *count))
                .collect();
            (StatusCode::OK, Json(ApiResponse::ok(json!(list))))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

async fn qv_get_round(State(state): State<AppState>, Path(id): Path<String>) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    let round = match db.qv_get_round(&id) {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(ApiResponse::err("round not found")),
            )
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(&e.to_string())),
            )
        }
    };
    let grant_ids = match db.qv_round_grant_ids(&id) {
        Ok(ids) => ids,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(&e.to_string())),
            )
        }
    };
    let grants: Vec<Value> = grant_ids
        .iter()
        .filter_map(|gid| db.get_grant(gid).ok().flatten())
        .map(|g| {
            json!({
                "id": g.id,
                "title": g.title,
                "category": g.category,
                "amount_zion": g.amount_zion,
            })
        })
        .collect();
    let ballot_count = db.qv_ballot_count(&id).unwrap_or(0);
    let mut out = qv_round_json(&round, ballot_count);
    out["grants"] = json!(grants);
    if round.status == "closed" {
        match db.qv_results(&id) {
            Ok(Some(results_json)) => {
                if let Ok(results) = serde_json::from_str::<Value>(&results_json) {
                    out["results"] = results;
                }
            }
            Ok(None) => {}
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ApiResponse::err(&e.to_string())),
                )
            }
        }
    }
    (StatusCode::OK, Json(ApiResponse::ok(out)))
}

#[derive(Deserialize)]
pub struct CreateRoundRequest {
    pub title: String,
    pub credits_per_voter: Option<u64>,
    pub matching_pool_zion: u64,
    pub grant_ids: Vec<String>,
}

async fn qv_create_round(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateRoundRequest>,
) -> impl IntoResponse {
    if let Err(e) = require_write_key(&state, &headers) {
        return e;
    }

    let title = req.title.trim();
    if title.is_empty() || title.chars().count() > 200 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err("title must be 1-200 characters")),
        );
    }
    let credits_per_voter = req.credits_per_voter.unwrap_or(100);
    if !(1..=10_000).contains(&credits_per_voter) {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err(
                "credits_per_voter must be between 1 and 10000",
            )),
        );
    }
    if req.matching_pool_zion == 0 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err("matching_pool_zion must be > 0")),
        );
    }
    if req.grant_ids.is_empty() || req.grant_ids.len() > 100 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err("grant_ids must contain 1-100 entries")),
        );
    }
    let unique: HashSet<&String> = req.grant_ids.iter().collect();
    if unique.len() != req.grant_ids.len() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err("grant_ids must be unique")),
        );
    }

    let mut db = state.db.lock().unwrap();
    for gid in &req.grant_ids {
        match db.get_grant(gid) {
            Ok(Some(g)) if g.status == "approved" => {}
            Ok(Some(_)) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ApiResponse::err(&format!("grant is not approved: {gid}"))),
                )
            }
            Ok(None) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ApiResponse::err(&format!("unknown grant: {gid}"))),
                )
            }
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ApiResponse::err(&e.to_string())),
                )
            }
        }
    }

    let round = QvRoundRecord {
        id: Uuid::new_v4().to_string(),
        title: title.to_string(),
        credits_per_voter,
        matching_pool_zion: req.matching_pool_zion,
        status: "draft".to_string(),
        created_at: Utc::now().to_rfc3339(),
        opened_at: None,
        closed_at: None,
    };
    match db.qv_create_round(&round, &req.grant_ids) {
        Ok(()) => (
            StatusCode::CREATED,
            Json(ApiResponse::ok(qv_round_json(&round, 0))),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

async fn qv_open_round(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Err(e) = require_write_key(&state, &headers) {
        return e;
    }
    let mut db = state.db.lock().unwrap();
    let opened_at = Utc::now().to_rfc3339();
    match db.qv_open_round(&id, &opened_at) {
        Ok(QvTransition::Done) => match db.qv_get_round(&id) {
            Ok(Some(round)) => {
                let count = db.qv_ballot_count(&id).unwrap_or(0);
                (
                    StatusCode::OK,
                    Json(ApiResponse::ok(qv_round_json(&round, count))),
                )
            }
            _ => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err("failed to load round")),
            ),
        },
        Ok(QvTransition::NotFound) => (
            StatusCode::NOT_FOUND,
            Json(ApiResponse::err("round not found")),
        ),
        Ok(QvTransition::Conflict) => (
            StatusCode::CONFLICT,
            Json(ApiResponse::err("round is not in draft status")),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

#[derive(Deserialize)]
pub struct CastBallotRequest {
    pub voter_id: String,
    pub votes: Vec<BallotEntry>,
}

async fn qv_cast_ballot(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<CastBallotRequest>,
) -> impl IntoResponse {
    if let Err(e) = require_write_key(&state, &headers) {
        return e;
    }

    let voter_id = req.voter_id.trim();
    if voter_id.is_empty() || voter_id.chars().count() > 128 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err("voter_id must be 1-128 characters")),
        );
    }

    let mut db = state.db.lock().unwrap();
    let round = match db.qv_get_round(&id) {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(ApiResponse::err("round not found")),
            )
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(&e.to_string())),
            )
        }
    };
    if round.status != "open" {
        return (
            StatusCode::CONFLICT,
            Json(ApiResponse::err("round is not open")),
        );
    }

    let eligible: HashSet<String> = match db.qv_round_grant_ids(&id) {
        Ok(ids) => ids.into_iter().collect(),
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(&e.to_string())),
            )
        }
    };
    let cost = match quadratic::validate_ballot(&req.votes, &eligible, round.credits_per_voter) {
        Ok(cost) => cost,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiResponse::err(&e.to_string())),
            )
        }
    };

    let votes_json = match serde_json::to_string(&req.votes) {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(&e.to_string())),
            )
        }
    };
    let updated_at = Utc::now().to_rfc3339();
    match db.qv_upsert_ballot(&id, voter_id, &votes_json, cost, &updated_at) {
        Ok(QvBallotStore::Stored) => (
            StatusCode::OK,
            Json(ApiResponse::ok(json!({
                "voter_id": voter_id,
                "credits_spent": cost,
                "credits_remaining": round.credits_per_voter - cost,
            }))),
        ),
        Ok(QvBallotStore::NotOpen) => (
            StatusCode::CONFLICT,
            Json(ApiResponse::err("round is not open")),
        ),
        Ok(QvBallotStore::NotFound) => (
            StatusCode::NOT_FOUND,
            Json(ApiResponse::err("round not found")),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

async fn qv_close_round(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Err(e) = require_write_key(&state, &headers) {
        return e;
    }

    let mut db = state.db.lock().unwrap();
    let round = match db.qv_get_round(&id) {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(ApiResponse::err("round not found")),
            )
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(&e.to_string())),
            )
        }
    };
    if round.status != "open" {
        return (
            StatusCode::CONFLICT,
            Json(ApiResponse::err("round is not open")),
        );
    }

    let grant_ids = match db.qv_round_grant_ids(&id) {
        Ok(ids) => ids,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(&e.to_string())),
            )
        }
    };
    let ballots = match db.qv_ballots(&id) {
        Ok(b) => b,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(&e.to_string())),
            )
        }
    };
    let parsed: Vec<Vec<BallotEntry>> = match ballots
        .iter()
        .map(|b| serde_json::from_str::<Vec<BallotEntry>>(&b.votes_json))
        .collect::<Result<_, _>>()
    {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(&format!("corrupt stored ballot: {e}"))),
            )
        }
    };

    let tallies = quadratic::tally(&parsed, &grant_ids);
    // Results are frozen forever on close, so a DB error must abort the close
    // instead of silently allocating with cap 0.
    let mut items: Vec<(String, u64, u64)> = Vec::with_capacity(tallies.len());
    for t in &tallies {
        let cap = match db.get_grant(&t.grant_id) {
            Ok(g) => g.map(|g| g.amount_zion).unwrap_or(0),
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ApiResponse::err(&e.to_string())),
                )
            }
        };
        items.push((t.grant_id.clone(), t.votes, cap));
    }
    let (allocations, unallocated) = quadratic::allocate(round.matching_pool_zion, &items);
    let allocated_zion: u64 = allocations.iter().map(|a| a.allocated_zion).sum();

    let closed_at = Utc::now().to_rfc3339();
    let grants_json: Vec<Value> = tallies
        .iter()
        .map(|t| {
            let a = allocations
                .iter()
                .find(|a| a.grant_id == t.grant_id)
                .expect("tally covers every round grant");
            json!({
                "grant_id": t.grant_id,
                "votes": t.votes,
                "voters": t.voters,
                "credits": t.credits,
                "requested_zion": a.requested_zion,
                "allocated_zion": a.allocated_zion,
                "capped": a.capped,
            })
        })
        .collect();
    let results = json!({
        "round_id": round.id,
        "ballots": ballots.len(),
        "total_votes": tallies.iter().map(|t| t.votes).sum::<u64>(),
        "total_credits_spent": ballots.iter().map(|b| b.credits_spent).sum::<u64>(),
        "matching_pool_zion": round.matching_pool_zion,
        "allocated_zion": allocated_zion,
        "unallocated_zion": unallocated,
        "grants": grants_json,
        "closed_at": closed_at,
    });
    let results_json = match serde_json::to_string(&results) {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(&e.to_string())),
            )
        }
    };

    // Status check + qv_results write + status flip inside one transaction.
    match db.qv_close_round(&id, &results_json, &closed_at) {
        Ok(QvTransition::Done) => (StatusCode::OK, Json(ApiResponse::ok(results))),
        Ok(QvTransition::NotFound) => (
            StatusCode::NOT_FOUND,
            Json(ApiResponse::err("round not found")),
        ),
        Ok(QvTransition::Conflict) => (
            StatusCode::CONFLICT,
            Json(ApiResponse::err("round is not open")),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

async fn qv_get_results(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    let round = match db.qv_get_round(&id) {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(ApiResponse::err("round not found")),
            )
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(&e.to_string())),
            )
        }
    };
    if round.status != "closed" {
        return (
            StatusCode::CONFLICT,
            Json(ApiResponse::err("round is not closed")),
        );
    }
    match db.qv_results(&id) {
        Ok(Some(results_json)) => match serde_json::from_str::<Value>(&results_json) {
            Ok(results) => (StatusCode::OK, Json(ApiResponse::ok(results))),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(&e.to_string())),
            ),
        },
        Ok(None) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err("round closed but results missing")),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}
