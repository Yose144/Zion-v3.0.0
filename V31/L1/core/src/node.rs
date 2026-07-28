//! ZION L1 node runtime.
//!
//! `Node` ties together storage, mempool, consensus, P2P, and RPC into a single
//! Alpha-ready runtime.

use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use tokio::sync::watch;
use tracing::{info, warn};
use zion_cosmic_harmony::EkamDeeksha;
use zion_l1_types::{Address, Amount, Hash};

use crate::block::{Block, BlockHeader};
use crate::consensus::{ConsensusEngine, ConsensusError};
use crate::difficulty::{self, difficulty_to_target, lwma_next_difficulty};
use crate::emission::{block_subsidy, fee_split};
use crate::genesis;
use crate::mempool::Mempool;
use crate::rpc::RpcServer;
use crate::storage::{Storage, StorageError};
use crate::transaction::{Transaction, TransactionOutput};

/// Node configuration.
#[derive(Clone, Debug)]
pub struct NodeConfig {
    pub db_path: String,
    pub rpc_addr: SocketAddr,
    pub p2p_addr: SocketAddr,
    pub human_address: Address,
    pub issobella_address: Address,
    /// Skip automatic genesis seeding. Set this when importing a migration
    /// snapshot or an external chain state.
    pub no_genesis: bool,
    /// Static seed peers for P2P block sync (IBD).
    pub seed_peers: Vec<SocketAddr>,
}

impl Default for NodeConfig {
    fn default() -> Self {
        Self {
            db_path: "zion-node.db".into(),
            rpc_addr: "127.0.0.1:9443".parse().unwrap(),
            p2p_addr: "0.0.0.0:8333".parse().unwrap(),
            // V3 mainnet canonical subsidy addresses.
            human_address: Address::new(
                zion_l1_types::ChainId::ZionL1,
                vec![],
                "zion1e0u5q5s660k4m4a634p2c2v358r8g59564054z7",
            )
            .expect("human address"),
            issobella_address: Address::new(
                zion_l1_types::ChainId::ZionL1,
                vec![],
                "zion1f7y7l5k678y0v408e8s654d2282346k375526t2",
            )
            .expect("issobella address"),
            no_genesis: false,
            seed_peers: Vec::new(),
        }
    }
}

