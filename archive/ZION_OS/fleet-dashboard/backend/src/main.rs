use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::sync::Arc;
use tracing::{info, warn};

mod routes;

#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub version: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Rig {
    pub id: String,
    pub name: String,
    pub status: String, // online, offline, mining, error, maintenance
    pub ip_address: Option<String>,
    pub tailscale_ip: Option<String>,
    pub location: Option<String>,
    pub gpu_count: i32,
    pub total_hashrate: f64,
    pub power_watts: f64,
    pub uptime_sec: i64,
    pub last_seen: String,
    pub flight_sheet_id: Option<String>,
    pub oc_profile_id: Option<String>,
    pub tags: String, // JSON array jako string
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FlightSheet {
    pub id: String,
    pub name: String,
    pub coin: String,
    pub algorithm: String,
    pub pool_url: String,
    pub wallet: String,
    pub worker_template: String,
    pub gpu_backend: String,
    pub miner_args: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Command {
    pub id: String,
    pub rig_id: String,
    pub command_type: String,
    pub payload: String,
    pub status: String, // pending, acked, completed, failed
    pub created_at: String,
    pub acked_at: Option<String>,
    pub completed_at: Option<String>,
    pub result: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Alert {
    pub id: String,
    pub rig_id: String,
    pub severity: String, // info, warning, critical
    pub message: String,
    pub rule_name: Option<String>,
    pub acknowledged: bool,
    pub created_at: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::new("zion_fleet=info,tower_http=debug"))
        .init();

    info!("=== ZION Fleet Dashboard v1.0.0 ===");

    // Inicializace SQLite
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./zion-fleet.db".to_string());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    // Migrations
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS rigs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'offline',
            ip_address TEXT,
            tailscale_ip TEXT,
            location TEXT,
            gpu_count INTEGER DEFAULT 0,
            total_hashrate REAL DEFAULT 0,
            power_watts REAL DEFAULT 0,
            uptime_sec INTEGER DEFAULT 0,
            last_seen TEXT,
            flight_sheet_id TEXT,
            oc_profile_id TEXT,
            tags TEXT DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS flight_sheets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            coin TEXT,
            algorithm TEXT,
            pool_url TEXT,
            wallet TEXT,
            worker_template TEXT,
            gpu_backend TEXT,
            miner_args TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS commands (
            id TEXT PRIMARY KEY,
            rig_id TEXT NOT NULL,
            command_type TEXT NOT NULL,
            payload TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT,
            acked_at TEXT,
            completed_at TEXT,
            result TEXT
        );

        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            rig_id TEXT NOT NULL,
            severity TEXT NOT NULL,
            message TEXT NOT NULL,
            rule_name TEXT,
            acknowledged INTEGER DEFAULT 0,
            created_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_rigs_status ON rigs(status);
        CREATE INDEX IF NOT EXISTS idx_commands_rig ON commands(rig_id, status);
        CREATE INDEX IF NOT EXISTS idx_alerts_rig ON alerts(rig_id, acknowledged);
        "#
    )
    .execute(&pool)
    .await?;

    let state = Arc::new(AppState {
        db: pool,
        version: "1.0.0".to_string(),
    });

    let app = Router::new()
        .route("/api/status", get(status_handler))
        .route("/api/rigs", get(routes::rigs::list_rigs).post(routes::rigs::create_rig))
        .route("/api/rigs/:id", get(routes::rigs::get_rig).patch(routes::rigs::update_rig).delete(routes::rigs::delete_rig))
        .route("/api/rigs/:id/telemetry", post(routes::rigs::receive_telemetry))
        .route("/api/flight-sheets", get(routes::flight_sheets::list).post(routes::flight_sheets::create))
        .route("/api/flight-sheets/:id", get(routes::flight_sheets::get).patch(routes::flight_sheets::update).delete(routes::flight_sheets::delete))
        .route("/api/commands", get(routes::commands::list).post(routes::commands::create))
        .route("/api/commands/:id/ack", post(routes::commands::ack))
        .route("/api/commands/:id/result", post(routes::commands::result))
        .route("/api/commands/pending", get(routes::commands::pending))
        .route("/api/alerts", get(routes::alerts::list).post(routes::alerts::create))
        .route("/api/alerts/:id/ack", post(routes::alerts::ack))
        .route("/health", get(|| async { "OK" }))
        .with_state(state);

    let bind = std::env::var("BIND").unwrap_or_else(|_| "0.0.0.0:8080".to_string());
    let listener = tokio::net::TcpListener::bind(&bind).await?;
    info!("Fleet Dashboard nasloucha na {}", bind);

    axum::serve(listener, app).await?;
    Ok(())
}

async fn status_handler(State(state): State<Arc<AppState>>) -> Json<Value> {
    let rig_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rigs")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    let online_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rigs WHERE status = 'online' OR status = 'mining'")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    Json(json!({
        "version": state.version,
        "rig_count": rig_count,
        "online_count": online_count,
        "status": "healthy"
    }))
}
