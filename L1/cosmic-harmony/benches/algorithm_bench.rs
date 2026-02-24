//! CHv3 hashrate benchmark
//!
//! Měří výkon obou pipeline variant:
//!   - Legacy (bez scratchpadu, výška < 100 000)
//!   - Full memory-hard (2 MiB scratchpad, výška >= 100 000)
//!
//! Spuštění:
//!   cargo bench -p zion-cosmic-harmony-v3
//!   cargo bench -p zion-cosmic-harmony-v3 -- --threads 4

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use zion_cosmic_harmony_v3::algorithms_opt::{
    cosmic_harmony_v3_legacy, cosmic_harmony_v3, cosmic_harmony_v3_with_height,
    CHV3_MEMORY_HARD_FORK_HEIGHT,
};
use zion_cosmic_harmony_v3::scratchpad::{self, SCRATCHPAD_SIZE};

const BENCH_DURATION_SECS: u64 = 5;
const WARMUP_SECS: u64 = 1;
const HEADER: &[u8] = b"ZION benchmark block header v2.9.6 mainnet testdata padding!!";

fn bench_single_thread_legacy() -> f64 {
    // warmup
    let warmup_end = Instant::now() + Duration::from_secs(WARMUP_SECS);
    let mut nonce = 0u64;
    while Instant::now() < warmup_end {
        let _ = cosmic_harmony_v3_legacy(HEADER, nonce);
        nonce += 1;
    }

    let start = Instant::now();
    let deadline = start + Duration::from_secs(BENCH_DURATION_SECS);
    let mut count = 0u64;
    while Instant::now() < deadline {
        let _ = cosmic_harmony_v3_legacy(HEADER, nonce);
        nonce += 1;
        count += 1;
    }
    let elapsed = start.elapsed().as_secs_f64();
    count as f64 / elapsed
}

fn bench_single_thread_full() -> f64 {
    // warmup
    let warmup_end = Instant::now() + Duration::from_secs(WARMUP_SECS);
    let mut nonce = 0u64;
    while Instant::now() < warmup_end {
        let _ = cosmic_harmony_v3(HEADER, nonce);
        nonce += 1;
    }

    let start = Instant::now();
    let deadline = start + Duration::from_secs(BENCH_DURATION_SECS);
    let mut count = 0u64;
    while Instant::now() < deadline {
        let _ = cosmic_harmony_v3(HEADER, nonce);
        nonce += 1;
        count += 1;
    }
    let elapsed = start.elapsed().as_secs_f64();
    count as f64 / elapsed
}

fn bench_scratchpad_only() -> f64 {
    let input = [0x42u8; 64];
    // warmup
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
    let elapsed = start.elapsed().as_secs_f64();
    count as f64 / elapsed
}

