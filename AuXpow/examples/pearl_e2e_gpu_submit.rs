//! Live E2E: 2miners PRL pool + GPU PoUW mining + mining.submit.
//!
//! Connects to 2miners (prl.2miners.com:1818), receives mining.notify, runs GPU PoUW pipeline
//! via submit_share (which mines internally with GPU), submits via mining.submit.
//!
//! Usage:
//!   cargo run --release --features gpu-opencl --example pearl_e2e_gpu_submit
use std::time::Duration;
use tokio::time::sleep;

#[tokio::main]
async fn main() {
    let profile = zion_auxpow::types::CoinProfile::default_for(zion_auxpow::types::ExternalCoin::PRL);
    println!("Pool: {}:{}", profile.pool_host, profile.pool_port);

    let client = zion_auxpow::auxpow_client::AuxPowClient::new(profile);

    // Enable GPU OpenCL backend BEFORE connect
    #[cfg(feature = "gpu-opencl")]
    let client = client.with_gpu_opencl().await;

    let wallet = "prl1pk5t3amreqnqlp0q0l5zcauy2nyszlalux3rlcw93spwtr9mrlywsdesmmp";
    println!("Connecting to 2miners PRL pool...");
    client.connect(wallet).await.expect("connect failed");
    println!("Connected and authorized!");

    // Wait for mining.notify
    let mut got_job = false;
    for i in 0..15 {
        sleep(Duration::from_secs(2)).await;
        let job = client.current_job().await;
        if let Some(j) = job {
            println!("\n[{}s] Job received:", i*2);
            println!("  job_id:     {}", j.job_id);
            println!("  header_len: {} bytes", j.header_bytes.len());
            println!("  height:     {:?}", j.block_number);
            println!("  target:     {:.40}", j.target_hex);
            got_job = true;
            break;
        }
        println!("[{}s] No job yet...", i*2);
    }

    if !got_job {
        println!("\nNo job received after 30s. Exiting.");
        return;
    }

    // Mining loop: submit_share mines PoUW internally (with GPU) and submits
    println!("\nStarting GPU PoUW mining loop (submit_share)...");
    let mut attempts = 0u64;
    let mut accepted = 0u64;
    let mut rejected = 0u64;
    let start = std::time::Instant::now();

    loop {
        attempts += 1;
        let t0 = std::time::Instant::now();

        // Get current job_id from the poll loop
        let job_id = client.current_job().await
            .map(|j| j.job_id.clone())
            .unwrap_or_else(|| "auto".to_string());

        match client.submit_share(&job_id, 0, "", None).await {
            Ok(zion_auxpow::auxpow_client::ShareResult::Accepted) => {
                accepted += 1;
                let elapsed_ms = t0.elapsed().as_secs_f64() * 1000.0;
                let total = start.elapsed().as_secs();
                println!(
                    "\n[{}s] *** SHARE ACCEPTED! *** attempt={} time={:.1}ms accepted={}",
                    total, attempts, elapsed_ms, accepted
                );
            }
            Ok(zion_auxpow::auxpow_client::ShareResult::Rejected(reason)) => {
                rejected += 1;
                let total = start.elapsed().as_secs();
                println!(
                    "[{}s] attempt={} rejected: {} (accepted={} rejected={})",
                    total, attempts, reason, accepted, rejected
                );
            }
            Ok(zion_auxpow::auxpow_client::ShareResult::NoShare) => {
                let total = start.elapsed().as_secs();
                if attempts % 5 == 0 || total > 0 {
                    println!(
                        "[{}s] call={} no share found (mining... accepted={} rejected={})",
                        total, attempts, accepted, rejected
                    );
                }
                // Brief cooldown to prevent GPU thermal issues
                sleep(Duration::from_millis(500)).await;
            }
            Ok(zion_auxpow::auxpow_client::ShareResult::Unknown) => {
                let total = start.elapsed().as_secs();
                if attempts % 5 == 0 {
                    println!(
                        "[{}s] attempt={} unknown result (accepted={} rejected={})",
                        total, attempts, accepted, rejected
                    );
                }
            }
            Err(e) => {
                let total = start.elapsed().as_secs();
                println!("[{}s] attempt={} error: {}", total, attempts, e);
                sleep(Duration::from_secs(2)).await;
            }
        }

        let total = start.elapsed().as_secs();
        if total > 300 || accepted >= 5 {
            break;
        }
    }

    println!("\n=== Mining Summary ===");
    println!("Total attempts: {}", attempts);
    println!("Accepted:       {}", accepted);
    println!("Rejected:       {}", rejected);
    println!("Duration:       {}s", start.elapsed().as_secs());
    println!("Rate:           {:.1} attempts/s", attempts as f64 / start.elapsed().as_secs_f64());

    println!("\nE2E GPU submit test complete!");
}
