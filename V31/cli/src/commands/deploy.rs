use anyhow::{Context, Result};
use clap::Subcommand;
use std::process::Command;

use crate::ui;

/// Deploy smart contracts to EVM chains via Foundry / forge.
#[derive(Subcommand)]
pub enum DeployCmd {
    /// Deploy a Solidity contract from the V31 contracts directory via `forge create`
    Contract {
        /// Contract name (e.g. wZION, ZIONBridge, ZDXToken)
        #[arg(short, long)]
        name: String,
        /// Target chain (base, ethereum, arbitrum, optimism, avalanche)
        #[arg(long)]
        chain: String,
        /// RPC URL (defaults to chain preset: base→https://mainnet.base.org, etc.)
        #[arg(long)]
        rpc_url: Option<String>,
        /// Private key (or set FORGE_PRIVATE_KEY env var)
        #[arg(long)]
        private_key: Option<String>,
        /// Constructor arguments as comma-separated values (passed to forge --constructor-args)
        #[arg(long)]
        args: Option<String>,
        /// Dry-run: compile only (`forge build`), do not deploy
        #[arg(long)]
        dry_run: bool,
    },
    /// Run the full DeployBase.s.sol script (deploys all ZionDex contracts)
    Script {
        /// Target chain (base, ethereum, etc.)
        #[arg(long)]
        chain: String,
        /// RPC URL (defaults to chain preset)
        #[arg(long)]
        rpc_url: Option<String>,
        /// Private key (or set PRIVATE_KEY env var)
        #[arg(long)]
        private_key: Option<String>,
        /// Dry-run: simulate only (forge script --dry-run)
        #[arg(long)]
        dry_run: bool,
    },
    /// List available contracts in the V31 contracts directory
    List,
    /// Verify a deployed contract on a block explorer via `forge verify-contract`
    Verify {
        #[arg(long)]
        chain: String,
        #[arg(long)]
        address: String,
        #[arg(long)]
        contract: String,
        #[arg(long)]
        etherscan_api_key: Option<String>,
    },
    /// Run Foundry tests (`forge test`)
    Test,
}

/// Chain → default RPC URL mapping
fn default_rpc_url(chain: &str) -> Option<&'static str> {
    match chain {
        "base" => Some("https://mainnet.base.org"),
        "ethereum" | "mainnet" => Some("https://eth.llamarpc.com"),
        "arbitrum" => Some("https://arb1.arbitrum.io/rpc"),
        "optimism" => Some("https://mainnet.optimism.io"),
        "avalanche" | "avax" => Some("https://api.avax.network/ext/bc/C/rpc"),
        "sepolia" => Some("https://rpc.sepolia.org"),
        "base-sepolia" => Some("https://sepolia.base.org"),
        _ => None,
    }
}

/// Resolve the contracts directory relative to the workspace root
fn contracts_dir() -> std::path::PathBuf {
    // Try common locations: CWD, parent, or workspace root
    let candidates = [
        std::path::PathBuf::from("V31/L2/multichain/contracts"),
        std::path::PathBuf::from("../L2/multichain/contracts"),
        std::path::PathBuf::from("."),
    ];
    for c in &candidates {
        if c.join("foundry.toml").exists() {
            return c.clone();
        }
    }
    // Default to the first candidate
    candidates[0].clone()
}

/// Find a .sol file containing the contract name in src/evm or src/dex
fn find_contract_file(contracts_dir: &std::path::Path, name: &str) -> Option<std::path::PathBuf> {
    let search_dirs = ["src/evm", "src/dex"];
    for subdir in &search_dirs {
        let dir = contracts_dir.join(subdir);
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let fname = entry.file_name().to_string_lossy().to_string();
                if fname.ends_with(".sol") && fname.contains(name) {
                    return Some(entry.path());
                }
            }
        }
    }
    None
}

/// Check if `forge` is installed and available
fn check_forge() -> Result<()> {
    let result = Command::new("forge").arg("--version").output();
    match result {
        Ok(output) if output.status.success() => Ok(()),
        _ => anyhow::bail!(
            "forge (Foundry) is not installed or not in PATH.\n\
             Install: curl -L https://foundry.paradigm.xyz | bash && foundryup"
        ),
    }
}

