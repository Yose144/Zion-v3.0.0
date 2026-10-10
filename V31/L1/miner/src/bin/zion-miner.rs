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

    /// Enable the SRBMiner-compatible HTTP statistics API
    /// (`GET http://<addr>/` → JSON stats — same shape monitoring tools
    /// parse from `--api-enable` miners). Bind address via
    /// `ZION_API_HTTP_ADDR` (default 0.0.0.0:`--api-port`).
    #[arg(long)]
    api_enable: bool,

    /// Port for the SRBMiner-compatible API. Same default as SRBMiner.
    #[arg(long, default_value = "21550")]
    api_port: u16,

    /// Rig name reported by the API (`rig_name` field).
    /// Defaults to `--worker`.
    #[arg(long)]
    api_rig_name: Option<String>,

    /// List supported mining algorithms and exit (like
    /// `--list-algorithms` on other multi-algo miners).
    #[arg(long)]
    list_algorithms: bool,
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

    // `--list-algorithms`: print supported algorithms and exit before any
    // config validation (no wallet/pool needed for a help-style flag).
    if args.list_algorithms {
        let mut algos: std::collections::BTreeSet<&'static str> =
            ["ekam_deeksha"].into_iter().collect();
        for coin in zion_cosmic_harmony::ExternalCoin::all() {
            algos.insert(coin.algorithm());
        }
        println!("Supported algorithms:");
        for a in algos {
            println!("  {a}");
        }
        return Ok(());
    }

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
        config.stream4_enabled = false;
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

    let (s1, s2, s3, s4) = (
        config.stream1_enabled,
        config.stream2_enabled,
        config.stream3_enabled,
        config.stream4_enabled,
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

    // sgminer/TRM-compatible stats API for mining-OS dashboards.
    // SimpleMining polls 127.0.0.1:4028 (+4029 dual) when the custom-miner
    // package name matches a supported miner (e.g. teamredminer-*.zip).
    for (var, dual) in [("ZION_API_ADDR", false), ("ZION_API_ADDR_DUAL", true)] {
        if let Ok(val) = std::env::var(var) {
            match val.parse::<SocketAddr>() {
                Ok(addr) => {
                    let rt = runtime.clone();
                    tokio::spawn(async move {
                        if let Err(e) = sgminer_api_serve(rt, addr, dual).await {
                            warn!("sgminer api {addr}: {e}");
                        }
                    });
                }
                Err(e) => warn!("{var}={val}: invalid socket addr: {e}"),
            }
        }
    }

    // SRBMiner-compatible HTTP JSON API (GET / → stats JSON).
    // Enabled via --api-enable, or by setting ZION_API_HTTP_ADDR directly
    // (which also overrides the bind address).
    let api_http_addr = std::env::var("ZION_API_HTTP_ADDR")
        .ok()
        .and_then(|v| v.parse::<SocketAddr>().ok());
    if args.api_enable || api_http_addr.is_some() {
        let bind = api_http_addr
            .unwrap_or_else(|| SocketAddr::from(([0, 0, 0, 0], args.api_port)));
        let rig = args
            .api_rig_name
            .clone()
            .unwrap_or_else(|| args.worker.clone());
        let rt = runtime.clone();
        let wallet = args.wallet.clone();
        tokio::spawn(async move {
            if let Err(e) = srbminer_api_serve(rt, bind, rig, wallet).await {
                warn!("srbminer-compat api {bind}: {e}");
            }
        });
    }

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
                if let Err(e) =
                    zion_miner::tui::run_tui(tui_runtime, tui_shutdown_rx, tui_shutdown_tx).await
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

            // Optional machine-readable stats dump (SMOS/sidecar readers).
            if let Ok(path) = std::env::var("ZION_STATS_FILE") {
                if !path.is_empty() {
                    let mut streams: serde_json::Map<String, serde_json::Value> =
                        serde_json::Map::new();
                    for (id, s) in &stats {
                        let devices: Vec<serde_json::Value> = stats_rt
                            .gpu_devices(*id)
                            .await
                            .into_iter()
                            .map(|(name, hr)| {
                                serde_json::json!({
                                    "name": name,
                                    "hashrate_hps": hr,
                                })
                            })
                            .collect();
                        streams.insert(
                            id.as_str().to_string(),
                            serde_json::json!({
                                "coin": s.coin.as_ref().map(|c| c.ticker()),
                                "algorithm": s.algorithm.as_deref(),
                                "hashrate_hps": s.hashrate,
                                "accepted": s.accepted,
                                "rejected": s.rejected,
                                "active": s.active,
                                "devices": devices,
                            }),
                        );
                    }
                    let body = serde_json::json!({
                        "ts": std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_secs())
                            .unwrap_or(0),
                        "streams": streams,
                    });
                    let tmp = format!("{}.tmp", path);
                    if std::fs::write(&tmp, body.to_string()).is_ok() {
                        let _ = std::fs::rename(&tmp, &path);
                    }
                }
            }

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

            // ── Console metrics line (SMOS / headless) ──
            // One plain-text line per interval so non-TUI consoles (SMOS
            // dashboard, journald) show per-stream AND per-GPU rates.
            {
                let mut parts: Vec<String> = Vec::new();
                for (id, s) in &stats {
                    if !s.active {
                        continue;
                    }
                    let coin = s
                        .coin
                        .as_ref()
                        .map(|c| c.ticker())
                        .unwrap_or_else(|| id.as_str());
                    let hr = if s.hashrate >= 1e6 {
                        format!("{:.2} MH/s", s.hashrate / 1e6)
                    } else if s.hashrate >= 1e3 {
                        format!("{:.1} KH/s", s.hashrate / 1e3)
                    } else {
                        format!("{:.0} H/s", s.hashrate)
                    };
                    let devs = stats_rt.gpu_devices(*id).await;
                    let dev_str = if devs.is_empty() {
                        String::new()
                    } else {
                        format!(
                            " [{}]",
                            devs.iter()
                                .map(|(n, h)| {
                                    let short = n.split(':').next().unwrap_or(n.as_str());
                                    let hs = if *h >= 1e6 {
                                        format!("{:.2}M", h / 1e6)
                                    } else {
                                        format!("{:.0}K", h / 1e3)
                                    };
                                    format!("{short}={hs}")
                                })
                                .collect::<Vec<_>>()
                                .join(" ")
                        )
                    };
                    parts.push(format!(
                        "{coin}: {hr}{dev_str} A{} R{}",
                        s.accepted, s.rejected
                    ));
                }
                if !parts.is_empty() {
                    println!("[metrics] {}", parts.join(" | "));
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
        stream4 = %s4,
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

// ── sgminer/TRM-compatible stats API ─────────────────────────────────────────
// Mining-OS dashboards (SimpleMining) poll a cgminer/sgminer-style TCP JSON API
// on 127.0.0.1:4028 (+4029 for dual mining).  Enabled via ZION_API_ADDR and
// ZION_API_ADDR_DUAL env vars.  Every request is logged so the SMOS console
// shows when the dashboard agent is polling.

fn sg_dev(idx: usize, name: &str, algo: String, s: Option<&StreamStats>) -> serde_json::Value {
    let (mhs, acc, rej, active) = match s {
        Some(s) => (s.hashrate / 1e6, s.accepted, s.rejected, s.active),
        None => (0.0, 0, 0, false),
    };
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    serde_json::json!({
        "GPU": idx, "Enabled": if active { "Y" } else { "N" },
        "Status": if active { "Alive" } else { "Dead" },
        "Name": name, "ASC": idx, "Device": idx,
        "Temperature": 0.0, "Fan Speed": -1, "Fan Percent": -1,
        "GPU Clock": -1, "Memory Clock": -1,
        "MHS av": (mhs * 1e4).round() / 1e4,
        "MHS 5s": (mhs * 1e4).round() / 1e4,
        "MHS 1m": (mhs * 1e4).round() / 1e4,
        "MHS 5m": (mhs * 1e4).round() / 1e4,
        "MHS 15m": (mhs * 1e4).round() / 1e4,
        "Accepted": acc, "Rejected": rej, "Hardware Errors": 0,
        "Utility": 0.0, "Intensity": "", "Last Share Pool": 0,
        "Last Share Time": if acc > 0 { now } else { 0 },
        "Total MH": 0.0, "Diff1 Work": 0.0,
        "Difficulty Accepted": acc as f64, "Difficulty Rejected": rej as f64,
        "Last Valid Work": now,
        "Algo": algo,
    })
}

fn sg_summary(mhs: f64, acc: u64, rej: u64, algo: &str, elapsed: u64) -> serde_json::Value {
    serde_json::json!({
        "Elapsed": elapsed,
        "MHS av": (mhs * 1e4).round() / 1e4,
        "MHS 5s": (mhs * 1e4).round() / 1e4,
        "MHS 1m": (mhs * 1e4).round() / 1e4,
        "MHS 5m": (mhs * 1e4).round() / 1e4,
        "MHS 15m": (mhs * 1e4).round() / 1e4,
        "KHS av": (mhs * 1000.0 * 10.0).round() / 10.0,
        "Accepted": acc, "Rejected": rej,
        "Difficulty Accepted": acc as f64, "Difficulty Rejected": rej as f64,
        "Hardware Errors": 0, "Utility": 0.0, "Discarded": 0, "Stale": 0,
        "Total MH": 0.0, "Work Utility": 0.0,
        "Algo": algo,
    })
}

fn sg_status(msg: &str) -> serde_json::Value {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    serde_json::json!([{
        "STATUS": "S", "When": now, "Code": 0, "Msg": msg, "Description": "",
    }])
}

fn sg_pools(summary: &serde_json::Value) -> serde_json::Value {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    serde_json::json!([{
        "POOL": 0, "URL": "zion-pool:8444", "Status": "Alive",
        "Priority": 0, "Quota": 1, "Long Poll": "N", "Getworks": 0,
        "Accepted": summary["Accepted"], "Rejected": summary["Rejected"],
        "Works": 0, "Discarded": 0, "Stale": 0, "Get Failures": 0,
        "Remote Failures": 0, "User": "vega-smos",
        "Last Share Time": now, "Diff1 Shares": 0.0,
        "Proxy Type": "", "Proxy": "",
        "Difficulty Accepted": summary["Difficulty Accepted"],
        "Difficulty Rejected": summary["Difficulty Rejected"],
        "Difficulty Stale": 0.0, "Last Share Difficulty": 0.0,
        "Work Difficulty": 0.0, "Has Stratum": true,
        "Stratum Active": true, "Stratum URL": "zion-pool:8444",
        "Stratum Difficulty": 0.0, "Has Vmask": false, "Has GBT": false,
        "Best Share": 0.0, "Pool Rejected%": 0.0, "Pool Stale%": 0.0,
        "Bad Work": 0, "Current Block Height": 0,
        "Current Block Version": 0,
    }])
}

fn sgminer_response(
    cmd: &str,
    stats: &std::collections::HashMap<StreamId, StreamStats>,
    _dual_port: bool,
    elapsed: u64,
) -> serde_json::Value {
    let zion = stats.get(&StreamId::Zion);
    let gpu = stats.get(&StreamId::GpuExternal);
    let cpu = stats.get(&StreamId::CpuExternal);
    let ticker = |s: Option<&StreamStats>| -> String {
        s.and_then(|s| s.coin.as_ref().map(|c| c.ticker().to_string()))
            .unwrap_or_default()
    };
    let algo_of = |s: Option<&StreamStats>, fallback: &str| -> String {
        s.and_then(|s| s.algorithm.clone())
            .unwrap_or_else(|| fallback.to_string())
    };

    // Primary payload = QTU/QPoW external GPU stream (Vega). Dual = ZION.
    let primary_devs = vec![
        sg_dev(0, "RX Vega 64", algo_of(gpu, "qpow-poseidon2"), gpu),
        sg_dev(1, "RX 5600 XT", algo_of(zion, "ekam_deeksha"), zion),
        sg_dev(2, "CPU", algo_of(cpu, "verushash"), cpu),
    ];
    let primary_summary = sg_summary(
        gpu.map(|s| s.hashrate / 1e6).unwrap_or(0.0),
        gpu.map(|s| s.accepted).unwrap_or(0),
        gpu.map(|s| s.rejected).unwrap_or(0),
        &format!("{} ({})", algo_of(gpu, "qpow-poseidon2"), ticker(gpu)),
        elapsed,
    );
    let dual_devs = vec![sg_dev(0, "RX 5600 XT", algo_of(zion, "ekam_deeksha"), zion)];
    let dual_summary = sg_summary(
        zion.map(|s| s.hashrate / 1e6).unwrap_or(0.0),
        zion.map(|s| s.accepted).unwrap_or(0),
        zion.map(|s| s.rejected).unwrap_or(0),
        &algo_of(zion, "ekam_deeksha"),
        elapsed,
    );

    // SMOS sends multi-commands like "devs+summary+devs2+summary2".
    // cgminer join format: nested section per lowercase command name, each
    // with its own STATUS + data.  A trailing "2" selects the dual payload.
    // We emit nested sections AND flat keys for maximum parser compatibility.
    let parts: Vec<String> = cmd
        .split('+')
        .map(|p| p.trim().to_lowercase())
        .filter(|p| !p.is_empty())
        .collect();
    let nested = parts.len() > 1;
    let mut resp = serde_json::json!({"id": 1});
    let obj = resp.as_object_mut().unwrap();
    let mut saw_any = false;
    for part in &parts {
        let mut c = part.clone();
        let dual = c.ends_with('2');
        if dual {
            c.pop();
        }
        let devs = if dual { &dual_devs } else { &primary_devs };
        let summary = if dual {
            &dual_summary
        } else {
            &primary_summary
        };
        let flat = |base: &str| format!("{}{}", base, if dual { "2" } else { "" });
        if c.starts_with("dev") {
            let mut sub = serde_json::json!({
                "STATUS": sg_status("devs"), "DEVS": devs, "id": 1});
            if dual {
                sub.as_object_mut()
                    .unwrap()
                    .insert("DEVS2".into(), serde_json::json!(devs));
            }
            if nested {
                obj.insert(part.clone(), sub);
            } else {
                obj.insert("STATUS".into(), sg_status("devs"));
            }
            obj.insert(flat("DEVS"), serde_json::json!(devs));
            saw_any = true;
        } else if c.starts_with("sum") {
            let mut sub = serde_json::json!({
                "STATUS": sg_status("summary"), "SUMMARY": [summary], "id": 1});
            if dual {
                sub.as_object_mut()
                    .unwrap()
                    .insert("SUMMARY2".into(), serde_json::json!([summary]));
            }
            if nested {
                obj.insert(part.clone(), sub);
            } else {
                obj.insert("STATUS".into(), sg_status("summary"));
            }
            obj.insert(flat("SUMMARY"), serde_json::json!([summary]));
            saw_any = true;
        } else if c.starts_with("pool") {
            let pools = sg_pools(summary);
            if nested {
                obj.insert(
                    part.clone(),
                    serde_json::json!({
                        "STATUS": sg_status("pools"), "POOLS": pools, "id": 1}),
                );
            } else {
                obj.insert("STATUS".into(), sg_status("pools"));
            }
            obj.insert("POOLS".into(), pools);
            saw_any = true;
        } else if c.starts_with("ver") {
            let ver = serde_json::json!([{
                "Miner": "teamredminer", "CGMiner": "0.10.5", "API": "3.7",
            }]);
            if nested {
                obj.insert(
                    part.clone(),
                    serde_json::json!({
                        "STATUS": sg_status("version"), "VERSION": ver, "id": 1}),
                );
            } else {
                obj.insert("STATUS".into(), sg_status("version"));
            }
            obj.insert("VERSION".into(), ver);
            saw_any = true;
        } else if c.starts_with("coin") {
            let coin = serde_json::json!([{
                "Method": "qpow", "Current Block Time": 0.0,
                "Current Block Hash": "", "LP": false,
                "Network Difficulty": 0.0,
            }]);
            if nested {
                obj.insert(
                    part.clone(),
                    serde_json::json!({
                        "STATUS": sg_status("coin"), "COIN": coin, "id": 1}),
                );
            } else {
                obj.insert("STATUS".into(), sg_status("coin"));
            }
            obj.insert("COIN".into(), coin);
            saw_any = true;
        }
    }
    if !saw_any {
        obj.insert("STATUS".into(), sg_status("summary"));
        obj.insert("SUMMARY".into(), serde_json::json!([primary_summary]));
    }
    resp
}

async fn sgminer_api_serve(rt: MinerRuntime, addr: SocketAddr, dual: bool) -> Result<()> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let listener = tokio::net::TcpListener::bind(addr).await?;
    info!("sgminer api listening on {addr} (dual={dual})");
    let start = Instant::now();
    loop {
        let (mut sock, peer) = listener.accept().await?;
        let rt = rt.clone();
        tokio::spawn(async move {
            let mut buf = [0u8; 8192];
            let n = match sock.read(&mut buf).await {
                Ok(n) => n,
                Err(_) => return,
            };
            let raw = String::from_utf8_lossy(&buf[..n]);
            let head = raw.split('\0').next().unwrap_or("").trim();
            let cmd = serde_json::from_str::<serde_json::Value>(head)
                .ok()
                .and_then(|v| {
                    v.get("command")
                        .and_then(|c| c.as_str())
                        .map(str::to_string)
                })
                .filter(|c| !c.is_empty())
                .unwrap_or_else(|| {
                    if head.is_empty() {
                        "summary".into()
                    } else {
                        head.to_string()
                    }
                });
            let stats = rt.stats().await;
            let resp = sgminer_response(&cmd, &stats, dual, start.elapsed().as_secs());
            info!("sgminer api {peer} cmd={cmd} dual={dual}");
            let mut out = serde_json::to_vec(&resp).unwrap_or_default();
            out.push(0);
            let _ = sock.write_all(&out).await;
        });
    }
}

/// SRBMiner-compatible HTTP statistics API. `GET /` returns a JSON body in
/// the same shape SRBMiner-MULTI emits on `--api-enable` (rig_name,
/// miner_version, mining_time, worker/device counts, gpu_devices,
/// algorithms[] with pool/shares/hashrate), so mining-OS dashboards and
/// SRB-aware tooling can parse zion-miner stats unchanged.
async fn srbminer_api_serve(
    rt: MinerRuntime,
    addr: SocketAddr,
    rig_name: String,
    wallet: String,
) -> Result<()> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let listener = tokio::net::TcpListener::bind(addr).await?;
    info!("srbminer-compat api listening on http://{addr} (GET /)");
    let start = Instant::now();
    loop {
        let (mut sock, peer) = listener.accept().await?;
        let rt = rt.clone();
        let rig = rig_name.clone();
        let wallet = wallet.clone();
        tokio::spawn(async move {
            let mut buf = [0u8; 8192];
            let n = match sock.read(&mut buf).await {
                Ok(0) | Err(_) => return,
                Ok(n) => n,
            };
            let req = String::from_utf8_lossy(&buf[..n]);
            let first_line = req.lines().next().unwrap_or_default();
            let is_get_root = first_line.starts_with("GET / ")
                || first_line.starts_with("GET /stats")
                || first_line.starts_with("get / ");
            let (status, body, ctype) = if is_get_root {
                let stats = rt.stats().await;
                let json = srbminer_json(&rt, &stats, &rig, &wallet, start.elapsed().as_secs()).await;
                (
                    "200 OK",
                    serde_json::to_string_pretty(&json).unwrap_or_default(),
                    "application/json",
                )
            } else {
                ("404 Not Found", "not found\n".to_string(), "text/plain")
            };
            let resp = format!(
                "HTTP/1.1 {status}\r\nContent-Type: {ctype}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            let _ = sock.write_all(resp.as_bytes()).await;
            if is_get_root {
                info!("srbminer-compat api {peer} GET /");
            }
        });
    }
}

/// Build the SRBMiner-shaped stats JSON from live runtime stream stats.
async fn srbminer_json(
    rt: &MinerRuntime,
    stats: &std::collections::HashMap<StreamId, StreamStats>,
    rig_name: &str,
    wallet: &str,
    uptime: u64,
) -> serde_json::Value {
    let cfg = rt.config();
    let streams: [(StreamId, &str, Option<String>, bool); 4] = [
        (
            StreamId::Zion,
            "ekam_deeksha",
            cfg.pool_url.clone().or_else(|| cfg.node_rpc_url.clone()),
            cfg.stream1_enabled,
        ),
        (
            StreamId::GpuExternal,
            "qpow-poseidon2",
            cfg.stream2_url.clone().or_else(|| cfg.auxpow_pool.clone()),
            cfg.stream2_enabled,
        ),
        (
            StreamId::CpuExternal,
            "verushash",
            cfg.stream3_url.clone().or_else(|| cfg.auxpow_pool.clone()),
            cfg.stream3_enabled,
        ),
        (
            StreamId::GpuExternal2,
            "qpow-poseidon2",
            cfg.stream4_url.clone().or_else(|| cfg.auxpow_pool.clone()),
            cfg.stream4_enabled,
        ),
    ];

    let mut algorithms = Vec::new();
    let mut gpu_devices: Vec<serde_json::Value> = Vec::new();
    let mut gpu_workers = 0u64;
    let mut cpu_workers = 0u64;
    let zion_on_gpu = !matches!(cfg.gpu_backend.as_str(), "cpu" | "");

    for (stream, default_algo, pool, enabled) in &streams {
        if !enabled {
            continue;
        }
        let s = stats.get(stream);
        let algo = s
            .and_then(|s| s.algorithm.clone())
            .unwrap_or_else(|| default_algo.to_string());
        let coin = s
            .and_then(|s| s.coin.as_ref().map(|c| c.ticker().to_string()))
            .unwrap_or_default();
        let hashrate = s.map(|s| s.hashrate).unwrap_or(0.0);
        let accepted = s.map(|s| s.accepted).unwrap_or(0);
        let rejected = s.map(|s| s.rejected).unwrap_or(0);
        let is_gpu = stream.is_gpu_external()
            || matches!(stream, StreamId::Zion if zion_on_gpu);
        if is_gpu {
            gpu_workers += 1;
        } else {
            cpu_workers += 1;
        }

        // Per-device hashrates when the backend reports them; otherwise the
        // whole stream rides a single logical gpu0 / cpu total.
        let mut gpu_hr = serde_json::Map::new();
        if is_gpu {
            let devs = rt.gpu_devices(*stream).await;
            if devs.is_empty() {
                gpu_hr.insert("gpu0".into(), serde_json::json!(hashrate));
            } else {
                for (idx, (name, hps)) in devs.iter().enumerate() {
                    let dev = format!("gpu{idx}");
                    gpu_hr.insert(dev.clone(), serde_json::json!(hps));
                    if gpu_devices.iter().all(|d| d["model"] != name.as_str()) {
                        gpu_devices.push(serde_json::json!({
                            "id": gpu_devices.len(),
                            "device": dev,
                            "vendor": srb_vendor(name),
                            "model": name,
                        }));
                    }
                }
            }
            gpu_hr.insert("total".into(), serde_json::json!(hashrate));
        }

        algorithms.push(serde_json::json!({
            "id": stream.index(),
            "name": algo,
            "coin": coin,
            "pool": {
                "pool": pool.clone().unwrap_or_default(),
                "wallet": wallet,
                "uptime": uptime,
            },
            "shares": {
                "total": accepted + rejected,
                "accepted": accepted,
                "rejected": rejected,
                "avg_find_time": if accepted > 0 { uptime / accepted } else { 0 },
            },
            "hashrate": {
                "1min": hashrate,
                "1hr": hashrate,
                "6hr": hashrate,
                "12hr": hashrate,
                "gpu": gpu_hr,
                "cpu": { "total": if is_gpu { 0.0 } else { hashrate } },
            },
        }));
    }

    serde_json::json!({
        "rig_name": rig_name,
        "miner_version": env!("CARGO_PKG_VERSION"),
        "miner": "zion-miner",
        "mining_time": uptime,
        "total_cpu_workers": cpu_workers,
        "total_gpu_workers": gpu_workers,
        "total_workers": cpu_workers + gpu_workers,
        "gpu_devices": gpu_devices,
        "algorithms": algorithms,
    })
}

fn srb_vendor(name: &str) -> &'static str {
    let n = name.to_lowercase();
    if n.contains("apple") {
        "apple"
    } else if n.contains("radeon") || n.contains("amd") || n.contains("gfx") {
        "amd"
    } else if n.contains("nvidia") || n.contains("geforce") || n.contains("rtx")
        || n.contains("gtx")
    {
        "nvidia"
    } else if n.contains("intel") || n.contains("arc") {
        "intel"
    } else {
        "unknown"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    fn test_runtime() -> MinerRuntime {
        let addr = Address::new(ChainId::ZionL1, vec![0u8; 20], "zion1test").unwrap();
        let mut cfg = MinerConfig::new(addr);
        cfg.gpu_backend = "cpu".into();
        cfg.stream1_enabled = true;
        cfg.stream2_enabled = true;
        cfg.stream3_enabled = true;
        cfg.stream4_enabled = false;
        cfg.pool_url = Some("zion.pool:4444".into());
        cfg.stream2_url = Some("qpow.pool:5555".into());
        MinerRuntime::new(cfg)
    }

    #[test]
    fn srb_vendor_maps_gpu_names() {
        assert_eq!(srb_vendor("Apple M1"), "apple");
        assert_eq!(srb_vendor("AMD Radeon RX 5600 XT"), "amd");
        assert_eq!(srb_vendor("gfx1010"), "amd");
        assert_eq!(srb_vendor("NVIDIA GeForce GTX 1070 Ti"), "nvidia");
        assert_eq!(srb_vendor("Intel Arc A770"), "intel");
        assert_eq!(srb_vendor("something else"), "unknown");
    }

    #[tokio::test]
    async fn srbminer_json_matches_srbminer_schema() {
        let rt = test_runtime();
        let mut stats = HashMap::new();
        let mut s1 = StreamStats::new(StreamId::Zion);
        s1.hashrate = 200_000.0;
        s1.accepted = 4;
        stats.insert(StreamId::Zion, s1);
        let mut s2 = StreamStats::new(StreamId::GpuExternal);
        s2.hashrate = 6_900_000.0;
        s2.accepted = 10;
        s2.rejected = 2;
        s2.algorithm = Some("qpow-poseidon2".into());
        stats.insert(StreamId::GpuExternal, s2);
        let mut s3 = StreamStats::new(StreamId::CpuExternal);
        s3.hashrate = 1_000_000.0;
        s3.accepted = 1;
        stats.insert(StreamId::CpuExternal, s3);

        let j = srbminer_json(&rt, &stats, "testrig", "zion1wallet", 3600).await;

        assert_eq!(j["miner"], "zion-miner");
        assert_eq!(j["rig_name"], "testrig");
        assert!(j["miner_version"].is_string());
        assert_eq!(j["mining_time"], 3600);
        assert!(j["gpu_devices"].is_array());
        assert_eq!(
            j["total_workers"].as_u64().unwrap(),
            j["total_cpu_workers"].as_u64().unwrap()
                + j["total_gpu_workers"].as_u64().unwrap()
        );
        // stream1+3 = CPU workers (gpu_backend=cpu), stream2 = GPU worker
        assert_eq!(j["total_gpu_workers"], 1);
        assert_eq!(j["total_cpu_workers"], 2);

        let algos = j["algorithms"].as_array().unwrap();
        assert_eq!(algos.len(), 3); // stream4 disabled → not listed
        for a in algos {
            for k in ["id", "name", "coin", "pool", "shares", "hashrate"] {
                assert!(a.get(k).is_some(), "algo missing field {k}: {a}");
            }
            for k in ["pool", "wallet", "uptime"] {
                assert!(a["pool"].get(k).is_some(), "pool missing {k}");
            }
            for k in ["total", "accepted", "rejected", "avg_find_time"] {
                assert!(a["shares"].get(k).is_some(), "shares missing {k}");
            }
            for k in ["1min", "1hr", "6hr", "12hr", "gpu", "cpu"] {
                assert!(a["hashrate"].get(k).is_some(), "hashrate missing {k}");
            }
        }

        let qpow = algos
            .iter()
            .find(|a| a["name"] == "qpow-poseidon2")
            .expect("qpow algo entry");
        assert_eq!(qpow["shares"]["accepted"], 10);
        assert_eq!(qpow["shares"]["rejected"], 2);
        assert_eq!(qpow["shares"]["total"], 12);
        assert_eq!(qpow["shares"]["avg_find_time"], 360); // 3600s / 10
        assert_eq!(qpow["hashrate"]["gpu"]["total"], 6_900_000.0);
        // No real GPU devices in the test runtime → gpu0 fallback total.
        assert_eq!(qpow["hashrate"]["gpu"]["gpu0"], 6_900_000.0);
        assert_eq!(qpow["pool"]["pool"], "qpow.pool:5555");
        assert_eq!(qpow["pool"]["wallet"], "zion1wallet");

        let vrsc = algos
            .iter()
            .find(|a| a["name"] == "verushash")
            .expect("cpu algo entry");
        assert_eq!(vrsc["hashrate"]["cpu"]["total"], 1_000_000.0);
        assert!(vrsc["hashrate"]["gpu"].get("total").is_none());
    }

    #[tokio::test]
    async fn srbminer_api_http_roundtrip() {
        let rt = test_runtime();
        // Grab an ephemeral port, release it, then let the API bind it.
        let probe = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = probe.local_addr().unwrap().port();
        drop(probe);
        let addr: SocketAddr = format!("127.0.0.1:{port}").parse().unwrap();
        let server = tokio::spawn(srbminer_api_serve(
            rt,
            addr,
            "apitest".into(),
            "zion1w".into(),
        ));
        for _ in 0..100 {
            if tokio::net::TcpStream::connect(addr).await.is_ok() {
                break;
            }
            sleep(Duration::from_millis(20)).await;
        }

        async fn request(addr: SocketAddr, path: &str) -> String {
            let mut s = tokio::net::TcpStream::connect(addr).await.unwrap();
            s.write_all(format!("GET {path} HTTP/1.1\r\nHost: x\r\n\r\n").as_bytes())
                .await
                .unwrap();
            let mut buf = Vec::new();
            s.read_to_end(&mut buf).await.unwrap();
            String::from_utf8_lossy(&buf).to_string()
        }

        let resp = request(addr, "/").await;
        assert!(resp.starts_with("HTTP/1.1 200 OK"), "{resp}");
        let body = resp.split("\r\n\r\n").nth(1).expect("json body");
        let j: serde_json::Value = serde_json::from_str(body).expect("valid json");
        assert_eq!(j["rig_name"], "apitest");
        assert_eq!(j["miner"], "zion-miner");
        assert!(j["algorithms"].is_array());

        // /stats alias must return the same shape
        let resp = request(addr, "/stats").await;
        assert!(resp.starts_with("HTTP/1.1 200 OK"), "{resp}");

        // Unknown path → 404
        let resp = request(addr, "/nope").await;
        assert!(resp.starts_with("HTTP/1.1 404"), "{resp}");

        server.abort();
    }
}
