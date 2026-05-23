//! Canonical Deeksha benchmark
//!
//! Měří přímo canonical v2.9.8 cestu bez historického CHv3 dispatch kontextu.
//!
//! Spuštění:
//!   cargo bench --manifest-path L1/cosmic-harmony/Cargo.toml --bench deeksha_bench
//!   cargo bench --manifest-path L1/cosmic-harmony/Cargo.toml --bench deeksha_bench -- --threads 8

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use zion_cosmic_harmony_v3::algorithms_opt::{golden_matrix_opt, keccak256_opt, sha3_512_opt};
use zion_cosmic_harmony_v3::deeksha::{cosmic_harmony_deeksha, cosmic_harmony_ekam_deeksha};
use zion_cosmic_harmony_v3::{scratchpad, scratchpad_ekam};

const BENCH_DURATION_SECS: u64 = 5;
const WARMUP_SECS: u64 = 1;
const HEADER: &[u8] = b"ZION_DEEKSHA_BENCHMARK_HEADER_V298";

fn bench_canonical_single_thread() -> f64 {
    let warmup_end = Instant::now() + Duration::from_secs(WARMUP_SECS);
    let mut nonce = 0u64;
    while Instant::now() < warmup_end {
        let _ = cosmic_harmony_deeksha(HEADER, nonce);
        nonce = nonce.wrapping_add(1);
    }

    let start = Instant::now();
    let deadline = start + Duration::from_secs(BENCH_DURATION_SECS);
    let mut count = 0u64;
    while Instant::now() < deadline {
        let _ = cosmic_harmony_deeksha(HEADER, nonce);
        nonce = nonce.wrapping_add(1);
        count += 1;
    }
    count as f64 / start.elapsed().as_secs_f64()
}

fn bench_pre_scratchpad_front_half() -> f64 {
    let mut input = [0u8; 88];
    let len = HEADER.len().min(80);
    input[..len].copy_from_slice(&HEADER[..len]);

    let warmup_end = Instant::now() + Duration::from_secs(WARMUP_SECS);
    let mut nonce = 0u64;
    while Instant::now() < warmup_end {
        input[80..88].copy_from_slice(&nonce.to_le_bytes());
        let s1 = keccak256_opt(&input);
        let s2 = sha3_512_opt(&s1.data);
        let _ = golden_matrix_opt(&s2.data);
        nonce = nonce.wrapping_add(1);
    }

    let start = Instant::now();
    let deadline = start + Duration::from_secs(BENCH_DURATION_SECS);
    let mut count = 0u64;
    while Instant::now() < deadline {
        input[80..88].copy_from_slice(&nonce.to_le_bytes());
        let s1 = keccak256_opt(&input);
        let s2 = sha3_512_opt(&s1.data);
        let _ = golden_matrix_opt(&s2.data);
        nonce = nonce.wrapping_add(1);
        count += 1;
    }
    count as f64 / start.elapsed().as_secs_f64()
}

fn bench_scratchpad_only() -> f64 {
    let input = [0x42u8; 64];
    let warmup_end = Instant::now() + Duration::from_secs(WARMUP_SECS);
    while Instant::now() < warmup_end {
        let _ = scratchpad::memory_hard_transform(&input);
    }

    let start = Instant::now();
    let deadline = start + Duration::from_secs(BENCH_DURATION_SECS);
    let mut count = 0u64;
    while Instant::now() < deadline {
        let _ = scratchpad::memory_hard_transform(&input);
        count += 1;
    }
    count as f64 / start.elapsed().as_secs_f64()
}

fn bench_canonical_multithreaded(threads: usize) -> f64 {
    let total_hashes = Arc::new(AtomicU64::new(0));

    {
        let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let mut handles = vec![];
        for thread_index in 0..threads {
            let stop_flag = Arc::clone(&stop);
            let handle = std::thread::spawn(move || {
                let mut nonce = (thread_index as u64) * 1_000_000;
                while !stop_flag.load(Ordering::Relaxed) {
                    let _ = cosmic_harmony_deeksha(HEADER, nonce);
                    nonce = nonce.wrapping_add(1);
                }
            });
            handles.push(handle);
        }
        std::thread::sleep(Duration::from_secs(WARMUP_SECS));
        stop.store(true, Ordering::Relaxed);
        for handle in handles {
            let _ = handle.join();
        }
    }

    let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let mut handles = vec![];
    let start = Instant::now();

    for thread_index in 0..threads {
        let stop_flag = Arc::clone(&stop);
        let counter = Arc::clone(&total_hashes);
        let handle = std::thread::spawn(move || {
            let mut nonce = (thread_index as u64) * 10_000_000;
            let mut local = 0u64;
            while !stop_flag.load(Ordering::Relaxed) {
                let _ = cosmic_harmony_deeksha(HEADER, nonce);
                nonce = nonce.wrapping_add(1);
                local += 1;
            }
            counter.fetch_add(local, Ordering::Relaxed);
        });
        handles.push(handle);
    }

    std::thread::sleep(Duration::from_secs(BENCH_DURATION_SECS));
    stop.store(true, Ordering::Relaxed);
    for handle in handles {
        let _ = handle.join();
    }

    total_hashes.load(Ordering::Relaxed) as f64 / start.elapsed().as_secs_f64()
}

