//! Shared ZION primitives used by L1, L2, and CLI in the V31 workspace.
//!
//! This crate is intentionally minimal: it defines identity, value, and chain
//! abstractions. Concrete signing, RPC, and validation logic lives in the
//! consuming crates (e.g. `zion-multichain`).

pub mod address;
pub mod amount;
pub mod asset;
pub mod chain;
pub mod error;
pub mod hash;

pub use address::Address;
pub use amount::Amount;
pub use asset::{Asset, AssetId};
pub use chain::{ChainFamily, ChainId};
pub use error::{L1Error, L1Result};
pub use hash::Hash;

use ripemd::Ripemd160;
use sha2::{Digest, Sha256};

const ZION_BASE32_ALPHABET: &[u8; 32] = b"023456789acdefghjklmnpqrstuvwxyz";

fn compute_address_checksum(body_35: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"zion1");
    hasher.update(body_35.as_bytes());
    let hash = hasher.finalize();
    let mut checksum = String::with_capacity(4);
    for &byte in &hash[..2] {
        checksum.push(ZION_BASE32_ALPHABET[(byte % 32) as usize] as char);
        checksum.push(ZION_BASE32_ALPHABET[((byte / 32) % 32) as usize] as char);
    }
    checksum
}

/// Derive a `zion1…` address from a 32-byte Ed25519 public key.
pub fn zion_address_from_public_key(public_key_bytes: &[u8]) -> Option<String> {
    if public_key_bytes.len() != 32 {
        return None;
    }

    let sha = Sha256::digest(public_key_bytes);
    let key_hash = Ripemd160::digest(sha);

    let mut data = String::with_capacity(40);
    for &byte in key_hash.iter() {
        data.push(ZION_BASE32_ALPHABET[(byte % 32) as usize] as char);
        data.push(ZION_BASE32_ALPHABET[((byte / 32) % 32) as usize] as char);
    }
    data.truncate(35);

    let checksum = compute_address_checksum(&data);
    Some(format!("zion1{data}{checksum}"))
}

/// Encode bytes as a lowercase hex string.
pub fn bytes_to_hex(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

/// Normalise an RPC URL to `host:port` form by stripping scheme and trailing path.
pub fn normalize_rpc_addr(value: &str) -> String {
    let trimmed = value.trim().trim_end_matches('/');
    let trimmed = trimmed.strip_suffix("/jsonrpc").unwrap_or(trimmed);
    trimmed
        .strip_prefix("tcp://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .or_else(|| trimmed.strip_prefix("https://"))
        .unwrap_or(trimmed)
        .to_string()
}
