use ocl::{ProQue, Buffer};
use rayon::prelude::*;
use std::time::{Duration, Instant};
use zion_cosmic_harmony::gpu::opencl_kernel;
use zion_cosmic_harmony::algorithms_npu::npu_mixing_step_epoch;
use zion_cosmic_harmony::algorithms_opt::cosmic_fusion_opt_rounds;
use zion_core::{DifficultyTarget, MiningHeader};

const SCRATCHPAD_BYTES: usize = 262_144;

fn main() {
    println!("=== S4 Pipeline Benchmark ===\n");

    let platform = ocl::Platform::default();
    let devices = ocl::Device::list_all(&platform).expect("no devices");
    let mut target: Option<ocl::Device> = None;
    for d in &devices {
        let name = d.name().unwrap_or_default();
        if name.to_ascii_lowercase().contains("gfx10") {
            target = Some(*d);
            println!("Device: {}", name);
        }
    }
    let device = target.expect("no gfx10 device found");

    let kernel_src = opencl_kernel::get_deeksha_kernel_source().to_string();
    let pro_que = ProQue::builder()
        .src(kernel_src)
        .device(device)
        .dims(4096usize)
        .build()
        .expect("ProQue build failed");
    let q = pro_que.queue();

    let header_buf = Buffer::<u8>::builder()
        .queue(q.clone())
        .len(80)
        .build()
        .expect("header buf failed");
    let scratchpad_buf = Buffer::<u8>::builder()
        .queue(q.clone())
        .len(4096 * SCRATCHPAD_BYTES)
        .build()
        .expect("scratchpad buf failed");
    let s4_out = Buffer::<u8>::builder()
        .queue(q.clone())
        .len(4096 * 64)
        .build()
        .expect("s4_out buf failed");

    let s4_kernel = pro_que
        .kernel_builder(opencl_kernel::EKAM_DEEKSHA_S4_KERNEL_NAME)
        .arg(&header_buf)
        .arg(80u32)
        .arg(0u64)
        .arg(4096u32)
        .arg(&scratchpad_buf)
        .arg(&s4_out)
        .build()
        .expect("s4 kernel build failed");

    let dummy_header = MiningHeader {
        version: 3,
        previous_hash: [0xAA; 32],
        merkle_root: [0xBB; 32],
        timestamp: 1234567890,
        difficulty_bits: 0x1d00ffff,
    };
    let header_bytes = dummy_header.to_bytes();
    header_buf.write(&header_bytes[..]).enq().unwrap();
    q.finish().unwrap();

    let epoch = 0u64;
    let target = DifficultyTarget::from_hex("0000ffff00000000000000000000000000000000000000000000000000000000").unwrap();

    // Test different (work_size, local_work_size) combinations
    for &(ws, lws) in &[(4096usize, 128usize), (8192, 128), (8192, 64)] {
        let wg = ws / lws;
        println!("\n--- work_size={} local_work_size={} => {} work-groups ---", ws, lws, wg);

        // Re-alloc buffers for this work_size
        let scratchpad_buf = Buffer::<u8>::builder()
            .queue(q.clone())
            .len(ws * SCRATCHPAD_BYTES)
            .build()
            .expect("scratchpad buf failed");
        let s4_out = Buffer::<u8>::builder()
            .queue(q.clone())
            .len(ws * 64)
            .build()
            .expect("s4_out buf failed");
        let s4k = pro_que
            .kernel_builder(opencl_kernel::EKAM_DEEKSHA_S4_KERNEL_NAME)
            .arg(&header_buf)
            .arg(80u32)
            .arg(0u64)
            .arg(ws as u32)
            .arg(&scratchpad_buf)
            .arg(&s4_out)
            .build()
            .expect("s4 kernel build failed");

        let batches = 2usize;
        let mut gpu_times = Vec::new();

        for b in 0..batches {
            s4k.set_arg(2, b as u64 * ws as u64).unwrap();

            let t0 = Instant::now();
            unsafe {
                s4k.cmd()
                    .global_work_size(ws)
                    .local_work_size(lws)
                    .enq()
                    .unwrap();
            }
            q.finish().unwrap();
            let gpu_time = t0.elapsed();
            gpu_times.push(gpu_time);

            let mut s4_data = vec![0u8; ws * 64];
            s4_out.read(&mut s4_data).enq().unwrap();
            q.finish().unwrap();

            // light CPU work (not timed, just to keep GPU busy)
            let _: Vec<_> = (0..ws)
                .into_par_iter()
                .filter_map(|i| {
                    let s4_slice = &s4_data[i * 64..(i + 1) * 64];
                    let s4_arr: &[u8; 64] = s4_slice.try_into().unwrap();
                    let s5 = npu_mixing_step_epoch(s4_arr, epoch);
                    let hash = cosmic_fusion_opt_rounds(&s5, 8);
                    if target.allows(&hash.data) {
                        Some((i, hash.data))
                    } else {
                        None
                    }
                })
                .collect();

            println!("batch={} gpu_exec={:?}", b, gpu_time);
        }

        fn avg(v: &[Duration]) -> Duration {
            v.iter().sum::<Duration>() / v.len() as u32
        }
        let avg_gpu = avg(&gpu_times);
        let hashes_per_sec = ws as f64 / avg_gpu.as_secs_f64();
        println!(
            "ws={} lws={}  avg_gpu={:?}  hashrate={:.1} KH/s",
            ws, lws, avg_gpu, hashes_per_sec / 1000.0
        );
    }
}
