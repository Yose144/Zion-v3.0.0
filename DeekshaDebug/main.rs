//! DeekshaLite Fire Optimized — CPU reference implementation (EXPERIMENTAL)
//!
//! EXPERIMENTAL VERSION FOR LOCAL TESTING ONLY
//! Fire Optimized = DeekshaLite v1 + reduced thermal_loop step.
//! The thermal loop burns ALU cycles after the AES mix to maximize GPU heat,
//! but with reduced iterations for better efficiency.
//!
//! Pipeline (must match deeksha_lite_fire_optimized.cl exactly):
//!   1. Keccak256(header[0..80] || nonce_le)  → s1[32]  — same as v1
//!   2. Memory-hard scratchpad (256 KiB, 8192 × 32B, 2 passes, 64 reads)  — same as v1
//!   3. AES-128 CTR mix (3 full rounds + 1 final)  — same as v1
//!   4. Thermal loop (8192 iters, 8 ulong integer chains)  — REDUCED vs original Fire
//!   5. Keccak256(s3_after_thermal)  → final hash[32]  — same as v1
//!
//! CHANGES vs deeksha_lite_fire:
//! - THERMAL_ITERS: 8192 (vs 65536) - 8x reduction for better efficiency
//! - All other constants identical to maintain compatibility

use sha3::{Digest, Keccak256};

#[inline(always)]
fn meets_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash <= target
}

pub const DEEKSHA_LITE_FIRE_OPTIMIZED_PROFILE: &str = "deeksha_lite_fire_optimized";

// Constants — identical to deeksha_lite_v1 for memory management
pub const SCRATCHPAD_SIZE: usize = 256 * 1024; // 256 KiB — same as v1
pub const BLOCK_SIZE:      usize = 32;
pub const BLOCK_COUNT:     usize = SCRATCHPAD_SIZE / BLOCK_SIZE; // 8192
pub const PASSES:          usize = 2;    // same as v1
pub const RANDOM_READS:    usize = 64;   // same as v1
pub const AES_ROUNDS:      usize = 4;    // same as v1 (3 full + 1 final)
pub const THERMAL_ITERS:   usize = 8192; // REDUCED from 65536 (8x less)

// ============================================================
// AES-128 helpers — identical to deeksha_lite.rs
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

const AES_INV_SBOX: [u8; 256] = [
    0x52,0x09,0x6a,0xd5,0x30,0x36,0xa5,0x38,0xbf,0x40,0xa3,0x9e,0x81,0xf3,0xd7,0xfb,
    0x7c,0xe3,0x39,0x82,0x9b,0x2f,0xff,0x87,0x34,0x8e,0x43,0x44,0xc4,0xde,0xe9,0xcb,
    0x54,0x7b,0x94,0x32,0xa6,0xc2,0x23,0x3d,0xee,0x4c,0x95,0x0b,0x42,0xfa,0xc3,0x4e,
    0x08,0x2e,0xa1,0x66,0x28,0xd9,0x24,0xb2,0x76,0x5b,0xa2,0x49,0x6d,0x8b,0xd1,0x25,
    0x72,0xf8,0xf6,0x64,0x86,0x68,0x98,0x16,0xd4,0xa4,0x5c,0xcc,0x5d,0x65,0xb6,0x92,
    0x6c,0x70,0x48,0x50,0xfd,0xed,0xb9,0xda,0x5e,0x15,0x46,0x57,0xa7,0x8d,0x9d,0x84,
    0x90,0xd8,0xab,0x00,0x8c,0xbc,0xd3,0x0a,0xf7,0xe4,0x58,0x05,0xb8,0xb3,0x8e,0xe7,
    0x2f,0x77,0x36,0x04,0x60,0x55,0x32,0x6f,0xf5,0x44,0x83,0x4d,0xa7,0x3a,0x47,0x7d,
    0x30,0x85,0xa5,0x22,0xb6,0x19,0xb0,0x9a,0x81,0xe7,0x39,0x4c,0x69,0x6f,0x5e,0x0f,
    0x94,0xea,0x65,0x7a,0xae,0x08,0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,
    0x74,0x1f,0x4b,0xbd,0x8b,0x8a,0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,
    0x57,0xb9,0x86,0xc1,0x1d,0x9e,0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,
    0x87,0xe9,0xce,0x55,0x28,0xdf,0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,
    0x2d,0x0f,0xb0,0x54,0xbb,0x16,
];

