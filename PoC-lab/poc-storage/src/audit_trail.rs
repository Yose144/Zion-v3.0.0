//! # AuditTrail
//!
//! Tamper-evident append-only audit log. Each entry contains a hash chain
//! link to the previous entry, making any modification detectable via
//! [`AuditTrail::verify_chain`].
//!
//! ## Hash chain
//!
//! ```text
//! entry[0].prev_hash = [0u8; 32]  (genesis)
//! entry[0].entry_hash = BLAKE3(prev_hash || sequence || timestamp || event)
//! entry[i].prev_hash = entry[i-1].entry_hash
//! entry[i].entry_hash = BLAKE3(prev_hash || sequence || timestamp || event)
//! ```
//!
//! Modifying any entry changes its `entry_hash`, which breaks the chain for
//! all subsequent entries.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use poc_core::{Hash, ValidatorId};
use poc_economics::SlashReason;
use serde::{Deserialize, Serialize};

use super::StorageError;

/// An audit event recorded in the trail.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AuditEvent {
    /// A care proof was stored.
    ProofStored {
        proof_hash: Hash,
        validator_id: ValidatorId,
    },
    /// A care proof passed verification.
    ProofVerified {
        proof_hash: Hash,
        score: u64,
    },
    /// A care proof was rejected during verification.
    ProofRejected {
        proof_hash: Hash,
        reason: String,
    },
    /// A validator was slashed for an offense.
    ValidatorSlashed {
        validator_id: ValidatorId,
        amount: u64,
        reason: SlashReason,
    },
    /// An epoch was finalized.
    EpochFinalized {
        epoch: u64,
        accepted: usize,
        rejected: usize,
    },
}

/// A single entry in the audit trail.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AuditEntry {
    /// Sequence number (0-indexed, monotonically increasing).
    pub sequence: u64,
    /// Unix timestamp.
    pub timestamp: u64,
    /// The audit event.
    pub event: AuditEvent,
    /// Hash of the previous entry (genesis = [0u8; 32]).
    pub prev_hash: Hash,
    /// Hash of this entry = BLAKE3(prev_hash || sequence || timestamp || event).
    pub entry_hash: Hash,
}

impl AuditEntry {
    /// Computes the entry hash from prev_hash, sequence, timestamp, and event.
    pub fn compute_hash(prev_hash: &Hash, sequence: u64, timestamp: u64, event: &AuditEvent) -> Hash {
        let mut hasher = blake3::Hasher::new();
        hasher.update(prev_hash);
        hasher.update(&sequence.to_le_bytes());
        hasher.update(&timestamp.to_le_bytes());
        let event_bytes = bincode::serialize(event).expect("AuditEvent is serializable");
        hasher.update(&event_bytes);
        *hasher.finalize().as_bytes()
    }
}

/// Append-only audit trail with tamper-evident hash chain.
pub struct AuditTrail {
    /// Base directory for the audit log file.
    base_dir: PathBuf,
    /// In-memory copy of all entries.
    entries: Vec<AuditEntry>,
}

impl AuditTrail {
    /// Creates a new `AuditTrail` rooted at `base_dir`.
    /// Loads existing entries from disk if the log file exists.
    pub fn new(base_dir: impl AsRef<Path>) -> Result<Self, StorageError> {
        let base_dir = base_dir.as_ref().to_path_buf();
        fs::create_dir_all(&base_dir)?;
        let log_path = base_dir.join("audit.log.bincode");

        let entries = if log_path.exists() {
            let data = fs::read(&log_path)?;
            bincode::deserialize(&data)?
        } else {
            Vec::new()
        };

        Ok(Self { base_dir, entries })
    }

    /// Returns the path to the audit log file.
    fn log_path(&self) -> PathBuf {
        self.base_dir.join("audit.log.bincode")
    }

    /// Appends a new event to the trail. Returns the created entry.
    pub fn append(&mut self, event: AuditEvent, timestamp: u64) -> Result<AuditEntry, StorageError> {
        let sequence = self.entries.len() as u64;
        let prev_hash = self
            .entries
            .last()
            .map(|e| e.entry_hash)
            .unwrap_or([0u8; 32]);

        let entry_hash = AuditEntry::compute_hash(&prev_hash, sequence, timestamp, &event);
        let entry = AuditEntry {
            sequence,
            timestamp,
            event,
            prev_hash,
            entry_hash,
        };

        self.entries.push(entry.clone());
        self.persist()?;
        Ok(entry)
    }

    /// Persists all entries to disk (atomic write).
    fn persist(&self) -> Result<(), StorageError> {
        let data = bincode::serialize(&self.entries)?;
        let path = self.log_path();
        let tmp = path.with_extension("tmp");
        {
            let mut f = fs::File::create(&tmp)?;
            f.write_all(&data)?;
            f.flush()?;
        }
        fs::rename(&tmp, &path)?;
        Ok(())
    }

