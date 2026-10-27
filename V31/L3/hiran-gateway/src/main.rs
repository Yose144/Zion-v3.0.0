//! zion-hiran-gateway — OpenAI-compatible paid inference API.
//! B2B-3 / F2 per docs/3.2/B2B_HIRAN_API_MVP_SPEC.md.
//!
//! Loopback service behind EDGE2 nginx (api.zionterranova.com).
//! Auth: ZIS API keys (X-API-Key → /api/keys/verify). Metering: SQLite.

mod auth;
mod config;
mod error;
mod meter;
mod models;
mod proxy;
mod routes;

use axum::{
    routing::{get, post},
    Router,
};
use meter::key_hash;
use proxy::AppState;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,zion_hiran_gateway=info".into()),
        )
        .init();

    let cfg = config::GatewayConfig::from_env()?;
    let catalog = models::Catalog::load(&cfg.models_path, cfg.probe_cache_secs)?;
    let meter = meter::Meter::open(&cfg.db_path)?;

    let client = reqwest::Client::builder()
        .pool_max_idle_per_host(16)
        .build()?;

    let state = Arc::new(AppState {
        auth: auth::Auth::new(&cfg.zis_verify_url, cfg.auth_cache_secs),
        catalog,
        meter,
        client,
        timeout: std::time::Duration::from_secs(cfg.timeout_secs),
        fallback_timeout: std::time::Duration::from_secs(cfg.fallback_timeout_secs),
        admin_key_hash: cfg.admin_key.as_deref().map(key_hash),
    });

    let app = Router::new()
        .route("/health", get(routes::health))
        .route("/v1/models", get(routes::list_models))
        .route("/v1/chat/completions", post(proxy::chat_completions))
        .route("/v1/completions", post(proxy::completions))
        .route("/v1/usage", get(routes::usage))
        .route("/v1/admin/plan", post(routes::set_plan))
        .route("/v1/admin/plans", get(routes::list_plans))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&cfg.bind).await?;
    info!(bind = %cfg.bind, "hiran-gateway listening");
    axum::serve(listener, app).await?;
    Ok(())
}
