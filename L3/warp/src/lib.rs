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

pub mod error;
pub mod types;
pub mod protocol;
pub mod registry;
pub mod router;
pub mod state;
pub mod fees;
pub mod validator;
pub mod config;
pub mod metrics;
pub mod adapter;

pub use error::WarpError;
pub use types::{ChainId, ChainFamily, Asset, WarpTransfer, WarpStatus};
pub use protocol::{WarpMessage, DepositProof, MintInstruction};
pub use registry::ChainRegistry;
pub use router::WarpRouter;
pub use state::TransferStateMachine;
pub use fees::FeeEngine;
pub use validator::WarpValidatorSet;
pub use config::WarpConfig;
pub use metrics::WarpMetrics;
