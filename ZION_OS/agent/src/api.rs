use crate::{AgentState, StartMinerRequest, StatusResponse};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::info;

/// GET /api/nodes/discovered
pub async fn discovered_nodes_handler(State(state): State<Arc<AgentState>>) -> Json<Value> {
    let nodes = state.discovery.nodes.read().await;
    let list: Vec<_> = nodes.values().cloned().collect();
    Json(json!({
        "count": list.len(),
        "nodes": list,
    }))
}

/// GET /api/nodes/rewards
pub async fn node_rewards_handler(State(state): State<Arc<AgentState>>) -> Json<Value> {
    let rewards = state.discovery.rewards.read().await;
    let total_points: u64 = rewards.iter().map(|r| r.reward_points).sum();
    Json(json!({
        "total_points": total_points,
        "adoptions": rewards.len(),
        "rewards": rewards.clone(),
    }))
}

/// GET /api/status
pub async fn status_handler(State(state): State<Arc<AgentState>>) -> Json<StatusResponse> {
    let miner_running = state.miner_pid.read().await.is_some();
    let gpu_count = crate::gpu_telemetry::collect_all().await.len();
    Json(StatusResponse {
        rig_id: state.rig_id.clone(),
        version: state.version.clone(),
        uptime_sec: 0, // TODO: track real uptime
        mode: if state.config.read().await.autonomous_mode {
            "autonomous".to_string()
        } else {
            "manual".to_string()
        },
        miner_running,
        gpu_count,
    })
}

/// POST /api/miner/start
pub async fn start_miner_handler(
    State(state): State<Arc<AgentState>>,
    Json(req): Json<StartMinerRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    info!("API: start miner pozadavek");
    match crate::miner_ctl::start_miner(state, Some(req)).await {
        Ok(pid) => Ok(Json(json!({"status": "ok", "pid": pid }))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e.to_string() })),
        )),
    }
}

/// POST /api/miner/stop
pub async fn stop_miner_handler(
    State(state): State<Arc<AgentState>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    info!("API: stop miner pozadavek");
    match crate::miner_ctl::stop_miner(state).await {
        Ok(_) => Ok(Json(json!({"status": "ok" }))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e.to_string() })),
        )),
    }
}

/// POST /api/miner/restart
pub async fn restart_miner_handler(
    State(state): State<Arc<AgentState>>,
    Json(req): Json<StartMinerRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    info!("API: restart miner pozadavek");
    match crate::miner_ctl::restart_miner(state, Some(req)).await {
        Ok(pid) => Ok(Json(json!({"status": "ok", "pid": pid }))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e.to_string() })),
        )),
    }
}

/// GET /api/gpu
pub async fn gpu_handler(_state: State<Arc<AgentState>>) -> Json<Value> {
    let gpus = crate::gpu_telemetry::collect_all().await;
    Json(json!({"gpus": gpus}))
}

/// GET /api/telemetry
pub async fn telemetry_handler(State(state): State<Arc<AgentState>>) -> Json<Value> {
    let config = state.config.read().await;
    Json(json!({
        "rig_id": state.rig_id,
        "telemetry_enabled": config.telemetry.enabled,
        "miner": {
            "pool": config.miner.default_pool,
            "backend": config.miner.default_gpu_backend,
        }
    }))
}

/// GET /api/config
pub async fn get_config_handler(State(state): State<Arc<AgentState>>) -> Json<Value> {
    let config = state.config.read().await;
    Json(serde_json::to_value(&*config).unwrap_or_default())
}

/// POST /api/config
pub async fn post_config_handler(
    State(state): State<Arc<AgentState>>,
    Json(new_config): Json<crate::config::AgentConfig>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    info!("API: update config pozadavek");
    if let Err(e) = crate::config::save_config(&new_config).await {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e.to_string() })),
        ));
    }
    *state.config.write().await = new_config;
    Ok(Json(json!({"status": "ok" })))
}

// Command queue stub (plna implementace v command_queue.rs)
pub async fn pending_commands_handler(State(_state): State<Arc<AgentState>>) -> Json<Value> {
    Json(json!({"commands": []}))
}

#[derive(Deserialize)]
pub struct AckRequest {
    pub status: String,
}

pub async fn ack_command_handler(
    Path(_id): Path<String>,
    State(_state): State<Arc<AgentState>>,
    Json(_req): Json<AckRequest>,
) -> Json<Value> {
    Json(json!({"status": "acknowledged"}))
}

#[derive(Deserialize)]
pub struct ResultRequest {
    pub success: bool,
    pub output: Option<String>,
}

pub async fn command_result_handler(
    Path(_id): Path<String>,
    State(_state): State<Arc<AgentState>>,
    Json(_req): Json<ResultRequest>,
) -> Json<Value> {
    Json(json!({"status": "recorded"}))
}
