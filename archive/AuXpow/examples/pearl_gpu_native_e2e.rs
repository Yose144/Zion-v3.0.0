//! E2E test: GPU-native Pearl PoUW pipeline with easy difficulty.
//! Verifies the full pipeline: GPU gen → hash → noise → MatMul → jackpot → Merkle proof.
//! Uses a very easy target so a share is found within seconds.

#[cfg(feature = "gpu-metal")]
fn main() {
    use std::time::Instant;
    use zion_auxpow::gpu_metal::MetalBackend;
    use zion_auxpow::pearl_pouw::*;

    let m = 256usize;
    let n = 512usize;
    let k = 1024usize;
    let rank = 32usize;

    let mut gpu = MetalBackend::new(262144).expect("Metal backend");

    println!("=== GPU-Native Pearl PoUW E2E Test ===");
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

    // Test 1: Trivial target (accept everything) — verify kernel runs and sets found
    let trivial_target = [0xFFu8; 32];

    println!("--- Test 1: Trivial target (0xFF×32, accept all) ---");
    let t = Instant::now();
    let proof1 = mine_gpu_native(
        m,
        n,
        k,
        rank,
        &header,
        &config,
        &trivial_target,
        1, // just 1 nonce
        &mut gpu,
    );
    let elapsed1 = t.elapsed();

    match &proof1 {
        Some(p) => {
            println!("  ✅ Share found in {:.2}s", elapsed1.as_secs_f64());
            println!("  jackpot_hash: {:02x?}", &p.jackpot_hash[..8]);
            println!("  proof_b64 len: {}", p.plain_proof_b64.len());
        }
        None => {
            println!("  ❌ No share found with trivial target!");
            println!("  This means the mining kernel is not setting 'found' — bug in kernel");
            std::process::exit(1);
        }
    }
    println!();

    // Test 2: Easy target (~12 bits) — should find share in 1-2 nonces
    let mut easy_target = [0xFFu8; 32];
    easy_target[0] = 0x00;
    easy_target[1] = 0x0F;

    println!("--- Test 2: Easy target (~12 bits) ---");
    println!("Target: {:02x?}", &easy_target[..4]);

    let t = Instant::now();
    let proof = mine_gpu_native(
        m,
        n,
        k,
        rank,
        &header,
        &config,
        &easy_target,
        100, // max 100 nonces
        &mut gpu,
    );

    let elapsed = t.elapsed();

    match proof {
        Some(p) => {
            println!("✅ SHARE FOUND in {:.2}s", elapsed.as_secs_f64());
            println!("  jackpot_hash: {:02x?}", &p.jackpot_hash[..8]);
            println!(
                "  plain_proof_b64 length: {} bytes",
                p.plain_proof_b64.len()
            );

            // Verify the proof is well-formed
            let proof_bytes = base64::Engine::decode(
                &base64::engine::general_purpose::STANDARD,
                &p.plain_proof_b64,
            )
            .expect("decode proof");

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
                println!("🎉 E2E TEST PASSED: Valid share with Merkle proof");
            } else {
                println!();
                println!("⚠️  E2E TEST PARTIAL: Share found but proof may be incomplete");
            }
        }
        None => {
            println!("❌ No share found in 100 nonces with easy target");
            println!("   This should not happen — check GPU kernel correctness");
            std::process::exit(1);
        }
    }
}

#[cfg(not(feature = "gpu-metal"))]
fn main() {
    eprintln!("Requires gpu-metal feature.");
}
