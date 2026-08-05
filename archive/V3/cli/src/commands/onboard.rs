use anyhow::Result;
use dialoguer::{Confirm, Input, Password, Select};
use std::path::PathBuf;

use crate::commands::wallet;
use crate::config::{self, Config};
use crate::rpc::{agent_rpc, node_rpc};
use crate::ui;

pub async fn run(_cfg: &Config) -> Result<()> {
    ui::print_genesis_banner();
    println!("  ╔══════════════════════════════════════════════╗");
    println!("  ║       Welcome to ZION — The Golden Age       ║");
    println!("  ║   Om Namo Hiranyagarbha  |  Peace & One Love ║");
    println!("  ╚══════════════════════════════════════════════╝");
    println!();

    let mut cfg = Config::default();

    // Step 1: Topology setup
    println!("  Step 1/5  Core+Edge Topology");
    let topology_mode = &["Standard (Core local + Edge VPS)", "Custom"];
    let topo_idx = Select::new()
        .with_prompt("    Topology preset")
        .items(topology_mode)
        .default(0)
        .interact()?;
    if topo_idx == 0 {
        // Defaults already set in Config::default()
        ui::print_ok("Using standard topology:");
        ui::print_row(
            "      Core RPC",
            &format!(
                "{}:{}",
                cfg.topology.core.rpc_host, cfg.topology.core.rpc_port
            ),
        );
        ui::print_row(
            "      Edge RPC",
            &format!(
                "{}:{}",
                cfg.topology.edge.rpc_host, cfg.topology.edge.rpc_port
            ),
        );
        ui::print_row(
            "      Edge Pool",
            &format!(
                "{}:{}",
                cfg.topology.edge.pool_host, cfg.topology.edge.pool_port
            ),
        );
    } else {
        let core_host: String = Input::new()
            .with_prompt("    Core RPC host")
            .default(cfg.topology.core.rpc_host.clone())
            .interact_text()?;
        let core_port: u16 = Input::new()
            .with_prompt("    Core RPC port")
            .default(cfg.topology.core.rpc_port.to_string())
            .interact_text()?
            .parse()
            .unwrap_or(8443);
        let edge_host: String = Input::new()
            .with_prompt("    Edge RPC host")
            .default(cfg.topology.edge.rpc_host.clone())
            .interact_text()?;
        let edge_port: u16 = Input::new()
            .with_prompt("    Edge RPC port")
            .default(cfg.topology.edge.rpc_port.to_string())
            .interact_text()?
            .parse()
            .unwrap_or(8443);
        let edge_pool_host: String = Input::new()
            .with_prompt("    Edge pool host")
            .default(cfg.topology.edge.pool_host.clone())
            .interact_text()?;
        let edge_pool_port: u16 = Input::new()
            .with_prompt("    Edge pool port")
            .default(cfg.topology.edge.pool_port.to_string())
            .interact_text()?
            .parse()
            .unwrap_or(8444);
        cfg.topology.core.rpc_host = core_host.clone();
        cfg.topology.core.rpc_port = core_port;
        cfg.topology.edge.rpc_host = edge_host.clone();
        cfg.topology.edge.rpc_port = edge_port;
        cfg.topology.edge.pool_host = edge_pool_host.clone();
        cfg.topology.edge.pool_port = edge_pool_port;
        cfg.node.rpc_host = core_host.clone();
        cfg.node.rpc_port = core_port;
        cfg.pool.host = edge_pool_host.clone();
        cfg.pool.port = edge_pool_port;
    }

    print!("    Core connecting... ");
    let result = node_rpc::call0(
        &cfg.topology.core.rpc_host,
        cfg.topology.core.rpc_port,
        "getChainInfo",
    )
    .await;
    match result {
        Ok(v) => {
            let h = v["chain_height"].as_u64().unwrap_or(0);
            println!("✓ height {}", h);
        }
        Err(e) => println!("⚠ {}", e),
    }
    print!("    Edge connecting... ");
    let result = node_rpc::call0(
        &cfg.topology.edge.rpc_host,
        cfg.topology.edge.rpc_port,
        "getChainInfo",
    )
    .await;
    match result {
        Ok(v) => {
            let h = v["chain_height"].as_u64().unwrap_or(0);
            println!("✓ height {}", h);
        }
        Err(e) => println!("⚠ {}", e),
    }
    println!();

    // Step 2: Mining wallet
    println!("  Step 2/5  Mining wallet");
    let wallet_mode = &[
        "Use existing address",
        "Generate new mnemonic wallet",
        "Skip for now",
    ];
    let wallet_idx = Select::new()
        .with_prompt("    Wallet setup")
        .items(wallet_mode)
        .default(0)
        .interact()?;
    match wallet_idx {
        0 => {
            let wallet: String = Input::new()
                .with_prompt("    Wallet address")
                .default("".into())
                .allow_empty(true)
                .interact_text()?;
            if !wallet.is_empty() {
                cfg.miner.wallet = wallet;
                ui::print_ok("Wallet set");
            } else {
                ui::print_warn("No wallet — set later with: zion config set miner.wallet <addr>");
            }
        }
        1 => {
            let wallet_path: String = Input::new()
                .with_prompt("    Wallet file path")
                .default("zion-wallet.json".into())
                .interact_text()?;
            let wallet_path = PathBuf::from(wallet_path);
            let overwrite = if wallet_path.exists() {
                Confirm::new()
                    .with_prompt(format!("    {} exists. Overwrite?", wallet_path.display()))
                    .default(false)
                    .interact()?
            } else {
                false
            };
            let encrypt = Confirm::new()
                .with_prompt("    Encrypt wallet file with a password?")
                .default(true)
                .interact()?;
            let password = if encrypt {
                Some(
                    Password::new()
                        .with_prompt("    Wallet password")
                        .with_confirmation("    Confirm wallet password", "Passwords do not match")
                        .allow_empty_password(false)
                        .interact()?,
                )
            } else {
                None
            };
            let generated =
                wallet::create_wallet_at(&wallet_path, true, 24, overwrite, password.as_deref())?;
            cfg.miner.wallet = generated.address().to_string();
            ui::print_ok(&format!("Wallet generated at {}", wallet_path.display()));
            ui::print_ok(&format!("Mining wallet set to {}", generated.address()));
            if generated.is_encrypted() {
                ui::print_ok("Wallet secrets were encrypted in the wallet file.");
            } else {
                ui::print_warn("Wallet file contains plaintext secrets; move it somewhere safe.");
            }
        }
        _ => {
            ui::print_warn("No wallet — set later with: zion config set miner.wallet <addr>");
        }
    }
    println!();

    // Step 3: Mining backend
    println!("  Step 3/5  Mining backend");
    let backends = &["auto", "cpu", "gpu (Metal)", "gpu (OpenCL)"];
    let idx = Select::new()
        .with_prompt("    Backend")
        .items(backends)
        .default(0)
        .interact()?;
    cfg.miner.backend = match idx {
        1 => "cpu".into(),
        2 => "metal".into(),
        3 => "opencl".into(),
        _ => "auto".into(),
    };
    ui::print_ok(&format!("Backend: {}", cfg.miner.backend));
    println!();

    // Step 4: Hiranyagarbha agent
    println!("  Step 4/5  Hiranyagarbha AI Agent");
    let agent_url: String = Input::new()
        .with_prompt("    Agent URL")
        .default(cfg.agent.url.clone())
        .interact_text()?;
    cfg.agent.url = agent_url.clone();

    print!("    Connecting... ");
    let alive = agent_rpc::health(&agent_url).await.unwrap_or(false);
    if alive {
        println!("✓ Hiranyagarbha online");
    } else {
        println!("⚠ Agent unreachable (start later with: zion agent start)");
    }
    println!();

    // Step 5: Confirm & save
    println!("  Step 5/5  Save Configuration");
    ui::print_info(&format!(
        "Core RPC: {}:{}",
        cfg.topology.core.rpc_host, cfg.topology.core.rpc_port
    ));
    ui::print_info(&format!(
        "Edge RPC: {}:{}",
        cfg.topology.edge.rpc_host, cfg.topology.edge.rpc_port
    ));
    ui::print_info(&format!(
        "Edge Pool: {}:{}",
        cfg.topology.edge.pool_host, cfg.topology.edge.pool_port
    ));
    ui::print_info(&format!(
        "Mining wallet: {}",
        if cfg.miner.wallet.is_empty() {
            "(not set)"
        } else {
            &cfg.miner.wallet
        }
    ));
    println!();

    config::save(&cfg)?;
    let path = config::config_path()?;
    ui::print_ok(&format!("Config saved to {}", path.display()));
    println!();
    println!("  Run 'zion topology status' to verify core+edge health.");
    println!("  Run 'zion topology e2e' to run end-to-end checks.");
    println!("  Run 'zion mine start' to start mining (defaults to edge pool).");
    println!("  Run 'zion agent chat' to talk to Hiranyagarbha.");
    println!();

    Ok(())
}
