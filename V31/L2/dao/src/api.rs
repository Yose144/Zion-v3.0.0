//! DAO HTTP API — Axum REST server.
//!
//! Exposes DAO governance functions over HTTP.
//!
//! ## Endpoints
//!
//! | Method | Path                         | Description                     |
//! |--------|------------------------------|---------------------------------|
//! | GET    | /api/dao/health              | Service health check            |
//! | GET    | /api/dao/proposals           | List all proposals              |
//! | GET    | /api/dao/proposals/:id       | Get single proposal             |
//! | POST   | /api/dao/proposals           | Create new proposal (auth)      |
//! | GET    | /api/dao/proposals/:id/votes | Get vote breakdown              |
//! | POST   | /api/dao/proposals/:id/vote  | Cast vote (auth)                |
//! | POST   | /api/dao/proposals/:id/tally | Tally votes (auth)              |
//! | POST   | /api/dao/proposals/:id/execute | Execute proposal (auth)       |
//! | POST   | /api/dao/proposals/:id/cancel  | Cancel proposal (auth)        |
//! | GET    | /api/dao/stats               | Global DAO statistics           |
//! | GET    | /metrics                     | Prometheus text metrics         |
//!
//! ## Auth
//!
//! Write operations require `X-DAO-Key` header matching `ZION_DAO_API_KEY`.

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex as TokioMutex;
use tracing::info;

use crate::config::DaoConfig;
use crate::metrics::DaoMetrics;
use crate::proposal::{Proposal, ProposalStatus, ProposalType};
use crate::runtime::GovernanceRuntime;
use crate::types::VoteChoice;

// ─────────────────────────────────────────────────────────────────────────────
// App State
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AppState {
    pub runtime: Arc<TokioMutex<GovernanceRuntime>>,
    pub api_key: String,
    pub metrics: Arc<DaoMetrics>,
}

// ─────────────────────────────────────────────────────────────────────────────
// API Request/Response types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct ApiErr {
    success: bool,
    error: String,
}

fn ok<T: Serialize>(data: T) -> Json<serde_json::Value> {
    Json(serde_json::json!({ "success": true, "data": data }))
}

fn err(msg: &str) -> (StatusCode, Json<ApiErr>) {
    (
        StatusCode::BAD_REQUEST,
        Json(ApiErr {
            success: false,
            error: msg.to_string(),
        }),
    )
}

#[derive(Deserialize)]
pub struct CreateProposalRequest {
    pub title: String,
    pub description: String,
    pub proposal_type: ProposalTypeDto,
    pub proposer: String,
    pub proposer_balance: u64,
    pub snapshot_block: u64,
}

/// DTO for ProposalType — same structure but with string-based enum
/// for easier JSON serialization.
#[derive(Deserialize)]
#[serde(tag = "kind", content = "data")]
pub enum ProposalTypeDto {
    Parameter {
        parameter_name: String,
        current_value: String,
        proposed_value: String,
    },
    Treasury {
        recipient: String,
        amount: u64,
        purpose: String,
    },
    Emergency {
        action: String,
        justification: String,
    },
    Grant {
        recipient: String,
        amount: u64,
        milestones: Vec<String>,
        duration_days: u32,
    },
    Humanitarian {
        category: String,
        amount: u64,
        region: String,
        description: String,
    },
    Admission {
        candidate_id: String,
        gate_scores_hash: String,
        sponsoring_guardians: Vec<String>,
        community: String,
    },
    Bodhisattva {
        candidate_id: String,
        ceremony_date: String,
        ceremony_location: String,
        vow_text_hash: String,
        physical_symbol: String,
    },
    Expulsion {
        accused_id: String,
        offense_category: String,
        investigation_hash: String,
        defense_hash: Option<String>,
        tier: u8,
    },
    CrossLayer {
        target_layers: Vec<u8>,
        inner_proposal_id: u64,
        description: String,
    },
    ParliamentaryElection {
        title: String,
        parties: Vec<String>,
        seats: u32,
    },
}

