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
    /// Send ZION to an address (submits via node RPC)
    Send {
        #[arg(long)]
        to: String,
        #[arg(long)]
        amount: f64,
        /// Optional memo / note
        #[arg(long)]
        memo: Option<String>,
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
                "getBalance",
                serde_json::json!({ "address": addr }),
            ).await;
            match result {
                Ok(v) => {
                    let balance = v["balance_flowers"].as_str()
                        .and_then(|s| s.parse::<f64>().ok())
                        .map(|f| f / 1_000_000.0)
                        .unwrap_or(0.0);
                    ui::print_row("Balance", &format!("{:.6} ZION", balance));
                }
                Err(e) => ui::print_warn(&format!("Cannot fetch balance: {}", e)),
            }
            println!();
            Ok(())
        }
        WalletCmd::Send { to, amount, memo } => {
            if cfg.miner.wallet.is_empty() {
                ui::print_warn("No wallet configured. Set miner.wallet in config first.");
                return Ok(());
            }
            ui::print_header("Send ZION");
            ui::print_row("From", &cfg.miner.wallet);
            ui::print_row("To", &to);
            ui::print_row("Amount", &format!("{:.8} ZION", amount));
            if let Some(ref m) = memo {
                ui::print_row("Memo", m);
            }

            let mut params = serde_json::json!({
                "from": cfg.miner.wallet,
                "to": to,
                "amount": amount,
            });
            if let Some(m) = memo {
                params["memo"] = serde_json::Value::String(m);
            }

            let result = crate::rpc::node_rpc::call(
                &cfg.node.rpc_host,
                cfg.node.rpc_port,
                "submitTransaction",
                params,
            ).await;
            match result {
                Ok(v) => {
                    let txid = v["txid"].as_str().unwrap_or("?");
                    ui::print_ok(&format!("Submitted! txid: {}", txid));
                }
                Err(e) => ui::print_err(&format!("TX failed: {}", e)),
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
