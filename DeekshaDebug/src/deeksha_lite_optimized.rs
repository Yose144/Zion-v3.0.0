//! DeekshaLite v1 — Energy-Optimized Implementation
//!
//! Optimized for minimal power consumption and heat generation:
//! - Reduced scratchpad size (128 KiB) for lower memory bandwidth
//! - Streamlined AES operations
//! - Optimized memory access patterns
//! - Maintains ASIC resistance through memory-hardness

use sha3::{Digest, Keccak256, Sha3_512};

pub const SCRATCHPAD_SIZE_LITE: usize = 128 * 1024; // 128 KiB (reduced for efficiency)
pub const BLOCK_SIZE:      usize = 32;
pub const BLOCK_COUNT_LITE: usize = SCRATCHPAD_SIZE_LITE / BLOCK_SIZE; // 4096
pub const PASSES:          usize = 2;
pub const RANDOM_READS:    usize = 32; // Reduced from 64 for less memory traffic
pub const AES_ROUNDS:      usize = 3; // Reduced from 4 for power savings

// ============================================================
// AES-128 helpers (FIPS-197) - optimized version
// ============================================================

const AES_SBOX: [u8; 256] = [
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
];

#[inline(always)]
fn sub_bytes(s: &mut [u8; 16]) { 
    for i in 0..16 { 
        s[i] = AES_SBOX[s[i] as usize]; 
    } 
}

#[inline(always)]
fn shift_rows(s: &mut [u8; 16]) {
    let t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
    let t = s[2]; s[2] = s[10]; s[10] = t;
    let t = s[6]; s[6] = s[14]; s[14] = t;
    let t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
}

#[inline(always)]
fn xtime(a: u8) -> u8 { (a << 1) ^ (((a >> 7) & 1) * 0x1b) }

#[inline(always)]
fn mix_columns(s: &mut [u8; 16]) {
    for i in 0..4 {
        let (a, b, c, d) = (s[i*4], s[i*4+1], s[i*4+2], s[i*4+3]);
        let e = a ^ b ^ c ^ d;
        s[i*4]   ^= e ^ xtime(a ^ b);
        s[i*4+1] ^= e ^ xtime(b ^ c);
        s[i*4+2] ^= e ^ xtime(c ^ d);
        s[i*4+3] ^= e ^ xtime(d ^ a);
    }
}

#[inline(always)]
fn add_round_key(s: &mut [u8; 16], k: &[u8; 16]) { 
    for i in 0..16 { 
        s[i] ^= k[i]; 
    } 
}

#[inline(always)]
fn aes_round(s: &mut [u8; 16], k: &[u8; 16]) {
    sub_bytes(s); 
    shift_rows(s); 
    mix_columns(s); 
    add_round_key(s, k);
}

#[inline(always)]
fn aes_final_round(s: &mut [u8; 16], k: &[u8; 16]) {
    sub_bytes(s); 
    shift_rows(s); 
    add_round_key(s, k);
}

// ============================================================
// SHA3-512 wrapper - optimized for sequential access
// ============================================================
#[inline(always)]
fn sha3_512(input: &[u8]) -> [u8; 64] {
    Sha3_512::digest(input).into()
}

// ============================================================
// Step 1: Keccak256(header[0..80] || nonce_le)
// ============================================================
#[inline(always)]
fn step1_keccak(header: &[u8], nonce: u64) -> [u8; 32] {
    let mut input = [0u8; 88];
    let hlen = header.len().min(80);
    input[..hlen].copy_from_slice(&header[..hlen]);
    input[80..88].copy_from_slice(&nonce.to_le_bytes());
    Keccak256::digest(&input).into()
}

// ============================================================
// Step 2: Memory-hard scratchpad (128 KiB) - optimized
// ============================================================
fn step2_memory_hard_lite(seed: &[u8; 32]) -> [u8; 32] {
    let mut scratchpad = vec![0u8; SCRATCHPAD_SIZE_LITE];

    // Phase A: SHA3-512 chain fill - optimized for cache locality
    let mut state = [0u8; 64];
    state[..32].copy_from_slice(seed);

    for blk in 0..BLOCK_COUNT_LITE {
        let mut inp = [0u8; 65];
        inp[..64].copy_from_slice(&state);
        inp[64] = (blk & 0xFF) as u8;
        let out = sha3_512(&inp[..65]);
        let off = blk * BLOCK_SIZE;
        scratchpad[off..off + 32].copy_from_slice(&out[..32]);
        state[..32].copy_from_slice(&out[..32]);
    }

    // Phase B: Optimized XOR passes with better memory access patterns
    for i in 0..BLOCK_COUNT_LITE {
        let prev = if i == 0 { BLOCK_COUNT_LITE - 1 } else { i - 1 };
        let (cur, prv) = (i * BLOCK_SIZE, prev * BLOCK_SIZE);
        // Process 32 bytes at once for better cache utilization
        for j in (0..BLOCK_SIZE).step_by(8) {
            for k in 0..8 {
                scratchpad[cur + j + k] ^= scratchpad[prv + j + k];
            }
        }
    }
    
    for i in (0..BLOCK_COUNT_LITE).rev() {
        let next = if i + 1 == BLOCK_COUNT_LITE { 0 } else { i + 1 };
        let (cur, nxt) = (i * BLOCK_SIZE, next * BLOCK_SIZE);
        for j in (0..BLOCK_SIZE).step_by(8) {
            for k in 0..8 {
                scratchpad[cur + j + k] ^= scratchpad[nxt + j + k];
            }
        }
    }

    // Phase C: Reduced random reads for power efficiency
    let mut acc = [0u8; 32];
    acc.copy_from_slice(seed);
    let mut pos: u64 = 0;

    for r in 0..RANDOM_READS as u64 {
        let off = (pos as usize) * BLOCK_SIZE;
        for i in 0..32 { 
            acc[i] ^= scratchpad[off + i]; 
        }
        let mut idx_val: u64 = 0;
        for i in 0..8 { 
            idx_val |= (acc[i] as u64) << (i * 8); 
        }
        pos = (idx_val ^ pos ^ r) % BLOCK_COUNT_LITE as u64;
    }

    acc
}

