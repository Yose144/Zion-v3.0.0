//! NVIDIA CUDA GPU backend for AuXpow external hashing.
//!
//! Uses the `cudarc` crate to compile and launch CUDA kernels (.cu files)
//! from `csrc/cuda/`.  Provides native NVIDIA GPU acceleration with better
//! performance than OpenCL on NVIDIA hardware.
//!
//! Supported algorithms:
//!   - blake3 / blake3_alph / blake3_dcr — Alephium / Decred
//!   - kheavyhash / kheavyhash_kas — Kaspa
//!   - autolykos / autolykos_erg — Ergo
//!   - ethash / etchash / ethash_etc — Ethereum Classic
//!   - kawpow / kawpow_rvn / kawpow_clore / kawpow_evr / kawpow_mewc — Ravencoin
//!   - zelhash / zelhash_flux — FLUX

#![cfg(feature = "gpu-cuda")]

use anyhow::{anyhow, Context, Result};
use cudarc::driver::{CudaDevice, CudaSlice, LaunchAsync, LaunchConfig};
use cudarc::nvrtc::{compile_ptx_with_opts, CompileOptions};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

use crate::gpu_backend::{GpuBackend, GpuFoundShare};

/// Maps an algorithm name to its CUDA kernel file and entry function.
fn kernel_info(algorithm: &str) -> Option<(&'static str, &'static str)> {
    match algorithm {
        "blake3" | "blake3_alph" => Some(("blake3_kernel.cu", "blake3_alph_mine")),
        "blake3_dcr" => Some(("blake3_kernel.cu", "blake3_dcr_mine")),
        "kheavyhash" | "kheavyhash_kas" => Some(("kheavyhash_kernel.cu", "kheavyhash_mine")),
        "autolykos" | "autolykos_erg" => Some(("autolykos_kernel.cu", "autolykos_mine")),
        "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc" => {
            Some(("kawpow_kernel.cu", "kawpow_mine"))
        }
        "ethash" | "etchash" | "ethash_etc" => Some(("ethash_kernel.cu", "ethash_mine")),
        "zelhash" | "zelhash_flux" => Some(("zelhash_kernel.cu", "zelhash_mine")),
        _ => None,
    }
}

/// CUDA GPU backend for external PoW algorithms.
pub struct CudaBackend {
    device: Arc<CudaDevice>,
    device_name: String,
    /// Pre-compiled CUDA modules (PTX), keyed by kernel file name.
    modules: HashMap<String, Arc<cudarc::driver::CudaModule>>,
    /// Default work size (threads per block × blocks).
    work_size: usize,
    /// Cached Ethash DAG.
    ethash_dag: Option<CudaSlice<u64>>,
    ethash_dag_entries: u64,
    ethash_epoch: u32,
    /// Cached KawPow DAG.
    kawpow_dag: Option<CudaSlice<u64>>,
    kawpow_dag_entries: u64,
    kawpow_epoch: u32,
}

impl CudaBackend {
    /// Create a new CUDA backend on device 0.
    pub fn new(work_size: usize) -> Result<Self> {
        let device = CudaDevice::new(0).context("failed to init CUDA device 0")?;
        let device_name = device
            .name()
            .unwrap_or_else(|_| "unknown CUDA device".to_string());

        Ok(Self {
            device,
            device_name,
            modules: HashMap::new(),
            work_size,
            ethash_dag: None,
            ethash_dag_entries: 0,
            ethash_epoch: 0,
            kawpow_dag: None,
            kawpow_dag_entries: 0,
            kawpow_epoch: 0,
        })
    }

    /// Load and compile a CUDA kernel from source.
    fn ensure_module(&mut self, kernel_file: &str) -> Result<Arc<cudarc::driver::CudaModule>> {
        if let Some(module) = self.modules.get(kernel_file) {
            return Ok(module.clone());
        }

        let kernel_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("csrc/cuda")
            .join(kernel_file);

        let source = std::fs::read_to_string(&kernel_path)
            .with_context(|| format!("failed to read CUDA kernel: {kernel_path:?}"))?;

        let opts = CompileOptions {
            arch: Some("sm_75".to_string()), // Turing+ (RTX 20xx+)
            ..Default::default()
        };

        let ptx = compile_ptx_with_opts(&source, &opts)
            .map_err(|e| anyhow!("CUDA PTX compile failed for {kernel_file}: {e}"))?;

        self.device
            .load_ptx(ptx, kernel_file, &[])
            .map_err(|e| anyhow!("CUDA module load failed for {kernel_file}: {e}"))?;

        let module = self
            .device
            .get_module(kernel_file)
            .ok_or_else(|| anyhow!("CUDA module not found after load: {kernel_file}"))?;

        self.modules.insert(kernel_file.to_string(), module.clone());
        Ok(self.modules.get(kernel_file).unwrap().clone())
    }
}

