use crate::{config::AgentConfig, ui};
use anyhow::Result;
use colored::Colorize;
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
            check_all(&services).await?;
            sleep(Duration::from_secs(30)).await;
        }
    } else {
        check_all(&services).await?;
    }

    Ok(())
}

async fn check_all(services: &[String]) -> Result<()> {
    for svc in services {
        match svc.as_str() {
            "node" => {
                // Try local RPC
                match check_node().await {
                    Ok(info) => ui::print_ok(&format!("Node: {}", info)),
                    Err(e) => ui::print_warn(&format!("Node: {}", e)),
                }
            }
            "pool" => {
                match check_pool().await {
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

async fn check_node() -> Result<String> {
    // Placeholder: would call zion node RPC
    Ok("SYNCED (placeholder)".into())
}

async fn check_pool() -> Result<String> {
    // Placeholder
    Ok("ONLINE (placeholder)".into())
}

async fn check_miner() -> Result<String> {
    // Placeholder
    Ok("RUNNING (placeholder)".into())
}
