use anyhow::Result;
use clap::Subcommand;
use colored::Colorize;
use std::net::ToSocketAddrs;
use std::time::Duration;

use crate::config::Config;
use crate::rpc::node_rpc;
use crate::ui;

#[derive(Subcommand)]
pub enum TopologyCmd {
    /// Show core+edge topology health and sync status
    Status,
    /// End-to-end connectivity test: core <-> edge RPC, pool, VPN, sync
    E2e,
    /// Show current topology configuration
    Config,
}

pub async fn run(cfg: &Config, cmd: TopologyCmd) -> Result<()> {
    match cmd {
        TopologyCmd::Status => topology_status(cfg).await,
        TopologyCmd::E2e => topology_e2e(cfg).await,
        TopologyCmd::Config => topology_config(cfg),
    }
}

async fn topology_status(cfg: &Config) -> Result<()> {
    ui::print_banner();
    ui::print_header("Topology Status");

    let (core_host, core_rpc_port) = cfg.core_rpc();
    let (edge_host, edge_rpc_port) = cfg.edge_rpc();
    let (_, core_pool_port) = cfg.core_pool();
    let (edge_pool_host, edge_pool_port) = cfg.edge_pool();

    // ── Core ────────────────────────────────────────────────────────
    ui::print_info("Core");
    let core_chain = node_rpc::call0(core_host, core_rpc_port, "getChainInfo").await;
    let core_node = node_rpc::call0(core_host, core_rpc_port, "getNodeInfo").await;
    match &core_chain {
        Ok(v) => {
            let height = v["chain_height"].as_u64().unwrap_or(0);
            let hash = v["tip_hash"].as_str().unwrap_or("?");
            let peers = core_node
                .as_ref()
                .ok()
                .and_then(|n| n["known_peers"].as_u64())
                .unwrap_or(0);
            let short = if hash.len() > 12 { &hash[..12] } else { hash };
            ui::print_ok(&format!(
                "  RPC {}:{} height={} peers={} tip={}...",
                core_host, core_rpc_port, height, peers, short
            ));
        }
        Err(e) => ui::print_err(&format!("  RPC {}:{} — {}", core_host, core_rpc_port, e)),
    }

    let core_pool_alive = tcp_probe(core_host, core_pool_port, Duration::from_secs(3));
    if core_pool_alive {
        ui::print_ok(&format!(
            "  Pool  {}:{} accepting connections",
            core_host, core_pool_port
        ));
    } else {
        ui::print_warn(&format!(
            "  Pool  {}:{} not reachable",
            core_host, core_pool_port
        ));
    }

    if let Some(vpn) = &cfg.topology.core.vpn_ip {
        ui::print_row("  VPN IP", vpn);
    }

    // ── Edge ────────────────────────────────────────────────────────
    ui::print_info("Edge");
    let edge_chain = node_rpc::call0(edge_host, edge_rpc_port, "getChainInfo").await;
    let edge_node = node_rpc::call0(edge_host, edge_rpc_port, "getNodeInfo").await;
    match &edge_chain {
        Ok(v) => {
            let height = v["chain_height"].as_u64().unwrap_or(0);
            let hash = v["tip_hash"].as_str().unwrap_or("?");
            let peers = edge_node
                .as_ref()
                .ok()
                .and_then(|n| n["known_peers"].as_u64())
                .unwrap_or(0);
            let short = if hash.len() > 12 { &hash[..12] } else { hash };
            ui::print_ok(&format!(
                "  RPC {}:{} height={} peers={} tip={}...",
                edge_host, edge_rpc_port, height, peers, short
            ));
        }
        Err(e) => ui::print_err(&format!("  RPC {}:{} — {}", edge_host, edge_rpc_port, e)),
    }

    let edge_pool_alive = tcp_probe(edge_pool_host, edge_pool_port, Duration::from_secs(3));
    if edge_pool_alive {
        ui::print_ok(&format!(
            "  Pool  {}:{} accepting connections",
            edge_pool_host, edge_pool_port
        ));
    } else {
        ui::print_warn(&format!(
            "  Pool  {}:{} not reachable",
            edge_pool_host, edge_pool_port
        ));
    }

    if let Some(vpn) = &cfg.topology.edge.vpn_ip {
        ui::print_row("  VPN IP", vpn);
    }

    // ── Sync comparison ────────────────────────────────────────────
    if let (Ok(core_v), Ok(edge_v)) = (core_chain, edge_chain) {
        let core_h = core_v["chain_height"].as_u64().unwrap_or(0);
        let edge_h = edge_v["chain_height"].as_u64().unwrap_or(0);
        if core_h == edge_h {
            ui::print_ok(&format!("Sync   core=edge={} (in sync)", core_h));
        } else {
            let diff = core_h.abs_diff(edge_h);
            let leader = if core_h > edge_h { "core" } else { "edge" };
            ui::print_warn(&format!(
                "Sync   core={} edge={} diff={} ({} ahead)",
                core_h, edge_h, diff, leader
            ));
        }
    } else {
        ui::print_warn("Sync   cannot compare — one or both nodes unreachable");
    }

    println!();
    Ok(())
}

