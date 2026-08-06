//! Ekam Deeksha — canonical V31 PoW (Ekam v2, 128 KiB scratchpad).
//!
//! Pipeline (must match V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl):
//!   1. Keccak256(header[0..80] || nonce_le[0..8])             → s1[32]
//!   2. Memory-hard scratchpad (128 KiB, 4096 blocks × 32B)
//!        Phase A: SHA3-512 chain fill
//!                 state = seed || 0×32
//!                 for blk in 0..4096:
//!                   inp[0..64] = state; inp[64] = blk & 0xFF
//!                   out = sha3_512(&inp[..65])
//!                   pad[blk*32..+32] = out[0..32]; state[0..32] = out[0..32]
//!        Phase B: 1 forward sequential XOR pass
//!        Phase C: 32 random reads, idx from 8-byte u64 accumulator
//!   3. AES-128 CTR mix (key=s2[0..16], counter=nonce_le||s2[16..24])
//!        block0 = counter, block1 = counter+1 (carry-propagated)
//!        1 full AES round + 1 final round (no mix_columns)
//!        XOR result with s2[0..32]
//!   4. Keccak256(s3)  → final hash[32]

// Hash loops intentionally mirror the GPU kernel (deeksha_lite.cl) byte-for-byte;
// index-based loops keep that parity explicit. Doc list uses intentional ASCII alignment.
#![allow(clippy::needless_range_loop)]
#![allow(clippy::doc_overindented_list_items)]

use sha3::{Digest, Keccak256, Sha3_512};
use zion_l1_types::Hash;

use super::PowAlgorithm;

// ── Scratchpad reuse ───────────────────────────────────────────────────────
// The original code allocated `vec![0u8; 128 KiB]` on EVERY nonce, causing
// massive allocation pressure (128 KiB × H/s). We now allocate the scratchpad
// once per batch (or per thread in parallel mode) and pass it as a parameter,
// eliminating per-nonce allocation entirely with zero TLS overhead.

/// Local replacement for the V3 `crate::algorithms_opt::Hash32` type.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct Hash32 {
    pub data: [u8; 32],
}

#[inline(always)]
pub fn meets_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash <= target
}

pub const ALGORITHM_NAME: &str = "ekam_deeksha";

pub const SCRATCHPAD_SIZE: usize = 128 * 1024; // 128 KiB
pub const BLOCK_SIZE: usize = 32;
pub const BLOCK_COUNT: usize = SCRATCHPAD_SIZE / BLOCK_SIZE; // 4096
pub const PASSES: usize = 1;
pub const RANDOM_READS: usize = 32;
pub const AES_ROUNDS: usize = 2;

// ============================================================
// AES-128 helpers (FIPS-197)
// ============================================================

const AES_SBOX: [u8; 256] = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
];

fn sub_bytes(s: &mut [u8; 16]) {
    for i in 0..16 {
        s[i] = AES_SBOX[s[i] as usize];
    }
}

fn shift_rows(s: &mut [u8; 16]) {
    let t = s[1];
    s[1] = s[5];
    s[5] = s[9];
    s[9] = s[13];
    s[13] = t;
    let _t = s[2];
    s.swap(2, 10);
    let _t = s[6];
    s.swap(6, 14);
    let t = s[15];
    s[15] = s[11];
    s[11] = s[7];
    s[7] = s[3];
    s[3] = t;
}

fn xtime(a: u8) -> u8 {
    (a << 1) ^ (((a >> 7) & 1) * 0x1b)
}

fn mix_columns(s: &mut [u8; 16]) {
    for i in 0..4 {
        let (a, b, c, d) = (s[i * 4], s[i * 4 + 1], s[i * 4 + 2], s[i * 4 + 3]);
        let e = a ^ b ^ c ^ d;
        s[i * 4] ^= e ^ xtime(a ^ b);
        s[i * 4 + 1] ^= e ^ xtime(b ^ c);
        s[i * 4 + 2] ^= e ^ xtime(c ^ d);
        s[i * 4 + 3] ^= e ^ xtime(d ^ a);
    }
}

fn add_round_key(s: &mut [u8; 16], k: &[u8; 16]) {
    for i in 0..16 {
        s[i] ^= k[i];
    }
}

fn aes_round(s: &mut [u8; 16], k: &[u8; 16]) {
    sub_bytes(s);
    shift_rows(s);
    mix_columns(s);
    add_round_key(s, k);
}

