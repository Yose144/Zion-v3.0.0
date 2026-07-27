//! `zion-miner` — unified ZION + AuxPoW mining runtime.
//!
//! V31 merges the standalone `AuXpow/` crate into the miner so there is one
//! mining process per rig. The canonical `EkamDeeksha` PoW is used for ZION
//! blocks; `auxpow` handles external parent-chain shares via stratum.

pub mod auxpow;
pub mod config;
pub mod runtime;
pub mod stream;

pub use auxpow::{ExternalCoin, Job, Share, StratumClient};
pub use config::MinerConfig;
pub use runtime::{MinerError, MinerRuntime};
pub use stream::{StreamId, StreamStats};
