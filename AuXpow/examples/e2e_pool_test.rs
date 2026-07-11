//! AuXpow Phase 1 E2E test.
//!
//! Connects to a real external Stratum pool, verifies subscribe/authorize/job
//! flow, optionally mines a few nonces, and optionally submits a share if one
//! is found.
//!
//! SAFETY: the example requires `AUXPOW_E2E_RUN=1` to start.  Mining and share
//! submission are opt-in via environment variables so the user must explicitly
//! enable each phase.
//!
//! Environment variables:
//!   AUXPOW_E2E_RUN=1              — required to run at all
//!   AUXPOW_E2E_COIN=dcr            — coin to test (default: dcr)
//!   AUXPOW_E2E_WALLET=bc1q...      — payout wallet (default: design-doc wallet)
//!   AUXPOW_E2E_POOL=host:port      — optional pool override
//!   AUXPOW_E2E_WORKER=zion_e2e     — worker name (default: zion_e2e)
//!   AUXPOW_E2E_MINE_SECS=0         — how many seconds to mine (default: 0)
//!   AUXPOW_E2E_SUBMIT=0            — set to 1 to actually submit shares
//!   AUXPOW_E2E_JOB_TIMEOUT_MS=30000 — how long to wait for first job

use std::sync::Arc;
use std::time::{Duration, Instant};

use zion_auxpow::{AuxPowClient, CoinProfile, ExternalCoin};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if std::env::var("AUXPOW_E2E_RUN").unwrap_or_default() != "1" {
        eprintln!(
            "Safety stop: set AUXPOW_E2E_RUN=1 to execute this real-pool E2E test."
        );
        eprintln!("See the top of examples/e2e_pool_test.rs for all env variables.");
        std::process::exit(1);
    }

    let coin = parse_coin();
    let wallet = std::env::var("AUXPOW_E2E_WALLET")
        .unwrap_or_else(|_| "bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh".to_string());
    let worker = std::env::var("AUXPOW_E2E_WORKER").unwrap_or_else(|_| "zion_e2e".to_string());
    let mine_secs = parse_u64("AUXPOW_E2E_MINE_SECS", 0);
    let submit_enabled = std::env::var("AUXPOW_E2E_SUBMIT").unwrap_or_default() == "1";
    let job_timeout_ms = parse_u64("AUXPOW_E2E_JOB_TIMEOUT_MS", 30_000);

    let mut profile = CoinProfile::default_for(coin);
    profile.worker_name = worker;
    if let Ok(override_addr) = std::env::var("AUXPOW_E2E_POOL") {
        if let Some(pos) = override_addr.rfind(':') {
            profile.pool_host = override_addr[..pos].to_string();
            profile.pool_port = override_addr[pos + 1..].parse().unwrap_or(profile.pool_port);
        }
    }

    println!("=== AuXpow Phase 1 E2E test ===");
    println!("coin:      {}", coin);
    println!("algorithm: {}", profile.algorithm);
    println!("pool:      {}:{}", profile.pool_host, profile.pool_port);
    println!("wallet:    {}", wallet);
    println!("worker:    {}", profile.worker_name);
    println!("mine_secs: {}", mine_secs);
    println!("submit:    {}", submit_enabled);
    println!();

    let client = Arc::new(AuxPowClient::new(profile));

    // 1) Connect + subscribe + authorize
    println!("[1/4] Connecting...");
    client.connect(&wallet).await?;
    println!("[1/4] Connected and authorized.");

    // Spawn background poll loop so mining.notify jobs are received.
    let poll_client = client.clone();
    let _poll_handle = tokio::spawn(async move {
        loop {
            if let Err(e) = poll_client.poll_messages().await {
                eprintln!("poll loop ended: {}", e);
                break;
            }
        }
    });

    // 2) Wait for first job + difficulty
    println!("[2/4] Waiting for first job (timeout {} ms)...", job_timeout_ms);
    let job = wait_for_job(client.clone(), Duration::from_millis(job_timeout_ms)).await?;
    let difficulty = client.current_difficulty().await;
    let share_target = client.share_target().await;
    println!(
        "[2/4] Received job: id={} algorithm={} header_len={} difficulty={} share_target={}",
        job.job_id,
        job.algorithm,
        job.header_bytes.len(),
        difficulty,
        hex::encode(&share_target[..4])
    );

    // 3) Optionally mine
    if mine_secs > 0 {
        println!("[3/4] Mining for up to {} seconds...", mine_secs);
        let found = mine_job(coin, &job, share_target, mine_secs).await;
        match found {
            Some((nonce, hash)) => {
                println!(
                    "[3/4] Found potential share: nonce={} hash={}",
                    nonce,
                    hex::encode(&hash[..8])
                );

                if submit_enabled {
                    println!("[4/4] Submitting share...");
                    let forwarder = zion_auxpow::ShareForwarder::new(client.clone());
                    let result = forwarder.try_forward(&job.job_id, nonce, &hash, &share_target).await?;
                    println!("[4/4] Submit result: {:?}", result);
                } else {
                    println!("[4/4] Submission skipped (AUXPOW_E2E_SUBMIT != 1).");
                }
            }
            None => {
                println!("[3/4] No share found in the scanned window.");
                println!("[4/4] Nothing to submit.");
            }
        }
    } else {
        println!("[3/4] Mining disabled (AUXPOW_E2E_MINE_SECS=0).");
        println!("[4/4] Nothing to submit.");
    }

    client.disconnect().await?;
    println!("=== E2E test finished ===");
    Ok(())
}

fn parse_coin() -> ExternalCoin {
    let s = std::env::var("AUXPOW_E2E_COIN").unwrap_or_else(|_| "dcr".to_string());
    ExternalCoin::from_str_loose(&s).unwrap_or(ExternalCoin::DCR)
}

fn parse_u64(var: &str, default: u64) -> u64 {
    std::env::var(var)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

async fn wait_for_job(
    client: Arc<AuxPowClient>,
    timeout: Duration,
) -> anyhow::Result<zion_auxpow::ExternalJob> {
    let deadline = Instant::now() + timeout;
    loop {
        if let Some(job) = client.current_job().await {
            return Ok(job);
        }
        if Instant::now() >= deadline {
            anyhow::bail!("timed out waiting for first job");
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
}

async fn mine_job(
    coin: ExternalCoin,
    job: &zion_auxpow::ExternalJob,
    share_target: [u8; 32],
    mine_secs: u64,
) -> Option<(u64, [u8; 32])> {
    let package = zion_auxpow::JobPackage {
        external_coin: coin,
        external_job_id: job.job_id.clone(),
        algorithm: job.algorithm.clone(),
        header_bytes: job.header_bytes.clone(),
        target_bytes: share_target,
        timestamp: job.timestamp.unwrap_or(0),
        start_nonce: 0,
        nonce_count: u64::MAX,
    };

    let deadline = Instant::now() + Duration::from_secs(mine_secs);
    let mut window_start: u64 = 0;
    let window_size: u64 = 100_000;

    while Instant::now() < deadline {
        let window_end = window_start + window_size;
        let result = tokio::task::spawn_blocking({
            let package = package.clone();
            move || zion_auxpow::mine(&package, window_start..window_end)
        })
        .await
        .ok()
        .and_then(|r| r.ok())
        .flatten();

        if let Some(share) = result {
            return Some((share.nonce, share.hash));
        }

        window_start = window_end;
    }

    None
}
