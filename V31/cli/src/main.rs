use std::path::PathBuf;
use std::sync::Arc;

use clap::{Parser, Subcommand};

use zion_l1_types::{Address, ChainId};
use zion_multichain::config::MultichainConfig;
use zion_multichain::MultichainService;

#[derive(Parser)]
#[command(name = "zion")]
#[command(about = "ZION V31 Mainnet Alpha CLI")]
#[command(version)]
struct Cli {
    /// Path to the multichain TOML config.
    #[arg(short, long, global = true, value_name = "FILE")]
    config: Option<PathBuf>,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Status of the Multi-Chain layer.
    Status,
    /// Wallet commands.
    Wallet(WalletArgs),
}

#[derive(Parser)]
struct WalletArgs {
    #[command(subcommand)]
    command: WalletCommand,
}

#[derive(Subcommand)]
enum WalletCommand {
    /// Query native balance for an address.
    Balance {
        /// Chain id, e.g. bitcoin, base, zion-l1.
        #[arg(short, long)]
        chain: String,
        /// Encoded address string.
        #[arg(short, long)]
        address: String,
    },
}

fn load_config(path: Option<PathBuf>) -> anyhow::Result<MultichainConfig> {
    let path = path.unwrap_or_else(|| PathBuf::from("multichain.toml"));
    if !path.exists() {
        return Ok(MultichainConfig::default());
    }
    let text = std::fs::read_to_string(&path)?;
    let config: MultichainConfig = toml::from_str(&text)?;
    Ok(config)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    let cli = Cli::parse();

    let config = load_config(cli.config)?;
    let service = Arc::new(MultichainService::new(config)?);

    match cli.command {
        Command::Status => {
            println!("Registered chains: {:?}", service.chains());
            let health = service.health().await;
            for (chain, ok) in &health {
                println!("  {chain}: {}", if *ok { "ok" } else { "unreachable" });
            }
            if health.is_empty() {
                println!("No adapters enabled. Create a multichain.toml to connect to chains.");
            }
        }
        Command::Wallet(wallet) => match wallet.command {
            WalletCommand::Balance { chain, address } => {
                let chain_id = chain_name_to_id(&chain)?;
                let bytes = address_bytes(&chain_id, &address)?;
                let addr = Address::new(chain_id, bytes, address)?;
                let balance = service.balance(&addr).await?;
                println!("{chain}: {balance}");
            }
        },
    }

    Ok(())
}

fn chain_name_to_id(name: &str) -> anyhow::Result<ChainId> {
    match name.to_lowercase().as_str() {
        "bitcoin" | "btc" => Ok(ChainId::Bitcoin),
        "base" => Ok(ChainId::Base),
        "ethereum" | "eth" => Ok(ChainId::Ethereum),
        "zion-l1" | "zion" | "zionl1" => Ok(ChainId::ZionL1),
        _ => anyhow::bail!("unknown chain: {name}"),
    }
}
