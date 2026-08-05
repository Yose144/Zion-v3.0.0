pub mod auto_detect;
pub mod commands;
pub mod config;
pub mod menu;
pub mod rpc;
pub mod ui;

use clap::{Parser, Subcommand};
use clap_complete::Shell;
#[cfg(feature = "admin")]
use commands::deploy;
use commands::{
    agent, atomic_swap, auxpow, bridge, compose, dao, free_world, hiran, issobella, mine, ncl,
    node, pool, swap, topology, wallet, warp,
};

#[derive(Parser)]
#[command(
    name = "zion",
    about = "Zion CLI — unified gateway for the entire ZION stack",
    long_about = None,
    version,
    propagate_version = true,
)]
pub struct Cli {
    /// Config file (default: ~/.zion/zion.toml)
    #[arg(long, global = true)]
    pub config: Option<String>,

    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand)]
pub enum Commands {
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
    #[cfg(feature = "admin")]
    Start {
        #[arg(default_value = "all")]
        service: String,
    },
    /// Stop service(s): all | node | pool | miner | agent | ai-native | bridge | dao | website | redis | monitoring
    #[cfg(feature = "admin")]
    Stop {
        #[arg(default_value = "all")]
        service: String,
    },
    /// Restart service(s): all | node | pool | miner | agent | ai-native | bridge | dao | website | redis | monitoring
    #[cfg(feature = "admin")]
    Restart {
        #[arg(default_value = "all")]
        service: String,
    },
    /// Tail logs for a service
    #[cfg(feature = "admin")]
    Logs {
        #[arg(default_value = "node")]
        service: String,
    },
    /// Server deployment
    #[cfg(feature = "admin")]
    Deploy {
        #[command(subcommand)]
        cmd: deploy::DeployCmd,
    },
    /// Health check — all layers
    Status,
    /// Run preflight diagnostics for config, local tools, and endpoints
    Doctor,
    /// Open web dashboard in browser
    Dashboard,

    /// Docker Compose integration (up, down, logs, ps, doctor)
    Compose {
        #[command(subcommand)]
        cmd: compose::ComposeSubcommand,
    },

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
    /// Hiran v2.2 inference service
    Hiran {
        #[command(subcommand)]
        cmd: hiran::HiranCmd,
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
    /// L2 DeFi swap aggregator
    Swap {
        #[command(subcommand)]
        cmd: swap::SwapCmd,
    },
    /// L2 Atomic Swap (HTLC cross-chain)
    AtomicSwap {
        #[command(subcommand)]
        cmd: atomic_swap::AtomicSwapCmd,
    },
    /// AuxPow / merge-mining configuration helper
    Auxpow {
        #[command(subcommand)]
        cmd: auxpow::AuxPowCmd,
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
    /// Core+edge topology operations (status, e2e, config)
    Topology {
        #[command(subcommand)]
        cmd: topology::TopologyCmd,
    },
    /// L5 Free World humanitarian layer
    FreeWorld {
        #[command(subcommand)]
        cmd: free_world::FreeWorldCmd,
    },
    /// L6 Issobella space layer
    Issobella {
        #[command(subcommand)]
        cmd: issobella::IssobellaCmd,
    },
    /// Print shell completion script
    Completions {
        /// Shell: bash | zsh | fish | powershell
        shell: Shell,
    },
}

#[derive(Subcommand)]
pub enum ConfigCmd {
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
