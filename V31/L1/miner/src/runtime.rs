use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use chrono::Utc;
use serde_json::{json, Value};
use sha3::{Digest, Sha3_256};
use tokio::sync::{watch, Mutex};
use tokio::task;
use tokio::time::sleep;
use tracing::{info, warn};
use zion_core::{
    Block, BlockHeader, ConsensusEngine, EkamDeeksha, Transaction, TransactionInput,
    TransactionOutput,
};
use zion_l1_types::{Amount, Hash};

#[cfg(feature = "auxpow")]
use crate::autonomous::{AutonomousProfitRouter, HardwareProfile};
#[cfg(feature = "auxpow")]
use crate::auxpow::{AuxPoWScheduler, Job, Share, ShareResult, StratumClient};
use crate::config::MinerConfig;
use crate::pool_message::ExternalStreamJob;
use crate::stream::{StreamId, StreamStats};
#[cfg(feature = "auxpow")]
use crate::v3_pool_client::V3PoolClient;

#[cfg(feature = "auxpow")]
use crate::gpu::{create_gpu_backend, GpuBackendKind};
#[cfg(feature = "auxpow")]
use zion_core::V3DifficultyTarget as DifficultyTarget;

// GPU mining for Stream 1 (ZION) — available even without the `auxpow` feature
// so that a CUDA/OpenCL build can GPU-mine ZION blocks in pool mode.
use crate::gpu::GpuMiner;
use zion_core::v3_compat::{MiningHeader, DifficultyTarget as V3DiffTarget};

/// Parallel CPU nonce search for ZION (Ekam Deeksha).
///
/// Splits the nonce range across `threads` rayon workers. Each worker
/// allocates its own 512 KiB scratchpad once and reuses it for all nonces
/// in its chunk, eliminating per-nonce allocation.
///
/// Fast path: tries the first 64 nonces sequentially before launching the
/// rayon thread pool. This avoids thread pool overhead when the target is
/// trivially easy (e.g. pool max-difficulty target where nonce=0 passes).
///
/// Returns the first solution found (cancelling other workers via AtomicBool).
fn parallel_zion_find_nonce(
    header: &[u8],
    target: &[u8; 32],
    start_nonce: u64,
    count: u64,
    threads: usize,
) -> Option<(u64, Hash)> {
    use rayon::prelude::*;
    use std::sync::atomic::{AtomicBool, Ordering};
    use zion_cosmic_harmony::algorithm::ekam_deeksha::{
        hash, hash_with_scratchpad, meets_target, SCRATCHPAD_SIZE,
    };

    // Fast path: try first few nonces with the original hash() function.
    // This avoids scratchpad allocation + rayon overhead when the target is
    // trivially easy (e.g. pool max-difficulty target where nonce=0 passes).
    let fast_count = count.min(8);
    for offset in 0..fast_count {
        let nonce = start_nonce.wrapping_add(offset);
        let h = hash(header, nonce);
        if meets_target(&h, target) {
            return Some((nonce, Hash::new(h)));
        }
    }

    // Remaining nonces — use parallel search with reusable scratchpad
    let remaining_start = start_nonce.wrapping_add(fast_count);
    let remaining_count = count.saturating_sub(fast_count);
    if remaining_count == 0 {
        return None;
    }

    let threads = threads.max(1);
    if threads == 1 || remaining_count < threads as u64 * 4 {
        // Sequential fallback for remaining nonces
        let mut scratchpad = vec![0u8; SCRATCHPAD_SIZE];
        for offset in 0..remaining_count {
            let nonce = remaining_start.wrapping_add(offset);
            let h = hash_with_scratchpad(header, nonce, &mut scratchpad);
            if meets_target(&h, target) {
                return Some((nonce, Hash::new(h)));
            }
        }
        return None;
    }

    let cancelled = std::sync::Arc::new(AtomicBool::new(false));
    let chunk_size = remaining_count / threads as u64;

    (0..threads)
        .into_par_iter()
        .find_map_any(|thread_idx| {
            let start = remaining_start.wrapping_add(thread_idx as u64 * chunk_size);
            let this_count = if thread_idx == threads - 1 {
                remaining_count - (thread_idx as u64 * chunk_size)
            } else {
                chunk_size
            };

            let mut pad = vec![0u8; SCRATCHPAD_SIZE];

            for offset in 0..this_count {
                if offset % 256 == 0 && cancelled.load(Ordering::Relaxed) {
                    return None;
                }
                let nonce = start.wrapping_add(offset);
                let h = hash_with_scratchpad(header, nonce, &mut pad);
                if meets_target(&h, target) {
                    cancelled.store(true, Ordering::Relaxed);
                    return Some((nonce, Hash::new(h)));
                }
            }
            None
        })
}

#[derive(Debug, thiserror::Error)]
pub enum MinerError {
    #[error("consensus error: {0}")]
    Consensus(String),
    #[cfg(feature = "auxpow")]
    #[error("no AuxPoW solution")]
    NoAuxPoWSolution,
    #[error("shutdown requested")]
    Shutdown,
    #[error("task join error: {0}")]
    Join(#[from] tokio::task::JoinError),
}

type MinerHandle = tokio::task::JoinHandle<Result<(), MinerError>>;

/// Unified mining runtime: ZION canonical blocks + optional AuxPoW fallback.
///
/// Stream 1 always mines ZION blocks. Streams 2 and 3 are AuxPoW fallbacks that
/// are compiled only when the `auxpow` feature is enabled and can be disabled at
/// runtime via `MinerConfig`.
#[derive(Clone)]
pub struct MinerRuntime {
    config: Arc<MinerConfig>,
    consensus: Arc<ConsensusEngine>,
    stats: Arc<Mutex<HashMap<StreamId, StreamStats>>>,
    /// GPU backend for Stream 1 (ZION deeksha). `None` = CPU-only.
    /// Initialized when `config.gpu_backend` is not "cpu".
    gpu_zion: Arc<std::sync::Mutex<Option<Box<dyn GpuMiner>>>>,
    /// GPU backend for Stream 2 (external GPU coin, e.g. ZANO ProgPoW).
    /// Lazily initialized on first external GPU job. Separate from
    /// gpu_zion because the algorithm (progpow_zano) and work_size differ.
    /// On single-GPU rigs, time-slicing via burst/gap duty-cycle yields
    /// GPU to Stream 1 between batches.
    #[cfg(feature = "auxpow")]
    gpu_ext: Arc<std::sync::Mutex<Option<Box<dyn GpuMiner>>>>,
    /// Current algorithm for gpu_ext (for DAG/epoch reload detection).
    #[cfg(feature = "auxpow")]
    gpu_ext_algo: Arc<std::sync::Mutex<Option<String>>>,
    /// ZION nonce cursor — advances between batches so we don't always
    /// re-scan from 0. Wrapped in a mutex for safe concurrent access.
    zion_nonce_cursor: Arc<std::sync::atomic::AtomicU64>,
    #[cfg(feature = "auxpow")]
    scheduler: Arc<Mutex<AuxPoWScheduler>>,
    #[cfg(feature = "auxpow")]
    gpu_client: Arc<Mutex<Option<StratumClient>>>,
    #[cfg(feature = "auxpow")]
    cpu_client: Arc<Mutex<Option<StratumClient>>>,
    #[cfg(feature = "auxpow")]
    profit_router: Arc<std::sync::Mutex<AutonomousProfitRouter>>,
}

impl MinerRuntime {
    pub fn new(config: MinerConfig) -> Self {
        let algorithm = Arc::new(EkamDeeksha::new()) as Arc<dyn zion_cosmic_harmony::PowAlgorithm>;
        let consensus = Arc::new(ConsensusEngine::new(algorithm));
        #[cfg(feature = "auxpow")]
        let hashrate_per_unit = config.hashrate_per_unit;
        #[cfg(feature = "auxpow")]
        let stream3_force_coin = config.stream3_force_coin;
        #[cfg(feature = "auxpow")]
        let stream2_force_coin = config.stream2_force_coin;
        #[cfg(feature = "auxpow")]
        let profit_hysteresis_pct = config.profit_hysteresis_pct;
        #[cfg(feature = "auxpow")]
        let profit_interval_sec = config.profit_interval_sec;
        #[cfg(feature = "auxpow")]
        let autonomous = config.autonomous;

        let mut map = HashMap::new();
        map.insert(StreamId::Zion, StreamStats::new(StreamId::Zion));
        map.insert(
            StreamId::GpuExternal,
            StreamStats::new(StreamId::GpuExternal),
        );
        map.insert(
            StreamId::CpuExternal,
            StreamStats::new(StreamId::CpuExternal),
        );
        let stats = Arc::new(Mutex::new(map));
        let config = Arc::new(config);

        // ── Initialize GPU backend for Stream 1 (ZION deeksha) ──
        // When gpu_backend is not "cpu", create a GPU miner (CUDA/OpenCL/Metal)
        // for the canonical deeksha_lite_v1 algorithm. Falls back to CPU if init fails.
        let gpu_backend_str = config.gpu_backend.clone();
        let gpu_zion: Arc<std::sync::Mutex<Option<Box<dyn GpuMiner>>>> =
            Arc::new(std::sync::Mutex::new(None));
        if gpu_backend_str != "cpu" && !gpu_backend_str.is_empty() {
            let kind = parse_gpu_backend(&gpu_backend_str);
            let work_size = std::env::var("ZION_GPU_WORK_SIZE")
                .ok()
                .and_then(|v| v.trim().parse::<usize>().ok())
                .unwrap_or(8192);
            let algorithm = std::env::var("ZION_MINER_ALGORITHM")
                .unwrap_or_else(|_| "deeksha_lite_v1".to_string());
            match create_gpu_backend(kind, work_size, &algorithm, "") {
                Ok(miner) => {
                    let name = miner.device_name();
                    let backend = miner.backend_kind().as_str();
                    println!(
                        "gpu_zion_init backend={} device=\"{}\" work_size={} algorithm={}",
                        backend, name, work_size, algorithm
                    );
                    *gpu_zion.lock().unwrap() = Some(miner);
                }
                Err(e) => {
                    eprintln!(
                        "gpu_zion_init_failed backend={} reason=\"{}\" — falling back to CPU",
                        gpu_backend_str, e
                    );
                }
            }
        }

        #[cfg(feature = "auxpow")]
        {
            let mut profit_router =
                AutonomousProfitRouter::new(HardwareProfile::default_for_features());
            profit_router.enabled = autonomous;
            profit_router.set_hysteresis(profit_hysteresis_pct);
            profit_router.set_fetch_interval(profit_interval_sec);
            if let Some(coin) = stream2_force_coin {
                profit_router.stream2_coin = Some(coin);
            }
            if let Some(coin) = stream3_force_coin {
                profit_router.stream3_coin = Some(coin);
            }

            Self {
                config,
                consensus,
                stats,
                gpu_zion,
                gpu_ext: Arc::new(std::sync::Mutex::new(None)),
                gpu_ext_algo: Arc::new(std::sync::Mutex::new(None)),
                zion_nonce_cursor: Arc::new(std::sync::atomic::AtomicU64::new(0)),
                scheduler: Arc::new(Mutex::new(AuxPoWScheduler::new(
                    hashrate_per_unit,
                    stream2_force_coin,
                    stream3_force_coin,
                ))),
                gpu_client: Arc::new(Mutex::new(None)),
                cpu_client: Arc::new(Mutex::new(None)),
                profit_router: Arc::new(std::sync::Mutex::new(profit_router)),
            }
        }
        #[cfg(not(feature = "auxpow"))]
        {
            Self {
                config,
                consensus,
                stats,
                gpu_zion,
                zion_nonce_cursor: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            }
        }
    }

