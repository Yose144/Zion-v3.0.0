use anyhow::Result;

use crate::commands::mine;
use crate::config::{self, Config};
use crate::rpc::{agent_rpc, node_rpc};
use crate::ui;

pub async fn run(cfg: &Config) -> Result<()> {
    ui::print_banner();
    ui::print_header("Doctor");

    let mut hard_failures = 0usize;

    ui::print_header("Config");
    let report = config::validate(cfg);
    for warning in &report.warnings {
        ui::print_warn(warning);
    }
    for error in &report.errors {
        ui::print_err(error);
    }
    if report.is_ok() {
        ui::print_ok("Config schema and value checks passed");
    } else {
        hard_failures += report.errors.len();
    }

    ui::print_header("Local Runtime");
    let config_path = config::config_path()?;
    if config_path.exists() {
        ui::print_ok(&format!("Config file    {}", config_path.display()));
    } else {
        ui::print_warn(&format!(
            "Config file    missing at {}; using built-in defaults",
            config_path.display()
        ));
    }

    match mine::discover_miner_binary() {
        Some(path) => ui::print_ok(&format!("Miner binary  {}", path.display())),
        None => ui::print_warn("Miner binary  zion-miner not found locally; build with `cd V3 && cargo build -p zion-miner --release`")
    }

    ui::print_header("Remote Endpoints");
    match node_rpc::call0(&cfg.node.rpc_host, cfg.node.rpc_port, "getChainInfo").await {
        Ok(v) => {
            let height = v["chain_height"].as_u64().unwrap_or(0);
            let hash = v["tip_hash"].as_str().unwrap_or("?");
            let short = if hash.len() > 12 { &hash[..12] } else { hash };
            ui::print_ok(&format!(
                "Node RPC      {}:{} height={} tip={}...",
                cfg.node.rpc_host, cfg.node.rpc_port, height, short
            ));
        }
        Err(err) => {
            hard_failures += 1;
            ui::print_err(&format!("Node RPC      {}:{} — {}", cfg.node.rpc_host, cfg.node.rpc_port, err));
        }
    }

    match agent_rpc::health(&cfg.agent.url).await {
        Ok(true) => ui::print_ok(&format!("AI Native     {}", cfg.agent.url)),
        Ok(false) => ui::print_warn(&format!("AI Native     unreachable at {}", cfg.agent.url)),
        Err(err) => ui::print_warn(&format!("AI Native     {} — {}", cfg.agent.url, err)),
    }

    println!();
    if hard_failures == 0 {
        ui::print_ok("Doctor passed");
        Ok(())
    } else {
        anyhow::bail!("Doctor found {} hard failure(s)", hard_failures)
    }
}