impl From<ProposalTypeDto> for ProposalType {
    fn from(dto: ProposalTypeDto) -> Self {
        match dto {
            ProposalTypeDto::Parameter {
                parameter_name,
                current_value,
                proposed_value,
            } => ProposalType::Parameter {
                parameter_name,
                current_value,
                proposed_value,
            },
            ProposalTypeDto::Treasury {
                recipient,
                amount,
                purpose,
            } => ProposalType::Treasury {
                recipient,
                amount,
                purpose,
            },
            ProposalTypeDto::Emergency { action, justification } => {
                ProposalType::Emergency { action, justification }
            }
            ProposalTypeDto::Grant {
                recipient,
                amount,
                milestones,
                duration_days,
            } => ProposalType::Grant {
                recipient,
                amount,
                milestones,
                duration_days,
            },
            ProposalTypeDto::Humanitarian {
                category,
                amount,
                region,
                description,
            } => ProposalType::Humanitarian {
                category,
                amount,
                region,
                description,
            },
            ProposalTypeDto::Admission {
                candidate_id,
                gate_scores_hash,
                sponsoring_guardians,
                community,
            } => ProposalType::Admission {
                candidate_id,
                gate_scores_hash,
                sponsoring_guardians,
                community,
            },
            ProposalTypeDto::Bodhisattva {
                candidate_id,
                ceremony_date,
                ceremony_location,
                vow_text_hash,
                physical_symbol,
            } => ProposalType::Bodhisattva {
                candidate_id,
                ceremony_date,
                ceremony_location,
                vow_text_hash,
                physical_symbol,
            },
            ProposalTypeDto::Expulsion {
                accused_id,
                offense_category,
                investigation_hash,
                defense_hash,
                tier,
            } => ProposalType::Expulsion {
                accused_id,
                offense_category,
                investigation_hash,
                defense_hash,
                tier,
            },
            ProposalTypeDto::CrossLayer {
                target_layers,
                inner_proposal_id,
                description,
            } => ProposalType::CrossLayer {
                target_layers,
                inner_proposal_id,
                description,
            },
            ProposalTypeDto::ParliamentaryElection {
                title,
                parties,
                seats,
            } => ProposalType::ParliamentaryElection {
                title,
                parties,
                seats,
            },
        }
    }
}

#[derive(Deserialize)]
pub struct CastVoteRequest {
    pub voter: String,
    pub choice: VoteChoice,
    pub weight: u64,
    pub tx_hash: Option<String>,
}

#[derive(Deserialize)]
pub struct CancelRequest {
    pub caller: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────────────────────────────────────

async fn health() -> Json<serde_json::Value> {
    ok(serde_json::json!({
        "status": "ok",
        "service": "zion-dao",
        "version": "3.1.0-alpha.2"
    }))
}

async fn list_proposals(State(state): State<AppState>) -> Json<serde_json::Value> {
    let rt = state.runtime.lock().await;
    let proposals: Vec<serde_json::Value> = rt
        .all_proposals()
        .iter()
        .map(|p| serialize_proposal(p))
        .collect();

    ok(serde_json::json!({
        "count": proposals.len(),
        "proposals": proposals
    }))
}

async fn get_proposal(
    State(state): State<AppState>,
    Path(id): Path<u64>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    let rt = state.runtime.lock().await;
    match rt.get_proposal(id) {
        Some(p) => Ok(ok(serialize_proposal(p))),
        None => Err(err(&format!("proposal {} not found", id))),
    }
}

async fn create_proposal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateProposalRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    check_auth(&state, &headers)?;

    let proposal_type: ProposalType = req.proposal_type.into();
    let mut rt = state.runtime.lock().await;
    match rt.create_proposal(
        req.title,
        req.description,
        proposal_type,
        req.proposer,
        req.proposer_balance,
        req.snapshot_block,
    ) {
        Ok(id) => Ok(ok(serde_json::json!({"proposal_id": id}))),
        Err(e) => Err(err(&e.to_string())),
    }
}

async fn get_votes(
    State(state): State<AppState>,
    Path(id): Path<u64>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    let rt = state.runtime.lock().await;
    if rt.get_proposal(id).is_none() {
        return Err(err(&format!("proposal {} not found", id)));
    }
    let votes: Vec<serde_json::Value> = rt
        .get_votes(id)
        .iter()
        .map(|v| {
            serde_json::json!({
                "voter": v.voter,
                "choice": format!("{:?}", v.choice),
                "weight": v.weight,
                "tx_hash": v.tx_hash,
                "voted_at": v.voted_at.to_rfc3339(),
            })
        })
        .collect();
    Ok(ok(serde_json::json!({
        "proposal_id": id,
        "vote_count": votes.len(),
        "votes": votes
    })))
}

async fn cast_vote(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<u64>,
    Json(req): Json<CastVoteRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    check_auth(&state, &headers)?;

    let mut rt = state.runtime.lock().await;
    match rt.cast_vote(id, req.voter, req.choice, req.weight, req.tx_hash) {
        Ok(vote) => Ok(ok(serde_json::json!({
            "proposal_id": vote.proposal_id,
            "voter": vote.voter,
            "weight": vote.weight,
            "voted_at": vote.voted_at.to_rfc3339(),
        }))),
        Err(e) => Err(err(&e.to_string())),
    }
}

async fn tally_proposal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<u64>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    check_auth(&state, &headers)?;

    let mut rt = state.runtime.lock().await;
    match rt.tally_proposal(id) {
        Ok(status) => Ok(ok(serde_json::json!({
            "proposal_id": id,
            "status": format!("{:?}", status),
        }))),
        Err(e) => Err(err(&e.to_string())),
    }
}

async fn execute_proposal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<u64>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    check_auth(&state, &headers)?;

    let mut rt = state.runtime.lock().await;
    match rt.execute_proposal(id) {
        Ok(summary) => Ok(ok(serde_json::json!({
            "proposal_id": id,
            "executed": true,
            "summary": summary,
        }))),
        Err(e) => Err(err(&e.to_string())),
    }
}

