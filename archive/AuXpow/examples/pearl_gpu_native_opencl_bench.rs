//! Benchmark: OpenCL GPU-native Pearl PoUW pipeline vs CPU-only path.
//! Measures end-to-end time per nonce for both approaches on AMD RX 5700 XT (ROCm).
//!
//! Run with:
//!   cargo run --release --features gpu-opencl --example pearl_gpu_native_opencl_bench
//!   PEARL_PROFILE=1 cargo run --release --features gpu-opencl --example pearl_gpu_native_opencl_bench

#[cfg(feature = "gpu-opencl")]
fn main() {
    use std::time::Instant;
    use zion_auxpow::gpu_miner::opencl_backend;
    use zion_auxpow::gpu_miner::PearlPouwNativeInput;
    use zion_auxpow::pearl_pouw::*;

    let m = 256usize;
    let n = 512usize;
    let k = 1024usize;
    let rank = 32usize;

    let header = IncompleteBlockHeader {
        version: 1,
        prev_block: [0xAA; 32],
        merkle_root: [0xBB; 32],
        timestamp: 1234567890,
        nbits: 0x1E01FFFF,
    };
    let config = MiningConfiguration::default_mainnet();
    let difficulty_bound = extract_difficulty_bound(header.nbits, &config);

    let mut gpu = opencl_backend::new(262144).expect("OpenCL backend init");

    println!("=== Pearl PoUW OpenCL GPU-Native Pipeline Benchmark (RX 5700 XT) ===");
    println!("m={} n={} k={} rank={}", m, n, k, rank);
    println!();

    // ── GPU-only raw pipeline timing (no CPU proof construction) ──
    println!("--- GPU-only raw pipeline (no CPU proof construction) ---");
    let job_key = compute_job_key(&header, &config);
    let row_offsets: Vec<u32> = (0..m as u32)
        .filter(|&i| config.rows_pattern.offset_is_valid(i))
        .collect();
    let col_offsets: Vec<u32> = (0..n as u32)
        .filter(|&i| config.cols_pattern.offset_is_valid(i))
        .collect();
    let rows_base: Vec<u32> = config.rows_pattern.to_list();
    let cols_base: Vec<u32> = config.cols_pattern.to_list();

    let mut total_gpu_raw = 0.0;
    for i in 0..30u64 {
        let native_input = PearlPouwNativeInput {
            nonce: i,
            m,
            n,
            k,
            rank,
            job_key,
            target: difficulty_bound,
            row_offsets: &row_offsets,
            col_offsets: &col_offsets,
            rows_base: &rows_base,
            cols_base: &cols_base,
            seed_label_a: SEED_LABEL_A,
            seed_label_b: SEED_LABEL_B,
        };
        let t = Instant::now();
        let _ = gpu.pearl_pouw_mine_native(&native_input);
        let ms = t.elapsed().as_secs_f64() * 1000.0;
        if i >= 10 {
            total_gpu_raw += ms;
            println!("  nonce {}: {:.2} ms", i, ms);
        } else {
            println!("  nonce {}: {:.2} ms (warmup)", i, ms);
        }
    }
    let avg_gpu_raw = total_gpu_raw / 20.0;
    println!(
        "GPU-only avg (steady): {:.2} ms/nonce ({:.1} nonces/s)",
        avg_gpu_raw,
        1000.0 / avg_gpu_raw
    );
    println!();

    // ── Batched persistent mining (multiple nonces per mining kernel launch) ──
    let batch_sizes: &[u32] = &[4, 8, 16];
    for &bs in batch_sizes {
        println!("--- Batched persistent mining (batch_size={}) ---", bs);
        let mut total_batch = 0.0;
        let mut batch_count = 0u32;
        let mut nonce_ctr: u64 = 1000; // different range to avoid cache interference
        for batch_i in 0..10u32 {
            let native_input = PearlPouwNativeInput {
                nonce: nonce_ctr,
                m,
                n,
                k,
                rank,
                job_key,
                target: difficulty_bound,
                row_offsets: &row_offsets,
                col_offsets: &col_offsets,
                rows_base: &rows_base,
                cols_base: &cols_base,
                seed_label_a: SEED_LABEL_A,
                seed_label_b: SEED_LABEL_B,
            };
            let t = Instant::now();
            let _ = gpu.pearl_pouw_mine_batched(&native_input, bs);
            let ms = t.elapsed().as_secs_f64() * 1000.0;
            let per_nonce = ms / bs as f64;
            if batch_i >= 3 {
                total_batch += per_nonce;
                batch_count += 1;
            }
            println!(
                "  batch {}: {:.2} ms total ({:.2} ms/nonce)",
                batch_i, ms, per_nonce
            );
            nonce_ctr += bs as u64;
        }
        let avg_batch = total_batch / batch_count as f64;
        println!(
            "Batched avg (steady): {:.2} ms/nonce ({:.1} nonces/s)\n",
            avg_batch,
            1000.0 / avg_batch
        );
    }

    // ── Full E2E (GPU + CPU proof construction) ──
    println!("--- Full E2E (GPU + CPU Merkle proof construction) ---");
    let mut total_native = 0.0;
    for i in 0..30u64 {
        let t = Instant::now();
        let _ = try_mine_one_gpu_native_opencl(
            i,
            m,
            n,
            k,
            rank,
            &header,
            &config,
            &difficulty_bound,
            &mut gpu,
        );
        let ms = t.elapsed().as_secs_f64() * 1000.0;
        if i >= 10 {
            total_native += ms;
            println!("  nonce {}: {:.2} ms", i, ms);
        } else {
            println!("  nonce {}: {:.2} ms (warmup)", i, ms);
        }
    }
    let avg_native = total_native / 20.0;
    println!(
        "E2E avg (steady): {:.2} ms/nonce ({:.1} nonces/s)",
        avg_native,
        1000.0 / avg_native
    );
    println!();

    // ── CPU-only baseline ──
    println!("--- CPU-only (baseline) ---");
    let mut total_cpu = 0.0;
    for i in 0..30u64 {
        let t = Instant::now();
        let _ = try_mine_one(i, m, n, k, rank, &header, &config, &difficulty_bound);
        let ms = t.elapsed().as_secs_f64() * 1000.0;
        if i >= 10 {
            total_cpu += ms;
            println!("  nonce {}: {:.2} ms", i, ms);
        } else {
            println!("  nonce {}: {:.2} ms (warmup)", i, ms);
        }
    }
    let avg_cpu = total_cpu / 20.0;
    println!(
        "CPU avg (steady): {:.2} ms/nonce ({:.1} nonces/s)",
        avg_cpu,
        1000.0 / avg_cpu
    );
    println!();

    // ── Results ──
    println!("=== Results ===");
    println!(
        "CPU-only:          {:.2} ms ({:.1} nonces/s)",
        avg_cpu,
        1000.0 / avg_cpu
    );
    println!(
        "GPU-only raw:      {:.2} ms ({:.1} nonces/s)",
        avg_gpu_raw,
        1000.0 / avg_gpu_raw
    );
    println!(
        "E2E (GPU+CPU proof): {:.2} ms ({:.1} nonces/s)",
        avg_native,
        1000.0 / avg_native
    );
    if avg_gpu_raw > 0.0 {
        println!("Speedup (GPU-only vs CPU): {:.1}x", avg_cpu / avg_gpu_raw);
    }
    if avg_native > 0.0 {
        println!("Speedup (E2E vs CPU):      {:.1}x", avg_cpu / avg_native);
    }
}

#[cfg(not(feature = "gpu-opencl"))]
fn main() {
    eprintln!("This benchmark requires the gpu-opencl feature.");
    eprintln!("Run with: cargo run --features gpu-opencl --example pearl_gpu_native_opencl_bench");
}
