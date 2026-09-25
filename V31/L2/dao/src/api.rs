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
//! | GET    | /api/dao/treasury            | Treasury overview (public)      |
//! | GET    | /api/dao/treasury/ops        | List multisig ops (public)      |
//! | POST   | /api/dao/treasury/submit     | Submit treasury op (auth)       |
//! | POST   | /api/dao/treasury/:op_id/sign    | Guardian signature (auth)   |
//! | POST   | /api/dao/treasury/:op_id/execute | Execute signed op (auth)    |
//! | GET    | /metrics                     | Prometheus text metrics         |
//!
//! ## Auth
//!
//! Write operations require `X-DAO-Key` header matching `ZION_DAO_API_KEY`.

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::Mutex as TokioMutex;
use tracing::info;
use zion_l1_types::normalize_rpc_addr;

use crate::config::DaoConfig;
use crate::error::DaoError;
use crate::metrics::DaoMetrics;
use crate::proposal::{Proposal, ProposalStatus, ProposalType};
use crate::runtime::GovernanceRuntime;
use crate::treasury::TreasuryOperation;
use crate::types::{VoteChoice, DAO_TREASURY_TOTAL, DAO_TREASURY_UNLOCK_HEIGHT, FLOWERS_PER_ZION};
use crate::zis::{self, ZisClient, ZisUser};

