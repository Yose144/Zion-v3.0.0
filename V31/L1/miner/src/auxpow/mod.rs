//! AuxPoW (merged mining) support merged into `zion-miner`.
//!
//! AuxPoW is treated as an optional fallback revenue stream. If the external
//! stratum pool is unreachable or disabled, the miner falls back to ZION-only
//! operation.

pub mod client;
pub mod beamhash_ref;
pub mod dual_stratum;
pub mod eaglesong_ref;
pub mod gpu_miner;
#[cfg(feature = "gpu-opencl")]
pub mod gpu_opencl_full;
pub mod hasher;
pub mod neoscrypt_ref;
pub mod nexapow_ref;
pub mod octopus_ref;
#[cfg(feature = "native-hashers")]
pub mod native;
pub mod parent_chains;
pub mod progpow_codegen;
pub(crate) mod pure;
pub mod qhash_ref;
pub mod qpow;
pub mod scheduler;
pub mod true_auxpow;
pub mod types;
pub mod verthash_ref;

pub use client::{
    AuxPowClient, AuxPowClientConfig, ExternalJob, ShareResult, StratumClient, StratumJob,
    StratumProtocol,
};
pub use dual_stratum::{
    AssignmentCounts, DualStratumJob, DualStratumMiner, FoundExternalShare, ShareDisposition,
    WorkPackage,
};
pub use gpu_miner::{DagManager, GpuFoundShare, GpuMiner};
pub use hasher::{
    generate_keryx_matrix, hash_autolykos, hash_blake3, hash_blake3_alph, hash_blake3_raw,
    hash_etchash, hash_ethash, hash_ethash_with_dag, hash_kawpow, hash_kawpow_final,
    hash_keryxhash, hash_keryxhash_extranonce, hash_kheavyhash, hash_kheavyhash_extranonce,
    hash_pearl, hash_verushash, hash_verushash_header, hash_zelhash, is_valid_autolykos_solution,
    is_valid_zelhash_solution, keryx_active_salt, keryx_active_salt_version,
    kheavyhash_matrix_flat, meets_target, meets_target_little_endian, mine_ethash, mine_verushash,
    mine_zelhash, KERYX_MATRIX_SALT_V1, KERYX_MATRIX_SALT_V2, KERYX_MATRIX_SALT_V4,
    KERYX_SALT_V2_ACTIVATION_DAA, KERYX_SALT_V4_ACTIVATION_DAA,
};
pub use parent_chains::{
    AlphHeader, CoinbaseCommitment, DcrHeader, AUXPOW_COINBASE_MAGIC, AUXPOW_COMMITMENT_LEN,
    DCR_HEADER_SIZE,
};
pub use scheduler::AuxPoWScheduler;
pub use true_auxpow::{
    validate_auxpow, validate_auxpow_full, AuxPowData, AuxPowFullValidation, AuxPowProofBuilder,
    AuxPowValidation, ParentAlgorithm, ParentHeader,
};
pub use types::{
    AuxPowConfig, AuxPowStats, ExternalAlgorithm, Job, JobPackage, PoolPreference, Share,
    ShareForwardResult, SplitConfig, DEFAULT_BTC_WALLET,
};

pub use zion_cosmic_harmony::ExternalCoin;

/// Brute-force a valid nonce for an AuxPoW job. This is a CPU scaffold; real
/// mining will use the GPU backends and dedicated external kernels.
pub fn find_share(coin: ExternalCoin, job: &Job, start: u64, limit: u64) -> Option<Share> {
    let mut header_hash = [0u8; 32];
    let copy_len = job.header.len().min(32);
    header_hash[..copy_len].copy_from_slice(&job.header[..copy_len]);

    // Quantus QPoW — 512-bit nonce/target; the u64 path below cannot
    // represent it.
    if coin.algorithm() == "qpow-poseidon2" {
        let target = job.target_512?;
        let mut header = [0u8; 32];
        header[..copy_len].copy_from_slice(&job.header[..copy_len]);
        let base = qpow::build_nonce(&job.extranonce, 0);
        let prestate = qpow::mining_prestate_low64(&header, &base);
        let (low, hash64) = qpow::scan_low64(&prestate, &target, start, limit)?;
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&hash64[..32]);
        return Some(Share {
            job_id: job.job_id.clone(),
            coin,
            nonce: low,
            hash,
            header_hash,
            mix_hash: None,
            solution: None,
            nonce_512: Some(qpow::build_nonce(&job.extranonce, low)),
            hash_512: Some(hash64),
            extranonce2: job.extranonce2.clone(),
            ntime: job.ntime.clone(),
        });
    }

    for offset in 0..limit {
        let nonce = start.wrapping_add(offset);
        let hash = hasher::hash_for_coin(coin, &job.header, nonce);
        if hasher::meets_target(&hash, &job.target) {
            return Some(Share {
                job_id: job.job_id.clone(),
                coin,
                nonce,
                hash,
                header_hash,
                mix_hash: None,
                solution: None,
                nonce_512: None,
                hash_512: None,
                extranonce2: job.extranonce2.clone(),
                ntime: job.ntime.clone(),
            });
        }
    }
    None
}
