//! Trae Labs Miner - Simple Mining Benchmark
//! 
//! Mine with all our experimental algorithms and compare performance!

use trae_labs::*;
use std::time::Instant;

fn main() {
    println!("🧪 Trae Labs Miner 🧪");
    println!("====================");
    println!();

    let config = MinerConfig::default();
    println!("📋 Configuration:");
    println!("  Header: {}", String::from_utf8_lossy(&config.header));
    println!("  Start nonce: {}", config.start_nonce);
    println!("  Nonces to try: {}", config.nonce_count);
    println!("  Target: Easy (all 0xFF)");
    println!();

    // Test Lite V1
    println!("⚡ Mining with Lite V1 (Minimal)...");
    let start = Instant::now();
    let result_lite_1 = mine_lite_v1(&config);
    let duration_lite_1 = start.elapsed();
    print_result("Lite V1", &result_lite_1, duration_lite_1);

    // Test Lite V2
    println!("\n❄️ Mining with Lite V2 (Memory-Light)...");
    let start = Instant::now();
    let result_lite_2 = mine_lite_v2(&config);
    let duration_lite_2 = start.elapsed();
    print_result("Lite V2", &result_lite_2, duration_lite_2);

    // Test Fire V1 - fewer nonces since it's slower
    println!("\n🔥 Mining with Fire V1 (Thermal)...");
    let mut fire_config = config.clone();
    fire_config.nonce_count = 100_000; // Less for Fire, it's slower!
    let start = Instant::now();
    let result_fire_1 = mine_fire_v1(&fire_config);
    let duration_fire_1 = start.elapsed();
    print_result("Fire V1", &result_fire_1, duration_fire_1);

    // Test Fire V2 - also fewer nonces
    println!("\n🌋 Mining with Fire V2 (Recursive)...");
    let start = Instant::now();
    let result_fire_2 = mine_fire_v2(&fire_config);
    let duration_fire_2 = start.elapsed();
    print_result("Fire V2", &result_fire_2, duration_fire_2);

    println!("\n✅ All mining tests completed!");
}

fn print_result(name: &str, result: &MiningResult, duration: std::time::Duration) {
    println!("  ─────────────────────────");
    println!("  📋 {}", name);
    if result.found {
        println!("  ✅ Found nonce: {}", result.nonce);
        let hash_hex: String = result.hash.iter()
            .take(8)
            .map(|b| format!("{:02x}", b))
            .collect();
        println!("  🎯 Hash: {}...", hash_hex);
    } else {
        println!("  ❌ No nonce found in {} attempts", result.attempts);
    }
    println!("  ⏱️  Time: {:.2?}", duration);
    let hash_rate = result.attempts as f64 / duration.as_secs_f64();
    println!("  💨 Hash rate: {:.2} H/s", hash_rate);
}
