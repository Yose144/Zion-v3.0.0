use crate::{AppState, Command};
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
pub struct CreateCommandRequest {
    pub rig_id: String,
    pub command_type: String,
    pub payload: Option<String>,
}

#[derive(Deserialize)]
pub struct AckRequest {
    pub status: String,
}

#[derive(Deserialize)]
pub struct ResultRequest {
    pub success: bool,
    pub output: Option<String>,
}

pub async fn list(State(state): State<Arc<AppState>>) -> Json<Vec<Command>> {
    let rows = sqlx::query(
        "SELECT id, rig_id, command_type, payload, status, created_at, acked_at, completed_at, result FROM commands ORDER BY created_at DESC LIMIT 100"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let commands = rows.into_iter().map(|r| Command {
        id: r.get("id"),
        rig_id: r.get("rig_id"),
        command_type: r.get("command_type"),
        payload: r.get("payload"),
        status: r.get("status"),
        created_at: r.get("created_at"),
        acked_at: r.get("acked_at"),
        completed_at: r.get("completed_at"),
        result: r.get("result"),
    }).collect();

    Json(commands)
}

pub async fn create(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateCommandRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = uuid::Uuid::new_v4().to_string();
    info!("Command enqueue: {} -> {} ({})", id, req.rig_id, req.command_type);

    match sqlx::query(
        "INSERT INTO commands (id, rig_id, command_type, payload, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)"
    )
    .bind(&id)
    .bind(&req.rig_id)
    .bind(&req.command_type)
    .bind(&req.payload)
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

pub async fn pending(State(state): State<Arc<AppState>>) -> Json<Vec<Command>> {
    let rows = sqlx::query(
        "SELECT id, rig_id, command_type, payload, status, created_at, acked_at, completed_at, result FROM commands WHERE status = 'pending' ORDER BY created_at ASC"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let commands = rows.into_iter().map(|r| Command {
        id: r.get("id"),
        rig_id: r.get("rig_id"),
        command_type: r.get("command_type"),
        payload: r.get("payload"),
        status: r.get("status"),
        created_at: r.get("created_at"),
        acked_at: r.get("acked_at"),
        completed_at: r.get("completed_at"),
        result: r.get("result"),
    }).collect();

    Json(commands)
}

pub async fn ack(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(_req): Json<AckRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match sqlx::query("UPDATE commands SET status = 'acked', acked_at = ? WHERE id = ?")
        .bind(chrono::Utc::now().to_rfc3339())
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

pub async fn result(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(req): Json<ResultRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let status = if req.success { "completed" } else { "failed" };
    match sqlx::query("UPDATE commands SET status = ?, completed_at = ?, result = ? WHERE id = ?")
        .bind(status)
        .bind(chrono::Utc::now().to_rfc3339())
        .bind(&req.output)
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
