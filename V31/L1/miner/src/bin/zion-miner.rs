//! ZION triple-stream miner binary (V31).
//!
//! Runs three concurrent tokio mining streams:
//!   - Stream 1: ZION canonical / pool stratum mining.
//!   - Stream 2: external GPU AuxPoW (KAS/ALPH/RVN/EPIC/ZANO/etc.).
//!   - Stream 3: external CPU AuxPoW (VRSC/XMR/RTM/etc.).
//!
//! Stream 2/3 fall back to CPU mining when no GPU is configured or available.
//! All configuration can come from CLI flags or environment variables.
//!
//! When compiled with the `tui` feature and `ZION_INTERACTIVE=1` (or
//! `--interactive`), the miner displays a Claymore-style sticky-header
//! dashboard with live trinity stats, algorithm, GPU info, and scrolling
//! log lines — just like the V3 miner.

use std::net::SocketAddr;
use std::time::{Duration, Instant};

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

    /// Enable V3 Trinity mode: single V3 protocol connection to the pool
    /// carries all 3 streams (ZION + GPU AuxPoW + CPU AuxPoW). The pool
    /// embeds external_stream jobs and forwards AuxPoW shares to external
    /// pools. Also read from `ZION_V3_TRINITY=1`.
    #[arg(long)]
    v3_trinity: bool,

    /// GPU backend for ZION Stream 1 mining: cuda, opencl, metal, cpu, auto.
    /// Also read from `ZION_GPU_BACKEND`. Default: auto (tries CUDA → OpenCL → CPU).
    #[arg(long)]
    gpu: Option<String>,

    /// Prometheus metrics server bind address.
    #[arg(long, default_value = "127.0.0.1:9101")]
    metrics: SocketAddr,

    /// Log interval for per-stream statistics (seconds).
    #[arg(long, default_value = "30")]
    log_interval: u64,

    /// Enable interactive TUI dashboard (Claymore-style sticky header).
    /// Also read from `ZION_INTERACTIVE=1`.
    #[arg(long)]
    interactive: bool,

    /// Disable the TUI dashboard even if `ZION_INTERACTIVE=1`.
    #[arg(long)]
    no_tui: bool,

    /// Watchdog timeout: if the miner reports hashrate but no share is
    /// accepted or rejected for this many seconds, the process exits so an
    /// external supervisor (systemd / SMOS) can restart it.  Disabled when 0.
    /// Also read from `ZION_WATCHDOG_TIMEOUT_SEC`.
    #[arg(long, default_value = "300")]
    watchdog_timeout: u64,
}