    /// Access the miner configuration.
    pub fn config(&self) -> &MinerConfig {
        &self.config
    }

    /// Build a coinbase transaction paying the configured reward address.
    fn coinbase(&self, height: u64) -> Transaction {
        let reward = block_reward(height);
        Transaction {
            version: 1,
            inputs: vec![TransactionInput {
                previous_output: Hash::default(),
                index: height as u32,
                script: b"zion-miner".to_vec(),
            }],
            outputs: vec![TransactionOutput {
                address: self.config.reward_address.clone(),
                amount: reward,
            }],
            memo: b"coinbase".to_vec(),
        }
    }

    /// Mine the next ZION block after `parent` using the canonical PoW.
    pub async fn mine_zion_block(&self, parent: &BlockHeader) -> Result<Block, MinerError> {
        let height = parent.height + 1;
        let coinbase = self.coinbase(height);
        let transactions = vec![coinbase];
        let merkle_root = merkle_root(&transactions);

        let mut header = BlockHeader {
            previous_hash: self.consensus.header_hash(parent),
            merkle_root,
            height,
            timestamp: Utc::now().timestamp() as u64,
            nonce: 0,
            difficulty: parent.difficulty,
        };

        let target = [0xFFu8; 32];
        let batch_size = self.config.zion_nonce_batch;
        let t_start = Instant::now();
        let _hash = self
            .consensus
            .mine(&mut header, &target, 0, batch_size)
            .ok_or_else(|| MinerError::Consensus("no nonce found in batch".to_string()))?;
        let elapsed = t_start.elapsed().as_secs_f64();
        self.update_hashrate(StreamId::Zion, batch_size, elapsed).await;

        Ok(Block::new(header, transactions))
    }

    /// Fetch a block template from the configured node RPC and mine it.
    ///
    /// Returns the solved block ready for submission.
    pub async fn mine_node_template(&self) -> Result<Block, MinerError> {
        let rpc_url = self
            .config
            .node_rpc_url
            .as_ref()
            .ok_or_else(|| MinerError::Consensus("no node_rpc_url configured".to_string()))?;

        let template = fetch_block_template(rpc_url).await?;
        let mut header: BlockHeader = serde_json::from_str(&template.header_json)
            .map_err(|e| MinerError::Consensus(format!("template parse: {e}")))?;

        let target = parse_target_hex(&template.target_hex).unwrap_or([0xFF; 32]);

        self.consensus
            .mine(&mut header, &target, 0, self.config.zion_nonce_batch)
            .ok_or_else(|| MinerError::Consensus("no nonce found in batch".to_string()))?;

        Ok(Block::new(header, template.transactions))
    }

    /// Submit a solved block to the configured node RPC.
    pub async fn submit_block_to_node(&self, block: &Block) -> Result<(), MinerError> {
        let rpc_url = self
            .config
            .node_rpc_url
            .as_ref()
            .ok_or_else(|| MinerError::Consensus("no node_rpc_url configured".to_string()))?;

        submit_block_rpc(rpc_url, block).await
    }

    #[cfg(feature = "auxpow")]
    /// Mine a ZION share received from a stratum pool (Stream 1 pool mode).
    ///
    /// Fetches the next job from the pool, brute-forces a nonce that meets the
    /// pool target using the canonical ZION PoW, and submits the share. Returns
    /// a dummy block so the caller can record stats uniformly.
    async fn mine_zion_pool_share(
        &self,
        client: &mut crate::auxpow::StratumClient,
    ) -> Result<Block, MinerError> {
        let job = client
            .next_job(
                zion_cosmic_harmony::ExternalCoin::Bitcoin,
                Duration::from_secs(30),
            )
            .await
            .map_err(|e| MinerError::Consensus(format!("stratum job error: {e}")))?;

        let job: crate::auxpow::Job = job.into();
        let batch_size = self.config.zion_nonce_batch;
        let t_start = Instant::now();

        // ── Try GPU first (Stream 1 ZION deeksha), fall back to CPU ──
        // GPU mine_batch is synchronous CUDA/OpenCL and blocks for ~0.5-2s per batch.
        // We run it on a blocking thread so it doesn't stall the tokio runtime
        // (which would prevent the stratum client from reading pool messages).
        let gpu_zion = self.gpu_zion.clone();
        let header_for_gpu = job.header.clone();
        let target_for_gpu = job.target;
        let batch_for_gpu = batch_size;
        let gpu_result = task::spawn_blocking(move || {
            let mut gpu_guard = gpu_zion.lock().unwrap();
            if let Some(ref mut gpu) = gpu_guard.as_mut() {
                let mut header_bytes = [0u8; 80];
                let copy_len = header_for_gpu.len().min(80);
                header_bytes[..copy_len].copy_from_slice(&header_for_gpu[..copy_len]);
                let mining_header = MiningHeader::from_bytes(header_bytes);
                let target = V3DiffTarget { bytes: target_for_gpu };
                match gpu.mine_batch(mining_header, target, 0, batch_for_gpu) {
                    Ok(result) => {
                        let nonces_tested = result.nonces_tested;
                        if let Some((found_nonce, found_hash, _mix)) = result.solutions.into_iter().next() {
                            return Some((found_nonce, found_hash, nonces_tested));
                        }
                        // GPU found no solution — return how many nonces were tested
                        // so the hashrate is still accurate for the CPU fallback.
                        return None;
                    }
                    Err(e) => {
                        eprintln!("gpu_zion_batch_failed reason=\"{}\" — falling back to CPU", e);
                    }
                }
            }
            None
        })
        .await
        .map_err(|e| MinerError::Consensus(format!("gpu task join: {e}")))?;

        let (nonce, _hash, nonces_searched) = if let Some((found_nonce, found_hash, gpu_tested)) = gpu_result {
            // GPU found a solution — nonces_searched = actual GPU nonces tested
            (found_nonce, Hash::new(found_hash), gpu_tested)
        } else {
            // No GPU or GPU found no solution — CPU mining
            // Use parallel search across all CPU threads via spawn_blocking
            // (prevents blocking the tokio runtime while rayon workers mine).
            let header = job.header.clone();
            let target = job.target;
            let threads = self.config.miner_threads.max(1);
            let result = task::spawn_blocking(move || {
                parallel_zion_find_nonce(&header, &target, 0, batch_size, threads)
            })
            .await
            .map_err(|e| MinerError::Consensus(format!("cpu parallel join: {e}")))?
            .ok_or(MinerError::NoAuxPoWSolution)?;
            let (found_nonce, found_hash) = result;
            // Nonces actually searched = found_nonce - 0 + 1
            let actual_searched = found_nonce.saturating_sub(0) + 1;
            (found_nonce, found_hash, actual_searched)
        };

        let elapsed = t_start.elapsed().as_secs_f64();
        self.update_hashrate(StreamId::Zion, nonces_searched, elapsed).await;

        let mut header_hash = [0u8; 32];
        let copy_len = job.header.len().min(32);
        header_hash[..copy_len].copy_from_slice(&job.header[..copy_len]);
        let share = crate::auxpow::Share {
            job_id: job.job_id,
            coin: zion_cosmic_harmony::ExternalCoin::Bitcoin,
            nonce,
            hash: _hash.0,
            header_hash,
            mix_hash: None,
            solution: None,
            extranonce2: job.extranonce2,
            ntime: job.ntime,
        };

        match client.submit_share(&share).await {
            Ok(ShareResult::Accepted) => {
                self.record_accepted(StreamId::Zion).await;
                info!(nonce = nonce, "zion pool share accepted");
            }
            Ok(ShareResult::Rejected(reason)) => {
                self.record_rejected(StreamId::Zion).await;
                warn!(nonce = nonce, reason = %reason, "zion pool share rejected");
            }
            Ok(ShareResult::Unknown) => {
                warn!(nonce = nonce, "zion pool share response unknown");
            }
            Ok(ShareResult::NoShare) => {}
            Err(e) => {
                warn!(error = %e, nonce = nonce, "zion pool share submit failed");
            }
        }

        // Return a dummy block for stats tracking; real block assembly happens
        // on the pool side.
        let header = BlockHeader {
            previous_hash: Hash::default(),
            merkle_root: Hash::default(),
            height: 0,
            timestamp: Utc::now().timestamp() as u64,
            nonce,
            difficulty: 1,
        };
        Ok(Block::new(header, vec![]))
    }

