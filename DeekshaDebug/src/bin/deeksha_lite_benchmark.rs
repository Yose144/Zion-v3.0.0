use std::time::Instant;
use deeksha_debug::deeksha_lite::{deeksha_lite, PASSES, RANDOM_READS, AES_ROUNDS};

fn main() {
    println!("=== DeekshaLite v1 Benchmark ===");
    println!();

    let header = b"ZION_DEEKSHA_LITE_BENCHMARK_HEADER_V1";
    let iterations = 10_000usize;
    let target_byte = 0x10u8;

    let t0 = Instant::now();
    let mut found = 0usize;
    let mut tested = 0usize;

    for nonce in 0..iterations as u64 {
        let hash = deeksha_lite(header, nonce);
        tested += 1;
        if hash[0] < target_byte {
            found += 1;
        }
    }

    let elapsed = t0.elapsed().as_secs_f64();
    let hps = tested as f64 / elapsed;

    println!("Iterations: {}", tested);
    println!("Time: {:.3}s", elapsed);
    println!("Throughput: {:.0} H/s", hps);
    println!("Found: {} (target: 0x{:02x})", found, target_byte);
    println!();
    println!("Algorithm steps:");
    println!("  1. Keccak256(header||nonce)");
    println!("  2. Memory-hard scratchpad (256 KiB, {} passes, {} random reads)",
             PASSES, RANDOM_READS);
    println!("  3. AES-128 CTR mixing ({} rounds)", AES_ROUNDS);
    println!("  4. Keccak256 final hash");
}
