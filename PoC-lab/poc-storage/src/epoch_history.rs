//! # EpochHistory
//!
//! Per-epoch snapshot storage with replay capability and tamper-evident
//! chain hash. Each epoch's snapshot is persisted as a separate bincode file
//! at `{base_dir}/epochs/{epoch}.bincode`.
//!
//! ## Chain hash
//!
//! The chain hash is a sequential BLAKE3 hash over all epoch hashes:
//! ```text
//! chain[0] = BLAKE3(epoch[0])
//! chain[i] = BLAKE3(chain[i-1] || epoch[i])
//! ```
//! Any modification to an epoch snapshot changes all subsequent chain hashes,
//! making tampering detectable.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use poc_core::Hash;
use poc_economics::RewardDistribution;
use serde::{Deserialize, Serialize};

use super::StorageError;

/// Snapshot of a single epoch's final state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpochSnapshot {
    /// Epoch number.
    pub epoch: u64,
    /// Model hash used for this epoch's inference.
    pub model_hash: Hash,
    /// Hashes of accepted proofs (content-addressed references to ProofStore).
    pub accepted_proofs: Vec<Hash>,
    /// Hashes of rejected proofs.
    pub rejected_proofs: Vec<Hash>,
    /// Reward distribution for this epoch.
    pub reward_distribution: RewardDistribution,
    /// Unix timestamp when the epoch was finalized.
    pub timestamp: u64,
}

impl EpochSnapshot {
    /// Computes the hash of this snapshot (for chain hash computation).
    pub fn hash(&self) -> Hash {
        let bytes = bincode::serialize(self).expect("EpochSnapshot is serializable");
        *blake3::hash(&bytes).as_bytes()
    }
}

/// Per-epoch history with persistence and replay.
pub struct EpochHistory {
    /// Base directory for epoch files.
    base_dir: PathBuf,
    /// In-memory cache of loaded snapshots.
    cache: HashMap<u64, EpochSnapshot>,
}

impl EpochHistory {
    /// Creates a new `EpochHistory` rooted at `base_dir`.
    /// Creates the `epochs/` subdirectory if it doesn't exist.
    pub fn new(base_dir: impl AsRef<Path>) -> Result<Self, StorageError> {
        let base_dir = base_dir.as_ref().to_path_buf();
        let epochs_dir = base_dir.join("epochs");
        fs::create_dir_all(&epochs_dir)?;

        Ok(Self {
            base_dir,
            cache: HashMap::new(),
        })
    }

    /// Returns the path for an epoch snapshot file.
    fn epoch_path(&self, epoch: u64) -> PathBuf {
        self.base_dir
            .join("epochs")
            .join(format!("{epoch}.bincode"))
    }

    /// Saves an epoch snapshot to disk and caches it.
    pub fn save_epoch(&mut self, snapshot: EpochSnapshot) -> Result<(), StorageError> {
        let path = self.epoch_path(snapshot.epoch);
        let data = bincode::serialize(&snapshot)?;
        // Atomic write
        let tmp = path.with_extension("tmp");
        fs::write(&tmp, &data)?;
        fs::rename(&tmp, &path)?;
        self.cache.insert(snapshot.epoch, snapshot);
        Ok(())
    }

    /// Loads an epoch snapshot from disk (or cache).
    pub fn load_epoch(&mut self, epoch: u64) -> Result<EpochSnapshot, StorageError> {
        if let Some(s) = self.cache.get(&epoch) {
            return Ok(s.clone());
        }
        let path = self.epoch_path(epoch);
        if !path.exists() {
            return Err(StorageError::EpochNotFound(epoch));
        }
        let data = fs::read(&path)?;
        let snapshot: EpochSnapshot = bincode::deserialize(&data)?;
        self.cache.insert(epoch, snapshot.clone());
        Ok(snapshot)
    }

    /// Returns all epoch numbers that have been saved, sorted.
    pub fn epochs(&self) -> Vec<u64> {
        let epochs_dir = self.base_dir.join("epochs");
        if !epochs_dir.exists() {
            return Vec::new();
        }
        let mut epochs: Vec<u64> = fs::read_dir(&epochs_dir)
            .expect("read epochs dir")
            .filter_map(|e| e.ok())
            .filter_map(|e| {
                e.file_name()
                    .to_str()
                    .and_then(|s| s.strip_suffix(".bincode"))
                    .and_then(|s| s.parse::<u64>().ok())
            })
            .collect();
        epochs.sort();
        epochs
    }

    /// Replays a range of epochs [from, to] inclusive.
    /// Returns snapshots for all epochs in the range.
    pub fn replay(&mut self, from_epoch: u64, to_epoch: u64) -> Result<Vec<EpochSnapshot>, StorageError> {
        let mut result = Vec::with_capacity((to_epoch - from_epoch + 1) as usize);
        for epoch in from_epoch..=to_epoch {
            result.push(self.load_epoch(epoch)?);
        }
        Ok(result)
    }

