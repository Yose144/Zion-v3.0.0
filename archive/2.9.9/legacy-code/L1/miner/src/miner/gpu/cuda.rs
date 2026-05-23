//! CUDA GPU mining implementation
//!
//! High-performance mining on NVIDIA GPUs using CUDA.
//!
//! Implements CHv4 pipeline: Keccak256 → SHA3-512 → GoldenMatrix → MemoryHard → NPU Mixing → CosmicFusion
//! CHV4_NPU_FORK_HEIGHT=0: CHv4 (NPU Mixing) always active from genesis; matches OpenCL + Rust paths.

#[cfg(feature = "cuda")]
use super::GpuPlatform;
use super::{GpuDevice, GpuMiner};
use anyhow::{anyhow, Result};
use std::time::Instant;

#[cfg(feature = "cuda")]
use cudarc::driver::{CudaDevice, CudaSlice, DeviceRepr, LaunchAsync, LaunchConfig};
#[cfg(feature = "cuda")]
use cudarc::nvrtc::compile_ptx;

/// CUDA kernel source for cosmic_harmony v4 mining
#[cfg(feature = "cuda")]
const CUDA_KERNEL: &str = include_str!("kernels/cosmic_harmony_v3.cu");

/// Scratchpad bytes per thread (must match CUDA_SCRATCHPAD_BYTES in kernel)
const CUDA_SCRATCHPAD_BYTES: usize = 256 * 1024;  // 256 KiB — Ekam Deeksha v2 Tier 1
/// Max parallel threads when memory-hard is active
const CUDA_MH_BATCH_DEFAULT: usize = 1024;

#[cfg(feature = "cuda")]
fn cuda_result<T>(
    result: std::result::Result<T, cudarc::driver::DriverError>,
    context: &str,
) -> Result<T> {
    result.map_err(|e| anyhow!("{}: {:?}", context, e))
}

/// CUDA miner implementation — CHv4 full pipeline
pub struct CudaMiner {
    device_id: usize,
    device_info: GpuDevice,
    hashes_computed: u64,
    start_time: Instant,
    /// Max threads for memory-hard (limited by VRAM: ~64 KiB × threads)
    mh_batch_size: usize,
    #[cfg(feature = "cuda")]
    device: Option<std::sync::Arc<CudaDevice>>,
    #[cfg(feature = "cuda")]
    header_buf: Option<CudaSlice<u8>>,
    #[cfg(feature = "cuda")]
    results_buf: Option<CudaSlice<u64>>,
    #[cfg(feature = "cuda")]
    result_count_buf: Option<CudaSlice<u32>>,
    #[cfg(feature = "cuda")]
    result_hash_buf: Option<CudaSlice<u8>>,
    #[cfg(feature = "cuda")]
    scratchpad_buf: Option<CudaSlice<u8>>,
    /// CHv4 NPU weight buffers (derived once from genesis seed, static for lifetime)
    #[cfg(feature = "cuda")]
    npu_w1_buf: Option<CudaSlice<i8>>,
    #[cfg(feature = "cuda")]
    npu_b1_buf: Option<CudaSlice<i8>>,
    #[cfg(feature = "cuda")]
    npu_w2_buf: Option<CudaSlice<i8>>,
    #[cfg(feature = "cuda")]
    npu_b2_buf: Option<CudaSlice<i8>>,
    #[cfg(feature = "cuda")]
    npu_scale1_buf: Option<CudaSlice<i16>>,
    #[cfg(feature = "cuda")]
    npu_scale2_buf: Option<CudaSlice<i16>>,
}

impl CudaMiner {
    pub fn new(device_id: usize) -> Result<Self> {
        #[cfg(feature = "cuda")]
        {
            let devices = detect_cuda_devices()?;
            let device_info = devices
                .get(device_id)
                .cloned()
                .ok_or_else(|| anyhow!("CUDA device {} not found", device_id))?;

            let mh_batch_size = std::env::var("ZION_CUDA_MH_BATCH")
                .ok()
                .and_then(|v| v.trim().parse::<usize>().ok())
                .unwrap_or(CUDA_MH_BATCH_DEFAULT)
                .max(64)
                .min(16384);

            Ok(Self {
                device_id,
                device_info,
                hashes_computed: 0,
                start_time: Instant::now(),
                mh_batch_size,
                device: None,
                header_buf: None,
                results_buf: None,
                result_count_buf: None,
                result_hash_buf: None,
                scratchpad_buf: None,
                npu_w1_buf: None,
                npu_b1_buf: None,
                npu_w2_buf: None,
                npu_b2_buf: None,
                npu_scale1_buf: None,
                npu_scale2_buf: None,
            })
        }

        #[cfg(not(feature = "cuda"))]
        {
            let _ = device_id;
            Err(anyhow!(
                "CUDA support not enabled. Build with --features cuda"
            ))
        }
    }
}

