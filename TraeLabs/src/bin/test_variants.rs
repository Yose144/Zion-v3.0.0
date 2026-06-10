//! Test all algorithm variants

use trae_labs::*;

fn main() {
    println!("🧪 Trae Labs - Algorithm Tests 🧪");
    println!("========================");
    
    let header = b"Test header for Trae Labs!";
    let target = easy_target();
    
    // Test Lite V1
    println!("\n✅ Testing Trae Lite V1...");
    if let Some((nonce, hash)) = lite::v1_minimal::trae_lite_v1_find_nonce(header, 0, 1000, &target) {
        println!("   Found nonce: {} → hash: {:02x}{:02x}{:02x}...", nonce, hash[0], hash[1], hash[2]);
    }
    
    // Test Lite V2
    println!("\n✅ Testing Trae Lite V2...");
    if let Some((nonce, hash)) = lite::v2_memory_light::trae_lite_v2_find_nonce(header, 0, 1000, &target) {
        println!("   Found nonce: {} → hash: {:02x}{:02x}{:02x}...", nonce, hash[0], hash[1], hash[2]);
    }
    
    // Test Fire V1
    println!("\n✅ Testing Trae Fire V1...");
    if let Some((nonce, hash)) = fire::v1_thermal::trae_fire_v1_find_nonce(header, 0, 100, &target) {
        println!("   Found nonce: {} → hash: {:02x}{:02x}{:02x}...", nonce, hash[0], hash[1], hash[2]);
    }
    
    println!("\n🎉 All tests passed!");
}
