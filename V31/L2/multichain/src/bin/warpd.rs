//! WARP daemon — long-running bridge node.
//!
//! This binary is a thin wrapper around `WarpRuntime`. The same runtime can
//! also be started from `MultichainService`.
//!
//! Configuration is loaded from a TOML file or env vars. The database path is
//! taken from the config (`database_path`).
//!
//! ## Environment variables
//! - `WARP_CONFIG` — path to TOML config (default: `warp.toml`)
//! - `WARP_VALIDATOR_KEYS` — comma-separated ed25519 private keys in hex,
//!   format: `val1:hex1,val2:hex2,...`
//! - Per-chain signing keys and contract addresses are read by each adapter
//!   (e.g. `WARP_EVM_RELAY_KEY`, `WARP_SOLANA_RELAY_KEY`, etc.).

use std::process::ExitCode;

use clap::Parser;
use tracing::{error, info};

use zion_multichain::warp::config::WarpConfig;
use zion_multichain::warp::runtime::WarpRuntime;

#[derive(Parser, Debug)]
#[command(name = "warpd", version, about = "WARP cross-chain bridge daemon")]
struct Cli {
    /// Path to TOML config file.
    #[arg(short, long, default_value = "warp.toml")]
    config: String,

    /// Listen address override (takes precedence over config).
    #[arg(short, long)]
    listen: Option<String>,

    /// Database path override.
    #[arg(short, long)]
    db: Option<String>,
}

fn load_config(cli: &Cli) -> WarpConfig {
    if std::path::Path::new(&cli.config).exists() {
        let toml_str = std::fs::read_to_string(&cli.config)
            .unwrap_or_else(|e| panic!("failed to read config {}: {}", cli.config, e));
        WarpConfig::load_from_str(&toml_str)
            .unwrap_or_else(|e| panic!("failed to parse TOML: {}", e))
    } else {
        tracing::warn!("config file '{}' not found — using defaults", cli.config);
        WarpConfig::default()
    }
}

#[tokio::main]
async fn main() -> ExitCode {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();
    let mut config = load_config(&cli);

    if let Some(addr) = &cli.listen {
        let parts: Vec<&str> = addr.split(':').collect();
        if parts.len() == 2 {
            config.listen_addr = parts[0].to_string();
            config.listen_port = parts[1].parse().unwrap_or(config.listen_port);
        } else {
            config.listen_addr = addr.clone();
        }
    }
    if let Some(db) = &cli.db {
        config.database_path = db.clone();
    }

    let runtime = match WarpRuntime::new(config) {
        Ok(r) => r,
        Err(e) => {
            error!("[warpd] Failed to initialize WARP runtime: {}", e);
            return ExitCode::FAILURE;
        }
    };

    info!("[warpd] Starting WARP daemon");
    if let Err(e) = runtime.run().await {
        error!("[warpd] Runtime error: {}", e);
        return ExitCode::FAILURE;
    }

    ExitCode::FAILURE
}
