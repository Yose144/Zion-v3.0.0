use std::time::Instant;
use rayon::prelude::*;

/// Benchmark: heap Vec<u8> vs stack [u8; N] for s4_data staging.
///
/// In s4-mode we read `chunk * 64` bytes from GPU into CPU memory.
/// The current V3 code uses `vec![0u8; chunk * 64]` which allocates
/// on the heap every iteration.  For chunk=6128 that's ~384 KiB
/// per batch — small enough to stay on the stack and avoid
/// allocator contention / cache pollution.
///
/// Hypothesis: replacing the Vec with a fixed-size stack array
/// (or a thread-local reusable buffer) will shave 50-200 us
/// per batch, noticeable when GPU overhead is low.

fn cpu_stage_heap(s4_data: &Vec<u8>, chunk: usize, epoch: u64) -> usize {
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

fn cpu_stage_stack(s4_data: &Box<[u8; 64 * 8192]>, chunk: usize, epoch: u64) -> usize {
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

fn main() {
    let epoch: u64 = 0;
    let chunk_sizes = [256, 512, 1024, 2048, 4096, 6128];

    println!("=== Benchmark: heap Vec vs heap Box<[u8; N]> for s4_data ===\n");
    println!("{:>6} {:>12} {:>12} {:>12}", "chunk", "heap_vec_ms", "heap_box_ms", "speedup");

    for &chunk in &chunk_sizes {
        // deterministically fill s4 data
        let mut s4_data_vec = vec![0u8; chunk * 64];
        let mut s4_data_box = Box::new([0u8; 64 * 8192]);
        for i in 0..(chunk * 64) {
            let v = ((i * 7 + 13) % 256) as u8;
            s4_data_vec[i] = v;
            s4_data_box[i] = v;
        }

        // Warm-up
        let _ = cpu_stage_heap(&s4_data_vec, chunk, epoch);
        let _ = cpu_stage_stack(&s4_data_box, chunk, epoch);

        // Heap Vec
        let t0 = Instant::now();
        for _ in 0..100 {
            let mut v = vec![0u8; chunk * 64];
            v.copy_from_slice(&s4_data_vec[..chunk * 64]);
            let _ = cpu_stage_heap(&v, chunk, epoch);
        }
        let heap_vec_ms = t0.elapsed().as_millis();

        // Heap Box (fixed size, avoids allocator indirection)
        let t1 = Instant::now();
        for _ in 0..100 {
            let mut s = Box::new([0u8; 64 * 8192]);
            s[..chunk * 64].copy_from_slice(&s4_data_vec[..chunk * 64]);
            let _ = cpu_stage_stack(&s, chunk, epoch);
        }
        let heap_box_ms = t1.elapsed().as_millis();

        println!(
            "{:>6} {:>12} {:>12} {:>12.2}x",
            chunk, heap_vec_ms, heap_box_ms, heap_vec_ms as f64 / heap_box_ms.max(1) as f64
        );
    }
}
