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
pub mod beamhash;
pub mod dual_stratum;
pub mod external_hashers;
pub mod gpu_backend;
#[cfg(feature = "gpu-opencl")]
pub mod gpu_miner;
#[cfg(feature = "gpu-opencl")]
pub mod gpu_opencl;
#[cfg(feature = "gpu-cuda")]
pub mod gpu_cuda;
#[cfg(feature = "gpu-metal")]
pub mod gpu_metal;
#[cfg(feature = "native-hashers")]
pub mod native_ffi;
#[cfg(feature = "native-hashers")]
pub use native_ffi::{generate_ethash_dag, generate_kawpow_dag, EthashDag, KawpowDag};
pub mod miner_harness;
pub mod multiplexer;
pub mod parent_chains;
pub mod pearl_pouw;
pub mod pearl_real_pouw;
pub mod progpow_codegen;
pub mod share_forwarder;
pub mod true_auxpow;
pub mod types;

pub use auxpow_client::{AuxPowClient, ExternalJob, ShareResult, StratumProtocol};
pub use auxpow_scheduler::{AuxPowScheduler, SchedulerConfig};
pub use dual_stratum::{
    AssignmentCounts, DualStratumJob, DualStratumMiner, FoundExternalShare, ShareDisposition,
    WorkPackage,
};
pub use external_hashers::{
    hash_autolykos, hash_blake3, hash_blake3_alph, hash_ethash, hash_ethash_with_dag, hash_kawpow,
    hash_keryxhash, hash_keryxhash_extranonce, hash_kheavyhash, hash_verushash,
    hash_verushash_header, hash_zelhash, is_valid_autolykos_solution, is_valid_zelhash_solution,
    mine_ethash, mine_zelhash, ExternalAlgorithm, KERYX_MATRIX_SALT_V1, KERYX_MATRIX_SALT_V2,
    KERYX_MATRIX_SALT_V4, KERYX_SALT_V2_ACTIVATION_DAA, KERYX_SALT_V4_ACTIVATION_DAA,
    generate_keryx_matrix, keryx_active_salt, keryx_active_salt_version,
};
pub use beamhash::{hash_beamhash, is_valid_solution as is_valid_beamhash_solution};
#[cfg(any(feature = "native-hashers", feature = "native-verushash"))]
pub use external_hashers::init_verushash;
pub use parent_chains::{
    AlphHeader, CoinbaseCommitment, DcrHeader, AUXPOW_COINBASE_MAGIC, AUXPOW_COMMITMENT_LEN,
    DCR_HEADER_SIZE,
};
pub use miner_harness::{mine, mine_best, FoundShare};
pub use multiplexer::JobMultiplexer;
pub use share_forwarder::ShareForwarder;
#[cfg(all(feature = "gpu-opencl", feature = "native-hashers"))]
pub use gpu_miner::DagManager;
pub use true_auxpow::{
    validate_auxpow, validate_auxpow_full, AuxPowData, AuxPowFullValidation, AuxPowProofBuilder,
    AuxPowValidation, ParentAlgorithm, ParentHeader,
};
pub use types::{
    AuxPowConfig, AuxPowStats, CoinProfile, ExternalCoin, JobPackage, PoolPreference, ProfitEntry,
    ShareForwardResult, SplitConfig,
};

/// Install the ring CryptoProvider as the process-level default for rustls.
///
/// Must be called BEFORE any rustls usage (reqwest, tokio-rustls, etc.).
/// This is needed because both aws-lc-rs and ring may be present
/// (ring via reqwest), and rustls can't auto-select.
///
/// Call this at the very start of `main()` in binaries that use AuxPow
/// with EpicStratum (TLS) protocol.
pub fn install_rustls_crypto_provider() {
    let result = tokio_rustls::rustls::crypto::ring::default_provider()
        .install_default();
    eprintln!("install_rustls_crypto_provider: result={:?}", result);
}
