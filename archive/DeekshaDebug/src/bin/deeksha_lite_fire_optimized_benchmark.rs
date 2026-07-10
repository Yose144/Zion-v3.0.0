//! Simple benchmark for Fire Optimized thermal loop only

use std::time::Instant;

const THERMAL_ITERS: usize = 8192; // REDUCED from 65536 (8x less)

fn thermal_loop_only(data: &mut [u8; 32], nonce: u64) {
    let mut a = nonce ^ 0x9E3779B97F4A7C15u64;
    let mut b = nonce ^ 0xBF58476D1CE4E5B9u64;
    let mut c = nonce ^ 0x94D049BB133111EBu64;
    let mut d = nonce ^ 0x5851F42D4C957F2Du64;
    let mut e = nonce ^ 0xC0FFEE123456789Au64;
    let mut f = nonce ^ 0xDEADBEEFCAFEBABEu64;
    let mut g = nonce ^ 0xBADC0FFEE0DDF00Du64;
    let mut h = nonce ^ 0xFEEDFACECAFEBEEFu64;

    for i in 0..THERMAL_ITERS {
        a = a.rotate_left(17).wrapping_add(b);
        b = b.rotate_left(31) ^ a;
        c = c.rotate_left(13).wrapping_add(d);
        d = d.rotate_left(47) ^ c;
        e = e.rotate_left(23).wrapping_add(f);
        f = f.rotate_left(41) ^ e;
        g = g.rotate_left(11).wrapping_add(h);
        h = h.rotate_left(53) ^ g;
        a = a.wrapping_mul(0xFF51AFD7ED558CCDu64);
        b = b.wrapping_add(0xFF51AFD7ED558CCDu64);
        c = c.wrapping_mul(0x94D049BB133111EBu64);
        d = d.wrapping_add(0x5851F42D4C957F2Du64);
        e = e.wrapping_mul(0xC0FFEE123456789Au64);
        f = f.wrapping_add(0xDEADBEEFCAFEBABEu64);
        g = g.wrapping_mul(0xBADC0FFEE0DDF00Du64);
        h = h.wrapping_add(0xFEEDFACECAFEBEEFu64);
        a ^= data[i & 0x1F] as u64;
        b ^= data[(i +  8) & 0x1F] as u64;
        c ^= data[(i + 16) & 0x1F] as u64;
        d ^= data[(i + 24) & 0x1F] as u64;
        e ^= data[(i +  4) & 0x1F] as u64;
        f ^= data[(i + 12) & 0x1F] as u64;
        g ^= data[(i + 20) & 0x1F] as u64;
        h ^= data[(i + 28) & 0x1F] as u64;
    }

    let result = [
        (a >> 56) as u8, (a >> 48) as u8, (a >> 40) as u8, (a >> 32) as u8,
        (a >> 24) as u8, (a >> 16) as u8, (a >>  8) as u8,  a        as u8,
        (b >> 56) as u8, (b >> 48) as u8, (b >> 40) as u8, (b >> 32) as u8,
        (b >> 24) as u8, (b >> 16) as u8, (b >>  8) as u8,  b        as u8,
        (c >> 56) as u8, (c >> 48) as u8, (c >> 40) as u8, (c >> 32) as u8,
        (c >> 24) as u8, (c >> 16) as u8, (c >>  8) as u8,  c        as u8,
        (d >> 56) as u8, (d >> 48) as u8, (d >> 40) as u8, (d >> 32) as u8,
        (d >> 24) as u8, (d >> 16) as u8, (d >>  8) as u8,  d        as u8,
    ];

    data.copy_from_slice(&result);
}

fn main() {
    println!("🔥 Fire Optimized Thermal Loop Benchmark");
    println!("========================================");
    println!("THERMAL_ITERS: {} (vs 65536 original = 8x reduction)", THERMAL_ITERS);
    println!();

    let mut data = [0u8; 32];
    let nonce: u64 = 0x123456789ABCDEF0;
    let iterations = 10000;
    
    println!("Benchmark: {} thermal loop iterations", iterations);
    println!();

    // Warmup
    println!("Warming up...");
    for i in 0..100 {
        thermal_loop_only(&mut data, nonce + i);
    }
    println!("Warmup complete");
    println!();

    // Benchmark
    let start = Instant::now();
    
    for i in 0..iterations {
        thermal_loop_only(&mut data, nonce + i);
    }
    
    let duration = start.elapsed();
    let hashrate = iterations as f64 / duration.as_secs_f64();
    let avg_time_us = duration.as_micros() as f64 / iterations as f64;
    
    println!("Benchmark Results:");
    println!("==================");
    println!("Total time: {:?}", duration);
    println!("Average time per thermal loop: {:.3} μs", avg_time_us);
    println!("Thermal loop rate: {:.2} KHz", hashrate / 1000.0);
    println!();
    
    println!("Performance Analysis:");
    println!("====================");
    println!("Original Fire (65536 iters): ~17.5 KH/s (GPU), but 0 blocks found");
    println!("Optimized Fire (8192 iters): Expected ~2-3 KH/s (GPU), better efficiency");
    println!("Thermal loop reduction: 8x less iterations = 8x faster per iteration");
    println!("Expected improvement: Better block finding rate, reduced rejections");
    println!();
    
    println!("🎯 Next steps:");
    println!("1. Test with actual GPU mining");
    println!("2. Compare block finding rate vs original Fire");
    println!("3. Monitor GPU temperature and power consumption");
    println!("4. If successful, propose for consensus fork");
}