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
    hash_kheavyhash_extranonce, meets_target, meets_target_little_endian,
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
            } else if job.external_coin == ExternalCoin::DCR {
                // Decred BLAKE3 (DCP-0011) treats the PoW hash as a little-endian
                // integer when comparing against the target.
                Ok(scan_dcr(job, start, end))
            } else {
                Ok(scan(job, start, end, hash_blake3))
            }
        }
        "kheavyhash" => Ok(scan_kheavyhash(job, start, end)),
        "autolykos" => Ok(scan_autolykos(job, start, end)),
        "kawpow" => Ok(scan_kawpow(job, start, end)),
        "ethash" | "etchash" => Ok(scan_ethash(job, start, end)),
        "verushash" => Ok(scan_verushash(job, start, end)),
        "pearlhash" => Ok(scan_pearl(job, start, end)),
        other => Err(anyhow!("algorithm '{}' not supported by CPU harness", other)),
    }
}

/// Mine a range of nonces and return the share with the best (lowest) hash
/// found, regardless of the job target.  Useful for E2E tests where the pool's
/// effective difficulty is higher than the CPU-minable target and we want to
/// submit the hardest share available in a short time window.
pub fn mine_best(job: &JobPackage, range: std::ops::Range<u64>) -> Result<Option<FoundShare>> {
    let algo = job.algorithm.as_str();
    let start = job.start_nonce.max(range.start);
    let end = (job.start_nonce + job.nonce_count).min(range.end);

    if start >= end {
        return Ok(None);
    }

    match algo {
        "blake3" => {
            if job.external_coin == ExternalCoin::ALPH {
                Ok(scan_blake3_alph_best(job, start, end))
            } else if job.external_coin == ExternalCoin::DCR {
                Ok(scan_dcr_best(job, start, end))
            } else {
                Ok(scan_best(job, start, end, hash_blake3, false))
            }
        }
        "kheavyhash" => Ok(scan_kheavyhash_best(job, start, end)),
        "autolykos" => Ok(scan_autolykos_best(job, start, end)),
        "kawpow" => Ok(scan_kawpow_best(job, start, end)),
        "ethash" | "etchash" => Ok(scan_ethash_best(job, start, end)),
        "verushash" => Ok(scan_verushash_best(job, start, end)),
        "pearlhash" => Ok(scan_pearl_best(job, start, end)),
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

fn scan_dcr(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let target = &job.target_bytes;

    for nonce in start..end {
        let hash = hash_blake3(header, 0, nonce);
        if meets_target_little_endian(&hash, target) {
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

fn scan_verushash(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let target = &job.target_bytes;

    // VerusCoin block header layout (1487 bytes):
    //   offset 0:   version(4)
    //   offset 4:   prevhash(32)
    //   offset 36:  merkle(32)
    //   offset 68:  reserved(32)
    //   offset 100: ntime(4)
    //   offset 104: nbits(4)
    //   offset 108: nonce(32)        ← miner_nonce goes here
    //   offset 140: varint(3)
    //   offset 143: solution(1344)
    //     solution offset 1329 (= blob offset 1472): nonceSpace(15) ← also miner_nonce
    //
    // The extranonce1 is already embedded at the START of both the nonce
    // field and nonceSpace by the pool's notify parser.  The miner writes
    // its 4-byte LE nonce immediately AFTER extranonce1 in both places,
    // matching the standard Zcash stratum submit format where
    // nonce2 = [miner_nonce][padding] and the pool reconstructs
    // nonce_field = [en1][nonce2] = [en1][miner_nonce][padding].
    //
    // For a 4-byte extranonce1 (typical for LuckPool), miner_nonce goes at:
    //   - nonce field offset 108 + 4 = 112
    //   - nonceSpace offset 1472 + 4 = 1476

    let en1_len = job.extranonce1.len();
    let nonce_field_offset = 108 + en1_len;
    let nonce_space_blob_offset = 143 + 1329 + en1_len; // = 1472 + en1_len

    let mut work_header = header.to_vec();

    for nonce in start..end {
        let nonce_le = (nonce as u32).to_le_bytes();

        // Write miner_nonce into the 32-byte nonce field
        if nonce_field_offset + 4 <= work_header.len() {
            work_header[nonce_field_offset..nonce_field_offset + 4]
                .copy_from_slice(&nonce_le);
        }

        // Write miner_nonce into the solution nonceSpace
        if nonce_space_blob_offset + 4 <= work_header.len() {
            work_header[nonce_space_blob_offset..nonce_space_blob_offset + 4]
                .copy_from_slice(&nonce_le);
        }

        let hash = crate::external_hashers::hash_verushash_header(&work_header);
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

// ── Best-share scanners (return the share with the smallest hash) ─────

fn is_hash_better(a: &[u8; 32], b: &[u8; 32], little_endian: bool) -> bool {
    if little_endian {
        // Smaller little-endian integer = smaller high-order bytes in reversed order.
        a.iter().rev().cmp(b.iter().rev()).is_lt()
    } else {
        a.iter().cmp(b.iter()).is_lt()
    }
}

fn scan_best<F>(job: &JobPackage, start: u64, end: u64, hash_fn: F, little_endian: bool) -> Option<FoundShare>
where
    F: Fn(&[u8], u64, u64) -> [u8; 32],
{
    let header = &job.header_bytes;
    let timestamp = job.timestamp;

    let mut best: Option<FoundShare> = None;
    for nonce in start..end {
        let hash = hash_fn(header, timestamp, nonce);
        if best
            .as_ref()
            .map(|b| is_hash_better(&hash, &b.hash, little_endian))
            .unwrap_or(true)
        {
            best = Some(FoundShare {
                external_job_id: job.external_job_id.clone(),
                nonce,
                hash,
            });
        }
    }
    best
}

fn scan_dcr_best(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    if start >= end {
        return None;
    }

    let cpus = std::thread::available_parallelism()
        .map(|n| n.get() as u64)
        .unwrap_or(1);
    let range = end - start;
    let threads = cpus.min(range);
    let chunk = (range + threads - 1) / threads;

    let mut per_thread: Vec<Option<FoundShare>> = vec![None; threads as usize];

    std::thread::scope(|s| {
        for (idx, slot) in per_thread.iter_mut().enumerate() {
            let idx = idx as u64;
            let chunk_start = start + idx * chunk;
            let chunk_end = chunk_start.saturating_add(chunk).min(end);
            if chunk_start >= chunk_end {
                continue;
            }
            let package = job.clone();
            s.spawn(move || {
                *slot = scan_best(&package, chunk_start, chunk_end, hash_blake3, true);
            });
        }
    });

    let mut best: Option<FoundShare> = None;
    for candidate in per_thread.into_iter().flatten() {
        if best
            .as_ref()
            .map(|b| is_hash_better(&candidate.hash, &b.hash, true))
            .unwrap_or(true)
        {
            best = Some(candidate);
        }
    }
    best
}

fn scan_blake3_alph_best(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    if start >= end {
        return None;
    }

    let cpus = std::thread::available_parallelism()
        .map(|n| n.get() as u64)
        .unwrap_or(1);
    let range = end - start;
    let threads = cpus.min(range);
    let chunk = (range + threads - 1) / threads;

    let mut per_thread: Vec<Option<FoundShare>> = vec![None; threads as usize];

    std::thread::scope(|s| {
        for (idx, slot) in per_thread.iter_mut().enumerate() {
            let idx = idx as u64;
            let chunk_start = start + idx * chunk;
            let chunk_end = chunk_start.saturating_add(chunk).min(end);
            if chunk_start >= chunk_end {
                continue;
            }
            let package = job.clone();
            s.spawn(move || {
                let header = &package.header_bytes;
                let extranonce1 = &package.extranonce1;
                let mut best: Option<FoundShare> = None;
                for nonce in chunk_start..chunk_end {
                    let hash = hash_blake3_alph(header, extranonce1, nonce);
                    if best
                        .as_ref()
                        .map(|b| is_hash_better(&hash, &b.hash, false))
                        .unwrap_or(true)
                    {
                        best = Some(FoundShare {
                            external_job_id: package.external_job_id.clone(),
                            nonce,
                            hash,
                        });
                    }
                }
                *slot = best;
            });
        }
    });

    let mut best: Option<FoundShare> = None;
    for candidate in per_thread.into_iter().flatten() {
        if best
            .as_ref()
            .map(|b| is_hash_better(&candidate.hash, &b.hash, false))
            .unwrap_or(true)
        {
            best = Some(candidate);
        }
    }
    best
}

fn scan_kheavyhash_best(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let timestamp = job.timestamp;
    let extranonce1 = &job.extranonce1;

    let mut best: Option<FoundShare> = None;
    for nonce in start..end {
        let hash = if !extranonce1.is_empty() && extranonce1.len() < 8 {
            hash_kheavyhash_extranonce(header, timestamp, extranonce1, nonce)
        } else {
            hash_kheavyhash(header, timestamp, nonce)
        };
        if best
            .as_ref()
            .map(|b| is_hash_better(&hash, &b.hash, false))
            .unwrap_or(true)
        {
            best = Some(FoundShare {
                external_job_id: job.external_job_id.clone(),
                nonce,
                hash,
            });
        }
    }
    best
}

fn scan_autolykos_best(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let height = job.timestamp as u32;

    let mut best: Option<FoundShare> = None;
    for nonce in start..end {
        let hash = hash_autolykos(header, nonce, height);
        if best
            .as_ref()
            .map(|b| is_hash_better(&hash, &b.hash, false))
            .unwrap_or(true)
        {
            best = Some(FoundShare {
                external_job_id: job.external_job_id.clone(),
                nonce,
                hash,
            });
        }
    }
    best
}

fn scan_kawpow_best(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let mut header = [0u8; 32];
    let len = job.header_bytes.len().min(32);
    header[..len].copy_from_slice(&job.header_bytes[..len]);
    let height = job.timestamp as u32;

    let mut best: Option<FoundShare> = None;
    for nonce in start..end {
        let (_mix, hash) = hash_kawpow(&header, nonce, height);
        if best
            .as_ref()
            .map(|b| is_hash_better(&hash, &b.hash, false))
            .unwrap_or(true)
        {
            best = Some(FoundShare {
                external_job_id: job.external_job_id.clone(),
                nonce,
                hash,
            });
        }
    }
    best
}

fn scan_ethash_best(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let height = job.timestamp as u32;

    let mut best: Option<FoundShare> = None;
    for nonce in start..end {
        let hash = hash_ethash(header, nonce, height);
        if best
            .as_ref()
            .map(|b| is_hash_better(&hash, &b.hash, false))
            .unwrap_or(true)
        {
            best = Some(FoundShare {
                external_job_id: job.external_job_id.clone(),
                nonce,
                hash,
            });
        }
    }
    best
}

fn scan_verushash_best(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;

    let en1_len = job.extranonce1.len();
    let nonce_field_offset = 108 + en1_len;
    let nonce_space_blob_offset = 143 + 1329 + en1_len;
    let mut work_header = header.to_vec();

    let mut best: Option<FoundShare> = None;
    for nonce in start..end {
        let nonce_le = (nonce as u32).to_le_bytes();
        if nonce_field_offset + 4 <= work_header.len() {
            work_header[nonce_field_offset..nonce_field_offset + 4]
                .copy_from_slice(&nonce_le);
        }
        if nonce_space_blob_offset + 4 <= work_header.len() {
            work_header[nonce_space_blob_offset..nonce_space_blob_offset + 4]
                .copy_from_slice(&nonce_le);
        }
        let hash = crate::external_hashers::hash_verushash_header(&work_header);
        if best
            .as_ref()
            .map(|b| is_hash_better(&hash, &b.hash, false))
            .unwrap_or(true)
        {
            best = Some(FoundShare {
                external_job_id: job.external_job_id.clone(),
                nonce,
                hash,
            });
        }
    }
    best
}

// ── Pearl (PRL) — PearlHash PoUW ─────────────────────────────────────

/// CPU scan for Pearl shares using the simplified BLAKE3 placeholder hash.
///
/// Pearl's real PoUW algorithm involves INT8 MatMul + noise + BLAKE3 proof
/// extraction, which requires GPU kernels. This CPU scan uses the BLAKE3
/// placeholder for protocol testing and share verification.
fn scan_pearl(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let target = &job.target_bytes;

    // Pearl header is 76 bytes (incomplete block header from pool).
    // The hash is computed over header || nonce_le.
    let mut h32 = [0u8; 32];
    let len = header.len().min(32);
    h32[..len].copy_from_slice(&header[..len]);

    for nonce in start..end {
        let hash = crate::external_hashers::hash_pearl(&h32, nonce);
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

/// CPU scan for the best Pearl share (lowest hash) in the range.
fn scan_pearl_best(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let mut h32 = [0u8; 32];
    let len = header.len().min(32);
    h32[..len].copy_from_slice(&header[..len]);

    let mut best: Option<FoundShare> = None;
    for nonce in start..end {
        let hash = crate::external_hashers::hash_pearl(&h32, nonce);
        if best
            .as_ref()
            .map(|b| is_hash_better(&hash, &b.hash, false))
            .unwrap_or(true)
        {
            best = Some(FoundShare {
                external_job_id: job.external_job_id.clone(),
                nonce,
                hash,
            });
        }
    }
    best
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
        // DCR uses little-endian hash comparison (DCP-0011).
        assert!(meets_target_little_endian(&share.hash, &job.target_bytes));
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
