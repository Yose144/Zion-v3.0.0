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
pub mod config;
pub mod error;
pub mod fees;
pub mod metrics;
pub mod protocol;
pub mod registry;
pub mod router;
pub mod server;
pub mod state;
pub mod types;
pub mod validator;

pub use config::WarpConfig;
pub use error::WarpError;
pub use fees::FeeEngine;
pub use metrics::WarpMetrics;
pub use protocol::{DepositProof, MintInstruction, WarpMessage};
pub use registry::ChainRegistry;
pub use router::WarpRouter;
pub use server::{WarpState, create_router as create_api_router};
pub use state::TransferStateMachine;
pub use types::{Asset, ChainFamily, ChainId, WarpStatus, WarpTransfer};
pub use validator::WarpValidatorSet;