async fn cancel_proposal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<u64>,
    Json(req): Json<CancelRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    check_auth(&state, &headers)?;

    let mut rt = state.runtime.lock().await;
    match rt.cancel_proposal(id, &req.caller) {
        Ok(()) => Ok(ok(serde_json::json!({
            "proposal_id": id,
            "cancelled": true,
        }))),
        Err(e) => Err(err(&e.to_string())),
    }
}

async fn stats(State(state): State<AppState>) -> Json<serde_json::Value> {
    let rt = state.runtime.lock().await;
    let all = rt.all_proposals();
    let active = rt.active_proposals();
    let passed = all.iter().filter(|p| p.status == ProposalStatus::Passed).count();
    let executed = all.iter().filter(|p| p.status == ProposalStatus::Executed).count();
    let failed = all.iter().filter(|p| p.status == ProposalStatus::Failed).count();

    ok(serde_json::json!({
        "total_proposals": all.len(),
        "active_proposals": active.len(),
        "passed": passed,
        "executed": executed,
        "failed": failed,
        "circulating_supply": rt.circulating_supply(),
    }))
}

use axum::response::Response;

async fn prometheus(State(state): State<AppState>) -> Response<String> {
    let body = state.metrics.render_prometheus();
    Response::builder()
        .header("Content-Type", "text/plain; charset=utf-8")
        .body(body)
        .unwrap()
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn check_auth(state: &AppState, headers: &HeaderMap) -> Result<(), (StatusCode, Json<ApiErr>)> {
    if state.api_key.is_empty() {
        return Ok(()); // No key configured = open access
    }
    let provided = headers
        .get("x-dao-key")
        .or_else(|| headers.get("X-DAO-Key"))
        .and_then(|v| v.to_str().ok());
    match provided {
        Some(key) if key == state.api_key => Ok(()),
        _ => Err((
            StatusCode::UNAUTHORIZED,
            Json(ApiErr {
                success: false,
                error: "unauthorized: invalid or missing X-DAO-Key header".into(),
            }),
        )),
    }
}

fn serialize_proposal(p: &Proposal) -> serde_json::Value {
    serde_json::json!({
        "id": p.id,
        "uuid": p.uuid,
        "title": p.title,
        "description": p.description,
        "proposal_type": p.proposal_type.type_name(),
        "status": format!("{:?}", p.status),
        "proposer": p.proposer,
        "proposer_balance": p.proposer_balance,
        "snapshot_block": p.snapshot_block,
        "votes_for": p.votes_for,
        "votes_against": p.votes_against,
        "votes_abstain": p.votes_abstain,
        "voter_count": p.voter_count,
        "total_votes": p.total_votes(),
        "created_at": p.created_at.to_rfc3339(),
        "voting_ends_at": p.voting_ends_at.to_rfc3339(),
        "timelock_ends_at": p.timelock_ends_at.map(|t| t.to_rfc3339()),
        "executed_at": p.executed_at.map(|t| t.to_rfc3339()),
        "has_passed": p.has_passed(),
        "is_voting_open": p.is_voting_open(),
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────────────────────────

/// Start the DAO HTTP API server.
pub async fn serve(
    config: DaoConfig,
    runtime: Arc<TokioMutex<GovernanceRuntime>>,
    metrics: Arc<DaoMetrics>,
) -> anyhow::Result<()> {
    let api_key = config.api_key.clone();
    let port = config.api_port;

    let state = AppState {
        runtime,
        api_key,
        metrics,
    };

    let app = Router::new()
        .route("/api/dao/health", get(health))
        .route("/api/dao/proposals", get(list_proposals).post(create_proposal))
        .route("/api/dao/proposals/:id", get(get_proposal))
        .route("/api/dao/proposals/:id/votes", get(get_votes))
        .route("/api/dao/proposals/:id/vote", post(cast_vote))
        .route("/api/dao/proposals/:id/tally", post(tally_proposal))
        .route("/api/dao/proposals/:id/execute", post(execute_proposal))
        .route("/api/dao/proposals/:id/cancel", post(cancel_proposal))
        .route("/api/dao/stats", get(stats))
        .route("/metrics", get(prometheus))
        .with_state(state);

    let addr = format!("0.0.0.0:{port}");
    info!("DAO API listening on {addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proposal_type_dto_conversion() {
        let dto = ProposalTypeDto::Parameter {
            parameter_name: "fee".into(),
            current_value: "0.1".into(),
            proposed_value: "0.05".into(),
        };
        let pt: ProposalType = dto.into();
        assert_eq!(pt.type_name(), "parameter");
    }

    #[test]
    fn test_serialize_proposal() {
        let p = Proposal::new(
            1,
            "Test".into(),
            "Desc".into(),
            ProposalType::Parameter {
                parameter_name: "fee".into(),
                current_value: "1".into(),
                proposed_value: "2".into(),
            },
            "zion1p".into(),
            1000,
            100,
        );
        let json = serialize_proposal(&p);
        assert_eq!(json["id"], 1);
        assert_eq!(json["title"], "Test");
        assert_eq!(json["status"], "Active");
    }
}
