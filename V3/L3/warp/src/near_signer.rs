//! # NEAR Signer — D-04
//!
//! Signs and broadcasts NEAR function-call transactions for ZION minting.
//!
//! ## Design
//! - Pure Rust: `ed25519-dalek v2` + `sha2` + `bs58` + `base64` (all in Cargo).
//! - Minimal hand-rolled borsh serialization for the `Transaction` / `SignedTransaction`
//!   structures (avoids pulling in the `near-*` SDK crates).
//! - Submits via the `broadcast_tx_async` JSON-RPC method.
//!
//! ## Key format
//! `WARP_NEAR_RELAY_KEY` must be a hex-encoded 32-byte Ed25519 seed.
//! The NEAR account id is read from `WARP_NEAR_ACCOUNT` (e.g. `warp.near`).
//!
//! ## Public key format
//! NEAR displays public keys as `ed25519:<base58_pubkey>`.  The borsh wire
//! format is a single `0u8` key-type tag followed by the 32 raw pubkey bytes.
//!
//! ## Transaction structure (borsh)
//! ```text
//! Transaction {
//!   signer_id:   String,
//!   public_key:  PublicKey  (0u8 || [u8;32]),
//!   nonce:       u64,
//!   receiver_id: String,
//!   actions:     Vec<Action>,
//!   block_hash:  [u8;32],
//! }
//! ```
//! `Action::FunctionCall` (variant index 8):
//! ```text
//! { method_name: String, args: Vec<u8>, gas: u64, deposit: u128 }
//! ```
//! `SignedTransaction` = `Transaction` bytes || `0u8` || signature[64].

use crate::error::{WarpError, WarpResult};
use ed25519_dalek::{Signer, SigningKey};

// ─────────────────────────────────────────────────────────────────────────────
// Minimal borsh writers
// ─────────────────────────────────────────────────────────────────────────────

/// Write a borsh string: 4-byte LE length + raw bytes.
fn borsh_string(buf: &mut Vec<u8>, s: &str) {
    let bytes = s.as_bytes();
    buf.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
    buf.extend_from_slice(bytes);
}

/// Write a borsh `Vec<u8>`: 4-byte LE length + raw bytes.
fn borsh_bytes(buf: &mut Vec<u8>, data: &[u8]) {
    buf.extend_from_slice(&(data.len() as u32).to_le_bytes());
    buf.extend_from_slice(data);
}

