//! Intent-Based Execution API (Phase 4)
//!
//! Provides REST endpoints for submitting SwapIntents, viewing auction status,
//! and settling winning bids. The actual auction engine lives in the
//! `ziondex-intent` crate; this module exposes a thin HTTP layer that the
//! solver daemon and frontend can call.

use crate::db::SharedDb;
use anyhow::Result;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::info;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Types — mirror the ziondex-intent crate shapes (kept independent to avoid
// a workspace dependency).
// ---------------------------------------------------------------------------

/// A signed user intent to swap.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapIntentRequest {
    pub user: String,
    pub from_chain: String,
    pub to_chain: String,
    pub from_token: String,
    pub to_token: String,
    pub amount_in: String,
    pub min_amount_out: String,
    pub deadline: u64,
    pub nonce: u64,
    pub signature: String, // hex
}

/// Stored intent with server-assigned id + status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapIntentRecord {
    pub id: String,
    pub user: String,
    pub from_chain: String,
    pub to_chain: String,
    pub from_token: String,
    pub to_token: String,
    pub amount_in: String,
    pub min_amount_out: String,
    pub deadline: u64,
    pub nonce: u64,
    pub signature: String,
    pub status: IntentStatus,
    pub created_at: i64,
    pub winning_bid: Option<SolverBidRecord>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum IntentStatus {
    Pending,
    Settled,
    Executed,
    Expired,
    Cancelled,
}

/// A solver bid on an intent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverBidRequest {
    pub intent_id: String,
    pub solver: String,
    pub amount_out: String,
    pub fee_bps: u16,
    pub path: Vec<PathHopJson>,
    pub signature: String, // hex
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverBidRecord {
    pub intent_id: String,
    pub solver: String,
    pub amount_out: String,
    pub fee_bps: u16,
    pub path: Vec<PathHopJson>,
    pub signature: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathHopJson {
    pub chain: String,
    pub dex: String,
    pub from_token: String,
    pub to_token: String,
    pub is_bridge: bool,
}

/// Settlement request — marks an intent as executed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettleRequest {
    pub intent_id: String,
    pub solver: String,
    pub amount_out: String,
    pub tx_hash: String,
}

// ---------------------------------------------------------------------------
// In-memory intent store (persisted to DB in production).
// ---------------------------------------------------------------------------

#[derive(Debug, Default)]
pub struct IntentStore {
    pub intents: HashMap<String, SwapIntentRecord>,
    pub bids: HashMap<String, Vec<SolverBidRecord>>, // intent_id → bids
}

pub type SharedIntentStore = Arc<Mutex<IntentStore>>;

// ---------------------------------------------------------------------------
// AppState extension
// ---------------------------------------------------------------------------

/// Build the intent sub-router.  Mount under `/intent/*`.
pub fn intent_routes<S>(store: SharedIntentStore, _db: SharedDb) -> Router<S> {
    Router::new()
        .route("/intent", post(submit_intent))
        .route("/intent/:id", get(get_intent))
        .route("/intent/:id/cancel", post(cancel_intent))
        .route("/intent/:id/bids", get(list_bids))
        .route("/intent/:id/bid", post(submit_bid))
        .route("/intent/:id/settle", post(settle_intent))
        .route("/intents", get(list_intents))
        .with_state(store)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// POST /intent — submit a new swap intent.
async fn submit_intent(
    State(store): State<SharedIntentStore>,
    Json(req): Json<SwapIntentRequest>,
) -> Result<Json<SwapIntentRecord>, (StatusCode, String)> {
    let id = format!("intent_{}", Uuid::new_v4().simple());
    let now = Utc::now().timestamp();

    // Basic validation
    if req.deadline <= now as u64 {
        return Err((StatusCode::BAD_REQUEST, "Deadline already passed".into()));
    }
    if req.amount_in == "0" || req.amount_in.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "amount_in must be > 0".into()));
    }
    if req.signature.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Missing user signature".into()));
    }

    let record = SwapIntentRecord {
        id: id.clone(),
        user: req.user,
        from_chain: req.from_chain,
        to_chain: req.to_chain,
        from_token: req.from_token,
        to_token: req.to_token,
        amount_in: req.amount_in,
        min_amount_out: req.min_amount_out,
        deadline: req.deadline,
        nonce: req.nonce,
        signature: req.signature,
        status: IntentStatus::Pending,
        created_at: now,
        winning_bid: None,
    };

    info!("New intent: {} ({} {} → {} {})", id, record.from_chain, record.from_token, record.to_chain, record.to_token);

    let mut s = store.lock().await;
    s.intents.insert(id.clone(), record.clone());
    s.bids.insert(id, Vec::new());

    Ok(Json(record))
}

