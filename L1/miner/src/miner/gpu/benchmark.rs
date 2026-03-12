//! GPU Benchmark and Auto-tuning Module
//!
//! Provides benchmarking capabilities for GPU mining and auto-tuning
//! of batch sizes for optimal performance.

use super::{GpuDevice, GpuMiner, GpuPlatform};
use anyhow::Result;
use std::time::{Duration, Instant};

fn format_hashrate(hashrate: f64) -> String {
    if hashrate >= 1_000_000.0 {
        format!("{:.2} MH/s", hashrate / 1_000_000.0)
    } else if hashrate >= 1_000.0 {
        format!("{:.2} KH/s", hashrate / 1_000.0)
    } else {
        format!("{:.2} H/s", hashrate)
    }
}

/// Benchmark result for a single batch size test
#[derive(Debug, Clone)]
pub struct BenchmarkResult {
    pub requested_batch_size: u64,
    pub actual_batch_size: u64,
    pub hashrate: f64, // H/s
    pub elapsed_ms: f64,
    pub hashes_tested: u64,
}

/// Complete benchmark results for a device
#[derive(Debug, Clone)]
pub struct DeviceBenchmark {
    pub device: GpuDevice,
    pub results: Vec<BenchmarkResult>,
    pub optimal_batch_size: u64,
    pub peak_hashrate: f64,
}

/// GPU auto-tuning configuration
#[derive(Debug, Clone)]
pub struct AutoTuneConfig {
    /// Minimum batch size to test
    pub min_batch: u64,
    /// Maximum batch size to test
    pub max_batch: u64,
    /// Number of iterations per batch size
    pub iterations: u32,
    /// Warmup iterations before measurement
    pub warmup_iterations: u32,
}

impl Default for AutoTuneConfig {
    fn default() -> Self {
        Self {
            min_batch: 64,
            max_batch: 16_384,
            iterations: 5,
            warmup_iterations: 2,
        }
    }
}

/// Calculate optimal batch size based on device properties
pub fn calculate_optimal_batch_size(device: &GpuDevice) -> u64 {
    // Base calculation on GPU memory and platform
    let memory_factor = match device.memory_mb {
        0..=1024 => 500_000,      // Low-end GPU
        1025..=4096 => 1_000_000, // Mid-range GPU
        4097..=8192 => 2_000_000, // High-end GPU
        _ => 4_000_000,           // Very high-end GPU
    };

    // Platform efficiency factors
    let platform_factor = match device.platform {
        GpuPlatform::Cuda => 1.2,
        GpuPlatform::Metal => 1.5, // Metal is very efficient on Apple Silicon
        GpuPlatform::OpenCL => 1.0,
    };

    ((memory_factor as f64) * platform_factor) as u64
}

/// Run benchmark on a GPU miner
pub fn run_benchmark(miner: &mut dyn GpuMiner, config: &AutoTuneConfig) -> Result<DeviceBenchmark> {
    let device = miner.device_info().clone();
    println!("\n🔧 Benchmarking GPU: {}", device.name);
    println!(
        "   Platform: {:?}, Memory: {} MB",
        device.platform, device.memory_mb
    );

    // Test header (dummy data)
    let header = vec![0u8; 80];
    // Benchmark with a practical no-hit target.
    // An all-0xFF target causes every lane to hit, which serializes atomics and
    // measures result-buffer contention rather than Ekam hashing throughput.
    let easy_target = [0u8; 32];

    let mut results = Vec::new();
    let mut best_hashrate = 0.0f64;
    let mut best_batch = config.min_batch;

    // Batch sizes to test (logarithmic scale).
    // Deduplicate by effective batch size so fixed-dispatch backends like Metal
    // or memory-hard-limited backends do not benchmark the same workload repeatedly.
    let batch_sizes: Vec<(u64, u64)> = {
        let mut sizes = Vec::new();
        let mut seen_effective = std::collections::BTreeSet::new();
        let mut size = config.min_batch;
        while size <= config.max_batch {
            let effective = miner.effective_batch_size(size, 0);
            if seen_effective.insert(effective) {
                sizes.push((size, effective));
            }
            size = (size as f64 * 1.5) as u64;
        }
        let effective_max = miner.effective_batch_size(config.max_batch, 0);
        if seen_effective.insert(effective_max) {
            sizes.push((config.max_batch, effective_max));
        }
        sizes
    };

    for &(requested_batch_size, actual_batch_size) in &batch_sizes {
        if requested_batch_size == actual_batch_size {
            print!("   Testing batch size {:>10}... ", actual_batch_size);
        } else {
            print!(
                "   Testing batch {:>10} -> dispatch {:>10}... ",
                requested_batch_size,
                actual_batch_size
            );
        }

        // Warmup
        for _ in 0..config.warmup_iterations {
            let _ = miner.mine_batch(&header, &easy_target, 0, requested_batch_size, 0);
        }

        // Timed runs
        let mut total_time = Duration::ZERO;
        let mut total_hashes = 0u64;

        for i in 0..config.iterations {
            let nonce_start = (i as u64) * actual_batch_size;
            let start = Instant::now();
            let _ = miner.mine_batch(&header, &easy_target, nonce_start, requested_batch_size, 0);
            total_time += start.elapsed();
            total_hashes += actual_batch_size;
        }

        let elapsed_ms = total_time.as_secs_f64() * 1000.0;
        let hashrate = (total_hashes as f64) / total_time.as_secs_f64();

        println!("{:>12}", format_hashrate(hashrate));

        results.push(BenchmarkResult {
            requested_batch_size,
            actual_batch_size,
            hashrate,
            elapsed_ms,
            hashes_tested: total_hashes,
        });

        if hashrate > best_hashrate {
            best_hashrate = hashrate;
            best_batch = actual_batch_size;
        }
    }

    println!(
        "\n✅ Optimal batch size: {} ({})",
        best_batch,
        format_hashrate(best_hashrate)
    );

    Ok(DeviceBenchmark {
        device,
        results,
        optimal_batch_size: best_batch,
        peak_hashrate: best_hashrate,
    })
}

