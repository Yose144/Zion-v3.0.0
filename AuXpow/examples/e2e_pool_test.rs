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
//!   AUXPOW_E2E_COIN=dcr           — coin to test (default: dcr)
//!   AUXPOW_E2E_WALLET=bc1q...     — payout wallet (default: design-doc wallet)
//!   AUXPOW_E2E_POOL=host:port     — optional pool override
//!   AUXPOW_E2E_WORKER=zion_e2e    — worker name (default: zion_e2e)
//!   AUXPOW_E2E_PASSWORD=          — optional stratum password override
//!   AUXPOW_E2E_MINE_SECS=0        — how many seconds to mine (default: 0)
//!   AUXPOW_E2E_USE_BEST=0         — mine the best share in a fixed range (CPU only)
//!   AUXPOW_E2E_BEST_RANGE=100000000 — nonce range for best-share mode
//!   AUXPOW_E2E_SUBMIT=0           — set to 1 to actually submit shares
//!   AUXPOW_E2E_JOB_TIMEOUT_MS=30000 — how long to wait for first job
//!   AUXPOW_E2E_GPU_OPENCL=0       — set to 1 to mine on the first OpenCL GPU

use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::Context;
use zion_auxpow::{AuxPowClient, CoinProfile, ExternalCoin, ExternalJob};

