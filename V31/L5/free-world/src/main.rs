//! ZION Free World Daemon — V3 L5 Humanitarian Layer
//!
//! ## Usage
//! ```sh
//! cargo run --bin zion-free-world
//!
//! # Override via env vars
//! FREE_WORLD_PORT=8095 \
//! FREE_WORLD_DB=./free_world.db \
//! FREE_WORLD_L1_RPC=http://127.0.0.1:9445/jsonrpc \
//! FREE_WORLD_HUMANITARIAN_ADDRESS=zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8 \
//! cargo run --bin zion-free-world
//! ```

use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::Mutex;

use axum::http::Method;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{error, info};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

use zion_free_world::api::{free_world_router, AppState};
use zion_free_world::config::FreeWorldConfig;
use zion_free_world::db::FreeWorldDb;
use zion_free_world::hiran_bridge::FreeWorldHiranBridge;
use zion_free_world::l1_scanner::{L1Scanner, ScannerConfig};
use zion_free_world::metrics::FreeWorldMetrics;

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_default_env().add_directive("zion_free_world=info".parse().unwrap()))
        .init();

    info!(
        "🌍 ZION Free World Daemon v{} starting...",
        env!("CARGO_PKG_VERSION")
    );

    let cfg = FreeWorldConfig::load(None);
    info!(
        "Config: name={} api_port={} db={}",
        cfg.name, cfg.port, cfg.db_path
    );

    let fw_db = match FreeWorldDb::open(&cfg.db_path) {
        Ok(db) => {
            info!("DB opened at {}", cfg.db_path);
            db
        }
        Err(e) => {
            error!("Failed to open DB at {}: {}", cfg.db_path, e);
            std::process::exit(1);
        }
    };
    let db = Arc::new(Mutex::new(fw_db));

    let metrics = Arc::new(FreeWorldMetrics::new());

    // Hydrate the count/fund gauges from the DB — the atomics otherwise
    // restart at zero and drift from reality until the next mutation.
    {
        use std::sync::atomic::Ordering::Relaxed;
        let db = db.lock().unwrap();
        if let Ok(counts) = db.grant_status_counts() {
            let get = |s: &str| {
                counts
                    .iter()
                    .find(|(k, _)| k == s)
                    .map(|(_, n)| *n)
                    .unwrap_or(0)
            };
            metrics.grants_pending.store(get("pending"), Relaxed);
            metrics.grants_approved.store(get("approved"), Relaxed);
            metrics.grants_disbursed.store(get("disbursed"), Relaxed);
        }
        if let Ok(counts) = db.project_status_counts() {
            let active: u64 = counts
                .iter()
                .filter(|(s, _)| s == "active")
                .map(|(_, n)| *n)
                .sum();
            metrics.projects_active.store(active, Relaxed);
        }
        if let Ok(b) = db.get_fund_balance() {
            metrics.total_accumulated_zion.store(
                b.total_accumulated / zion_free_world::metrics::FLOWERS_PER_ZION,
                Relaxed,
            );
            metrics.total_disbursed_zion.store(
                b.total_disbursed / zion_free_world::metrics::FLOWERS_PER_ZION,
                Relaxed,
            );
        }
    }

    info!(
        "📊 Prometheus metrics: http://{}:{}/metrics",
        cfg.bind, cfg.port
    );

    let hiran = Arc::new(FreeWorldHiranBridge::new(&cfg));
    if cfg.hiran_enabled {
        info!(
            "🤖 Hiran AI enabled — endpoint: {}",
            cfg.hiran_endpoint
                .as_deref()
                .unwrap_or("http://localhost:8002")
        );
    } else {
        info!("Hiran AI disabled (set FREE_WORLD_HIRAN_ENABLED=true to enable)");
    }

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    let state = AppState {
        db: Arc::clone(&db),
        api_key: cfg.api_key.clone(),
        metrics: Arc::clone(&metrics),
        hiran,
        config: cfg.clone(),
    };

    let app = free_world_router(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = format!("{}:{}", cfg.bind, cfg.port)
        .parse()
        .expect("Invalid bind/port in Free World config");

    info!("HTTP API listening on http://{}", addr);

    let scanner_cfg = ScannerConfig {
        rpc_url: cfg.l1_rpc_url.clone(),
        poll_interval: std::time::Duration::from_secs(cfg.scan_interval_secs),
        fund_address: cfg.humanitarian_fund_address.clone(),
        finality_blocks: 6,
    };
    let scanner = L1Scanner::new(scanner_cfg, Arc::clone(&db), Arc::clone(&metrics));

    let scanner_handle = tokio::spawn(async move {
        scanner.run().await;
    });

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind TCP listener");

    let server_handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            error!("HTTP server error: {}", e);
        }
    });

    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install ctrl+c handler");

    info!("Shutdown signal received — exiting...");
    scanner_handle.abort();
    server_handle.abort();
}