    /// Computes the tamper-evident chain hash over all saved epochs.
    ///
    /// ```text
    /// chain[0] = BLAKE3(snapshot[0])
    /// chain[i] = BLAKE3(chain[i-1] || snapshot[i])
    /// ```
    ///
    /// Any modification to any epoch changes all subsequent chain hashes.
    pub fn chain_hash(&mut self) -> Result<Hash, StorageError> {
        let epochs = self.epochs();
        if epochs.is_empty() {
            return Ok([0u8; 32]);
        }

        let mut chain = self.load_epoch(epochs[0])?.hash();
        for &epoch in &epochs[1..] {
            let snapshot_hash = self.load_epoch(epoch)?.hash();
            let mut hasher = blake3::Hasher::new();
            hasher.update(&chain);
            hasher.update(&snapshot_hash);
            chain = *hasher.finalize().as_bytes();
        }
        Ok(chain)
    }

    /// Returns the number of saved epochs.
    pub fn count(&self) -> usize {
        self.epochs().len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_snapshot(epoch: u64, accepted: usize, rejected: usize) -> EpochSnapshot {
        EpochSnapshot {
            epoch,
            model_hash: [epoch as u8; 32],
            accepted_proofs: (0..accepted).map(|i| [i as u8; 32]).collect(),
            rejected_proofs: (0..rejected).map(|i| [0xF0 + i as u8; 32]).collect(),
            reward_distribution: RewardDistribution {
                care_validators: 700,
                humanitarian: 100,
                dao_treasury: 100,
                warp_maintenance: 50,
                hiran_research: 50,
            },
            timestamp: 1700000000 + epoch,
        }
    }

    fn make_history() -> (TempDir, EpochHistory) {
        let dir = TempDir::new().expect("tempdir");
        let hist = EpochHistory::new(dir.path()).expect("history");
        (dir, hist)
    }

    #[test]
    fn epoch_history_save_and_load() {
        let (_dir, mut hist) = make_history();
        let snap = make_snapshot(1, 3, 1);
        hist.save_epoch(snap.clone()).expect("save");
        let loaded = hist.load_epoch(1).expect("load");
        assert_eq!(loaded.epoch, 1);
        assert_eq!(loaded.accepted_proofs.len(), 3);
        assert_eq!(loaded.rejected_proofs.len(), 1);
    }

    #[test]
    fn epoch_history_load_nonexistent_fails() {
        let (_dir, mut hist) = make_history();
        let err = hist.load_epoch(999).unwrap_err();
        assert!(matches!(err, StorageError::EpochNotFound(999)));
    }

    #[test]
    fn epoch_history_replay() {
        let (_dir, mut hist) = make_history();
        for e in 1..=5 {
            hist.save_epoch(make_snapshot(e, e as usize, 0)).expect("save");
        }
        let replayed = hist.replay(1, 5).expect("replay");
        assert_eq!(replayed.len(), 5);
        for (i, snap) in replayed.iter().enumerate() {
            assert_eq!(snap.epoch, (i + 1) as u64);
        }
    }

    #[test]
    fn epoch_history_chain_hash_changes_on_modification() {
        let (_dir, mut hist) = make_history();
        // Save 3 epochs
        for e in 1..=3 {
            hist.save_epoch(make_snapshot(e, 1, 0)).expect("save");
        }
        let chain1 = hist.chain_hash().expect("chain");

        // Modify epoch 2 (save a different snapshot)
        hist.save_epoch(make_snapshot(2, 5, 0)).expect("save modified");
        let chain2 = hist.chain_hash().expect("chain after mod");

        assert_ne!(chain1, chain2, "chain hash must change after modification");
    }

    #[test]
    fn epoch_history_chain_hash_stable_without_modification() {
        let (_dir, mut hist) = make_history();
        for e in 1..=3 {
            hist.save_epoch(make_snapshot(e, 1, 0)).expect("save");
        }
        let chain1 = hist.chain_hash().expect("chain 1");
        let chain2 = hist.chain_hash().expect("chain 2");
        assert_eq!(chain1, chain2, "chain hash must be stable without changes");
    }

    #[test]
    fn epoch_history_empty_chain_hash() {
        let (_dir, mut hist) = make_history();
        let chain = hist.chain_hash().expect("chain");
        assert_eq!(chain, [0u8; 32], "empty history → zero hash");
    }

    #[test]
    fn epoch_history_persists_across_reopen() {
        let dir = TempDir::new().expect("tempdir");
        // Save epoch
        {
            let mut hist = EpochHistory::new(dir.path()).expect("history");
            hist.save_epoch(make_snapshot(42, 2, 1)).expect("save");
        }
        // Reopen and verify
        {
            let mut hist = EpochHistory::new(dir.path()).expect("reopen");
            let loaded = hist.load_epoch(42).expect("load");
            assert_eq!(loaded.epoch, 42);
            assert_eq!(loaded.accepted_proofs.len(), 2);
        }
    }

    #[test]
    fn epoch_history_count() {
        let (_dir, mut hist) = make_history();
        for e in 1..=10 {
            hist.save_epoch(make_snapshot(e, 1, 0)).expect("save");
        }
        assert_eq!(hist.count(), 10);
    }

    #[test]
    fn epoch_history_epochs_sorted() {
        let (_dir, mut hist) = make_history();
        // Save out of order
        hist.save_epoch(make_snapshot(3, 1, 0)).unwrap();
        hist.save_epoch(make_snapshot(1, 1, 0)).unwrap();
        hist.save_epoch(make_snapshot(2, 1, 0)).unwrap();
        let epochs = hist.epochs();
        assert_eq!(epochs, vec![1, 2, 3], "epochs should be sorted");
    }
}