// ── Ekam Deeksha benchmarks ────────────────────────────────────────────────

fn bench_ekam_single_thread() -> f64 {
    let warmup_end = Instant::now() + Duration::from_secs(WARMUP_SECS);
    let mut nonce = 0u64;
    while Instant::now() < warmup_end {
        let _ = cosmic_harmony_ekam_deeksha(HEADER, nonce);
        nonce = nonce.wrapping_add(1);
    }

    let start = Instant::now();
    let deadline = start + Duration::from_secs(BENCH_DURATION_SECS);
    let mut count = 0u64;
    while Instant::now() < deadline {
        let _ = cosmic_harmony_ekam_deeksha(HEADER, nonce);
        nonce = nonce.wrapping_add(1);
        count += 1;
    }
    count as f64 / start.elapsed().as_secs_f64()
}

fn bench_ekam_scratchpad_only() -> f64 {
    let input = [0x42u8; 64];
    let warmup_end = Instant::now() + Duration::from_secs(WARMUP_SECS);
    while Instant::now() < warmup_end {
        let _ = scratchpad_ekam::memory_hard_transform_ekam(&input);
    }

    let start = Instant::now();
    let deadline = start + Duration::from_secs(BENCH_DURATION_SECS);
    let mut count = 0u64;
    while Instant::now() < deadline {
        let _ = scratchpad_ekam::memory_hard_transform_ekam(&input);
        count += 1;
    }
    count as f64 / start.elapsed().as_secs_f64()
}

fn bench_ekam_multithreaded(threads: usize) -> f64 {
    let total_hashes = Arc::new(AtomicU64::new(0));

    {
        let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let mut handles = vec![];
        for thread_index in 0..threads {
            let stop_flag = Arc::clone(&stop);
            let handle = std::thread::spawn(move || {
                let mut nonce = (thread_index as u64) * 1_000_000;
                while !stop_flag.load(Ordering::Relaxed) {
                    let _ = cosmic_harmony_ekam_deeksha(HEADER, nonce);
                    nonce = nonce.wrapping_add(1);
                }
            });
            handles.push(handle);
        }
        std::thread::sleep(Duration::from_secs(WARMUP_SECS));
        stop.store(true, Ordering::Relaxed);
        for handle in handles {
            let _ = handle.join();
        }
    }

    let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let mut handles = vec![];
    let start = Instant::now();

    for thread_index in 0..threads {
        let stop_flag = Arc::clone(&stop);
        let counter = Arc::clone(&total_hashes);
        let handle = std::thread::spawn(move || {
            let mut nonce = (thread_index as u64) * 10_000_000;
            let mut local = 0u64;
            while !stop_flag.load(Ordering::Relaxed) {
                let _ = cosmic_harmony_ekam_deeksha(HEADER, nonce);
                nonce = nonce.wrapping_add(1);
                local += 1;
            }
            counter.fetch_add(local, Ordering::Relaxed);
        });
        handles.push(handle);
    }

    std::thread::sleep(Duration::from_secs(BENCH_DURATION_SECS));
    stop.store(true, Ordering::Relaxed);
    for handle in handles {
        let _ = handle.join();
    }

    total_hashes.load(Ordering::Relaxed) as f64 / start.elapsed().as_secs_f64()
}

fn fmt_hs(hs: f64) -> String {
    if hs >= 1_000_000.0 {
        format!("{:.3} MH/s", hs / 1_000_000.0)
    } else if hs >= 1_000.0 {
        format!("{:.2} kH/s", hs / 1_000.0)
    } else {
        format!("{:.1} H/s", hs)
    }
}

fn separator(label: &str) {
    println!("\n{}", "═".repeat(56));
    println!("  {}", label);
    println!("{}", "═".repeat(56));
}

