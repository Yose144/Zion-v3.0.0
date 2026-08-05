//! ZION triple-stream miner binary (V31).
//!
//! Runs three concurrent tokio mining streams:
//!   - Stream 1: ZION canonical / pool stratum mining.
//!   - Stream 2: external GPU AuxPoW (KAS/ALPH/RVN/EPIC/ZANO/etc.).
//!   - Stream 3: external CPU AuxPoW (VRSC/XMR/RTM/etc.).
//!
//! Stream 2/3 fall back to CPU mining when no GPU is configured or available.
//! All configuration can come from CLI flags or environment variables.

use std::net::SocketAddr;
use std::time::Duration;

use anyhow::{Context, Result};
use clap::Parser;
use tokio::sync::watch;
use tokio::time::sleep;
use tracing::{info, warn};
use zion_l1_types::{Address, ChainId};

use zion_miner::config::MinerConfig;
use zion_miner::metrics::{serve, Metrics};
use zion_miner::runtime::MinerRuntime;
use zion_miner::stream::{StreamId, StreamStats};

#[derive(Parser, Debug)]
#[command(name = "zion-miner")]
#[command(about = "ZION triple-stream stratum miner (ZION + GPU AuxPoW + CPU AuxPoW)")]
#[command(version)]
struct Args {
    /// Pool stratum address (host:port) for ZION share mining.
    /// Also read from `ZION_POOL_ADDR`.
    #[arg(short, long)]
    pool: Option<String>,

    /// ZION L1 node RPC URL for solo mining.
    /// Also read from `ZION_NODE_RPC`.
    #[arg(long)]
    node: Option<String>,

    /// External AuxPoW stratum pool URL for Stream 2/3.
    /// Also read from `ZION_AUXPOW_POOL`.
    #[arg(long)]
    auxpow_pool: Option<String>,

    /// Stream 2 (GPU AuxPoW) stratum URL.
    /// Also read from `ZION_STREAM2_URL`.
    #[arg(long)]
    stream2_url: Option<String>,

    /// Stream 3 (CPU AuxPoW) stratum URL.
    /// Also read from `ZION_STREAM3_URL`.
    #[arg(long)]
    stream3_url: Option<String>,

    /// Wallet / reward address for coinbase.
    #[arg(long, default_value = "zion1pool")]
    wallet: String,

    /// Worker name.
    #[arg(short, long, default_value = "worker1")]
    worker: String,

    /// Number of CPU mining threads.
    /// Also read from `ZION_MINER_THREADS`.
    #[arg(short, long, default_value = "2")]
    threads: usize,

    /// Enable autonomous profit switching for Stream 2/3.
    /// Also read from `ZION_AUTONOMOUS=1`.
    #[arg(long)]
    autonomous: bool,

    /// Profit re-evaluation interval in seconds.
    /// Also read from `ZION_PROFIT_INTERVAL`.
    #[arg(long, default_value = "300")]
    profit_interval: u64,

    /// Disable Stream 1 (ZION).
    #[arg(long)]
    no_zion: bool,

    /// Disable Stream 2 (GPU AuxPoW).
    #[arg(long)]
    no_gpu: bool,

    /// Disable Stream 3 (CPU AuxPoW).
    #[arg(long)]
    no_cpu: bool,

    /// Prometheus metrics server bind address.
    #[arg(long, default_value = "127.0.0.1:9101")]
    metrics: SocketAddr,

    /// Log interval for per-stream statistics (seconds).
    #[arg(long, default_value = "30")]
    log_interval: u64,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let args = Args::parse();

    let reward_address = Address::new(ChainId::ZionL1, vec![], &args.wallet)
        .with_context(|| format!("invalid reward address: {}", args.wallet))?;

    let mut config = MinerConfig::new(reward_address);

    // CLI flags override environment defaults.
    config.pool_url = args.pool.or(config.pool_url);
    config.node_rpc_url = args.node.or(config.node_rpc_url);
    config.auxpow_pool = args.auxpow_pool.or(config.auxpow_pool);
    config.stream2_url = args.stream2_url.or(config.stream2_url);
    config.stream3_url = args.stream3_url.or(config.stream3_url);
    config.worker = args.worker;
    config.miner_threads = args.threads;
    config.stream1_enabled = !args.no_zion;
    config.stream2_enabled = !args.no_gpu;
    config.stream3_enabled = !args.no_cpu;
    config.autonomous = args.autonomous;
    config.profit_interval_sec = args.profit_interval;
    config.zion_nonce_batch = args.threads as u64 * 100_000;

    let runtime = MinerRuntime::new(config);
    let metrics = Metrics::new(
        runtime
            .config()
            .pool_url
            .as_deref()
            .or_else(|| runtime.config().node_rpc_url.as_deref())
            .unwrap_or("solo"),
        "zion",
    );

    // Start Prometheus endpoint.
    tokio::spawn(serve(metrics.clone(), args.metrics));

    // Background task: poll runtime stats and update metrics + logs.
    let stats_rt = runtime.clone();
    let stats_metrics = metrics.clone();
    tokio::spawn(async move {
        let mut last_stats: std::collections::HashMap<StreamId, StreamStats> = Default::default();
        loop {
            sleep(Duration::from_secs(args.log_interval.max(5))).await;
            let stats = stats_rt.stats().await;
            for (id, s) in &stats {
                let prev = last_stats.get(id).cloned().unwrap_or_else(|| s.clone());
                let coin = s
                    .coin
                    .as_ref()
                    .map(|c| c.to_string())
                    .unwrap_or_else(|| id.as_str().to_string());
                if s.accepted > prev.accepted {
                    let delta = s.accepted - prev.accepted;
                    for _ in 0..delta {
                        stats_metrics.inc_accepted();
                    }
                    stats_metrics.set_coin(&coin);
                }
                if s.rejected > prev.rejected {
                    let delta = s.rejected - prev.rejected;
                    for _ in 0..delta {
                        stats_metrics.inc_rejected();
                    }
                }
                let active = if s.active { "active" } else { "idle" };
                info!(
                    stream = %id.as_str(),
                    coin = %coin,
                    accepted = s.accepted,
                    rejected = s.rejected,
                    hashrate = %s.hashrate,
                    status = %active,
                    "stream stats"
                );
            }
            info!("{}", stats_metrics.tui_log());
            last_stats = stats;
        }
    });

    info!(
        stream1 = %(!args.no_zion),
        stream2 = %(!args.no_gpu),
        stream3 = %(!args.no_cpu),
        threads = args.threads,
        "zion-miner (triple stream) starting"
    );

    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    tokio::spawn(async move {
        if let Err(e) = tokio::signal::ctrl_c().await {
            warn!("ctrl-c handler error: {e}");
        }
        let _ = shutdown_tx.send(true);
    });

    runtime.run(shutdown_rx).await?;
    Ok(())
}
