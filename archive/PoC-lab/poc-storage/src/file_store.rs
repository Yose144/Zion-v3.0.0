//! # FileProofStore
//!
//! Content-addressed file-based proof storage. Each proof is serialized with
//! bincode and stored at `{base_dir}/proofs/{hash[0..2]}/{hash}.bincode`.
//! An in-memory index maps `(epoch, validator_id)` → proof hash for efficient
//! epoch/validator queries.
//!
//! ## Atomicity
//!
//! Writes are atomic: data is written to a temporary file first, then renamed
//! to the final path. This prevents partial writes on crash.
//!
//! ## Deduplication
//!
//! Storing the same proof twice is idempotent — the second call returns the
//! same hash without writing a new file.

use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use poc_core::{CareProof, Hash, ValidatorId};

use super::{proof_hash, ProofStore, StorageError};

/// File-based proof storage backend.
pub struct FileProofStore {
    /// Root directory for all stored data.
    base_dir: PathBuf,
    /// In-memory index: (epoch, validator_id) → proof_hash.
    /// epoch is derived from model_hash[0] as a simple proxy in this lab.
    /// In production, epoch would be an explicit field on CareProof.
    index: Mutex<HashMap<(u64, ValidatorId), Hash>>,
}

impl FileProofStore {
    /// Creates a new `FileProofStore` rooted at `base_dir`.
    /// Creates the directory structure if it doesn't exist.
    pub fn new(base_dir: impl AsRef<Path>) -> Result<Self, StorageError> {
        let base_dir = base_dir.as_ref().to_path_buf();
        fs::create_dir_all(&base_dir)?;
        fs::create_dir_all(base_dir.join("proofs"))?;

        // Load existing index if present
        let index = Self::load_index(&base_dir)?;

        Ok(Self {
            base_dir,
            index: Mutex::new(index),
        })
    }

    /// Returns the base directory path.
    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    /// Computes the file path for a proof with the given hash.
    fn proof_path(&self, hash: &Hash) -> PathBuf {
        let shard = format!("{:02x}", hash[0]);
        let hash_hex: String = hash.iter().map(|b| format!("{:02x}", b)).collect();
        self.base_dir
            .join("proofs")
            .join(shard)
            .join(&hash_hex)
            .with_extension("bincode")
    }

    /// Loads the index from disk. If no index file exists, starts empty.
    fn load_index(base_dir: &Path) -> Result<HashMap<(u64, ValidatorId), Hash>, StorageError> {
        let index_path = base_dir.join("index.bincode");
        if !index_path.exists() {
            return Ok(HashMap::new());
        }
        let data = fs::read(&index_path)?;
        let index: HashMap<(u64, ValidatorId), Hash> = bincode::deserialize(&data)?;
        Ok(index)
    }

    /// Persists the index to disk (atomic write).
    fn save_index(&self, index: &HashMap<(u64, ValidatorId), Hash>) -> Result<(), StorageError> {
        let index_path = self.base_dir.join("index.bincode");
        let data = bincode::serialize(index)?;
        atomic_write(&index_path, &data)
    }

    /// Derives a simple epoch proxy from the proof's model_hash.
    /// In a production system, CareProof would carry an explicit epoch field.
    /// For the lab, we use model_hash[0] as u64 — different epochs produce
    /// different model hashes (via RandomNpuGenerator::model_hash_for_epoch).
    fn epoch_of(proof: &CareProof) -> u64 {
        proof.model_hash[0] as u64
    }
}

impl ProofStore for FileProofStore {
    fn store_proof(&self, proof: &CareProof) -> Result<Hash, StorageError> {
        let hash = proof_hash(proof);
        let path = self.proof_path(&hash);

        // Idempotent: if file exists, just update index and return.
        if !path.exists() {
            // Create shard directory
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)?;
            }
            let data = bincode::serialize(proof)?;
            atomic_write(&path, &data)?;
        }

        // Update index
        let epoch = Self::epoch_of(proof);
        let mut index = self.index.lock().unwrap();
        index.insert((epoch, proof.validator_id), hash);
        self.save_index(&index)?;

        Ok(hash)
    }

    fn retrieve_proof(&self, hash: &Hash) -> Result<Option<CareProof>, StorageError> {
        let path = self.proof_path(hash);
        if !path.exists() {
            return Ok(None);
        }
        let data = fs::read(&path)?;
        let proof: CareProof = bincode::deserialize(&data)?;
        Ok(Some(proof))
    }

    fn proofs_for_epoch(&self, epoch: u64) -> Result<Vec<CareProof>, StorageError> {
        let index = self.index.lock().unwrap();
        let hashes: Vec<Hash> = index
            .iter()
            .filter(|((e, _), _)| *e == epoch)
            .map(|(_, h)| *h)
            .collect();
        drop(index);

        let mut proofs = Vec::with_capacity(hashes.len());
        for h in hashes {
            if let Some(p) = self.retrieve_proof(&h)? {
                proofs.push(p);
            }
        }
        Ok(proofs)
    }

    fn proofs_for_validator(&self, vid: &ValidatorId) -> Result<Vec<CareProof>, StorageError> {
        let index = self.index.lock().unwrap();
        let hashes: Vec<Hash> = index
            .iter()
            .filter(|((_, v), _)| v == vid)
            .map(|(_, h)| *h)
            .collect();
        drop(index);

        let mut proofs = Vec::with_capacity(hashes.len());
        for h in hashes {
            if let Some(p) = self.retrieve_proof(&h)? {
                proofs.push(p);
            }
        }
        Ok(proofs)
    }

    fn proof_count(&self) -> Result<usize, StorageError> {
        let index = self.index.lock().unwrap();
        Ok(index.len())
    }
}