    /// Return a snapshot of all stream statistics.
    pub async fn stats(&self) -> HashMap<StreamId, StreamStats> {
        self.stats.lock().await.clone()
    }

    /// Total accepted shares across all streams.
    pub async fn total_shares(&self) -> u64 {
        self.stats().await.values().map(|s| s.accepted).sum()
    }

    #[cfg(feature = "auxpow")]
    /// Mine a single AuxPoW share for `job` using the configured batch.
    pub async fn mine_auxpow_share(
        &self,
        stream: StreamId,
        job: &Job,
    ) -> Result<Share, MinerError> {
        let batch = match stream {
            StreamId::GpuExternal => self.config.stream2_batch,
            StreamId::CpuExternal => self.config.stream3_batch,
            _ => self.config.auxpow_nonce_batch,
        };
        self.mine_auxpow_share_batch(stream, job, batch).await
    }

    #[cfg(feature = "auxpow")]
    /// Mine a single AuxPoW share for `job` using a custom batch.
    ///
    /// Stream 2 (GpuExternal) uses GPU mining with burst/gap duty-cycle
    /// time-slicing — after each batch, sleeps gap_ms to yield GPU to
    /// Stream 1 (ZION). This mirrors the V3 reference `external_gpu_thread`.
    /// Stream 3 (CpuExternal) uses CPU `parallel` scanner (VerusHash).
    pub async fn mine_auxpow_share_batch(
        &self,
        stream: StreamId,
        job: &Job,
        batch: u64,
    ) -> Result<Share, MinerError> {
        // Stream 2: GPU with duty-cycle time-slicing (like V3 reference)
        if stream == StreamId::GpuExternal && self.config.gpu_backend != "cpu" {
            if let Some(share) = self.try_gpu_ext_share(job, batch).await {
                // Duty-cycle yield: sleep gap_ms so Stream 1 (ZION) gets GPU.
                // Time-based: gap = batch_ms * (100 - duty) / duty
                let duty_pct = std::env::var("ZION_EXT_GPU_TIME_DUTY_PCT")
                    .ok()
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(50);
                let max_gap_ms = std::env::var("ZION_EXT_GPU_MAX_GAP_MS")
                    .ok()
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(5000);
                // We don't know exact batch_ms here, use fixed gap from env
                let gap_ms = std::env::var("ZION_EXT_GPU_GAP_MS")
                    .ok()
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(300);
                let _ = (duty_pct, max_gap_ms); // used in time-based mode
                tokio::time::sleep(Duration::from_millis(gap_ms)).await;
                return Ok(share);
            }
            // GPU failed — fall through to CPU
        }

        let job = job.clone();
        let threads = self.config.miner_threads;
        let share =
            task::spawn_blocking(move || crate::parallel::find_auxpow_share(&job, threads, batch))
                .await
                .map_err(|e| MinerError::Consensus(format!("cpu scanner join: {e}")))?
                .ok_or(MinerError::NoAuxPoWSolution)?;
        Ok(share)
    }

    /// Try GPU mining for Stream 2 (external GPU coin) using a persistent
    /// GPU backend. The backend is lazily initialized on first call and
    /// reused across batches (avoiding expensive DAG reload + kernel
    /// compile per batch). When the algorithm changes, the backend is
    /// recreated.
    #[cfg(feature = "auxpow")]
    async fn try_gpu_ext_share(&self, job: &Job, batch: u64) -> Option<Share> {
        let algorithm = job.coin.algorithm();
        if algorithm.starts_with("kheavyhash") {
            return None; // CPU-only for now
        }

        let coin_ticker = job.coin.ticker();
        let header = job.header.clone();
        let target = DifficultyTarget { bytes: job.target };
        let coin = job.coin;
        let job_id = job.job_id.clone();
        let extranonce2 = job.extranonce2.clone();
        let extranonce1 = job.extranonce.clone();
        let ntime = job.ntime.clone();
        let height = job.height;
        let work_size = batch as usize;

        let mut header_hash = [0u8; 32];
        let copy_len = header.len().min(32);
        header_hash[..copy_len].copy_from_slice(&header[..copy_len]);

        let gpu_ext = self.gpu_ext.clone();
        let gpu_ext_algo = self.gpu_ext_algo.clone();
        let kind = parse_gpu_backend(&self.config.gpu_backend);

        let gpu_result = task::spawn_blocking(move || {
            // Check if we need to (re)create the GPU backend for this algorithm
            let need_recreate = {
                let algo_guard = gpu_ext_algo.lock().unwrap();
                algo_guard.as_deref() != Some(algorithm)
            };
            if need_recreate {
                eprintln!(
                    "gpu_ext_init algo={} coin={} work_size={} — creating persistent backend",
                    algorithm, coin_ticker, work_size
                );
                let miner = create_gpu_backend(kind, work_size, algorithm, coin_ticker)
                    .map_err(|e| anyhow::anyhow!("{e}"))?;
                *gpu_ext.lock().unwrap() = Some(miner);
                *gpu_ext_algo.lock().unwrap() = Some(algorithm.to_string());
                eprintln!("gpu_ext_init ok algo={}", algorithm);
            }

            let mut gpu_guard = gpu_ext.lock().unwrap();
            let gpu = match gpu_guard.as_mut() {
                Some(g) => g,
                None => return Ok::<_, anyhow::Error>(None),
            };

            // Update epoch/DAG when height changes (ProgPoW period = 50 blocks)
            gpu.update_epoch(height)
                .map_err(|e| anyhow::anyhow!("epoch update: {e}"))?;

            let result = gpu
                .mine_batch_raw(&header, target, 0, batch)
                .map_err(|e| anyhow::anyhow!("mine_batch_raw: {e}"))?;
            Ok(Some(result))
        })
        .await;

        match gpu_result {
            Ok(Ok(Some(gpu_result))) => {
                if let Some((nonce, hash, mix)) = gpu_result.solutions.into_iter().next() {
                    let solution =
                        if algorithm == "verushash" || algorithm.starts_with("verushash_") {
                            crate::auxpow::hasher::build_verushash_solution(
                                &job.header,
                                nonce,
                                &extranonce1,
                            )
                        } else {
                            gpu_result.solution_blob
                        };
                    return Some(Share {
                        job_id,
                        coin,
                        nonce,
                        hash,
                        header_hash,
                        mix_hash: mix,
                        solution,
                        extranonce2,
                        ntime,
                    });
                }
            }
            Ok(Ok(None)) => {} // no solution in batch — normal
            Ok(Err(e)) => {
                eprintln!("gpu_ext_batch_failed algo={} err=\"{}\"", algorithm, e);
                warn!(stream = "gpu_ext", error = %e, "gpu ext mining failed");
            }
            Err(e) => {
                eprintln!("gpu_ext_task_failed algo={} err=\"{}\"", algorithm, e);
                warn!(stream = "gpu_ext", error = %e, "gpu ext task failed");
            }
        }
        None
    }

