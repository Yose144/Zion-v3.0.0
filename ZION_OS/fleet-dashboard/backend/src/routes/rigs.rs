use crate::{AppState, Rig};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
use tracing::{info, warn};

#[derive(Deserialize)]
pub struct CreateRigRequest {
    pub name: String,
    pub location: Option<String>,
    pub tailscale_ip: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct UpdateRigRequest {
    pub name: Option<String>,
    pub status: Option<String>,
    pub flight_sheet_id: Option<String>,
    pub oc_profile_id: Option<String>,
    pub location: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct TelemetryPayload {
    pub rig_id: String,
    pub timestamp: String,
    pub system: crate::routes::rigs::SystemMetrics,
    pub gpu: Vec<crate::routes::rigs::GpuMetrics>,
    pub miner: crate::routes::rigs::MinerMetrics,
}

#[derive(Deserialize, Serialize)]
pub struct SystemMetrics {
    pub uptime_sec: i64,
    pub cpu_percent: f32,
    pub memory_used_mb: i64,
    pub memory_total_mb: i64,
    pub load_avg_1m: f32,
}

#[derive(Deserialize, Serialize)]
pub struct GpuMetrics {
    pub index: i32,
    pub name: String,
    pub temperature: f32,
    pub fan_percent: i32,
    pub power_watts: f32,
    pub utilization_percent: i32,
    pub hashrate: Option<f64>,
}

#[derive(Deserialize, Serialize)]
pub struct MinerMetrics {
    pub running: bool,
    pub hashrate: f64,
    pub shares_accepted: i64,
    pub shares_rejected: i64,
    pub pool_connected: bool,
}

pub async fn list_rigs(State(state): State<Arc<AppState>>) -> Json<Vec<Rig>> {
    let rows = sqlx::query(
        "SELECT id, name, status, ip_address, tailscale_ip, location, gpu_count, total_hashrate, power_watts, uptime_sec, last_seen, flight_sheet_id, oc_profile_id, tags FROM rigs"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let rigs: Vec<Rig> = rows
        .into_iter()
        .map(|r| Rig {
            id: r.get("id"),
            name: r.get("name"),
            status: r.get("status"),
            ip_address: r.get("ip_address"),
            tailscale_ip: r.get("tailscale_ip"),
            location: r.get("location"),
            gpu_count: r.get("gpu_count"),
            total_hashrate: r.get("total_hashrate"),
            power_watts: r.get("power_watts"),
            uptime_sec: r.get("uptime_sec"),
            last_seen: r.get("last_seen"),
            flight_sheet_id: r.get("flight_sheet_id"),
            oc_profile_id: r.get("oc_profile_id"),
            tags: r.get("tags"),
        })
        .collect();

    Json(rigs)
}

pub async fn create_rig(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateRigRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = format!("rig-{}", uuid::Uuid::new_v4().to_string()[..8].to_string());
    let tags = serde_json::to_string(&req.tags.unwrap_or_default()).unwrap_or_else(|_| "[]".to_string());

    let result = sqlx::query(
        "INSERT INTO rigs (id, name, status, location, tailscale_ip, tags, last_seen) VALUES (?, ?, 'offline', ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&req.name)
    .bind(&req.location)
    .bind(&req.tailscale_ip)
    .bind(&tags)
    .bind(chrono::Utc::now().to_rfc3339())
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => Ok(Json(json!({"status": "ok", "id": id}))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e.to_string() })),
        )),
    }
}

pub async fn get_rig(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Rig>, StatusCode> {
    let row = sqlx::query(
        "SELECT id, name, status, ip_address, tailscale_ip, location, gpu_count, total_hashrate, power_watts, uptime_sec, last_seen, flight_sheet_id, oc_profile_id, tags FROM rigs WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match row {
        Some(r) => Ok(Json(Rig {
            id: r.get("id"),
            name: r.get("name"),
            status: r.get("status"),
            ip_address: r.get("ip_address"),
            tailscale_ip: r.get("tailscale_ip"),
            location: r.get("location"),
            gpu_count: r.get("gpu_count"),
            total_hashrate: r.get("total_hashrate"),
            power_watts: r.get("power_watts"),
            uptime_sec: r.get("uptime_sec"),
            last_seen: r.get("last_seen"),
            flight_sheet_id: r.get("flight_sheet_id"),
            oc_profile_id: r.get("oc_profile_id"),
            tags: r.get("tags"),
        })),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn update_rig(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateRigRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut updates = vec![];
    let mut params: Vec<String> = vec![];

    if let Some(name) = &req.name {
        updates.push("name = ?");
        params.push(name.clone());
    }
    if let Some(status) = &req.status {
        updates.push("status = ?");
        params.push(status.clone());
    }
    if let Some(fs) = &req.flight_sheet_id {
        updates.push("flight_sheet_id = ?");
        params.push(fs.clone());
    }
    if let Some(oc) = &req.oc_profile_id {
        updates.push("oc_profile_id = ?");
        params.push(oc.clone());
    }
    if let Some(loc) = &req.location {
        updates.push("location = ?");
        params.push(loc.clone());
    }
    if let Some(tags) = &req.tags {
        updates.push("tags = ?");
        params.push(serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string()));
    }

    if updates.is_empty() {
        return Ok(Json(json!({"status": "ok", "message": "no changes"})));
    }

    let sql = format!(
        "UPDATE rigs SET {} WHERE id = ?",
        updates.join(", ")
    );

    let mut query = sqlx::query(&sql);
    for param in &params {
        query = query.bind(param);
    }
    query = query.bind(&id);

    match query.execute(&state.db).await {
        Ok(_) => Ok(Json(json!({"status": "ok"}))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e.to_string() })),
        )),
    }
}

pub async fn delete_rig(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match sqlx::query("DELETE FROM rigs WHERE id = ?").bind(&id).execute(&state.db).await {
        Ok(_) => Ok(Json(json!({"status": "ok"}))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e.to_string() })),
        )),
    }
}

pub async fn receive_telemetry(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<TelemetryPayload>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let total_hashrate: f64 = payload.gpu.iter().map(|g| g.hashrate.unwrap_or(0.0)).sum();
    let power_watts: f64 = payload.gpu.iter().map(|g| g.power_watts as f64).sum();
    let gpu_count = payload.gpu.len() as i32;

    let result = sqlx::query(
        "UPDATE rigs SET status = ?, total_hashrate = ?, power_watts = ?, gpu_count = ?, uptime_sec = ?, last_seen = ? WHERE id = ?"
    )
    .bind(if payload.miner.running { "mining" } else { "online" })
    .bind(total_hashrate)
    .bind(power_watts)
    .bind(gpu_count)
    .bind(payload.system.uptime_sec)
    .bind(&payload.timestamp)
    .bind(&id)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => Ok(Json(json!({"status": "ok"}))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e.to_string() })),
        )),
    }
}
