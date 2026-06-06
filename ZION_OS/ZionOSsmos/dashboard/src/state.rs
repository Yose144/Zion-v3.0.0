use std::sync::Arc;
use anyhow::Context;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Shared application state across all handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool_url: String,
    pub node_rpc_url: String,
    pub dao_url: String,
    pub warp_url: String,
    pub agent_url: String,
    pub http: reqwest::Client,
    pub rigs: Arc<tokio::sync::RwLock<Vec<RigState>>>,
    pub log_buffer: Arc<tokio::sync::RwLock<Vec<LogEntry>>>,
    pub hashrate_history: Arc<tokio::sync::RwLock<Vec<HashratePoint>>>,
    pub rig_histories: Arc<tokio::sync::RwLock<std::collections::HashMap<String, Vec<HashratePoint>>>>,
    pub share_events: Arc<tokio::sync::RwLock<Vec<ShareEvent>>>,
    pub alerts: Arc<tokio::sync::RwLock<Vec<Alert>>>,
    pub flight_sheets: Arc<tokio::sync::RwLock<Vec<FlightSheet>>>,
    pub commands: Arc<tokio::sync::RwLock<Vec<AgentCommand>>>,
    pub persist_path: PathBuf,
    /// Broadcast channel for live WebSocket push to all dashboard clients.
    pub live_tx: tokio::sync::broadcast::Sender<String>,
}

impl AppState {
    pub async fn to_snapshot(&self) -> DashboardSnapshot {
        DashboardSnapshot {
            rigs: self.rigs.read().await.clone(),
            log_buffer: self.log_buffer.read().await.clone(),
            hashrate_history: self.hashrate_history.read().await.clone(),
            rig_histories: self.rig_histories.read().await.clone(),
            share_events: self.share_events.read().await.clone(),
            alerts: self.alerts.read().await.clone(),
            flight_sheets: self.flight_sheets.read().await.clone(),
            commands: self.commands.read().await.clone(),
        }
    }

    pub async fn save_snapshot(&self) -> anyhow::Result<()> {
        if let Some(parent) = self.persist_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let snapshot = self.to_snapshot().await;
        let json = serde_json::to_vec_pretty(&snapshot)?;
        let tmp_path = self.persist_path.with_extension("tmp");

        tokio::fs::write(&tmp_path, json).await?;
        tokio::fs::rename(&tmp_path, &self.persist_path).await?;
        Ok(())
    }

