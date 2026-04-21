use anyhow::Result;

use crate::config::Config;
use crate::rpc::{agent_rpc, node_rpc};
use crate::ui;

/// `zion status` — health check across all layers
pub async fn run(cfg: &Config) -> Result<()> {
    ui::print_banner();
    ui::print_header("Stack Status");

    // ── L1: Core Node ──────────────────────────────────────────────
    let node_result = node_rpc::call0(&cfg.node.rpc_host, cfg.node.rpc_port, "getChainInfo").await;
    match node_result {
        Ok(v) => {
            let height = v["chain_height"].as_u64().unwrap_or(0);
            let hash = v["tip_hash"].as_str().unwrap_or("?");
            let peers_v = node_rpc::call0(&cfg.node.rpc_host, cfg.node.rpc_port, "getNodeInfo").await;
            let peers = peers_v.as_ref().ok().and_then(|p| p["known_peers"].as_u64()).unwrap_or(0);
            let short = if hash.len() > 12 { &hash[..12] } else { hash };
            ui::print_ok(&format!(
                "L1 node      height={} peers={} tip={}...",
                height, peers, short
            ));
        }
        Err(e) => ui::print_err(&format!("L1 node      {}:{} — {}", cfg.node.rpc_host, cfg.node.rpc_port, e)),
    }

    // ── L1: Pool ───────────────────────────────────────────────────
    let pool_result = node_rpc::call0(&cfg.node.rpc_host, cfg.node.rpc_port, "getMempoolInfo").await;
    match pool_result {
        Ok(v) => {
            let txs = v["tx_count"].as_u64().or_else(|| v["mempool_transactions"].as_u64()).unwrap_or(0);
            ui::print_ok(&format!("L1 mempool   txs={} stratum :{}", txs, cfg.pool.port));
        }
        Err(_) => ui::print_warn(&format!("L1 pool      stratum :{}  (stratum only, no HTTP API)", cfg.pool.port)),
    }

    // ── L3: Hiranyagarbha Agent ────────────────────────────────────
    let alive = agent_rpc::health(&cfg.agent.url).await.unwrap_or(false);
    if alive {
        ui::print_ok(&format!("L3 agent     Hiranyagarbha online  {}", cfg.agent.url));
    } else {
        ui::print_warn(&format!("L3 agent     Hiranyagarbha unreachable  {}", cfg.agent.url));
    }

    println!();
    ui::print_info(&format!("Config: {}  (zion config show)", "~/.zion/zion.toml"));
    println!();
    Ok(())
}
