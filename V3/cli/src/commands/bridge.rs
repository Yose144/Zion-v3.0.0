use anyhow::Result;
use clap::Subcommand;

use crate::config::Config;
use crate::rpc::agent_rpc; // reuse HTTP client
use crate::ui;

fn bridge_url(cfg: &Config) -> String {
    format!("http://{}:{}", cfg.node.rpc_host, cfg.bridge.port)
}

#[derive(Subcommand)]
pub enum BridgeCmd {
    /// Bridge health + state
    Status,
    /// List pending cross-chain transfers
    Pending,
    /// Show completed transfers (last N)
    History {
        #[arg(default_value = "10")]
        n: u64,
    },
    /// Get transfer by ID
    Get { id: String },
    /// Supported chains
    Chains,
    /// Initiate a bridge transfer (dry-run in Phase 3)
    Transfer {
        #[arg(long)]
        from_chain: String,
        #[arg(long)]
        to_chain: String,
        #[arg(long)]
        amount: f64,
        #[arg(long)]
        token: String,
    },
    /// Deploy bridge contracts on EVM chain (Base mainnet / Sepolia)
    Deploy {
        /// Target network: base, base-sepolia, arbitrum, bsc, polygon
        #[arg(long, default_value = "base-sepolia")]
        network: String,
        /// Dry-run: print deployment steps without executing
        #[arg(long)]
        dry_run: bool,
    },
}

pub async fn run(cfg: &Config, cmd: BridgeCmd) -> Result<()> {
    let url = bridge_url(cfg);

    match cmd {
        BridgeCmd::Status => {
            ui::print_header("ZION Bridge (L2)");
            let alive = agent_rpc::health(&url).await.unwrap_or(false);
            if alive {
                ui::print_ok(&format!("Bridge online at {}", url));
                let v = agent_rpc::get(&url, "status").await;
                if let Ok(v) = v {
                    if let Some(pending) = v["pending_count"].as_u64() {
                        ui::print_row("Pending txs", &pending.to_string());
                    }
                    if let Some(chains) = v["supported_chains"].as_array() {
                        let names: Vec<&str> = chains.iter().filter_map(|c| c.as_str()).collect();
                        ui::print_row("Chains", &names.join(", "));
                    }
                    if let Some(vol) = v["total_volume"].as_f64() {
                        ui::print_row("Total volume", &format!("{:.2} ZION", vol));
                    }
                }
            } else {
                ui::print_err(&format!("Bridge unreachable at {}", url));
                ui::print_info("Start with: zion start bridge");
            }
            println!();
            Ok(())
        }
        BridgeCmd::Pending => {
            ui::print_header("Pending Transfers");
            let v = agent_rpc::get(&url, "transfers/pending").await;
            match v {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Bridge unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        BridgeCmd::History { n } => {
            ui::print_header(&format!("Transfer History (last {})", n));
            let v = agent_rpc::get(&url, &format!("transfers/history?limit={}", n)).await;
            match v {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Bridge unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        BridgeCmd::Get { id } => {
            ui::print_header(&format!("Transfer {}", id));
            let v = agent_rpc::get(&url, &format!("transfers/{}", id)).await;
            match v {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Transfer not found: {}", e)),
            }
            println!();
            Ok(())
        }
        BridgeCmd::Chains => {
            ui::print_header("Supported Chains");
            let v = agent_rpc::get(&url, "chains").await;
            match v {
                Ok(v) => {
                    if let Some(arr) = v.as_array() {
                        for chain in arr {
                            let name = chain["name"].as_str().unwrap_or("?");
                            let id = chain["chain_id"].as_u64().unwrap_or(0);
                            ui::print_row(name, &format!("chain_id={}", id));
                        }
                    } else {
                        println!("{}", serde_json::to_string_pretty(&v)?);
                    }
                }
                Err(e) => ui::print_warn(&format!("Bridge unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        BridgeCmd::Transfer {
            from_chain,
            to_chain,
            amount,
            token,
        } => {
            ui::print_header("Bridge Transfer (dry-run)");
            ui::print_row("From", &from_chain);
            ui::print_row("To", &to_chain);
            ui::print_row("Amount", &format!("{} {}", amount, token));
            ui::print_warn("Full signing support in Phase 4. No transaction was submitted.");
            println!();
            Ok(())
        }
        BridgeCmd::Deploy { network, dry_run } => {
            ui::print_header(&format!("Bridge Contract Deployment — {}", network));
            if dry_run {
                ui::print_info("DRY-RUN mode — no transactions will be submitted.");
            }
            ui::print_info("Deployment workflow:");
            println!(
                "  1. Ensure Foundry is installed:  curl -L https://foundry.paradigm.xyz | bash"
            );
            println!("  2. Set RPC URL:  export BASE_RPC=https://base-mainnet.publicnode.com");
            println!("  3. Set deployer key:  export PRIVATE_KEY=0x...");
            println!(
                "  4. Run deploy script:  ./scripts/deploy-bridge-base.sh {}",
                network
            );
            println!();
            ui::print_info("Contracts to deploy:");
            println!("  - wZION ERC-20 (wrapped ZION)");
            println!("  - ZIONBridge (lock/mint + burn/unlock)");
            println!("  - BridgeValidator (multisig 3/5)");
            println!();
            ui::print_warn("Mainnet deploy costs real ETH. Test on Sepolia first.");
            println!();
            Ok(())
        }
    }
}
