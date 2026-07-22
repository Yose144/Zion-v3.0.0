// Allow dead code for modules that contain future/planned features
#![allow(dead_code)]
// Suppress style lints for protocol/crypto code
#![allow(
    clippy::upper_case_acronyms,     // ETC/RVN/KAS/etc are standard coin tickers
    clippy::too_many_arguments,      // protocol handlers need many params
    clippy::should_implement_trait,  // Algorithm::from_str is not std::str::FromStr
)]

mod config;
mod consciousness;
mod miner;
mod ncl;
mod stratum;
mod telemetry;

use clap::Parser;
use colored::*;
use log::{error, info, warn};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::signal;

use miner::gpu::{auto_tune, print_benchmark_results, run_benchmark, AutoTuneConfig};
use miner::python_fallback::{PythonFallbackConfig, PythonFallbackMiner, PythonMinerVariant};
use miner::dual_stream::{DualMode, DualStreamConfig, DualStreamMiner};
use miner::Algorithm;
use miner::MinerConfig;
use ncl::{NCLClient, NCLConfig, NpuType};

#[derive(Parser, Debug)]
#[command(
    name = "zion-universal-miner",
    version = "2.9.6",
    author = "ZION Core Team",
    about = "🌟 ZION Universal Native Miner - Multi-algorithm CPU+GPU mining",
    long_about = None
)]
struct Cli {
    /// Pool URL (stratum+tcp://host:port)
    #[arg(short, long)]
    pool: String,

    /// ZION wallet address
    #[arg(short, long)]
    wallet: String,

    /// Mining algorithm (cosmic_harmony, randomx, yescrypt, verushash, blake3)
    #[arg(short, long, default_value = "cosmic_harmony")]
    algorithm: String,

    /// Difficulty hint (e.g. 1, 8, 64). Sent as `d=` to the pool when supported.
    #[arg(long)]
    difficulty: Option<u64>,

    /// Number of CPU threads (0 = auto-detect)
    #[arg(short, long, default_value_t = 0)]
    threads: usize,

    /// Worker name (default: hostname)
    #[arg(long)]
    worker: Option<String>,

    /// Stream group hint for the pool scheduler (zion|revenue|ncl).
    /// Sent as `g=` in the pool password (XMRig login / Stratum authorize).
    #[arg(long)]
    group: Option<String>,

    /// Mining mode (cpu|gpu|dual). This is a compatibility flag used by the Desktop Agent.
    /// If set to gpu/dual, GPU mining will be enabled.
    #[arg(long)]
    mode: Option<String>,

    /// Enable GPU mining
    #[arg(long)]
    gpu: bool,

    /// GPU device IDs (comma-separated, e.g., "0,1")
    #[arg(long)]
    gpu_devices: Option<String>,

    /// Config file path
    #[arg(short, long)]
    config: Option<String>,

    /// Enable NCL (Neural Compute Layer) for AI bonus
    #[arg(long, default_value_t = true)]
    ncl: bool,

    /// NCL time allocation (0.0-0.5, default 0.3 = 30% AI time)
    #[arg(long, default_value_t = 0.3)]
    ncl_allocation: f32,

    /// Disable colored output
    #[arg(long)]
    no_color: bool,

    /// Quiet mode (minimal output)
    #[arg(short, long)]
    quiet: bool,

    /// Debug logging
    #[arg(long)]
    debug: bool,

    /// Run GPU benchmark only (no mining)
    #[arg(long)]
    benchmark: bool,

    /// Auto-tune GPU batch size
    #[arg(long)]
    auto_tune: bool,

    /// External pool mining: coin (etc, rvn, erg, kas)
    #[arg(long)]
    external_coin: Option<String>,

    /// External pool URL (default: 2miners)
    #[arg(long)]
    external_pool: Option<String>,

    /// External pool wallet (BTC for payout)
    #[arg(long)]
    external_wallet: Option<String>,

    /// Hashpower percentage for external mining (0-100)
    #[arg(long, default_value_t = 25)]
    external_percent: u8,

    /// Write miner stats JSON to this file (Desktop Agent reads this)
    #[arg(long)]
    stats_file: Option<String>,

    /// Stats file update interval in seconds
    #[arg(long, default_value_t = 5)]
    stats_interval: u64,