#[inline(always)]
fn aes_sbox(byte: u8) -> u8 {
    AES_SBOX[byte as usize]
}

#[inline(always)]
fn aes_inv_sbox(byte: u8) -> u8 {
    AES_INV_SBOX[byte as usize]
}

#[inline(always)]
fn sub_bytes(state: &mut [u8; 16]) {
    for i in 0..16 {
        state[i] = aes_sbox(state[i]);
    }
}

#[inline(always)]
fn inv_sub_bytes(state: &mut [u8; 16]) {
    for i in 0..16 {
        state[i] = aes_inv_sbox(state[i]);
    }
}

#[inline(always)]
fn shift_rows(state: &mut [u8; 16]) {
    let tmp = state[1];
    state[1] = state[5];
    state[5] = state[9];
    state[9] = state[13];
    state[13] = tmp;

    let tmp = state[2];
    state[2] = state[10];
    state[10] = tmp;
    let tmp = state[6];
    state[6] = state[14];
    state[14] = tmp;

    let tmp = state[3];
    state[3] = state[15];
    state[15] = state[11];
    state[11] = state[7];
    state[7] = tmp;
}

#[inline(always)]
fn inv_shift_rows(state: &mut [u8; 16]) {
    let tmp = state[1];
    state[1] = state[13];
    state[13] = state[9];
    state[9] = state[5];
    state[5] = tmp;

    let tmp = state[2];
    state[2] = state[10];
    state[10] = tmp;
    let tmp = state[6];
    state[6] = state[14];
    state[14] = tmp;

    let tmp = state[3];
    state[3] = state[7];
    state[7] = state[11];
    state[11] = state[15];
    state[15] = tmp;
}

#[inline(always)]
fn mix_columns(state: &mut [u8; 16]) {
    let tmp = [0u8; 16];
    tmp.copy_from_slice(state);

    state[0] = (tmp[0] ^ tmp[1] ^ tmp[2] ^ tmp[3] ^ mul2(tmp[0]));
    state[1] = (tmp[1] ^ tmp[2] ^ tmp[3] ^ tmp[0] ^ mul2(tmp[1]));
    state[2] = (tmp[2] ^ tmp[3] ^ tmp[0] ^ tmp[1] ^ mul2(tmp[2]));
    state[3] = (tmp[3] ^ tmp[0] ^ tmp[1] ^ tmp[2] ^ mul2(tmp[3]));

    state[4] = (tmp[4] ^ tmp[5] ^ tmp[6] ^ tmp[7] ^ mul2(tmp[4]));
    state[5] = (tmp[5] ^ tmp[6] ^ tmp[7] ^ tmp[4] ^ mul2(tmp[5]));
    state[6] = (tmp[6] ^ tmp[7] ^ tmp[4] ^ tmp[5] ^ mul2(tmp[6]));
    state[7] = (tmp[7] ^ tmp[4] ^ tmp[5] ^ tmp[6] ^ mul2(tmp[7]));

    state[8] = (tmp[8] ^ tmp[9] ^ tmp[10] ^ tmp[11] ^ mul2(tmp[8]));
    state[9] = (tmp[9] ^ tmp[10] ^ tmp[11] ^ tmp[8] ^ mul2(tmp[9]));
    state[10] = (tmp[10] ^ tmp[11] ^ tmp[8] ^ tmp[9] ^ mul2(tmp[10]));
    state[11] = (tmp[11] ^ tmp[8] ^ tmp[9] ^ tmp[10] ^ mul2(tmp[11]));

    state[12] = (tmp[12] ^ tmp[13] ^ tmp[14] ^ tmp[15] ^ mul2(tmp[12]));
    state[13] = (tmp[13] ^ tmp[14] ^ tmp[15] ^ tmp[12] ^ mul2(tmp[13]));
    state[14] = (tmp[14] ^ tmp[15] ^ tmp[12] ^ tmp[13] ^ mul2(tmp[14]));
    state[15] = (tmp[15] ^ tmp[12] ^ tmp[13] ^ tmp[14] ^ mul2(tmp[15]));
}

