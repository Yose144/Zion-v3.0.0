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
use crate::treasury_tx;
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
    /// Ed25519 hex signature over `dao:treasury:v1|<op_id>|<sha256(op_json)>`.
    /// Required once guardians are configured — the submitter's approval is
    /// the first *cryptographically verified* signature.
    pub signature: Option<String>,
}

#[derive(Deserialize)]
pub struct TreasuryGuardianRequest {
    pub guardian: String,
    /// Ed25519 hex signature over the op's `signing_hash`.
    pub signature: Option<String>,
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
        .map(|p| serialize_proposal(p, rt.circulating_supply(), rt.config().quorum_percent))
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
        Some(p) => Ok(ok(serialize_proposal(
            p,
            rt.circulating_supply(),
            rt.config().quorum_percent,
        ))),
        None => Err(err(&format!("proposal {} not found", id))),
    }
}

/// GET /api/dao/proposals/:id/events — immutable audit feed for one
/// proposal (D4). Oldest first; events are append-only in `dao_events`.
async fn get_proposal_events(
    State(state): State<AppState>,
    Path(id): Path<u64>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    let db = {
        let rt = state.runtime.lock().await;
        rt.db()
    };
    let db = db.ok_or_else(|| err("database not configured"))?;
    let db = db.lock().map_err(|e| err(&format!("db lock: {e}")))?;
    let events = db
        .list_events(&format!("proposal:{id}"), 500)
        .map_err(db_err)?;
    Ok(ok(serde_json::json!({
        "proposal_id": id,
        "count": events.len(),
        "events": events.iter().map(|e| serde_json::json!({
            "id": e.id,
            "event_type": e.event_type,
            "actor": e.actor,
            "data": serde_json::from_str::<serde_json::Value>(&e.data_json)
                .unwrap_or(serde_json::json!({})),
            "created_at": e.created_at,
        })).collect::<Vec<_>>(),
    })))
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
        // D5: parameter names a Parameter proposal may change at execution.
        "governable_parameters": crate::runtime::GovernanceRuntime::governable_parameters(),
        "guardian_count": cfg.guardians.len(),
        "total_votes_cast": total_votes_cast,
        "unique_voters": rt.unique_voters(),
    }))
}

/// GET /api/dao/guardians — live guardian registry: config bootstrap set +
/// governance mutations (D3), plus L1-registered candidates awaiting
/// admission. Public read.
async fn list_guardians(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    let rt = state.runtime.lock().await;
    let cfg = rt.config();
    let guardians: Vec<serde_json::Value> = cfg
        .guardians
        .iter()
        .map(|g| {
            serde_json::json!({
                "name": g.name,
                "address": g.address,
                "public_key": g.public_key,
                "source": "active",
            })
        })
        .collect();
    let candidates: Vec<serde_json::Value> = match rt.db() {
        Some(db) => db
            .lock()
            .ok()
            .and_then(|g| g.list_guardian_candidates().ok())
            .unwrap_or_default(),
        None => vec![],
    }
    .into_iter()
    .map(|(address, pubkey)| {
        serde_json::json!({ "address": address, "public_key": pubkey, "source": "registered" })
    })
    .collect();
    Ok(ok(serde_json::json!({
        "threshold": cfg.multisig_threshold,
        "total": cfg.multisig_total,
        "guardians": guardians,
        "candidates": candidates,
    })))
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
        let sigs = db.list_treasury_sigs_detailed(&op.op_id).map_err(db_err)?;
        let verified = sigs.iter().filter(|s| s.verified).count();
        let unsigned: Option<serde_json::Value> = op
            .unsigned_tx
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok());
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
            "signing_hash": op.signing_hash,
            "unsigned_tx": unsigned,
            "tx_id": op.tx_id,
            "signatures": sigs.iter().map(|s| serde_json::json!({
                "guardian": s.guardian,
                "signature": s.signature,
                "pubkey": s.pubkey,
                "verified": s.verified,
                "created_at": s.created_at,
            })).collect::<Vec<_>>(),
            "signature_count": sigs.len(),
            "verified_count": verified,
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
/// The submitter's verified approval counts as the first signature.
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

    // Canonical signing payload — every guardian signs this exact string.
    let op_json = serde_json::to_string(&operation)
        .map_err(|e| err(&format!("operation serialize: {e}")))?;
    let signing_hash = treasury_tx::signing_message(&req.op_id, &op_json);
    let (pubkey, verified) = verify_treasury_signature(
        rt.config(),
        &req.guardian,
        &signing_hash,
        req.signature.as_deref(),
    )?;

    db.insert_treasury_op(
        &req.op_id,
        req.proposal_id,
        &operation,
        &req.guardian,
        Some(&signing_hash),
    )
    .map_err(db_err)?;
    db.add_treasury_sig(
        &req.op_id,
        &req.guardian,
        req.signature.as_deref(),
        pubkey.as_deref(),
        verified,
    )
    .map_err(db_err)?;

    let signatures = db
        .count_verified_treasury_sigs(&req.op_id)
        .map_err(db_err)? as u32;
    let threshold = rt.config().multisig_threshold;
    audit(
        &db,
        &format!("op:{}", req.op_id),
        "treasury_op_submitted",
        Some(&req.guardian),
        serde_json::json!({
            "proposal_id": req.proposal_id,
            "verified": verified,
            "signatures": signatures,
        }),
    );
    Ok(ok(serde_json::json!({
        "op_id": req.op_id,
        "signing_hash": signing_hash,
        "signatures": signatures,
        "threshold": threshold,
        "ready": signatures >= threshold,
    })))
}

