use anyhow::Result;
use clap::Subcommand;

use crate::config::Config;
use crate::ui;

#[derive(Subcommand)]
pub enum FreeWorldCmd {
    /// Health check the Free World daemon
    Status,
    /// List all grants
    Grants,
    /// List all projects
    Projects,
    /// Show fund balance
    Balance,
}

pub async fn run(cfg: &Config, cmd: FreeWorldCmd) -> Result<()> {
    let base = &cfg.free_world.url;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    match cmd {
        FreeWorldCmd::Status => {
            let resp = client.get(format!("{}/health", base)).send().await;
            match resp {
                Ok(r) if r.status().is_success() => ui::print_ok("Free World daemon is healthy"),
                Ok(r) => ui::print_err(&format!("Free World unhealthy: {}", r.status())),
                Err(e) => ui::print_err(&format!("Free World unreachable: {}", e)),
            }
        }
        FreeWorldCmd::Grants => match client.get(format!("{}/api/v1/grants", base)).send().await {
            Ok(r) if r.status().is_success() => {
                let json: serde_json::Value = r.json().await?;
                if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                    ui::print_header(&format!("Grants ({})", data.len()));
                    for g in data.iter().take(20) {
                        let title = g["title"].as_str().unwrap_or("?");
                        let status = g["status"].as_str().unwrap_or("?");
                        let amount = g["amount_zion"].as_u64().unwrap_or(0);
                        println!("  [{}] {} — {} ZION", status, title, amount);
                    }
                } else {
                    ui::print_info("No grants found");
                }
            }
            Ok(r) => ui::print_err(&format!("HTTP error: {}", r.status())),
            Err(e) => ui::print_err(&format!("Connection error: {}", e)),
        },
        FreeWorldCmd::Projects => {
            match client.get(format!("{}/api/v1/projects", base)).send().await {
                Ok(r) if r.status().is_success() => {
                    let json: serde_json::Value = r.json().await?;
                    if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                        ui::print_header(&format!("Projects ({})", data.len()));
                        for p in data.iter().take(20) {
                            let name = p["name"].as_str().unwrap_or("?");
                            let status = p["status"].as_str().unwrap_or("?");
                            let budget = p["budget_zion"].as_u64().unwrap_or(0);
                            println!("  [{}] {} — {} ZION", status, name, budget);
                        }
                    } else {
                        ui::print_info("No projects found");
                    }
                }
                Ok(r) => ui::print_err(&format!("HTTP error: {}", r.status())),
                Err(e) => ui::print_err(&format!("Connection error: {}", e)),
            }
        }
        FreeWorldCmd::Balance => {
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
                        ui::print_header("Humanitarian Fund Balance");
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
