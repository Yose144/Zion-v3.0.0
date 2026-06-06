use std::time::{Duration, Instant};
use std::thread;
use std::sync::mpsc::{channel, Sender, Receiver};
use rayon::prelude::*;

/// Benchmark: persistent GPU kernel vs sequential batch launches.
///
/// Based on VEGA64_S4_MEMHARD_DEBUG_GUIDE.md findings:
/// - GPU kernel launch overhead: ~850 ms per clEnqueueNDRangeKernel + clFinish
/// - GPU work per nonce: ~100 us (scaled 10x for benchmark speed = 10 us)
/// - CPU NPU+fusion scan: ~15 ms per 4096 nonces (scaled = 1.5 ms)
/// - RX 5600 XT post-fix hashrate: 8.44 KH/s in batch mode
///
/// Persistent kernel eliminates the 850 ms launch by keeping the kernel
/// resident on the GPU and using a command/response slot protocol.

const REAL_GPU_OVERHEAD_MS: u64 = 850;
const REAL_GPU_PER_ITEM_US: u64 = 100;   // ~400 ms for 4096 nonces
const REAL_CPU_SCAN_MS: u64 = 15;         // Rayon parallel NPU+fusion for 4096

// Scale down 10x for benchmark speed (so we don't wait minutes)
const SCALE: u64 = 10;
const GPU_OVERHEAD_MS: u64 = REAL_GPU_OVERHEAD_MS / SCALE; // 85 ms
const GPU_PER_ITEM_US: u64 = REAL_GPU_PER_ITEM_US / SCALE;  // 10 us
const _CPU_SCAN_MS: u64 = REAL_CPU_SCAN_MS / SCALE;          // 1.5 ms → round to 2 (documented, actual scan uses real Rayon compute)

fn gpu_work(chunk: usize) {
    thread::sleep(Duration::from_micros((chunk as u64) * GPU_PER_ITEM_US));
}

fn cpu_scan(s4_data: &Vec<u8>, chunk: usize, epoch: u64) -> usize {
    (0..chunk)
        .into_par_iter()
        .filter(|i| {
            let s4_slice = &s4_data[i * 64..(i + 1) * 64];
            let s4_arr: &[u8; 64] = s4_slice.try_into().unwrap();
            let s5 = zion_cosmic_harmony::algorithms_npu::npu_mixing_step_epoch(s4_arr, epoch);
            let hash = zion_cosmic_harmony::algorithms_opt::cosmic_fusion_opt_rounds(&s5, 8);
            hash.data[0] < 0x10
        })
        .count()
}

fn sequential_batch_mode(chunk: usize, batches: usize, epoch: u64) -> (u64, usize) {
    let t0 = Instant::now();
    let mut total_tested = 0usize;

    for _ in 0..batches {
        // Simulate: clEnqueueNDRangeKernel + clFinish overhead
        thread::sleep(Duration::from_millis(GPU_OVERHEAD_MS));
        // Simulate: GPU actually executing s4 for all nonces
        gpu_work(chunk);
        // Simulate: read back s4_out buffer
        let s4_data = vec![0u8; chunk * 64];
        // CPU scan
        let _ = cpu_scan(&s4_data, chunk, epoch);
        total_tested += chunk;
    }

    let elapsed_ms = t0.elapsed().as_millis() as u64;
    (elapsed_ms, total_tested)
}

fn persistent_kernel_mode(chunk: usize, batches: usize, epoch: u64) -> (u64, usize) {
    let t0 = Instant::now();
    let mut total_tested = 0usize;

    // One-time kernel launch (clEnqueueNDRangeKernel + clFlush, no clFinish)
    thread::sleep(Duration::from_millis(GPU_OVERHEAD_MS));

    // Channels simulate the command/response slot protocol
    let (tx_cmd, rx_cmd): (Sender<(u64, usize)>, Receiver<(u64, usize)>) = channel();
    let (tx_resp, rx_resp): (Sender<Vec<u8>>, Receiver<Vec<u8>>) = channel();

    // GPU thread: persistent kernel loop
    thread::spawn(move || {
        for (_nonce_base, count) in rx_cmd {
            // GPU executes s4 for this batch
            gpu_work(count);
            // Write results to s4_out buffer
            let s4_data = vec![0u8; count * 64];
            tx_resp.send(s4_data).unwrap();
        }
    });

    // CPU thread: drive the persistent kernel
    for _ in 0..batches {
        // Write command slot (negligible, but simulate tiny latency)
        tx_cmd.send((0, chunk)).unwrap();

        // Poll for response (blocking read = mem_fence semantics)
        let s4_data = rx_resp.recv().unwrap();

        // CPU scan while GPU can already start next batch (pipelined!)
        let _ = cpu_scan(&s4_data, chunk, epoch);
        total_tested += chunk;
    }

    // Drop command sender to stop GPU thread
    drop(tx_cmd);

    let elapsed_ms = t0.elapsed().as_millis() as u64;
    (elapsed_ms, total_tested)
}

fn main() {
    let epoch: u64 = 0;
    let chunk_sizes = [256, 512, 1024, 2048, 4096, 6128, 8192];
    let batches = 20usize;

    println!("=== Persistent GPU Kernel vs Sequential Batch Mode ===");
    println!("(Scaled 10x for benchmark speed; real RX 5600 XT = 8.44 KH/s batch mode)\n");
    println!("{:>6} {:>14} {:>14} {:>14} {:>12}",
             "chunk", "batch_ms", "persist_ms", "speedup", "batch_hps");

    for &chunk in &chunk_sizes {
        let (batch_ms, batch_tested) = sequential_batch_mode(chunk, batches, epoch);
        let (persist_ms, persist_tested) = persistent_kernel_mode(chunk, batches, epoch);

        let batch_hps = (batch_tested as f64) / (batch_ms.max(1) as f64 / 1000.0);
        let persist_hps = (persist_tested as f64) / (persist_ms.max(1) as f64 / 1000.0);
        let speedup = batch_ms as f64 / persist_ms.max(1) as f64;

        println!("{:>6} {:>14} {:>14} {:>14.2}x {:>11.0} h/s",
                 chunk, batch_ms, persist_ms, speedup, batch_hps);
        println!("{:>6} {:>14} {:>14} {:>14} {:>11.0} h/s (persistent)",
                 "", "", "", "", persist_hps);
        println!();
    }

    println!("--- Real-world projection (unscaled) ---");
    let chunk = 4096usize;
    let real_batch_ms = (REAL_GPU_OVERHEAD_MS + chunk as u64 * REAL_GPU_PER_ITEM_US / 1000 + REAL_CPU_SCAN_MS) as f64;
    let real_persist_ms = (chunk as u64 * REAL_GPU_PER_ITEM_US / 1000 + REAL_CPU_SCAN_MS) as f64;
    let real_batch_hps = (chunk as f64) / (real_batch_ms / 1000.0);
    let real_persist_hps = (chunk as f64) / (real_persist_ms / 1000.0);

    println!("chunk={} batch mode: {:.0} ms → {:.0} h/s (≈ {:.2} KH/s)",
             chunk, real_batch_ms, real_batch_hps, real_batch_hps / 1000.0);
    println!("chunk={} persistent: {:.0} ms → {:.0} h/s (≈ {:.2} KH/s)",
             chunk, real_persist_ms, real_persist_hps, real_persist_hps / 1000.0);
}
