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
        // Ethash/KawPow/ProgPow need DAG — skip for pure hashrate benchmark
        // ("ethash", "Ethereum Classic (ETC)"),
        // ("kawpow", "Ravencoin (RVN)"),
        // ("progpow", "Epic Cash (EPIC)"),
        ("pearlhash", "Pearl (PRL) — PoUW"), // No DAG — BLAKE3 placeholder
    ];

    println!(
        "{:<20} {:<25} {:>15} {:>15}",
        "Algorithm", "Coin", "Hashrate (H/s)", "Total Hashes"
    );
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
                println!("{:<20} {:<25} {:>15} {:>15}", algo, coin, "ERROR", e);
            }
        }
    }

    println!("\n=== Benchmark Complete ===\n");

    // ─── Pearl PoUW benchmark (Metal-only) ──────────────────────────────
    #[cfg(feature = "gpu-metal")]
    {
        pearl_pouw_benchmark();
    }

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

#[cfg(feature = "gpu-metal")]
fn pearl_pouw_benchmark() {
    use std::time::{Duration, Instant};
    use zion_auxpow::gpu_metal::{MetalBackend, PearlPouwGpuInput};
    use zion_auxpow::pearl_pouw::{
        compute_commitment_hash, compute_job_key, compute_noise_for_indices, flatten_matrix,
        pad_to_chunk_boundary, IncompleteBlockHeader, MiningConfiguration, SimpleRng, SIGNAL_MAX,
        SIGNAL_MIN,
    };

    println!("=== Pearl PoUW MatMul Benchmark ===\n");

    let mut backend = match MetalBackend::new(256) {
        Ok(b) => b,
        Err(e) => {
            eprintln!("ERROR: Metal backend not available: {e}");
            return;
        }
    };

    let m = 256usize;
    let n = 512usize;
    let k = 1024usize;
    let rank = 32usize;

    // Generate deterministic test data
    let header = IncompleteBlockHeader {
        version: 1,
        prev_block: [0xAA; 32],
        merkle_root: [0xBB; 32],
        timestamp: 1234567890,
        nbits: 0x1E01FFFF,
    };
    let config = MiningConfiguration::default_mainnet();

    // Pre-generate one nonce's data
    let nonce = 0u64;
    let mut rng = SimpleRng::new(nonce);
    let a_matrix: Vec<Vec<i8>> = (0..m)
        .map(|_| (0..k).map(|_| rng.range(SIGNAL_MIN, SIGNAL_MAX)).collect())
        .collect();
    let b_matrix: Vec<Vec<i8>> = (0..k)
        .map(|_| (0..n).map(|_| rng.range(SIGNAL_MIN, SIGNAL_MAX)).collect())
        .collect();
    let b_transposed: Vec<Vec<i8>> = (0..n)
        .map(|i| (0..k).map(|j| b_matrix[j][i]).collect())
        .collect();

    let job_key = compute_job_key(&header, &config);
    let a_row_major = pad_to_chunk_boundary(&flatten_matrix(&a_matrix));
    let b_col_major = pad_to_chunk_boundary(&flatten_matrix(&b_transposed));
    let (b_noise_seed, a_noise_seed) =
        compute_commitment_hash(&job_key, &a_row_major, &b_col_major);

    let a_all_rows: Vec<usize> = (0..m).collect();
    let b_all_cols: Vec<usize> = (0..n).collect();
    let noise = compute_noise_for_indices(
        k,
        rank,
        (b_noise_seed, a_noise_seed),
        &a_all_rows,
        &b_all_cols,
    );

    let a_noised: Vec<Vec<i32>> = a_matrix
        .iter()
        .zip(&noise.a)
        .map(|(a_row, n_row)| {
            a_row
                .iter()
                .zip(n_row)
                .map(|(&a, &n)| a as i32 + n as i32)
                .collect()
        })
        .collect();
    let b_noised_t: Vec<Vec<i32>> = b_transposed
        .iter()
        .zip(&noise.b)
        .map(|(bt_row, n_row)| {
            bt_row
                .iter()
                .zip(n_row)
                .map(|(&b, &n)| b as i32 + n as i32)
                .collect()
        })
        .collect();

    let a_flat: Vec<i32> = a_noised.iter().flat_map(|r| r.iter().copied()).collect();
    let b_flat: Vec<i32> = b_noised_t.iter().flat_map(|r| r.iter().copied()).collect();

    let row_offsets: Vec<u32> = (0..m as u32)
        .filter(|&i| config.rows_pattern.offset_is_valid(i))
        .collect();
    let col_offsets: Vec<u32> = (0..n as u32)
        .filter(|&i| config.cols_pattern.offset_is_valid(i))
        .collect();
    let rows_base: Vec<u32> = config.rows_pattern.to_list();
    let cols_base: Vec<u32> = config.cols_pattern.to_list();

    // Easy target (accept everything)
    let target = [0xFFu8; 32];

    let input = PearlPouwGpuInput {
        noised_a: &a_flat,
        noised_b: &b_flat,
        a_noise_seed,
        target,
        row_offsets: &row_offsets,
        col_offsets: &col_offsets,
        rows_base: &rows_base,
        cols_base: &cols_base,
    };

    // Warmup (includes kernel compilation)
    print!("  Warmup (kernel compile + first dispatch)... ");
    let warmup_start = Instant::now();
    let _ = backend.pearl_pouw_mine(&input).expect("warmup GPU mine");
    let warmup_ms = warmup_start.elapsed().as_millis();
    println!("done in {warmup_ms}ms");

    // Benchmark: measure tiles/sec (each dispatch = 4096 tiles)
    let duration = Duration::from_secs(5);
    let deadline = Instant::now() + duration;
    let bench_start = Instant::now();
    let mut dispatches: u64 = 0;

    while Instant::now() < deadline {
        let _ = backend.pearl_pouw_mine(&input).expect("GPU mine");
        dispatches += 1;
    }

    let elapsed = bench_start.elapsed().as_secs_f64();
    let total_tiles = dispatches * 4096;
    let tiles_per_sec = total_tiles as f64 / elapsed;

    println!(
        "  Pearl PoUW: {dispatches} dispatches × 4096 tiles = {total_tiles} tiles in {elapsed:.2}s"
    );
    println!("  Throughput: {tiles_per_sec:.0} tiles/s");
    println!(
        "  Per-dispatch: {:.2}ms",
        elapsed * 1000.0 / dispatches as f64
    );
    println!();
}
