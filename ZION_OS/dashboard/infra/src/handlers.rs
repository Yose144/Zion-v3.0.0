use axum::{
    extract::{Path, Query, State, ws::{Message, WebSocket, WebSocketUpgrade}},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;

use crate::state::*;

// ─── GET /api/overview ───

pub async fn overview(State(state): State<Arc<AppState>>) -> Json<DashboardOverview> {
    let pool = fetch_pool_stats(&state).await.unwrap_or_default();
    let rigs = state.rigs.read().await;

    let rigs_online = rigs.iter().filter(|r| r.status != RigStatus::Offline).count();
    let rigs_mining = rigs.iter().filter(|r| r.status == RigStatus::Mining).count();
    let rigs_offline = rigs.iter().filter(|r| r.status == RigStatus::Offline).count();
    let total_hashrate: f64 = rigs.iter().map(|r| r.stats.hashrate).sum();
    let total_accepted: u64 = rigs.iter().map(|r| r.stats.accepted).sum();
    let total_rejected: u64 = rigs.iter().map(|r| r.stats.rejected).sum();
    let uptime_sum: u64 = rigs.iter().map(|r| r.stats.uptime_s).sum();
    let uptime_avg = if rigs.is_empty() { 0 } else { uptime_sum / rigs.len() as u64 };

    Json(DashboardOverview {
        pool,
        rigs_total: rigs.len(),
        rigs_online,
        rigs_mining,
        rigs_offline,
        total_hashrate,
        total_accepted,
        total_rejected,
        uptime_avg_s: uptime_avg,
    })
}

// ─── GET /api/rigs ───

pub async fn list_rigs(State(state): State<Arc<AppState>>) -> Json<Vec<RigState>> {
    let rigs = state.rigs.read().await;
    Json(rigs.clone())
}

// ─── GET /api/rigs/:id ───

pub async fn get_rig(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<RigState>, StatusCode> {
    let rigs = state.rigs.read().await;
    rigs.iter()
        .find(|r| r.id == id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

// ─── POST /api/rigs/:id/action ───

pub async fn rig_action(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(action): Json<RigAction>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut rigs = state.rigs.write().await;
    let rig = rigs.iter_mut().find(|r| r.id == id).ok_or(StatusCode::NOT_FOUND)?;

    let now = chrono::Utc::now().timestamp();

    match action.action.as_str() {
        "start" => {
            rig.status = RigStatus::Mining;
            push_log(&state, &id, "info", "Miner started").await;
        }
        "stop" => {
            rig.status = RigStatus::Stopped;
            push_log(&state, &id, "info", "Miner stopped").await;
        }
        "restart" => {
            rig.status = RigStatus::Mining;
            push_log(&state, &id, "info", "Miner restarted").await;
        }
        "reboot" => {
            rig.status = RigStatus::Offline;
            push_log(&state, &id, "warn", "Rig rebooting…").await;
        }
        "config" => {
            if let Ok(cfg) = serde_json::from_value::<RigConfig>(action.params.clone()) {
                rig.config = cfg;
                push_log(&state, &id, "info", "Config updated").await;
            } else {
                return Ok(Json(serde_json::json!({"ok": false, "error": "invalid config"})));
            }
        }
        _ => {
            return Ok(Json(serde_json::json!({"ok": false, "error": "unknown action"})));
        }
    }

    rig.last_seen = now;
    let status = format!("{:?}", rig.status).to_lowercase();
    let action_name = action.action.clone();
    drop(rigs);

    let _ = state.live_tx.send(serde_json::to_string(&LiveEvent {
        event_type: "rig_action".into(),
        data: serde_json::json!({
            "rig_id": id,
            "action": action_name.clone(),
            "status": status,
            "timestamp": now,
        }),
    }).unwrap_or_default());

    persist_state(&state).await;

    Ok(Json(serde_json::json!({"ok": true, "action": action_name})))
}

// ─── POST /api/rigs ─── (register new rig)

pub async fn register_rig(
    State(state): State<Arc<AppState>>,
    Json(rig): Json<RigState>,
) -> (StatusCode, Json<serde_json::Value>) {
    let mut rigs = state.rigs.write().await;
    if rigs.iter().any(|r| r.id == rig.id) {
        return (StatusCode::CONFLICT, Json(serde_json::json!({"ok": false, "error": "rig already registered"})));
    }
    let id = rig.id.clone();
    rigs.push(rig);
    drop(rigs);
    push_log(&state, &id, "info", "Rig registered").await;
    persist_state(&state).await;
    (StatusCode::CREATED, Json(serde_json::json!({"ok": true, "id": id})))
}

// ─── DELETE /api/rigs/:id ───

pub async fn remove_rig(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut rigs = state.rigs.write().await;
    let len_before = rigs.len();
    rigs.retain(|r| r.id != id);
    if rigs.len() == len_before {
        return Err(StatusCode::NOT_FOUND);
    }
    drop(rigs);
    push_log(&state, &id, "info", "Rig removed").await;
    persist_state(&state).await;
    Ok(Json(serde_json::json!({"ok": true})))
}

// ─── PUT /api/rigs/:id/telemetry ─── (miner reports in)

#[derive(serde::Deserialize)]
pub struct TelemetryReport {
    pub hashrate: f64,
    pub accepted: u64,
    pub rejected: u64,
    pub uptime_s: u64,
    pub difficulty: u64,
    pub total_hashes: u64,
    pub gpu_temp_c: Option<f64>,
    pub gpu_power_w: Option<f64>,
    pub gpu_fan_pct: Option<u32>,
}

pub async fn update_telemetry(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(t): Json<TelemetryReport>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let now = chrono::Utc::now().timestamp();

    let mut rigs = state.rigs.write().await;
    let rig = rigs.iter_mut().find(|r| r.id == id).ok_or(StatusCode::NOT_FOUND)?;

    // Detect new shares for timeline events
    let prev_accepted = rig.stats.accepted;
    let prev_rejected = rig.stats.rejected;

    rig.stats.hashrate = t.hashrate;
    rig.stats.accepted = t.accepted;
    rig.stats.rejected = t.rejected;
    rig.stats.uptime_s = t.uptime_s;
    rig.stats.difficulty = t.difficulty;
    rig.stats.total_hashes = t.total_hashes;
    rig.stats.last_share_time = Some(now);
    rig.status = RigStatus::Mining;
    rig.last_seen = now;

    if let Some(ref mut gpu) = rig.gpu {
        if let Some(t_c) = t.gpu_temp_c { gpu.temp_c = Some(t_c); }
        if let Some(p_w) = t.gpu_power_w { gpu.power_w = Some(p_w); }
        if let Some(f_p) = t.gpu_fan_pct { gpu.fan_pct = Some(f_p); }
    }

    // Record share events
    let new_accepted = t.accepted.saturating_sub(prev_accepted);
    let new_rejected = t.rejected.saturating_sub(prev_rejected);

    drop(rigs); // Release lock before writing share events

    if new_accepted > 0 || new_rejected > 0 {
        let mut events = state.share_events.write().await;
        for _ in 0..new_accepted.min(10) {
            events.push(ShareEvent {
                timestamp: now,
                rig_id: id.clone(),
                kind: ShareEventKind::Accepted,
                hashrate_at: t.hashrate,
            });
        }
        for _ in 0..new_rejected.min(10) {
            events.push(ShareEvent {
                timestamp: now,
                rig_id: id.clone(),
                kind: ShareEventKind::Rejected,
                hashrate_at: t.hashrate,
            });
        }
        // Keep max 5000 events
        if events.len() > 5000 {
            let drain = events.len() - 5000;
            events.drain(..drain);
        }
    }

    // Broadcast live update to all connected dashboard clients
    let _ = state.live_tx.send(serde_json::to_string(&LiveEvent {
        event_type: "telemetry".into(),
        data: serde_json::json!({
            "rig_id": id,
            "hashrate": t.hashrate,
            "accepted": t.accepted,
            "rejected": t.rejected,
            "uptime_s": t.uptime_s,
        }),
    }).unwrap_or_default());

    Ok(Json(serde_json::json!({"ok": true})))
}

// ─── GET /api/logs ───

pub async fn get_logs(State(state): State<Arc<AppState>>) -> Json<Vec<LogEntry>> {
    let logs = state.log_buffer.read().await;
    Json(logs.clone())
}

// ─── GET /api/logs/:rig_id ───

pub async fn get_rig_logs(
    State(state): State<Arc<AppState>>,
    Path(rig_id): Path<String>,
) -> Json<Vec<LogEntry>> {
    let logs = state.log_buffer.read().await;
    let filtered: Vec<_> = logs.iter().filter(|l| l.rig_id == rig_id).cloned().collect();
    Json(filtered)
}

// ─── POST /api/logs ─── (miner pushes log lines)

#[derive(serde::Deserialize)]
pub struct LogPush {
    pub rig_id: String,
    pub level: String,
    pub message: String,
}

pub async fn push_log_endpoint(
    State(state): State<Arc<AppState>>,
    Json(entry): Json<LogPush>,
) -> Json<serde_json::Value> {
    push_log(&state, &entry.rig_id, &entry.level, &entry.message).await;
    Json(serde_json::json!({"ok": true}))
}

// ─── GET /api/pool ───

pub async fn pool_stats(State(state): State<Arc<AppState>>) -> Json<PoolStats> {
    Json(fetch_pool_stats(&state).await.unwrap_or_default())
}

// ─── WebSocket /ws/console/:rig_id ───

pub async fn ws_console(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    Path(rig_id): Path<String>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state, rig_id))
}

async fn handle_ws(mut socket: WebSocket, state: Arc<AppState>, rig_id: String) {
    // Send existing logs for this rig
    {
        let logs = state.log_buffer.read().await;
        for entry in logs.iter().filter(|l| l.rig_id == rig_id) {
            let json = serde_json::to_string(entry).unwrap_or_default();
            if socket.send(Message::Text(json.into())).await.is_err() {
                return;
            }
        }
    }

    // Stream new logs every second
    let mut last_count = state.log_buffer.read().await.len();
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;

        let logs = state.log_buffer.read().await;
        if logs.len() > last_count {
            for entry in logs[last_count..].iter().filter(|l| l.rig_id == rig_id) {
                let json = serde_json::to_string(entry).unwrap_or_default();
                if socket.send(Message::Text(json.into())).await.is_err() {
                    return;
                }
            }
            last_count = logs.len();
        }

        // Check for incoming commands from dashboard
        match tokio::time::timeout(
            std::time::Duration::from_millis(50),
            socket.recv(),
        ).await {
            Ok(Some(Ok(Message::Text(cmd)))) => {
                push_log(&state, &rig_id, "cmd", &cmd).await;
            }
            Ok(Some(Err(_))) | Ok(None) => return,
            _ => {} // timeout = no message, continue
        }
    }
}

// ─── Helpers ───

async fn push_log(state: &AppState, rig_id: &str, level: &str, message: &str) {
    let entry = LogEntry {
        timestamp: chrono::Utc::now().timestamp(),
        rig_id: rig_id.to_string(),
        level: level.to_string(),
        message: message.to_string(),
    };

    let broadcast_entry = entry.clone();

    let mut logs = state.log_buffer.write().await;
    logs.push(entry);
    // Keep last 5000 log lines
    if logs.len() > 5000 {
        let drain = logs.len() - 5000;
        logs.drain(..drain);
    }

    let _ = state.live_tx.send(serde_json::to_string(&LiveEvent {
        event_type: "log".into(),
        data: serde_json::json!(broadcast_entry),
    }).unwrap_or_default());
}

async fn fetch_pool_stats(state: &AppState) -> anyhow::Result<PoolStats> {
    // Pool metrics are exposed in Prometheus text format on port 8455
    let body = state.http
        .get(format!("{}/metrics", state.pool_url))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await?
        .text()
        .await?;

    let mut valid = 0u64;
    let mut invalid = 0u64;
    let mut total = 0u64;
    let mut blocks = 0u64;
    let mut hashrate_hps = 0.0f64;
    let mut hashrate_1h_hps = 0.0f64;
    let mut hashrate_24h_hps = 0.0f64;
    let mut active_sessions = 0u64;
    let mut miners_tracked = 0u64;

    for line in body.lines() {
        if line.starts_with("zion_pool_accepted_total ") {
            valid = line.split_whitespace().last().unwrap_or("0").parse().unwrap_or(0);
        } else if line.starts_with("zion_pool_rejected_total ") {
            invalid = line.split_whitespace().last().unwrap_or("0").parse().unwrap_or(0);
        } else if line.starts_with("zion_pool_submits_total ") {
            total = line.split_whitespace().last().unwrap_or("0").parse().unwrap_or(0);
        } else if line.starts_with("zion_pool_blocks_found_total ") {
            blocks = line.split_whitespace().last().unwrap_or("0").parse().unwrap_or(0);
        } else if line.starts_with("zion_pool_hashrate_hps ") {
            hashrate_hps = line.split_whitespace().last().unwrap_or("0").parse().unwrap_or(0.0);
        } else if line.starts_with("zion_pool_hashrate_1h_hps ") {
            hashrate_1h_hps = line.split_whitespace().last().unwrap_or("0").parse().unwrap_or(0.0);
        } else if line.starts_with("zion_pool_hashrate_24h_hps ") {
            hashrate_24h_hps = line.split_whitespace().last().unwrap_or("0").parse().unwrap_or(0.0);
        } else if line.starts_with("zion_pool_active_sessions ") {
            active_sessions = line.split_whitespace().last().unwrap_or("0").parse().unwrap_or(0);
        } else if line.starts_with("zion_pool_miners_tracked ") {
            miners_tracked = line.split_whitespace().last().unwrap_or("0").parse().unwrap_or(0);
        }
    }
    total = if total == 0 { valid + invalid } else { total };

    // Convert H/s to KH/s for display
    Ok(PoolStats {
        hashrate: hashrate_hps / 1000.0,
        hashrate_1h: hashrate_1h_hps / 1000.0,
        hashrate_24h: hashrate_24h_hps / 1000.0,
        active_miners: active_sessions,
        total_miners: miners_tracked,
        valid_shares: valid,
        invalid_shares: invalid,
        total_shares: total,
        blocks_found: blocks,
        accept_rate: if total > 0 { (valid as f64 / total as f64) * 100.0 } else { 0.0 },
    })
}

// ─── PUT /api/rigs/:id/gpu ─── (agent updates GPU info)

pub async fn update_gpu(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(gpu): Json<GpuInfo>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut rigs = state.rigs.write().await;
    let rig = rigs.iter_mut().find(|r| r.id == id).ok_or(StatusCode::NOT_FOUND)?;
    rig.gpu = Some(gpu);
    let now = chrono::Utc::now().timestamp();
    rig.last_seen = now;
    drop(rigs);

    let _ = state.live_tx.send(serde_json::to_string(&LiveEvent {
        event_type: "gpu".into(),
        data: serde_json::json!({
            "rig_id": id,
            "timestamp": now,
        }),
    }).unwrap_or_default());

    persist_state(&state).await;

    Ok(Json(serde_json::json!({"ok": true})))
}

// ─── GET /api/rigs/:id/history ───

pub async fn rig_history(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Json<Vec<HashratePoint>> {
    let histories = state.rig_histories.read().await;
    Json(histories.get(&id).cloned().unwrap_or_default())
}

// ─── GET /api/history ─── (global hashrate history)

pub async fn hashrate_history(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<HashratePoint>> {
    let history = state.hashrate_history.read().await;
    Json(history.clone())
}

// ─── GET /api/shares ─── (share events timeline)

pub async fn share_events(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<ShareEvent>> {
    let events = state.share_events.read().await;
    Json(events.clone())
}

// ─── GET /api/alerts ───

pub async fn list_alerts(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<Alert>> {
    let alerts = state.alerts.read().await;
    Json(alerts.iter().filter(|a| !a.dismissed).cloned().collect())
}

// ─── POST /api/alerts ───

pub async fn create_alert(
    State(state): State<Arc<AppState>>,
    Json(mut alert): Json<Alert>,
) -> (StatusCode, Json<serde_json::Value>) {
    if alert.id == 0 {
        alert.id = chrono::Utc::now().timestamp_millis() as u64;
    }
    if alert.timestamp == 0 {
        alert.timestamp = chrono::Utc::now().timestamp();
    }

    let mut alerts = state.alerts.write().await;
    let id = alert.id;

    if alerts.iter().any(|a| a.id == id) {
        return (StatusCode::CONFLICT, Json(serde_json::json!({"ok": false, "error": "alert id already exists"})));
    }

    let broadcast_alert = alert.clone();
    alerts.push(alert);
    drop(alerts);

    let _ = state.live_tx.send(serde_json::to_string(&LiveEvent {
        event_type: "alert".into(),
        data: serde_json::json!(broadcast_alert),
    }).unwrap_or_default());

    persist_state(&state).await;

    (StatusCode::CREATED, Json(serde_json::json!({"ok": true, "id": id})))
}

// ─── POST /api/alerts/:id/dismiss ───

pub async fn dismiss_alert(
    State(state): State<Arc<AppState>>,
    Path(id): Path<u64>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut alerts = state.alerts.write().await;
    let alert = alerts.iter_mut().find(|a| a.id == id).ok_or(StatusCode::NOT_FOUND)?;
    alert.dismissed = true;
    drop(alerts);

    let _ = state.live_tx.send(serde_json::to_string(&LiveEvent {
        event_type: "alert_dismissed".into(),
        data: serde_json::json!({"id": id}),
    }).unwrap_or_default());

    persist_state(&state).await;

    Ok(Json(serde_json::json!({"ok": true})))
}

// ═══════════════════════════════════════════════════════════
// LIVE WEBSOCKET (broadcast to all dashboard clients)
// ═══════════════════════════════════════════════════════════

pub async fn ws_live(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws_live(socket, state))
}

async fn handle_ws_live(mut socket: WebSocket, state: Arc<AppState>) {
    let mut rx = state.live_tx.subscribe();

    // Send initial snapshot
    {
        let rigs = state.rigs.read().await;
        let total_hr: f64 = rigs.iter().map(|r| r.stats.hashrate).sum();
        let snapshot = serde_json::json!({
            "type": "snapshot",
            "data": {
                "rigs_total": rigs.len(),
                "rigs_mining": rigs.iter().filter(|r| r.status == RigStatus::Mining).count(),
                "total_hashrate": total_hr,
            }
        });
        let _ = socket.send(Message::Text(snapshot.to_string().into())).await;
    }

    loop {
        tokio::select! {
            msg = rx.recv() => {
                match msg {
                    Ok(text) => {
                        if socket.send(Message::Text(text.into())).await.is_err() {
                            return;
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(_) => return,
                }
            }
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Close(_))) | None => return,
                    Some(Err(_)) => return,
                    _ => {} // ignore pings/pongs/text from client
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════
// FLIGHT SHEETS
// ═══════════════════════════════════════════════════════════

// ─── GET /api/flightsheets ───

pub async fn list_flight_sheets(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<FlightSheet>> {
    let sheets = state.flight_sheets.read().await;
    Json(sheets.clone())
}

// ─── POST /api/flightsheets ───

pub async fn create_flight_sheet(
    State(state): State<Arc<AppState>>,
    Json(mut sheet): Json<FlightSheet>,
) -> (StatusCode, Json<serde_json::Value>) {
    let mut sheets = state.flight_sheets.write().await;
    if sheets.iter().any(|s| s.id == sheet.id) {
        return (StatusCode::CONFLICT, Json(serde_json::json!({"ok": false, "error": "flight sheet ID already exists"})));
    }
    if sheet.created_at == 0 {
        sheet.created_at = chrono::Utc::now().timestamp();
    }
    let id = sheet.id.clone();
    sheets.push(sheet);
    drop(sheets);
    persist_state(&state).await;
    (StatusCode::CREATED, Json(serde_json::json!({"ok": true, "id": id})))
}

// ─── PUT /api/flightsheets/:id ───

pub async fn update_flight_sheet(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(updated): Json<FlightSheet>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut sheets = state.flight_sheets.write().await;
    let sheet = sheets.iter_mut().find(|s| s.id == id).ok_or(StatusCode::NOT_FOUND)?;
    sheet.name = updated.name;
    sheet.coin = updated.coin;
    sheet.algo = updated.algo;
    sheet.pool_addr = updated.pool_addr;
    sheet.wallet = updated.wallet;
    sheet.miner_args = updated.miner_args;
    sheet.gpu_mode = updated.gpu_mode;
    sheet.threads = updated.threads;
    sheet.intensity = updated.intensity;
    drop(sheets);
    persist_state(&state).await;
    Ok(Json(serde_json::json!({"ok": true})))
}

// ─── DELETE /api/flightsheets/:id ───

pub async fn delete_flight_sheet(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut sheets = state.flight_sheets.write().await;
    let len_before = sheets.len();
    sheets.retain(|s| s.id != id);
    if sheets.len() == len_before {
        return Err(StatusCode::NOT_FOUND);
    }
    drop(sheets);
    persist_state(&state).await;
    Ok(Json(serde_json::json!({"ok": true})))
}

// ─── POST /api/rigs/:id/apply-flightsheet ───

#[derive(serde::Deserialize)]
pub struct ApplyFlightSheetReq {
    pub flight_sheet_id: String,
}

pub async fn apply_flight_sheet(
    State(state): State<Arc<AppState>>,
    Path(rig_id): Path<String>,
    Json(req): Json<ApplyFlightSheetReq>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let sheets = state.flight_sheets.read().await;
    let sheet = sheets.iter().find(|s| s.id == req.flight_sheet_id)
        .ok_or(StatusCode::NOT_FOUND)?
        .clone();
    drop(sheets);

    let mut rigs = state.rigs.write().await;
    let rig = rigs.iter_mut().find(|r| r.id == rig_id).ok_or(StatusCode::NOT_FOUND)?;
    rig.wallet = sheet.wallet.clone();
    rig.pool_addr = sheet.pool_addr.clone();
    rig.config.gpu_mode = sheet.gpu_mode.clone();
    rig.config.threads = sheet.threads;
    rig.config.intensity = sheet.intensity;
    drop(rigs);

    push_log(&state, &rig_id, "info", &format!("Applied flight sheet: {}", sheet.name)).await;

    let _ = state.live_tx.send(serde_json::to_string(&LiveEvent {
        event_type: "flightsheet_applied".into(),
        data: serde_json::json!({
            "rig_id": rig_id,
            "flight_sheet": sheet.name,
        }),
    }).unwrap_or_default());

    persist_state(&state).await;

    Ok(Json(serde_json::json!({"ok": true, "applied": sheet.name})))
}

// ═══════════════════════════════════════════════════════════
// BATCH RIG OPERATIONS
// ═══════════════════════════════════════════════════════════

#[derive(serde::Deserialize)]
pub struct BatchAction {
    pub rig_ids: Vec<String>,
    pub action: String,
    #[serde(default)]
    pub _params: serde_json::Value,
}

// ─── POST /api/rigs/batch ───

pub async fn batch_rig_action(
    State(state): State<Arc<AppState>>,
    Json(batch): Json<BatchAction>,
) -> Json<serde_json::Value> {
    let mut rigs = state.rigs.write().await;
    let mut success = 0u32;
    let mut failed = 0u32;

    for rig_id in &batch.rig_ids {
        if let Some(rig) = rigs.iter_mut().find(|r| &r.id == rig_id) {
            let now = chrono::Utc::now().timestamp();
            match batch.action.as_str() {
                "start" => { rig.status = RigStatus::Mining; rig.last_seen = now; }
                "stop" => { rig.status = RigStatus::Stopped; rig.last_seen = now; }
                "restart" => { rig.status = RigStatus::Mining; rig.last_seen = now; }
                "reboot" => { rig.status = RigStatus::Offline; rig.last_seen = now; }
                _ => { failed += 1; continue; }
            }
            success += 1;
        } else {
            failed += 1;
        }
    }

    drop(rigs);

    for rig_id in &batch.rig_ids {
        push_log(&state, rig_id, "info", &format!("Batch {}", batch.action)).await;
    }

    let _ = state.live_tx.send(serde_json::to_string(&LiveEvent {
        event_type: "batch_action".into(),
        data: serde_json::json!({
            "action": batch.action,
            "count": success,
        }),
    }).unwrap_or_default());

    persist_state(&state).await;

    Json(serde_json::json!({"ok": true, "success": success, "failed": failed}))
}

async fn persist_state(state: &AppState) {
    if let Err(err) = state.save_snapshot().await {
        eprintln!("state save error: {}", err);
    }
}

// ═══════════════════════════════════════════════════════════
// WALLET / EARNINGS ESTIMATE
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// COMMAND QUEUE (dashboard -> agent)
// ═══════════════════════════════════════════════════════════

#[derive(serde::Deserialize)]
pub struct EnqueueCommandReq {
    pub command: String,
    #[serde(default)]
    pub payload: serde_json::Value,
    #[serde(default)]
    pub max_attempts: Option<u32>,
}

#[derive(serde::Deserialize)]
pub struct AckCommandReq {
    pub status: String,
    pub message: Option<String>,
}

#[derive(serde::Deserialize, Default)]
pub struct ListCommandsQuery {
    pub status: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

fn command_status_matches(command: &AgentCommand, status: &Option<String>) -> bool {
    match status.as_deref().map(|s| s.trim().to_ascii_lowercase()) {
        Some(ref s) if s == "pending" => command.status == CommandStatus::Pending,
        Some(ref s) if s == "acked" || s == "ok" || s == "success" => command.status == CommandStatus::Acked,
        Some(ref s) if s == "failed" || s == "error" => command.status == CommandStatus::Failed,
        Some(_) => false,
        None => true,
    }
}

pub async fn list_commands(
    State(state): State<Arc<AppState>>,
    Path(rig_id): Path<String>,
    Query(query): Query<ListCommandsQuery>,
) -> Json<Vec<AgentCommand>> {
    let limit = query.limit.unwrap_or(100).clamp(1, 1000);
    let offset = query.offset.unwrap_or(0);

    let commands = state.commands.read().await;
    let mut out: Vec<AgentCommand> = commands
        .iter()
        .filter(|c| c.rig_id == rig_id && command_status_matches(c, &query.status))
        .cloned()
        .collect();
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    let paged = out
        .into_iter()
        .skip(offset)
        .take(limit)
        .collect();

    Json(paged)
}

pub async fn enqueue_command(
    State(state): State<Arc<AppState>>,
    Path(rig_id): Path<String>,
    Json(req): Json<EnqueueCommandReq>,
) -> Json<serde_json::Value> {
    let now = chrono::Utc::now().timestamp();
    let id = format!("cmd-{}-{}", rig_id, chrono::Utc::now().timestamp_millis());

    let command = AgentCommand {
        id: id.clone(),
        rig_id: rig_id.clone(),
        command: req.command,
        payload: req.payload,
        status: CommandStatus::Pending,
        attempts: 0,
        max_attempts: req.max_attempts.unwrap_or(3).clamp(1, 10),
        leased_until: None,
        created_at: now,
        acked_at: None,
        ack_message: None,
        last_error: None,
    };

    let mut commands = state.commands.write().await;
    commands.push(command.clone());
    if commands.len() > 10_000 {
        let drain = commands.len() - 10_000;
        commands.drain(..drain);
    }
    drop(commands);

    push_log(&state, &rig_id, "cmd", &format!("queued command: {}", command.command)).await;

    let _ = state.live_tx.send(serde_json::to_string(&LiveEvent {
        event_type: "command_queued".into(),
        data: serde_json::json!(command),
    }).unwrap_or_default());

    persist_state(&state).await;

    Json(serde_json::json!({"ok": true, "id": id}))
}

pub async fn next_command(
    State(state): State<Arc<AppState>>,
    Path(rig_id): Path<String>,
) -> Json<serde_json::Value> {
    const LEASE_SECONDS: i64 = 15;

    let now = chrono::Utc::now().timestamp();
    let mut changed = false;
    let mut commands = state.commands.write().await;

    for cmd in commands.iter_mut().filter(|c| c.rig_id == rig_id && c.status == CommandStatus::Pending) {
        if let Some(until) = cmd.leased_until {
            if until <= now && cmd.attempts >= cmd.max_attempts {
                cmd.status = CommandStatus::Failed;
                cmd.acked_at = Some(now);
                cmd.ack_message = Some("retry limit exceeded before ack".to_string());
                cmd.last_error = Some("lease timeout exhausted retries".to_string());
                changed = true;
            }
        }
    }

    let next = commands
        .iter_mut()
        .filter(|c| c.rig_id == rig_id && c.status == CommandStatus::Pending)
        .find(|c| c.leased_until.map(|until| until <= now).unwrap_or(true))
        .map(|cmd| {
            cmd.attempts = cmd.attempts.saturating_add(1);
            cmd.leased_until = Some(now + LEASE_SECONDS);
            changed = true;
            cmd.clone()
        });
    drop(commands);

    if changed {
        persist_state(&state).await;
    }

    Json(serde_json::json!({"ok": true, "command": next}))
}

pub async fn ack_command(
    State(state): State<Arc<AppState>>,
    Path((rig_id, command_id)): Path<(String, String)>,
    Json(req): Json<AckCommandReq>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let status = match req.status.as_str() {
        "acked" | "ok" | "success" => CommandStatus::Acked,
        "failed" | "error" => CommandStatus::Failed,
        _ => return Ok(Json(serde_json::json!({"ok": false, "error": "invalid status"}))),
    };

    let now = chrono::Utc::now().timestamp();

    let mut commands = state.commands.write().await;
    let cmd = commands
        .iter_mut()
        .find(|c| c.id == command_id && c.rig_id == rig_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    cmd.status = status.clone();
    cmd.leased_until = None;
    cmd.acked_at = Some(now);
    cmd.ack_message = req.message.clone();
    if status == CommandStatus::Failed {
        cmd.last_error = req.message.clone();
    }

    let snapshot = cmd.clone();
    drop(commands);

    let level = if status == CommandStatus::Acked { "info" } else { "error" };
    let message = req.message.unwrap_or_else(|| "no message".to_string());
    push_log(&state, &rig_id, level, &format!("command {} {}: {}", command_id, req.status, message)).await;

    let _ = state.live_tx.send(serde_json::to_string(&LiveEvent {
        event_type: "command_acked".into(),
        data: serde_json::json!(snapshot),
    }).unwrap_or_default());

    persist_state(&state).await;

    Ok(Json(serde_json::json!({"ok": true})))
}

// ─── GET /api/wallet/earnings ───

pub async fn wallet_earnings(
    State(state): State<Arc<AppState>>,
) -> Json<EarningsEstimate> {
    let rigs = state.rigs.read().await;
    let total_hr: f64 = rigs.iter().map(|r| r.stats.hashrate).sum();
    let max_diff = rigs.iter().map(|r| r.stats.difficulty).max().unwrap_or(100_000);

    // ZION block params: 60s block time, 50 ZION reward, ~10% pool share
    let block_time_s: u64 = 60;
    let block_reward: f64 = 50.0;
    // Estimate network hashrate as 10x your fleet (conservative)
    let net_hr = if total_hr > 0.0 { total_hr * 10.0 } else { 1.0 };
    let your_share = if net_hr > 0.0 { total_hr / net_hr } else { 0.0 };
    let blocks_per_day = 86400.0 / block_time_s as f64;
    let daily = your_share * blocks_per_day * block_reward;

    Json(EarningsEstimate {
        hashrate: total_hr,
        daily_coins: daily,
        weekly_coins: daily * 7.0,
        monthly_coins: daily * 30.0,
        difficulty: max_diff,
        block_reward,
        block_time_s,
        net_hashrate_est: net_hr,
    })
}

// ═══════════════════════════════════════════════════════════
// INFRA STATUS — aggregated upstream health
// ═══════════════════════════════════════════════════════════

#[derive(serde::Serialize)]
pub struct InfraStatus {
    pub node: ServiceStatus,
    pub pool: ServiceStatus,
    pub dao: ServiceStatus,
    pub warp: ServiceStatus,
    pub agent: ServiceStatus,
    pub website: ServiceStatus,
}

#[derive(serde::Serialize)]
pub struct ServiceStatus {
    pub name: String,
    pub url: String,
    pub reachable: bool,
    pub latency_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

async fn check_service(
    http: &reqwest::Client,
    name: &str,
    url: &str,
) -> ServiceStatus {
    let start = std::time::Instant::now();
    let result = http
        .get(url)
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await;
    let latency_ms = start.elapsed().as_millis() as u64;

    match result {
        Ok(resp) => {
            let data = resp.json::<serde_json::Value>().await.ok();
            ServiceStatus {
                name: name.to_string(),
                url: url.to_string(),
                reachable: true,
                latency_ms,
                data,
            }
        }
        Err(_) => ServiceStatus {
            name: name.to_string(),
            url: url.to_string(),
            reachable: false,
            latency_ms,
            data: None,
        },
    }
}

pub async fn infra_status(State(state): State<Arc<AppState>>) -> Json<InfraStatus> {
    let http = &state.http;
    let node_url = format!("{}/health", state.node_rpc_url);
    let pool_url = format!("{}/metrics", state.pool_url);
    let dao_url = format!("{}/api/dao/health", state.dao_url);
    let warp_url = format!("{}/health", state.warp_url);
    let agent_url = format!("{}/health", state.agent_url);
    let website_url = "http://127.0.0.1:3000/api/health".to_string();

    let (node, pool, dao, warp, agent, website) = tokio::join!(
        check_service(http, "node", &node_url),
        check_service(http, "pool", &pool_url),
        check_service(http, "dao", &dao_url),
        check_service(http, "warp", &warp_url),
        check_service(http, "agent", &agent_url),
        check_service(http, "website", &website_url),
    );

    Json(InfraStatus {
        node,
        pool,
        dao,
        warp,
        agent,
        website,
    })
}

// ═══════════════════════════════════════════════════════════
// NODE / DAO / WARP / AGENT PROXY HANDLERS
// ═══════════════════════════════════════════════════════════

pub async fn node_status(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    match state.http.get(format!("{}/health", state.node_rpc_url))
        .timeout(std::time::Duration::from_secs(5))
        .send().await
    {
        Ok(resp) => Json(resp.json().await.unwrap_or_else(|_| serde_json::json!({"ok": false, "error": "parse failed"}))),
        Err(e) => Json(serde_json::json!({"ok": false, "error": e.to_string()})),
    }
}

pub async fn dao_status(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    match state.http.get(format!("{}/api/dao/health", state.dao_url))
        .timeout(std::time::Duration::from_secs(5))
        .send().await
    {
        Ok(resp) => Json(resp.json().await.unwrap_or_else(|_| serde_json::json!({"ok": false, "error": "parse failed"}))),
        Err(e) => Json(serde_json::json!({"ok": false, "error": e.to_string()})),
    }
}

pub async fn warp_status(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    match state.http.get(format!("{}/health", state.warp_url))
        .timeout(std::time::Duration::from_secs(5))
        .send().await
    {
        Ok(resp) => Json(resp.json().await.unwrap_or_else(|_| serde_json::json!({"ok": false, "error": "parse failed"}))),
        Err(e) => Json(serde_json::json!({"ok": false, "error": e.to_string()})),
    }
}

pub async fn agent_status(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    match state.http.get(format!("{}/api/status", state.agent_url))
        .timeout(std::time::Duration::from_secs(5))
        .send().await
    {
        Ok(resp) => Json(resp.json().await.unwrap_or_else(|_| serde_json::json!({"ok": false, "error": "parse failed"}))),
        Err(e) => Json(serde_json::json!({"ok": false, "error": e.to_string()})),
    }
}

// ─── POST /api/agent/miner/:action ───
// Proxy miner control commands to the agent.
// action = "start" | "stop" | "restart"

pub async fn agent_miner_control(
    State(state): State<Arc<AppState>>,
    Path(action): Path<String>,
) -> Json<serde_json::Value> {
    let method = match action.as_str() {
        "start" => "start",
        "stop" => "stop",
        "restart" => "restart",
        _ => return Json(serde_json::json!({"ok": false, "error": "unknown action"})),
    };

    let url = format!("{}/api/miner/{}", state.agent_url, method);
    match state.http.post(&url)
        .timeout(std::time::Duration::from_secs(10))
        .json(&serde_json::json!({}))
        .send().await
    {
        Ok(resp) => {
            let body = resp.json::<serde_json::Value>().await.unwrap_or_else(|_| serde_json::json!({"ok": true}));
            Json(body)
        }
        Err(e) => Json(serde_json::json!({"ok": false, "error": e.to_string()})),
    }
}
