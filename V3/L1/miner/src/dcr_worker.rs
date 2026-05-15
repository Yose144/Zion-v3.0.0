use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

#[cfg(any(feature = "gpu", feature = "gpu-opencl"))]
use crate::dcr_gpu::{autotune_best_work_size, load_saved_work_size, save_work_size, GpuDcrMiner};
use crate::dcr_hash::{hash_meets_target, NONCE_OFFSET};
use crate::dcr_stratum::DcrStratumClient;

const DEFAULT_BTC_WALLET: &str = "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw";
const DEFAULT_DCR_POOL: &str = "dcr.2miners.com:3333";
const DEFAULT_DCR_WORKER: &str = "zion_stealth";
const DEFAULT_GPU_WORK_SIZE: usize = 1 << 20;
const DEFAULT_GPU_AUTOTUNE_SECS: f64 = 2.0;

/// Nonces per inner batch before checking for new jobs / stop flag.
/// 2^22 ≈ 4M — big enough to amortize poll overhead, small enough
/// for responsive shutdown (~0.1 s at 40 MH/s).
const INNER_BATCH: u32 = 1 << 22;

/// How often (in seconds) each thread prints a hashrate line.
const REPORT_INTERVAL_SECS: u64 = 30;

/// Shared counters across all DCR worker threads.
pub struct DcrStats {
    pub total_hashes: AtomicU64,
    pub accepted_shares: AtomicU64,
    pub rejected_shares: AtomicU64,
    /// Total tracked revenue in micro-cents (1 USD = 100_000_000).
    /// Updated atomically per accepted share.
    pub revenue_microcents: AtomicU64,
}

impl DcrStats {
    pub fn new() -> Self {
        Self {
            total_hashes: AtomicU64::new(0),
            accepted_shares: AtomicU64::new(0),
            rejected_shares: AtomicU64::new(0),
            revenue_microcents: AtomicU64::new(0),
        }
    }

    /// Return total revenue as USD float.
    pub fn revenue_usd(&self) -> f64 {
        self.revenue_microcents.load(Ordering::Relaxed) as f64 / 100_000_000.0
    }
}

/// Configuration for the background DCR mining worker.
#[derive(Debug, Clone)]
pub struct DcrConfig {
    pub btc_wallet: String,
    pub pool_addr: String,
    pub threads: usize,
    pub worker_name: String,
    pub backend: DcrBackend,
    pub gpu_work_size: usize,
    pub gpu_autotune: bool,
    pub gpu_autotune_secs: f64,
    pub hash_impl: DcrHashImpl,
    /// Estimated USD value credited per accepted share.
    /// Default 0.001 USD (1/10 of a cent) per share.
    pub revenue_per_share_usd: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DcrBackend {
    Auto,
    Cpu,
    Gpu,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DcrHashImpl {
    RustPrecompute,
    #[allow(dead_code)]
    Native,
}

impl DcrHashImpl {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::RustPrecompute => "rust-precompute",
            Self::Native => "native",
        }
    }
}

impl DcrBackend {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Auto => "auto",
            Self::Cpu => "cpu",
            Self::Gpu => "gpu",
        }
    }
}

