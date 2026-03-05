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
use cudarc::driver::{CudaDevice, CudaSlice, LaunchAsync, LaunchConfig};
#[cfg(feature = "cuda")]
use cudarc::nvrtc::compile_ptx;

/// CUDA kernel source for cosmic_harmony v4 mining
#[cfg(feature = "cuda")]
const CUDA_KERNEL: &str = include_str!("kernels/cosmic_harmony_v3.cu");

/// Scratchpad bytes per thread (must match CUDA_SCRATCHPAD_BYTES in kernel)
const CUDA_SCRATCHPAD_BYTES: usize = 64 * 1024;  // 64 KiB
/// Max parallel threads when memory-hard is active
const CUDA_MH_BATCH_DEFAULT: usize = 512;

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
                .max(32)
                .min(8192);

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

            let device = CudaDevice::new(self.device_id)?;

            // Compile PTX kernel (CHv4 full pipeline)
            println!("[CUDA] Compiling PTX for Cosmic Harmony v4...");
            let ptx =
                compile_ptx(CUDA_KERNEL).map_err(|e| anyhow!("Failed to compile PTX: {:?}", e))?;
            device.load_ptx(ptx, "cosmic_harmony", &["cosmic_harmony_v3_mine"])?;

            // Allocate core buffers
            let header_buf = device.alloc_zeros::<u8>(80)?;
            let results_buf = device.alloc_zeros::<u64>(2)?;
            let result_count_buf = device.alloc_zeros::<u32>(1)?;
            let result_hash_buf = device.alloc_zeros::<u8>(32)?;

            // Scratchpad: mh_batch_size × 64 KiB
            let scratchpad_len = self.mh_batch_size * CUDA_SCRATCHPAD_BYTES;
            println!("[CUDA] Allocating scratchpad: {} MiB ({} threads × 64 KiB)",
                scratchpad_len / (1024 * 1024), self.mh_batch_size);
            let scratchpad_buf = device.alloc_zeros::<u8>(scratchpad_len)?;

            // CHv4 NPU weights — derived once from genesis seed
            let npu_w = zion_cosmic_harmony_v3::algorithms_npu::chv4_npu_weights_flat();
            let npu_w1_buf = device.htod_copy(npu_w.w1.clone())?;
            let npu_b1_buf = device.htod_copy(npu_w.b1.to_vec())?;
            let npu_w2_buf = device.htod_copy(npu_w.w2.clone())?;
            let npu_b2_buf = device.htod_copy(npu_w.b2.to_vec())?;
            let npu_scale1_buf = device.htod_copy(npu_w.scale1.to_vec())?;
            let npu_scale2_buf = device.htod_copy(npu_w.scale2.to_vec())?;
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

            // target_u32: LE bytes 0-3 of the 32-byte target (matches OpenCL kernel)
            let target_u32: u32 = u32::from_le_bytes([target[0], target[1], target[2], target[3]]);

            if header.len() > 80 {
                return Err(anyhow!("Header len {} > 80 not supported", header.len()));
            }

            // Upload header (pad to 80 bytes)
            let mut header80 = [0u8; 80];
            header80[..header.len()].copy_from_slice(header);
            device.htod_copy_into(header80.to_vec(), header_buf)?;

            // Reset result buffers
            device.htod_copy_into(vec![0u64, 0u64], results_buf)?;
            device.htod_copy_into(vec![0u32], result_count_buf)?;
            device.htod_copy_into(vec![0u8; 32], result_hash_buf)?;

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

            unsafe {
                func.launch(
                    config,
                    (
                        header_buf,
                        header.len() as u32,
                        nonce_start,
                        target_u32,
                        results_buf,
                        result_count_buf,
                        result_hash_buf,
                        memory_hard,
                        scratchpad_buf,
                        chv4,
                        npu_w1_buf,
                        npu_b1_buf,
                        npu_w2_buf,
                        npu_b2_buf,
                        npu_scale1_buf,
                        npu_scale2_buf,
                    ),
                )?;
            }

            device.synchronize()?;

            let count_vec = device.dtoh_sync_copy(result_count_buf)?;
            if count_vec[0] > 0 {
                let res_vec = device.dtoh_sync_copy(results_buf)?;
                let hash_vec = device.dtoh_sync_copy(result_hash_buf)?;
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
}

/// Detect CUDA devices
pub fn detect_cuda_devices() -> Result<Vec<GpuDevice>> {
    #[cfg(feature = "cuda")]
    {
        let count = cudarc::driver::result::device::get_count()
            .map_err(|e| anyhow!("Failed to get CUDA device count: {:?}", e))?;

        let mut devices = Vec::new();
        for i in 0..count {
            if let Ok(device) = CudaDevice::new(i) {
                let name = device
                    .name()
                    .unwrap_or_else(|_| format!("CUDA Device {}", i));

                let memory_mb = device
                    .total_memory()
                    .map(|m| (m / (1024 * 1024)) as u64)
                    .unwrap_or(0);

                devices.push(GpuDevice {
                    id: i,
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
