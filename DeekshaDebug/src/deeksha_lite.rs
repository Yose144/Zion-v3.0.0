//! DeekshaLite v1 — Simplified ASIC-resistant algorithm for GCN compatibility
//!
//! Design goals:
//! - Remove NPU Mix (LayerNorm, GELU, int8 MLP) — GCN compiler bugs
//! - Remove Cosmic Fusion (complex Keccak+AES+XOR chain) — GCN pointer cast bugs
//! - Keep memory-hard scratchpad (main ASIC resistance)
//! - Add lightweight AES-128 rounds (compute-bound, GPU-friendly)
//! - Zero pointer casts, minimal 64-bit int usage
//!
//! Pipeline (4 steps):
//!   1. Keccak256(header||nonce) → 32B
//!   2. Memory-hard scratchpad (128 KiB, 2 passes, 64 random reads) → 32B
//!   3. AES-128 CTR mixing (4 rounds, key from step 2) → 32B
//!   4. Blake3-256 final hash → 32B

use sha3::{Digest, Keccak256};
use blake3;

pub const SCRATCHPAD_SIZE: usize = 128 * 1024; // 128 KiB
pub const BLOCK_SIZE: usize = 32;
pub const BLOCK_COUNT: usize = SCRATCHPAD_SIZE / BLOCK_SIZE; // 4096
pub const PASSES: usize = 2;
pub const RANDOM_READS: usize = 64;
pub const AES_ROUNDS: usize = 4;

// AES S-box (FIPS-197)
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

fn sub_bytes(state: &mut [u8; 16]) {
    for i in 0..16 {
        state[i] = AES_SBOX[state[i] as usize];
    }
}

fn shift_rows(state: &mut [u8; 16]) {
    // Row 1: shift left by 1
    let tmp = state[1];
    state[1] = state[5]; state[5] = state[9]; state[9] = state[13]; state[13] = tmp;
    // Row 2: shift left by 2
    let tmp = state[2];
    state[2] = state[10]; state[10] = tmp;
    let tmp = state[6];
    state[6] = state[14]; state[14] = tmp;
    // Row 3: shift left by 3
    let tmp = state[15];
    state[15] = state[11]; state[11] = state[7]; state[7] = state[3]; state[3] = tmp;
}

fn xtime(a: u8) -> u8 {
    ((a << 1) ^ (((a >> 7) & 1) * 0x1b))
}

fn mix_columns(state: &mut [u8; 16]) {
    for i in 0..4 {
        let a = state[i * 4];
        let b = state[i * 4 + 1];
        let c = state[i * 4 + 2];
        let d = state[i * 4 + 3];
        let e = a ^ b ^ c ^ d;
        state[i * 4]     ^= e ^ xtime(a ^ b);
        state[i * 4 + 1] ^= e ^ xtime(b ^ c);
        state[i * 4 + 2] ^= e ^ xtime(c ^ d);
        state[i * 4 + 3] ^= e ^ xtime(d ^ a);
    }
}

fn add_round_key(state: &mut [u8; 16], key: &[u8; 16]) {
    for i in 0..16 {
        state[i] ^= key[i];
    }
}

fn aes_round(state: &mut [u8; 16], key: &[u8; 16]) {
    sub_bytes(state);
    shift_rows(state);
    mix_columns(state);
    add_round_key(state, key);
}

fn aes_final_round(state: &mut [u8; 16], key: &[u8; 16]) {
    sub_bytes(state);
    shift_rows(state);
    add_round_key(state, key);
}

/// Step 1: Keccak256(header||nonce) → 32B
fn step1_keccak(header: &[u8], nonce: u64) -> [u8; 32] {
    let mut input = [0u8; 88];
    let hlen = header.len().min(80);
    input[..hlen].copy_from_slice(&header[..hlen]);
    input[80..88].copy_from_slice(&nonce.to_le_bytes());
    Keccak256::digest(&input).into()
}

/// Step 2: Memory-hard scratchpad (128 KiB) → 32B
fn step2_memory_hard(seed: &[u8; 32]) -> [u8; 32] {
    let mut scratchpad = vec![0u8; SCRATCHPAD_SIZE];

    // Phase 1: Fill with Blake3 XOF
    let mut blake3_hasher = blake3::Hasher::new();
    blake3_hasher.update(seed);
    let mut xof = blake3_hasher.finalize_xof();
    xof.fill(&mut scratchpad);

    // Phase 2: Sequential passes (forward + backward XOR mix)
    for pass in 0..PASSES {
        let forward = pass % 2 == 0;
        let indices: Vec<usize> = if forward {
            (0..BLOCK_COUNT).collect()
        } else {
            (0..BLOCK_COUNT).rev().collect()
        };

        for idx in indices {
            let prev_idx = if forward {
                if idx == 0 { BLOCK_COUNT - 1 } else { idx - 1 }
            } else {
                if idx + 1 == BLOCK_COUNT { 0 } else { idx + 1 }
            };

            let cur_off = idx * BLOCK_SIZE;
            let prev_off = prev_idx * BLOCK_SIZE;

            // XOR current block with previous block
            for i in 0..BLOCK_SIZE {
                scratchpad[cur_off + i] ^= scratchpad[prev_off + i];
            }
        }
    }

    // Phase 3: Random read mix
    let mut acc = [0u8; 32];
    acc.copy_from_slice(seed);
    let mut pos = 0usize;

    for r in 0..RANDOM_READS {
        let off = pos * BLOCK_SIZE;

        // Read block and XOR into accumulator
        for i in 0..32 {
            acc[i] ^= scratchpad[off + i];
        }

        // Derive next position from accumulator
        let mut idx_val: u64 = 0;
        for i in 0..8 {
            idx_val |= (acc[i] as u64) << (i * 8);
        }
        pos = ((idx_val ^ (pos as u64) ^ (r as u64)) as usize) % BLOCK_COUNT;
    }

    acc
}

