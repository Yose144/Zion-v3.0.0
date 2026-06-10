//! Miner stdout parser — extrahuje hashrate, shares, GPU stav z miner logu.
//!
//! Miner vypisuje strukturované řádky:
//!   accepted_shares=42
//!   rejected_shares=3
//!   hashrate_hps=1500.50
//!   hashrate_10s_hps=1450.00
//!   hashrate_60s_hps=1480.00
//!   hashrate_15m_hps=1490.00
//!   hashrate_fmt=1.50 KH/s
//!   share_status=Accepted
//!   share_status=RejectedLowDifficulty
//!   gpu_temp=65.0
//!   gpu_power=145.5

use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::ChildStdout;
use tokio::sync::RwLock;
use tracing::{debug, trace};

/// Aktuální stav mineru — čte se z stdout.
#[derive(Debug, Clone, Default)]
pub struct MinerStats {
    pub hashrate_hps: f64,
    pub hashrate_10s: f64,
    pub hashrate_60s: f64,
    pub hashrate_15m: f64,
    pub accepted_shares: u64,
    pub rejected_shares: u64,
    pub attempted_hashes: u64,
    pub elapsed_seconds: f64,
    pub last_share_status: Option<String>,
    pub last_update: Option<chrono::DateTime<chrono::Utc>>,
    // GPU per-device
    pub gpu_temps: Vec<f32>,
    pub gpu_power: Vec<f32>,
    pub gpu_hashrate: Vec<f64>,
    pub current_algorithm: String,
}

impl MinerStats {
    pub fn total_shares(&self) -> u64 {
        self.accepted_shares + self.rejected_shares
    }

    pub fn accept_rate(&self) -> f64 {
        let total = self.total_shares();
        if total == 0 {
            0.0
        } else {
            self.accepted_shares as f64 / total as f64 * 100.0
        }
    }

    pub fn is_stale(&self, timeout_sec: u64) -> bool {
        match self.last_update {
            Some(t) => {
                chrono::Utc::now().signed_duration_since(t).num_seconds() as u64 > timeout_sec
            }
            None => true,
        }
    }
}

/// Spustí async task, který čte stdout mineru a parsová statistiky.
pub fn spawn_stdout_parser(
    stdout: ChildStdout,
    stats: Arc<RwLock<MinerStats>>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            trace!("miner stdout: {}", line);
            parse_line(&line, &stats).await;
        }

        debug!("Miner stdout parser ukoncen");
    })
}

pub async fn parse_line(line: &str, stats: &Arc<RwLock<MinerStats>>) {
    let parts: Vec<&str> = line.splitn(2, '=').collect();
    if parts.len() != 2 {
        return;
    }

    let key = parts[0].trim();
    let value = parts[1].trim();

    let mut s = stats.write().await;
    s.last_update = Some(chrono::Utc::now());

    match key {
        "hashrate_hps" => {
            if let Ok(v) = value.parse::<f64>() {
                s.hashrate_hps = v;
            }
        }
        "hashrate_10s_hps" => {
            if let Ok(v) = value.parse::<f64>() {
                s.hashrate_10s = v;
            }
        }
        "hashrate_60s_hps" => {
            if let Ok(v) = value.parse::<f64>() {
                s.hashrate_60s = v;
            }
        }
        "hashrate_15m_hps" => {
            if let Ok(v) = value.parse::<f64>() {
                s.hashrate_15m = v;
            }
        }
        "accepted_shares" => {
            if let Ok(v) = value.parse::<u64>() {
                s.accepted_shares = v;
            }
        }
        "rejected_shares" => {
            if let Ok(v) = value.parse::<u64>() {
                s.rejected_shares = v;
            }
        }
        "attempted_hashes" => {
            if let Ok(v) = value.parse::<u64>() {
                s.attempted_hashes = v;
            }
        }
        "elapsed_seconds" => {
            if let Ok(v) = value.parse::<f64>() {
                s.elapsed_seconds = v;
            }
        }
        "share_status" => {
            s.last_share_status = Some(value.trim_matches('"').to_string());
        }
        // GPU metrics from miner stdout (if it outputs them)
        "gpu_temp" => {
            if let Ok(v) = value.parse::<f32>() {
                if s.gpu_temps.is_empty() {
                    s.gpu_temps.push(v);
                } else {
                    s.gpu_temps[0] = v;
                }
            }
        }
        "gpu_power" => {
            if let Ok(v) = value.parse::<f32>() {
                if s.gpu_power.is_empty() {
                    s.gpu_power.push(v);
                } else {
                    s.gpu_power[0] = v;
                }
            }
        }
        "gpu_hashrate" => {
            if let Ok(v) = value.parse::<f64>() {
                if s.gpu_hashrate.is_empty() {
                    s.gpu_hashrate.push(v);
                } else {
                    s.gpu_hashrate[0] = v;
                }
            }
        }
        "algorithm" => {
            s.current_algorithm = value.trim_matches('"').to_string();
        }
        _ => {}
    }
}
