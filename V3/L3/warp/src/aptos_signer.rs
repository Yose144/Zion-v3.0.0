//! # Aptos Signer — Ed25519 key loading + account address derivation
//!
//! Signs Aptos transactions for the WARP bridge relay.
//!
//! ## Key format
//! `WARP_APTOS_RELAY_KEY` must be a hex-encoded 32-byte Ed25519 seed.
//!
//! ## Account address derivation
//! Aptos uses a 32-byte authentication key derived from the public key:
//! ```text
//! auth_key = SHA-256( 0x00 || public_key_32 )
//! account_address = "0x" || hex(auth_key)
//! ```
//! The `0x00` prefix is the `SingleKeySignature` scheme tag for Ed25519.
//!
//! ## Transaction signing
//! Aptos transactions are BCS-encoded (`RawTransaction` → sign →
//! `SignedTransaction`). BCS encoding is complex and not implemented here.
//! The signer exposes `sign()` for arbitrary message signing; the adapter
//! returns a clear error for the BCS TX submission step until a full BCS
//! implementation (or the `aptos-sdk` crate) is available.

use crate::error::{WarpError, WarpResult};
use ed25519_dalek::{Signer, SigningKey};
use sha2::{Digest, Sha256};

/// Ed25519 signature scheme tag used by Aptos for account auth keys.
const APTOS_ED25519_SCHEME_TAG: u8 = 0x00;

/// Derive a 32-byte Aptos account authentication key from an Ed25519 public key.
///
/// `auth_key = SHA-256( scheme_tag || public_key )`
pub fn aptos_auth_key(pubkey: &[u8; 32]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update([APTOS_ED25519_SCHEME_TAG]);
    h.update(pubkey);
    let hash: [u8; 32] = h.finalize().into();
    hash
}

/// Derive a canonical Aptos account address string from an Ed25519 public key.
///
/// Returns a lowercase hex string prefixed with `0x` (64 hex chars after prefix).
pub fn aptos_address_from_pubkey(pubkey: &[u8; 32]) -> String {
    let auth = aptos_auth_key(pubkey);
    format!("0x{}", hex::encode(auth))
}

/// Aptos Ed25519 signing key loaded from the `WARP_APTOS_RELAY_KEY` env var.
pub struct AptosSigner {
    pub signing_key: SigningKey,
    pub address: String,
}

impl AptosSigner {
    /// Load the relay key from `WARP_APTOS_RELAY_KEY` (hex, 32 bytes).
    pub fn from_env() -> WarpResult<Self> {
        let key_hex = std::env::var("WARP_APTOS_RELAY_KEY").map_err(|_| WarpError::AdapterError {
            chain: "aptos".into(),
            reason: "WARP_APTOS_RELAY_KEY env var not set".into(),
        })?;
        let key_bytes = hex::decode(&key_hex).map_err(|e| WarpError::AdapterError {
            chain: "aptos".into(),
            reason: format!("invalid hex key: {}", e),
        })?;
        if key_bytes.len() != 32 {
            return Err(WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("key must be 32 bytes, got {}", key_bytes.len()),
            });
        }
        let mut seed = [0u8; 32];
        seed.copy_from_slice(&key_bytes);
        Self::from_seed(&seed)
    }

    /// Create a signer from a 32-byte seed (for testing).
    pub fn from_seed(seed: &[u8; 32]) -> WarpResult<Self> {
        let signing_key = SigningKey::from_bytes(seed);
        let verifying = signing_key.verifying_key();
        let address = aptos_address_from_pubkey(&verifying.to_bytes());
        Ok(Self {
            signing_key,
            address,
        })
    }

    /// Return the 32-byte Ed25519 public key.
    pub fn public_key(&self) -> [u8; 32] {
        self.signing_key.verifying_key().to_bytes()
    }

    /// Return the 32-byte authentication key.
    pub fn auth_key(&self) -> [u8; 32] {
        aptos_auth_key(&self.public_key())
    }

    /// Sign an arbitrary message and return the 64-byte Ed25519 signature.
    pub fn sign(&self, message: &[u8]) -> [u8; 64] {
        self.signing_key.sign(message).to_bytes()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_key_is_sha256_of_scheme_tag_and_pubkey() {
        let pubkey = [0xabu8; 32];
        let auth = aptos_auth_key(&pubkey);
        // Recompute manually to verify the scheme tag prefix.
        let mut h = Sha256::new();
        h.update([0x00u8]);
        h.update(pubkey);
        let expected: [u8; 32] = h.finalize().into();
        assert_eq!(auth, expected);
    }

    #[test]
    fn test_address_starts_with_0x_and_is_64_hex_chars() {
        let pubkey = [0x11u8; 32];
        let addr = aptos_address_from_pubkey(&pubkey);
        assert!(addr.starts_with("0x"));
        assert_eq!(addr.len(), 2 + 64); // 0x + 64 hex chars
        // lowercase hex
        assert_eq!(addr, addr.to_lowercase());
    }

    #[test]
    fn test_address_deterministic_for_same_pubkey() {
        let pubkey = [0x42u8; 32];
        let a1 = aptos_address_from_pubkey(&pubkey);
        let a2 = aptos_address_from_pubkey(&pubkey);
        assert_eq!(a1, a2);
    }

    #[test]
    fn test_address_differs_for_different_pubkeys() {
        let a1 = aptos_address_from_pubkey(&[0x01u8; 32]);
        let a2 = aptos_address_from_pubkey(&[0x02u8; 32]);
        assert_ne!(a1, a2);
    }

    #[test]
    fn test_signer_from_seed_derives_address() {
        let seed = [0xaau8; 32];
        let signer = AptosSigner::from_seed(&seed).unwrap();
        assert!(signer.address.starts_with("0x"));
        assert_eq!(signer.address.len(), 66);
        // auth key should match the address body (after 0x)
        let auth_hex = hex::encode(signer.auth_key());
        assert!(signer.address.ends_with(&auth_hex));
    }

    #[test]
    fn test_signer_from_env_missing_key_err() {
        std::env::remove_var("WARP_APTOS_RELAY_KEY");
        assert!(AptosSigner::from_env().is_err());
    }

    #[test]
    fn test_signer_from_env_invalid_hex_err() {
        std::env::set_var("WARP_APTOS_RELAY_KEY", "not-hex!");
        assert!(AptosSigner::from_env().is_err());
        std::env::remove_var("WARP_APTOS_RELAY_KEY");
    }

    #[test]
    fn test_signer_from_env_wrong_length_err() {
        // 16 bytes instead of 32
        std::env::set_var("WARP_APTOS_RELAY_KEY", hex::encode(&[0u8; 16]));
        assert!(AptosSigner::from_env().is_err());
        std::env::remove_var("WARP_APTOS_RELAY_KEY");
    }

    #[test]
    fn test_sign_deterministic() {
        let seed = [0xbbu8; 32];
        let s1 = AptosSigner::from_seed(&seed).unwrap();
        let s2 = AptosSigner::from_seed(&seed).unwrap();
        let msg = b"aptos warp message";
        let sig1 = s1.sign(msg);
        let sig2 = s2.sign(msg);
        assert_eq!(sig1, sig2);
        assert_eq!(sig1.len(), 64);
    }

    #[test]
    fn test_public_key_is_32_bytes() {
        let signer = AptosSigner::from_seed(&[0x05u8; 32]).unwrap();
        assert_eq!(signer.public_key().len(), 32);
    }
}
