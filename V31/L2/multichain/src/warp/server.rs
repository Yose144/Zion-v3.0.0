//! # WARP REST API Server — L3
//!
//! Axum HTTP server exposing the WARP bridge router via REST.
//!
//! ## Endpoints
//!
//! | Method | Path                       | Description                  |
//! |--------|----------------------------|------------------------------|
//! | GET    | `/health`                  | Liveness check               |
//! | GET    | `/metrics`                 | Prometheus metrics (JSON with `Accept: application/json`) |
//! | GET    | `/chains`                  | Registered chains            |
//! | GET    | `/transfers`               | List transfers (newest first) |
//! | GET    | `/transfers/pending`       | Pending transfers only       |
//! | GET    | `/transfers/:id`           | Single transfer by UUID      |
//! | POST   | `/transfers/outbound`      | Initiate outbound transfer   |
//! | POST   | `/transfers/inbound`       | Initiate inbound transfer    |
//! | POST   | `/transfers/:id/advance`   | Advance transfer state       |

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use tracing::info;
use uuid::Uuid;

use crate::warp::config::WarpConfig;
use crate::warp::db::TransferDb;
use crate::warp::fees::FeeEngine;
use crate::warp::protocol::DepositProof;
use crate::warp::registry::ChainRegistry;
use crate::warp::router::WarpRouter;
use crate::warp::types::WarpStatus;
use crate::warp::validator::WarpValidatorSet;

// ─────────────────────────────────────────────────────────────────────────────
// Shared state
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct WarpState {
    pub router: Arc<Mutex<WarpRouter>>,
    pub config: WarpConfig,
    /// Optional SQLite persistence — None = in-memory only (dev mode).
    pub db: Option<TransferDb>,
    /// Static key required on mutating routes (`x-warp-key` header).
    /// Populated from `WARP_API_KEY` in `create_router`; unset = writes disabled.
    pub api_key: Option<String>,
}

impl WarpState {
    /// Create state with in-memory router and NO persistence.
    pub fn new(config: WarpConfig) -> Self {
        let registry = ChainRegistry::from_config(&config.chains).unwrap_or_else(|e| {
            tracing::warn!("[warpd] Failed to load registry from config, using defaults: {e}");
            ChainRegistry::with_defaults()
        });
        let fee_engine = FeeEngine::with_defaults();
        let validator_set = Arc::new(Mutex::new(WarpValidatorSet::new(config.quorum)));
        let router = WarpRouter::with_options(
            registry,
            fee_engine,
            validator_set.clone(),
            Some(config.l1_rpc_url.clone()),
            12,
        );

        Self {
            router: Arc::new(Mutex::new(router)),
            config,
            db: None,
            api_key: None,
        }
    }

    /// Create state with SQLite persistence at `db_path`.
    pub fn with_db(config: WarpConfig, db_path: &str) -> crate::warp::error::WarpResult<Self> {
        let db = TransferDb::open(db_path)?;
        let registry = ChainRegistry::with_defaults();
        let fee_engine = FeeEngine::with_defaults();
        let validator_set = Arc::new(Mutex::new(WarpValidatorSet::new(config.quorum)));
        // WarpRouter::with_db loads existing transfers from the DB.
        let finality_blocks = config
            .chains
            .iter()
            .find(|c| c.name == "zion-l1")
            .map(|c| c.finality_blocks)
            .unwrap_or(12);
        let router = WarpRouter::with_db(
            registry,
            fee_engine,
            validator_set,
            db.clone(),
            Some(config.l1_rpc_url.clone()),
            finality_blocks,
        )?;
        Ok(Self {
            router: Arc::new(Mutex::new(router)),
            config,
            db: Some(db),
            api_key: None,
        })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Router factory
// ─────────────────────────────────────────────────────────────────────────────

pub fn create_router(mut state: WarpState) -> Router {
    // An explicitly-configured key on the state wins (used by tests/embedders);
    // otherwise fall back to the WARP_API_KEY environment variable.
    if state.api_key.is_none() {
        state.api_key = std::env::var("WARP_API_KEY")
            .ok()
            .filter(|k| !k.is_empty());
    }
    if state.api_key.is_none() {
        tracing::warn!("[warpd] WARP_API_KEY unset — mutating API routes disabled");
    }
    // Mutating routes are gated before body parsing.
    let writes = Router::new()
        .route("/transfers/outbound", post(initiate_outbound))
        .route("/transfers/inbound", post(initiate_inbound))
        .route("/transfers/:id/advance", post(advance_transfer))
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            warp_write_auth,
        ));
    Router::new()
        .route("/health", get(health))
        .route("/metrics", get(metrics))
        .route("/chains", get(chains))
        .route("/transfers", get(list_transfers))
        .route("/transfers/pending", get(list_pending))
        .route("/transfers/:id", get(get_transfer))
        .merge(writes)
        .with_state(state)
}

