//! Benchmark all our experimental algorithms!

use trae_labs::*;
use std::time::Instant;

fn main() {
    println!("🧪 Trae Labs - Algorithm Benchmarks 🧪");
    println!("==================================");
    
    let header = b"Test header for Trae Labs benchmarks - let's mine some fake blocks!";
    let target = easy_target();
    let iterations = 10_000;
    
    println!("\n📊 Benchmarking Trae Lite V1 (Minimal)...");
    let start = Instant::now();
    for i in 0..iterations {
        let _ = lite::v1_minimal::trae_lite_v1(header, i as u64);
    }
    let duration = start.elapsed();
    println!("   Time: {:?} for {} iterations", duration, iterations);
    println!("   Hash rate: {:.2} H/s", iterations as f64 / duration.as_secs_f64());
    
    println!("\n📊 Benchmarking Trae Lite V2 (Memory Light)...");
    let start = Instant::now();
    for i in 0..iterations {
        let _ = lite::v2_memory_light::trae_lite_v2(header, i as u64);
    }
    let duration = start.elapsed();
    println!("   Time: {:?} for {} iterations", duration, iterations);
    println!("   Hash rate: {:.2} H/s", iterations as f64 / duration.as_secs_f64());
    
    println!("\n📊 Benchmarking Trae Fire V1 (Thermal)...");
    let start = Instant::now();
    for i in 0..1000 { // Fewer iterations for Fire, it's slower
        let _ = fire::v1_thermal::trae_fire_v1(header, i as u64);
    }
    let duration = start.elapsed();
    println!("   Time: {:?} for 1000 iterations", duration);
    println!("   Hash rate: {:.2} H/s", 1000.0 / duration.as_secs_f64());
    
    println!("\n✅ Done!");
}