impl DcrConfig {
    /// Read DCR config from environment.
    ///
    /// Auto-enabled by default: the hardcoded BTC wallet means DCR mining
    /// starts with 1 thread unless explicitly disabled via
    /// `ZION_DCR_ENABLED=false`.
    pub fn from_env() -> Option<Self> {
        let enabled = std::env::var("ZION_DCR_ENABLED").unwrap_or_else(|_| "true".to_string());
        if enabled.trim().eq_ignore_ascii_case("false") || enabled.trim() == "0" {
            return None;
        }

        let btc_wallet =
            std::env::var("ZION_BTC_WALLET").unwrap_or_else(|_| DEFAULT_BTC_WALLET.to_string());
        if btc_wallet.trim().is_empty() {
            return None;
        }

        let threads = std::env::var("ZION_DCR_THREADS")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(1)
            .max(1);

        Some(Self {
            btc_wallet,
            pool_addr: std::env::var("ZION_DCR_POOL")
                .unwrap_or_else(|_| DEFAULT_DCR_POOL.to_string()),
            threads,
            worker_name: std::env::var("ZION_DCR_WORKER")
                .unwrap_or_else(|_| DEFAULT_DCR_WORKER.to_string()),
            backend: parse_backend(
                &std::env::var("ZION_DCR_BACKEND").unwrap_or_else(|_| "auto".to_string()),
            ),
            gpu_work_size: std::env::var("ZION_GPU_WORK_SIZE")
                .ok()
                .and_then(|v| v.parse::<usize>().ok())
                .unwrap_or(DEFAULT_GPU_WORK_SIZE)
                .max(1024),
            gpu_autotune: parse_bool_env("ZION_GPU_AUTOTUNE", true),
            gpu_autotune_secs: std::env::var("ZION_GPU_AUTOTUNE_SECS")
                .ok()
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(DEFAULT_GPU_AUTOTUNE_SECS)
                .max(0.3),
            hash_impl: parse_hash_impl(
                &std::env::var("ZION_DCR_HASH_IMPL").unwrap_or_else(|_| "rust".to_string()),
            ),
            revenue_per_share_usd: std::env::var("ZION_DCR_REVENUE_PER_SHARE")
                .ok()
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(0.001)
                .max(0.0),
        })
    }

    /// Truncated wallet for log display: `bc1q...d8mw`.
    pub fn wallet_short(&self) -> String {
        let w = &self.btc_wallet;
        if w.len() > 12 {
            format!("{}...{}", &w[..4], &w[w.len() - 4..])
        } else {
            w.clone()
        }
    }
}

/// Spawn background DCR mining threads.
///
/// Returns (join_handles, shared_stats).
pub fn spawn_dcr_worker(
    #[allow(unused_mut)] mut config: DcrConfig,
    stop: Arc<AtomicBool>,
) -> (Vec<thread::JoinHandle<()>>, Arc<DcrStats>) {
    #[cfg(any(feature = "gpu", feature = "gpu-opencl"))]
    {
        if matches!(config.backend, DcrBackend::Auto | DcrBackend::Gpu) && config.gpu_autotune {
            let mut candidates = vec![
                (config.gpu_work_size / 4).max(262_144),
                (config.gpu_work_size / 2).max(262_144),
                config.gpu_work_size.max(262_144),
                (config.gpu_work_size.saturating_mul(2)).min(4_194_304),
                (config.gpu_work_size.saturating_mul(4)).min(4_194_304),
            ];
            candidates.sort_unstable();
            candidates.dedup();

            if let Ok((device, ws, mhps)) =
                autotune_best_work_size(&candidates, config.gpu_autotune_secs)
            {
                let stored = load_saved_work_size(&device).unwrap_or(0);
                let chosen = ws.max(stored);
                config.gpu_work_size = chosen;
                let _ = save_work_size(&device, chosen);
                eprintln!(
                    "dcr autotune device={} best_work_size={} sampled_mhps={:.2} saved={}",
                    device, chosen, mhps, chosen
                );
            }
        }
    }

    let stats = Arc::new(DcrStats::new());
    let mut handles = Vec::with_capacity(config.threads);

    for thread_id in 0..config.threads {
        let cfg = config.clone();
        let stop = stop.clone();
        let stats = stats.clone();

        let handle = thread::Builder::new()
            .name(format!("dcr-worker-{thread_id}"))
            .spawn(move || match cfg.backend {
                DcrBackend::Cpu => mine_loop_cpu(&cfg, thread_id, &stop, &stats),
                DcrBackend::Gpu => mine_loop_gpu_or_fallback(&cfg, thread_id, &stop, &stats, false),
                DcrBackend::Auto => mine_loop_gpu_or_fallback(&cfg, thread_id, &stop, &stats, true),
            })
            .expect("spawn DCR worker thread");

        handles.push(handle);
    }

    (handles, stats)
}

