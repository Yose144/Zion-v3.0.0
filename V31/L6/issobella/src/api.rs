//! REST API handlers for zion-issobella.

use crate::config::IssobellaConfig;
use crate::dao_client::{DaoClient, DaoClientConfig, MissionProposalInput};
use crate::db::{
    DisbursementRecord, IssobellaDb, MissionRecord, ObservationRecord, ResearchProposal,
};
use crate::hiran_bridge::IssobellaHiranBridge;
use crate::metrics::serve_metrics_text;
use crate::metrics::IssobellaMetrics;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<IssobellaDb>>,
    pub api_key: String,
    pub metrics: Arc<IssobellaMetrics>,
    pub hiran: Arc<IssobellaHiranBridge>,
    pub config: IssobellaConfig,
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

pub fn issobella_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/metrics", get(metrics_handler))
        .route("/api/v1/missions", get(list_missions).post(create_mission))
        .route("/api/v1/missions/:id/launch", post(launch_mission))
        .route(
            "/api/v1/missions/:id/submit-to-dao",
            post(submit_mission_to_dao),
        )
        .route("/api/v1/missions/:id/status", post(update_mission_status))
        .route("/api/v1/missions/:id/spend", post(spend_mission))
        .route(
            "/api/v1/missions/:id/observations",
            get(list_mission_observations),
        )
        .route(
            "/api/v1/observations",
            get(list_observations).post(create_observation),
        )
        .route(
            "/api/v1/proposals",
            get(list_proposals).post(create_proposal),
        )
        .route("/api/v1/proposals/:id/approve", post(approve_proposal))
        .route("/api/v1/proposals/:id/reject", post(reject_proposal))
        .route("/api/v1/fund/balance", get(fund_balance))
        .route("/api/v1/fund/disbursements", get(list_fund_disbursements))
        // ── Hiran AI endpoints ──────────────────────────────────────────────
        .route("/api/v1/ai/evaluate-mission", post(ai_evaluate_mission))
        .route("/api/v1/ai/analyze-proposal", post(ai_analyze_proposal))
        .route("/api/v1/ai/optimize-network", post(ai_optimize_network))
        .route("/api/v1/ai/mission-log", post(ai_mission_log))
        .route("/api/v1/ai/hiran-health", get(ai_hiran_health))
        .with_state(state)
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

async fn list_missions(State(state): State<AppState>) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    match db.list_missions(None) {
        Ok(missions) => (StatusCode::OK, Json(ApiResponse::ok(missions))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

#[derive(Deserialize)]
pub struct CreateMissionRequest {
    pub name: String,
    pub mission_type: String,
    pub budget_zion: u64,
    pub description: Option<String>,
    pub orbit_altitude_km: Option<f64>,
    pub target_launch_date: Option<String>,
    pub funding_address: Option<String>,
}

async fn create_mission(
    State(state): State<AppState>,
    Json(req): Json<CreateMissionRequest>,
) -> impl IntoResponse {
    let mut mission = MissionRecord::new(&req.name, &req.mission_type, req.budget_zion);
    mission.description = req.description;
    mission.orbit_altitude_km = req.orbit_altitude_km;
    mission.target_launch_date = req.target_launch_date;
    mission.funding_address = req.funding_address;

    let db = state.db.lock().unwrap();
    match db.insert_mission(&mission) {
        Ok(_) => {
            state.metrics.inc_missions_planning();
            (StatusCode::CREATED, Json(ApiResponse::ok(mission)))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

async fn launch_mission(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let (old_status, _) = match update_mission_status_inner(&state, &id, "launched").await {
        Ok(pair) => pair,
        Err(e) => return e,
    };
    update_status_metrics(&state.metrics, &old_status, "launched");
    (StatusCode::OK, Json(ApiResponse::ok("launched")))
}

#[derive(Deserialize)]
pub struct MissionStatusUpdate {
    pub status: String,
}

async fn update_mission_status(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<MissionStatusUpdate>,
) -> impl IntoResponse {
    let (old_status, updated) = match update_mission_status_inner(&state, &id, &req.status).await {
        Ok(pair) => pair,
        Err(e) => return e,
    };
    update_status_metrics(&state.metrics, &old_status, &updated.status);
    (StatusCode::OK, Json(ApiResponse::ok(updated)))
}

async fn update_mission_status_inner(
    state: &AppState,
    id: &str,
    status: &str,
) -> Result<(String, MissionRecord), (StatusCode, Json<ApiResponse>)> {
    let db = state.db.lock().unwrap();
    let current = match db.get_mission(id) {
        Ok(m) => m,
        Err(e) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ApiResponse::err(&e.to_string())),
            ))
        }
    };
    match db.update_mission_status(id, status) {
        Ok(updated) => Ok((current.status, updated)),
        Err(e) => Err((
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err(&e.to_string())),
        )),
    }
}

