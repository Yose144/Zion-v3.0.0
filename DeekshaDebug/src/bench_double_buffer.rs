use std::time::{Duration, Instant};
use std::thread;
use std::sync::mpsc::{channel, Sender, Receiver};

/// Benchmark: double-buffering to hide GPU launch latency.
///
/// In the current V3 s4-mode the sequence is:
///   GPU kernel launch -> wait -> read buffer -> CPU scan
///
/// With double buffering we keep TWO s4_out_buf buffers.
/// While CPU scans buffer A, GPU fills buffer B.
/// This overlaps GPU time with CPU time.
///
/// This benchmark simulates that overlap.

fn gpu_simulation(buf: &mut Vec<u8>, chunk: usize, overhead_ms: u64, per_item_us: u64) {
    thread::sleep(Duration::from_millis(overhead_ms));
    thread::sleep(Duration::from_micros((chunk as u64) * per_item_us));
    for i in 0..(chunk * 64) {
        buf[i] = ((i * 7 + 13) % 256) as u8;
    }
}

fn cpu_simulation(buf: &Vec<u8>, chunk: usize, epoch: u64) -> usize {
    use rayon::prelude::*;
    (0..chunk)
        .into_par_iter()
        .filter(|i| {
            let s4_slice = &buf[i * 64..(i + 1) * 64];
            let s4_arr: &[u8; 64] = s4_slice.try_into().unwrap();
            let s5 = zion_cosmic_harmony::algorithms_npu::npu_mixing_step_epoch(s4_arr, epoch);
            let hash = zion_cosmic_harmony::algorithms_opt::cosmic_fusion_opt_rounds(&s5, 8);
            hash.data[0] < 0x10
        })
        .count()
}

fn main() {
    let epoch: u64 = 0;
    let chunk_sizes = [256, 512, 1024, 2048, 4096, 6128];
    let gpu_overhead_ms = 85u64; // scaled 10x for benchmark speed
    let gpu_per_item_us = 1u64;
    let batches = 20usize;

    println!("=== Benchmark: double-buffering vs sequential ===\n");
    println!("{:>6} {:>12} {:>12} {:>12}", "chunk", "seq_ms", "dbuf_ms", "speedup");

    for &chunk in &chunk_sizes {
        // --- Sequential: GPU -> CPU -> GPU -> CPU ... ---
        let t0 = Instant::now();
        let mut buf_a = vec![0u8; 64 * 8192];
        for _ in 0..batches {
            gpu_simulation(&mut buf_a, chunk, gpu_overhead_ms, gpu_per_item_us);
            let _ = cpu_simulation(&buf_a, chunk, epoch);
        }
        let seq_ms = t0.elapsed().as_millis();

        // --- Double-buffer: GPU fills B while CPU scans A ---
        let t1 = Instant::now();
        let (tx_gpu, rx_cpu): (Sender<Vec<u8>>, Receiver<Vec<u8>>) = channel();
        let (tx_cpu, rx_gpu): (Sender<Vec<u8>>, Receiver<Vec<u8>>) = channel();

        // Pre-fill two buffers
        let mut buf_a = vec![0u8; 64 * 8192];
        let mut buf_b = vec![0u8; 64 * 8192];
        gpu_simulation(&mut buf_a, chunk, gpu_overhead_ms, gpu_per_item_us);
        gpu_simulation(&mut buf_b, chunk, gpu_overhead_ms, gpu_per_item_us);

        // Spawn GPU thread
        thread::spawn(move || {
            let mut buf = buf_b;
            for _ in 0..batches {
                gpu_simulation(&mut buf, chunk, gpu_overhead_ms, gpu_per_item_us);
                tx_gpu.send(buf).unwrap();
                buf = match rx_gpu.recv() {
                    Ok(b) => b,
                    Err(_) => break,
                };
            }
        });

        // CPU thread scans and returns buffers
        let mut first = buf_a;
        for _ in 0..batches {
            let _ = cpu_simulation(&first, chunk, epoch);
            tx_cpu.send(first).unwrap();
            first = match rx_cpu.recv() {
                Ok(b) => b,
                Err(_) => break,
            };
        }
        let dbuf_ms = t1.elapsed().as_millis();

        println!(
            "{:>6} {:>12} {:>12} {:>12.2}x",
            chunk, seq_ms, dbuf_ms, seq_ms as f64 / dbuf_ms.max(1) as f64
        );
    }
}