    /// Enable Python fallback miner (spawns Python process).
    /// Values: "deeksha"/"ekam" (canonical Ekam fallback), "legacy" (v2.9 native miner), or "auto".
    /// Use when Rust GPU/Metal isn't available or for algorithm fallback.
    #[arg(long)]
    python_fallback: Option<String>,

    /// Path to Python miner script (auto-detected if not set)
    #[arg(long)]
    python_script: Option<String>,

    /// Extra arguments to pass to the Python miner (comma-separated)
    #[arg(long)]
    python_args: Option<String>,

    /// Enable parallel XMR (RandomX) mining alongside ZION.
    /// Pool URL for XMR mining (e.g. gulf.moneroocean.stream:10001)
    #[arg(long)]
    xmr_pool: Option<String>,

    /// XMR wallet address (Monero address for MoneroOcean payout)
    #[arg(long)]
    xmr_wallet: Option<String>,

    /// Number of CPU threads dedicated to XMR mining (default: 1)
    #[arg(long, default_value_t = 1)]
    xmr_threads: usize,

    // ─── Dual-stream mining (LolMiner --dualmode style) ───────────────────
    /// Dual mining mode — mines a secondary coin concurrently on GPU idle cycles.
    ///
    /// LolMiner-compatible mode names (case-insensitive):
    ///   ALEPHDUAL  — ALPH (Blake3, alph.2miners.com:1199)
    ///   KASPADUAL  — KAS  (kHeavyHash, kas.2miners.com:1111)
    ///   ETCHDUAL   — ETC  (Etchash, etc.2miners.com:1010)
    ///   ERGDUAL    — ERG  (Autolykos2, erg.2miners.com:8888)
    ///   RVNDUAL    — RVN  (KawPow, rvn.2miners.com:6060)
    ///   FLUXDUAL   — FLUX (ZelHash, flux.2miners.com:9090)
    ///
    /// Example (ZION + ALPH dual):
    ///   zion-miner --pool stratum+tcp://91.98.122.165:3333 --wallet zion1...
    ///              --dualmode ALEPHDUAL --dualuser 1mmHfNEEWgDL...
    #[arg(long)]
    dualmode: Option<String>,

    /// Dual mining pool URL (host:port).
    /// Auto-detected from --dualmode if not specified.
    #[arg(long)]
    dualpool: Option<String>,

    /// Wallet / user address for the secondary dual pool.
    /// Required when --dualmode is set.
    #[arg(long)]
    dualuser: Option<String>,

    /// GPU allocation for the dual stream (0.05–0.90, default 0.30 = 30%).
    /// The remaining GPU % stays on primary ZION Ekam Deeksha mining.
    #[arg(long, default_value_t = 0.30)]
    dual_alloc: f32,

    // ─── Triple-stream mining (ZION + secondary + tertiary coin) ──────────
    /// Triple mining mode — adds a third coin stream alongside dual mining.
    ///
    /// Requires --dualmode to also be set (triple needs a dual partner first).
    /// GPU allocation is shared: primary + dual + triple = 100%.
    ///
    /// Same mode names as --dualmode (ALEPHDUAL, KASPADUAL, ETCHDUAL, etc.).
    ///
    /// Example (ZION + ETC dual + ALPH triple):
    ///   zion-miner --pool ... --wallet zion1...
    ///              --dualmode ETCHDUAL --dualuser 0xETC...
    ///              --triplemode ALEPHDUAL --tripleuser 1AlphWallet...
    #[arg(long)]
    triplemode: Option<String>,

    /// Triple mining pool URL (host:port). Auto-detected from --triplemode.
    #[arg(long)]
    triplepool: Option<String>,

    /// Wallet/user for the tertiary (triple) pool.
    #[arg(long)]
    tripleuser: Option<String>,

    /// GPU allocation for the triple stream (0.05–0.60, default 0.20 = 20%).
    #[arg(long, default_value_t = 0.20)]
    triple_alloc: f32,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    // Setup logging
    if cli.debug {
        env_logger::Builder::from_default_env()
            .filter_level(log::LevelFilter::Debug)
            .init();
    } else if cli.quiet {
        env_logger::Builder::from_default_env()
            .filter_level(log::LevelFilter::Warn)
            .init();
    } else {
        env_logger::Builder::from_default_env()
            .filter_level(log::LevelFilter::Info)
            .init();
    }

