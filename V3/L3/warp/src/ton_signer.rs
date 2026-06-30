//! # TON Signer — Ed25519 key loading
//!
//! Loads the WARP relay Ed25519 signing key for the TON adapter.
//!
//! ## Key format
//! `WARP_TON_RELAY_KEY` must be a hex-encoded 32-byte Ed25519 seed.
//!
//! ## TON transaction construction
//! TON uses the TL-B (Type Language - Binary) encoding over the ADNL
//! protocol for transaction submission. Full TX construction requires
//! `ton-sdk`, `tonweb`, or `tonlib` — none of which are in the current
//! dependency set. The signer therefore only loads the key and derives
//! the public key / raw address hash. Actual TX submission is handled
//! by the adapter's `execute_mint`, which returns a clear error
//! directing the operator to install a TON SDK.

use crate::error::{WarpError, WarpResult};
use ed25519_dalek::{SigningKey, VerifyingKey};
use sha2::{Digest, Sha256};

/// TON workchain for the default relay wallet (masterchain = -1, base = 0).
const DEFAULT_WORKCHAIN: i32 = 0;

/// A loaded TON relay signing key.
pub struct TonSigner {
    pub signing_key: SigningKey,
    pub verifying_key: VerifyingKey,
    pub workchain: i32,
}

impl TonSigner {
    /// Load the relay key from `WARP_TON_RELAY_KEY` env var (hex, 32 bytes).
    pub fn from_env() -> WarpResult<Self> {
        let key_hex = std::env::var("WARP_TON_RELAY_KEY").map_err(|_| WarpError::AdapterError {
            chain: "ton".into(),
            reason: "WARP_TON_RELAY_KEY env var not set".into(),
        })?;
        let workchain = std::env::var("WARP_TON_WORKCHAIN")
            .ok()
            .and_then(|s| s.parse::<i32>().ok())
            .unwrap_or(DEFAULT_WORKCHAIN);
        Self::from_hex(&key_hex, workchain)
    }

    /// Create from a hex-encoded 32-byte Ed25519 seed.
    pub fn from_hex(hex_str: &str, workchain: i32) -> WarpResult<Self> {
        let bytes = hex::decode(hex_str).map_err(|e| WarpError::AdapterError {
            chain: "ton".into(),
            reason: format!("WARP_TON_RELAY_KEY hex decode failed: {}", e),
        })?;
        if bytes.len() != 32 {
            return Err(WarpError::AdapterError {
                chain: "ton".into(),
                reason: format!(
                    "Ed25519 seed must be 32 bytes, got {}",
                    bytes.len()
                ),
            });
        }
        let mut seed = [0u8; 32];
        seed.copy_from_slice(&bytes);
        Self::from_raw(seed, workchain)
    }

    /// Create directly from a raw 32-byte Ed25519 seed (test/internal use).
    pub fn from_raw(seed: [u8; 32], workchain: i32) -> WarpResult<Self> {
        let signing_key = SigningKey::from_bytes(&seed);
        let verifying_key = signing_key.verifying_key();
        Ok(Self {
            signing_key,
            verifying_key,
            workchain,
        })
    }

    /// The 32-byte Ed25519 public key of the relay wallet.
    pub fn public_key_bytes(&self) -> [u8; 32] {
        self.verifying_key.to_bytes()
    }

    /// Hex-encoded public key (64 chars).
    pub fn public_key_hex(&self) -> String {
        hex::encode(self.public_key_bytes())
    }

    /// Raw 32-byte "account state hash" used inside a TON address.
    ///
    /// TON addresses wrap an `AccountState` (which for a wallet contains the
    /// public key) inside a cell whose hash becomes the 256-bit address body.
    /// A faithful reproduction requires full TL-B cell serialization; here we
    /// return the SHA-256 of the public key as a stable, deterministic
    /// placeholder for logging/diagnostics. The real on-chain address must be
    /// derived with a TON SDK.
    pub fn raw_address_hash(&self) -> [u8; 32] {
        let pk = self.public_key_bytes();
        Sha256::digest(&pk).into()
    }

    /// Workchain id for this wallet.
    pub fn workchain(&self) -> i32 {
        self.workchain
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn test_signer() -> TonSigner {
        TonSigner::from_raw([7u8; 32], 0).unwrap()
    }

    #[test]
    fn test_signer_public_key_length() {
        let s = test_signer();
        assert_eq!(s.public_key_bytes().len(), 32);
    }

    #[test]
    fn test_signer_public_key_hex_is_64_chars() {
        let s = test_signer();
        let pk = s.public_key_hex();
        assert_eq!(pk.len(), 64);
        assert!(pk.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_signer_from_hex_roundtrip() {
        let seed = [9u8; 32];
        let hex_str = hex::encode(seed);
        let s = TonSigner::from_hex(&hex_str, 0).unwrap();
        let expected_pk = SigningKey::from_bytes(&seed).verifying_key().to_bytes();
        assert_eq!(s.public_key_bytes(), expected_pk);
    }

    #[test]
    fn test_signer_from_hex_invalid_chars() {
        assert!(TonSigner::from_hex("not-hex!!", 0).is_err());
    }

    #[test]
    fn test_signer_from_hex_wrong_length() {
        // 16 bytes instead of 32
        let short = hex::encode([1u8; 16]);
        assert!(TonSigner::from_hex(&short, 0).is_err());
    }

    #[test]
    fn test_signer_raw_address_hash_is_32_bytes() {
        let s = test_signer();
        let h = s.raw_address_hash();
        assert_eq!(h.len(), 32);
    }

    #[test]
    fn test_signer_workchain_default() {
        let s = test_signer();
        assert_eq!(s.workchain(), 0);
    }

    #[test]
    fn test_signer_workchain_masterchain() {
        let s = TonSigner::from_raw([3u8; 32], -1).unwrap();
        assert_eq!(s.workchain(), -1);
    }

    #[test]
    fn test_signer_deterministic_pubkey() {
        let s1 = TonSigner::from_raw([7u8; 32], 0).unwrap();
        let s2 = TonSigner::from_raw([7u8; 32], 0).unwrap();
        assert_eq!(s1.public_key_bytes(), s2.public_key_bytes());
    }
}