// ============================================================
// Step 3: AES-128 CTR mix - optimized with reduced rounds
// ============================================================
fn step3_aes_mix_lite(seed: &[u8; 32], nonce: u64) -> [u8; 32] {
    let mut key = [0u8; 16];
    key.copy_from_slice(&seed[..16]);

    let mut counter = [0u8; 16];
    counter[..8].copy_from_slice(&nonce.to_le_bytes());
    counter[8..16].copy_from_slice(&seed[16..24]);

    let mut block0 = counter;
    let mut block1 = counter;

    // Carry-propagated increment
    let mut carry: u16 = 1;
    for i in 0..16 {
        let sum = (block1[i] as u16) + carry;
        block1[i] = (sum & 0xFF) as u8;
        carry = sum >> 8;
        if carry == 0 { break; }
    }

    // Reduced rounds for power efficiency
    for _ in 0..AES_ROUNDS - 1 {
        aes_round(&mut block0, &key);
        aes_round(&mut block1, &key);
    }
    aes_final_round(&mut block0, &key);
    aes_final_round(&mut block1, &key);

    let mut result = [0u8; 32];
    result[..16].copy_from_slice(&block0);
    result[16..32].copy_from_slice(&block1);
    for i in 0..32 { 
        result[i] ^= seed[i]; 
    }
    result
}

// ============================================================
// Step 4: Keccak256 final hash
// ============================================================
#[inline(always)]
fn step4_keccak(input: &[u8; 32]) -> [u8; 32] {
    Keccak256::digest(input).into()
}

// ============================================================
// Public API - Energy Optimized
// ============================================================

/// Energy-optimized DeekshaLite hash (128 KiB scratchpad, reduced operations)
pub fn deeksha_lite_optimized(header: &[u8], nonce: u64) -> [u8; 32] {
    let s1 = step1_keccak(header, nonce);
    let s2 = step2_memory_hard_lite(&s1);
    let s3 = step3_aes_mix_lite(&s2, nonce);
    step4_keccak(&s3)
}

/// Self-test for optimized version
pub fn deeksha_lite_optimized_self_test() -> bool {
    let header = b"ZION_DEEKSHA_LITE_OPTIMIZED_TEST_V1";
    let nonce: u64 = 0x123456789ABCDEF0;
    let h1 = deeksha_lite_optimized(header, nonce);
    let h2 = deeksha_lite_optimized(header, nonce);
    h1 == h2 && h1 != [0u8; 32]
}

/// Sequential nonce search with power optimization
pub fn deeksha_lite_optimized_find_nonce(
    header: &[u8],
    start_nonce: u64,
    count: u64,
    target: &[u8; 32],
) -> Option<(u64, [u8; 32])> {
    for offset in 0..count {
        let nonce = start_nonce.wrapping_add(offset);
        let hash = deeksha_lite_optimized(header, nonce);
        if hash <= *target {
            return Some((nonce, hash));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_optimized_deterministic() {
        let header = b"test_header_optimized";
        let nonce = 42u64;
        let h1 = deeksha_lite_optimized(header, nonce);
        let h2 = deeksha_lite_optimized(header, nonce);
        assert_eq!(h1, h2, "Optimized DeekshaLite must be deterministic");
        assert_ne!(h1, [0u8; 32], "Hash must not be all zeros");
    }

    #[test]
    fn test_optimized_different_from_standard() {
        use super::super::deeksha_lite::deeksha_lite;
        let header = b"test_header_comparison";
        let nonce = 42u64;
        let opt_hash = deeksha_lite_optimized(header, nonce);
        let std_hash = deeksha_lite(header, nonce);
        assert_ne!(opt_hash, std_hash, "Optimized hash must differ from standard");
    }

    #[test]
    fn test_optimized_self_test_passes() {
        assert!(deeksha_lite_optimized_self_test(), "Optimized self-test must pass");
    }

    #[test]
    fn test_memory_hard_lite_deterministic() {
        let seed = [0xABu8; 32];
        let r1 = step2_memory_hard_lite(&seed);
        let r2 = step2_memory_hard_lite(&seed);
        assert_eq!(r1, r2);
    }

    #[test]
    fn test_find_nonce_optimized() {
        let header = b"find_nonce_optimized";
        let target = [0xFFu8; 32];
        let result = deeksha_lite_optimized_find_nonce(header, 0u64, 1000, &target);
        assert!(result.is_some(), "Should find a nonce with easy target");
    }
}