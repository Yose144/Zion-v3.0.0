use ocl::{ProQue, Buffer, MemFlags};
use deeksha_debug::deeksha_lite;

fn main() {
    println!("=== DeekshaLite v1 — OpenCL GPU vs CPU Test ===");
    println!();

    // Load kernel source
    let kernel_src = include_str!("../../kernels/deeksha_lite.cl");

    // Build OpenCL program
    let pro_que = ProQue::builder()
        .src(kernel_src)
        .dims(1)
        .build()
        .expect("Failed to build OpenCL program");

    let device = pro_que.device();
    println!("Device: {}", device.name().unwrap_or("unknown".into()));

    // Test parameters
    let header = b"ZION_DEEKSHA_LITE_TEST_HEADER";
    let header_len = header.len() as u32;
    let nonce_base: u64 = 0x123456789ABCDEF0;
    let nonce_count: u32 = 16;
    let scratchpad_size: usize = 128 * 1024; // 128 KiB per thread

    // Allocate buffers
    let header_buf: Buffer<u8> = Buffer::builder()
        .queue(pro_que.queue().clone())
        .flags(MemFlags::READ_ONLY)
        .len(88)
        .copy_host_slice(&{
            let mut h = [0u8; 88];
            h[..header.len()].copy_from_slice(header);
            h
        })
        .build()
        .unwrap();

    let output_buf: Buffer<u8> = Buffer::builder()
        .queue(pro_que.queue().clone())
        .len((nonce_count as usize) * 32)
        .build()
        .unwrap();

    let scratchpad_buf: Buffer<u8> = Buffer::builder()
        .queue(pro_que.queue().clone())
        .len((nonce_count as usize) * scratchpad_size)
        .build()
        .unwrap();

    // Create kernel
    let kernel = pro_que.kernel_builder("deeksha_lite_mine")
        .arg(&header_buf)
        .arg(header_len)
        .arg(nonce_base)
        .arg(nonce_count)
        .arg(&output_buf)
        .arg(&scratchpad_buf)
        .build()
        .unwrap();

    // Execute
    println!("Running GPU kernel...");
    let t0 = std::time::Instant::now();
    unsafe { kernel.enq().unwrap(); }
    let gpu_ms = t0.elapsed().as_millis();

    // Read output
    let mut gpu_output = vec![0u8; (nonce_count as usize) * 32];
    output_buf.read(&mut gpu_output).enq().unwrap();

    println!("GPU time: {} ms", gpu_ms);
    println!();

    // CPU reference
    println!("Running CPU reference...");
    let t1 = std::time::Instant::now();
    let mut cpu_output = vec![0u8; (nonce_count as usize) * 32];
    for i in 0..nonce_count as u64 {
        let hash = deeksha_lite::deeksha_lite(header, nonce_base + i);
        cpu_output[(i as usize) * 32..(i as usize + 1) * 32].copy_from_slice(&hash);
    }
    let cpu_ms = t1.elapsed().as_millis();

    println!("CPU time: {} ms", cpu_ms);
    println!();

    // Compare
    println!("Comparing GPU vs CPU...");
    let mut all_match = true;
    for i in 0..nonce_count as usize {
        let gpu_hash = &gpu_output[i * 32..(i + 1) * 32];
        let cpu_hash = &cpu_output[i * 32..(i + 1) * 32];
        let matches = gpu_hash == cpu_hash;

        if !matches {
            all_match = false;
            println!("  nonce {}: MISMATCH", nonce_base + (i as u64));
            println!("    GPU: {}", hex::encode(gpu_hash));
            println!("    CPU: {}", hex::encode(cpu_hash));
        }
    }

    if all_match {
        println!("  All {} nonces MATCH! ✓", nonce_count);
    } else {
        println!("  MISMATCHES detected!");
        std::process::exit(1);
    }

    // Benchmark
    println!();
    println!("=== Throughput Benchmark ===");
    let bench_count: u32 = 4096;
    let bench_scratch: Buffer<u8> = Buffer::builder()
        .queue(pro_que.queue().clone())
        .len((bench_count as usize) * scratchpad_size)
        .build()
        .unwrap();
    let bench_output: Buffer<u8> = Buffer::builder()
        .queue(pro_que.queue().clone())
        .len((bench_count as usize) * 32)
        .build()
        .unwrap();

    let bench_kernel = pro_que.kernel_builder("deeksha_lite_mine")
        .arg(&header_buf)
        .arg(header_len)
        .arg(0u64)
        .arg(bench_count)
        .arg(&bench_output)
        .arg(&bench_scratch)
        .build()
        .unwrap();

    // Warm-up
    unsafe { bench_kernel.enq().unwrap(); }

    let t2 = std::time::Instant::now();
    unsafe { bench_kernel.enq().unwrap(); }
    let bench_ms = t2.elapsed().as_millis() as f64;
    let hps = (bench_count as f64) / (bench_ms / 1000.0);

    println!("GPU: {} nonces in {:.1} ms = {:.0} H/s", bench_count, bench_ms, hps);

    // Estimate effective pool hashrate (with network overhead)
    let effective_hps = hps * 0.8; // 20% overhead for pool communication
    println!("Estimated effective: {:.0} H/s", effective_hps);
}