    // Disable colors if requested
    if cli.no_color {
        colored::control::set_override(false);
    }

    print_banner();

    // Parse algorithm
    let algorithm = Algorithm::from_str(&cli.algorithm)
        .ok_or_else(|| anyhow::anyhow!("Invalid algorithm: {}", cli.algorithm))?;

    println!(
        "{} {}",
        " * ".bright_green().bold(),
        "ABOUT".bright_white().bold()
    );
    println!(
        "{}  {} {}",
        "   ".bright_black(),
        "ZION".bright_cyan().bold(),
        "v2.9.6 TerraNova".white()
    );
    println!(
        "{}  libs {}",
        "   ".bright_black(),
        "tokio/1.35  colored/2.1  clap/4.4".bright_black()
    );
    println!();
    println!(
        "{} {}",
        " * ".bright_green().bold(),
        "COMMANDS".bright_white().bold()
    );
    println!(
        "{}  {} - {} {}",
        "   ".bright_black(),
        "h".bright_magenta(),
        "hashrate".white(),
        "· show current speed".bright_black()
    );
    println!(
        "{}  {} - {} {}",
        "   ".bright_black(),
        "p".bright_magenta(),
        "pause".white(),
        "· pause mining".bright_black()
    );
    println!(
        "{}  {} - {} {}",
        "   ".bright_black(),
        "r".bright_magenta(),
        "resume".white(),
        "· resume mining".bright_black()
    );
    println!(
        "{}  {} - {} {}",
        "   ".bright_black(),
        "s".bright_magenta(),
        "status".white(),
        "· full status panel".bright_black()
    );
    println!();
    println!(
        "{} {}",
        " * ".bright_green().bold(),
        "CONFIG".bright_white().bold()
    );
    println!(
        "{}  {:<12} {}",
        "   ".bright_black(),
        "algorithm".bright_black(),
        algorithm.name().bright_cyan()
    );
    println!(
        "{}  {:<12} {}",
        "   ".bright_black(),
        "pool".bright_black(),
        cli.pool.bright_white()
    );
    println!(
        "{}  {:<12} {}...{}",
        "   ".bright_black(),
        "wallet".bright_black(),
        &cli.wallet[..cli.wallet.len().min(8)].bright_white(),
        &cli.wallet[cli.wallet.len().saturating_sub(6)..].bright_white()
    );

    // Determine thread count
    let threads = if cli.threads == 0 {
        num_cpus::get()
    } else {
        cli.threads
    };
    println!(
        "{}  {:<12} {}",
        "   ".bright_black(),
        "threads".bright_black(),
        threads.to_string().bright_magenta().bold()
    );

    // Detect GPUs if enabled
    if cli.gpu {
        match miner::detect_gpus() {
            Ok(gpus) => {
                if gpus.is_empty() {
                    println!(
                        "{}  {:<12} {}",
                        "   ".bright_black(),
                        "gpu".bright_black(),
                        "none detected".bright_red()
                    );
                } else {
                    for gpu in &gpus {
                        println!(
                            "{}  {:<12} {} {} {} CUs {} MB",
                            "   ".bright_black(),
                            "gpu".bright_black(),
                            gpu.name.bright_green().bold(),
                            format!("[{:?}]", gpu.platform).bright_black(),
                            gpu.compute_units.to_string().bright_cyan(),
                            gpu.memory_mb.to_string().bright_cyan(),
                        );
                    }
                }
            }
            Err(_e) => {
                println!(
                    "{}  {:<12} {}",
                    "   ".bright_black(),
                    "gpu".bright_black(),
                    "detection failed".bright_red()
                );
            }
        }
    }

    // GPU info (support compatibility --mode)
    let mode_lower = cli.mode.as_deref().unwrap_or("").to_lowercase();
    let mut gpu_enabled = cli.gpu || mode_lower == "gpu" || mode_lower == "dual";