    #[cfg(feature = "auxpow")]
    /// Refresh profit estimates and return selected GPU/CPU coins.
    ///
    /// When `config.autonomous` is enabled, uses the persisted
    /// `AutonomousProfitRouter` to fetch estimates and apply hysteresis before
    /// switching.  The synchronous oracle work is run on a blocking thread so
    /// the async runtime is not stalled by network I/O.
    pub async fn refresh_auxpow(
        &self,
        profiles: &[zion_cosmic_harmony::CoinProfile],
    ) -> (
        Option<zion_cosmic_harmony::ExternalCoin>,
        Option<zion_cosmic_harmony::ExternalCoin>,
    ) {
        let (gpu, cpu) = if self.config.autonomous {
            let router = self.profit_router.clone();
            match tokio::task::spawn_blocking(move || {
                let mut r = router.lock().map_err(|e| e.to_string())?;
                if r.has_profit_data() {
                    r.reevaluate();
                } else {
                    r.initial_selection();
                }
                Ok::<
                    (
                        Option<zion_cosmic_harmony::ExternalCoin>,
                        Option<zion_cosmic_harmony::ExternalCoin>,
                    ),
                    String,
                >((r.stream2_coin, r.stream3_coin))
            })
            .await
            {
                Ok(Ok((gpu, cpu))) => (gpu, cpu),
                Ok(Err(e)) => {
                    warn!("profit router error: {e}");
                    (None, None)
                }
                Err(e) => {
                    warn!("profit task failed: {e}");
                    (None, None)
                }
            }
        } else {
            (None, None)
        };

        let mut scheduler = self.scheduler.lock().await;

        if self.config.autonomous {
            if let Some(coin) = gpu {
                scheduler.set_gpu(coin, profiles);
            }
            if let Some(coin) = cpu {
                scheduler.set_cpu(coin, profiles);
            }
            info!(
                gpu = ?gpu,
                cpu = ?cpu,
                "autonomous profit re-evaluation complete"
            );
        } else {
            scheduler.refresh(profiles);
        }

        (scheduler.current_gpu(), scheduler.current_cpu())
    }

