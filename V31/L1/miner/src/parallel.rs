use rayon::prelude::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use zion_core::{BlockCandidate, MiningJob, MiningSolution};
use zion_cosmic_harmony::{cosmic_harmony_with_height, deeksha_lite, deeksha_lite_fire};

/// Hash function selector for multi-algo support.
///
/// Supports all ZION PoW algorithms plus external merge-mining algorithms
/// via `zion-auxpow` (pure-Rust) or `zion-native-ffi` (C acceleration).
///
/// # Algorithm dispatch priority
///
/// For each external algorithm, the function checks in order:
/// 1. `zion-native-ffi` C implementation (if `native-*` feature enabled)
/// 2. `zion-auxpow` pure-Rust fallback (always available)
///
/// # Supported algorithms
///
/// | Algorithm             | Source         | Coins           |
/// |-----------------------|----------------|-----------------|
/// | `deeksha_chv3`        | cosmic-harmony | ZION (unified)  |
/// | `deeksha_lite_v1`     | cosmic-harmony | ZION            |
/// | `deeksha_lite_fire`   | cosmic-harmony | ZION (Metal)    |
/// | `cosmic_harmony_v3`   | cosmic-harmony | ZION (full)     |
/// | `blake3`              | auxpow/native  | DCR, ALPH       |
/// | `kheavyhash`          | auxpow/native  | KAS             |
/// | `autolykos`           | auxpow/native  | ERG             |
/// | `kawpow`              | auxpow/native  | RVN, CLORE      |
/// | `ethash` / `etchash`  | auxpow/native  | ETC             |
/// | `verushash`           | native-ffi     | VRSC            |
/// | `randomx`             | native-ffi     | XMR, ZEPH       |
pub fn hash_candidate(candidate: &BlockCandidate, algorithm: &str) -> [u8; 32] {
    let header_bytes = candidate.header.to_bytes();
    let nonce = candidate.nonce;
    let height = candidate.height;

    match algorithm {
        // ── ZION PoW algorithms ──────────────────────────────────
        "deeksha_chv3" | "deeksha_lite_v1" => deeksha_lite::deeksha_lite(&header_bytes, nonce),
        "deeksha_lite_fire" => deeksha_lite_fire::deeksha_lite_fire(&header_bytes, nonce),
        "cosmic_harmony_v3" | "cosmic_harmony_ekam_deeksha_v2" => {
            cosmic_harmony_with_height(&header_bytes, nonce, height).data
        }

        // ── External algorithms: Blake3 (DCR, ALPH) ──────────────
        "blake3" => {
            #[cfg(feature = "native-blake3-algo")]
            {
                return zion_native_ffi::blake3_algo::mine(&header_bytes, nonce);
            }
            #[allow(unreachable_code)]
            {
                crate::auxpow::hash_blake3(&header_bytes, 0, nonce)
            }
        }

        // ── External algorithms: kHeavyHash (KAS) ────────────────
        // For KAS jobs the pool sends the block timestamp in the `height` field.
        // The pre_pow_hash is in the first 32 bytes of the header (the pool
        // pads the 32-byte pre_pow_hash to 80 bytes for the MiningHeader).
        "kheavyhash" | "kheavy" => {
            let pre_pow_hash = &header_bytes[..32];
            #[cfg(feature = "native-kheavyhash")]
            {
                // Native FFI currently lacks a timestamp argument; fall back to
                // the Rust implementation so the correct timestamp is used.
            }
            #[allow(unreachable_code)]
            {
                crate::auxpow::hash_kheavyhash(pre_pow_hash, height, nonce)
            }
        }

        // ── External algorithms: Autolykos v2 (ERG) ─────────────
        "autolykos" => {
            #[cfg(feature = "native-autolykos")]
            {
                return zion_native_ffi::autolykos::hash(&header_bytes, nonce, height as u32);
            }
            #[allow(unreachable_code)]
            {
                crate::auxpow::hash_autolykos(&header_bytes, nonce, height as u32)
            }
        }

        // ── External algorithms: KawPow (RVN, CLORE) ────────────
        "kawpow" => {
            let mut h32 = [0u8; 32];
            let len = header_bytes.len().min(32);
            h32[..len].copy_from_slice(&header_bytes[..len]);
            #[cfg(feature = "native-kawpow")]
            {
                let (_mix, final_hash) = zion_native_ffi::kawpow::hash(&h32, nonce, height as u32);
                return final_hash;
            }
            #[allow(unreachable_code)]
            {
                let (_mix, final_hash) = crate::auxpow::hash_kawpow(&h32, nonce, height as u32);
                final_hash
            }
        }

        // ── External algorithms: Ethash/EtcHash (ETC) ───────────
        "ethash" | "etchash" => {
            #[cfg(feature = "native-etchash")]
            {
                zion_native_ffi::etchash::init();
                return zion_native_ffi::etchash::hash(&header_bytes, nonce, height as u32);
            }
            #[allow(unreachable_code)]
            {
                crate::auxpow::hash_ethash(&header_bytes, nonce, height as u32)
            }
        }

        // ── External algorithms: VerusHash v2.2 (VRSC) ──────────
        "verushash" => {
            #[cfg(feature = "native-verushash")]
            {
                zion_native_ffi::verushash::init();
                return zion_native_ffi::verushash::hash(&header_bytes, nonce);
            }
            #[allow(unreachable_code)]
            {
                // No pure-Rust fallback for VerusHash — use Blake3 as placeholder
                deeksha_lite::deeksha_lite(&header_bytes, nonce)
            }
        }

        // ── External algorithms: RandomX (XMR, ZEPH) ────────────
        "randomx" => {
            #[cfg(feature = "native-randomx")]
            {
                zion_native_ffi::randomx::init();
                return zion_native_ffi::randomx::hash(&header_bytes, nonce);
            }
            #[allow(unreachable_code)]
            {
                // No pure-Rust fallback for RandomX — use Blake3 as placeholder
                deeksha_lite::deeksha_lite(&header_bytes, nonce)
            }
        }

        // ── Fallback: assume cosmic_harmony_v3 for unknown ───────
        _ => cosmic_harmony_with_height(&header_bytes, nonce, height).data,
    }
}

