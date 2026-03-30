//! ZionOS Miner — Ekam Deeksha v2 pool miner for SMOS rigs.
//!
//! Usage:
//!   zionos-miner --pool <host:port> --wallet <zion1…> [--worker <name>] [--threads N]
//!
//! Algorithm: cosmic_harmony_ekam_deeksha_v2 (from V3/L1/cosmic-harmony)
//! Protocol:  zion-v3-stratum JSON-line over TCP

mod pool_client;
mod telemetry;
mod worker;

use anyhow::{anyhow, Result};
use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::Instant;

fn main() {
    if let Err(e) = run() {
        eprintln!("[FATAL] {e:#}");
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let args = parse_args()?;

    println!("╔══════════════════════════════════════╗");
    println!("║    ZionOS Miner v{}          ║", env!("CARGO_PKG_VERSION"));
    println!("║    Ekam Deeksha v2                   ║");
    println!("╚══════════════════════════════════════╝");
    println!();
    println!("  pool:      {}", args.pool);
    println!("  wallet:    {}", args.wallet);
    println!("  worker:    {}", args.worker);
    println!("  threads:   {}", args.threads);
    if let Some(ref url) = args.dashboard_url {
        println!("  dashboard: {}", url);
    }
    println!();

    // Spawn telemetry reporter if --dashboard-url is set
    let telemetry = args.dashboard_url.as_ref().map(|url| {
        let rig_id = format!("rig-{}", args.worker);
        telemetry::spawn_reporter(telemetry::TelemetryConfig {
            dashboard_url: url.clone(),
            rig_id: rig_id.clone(),
            rig_name: format!("ZionMiner-{}", args.worker),
            wallet: args.wallet.clone(),
            worker: args.worker.clone(),
            pool_addr: args.pool.clone(),
            threads: args.threads as u32,
            interval_s: 10,
        })
    });

    // Main loop: connect → mine → reconnect on disconnect
    let mut reconnect_delay = 1u64;

    loop {
        match mine_session(&args, telemetry.as_ref()) {
            Ok(()) => {
                eprintln!("[INFO] session ended cleanly");
                reconnect_delay = 1;
            }
            Err(e) => {
                eprintln!("[ERROR] session failed: {e:#}");
                let delay = reconnect_delay.min(30);
                eprintln!("[INFO] reconnecting in {delay}s...");
                std::thread::sleep(std::time::Duration::from_secs(delay));
                reconnect_delay = (reconnect_delay * 2).min(60);
            }
        }
    }
}

/// One mining session: connect, mine until disconnect or error.
fn mine_session(args: &Args, telemetry: Option<&Arc<telemetry::TelemetryCounters>>) -> Result<()> {
    let mut pool = pool_client::PoolClient::connect(
        &args.pool,
        &args.wallet,
        &args.worker,
    )?;

    println!(
        "[CONNECTED] algo={} ttl={}ms",
        pool.algorithm, pool.job_ttl_ms
    );

    let mut accepted: u64 = 0;
    let mut rejected: u64 = 0;
    let mut total_hashes: u64 = 0;
    let session_start = Instant::now();

    loop {
        let pool_job = pool.next_job()?;
        let job = &pool_job.job;
        let target = &pool_job.share_target;

        let height = job.height;
        let nonce_start = job.start_nonce;
        let nonce_end = job.start_nonce + job.nonce_count;

        // Update difficulty counter for telemetry
        if let Some(tc) = telemetry {
            tc.difficulty.store(job.nonce_count, Ordering::Relaxed);
        }

        println!(
            "[JOB] height={height} nonces={nonce_start}..{nonce_end} job_id={}",
            job.job_id
        );

        let scan_start = Instant::now();
        let result = worker::scan_nonces(job, target, args.threads);
        let elapsed_ms = scan_start.elapsed().as_millis() as u64;

        match result {
            Some(hit) => {
                // Verify hash before submitting (sanity check)
                let verify = zion_core::BlockCandidate {
                    header: job.header,
                    nonce: hit.nonce,
                    height: job.height,
                }
                .hash();

                if verify != hit.hash {
                    eprintln!(
                        "[BUG] hash mismatch! scan={} verify={}",
                        hex(&hit.hash),
                        hex(&verify)
                    );
                    // Use verified hash
                }
                let submit_hash = &verify;

                println!(
                    "[FOUND] nonce={} depth={}/{} hash={} {elapsed_ms}ms",
                    hit.nonce,
                    hit.depth,
                    job.nonce_count,
                    &hex(submit_hash)[..16],
                );

                let (ok, status) = pool.submit_share(
                    job.job_id,
                    hit.nonce,
                    submit_hash,
                    hit.depth,
                    elapsed_ms,
                )?;

                if ok {
                    accepted += 1;
                    let total = accepted + rejected;
                    let pct = (accepted as f64 / total as f64) * 100.0;
                    println!(
                        "[ACCEPTED] {accepted}/{rejected} (+1) h={height} [{elapsed_ms}ms] {pct:.1}%"
                    );
                } else {
                    rejected += 1;
                    let total = accepted + rejected;
                    println!(
                        "[REJECTED] {rejected}/{total} — {status} h={height} [{elapsed_ms}ms]"
                    );
                }

                total_hashes = total_hashes.saturating_add(hit.depth);

                // Update telemetry counters
                if let Some(tc) = telemetry {
                    tc.accepted.store(accepted, Ordering::Relaxed);
                    tc.rejected.store(rejected, Ordering::Relaxed);
                    tc.total_hashes.store(total_hashes, Ordering::Relaxed);
                }
            }
            None => {
                println!(
                    "[NO_SOLUTION] h={height} nonces={nonce_start}..{nonce_end} {elapsed_ms}ms"
                );
                pool.submit_no_solution(job.job_id, job.nonce_count, elapsed_ms)?;
                total_hashes = total_hashes.saturating_add(job.nonce_count);

                // Update telemetry counters
                if let Some(tc) = telemetry {
                    tc.total_hashes.store(total_hashes, Ordering::Relaxed);
                }
            }
        }

        // Periodic stats
        let elapsed_secs = session_start.elapsed().as_secs_f64();
        if elapsed_secs > 0.0 {
            let hps = total_hashes as f64 / elapsed_secs;
            let unit = if hps > 1_000_000.0 {
                format!("{:.2} MH/s", hps / 1_000_000.0)
            } else if hps > 1_000.0 {
                format!("{:.2} kH/s", hps / 1_000.0)
            } else {
                format!("{:.0} H/s", hps)
            };
            println!(
                "[STATS] hashrate={unit} accepted={accepted} rejected={rejected} hashes={total_hashes}",
            );
        }
    }
}

// ── CLI argument parsing ──

struct Args {
    pool: String,
    wallet: String,
    worker: String,
    threads: usize,
    dashboard_url: Option<String>,
}

fn parse_args() -> Result<Args> {
    let args: Vec<String> = std::env::args().collect();

    let pool = get_arg(&args, "--pool")
        .or_else(|| std::env::var("ZION_POOL_ADDR").ok())
        .ok_or_else(|| anyhow!("--pool <host:port> required"))?;

    let wallet = get_arg(&args, "--wallet")
        .or_else(|| std::env::var("ZION_MINER_ID").ok())
        .ok_or_else(|| anyhow!("--wallet <zion1…> required"))?;

    let worker = get_arg(&args, "--worker")
        .or_else(|| std::env::var("ZION_WORKER_NAME").ok())
        .unwrap_or_else(|| "zionos".to_string());

    let threads = get_arg(&args, "--threads")
        .and_then(|s| s.parse::<usize>().ok())
        .filter(|&n| n > 0)
        .unwrap_or_else(worker::detect_threads);

    let dashboard_url = get_arg(&args, "--dashboard-url")
        .or_else(|| std::env::var("ZIONOS_DASHBOARD_URL").ok());

    // Validate wallet format
    if !wallet.starts_with("zion1") {
        eprintln!("[WARN] wallet does not start with 'zion1': {wallet}");
    }

    Ok(Args {
        pool,
        wallet,
        worker,
        threads,
        dashboard_url,
    })
}

fn get_arg(args: &[String], flag: &str) -> Option<String> {
    args.iter()
        .position(|a| a == flag)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

fn hex(data: &[u8]) -> String {
    data.iter().map(|b| format!("{b:02x}")).collect()
}