    /// Verifies the hash chain integrity. Returns `Ok(())` if the chain is
    /// intact, or `Err(StorageError::AuditChainBroken(seq))` with the sequence
    /// number of the first broken entry.
    pub fn verify_chain(&self) -> Result<(), StorageError> {
        let mut expected_prev: Hash = [0u8; 32];

        for (i, entry) in self.entries.iter().enumerate() {
            // Check prev_hash links correctly
            if entry.prev_hash != expected_prev {
                return Err(StorageError::AuditChainBroken(i as u64));
            }

            // Recompute entry_hash
            let computed = AuditEntry::compute_hash(
                &entry.prev_hash,
                entry.sequence,
                entry.timestamp,
                &entry.event,
            );
            if entry.entry_hash != computed {
                return Err(StorageError::AuditChainBroken(i as u64));
            }

            expected_prev = entry.entry_hash;
        }

        Ok(())
    }

    /// Returns all entries in the trail.
    pub fn entries(&self) -> &[AuditEntry] {
        &self.entries
    }

    /// Returns the number of entries.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Returns `true` if the trail is empty.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Returns entries filtered by validator ID.
    pub fn entries_for_validator(&self, vid: &ValidatorId) -> Vec<&AuditEntry> {
        self.entries
            .iter()
            .filter(|e| match &e.event {
                AuditEvent::ProofStored { validator_id, .. } => validator_id == vid,
                AuditEvent::ValidatorSlashed { validator_id, .. } => validator_id == vid,
                _ => false,
            })
            .collect()
    }

