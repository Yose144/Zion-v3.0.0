//! DAO HTTP API — Axum REST server
//!
//! Exposes DAO governance functions over HTTP so that the desktop agent,
//! mobile app, and external clients can interact with the DAO without
//! needing direct database access.
//!
//! ## Endpoints
//!
//! | Method | Path                       | Description                     |
//! |--------|----------------------------|---------------------------------|
//! | GET    | /api/dao/health            | Service health check            |
//! | GET    | /api/dao/proposals         | List all proposals (paginated)  |
//! | GET    | /api/dao/proposals/:id     | Get single proposal             |
//! | POST   | /api/dao/proposals         | Create new proposal             |
//! | GET    | /api/dao/proposals/:id/votes | Get vote breakdown            |
//! | POST   | /api/dao/proposals/:id/vote | Cast vote (API key auth)       |
//! | GET    | /api/dao/treasury          | Treasury overview               |
//! | GET    | /api/dao/stats             | Global DAO statistics           |
//!
//! ## Auth
//!
//! Write operations (create proposal, vote) require `X-DAO-Key` header.
//! Value must match `ZION_DAO_API_KEY` env var. Read operations are public.

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use tracing::info;

use crate::config::DaoConfig;
use crate::db::DaoDb;
use crate::metrics::DaoMetrics;
use crate::proposal::{Proposal, ProposalType};
use crate::types::{VoteChoice, PROPOSAL_THRESHOLD};

// ─────────────────────────────────────────────────────────────────────────────
// App State
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<DaoDb>>,
    pub config: Arc<DaoConfig>,
    pub api_key: String,
    pub metrics: Arc<DaoMetrics>,
}

// ─────────────────────────────────────────────────────────────────────────────
// API Response wrappers
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct ApiOk<T: Serialize> {
    success: bool,
    data: T,
}

#[derive(Serialize)]
struct ApiErr {
    success: bool,
    error: String,
}

fn ok<T: Serialize>(data: T) -> Json<serde_json::Value> {
    Json(serde_json::json!({ "success": true, "data": data }))
}

