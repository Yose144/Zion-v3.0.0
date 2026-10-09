//! eq144_probe — live upstream wire-format probe for Equihash 144,5.
//!
//! Uses the SAME `AuxPowClient` code the pool bridge runs (parse_notify →
//! 140B header → eq144 CPU solver → canonicalize → CompactSize soln →
//! yiimp submit) but connects directly to the upstream pool, so a verdict
//! comes back in one run without an Edge deploy or a full mining session.
//!
//! zpool rotates jobs every ~30 s and a single tromp run takes ~40-100 s
//! on a contended box, so real sols usually land stale (`Invalid job id`).
//! The probe therefore ALSO runs deterministic control submits that pin
//! down the upstream check ordering without needing an in-window sol:
//!
//!   CTRL junk@jobN   — 0x64+100 zero bytes under the given job id
//!   CTRL raw@jobN    — 100 zero bytes, NO CompactSize prefix
//!   CTRL sol@jobM    — a REAL locally-verified soln under a different job
//!
//! Reading the matrix:
//!   junk@stale → "Invalid job id"   = job lookup precedes soln checks
//!   junk@fresh → soln-level error   = soln parse path reached on live job
//!   sol@fresh  → soln-level error   = soln parsed, verify ran, header
//!                                      mismatch caught — i.e. the wire
//!                                      format IS being decoded upstream.
//!
//!   cargo run --release -p zion-miner --bin eq144_probe -- [pool] [wallet] [threads] [verdicts]
//!   default: eq144_probe equihash192.eu.mine.zpool.ca:2144 <pool-btc-wallet> 4 30
//!
//! Verdicts on REAL sols: `Accepted` = done; `low difficulty`/`High hash`
//! = format OK; `OutOfOrder`/malformed = soln encoding broken;
//! `Invalid job id` = stale — sol landed after rotation.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let pool = args
        .first()
        .cloned()
        .unwrap_or_else(|| "equihash192.eu.mine.zpool.ca:2144".to_string());
    let wallet = args
        .get(1)
        .cloned()
        .unwrap_or_else(|| "bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh".to_string());
    let threads: usize = args.get(2).and_then(|v| v.parse().ok()).unwrap_or(4);
    let verdicts_wanted: u32 = args.get(3).and_then(|v| v.parse().ok()).unwrap_or(30);

    let _ = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::WARN)
        .try_init();

    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("tokio runtime");

    let code = rt.block_on(run(&pool, &wallet, threads, verdicts_wanted));
    std::process::exit(code);
}

struct FoundSol {
    job_id: String,
    header_hex: String,
    ntime: String,
    algo: String,
    nonce: u64,
    sol_wire: Vec<u8>,
    hash: [u8; 32],
    meets_real: bool,
}

#[derive(Clone)]
struct JobForSolvers {
    job_id: String,
    header: Vec<u8>,
    header_hex: String,
    ntime: String,
    algo: String,
    target: [u8; 32],
    en1_len: usize,
    pers: Vec<u8>,
}

/// A submitted share's wire fields, for control probes.
struct CtxJob {
    job_id: String,
    header_hex: String,
    ntime: String,
    algo: String,
    age_s: f64,
}

