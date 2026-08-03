//! GPU miner harness for OpenCL-accelerated external hashing.
//!
//! This module provides a GPU-accelerated mining backend using OpenCL.
//! When the `gpu-opencl` feature is disabled, the CPU miner is used instead.
//!
//! Currently this is a stub — the full OpenCL implementation from AuXpow
//! requires the `ocl` crate and GPU toolchain. V31's cosmic-harmony-v3
//! has its own GPU kernel infrastructure that can be used instead.

use anyhow::Result;

/// A found share from GPU mining.
#[derive(Debug, Clone)]
pub struct GpuFoundShare {
    pub nonce: u64,
    pub hash: [u8; 32],
    pub mix_hash: Option<[u8; 32]>,
    pub solution: Option<Vec<u8>>,
}

/// GPU miner backend (stub when `gpu-opencl` is not enabled).
#[derive(Clone)]
pub struct GpuMiner;

impl GpuMiner {
    pub fn new() -> Result<Self> {
        anyhow::bail!("GPU mining is not available (gpu-opencl feature not enabled)")
    }

    pub fn mine_simple(
        &mut self,
        _algorithm: &str,
        _header: &[u8],
        _target: &[u8; 32],
        _start_nonce: u64,
        _nonce_count: u64,
    ) -> Result<Option<GpuFoundShare>> {
        anyhow::bail!("GPU mining is not available")
    }
}

/// DAG manager for Ethash/KawPow/ProgPow (stub).
#[derive(Clone)]
pub struct DagManager;

impl DagManager {
    pub fn new() -> Result<Self> {
        anyhow::bail!("DAG management requires gpu-opencl feature")
    }
}

/// OpenCL backend module (stub).
pub mod opencl_backend {
    use super::GpuMiner;

    pub fn new(_batch_size: usize) -> Result<GpuMiner, anyhow::Error> {
        anyhow::bail!("OpenCL backend is not available (gpu-opencl feature not enabled)")
    }
}
