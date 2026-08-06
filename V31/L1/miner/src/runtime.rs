use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

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
use crate::auxpow::{AuxPoWScheduler, Job, Share, StratumClient};
use crate::config::MinerConfig;
use crate::stream::{StreamId, StreamStats};

#[cfg(feature = "auxpow")]
use crate::gpu::{create_gpu_backend, GpuBackendKind};
#[cfg(feature = "auxpow")]
use zion_core::V3DifficultyTarget as DifficultyTarget;

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
        let _hash = self
            .consensus
            .mine(&mut header, &target, 0, self.config.zion_nonce_batch)
            .ok_or_else(|| MinerError::Consensus("no nonce found in batch".to_string()))?;

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
        let (nonce, _hash) = self
            .consensus
            .mine_header_bytes(&job.header, &job.target, 0, self.config.zion_nonce_batch)
            .ok_or(MinerError::NoAuxPoWSolution)?;

        let share = crate::auxpow::Share {
            job_id: job.job_id,
            coin: zion_cosmic_harmony::ExternalCoin::Bitcoin,
            nonce,
            hash: _hash.0,
            mix_hash: None,
            solution: None,
            extranonce2: job.extranonce2,
            ntime: job.ntime,
        };

        if let Err(e) = client.submit_share(&share).await {
            warn!(error = %e, "zion pool share submit failed");
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
    /// Stream 2 first attempts GPU mining when `gpu_backend` is not "cpu";
    /// on failure or for Stream 3 it falls back to the CPU `parallel` scanner.
    pub async fn mine_auxpow_share_batch(
        &self,
        stream: StreamId,
        job: &Job,
        batch: u64,
    ) -> Result<Share, MinerError> {
        let try_gpu = stream == StreamId::GpuExternal && self.config.gpu_backend != "cpu";
        if try_gpu {
            if let Some(share) = self.try_gpu_auxpow_share(job, batch).await {
                return Ok(share);
            }
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

    #[cfg(feature = "auxpow")]
    async fn try_gpu_auxpow_share(&self, job: &Job, batch: u64) -> Option<Share> {
        let kind = parse_gpu_backend(&self.config.gpu_backend);
        let work_size = batch as usize;
        let algorithm = job.coin.algorithm();
        // TODO: the CUDA kheavyhash kernel needs extranonce1 + timestamp support
        // for live KaspaStratum pools.  Use the CPU scanner for KAS until the
        // kernel is updated to shift the scanned suffix and read the timestamp
        // from the raw header.
        if algorithm.starts_with("kheavyhash") {
            return None;
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

        let gpu_result = task::spawn_blocking(move || {
            let mut miner = create_gpu_backend(kind, work_size, algorithm, coin_ticker)
                .map_err(|e| anyhow::anyhow!("{e}"))?;
            // Load the correct DAG/epoch and, for ProgPoW, recompile the kernel
            // when the period changes. This must happen before mine_batch_raw.
            miner
                .update_epoch(height)
                .map_err(|e| anyhow::anyhow!("{e}"))?;
            let result = miner
                .mine_batch_raw(&header, target, 0, batch)
                .map_err(|e| anyhow::anyhow!("{e}"))?;
            Ok::<_, anyhow::Error>(result)
        })
        .await;

        match gpu_result {
            Ok(Ok(gpu_result)) => {
                if let Some((nonce, hash, mix)) = gpu_result.solutions.into_iter().next() {
                    // Some algorithms (VerusHash, ZelHash, Equihash) need a
                    // variable-length solution blob in addition to the 32-byte hash.
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
                        mix_hash: mix,
                        solution,
                        extranonce2,
                        ntime,
                    });
                }
            }
            Ok(Err(e)) => {
                warn!(stream = "gpu", error = %e, "gpu auxpow mining failed; falling back to cpu");
            }
            Err(e) => {
                warn!(stream = "gpu", error = %e, "gpu auxpow task failed; falling back to cpu");
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
                    let client = crate::auxpow::StratumClient::new(&url, &worker, &password);
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
                                    this.record_accepted(StreamId::Zion).await;
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
            *guard = Some(StratumClient::new(&url, &worker, &self.config.password));
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

        let guard = client_cell.lock().await;
        if let Some(client) = guard.as_ref() {
            if let Err(e) = client.submit_share(&share).await {
                warn!(error = %e, "submit share failed");
            }
        }
        drop(guard);

        self.record_share(stream, coin).await;
        info!(stream = ?stream, coin = %coin, nonce = share.nonce, "mined auxpow share");
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

    #[cfg(feature = "auxpow")]
    async fn record_share(&self, stream: StreamId, coin: zion_cosmic_harmony::ExternalCoin) {
        let mut stats = self.stats.lock().await;
        if let Some(s) = stats.get_mut(&stream) {
            s.active = true;
            s.coin = Some(coin);
            s.algorithm = Some(coin.algorithm().to_string());
            s.accepted += 1;
            s.shares_found += 1;
        }
    }
}

#[cfg(feature = "auxpow")]
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

            while let Ok(Some(_line)) = lines.next_line().await {
                // Accept silently.
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
