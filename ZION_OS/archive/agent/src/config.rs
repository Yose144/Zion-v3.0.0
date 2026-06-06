use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentConfig {
    pub rig_id: Option<String>,
    pub api_bind: String,
    pub autonomous_mode: bool,
    pub auto_start_miner: bool,
    pub auto_update: String, // "stable" | "canary" | "disabled"
    pub telemetry: TelemetryConfig,
    pub miner: MinerConfig,
    pub watchdog: WatchdogConfig,
    pub fleet: FleetConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TelemetryConfig {
    pub enabled: bool,
    pub endpoint: String,
    pub interval_sec: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MinerConfig {
    pub binary_path: String,
    pub default_pool: String,
    pub default_wallet: String,
    pub default_worker: String,
    pub default_gpu_backend: String, // "auto" | "opencl" | "cuda" | "metal" | "cpu"
    pub extra_args: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WatchdogConfig {
    pub enabled: bool,
    pub rules_file: String,
    pub check_interval_sec: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FleetConfig {
    pub enabled: bool,
    pub dashboard_url: String,
    pub api_key: Option<String>,
    pub poll_interval_sec: u64,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            rig_id: None,
            api_bind: "0.0.0.0:8767".to_string(),
            autonomous_mode: true,
            auto_start_miner: false,
            auto_update: "stable".to_string(),
            telemetry: TelemetryConfig {
                enabled: false,
                endpoint: "https://fleet.zionterranova.com/api/telemetry".to_string(),
                interval_sec: 30,
            },
            miner: MinerConfig {
                binary_path: "/usr/bin/zion-miner".to_string(),
                default_pool: "77.42.71.94:8444".to_string(),
                default_wallet: "".to_string(),
                default_worker: "zion-rig".to_string(),
                default_gpu_backend: "auto".to_string(),
                extra_args: vec![],
            },
            watchdog: WatchdogConfig {
                enabled: true,
                rules_file: "/data/zion/config/watchdog.yaml".to_string(),
                check_interval_sec: 60,
            },
            fleet: FleetConfig {
                enabled: false,
                dashboard_url: "https://fleet.zionterranova.com".to_string(),
                api_key: None,
                poll_interval_sec: 10,
            },
        }
    }
}

pub async fn load_config() -> anyhow::Result<AgentConfig> {
    let paths = [
        "/data/zion/config/agent.toml",
        "/etc/zion/agent.toml",
        "./agent.toml",
    ];

    for path in &paths {
        if Path::new(path).exists() {
            let content = tokio::fs::read_to_string(path).await?;
            let config: AgentConfig = toml::from_str(&content)?;
            tracing::info!("Konfigurace nactena z {}", path);
            return Ok(config);
        }
    }

    Err(anyhow::anyhow!("Zadny konfiguracni soubor nenalezen"))
}

pub async fn save_config(config: &AgentConfig) -> anyhow::Result<()> {
    let content = toml::to_string_pretty(config)?;
    tokio::fs::write("/data/zion/config/agent.toml", content).await?;
    Ok(())
}
