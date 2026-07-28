//! Pure-Rust AuxPoW hashing stubs.
//!
//! These are *scaffold* implementations that return deterministic 32-byte
//! hashes for the AuxPoW runtime. Native algorithm acceleration is handled by
//! the `native-hashers` feature (see `native.rs`); when that feature is off,
//! `hasher.rs` falls back to the functions in this module.

use blake3;
use sha3::{Digest, Keccak256, Sha3_256};
use zion_cosmic_harmony::ExternalCoin;

/// Hash `header || nonce_le` with the algorithm used by `coin`.
pub fn hash_for_coin(coin: ExternalCoin, header: &[u8], nonce: u64) -> [u8; 32] {
    let mut input = Vec::with_capacity(header.len().saturating_add(8));
    input.extend_from_slice(header);
    input.extend_from_slice(&nonce.to_le_bytes());

    match coin.algorithm() {
        // Blake3 family
        "blake3_alph" | "blake3_dcr" => blake3::hash(&input).into(),
        // SHA-256d family (Bitcoin-style)
        "sha256d" => {
            let first = Sha3_256::digest(&input);
            let second = Sha3_256::digest(first);
            second.into()
        }
        // Keccak / Ethash placeholders
        "etchash" | "ethash" | "kawpow" | "meowpow" | "progpow" | "progpowz" => {
            Keccak256::digest(&input).into()
        }
        // Everything else falls back to a generic Blake3 hash.
        _ => blake3::hash(&input).into(),
    }
}