    // CHv4 runtime:
    // cosmic_harmony now maps to CHv4 path (NPU mixing + memory-hard aware flow),
    // so GPU must remain enabled when requested. Keep a legacy emergency kill-switch
    // for incident response only.
    if gpu_enabled
        && algorithm.is_zion_runtime()
        && std::env::var("ZION_LEGACY_CH_GPU_GUARD")
            .map(|v| {
                let s = v.trim().to_ascii_lowercase();
                s == "1" || s == "true" || s == "yes" || s == "on"
            })
            .unwrap_or(false)
    {
        println!(
            "{}  {:<12} {}",
            "   ".bright_black(),
            "gpu-guard".bright_black(),
            "legacy guard enabled via ZION_LEGACY_CH_GPU_GUARD → GPU CH disabled".bright_yellow()
        );
        gpu_enabled = false;
    }

    // Auto-detect GPU availability for CH3 Revenue stream routing
    let has_gpu = miner::detect_gpu_available();

    if gpu_enabled {
        println!(
            "{}  {:<12} {}",
            "   ".bright_black(),
            "gpu-mode".bright_black(),
            "ENABLED".bright_green().bold()
        );
    } else if has_gpu {
        println!(
            "{}  {:<12} {}",
            "   ".bright_black(),
            "gpu-mode".bright_black(),
            "available (--gpu to enable)".bright_yellow()
        );
    } else {
        println!(
            "{}  {:<12} {} {}",
            "   ".bright_black(),
            "gpu-mode".bright_black(),
            "DISABLED".bright_red(),
            "→ revenue XMR/RandomX".bright_black()
        );
    }

    // NCL (Neural Compute Layer) info
    let ncl_config = if cli.ncl {
        let npu = NpuType::detect();
        println!(
            "{}  {:<12} {} {} {:.1} TFLOPS",
            "   ".bright_black(),
            "ncl".bright_black(),
            "ENABLED".bright_green().bold(),
            format!("[{:?}]", npu).bright_black(),
            npu.estimated_tflops(),
        );
        println!(
            "{}  {:<12} {}%",
            "   ".bright_black(),
            "ncl-alloc".bright_black(),
            ((cli.ncl_allocation * 100.0) as u32)
                .to_string()
                .bright_cyan()
        );
        Some(NCLConfig {
            enabled: true,
            allocation: cli.ncl_allocation.clamp(0.0, 0.5),
            npu_type: npu,
            min_task_interval_ms: 1000,
        })
    } else {
        println!(
            "{}  {:<12} {}",
            "   ".bright_black(),
            "ncl".bright_black(),
            "DISABLED".bright_red()
        );
        None
    };

    // Worker name
    let worker = cli.worker.unwrap_or_else(|| {
        hostname::get()
            .unwrap_or_else(|_| "unknown".into())
            .to_string_lossy()
            .into_owned()
    });
    println!(
        "{}  {:<12} {}",
        "   ".bright_black(),
        "worker".bright_black(),
        worker.bright_white().bold()
    );

    // Build miner config
    let dual_stream_cfg = if let Some(ref mode_str) = cli.dualmode {
        let mode = DualMode::from_str(mode_str).ok_or_else(|| {
            anyhow::anyhow!(
                "Unknown dualmode '{}'. Use: ALEPHDUAL, KASPADUAL, ETCHDUAL, ERGDUAL, RVNDUAL, FLUXDUAL, DCRDUAL, EPICDUAL, CFXDUAL",
                mode_str
            )
        })?;
        let dual_user = cli.dualuser.clone().unwrap_or_else(|| {
            warn!("[DUAL] --dualuser not specified, using primary wallet for dual pool");
            cli.wallet.clone()
        });
        let dual_cfg = DualStreamConfig::from_cli(
            mode,
            cli.dualpool.clone(),
            dual_user,
            &worker,
            cli.dual_alloc,
        );
        println!(
            "{}  {:<12} {}",
            "   ".bright_black(),
            "dual-mode".bright_black(),
            dual_cfg.summary().bright_yellow().bold()
        );
        Some(dual_cfg)
    } else {
        None
    };

    let trinity_cfg = if let Some(ref mode_str) = cli.triplemode {
        let mode = DualMode::from_str(mode_str).ok_or_else(|| {
            anyhow::anyhow!(
                "Unknown triplemode '{}'. Use same names as --dualmode (ALEPHDUAL, KASPADUAL, ETCHDUAL, ...)" ,
                mode_str
            )
        })?;
        let triple_user = cli.tripleuser.clone().unwrap_or_else(|| {
            warn!("[TRIPLE] --tripleuser not specified, using primary wallet for triple pool");
            cli.wallet.clone()
        });
        let triple_cfg = DualStreamConfig::from_cli_with_label(
            mode,
            cli.triplepool.clone(),
            triple_user,
            &worker,
            cli.triple_alloc,
            "triple",
        );
        println!(
            "{}  {:<12} {}",
            "   ".bright_black(),
            "triple-mode".bright_black(),
            triple_cfg.summary().bright_cyan().bold()
        );
        Some(triple_cfg)
    } else {
        None
    };

