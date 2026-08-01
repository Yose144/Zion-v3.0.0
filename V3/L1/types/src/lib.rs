//! Shared L1 types and helpers used by L2 watchers (bridge, DAO, atomic-swap).
//!
//! This crate eliminates duplicated copies of address-encoding, hex, and RPC
//! normalisation utilities that were previously copy-pasted into each watcher.

use ripemd::Ripemd160;
use sha2::{Digest, Sha256};

// ─── ZION address encoding ─────────────────────────────────────────────────

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
///
/// Algorithm: SHA-256(pubkey) → RIPEMD-160 → base32-encode (35 chars) →
/// 4-char checksum → `zion1` + body + checksum.
pub fn zion_address_from_public_key(public_key_bytes: &[u8]) -> Option<String> {
    if public_key_bytes.len() != 32 {
        return None;
    }

    let sha = Sha256::digest(public_key_bytes);
    let key_hash = Ripemd160::digest(sha);

    let mut data = String::with_capacity(40);
    for &byte in key_hash.as_slice() {
        data.push(ZION_BASE32_ALPHABET[(byte % 32) as usize] as char);
        data.push(ZION_BASE32_ALPHABET[((byte / 32) % 32) as usize] as char);
    }
    data.truncate(35);

    let checksum = compute_address_checksum(&data);
    Some(format!("zion1{data}{checksum}"))
}

// ─── Hex helpers ───────────────────────────────────────────────────────────

/// Encode bytes as a lowercase hex string.
pub fn bytes_to_hex(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

// ─── RPC address normalisation ─────────────────────────────────────────────

/// Normalise an RPC URL to `host:port` form by stripping scheme and trailing
/// `/jsonrpc` or `/`.
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

// ─── L1 block representation ───────────────────────────────────────────────

/// Minimal L1 block info needed by L2 watchers to scan for relevant
/// transactions.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct L1Block {
    pub height: u64,
    pub hash_hex: String,
    pub timestamp: u64,
    pub transaction_ids: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bytes_to_hex() {
        assert_eq!(bytes_to_hex(&[0x00, 0xff]), "00ff");
        assert_eq!(bytes_to_hex(&[]), "");
    }

    #[test]
    fn test_normalize_rpc_addr() {
        assert_eq!(
            normalize_rpc_addr("http://127.0.0.1:8443/jsonrpc"),
            "127.0.0.1:8443"
        );
        assert_eq!(
            normalize_rpc_addr("https://edge.zion:8443/"),
            "edge.zion:8443"
        );
        assert_eq!(normalize_rpc_addr("tcp://1.2.3.4:9999"), "1.2.3.4:9999");
        assert_eq!(
            normalize_rpc_addr("  127.0.0.1:8443/jsonrpc/  "),
            "127.0.0.1:8443"
        );
    }

    #[test]
    fn test_zion_address_from_public_key() {
        // 32-byte zero key → deterministic address
        let pk = [0u8; 32];
        let addr = zion_address_from_public_key(&pk);
        assert!(addr.is_some());
        assert!(addr.unwrap().starts_with("zion1"));
    }

    #[test]
    fn test_zion_address_rejects_wrong_length() {
        assert!(zion_address_from_public_key(&[0u8; 31]).is_none());
        assert!(zion_address_from_public_key(&[0u8; 33]).is_none());
        assert!(zion_address_from_public_key(&[]).is_none());
    }
}
