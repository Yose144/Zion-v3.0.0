//! Phase 2 prep — dual-stratum miner harness.
//!
//! This module lives strictly inside `AuXpow/` and has no dependency on `V3/`.
//! It defines generic types that `V3/L1/miner` can consume later when the
//! miner is upgraded to hash both ZION and external jobs.
//!
//! Design:
//!   - `WorkPackage` — opaque PoW job: header bytes + target + algorithm.
//!   - `DualStratumJob` — a ZION work package and an external `JobPackage`
//!     packaged together with a nonce split.
//!   - `NonceSplit` — deterministic rule for assigning nonces to ZION vs
//!     external (e.g. 75/25 round-robin or chunk-based).
//!   - `DualStratumMiner` — scans nonces, hashes with the right algorithm,
//!     and returns either a ZION share or an external share.
//!   - `ShareDisposition` — outcome of one hash attempt.

use anyhow::{anyhow, Result};

use crate::external_hashers::{hash_blake3, hash_kheavyhash, meets_target, meets_target_little_endian};
use crate::types::{ExternalCoin, JobPackage, SplitConfig};

/// Generic PoW work package.
///
/// This is a stand-in for whatever job type `V3/L1/miner` uses internally.
/// The only fields needed for dual-stratum simulation are the header bytes,
/// difficulty target, and an algorithm identifier.
#[derive(Debug, Clone)]
pub struct WorkPackage {
    pub algorithm: String,
    pub header_bytes: Vec<u8>,
    pub target_bytes: [u8; 32],
}

/// A dual-stratum job packages a ZION job together with an external job.
///
/// The miner alternates between them according to `split`, producing both
/// ZION shares and external shares from the same connection.
#[derive(Debug, Clone)]
pub struct DualStratumJob {
    pub zion: WorkPackage,
    pub external: JobPackage,
    pub split: SplitConfig,
}

/// Outcome of attempting one nonce in the dual-stratum loop.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShareDisposition {
    /// Nonce belongs to ZION job and produced a share meeting ZION target.
    ZionShare { nonce: u64, hash: [u8; 32] },
    /// Nonce belongs to external job and produced a share meeting external target.
    ExternalShare(FoundExternalShare),
    /// Hash did not meet either target.
    BelowTarget,
}

/// An external share ready for forwarding.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FoundExternalShare {
    pub external_coin: ExternalCoin,
    pub external_job_id: String,
    pub nonce: u64,
    pub hash: [u8; 32],
}

impl DualStratumJob {
    /// Create a dual job with the given ZION/external packages and split.
    pub fn new(zion: WorkPackage, external: JobPackage, split: SplitConfig) -> Self {
        Self { zion, external, split }
    }

    /// Total weight of the split (used for modulo assignment).
    pub fn total_weight(&self) -> u32 {
        self.split.zion_weight.saturating_add(self.split.external_weight)
    }

