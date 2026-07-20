// RTM Live E2E Test — connect to zpool, mine with GhostRider (multi-threaded, 8MB stack per thread)
// Usage: cargo run --features native-ghostrider --bin rtm_live_test

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Instant;

use zion_auxpow::{AuxPowClient, CoinProfile, ExternalCoin, ShareResult};
use zion_auxpow::external_hashers::meets_target_little_endian;

#[tokio::main]
async fn main() {
    println!("=== RTM Live E2E Test (zpool.ca:5354) — Multi-threaded (8MB stack) ===");

    let mut profile = CoinProfile::default_for(ExternalCoin::RTM);
    profile.pool_host = "ghostrider.eu.mine.zpool.ca".to_string();
    profile.pool_port = 5354;
    profile.worker_name = "test_rig".to_string();
    profile.password = "c=BTC,d=0.001".to_string();

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

    println!("Waiting for initial job (15s timeout)...");
    let initial_job = match client.wait_for_job(15000).await {
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

    #[cfg(feature = "native-ghostrider")]
    {
        zion_native_ffi::ghostrider::init();

        let cpus = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(1);
        println!("Mining with GhostRider ({} threads, 8MB stack each, mutex-serialized)...", cpus);

        // Print header for debugging
        println!("Header hex: {}", hex::encode(&initial_job.header_bytes));
        println!("Target hex: {}", hex::encode(&initial_job.target_bytes));

        let start = Instant::now();
        let mut total_nonces: u64 = 0;
        let mut found: Option<(String, u64, [u8; 32])> = None;

        let mut current_job = initial_job;
        let mut nonce_base = 0u64;
        let batch_per_round = 50_000u64;

        while found.is_none() && total_nonces < 100_000_000 {
            // Check for updated job from client
            if let Some(new_job) = client.current_job().await {
                if new_job.job_id != current_job.job_id {
                    println!(
                        "  switching job: {} -> {} (nonce_base reset)",
                        current_job.job_id, new_job.job_id
                    );
                    current_job = new_job;
                    nonce_base = 0;
                }
            }

            let header = current_job.header_bytes.clone();
            let target = current_job.target_bytes;
            let job_id = current_job.job_id.clone();
            let nonce_offset = 76usize;

            let batch_end = nonce_base + batch_per_round;
            let chunk = (batch_per_round + cpus as u64 - 1) / cpus as u64;

            // Use std::thread with custom stack size (CryptoNight needs 2MB+)
            let found_flag = Arc::new(AtomicBool::new(false));
            let found_nonce = Arc::new(AtomicU64::new(0));
            let found_hash = Arc::new(std::sync::Mutex::new([0u8; 32]));

            let mut handles = Vec::new();
            for i in 0..cpus {
                let i = i as u64;
                let t_start = nonce_base + i * chunk;
                let t_end = (t_start + chunk).min(batch_end);
                if t_start >= t_end {
                    continue;
                }
                let header = header.clone();
                let target = target;
                let found_flag = found_flag.clone();
                let found_nonce = found_nonce.clone();
                let found_hash = found_hash.clone();

                let handle = std::thread::Builder::new()
                    .stack_size(8 * 1024 * 1024) // 8MB stack for CryptoNight
                    .spawn(move || {
                        let mut work = header.clone();
                        if work.len() < 80 {
                            work.resize(80, 0);
                        }
                        for nonce in t_start..t_end {
                            if found_flag.load(Ordering::Relaxed) {
                                return;
                            }
                            let nonce_le = (nonce as u32).to_le_bytes();
                            work[nonce_offset..nonce_offset + 4].copy_from_slice(&nonce_le);
                            let hash = zion_native_ffi::ghostrider::hash(&work, nonce);
                            let pfx = hash[30] | hash[31];
                            if pfx == 0 && meets_target_little_endian(&hash, &target) {
                                found_flag.store(true, Ordering::Relaxed);
                                found_nonce.store(nonce, Ordering::Relaxed);
                                *found_hash.lock().unwrap() = hash;
                                return;
                            }
                        }
                    })
                    .expect("failed to spawn thread");
                handles.push(handle);
            }

            for h in handles {
                let _ = h.join();
            }

            if found_flag.load(Ordering::Relaxed) {
                let nonce = found_nonce.load(Ordering::Relaxed);
                let hash = *found_hash.lock().unwrap();
                found = Some((job_id.clone(), nonce, hash));
                break;
            }

            total_nonces += batch_per_round;
            nonce_base = batch_end;

            if total_nonces % 100_000 == 0 {
                let elapsed = start.elapsed().as_secs_f64();
                println!(
                    "  total={} nonces in {:.1}s ({:.1} H/s) job={}",
                    total_nonces, elapsed, total_nonces as f64 / elapsed, job_id
                );
            }
        }

        if let Some((job_id, nonce, hash)) = found {
            let elapsed = start.elapsed();
            println!(
                "FOUND valid nonce={} in {:?} hash={}",
                nonce, elapsed, hex::encode(&hash)
            );

            // Verify hash by recomputing in main thread
            let mut verify_blob = current_job.header_bytes.clone();
            if verify_blob.len() < 80 {
                verify_blob.resize(80, 0);
            }
            let nonce_le = (nonce as u32).to_le_bytes();
            verify_blob[76..80].copy_from_slice(&nonce_le);
            let verify_hash = zion_native_ffi::ghostrider::hash(&verify_blob, nonce);
            if verify_hash != hash {
                println!(
                    "*** HASH MISMATCH! thread={} main={} ***",
                    hex::encode(&hash), hex::encode(&verify_hash)
                );
            } else {
                println!("Hash verified OK (thread == main)");
            }

            println!("Submitting share job={} nonce={}...", job_id, nonce);
            let hash_hex = hex::encode(&[0u8; 32]);
            match client.submit_share(&job_id, nonce, &hash_hex, None).await {
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
            println!("No valid nonce found in 100M attempts");
        }
    }

    #[cfg(not(feature = "native-ghostrider"))]
    {
        println!("native-ghostrider feature not enabled — cannot mine");
    }

    let _ = client.disconnect().await;
    println!("Done.");
}
