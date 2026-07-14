//! GPU Mining Benchmark — measures hashrate for all supported algorithms.
//!
//! Usage:
//!   cargo run --example gpu_benchmark --features gpu-metal     # Apple Silicon
//!   cargo run --example gpu_benchmark --features gpu-opencl    # OpenCL
//!   cargo run --example gpu_benchmark --features gpu-cuda      # NVIDIA
//!
//! Benchmarks each algorithm for `DURATION_SECS` seconds and reports:
//!   - Total hashes computed
//!   - Hashrate (H/s)
//!   - GPU device name
//!   - Backend (metal/cuda/opencl)

use std::time::{Duration, Instant};

const DURATION_SECS: u64 = 5;
const BATCH_SIZE: u64 = 1_048_576; // 1M nonces per batch

fn main() {
    println!("=== ZION AuXpow GPU Mining Benchmark ===\n");
    println!("Duration per algorithm: {DURATION_SECS}s");
    println!("Batch size: {BATCH_SIZE} nonces\n");

    // Detect backend
    let mut backend = match zion_auxpow::gpu_backend::detect_backend(1_048_576) {
        Ok(b) => b,
        Err(e) => {
            eprintln!("ERROR: No GPU backend available: {e}");
            eprintln!("\nCompile with one of:");
            eprintln!("  cargo run --example gpu_benchmark --features gpu-metal");
            eprintln!("  cargo run --example gpu_benchmark --features gpu-opencl");
            eprintln!("  cargo run --example gpu_benchmark --features gpu-cuda");
            std::process::exit(1);
        }
    };

    let device_name = backend.device_name().to_string();
    let backend_name = backend.backend_name().to_string();
    println!("Device: {device_name}");
    println!("Backend: {backend_name}\n");

    // List all available devices
    let all_devices = zion_auxpow::gpu_backend::list_devices();
    println!("All detected GPU devices:");
    for d in &all_devices {
        println!("  - {d}");
    }
    println!();

    // Dummy header and target for benchmarking
    // Target = all 0xFF (very easy, so we find solutions quickly)
    let header = vec![0x42u8; 80]; // 80-byte header (Bitcoin-style)
    let target = [0xFFu8; 32]; // Easy target — every nonce is a solution

    // Algorithms to benchmark
    let algorithms = vec![
        ("blake3", "Alephium (ALPH)"),
        ("blake3_dcr", "Decred (DCR)"),
        ("kheavyhash", "Kaspa (KAS)"),
        ("autolykos", "Ergo (ERG)"),
        ("zelhash", "FLUX (ZelHash)"),
        // Ethash/KawPow need DAG — skip for pure hashrate benchmark
        // ("ethash", "Ethereum Classic (ETC)"),
        // ("kawpow", "Ravencoin (RVN)"),
    ];

    println!("{:<20} {:<25} {:>15} {:>15}", "Algorithm", "Coin", "Hashrate (H/s)", "Total Hashes");
    println!("{}", "-".repeat(80));

    for (algo, coin) in &algorithms {
        let result = benchmark_algorithm(&mut backend, algo, &header, &target, DURATION_SECS);
        match result {
            Ok((total_hashes, hashrate)) => {
                println!(
                    "{:<20} {:<25} {:>15.2} {:>15}",
                    algo, coin, hashrate, total_hashes
                );
            }
            Err(e) => {
                println!(
                    "{:<20} {:<25} {:>15} {:>15}",
                    algo, coin, "ERROR", e
                );
            }
        }
    }

    println!("\n=== Benchmark Complete ===\n");

    // Print summary table
    println!("Summary:");
    println!("  Device:  {device_name}");
    println!("  Backend: {backend_name}");
    println!("  Duration per algo: {DURATION_SECS}s");
    println!("  Batch size: {BATCH_SIZE} nonces");
}

fn benchmark_algorithm(
    backend: &mut Box<dyn zion_auxpow::gpu_backend::GpuBackend>,
    algorithm: &str,
    header: &[u8],
    target: &[u8; 32],
    duration_secs: u64,
) -> anyhow::Result<(u64, f64)> {
    let mut total_hashes: u64 = 0;
    let mut base_nonce: u64 = 0;

    // Warmup: first batch includes kernel compilation
    let warmup_start = Instant::now();
    let _ = backend.mine_simple(algorithm, header, target, base_nonce, BATCH_SIZE)?;
    let _warmup_ms = warmup_start.elapsed().as_millis();
    total_hashes += BATCH_SIZE;
    base_nonce += BATCH_SIZE;

    // Set deadline AFTER warmup so warmup time doesn't eat into benchmark.
    let deadline = Instant::now() + Duration::from_secs(duration_secs);
    let bench_start = Instant::now();
    let mut errors = 0u32;

    while Instant::now() < deadline {
        match backend.mine_simple(algorithm, header, target, base_nonce, BATCH_SIZE) {
            Ok(_) => {
                total_hashes += BATCH_SIZE;
                base_nonce += BATCH_SIZE;
            }
            Err(e) => {
                errors += 1;
                if errors <= 3 {
                    eprintln!("  benchmark error for {algorithm}: {e}");
                }
                // Don't count failed batches
                base_nonce += BATCH_SIZE;
            }
        }
    }

    let elapsed = bench_start.elapsed();
    let elapsed_secs = elapsed.as_secs_f64();
    let bench_hashes = total_hashes - BATCH_SIZE; // exclude warmup
    let hashrate = bench_hashes as f64 / elapsed_secs;

    if errors > 0 {
        eprintln!("  {algorithm}: {errors} errors during benchmark");
    }
    eprintln!("  {algorithm}: {bench_hashes} hashes in {elapsed_secs:.2}s = {hashrate:.0} H/s");

    Ok((bench_hashes, hashrate))
}
