//! Dual-stratum miner harness.
//!
//! Defines generic types for hashing both ZION and external jobs.

use super::hasher::{dispatch_hash, meets_target, meets_target_little_endian};
use super::types::{JobPackage, SplitConfig};
use zion_cosmic_harmony::ExternalCoin;

/// Generic PoW work package.
#[derive(Debug, Clone)]
pub struct WorkPackage {
    pub algorithm: String,
    pub header_bytes: Vec<u8>,
    pub target_bytes: [u8; 32],
}

/// A dual-stratum job packages a ZION job together with an external job.
#[derive(Debug, Clone)]
pub struct DualStratumJob {
    pub zion: WorkPackage,
    pub external: JobPackage,
    pub split: SplitConfig,
}

/// Outcome of attempting one nonce in the dual-stratum loop.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShareDisposition {
    ZionShare { nonce: u64, hash: [u8; 32] },
    ExternalShare(FoundExternalShare),
    BelowTarget,
}

/// An external share ready for forwarding.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FoundExternalShare {
    pub external_coin: ExternalCoin,
    pub external_job_id: String,
    pub nonce: u64,
    pub hash: [u8; 32],
    /// Mix hash for Ethash/KawPow/ProgPow-style shares.
    pub mix_hash: Option<[u8; 32]>,
    /// Variable-length solution blob for Equihash/BeamHash/VerusHash-style shares.
    pub solution: Option<Vec<u8>>,
}

impl DualStratumJob {
    pub fn new(zion: WorkPackage, external: JobPackage, split: SplitConfig) -> Self {
        Self {
            zion,
            external,
            split,
        }
    }

    pub fn total_weight(&self) -> u32 {
        self.split
            .zion_weight
            .saturating_add(self.split.external_weight)
    }

    pub(crate) fn assign_nonce(&self, nonce: u64) -> JobAssignment {
        let total = self.total_weight();
        if total == 0 {
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

/// Simple dual-stratum miner harness.
pub struct DualStratumMiner;

impl DualStratumMiner {
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
                    let meets = if job.external.external_coin == ExternalCoin::Decred {
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
                            mix_hash: None,
                            solution: None,
                        }));
                    }
                }
            }
        }
        None
    }

    pub fn count_assignments(
        job: &DualStratumJob,
        range: std::ops::Range<u64>,
    ) -> AssignmentCounts {
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
            external_coin: ExternalCoin::Decred,
            external_job_id: "job_dcr".to_string(),
            algorithm: "blake3".to_string(),
            header_bytes: b"external_header".to_vec(),
            target_bytes: easy_target(),
            share_target_bytes: easy_target(),
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
        let job = DualStratumJob::new(
            zion_job(),
            external_job(),
            SplitConfig {
                zion_weight: 75,
                external_weight: 25,
            },
        );
        let counts = DualStratumMiner::count_assignments(&job, 0..100);
        assert_eq!(counts.zion, 75);
        assert_eq!(counts.external, 25);
        assert!((counts.zion_ratio() - 0.75).abs() < 0.001);
    }

    #[test]
    fn assignment_repeats_every_total_weight() {
        let job = DualStratumJob::new(
            zion_job(),
            external_job(),
            SplitConfig {
                zion_weight: 3,
                external_weight: 1,
            },
        );
        assert_eq!(job.assign_nonce(0), JobAssignment::Zion);
        assert_eq!(job.assign_nonce(1), JobAssignment::Zion);
        assert_eq!(job.assign_nonce(2), JobAssignment::Zion);
        assert_eq!(job.assign_nonce(3), JobAssignment::External);
        assert_eq!(job.assign_nonce(4), JobAssignment::Zion);
    }

    #[test]
    fn zero_weight_defaults_to_zion() {
        let job = DualStratumJob::new(
            zion_job(),
            external_job(),
            SplitConfig {
                zion_weight: 0,
                external_weight: 0,
            },
        );
        assert_eq!(job.assign_nonce(0), JobAssignment::Zion);
        assert_eq!(job.assign_nonce(99), JobAssignment::Zion);
    }

    #[test]
    fn scan_finds_zion_share() {
        let mut zion = zion_job();
        zion.target_bytes = easy_target();
        let mut ext = external_job();
        ext.target_bytes = impossible_target();
        let job = DualStratumJob::new(
            zion,
            ext,
            SplitConfig {
                zion_weight: 1,
                external_weight: 0,
            },
        );
        let result = DualStratumMiner::scan(&job, 0..10_000).expect("share found");
        assert!(matches!(result, ShareDisposition::ZionShare { .. }));
    }

    #[test]
    fn scan_finds_external_share() {
        let mut zion = zion_job();
        zion.target_bytes = impossible_target();
        let mut ext = external_job();
        ext.target_bytes = easy_target();
        let job = DualStratumJob::new(
            zion,
            ext,
            SplitConfig {
                zion_weight: 0,
                external_weight: 1,
            },
        );
        let result = DualStratumMiner::scan(&job, 0..10_000).expect("share found");
        match result {
            ShareDisposition::ExternalShare(share) => {
                assert_eq!(share.external_coin, ExternalCoin::Decred);
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
