//! Telemetry reporter — pushes miner stats to the ZionOS dashboard.
//!
//! Reports hashrate, share counts, uptime, and GPU stats to the dashboard API
//! at a configurable interval. Non-blocking: failures are logged and retried
//! on the next interval.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Shared counters updated by the mining loop.
pub struct TelemetryCounters {
    pub accepted: AtomicU64,
    pub rejected: AtomicU64,
    pub total_hashes: AtomicU64,
    pub difficulty: AtomicU64,
    pub session_start: Instant,
}

impl TelemetryCounters {
    pub fn new() -> Self {
        Self {
            accepted: AtomicU64::new(0),
            rejected: AtomicU64::new(0),
            total_hashes: AtomicU64::new(0),
            difficulty: AtomicU64::new(0),
            session_start: Instant::now(),
        }
    }
}

/// Configuration for the telemetry reporter thread.
pub struct TelemetryConfig {
    pub dashboard_url: String,
    pub rig_id: String,
    pub rig_name: String,
    pub wallet: String,
    pub worker: String,
    pub pool_addr: String,
    pub threads: u32,
    pub interval_s: u64,
}

/// Spawn a background thread that periodically reports telemetry.
/// Returns the shared counters for the mining loop to update.
pub fn spawn_reporter(cfg: TelemetryConfig) -> Arc<TelemetryCounters> {
    let counters = Arc::new(TelemetryCounters::new());
    let c = Arc::clone(&counters);

    std::thread::Builder::new()
        .name("telemetry".into())
        .spawn(move || reporter_loop(cfg, c))
        .expect("failed to spawn telemetry thread");

    counters
}

fn reporter_loop(cfg: TelemetryConfig, counters: Arc<TelemetryCounters>) {
    let interval = Duration::from_secs(cfg.interval_s.max(3));

    // Auto-register with the dashboard on first connect
    auto_register(&cfg);

    loop {
        std::thread::sleep(interval);

        let uptime_s = counters.session_start.elapsed().as_secs();
        let total_hashes = counters.total_hashes.load(Ordering::Relaxed);
        let accepted = counters.accepted.load(Ordering::Relaxed);
        let rejected = counters.rejected.load(Ordering::Relaxed);
        let difficulty = counters.difficulty.load(Ordering::Relaxed);

        let hashrate = if uptime_s > 0 {
            total_hashes as f64 / uptime_s as f64
        } else {
            0.0
        };

        let payload = serde_json::json!({
            "hashrate": hashrate,
            "accepted": accepted,
            "rejected": rejected,
            "uptime_s": uptime_s,
            "difficulty": difficulty,
            "total_hashes": total_hashes,
        });

        let url = format!("{}/api/rigs/{}/telemetry", cfg.dashboard_url, cfg.rig_id);

        match ureq::put(&url)
            .set("Content-Type", "application/json")
            .send_string(&payload.to_string())
        {
            Ok(_) => {} // quiet success
            Err(e) => {
                eprintln!("[TELEMETRY] report failed: {e}");
            }
        }

        // Also push recent log line
        push_log(
            &cfg.dashboard_url,
            &cfg.rig_id,
            "info",
            &format!(
                "hashrate={:.2} H/s accepted={} rejected={} hashes={}",
                hashrate, accepted, rejected, total_hashes
            ),
        );
    }
}

fn auto_register(cfg: &TelemetryConfig) {
    let payload = serde_json::json!({
        "id": cfg.rig_id,
        "name": cfg.rig_name,
        "wallet": cfg.wallet,
        "worker": cfg.worker,
        "pool_addr": cfg.pool_addr,
        "status": "online",
        "gpu": null,
        "stats": {
            "hashrate": 0, "hashrate_1h": 0, "hashrate_24h": 0,
            "accepted": 0, "rejected": 0, "stale": 0,
            "uptime_s": 0, "difficulty": 0, "last_share_time": null,
            "total_hashes": 0
        },
        "config": {
            "threads": cfg.threads,
            "gpu_mode": "cpu",
            "intensity": null
        },
        "last_seen": 0
    });

    let url = format!("{}/api/rigs", cfg.dashboard_url);
    match ureq::post(&url)
        .set("Content-Type", "application/json")
        .send_string(&payload.to_string())
    {
        Ok(_) => eprintln!("[TELEMETRY] rig registered: {}", cfg.rig_id),
        Err(ureq::Error::Status(409, _)) => {
            eprintln!("[TELEMETRY] rig already registered: {}", cfg.rig_id);
        }
        Err(e) => {
            eprintln!("[TELEMETRY] registration failed (will retry): {e}");
        }
    }
}

/// Push a single log line to the dashboard.
pub fn push_log(dashboard_url: &str, rig_id: &str, level: &str, message: &str) {
    let payload = serde_json::json!({
        "rig_id": rig_id,
        "level": level,
        "message": message,
    });
    let url = format!("{}/api/logs", dashboard_url);
    let _ = ureq::post(&url)
        .set("Content-Type", "application/json")
        .send_string(&payload.to_string());
}