// ─────────────────────────────────────────────────────────────────────────────
// Request / response types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct HealthResponse {
    ok: bool,
    node: String,
    transfers_total: usize,
    transfers_pending: usize,
    version: &'static str,
}

#[derive(Debug, Deserialize)]
pub struct InitiateOutboundRequest {
    pub proof: DepositProof,
}

#[derive(Debug, Deserialize)]
pub struct InitiateInboundRequest {
    pub source_chain: String,
    pub proof: DepositProof,
    pub recipient_zion: String,
}

#[derive(Debug, Deserialize)]
pub struct AdvanceRequest {
    pub new_status: WarpStatusInput,
}

/// String form of WarpStatus sent via HTTP.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WarpStatusInput {
    Detected,
    AwaitingFinality,
    Validating,
    QuorumReached,
    Executing,
    Completed,
    Failed,
    TimelockHold,
}

impl From<WarpStatusInput> for WarpStatus {
    fn from(s: WarpStatusInput) -> Self {
        match s {
            WarpStatusInput::Detected => WarpStatus::Detected,
            WarpStatusInput::AwaitingFinality => WarpStatus::AwaitingFinality,
            WarpStatusInput::Validating => WarpStatus::Validating,
            WarpStatusInput::QuorumReached => WarpStatus::QuorumReached,
            WarpStatusInput::Executing => WarpStatus::Executing,
            WarpStatusInput::Completed => WarpStatus::Completed,
            WarpStatusInput::Failed => WarpStatus::Failed,
            WarpStatusInput::TimelockHold => WarpStatus::TimelockHold,
        }
    }
}

#[derive(Debug, Serialize)]
struct ApiOk<T: Serialize> {
    ok: bool,
    data: T,
}

impl<T: Serialize> ApiOk<T> {
    fn new(data: T) -> Self {
        Self { ok: true, data }
    }
}

#[derive(Debug, Serialize)]
struct ApiErr {
    ok: bool,
    error: String,
}

impl ApiErr {
    fn new(msg: impl Into<String>) -> (StatusCode, Json<ApiErr>) {
        (
            StatusCode::BAD_REQUEST,
            Json(ApiErr {
                ok: false,
                error: msg.into(),
            }),
        )
    }

    fn with_status(status: StatusCode, msg: impl Into<String>) -> (StatusCode, Json<ApiErr>) {
        (
            status,
            Json(ApiErr {
                ok: false,
                error: msg.into(),
            }),
        )
    }
}

fn warp_key_eq(expected: &str, provided: &str) -> bool {
    if expected.len() != provided.len() {
        return false;
    }
    expected
        .as_bytes()
        .iter()
        .zip(provided.as_bytes())
        .fold(0u8, |diff, (a, b)| diff | (a ^ b))
        == 0
}

