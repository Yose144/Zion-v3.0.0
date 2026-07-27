use std::sync::Arc;

use chrono::Utc;
use sha3::{Digest, Sha3_256};
use tokio::sync::watch;
use tracing::{info, warn};
use zion_core::{
    Block, BlockHeader, ConsensusEngine, Transaction, TransactionInput, TransactionOutput,
};
use zion_cosmic_harmony::EkamDeeksha;
use zion_l1_types::{Amount, Hash};

use crate::auxpow::{find_share, AuxPoWScheduler, Job, StratumClient};
use crate::config::MinerConfig;

#[derive(Debug, thiserror::Error)]
pub enum MinerError {
    #[error("consensus error: {0}")]
    Consensus(String),
    #[error("no AuxPoW coin selected")]
    NoAuxPoWSolution,
    #[error("shutdown requested")]
    Shutdown,
}

/// Unified mining runtime: ZION canonical blocks + AuxPoW external shares.
pub struct MinerRuntime {
    config: MinerConfig,
    consensus: ConsensusEngine,
    scheduler: AuxPoWScheduler,
}

impl MinerRuntime {
    pub fn new(config: MinerConfig) -> Self {
        let algorithm = Arc::new(EkamDeeksha::new()) as Arc<dyn zion_cosmic_harmony::PowAlgorithm>;
        let consensus = ConsensusEngine::new(algorithm);
        let scheduler = AuxPoWScheduler::new(config.hashrate_per_unit);
        Self {
            config,
            consensus,
            scheduler,
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

        // Use an easy target for the scaffold; real pool mining uses a
        // network-derived target.
        let target = [0xFFu8; 32];
        let _hash = self
            .consensus
            .mine(&mut header, &target, 0, self.config.zion_nonce_batch)
            .ok_or_else(|| MinerError::Consensus("no nonce found in batch".to_string()))?;

        Ok(Block::new(header, transactions))
    }

    /// Mine a single AuxPoW share for `job` using the CPU scaffold.
    pub async fn mine_auxpow_share(&self, job: &Job) -> Result<crate::auxpow::Share, MinerError> {
        let coin = job.coin;
        find_share(coin, job, 0, self.config.auxpow_nonce_batch).ok_or(MinerError::NoAuxPoWSolution)
    }

    /// Refresh the AuxPoW scheduler from the provided profiles and return the
    /// selected pool client, if enabled.
    pub async fn refresh_auxpow(
        &mut self,
        profiles: &[zion_cosmic_harmony::CoinProfile],
    ) -> Option<StratumClient> {
        if !self.config.auxpow_enabled {
            return None;
        }
        self.scheduler.refresh(profiles);
        match self.scheduler.current() {
            Some(coin) => {
                info!(coin = %coin, "auxpow coin selected");
                self.scheduler
                    .client(&self.config.worker, &self.config.password)
            }
            None => {
                warn!("no profitable auxpow coin");
                None
            }
        }
    }

    /// Run both ZION and AuxPoW loops until the shutdown signal is received.
    ///
    /// This is a long-running scaffold; production will add stratum networking,
    /// share submission, and pool reconnect logic.
    pub async fn run(&self, shutdown: watch::Receiver<bool>) -> Result<(), MinerError> {
        let mut parent = genesis_header();

        loop {
            if *shutdown.borrow() {
                return Err(MinerError::Shutdown);
            }

            match self.mine_zion_block(&parent).await {
                Ok(block) => {
                    info!(
                        height = block.header.height,
                        nonce = block.header.nonce,
                        "mined zion block"
                    );
                    parent = block.header;
                }
                Err(e) => {
                    warn!(error = %e, "zion mining batch failed");
                }
            }

            // AuxPoW is handled by the scheduler/pool client in a real loop;
            // here we just log the currently selected coin.
            if self.config.auxpow_enabled {
                if let Some(coin) = self.scheduler.current() {
                    info!(coin = %coin, "auxpow active");
                }
            }
        }
    }
}

/// Dummy genesis header for the runtime scaffold. Real operation starts from
/// the tip reported by a synced node.
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
        Amount::new(50_000_000) // 50 ZION, 6 decimals
    } else {
        Amount::ZERO
    }
}

/// Simple merkle root: SHA3-256 of the concatenation of transaction hashes.
/// This is sufficient for the mining scaffold; production uses a binary tree.
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
        let mut runtime = MinerRuntime::new(MinerConfig::new(test_address()));
        let profiles = zion_cosmic_harmony::CoinProfile::defaults();
        let client = runtime.refresh_auxpow(&profiles).await;
        assert!(client.is_some());
        assert!(runtime.scheduler.current().is_some());
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
}
