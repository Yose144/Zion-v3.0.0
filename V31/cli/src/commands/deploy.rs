use anyhow::Result;
use clap::Subcommand;

use crate::ui;

/// Deploy smart contracts to EVM chains via the multichain layer.
#[derive(Subcommand)]
pub enum DeployCmd {
    /// Deploy a Solidity contract from the V31 contracts directory
    Contract {
        /// Contract name (e.g. ZIONToken, ZIONBridge)
        #[arg(short, long)]
        name: String,
        /// Target chain (base, ethereum, etc.)
        #[arg(short, long)]
        chain: String,
        /// Constructor arguments as JSON array
        #[arg(long)]
        args: Option<String>,
        /// Dry-run: compile and show bytecode without deploying
        #[arg(long)]
        dry_run: bool,
    },
    /// List available contracts in the V31 contracts directory
    List,
    /// Verify a deployed contract on a block explorer
    Verify {
        #[arg(long)]
        chain: String,
        #[arg(long)]
        address: String,
        #[arg(long)]
        contract: String,
    },
}

pub async fn run(cmd: DeployCmd) -> Result<()> {
    match cmd {
        DeployCmd::Contract { name, chain, args, dry_run } => {
            ui::print_header(&format!("Deploy {} → {}", name, chain));
            let contracts_dir = std::path::Path::new("V31/L2/multichain/contracts");
            let src_dir = contracts_dir.join("src");

            // Search for contract file in src/evm and src/dex
            let search_dirs = [src_dir.join("evm"), src_dir.join("dex")];
            let mut found = None;
            for dir in &search_dirs {
                if let Ok(entries) = std::fs::read_dir(dir) {
                    for entry in entries.flatten() {
                        let fname = entry.file_name().to_string_lossy().to_string();
                        if fname.contains(&name) {
                            found = Some(entry.path());
                            break;
                        }
                    }
                }
            }

            match found {
                Some(path) => {
                    ui::print_row("Contract", &path.display().to_string());
                    ui::print_row("Chain", &chain);
                    if let Some(ref a) = args {
                        ui::print_row("Constructor args", a);
                    }
                    if dry_run {
                        ui::print_info("Dry-run: would compile and deploy.");
                        ui::print_warn("Solidity compilation not yet integrated in V31 CLI.");
                        ui::print_info("Use forge/foundry directly: forge create <contract> --rpc-url <chain>");
                    } else {
                        ui::print_warn("Direct deployment from CLI not yet implemented.");
                        ui::print_info("Use: forge create <path>:<name> --rpc-url <chain-rpc> --private-key <key>");
                    }
                }
                None => {
                    ui::print_err(&format!("Contract '{}' not found in V31/L2/multichain/contracts/", name));
                    ui::print_info("Run 'zion deploy list' to see available contracts.");
                }
            }
            println!();
        }
        DeployCmd::List => {
            ui::print_header("Available Contracts");
            let contracts_dir = std::path::Path::new("V31/L2/multichain/contracts");
            for subdir in ["src/evm", "src/dex"] {
                let dir = contracts_dir.join(subdir);
                if let Ok(entries) = std::fs::read_dir(&dir) {
                    println!("  [{}/]", subdir);
                    for entry in entries.flatten() {
                        let fname = entry.file_name().to_string_lossy().to_string();
                        if fname.ends_with(".sol") {
                            println!("    {}", fname);
                        }
                    }
                }
            }
            println!();
        }
        DeployCmd::Verify { chain, address, contract } => {
            ui::print_header("Verify Contract");
            ui::print_row("Chain", &chain);
            ui::print_row("Address", &address);
            ui::print_row("Contract", &contract);
            ui::print_warn("Contract verification not yet implemented in V31 CLI.");
            ui::print_info("Use forge verify-contract directly.");
            println!();
        }
    }
    Ok(())
}