fn main() {
    let threads_arg = std::env::args()
        .skip_while(|a| a != "--threads")
        .nth(1)
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or_else(num_cpus);

    println!("\n╔══════════════════════════════════════════════════════╗");
    println!("║  Deeksha vs Ekam Deeksha Benchmark — ZION 2.9.8+   ║");
    println!("╚══════════════════════════════════════════════════════╝");
    println!("  CPU threads : {}", threads_arg);
    println!("  Duration    : {}s warmup + {}s bench per test", WARMUP_SECS, BENCH_DURATION_SECS);

    // ── Original Deeksha ──
    separator("1/7  Original Deeksha — single-thread");
    println!("  Running...");
    let hs_canonical = bench_canonical_single_thread();
    println!("  Result : {}", fmt_hs(hs_canonical));

    separator("2/7  Front half only — Keccak + SHA3 + GoldenMatrix");
    println!("  Running...");
    let hs_front_half = bench_pre_scratchpad_front_half();
    println!("  Result : {}", fmt_hs(hs_front_half));

    separator("3/7  Original Scratchpad — SHA3 memory_hard_transform");
    println!("  Running...");
    let hs_scratchpad = bench_scratchpad_only();
    println!("  Result : {}", fmt_hs(hs_scratchpad));

    // ── Ekam Deeksha ──
    separator("4/7  Ekam Deeksha — single-thread");
    println!("  Running...");
    let hs_ekam = bench_ekam_single_thread();
    println!("  Result : {}", fmt_hs(hs_ekam));

    separator("5/7  Ekam Scratchpad — Blake3 XOF init + Blake3 mixing");
    println!("  Running...");
    let hs_ekam_scratchpad = bench_ekam_scratchpad_only();
    println!("  Result : {}", fmt_hs(hs_ekam_scratchpad));

    // ── Multi-threaded ──
    separator(&format!("6/7  Original Deeksha — {} threads", threads_arg));
    println!("  Running...");
    let hs_canonical_mt = bench_canonical_multithreaded(threads_arg);
    println!("  Result : {}  ({} per thread)", fmt_hs(hs_canonical_mt), fmt_hs(hs_canonical_mt / threads_arg as f64));

    separator(&format!("7/7  Ekam Deeksha — {} threads", threads_arg));
    println!("  Running...");
    let hs_ekam_mt = bench_ekam_multithreaded(threads_arg);
    println!("  Result : {}  ({} per thread)", fmt_hs(hs_ekam_mt), fmt_hs(hs_ekam_mt / threads_arg as f64));

    println!("\n╔══════════════════════════════════════════════════════╗");
    println!("║                    SOUHRN VÝSLEDKŮ                  ║");
    println!("╠══════════════════════════════════════════════════════╣");
    println!("║  ORIGINAL DEEKSHA                                   ║");
    println!("║    Canonical (1T)   : {:>12}                  ║", fmt_hs(hs_canonical));
    println!("║    Scratchpad       : {:>12}                  ║", fmt_hs(hs_scratchpad));
    println!("║    Canonical ({}T)  : {:>12}                  ║", threads_arg, fmt_hs(hs_canonical_mt));
    println!("║  EKAM DEEKSHA (Tier 2: Blake3 XOF)                  ║");
    println!("║    Canonical (1T)   : {:>12}                  ║", fmt_hs(hs_ekam));
    println!("║    Scratchpad       : {:>12}                  ║", fmt_hs(hs_ekam_scratchpad));
    println!("║    Canonical ({}T)  : {:>12}                  ║", threads_arg, fmt_hs(hs_ekam_mt));
    println!("║  SHARED                                             ║");
    println!("║    Front half       : {:>12}                  ║", fmt_hs(hs_front_half));
    println!("╠══════════════════════════════════════════════════════╣");
    if hs_canonical > 0.0 && hs_ekam > 0.0 {
        println!("║  Ekam/Original 1T  : {:>5.2}x speedup               ║", hs_ekam / hs_canonical);
    }
    if hs_canonical_mt > 0.0 && hs_ekam_mt > 0.0 {
        println!("║  Ekam/Original {}T  : {:>5.2}x speedup               ║", threads_arg, hs_ekam_mt / hs_canonical_mt);
    }
    if hs_scratchpad > 0.0 && hs_ekam_scratchpad > 0.0 {
        println!("║  Ekam/Orig scratch : {:>5.2}x speedup               ║", hs_ekam_scratchpad / hs_scratchpad);
    }
    println!("╚══════════════════════════════════════════════════════╝\n");
}

fn num_cpus() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
}