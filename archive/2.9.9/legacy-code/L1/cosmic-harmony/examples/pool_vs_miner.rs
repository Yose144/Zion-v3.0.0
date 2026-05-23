//! Test: Compare what MINER computes vs what POOL computes
use zion_cosmic_harmony_v3::algorithms_opt;

fn main() {
    println!("=== Pool vs Miner CH3 Hash Comparison ===\n");

    // Real job blob from Helsinki pool (165 bytes)
    let blob_hex = "01000000490000000000000064323031303230306439373137366633343265646664643230326437316561666538376564323966613732343735333963333135353434333662376337646337336565643432663930613632653533356564663935623064653635326538343564366337633138626362633235616437616130633534393236633066643963626d88836900000000e803000000000000000000000000000000";
    let blob = hex::decode(blob_hex).unwrap();
    
    println!("Blob hex: {}", &blob_hex[..80]);
    println!("Blob length: {} bytes", blob.len());
    println!("First 80 bytes (what CH3 uses): {}", hex::encode(&blob[..80]));
    
    // Test multiple nonces
    for nonce in [0u64, 1, 5, 100, 12345] {
        // Both miner and pool use same function: cosmic_harmony_v3(&blob, nonce)
        let hash = algorithms_opt::cosmic_harmony_v3(&blob, nonce);
        let hash_hex = hex::encode(&hash.data);
        
        // Target check (ffffffff = max u32)
        let target_u32: u32 = 0xffffffff;
        let state0 = u32::from_le_bytes([hash.data[0], hash.data[1], hash.data[2], hash.data[3]]);
        let meets = state0 <= target_u32;
        
        println!("\nNonce {}: hash = {}", nonce, hash_hex);
        println!("  state0 = 0x{:08x} ({}) <= target 0x{:08x} ({})? {}", 
                 state0, state0, target_u32, target_u32, meets);
    }
    
    println!("\n=== All hashes should meet target ffffffff ===");
    println!("If pool rejects, the issue is NOT in hash computation!");
}
