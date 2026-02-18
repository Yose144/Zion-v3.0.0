use anyhow::Result;
use hex::FromHex;
use std::sync::{Arc, RwLock};
use tokio::sync::{mpsc, RwLock as AsyncRwLock};

use super::native_algos;
use super::stats::MinerStats;
use super::Algorithm;
use crate::stratum::{Job, StratumClient};

#[derive(Debug, Clone)]
struct PendingShare {
    job_id: String,
    nonce: u32,
    result_hex: String,
}

pub struct CpuMiner {
    algorithm: Algorithm,
    threads: usize,
    stats: Arc<AsyncRwLock<MinerStats>>,
    job_state: Arc<RwLock<Option<Job>>>,
    stratum: Arc<StratumClient>,
    /// Shared flag — set to true when connection is lost, mining loop checks this
    connection_alive: Arc<std::sync::atomic::AtomicBool>,
}

impl CpuMiner {
    pub fn new(
        algorithm: Algorithm,
        threads: usize,
        stats: Arc<AsyncRwLock<MinerStats>>,
        job_state: Arc<RwLock<Option<Job>>>,
        stratum: Arc<StratumClient>,
    ) -> Self {
        Self {
            algorithm,
            threads,
            stats,
            job_state,
            stratum,
            connection_alive: Arc::new(std::sync::atomic::AtomicBool::new(true)),
        }
    }

    /// Returns a clone of the connection_alive flag so the caller can set it to false
    pub fn connection_alive_flag(&self) -> Arc<std::sync::atomic::AtomicBool> {
        Arc::clone(&self.connection_alive)
    }

    pub async fn start(&self) -> Result<()> {
        let threads = self.threads.max(1);
        log::debug!("cpu {} threads — stream-aware mining started", threads);

        let (share_tx, mut share_rx) = mpsc::channel::<PendingShare>(1024);

        // Async submit loop (prevents thread explosion)
        {
            let stratum = Arc::clone(&self.stratum);
            let stats = Arc::clone(&self.stats);
            let alive = Arc::clone(&self.connection_alive);
            let job_state_submit = Arc::clone(&self.job_state);
            tokio::spawn(async move {
                log::debug!("Share submit loop started");
                let mut share_count = 0u64;
                let mut consecutive_errors = 0u32;
                let mut stale_dropped = 0u64;
                while let Some(share) = share_rx.recv().await {
                    // Bug fix: drop stale shares from old jobs before submitting.
                    // After a job switch, pending shares in the queue have the old job_id.
                    // Pool rejects them ("Does not meet target difficulty"), which triggers
                    // consecutive_errors and kills the submit loop. Skip them instead.
                    {
                        let current_job_id = job_state_submit
                            .read()
                            .expect("job_state poisoned")
                            .as_ref()
                            .map(|j| j.job_id.clone());
                        if current_job_id.as_deref() != Some(&share.job_id) {
                            stale_dropped += 1;
                            log::debug!(
                                "📤 Dropping stale share #{}: job={} (current={})",
                                stale_dropped,
                                share.job_id,
                                current_job_id.unwrap_or_default()
                            );
                            continue;
                        }
                    }
                    // Check if connection is still alive
                    if !stratum.is_connected() {
                        alive.store(false, std::sync::atomic::Ordering::Relaxed);
                        log::debug!("net connection lost");
                        break;
                    }
                    share_count += 1;
                    log::debug!("Submitting share #{}: job={}, nonce={}", share_count, share.job_id, share.nonce);
                    let accepted = match stratum
                        .submit_share(&share.job_id, share.nonce, &share.result_hex)
                        .await
                    {
                        Ok(v) => {
                            consecutive_errors = 0;
                            log::debug!("Share #{} result: accepted={}", share_count, v);
                            v
                        },
                        Err(e) => {
                            consecutive_errors += 1;
                            log::debug!("net submit error #{}: {}", consecutive_errors, e);
                            if consecutive_errors >= 3 {
                                log::debug!("too many errors — reconnecting");
                                alive.store(false, std::sync::atomic::Ordering::Relaxed);
                                break;
                            }
                            false
                        }
                    };

                    let mut stats_guard = stats.write().await;
                    if accepted {
                        stats_guard.share_accepted();
                        stats_guard.print_accepted();
                    } else {
                        stats_guard.share_rejected();
                        stats_guard.print_rejected("low difficulty share");
                    }
                }
                log::debug!("Share submit loop ended");
            });
        }

        // Mining workers: partition nonce space by worker_index.
        // Note: VerusHash is forced to 1 effective worker by default (stability).
        for worker_index in 0..threads {
            let algorithm = self.algorithm;
            let stats = Arc::clone(&self.stats);
            let job_state = Arc::clone(&self.job_state);
            let alive = Arc::clone(&self.connection_alive);
            let share_tx_clone = share_tx.clone();
            let worker_count = threads;

            tokio::task::spawn_blocking(move || {
                Self::mining_loop(
                    algorithm,
                    stats,
                    job_state,
                    share_tx_clone,
                    alive,
                    worker_index as u32,
                    worker_count as u32,
                );
            });
        }
        // Drop our copy so the channel closes when mining thread exits
        drop(share_tx);

        Ok(())
    }

