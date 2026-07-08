use anyhow::Result;
use clap::Subcommand;

use crate::config::Config;
use crate::ui;

#[derive(Subcommand)]
pub enum IssobellaCmd {
    /// Health check the Issobella daemon
    Status,
    /// List all missions
    Missions,
    /// List all research proposals
    Proposals,
    /// Show fund balance
    Balance,
}

pub async fn run(_cfg: &Config, cmd: IssobellaCmd) -> Result<()> {
    let base = "http://127.0.0.1:8096";
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    match cmd {
        IssobellaCmd::Status => {
            let resp = client.get(format!("{}/health", base)).send().await;
            match resp {
                Ok(r) if r.status().is_success() => ui::print_ok("Issobella daemon is healthy"),
                Ok(r) => ui::print_err(&format!("Issobella unhealthy: {}", r.status())),
                Err(e) => ui::print_err(&format!("Issobella unreachable: {}", e)),
            }
        }
        IssobellaCmd::Missions => {
            match client.get(format!("{}/api/v1/missions", base)).send().await {
                Ok(r) if r.status().is_success() => {
                    let json: serde_json::Value = r.json().await?;
                    if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                        ui::print_header(&format!("Missions ({})", data.len()));
                        for m in data.iter().take(20) {
                            let name = m["name"].as_str().unwrap_or("?");
                            let status = m["status"].as_str().unwrap_or("?");
                            let budget = m["budget_zion"].as_u64().unwrap_or(0);
                            let mtype = m["mission_type"].as_str().unwrap_or("?");
                            println!("  [{}] {} ({}) — {} ZION", status, name, mtype, budget);
                        }
                    } else {
                        ui::print_info("No missions found");
                    }
                }
                Ok(r) => ui::print_err(&format!("HTTP error: {}", r.status())),
                Err(e) => ui::print_err(&format!("Connection error: {}", e)),
            }
        }
        IssobellaCmd::Proposals => {
            match client
                .get(format!("{}/api/v1/proposals", base))
                .send()
                .await
            {
                Ok(r) if r.status().is_success() => {
                    let json: serde_json::Value = r.json().await?;
                    if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                        ui::print_header(&format!("Research Proposals ({})", data.len()));
                        for p in data.iter().take(20) {
                            let title = p["title"].as_str().unwrap_or("?");
                            let status = p["status"].as_str().unwrap_or("?");
                            let budget = p["requested_budget"].as_u64().unwrap_or(0);
                            println!("  [{}] {} — {} ZION", status, title, budget);
                        }
                    } else {
                        ui::print_info("No proposals found");
                    }
                }
                Ok(r) => ui::print_err(&format!("HTTP error: {}", r.status())),
                Err(e) => ui::print_err(&format!("Connection error: {}", e)),
            }
        }
        IssobellaCmd::Balance => {
            match client
                .get(format!("{}/api/v1/fund/balance", base))
                .send()
                .await
            {
                Ok(r) if r.status().is_success() => {
                    let json: serde_json::Value = r.json().await?;
                    if let Some(data) = json.get("data") {
                        let acc = data["total_accumulated"].as_u64().unwrap_or(0);
                        let dis = data["total_disbursed"].as_u64().unwrap_or(0);
                        let height = data["last_block_height"].as_u64().unwrap_or(0);
                        ui::print_header("Issobella Fund Balance");
                        println!("  Accumulated: {} flowers", acc);
                        println!("  Disbursed:   {} flowers", dis);
                        println!("  Available:   {} flowers", acc.saturating_sub(dis));
                        println!("  Last block:  {}", height);
                    }
                }
                Ok(r) => ui::print_err(&format!("HTTP error: {}", r.status())),
                Err(e) => ui::print_err(&format!("Connection error: {}", e)),
            }
        }
    }
    Ok(())
}