#[inline(always)]
fn inv_mix_columns(state: &mut [u8; 16]) {
    let tmp = [0u8; 16];
    tmp.copy_from_slice(state);

    state[0] = (mul14(tmp[0]) ^ mul11(tmp[1]) ^ mul13(tmp[2]) ^ mul9(tmp[3]));
    state[1] = (mul9(tmp[0]) ^ mul14(tmp[1]) ^ mul11(tmp[2]) ^ mul13(tmp[3]));
    state[2] = (mul13(tmp[0]) ^ mul9(tmp[1]) ^ mul14(tmp[2]) ^ mul11(tmp[3]));
    state[3] = (mul11(tmp[0]) ^ mul13(tmp[1]) ^ mul9(tmp[2]) ^ mul14(tmp[3]));

    state[4] = (mul14(tmp[4]) ^ mul11(tmp[5]) ^ mul13(tmp[6]) ^ mul9(tmp[7]));
    state[5] = (mul9(tmp[4]) ^ mul14(tmp[5]) ^ mul11(tmp[6]) ^ mul13(tmp[7]));
    state[6] = (mul13(tmp[4]) ^ mul9(tmp[5]) ^ mul14(tmp[6]) ^ mul11(tmp[7]));
    state[7] = (mul11(tmp[4]) ^ mul13(tmp[5]) ^ mul9(tmp[6]) ^ mul14(tmp[7]));

    state[8] = (mul14(tmp[8]) ^ mul11(tmp[9]) ^ mul13(tmp[10]) ^ mul9(tmp[11]));
    state[9] = (mul9(tmp[8]) ^ mul14(tmp[9]) ^ mul11(tmp[10]) ^ mul13(tmp[11]));
    state[10] = (mul13(tmp[8]) ^ mul9(tmp[9]) ^ mul14(tmp[10]) ^ mul11(tmp[11]));
    state[11] = (mul11(tmp[8]) ^ mul13(tmp[9]) ^ mul9(tmp[10]) ^ mul14(tmp[11]));

    state[12] = (mul14(tmp[12]) ^ mul11(tmp[13]) ^ mul13(tmp[14]) ^ mul9(tmp[15]));
    state[13] = (mul9(tmp[12]) ^ mul14(tmp[13]) ^ mul11(tmp[14]) ^ mul13(tmp[15]));
    state[14] = (mul13(tmp[12]) ^ mul9(tmp[13]) ^ mul14(tmp[14]) ^ mul11(tmp[15]));
    state[15] = (mul11(tmp[12]) ^ mul13(tmp[13]) ^ mul9(tmp[14]) ^ mul14(tmp[15]));
}

#[inline(always)]
fn mul2(a: u8) -> u8 {
    let (hi, lo) = a.overflowing_mul(2);
    if hi { lo ^ 0x1b } else { lo }
}

#[inline(always)]
fn mul9(a: u8) -> u8 { mul2(mul2(mul2(a))) ^ a }

#[inline(always)]
fn mul11(a: u8) -> u8 { mul2(mul2(mul2(a))) ^ mul2(a) ^ a }

#[inline(always)]
fn mul13(a: u8) -> u8 { mul2(mul2(mul2(a))) ^ mul2(a) ^ mul2(a) ^ a }

#[inline(always)]
fn mul14(a: u8) -> u8 { mul2(mul2(mul2(a))) ^ mul2(a) ^ mul2(a) ^ mul2(a) }

#[inline(always)]
fn add_round_key(state: &mut [u8; 16], round_key: &[u8; 16]) {
    for i in 0..16 {
        state[i] ^= round_key[i];
    }
}

#[inline(always)]
fn aes_round(state: &mut [u8; 16], round_key: &[u8; 16]) {
    sub_bytes(state);
    shift_rows(state);
    mix_columns(state);
    add_round_key(state, round_key);
}

#[inline(always)]
fn aes_final_round(state: &mut [u8; 16], round_key: &[u8; 16]) {
    sub_bytes(state);
    shift_rows(state);
    add_round_key(state, round_key);
}

