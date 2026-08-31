//! ZION L1 node core (V31 Mainnet Alpha).
//!
//! The core crate defines the canonical block/transaction model, the consensus
//! engine, chain state, storage, difficulty/emission rules, and minimal P2P + RPC
//! for a launch-ready node.

pub mod admin;
pub mod block;
pub mod consensus;
pub mod crypto;
pub mod difficulty;
pub mod discovery;
pub mod emission;
pub mod fee;
pub mod genesis;
pub mod ibd;
pub mod mempool;
pub mod metrics;
pub mod migration;
pub mod node;
pub mod orphan;
pub mod p2p;
pub mod p2p_security;
pub mod peer_manager;
pub mod propagation;
pub mod rpc;
pub mod storage;
pub mod transaction;
pub mod utxo;
pub mod v31_wallet;

#[cfg(feature = "v3-binaries")]
pub mod v3_chain;
#[cfg(feature = "v3-binaries")]
pub mod v3_checkpoint;
#[cfg(feature = "v3-binaries")]
pub mod v3_compat;
#[cfg(feature = "v3-binaries")]
pub mod v3_full_checkpoint;
#[cfg(feature = "v3-binaries")]
pub mod v3_mempool;
#[cfg(feature = "v3-binaries")]
pub mod v3_p2p;
#[cfg(feature = "v3-binaries")]
pub mod v3_reorg;
#[cfg(feature = "v3-binaries")]
pub mod v3_rpc;
#[cfg(feature = "v3-binaries")]
pub mod v3_state;
#[cfg(feature = "v3-binaries")]
pub mod v3_template;
#[cfg(feature = "v3-binaries")]
pub mod v3_tx;

// Ported V3 core types — ChainState, NodeRuntime, CoreRuntime, etc.
#[cfg(feature = "v3-binaries")]
pub mod chain_state;
#[cfg(feature = "v3-binaries")]
pub mod node_runtime;

// TODO: These modules need V3 core types (ChainState, NodeRuntime, etc.)
//       before they can be enabled. Port in Phase B.1.
#[cfg(feature = "v3-binaries")]
pub mod launch;
#[cfg(feature = "v3-binaries")]
pub mod v3_bridge; // needs k256, hex(), SpendableUtxo, MIGRATION_DIVISOR
#[cfg(feature = "v3-binaries")]
pub mod v3_node_builder;
#[cfg(feature = "v3-binaries")]
pub mod v3_validation; // needs crate::tx, crate::genesis::validate_premine
#[cfg(feature = "v3-binaries")]
pub mod v3_wallet;
pub mod websocket;

pub use block::{Block, BlockHeader};
pub use consensus::{ConsensusEngine, ConsensusError};
pub use difficulty::{difficulty_to_target, lwma_next_difficulty, target_to_difficulty, BlockInfo};
pub use emission::{block_subsidy, fee_split, flowers_to_zion, format_zion, zion_to_flowers};
pub use genesis::{genesis_block, genesis_hash, GENESIS_DIFFICULTY, GENESIS_TIMESTAMP};
pub use mempool::Mempool;
pub use migration::{migrate_v3_state, MigrationError, MigrationSummary};
pub use node::{Node, NodeConfig};
pub use storage::{Storage, StorageError};
pub use transaction::{Transaction, TransactionInput, TransactionOutput};
pub use utxo::{Outpoint, UtxoError, UtxoSet};
pub use v31_wallet::{
    build_batch_payout, build_htlc_claim, build_htlc_lock, build_htlc_refund, build_send,
    build_send_with_memo, htlc_output_script, BatchRecipient, BuildResult, SpendableUtxo,
    WalletError, MAX_BATCH_RECIPIENTS, MIN_PAYOUT_AMOUNT,
};
pub use zion_cosmic_harmony::EkamDeeksha;

#[cfg(feature = "v3-binaries")]
pub use v3_compat::{
    BlockCandidate, DifficultyTarget as V3DifficultyTarget, MiningHeader, MiningJob,
    MiningSolution, PremineOutput, SealedBlock, V3Block, PREMINE_OUTPUTS,
};
