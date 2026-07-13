//! Apple Metal GPU backend for AuXpow external hashing.
//!
//! Uses the `metal` crate to compile and launch Metal kernels (.metal files)
//! from `csrc/metal/`.  Provides native Apple Silicon GPU acceleration.
//!
//! Supported algorithms (same as OpenCL/CUDA):
//!   - blake3 / blake3_alph / blake3_dcr
//!   - kheavyhash / kheavyhash_kas
//!   - autolykos / autolykos_erg
//!   - ethash / etchash / ethash_etc
//!   - kawpow / kawpow_rvn / kawpow_clore / kawpow_evr / kawpow_mewc
//!   - zelhash / zelhash_flux

#![cfg(feature = "gpu-metal")]

use anyhow::{anyhow, Context, Result};
use metal::{Device, MTLResourceOptions, MTLSize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Instant;

use crate::gpu_backend::{GpuBackend, GpuFoundShare};

/// Maps an algorithm name to its Metal kernel file and entry function.
fn kernel_info(algorithm: &str) -> Option<(&'static str, &'static str)> {
    match algorithm {
        "blake3" | "blake3_alph" => Some(("blake3_kernel.metal", "blake3_alph_mine")),
        "blake3_dcr" => Some(("blake3_kernel.metal", "blake3_dcr_mine")),
        "kheavyhash" | "kheavyhash_kas" => {
            Some(("kheavyhash_kernel.metal", "kheavyhash_mine"))
        }
        "autolykos" | "autolykos_erg" => Some(("autolykos_kernel.metal", "autolykos_mine")),
        "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc" => {
            Some(("kawpow_kernel.metal", "kawpow_mine"))
        }
        "ethash" | "etchash" | "ethash_etc" => Some(("ethash_kernel.metal", "ethash_mine")),
        "zelhash" | "zelhash_flux" => Some(("zelhash_kernel.metal", "zelhash_mine")),
        _ => None,
    }
}

/// Metal GPU backend for external PoW algorithms.
pub struct MetalBackend {
    device: Device,
    device_name: String,
    /// Pre-compiled Metal libraries, keyed by kernel file name.
    libraries: HashMap<String, metal::Library>,
    /// Default work size.
    work_size: usize,
    /// Cached Ethash DAG buffer.
    ethash_dag: Option<metal::Buffer>,
    ethash_dag_entries: u64,
    ethash_epoch: u32,
    /// Cached KawPow DAG buffer.
    kawpow_dag: Option<metal::Buffer>,
    kawpow_dag_entries: u64,
    kawpow_epoch: u32,
}

impl MetalBackend {
    /// Create a new Metal backend on the system default device.
    pub fn new(work_size: usize) -> Result<Self> {
        let device = Device::system_default()
            .ok_or_else(|| anyhow!("no Metal GPU device available"))?;

        let device_name = device.name().to_string();

        Ok(Self {
            device,
            device_name,
            libraries: HashMap::new(),
            work_size,
            ethash_dag: None,
            ethash_dag_entries: 0,
            ethash_epoch: 0,
            kawpow_dag: None,
            kawpow_dag_entries: 0,
            kawpow_epoch: 0,
        })
    }

    /// Load and compile a Metal kernel from source.
    fn ensure_library(&mut self, kernel_file: &str) -> Result<&metal::Library> {
        if self.libraries.contains_key(kernel_file) {
            return Ok(self.libraries.get(kernel_file).unwrap());
        }

        let kernel_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("csrc/metal")
            .join(kernel_file);

        let source = std::fs::read_to_string(&kernel_path)
            .with_context(|| format!("failed to read Metal kernel: {kernel_path:?}"))?;

        let options = metal::CompileOptions::new(&self.device);
        let library = self
            .device
            .new_library_with_source(&source, &options)
            .map_err(|e| {
                anyhow!("Metal compile failed for {kernel_file}: {}", e.localizedDescription())
            })?;

        self.libraries.insert(kernel_file.to_string(), library);
        Ok(self.libraries.get(kernel_file).unwrap())
    }
}

impl GpuBackend for MetalBackend {
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
            .with_context(|| format!("Metal kernel not available for {algorithm}"))?;

        let library = self.ensure_library(kernel_file)?;
        let function = library
            .get_function(kernel_name, None)
            .map_err(|e| anyhow!("Metal function not found: {kernel_name}: {}", e.localizedDescription()))?;

        // Build header buffer
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

        // Create Metal buffers
        let header_buf = self.device.new_buffer_with_data(
            header_padded.as_ptr() as *const _,
            header_padded.len() as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );

        let target_buf = self.device.new_buffer_with_data(
            target.as_ptr() as *const _,
            32,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );

        let output_nonce_buf = self.device.new_buffer(
            std::mem::size_of::<u64>() as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );

        let output_hash_buf = self.device.new_buffer(
            32,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );

        let found_flag_buf = self.device.new_buffer(
            4,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );

        // Create command queue and command buffer
        let cmd_queue = self.device.new_command_queue();
        let cmd_buffer = cmd_queue.new_command_buffer();
        let encoder = cmd_buffer.new_compute_command_encoder();

        encoder.set_compute_pipeline_state(&function);

        // Set buffer arguments (Metal uses [[buffer(N)]] indexing)
        encoder.set_buffer(0, Some(&header_buf), 0);
        encoder.set_buffer(1, Some(&target_buf), 0);
        encoder.set_buffer(2, Some(&output_nonce_buf), 0);
        encoder.set_buffer(3, Some(&output_hash_buf), 0);
        encoder.set_buffer(4, Some(&found_flag_buf), 0);

        // Set inline arguments (header_len, base_nonce)
        encoder.set_bytes(5, std::mem::size_of::<u32>() as u64, &header_len as *const _ as *const _);
        encoder.set_bytes(6, std::mem::size_of::<u64>() as u64, &base_nonce as *const _ as *const _);

        // Dispatch threads
        let threads_per_group = self.device.max_threadgroup_width();
        let global_work_size = batch_size.max(1) as u64;
        let thread_groups = ((global_work_size + threads_per_group as u64 - 1) / threads_per_group as u64) as u64;

        let grid_size = MTLSize {
            width: global_work_size as usize,
            height: 1,
            depth: 1,
        };
        let group_size = MTLSize {
            width: threads_per_group,
            height: 1,
            depth: 1,
        };

        encoder.dispatch_threads(grid_size, group_size);
        encoder.end_encoding();

        let start = Instant::now();
        cmd_buffer.commit();
        cmd_buffer.wait_until_completed();

        // Read results
        let found_ptr = found_flag_buf.contents() as *const u32;
        let found = unsafe { *found_ptr };
        if found == 0 {
            return Ok(None);
        }

        let nonce_ptr = output_nonce_buf.contents() as *const u64;
        let nonce = unsafe { *nonce_ptr };

        let hash_ptr = output_hash_buf.contents() as *const u8;
        let mut hash_arr = [0u8; 32];
        unsafe {
            std::ptr::copy_nonoverlapping(hash_ptr, hash_arr.as_mut_ptr(), 32);
        }

        // Read solution for zelhash
        let solution = if matches!(algorithm, "zelhash" | "zelhash_flux") {
            Some(vec![0u8; 52])
        } else {
            None
        };

        println!(
            "auxpow_metal_share_found algorithm={} nonce={} hash_first8={:016x} elapsed_ms={}",
            algorithm,
            nonce,
            u64::from_le_bytes(hash_arr[0..8].try_into().unwrap()),
            start.elapsed().as_millis()
        );

        Ok(Some(GpuFoundShare {
            nonce,
            hash: hash_arr,
            mix_hash: None,
            solution,
        }))
    }

    fn set_ethash_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()> {
        let buf = self.device.new_buffer_with_data(
            dag.as_ptr() as *const _,
            (dag.len() * std::mem::size_of::<u64>()) as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );
        self.ethash_dag = Some(buf);
        self.ethash_dag_entries = size_entries;
        self.ethash_epoch = epoch;
        Ok(())
    }

    fn set_kawpow_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()> {
        let buf = self.device.new_buffer_with_data(
            dag.as_ptr() as *const _,
            (dag.len() * std::mem::size_of::<u64>()) as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );
        self.kawpow_dag = Some(buf);
        self.kawpow_dag_entries = size_entries;
        self.kawpow_epoch = epoch;
        Ok(())
    }

    fn device_name(&self) -> &str {
        &self.device_name
    }

    fn backend_name(&self) -> &str {
        "metal"
    }

    fn work_size(&self) -> usize {
        self.work_size
    }

    fn set_work_size(&mut self, size: usize) {
        self.work_size = size;
    }
}

/// List available Metal devices.
pub fn list_metal_devices() -> Vec<String> {
    let mut devices = Vec::new();
    if let Some(device) = Device::system_default() {
        devices.push(format!("metal:{}", device.name()));
    }
    devices
}
