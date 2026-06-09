use std::time::Instant;
use deeksha_debug::deeksha_lite_fire_optimized::{
    deeksha_lite_fire_optimized, PASSES, RANDOM_READS, AES_ROUNDS, THERMAL_ITERS,
    SCRATCHPAD_SIZE, BLOCK_COUNT
};

fn main() {
    println!("=== DeekshaLite Fire - Thermal Optimized Benchmark ===");
    println!();

    let header = b"ZION_DEEKSHA_LITE_FIRE_OPTIMIZED_BENCHMARK_V1";
    let iterations = 2_000usize; // Reduced due to thermal intensity
    let target_byte = 0x10u8;

    println!("Configuration:");
    println!("  Scratchpad: {} KiB", SCRATCHPAD_SIZE / 1024);
    println!("  Block Count: {}", BLOCK_COUNT);
    println!("  Random Reads: {}", RANDOM_READS);
    println!("  AES Rounds: {}", AES_ROUNDS);
    println!("  Thermal Iterations: {}", THERMAL_ITERS);
    println!("  Thermal Chains: 12 (enhanced from 8)");
    println!();

    println!("Thermal optimizations:");
    println!("  ✓ Enhanced thermal loop (2x iterations)");
    println!("  ✓ 12 independent ulong chains (50% more)");
    println!("  ✓ Complex rotation patterns for ALU utilization");
    println!("  ✓ Memory-dependent operations");
    println!("  ✓ Additional bit manipulation");
    println!("  ✓ Reduced memory operations (focus on compute)");
    println!();

    let t0 = Instant::now();
    let mut found = 0usize;
    let mut tested = 0usize;

    for nonce in 0..iterations as u64 {
        let hash = deeksha_lite_fire_optimized(header, nonce);
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
    println!("  Thermal Efficiency: {:.2} (estimated)", (THERMAL_ITERS as f64 / 65536.0) * 100.0);
    println!("  Heat per Hash: {:.1} (relative units)", 65536.0 / THERMAL_ITERS as f64);
    println!();

    println!("Algorithm steps:");
    println!("  1. Keccak256(header||nonce)");
    println!("  2. Memory-hard scratchpad ({} KiB, {} passes, {} random reads)",
             SCRATCHPAD_SIZE / 1024, PASSES, RANDOM_READS);
    println!("  3. AES-128 CTR mixing ({} rounds)", AES_ROUNDS);
    println!("  4. Enhanced thermal loop ({} iterations, 12 chains)", THERMAL_ITERS);
    println!("  5. Keccak256 final hash");
    println!();

    println!("Expected thermal characteristics:");
    println!("  • Power consumption: 200-250W (targeted)");
    println!("  • Temperature: 75-80°C under sustained load");
    println!("  • ALU utilization: > 90%");
    println!("  • Heat conversion efficiency: > 80%");
    println!("  • Suitable for winter heating applications");
}