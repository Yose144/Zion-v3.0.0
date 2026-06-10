//! Trae Fire V2 - Recursive Thermal Loop Variant
//! 
//! Design goals:
//! - Recursive hash chains that burn lots of GPU operations
//! - Adjustable depth for thermal control
//! - Memory-light but compute-heavy
//! - ✅ STRONG ASIC RESISTANCE via recursive dependent operations!
//! 
//! ASIC resistance features:
//! - Recursive structure (each level depends entirely on previous)
//! - Mixed integer operations and hash functions at every step
//! - Hard to pipeline in hardware due to data dependencies
//! - Adjustable recursion depth allows for future updates!

use crate::common::*;

pub const TRAE_FIRE_V2_PROFILE: &str = "trae-fire-v2";
pub const DEFAULT_RECURSION_DEPTH: usize = 8;
pub const HASHES_PER_LEVEL: usize = 32;

fn recursive_hash(data: &[u8; 32], depth: usize) -> [u8; 32] {
    if depth == 0 {
        return *data;
    }
    
    let mut result = *data;
    for i in 0..HASHES_PER_LEVEL {
        let mut round_input = [0u8; 40];
        round_input[0..32].copy_from_slice(&result);
        round_input[32..40].copy_from_slice(&(i as u64).to_le_bytes());
        result = blake3_hash(&round_input);
        
        // Chain some integer operations here too for extra heat
        let mut a = u64::from_le_bytes(result[0..8].try_into().unwrap());
        let mut b = u64::from_le_bytes(result[8..16].try_into().unwrap());
        let mut c = u64::from_le_bytes(result[16..24].try_into().unwrap());
        let mut d = u64::from_le_bytes(result[24..32].try_into().unwrap());
        
        for _ in 0..1024 {
            a = a.rotate_left(13).wrapping_add(b);
            b = b.rotate_left(17) ^ c;
            c = c.rotate_left(23).wrapping_add(d);
            d = d.rotate_left(31) ^ a;
        }
        
        result[0..8].copy_from_slice(&a.to_le_bytes());
        result[8..16].copy_from_slice(&b.to_le_bytes());
        result[16..24].copy_from_slice(&c.to_le_bytes());
        result[24..32].copy_from_slice(&d.to_le_bytes());
    }
    
    recursive_hash(&result, depth - 1)
}

pub fn trae_fire_v2(header: &[u8], nonce: u64) -> [u8; 32] {
    let mut input = Vec::with_capacity(header.len() + 8);
    input.extend_from_slice(header);
    input.extend_from_slice(&nonce.to_le_bytes());
    let seed = keccak256_hash(&input);
    recursive_hash(&seed, DEFAULT_RECURSION_DEPTH)
}

pub fn trae_fire_v2_find_nonce(
    header: &[u8],
    start_nonce: u64,
    count: u64,
    target: &[u8; 32],
) -> Option<(u64, [u8; 32])> {
    for offset in 0..count {
        let nonce = start_nonce.wrapping_add(offset);
        let hash = trae_fire_v2(header, nonce);
        if meets_target(&hash, target) {
            return Some((nonce, hash));
        }
    }
    None
}