#[cfg(all(feature = "gpu-opencl", feature = "native-hashers"))]
use zion_auxpow::gpu_miner::{DagManager, GpuMiner};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if std::env::var("AUXPOW_E2E_RUN").unwrap_or_default() != "1" {
        eprintln!("Safety stop: set AUXPOW_E2E_RUN=1 to execute this real-pool E2E test.");
        eprintln!("See the top of examples/e2e_pool_test.rs for all env variables.");
        std::process::exit(1);
    }

    let coin = parse_coin();
    let wallet = std::env::var("AUXPOW_E2E_WALLET")
        .unwrap_or_else(|_| "bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh".to_string());
    let worker = std::env::var("AUXPOW_E2E_WORKER").unwrap_or_else(|_| "zion_e2e".to_string());
    let password = std::env::var("AUXPOW_E2E_PASSWORD").unwrap_or_default();
    let mine_secs = parse_u64("AUXPOW_E2E_MINE_SECS", 0);
    let use_best = std::env::var("AUXPOW_E2E_USE_BEST").unwrap_or_default() == "1";
    let best_range = parse_u64("AUXPOW_E2E_BEST_RANGE", 100_000_000);
    let submit_enabled = std::env::var("AUXPOW_E2E_SUBMIT").unwrap_or_default() == "1";
    let job_timeout_ms = parse_u64("AUXPOW_E2E_JOB_TIMEOUT_MS", 30_000);
    let gpu_enabled = cfg!(all(feature = "gpu-opencl", feature = "native-hashers"))
        && std::env::var("AUXPOW_E2E_GPU_OPENCL").unwrap_or_default() == "1";

    let mut profile = CoinProfile::default_for(coin);
    profile.worker_name = worker;
    profile.password = password;
    if let Ok(override_addr) = std::env::var("AUXPOW_E2E_POOL") {
        if let Some(pos) = override_addr.rfind(':') {
            profile.pool_host = override_addr[..pos].to_string();
            profile.pool_port = override_addr[pos + 1..]
                .parse()
                .unwrap_or(profile.pool_port);
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
    println!("gpu_opencl:{}", gpu_enabled);

    // Create client
    let client = Arc::new(AuxPowClient::new(profile));

    // 1) Connect + subscribe + authorize (poll loop is spawned internally)
    println!("[1/4] Connecting...");
    client.connect(&wallet).await?;
    println!("[1/4] Connected and authorized.");

    // 2) Wait for first job + difficulty
    println!(
        "[2/4] Waiting for first job (timeout {} ms)...",
        job_timeout_ms
    );
    let job = wait_for_job(client.clone(), Duration::from_millis(job_timeout_ms)).await?;
    let difficulty = client.current_difficulty().await;

    // ── GPU pre-warming ──────────────────────────────────────────────
    // Pre-generate the DAG and pre-compile the ProgPow kernel BEFORE
    // mining starts.  This takes ~107s (DAG) + ~0.1s (kernel) on AMD Navi 10.
    // We keep the pool connection alive during pre-warming — the background
    // eth_getWork polling task (every 3s) acts as a keepalive and also
    // keeps current_job fresh.  The pre-warm GPU operations are synchronous
    // and block only the current thread; tokio's worker threads continue
    // handling network I/O (poll_messages + getWork polling).
    // The kernel cache key depends on `period = height / 50` (valid ~25 min
    // at 30s/block), and the DAG depends on the epoch (valid ~10 days), so
    // the pre-warmed artifacts remain valid when mining starts.
    let gpu_prewarmed: Option<(GpuMiner, DagManager)> = if gpu_enabled {
        #[cfg(all(feature = "gpu-opencl", feature = "native-hashers"))]
        {
            let probe_height = job.block_number.unwrap_or(1);
            let probe_epoch = job.epoch.unwrap_or((probe_height / 30000) as u32);
            let probe_algo = job.algorithm.clone();
            println!("[2.5/4] GPU pre-warm: height={} epoch={} algo={} — generating DAG + compiling kernel (connection kept alive)...", probe_height, probe_epoch, probe_algo);

            // Run pre-warm in a spawn_blocking so we don't block the tokio
            // runtime's async tasks (poll_messages, getWork polling).
            let prewarm = tokio::task::spawn_blocking(move || {
                prewarm_gpu(probe_algo, probe_height, probe_epoch)
            })
            .await
            .map_err(|e| anyhow::anyhow!("prewarm task panicked: {e}"))??;
            println!("[2.5/4] GPU pre-warm complete — ready to mine with fresh job");
            Some(prewarm)
        }
        #[cfg(not(all(feature = "gpu-opencl", feature = "native-hashers")))]
        {
            eprintln!(
                "GPU OpenCL requested but crate was not built with gpu-opencl + native-hashers"
            );
            None
        }
    } else {
        None
    };

    // Re-fetch the current job (kept fresh by background getWork polling)
    let job = client.current_job().await.unwrap_or(job);
    let difficulty = client.current_difficulty().await;
    // Use the share target derived from the pool's current difficulty.  For
    // some coins (KAS) the job already carries this target, but for others
    // (DCR/ALPH) job.target_bytes is the block target from nbits, which is
    // much harder than the share target and would cause low-difficulty rejects.
    let share_target = client.share_target().await;
    println!(
        "[2/4] Received job: id={} algorithm={} header_len={} difficulty={} share_target={}",
        job.job_id,
        job.algorithm,
        job.header_bytes.len(),
        difficulty,
        hex::encode(&share_target[..8])
    );
    println!(
        "[2/4] job header_hex={} en1={}",
        &job.header_hex,
        hex::encode(&job.extranonce1)
    );

    // 3) Optionally mine
    if mine_secs > 0 || use_best || gpu_enabled {
        println!("[3/4] Mining (gpu={} best={})...", gpu_enabled, use_best);
        let found: Option<(ExternalJob, u64, [u8; 32], Option<[u8; 32]>)> = if gpu_enabled {
            #[cfg(all(feature = "gpu-opencl", feature = "native-hashers"))]
            {
                if let Some((miner, dag_manager)) = gpu_prewarmed {
                    let mut miner = miner;
                    let mut dag_manager = dag_manager;
                    mine_gpu_prewarmed(
                        client.clone(),
                        share_target,
                        mine_secs,
                        &mut miner,
                        &mut dag_manager,
                    )
                    .await?
                } else {
                    eprintln!("GPU pre-warm failed — falling back to cold-start mine_gpu");
                    mine_gpu(client.clone(), share_target, mine_secs).await?
                }
            }
            #[cfg(not(all(feature = "gpu-opencl", feature = "native-hashers")))]
            {
                eprintln!(
                    "GPU OpenCL requested but crate was not built with gpu-opencl + native-hashers"
                );
                None
            }
        } else if use_best {
            mine_best_job(coin, client.clone(), share_target, best_range).await
        } else {
            mine_job(coin, client.clone(), share_target, mine_secs).await
        };

        match found {
            Some((job, nonce, hash, mix_hash)) => {
                println!(
                    "[3/4] Found potential share: job_id={} nonce={} hash_prefix={}",
                    job.job_id,
                    nonce,
                    hex::encode(&hash[..8])
                );

                if submit_enabled {
                    println!(
                        "[4/4] Submitting share (job_id={} nonce={} hash_prefix={})...",
                        job.job_id,
                        nonce,
                        hex::encode(&hash[..8])
                    );
                    let forwarder = zion_auxpow::ShareForwarder::new(client.clone());
                    let result = forwarder
                        .try_forward(
                            &job.job_id,
                            nonce,
                            &hash,
                            &share_target,
                            mix_hash.as_ref(),
                            None,
                            &job.algorithm,
                            &job.header_bytes,
                        )
                        .await?;
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
    client: Arc<zion_auxpow::AuxPowClient>,
    share_target: [u8; 32],
    mine_secs: u64,
) -> Option<(ExternalJob, u64, [u8; 32], Option<[u8; 32]>)> {
    let deadline = Instant::now() + Duration::from_secs(mine_secs);
    let mut window_start: u64 = 0;
    let window_size: u64 = 250_000;

    while Instant::now() < deadline {
        // Always mine on the most recent job so submissions are not stale.
        let job = client.current_job().await?;
        let package = build_package(coin, &job, share_target);

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
            return Some((job, share.nonce, share.hash, None));
        }

        window_start = window_end;
    }

    None
}

async fn mine_best_job(
    coin: ExternalCoin,
    client: Arc<zion_auxpow::AuxPowClient>,
    share_target: [u8; 32],
    best_range: u64,
) -> Option<(ExternalJob, u64, [u8; 32], Option<[u8; 32]>)> {
    let job = client.current_job().await?;
    let package = build_package(coin, &job, share_target);

    let result = tokio::task::spawn_blocking({
        let package = package.clone();
        move || zion_auxpow::mine_best(&package, 0..best_range)
    })
    .await
    .ok()
    .and_then(|r| r.ok())
    .flatten();

    if let Some(share) = result {
        println!(
            "[3/4] Best share in range: nonce={} hash_prefix={}",
            share.nonce,
            hex::encode(&share.hash[..8])
        );
        return Some((job, share.nonce, share.hash, None));
    }

    None
}

#[cfg(all(feature = "gpu-opencl", feature = "native-hashers"))]
fn prewarm_gpu(
    algorithm: String,
    probe_height: u64,
    probe_epoch: u32,
) -> anyhow::Result<(GpuMiner, DagManager)> {
    let mut miner = GpuMiner::new().context("failed to create OpenCL GPU miner")?;
    let mut dag_manager = DagManager::new();

    // Phase A: Generate the DAG for the probed epoch.
    miner.set_block_height(probe_height);
    let dag_start = Instant::now();
    dag_manager
        .ensure_dag(&mut miner, &algorithm, probe_epoch)
        .with_context(|| {
            format!(
                "prewarm_gpu: failed to ensure DAG for algorithm={} epoch={}",
                algorithm, probe_epoch
            )
        })?;
    println!(
        "[2.5/4] GPU pre-warm: DAG generated in {:.1}s",
        dag_start.elapsed().as_secs_f64()
    );

    // Phase B: Pre-compile the ProgPow kernel by running a tiny dummy mine
    // call.  The kernel compilation happens inside mine_simple → mine →
    // ensure_proque_progpow.  We use an impossible target (all zeros) so no
    // share is found, and batch_size=1 so it returns immediately after
    // compilation.
    let compile_start = Instant::now();
    let dummy_header = [0u8; 32];
    let impossible_target = [0u8; 32]; // no hash can meet this
    miner.mine_simple(&algorithm, &dummy_header, &impossible_target, 0, 1)?;
    println!(
        "[2.5/4] GPU pre-warm: kernel compiled in {:.1}s",
        compile_start.elapsed().as_secs_f64()
    );

    Ok((miner, dag_manager))
}

#[cfg(all(feature = "gpu-opencl", feature = "native-hashers"))]
async fn mine_gpu_prewarmed(
    client: Arc<zion_auxpow::AuxPowClient>,
    share_target: [u8; 32],
    mine_secs: u64,
    miner: &mut GpuMiner,
    dag_manager: &mut DagManager,
) -> anyhow::Result<Option<(ExternalJob, u64, [u8; 32], Option<[u8; 32]>)>> {
    let batch_size: u64 = parse_u64("AUXPOW_E2E_GPU_BATCH", 2_000_000);
    let mine_duration = Duration::from_secs(mine_secs.max(1));
    let deadline = Instant::now() + mine_duration;
    let mut window_start: u64 = 0;

    while Instant::now() < deadline {
        let job = match client.current_job().await {
            Some(j) => j,
            None => {
                eprintln!("[3/4] No current job — waiting 200ms...");
                tokio::time::sleep(Duration::from_millis(200)).await;
                continue;
            }
        };

        let height = job.block_number.unwrap_or(1);
        let epoch = job.epoch.unwrap_or((height / 30000) as u32);

        // Update block height for ProgPow period calculation.  If the period
        // changed since pre-warm (unlikely — period=50, ~25 min), the kernel
        // will be recompiled (100s).  The DAG epoch check is fast (cache hit).
        miner.set_block_height(height);
        dag_manager
            .ensure_dag(miner, &job.algorithm, epoch)
            .with_context(|| {
                format!(
                    "failed to ensure DAG for algorithm={} epoch={} height={}",
                    job.algorithm, epoch, height
                )
            })?;

        let batch_start = Instant::now();
        match miner.mine_simple(
            &job.algorithm,
            &job.header_bytes,
            &share_target,
            window_start,
            batch_size,
        ) {
            Ok(Some(share)) => {
                let batch_elapsed = batch_start.elapsed();
                // Check if the job is still current — a push notification may
                // have updated current_job during the GPU kernel execution.
                // If the job changed, the share is for a stale block and the
                // pool will reject it as "Job expired".
                let current = client.current_job().await;
                let job_still_current = current
                    .as_ref()
                    .map(|c| c.job_id == job.job_id)
                    .unwrap_or(false);
                if !job_still_current {
                    eprintln!(
                        "[3/4] Share found (nonce={}) but job changed during mining ({}s) — discarding stale share, retrying with fresh job",
                        share.nonce, batch_elapsed.as_secs_f64()
                    );
                    window_start = 0;
                    continue;
                }
                println!(
                    "[3/4] GPU share found: nonce={} has_mix={} (batch {:.1}s, nonce_window={})",
                    share.nonce,
                    share.mix_hash.is_some(),
                    batch_elapsed.as_secs_f64(),
                    window_start,
                );
                return Ok(Some((job, share.nonce, share.hash, share.mix_hash)));
            }
            Ok(None) => {
                let batch_elapsed = batch_start.elapsed();
                let hashrate = if batch_elapsed.as_secs_f64() > 0.0 {
                    batch_size as f64 / batch_elapsed.as_secs_f64() / 1_000_000.0
                } else {
                    0.0
                };
                eprintln!(
                    "[3/4] Batch done: window={} batch={:.1}s hashrate={:.1}MH/s",
                    window_start,
                    batch_elapsed.as_secs_f64(),
                    hashrate
                );
                window_start += batch_size;
            }
            Err(e) => {
                eprintln!("[3/4] GPU mining batch failed: {e}");
                break;
            }
        }
    }

    Ok(None)
}

#[cfg(all(feature = "gpu-opencl", feature = "native-hashers"))]
async fn mine_gpu(
    client: Arc<zion_auxpow::AuxPowClient>,
    share_target: [u8; 32],
    mine_secs: u64,
) -> anyhow::Result<Option<(ExternalJob, u64, [u8; 32], Option<[u8; 32]>)>> {
    let mut miner = GpuMiner::new().context("failed to create OpenCL GPU miner")?;
    let mut dag_manager = DagManager::new();

    let batch_size: u64 = parse_u64("AUXPOW_E2E_GPU_BATCH", 2_000_000);
    // Use an extended deadline to account for DAG generation (~16s) and
    // ProgPow kernel compilation (~100s on AMD Navi 10).  The actual mining
    // time after setup is mine_secs.
    let setup_budget = Duration::from_secs(180); // DAG + kernel compilation
    let mine_duration = Duration::from_secs(mine_secs.max(1));
    let deadline = Instant::now() + setup_budget + mine_duration;
    let mut window_start: u64 = 0;
    let mut dag_just_generated = false;

    while Instant::now() < deadline {
        let job = match client.current_job().await {
            Some(j) => j,
            None => {
                eprintln!(
                    "[3/4] No current job — waiting 200ms (deadline in {:.0}s)...",
                    (deadline - Instant::now()).as_secs_f64()
                );
                tokio::time::sleep(Duration::from_millis(200)).await;
                continue;
            }
        };

        let height = job.block_number.unwrap_or(1);
        let epoch = job.epoch.unwrap_or((height / 30000) as u32);

        eprintln!(
            "[3/4] Loop iteration: job_id={} height={} epoch={} window_start={} deadline_in={:.0}s",
            &job.job_id[..16.min(job.job_id.len())],
            height,
            epoch,
            window_start,
            (deadline - Instant::now()).as_secs_f64()
        );

        miner.set_block_height(height);
        let dag_start = Instant::now();
        dag_manager
            .ensure_dag(&mut miner, &job.algorithm, epoch)
            .with_context(|| {
                format!(
                    "failed to ensure DAG for algorithm={} epoch={} height={}",
                    job.algorithm, epoch, height
                )
            })?;
        let dag_elapsed = dag_start.elapsed();
        // If DAG generation took more than 5 seconds, the original job is
        // likely expired.  We'll still mine to verify the kernel works, but
        // we won't return this share — we'll continue to the next iteration
        // where the DAG is cached and we can mine with a fresh job.
        dag_just_generated = dag_elapsed.as_secs() > 5;

        // After DAG generation, the background eth_getWork polling task
        // (started in connect()) already updates current_job every 3 seconds.
        // Just re-fetch the latest job — don't call request_eth_getwork()
        // explicitly because some pools don't respond to explicit getWork
        // requests, causing a 60s+ blocking timeout.
        let job = match client.current_job().await {
            Some(j) => j,
            None => job, // fall back to original if no fresh job available
        };
        let height = job.block_number.unwrap_or(1);
        miner.set_block_height(height);

        match miner.mine_simple(
            &job.algorithm,
            &job.header_bytes,
            &share_target,
            window_start,
            batch_size,
        ) {
            Ok(Some(share)) => {
                println!(
                    "[3/4] GPU share found: nonce={} has_mix={} (dag_just_generated={})",
                    share.nonce,
                    share.mix_hash.is_some(),
                    dag_just_generated
                );
                if dag_just_generated {
                    // The job is likely stale — skip this share and continue
                    // mining.  On the next iteration, the DAG is cached and
                    // we'll get a fresh job.
                    eprintln!("[3/4] Skipping share (DAG was just generated, job may be stale) — continuing with fresh job...");
                    dag_just_generated = false;
                    window_start = 0; // reset nonce window for fresh job
                    continue;
                }
                return Ok(Some((job, share.nonce, share.hash, share.mix_hash)));
            }
            Ok(None) => {
                window_start += batch_size;
            }
            Err(e) => {
                eprintln!("[3/4] GPU mining batch failed: {e}");
                break;
            }
        }
    }

    Ok(None)
}

fn build_package(
    coin: ExternalCoin,
    job: &zion_auxpow::ExternalJob,
    share_target: [u8; 32],
) -> zion_auxpow::JobPackage {
    // The miner harness reuses the `timestamp` field as block height for
    // DAG-based algorithms (ProgPow/Ethash/KawPow/Autolykos).  For
    // kHeavyHash it is the real block timestamp, and Blake3 ignores it.
    let timestamp = if job.algorithm.starts_with("progpow")
        || job.algorithm == "kawpow"
        || job.algorithm == "ethash"
        || job.algorithm == "etchash"
        || job.algorithm.starts_with("autolykos")
    {
        job.block_number.unwrap_or(0)
    } else {
        job.timestamp.unwrap_or(0)
    };

    zion_auxpow::JobPackage {
        external_coin: coin,
        external_job_id: job.job_id.clone(),
        algorithm: job.algorithm.clone(),
        header_bytes: job.header_bytes.clone(),
        target_bytes: share_target,
        share_target_bytes: share_target,
        timestamp,
        block_number: job.block_number,
        extranonce1: job.extranonce1.clone(),
        start_nonce: 0,
        nonce_count: u64::MAX,
        seed_hash: None,
    }
}
