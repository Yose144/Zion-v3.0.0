//! WARP daemon — long-running bridge node.
//!
//! This binary is a thin wrapper around `WarpRuntime`. The same runtime can
//! also be started from `MultichainService`.
//!
//! Starting with V3.1, `warpd` also hosts the multi-chain DEX API
//! (`/v1/swap/*`, `/v1/multichain/*`, ...) on the next port
//! (`listen_port + 1`). This keeps WARP bridge routes and the DEX intent
//! engine in a single process while keeping a clean listener separation.
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

use std::path::Path;
use std::process::ExitCode;
use std::sync::Arc;

use clap::Parser;
use tracing::{error, info};

use zion_multichain::config::{AdapterConfig, DatabaseConfig, MultichainConfig, ServerConfig};
use zion_multichain::server::ApiServer;
use zion_multichain::service::MultichainService;
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

fn load_config(cli: &Cli) -> Result<WarpConfig, String> {
    if Path::new(&cli.config).exists() {
        let toml_str = std::fs::read_to_string(&cli.config)
            .map_err(|e| format!("failed to read config {}: {}", cli.config, e))?;
        WarpConfig::load_from_str(&toml_str).map_err(|e| format!("failed to parse TOML: {}", e))
    } else {
        tracing::warn!("config file '{}' not found — using defaults", cli.config);
        Ok(WarpConfig::default())
    }
}

fn multichain_db_path(warp_db: &str) -> String {
    let path = Path::new(warp_db);
    if let Some(parent) = path.parent() {
        if let Some(file_name) = path.file_name().and_then(|f| f.to_str()) {
            let stem = file_name.strip_suffix(".db").unwrap_or(file_name);
            return parent
                .join(format!("{}_multichain.db", stem))
                .to_string_lossy()
                .into_owned();
        }
    }
    format!("{}_multichain.db", warp_db.strip_suffix(".db").unwrap_or(warp_db))
}

fn build_multichain_config(warp: &WarpConfig) -> MultichainConfig {
    MultichainConfig {
        server: ServerConfig {
            bind: warp.listen_addr.clone(),
            port: warp.listen_port.wrapping_add(1),
            ..Default::default()
        },
        database: DatabaseConfig {
            path: multichain_db_path(&warp.database_path),
        },
        l1_rpc_url: warp.l1_rpc_url.clone(),
        adapters: warp
            .chains
            .iter()
            .filter(|c| c.enabled)
            .map(|c| AdapterConfig {
                chain: c.name.clone(),
                rpc_url: c.rpc_url.clone(),
                enabled: true,
            })
            .collect(),
        pool: None,
        warp: None,
    }
}

#[tokio::main]
async fn main() -> ExitCode {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();
    let mut config = match load_config(&cli) {
        Ok(c) => c,
        Err(e) => {
            error!("[warpd] {}", e);
            return ExitCode::FAILURE;
        }
    };

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

    let runtime = match WarpRuntime::new(config.clone()) {
        Ok(r) => r,
        Err(e) => {
            error!("[warpd] Failed to initialize WARP runtime: {}", e);
            return ExitCode::FAILURE;
        }
    };

    let multichain_config = build_multichain_config(&config);
    if let Some(parent) = Path::new(&multichain_config.database.path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let service = match MultichainService::new(multichain_config) {
        Ok(s) => Arc::new(s),
        Err(e) => {
            error!("[warpd] Failed to initialize Multi-chain service: {}", e);
            return ExitCode::FAILURE;
        }
    };

    let dex_config = ServerConfig {
        bind: config.listen_addr.clone(),
        port: config.listen_port.wrapping_add(1),
        ..Default::default()
    };
    let api_server = ApiServer::new(dex_config, Arc::clone(&service));
    let api_bind = format!("{}:{}", config.listen_addr, config.listen_port.wrapping_add(1));

    tokio::spawn(async move {
        info!("[warpd] Multi-chain DEX API starting on {}", api_bind);
        if let Err(e) = api_server.run().await {
            error!("[warpd] Multi-chain API server error: {}", e);
        }
    });

    info!("[warpd] Starting WARP daemon");
    if let Err(e) = runtime.run().await {
        error!("[warpd] Runtime error: {}", e);
        return ExitCode::FAILURE;
    }

    ExitCode::FAILURE
}
