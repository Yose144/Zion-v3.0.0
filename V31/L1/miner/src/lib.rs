//! `zion-miner` — unified ZION + optional AuxPoW fallback mining runtime.
//!
//! V31 keeps the miner self-contained. The canonical `EkamDeeksha` PoW is used
//! for ZION blocks (Stream 1). AuxPoW (Streams 2 and 3) is an optional
//! fallback revenue stream; it is compiled only when the `auxpow` feature is
//! enabled and can be disabled at runtime via `MinerConfig`.

#![allow(dead_code, unexpected_cfgs)] // V3 ported modules — used when fully integrated

#[cfg(feature = "auxpow")]
pub mod auxpow;
pub mod autonomous;
pub mod b3_verify;
pub mod config;
pub mod cpu_features;
pub mod gpu_guard;
pub mod pool_message;
pub mod reconnect;
pub mod runtime;
pub mod stream;
pub mod thread_affinity;

// TODO: parallel.rs needs zion_auxpow crate (feature-gated).
// pub mod parallel;

#[cfg(feature = "auxpow")]
pub use auxpow::{
    AuxPowClient, AuxPowClientConfig, ExternalCoin, ExternalJob, Job, Share, ShareResult,
    StratumClient, StratumJob, StratumProtocol,
};
pub use config::MinerConfig;
pub use runtime::{MinerError, MinerRuntime};
pub use stream::{StreamId, StreamStats};