async fn topology_e2e(cfg: &Config) -> Result<()> {
    ui::print_banner();
    ui::print_header("E2E Topology Test");

    let (core_host, core_rpc_port) = cfg.core_rpc();
    let (edge_host, edge_rpc_port) = cfg.edge_rpc();
    let (_, core_pool_port) = cfg.core_pool();
    let (edge_pool_host, edge_pool_port) = cfg.edge_pool();

    let mut failures = 0usize;

    // 1. Core RPC
    print_step("Core RPC");
    match node_rpc::call0(core_host, core_rpc_port, "getChainInfo").await {
        Ok(v) => {
            let h = v["chain_height"].as_u64().unwrap_or(0);
            pass(&format!("{}:{} height={}", core_host, core_rpc_port, h));
        }
        Err(e) => {
            fail(&format!("{}:{} — {}", core_host, core_rpc_port, e));
            failures += 1;
        }
    }

    // 2. Edge RPC
    print_step("Edge RPC");
    match node_rpc::call0(edge_host, edge_rpc_port, "getChainInfo").await {
        Ok(v) => {
            let h = v["chain_height"].as_u64().unwrap_or(0);
            pass(&format!("{}:{} height={}", edge_host, edge_rpc_port, h));
        }
        Err(e) => {
            fail(&format!("{}:{} — {}", edge_host, edge_rpc_port, e));
            failures += 1;
        }
    }

    // 3. Core pool
    print_step("Core Pool");
    if tcp_probe(core_host, core_pool_port, Duration::from_secs(3)) {
        pass(&format!("{}:{} TCP open", core_host, core_pool_port));
    } else {
        fail(&format!("{}:{} TCP closed", core_host, core_pool_port));
        failures += 1;
    }

    // 4. Edge pool
    print_step("Edge Pool");
    if tcp_probe(edge_pool_host, edge_pool_port, Duration::from_secs(3)) {
        pass(&format!("{}:{} TCP open", edge_pool_host, edge_pool_port));
    } else {
        fail(&format!("{}:{} TCP closed", edge_pool_host, edge_pool_port));
        failures += 1;
    }

    // 5. VPN probe (Tailscale IPs)
    if let (Some(core_vpn), Some(edge_vpn)) = (&cfg.topology.core.vpn_ip, &cfg.topology.edge.vpn_ip)
    {
        print_step("VPN (Tailscale)");
        let core_vpn_alive = tcp_probe(core_vpn, core_rpc_port, Duration::from_secs(5));
        let edge_vpn_alive = tcp_probe(edge_vpn, edge_rpc_port, Duration::from_secs(5));
        if core_vpn_alive {
            pass(&format!(
                "core VPN {}:{} reachable",
                core_vpn, core_rpc_port
            ));
        } else {
            warn(&format!(
                "core VPN {}:{} not reachable",
                core_vpn, core_rpc_port
            ));
        }
        if edge_vpn_alive {
            pass(&format!(
                "edge VPN {}:{} reachable",
                edge_vpn, edge_rpc_port
            ));
        } else {
            warn(&format!(
                "edge VPN {}:{} not reachable",
                edge_vpn, edge_rpc_port
            ));
        }
    } else {
        print_step("VPN (Tailscale)");
        warn("VPN IPs not configured; skipping VPN probe");
    }

    // 6. Genesis hash consistency
    print_step("Genesis Hash");
    let genesis_hash = "003529805e9b47babb9ac0f26b27b1aad0a1cf3c483181857daf3269f7088923";
    let core_genesis = node_rpc::call0(core_host, core_rpc_port, "getBlockByHeight")
        .await
        .ok();
    let edge_genesis = node_rpc::call0(edge_host, edge_rpc_port, "getBlockByHeight")
        .await
        .ok();
    match (core_genesis, edge_genesis) {
        (Some(c), Some(e)) => {
            let ch = c["hash_hex"].as_str().unwrap_or("?");
            let eh = e["hash_hex"].as_str().unwrap_or("?");
            if ch == eh && ch == genesis_hash {
                pass(&format!("core=edge=canonical {}...", &genesis_hash[..16]));
            } else if ch == eh {
                pass(&format!(
                    "core=edge={}... (non-canonical)",
                    &ch[..ch.len().min(16)]
                ));
            } else {
                fail(&format!(
                    "core={}... edge={}... MISMATCH",
                    &ch[..ch.len().min(12)],
                    &eh[..eh.len().min(12)]
                ));
                failures += 1;
            }
        }
        _ => {
            warn("Cannot verify genesis hash — one or both nodes unreachable");
        }
    }

    println!();
    if failures == 0 {
        ui::print_ok("E2E topology test passed");
    } else {
        ui::print_err(&format!(
            "E2E topology test failed with {} failure(s)",
            failures
        ));
    }
    println!();
    Ok(())
}

