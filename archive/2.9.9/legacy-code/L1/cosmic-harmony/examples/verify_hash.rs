//! Verify CH3 hash for pool compatibility
use zion_cosmic_harmony_v3::algorithms_opt::cosmic_harmony_v3;

fn main() {
    println!("=== Cosmic Harmony v3 Hash Verification ===\n");
    
    // Test 1: Zero header
    let header = [0u8; 80];
    let nonce = 0u64;
    let hash = cosmic_harmony_v3(&header, nonce);
    println!("Test 1: Zero header, nonce=0");
    println!("  Hash: {}\n", hex::encode(hash.data));
    
    // Test 2: Same but different nonce
    let nonce = 12345u64;
    let hash = cosmic_harmony_v3(&header, nonce);
    println!("Test 2: Zero header, nonce=12345");
    println!("  Hash: {}\n", hex::encode(hash.data));
    
    // Test 3: Real-world like header
    let mut header = [0u8; 80];
    header[0..4].copy_from_slice(&[0x01, 0x02, 0x03, 0x04]); // version
    header[4..36].copy_from_slice(&[0xAB; 32]); // prev_hash
    header[36..68].copy_from_slice(&[0xCD; 32]); // merkle_root
    header[68..72].copy_from_slice(&0x12345678u32.to_le_bytes()); // timestamp
    header[72..76].copy_from_slice(&0x1d00ffffu32.to_le_bytes()); // bits
    
    for nonce in [0u64, 1, 100, 999, 12345] {
        let hash = cosmic_harmony_v3(&header, nonce);
        println!("Test 3: Real header, nonce={}", nonce);
        println!("  Hash: {}", hex::encode(hash.data));
        
        // Check leading zeros (difficulty proxy)
        let leading_zeros = hash.data.iter().rev().take_while(|&&b| b == 0).count();
        println!("  Leading zeros: {}\n", leading_zeros);
    }
    
    // Test 4: Determinism - same input should always give same output
    println!("Test 4: Determinism check");
    let h1 = cosmic_harmony_v3(&header, 42);
    let h2 = cosmic_harmony_v3(&header, 42);
    let h3 = cosmic_harmony_v3(&header, 42);
    println!("  Hash 1: {}", hex::encode(h1.data));
    println!("  Hash 2: {}", hex::encode(h2.data));
    println!("  Hash 3: {}", hex::encode(h3.data));
    println!("  Deterministic: {}\n", h1.data == h2.data && h2.data == h3.data);
    
    println!("=== All tests complete ===");
}