    // Auto-set g=dual if --dualmode or --triplemode is specified and no explicit --group override
    let effective_group_hint = if (dual_stream_cfg.is_some() || trinity_cfg.is_some()) && cli.group.is_none() {
        Some("dual".to_string())
    } else {
        cli.group.clone()
    };

    let config = MinerConfig {
        pool_url: cli.pool.clone(),
        wallet_address: cli.wallet.clone(),
        worker_name: worker.clone(),
        algorithm,
        difficulty: cli.difficulty,
        group_hint: effective_group_hint,
        cpu_threads: threads,
        gpu_enabled,
        gpu_devices: parse_gpu_devices(cli.gpu_devices.as_deref()),
        stats_file: cli.stats_file.as_deref().map(PathBuf::from),
        stats_interval_secs: cli.stats_interval.max(1),
        dual_stream: dual_stream_cfg,
        trinity: trinity_cfg,
    };

    println!();
    println!(
        "{}",
        "─────────────────────────────────────────────────────────────────".bright_black()
    );
    println!();

    // Handle benchmark/auto-tune mode
    if cli.benchmark || cli.auto_tune {
        return run_benchmark_mode(cli.benchmark, cli.auto_tune).await;
    }

    // Initialize NCL client if enabled
    let ncl_client = ncl_config.map(|cfg| Arc::new(NCLClient::new(cfg)));

    if let Some(ref _ncl) = ncl_client {
        log::debug!("NCL Client initialized");
    }

    // Start external pool mining if configured
    if let Some(ref ext_coin_str) = cli.external_coin {
        use crate::miner::external_pool::{ExternalMiner, ExternalPoolConfig};
        use crate::stratum::ethstratum::ExternalCoin;

        let ext_coin = ExternalCoin::from_str(ext_coin_str).ok_or_else(|| {
            anyhow::anyhow!(
                "Unknown external coin: {}. Use: etc, rvn, erg, kas",
                ext_coin_str
            )
        })?;

        let ext_pool = cli
            .external_pool
            .clone()
            .unwrap_or_else(|| ext_coin.default_pool_url().to_string());

        let ext_wallet = cli.external_wallet.clone().unwrap_or_else(|| {
            // Default BTC wallet
            "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw".to_string()
        });

        println!(
            "{}  {:<12} {} on {}",
            "   ".bright_black(),
            "external".bright_black(),
            ext_coin.name().bright_cyan(),
            ext_pool.bright_white()
        );
        println!(
            "{}  {:<12} {}",
            "   ".bright_black(),
            "ext-wallet".bright_black(),
            ext_wallet.bright_white()
        );
        println!(
            "{}  {:<12} {}%",
            "   ".bright_black(),
            "ext-power".bright_black(),
            cli.external_percent.to_string().bright_cyan()
        );

        let ext_config = ExternalPoolConfig {
            coin: ext_coin,
            pool_url: ext_pool,
            wallet: ext_wallet,
            worker: worker.clone(),
            cpu_threads: 1,
            gpu_enabled,
            hashpower_percent: cli.external_percent,
        };

        let ext_miner = Arc::new(ExternalMiner::new(ext_config));
        let ext_miner_clone = Arc::clone(&ext_miner);
        tokio::spawn(async move {
            if let Err(e) = ext_miner_clone.start().await {
                warn!("❌ External pool mining failed: {}", e);
            }
        });
    }

