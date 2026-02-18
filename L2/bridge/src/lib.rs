//! # ZION Bridge Relay
//!
//! Cross-chain bridge relay between ZION L1 and EVM chains (Base, Arbitrum, BSC, Polygon).
//!
//! ## Architecture
//!
//! ```text
//! ZION L1                    Bridge Relay (this crate)              EVM Chain
//! ┌──────────┐              ┌─────────────────────┐              ┌──────────┐
//! │ User     │  lock TX     │  L1 Watcher         │  submitProof │ wZION    │
//! │ sends    │─────────────▶│  (polls /health,    │─────────────▶│ .sol     │
//! │ ZION to  │              │   /api/block/...)   │              │ mints    │
//! │ bridge   │              │                     │              │ wZION    │
//! │ address  │              │  EVM Watcher        │  burn event  │          │
//! │          │◀─────────────│  (listens to        │◀─────────────│ User     │
//! │ unlock   │  unlock TX   │   BridgeBurn)       │              │ burns    │
//! └──────────┘              └─────────────────────┘              └──────────┘
//! ```
//!
//! ## Modules
//!
//! - [`config`]    — Bridge configuration (L1 RPC, EVM RPC, keys, thresholds)
//! - [`types`]     — Shared types (LockEvent, BurnEvent, BridgeState)
//! - [`l1_watcher`]  — Watches ZION L1 for lock transactions to bridge address
//! - [`evm_watcher`] — Watches EVM chain for wZION BridgeBurn events
//! - [`relayer`]   — Submits cross-chain proofs (mint on EVM, unlock on L1)
//! - [`validator`] — Multisig validation logic (3-of-5 consensus)
//! - [`db`]        — SQLite persistence for bridge state
//! - [`metrics`]   — Bridge monitoring and statistics

pub mod config;
pub mod types;
pub mod l1_watcher;
pub mod evm_watcher;
pub mod relayer;
pub mod validator;
pub mod db;
pub mod metrics;

pub use config::BridgeConfig;
pub use types::*;