/// Multi-threaded nonce scan using rayon thread pool.
///
/// Divides `job.nonce_count` into `threads` equal chunks, scans each in
/// parallel, and returns the first solution found (cancelling others via
/// an `AtomicBool` flag).
pub fn parallel_scan_nonce_range(
    job: MiningJob,
    threads: usize,
    algorithm: &str,
) -> Option<MiningSolution> {
    let threads = threads.max(1);
    if threads == 1 {
        return sequential_scan(job, &AtomicBool::new(false), algorithm);
    }

    let chunk_size = job.nonce_count / threads as u64;
    if chunk_size == 0 {
        return sequential_scan(job, &AtomicBool::new(false), algorithm);
    }

    let cancelled = Arc::new(AtomicBool::new(false));

    let result: Option<MiningSolution> = (0..threads).into_par_iter().find_map_any(|thread_idx| {
        let start = job.start_nonce.wrapping_add(thread_idx as u64 * chunk_size);
        let count = if thread_idx == threads - 1 {
            // Last thread gets the remainder
            job.nonce_count - (thread_idx as u64 * chunk_size)
        } else {
            chunk_size
        };

        let sub_job = MiningJob {
            job_id: job.job_id,
            header: job.header,
            target: job.target,
            start_nonce: start,
            nonce_count: count,
            height: job.height,
        };

        let sol = sequential_scan(sub_job, &cancelled, algorithm);
        if sol.is_some() {
            cancelled.store(true, Ordering::Relaxed);
        }
        sol
    });

    result
}

/// Sequential single-thread scan respecting a cancellation flag.
fn sequential_scan(
    job: MiningJob,
    cancelled: &AtomicBool,
    algorithm: &str,
) -> Option<MiningSolution> {
    for offset in 0..job.nonce_count {
        if offset % 4096 == 0 && cancelled.load(Ordering::Relaxed) {
            return None;
        }
        let nonce = job.start_nonce.wrapping_add(offset);
        let candidate = BlockCandidate {
            header: job.header,
            nonce,
            height: job.height,
        };
        let hash = hash_candidate(&candidate, algorithm);
        if job.target.allows(&hash) {
            return Some(MiningSolution {
                job_id: job.job_id,
                candidate,
                hash,
            });
        }
    }
    None
}

/// Detect optimal thread count from env or CPU cores.
pub fn detect_threads() -> usize {
    match std::env::var("ZION_THREADS") {
        Ok(v) => v.parse::<usize>().unwrap_or(1).max(1),
        Err(_) => num_cpus::get().max(1),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zion_core::{DifficultyTarget, MiningHeader};

    fn test_header() -> MiningHeader {
        MiningHeader {
            version: 3,
            previous_hash: [0x11; 32],
            merkle_root: [0x22; 32],
            timestamp: 1_762_000_200,
            difficulty_bits: 0x1f00ffff,
        }
    }

    #[test]
    fn parallel_scan_finds_same_as_sequential() {
        let job = MiningJob {
            job_id: 1,
            header: test_header(),
            target: DifficultyTarget::MAX,
            start_nonce: 0,
            nonce_count: 100,
            height: 0,
        };

        let seq = sequential_scan(
            job,
            &AtomicBool::new(false),
            "cosmic_harmony_ekam_deeksha_v2",
        );
        let par = parallel_scan_nonce_range(job, 4, "cosmic_harmony_ekam_deeksha_v2");

        assert!(seq.is_some());
        assert!(par.is_some());
        // Both must find nonce 0 (MAX target accepts any hash)
        assert_eq!(seq.unwrap().candidate.nonce, 0);
        assert_eq!(par.unwrap().candidate.nonce, 0);
    }

    #[test]
    fn parallel_scan_with_one_thread_equals_sequential() {
        let job = MiningJob {
            job_id: 1,
            header: test_header(),
            target: DifficultyTarget::MAX,
            start_nonce: 42,
            nonce_count: 10,
            height: 0,
        };

        let seq = sequential_scan(
            job,
            &AtomicBool::new(false),
            "cosmic_harmony_ekam_deeksha_v2",
        );
        let par = parallel_scan_nonce_range(job, 1, "cosmic_harmony_ekam_deeksha_v2");

        assert_eq!(seq.unwrap().candidate.nonce, par.unwrap().candidate.nonce,);
    }

    #[test]
    fn parallel_scan_respects_cancellation() {
        let cancelled = AtomicBool::new(true);
        let job = MiningJob {
            job_id: 1,
            header: test_header(),
            target: DifficultyTarget::MAX,
            start_nonce: 0,
            nonce_count: 1_000_000,
            height: 0,
        };

        // With cancelled=true up front, should return None quickly
        let result = sequential_scan(job, &cancelled, "cosmic_harmony_ekam_deeksha_v2");
        assert!(result.is_none());
    }

    #[test]
    fn deeksha_lite_produces_different_hashes() {
        let header = test_header();
        let nonce = 42u64;

        let hash_ekam =
            zion_cosmic_harmony::cosmic_harmony_ekam_deeksha_v3(&header.to_bytes(), nonce, 0).data;
        let hash_lite = deeksha_lite::deeksha_lite(&header.to_bytes(), nonce);

        assert_ne!(
            hash_ekam, hash_lite,
            "DeekshaLite must produce different hashes than ekam_v3"
        );
    }
}