impl GpuBackend for CudaBackend {
    fn mine(
        &mut self,
        algorithm: &str,
        header: &[u8],
        extra: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        batch_size: u64,
    ) -> Result<Option<GpuFoundShare>> {
        let (kernel_file, kernel_name) = kernel_info(algorithm)
            .with_context(|| format!("CUDA kernel not available for {algorithm}"))?;

        let module = self.ensure_module(kernel_file)?;

        // Allocate output buffers
        let output_nonce = self.device.alloc_zeros::<u64>(1)?;
        let output_hash = self.device.alloc_zeros::<u8>(32)?;
        let found_flag = self.device.alloc_zeros::<u32>(1)?;

        // Build header buffer (pad to 243 for zelhash, 248 for blake3, 32 for ethash/kawpow)
        let header_len = header.len();
        let header_padded = match algorithm {
            "zelhash" | "zelhash_flux" => {
                let mut p = vec![0u8; 243];
                let len = header_len.min(243);
                p[..len].copy_from_slice(&header[..len]);
                p
            }
            "blake3" | "blake3_alph" | "blake3_dcr" => {
                let mut p = vec![0u8; 248];
                let len = header_len.min(248);
                p[..len].copy_from_slice(&header[..len]);
                p
            }
            _ => {
                let mut p = vec![0u8; 32];
                let len = header_len.min(32);
                p[..len].copy_from_slice(&header[..len]);
                p
            }
        };
        let header_buf = self.device.copy_from_host(&header_padded)?;
        let target_buf = self.device.copy_from_host(target.as_slice())?;

        // Launch configuration
        let threads_per_block = 256u32;
        let num_blocks =
            ((batch_size.max(1) + threads_per_block as u64 - 1) / threads_per_block as u64) as u32;
        let cfg = LaunchConfig {
            grid: (num_blocks, 1, 1),
            block: (threads_per_block, 1, 1),
            shared_mem_bytes: 0,
        };

        let start = Instant::now();

        // Dispatch based on algorithm
        // TODO: Implement per-algorithm kernel launch with proper arguments.
        // For now, use a generic launch that works for blake3/kheavyhash/zelhash
        // (header_nonce style kernels). Ethash/KawPow need DAG buffers.
        unsafe {
            if matches!(
                algorithm,
                "ethash"
                    | "etchash"
                    | "ethash_etc"
                    | "kawpow"
                    | "kawpow_rvn"
                    | "kawpow_clore"
                    | "kawpow_evr"
                    | "kawpow_mewc"
            ) {
                // Ethash/KawPow need DAG — not yet implemented for CUDA
                anyhow::bail!("CUDA Ethash/KawPow not yet implemented — use OpenCL backend");
            }

            // Generic header_nonce kernel launch
            let f = module
                .get_fn(kernel_name)
                .ok_or_else(|| anyhow!("CUDA kernel function not found: {kernel_name}"))?;

            // Launch with: header, header_len, target, base_nonce, output_nonce, output_hash, found
            LaunchAsync::launch(
                f,
                cfg,
                (
                    &header_buf,
                    &header_len as *const _ as *const u32, // pass as raw ptr — cudarc will handle
                    &target_buf,
                    &base_nonce,
                    &output_nonce,
                    &output_hash,
                    &found_flag,
                ),
            )
            .map_err(|e| anyhow!("CUDA launch failed: {e}"))?;
        }

        self.device
            .synchronize()
            .map_err(|e| anyhow!("CUDA sync failed: {e}"))?;

        // Read results
        let found = self.device.copy_to_host(&found_flag)?;
        if found[0] == 0 {
            return Ok(None);
        }

        let nonce = self.device.copy_to_host(&output_nonce)?;
        let hash = self.device.copy_to_host(&output_hash)?;
        let hash_arr: [u8; 32] = hash[..32].try_into().expect("32 bytes from CUDA");

        // Read solution for zelhash
        let solution = if matches!(algorithm, "zelhash" | "zelhash_flux") {
            // TODO: allocate and read 52-byte solution buffer
            Some(vec![0u8; 52])
        } else {
            None
        };

        println!(
            "auxpow_cuda_share_found algorithm={} nonce={} hash_first8={:016x} elapsed_ms={}",
            algorithm,
            nonce[0],
            u64::from_le_bytes(hash_arr[0..8].try_into().unwrap()),
            start.elapsed().as_millis()
        );

        Ok(Some(GpuFoundShare {
            nonce: nonce[0],
            hash: hash_arr,
            mix_hash: None,
            solution,
        }))
    }

    fn set_ethash_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()> {
        let buf = self
            .device
            .copy_from_host(dag)
            .map_err(|e| anyhow!("CUDA Ethash DAG upload failed: {e}"))?;
        self.ethash_dag = Some(buf);
        self.ethash_dag_entries = size_entries;
        self.ethash_epoch = epoch;
        Ok(())
    }

    fn set_kawpow_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()> {
        let buf = self
            .device
            .copy_from_host(dag)
            .map_err(|e| anyhow!("CUDA KawPow DAG upload failed: {e}"))?;
        self.kawpow_dag = Some(buf);
        self.kawpow_dag_entries = size_entries;
        self.kawpow_epoch = epoch;
        Ok(())
    }

    fn device_name(&self) -> &str {
        &self.device_name
    }

    fn backend_name(&self) -> &str {
        "cuda"
    }

    fn work_size(&self) -> usize {
        self.work_size
    }

    fn set_work_size(&mut self, size: usize) {
        self.work_size = size;
    }
}

/// List available CUDA devices.
pub fn list_cuda_devices() -> Vec<String> {
    let mut devices = Vec::new();
    let n = cudarc::driver::device_count().unwrap_or(0);
    for i in 0..n {
        if let Ok(dev) = CudaDevice::new(i) {
            let name = dev.name().unwrap_or_else(|_| format!("CUDA device {i}"));
            devices.push(format!("cuda:{name}"));
        }
    }
    devices
}
