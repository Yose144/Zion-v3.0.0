use anyhow::Result;
use clap::{CommandFactory, Parser, Subcommand};
use std::io::{self, IsTerminal};

mod commands;
mod config;
mod menu;
mod rpc;
mod ui;

use commands::{agent, bridge, completions, dao, deploy, doctor, explorer, mine, monitor, ncl, node, onboard, pool, status, update, wallet, warp};

#[allow(unused_imports)]
use toml;
use clap_complete::Shell;

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
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Open interactive arrow-key operator menu
    Menu,
    /// Print release metadata and manual update guidance
    Version,
    /// Check for and install the latest published CLI artifact
    Update {
        /// Only compare the local binary with the published artifact
        #[arg(long)]
        check: bool,
        /// Skip interactive confirmation and apply the update immediately
        #[arg(long)]
        yes: bool,
    },
    /// First-time setup wizard
    Onboard,
    /// Start service(s): all | node | pool | miner | agent | ai-native | bridge | dao | website | redis | monitoring
    Start {
        #[arg(default_value = "all")]
        service: String,
    },
    /// Stop service(s): all | node | pool | miner | agent | ai-native | bridge | dao | website | redis | monitoring
    Stop {
        #[arg(default_value = "all")]
        service: String,
    },
    /// Restart service(s): all | node | pool | miner | agent | ai-native | bridge | dao | website | redis | monitoring
    Restart {
        #[arg(default_value = "all")]
        service: String,
    },
    /// Health check — all layers
    Status,
    /// Run preflight diagnostics for config, local tools, and endpoints
    Doctor,
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
    /// L2 bridge gateway
    Bridge {
        #[command(subcommand)]
        cmd: bridge::BridgeCmd,
    },
    /// L2 DAO governance
    Dao {
        #[command(subcommand)]
        cmd: dao::DaoCmd,
    },
    /// Block explorer TUI
    Explorer,
    /// Live stack monitor TUI (all layers)
    Monitor,
    /// L3 Warp cross-chain relay
    Warp {
        #[command(subcommand)]
        cmd: warp::WarpCmd,
    },
    /// L3 NCL Neural Compute Layer
    Ncl {
        #[command(subcommand)]
        cmd: ncl::NclCmd,
    },
    /// Print shell completion script
    Completions {
        /// Shell: bash | zsh | fish | powershell
        shell: Shell,
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
    /// Validate current config values
    Validate,
    /// Re-run onboarding wizard
    Init,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let should_open_menu = cli
        .command
        .as_ref()
        .map(|cmd| matches!(cmd, Commands::Menu))
        .unwrap_or(true);

    if should_open_menu {
        if !io::stdin().is_terminal() || !io::stdout().is_terminal() {
            let mut cmd = Cli::command();
            cmd.print_help()?;
            println!();
            return Ok(());
        }

        return run_menu_session(cli.config).await;
    }

    dispatch(cli).await
}

async fn run_menu_session(default_config: Option<String>) -> Result<()> {
    let mut show_genesis = true;

    loop {
        let args = match menu::run(show_genesis)? {
            Some(args) => args,
            None => return Ok(()),
        };
        show_genesis = false;

        let mut cli = Cli::try_parse_from(args)?;
        if cli.config.is_none() {
            cli.config = default_config.clone();
        }

        if let Err(err) = dispatch(cli).await {
            ui::print_err(&format!("{}", err));
            println!();
        }

        ui::wait_for_enter("Press Enter to return to the ZION menu...")?;
    }
}

async fn dispatch(cli: Cli) -> Result<()> {
    let cfg = config::load(cli.config.as_deref())?;
    let command = cli
        .command
        .ok_or_else(|| anyhow::anyhow!("no command selected"))?;

    match command {
        Commands::Menu => unreachable!("interactive menu is resolved before dispatch"),
        Commands::Version => update::print_version_surface(&cfg),
        Commands::Update { check, yes } => update::run(&cfg, check, yes).await,
        Commands::Onboard => onboard::run(&cfg).await,
        Commands::Status => status::run(&cfg).await,
        Commands::Doctor => doctor::run(&cfg).await,
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
        Commands::Bridge { cmd } => bridge::run(&cfg, cmd).await,
        Commands::Dao { cmd } => dao::run(&cfg, cmd).await,
        Commands::Explorer => explorer::run(&cfg).await,
        Commands::Monitor => monitor::run(&cfg).await,
        Commands::Warp { cmd } => warp::run(&cfg, cmd).await,
        Commands::Ncl { cmd } => ncl::run(&cfg, cmd).await,
        Commands::Completions { shell } => completions::run(shell),
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
            ConfigCmd::Validate => {
                ui::print_header("Config Validation");
                let report = config::validate(&cfg);

                for warning in &report.warnings {
                    ui::print_warn(warning);
                }
                for error in &report.errors {
                    ui::print_err(error);
                }

                if report.is_ok() {
                    ui::print_ok("Config is valid");
                    Ok(())
                } else {
                    anyhow::bail!("Config validation failed with {} error(s)", report.errors.len())
                }
            }
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
