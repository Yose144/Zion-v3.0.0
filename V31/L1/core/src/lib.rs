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
pub mod emission;
pub mod fee;
pub mod genesis;
pub mod mempool;
pub mod migration;
pub mod node;
pub mod p2p;
pub mod rpc;
pub mod storage;
pub mod transaction;
pub mod v3_checkpoint;
pub mod v3_compat;
pub mod v3_p2p;
pub mod v3_state;

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
