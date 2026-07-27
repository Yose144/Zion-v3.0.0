//! `zion-core` — L1 node core for ZION V31.
//!
//! Uses `zion-l1-types` for primitives and `zion-cosmic-harmony` for the
//! canonical Ekam Deeksha PoW algorithm.

pub mod block;
pub mod consensus;
pub mod transaction;

pub use block::{Block, BlockHeader};
pub use consensus::{ConsensusEngine, ConsensusError};
pub use transaction::{Transaction, TransactionInput, TransactionOutput};
