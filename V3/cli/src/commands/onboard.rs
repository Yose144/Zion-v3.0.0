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

    // Step 1: Node endpoint
    println!("  Step 1/4  Node endpoint");
    let host: String = Input::new()
        .with_prompt("    RPC host")
        .default("91.98.122.165".into())
        .interact_text()?;
    let port_str: String = Input::new()
        .with_prompt("    RPC port")
        .default("8443".into())
        .interact_text()?;
    let port: u16 = port_str.parse().unwrap_or(8443);

    cfg.node.rpc_host = host.clone();
    cfg.node.rpc_port = port;

    print!("    Connecting... ");
    let result = node_rpc::call0(&host, port, "getChainInfo").await;
    match result {
        Ok(v) => {
            let h = v["chain_height"].as_u64().unwrap_or(0);
            println!("✓ height {}", h);
        }
        Err(e) => println!("⚠ {}", e),
    }
    println!();

    // Step 2: Mining wallet
    println!("  Step 2/4  Mining wallet");
    let wallet_mode = &["Use existing address", "Generate new mnemonic wallet", "Skip for now"];
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
            let generated = wallet::create_wallet_at(
                &wallet_path,
                true,
                24,
                overwrite,
                password.as_deref(),
            )?;
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
    println!("  Step 3/4  Mining backend");
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
    println!("  Step 4/4  Hiranyagarbha AI Agent");
    let agent_url: String = Input::new()
        .with_prompt("    Agent URL")
        .default(format!("http://{}:8001", host))
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

    // Save config
    config::save(&cfg)?;
    let path = config::config_path()?;
    ui::print_ok(&format!("Config saved to {}", path.display()));
    println!();
    println!("  Run 'zion status' to verify the stack.");
    println!("  Run 'zion mine start' to start mining.");
    println!("  Run 'zion agent chat' to talk to Hiranyagarbha.");
    println!();

    Ok(())
}
