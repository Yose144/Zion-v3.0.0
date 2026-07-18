// RTM Live E2E Test — connect to zpool, get job, mine with GhostRider (multi-threaded), submit share
// Usage: cargo run --features native-ghostrider --bin rtm_live_test

use std::sync::Arc;
use std::time::Instant;

use zion_auxpow::{AuxPowClient, CoinProfile, ExternalCoin, ShareResult};
use zion_auxpow::external_hashers::meets_target_little_endian;

#[tokio::main]
async fn main() {
    println!("=== RTM Live E2E Test (zpool.ca:5354) — Multi-threaded ===");

    let mut profile = CoinProfile::default_for(ExternalCoin::RTM);
    profile.pool_host = "ghostrider.eu.mine.zpool.ca".to_string();
    profile.pool_port = 5354;
    profile.worker_name = "test_rig".to_string();

    let client = Arc::new(AuxPowClient::new(profile));

    let wallet = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
    println!("Connecting to zpool RTM (ghostrider.eu.mine.zpool.ca:5354)...");
    match client.connect(wallet).await {
        Ok(_) => println!("Connected!"),
        Err(e) => {
            eprintln!("Connect failed: {}", e);
            return;
        }
    }

    println!("Waiting for job (15s timeout)...");
    let job = match client.wait_for_job(15000).await {
        Ok(Some(j)) => {
            println!(
                "Got job: id={} header_len={} target={}..",
                j.job_id,
                j.header_bytes.len(),
                hex::encode(&j.target_bytes[..8.min(j.target_bytes.len())])
            );
            j
        }
        Ok(None) => {
            eprintln!("No job received");
            return;
        }
        Err(e) => {
            eprintln!("Error waiting for job: {}", e);
            return;
        }
    };

    // Mine with real GhostRider hash — multi-threaded
    #[cfg(feature = "native-ghostrider")]
    {
        zion_native_ffi::ghostrider::init();

        let header = &job.header_bytes;
        let target = &job.target_bytes;
        let nonce_offset = 76usize;
        let mut work_blob = header.clone();

        if work_blob.len() < 80 {
            work_blob.resize(80, 0);
        }

        let cpus = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(1);
        println!(
            "Mining with GhostRider ({} threads, target={}..)...",
            cpus,
            hex::encode(&target[..8.min(target.len())])
        );

        let start = Instant::now();
        let batch_size = 500_000u64;
        let mut nonce_base = 0u64;
        let mut found: Option<(u64, [u8; 32])> = None;

        // Mine in batches, checking for new jobs between batches
        while nonce_base < 50_000_000 {
            let batch_end = nonce_base + batch_size;

            // Multi-threaded scan of this batch
            let chunk = batch_size / cpus as u64;
            let mut per_thread: Vec<Option<(u64, [u8; 32])>> = vec![None; cpus];

            std::thread::scope(|s| {
                for (idx, slot) in per_thread.iter_mut().enumerate() {
                    let idx = idx as u64;
                    let t_start = nonce_base + idx * chunk;
                    let t_end = (t_start + chunk).min(batch_end);
                    if t_start >= t_end {
                        continue;
                    }
                    let mut work = work_blob.clone();
                    let target = *target;
                    s.spawn(move || {
                        for nonce in t_start..t_end {
                            let nonce_le = (nonce as u32).to_le_bytes();
                            work[nonce_offset..nonce_offset + 4].copy_from_slice(&nonce_le);
                            let hash = zion_native_ffi::ghostrider::hash(&work, nonce);
                            if meets_target_little_endian(&hash, &target) {
                                *slot = Some((nonce, hash));
                                return;
                            }
                        }
                    });
                }
            });

            // Check if any thread found a share
            for result in per_thread.into_iter().flatten() {
                found = Some(result);
                break;
            }

            if found.is_some() {
                break;
            }

            if nonce_base % 1_000_000 == 0 && nonce_base > 0 {
                println!(
                    "  scanned {} nonces in {:?} ({:.0} H/s)...",
                    nonce_base,
                    start.elapsed(),
                    nonce_base as f64 / start.elapsed().as_secs_f64()
                );
            }

            nonce_base = batch_end;
        }

        if let Some((nonce, hash)) = found {
            println!(
                "FOUND valid nonce={} in {:?} hash={}",
                nonce,
                start.elapsed(),
                hex::encode(&hash)
            );

            println!("Submitting share nonce={}...", nonce);
            let hash_hex = hex::encode(&[0u8; 32]);
            match client.submit_share(&job.job_id, nonce, &hash_hex, None).await {
                Ok(ShareResult::Accepted) => {
                    println!("*** SHARE ACCEPTED! ***");
                }
                Ok(ShareResult::Rejected(reason)) => {
                    println!("*** SHARE REJECTED: {} ***", reason);
                }
                Ok(other) => {
                    println!("*** Share result: {:?} ***", other);
                }
                Err(e) => {
                    println!("*** Submit error: {} ***", e);
                }
            }
        } else {
            println!("No valid nonce found in 50M attempts");
        }
    }

    #[cfg(not(feature = "native-ghostrider"))]
    {
        println!("native-ghostrider feature not enabled — cannot mine");
    }

    let _ = client.disconnect().await;
    println!("Done.");
}