/// Main mining loop for one DCR worker thread — optimised.
///
/// Key optimisations vs. v1:
/// - Fixed `[u8; 180]` header — zero heap alloc, no bounds checks
/// - `#[inline(always)]` on hash + target functions
/// - u128 target comparison (2 cmps) instead of per-byte loop (up to 32 cmps)
/// - 4M nonce inner batch before poll (was 1M)
/// - Reconnect with exponential back-off
fn mine_loop_cpu(config: &DcrConfig, thread_id: usize, stop: &AtomicBool, stats: &DcrStats) {
    // Each thread gets an exclusive nonce quarter of u32 space
    let nonce_base = (thread_id as u64) * (u32::MAX as u64 + 1) / config.threads.max(1) as u64;
    let nonce_start = nonce_base as u32;
    let mut backoff_secs: u64 = 1;

    loop {
        if stop.load(Ordering::Relaxed) {
            return;
        }

        // ── connect ──
        let mut client = match DcrStratumClient::connect(
            &config.pool_addr,
            &config.btc_wallet,
            &config.worker_name,
        ) {
            Ok(c) => {
                backoff_secs = 1; // reset on success
                c
            }
            Err(_) => {
                if wait_or_stop(stop, backoff_secs) {
                    return;
                }
                backoff_secs = (backoff_secs * 2).min(60);
                continue;
            }
        };

        if client.subscribe().is_err() || client.authorize().is_err() {
            if wait_or_stop(stop, backoff_secs) {
                return;
            }
            backoff_secs = (backoff_secs * 2).min(60);
            continue;
        }

        // ── wait for first job ──
        let job = match client.read_job() {
            Ok(j) => j,
            Err(_) => {
                if wait_or_stop(stop, 5) {
                    return;
                }
                continue;
            }
        };

        // Copy into fixed-size header for zero-cost nonce writes
        let job_hdr_len = job.header.len();
        if job_hdr_len < NONCE_OFFSET + 4 {
            // malformed job — skip
            if wait_or_stop(stop, 5) {
                return;
            }
            continue;
        }

        let mut header = [0u8; 180];
        let copy_len = job_hdr_len.min(180);
        header[..copy_len].copy_from_slice(&job.header[..copy_len]);

        let use_native_hash = matches!(config.hash_impl, DcrHashImpl::Native);

        // Precompute Blake3 state for first 128 bytes only on the rust path.
        let mut base_hasher = blake3::Hasher::new();
        let mut tail = [0u8; 52];
        if !use_native_hash {
            base_hasher.update(&header[..128]);
            tail.copy_from_slice(&header[128..180]);
        }
        const TAIL_NONCE: usize = NONCE_OFFSET - 128; // 12

        let mut target = job.target;
        let mut job_id = job.job_id.clone();
        let mut nonce = nonce_start;
        let mut batch_start = Instant::now();
        let mut batch_hashes: u64 = 0;
        let mut prev_acc = stats.accepted_shares.load(Ordering::Relaxed);

        // ── tight hash loop ──
        'mining: loop {
            if stop.load(Ordering::Relaxed) {
                return;
            }

            // Poll for new job (non-blocking, ~0 ms if nothing)
            match client.poll_job() {
                Ok(Some(new_job)) => {
                    let new_len = new_job.header.len().min(180);
                    header = [0u8; 180];
                    header[..new_len].copy_from_slice(&new_job.header[..new_len]);
                    if !use_native_hash {
                        // Rebuild precomputed state for new header.
                        base_hasher = blake3::Hasher::new();
                        base_hasher.update(&header[..128]);
                        tail.copy_from_slice(&header[128..180]);
                    }
                    target = new_job.target;
                    job_id = new_job.job_id;
                    nonce = nonce_start;
                }
                Ok(None) => {}
                Err(_) => break 'mining, // reconnect
            }

            // Hash INNER_BATCH nonces; rust path uses precomputed tail, native path hashes full header.
            for _ in 0..INNER_BATCH {
                let hash = if use_native_hash {
                    header[NONCE_OFFSET..NONCE_OFFSET + 4].copy_from_slice(&nonce.to_le_bytes());
                    dcr_hash_runtime(&header)
                } else {
                    tail[TAIL_NONCE..TAIL_NONCE + 4].copy_from_slice(&nonce.to_le_bytes());

                    let mut h = base_hasher.clone();
                    h.update(&tail);
                    *h.finalize().as_bytes()
                };
                if hash_meets_target(&hash, &target) {
                    if client.submit_share(&job_id, nonce).is_ok() {
                        stats.accepted_shares.fetch_add(1, Ordering::Relaxed);
                        let microcents = (config.revenue_per_share_usd * 100_000_000.0) as u64;
                        if microcents > 0 {
                            stats
                                .revenue_microcents
                                .fetch_add(microcents, Ordering::Relaxed);
                        }
                    } else {
                        stats.rejected_shares.fetch_add(1, Ordering::Relaxed);
                    }
                }

                nonce = nonce.wrapping_add(1);
            }

            batch_hashes += INNER_BATCH as u64;
            stats
                .total_hashes
                .fetch_add(INNER_BATCH as u64, Ordering::Relaxed);

            // Periodic hashrate report
            let elapsed = batch_start.elapsed().as_secs_f64();
            if elapsed >= REPORT_INTERVAL_SECS as f64 {
                let mhps = batch_hashes as f64 / elapsed / 1_000_000.0;
                let total_acc = stats.accepted_shares.load(Ordering::Relaxed);
                let total_rej = stats.rejected_shares.load(Ordering::Relaxed);
                let acc_delta = total_acc.saturating_sub(prev_acc);
                let acc_per_min = (acc_delta as f64) * 60.0 / elapsed.max(0.001);
                eprintln!(
                    "dcr[{}] cpu effective={:.2} MH/s accepted/min={:.2} shares={}/{}",
                    thread_id, mhps, acc_per_min, total_acc, total_rej
                );
                prev_acc = total_acc;
                batch_start = Instant::now();
                batch_hashes = 0;
            }
        }
    }
}

