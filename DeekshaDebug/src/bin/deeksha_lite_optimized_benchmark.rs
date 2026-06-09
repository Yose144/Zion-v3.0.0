use std::time::Instant;
use deeksha_debug::deeksha_lite_optimized::{
    deeksha_lite_optimized, PASSES, RANDOM_READS, AES_ROUNDS,
    SCRATCHPAD_SIZE_LITE, BLOCK_COUNT_LITE
};

fn main() {
    println!("=== DeekshaLite v1 - Energy Optimized Benchmark ===");
    println!();

    let header = b"ZION_DEEKSHA_LITE_OPTIMIZED_BENCHMARK_V1";
    let iterations = 10_000usize;
    let target_byte = 0x10u8;

    println!("Configuration:");
    println!("  Scratchpad: {} KiB", SCRATCHPAD_SIZE_LITE / 1024);
    println!("  Block Count: {}", BLOCK_COUNT_LITE);
    println!("  Random Reads: {}", RANDOM_READS);
    println!("  AES Rounds: {}", AES_ROUNDS);
    println!();

    let t0 = Instant::now();
    let mut found = 0usize;
    let mut tested = 0usize;

    for nonce in 0..iterations as u64 {
        let hash = deeksha_lite_optimized(header, nonce);
        tested += 1;
        if hash[0] < target_byte {
            found += 1;
        }
    }

    let elapsed = t0.elapsed().as_secs_f64();
    let hps = tested as f64 / elapsed;

    println!("Results:");
    println!("  Iterations: {}", tested);
    println!("  Time: {:.3}s", elapsed);
    println!("  Throughput: {:.0} H/s", hps);
    println!("  Found: {} (target: 0x{:02x})", found, target_byte);
    println!("  Hash per Joule: {:.2} (estimated)", hps * 0.015); // Rough estimate
    println!();

    println!("Algorithm steps:");
    println!("  1. Keccak256(header||nonce)");
    println!("  2. Memory-hard scratchpad ({} KiB, {} passes, {} random reads)",
             SCRATCHPAD_SIZE_LITE / 1024, PASSES, RANDOM_READS);
    println!("  3. AES-128 CTR mixing ({} rounds)", AES_ROUNDS);
    println!("  4. Keccak256 final hash");
    println!();

    println!("Energy optimizations:");
    println!("  ✓ Reduced scratchpad size (50% memory bandwidth saving)");
    println!("  ✓ Fewer random reads (50% reduction in memory traffic)");
    println!("  ✓ Reduced AES rounds (25% fewer operations)");
    println!("  ✓ Optimized memory access patterns");
    println!("  ✓ Cache-friendly block processing");
}