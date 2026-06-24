//! Live monitor — shows local process health for node, pool, miner
//! plus the latest chain height from the configured node RPC.

use anyhow::Result;
use std::time::Duration;

use crate::config::Config;
use crate::process;
use crate::ui;

pub async fn run(cfg: &Config) -> Result<()> {
    ui::print_header("ZION Monitor — Local Stack");

    // Node
    ui::print_section("Node");
    match process::status("node") {
        Some(pid) => ui::print_ok(&format!("Running (PID {})", pid)),
        None => ui::print_warn("Not running"),
    }

    let client = zion_sdk::node::NodeClient::builder(&cfg.node.rpc_host, cfg.node.rpc_port)
        .connect_timeout(Duration::from_secs(5))
        .build();
    match client.chain_info().await {
        Ok(chain) => {
            ui::print_row("Height", &chain.chain_height.to_string());
            ui::print_row("Tip", &chain.tip_hash_hex);
            ui::print_row("Network", &chain.network);
        }
        Err(e) => ui::print_warn(&format!("RPC not reachable: {}", e)),
    }

    // Pool
    ui::print_section("Pool");
    match process::status("pool") {
        Some(pid) => ui::print_ok(&format!("Running (PID {})", pid)),
        None => ui::print_info("Not running (public pool is used by default)"),
    }

    // Miner
    ui::print_section("Miner");
    match process::status("miner") {
        Some(pid) => ui::print_ok(&format!("Running (PID {})", pid)),
        None => ui::print_warn("Not running"),
    }

    println!();
    ui::print_info("Commands: zion node start | zion mine start | zion pool start");
    println!();
    Ok(())
}
