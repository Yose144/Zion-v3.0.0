use anyhow::Result;
use clap::Subcommand;

use crate::ui;
use crate::rpc::agent_rpc;

/// Monitor ZION services health in real-time.
#[derive(Subcommand)]
pub enum MonitorCmd {
    /// Show health of all V31 services (node, pool, multichain, dao)
    Health,
    /// Show mining pool stats
    Pool,
    /// Show node sync status
    Sync,
    /// Watch mode — refresh every N seconds
    Watch {
        #[arg(short, long, default_value_t = 5)]
        interval: u64,
    },
}

pub async fn run(cmd: MonitorCmd, node_rpc: &str, pool_url: &str, mc_url: &str, dao_url: &str) -> Result<()> {
    match cmd {
        MonitorCmd::Health => {
            ui::print_header("ZION V31 Service Health");
            let endpoints = [
                ("Node L1",    format!("http://{}", node_rpc)),
                ("Pool",       format!("http://{}", pool_url)),
                ("Multichain", format!("http://{}", mc_url)),
                ("DAO",        format!("http://{}", dao_url)),
            ];
            for (name, url) in &endpoints {
                let alive = agent_rpc::health(url).await.unwrap_or(false);
                if alive {
                    ui::print_ok(&format!("{} — online", name));
                } else {
                    ui::print_err(&format!("{} — unreachable ({})", name, url));
                }
            }
            println!();
        }
        MonitorCmd::Pool => {
            ui::print_header("Pool Stats");
            let url = format!("http://{}", pool_url);
            match agent_rpc::get(&url, "stats").await {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Pool unavailable: {}", e)),
            }
            println!();
        }
        MonitorCmd::Sync => {
            ui::print_header("Node Sync Status");
            let url = format!("http://{}", node_rpc);
            let req = serde_json::json!({"jsonrpc":"2.0","method":"getStatus","params":null,"id":1});
            match agent_rpc::post(&url, "", req).await {
                Ok(v) => {
                    if let Some(h) = v["result"]["chain_height"].as_u64() {
                        ui::print_row("Chain height", &h.to_string());
                    }
                    if let Some(p) = v["result"]["peers"].as_u64() {
                        ui::print_row("Peers", &p.to_string());
                    }
                }
                Err(e) => ui::print_warn(&format!("Node unavailable: {}", e)),
            }
            println!();
        }
        MonitorCmd::Watch { interval } => {
            ui::print_header("Watch mode (Ctrl-C to stop)");
            loop {
                print!("\x1b[2J\x1b[H"); // clear screen
                let endpoints = [
                    ("Node L1",    format!("http://{}", node_rpc)),
                    ("Pool",       format!("http://{}", pool_url)),
                    ("Multichain", format!("http://{}", mc_url)),
                    ("DAO",        format!("http://{}", dao_url)),
                ];
                for (name, url) in &endpoints {
                    let alive = agent_rpc::health(url).await.unwrap_or(false);
                    let status = if alive { "✓ online" } else { "✗ unreachable" };
                    println!("  {:12} {}", name, status);
                }
                println!("\n  Refreshing every {}s...", interval);
                tokio::time::sleep(std::time::Duration::from_secs(interval)).await;
            }
        }
    }
    Ok(())
}
