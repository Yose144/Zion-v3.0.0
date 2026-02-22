//! ZION DAO Daemon
//!
//! Runs two concurrent services:
//!   1. L1 Scanner — polls L1 blockchain for DAO governance memos
//!   2. HTTP API   — serves REST endpoints on :8080 (configurable)
//!
//! ## Usage
//!
//! ```sh
//! # Default (DB at ./dao.db, API on :8080, L1 RPC at http://77.42.31.72:8444/jsonrpc)
//! cargo run --bin zion-dao
//!
//! # Override via env vars
//! DAO_DB_PATH=/var/lib/zion/dao.db \
//! DAO_API_PORT=9090 \
//! DAO_L1_RPC=http://localhost:8444/jsonrpc \
//! ZION_DAO_API_KEY=my-secret \
//! cargo run --bin zion-dao
//! ```

use std::env;
use std::net::SocketAddr;
use std::sync::Arc;

use axum::http::Method;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{error, info};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

use zion_dao::api::{dao_router, AppState};
use zion_dao::config::DaoConfig;
use zion_dao::db::DaoDb;
use zion_dao::l1_scanner::{L1Scanner, ScannerConfig};

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    // Logging
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_default_env().add_directive("zion_dao=info".parse().unwrap()))
        .init();

    info!("ZION DAO Daemon v2.9.6 starting...");

    // ── Config from env ────────────────────────────────────────────────────
    let db_path   = env::var("DAO_DB_PATH").unwrap_or_else(|_| "./dao.db".into());
    let api_port  = env::var("DAO_API_PORT").unwrap_or_else(|_| "8080".into());
    let l1_rpc    = env::var("DAO_L1_RPC")
        .unwrap_or_else(|_| "http://77.42.31.72:8444/jsonrpc".into());
    let api_key   = env::var("ZION_DAO_API_KEY")
        .unwrap_or_else(|_| {
            tracing::warn!("ZION_DAO_API_KEY not set — write endpoints disabled");
            "".into()
        });

    // ── Open SQLite DB ─────────────────────────────────────────────────────
    let dao_db = match DaoDb::open(&db_path) {
        Ok(db) => {
            info!("DB opened at {}", db_path);
            db
        }
        Err(e) => {
            error!("Failed to open DB at {}: {}", db_path, e);
            std::process::exit(1);
        }
    };
    let db = Arc::new(Mutex::new(dao_db));

    // ── Load config (minimal, uses defaults for now) ───────────────────────
    let dao_config = Arc::new(DaoConfig::default());

    // ── Build Axum app ─────────────────────────────────────────────────────
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    let state = AppState {
        db: Arc::clone(&db),
        config: Arc::clone(&dao_config),
        api_key: api_key.clone(),
    };

    let app = dao_router(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    // ── Bind address ───────────────────────────────────────────────────────
    let addr: SocketAddr = format!("0.0.0.0:{}", api_port)
        .parse()
        .expect("Invalid DAO_API_PORT");

    info!("HTTP API listening on http://{}", addr);

    // ── Start L1 scanner ───────────────────────────────────────────────────
    let scanner_cfg = ScannerConfig {
        rpc_url: l1_rpc.clone(),
        ..ScannerConfig::default()
    };
    let scanner = L1Scanner::new(scanner_cfg, Arc::clone(&db));

    let scanner_handle = tokio::spawn(async move {
        scanner.run().await;
    });

    // ── Start HTTP server ──────────────────────────────────────────────────
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind TCP listener");

    let server_handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            error!("HTTP server error: {}", e);
        }
    });

    // ── Graceful shutdown ──────────────────────────────────────────────────
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install ctrl+c handler");

    info!("Shutdown signal received — exiting...");
    scanner_handle.abort();
    server_handle.abort();
}