    fn mining_loop(
        algorithm: Algorithm,
        stats: Arc<AsyncRwLock<MinerStats>>,
        job_state: Arc<RwLock<Option<Job>>>,
        share_tx: mpsc::Sender<PendingShare>,
        connection_alive: Arc<std::sync::atomic::AtomicBool>,
        worker_index: u32,
        worker_count: u32,
    ) {
        let worker_count = worker_count.max(1);
        let worker_index = worker_index.min(worker_count - 1);
        #[inline]
        fn parse_target_be32(target_hex: &str) -> [u8; 32] {
            let t = target_hex.trim_start_matches("0x").trim();
            let mut out = [0u8; 32];
            if t.is_empty() {
                return out;
            }
            if let Ok(tbytes) = Vec::from_hex(t) {
                let start = 32usize.saturating_sub(tbytes.len());
                out[start..].copy_from_slice(&tbytes[..tbytes.len().min(32)]);
            }
            out
        }

        #[inline]
        fn meets_target_verushash(hash_le: &[u8; 32], target_be: &[u8; 32]) -> bool {
            // Compare LE hash to BE target without allocations.
            // Equivalent to: reverse(hash_le) <= target_be (lexicographically, BE).
            for i in 0..32 {
                let a = hash_le[31 - i];
                let b = target_be[i];
                if a < b {
                    return true;
                }
                if a > b {
                    return false;
                }
            }
            true
        }

        #[derive(Debug, Clone)]
        struct VerusJobCtx {
            /// Full header buffer to hash: prefix(108) + nonce(32) + solution(...)
            /// We mutate the nonce bytes in-place per attempted nonce.
            buf: Vec<u8>,
            /// If PBaaS v7+: offset points to counting nonce bytes (4B LE) in nonceSpace.
            /// Otherwise: offset points to the 32B header nonce field.
            nonce_off: usize,
            is_pbaas_v7: bool,
            nonce32_base: [u8; 32],
            nonce32_en_take: usize,
            extranonce: Vec<u8>,
        }

        let stream_switch_enabled = std::env::var("ZION_ENABLE_STREAM_SWITCH")
            .map(|v| {
                let v = v.trim().to_ascii_lowercase();
                v == "1" || v == "true" || v == "yes"
            })
            .unwrap_or(false);

        // Each worker starts at a distinct nonce offset (to avoid overlap).
        let mut nonce_start = worker_index;
        // Active algorithm — can change dynamically when pool switches stream
        let mut active_algorithm = algorithm;
        let mut batch_size = Self::batch_size_for_algo(active_algorithm);
        let mut last_job_id: Option<String> = None;
        let mut last_seed_hash: Option<String> = None;
        let mut compute_error_logged = false;
        let mut last_stats_flush = std::time::Instant::now();
        // Per-blob nonce bookmarks: when we switch away from a job, save our
        // nonce position so we can resume where we left off when we return.
        // Without this, stream switches (CH→RandomX→CH) reset nonce to 0 and
        // cause Duplicate Share rejections because the same nonces get re-hashed.
        let mut nonce_bookmarks: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
        // Cached Verus job context (rebuilt on job change)
        let mut verus_ctx: Option<(String, VerusJobCtx)> = None;
        // Cached decoded blob for current job_id (avoid hex decode every batch)
        let mut blob_job_id: Option<String> = None;
        let mut blob_bytes: Vec<u8> = Vec::new();
        // Cached Verus target bytes for current job (avoid parse+alloc per nonce)
        let mut verus_target_job_id: Option<String> = None;
        let mut verus_target_be: [u8; 32] = [0u8; 32];

        loop {
            let job = {
                let guard = job_state.read().expect("job_state poisoned");
                guard.clone()
            };

            let Some(job) = job else {
                std::thread::sleep(std::time::Duration::from_millis(250));
                continue;
            };

            if last_job_id.as_deref() != Some(job.job_id.as_str()) {
                // Save current nonce position for the old job — we may return
                // to it after a stream switch (e.g. CH → RandomX → CH).
                if let Some(old_id) = last_job_id.take() {
                    let bk_key = Self::bookmark_key(&old_id);
                    nonce_bookmarks.insert(bk_key, nonce_start);
                }

                // For RandomX: external pools (MoneroOcean) send a new job_id
                // every ~30s even though seed_hash stays the same.  We must NOT
                // reset nonce to 0 each time or we'll keep re-hashing the same
                // nonces and never cover enough search space to find a share.
                // Only reset nonce when the seed_hash actually changes (new block).
                let same_seed = matches!(active_algorithm, Algorithm::RandomX)
                    && last_seed_hash.as_deref() == job.seed_hash.as_deref().filter(|s| !s.is_empty());
                if !same_seed {
                    // Check if we have a saved bookmark for this job
                    let bk_key = Self::bookmark_key(&job.job_id);
                    nonce_start = nonce_bookmarks
                        .get(bk_key.as_str())
                        .copied()
                        .unwrap_or(worker_index);
                    log::debug!("nonce resume: job={} bk_key={} → start={}", job.job_id, bk_key, nonce_start);
                }
                last_job_id = Some(job.job_id.clone());
                last_seed_hash = job.seed_hash.clone();
                compute_error_logged = false;

                // Decode blob hex ONCE per job_id and cache it for subsequent batches.
                let blob_hex = job.blob.trim_start_matches("0x");
                match Vec::from_hex(blob_hex) {
                    Ok(b) => {
                        blob_job_id = Some(job.job_id.clone());
                        blob_bytes = b;
                    }
                    Err(e) => {
                        log::debug!("Failed to parse blob hex: {}", e);
                        std::thread::sleep(std::time::Duration::from_millis(250));
                        continue;
                    }
                }

                // Cache Verus target bytes ONCE per job_id.
                if matches!(active_algorithm, Algorithm::VerusHash) {
                    verus_target_job_id = Some(job.job_id.clone());
                    verus_target_be = parse_target_be32(job.target.as_str());
                }

                // RandomX: initialize dataset/VM key from pool seed_hash.
                // MoneroOcean sends a stable `seed_hash` for the epoch; job_id changes frequently.
                // If we don't initialize with the pool key, we'll compute invalid hashes and the
                // pool will reject shares as "low difficulty" / "unauthenticated".
                if matches!(active_algorithm, Algorithm::RandomX) {
                    let seed_key = job.seed_hash.as_deref()
                        .filter(|s| !s.is_empty() && s.len() >= 16)
                        .and_then(|s| hex::decode(s).ok());

                    if let Some(key) = seed_key {
                        if let Err(e) = native_algos::init_randomx_with_key(&key) {
                            log::debug!("randomx init (seed_hash) failed: {}", e);
                        }
                    } else {
                        log::debug!("randomx: missing/invalid seed_hash in job {}", job.job_id);
                    }
                }

                // ═══ Stream Scheduler v2: Dynamic algorithm detection (opt-in) ═══
                // Default for desktop miner: keep the configured algo pinned (CHv3),
                // so hashrate doesn't collapse when pool sends Revenue stream jobs.
                // Set ZION_ENABLE_STREAM_SWITCH=1 to enable dynamic switching.
                if stream_switch_enabled {
                    let job_algo = job.algo.as_deref()
                        .and_then(Algorithm::from_str)
                        .unwrap_or(algorithm);

                    if job_algo != active_algorithm {
                        // CPU-only mode: if pool sends a GPU-only algo, replace with RandomX
                        let effective_algo = if matches!(job_algo,
                            Algorithm::Ethash | Algorithm::KawPow | Algorithm::Autolykos |
                            Algorithm::KHeavyHash | Algorithm::ProgPow
                        ) {
                            // Check if GPU is available — if not, use RandomX instead
                            if std::env::var("ZION_HAS_GPU").map(|v| v == "1" || v.to_lowercase() == "true").unwrap_or(false) {
                                job_algo // GPU available, keep original
                            } else {
                                log::debug!("cpu:switch {} is GPU-only → RandomX", job_algo.name());
                                Algorithm::RandomX
                            }
                        } else {
                            job_algo
                        };

                        log::debug!("cpu:switch {} → {}", active_algorithm.name(), effective_algo.name());
                        active_algorithm = effective_algo;
                        batch_size = Self::batch_size_for_algo(active_algorithm);

                        // Re-initialize algorithm-specific state if needed
                        if active_algorithm == Algorithm::RandomX {
                            // Use seed_hash from pool job (MoneroOcean/CryptoNote sends
                            // the proper seed_hash for RandomX dataset initialization)
                            let seed_key = job.seed_hash.as_deref()
                                .filter(|s| !s.is_empty() && s.len() >= 16)
                                .and_then(|s| hex::decode(s).ok())
                                .unwrap_or_else(|| b"ZION_RANDOMX_TESTNET_2026".to_vec());

                            if let Err(e) = native_algos::init_randomx_with_key(&seed_key) {
                                log::debug!("randomx init failed: {}", e);
                            }
                        }
                    }
                }

                let t = job.target.trim();
                if matches!(active_algorithm, Algorithm::CosmicHarmony) {
                    let tu = parse_cosmic_target_to_u32(t);
                    let endian = job
                        .cosmic_state0_endian
                        .as_deref()
                        .unwrap_or("little");
                    log::debug!(
                        "New mining job: id={}, height={}, algo={}, target='{}' (u32=0x{:08x}) endian={}",
                        job.job_id,
                        job.height,
                        active_algorithm.name(),
                        t,
                        tu,
                        endian
                    );
                } else {
                    log::debug!(
                        "New mining job: id={}, height={}, algo={}, target='{}'",
                        job.job_id,
                        job.height,
                        active_algorithm.name(),
                        t
                    );
                }
            }

            // Blob bytes for hashing (cached per job_id). If something goes wrong, re-decode.
            if blob_job_id.as_deref() != Some(job.job_id.as_str()) {
                let blob_hex = job.blob.trim_start_matches("0x");
                match Vec::from_hex(blob_hex) {
                    Ok(b) => {
                        blob_job_id = Some(job.job_id.clone());
                        blob_bytes = b;
                    }
                    Err(e) => {
                        log::debug!("Failed to parse blob hex: {}", e);
                        std::thread::sleep(std::time::Duration::from_millis(250));
                        continue;
                    }
                }
            }

            // Build (or reuse) VerusHash header buffer: prefix(108) + nonce(32) + solution.
            // We pass the upstream extranonce prefix via `seed_hash` (scheduler hack) so miners
            // can build the same 32B nonce as the revenue proxy submits upstream.
            if matches!(active_algorithm, Algorithm::VerusHash) {
                let needs_rebuild = verus_ctx
                    .as_ref()
                    .map(|(jid, _)| jid != &job.job_id)
                    .unwrap_or(true);

                if needs_rebuild {
                    verus_ctx = None;

                    let extranonce_hex = job
                        .seed_hash
                        .as_deref()
                        .unwrap_or("")
                        .trim()
                        .trim_start_matches("0x");
                    let extranonce = hex::decode(extranonce_hex).unwrap_or_default();

                    // ═══ PBaaS v7+ VerusHash Mining ═══
                    // Pool sends blob = header_prefix(108B) + varint(3B) + solution(1344B) = 1455B
                    // We build: header_prefix(108B) + nonce(32B) + varint(3B) + solution(1344B) = 1487B
                    //
                    // For PBaaS v7+ merged mining:
                    //   - Header nonce is from daemon (rpcData.nonce) — pool ignores miner nonce
                    //   - Pool zeroes nonce in header for hashing (ClearNonCanonicalData)
                    //   - Miner iterates counting nonce in the SOLUTION (last 15 bytes = nonceSpace)
                    //   - nonceSpace layout: extranonce1(4B) + padding(7B) + counting_nonce(4B)
                    //   - Pool checks extraNonce1 is present in last 15 bytes of submitted solution
                    //   - VerusHash is computed over entire block: header(140B) + solution(1347B) = 1487B
                    const PREFIX_LEN: usize = 108;
                    if blob_bytes.len() >= PREFIX_LEN {
                        let prefix = &blob_bytes[..PREFIX_LEN];
                        let solution_part = &blob_bytes[PREFIX_LEN..]; // varint(3) + solution(1344)

                        let mut buf = Vec::with_capacity(PREFIX_LEN + 32 + solution_part.len());
                        buf.extend_from_slice(prefix);         // 108B: version(4)+prev(32)+merkle(32)+reserved(32)+ntime(4)+nbits(4)
                        buf.extend_from_slice(&[0u8; 32]);     // 32B: nonce placeholder (will be zeroed for v7+)
                        buf.extend_from_slice(solution_part);  // varint(3) + solution(1344) = 1347B
                        // Total: 108 + 32 + 1347 = 1487 bytes ✅

                        // Detect PBaaS v7+ merged mining from solution version byte
                        let sol_offset = PREFIX_LEN + 32 + 3; // = 143 (header 140 + varint 3)
                        let is_pbaas_v7 = if buf.len() > sol_offset + 8 {
                            let sol_version = buf[sol_offset];
                            let sol_flag = buf.get(sol_offset + 5).copied().unwrap_or(0);
                            sol_version >= 7 && sol_flag > 0
                        } else {
                            false
                        };

                        if is_pbaas_v7 {
                            log::info!("VerusHash PBaaS v7+ mode: iterating nonce in solution (not header)");
                            // Clear non-canonical data for hashing (same as ccminer/node ClearNonCanonicalData)
                            // hashPrevBlock + hashMerkleRoot + hashFinalSaplingRoot (96B at 4..100)
                            for b in &mut buf[4..100] { *b = 0; }
                            // nBits (4B at 104..108)
                            for b in &mut buf[104..108] { *b = 0; }
                            // nNonce (32B at 108..140) — zeroed, daemon nonce is not used for hash
                            for b in &mut buf[108..140] { *b = 0; }
                            // hashPrevMMRRoot + hashBlockMMRRoot in solution (64B at sol_offset+8)
                            if buf.len() >= sol_offset + 8 + 64 {
                                for b in &mut buf[sol_offset + 8..sol_offset + 8 + 64] { *b = 0; }
                            }
                        }

                        // nonceSpace offset: last 15 bytes of 1344-byte solution
                        // = sol_offset + (1344 - 15) = 143 + 1329 = 1472
                        let nonce_space_off = sol_offset + 1344 - 15;

                        // Pre-fill nonceSpace prefix once (extranonce1 + zero padding).
                        // Per-nonce we only overwrite the last 4 bytes with the counting nonce.
                        if is_pbaas_v7 && buf.len() >= nonce_space_off + 11 {
                            let en_take = extranonce.len().min(11);
                            buf[nonce_space_off..nonce_space_off + en_take]
                                .copy_from_slice(&extranonce[..en_take]);
                            for b in &mut buf[nonce_space_off + en_take..nonce_space_off + 11] {
                                *b = 0;
                            }
                        }

                        // Prebuild base 32B nonce (non-PBaaS) once.
                        let mut nonce32_base = [0u8; 32];
                        let nonce32_en_take = extranonce.len().min(28);
                        nonce32_base[..nonce32_en_take].copy_from_slice(&extranonce[..nonce32_en_take]);

                        log::info!(
                            "VerusHash job built: buf_len={} (expected 1487), extranonce_len={}, pbaas_v7={}, nonce_space_off={}",
                            buf.len(), extranonce.len(), is_pbaas_v7, nonce_space_off
                        );

                        verus_ctx = Some((
                            job.job_id.clone(),
                            VerusJobCtx {
                                buf,
                                nonce_off: if is_pbaas_v7 { nonce_space_off + 11 } else { PREFIX_LEN },
                                is_pbaas_v7,
                                nonce32_base,
                                nonce32_en_take,
                                extranonce,
                            },
                        ));
                    } else {
                        log::warn!(
                            "VerusHash job blob too short (len={} < {}): job={} — falling back to generic hash path",
                            blob_bytes.len(),
                            PREFIX_LEN,
                            job.job_id
                        );
                    }
                }
            }

            // Effective CPU worker split by algorithm:
            // - VerusHash (VRSC): 1 worker for stability + low stale rate.
            // - Everything else: use all workers.
            let effective_workers = if matches!(active_algorithm, Algorithm::VerusHash) {
                1u32
            } else {
                worker_count
            };

            // If this worker isn't active for the current algorithm, idle.
            if worker_index >= effective_workers {
                std::thread::sleep(std::time::Duration::from_millis(50));
                if !connection_alive.load(std::sync::atomic::Ordering::Relaxed) {
                    log::debug!("Connection lost — mining loop stopping");
                    break;
                }
                continue;
            }

            let target_hex = job.target.clone();
            let batch_job_id = job.job_id.clone();

            // Ensure Verus target cache is current for this job.
            if matches!(active_algorithm, Algorithm::VerusHash)
                && verus_target_job_id.as_deref() != Some(batch_job_id.as_str())
            {
                verus_target_job_id = Some(batch_job_id.clone());
                verus_target_be = parse_target_be32(target_hex.as_str());
            }

            let start_time = std::time::Instant::now();
            let mut hashes_count: u64 = 0;
            let mut shares_found: u32 = 0;
            let mut hashes_pending_stats: u64 = 0;
            let mut hit_unsupported = false;

            // ═══ Unified mining loop — same path for all algos (xmrig-like) ═══
            // 1 thread, sequential hashing.  RandomX uses thread-local VM
            // with JIT+HugePages+Full (when available).  Simple and reliable.
            for i in 0..batch_size {
                let nonce = nonce_start.wrapping_add(i.wrapping_mul(effective_workers));
                let native_algo = active_algorithm.to_native();
                let is_first = i == 0;
                let t0 = if is_first && matches!(active_algorithm, Algorithm::RandomX) {
                    log::debug!("RandomX first hash: starting...");
                    Some(std::time::Instant::now())
                } else {
                    None
                };

                let mut hash = [0u8; 32];

                // Special-case VerusHash: hash full header bytes with 32B nonce inserted.
                // This matches how VRSC pools verify shares (nonce is part of header serialization).
                if matches!(native_algo, super::native_algos::NativeAlgorithm::VerusHash) {
                    if let Some((_jid, ctx)) = verus_ctx.as_mut() {
                        // PBaaS v7+ mining: iterate counting nonce in solution's nonceSpace
                        // nonceSpace = last 15 bytes of solution:
                        //   [0..xnonce1_size): extranonce1 (pool nonce)
                        //   [xnonce1_size..11): zero padding
                        //   [11..15): counting nonce (LE u32, iterated by miner)
                        //
                        // ctx.nonce_off points to:
                        //   PBaaS v7+: nonceSpace offset in buf (last 15B of solution = buf[1472..1487])
                        //   Pre-v7: header nonce offset (buf[108..140])
                        let off = ctx.nonce_off;
                        if ctx.is_pbaas_v7 {
                            // PBaaS v7+: only update counting nonce (4 bytes LE) in nonceSpace.
                            ctx.buf[off..off + 4].copy_from_slice(&nonce.to_le_bytes());
                        } else {
                            // Pre-PBaaS: write full 32B header nonce.
                            let mut nonce32 = ctx.nonce32_base;
                            let en_take = ctx.nonce32_en_take;
                            nonce32[en_take..en_take + 4].copy_from_slice(&nonce.to_le_bytes());
                            ctx.buf[off..off + 32].copy_from_slice(&nonce32);
                        }

                        hash = zion_core::algorithms::verushash::verushash_v2_2(&ctx.buf);

                        // VRSC telemetry: occasionally log when we get *close* to the target.
                        // Target is provided as big-endian hex (e.g. 00000040....). Our hash bytes
                        // are treated as little-endian by the upstream pool, so:
                        //   hash_be[0..3] == reverse(hash_le)[0..3] == hash_le[31..28]
                        // A useful near-hit signal is when the first 3 bytes of hash_be are 0,
                        // i.e. the last 3 bytes of hash_le are 0. This should happen about once
                        // per ~16M hashes and provides a quick sanity check of distribution.
                        if hash[31] == 0 && hash[30] == 0 && hash[29] == 0 {
                            // hash_be prefix is 000000XX where XX == hash[28]
                            log::info!(
                                "🧪 VRSC near-hit: nonce={} hash_be_prefix=000000{:02x} hash_le={} target_prefix={}",
                                nonce,
                                hash[28],
                                hex::encode(hash),
                                &target_hex[..target_hex.len().min(8)],
                            );
                        }

                        // Log first hash in each batch for diagnostics
                        if nonce == nonce_start {
                            log::debug!(
                                "🔬 VerusHash first hash: nonce={} buf_len={} nonceSpace[0..15]={} hash={}",
                                nonce, ctx.buf.len(),
                                if ctx.is_pbaas_v7 {
                                    let ns = (off - 11).saturating_sub(0);
                                    hex::encode(&ctx.buf[ns..ns+15])
                                } else {
                                    hex::encode(&ctx.buf[off..off+15.min(ctx.buf.len()-off)])
                                },
                                hex::encode(hash)
                            );
                        }
                    } else {
                        // Fallback to the previous generic path.
                        let hash_vec = match native_algos::compute_hash(
                            native_algo,
                            &blob_bytes,
                            nonce as u64,
                            job.height as u32,
                        ) {
                            Ok(h) => h,
                            Err(e) => {
                                if !compute_error_logged {
                                    log::error!("❌ compute_hash error: {} (algo={:?})", e, native_algo);
                                    compute_error_logged = true;
                                }
                                let msg = e.to_string();
                                if msg.contains("not compiled") || msg.contains("not supported") {
                                    hit_unsupported = true;
                                    break;
                                }
                                continue;
                            }
                        };
                        if hash_vec.len() < 32 {
                            continue;
                        }
                        hash.copy_from_slice(&hash_vec[..32]);
                    }
                } else {
                    let hash_vec = match native_algos::compute_hash(
                        native_algo,
                        &blob_bytes,
                        nonce as u64,
                        job.height as u32,
                    ) {
                        Ok(h) => {
                            if let Some(t0) = t0 {
                                log::debug!(
                                    "RandomX first hash: OK in {:?} (len={})",
                                    t0.elapsed(),
                                    h.len()
                                );
                            }
                            h
                        }
                        Err(e) => {
                            if let Some(t0) = t0 {
                                log::error!(
                                    "🧪 RandomX first hash: ERROR in {:?}: {} (algo={:?})",
                                    t0.elapsed(),
                                    e,
                                    native_algo
                                );
                            } else if !compute_error_logged {
                                // Log once per job to avoid flooding.
                                log::error!("❌ compute_hash error: {} (algo={:?})", e, native_algo);
                                compute_error_logged = true;
                            }

                            // If algo is not compiled/supported, don't spin hot.
                            // Break the batch and sleep a bit; the algorithm selection won't change.
                            let msg = e.to_string();
                            if msg.contains("not compiled") || msg.contains("not supported") {
                                hit_unsupported = true;
                                break;
                            }
                            continue;
                        }
                    };

                    if hash_vec.len() < 32 {
                        continue;
                    }
                    hash.copy_from_slice(&hash_vec[..32]);
                }

                hashes_count += 1;
                hashes_pending_stats += 1;

                // If the pool has already switched to a new job, stop the batch early.
                // This reduces stale shares while keeping a larger batch_size for throughput.
                if (nonce & 0xFF) == 0 {
                    let current_id = job_state
                        .read()
                        .expect("job_state poisoned")
                        .as_ref()
                        .map(|j| j.job_id.clone());
                    if current_id.as_deref() != Some(batch_job_id.as_str()) {
                        break;
                    }
                }

                // Průběžný flush statistik i během velkého batchu.
                // Bez tohoto se u CH (batch 250k) může UI držet dlouho na 0 H/s,
                // i když miner aktivně počítá.
                if hashes_pending_stats > 0
                    && (hashes_pending_stats >= 4096
                        || last_stats_flush.elapsed() >= std::time::Duration::from_secs(1))
                {
                    let mut stats_guard = stats.blocking_write();
                    stats_guard.add_hashes(hashes_pending_stats);
                    hashes_pending_stats = 0;
                    last_stats_flush = std::time::Instant::now();
                }

                let meets = if matches!(active_algorithm, Algorithm::VerusHash) {
                    meets_target_verushash(&hash, &verus_target_be)
                } else {
                    Self::meets_target(active_algorithm, &hash, &target_hex, job.cosmic_state0_endian.as_deref())
                };

                if meets {
                    shares_found = shares_found.saturating_add(1);

                    // ═══ VRSC share logging — keep fast path minimal ═══
                    if matches!(native_algo, super::native_algos::NativeAlgorithm::VerusHash) {
                        // hash_be_prefix = reverse(hash_le)[0..4] = hash_le[31..28]
                        let hash_be_prefix = [hash[31], hash[30], hash[29], hash[28]];
                        log::info!(
                            "✅ VRSC share found: job={} nonce={} hash_be_prefix={} target_prefix={}",
                            batch_job_id,
                            nonce,
                            hex::encode(hash_be_prefix),
                            &target_hex[..target_hex.len().min(8)],
                        );

                        // Optional heavy diagnostics (hex dumps) — enable only when needed.
                        let dump = std::env::var("ZION_VRSC_SHARE_DUMP")
                            .map(|v| {
                                let v = v.trim().to_ascii_lowercase();
                                v == "1" || v == "true" || v == "yes"
                            })
                            .unwrap_or(false);
                        if dump {
                            if let Some((_jid, ctx)) = verus_ctx.as_ref() {
                                let buf = &ctx.buf;
                                let mut hash_be = [0u8; 32];
                                for i in 0..32 { hash_be[i] = hash[31 - i]; }

                                log::debug!(
                                    "🔬 VRSC SHARE DUMP: nonce={} hash_le={} hash_be={} target={} buf_len={}",
                                    nonce,
                                    hex::encode(hash),
                                    hex::encode(&hash_be),
                                    &target_hex[..target_hex.len().min(32)],
                                    buf.len()
                                );

                                log::debug!(
                                    "🔬 VRSC buf header: version={} ntime={} nbits={} nonce32={} ",
                                    hex::encode(&buf[0..4]),
                                    hex::encode(&buf[100..104]),
                                    hex::encode(&buf[104..108]),
                                    hex::encode(&buf[108..140])
                                );

                                let sol_off = 143; // 108+32+3
                                if buf.len() > sol_off + 72 {
                                    log::debug!(
                                        "🔬 VRSC buf solution: ver={} flags={} mmr_roots={} ",
                                        hex::encode(&buf[sol_off..sol_off+4]),
                                        hex::encode(&buf[sol_off+4..sol_off+8]),
                                        hex::encode(&buf[sol_off+8..sol_off+72])
                                    );
                                }
                                if buf.len() >= 1487 {
                                    log::debug!("🔬 VRSC buf nonceSpace: {}", hex::encode(&buf[1472..1487]));
                                    log::debug!("🔬 VRSC FULL_BUF_FIRST280: {}", hex::encode(&buf[..280]));
                                    log::debug!("🔬 VRSC FULL_BUF_LAST30: {}", hex::encode(&buf[1457..1487]));
                                }
                            }
                        }
                    }

                    let pending = PendingShare {
                        job_id: job.job_id.clone(),
                        nonce,
                        result_hex: hex::encode(hash),
                    };

                    // Best-effort: if queue is full, drop (avoid stalling hashing)
                    let _ = share_tx.try_send(pending);
                }
            }

            if hit_unsupported {
                std::thread::sleep(std::time::Duration::from_secs(2));
            }

            let elapsed = start_time.elapsed();
            let hash_rate_khs = if elapsed.as_secs_f64() > 0.0 {
                hashes_count as f64 / elapsed.as_secs_f64() / 1000.0
            } else {
                0.0
            };
            log::debug!("batch {} hashes {:.2} kH/s {} shares (algo={})", hashes_count, hash_rate_khs, shares_found, active_algorithm.name());

            if hashes_pending_stats > 0 {
                let mut stats_guard = stats.blocking_write();
                stats_guard.add_hashes(hashes_pending_stats);
                last_stats_flush = std::time::Instant::now();
            } else if hashes_count > 0
                && !matches!(active_algorithm, Algorithm::RandomX | Algorithm::Yescrypt)
            {
                let mut stats_guard = stats.blocking_write();
                stats_guard.add_hashes(hashes_count);
                last_stats_flush = std::time::Instant::now();
            }

            nonce_start = nonce_start.wrapping_add(batch_size.wrapping_mul(effective_workers));

            // Check if connection is still alive (set to false by submit loop or connection monitor)
            if !connection_alive.load(std::sync::atomic::Ordering::Relaxed) {
                log::debug!("Connection lost — mining loop stopping");
                break;
            }
        }
        log::debug!("Mining loop exited");
    }

