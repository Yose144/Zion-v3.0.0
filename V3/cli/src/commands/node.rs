use anyhow::Result;
use clap::Subcommand;
use serde_json::json;

use crate::config::Config;
use crate::rpc::node_rpc;
use crate::ui;

#[derive(Subcommand)]
pub enum NodeCmd {
    /// Tip height, hash, peers, sync status
    Status,
    /// List connected P2P peers
    Peers,
    /// Last N blocks (default 10)
    Blocks {
        #[arg(default_value = "10")]
        n: u64,
    },
    /// Block detail by height or hash
    Block { id: String },
    /// Transaction lookup
    Tx { txid: String },
    /// Pending transactions in mempool
    Mempool,
    /// Force peer sync / bootstrap
    Sync,
    /// Raw JSON-RPC call: zion node rpc <method> [params_json]
    Rpc {
        method: String,
        #[arg(default_value = "{}")]
        params: String,
    },
}

pub async fn run(cfg: &Config, cmd: NodeCmd) -> Result<()> {
    let host = &cfg.node.rpc_host;
    let port = cfg.node.rpc_port;

    match cmd {
        NodeCmd::Status => node_status(host, port).await,
        NodeCmd::Peers => node_peers(host, port).await,
        NodeCmd::Blocks { n } => node_blocks(host, port, n).await,
        NodeCmd::Block { id } => node_block(host, port, &id).await,
        NodeCmd::Tx { txid } => node_tx(host, port, &txid).await,
        NodeCmd::Mempool => node_mempool(host, port).await,
        NodeCmd::Sync => {
            ui::print_info("Triggering peer sync...");
            let result = node_rpc::call0(host, port, "sync_peers").await;
            match result {
                Ok(v) => { ui::print_ok("Sync triggered"); println!("  {}", v); }
                Err(e) => ui::print_err(&format!("{}", e)),
            }
            Ok(())
        }
        NodeCmd::Rpc { method, params } => {
            let params_val: serde_json::Value = serde_json::from_str(&params)
                .unwrap_or(json!({}));
            let result = node_rpc::call(host, port, &method, params_val).await?;
            println!("{}", serde_json::to_string_pretty(&result)?);
            Ok(())
        }
    }
}

async fn node_status(host: &str, port: u16) -> Result<()> {
    ui::print_header("Node Status");

    let stats = node_rpc::call0(host, port, "getChainInfo").await;
    match stats {
        Ok(v) => {
            let height = v["height"].as_u64().unwrap_or(0);
            let hash = v["tip_hash"].as_str().unwrap_or("unknown");
            let peers = v["peer_count"].as_u64().unwrap_or(0);
            let version = v["version"].as_str().unwrap_or("v3");

            ui::print_row("Node", &format!("zion-core {}", version));
            ui::print_row("Height", &format!("{}", height));
            ui::print_row("Tip", &format!("{}...", &hash[..hash.len().min(16)]));
            ui::print_row("Peers", &format!("{} connected", peers));
            ui::print_ok("Reachable");
        }
        Err(e) => {
            ui::print_err(&format!("Cannot reach {}:{} — {}", host, port, e));
        }
    }
    println!();
    Ok(())
}

async fn node_peers(host: &str, port: u16) -> Result<()> {
    ui::print_header("Peers");
    let result = node_rpc::call0(host, port, "getPeerInfo").await?;
    if let Some(peers) = result.as_array() {
        if peers.is_empty() {
            ui::print_warn("No peers connected");
        }
        for p in peers {
            let addr = p["addr"].as_str().unwrap_or("unknown");
            let height = p["height"].as_u64().unwrap_or(0);
            println!("  {} height={}", addr, height);
        }
    } else {
        println!("{}", serde_json::to_string_pretty(&result)?);
    }
    println!();
    Ok(())
}

async fn node_blocks(host: &str, port: u16, n: u64) -> Result<()> {
    ui::print_header(&format!("Last {} blocks", n));

    let stats = node_rpc::call0(host, port, "getChainInfo").await?;
    let height = stats["chain_height"].as_u64().unwrap_or(0);

    for h in (height.saturating_sub(n - 1)..=height).rev() {
        let block = node_rpc::call(host, port, "getBlockByHeight", json!({ "height": h })).await;
        match block {
            Ok(b) => {
                let hash = b["hash"].as_str().unwrap_or("?");
                let ts = b["timestamp"].as_u64().unwrap_or(0);
                let txs = b["transactions"].as_array().map(|a| a.len()).unwrap_or(0);
                let short_hash = if hash.len() > 16 { &hash[..16] } else { hash };
                println!("  {:>7}  {}...  ts={}  txs={}", h, short_hash, ts, txs);
            }
            Err(e) => println!("  {:>7}  error: {}", h, e),
        }
    }
    println!();
    Ok(())
}

async fn node_block(host: &str, port: u16, id: &str) -> Result<()> {
    ui::print_header(&format!("Block {}", id));
    let result = if id.chars().all(|c| c.is_ascii_digit()) {
        let h: u64 = id.parse()?;
        node_rpc::call(host, port, "getBlockByHeight", json!({ "height": h })).await?
    } else {
        node_rpc::call(host, port, "getBlock", json!({ "hash": id })).await?
    };
    println!("{}", serde_json::to_string_pretty(&result)?);
    println!();
    Ok(())
}

async fn node_tx(host: &str, port: u16, txid: &str) -> Result<()> {
    ui::print_header(&format!("Transaction {}", txid));
    let result = node_rpc::call(host, port, "get_transaction", json!({ "txid": txid })).await?;
    println!("{}", serde_json::to_string_pretty(&result)?);
    println!();
    Ok(())
}

async fn node_mempool(host: &str, port: u16) -> Result<()> {
    ui::print_header("Mempool");
    let result = node_rpc::call0(host, port, "getMempoolInfo").await?;
    let txs = result.as_array().map(|a| a.len()).unwrap_or(0);
    ui::print_row("Pending txs", &txs.to_string());
    if txs > 0 {
        println!("{}", serde_json::to_string_pretty(&result)?);
    }
    println!();
    Ok(())
}