#[inline(always)]
fn aes_encrypt_block(input: &[u8; 16], key: &[u8; 16]) -> [u8; 16] {
    let mut state = *input;
    let mut round_key = *key;

    add_round_key(&mut state, &round_key);

    for _ in 0..3 {
        aes_round(&mut state, &round_key);
    }

    aes_final_round(&mut state, &round_key);
    state
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
// Step 2: Memory-hard scratchpad (256 KiB, 8192 × 32B, 2 passes, 64 reads)
// ============================================================

#[inline(always)]
fn step2_memory_hard(s1: &[u8; 32]) -> Vec<u8> {
    let mut scratchpad = vec![0u8; SCRATCHPAD_SIZE];
    let mut state = *s1;

    // Pass 1: Fill scratchpad
    for i in 0..BLOCK_COUNT {
        let mut block = [0u8; BLOCK_SIZE];
        block.copy_from_slice(&state);
        let encrypted = aes_encrypt_block(&block, &state);
        scratchpad[i * BLOCK_SIZE..(i + 1) * BLOCK_SIZE].copy_from_slice(&encrypted);
        state = encrypted;
    }

    // Pass 2: Random reads + AES mix
    let mut result = state;
    for i in 0..RANDOM_READS {
        let idx = ((i as u64).wrapping_mul(0x9E3779B97F4A7C15u64) % BLOCK_COUNT as u64) as usize;
        let mut block = [0u8; BLOCK_SIZE];
        block.copy_from_slice(&scratchpad[idx * BLOCK_SIZE..(idx + 1) * BLOCK_SIZE]);
        let encrypted = aes_encrypt_block(&block, &result);
        scratchpad[idx * BLOCK_SIZE..(idx + 1) * BLOCK_SIZE].copy_from_slice(&encrypted);
        result = encrypted;
    }

    scratchpad
}

// ============================================================
// Step 3: AES-128 CTR mix (3 full rounds + 1 final)
// ============================================================

#[inline(always)]
fn step3_aes_mix(s2: &[u8], nonce: u64) -> [u8; 32] {
    let mut result = [0u8; 32];
    let mut counter = nonce;

    for i in 0..2 {
        let mut block = [0u8; 16];
        block.copy_from_slice(&s2[i * 16..(i + 1) * 16]);
        let key = counter.to_le_bytes();
        let encrypted = aes_encrypt_block(&block, &key);
        result[i * 16..(i + 1) * 16].copy_from_slice(&encrypted);
        counter = counter.wrapping_add(1);
    }

    result
}

// ============================================================
// Step 4: Thermal loop — only addition over v1 (REDUCED)
//
// 8 independent ulong chains, 8192 iterations (reduced from 65536).
// Integer-only (no float) = deterministic on all GPU drivers.
// Identical logic in deeksha_lite_fire_optimized.cl thermal_loop().
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

// ============================================================
// Public API
// ============================================================

/// Full DeekshaLite Fire Optimized hash (matches deeksha_lite_fire_optimized.cl exactly)
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

/// Sequential nonce search
pub fn deeksha_lite_fire_optimized_find_nonce(
    header: &[u8],
    target: &[u8; 32],
    start_nonce: u64,
    nonce_count: u64,
) -> Option<(u64, [u8; 32])> {
    for offset in 0..nonce_count {
        let nonce = start_nonce.wrapping_add(offset);
        let hash = deeksha_lite_fire_optimized(header, nonce);
        if meets_target(&hash, target) {
            return Some((nonce, hash));
        }
    }
    None
}

fn main() {
    println!("DeekshaLite Fire Optimized - Experimental Testing");
    println!("THERMAL_ITERS: {}", THERMAL_ITERS);
    
    // Self-test
    if deeksha_lite_fire_optimized_self_test() {
        println!("✅ Self-test passed");
    } else {
        println!("❌ Self-test failed");
    }
    
    // Benchmark
    let header = b"ZION_FIRE_OPT_BENCHMARK_V1";
    let nonce: u64 = 0x123456789ABCDEF0;
    
    let start = std::time::Instant::now();
    let iterations = 1000;
    
    for i in 0..iterations {
        let hash = deeksha_lite_fire_optimized(header, nonce + i);
        if i == 0 {
            println!("Sample hash: {:02x}{:02x}{:02x}{:02x}...", hash[0], hash[1], hash[2], hash[3]);
        }
    }
    
    let duration = start.elapsed();
    let hashrate = iterations as f64 / duration.as_secs_f64();
    
    println!("Benchmark: {} iterations in {:?}", iterations, duration);
    println!("Hashrate: {:.2} H/s", hashrate);
}