    /// Returns entries filtered by epoch.
    pub fn entries_for_epoch(&self, epoch: u64) -> Vec<&AuditEntry> {
        self.entries
            .iter()
            .filter(|e| match &e.event {
                AuditEvent::EpochFinalized { epoch: e, .. } => *e == epoch,
                _ => false,
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use poc_core::Hash;
    use tempfile::TempDir;

    fn make_trail() -> (TempDir, AuditTrail) {
        let dir = TempDir::new().expect("tempdir");
        let trail = AuditTrail::new(dir.path()).expect("trail");
        (dir, trail)
    }

    #[test]
    fn audit_trail_starts_empty() {
        let (_dir, trail) = make_trail();
        assert!(trail.is_empty());
        assert_eq!(trail.len(), 0);
    }

    #[test]
    fn audit_trail_append_and_verify() {
        let (_dir, mut trail) = make_trail();
        trail
            .append(
                AuditEvent::ProofStored {
                    proof_hash: [1u8; 32],
                    validator_id: [2u8; 32],
                },
                1000,
            )
            .unwrap();
        trail
            .append(
                AuditEvent::ProofVerified {
                    proof_hash: [1u8; 32],
                    score: 5000,
                },
                1001,
            )
            .unwrap();
        trail
            .append(
                AuditEvent::EpochFinalized {
                    epoch: 1,
                    accepted: 1,
                    rejected: 0,
                },
                1002,
            )
            .unwrap();

        assert_eq!(trail.len(), 3);
        trail.verify_chain().expect("chain should be valid");
    }

    #[test]
    fn audit_trail_detects_tampering() {
        let (_dir, mut trail) = make_trail();
        // Append 5 entries
        for i in 0..5 {
            trail
                .append(
                    AuditEvent::EpochFinalized {
                        epoch: i,
                        accepted: i as usize,
                        rejected: 0,
                    },
                    1000 + i,
                )
                .unwrap();
        }
        trail.verify_chain().expect("chain should be valid before tampering");

        // Tamper with entry 3's event
        trail.entries[3].event = AuditEvent::EpochFinalized {
            epoch: 99,
            accepted: 99,
            rejected: 99,
        };

        let err = trail.verify_chain().unwrap_err();
        assert!(
            matches!(err, StorageError::AuditChainBroken(seq) if seq == 3),
            "chain should break at entry 3, got: {err:?}"
        );
    }

    #[test]
    fn audit_trail_persists_across_reopen() {
        let dir = TempDir::new().expect("tempdir");
        {
            let mut trail = AuditTrail::new(dir.path()).expect("trail");
            trail
                .append(
                    AuditEvent::ProofStored {
                        proof_hash: [1u8; 32],
                        validator_id: [2u8; 32],
                    },
                    1000,
                )
                .unwrap();
            trail
                .append(
                    AuditEvent::ValidatorSlashed {
                        validator_id: [3u8; 32],
                        amount: 1000,
                        reason: SlashReason::FabricatedCareProof,
                    },
                    1001,
                )
                .unwrap();
        }
        // Reopen
        {
            let trail = AuditTrail::new(dir.path()).expect("reopen");
            assert_eq!(trail.len(), 2, "entries should persist");
            trail.verify_chain().expect("chain should be valid after reopen");
        }
    }

    #[test]
    fn audit_trail_all_event_types() {
        let (_dir, mut trail) = make_trail();
        let events = vec![
            AuditEvent::ProofStored {
                proof_hash: [1u8; 32],
                validator_id: [2u8; 32],
            },
            AuditEvent::ProofVerified {
                proof_hash: [1u8; 32],
                score: 5000,
            },
            AuditEvent::ProofRejected {
                proof_hash: [3u8; 32],
                reason: "invalid model hash".into(),
            },
            AuditEvent::ValidatorSlashed {
                validator_id: [4u8; 32],
                amount: 1000,
                reason: SlashReason::MonitoringNeglect,
            },
            AuditEvent::EpochFinalized {
                epoch: 1,
                accepted: 2,
                rejected: 1,
            },
        ];

        for (i, event) in events.into_iter().enumerate() {
            trail.append(event, 1000 + i as u64).unwrap();
        }
        assert_eq!(trail.len(), 5);
        trail.verify_chain().expect("all event types should produce valid chain");
    }

    #[test]
    fn audit_trail_entries_for_validator() {
        let (_dir, mut trail) = make_trail();
        trail
            .append(
                AuditEvent::ProofStored {
                    proof_hash: [1u8; 32],
                    validator_id: [0xAA; 32],
                },
                1000,
            )
            .unwrap();
        trail
            .append(
                AuditEvent::ProofStored {
                    proof_hash: [2u8; 32],
                    validator_id: [0xBB; 32],
                },
                1001,
            )
            .unwrap();
        trail
            .append(
                AuditEvent::ValidatorSlashed {
                    validator_id: [0xAA; 32],
                    amount: 500,
                    reason: SlashReason::MonitoringNeglect,
                },
                1002,
            )
            .unwrap();

        let aa_entries = trail.entries_for_validator(&[0xAA; 32]);
        assert_eq!(aa_entries.len(), 2, "validator AA should have 2 entries");
        let bb_entries = trail.entries_for_validator(&[0xBB; 32]);
        assert_eq!(bb_entries.len(), 1, "validator BB should have 1 entry");
    }

    #[test]
    fn audit_trail_entries_for_epoch() {
        let (_dir, mut trail) = make_trail();
        trail
            .append(
                AuditEvent::EpochFinalized {
                    epoch: 1,
                    accepted: 3,
                    rejected: 1,
                },
                1000,
            )
            .unwrap();
        trail
            .append(
                AuditEvent::EpochFinalized {
                    epoch: 2,
                    accepted: 4,
                    rejected: 0,
                },
                1001,
            )
            .unwrap();

        let e1 = trail.entries_for_epoch(1);
        assert_eq!(e1.len(), 1);
        let e2 = trail.entries_for_epoch(2);
        assert_eq!(e2.len(), 1);
        let e3 = trail.entries_for_epoch(3);
        assert_eq!(e3.len(), 0);
    }

    #[test]
    fn audit_trail_sequence_is_monotonic() {
        let (_dir, mut trail) = make_trail();
        for i in 0..10 {
            let entry = trail
                .append(
                    AuditEvent::EpochFinalized {
                        epoch: i,
                        accepted: 0,
                        rejected: 0,
                    },
                    1000 + i,
                )
                .unwrap();
            assert_eq!(entry.sequence, i, "sequence should be {i}");
        }
    }

    #[test]
    fn audit_trail_prev_hash_chains_correctly() {
        let (_dir, mut trail) = make_trail();
        let e0 = trail
            .append(
                AuditEvent::EpochFinalized {
                    epoch: 0,
                    accepted: 0,
                    rejected: 0,
                },
                1000,
            )
            .unwrap();
        assert_eq!(e0.prev_hash, [0u8; 32], "genesis prev_hash should be zero");

        let e1 = trail
            .append(
                AuditEvent::EpochFinalized {
                    epoch: 1,
                    accepted: 0,
                    rejected: 0,
                },
                1001,
            )
            .unwrap();
        assert_eq!(e1.prev_hash, e0.entry_hash, "prev_hash must link to previous entry_hash");
    }

    #[test]
    fn audit_trail_detects_replaced_entry_hash() {
        let (_dir, mut trail) = make_trail();
        trail
            .append(
                AuditEvent::EpochFinalized {
                    epoch: 0,
                    accepted: 1,
                    rejected: 0,
                },
                1000,
            )
            .unwrap();
        trail
            .append(
                AuditEvent::EpochFinalized {
                    epoch: 1,
                    accepted: 2,
                    rejected: 0,
                },
                1001,
            )
            .unwrap();

        // Tamper: replace entry 1's entry_hash with a fake value
        trail.entries[1].entry_hash = [0xFF; 32];

        let err = trail.verify_chain().unwrap_err();
        assert!(
            matches!(err, StorageError::AuditChainBroken(1)),
            "should detect broken hash at entry 1"
        );
    }
}
