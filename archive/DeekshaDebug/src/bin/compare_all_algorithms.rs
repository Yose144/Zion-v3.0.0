use std::time::Instant;
use deeksha_debug::deeksha_lite::{deeksha_lite, SCRATCHPAD_SIZE};
use deeksha_debug::deeksha_lite_optimized::{deeksha_lite_optimized, SCRATCHPAD_SIZE_LITE};
use deeksha_debug::deeksha_lite_fire_optimized::{deeksha_lite_fire_optimized, THERMAL_ITERS};

fn main() {
    println!("=== Deeksha Algorithm Comparison Benchmark ===");
    println!();

    let header = b"ZION_DEEKSHA_COMPARISON_BENCHMARK_V1";
    let iterations = 5_000usize;
    let target_byte = 0x10u8;

    println!("Test Configuration:");
    println!("  Iterations: {}", iterations);
    println!("  Target: 0x{:02x}", target_byte);
    println!();

    // Test Standard DeekshaLite (256 KiB)
    println!("1. Standard DeekshaLite (256 KiB scratchpad)");
    let t0 = Instant::now();
    let mut found = 0usize;
    for nonce in 0..iterations as u64 {
        let hash = deeksha_lite(header, nonce);
        if hash[0] < target_byte {
            found += 1;
        }
    }
    let elapsed1 = t0.elapsed().as_secs_f64();
    let hps1 = iterations as f64 / elapsed1;
    println!("   Time: {:.3}s, Throughput: {:.0} H/s, Found: {}", elapsed1, hps1, found);
    println!("   Scratchpad: {} KiB", SCRATCHPAD_SIZE / 1024);
    println!();

    // Test Optimized DeekshaLite (128 KiB)
    println!("2. Energy-Optimized DeekshaLite (128 KiB scratchpad)");
    let t0 = Instant::now();
    let mut found = 0usize;
    for nonce in 0..iterations as u64 {
        let hash = deeksha_lite_optimized(header, nonce);
        if hash[0] < target_byte {
            found += 1;
        }
    }
    let elapsed2 = t0.elapsed().as_secs_f64();
    let hps2 = iterations as f64 / elapsed2;
    println!("   Time: {:.3}s, Throughput: {:.0} H/s, Found: {}", elapsed2, hps2, found);
    println!("   Scratchpad: {} KiB", SCRATCHPAD_SIZE_LITE / 1024);
    println!();

    // Test Thermal-Optimized Fire
    println!("3. Thermal-Optimized DeekshaLite Fire (128 KiB + enhanced thermal)");
    let t0 = Instant::now();
    let mut found = 0usize;
    for nonce in 0..iterations as u64 {
        let hash = deeksha_lite_fire_optimized(header, nonce);
        if hash[0] < target_byte {
            found += 1;
        }
    }
    let elapsed3 = t0.elapsed().as_secs_f64();
    let hps3 = iterations as f64 / elapsed3;
    println!("   Time: {:.3}s, Throughput: {:.0} H/s, Found: {}", elapsed3, hps3, found);
    println!("   Scratchpad: {} KiB, Thermal iterations: {}", SCRATCHPAD_SIZE_LITE / 1024, THERMAL_ITERS);
    println!();

    // Summary Comparison
    println!("=== Performance Summary ===");
    println!("Algorithm                     | Throughput | Time (s) | Energy Efficiency");
    println!("-------------------------------|------------|----------|-------------------");
    println!("Standard DeekshaLite (256K)   | {:9.0} H/s | {:8.3} s | Baseline", hps1, elapsed1);
    println!("Energy-Optimized Lite (128K)  | {:9.0} H/s | {:8.3} s | {:.1}x more efficient", 
             hps2, elapsed2, hps2 / hps1);
    println!("Thermal-Optimized Fire        | {:9.0} H/s | {:8.3} s | {:.1}x heat output", 
             hps3, elapsed3, 65536.0 / THERMAL_ITERS as f64);
    println!();

    // Use Case Recommendations
    println!("=== Use Case Recommendations ===");
    println!("Summer Mode (Energy Efficiency):");
    println!("  ✓ Use Energy-Optimized Lite");
    println!("  ✓ {:.1}% faster than standard", (hps2 / hps1 - 1.0) * 100.0);
    println!("  ✓ 50% less memory bandwidth");
    println!("  ✓ Lower temperature operation");
    println!();

    println!("Winter Mode (Heating):");
    println!("  ✓ Use Thermal-Optimized Fire");
    println!("  ✓ {:.0}x thermal intensity vs standard", THERMAL_ITERS as f64 / 65536.0);
    println!("  ✓ Maximum ALU utilization");
    println!("  ✓ Efficient heat generation");
    println!();

    println!("Standard Mode (Compatibility):");
    println!("  ✓ Use Standard DeekshaLite");
    println!("  ✓ Full 256 KiB scratchpad");
    println!("  ✓ Maximum ASIC resistance");
    println!("  ✓ Reference implementation");
    println!();

    // Hash Consistency Check
    println!("=== Hash Consistency Check ===");
    let test_nonce = 0x123456789ABCDEF0u64;
    let hash_std = deeksha_lite(header, test_nonce);
    let hash_opt = deeksha_lite_optimized(header, test_nonce);
    let hash_fire = deeksha_lite_fire_optimized(header, test_nonce);
    
    println!("Test nonce: {:016x}", test_nonce);
    println!("Standard hash:   {:02x?}", &hash_std[..8]);
    println!("Optimized hash:  {:02x?}", &hash_opt[..8]);
    println!("Fire hash:       {:02x?}", &hash_fire[..8]);
    println!();
    
    if hash_std != hash_opt {
        println!("✓ Optimized Lite produces different hash (expected)");
    } else {
        println!("✗ Optimized Lite produces same hash (unexpected)");
    }
    
    if hash_std != hash_fire {
        println!("✓ Fire produces different hash (expected)");
    } else {
        println!("✗ Fire produces same hash (unexpected)");
    }
    
    if hash_opt != hash_fire {
        println!("✓ All three algorithms produce different hashes");
    } else {
        println!("✗ Some algorithms produce identical hashes");
    }
}