    /// Public static accessor for target checking (used by stream_aware module)
    pub fn meets_target_static(
        algorithm: Algorithm,
        hash: &[u8; 32],
        target_hex: &str,
        cosmic_state0_endian: Option<&str>,
    ) -> bool {
        Self::meets_target(algorithm, hash, target_hex, cosmic_state0_endian)
    }

    /// Compute a stable bookmark key from a job_id.
    ///
    /// Pool job_ids include a changing timestamp component that makes naive
    /// HashMap lookups miss on every rotation:
    ///   ZION:  "h2288-90000000-1770943066-cosmic_harmony"
    ///   ext-*: "ext-xmr-48772489"
    ///
    /// We strip the timestamp so the key stays constant across rotations
    /// at the same height/prev_hash:
    ///   ZION:  "h2288-90000000-cosmic_harmony"
    ///   ext-*: "ext-xmr" (external jobs share nonce space within a coin)
    fn bookmark_key(job_id: &str) -> String {
        if job_id.starts_with("ext-") {
            // ext-xmr-48772489 → "ext-xmr"
            let parts: Vec<&str> = job_id.splitn(3, '-').collect();
            if parts.len() >= 2 {
                return format!("{}-{}", parts[0], parts[1]);
            }
            return job_id.to_string();
        }

        // ZION jobs: h{height}-{prev8}-{timestamp}-{algo}
        // Strip the timestamp (3rd component) → "h{height}-{prev8}-{algo}"
        let parts: Vec<&str> = job_id.split('-').collect();
        if parts.len() == 4 {
            // h2288-90000000-1770943066-cosmic_harmony → h2288-90000000-cosmic_harmony
            format!("{}-{}-{}", parts[0], parts[1], parts[3])
        } else {
            // Legacy or already stripped format — use as-is
            job_id.to_string()
        }
    }

