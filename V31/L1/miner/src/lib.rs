//! `zion-miner` — unified ZION + optional AuxPoW fallback mining runtime.
//!
//! V31 keeps the miner self-contained. The canonical `EkamDeeksha` PoW is used
//! for ZION blocks (Stream 1). AuxPoW (Streams 2 and 3) is an optional
//! fallback revenue stream; it is compiled only when the `auxpow` feature is
//! enabled and can be disabled at runtime via `MinerConfig`.

#[cfg(feature = "auxpow")]
pub mod auxpow;
pub mod b3_verify;
pub mod config;
pub mod cpu_features;
pub mod gpu_guard;
pub mod reconnect;
pub mod runtime;
pub mod stream;
pub mod thread_affinity;

// TODO: These modules need V3 cosmic-harmony internals (deeksha_lite,
//       cosmic_harmony_with_height, algorithms_opt, scratchpad_ekam)
//       and zion_auxpow crate. Port after V3 cosmic-harmony full port.
// pub mod autonomous; // needs zion_pool::PoolMessage, ExternalCoin methods
// pub mod parallel; // needs zion_auxpow crate, feature-gated auxpow

#[cfg(feature = "auxpow")]
pub use auxpow::{ExternalCoin, Job, Share, StratumClient, StratumJob};
pub use config::MinerConfig;
pub use runtime::{MinerError, MinerRuntime};
pub use stream::{StreamId, StreamStats};
