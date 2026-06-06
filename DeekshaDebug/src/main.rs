use std::time::Instant;
use rayon::prelude::*;

fn simulate_gpu_s4(chunk: usize) -> Vec<u8> {
    // Simulate GPU s4 kernel: fixed overhead + small per-item cost
    // Scaled down 10x for benchmark speed (real = 850 ms, bench = 85 ms)
    let gpu_overhead_ms = 85u64;
    let gpu_per_item_us = 1u64;
    let gpu_us = gpu_overhead_ms * 1000 + (chunk as u64) * gpu_per_item_us;
    std::thread::sleep(std::time::Duration::from_micros(gpu_us));

    // deterministically fill s4 data
    let mut s4_data = vec![0u8; chunk * 64];
    for i in 0..s4_data.len() {
        s4_data[i] = ((i * 7 + 13) % 256) as u8;
    }
    s4_data
}

fn cpu_process_chunk(
    s4_data: &[u8],
    chunk: usize,
    epoch: u64,
    target_threshold: u8,
) -> Vec<(usize, [u8; 32])> {
    let mut solutions = Vec::new();
    for i in 0..chunk {
        let s4_slice = &s4_data[i * 64..(i + 1) * 64];
        let s4_arr: &[u8; 64] = s4_slice.try_into().unwrap();
        let s5 = zion_cosmic_harmony::algorithms_npu::npu_mixing_step_epoch(s4_arr, epoch);
        let hash = zion_cosmic_harmony::algorithms_opt::cosmic_fusion_opt_rounds(&s5, 8);
        if hash.data[0] < target_threshold {
            solutions.push((i, hash.data));
        }
    }
    solutions
}

fn cpu_process_chunk_par(
    s4_data: &[u8],
    chunk: usize,
    epoch: u64,
    target_threshold: u8,
) -> Vec<(usize, [u8; 32])> {
    (0..chunk)
        .into_par_iter()
        .filter_map(|i| {
            let s4_slice = &s4_data[i * 64..(i + 1) * 64];
            let s4_arr: &[u8; 64] = s4_slice.try_into().unwrap();
            let s5 = zion_cosmic_harmony::algorithms_npu::npu_mixing_step_epoch(s4_arr, epoch);
            let hash = zion_cosmic_harmony::algorithms_opt::cosmic_fusion_opt_rounds(&s5, 8);
            if hash.data[0] < target_threshold {
                Some((i, hash.data))
            } else {
                None
            }
        })
        .collect()
}

fn main() {
    let epoch: u64 = 0;
    let target_threshold: u8 = 0x10;
    let total_nonces: usize = 20_000;

    let chunk_sizes = [256, 512, 1024, 2048, 4096, 6128];

    println!("=== Deeksha s4-mode throughput benchmark ===");
    println!("Simulated GPU overhead = 850 ms + 10 us/item");
    println!();

    for &chunk in &chunk_sizes {
        let batches = (total_nonces + chunk - 1) / chunk;

        // --- Sequential CPU ---
        let t0 = Instant::now();
        let mut seq_tested = 0usize;
        for _ in 0..batches {
            let s4_data = simulate_gpu_s4(chunk);
            let sols = cpu_process_chunk(&s4_data, chunk, epoch, target_threshold);
            seq_tested += chunk;
            if !sols.is_empty() {
                break;
            }
        }
        let seq_ms = t0.elapsed().as_millis() as f64;
        let seq_hps = (seq_tested as f64) / (seq_ms / 1000.0);

        // --- Parallel CPU ---
        let t1 = Instant::now();
        let mut par_tested = 0usize;
        for _ in 0..batches {
            let s4_data = simulate_gpu_s4(chunk);
            let sols = cpu_process_chunk_par(&s4_data, chunk, epoch, target_threshold);
            par_tested += chunk;
            if !sols.is_empty() {
                break;
            }
        }
        let par_ms = t1.elapsed().as_millis() as f64;
        let par_hps = (par_tested as f64) / (par_ms / 1000.0);

        // --- Pipelined (double-buffer) ---
        // In a real miner we could launch the NEXT GPU batch while CPU
        // processes the PREVIOUS one.  Simulate with overlap factor.
        let t2 = Instant::now();
        let mut pipe_tested = 0usize;
        // Heuristic: overlap = GPU time * 0.9 (CPU is now fast enough)
        // So effective per-batch time ≈ max(gpu, cpu_par)
        let gpu_ms = 85.0 + (chunk as f64) * 0.001; // ms
        let cpu_par_ms = par_ms / batches as f64;
        let batch_ms = gpu_ms.max(cpu_par_ms);
        for _ in 0..batches {
            std::thread::sleep(std::time::Duration::from_millis(batch_ms as u64));
            pipe_tested += chunk;
        }
        let pipe_ms = t2.elapsed().as_millis() as f64;
        let pipe_hps = (pipe_tested as f64) / (pipe_ms / 1000.0);

        println!(
            "chunk={:4} seq={:7.0} h/s  par={:7.0} h/s  pipe={:7.0} h/s  (seq/par speedup={:.1}x)",
            chunk, seq_hps, par_hps, pipe_hps, seq_hps / par_hps
        );
    }
}
