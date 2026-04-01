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

    /// Update NPU weights for the given block height's epoch.
    /// No-op if the epoch hasn't changed since the last call.
    fn update_epoch(&mut self, _height: u64) -> Result<()> { Ok(()) }

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
    use ocl::builders::ProgramBuilder;
    use std::time::Instant;
    use zion_cosmic_harmony::gpu::opencl_kernel;

    const SCRATCHPAD_BYTES: usize = 262_144; // 256 KiB per thread
    const SENTINEL: u64 = 0xFFFF_FFFF_FFFF_FFFF;

    pub struct OpenClDeekshaMiner {
        pro_que: ProQue,
        kernel: Kernel,
        header_buf: Buffer<u8>,
        scratchpad_buf: Buffer<u8>,
        result_nonce_buf: Buffer<u64>,
        result_hash_buf: Buffer<u8>,
        npu_w1: Buffer<i8>,
        npu_b1: Buffer<i8>,
        npu_w2: Buffer<i8>,
        npu_b2: Buffer<i8>,
        npu_scale1: Buffer<i16>,
        npu_scale2: Buffer<i16>,
        work_size: usize,
        device_name_cached: String,
        current_epoch: u64,
    }

    /// Determine max work_size that fits in GPU VRAM.
    /// Each thread needs SCRATCHPAD_BYTES (256 KiB).
    /// Reserve ~25% for NPU buffers, driver overhead, and other allocations.
    fn vram_aware_work_size(device: &Device, requested: usize) -> usize {
        let global_mem = device.info(ocl::enums::DeviceInfo::GlobalMemSize)
            .ok()
            .and_then(|v| match v {
                ocl::enums::DeviceInfoResult::GlobalMemSize(n) => Some(n as usize),
                _ => None,
            })
            .unwrap_or(2_000_000_000); // fallback 2 GB

        // Use 70% of VRAM for scratchpad
        let usable = (global_mem * 70) / 100;
        let max_by_mem = usable / SCRATCHPAD_BYTES;

        // Also respect env override
        let env_cap = std::env::var("ZION_OCL_WORK_CAP")
            .ok()
            .and_then(|v| v.trim().parse::<usize>().ok())
            .unwrap_or(usize::MAX);

        requested.min(max_by_mem).min(env_cap).max(64)
    }

    /// AMD RDNA / GCN build options for better perf on Radeon GPUs.
    fn amd_build_opts(device_name: &str) -> String {
        if device_name.contains("gfx") || device_name.contains("Radeon")
            || device_name.contains("AMD") || device_name.contains("RDNA")
        {
            "-cl-std=CL1.2 -cl-mad-enable -cl-fast-relaxed-math \
             -cl-no-signed-zeros -cl-denorms-are-zero"
                .to_string()
        } else {
            String::new()
        }
    }

    impl OpenClDeekshaMiner {
        pub fn new(work_size: usize) -> Result<Self> {
            let kernel_src = opencl_kernel::get_deeksha_kernel_source();

            let platform = Platform::default();
            let device = Device::first(platform)
                .map_err(|e| anyhow::anyhow!("no OpenCL device found: {e}"))?;
            let device_name = device.name()
                .unwrap_or_else(|_| "unknown".to_string());

            let actual_work_size = vram_aware_work_size(&device, work_size);
            let build_opts = amd_build_opts(&device_name);

            let pro_que = if build_opts.is_empty() {
                ProQue::builder()
                    .platform(platform)
                    .device(device)
                    .src(kernel_src)
                    .dims(actual_work_size)
                    .build()
                    .map_err(|e| anyhow::anyhow!("OpenCL build failed: {e}"))?
            } else {
                let mut prog = ProgramBuilder::new();
                prog.src(kernel_src)
                    .cmplr_opt(build_opts.clone());
                ProQue::builder()
                    .platform(platform)
                    .device(device)
                    .prog_bldr(prog)
                    .dims(actual_work_size)
                    .build()
                    .map_err(|e| anyhow::anyhow!("OpenCL build failed: {e}"))?
            };

            let q = pro_que.queue().clone();

            // ── Core buffers ────────────────────────────────────────────
            let header_buf = Buffer::<u8>::builder()
                .queue(q.clone()).len(128).build()?;

            let scratchpad_buf = Buffer::<u8>::builder()
                .queue(q.clone())
                .len(actual_work_size * SCRATCHPAD_BYTES)
                .build()
                .map_err(|e| anyhow::anyhow!(
                    "scratchpad alloc failed ({} MiB): {e}",
                    actual_work_size * SCRATCHPAD_BYTES / (1024 * 1024)
                ))?;

            let result_nonce_buf = Buffer::<u64>::builder()
                .queue(q.clone()).len(1).build()?;

            let result_hash_buf = Buffer::<u8>::builder()
                .queue(q.clone()).len(32).build()?;

            // ── NPU weight buffers ──────────────────────────────────────
            let init_epoch = 0u64;
            let flat = zion_cosmic_harmony::algorithms_npu::chv4_npu_weights_flat_epoch(init_epoch);

            let npu_w1 = Buffer::<i8>::builder()
                .queue(q.clone()).len(flat.w1.len()).copy_host_slice(&flat.w1).build()?;
            let npu_b1 = Buffer::<i8>::builder()
                .queue(q.clone()).len(flat.b1.len()).copy_host_slice(&flat.b1).build()?;
            let npu_w2 = Buffer::<i8>::builder()
                .queue(q.clone()).len(flat.w2.len()).copy_host_slice(&flat.w2).build()?;
            let npu_b2 = Buffer::<i8>::builder()
                .queue(q.clone()).len(flat.b2.len()).copy_host_slice(&flat.b2).build()?;
            let npu_scale1 = Buffer::<i16>::builder()
                .queue(q.clone()).len(flat.scale1.len()).copy_host_slice(&flat.scale1).build()?;
            let npu_scale2 = Buffer::<i16>::builder()
                .queue(q.clone()).len(flat.scale2.len()).copy_host_slice(&flat.scale2).build()?;

            // ── Kernel: ekam_deeksha_mine (14 args) ─────────────────────
            // Signature:
            //   0: header        (__global const uchar*)
            //   1: header_len    (uint)
            //   2: nonce_base    (ulong)
            //   3: nonce_count   (uint)
            //   4: scratchpad    (__global uchar*)
            //   5: target_u32    (uint)
            //   6: result_nonce  (__global ulong*)
            //   7: result_hash   (__global uchar*)
            //   8: npu_w1        (__global const char*)
            //   9: npu_b1        (__global const char*)
            //  10: npu_w2        (__global const char*)
            //  11: npu_b2        (__global const char*)
            //  12: npu_scale1    (__global const short*)
            //  13: npu_scale2    (__global const short*)
            let kernel = pro_que
                .kernel_builder(opencl_kernel::EKAM_DEEKSHA_KERNEL_NAME)
                .arg(&header_buf)          // 0
                .arg(80u32)                // 1: header_len
                .arg(0u64)                 // 2: nonce_base (updated per batch)
                .arg(actual_work_size as u32) // 3: nonce_count
                .arg(&scratchpad_buf)      // 4
                .arg(0u32)                 // 5: target_u32 (updated per batch)
                .arg(&result_nonce_buf)    // 6
                .arg(&result_hash_buf)     // 7
                .arg(&npu_w1)              // 8
                .arg(&npu_b1)              // 9
                .arg(&npu_w2)              // 10
                .arg(&npu_b2)              // 11
                .arg(&npu_scale1)          // 12
                .arg(&npu_scale2)          // 13
                .build()
                .map_err(|e| anyhow::anyhow!("kernel build failed: {e}"))?;

            let scratch_mib = actual_work_size * SCRATCHPAD_BYTES / (1024 * 1024);
            println!(
                "gpu_opencl_init device=\"{}\" work_size={} scratchpad_mib={} build_opts=\"{}\"",
                device_name, actual_work_size, scratch_mib, build_opts,
            );

            Ok(Self {
                pro_que,
                kernel,
                header_buf,
                scratchpad_buf,
                result_nonce_buf,
                result_hash_buf,
                npu_w1,
                npu_b1,
                npu_w2,
                npu_b2,
                npu_scale1,
                npu_scale2,
                work_size: actual_work_size,
                device_name_cached: device_name,
                current_epoch: init_epoch,
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

        fn update_epoch(&mut self, height: u64) -> Result<()> {
            let epoch = zion_cosmic_harmony::algorithms_npu::epoch_from_height(height);
            if epoch == self.current_epoch {
                return Ok(());
            }
            // GPU kernel only supports Standard (64→128→64) topology
            let topology = zion_cosmic_harmony::algorithms_npu::MlpTopology::for_epoch(epoch);
            if !matches!(topology, zion_cosmic_harmony::algorithms_npu::MlpTopology::Standard) {
                return Err(anyhow::anyhow!(
                    "GPU kernel unsupported topology {:?} for epoch {} (height {}), falling back to CPU",
                    topology, epoch, height
                ));
            }
            let flat = zion_cosmic_harmony::algorithms_npu::chv4_npu_weights_flat_epoch(epoch);
            self.npu_w1.write(&flat.w1).enq()?;
            self.npu_b1.write(&flat.b1).enq()?;
            self.npu_w2.write(&flat.w2).enq()?;
            self.npu_b2.write(&flat.b2).enq()?;
            self.npu_scale1.write(&flat.scale1).enq()?;
            self.npu_scale2.write(&flat.scale2).enq()?;
            println!("gpu_opencl_npu_epoch_update epoch={} height={}", epoch, height);
            self.current_epoch = epoch;
            Ok(())
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

            // Target: LE u32 from first 4 bytes
            let target_u32 = u32::from_le_bytes([
                target.bytes[0], target.bytes[1],
                target.bytes[2], target.bytes[3],
            ]);

            let mut all_solutions = Vec::new();
            let mut total_tested = 0u64;
            let mut current_nonce = nonce_start;
            let mut left = batch_size;

            while left > 0 {
                let chunk = (left as usize).min(self.work_size);
                // Work-group size: 256 for AMD RDNA/GCN wavefront occupancy
                let local_size = 256.min(chunk);
                let global_size = ((chunk + local_size - 1) / local_size) * local_size;

                // Reset sentinel
                let sentinel_slice: [u64; 1] = [SENTINEL];
                self.result_nonce_buf.write(&sentinel_slice[..]).enq()?;

                // Update dynamic kernel args
                self.kernel.set_arg(1, header_bytes.len() as u32)?;
                self.kernel.set_arg(2, current_nonce)?;
                self.kernel.set_arg(3, chunk as u32)?;
                self.kernel.set_arg(5, target_u32)?;

                unsafe {
                    self.kernel.cmd()
                        .global_work_size(global_size)
                        .local_work_size(local_size)
                        .enq()?;
                }

                // Read result
                let mut nonce_out = vec![SENTINEL];
                self.result_nonce_buf.read(&mut nonce_out).enq()?;

                if nonce_out[0] != SENTINEL {
                    let mut hash_out = vec![0u8; 32];
                    self.result_hash_buf.read(&mut hash_out).enq()?;
                    let mut hash = [0u8; 32];
                    hash.copy_from_slice(&hash_out);
                    all_solutions.push((nonce_out[0], hash));
                    total_tested += chunk as u64;
                    break; // Early termination
                }

                total_tested += chunk as u64;
                current_nonce = current_nonce.wrapping_add(chunk as u64);
                left = left.saturating_sub(chunk as u64);
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
            // Impossible target so nothing matches
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

// ─── CUDA Backend ───────────────────────────────────────────────────────────

#[cfg(feature = "gpu-cuda")]
pub mod cuda_deeksha {
    use super::*;
    use cudarc::driver::{CudaDevice, CudaSlice, LaunchAsync, LaunchConfig};
    use cudarc::nvrtc::compile_ptx;
    use std::sync::Arc;
    use std::time::Instant;

    const CUDA_KERNEL_SRC: &str = include_str!("cosmic_harmony_deeksha.cu");
    const SCRATCHPAD_BYTES: usize = 262_144; // 256 KiB per thread
    const SENTINEL: u64 = 0xFFFF_FFFF_FFFF_FFFF;
    const DEFAULT_WORK_SIZE_CAP: usize = 32_768;

    pub struct CudaDeekshaMiner {
        dev: Arc<CudaDevice>,
        work_size: usize,
        device_name_cached: String,
        // Pre-allocated GPU buffers
        header_buf:     CudaSlice<u8>,
        scratchpad_buf: CudaSlice<u8>,
        result_nonce:   CudaSlice<u64>,
        result_hash:    CudaSlice<u8>,
        // NPU weight buffers
        npu_w1:     CudaSlice<i8>,
        npu_b1:     CudaSlice<i8>,
        npu_w2:     CudaSlice<i8>,
        npu_b2:     CudaSlice<i8>,
        npu_scales: CudaSlice<i16>,
        current_epoch: u64,
    }

    impl CudaDeekshaMiner {
        pub fn new(work_size: usize) -> Result<Self> {
            let dev = CudaDevice::new(0)
                .map_err(|e| anyhow::anyhow!("CUDA device init failed: {e}"))?;

            let device_name = dev.name()
                .unwrap_or_else(|_| "unknown CUDA device".to_string());

            // Compile PTX from embedded CUDA source
            let ptx = compile_ptx(CUDA_KERNEL_SRC)
                .map_err(|e| anyhow::anyhow!("NVRTC compile failed: {e}"))?;
            dev.load_ptx(ptx, "deeksha", &["deeksha_mine", "ekam_deeksha_mine", "ekam_deeksha_debug"])
                .map_err(|e| anyhow::anyhow!("PTX load failed: {e}"))?;

            // Conservative work size cap for 32GB-class GPUs. Default 32k lanes
            // keeps scratchpad allocation around 8 GiB and matched the best RTX 5090
            // release benchmark in current testing.
            let work_cap = std::env::var("ZION_CUDA_WORK_CAP")
                .ok()
                .and_then(|v| v.trim().parse::<usize>().ok())
                .unwrap_or(DEFAULT_WORK_SIZE_CAP)
                .max(64);
            let actual_work_size = work_size.min(work_cap).max(64);

            // Allocate buffers
            let header_buf = dev.alloc_zeros::<u8>(80)
                .map_err(|e| anyhow::anyhow!("header alloc: {e}"))?;
            let scratchpad_buf = dev.alloc_zeros::<u8>(actual_work_size * SCRATCHPAD_BYTES)
                .map_err(|e| anyhow::anyhow!("scratchpad alloc: {e}"))?;
            let result_nonce = dev.htod_copy(vec![SENTINEL])
                .map_err(|e| anyhow::anyhow!("result_nonce alloc: {e}"))?;
            let result_hash = dev.alloc_zeros::<u8>(32)
                .map_err(|e| anyhow::anyhow!("result_hash alloc: {e}"))?;

            // NPU weights — init with epoch 0
            let init_epoch = 0u64;
            let flat = zion_cosmic_harmony::algorithms_npu::chv4_npu_weights_flat_epoch(init_epoch);
            let npu_w1 = dev.htod_copy(flat.w1)
                .map_err(|e| anyhow::anyhow!("npu_w1 alloc: {e}"))?;
            let npu_b1 = dev.htod_copy(flat.b1)
                .map_err(|e| anyhow::anyhow!("npu_b1 alloc: {e}"))?;
            let npu_w2 = dev.htod_copy(flat.w2)
                .map_err(|e| anyhow::anyhow!("npu_w2 alloc: {e}"))?;
            let npu_b2 = dev.htod_copy(flat.b2)
                .map_err(|e| anyhow::anyhow!("npu_b2 alloc: {e}"))?;
            let mut scales = flat.scale1;
            scales.extend_from_slice(&flat.scale2);
            let npu_scales = dev.htod_copy(scales)
                .map_err(|e| anyhow::anyhow!("npu_scales alloc: {e}"))?;

            println!(
                "gpu_cuda_init device=\"{}\" work_size={} scratchpad_mb={}",
                device_name,
                actual_work_size,
                actual_work_size * SCRATCHPAD_BYTES / (1024 * 1024),
            );

            Ok(Self {
                dev,
                work_size: actual_work_size,
                device_name_cached: device_name,
                header_buf,
                scratchpad_buf,
                result_nonce,
                result_hash,
                npu_w1,
                npu_b1,
                npu_w2,
                npu_b2,
                npu_scales,
                current_epoch: init_epoch,
            })
        }
    }

    impl GpuMiner for CudaDeekshaMiner {
        fn device_name(&self) -> String {
            self.device_name_cached.clone()
        }

        fn backend_kind(&self) -> GpuBackendKind {
            GpuBackendKind::Cuda
        }

        fn update_epoch(&mut self, height: u64) -> Result<()> {
            let epoch = zion_cosmic_harmony::algorithms_npu::epoch_from_height(height);
            if epoch == self.current_epoch {
                return Ok(());
            }
            let flat = zion_cosmic_harmony::algorithms_npu::chv4_npu_weights_flat_epoch(epoch);
            self.npu_w1 = self.dev.htod_copy(flat.w1)
                .map_err(|e| anyhow::anyhow!("npu_w1 update: {e}"))?;
            self.npu_b1 = self.dev.htod_copy(flat.b1)
                .map_err(|e| anyhow::anyhow!("npu_b1 update: {e}"))?;
            self.npu_w2 = self.dev.htod_copy(flat.w2)
                .map_err(|e| anyhow::anyhow!("npu_w2 update: {e}"))?;
            self.npu_b2 = self.dev.htod_copy(flat.b2)
                .map_err(|e| anyhow::anyhow!("npu_b2 update: {e}"))?;
            let mut scales = flat.scale1;
            scales.extend_from_slice(&flat.scale2);
            self.npu_scales = self.dev.htod_copy(scales)
                .map_err(|e| anyhow::anyhow!("npu_scales update: {e}"))?;
            println!("gpu_cuda_npu_epoch_update epoch={} height={}", epoch, height);
            self.current_epoch = epoch;
            Ok(())
        }

        fn mine_batch(
            &mut self,
            header: MiningHeader,
            target: DifficultyTarget,
            nonce_start: u64,
            batch_size: u64,
        ) -> Result<GpuBatchResult> {
            let header_bytes = header.to_bytes();
            self.dev.htod_sync_copy_into(&header_bytes[..], &mut self.header_buf)
                .map_err(|e| anyhow::anyhow!("header upload: {e}"))?;

            // Target: LE u32 from first 4 bytes of target
            let target_u32 = u32::from_le_bytes([
                target.bytes[0], target.bytes[1],
                target.bytes[2], target.bytes[3],
            ]);

            let mut all_solutions = Vec::new();
            let mut total_tested = 0u64;
            let mut current_nonce = nonce_start;
            let mut left = batch_size;

            let func = self.dev.get_func("deeksha", "deeksha_mine")
                .ok_or_else(|| anyhow::anyhow!("deeksha_mine kernel not found"))?;

            while left > 0 {
                let chunk = (left as usize).min(self.work_size) as u32;
                let threads_per_block = 256u32;
                let blocks = (chunk + threads_per_block - 1) / threads_per_block;
                let cfg = LaunchConfig {
                    grid_dim: (blocks, 1, 1),
                    block_dim: (threads_per_block, 1, 1),
                    shared_mem_bytes: 0,
                };

                // Reset sentinel
                self.dev.htod_sync_copy_into(&[SENTINEL], &mut self.result_nonce)
                    .map_err(|e| anyhow::anyhow!("reset sentinel: {e}"))?;

                unsafe {
                    func.clone().launch(cfg, (
                        &self.header_buf,
                        header_bytes.len() as u32,
                        current_nonce,
                        &self.scratchpad_buf,
                        target_u32,
                        &mut self.result_nonce,
                        &mut self.result_hash,
                        &self.npu_w1,
                        &self.npu_b1,
                        &self.npu_w2,
                        &self.npu_b2,
                        &self.npu_scales,
                    )).map_err(|e| anyhow::anyhow!("kernel launch: {e}"))?;
                }

                // Sync and read result
                let nonce_result = self.dev.dtoh_sync_copy(&self.result_nonce)
                    .map_err(|e| anyhow::anyhow!("read result_nonce: {e}"))?;

                if nonce_result[0] != SENTINEL {
                    let hash_result = self.dev.dtoh_sync_copy(&self.result_hash)
                        .map_err(|e| anyhow::anyhow!("read result_hash: {e}"))?;
                    let mut hash = [0u8; 32];
                    hash.copy_from_slice(&hash_result[..32]);
                    all_solutions.push((nonce_result[0], hash));
                    total_tested += chunk as u64;
                    break; // Early termination on solution
                }

                total_tested += chunk as u64;
                current_nonce = current_nonce.wrapping_add(chunk as u64);
                left = left.saturating_sub(chunk as u64);
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

// ─── Metal Backend (Apple Silicon) ───────────────────────────────────────────

#[cfg(feature = "gpu-metal")]
pub mod metal_deeksha {
    use super::*;
    use metal::{Device, MTLResourceOptions, MTLSize};
    use std::time::Instant;

    const SENTINEL: u64 = 0xFFFF_FFFF_FFFF_FFFF;
    const SENTINEL_U32: u32 = 0xFFFF_FFFF;

    pub struct MetalDeekshaMiner {
        device: Device,
        queue: metal::CommandQueue,
        pipeline: metal::ComputePipelineState,
        header_buf: metal::Buffer,
        params_buf: metal::Buffer,
        nonce_base_buf: metal::Buffer,
        scratchpad_buf: metal::Buffer,
        result_nonce_buf: metal::Buffer,
        result_hash_buf: metal::Buffer,
        npu_weights_buf: metal::Buffer,
        npu_biases_buf: metal::Buffer,
        npu_scales_buf: metal::Buffer,
        npu_meta_buf: metal::Buffer,
        batch_size: usize,
        threads_per_tg: usize,
        device_name_cached: String,
        current_epoch: u64,
    }

    impl MetalDeekshaMiner {
        pub fn new(work_size: usize) -> Result<Self> {
            let device = Device::system_default()
                .ok_or_else(|| anyhow::anyhow!("no Metal device found"))?;
            let device_name = device.name().to_string();
            let queue = device.new_command_queue();

            // Compile shader from embedded source
            let shader_src = include_str!("ekam_deeksha.metal");
            let options = metal::CompileOptions::new();
            let library = device
                .new_library_with_source(shader_src, &options)
                .map_err(|e| anyhow::anyhow!("Metal shader compilation failed: {:?}", e))?;

            let func = library
                .get_function("ekam_deeksha_mine", None)
                .map_err(|e| anyhow::anyhow!("kernel function not found: {:?}", e))?;

            let pipeline = device
                .new_compute_pipeline_state_with_function(&func)
                .map_err(|e| anyhow::anyhow!("Metal pipeline creation failed: {:?}", e))?;

            let max_tpg = pipeline.max_total_threads_per_threadgroup() as usize;
            // Memory-hard workloads (256 KiB scratchpad) benefit from smaller
            // threadgroups to reduce L2 pressure.  Use 64 on M1 and let the
            // GPU schedule many concurrent threadgroups across its cores.
            // On M2+/Pro/Max larger threadgroups help hide latency.
            let threads_per_tg = if device_name.contains("M1") {
                64
            } else if device_name.contains("Pro") || device_name.contains("Max") || device_name.contains("Ultra") {
                256
            } else {
                128
            }.min(max_tpg);

            // Auto-cap batch_size based on device memory.
            // Each thread needs 256 KiB scratchpad.
            // M1 (8 GB shared): ~58% optimal to avoid memory pressure.
            // Pro/Max/Ultra (16-192 GB): can use more.
            let recommended = device.recommended_max_working_set_size();
            let pct = if recommended > 12_000_000_000 {
                75  // Pro/Max/Ultra: plenty of GPU memory
            } else {
                58  // M1/M2 base: avoid memory pressure on shared RAM
            };
            let max_scratch_bytes = (recommended / 100) * pct;
            let max_threads_by_mem = (max_scratch_bytes / 262_144) as usize;
            let batch_size = work_size
                .max(threads_per_tg)
                .min(max_threads_by_mem.max(threads_per_tg));
            let opts = MTLResourceOptions::StorageModeShared;

            // Core buffers
            let header_buf = device.new_buffer(80, opts);
            let params_buf = device.new_buffer(12, opts);          // 3 × u32
            let nonce_base_buf = device.new_buffer(8, opts);       // u64
            let result_nonce_buf = device.new_buffer(12, opts);    // atomic_uint flag + nonce_lo + nonce_hi
            let result_hash_buf = device.new_buffer(32, opts);     // hash output

            // Scratchpad: batch_size × 256 KiB per thread
            let scratch_bytes = (batch_size as u64) * 262_144u64;
            let scratchpad_buf = device.new_buffer(scratch_bytes, opts);
            if scratchpad_buf.length() < scratch_bytes {
                anyhow::bail!(
                    "scratchpad allocation failed: need {} MiB, got {} bytes (device recommended {} MiB)",
                    scratch_bytes / (1024 * 1024),
                    scratchpad_buf.length(),
                    recommended / (1024 * 1024),
                );
            }

            // NPU weights — packed variable-topology format for all epochs
            let init_epoch = 0u64;
            let packed = zion_cosmic_harmony::algorithms_npu::chv4_npu_weights_packed(init_epoch);

            let npu_weights_buf = device.new_buffer_with_data(
                packed.weights.as_ptr() as *const _,
                packed.weights.len() as u64,
                opts,
            );
            let npu_biases_buf = device.new_buffer_with_data(
                packed.biases.as_ptr() as *const _,
                packed.biases.len() as u64,
                opts,
            );
            let npu_scales_buf = device.new_buffer_with_data(
                packed.scales.as_ptr() as *const _,
                (packed.scales.len() * 2) as u64,
                opts,
            );
            let npu_meta_buf = device.new_buffer_with_data(
                packed.meta.as_ptr() as *const _,
                (packed.meta.len() * 4) as u64,
                opts,
            );

            println!(
                "gpu_metal_init device=\"{}\" batch_size={} threads_per_tg={} scratchpad_mib={}",
                device_name, batch_size, threads_per_tg, scratch_bytes / (1024 * 1024)
            );

            Ok(Self {
                device,
                queue,
                pipeline,
                header_buf,
                params_buf,
                nonce_base_buf,
                scratchpad_buf,
                result_nonce_buf,
                result_hash_buf,
                npu_weights_buf,
                npu_biases_buf,
                npu_scales_buf,
                npu_meta_buf,
                batch_size,
                threads_per_tg,
                device_name_cached: device_name,
                current_epoch: init_epoch,
            })
        }

        fn dispatch_batch(&mut self, nonce_start: u64, count: usize) {
            // Write nonce base
            unsafe {
                let ptr = self.nonce_base_buf.contents() as *mut u64;
                *ptr = nonce_start;
            }

            // Reset result sentinel (u32 flag at offset 0)
            unsafe {
                let ptr = self.result_nonce_buf.contents() as *mut u32;
                *ptr = SENTINEL_U32;
            }

            let cb = self.queue.new_command_buffer();
            let enc = cb.new_compute_command_encoder();
            enc.set_compute_pipeline_state(&self.pipeline);
            enc.set_buffer(0, Some(&self.header_buf), 0);
            enc.set_buffer(1, Some(&self.params_buf), 0);
            enc.set_buffer(2, Some(&self.nonce_base_buf), 0);
            enc.set_buffer(3, Some(&self.scratchpad_buf), 0);
            enc.set_buffer(4, Some(&self.result_nonce_buf), 0);
            enc.set_buffer(5, Some(&self.result_hash_buf), 0);
            enc.set_buffer(6, Some(&self.npu_weights_buf), 0);
            enc.set_buffer(7, Some(&self.npu_biases_buf), 0);
            enc.set_buffer(8, Some(&self.npu_scales_buf), 0);
            enc.set_buffer(9, Some(&self.npu_meta_buf), 0);

            let grid = MTLSize::new(count as u64, 1, 1);
            let tg = MTLSize::new(self.threads_per_tg as u64, 1, 1);
            enc.dispatch_threads(grid, tg);
            enc.end_encoding();

            cb.commit();
            cb.wait_until_completed();
        }

        fn read_result(&self) -> Option<(u64, [u8; 32])> {
            let flag = unsafe { *(self.result_nonce_buf.contents() as *const u32) };
            if flag == SENTINEL_U32 {
                return None;
            }
            // Nonce stored as two u32 at offsets [4..8] and [8..12]
            let nonce_lo = unsafe { *(self.result_nonce_buf.contents().add(4) as *const u32) } as u64;
            let nonce_hi = unsafe { *(self.result_nonce_buf.contents().add(8) as *const u32) } as u64;
            let nonce = nonce_lo | (nonce_hi << 32);
            let mut hash = [0u8; 32];
            unsafe {
                let ptr = self.result_hash_buf.contents() as *const u8;
                std::ptr::copy_nonoverlapping(ptr, hash.as_mut_ptr(), 32);
            }
            Some((nonce, hash))
        }
    }

    impl GpuMiner for MetalDeekshaMiner {
        fn device_name(&self) -> String {
            self.device_name_cached.clone()
        }

        fn backend_kind(&self) -> GpuBackendKind {
            GpuBackendKind::Metal
        }

        fn update_epoch(&mut self, height: u64) -> Result<()> {
            let epoch = zion_cosmic_harmony::algorithms_npu::epoch_from_height(height);
            if epoch == self.current_epoch {
                return Ok(());
            }
            let topology = zion_cosmic_harmony::algorithms_npu::MlpTopology::for_epoch(epoch);
            let packed = zion_cosmic_harmony::algorithms_npu::chv4_npu_weights_packed(epoch);
            let opts = MTLResourceOptions::StorageModeShared;
            self.npu_weights_buf = self.device.new_buffer_with_data(
                packed.weights.as_ptr() as *const _, packed.weights.len() as u64, opts,
            );
            self.npu_biases_buf = self.device.new_buffer_with_data(
                packed.biases.as_ptr() as *const _, packed.biases.len() as u64, opts,
            );
            self.npu_scales_buf = self.device.new_buffer_with_data(
                packed.scales.as_ptr() as *const _, (packed.scales.len() * 2) as u64, opts,
            );
            self.npu_meta_buf = self.device.new_buffer_with_data(
                packed.meta.as_ptr() as *const _, (packed.meta.len() * 4) as u64, opts,
            );
            println!("gpu_npu_epoch_update epoch={} height={} topology={:?}", epoch, height, topology);
            self.current_epoch = epoch;
            Ok(())
        }

        fn mine_batch(
            &mut self,
            header: MiningHeader,
            target: DifficultyTarget,
            nonce_start: u64,
            batch_size: u64,
        ) -> Result<GpuBatchResult> {
            let header_bytes = header.to_bytes();

            // Write header
            unsafe {
                let ptr = self.header_buf.contents() as *mut u8;
                std::ptr::copy_nonoverlapping(header_bytes.as_ptr(), ptr, header_bytes.len().min(80));
            }

            // Write params: [header_len, nonce_count, target_u32]
            let target_u32 = u32::from_be_bytes([
                target.bytes[0], target.bytes[1], target.bytes[2], target.bytes[3],
            ]);

            let mut all_solutions = Vec::new();
            let mut total_tested = 0u64;
            let mut current_nonce = nonce_start;
            let mut left = batch_size;

            while left > 0 {
                let chunk = (left as usize).min(self.batch_size);

                // Update params for this chunk
                unsafe {
                    let ptr = self.params_buf.contents() as *mut u32;
                    *ptr = 80u32;                // header_len
                    *ptr.add(1) = chunk as u32;  // nonce_count
                    *ptr.add(2) = target_u32;    // target
                }

                self.dispatch_batch(current_nonce, chunk);

                if let Some((nonce, hash)) = self.read_result() {
                    all_solutions.push((nonce, hash));
                    total_tested += (nonce.saturating_sub(current_nonce) + 1).min(chunk as u64);
                    break; // Early termination: submit solution immediately
                }

                total_tested += chunk as u64;
                current_nonce = current_nonce.wrapping_add(chunk as u64);
                left = left.saturating_sub(chunk as u64);
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
            let _target = DifficultyTarget { bytes: [0; 32] };

            // Write header once
            let header_bytes = header.to_bytes();
            unsafe {
                let ptr = self.header_buf.contents() as *mut u8;
                std::ptr::copy_nonoverlapping(header_bytes.as_ptr(), ptr, 80);
            }
            unsafe {
                let ptr = self.params_buf.contents() as *mut u32;
                *ptr = 80u32;
                *ptr.add(1) = self.batch_size as u32;
                *ptr.add(2) = 0u32; // impossible target
            }

            let start = Instant::now();
            let mut total = 0u64;
            let mut nonce = 0u64;

            while start.elapsed().as_secs_f64() < secs {
                self.dispatch_batch(nonce, self.batch_size);
                total += self.batch_size as u64;
                nonce = nonce.wrapping_add(self.batch_size as u64);
            }

            let elapsed = start.elapsed().as_secs_f64();
            let khps = if elapsed > 0.0 { total as f64 / elapsed / 1_000.0 } else { 0.0 };
            Ok((total, elapsed, khps))
        }
    }
}

/// Detect available GPU devices and print a summary.
pub fn detect_gpus() -> Vec<String> {
    #[allow(unused_mut)]
    let mut devices = Vec::new();

    #[cfg(feature = "gpu-opencl")]
    {
        let platforms = ocl::Platform::list();
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

    // CUDA device detection would go here

    #[cfg(feature = "gpu-metal")]
    {
        if let Some(device) = metal::Device::system_default() {
            devices.push(format!("metal:{}", device.name()));
        }
    }

    devices
}
