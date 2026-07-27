use std::sync::Arc;

use zion_cosmic_harmony::algorithm::PowAlgorithm;
use zion_l1_types::Hash;

use crate::block::{BlockHeader, POW_HEADER_SIZE};

/// Consensus validation error.
#[derive(Debug, thiserror::Error, Eq, PartialEq)]
pub enum ConsensusError {
    #[error("invalid block height: expected {expected}, got {actual}")]
    InvalidHeight { expected: u64, actual: u64 },
    #[error("timestamp must not exceed network time window")]
    InvalidTimestamp,
    #[error("PoW target not met")]
    TargetNotMet,
    #[error("previous hash mismatch")]
    PreviousHashMismatch,
    #[error("invalid header length for PoW")]
    InvalidHeaderLength,
}

/// L1 consensus engine using the canonical Ekam Deeksha PoW algorithm.
pub struct ConsensusEngine {
    algo: Arc<dyn PowAlgorithm>,
}

impl ConsensusEngine {
    pub fn new(algo: Arc<dyn PowAlgorithm>) -> Self {
        Self { algo }
    }

    /// Validate a block header against its predecessor and a difficulty target.
    pub fn verify_header(
        &self,
        header: &BlockHeader,
        previous: &BlockHeader,
        target: &[u8; 32],
    ) -> Result<(), ConsensusError> {
        if header.height != previous.height.saturating_add(1) {
            return Err(ConsensusError::InvalidHeight {
                expected: previous.height.saturating_add(1),
                actual: header.height,
            });
        }
        if header.previous_hash != compute_header_hash(previous) {
            return Err(ConsensusError::PreviousHashMismatch);
        }
        if header.timestamp < previous.timestamp {
            return Err(ConsensusError::InvalidTimestamp);
        }

        let pow_header = header.pow_header();
        if !self.algo.verify(&pow_header, header.nonce, target) {
            return Err(ConsensusError::TargetNotMet);
        }

        Ok(())
    }

    /// Search for a nonce that makes `header` meet `target`.
    ///
    /// On success, `header.nonce` is set to the winning value and the resulting
    /// hash is returned. The search range is `[start, start + limit)`.
    pub fn mine(
        &self,
        header: &mut BlockHeader,
        target: &[u8; 32],
        start: u64,
        limit: u64,
    ) -> Option<Hash> {
        let pow_header = header.pow_header();
        let (nonce, hash) = self.algo.find_nonce(&pow_header, start, limit, target)?;
        header.nonce = nonce;
        Some(hash)
    }

    /// Compute a block header's identity hash (used for `previous_hash` links).
    pub fn header_hash(&self, header: &BlockHeader) -> Hash {
        compute_header_hash(header)
    }
}

fn compute_header_hash(header: &BlockHeader) -> Hash {
    use sha3::{Digest, Keccak256};
    let mut bytes = [0u8; POW_HEADER_SIZE + 8];
    bytes[..POW_HEADER_SIZE].copy_from_slice(&header.pow_header());
    bytes[POW_HEADER_SIZE..].copy_from_slice(&header.nonce.to_le_bytes());
    Hash::new(Keccak256::digest(bytes).into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use zion_cosmic_harmony::EkamDeeksha;

    #[test]
    fn mine_and_verify_genesis_header() {
        let algo: Arc<dyn PowAlgorithm> = Arc::new(EkamDeeksha::new());
        let engine = ConsensusEngine::new(algo);

        let previous = BlockHeader {
            previous_hash: Hash::default(),
            merkle_root: Hash::default(),
            height: 0,
            timestamp: 1000,
            nonce: 0,
            difficulty: 1,
        };

        let mut header = BlockHeader {
            previous_hash: engine.header_hash(&previous),
            merkle_root: Hash::default(),
            height: 1,
            timestamp: 1001,
            nonce: 0,
            difficulty: 1,
        };

        let target = [0xFFu8; 32];
        let hash = engine.mine(&mut header, &target, 0, 10_000);
        assert!(hash.is_some(), "easy target should be mineable");

        let result = engine.verify_header(&header, &previous, &target);
        assert!(result.is_ok(), "mined header must validate: {result:?}");
    }

    #[test]
    fn invalid_height_fails() {
        let algo: Arc<dyn PowAlgorithm> = Arc::new(EkamDeeksha::new());
        let engine = ConsensusEngine::new(algo);

        let previous = BlockHeader {
            previous_hash: Hash::default(),
            merkle_root: Hash::default(),
            height: 5,
            timestamp: 1000,
            nonce: 0,
            difficulty: 1,
        };

        let mut header = BlockHeader {
            previous_hash: engine.header_hash(&previous),
            merkle_root: Hash::default(),
            height: 7, // wrong, should be 6
            timestamp: 1001,
            nonce: 0,
            difficulty: 1,
        };

        let target = [0xFFu8; 32];
        engine.mine(&mut header, &target, 0, 1000);
        let result = engine.verify_header(&header, &previous, &target);
        assert_eq!(
            result,
            Err(ConsensusError::InvalidHeight {
                expected: 6,
                actual: 7,
            })
        );
    }
}
