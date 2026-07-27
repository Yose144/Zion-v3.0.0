//! HTTP API gateway for the Multi-Chain layer.

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};

use zion_l1_types::Address;

use crate::config::ServerConfig;
use crate::error::{MultichainError, MultichainResult};
use crate::service::MultichainService;

/// Axum state shared by all handlers.
#[derive(Clone)]
pub struct AppState {
    service: Arc<MultichainService>,
}

/// HTTP API gateway for `zion-multichain`.
pub struct ApiServer {
    config: ServerConfig,
    service: Arc<MultichainService>,
}

impl ApiServer {
    pub fn new(config: ServerConfig, service: Arc<MultichainService>) -> Self {
        Self { config, service }
    }

    pub async fn run(&self) -> MultichainResult<()> {
        let state = AppState {
            service: Arc::clone(&self.service),
        };

        let app = Router::new()
            .route("/health", get(health))
            .route("/v1/multichain/health", get(service_health))
            .route("/v1/multichain/chains", get(list_chains))
            .route("/v1/multichain/height/:chain", get(get_height))
            .route("/v1/multichain/balance", post(get_balance));

        let bind = format!("{}:{}", self.config.bind, self.config.port);
        let listener = tokio::net::TcpListener::bind(&bind)
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;

        axum::serve(listener, app.with_state(state))
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;

        Ok(())
    }
}

async fn health() -> &'static str {
    "ok"
}

async fn service_health(State(state): State<AppState>) -> Json<serde_json::Value> {
    let health = state.service.health().await;
    Json(serde_json::json!({ "status": health }))
}

async fn list_chains(State(state): State<AppState>) -> Json<Vec<String>> {
    Json(state.service.chains())
}

async fn get_height(
    State(state): State<AppState>,
    Path(chain_name): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let chain = chain_name_to_id(&chain_name).map_err(|_| StatusCode::BAD_REQUEST)?;
    match state.service.height(chain).await {
        Ok(h) => Ok(Json(serde_json::json!({ "chain": chain_name, "height": h }))),
        Err(_) => Err(StatusCode::SERVICE_UNAVAILABLE),
    }
}

async fn get_balance(
    State(state): State<AppState>,
    Json(address): Json<Address>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.service.balance(&address).await {
        Ok(amount) => Ok(Json(serde_json::json!({
            "chain": address.chain.as_str(),
            "address": address.encoded,
            "balance": amount.0.to_string(),
        }))),
        Err(_) => Err(StatusCode::SERVICE_UNAVAILABLE),
    }
}

fn chain_name_to_id(name: &str) -> MultichainResult<zion_l1_types::ChainId> {
    use zion_l1_types::ChainId;
    match name.to_lowercase().as_str() {
        "bitcoin" | "btc" => Ok(ChainId::Bitcoin),
        "base" => Ok(ChainId::Base),
        "ethereum" | "eth" => Ok(ChainId::Ethereum),
        "zion-l1" | "zion" | "zionl1" => Ok(ChainId::ZionL1),
        _ => Err(MultichainError::AdapterNotFound(name.to_string())),
    }
}
