//! REST API handlers for zion-issobella.

use crate::dao_client::{DaoClient, DaoClientConfig, DaoProposalRequest};
use crate::db::{IssobellaDb, MissionRecord, ResearchProposal};
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
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<IssobellaDb>>,
    pub api_key: String,
    pub metrics: Arc<IssobellaMetrics>,
    pub hiran: Arc<IssobellaHiranBridge>,
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
        .route(
            "/api/v1/proposals",
            get(list_proposals).post(create_proposal),
        )
        .route("/api/v1/fund/balance", get(fund_balance))
        // ── Hiran AI endpoints ──────────────────────────────────────────────
        .route("/api/v1/ai/evaluate-mission", post(ai_evaluate_mission))
        .route("/api/v1/ai/analyze-proposal", post(ai_analyze_proposal))
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
}

async fn create_mission(
    State(state): State<AppState>,
    Json(req): Json<CreateMissionRequest>,
) -> impl IntoResponse {
    let mut mission = MissionRecord::new(&req.name, &req.mission_type, req.budget_zion);
    mission.description = req.description;
    mission.orbit_altitude_km = req.orbit_altitude_km;
    mission.target_launch_date = req.target_launch_date;

    let db = state.db.lock().unwrap();
    match db.insert_mission(&mission) {
        Ok(_) => {
            state
                .metrics
                .missions_planning
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
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
    let db = state.db.lock().unwrap();
    match db.update_mission_status(&id, "launched") {
        Ok(_) => {
            state
                .metrics
                .missions_planning
                .fetch_sub(1, std::sync::atomic::Ordering::Relaxed);
            state
                .metrics
                .missions_launched
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            (StatusCode::OK, Json(ApiResponse::ok("launched")))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&e.to_string())),
        ),
    }
}

async fn submit_mission_to_dao(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> (StatusCode, Json<ApiResponse>) {
    let mission = {
        let db = state.db.lock().unwrap();
        match db.list_missions(None) {
            Ok(missions) => missions.into_iter().find(|m| m.id == id),
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ApiResponse::err(&e.to_string())),
                )
            }
        }
    };
    match mission {
        Some(mission) => {
            let client = DaoClient::new(DaoClientConfig::default());
            let req = DaoProposalRequest {
                title: format!("Mission: {}", mission.name),
                description: mission.description.clone().unwrap_or_default(),
                amount_zion: mission.budget_zion,
                recipient_address: String::new(),
                proposal_type: "treasury".to_string(),
            };
            match client.submit_mission_proposal(&req).await {
                Ok(resp) => (StatusCode::OK, Json(ApiResponse::ok(resp))),
                Err(e) => (
                    StatusCode::BAD_GATEWAY,
                    Json(ApiResponse::err(&e.to_string())),
                ),
            }
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(ApiResponse::err("Mission not found")),
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
            state
                .metrics
                .proposals_submitted
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            (StatusCode::CREATED, Json(ApiResponse::ok(proposal)))
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