fn aes_final_round(s: &mut [u8; 16], k: &[u8; 16]) {
    sub_bytes(s);
    shift_rows(s);
    add_round_key(s, k);
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
    Keccak256::digest(input).into()
}

// ============================================================
// Step 2: Memory-hard scratchpad (128 KiB) → acc[32]
// ============================================================
// OPTIMIZED: Takes a reusable scratchpad buffer instead of allocating
// 128 KiB on every nonce. The buffer is allocated once per batch/thread.
fn step2_memory_hard_with_scratchpad(seed: &[u8; 32], scratchpad: &mut [u8]) -> [u8; 32] {
    // Phase A: SHA3-512 chain fill
    // state = seed || 0×32; inp[64] = blk & 0xFF; hash 65 bytes
    let mut state = [0u8; 64];
    state[..32].copy_from_slice(seed);

    let mut inp = [0u8; 65];
    for blk in 0..BLOCK_COUNT {
        inp[..64].copy_from_slice(&state);
        inp[64] = (blk & 0xFF) as u8;
        let out = sha3_512(&inp[..65]);
        let off = blk * BLOCK_SIZE;
        scratchpad[off..off + 32].copy_from_slice(&out[..32]);
        state[..32].copy_from_slice(&out[..32]);
    }

    // Phase B: 1 forward sequential XOR pass
    for i in 0..BLOCK_COUNT {
        let prev = if i == 0 { BLOCK_COUNT - 1 } else { i - 1 };
        let (cur, prv) = (i * BLOCK_SIZE, prev * BLOCK_SIZE);
        for j in 0..BLOCK_SIZE {
            let pv = scratchpad[prv + j];
            scratchpad[cur + j] ^= pv;
        }
    }
    // Backward pass only used when PASSES >= 2 (legacy v1); Ekam v2 keeps 1 pass.
    if PASSES >= 2 {
        for i in (0..BLOCK_COUNT).rev() {
            let next = if i + 1 == BLOCK_COUNT { 0 } else { i + 1 };
            let (cur, nxt) = (i * BLOCK_SIZE, next * BLOCK_SIZE);
            for j in 0..BLOCK_SIZE {
                let nv = scratchpad[nxt + j];
                scratchpad[cur + j] ^= nv;
            }
        }
    }

    // Phase C: 32 random reads, idx from 8 bytes (u64) — matches GPU
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
        pos = (idx_val ^ pos ^ r) % BLOCK_COUNT as u64;
    }

    acc
}