async fn run(pool: &str, wallet: &str, threads: usize, verdicts_wanted: u32) -> i32 {
    use zion_miner::auxpow::client::{AuxPowClient, AuxPowClientConfig};
    use zion_miner::auxpow::equihash144 as eq;

    let t0 = Instant::now();
    let ts = move || t0.elapsed().as_secs_f64();

    let coin = zion_cosmic_harmony::profit::ExternalCoin::Zclassic;
    let cfg = AuxPowClientConfig::new(coin, pool.to_string(), "eq144probe", "c=BTC");
    let client = AuxPowClient::new(cfg);

    println!("[{:6.1}] == eq144_probe: connect {pool} wallet={wallet} threads={threads}", ts());
    if let Err(e) = tokio::time::timeout(Duration::from_secs(30), client.connect(wallet)).await
    {
        println!("[{:6.1}] CONNECT TIMEOUT/ERR: {e:?}", ts());
        return 1;
    }
    println!("[{:6.1}] connected proto={:?}", ts(), client.protocol());

    let (sol_tx, mut sol_rx) = tokio::sync::mpsc::unbounded_channel::<FoundSol>();
    let stop = Arc::new(AtomicBool::new(false));
    let new_job_flag = Arc::new(AtomicU64::new(0));
    let nonce_seed = Arc::new(AtomicU64::new(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos() as u64 ^ d.as_secs() << 20)
            .unwrap_or(0x5eed),
    ));

    // Spawn the solver team once; they wait on a shared "current job" cell.
    let cur_job = Arc::new(std::sync::Mutex::new(None::<JobForSolvers>));
    for ti in 0..threads {
        let (tx, stop, cur_job, flag, seed) = (
            sol_tx.clone(),
            Arc::clone(&stop),
            Arc::clone(&cur_job),
            Arc::clone(&new_job_flag),
            Arc::clone(&nonce_seed),
        );
        std::thread::spawn(move || {
            let mut solver = match eq::Solver::new() {
                Some(s) => s,
                None => {
                    eprintln!("solver alloc failed on thread {ti}");
                    return;
                }
            };
            let cancel = AtomicBool::new(false);
            let mut seen_gen = 0u64;
            loop {
                if stop.load(Ordering::Relaxed) {
                    return;
                }
                let g = flag.load(Ordering::Relaxed);
                if g == seen_gen {
                    std::thread::sleep(Duration::from_millis(25));
                    continue;
                }
                seen_gen = g;
                let job = match cur_job.lock().unwrap().clone() {
                    Some(j) => j,
                    None => continue,
                };
                let en1_len = job.en1_len;
                let pers8 = job.pers.clone();
                // Disjoint nonce windows per worker — stride by thread id in
                // the top byte so two workers never share a nonce.
                let base = seed
                    .fetch_add(1 << 20, Ordering::Relaxed)
                    .wrapping_add((ti as u64) << 56);
                let mut cursor = base;
                loop {
                    if stop.load(Ordering::Relaxed) {
                        return;
                    }
                    if flag.load(Ordering::Relaxed) != seen_gen {
                        break; // fresh job arrived — rescan its state
                    }
                    let res = eq::scan(
                        &mut solver,
                        &job.header,
                        en1_len,
                        &pers8,
                        &[0xffu8; 32], // first valid sol returns (wire probe)
                        cursor,
                        1, // one nonce per call → ~1-run job-change latency
                        &cancel,
                    );
                    cursor = cursor.wrapping_add(1);
                    if let Some((nonce, sol_wire, hash)) = res {
                        let _ = tx.send(FoundSol {
                            job_id: job.job_id.clone(),
                            header_hex: job.header_hex.clone(),
                            ntime: job.ntime.clone(),
                            algo: job.algo.clone(),
                            nonce,
                            sol_wire,
                            hash,
                            meets_real: zion_miner::auxpow::hasher::meets_target(
                                &hash,
                                &job.target,
                            ),
                        });
                    }
                }
            }
        });
    }

    // soln wire variants for control probes
    let junk_prefixed = {
        let mut v = vec![0x64u8];
        v.extend(std::iter::repeat(0u8).take(100));
        hex::encode(&v) // 101B, CompactSize 0x64 — parseable shape, junk indices
    };
    let junk_raw = hex::encode(&[0u8; 100]); // 100B, no prefix
    let junk_tiny = hex::encode(&[0u8; 8]); // 8B — structurally malformed

    let mut verdicts = 0u32;
    let mut active_job = String::new();
    let mut recent: VecDeque<(String, CtxJob)> = VecDeque::new(); // (recv_key, ctx)
    let mut last_real_sol: Option<FoundSol> = None;
    let mut job_born = Instant::now();
    let deadline = Instant::now() + Duration::from_secs(20 * 60);
    while verdicts < verdicts_wanted && Instant::now() < deadline {
        tokio::select! {
            job = client.wait_for_job(Duration::from_secs(90)) => {
                let job = match job {
                    Ok(j) => j,
                    Err(e) => { println!("[{:6.1}] JOB WAIT ERR: {e}", ts()); break; }
                };
                if job.header_bytes.len() != eq::HEADER_LEN {
                    println!("[{:6.1}] !! header {}B != 140 — parser bug", ts(), job.header_bytes.len());
                    continue;
                }
                let pers = job.eq_pers.clone().unwrap_or_else(|| "sngemPoW".to_string());
                *cur_job.lock().unwrap() = Some(JobForSolvers {
                    job_id: job.job_id.clone(),
                    header: job.header_bytes.clone(),
                    header_hex: job.header_hex.clone(),
                    ntime: job.ntime.clone(),
                    algo: job.algorithm.clone(),
                    target: job.target_bytes,
                    en1_len: job.extranonce1.len().min(eq::NONCE_LEN - 8),
                    pers: pers.as_bytes().to_vec(),
                });
                if job.job_id != active_job {
                    println!(
                        "[{:6.1}] == fresh job id={} target={}… en1={} pers={} — solvers engaged",
                        ts(),
                        job.job_id,
                        hex::encode(&job.target_bytes[..4]),
                        hex::encode(&job.extranonce1),
                        pers,
                    );
                    active_job = job.job_id.clone();
                    job_born = Instant::now();
                    new_job_flag.fetch_add(1, Ordering::Relaxed);

                    // age all retained jobs
                    for (_, c) in recent.iter_mut() {
                        c.age_s = ts();
                    }
                    recent.push_front((
                        job.job_id.clone(),
                        CtxJob {
                            job_id: job.job_id.clone(),
                            header_hex: job.header_hex.clone(),
                            ntime: job.ntime.clone(),
                            algo: job.algorithm.clone(),
                            age_s: 0.0,
                        },
                    ));
                    while recent.len() > 3 {
                        recent.pop_back();
                    }

                    // ---- CONTROL SUBMITS ------------------------------------
                    // C2 first: a real (locally verified) soln under this
                    // FRESH job id — must parse+verify, can't match header.
                    if let Some(prev) = last_real_sol.as_ref() {
                        let r = raw_submit(
                            &client,
                            &job.job_id,
                            prev.nonce,
                            &job.ntime,
                            &job.header_hex,
                            &hex::encode(&prev.sol_wire),
                            &job.algorithm,
                        )
                        .await;
                        println!(
                            "[{:6.1}] CTRL sol@fresh job={} (sol from {}) → {:?}",
                            ts(), job.job_id, prev.job_id, r
                        );
                    }
                    // Junk soln probes under every retained job id — the
                    // verdict transition maps the eviction boundary.
                    for (idx, (_, c)) in recent.iter().enumerate() {
                        let r = raw_submit(
                            &client,
                            &c.job_id,
                            nonce_seed.fetch_add(0x1111, Ordering::Relaxed),
                            &c.ntime,
                            &c.header_hex,
                            &junk_prefixed,
                            &c.algo,
                        )
                        .await;
                        println!(
                            "[{:6.1}] CTRL junk@job[-{}] id={} → {:?}",
                            ts(), idx, c.job_id, r
                        );
                    }
                    // No-prefix variant on the fresh job — tests whether
                    // upstream requires the CompactSize length byte.
                    let r = raw_submit(
                        &client,
                        &job.job_id,
                        nonce_seed.fetch_add(0x2222, Ordering::Relaxed),
                        &job.ntime,
                        &job.header_hex,
                        &junk_raw,
                        &job.algorithm,
                    )
                    .await;
                    println!("[{:6.1}] CTRL raw@fresh job={} → {:?}", ts(), job.job_id, r);
                    // Tiny soln — must fail decode; if its verdict differs
                    // from "Invalid share", the latter is a post-decode
                    // (verify/target) rejection ⇒ our 101B soln decoded OK.
                    let r = raw_submit(
                        &client,
                        &job.job_id,
                        nonce_seed.fetch_add(0x3333, Ordering::Relaxed),
                        &job.ntime,
                        &job.header_hex,
                        &junk_tiny,
                        &job.algorithm,
                    )
                    .await;
                    println!("[{:6.1}] CTRL tiny@fresh job={} → {:?}", ts(), job.job_id, r);
                }
            }
            sol = sol_rx.recv() => {
                if let Some(sol) = sol {
                    let verdict = submit(&client, &sol, job_born.elapsed().as_secs_f64()).await;
                    println!("[{:6.1}] == VERDICT: {verdict}", ts());
                    verdicts += 1;
                    last_real_sol = Some(sol);
                } else {
                    break; // all workers gone
                }
            }
        }
    }
    stop.store(true, Ordering::Relaxed);
    0
}

