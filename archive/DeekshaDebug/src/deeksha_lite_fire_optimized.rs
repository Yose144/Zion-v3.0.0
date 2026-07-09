//! DeekshaLite Fire Optimized — EXPERIMENTAL VERSION
//!
//! This is a simplified version for testing THERMAL_ITERS = 8192
//! Based on deeksha_lite.rs with thermal loop added

use sha3::{Digest, Keccak256};

pub const THERMAL_ITERS: usize = 8192; // REDUCED from 65536 (8x less)

// Reuse functions from deeksha_lite module
use crate::deeksha_lite::{
    deeksha_lite as deeksha_base,
    AES_SBOX,
    AES_INV_SBOX,
    aes_sbox,
    aes_inv_sbox,
    sub_bytes,
    inv_sub_bytes,
    shift_rows,
    inv_shift_rows,
    mix_columns,
    inv_mix_columns,
    mul2,
    mul9,
    mul11,
    mul13,
    mul14,
    add_round_key,
    aes_round,
    aes_final_round,
    aes_encrypt_block,
};

/// Full DeekshaLite Fire Optimized hash
pub fn deeksha_lite_fire_optimized(header: &[u8], nonce: u64) -> [u8; 32] {
    let s1 = step1_keccak(header, nonce);
    let s2 = step2_memory_hard(&s1);
    let mut s3 = step3_aes_mix(&s2, nonce);
    step4_thermal_loop(&mut s3, nonce);
    step5_keccak(&s3)
}

/// Height-aware wrapper
pub fn deeksha_lite_fire_optimized_with_height(header: &[u8], nonce: u64, _height: u64) -> [u8; 32] {
    deeksha_lite_fire_optimized(header, nonce)
}

/// Self-test
pub fn deeksha_lite_fire_optimized_self_test() -> bool {
    let header = b"ZION_FIRE_OPT_TEST_V1";
    let nonce: u64 = 0x123456789ABCDEF0;
    let h1 = deeksha_lite_fire_optimized(header, nonce);
    let h2 = deeksha_lite_fire_optimized(header, nonce);
    h1 == h2 && h1 != [0u8; 32]
}

// ============================================================
// Step 1: Keccak256(header[0..80] || nonce_le)
// ============================================================

#[inline(always)]
fn step1_keccak(header: &[u8], nonce: u64) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(header);
    hasher.update(&nonce.to_le_bytes());
    hasher.finalize().into()
}

// ============================================================
// Step 2: Memory-hard scratchpad (simplified for testing)
// ============================================================

#[inline(always)]
fn step2_memory_hard(s1: &[u8; 32]) -> Vec<u8> {
    // Simplified version - just use base deeksha lite
    vec![0u8; 256 * 1024] // Placeholder
}

// ============================================================
// Step 3: AES-128 CTR mix (simplified)
// ============================================================

#[inline(always)]
fn step3_aes_mix(s2: &[u8], nonce: u64) -> [u8; 32] {
    // Simplified version
    let mut result = [0u8; 32];
    result.copy_from_slice(s2);
    result
}

// ============================================================
// Step 4: Thermal loop — REDUCED from 65536 to 8192
// ============================================================

#[inline(never)]
fn step4_thermal_loop(data: &mut [u8; 32], nonce: u64) {
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

// ============================================================
// Step 5: Keccak256(s3_after_thermal) → final hash[32]
// ============================================================

#[inline(always)]
fn step5_keccak(s3: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(s3);
    hasher.finalize().into()
}