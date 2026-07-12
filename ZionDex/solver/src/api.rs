//! Solver REST API (axum).
//!
//! Endpoints:
//! - `GET  /health`         — solver health + stats
//! - `GET  /stats`          — solver statistics
//! - `GET  /bids/:intent_id`— get the bid for a specific intent
//! - `POST /intent`         — receive a new intent (from the auction broadcaster)
//!
//! The solver listens on `config.bind_address` (default `0.0.0.0:8455`).

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Serialize;
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use uuid::Uuid;

use crate::node::SolverNode;
use crate::types::{SolverBid, SolverStats, SwapIntent};

/// Shared state handed to every axum handler.
pub type SharedSolverNode = Arc<Mutex<SolverNode>>;

/// Build the axum router for the solver API.
pub fn build_api(state: SharedSolverNode) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/stats", get(stats_handler))
        .route("/bids/:intent_id", get(bid_handler))
        .route("/intent", post(intent_handler))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// `GET /health` — solver health + stats summary.
async fn health_handler(
    State(state): State<SharedSolverNode>,
) -> Json<HealthResponse> {
    let n = state.lock().await;
    let stats = n.stats_snapshot();
    Json(HealthResponse {
        status: "ok".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        solver_address: n
            .config
            .solver_address
            .clone()
            .unwrap_or_default(),
        router_url: n.config.router_url.clone(),
        stats,
    })
}

/// `GET /stats` — full solver statistics.
async fn stats_handler(
    State(state): State<SharedSolverNode>,
) -> Json<SolverStats> {
    let n = state.lock().await;
    Json(n.stats_snapshot())
}

/// `GET /bids/:intent_id` — fetch the pending bid for an intent.
async fn bid_handler(
    State(state): State<SharedSolverNode>,
    Path(intent_id): Path<Uuid>,
) -> Result<Json<SolverBid>, (StatusCode, String)> {
    let n = state.lock().await;
    n.bid_for(intent_id)
        .await
        .map(Json)
        .ok_or((StatusCode::NOT_FOUND, "no bid for intent".into()))
}

/// `POST /intent` — receive a new intent, compute + submit a bid.
///
/// Returns the computed bid. In a full deployment the bid would also be
/// submitted to the auction broadcaster; here we record it locally so it can
/// be inspected via `GET /bids/:intent_id`.
async fn intent_handler(
    State(state): State<SharedSolverNode>,
    Json(intent): Json<SwapIntent>,
) -> Result<Json<SolverBid>, (StatusCode, String)> {
    // Compute the bid outside the write lock where possible: clone what we need.
    let (router_client, strategy, stats_intent_seen) = {
        let n = state.lock().await;
        (
            n.router_client.clone(),
            n.strategy.clone(),
            n.stats.intents_seen,
        )
    };
    let _ = stats_intent_seen;

    // Fetch the quote + compute the bid.
    let amount_str = intent.amount_in.to_string();
    let quote = router_client
        .get_multi_quote(
            intent.from_chain.name(),
            &intent.from_token,
            intent.to_chain.name(),
            &intent.to_token,
            &amount_str,
        )
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;

    let bid = strategy
        .compute_bid(&intent, &quote)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    // Record the bid + bump stats under the write lock.
    {
        let mut n = state.lock().await;
        n.stats.observe_intent();
        n.record_bid_submitted(bid.clone()).await;
    }

    tracing::info!(
        "submitted bid for intent {}: amount_out={}",
        intent.id,
        bid.amount_out,
    );
    Ok(Json(bid))
}

/// Health response body.
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub solver_address: String,
    pub router_url: String,
    pub stats: SolverStats,
}
