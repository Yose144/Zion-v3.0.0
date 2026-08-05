//! # Sui Signer — Ed25519 key loading, address derivation, signature format
//!
//! Sui uses Ed25519 for signing. The on-chain signature scheme is:
//!   `flag (0x00) || signature (64 bytes) || public_key (32 bytes)` = 97 bytes,
//! base64-encoded.
//!
//! Sui address = `SHA-256(0x00 || public_key_32_bytes)` — first 32 bytes,
//! rendered as hex with a `0x` prefix.
//!
//! ## Key format
//! `WARP_SUI_RELAY_KEY` must be a hex-encoded 32-byte Ed25519 seed.
//!
//! ## Note
//! Building a Sui transaction requires BCS-encoding the `TransactionData` kind,
//! which is not implemented here. The signer provides key loading, address
//! derivation, and the signature envelope so that `execute_mint` can fail with
//! a clear error pointing at the missing BCS step rather than silently no-op'ing.

use crate::error::{WarpError, WarpResult};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signer, SigningKey};
use sha2::{Digest, Sha256};

/// Flag byte identifying an Ed25519 signature in Sui's `GenericSignature` enum.
pub const ED25519_FLAG: u8 = 0x00;

/// A Sui Ed25519 signing key.
pub struct SuiSigner {
    key: SigningKey,
}

impl SuiSigner {
    /// Load the relay key from the `WARP_SUI_RELAY_KEY` env var (hex, 32 bytes).
    pub fn from_env() -> WarpResult<Self> {
        let key_hex = std::env::var("WARP_SUI_RELAY_KEY").map_err(|_| WarpError::AdapterError {
            chain: "sui".into(),
            reason: "WARP_SUI_RELAY_KEY env var not set".into(),
        })?;
        Self::from_hex(&key_hex)
    }

    /// Parse a `SuiSigner` from a hex-encoded 32-byte seed.
    pub fn from_hex(key_hex: &str) -> WarpResult<Self> {
        let key_bytes = hex::decode(key_hex).map_err(|e| WarpError::AdapterError {
            chain: "sui".into(),
            reason: format!("invalid hex key: {}", e),
        })?;
        if key_bytes.len() != 32 {
            return Err(WarpError::AdapterError {
                chain: "sui".into(),
                reason: format!("key must be 32 bytes, got {}", key_bytes.len()),
            });
        }
        let mut seed = [0u8; 32];
        seed.copy_from_slice(&key_bytes);
        Ok(Self {
            key: SigningKey::from_bytes(&seed),
        })
    }

    /// Construct a signer from a raw 32-byte seed (testing helper).
    pub fn from_seed(seed: [u8; 32]) -> Self {
        Self {
            key: SigningKey::from_bytes(&seed),
        }
    }

    /// The Ed25519 public key (32 bytes).
    pub fn pubkey(&self) -> [u8; 32] {
        self.key.verifying_key().to_bytes()
    }

    /// Sign an arbitrary message and return the raw 64-byte signature.
    pub fn sign(&self, message: &[u8]) -> [u8; 64] {
        self.key.sign(message).to_bytes()
    }

    /// Derive the canonical Sui address for this key.
    ///
    /// `address = SHA-256(0x00 || public_key)[..32]`, hex-encoded with `0x` prefix.
    pub fn address(&self) -> String {
        sui_address_from_pubkey(&self.pubkey())
    }

    /// Build the Sui `GenericSignature` envelope for a signed message:
    /// `flag (0x00) || signature (64) || public_key (32)` = 97 bytes, base64.
    pub fn signature_b64(&self, message: &[u8]) -> String {
        let sig = self.sign(message);
        sui_signature_b64(&sig, &self.pubkey())
    }
}

/// Derive a Sui address from a 32-byte Ed25519 public key.
///
/// `address = SHA-256(0x00 || public_key)[..32]` rendered as `0x`-prefixed hex.
pub fn sui_address_from_pubkey(pubkey: &[u8; 32]) -> String {
    let mut hasher = Sha256::new();
    hasher.update([ED25519_FLAG]);
    hasher.update(pubkey);
    let hash: [u8; 32] = hasher.finalize().into();
    format!("0x{}", hex::encode(hash))
}

