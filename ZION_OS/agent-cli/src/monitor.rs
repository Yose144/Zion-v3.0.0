use crate::{config::AgentConfig, ui};
use anyhow::Result;
use colored::Colorize;
use serde_json::json;
use tokio::time::{sleep, Duration};

pub async fn run(cfg: &AgentConfig, watch: Option<String>, daemon: bool) -> Result<()> {
    let services: Vec<String> = watch
        .map(|s| s.split(',').map(|x| x.trim().to_string()).collect())
        .unwrap_or_else(|| vec!["node".into(), "pool".into(), "miner".into()]);

    ui::print_header("ZION Agent — Infrastructure Monitor");
    println!("  Watching: {}", services.join(", ").dimmed());
    println!();

    if daemon {
        ui::print_info("Running in daemon mode (Ctrl+C to stop)...");
        loop {
            check_all(cfg, &services).await?;
            sleep(Duration::from_secs(30)).await;
        }
    } else {
        check_all(cfg, &services).await?;
    }

    Ok(())
}

async fn check_all(cfg: &AgentConfig, services: &[String]) -> Result<()> {
    for svc in services {
        match svc.as_str() {
            "node" => {
                match check_node(cfg).await {
                    Ok(info) => ui::print_ok(&format!("Node: {}", info)),
                    Err(e) => ui::print_warn(&format!("Node: {}", e)),
                }
            }
            "pool" => {
                match check_pool(cfg).await {
                    Ok(info) => ui::print_ok(&format!("Pool: {}", info)),
                    Err(e) => ui::print_warn(&format!("Pool: {}", e)),
                }
            }
            "miner" => {
                match check_miner().await {
                    Ok(info) => ui::print_ok(&format!("Miner: {}", info)),
                    Err(e) => ui::print_warn(&format!("Miner: {}", e)),
                }
            }
            _ => {
                ui::print_warn(&format!("Unknown service: {}", svc));
            }
        }
    }
    println!();
    Ok(())
}

async fn check_node(_cfg: &AgentConfig) -> Result<String> {
    let client = reqwest::Client::new();
    let rpc_addr = std::env::var("ZION_NODE_RPC")
        .unwrap_or_else(|_| "http://127.0.0.1:8443".into());

    let response = client
        .post(&rpc_addr)
        .header("Content-Type", "application/json")
        .json(&json!({
            "jsonrpc": "2.0",
            "method": "getChainInfo",
            "params": {},
            "id": 1
        }))
        .timeout(Duration::from_secs(5))
        .send()
        .await?;

    if !response.status().is_success() {
        return Ok(format!("RPC error: {}", response.status()));
    }

    let data: serde_json::Value = response.json().await?;
    let result = data.get("result").ok_or_else(|| anyhow::anyhow!("No result"))?;

    let height = result.get("chain_height").and_then(|v| v.as_u64()).unwrap_or(0);
    let accepted = result.get("accepted_blocks").and_then(|v| v.as_u64()).unwrap_or(0);
    let profile = result
        .get("consensus_profile")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let mempool = result
        .get("mempool_transactions")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    let status = if accepted > 0 { "SYNCED" } else { "BOOT" };

    Ok(format!(
        "{} | height={} accepted={} profile={} mempool={}",
        status, height, accepted, profile, mempool
    ))
}

async fn check_pool(_cfg: &AgentConfig) -> Result<String> {
    let client = reqwest::Client::new();
    let metrics_addr = std::env::var("ZION_POOL_METRICS")
        .unwrap_or_else(|_| "http://127.0.0.1:8455".into());

    let response = client
        .get(&metrics_addr)
        .timeout(Duration::from_secs(5))
        .send()
        .await;

    match response {
        Ok(r) if r.status().is_success() => {
            let text = r.text().await.unwrap_or_default();
            // Quick parse of key metrics
            let mut sessions = 0u64;
            let mut hashrate = 0.0f64;
            let mut blocks_found = 0u64;
            for line in text.lines() {
                if let Some(v) = line.strip_prefix("zion_pool_active_sessions ") {
                    sessions = v.parse().unwrap_or(0);
                }
                if let Some(v) = line.strip_prefix("zion_pool_hashrate_kh ") {
                    hashrate = v.parse().unwrap_or(0.0);
                }
                if let Some(v) = line.strip_prefix("zion_pool_blocks_found ") {
                    blocks_found = v.parse().unwrap_or(0);
                }
            }
            Ok(format!(
                "ONLINE | sessions={} hashrate={:.1}KH/s blocks={}",
                sessions, hashrate, blocks_found
            ))
        }
        Ok(r) => Ok(format!("HTTP {}", r.status())),
        Err(e) => {
            // Fallback: try direct TCP connection to pool
            let pool_addr = std::env::var("ZION_POOL_ADDR")
                .unwrap_or_else(|_| "127.0.0.1:8444".into());
            match tokio::net::TcpStream::connect(&pool_addr).await {
                Ok(_) => Ok("TCP OPEN (metrics unavailable)".into()),
                Err(_) => Err(anyhow::anyhow!("Pool unreachable: {}", e)),
            }
        }
    }
}

async fn check_miner() -> Result<String> {
    // Check if zion-miner process is running
    #[cfg(target_os = "windows")]
    {
        let output = tokio::process::Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq zion-miner.exe", "/NH"])
            .output()
            .await?;
        let text = String::from_utf8_lossy(&output.stdout);
        if text.contains("zion-miner.exe") {
            // Try to read latest hashrate from log
            let log_path = dirs::home_dir()
                .unwrap_or_default()
                .join("AppData/Roaming/zion-desktop-agent-dev/miner.log");
            if let Ok(content) = tokio::fs::read_to_string(&log_path).await {
                // Find last session_status line
                for line in content.lines().rev().take(50) {
                    if line.contains("hps_overall=") {
                        if let Some(start) = line.find("hps_overall=") {
                            let val = &line[start + 12..];
                            if let Some(end) = val.find(' ') {
                                let hps: f64 = val[..end].parse().unwrap_or(0.0);
                                return Ok(format!("RUNNING | {:.2} H/s", hps));
                            }
                        }
                    }
                }
            }
            Ok("RUNNING".into())
        } else {
            Err(anyhow::anyhow!("zion-miner.exe not found"))
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let output = tokio::process::Command::new("pgrep")
            .args(["-c", "zion-miner"])
            .output()
            .await?;
        let text = String::from_utf8_lossy(&output.stdout);
        if text.trim() != "0" {
            Ok("RUNNING".into())
        } else {
            Err(anyhow::anyhow!("zion-miner not running"))
        }
    }
}