/// Parse a bool env var (1/true/yes → true).
fn env_bool(key: &str, default: bool) -> bool {
    std::env::var(key)
        .map(|v| matches!(v.as_str(), "1" | "true" | "yes" | "TRUE" | "YES"))
        .unwrap_or(default)
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let args = Args::parse();

    // ── Determine TUI mode ──
    #[cfg(feature = "tui")]
    let tui_enabled = !args.no_tui && (args.interactive || env_bool("ZION_INTERACTIVE", false));
    #[cfg(not(feature = "tui"))]
    let tui_enabled = false;

    // ── Watchdog timeout ──
    // CLI --watchdog-timeout overrides ZION_WATCHDOG_TIMEOUT_SEC; 0 disables.
    let watchdog_timeout = std::env::var("ZION_WATCHDOG_TIMEOUT_SEC")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(args.watchdog_timeout);

    let reward_address = Address::new(ChainId::ZionL1, vec![], &args.wallet)
        .with_context(|| format!("invalid reward address: {}", args.wallet))?;

    let mut config = MinerConfig::new(reward_address);

    // CLI flags override environment defaults.
    config.pool_url = args.pool.or(config.pool_url);
    config.node_rpc_url = args.node.or(config.node_rpc_url);
    config.auxpow_pool = args.auxpow_pool.or(config.auxpow_pool);
    config.stream2_url = args.stream2_url.or(config.stream2_url);
    config.stream3_url = args.stream3_url.or(config.stream3_url);
    config.worker = args.worker.clone();
    config.miner_threads = args.threads;
    // CLI --no-* flags override env vars; if flag is absent, keep env var value
    if args.no_zion {
        config.stream1_enabled = false;
    }
    if args.no_gpu {
        config.stream2_enabled = false;
    }
    if args.no_cpu {
        config.stream3_enabled = false;
    }
    // GPU backend for Stream 1 (ZION deeksha) — CLI overrides env
    if let Some(ref gpu) = args.gpu {
        config.gpu_backend = gpu.clone();
    }
    config.autonomous = args.autonomous;
    config.profit_interval_sec = args.profit_interval;
    // Nonce batch: when CPU threads > 0, scale with threads. When GPU-only
    // (threads=0), use a generous default so the GPU kernel actually launches.
    config.zion_nonce_batch = if args.threads > 0 {
        args.threads as u64 * 100_000
    } else {
        100_000 // GPU-only mode: large enough for multiple GPU chunks
    };

    // ── Startup banner (ZION ASCII art + hardware table) ──
    // Skip the text-mode banner when the ratatui TUI is active; the TUI
    // shows the same information in its header and takes over the terminal.
    #[cfg(feature = "tui")]
    {
        if !tui_enabled && !env_bool("ZION_NO_FANCY", false) {
            zion_miner::banner::print_banner(args.threads);
            // Print algorithm + pool info below the banner
            let consensus = zion_core::node_runtime::consensus_profile();
            let pool_addr = config
                .pool_url
                .as_deref()
                .or(config.node_rpc_url.as_deref())
                .unwrap_or("solo");
            println!("  algorithm   {}", consensus);
            println!("  pool        {}", pool_addr);
            println!("  wallet      {}", args.wallet);
            println!("  worker      {}", args.worker);
            println!(
                "  streams     ZION={} GPU={} CPU={}",
                !args.no_zion, !args.no_gpu, !args.no_cpu
            );
            let gpu_backend_display = args
                .gpu
                .clone()
                .or_else(|| std::env::var("ZION_GPU_BACKEND").ok())
                .unwrap_or_else(|| "cpu".to_string());
            println!("  gpu_backend {} (Stream 1 ZION)", gpu_backend_display);
            if args.autonomous {
                println!(
                    "  autonomous  ON (profit switching every {}s)",
                    args.profit_interval
                );
            }
            println!();
        }
    }

    let (s1, s2, s3) = (
        config.stream1_enabled,
        config.stream2_enabled,
        config.stream3_enabled,
    );
    let runtime = MinerRuntime::new(config);
    let pool_addr = runtime
        .config()
        .pool_url
        .as_deref()
        .or_else(|| runtime.config().node_rpc_url.as_deref())
        .unwrap_or("solo")
        .to_string();
    let metrics = Metrics::new(&pool_addr, "zion");

    // Start Prometheus endpoint.
    tokio::spawn(serve(metrics.clone(), args.metrics));

    // ── Shutdown signal ──
    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    // ── Ratatui TUI (feature-gated) ──
    // When --interactive is set, spawn the TUI as a separate task.  It will
    // draw to the terminal and handle keyboard input (q/Esc to quit).
    #[cfg(feature = "tui")]
    {
        if tui_enabled {
            let tui_runtime = runtime.clone();
            let tui_shutdown_rx = shutdown_rx.clone();
            let tui_shutdown_tx = shutdown_tx.clone();
            tokio::spawn(async move {
                if let Err(e) = zion_miner::tui::run_tui(
                    tui_runtime,
                    tui_shutdown_rx,
                    tui_shutdown_tx,
                )
                .await
                {
                    warn!("TUI error: {e}");
                }
            });
        }
    }

    // ── Background task: poll runtime stats → metrics + TUI + logs ──
    let stats_rt = runtime.clone();
    let stats_metrics = metrics.clone();
    let _stats_pool = pool_addr.clone();
    let stats_log_interval = args.log_interval.max(5);
    tokio::spawn(async move {
        const WATCHDOG_GRACE_SEC: u64 = 120;
        let mut last_stats: std::collections::HashMap<StreamId, StreamStats> = Default::default();
        let start = Instant::now();
        let mut last_share_total = 0u64;
        let mut last_share_time = Instant::now();
        loop {
            sleep(Duration::from_secs(stats_log_interval)).await;
            let stats = stats_rt.stats().await;
            let mut total_hr: f64 = 0.0;
            let mut _total_accepted: u64 = 0;
            let mut _total_rejected: u64 = 0;

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
                        stats_metrics.inc_submitted();
                    }
                    stats_metrics.set_coin(&coin);
                }
                if s.rejected > prev.rejected {
                    let delta = s.rejected - prev.rejected;
                    for _ in 0..delta {
                        stats_metrics.inc_rejected();
                    }
                }
                if s.active && s.hashrate > 0.0 {
                    total_hr += s.hashrate;
                }
                _total_accepted += s.accepted;
                _total_rejected += s.rejected;
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
            // Update total_hashes based on hashrate * interval (approximate)
            if total_hr > 0.0 {
                let hashes_this_interval = (total_hr * stats_log_interval as f64) as u64;
                stats_metrics.record_hashes(hashes_this_interval);
            }

            // ── Watchdog: if no share is accepted/rejected for too long,
            // the miner is stuck (GPU hang, pool idle, no jobs).
            // Exit with non-zero so the supervisor (systemd/SMOS) restarts us.
            // When hashrate is still positive, use the configured timeout.
            // When hashrate has dropped to 0, allow a longer timeout (3x)
            // to avoid false restarts during slow network or very easy
            // target changes, but still force recovery if no work is done.
            if watchdog_timeout > 0 && start.elapsed().as_secs() >= WATCHDOG_GRACE_SEC {
                let total_shares =
                    stats_metrics.shares_accepted() + stats_metrics.shares_rejected();
                let effective_timeout = if total_hr > 0.0 {
                    watchdog_timeout
                } else {
                    watchdog_timeout * 3
                };
                if total_shares > last_share_total {
                    last_share_total = total_shares;
                    last_share_time = Instant::now();
                } else if last_share_time.elapsed().as_secs() >= effective_timeout {
                    warn!(
                        "WATCHDOG: no share accepted/rejected for {}s (hashrate={:.1} H/s, watchdog={}s). Exiting to force restart.",
                        effective_timeout, total_hr, watchdog_timeout
                    );
                    #[cfg(feature = "tui")]
                    {
                        if tui_enabled {
                            zion_miner::tui::restore_terminal();
                        }
                    }
                    std::process::exit(1);
                }
            }

            // ── Ratatui TUI ──
            // The TUI runs in its own task and draws live stats.  In the
            // background stats loop we just keep collecting metrics.
            #[cfg(feature = "tui")]
            {
                if tui_enabled {
                    last_stats = stats;
                    continue;
                }
            }

            info!("{}", stats_metrics.tui_log());
            last_stats = stats;
        }
    });

    info!(
        stream1 = %s1,
        stream2 = %s2,
        stream3 = %s3,
        threads = args.threads,
        tui = %tui_enabled,
        "zion-miner (triple stream) starting"
    );

    // Ctrl-C handler — signals the shutdown channel so the runtime and TUI
    // both terminate cleanly.
    tokio::spawn(async move {
        if let Err(e) = tokio::signal::ctrl_c().await {
            warn!("ctrl-c handler error: {e}");
        }
        let _ = shutdown_tx.send(true);
    });

    // V3 Trinity mode: all 3 streams through a single V3 protocol connection.
    // The pool embeds external_stream jobs and forwards AuxPoW shares.
    // Default: ON when auxpow feature is enabled (set ZION_NO_V3_TRINITY=1 to disable).
    #[cfg(feature = "auxpow")]
    let v3_trinity = !env_bool("ZION_NO_V3_TRINITY", false);
    #[cfg(not(feature = "auxpow"))]
    let v3_trinity = args.v3_trinity || env_bool("ZION_V3_TRINITY", false);
    let result = if v3_trinity {
        #[cfg(feature = "auxpow")]
        {
            info!("V3 Trinity mode enabled — all streams through pool V3 protocol");
            runtime.run_v3_trinity(shutdown_rx).await
        }
        #[cfg(not(feature = "auxpow"))]
        {
            anyhow::bail!("V3 Trinity mode requires the 'auxpow' feature");
        }
    } else {
        runtime.run(shutdown_rx).await
    };

    // ── Exit TUI / restore terminal ──
    #[cfg(feature = "tui")]
    {
        if tui_enabled {
            zion_miner::tui::restore_terminal();
        }
    }
    result?;
    Ok(())
}
