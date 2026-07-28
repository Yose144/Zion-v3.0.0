//! WARP — Wormhole Architecture for Rainbow Protocol.
//!
//! Universal cross-chain bridge connecting ZION L1 to 10+ blockchain families.
//! Ported from V3 `zion-warp` crate into `zion-multichain` as a submodule.

pub mod adapter;
pub mod aptos_signer;
pub mod bcs;
pub mod bolt11;
pub mod btc_signer;
pub mod cardano_signer;
pub mod cbor;
pub mod config;
pub mod cosmos_signer;
pub mod db;
pub mod error;
pub mod evm_signer;
pub mod executor;
pub mod fees;
pub mod lightning_signer;
pub mod metrics;
pub mod near_signer;
pub mod protocol;
pub mod registry;
pub mod router;
pub mod server;
pub mod solana_signer;
pub mod state;
pub mod stellar_signer;
pub mod sui_signer;
pub mod timelock;
pub mod ton_cell;
pub mod ton_signer;
pub mod tron_signer;
pub mod types;
pub mod validator;
pub mod watcher;
pub mod xp_bridge;

pub use config::WarpConfig;
pub use db::TransferDb;
pub use error::WarpError;
pub use executor::OutboundExecutor;
pub use fees::FeeEngine;
pub use metrics::WarpMetrics;
pub use protocol::{DepositProof, MintInstruction, WarpMessage};
pub use registry::ChainRegistry;
pub use router::WarpRouter;
pub use server::{create_router as create_api_router, WarpState};
pub use state::TransferStateMachine;
pub use timelock::TimelockMonitor;
pub use types::{Asset, ChainFamily, ChainId, WarpStatus, WarpTransfer};
pub use validator::WarpValidatorSet;
pub use watcher::WarpWatcher;
pub use xp_bridge::{WarpXpEvent, WarpXpReward};
