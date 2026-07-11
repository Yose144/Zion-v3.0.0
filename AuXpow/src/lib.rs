//! ZION AuxPow — Merge Mining Module
//!
//! Standalone crate for auxiliary Proof-of-Work merge mining:
//!   - External hashers (Blake3, kHeavyHash, ...) for profit-switch coins
//!   - Stratum v1 / EthStratum client for external pool connection
//!   - Profit-switch scheduler with hysteresis + circuit breaker
//!
//! Designed to be integrated into the ZION pool server (`V3/L1/pool`).
//! This crate is self-contained and has no dependency on ZION consensus code.

pub mod auxpow_client;
pub mod auxpow_scheduler;
pub mod external_hashers;
pub mod types;

pub use auxpow_client::{AuxPowClient, ExternalJob, StratumProtocol};
pub use auxpow_scheduler::{AuxPowScheduler, SchedulerConfig};
pub use external_hashers::{hash_blake3, hash_kheavyhash, ExternalAlgorithm};
pub use types::{
    AuxPowConfig, AuxPowStats, CoinProfile, ExternalCoin, PoolPreference, ProfitEntry,
};
