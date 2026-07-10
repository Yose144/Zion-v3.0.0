//! CPU-only benchmark for DeekshaLite Fire Org.
//!
//! Works on any machine — no OpenCL / GPU required.
//!
//! Usage:
//!   cargo run --release -p deeksha-fire-org --bin bench_fire_org

use deeksha_fire_org::{
    deeksha_lite_fire_org, AES_ROUNDS, PASSES, RANDOM_READS, SCRATCHPAD_SIZE, THERMAL_ITERS,
};

fn main() {
    println!("====================================================================");
    println!("  DeekshaLite Fire Org — CPU-only benchmark");
    println!("  (No GPU / OpenCL required — runs anywhere)");
    println!("====================================================================");
    println!();

    let header = b"ZION_DEEKSHA_FIRE_ORG_CPU_BENCH_V1";
    let bench_count: u64 = 200;

    println!("Configuration:");
    println!("  Scratchpad: {} KiB", SCRATCHPAD_SIZE / 1024);
    println!("  Passes: {}", PASSES);
    println!("  Random Reads: {}", RANDOM_READS);
    println!("  AES Rounds: {}", AES_ROUNDS);
    println!("  Thermal Iterations: {}", THERMAL_ITERS);
    println!("  Thermal Chains: 12");
    println!();

    // Determinism sanity check
    let h1 = deeksha_lite_fire_org(header, 42u64);
    let h2 = deeksha_lite_fire_org(header, 42u64);
    assert_eq!(h1, h2, "Hash must be deterministic");

    // Throughput benchmark
    println!("Running {} hashes (single-threaded)...", bench_count);
    let t0 = std::time::Instant::now();
    for i in 0..bench_count {
        let _ = deeksha_lite_fire_org(header, i);
    }
    let elapsed = t0.elapsed().as_secs_f64();
    let hps = bench_count as f64 / elapsed;

    println!();
    println!("Results:");
    println!("  Hashes: {}", bench_count);
    println!("  Time: {:.3}s", elapsed);
    println!("  Throughput: {:.0} H/s", hps);
    println!();
    println!("  This is the ORIGINAL winter heater profile.");
    println!("  For GPU cross-check run: cargo run --release -p deeksha-fire-org");
    println!("                            --features gpu --bin bench_fire_org_gpu");
}