fn mine_loop_gpu_or_fallback(
    config: &DcrConfig,
    thread_id: usize,
    stop: &AtomicBool,
    stats: &DcrStats,
    allow_cpu_fallback: bool,
) {
    #[cfg(any(feature = "gpu", feature = "gpu-opencl"))]
    {
        if mine_loop_gpu(config, thread_id, stop, stats).is_ok() {
            return;
        }
    }

    if allow_cpu_fallback {
        eprintln!("dcr[{thread_id}] gpu unavailable, falling back to cpu");
        mine_loop_cpu(config, thread_id, stop, stats);
    } else {
        eprintln!("dcr[{thread_id}] gpu requested but unavailable");
    }
}

#[cfg(any(feature = "gpu", feature = "gpu-opencl"))]
fn mine_loop_gpu(
    config: &DcrConfig,
    thread_id: usize,
    stop: &AtomicBool,
    stats: &DcrStats,
) -> Result<(), String> {
    let mut gpu = GpuDcrMiner::new(config.gpu_work_size)?;
    let batch = gpu.batch_size();

    // Each thread gets an exclusive nonce range offset.
    let nonce_base = (thread_id as u64) * (u32::MAX as u64 + 1) / config.threads.max(1) as u64;
    let nonce_start = nonce_base as u32;

    let mut backoff_secs: u64 = 1;
    let mut nonce: u32;
    let mut batch_start = Instant::now();
    let mut batch_hashes: u64 = 0;
    let mut prev_acc = stats.accepted_shares.load(Ordering::Relaxed);

    loop {
        if stop.load(Ordering::Relaxed) {
            return Ok(());
        }

        let mut client = match DcrStratumClient::connect(
            &config.pool_addr,
            &config.btc_wallet,
            &config.worker_name,
        ) {
            Ok(c) => {
                backoff_secs = 1;
                c
            }
            Err(_) => {
                if wait_or_stop(stop, backoff_secs) {
                    return Ok(());
                }
                backoff_secs = (backoff_secs * 2).min(60);
                continue;
            }
        };

        if client.subscribe().is_err() || client.authorize().is_err() {
            if wait_or_stop(stop, backoff_secs) {
                return Ok(());
            }
            backoff_secs = (backoff_secs * 2).min(60);
            continue;
        }

        let job = match client.read_job() {
            Ok(j) => j,
            Err(_) => {
                if wait_or_stop(stop, 5) {
                    return Ok(());
                }
                continue;
            }
        };

        let mut header = [0u8; 180];
        let mut len = job.header.len().min(180);
        header[..len].copy_from_slice(&job.header[..len]);
        let mut target = job.target;
        let mut job_id = job.job_id;
        nonce = nonce_start;

        'mining: loop {
            if stop.load(Ordering::Relaxed) {
                return Ok(());
            }

            match client.poll_job() {
                Ok(Some(new_job)) => {
                    header = [0u8; 180];
                    len = new_job.header.len().min(180);
                    header[..len].copy_from_slice(&new_job.header[..len]);
                    target = new_job.target;
                    job_id = new_job.job_id;
                    nonce = nonce_start;
                }
                Ok(None) => {}
                Err(_) => break 'mining,
            }

            let found = match gpu.mine_batch(&header, &target, nonce) {
                Ok(v) => v,
                Err(_) => break 'mining,
            };

            stats
                .total_hashes
                .fetch_add(batch as u64, Ordering::Relaxed);
            batch_hashes += batch as u64;

            for found_nonce in found {
                if client.submit_share(&job_id, found_nonce).is_ok() {
                    stats.accepted_shares.fetch_add(1, Ordering::Relaxed);
                    let microcents = (config.revenue_per_share_usd * 100_000_000.0) as u64;
                    if microcents > 0 {
                        stats
                            .revenue_microcents
                            .fetch_add(microcents, Ordering::Relaxed);
                    }
                } else {
                    stats.rejected_shares.fetch_add(1, Ordering::Relaxed);
                }
            }

            nonce = nonce.wrapping_add(batch);

            let elapsed = batch_start.elapsed().as_secs_f64();
            if elapsed >= REPORT_INTERVAL_SECS as f64 {
                let mhps = batch_hashes as f64 / elapsed / 1_000_000.0;
                let total_acc = stats.accepted_shares.load(Ordering::Relaxed);
                let total_rej = stats.rejected_shares.load(Ordering::Relaxed);
                let acc_delta = total_acc.saturating_sub(prev_acc);
                let acc_per_min = (acc_delta as f64) * 60.0 / elapsed.max(0.001);
                eprintln!(
                    "dcr[{}] gpu {} effective={:.2} MH/s accepted/min={:.2} shares={}/{}",
                    thread_id,
                    gpu.device_name(),
                    mhps,
                    acc_per_min,
                    total_acc,
                    total_rej
                );
                prev_acc = total_acc;
                batch_start = Instant::now();
                batch_hashes = 0;
            }
        }
    }
}

