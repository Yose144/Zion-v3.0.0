//! Miner harness for external algorithms (POC).
//!
//! This module demonstrates how a ZION miner can stay connected to the ZION
//! pool and still execute jobs for external coins.  It is a **standalone
//! harness** inside `AuXpow/`; integration into `V3/L1/miner` is left for
//! a later step.
//!
//! Supported algorithms:
//!   - `blake3`      — DCR/ALPH
//!   - `kheavyhash`  — KAS
//!   - `autolykos`   — ERG (pure-Rust fallback; use `native-hashers` for real)
//!   - `kawpow`      — RVN/CLORE (pure-Rust fallback; use `native-hashers` for real)
//!   - `ethash`      — ETC (pure-Rust fallback; use `native-hashers` for real)
//!
//! `randomx` requires the RandomX VM and is not yet supported in the CPU harness.

use anyhow::{anyhow, Result};

use crate::external_hashers::{
    hash_autolykos, hash_blake3, hash_blake3_alph, hash_ethash, hash_kawpow, hash_kheavyhash,
    hash_kheavyhash_extranonce, meets_target,
};
use crate::types::{ExternalCoin, JobPackage};

/// A share found by the harness.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FoundShare {
    pub external_job_id: String,
    pub nonce: u64,
    pub hash: [u8; 32],
}

/// Mine a range of nonces for the given external job.
///
/// Returns the first nonce whose hash meets the job target.  If none is
/// found within `range`, returns `Ok(None)`.  The range is clamped to the
/// job's declared nonce bounds.
///
/// # Errors
/// Returns an error if the job algorithm is not supported by this harness.
pub fn mine(job: &JobPackage, range: std::ops::Range<u64>) -> Result<Option<FoundShare>> {
    let algo = job.algorithm.as_str();
    let start = job.start_nonce.max(range.start);
    let end = (job.start_nonce + job.nonce_count).min(range.end);

    if start >= end {
        return Ok(None);
    }

    match algo {
        "blake3" => {
            if job.external_coin == ExternalCoin::ALPH {
                Ok(scan_blake3_alph(job, start, end))
            } else {
                Ok(scan(job, start, end, hash_blake3))
            }
        }
        "kheavyhash" => Ok(scan_kheavyhash(job, start, end)),
        "autolykos" => Ok(scan_autolykos(job, start, end)),
        "kawpow" => Ok(scan_kawpow(job, start, end)),
        "ethash" | "etchash" => Ok(scan_ethash(job, start, end)),
        other => Err(anyhow!("algorithm '{}' not supported by CPU harness", other)),
    }
}

fn scan<F>(job: &JobPackage, start: u64, end: u64, hash_fn: F) -> Option<FoundShare>
where
    F: Fn(&[u8], u64, u64) -> [u8; 32],
{
    let header = &job.header_bytes;
    let target = &job.target_bytes;
    let timestamp = job.timestamp;

    for nonce in start..end {
        let hash = hash_fn(header, timestamp, nonce);
        if meets_target(&hash, target) {
            return Some(FoundShare {
                external_job_id: job.external_job_id.clone(),
                nonce,
                hash,
            });
        }
    }
    None
}

fn scan_blake3_alph(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let target = &job.target_bytes;
    let extranonce1 = &job.extranonce1;

    for nonce in start..end {
        let hash = hash_blake3_alph(header, extranonce1, nonce);
        if meets_target(&hash, target) {
            return Some(FoundShare {
                external_job_id: job.external_job_id.clone(),
                nonce,
                hash,
            });
        }
    }
    None
}

fn scan_kheavyhash(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let target = &job.target_bytes;
    let timestamp = job.timestamp;
    let extranonce1 = &job.extranonce1;

    // For Stratum pools that provide an extranonce1 prefix (e.g. 2miners KAS),
    // the full 8-byte nonce is extranonce1 || scanned suffix.  Otherwise fall
    // back to the legacy 64-bit nonce API.
    if !extranonce1.is_empty() && extranonce1.len() < 8 {
        for nonce in start..end {
            let hash = hash_kheavyhash_extranonce(header, timestamp, extranonce1, nonce);
            if meets_target(&hash, target) {
                return Some(FoundShare {
                    external_job_id: job.external_job_id.clone(),
                    nonce,
                    hash,
                });
            }
        }
        None
    } else {
        for nonce in start..end {
            let hash = hash_kheavyhash(header, timestamp, nonce);
            if meets_target(&hash, target) {
                return Some(FoundShare {
                    external_job_id: job.external_job_id.clone(),
                    nonce,
                    hash,
                });
            }
        }
        None
    }
}

