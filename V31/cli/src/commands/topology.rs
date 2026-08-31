use anyhow::Result;
use clap::Subcommand;

use crate::rpc::agent_rpc;
use crate::ui;

/// Network topology — peers, chains, and cross-chain connections.
#[derive(Subcommand)]
pub enum TopologyCmd {
    /// Show P2P peers connected to the local node
    Peers,
    /// Show registered chains in the multichain layer
    Chains,
    /// Show full topology graph (peers + chains + bridges)
    Full,
}

pub async fn run(cmd: TopologyCmd, node_rpc: &str, mc_url: &str) -> Result<()> {
    match cmd {
        TopologyCmd::Peers => {
            ui::print_header("P2P Peers");
            let url = format!("http://{}", node_rpc);
            let req = serde_json::json!({"jsonrpc":"2.0","method":"getPeers","params":null,"id":1});
            match agent_rpc::post(&url, "", req).await {
                Ok(v) => {
                    if let Some(peers) = v["result"]["peers"].as_array() {
                        for p in peers {
                            let addr = p["address"].as_str().unwrap_or("?");
                            let ver = p["version"].as_str().unwrap_or("?");
                            let height = p["height"].as_u64().unwrap_or(0);
                            println!("  {:40} v{}  height={}", addr, ver, height);
                        }
                        if peers.is_empty() {
                            ui::print_info("No peers connected.");
                        }
                    } else {
                        println!("{}", serde_json::to_string_pretty(&v)?);
                    }
                }
                Err(e) => ui::print_warn(&format!("Node unavailable: {}", e)),
            }
            println!();
        }
        TopologyCmd::Chains => {
            ui::print_header("Registered Chains");
            let url = format!("http://{}", mc_url);
            match agent_rpc::get(&url, "chains").await {
                Ok(v) => {
                    if let Some(arr) = v.as_array() {
                        for c in arr {
                            let id = c["id"].as_str().unwrap_or("?");
                            let name = c["name"].as_str().unwrap_or("?");
                            let healthy = c["healthy"].as_bool().unwrap_or(false);
                            let status = if healthy { "✓" } else { "✗" };
                            println!("  {} {:12} {}", status, id, name);
                        }
                        if arr.is_empty() {
                            ui::print_info("No chains registered.");
                        }
                    } else {
                        println!("{}", serde_json::to_string_pretty(&v)?);
                    }
                }
                Err(e) => ui::print_warn(&format!("Multichain unavailable: {}", e)),
            }
            println!();
        }
        TopologyCmd::Full => {
            ui::print_header("Full Network Topology");
            // Peers
            let node_url = format!("http://{}", node_rpc);
            let req = serde_json::json!({"jsonrpc":"2.0","method":"getPeers","params":null,"id":1});
            if let Ok(v) = agent_rpc::post(&node_url, "", req).await {
                if let Some(peers) = v["result"]["peers"].as_array() {
                    ui::print_info(&format!("P2P Peers: {}", peers.len()));
                    for p in peers {
                        let addr = p["address"].as_str().unwrap_or("?");
                        println!("    {}", addr);
                    }
                }
            }
            // Chains
            let mc = format!("http://{}", mc_url);
            if let Ok(v) = agent_rpc::get(&mc, "chains").await {
                if let Some(arr) = v.as_array() {
                    ui::print_info(&format!("Multichain adapters: {}", arr.len()));
                    for c in arr {
                        let id = c["id"].as_str().unwrap_or("?");
                        let healthy = c["healthy"].as_bool().unwrap_or(false);
                        let status = if healthy { "✓" } else { "✗" };
                        println!("    {} {}", status, id);
                    }
                }
            }
            println!();
        }
    }
    Ok(())
}