/// Build the base64-encoded Sui signature envelope from a raw signature + pubkey.
///
/// Layout: `flag (0x00) || signature (64 bytes) || public_key (32 bytes)` = 97 bytes.
pub fn sui_signature_b64(signature: &[u8; 64], pubkey: &[u8; 32]) -> String {
    let mut buf = Vec::with_capacity(97);
    buf.push(ED25519_FLAG);
    buf.extend_from_slice(signature);
    buf.extend_from_slice(pubkey);
    B64.encode(&buf)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_seed_pubkey_len() {
        let s = SuiSigner::from_seed([1u8; 32]);
        assert_eq!(s.pubkey().len(), 32);
    }

    #[test]
    fn test_from_hex_valid() {
        let hex_str = hex::encode([7u8; 32]);
        let s = SuiSigner::from_hex(&hex_str).unwrap();
        assert_eq!(s.pubkey().len(), 32);
    }

    #[test]
    fn test_from_hex_invalid_length() {
        assert!(SuiSigner::from_hex("deadbeef").is_err());
    }

    #[test]
    fn test_from_hex_invalid_chars() {
        assert!(SuiSigner::from_hex("zz").is_err());
    }

    #[test]
    fn test_from_env_missing() {
        std::env::remove_var("WARP_SUI_RELAY_KEY");
        assert!(SuiSigner::from_env().is_err());
    }

    #[test]
    fn test_address_starts_with_0x() {
        let s = SuiSigner::from_seed([2u8; 32]);
        let addr = s.address();
        assert!(addr.starts_with("0x"));
        // 0x + 64 hex chars = 66
        assert_eq!(addr.len(), 66);
    }

    #[test]
    fn test_address_deterministic() {
        let s1 = SuiSigner::from_seed([3u8; 32]);
        let s2 = SuiSigner::from_seed([3u8; 32]);
        assert_eq!(s1.address(), s2.address());
    }

    #[test]
    fn test_address_differs_for_different_keys() {
        let s1 = SuiSigner::from_seed([1u8; 32]);
        let s2 = SuiSigner::from_seed([2u8; 32]);
        assert_ne!(s1.address(), s2.address());
    }

    #[test]
    fn test_address_uses_flag_byte() {
        // address = SHA-256(0x00 || pubkey); verify it differs from SHA-256(pubkey)
        let pubkey = [9u8; 32];
        let addr_flag = sui_address_from_pubkey(&pubkey);
        let plain = Sha256::digest(pubkey);
        let addr_plain = format!("0x{}", hex::encode(plain));
        assert_ne!(addr_flag, addr_plain);
    }

    #[test]
    fn test_signature_envelope_length() {
        let s = SuiSigner::from_seed([4u8; 32]);
        let sig_b64 = s.signature_b64(b"hello sui");
        let decoded = B64.decode(&sig_b64).unwrap();
        // flag(1) + sig(64) + pubkey(32) = 97
        assert_eq!(decoded.len(), 97);
        assert_eq!(decoded[0], ED25519_FLAG);
    }

    #[test]
    fn test_signature_envelope_contains_pubkey() {
        let s = SuiSigner::from_seed([5u8; 32]);
        let sig_b64 = s.signature_b64(b"msg");
        let decoded = B64.decode(&sig_b64).unwrap();
        let pk = s.pubkey();
        assert_eq!(&decoded[1..65], &sig_bytes_of(&s, b"msg")[..]);
        assert_eq!(&decoded[65..97], &pk[..]);
    }

    #[test]
    fn test_signature_deterministic() {
        let s = SuiSigner::from_seed([6u8; 32]);
        let a = s.signature_b64(b"msg");
        let b = s.signature_b64(b"msg");
        assert_eq!(a, b);
    }

    fn sig_bytes_of(s: &SuiSigner, msg: &[u8]) -> [u8; 64] {
        s.sign(msg)
    }
}
