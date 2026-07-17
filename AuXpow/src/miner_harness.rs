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
//!   - `progpow`     — EPIC (simplified CPU fallback; use GPU kernel for real mining)
//!
//! `randomx` (XMR) is supported via the `native-randomx` feature (tevador/RandomX C++).

use anyhow::{anyhow, Result};

use crate::external_hashers::{
    clear_verushash_pbaas, hash_autolykos, hash_blake3, hash_blake3_alph, hash_ethash, hash_kawpow,
    hash_kheavyhash, hash_kheavyhash_extranonce, hash_progpow, meets_target,
    meets_target_little_endian,
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
        "progpow" | "progpow_epic" => Ok(scan_progpow(job, start, end)),
        "pearlhash" => Ok(scan_pearl(job, start, end)),
        "randomx" => Ok(scan_randomx(job, start, end)),
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
        "progpow" | "progpow_epic" => Ok(scan_progpow_best(job, start, end)),
        "pearlhash" => Ok(scan_pearl_best(job, start, end)),
        "randomx" => Ok(scan_randomx_best(job, start, end)),
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

fn scan_progpow(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let mut header = [0u8; 32];
    let len = job.header_bytes.len().min(32);
    header[..len].copy_from_slice(&job.header_bytes[..len]);
    let target = &job.target_bytes;
    let height = job.timestamp as u32;

    for nonce in start..end {
        let (_mix, hash) = hash_progpow(&header, nonce, height);
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
    // Try the optimized two-stage path first (50-100x faster per nonce).
    // Falls back to the full-hash path if the native-verushash feature is
    // unavailable or the two-stage FFI is not present.
    #[cfg(feature = "native-verushash")]
    {
        return scan_verushash_two_stage(job, start, end);
    }

    #[allow(unreachable_code)]
    scan_verushash_full(job, start, end)
}

/// Full (slow) VerusHash scan — hashes the entire 1487-byte header per nonce.
/// This is the fallback path when two-stage mining is not available.
fn scan_verushash_full(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let target = &job.target_bytes;

    // VerusCoin block header layout (1487 bytes):
    //   offset 0:   version(4)
    //   offset 4:   prevhash(32)
    //   offset 36:  merkle(32)
    //   offset 68:  reserved(32)
    //   offset 100: ntime(4)
    //   offset 104: nbits(4)
    //   offset 108: nonce(32)        ← daemon nonce for PBaaS v7+; ignored
    //   offset 140: varint(3)
    //   offset 143: solution(1344)
    //     solution offset 1329 (= blob offset 1472): nonceSpace(15) ← miner nonce
    //
    // PBaaS v7+ zeroes the non-canonical header fields before hashing, so the
    // miner's 4-byte LE nonce is written only into the solution nonceSpace.
    // VerusHash v2.2 (like Decred BLAKE3) interprets the PoW hash as a
    // little-endian 256-bit integer when comparing against the share target,
    // matching node-stratum-pool-verus / LuckPool's share validation.

    let en1_len = job.extranonce1.len();
    let nonce_space_blob_offset = 143 + 1329 + en1_len; // = 1472 + en1_len

    let mut work_header = header.to_vec();

    // CRITICAL: Clear non-canonical PBaaS v7+ header data before hashing.
    // LuckPool's verusHashV2b2 (from verushash-node) does the same:
    //   1. Checks preHeaderHash (blake2b) in solution vs header fields
    //   2. If match → clears non-canonical data → hashes
    //   3. If no match → returns 0xFF (invalid)
    // We ensure the preHeaderHash matches by sending nonce2=zeros (see
    // auxpow_client.rs submit path), so the pool clears and hashes.
    // We must also clear to get the same hash.
    clear_verushash_pbaas(&mut work_header);

    for nonce in start..end {
        let nonce_le = (nonce as u32).to_le_bytes();

        // PBaaS v7+: Only write miner_nonce into solution nonceSpace.
        // The nonce field (offset 108) is cleared by clear_verushash_pbaas
        // and doesn't affect the hash.  The pool's preHeaderHash check
        // requires the nonce field to match the original job (en1+zeros),
        // which we ensure by sending nonce2=zeros in the submit path.
        if nonce_space_blob_offset + 4 <= work_header.len() {
            work_header[nonce_space_blob_offset..nonce_space_blob_offset + 4]
                .copy_from_slice(&nonce_le);
        }

        let hash = crate::external_hashers::hash_verushash_header(&work_header);
        // VerusHash v2.2 returns the hash in raw byte order; professional pools
        // (node-stratum-pool-verus / LuckPool) interpret it as a little-endian
        // 256-bit integer when comparing against the target. Use the LE helper.
        if meets_target_little_endian(&hash, target) {
            println!(
                "VRSC_SHARE_FOUND nonce={} hash={}",
                nonce,
                hex::encode(hash),
            );
            // Debug: dump key header offsets to diagnose hash mismatch
            println!(
                "VRSC_DEBUG header_len={} version={} ntime={} nbits={} nonce_field={} varint={} sol_ver={} sol_numPBAAS={} mmr_first8={} ns_full={}",
                work_header.len(),
                hex::encode(&work_header[0..4]),
                hex::encode(&work_header[100..104]),
                hex::encode(&work_header[104..108]),
                hex::encode(&work_header[108..140]),
                hex::encode(&work_header[140..143]),
                hex::encode(&work_header[143..147]),
                work_header[148],
                hex::encode(&work_header[151..159]),
                hex::encode(&work_header[work_header.len().saturating_sub(15)..]),
            );
            println!(
                "VRSC_DEBUG target={} hash_le_reversed={}",
                hex::encode(target),
                hex::encode(hash.iter().rev().copied().collect::<Vec<u8>>()),
            );
            return Some(FoundShare {
                external_job_id: job.external_job_id.clone(),
                nonce,
                hash,
            });
        }
    }
    None
}

/// Optimized two-stage VerusHash scan (50-100x faster per nonce).
///
/// Based on the ccminer/bloxminer approach:
///   1. `hash_half` — Haraka512 chain over bytes 0..1472 → 64-byte intermediate (ONCE)
///   2. `prepare_key` — GenNewCLKey from intermediate (ONCE)
///   3. `scan_nonces` — CLHash + final Haraka512 with 15-byte nonceSpace (PER NONCE, in C++)
///
/// The entire nonce loop runs in C++ via `verushash_scan_nonces`, eliminating
/// per-nonce Rust→C++ FFI overhead.
#[cfg(feature = "native-verushash")]
fn scan_verushash_two_stage(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let target = &job.target_bytes;

    let en1_len = job.extranonce1.len();

    let mut work_header = header.to_vec();
    clear_verushash_pbaas(&mut work_header);

    // Stage 1: Compute 64-byte intermediate state (ONCE per job).
    let intermediate = zion_native_ffi::verushash::hash_half(&work_header);

    // Stage 2: Generate CLHash key from intermediate (ONCE per job).
    zion_native_ffi::verushash::prepare_key(&intermediate);

    // Pre-construct the 15-byte nonceSpace template:
    //   [0..en1_len]  = extranonce1 (from pool subscribe)
    //   [en1_len..en1_len+4] = miner_nonce (varies per nonce)
    //   [en1_len+4..15] = zeros
    let mut nonce_space = [0u8; 15];
    nonce_space[..en1_len].copy_from_slice(&job.extranonce1);
    let nonce_offset = en1_len as u32;

    // Stage 3: Batch nonce scan — entire loop in C++ (no per-nonce FFI overhead)
    if let Some((nonce, hash)) = zion_native_ffi::verushash::scan_nonces(
        &intermediate,
        &nonce_space,
        nonce_offset,
        start,
        end,
        target,
    ) {
        println!(
            "VRSC_SHARE_FOUND nonce={} hash={} (batch-scan)",
            nonce,
            hex::encode(hash),
        );
        return Some(FoundShare {
            external_job_id: job.external_job_id.clone(),
            nonce,
            hash,
        });
    }
    None
}

// ── RandomX (XMR) ─────────────────────────────────────────────────────
//
// Monero stratum blob layout (76 bytes typical):
//   offset 0:  version(4)
//   offset 7:  nonce(4)  ← miner writes here
//   rest:      hashing blob (passed to randomx_calculate_hash)
//
// The seed hash (from mining.notify) initializes the RandomX cache/dataset.
// The nonce is a 32-bit LE value written at blob offset 39 (standard Monero).
// RandomX target comparison: first 8 bytes of hash as LE u64 <= target LE u64.

fn scan_randomx(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let target = &job.target_bytes;

    // Decode seed hash for RandomX cache initialization
    let seed: Vec<u8> = job.seed_hash.clone().unwrap_or_else(|| vec![0u8; 32]);

    // Debug: log blob/seed/target info for XMR share diagnosis
    let target_le = u64::from_le_bytes(target[..8].try_into().unwrap_or([0u8; 8]));
    eprintln!(
        "scan_randomx: job_id={} blob_len={} blob[:43]={} seed={:.16}... target_le=0x{:016x} nonce_range=[{},{})",
        job.external_job_id,
        header.len(),
        hex::encode(&header[..header.len().min(43)]),
        hex::encode(&seed[..seed.len().min(16)]),
        target_le,
        start,
        end,
    );

    // Initialize RandomX with the seed (reinit only if seed changed)
    #[cfg(feature = "native-randomx")]
    {
        zion_native_ffi::randomx::init_with_seed(&seed);
    }

    // Monero blob: nonce is at offset 39 (4 bytes LE)
    // The blob from stratum already has the correct structure; we just
    // overwrite the nonce field.
    let nonce_offset = 39usize;
    let mut work_blob = header.to_vec();

    for nonce in start..end {
        let nonce_le = (nonce as u32).to_le_bytes();

        if nonce_offset + 4 <= work_blob.len() {
            work_blob[nonce_offset..nonce_offset + 4].copy_from_slice(&nonce_le);
        }

        #[cfg(feature = "native-randomx")]
        let hash = zion_native_ffi::randomx::hash(&work_blob, nonce);

        #[cfg(not(feature = "native-randomx"))]
        let hash = {
            let _ = &seed; // suppress unused warning
            crate::external_hashers::hash_blake3(&work_blob, 0, nonce)
        };

        // RandomX/Monero: compare MSB 64 bits (bytes 24-31) of 256-bit LE hash
        if crate::external_hashers::meets_randomx_target(&hash, target) {
            let hash_msb = u64::from_le_bytes(hash[24..32].try_into().unwrap());
            eprintln!(
                "XMR_SHARE_FOUND nonce={} nonce_hex={} hash={} hash_msb=0x{:016x} target_le=0x{:016x} blob_with_nonce={}",
                nonce,
                hex::encode((nonce as u32).to_le_bytes()),
                hex::encode(hash),
                hash_msb,
                target_le,
                hex::encode(&work_blob),
            );
            return Some(FoundShare {
                external_job_id: job.external_job_id.clone(),
                nonce,
                hash,
            });
        }
    }
    None
}

fn scan_randomx_best(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let header = &job.header_bytes;
    let _seed: Vec<u8> = job.seed_hash.clone().unwrap_or_else(|| vec![0u8; 32]);

    #[cfg(feature = "native-randomx")]
    {
        zion_native_ffi::randomx::init_with_seed(&_seed);
    }

    let nonce_offset = 39usize;
    let mut work_blob = header.to_vec();
    let mut best: Option<FoundShare> = None;

    for nonce in start..end {
        let nonce_le = (nonce as u32).to_le_bytes();
        if nonce_offset + 4 <= work_blob.len() {
            work_blob[nonce_offset..nonce_offset + 4].copy_from_slice(&nonce_le);
        }

        #[cfg(feature = "native-randomx")]
        let hash = zion_native_ffi::randomx::hash(&work_blob, nonce);

        #[cfg(not(feature = "native-randomx"))]
        let hash = crate::external_hashers::hash_blake3(&work_blob, 0, nonce);

        if best
            .as_ref()
            .map(|b| is_hash_better(&hash, &b.hash, true)) // RandomX = LE
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

fn scan_progpow_best(job: &JobPackage, start: u64, end: u64) -> Option<FoundShare> {
    let mut header = [0u8; 32];
    let len = job.header_bytes.len().min(32);
    header[..len].copy_from_slice(&job.header_bytes[..len]);
    let height = job.timestamp as u32;

    let mut best: Option<FoundShare> = None;
    for nonce in start..end {
        let (_mix, hash) = hash_progpow(&header, nonce, height);
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
    let nonce_space_blob_offset = 143 + 1329 + en1_len;
    let mut work_header = header.to_vec();

    // CRITICAL: Clear non-canonical data — see scan_verushash comment.
    clear_verushash_pbaas(&mut work_header);

    let mut best: Option<FoundShare> = None;
    for nonce in start..end {
        let nonce_le = (nonce as u32).to_le_bytes();
        // PBaaS v7+: Only write miner_nonce into solution nonceSpace.
        // The nonce field (offset 108) is cleared by clear_verushash_pbaas
        // and doesn't affect the hash.  The pool's preHeaderHash check
        // requires the nonce field to match the original job (en1+zeros),
        // which we ensure by sending nonce2=zeros in the submit path.
        if nonce_space_blob_offset + 4 <= work_header.len() {
            work_header[nonce_space_blob_offset..nonce_space_blob_offset + 4]
                .copy_from_slice(&nonce_le);
        }
        let hash = crate::external_hashers::hash_verushash_header(&work_header);
        if best
            .as_ref()
            .map(|b| is_hash_better(&hash, &b.hash, true))
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
            seed_hash: None,
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
            seed_hash: None,
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
            external_job_id: "job_unknown".to_string(),
            algorithm: "unknownalgo".to_string(),
            header_bytes: vec![],
            target_bytes: [0xFFu8; 32],
            timestamp: 0,
            block_number: None,
            extranonce1: Vec::new(),
            start_nonce: 0,
            nonce_count: 10,
            seed_hash: None,
        };
        let err = mine(&job, 0..10).unwrap_err();
        assert!(err.to_string().contains("unknownalgo"));
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
