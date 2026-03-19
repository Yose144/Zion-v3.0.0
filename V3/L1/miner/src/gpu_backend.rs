//! GPU backend abstraction for Ekam Deeksha mining.
//!
//! Provides a trait-based dispatch layer supporting:
//! - OpenCL (via `ocl` crate, feature `gpu-opencl`)
//! - CUDA   (scaffold, feature `gpu-cuda`)
//! - Metal  (scaffold, feature `gpu-metal`)
//!
//! The OpenCL backend uses the cosmic harmony Deeksha kernel from
//! `zion-cosmic-harmony::gpu::opencl_kernel`.

#![allow(dead_code)]

use anyhow::Result;
use zion_core::{DifficultyTarget, MiningHeader, MiningJob, MiningSolution};

/// Which GPU backend to use.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GpuBackendKind {
    /// Auto-detect: try OpenCL → CUDA → Metal → CPU fallback.
    Auto,
    /// Force OpenCL.
    OpenCL,
    /// Force CUDA (scaffold).
    Cuda,
    /// Force Metal (scaffold).
    Metal,
    /// No GPU — CPU only.
    Cpu,
}

impl GpuBackendKind {
    pub fn from_env() -> Self {
        match std::env::var("ZION_BACKEND")
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase()
            .as_str()
        {
            "opencl" | "ocl" => Self::OpenCL,
            "cuda" => Self::Cuda,
            "metal" => Self::Metal,
            "cpu" => Self::Cpu,
            _ => Self::Auto,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Auto => "auto",
            Self::OpenCL => "opencl",
            Self::Cuda => "cuda",
            Self::Metal => "metal",
            Self::Cpu => "cpu",
        }
    }
}

/// Result of a GPU batch mining operation.
pub struct GpuBatchResult {
    /// Nonces that met the target.
    pub solutions: Vec<(u64, [u8; 32])>,
    /// Total nonces tested in this batch.
    pub nonces_tested: u64,
}

/// Trait for GPU mining backends.
pub trait GpuMiner: Send {
    /// Human-readable device name.
    fn device_name(&self) -> String;

    /// Backend kind.
    fn backend_kind(&self) -> GpuBackendKind;

    /// Mine a batch of nonces starting from `nonce_start`.
    /// Returns any solutions found that meet the target.
    fn mine_batch(
        &mut self,
        header: MiningHeader,
        target: DifficultyTarget,
        nonce_start: u64,
        batch_size: u64,
    ) -> Result<GpuBatchResult>;

    /// Run a benchmark for the given duration.
    fn benchmark(&mut self, secs: f64) -> Result<(u64, f64, f64)>;
}