fn err(msg: impl Into<String>, code: StatusCode) -> (StatusCode, Json<serde_json::Value>) {
    (
        code,
        Json(serde_json::json!({ "success": false, "error": msg.into() })),
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper
// ─────────────────────────────────────────────────────────────────────────────

fn check_api_key(headers: &HeaderMap, expected: &str) -> bool {
    headers
        .get("X-DAO-Key")
        .and_then(|v| v.to_str().ok())
        .map(|k| k == expected)
        .unwrap_or(false)
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

pub fn dao_router(state: AppState) -> Router {
    Router::new()
        .route("/api/dao/health",          get(health))
        .route("/api/dao/proposals",       get(list_proposals).post(create_proposal))
        .route("/api/dao/proposals/:id",   get(get_proposal))
        .route("/api/dao/proposals/:id/votes", get(get_votes))
        .route("/api/dao/proposals/:id/vote",  post(cast_vote))
        .route("/api/dao/treasury",        get(treasury_overview))
        .route("/api/dao/stats",           get(dao_stats))
        .route("/metrics",                 get(prometheus_metrics))
        .with_state(state)
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

/// GET /metrics — Prometheus text exposition format (compatible with Grafana/Prometheus)
async fn prometheus_metrics(State(state): State<AppState>) -> impl axum::response::IntoResponse {
    let body = state.metrics.render_prometheus();
    (
        [(axum::http::header::CONTENT_TYPE, "text/plain; version=0.0.4")],
        body,
    )
}

/// GET /api/dao/health
async fn health() -> Json<serde_json::Value> {
    ok(serde_json::json!({
        "service": "zion-dao",
        "version": "2.9.6",
        "status": "ok",
        "timestamp": Utc::now().to_rfc3339(),
    }))
}

/// GET /api/dao/stats
async fn dao_stats(State(state): State<AppState>) -> Json<serde_json::Value> {
    let db = state.db.lock().await;
    let proposals = db.load_all_proposals().unwrap_or_default();

    let total = proposals.len();
    let active = proposals.iter().filter(|p| p.status == "Active").count();
    let passed = proposals.iter().filter(|p| p.status == "Passed").count();
    let executed = proposals.iter().filter(|p| p.status == "Executed").count();

    ok(serde_json::json!({
        "total_proposals": total,
        "active": active,
        "passed": passed,
        "executed": executed,
        "treasury_total_zion": 4_000_000_000u64,
        "voting_period_days": 7u64,
        "quorum_percent": 10,
        "multisig": "5-of-7",
    }))
}

// ── Proposals ─────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct Pagination {
    limit: Option<i64>,
    offset: Option<i64>,
    status: Option<String>,
}

/// GET /api/dao/proposals
async fn list_proposals(
    State(state): State<AppState>,
    Query(params): Query<Pagination>,
) -> Json<serde_json::Value> {
    let db = state.db.lock().await;
    let mut rows = db.load_all_proposals().unwrap_or_default();

    // Filter by status
    if let Some(ref status) = params.status {
        rows.retain(|r| r.status.to_lowercase() == status.to_lowercase());
    }

    // Paginate
    let total = rows.len();
    let offset = params.offset.unwrap_or(0) as usize;
    let limit = params.limit.unwrap_or(20) as usize;
    let page: Vec<_> = rows.into_iter().skip(offset).take(limit).collect();

    ok(serde_json::json!({
        "proposals": page,
        "total": total,
        "offset": offset,
        "limit": limit,
    }))
}

/// GET /api/dao/proposals/:id
async fn get_proposal(
    Path(id): Path<u64>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let db = state.db.lock().await;
    match db.get_proposal(id) {
        Ok(Some(row)) => Ok(ok(row)),
        Ok(None) => Err(err(format!("Proposal {} not found", id), StatusCode::NOT_FOUND)),
        Err(e) => Err(err(e.to_string(), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

// ── Create Proposal ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateProposalRequest {
    title: String,
    description: String,
    proposer: String,
    /// JSON-serialized ProposalType variant
    proposal_type: serde_json::Value,
}

/// POST /api/dao/proposals
async fn create_proposal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateProposalRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !check_api_key(&headers, &state.api_key) {
        return Err(err("Unauthorized — X-DAO-Key required", StatusCode::UNAUTHORIZED));
    }

    // Validate inputs
    if req.title.is_empty() || req.description.is_empty() || req.proposer.is_empty() {
        return Err(err("title, description, proposer are required", StatusCode::BAD_REQUEST));
    }
    if !req.proposer.starts_with("zion1") {
        return Err(err("proposer must be a valid ZION L1 address (zion1...)", StatusCode::BAD_REQUEST));
    }

    // Parse ProposalType from JSON
    let proposal_type: ProposalType = serde_json::from_value(req.proposal_type.clone())
        .map_err(|e| err(format!("Invalid proposal_type: {}", e), StatusCode::BAD_REQUEST))?;

    // Assign sequential ID (simple: max(id)+1)
    let next_id = {
        let db = state.db.lock().await;
        let rows = db.load_all_proposals().unwrap_or_default();
        rows.iter().map(|r| r.id).max().unwrap_or(0) + 1
    };

    let proposal = Proposal::new(
        next_id,
        req.title.clone(),
        req.description.clone(),
        proposal_type,
        req.proposer.clone(),
        PROPOSAL_THRESHOLD, // assume threshold balance for API-created proposals
        0,                  // snapshot_block (0 = created via API, not L1 scan)
    );

    {
        let db = state.db.lock().await;
        db.insert_proposal(&proposal)
            .map_err(|e| err(e.to_string(), StatusCode::INTERNAL_SERVER_ERROR))?;
    }

    info!("[DAO-API] Proposal #{} created by {}", next_id, req.proposer);

    Ok(ok(serde_json::json!({
        "id": next_id,
        "status": "Active",
        "voting_ends_at": proposal.voting_ends_at.to_rfc3339(),
    })))
}

// ── Votes ─────────────────────────────────────────────────────────────────────

/// GET /api/dao/proposals/:id/votes
async fn get_votes(
    Path(id): Path<u64>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let db = state.db.lock().await;

    // Verify proposal exists
    match db.get_proposal(id) {
        Ok(None) => return Err(err(format!("Proposal {} not found", id), StatusCode::NOT_FOUND)),
        Err(e) => return Err(err(e.to_string(), StatusCode::INTERNAL_SERVER_ERROR)),
        _ => {}
    }

    let (yes, no, abstain) = db
        .vote_totals(id)
        .map_err(|e| err(e.to_string(), StatusCode::INTERNAL_SERVER_ERROR))?;

    let total = yes + no + abstain;
    let yes_pct = if total > 0 { yes as f64 / total as f64 * 100.0 } else { 0.0 };

    Ok(ok(serde_json::json!({
        "proposal_id": id,
        "yes":  { "weight": yes,     "pct": format!("{:.1}", yes_pct) },
        "no":   { "weight": no,      "pct": format!("{:.1}", if total > 0 { no     as f64 / total as f64 * 100.0 } else { 0.0 }) },
        "abstain": { "weight": abstain, "pct": format!("{:.1}", if total > 0 { abstain as f64 / total as f64 * 100.0 } else { 0.0 }) },
        "total_weight": total,
    })))
}

/// POST /api/dao/proposals/:id/vote
#[derive(Deserialize)]
struct CastVoteRequest {
    voter: String,
    choice: String,   // "yes" | "no" | "abstain"
    weight: u64,      // ZION balance in atomic units (verified by scanner; API trusts it for now)
    l1_tx_hash: Option<String>,
}

async fn cast_vote(
    Path(id): Path<u64>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CastVoteRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !check_api_key(&headers, &state.api_key) {
        return Err(err("Unauthorized", StatusCode::UNAUTHORIZED));
    }

    let choice = match req.choice.as_str() {
        "yes" => VoteChoice::Yes,
        "no" => VoteChoice::No,
        "abstain" => VoteChoice::Abstain,
        other => return Err(err(format!("Invalid choice '{}' — use yes/no/abstain", other), StatusCode::BAD_REQUEST)),
    };

    if !req.voter.starts_with("zion1") {
        return Err(err("voter must be a valid ZION L1 address", StatusCode::BAD_REQUEST));
    }

    let db = state.db.lock().await;

    // Check proposal is active
    match db.get_proposal(id) {
        Ok(None) => return Err(err(format!("Proposal {} not found", id), StatusCode::NOT_FOUND)),
        Ok(Some(ref p)) if p.status != "Active" => {
            return Err(err(
                format!("Proposal {} is {}, not Active", id, p.status),
                StatusCode::CONFLICT,
            ));
        }
        Err(e) => return Err(err(e.to_string(), StatusCode::INTERNAL_SERVER_ERROR)),
        _ => {}
    }

    let recorded = db
        .record_vote(id, &req.voter, choice, req.weight, req.l1_tx_hash.as_deref())
        .map_err(|e| err(e.to_string(), StatusCode::INTERNAL_SERVER_ERROR))?;

    if !recorded {
        return Err(err(
            format!("{} already voted on proposal {}", req.voter, id),
            StatusCode::CONFLICT,
        ));
    }

    info!("[DAO-API] Vote recorded: proposal={} voter={}", id, req.voter);

    Ok(ok(serde_json::json!({
        "proposal_id": id,
        "voter": req.voter,
        "choice": req.choice,
        "weight": req.weight,
    })))
}

// ── Treasury ──────────────────────────────────────────────────────────────────

/// GET /api/dao/treasury
async fn treasury_overview() -> Json<serde_json::Value> {
    ok(serde_json::json!({
        "total_zion": 4_000_000_000u64,
        "addresses": [
            "zion1dao0treasury0main000000000000000000001",
            "zion1dao0treasury0main000000000000000000002",
            "zion1dao0treasury0main000000000000000000003",
        ],
        "multisig": "5-of-7",
        "daily_spend_limit_zion": 100_000_000u64,
        "note": "Balance queries require L1 RPC integration (see D-01)",
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_key_check() {
        let mut headers = HeaderMap::new();
        headers.insert("X-DAO-Key", "secret123".parse().unwrap());
        assert!(check_api_key(&headers, "secret123"));
        assert!(!check_api_key(&headers, "wrong"));
    }

    #[test]
    fn test_api_key_missing() {
        let headers = HeaderMap::new();
        assert!(!check_api_key(&headers, "any"));
    }
}
