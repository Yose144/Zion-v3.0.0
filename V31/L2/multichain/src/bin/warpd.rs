//! WARP daemon — long-running bridge node.
//!
//! Spawns three main loops on startup:
//!   1. HTTP API server (axum) for operator queries and manual transfer submission.
//!   2. Chain watcher that polls enabled adapters for BridgeBurn events.
//!   3. Outbound executor that signs and mints on destination chains.
//!   4. (Optional) Timelock monitor to release held transfers after 24h.
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
use std::sync::Arc;

use clap::Parser;
use tokio::sync::Mutex;
use tracing::{error, info};

use zion_multichain::warp::config::WarpConfig;
use zion_multichain::warp::db::TransferDb;
use zion_multichain::warp::executor::OutboundExecutor;
use zion_multichain::warp::server::{create_router, WarpState};
use zion_multichain::warp::timelock::TimelockMonitor;
use zion_multichain::warp::validator::WarpValidatorSet;
use zion_multichain::warp::watcher::WarpWatcher;
use zion_multichain::warp::WarpRouter;

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

    // Open or create DB.
    let db_path = config.database_path.clone();
    std::fs::create_dir_all(std::path::Path::new(&db_path).parent().unwrap_or(std::path::Path::new(".")))
        .ok();
    let transfer_db = match TransferDb::open(&db_path) {
        Ok(db) => {
            info!("[warpd] Database opened at {}", db_path);
            Some(db)
        }
        Err(e) => {
            error!("[warpd] Failed to open database at {}: {}", db_path, e);
            return ExitCode::FAILURE;
        }
    };

    // Build validator set and load signing keys from env.
    let mut validator_set = WarpValidatorSet::new(config.quorum);
    if let Err(e) = validator_set.load_from_env() {
        error!("[warpd] Failed to load validator keys: {}", e);
        return ExitCode::FAILURE;
    }
    let validator_count = validator_set.total_count();
    let can_sign = validator_set.can_sign_quorum_locally();
    info!(
        "[warpd] Loaded {} validator(s), can sign quorum locally: {}",
        validator_count, can_sign
    );
    let validators = Arc::new(Mutex::new(validator_set));

    // Build router, loading any persisted transfers from DB.
    let registry = zion_multichain::warp::ChainRegistry::with_defaults();
    let fee_engine = zion_multichain::warp::FeeEngine::with_defaults();
    let router = match WarpRouter::with_db(registry, fee_engine, validators.clone(), transfer_db.clone().unwrap()) {
        Ok(r) => Arc::new(Mutex::new(r)),
        Err(e) => {
            error!("[warpd] Failed to initialize router: {}", e);
            return ExitCode::FAILURE;
        }
    };

    // Update router daily limits from config.
    {
        let mut r = router.lock().await;
        r.daily_limit = config.daily_limit_flowers();
        r.timelock_threshold = config.timelock_threshold_flowers();
    }

    // Spawn HTTP API server.
    let bind_addr = format!("{}:{}", config.listen_addr, config.listen_port);
    let app_state = WarpState {
        router: router.clone(),
        config: config.clone(),
        db: transfer_db.clone(),
    };
    let app = create_router(app_state);
    let bind_addr_for_task = bind_addr.clone();
    let api_handle = tokio::spawn(async move {
        info!("[warpd] API server listening on {}", bind_addr_for_task);
        let listener = match tokio::net::TcpListener::bind(&bind_addr_for_task).await {
            Ok(l) => l,
            Err(e) => {
                error!("[warpd] Failed to bind API server: {}", e);
                return;
            }
        };
        if let Err(e) = axum::serve(listener, app).await {
            error!("[warpd] API server error: {}", e);
        }
    });

    // Spawn chain watcher.
    let watcher_db = transfer_db.clone();
    let watcher = WarpWatcher::from_config(config.clone(), router.clone(), watcher_db);
    let watcher_handle = tokio::spawn(watcher.run());

    // Spawn outbound executor.
    let executor = OutboundExecutor::new(router.clone(), validators.clone());
    let executor_handle = tokio::spawn(executor.run());

    // Spawn timelock monitor (releases held transfers after expiry).
    let timelock = TimelockMonitor::default(router.clone());
    let timelock_handle = tokio::spawn(timelock.run());

    info!("[warpd] WARP daemon started. API: http://{}", bind_addr);

    // Wait for any task to exit (they normally never do).
    tokio::select! {
        _ = api_handle => error!("[warpd] API server exited"),
        _ = watcher_handle => error!("[warpd] Watcher exited"),
        _ = executor_handle => error!("[warpd] Executor exited"),
        _ = timelock_handle => error!("[warpd] Timelock monitor exited"),
    }

    ExitCode::FAILURE
}
