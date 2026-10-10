//! eq192_probe — GPU self-test + live pool probe for Equihash 192,7 (ZCL).
//!
//! The 192,7 OpenCL Wagner pipeline (csrc/opencl/equihash_kernel.cl) is
//! exercised end-to-end here before the runtime is allowed to send shares
//! upstream: every returned candidate must pass the vendored
//! `equihash::is_valid_solution(192, 7, …)` check (the impl already gates
//! on it, this is the independent verification) plus a local sha256d
//! target check.
//!
//! Modes:
//!   eq192_probe selftest [iters]
//!       Fixed 140-byte header + fake 4-byte en1, target = 2^256-1, so every
//!       batch returns the first *valid* solution.  iters default 3.
//!
//!   eq192_probe pool [host:port] [wallet] [rounds]
//!       Connect to zpool equihash192 (:2192), take real jobs, GPU-solve
//!       against the real share target and submit — prints the upstream
//!       verdict for every share that lands.
//!
//!   cargo run --release -p zion-miner --features gpu-opencl \
//!       --bin eq192_probe -- selftest 3

#[cfg(feature = "gpu-opencl")]
mod imp {
    use std::time::{Duration, Instant};
    use zion_miner::auxpow::gpu_opencl_full::ExtGpuMiner;

    pub fn run(args: &[String]) -> i32 {
        let _ = tracing_subscriber::fmt()
            .with_max_level(tracing::Level::INFO)
            .try_init();
        match args.first().map(|s| s.as_str()) {
            Some("pool") => {
                let pool = args
                    .get(1)
                    .cloned()
                    .unwrap_or_else(|| "equihash192.eu.mine.zpool.ca:2192".to_string());
                let wallet = args
                    .get(2)
                    .cloned()
                    .unwrap_or_else(|| {
                        "t1UN5WNVHvQSAfBNZVXYhNvvpJKLCK6mcmD".to_string()
                    });
                let rounds: u32 = args.get(3).and_then(|v| v.parse().ok()).unwrap_or(6);
                pool_mode(&pool, &wallet, rounds)
            }
            _ => {
                let iters: u32 = args.get(1).and_then(|v| v.parse().ok()).unwrap_or(3);
                selftest(iters)
            }
        }
    }

    /// Re-verify a returned share exactly like a paranoid upstream would:
    /// indices decode + subtree collisions + zero root, then sha256d.
    fn verify_share(
        header: &[u8; 140],
        sol_wire: &[u8],
        hash: &[u8; 32],
        target: &[u8; 32],
    ) -> String {
        // sol_wire = CompactSize len + minimal soln — strip the prefix.
        let (sol, pref) = if sol_wire.len() == 403 && sol_wire[0] == 0xfd {
            (&sol_wire[3..], "fd9001")
        } else if sol_wire.len() == 400 {
            (&sol_wire[..], "none")
        } else {
            return format!("BAD-WIRE len={} first={:02x}", sol_wire.len(), sol_wire[0]);
        };
        match equihash::is_valid_solution(
            192,
            7,
            &header[..108],
            &header[108..140],
            sol,
        ) {
            Ok(()) => {}
            Err(e) => return format!("INVALID-SOL ({e}) wireprefix={pref}"),
        }
        // share hash vs target
        let meets = (0..32)
            .rev()
            .find_map(|i| {
                if hash[i] != target[i] {
                    Some(hash[i] < target[i])
                } else {
                    None
                }
            })
            .unwrap_or(true);
        format!("VALID wireprefix={pref} meets_target={meets}")
    }

    fn selftest(iters: u32) -> i32 {
        let t0 = Instant::now();
        println!("[{:6.1}] == eq192_probe selftest: ExtGpuMiner init…", t0.elapsed().as_secs_f64());
        let mut miner = match ExtGpuMiner::new() {
            Ok(m) => m,
            Err(e) => {
                println!("GPU init failed: {e:?}");
                return 1;
            }
        };
        println!("[{:6.1}] device={}", t0.elapsed().as_secs_f64(), miner.device_name());

        // Fixed deterministic header; en1 fake 4 bytes embedded at 108..112.
        let mut header = [0u8; 140];
        header[0..4].copy_from_slice(&4u32.to_le_bytes()); // version 4
        for (i, b) in header.iter_mut().take(108).enumerate() {
            if i >= 4 {
                *b = ((i * 31 + 7) & 0xff) as u8;
            }
        }
        let en1 = [0xde, 0xad, 0xbe, 0xef];
        header[108..112].copy_from_slice(&en1);

        let target = [0xffu8; 32]; // accept every *valid* solution
        let mut ok = 0u32;
        let mut bad = 0u32;
        let mut total_ms = 0u128;
        for it in 0..iters {
            let t = Instant::now();
            let r = miner.mine("equihashzero", &header, &en1, &target, it as u64, 1);
            let ms = t.elapsed().as_millis();
            total_ms += ms;
            match r {
                Err(e) => {
                    println!("[{:6.1}] iter {it}: mine err {e:?}", t0.elapsed().as_secs_f64());
                    bad += 1;
                }
                Ok(None) => {
                    println!(
                        "[{:6.1}] iter {it}: no solution in {ms} ms",
                        t0.elapsed().as_secs_f64()
                    );
                }
                Ok(Some(fs)) => {
                    let sol = fs.solution.clone().unwrap_or_default();
                    // Rebuild hashed nonce field: en1 || nonce64le || 0s.
                    let mut h2 = header;
                    h2[112..120].copy_from_slice(&fs.nonce.to_le_bytes());
                    for b in &mut h2[120..140] {
                        *b = 0;
                    }
                    let verdict = verify_share(&h2, &sol, &fs.hash, &target);
                    println!(
                        "[{:6.1}] iter {it}: nonce={} sol={}B hash={} → {} ({ms} ms)",
                        t0.elapsed().as_secs_f64(),
                        fs.nonce,
                        sol.len(),
                        hex::encode(&fs.hash[..8]),
                        verdict,
                    );
                    if verdict.starts_with("VALID") {
                        ok += 1;
                    } else {
                        bad += 1;
                    }
                }
            }
        }
        println!(
            "[{:6.1}] == selftest done: {ok} valid, {bad} bad, avg {:.1} ms/batch",
            t0.elapsed().as_secs_f64(),
            if iters > 0 { total_ms as f64 / iters as f64 } else { 0.0 }
        );
        if bad > 0 {
            2
        } else if ok == 0 {
            3
        } else {
            0
        }
    }

