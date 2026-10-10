//! qpow_probe — live E2E probe for QPoW (Quantus/QTU) GPU backends.
//!
//! Connects to a Quantus stratum pool via the production `AuxPowClient`
//! (QuantusStratum), waits for a job, scans the low-64 nonce space on the
//! selected `QpowGpuMiner` backend and submits every GPU hit upstream —
//! the QPoW equivalent of `eq192_probe`.
//!
//!   cargo run --release -p zion-miner --features gpu-metal \
//!       --bin qpow_probe -- [pool] [wallet]
//!
//! Defaults: pool `quantus.qelvhash.com:4444`, wallet = repo test wallet.
//!
//! Env:
//!   ZION_GPU_BACKEND          auto|metal|opencl|cuda (default auto → Metal on macOS)
//!   ZION_QPOW_PROBE_BATCH     nonces per launch (default 4194304)
//!   ZION_QPOW_PROBE_MAXSCAN   stop after N nonces (0 = until job ends / Ctrl-C)
//!   ZION_PROBE_TIMEOUT_SECS   connect/job waits (default 25)

use std::time::{Duration, Instant};

use zion_miner::auxpow::client::{AuxPowClient, AuxPowClientConfig, ShareResult};
use zion_miner::auxpow::qpow;
use zion_miner::gpu::QpowGpuMiner;
use zion_miner::auxpow::ExternalCoin;

const DEFAULT_POOL: &str = "quantus.qelvhash.com:4444";
const DEFAULT_WALLET: &str = "qzkeicNBtW2AG2E7USjDcLzAL8d9WxTZnV2cbtXoDzWxzpHC2";

/// Expected work for a U512 target ≈ 2^512 / T — counting the leading zero
/// bits gives the answer within a factor of two.
fn expected_hashes(target: &[u8; 64]) -> f64 {
    let mut zeros = 0u32;
    for &b in target.iter() {
        if b == 0 {
            zeros += 8;
        } else {
            zeros += b.leading_zeros();
            break;
        }
    }
    2f64.powi(zeros as i32)
}

fn pick_backend(kind: &str) -> &'static str {
    match kind {
        "metal" | "opencl" | "cuda" => match kind {
            "metal" => "metal",
            "opencl" => "opencl",
            _ => "cuda",
        },
        _ => "auto",
    }
}

fn make_miner(kind: &str, work_size: usize) -> anyhow::Result<QpowGpuMiner> {
    let want = pick_backend(kind);
    // Auto order: Metal (macOS) → OpenCL → CUDA — same as the runtime.
    #[cfg(all(feature = "gpu-metal", target_os = "macos"))]
    if matches!(want, "auto" | "metal") {
        match zion_miner::gpu::qpow_metal::QpowMetalMiner::new(work_size) {
            Ok(m) => return Ok(QpowGpuMiner::Metal(m)),
            Err(e) => {
                if want == "metal" {
                    return Err(e);
                }
                eprintln!("metal init failed, falling back: {e}");
            }
        }
    }
    #[cfg(feature = "gpu-opencl")]
    if matches!(want, "auto" | "opencl") {
        match zion_miner::gpu::qpow_opencl::QpowOpenclMiner::new(work_size) {
            Ok(m) => return Ok(QpowGpuMiner::OpenCl(m)),
            Err(e) => {
                if want == "opencl" {
                    return Err(e);
                }
                eprintln!("opencl init failed, falling back: {e}");
            }
        }
    }
    #[cfg(feature = "gpu-cuda")]
    if matches!(want, "auto" | "cuda") {
        let dev = cudarc::driver::CudaDevice::new(0)
            .map_err(|e| anyhow::anyhow!("CUDA device init: {e}"))?;
        return zion_miner::gpu::qpow_cuda::QpowCudaMiner::new_with_device(work_size, dev)
            .map(QpowGpuMiner::Cuda);
    }
    anyhow::bail!("no QPoW GPU backend available for ZION_GPU_BACKEND={kind}")
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.iter().any(|a| a == "-h" || a == "--help") {
        eprintln!("usage: qpow_probe [pool] [wallet]");
        eprintln!("  env: ZION_GPU_BACKEND, ZION_QPOW_PROBE_BATCH, ZION_QPOW_PROBE_MAXSCAN, ZION_PROBE_TIMEOUT_SECS");
        std::process::exit(2);
    }
    let pool = args.get(0).cloned().unwrap_or_else(|| DEFAULT_POOL.into());
    let wallet = args.get(1).cloned().unwrap_or_else(|| DEFAULT_WALLET.into());

    let batch: u64 = std::env::var("ZION_QPOW_PROBE_BATCH")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1 << 22);
    let max_scan: u64 = std::env::var("ZION_QPOW_PROBE_MAXSCAN")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);
    let timeout_secs: u64 = std::env::var("ZION_PROBE_TIMEOUT_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(25);
    let backend = std::env::var("ZION_GPU_BACKEND").unwrap_or_else(|_| "auto".into());

    let _ = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .try_init();

    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("tokio runtime");

    let code = rt.block_on(run(
        &pool, &wallet, &backend, batch, max_scan, timeout_secs,
    ));
    std::process::exit(code);
}