    // Start miner
    // If Python fallback is requested, spawn the Python miner process
    if let Some(ref fallback_mode) = cli.python_fallback {
        let variant = match fallback_mode.to_lowercase().as_str() {
            "auto" => {
                // ZION aliases all resolve to the canonical Deeksha fallback.
                if algorithm.is_zion_runtime() {
                    PythonMinerVariant::DeekshaCanonical
                } else {
                    PythonMinerVariant::Legacy
                }
            }
            other => PythonMinerVariant::from_str(other).unwrap_or_else(|| {
                warn!(
                    "Unknown Python fallback variant '{}', selecting fallback from algorithm type",
                    other
                );
                if algorithm.is_zion_runtime() {
                    PythonMinerVariant::DeekshaCanonical
                } else {
                    PythonMinerVariant::Legacy
                }
            }),
        };

        let py_stats_file = cli
            .stats_file
            .clone()
            .unwrap_or_else(|| "data/python_miner_stats.json".to_string());

        let extra_args: Vec<String> = cli
            .python_args
            .as_deref()
            .map(|s| s.split(',').map(|a| a.trim().to_string()).collect())
            .unwrap_or_default();

        let py_config = PythonFallbackConfig {
            pool_url: cli.pool.clone(),
            wallet: cli.wallet.clone(),
            worker: worker.clone(),
            algorithm: algorithm.name().to_string(),
            gpu: gpu_enabled,
            threads,
            stats_file: PathBuf::from(&py_stats_file),
            stats_interval: cli.stats_interval.max(1),
            variant,
            script_path: cli.python_script.as_deref().map(PathBuf::from),
            extra_args,
        };

        let py_miner = Arc::new(PythonFallbackMiner::new(py_config));

        info!("🐍 Python fallback: {:?} variant", variant);

        // Spawn Python miner
        let py_clone = Arc::clone(&py_miner);
        tokio::spawn(async move {
            if let Err(e) = py_clone.start().await {
                error!("❌ Python fallback miner failed: {}", e);
            }
        });

        // Spawn stats monitor for Python miner
        let py_stats = Arc::clone(&py_miner);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
            loop {
                interval.tick().await;
                if !py_stats.is_running().await {
                    warn!("🐍 Python miner process exited");
                    break;
                }
                if let Some(stats) = py_stats.read_stats().await {
                    if stats.hashrate > 0.0 {
                        let hr = if stats.hashrate > 1_000_000.0 {
                            format!("{:.2} MH/s", stats.hashrate / 1_000_000.0)
                        } else if stats.hashrate > 1_000.0 {
                            format!("{:.2} kH/s", stats.hashrate / 1_000.0)
                        } else {
                            format!("{:.0} H/s", stats.hashrate)
                        };
                        info!(
                            "🐍 Python miner: {} | accepted: {} | rejected: {}",
                            hr, stats.shares_accepted, stats.shares_rejected
                        );
                    }
                }
            }
        });

        // Graceful shutdown for Python miner
        let py_shutdown = Arc::clone(&py_miner);
        tokio::spawn(async move {
            signal::ctrl_c().await.ok();
            warn!("{}", "Shutting down Python miner...".yellow());
            py_shutdown.stop().await;
            std::process::exit(0);
        });

        // If Python fallback is the ONLY mode (no Rust mining), just wait
        info!("🐍 Python fallback miner running alongside Rust miner");
    }

    // ═══ Variant B: Parallel XMR (RandomX) mining ═══
    // Spawns a second UniversalMiner instance connecting directly to an
    // XMR pool (e.g. MoneroOcean) with dedicated CPU threads.
    // Enable with: --xmr-pool gulf.moneroocean.stream:10001 --xmr-wallet <addr>
    if let Some(ref xmr_pool) = cli.xmr_pool {
        let xmr_wallet = cli.xmr_wallet.clone().unwrap_or_else(|| {
            "42m86RBWf4PeuRf8P5rwA96XvmCKAfF77doWYJRv3KKAKrT8GTb5b3pbHTtaZsbJ4BERW1NHgh8WQgpAxAoEiXF82skcKsK".to_string()
        });
        let xmr_threads = cli.xmr_threads.max(1);

        println!(
            "{}  {:<12} {}",
            "   ".bright_black(),
            "xmr-pool".bright_black(),
            xmr_pool.bright_cyan().bold()
        );
        println!(
            "{}  {:<12} {}...{}",
            "   ".bright_black(),
            "xmr-wallet".bright_black(),
            &xmr_wallet[..8].bright_white(),
            &xmr_wallet[xmr_wallet.len().saturating_sub(6)..].bright_white()
        );
        println!(
            "{}  {:<12} {}",
            "   ".bright_black(),
            "xmr-threads".bright_black(),
            xmr_threads.to_string().bright_magenta().bold()
        );
        println!();

        let xmr_config = MinerConfig {
            pool_url: xmr_pool.clone(),
            wallet_address: xmr_wallet,
            worker_name: format!("{}-xmr", worker),
            algorithm: miner::Algorithm::RandomX,
            difficulty: None,
            group_hint: None,
            cpu_threads: xmr_threads,
            gpu_enabled: false,
            gpu_devices: vec![],
            stats_file: None,
            stats_interval_secs: cli.stats_interval.max(1),
            dual_stream: None,
            trinity: None,
        };

        let xmr_miner = Arc::new(miner::UniversalMiner::new(xmr_config)?);
        let xmr_miner_clone = Arc::clone(&xmr_miner);
        tokio::spawn(async move {
            if let Err(e) = xmr_miner_clone.start().await {
                error!("❌ XMR parallel miner failed: {}", e);
            }
        });
        info!(
            "⛏️  XMR parallel miner started ({} threads → {})",
            xmr_threads, xmr_pool
        );
    }

    // ═══ Dual-Stream Mining (LolMiner --dualmode style) ═══
    // If --dualmode is set, spawn a DualStreamMiner that mines the secondary
    // coin concurrently. The primary ZION miner still runs normally; the
    // dual miner uses GPU idle cycles. Pool is notified via g=dual group hint.
    if let Some(ref dual_cfg) = config.dual_stream {
        let dual_mode_name = dual_cfg.mode.coin_ticker().to_string();
        let dual_pool_url = dual_cfg.pool_url.clone();
        let dual_miner = Arc::new(DualStreamMiner::new(dual_cfg.clone()));
        let dual_miner_clone = Arc::clone(&dual_miner);

        tokio::spawn(async move {
            if let Err(e) = dual_miner_clone.start().await {
                error!("❌ Dual-stream ({}) miner failed: {}", dual_mode_name, e);
            }
        });

        // Graceful shutdown for dual miner
        let dual_shutdown = Arc::clone(&dual_miner);
        tokio::spawn(async move {
            signal::ctrl_c().await.ok();
            dual_shutdown.stop();
        });

        info!(
            "⛏️  Dual-stream miner started ({} → {})",
            dual_cfg.mode.name(),
            dual_pool_url
        );
    }

    // ═══ Trinity Mining ═══
    // If --triplemode is set, spawn a third DualStreamMiner for the tertiary coin.
    // Architecture: primary ZION + dual coin (GPU X%) + triple coin (GPU Y%).
    // GPU budget: primary = (100 - dual_alloc - triple_alloc)%.
    if let Some(ref triple_cfg) = config.trinity {
        let triple_mode_name = triple_cfg.mode.coin_ticker().to_string();
        let triple_pool_url = triple_cfg.pool_url.clone();
        let triple_miner = Arc::new(DualStreamMiner::new(triple_cfg.clone()));
        let triple_miner_clone = Arc::clone(&triple_miner);

        tokio::spawn(async move {
            if let Err(e) = triple_miner_clone.start().await {
                error!("❌ Triple-stream ({}) miner failed: {}", triple_mode_name, e);
            }
        });

        // Graceful shutdown for triple miner
        let triple_shutdown = Arc::clone(&triple_miner);
        tokio::spawn(async move {
            signal::ctrl_c().await.ok();
            triple_shutdown.stop();
        });

        info!(
            "⛏️  Triple-stream miner started ({} → {})",
            triple_cfg.mode.name(),
            triple_pool_url
        );
    }

    let miner = Arc::new(miner::UniversalMiner::new_with_ncl(
        config,
        ncl_client.clone(),
    )?);
    // Handle Ctrl+C gracefully
    let miner_clone = Arc::clone(&miner);
    tokio::spawn(async move {
        signal::ctrl_c().await.ok();
        println!(
            "\n{} {} {}\n",
            format!("[{}]", chrono::Utc::now().format("%H:%M:%S")).bright_black(),
            "signal".bright_yellow(),
            "Ctrl+C — shutting down...".bright_yellow().bold(),
        );
        miner_clone.stop().await;
        std::process::exit(0);
    });

    // Run miner
    // If external mining is 100%, don't require main pool connection
    if cli.external_percent >= 100 && cli.external_coin.is_some() {
        info!(
            "⛏️  External-only mode ({}%) — main pool connection skipped",
            cli.external_percent
        );
        info!("   Waiting for external mining to complete...");
        // Wait indefinitely — external mining runs in background tokio::spawn
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        }
    } else {
        miner.start().await?;
    }

    Ok(())
}

