use anyhow::Result;
use clap::{Parser, Subcommand};

mod commands;
mod config;
mod rpc;
mod ui;

use commands::{agent, deploy, mine, node, onboard, pool, status, wallet};

#[allow(unused_imports)]
use toml;

#[derive(Parser)]
#[command(
    name = "zion",
    about = "Zion CLI — unified gateway for the entire ZION stack",
    long_about = None,
    version,
    propagate_version = true,
)]
struct Cli {
    /// Config file (default: ~/.zion/zion.toml)
    #[arg(long, global = true)]
    config: Option<String>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// First-time setup wizard
    Onboard,
    /// Start service(s): all | node | pool | miner | agent | website
    Start {
        #[arg(default_value = "all")]
        service: String,
    },
    /// Stop service(s)
    Stop {
        #[arg(default_value = "all")]
        service: String,
    },
    /// Restart service(s)
    Restart {
        #[arg(default_value = "all")]
        service: String,
    },
    /// Health check — all layers
    Status,
    /// Tail logs for a service
    Logs {
        #[arg(default_value = "node")]
        service: String,
    },
    /// Open web dashboard in browser
    Dashboard,

    /// L1 core node commands
    Node {
        #[command(subcommand)]
        cmd: node::NodeCmd,
    },
    /// L1 pool commands
    Pool {
        #[command(subcommand)]
        cmd: pool::PoolCmd,
    },
    /// L1 miner commands
    Mine {
        #[command(subcommand)]
        cmd: mine::MineCmd,
    },
    /// Wallet operations
    Wallet {
        #[command(subcommand)]
        cmd: wallet::WalletCmd,
    },
    /// L3 Hiranyagarbha AI Native agent gateway
    Agent {
        #[command(subcommand)]
        cmd: agent::AgentCmd,
    },
    /// Server deployment
    Deploy {
        #[command(subcommand)]
        cmd: deploy::DeployCmd,
    },
    /// Config management
    Config {
        #[command(subcommand)]
        cmd: ConfigCmd,
    },
}

#[derive(Subcommand)]
enum ConfigCmd {
    /// Print effective config
    Show,
    /// Set a config value
    Set { key: String, value: String },
    /// Show config file path
    Path,
    /// Re-run onboarding wizard
    Init,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let cfg = config::load(cli.config.as_deref())?;

    match cli.command {
        Commands::Onboard => onboard::run(&cfg).await,
        Commands::Status => status::run(&cfg).await,
        Commands::Dashboard => {
            let url = format!("http://{}:3000", cfg.node.rpc_host);
            ui::print_info(&format!("Opening {}", url));
            open_browser(&url)
        }
        Commands::Start { service } => deploy::start_service(&cfg, &service).await,
        Commands::Stop { service } => deploy::stop_service(&cfg, &service).await,
        Commands::Restart { service } => deploy::restart_service(&cfg, &service).await,
        Commands::Logs { service } => deploy::tail_logs(&cfg, &service).await,
        Commands::Node { cmd } => node::run(&cfg, cmd).await,
        Commands::Pool { cmd } => pool::run(&cfg, cmd).await,
        Commands::Mine { cmd } => mine::run(&cfg, cmd).await,
        Commands::Wallet { cmd } => wallet::run(&cfg, cmd).await,
        Commands::Agent { cmd } => agent::run(&cfg, cmd).await,
        Commands::Deploy { cmd } => deploy::run(&cfg, cmd).await,
        Commands::Config { cmd } => match cmd {
            ConfigCmd::Show => {
                let text = toml::to_string_pretty(&cfg)?;
                println!("{}", text);
                Ok(())
            }
            ConfigCmd::Path => {
                println!("{}", config::config_path()?.display());
                Ok(())
            }
            ConfigCmd::Set { key, value } => config::set_value(&key, &value),
            ConfigCmd::Init => onboard::run(&cfg).await,
        },
    }
}

fn open_browser(url: &str) -> Result<()> {
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(url).spawn()?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(url).spawn()?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("cmd").args(["/c", "start", url]).spawn()?;
    Ok(())
}
