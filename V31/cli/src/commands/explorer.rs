use anyhow::Result;
use clap::Subcommand;

use crate::ui;
use crate::rpc::agent_rpc;

/// Block explorer — query blocks, transactions, and addresses from the L1 node.
#[derive(Subcommand)]
pub enum ExplorerCmd {
    /// Show latest blocks
    Blocks {
        #[arg(short, long, default_value_t = 10)]
        count: usize,
    },
    /// Show a specific block by height
    Block { height: u64 },
    /// Show a transaction by hash
    Transaction { hash: String },
    /// Show address balance and recent transactions
    Address { address: String },
    /// Show chain status (height, peers, difficulty)
    Status,
}

pub async fn run(cmd: ExplorerCmd, node_rpc: &str) -> Result<()> {
    let url = format!("http://{}", node_rpc);

    match cmd {
        ExplorerCmd::Blocks { count } => {
            ui::print_header(&format!("Latest {} Blocks", count));
            let req = serde_json::json!({"jsonrpc":"2.0","method":"getStatus","params":null,"id":1});
            match agent_rpc::post(&url, "", req).await {
                Ok(v) => {
                    let tip = v["result"]["chain_height"].as_u64().unwrap_or(0);
                    let start = tip.saturating_sub(count as u64);
                    for h in (start..=tip).rev() {
                        let req = serde_json::json!({"jsonrpc":"2.0","method":"getBlock","params":{"height":h},"id":1});
                        if let Ok(bv) = agent_rpc::post(&url, "", req).await {
                            let hash = bv["result"]["hash"].as_str().unwrap_or("?");
                            let txs = bv["result"]["transactions"].as_array().map(|a| a.len()).unwrap_or(0);
                            println!("  {:>8}  0x{}  ({} txs)", h, &hash[..hash.len().min(16)], txs);
                        }
                    }
                }
                Err(e) => ui::print_warn(&format!("Node unavailable: {}", e)),
            }
            println!();
        }
        ExplorerCmd::Block { height } => {
            ui::print_header(&format!("Block #{}", height));
            let req = serde_json::json!({"jsonrpc":"2.0","method":"getBlock","params":{"height":height},"id":1});
            match agent_rpc::post(&url, "", req).await {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Block not found: {}", e)),
            }
            println!();
        }
        ExplorerCmd::Transaction { hash } => {
            ui::print_header(&format!("Transaction {}", hash));
            let req = serde_json::json!({"jsonrpc":"2.0","method":"getTransaction","params":{"hash":hash},"id":1});
            match agent_rpc::post(&url, "", req).await {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Transaction not found: {}", e)),
            }
            println!();
        }
        ExplorerCmd::Address { address } => {
            ui::print_header(&format!("Address {}", address));
            let req = serde_json::json!({"jsonrpc":"2.0","method":"getUtxos","params":{"address":address},"id":1});
            match agent_rpc::post(&url, "", req).await {
                Ok(v) => {
                    if let Some(utxos) = v["result"]["utxos"].as_array() {
                        let total: u64 = utxos.iter().filter_map(|u| u["amount"].as_u64()).sum();
                        ui::print_row("Balance", &format!("{} flowers ({} ZION)", total, total as f64 / 1_000_000.0));
                        ui::print_row("UTXOs", &utxos.len().to_string());
                    }
                }
                Err(e) => ui::print_warn(&format!("Address lookup failed: {}", e)),
            }
            println!();
        }
        ExplorerCmd::Status => {
            ui::print_header("Chain Status");
            let req = serde_json::json!({"jsonrpc":"2.0","method":"getStatus","params":null,"id":1});
            match agent_rpc::post(&url, "", req).await {
                Ok(v) => {
                    if let Some(h) = v["result"]["chain_height"].as_u64() {
                        ui::print_row("Height", &h.to_string());
                    }
                    if let Some(p) = v["result"]["peers"].as_u64() {
                        ui::print_row("Peers", &p.to_string());
                    }
                    if let Some(d) = v["result"]["difficulty"].as_f64() {
                        ui::print_row("Difficulty", &format!("{:.4}", d));
                    }
                    if let Some(h) = v["result"]["hashrate"].as_f64() {
                        ui::print_row("Hashrate", &format!("{:.2} H/s", h));
                    }
                }
                Err(e) => ui::print_warn(&format!("Node unavailable: {}", e)),
            }
            println!();
        }
    }
    Ok(())
}
