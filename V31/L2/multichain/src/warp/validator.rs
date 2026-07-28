use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::warp::error::{WarpError, WarpResult};
use crate::warp::protocol::WarpMessage;

/// A known WARP validator.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarpValidator {
    pub id: String,
    pub public_key: VerifyingKey,
    pub name: String,
    pub active: bool,
}

/// Manages the validator set, quorum verification, and local signing.
///
/// In production, each WARP node holds its own ed25519 signing key and
/// collects signatures from other validators via P2P gossip. For single-node
/// Alpha deployments, all validator keys can be configured locally via
/// `WARP_VALIDATOR_KEYS` env var (comma-separated 64-char hex private keys).
pub struct WarpValidatorSet {
    validators: HashMap<String, WarpValidator>,
    /// Number of signatures required for quorum (default: 3 of 5)
    pub quorum: usize,
    /// Local signing keys keyed by validator ID. In multi-node mode, each
    /// node holds only its own key. In single-node Alpha mode, all keys
    /// are loaded here so the executor can produce a full quorum locally.
    signing_keys: HashMap<String, SigningKey>,
}

impl WarpValidatorSet {
    pub fn new(quorum: usize) -> Self {
        Self {
            validators: HashMap::new(),
            quorum,
            signing_keys: HashMap::new(),
        }
    }

    pub fn add_validator(&mut self, validator: WarpValidator) {
        self.validators.insert(validator.id.clone(), validator);
    }

    /// Add a validator with its signing key (enables local signing).
    pub fn add_validator_with_key(&mut self, validator: WarpValidator, signing_key: SigningKey) {
        let id = validator.id.clone();
        // Verify the key matches the public key.
        if signing_key.verifying_key() != validator.public_key {
            tracing::warn!(
                "[WARP] Validator {} signing key does not match public key — skipping key",
                id
            );
            self.validators.insert(id, validator);
            return;
        }
        self.validators.insert(id.clone(), validator);
        self.signing_keys.insert(id, signing_key);
    }

    /// Add a validator from a hex-encoded ed25519 private key (64 hex chars).
    /// Derives the public key automatically.
    pub fn add_validator_from_key_hex(&mut self, id: &str, name: &str, key_hex: &str) -> WarpResult<()> {
        let key_bytes = hex::decode(key_hex).map_err(|e| WarpError::Internal(format!(
            "invalid validator key hex for {}: {}", id, e
        )))?;
        if key_bytes.len() != 32 {
            return Err(WarpError::Internal(format!(
                "validator key must be 32 bytes (64 hex chars), got {} for {}",
                key_bytes.len(), id
            )));
        }
        let mut seed = [0u8; 32];
        seed.copy_from_slice(&key_bytes);
        let signing_key = SigningKey::from_bytes(&seed);
        let public_key = signing_key.verifying_key();

        let validator = WarpValidator {
            id: id.to_string(),
            public_key,
            name: name.to_string(),
            active: true,
        };
        self.validators.insert(id.to_string(), validator);
        self.signing_keys.insert(id.to_string(), signing_key);
        Ok(())
    }

    /// Load validator keys from `WARP_VALIDATOR_KEYS` env var.
    /// Format: `id1:hexkey1,id2:hexkey2,...`
    /// Example: `val1:4f3a...b2c,val2:8e1d...7a3`
    pub fn load_from_env(&mut self) -> WarpResult<usize> {
        let keys_str = match std::env::var("WARP_VALIDATOR_KEYS") {
            Ok(s) if !s.is_empty() => s,
            _ => return Ok(0),
        };
        let mut count = 0;
        for entry in keys_str.split(',') {
            let entry = entry.trim();
            if entry.is_empty() {
                continue;
            }
            let parts: Vec<&str> = entry.splitn(2, ':').collect();
            if parts.len() != 2 {
                tracing::warn!("[WARP] Skipping invalid validator key entry: {}", entry);
                continue;
            }
            let id = parts[0].trim();
            let key_hex = parts[1].trim();
            match self.add_validator_from_key_hex(id, &format!("Validator {}", id), key_hex) {
                Ok(()) => {
                    count += 1;
                    tracing::info!("[WARP] Loaded validator {} from env", id);
                }
                Err(e) => tracing::error!("[WARP] Failed to load validator {}: {}", id, e),
            }
        }
        Ok(count)
    }

