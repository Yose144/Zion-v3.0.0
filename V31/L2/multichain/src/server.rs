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
use uuid::Uuid;
use zion_l1_types::{Address, Amount, Asset, AssetId, ChainId, Hash};

use std::net::SocketAddr;

use crate::config::ServerConfig;
use crate::contracts::ZionContracts;
use crate::error::{MultichainError, MultichainResult};
use crate::rate_limit::{auth_rate_limit, RateLimiter};
use crate::service::MultichainService;
use crate::swap::dex::intent::{PathHop, SolverBid, SwapIntent};
use crate::swap::Pool;
use crate::types::{Transfer, TransferDirection, TransferEndpoint};
use zion_pool::StratumServer;

/// Axum state shared by all handlers.
#[derive(Clone)]
pub struct AppState {
    service: Arc<MultichainService>,
    limiter: RateLimiter,
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

    /// Build the Axum router for testing and serving.
    pub fn router(&self) -> Router {
        let state = AppState {
            service: Arc::clone(&self.service),
            limiter: RateLimiter::new(&self.config),
        };

        Router::new()
            .route("/health", get(health))
            .route("/v1/multichain/health", get(service_health))
            .route("/v1/multichain/chains", get(list_chains))
            .route("/v1/multichain/height/:chain", get(get_height))
            .route("/v1/multichain/balance", post(get_balance))
            .route("/v1/multichain/contracts", get(get_all_contracts))
            .route("/v1/multichain/contracts/:chain", get(get_contracts))
            .route("/v1/wallet/address", post(wallet_address))
            .route("/v1/wallet/sign", post(wallet_sign))
            .route("/v1/swap/pool/deploy", post(deploy_pool))
            .route("/v1/swap/pools", get(list_pools))
            .route("/v1/swap/quote", post(swap_quote))
            .route("/v1/swap/quote/multi", post(swap_quote_multi))
            .route("/v1/swap/execute", post(swap_execute))
            .route("/v1/swap/intent", post(create_intent))
            .route("/v1/swap/intent/:id", get(get_intent))
            .route("/v1/swap/intent/:id/bid", post(submit_bid))
            .route("/v1/swap/intent/:id/settle", post(settle_intent))
            .route("/v1/swap/intent/:id/execute", post(execute_intent))
            .route("/v1/swap/intent/solver/register", post(register_solver))
            .route("/v1/bridge/submit", post(bridge_submit))
            .route("/v1/multichain/swaps/htlc/lock", post(htlc_lock))
            .route("/v1/multichain/swaps/htlc/claim", post(htlc_claim))
            .route("/v1/multichain/swaps/htlc/refund", post(htlc_refund))
            .route("/v1/multichain/swaps/htlc/:hash", get(htlc_get))
            .route("/v1/pool/stats", get(pool_stats))
            .route("/v1/pool/payouts", get(pool_payouts))
            .layer(axum::middleware::from_fn_with_state(
                state.limiter.clone(),
                auth_rate_limit,
            ))
            .layer(
                CorsLayer::new()
                    .allow_origin(AllowOrigin::any())
                    .allow_methods(AllowMethods::any())
                    .allow_headers(AllowHeaders::any()),
            )
            .with_state(state)
    }