    /// Run all enabled mining streams until the shutdown signal is received.
    pub async fn run(&self, shutdown: watch::Receiver<bool>) -> Result<(), MinerError> {
        let mut shutdown_for_changed = shutdown.clone();

        let h1: MinerHandle = if self.config.stream1_enabled {
            let this = self.clone();
            let mut shutdown = shutdown.clone();
            tokio::spawn(async move {
                // Mode selection: pool_url > node_rpc_url > solo.
                let use_pool = this.config.pool_url.is_some();
                let use_node = !use_pool && this.config.node_rpc_url.is_some();
                let mut parent = genesis_header();

                // Stratum client for pool mode (Stream 1).
                #[cfg(feature = "auxpow")]
                let mut pool_client: Option<crate::auxpow::StratumClient> = if use_pool {
                    let url = this.config.pool_url.clone().unwrap_or_default();
                    // ZION pool expects username = WALLET.worker so it can map shares
                    // to a payout address and worker telemetry.
                    let worker = format!(
                        "{}.{}",
                        this.config.reward_address.as_str(),
                        this.config.worker
                    );
                    let password = this.config.password.clone();
                    let client = crate::auxpow::StratumClient::new(
                        &url,
                        &worker,
                        &password,
                        zion_cosmic_harmony::ExternalCoin::Bitcoin,
                    );
                    if let Err(e) = client.connect().await {
                        warn!(error = %e, "zion pool stratum connect failed, falling back to solo");
                        None
                    } else {
                        info!(url = %url, "zion pool stratum connected");
                        Some(client)
                    }
                } else {
                    None
                };

                loop {
                    tokio::select! {
                        _ = shutdown.changed() => break,
                        result = async {
                            #[cfg(feature = "auxpow")]
                            if let Some(client) = pool_client.as_mut() {
                                return this.mine_zion_pool_share(client).await;
                            }
                            let _ = use_pool; // silence unused warning when auxpow disabled
                            if use_node {
                                let block = this.mine_node_template().await?;
                                this.submit_block_to_node(&block).await?;
                                Ok(block)
                            } else {
                                this.mine_zion_block(&parent).await
                            }
                        } => {
                            this.mark_active(StreamId::Zion).await;
                            match result {
                                Ok(block) => {
                                    if !use_node {
                                        parent = block.header.clone();
                                    }
                                    if !use_pool {
                                        this.record_accepted(StreamId::Zion).await;
                                    }
                                    info!(
                                        height = block.header.height,
                                        nonce = block.header.nonce,
                                        mode = if use_pool { "pool" } else if use_node { "node" } else { "solo" },
                                        "mined zion block"
                                    );
                                }
                                Err(e) => warn!(error = %e, "zion mining batch failed"),
                            }
                            sleep(Duration::from_millis(10)).await;
                        }
                    }
                }
                Ok(())
            })
        } else {
            tokio::spawn(async { Ok::<(), MinerError>(()) })
        };

        // Streams 2 and 3 are compiled only with the `auxpow` feature.
        #[cfg(feature = "auxpow")]
        let (h2, h3): (MinerHandle, MinerHandle) = {
            let profiles = zion_cosmic_harmony::CoinProfile::defaults();
            let _ = self.refresh_auxpow(&profiles).await;

            let h2 = if self.config.stream2_enabled && self.config.auxpow_enabled {
                let this = self.clone();
                let mut shutdown = shutdown.clone();
                tokio::spawn(async move {
                    loop {
                        tokio::select! {
                            _ = shutdown.changed() => break,
                            result = this.auxpow_stream_round(StreamId::GpuExternal) => {
                                this.mark_active(StreamId::GpuExternal).await;
                                if let Err(e) = result {
                                    warn!(stream = "gpu", error = %e, "auxpow stream round failed; retrying after backoff");
                                    sleep(Duration::from_millis(this.config.auxpow_retry_ms)).await;
                                }
                            }
                        }
                    }
                    Ok(())
                })
            } else {
                tokio::spawn(async { Ok::<(), MinerError>(()) })
            };

            let h3 = if self.config.stream3_enabled && self.config.auxpow_enabled {
                let this = self.clone();
                let mut shutdown = shutdown.clone();
                tokio::spawn(async move {
                    loop {
                        tokio::select! {
                            _ = shutdown.changed() => break,
                            result = this.auxpow_stream_round(StreamId::CpuExternal) => {
                                this.mark_active(StreamId::CpuExternal).await;
                                if let Err(e) = result {
                                    warn!(stream = "cpu", error = %e, "auxpow stream round failed; retrying after backoff");
                                    sleep(Duration::from_millis(this.config.auxpow_retry_ms)).await;
                                }
                            }
                        }
                    }
                    Ok(())
                })
            } else {
                tokio::spawn(async { Ok::<(), MinerError>(()) })
            };

            (h2, h3)
        };

        // Periodically re-evaluate Stream 2/3 coin profitability.
        #[cfg(feature = "auxpow")]
        let h_profit: MinerHandle = if self.config.auxpow_enabled && self.config.autonomous {
            let this = self.clone();
            let mut shutdown = shutdown.clone();
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_secs(
                    this.config.profit_interval_sec.max(60),
                ));
                loop {
                    tokio::select! {
                        _ = shutdown.changed() => break,
                        _ = interval.tick() => {
                            let profiles = zion_cosmic_harmony::CoinProfile::defaults();
                            let (gpu, cpu) = this.refresh_auxpow(&profiles).await;
                            info!(
                                gpu = ?gpu,
                                cpu = ?cpu,
                                interval_sec = this.config.profit_interval_sec,
                                "autonomous profit re-evaluation complete"
                            );
                        }
                    }
                }
                Ok(())
            })
        } else {
            tokio::spawn(async { Ok::<(), MinerError>(()) })
        };

        #[cfg(not(feature = "auxpow"))]
        let h_profit: MinerHandle = tokio::spawn(async { Ok::<(), MinerError>(()) });

        #[cfg(not(feature = "auxpow"))]
        let (h2, h3): (MinerHandle, MinerHandle) = (
            tokio::spawn(async { Ok::<(), MinerError>(()) }),
            tokio::spawn(async { Ok::<(), MinerError>(()) }),
        );

        let _ = shutdown_for_changed.changed().await;
        let (r1, r2, r3, r_profit) = tokio::join!(h1, h2, h3, h_profit);
        r1??;
        r2??;
        r3??;
        r_profit??;
        Ok(())
    }

    /// Run Trinity mode: single V3 protocol connection to the pool carries
    /// all 3 streams (ZION + GPU AuxPoW + CPU AuxPoW). The pool embeds
    /// `external_stream` and `external_stream_cpu` fields in each Job message,
    /// and the miner submits shares back via `Submit` (ZION) and
    /// `ExternalSubmit` (AuxPoW).
    ///
    /// This replaces the legacy direct-stratum-connection mode where the
    /// miner connected separately to external pools. All revenue flows
    /// through the pool's AuxPoW bridge and revenue system.
    #[cfg(feature = "auxpow")]
    pub async fn run_v3_trinity(
        &self,
        shutdown: watch::Receiver<bool>,
    ) -> Result<(), MinerError> {
        use tokio::sync::broadcast;

        // Outer reconnect loop: if the pool connection drops, reconnect with
        // exponential backoff. This handles pool restarts and network blips.
        let mut reconnect_delay_secs: u64 = 3;
        let max_reconnect_delay_secs: u64 = 60;
        loop {
            if *shutdown.borrow() {
                return Ok(());
            }
            match self.run_v3_trinity_session(shutdown.clone()).await {
                Ok(()) => return Ok(()),
                Err(e) => {
                    warn!(error = %e, "V3 Trinity session ended, reconnecting in {}s", reconnect_delay_secs);
                    eprintln!("v3_trinity reconnect in {}s: {}", reconnect_delay_secs, e);
                    let mut shutdown_rx = shutdown.clone();
                    tokio::select! {
                        _ = tokio::time::sleep(Duration::from_secs(reconnect_delay_secs)) => {}
                        _ = shutdown_rx.changed() => return Ok(()),
                    }
                    reconnect_delay_secs = (reconnect_delay_secs * 2).min(max_reconnect_delay_secs);
                }
            }
        }
    }

    #[cfg(feature = "auxpow")]
    async fn run_v3_trinity_session(
        &self,
        shutdown: watch::Receiver<bool>,
    ) -> Result<(), MinerError> {
        use tokio::sync::broadcast;

        let pool_addr = self
            .config
            .pool_url
            .as_deref()
            .ok_or_else(|| MinerError::Consensus("V3 trinity requires --pool".into()))?;

        // miner_id = wallet address (pool uses this for payout mapping)
        let miner_id = self.config.reward_address.as_str().to_string();
        let worker_name = format!(
            "{}.{}",
            self.config.reward_address.as_str(),
            self.config.worker
        );
        let algorithm = "deeksha_lite_v1".to_string();
        let backend = self.config.gpu_backend.clone();

        // Connect V3PoolClient (shared across all 3 streams via Arc)
        let client = Arc::new(
            V3PoolClient::connect(
                pool_addr,
                &miner_id,
                &worker_name,
                &algorithm,
                &backend,
                self.config.reward_address.as_str(),
            )
            .await
            .map_err(|e| MinerError::Consensus(format!("V3 pool connect: {e}")))?,
        );

        info!(
            pool = %pool_addr,
            miner = %miner_id,
            worker = %worker_name,
            "V3 Trinity connected — all 3 streams through pool"
        );
        eprintln!("v3_trinity connected pool={} miner={}", pool_addr, miner_id);

        // Broadcast channel: Stream 1 receives jobs from pool, broadcasts to 2 & 3
        let (job_tx, _) = broadcast::channel::<crate::v3_pool_client::V3JobBundle>(32);

        // ── Stream 1: ZION mining (GPU deeksha) — also distributes jobs ──
        let h1 = {
            let this = self.clone();
            let client = client.clone();
            let job_tx = job_tx.clone();
            let mut shutdown = shutdown.clone();
            tokio::spawn(async move {
                // Get the initial job, then continuously mine shares with it
                // until a new job arrives. This ensures we search many nonces
                // per job instead of just one share per job.
                let mut current_bundle: Option<crate::v3_pool_client::V3JobBundle> = None;

                loop {
                    tokio::select! {
                        _ = shutdown.changed() => break,
                        result = async {
                            // If we have a current job, mine a share with it.
                            // Otherwise, wait for the first job.
                            if let Some(bundle) = &current_bundle {
                                // Mine ZION share with the current job
                                this.mine_v3_zion_share(&client, &bundle.zion).await
                            } else {
                                // Wait for first job
                                let bundle = client.next_job(Duration::from_secs(60)).await
                                    .map_err(|e| MinerError::Consensus(format!("V3 job: {e}")))?;
                                this.zion_nonce_cursor.store(
                                    bundle.zion.start_nonce,
                                    std::sync::atomic::Ordering::Relaxed,
                                );
                                if let Some(ref ext) = bundle.gpu_external {
                                    eprintln!("v3_trinity gpu_external coin={} job_id={} height={}", ext.coin, ext.job_id, ext.height);
                                }
                                if let Some(ref ext) = bundle.cpu_external {
                                    eprintln!("v3_trinity cpu_external coin={} job_id={} height={}", ext.coin, ext.job_id, ext.height);
                                }
                                let _ = job_tx.send(bundle.clone());
                                current_bundle = Some(bundle);
                                // Mine first share with the new job
                                if let Some(bundle) = &current_bundle {
                                    this.mine_v3_zion_share(&client, &bundle.zion).await
                                } else {
                                    return Ok(false);
                                }
                            }
                        } => {
                            this.mark_active(StreamId::Zion).await;
                            match result {
                                Ok(accepted) => {
                                    if accepted {
                                        this.record_accepted(StreamId::Zion).await;
                                    }
                                }
                                Err(e) => {
                                    warn!(error = %e, "V3 Trinity: ZION mining error");
                                    sleep(Duration::from_millis(100)).await;
                                }
                            }

                            // Check if a new job has arrived (non-blocking)
                            if let Some(new_bundle) = client.try_next_job().await {
                                this.zion_nonce_cursor.store(
                                    new_bundle.zion.start_nonce,
                                    std::sync::atomic::Ordering::Relaxed,
                                );
                                if let Some(ref ext) = new_bundle.gpu_external {
                                    eprintln!("v3_trinity gpu_external coin={} job_id={} height={}", ext.coin, ext.job_id, ext.height);
                                }
                                if let Some(ref ext) = new_bundle.cpu_external {
                                    eprintln!("v3_trinity cpu_external coin={} job_id={} height={}", ext.coin, ext.job_id, ext.height);
                                }
                                let _ = job_tx.send(new_bundle.clone());
                                current_bundle = Some(new_bundle);
                            }

                            // If no current job, wait for one
                            if current_bundle.is_none() {
                                match client.next_job(Duration::from_secs(60)).await {
                                    Ok(bundle) => {
                                        this.zion_nonce_cursor.store(
                                            bundle.zion.start_nonce,
                                            std::sync::atomic::Ordering::Relaxed,
                                        );
                                        if let Some(ref ext) = bundle.gpu_external {
                                            eprintln!("v3_trinity gpu_external coin={} job_id={} height={}", ext.coin, ext.job_id, ext.height);
                                        }
                                        if let Some(ref ext) = bundle.cpu_external {
                                            eprintln!("v3_trinity cpu_external coin={} job_id={} height={}", ext.coin, ext.job_id, ext.height);
                                        }
                                        let _ = job_tx.send(bundle.clone());
                                        current_bundle = Some(bundle);
                                    }
                                    Err(e) => {
                                        warn!(error = %e, "V3 Trinity: ZION job wait error");
                                        sleep(Duration::from_secs(5)).await;
                                    }
                                }
                            }
                        }
                    }
                }
                Ok::<(), MinerError>(())
            })
        };

        // ── Stream 2: GPU AuxPoW (ZANO) ──
        let h2 = {
            let this = self.clone();
            let client = client.clone();
            let mut job_rx = job_tx.subscribe();
            let mut shutdown = shutdown.clone();
            let stream2_enabled = self.config.stream2_enabled;
            tokio::spawn(async move {
                if !stream2_enabled {
                    return Ok::<(), MinerError>(());
                }
                loop {
                    tokio::select! {
                        _ = shutdown.changed() => break,
                        result = async {
                            // Receive job bundle from broadcast
                            let bundle = job_rx.recv().await
                                .map_err(|e| MinerError::Consensus(format!("V3 broadcast: {e}")))?;

                            // Mine GPU external stream if present
                            if let Some(ref ext) = bundle.gpu_external {
                                this.mine_v3_external_share(&client, StreamId::GpuExternal, ext).await
                            } else {
                                Ok(false)
                            }
                        } => {
                            this.mark_active(StreamId::GpuExternal).await;
                            if let Err(e) = result {
                                eprintln!("v3_trinity gpu_ext_error: {}", e);
                                warn!(error = %e, "V3 Trinity: GPU AuxPoW error");
                                sleep(Duration::from_millis(50)).await;
                            }
                        }
                    }
                }
                Ok::<(), MinerError>(())
            })
        };

        // ── Stream 3: CPU AuxPoW (VRSC) ──
        let h3 = {
            let this = self.clone();
            let client = client.clone();
            let mut job_rx = job_tx.subscribe();
            let mut shutdown = shutdown.clone();
            let stream3_enabled = self.config.stream3_enabled;
            tokio::spawn(async move {
                if !stream3_enabled {
                    return Ok::<(), MinerError>(());
                }
                loop {
                    tokio::select! {
                        _ = shutdown.changed() => break,
                        result = async {
                            let bundle = job_rx.recv().await
                                .map_err(|e| MinerError::Consensus(format!("V3 broadcast: {e}")))?;

                            if let Some(ref ext) = bundle.cpu_external {
                                this.mine_v3_external_share(&client, StreamId::CpuExternal, ext).await
                            } else {
                                Ok(false)
                            }
                        } => {
                            this.mark_active(StreamId::CpuExternal).await;
                            if let Err(e) = result {
                                eprintln!("v3_trinity cpu_ext_error: {}", e);
                                warn!(error = %e, "V3 Trinity: CPU AuxPoW error");
                                sleep(Duration::from_millis(50)).await;
                            }
                        }
                    }
                }
                Ok::<(), MinerError>(())
            })
        };

        let mut shutdown_for_changed = shutdown.clone();
        let _ = shutdown_for_changed.changed().await;
        let (r1, r2, r3) = tokio::join!(h1, h2, h3);
        r1??;
        r2??;
        r3??;
        Ok(())
    }

    /// Mine a ZION share from a V3 protocol job and submit it to the pool.
    /// Returns Ok(true) if the share was accepted.
    #[cfg(feature = "auxpow")]
    async fn mine_v3_zion_share(
        &self,
        client: &V3PoolClient,
        job: &crate::v3_pool_client::V3ZionJob,
    ) -> Result<bool, MinerError> {
        let header = hex::decode(&job.header_hex)
            .map_err(|e| MinerError::Consensus(format!("V3 header decode: {e}")))?;
        let target = hex::decode(&job.target_hex)
            .map_err(|e| MinerError::Consensus(format!("V3 target decode: {e}")))?;
        let mut target_bytes = [0u8; 32];
        let copy_len = target.len().min(32);
        target_bytes[..copy_len].copy_from_slice(&target[..copy_len]);

        let batch_size = self.config.zion_nonce_batch;
        let t_start = Instant::now();

        // Advance nonce cursor — don't always scan from 0.
        // The pool sends start_nonce=0 + nonce_count=0xFFFFFFFF (full range),
        // so we track our own cursor and advance it by batch_size each iteration.
        let start_nonce = self.zion_nonce_cursor.fetch_add(
            batch_size,
            std::sync::atomic::Ordering::Relaxed,
        );

        // Try GPU first, fall back to CPU
        let gpu_zion = self.gpu_zion.clone();
        let header_for_gpu = header.clone();
        let target_for_gpu = target_bytes;
        let gpu_result = task::spawn_blocking(move || {
            let mut gpu_guard = gpu_zion.lock().unwrap();
            if let Some(ref mut gpu) = gpu_guard.as_mut() {
                let mut header_bytes = [0u8; 80];
                let copy_len = header_for_gpu.len().min(80);
                header_bytes[..copy_len].copy_from_slice(&header_for_gpu[..copy_len]);
                let mining_header = zion_core::MiningHeader::from_bytes(header_bytes);
                let target = zion_core::V3DifficultyTarget { bytes: target_for_gpu };
                match gpu.mine_batch(mining_header, target, start_nonce, batch_size) {
                    Ok(result) => {
                        let nonces_tested = result.nonces_tested;
                        if let Some((found_nonce, found_hash, _mix)) = result.solutions.into_iter().next() {
                            return Some((found_nonce, found_hash, nonces_tested));
                        }
                        return None;
                    }
                    Err(e) => {
                        eprintln!("gpu_zion_batch_failed reason=\"{}\" — falling back to CPU", e);
                    }
                }
            }
            None
        })
        .await
        .map_err(|e| MinerError::Consensus(format!("gpu task join: {e}")))?;

        let (nonce, hash_bytes, nonces_searched) = if let Some((n, h, tested)) = gpu_result {
            (n, h, tested)
        } else {
            // CPU fallback
            let threads = self.config.miner_threads.max(1);
            let header_cpu = header.clone();
            let target_cpu = target_bytes;
            let result = task::spawn_blocking(move || {
                parallel_zion_find_nonce(&header_cpu, &target_cpu, start_nonce, batch_size, threads)
            })
            .await
            .map_err(|e| MinerError::Consensus(format!("cpu join: {e}")))?
            .ok_or(MinerError::NoAuxPoWSolution)?;
            let (n, h) = result;
            (n, h.0, n.saturating_sub(0) + 1)
        };

        let elapsed = t_start.elapsed().as_secs_f64();
        self.update_hashrate(StreamId::Zion, nonces_searched, elapsed).await;

        let hash_hex = hex::encode(&hash_bytes);
        let elapsed_ms = (elapsed * 1000.0) as u64;
        let result = client
            .submit_zion_share(job.job_id, nonce, &hash_hex, None, nonces_searched, elapsed_ms)
            .await
            .map_err(|e| MinerError::Consensus(format!("V3 submit: {e}")))?;

        if result.accepted {
            info!(
                job = job.job_id,
                nonce,
                height = job.height,
                "V3 Trinity: ZION share accepted"
            );
        } else {
            warn!(
                job = job.job_id,
                nonce,
                status = %result.status,
                "V3 Trinity: ZION share rejected"
            );
            self.record_rejected(StreamId::Zion).await;
        }

        Ok(result.accepted)
    }

    /// Mine an AuxPoW (external) share from a V3 protocol external_stream job
    /// and submit it to the pool for forwarding to the external pool.
    #[cfg(feature = "auxpow")]
    async fn mine_v3_external_share(
        &self,
        client: &V3PoolClient,
        stream: StreamId,
        ext: &ExternalStreamJob,
    ) -> Result<bool, MinerError> {
        use zion_cosmic_harmony::ExternalCoin;

        let coin = ExternalCoin::from_ticker(&ext.coin)
            .ok_or_else(|| MinerError::Consensus(format!("unknown coin: {}", ext.coin)))?;

        // Convert ExternalStreamJob → auxpow::Job
        // Strip 0x prefix if present (EthStratum pools send hex with 0x prefix)
        let header_hex_stripped = ext.header_hex.strip_prefix("0x").unwrap_or(&ext.header_hex);
        let target_hex_stripped = ext.target_hex.strip_prefix("0x").unwrap_or(&ext.target_hex);
        let header = hex::decode(header_hex_stripped)
            .map_err(|e| MinerError::Consensus(format!("ext header decode: {e}")))?;
        let target_vec = hex::decode(target_hex_stripped)
            .map_err(|e| MinerError::Consensus(format!("ext target decode: {e}")))?;
        let mut target = [0u8; 32];
        let copy_len = target_vec.len().min(32);
        target[..copy_len].copy_from_slice(&target_vec[..copy_len]);

        let job = Job {
            job_id: ext.job_id.clone(),
            coin,
            header: header.clone(),
            target,
            extranonce: hex::decode(&ext.extranonce1_hex).unwrap_or_default(),
            extranonce2: String::new(),
            ntime: String::new(),
            height: ext.height,
        };

        eprintln!(
            "v3_trinity ext_mine_start stream={:?} coin={} algo={} header_len={} target_hex={} height={} batch={}",
            stream, ext.coin, ext.algorithm, header.len(), ext.target_hex, ext.height,
            match stream {
                StreamId::GpuExternal => self.config.stream2_batch,
                StreamId::CpuExternal => self.config.stream3_batch,
                _ => self.config.auxpow_nonce_batch,
            }
        );

        // Mine the share using existing GPU/CPU infrastructure
        let batch = match stream {
            StreamId::GpuExternal => self.config.stream2_batch,
            StreamId::CpuExternal => self.config.stream3_batch,
            _ => self.config.auxpow_nonce_batch,
        };

        let share = self.mine_auxpow_share_batch(stream, &job, batch).await?;
        eprintln!("v3_trinity mined_ext_share stream={:?} coin={} nonce={}", stream, coin, share.nonce);

        // Submit via V3PoolClient → pool forwards to external pool
        let hash_hex = hex::encode(&share.hash);
        let mix_hash_hex = share.mix_hash.as_ref().map(|m| hex::encode(m));
        let result = client
            .submit_external_share(
                &ext.coin,
                &ext.algorithm,
                &ext.job_id,
                share.nonce,
                &hash_hex,
                mix_hash_hex.as_deref(),
                &ext.extranonce1_hex,
            )
            .await
            .map_err(|e| MinerError::Consensus(format!("V3 external submit: {e}")))?;

        // Record stats
        let share_result = if result.accepted {
            ShareResult::Accepted
        } else {
            ShareResult::Rejected(result.status.clone())
        };
        self.record_share_result(stream, coin, &share_result).await;

        if result.accepted {
            info!(
                stream = ?stream,
                coin = %coin,
                nonce = share.nonce,
                job_id = %ext.job_id,
                "V3 Trinity: external share accepted"
            );
        } else {
            warn!(
                stream = ?stream,
                coin = %coin,
                nonce = share.nonce,
                status = %result.status,
                "V3 Trinity: external share rejected"
            );
        }

        Ok(result.accepted)
    }

    #[cfg(feature = "auxpow")]
    /// One iteration of an AuxPoW stream.
    async fn auxpow_stream_round(&self, stream: StreamId) -> Result<(), MinerError> {
        let (coin, url): (Option<zion_cosmic_harmony::ExternalCoin>, Option<String>) = {
            let scheduler = self.scheduler.lock().await;
            let (c, u) = match stream {
                StreamId::GpuExternal => scheduler.gpu_url(),
                StreamId::CpuExternal => scheduler.cpu_url(),
                _ => return Ok(()),
            };
            (c, u.map(|s| s.to_string()))
        };

        let Some(coin) = coin else {
            warn!(stream = ?stream, "no auxpow coin selected");
            sleep(Duration::from_millis(self.config.auxpow_retry_ms)).await;
            return Ok(());
        };

        let explicit_url = match stream {
            StreamId::GpuExternal => self.config.stream2_url.clone(),
            StreamId::CpuExternal => self.config.stream3_url.clone(),
            _ => None,
        };
        let url = explicit_url
            .or(self.config.auxpow_pool.clone())
            .or(url)
            .unwrap_or_default();

        if url.is_empty() {
            warn!(stream = ?stream, coin = %coin, "no stratum url for auxpow coin");
            sleep(Duration::from_millis(self.config.auxpow_retry_ms)).await;
            return Ok(());
        }

        let client_cell = match stream {
            StreamId::GpuExternal => &self.gpu_client,
            StreamId::CpuExternal => &self.cpu_client,
            _ => return Ok(()),
        };

        let mut guard = client_cell.lock().await;
        let should_recreate = guard.as_ref().map(|c| c.url != url).unwrap_or(true);
        if should_recreate {
            // Upstream AuxPoW pools expect username = payout_wallet.worker so
            // shares can be credited.  Fall back to the bare worker name if no
            // reward address is configured.
            let worker = if self.config.reward_address.as_str().is_empty() {
                self.config.worker.clone()
            } else {
                format!("{}.{}", self.config.reward_address.as_str(), self.config.worker)
            };
            *guard = Some(StratumClient::new(&url, &worker, &self.config.password, coin));
        }
        let client = guard
            .as_mut()
            .ok_or_else(|| MinerError::Consensus("stratum client missing".to_string()))?;

        let next_timeout = Duration::from_secs(10);
        let stratum_job = client
            .next_job(coin, next_timeout)
            .await
            .map_err(|e| MinerError::Consensus(format!("stratum job error: {e}")))?;
        let job: Job = stratum_job.into();

        drop(guard);

        let batch = match stream {
            StreamId::GpuExternal => self.config.stream2_batch,
            StreamId::CpuExternal => self.config.stream3_batch,
            _ => self.config.auxpow_nonce_batch,
        };

        let share = self.mine_auxpow_share_batch(stream, &job, batch).await?;

        let result = {
            let guard = client_cell.lock().await;
            if let Some(client) = guard.as_ref() {
                match client.submit_share(&share).await {
                    Ok(r) => r,
                    Err(e) => {
                        warn!(error = %e, "submit share failed");
                        ShareResult::Rejected(e.to_string())
                    }
                }
            } else {
                ShareResult::Rejected("stratum client missing".to_string())
            }
        };

        self.record_share_result(stream, coin, &result).await;
        match result {
            ShareResult::Accepted => {
                info!(stream = ?stream, coin = %coin, nonce = share.nonce, "mined auxpow share accepted");
            }
            ShareResult::Rejected(reason) => {
                warn!(stream = ?stream, coin = %coin, nonce = share.nonce, reason = %reason, "auxpow share rejected");
            }
            _ => {
                info!(stream = ?stream, coin = %coin, nonce = share.nonce, "mined auxpow share");
            }
        }
        Ok(())
    }

    async fn mark_active(&self, stream: StreamId) {
        let mut stats = self.stats.lock().await;
        if let Some(s) = stats.get_mut(&stream) {
            s.active = true;
        }
    }

    async fn record_accepted(&self, stream: StreamId) {
        let mut stats = self.stats.lock().await;
        if let Some(s) = stats.get_mut(&stream) {
            s.accepted += 1;
        }
    }

    async fn record_rejected(&self, stream: StreamId) {
        let mut stats = self.stats.lock().await;
        if let Some(s) = stats.get_mut(&stream) {
            s.rejected += 1;
        }
    }

    /// Update hashrate for a stream based on nonces searched and elapsed time.
    async fn update_hashrate(&self, stream: StreamId, nonces_searched: u64, elapsed_secs: f64) {
        if elapsed_secs < 0.001 {
            return;
        }
        let hr = nonces_searched as f64 / elapsed_secs;
        let mut stats = self.stats.lock().await;
        if let Some(s) = stats.get_mut(&stream) {
            // Exponential moving average for smooth display
            if s.hashrate > 0.0 {
                s.hashrate = s.hashrate * 0.7 + hr * 0.3;
            } else {
                s.hashrate = hr;
            }
        }
    }

    #[cfg(feature = "auxpow")]
    async fn record_share_result(
        &self,
        stream: StreamId,
        coin: zion_cosmic_harmony::ExternalCoin,
        result: &ShareResult,
    ) {
        let mut stats = self.stats.lock().await;
        if let Some(s) = stats.get_mut(&stream) {
            s.active = true;
            s.coin = Some(coin);
            s.algorithm = Some(coin.algorithm().to_string());
            s.shares_found += 1;
            match result {
                ShareResult::Accepted => s.accepted += 1,
                ShareResult::Rejected(_) => s.rejected += 1,
                _ => {}
            }
        }
    }
}