/// Quick auto-tune to find optimal batch size
pub fn auto_tune(miner: &mut dyn GpuMiner) -> Result<u64> {
    let device = miner.device_info();

    if let Some(natural_batch_size) = miner.natural_batch_size() {
        let effective_batch_size = miner.effective_batch_size(natural_batch_size, 0);
        return Ok(effective_batch_size);
    }

    let effective_cap = miner.effective_batch_size(u64::MAX, 0).max(1);
    if effective_cap <= 65_536 {
        let min_batch = (effective_cap / 4).max(64).min(effective_cap);
        let config = AutoTuneConfig {
            min_batch,
            max_batch: effective_cap,
            iterations: 3,
            warmup_iterations: 1,
        };
        let result = run_benchmark(miner, &config)?;
        return Ok(result.optimal_batch_size);
    }

    // Start with calculated estimate
    let estimated = calculate_optimal_batch_size(device);

    // Quick benchmark around the estimate
    let config = AutoTuneConfig {
        min_batch: estimated / 2,
        max_batch: estimated * 2,
        iterations: 3,
        warmup_iterations: 1,
    };

    let result = run_benchmark(miner, &config)?;
    Ok(result.optimal_batch_size)
}

/// Print benchmark results in a formatted table
pub fn print_benchmark_results(benchmarks: &[DeviceBenchmark]) {
    println!("\n╔══════════════════════════════════════════════════════════════════════╗");
    println!("║                      GPU BENCHMARK RESULTS                           ║");
    println!("╠══════════════════════════════════════════════════════════════════════╣");

    for bench in benchmarks {
        println!("║ Device: {:<60} ║", bench.device.name);
        println!(
            "║ Platform: {:?}, Memory: {} MB{:>36} ║",
            bench.device.platform, bench.device.memory_mb, ""
        );
        println!("╟──────────────────────────────────────────────────────────────────────╢");
        println!(
            "║ {:>12} │ {:>12} │ {:>12} │ {:>12} ║",
            "Dispatch", "Hashrate", "Time (ms)", "Hashes"
        );
        println!("╟──────────────────────────────────────────────────────────────────────╢");

        for result in &bench.results {
            let hashrate_str = format_hashrate(result.hashrate);

            println!(
                "║ {:>12} │ {:>12} │ {:>12.2} │ {:>12} ║",
                result.actual_batch_size, hashrate_str, result.elapsed_ms, result.hashes_tested
            );
        }

        println!("╟──────────────────────────────────────────────────────────────────────╢");
        let peak_hashrate_str = format_hashrate(bench.peak_hashrate);
        println!(
            "║ OPTIMAL: batch={}, peak={}{} ║",
            bench.optimal_batch_size,
            peak_hashrate_str,
            " ".repeat(32usize.saturating_sub(peak_hashrate_str.len()))
        );
        println!("╚══════════════════════════════════════════════════════════════════════╝");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_optimal_batch() {
        let low_end = GpuDevice {
            id: 0,
            name: "Test Low-End".to_string(),
            platform: GpuPlatform::OpenCL,
            compute_units: 8,
            memory_mb: 1024,
        };
        assert!(calculate_optimal_batch_size(&low_end) >= 100_000);

        let high_end = GpuDevice {
            id: 0,
            name: "Test High-End".to_string(),
            platform: GpuPlatform::Cuda,
            compute_units: 80,
            memory_mb: 12000,
        };
        assert!(calculate_optimal_batch_size(&high_end) > calculate_optimal_batch_size(&low_end));
    }
}