impl GpuMiner for CudaMiner {
    fn init(&mut self) -> Result<()> {
        #[cfg(feature = "cuda")]
        {
            println!("[CUDA] Initializing device {}", self.device_id);

            let device = cuda_result(CudaDevice::new(self.device_id), "CUDA device init failed")?;

            // Compile PTX kernel (CHv4 full pipeline)
            println!("[CUDA] Compiling PTX for Cosmic Harmony v4...");
            let ptx =
                compile_ptx(CUDA_KERNEL).map_err(|e| anyhow!("Failed to compile PTX: {:?}", e))?;
            cuda_result(
                device.load_ptx(ptx, "cosmic_harmony", &["cosmic_harmony_v3_mine"]),
                "CUDA PTX load failed",
            )?;

            // Allocate core buffers
            let header_buf = cuda_result(device.alloc_zeros::<u8>(80), "CUDA header alloc failed")?;
            let results_buf = cuda_result(device.alloc_zeros::<u64>(2), "CUDA results alloc failed")?;
            let result_count_buf = cuda_result(device.alloc_zeros::<u32>(1), "CUDA result-count alloc failed")?;
            let result_hash_buf = cuda_result(device.alloc_zeros::<u8>(32), "CUDA result-hash alloc failed")?;

            // Scratchpad: mh_batch_size × 256 KiB
            let scratchpad_len = self.mh_batch_size * CUDA_SCRATCHPAD_BYTES;
            println!("[CUDA] Allocating scratchpad: {} MiB ({} threads × 256 KiB)",
                scratchpad_len / (1024 * 1024), self.mh_batch_size);
            let scratchpad_buf = cuda_result(
                device.alloc_zeros::<u8>(scratchpad_len),
                "CUDA scratchpad alloc failed",
            )?;

            // CHv4 NPU weights — derived once from genesis seed
            let npu_w = zion_cosmic_harmony_v3::algorithms_npu::chv4_npu_weights_flat();
            let npu_w1_buf = cuda_result(device.htod_copy(npu_w.w1.clone()), "CUDA NPU W1 upload failed")?;
            let npu_b1_buf = cuda_result(device.htod_copy(npu_w.b1.to_vec()), "CUDA NPU B1 upload failed")?;
            let npu_w2_buf = cuda_result(device.htod_copy(npu_w.w2.clone()), "CUDA NPU W2 upload failed")?;
            let npu_b2_buf = cuda_result(device.htod_copy(npu_w.b2.to_vec()), "CUDA NPU B2 upload failed")?;
            let npu_scale1_buf = cuda_result(device.htod_copy(npu_w.scale1.to_vec()), "CUDA NPU scale1 upload failed")?;
            let npu_scale2_buf = cuda_result(device.htod_copy(npu_w.scale2.to_vec()), "CUDA NPU scale2 upload failed")?;
            println!("[CUDA] CHv4 NPU weights uploaded ({} B)",
                npu_w.w1.len() + npu_w.b1.len() + npu_w.w2.len() + npu_w.b2.len()
                + npu_w.scale1.len() * 2 + npu_w.scale2.len() * 2);

            self.device = Some(device);
            self.header_buf = Some(header_buf);
            self.results_buf = Some(results_buf);
            self.result_count_buf = Some(result_count_buf);
            self.result_hash_buf = Some(result_hash_buf);
            self.scratchpad_buf = Some(scratchpad_buf);
            self.npu_w1_buf    = Some(npu_w1_buf);
            self.npu_b1_buf    = Some(npu_b1_buf);
            self.npu_w2_buf    = Some(npu_w2_buf);
            self.npu_b2_buf    = Some(npu_b2_buf);
            self.npu_scale1_buf = Some(npu_scale1_buf);
            self.npu_scale2_buf = Some(npu_scale2_buf);

            println!(
                "[CUDA] Device {} initialized: {} (CHv4 + {}M scratchpad threads)",
                self.device_id, self.device_info.name, self.mh_batch_size
            );
            Ok(())
        }

        #[cfg(not(feature = "cuda"))]
        {
            Err(anyhow!(
                "CUDA support not enabled. Build with --features cuda"
            ))
        }
    }