fn parse_gpu_backend(s: &str) -> GpuBackendKind {
    match s.trim().to_ascii_lowercase().as_str() {
        "opencl" | "ocl" => GpuBackendKind::OpenCL,
        "cuda" => GpuBackendKind::Cuda,
        "metal" => GpuBackendKind::Metal,
        "cpu" => GpuBackendKind::Cpu,
        _ => GpuBackendKind::Auto,
    }
}

/// Dummy genesis header for the runtime scaffold.
fn genesis_header() -> BlockHeader {
    BlockHeader {
        previous_hash: Hash::default(),
        merkle_root: Hash::default(),
        height: 0,
        timestamp: Utc::now().timestamp() as u64,
        nonce: 0,
        difficulty: 1,
    }
}

/// Simple block reward schedule: 50 ZION per block until height 1M.
fn block_reward(height: u64) -> Amount {
    if height < 1_000_000 {
        Amount::new(50_000_000)
    } else {
        Amount::ZERO
    }
}

/// Simple merkle root: SHA3-256 of the concatenation of transaction hashes.
fn merkle_root(transactions: &[Transaction]) -> Hash {
    if transactions.is_empty() {
        return Hash::default();
    }
    let mut hasher = Sha3_256::new();
    for tx in transactions {
        let bytes = serde_json::to_vec(tx).unwrap_or_default();
        hasher.update(&bytes);
    }
    Hash::new(hasher.finalize().into())
}