async fn run(
    pool: &str,
    wallet: &str,
    backend: &str,
    batch: u64,
    max_scan: u64,
    timeout_secs: u64,
) -> i32 {
    let timeout = Duration::from_secs(timeout_secs);
    let cfg = AuxPowClientConfig::new(ExternalCoin::Quantus, pool, "probe", "x");
    let client = AuxPowClient::new(cfg);

    eprintln!("qpow_probe: pool={pool} wallet={} backend={backend} batch={batch}",
        &wallet[..wallet.len().min(16)]);
    if let Err(e) = tokio::time::timeout(timeout, client.connect(wallet)).await {
        eprintln!("connect timeout/err on {pool}: {e:?}");
        return 1;
    }

    let mut miner = match make_miner(backend, batch as usize) {
        Ok(m) => m,
        Err(e) => {
            eprintln!("GPU init failed: {e}");
            return 1;
        }
    };
    eprintln!("gpu device=\"{}\"", miner.device_name());

    let mut scanned_total = 0u64;
    let mut shares = (0u32, 0u32, 0u32); // accepted, rejected, unknown
    let t_start = Instant::now();

    'jobs: loop {
        let job = match tokio::time::timeout(timeout, client.wait_for_job(timeout)).await {
            Ok(Ok(j)) => j,
            Ok(Err(e)) => {
                eprintln!("job error: {e}");
                return 1;
            }
            Err(_) => {
                eprintln!("job timeout after {}s", timeout_secs);
                return 1;
            }
        };
        let target = match job.target_512 {
            Some(t) => t,
            None => {
                eprintln!("job {} missing target_512 — not a QPoW job?", job.job_id);
                return 1;
            }
        };
        if job.header_bytes.len() != 32 {
            eprintln!("job {} header {}B != 32B", job.job_id, job.header_bytes.len());
            return 1;
        }
        let mut header = [0u8; 32];
        header.copy_from_slice(&job.header_bytes);
        let expected = expected_hashes(&target);
        eprintln!(
            "JOB id={} header={}.. target={}.. en1={} expected≈2^{:.0} hashes (~{:.0}s @7MH/s)",
            job.job_id,
            &job.header_hex[..job.header_hex.len().min(16)],
            &job.target_hex[..job.target_hex.len().min(16)],
            hex::encode(&job.extranonce1),
            expected.log2(),
            expected / 6.9e6,
        );

        // Fresh nonce cursor per job (extranonce is per-connection, header
        // changed → the prestate must be recomputed anyway).
        let mut cursor: u64 = 0;
        loop {
            if max_scan > 0 && scanned_total >= max_scan {
                break 'jobs;
            }
            // Bail to the job loop when the pool rotated to a new job.
            if let Some(latest) = client.latest_job_id().await {
                if latest != job.job_id {
                    eprintln!("job rotated {} → {}", job.job_id, latest);
                    continue 'jobs;
                }
            }
            let nonce_base = qpow::build_nonce(&job.extranonce1, cursor);
            let t0 = Instant::now();
            let res = match miner.mine_batch(&header, &nonce_base, &target, batch) {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("mine_batch error: {e}");
                    return 1;
                }
            };
            let dt = t0.elapsed();
            scanned_total += batch;
            cursor = cursor.wrapping_add(batch);
            let rate = batch as f64 / dt.as_secs_f64() / 1e6;
            if scanned_total % (batch * 10) == 0 || res.is_some() {
                eprintln!(
                    "  scanned {}M total, last batch {:.2} MH/s",
                    scanned_total / 1_000_000,
                    rate
                );
            }
            if let Some(hit) = res {
                eprintln!(
                    "HIT job={} nonce={} hash={} — submitting",
                    job.job_id,
                    hex::encode(hit.nonce),
                    hex::encode(hit.hash)
                );
                match client
                    .submit_qpow_share(&job.job_id, &hit.nonce, &hit.hash)
                    .await
                {
                    Ok(ShareResult::Accepted) => {
                        shares.0 += 1;
                        eprintln!("SUBMIT verdict=Accepted ✓");
                    }
                    Ok(ShareResult::Rejected(r)) => {
                        shares.1 += 1;
                        eprintln!("SUBMIT verdict=Rejected: {r}");
                    }
                    Ok(ShareResult::Unknown) => {
                        shares.2 += 1;
                        eprintln!("SUBMIT verdict=Unknown");
                    }
                    Ok(ShareResult::NoShare) | Err(_) => {
                        eprintln!("SUBMIT transport error");
                    }
                }
            }
        }
    }

    let el = t_start.elapsed();
    eprintln!(
        "DONE scanned={}M elapsed={:?} avg={:.2} MH/s shares={}/{}/{} (acc/rej/unk)",
        scanned_total / 1_000_000,
        el,
        scanned_total as f64 / el.as_secs_f64() / 1e6,
        shares.0,
        shares.1,
        shares.2,
    );
    0
}