    pub async fn load_snapshot(path: &Path) -> anyhow::Result<DashboardSnapshot> {
        let raw = tokio::fs::read(path)
            .await
            .with_context(|| format!("failed reading {}", path.display()))?;
        let snapshot: DashboardSnapshot = serde_json::from_slice(&raw)
            .with_context(|| format!("failed parsing {}", path.display()))?;
        Ok(snapshot)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct DashboardSnapshot {
    pub rigs: Vec<RigState>,
    pub log_buffer: Vec<LogEntry>,
    pub hashrate_history: Vec<HashratePoint>,
    pub rig_histories: std::collections::HashMap<String, Vec<HashratePoint>>,
    pub share_events: Vec<ShareEvent>,
    pub alerts: Vec<Alert>,
    pub flight_sheets: Vec<FlightSheet>,
    pub commands: Vec<AgentCommand>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentCommand {
    pub id: String,
    pub rig_id: String,
    pub command: String,
    #[serde(default)]
    pub payload: serde_json::Value,
    pub status: CommandStatus,
    #[serde(default)]
    pub attempts: u32,
    #[serde(default = "default_max_attempts")]
    pub max_attempts: u32,
    #[serde(default)]
    pub leased_until: Option<i64>,
    pub created_at: i64,
    pub acked_at: Option<i64>,
    pub ack_message: Option<String>,
    #[serde(default)]
    pub last_error: Option<String>,
}

fn default_max_attempts() -> u32 {
    3
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CommandStatus {
    Pending,
    Acked,
    Failed,
}

/// Represents one managed mining rig.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RigState {
    pub id: String,
    pub name: String,
    pub wallet: String,
    pub worker: String,
    pub pool_addr: String,
    pub status: RigStatus,
    pub gpu: Option<GpuInfo>,
    pub stats: RigStats,
    pub config: RigConfig,
    pub last_seen: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RigStatus {
    Online,
    Mining,
    Offline,
    Error,
    Stopped,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct GpuInfo {
    pub name: String,
    pub vendor: String,
    pub vram_mb: u32,
    pub driver: String,
    pub temp_c: Option<f64>,
    pub power_w: Option<f64>,
    pub fan_pct: Option<u32>,
    pub core_mhz: Option<u32>,
    pub mem_mhz: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct RigStats {
    pub hashrate: f64,
    pub hashrate_1h: f64,
    pub hashrate_24h: f64,
    pub accepted: u64,
    pub rejected: u64,
    pub stale: u64,
    pub uptime_s: u64,
    pub difficulty: u64,
    pub last_share_time: Option<i64>,
    pub total_hashes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RigConfig {
    pub threads: u32,
    pub gpu_mode: String,
    pub intensity: Option<f64>,
}

impl Default for RigConfig {
    fn default() -> Self {
        Self {
            threads: 0,
            gpu_mode: "cpu".into(),
            intensity: None,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: i64,
    pub rig_id: String,
    pub level: String,
    pub message: String,
}

/// Pool stats from the V3 pool metrics API.
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct PoolStats {
    pub hashrate: f64,
    pub hashrate_1h: f64,
    pub hashrate_24h: f64,
    pub active_miners: u64,
    pub total_miners: u64,
    pub valid_shares: u64,
    pub invalid_shares: u64,
    pub total_shares: u64,
    pub blocks_found: u64,
    pub accept_rate: f64,
}

/// Action to execute on a rig.
#[derive(Debug, Deserialize)]
pub struct RigAction {
    pub action: String,
    #[serde(default)]
    pub params: serde_json::Value,
}

/// Dashboard overview combining pool + rig aggregates.
#[derive(Serialize)]
pub struct DashboardOverview {
    pub pool: PoolStats,
    pub rigs_total: usize,
    pub rigs_online: usize,
    pub rigs_mining: usize,
    pub rigs_offline: usize,
    pub total_hashrate: f64,
    pub total_accepted: u64,
    pub total_rejected: u64,
    pub uptime_avg_s: u64,
}

/// A timestamped hashrate sample for history charts.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HashratePoint {
    pub timestamp: i64,
    pub hashrate: f64,
    pub rig_id: Option<String>,
}

/// A share event for the timeline visualization.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ShareEvent {
    pub timestamp: i64,
    pub rig_id: String,
    pub kind: ShareEventKind,
    pub hashrate_at: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ShareEventKind {
    Accepted,
    Rejected,
    Stale,
    NoSolution,
}

/// A dashboard alert/notification.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Alert {
    pub id: u64,
    pub timestamp: i64,
    pub rig_id: Option<String>,
    pub level: AlertLevel,
    pub title: String,
    pub message: String,
    pub dismissed: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertLevel {
    Info,
    Warning,
    Critical,
}

// ═══════════════════════════════════════════════════════════
// FLIGHT SHEETS
// ═══════════════════════════════════════════════════════════

/// A flight sheet defines a mining configuration preset that can be applied to rigs.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FlightSheet {
    pub id: String,
    pub name: String,
    pub coin: String,
    pub algo: String,
    pub pool_addr: String,
    pub wallet: String,
    pub miner_args: String,
    pub gpu_mode: String,
    pub threads: u32,
    pub intensity: Option<f64>,
    pub created_at: i64,
}

// ═══════════════════════════════════════════════════════════
// LIVE BROADCAST MESSAGES
// ═══════════════════════════════════════════════════════════

/// Envelope for real-time WebSocket push events.
#[derive(Clone, Debug, Serialize)]
pub struct LiveEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub data: serde_json::Value,
}

// ═══════════════════════════════════════════════════════════
// WALLET / EARNINGS
// ═══════════════════════════════════════════════════════════

/// Earnings estimate for display in the wallet panel.
#[derive(Clone, Debug, Serialize)]
pub struct EarningsEstimate {
    pub hashrate: f64,
    pub daily_coins: f64,
    pub weekly_coins: f64,
    pub monthly_coins: f64,
    pub difficulty: u64,
    pub block_reward: f64,
    pub block_time_s: u64,
    pub net_hashrate_est: f64,
}