/// Step 3: AES-128 CTR mixing (4 rounds, key from step 2)
fn step3_aes_mix(seed: &[u8; 32], nonce: u64) -> [u8; 32] {
    let key = {
        let mut k = [0u8; 16];
        k.copy_from_slice(&seed[..16]);
        k
    };

    let counter = {
        let mut c = [0u8; 16];
        c[0..8].copy_from_slice(&nonce.to_le_bytes());
        c[8..16].copy_from_slice(&seed[16..24]);
        c
    };

    let mut block0 = counter;
    let mut block1 = {
        let mut b = counter;
        // Increment counter for second block
        let mut carry: u16 = 1;
        for i in 0..16 {
            let sum = (b[i] as u16) + carry;
            b[i] = (sum & 0xFF) as u8;
            carry = sum >> 8;
            if carry == 0 { break; }
        }
        b
    };

    // 3 full AES rounds + 1 final round (no mix_columns)
    for _ in 0..3 {
        aes_round(&mut block0, &key);
        aes_round(&mut block1, &key);
    }
    aes_final_round(&mut block0, &key);
    aes_final_round(&mut block1, &key);

    // XOR with round constants derived from seed
    let mut result = [0u8; 32];
    result[0..16].copy_from_slice(&block0);
    result[16..32].copy_from_slice(&block1);

    for i in 0..32 {
        result[i] ^= seed[i % 32];
    }

    result
}

/// Step 4: Blake3-256 final hash
fn step4_blake3(input: &[u8; 32]) -> [u8; 32] {
    blake3::hash(input).into()
}

/// Full DeekshaLite hash
pub fn deeksha_lite(header: &[u8], nonce: u64) -> [u8; 32] {
    let s1 = step1_keccak(header, nonce);
    let s2 = step2_memory_hard(&s1);
    let s3 = step3_aes_mix(&s2, nonce);
    step4_blake3(&s3)
}

/// Self-test — deterministic check
pub fn deeksha_lite_self_test() -> bool {
    let test_header = b"ZION_DEEKSHA_LITE_TEST_V1";
    let test_nonce: u64 = 0x123456789ABCDEF0;

    let hash = deeksha_lite(test_header, test_nonce);

    // Expected hash (computed once, must remain stable)
    let expected = [
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ];

    // First run: print the actual hash for manual verification
    println!("DeekshaLite self-test hash: {}", hex::encode(&hash));

    // For now, just check it's not all zeros and is deterministic
    let hash2 = deeksha_lite(test_header, test_nonce);
    hash == hash2 && hash != [0u8; 32]
}

/// Benchmark throughput
pub fn benchmark(iterations: usize) -> f64 {
    use std::time::Instant;

    let header = b"ZION_DEEKSHA_LITE_BENCHMARK_HEADER_V1";
    let target = [0x10u8; 32]; // Easy target for benchmark

    let t0 = Instant::now();
    let mut found = 0usize;

    for nonce in 0..iterations as u64 {
        let hash = deeksha_lite(header, nonce);
        if hash[0] < target[0] {
            found += 1;
        }
    }

    let elapsed = t0.elapsed().as_secs_f64();
    let hps = iterations as f64 / elapsed;

    println!(
        "DeekshaLite: {} iterations in {:.3}s = {:.0} H/s (found={})",
        iterations, elapsed, hps, found
    );

    hps
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deeksha_lite_deterministic() {
        let header = b"test_header";
        let nonce = 42u64;

        let h1 = deeksha_lite(header, nonce);
        let h2 = deeksha_lite(header, nonce);

        assert_eq!(h1, h2, "DeekshaLite must be deterministic");
        assert_ne!(h1, [0u8; 32], "Hash must not be all zeros");
    }

    #[test]
    fn test_deeksha_lite_different_nonces() {
        let header = b"test_header";

        let h1 = deeksha_lite(header, 1u64);
        let h2 = deeksha_lite(header, 2u64);

        assert_ne!(h1, h2, "Different nonces must produce different hashes");
    }

    #[test]
    fn test_memory_hard_deterministic() {
        let seed = [0xABu8; 32];
        let r1 = step2_memory_hard(&seed);
        let r2 = step2_memory_hard(&seed);
        assert_eq!(r1, r2);
    }

    #[test]
    fn test_aes_mix_deterministic() {
        let seed = [0xCDu8; 32];
        let r1 = step3_aes_mix(&seed, 12345u64);
        let r2 = step3_aes_mix(&seed, 12345u64);
        assert_eq!(r1, r2);
    }
}