/// GET /intent/:id — fetch a single intent by id.
async fn get_intent(
    State(store): State<SharedIntentStore>,
    Path(id): Path<String>,
) -> Result<Json<SwapIntentRecord>, (StatusCode, String)> {
    let s = store.lock().await;
    s.intents
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or((StatusCode::NOT_FOUND, "Intent not found".into()))
}

/// GET /intents — list all intents (optionally filter by status query).
async fn list_intents(
    State(store): State<SharedIntentStore>,
) -> Result<Json<Vec<SwapIntentRecord>>, (StatusCode, String)> {
    let s = store.lock().await;
    let mut all: Vec<_> = s.intents.values().cloned().collect();
    all.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(Json(all))
}

/// POST /intent/:id/cancel — cancel a pending intent (only by the original user).
#[derive(Debug, Deserialize)]
pub struct CancelRequest {
    pub user: String,
}

async fn cancel_intent(
    State(store): State<SharedIntentStore>,
    Path(id): Path<String>,
    Json(req): Json<CancelRequest>,
) -> Result<Json<SwapIntentRecord>, (StatusCode, String)> {
    let mut s = store.lock().await;
    let intent = s
        .intents
        .get_mut(&id)
        .ok_or((StatusCode::NOT_FOUND, "Intent not found".into()))?;

    if intent.user != req.user {
        return Err((StatusCode::FORBIDDEN, "Only the intent owner can cancel".into()));
    }
    if intent.status != IntentStatus::Pending {
        return Err((StatusCode::BAD_REQUEST, "Intent is not pending".into()));
    }

    intent.status = IntentStatus::Cancelled;
    Ok(Json(intent.clone()))
}

/// POST /intent/:id/bid — submit a solver bid.
async fn submit_bid(
    State(store): State<SharedIntentStore>,
    Path(id): Path<String>,
    Json(req): Json<SolverBidRequest>,
) -> Result<Json<SolverBidRecord>, (StatusCode, String)> {
    let now = Utc::now().timestamp();
    let mut s = store.lock().await;

    // Validate intent exists and is pending
    let intent = s
        .intents
        .get(&id)
        .ok_or((StatusCode::NOT_FOUND, "Intent not found".into()))?;

    if intent.status != IntentStatus::Pending {
        return Err((StatusCode::BAD_REQUEST, "Intent is not accepting bids".into()));
    }

    if intent.deadline <= now as u64 {
        // Expire
        if let Some(i) = s.intents.get_mut(&id) {
            i.status = IntentStatus::Expired;
        }
        return Err((StatusCode::BAD_REQUEST, "Intent has expired".into()));
    }

    // Check min_amount_out
    let min_out: u128 = intent
        .min_amount_out
        .parse()
        .map_err(|e: std::num::ParseIntError| (StatusCode::BAD_REQUEST, format!("Invalid min_amount_out: {}", e)))?;
    let bid_out: u128 = req
        .amount_out
        .parse()
        .map_err(|e: std::num::ParseIntError| (StatusCode::BAD_REQUEST, format!("Invalid amount_out: {}", e)))?;

    if bid_out < min_out {
        return Err((StatusCode::BAD_REQUEST, "Bid below min_amount_out".into()));
    }

    let bid = SolverBidRecord {
        intent_id: id.clone(),
        solver: req.solver,
        amount_out: req.amount_out,
        fee_bps: req.fee_bps,
        path: req.path,
        signature: req.signature,
        timestamp: now,
    };

    info!("New bid on intent {}: solver={} amount_out={}", id, bid.solver, bid.amount_out);

    s.bids.entry(id.clone()).or_default().push(bid.clone());

    Ok(Json(bid))
}

/// GET /intent/:id/bids — list all bids for an intent.
async fn list_bids(
    State(store): State<SharedIntentStore>,
    Path(id): Path<String>,
) -> Result<Json<Vec<SolverBidRecord>>, (StatusCode, String)> {
    let s = store.lock().await;
    let bids = s.bids.get(&id).cloned().unwrap_or_default();
    // Sort by amount_out descending (best first)
    let mut sorted = bids;
    sorted.sort_by(|a, b| {
        let a: u128 = a.amount_out.parse().unwrap_or(0);
        let b: u128 = b.amount_out.parse().unwrap_or(0);
        b.cmp(&a)
    });
    Ok(Json(sorted))
}

