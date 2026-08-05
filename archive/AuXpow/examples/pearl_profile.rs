//! Profile CPU-side data preparation for Pearl PoUW mining.
//! Compares original (Vec<Vec>) vs fast (flat array) implementations.

use std::time::Instant;
use zion_auxpow::pearl_pouw::*;

fn main() {
    let m = 256usize;
    let n = 512usize;
    let k = 1024usize;
    let rank = 32usize;

    let header = IncompleteBlockHeader {
        version: 1,
        prev_block: [0xAA; 32],
        merkle_root: [0xBB; 32],
        timestamp: 1234567890,
        nbits: 0x1E01FFFF,
    };
    let config = MiningConfiguration::default_mainnet();
    let difficulty_bound = extract_difficulty_bound(header.nbits, &config);

    println!("=== Pearl PoUW CPU Prep Benchmark ===");
    println!("m={} n={} k={} rank={}", m, n, k, rank);
    println!();

    // Benchmark original try_mine_one
    println!("--- Original (Vec<Vec<i8>>) ---");
    let mut total_orig = 0.0;
    for i in 0..20 {
        let t = Instant::now();
        let _ = try_mine_one(i as u64, m, n, k, rank, &header, &config, &difficulty_bound);
        let ms = t.elapsed().as_secs_f64() * 1000.0;
        if i >= 5 {
            total_orig += ms;
        } // skip warmup
    }
    let avg_orig = total_orig / 15.0;
    println!(
        "Average: {:.2} ms/nonce ({:.1} nonces/s)",
        avg_orig,
        1000.0 / avg_orig
    );
    println!();

    // Benchmark fast try_mine_one_fast
    println!("--- Fast (flat arrays) ---");
    let mut total_fast = 0.0;
    for i in 0..20 {
        let t = Instant::now();
        let _ = try_mine_one_fast(i as u64, m, n, k, rank, &header, &config, &difficulty_bound);
        let ms = t.elapsed().as_secs_f64() * 1000.0;
        if i >= 5 {
            total_fast += ms;
        } // skip warmup
    }
    let avg_fast = total_fast / 15.0;
    println!(
        "Average: {:.2} ms/nonce ({:.1} nonces/s)",
        avg_fast,
        1000.0 / avg_fast
    );
    println!();

    // Speedup
    println!("=== Results ===");
    println!("Speedup: {:.1}x", avg_orig / avg_fast);
    println!(
        "Original: {:.2} ms ({:.1} nonces/s)",
        avg_orig,
        1000.0 / avg_orig
    );
    println!(
        "Fast:     {:.2} ms ({:.1} nonces/s)",
        avg_fast,
        1000.0 / avg_fast
    );
    println!("With GPU dispatch (4.34ms):");
    println!(
        "  Original: {:.2} ms ({:.1} nonces/s)",
        avg_orig + 4.34,
        1000.0 / (avg_orig + 4.34)
    );
    println!(
        "  Fast:     {:.2} ms ({:.1} nonces/s)",
        avg_fast + 4.34,
        1000.0 / (avg_fast + 4.34)
    );

    // Verify correctness: both should produce same result for same nonce
    println!();
    println!("--- Correctness check ---");
    let proof_orig = try_mine_one(42, m, n, k, rank, &header, &config, &difficulty_bound);
    let proof_fast = try_mine_one_fast(42, m, n, k, rank, &header, &config, &difficulty_bound);
    match (&proof_orig, &proof_fast) {
        (Some(a), Some(b)) => {
            println!(
                "Both found proof: jackpot_hash match = {}",
                a.jackpot_hash == b.jackpot_hash
            );
            println!("  orig: {:02x?}", &a.jackpot_hash[..4]);
            println!("  fast: {:02x?}", &b.jackpot_hash[..4]);
        }
        (None, None) => println!("Both found no proof (expected for high difficulty)"),
        _ => println!("MISMATCH: one found proof, other didn't!"),
    }
}
