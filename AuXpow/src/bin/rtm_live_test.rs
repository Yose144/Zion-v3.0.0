// RTM Live E2E Test — connect to zpool, get job, mine with GhostRider, submit share
// Usage: cargo run --features native-ghostrider --bin rtm_live_test

use std::sync::Arc;
use std::time::Instant;

use zion_auxpow::{AuxPowClient, CoinProfile, ExternalCoin, ShareResult};
use zion_auxpow::external_hashers::meets_target_little_endian;

#[tokio::main]
async fn main() {
    println!("=== RTM Live E2E Test (zpool.ca:5354) ===");

    let mut profile = CoinProfile::default_for(ExternalCoin::RTM);
    profile.pool_host = "ghostrider.eu.mine.zpool.ca".to_string();
    profile.pool_port = 5354;
    profile.worker_name = "test_rig".to_string();

    let client = Arc::new(AuxPowClient::new(profile));

    // zpool requires a BTC payout address as the "wallet" username.
    // Using a well-known burn address for testing — shares should be accepted
    // but payout goes nowhere. This tests the mining/submit pipeline only.
    let wallet = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
    println!("Connecting to zpool RTM (ghostrider.eu.mine.zpool.ca:5354)...");
    match client.connect(wallet).await {
        Ok(_) => println!("Connected!"),
        Err(e) => {
            eprintln!("Connect failed: {}", e);
            return;
        }
    }

    // Wait for job
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

    // Mine with real GhostRider hash
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

        println!(
            "Mining with GhostRider (header={}.. target={}..)...",
            hex::encode(&header[..16.min(header.len())]),
            hex::encode(&target[..8.min(target.len())])
        );

        let start = Instant::now();
        let mut found: Option<u64> = None;

        for nonce in 0u64..50_000_000u64 {
            let nonce_le = (nonce as u32).to_le_bytes();
            work_blob[nonce_offset..nonce_offset + 4].copy_from_slice(&nonce_le);

            let hash = zion_native_ffi::ghostrider::hash(&work_blob, nonce);

            if meets_target_little_endian(&hash, target) {
                found = Some(nonce);
                println!(
                    "FOUND valid nonce={} in {:?} hash={}",
                    nonce,
                    start.elapsed(),
                    hex::encode(&hash)
                );
                break;
            }

            if nonce % 50000 == 0 && nonce > 0 {
                println!("  scanned {} nonces in {:?}...", nonce, start.elapsed());
            }
        }

        if let Some(nonce) = found {
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
            println!("No valid nonce found in 50M attempts (target too hard for CPU?)");
        }
    }

    #[cfg(not(feature = "native-ghostrider"))]
    {
        println!("native-ghostrider feature not enabled — cannot mine");
    }

    client.disconnect().await;
    println!("Done.");
}