    /// Get optimal batch size for an algorithm
    fn batch_size_for_algo(algo: Algorithm) -> u32 {
        // Optional runtime override for quick tuning without rebuild.
        // Example: ZION_BATCH_CH3=50000
        if let Ok(v) = std::env::var("ZION_BATCH_CH3") {
            if let Ok(n) = v.trim().parse::<u32>() {
                if n > 0 {
                    return n;
                }
            }
        }

        match algo {
            // RandomX: ~30 H/s light, ~200+ H/s full mode.
            // MoneroOcean sends new job every ~30s.
            // 100 hashes ≈ 3s (light) / 0.5s (full) — good cadence.
            Algorithm::RandomX => 100,
            // VerusHash v2.2 (VRSC): CPU-oriented, keep medium batch for low latency.
            Algorithm::VerusHash => 5_000,
            // CH v3: keep batch much smaller than 250k so we react quickly
            // to template/stream switches and reduce stale+duplicate rejects.
            Algorithm::CosmicHarmony => 25_000,
            Algorithm::Ethash => 50_000,
            Algorithm::Autolykos => 50_000,
            Algorithm::KawPow => 50_000,
            Algorithm::Yescrypt => 5_000,
            _ => 250_000,
        }
    }

    fn meets_target(
        algorithm: Algorithm,
        hash: &[u8; 32],
        target_hex: &str,
        cosmic_state0_endian: Option<&str>,
    ) -> bool {
        let target_hex = target_hex.trim_start_matches("0x");
        if target_hex.is_empty() {
            return false;
        }

        match algorithm {
            Algorithm::RandomX => {
                // CryptoNote/XMRig target check:
                // Pool sends compact 4-byte target (little-endian u32), e.g. "b88d0600".
                // XMRig expands it to a 64-bit target and compares against the last 8 bytes
                // of the hash (little-endian).
                let tbytes = Vec::from_hex(target_hex).unwrap_or_default();
                if tbytes.len() != 4 {
                    return false;
                }
                let target_u32 = u32::from_le_bytes([tbytes[0], tbytes[1], tbytes[2], tbytes[3]]);
                if target_u32 == 0 {
                    return false;
                }

                let target64 = 0xFFFF_FFFF_FFFF_FFFFu64 / (0xFFFF_FFFFu64 / target_u32 as u64);
                let hash_val = u64::from_le_bytes([
                    hash[24], hash[25], hash[26], hash[27],
                    hash[28], hash[29], hash[30], hash[31],
                ]);

                static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
                let cnt = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                let hit = hash_val < target64;
                if cnt % 200 == 0 || hit {
                    log::debug!(
                        "🎯 RandomX target check: hash_val=0x{:016X} target64=0x{:016X} {} (n={})",
                        hash_val,
                        target64,
                        if hit { "✅ HIT" } else { "miss" },
                        cnt
                    );
                }

                hit
            }
            Algorithm::Yescrypt => {
                // Pool-side yescrypt compares first 28 bytes (224-bit) big-endian.
                // Target may be delivered as a hex string shorter than 28 bytes; pad on the left.
                let target_bytes = parse_target_to_fixed_be(target_hex, 28);
                for (a, b) in hash.iter().take(28).zip(target_bytes.iter()) {
                    if a < b {
                        return true;
                    }
                    if a > b {
                        return false;
                    }
                }
                true
            }
            Algorithm::CosmicHarmony => {
                // Match native pool validator logic for Cosmic Harmony v1/v3:
                // - state0 is derived from the first 4 bytes of the hash
                // - endian is configurable (pool currently uses little)
                // - job target is a u32 hex string (8 chars) computed from difficulty
                let target_u32 = parse_cosmic_target_to_u32(target_hex);
                let endian = cosmic_state0_endian.unwrap_or("little").to_lowercase();
                let state0 = if endian == "big" {
                    u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]])
                } else {
                    u32::from_le_bytes([hash[0], hash[1], hash[2], hash[3]])
                };
                let result = state0 <= target_u32;
                
