use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::{WarpError, WarpResult};
use crate::protocol::WarpMessage;

/// A known WARP validator.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarpValidator {
    pub id: String,
    pub public_key: VerifyingKey,
    pub name: String,
    pub active: bool,
}

/// Manages the validator set and quorum verification.
pub struct WarpValidatorSet {
    validators: HashMap<String, WarpValidator>,
    /// Number of signatures required for quorum (default: 3 of 5)
    pub quorum: usize,
}

impl WarpValidatorSet {
    pub fn new(quorum: usize) -> Self {
        Self {
            validators: HashMap::new(),
            quorum,
        }
    }

    pub fn add_validator(&mut self, validator: WarpValidator) {
        self.validators.insert(validator.id.clone(), validator);
    }

    pub fn remove_validator(&mut self, id: &str) {
        self.validators.remove(id);
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
}