    /// Sign a WarpMessage with all locally-held signing keys.
    /// Returns `Vec<(validator_id, signature_bytes)>`.
    pub fn sign_locally(&self, message: &WarpMessage) -> Vec<(String, Vec<u8>)> {
        let msg_hash = message.signing_hash();
        self.signing_keys
            .iter()
            .filter(|(id, _)| {
                self.validators
                    .get(*id)
                    .map(|v| v.active)
                    .unwrap_or(false)
            })
            .map(|(id, sk)| {
                let sig = sk.sign(&msg_hash);
                (id.clone(), sig.to_bytes().to_vec())
            })
            .collect()
    }

    /// Check if we have enough local signing keys to produce a quorum.
    pub fn can_sign_quorum_locally(&self) -> bool {
        let active_local = self
            .signing_keys
            .keys()
            .filter(|id| {
                self.validators
                    .get(*id)
                    .map(|v| v.active)
                    .unwrap_or(false)
            })
            .count();
        active_local >= self.quorum
    }

    pub fn remove_validator(&mut self, id: &str) {
        self.validators.remove(id);
        self.signing_keys.remove(id);
    }

    pub fn active_count(&self) -> usize {
        self.validators.values().filter(|v| v.active).count()
    }

    pub fn total_count(&self) -> usize {
        self.validators.len()
    }

    pub fn has_quorum(&self, signature_count: usize) -> bool {
        signature_count >= self.quorum
    }

    /// Verify a set of signatures on a WarpMessage and check quorum.
    pub fn verify_quorum(
        &self,
        message: &WarpMessage,
        signatures: &[(String, Vec<u8>)],
    ) -> WarpResult<bool> {
        let msg_hash = message.signing_hash();
        let mut valid_count = 0;

        for (validator_id, sig_bytes) in signatures {
            let validator =
                self.validators
                    .get(validator_id)
                    .ok_or_else(|| WarpError::InvalidSignature {
                        validator: validator_id.clone(),
                    })?;

            if !validator.active {
                continue;
            }

            if sig_bytes.len() != 64 {
                return Err(WarpError::InvalidSignature {
                    validator: validator_id.clone(),
                });
            }

            let sig = Signature::from_bytes(sig_bytes.as_slice().try_into().map_err(|_| {
                WarpError::InvalidSignature {
                    validator: validator_id.clone(),
                }
            })?);

            if validator.public_key.verify(&msg_hash, &sig).is_ok() {
                valid_count += 1;
            }
        }

        if valid_count < self.quorum {
            return Err(WarpError::QuorumNotReached {
                signatures: valid_count,
                required: self.quorum,
            });
        }

        Ok(true)
    }