/// Try to create the best available GPU backend.
pub fn create_gpu_backend(
    kind: GpuBackendKind,
    work_size: usize,
) -> Result<Box<dyn GpuMiner>> {
    match kind {
        GpuBackendKind::Cpu => {
            anyhow::bail!("GPU backend requested but kind=cpu — use CPU mining path instead");
        }
        GpuBackendKind::OpenCL | GpuBackendKind::Auto => {
            #[cfg(feature = "gpu-opencl")]
            {
                match opencl_deeksha::OpenClDeekshaMiner::new(work_size) {
                    Ok(miner) => return Ok(Box::new(miner)),
                    Err(e) => {
                        if kind == GpuBackendKind::OpenCL {
                            anyhow::bail!("OpenCL init failed: {e}");
                        }
                        println!("gpu_opencl_unavailable reason=\"{e}\"");
                    }
                }
            }
            #[cfg(not(feature = "gpu-opencl"))]
            {
                if kind == GpuBackendKind::OpenCL {
                    anyhow::bail!("OpenCL support not compiled — rebuild with --features gpu-opencl");
                }
            }

            // Auto fallback: try CUDA
            #[cfg(feature = "gpu-cuda")]
            {
                match cuda_deeksha::CudaDeekshaMiner::new(work_size) {
                    Ok(miner) => return Ok(Box::new(miner)),
                    Err(e) => println!("gpu_cuda_unavailable reason=\"{e}\""),
                }
            }

            // Auto fallback: try Metal
            #[cfg(feature = "gpu-metal")]
            {
                match metal_deeksha::MetalDeekshaMiner::new(work_size) {
                    Ok(miner) => return Ok(Box::new(miner)),
                    Err(e) => println!("gpu_metal_unavailable reason=\"{e}\""),
                }
            }

            anyhow::bail!("no GPU backend available — compile with gpu-opencl, gpu-cuda, or gpu-metal");
        }
        GpuBackendKind::Cuda => {
            #[cfg(feature = "gpu-cuda")]
            {
                let miner = cuda_deeksha::CudaDeekshaMiner::new(work_size)?;
                return Ok(Box::new(miner));
            }
            #[cfg(not(feature = "gpu-cuda"))]
            anyhow::bail!("CUDA support not compiled — rebuild with --features gpu-cuda");
        }
        GpuBackendKind::Metal => {
            #[cfg(feature = "gpu-metal")]
            {
                let miner = metal_deeksha::MetalDeekshaMiner::new(work_size)?;
                return Ok(Box::new(miner));
            }
            #[cfg(not(feature = "gpu-metal"))]
            anyhow::bail!("Metal support not compiled — rebuild with --features gpu-metal");
        }
    }
}

/// Scan a job using a GPU backend, returning the first solution.
pub fn gpu_scan_job(gpu: &mut dyn GpuMiner, job: MiningJob) -> Option<MiningSolution> {
    match gpu.mine_batch(job.header, job.target, job.start_nonce, job.nonce_count) {
        Ok(result) => {
            if let Some((nonce, hash)) = result.solutions.first() {
                Some(MiningSolution {
                    job_id: job.job_id,
                    candidate: zion_core::BlockCandidate {
                        header: job.header,
                        nonce: *nonce,
                        height: job.height,
                    },
                    hash: *hash,
                })
            } else {
                None
            }
        }
        Err(e) => {
            eprintln!("gpu_mine_batch_error: {e}");
            None
        }
    }
}

// ─── OpenCL Backend ─────────────────────────────────────────────────────────

#[cfg(feature = "gpu-opencl")]
pub mod opencl_deeksha {
    use super::*;
    use ocl::{Buffer, Device, Kernel, Platform, ProQue};
    use std::time::Instant;
    use zion_cosmic_harmony::gpu::opencl_kernel;

    const MAX_RESULTS: u32 = 256;

    pub struct OpenClDeekshaMiner {
        pro_que: ProQue,
        kernel: Kernel,
        header_buf: Buffer<u8>,
        target_buf: Buffer<u8>,
        results_buf: Buffer<u64>,
        result_hashes_buf: Buffer<u8>,
        work_size: usize,
        device_name_cached: String,
    }

