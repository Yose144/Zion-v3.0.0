use crate::AgentState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, error, info};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TelemetryPayload {
    pub rig_id: String,
    pub timestamp: String,
    pub system: SystemMetrics,
    pub gpu: Vec<GpuMetrics>,
    pub miner: MinerMetrics,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemMetrics {
    pub uptime_sec: u64,
    pub cpu_percent: f32,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub load_avg_1m: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GpuMetrics {
    pub index: u32,
    pub name: String,
    pub temperature: f32,
    pub fan_percent: u32,
    pub power_watts: f32,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub utilization_percent: u32,
    pub hashrate: Option<f64>, // H/s
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MinerMetrics {
    pub running: bool,
    pub pid: Option<u32>,
    pub uptime_sec: u64,
    pub hashrate: f64,
    pub shares_accepted: u64,
    pub shares_rejected: u64,
    pub pool_connected: bool,
    pub current_algorithm: String,
}

pub async fn collector_loop(state: Arc<AgentState>) {
    info!("Telemetry collector spusten");
    loop {
        let interval = {
            let cfg = state.config.read().await;
            cfg.telemetry.interval_sec
        };

        match collect_telemetry(state.clone()).await {
            Ok(payload) => {
                debug!("Telemetry: {} GPU(s), hashrate={:.2} H/s", payload.gpu.len(), payload.miner.hashrate);

                // Odesli na fleet dashboard
                let cfg = state.config.read().await;
                if cfg.telemetry.enabled && !cfg.telemetry.endpoint.is_empty() {
                    if let Err(e) = send_telemetry(&cfg.telemetry.endpoint, &payload).await {
                        debug!("Telemetry send selhal: {}", e);
                    }
                }
            }
            Err(e) => {
                error!("Telemetry collection selhal: {}", e);
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(interval)).await;
    }
}

async fn collect_telemetry(state: Arc<AgentState>) -> anyhow::Result<TelemetryPayload> {
    let mut sys = sysinfo::System::new_all();
    sys.refresh_all();

    let cpu_percent = sys.global_cpu_usage();
    let memory_used_mb = sys.used_memory() / 1024;
    let memory_total_mb = sys.total_memory() / 1024;
    let load_avg = sysinfo::System::load_average();

    let miner_pid = *state.miner_pid.read().await;

    // GPU metrics (stub — rozsirit dle platformy)
    let gpu = vec![]; // TODO: nvidia-smi, rocm-smi, sysfs parsing

    Ok(TelemetryPayload {
        rig_id: state.rig_id.clone(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        system: SystemMetrics {
            uptime_sec: sysinfo::System::uptime(),
            cpu_percent,
            memory_used_mb,
            memory_total_mb,
            load_avg_1m: load_avg.one as f32,
        },
        gpu,
        miner: MinerMetrics {
            running: miner_pid.is_some(),
            pid: miner_pid,
            uptime_sec: 0, // TODO: track miner start time
            hashrate: 0.0, // TODO: parse z miner logu
            shares_accepted: 0,
            shares_rejected: 0,
            pool_connected: miner_pid.is_some(),
            current_algorithm: "Deeksha".to_string(),
        },
    })
}

async fn send_telemetry(endpoint: &str, payload: &TelemetryPayload) -> anyhow::Result<()> {
    let client = reqwest::Client::new();
    client
        .post(endpoint)
        .json(payload)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?;
    Ok(())
}
