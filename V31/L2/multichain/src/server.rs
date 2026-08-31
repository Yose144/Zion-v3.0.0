//! HTTP API gateway for the Multi-Chain layer.

use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use axum::{
    extract::{Extension, Path, Query, State},
    http::{HeaderValue, Method, StatusCode, header::HeaderName},
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
use crate::contracts::{token_decimals, ZionContracts};
use crate::error::{MultichainError, MultichainResult};
use crate::node_rewards::{HeartbeatRequest, NodeRecord, PayoutRecord, RegisterNodeRequest};
use crate::audit::{AuditLogger, AuditResult};
use crate::rate_limit::{auth_rate_limit, RateLimiter};
use crate::reconciliation::ReconciliationReport;
use crate::service::MultichainService;
use crate::zis_auth::{address_from_linked, resolve_zis_auth, ZisClient, ZisUser};
use crate::swap::dex::intent::{PathHop, SolverBid, SwapIntent};
use crate::swap::dex::solver_network::HttpSolverClient;
use crate::swap::Pool;
use crate::types::{Transfer, TransferDirection, TransferEndpoint};
use zion_pool::StratumServer;

/// Build the CORS allow-origin list for the multichain HTTP gateway.
/// Defaults to the canonical ZION public domains; override with the
/// comma-separated `ZION_MULTICHAIN_CORS_ORIGINS` environment variable.
fn cors_allowed_origins() -> AllowOrigin {
    let origins: Vec<String> = std::env::var("ZION_MULTICHAIN_CORS_ORIGINS")
        .ok()
        .map(|s| {
            s.split(',')
                .map(|o| o.trim().to_string())
                .filter(|o| !o.is_empty())
                .collect()
        })
        .unwrap_or_else(|| {
            vec![
                "https://zionterranova.com".to_string(),
                "https://app.zionterranova.com".to_string(),
                "https://oasis.zionterranova.com".to_string(),
                "https://market.zionterranova.com".to_string(),
                "https://dashboard.zionterranova.com".to_string(),
                "https://www.newearth.cz".to_string(),
            ]
        });

    let header_values: Vec<HeaderValue> = origins
        .into_iter()
        .filter_map(|o| HeaderValue::from_str(&o).ok())
        .collect();

    if header_values.is_empty() {
        tracing::warn!("ZION_MULTICHAIN_CORS_ORIGINS empty, CORS disabled");
    }

    AllowOrigin::list(header_values)
}

/// Axum state shared by all handlers.
#[derive(Clone)]
pub struct AppState {
    service: Arc<MultichainService>,
    limiter: RateLimiter,
    solver_name: String,
    solver_fee_bps: u16,
    solver_api_key: Option<String>,
    zis_client: ZisClient,
}

/// Resolve the optional `ZisUser` extension. Returns `401` when ZIS auth is
/// enabled and no user was resolved.
fn resolve_auth_user(
    enabled: bool,
    user: Option<Extension<ZisUser>>,
) -> Result<Option<ZisUser>, StatusCode> {
    if enabled && user.is_none() {
        Err(StatusCode::UNAUTHORIZED)
    } else {
        Ok(user.map(|u| u.0))
    }
}

/// Helper to record an audit log from a route handler.
#[allow(clippy::too_many_arguments)]
async fn record_audit(
    audit: &AuditLogger,
    user_id: Option<&str>,
    action: &str,
    resource_type: &str,
    resource_id: Option<&str>,
    details: serde_json::Value,
    result: AuditResult,
    error: Option<&str>,
) {
    if let Err(e) = audit.log(user_id, action, resource_type, resource_id, details, result, error).await {
        tracing::warn!("failed to record audit log: {e}");
    }
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
                            &tpl.target_hex,
                            tpl.block_reward,
                            &template_json,
                        );
                    }
                    Ok(None) => {
                        let header = "00".repeat(80);
                        let target = "f".repeat(64);
                        stratum_broadcast.broadcast_job("zion_1", &header, &target, &target, 6_000_000, "");
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
        let mut config = self.config.clone();
        if config.auth.api_key.is_none() {
            config.auth.api_key = std::env::var("ZION_MULTICHAIN_API_KEY").ok();
        }

        let solver_cfg = self.service.config().solver.clone();
        let zis_url = std::env::var("ZIS_URL")
            .unwrap_or_else(|_| "https://auth.zionterranova.com".to_string());
        let zis_enabled = std::env::var("ZION_MULTICHAIN_ZIS_AUTH")
            .ok()
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);

        // When ZIS auth is enabled, browser/headless callers use ZIS sessions or
        // ZIS API keys; the legacy static multichain API key is no longer required.
        if zis_enabled {
            config.auth.api_key = None;
        }

        let zis_client = ZisClient::new(zis_enabled, zis_url);

        let state = AppState {
            service: Arc::clone(&self.service),
            limiter: RateLimiter::new(&config),
            solver_name: if solver_cfg.name.is_empty() {
                "zion-solver".to_string()
            } else {
                solver_cfg.name
            },
            solver_fee_bps: solver_cfg.fee_bps,
            solver_api_key: solver_cfg.api_key,
            zis_client,
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
            .route("/v1/wallet/derive", post(wallet_derive))
            .route("/v1/wallet/balance", post(wallet_balance))
            .route("/v1/wallet/me", get(wallet_me))
            .route("/v1/wallet/orders", get(wallet_orders))
            .route("/v1/wallet/deposits", get(wallet_deposits))
            .route("/v1/wallet/withdraw", post(wallet_withdraw))
            .route("/v1/wallet/withdrawals", get(wallet_withdrawals))
            .route("/v1/wallet/sign", post(wallet_sign))
            .route("/v1/swap/pool/deploy", post(deploy_pool))
            .route("/v1/swap/bridge", post(deploy_bridge))
            .route("/v1/swap/pools", get(list_pools))
            .route("/v1/swap/quote", post(swap_quote))
            .route("/v1/swap/quote/multi", post(swap_quote_multi))
            .route("/v1/swap/execute", post(swap_execute))
            .route("/v1/swap/execute-v2", post(swap_execute_v2))
            .route("/v1/swap/htlc", post(swap_htlc))
            .route("/v1/swap/order/:id/htlc-source-lock", post(swap_htlc_source_lock))
            .route("/v1/swap/order/:id/htlc-claim", post(swap_htlc_claim))
            .route("/v1/swap/order/:id", get(get_swap_order))
            .route("/v1/swap/intent", post(create_intent))
            .route("/v1/swap/intent/:id", get(get_intent))
            .route("/v1/swap/intent/:id/bid", post(submit_bid))
            .route("/v1/swap/intent/:id/settle", post(settle_intent))
            .route("/v1/swap/intent/:id/execute", post(execute_intent))
            .route("/v1/swap/intent/solver/register", post(register_solver))
            .route("/v1/swap/intent/:id/broadcast", post(broadcast_intent))
            .route("/v1/swap/solve", post(solve_intent))
            .route("/v1/bridge/submit", post(bridge_submit))
            .route("/v1/multichain/swaps/htlc/lock", post(htlc_lock))
            .route("/v1/multichain/swaps/htlc/claim", post(htlc_claim))
            .route("/v1/multichain/swaps/htlc/refund", post(htlc_refund))
            .route("/v1/multichain/swaps/htlc/pending", get(htlc_pending))
            .route("/v1/multichain/swaps/htlc/escrow", get(htlc_escrow))
            .route("/v1/multichain/swaps/htlc/:hash", get(htlc_get))
            .route("/v1/pool/stats", get(pool_stats))
            .route("/v1/pool/payouts", get(pool_payouts))
            .route("/v1/nodes/register", post(register_node))
            .route("/v1/nodes/heartbeat", post(node_heartbeat))
            .route("/v1/nodes", get(list_nodes))
            .route("/v1/nodes/payouts", get(node_reward_payouts))
            .route("/v1/admin/reconciliation", get(get_reconciliation_reports))
            .route("/v1/admin/reconciliation/trigger", post(trigger_reconciliation))
            .layer(axum::middleware::from_fn_with_state(
                state.limiter.clone(),
                auth_rate_limit,
            ))
            .layer(axum::middleware::from_fn_with_state(
                state.zis_client.clone(),
                resolve_zis_auth,
            ))
            .layer(
                CorsLayer::new()
                    .allow_origin(cors_allowed_origins())
                    .allow_methods(AllowMethods::list([
                        Method::GET,
                        Method::POST,
                        Method::OPTIONS,
                    ]))
                    .allow_headers(AllowHeaders::list([
                        HeaderName::from_static("authorization"),
                        HeaderName::from_static("content-type"),
                        HeaderName::from_static("x-dao-key"),
                        HeaderName::from_static("x-warp-key"),
                        HeaderName::from_static("accept"),
                        HeaderName::from_static("cookie"),
                    ]))
                    .allow_credentials(true),
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

        let node_reward_service = Arc::clone(&self.service);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            loop {
                interval.tick().await;
                match node_reward_service.height(ChainId::ZionL1).await {
                    Ok(height) => {
                        if let Err(e) = node_reward_service
                            .node_rewards()
                            .maybe_payout(height)
                            .await
                        {
                            tracing::warn!("node reward payout error: {}", e);
                        }
                    }
                    Err(e) => tracing::warn!("node reward height error: {}", e),
                }
            }
        });

        let deposit_watcher = self.service.deposit_watcher().clone();
        tokio::spawn(async move {
            if let Err(e) = deposit_watcher.run().await {
                tracing::warn!("deposit watcher exited: {}", e);
            }
        });

        let withdrawal_processor = self.service.withdrawal_processor().clone();
        tokio::spawn(async move {
            if let Err(e) = withdrawal_processor.run().await {
                tracing::warn!("withdrawal processor exited: {}", e);
            }
        });

        let reconciler = self.service.reconciler();
        tokio::spawn(async move {
            if let Err(e) = reconciler.run().await {
                tracing::warn!("reconciler exited: {}", e);
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
    user: Option<Extension<ZisUser>>,
    Json(req): Json<WalletAddressRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user = resolve_auth_user(state.zis_client.enabled, user)?;
    let chain = chain_name_to_id(&req.chain).map_err(|_| StatusCode::BAD_REQUEST)?;

    let addr = match user.as_ref().and_then(|u| u.linked_address_for_chain(chain)) {
        Some(linked) => address_from_linked(chain, linked)
            .map_err(|_| StatusCode::BAD_REQUEST)?,
        None => state
            .service
            .wallet_address(chain, req.account, req.index)
            .map_err(|_| StatusCode::BAD_REQUEST)?,
    };

    Ok(Json(serde_json::json!({
        "chain": req.chain,
        "address": addr.encoded,
        "bytes": hex::encode(&addr.bytes),
    })))
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
    user: Option<Extension<ZisUser>>,
    Json(req): Json<WalletSignRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let _user = resolve_auth_user(state.zis_client.enabled, user)?;
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
struct WalletDeriveRequest {
    chain: String,
}

async fn wallet_derive(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Json(req): Json<WalletDeriveRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user = resolve_auth_user(state.zis_client.enabled, user)?;
    let user_id = match user {
        Some(u) => u.id,
        None => return Err(StatusCode::UNAUTHORIZED),
    };
    let chain = chain_name_to_id(&req.chain).map_err(|_| StatusCode::BAD_REQUEST)?;

    let details = serde_json::json!({ "chain": req.chain });

    match state
        .service
        .multichain_wallet()
        .derive_deposit_address(&user_id, chain)
        .await
    {
        Ok(addr) => {
            record_audit(
                state.service.audit(),
                Some(&user_id),
                "wallet_derive",
                "wallet_address",
                Some(&addr.address.encoded),
                details,
                AuditResult::Success,
                None,
            )
            .await;
            Ok(Json(serde_json::json!({
                "chain": req.chain,
                "address": addr.address.encoded,
                "public_key": addr.public_key,
                "derivation_path": addr.derivation_path,
                "purpose": addr.purpose,
                "is_external": addr.is_external,
            })))
        }
        Err(e) => {
            record_audit(
                state.service.audit(),
                Some(&user_id),
                "wallet_derive",
                "wallet_address",
                None,
                details,
                AuditResult::Failure,
                Some(&e.to_string()),
            )
            .await;
            Err(StatusCode::BAD_REQUEST)
        }
    }
}

#[derive(Deserialize)]
struct WalletBalanceRequest {
    asset: String,
}

async fn wallet_balance(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Json(req): Json<WalletBalanceRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user = resolve_auth_user(state.zis_client.enabled, user)?;
    let user_id = match user {
        Some(u) => u.id,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    let asset = asset_from_input(&req.asset).map_err(|_| StatusCode::BAD_REQUEST)?;
    match state
        .service
        .wallet_ledger()
        .balance(&user_id, &asset)
        .await
    {
        Ok(amount) => Ok(Json(serde_json::json!({
            "user_id": user_id,
            "asset_key": asset.id.to_string(),
            "balance": amount.0.to_string(),
        }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

#[derive(Deserialize)]
struct WalletWithdrawRequest {
    asset: String,
    amount: String,
    recipient: String,
}

async fn wallet_withdraw(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Json(req): Json<WalletWithdrawRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let user = resolve_auth_user(state.zis_client.enabled, user).map_err(|status| {
        (status, Json(serde_json::json!({ "error": "unauthorized" })))
    })?;
    let user_id = match user {
        Some(u) => u.id,
        None => return Err((StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "error": "unauthorized" })))),
    };

    let asset = asset_from_input(&req.asset).map_err(|e| {
        (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": e.to_string() })))
    })?;
    let amount = req.amount.parse::<u128>().map_err(|e| {
        (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": format!("invalid amount: {e}") })))
    })?;

    let details = serde_json::json!({
        "asset_key": asset.id.to_string(),
        "amount": amount.to_string(),
        "recipient": req.recipient,
    });

    match state
        .service
        .request_withdraw(&user_id, &asset, Amount::new(amount), &req.recipient)
        .await
    {
        Ok(id) => {
            record_audit(
                state.service.audit(),
                Some(&user_id),
                "wallet_withdraw",
                "withdrawal",
                Some(&id),
                details,
                AuditResult::Success,
                None,
            )
            .await;
            Ok(Json(serde_json::json!({
                "withdrawal_id": id,
                "status": "pending",
            })))
        }
        Err(e) => {
            record_audit(
                state.service.audit(),
                Some(&user_id),
                "wallet_withdraw",
                "withdrawal",
                None,
                details,
                AuditResult::Failure,
                Some(&e.to_string()),
            )
            .await;
            Err((
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": e.to_string(),
                    "message": "withdrawal request failed",
                })),
            ))
        }
    }
}

async fn wallet_withdrawals(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user = resolve_auth_user(state.zis_client.enabled, user)?;
    let user_id = match user {
        Some(u) => u.id,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    match state.service.withdrawals_for_user(&user_id).await {
        Ok(withdrawals) => Ok(Json(serde_json::json!({ "withdrawals": withdrawals }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

async fn wallet_me(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user = resolve_auth_user(state.zis_client.enabled, user)?;
    let user_id = match user {
        Some(u) => u.id,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    match state.service.wallet_me(&user_id).await {
        Ok(snapshot) => Ok(Json(snapshot)),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

async fn wallet_orders(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user = resolve_auth_user(state.zis_client.enabled, user)?;
    let user_id = match user {
        Some(u) => u.id,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    match state.service.orders_for_user(&user_id).await {
        Ok(orders) => Ok(Json(serde_json::json!({ "orders": orders }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

async fn wallet_deposits(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user = resolve_auth_user(state.zis_client.enabled, user)?;
    let user_id = match user {
        Some(u) => u.id,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    match state.service.deposits_for_user(&user_id).await {
        Ok(deposits) => Ok(Json(serde_json::json!({ "deposits": deposits }))),
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
    user: Option<Extension<ZisUser>>,
    Json(req): Json<SwapRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let _user = resolve_auth_user(state.zis_client.enabled, user)?;
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
struct SwapExecuteV2Request {
    from: Asset,
    to: Asset,
    amount: u128,
    #[serde(default)]
    min_amount_out: u128,
    #[serde(default)]
    recipient: Option<String>,
}

async fn swap_execute_v2(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Json(req): Json<SwapExecuteV2Request>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let user = resolve_auth_user(state.zis_client.enabled, user).map_err(|status| {
        (status, Json(serde_json::json!({ "error": "unauthorized" })))
    })?;
    let user_id = match user {
        Some(u) => u.id,
        None => return Err((StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "error": "unauthorized" })))),
    };

    let recipient = match &req.recipient {
        Some(addr) => Some(parse_address_string(addr, req.to.id.chain).map_err(|e| {
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": e.to_string() })))
        })?),
        None => None,
    };

    let details = serde_json::json!({
        "from": req.from,
        "to": req.to,
        "amount": req.amount.to_string(),
        "min_amount_out": req.min_amount_out.to_string(),
        "recipient": req.recipient,
    });

    match state
        .service
        .swap_execute(
            &user_id,
            &req.from,
            &req.to,
            Amount::new(req.amount),
            Amount::new(req.min_amount_out),
            recipient,
        )
        .await
    {
        Ok(order) => {
            record_audit(
                state.service.audit(),
                Some(&user_id),
                "swap_execute_v2",
                "dex_order",
                Some(&order.id),
                details,
                AuditResult::Success,
                None,
            )
            .await;
            Ok(Json(serde_json::json!({
                "order_id": order.id,
                "from": req.from,
                "to": req.to,
                "amount": req.amount.to_string(),
                "amount_out": order.amount_out.0.to_string(),
                "route": order.route,
                "tx_hash": order.tx_hash,
                "status": order.status.to_string(),
            })))
        }
        Err(e) => {
            record_audit(
                state.service.audit(),
                Some(&user_id),
                "swap_execute_v2",
                "dex_order",
                None,
                details,
                AuditResult::Failure,
                Some(&e.to_string()),
            )
            .await;
            Err((
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": e.to_string(),
                    "message": "swap execution failed",
                })),
            ))
        }
    }
}

async fn get_swap_order(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Path(order_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user = resolve_auth_user(state.zis_client.enabled, user)?;
    let _user_id = match user {
        Some(u) => u.id,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    match state.service.get_swap_order(&order_id).await {
        Ok(Some(order)) => Ok(Json(serde_json::json!({
            "order": order,
        }))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

async fn deploy_pool(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Json(pool): Json<Pool>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let _user = resolve_auth_user(state.zis_client.enabled, user)?;
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
struct BridgeEdgeRequest {
    from: Asset,
    to: Asset,
    fee_bps: u16,
}

async fn deploy_bridge(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Json(req): Json<BridgeEdgeRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let _user = resolve_auth_user(state.zis_client.enabled, user)?;
    if req.fee_bps >= 10_000 {
        return Err(StatusCode::BAD_REQUEST);
    }
    state.service.add_bridge_edge(req.from, req.to, req.fee_bps).await;
    Ok(Json(serde_json::json!({"ok": true})))
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
    user: Option<Extension<ZisUser>>,
    Json(req): Json<BridgeRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let _user = resolve_auth_user(state.zis_client.enabled, user)?;
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

async fn htlc_pending(State(state): State<AppState>) -> Json<serde_json::Value> {
    let records = state.service.htlc().pending_records().await;
    Json(serde_json::json!({ "htlcs": records }))
}

async fn htlc_escrow(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    let service = state.service.as_ref();
    let address = service
        .wallet_address(ChainId::ZionL1, 0, 0)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let escrow = format!(
        "SWAP:LOCK:<hash_hex>:<timeout_min>:<chain>:<addr>:{}\n",
        address.encoded
    );
    Ok(Json(serde_json::json!({
        "status": "ok",
        "escrow_address": address.encoded,
        "memo_format": escrow
    })))
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
    /// Optional 32-byte Ed25519 public key for the locker (refund path).
    /// Required for native ZION L1 HTLC scripts.
    #[serde(default)]
    source_pubkey_hex: Option<String>,
    /// Optional 32-byte Ed25519 public key for the claimant (claim path).
    /// Required for native ZION L1 HTLC scripts.
    #[serde(default)]
    target_pubkey_hex: Option<String>,
}

fn bad_request(msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::BAD_REQUEST,
        Json(serde_json::json!({"message": msg})),
    )
}

fn decode_pubkey_hex(hex: &Option<String>) -> Result<Option<[u8; 32]>, (StatusCode, Json<serde_json::Value>)> {
    match hex.as_deref() {
        None | Some("") => Ok(None),
        Some(s) => {
            let bytes = hex::decode(s).map_err(|_| bad_request("invalid pubkey hex"))?;
            bytes.try_into().map_err(|_| bad_request("pubkey must be 32 bytes")).map(Some)
        }
    }
}

async fn htlc_lock(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Json(req): Json<HtlcLockRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let _user = resolve_auth_user(state.zis_client.enabled, user).map_err(|s| (s, Json(serde_json::json!({"message": "unauthorized"}))))?;
    let from_id = chain_name_to_id(&req.from).map_err(|e| bad_request(&e.to_string()))?;
    let to_id = chain_name_to_id(&req.to).map_err(|e| bad_request(&e.to_string()))?;
    let hashlock = Hash::from_hex(&req.hash_hex)
        .ok_or_else(|| bad_request("invalid hash_hex"))?;

    let source = build_endpoint(
        state.service.as_ref(),
        from_id,
        req.source_address,
        req.amount,
        default_ticker(from_id),
    )
    .map_err(|e| bad_request(&e.to_string()))?;
    let target = build_endpoint(
        state.service.as_ref(),
        to_id,
        req.target_address,
        req.amount,
        default_ticker(to_id),
    )
    .map_err(|e| bad_request(&e.to_string()))?;

    let mut transfer = Transfer::new(format!("htlc-lock-{}", req.hash_hex), TransferDirection::Htlc, source, target);
    transfer.hashlock = Some(hashlock);
    transfer.timelock = Some(req.timelock);
    transfer.source_pubkey = decode_pubkey_hex(&req.source_pubkey_hex)?;
    transfer.target_pubkey = decode_pubkey_hex(&req.target_pubkey_hex)?;

    match state.service.htlc().initiate(&mut transfer).await {
        Ok(_) => Ok(Json(serde_json::json!({
            "hash": req.hash_hex,
            "status": transfer.status,
            "transfer_id": transfer.id,
        }))),
        Err(e) => Err(bad_request(&e.to_string())),
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
    user: Option<Extension<ZisUser>>,
    Json(req): Json<HtlcClaimRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let _user = resolve_auth_user(state.zis_client.enabled, user).map_err(|s| (s, Json(serde_json::json!({"message": "unauthorized"}))))?;
    let to_id = chain_name_to_id(&req.to).map_err(|e| bad_request(&e.to_string()))?;
    let hashlock = Hash::from_hex(&req.hash_hex)
        .ok_or_else(|| bad_request("invalid hash_hex"))?;
    let record = state
        .service
        .htlc()
        .get_record(&req.hash_hex)
        .await
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(serde_json::json!({"message": "HTLC not found"}))))?;
    let recipient = req.target_address.unwrap_or(record.counterparty_addr.clone());

    let secret = hex::decode(&req.secret_hex).map_err(|_| bad_request("invalid secret_hex"))?;

    // Build a minimal target endpoint for the adapter; source is irrelevant for claim.
    let source = build_endpoint(
        state.service.as_ref(),
        to_id,
        Some(record.locker_address.clone()),
        record.amount as u128,
        default_ticker(to_id),
    )
    .map_err(|e| bad_request(&e.to_string()))?;
    let target = build_endpoint(
        state.service.as_ref(),
        to_id,
        Some(recipient.clone()),
        record.amount as u128,
        default_ticker(to_id),
    )
    .map_err(|e| bad_request(&e.to_string()))?;

    let mut transfer = Transfer::new(format!("htlc-claim-{}", req.hash_hex), TransferDirection::Htlc, source, target);
    transfer.hashlock = Some(hashlock);

    match state.service.htlc().claim(&secret, &recipient, &mut transfer).await {
        Ok(()) => Ok(Json(serde_json::json!({
            "hash": req.hash_hex,
            "status": transfer.status,
            "recipient": recipient,
        }))),
        Err(e) => Err(bad_request(&e.to_string())),
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
    user: Option<Extension<ZisUser>>,
    Json(req): Json<HtlcRefundRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let _user = resolve_auth_user(state.zis_client.enabled, user).map_err(|s| (s, Json(serde_json::json!({"message": "unauthorized"}))))?;
    let from_id = chain_name_to_id(&req.from).map_err(|e| bad_request(&e.to_string()))?;
    let hashlock = Hash::from_hex(&req.hash_hex)
        .ok_or_else(|| bad_request("invalid hash_hex"))?;
    let record = state
        .service
        .htlc()
        .get_record(&req.hash_hex)
        .await
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(serde_json::json!({"message": "HTLC not found"}))))?;
    let locker = req.source_address.unwrap_or(record.locker_address.clone());

    let source = build_endpoint(
        state.service.as_ref(),
        from_id,
        Some(locker),
        record.amount as u128,
        default_ticker(from_id),
    )
    .map_err(|e| bad_request(&e.to_string()))?;
    // Target is irrelevant for refund; use the source as a placeholder.
    let target = build_endpoint(
        state.service.as_ref(),
        from_id,
        Some(record.counterparty_addr.clone()),
        record.amount as u128,
        default_ticker(from_id),
    )
    .map_err(|e| bad_request(&e.to_string()))?;

    let mut transfer = Transfer::new(format!("htlc-refund-{}", req.hash_hex), TransferDirection::Htlc, source, target);
    transfer.hashlock = Some(hashlock);
    transfer.timelock = Some(record.expires_at as u64);

    match state.service.htlc().refund(&mut transfer).await {
        Ok(()) => Ok(Json(serde_json::json!({
            "hash": req.hash_hex,
            "status": transfer.status,
        }))),
        Err(e) => Err(bad_request(&e.to_string())),
    }
}

#[derive(Deserialize)]
struct HtlcSwapCreateRequest {
    user: String,
    from: Asset,
    to: Asset,
    amount_in: u128,
    #[serde(default)]
    min_amount_out: u128,
    hash_hex: String,
    target_timelock: u64,
    operator_target_address: String,
    target_recipient: String,
    #[serde(default)]
    source_user_address: Option<String>,
    #[serde(default)]
    source_chain: Option<String>,
    #[serde(default)]
    source_amount: Option<u128>,
    #[serde(default)]
    source_timelock: Option<u64>,
    #[serde(default)]
    source_lock_tx_id: Option<String>,
    #[serde(default)]
    source_refund_pubkey_hex: Option<String>,
    #[serde(default)]
    source_claimant_pubkey_hex: Option<String>,
    #[serde(default)]
    target_refund_pubkey_hex: Option<String>,
    #[serde(default)]
    target_claimant_pubkey_hex: Option<String>,
}

async fn swap_htlc(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Json(req): Json<HtlcSwapCreateRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let _user = resolve_auth_user(state.zis_client.enabled, user).map_err(|s| (s, Json(serde_json::json!({"message": "unauthorized"}))))?;

    let hashlock = Hash::from_hex(&req.hash_hex)
        .ok_or_else(|| bad_request("invalid hash_hex"))?;

    let operator_target = parse_address_string(&req.operator_target_address, req.to.id.chain)
        .map_err(|e| bad_request(&e.to_string()))?;
    let target_recipient = parse_address_string(&req.target_recipient, req.to.id.chain)
        .map_err(|e| bad_request(&e.to_string()))?;

    let source_chain = req
        .source_chain
        .as_deref()
        .map(chain_name_to_id)
        .transpose()
        .map_err(|e| bad_request(&e.to_string()))?;

    let htlc_req = crate::swap::dex::swap_executor::HtlcSwapRequest {
        amount_in: Amount::new(req.amount_in),
        min_amount_out: Amount::new(req.min_amount_out),
        hashlock,
        target_timelock: req.target_timelock,
        operator_target_address: operator_target,
        target_recipient,
        source_user_address: req.source_user_address,
        source_chain,
        source_amount: req.source_amount.map(Amount::new),
        source_timelock: req.source_timelock,
        source_lock_tx_id: req.source_lock_tx_id,
        source_refund_pubkey: decode_pubkey_hex(&req.source_refund_pubkey_hex)?,
        source_claimant_pubkey: decode_pubkey_hex(&req.source_claimant_pubkey_hex)?,
        target_refund_pubkey: decode_pubkey_hex(&req.target_refund_pubkey_hex)?,
        target_claimant_pubkey: decode_pubkey_hex(&req.target_claimant_pubkey_hex)?,
    };

    match state
        .service
        .execute_htlc_swap(&req.user, &req.from, &req.to, &htlc_req)
        .await
    {
        Ok(order) => Ok(Json(serde_json::json!({
            "order_id": order.id,
            "status": order.status,
            "amount_out": order.amount_out.0.to_string(),
            "htlc_hash": order.htlc_hash,
            "tx_hash": order.tx_hash,
        }))),
        Err(e) => Err(bad_request(&e.to_string())),
    }
}

#[derive(Deserialize)]
struct HtlcSwapSourceLockRequest {
    source_lock_tx_id: String,
    source_expires_at: u64,
}

async fn swap_htlc_source_lock(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Path(order_id): Path<String>,
    Json(req): Json<HtlcSwapSourceLockRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let _user = resolve_auth_user(state.zis_client.enabled, user).map_err(|s| (s, Json(serde_json::json!({"message": "unauthorized"}))))?;

    match state
        .service
        .record_source_htlc_lock(&order_id, &req.source_lock_tx_id, req.source_expires_at)
        .await
    {
        Ok(order) => Ok(Json(serde_json::json!({
            "order_id": order.id,
            "status": order.status,
        }))),
        Err(e) => Err(bad_request(&e.to_string())),
    }
}

#[derive(Deserialize)]
struct HtlcSwapClaimRequest {
    secret_hex: String,
    source_asset: Asset,
    source_operator_recipient: String,
    #[serde(default)]
    source_user_address: Option<String>,
}

async fn swap_htlc_claim(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Path(order_id): Path<String>,
    Json(req): Json<HtlcSwapClaimRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let _user = resolve_auth_user(state.zis_client.enabled, user).map_err(|s| (s, Json(serde_json::json!({"message": "unauthorized"}))))?;

    let secret = hex::decode(&req.secret_hex).map_err(|_| bad_request("invalid secret_hex"))?;

    let source_operator = parse_address_string(&req.source_operator_recipient, req.source_asset.id.chain)
        .map_err(|e| bad_request(&e.to_string()))?;
    let source_user = req
        .source_user_address
        .as_deref()
        .map(|a| parse_address_string(a, req.source_asset.id.chain))
        .transpose()
        .map_err(|e| bad_request(&e.to_string()))?;

    match state
        .service
        .claim_htlc_swap(
            &order_id,
            &secret,
            &req.source_asset,
            &source_operator,
            source_user.as_ref(),
        )
        .await
    {
        Ok(order) => Ok(Json(serde_json::json!({
            "order_id": order.id,
            "status": order.status,
            "tx_hash": order.tx_hash,
        }))),
        Err(e) => Err(bad_request(&e.to_string())),
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
    user: Option<Extension<ZisUser>>,
    Json(req): Json<CreateIntentRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let _user = resolve_auth_user(state.zis_client.enabled, user)?;
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
    user: Option<Extension<ZisUser>>,
    Json(req): Json<BidRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let _user = resolve_auth_user(state.zis_client.enabled, user)?;
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
    user: Option<Extension<ZisUser>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let _user = resolve_auth_user(state.zis_client.enabled, user)?;
    match state.service.settle_intent(id).await {
        Ok(Some(bid)) => Ok(Json(serde_json::json!({ "winning_bid": bid }))),
        Ok(None) => Ok(Json(serde_json::json!({ "winning_bid": null }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

async fn execute_intent(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let _user = resolve_auth_user(state.zis_client.enabled, user)?;
    match state.service.execute_intent(id).await {
        Ok(Some(out)) => Ok(Json(serde_json::json!({ "executed": true, "out": out.0.to_string() }))),
        Ok(None) => Ok(Json(serde_json::json!({ "executed": false, "out": null }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

#[derive(Deserialize)]
struct RegisterSolverRequest {
    solver: String,
    url: Option<String>,
    #[serde(default)]
    reputation: u64,
}

async fn register_solver(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Json(req): Json<RegisterSolverRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let _user = resolve_auth_user(state.zis_client.enabled, user)?;
    match state
        .service
        .register_solver(req.solver, req.url, req.reputation)
        .await
    {
        Ok(added) => Ok(Json(serde_json::json!({ "registered": added }))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

async fn solve_intent(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    headers: axum::http::HeaderMap,
    Json(intent): Json<SwapIntent>,
) -> Result<Json<SolverBid>, StatusCode> {
    let _user = resolve_auth_user(state.zis_client.enabled, user)?;
    if let Some(expected) = &state.solver_api_key {
        let provided = headers
            .get("X-Solver-Key")
            .and_then(|v| v.to_str().ok());
        if provided != Some(expected) {
            tracing::warn!("solver API key mismatch from {:?}", headers.get("x-forwarded-for"));
            return Err(StatusCode::UNAUTHORIZED);
        }
    }

    if intent.status != crate::swap::dex::intent::IntentStatus::Pending {
        return Err(StatusCode::BAD_REQUEST);
    }

    let from = zion_l1_types::Asset {
        id: intent.from_asset.clone(),
        decimals: token_decimals(
            intent.from_asset.chain.as_str(),
            &intent.from_asset.ticker,
            intent.from_asset.contract.as_deref(),
        ),
        name: intent.from_asset.ticker.clone(),
    };
    let to = zion_l1_types::Asset {
        id: intent.to_asset.clone(),
        decimals: token_decimals(
            intent.to_asset.chain.as_str(),
            &intent.to_asset.ticker,
            intent.to_asset.contract.as_deref(),
        ),
        name: intent.to_asset.ticker.clone(),
    };

    let quote = match state.service.dex_quote(&from, &to, intent.amount_in).await {
        Ok(q) => q,
        Err(_) => return Err(StatusCode::NO_CONTENT),
    };

    if quote.route.len() < 2 {
        return Err(StatusCode::NO_CONTENT);
    }

    let mut path = Vec::with_capacity(quote.route.len().saturating_sub(1));
    for window in quote.route.windows(2) {
        let from_token = window[0].clone();
        let to_token = window[1].clone();
        let is_bridge = from_token.chain != to_token.chain;
        path.push(PathHop {
            chain: from_token.chain.as_str().to_string(),
            dex: if is_bridge { "warp" } else { "amm" }.to_string(),
            from_token,
            to_token,
            is_bridge,
        });
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let bid = SolverBid::new(
        intent.id,
        &state.solver_name,
        quote.expected_out,
        path,
        state.solver_fee_bps,
        now,
    );

    Ok(Json(bid))
}

async fn broadcast_intent(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let _user = resolve_auth_user(state.zis_client.enabled, user)?;
    let mut keys = crate::swap::dex::solver_network::SolverApiKeys::new();
    for entry in &state.service.config().solvers {
        if let Some(key) = &entry.api_key {
            keys.insert(entry.name.clone(), key.clone());
        }
    }
    let client = Arc::new(HttpSolverClient::new().with_solver_api_keys(keys));
    match state.service.broadcast_intent::<HttpSolverClient>(id, client).await {
        Ok(results) => {
            let out: Vec<serde_json::Value> = results
                .into_iter()
                .map(|r| match r {
                    Ok(Some(bid)) => serde_json::json!({
                        "status": "bid",
                        "bid": bid,
                    }),
                    Ok(None) => serde_json::json!({
                        "status": "declined",
                    }),
                    Err(e) => serde_json::json!({
                        "status": "error",
                        "error": e.to_string(),
                    }),
                })
                .collect();
            Ok(Json(serde_json::json!({ "results": out })))
        }
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

fn parse_address_string(encoded: &str, chain: ChainId) -> MultichainResult<Address> {
    let bytes = match chain.family() {
        zion_l1_types::ChainFamily::Evm => {
            let hex = encoded.strip_prefix("0x").unwrap_or(encoded);
            let bytes = hex::decode(hex)
                .map_err(|_| MultichainError::Internal("invalid evm address hex".to_string()))?;
            if bytes.len() != 20 {
                return Err(MultichainError::Validation("evm address must be 20 bytes".to_string()));
            }
            bytes
        }
        zion_l1_types::ChainFamily::Solana | zion_l1_types::ChainFamily::Near => {
            bs58::decode(encoded)
                .into_vec()
                .map_err(|_| MultichainError::Validation("invalid base58 address".to_string()))?
        }
        _ => Vec::new(),
    };
    Ok(Address::new(chain, bytes, encoded)?)
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

/// Parse a wallet/swap asset input. Accepts either a full asset key
/// (`chain:ticker` or `chain:ticker:contract`) or a bare chain name, in
/// which case the canonical native ticker for that chain is used.
fn asset_from_input(key: &str) -> MultichainResult<Asset> {
    if key.contains(':') {
        let (chain, ticker, contract) = crate::service::parse_asset_key(key)?;
        match contract {
            Some(c) => {
                let decimals = token_decimals(chain.as_str(), &ticker, Some(&c));
                Ok(Asset::with_contract(chain, ticker.clone(), c, decimals, ticker))
            }
            None => Ok(Asset::native(
                chain,
                ticker.clone(),
                chain.decimals(),
                ticker,
            )),
        }
    } else {
        let chain = chain_name_to_id(key)?;
        let ticker = default_ticker(chain);
        Ok(Asset::native(chain, ticker, chain.decimals(), ticker))
    }
}

async fn register_node(
    State(state): State<AppState>,
    user: Option<Extension<ZisUser>>,
    Json(req): Json<RegisterNodeRequest>,
) -> Result<Json<NodeRecord>, StatusCode> {
    let user = user.ok_or(StatusCode::UNAUTHORIZED)?;
    match state.service.node_rewards().register(user.0.id, req).await
    {
        Ok(record) => Ok(Json(record)),
        Err(e) => {
            tracing::warn!("node register failed: {e}");
            Err(StatusCode::BAD_REQUEST)
        }
    }
}

async fn node_heartbeat(
    State(state): State<AppState>,
    Json(req): Json<HeartbeatRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.service.node_rewards().heartbeat(req).await {
        Ok(()) => Ok(Json(serde_json::json!({ "ok": true }))),
        Err(e) => {
            tracing::warn!("node heartbeat failed: {e}");
            Err(StatusCode::BAD_REQUEST)
        }
    }
}

async fn list_nodes(State(state): State<AppState>) -> Result<Json<Vec<NodeRecord>>, StatusCode> {
    tracing::info!("list_nodes handler called");
    match state.service.node_rewards().list_active_nodes().await {
        Ok(nodes) => Ok(Json(nodes)),
        Err(e) => {
            tracing::warn!("list active nodes failed: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn node_reward_payouts(
    State(state): State<AppState>,
) -> Result<Json<Vec<PayoutRecord>>, StatusCode> {
    match state.service.node_rewards().list_payouts().await {
        Ok(payouts) => Ok(Json(payouts)),
        Err(e) => {
            tracing::warn!("list node reward payouts failed: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Deserialize)]
struct ReconciliationQuery {
    #[serde(default = "default_reconciliation_limit")]
    limit: usize,
}

fn default_reconciliation_limit() -> usize {
    50
}

async fn get_reconciliation_reports(
    State(state): State<AppState>,
    Query(query): Query<ReconciliationQuery>,
) -> Result<Json<Vec<ReconciliationReport>>, StatusCode> {
    match state.service.reconciliation_reports(query.limit).await {
        Ok(reports) => Ok(Json(reports)),
        Err(e) => {
            tracing::warn!("list reconciliation reports failed: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn trigger_reconciliation(
    State(state): State<AppState>,
) -> Result<Json<Vec<ReconciliationReport>>, StatusCode> {
    let reconciler = state.service.reconciler();
    match reconciler.reconcile().await {
        Ok(reports) => Ok(Json(reports)),
        Err(e) => {
            tracing::warn!("manual reconciliation failed: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