fn update_status_metrics(metrics: &IssobellaMetrics, old_status: &str, new_status: &str) {
    if old_status == "planning" && new_status != "planning" {
        metrics.dec_missions_planning();
    }
    if new_status == "launched" && old_status != "launched" {
        metrics.inc_missions_launched();
    }
    if old_status == "launched" && new_status != "launched" {
        metrics.dec_missions_launched();
    }
    if new_status == "operational" && old_status != "operational" {
        metrics.inc_missions_operational();
    }
    if old_status == "operational" && new_status != "operational" {
        metrics.dec_missions_operational();
    }
}

#[derive(Deserialize)]
pub struct SpendUpdate {
    pub amount: u64,
    pub tx_hash: Option<String>,
    pub recipient: Option<String>,
    pub satellite_count: Option<i64>,
}

async fn spend_mission(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<SpendUpdate>,
) -> impl IntoResponse {
    let mut disbursement = DisbursementRecord::new(&id, req.amount);
    disbursement.recipient = req.recipient;
    disbursement.tx_hash = req.tx_hash;

    let db = state.db.lock().unwrap();

    let mission = match db.get_mission(&id) {
        Ok(m) => m,
        Err(e) => {
            return (
                StatusCode::NOT_FOUND,
                Json(ApiResponse::err(&e.to_string())),
            )
        }
    };

    if !matches!(
        mission.status.as_str(),
        "approved" | "launched" | "operational"
    ) {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err(
                "Mission must be approved, launched or operational to spend",
            )),
        );
    }

    let fund = match db.get_fund_balance() {
        Ok(b) => b,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(&e.to_string())),
            )
        }
    };

    let new_total_disbursed = fund.total_disbursed.saturating_add(req.amount);
    if new_total_disbursed > fund.total_accumulated {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err(&format!(
                "Insufficient funds: required {}, available {}",
                new_total_disbursed, fund.total_accumulated
            ))),
        );
    }

    if let Err(e) = db.record_disbursement(&disbursement) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        );
    }

    if let Err(e) = db.add_disbursement_to_fund_balance(req.amount) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        );
    }

    let updated = match db.update_mission_spent_and_satellites(&id, req.amount, req.satellite_count)
    {
        Ok(m) => m,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiResponse::err(&e.to_string())),
            )
        }
    };

    drop(db);
    state.metrics.add_total_disbursed_zion(req.amount);

    (StatusCode::OK, Json(ApiResponse::ok(updated)))
}