    impl OpenClDeekshaMiner {
        pub fn new(work_size: usize) -> Result<Self> {
            let kernel_src = opencl_kernel::get_deeksha_kernel_source();

            let platform = Platform::default();
            let device = Device::first(platform)
                .map_err(|e| anyhow::anyhow!("no OpenCL device found: {e}"))?;
            let device_name = device.name()
                .unwrap_or_else(|_| "unknown".to_string());

            let pro_que = ProQue::builder()
                .platform(platform)
                .device(device)
                .src(kernel_src)
                .dims(work_size)
                .build()
                .map_err(|e| anyhow::anyhow!("OpenCL build failed: {e}"))?;

            // Allocate buffers
            let header_buf = Buffer::<u8>::builder()
                .queue(pro_que.queue().clone())
                .len(80)
                .build()?;

            let target_buf = Buffer::<u8>::builder()
                .queue(pro_que.queue().clone())
                .len(32)
                .build()?;

            // results_buf: [count, nonce0, nonce1, ...] as u64
            let results_buf = Buffer::<u64>::builder()
                .queue(pro_que.queue().clone())
                .len(1 + MAX_RESULTS as usize)
                .build()?;

            // result_hashes: MAX_RESULTS * 32 bytes
            let result_hashes_buf = Buffer::<u8>::builder()
                .queue(pro_que.queue().clone())
                .len(MAX_RESULTS as usize * 32)
                .build()?;

            let kernel = pro_que
                .kernel_builder(opencl_kernel::EKAM_DEEKSHA_KERNEL_NAME)
                .arg(&header_buf)
                .arg(&target_buf)
                .arg(0u64) // nonce_start
                .arg(&results_buf)
                .arg(&result_hashes_buf)
                .arg(MAX_RESULTS)
                .build()
                .map_err(|e| anyhow::anyhow!("kernel build failed: {e}"))?;

            Ok(Self {
                pro_que,
                kernel,
                header_buf,
                target_buf,
                results_buf,
                result_hashes_buf,
                work_size,
                device_name_cached: device_name,
            })
        }
    }

    impl GpuMiner for OpenClDeekshaMiner {
        fn device_name(&self) -> String {
            self.device_name_cached.clone()
        }

        fn backend_kind(&self) -> GpuBackendKind {
            GpuBackendKind::OpenCL
        }

        fn mine_batch(
            &mut self,
            header: MiningHeader,
            target: DifficultyTarget,
            nonce_start: u64,
            batch_size: u64,
        ) -> Result<GpuBatchResult> {
            let header_bytes = header.to_bytes();
            self.header_buf.write(&header_bytes[..]).enq()?;
            self.target_buf.write(&target.bytes[..]).enq()?;

            let mut all_solutions = Vec::new();
            let mut total_tested = 0u64;
            let mut current_nonce = nonce_start;
            let remaining = batch_size;

            // Process in chunks of work_size
            let mut left = remaining;
            while left > 0 {
                let chunk = (left as usize).min(self.work_size) as u64;

                // Clear result count
                let zeros = vec![0u64; 1 + MAX_RESULTS as usize];
                self.results_buf.write(&zeros).enq()?;

                self.kernel.set_arg(2, current_nonce)?;

                unsafe {
                    self.kernel.cmd()
                        .global_work_size(chunk as usize)
                        .enq()?;
                }

                // Read results
                let mut results = vec![0u64; 1 + MAX_RESULTS as usize];
                self.results_buf.read(&mut results).enq()?;
                let count = results[0] as usize;

                if count > 0 {
                    let mut hashes = vec![0u8; MAX_RESULTS as usize * 32];
                    self.result_hashes_buf.read(&mut hashes).enq()?;

                    for i in 0..count.min(MAX_RESULTS as usize) {
                        let nonce = results[1 + i];
                        let mut hash = [0u8; 32];
                        hash.copy_from_slice(&hashes[i * 32..(i + 1) * 32]);
                        all_solutions.push((nonce, hash));
                    }
                }

                total_tested += chunk;
                current_nonce = current_nonce.wrapping_add(chunk);
                left = left.saturating_sub(chunk);
            }

            Ok(GpuBatchResult {
                solutions: all_solutions,
                nonces_tested: total_tested,
            })
        }

        fn benchmark(&mut self, secs: f64) -> Result<(u64, f64, f64)> {
            let header = MiningHeader {
                version: 3,
                previous_hash: [0xAA; 32],
                merkle_root: [0xBB; 32],
                timestamp: 1_762_000_200,
                difficulty_bits: 0x1f00ffff,
            };
            // Use impossible target so nothing matches
            let target = DifficultyTarget { bytes: [0; 32] };
            let start = Instant::now();
            let mut total_hashes = 0u64;
            let mut nonce_start = 0u64;

            while start.elapsed().as_secs_f64() < secs {
                let result = self.mine_batch(
                    header,
                    target,
                    nonce_start,
                    self.work_size as u64,
                )?;
                total_hashes += result.nonces_tested;
                nonce_start = nonce_start.wrapping_add(self.work_size as u64);
            }

            let elapsed = start.elapsed().as_secs_f64();
            let khps = if elapsed > 0.0 {
                total_hashes as f64 / elapsed / 1_000.0
            } else {
                0.0
            };

            Ok((total_hashes, elapsed, khps))
        }
    }
}

