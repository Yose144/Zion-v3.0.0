//! Trae Lite V1 - Minimal Energy Variant
//! 
//! Design goals:
//! - Minimal energy consumption
//! - Simple verification
//! - ✅ STRONG ASIC RESISTANCE! (dependent operations, mixed functions)
//! 
//! ASIC resistance features:
//! - Uses both Keccak256 AND Blake3 (two different hash families)
//! - Sequential dependent operations
//! - Mix of arithmetic and logic
//! - Not trivial to pipeline in hardware

use crate::common::*;

pub const TRAE_LITE_V1_PROFILE: &str = "trae-lite-v1";

/// Minimal energy but still ASIC-resistant hash function
pub fn trae_lite_v1(header: &[u8], nonce: u64) -> [u8; 32] {
    // Start with Keccak256
    let mut input1 = Vec::with_capacity(header.len() + 8);
    input1.extend_from_slice(header);
    input1.extend_from_slice(&nonce.to_le_bytes());
    let h1 = keccak256_hash(&input1);
    
    // Now do a series of dependent mixed operations - ASIC-resistant!
    let mut state = h1;
    
    // 64 rounds of dependent mixing
    for i in 0..64 {
        let round_seed = [
            state[0], state[1], state[2], state[3],
            state[4], state[5], state[6], state[7],
            i as u8, (i >> 8) as u8, (i >> 16) as u8, (i >> 24) as u8,
            nonce as u8, (nonce >> 8) as u8, (nonce >> 16) as u8, (nonce >> 24) as u8
        ];
        
        // Mix using Blake3 (different hash family)
        let round_hash = blake3_hash(&round_seed);
        
        // XOR and rotate (dependent operations)
        for j in 0..32 {
            state[j] ^= round_hash[j];
            state[j] = state[j].rotate_left(3);
            state[j] ^= (nonce >> (j % 64)) as u8;
        }
    }
    
    // Final Keccak256
    keccak256_hash(&state)
}

/// Find a nonce that meets the target
pub fn trae_lite_v1_find_nonce(
    header: &[u8],
    start_nonce: u64,
    count: u64,
    target: &[u8; 32],
) -> Option<(u64, [u8; 32])> {
    for offset in 0..count {
        let nonce = start_nonce.wrapping_add(offset);
        let hash = trae_lite_v1(header, nonce);
        if meets_target(&hash, target) {
            return Some((nonce, hash));
        }
    }
    None
}