/// Run GPU benchmark or auto-tune mode
async fn run_benchmark_mode(full_benchmark: bool, do_auto_tune: bool) -> anyhow::Result<()> {
    use miner::gpu::{create_miner, detect_gpus};

    info!("🔧 GPU Benchmark/Auto-tune Mode");

    let gpus = detect_gpus()?;
    if gpus.is_empty() {
        anyhow::bail!("No GPU devices found! Build with --features gpu or --features cuda");
    }

    let mut benchmarks = Vec::new();

    for gpu in &gpus {
        info!("Initializing GPU {}: {}", gpu.id, gpu.name);

        let mut miner = create_miner(gpu)?;
        miner.init()?;

        if full_benchmark {
            let config = AutoTuneConfig::default();
            match run_benchmark(miner.as_mut(), &config) {
                Ok(result) => benchmarks.push(result),
                Err(e) => warn!("Benchmark failed for GPU {}: {}", gpu.id, e),
            }
        } else if do_auto_tune {
            match auto_tune(miner.as_mut()) {
                Ok(optimal) => {
                    info!("✅ GPU {} optimal batch size: {}", gpu.id, optimal);
                }
                Err(e) => warn!("Auto-tune failed for GPU {}: {}", gpu.id, e),
            }
        }
    }

    if !benchmarks.is_empty() {
        print_benchmark_results(&benchmarks);
    }

    Ok(())
}