/// POST /api/dao/treasury/:op_id/sign — add a cryptographically verified
/// guardian signature. Signs the op's stored `signing_hash`.
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

    // The stored signing_hash is authoritative — it binds op_id + operation.
    let signing_hash = op.signing_hash.clone().unwrap_or_else(|| {
        treasury_tx::signing_message(&op_id, &op.operation)
    });
    let (pubkey, verified) = verify_treasury_signature(
        rt.config(),
        &req.guardian,
        &signing_hash,
        req.signature.as_deref(),
    )?;

    db.add_treasury_sig(
        &op_id,
        &req.guardian,
        req.signature.as_deref(),
        pubkey.as_deref(),
        verified,
    )
    .map_err(db_err)?;
    let signatures = db
        .count_verified_treasury_sigs(&op_id)
        .map_err(db_err)? as u32;
    let threshold = rt.config().multisig_threshold;
    let ready = signatures >= threshold;
    if ready && op.status == "pending" {
        db.update_treasury_op_status(&op_id, "signed")
            .map_err(db_err)?;
    }

    audit(
        &db,
        &format!("op:{op_id}"),
        "treasury_op_signed",
        Some(&req.guardian),
        serde_json::json!({
            "verified": verified,
            "signatures": signatures,
            "threshold": threshold,
            "ready": ready,
        }),
    );
    Ok(ok(serde_json::json!({
        "op_id": op_id,
        "signatures": signatures,
        "threshold": threshold,
        "ready": ready,
    })))
}

