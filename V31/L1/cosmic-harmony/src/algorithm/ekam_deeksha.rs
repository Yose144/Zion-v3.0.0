//! Ekam Deeksha — canonical ZION PoW algorithm (V31 Mainnet Alpha).
//!
//! This is the single, unified replacement for the previous three profile
//! names (`deeksha_lite_v1`, `deeksha_chv3`, `deeksha_lite_fire`). The pipeline
//! is intentionally explicit and self-contained so that a CPU reference,
//! a GPU kernel, and an ASIC/FPGA implementation can all be reasoned about
//! from the same Rust source.
//!
//! Pipeline:
//!   1. `seed = Keccak256(header[0..80] || nonce_le[0..8])` (32 B)
//!   2. Memory-hard scratchpad (256 KiB):
//!        - fill with SHA3-512 chained blocks,
//!        - 2 XOR passes (forward, backward),
//!        - 64 random reads driven by an 8-byte rolling accumulator.
//!   3. AES-128 CTR mix (key = seed[0..16], counter = nonce_le || seed[16..24])
//!        - encrypt counter → block0, counter+1 → block1,
//!        - XOR the two 16-byte blocks with seed[0..32].
//!   4. `final = Keccak256(mixed)` (32 B)

use aes::cipher::{Array, BlockCipherEncrypt, KeyInit};
use aes::Aes128;
use sha3::{Digest, Keccak256, Sha3_512};

use zion_l1_types::Hash;

use super::PowAlgorithm;

pub const ALGORITHM_NAME: &str = "ekam_deeksha";

pub const SCRATCHPAD_SIZE: usize = 256 * 1024; // 256 KiB
pub const BLOCK_SIZE: usize = 32;
pub const BLOCK_COUNT: usize = SCRATCHPAD_SIZE / BLOCK_SIZE; // 8192
pub const PASSES: usize = 2;
pub const RANDOM_READS: usize = 64;

/// Canonical Ekam Deeksha hasher.
#[derive(Clone, Copy, Debug, Default)]
pub struct EkamDeeksha;

impl EkamDeeksha {
    pub fn new() -> Self {
        Self
    }

    /// Compute the raw hash bytes without the `PowAlgorithm` trait wrapper.
    pub fn hash_bytes(header: &[u8], nonce: u64) -> [u8; 32] {
        let seed = step1_keccak(header, nonce);
        let acc = step2_memory_hard(&seed);
        let mixed = step3_aes_mix(&acc, nonce);
        step4_keccak_final(&mixed)
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
        Self::hash_bytes(header, nonce) <= *target
    }

    fn find_nonce(
        &self,
        header: &[u8],
        start: u64,
        limit: u64,
        target: &[u8; 32],
    ) -> Option<(u64, Hash)> {
        for offset in 0..limit {
            let nonce = start.saturating_add(offset);
            let hash = Self::hash_bytes(header, nonce);
            if hash <= *target {
                return Some((nonce, Hash::new(hash)));
            }
        }
        None
    }
}

// ========================================================================
// Pipeline steps
// ========================================================================

fn step1_keccak(header: &[u8], nonce: u64) -> [u8; 32] {
    let mut input = [0u8; 88];
    let hlen = header.len().min(80);
    input[..hlen].copy_from_slice(&header[..hlen]);
    input[80..88].copy_from_slice(&nonce.to_le_bytes());
    Keccak256::digest(input).into()
}

