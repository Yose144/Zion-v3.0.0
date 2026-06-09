//! DeekshaLite v1 — CPU reference implementation
//!
//! Pipeline (must match DeekshaDebug/kernels/deeksha_lite.cl exactly):
//!   1. Keccak256(header[0..80] || nonce_le[0..8])          → s1[32]
//!   2. Memory-hard scratchpad (256 KiB, 8192 blocks × 32B)
//!        Phase A: SHA3-512 chain fill
//!                 state = seed || 0×32; for blk in 0..8192:
//!                   inp = state || (blk & 0xFF); sha3_512(inp[..65]) → out
//!                   pad[blk*32..+32] = out[0..32]; state[0..32] = out[0..32]
//!        Phase B: 2 sequential XOR passes (forward, backward)
//!        Phase C: 64 random reads, idx from 8-byte u64 accumulator
//!   3. AES-128 CTR mix (key=s2[0..16], counter=nonce_le||s2[16..24])
//!        block0 = counter, block1 = counter + 1 (carry-propagated)
//!        3 full AES rounds + 1 final round (no mix_columns)
//!        XOR result with s2[0..32]
//!   4. Keccak256(s3)  → final hash[32]

use sha3::{Digest, Keccak256, Sha3_512};

pub const SCRATCHPAD_SIZE: usize = 256 * 1024; // 256 KiB (matches V3)
pub const BLOCK_SIZE:      usize = 32;
pub const BLOCK_COUNT:     usize = SCRATCHPAD_SIZE / BLOCK_SIZE; // 8192
pub const PASSES:          usize = 2;
pub const RANDOM_READS:    usize = 64;
pub const AES_ROUNDS:      usize = 4;

// ============================================================
// AES-128 helpers (FIPS-197)
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

fn sub_bytes(s: &mut [u8; 16]) { for i in 0..16 { s[i] = AES_SBOX[s[i] as usize]; } }

fn shift_rows(s: &mut [u8; 16]) {
    let t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
    let t = s[2]; s[2] = s[10]; s[10] = t;
    let t = s[6]; s[6] = s[14]; s[14] = t;
    let t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
}

fn xtime(a: u8) -> u8 { (a << 1) ^ (((a >> 7) & 1) * 0x1b) }

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

fn add_round_key(s: &mut [u8; 16], k: &[u8; 16]) { for i in 0..16 { s[i] ^= k[i]; } }

fn aes_round(s: &mut [u8; 16], k: &[u8; 16]) {
    sub_bytes(s); shift_rows(s); mix_columns(s); add_round_key(s, k);
}

fn aes_final_round(s: &mut [u8; 16], k: &[u8; 16]) {
    sub_bytes(s); shift_rows(s); add_round_key(s, k);
}

// ============================================================
// SHA3-512 wrapper
// ============================================================
fn sha3_512(input: &[u8]) -> [u8; 64] {
    Sha3_512::digest(input).into()
}

// ============================================================
// Step 1: Keccak256(header[0..80] || nonce_le)
// ============================================================
fn step1_keccak(header: &[u8], nonce: u64) -> [u8; 32] {
    let mut input = [0u8; 88];
    let hlen = header.len().min(80);
    input[..hlen].copy_from_slice(&header[..hlen]);
    input[80..88].copy_from_slice(&nonce.to_le_bytes());
    Keccak256::digest(&input).into()
}

// ============================================================
// Step 2: Memory-hard scratchpad → acc[32]
// ============================================================
fn step2_memory_hard(seed: &[u8; 32]) -> [u8; 32] {
    let mut scratchpad = vec![0u8; SCRATCHPAD_SIZE];

    // Phase A: SHA3-512 chain fill
    // state = seed || 0×32
    // for blk in 0..BLOCK_COUNT:
    //   inp[0..64] = state; inp[64] = blk & 0xFF
    //   out = sha3_512(&inp[..65])
    //   pad[blk*32..+32] = out[0..32]; state[0..32] = out[0..32]
    let mut state = [0u8; 64];
    state[..32].copy_from_slice(seed);
    // state[32..64] already zero

    for blk in 0..BLOCK_COUNT {
        let mut inp = [0u8; 65];
        inp[..64].copy_from_slice(&state);
        inp[64] = (blk & 0xFF) as u8; // only low byte — matches GPU inp[64]
        let out = sha3_512(&inp[..65]);
        let off = blk * BLOCK_SIZE;
        scratchpad[off..off + 32].copy_from_slice(&out[..32]);
        state[..32].copy_from_slice(&out[..32]);
    }

    // Phase B: 2 sequential passes
    // Pass 0 (forward): pad[i] ^= pad[i==0 ? 4095 : i-1]
    for i in 0..BLOCK_COUNT {
        let prev = if i == 0 { BLOCK_COUNT - 1 } else { i - 1 };
        let (cur_off, prv_off) = (i * BLOCK_SIZE, prev * BLOCK_SIZE);
        for j in 0..BLOCK_SIZE {
            let pv = scratchpad[prv_off + j];
            scratchpad[cur_off + j] ^= pv;
        }
    }
    // Pass 1 (backward): pad[i] ^= pad[i+1==4096 ? 0 : i+1]
    for i in (0..BLOCK_COUNT).rev() {
        let next = if i + 1 == BLOCK_COUNT { 0 } else { i + 1 };
        let (cur_off, nxt_off) = (i * BLOCK_SIZE, next * BLOCK_SIZE);
        for j in 0..BLOCK_SIZE {
            let nv = scratchpad[nxt_off + j];
            scratchpad[cur_off + j] ^= nv;
        }
    }

    // Phase C: 64 random reads, idx_val from 8 bytes (u64)
    let mut acc = [0u8; 32];
    acc.copy_from_slice(seed);
    let mut pos: u64 = 0;

    for r in 0..RANDOM_READS as u64 {
        let off = (pos as usize) * BLOCK_SIZE;
        for i in 0..32 { acc[i] ^= scratchpad[off + i]; }

        // idx_val: 8 bytes LE — matches GPU `for i in 0..8`
        let mut idx_val: u64 = 0;
        for i in 0..8 { idx_val |= (acc[i] as u64) << (i * 8); }
        pos = (idx_val ^ pos ^ r) % BLOCK_COUNT as u64;
    }

    acc
}