    /// Decide whether `nonce` belongs to ZION or external job.
    ///
    /// Uses modulo of total weight.  Example: 75/25 → nonces 0..74 are ZION,
    /// nonces 75..99 are external, then it repeats.
    pub(crate) fn assign_nonce(&self, nonce: u64) -> JobAssignment {
        let total = self.total_weight();
        if total == 0 {
            // Degenerate case: no work assigned.  Default to ZION.
            return JobAssignment::Zion;
        }
        let slot = (nonce % u64::from(total)) as u32;
        if slot < self.split.zion_weight {
            JobAssignment::Zion
        } else {
            JobAssignment::External
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum JobAssignment {
    Zion,
    External,
}

/// Hash dispatcher for the dual-stratum miner.
///
/// Keeps the AuXpow crate self-contained by only supporting algorithms that
/// are already implemented here.  Integration with `V3/L1/miner` can extend
/// the dispatcher through a trait or callback in the future.
pub fn dispatch_hash(algorithm: &str, header: &[u8], timestamp: u64, nonce: u64) -> Result<[u8; 32]> {
    match algorithm {
        "blake3" => Ok(hash_blake3(header, timestamp, nonce)),
        "kheavyhash" => Ok(hash_kheavyhash(header, timestamp, nonce)),
        "autolykos" => Ok(crate::external_hashers::hash_autolykos(
            header,
            nonce,
            timestamp as u32,
        )),
        "kawpow" => {
            let mut h32 = [0u8; 32];
            let len = header.len().min(32);
            h32[..len].copy_from_slice(&header[..len]);
            let (_mix, final_hash) = crate::external_hashers::hash_kawpow(&h32, nonce, timestamp as u32);
            Ok(final_hash)
        }
        "ethash" | "etchash" => Ok(crate::external_hashers::hash_ethash(
            header,
            nonce,
            timestamp as u32,
        )),
        "verushash" => Ok(crate::external_hashers::hash_verushash(header, nonce)),
        "pearlhash" => {
            // Pearl (PRL) — PoUW MatMul + BLAKE3. CPU fallback uses simplified
            // BLAKE3 placeholder. Real mining requires the OpenCL/Metal kernel.
            let mut h32 = [0u8; 32];
            let len = header.len().min(32);
            h32[..len].copy_from_slice(&header[..len]);
            Ok(crate::external_hashers::hash_pearl(&h32, nonce))
        }
        other => Err(anyhow!("dual-stratum: algorithm '{}' not supported by AuXpow hasher", other)),
    }
}

/// Simple dual-stratum miner harness.
///
/// Scans a nonce range, assigns each nonce to ZION or external, hashes with
/// the appropriate algorithm, and returns the first share found (if any).
pub struct DualStratumMiner;

impl DualStratumMiner {
    /// Scan `range` for either a ZION or external share.
    ///
    /// Returns the first share that meets its assigned target.  This is a POC
    /// reference implementation; a real GPU miner would run both algorithms
    /// in parallel and batch shares.
    pub fn scan(job: &DualStratumJob, range: std::ops::Range<u64>) -> Option<ShareDisposition> {
        for nonce in range {
            match job.assign_nonce(nonce) {
                JobAssignment::Zion => {
                    let hash = dispatch_hash(&job.zion.algorithm, &job.zion.header_bytes, 0, nonce)
                        .ok()?;
                    if meets_target(&hash, &job.zion.target_bytes) {
                        return Some(ShareDisposition::ZionShare { nonce, hash });
                    }
                }
                JobAssignment::External => {
                    let hash = dispatch_hash(
                        &job.external.algorithm,
                        &job.external.header_bytes,
                        job.external.timestamp,
                        nonce,
                    )
                    .ok()?;
                    let meets = if job.external.external_coin == ExternalCoin::DCR {
                        meets_target_little_endian(&hash, &job.external.target_bytes)
                    } else {
                        meets_target(&hash, &job.external.target_bytes)
                    };
                    if meets {
                        return Some(ShareDisposition::ExternalShare(FoundExternalShare {
                            external_coin: job.external.external_coin,
                            external_job_id: job.external.external_job_id.clone(),
                            nonce,
                            hash,
                        }));
                    }
                }
            }
        }
        None
    }

    /// Count how many nonces in `range` are assigned to each job.
    ///
    /// Useful for telemetry and verifying the split ratio.
    pub fn count_assignments(job: &DualStratumJob, range: std::ops::Range<u64>) -> AssignmentCounts {
        let mut zion = 0u64;
        let mut external = 0u64;
        for nonce in range {
            match job.assign_nonce(nonce) {
                JobAssignment::Zion => zion += 1,
                JobAssignment::External => external += 1,
            }
        }
        AssignmentCounts { zion, external }
    }
}

/// Count of nonces assigned to ZION vs external in a range.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AssignmentCounts {
    pub zion: u64,
    pub external: u64,
}

impl AssignmentCounts {
    pub fn total(&self) -> u64 {
        self.zion + self.external
    }

    pub fn zion_ratio(&self) -> f64 {
        let total = self.total();
        if total == 0 {
            return 0.0;
        }
        self.zion as f64 / total as f64
    }

    pub fn external_ratio(&self) -> f64 {
        let total = self.total();
        if total == 0 {
            return 0.0;
        }
        self.external as f64 / total as f64
    }
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn easy_target() -> [u8; 32] {
        let mut t = [0xFFu8; 32];
        t[31] = 0x10;
        t
    }

    fn impossible_target() -> [u8; 32] {
        [0x00u8; 32]
    }

    fn zion_job() -> WorkPackage {
        WorkPackage {
            algorithm: "blake3".to_string(),
            header_bytes: b"zion_header".to_vec(),
            target_bytes: easy_target(),
        }
    }

    fn external_job() -> JobPackage {
        JobPackage {
            external_coin: ExternalCoin::DCR,
            external_job_id: "job_dcr".to_string(),
            algorithm: "blake3".to_string(),
            header_bytes: b"external_header".to_vec(),
            target_bytes: easy_target(),
            timestamp: 0,
            block_number: None,
            extranonce1: Vec::new(),
            start_nonce: 0,
            nonce_count: 1_000_000,
            seed_hash: None,
        }
    }

    #[test]
    fn assignment_75_25_split() {
        let job = DualStratumJob::new(zion_job(), external_job(), SplitConfig {
            zion_weight: 75,
            external_weight: 25,
        });
        let counts = DualStratumMiner::count_assignments(&job, 0..100);
        assert_eq!(counts.zion, 75);
        assert_eq!(counts.external, 25);
        assert!((counts.zion_ratio() - 0.75).abs() < 0.001);
    }

    #[test]
    fn assignment_repeats_every_total_weight() {
        let job = DualStratumJob::new(zion_job(), external_job(), SplitConfig {
            zion_weight: 3,
            external_weight: 1,
        });
        assert_eq!(job.assign_nonce(0), JobAssignment::Zion);
        assert_eq!(job.assign_nonce(1), JobAssignment::Zion);
        assert_eq!(job.assign_nonce(2), JobAssignment::Zion);
        assert_eq!(job.assign_nonce(3), JobAssignment::External);
        assert_eq!(job.assign_nonce(4), JobAssignment::Zion);
    }

    #[test]
    fn zero_weight_defaults_to_zion() {
        let job = DualStratumJob::new(zion_job(), external_job(), SplitConfig {
            zion_weight: 0,
            external_weight: 0,
        });
        assert_eq!(job.assign_nonce(0), JobAssignment::Zion);
        assert_eq!(job.assign_nonce(99), JobAssignment::Zion);
    }

    #[test]
    fn scan_finds_zion_share() {
        let mut zion = zion_job();
        // Easy enough target that a share is found quickly.
        zion.target_bytes = easy_target();

        let mut ext = external_job();
        ext.target_bytes = impossible_target();

        let job = DualStratumJob::new(zion, ext, SplitConfig {
            zion_weight: 1,
            external_weight: 0,
        });

        let result = DualStratumMiner::scan(&job, 0..10_000).expect("share found");
        assert!(matches!(result, ShareDisposition::ZionShare { .. }));
    }

    #[test]
    fn scan_finds_external_share() {
        let mut zion = zion_job();
        zion.target_bytes = impossible_target();

        let mut ext = external_job();
        ext.target_bytes = easy_target();

        let job = DualStratumJob::new(zion, ext, SplitConfig {
            zion_weight: 0,
            external_weight: 1,
        });

        let result = DualStratumMiner::scan(&job, 0..10_000).expect("share found");
        match result {
            ShareDisposition::ExternalShare(share) => {
                assert_eq!(share.external_coin, ExternalCoin::DCR);
                assert_eq!(share.external_job_id, "job_dcr");
            }
            other => panic!("expected external share, got {:?}", other),
        }
    }

    #[test]
    fn scan_returns_none_when_both_targets_impossible() {
        let mut zion = zion_job();
        zion.target_bytes = impossible_target();

        let mut ext = external_job();
        ext.target_bytes = impossible_target();

        let job = DualStratumJob::new(zion, ext, SplitConfig::default());
        assert!(DualStratumMiner::scan(&job, 0..100).is_none());
    }

    #[test]
    fn dispatch_rejects_unsupported_algorithm() {
        let result = dispatch_hash("randomx", b"header", 0, 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("randomx"));
    }
}
