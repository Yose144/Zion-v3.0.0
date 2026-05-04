//! CPU mining worker — parallel nonce scanning with rayon.
//!
//! Calls `cosmic_harmony_with_height()` per nonce and checks against
//! the share target. Returns the first nonce whose hash ≤ target.

use rayon::prelude::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use zion_core::{BlockCandidate, DifficultyTarget, MiningJob};

/// Result of scanning a nonce range.
#[derive(Debug)]
pub struct ScanResult {
    pub nonce: u64,
    pub hash: [u8; 32],
    pub depth: u64, // how many nonces scanned before hit
}

/// Scan the job's nonce range across `threads` in parallel.
/// Returns the first nonce whose hash meets `target`, or None.
pub fn scan_nonces(job: &MiningJob, target: &DifficultyTarget, threads: usize) -> Option<ScanResult> {
    let threads = threads.max(1);
    if threads == 1 {
        return scan_sequential(job, target, &AtomicBool::new(false));
    }

    let chunk = job.nonce_count / threads as u64;
    if chunk == 0 {
        return scan_sequential(job, target, &AtomicBool::new(false));
    }

    let cancel = Arc::new(AtomicBool::new(false));

    (0..threads)
        .into_par_iter()
        .find_map_any(|tid| {
            let start = job.start_nonce.wrapping_add(tid as u64 * chunk);
            let count = if tid == threads - 1 {
                job.nonce_count - (tid as u64 * chunk)
            } else {
                chunk
            };

            let sub = MiningJob {
                job_id: job.job_id,
                header: job.header,
                target: *target,
                start_nonce: start,
                nonce_count: count,
                height: job.height,
            };

            let result = scan_sequential(&sub, target, &cancel);
            if result.is_some() {
                cancel.store(true, Ordering::Relaxed);
            }
            result
        })
}

fn scan_sequential(
    job: &MiningJob,
    target: &DifficultyTarget,
    cancel: &AtomicBool,
) -> Option<ScanResult> {
    for offset in 0..job.nonce_count {
        if offset % 4096 == 0 && cancel.load(Ordering::Relaxed) {
            return None;
        }
        let nonce = job.start_nonce.wrapping_add(offset);
        let candidate = BlockCandidate {
            header: job.header,
            nonce,
            height: job.height,
        };
        let hash = candidate.hash();
        if target.allows(&hash) {
            return Some(ScanResult {
                nonce,
                hash,
                depth: offset + 1,
            });
        }
    }
    None
}

/// Detect thread count from ZION_THREADS env var or CPU count.
pub fn detect_threads() -> usize {
    if let Ok(val) = std::env::var("ZION_THREADS") {
        if let Ok(n) = val.parse::<usize>() {
            if n > 0 {
                return n;
            }
        }
    }
    let cpus = num_cpus::get();
    // Leave 1 core free for OS / pool I/O
    if cpus > 2 { cpus - 1 } else { 1 }
}