// ============================================================
// Node RPC helpers (JSON-RPC over HTTP)
// ============================================================

/// Block template fetched from the node RPC.
struct NodeTemplate {
    header_json: String,
    target_hex: String,
    transactions: Vec<Transaction>,
}

/// Call `getBlockTemplate` on the node and parse the response.
async fn fetch_block_template(rpc_url: &str) -> Result<NodeTemplate, MinerError> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| MinerError::Consensus(format!("http client: {e}")))?;

    let payload = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getBlockTemplate",
        "params": { "miner": "zion1miner" }
    });

    let resp: Value = client
        .post(rpc_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| MinerError::Consensus(format!("rpc request: {e}")))?
        .json()
        .await
        .map_err(|e| MinerError::Consensus(format!("rpc decode: {e}")))?;

    let result = resp
        .get("result")
        .ok_or_else(|| MinerError::Consensus("rpc: missing result".to_string()))?;

    let header_json = result
        .get("header_json")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let target_hex = result
        .get("target_hex")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let transactions: Vec<Transaction> = result
        .get("transactions")
        .map(|v| serde_json::from_value(v.clone()).unwrap_or_default())
        .unwrap_or_default();

    if header_json.is_empty() {
        return Err(MinerError::Consensus(
            "rpc: empty header_json in template".to_string(),
        ));
    }

    Ok(NodeTemplate {
        header_json,
        target_hex,
        transactions,
    })
}

/// Call `submitBlock` on the node with a solved block.
async fn submit_block_rpc(rpc_url: &str, block: &Block) -> Result<(), MinerError> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| MinerError::Consensus(format!("http client: {e}")))?;

    let payload = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "submitBlock",
        "params": serde_json::to_value(block).map_err(|e| MinerError::Consensus(format!("block serialize: {e}")))?
    });

    let resp: Value = client
        .post(rpc_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| MinerError::Consensus(format!("rpc request: {e}")))?
        .json()
        .await
        .map_err(|e| MinerError::Consensus(format!("rpc decode: {e}")))?;

    if let Some(err) = resp.get("error") {
        if !err.is_null() {
            return Err(MinerError::Consensus(format!(
                "rpc error: {}",
                serde_json::to_string(err).unwrap_or_default()
            )));
        }
    }

    info!("block submitted to node: height={}", block.header.height);
    Ok(())
}

