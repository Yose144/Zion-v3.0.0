//! `zion-miner` — unified ZION + optional AuxPoW fallback mining runtime.
//!
//! V31 keeps the miner self-contained. The canonical `EkamDeeksha` PoW is used
//! for ZION blocks (Stream 1). AuxPoW (Streams 2 and 3) is an optional
//! fallback revenue stream; it is compiled only when the `auxpow` feature is
//! enabled and can be disabled at runtime via `MinerConfig`.

#[cfg(feature = "auxpow")]
pub mod auxpow;
pub mod config;
pub mod runtime;
pub mod stream;

#[cfg(feature = "auxpow")]
pub use auxpow::{ExternalCoin, Job, Share, StratumClient, StratumJob};
pub use config::MinerConfig;
pub use runtime::{MinerError, MinerRuntime};
pub use stream::{StreamId, StreamStats};