/// Runtime error for the node.
#[derive(Debug, thiserror::Error)]
pub enum NodeError {
    #[error("storage error: {0}")]
    Storage(#[from] StorageError),
    #[error("consensus error: {0}")]
    Consensus(#[from] ConsensusError),
    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid address: {0}")]
    Address(String),
    #[error("task error: {0}")]
    Task(String),
}

/// Chain node.
pub struct Node {
    pub storage: Storage,
    pub mempool: Mempool,
    pub consensus: ConsensusEngine,
    config: NodeConfig,
    next_template_id: AtomicU64,
}

impl Node {
    /// Open storage and seed the genesis block if the chain is empty.
    pub async fn new(config: NodeConfig) -> Result<Self, NodeError> {
        let storage = if config.db_path == ":memory:" {
            Storage::open_in_memory().await?
        } else {
            Storage::open(&config.db_path).await?
        };

        if !config.no_genesis && storage.height().await? == 0 {
            let genesis = genesis::genesis_block();
            storage.put(&genesis).await?;
            info!(hash = %genesis.header.header_hash().to_hex(), "seeded genesis block");
        }

        let consensus = ConsensusEngine::new(Arc::new(EkamDeeksha::new()));
        Ok(Self {
            storage,
            mempool: Mempool::new(),
            consensus,
            config,
            next_template_id: AtomicU64::new(1),
        })
    }

    /// Run the node until the shutdown signal is received.
    pub async fn run(
        self: Arc<Self>,
        mut shutdown: watch::Receiver<bool>,
    ) -> Result<(), NodeError> {
        let rpc_shutdown = shutdown.clone();
        let p2p_shutdown = shutdown.clone();
        let sync_shutdown = shutdown.clone();

        let rpc_addr = self.config.rpc_addr;
        let p2p_addr = self.config.p2p_addr;
        let seed_peers = self.config.seed_peers.clone();

        let rpc = RpcServer::new(Arc::clone(&self));
        let rpc_handle = tokio::spawn(async move { rpc.run(rpc_addr, rpc_shutdown).await });

        let p2p = crate::p2p::P2P::new(Arc::clone(&self));
        let p2p_handle = tokio::spawn(async move { p2p.listen(p2p_addr, p2p_shutdown).await });

        let sync_handle = tokio::spawn(async move {
            crate::p2p::sync_loop(Arc::clone(&self), seed_peers, sync_shutdown).await;
            Ok(()) as Result<(), NodeError>
        });

        tokio::pin!(rpc_handle, p2p_handle, sync_handle);
        tokio::select! {
            r = &mut rpc_handle => {
                p2p_handle.abort();
                sync_handle.abort();
                r.map_err(|e| NodeError::Task(e.to_string()))??;
            }
            r = &mut p2p_handle => {
                rpc_handle.abort();
                sync_handle.abort();
                r.map_err(|e| NodeError::Task(e.to_string()))??;
            }
            r = &mut sync_handle => {
                rpc_handle.abort();
                p2p_handle.abort();
                r.map_err(|e| NodeError::Task(e.to_string()))??;
            }
            _ = shutdown.changed() => {
                rpc_handle.abort();
                p2p_handle.abort();
                sync_handle.abort();
            }
        }
        Ok(())
    }

    /// Current chain status.
    pub async fn status(&self) -> Result<ChainStatus, NodeError> {
        let (tip_header, tip_hash) = self.storage.tip().await?.unwrap_or_else(|| {
            let genesis = genesis::genesis_block();
            let hash = genesis.header.header_hash();
            (genesis.header.clone(), hash)
        });
        Ok(ChainStatus {
            height: tip_header.height,
            tip_hash,
            difficulty: tip_header.difficulty,
            target: hex::encode(difficulty_to_target(tip_header.difficulty)),
            mempool_size: self.mempool.len().await,
        })
    }

    /// Block by height.
    pub async fn block_by_height(&self, height: u64) -> Result<Option<Block>, NodeError> {
        Ok(self.storage.get_by_height(height).await?)
    }

    /// Block by hash.
    pub async fn block_by_hash(&self, hash: &Hash) -> Result<Option<Block>, NodeError> {
        Ok(self.storage.get_by_hash(hash).await?)
    }

    /// Submit a transaction to the mempool.
    pub async fn submit_transaction(&self, tx: Transaction) {
        self.mempool.add(tx).await;
    }

    /// Build a block template for miners.
    pub async fn block_template(&self, miner: Address) -> Result<BlockTemplate, NodeError> {
        let (tip_header, _tip_hash) = self.storage.tip().await?.unwrap_or_else(|| {
            let genesis = genesis::genesis_block();
            let hash = genesis.header.header_hash();
            (genesis.header.clone(), hash)
        });

        let next_height = tip_header.height + 1;
        let window = self
            .storage
            .difficulty_window(difficulty::LWMA_WINDOW + 1)
            .await?;
        let next_difficulty = lwma_next_difficulty(&window);
        let target = difficulty_to_target(next_difficulty);

        // Coinbase transaction pays miner + humanitarian + issobella; pool fee is burned.
        let subsidy = block_subsidy(next_height);
        let (miner_amount, human_amount, issobella_amount, _burn) = fee_split(subsidy);
        let coinbase = Transaction {
            version: 1,
            inputs: vec![],
            outputs: vec![
                TransactionOutput {
                    amount: Amount::new(miner_amount as u128),
                    address: miner,
                },
                TransactionOutput {
                    amount: Amount::new(human_amount as u128),
                    address: self.config.human_address.clone(),
                },
                TransactionOutput {
                    amount: Amount::new(issobella_amount as u128),
                    address: self.config.issobella_address.clone(),
                },
            ],
            memo: b"coinbase".to_vec(),
        };

        let mut txs = self.mempool.pending().await;
        txs.insert(0, coinbase);

        let merkle_root = merkle_root(&txs);
        let header = BlockHeader {
            previous_hash: tip_header.header_hash(),
            merkle_root,
            height: next_height,
            timestamp: chrono::Utc::now().timestamp() as u64,
            nonce: 0,
            difficulty: next_difficulty,
        };

        let template_id = self.next_template_id.fetch_add(1, Ordering::Relaxed);

        Ok(BlockTemplate {
            template_id,
            previous_hash: header.previous_hash.to_hex(),
            height: header.height,
            difficulty: header.difficulty,
            target: hex::encode(target),
            header_hex: hex::encode(header.pow_header()),
            target_hex: hex::encode(target),
            block_reward: subsidy,
            header_json: serde_json::to_string(&header)?,
            transactions: txs,
        })
    }

    /// Validate and accept a mined block.
    pub async fn submit_block(&self, block: Block) -> Result<(), NodeError> {
        let (tip_header, _tip_hash) = self.storage.tip().await?.unwrap_or_else(|| {
            let genesis = genesis::genesis_block();
            let hash = genesis.header.header_hash();
            (genesis.header.clone(), hash)
        });

        let target = difficulty_to_target(block.header.difficulty);
        self.consensus
            .verify_header(&block.header, &tip_header, &target)
            .map_err(NodeError::Consensus)?;

        // Verify merkle root.
        let expected_merkle = merkle_root(&block.transactions);
        if expected_merkle != block.header.merkle_root {
            warn!(
                expected = %expected_merkle.to_hex(),
                actual = %block.header.merkle_root.to_hex(),
                "merkle root mismatch"
            );
            return Err(NodeError::Consensus(ConsensusError::PreviousHashMismatch));
        }

        // Verify coinbase structure for non-genesis blocks.
        if block.header.height > 0 {
            let Some(coinbase) = block.transactions.first() else {
                return Err(NodeError::Consensus(ConsensusError::TargetNotMet));
            };
            let expected_subsidy = block_subsidy(block.header.height);
            let actual_subsidy: u64 = coinbase.outputs.iter().map(|o| o.amount.0 as u64).sum();
            let (miner, human, issobella, _burn) = fee_split(expected_subsidy);
            let expected = miner + human + issobella;
            if actual_subsidy != expected {
                warn!(expected, actual_subsidy, "coinbase subsidy mismatch");
                return Err(NodeError::Consensus(ConsensusError::TargetNotMet));
            }
        }

        self.storage.put(&block).await?;

        // Remove included transactions from mempool.
        let included: Vec<Hash> = block.transactions.iter().map(|t| t.hash()).collect();
        self.mempool.remove(&included).await;

        info!(
            height = block.header.height,
            hash = %block.header.header_hash().to_hex(),
            "accepted block"
        );
        Ok(())
    }
}

fn merkle_root(transactions: &[Transaction]) -> Hash {
    use blake3::Hasher;
    let mut hasher = Hasher::new();
    for tx in transactions {
        hasher.update(&tx.hash().0);
    }
    Hash::new(hasher.finalize().into())
}

/// Chain status snapshot.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct ChainStatus {
    pub height: u64,
    pub tip_hash: Hash,
    pub difficulty: u64,
    pub target: String,
    pub mempool_size: usize,
}

/// Block template returned to miners.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct BlockTemplate {
    pub template_id: u64,
    pub previous_hash: String,
    pub height: u64,
    pub difficulty: u64,
    pub target: String,
    pub header_hex: String,
    pub target_hex: String,
    pub block_reward: u64,
    pub header_json: String,
    pub transactions: Vec<Transaction>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn node_seeds_genesis() {
        let config = NodeConfig {
            db_path: ":memory:".into(),
            ..Default::default()
        };
        let node = Node::new(config).await.unwrap();
        let status = node.status().await.unwrap();
        assert_eq!(status.height, 0);
    }

    #[tokio::test]
    async fn mine_and_submit_first_block() {
        let config = NodeConfig {
            db_path: ":memory:".into(),
            ..Default::default()
        };
        let node = Arc::new(Node::new(config).await.unwrap());

        let miner = Address::new(zion_l1_types::ChainId::ZionL1, vec![], "zion1test").unwrap();
        let template = node.block_template(miner).await.unwrap();

        // Mine the header with an easy target for the unit test, then set the
        // difficulty to 1 so submit_block validates the PoW.
        let mut header: BlockHeader = serde_json::from_str(&template.header_json).unwrap();
        header.difficulty = 1;
        let target = [0xff; 32];
        node.consensus
            .mine(&mut header, &target, 0, 1_000)
            .expect("block should be mineable in test");

        let block = Block::new(header, template.transactions);
        node.submit_block(block).await.unwrap();

        assert_eq!(node.status().await.unwrap().height, 1);
    }
}