/// Parse a 64-char hex target string into a 32-byte array.
fn parse_target_hex(target_hex: &str) -> Option<[u8; 32]> {
    let hex = target_hex
        .trim()
        .trim_start_matches("0x")
        .trim_start_matches("0X");
    if hex.len() != 64 {
        return None;
    }
    let mut out = [0u8; 32];
    hex::decode_to_slice(hex, &mut out).ok()?;
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use tokio::sync::watch;
    use zion_l1_types::Address;

    fn test_address() -> Address {
        Address::new(zion_l1_types::ChainId::ZionL1, vec![0u8; 20], "zion1test").unwrap()
    }

    #[tokio::test]
    async fn mine_zion_genesis() {
        let config = MinerConfig::new(test_address());
        let runtime = MinerRuntime::new(config);
        let genesis = genesis_header();
        let block = runtime.mine_zion_block(&genesis).await.unwrap();
        assert_eq!(block.header.height, 1);
        assert!(block.header.nonce < runtime.config.zion_nonce_batch);
    }

    #[cfg(feature = "auxpow")]
    #[tokio::test]
    async fn auxpow_scheduler_refresh() {
        let runtime = MinerRuntime::new(MinerConfig::new(test_address()));
        let profiles = zion_cosmic_harmony::CoinProfile::defaults();
        let (gpu, cpu) = runtime.refresh_auxpow(&profiles).await;
        assert!(gpu.is_some() || cpu.is_some());
    }

    #[cfg(feature = "auxpow")]
    #[tokio::test]
    async fn auxpow_share_mining() {
        let mut config = MinerConfig::new(test_address());
        config.auxpow_nonce_batch = 1_000;
        let runtime = MinerRuntime::new(config);
        let job = Job {
            job_id: "test".to_string(),
            coin: zion_cosmic_harmony::ExternalCoin::Kaspa,
            header: vec![0xAA; 32],
            target: [0xFF; 32],
            extranonce: vec![0x01],
            extranonce2: "00".to_string(),
            ntime: "00000000".to_string(),
            height: 0,
        };
        let share = runtime
            .mine_auxpow_share(StreamId::GpuExternal, &job)
            .await
            .unwrap();
        assert_eq!(share.coin, job.coin);
    }

    #[tokio::test]
    async fn zion_stream_runs() {
        let mut config = MinerConfig::new(test_address());
        config.auxpow_enabled = false;
        config.stream2_enabled = false;
        config.stream3_enabled = false;

        let runtime = Arc::new(MinerRuntime::new(config));
        let (shutdown_tx, shutdown_rx) = watch::channel(false);

        let handle = {
            let runtime = Arc::clone(&runtime);
            tokio::spawn(async move { runtime.run(shutdown_rx).await })
        };

        for _ in 0..50 {
            if runtime.total_shares().await >= 2 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        shutdown_tx.send(true).unwrap();
        handle.await.unwrap().unwrap();
        assert!(runtime.total_shares().await >= 2);
    }

    #[cfg(feature = "auxpow")]
    #[tokio::test]
    async fn auxpow_stream_hits_mock_stratum() {
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        use tokio::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (reader, mut writer) = socket.split();
            let mut lines = BufReader::new(reader).lines();

            let mut got = 0;
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = line;
                got += 1;
                if got == 2 {
                    let header = "00".repeat(32);
                    let target = "ff".repeat(32);
                    let notify = format!(
                        r#"{{"id":null,"method":"mining.notify","params":["mock_job","{}","{}"]}}"#,
                        header, target
                    );
                    let _ = writer.write_all(notify.as_bytes()).await;
                    let _ = writer.write_all(b"\n").await;
                    let _ = writer.flush().await;
                    break;
                }
            }

            while let Ok(Some(line)) = lines.next_line().await {
                // Echo a standard accepted response for any share submission.
                if let Ok(msg) = serde_json::from_str::<serde_json::Value>(&line) {
                    if msg.get("method").and_then(|m| m.as_str()) == Some("mining.submit") {
                        if let Some(id) = msg.get("id").and_then(serde_json::Value::as_i64) {
                            let resp = format!(r#"{{"id":{},"result":true,"error":null}}"#, id);
                            let _ = writer.write_all(resp.as_bytes()).await;
                            let _ = writer.write_all(b"\n").await;
                            let _ = writer.flush().await;
                        }
                    }
                }
            }
        });

        let mut config = MinerConfig::new(test_address());
        config.auxpow_enabled = true;
        config.stream1_enabled = false;
        config.stream2_enabled = true;
        config.stream3_enabled = false;
        config.auxpow_pool = Some(format!("127.0.0.1:{}", port));
        config.stream2_batch = 1_000_000;

        let runtime = Arc::new(MinerRuntime::new(config));
        let (shutdown_tx, shutdown_rx) = watch::channel(false);

        let handle = {
            let runtime = Arc::clone(&runtime);
            tokio::spawn(async move { runtime.run(shutdown_rx).await })
        };

        for _ in 0..80 {
            if runtime.total_shares().await >= 1 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        shutdown_tx.send(true).unwrap();
        handle.await.unwrap().unwrap();
        server.abort();

        assert!(runtime.total_shares().await >= 1);
    }

    #[cfg(feature = "auxpow")]
    #[tokio::test]
    async fn kas_stratum_stream_runs() {
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        use tokio::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        // Pre_pow_hash = 32 zero bytes, timestamp = 1234567890 ms.
        let pre_pow_hash = [0u8; 32];
        let timestamp: u64 = 1_234_567_890;
        let u64s: Vec<u64> = pre_pow_hash
            .chunks_exact(8)
            .map(|b| u64::from_le_bytes(b.try_into().unwrap()))
            .collect();
        let en1 = "03da";
        let en2_size = 6;

        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (reader, mut writer) = socket.split();
            let mut lines = BufReader::new(reader).lines();

            let mut got = 0;
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = line;
                got += 1;
                if got == 2 {
                    // Standard subscribe response with extranonce1.
                    let sub = format!(
                        r#"{{"id":1,"result":[["mining.notify","kas"],"{}",{}],"error":null}}"#,
                        en1, en2_size
                    );
                    let _ = writer.write_all(sub.as_bytes()).await;
                    let _ = writer.write_all(b"\n").await;
                    // Set an easy target for the test.
                    let target = "ff".repeat(32);
                    let set_target = format!(
                        r#"{{"id":null,"method":"mining.set_target","params":["{}"]}}"#,
                        target
                    );
                    let _ = writer.write_all(set_target.as_bytes()).await;
                    let _ = writer.write_all(b"\n").await;
                    // KaspaStratum 3-param notify.
                    let notify = format!(
                        r#"{{"id":null,"method":"mining.notify","params":["kas_job",[{},{},{},{}],{}]}}"#,
                        u64s[0], u64s[1], u64s[2], u64s[3], timestamp
                    );
                    let _ = writer.write_all(notify.as_bytes()).await;
                    let _ = writer.write_all(b"\n").await;
                    let _ = writer.flush().await;
                    break;
                }
            }

            // Verify the share we receive has the extranonce1 prefix in the low bytes.
            while let Ok(Some(line)) = lines.next_line().await {
                if let Ok(msg) = serde_json::from_str::<serde_json::Value>(&line) {
                    if msg.get("method").and_then(|m| m.as_str()) == Some("mining.submit") {
                        let params = msg.get("params").and_then(|p| p.as_array()).cloned().unwrap_or_default();
                        if params.len() >= 3 {
                            let nonce_hex = params[2].as_str().unwrap_or("");
                            let full = u64::from_str_radix(nonce_hex, 16).unwrap_or(0).to_le_bytes();
                            assert_eq!(&full[..2], hex::decode(en1).unwrap().as_slice(), "KAS nonce must start with extranonce1");
                        }
                        let resp = r#"{"id":100,"result":true,"error":null}"#;
                        let _ = writer.write_all(resp.as_bytes()).await;
                        let _ = writer.write_all(b"\n").await;
                        let _ = writer.flush().await;
                        break;
                    }
                }
            }
        });

        let mut config = MinerConfig::new(test_address());
        config.auxpow_enabled = true;
        config.stream1_enabled = false;
        config.stream2_enabled = true;
        config.stream3_enabled = false;
        config.auxpow_pool = Some(format!("127.0.0.1:{}", port));
        config.stream2_force_coin = Some(zion_cosmic_harmony::ExternalCoin::Kaspa);
        config.stream2_batch = 1_000_000;

        let runtime = Arc::new(MinerRuntime::new(config));
        let (shutdown_tx, shutdown_rx) = watch::channel(false);

        let handle = {
            let runtime = Arc::clone(&runtime);
            tokio::spawn(async move { runtime.run(shutdown_rx).await })
        };

        for _ in 0..80 {
            if runtime.total_shares().await >= 1 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        shutdown_tx.send(true).unwrap();
        handle.await.unwrap().unwrap();
        server.abort();

        assert!(runtime.total_shares().await >= 1);
    }

    #[cfg(feature = "auxpow")]
    #[tokio::test]
    async fn triple_stream_runs() {
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        use tokio::net::TcpListener;

        // A single mock pool serves both GPU and CPU AuxPoW streams. The runtime
        // uses `auxpow_pool` as an explicit override for all external streams.
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        let header = "00".repeat(32);
        let target = "ff".repeat(32);

        let server = tokio::spawn(async move {
            let notify = format!(
                r#"{{"id":null,"method":"mining.notify","params":["mock_job","{}","{}"]}}"#,
                header, target
            );

            loop {
                let (mut socket, _) = listener.accept().await.unwrap();
                let notify = notify.clone();
                tokio::spawn(async move {
                    let (reader, mut writer) = socket.split();
                    let mut lines = BufReader::new(reader).lines();
                    let mut got = 0;
                    while let Ok(Some(_line)) = lines.next_line().await {
                        got += 1;
                        if got == 2 {
                            let _ = writer.write_all(notify.as_bytes()).await;
                            let _ = writer.write_all(b"\n").await;
                            let _ = writer.flush().await;
                            break;
                        }
                    }
                    while let Ok(Some(_line)) = lines.next_line().await {}
                });
            }
        });

        let mut config = MinerConfig::new(test_address());
        config.auxpow_enabled = true;
        config.stream1_enabled = true;
        config.stream2_enabled = true;
        config.stream3_enabled = true;
        config.auxpow_pool = Some(format!("127.0.0.1:{}", port));
        config.stream2_batch = 1_000_000;
        config.stream3_batch = 1_000_000;

        let runtime = Arc::new(MinerRuntime::new(config));
        let (shutdown_tx, shutdown_rx) = watch::channel(false);

        let handle = {
            let runtime = Arc::clone(&runtime);
            tokio::spawn(async move { runtime.run(shutdown_rx).await })
        };

        for _ in 0..120 {
            if runtime.total_shares().await >= 3 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        shutdown_tx.send(true).unwrap();
        handle.await.unwrap().unwrap();
        server.abort();

        assert!(
            runtime.total_shares().await >= 3,
            "expected at least 3 shares"
        );
    }
}