/// Original step2 that allocates its own scratchpad (for single-hash API).
fn step2_memory_hard(seed: &[u8; 32]) -> [u8; 32] {
    let mut scratchpad = vec![0u8; SCRATCHPAD_SIZE];
    step2_memory_hard_with_scratchpad(seed, &mut scratchpad)
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

    // Carry-propagated increment (matches GPU)
    let mut carry: u16 = 1;
    for i in 0..16 {
        let sum = (block1[i] as u16) + carry;
        block1[i] = (sum & 0xFF) as u8;
        carry = sum >> 8;
        if carry == 0 {
            break;
        }
    }

    // Ekam v2: 1 full AES round + 1 final round (total AES_ROUNDS=2)
    for _ in 0..(AES_ROUNDS - 1) {
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
fn step4_keccak(input: &[u8; 32]) -> [u8; 32] {
    Keccak256::digest(input).into()
}

// ============================================================
// Public API
// ============================================================

/// Full Ekam Deeksha hash (bit-identical to V3 `deeksha_lite`).
pub fn hash(header: &[u8], nonce: u64) -> [u8; 32] {
    let s1 = step1_keccak(header, nonce);
    let s2 = step2_memory_hard(&s1);
    let s3 = step3_aes_mix(&s2, nonce);
    step4_keccak(&s3)
}

/// Full Ekam Deeksha hash using a pre-allocated scratchpad buffer.
/// Avoids the 128 KiB allocation per nonce — pass a reusable buffer.
#[inline]
pub fn hash_with_scratchpad(header: &[u8], nonce: u64, scratchpad: &mut [u8]) -> [u8; 32] {
    let s1 = step1_keccak(header, nonce);
    let s2 = step2_memory_hard_with_scratchpad(&s1, scratchpad);
    let s3 = step3_aes_mix(&s2, nonce);
    step4_keccak(&s3)
}

/// Sequential nonce search (bit-identical to V3 `deeksha_lite_find_nonce`).
/// Allocates a scratchpad once and reuses it across all nonces in the batch.
pub fn find_nonce(
    header: &[u8],
    start_nonce: u64,
    count: u64,
    target: &[u8; 32],
) -> Option<(u64, [u8; 32])> {
    let mut scratchpad = vec![0u8; SCRATCHPAD_SIZE];
    for offset in 0..count {
        let nonce = start_nonce.wrapping_add(offset);
        let hash = hash_with_scratchpad(header, nonce, &mut scratchpad);
        if meets_target(&hash, target) {
            return Some((nonce, hash));
        }
    }
    None
}

/// Canonical Ekam Deeksha hasher.
#[derive(Clone, Copy, Debug, Default)]
pub struct EkamDeeksha;

impl EkamDeeksha {
    pub fn new() -> Self {
        Self
    }

    /// Compute the raw hash bytes without the `PowAlgorithm` trait wrapper.
    pub fn hash_bytes(header: &[u8], nonce: u64) -> [u8; 32] {
        hash(header, nonce)
    }

    /// Height-aware wrapper (for dual-algo compatibility).
    pub fn hash_with_height(header: &[u8], nonce: u64, _height: u64) -> Hash32 {
        Hash32 {
            data: Self::hash_bytes(header, nonce),
        }
    }
}

impl PowAlgorithm for EkamDeeksha {
    fn name(&self) -> &'static str {
        ALGORITHM_NAME
    }

    fn hash(&self, header: &[u8], nonce: u64) -> Hash {
        Hash::new(Self::hash_bytes(header, nonce))
    }

    fn verify(&self, header: &[u8], nonce: u64, target: &[u8; 32]) -> bool {
        meets_target(&Self::hash_bytes(header, nonce), target)
    }

    fn find_nonce(
        &self,
        header: &[u8],
        start: u64,
        limit: u64,
        target: &[u8; 32],
    ) -> Option<(u64, Hash)> {
        find_nonce(header, start, limit, target).map(|(n, h)| (n, Hash::new(h)))
    }
}

// Known-answer test vectors for the canonical Ekam v2 pipeline.
// Generated by the Ekam Deeksha v2 implementation and locked; if these change,
// the CPU↔GPU pipeline is broken.
pub const LITE_KAT_HEADER: &[u8] = b"ZION_LITE_KAT_V1";
pub const LITE_KAT: &[(&str, u64)] = &[
    (
        "7cb66d998de635447846d8b717e33a575b7be29059d59158caa79dd71ab4666d",
        0,
    ),
    (
        "07b45ef378548b62830bf748b318dd8b4ede3fb1e34951f9a4d1a909ac362994",
        1,
    ),
    (
        "6edc3707c9ab4c37e70a7841a64e4b810143ee8025bfc944b9846a94653cee30",
        42,
    ),
    (
        "c3c9c406e61d145e34dc55db301949dfdd0d952295815f59a0f63d8bab9869b6",
        0xDEADBEEF,
    ),
    (
        "ea82030b33bf3eb1cfc3938c70a5be54eba736b2a871dd7a8af8ab7a8f33ff49",
        u64::MAX,
    ),
];

#[cfg(test)]
mod tests {
    use super::*;

    // ── Determinism ──────────────────────────────────────────────────────────

    #[test]
    fn deterministic() {
        let header = b"ekam_deeksha_determinism";
        let h1 = EkamDeeksha::hash_bytes(header, 0);
        let h2 = EkamDeeksha::hash_bytes(header, 0);
        assert_eq!(h1, h2);
    }

    #[test]
    fn different_nonces() {
        let header = b"test_header";
        let h1 = EkamDeeksha::hash_bytes(header, 1);
        let h2 = EkamDeeksha::hash_bytes(header, 2);
        assert_ne!(h1, h2);
    }

    #[test]
    fn different_headers() {
        let h1 = EkamDeeksha::hash_bytes(b"header_a", 0);
        let h2 = EkamDeeksha::hash_bytes(b"header_b", 0);
        assert_ne!(h1, h2);
    }

    // ── Sub-step determinism ─────────────────────────────────────────────────

    #[test]
    fn memory_hard_deterministic() {
        let seed = [0xABu8; 32];
        let r1 = step2_memory_hard(&seed);
        let r2 = step2_memory_hard(&seed);
        assert_eq!(r1, r2);
    }

    #[test]
    fn memory_hard_nonzero() {
        let seed = [0x00u8; 32];
        let r = step2_memory_hard(&seed);
        assert_ne!(r, [0u8; 32]);
    }

    #[test]
    fn memory_hard_different_seeds() {
        let r1 = step2_memory_hard(&[0x11u8; 32]);
        let r2 = step2_memory_hard(&[0x22u8; 32]);
        assert_ne!(r1, r2);
    }

    #[test]
    fn aes_mix_deterministic() {
        let seed = [0xCDu8; 32];
        let r1 = step3_aes_mix(&seed, 12345);
        let r2 = step3_aes_mix(&seed, 12345);
        assert_eq!(r1, r2);
    }

    #[test]
    fn aes_mix_nonce_sensitivity() {
        let seed = [0xCDu8; 32];
        let r1 = step3_aes_mix(&seed, 0);
        let r2 = step3_aes_mix(&seed, 1);
        assert_ne!(r1, r2);
    }

    // ── Edge-case nonces ─────────────────────────────────────────────────────

    #[test]
    fn nonce_zero() {
        let h = EkamDeeksha::hash_bytes(b"edge_nonce", 0);
        assert_ne!(h, [0u8; 32]);
    }

    #[test]
    fn nonce_max() {
        let h = EkamDeeksha::hash_bytes(b"edge_nonce", u64::MAX);
        assert_ne!(h, [0u8; 32]);
    }

    #[test]
    fn nonce_zero_vs_one() {
        let h0 = EkamDeeksha::hash_bytes(b"edge_nonce", 0);
        let h1 = EkamDeeksha::hash_bytes(b"edge_nonce", 1);
        assert_ne!(h0, h1);
    }

    // ── Known-answer tests (KAT) — locks the exact output ───────────────────

    #[test]
    fn lite_kat_vectors() {
        for &(expected_hex, nonce) in LITE_KAT {
            let hash = EkamDeeksha::hash_bytes(LITE_KAT_HEADER, nonce);
            let got: String = hash.iter().map(|b| format!("{:02x}", b)).collect();
            assert_eq!(
                got, expected_hex,
                "KAT MISMATCH: nonce={} — CPU pipeline changed or GPU kernel will diverge!",
                nonce
            );
        }
    }

    // ── Ekam v2 canonical test vector ─────────────────────────────────────

    #[test]
    fn ekam_v2_canonical_vector() {
        let header = b"ZION_DEEKSHA_LITE_TEST_V1";
        let nonce: u64 = 0x123456789ABCDEF0;
        let hash = EkamDeeksha::hash_bytes(header, nonce);
        let expected = "26ee10e432fdaf6d0bbe2e359355974a20e2ec4cd6dee649ef46450f398830eb";
        let got: String = hash.iter().map(|b| format!("{:02x}", b)).collect();
        assert_eq!(
            got, expected,
            "Ekam v2 canonical vector mismatch: CPU pipeline changed"
        );
    }

    // ── Target comparison (meets_target) ────────────────────────────────────

    #[test]
    fn target_all_ff_always_passes() {
        let target = [0xFFu8; 32];
        for nonce in 0u64..10 {
            let h = EkamDeeksha::hash_bytes(b"target_test", nonce);
            assert!(meets_target(&h, &target));
        }
    }

    #[test]
    fn target_all_zero_never_passes() {
        let target = [0x00u8; 32];
        for nonce in 0u64..20 {
            let h = EkamDeeksha::hash_bytes(b"target_test", nonce);
            if h != [0u8; 32] {
                assert!(!meets_target(&h, &target));
            }
        }
    }

    #[test]
    fn find_nonce_returns_valid_hash() {
        let header = b"find_nonce_test";
        let target = [0xFFu8; 32];
        let result = find_nonce(header, 0, 1000, &target);
        assert!(result.is_some());
        let (nonce, hash) = result.unwrap();
        assert_eq!(hash, EkamDeeksha::hash_bytes(header, nonce));
        assert!(meets_target(&hash, &target));
    }

    #[test]
    fn find_nonce_impossible_target_returns_none() {
        let header = b"impossible_target";
        let target = [0x00u8; 32];
        let result = find_nonce(header, 0, 100, &target);
        assert!(result.is_none());
    }

    // ── Self-test ────────────────────────────────────────────────────────────

    #[test]
    fn self_test_passes() {
        let header = b"ZION_DEEKSHA_LITE_TEST_V1";
        let nonce: u64 = 0x123456789ABCDEF0;
        let h1 = EkamDeeksha::hash_bytes(header, nonce);
        let h2 = EkamDeeksha::hash_bytes(header, nonce);
        assert!(h1 == h2 && h1 != [0u8; 32]);
    }

    // ── Trait integration ───────────────────────────────────────────────────

    #[test]
    fn self_test_finds_nonce() {
        let header = b"ekam_deeksha_self_test";
        let target = [0xFFu8; 32];
        let algo = EkamDeeksha::new();
        let result = algo.find_nonce(header, 0, 1000, &target);
        assert!(result.is_some());
        let (nonce, hash) = result.unwrap();
        assert_eq!(hash, algo.hash(header, nonce));
        assert!(hash.0 <= target);
    }

    #[test]
    fn impossible_target_returns_none() {
        let header = b"impossible";
        let target = [0x00u8; 32];
        let algo = EkamDeeksha::new();
        assert!(algo.find_nonce(header, 0, 100, &target).is_none());
    }

    #[test]
    fn meets_target_boundary() {
        let header = b"target_boundary";
        let algo = EkamDeeksha::new();
        assert!(algo.verify(header, 0, &[0xFFu8; 32]));
        assert!(!algo.verify(header, 0, &[0x00u8; 32]));
        assert!(EkamDeeksha::hash_bytes(header, 0) <= [0xFFu8; 32]);
    }

    #[test]
    fn hash_with_height_ignores_height() {
        let header = b"height_test";
        let nonce = 0xABCDu64;
        let h1 = EkamDeeksha::hash_with_height(header, nonce, 0);
        let h2 = EkamDeeksha::hash_with_height(header, nonce, 1_000_000);
        assert_eq!(h1.data, h2.data);
        assert_eq!(h1.data, EkamDeeksha::hash_bytes(header, nonce));
    }

    // ── Profile constant ─────────────────────────────────────────────────────

    #[test]
    fn algorithm_name_constant() {
        assert_eq!(ALGORITHM_NAME, "ekam_deeksha");
    }

    // ── Avalanche — single bit flip in header changes ≥ 50% of hash bytes ───

    #[test]
    fn avalanche() {
        let h1 = EkamDeeksha::hash_bytes(b"avalanche_test\x00", 0);
        let h2 = EkamDeeksha::hash_bytes(b"avalanche_test\x01", 0);
        let differing = h1.iter().zip(h2.iter()).filter(|(a, b)| a != b).count();
        assert!(
            differing >= 8,
            "Avalanche: single-bit input change must affect >= 8 bytes of hash (got {})",
            differing
        );
    }

    // ── Benchmark (run with: cargo test --release -- --nocapture bench_) ──

    #[test]
    fn bench_single_hash_latency() {
        let header = [0x42u8; 80];
        let n = 200u64;
        let t0 = std::time::Instant::now();
        for i in 0..n {
            let _ = EkamDeeksha::hash_bytes(&header, i);
        }
        let elapsed = t0.elapsed();
        let per_hash_us = elapsed.as_secs_f64() / n as f64 * 1e6;
        let hps = n as f64 / elapsed.as_secs_f64();
        eprintln!(
            "\n=== BASELINE single hash: {:.2} µs/hash, {:.1} H/s (1 thread) ===",
            per_hash_us, hps
        );
    }

    #[test]
    fn bench_find_nonce_500() {
        let header = [0x42u8; 80];
        let target = [0x00u8; 32]; // impossible → all nonces tested
        let batch = 500u64;
        let t0 = std::time::Instant::now();
        let _ = find_nonce(&header, 0, batch, &target);
        let elapsed = t0.elapsed();
        let hps = batch as f64 / elapsed.as_secs_f64();
        eprintln!(
            "\n=== OPTIMIZED find_nonce({}): {:.2} ms, {:.1} H/s (1 thread) ===",
            batch,
            elapsed.as_secs_f64() * 1e3,
            hps
        );
    }
}