pub async fn run(cmd: DeployCmd) -> Result<()> {
    check_forge()?;
    let contracts_dir = contracts_dir();

    match cmd {
        DeployCmd::Contract {
            name,
            chain,
            rpc_url,
            private_key,
            args,
            dry_run,
        } => {
            ui::print_header(&format!("Deploy {} → {}", name, chain));

            let path = find_contract_file(&contracts_dir, &name).context(format!(
                "Contract '{}' not found in {}/src/evm or src/dex.\n\
                 Run 'zion deploy list' to see available contracts.",
                name,
                contracts_dir.display()
            ))?;

            ui::print_row("Contract", &path.display().to_string());
            ui::print_row("Chain", &chain);

            if dry_run {
                ui::print_info("Dry-run: compiling only (forge build)...");
                let status = Command::new("forge")
                    .arg("build")
                    .current_dir(&contracts_dir)
                    .status()
                    .context("Failed to run `forge build`")?;
                if status.success() {
                    ui::print_info("✅ Compilation successful (dry-run, no deployment).");
                } else {
                    anyhow::bail!("`forge build` failed");
                }
                return Ok(());
            }

            // Real deployment via `forge create`
            let rpc = rpc_url
                .or_else(|| std::env::var("FORGE_RPC_URL").ok())
                .map(|s| s.to_string())
                .or_else(|| default_rpc_url(&chain).map(|s| s.to_string()))
                .context(format!(
                    "No RPC URL for chain '{}'. Use --rpc-url or set FORGE_RPC_URL env var.",
                    chain
                ))?;

            let pk = private_key
                .or_else(|| std::env::var("FORGE_PRIVATE_KEY").ok())
                .or_else(|| std::env::var("PRIVATE_KEY").ok())
                .context("No private key. Use --private-key or set FORGE_PRIVATE_KEY env var.")?;

            ui::print_row("RPC URL", &rpc);

            let contract_path = format!("{}:{}", path.display(), name);

            let mut forge_cmd = Command::new("forge");
            forge_cmd
                .arg("create")
                .arg(&contract_path)
                .arg("--rpc-url")
                .arg(&rpc)
                .arg("--private-key")
                .arg(&pk);

            if let Some(ref ctor_args) = args {
                ui::print_row("Constructor args", ctor_args);
                for arg in ctor_args.split(',') {
                    forge_cmd.arg("--constructor-args").arg(arg.trim());
                }
            }

            ui::print_info("Running forge create...");

            let status = forge_cmd
                .current_dir(&contracts_dir)
                .status()
                .context("Failed to run `forge create`")?;

            if status.success() {
                ui::print_info("✅ Contract deployed successfully!");
            } else {
                anyhow::bail!("`forge create` failed with exit code {:?}", status.code());
            }
            println!();
        }

        DeployCmd::Script {
            chain,
            rpc_url,
            private_key,
            dry_run,
        } => {
            ui::print_header(&format!("Deploy Script → {}", chain));

            let script_path = "script/DeployBase.s.sol:DeployBase";
            ui::print_row("Script", script_path);
            ui::print_row("Chain", &chain);

            let rpc = rpc_url
                .or_else(|| std::env::var("FORGE_RPC_URL").ok())
                .map(|s| s.to_string())
                .or_else(|| default_rpc_url(&chain).map(|s| s.to_string()))
                .context(format!("No RPC URL for chain '{}'", chain))?;

            let pk = private_key
                .or_else(|| std::env::var("PRIVATE_KEY").ok())
                .context("No private key. Use --private-key or set PRIVATE_KEY env var.")?;

            ui::print_row("RPC URL", &rpc);

            let mut forge_cmd = Command::new("forge");
            forge_cmd
                .arg("script")
                .arg(script_path)
                .arg("--rpc-url")
                .arg(&rpc)
                .arg("--private-key")
                .arg(&pk);

            if dry_run {
                ui::print_info("Dry-run: simulating only (no broadcast)...");
            } else {
                forge_cmd.arg("--broadcast");
            }

            ui::print_info("Running forge script...");

            let status = forge_cmd
                .current_dir(&contracts_dir)
                .status()
                .context("Failed to run `forge script`")?;

            if status.success() {
                ui::print_info("✅ Script completed successfully!");
            } else {
                anyhow::bail!("`forge script` failed with exit code {:?}", status.code());
            }
            println!();
        }

        DeployCmd::List => {
            ui::print_header("Available Contracts");
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
            ui::print_info("Deploy with: zion deploy contract --name <Name> --chain <chain> --private-key <key>");
        }

        DeployCmd::Verify {
            chain,
            address,
            contract,
            etherscan_api_key,
        } => {
            ui::print_header("Verify Contract");
            ui::print_row("Chain", &chain);
            ui::print_row("Address", &address);
            ui::print_row("Contract", &contract);

            let api_key = etherscan_api_key
                .or_else(|| std::env::var("ETHERSCAN_API_KEY").ok())
                .context("No Etherscan API key. Use --etherscan-api-key or set ETHERSCAN_API_KEY env var.")?;

            ui::print_info("Running forge verify-contract...");

            let status = Command::new("forge")
                .arg("verify-contract")
                .arg(&address)
                .arg(&contract)
                .arg("--etherscan-api-key")
                .arg(&api_key)
                .current_dir(&contracts_dir)
                .status()
                .context("Failed to run `forge verify-contract`")?;

            if status.success() {
                ui::print_info("✅ Verification submitted!");
            } else {
                anyhow::bail!("`forge verify-contract` failed");
            }
            println!();
        }

        DeployCmd::Test => {
            ui::print_header("Foundry Tests");
            ui::print_info("Running forge test...");

            let status = Command::new("forge")
                .arg("test")
                .arg("-vv")
                .current_dir(&contracts_dir)
                .status()
                .context("Failed to run `forge test`")?;

            if status.success() {
                ui::print_info("✅ All tests passed!");
            } else {
                anyhow::bail!("`forge test` failed");
            }
            println!();
        }
    }
    Ok(())
}
