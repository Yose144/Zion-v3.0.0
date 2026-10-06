//! stratum_probe — protocol-level E2E probe for external coin pools.
//!
//! Connects to a coin's pool via the real `AuxPowClient`, authorizes with a
//! wallet string, then waits for the first job.  Reports per-coin:
//! TCP connect → protocol handshake → authorize result → first job fields.
//!
//!   cargo run --release -p zion-miner --bin stratum_probe -- COIN [pool] [wallet]
//!   auxpow_stratum_probe KAS                      # default pool + probe wallet
//!   auxpow_stratum_probe KAS kas.2miners.com:2020 kaspa:q...
//!   auxpow_stratum_probe --all                    # sweep every coin
//!
//! Env: ZION_PROBE_TIMEOUT_SECS (default 25), ZION_STRATUM_TRACE=1 for raw RX/TX.

use std::time::Duration;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.iter().any(|a| a == "-h" || a == "--help") || args.is_empty() {
        eprintln!("usage: stratum_probe [--all | COIN ...] [pool] [wallet]");
        eprintln!("  env: ZION_PROBE_TIMEOUT_SECS, ZION_STRATUM_TRACE=1");
        std::process::exit(2);
    }

    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("tokio runtime");

    if args[0] == "--all" {
        let coins = zion_cosmic_harmony::profit::ExternalCoin::ALL.to_vec();
        let code = rt.block_on(run_sweep(&coins));
        std::process::exit(code);
    }

    let coin: zion_cosmic_harmony::profit::ExternalCoin =
        args[0].parse().unwrap_or_else(|e| {
            eprintln!("unknown coin '{}': {}", args[0], e);
            std::process::exit(2);
        });
    let pool = args.get(1).cloned();
    let wallet = args.get(2).cloned().unwrap_or_else(|| "zion1probe".into());
    let code = rt.block_on(run_one(&coin, pool.as_deref(), &wallet));
    std::process::exit(code);
}

async fn run_sweep(coins: &[zion_cosmic_harmony::profit::ExternalCoin]) -> i32 {
    let mut ok = 0;
    let mut fail = 0;
    for coin in coins {
        if coin.default_pool().is_empty() {
            println!("{:<12} SKIP  no default pool", coin.as_str());
            continue;
        }
        // Probe-mode wallets are intentionally not real addresses — a pool
        // that validates formats will reject authorize; that still verifies
        // connect + handshake.  Override per-coin with a real wallet to get
        // job-level results.
        let code = run_one(coin, None, "zion1probe").await;
        if code == 0 {
            ok += 1;
        } else {
            fail += 1;
        }
    }
    println!("\n=== stratum-probe sweep: {ok} connected+job / {fail} failed ===");
    if fail > 0 {
        1
    } else {
        0
    }
}

async fn run_one(
    coin: &zion_cosmic_harmony::profit::ExternalCoin,
    pool: Option<&str>,
    wallet: &str,
) -> i32 {
    use zion_miner::auxpow::client::{AuxPowClient, AuxPowClientConfig};

    let pool_addr = pool
        .map(str::to_string)
        .unwrap_or_else(|| coin.default_pool().to_string());
    if pool_addr.is_empty() {
        println!("{:<12} SKIP  no default pool", coin.as_str());
        return 3;
    }

    let timeout_secs: u64 = std::env::var("ZION_PROBE_TIMEOUT_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(25);

    let cfg = AuxPowClientConfig::new(*coin, pool_addr.clone(), "probe", "x");
    let client = AuxPowClient::new(cfg);

    let t0 = std::time::Instant::now();
    let conn = tokio::time::timeout(
        Duration::from_secs(timeout_secs),
        client.connect(wallet),
    )
    .await;
    match conn {
        Err(_) => {
            println!(
                "{:<12} TIMEOUT connect {} ({}s)",
                coin.as_str(),
                pool_addr,
                timeout_secs
            );
            return 1;
        }
        Ok(Err(e)) => {
            println!("{:<12} CONN-ERR {} — {}", coin.as_str(), pool_addr, e);
            return 1;
        }
        Ok(Ok(())) => {}
    }
    let conn_ms = t0.elapsed().as_millis();

    let diff = client.current_difficulty().await;
    let en1 = client.extranonce1().await;
    let job = tokio::time::timeout(
        Duration::from_secs(timeout_secs),
        client.wait_for_job(Duration::from_secs(timeout_secs)),
    )
    .await;

    match job {
        Ok(Ok(j)) => {
            println!(
                "{:<12} OK    proto={} pool={} conn={}ms diff={} en1={} job_id={} header={}B target={}B seed={:?} blk={:?}",
                coin.as_str(),
                client.protocol().as_str(),
                pool_addr,
                conn_ms,
                diff,
                hex::encode(&en1),
                j.job_id,
                j.header_bytes.len(),
                j.target_bytes.len(),
                j.seed_hash.as_deref().map(|s| &s[..s.len().min(16)]),
                j.block_number,
            );
            0
        }
        Ok(Err(e)) => {
            println!(
                "{:<12} JOB-ERR {} proto={} diff={} — {}",
                coin.as_str(),
                pool_addr,
                client.protocol().as_str(),
                diff,
                e
            );
            1
        }
        Err(_) => {
            println!(
                "{:<12} JOB-TIMEOUT {} proto={} diff={} (authorized, no job in {}s)",
                coin.as_str(),
                pool_addr,
                client.protocol().as_str(),
                diff,
                timeout_secs
            );
            1
        }
    }
}
