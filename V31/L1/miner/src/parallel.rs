use rayon::prelude::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use zion_core::{BlockCandidate, MiningJob, MiningSolution};
use zion_cosmic_harmony::algorithm::ekam_deeksha::EkamDeeksha;

/// Dispatch a single hash for the given algorithm.
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
/// `coin` is used only as a final fallback for unknown/placeholder
/// algorithms via `crate::auxpow::hasher::hash_for_coin`.
pub fn dispatch_algorithm(
    coin: zion_cosmic_harmony::ExternalCoin,
    header: &[u8],
    nonce: u64,
    height: u64,
    extranonce: &[u8],
    algorithm: &str,
) -> [u8; 32] {
    match algorithm {
        // ── ZION PoW: Ekam Deeksha v3.2 ──────────────────────────
        "ekam_deeksha"
        | "deeksha_lite_v1"
        | "deeksha_lite"
        | "deeksha_chv3"
        | "deeksha_lite_fire"
        | "cosmic_harmony_v3"
        | "cosmic_harmony_ekam_deeksha_v2" => EkamDeeksha::hash_bytes(header, nonce),

        // ── External algorithms: Blake3 (DCR, ALPH) ──────────────
        "blake3" | "blake3_dcr" => crate::auxpow::hash_blake3(header, 0, nonce),
        "blake3_alph" => crate::auxpow::hash_blake3_alph(header, extranonce, nonce),

        // ── External algorithms: kHeavyHash (KAS) ────────────────
        // For KAS jobs the pool sends the block timestamp in the `height` field.
        // The pre_pow_hash is in the first 32 bytes of the header.
        "kheavyhash" | "kheavy" | "kheavyhash_kas" => {
            let pre_pow_hash = &header[..header.len().min(32)];
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
        "autolykos" | "autolykos_erg" => {
            #[cfg(feature = "native-autolykos")]
            {
                return zion_native_ffi::autolykos::hash(header, nonce, height as u32);
            }
            #[allow(unreachable_code)]
            {
                crate::auxpow::hash_autolykos(header, nonce, height as u32)
            }
        }

        // ── External algorithms: KawPow (RVN, CLORE, EVR, MEWC, QUAI) ─
        "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc" | "kawpow_quai"
        | "meowpow" | "meowpow_mewc" | "evrprogpow" | "evrprogpow_evr" => {
            let mut h32 = [0u8; 32];
            let len = header.len().min(32);
            h32[..len].copy_from_slice(&header[..len]);
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
        "ethash" | "etchash" | "ethash_etc" => {
            #[cfg(feature = "native-etchash")]
            {
                zion_native_ffi::etchash::init();
                return zion_native_ffi::etchash::hash(header, nonce, height as u32);
            }
            #[allow(unreachable_code)]
            {
                crate::auxpow::hash_ethash(header, nonce, height as u32)
            }
        }

        // ── External algorithms: VerusHash v2.2 (VRSC) ──────────
        "verushash" | "verushash_vrsc" | "verus" => {
            #[cfg(feature = "native-verushash")]
            {
                zion_native_ffi::verushash::init();
                return zion_native_ffi::verushash::hash(header, nonce);
            }
            #[allow(unreachable_code)]
            {
                crate::auxpow::hash_verushash(header, nonce)
            }
        }

        // ── External algorithms: ZelHash (FLUX) ─────────────────
        "zelhash" | "zelhash_flux" | "zel" => crate::auxpow::hash_zelhash(header, nonce),

        // ── External algorithms: PearlHash (PRL) ─────────────────
        "pearl" | "pearlhash" => {
            let mut h32 = [0u8; 32];
            let len = header.len().min(32);
            h32[..len].copy_from_slice(&header[..len]);
            crate::auxpow::hash_pearl(&h32, nonce)
        }

        // ── External algorithms: KeryxHash (KRX) ─────────────────
        "keryx" | "keryxhash" => {
            let pre_pow_hash = &header[..header.len().min(32)];
            crate::auxpow::hash_keryxhash(pre_pow_hash, height, nonce, height)
        }

        // ── External algorithms: RandomX (XMR, ZEPH) / GhostRider (RTM) ─
        // No pure-Rust fallback — use a fast Blake3 placeholder.
        "randomx" | "randomx_xmr" | "randomx_zeph" | "ghostrider" | "ghostrider_rtm" => {
            #[cfg(feature = "native-randomx")]
            {
                if algorithm == "randomx" || algorithm.starts_with("randomx_") {
                    zion_native_ffi::randomx::init();
                    return zion_native_ffi::randomx::hash(header, nonce);
                }
            }
            let mut input = Vec::with_capacity(header.len().saturating_add(8));
            input.extend_from_slice(header);
            input.extend_from_slice(&nonce.to_le_bytes());
            *blake3::hash(&input).as_bytes()
        }

        // ── Fallback: use the generic AuxPoW hasher for unknown coins ─
        _ => crate::auxpow::hasher::hash_for_coin(coin, header, nonce),
    }
}

/// Hash function selector for multi-algo support.
///
/// Supports all ZION PoW algorithms plus external merge-mining algorithms
/// via `zion-auxpow` (pure-Rust) or `zion-native-ffi` (C acceleration).
pub fn hash_candidate(candidate: &BlockCandidate, algorithm: &str) -> [u8; 32] {
    dispatch_algorithm(
        zion_cosmic_harmony::ExternalCoin::Bitcoin,
        &candidate.header.to_bytes(),
        candidate.nonce,
        candidate.height,
        &[],
        algorithm,
    )
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

/// Parse the stratum `ntime` hex string into a u64 timestamp/height.
fn parse_ntime(ntime: &str) -> u64 {
    let ntime = ntime
        .trim()
        .trim_start_matches("0x")
        .trim_start_matches("0X");
    u64::from_str_radix(ntime, 16).unwrap_or(0)
}

/// Hash a candidate for the given algorithm, returning the final PoW hash and
/// an optional mix hash for Ethash/KawPow/ProgPoW-style submissions.
fn hash_auxpow(
    coin: zion_cosmic_harmony::ExternalCoin,
    header: &[u8],
    nonce: u64,
    height: u64,
    extranonce: &[u8],
    algorithm: &str,
) -> ([u8; 32], Option<[u8; 32]>) {
    if algorithm.contains("ethash") || algorithm.contains("etchash") {
        let mut h32 = [0u8; 32];
        let copy_len = header.len().min(32);
        h32[..copy_len].copy_from_slice(&header[..copy_len]);
        return (crate::auxpow::hasher::hash_ethash(&h32, nonce, height as u32), None);
    }

    if algorithm.contains("kawpow")
        || algorithm.contains("progpow")
        || algorithm == "meowpow"
        || algorithm == "evrprogpow"
    {
        let mut h32 = [0u8; 32];
        let copy_len = header.len().min(32);
        h32[..copy_len].copy_from_slice(&header[..copy_len]);
        let (mix, hash) = crate::auxpow::hasher::hash_kawpow(&h32, nonce, height as u32);
        return (hash, Some(mix));
    }

    (dispatch_algorithm(coin, header, nonce, height, extranonce, algorithm), None)
}

/// Find a valid share for an AuxPoW `Job` using the CPU parallel scanner.
///
/// This is the CPU fallback used by `MinerRuntime` when no GPU backend is
/// configured or available.  It dispatches to the correct hashing algorithm
/// via `dispatch_algorithm`.
pub fn find_auxpow_share(
    job: &crate::auxpow::Job,
    threads: usize,
    nonce_count: u64,
) -> Option<crate::auxpow::Share> {
    find_auxpow_share_from(job, threads, nonce_count, 0)
}

/// Like `find_auxpow_share` but starts scanning from `start_nonce` instead of 0.
pub fn find_auxpow_share_from(
    job: &crate::auxpow::Job,
    threads: usize,
    nonce_count: u64,
    start_nonce: u64,
) -> Option<crate::auxpow::Share> {
    if nonce_count == 0 {
        return None;
    }
    let threads = threads.max(1);
    let coin = job.coin;
    let algorithm = coin.algorithm();
    // kHeavyHash (KAS) carries the block timestamp in the job height and
    // uses an extranonce1 prefix inside the 8-byte nonce.
    // DAG-based algorithms (Ethash, KawPow, ProgPoW) use the job height for
    // epoch/period derivation; the ntime field is a wall-clock timestamp.
    let is_kheavyhash = algorithm.starts_with("kheavyhash");
    let is_dag_based = algorithm.contains("ethash")
        || algorithm.contains("etchash")
        || algorithm.contains("kawpow")
        || algorithm.contains("progpow")
        || algorithm.contains("meowpow")
        || algorithm == "evrprogpow";
    let height = if is_kheavyhash || is_dag_based {
        job.height
    } else {
        parse_ntime(&job.ntime)
    };
    let extranonce = job.extranonce.clone();
    let header = job.header.clone();
    let target = job.target;
    let job_id = job.job_id.clone();
    let extranonce2 = job.extranonce2.clone();
    let ntime = job.ntime.clone();

    // Cache the first 32 bytes of the header for Ethash/KawPow/ProgPoW
    // `eth_submitWork` submissions.
    let mut header_hash = [0u8; 32];
    let copy_len = header.len().min(32);
    header_hash[..copy_len].copy_from_slice(&header[..copy_len]);

    // Build the nonce base and shift for kHeavyHash so the extranonce1
    // prefix stays in the low bytes and the scanned suffix occupies the
    // high bytes (matching KaspaStratum / 2miners).
    let (nonce_base, nonce_shift, max_suffix, nonce_count) = if is_kheavyhash {
        let en1_len = extranonce.len().min(8);
        let mut base_bytes = [0u8; 8];
        base_bytes[..en1_len].copy_from_slice(&extranonce[..en1_len]);
        let base = u64::from_le_bytes(base_bytes);
        let shift = en1_len * 8;
        let max_suffix = if en1_len == 0 {
            u64::MAX
        } else {
            (1u64 << ((8 - en1_len) * 8)).saturating_sub(1)
        };
        (base, shift, max_suffix, nonce_count.min(max_suffix.saturating_add(1)))
    } else {
        (0u64, 0usize, u64::MAX, nonce_count)
    };
    if nonce_count == 0 {
        return None;
    }

    let make_nonce = |suffix: u64| {
        if is_kheavyhash {
            nonce_base + (suffix << nonce_shift)
        } else {
            suffix
        }
    };

    // VerusHash v2.2 uses a full 1487-byte block header with a 15-byte
    // nonceSpace; the generic nonce-per-hash path cannot produce valid shares.
    if algorithm.contains("verushash") {
        return find_verushash_share(job, threads, nonce_count, start_nonce);
    }

    if threads == 1 || nonce_count < threads as u64 {
        for suffix in 0..nonce_count {
            if suffix > max_suffix {
                break;
            }
            let nonce = make_nonce(suffix);
            let (hash, mix) = hash_auxpow(coin, &header, nonce, height, &extranonce, algorithm);
            if crate::auxpow::hasher::meets_target(&hash, &target) {
                return Some(crate::auxpow::Share {
                    job_id,
                    coin,
                    nonce,
                    hash,
                    header_hash,
                    mix_hash: mix,
                    solution: None,
                    extranonce2,
                    ntime,
                });
            }
        }
        return None;
    }

    let chunk_size = nonce_count / threads as u64;
    let cancelled = Arc::new(AtomicBool::new(false));

    (0..threads).into_par_iter().find_map_any(|thread_idx| {
        let start_suffix = thread_idx as u64 * chunk_size;
        let count = if thread_idx == threads - 1 {
            nonce_count - start_suffix
        } else {
            chunk_size
        };

        for offset in 0..count {
            if offset % 4096 == 0 && cancelled.load(Ordering::Relaxed) {
                return None;
            }
            let suffix = start_suffix + offset;
            if suffix > max_suffix {
                break;
            }
            let nonce = make_nonce(suffix);
            let (hash, mix) = hash_auxpow(coin, &header, nonce, height, &extranonce, algorithm);
            if crate::auxpow::hasher::meets_target(&hash, &target) {
                cancelled.store(true, Ordering::Relaxed);
                return Some(crate::auxpow::Share {
                    job_id: job_id.clone(),
                    coin,
                    nonce,
                    hash,
                    header_hash,
                    mix_hash: mix,
                    solution: None,
                    extranonce2: extranonce2.clone(),
                    ntime: ntime.clone(),
                });
            }
        }
        None
    })
}

/// VerusHash v2.2 two-stage CPU scan.
///
/// Each rayon thread calls `hash_half` + `prepare_key` once per chunk and then
/// uses the batch `scan_nonces` FFI to search the nonce space. The returned
/// `Share` carries the full `solution_with_varint` needed by ZcashStratum.
fn find_verushash_share(
    job: &crate::auxpow::Job,
    threads: usize,
    nonce_count: u64,
    start_nonce: u64,
) -> Option<crate::auxpow::Share> {
    let threads = threads.max(1);
    let chunk_size = nonce_count / threads as u64;
    let header = job.header.clone();
    let target = job.target;
    let extranonce1 = job.extranonce.clone();
    let job_id = job.job_id.clone();
    let coin = job.coin;
    let ntime = job.ntime.clone();

    // Cache the first 32 bytes of the header for `eth_submitWork`-style
    // submissions, even though VerusHash uses the solution directly.
    let mut header_hash = [0u8; 32];
    let copy_len = header.len().min(32);
    header_hash[..copy_len].copy_from_slice(&header[..copy_len]);

    (0..threads).into_par_iter().find_map_any(|thread_idx| {
        let start = start_nonce + thread_idx as u64 * chunk_size;
        let count = if thread_idx == threads - 1 {
            nonce_count - thread_idx as u64 * chunk_size
        } else {
            chunk_size
        };
        let end = start.saturating_add(count);

        if let Some((nonce, hash, solution)) =
            crate::auxpow::hasher::mine_verushash(&header, &target, start, end, &extranonce1)
        {
            // For PBaaS v7+ the nonce field in the block header must stay as
            // en1+zeros so the pool's preHeaderHash check succeeds. The actual
            // found nonce lives in the solution nonceSpace.
            let en1_total = extranonce1
                .len()
                .min(crate::auxpow::hasher::VERUS_NONCE_FIELD_SIZE);
            let nonce2_len =
                crate::auxpow::hasher::VERUS_NONCE_FIELD_SIZE.saturating_sub(en1_total);
            let extranonce2 = "0".repeat(nonce2_len * 2);

            Some(crate::auxpow::Share {
                job_id: job_id.clone(),
                coin,
                nonce,
                hash,
                header_hash,
                mix_hash: None,
                solution: Some(solution),
                extranonce2,
                ntime: ntime.clone(),
            })
        } else {
            None
        }
    })
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
    use zion_core::{MiningHeader, V3DifficultyTarget as DifficultyTarget};
    use zion_cosmic_harmony::algorithm::ekam_deeksha::EkamDeeksha;

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
            "ekam_deeksha",
        );
        let par = parallel_scan_nonce_range(job, 4, "ekam_deeksha");

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
            "ekam_deeksha",
        );
        let par = parallel_scan_nonce_range(job, 1, "ekam_deeksha");

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
        let result = sequential_scan(job, &cancelled, "ekam_deeksha");
        assert!(result.is_none());
    }

    #[test]
    fn ekam_deeksha_is_deterministic() {
        let header = test_header();
        let nonce = 42u64;

        let h1 = EkamDeeksha::hash_bytes(&header.to_bytes(), nonce);
        let h2 = EkamDeeksha::hash_bytes(&header.to_bytes(), nonce);

        assert_eq!(h1, h2, "Ekam Deeksha must be deterministic");
    }

    #[test]
    fn find_auxpow_share_accepts_max_target() {
        let job = crate::auxpow::Job {
            job_id: "test".to_string(),
            coin: zion_cosmic_harmony::ExternalCoin::Kaspa,
            header: vec![0xAA; 32],
            target: [0xFF; 32],
            extranonce: vec![0x01],
            extranonce2: "00".to_string(),
            ntime: "00000000".to_string(),
            height: 0,
        };
        let share = find_auxpow_share(&job, 2, 1_000).expect("should find share with max target");
        assert_eq!(share.coin, job.coin);
        assert_eq!(share.job_id, job.job_id);
    }

    #[test]
    #[cfg(feature = "native-verushash")]
    fn find_auxpow_share_verushash_finds_share() {
        let en1 = [0x01u8, 0x02, 0x03, 0x04];
        let mut header = vec![0u8; crate::auxpow::hasher::VERUS_HEADER_SIZE];
        // version
        header[0..4].copy_from_slice(&[4, 0, 0, 0]);
        // nTime / nBits
        header[100..104].copy_from_slice(&[0x00, 0xC0, 0x5A, 0x5A]);
        header[104..108].copy_from_slice(&[0x1b, 0x00, 0xff, 0xff]);
        // nonce field
        header[108..108 + en1.len()].copy_from_slice(&en1);
        // varint
        header[140..143].copy_from_slice(&[0xfd, 0x40, 0x05]);
        // solution
        let sol_offset = crate::auxpow::hasher::VERUS_SOLUTION_OFFSET;
        header[sol_offset] = 7;
        header[sol_offset + 5] = 1;
        for b in &mut header[sol_offset + 8..sol_offset + 72] {
            *b = 0xAB;
        }
        // nonceSpace en1
        let ns_offset = crate::auxpow::hasher::VERUS_NONCE_SPACE_OFFSET;
        header[ns_offset..ns_offset + en1.len()].copy_from_slice(&en1);

        let job = crate::auxpow::Job {
            job_id: "vrsc_test".to_string(),
            coin: zion_cosmic_harmony::ExternalCoin::Verus,
            header,
            target: [0xFF; 32],
            extranonce: en1.to_vec(),
            extranonce2: "00".to_string(),
            ntime: "5a5ac000".to_string(),
            height: 0,
        };
        let share = find_auxpow_share(&job, 2, 1_000)
            .expect("verushash CPU scanner should find a share with max target");
        assert_eq!(share.coin, job.coin);
        assert!(share.solution.is_some());
        assert_eq!(share.solution.as_ref().unwrap().len(), 3 + 1344);
    }
}