fn bench_multithreaded(threads: usize, use_memory_hard: bool) -> f64 {
    let total_hashes = Arc::new(AtomicU64::new(0));
    let height = if use_memory_hard {
        CHV3_MEMORY_HARD_FORK_HEIGHT
    } else {
        0
    };

    // warmup 1s
    {
        let mut handles = vec![];
        let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
        for t in 0..threads {
            let stop2 = Arc::clone(&stop);
            let h = std::thread::spawn(move || {
                let mut nonce = (t as u64) * 1_000_000;
                while !stop2.load(Ordering::Relaxed) {
                    let _ = cosmic_harmony_v3_with_height(HEADER, nonce, height);
                    nonce += 1;
                }
            });
            handles.push(h);
        }
        std::thread::sleep(Duration::from_secs(WARMUP_SECS));
        stop.store(true, Ordering::Relaxed);
        for h in handles {
            let _ = h.join();
        }
    }

    // real bench
    let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let mut handles = vec![];
    let start = Instant::now();

    for t in 0..threads {
        let stop2 = Arc::clone(&stop);
        let counter = Arc::clone(&total_hashes);
        let h = std::thread::spawn(move || {
            let mut nonce = (t as u64) * 10_000_000;
            let mut local = 0u64;
            while !stop2.load(Ordering::Relaxed) {
                let _ = cosmic_harmony_v3_with_height(HEADER, nonce, height);
                nonce += 1;
                local += 1;
            }
            counter.fetch_add(local, Ordering::Relaxed);
        });
        handles.push(h);
    }

    std::thread::sleep(Duration::from_secs(BENCH_DURATION_SECS));
    stop.store(true, Ordering::Relaxed);
    for h in handles {
        let _ = h.join();
    }

    let elapsed = start.elapsed().as_secs_f64();
    total_hashes.load(Ordering::Relaxed) as f64 / elapsed
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
    println!("║     CHv3 ASIC Resistance Benchmark — ZION 2.9.6     ║");
    println!("╚══════════════════════════════════════════════════════╝");
    println!("  Fork height : {}", CHV3_MEMORY_HARD_FORK_HEIGHT);
    println!("  Scratchpad  : {} KiB  ({})", SCRATCHPAD_SIZE / 1024, match SCRATCHPAD_SIZE {
        s if s >= 1024*1024 => format!("{} MiB", s / (1024*1024)),
        s => format!("{} KiB", s / 1024),
    });
    println!("  CPU threads : {}", threads_arg);
    println!("  Duration    : {}s warmup + {}s bench per test", WARMUP_SECS, BENCH_DURATION_SECS);

    // ── 1. Single-thread legacy ──────────────────────────────────
    separator("1/5  Single-thread — Legacy pipeline (no scratchpad)");
    println!("  Running...");
    let hs_legacy = bench_single_thread_legacy();
    println!("  Result : {}", fmt_hs(hs_legacy));
    println!("  (height < {} — memory-hard inactive)", CHV3_MEMORY_HARD_FORK_HEIGHT);

    // ── 2. Single-thread full ────────────────────────────────────
    separator("2/5  Single-thread — Full pipeline (memory-hard scratchpad)");
    println!("  Running...");
    let hs_full = bench_single_thread_full();
    println!("  Result : {}", fmt_hs(hs_full));
    println!("  (height >= {} — memory-hard ACTIVE)", CHV3_MEMORY_HARD_FORK_HEIGHT);

    // ── 3. Scratchpad isolation ──────────────────────────────────
    separator("3/5  Scratchpad only (memory_hard_transform)");
    println!("  Running...");
    let hs_pad = bench_scratchpad_only();
    println!("  Result : {}", fmt_hs(hs_pad));
    println!("  ({}  scratchpad, 4 passes + 256 random reads per call)", match SCRATCHPAD_SIZE {
        s if s >= 1024*1024 => format!("{} MiB", s / (1024*1024)),
        s => format!("{} KiB", s / 1024),
    });

    // ── 4. Multi-thread legacy ───────────────────────────────────
    separator(&format!("4/5  {}-thread — Legacy pipeline", threads_arg));
    println!("  Running...");
    let hs_mt_legacy = bench_multithreaded(threads_arg, false);
    println!("  Result : {}  ({} per thread)", fmt_hs(hs_mt_legacy), fmt_hs(hs_mt_legacy / threads_arg as f64));

    // ── 5. Multi-thread full ─────────────────────────────────────
    separator(&format!("5/5  {}-thread — Full pipeline (memory-hard)", threads_arg));
    println!("  Running...");
    let hs_mt_full = bench_multithreaded(threads_arg, true);
    println!("  Result : {}  ({} per thread)", fmt_hs(hs_mt_full), fmt_hs(hs_mt_full / threads_arg as f64));

    // ── Souhrn ───────────────────────────────────────────────────
    let slowdown = if hs_full > 0.0 { hs_legacy / hs_full } else { 0.0 };
    let mt_slowdown = if hs_mt_full > 0.0 { hs_mt_legacy / hs_mt_full } else { 0.0 };

    println!("\n╔══════════════════════════════════════════════════════╗");
    println!("║                    SOUHRN VÝSLEDKŮ                  ║");
    println!("╠══════════════════════════════════════════════════════╣");
    println!("║  Legacy (1T)   : {:>12}                       ║", fmt_hs(hs_legacy));
    println!("║  Full   (1T)   : {:>12}                       ║", fmt_hs(hs_full));
    println!("║  Scratchpad    : {:>12}  (izolovaně)          ║", fmt_hs(hs_pad));
    println!("║  Legacy ({}T)  : {:>12}                       ║", threads_arg, fmt_hs(hs_mt_legacy));
    println!("║  Full   ({}T)  : {:>12}                       ║", threads_arg, fmt_hs(hs_mt_full));
    println!("╠══════════════════════════════════════════════════════╣");
    println!("║  Zpomalení 1T  : {:.1}x  (full vs legacy)           ║", slowdown);
    println!("║  Zpomalení {}T : {:.1}x  (full vs legacy)           ║", threads_arg, mt_slowdown);
    println!("╠══════════════════════════════════════════════════════╣");

    // ASIC resistance assessment
    let assessment = if hs_full < 500.0 {
        "SILNÁ odolnost  — ASIC není ekonomicky výhodný"
    } else if hs_full < 5_000.0 {
        "DOBRÁ odolnost  — scratchpad dominuje latenci"
    } else {
        "NIZKA odolnost  — zkontroluj parametry scratchpadu"
    };
    println!("║  ASIC posouzení: {}  ║", assessment);
    println!("╚══════════════════════════════════════════════════════╝\n");
}

fn num_cpus() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
}
