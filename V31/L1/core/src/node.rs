//! ZION L1 node runtime.
//!
//! `Node` ties together storage, mempool, consensus, P2P, and RPC into a single
//! Alpha-ready runtime.

use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use tokio::sync::watch;
use tracing::{info, warn};
use zion_l1_types::{Address, Amount, Hash};

use crate::block::{Block, BlockHeader};
use crate::consensus::{ConsensusEngine, ConsensusError};
use zion_cosmic_harmony::EkamDeeksha;
use crate::difficulty::{self, difficulty_to_target, lwma_next_difficulty};
use crate::emission::{block_subsidy, fee_split};
use crate::genesis;
use crate::mempool::Mempool;
use crate::rpc::RpcServer;
use crate::storage::{Storage, StorageError};
use crate::transaction::{Transaction, TransactionOutput};
use crate::utxo::{Outpoint, UtxoError, UtxoSet};

/// Node configuration.
#[derive(Clone, Debug)]
pub struct NodeConfig {
    pub db_path: String,
    pub rpc_addr: SocketAddr,
    pub p2p_addr: SocketAddr,
    /// V3 compatibility P2P bind address. Defaults to `0.0.0.0:0` so it does
    /// not collide with the canonical P2P port.
    pub v3_p2p_addr: SocketAddr,
    pub human_address: Address,
    pub issobella_address: Address,
    /// Skip automatic genesis seeding. Set this when importing a migration
    /// snapshot or an external chain state.
    pub no_genesis: bool,
    /// Static seed peers for P2P block sync (IBD).
    pub seed_peers: Vec<SocketAddr>,
    /// V3 miner coinbase payout address (string form, e.g. "zion1...").
    /// Empty = no coinbase generated in V3 templates.
    pub v3_miner_address: String,
    /// V3 humanitarian fund address (string form). Empty = no split.
    pub v3_humanitarian_address: String,
    /// V3 issobella fund address (string form). Empty = no split.
    pub v3_issobella_address: String,
    /// Skip V3 genesis seeding (use when importing a checkpoint snapshot).
    pub v3_no_genesis: bool,
    /// Optional path to a V3 checkpoint snapshot JSON for import at startup.
    pub v3_checkpoint_path: Option<std::path::PathBuf>,
}

