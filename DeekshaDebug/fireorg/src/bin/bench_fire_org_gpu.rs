//! Unified GPU + CPU benchmark and cross-check for DeekshaLite Fire Org.
//!
//!   1. Verifies CPU == GPU for 16 test nonces (cross-check).
//!   2. Benchmarks GPU throughput (4096 nonces, warmed up).
//!   3. Benchmarks CPU throughput (single-threaded, 200 nonces).
//!
//! Usage:
//!   cargo run --release -p deeksha-fire-org --features gpu --bin bench_fire_org_gpu
//!
//! Exit code 0 = all cross-checks passed.
//! Exit code 1 = CPU/GPU mismatch detected.

#[cfg(feature = "gpu")]
mod inner {
    use deeksha_fire_org::deeksha_lite_fire_org;
    use ocl::{Buffer, MemFlags, ProQue};

    fn hex(b: &[u8]) -> String {
        b.iter().map(|x| format!("{:02x}", x)).collect()
    }

    fn hex8(b: &[u8]) -> String {
        hex(&b[..8.min(b.len())])
    }

    struct AlgoResult {
        all_match: bool,
        gpu_throughput: f64, // H/s
        cpu_throughput: f64, // H/s
    }

    fn run_algo(
        name: &str,
        kernel_src: &str,
        kernel_fn: &str,
        scratchpad_bytes: usize,
        cpu_fn: fn(&[u8], u64) -> [u8; 32],
    ) -> AlgoResult {
        let header: &[u8] = b"ZION_DEEKSHA_FIRE_ORG_BENCH_HEADER_V1";
        let nonce_base: u64 = 0xDEADBEEFCAFEBABE;
        let check_count: u32 = 16;
        let bench_count: u32 = 4096;
        let cpu_bench_count: u64 = 200;

        println!("────────────────────────────────────────────────────");
        println!("  Algorithm : {}", name);
        println!("  Scratchpad: {} KiB/thread", scratchpad_bytes / 1024);
        println!("────────────────────────────────────────────────────");

        // Build OpenCL program
        print!("  Building OpenCL program... ");
        let pro_que = match ProQue::builder()
            .src(kernel_src)
            .dims(check_count as usize)
            .build()
        {
            Ok(pq) => {
                println!("ok");
                pq
            }
            Err(e) => {
                println!("FAILED: {}", e);
                return AlgoResult {
                    all_match: false,
                    gpu_throughput: 0.0,
                    cpu_throughput: 0.0,
                };
            }
        };
        let device = pro_que.device();
        println!(
            "  GPU device: {}",
            device.name().unwrap_or_else(|_| "unknown".to_string())
        );

        let mut header_padded = [0u8; 80];
        let hcopy = header.len().min(80);
        header_padded[..hcopy].copy_from_slice(&header[..hcopy]);

        let header_buf: Buffer<u8> = Buffer::builder()
            .queue(pro_que.queue().clone())
            .flags(MemFlags::READ_ONLY)
            .len(80)
            .copy_host_slice(&header_padded)
            .build()
            .unwrap();

        let output_buf: Buffer<u8> = Buffer::builder()
            .queue(pro_que.queue().clone())
            .len((check_count as usize) * 32)
            .build()
            .unwrap();

        let scratch_buf: Buffer<u8> = Buffer::builder()
            .queue(pro_que.queue().clone())
            .len((check_count as usize) * scratchpad_bytes)
            .build()
            .unwrap();

        let kernel = pro_que
            .kernel_builder(kernel_fn)
            .arg(&header_buf)
            .arg(hcopy as u32)
            .arg(nonce_base)
            .arg(check_count)
            .arg(&output_buf)
            .arg(&scratch_buf)
            .build()
            .unwrap();

        // Cross-check: CPU == GPU
        println!();
        println!("  Cross-check ({} nonces):", check_count);
        let t_gpu = std::time::Instant::now();
        unsafe {
            kernel.enq().unwrap();
        }
        pro_que.queue().finish().unwrap();
        let gpu_check_ms = t_gpu.elapsed().as_millis();

        let mut gpu_out = vec![0u8; (check_count as usize) * 32];
        output_buf.read(&mut gpu_out).enq().unwrap();

        let mut all_match = true;
        for i in 0..check_count as usize {
            let nonce = nonce_base + i as u64;
            let cpu_hash = cpu_fn(header, nonce);
            let gpu_hash = &gpu_out[i * 32..(i + 1) * 32];
            if cpu_hash.as_slice() != gpu_hash {
                all_match = false;
                println!("    nonce {:016x}: MISMATCH", nonce);
                println!("      CPU: {}", hex(&cpu_hash));
                println!("      GPU: {}", hex(gpu_hash));
            } else {
                println!("    nonce {:016x}: ok  {}", nonce, hex8(&cpu_hash));
            }
        }
        if all_match {
            println!(
                "  -> All {} nonces match! (GPU time {}ms)",
                check_count, gpu_check_ms
            );
        } else {
            println!("  -> MISMATCH DETECTED — CPU and GPU produce different hashes!");
        }

        // GPU throughput benchmark
        println!();
        println!("  GPU throughput benchmark ({} nonces):", bench_count);
        let bench_scratch: Buffer<u8> = Buffer::builder()
            .queue(pro_que.queue().clone())
            .len((bench_count as usize) * scratchpad_bytes)
            .build()
            .unwrap();
        let bench_output: Buffer<u8> = Buffer::builder()
            .queue(pro_que.queue().clone())
            .len((bench_count as usize) * 32)
            .build()
            .unwrap();

        let bench_kernel = pro_que
            .kernel_builder(kernel_fn)
            .global_work_size(bench_count as usize)
            .arg(&header_buf)
            .arg(hcopy as u32)
            .arg(0u64)
            .arg(bench_count)
            .arg(&bench_output)
            .arg(&bench_scratch)
            .build()
            .unwrap();

        // Warm-up
        unsafe {
            bench_kernel.enq().unwrap();
        }
        pro_que.queue().finish().unwrap();

        let t_bench = std::time::Instant::now();
        unsafe {
            bench_kernel.enq().unwrap();
        }
        pro_que.queue().finish().unwrap();
        let bench_ms = t_bench.elapsed().as_millis() as f64;
        let gpu_hps = (bench_count as f64) / (bench_ms / 1000.0);
        println!(
            "  -> {:.0} H/s  ({} nonces in {:.1} ms)",
            gpu_hps, bench_count, bench_ms
        );

        // CPU throughput benchmark
        println!();
        println!(
            "  CPU throughput benchmark ({} nonces, single-threaded):",
            cpu_bench_count
        );
        let t_cpu = std::time::Instant::now();
        for i in 0..cpu_bench_count {
            let _ = cpu_fn(header, i);
        }
        let cpu_ms = t_cpu.elapsed().as_millis() as f64;
        let cpu_hps = (cpu_bench_count as f64) / (cpu_ms / 1000.0);
        println!(
            "  -> {:.0} H/s  ({} nonces in {:.1} ms)",
            cpu_hps, cpu_bench_count, cpu_ms
        );

        println!();
        AlgoResult {
            all_match,
            gpu_throughput: gpu_hps,
            cpu_throughput: cpu_hps,
        }
    }