                // Debug: log first few comparisons
                static DEBUG_COUNT: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
                let count = DEBUG_COUNT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                if count < 5 || (result && count < 100) {
                    log::debug!(
                        "🔍 CosmicHarmony target check: state0={} (0x{:08x}), target={} (0x{:08x}, hex='{}'), meets={}",
                        state0, state0, target_u32, target_u32, target_hex, result
                    );
                }
                
                result
            }
            _ => {
                // ZcashStratum target comparison for VerusHash / equihash-family:
                //
                // Pool sends target via `mining.set_target` as a BIG-ENDIAN hex string
                // (e.g. "0000004000...00" where leading zeros = high bytes are small).
                //
                // Pool-side verification (node-stratum-pool jobManager.js):
                //   headerBigNum = bignum.fromBuffer(headerHash, {endian: 'little', size: 32})
                //   job.target   = bignum(rpcData.target, 16)  // parsed as BE hex
                //   check: headerBigNum.le(job.target)
                //
                // Hash bytes from Finalize2b are in LITTLE-ENDIAN order (byte[0] = LSB).
                // Target hex is BIG-ENDIAN (byte[0] = MSB).
                //
                // To compare correctly we must reverse the hash bytes (LE→BE)
                // before doing a lexicographic comparison against BE target bytes.
                let mut target_bytes = vec![0u8; 32];
                if let Ok(tbytes) = Vec::from_hex(target_hex) {
                    let start = 32usize.saturating_sub(tbytes.len());
                    target_bytes[start..].copy_from_slice(&tbytes);
                }

                // Reverse hash bytes: LE output from hash → BE for comparison with BE target
                let mut hash_be = [0u8; 32];
                for i in 0..32 {
                    hash_be[i] = hash[31 - i];
                }

                // Diagnostic log for VerusHash — every 50000 hashes + hits
                static VRSC_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
                let vcnt = VRSC_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

                let result = {
                    let mut res = std::cmp::Ordering::Equal;
                    for (a, b) in hash_be.iter().zip(target_bytes.iter()) {
                        if a < b { res = std::cmp::Ordering::Less; break; }
                        if a > b { res = std::cmp::Ordering::Greater; break; }
                    }
                    matches!(res, std::cmp::Ordering::Less | std::cmp::Ordering::Equal)
                };

                if vcnt % 50000 == 0 || result {
                    log::debug!(
                        "🎯 VerusHash target check #{}: hash_le={} hash_be={} target={} meets={} (algo={:?})",
                        vcnt, hex::encode(hash), hex::encode(&hash_be), hex::encode(&target_bytes), result, algorithm
                    );
                }

                result
            }
        }
    }
}