/// POST /api/dao/treasury/:op_id/execute — execute a fully-signed operation.
///
/// Requires ≥ threshold *verified* guardian signatures, then builds a real
/// L1 UTXO spend from live treasury UTXOs. When `ZION_DAO_TREASURY_KEY` is
/// configured the tx is signed + broadcast immediately (`executed` +
/// `tx_id`); otherwise the op moves to `awaiting_broadcast` with the
/// unsigned spec persisted for external signing.
async fn execute_treasury_op(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(op_id): Path<String>,
    Json(req): Json<TreasuryGuardianRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiErr>)> {
    check_auth(&state, &headers)?;

    let rt = state.runtime.lock().await;
    require_guardian(rt.config(), &req.guardian)?;
    let (db, treasury_addresses, l1_rpc_url) = (
        rt.db(),
        rt.config().treasury_addresses.clone(),
        rt.config().l1_rpc_url.clone(),
    );
    let db = db.ok_or_else(|| err("database not configured"))?;
    let db = db.lock().map_err(|e| err(&format!("db lock: {e}")))?;

    let op = db
        .get_treasury_op(&op_id)
        .map_err(db_err)?
        .ok_or_else(|| err(&format!("treasury operation {op_id} not found")))?;
    if op.status == "executed" {
        return Err(err(&format!("operation {op_id} already executed")));
    }
    if op.status == "rejected" || op.status == "failed" {
        return Err(err(&format!(
            "operation {op_id} is {status}",
            status = op.status
        )));
    }

    // Threshold counts *cryptographically verified* signatures only.
    let verified = db.count_verified_treasury_sigs(&op_id).map_err(db_err)? as u32;
    let threshold = rt.config().multisig_threshold;
    if verified < threshold {
        return Err(err(&format!(
            "insufficient verified signatures: {verified}/{threshold} required"
        )));
    }

    // If a proposal is linked it must have been executed first — the treasury
    // op is the settlement of an approved proposal, not a parallel path.
    if let Some(pid) = op.proposal_id {
        let proposal_ok = db
            .get_proposal(pid)
            .map_err(db_err)?
            .map(|p| p.status == "Executed")
            .unwrap_or(false);
        if !proposal_ok {
            return Err(err(&format!(
                "operation {op_id} links proposal {pid} which is not executed yet"
            )));
        }
    }

    let parsed: TreasuryOperation = serde_json::from_str(&op.operation)
        .map_err(|e| err(&format!("stored operation unparseable: {e}")))?;

    // Build the unsigned tx spec from live treasury UTXOs.
    let source_addr = treasury_tx::op_source_address(&parsed, &treasury_addresses)
        .ok_or_else(|| err("no treasury source address configured"))?;
    let utxos = treasury_tx::fetch_utxos(&l1_rpc_url, &source_addr).map_err(api_err)?;
    let spec = treasury_tx::build_unsigned_spec(&op_id, &parsed, &treasury_addresses, &utxos)
        .map_err(api_err)?;
    let spec_json = serde_json::to_string(&spec).map_err(|e| err(&format!("spec: {e}")))?;
    db.set_treasury_op_unsigned_tx(&op_id, &spec_json)
        .map_err(db_err)?;

    // Sign + broadcast when the custody key is configured; otherwise leave
    // the op in `awaiting_broadcast` with the spec exportable.
    match treasury_tx::treasury_key_from_env().map_err(api_err)? {
        Some(key) => {
            let selected = treasury_tx::select_utxos(
                &utxos,
                spec.amount_flowers,
                spec.fee_flowers,
            )
            .map_err(api_err)?
            .0;
            let tx_id = treasury_tx::sign_and_broadcast(
                &l1_rpc_url,
                &spec,
                &selected,
                &key,
            )
            .map_err(api_err)?;
            db.set_treasury_op_tx_id(&op_id, &tx_id).map_err(db_err)?;
            db.update_treasury_op_status(&op_id, "executed")
                .map_err(db_err)?;
            audit(
                &db,
                &format!("op:{op_id}"),
                "treasury_op_executed",
                Some(&req.guardian),
                serde_json::json!({ "tx_id": tx_id, "verified_signatures": verified }),
            );
            Ok(ok(serde_json::json!({
                "op_id": op_id,
                "status": "executed",
                "executed_by": req.guardian,
                "verified_signatures": verified,
                "threshold": threshold,
                "tx_id": tx_id,
                "amount_atomic": spec.amount_flowers,
                "amount_zion": spec.amount_flowers as f64 / FLOWERS_PER_ZION as f64,
            })))
        }
        None => {
            db.update_treasury_op_status(&op_id, "awaiting_broadcast")
                .map_err(db_err)?;
            audit(
                &db,
                &format!("op:{op_id}"),
                "treasury_op_awaiting_broadcast",
                Some(&req.guardian),
                serde_json::json!({ "verified_signatures": verified }),
            );
            Ok(ok(serde_json::json!({
                "op_id": op_id,
                "status": "awaiting_broadcast",
                "executed_by": req.guardian,
                "verified_signatures": verified,
                "threshold": threshold,
                "unsigned_tx": spec,
                "note": "threshold reached; ZION_DAO_TREASURY_KEY not configured — unsigned tx spec stored for external signing",
                "amount_atomic": spec.amount_flowers,
                "amount_zion": spec.amount_flowers as f64 / FLOWERS_PER_ZION as f64,
            })))
        }
    }
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

/// Treasury-pipeline errors — same envelope as `db_err`, distinct fn name
/// keeps call sites readable (`map_err(api_err)` on `DaoResult`).
fn api_err(e: DaoError) -> (StatusCode, Json<ApiErr>) {
    db_err(e)
}

fn db_err(e: DaoError) -> (StatusCode, Json<ApiErr>) {
    err(&e.to_string())
}

/// Append an immutable audit event (D4). Never fails the request — the
/// log is best-effort beside the state transition it records.
fn audit(db: &crate::db::DaoDb, subject: &str, event_type: &str, actor: Option<&str>, data: serde_json::Value) {
    let data_json = serde_json::to_string(&data).unwrap_or_else(|_| "{}".into());
    if let Err(e) = db.insert_event(subject, event_type, actor, &data_json) {
        tracing::warn!("dao event {event_type} on {subject}: {e}");
    }
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

/// Verify a guardian's Ed25519 signature over `message` against the pubkey
/// configured for that guardian. Returns `(pubkey, verified)`:
/// * guardians configured + valid sig → `(Some(pk), true)`
/// * guardians configured + missing/invalid sig → error (fail-closed)
/// * no guardians configured (dev mode) → `(None, true)` — nothing to
///   verify against; the DB row is still marked verified so the threshold
///   math behaves as before.
fn verify_treasury_signature(
    cfg: &DaoConfig,
    guardian: &str,
    message: &str,
    signature: Option<&str>,
) -> Result<(Option<String>, bool), (StatusCode, Json<ApiErr>)> {
    if cfg.guardians.is_empty() {
        return Ok((None, true));
    }
    let pubkey = cfg
        .guardians
        .iter()
        .find(|g| g.address == guardian || g.name == guardian)
        .map(|g| g.public_key.clone())
        .ok_or_else(|| err(&format!("guardian {guardian} has no configured pubkey")))?;
    let sig = signature.ok_or_else(|| {
        err("treasury signature required: sign the op's signing_hash with your guardian key")
    })?;
    treasury_tx::verify_guardian_signature(&pubkey, message, sig)
        .map_err(|e| err(&format!("guardian signature rejected: {e}")))?;
    Ok((Some(pubkey), true))
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

fn serialize_proposal(p: &Proposal, circulating_supply: u64, quorum_floor: f64) -> serde_json::Value {
    // Quorum math mirrors check_quorum_with_floor: required = supply ×
    // max(per-type floor, configured base) / 100, counted on total weight.
    let required_percent = p.proposal_type.required_quorum_percent_or(quorum_floor);
    let required_votes = (circulating_supply as f64 * required_percent / 100.0) as u64;
    let total_votes = p.total_votes();
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
        "total_votes": total_votes,
        "created_at": p.created_at.to_rfc3339(),
        "voting_ends_at": p.voting_ends_at.to_rfc3339(),
        "timelock_ends_at": p.timelock_ends_at.map(|t| t.to_rfc3339()),
        "executed_at": p.executed_at.map(|t| t.to_rfc3339()),
        "has_passed": p.has_passed(),
        "is_voting_open": p.is_voting_open(),
        "required_quorum_percent": required_percent,
        "quorum_required_votes": required_votes,
        "quorum_met": total_votes >= required_votes,
        "circulating_supply": circulating_supply,
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
        .route("/api/dao/proposals/:id/events", get(get_proposal_events))
        .route("/api/dao/proposals/:id/votes", get(get_votes))
        .route("/api/dao/proposals/:id/vote", post(cast_vote))
        .route("/api/dao/proposals/:id/tally", post(tally_proposal))
        .route("/api/dao/proposals/:id/execute", post(execute_proposal))
        .route("/api/dao/proposals/:id/cancel", post(cancel_proposal))
        .route("/api/dao/stats", get(stats))
        .route("/api/dao/guardians", get(list_guardians))
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
        let json = serialize_proposal(&p, 1_000_000_000_000, 10.0);
        assert_eq!(json["id"], 1);
        assert_eq!(json["title"], "Test");
        assert_eq!(json["status"], "Active");
        // Parameter floor = 10% × 1e12 supply = 1e11 required votes.
        assert_eq!(json["required_quorum_percent"], 10.0);
        assert_eq!(json["quorum_required_votes"], 100_000_000_000u64);
        assert_eq!(json["quorum_met"], false);
        assert_eq!(json["circulating_supply"], 1_000_000_000_000u64);
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
