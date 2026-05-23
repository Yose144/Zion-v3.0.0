//! VerusHash 2.2 wrapper — native C/C++ implementation via FFI.
//!
//! Supports both x86_64 (SSE4 + AES-NI) and aarch64 (ARM NEON + crypto).
//! When built without feature "verushash", falls back to blake3 (dev/test only).

use anyhow::Result;

/// Compute VerusHash v2.2 of input bytes.
#[cfg(feature = "verushash")]
#[inline]
pub fn verushash_v2_2(data: &[u8]) -> [u8; 32] {
    verushash_native::verus_hash_v2_2(data)
}

/// Dev/test fallback: blake3 hash (NOT real VerusHash — NEVER use in production)
#[cfg(not(feature = "verushash"))]
#[inline]
pub fn verushash_v2_2(data: &[u8]) -> [u8; 32] {
    *blake3::hash(data).as_bytes()
}

/// Convenience helper used by miner loop:
/// input = header || nonce_le
#[inline]
pub fn verushash_v2_2_with_nonce(header: &[u8], nonce: u64) -> [u8; 32] {
    let mut input = Vec::with_capacity(header.len() + 8);
    input.extend_from_slice(header);
    input.extend_from_slice(&nonce.to_le_bytes());
    verushash_v2_2(&input)
}

/// Keep API shape aligned with other modules.
#[inline]
pub fn hash(data: &[u8], nonce: u64) -> Result<[u8; 32]> {
    Ok(verushash_v2_2_with_nonce(data, nonce))
}
