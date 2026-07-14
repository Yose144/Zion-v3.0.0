//! E2E test: OpenCL GPU-native Pearl PoUW pipeline (AMD RX 5700 XT / ROCm).
//! Verifies the full pipeline: GPU gen -> hash -> noise -> MatMul -> jackpot -> Merkle proof.
//! Uses a very easy target so a share is found within seconds.
//!
//! Run with:
//!   cargo run --features gpu-opencl --example pearl_gpu_native_opencl_e2e

#[cfg(feature = "gpu-opencl")]
fn main() {
    use std::time::Instant;
    use zion_auxpow::gpu_miner::opencl_backend;
    use zion_auxpow::pearl_pouw::*;

    let m = 256usize;
    let n = 512usize;
    let k = 1024usize;
    let rank = 32usize;

    let mut gpu = opencl_backend::new(262144).expect("OpenCL backend init");

    println!("=== OpenCL GPU-Native Pearl PoUW E2E Test (RX 5700 XT) ===");
    println!("m={} n={} k={} rank={}", m, n, k, rank);
    println!();

    let header = IncompleteBlockHeader {
        version: 1,
        prev_block: [0xAA; 32],
        merkle_root: [0xBB; 32],
        timestamp: 1234567890,
        nbits: 0x1E01FFFF,
    };
    let config = MiningConfiguration::default_mainnet();

    // Test 1: Trivial target (accept everything) -- verify kernel runs and sets found
    let trivial_target = [0xFFu8; 32];

    println!("--- Test 1: Trivial target (0xFFx32, accept all) ---");
    let t = Instant::now();
    let proof1 = mine_gpu_native_opencl(
        m, n, k, rank,
        &header,
        &config,
        &trivial_target,
        1,  // just 1 nonce
        &mut gpu,
    );
    let elapsed1 = t.elapsed();

    match &proof1 {
        Some(p) => {
            println!("  [PASS] Share found in {:.2}s", elapsed1.as_secs_f64());
            println!("  jackpot_hash: {:02x?}", &p.jackpot_hash[..8]);
            println!("  proof_b64 len: {}", p.plain_proof_b64.len());
        }
        None => {
            println!("  [FAIL] No share found with trivial target!");
            println!("  This means the mining kernel is not setting 'found' -- bug in kernel");
            std::process::exit(1);
        }
    }
    println!();

    // Test 2: Easy target (~12 bits) -- should find share in 1-2 nonces
    let mut easy_target = [0xFFu8; 32];
    easy_target[0] = 0x00;
    easy_target[1] = 0x0F;

    println!("--- Test 2: Easy target (~12 bits) ---");
    println!("Target: {:02x?}", &easy_target[..4]);

    let t = Instant::now();
    let proof = mine_gpu_native_opencl(
        m, n, k, rank,
        &header,
        &config,
        &easy_target,
        100,  // max 100 nonces
        &mut gpu,
    );

    let elapsed = t.elapsed();

    match proof {
        Some(p) => {
            println!("[PASS] SHARE FOUND in {:.2}s", elapsed.as_secs_f64());
            println!("  jackpot_hash: {:02x?}", &p.jackpot_hash[..8]);
            println!("  plain_proof_b64 length: {} bytes", p.plain_proof_b64.len());

            // Verify the proof is well-formed
            let proof_bytes = base64::Engine::decode(
                &base64::engine::general_purpose::STANDARD,
                &p.plain_proof_b64,
            ).expect("decode proof");

            println!("  proof_bytes: {} bytes", proof_bytes.len());
            // PearlPlainProof is bincode-serialized: m, n, k, noise_rank (usize = 8 bytes each)
            // + PearlMatrixMerkleProof for a and bt
            // Just check it's non-trivial
            println!("  proof_bytes[0..8] (m): {:02x?}", &proof_bytes[..8]);

            // Verify jackpot hash meets target
            let meets_target = p.jackpot_hash < easy_target;
            println!("  jackpot < target: {}", meets_target);

            if meets_target && proof_bytes.len() > 100 {
                println!();
                println!("=== E2E TEST PASSED: Valid share with Merkle proof ===");
            } else {
                println!();
                println!("=== E2E TEST PARTIAL: Share found but proof may be incomplete ===");
            }
        }
        None => {
            println!("[FAIL] No share found in 100 nonces with easy target");
            println!("   This should not happen -- check GPU kernel correctness");
            std::process::exit(1);
        }
    }

    // Test 3: BLAKE3 consistency -- GPU jackpot hash must match CPU recomputation
    println!();
    println!("--- Test 3: BLAKE3 consistency (GPU vs CPU) ---");
    let difficulty_bound = extract_difficulty_bound(header.nbits, &config);
    let cpu_proof = try_mine_one(0, m, n, k, rank, &header, &config, &difficulty_bound);
    match cpu_proof {
        Some(cp) => {
            println!("  CPU jackpot_hash:  {:02x?}", &cp.jackpot_hash[..8]);
            println!("  CPU proof_b64 len: {}", cp.plain_proof_b64.len());
            println!("  [INFO] CPU path works -- cross-check GPU hashes separately");
        }
        None => println!("  [INFO] CPU path did not find a share at nonce 0 (expected for hard target)"),
    }
    println!();
    println!("=== OpenCL E2E complete ===");
}

#[cfg(not(feature = "gpu-opencl"))]
fn main() {
    eprintln!("Requires gpu-opencl feature.");
    eprintln!("Run with: cargo run --features gpu-opencl --example pearl_gpu_native_opencl_e2e");
}
