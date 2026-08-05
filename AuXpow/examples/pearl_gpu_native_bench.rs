//! Benchmark: GPU-native Pearl PoUW pipeline vs CPU-prep + GPU dispatch.
//! Measures end-to-end time per nonce for both approaches.

#[cfg(feature = "gpu-metal")]
fn main() {
    use std::time::Instant;
    use zion_auxpow::gpu_metal::MetalBackend;
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

    let mut gpu = MetalBackend::new(262144).expect("Metal backend");

    println!("=== Pearl PoUW GPU-Native Pipeline Benchmark ===");
    println!("m={} n={} k={} rank={}", m, n, k, rank);
    println!();

    // Benchmark GPU-native pipeline (all steps on GPU)
    println!("--- GPU-Native (all steps on GPU) ---");
    let mut total_native = 0.0;
    for i in 0..20 {
        let t = Instant::now();
        let _ = try_mine_one_gpu_native(
            i as u64,
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
        println!("  nonce {}: {:.2} ms", i, ms);
        if i >= 5 {
            total_native += ms;
        } // skip warmup
    }
    let avg_native = total_native / 15.0;
    println!(
        "Average: {:.2} ms/nonce ({:.1} nonces/s)",
        avg_native,
        1000.0 / avg_native
    );
    println!();

    // Benchmark CPU-prep + GPU dispatch (original approach)
    println!("--- CPU-prep + GPU dispatch (original) ---");
    let mut total_orig = 0.0;
    for i in 0..20 {
        let t = Instant::now();
        let _ = try_mine_one_gpu(
            i as u64,
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
        if i >= 5 {
            total_orig += ms;
        } // skip warmup
    }
    let avg_orig = total_orig / 15.0;
    println!(
        "Average: {:.2} ms/nonce ({:.1} nonces/s)",
        avg_orig,
        1000.0 / avg_orig
    );
    println!();

    // Results
    println!("=== Results ===");
    println!(
        "CPU-prep + GPU: {:.2} ms ({:.1} nonces/s)",
        avg_orig,
        1000.0 / avg_orig
    );
    println!(
        "GPU-native:      {:.2} ms ({:.1} nonces/s)",
        avg_native,
        1000.0 / avg_native
    );
    if avg_native > 0.0 {
        println!("Speedup: {:.1}x", avg_orig / avg_native);
    }
}

#[cfg(not(feature = "gpu-metal"))]
fn main() {
    eprintln!("This benchmark requires the gpu-metal feature.");
    eprintln!("Run with: cargo run --features gpu-metal --example pearl_gpu_native_bench");
}