fn parse_backend(raw: &str) -> DcrBackend {
    match raw.trim().to_ascii_lowercase().as_str() {
        "cpu" => DcrBackend::Cpu,
        "gpu" => DcrBackend::Gpu,
        _ => DcrBackend::Auto,
    }
}

fn parse_hash_impl(raw: &str) -> DcrHashImpl {
    match raw.trim().to_ascii_lowercase().as_str() {
        "native" => {
            #[cfg(feature = "native-blake3-algo")]
            {
                DcrHashImpl::Native
            }
            #[cfg(not(feature = "native-blake3-algo"))]
            {
                eprintln!("dcr hash impl=native requested but native-blake3-algo feature is not enabled; using rust-precompute");
                DcrHashImpl::RustPrecompute
            }
        }
        _ => DcrHashImpl::RustPrecompute,
    }
}

#[inline(always)]
fn dcr_hash_runtime(header: &[u8; 180]) -> [u8; 32] {
    #[cfg(feature = "native-blake3-algo")]
    {
        zion_native_ffi::blake3_algo::hash(header)
    }
    #[cfg(not(feature = "native-blake3-algo"))]
    {
        crate::dcr_hash::dcr_hash(header)
    }
}

fn parse_bool_env(key: &str, default: bool) -> bool {
    match std::env::var(key) {
        Ok(v) => {
            let t = v.trim().to_ascii_lowercase();
            !(t == "0" || t == "false" || t == "no" || t == "off")
        }
        Err(_) => default,
    }
}

