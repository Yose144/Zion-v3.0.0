use crate::{AppState, Alert};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
use tracing::info;

#[derive(Deserialize)]
pub struct CreateAlertRequest {
    pub rig_id: String,
    pub severity: String,
    pub message: String,
    pub rule_name: Option<String>,
}

#[derive(Deserialize)]
pub struct AckAlertRequest {
    pub acknowledged: bool,
}

pub async fn list(State(state): State<Arc<AppState>>) -> Json<Vec<Alert>> {
    let rows = sqlx::query(
        "SELECT id, rig_id, severity, message, rule_name, acknowledged, created_at FROM alerts ORDER BY created_at DESC LIMIT 100"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let alerts = rows.into_iter().map(|r| Alert {
        id: r.get("id"),
        rig_id: r.get("rig_id"),
        severity: r.get("severity"),
        message: r.get("message"),
        rule_name: r.get("rule_name"),
        acknowledged: r.get::<i32, _>("acknowledged") != 0,
        created_at: r.get("created_at"),
    }).collect();

    Json(alerts)
}

pub async fn create(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateAlertRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = uuid::Uuid::new_v4().to_string();
    info!("Alert: {} [{}] — {}", req.rig_id, req.severity, req.message);

    match sqlx::query(
        "INSERT INTO alerts (id, rig_id, severity, message, rule_name, acknowledged, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)"
    )
    .bind(&id)
    .bind(&req.rig_id)
    .bind(&req.severity)
    .bind(&req.message)
    .bind(&req.rule_name)
    .bind(chrono::Utc::now().to_rfc3339())
    .execute(&state.db)
    .await {
        Ok(_) => Ok(Json(json!({"status": "ok", "id": id}))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e.to_string() })),
        )),
    }
}

pub async fn ack(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(_req): Json<AckAlertRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match sqlx::query("UPDATE alerts SET acknowledged = 1 WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await {
        Ok(_) => Ok(Json(json!({"status": "ok"}))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e.to_string() })),
        )),
    }
}
