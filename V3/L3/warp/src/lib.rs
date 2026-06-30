//! # 🌀 ZION WARP — Wormhole Architecture for Rainbow Protocol
//!
//! Universal cross-chain bridge connecting ZION L1 to 10 blockchain families:
//! EVM (Base, Arbitrum, BSC, Polygon), Solana, Tron, Stellar, Cardano, Cosmos, Bitcoin.
//!
//! ## Architecture
//! ```text
//!     ┌──────────────────────────────┐
//!     │         WARP ROUTER          │
//!     │  Transfer │ Validator │ Fee  │
//!     │  Routing  │ Quorum   │ Eng  │
//!     └─────┬─────┴─────┬────┴──┬───┘
//!           │     CHAIN ADAPTERS    │
//!     ┌─────┴──────────────────┴────┐
//!     │EVM│Sol│Tron│Stel│Card│Cos│BTC│
//!     └─────────────────────────────┘
//! ```

pub mod adapter;
pub mod btc_signer;
pub mod cardano_signer;
pub mod config;
pub mod cosmos_signer;
pub mod db;
pub mod error;
pub mod evm_signer;
pub mod fees;
pub mod metrics;
pub mod protocol;
pub mod registry;
pub mod router;
pub mod server;
pub mod solana_signer;
pub mod state;
pub mod stellar_signer;
pub mod tron_signer;
pub mod types;
pub mod validator;
pub mod watcher;
pub mod xp_bridge;

pub use config::WarpConfig;
pub use db::TransferDb;
pub use error::WarpError;
pub use fees::FeeEngine;
pub use metrics::WarpMetrics;
pub use protocol::{DepositProof, MintInstruction, WarpMessage};
pub use registry::ChainRegistry;
pub use router::WarpRouter;
pub use server::{create_router as create_api_router, WarpState};
pub use state::TransferStateMachine;
pub use types::{Asset, ChainFamily, ChainId, WarpStatus, WarpTransfer};
pub use validator::WarpValidatorSet;
pub use watcher::WarpWatcher;
pub use xp_bridge::{WarpXpEvent, WarpXpReward};
