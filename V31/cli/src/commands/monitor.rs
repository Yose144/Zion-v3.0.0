use anyhow::Result;
use clap::Subcommand;
use serde_json::Value;

use crate::rpc::{agent_rpc, node_rpc};
use crate::ui;

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

pub async fn run(
    cmd: MonitorCmd,
    node_rpc: &str,
    pool_url: &str,
    mc_url: &str,
    dao_url: &str,
) -> Result<()> {
    match cmd {
        MonitorCmd::Health => {
            ui::print_header("ZION V31 Service Health");

            let node_alive = node_rpc::call(node_rpc, "getStatus", Value::Null)
                .await
                .is_ok();
            if node_alive {
                ui::print_ok("Node L1 — online");
            } else {
                ui::print_err(&format!("Node L1 — unreachable ({})", node_rpc));
            }

            let endpoints = [
                ("Pool", format!("http://{}", pool_url)),
                ("Multichain", format!("http://{}", mc_url)),
                ("DAO", format!("http://{}", dao_url)),
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
            match node_rpc::call(node_rpc, "getStatus", Value::Null).await {
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

                let node_alive = node_rpc::call(node_rpc, "getStatus", Value::Null)
                    .await
                    .is_ok();
                let node_status = if node_alive {
                    "✓ online"
                } else {
                    "✗ unreachable"
                };
                println!("  {:12} {}", "Node L1", node_status);

                let endpoints = [
                    ("Pool", format!("http://{}", pool_url)),
                    ("Multichain", format!("http://{}", mc_url)),
                    ("DAO", format!("http://{}", dao_url)),
                ];
                for (name, url) in &endpoints {
                    let alive = agent_rpc::health(url).await.unwrap_or(false);
                    let status = if alive {
                        "✓ online"
                    } else {
                        "✗ unreachable"
                    };
                    println!("  {:12} {}", name, status);
                }
                println!("\n  Refreshing every {}s...", interval);
                tokio::time::sleep(std::time::Duration::from_secs(interval)).await;
            }
        }
    }
    Ok(())
}