    pub fn get_validator(&self, id: &str) -> Option<&WarpValidator> {
        self.validators.get(id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;

    fn make_validator(id: &str) -> (WarpValidator, SigningKey) {
        // Deterministic key from test seed
        let mut seed = [0u8; 32];
        seed[0] = id.as_bytes().first().copied().unwrap_or(0);
        seed[1] = id.as_bytes().get(1).copied().unwrap_or(0);
        let sk = SigningKey::from_bytes(&seed);
        let pk = sk.verifying_key();
        let v = WarpValidator {
            id: id.into(),
            public_key: pk,
            name: format!("Validator {}", id),
            active: true,
        };
        (v, sk)
    }

    #[test]
    fn test_validator_set_basic() {
        let mut vs = WarpValidatorSet::new(3);
        assert_eq!(vs.total_count(), 0);
        let (v, _) = make_validator("v1");
        vs.add_validator(v);
        assert_eq!(vs.total_count(), 1);
        assert_eq!(vs.active_count(), 1);
    }

    #[test]
    fn test_has_quorum() {
        let vs = WarpValidatorSet::new(3);
        assert!(!vs.has_quorum(2));
        assert!(vs.has_quorum(3));
        assert!(vs.has_quorum(5));
    }

    #[test]
    fn test_remove_validator() {
        let mut vs = WarpValidatorSet::new(3);
        let (v, _) = make_validator("v1");
        vs.add_validator(v);
        assert_eq!(vs.total_count(), 1);
        vs.remove_validator("v1");
        assert_eq!(vs.total_count(), 0);
    }

    #[test]
    fn test_get_validator() {
        let mut vs = WarpValidatorSet::new(3);
        let (v, _) = make_validator("v1");
        vs.add_validator(v);
        assert!(vs.get_validator("v1").is_some());
        assert!(vs.get_validator("v2").is_none());
    }

    #[test]
    fn test_verify_quorum_with_valid_signatures() {
        let mut vs = WarpValidatorSet::new(2);
        let mut signers = Vec::new();

        for i in 1..=3 {
            let (v, sk) = make_validator(&format!("v{}", i));
            vs.add_validator(v);
            signers.push(sk);
        }

        let msg = WarpMessage {
            transfer_id: uuid::Uuid::nil(),
            source_chain: "zion-l1".into(),
            dest_chain: "solana".into(),
            recipient: "addr".into(),
            amount_flowers: 1_000_000,
            fee_flowers: 1_500,
            nonce: 1,
            timestamp: 1700000000,
            deposit_proof_hash: "hash".into(),
        };

        let msg_hash = msg.signing_hash();
        use ed25519_dalek::Signer;
        let signatures: Vec<(String, Vec<u8>)> = signers
            .iter()
            .enumerate()
            .take(2)
            .map(|(i, sk)| {
                let sig = sk.sign(&msg_hash);
                (format!("v{}", i + 1), sig.to_bytes().to_vec())
            })
            .collect();

        let result = vs.verify_quorum(&msg, &signatures);
        assert!(result.is_ok());
    }

    #[test]
    fn test_verify_quorum_insufficient() {
        let mut vs = WarpValidatorSet::new(3);
        let (v, sk) = make_validator("v1");
        vs.add_validator(v);

        let msg = WarpMessage {
            transfer_id: uuid::Uuid::nil(),
            source_chain: "zion-l1".into(),
            dest_chain: "base".into(),
            recipient: "0x".into(),
            amount_flowers: 100,
            fee_flowers: 1,
            nonce: 0,
            timestamp: 0,
            deposit_proof_hash: "".into(),
        };

        let msg_hash = msg.signing_hash();
        use ed25519_dalek::Signer;
        let sig = sk.sign(&msg_hash);
        let signatures = vec![("v1".into(), sig.to_bytes().to_vec())];

        let result = vs.verify_quorum(&msg, &signatures);
        assert!(result.is_err());
    }

    #[test]
    fn test_sign_locally_produces_valid_signatures() {
        let mut vs = WarpValidatorSet::new(2);
        for i in 1..=3 {
            let (v, sk) = make_validator(&format!("v{}", i));
            vs.add_validator_with_key(v, sk);
        }

        let msg = WarpMessage {
            transfer_id: uuid::Uuid::nil(),
            source_chain: "zion-l1".into(),
            dest_chain: "base".into(),
            recipient: "0xabc".into(),
            amount_flowers: 1_000_000,
            fee_flowers: 1_000,
            nonce: 1,
            timestamp: 1700000000,
            deposit_proof_hash: "hash".into(),
        };

        let sigs = vs.sign_locally(&msg);
        assert_eq!(sigs.len(), 3);

        // Verify the locally-produced signatures pass quorum check.
        let result = vs.verify_quorum(&msg, &sigs);
        assert!(result.is_ok());
    }

    #[test]
    fn test_can_sign_quorum_locally() {
        let mut vs = WarpValidatorSet::new(3);
        assert!(!vs.can_sign_quorum_locally());

        for i in 1..=3 {
            let (v, sk) = make_validator(&format!("v{}", i));
            vs.add_validator_with_key(v, sk);
        }
        assert!(vs.can_sign_quorum_locally());
    }

    #[test]
    fn test_add_validator_from_key_hex() {
        let mut vs = WarpValidatorSet::new(1);
        let (v, sk) = make_validator("v1");
        let key_hex = hex::encode(sk.to_bytes());

        vs.add_validator_from_key_hex("v1", "Test Validator", &key_hex).unwrap();

        assert_eq!(vs.total_count(), 1);
        assert!(vs.can_sign_quorum_locally());

        let msg = WarpMessage {
            transfer_id: uuid::Uuid::nil(),
            source_chain: "zion-l1".into(),
            dest_chain: "solana".into(),
            recipient: "addr".into(),
            amount_flowers: 100,
            fee_flowers: 1,
            nonce: 0,
            timestamp: 0,
            deposit_proof_hash: "".into(),
        };

        let sigs = vs.sign_locally(&msg);
        assert_eq!(sigs.len(), 1);
        assert!(vs.verify_quorum(&msg, &sigs).is_ok());
    }

    #[test]
    fn test_sign_locally_empty_without_keys() {
        let mut vs = WarpValidatorSet::new(1);
        let (v, _) = make_validator("v1");
        vs.add_validator(v); // No signing key

        let msg = WarpMessage {
            transfer_id: uuid::Uuid::nil(),
            source_chain: "zion-l1".into(),
            dest_chain: "base".into(),
            recipient: "0x".into(),
            amount_flowers: 100,
            fee_flowers: 1,
            nonce: 0,
            timestamp: 0,
            deposit_proof_hash: "".into(),
        };

        let sigs = vs.sign_locally(&msg);
        assert!(sigs.is_empty());
        assert!(!vs.can_sign_quorum_locally());
    }
}
