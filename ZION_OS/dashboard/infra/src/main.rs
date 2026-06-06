mod handlers;
mod state;

use axum::{
    extract::State,
    http::{Method, StatusCode, header},
    middleware,
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json,
    Router,
};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use state::*;

#[derive(Clone)]
struct AuthConfig {
    control_token: Option<String>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let bind_addr = std::env::var("ZIONOS_BIND").unwrap_or_else(|_| "0.0.0.0:8888".into());
    let pool_metrics = std::env::var("ZIONOS_POOL_METRICS")
        .unwrap_or_else(|_| "http://127.0.0.1:8455".into());
    let node_rpc = std::env::var("ZIONOS_NODE_RPC")
        .unwrap_or_else(|_| "http://127.0.0.1:8443".into());
    let dao_api = std::env::var("ZIONOS_DAO_API")
        .unwrap_or_else(|_| "http://127.0.0.1:8450".into());
    let warp_api = std::env::var("ZIONOS_WARP_API")
        .unwrap_or_else(|_| "http://127.0.0.1:8453".into());
    let agent_api = std::env::var("ZIONOS_AGENT_API")
        .unwrap_or_else(|_| "http://127.0.0.1:8767".into());
    let data_dir = std::env::var("ZIONOS_DATA_DIR").unwrap_or_else(|_| "dashboard/data".into());
    let persist_path = std::env::var("ZIONOS_STATE_FILE")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from(data_dir).join("state.json"));
    let control_token = std::env::var("ZIONOS_CONTROL_TOKEN")
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());

    eprintln!("┌──────────────────────────────────────────┐");
    eprintln!("│        ZionOS Dashboard  v0.2.0          │");
    eprintln!("├──────────────────────────────────────────┤");
    eprintln!("│  Web UI    → http://{}      │", bind_addr);
    eprintln!("│  Pool      → {}      │", pool_metrics);
    eprintln!("│  Node RPC  → {}      │", node_rpc);
    eprintln!("│  DAO       → {}      │", dao_api);
    eprintln!("│  WARP      → {}      │", warp_api);
    eprintln!("│  Agent     → {}      │", agent_api);
    eprintln!("│  State     → {} │", persist_path.display());
    eprintln!("└──────────────────────────────────────────┘");

    let (live_tx, _) = tokio::sync::broadcast::channel::<String>(256);

    let snapshot = match AppState::load_snapshot(&persist_path).await {
        Ok(snapshot) => {
            eprintln!("Loaded dashboard state from {}", persist_path.display());
            Some(snapshot)
        }
        Err(err) => {
            if persist_path.exists() {
                eprintln!("State load failed ({}): {}", persist_path.display(), err);
            }
            None
        }
    };

    let (rigs, log_buffer, hashrate_history, rig_histories, share_events, alerts, flight_sheets, commands) =
        if let Some(snapshot) = snapshot {
            (
                if snapshot.rigs.is_empty() { seed_demo_rigs() } else { snapshot.rigs },
                snapshot.log_buffer,
                snapshot.hashrate_history,
                snapshot.rig_histories,
                snapshot.share_events,
                snapshot.alerts,
                if snapshot.flight_sheets.is_empty() { seed_demo_flight_sheets() } else { snapshot.flight_sheets },
                snapshot.commands,
            )
        } else {
            (
                seed_demo_rigs(),
                Vec::new(),
                Vec::new(),
                std::collections::HashMap::new(),
                Vec::new(),
                Vec::new(),
                seed_demo_flight_sheets(),
                Vec::new(),
            )
        };

    let state = Arc::new(AppState {
        pool_url: pool_metrics.clone(),
        node_rpc_url: node_rpc,
        dao_url: dao_api,
        warp_url: warp_api,
        agent_url: agent_api,
        http: reqwest::Client::new(),
        rigs: Arc::new(tokio::sync::RwLock::new(rigs)),
        log_buffer: Arc::new(tokio::sync::RwLock::new(log_buffer)),
        hashrate_history: Arc::new(tokio::sync::RwLock::new(hashrate_history)),
        rig_histories: Arc::new(tokio::sync::RwLock::new(rig_histories)),
        share_events: Arc::new(tokio::sync::RwLock::new(share_events)),
        alerts: Arc::new(tokio::sync::RwLock::new(alerts)),
        flight_sheets: Arc::new(tokio::sync::RwLock::new(flight_sheets)),
        commands: Arc::new(tokio::sync::RwLock::new(commands)),
        persist_path,
        live_tx,
    });

    let auth_config = AuthConfig { control_token };

    // Determine path to static frontend files
    let static_dir = std::env::var("ZIONOS_STATIC_DIR").unwrap_or_else(|_| {
        // Try relative path from binary or fallback
        let exe = std::env::current_exe().unwrap_or_default();
        let dir = exe.parent().unwrap_or(std::path::Path::new("."));
        let candidate = dir.join("static");
        if candidate.exists() {
            candidate.to_string_lossy().into()
        } else {
            // Development: look next to Cargo.toml
            "dashboard/static".into()
        }
    });

    // Background task: snapshot hashrate history every 30s
    {
        let st = Arc::clone(&state);
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(30)).await;

                let rigs = st.rigs.read().await;
                let total: f64 = rigs.iter().map(|r| r.stats.hashrate).sum();
                let now = chrono::Utc::now().timestamp();

                // Global history point
                {
                    let mut history = st.hashrate_history.write().await;
                    history.push(state::HashratePoint {
                        timestamp: now,
                        hashrate: total,
                        rig_id: None,
                    });
                    if history.len() > 2880 {
                        let drain = history.len() - 2880;
                        history.drain(..drain);
                    }
                }

                // Per-rig history points
                {
                    let mut rig_histories = st.rig_histories.write().await;
                    for rig in rigs.iter() {
                        let entry = rig_histories
                            .entry(rig.id.clone())
                            .or_insert_with(Vec::new);
                        entry.push(state::HashratePoint {
                            timestamp: now,
                            hashrate: rig.stats.hashrate,
                            rig_id: Some(rig.id.clone()),
                        });
                        if entry.len() > 2880 {
                            let drain = entry.len() - 2880;
                            entry.drain(..drain);
                        }
                    }
                }

                // Check for alerts
                let mut new_alerts = Vec::new();
                for rig in rigs.iter() {
                    if let Some(ref gpu) = rig.gpu {
                        if let Some(temp) = gpu.temp_c {
                            if temp > 85.0 {
                                new_alerts.push(state::Alert {
                                    id: now as u64,
                                    timestamp: now,
                                    rig_id: Some(rig.id.clone()),
                                    level: state::AlertLevel::Warning,
                                    title: format!("{}: GPU Hot", rig.name),
                                    message: format!("GPU temperature {temp:.0}°C exceeds 85°C threshold"),
                                    dismissed: false,
                                });
                            }
                            if temp > 95.0 {
                                new_alerts.push(state::Alert {
                                    id: now as u64 + 1,
                                    timestamp: now,
                                    rig_id: Some(rig.id.clone()),
                                    level: state::AlertLevel::Critical,
                                    title: format!("{}: GPU Critical Temp!", rig.name),
                                    message: format!("GPU temperature {temp:.0}°C is critically high!"),
                                    dismissed: false,
                                });
                            }
                        }
                    }
                    if rig.status == state::RigStatus::Mining
                        && rig.last_seen > 0
                        && (now - rig.last_seen) > 300
                    {
                        new_alerts.push(state::Alert {
                            id: now as u64 + 2,
                            timestamp: now,
                            rig_id: Some(rig.id.clone()),
                            level: state::AlertLevel::Warning,
                            title: format!("{}: No Telemetry", rig.name),
                            message: format!("Rig hasn't reported in {}s", now - rig.last_seen),
                            dismissed: false,
                        });
                    }
                }

                if !new_alerts.is_empty() {
                    let mut alerts = st.alerts.write().await;
                    alerts.extend(new_alerts);
                    if alerts.len() > 500 {
                        let drain = alerts.len() - 500;
                        alerts.drain(..drain);
                    }
                }
            }
        });
    }

    // Background task: persist mutable state to disk.
    {
        let st = Arc::clone(&state);
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(15)).await;
                if let Err(err) = st.save_snapshot().await {
                    eprintln!("state autosave error: {}", err);
                }
            }
        });
    }

    let api = Router::new()
        .route("/api/overview", get(handlers::overview))
        .route("/api/infra", get(handlers::infra_status))
        .route("/api/node", get(handlers::node_status))
        .route("/api/dao", get(handlers::dao_status))
        .route("/api/warp", get(handlers::warp_status))
        .route("/api/agent", get(handlers::agent_status))
        .route("/api/agent/miner/:action", post(handlers::agent_miner_control))
        .route("/api/rigs", get(handlers::list_rigs).post(handlers::register_rig))
        .route("/api/rigs/batch", post(handlers::batch_rig_action))
        .route("/api/rigs/:id", get(handlers::get_rig).delete(handlers::remove_rig))
        .route("/api/rigs/:id/action", post(handlers::rig_action))
        .route("/api/rigs/:id/telemetry", put(handlers::update_telemetry))
        .route("/api/rigs/:id/gpu", put(handlers::update_gpu))
        .route("/api/rigs/:id/history", get(handlers::rig_history))
        .route("/api/rigs/:id/apply-flightsheet", post(handlers::apply_flight_sheet))
        .route("/api/rigs/:id/commands", get(handlers::list_commands).post(handlers::enqueue_command))
        .route("/api/rigs/:id/commands/next", get(handlers::next_command))
        .route("/api/rigs/:id/commands/:command_id/ack", post(handlers::ack_command))
        .route("/api/logs", get(handlers::get_logs).post(handlers::push_log_endpoint))
        .route("/api/logs/:rig_id", get(handlers::get_rig_logs))
        .route("/api/pool", get(handlers::pool_stats))
        .route("/api/history", get(handlers::hashrate_history))
        .route("/api/shares", get(handlers::share_events))
        .route("/api/alerts", get(handlers::list_alerts).post(handlers::create_alert))
        .route("/api/alerts/:id/dismiss", post(handlers::dismiss_alert))
        .route("/api/flightsheets", get(handlers::list_flight_sheets).post(handlers::create_flight_sheet))
        .route("/api/flightsheets/:id", put(handlers::update_flight_sheet).delete(handlers::delete_flight_sheet))
        .route("/api/wallet/earnings", get(handlers::wallet_earnings))
        .route("/ws/console/:rig_id", get(handlers::ws_console))
        .route("/ws/live", get(handlers::ws_live))
        .route_layer(middleware::from_fn_with_state(auth_config.clone(), require_control_token));

    let app = api
        .fallback_service(ServeDir::new(&static_dir).append_index_html_on_directories(true))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    eprintln!("Listening on {}", bind_addr);
    axum::serve(listener, app).await?;
    Ok(())
}

