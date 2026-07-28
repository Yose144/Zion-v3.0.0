//! HTTP API gateway for the Multi-Chain layer.

use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use tower_http::cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer};

use zion_l1_types::{Address, Amount, Asset, ChainId};

use crate::config::ServerConfig;
use crate::contracts::ZionContracts;
use crate::error::{MultichainError, MultichainResult};
use crate::service::MultichainService;
use crate::types::{Transfer, TransferDirection, TransferEndpoint};
use zion_pool::StratumServer;

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

    async fn start_stratum_if_configured(&self) -> MultichainResult<()> {
        let Some(pool) = self.service.pool() else {
            return Ok(());
        };

        {
            let mut p = pool.lock().unwrap();
            p.restore();
        }

        let port = pool.lock().unwrap().config.port;
        let stratum = StratumServer::new(Arc::clone(&pool));
        let bind = format!("0.0.0.0:{}", port);
        let listener = tokio::net::TcpListener::bind(&bind)
            .await
            .map_err(|e| MultichainError::Internal(format!("stratum bind {bind}: {e}")))?;

        let stratum_run = stratum.clone();
        tokio::spawn(async move {
            if let Err(e) = stratum_run.run(listener).await {
                tracing::error!("stratum server error: {}", e);
            }
        });

        let stratum_broadcast = stratum;
        let service = Arc::clone(&self.service);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(10));
            loop {
                interval.tick().await;
                match service.block_template(ChainId::ZionL1).await {
                    Ok(Some(tpl)) => {
                        let template_json = serde_json::to_string(&tpl.raw).unwrap_or_default();
                        stratum_broadcast.broadcast_job(
                            &format!("zion_{}", tpl.template_id),
                            &tpl.header_hex,
                            &tpl.target_hex,
                            tpl.block_reward,
                            &template_json,
                        );
                    }
                    Ok(None) => {
                        let header = "00".repeat(80);
                        let target = "f".repeat(64);
                        stratum_broadcast.broadcast_job("zion_1", &header, &target, 6_000_000, "");
                    }
                    Err(e) => {
                        tracing::warn!("failed to fetch zion block template: {}", e);
                    }
                }
            }
        });

        let pool_save = Arc::clone(&pool);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(30));
            loop {
                interval.tick().await;
                if let Err(e) = pool_save.lock().unwrap().save() {
                    tracing::warn!("failed to save pplns state: {}", e);
                }
            }
        });

        Ok(())
    }

    pub async fn run(&self) -> MultichainResult<()> {
        self.start_stratum_if_configured().await?;

        let payout_service = Arc::clone(&self.service);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(30));
            loop {
                interval.tick().await;
                if let Err(e) = payout_service.execute_payouts().await {
                    tracing::warn!("payout executor error: {}", e);
                }
            }
        });

        let state = AppState {
            service: Arc::clone(&self.service),
        };

        let app = Router::new()
            .route("/health", get(health))
            .route("/v1/multichain/health", get(service_health))
            .route("/v1/multichain/chains", get(list_chains))
            .route("/v1/multichain/height/:chain", get(get_height))
            .route("/v1/multichain/balance", post(get_balance))
            .route("/v1/multichain/contracts", get(get_all_contracts))
            .route("/v1/multichain/contracts/:chain", get(get_contracts))
            .route("/v1/wallet/address", post(wallet_address))
            .route("/v1/wallet/sign", post(wallet_sign))
            .route("/v1/swap/quote", post(swap_quote))
            .route("/v1/swap/execute", post(swap_execute))
            .route("/v1/bridge/submit", post(bridge_submit))
            .route("/v1/pool/stats", get(pool_stats))
            .route("/v1/pool/payouts", get(pool_payouts))
            .layer(
                CorsLayer::new()
                    .allow_origin(AllowOrigin::any())
                    .allow_methods(AllowMethods::any())
                    .allow_headers(AllowHeaders::any()),
            );

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

async fn pool_stats(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.service.pool_stats() {
        Some(stats) => Ok(Json(stats)),
        None => Ok(Json(serde_json::json!({"enabled": false}))),
    }
}

