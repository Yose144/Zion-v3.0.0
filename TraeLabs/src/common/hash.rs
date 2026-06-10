//! Hash utilities

use blake3::Hasher;
use sha3::{Keccak256, Digest};

/// Hash a byte slice with BLAKE3
pub fn blake3_hash(data: &[u8]) -> [u8; 32] {
    let mut hasher = Hasher::new();
    hasher.update(data);
    hasher.finalize().into()
}

/// Hash a byte slice with Keccak256
pub fn keccak256_hash(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(data);
    hasher.finalize().into()
}

/// Check if a hash meets a target (hash <= target)
pub fn meets_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash <= target
}
