/// GPU vs CPU step-by-step verification for DeekshaLite v1
///
/// Builds the OpenCL kernel, runs it for 16 nonces, and compares
/// GPU output against the CPU reference in deeksha_debug::deeksha_lite.
///
/// On mismatch, prints intermediate CPU values (s1,s2,s3) so you
/// can identify which step diverges.

use ocl::{ProQue, Buffer, MemFlags};
use deeksha_debug::deeksha_lite::{deeksha_lite, deeksha_lite_debug};

fn hex(b: &[u8]) -> String { b.iter().map(|x| format!("{:02x}", x)).collect() }

fn main() {
    println!("=== DeekshaLite v1 — OpenCL GPU vs CPU Step-by-Step Test ===");
    println!();

    let header      = b"ZION_DEEKSHA_LITE_TEST_HEADER";
    let header_len  = header.len() as u32;
    let nonce_base: u64 = 0x123456789ABCDEF0;
    let nonce_count: u32 = 16;
    let scratchpad_size: usize = 128 * 1024; // 128 KiB per thread

    let kernel_src = include_str!("../../kernels/deeksha_lite.cl");

    println!("Building OpenCL program...");
    let pro_que = ProQue::builder()
        .src(kernel_src)
        .dims(nonce_count as usize)
        .build()
        .expect("Failed to build OpenCL program. Check kernel compile errors.");

    let device = pro_que.device();
    println!("Device: {}", device.name().unwrap_or("unknown".to_string()));
    println!();

    // Prepare header buffer (padded to 88 bytes)
    let mut header_padded = [0u8; 88];
    header_padded[..header.len()].copy_from_slice(header);

    let header_buf: Buffer<u8> = Buffer::builder()
        .queue(pro_que.queue().clone())
        .flags(MemFlags::READ_ONLY)
        .len(88)
        .copy_host_slice(&header_padded)
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

    let kernel = pro_que
        .kernel_builder("deeksha_lite_mine")
        .arg(&header_buf)
        .arg(header_len)
        .arg(nonce_base)
        .arg(nonce_count)
        .arg(&output_buf)
        .arg(&scratchpad_buf)
        .build()
        .unwrap();

    println!("Running GPU kernel ({} nonces)...", nonce_count);
    let t0 = std::time::Instant::now();
    unsafe { kernel.enq().unwrap(); }
    let gpu_ms = t0.elapsed().as_millis();

    let mut gpu_output = vec![0u8; (nonce_count as usize) * 32];
    output_buf.read(&mut gpu_output).enq().unwrap();
    println!("GPU time: {} ms", gpu_ms);
    println!();

    println!("Running CPU reference ({} nonces)...", nonce_count);
    let t1 = std::time::Instant::now();
    let mut all_match = true;
    let mut first_mismatch: Option<usize> = None;

    for i in 0..nonce_count as usize {
        let nonce = nonce_base + i as u64;
        let cpu_hash = deeksha_lite(header, nonce);
        let gpu_hash = &gpu_output[i * 32..(i + 1) * 32];

        if cpu_hash.as_slice() != gpu_hash {
            all_match = false;
            if first_mismatch.is_none() { first_mismatch = Some(i); }
            println!("  nonce {:#018x}: MISMATCH", nonce);
            println!("    GPU: {}", hex(gpu_hash));
            println!("    CPU: {}", hex(&cpu_hash));
        } else {
            println!("  nonce {:#018x}: MATCH  {}", nonce, hex(&cpu_hash[..8]));
        }
    }
    let cpu_ms = t1.elapsed().as_millis();
    println!("CPU time: {} ms", cpu_ms);
    println!();

    if all_match {
        println!("ALL {} nonces MATCH — GPU and CPU are identical!", nonce_count);
    } else {
        println!("MISMATCHES detected! Printing step-by-step CPU debug for first mismatch:");
        let idx = first_mismatch.unwrap();
        let nonce = nonce_base + idx as u64;
        let (s1, s2, s3, s4) = deeksha_lite_debug(header, nonce);
        println!("  nonce : {:#018x}", nonce);
        println!("  s1    : {}", hex(&s1));
        println!("  s2    : {}", hex(&s2));
        println!("  s3    : {}", hex(&s3));
        println!("  s4    : {}", hex(&s4));
        println!();
        println!("Compare s1/s2/s3 against GPU intermediate outputs (if available).");
        std::process::exit(1);
    }

    // ---- Throughput benchmark ----
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

    let bench_kernel = pro_que
        .kernel_builder("deeksha_lite_mine")
        .global_work_size(bench_count as usize)
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
    pro_que.queue().finish().unwrap();

    let t2 = std::time::Instant::now();
    unsafe { bench_kernel.enq().unwrap(); }
    pro_que.queue().finish().unwrap();
    let bench_ms = t2.elapsed().as_millis() as f64;
    let hps = (bench_count as f64) / (bench_ms / 1000.0);
    println!("GPU: {} nonces in {:.1} ms = {:.0} H/s", bench_count, bench_ms, hps);
    println!("Estimated effective (80% pool overhead): {:.0} H/s", hps * 0.8);
}
