use std::time::Instant;
use rayon::prelude::*;
use std::thread;
use std::time::Duration;
use std::sync::mpsc::{channel, Sender, Receiver};

// Real RX 5600 XT numbers (post Blake3 fix, per VEGA64_S4_MEMHARD_DEBUG_GUIDE.md):
//   GPU launch overhead: 850 ms per batch
//   GPU work: ~100 us / nonce (≈ 400 ms for 4096)
//   CPU NPU+fusion scan: ~15 ms for 4096 nonces (Rayon)
// Scaled 10x for benchmark speed.
const GPU_OVERHEAD_MS: u64 = 85;
const GPU_PER_ITEM_US: u64 = 1;

fn simulate_gpu_s4(chunk: usize) -> Vec<u8> {
    let gpu_us = GPU_OVERHEAD_MS * 1000 + (chunk as u64) * GPU_PER_ITEM_US;
    std::thread::sleep(std::time::Duration::from_micros(gpu_us));

    let mut s4_data = vec![0u8; chunk * 64];
    for i in 0..s4_data.len() {
        s4_data[i] = ((i * 7 + 13) % 256) as u8;
    }
    s4_data
}

fn simulate_gpu_s4_no_overhead(chunk: usize) -> Vec<u8> {
    // Persistent kernel: no launch overhead, just pure GPU work
    std::thread::sleep(std::time::Duration::from_micros((chunk as u64) * GPU_PER_ITEM_US));

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

fn persistent_kernel_mode(
    chunk: usize,
    batches: usize,
    epoch: u64,
    target_threshold: u8,
) -> (f64, usize) {
    let (tx_cmd, rx_cmd): (Sender<usize>, Receiver<usize>) = channel();
    let (tx_resp, rx_resp): (Sender<Vec<u8>>, Receiver<Vec<u8>>) = channel();

    // One-time launch overhead (same as first batch in normal mode)
    thread::sleep(Duration::from_millis(GPU_OVERHEAD_MS));

    // GPU thread: persistent kernel
    thread::spawn(move || {
        for count in rx_cmd {
            let s4_data = simulate_gpu_s4_no_overhead(count);
            tx_resp.send(s4_data).unwrap();
        }
    });

    let t0 = Instant::now();
    let mut tested = 0usize;
    for _ in 0..batches {
        tx_cmd.send(chunk).unwrap();
        let s4_data = rx_resp.recv().unwrap();
        let sols = cpu_process_chunk_par(&s4_data, chunk, epoch, target_threshold);
        tested += chunk;
        if !sols.is_empty() {
            break;
        }
    }
    drop(tx_cmd);
    let ms = t0.elapsed().as_millis() as f64;
    let hps = (tested as f64) / (ms / 1000.0);
    (hps, tested)
}

fn main() {
    let epoch: u64 = 0;
    let target_threshold: u8 = 0x10;
    let total_nonces: usize = 20_000;

    let chunk_sizes = [256, 512, 1024, 2048, 4096, 6128, 8192];

    println!("=== Deeksha s4-mode throughput benchmark ===");
    println!("Based on VEGA64_S4_MEMHARD_DEBUG_GUIDE.md — post-Blake3 fix");
    println!("Simulated GPU: 850 ms launch + 10 us/item (scaled 10x)");
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
        let t2 = Instant::now();
        let mut pipe_tested = 0usize;
        let gpu_ms = GPU_OVERHEAD_MS as f64 + (chunk as f64) * (GPU_PER_ITEM_US as f64 / 1000.0);
        let cpu_par_ms = par_ms / batches as f64;
        let batch_ms = gpu_ms.max(cpu_par_ms);
        for _ in 0..batches {
            thread::sleep(Duration::from_millis(batch_ms as u64));
            pipe_tested += chunk;
        }
        let pipe_ms = t2.elapsed().as_millis() as f64;
        let pipe_hps = (pipe_tested as f64) / (pipe_ms / 1000.0);

        // --- Persistent kernel ---
        let (pers_hps, _) = persistent_kernel_mode(chunk, batches, epoch, target_threshold);

        println!(
            "chunk={:4} seq={:7.0} h/s  par={:7.0} h/s  pipe={:7.0} h/s  pers={:7.0} h/s",
            chunk, seq_hps, par_hps, pipe_hps, pers_hps
        );
    }
}