fn topology_config(cfg: &Config) -> Result<()> {
    ui::print_header("Topology Config");

    ui::print_info("Core");
    ui::print_row("  RPC host", &cfg.topology.core.rpc_host);
    ui::print_row("  RPC port", &cfg.topology.core.rpc_port.to_string());
    ui::print_row("  P2P port", &cfg.topology.core.p2p_port.to_string());
    ui::print_row("  Pool host", &cfg.topology.core.pool_host);
    ui::print_row("  Pool port", &cfg.topology.core.pool_port.to_string());
    ui::print_row(
        "  VPN IP",
        cfg.topology.core.vpn_ip.as_deref().unwrap_or("(not set)"),
    );

    ui::print_info("Edge");
    ui::print_row("  RPC host", &cfg.topology.edge.rpc_host);
    ui::print_row("  RPC port", &cfg.topology.edge.rpc_port.to_string());
    ui::print_row("  P2P port", &cfg.topology.edge.p2p_port.to_string());
    ui::print_row("  Pool host", &cfg.topology.edge.pool_host);
    ui::print_row("  Pool port", &cfg.topology.edge.pool_port.to_string());
    ui::print_row(
        "  VPN IP",
        cfg.topology.edge.vpn_ip.as_deref().unwrap_or("(not set)"),
    );

    ui::print_info("Legacy defaults");
    ui::print_row("  node.rpc_host", &cfg.node.rpc_host);
    ui::print_row("  pool.host", &cfg.pool.host);
    println!();
    Ok(())
}

fn tcp_probe(host: &str, port: u16, timeout: Duration) -> bool {
    let addr = format!("{}:{}", host, port);
    match addr.to_socket_addrs() {
        Ok(mut addrs) => addrs.any(|a| std::net::TcpStream::connect_timeout(&a, timeout).is_ok()),
        Err(_) => false,
    }
}

fn print_step(name: &str) {
    print!("  {:<18} ", name.dimmed());
}

fn pass(msg: &str) {
    println!("{} {}", "PASS".green().bold(), msg);
}

fn fail(msg: &str) {
    println!("{} {}", "FAIL".red().bold(), msg);
}

fn warn(msg: &str) {
    println!("{} {}", "WARN".yellow().bold(), msg);
}