/// Writes data to a file atomically: write to temp file, then rename.
fn atomic_write(path: &Path, data: &[u8]) -> Result<(), StorageError> {
    let tmp_path = path.with_extension("tmp");
    {
        let mut f = fs::File::create(&tmp_path)?;
        f.write_all(data)?;
        f.flush()?;
    }
    fs::rename(&tmp_path, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests::test_proof;
    use tempfile::TempDir;

    fn make_store() -> (TempDir, FileProofStore) {
        let dir = TempDir::new().expect("tempdir");
        let store = FileProofStore::new(dir.path()).expect("store");
        (dir, store)
    }

    #[test]
    fn file_store_roundtrip() {
        let (_dir, store) = make_store();
        let proof = test_proof(1, [1u8; 32], 100);
        let hash = store.store_proof(&proof).expect("store");
        let retrieved = store.retrieve_proof(&hash).expect("retrieve");
        assert!(retrieved.is_some(), "proof should be found");
        assert_eq!(retrieved.unwrap(), proof, "retrieved proof must match");
    }

    #[test]
    fn file_store_retrieve_nonexistent() {
        let (_dir, store) = make_store();
        let result = store.retrieve_proof(&[0xFF; 32]).expect("retrieve");
        assert!(result.is_none(), "nonexistent proof should return None");
    }

    #[test]
    fn file_store_content_addressed() {
        let (_dir, store) = make_store();
        let proof = test_proof(1, [1u8; 32], 100);
        let h1 = store.store_proof(&proof).expect("store 1");
        let h2 = store.store_proof(&proof).expect("store 2");
        assert_eq!(h1, h2, "same proof → same hash (idempotent)");
        assert_eq!(store.proof_count().unwrap(), 1, "dedup: count should be 1");
    }

    #[test]
    fn file_store_proofs_for_epoch() {
        let (_dir, store) = make_store();
        // epoch is derived from model_hash[0], so use different first bytes
        let p1 = test_proof(1, [1u8; 32], 100); // epoch=1
        let p2 = test_proof(1, [2u8; 32], 200); // epoch=1
        let p3 = test_proof(2, [3u8; 32], 300); // epoch=2

        store.store_proof(&p1).unwrap();
        store.store_proof(&p2).unwrap();
        store.store_proof(&p3).unwrap();

        let epoch1 = store.proofs_for_epoch(1).unwrap();
        let epoch2 = store.proofs_for_epoch(2).unwrap();
        assert_eq!(epoch1.len(), 2, "epoch 1 should have 2 proofs");
        assert_eq!(epoch2.len(), 1, "epoch 2 should have 1 proof");
    }

    #[test]
    fn file_store_proofs_for_validator() {
        let (_dir, store) = make_store();
        let p1 = test_proof(1, [1u8; 32], 100);
        let p2 = test_proof(2, [1u8; 32], 200); // same validator, different epoch
        let p3 = test_proof(1, [2u8; 32], 300); // different validator

        store.store_proof(&p1).unwrap();
        store.store_proof(&p2).unwrap();
        store.store_proof(&p3).unwrap();

        let v1 = store.proofs_for_validator(&[1u8; 32]).unwrap();
        let v2 = store.proofs_for_validator(&[2u8; 32]).unwrap();
        assert_eq!(v1.len(), 2, "validator 1 should have 2 proofs");
        assert_eq!(v2.len(), 1, "validator 2 should have 1 proof");
    }

    #[test]
    fn file_store_persists_across_reopen() {
        let dir = TempDir::new().expect("tempdir");
        let proof = test_proof(5, [7u8; 32], 500);

        // Store in first instance
        {
            let store = FileProofStore::new(dir.path()).expect("store");
            let hash = store.store_proof(&proof).expect("store");
            assert!(store.retrieve_proof(&hash).unwrap().is_some());
        }

        // Reopen and verify persistence
        {
            let store = FileProofStore::new(dir.path()).expect("reopen");
            assert_eq!(store.proof_count().unwrap(), 1, "proof should persist");
            let epoch5 = store.proofs_for_epoch(5).unwrap();
            assert_eq!(epoch5.len(), 1);
            assert_eq!(epoch5[0], proof);
        }
    }

    #[test]
    fn file_store_shard_directories_created() {
        let (_dir, store) = make_store();
        let proof = test_proof(0xAB, [1u8; 32], 100);
        let hash = store.store_proof(&proof).expect("store");

        // Verify shard dir exists
        let shard = format!("{:02x}", hash[0]);
        let shard_path = store.base_dir.join("proofs").join(&shard);
        assert!(shard_path.exists(), "shard dir should exist");
        assert!(shard_path.is_dir(), "shard should be a directory");
    }

    #[test]
    fn file_store_multiple_proofs_count() {
        let (_dir, store) = make_store();
        for i in 0u8..10 {
            let proof = test_proof(i, [i; 32], i as u64 * 100);
            store.store_proof(&proof).unwrap();
        }
        assert_eq!(store.proof_count().unwrap(), 10);
    }
}
