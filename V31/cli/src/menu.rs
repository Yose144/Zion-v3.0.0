//! Interactive operator menu for the ZION V31 CLI.
//!
//! Arrow-key navigation via `dialoguer`. Provides a quick overview and
//! shortcuts to common operations: status, wallet, bridge, swap, pool, miner.

use std::sync::Arc;

use anyhow::Result;
use colored::Colorize;
use dialoguer::{theme::ColorfulTheme, Input, Select};

use zion_l1_types::{Address, ChainId};
use zion_multichain::MultichainService;

const BACK: &str = "<- Back";
const EXIT: &str = "Exit";

/// Entry point for the interactive menu.
pub async fn run_menu(service: &Arc<MultichainService>) -> Result<()> {
    print_banner();

    loop {
        let items = [
            "Status & health",
            "Wallet",
            "Bridge",
            "Swap (DEX)",
            "Pool",
            "Miner",
            "Doctor",
            EXIT,
        ];

        let choice = Select::with_theme(&ColorfulTheme::default())
            .with_prompt("ZION V31 operator dashboard")
            .items(&items)
            .default(0)
            .interact_opt()?;

        let Some(choice) = choice else {
            return Ok(());
        };

        match choice {
            0 => status_menu(service).await?,
            1 => wallet_menu(service).await?,
            2 => bridge_menu(service).await?,
            3 => swap_menu(service).await?,
            4 => pool_menu(service).await?,
            5 => miner_menu().await?,
            6 => doctor_menu(service).await?,
            _ => return Ok(()),
        }
    }
}

fn print_banner() {
    let banner = r#"
  ███████╗██╗██████╗ ███████╗███╗   ██╗
  ╚══███╔╝██║██╔══██╗██╔════╝████╗  ██║
    ███╔╝ ██║██║  ██║█████╗  ██╔██╗ ██║
   ███╔╝  ██║██║  ██║██╔══╝  ██║╚██╗██║
  ███████╗██║██████╔╝███████╗██║ ╚████║
  ╚══════╝╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝
  V31 Mainnet Alpha
"#;
    println!("{}", banner.cyan());
}

async fn status_menu(service: &Arc<MultichainService>) -> Result<()> {
    println!("\n{}", "=== Status ===".bold());
    println!("Registered chains: {:?}", service.chains());
    let health = service.health().await;
    for (chain, ok) in &health {
        let status = if *ok { "ok".green() } else { "unreachable".red() };
        println!("  {chain}: {status}");
    }
    if health.is_empty() {
        println!("No adapters configured.");
    }
    wait_for_enter()?;
    Ok(())
}

async fn wallet_menu(service: &Arc<MultichainService>) -> Result<()> {
    loop {
        let items = ["Derive address", "Show balance", BACK];
        let choice = Select::with_theme(&ColorfulTheme::default())
            .with_prompt("Wallet")
            .items(&items)
            .default(0)
            .interact_opt()?;

        match choice {
            Some(0) => {
                let chain: String = Input::new()
                    .with_prompt("Chain (e.g. zion-l1, base, bitcoin)")
                    .interact()?;
                let account: u32 = Input::new()
                    .with_prompt("Account")
                    .default(0)
                    .interact()?;
                let index: u32 = Input::new()
                    .with_prompt("Index")
                    .default(0)
                    .interact()?;
                match service.wallet_address(parse_chain(&chain)?, account, index) {
                    Ok(addr) => println!("Address: {}", addr.encoded.green()),
                    Err(e) => println!("Error: {e}"),
                }
            }
            Some(1) => {
                let chain: String = Input::new()
                    .with_prompt("Chain (e.g. zion-l1, base)")
                    .interact()?;
                let address: String = Input::new()
                    .with_prompt("Address")
                    .interact()?;
                let chain_id = parse_chain(&chain)?;
                let addr = Address::new(chain_id, vec![], address)
                    .map_err(|e| anyhow::anyhow!("{e}"))?;
                match service.balance(&addr).await {
                    Ok(bal) => println!("Balance: {}", format!("{:.6} ZION", bal.0 as f64 / 1_000_000.0).green()),
                    Err(e) => println!("Error: {e}"),
                }
            }
            _ => return Ok(()),
        }
    }
}

async fn bridge_menu(_service: &Arc<MultichainService>) -> Result<()> {
    println!("\n{}", "=== Bridge ===".bold());
    println!("Use `zion bridge lock` or `zion bridge release` from the command line.");
    wait_for_enter()?;
    Ok(())
}

async fn swap_menu(_service: &Arc<MultichainService>) -> Result<()> {
    println!("\n{}", "=== Swap (DEX) ===".bold());
    println!("Use `zion swap quote` or `zion swap execute` from the command line.");
    wait_for_enter()?;
    Ok(())
}

async fn pool_menu(service: &Arc<MultichainService>) -> Result<()> {
    println!("\n{}", "=== Pool ===".bold());
    match service.pool_stats() {
        Some(stats) => println!("{}", serde_json::to_string_pretty(&stats)?),
        None => println!("Pool not configured."),
    }
    wait_for_enter()?;
    Ok(())
}

async fn miner_menu() -> Result<()> {
    println!("\n{}", "=== Miner ===".bold());
    println!("Use `zion miner start` from the command line.");
    println!("  --node-rpc-url <URL>  Solo mine via node RPC");
    println!("  --pool-url <URL>      Mine via stratum pool");
    println!("  --no-gpu              Disable GPU AuxPoW stream");
    println!("  --no-cpu              Disable CPU AuxPoW stream");
    wait_for_enter()?;
    Ok(())
}

async fn doctor_menu(service: &Arc<MultichainService>) -> Result<()> {
    println!("\n{}", "=== Doctor ===".bold());
    let health = service.health().await;
    let mut all_ok = true;
    for (chain, ok) in &health {
        let status = if *ok { "ok".green() } else { "unreachable".red() };
        println!("  {chain}: {status}");
        if !ok {
            all_ok = false;
        }
    }
    if health.is_empty() {
        println!("No adapters configured.");
    } else if all_ok {
        println!("{}", "All configured adapters are reachable.".green());
    } else {
        println!("{}", "One or more adapters are unreachable.".red());
    }
    wait_for_enter()?;
    Ok(())
}

fn wait_for_enter() -> Result<()> {
    Input::<String>::new()
        .with_prompt("Press Enter to return to menu")
        .allow_empty(true)
        .interact()?;
    Ok(())
}

fn parse_chain(s: &str) -> Result<ChainId> {
    match s.to_lowercase().as_str() {
        "zion-l1" | "zionl1" | "zion" => Ok(ChainId::ZionL1),
        "base" => Ok(ChainId::Base),
        "bitcoin" | "btc" => Ok(ChainId::Bitcoin),
        "ethereum" | "eth" => Ok(ChainId::Ethereum),
        "arbitrum" | "arb" => Ok(ChainId::Arbitrum),
        "bsc" => Ok(ChainId::Bsc),
        "polygon" => Ok(ChainId::Polygon),
        _ => Err(anyhow::anyhow!("unknown chain: {s}")),
    }
}
