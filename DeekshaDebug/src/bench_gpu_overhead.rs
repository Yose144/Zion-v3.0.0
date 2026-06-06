use std::time::Instant;

/// Benchmark: GPU kernel launch overhead vs. useful work.
///
/// On AMD RDNA the s4 kernel launch (clEnqueueNDRangeKernel +
/// clFinish) has a large fixed cost regardless of work size.
/// This benchmark simulates that by sleeping a fixed amount
/// and then doing trivial work proportional to chunk.
///
/// Goal: find the chunk size where GPU time is dominated by
/// useful work rather than launch overhead.

fn gpu_simulation(chunk: usize, overhead_ms: u64, per_item_us: u64) {
    std::thread::sleep(std::time::Duration::from_millis(overhead_ms));
    std::thread::sleep(std::time::Duration::from_micros((chunk as u64) * per_item_us));
}

fn cpu_simulation(chunk: usize, epoch: u64) {
    for i in 0..chunk {
        let mut buf = [0u8; 64];
        for j in 0..64 {
            buf[j] = ((i * 7 + j * 13) % 256) as u8;
        }
        let s5 = zion_cosmic_harmony::algorithms_npu::npu_mixing_step_epoch(&buf, epoch);
        let _ = zion_cosmic_harmony::algorithms_opt::cosmic_fusion_opt_rounds(&s5, 8);
    }
}

fn main() {
    let epoch: u64 = 0;
    let chunk_sizes = [256, 512, 1024, 2048, 4096, 8192, 16384];

    println!("=== Benchmark: GPU kernel launch overhead vs useful work ===\n");
    println!("{:>6} {:>10} {:>10} {:>10} {:>12}", "chunk", "gpu_ms", "cpu_ms", "total_ms", "overhead_pct");

    for &chunk in &chunk_sizes {
        let gpu_overhead_ms = 850u64;
        let gpu_per_item_us = 10u64;

        let t0 = Instant::now();
        gpu_simulation(chunk, gpu_overhead_ms, gpu_per_item_us);
        let gpu_ms = t0.elapsed().as_millis();

        let t1 = Instant::now();
        cpu_simulation(chunk, epoch);
        let cpu_ms = t1.elapsed().as_millis();

        let total_ms = gpu_ms + cpu_ms;
        let overhead_pct = (gpu_overhead_ms as f64 * 100.0) / total_ms as f64;

        println!(
            "{:>6} {:>10} {:>10} {:>10} {:>11.1}%",
            chunk, gpu_ms, cpu_ms, total_ms, overhead_pct
        );
    }
}