// ─── CUDA Backend (scaffold) ────────────────────────────────────────────────

#[cfg(feature = "gpu-cuda")]
pub mod cuda_deeksha {
    use super::*;

    pub struct CudaDeekshaMiner {
        work_size: usize,
    }

    impl CudaDeekshaMiner {
        pub fn new(work_size: usize) -> Result<Self> {
            // TODO: Implement CUDA backend using cudarc or raw CUDA FFI.
            // Requires: Ekam Deeksha CUDA kernel (.cu) + NVRTC compilation.
            anyhow::bail!(
                "CUDA backend not yet implemented — tracking in UPGRADE_PLAN.md Phase A4"
            );
        }
    }

    impl GpuMiner for CudaDeekshaMiner {
        fn device_name(&self) -> String {
            "cuda-unimplemented".to_string()
        }

        fn backend_kind(&self) -> GpuBackendKind {
            GpuBackendKind::Cuda
        }

        fn mine_batch(
            &mut self,
            _header: MiningHeader,
            _target: DifficultyTarget,
            _nonce_start: u64,
            _batch_size: u64,
        ) -> Result<GpuBatchResult> {
            anyhow::bail!("CUDA backend not implemented");
        }

        fn benchmark(&mut self, _secs: f64) -> Result<(u64, f64, f64)> {
            anyhow::bail!("CUDA backend not implemented");
        }
    }
}

// ─── Metal Backend (scaffold) ───────────────────────────────────────────────

#[cfg(feature = "gpu-metal")]
pub mod metal_deeksha {
    use super::*;

    pub struct MetalDeekshaMiner {
        work_size: usize,
    }

    impl MetalDeekshaMiner {
        pub fn new(work_size: usize) -> Result<Self> {
            // TODO: Implement Metal backend for Apple Silicon.
            // Requires: Ekam Deeksha MSL kernel + metal-rs bindings.
            anyhow::bail!(
                "Metal backend not yet implemented — tracking in UPGRADE_PLAN.md Phase A4"
            );
        }
    }

    impl GpuMiner for MetalDeekshaMiner {
        fn device_name(&self) -> String {
            "metal-unimplemented".to_string()
        }

        fn backend_kind(&self) -> GpuBackendKind {
            GpuBackendKind::Metal
        }

        fn mine_batch(
            &mut self,
            _header: MiningHeader,
            _target: DifficultyTarget,
            _nonce_start: u64,
            _batch_size: u64,
        ) -> Result<GpuBatchResult> {
            anyhow::bail!("Metal backend not implemented");
        }

        fn benchmark(&mut self, _secs: f64) -> Result<(u64, f64, f64)> {
            anyhow::bail!("Metal backend not implemented");
        }
    }
}

/// Detect available GPU devices and print a summary.
pub fn detect_gpus() -> Vec<String> {
    #[allow(unused_mut)]
    let mut devices = Vec::new();

    #[cfg(feature = "gpu-opencl")]
    {
        if let Ok(platforms) = ocl::Platform::list() {
            for platform in platforms {
                if let Ok(devs) = ocl::Device::list_all(platform) {
                    for dev in devs {
                        if let Ok(name) = dev.name() {
                            devices.push(format!("opencl:{name}"));
                        }
                    }
                }
            }
        }
    }

    // CUDA device detection would go here
    // Metal device detection would go here

    devices
}
