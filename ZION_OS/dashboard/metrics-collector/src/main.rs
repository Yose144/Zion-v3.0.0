//! ZION Metrics Collector — polls L3 endpoints and serves aggregated metrics
//!
//! ## Endpoints
//!
//! ```text
//! GET /metrics          → Prometheus-compatible text format
//! GET /health           → JSON { "status": "ok" }
//! GET /api/l3/summary   → Aggregated L3 status
//! ```
//!
//! ## Usage
//!
//! ```bash
//! AI_NATIVE_URL=http://localhost:8460 \
//! WARP_URL=http://localhost:8460 \
//! NCL_URL=http://localhost:8460 \
//! POLL_INTERVAL_SECS=10 \
//! BIND=0.0.0.0:8470 \
//! cargo run --release
//! ```

use axum::{extract::State, routing::get, Router};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// Snapshot of L3 endpoint data.
#[derive(Debug, Clone, Default, Serialize)]
struct L3Snapshot {
    chains_count: usize,
    transfers_count: usize,
    agents_count: usize,
    active_jobs: usize,
    node_height: u64,
    pool_hashrate: f64,
    active_miners: usize,
    pending_transfers: usize,
    last_poll: String,
    offline: bool,
}

/// Shared state between the polling task and HTTP handlers.
struct AppState {
    snapshot: Mutex<L3Snapshot>,
    ai_native_url: String,
    warp_url: String,
    ncl_url: String,
    poll_interval_secs: u64,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let ai_native_url = std::env::var("AI_NATIVE_URL").unwrap_or_else(|_| "http://localhost:8460".into());
    let warp_url = std::env::var("WARP_URL").unwrap_or_else(|_| "http://localhost:8460".into());
    let ncl_url = std::env::var("NCL_URL").unwrap_or_else(|_| "http://localhost:8460".into());
    let poll_interval_secs = std::env::var("POLL_INTERVAL_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(10);
    let bind = std::env::var("BIND")
        .unwrap_or_else(|_| "0.0.0.0:8470".into())
        .parse::<SocketAddr>()
        .expect("invalid BIND address");

    let state = Arc::new(AppState {
        snapshot: Mutex::new(L3Snapshot::default()),
        ai_native_url,
        warp_url,
        ncl_url,
        poll_interval_secs,
    });

    // Spawn background polling task
    let poll_state = state.clone();
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        let mut interval = tokio::time::interval(Duration::from_secs(poll_state.poll_interval_secs));
        interval.tick().await; // skip immediate first tick

        loop {
            interval.tick().await;
            let snap = poll_all(&client, &poll_state).await;
            let mut guard = poll_state.snapshot.lock().unwrap();
            *guard = snap;
        }
    });

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/metrics", get(metrics_handler))
        .route("/api/l3/summary", get(summary_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(bind).await.unwrap();
    tracing::info!(%bind, "metrics_collector_ready");
    axum::serve(listener, app).await.unwrap();
}

async fn poll_all(client: &reqwest::Client, state: &AppState) -> L3Snapshot {
    let mut snap = L3Snapshot::default();
    snap.last_poll = Utc::now().to_rfc3339();

    // Poll WARP chains
    match client.get(format!("{}/chains", state.warp_url)).send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<Vec<serde_json::Value>>().await {
                snap.chains_count = json.len();
            }
        }
        Err(e) => tracing::debug!("warp chains poll failed: {}", e),
    }

    // Poll WARP transfers
    match client.get(format!("{}/transfers", state.warp_url)).send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<Vec<serde_json::Value>>().await {
                snap.transfers_count = json.len();
            }
        }
        Err(e) => tracing::debug!("warp transfers poll failed: {}", e),
    }

    // Poll AI agents
    match client.get(format!("{}/agents", state.ai_native_url)).send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<Vec<serde_json::Value>>().await {
                snap.agents_count = json.len();
            }
        }
        Err(e) => tracing::debug!("ai agents poll failed: {}", e),
    }

    // Poll AI telemetry
    match client.get(format!("{}/telemetry", state.ai_native_url)).send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                snap.node_height = json["node_height"].as_u64().unwrap_or(0);
                snap.pool_hashrate = json["pool_hashrate"].as_f64().unwrap_or(0.0);
                snap.active_miners = json["active_miners"].as_u64().unwrap_or(0) as usize;
                snap.pending_transfers = json["pending_transfers"].as_u64().unwrap_or(0) as usize;
            }
        }
        Err(e) => tracing::debug!("telemetry poll failed: {}", e),
    }

    // Poll NCL jobs
    match client.get(format!("{}/ncl/jobs", state.ncl_url)).send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<Vec<serde_json::Value>>().await {
                snap.active_jobs = json.len();
            }
        }
        Err(e) => tracing::debug!("ncl jobs poll failed: {}", e),
    }

    snap.offline = snap.chains_count == 0 && snap.agents_count == 0 && snap.active_jobs == 0;
    snap
}

async fn health_handler(State(_state): State<Arc<AppState>>) -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({ "status": "ok" }))
}

async fn metrics_handler(State(state): State<Arc<AppState>>) -> String {
    let snap = state.snapshot.lock().unwrap().clone();
    format!(
        "# HELP zion_l3_chains_total Number of registered WARP chains\n\
         # TYPE zion_l3_chains_total gauge\n\
         zion_l3_chains_total {}\n\
         # HELP zion_l3_transfers_total Number of WARP transfers\n\
         # TYPE zion_l3_transfers_total gauge\n\
         zion_l3_transfers_total {}\n\
         # HELP zion_l3_agents_total Number of AI agents\n\
         # TYPE zion_l3_agents_total gauge\n\
         zion_l3_agents_total {}\n\
         # HELP zion_l3_jobs_total Number of NCL jobs\n\
         # TYPE zion_l3_jobs_total gauge\n\
         zion_l3_jobs_total {}\n\
         # HELP zion_l3_node_height Current node block height\n\
         # TYPE zion_l3_node_height gauge\n\
         zion_l3_node_height {}\n\
         # HELP zion_l3_pool_hashrate Pool hashrate in H/s\n\
         # TYPE zion_l3_pool_hashrate gauge\n\
         zion_l3_pool_hashrate {:.2}\n\
         # HELP zion_l3_active_miners Number of active pool miners\n\
         # TYPE zion_l3_active_miners gauge\n\
         zion_l3_active_miners {}\n",
        snap.chains_count,
        snap.transfers_count,
        snap.agents_count,
        snap.active_jobs,
        snap.node_height,
        snap.pool_hashrate,
        snap.active_miners,
    )
}

async fn summary_handler(State(state): State<Arc<AppState>>) -> axum::Json<L3Snapshot> {
    axum::Json(state.snapshot.lock().unwrap().clone())
}
