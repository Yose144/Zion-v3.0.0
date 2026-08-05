use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::json;
use tokio::sync::Mutex;
use tracing::info;

use crate::{
    db::SwapDb,
    orchestrator::SwapOrchestrator,
    types::{QuoteRequest, QuoteResponse, SwapRequest, SwapResponse},
};

/// Shared application state
#[derive(Clone)]
pub struct AppState {
    pub orchestrator: Arc<SwapOrchestrator>,
    pub db: Arc<Mutex<SwapDb>>,
}

/// Build the Axum router
pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/swap", post(create_swap_handler))
        .route("/swap/:id", get(get_swap_handler))
        .route("/swaps", get(list_swaps_handler))
        .route("/quote", post(quote_handler))
        .with_state(state)
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "service": "zion-swap-aggregator" }))
}

async fn create_swap_handler(
    State(state): State<AppState>,
    Json(req): Json<SwapRequest>,
) -> Result<Json<SwapResponse>, StatusCode> {
    info!(
        "Received swap request: direction={:?}, amount={}",
        req.direction, req.amount_in
    );

    let record = state.orchestrator.create_swap(req).await.map_err(|e| {
        tracing::error!("Failed to create swap: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Spawn background processing
    let id = record.id.clone();
    let orch = Arc::clone(&state.orchestrator);
    tokio::spawn(async move {
        if let Err(e) = orch.process_swap(&id).await {
            tracing::error!(swap_id = %id, "Swap processing failed: {}", e);
            // Update error in DB
            if let Ok(db) = orch.db.try_lock() {
                let _result: Result<(), _> = db.update_error(&id, &e.to_string());
            }
        }
    });

    Ok(Json(record.into()))
}

async fn get_swap_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<SwapResponse>, StatusCode> {
    let record = state
        .orchestrator
        .get_swap(&id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get swap: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(record.into()))
}

async fn list_swaps_handler(
    State(state): State<AppState>,
) -> Result<Json<Vec<SwapResponse>>, StatusCode> {
    let records = state.orchestrator.list_swaps(100).await.map_err(|e| {
        tracing::error!("Failed to list swaps: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(records.into_iter().map(Into::into).collect()))
}

async fn quote_handler(
    State(state): State<AppState>,
    Json(req): Json<QuoteRequest>,
) -> Result<Json<QuoteResponse>, StatusCode> {
    let quote = state.orchestrator.quote(req).await.map_err(|e| {
        tracing::error!("Failed to get quote: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(quote))
}