fn print_banner() {
    println!();
    println!(
        "{}",
        " ╔══════════════════════════════════════════════════════════════════╗".bright_cyan()
    );
    println!(
        "{}{}{}",
        " ║ ".bright_cyan(),
        "       ZION UNIVERSAL MINER  v2.9.6  TerraNova              "
            .bright_white()
            .bold(),
        " ║".bright_cyan()
    );
    println!(
        "{}{}{}",
        " ║ ".bright_cyan(),
        "       Multi-Algorithm  ·  CPU + GPU + NCL AI               ".bright_black(),
        " ║".bright_cyan()
    );
    println!(
        "{}",
        " ╠══════════════════════════════════════════════════════════════════╣".bright_cyan()
    );
    println!(
        "{}{}{}",
        " ║ ".bright_cyan(),
        " Algorithms   cosmic_harmony · randomx · yescrypt · blake3   ".white(),
        " ║".bright_cyan()
    );
    println!(
        "{}{}{}",
        " ║ ".bright_cyan(),
        " GPU Accel    Metal (macOS) · CUDA · OpenCL                  ".white(),
        " ║".bright_cyan()
    );
    println!(
        "{}{}{}",
        " ║ ".bright_cyan(),
        " Revenue      ERG/RVN/KAS/ETC (GPU) · XMR (CPU)             ".white(),
        " ║".bright_cyan()
    );
    println!(
        "{}{}{}",
        " ║ ".bright_cyan(),
        " NCL Bonus    Neural Compute Layer — AI task rewards         ".white(),
        " ║".bright_cyan()
    );
    println!(
        "{}",
        " ╠──────────────────────────────────────────────────────────────────╣".bright_cyan()
    );
    // HugePages memory status line (XMRig-style)
    let hp_status = zion_cosmic_harmony_v3::hugepages::memory_status_line(256 * 1024);
    let hp_line = format!(" Memory      {}", hp_status);
    let padded = format!("{:<62}", hp_line);
    println!(
        "{}{}{}",
        " ║ ".bright_cyan(),
        padded.white(),
        " ║".bright_cyan()
    );
    println!(
        "{}",
        " ╚══════════════════════════════════════════════════════════════════╝".bright_cyan()
    );
    println!();
}

fn parse_gpu_devices(devices: Option<&str>) -> Vec<usize> {
    devices
        .map(|s| {
            s.split(',')
                .filter_map(|d| d.trim().parse::<usize>().ok())
                .collect()
        })
        .unwrap_or_default()
}