/// POST /intent/:id/settle — mark an intent as settled + executed.
///
/// Picks the best bid (highest amount_out) if not already settled, records
/// the execution tx hash, and updates status to `Executed`.
async fn settle_intent(
    State(store): State<SharedIntentStore>,
    Path(id): Path<String>,
    Json(req): Json<SettleRequest>,
) -> Result<Json<SwapIntentRecord>, (StatusCode, String)> {
    let mut s = store.lock().await;

    // Check status first (immutable borrow)
    let current_status = s
        .intents
        .get(&id)
        .map(|i| i.status)
        .ok_or((StatusCode::NOT_FOUND, "Intent not found".into()))?;

    if current_status == IntentStatus::Executed {
        return Err((StatusCode::BAD_REQUEST, "Intent already executed".into()));
    }
    if current_status == IntentStatus::Cancelled || current_status == IntentStatus::Expired {
        return Err((StatusCode::BAD_REQUEST, "Intent is not active".into()));
    }

    // Find the winning bid from this solver
    let bids = s.bids.get(&id).cloned().unwrap_or_default();
    let winner = bids
        .into_iter()
        .filter(|b| b.solver == req.solver)
        .max_by_key(|b| b.amount_out.parse::<u128>().unwrap_or(0))
        .ok_or((StatusCode::NOT_FOUND, "No bid from this solver".into()))?;

    // Now mutate
    let intent = s
        .intents
        .get_mut(&id)
        .ok_or((StatusCode::NOT_FOUND, "Intent not found".into()))?;

    intent.status = IntentStatus::Executed;
    intent.winning_bid = Some(SolverBidRecord {
        amount_out: req.amount_out.clone(),
        timestamp: Utc::now().timestamp(),
        ..winner
    });

    info!("Intent {} settled by solver {} (amount_out={}, tx={})", id, req.solver, req.amount_out, req.tx_hash);

    Ok(Json(intent.clone()))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_store() -> SharedIntentStore {
        Arc::new(Mutex::new(IntentStore::default()))
    }

    fn make_intent_req() -> SwapIntentRequest {
        SwapIntentRequest {
            user: "0x1234567890abcdef1234567890abcdef12345678".into(),
            from_chain: "base".into(),
            to_chain: "solana".into(),
            from_token: "wZION".into(),
            to_token: "USDC".into(),
            amount_in: "1000000000000000000".into(),
            min_amount_out: "900000000".into(),
            deadline: (Utc::now().timestamp() as u64) + 3600,
            nonce: 1,
            signature: "0xdeadbeef".into(),
        }
    }

    #[tokio::test]
    async fn test_submit_and_get_intent() {
        let store = make_store();
        let req = make_intent_req();

        // Submit
        let record = submit_intent(State(store.clone()), Json(req.clone()))
            .await
            .unwrap()
            .0;
        assert_eq!(record.status, IntentStatus::Pending);

        // Get
        let fetched = get_intent(State(store.clone()), Path(record.id.clone()))
            .await
            .unwrap()
            .0;
        assert_eq!(fetched.user, req.user);
    }

    #[tokio::test]
    async fn test_cancel_intent() {
        let store = make_store();
        let record = submit_intent(State(store.clone()), Json(make_intent_req()))
            .await
            .unwrap()
            .0;

        let cancelled = cancel_intent(
            State(store.clone()),
            Path(record.id.clone()),
            Json(CancelRequest {
                user: record.user.clone(),
            }),
        )
        .await
        .unwrap()
        .0;
        assert_eq!(cancelled.status, IntentStatus::Cancelled);
    }

    #[tokio::test]
    async fn test_cancel_wrong_user() {
        let store = make_store();
        let record = submit_intent(State(store.clone()), Json(make_intent_req()))
            .await
            .unwrap()
            .0;

        let err = cancel_intent(
            State(store.clone()),
            Path(record.id.clone()),
            Json(CancelRequest {
                user: "0xwrong".into(),
            }),
        )
        .await;
        assert!(err.is_err());
    }

    #[tokio::test]
    async fn test_submit_bid_and_list() {
        let store = make_store();
        let record = submit_intent(State(store.clone()), Json(make_intent_req()))
            .await
            .unwrap()
            .0;

        let bid1 = submit_bid(
            State(store.clone()),
            Path(record.id.clone()),
            Json(SolverBidRequest {
                intent_id: record.id.clone(),
                solver: "0xsolver1".into(),
                amount_out: "950000000".into(),
                fee_bps: 10,
                path: vec![],
                signature: "0xbid1".into(),
            }),
        )
        .await
        .unwrap()
        .0;

        let bid2 = submit_bid(
            State(store.clone()),
            Path(record.id.clone()),
            Json(SolverBidRequest {
                intent_id: record.id.clone(),
                solver: "0xsolver2".into(),
                amount_out: "970000000".into(),
                fee_bps: 8,
                path: vec![],
                signature: "0xbid2".into(),
            }),
        )
        .await
        .unwrap()
        .0;

        // List bids — best (highest) first
        let bids = list_bids(State(store.clone()), Path(record.id.clone()))
            .await
            .unwrap()
            .0;
        assert_eq!(bids.len(), 2);
        assert_eq!(bids[0].amount_out, "970000000"); // bid2 is higher
        assert_eq!(bids[1].amount_out, "950000000");

        let _ = bid1;
        let _ = bid2;
    }

    #[tokio::test]
    async fn test_bid_below_minimum() {
        let store = make_store();
        let record = submit_intent(State(store.clone()), Json(make_intent_req()))
            .await
            .unwrap()
            .0;

        let err = submit_bid(
            State(store.clone()),
            Path(record.id.clone()),
            Json(SolverBidRequest {
                intent_id: record.id.clone(),
                solver: "0xsolver1".into(),
                amount_out: "800000000".into(), // below min_amount_out (900M)
                fee_bps: 10,
                path: vec![],
                signature: "0xbid".into(),
            }),
        )
        .await;
        assert!(err.is_err());
    }

    #[tokio::test]
    async fn test_settle_intent() {
        let store = make_store();
        let record = submit_intent(State(store.clone()), Json(make_intent_req()))
            .await
            .unwrap()
            .0;

        // Submit a bid
        submit_bid(
            State(store.clone()),
            Path(record.id.clone()),
            Json(SolverBidRequest {
                intent_id: record.id.clone(),
                solver: "0xsolver1".into(),
                amount_out: "970000000".into(),
                fee_bps: 10,
                path: vec![],
                signature: "0xbid1".into(),
            }),
        )
        .await
        .unwrap();

        // Settle
        let settled = settle_intent(
            State(store.clone()),
            Path(record.id.clone()),
            Json(SettleRequest {
                intent_id: record.id.clone(),
                solver: "0xsolver1".into(),
                amount_out: "970000000".into(),
                tx_hash: "0xabc".into(),
            }),
        )
        .await
        .unwrap()
        .0;

        assert_eq!(settled.status, IntentStatus::Executed);
        assert!(settled.winning_bid.is_some());
    }

    #[tokio::test]
    async fn test_settle_replay() {
        let store = make_store();
        let record = submit_intent(State(store.clone()), Json(make_intent_req()))
            .await
            .unwrap()
            .0;

        submit_bid(
            State(store.clone()),
            Path(record.id.clone()),
            Json(SolverBidRequest {
                intent_id: record.id.clone(),
                solver: "0xsolver1".into(),
                amount_out: "970000000".into(),
                fee_bps: 10,
                path: vec![],
                signature: "0xbid1".into(),
            }),
        )
        .await
        .unwrap();

        // First settle OK
        settle_intent(
            State(store.clone()),
            Path(record.id.clone()),
            Json(SettleRequest {
                intent_id: record.id.clone(),
                solver: "0xsolver1".into(),
                amount_out: "970000000".into(),
                tx_hash: "0xabc".into(),
            }),
        )
        .await
        .unwrap();

        // Second settle should fail
        let err = settle_intent(
            State(store.clone()),
            Path(record.id.clone()),
            Json(SettleRequest {
                intent_id: record.id.clone(),
                solver: "0xsolver1".into(),
                amount_out: "970000000".into(),
                tx_hash: "0xdef".into(),
            }),
        )
        .await;
        assert!(err.is_err());
    }

    #[tokio::test]
    async fn test_list_intents() {
        let store = make_store();
        submit_intent(State(store.clone()), Json(make_intent_req()))
            .await
            .unwrap();

        let mut req2 = make_intent_req();
        req2.nonce = 2;
        submit_intent(State(store.clone()), Json(req2))
            .await
            .unwrap();

        let all = list_intents(State(store.clone())).await.unwrap().0;
        assert_eq!(all.len(), 2);
    }

    #[tokio::test]
    async fn test_expired_deadline() {
        let store = make_store();
        let mut req = make_intent_req();
        req.deadline = 1; // already passed
        let err = submit_intent(State(store.clone()), Json(req)).await;
        assert!(err.is_err());
    }
}