async fn require_control_token(
    State(auth): State<AuthConfig>,
    req: axum::extract::Request,
    next: middleware::Next,
) -> Response {
    if !req.uri().path().starts_with("/api/") {
        return next.run(req).await;
    }

    if matches!(*req.method(), Method::GET | Method::HEAD | Method::OPTIONS) {
        return next.run(req).await;
    }

    let Some(expected) = auth.control_token.as_deref() else {
        return next.run(req).await;
    };

    let bearer_token = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim);

    let header_token = req
        .headers()
        .get("x-zionos-token")
        .and_then(|h| h.to_str().ok())
        .map(str::trim);

    if bearer_token == Some(expected) || header_token == Some(expected) {
        return next.run(req).await;
    }

    (
        StatusCode::UNAUTHORIZED,
        Json(serde_json::json!({
            "ok": false,
            "error": "unauthorized",
            "hint": "provide Authorization: Bearer <token> or x-zionos-token"
        })),
    )
        .into_response()
}

/// Seed a demo rig so the dashboard isn't empty on first launch.
fn seed_demo_rigs() -> Vec<RigState> {
    vec![
        RigState {
            id: "rig-518837".into(),
            name: "ZionRig-Vega64".into(),
            wallet: "zion1n7n5t28663h3f3d8s8y596h5f3z582z8638d073".into(),
            worker: "vega64-smos".into(),
            pool_addr: "77.42.71.94:8444".into(),
            status: RigStatus::Offline,
            gpu: Some(GpuInfo {
                name: "AMD RX Vega 64".into(),
                vendor: "AMD".into(),
                vram_mb: 8192,
                driver: "amd21.50.2 / ROCm 5.x".into(),
                temp_c: None,
                power_w: None,
                fan_pct: None,
                core_mhz: Some(1200),
                mem_mhz: Some(950),
            }),
            stats: RigStats::default(),
            config: RigConfig { threads: 0, gpu_mode: "opencl".into(), intensity: None },
            last_seen: 0,
        },
        RigState {
            id: "rig-local-rx5600".into(),
            name: "DevRig-RX5600".into(),
            wallet: "zion1n7n5t28663h3f3d8s8y596h5f3z582z8638d073".into(),
            worker: "rx5600-local".into(),
            pool_addr: "77.42.71.94:8444".into(),
            status: RigStatus::Stopped,
            gpu: Some(GpuInfo {
                name: "AMD RX 5600 XT".into(),
                vendor: "AMD".into(),
                vram_mb: 6144,
                driver: "RDNA 1".into(),
                temp_c: None,
                power_w: None,
                fan_pct: None,
                core_mhz: None,
                mem_mhz: None,
            }),
            stats: RigStats::default(),
            config: RigConfig { threads: 4, gpu_mode: "cpu".into(), intensity: None },
            last_seen: 0,
        },
    ]
}

/// Seed demo flight sheets so the UI isn't empty.
fn seed_demo_flight_sheets() -> Vec<FlightSheet> {
    vec![
        FlightSheet {
            id: "fs-zion-default".into(),
            name: "ZION — Default CPU".into(),
            coin: "ZION".into(),
            algo: "Ekam Deeksha v2".into(),
            pool_addr: "77.42.71.94:8444".into(),
            wallet: "zion1n7n5t28663h3f3d8s8y596h5f3z582z8638d073".into(),
            miner_args: "--threads 4".into(),
            gpu_mode: "cpu".into(),
            threads: 4,
            intensity: None,
            created_at: 1775000000,
        },
        FlightSheet {
            id: "fs-zion-opencl".into(),
            name: "ZION — OpenCL GPU".into(),
            coin: "ZION".into(),
            algo: "Ekam Deeksha v2".into(),
            pool_addr: "77.42.71.94:8444".into(),
            wallet: "zion1n7n5t28663h3f3d8s8y596h5f3z582z8638d073".into(),
            miner_args: "--gpu-mode opencl --intensity 0.8".into(),
            gpu_mode: "opencl".into(),
            threads: 0,
            intensity: Some(0.8),
            created_at: 1775000000,
        },
    ]
}
