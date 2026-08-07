//! `zion-miner` — unified ZION + optional AuxPoW fallback mining runtime.
//!
//! V31 keeps the miner self-contained. The canonical `EkamDeeksha` PoW is used
//! for ZION blocks (Stream 1). AuxPoW (Streams 2 and 3) is an optional
//! fallback revenue stream; it is compiled only when the `auxpow` feature is
//! enabled and can be disabled at runtime via `MinerConfig`.

#![allow(dead_code, unexpected_cfgs)] // V3 ported modules — used when fully integrated

pub mod autonomous;
#[cfg(feature = "auxpow")]
pub mod auxpow;
pub mod b3_verify;
pub mod config;
pub mod cpu_features;
pub mod gpu;
pub mod gpu_guard;
pub mod metrics;
pub mod pool_message;
pub mod reconnect;
pub mod runtime;
pub mod stream;
pub mod v3_pool_client;
pub mod stream_profit;
pub mod thread_affinity;

// TUI modules — interactive terminal UI (feature-gated, requires crossterm).
#[cfg(feature = "tui")]
pub mod banner;
#[cfg(feature = "tui")]
pub mod interactive;
#[cfg(feature = "tui")]
pub mod setup_menu;
#[cfg(feature = "tui")]
pub mod tui_compat;
#[cfg(feature = "tui")]
pub mod ui;

// parallel.rs provides multi-algorithm hashing and is only useful when
// AuxPoW / external mining is enabled.
#[cfg(feature = "auxpow")]
pub mod parallel;

#[cfg(feature = "auxpow")]
pub use auxpow::{
    AuxPowClient, AuxPowClientConfig, ExternalCoin, ExternalJob, Job, Share, ShareResult,
    StratumClient, StratumJob, StratumProtocol,
};
pub use config::MinerConfig;
pub use runtime::{MinerError, MinerRuntime};
pub use stream::{StreamId, StreamStats};
