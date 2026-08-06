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
}

/// Parse a bool env var (1/true/yes → true).
fn env_bool(key: &str, default: bool) -> bool {
    std::env::var(key)
        .map(|v| matches!(v.as_str(), "1" | "true" | "yes" | "TRUE" | "YES"))
        .unwrap_or(default)
}

/// Convert `zion_miner::stream::StreamStats` → `ui::StreamStats` for the
/// trinity stats display.
#[cfg(feature = "tui")]
fn to_ui_streams(stats: &std::collections::HashMap<StreamId, StreamStats>) -> Vec<zion_miner::ui::StreamStats> {
    let mut out = Vec::with_capacity(3);
    for id in [StreamId::Zion, StreamId::GpuExternal, StreamId::CpuExternal] {
        let s = stats.get(&id).cloned().unwrap_or_else(|| StreamStats::new(id));
        let (label, coin, algo) = match id {
            StreamId::Zion => (
                "ZION",
                "ZION".to_string(),
                s.algorithm.clone().unwrap_or_else(|| {
                    zion_core::node_runtime::consensus_profile().to_string()
                }),
            ),
            StreamId::GpuExternal => (
                "GPU PROFIT",
                s.coin.as_ref().map(|c| c.to_string()).unwrap_or_default(),
                s.algorithm.clone().unwrap_or_else(|| "n/a".to_string()),
            ),
            StreamId::CpuExternal => (
                "CPU PROFIT",
                s.coin.as_ref().map(|c| c.to_string()).unwrap_or_default(),
                s.algorithm.clone().unwrap_or_else(|| "n/a".to_string()),
            ),
        };
        out.push(zion_miner::ui::StreamStats {
            label,
            coin,
            algorithm: algo,
            hashrate_10s: s.hashrate,
            hashrate_60s: s.hashrate,
            hashrate_15m: s.hashrate,
            accepted: s.accepted,
            rejected: s.rejected,
            active: s.active,
        });
    }
    out
}

/// Query GPU details for the trinity stats display.
#[cfg(feature = "tui")]
fn gpu_info_tuples() -> Vec<(String, u32, u64, u32, Option<u32>, Option<u32>)> {
    #[cfg(any(feature = "gpu-opencl", feature = "gpu-cuda", feature = "gpu-metal"))]
    {
        let gpus = zion_miner::gpu::query_gpu_details();
        gpus.iter()
            .map(|g| {
                (
                    g.name.clone(),
                    g.compute_units,
                    g.global_mem_bytes,
                    g.max_clock_mhz,
                    g.temp_c,
                    g.power_w,
                )
            })
            .collect()
    }
    #[cfg(not(any(feature = "gpu-opencl", feature = "gpu-cuda", feature = "gpu-metal")))]
    {
        Vec::new()
    }
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
    config.stream1_enabled = !args.no_zion;
    config.stream2_enabled = !args.no_gpu;
    config.stream3_enabled = !args.no_cpu;
    // GPU backend for Stream 1 (ZION deeksha) — CLI overrides env
    if let Some(ref gpu) = args.gpu {
        config.gpu_backend = gpu.clone();
    }
    config.autonomous = args.autonomous;
    config.profit_interval_sec = args.profit_interval;
    config.zion_nonce_batch = args.threads as u64 * 100_000;

    // ── Startup banner (ZION ASCII art + hardware table) ──
    #[cfg(feature = "tui")]
    {
        if !env_bool("ZION_NO_FANCY", false) {
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
            println!("  streams     ZION={} GPU={} CPU={}",
                !args.no_zion, !args.no_gpu, !args.no_cpu);
            let gpu_backend_display = args.gpu.clone()
                .or_else(|| std::env::var("ZION_GPU_BACKEND").ok())
                .unwrap_or_else(|| "cpu".to_string());
            println!("  gpu_backend {} (Stream 1 ZION)", gpu_backend_display);
            if args.autonomous {
                println!("  autonomous  ON (profit switching every {}s)", args.profit_interval);
            }
            println!();
        }
    }

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

    // ── Background task: poll runtime stats → metrics + TUI + logs ──
    let stats_rt = runtime.clone();
    let stats_metrics = metrics.clone();
    let stats_pool = pool_addr.clone();
    let stats_threads = args.threads;
    let stats_log_interval = args.log_interval.max(5);
    tokio::spawn(async move {
        let mut last_stats: std::collections::HashMap<StreamId, StreamStats> = Default::default();
        let start = Instant::now();
        loop {
            sleep(Duration::from_secs(stats_log_interval)).await;
            let stats = stats_rt.stats().await;
            let mut total_hr: f64 = 0.0;
            let mut total_accepted: u64 = 0;
            let mut total_rejected: u64 = 0;

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
                total_accepted += s.accepted;
                total_rejected += s.rejected;
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

            // ── Claymore-style sticky header TUI ──
            #[cfg(feature = "tui")]
            {
                if tui_enabled {
                    let uptime = start.elapsed().as_secs();
                    let streams = to_ui_streams(&stats);
                    let gpus = gpu_info_tuples();
                    zion_miner::ui::print_trinity_stats_sticky(
                        uptime,
                        &streams,
                        total_accepted,
                        total_rejected,
                        &stats_pool,
                        0, // pool_height — unknown from miner side
                        0.0, // submit_avg_ms
                        0,   // submit_max_ms
                        &gpus,
                    );
                    // Suppress the plain tui_log line — the sticky header is the display.
                    last_stats = stats;
                    continue;
                }
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
        tui = %tui_enabled,
        "zion-miner (triple stream) starting"
    );

    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    tokio::spawn(async move {
        if let Err(e) = tokio::signal::ctrl_c().await {
            warn!("ctrl-c handler error: {e}");
        }
        let _ = shutdown_tx.send(true);
    });

    let result = runtime.run(shutdown_rx).await;

    // ── Exit sticky header (leave alternate screen buffer) ──
    #[cfg(feature = "tui")]
    {
        if tui_enabled {
            zion_miner::ui::exit_sticky_header();
        }
    }

    let _ = stats_threads; // suppress unused warning
    result?;
    Ok(())
}