    fn pool_mode(pool: &str, wallet: &str, rounds: u32) -> i32 {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("tokio runtime");
        rt.block_on(pool_async(pool, wallet, rounds))
    }

    async fn pool_async(pool: &str, wallet: &str, rounds: u32) -> i32 {
        use zion_miner::auxpow::client::{AuxPowClient, AuxPowClientConfig};

        let t0 = Instant::now();
        let ts = move || t0.elapsed().as_secs_f64();

        let coin = zion_cosmic_harmony::profit::ExternalCoin::Zclassic;
        let cfg = AuxPowClientConfig::new(coin, pool.to_string(), "eq192probe", "c=ZCL");
        let client = AuxPowClient::new(cfg);

        println!("[{:6.1}] == eq192_probe pool: connect {pool} wallet={wallet}", ts());
        if let Err(e) = tokio::time::timeout(Duration::from_secs(30), client.connect(wallet)).await {
            println!("[{:6.1}] CONNECT ERR: {e:?}", ts());
            return 1;
        }
        println!("[{:6.1}] connected proto={:?}", ts(), client.protocol());

        // One persistent GPU miner — program compile + 2.8 GB table alloc
        // happen once, not per nonce.
        let mut miner = match ExtGpuMiner::new() {
            Ok(m) => m,
            Err(e) => {
                println!("[{:6.1}] GPU init failed: {e:?}", ts());
                return 1;
            }
        };
        println!("[{:6.1}] device={}", ts(), miner.device_name());

        let mut submits = 0u32;
        let deadline = Instant::now() + Duration::from_secs(25 * 60);
        while submits < rounds && Instant::now() < deadline {
            let job = match client.wait_for_job(Duration::from_secs(90)).await {
                Ok(j) => j,
                Err(e) => {
                    println!("[{:6.1}] JOB WAIT ERR: {e}", ts());
                    break;
                }
            };
            let eqp = job.eq_params.clone().unwrap_or_default();
            let pers = job.eq_pers.clone().unwrap_or_default();
            let en1 = job.extranonce1.clone();
            println!(
                "[{:6.1}] job={} hdr={}B eq_params={} pers={} en1={}B target={}…",
                ts(),
                job.job_id,
                job.header_bytes.len(),
                eqp,
                pers,
                en1.len(),
                hex::encode(&job.target_bytes[..4]),
            );
            if job.header_bytes.len() != 140 {
                println!("[{:6.1}] !! header {}B != 140 — skip", ts(), job.header_bytes.len());
                continue;
            }
            if eqp != "192_7" {
                println!("[{:6.1}] !! eq_params={eqp} != 192_7 — skip", ts());
                continue;
            }

            // Mine nonces on this job until a share lands or ~40 s passes
            // (yiimp rotates jobs every ~30-60 s).
            let mine_deadline = Instant::now() + Duration::from_secs(40);
            let mut nonce = 0u64;
            let mut found = None;
            while found.is_none() && Instant::now() < mine_deadline {
                let r = miner.mine(
                    "equihashzero",
                    &job.header_bytes,
                    &en1,
                    &job.target_bytes,
                    nonce,
                    1,
                );
                match r {
                    Ok(Some(fs)) => {
                        let mut h2 = [0u8; 140];
                        h2.copy_from_slice(&job.header_bytes[..140]);
                        let o = 108 + en1.len();
                        h2[o..o + 8].copy_from_slice(&fs.nonce.to_le_bytes());
                        for b in &mut h2[o + 8..140] {
                            *b = 0;
                        }
                        let sol = fs.solution.clone().unwrap_or_default();
                        let verdict = verify_share(&h2, &sol, &fs.hash, &job.target_bytes);
                        println!(
                            "[{:6.1}] sol nonce={} sol={}B → {}",
                            ts(),
                            fs.nonce,
                            sol.len(),
                            verdict
                        );
                        if verdict.starts_with("VALID") {
                            found = Some(fs);
                        }
                    }
                    Ok(None) => {
                        nonce += 1;
                    }
                    Err(e) => {
                        println!("[{:6.1}] mine err: {e:?}", ts());
                        break;
                    }
                }
            }
            let Some(fs) = found else { continue };
            let sol_hex = hex::encode(fs.solution.as_deref().unwrap_or_default());
            let res = client
                .submit_share(
                    &job.job_id,
                    fs.nonce,
                    "00",
                    &job.ntime,
                    None,
                    None,
                    &sol_hex,
                    "equihashzero",
                )
                .await;
            println!("[{:6.1}] == SUBMIT job={} → {:?}", ts(), job.job_id, res);
            submits += 1;
        }
        0
    }
}

#[cfg(feature = "gpu-opencl")]
fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    std::process::exit(imp::run(&args));
}

#[cfg(not(feature = "gpu-opencl"))]
fn main() {
    eprintln!("eq192_probe requires --features gpu-opencl");
    std::process::exit(1);
}