async fn submit_mission_to_dao(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> (StatusCode, Json<ApiResponse>) {
    let mission = {
        let db = state.db.lock().unwrap();
        match db.get_mission(&id) {
            Ok(m) => m,
            Err(e) => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(ApiResponse::err(&e.to_string())),
                )
            }
        }
    };

    let funding_address = match &mission.funding_address {
        Some(addr) if !addr.is_empty() => addr.clone(),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiResponse::err(
                    "Mission has no funding_address; set it before submitting to DAO",
                )),
            )
        }
    };
    let client = DaoClient::new(DaoClientConfig::from(&state.config));
    let req = MissionProposalInput {
        title: format!("Mission: {}", mission.name),
        description: mission.description.clone().unwrap_or_default(),
        mission_type: mission.mission_type.clone(),
        amount_zion: mission.budget_zion,
        recipient_address: funding_address,
    };
    match client.submit_mission_proposal(&req).await {
        Ok(resp) => (StatusCode::OK, Json(ApiResponse::ok(resp))),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

async fn list_mission_observations(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    match db.list_observations(Some(&id)) {
        Ok(observations) => (StatusCode::OK, Json(ApiResponse::ok(observations))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

async fn list_observations(State(state): State<AppState>) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    match db.list_observations(None) {
        Ok(observations) => (StatusCode::OK, Json(ApiResponse::ok(observations))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

#[derive(Deserialize)]
pub struct CreateObservationRequest {
    pub mission_id: String,
    pub observation_type: String,
    pub data_url: Option<String>,
    pub metadata: Option<String>,
    pub recorded_at: Option<String>,
    pub published: Option<bool>,
}

async fn create_observation(
    State(state): State<AppState>,
    Json(req): Json<CreateObservationRequest>,
) -> impl IntoResponse {
    let recorded_at = req
        .recorded_at
        .as_deref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);

    let mut observation = ObservationRecord::new(&req.mission_id, &req.observation_type);
    observation.data_url = req.data_url;
    observation.metadata = req.metadata;
    observation.recorded_at = recorded_at;
    observation.published = req.published.unwrap_or(false);

    let db = state.db.lock().unwrap();
    match db.insert_observation(&observation) {
        Ok(_) => {
            state.metrics.inc_observations_recorded();
            (StatusCode::CREATED, Json(ApiResponse::ok(observation)))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

async fn list_proposals(State(state): State<AppState>) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    match db.list_proposals(None) {
        Ok(proposals) => (StatusCode::OK, Json(ApiResponse::ok(proposals))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

#[derive(Deserialize)]
pub struct CreateProposalRequest {
    pub title: String,
    pub requested_budget: u64,
    pub researcher: Option<String>,
    pub institution: Option<String>,
    pub abstract_text: Option<String>,
}

async fn create_proposal(
    State(state): State<AppState>,
    Json(req): Json<CreateProposalRequest>,
) -> impl IntoResponse {
    let mut proposal = ResearchProposal::new(&req.title, req.requested_budget);
    proposal.researcher = req.researcher;
    proposal.institution = req.institution;
    proposal.abstract_text = req.abstract_text;

    let db = state.db.lock().unwrap();
    match db.insert_proposal(&proposal) {
        Ok(_) => {
            state.metrics.inc_proposals_submitted();
            (StatusCode::CREATED, Json(ApiResponse::ok(proposal)))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

#[derive(Deserialize)]
pub struct ProposalReviewRequest {
    pub reviewer_notes: Option<String>,
}

async fn approve_proposal(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<ProposalReviewRequest>,
) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    match db.update_proposal_status(&id, "approved", req.reviewer_notes.as_deref()) {
        Ok(proposal) => (StatusCode::OK, Json(ApiResponse::ok(proposal))),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

async fn reject_proposal(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<ProposalReviewRequest>,
) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    match db.update_proposal_status(&id, "rejected", req.reviewer_notes.as_deref()) {
        Ok(proposal) => (StatusCode::OK, Json(ApiResponse::ok(proposal))),
        Err(e) => (
            StatusCode::BAD_REQUEST,
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

async fn list_fund_disbursements(State(state): State<AppState>) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    match db.list_disbursements(None) {
        Ok(disbursements) => (StatusCode::OK, Json(ApiResponse::ok(disbursements))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

// ── Hiran AI handlers ────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct AiEvaluateMissionRequest {
    pub mission_name: String,
    pub description: String,
    pub budget_zion: u64,
}

#[derive(Serialize)]
pub struct AiTextResponse {
    pub result: String,
}

async fn ai_evaluate_mission(
    State(state): State<AppState>,
    Json(req): Json<AiEvaluateMissionRequest>,
) -> impl IntoResponse {
    match state
        .hiran
        .evaluate_mission_plan(&req.mission_name, &req.description, req.budget_zion)
        .await
    {
        Ok(result) => (
            StatusCode::OK,
            Json(ApiResponse::ok(AiTextResponse { result })),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

#[derive(Deserialize)]
pub struct AiAnalyzeProposalRequest {
    pub title: String,
    pub abstract_text: String,
}

async fn ai_analyze_proposal(
    State(state): State<AppState>,
    Json(req): Json<AiAnalyzeProposalRequest>,
) -> impl IntoResponse {
    match state
        .hiran
        .summarize_research(&req.title, &req.abstract_text)
        .await
    {
        Ok(result) => (
            StatusCode::OK,
            Json(ApiResponse::ok(AiTextResponse { result })),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

#[derive(Deserialize)]
pub struct AiOptimizeNetworkRequest {
    pub nodes: Vec<String>,
    pub constraints: String,
}

async fn ai_optimize_network(
    State(state): State<AppState>,
    Json(req): Json<AiOptimizeNetworkRequest>,
) -> impl IntoResponse {
    match state
        .hiran
        .optimize_network_topology(&req.nodes, &req.constraints)
        .await
    {
        Ok(result) => (
            StatusCode::OK,
            Json(ApiResponse::ok(AiTextResponse { result })),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

#[derive(Deserialize)]
pub struct AiMissionLogRequest {
    pub mission_name: String,
    pub event: String,
    pub timestamp: String,
}

async fn ai_mission_log(
    State(state): State<AppState>,
    Json(req): Json<AiMissionLogRequest>,
) -> impl IntoResponse {
    match state
        .hiran
        .generate_mission_log(&req.mission_name, &req.event, &req.timestamp)
        .await
    {
        Ok(result) => (
            StatusCode::OK,
            Json(ApiResponse::ok(AiTextResponse { result })),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

async fn ai_hiran_health(State(state): State<AppState>) -> impl IntoResponse {
    let alive = state.hiran.health().await;
    let enabled = state.hiran.is_enabled();
    (
        StatusCode::OK,
        Json(ApiResponse::ok(serde_json::json!({
            "enabled": enabled,
            "reachable": alive,
        }))),
    )
}
