use anyhow::Result;
use std::net::ToSocketAddrs;

use crate::config::Config;
use crate::rpc::{agent_rpc, node_rpc};
use crate::ui;

/// `zion status` — health check across all layers
pub async fn run(cfg: &Config) -> Result<()> {
    ui::print_banner();
    ui::print_header("Stack Status");

    // ── Core Node ──────────────────────────────────────────────────
    let (core_host, core_rpc_port) = cfg.core_rpc();
    let core_result = node_rpc::call0(core_host, core_rpc_port, "getChainInfo").await;
    match &core_result {
        Ok(v) => {
            let height = v["chain_height"].as_u64().unwrap_or(0);
            let hash = v["tip_hash"].as_str().unwrap_or("?");
            let peers_v = node_rpc::call0(core_host, core_rpc_port, "getNodeInfo").await;
            let peers = peers_v
                .as_ref()
                .ok()
                .and_then(|p| p["known_peers"].as_u64())
                .unwrap_or(0);
            let short = if hash.len() > 12 { &hash[..12] } else { hash };
            ui::print_ok(&format!(
                "Core node    height={} peers={} tip={}...",
                height, peers, short
            ));
        }
        Err(e) => ui::print_err(&format!(
            "Core node    {}:{} — {}",
            core_host, core_rpc_port, e
        )),
    }

    // ── Edge Node ──────────────────────────────────────────────────
    let (edge_host, edge_rpc_port) = cfg.edge_rpc();
    let edge_result = node_rpc::call0(edge_host, edge_rpc_port, "getChainInfo").await;
    match &edge_result {
        Ok(v) => {
            let height = v["chain_height"].as_u64().unwrap_or(0);
            let hash = v["tip_hash"].as_str().unwrap_or("?");
            let peers_v = node_rpc::call0(edge_host, edge_rpc_port, "getNodeInfo").await;
            let peers = peers_v
                .as_ref()
                .ok()
                .and_then(|p| p["known_peers"].as_u64())
                .unwrap_or(0);
            let short = if hash.len() > 12 { &hash[..12] } else { hash };
            ui::print_ok(&format!(
                "Edge node    height={} peers={} tip={}...",
                height, peers, short
            ));
        }
        Err(e) => ui::print_err(&format!(
            "Edge node    {}:{} — {}",
            edge_host, edge_rpc_port, e
        )),
    }

    // ── Sync comparison ────────────────────────────────────────────
    if let (Ok(core_v), Ok(edge_v)) = (core_result, edge_result) {
        let core_h = core_v["chain_height"].as_u64().unwrap_or(0);
        let edge_h = edge_v["chain_height"].as_u64().unwrap_or(0);
        if core_h == edge_h {
            ui::print_ok(&format!("Sync         core=edge={} (in sync)", core_h));
        } else {
            let diff = core_h.abs_diff(edge_h);
            let leader = if core_h > edge_h { "core" } else { "edge" };
            ui::print_warn(&format!(
                "Sync         core={} edge={} diff={} ({} ahead)",
                core_h, edge_h, diff, leader
            ));
        }
    } else {
        ui::print_warn("Sync         cannot compare — one or both nodes unreachable");
    }

    // ── Edge Pool ──────────────────────────────────────────────────
    let (edge_pool_host, edge_pool_port) = cfg.edge_pool();
    let edge_pool_alive = tcp_probe(
        edge_pool_host,
        edge_pool_port,
        std::time::Duration::from_secs(3),
    );
    if edge_pool_alive {
        ui::print_ok(&format!(
            "Edge pool    {}:{} accepting connections",
            edge_pool_host, edge_pool_port
        ));
    } else {
        ui::print_warn(&format!(
            "Edge pool    {}:{} not reachable",
            edge_pool_host, edge_pool_port
        ));
    }

    // ── L3: Hiranyagarbha Agent ────────────────────────────────────
    let alive = agent_rpc::health(&cfg.agent.url).await.unwrap_or(false);
    if alive {
        ui::print_ok(&format!(
            "L3 agent     Hiranyagarbha online  {}",
            cfg.agent.url
        ));
    } else {
        ui::print_warn(&format!(
            "L3 agent     Hiranyagarbha unreachable  {}",
            cfg.agent.url
        ));
    }

    println!();
    ui::print_info(&format!(
        "Config: {}  (zion config show)",
        "~/.zion/zion.toml"
    ));
    println!();
    Ok(())
}

fn tcp_probe(host: &str, port: u16, timeout: std::time::Duration) -> bool {
    let addr = format!("{}:{}", host, port);
    match addr.to_socket_addrs() {
        Ok(mut addrs) => addrs.any(|a| std::net::TcpStream::connect_timeout(&a, timeout).is_ok()),
        Err(_) => false,
    }
}
