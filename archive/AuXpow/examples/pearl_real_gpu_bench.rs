//! Benchmark: Real Pearl PoUW CPU vs GPU (CPU-prep + GPU GEMM dispatch).
//!
//! Compares the full CPU-only pipeline (`mine_pearl_share`) against the
//! GPU-accelerated pipeline (`mine_pearl_share_gpu`) using the real Pearl
//! PoUW algorithm with standard parameters (m=512, n=512, k=4096, rank=256).
//!
//! Usage:
//!   cargo run --release --features gpu-opencl --example pearl_real_gpu_bench

#![cfg_attr(not(feature = "gpu-opencl"), allow(dead_code))]

#[cfg(feature = "gpu-opencl")]
use std::time::Instant;
#[cfg(feature = "gpu-opencl")]
use zion_auxpow::gpu_miner::GpuMiner;
#[cfg(feature = "gpu-opencl")]
use zion_auxpow::pearl_real_pouw;

#[cfg(not(feature = "gpu-opencl"))]
fn main() {
    eprintln!("This benchmark requires --features gpu-opencl");
}

#[cfg(feature = "gpu-opencl")]
fn main() {
    let m = pearl_real_pouw::DEFAULT_M;
    let n = pearl_real_pouw::DEFAULT_N;
    let k = pearl_real_pouw::DEFAULT_K;
    let noise_rank = pearl_real_pouw::DEFAULT_NOISE_RANK;
    let noise_range = pearl_real_pouw::DEFAULT_NOISE_RANGE;
    let hash_tile_h = pearl_real_pouw::DEFAULT_HASH_TILE_H;
    let hash_tile_w = pearl_real_pouw::DEFAULT_HASH_TILE_W;

    // Use a trivial target (all 0xFF) so every tile "wins" — measures pure
    // compute time without the randomness of finding a winning tile.
    let header_hex = "00".repeat(76);
    let target_hex = "ff".repeat(32);

    println!("=== Real Pearl PoUW CPU vs GPU Benchmark ===");
    println!("m={} n={} k={} rank={} range={} tile={}x{}",
             m, n, k, noise_rank, noise_range, hash_tile_h, hash_tile_w);
    println!();

    // ── CPU baseline ──────────────────────────────────────────────────
    println!("CPU-only pipeline (mine_pearl_share)...");
    let cpu_times: Vec<f64> = (0..3).map(|i| {
        let t0 = Instant::now();
        let result = pearl_real_pouw::mine_pearl_share(
            &header_hex, &target_hex,
            m, n, k, noise_rank, noise_range,
            hash_tile_h, hash_tile_w,
            i as u64,
        ).expect("CPU mining failed");
        let ms = t0.elapsed().as_secs_f64() * 1000.0;
        let found = result.is_some();
        println!("  run {}: {:.2} ms (found={})", i, ms, found);
        ms
    }).collect();
    let cpu_avg = cpu_times.iter().sum::<f64>() / cpu_times.len() as f64;
    let cpu_min = cpu_times.iter().cloned().fold(f64::INFINITY, f64::min);
    println!("  CPU avg: {:.2} ms, min: {:.2} ms", cpu_avg, cpu_min);
    println!();

    // ── GPU pipeline ──────────────────────────────────────────────────
    println!("Initializing GPU (OpenCL)...");
    let mut gpu_miner = match GpuMiner::new() {
        Ok(m) => {
            println!("  GPU initialized successfully");
            m
        }
        Err(e) => {
            eprintln!("  GPU init failed: {} — exiting (CPU-only results above)", e);
            return;
        }
    };
    println!();

    // Warmup
    println!("GPU warmup...");
    let _ = pearl_real_pouw::mine_pearl_share_gpu(
        &header_hex, &target_hex,
        m, n, k, noise_rank, noise_range,
        hash_tile_h, hash_tile_w,
        0,
        &mut gpu_miner,
    );

    println!("GPU pipeline (mine_pearl_share_gpu)...");
    let gpu_times: Vec<f64> = (0..5).map(|i| {
        let t0 = Instant::now();
        let result = pearl_real_pouw::mine_pearl_share_gpu(
            &header_hex, &target_hex,
            m, n, k, noise_rank, noise_range,
            hash_tile_h, hash_tile_w,
            i as u64,
            &mut gpu_miner,
        ).expect("GPU mining failed");
        let ms = t0.elapsed().as_secs_f64() * 1000.0;
        let found = result.is_some();
        println!("  run {}: {:.2} ms (found={})", i, ms, found);
        ms
    }).collect();
    let gpu_avg = gpu_times.iter().sum::<f64>() / gpu_times.len() as f64;
    let gpu_min = gpu_times.iter().cloned().fold(f64::INFINITY, f64::min);
    println!("  GPU avg: {:.2} ms, min: {:.2} ms", gpu_avg, gpu_min);
    println!();

    // ── Summary ───────────────────────────────────────────────────────
    println!("=== Summary ===");
    println!("CPU avg: {:.2} ms ({:.1} attempts/s)", cpu_avg, 1000.0 / cpu_avg);
    println!("GPU avg: {:.2} ms ({:.1} attempts/s)", gpu_avg, 1000.0 / gpu_avg);
    println!("Speedup: {:.2}x", cpu_avg / gpu_avg);

    // ── Breakdown: CPU-prep only vs GPU GEMM only ─────────────────────
    println!();
    println!("=== Breakdown: CPU-prep vs GPU GEMM ===");
    let prep_times: Vec<f64> = (0..5).map(|i| {
        let t0 = Instant::now();
        let _prep = pearl_real_pouw::prepare_pearl_gpu_input(
            &header_hex, &target_hex,
            m, n, k, noise_rank, noise_range,
            hash_tile_h, hash_tile_w,
            i as u64,
        ).expect("prep failed");
        let ms = t0.elapsed().as_secs_f64() * 1000.0;
        if i == 0 { println!("  CPU-prep run {}: {:.2} ms", i, ms); }
        ms
    }).collect();
    let prep_avg = prep_times.iter().sum::<f64>() / prep_times.len() as f64;
    let gpu_gemm_avg = gpu_avg - prep_avg;
    println!("  CPU-prep avg: {:.2} ms ({:.1}% of total)", prep_avg, prep_avg / gpu_avg * 100.0);
    println!("  GPU GEMM avg: {:.2} ms ({:.1}% of total)", gpu_gemm_avg, gpu_gemm_avg / gpu_avg * 100.0);
}