fn scan_autolykos(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let target = &job.target_bytes;
    let height = job.timestamp as u32; // reuse timestamp field for block height

    for nonce in start..end {
        let hash = hash_autolykos(header, nonce, height);
        if meets_target(&hash, target) {
            return Some(FoundShare {
                external_job_id: job.external_job_id.clone(),
                nonce,
                hash,
            });
        }
    }
    None
}

fn scan_kawpow(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let mut header = [0u8; 32];
    let len = job.header_bytes.len().min(32);
    header[..len].copy_from_slice(&job.header_bytes[..len]);
    let target = &job.target_bytes;
    let height = job.timestamp as u32;

    for nonce in start..end {
        let (_mix, hash) = hash_kawpow(&header, nonce, height);
        if meets_target(&hash, target) {
            return Some(FoundShare {
                external_job_id: job.external_job_id.clone(),
                nonce,
                hash,
            });
        }
    }
    None
}

fn scan_ethash(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let target = &job.target_bytes;
    let height = job.timestamp as u32;

    for nonce in start..end {
        let hash = hash_ethash(header, nonce, height);
        if meets_target(&hash, target) {
            return Some(FoundShare {
                external_job_id: job.external_job_id.clone(),
                nonce,
                hash,
            });
        }
    }
    None
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ExternalCoin, JobPackage};

    fn blake3_job_with_easy_target() -> JobPackage {
        let mut target = [0xFFu8; 32];
        // Very easy target: only the last byte must be <= 0x10.
        target[31] = 0x10;
        JobPackage {
            external_coin: ExternalCoin::DCR,
            external_job_id: "job_harness_dcr".to_string(),
            algorithm: "blake3".to_string(),
            header_bytes: b"harness_header".to_vec(),
            target_bytes: target,
            timestamp: 0,
            block_number: None,
            extranonce1: Vec::new(),
            start_nonce: 0,
            nonce_count: 1_000_000,
        }
    }

    fn kheavyhash_job_with_impossible_target() -> JobPackage {
        JobPackage {
            external_coin: ExternalCoin::KAS,
            external_job_id: "job_harness_kas".to_string(),
            algorithm: "kheavyhash".to_string(),
            header_bytes: b"harness_header".to_vec(),
            target_bytes: [0x00u8; 32], // impossible
            timestamp: 0,
            block_number: None,
            extranonce1: Vec::new(),
            start_nonce: 0,
            nonce_count: 100,
        }
    }

    #[test]
    fn harness_finds_blake3_share() {
        let job = blake3_job_with_easy_target();
        let share = mine(&job, 0..10_000).unwrap().expect("share should be found");
        assert_eq!(share.external_job_id, "job_harness_dcr");
        let recomputed = hash_blake3(&job.header_bytes, job.timestamp, share.nonce);
        assert_eq!(share.hash, recomputed);
        assert!(meets_target(&share.hash, &job.target_bytes));
    }

    #[test]
    fn harness_returns_none_when_no_share() {
        let job = kheavyhash_job_with_impossible_target();
        let share = mine(&job, 0..100).unwrap();
        assert!(share.is_none());
    }

    #[test]
    fn harness_rejects_unknown_algorithm() {
        let job = JobPackage {
            external_coin: ExternalCoin::XMR,
            external_job_id: "job_xmr".to_string(),
            algorithm: "randomx".to_string(),
            header_bytes: vec![],
            target_bytes: [0xFFu8; 32],
            timestamp: 0,
            block_number: None,
            extranonce1: Vec::new(),
            start_nonce: 0,
            nonce_count: 10,
        };
        let err = mine(&job, 0..10).unwrap_err();
        assert!(err.to_string().contains("randomx"));
    }

    #[test]
    fn harness_respects_job_nonce_bounds() {
        let mut job = blake3_job_with_easy_target();
        job.start_nonce = 100;
        job.nonce_count = 50; // valid window is 100..150
        // Requesting 0..200 is clamped to 100..150 and still finds a share.
        let share = mine(&job, 0..200).unwrap().expect("share in bounds");
        assert!(share.nonce >= 100 && share.nonce < 150);
    }

    #[test]
    fn harness_returns_none_when_range_disjoint() {
        let mut job = blake3_job_with_easy_target();
        job.start_nonce = 100;
        job.nonce_count = 50; // 100..150
        // Requesting 0..50 does not overlap with the job window.
        let share = mine(&job, 0..50).unwrap();
        assert!(share.is_none());
    }
}