/// Write a borsh `Vec<Action>`: 4-byte LE length (item count) + items.
fn borsh_vec_len(buf: &mut Vec<u8>, len: usize) {
    buf.extend_from_slice(&(len as u32).to_le_bytes());
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction model
// ─────────────────────────────────────────────────────────────────────────────

/// NEAR public key (Ed25519 only — key-type tag `0`).
#[derive(Clone)]
pub struct NearPublicKey {
    pub bytes: [u8; 32],
}

impl NearPublicKey {
    /// Display as `ed25519:<base58>`.
    pub fn to_display(&self) -> String {
        format!("ed25519:{}", bs58::encode(&self.bytes).into_string())
    }
}

/// A single NEAR action — only `FunctionCall` is supported here.
pub enum NearAction {
    FunctionCall {
        method_name: String,
        args: Vec<u8>,
        gas: u64,
        deposit: u128,
    },
}

impl NearAction {
    /// Borsh-serialize a single action.
    /// `FunctionCall` is variant index **8** in the NEAR `Action` enum.
    fn borsh_serialize(&self, buf: &mut Vec<u8>) {
        match self {
            NearAction::FunctionCall {
                method_name,
                args,
                gas,
                deposit,
            } => {
                buf.push(8u8); // Action::FunctionCall variant index
                borsh_string(buf, method_name);
                borsh_bytes(buf, args);
                buf.extend_from_slice(&gas.to_le_bytes());
                buf.extend_from_slice(&deposit.to_le_bytes());
            }
        }
    }
}

/// Unsigned NEAR transaction.
pub struct NearTransaction {
    pub signer_id: String,
    pub public_key: NearPublicKey,
    pub nonce: u64,
    pub receiver_id: String,
    pub actions: Vec<NearAction>,
    pub block_hash: [u8; 32],
}

impl NearTransaction {
    /// Borsh-serialize the unsigned transaction (the bytes that get signed).
    pub fn borsh_serialize(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(256);
        borsh_string(&mut buf, &self.signer_id);
        // PublicKey: key-type tag 0 (ED25519) + 32 bytes
        buf.push(0u8);
        buf.extend_from_slice(&self.public_key.bytes);
        buf.extend_from_slice(&self.nonce.to_le_bytes());
        borsh_string(&mut buf, &self.receiver_id);
        borsh_vec_len(&mut buf, self.actions.len());
        for action in &self.actions {
            action.borsh_serialize(&mut buf);
        }
        buf.extend_from_slice(&self.block_hash);
        buf
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Signer
// ─────────────────────────────────────────────────────────────────────────────

/// NEAR Ed25519 signing key loaded from a hex-encoded 32-byte seed.
pub struct NearSigner {
    pub signing_key: SigningKey,
    pub account_id: String,
}

impl NearSigner {
    /// Load from env vars:
    /// - `WARP_NEAR_RELAY_KEY` — hex, 32-byte Ed25519 seed
    /// - `WARP_NEAR_ACCOUNT`   — NEAR account id (e.g. `warp.near`)
    pub fn from_env() -> WarpResult<Self> {
        let key_hex =
            std::env::var("WARP_NEAR_RELAY_KEY").map_err(|_| WarpError::AdapterError {
                chain: "near".into(),
                reason: "WARP_NEAR_RELAY_KEY env var not set".into(),
            })?;
        let account_id =
            std::env::var("WARP_NEAR_ACCOUNT").map_err(|_| WarpError::AdapterError {
                chain: "near".into(),
                reason: "WARP_NEAR_ACCOUNT env var not set".into(),
            })?;
        Self::from_hex(&key_hex, &account_id)
    }

    /// Parse a `NearSigner` from a hex-encoded 32-byte seed + account id.
    pub fn from_hex(key_hex: &str, account_id: &str) -> WarpResult<Self> {
        let bytes = hex::decode(key_hex).map_err(|e| WarpError::AdapterError {
            chain: "near".into(),
            reason: format!("hex decode failed: {}", e),
        })?;
        let seed: [u8; 32] = bytes
            .as_slice()
            .try_into()
            .map_err(|_| WarpError::AdapterError {
                chain: "near".into(),
                reason: format!("key must be 32 bytes, got {}", bytes.len()),
            })?;
        Ok(Self {
            signing_key: SigningKey::from_bytes(&seed),
            account_id: account_id.to_string(),
        })
    }

    /// Test helper — construct from a raw 32-byte seed.
    #[cfg(test)]
    pub fn from_seed(seed: [u8; 32], account_id: &str) -> Self {
        Self {
            signing_key: SigningKey::from_bytes(&seed),
            account_id: account_id.to_string(),
        }
    }

    /// The Ed25519 public key (32 raw bytes).
    pub fn public_key(&self) -> NearPublicKey {
        NearPublicKey {
            bytes: self.signing_key.verifying_key().to_bytes(),
        }
    }

    /// Build, sign, and borsh-serialize a `SignedTransaction`.
    ///
    /// Returns the full signed-transaction bytes (suitable for base64 encoding
    /// and submission via `broadcast_tx_async`).
    pub fn sign_transaction(&self, tx: &NearTransaction) -> Vec<u8> {
        let tx_bytes = tx.borsh_serialize();
        let sig = self.signing_key.sign(&tx_bytes);
        let sig_bytes = sig.to_bytes();

        // SignedTransaction = Transaction || Signature
        // Signature borsh: key-type tag 0 (ED25519) + 64 bytes
        let mut signed = tx_bytes;
        signed.push(0u8);
        signed.extend_from_slice(&sig_bytes);
        signed
    }

    /// Build a `FunctionCall` transaction, sign it, and return base64-encoded
    /// signed-transaction bytes ready for `broadcast_tx_async`.
    #[allow(clippy::too_many_arguments)]
    pub fn build_signed_function_call_b64(
        &self,
        receiver_id: &str,
        method_name: &str,
        args: serde_json::Value,
        gas: u64,
        deposit: u128,
        nonce: u64,
        block_hash: [u8; 32],
    ) -> WarpResult<String> {
        let args_bytes = serde_json::to_vec(&args).map_err(|e| WarpError::AdapterError {
            chain: "near".into(),
            reason: format!("args serialization: {}", e),
        })?;
        let tx = NearTransaction {
            signer_id: self.account_id.clone(),
            public_key: self.public_key(),
            nonce,
            receiver_id: receiver_id.to_string(),
            actions: vec![NearAction::FunctionCall {
                method_name: method_name.to_string(),
                args: args_bytes,
                gas,
                deposit,
            }],
            block_hash,
        };
        let signed = self.sign_transaction(&tx);
        Ok(base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            &signed,
        ))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_seed_basic() {
        let s = NearSigner::from_seed([1u8; 32], "warp.near");
        assert_eq!(s.account_id, "warp.near");
        assert_eq!(s.public_key().bytes.len(), 32);
    }

    #[test]
    fn test_from_hex_valid() {
        let hex_str = hex::encode([7u8; 32]);
        let s = NearSigner::from_hex(&hex_str, "relay.near").unwrap();
        assert_eq!(s.account_id, "relay.near");
        assert_eq!(s.public_key().bytes.len(), 32);
    }

    #[test]
    fn test_from_hex_invalid_length() {
        let bad = hex::encode([0u8; 16]);
        assert!(NearSigner::from_hex(&bad, "x.near").is_err());
    }

    #[test]
    fn test_from_hex_invalid_chars() {
        assert!(NearSigner::from_hex("not-hex!!", "x.near").is_err());
    }

    #[test]
    fn test_from_env_missing_key() {
        std::env::remove_var("WARP_NEAR_RELAY_KEY");
        std::env::remove_var("WARP_NEAR_ACCOUNT");
        assert!(NearSigner::from_env().is_err());
    }

    #[test]
    fn test_from_env_missing_account() {
        // key set but account missing
        std::env::set_var("WARP_NEAR_RELAY_KEY", hex::encode([1u8; 32]));
        std::env::remove_var("WARP_NEAR_ACCOUNT");
        assert!(NearSigner::from_env().is_err());
        std::env::remove_var("WARP_NEAR_RELAY_KEY");
    }

    #[test]
    fn test_public_key_display() {
        let s = NearSigner::from_seed([2u8; 32], "warp.near");
        let disp = s.public_key().to_display();
        assert!(disp.starts_with("ed25519:"));
        assert_eq!(disp.len(), "ed25519:".len() + 44); // base58 of 32 bytes ≈ 44 chars
    }

    #[test]
    fn test_public_key_deterministic() {
        let s1 = NearSigner::from_seed([9u8; 32], "a.near");
        let s2 = NearSigner::from_seed([9u8; 32], "a.near");
        assert_eq!(s1.public_key().bytes, s2.public_key().bytes);
    }

    #[test]
    fn test_borsh_string() {
        let mut buf = vec![];
        borsh_string(&mut buf, "abc");
        // 4-byte LE length (3) + 3 ascii bytes
        assert_eq!(buf, vec![3, 0, 0, 0, b'a', b'b', b'c']);
    }

    #[test]
    fn test_borsh_bytes() {
        let mut buf = vec![];
        borsh_bytes(&mut buf, &[0xde, 0xad]);
        assert_eq!(buf, vec![2, 0, 0, 0, 0xde, 0xad]);
    }

    #[test]
    fn test_transaction_borsh_serialize_structure() {
        let signer = NearSigner::from_seed([1u8; 32], "warp.near");
        let tx = NearTransaction {
            signer_id: "warp.near".into(),
            public_key: signer.public_key(),
            nonce: 42,
            receiver_id: "token.warp.near".into(),
            actions: vec![NearAction::FunctionCall {
                method_name: "mint".into(),
                args: vec![b'{', b'}'],
                gas: 30_000_000_000_000,
                deposit: 0,
            }],
            block_hash: [0xaa; 32],
        };
        let bytes = tx.borsh_serialize();
        // Should start with signer_id length (9) as 4 LE bytes
        assert_eq!(&bytes[..4], &[9, 0, 0, 0]);
        // signer_id "warp.near"
        assert_eq!(&bytes[4..13], b"warp.near");
        // public key tag (0) + 32 bytes
        assert_eq!(bytes[13], 0u8);
        // nonce at offset 13 + 1 + 32 = 46
        assert_eq!(&bytes[46..54], &42u64.to_le_bytes());
        // The serialized blob must be non-trivially sized
        assert!(bytes.len() > 100);
    }

    #[test]
    fn test_signed_transaction_appends_signature() {
        let signer = NearSigner::from_seed([3u8; 32], "warp.near");
        let tx = NearTransaction {
            signer_id: "warp.near".into(),
            public_key: signer.public_key(),
            nonce: 1,
            receiver_id: "token.warp.near".into(),
            actions: vec![NearAction::FunctionCall {
                method_name: "mint".into(),
                args: vec![],
                gas: 1,
                deposit: 0,
            }],
            block_hash: [0u8; 32],
        };
        let unsigned = tx.borsh_serialize();
        let signed = signer.sign_transaction(&tx);
        // signed = unsigned || 0u8 (sig key tag) || 64-byte signature
        assert_eq!(signed.len(), unsigned.len() + 1 + 64);
        assert_eq!(&signed[..unsigned.len()], &unsigned[..]);
        assert_eq!(signed[unsigned.len()], 0u8);
    }

    #[test]
    fn test_build_signed_function_call_b64() {
        let signer = NearSigner::from_seed([4u8; 32], "warp.near");
        let b64 = signer
            .build_signed_function_call_b64(
                "token.warp.near",
                "mint",
                serde_json::json!({"recipient": "alice.near", "amount": "1000000"}),
                30_000_000_000_000,
                0,
                100,
                [0xbb; 32],
            )
            .unwrap();
        // Must be valid base64
        let decoded =
            base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &b64).unwrap();
        // Decoded = unsigned tx || 1 || 64-byte sig  →  > 65 bytes
        assert!(decoded.len() > 65);
    }

    #[test]
    fn test_signing_is_deterministic() {
        let signer = NearSigner::from_seed([5u8; 32], "warp.near");
        let tx = NearTransaction {
            signer_id: "warp.near".into(),
            public_key: signer.public_key(),
            nonce: 7,
            receiver_id: "token.warp.near".into(),
            actions: vec![NearAction::FunctionCall {
                method_name: "mint".into(),
                args: vec![1, 2, 3],
                gas: 100,
                deposit: 0,
            }],
            block_hash: [0xff; 32],
        };
        let s1 = signer.sign_transaction(&tx);
        let s2 = signer.sign_transaction(&tx);
        assert_eq!(s1, s2);
    }
}