/// Mutating routes require `x-warp-key` matching `WARP_API_KEY`.
/// Unset key -> 503 (writes disabled); missing/wrong key -> 401.
fn require_warp_key(
    state: &WarpState,
    headers: &HeaderMap,
) -> Result<(), (StatusCode, Json<ApiErr>)> {
    let Some(expected) = state.api_key.as_deref() else {
        return Err(ApiErr::with_status(
            StatusCode::SERVICE_UNAVAILABLE,
            "warp write API disabled (WARP_API_KEY unset)",
        ));
    };
    let provided = headers
        .get("x-warp-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();
    if warp_key_eq(expected, provided) {
        Ok(())
    } else {
        Err(ApiErr::with_status(StatusCode::UNAUTHORIZED, "unauthorized"))
    }
}

async fn warp_write_auth(
    State(state): State<WarpState>,
    headers: HeaderMap,
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    match require_warp_key(&state, &headers) {
        Ok(()) => next.run(req).await,
        Err(resp) => resp.into_response(),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

async fn health(State(s): State<WarpState>) -> impl IntoResponse {
    let r = s.router.lock().await;
    Json(HealthResponse {
        ok: true,
        node: s.config.node_id.clone(),
        transfers_total: r.transfer_count(),
        transfers_pending: r.pending_count(),
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn metrics(State(s): State<WarpState>, headers: HeaderMap) -> impl IntoResponse {
    let r = s.router.lock().await;
    let accepts_json = headers
        .get(header::ACCEPT)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.contains("application/json"))
        .unwrap_or(false);

    if accepts_json {
        Json(r.metrics.snapshot()).into_response()
    } else {
        let body = r.metrics.prometheus_output(&s.config.node_id);
        (
            StatusCode::OK,
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/plain; version=0.0.4; charset=utf-8"),
            )],
            body,
        )
            .into_response()
    }
}

async fn chains(State(s): State<WarpState>) -> impl IntoResponse {
    let r = s.router.lock().await;
    Json(ApiOk::new(r.registry.list_chain_status()))
}

async fn list_transfers(State(s): State<WarpState>) -> impl IntoResponse {
    let r = s.router.lock().await;
    Json(ApiOk::new(r.list_transfers()))
}

async fn list_pending(State(s): State<WarpState>) -> impl IntoResponse {
    let r = s.router.lock().await;
    Json(ApiOk::new(r.list_pending()))
}

async fn get_transfer(State(s): State<WarpState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let r = s.router.lock().await;
    match r.get_transfer(&id) {
        Some(t) => Json(ApiOk::new(t.clone())).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(ApiErr {
                ok: false,
                error: format!("Transfer {} not found", id),
            }),
        )
            .into_response(),
    }
}

async fn initiate_outbound(
    State(s): State<WarpState>,
    Json(req): Json<InitiateOutboundRequest>,
) -> impl IntoResponse {
    let mut r = s.router.lock().await;
    match r.initiate_outbound(req.proof) {
        Ok(id) => {
            info!(transfer_id = %id, "Outbound transfer initiated via API");
            if let (Some(db), Some(t)) = (&s.db, r.get_transfer(&id)) {
                let _ = db.save(t);
            }
            Json(ApiOk::new(serde_json::json!({ "transfer_id": id }))).into_response()
        }
        Err(e) => ApiErr::new(e.to_string()).into_response(),
    }
}

async fn initiate_inbound(
    State(s): State<WarpState>,
    Json(req): Json<InitiateInboundRequest>,
) -> impl IntoResponse {
    let mut r = s.router.lock().await;
    match r.initiate_inbound(&req.source_chain, req.proof, &req.recipient_zion) {
        Ok(id) => {
            info!(transfer_id = %id, "Inbound transfer initiated via API");
            if let (Some(db), Some(t)) = (&s.db, r.get_transfer(&id)) {
                let _ = db.save(t);
            }
            Json(ApiOk::new(serde_json::json!({ "transfer_id": id }))).into_response()
        }
        Err(e) => ApiErr::new(e.to_string()).into_response(),
    }
}

async fn advance_transfer(
    State(s): State<WarpState>,
    Path(id): Path<Uuid>,
    Json(req): Json<AdvanceRequest>,
) -> impl IntoResponse {
    let mut r = s.router.lock().await;
    let new_status: WarpStatus = req.new_status.into();
    match r.advance_transfer(id, new_status) {
        Ok(()) => {
            if let (Some(db), Some(t)) = (&s.db, r.get_transfer(&id)) {
                let json = serde_json::to_string(t).unwrap_or_default();
                let _ = db.update_status(&id, new_status, &json);
            }
            Json(ApiOk::new(
                serde_json::json!({ "transfer_id": id, "advanced": true }),
            ))
            .into_response()
        }
        Err(e) => ApiErr::new(e.to_string()).into_response(),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;

    fn make_state() -> WarpState {
        WarpState::new(WarpConfig::default())
    }

    #[tokio::test]
    async fn test_health_endpoint() {
        let app = create_router(make_state());
        let res = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_metrics_endpoint() {
        let app = create_router(make_state());
        let res = app
            .oneshot(
                Request::builder()
                    .uri("/metrics")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_chains_endpoint() {
        let app = create_router(make_state());
        let res = app
            .oneshot(
                Request::builder()
                    .uri("/chains")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_list_transfers_empty() {
        let app = create_router(make_state());
        let res = app
            .oneshot(
                Request::builder()
                    .uri("/transfers")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_get_transfer_not_found() {
        let app = create_router(make_state());
        let id = Uuid::new_v4();
        let res = app
            .oneshot(
                Request::builder()
                    .uri(format!("/transfers/{}", id))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_list_pending_empty() {
        let app = create_router(make_state());
        let res = app
            .oneshot(
                Request::builder()
                    .uri("/transfers/pending")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_chains_endpoint_returns_all_13_families() {
        let app = create_router(make_state());
        let res = app
            .oneshot(
                Request::builder()
                    .uri("/chains")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["ok"], true);
        let chains = json["data"].as_array().unwrap();
        // All 13 chain families should be registered
        assert!(
            chains.len() >= 13,
            "expected at least 13 chains, got {}",
            chains.len()
        );
    }

    fn post_req(uri: &str, key: Option<&str>, body: &str) -> Request<Body> {
        let mut b = Request::builder()
            .method("POST")
            .uri(uri)
            .header("content-type", "application/json");
        if let Some(k) = key {
            b = b.header("x-warp-key", k);
        }
        b.body(Body::from(body.to_string())).unwrap()
    }

    #[tokio::test]
    async fn test_write_routes_disabled_without_key() {
        // WARP_API_KEY is not used by any other test in this binary.
        std::env::remove_var("WARP_API_KEY");
        let app = create_router(make_state());
        for uri in [
            "/transfers/outbound",
            "/transfers/inbound",
            "/transfers/00000000-0000-0000-0000-000000000000/advance",
        ] {
            let res = app
                .clone()
                .oneshot(post_req(uri, Some("k"), "{}"))
                .await
                .unwrap();
            assert_eq!(
                res.status(),
                StatusCode::SERVICE_UNAVAILABLE,
                "{uri} must reject writes when WARP_API_KEY is unset"
            );
        }
    }

    #[tokio::test]
    async fn test_write_routes_key_matrix() {
        let mut state = make_state();
        state.api_key = Some("warp-secret".to_string());
        let app = create_router(state);
        let uri = "/transfers/00000000-0000-0000-0000-000000000000/advance";
        let body = r#"{"new_status":"validating"}"#;

        // Missing key -> 401.
        let res = app
            .clone()
            .oneshot(post_req(uri, None, body))
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["ok"], false);
        assert_eq!(json["error"], "unauthorized");

        // Wrong key -> 401.
        let res = app
            .clone()
            .oneshot(post_req(uri, Some("wrong"), body))
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

        // Right key -> passes auth (transfer not found -> 400).
        let res = app
            .oneshot(post_req(uri, Some("warp-secret"), body))
            .await
            .unwrap();
        assert_ne!(res.status(), StatusCode::UNAUTHORIZED);
        assert_ne!(res.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[test]
    fn test_require_warp_key_direct() {
        let mut state = make_state();
        let mut h = HeaderMap::new();
        // Unset -> 503.
        let (status, Json(err)) = require_warp_key(&state, &h).unwrap_err();
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(err.error, "warp write API disabled (WARP_API_KEY unset)");

        state.api_key = Some("k1".to_string());
        // Missing -> 401.
        assert_eq!(
            require_warp_key(&state, &h).unwrap_err().0,
            StatusCode::UNAUTHORIZED
        );
        // Wrong -> 401.
        h.insert("x-warp-key", "k2".parse().unwrap());
        assert_eq!(
            require_warp_key(&state, &h).unwrap_err().0,
            StatusCode::UNAUTHORIZED
        );
        // Right -> ok.
        h.insert("x-warp-key", "k1".parse().unwrap());
        assert!(require_warp_key(&state, &h).is_ok());
    }

    #[tokio::test]
    async fn test_health_returns_version() {
        let app = create_router(make_state());
        let res = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["ok"], true);
        assert!(json["version"].as_str().is_some());
        assert_eq!(json["transfers_total"], 0);
        assert_eq!(json["transfers_pending"], 0);
    }
}