    pub fn run() {
        println!("====================================================================");
        println!("  Deeksha Fire Org — Original Winter Heater benchmark suite");
        println!("====================================================================");
        println!();
        println!("  Purpose : verify CPU == GPU, measure throughput");
        println!("  Profile = 128 KiB scratchpad, 2 passes, 32 reads, 3 AES rounds");
        println!("            131072-iter thermal loop, 12 ulong chains");
        println!();

        let fire_src = include_str!("../../kernels/deeksha_lite_fire_org.cl");

        let fire_result = run_algo(
            "DeekshaLite Fire Org (winter heater)",
            fire_src,
            "deeksha_lite_fire_org_mine",
            128 * 1024,
            deeksha_lite_fire_org,
        );

        // Summary
        println!("====================================================================");
        println!("  SUMMARY");
        println!("====================================================================");
        println!();
        println!("  {:40} {:10} {:10}", "Algorithm", "GPU H/s", "CPU H/s");
        println!("  {:40} {:10} {:10}", "---------", "-------", "-------");
        println!(
            "  {:40} {:10.0} {:10.0}",
            "Fire Org (winter heater)",
            fire_result.gpu_throughput,
            fire_result.cpu_throughput
        );
        println!();

        let fire_status = if fire_result.all_match {
            "PASS"
        } else {
            "FAIL (CPU/GPU mismatch)"
        };
        println!("  Cross-check Fire : {}", fire_status);
        println!();

        if !fire_result.all_match {
            println!("  RESULT: FAILED — fix CPU/GPU mismatch before V3 migration.");
            std::process::exit(1);
        }

        println!("  RESULT: ALL CHECKS PASSED");
        println!();
        println!("  Next steps:");
        println!("    1. Review throughput numbers above");
        println!("    2. If heat is satisfactory, migrate to V3/L1/cosmic-harmony");
        println!("    3. Update deeksha_lite_fire.rs + deeksha_lite_fire.cl in V3");
        println!("    4. Run V3 unit tests: cargo test -p zion-core");
    }
}

#[cfg(feature = "gpu")]
fn main() {
    inner::run();
}

#[cfg(not(feature = "gpu"))]
fn main() {
    println!("GPU benchmark requires the 'gpu' feature.");
    println!(
        "Run: cargo run --release -p deeksha-fire-org --features gpu --bin bench_fire_org_gpu"
    );
}
