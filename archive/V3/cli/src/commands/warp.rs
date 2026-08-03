use anyhow::Result;
use clap::Subcommand;

use crate::config::Config;
use crate::rpc::agent_rpc;
use crate::ui;

fn warp_base(cfg: &Config) -> String {
    // Warp routes live inside the AI Native agent at /warp/*
    cfg.agent.url.trim_end_matches('/').to_string()
}

#[derive(Subcommand)]
pub enum WarpCmd {
    /// Warp router health + chain registry
    Status,
    /// List registered chains
    Chains,
    /// Get chain details by ID
    Chain { chain_id: String },
    /// List pending cross-chain warp messages
    Pending,
    /// Get warp message by ID
    Get { id: String },
    /// Relay stats (throughput, errors)
    Stats,
    /// Validator set for a chain
    Validators { chain_id: String },
}

pub async fn run(cfg: &Config, cmd: WarpCmd) -> Result<()> {
    let base = warp_base(cfg);

    match cmd {
        WarpCmd::Status => {
            ui::print_header("ZION Warp (L3)");
            let alive = agent_rpc::health(&base).await.unwrap_or(false);
            if !alive {
                ui::print_err(&format!("AI Native agent unreachable at {}", base));
                ui::print_info("Start with: zion agent start");
                return Ok(());
            }
            let v = agent_rpc::get(&base, "warp/status").await;
            match v {
                Ok(v) => {
                    if let Some(chains) = v["registered_chains"].as_u64() {
                        ui::print_row("Registered chains", &chains.to_string());
                    }
                    if let Some(pending) = v["pending_messages"].as_u64() {
                        ui::print_row("Pending messages", &pending.to_string());
                    }
                    if let Some(relayed) = v["total_relayed"].as_u64() {
                        ui::print_row("Total relayed", &relayed.to_string());
                    }
                    if let Some(mode) = v["mode"].as_str() {
                        ui::print_row("Mode", mode);
                    }
                    println!("{}", serde_json::to_string_pretty(&v)?);
                }
                Err(e) => ui::print_warn(&format!("Warp status unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        WarpCmd::Chains => {
            ui::print_header("Warp — Registered Chains");
            let v = agent_rpc::get(&base, "warp/chains").await;
            match v {
                Ok(v) => {
                    if let Some(arr) = v.as_array() {
                        for c in arr {
                            let name = c["name"].as_str().unwrap_or("?");
                            let id = c["chain_id"].as_str().unwrap_or("?");
                            let rpc = c["rpc_url"].as_str().unwrap_or("-");
                            println!("  [{id}] {name}  rpc={rpc}");
                        }
                        if arr.is_empty() {
                            ui::print_info("No chains registered.");
                        }
                    } else {
                        println!("{}", serde_json::to_string_pretty(&v)?);
                    }
                }
                Err(e) => ui::print_warn(&format!("Warp unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        WarpCmd::Chain { chain_id } => {
            ui::print_header(&format!("Chain: {}", chain_id));
            let v = agent_rpc::get(&base, &format!("warp/chains/{}", chain_id)).await;
            match v {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Chain not found: {}", e)),
            }
            println!();
            Ok(())
        }
        WarpCmd::Pending => {
            ui::print_header("Warp — Pending Messages");
            let v = agent_rpc::get(&base, "warp/messages/pending").await;
            match v {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Warp unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        WarpCmd::Get { id } => {
            ui::print_header(&format!("Warp Message: {}", id));
            let v = agent_rpc::get(&base, &format!("warp/messages/{}", id)).await;
            match v {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Message not found: {}", e)),
            }
            println!();
            Ok(())
        }
        WarpCmd::Stats => {
            ui::print_header("Warp Relay Stats");
            let v = agent_rpc::get(&base, "warp/stats").await;
            match v {
                Ok(v) => {
                    if let Some(tps) = v["messages_per_sec"].as_f64() {
                        ui::print_row("Throughput", &format!("{:.2} msg/s", tps));
                    }
                    if let Some(err) = v["error_rate"].as_f64() {
                        ui::print_row("Error rate", &format!("{:.2}%", err * 100.0));
                    }
                    println!("{}", serde_json::to_string_pretty(&v)?);
                }
                Err(e) => ui::print_warn(&format!("Warp unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        WarpCmd::Validators { chain_id } => {
            ui::print_header(&format!("Validators for chain: {}", chain_id));
            let v = agent_rpc::get(&base, &format!("warp/chains/{}/validators", chain_id)).await;
            match v {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Warp unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
    }
}