fn parse_target_to_fixed_be(target_hex: &str, size: usize) -> Vec<u8> {
    let t = target_hex.trim_start_matches("0x").trim();
    let mut out = vec![0u8; size];
    if let Ok(mut tbytes) = Vec::from_hex(t) {
        if tbytes.len() > size {
            tbytes = tbytes.split_off(tbytes.len() - size);
        }
        let start = size.saturating_sub(tbytes.len());
        out[start..].copy_from_slice(&tbytes);
    }
    out
}

fn parse_target_to_u32(target_hex: &str) -> u32 {
    // Pool-side (native) parses cosmic targets as a hex number (big-endian text).
    // - If <= 8 chars: parse full string.
    // - If longer: use the last 8 chars (low32).
    let t = target_hex.trim_start_matches("0x").trim();
    if t.is_empty() {
        return 0;
    }

    if t.len() <= 8 {
        return u32::from_str_radix(t, 16).unwrap_or(0);
    }

    u32::from_str_radix(&t[t.len() - 8..], 16).unwrap_or(0)
}

fn parse_cosmic_target_to_u32(target_hex: &str) -> u32 {
    let t = target_hex.trim_start_matches("0x").trim();
    if t.is_empty() {
        return 0;
    }

    if t.len() <= 8 {
        return u32::from_str_radix(t, 16).unwrap_or(0);
    }

    // IMPORTANT: Must match pool-side validator.
    // Pool parses CHv3 job_target as a u32 taken from the *first* 8 hex chars
    // when a longer target is provided.
    // See: pool/src/shares/validator.rs (Algorithm::CosmicHarmony)
    u32::from_str_radix(&t[0..8], 16).unwrap_or(0)
}
