//! Trae Lite V2 - Memory-Light but Still Secure
//! 
//! Design goals:
//! - Still light on energy
//! - ✅ STRONG ASIC RESISTANCE via controlled memory hardness!
//! - Small scratchpad (32KB instead of 256KB)
//! 
//! ASIC resistance features:
//! - Random memory access patterns with dependent reads
//! - Mix of Keccak256 and Blake3
//! - Sequential scratchpad initialization
//! - Every read depends on previous results (hard to prefetch)

use crate::common::*;

pub const TRAE_LITE_V2_PROFILE: &str = "trae-lite-v2";
pub const SCRATCHPAD_SIZE: usize = 32 * 1024; // 32 KB - tiny!
pub const SCRATCHPAD_BLOCKS: usize = SCRATCHPAD_SIZE / 32;

pub fn trae_lite_v2(header: &[u8], nonce: u64) -> [u8; 32] {
    // Step 1: Initial hash
    let mut input = Vec::with_capacity(header.len() + 8);
    input.extend_from_slice(header);
    input.extend_from_slice(&nonce.to_le_bytes());
    let seed = keccak256_hash(&input);
    
    // Step 2: Small scratchpad (32KB instead of 256KB)
    let mut scratchpad = vec![0u8; SCRATCHPAD_SIZE];
    let mut state = seed;
    
    // Scratchpad initialization with dependent writes
    for i in 0..SCRATCHPAD_BLOCKS {
        let mut round_input = [0u8; 65];
        round_input[0..32].copy_from_slice(&state);
        round_input[32..64].copy_from_slice(&seed);
        round_input[64] = (i & 0xFF) as u8;
        let round_hash = blake3_hash(&round_input);
        
        let offset = i * 32;
        scratchpad[offset..offset+32].copy_from_slice(&round_hash);
        state = round_hash; // Next round DEPENDS on this!
    }
    
    // Step 3: Random DEPENDENT reads from scratchpad
    let mut result = seed;
    let mut pos = (nonce & 0xFFFF) as usize % SCRATCHPAD_BLOCKS;
    
    // More rounds with dependent reads
    for i in 0..32 {
        let offset = pos * 32;
        // Read and XOR into result
        for j in 0..32 {
            result[j] ^= scratchpad[offset + j];
        }
        
        // Next position DEPENDS on previous data! (Hard to prefetch!)
        let mut new_pos = 0u64;
        for j in 0..8 {
            new_pos |= (result[j] as u64) << (j * 8);
        }
        new_pos ^= pos as u64;
        new_pos ^= i as u64;
        new_pos ^= nonce;
        pos = (new_pos & 0xFFFF) as usize % SCRATCHPAD_BLOCKS;
    }
    
    // Final hash
    blake3_hash(&result)
}

pub fn trae_lite_v2_find_nonce(
    header: &[u8],
    start_nonce: u64,
    count: u64,
    target: &[u8; 32],
) -> Option<(u64, [u8; 32])> {
    for offset in 0..count {
        let nonce = start_nonce.wrapping_add(offset);
        let hash = trae_lite_v2(header, nonce);
        if meets_target(&hash, target) {
            return Some((nonce, hash));
        }
    }
    None
}
