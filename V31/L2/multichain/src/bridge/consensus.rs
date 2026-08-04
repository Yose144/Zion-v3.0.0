//! Bridge validator consensus.
//!
//! Wraps the WARP `WarpValidatorSet` to provide bridge-specific threshold
//! signing.  A bridge transfer is only approved when at least a 5/7 quorum of
//! validators has signed a deterministic `WarpMessage` derived from the
//! transfer.

use sha2::{Digest, Sha256};
use uuid::Uuid;

use zion_l1_types::{ChainId, Hash};

use crate::error::{MultichainError, MultichainResult};
use crate::types::Transfer;
use crate::warp::protocol::{ValidatorSignature, WarpMessage};
use crate::warp::validator::WarpValidatorSet;

/// Default bridge quorum — 5 signatures out of a 7-validator set.
pub const DEFAULT_BRIDGE_QUORUM: usize = 5;

/// Consensus wrapper for bridge transfers.
#[derive(Debug, Clone)]
pub struct BridgeConsensus {
    validator_set: WarpValidatorSet,
}

impl BridgeConsensus {
    /// Create a new bridge consensus with the default 5/7 quorum.
    pub fn new() -> Self {
        Self {
            validator_set: WarpValidatorSet::new(DEFAULT_BRIDGE_QUORUM),
        }
    }

    /// Create a consensus with an explicit quorum.
    pub fn with_quorum(quorum: usize) -> Self {
        Self {
            validator_set: WarpValidatorSet::new(quorum),
        }
    }

    /// Expose the inner validator set for key management.
    pub fn validator_set(&self) -> &WarpValidatorSet {
        &self.validator_set
    }

    pub fn validator_set_mut(&mut self) -> &mut WarpValidatorSet {
        &mut self.validator_set
    }

    /// Check whether enough local signing keys are available to produce a quorum.
    pub fn can_sign_quorum_locally(&self) -> bool {
        self.validator_set.can_sign_quorum_locally()
    }

    /// Sign a bridge transfer with all locally-held validator keys.
    pub fn sign_transfer(&self, transfer: &Transfer) -> Vec<ValidatorSignature> {
        let message = transfer_to_warp_message(transfer);
        let msg_hash = message.signing_hash();

        self.validator_set
            .sign_locally(&message)
            .into_iter()
            .map(|(id, sig)| {
                let public_key = self
                    .validator_set
                    .get_validator(&id)
                    .map(|v| v.public_key.to_bytes().to_vec())
                    .unwrap_or_default();
                ValidatorSignature {
                    validator_id: id,
                    public_key,
                    signature: sig,
                    warp_message_hash: hex::encode(&msg_hash),
                }
            })
            .collect()
    }

    /// Verify that the provided signatures form a quorum for the transfer.
    pub fn verify_transfer(
        &self,
        transfer: &Transfer,
        signatures: &[(String, Vec<u8>)],
    ) -> MultichainResult<()> {
        let message = transfer_to_warp_message(transfer);
        self.validator_set
            .verify_quorum(&message, signatures)
            .map_err(|e| MultichainError::Validation(format!("bridge quorum failed: {e}")))?;
        Ok(())
    }

    /// Sign the transfer locally and immediately verify the quorum.
    ///
    /// Returns the signatures on success, or an error if the local node does
    /// not hold enough keys to reach quorum.
    pub fn sign_and_verify(&self, transfer: &Transfer) -> MultichainResult<Vec<ValidatorSignature>> {
        let signatures = self.sign_transfer(transfer);
        let sig_tuples: Vec<(String, Vec<u8>)> = signatures
            .iter()
            .map(|s| (s.validator_id.clone(), s.signature.clone()))
            .collect();
        self.verify_transfer(transfer, &sig_tuples)?;
        Ok(signatures)
    }
}

impl Default for BridgeConsensus {
    fn default() -> Self {
        Self::new()
    }
}