async fn pool_payouts(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.service.pool_payouts() {
        Some(payouts) => Ok(Json(payouts)),
        None => Ok(Json(serde_json::json!({"payouts": []}))),
    }
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
        Ok(h) => Ok(Json(
            serde_json::json!({ "chain": chain_name, "height": h }),
        )),
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

async fn get_all_contracts() -> Json<serde_json::Value> {
    Json(serde_json::json!(ZionContracts::all()))
}

async fn get_contracts(Path(chain_name): Path<String>) -> Result<Json<ZionContracts>, StatusCode> {
    ZionContracts::for_chain(&chain_name)
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

#[derive(Deserialize)]
struct WalletAddressRequest {
    chain: String,
    #[serde(default)]
    account: u32,
    #[serde(default)]
    index: u32,
}

async fn wallet_address(
    State(state): State<AppState>,
    Json(req): Json<WalletAddressRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let chain = chain_name_to_id(&req.chain).map_err(|_| StatusCode::BAD_REQUEST)?;
    match state.service.wallet_address(chain, req.account, req.index) {
        Ok(addr) => Ok(Json(serde_json::json!({
            "chain": req.chain,
            "address": addr.encoded,
            "bytes": hex::encode(&addr.bytes),
        }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

#[derive(Deserialize)]
struct WalletSignRequest {
    chain: String,
    message: String,
    #[serde(default)]
    account: u32,
    #[serde(default)]
    index: u32,
}

async fn wallet_sign(
    State(state): State<AppState>,
    Json(req): Json<WalletSignRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let chain = chain_name_to_id(&req.chain).map_err(|_| StatusCode::BAD_REQUEST)?;
    match state
        .service
        .wallet_sign(chain, req.message.as_bytes(), req.account, req.index)
    {
        Ok(sig) => Ok(Json(serde_json::json!({
            "chain": req.chain,
            "signature": format!("0x{}", hex::encode(sig)),
        }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

#[derive(Deserialize)]
struct SwapRequest {
    from: Asset,
    to: Asset,
    amount: u128,
}

async fn swap_quote(
    State(state): State<AppState>,
    Json(req): Json<SwapRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state
        .service
        .dex_quote(&req.from, &req.to, Amount::new(req.amount))
        .await
    {
        Ok(quote) => Ok(Json(serde_json::json!({
            "from": req.from,
            "to": req.to,
            "amount": req.amount.to_string(),
            "expected_out": quote.expected_out.0.to_string(),
            "slippage_bps": quote.slippage_bps,
            "route": quote.route,
        }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

async fn swap_execute(
    State(state): State<AppState>,
    Json(req): Json<SwapRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state
        .service
        .dex_swap(&req.from, &req.to, Amount::new(req.amount))
        .await
    {
        Ok(out) => Ok(Json(serde_json::json!({
            "from": req.from,
            "to": req.to,
            "amount": req.amount.to_string(),
            "out": out.0.to_string(),
        }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

#[derive(Deserialize)]
struct BridgeRequest {
    direction: String,
    from: String,
    to: String,
    amount: u128,
    #[serde(default)]
    source_address: Option<String>,
    #[serde(default)]
    target_address: Option<String>,
}

async fn bridge_submit(
    State(state): State<AppState>,
    Json(req): Json<BridgeRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let direction = match req.direction.to_lowercase().as_str() {
        "lock" | "lockmint" | "lock_mint" => TransferDirection::LockMint,
        "burn" | "burnrelease" | "burn_release" => TransferDirection::BurnRelease,
        _ => return Err(StatusCode::BAD_REQUEST),
    };
    let from_id = chain_name_to_id(&req.from).map_err(|_| StatusCode::BAD_REQUEST)?;
    let to_id = chain_name_to_id(&req.to).map_err(|_| StatusCode::BAD_REQUEST)?;

    let source = build_endpoint(
        state.service.as_ref(),
        from_id,
        req.source_address,
        req.amount,
        default_ticker(from_id),
    )
    .map_err(|_| StatusCode::BAD_REQUEST)?;
    let target = build_endpoint(
        state.service.as_ref(),
        to_id,
        req.target_address,
        req.amount,
        default_ticker(to_id),
    )
    .map_err(|_| StatusCode::BAD_REQUEST)?;

    let id = format!(
        "api-{}-{}-{}",
        req.from,
        req.to,
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    );
    let mut transfer = Transfer::new(id, direction, source, target);
    match state.service.bridge_submit(&mut transfer).await {
        Ok(hash) => Ok(Json(serde_json::json!({
            "transfer_id": transfer.id,
            "hash": hash.to_hex(),
            "status": transfer.status,
        }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

fn build_endpoint(
    service: &MultichainService,
    chain: ChainId,
    encoded: Option<String>,
    amount: u128,
    ticker: &str,
) -> MultichainResult<TransferEndpoint> {
    let address = match encoded {
        Some(e) => {
            let bytes = if chain.family() == zion_l1_types::ChainFamily::Evm {
                let hex = e.strip_prefix("0x").unwrap_or(&e);
                hex::decode(hex)
                    .map_err(|_| MultichainError::Internal("invalid hex".to_string()))?
            } else {
                e.as_bytes().to_vec()
            };
            Address::new(chain, bytes, e)?
        }
        None => service.wallet_address(chain, 0, 0)?,
    };
    Ok(TransferEndpoint {
        address,
        asset: Asset::native(chain, ticker, 6, ticker),
        amount: Amount::new(amount),
    })
}

fn default_ticker(chain: ChainId) -> &'static str {
    match chain {
        ChainId::ZionL1 => "ZION",
        ChainId::Base => "wZION",
        ChainId::Ethereum => "ETH",
        ChainId::Bitcoin => "BTC",
        _ => "ZION",
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
