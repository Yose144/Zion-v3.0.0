use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "zion")]
#[command(about = "ZION V31 Mainnet Alpha CLI")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Status of the Multi-Chain layer.
    Status,
    /// Wallet commands.
    Wallet,
    /// Bridge commands.
    Bridge,
    /// Swap commands.
    Swap,
    /// DEX commands.
    Dex,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    let cli = Cli::parse();

    match cli.command {
        Command::Status => println!("zion-multichain status: scaffold"),
        Command::Wallet => println!("wallet: not yet implemented"),
        Command::Bridge => println!("bridge: not yet implemented"),
        Command::Swap => println!("swap: not yet implemented"),
        Command::Dex => println!("dex: not yet implemented"),
    }

    Ok(())
}