/// Build a deterministic `WarpMessage` from a `Transfer`.
fn transfer_to_warp_message(transfer: &Transfer) -> WarpMessage {
    // Deterministic UUID from the transfer id so the same transfer always
    // produces the same signing hash.
    let id_hash = Sha256::digest(transfer.id.as_bytes());
    let mut id_bytes = [0u8; 16];
    id_bytes.copy_from_slice(&id_hash[..16]);
    let transfer_id = Uuid::from_bytes(id_bytes);
    let deposit_proof_hash = hex::encode(&id_hash[..]);

    WarpMessage {
        transfer_id,
        source_chain: chain_name(transfer.source.address.chain),
        dest_chain: chain_name(transfer.target.address.chain),
        recipient: transfer.target.address.encoded.clone(),
        amount_flowers: transfer.source.amount.0 as u64,
        fee_flowers: 0,
        nonce: 0,
        timestamp: transfer.created_at.timestamp() as u64,
        deposit_proof_hash,
    }
}

fn chain_name(chain: ChainId) -> String {
    match chain {
        ChainId::ZionL1 => "zion-l1".to_string(),
        ChainId::Base => "base".to_string(),
        ChainId::Ethereum => "ethereum".to_string(),
        ChainId::Bitcoin => "bitcoin".to_string(),
        _ => chain.as_str().to_string(),
    }
}

/// Convenience: check if a transfer hash represents a locked output.
pub fn bridge_deposit_hash(transfer: &Transfer) -> Hash {
    Hash::new(Sha256::digest(transfer.id.as_bytes()).into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Transfer, TransferDirection, TransferEndpoint};
    use zion_l1_types::{Address, Amount, Asset, ChainId, ChainFamily};

    fn endpoint(chain: ChainId, encoded: &str, asset: Asset, amount: Amount) -> TransferEndpoint {
        let bytes = match chain.family() {
            ChainFamily::Evm => vec![0u8; 20],
            _ => vec![0x1u8; 20],
        };
        TransferEndpoint {
            address: Address::new(chain, bytes, encoded).unwrap(),
            asset,
            amount,
        }
    }

    fn make_transfer(id: &str) -> Transfer {
        let source = endpoint(
            ChainId::ZionL1,
            "zion1source",
            Asset::native(ChainId::ZionL1, "ZION", 6, "ZION"),
            Amount::new(1_000_000),
        );
        let target = endpoint(
            ChainId::Base,
            "0xTarget",
            Asset::native(ChainId::Base, "wZION", 6, "Wrapped ZION"),
            Amount::new(1_000_000),
        );
        Transfer::new(id, TransferDirection::LockMint, source, target)
    }

    fn add_five_validators(consensus: &mut BridgeConsensus) {
        for i in 1..=5 {
            let seed = [i as u8; 32];
            let key_hex = hex::encode(seed);
            consensus
                .validator_set_mut()
                .add_validator_from_key_hex(&format!("v{i}"), "", &key_hex)
                .unwrap();
        }
    }

    #[test]
    fn default_bridge_quorum_is_five() {
        let consensus = BridgeConsensus::new();
        assert_eq!(consensus.validator_set().quorum, DEFAULT_BRIDGE_QUORUM);
    }

    #[test]
    fn can_sign_quorum_locally_with_five_keys() {
        let mut consensus = BridgeConsensus::new();
        add_five_validators(&mut consensus);
        assert!(consensus.can_sign_quorum_locally());
    }

    #[test]
    fn sign_and_verify_reaches_quorum() {
        let mut consensus = BridgeConsensus::new();
        add_five_validators(&mut consensus);
        let transfer = make_transfer("lock-mint-consensus");
        let sigs = consensus.sign_and_verify(&transfer).unwrap();
        assert_eq!(sigs.len(), 5);
    }

    #[test]
    fn verify_transfer_fails_without_quorum() {
        let consensus = BridgeConsensus::new();
        // No validators registered.
        let transfer = make_transfer("lock-mint-no-quorum");
        assert!(consensus.sign_and_verify(&transfer).is_err());
    }

    #[test]
    fn sign_transfer_is_deterministic() {
        let mut consensus = BridgeConsensus::new();
        add_five_validators(&mut consensus);
        let transfer = make_transfer("deterministic");
        let sigs1 = consensus.sign_transfer(&transfer);
        let sigs2 = consensus.sign_transfer(&transfer);
        assert_eq!(sigs1.len(), sigs2.len());
        for (a, b) in sigs1.iter().zip(sigs2.iter()) {
            assert_eq!(a.signature, b.signature);
        }
    }
}
