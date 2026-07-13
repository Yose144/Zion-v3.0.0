//! OpenCL GPU backend — wrapper around gpu_miner::GpuMiner.
//!
//! This module provides the OpenCL implementation of the `GpuBackend` trait.
//! It delegates to the existing `GpuMiner` implementation in `gpu_miner.rs`.

#[cfg(feature = "gpu-opencl")]
pub use crate::gpu_miner::{GpuMiner, GpuFoundShare};

/// OpenCL backend type alias.
#[cfg(feature = "gpu-opencl")]
pub type OpenClBackend = GpuMiner;

/// Create a new OpenCL backend.
#[cfg(feature = "gpu-opencl")]
pub fn new_backend(work_size: usize) -> anyhow::Result<OpenClBackend> {
    crate::gpu_miner::opencl_backend::new(work_size)
}

/// List available OpenCL devices.
#[cfg(feature = "gpu-opencl")]
pub fn list_opencl_devices() -> Vec<String> {
    crate::gpu_miner::opencl_backend::list_devices()
}