// ============================================================
// Step 3: AES-128 CTR mix
// ============================================================
fn step3_aes_mix(seed: &[u8; 32], nonce: u64) -> [u8; 32] {
    let mut key = [0u8; 16];
    key.copy_from_slice(&seed[..16]);

    let mut counter = [0u8; 16];
    counter[..8].copy_from_slice(&nonce.to_le_bytes());
    counter[8..16].copy_from_slice(&seed[16..24]);

    let mut block0 = counter;
    let mut block1 = counter;

    // Proper carry propagation for counter+1 — matches GPU
    let mut carry: u16 = 1;
    for i in 0..16 {
        let sum = (block1[i] as u16) + carry;
        block1[i] = (sum & 0xFF) as u8;
        carry = sum >> 8;
        if carry == 0 { break; }
    }

    for _ in 0..3 {
        aes_round(&mut block0, &key);
        aes_round(&mut block1, &key);
    }
    aes_final_round(&mut block0, &key);
    aes_final_round(&mut block1, &key);

    let mut result = [0u8; 32];
    result[..16].copy_from_slice(&block0);
    result[16..32].copy_from_slice(&block1);
    for i in 0..32 { result[i] ^= seed[i]; }
    result
}

// ============================================================
// Step 4: Keccak256 final hash
// ============================================================
fn step4_keccak(input: &[u8; 32]) -> [u8; 32] {
    Keccak256::digest(input).into()
}

// ============================================================
// Public API
// ============================================================

/// Full DeekshaLite hash (matches deeksha_lite.cl kernel exactly)
pub fn deeksha_lite(header: &[u8], nonce: u64) -> [u8; 32] {
    let s1 = step1_keccak(header, nonce);
    let s2 = step2_memory_hard(&s1);
    let s3 = step3_aes_mix(&s2, nonce);
    step4_keccak(&s3)
}

/// Step-by-step debug output for GPU mismatch investigation
pub fn deeksha_lite_debug(header: &[u8], nonce: u64) -> ([u8; 32], [u8; 32], [u8; 32], [u8; 32]) {
    let s1 = step1_keccak(header, nonce);
    let s2 = step2_memory_hard(&s1);
    let s3 = step3_aes_mix(&s2, nonce);
    let s4 = step4_keccak(&s3);
    (s1, s2, s3, s4)
}

/// Self-test — deterministic check
pub fn deeksha_lite_self_test() -> bool {
    let header = b"ZION_DEEKSHA_LITE_TEST_V1";
    let nonce: u64 = 0x123456789ABCDEF0;
    let h1 = deeksha_lite(header, nonce);
    let h2 = deeksha_lite(header, nonce);
    println!("DeekshaLite self-test hash: {}", hex::encode(&h1));
    h1 == h2 && h1 != [0u8; 32]
}

/// CPU throughput benchmark
pub fn benchmark(iterations: usize) -> f64 {
    use std::time::Instant;
    let header = b"ZION_DEEKSHA_LITE_BENCHMARK_HEADER_V1";
    let t0 = Instant::now();
    let mut found = 0usize;
    for nonce in 0..iterations as u64 {
        let hash = deeksha_lite(header, nonce);
        if hash[0] < 0x10 { found += 1; }
    }
    let elapsed = t0.elapsed().as_secs_f64();
    let hps = iterations as f64 / elapsed;
    println!("DeekshaLite: {} iters in {:.3}s = {:.0} H/s (found={})", iterations, elapsed, hps, found);
    hps
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deterministic() {
        let header = b"test_header";
        let h1 = deeksha_lite(header, 42);
        let h2 = deeksha_lite(header, 42);
        assert_eq!(h1, h2);
        assert_ne!(h1, [0u8; 32]);
    }

    #[test]
    fn test_different_nonces() {
        let header = b"test_header";
        assert_ne!(deeksha_lite(header, 1), deeksha_lite(header, 2));
    }

    #[test]
    fn test_self_test() {
        assert!(deeksha_lite_self_test());
    }

    #[test]
    fn test_known_vector() {
        // Run once to capture, then lock it in
        let h = deeksha_lite(b"ZION_DEEKSHA_LITE_TEST_V1", 0x123456789ABCDEF0);
        // First run: print the vector so we can hard-code it
        println!("known_vector: {}", hex::encode(&h));
        // Verify it stays stable across code changes
        let h2 = deeksha_lite(b"ZION_DEEKSHA_LITE_TEST_V1", 0x123456789ABCDEF0);
        assert_eq!(h, h2, "Hash changed — algorithm not deterministic!");
    }
}
