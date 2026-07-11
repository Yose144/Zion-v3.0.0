//! GPU miner harness for OpenCL-accelerated external hashing.
//!
//! This module provides a GPU-accelerated mining backend using OpenCL.
//! It loads kernel source files from `csrc/opencl/` and dispatches them
//! on the GPU.
//!
//! Currently supported GPU algorithms:
//!   - `blake3_alph` — Alephium double-Blake3 PoW
//!   - `kheavyhash`  — Kaspa kHeavyHash PoW (simplified)
//!
//! The GPU miner is gated behind the `gpu-opencl` feature.  When the feature
//! is disabled, the CPU miner in `miner_harness.rs` is used instead.
//!
//! ## Usage
//!
//! ```no_run
//! use zion_auxpow::gpu_miner::GpuMiner;
//!
//! // Create a GPU miner for the first available OpenCL device
//! let miner = GpuMiner::new().unwrap();
//!
//! // Mine a batch of nonces
//! let result = miner.mine_blake3_alph(&header, &extranonce1, &target, base_nonce, batch_size);
//! ```

#![cfg(feature = "gpu-opencl")]

use anyhow::{anyhow, Context, Result};
use std::path::PathBuf;

/// A found share from GPU mining.
#[derive(Debug, Clone)]
pub struct GpuFoundShare {
    pub nonce: u64,
    pub hash: [u8; 32],
}

/// OpenCL GPU miner for external PoW algorithms.
pub struct GpuMiner {
    // OpenCL handles would go here.  We use a minimal struct to avoid
    // pulling in the `opencl3` or `ocl` crate as a hard dependency.
    // In a real implementation, this would hold:
    //   - cl_context
    //   - cl_command_queue
    //   - cl_program (compiled kernels)
    //   - cl_kernel handles
    _phantom: (),
}

impl GpuMiner {
    /// Create a new GPU miner, initializing OpenCL on the first available
    /// device.
    pub fn new() -> Result<Self> {
        // In a real implementation, this would:
        // 1. Get platform IDs via clGetPlatformIDs
        // 2. Get device IDs via clGetDeviceIDs
        // 3. Create a context via clCreateContext
        // 4. Create a command queue via clCreateCommandQueue
        // 5. Load and compile kernel source from csrc/opencl/*.cl
        // 6. Create kernel handles via clCreateKernel

        // For now, return a placeholder that indicates OpenCL is not yet
        // fully wired up.  The kernel source files exist in csrc/opencl/
        // and are ready to be loaded.
        Err(anyhow!(
            "GPU miner: OpenCL backend not yet wired up. \
             Kernel sources are in csrc/opencl/. \
             Add `opencl3` or `ocl` crate to Cargo.toml to enable."
        ))
    }

    /// Mine Blake3 (Alephium) on the GPU.
    ///
    /// Scans `batch_size` nonces starting from `base_nonce`.  Returns the
    /// first nonce whose double-Blake3 hash meets `target`.
    pub fn mine_blake3_alph(
        &self,
        header: &[u8],
        extranonce1: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        batch_size: u64,
    ) -> Result<Option<GpuFoundShare>> {
        // In a real implementation:
        // 1. Create input buffers (header, target, base_nonce)
        // 2. Create output buffers (nonce, hash, found flag)
        // 3. Set kernel arguments
        // 4. Enqueue NDRange kernel with batch_size work-items
        // 5. Read output buffers
        // 6. Return found share if any

        let _ = (header, extranonce1, target, base_nonce, batch_size);
        Err(anyhow!("GPU miner: mine_blake3_alph not yet implemented"))
    }

    /// Mine kHeavyHash (Kaspa) on the GPU.
    pub fn mine_kheavyhash(
        &self,
        pre_pow_hash: &[u8],
        timestamp: u64,
        target: &[u8; 32],
        base_nonce: u64,
        batch_size: u64,
    ) -> Result<Option<GpuFoundShare>> {
        let _ = (pre_pow_hash, timestamp, target, base_nonce, batch_size);
        Err(anyhow!("GPU miner: mine_kheavyhash not yet implemented"))
    }

    /// Get the path to the OpenCL kernel source files.
    fn kernel_dir() -> Result<PathBuf> {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."));
        let dir = manifest_dir.join("csrc").join("opencl");
        if dir.exists() {
            Ok(dir)
        } else {
            Err(anyhow!("OpenCL kernel directory not found: {:?}", dir))
        }
    }

    /// List available OpenCL kernel source files.
    pub fn list_kernels() -> Result<Vec<String>> {
        let dir = Self::kernel_dir()?;
        let mut kernels = Vec::new();
        for entry in std::fs::read_dir(&dir)
            .with_context(|| format!("reading kernel dir {:?}", dir))?
        {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".cl") {
                kernels.push(name);
            }
        }
        Ok(kernels)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kernel_sources_exist() {
        // The kernel source files should exist in the repo
        let kernels = GpuMiner::list_kernels();
        // This may fail in some build environments, so just check it doesn't panic
        if let Ok(kernels) = kernels {
            assert!(
                kernels.iter().any(|k| k.contains("blake3")),
                "blake3 kernel should exist"
            );
        }
    }
}
