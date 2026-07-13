//! GPU backend abstraction for multi-platform mining.
//!
//! Provides a trait-based dispatch layer supporting:
//! - OpenCL (via `ocl` crate, feature `gpu-opencl`) — AMD + NVIDIA
//! - CUDA   (via `cudarc` crate, feature `gpu-cuda`) — NVIDIA native
//! - Metal  (via `metal` crate, feature `gpu-metal`) — Apple Silicon
//!
//! The backend is selected at compile time via feature flags.
//! At runtime, `GpuBackend::new()` auto-detects the best available
//! backend and returns a boxed trait object.

use anyhow::Result;

/// A found share from GPU mining.
/// Re-exported from gpu_miner for OpenCL, duplicated for CUDA/Metal.
#[derive(Debug, Clone)]
pub struct GpuFoundShare {
    pub nonce: u64,
    pub hash: [u8; 32],
    /// Mix hash for Ethash/KawPow (needed for `eth_submitWork`).
    pub mix_hash: Option<[u8; 32]>,
    /// Equihash solution for ZelHash/FLUX (52 bytes compressed).
    pub solution: Option<Vec<u8>>,
}

#[cfg(feature = "gpu-opencl")]
impl From<crate::gpu_miner::GpuFoundShare> for GpuFoundShare {
    fn from(s: crate::gpu_miner::GpuFoundShare) -> Self {
        Self {
            nonce: s.nonce,
            hash: s.hash,
            mix_hash: s.mix_hash,
            solution: s.solution,
        }
    }
}

/// DAG buffer handle (backend-agnostic).
/// The backend stores the DAG internally; this is just a marker.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DagHandle(pub u64);

/// GPU backend trait — implemented by OpenCL, CUDA, and Metal backends.
pub trait GpuBackend: Send {
    /// Mine a batch of nonces.
    ///
    /// - `algorithm`: e.g. "blake3", "kheavyhash", "autolykos", "ethash",
    ///   "kawpow", "zelhash"
    /// - `header`: block header bytes (without nonce for most algos;
    ///   for ethash/kawpow this is the 32-byte header hash)
    /// - `extra`: algorithm-specific data (e.g. height for autolykos,
    ///   extranonce for kheavyhash)
    /// - `target`: 32-byte big-endian target
    /// - `base_nonce`: first nonce to try
    /// - `batch_size`: number of nonces to scan
    ///
    /// Returns `Ok(Some(share))` if a nonce meeting the target was found.
    fn mine(
        &mut self,
        algorithm: &str,
        header: &[u8],
        extra: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        batch_size: u64,
    ) -> Result<Option<GpuFoundShare>>;

    /// Convenience: mine with no extra data.
    fn mine_simple(
        &mut self,
        algorithm: &str,
        header: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        batch_size: u64,
    ) -> Result<Option<GpuFoundShare>> {
        self.mine(algorithm, header, &[], target, base_nonce, batch_size)
    }

    /// Upload the per-epoch Ethash DAG (16 × size_entries u64 words).
    fn set_ethash_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()>;

    /// Upload the per-epoch KawPow DAG.
    fn set_kawpow_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()>;

    /// Get the device name.
    fn device_name(&self) -> &str;

    /// Get the backend type name ("opencl", "cuda", "metal").
    fn backend_name(&self) -> &str;

    /// Get the current work size.
    fn work_size(&self) -> usize;

    /// Set the work size (number of work-items per batch).
    fn set_work_size(&mut self, size: usize);

    /// Benchmark: run `secs` seconds of mining and return (hashes, hashrate, temp).
    fn benchmark(&mut self, secs: f64) -> Result<(u64, f64, f64)> {
        let _ = secs;
        Ok((0, 0.0, 0.0))
    }
}

/// Auto-detect and create the best available GPU backend.
///
/// Tries backends in this order (based on compile-time features):
/// 1. CUDA (NVIDIA native — best perf on NVIDIA)
/// 2. Metal (Apple Silicon — best perf on Mac)
/// 3. OpenCL (cross-platform — works on AMD, NVIDIA, Intel)
///
/// Returns the first backend that initializes successfully.
pub fn detect_backend(work_size: usize) -> Result<Box<dyn GpuBackend>> {
    // Try CUDA first (best perf on NVIDIA)
    #[cfg(feature = "gpu-cuda")]
    {
        match crate::gpu_cuda::CudaBackend::new(work_size) {
            Ok(backend) => {
                println!(
                    "gpu_backend: using CUDA device: {}",
                    backend.device_name()
                );
                return Ok(Box::new(backend));
            }
            Err(e) => {
                println!("gpu_backend: CUDA unavailable: {e}");
            }
        }
    }

    // Try Metal (Apple Silicon)
    #[cfg(feature = "gpu-metal")]
    {
        match crate::gpu_metal::MetalBackend::new(work_size) {
            Ok(backend) => {
                println!(
                    "gpu_backend: using Metal device: {}",
                    backend.device_name()
                );
                return Ok(Box::new(backend));
            }
            Err(e) => {
                println!("gpu_backend: Metal unavailable: {e}");
            }
        }
    }

    // Try OpenCL (cross-platform fallback)
    #[cfg(feature = "gpu-opencl")]
    {
        match crate::gpu_opencl::new_backend(work_size) {
            Ok(backend) => {
                println!(
                    "gpu_backend: using OpenCL device: {}",
                    backend.device_name()
                );
                return Ok(Box::new(backend));
            }
            Err(e) => {
                println!("gpu_backend: OpenCL unavailable: {e}");
            }
        }
    }

    anyhow::bail!(
        "no GPU backend available — compile with --features gpu-opencl, gpu-cuda, or gpu-metal"
    )
}

/// List all available GPU devices across all backends.
pub fn list_devices() -> Vec<String> {
    let mut devices = Vec::new();

    #[cfg(feature = "gpu-cuda")]
    {
        devices.extend(crate::gpu_cuda::list_cuda_devices());
    }

    #[cfg(feature = "gpu-metal")]
    {
        devices.extend(crate::gpu_metal::list_metal_devices());
    }

    #[cfg(feature = "gpu-opencl")]
    {
        devices.extend(crate::gpu_opencl::list_opencl_devices());
    }

    devices
}
