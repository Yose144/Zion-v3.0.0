use crate::{AppState, FlightSheet};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

#[derive(Deserialize)]
pub struct CreateFlightSheet {
    pub name: String,
    pub coin: String,
    pub algorithm: String,
    pub pool_url: String,
    pub wallet: String,
    pub worker_template: String,
    pub gpu_backend: String,
    pub miner_args: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateFlightSheet {
    pub name: Option<String>,
    pub pool_url: Option<String>,
    pub wallet: Option<String>,
    pub gpu_backend: Option<String>,
    pub miner_args: Option<String>,
}

pub async fn list(State(state): State<Arc<AppState>>) -> Json<Vec<FlightSheet>> {
    let rows = sqlx::query(
        "SELECT id, name, coin, algorithm, pool_url, wallet, worker_template, gpu_backend, miner_args, created_at FROM flight_sheets"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let sheets = rows.into_iter().map(|r| FlightSheet {
        id: r.get("id"),
        name: r.get("name"),
        coin: r.get("coin"),
        algorithm: r.get("algorithm"),
        pool_url: r.get("pool_url"),
        wallet: r.get("wallet"),
        worker_template: r.get("worker_template"),
        gpu_backend: r.get("gpu_backend"),
        miner_args: r.get("miner_args"),
        created_at: r.get("created_at"),
    }).collect();

    Json(sheets)
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<FlightSheet>, StatusCode> {
    let row = sqlx::query(
        "SELECT id, name, coin, algorithm, pool_url, wallet, worker_template, gpu_backend, miner_args, created_at FROM flight_sheets WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match row {
        Some(r) => Ok(Json(FlightSheet {
            id: r.get("id"),
            name: r.get("name"),
            coin: r.get("coin"),
            algorithm: r.get("algorithm"),
            pool_url: r.get("pool_url"),
            wallet: r.get("wallet"),
            worker_template: r.get("worker_template"),
            gpu_backend: r.get("gpu_backend"),
            miner_args: r.get("miner_args"),
            created_at: r.get("created_at"),
        })),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn create(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateFlightSheet>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = uuid::Uuid::new_v4().to_string();
    match sqlx::query(
        "INSERT INTO flight_sheets (id, name, coin, algorithm, pool_url, wallet, worker_template, gpu_backend, miner_args, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&req.name)
    .bind(&req.coin)
    .bind(&req.algorithm)
    .bind(&req.pool_url)
    .bind(&req.wallet)
    .bind(&req.worker_template)
    .bind(&req.gpu_backend)
    .bind(&req.miner_args.unwrap_or_default())
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

pub async fn update(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateFlightSheet>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut updates = vec![];
    let mut params: Vec<String> = vec![];

    if let Some(v) = &req.name { updates.push("name = ?"); params.push(v.clone()); }
    if let Some(v) = &req.pool_url { updates.push("pool_url = ?"); params.push(v.clone()); }
    if let Some(v) = &req.wallet { updates.push("wallet = ?"); params.push(v.clone()); }
    if let Some(v) = &req.gpu_backend { updates.push("gpu_backend = ?"); params.push(v.clone()); }
    if let Some(v) = &req.miner_args { updates.push("miner_args = ?"); params.push(v.clone()); }

    if updates.is_empty() {
        return Ok(Json(json!({"status": "ok", "message": "no changes"})));
    }

    let sql = format!("UPDATE flight_sheets SET {} WHERE id = ?", updates.join(", "));
    let mut query = sqlx::query(&sql);
    for p in &params { query = query.bind(p); }
    query = query.bind(&id);

    match query.execute(&state.db).await {
        Ok(_) => Ok(Json(json!({"status": "ok"}))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e.to_string() })),
        )),
    }
}

pub async fn delete(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match sqlx::query("DELETE FROM flight_sheets WHERE id = ?").bind(&id).execute(&state.db).await {
        Ok(_) => Ok(Json(json!({"status": "ok"}))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e.to_string() })),
        )),
    }
}
