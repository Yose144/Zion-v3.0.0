//! ZION AuxPow — Merge Mining Module
//!
//! Standalone crate for auxiliary Proof-of-Work merge mining:
//!   - External hashers (Blake3, kHeavyHash, ...) for profit-switch coins
//!   - Stratum v1 / EthStratum client for external pool connection
//!   - Profit-switch scheduler with hysteresis + circuit breaker
//!   - B2b pool-side job multiplexer + share forwarder
//!
//! Designed to be integrated into the ZION pool server (`V3/L1/pool`).
//! This crate is self-contained and has no dependency on ZION consensus code.

pub mod auxpow_client;
pub mod auxpow_scheduler;
pub mod dual_stratum;
pub mod external_hashers;
#[cfg(feature = "gpu-opencl")]
pub mod gpu_miner;
#[cfg(feature = "native-hashers")]
pub mod native_ffi;
pub mod miner_harness;
pub mod multiplexer;
pub mod parent_chains;
pub mod share_forwarder;
pub mod true_auxpow;
pub mod types;

pub use auxpow_client::{AuxPowClient, ExternalJob, StratumProtocol};
pub use auxpow_scheduler::{AuxPowScheduler, SchedulerConfig};
pub use dual_stratum::{
    AssignmentCounts, DualStratumJob, DualStratumMiner, FoundExternalShare, ShareDisposition,
    WorkPackage,
};
pub use external_hashers::{
    hash_autolykos, hash_blake3, hash_ethash, hash_ethash_with_dag, hash_kawpow, hash_kheavyhash,
    mine_ethash, ExternalAlgorithm,
};
pub use parent_chains::{
    AlphHeader, CoinbaseCommitment, DcrHeader, AUXPOW_COINBASE_MAGIC, AUXPOW_COMMITMENT_LEN,
    DCR_HEADER_SIZE,
};
pub use miner_harness::{mine, FoundShare};
pub use multiplexer::JobMultiplexer;
pub use share_forwarder::ShareForwarder;
pub use true_auxpow::{
    validate_auxpow, validate_auxpow_full, AuxPowData, AuxPowFullValidation, AuxPowProofBuilder,
    AuxPowValidation, ParentAlgorithm, ParentHeader,
};
pub use types::{
    AuxPowConfig, AuxPowStats, CoinProfile, ExternalCoin, JobPackage, PoolPreference, ProfitEntry,
    ShareForwardResult, SplitConfig,
};