fn step2_memory_hard(seed: &[u8; 32]) -> [u8; 32] {
    let mut scratchpad = vec![0u8; SCRATCHPAD_SIZE];

    // Phase A: SHA3-512 chain fill.
    let mut state = [0u8; 64];
    state[..32].copy_from_slice(seed);

    for blk in 0..BLOCK_COUNT {
        let mut inp = [0u8; 65];
        inp[..64].copy_from_slice(&state);
        inp[64] = (blk & 0xFF) as u8;
        let out = Sha3_512::digest(inp);
        let off = blk * BLOCK_SIZE;
        scratchpad[off..off + 32].copy_from_slice(&out[..32]);
        state[..32].copy_from_slice(&out[..32]);
    }

    // Phase B: forward and backward XOR passes.
    for pass in 0..PASSES {
        if pass % 2 == 0 {
            for i in 0..BLOCK_COUNT {
                let prev = if i == 0 { BLOCK_COUNT - 1 } else { i - 1 };
                let (cur, prv) = (i * BLOCK_SIZE, prev * BLOCK_SIZE);
                for j in 0..BLOCK_SIZE {
                    scratchpad[cur + j] ^= scratchpad[prv + j];
                }
            }
        } else {
            for i in (0..BLOCK_COUNT).rev() {
                let next = if i + 1 == BLOCK_COUNT { 0 } else { i + 1 };
                let (cur, nxt) = (i * BLOCK_SIZE, next * BLOCK_SIZE);
                for j in 0..BLOCK_SIZE {
                    scratchpad[cur + j] ^= scratchpad[nxt + j];
                }
            }
        }
    }

    // Phase C: random reads driven by a rolling 8-byte accumulator.
    let mut acc = [0u8; 32];
    acc.copy_from_slice(seed);
    let mut pos: u64 = 0;

    for r in 0..RANDOM_READS as u64 {
        let off = (pos as usize) * BLOCK_SIZE;
        for i in 0..32 {
            acc[i] ^= scratchpad[off + i];
        }
        let idx_val = u64::from_le_bytes(acc[..8].try_into().expect("8 bytes"));
        pos = (idx_val ^ pos ^ r) % (BLOCK_COUNT as u64);
    }

    acc
}

fn step3_aes_mix(seed: &[u8; 32], nonce: u64) -> [u8; 32] {
    let key_array = <&[u8; 16]>::try_from(&seed[..16]).expect("16 bytes");
    let key = Array::from(*key_array);
    let cipher = Aes128::new(&key);

    let mut counter0 = [0u8; 16];
    counter0[..8].copy_from_slice(&nonce.to_le_bytes());
    counter0[8..16].copy_from_slice(&seed[16..24]);
    let counter1 = increment_counter(&counter0);

    let mut block0 = Array::from(counter0);
    let mut block1 = Array::from(counter1);
    cipher.encrypt_block(&mut block0);
    cipher.encrypt_block(&mut block1);

    let mut out = [0u8; 32];
    out[..16].copy_from_slice(block0.as_slice());
    out[16..].copy_from_slice(block1.as_slice());

    for i in 0..32 {
        out[i] ^= seed[i];
    }
    out
}

fn step4_keccak_final(s3: &[u8; 32]) -> [u8; 32] {
    Keccak256::digest(s3).into()
}

fn increment_counter(counter: &[u8; 16]) -> [u8; 16] {
    let mut out = *counter;
    let mut carry: u16 = 1;
    for byte in out.iter_mut() {
        let sum = (*byte as u16) + carry;
        *byte = (sum & 0xFF) as u8;
        carry = sum >> 8;
        if carry == 0 {
            break;
        }
    }
    out
}

// ========================================================================
// Tests
// ========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic() {
        let header = b"ekam_deeksha_determinism";
        let h1 = EkamDeeksha::hash_bytes(header, 0);
        let h2 = EkamDeeksha::hash_bytes(header, 0);
        assert_eq!(h1, h2);
    }

    #[test]
    fn avalanche() {
        let header = b"avalanche_test\x00";
        let header2 = b"avalanche_test\x01";
        let h1 = EkamDeeksha::hash_bytes(header, 0);
        let h2 = EkamDeeksha::hash_bytes(header2, 0);
        let differing = h1.iter().zip(h2.iter()).filter(|(a, b)| a != b).count();
        assert!(
            differing >= 8,
            "single-bit header change changed only {differing} bytes"
        );
    }

    #[test]
    fn self_test_finds_nonce() {
        let header = b"ekam_deeksha_self_test";
        let target = [0xFFu8; 32];
        let algo = EkamDeeksha::new();
        let result = algo.find_nonce(header, 0, 1000, &target);
        assert!(result.is_some(), "easy target must produce a nonce");
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
}