    pub async fn run(&self) -> MultichainResult<()> {
        self.start_stratum_if_configured().await?;
        self.service.load_dex_pools().await?;
        self.service.load_intent_engine().await?;

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

        let app = self.router();

        let bind = format!("{}:{}", self.config.bind, self.config.port);
        let listener = tokio::net::TcpListener::bind(&bind)
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;

        axum::serve(
            listener,
            app.into_make_service_with_connect_info::<SocketAddr>(),
        )
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

#[derive(Deserialize)]
struct MultiQuoteRequest {
    from: Asset,
    to: Asset,
    amount: u128,
    #[serde(default = "default_n")]
    n: usize,
    #[serde(default = "default_max_hops")]
    max_hops: usize,
}

fn default_n() -> usize {
    3
}

fn default_max_hops() -> usize {
    3
}

async fn swap_quote_multi(
    State(state): State<AppState>,
    Json(req): Json<MultiQuoteRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state
        .service
        .dex_quote_multi(&req.from, &req.to, Amount::new(req.amount), req.n, req.max_hops)
        .await
    {
        Ok(paths) => {
            let routes: Vec<serde_json::Value> = paths
                .iter()
                .map(|q| serde_json::json!({
                    "route": q.route,
                    "expected_out": q.expected_out.0.to_string(),
                    "slippage_bps": q.slippage_bps,
                    "total_fee_bps": q.total_fee_bps,
                }))
                .collect();
            Ok(Json(serde_json::json!({
                "from": req.from,
                "to": req.to,
                "amount": req.amount.to_string(),
                "routes": routes,
            })))
        }
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

async fn deploy_pool(
    State(state): State<AppState>,
    Json(pool): Json<Pool>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.service.deploy_pool(pool).await {
        Ok(()) => Ok(Json(serde_json::json!({"ok": true}))),
        Err(e) => Ok(Json(serde_json::json!({
            "ok": false,
            "error": e.to_string(),
        }))),
    }
}

async fn list_pools(State(state): State<AppState>) -> Json<serde_json::Value> {
    let pools = state.service.list_dex_pools().await;
    Json(serde_json::json!({"pools": pools}))
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

async fn htlc_get(
    State(state): State<AppState>,
    Path(hash): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.service.htlc().get_record(&hash).await {
        Some(record) => Ok(Json(serde_json::json!({ "record": record }))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

#[derive(Deserialize)]
struct HtlcLockRequest {
    from: String,
    to: String,
    amount: u128,
    hash_hex: String,
    timelock: u64,
    #[serde(default)]
    source_address: Option<String>,
    #[serde(default)]
    target_address: Option<String>,
}

async fn htlc_lock(
    State(state): State<AppState>,
    Json(req): Json<HtlcLockRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let from_id = chain_name_to_id(&req.from).map_err(|_| StatusCode::BAD_REQUEST)?;
    let to_id = chain_name_to_id(&req.to).map_err(|_| StatusCode::BAD_REQUEST)?;
    let hashlock = Hash::from_hex(&req.hash_hex).ok_or(StatusCode::BAD_REQUEST)?;

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

    let mut transfer = Transfer::new(format!("htlc-lock-{}", req.hash_hex), TransferDirection::Htlc, source, target);
    transfer.hashlock = Some(hashlock);
    transfer.timelock = Some(req.timelock);

    match state.service.htlc().initiate(&mut transfer).await {
        Ok(_) => Ok(Json(serde_json::json!({
            "hash": req.hash_hex,
            "status": transfer.status,
            "transfer_id": transfer.id,
        }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

#[derive(Deserialize)]
struct HtlcClaimRequest {
    hash_hex: String,
    secret_hex: String,
    to: String,
    #[serde(default)]
    target_address: Option<String>,
}

async fn htlc_claim(
    State(state): State<AppState>,
    Json(req): Json<HtlcClaimRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let to_id = chain_name_to_id(&req.to).map_err(|_| StatusCode::BAD_REQUEST)?;
    let hashlock = Hash::from_hex(&req.hash_hex).ok_or(StatusCode::BAD_REQUEST)?;
    let record = state
        .service
        .htlc()
        .get_record(&req.hash_hex)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    let recipient = req.target_address.unwrap_or(record.counterparty_addr.clone());

    let secret = hex::decode(&req.secret_hex).map_err(|_| StatusCode::BAD_REQUEST)?;

    // Build a minimal target endpoint for the adapter; source is irrelevant for claim.
    let source = build_endpoint(
        state.service.as_ref(),
        to_id,
        Some(record.locker_address.clone()),
        record.amount as u128,
        default_ticker(to_id),
    )
    .map_err(|_| StatusCode::BAD_REQUEST)?;
    let target = build_endpoint(
        state.service.as_ref(),
        to_id,
        Some(recipient.clone()),
        record.amount as u128,
        default_ticker(to_id),
    )
    .map_err(|_| StatusCode::BAD_REQUEST)?;

    let mut transfer = Transfer::new(format!("htlc-claim-{}", req.hash_hex), TransferDirection::Htlc, source, target);
    transfer.hashlock = Some(hashlock);

    match state.service.htlc().claim(&secret, &recipient, &mut transfer).await {
        Ok(()) => Ok(Json(serde_json::json!({
            "hash": req.hash_hex,
            "status": transfer.status,
            "recipient": recipient,
        }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

#[derive(Deserialize)]
struct HtlcRefundRequest {
    hash_hex: String,
    from: String,
    #[serde(default)]
    source_address: Option<String>,
}

async fn htlc_refund(
    State(state): State<AppState>,
    Json(req): Json<HtlcRefundRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let from_id = chain_name_to_id(&req.from).map_err(|_| StatusCode::BAD_REQUEST)?;
    let hashlock = Hash::from_hex(&req.hash_hex).ok_or(StatusCode::BAD_REQUEST)?;
    let record = state
        .service
        .htlc()
        .get_record(&req.hash_hex)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    let locker = req.source_address.unwrap_or(record.locker_address.clone());

    let source = build_endpoint(
        state.service.as_ref(),
        from_id,
        Some(locker),
        record.amount as u128,
        default_ticker(from_id),
    )
    .map_err(|_| StatusCode::BAD_REQUEST)?;
    // Target is irrelevant for refund; use the source as a placeholder.
    let target = build_endpoint(
        state.service.as_ref(),
        from_id,
        Some(record.counterparty_addr.clone()),
        record.amount as u128,
        default_ticker(from_id),
    )
    .map_err(|_| StatusCode::BAD_REQUEST)?;

    let mut transfer = Transfer::new(format!("htlc-refund-{}", req.hash_hex), TransferDirection::Htlc, source, target);
    transfer.hashlock = Some(hashlock);
    transfer.timelock = Some(record.expires_at as u64);

    match state.service.htlc().refund(&mut transfer).await {
        Ok(()) => Ok(Json(serde_json::json!({
            "hash": req.hash_hex,
            "status": transfer.status,
        }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

#[derive(Deserialize)]
struct CreateIntentRequest {
    user: String,
    from_chain: String,
    from_ticker: String,
    #[serde(default)]
    from_contract: Option<String>,
    to_chain: String,
    to_ticker: String,
    #[serde(default)]
    to_contract: Option<String>,
    amount_in: u128,
    min_amount_out: u128,
    deadline: u64,
    #[serde(default)]
    nonce: u64,
}

fn make_asset_id(chain: &str, ticker: &str, contract: Option<String>) -> MultichainResult<AssetId> {
    let chain_id = chain_name_to_id(chain)?;
    Ok(AssetId::new(chain_id, ticker, contract))
}

async fn create_intent(
    State(state): State<AppState>,
    Json(req): Json<CreateIntentRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let from_asset = make_asset_id(&req.from_chain, &req.from_ticker, req.from_contract)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let to_asset = make_asset_id(&req.to_chain, &req.to_ticker, req.to_contract)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let intent = SwapIntent::new(
        req.user,
        from_asset,
        to_asset,
        Amount::new(req.amount_in),
        Amount::new(req.min_amount_out),
        req.deadline,
        req.nonce,
    );
    match state.service.create_intent(intent).await {
        Ok(id) => Ok(Json(serde_json::json!({ "intent_id": id }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

async fn get_intent(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.service.get_intent(id).await {
        Some(intent) => Ok(Json(serde_json::json!({ "intent": intent }))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

#[derive(Deserialize)]
struct BidRequest {
    intent_id: Uuid,
    solver: String,
    amount_out: u128,
    fee_bps: u16,
    timestamp: u64,
    path: Vec<PathHop>,
}

async fn submit_bid(
    State(state): State<AppState>,
    Json(req): Json<BidRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let bid = SolverBid::new(
        req.intent_id,
        req.solver,
        Amount::new(req.amount_out),
        req.path,
        req.fee_bps,
        req.timestamp,
    );
    match state.service.submit_bid(bid).await {
        Ok(accepted) => Ok(Json(serde_json::json!({ "accepted": accepted }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

async fn settle_intent(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.service.settle_intent(id).await {
        Ok(Some(bid)) => Ok(Json(serde_json::json!({ "winning_bid": bid }))),
        Ok(None) => Ok(Json(serde_json::json!({ "winning_bid": null }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

async fn execute_intent(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.service.execute_intent(id).await {
        Ok(Some(out)) => Ok(Json(serde_json::json!({ "executed": true, "out": out.0.to_string() }))),
        Ok(None) => Ok(Json(serde_json::json!({ "executed": false, "out": null }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

#[derive(Deserialize)]
struct RegisterSolverRequest {
    solver: String,
}

async fn register_solver(
    State(state): State<AppState>,
    Json(req): Json<RegisterSolverRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.service.register_solver(req.solver).await {
        Ok(added) => Ok(Json(serde_json::json!({ "registered": added }))),
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
