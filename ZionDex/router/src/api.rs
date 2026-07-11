use crate::db::SharedDb;
use crate::executor::Executor;
use crate::monitor;
use crate::quote::QuoteEngine;
use crate::types::*;
use anyhow::Result;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use chrono::Utc;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::info;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub quote_engine: Arc<QuoteEngine>,
    pub executor: Arc<Executor>,
    pub db: SharedDb,
    pub start_time: std::time::Instant,
}

/// Build the axum router
pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/quote", post(quote_handler))
        .route("/swap", post(swap_handler))
        .route("/swaps/:id", get(get_swap_handler))
        .route("/swaps", get(list_swaps_handler))
        .route("/health", get(health_handler))
        .route("/pools", get(list_pools_handler))
        .route("/prices/:token", get(get_price_handler))
        .route("/stream", get(monitor::ws_handler))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// POST /quote — get a price quote
async fn quote_handler(
    State(state): State<AppState>,
    Json(req): Json<QuoteRequest>,
) -> Result<Json<QuoteResponse>, (StatusCode, String)> {
    info!("Quote request: {:?}", req);

    let response = state.quote_engine.quote(&req).await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    // Store quote in DB
    {
        let db = state.db.lock().await;
        let _ = db.insert_quote(&response.quote_id, &req, &response);
    }

    Ok(Json(response))
}

/// POST /swap — execute a swap
async fn swap_handler(
    State(state): State<AppState>,
    Json(req): Json<SwapRequest>,
) -> Result<Json<SwapResponse>, (StatusCode, String)> {
    info!("Swap request: quote_id={}", req.quote_id);

    // Retrieve the quote
    let quote = {
        let db = state.db.lock().await;
        db.get_quote(&req.quote_id)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .ok_or((StatusCode::NOT_FOUND, "Quote not found or expired".into()))?
    };

    // Validate slippage
    if req.max_slippage_bps > 10000 {
        return Err((StatusCode::BAD_REQUEST, "Slippage too high".into()));
    }

    // Create swap record
    let swap_id = format!("swap_{}", ulid::Ulid::new());
    let record = SwapRecord {
        id: swap_id.clone(),
        quote_id: req.quote_id.clone(),
        sender: req.sender.clone(),
        recipient: req.recipient.clone(),
        src_chain: quote.path.steps.first().map(|s| match s {
            SwapStep::SameChainSwap { chain, .. } => *chain,
            SwapStep::Bridge { from_chain, .. } => *from_chain,
        }).unwrap_or(ChainId::Zion),
        dest_chain: quote.path.steps.last().map(|s| match s {
            SwapStep::SameChainSwap { chain, .. } => *chain,
            SwapStep::Bridge { to_chain, .. } => *to_chain,
        }).unwrap_or(ChainId::Zion),
        amount_in: quote.path.steps.first().map(|s| match s {
            SwapStep::SameChainSwap { amount_in, .. } => amount_in.clone(),
            SwapStep::Bridge { amount, .. } => amount.clone(),
        }).unwrap_or_default(),
        amount_out: None,
        status: SwapStatus::Pending,
        steps: vec![],
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    {
        let db = state.db.lock().await;
        db.insert_swap(&record)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    // Execute the swap in the background
    let executor = state.executor.clone();
    let db = state.db.clone();
    let sid = swap_id.clone();
    let path_for_exec = quote.path.clone();
    let sender = req.sender.clone();
    let recipient = req.recipient.clone();

    tokio::spawn(async move {
        if let Err(e) = executor.execute(&sid, &path_for_exec, &sender, &recipient).await {
            tracing::error!("Swap {} failed: {}", sid, e);
            let db = db.lock().await;
            let _ = db.update_status(&sid, SwapStatus::Failed);
        }
    });

    // Build response
    let steps: Vec<StepStatus> = quote.path.steps.iter().enumerate().map(|(i, s)| StepStatus {
        step_index: i,
        step_type: match s {
            SwapStep::SameChainSwap { .. } => "same_chain_swap".into(),
            SwapStep::Bridge { .. } => "bridge".into(),
        },
        status: SwapStatus::Pending,
        tx_hash: None,
        error: None,
    }).collect();

    Ok(Json(SwapResponse {
        swap_id: swap_id.clone(),
        status: SwapStatus::Pending,
        steps,
        monitor_url: format!("/swaps/{}", swap_id),
    }))
}

/// GET /swaps/:id — get swap status
async fn get_swap_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<SwapRecord>, (StatusCode, String)> {
    let db = state.db.lock().await;
    let record = db.get_swap(&id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Swap not found".into()))?;
    Ok(Json(record))
}

/// GET /swaps — list recent swaps
async fn list_swaps_handler(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<ListParams>,
) -> Result<Json<Vec<SwapRecord>>, (StatusCode, String)> {
    let limit = params.limit.unwrap_or(20).min(100);
    let db = state.db.lock().await;
    let records = db.list_swaps(limit)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(records))
}

#[derive(serde::Deserialize)]
struct ListParams {
    limit: Option<usize>,
}

/// GET /health — health check
async fn health_handler(
    State(state): State<AppState>,
) -> Json<HealthResponse> {
    let chains = state.quote_engine.config.dex_registry.keys().copied().collect();
    Json(HealthResponse {
        status: "ok".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        chains,
        uptime_secs: state.start_time.elapsed().as_secs(),
    })
}

/// GET /pools — list all known pools
async fn list_pools_handler(
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    let mut pools = Vec::new();
    for (chain, dexs) in &state.quote_engine.config.dex_registry {
        for dex in dexs {
            for pool in &dex.pools {
                pools.push(serde_json::json!({
                    "chain": chain.name(),
                    "dex": dex.dex.name(),
                    "token_a": pool.token_a,
                    "token_b": pool.token_b,
                    "address": pool.address,
                    "fee_bps": pool.fee_bps,
                    "enabled": dex.enabled,
                }));
            }
        }
    }
    Json(serde_json::json!({ "pools": pools }))
}

/// GET /prices/:token — get token price across chains
async fn get_price_handler(
    Path(token): Path<String>,
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    // TODO: Fetch real prices from pool slot0
    Json(serde_json::json!({
        "token": token,
        "prices": [],
        "note": "Price feed not yet implemented — use /quote for specific pairs"
    }))
}