impl Default for NodeConfig {
    fn default() -> Self {
        Self {
            db_path: "zion-node.db".into(),
            rpc_addr: "127.0.0.1:9443".parse().unwrap(),
            p2p_addr: "0.0.0.0:8333".parse().unwrap(),
            v3_p2p_addr: "0.0.0.0:0".parse().unwrap(),
            // V3 mainnet canonical subsidy addresses.
            human_address: Address::new(
                zion_l1_types::ChainId::ZionL1,
                vec![],
                crate::v3_compat::MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET,
            )
            .expect("human address"),
            issobella_address: Address::new(
                zion_l1_types::ChainId::ZionL1,
                vec![],
                crate::v3_compat::MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET,
            )
            .expect("issobella address"),
            no_genesis: false,
            seed_peers: Vec::new(),
            v3_miner_address: String::new(),
            v3_humanitarian_address:
                crate::v3_compat::MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET.to_string(),
            v3_issobella_address: crate::v3_compat::MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET
                .to_string(),
            v3_no_genesis: false,
            v3_checkpoint_path: None,
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
    #[error("V3 P2P error: {0}")]
    V3P2P(#[from] crate::v3_p2p::V3P2PError),
    #[error("UTXO error: {0}")]
    Utxo(#[from] UtxoError),
}

/// Chain node.
pub struct Node {
    pub storage: Storage,
    pub mempool: Mempool,
    pub consensus: ConsensusEngine,
    /// V31 native UTXO set.
    pub utxo_set: Arc<tokio::sync::Mutex<UtxoSet>>,
    /// V3 RPC handler (parallel V3 chain path).
    pub v3_rpc: Arc<crate::v3_rpc::V3RpcHandler>,
    /// V3 P2P sync client.
    pub v3_sync: crate::v3_p2p::V3Sync,
    pub config: NodeConfig,
    /// Shared P2P peer manager (active + known peers).
    pub peer_manager: Arc<crate::peer_manager::PeerManager>,
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

        // V3 path: seed V3 genesis or import checkpoint snapshot.
        let storage_arc = Arc::new(storage.clone());
        if let Some(ref checkpoint_path) = config.v3_checkpoint_path {
            if storage_arc.v3_tip().await?.is_none() {
                info!(path = %checkpoint_path.display(), "importing V3 checkpoint snapshot");
                let checkpoint_json = std::fs::read_to_string(checkpoint_path)
                    .map_err(|e| NodeError::Task(format!("failed to read checkpoint file: {e}")))?;
                let checkpoint: crate::v3_checkpoint::Checkpoint =
                    serde_json::from_str(&checkpoint_json).map_err(|e| {
                        NodeError::Task(format!("failed to parse checkpoint JSON: {e}"))
                    })?;
                crate::v3_checkpoint::import_checkpoint(&storage_arc, &checkpoint)
                    .await
                    .map_err(|e| NodeError::Task(format!("checkpoint import failed: {e}")))?;
                info!("V3 checkpoint import complete");
            }
        } else if !config.v3_no_genesis && storage_arc.v3_tip().await?.is_none() {
            let v3_genesis = crate::v3_compat::build_v3_genesis_block();
            storage_arc.put_v3_block(&v3_genesis).await?;

            // Seed account balances and UTXOs from the genesis premine transactions.
            // put_v3_block only stores the block body — it does NOT index the
            // transactions into v3_accounts / v3_utxos. Without this, getBalance
            // returns 0 for all premine addresses.
            let accounts: Vec<(String, u128, u64)> = v3_genesis
                .transactions
                .iter()
                .map(|tx| (tx.to.clone(), tx.amount_zion, tx.nonce))
                .collect();
            if !accounts.is_empty() {
                storage_arc.put_v3_accounts(&accounts).await?;
                info!(count = accounts.len(), "seeded V3 genesis account balances");
            }

            let utxos: Vec<([u8; 32], u32, u64, String)> = v3_genesis
                .utxo_transactions
                .iter()
                .flat_map(|tx| {
                    tx.outputs.iter().enumerate().map(move |(i, out)| {
                        (tx.id, i as u32, out.amount, out.address.clone())
                    })
                })
                .collect();
            if !utxos.is_empty() {
                storage_arc.put_v3_utxos(&utxos).await?;
                info!(count = utxos.len(), "seeded V3 genesis UTXOs");
            }

            info!(hash = %crate::v3_compat::hex(&v3_genesis.header_hash()), "seeded V3 genesis block");
        }

        // V3 RPC handler.
        let v3_rpc = Arc::new(crate::v3_rpc::V3RpcHandler::new(storage_arc.clone()));
        v3_rpc
            .set_addresses(
                config.v3_miner_address.clone(),
                config.v3_humanitarian_address.clone(),
                config.v3_issobella_address.clone(),
            )
            .await;

        // V3 P2P sync client.
        let v3_sync = crate::v3_p2p::V3Sync::new(
            storage_arc.clone(),
            "zion-v31-node",
            "3.1.0-alpha",
            crate::v3_p2p::NetworkId::Mainnet,
        );

        let consensus = ConsensusEngine::new(Arc::new(EkamDeeksha::new()));

        // Rebuild the V31 UTXO set from storage.
        let mut utxo_set = UtxoSet::new();
        let height = storage.height().await?;
        for h in 0..=height {
            if let Some(block) = storage.get_by_height(h).await? {
                utxo_set.apply_block(&block)?;
            }
        }
        let utxo_set = Arc::new(tokio::sync::Mutex::new(utxo_set));

        Ok(Self {
            storage,
            mempool: Mempool::new(),
            consensus,
            utxo_set,
            v3_rpc,
            v3_sync,
            config,
            peer_manager: Arc::new(crate::peer_manager::PeerManager::default_manager()),
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
        let v3_sync_shutdown = shutdown.clone();
        let v3_p2p_shutdown = shutdown.clone();

        let rpc_addr = self.config.rpc_addr;
        let p2p_addr = self.config.p2p_addr;
        // V31 native P2P sync uses the configured seed peers.  V3 compat sync is
        // disabled when --v3-no-genesis is set, otherwise it uses the same seed
        // peers with the legacy V3 wire protocol.
        let seed_peers = self.config.seed_peers.clone();
        let v3_no_genesis = self.config.v3_no_genesis;
        let v3_sync = self.v3_sync.clone();
        let v3_p2p_addr = self.config.v3_p2p_addr;
        let peers = Arc::clone(&self.peer_manager);

        // Clone self so both the native sync handle and the V3 branch can use it.
        let node = Arc::clone(&self);

        let rpc = RpcServer::new(Arc::clone(&self));
        let rpc_handle = tokio::spawn(async move { rpc.run(rpc_addr, rpc_shutdown).await });

        let p2p = crate::p2p::P2P::new(Arc::clone(&self), Arc::clone(&peers));
        let p2p_handle = tokio::spawn(async move { p2p.listen(p2p_addr, p2p_shutdown).await });

        let peers_for_sync = Arc::clone(&peers);
        let v31_seed_peers = seed_peers.clone();
        let sync_handle = tokio::spawn(async move {
            crate::p2p::sync_loop(Arc::clone(&node), peers_for_sync, v31_seed_peers, sync_shutdown).await;
            Ok(()) as Result<(), NodeError>
        });

        // V3 sync loop and P2P listener: only when V3 compat is enabled.
        let v3_sync_handle = if v3_no_genesis {
            tokio::spawn(async move {
                // V3 compat disabled; this future is aborted on shutdown.
                std::future::pending::<()>().await;
                Ok(()) as Result<(), NodeError>
            })
        } else {
            let peers_for_v3_sync = Arc::clone(&peers);
            tokio::spawn(async move {
                crate::v3_p2p::sync_loop(v3_sync, peers_for_v3_sync, seed_peers, v3_sync_shutdown).await;
                Ok(()) as Result<(), NodeError>
            })
        };

        let v3_p2p_handle = if v3_no_genesis {
            tokio::spawn(async move {
                // V3 compat disabled; this future is aborted on shutdown.
                std::future::pending::<()>().await;
                Ok(()) as Result<(), NodeError>
            })
        } else {
            let v3_p2p_server = crate::v3_p2p::V3P2PServer::new(
                Arc::new(self.storage.clone()),
                "zion-v31-node",
                "3.1.0-alpha",
                crate::v3_p2p::NetworkId::Mainnet,
                v3_p2p_addr.to_string(),
                rpc_addr.to_string(),
                "0.0.0.0:0".to_string(),
                Arc::clone(&peers),
            );
            tokio::spawn(async move {
                v3_p2p_server
                    .listen(v3_p2p_addr, v3_p2p_shutdown)
                    .await
                    .map_err(NodeError::V3P2P)
            })
        };

        tokio::pin!(
            rpc_handle,
            p2p_handle,
            sync_handle,
            v3_sync_handle,
            v3_p2p_handle
        );
        tokio::select! {
            r = &mut rpc_handle => {
                p2p_handle.abort();
                sync_handle.abort();
                v3_sync_handle.abort();
                v3_p2p_handle.abort();
                r.map_err(|e| NodeError::Task(e.to_string()))??;
            }
            r = &mut p2p_handle => {
                rpc_handle.abort();
                sync_handle.abort();
                v3_sync_handle.abort();
                v3_p2p_handle.abort();
                r.map_err(|e| NodeError::Task(e.to_string()))??;
            }
            r = &mut sync_handle => {
                rpc_handle.abort();
                p2p_handle.abort();
                v3_sync_handle.abort();
                v3_p2p_handle.abort();
                r.map_err(|e| NodeError::Task(e.to_string()))??;
            }
            r = &mut v3_sync_handle => {
                rpc_handle.abort();
                p2p_handle.abort();
                sync_handle.abort();
                v3_p2p_handle.abort();
                r.map_err(|e| NodeError::Task(e.to_string()))??;
            }
            r = &mut v3_p2p_handle => {
                rpc_handle.abort();
                p2p_handle.abort();
                sync_handle.abort();
                v3_sync_handle.abort();
                r.map_err(|e| NodeError::Task(e.to_string()))??;
            }
            _ = shutdown.changed() => {
                rpc_handle.abort();
                p2p_handle.abort();
                sync_handle.abort();
                v3_sync_handle.abort();
                v3_p2p_handle.abort();
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

    /// Find a V31 native transaction by its hex id.
    ///
    /// Scans the accepted chain from tip to genesis and returns the block
    /// height, block hash (hex), and the transaction itself if found.
    pub async fn find_transaction(
        &self,
        tx_id: &str,
    ) -> Result<Option<(u64, String, Transaction)>, NodeError> {
        let (tip_header, _tip_hash) = self.storage.tip().await?.unwrap_or_else(|| {
            let genesis = genesis::genesis_block();
            let hash = genesis.header.header_hash();
            (genesis.header.clone(), hash)
        });
        for height in (0..=tip_header.height).rev() {
            if let Some(block) = self.storage.get_by_height(height).await? {
                let block_hash = block.header.header_hash().to_hex();
                for tx in &block.transactions {
                    if tx.hash().to_hex() == tx_id {
                        return Ok(Some((height, block_hash, tx.clone())));
                    }
                }
            }
        }
        Ok(None)
    }

    /// Submit a transaction to the mempool.
    pub async fn submit_transaction(&self, tx: Transaction) {
        self.mempool.add(tx).await;
    }

    /// Return unspent V31 UTXOs for an address.
    ///
    /// Excludes outputs already consumed by a mempool transaction so wallets
    /// do not build conflicting transactions while a previous spend is pending.
    pub async fn get_utxos_for_address(&self, address: &str) -> Vec<(Hash, u32, u64)> {
        let set = self.utxo_set.lock().await;
        let mut utxos = set.get_utxos_for_address(address);
        drop(set);
        let spent = self.mempool.spent_outpoints().await;
        utxos.retain(|(tx_hash, index, _amount)| {
            let outpoint = Outpoint::new(*tx_hash, *index);
            !spent.contains(&outpoint)
        });
        utxos
    }

    /// Submit a V31 UTXO transaction to the mempool.
    pub async fn submit_utxo_transaction(&self, tx: Transaction) -> Result<Hash, NodeError> {
        // Reject coinbase transactions submitted as user transactions.
        if tx.is_coinbase() {
            return Err(NodeError::Utxo(UtxoError::InputNotFound(Outpoint::new(
                Hash::default(),
                0,
            ))));
        }

        // Reject mempool double-spends.
        for input in &tx.inputs {
            let outpoint = Outpoint::new(input.previous_output, input.index);
            if self.mempool.is_spent(&outpoint).await {
                return Err(NodeError::Utxo(UtxoError::AlreadySpent(outpoint)));
            }
        }

        // Validate against the current confirmed UTXO set.
        {
            let set = self.utxo_set.lock().await;
            set.validate_transaction(&tx)?;
        }

        let tx_hash = tx.hash();
        self.mempool.add(tx).await;
        Ok(tx_hash)
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
            memo: format!("coinbase:height={}", next_height).into_bytes(),
        };

        // Filter mempool: drop transactions that are no longer valid against the
        // current UTXO set or that conflict with earlier transactions in the
        // same template.
        let mempool_txs = self.mempool.pending().await;
        let mut selected = Vec::with_capacity(mempool_txs.len());
        let mut invalid = Vec::with_capacity(mempool_txs.len());
        {
            let set = self.utxo_set.lock().await;
            let mut view = set.clone();
            for tx in mempool_txs {
                match view.apply_transaction(&tx) {
                    Ok(_) => selected.push(tx),
                    Err(e) => {
                        warn!(%e, tx_hash = %tx.hash().to_hex(), "mempool tx invalid for template");
                        invalid.push(tx.hash());
                    }
                }
            }
        }
        if !invalid.is_empty() {
            self.mempool.remove(&invalid).await;
        }

        let mut txs = selected;
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

        // Validate and apply the block's transactions to the V31 UTXO set.
        {
            let mut set = self.utxo_set.lock().await;
            set.apply_block(&block)?;
        }

        self.storage.put(&block).await?;

        // Remove included transactions from mempool.
        let included: Vec<Hash> = block.transactions.iter().map(|t| t.hash()).collect();
        self.mempool.remove(&included).await;

        // Revalidate the remaining mempool against the updated UTXO set and
        // drop any transactions that are no longer valid (e.g. outpoints spent
        // by a block received over P2P).
        {
            let set = self.utxo_set.lock().await;
            let remaining = self.mempool.pending().await;
            let mut view = set.clone();
            let mut invalid = Vec::new();
            for tx in remaining {
                if view.apply_transaction(&tx).is_err() {
                    invalid.push(tx.hash());
                }
            }
            if !invalid.is_empty() {
                self.mempool.remove(&invalid).await;
            }
        }

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
