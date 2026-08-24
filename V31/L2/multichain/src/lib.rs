//! `zion-multichain` — unified L2 value layer for ZION Mainnet Alpha.
//!
//! This crate consolidates:
//! - cross-chain bridges (lock/mint),
//! - trustless atomic swaps (HTLC),
//! - DEX routing and settlement,
//! - multi-chain wallet keyring,
//! - Dharma Credits accounting.
//!
//! All modules share a single `Transfer` pipeline and a `ChainAdapter` trait.
//! No V3 code is copied here; implementations are written clean for `V31/`.

pub mod audit;
pub mod bridge;
pub mod chain;
pub mod config;
pub mod contracts;
pub mod credits;
pub mod db;
pub mod error;
pub mod multichain_wallet;
pub mod node_rewards;
pub mod rate_limit;
pub mod server;
pub mod service;
pub mod swap;
pub mod types;
pub mod wallet;
pub mod warp;
pub mod zis_auth;

pub use bridge::Bridge;
pub use chain::{ChainAdapter, ChainAdapterRegistry};
pub use config::MultichainConfig;
pub use contracts::{all_contracts, contracts_for_chain, ZionContracts};
pub use error::{MultichainError, MultichainResult};
pub use service::MultichainService;
pub use types::{Transfer, TransferDirection, TransferStatus};
pub use wallet::Keyring;
