use anyhow::Result;
use clap::Subcommand;

use crate::config::Config;
use crate::ui;

#[derive(Subcommand)]
pub enum WalletCmd {
    /// Generate a new ZION wallet (keypair)
    New,
    /// Show current wallet address from config
    Address,
    /// Query balance from node
    Balance {
        #[arg(long)]
        address: Option<String>,
    },
    /// Show config wallet address + tithe distribution
    Tithe,
}

pub async fn run(cfg: &Config, cmd: WalletCmd) -> Result<()> {
    match cmd {
        WalletCmd::New => {
            ui::print_header("New Wallet");
            ui::print_warn("Key generation not yet integrated — use zion-core keygen.");
            ui::print_info("Coming in Phase 3 with full keypair + signing support.");
            println!();
            Ok(())
        }
        WalletCmd::Address => {
            ui::print_header("Wallet Address");
            if cfg.miner.wallet.is_empty() {
                ui::print_warn("No wallet configured. Run: zion config set miner.wallet <address>");
            } else {
                ui::print_row("Address", &cfg.miner.wallet);
            }
            println!();
            Ok(())
        }
        WalletCmd::Balance { address } => {
            let addr = address.unwrap_or_else(|| cfg.miner.wallet.clone());
            if addr.is_empty() {
                ui::print_warn("No address. Use --address <addr> or set miner.wallet in config.");
                return Ok(());
            }
            ui::print_header(&format!("Balance: {}", addr));
            // Query node RPC for balance
            let result = crate::rpc::node_rpc::call(
                &cfg.node.rpc_host,
                cfg.node.rpc_port,
                "get_balance",
                serde_json::json!({ "address": addr }),
            ).await;
            match result {
                Ok(v) => {
                    let balance = v["balance"].as_f64().unwrap_or(0.0);
                    ui::print_row("Balance", &format!("{:.8} ZION", balance));
                }
                Err(e) => ui::print_warn(&format!("Cannot fetch balance: {}", e)),
            }
            println!();
            Ok(())
        }
        WalletCmd::Tithe => {
            ui::print_header("Tithe Wallets");
            ui::print_info("Tithe wallet distribution (from TITHE_WALLETS_BACKUP.txt).");
            ui::print_info("See project root for the full list.");
            println!();
            Ok(())
        }
    }
}
