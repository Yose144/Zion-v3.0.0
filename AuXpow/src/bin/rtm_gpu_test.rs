// RTM GPU Mining Test — OpenCL GhostRider on M1
// Tests GPU mining with real SPH core algorithms + CryptoNight (AES-based).
// Kernel: ghostrider_sph.cl + ghostrider_cn.cl + ghostrider_kernel.cl (concatenated)
//
// Usage: cargo run --features gpu-opencl --bin rtm_gpu_test

use std::sync::Arc;
use std::time::Instant;

use zion_auxpow::{AuxPowClient, CoinProfile, ExternalCoin, ShareResult};
use zion_auxpow::gpu_miner::GpuMiner;
use zion_auxpow::gpu_backend::GpuBackend;

#[tokio::main]
async fn main() {
    println!("=== RTM GPU Mining Test (OpenCL on M1) ===");

    let mut profile = CoinProfile::default_for(ExternalCoin::RTM);
    profile.pool_host = "ghostrider.eu.mine.zpool.ca".to_string();
    profile.pool_port = 5354;
    profile.worker_name = "gpu_test".to_string();
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

    // Initialize GPU miner
    println!("Initializing OpenCL GPU miner...");
    let mut gpu = match GpuMiner::new() {
        Ok(g) => {
            println!("GPU miner initialized: device={}", g.device_name());
            g
        }
        Err(e) => {
            eprintln!("GPU init failed: {}", e);
            return;
        }
    };

    let start = Instant::now();
    let mut current_job = initial_job;
    let mut nonce_base: u64 = 0;
    let batch_size: u64 = 512; // Capped at 512 (2MB scratchpad per work-item = 1GB total)
    let mut total_hashes: u64 = 0;
    let mut shares_found: u64 = 0;
    let mut shares_accepted: u64 = 0;
    let mut shares_rejected: u64 = 0;
    let mut last_stats = Instant::now();
    let mut last_hashes: u64 = 0;

    println!("Mining with OpenCL GhostRider (batch_size={})...", batch_size);

    loop {
        // Check for updated job
        if let Some(new_job) = client.current_job().await {
            if new_job.job_id != current_job.job_id {
                println!(
                    "  new job: {} -> {} (target={}..)",
                    current_job.job_id,
                    new_job.job_id,
                    hex::encode(&new_job.target_bytes[..8])
                );
                current_job = new_job;
                nonce_base = 0;
            }
        }

        let header = &current_job.header_bytes;
        let target = current_job.target_bytes;
        let mut target_arr = [0u8; 32];
        let tlen = target.len().min(32);
        target_arr[..tlen].copy_from_slice(&target[..tlen]);
        let job_id = current_job.job_id.clone();

        // Run GPU mining
        match gpu.mine("ghostrider", header, &[], &target_arr, nonce_base, batch_size) {
            Ok(Some(share)) => {
                shares_found += 1;
                let nonce = share.nonce;
                let hash = &share.hash;
                total_hashes += batch_size;
                println!(
                    "GPU FOUND nonce={} hash={} job={}",
                    nonce, hex::encode(&hash[..]), job_id
                );

                // Submit share
                let hash_hex = hex::encode(&hash[..]);
                match client.submit_share(&job_id, nonce, &hash_hex, None).await {
                    Ok(ShareResult::Accepted) => {
                        shares_accepted += 1;
                        println!("*** SHARE ACCEPTED! ***");
                    }
                    Ok(ShareResult::Rejected(reason)) => {
                        shares_rejected += 1;
                        println!("*** SHARE REJECTED: {} ***", reason);
                    }
                    Ok(other) => println!("Share result: {:?}", other),
                    Err(e) => println!("Submit error: {}", e),
                }
                nonce_base += batch_size;
            }
            Ok(None) => {
                // No share found in this batch
                total_hashes += batch_size;
                nonce_base += batch_size;
            }
            Err(e) => {
                eprintln!("GPU mining error: {}", e);
                // Try to continue
                nonce_base += batch_size;
            }
        }

        // Print stats every 5 seconds
        if last_stats.elapsed() >= std::time::Duration::from_secs(5) {
            let delta = total_hashes - last_hashes;
            let elapsed = last_stats.elapsed().as_secs_f64();
            let hps = delta as f64 / elapsed;
            let total_elapsed = start.elapsed().as_secs_f64();
            let total_hps = total_hashes as f64 / total_elapsed;
            println!(
                "  [stats] {:.0} H/s (5s) | {:.0} H/s (total) | {} hashes | {} found | {} accepted | {} rejected | job={}",
                hps, total_hps, total_hashes, shares_found, shares_accepted, shares_rejected, job_id
            );
            last_hashes = total_hashes;
            last_stats = Instant::now();
        }

        // Stop after 10 minutes
        if start.elapsed() > std::time::Duration::from_secs(600) {
            println!("Stopping after 10 minutes...");
            break;
        }
    }

    let elapsed = start.elapsed().as_secs_f64();
    println!(
        "\nFinal: {} hashes in {:.1}s ({:.0} H/s) | {} found | {} accepted | {} rejected",
        total_hashes, elapsed, total_hashes as f64 / elapsed,
        shares_found, shares_accepted, shares_rejected
    );

    let _ = client.disconnect().await;
    println!("Done.");
}