/// Real-sol submit — identical to the production share path.
async fn submit(
    client: &zion_miner::auxpow::client::AuxPowClient,
    sol: &FoundSol,
    job_age_s: f64,
) -> String {
    let meets_tag = if sol.meets_real { "MEETS-TARGET" } else { "below" };
    let res = client
        .submit_share(
            &sol.job_id,
            sol.nonce,
            "00000000",
            &sol.ntime,
            None,
            Some(&format!("0x{}", sol.header_hex)),
            &hex::encode(&sol.sol_wire),
            &sol.algo,
        )
        .await;
    format!(
        "job={} nonce={} sol={}B/{:02x} hash={} [{}] job_age~{:.0}s → {:?}",
        sol.job_id,
        sol.nonce,
        sol.sol_wire.len(),
        sol.sol_wire.first().copied().unwrap_or(0),
        hex::encode(&sol.hash[..8]),
        meets_tag,
        job_age_s,
        res,
    )
}

/// Control submit — arbitrary soln hex, same underlying submit path.
async fn raw_submit(
    client: &zion_miner::auxpow::client::AuxPowClient,
    job_id: &str,
    nonce: u64,
    ntime: &str,
    header_hex: &str,
    sol_hex: &str,
    algo: &str,
) -> zion_miner::auxpow::client::ShareResult {
    client
        .submit_share(
            job_id,
            nonce,
            "00000000",
            ntime,
            None,
            Some(&format!("0x{}", header_hex)),
            sol_hex,
            algo,
        )
        .await
        .unwrap_or_else(|e| {
            zion_miner::auxpow::client::ShareResult::Rejected(format!("submit err {e}"))
        })
}
