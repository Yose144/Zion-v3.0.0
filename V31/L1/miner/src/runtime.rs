use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use sha3::{Digest, Sha3_256};
use tokio::sync::{watch, Mutex};
use tokio::time::sleep;
use tracing::{info, warn};
use zion_core::{
    Block, BlockHeader, ConsensusEngine, Transaction, TransactionInput, TransactionOutput,
};
use zion_cosmic_harmony::EkamDeeksha;
use zion_l1_types::{Amount, Hash};

use crate::auxpow::{find_share, AuxPoWScheduler, Job, StratumClient};
use crate::config::MinerConfig;
use crate::stream::{StreamId, StreamStats};

#[derive(Debug, thiserror::Error)]
pub enum MinerError {
    #[error("consensus error: {0}")]
    Consensus(String),
    #[error("no AuxPoW solution")]
    NoAuxPoWSolution,
    #[error("shutdown requested")]
    Shutdown,
    #[error("task join error: {0}")]
    Join(#[from] tokio::task::JoinError),
}

/// Unified mining runtime: ZION canonical blocks + AuxPoW external shares.
#[derive(Clone)]
pub struct MinerRuntime {
    config: Arc<MinerConfig>,
    consensus: Arc<ConsensusEngine>,
    scheduler: Arc<Mutex<AuxPoWScheduler>>,
    stats: Arc<Mutex<HashMap<StreamId, StreamStats>>>,
}

impl MinerRuntime {
    pub fn new(config: MinerConfig) -> Self {
        let algorithm = Arc::new(EkamDeeksha::new()) as Arc<dyn zion_cosmic_harmony::PowAlgorithm>;
        let consensus = Arc::new(ConsensusEngine::new(algorithm));
        let scheduler = Arc::new(Mutex::new(AuxPoWScheduler::new(config.hashrate_per_unit)));

        let mut map = HashMap::new();
        map.insert(StreamId::Zion, StreamStats::new(StreamId::Zion));
        map.insert(StreamId::GpuExternal, StreamStats::new(StreamId::GpuExternal));
        map.insert(StreamId::CpuExternal, StreamStats::new(StreamId::CpuExternal));
        let stats = Arc::new(Mutex::new(map));

        Self {
            config: Arc::new(config),
            consensus,
            scheduler,
            stats,
        }
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

    /// Mine a single AuxPoW share for `job` using the configured batch.
    pub async fn mine_auxpow_share(&self, job: &Job) -> Result<crate::auxpow::Share, MinerError> {
        self.mine_auxpow_share_batch(job, self.config.auxpow_nonce_batch)
            .await
    }

    /// Mine a single AuxPoW share for `job` using a custom batch.
    pub async fn mine_auxpow_share_batch(
        &self,
        job: &Job,
        batch: u64,
    ) -> Result<crate::auxpow::Share, MinerError> {
        find_share(job.coin, job, 0, batch).ok_or(MinerError::NoAuxPoWSolution)
    }

    /// Refresh the AuxPoW scheduler and return GPU and CPU stratum clients.
    pub async fn refresh_auxpow(
        &self,
        profiles: &[zion_cosmic_harmony::CoinProfile],
    ) -> (Option<StratumClient>, Option<StratumClient>) {
        let mut scheduler = self.scheduler.lock().await;
        scheduler.refresh(profiles);
        (
            scheduler.gpu_client(&self.config.worker, &self.config.password),
            scheduler.cpu_client(&self.config.worker, &self.config.password),
        )
    }

    /// Return the currently selected GPU and CPU external coins.
    pub async fn current_auxpow(
        &self,
    ) -> (
        Option<zion_cosmic_harmony::ExternalCoin>,
        Option<zion_cosmic_harmony::ExternalCoin>,
    ) {
        let scheduler = self.scheduler.lock().await;
        (scheduler.current_gpu(), scheduler.current_cpu())
    }

    /// Return a snapshot of all stream statistics.
    pub async fn stats(&self) -> HashMap<StreamId, StreamStats> {
        self.stats.lock().await.clone()
    }

    /// Total accepted shares across all streams.
    pub async fn total_shares(&self) -> u64 {
        self.stats().await.values().map(|s| s.accepted).sum()
    }

    /// Run all enabled mining streams until the shutdown signal is received.
    pub async fn run(&self, mut shutdown: watch::Receiver<bool>) -> Result<(), MinerError> {
        let profiles = zion_cosmic_harmony::CoinProfile::defaults();
        let _ = self.refresh_auxpow(&profiles).await;

        let h1: tokio::task::JoinHandle<Result<(), MinerError>> = if self.config.stream1_enabled {
            let this = self.clone();
            let shutdown = shutdown.clone();
            tokio::spawn(async move {
                let mut parent = genesis_header();
                loop {
                    if *shutdown.borrow() {
                        break;
                    }
                    this.mark_active(StreamId::Zion).await;
                    match this.mine_zion_block(&parent).await {
                        Ok(block) => {
                            parent = block.header.clone();
                            this.record_accepted(StreamId::Zion).await;
                            info!(
                                height = block.header.height,
                                nonce = block.header.nonce,
                                "mined zion block"
                            );
                        }
                        Err(e) => warn!(error = %e, "zion mining batch failed"),
                    }
                    sleep(Duration::from_millis(10)).await;
                }
                Ok(())
            })
        } else {
            tokio::spawn(async { Ok::<(), MinerError>(()) })
        };

        let h2: tokio::task::JoinHandle<Result<(), MinerError>> = if self.config.stream2_enabled {
            let this = self.clone();
            let shutdown = shutdown.clone();
            tokio::spawn(async move {
                loop {
                    if *shutdown.borrow() {
                        break;
                    }
                    this.mark_active(StreamId::GpuExternal).await;

                    let (coin, client) = {
                        let scheduler = this.scheduler.lock().await;
                        (
                            scheduler.current_gpu(),
                            scheduler.gpu_client(&this.config.worker, &this.config.password),
                        )
                    };

                    if let Some(coin) = coin {
                        if let Some(ref client) = client {
                            let _ = client.connect().await;
                        }
                        let job = Job {
                            job_id: "gpu".to_string(),
                            coin,
                            header: vec![0xAA; 32],
                            target: [0xFF; 32],
                            extranonce: vec![1],
                        };
                        match this
                            .mine_auxpow_share_batch(&job, this.config.stream2_batch)
                            .await
                        {
                            Ok(share) => {
                                this.record_share(StreamId::GpuExternal, coin).await;
                                if let Some(ref client) = client {
                                    let _ = client.submit_share(&share).await;
                                }
                                info!(coin = %coin, nonce = share.nonce, "mined gpu auxpow share");
                            }
                            Err(e) => warn!(error = %e, "gpu auxpow share failed"),
                        }
                    } else {
                        warn!("no gpu auxpow coin selected");
                    }
                    sleep(Duration::from_millis(10)).await;
                }
                Ok(())
            })
        } else {
            tokio::spawn(async { Ok::<(), MinerError>(()) })
        };

        let h3: tokio::task::JoinHandle<Result<(), MinerError>> = if self.config.stream3_enabled {
            let this = self.clone();
            let shutdown = shutdown.clone();
            tokio::spawn(async move {
                loop {
                    if *shutdown.borrow() {
                        break;
                    }
                    this.mark_active(StreamId::CpuExternal).await;

                    let (coin, client) = {
                        let scheduler = this.scheduler.lock().await;
                        (
                            scheduler.current_cpu(),
                            scheduler.cpu_client(&this.config.worker, &this.config.password),
                        )
                    };

                    if let Some(coin) = coin {
                        if let Some(ref client) = client {
                            let _ = client.connect().await;
                        }
                        let job = Job {
                            job_id: "cpu".to_string(),
                            coin,
                            header: vec![0xAA; 32],
                            target: [0xFF; 32],
                            extranonce: vec![2],
                        };
                        match this
                            .mine_auxpow_share_batch(&job, this.config.stream3_batch)
                            .await
                        {
                            Ok(share) => {
                                this.record_share(StreamId::CpuExternal, coin).await;
                                if let Some(ref client) = client {
                                    let _ = client.submit_share(&share).await;
                                }
                                info!(coin = %coin, nonce = share.nonce, "mined cpu auxpow share");
                            }
                            Err(e) => warn!(error = %e, "cpu auxpow share failed"),
                        }
                    } else {
                        warn!("no cpu auxpow coin selected");
                    }
                    sleep(Duration::from_millis(10)).await;
                }
                Ok(())
            })
        } else {
            tokio::spawn(async { Ok::<(), MinerError>(()) })
        };

        let _ = shutdown.changed().await;
        let (r1, r2, r3) = tokio::join!(h1, h2, h3);
        r1??;
        r2??;
        r3??;
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

    #[tokio::test]
    async fn auxpow_scheduler_refresh() {
        let runtime = MinerRuntime::new(MinerConfig::new(test_address()));
        let profiles = zion_cosmic_harmony::CoinProfile::defaults();
        let (gpu, cpu) = runtime.refresh_auxpow(&profiles).await;
        assert!(gpu.is_some() || cpu.is_some());
        let (gpu_coin, cpu_coin) = runtime.current_auxpow().await;
        assert!(gpu_coin.is_some() || cpu_coin.is_some());
    }

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
        };
        let share = runtime.mine_auxpow_share(&job).await.unwrap();
        assert_eq!(share.coin, job.coin);
    }

    #[tokio::test]
    async fn triple_stream_runs() {
        let runtime = Arc::new(MinerRuntime::new(MinerConfig::new(test_address())));
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
}