// ─────────────────────────────────────────────────────────────────────────────
// App State
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AppState {
    pub runtime: Arc<TokioMutex<GovernanceRuntime>>,
    pub api_key: String,
    pub metrics: Arc<DaoMetrics>,
    pub zis: ZisClient,
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
    /// Operator path only — for ZIS callers the real balance is resolved
    /// from L1 at the snapshot block.
    #[serde(default)]
    pub proposer_balance: u64,
    /// `0` = resolve to the current L1 chain height (always resolved for ZIS).
    #[serde(default)]
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
            ProposalTypeDto::Emergency {
                action,
                justification,
            } => ProposalType::Emergency {
                action,
                justification,
            },
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

#[derive(Deserialize)]
pub struct TreasurySubmitRequest {
    pub op_id: String,
    pub guardian: String,
    pub operation: serde_json::Value,
    pub proposal_id: Option<u64>,
}

#[derive(Deserialize)]
pub struct TreasuryGuardianRequest {
    pub guardian: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────────────────────────────────────

async fn health() -> Json<serde_json::Value> {
    ok(serde_json::json!({
        "status": "ok",
        "service": "zion-dao",
        "version": "3.1.0-alpha"
    }))
}

#[derive(Deserialize)]
pub struct ProposalsQuery {
    /// Case-insensitive status filter, e.g. `Active`, `Passed`, `Failed`.
    pub status: Option<String>,
    /// Case-insensitive proposal-type filter, e.g. `parameter`, `treasury`.
    pub proposal_type: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

async fn list_proposals(
    State(state): State<AppState>,
    Query(q): Query<ProposalsQuery>,
) -> Json<serde_json::Value> {
    let rt = state.runtime.lock().await;
    let status_filter = q.status.as_deref().map(|s| s.to_lowercase());
    let type_filter = q.proposal_type.as_deref().map(|s| s.to_lowercase());

    let mut rows: Vec<&Proposal> = rt
        .all_proposals()
        .into_iter()
        .filter(|p| {
            status_filter
                .as_ref()
                .map(|s| format!("{:?}", p.status).to_lowercase() == *s)
                .unwrap_or(true)
                && type_filter
                    .as_ref()
                    .map(|t| p.proposal_type.type_name() == t.as_str())
                    .unwrap_or(true)
        })
        .collect();

    // Newest first.
    rows.sort_by(|a, b| b.id.cmp(&a.id));
    let total = rows.len();

    let offset = q.offset.unwrap_or(0);
    let limit = q.limit.unwrap_or(50).min(200);
    let proposals: Vec<serde_json::Value> = rows
        .into_iter()
        .skip(offset)
        .take(limit)
        .map(serialize_proposal)
        .collect();

    ok(serde_json::json!({
        "count": proposals.len(),
        "total": total,
        "offset": offset,
        "limit": limit,
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
    let caller = resolve_caller(&state, &headers)
        .await
        .ok_or_else(unauthorized)?;

    let proposal_type: ProposalType = req.proposal_type.into();

    let (proposer, proposer_balance, snapshot_block) = match caller {
        CallerAuth::Operator => (req.proposer, req.proposer_balance, req.snapshot_block),
        CallerAuth::Zis(user) => {
            // Identity and balance come from ZIS + L1, never from the client.
            let proposer = user.zion_address().to_string();
            let rpc_url = {
                let rt = state.runtime.lock().await;
                rt.config().l1_rpc_url.clone()
            };
            let snapshot_block = match req.snapshot_block {
                0 => l1_chain_height(&rpc_url).await.map_err(db_err)?,
                h => h,
            };
            let balance = l1_balance_at_height(&rpc_url, &proposer, snapshot_block)
                .await
                .map_err(db_err)?;
            (proposer, balance, snapshot_block)
        }
    };

    let mut rt = state.runtime.lock().await;
    match rt.create_proposal(
        req.title,
        req.description,
        proposal_type,
        proposer,
        proposer_balance,
        snapshot_block,
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
    let caller = resolve_caller(&state, &headers)
        .await
        .ok_or_else(unauthorized)?;

    let (voter, weight) = match caller {
        CallerAuth::Operator => (req.voter, req.weight),
        CallerAuth::Zis(user) => {
            // Voter = the user's linked ZION L1 address; weight = its real
            // balance at the proposal snapshot block (client can't fake it).
            let voter = user.zion_address().to_string();
            let (snapshot_block, rpc_url, min_weight) = {
                let rt = state.runtime.lock().await;
                match rt.get_proposal(id) {
                    Some(p) => (
                        p.snapshot_block,
                        rt.config().l1_rpc_url.clone(),
                        rt.config().min_vote_weight,
                    ),
                    None => return Err(err(&format!("proposal {id} not found"))),
                }
            };
            let weight = l1_balance_at_height(&rpc_url, &voter, snapshot_block)
                .await
                .map_err(db_err)?;
            if weight < min_weight {
                return Err((
                    StatusCode::FORBIDDEN,
                    Json(ApiErr {
                        success: false,
                        error: format!(
                            "insufficient ZION balance for voting (min {} flowers)",
                            min_weight
                        ),
                    }),
                ));
            }
            (voter, weight)
        }
    };

    let mut rt = state.runtime.lock().await;
    match rt.cast_vote(id, voter, req.choice, weight, req.tx_hash) {
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
    let cfg = rt.config();
    let all = rt.all_proposals();
    let active = rt.active_proposals();
    let passed = all
        .iter()
        .filter(|p| p.status == ProposalStatus::Passed)
        .count();
    let executed = all
        .iter()
        .filter(|p| p.status == ProposalStatus::Executed)
        .count();
    let failed = all
        .iter()
        .filter(|p| p.status == ProposalStatus::Failed)
        .count();
    let total_votes_cast: u32 = all.iter().map(|p| p.voter_count).sum();

    ok(serde_json::json!({
        "total_proposals": all.len(),
        "active_proposals": active.len(),
        "active": active.len(),
        "awaiting_tally": rt.awaiting_tally().len(),
        "passed": passed,
        "executed": executed,
        "failed": failed,
        "circulating_supply": rt.circulating_supply(),
        "treasury_total_zion": (DAO_TREASURY_TOTAL / FLOWERS_PER_ZION as u128) as u64,
        // Configured governance parameters (previously missing — the UI had
        // to fall back to hardcoded guesses).
        "quorum_percent": cfg.quorum_percent,
        "voting_period_days": cfg.voting_period_days,
        "timelock_hours": cfg.timelock_hours,
        "min_vote_weight": cfg.min_vote_weight,
        "proposal_threshold": cfg.proposal_threshold,
        "multisig": format!("{}-of-{}", cfg.multisig_threshold, cfg.multisig_total),
        "guardian_count": cfg.guardians.len(),
        "total_votes_cast": total_votes_cast,
        "unique_voters": rt.unique_voters(),
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Treasury handlers
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct TreasuryLockStatus {
    time_locked: bool,
    admin_unlock_known: bool,
    admin_unlocked: bool,
    spendable: bool,
}

fn treasury_lock_status(
    chain_height: u64,
    addresses: &[String],
    unlocked: Option<&[String]>,
) -> TreasuryLockStatus {
    let time_locked = chain_height < DAO_TREASURY_UNLOCK_HEIGHT;
    let admin_unlock_known = unlocked.is_some();
    let admin_unlocked = !addresses.is_empty()
        && unlocked
            .map(|entries| {
                addresses
                    .iter()
                    .all(|address| entries.iter().any(|entry| entry == address))
            })
            .unwrap_or(false);
    TreasuryLockStatus {
        time_locked,
        admin_unlock_known,
        admin_unlocked,
        spendable: !time_locked && admin_unlocked,
    }
}

/// GET /api/dao/treasury — live treasury overview.
///
/// Balances are read from the L1 UTXO set (genesis premine outputs) so the
/// numbers reflect the actual chain, not a static config value.
async fn treasury_overview(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    let (rpc_url, addresses, threshold, total, daily_limit, db) = {
        let rt = state.runtime.lock().await;
        let cfg = rt.config();
        (
            cfg.l1_rpc_url.clone(),
            cfg.treasury_addresses.clone(),
            cfg.multisig_threshold,
            cfg.multisig_total,
            cfg.daily_spend_limit,
            rt.db(),
        )
    };

    // Sum confirmed UTXOs across all treasury addresses (amounts in flowers).
    let mut available: u128 = 0;
    for addr in &addresses {
        available += l1_utxo_balance(&rpc_url, addr).await.map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(ApiErr {
                    success: false,
                    error: format!("L1 RPC unreachable: {e}"),
                }),
            )
        })?;
    }

    let chain_height = l1_chain_height(&rpc_url).await.map_err(|e| {
        (
            StatusCode::BAD_GATEWAY,
            Json(ApiErr {
                success: false,
                error: format!("L1 RPC unreachable: {e}"),
            }),
        )
    })?;
    let admin_unlocks = l1_admin_unlocks(&rpc_url).await.ok();
    let lock_status = treasury_lock_status(chain_height, &addresses, admin_unlocks.as_deref());

    let pending = match db {
        Some(db) => {
            let db = db.lock().map_err(|e| err(&format!("db lock: {e}")))?;
            db.count_treasury_ops("pending").map_err(db_err)?
                + db.count_treasury_ops("signed").map_err(db_err)?
        }
        None => 0,
    };

    Ok(ok(serde_json::json!({
        "total_zion": (available / FLOWERS_PER_ZION as u128) as u64,
        "available_atomic": available.to_string(),
        "available_zion": available as f64 / FLOWERS_PER_ZION as f64,
        "utxo_balance_atomic": available.to_string(),
        "utxo_balance_zion": available as f64 / FLOWERS_PER_ZION as f64,
        "chain_height": chain_height,
        "unlock_height": DAO_TREASURY_UNLOCK_HEIGHT,
        "time_locked": lock_status.time_locked,
        "admin_unlock_known": lock_status.admin_unlock_known,
        "admin_unlocked": lock_status.admin_unlocked,
        "spendable": lock_status.spendable,
        "spendable_atomic": if lock_status.spendable { available.to_string() } else { "0".to_string() },
        "spendable_zion": if lock_status.spendable { available as f64 / FLOWERS_PER_ZION as f64 } else { 0.0 },
        "addresses": addresses,
        "multisig": format!("{threshold}-of-{total}"),
        "pending_operations": pending,
        "daily_spend_limit_zion": daily_limit,
        "note": format!(
            "Value is the observed L1 UTXO balance of the genesis treasury addresses. \
             Spendability requires both block {DAO_TREASURY_UNLOCK_HEIGHT} and the \
             on-chain admin unlock; approval records alone do not broadcast a transaction. \
             A spend also requires a passed proposal plus {threshold}-of-{total} guardian multisig."
        ),
    })))
}

/// GET /api/dao/treasury/ops — list multisig operations (public read).
///
/// Each row includes the collected guardian signatures so the UI can render
/// progress toward the configured threshold.
async fn list_treasury_ops(
    State(state): State<AppState>,
    Query(q): Query<TreasuryOpsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    let (db, threshold) = {
        let rt = state.runtime.lock().await;
        (rt.db(), rt.config().multisig_threshold)
    };
    let db = db.ok_or_else(|| err("database not configured"))?;
    let db = db.lock().map_err(|e| err(&format!("db lock: {e}")))?;

    let ops = db.list_treasury_ops(q.status.as_deref()).map_err(db_err)?;
    let mut out = Vec::with_capacity(ops.len());
    for op in &ops {
        let sigs = db.list_treasury_sigs(&op.op_id).map_err(db_err)?;
        let parsed: Option<TreasuryOperation> = serde_json::from_str(&op.operation).ok();
        let amount = parsed.as_ref().map(treasury_op_amount).unwrap_or(0);
        out.push(serde_json::json!({
            "op_id": op.op_id,
            "proposal_id": op.proposal_id,
            "operation": parsed,
            "submitted_by": op.submitted_by,
            "status": op.status,
            "created_at": op.created_at,
            "executed_at": op.executed_at,
            "signatures": sigs,
            "signature_count": sigs.len(),
            "threshold": threshold,
            "amount_atomic": amount,
            "amount_zion": amount as f64 / FLOWERS_PER_ZION as f64,
        }));
    }

    Ok(ok(serde_json::json!({
        "count": out.len(),
        "threshold": threshold,
        "operations": out,
    })))
}

#[derive(Deserialize)]
pub struct TreasuryOpsQuery {
    pub status: Option<String>,
}

/// POST /api/dao/treasury/submit — guardian submits a multisig operation.
/// The submitter's approval counts as the first signature.
async fn submit_treasury_op(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<TreasurySubmitRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    check_auth(&state, &headers)?;

    let operation: TreasuryOperation = serde_json::from_value(req.operation.clone())
        .map_err(|e| err(&format!("invalid treasury operation: {e}")))?;

    let rt = state.runtime.lock().await;
    require_guardian(rt.config(), &req.guardian)?;
    let db = rt.db().ok_or_else(|| err("database not configured"))?;
    let db = db.lock().map_err(|e| err(&format!("db lock: {e}")))?;

    if db.get_treasury_op(&req.op_id).map_err(db_err)?.is_some() {
        return Err(err(&format!("operation {} already exists", req.op_id)));
    }

    db.insert_treasury_op(&req.op_id, req.proposal_id, &operation, &req.guardian)
        .map_err(db_err)?;
    db.add_treasury_sig(&req.op_id, &req.guardian)
        .map_err(db_err)?;

    let signatures = db.list_treasury_sigs(&req.op_id).map_err(db_err)?.len() as u32;
    let threshold = rt.config().multisig_threshold;
    Ok(ok(serde_json::json!({
        "op_id": req.op_id,
        "signatures": signatures,
        "threshold": threshold,
        "ready": signatures >= threshold,
    })))
}

/// POST /api/dao/treasury/:op_id/sign — add a guardian signature.
async fn sign_treasury_op(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(op_id): Path<String>,
    Json(req): Json<TreasuryGuardianRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    check_auth(&state, &headers)?;

    let rt = state.runtime.lock().await;
    require_guardian(rt.config(), &req.guardian)?;
    let db = rt.db().ok_or_else(|| err("database not configured"))?;
    let db = db.lock().map_err(|e| err(&format!("db lock: {e}")))?;

    let op = db
        .get_treasury_op(&op_id)
        .map_err(db_err)?
        .ok_or_else(|| err(&format!("treasury operation {op_id} not found")))?;
    if op.status != "pending" && op.status != "signed" {
        return Err(err(&format!(
            "operation {op_id} is {status} — not open for signatures",
            status = op.status
        )));
    }

    db.add_treasury_sig(&op_id, &req.guardian).map_err(db_err)?;
    let signatures = db.list_treasury_sigs(&op_id).map_err(db_err)?.len() as u32;
    let threshold = rt.config().multisig_threshold;
    let ready = signatures >= threshold;
    if ready && op.status == "pending" {
        db.update_treasury_op_status(&op_id, "signed")
            .map_err(db_err)?;
    }

    Ok(ok(serde_json::json!({
        "op_id": op_id,
        "signatures": signatures,
        "threshold": threshold,
        "ready": ready,
    })))
}

/// POST /api/dao/treasury/:op_id/execute — execute a fully-signed operation.
async fn execute_treasury_op(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(op_id): Path<String>,
    Json(req): Json<TreasuryGuardianRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    check_auth(&state, &headers)?;

    let rt = state.runtime.lock().await;
    require_guardian(rt.config(), &req.guardian)?;
    let db = rt.db().ok_or_else(|| err("database not configured"))?;
    let db = db.lock().map_err(|e| err(&format!("db lock: {e}")))?;

    let op = db
        .get_treasury_op(&op_id)
        .map_err(db_err)?
        .ok_or_else(|| err(&format!("treasury operation {op_id} not found")))?;
    if op.status == "executed" {
        return Err(err(&format!("operation {op_id} already executed")));
    }
    if op.status == "rejected" {
        return Err(err(&format!("operation {op_id} was rejected")));
    }

    let signatures = db.list_treasury_sigs(&op_id).map_err(db_err)?.len() as u32;
    let threshold = rt.config().multisig_threshold;
    if signatures < threshold {
        return Err(err(&format!(
            "insufficient signatures: {signatures}/{threshold} required"
        )));
    }

    db.update_treasury_op_status(&op_id, "executed")
        .map_err(db_err)?;

    let parsed: Option<TreasuryOperation> = serde_json::from_str(&op.operation).ok();
    let amount = parsed.as_ref().map(treasury_op_amount).unwrap_or(0);

    Ok(ok(serde_json::json!({
        "op_id": op_id,
        "executed_by": req.guardian,
        "signatures": signatures,
        "threshold": threshold,
        "amount_atomic": amount,
        "amount_zion": amount as f64 / FLOWERS_PER_ZION as f64,
    })))
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

fn db_err(e: DaoError) -> (StatusCode, Json<ApiErr>) {
    err(&e.to_string())
}

fn unauthorized() -> (StatusCode, Json<ApiErr>) {
    (
        StatusCode::UNAUTHORIZED,
        Json(ApiErr {
            success: false,
            error: "unauthorized: sign in with ZIS or provide a valid X-DAO-Key".into(),
        }),
    )
}

/// How the caller authenticated: operator API key or a resolved ZIS session.
enum CallerAuth {
    Operator,
    Zis(ZisUser),
}

/// Resolve caller identity: operator `X-DAO-Key` first, then `zion_session`.
/// Returns `None` when neither is valid.
async fn resolve_caller(state: &AppState, headers: &HeaderMap) -> Option<CallerAuth> {
    if state.api_key.is_empty() {
        return Some(CallerAuth::Operator); // dev mode: no key configured
    }
    if let Some(key) = headers.get("x-dao-key").and_then(|v| v.to_str().ok()) {
        if key == state.api_key {
            return Some(CallerAuth::Operator);
        }
    }
    if let Some(cookie) = headers.get("cookie").and_then(|v| v.to_str().ok()) {
        if let Some(sess) = zis::session_cookie(cookie) {
            if let Some(user) = state.zis.resolve_session(sess).await {
                return Some(CallerAuth::Zis(user));
            }
        }
    }
    None
}

/// Whole-chain height via L1 `getChainInfo`.
async fn l1_chain_height(rpc_url: &str) -> Result<u64, DaoError> {
    #[derive(Deserialize)]
    struct Info {
        chain_height: u64,
    }
    let info: Info = l1_rpc(rpc_url, "getChainInfo", serde_json::json!({})).await?;
    Ok(info.chain_height)
}

async fn l1_admin_unlocks(rpc_url: &str) -> Result<Vec<String>, DaoError> {
    #[derive(Deserialize)]
    struct AdminUnlocks {
        unlocked: Vec<String>,
    }
    let result: AdminUnlocks = l1_rpc(rpc_url, "getAdminUnlocks", serde_json::json!({})).await?;
    Ok(result.unlocked)
}

/// Address balance at a given height, returned in flowers.
async fn l1_balance_at_height(rpc_url: &str, address: &str, height: u64) -> Result<u64, DaoError> {
    #[derive(Deserialize)]
    struct Bal {
        #[serde(default)]
        balance_zion: String,
        #[serde(default)]
        balance_flowers: u64,
    }
    let b: Bal = l1_rpc(
        rpc_url,
        "getBalanceAtHeight",
        serde_json::json!({ "address": address, "height": height }),
    )
    .await?;
    if let Ok(z) = b.balance_zion.parse::<u64>() {
        return Ok(z.saturating_mul(FLOWERS_PER_ZION));
    }
    Ok(b.balance_flowers)
}

/// Check that `address` belongs to a configured DAO guardian.
/// If no guardians are configured (dev/testnet), any authenticated caller passes.
fn require_guardian(cfg: &DaoConfig, address: &str) -> Result<(), (StatusCode, Json<ApiErr>)> {
    if cfg.guardians.is_empty() {
        return Ok(());
    }
    if cfg.guardians.iter().any(|g| g.address == address) {
        Ok(())
    } else {
        Err((
            StatusCode::FORBIDDEN,
            Json(ApiErr {
                success: false,
                error: "forbidden: not a DAO guardian address".into(),
            }),
        ))
    }
}

fn treasury_op_amount(op: &TreasuryOperation) -> u64 {
    match op {
        TreasuryOperation::Spend { amount, .. }
        | TreasuryOperation::HumanitarianGrant { amount, .. }
        | TreasuryOperation::Rebalance { amount, .. }
        | TreasuryOperation::GoldenEggPrize { amount, .. } => *amount,
    }
}

// ── L1 RPC (line-delimited JSON-RPC over TCP, same transport the scanner uses) ──

#[derive(Debug, Deserialize)]
struct L1RpcResponse<T> {
    result: Option<T>,
    error: Option<serde_json::Value>,
}

async fn l1_rpc<T: for<'de> Deserialize<'de>>(
    rpc_url: &str,
    method: &str,
    params: serde_json::Value,
) -> Result<T, DaoError> {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    })
    .to_string();

    let mut stream = TcpStream::connect(normalize_rpc_addr(rpc_url))
        .await
        .map_err(|e| DaoError::Internal(format!("RPC connect failed: {e}")))?;
    stream
        .write_all(request.as_bytes())
        .await
        .map_err(|e| DaoError::Internal(format!("RPC write failed: {e}")))?;
    stream
        .write_all(b"\n")
        .await
        .map_err(|e| DaoError::Internal(format!("RPC newline write failed: {e}")))?;

    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .await
        .map_err(|e| DaoError::Internal(format!("RPC read failed: {e}")))?;

    let resp: L1RpcResponse<T> = serde_json::from_str(line.trim())
        .map_err(|e| DaoError::Internal(format!("RPC parse error: {e}")))?;
    if let Some(e) = resp.error {
        return Err(DaoError::Internal(format!("RPC error: {e}")));
    }
    resp.result
        .ok_or_else(|| DaoError::Internal("RPC returned null result".into()))
}

/// Sum confirmed UTXOs for `address` on L1 (returns flowers, u128).
async fn l1_utxo_balance(rpc_url: &str, address: &str) -> Result<u128, DaoError> {
    #[derive(Deserialize)]
    struct Utxo {
        amount: u128,
    }
    #[derive(Deserialize)]
    struct UtxoResult {
        utxos: Vec<Utxo>,
    }
    let res: UtxoResult = l1_rpc(
        rpc_url,
        "getUtxos",
        serde_json::json!({ "address": address }),
    )
    .await?;
    Ok(res.utxos.iter().map(|u| u.amount).sum())
}

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
    let zis = ZisClient::new(config.zis_enabled, config.zis_url.clone());

    let state = AppState {
        runtime,
        api_key,
        metrics,
        zis,
    };

    let app = Router::new()
        .route("/api/dao/health", get(health))
        .route(
            "/api/dao/proposals",
            get(list_proposals).post(create_proposal),
        )
        .route("/api/dao/proposals/:id", get(get_proposal))
        .route("/api/dao/proposals/:id/votes", get(get_votes))
        .route("/api/dao/proposals/:id/vote", post(cast_vote))
        .route("/api/dao/proposals/:id/tally", post(tally_proposal))
        .route("/api/dao/proposals/:id/execute", post(execute_proposal))
        .route("/api/dao/proposals/:id/cancel", post(cancel_proposal))
        .route("/api/dao/stats", get(stats))
        .route("/api/dao/treasury", get(treasury_overview))
        .route("/api/dao/treasury/ops", get(list_treasury_ops))
        .route("/api/dao/treasury/submit", post(submit_treasury_op))
        .route("/api/dao/treasury/:op_id/sign", post(sign_treasury_op))
        .route(
            "/api/dao/treasury/:op_id/execute",
            post(execute_treasury_op),
        )
        .route("/metrics", get(prometheus))
        .with_state(state);

    let addr = format!("127.0.0.1:{port}");
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

    #[test]
    fn test_treasury_lock_status_before_unlock_height() {
        let addresses = vec!["zion1a".to_string(), "zion1b".to_string()];
        let unlocked = vec!["zion1a".to_string(), "zion1b".to_string()];
        let status = treasury_lock_status(143_999, &addresses, Some(&unlocked));
        assert!(status.time_locked);
        assert!(!status.spendable);
    }

    #[test]
    fn test_treasury_lock_status_unknown_unlock_set() {
        let addresses = vec!["zion1a".to_string(), "zion1b".to_string()];
        let status = treasury_lock_status(144_000, &addresses, None);
        assert!(!status.time_locked);
        assert!(!status.admin_unlock_known);
        assert!(!status.admin_unlocked);
        assert!(!status.spendable);
    }

    #[test]
    fn test_treasury_lock_status_partial_unlock() {
        let addresses = vec!["zion1a".to_string(), "zion1b".to_string()];
        let unlocked = vec!["zion1a".to_string()];
        let status = treasury_lock_status(144_000, &addresses, Some(&unlocked));
        assert!(!status.time_locked);
        assert!(status.admin_unlock_known);
        assert!(!status.admin_unlocked);
        assert!(!status.spendable);
    }

    #[test]
    fn test_treasury_lock_status_fully_unlocked() {
        let addresses = vec!["zion1a".to_string(), "zion1b".to_string()];
        let unlocked = vec!["zion1a".to_string(), "zion1b".to_string()];
        let status = treasury_lock_status(144_000, &addresses, Some(&unlocked));
        assert!(!status.time_locked);
        assert!(status.admin_unlock_known);
        assert!(status.admin_unlocked);
        assert!(status.spendable);
    }

    #[test]
    fn test_treasury_lock_status_empty_addresses() {
        let status = treasury_lock_status(144_000, &[], Some(&[]));
        assert!(!status.time_locked);
        assert!(status.admin_unlock_known);
        assert!(!status.admin_unlocked);
        assert!(!status.spendable);
    }
}