/// Sleep for `seconds`, checking `stop` every second.
/// Returns `true` if stop was requested.
fn wait_or_stop(stop: &AtomicBool, seconds: u64) -> bool {
    for _ in 0..seconds {
        if stop.load(Ordering::Relaxed) {
            return true;
        }
        thread::sleep(Duration::from_secs(1));
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    #[test]
    fn dcr_config_defaults() {
        let _guard = env_lock().lock().expect("env lock");
        std::env::remove_var("ZION_DCR_ENABLED");
        std::env::remove_var("ZION_BTC_WALLET");
        std::env::remove_var("ZION_DCR_THREADS");
        std::env::remove_var("ZION_DCR_POOL");
        std::env::remove_var("ZION_DCR_WORKER");

        let config = DcrConfig::from_env().expect("DCR enabled by default");
        assert_eq!(config.btc_wallet, DEFAULT_BTC_WALLET);
        assert_eq!(config.pool_addr, DEFAULT_DCR_POOL);
        assert_eq!(config.threads, 1);
        assert_eq!(config.worker_name, DEFAULT_DCR_WORKER);
    }

    #[test]
    fn dcr_config_disabled() {
        let _guard = env_lock().lock().expect("env lock");
        std::env::set_var("ZION_DCR_ENABLED", "false");
        assert!(DcrConfig::from_env().is_none());
        std::env::remove_var("ZION_DCR_ENABLED");
    }

    #[test]
    fn dcr_config_disabled_zero() {
        let _guard = env_lock().lock().expect("env lock");
        std::env::set_var("ZION_DCR_ENABLED", "0");
        assert!(DcrConfig::from_env().is_none());
        std::env::remove_var("ZION_DCR_ENABLED");
    }

    #[test]
    fn wallet_short_truncates() {
        let config = DcrConfig {
            btc_wallet: "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw".to_string(),
            pool_addr: DEFAULT_DCR_POOL.to_string(),
            threads: 1,
            worker_name: DEFAULT_DCR_WORKER.to_string(),
            backend: DcrBackend::Auto,
            gpu_work_size: DEFAULT_GPU_WORK_SIZE,
            gpu_autotune: true,
            gpu_autotune_secs: DEFAULT_GPU_AUTOTUNE_SECS,
            hash_impl: DcrHashImpl::RustPrecompute,
        };
        assert_eq!(config.wallet_short(), "bc1q...d8mw");
    }

    #[test]
    fn spawn_and_stop_immediately() {
        let config = DcrConfig {
            btc_wallet: "test_wallet".to_string(),
            pool_addr: "127.0.0.1:19999".to_string(), // won't connect
            threads: 1,
            worker_name: "test".to_string(),
            backend: DcrBackend::Cpu,
            gpu_work_size: DEFAULT_GPU_WORK_SIZE,
            gpu_autotune: false,
            gpu_autotune_secs: DEFAULT_GPU_AUTOTUNE_SECS,
            hash_impl: DcrHashImpl::RustPrecompute,
        };
        let stop = Arc::new(AtomicBool::new(true)); // pre-set stop
        let (handles, stats) = spawn_dcr_worker(config, stop);
        for h in handles {
            h.join().expect("thread join");
        }
        assert_eq!(stats.total_hashes.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn backend_parser_defaults_auto() {
        assert_eq!(parse_backend(""), DcrBackend::Auto);
        assert_eq!(parse_backend("auto"), DcrBackend::Auto);
        assert_eq!(parse_backend("cpu"), DcrBackend::Cpu);
        assert_eq!(parse_backend("gpu"), DcrBackend::Gpu);
    }

    #[test]
    fn hash_impl_parser_defaults_rust() {
        assert_eq!(parse_hash_impl(""), DcrHashImpl::RustPrecompute);
        assert_eq!(parse_hash_impl("rust"), DcrHashImpl::RustPrecompute);
    }

    #[test]
    fn hash_impl_parser_native_behavior() {
        let parsed = parse_hash_impl("native");
        #[cfg(feature = "native-blake3-algo")]
        assert_eq!(parsed, DcrHashImpl::Native);
        #[cfg(not(feature = "native-blake3-algo"))]
        assert_eq!(parsed, DcrHashImpl::RustPrecompute);
    }

    #[test]
    fn stats_counters_start_at_zero() {
        let stats = DcrStats::new();
        assert_eq!(stats.total_hashes.load(Ordering::Relaxed), 0);
        assert_eq!(stats.accepted_shares.load(Ordering::Relaxed), 0);
        assert_eq!(stats.rejected_shares.load(Ordering::Relaxed), 0);
    }
}
