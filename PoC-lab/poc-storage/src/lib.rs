//! # poc-storage
//!
//! Persistent storage for PoC-lab care proofs, epoch history, and audit trail.
//!
//! File-based bincode storage — no external database dependency. Content-addressed
//! proof files sharded by hash prefix. Tamper-evident audit log via hash chain.
//!
//! ## Layout
//!
//! ```text
//! {base_dir}/
//! ├── proofs/
//! │   ├── {hash[0..2]}/          # shard dir (256 total)
//! │   │   └── {hash}.bincode     # serialized CareProof
//! │   └── ...
//! ├── epochs/
//! │   └── {epoch}.bincode        # EpochSnapshot
//! ├── index.bincode              # HashMap<(epoch, validator_id), Hash>
//! └── audit.log.bincode          # append-only AuditTrail
//! ```
//!
//! See `docs/PHASE2_PLAN.md` §4 for the full architecture.

pub mod audit_trail;
pub mod epoch_history;
pub mod file_store;

pub use audit_trail::{AuditEntry, AuditEvent, AuditTrail};
pub use epoch_history::{EpochHistory, EpochSnapshot};
pub use file_store::FileProofStore;

use poc_core::{CareProof, Hash, ValidatorId};
use thiserror::Error;

/// Errors that can occur during storage operations.
#[derive(Debug, Error)]
pub enum StorageError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serialize(#[from] bincode::Error),
    #[error("proof not found: {}", hex::encode(_0))]
    ProofNotFound(Hash),
    #[error("epoch not found: {0}")]
    EpochNotFound(u64),
    #[error("audit chain broken at entry {0}")]
    AuditChainBroken(u64),
    #[error("storage path is not a directory: {0}")]
    NotADirectory(String),
}

/// Trait for proof storage backends.
pub trait ProofStore: Send + Sync {
    /// Stores a proof and returns its content-addressed hash.
    /// If the proof already exists, returns the existing hash (idempotent).
    fn store_proof(&self, proof: &CareProof) -> Result<Hash, StorageError>;

    /// Retrieves a proof by its content-addressed hash.
    /// Returns `Ok(None)` if not found (not an error).
    fn retrieve_proof(&self, hash: &Hash) -> Result<Option<CareProof>, StorageError>;

    /// Returns all proofs stored for a given epoch.
    /// Uses the index for efficient lookup.
    fn proofs_for_epoch(&self, epoch: u64) -> Result<Vec<CareProof>, StorageError>;

    /// Returns all proofs from a specific validator.
    fn proofs_for_validator(&self, vid: &ValidatorId) -> Result<Vec<CareProof>, StorageError>;

    /// Total number of proofs stored.
    fn proof_count(&self) -> Result<usize, StorageError>;
}

/// Computes the content-addressed hash for a [`CareProof`].
///
/// The hash is BLAKE3 of the bincode-serialized proof. This means two
/// identical proofs always produce the same hash (deduplication).
pub fn proof_hash(proof: &CareProof) -> Hash {
    let bytes = bincode::serialize(proof).expect("CareProof is serializable");
    *blake3::hash(&bytes).as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn proof_hash_is_deterministic() {
        let proof = test_proof(1, [1u8; 32], 100);
        let h1 = proof_hash(&proof);
        let h2 = proof_hash(&proof);
        assert_eq!(h1, h2, "same proof must produce same hash");
    }

    #[test]
    fn proof_hash_differs_for_different_proofs() {
        let p1 = test_proof(1, [1u8; 32], 100);
        let p2 = test_proof(2, [2u8; 32], 200);
        assert_ne!(proof_hash(&p1), proof_hash(&p2));
    }

    /// Helper: create a test CareProof.
    pub(crate) fn test_proof(epoch_val: u8, vid: ValidatorId, score: u64) -> CareProof {
        use poc_core::{CareTask, NpuAttestation};
        CareProof {
            validator_id: vid,
            task_type: CareTask::NpuInferenceQuality,
            model_hash: [epoch_val; 32],
            input_hash: [0xAB; 32],
            output: vec![epoch_val; 32],
            npu_attestation: NpuAttestation {
                backend: "cpu-reference".into(),
                quote_hash: [0xCD; 32],
                runtime_version: "0.1.0".into(),
            },
            care_score: score,
        }
    }
}
