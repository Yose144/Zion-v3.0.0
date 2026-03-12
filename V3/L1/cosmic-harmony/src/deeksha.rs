use std::sync::OnceLock;

use crate::algorithms_npu::{DeekshaCircuitBreaker, NpuBackend};
use crate::algorithms_opt::{
    cosmic_fusion_opt_rounds, golden_matrix_opt, keccak256_opt, sha3_512_opt, Hash32, Hash64,
};
use crate::scratchpad_ekam::memory_hard_transform_ekam_light;

pub const CHV_EKAM_FORK_HEIGHT: u64 = 0;
pub const EKAM_FUSION_ROUNDS: usize = 8;
pub const EKAM_CANONICAL_TEST_VECTOR_HEX: &str =
    "6339f2fb178fe2957a10d9e2a84cf9d5e340064f0d165e845b6a54eaf7924fbd";

static EKAM_NPU: OnceLock<DeekshaCircuitBreaker> = OnceLock::new();

pub fn init_npu() {
    EKAM_NPU.get_or_init(DeekshaCircuitBreaker::build_best_available);
}

#[inline]
fn npu() -> &'static DeekshaCircuitBreaker {
    EKAM_NPU.get_or_init(DeekshaCircuitBreaker::build_best_available)
}

#[inline]
pub fn cosmic_harmony_ekam_deeksha(block_header: &[u8], nonce: u64) -> Hash32 {
    let mut input = [0u8; 88];
    let len = block_header.len().min(80);
    input[..len].copy_from_slice(&block_header[..len]);
    input[80..88].copy_from_slice(&nonce.to_le_bytes());

    let s1 = keccak256_opt(&input);
    let s2 = sha3_512_opt(&s1.data);
    let s3 = golden_matrix_opt(&s2.data);
    let s4 = memory_hard_transform_ekam_light(&s3.data);
    let s5 = npu().mix(&s4.data);
    cosmic_fusion_opt_rounds(&s5, EKAM_FUSION_ROUNDS)
}

pub fn ekam_find_nonce(
    header: &[u8],
    start_nonce: u64,
    count: u64,
    target: &[u8; 32],
) -> Option<(u64, Hash32)> {
    for offset in 0..count {
        let nonce = start_nonce.wrapping_add(offset);
        let hash = cosmic_harmony_ekam_deeksha(header, nonce);
        if meets_target(&hash.data, target) {
            return Some((nonce, hash));
        }
    }
    None
}

#[inline(always)]
fn meets_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash <= target
}

pub fn ekam_self_test() -> bool {
    const TEST_HEADER: &[u8] = b"ZION_DEEKSHA_GENESIS_V298_CANONICAL";
    const TEST_NONCE: u64 = 0x2980_0001_0000_0001;

    let left = cosmic_harmony_ekam_deeksha(TEST_HEADER, TEST_NONCE);
    let right = cosmic_harmony_ekam_deeksha(TEST_HEADER, TEST_NONCE);
    if left != right {
        return false;
    }

    let hex: String = left.data.iter().map(|byte| format!("{:02x}", byte)).collect();
    hex == EKAM_CANONICAL_TEST_VECTOR_HEX
}

pub fn generate_ekam_test_vector() -> String {
    const TEST_HEADER: &[u8] = b"ZION_DEEKSHA_GENESIS_V298_CANONICAL";
    const TEST_NONCE: u64 = 0x2980_0001_0000_0001;
    let hash = cosmic_harmony_ekam_deeksha(TEST_HEADER, TEST_NONCE);
    hash.data.iter().map(|byte| format!("{:02x}", byte)).collect()
}

pub fn hash_bytes_with_npu(input: &[u8; 64]) -> Hash64 {
    let mut hash = Hash64::new();
    hash.data.copy_from_slice(&npu().mix(input));
    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ekam_hash_is_deterministic() {
        let header = b"V3_EKAM_TEST_HEADER";
        let nonce = 42;
        assert_eq!(
            cosmic_harmony_ekam_deeksha(header, nonce),
            cosmic_harmony_ekam_deeksha(header, nonce)
        );
    }

    #[test]
    fn ekam_vector_matches() {
        let vector = generate_ekam_test_vector();
        assert_eq!(vector, EKAM_CANONICAL_TEST_VECTOR_HEX, "generated Ekam vector changed");
    }
}
