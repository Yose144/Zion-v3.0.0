//! HugePages CPU benchmark for Ekam Deeksha scratchpad.
//!
//! Usage: cargo run --example bench_hugepages -p zion-cosmic-harmony-v3 --release

use std::time::Instant;
use zion_cosmic_harmony_v3::deeksha::cosmic_harmony_ekam_deeksha;
use zion_cosmic_harmony_v3::hugepages;

fn main() {

    let header = b"ZION_DEEKSHA_GENESIS_V298_CANONICAL";
    let iterations = 500u64;

    println!("=== Ekam Deeksha HugePages CPU Benchmark ===\n");

    // Check availability
    let info = hugepages::is_huge_pages_available();
    println!("HugePages available: {} (page size: {} KiB)", info.available, info.page_size / 1024);
    println!("Memory: {}", hugepages::memory_status_line(64 * 1024));

    // Warm up — first call triggers hugepage allocation
    let warmup_hash = cosmic_harmony_ekam_deeksha(header, 0x2980_0001_0000_0001);
    let has_hp = hugepages::current_thread_has_huge_pages();
    println!("HugePages active: {}", has_hp);
    println!("Warmup hash: {}", hex::encode(&warmup_hash.data));

    // Benchmark
    println!("\nRunning {} iterations (1 thread)...", iterations);
    let start = Instant::now();
    for i in 0..iterations {
        std::hint::black_box(cosmic_harmony_ekam_deeksha(header, i));
    }
    let elapsed = start.elapsed();
    let h_per_s = iterations as f64 / elapsed.as_secs_f64();

    println!(
        "\nResult: {} hashes in {:.2}s = {:.1} H/s ({:.2} kH/s)",
        iterations,
        elapsed.as_secs_f64(),
        h_per_s,
        h_per_s / 1000.0
    );
    println!("Per hash: {:.2} ms", elapsed.as_secs_f64() * 1000.0 / iterations as f64);
}
