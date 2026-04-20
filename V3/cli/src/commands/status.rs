use anyhow::Result;

use crate::config::Config;
use crate::rpc::{agent_rpc, node_rpc};
use crate::ui;

/// `zion status` — health check across all layers
pub async fn run(cfg: &Config) -> Result<()> {
    ui::print_banner();
    ui::print_header("Stack Status");

    // ── L1: Core Node ──────────────────────────────────────────────
    let node_result = node_rpc::call0(&cfg.node.rpc_host, cfg.node.rpc_port, "get_stats").await;
    match node_result {
        Ok(v) => {
            let height = v["height"].as_u64().unwrap_or(0);
            let peers = v["peer_count"].as_u64().unwrap_or(0);
            let hash = v["tip_hash"].as_str().unwrap_or("?");
            let short = if hash.len() > 12 { &hash[..12] } else { hash };
            ui::print_ok(&format!(
                "L1 node      height={} peers={} tip={}...",
                height, peers, short
            ));
        }
        Err(e) => ui::print_err(&format!("L1 node      {}:{} — {}", cfg.node.rpc_host, cfg.node.rpc_port, e)),
    }

    // ── L1: Pool ───────────────────────────────────────────────────
    let pool_result = node_rpc::call0(&cfg.node.rpc_host, cfg.node.rpc_port, "get_pool_stats").await;
    match pool_result {
        Ok(v) => {
            let miners = v["connected_miners"].as_u64().unwrap_or(0);
            let hs = v["total_hashrate"].as_f64().unwrap_or(0.0);
            ui::print_ok(&format!(
                "L1 pool      miners={} hashrate={:.1} kH/s",
                miners, hs / 1000.0
            ));
        }
        Err(_) => ui::print_warn(&format!("L1 pool      stratum :{}  (stats via node RPC unavailable)", cfg.pool.port)),
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
