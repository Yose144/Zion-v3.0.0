use anyhow::Result;
use dialoguer::{Input, Select};

use crate::config::{self, Config};
use crate::rpc::{agent_rpc, node_rpc};
use crate::ui;

pub async fn run(_cfg: &Config) -> Result<()> {
    ui::print_banner();
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
    let wallet: String = Input::new()
        .with_prompt("    Wallet address (leave blank to skip)")
        .default("".into())
        .allow_empty(true)
        .interact_text()?;
    if !wallet.is_empty() {
        cfg.miner.wallet = wallet;
        ui::print_ok("Wallet set");
    } else {
        ui::print_warn("No wallet — set later with: zion config set miner.wallet <addr>");
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