    fn mine_batch(
        &mut self,
        header: &[u8],
        target: &[u8; 32],
        nonce_start: u64,
        batch_size: u64,
        height: u64,
    ) -> Result<Option<(u64, [u8; 32])>> {
        #[cfg(feature = "cuda")]
        {
            let device = self
                .device
                .as_ref()
                .ok_or_else(|| anyhow!("CUDA device not initialized"))?;
            let header_buf = self
                .header_buf
                .as_mut()
                .ok_or_else(|| anyhow!("CUDA header buffer not initialized"))?;
            let results_buf = self
                .results_buf
                .as_mut()
                .ok_or_else(|| anyhow!("CUDA results buffer not initialized"))?;
            let result_count_buf = self
                .result_count_buf
                .as_mut()
                .ok_or_else(|| anyhow!("CUDA result count buffer not initialized"))?;
            let result_hash_buf = self
                .result_hash_buf
                .as_mut()
                .ok_or_else(|| anyhow!("CUDA result hash buffer not initialized"))?;
            let scratchpad_buf = self
                .scratchpad_buf
                .as_mut()
                .ok_or_else(|| anyhow!("CUDA scratchpad buffer not initialized"))?;
            let npu_w1_buf = self.npu_w1_buf.as_ref()
                .ok_or_else(|| anyhow!("CUDA NPU w1 buffer not initialized"))?;
            let npu_b1_buf = self.npu_b1_buf.as_ref()
                .ok_or_else(|| anyhow!("CUDA NPU b1 buffer not initialized"))?;
            let npu_w2_buf = self.npu_w2_buf.as_ref()
                .ok_or_else(|| anyhow!("CUDA NPU w2 buffer not initialized"))?;
            let npu_b2_buf = self.npu_b2_buf.as_ref()
                .ok_or_else(|| anyhow!("CUDA NPU b2 buffer not initialized"))?;
            let npu_scale1_buf = self.npu_scale1_buf.as_ref()
                .ok_or_else(|| anyhow!("CUDA NPU scale1 buffer not initialized"))?;
            let npu_scale2_buf = self.npu_scale2_buf.as_ref()
                .ok_or_else(|| anyhow!("CUDA NPU scale2 buffer not initialized"))?;

            if batch_size == 0 {
                return Ok(None);
            }

            // CHv4 always active (CHV4_NPU_FORK_HEIGHT=0, CHV3_MEMORY_HARD_FORK_HEIGHT=0)
            let memory_hard: u32 =
                if height >= zion_cosmic_harmony_v3::algorithms_opt::CHV3_MEMORY_HARD_FORK_HEIGHT {
                    1
                } else { 0 };
            let chv4: u32 =
                if height >= zion_cosmic_harmony_v3::algorithms_npu::CHV4_NPU_FORK_HEIGHT {
                    1
                } else { 0 };

            // CHv4.2 flag: Merkabah Dual-Spin — aktivní od genesis (height >= 0)
            // Env var ZION_CHV4_2_FORK_HEIGHT umožňuje dočasný override pro testování CHv4.1
            let chv4_2_fork_height: u64 = std::env::var("ZION_CHV4_2_FORK_HEIGHT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(zion_cosmic_harmony_v3::algorithms_opt::CHV4_2_FORK_HEIGHT);
            let chv4_2: u32 = if height >= chv4_2_fork_height { 1 } else { 0 };

            // target_u32: pool sends 8-hex u32, right-justified in 32-byte array.
            // Read last 4 bytes (BE) to recover the original u32 value.
            let target_u32: u32 = u32::from_be_bytes([target[28], target[29], target[30], target[31]]);

            if header.len() > 80 {
                return Err(anyhow!("Header len {} > 80 not supported", header.len()));
            }

            // Upload header (pad to 80 bytes)
            let mut header80 = [0u8; 80];
            header80[..header.len()].copy_from_slice(header);
            cuda_result(device.htod_copy_into(header80.to_vec(), header_buf), "CUDA header upload failed")?;

            // Reset result buffers
            cuda_result(device.htod_copy_into(vec![0u64, 0u64], results_buf), "CUDA results reset failed")?;
            cuda_result(device.htod_copy_into(vec![0u32], result_count_buf), "CUDA result-count reset failed")?;
            cuda_result(device.htod_copy_into(vec![0u8; 32], result_hash_buf), "CUDA result-hash reset failed")?;

            // Limit batch to scratchpad capacity
            let effective_batch = if memory_hard == 1 {
                (batch_size as usize).min(self.mh_batch_size)
            } else {
                batch_size as usize
            };

            let threads_per_block = 256u32;
            let num_blocks = ((effective_batch as u32) + threads_per_block - 1) / threads_per_block;
            let num_blocks = num_blocks.min(65535);

            let func = device
                .get_func("cosmic_harmony", "cosmic_harmony_v3_mine")
                .ok_or_else(|| anyhow!("CUDA kernel not found"))?;

            let config = LaunchConfig {
                block_dim: (threads_per_block, 1, 1),
                grid_dim: (num_blocks, 1, 1),
                shared_mem_bytes: 0,
            };

            let header_len_u32 = header.len() as u32;
            let nonce_start_u64 = nonce_start;
            let target_u32_kernel = target_u32;
            let memory_hard_u32 = memory_hard;
            let chv4_u32 = chv4;
            let chv4_2_u32 = chv4_2;
            let mut kernel_params = vec![
                header_buf.as_kernel_param(),
                header_len_u32.as_kernel_param(),
                nonce_start_u64.as_kernel_param(),
                target_u32_kernel.as_kernel_param(),
                results_buf.as_kernel_param(),
                result_count_buf.as_kernel_param(),
                result_hash_buf.as_kernel_param(),
                memory_hard_u32.as_kernel_param(),
                scratchpad_buf.as_kernel_param(),
                chv4_u32.as_kernel_param(),
                npu_w1_buf.as_kernel_param(),
                npu_b1_buf.as_kernel_param(),
                npu_w2_buf.as_kernel_param(),
                npu_b2_buf.as_kernel_param(),
                npu_scale1_buf.as_kernel_param(),
                npu_scale2_buf.as_kernel_param(),
                chv4_2_u32.as_kernel_param(),
            ];

            unsafe {
                cuda_result(func.launch(config, &mut kernel_params), "CUDA kernel launch failed")?;
            }

            cuda_result(device.synchronize(), "CUDA synchronize failed")?;

            let count_vec = cuda_result(device.dtoh_sync_copy(result_count_buf), "CUDA result-count download failed")?;
            if count_vec[0] > 0 {
                let res_vec = cuda_result(device.dtoh_sync_copy(results_buf), "CUDA results download failed")?;
                let hash_vec = cuda_result(device.dtoh_sync_copy(result_hash_buf), "CUDA result-hash download failed")?;
                let nonce = res_vec[1];
                let mut hash = [0u8; 32];
                hash.copy_from_slice(&hash_vec[..32]);
                return Ok(Some((nonce, hash)));
            }

            self.hashes_computed += effective_batch as u64;
            Ok(None)
        }

        #[cfg(not(feature = "cuda"))]
        {
            let _ = (header, target, nonce_start, batch_size, height);
            Err(anyhow!("CUDA support not compiled. Rebuild with --features cuda"))
        }
    }

    fn device_info(&self) -> &GpuDevice {
        &self.device_info
    }

    fn hashrate(&self) -> f64 {
        let elapsed = self.start_time.elapsed().as_secs_f64();
        if elapsed > 0.0 {
            self.hashes_computed as f64 / elapsed
        } else {
            0.0
        }
    }

    fn effective_batch_size(&self, requested_batch_size: u64, height: u64) -> u64 {
        let memory_hard_active =
            height >= zion_cosmic_harmony_v3::algorithms_opt::CHV3_MEMORY_HARD_FORK_HEIGHT;
        if memory_hard_active {
            requested_batch_size.min(self.mh_batch_size as u64)
        } else {
            requested_batch_size
        }
    }
}

/// Detect CUDA devices
pub fn detect_cuda_devices() -> Result<Vec<GpuDevice>> {
    #[cfg(feature = "cuda")]
    {
        let count = CudaDevice::count()
            .map_err(|e| anyhow!("Failed to get CUDA device count: {:?}", e))?;

        let mut devices = Vec::new();
        for i in 0..count {
            let ordinal = i as usize;
            if let Ok(device) = CudaDevice::new(ordinal) {
                let name = device
                    .name()
                    .unwrap_or_else(|_| format!("CUDA Device {}", ordinal));
                let memory_mb = 0;

                devices.push(GpuDevice {
                    id: ordinal,
                    name,
                    platform: GpuPlatform::Cuda,
                    compute_units: 0,
                    memory_mb,
                });
            }
        }

        Ok(devices)
    }

    #[cfg(not(feature = "cuda"))]
    {
        Ok(vec![])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cuda_detection() {
        if let Ok(devices) = detect_cuda_devices() {
            println!("CUDA devices found: {}", devices.len());
            for dev in &devices {
                println!("  {} - {} ({} MB)", dev.id, dev.name, dev.memory_mb);
            }
        }
    }
}
