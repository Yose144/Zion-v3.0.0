//! GPU mining support for ZION
//!
//! Supports CUDA and OpenCL backends for high-performance mining.

use anyhow::Result;

#[cfg(feature = "cuda")]
mod cuda;

// OpenCL backend is guarded by the `gpu` feature.
pub mod benchmark;
pub mod metal;
#[cfg(feature = "gpu")]
mod opencl;

#[cfg(feature = "cuda")]
pub use cuda::CudaMiner;

pub use benchmark::{auto_tune, print_benchmark_results, run_benchmark, AutoTuneConfig};
pub use metal::MetalGpuMiner;
#[cfg(feature = "gpu")]
pub use opencl::OpenCLMiner;

/// GPU platform type
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GpuPlatform {
    /// NVIDIA CUDA
    Cuda,
    /// OpenCL (AMD, Intel, NVIDIA)
    OpenCL,
    /// Apple Metal (M1/M2/M3/M4/M5)
    Metal,
}

impl GpuPlatform {
    fn from_env(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "cuda" | "nvidia" => Some(Self::Cuda),
            "opencl" | "ocl" | "amd" | "intel" => Some(Self::OpenCL),
            "metal" | "apple" => Some(Self::Metal),
            _ => None,
        }
    }
}

/// GPU device information
#[derive(Debug, Clone)]
pub struct GpuDevice {
    pub id: usize,
    pub name: String,
    pub platform: GpuPlatform,
    pub compute_units: u32,
    pub memory_mb: u64,
}

/// GPU mining interface
pub trait GpuMiner: Send + Sync {
    /// Initialize GPU device
    fn init(&mut self) -> Result<()>;

    /// Mine with GPU (returns hash if found)
    fn mine_batch(
        &mut self,
        header: &[u8],
        target: &[u8; 32],
        nonce_start: u64,
        batch_size: u64,
        height: u64,
    ) -> Result<Option<(u64, [u8; 32])>>;

    /// Get device information
    fn device_info(&self) -> &GpuDevice;

    /// Get current hashrate
    fn hashrate(&self) -> f64;

    /// Natural (chip) batch size: how many nonces one GPU dispatch processes.
    /// The mining loop should call mine_batch with this granularity so that job
    /// changes are picked up quickly between dispatches.
    /// Returns None for backends that self-manage iteration (CUDA/OpenCL).
    fn natural_batch_size(&self) -> Option<u64> {
        None
    }
}

/// Detect available GPU devices
pub fn detect_gpus() -> Result<Vec<GpuDevice>> {
    let mut devices = Vec::new();

    // Try Metal first (Apple Silicon — fastest on macOS)
    if let Ok(metal_devices) = metal::detect_metal_devices() {
        if !metal_devices.is_empty() {
            log::debug!("Metal GPU detected: {} device(s)", metal_devices.len());
            devices.extend(metal_devices);
        }
    }

    // Try CUDA (NVIDIA)
    #[cfg(feature = "cuda")]
    {
        if let Ok(cuda_devices) = cuda::detect_cuda_devices() {
            devices.extend(cuda_devices);
        }
    }

    // Try OpenCL (AMD/Intel/NVIDIA fallback)
    #[cfg(feature = "gpu")]
    {
        if let Ok(opencl_devices) = opencl::detect_opencl_devices() {
            // Filter out duplicates (NVIDIA cards already in CUDA, Apple already in Metal)
            let existing_names: Vec<String> = devices.iter().map(|d| d.name.clone()).collect();

            for dev in opencl_devices {
                if !existing_names.iter().any(|n| dev.name.contains(n)) {
                    devices.push(dev);
                }
            }
        }
    }

    let preferred = std::env::var("ZION_GPU_BACKEND")
        .ok()
        .and_then(|v| GpuPlatform::from_env(&v));

    let platform_rank = |platform: GpuPlatform| -> usize {
        match preferred {
            Some(pref) if platform == pref => 0,
            _ => match platform {
                GpuPlatform::Metal => 0,
                GpuPlatform::Cuda => 1,
                GpuPlatform::OpenCL => 2,
            },
        }
    };

    devices.sort_by_key(|d| platform_rank(d.platform));

    if let Some(pref) = preferred {
        log::info!("🎯 GPU backend preference: {:?} (ZION_GPU_BACKEND)", pref);
    }

    Ok(devices)
}

/// Create GPU miner for device
pub fn create_miner(device: &GpuDevice) -> Result<Box<dyn GpuMiner>> {
    match device.platform {
        GpuPlatform::Metal => {
            // CHv4 scratchpad: 524288 bytes (512 KiB) per thread.
            // Limit to ~20% of available Metal VRAM to avoid OOM.
            // Example: M1 5461 MB → 1092 MB / 512 KiB = 2184 threads (≈1 GB scratchpad).
            let scratchpad_per_thread_bytes: usize = 524_288;
            let safe_vram_bytes = (device.memory_mb as usize * 1024 * 1024) / 5; // 20%
            let batch = (safe_vram_bytes / scratchpad_per_thread_bytes)
                .max(512)
                .min(8192);
            log::info!(
                "Metal CHv4 batch_size={} ({} MiB scratchpad, VRAM={} MiB)",
                batch,
                batch * scratchpad_per_thread_bytes / (1024 * 1024),
                device.memory_mb
            );
            let miner = MetalGpuMiner::new(batch)?;
            Ok(Box::new(miner))
        }
        GpuPlatform::Cuda => {
            #[cfg(feature = "cuda")]
            {
                let miner = CudaMiner::new(device.id)?;
                Ok(Box::new(miner))
            }
            #[cfg(not(feature = "cuda"))]
            {
                Err(anyhow::anyhow!(
                    "CUDA support not compiled. Rebuild with --features cuda"
                ))
            }
        }
        GpuPlatform::OpenCL => {
            #[cfg(feature = "gpu")]
            {
                let miner = OpenCLMiner::new(device.id)?;
                Ok(Box::new(miner))
            }
            #[cfg(not(feature = "gpu"))]
            {
                Err(anyhow::anyhow!(
                    "OpenCL support not compiled. Rebuild with --features gpu"
                ))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_gpus() {
        // Should not panic, even if no GPUs found
        let result = detect_gpus();
        assert!(result.is_ok());

        if let Ok(devices) = result {
            println!("Found {} GPU(s)", devices.len());
            for dev in devices {
                println!(
                    "  - {} ({:?}, {} CUs, {} MB)",
                    dev.name, dev.platform, dev.compute_units, dev.memory_mb
                );
            }
        }
    }
}
