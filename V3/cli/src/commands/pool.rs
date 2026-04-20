use anyhow::Result;
use clap::Subcommand;
use serde_json::json;

use crate::config::Config;
use crate::rpc::node_rpc;
use crate::ui;

#[derive(Subcommand)]
pub enum PoolCmd {
    /// Pool stats: connected miners, hashrate, shares
    Stats,
    /// List active workers and hashrate
    Miners,
    /// Show pool config
    Config,
    /// PPLNS earnings for an address
    Earnings {
        #[arg(long)]
        address: Option<String>,
    },
}

pub async fn run(cfg: &Config, cmd: PoolCmd) -> Result<()> {
    match cmd {
        PoolCmd::Stats => pool_stats(cfg).await,
        PoolCmd::Miners => pool_miners(cfg).await,
        PoolCmd::Config => {
            ui::print_header("Pool Config");
            ui::print_row("Host", &cfg.pool.host);
            ui::print_row("Port", &cfg.pool.port.to_string());
            ui::print_row("Algorithm", "cosmic_harmony_ekam_deeksha_v2");
            println!();
            Ok(())
        }
        PoolCmd::Earnings { address } => {
            ui::print_header("PPLNS Earnings");
            let addr = address.unwrap_or_else(|| cfg.miner.wallet.clone());
            if addr.is_empty() {
                ui::print_warn("No address specified. Use --address <addr>");
                return Ok(());
            }
            // Query pool stats endpoint on node RPC for now
            let result = node_rpc::call(
                &cfg.node.rpc_host,
                cfg.node.rpc_port,
                "get_miner_stats",
                json!({ "address": addr }),
            ).await;
            match result {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Pool earnings not available: {}", e)),
            }
            println!();
            Ok(())
        }
    }
}

async fn pool_stats(cfg: &Config) -> Result<()> {
    ui::print_header("Pool Stats");

    // Try pool stats via node RPC (pool and core co-located on same host)
    let result = node_rpc::call0(
        &cfg.node.rpc_host,
        cfg.node.rpc_port,
        "get_pool_stats",
    ).await;

    match result {
        Ok(v) => {
            let miners = v["connected_miners"].as_u64().unwrap_or(0);
            let hashrate = v["total_hashrate"].as_f64().unwrap_or(0.0);
            let accepted = v["accepted_shares"].as_u64().unwrap_or(0);
            let rejected = v["rejected_shares"].as_u64().unwrap_or(0);
            let total = accepted + rejected;
            let ratio = if total > 0 {
                format!("{:.1}%", accepted as f64 / total as f64 * 100.0)
            } else {
                "—".into()
            };

            ui::print_row("Port", &format!("{} (stratum v3)", cfg.pool.port));
            ui::print_row("Miners", &format!("{} connected", miners));
            ui::print_row("Hashrate", &format!("{:.1} kH/s", hashrate / 1000.0));
            ui::print_row("Shares", &format!("{} accepted / {} rejected ({})", accepted, rejected, ratio));
            ui::print_row("Algorithm", "cosmic_harmony_ekam_deeksha_v2");
            ui::print_ok("Pool reachable");
        }
        Err(e) => {
            ui::print_warn(&format!("Pool stats unavailable: {}", e));
            ui::print_info(&format!("Pool stratum at {}:{}", cfg.pool.host, cfg.pool.port));
        }
    }
    println!();
    Ok(())
}

async fn pool_miners(cfg: &Config) -> Result<()> {
    ui::print_header("Active Miners");

    let result = node_rpc::call0(
        &cfg.node.rpc_host,
        cfg.node.rpc_port,
        "get_miners",
    ).await;

    match result {
        Ok(v) => {
            if let Some(miners) = v.as_array() {
                if miners.is_empty() {
                    ui::print_warn("No miners connected");
                } else {
                    println!("  {:<24} {:<16} {}", "Worker", "Hashrate", "Shares");
                    println!("  {}", "─".repeat(52));
                    for m in miners {
                        let worker = m["worker_name"].as_str().unwrap_or("?");
                        let hs = m["hashrate"].as_f64().unwrap_or(0.0);
                        let shares = m["accepted_shares"].as_u64().unwrap_or(0);
                        println!("  {:<24} {:<16} {}", worker, format!("{:.1} kH/s", hs / 1000.0), shares);
                    }
                }
            } else {
                println!("{}", serde_json::to_string_pretty(&v)?);
            }
        }
        Err(e) => ui::print_warn(&format!("Cannot fetch miners: {}", e)),
    }
    println!();
    Ok(())
}
