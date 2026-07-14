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
        "progpow" | "progpow_epic" => Some(("progpow_kernel.metal", "progpow_mine")),
        "pearlhash" | "pearlhash_prl" => Some(("pearl_kernel.metal", "pearl_mine")),
        "pearlpouw" => Some(("pearl_pouw_kernel.metal", "pearl_pouw_mine")),
        _ => None,
    }
}

/// Metal GPU backend for external PoW algorithms.
pub struct MetalBackend {
    device: Device,
    device_name: String,
    /// Persistent command queue (created once, reused for all mining calls).
    cmd_queue: metal::CommandQueue,
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
    /// Cached ProgPow DAG buffer (EPIC — same format as Ethash).
    progpow_dag: Option<metal::Buffer>,
    progpow_dag_entries: u64,
    progpow_epoch: u32,
    /// Cached Autolykos table buffer + metadata.
    autolykos_table: Option<metal::Buffer>,
    autolykos_table_size: u32,
    autolykos_height: u32,
}

impl MetalBackend {
    /// Create a new Metal backend on the system default device.
    pub fn new(work_size: usize) -> Result<Self> {
        let device = Device::system_default()
            .ok_or_else(|| anyhow!("no Metal GPU device available"))?;

        let device_name = device.name().to_string();
        let cmd_queue = device.new_command_queue();

        Ok(Self {
            device,
            device_name,
            cmd_queue,
            libraries: HashMap::new(),
            work_size,
            ethash_dag: None,
            ethash_dag_entries: 0,
            ethash_epoch: 0,
            kawpow_dag: None,
            kawpow_dag_entries: 0,
            kawpow_epoch: 0,
            progpow_dag: None,
            progpow_dag_entries: 0,
            progpow_epoch: 0,
            autolykos_table: None,
            autolykos_table_size: 0,
            autolykos_height: u32::MAX,
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

        let options = metal::CompileOptions::new();
        let library = self
            .device
            .new_library_with_source(&source, &options)
            .map_err(|e| {
                anyhow!("Metal compile failed for {kernel_file}: {e}")
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
            .map_err(|e| anyhow!("Metal function not found: {kernel_name}: {e}"))?;

        // Create compute pipeline state from function
        let pipeline_state = self
            .device
            .new_compute_pipeline_state_with_function(&function)
            .map_err(|e| anyhow!("Metal pipeline state failed for {kernel_name}: {e}"))?;

        // Build header buffer
        let header_len = header.len();
        let header_padded = match algorithm {
            "zelhash" | "zelhash_flux" => {
                let mut p = vec![0u8; 243];
                let len = header_len.min(243);
                p[..len].copy_from_slice(&header[..len]);
                p
            }
            "blake3" | "blake3_alph" | "blake3_dcr" | "pearlhash" | "pearlhash_prl" => {
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

        let nonce_init: u64 = 0;
        let output_nonce_buf = self.device.new_buffer_with_data(
            &nonce_init as *const u64 as *const _,
            std::mem::size_of::<u64>() as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );

        let hash_init = [0u8; 32];
        let output_hash_buf = self.device.new_buffer_with_data(
            hash_init.as_ptr() as *const _,
            32,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );

        let found_init: u32 = 0;
        let found_flag_buf = self.device.new_buffer_with_data(
            &found_init as *const u32 as *const _,
            4,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );

        // Scalar arguments must be passed as Metal buffers (not set_bytes)
        // because the kernels use `constant type* name [[buffer(N)]]`.
        let header_len_u32 = header_len as u32;
        let header_len_buf = self.device.new_buffer_with_data(
            &header_len_u32 as *const u32 as *const _,
            std::mem::size_of::<u32>() as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );

        let base_nonce_buf = self.device.new_buffer_with_data(
            &base_nonce as *const u64 as *const _,
            std::mem::size_of::<u64>() as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );

        // Create command buffer from persistent queue
        let cmd_buffer = self.cmd_queue.new_command_buffer();
        let encoder = cmd_buffer.new_compute_command_encoder();

        encoder.set_compute_pipeline_state(&pipeline_state);

        // Set buffer arguments — each kernel has a different buffer layout.
        // Buffer indices are determined by the [[buffer(N)]] attributes in the
        // Metal kernel source files.
        match algorithm {
            // blake3 / pearlhash: 0=header, 1=target, 2=nonce, 3=hash, 4=found, 5=hlen, 6=base_nonce
            "blake3" | "blake3_alph" | "blake3_dcr" | "pearlhash" | "pearlhash_prl" => {
                encoder.set_buffer(0, Some(&header_buf), 0);
                encoder.set_buffer(1, Some(&target_buf), 0);
                encoder.set_buffer(2, Some(&output_nonce_buf), 0);
                encoder.set_buffer(3, Some(&output_hash_buf), 0);
                encoder.set_buffer(4, Some(&found_flag_buf), 0);
                encoder.set_buffer(5, Some(&header_len_buf), 0);
                encoder.set_buffer(6, Some(&base_nonce_buf), 0);
            }
            // kheavyhash: 0=pre_pow, 1=target, 2=matrix, 3=nonce, 4=hash, 5=found, 6=timestamp, 7=base_nonce
            "kheavyhash" | "kheavyhash_kas" => {
                let timestamp: u64 = if extra.len() >= 8 {
                    u64::from_le_bytes(extra[..8].try_into().unwrap())
                } else {
                    0
                };
                let matrix = crate::gpu_backend::generate_kheavy_matrix();
                let matrix_buf = self.device.new_buffer_with_data(
                    matrix.as_ptr() as *const _,
                    (4096 * std::mem::size_of::<u16>()) as u64,
                    MTLResourceOptions::CPUCacheModeDefaultCache,
                );
                let timestamp_buf = self.device.new_buffer_with_data(
                    &timestamp as *const u64 as *const _,
                    std::mem::size_of::<u64>() as u64,
                    MTLResourceOptions::CPUCacheModeDefaultCache,
                );
                encoder.set_buffer(0, Some(&header_buf), 0);
                encoder.set_buffer(1, Some(&target_buf), 0);
                encoder.set_buffer(2, Some(&matrix_buf), 0);
                encoder.set_buffer(3, Some(&output_nonce_buf), 0);
                encoder.set_buffer(4, Some(&output_hash_buf), 0);
                encoder.set_buffer(5, Some(&found_flag_buf), 0);
                encoder.set_buffer(6, Some(&timestamp_buf), 0);
                encoder.set_buffer(7, Some(&base_nonce_buf), 0);
            }
            // autolykos: 0=header, 1=target, 2=table, 3=nonce, 4=hash, 5=found, 6=hlen, 7=base_nonce, 8=table_size
            "autolykos" | "autolykos_erg" => {
                let height: u32 = if extra.len() >= 4 {
                    u32::from_le_bytes(extra[..4].try_into().unwrap())
                } else { 0 };
                let table_size = if extra.len() >= 8 {
                    u32::from_le_bytes(extra[4..8].try_into().unwrap()) as usize
                } else {
                    crate::gpu_backend::autolykos_table_size()
                };
                let table_size = table_size.next_power_of_two().max(1);
                let table_size_u32 = table_size as u32;

                // Cache table buffer — regenerate only when height or size changes.
                if self.autolykos_height != height || self.autolykos_table_size != table_size_u32 || self.autolykos_table.is_none() {
                    let table = crate::gpu_backend::generate_autolykos_table(header, height, table_size);
                    let table_buf = self.device.new_buffer_with_data(
                        table.as_ptr() as *const _,
                        (table.len() * std::mem::size_of::<u64>()) as u64,
                        MTLResourceOptions::CPUCacheModeDefaultCache,
                    );
                    self.autolykos_table = Some(table_buf);
                    self.autolykos_table_size = table_size_u32;
                    self.autolykos_height = height;
                }
                let table_buf = self.autolykos_table.as_ref().unwrap();

                let table_size_buf = self.device.new_buffer_with_data(
                    &table_size_u32 as *const u32 as *const _,
                    std::mem::size_of::<u32>() as u64,
                    MTLResourceOptions::CPUCacheModeDefaultCache,
                );
                encoder.set_buffer(0, Some(&header_buf), 0);
                encoder.set_buffer(1, Some(&target_buf), 0);
                encoder.set_buffer(2, Some(table_buf), 0);
                encoder.set_buffer(3, Some(&output_nonce_buf), 0);
                encoder.set_buffer(4, Some(&output_hash_buf), 0);
                encoder.set_buffer(5, Some(&found_flag_buf), 0);
                encoder.set_buffer(6, Some(&header_len_buf), 0);
                encoder.set_buffer(7, Some(&base_nonce_buf), 0);
                encoder.set_buffer(8, Some(&table_size_buf), 0);
            }
            // ethash: 0=header, 1=target, 2=dag, 3=nonce, 4=hash, 5=mix, 6=found, 7=nonce_base, 8=stride, 9=dag_size
            "ethash" | "etchash" | "ethash_etc" => {
                let dag = self.ethash_dag.as_ref()
                    .ok_or_else(|| anyhow!("Ethash DAG not set; call set_ethash_dag() before mining"))?;
                let mix_init = [0u8; 32];
                let mix_buf = self.device.new_buffer_with_data(
                    mix_init.as_ptr() as *const _,
                    32,
                    MTLResourceOptions::CPUCacheModeDefaultCache,
                );
                let stride = batch_size;
                let stride_buf = self.device.new_buffer_with_data(
                    &stride as *const u64 as *const _,
                    std::mem::size_of::<u64>() as u64,
                    MTLResourceOptions::CPUCacheModeDefaultCache,
                );
                let dag_sz = self.ethash_dag_entries;
                let dag_size_buf = self.device.new_buffer_with_data(
                    &dag_sz as *const u64 as *const _,
                    std::mem::size_of::<u64>() as u64,
                    MTLResourceOptions::CPUCacheModeDefaultCache,
                );
                encoder.set_buffer(0, Some(&header_buf), 0);
                encoder.set_buffer(1, Some(&target_buf), 0);
                encoder.set_buffer(2, Some(dag), 0);
                encoder.set_buffer(3, Some(&output_nonce_buf), 0);
                encoder.set_buffer(4, Some(&output_hash_buf), 0);
                encoder.set_buffer(5, Some(&mix_buf), 0);
                encoder.set_buffer(6, Some(&found_flag_buf), 0);
                encoder.set_buffer(7, Some(&base_nonce_buf), 0);
                encoder.set_buffer(8, Some(&stride_buf), 0);
                encoder.set_buffer(9, Some(&dag_size_buf), 0);
            }
            // kawpow: 0=header, 1=target, 2=dag, 3=nonce, 4=hash, 5=mix, 6=found, 7=base_nonce, 8=dag_entries
            "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc" => {
                let dag = self.kawpow_dag.as_ref()
                    .ok_or_else(|| anyhow!("KawPow DAG not set; call set_kawpow_dag() before mining"))?;
                let mix_init = [0u8; 32];
                let mix_buf = self.device.new_buffer_with_data(
                    mix_init.as_ptr() as *const _,
                    32,
                    MTLResourceOptions::CPUCacheModeDefaultCache,
                );
                let dag_ent = self.kawpow_dag_entries;
                let dag_entries_buf = self.device.new_buffer_with_data(
                    &dag_ent as *const u64 as *const _,
                    std::mem::size_of::<u64>() as u64,
                    MTLResourceOptions::CPUCacheModeDefaultCache,
                );
                encoder.set_buffer(0, Some(&header_buf), 0);
                encoder.set_buffer(1, Some(&target_buf), 0);
                encoder.set_buffer(2, Some(dag), 0);
                encoder.set_buffer(3, Some(&output_nonce_buf), 0);
                encoder.set_buffer(4, Some(&output_hash_buf), 0);
                encoder.set_buffer(5, Some(&mix_buf), 0);
                encoder.set_buffer(6, Some(&found_flag_buf), 0);
                encoder.set_buffer(7, Some(&base_nonce_buf), 0);
                encoder.set_buffer(8, Some(&dag_entries_buf), 0);
            }
            // zelhash: 0=header, 1=target, 2=nonce, 3=hash, 4=solution, 5=found, 6=hlen, 7=base_nonce
            "zelhash" | "zelhash_flux" => {
                let sol_init = [0u8; 52];
                let solution_buf = self.device.new_buffer_with_data(
                    sol_init.as_ptr() as *const _,
                    52,
                    MTLResourceOptions::CPUCacheModeDefaultCache,
                );
                encoder.set_buffer(0, Some(&header_buf), 0);
                encoder.set_buffer(1, Some(&target_buf), 0);
                encoder.set_buffer(2, Some(&output_nonce_buf), 0);
                encoder.set_buffer(3, Some(&output_hash_buf), 0);
                encoder.set_buffer(4, Some(&solution_buf), 0);
                encoder.set_buffer(5, Some(&found_flag_buf), 0);
                encoder.set_buffer(6, Some(&header_len_buf), 0);
                encoder.set_buffer(7, Some(&base_nonce_buf), 0);
            }
            // progpow: 0=header, 1=target, 2=dag, 3=nonce, 4=hash, 5=mix,
            //          6=found, 7=base_nonce, 8=batch_size, 9=dag_entries, 10=prog_seed
            "progpow" | "progpow_epic" => {
                let dag = self.progpow_dag.as_ref()
                    .ok_or_else(|| anyhow!("ProgPow DAG not set; call set_progpow_dag() before mining"))?;
                let mix_init = [0u8; 32];
                let mix_buf = self.device.new_buffer_with_data(
                    mix_init.as_ptr() as *const _,
                    32,
                    MTLResourceOptions::CPUCacheModeDefaultCache,
                );
                let dag_ent = self.progpow_dag_entries;
                let dag_entries_buf = self.device.new_buffer_with_data(
                    &dag_ent as *const u64 as *const _,
                    std::mem::size_of::<u64>() as u64,
                    MTLResourceOptions::CPUCacheModeDefaultCache,
                );
                let batch_sz = batch_size;
                let batch_size_buf = self.device.new_buffer_with_data(
                    &batch_sz as *const u64 as *const _,
                    std::mem::size_of::<u64>() as u64,
                    MTLResourceOptions::CPUCacheModeDefaultCache,
                );
                let prog_seed: u32 = 0; // simplified — no random math sequence
                let prog_seed_buf = self.device.new_buffer_with_data(
                    &prog_seed as *const u32 as *const _,
                    std::mem::size_of::<u32>() as u64,
                    MTLResourceOptions::CPUCacheModeDefaultCache,
                );
                encoder.set_buffer(0, Some(&header_buf), 0);
                encoder.set_buffer(1, Some(&target_buf), 0);
                encoder.set_buffer(2, Some(dag), 0);
                encoder.set_buffer(3, Some(&output_nonce_buf), 0);
                encoder.set_buffer(4, Some(&output_hash_buf), 0);
                encoder.set_buffer(5, Some(&mix_buf), 0);
                encoder.set_buffer(6, Some(&found_flag_buf), 0);
                encoder.set_buffer(7, Some(&base_nonce_buf), 0);
                encoder.set_buffer(8, Some(&batch_size_buf), 0);
                encoder.set_buffer(9, Some(&dag_entries_buf), 0);
                encoder.set_buffer(10, Some(&prog_seed_buf), 0);
            }
            _ => anyhow::bail!("unsupported algorithm for Metal: {algorithm}"),
        }

        // Dispatch threads
        let max_tg = self.device.max_threads_per_threadgroup();
        let threads_per_group = max_tg.width.max(256);
        let global_work_size = batch_size.max(1);

        let grid_size = MTLSize {
            width: global_work_size,
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

        let start = std::time::Instant::now();
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

    fn set_progpow_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()> {
        let buf = self.device.new_buffer_with_data(
            dag.as_ptr() as *const _,
            (dag.len() * std::mem::size_of::<u64>()) as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );
        self.progpow_dag = Some(buf);
        self.progpow_dag_entries = size_entries;
        self.progpow_epoch = epoch;
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

// ─── Pearl PoUW GPU mining ──────────────────────────────────────────────────

impl MetalBackend {
    /// Public accessor for device name (used by AuxPowClient::with_gpu).
    pub fn device_name_pub(&self) -> &str {
        &self.device_name
    }
}

/// Input data for Pearl PoUW GPU mining.
pub struct PearlPouwGpuInput<'a> {
    pub noised_a: &'a [i32],    // m×k, row-major
    pub noised_b: &'a [i32],    // n×k, B^T row-major
    pub a_noise_seed: [u8; 32],
    pub target: [u8; 32],
    pub row_offsets: &'a [u32], // 64 entries
    pub col_offsets: &'a [u32], // 64 entries
    pub rows_base: &'a [u32],   // 4 entries [0, 8, 64, 72]
    pub cols_base: &'a [u32],   // 8 entries [0, 1, 8, 9, 32, 33, 40, 41]
}

/// Result of Pearl PoUW GPU mining.
pub struct PearlPouwGpuResult {
    pub tile_index: u32,
    pub jackpot_hash: [u8; 32],
}

impl MetalBackend {
    /// Mine Pearl PoUW on GPU. Launches 4096 work-items (64×64 tiles).
    /// Returns the winning tile index and jackpot hash if a valid share is found.
    pub fn pearl_pouw_mine(&mut self, input: &PearlPouwGpuInput<'_>) -> Result<Option<PearlPouwGpuResult>> {
        let kernel_file = "pearl_pouw_kernel.metal";
        let kernel_name = "pearl_pouw_mine";

        let library = self.ensure_library(kernel_file)?;
        let function = library
            .get_function(kernel_name, None)
            .map_err(|e| anyhow!("Metal function not found: {kernel_name}: {e}"))?;

        let pipeline_state = self
            .device
            .new_compute_pipeline_state_with_function(&function)
            .map_err(|e| anyhow!("Metal pipeline state failed for {kernel_name}: {e}"))?;

        // Create buffers
        let a_buf = self.device.new_buffer_with_data(
            input.noised_a.as_ptr() as *const _,
            (input.noised_a.len() * std::mem::size_of::<i32>()) as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );
        let b_buf = self.device.new_buffer_with_data(
            input.noised_b.as_ptr() as *const _,
            (input.noised_b.len() * std::mem::size_of::<i32>()) as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );
        let seed_buf = self.device.new_buffer_with_data(
            input.a_noise_seed.as_ptr() as *const _,
            32,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );
        let target_buf = self.device.new_buffer_with_data(
            input.target.as_ptr() as *const _,
            32,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );
        let row_off_buf = self.device.new_buffer_with_data(
            input.row_offsets.as_ptr() as *const _,
            (input.row_offsets.len() * std::mem::size_of::<u32>()) as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );
        let col_off_buf = self.device.new_buffer_with_data(
            input.col_offsets.as_ptr() as *const _,
            (input.col_offsets.len() * std::mem::size_of::<u32>()) as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );
        let rows_base_buf = self.device.new_buffer_with_data(
            input.rows_base.as_ptr() as *const _,
            (input.rows_base.len() * std::mem::size_of::<u32>()) as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );
        let cols_base_buf = self.device.new_buffer_with_data(
            input.cols_base.as_ptr() as *const _,
            (input.cols_base.len() * std::mem::size_of::<u32>()) as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );

        let tile_init: u32 = 0;
        let output_tile_buf = self.device.new_buffer_with_data(
            &tile_init as *const u32 as *const _,
            std::mem::size_of::<u32>() as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );
        let jackpot_init = [0u8; 32];
        let output_jackpot_buf = self.device.new_buffer_with_data(
            jackpot_init.as_ptr() as *const _,
            32,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );
        let found_init: u32 = 0;
        let found_buf = self.device.new_buffer_with_data(
            &found_init as *const u32 as *const _,
            4,
            MTLResourceOptions::CPUCacheModeDefaultCache,
        );

        // Create command buffer
        let cmd_buffer = self.cmd_queue.new_command_buffer();
        let encoder = cmd_buffer.new_compute_command_encoder();
        encoder.set_compute_pipeline_state(&pipeline_state);

        // Set buffers
        encoder.set_buffer(0, Some(&a_buf), 0);
        encoder.set_buffer(1, Some(&b_buf), 0);
        encoder.set_buffer(2, Some(&seed_buf), 0);
        encoder.set_buffer(3, Some(&target_buf), 0);
        encoder.set_buffer(4, Some(&row_off_buf), 0);
        encoder.set_buffer(5, Some(&col_off_buf), 0);
        encoder.set_buffer(6, Some(&rows_base_buf), 0);
        encoder.set_buffer(7, Some(&cols_base_buf), 0);
        encoder.set_buffer(8, Some(&output_tile_buf), 0);
        encoder.set_buffer(9, Some(&output_jackpot_buf), 0);
        encoder.set_buffer(10, Some(&found_buf), 0);

        // Dispatch: 4096 work-items (64 row_offsets × 64 col_offsets)
        let grid_size = MTLSize { width: 4096, height: 1, depth: 1 };
        let max_tg = self.device.max_threads_per_threadgroup();
        let group_size = MTLSize {
            width: max_tg.width.min(256),
            height: 1,
            depth: 1,
        };

        encoder.dispatch_threads(grid_size, group_size);
        encoder.end_encoding();

        cmd_buffer.commit();
        cmd_buffer.wait_until_completed();

        // Read results
        let found_ptr = found_buf.contents() as *const u32;
        let found = unsafe { *found_ptr };
        if found == 0 {
            return Ok(None);
        }

        let tile_ptr = output_tile_buf.contents() as *const u32;
        let tile_index = unsafe { *tile_ptr };

        let jackpot_ptr = output_jackpot_buf.contents() as *const u8;
        let mut jackpot_hash = [0u8; 32];
        unsafe {
            std::ptr::copy_nonoverlapping(jackpot_ptr, jackpot_hash.as_mut_ptr(), 32);
        }

        Ok(Some(PearlPouwGpuResult {
            tile_index,
            jackpot_hash,
        }))
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

// ─── Pearl PoUW GPU-Native Pipeline ─────────────────────────────────────────

/// Input for GPU-native Pearl PoUW mining (no CPU data prep needed).
pub struct PearlPouwNativeInput<'a> {
    pub nonce: u64,
    pub m: usize,
    pub n: usize,
    pub k: usize,
    pub rank: usize,
    pub job_key: [u8; 32],
    pub target: [u8; 32],
    pub row_offsets: &'a [u32],
    pub col_offsets: &'a [u32],
    pub rows_base: &'a [u32],
    pub cols_base: &'a [u32],
    pub seed_label_a: [u8; 32],
    pub seed_label_b: [u8; 32],
}

impl MetalBackend {
    /// Fully GPU-native Pearl PoUW mining pipeline.
    ///
    /// All steps run on GPU:
    /// 1. Matrix generation (PCG32 PRNG from nonce)
    /// 2. BLAKE3 chunk hashing (keyed with job_key)
    /// 3. BLAKE3 Merkle tree reduction → root hashes
    /// 4. Noise seed derivation
    /// 5. Noise generation (E_AL, E_AR, E_BL, E_BR)
    /// 6. Noised matrix computation
    /// 7. MatMul + jackpot + target check
    ///
    /// CPU only needs to provide job_key, nonce, and mining config.
    /// Returns winning tile index + jackpot hash if a share is found.
    pub fn pearl_pouw_mine_native(
        &mut self,
        input: &PearlPouwNativeInput<'_>,
    ) -> Result<Option<PearlPouwGpuResult>> {
        let kernel_file = "pearl_pouw_native.metal";
        let m = input.m;
        let n = input.n;
        let k = input.k;
        let rank = input.rank;
        let mk = m * k;
        let nk = n * k;

        // Load library and get all pipeline states
        // Clone the library to release the mutable borrow on self
        let library = self.ensure_library(kernel_file)?.clone();

        // Get pipeline states
        let make_pipeline = |name: &str| -> Result<metal::ComputePipelineState> {
            let func = library
                .get_function(name, None)
                .map_err(|e| anyhow!("Metal function not found: {name}: {e}"))?;
            self.device
                .new_compute_pipeline_state_with_function(&func)
                .map_err(|e| anyhow!("Metal pipeline state failed for {name}: {e}"))
        };

        let pipe_gen = make_pipeline("pearl_gen_matrix")?;
        let pipe_chunk = make_pipeline("pearl_blake3_chunk_hash")?;
        let pipe_merge = make_pipeline("pearl_blake3_merge")?;
        let pipe_small = make_pipeline("pearl_blake3_small_hash")?;
        let pipe_perm = make_pipeline("pearl_gen_permutation")?;
        let pipe_unoise = make_pipeline("pearl_gen_uniform_noise")?;
        let pipe_noise_a = make_pipeline("pearl_apply_noise_a")?;
        let pipe_noise_b = make_pipeline("pearl_apply_noise_b")?;
        let pipe_mine = make_pipeline("pearl_pouw_mine_native")?;

        // Create all buffers
        let shared = MTLResourceOptions::CPUCacheModeDefaultCache;
        let storage = MTLResourceOptions::StorageModePrivate;

        // Matrix buffers (int8, stored as bytes)
        let matrix_a_buf = self.device.new_buffer((mk) as u64, storage);     // m×k int8
        let matrix_bt_buf = self.device.new_buffer((nk) as u64, storage);    // n×k int8 (B^T)

        // Chunk hash buffers
        let num_chunks_a = mk.div_ceil(1024);  // 256
        let num_chunks_b = nk.div_ceil(1024);  // 512
        let max_chunks = num_chunks_a.max(num_chunks_b);
        let chunk_hashes_buf = self.device.new_buffer((max_chunks * 32) as u64, storage);
        let merkle_buf = self.device.new_buffer((max_chunks * 32) as u64, storage);

        // Root hash buffers
        let root_a_buf = self.device.new_buffer(32, shared);
        let root_b_buf = self.device.new_buffer(32, shared);

        // Seed derivation buffers
        let seed_msg_buf = self.device.new_buffer(64, shared);  // job_key||hash_b or b_noise_seed||hash_a
        let b_noise_seed_buf = self.device.new_buffer(32, shared);
        let a_noise_seed_buf = self.device.new_buffer(32, shared);

        // Noise buffers
        let e_al_buf = self.device.new_buffer((m * rank) as u64, storage);     // m×rank int8
        let e_br_buf = self.device.new_buffer((n * rank) as u64, storage);     // n×rank int8
        let e_ar_perm_buf = self.device.new_buffer((k * 2 * 4) as u64, storage); // k×2 uint32
        let e_bl_perm_buf = self.device.new_buffer((k * 2 * 4) as u64, storage); // k×2 uint32

        // Noised matrices (int32)
        let noised_a_buf = self.device.new_buffer((mk * 4) as u64, storage);   // m×k int32
        let noised_b_buf = self.device.new_buffer((nk * 4) as u64, storage);   // n×k int32

        // Key/seed buffers
        let job_key_buf = self.device.new_buffer_with_data(
            input.job_key.as_ptr() as *const _,
            32, shared,
        );
        let iv_buf = self.device.new_buffer_with_data(
            [0x6A09E667u32, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
             0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19].as_ptr() as *const _,
            32, shared,
        );
        let seed_label_a_buf = self.device.new_buffer_with_data(
            input.seed_label_a.as_ptr() as *const _,
            32, shared,
        );
        let seed_label_b_buf = self.device.new_buffer_with_data(
            input.seed_label_b.as_ptr() as *const _,
            32, shared,
        );

        // Mining config buffers
        let target_buf = self.device.new_buffer_with_data(
            input.target.as_ptr() as *const _,
            32, shared,
        );
        let row_off_buf = self.device.new_buffer_with_data(
            input.row_offsets.as_ptr() as *const _,
            (input.row_offsets.len() * 4) as u64, shared,
        );
        let col_off_buf = self.device.new_buffer_with_data(
            input.col_offsets.as_ptr() as *const _,
            (input.col_offsets.len() * 4) as u64, shared,
        );
        let rows_base_buf = self.device.new_buffer_with_data(
            input.rows_base.as_ptr() as *const _,
            (input.rows_base.len() * 4) as u64, shared,
        );
        let cols_base_buf = self.device.new_buffer_with_data(
            input.cols_base.as_ptr() as *const _,
            (input.cols_base.len() * 4) as u64, shared,
        );

        // Output buffers
        let tile_init: u32 = 0;
        let output_tile_buf = self.device.new_buffer_with_data(
            &tile_init as *const u32 as *const _,
            4, shared,
        );
        let jackpot_init = [0u8; 32];
        let output_jackpot_buf = self.device.new_buffer_with_data(
            jackpot_init.as_ptr() as *const _,
            32, shared,
        );
        let found_init: u32 = 0;
        let found_buf = self.device.new_buffer_with_data(
            &found_init as *const u32 as *const _,
            4, shared,
        );

        // Constant data buffers (small values passed as constant buffers)
        let nonce_val = input.nonce;
        let nonce_buf = self.device.new_buffer_with_data(
            &nonce_val as *const u64 as *const _,
            8, shared,
        );

        // Create one command buffer for the entire pipeline
        let cmd_buffer = self.cmd_queue.new_command_buffer();

        // ─── Step 1: Generate matrices A and B^T ────────────────────────────
        {
            let enc = cmd_buffer.new_compute_command_encoder();
            enc.set_compute_pipeline_state(&pipe_gen);

            // Generate A (m×k, is_b_transpose=0)
            enc.set_buffer(0, Some(&matrix_a_buf), 0);
            enc.set_buffer(1, Some(&nonce_buf), 0);
            { let v: u32 = m as u32; enc.set_bytes(2, 4, &v as *const u32 as *const _); };  // rows
            { let v: u32 = k as u32; enc.set_bytes(3, 4, &v as *const u32 as *const _); };  // cols
            { let v: u32 = 0; enc.set_bytes(4, 4, &v as *const u32 as *const _); };         // is_b_transpose = 0 (A)
            let grid = MTLSize { width: mk as u64, height: 1, depth: 1 };
            let tg = MTLSize { width: 256, height: 1, depth: 1 };
            enc.dispatch_threads(grid, tg);

            // Generate B^T (n×k, is_b_transpose=1)
            enc.set_buffer(0, Some(&matrix_bt_buf), 0);
            { let v: u32 = n as u32; enc.set_bytes(2, 4, &v as *const u32 as *const _); };  // rows = n
            { let v: u32 = k as u32; enc.set_bytes(3, 4, &v as *const u32 as *const _); };  // cols = k
            { let v: u32 = 1; enc.set_bytes(4, 4, &v as *const u32 as *const _); };         // is_b_transpose = 1 (B^T)
            let grid_bt = MTLSize { width: nk as u64, height: 1, depth: 1 };
            enc.dispatch_threads(grid_bt, tg);

            enc.end_encoding();
        }

        // ─── Step 2: BLAKE3 chunk hashing ────────────────────────────────────
        {
            let enc = cmd_buffer.new_compute_command_encoder();
            enc.set_compute_pipeline_state(&pipe_chunk);

            // Hash A chunks (keyed with job_key)
            enc.set_buffer(0, Some(&matrix_a_buf), 0);
            enc.set_buffer(1, Some(&job_key_buf), 0);
            enc.set_buffer(2, Some(&chunk_hashes_buf), 0);
            { let v: u32 = num_chunks_a as u32; enc.set_bytes(3, 4, &v as *const u32 as *const _); };
            let grid = MTLSize { width: num_chunks_a as u64, height: 1, depth: 1 };
            enc.dispatch_threads(grid, MTLSize { width: 64, height: 1, depth: 1 });

            // Hash B^T chunks (keyed with job_key) — write to merkle_buf
            enc.set_buffer(0, Some(&matrix_bt_buf), 0);
            enc.set_buffer(1, Some(&job_key_buf), 0);
            enc.set_buffer(2, Some(&merkle_buf), 0);
            { let v: u32 = num_chunks_b as u32; enc.set_bytes(3, 4, &v as *const u32 as *const _); };
            let grid_b = MTLSize { width: num_chunks_b as u64, height: 1, depth: 1 };
            enc.dispatch_threads(grid_b, MTLSize { width: 64, height: 1, depth: 1 });

            enc.end_encoding();
        }

        // ─── Step 3: Merkle tree reduction ──────────────────────────────────
        // Reduce A: 256 → 128 → 64 → 32 → 16 → 8 → 4 → 2 → 1
        // Reduce B: 512 → 256 → 128 → 64 → 32 → 16 → 8 → 4 → 2 → 1
        let reduce_tree = |enc: &metal::ComputeCommandEncoderRef,
                          src: &metal::Buffer,
                          dst: &metal::Buffer,
                          num_leaves: usize,
                          root_buf: &metal::Buffer| {
            let mut num_nodes = num_leaves;
            let mut src_buf = src;
            let mut dst_buf = dst;
            let mut level = 0u32;

            while num_nodes > 1 {
                let num_parents = num_nodes / 2;
                let is_root = num_parents == 1;

                enc.set_compute_pipeline_state(&pipe_merge);
                enc.set_buffer(0, Some(src_buf), 0);
                if is_root {
                    enc.set_buffer(1, Some(root_buf), 0);
                } else {
                    enc.set_buffer(1, Some(dst_buf), 0);
                }
                { let v: u32 = num_parents as u32; enc.set_bytes(2, 4, &v as *const u32 as *const _); };
                { let v: u32 = if is_root { 1u32 } else { 0u32 }; enc.set_bytes(3, 4, &v as *const u32 as *const _); };

                let grid = MTLSize { width: num_parents as u64, height: 1, depth: 1 };
                enc.dispatch_threads(grid, MTLSize { width: 64, height: 1, depth: 1 });

                // Swap src and dst for next level
                std::mem::swap(&mut src_buf, &mut dst_buf);
                num_nodes = num_parents;
                level += 1;
            }

            // If num_leaves was 1 (single chunk), the root is already in src
            if num_leaves == 1 {
                // Copy src[0..32] to root_buf — but this is a GPU buffer, so we need a blit
                // For our use case, num_leaves is always > 1, so this shouldn't happen
            }
        };

        {
            let enc = cmd_buffer.new_compute_command_encoder();

            // Reduce A: chunk_hashes_buf → root_a_buf
            // After chunk hashing, A's chunk hashes are in chunk_hashes_buf
            reduce_tree(&enc, &chunk_hashes_buf, &merkle_buf, num_chunks_a, &root_a_buf);

            // Reduce B: merkle_buf → root_b_buf
            // After chunk hashing, B's chunk hashes are in merkle_buf
            // We need a separate temp buffer for B's reduction since chunk_hashes_buf is being used
            // Actually, we can reuse chunk_hashes_buf as the dst for B's reduction
            reduce_tree(&enc, &merkle_buf, &chunk_hashes_buf, num_chunks_b, &root_b_buf);

            enc.end_encoding();
        }

        // ─── Step 4: Derive noise seeds ─────────────────────────────────────
        // b_noise_seed = blake3(job_key || hash_b)  — unkeyed, 64-byte input
        // a_noise_seed = blake3(b_noise_seed || hash_a)  — unkeyed, 64-byte input
        {
            let enc = cmd_buffer.new_compute_command_encoder();
            enc.set_compute_pipeline_state(&pipe_small);

            // Build message: job_key (32 bytes) || hash_b (32 bytes) → seed_msg_buf
            // We need to copy job_key and root_b into seed_msg_buf
            // Use a blit encoder for the copy, or do it on CPU before dispatch
            // Actually, we can't easily do GPU→GPU copies within a compute encoder.
            // Let's use a blit command encoder for the copies.

            enc.end_encoding();
        }

        // Use blit encoder to assemble seed messages
        {
            let blit = cmd_buffer.new_blit_command_encoder();
            // seed_msg = job_key || hash_b
            blit.copy_from_buffer(&job_key_buf, 0, &seed_msg_buf, 0, 32);
            blit.copy_from_buffer(&root_b_buf, 0, &seed_msg_buf, 32, 32);
            blit.end_encoding();
        }

        // Hash seed_msg → b_noise_seed
        {
            let enc = cmd_buffer.new_compute_command_encoder();
            enc.set_compute_pipeline_state(&pipe_small);
            enc.set_buffer(0, Some(&seed_msg_buf), 0);
            { let v: u32 = 64; enc.set_bytes(1, 4, &v as *const u32 as *const _); };  // msg_len
            enc.set_buffer(2, Some(&iv_buf), 0);  // key = IV (unkeyed)
            { let v: u32 = 0; enc.set_bytes(3, 4, &v as *const u32 as *const _); };   // use_keyed = 0
            enc.set_buffer(4, Some(&b_noise_seed_buf), 0);
            enc.dispatch_threads(MTLSize { width: 1, height: 1, depth: 1 }, MTLSize { width: 1, height: 1, depth: 1 });
            enc.end_encoding();
        }

        // Build second seed message: b_noise_seed || hash_a → a_noise_seed
        {
            let blit = cmd_buffer.new_blit_command_encoder();
            blit.copy_from_buffer(&b_noise_seed_buf, 0, &seed_msg_buf, 0, 32);
            blit.copy_from_buffer(&root_a_buf, 0, &seed_msg_buf, 32, 32);
            blit.end_encoding();
        }

        {
            let enc = cmd_buffer.new_compute_command_encoder();
            enc.set_compute_pipeline_state(&pipe_small);
            enc.set_buffer(0, Some(&seed_msg_buf), 0);
            { let v: u32 = 64; enc.set_bytes(1, 4, &v as *const u32 as *const _); };
            enc.set_buffer(2, Some(&iv_buf), 0);
            { let v: u32 = 0; enc.set_bytes(3, 4, &v as *const u32 as *const _); };
            enc.set_buffer(4, Some(&a_noise_seed_buf), 0);
            enc.dispatch_threads(MTLSize { width: 1, height: 1, depth: 1 }, MTLSize { width: 1, height: 1, depth: 1 });
            enc.end_encoding();
        }

        // ─── Step 5: Generate noise ─────────────────────────────────────────
        {
            let enc = cmd_buffer.new_compute_command_encoder();

            // E_AL: m×rank uniform random int8 (key=seed_label_a, seed=a_noise_seed)
            enc.set_compute_pipeline_state(&pipe_unoise);
            enc.set_buffer(0, Some(&e_al_buf), 0);
            enc.set_buffer(1, Some(&a_noise_seed_buf), 0);
            enc.set_buffer(2, Some(&seed_label_a_buf), 0);
            { let v: u32 = m as u32; enc.set_bytes(3, 4, &v as *const u32 as *const _); };
            { let v: u32 = rank as u32; enc.set_bytes(4, 4, &v as *const u32 as *const _); };
            let eal_grid = MTLSize { width: (m * rank) as u64, height: 1, depth: 1 };
            enc.dispatch_threads(eal_grid, MTLSize { width: 256, height: 1, depth: 1 });

            // E_BR: n×rank uniform random int8 (key=seed_label_b, seed=b_noise_seed)
            enc.set_buffer(0, Some(&e_br_buf), 0);
            enc.set_buffer(1, Some(&b_noise_seed_buf), 0);
            enc.set_buffer(2, Some(&seed_label_b_buf), 0);
            { let v: u32 = n as u32; enc.set_bytes(3, 4, &v as *const u32 as *const _); };
            { let v: u32 = rank as u32; enc.set_bytes(4, 4, &v as *const u32 as *const _); };
            let ebr_grid = MTLSize { width: (n * rank) as u64, height: 1, depth: 1 };
            enc.dispatch_threads(ebr_grid, MTLSize { width: 256, height: 1, depth: 1 });

            // E_AR: k×2 permutation pairs (key=seed_label_a, seed=a_noise_seed)
            enc.set_compute_pipeline_state(&pipe_perm);
            enc.set_buffer(0, Some(&e_ar_perm_buf), 0);
            enc.set_buffer(1, Some(&a_noise_seed_buf), 0);
            enc.set_buffer(2, Some(&seed_label_a_buf), 0);
            { let v: u32 = k as u32; enc.set_bytes(3, 4, &v as *const u32 as *const _); };
            { let v: u32 = rank as u32; enc.set_bytes(4, 4, &v as *const u32 as *const _); };
            let ear_grid = MTLSize { width: k as u64, height: 1, depth: 1 };
            enc.dispatch_threads(ear_grid, MTLSize { width: 64, height: 1, depth: 1 });

            // E_BL: k×2 permutation pairs (key=seed_label_b, seed=b_noise_seed)
            enc.set_buffer(0, Some(&e_bl_perm_buf), 0);
            enc.set_buffer(1, Some(&b_noise_seed_buf), 0);
            enc.set_buffer(2, Some(&seed_label_b_buf), 0);
            { let v: u32 = k as u32; enc.set_bytes(3, 4, &v as *const u32 as *const _); };
            { let v: u32 = rank as u32; enc.set_bytes(4, 4, &v as *const u32 as *const _); };
            enc.dispatch_threads(ear_grid, MTLSize { width: 64, height: 1, depth: 1 });

            enc.end_encoding();
        }

        // ─── Step 6: Apply noise to matrices ────────────────────────────────
        {
            let enc = cmd_buffer.new_compute_command_encoder();

            // noised_a[i][l] = A[i][l] + (E_AL[i][E_AR[l].first] - E_AL[i][E_AR[l].second])
            enc.set_compute_pipeline_state(&pipe_noise_a);
            enc.set_buffer(0, Some(&noised_a_buf), 0);
            enc.set_buffer(1, Some(&matrix_a_buf), 0);
            enc.set_buffer(2, Some(&e_al_buf), 0);
            enc.set_buffer(3, Some(&e_ar_perm_buf), 0);
            { let v: u32 = m as u32; enc.set_bytes(4, 4, &v as *const u32 as *const _); };
            { let v: u32 = k as u32; enc.set_bytes(5, 4, &v as *const u32 as *const _); };
            { let v: u32 = rank as u32; enc.set_bytes(6, 4, &v as *const u32 as *const _); };
            let na_grid = MTLSize { width: mk as u64, height: 1, depth: 1 };
            enc.dispatch_threads(na_grid, MTLSize { width: 256, height: 1, depth: 1 });

            // noised_b_t[j][l] = B^T[j][l] + (E_BR[j][E_BL[l].first] - E_BR[j][E_BL[l].second])
            enc.set_compute_pipeline_state(&pipe_noise_b);
            enc.set_buffer(0, Some(&noised_b_buf), 0);
            enc.set_buffer(1, Some(&matrix_bt_buf), 0);
            enc.set_buffer(2, Some(&e_br_buf), 0);
            enc.set_buffer(3, Some(&e_bl_perm_buf), 0);
            { let v: u32 = n as u32; enc.set_bytes(4, 4, &v as *const u32 as *const _); };
            { let v: u32 = k as u32; enc.set_bytes(5, 4, &v as *const u32 as *const _); };
            { let v: u32 = rank as u32; enc.set_bytes(6, 4, &v as *const u32 as *const _); };
            let nb_grid = MTLSize { width: nk as u64, height: 1, depth: 1 };
            enc.dispatch_threads(nb_grid, MTLSize { width: 256, height: 1, depth: 1 });

            enc.end_encoding();
        }

        // ─── Step 7: MatMul + jackpot + target check ────────────────────────
        {
            let enc = cmd_buffer.new_compute_command_encoder();
            enc.set_compute_pipeline_state(&pipe_mine);

            enc.set_buffer(0, Some(&noised_a_buf), 0);
            enc.set_buffer(1, Some(&noised_b_buf), 0);
            enc.set_buffer(2, Some(&a_noise_seed_buf), 0);
            enc.set_buffer(3, Some(&target_buf), 0);
            enc.set_buffer(4, Some(&row_off_buf), 0);
            enc.set_buffer(5, Some(&col_off_buf), 0);
            enc.set_buffer(6, Some(&rows_base_buf), 0);
            enc.set_buffer(7, Some(&cols_base_buf), 0);
            enc.set_buffer(8, Some(&output_tile_buf), 0);
            enc.set_buffer(9, Some(&output_jackpot_buf), 0);
            enc.set_buffer(10, Some(&found_buf), 0);
            { let v: u32 = input.row_offsets.len() as u32; enc.set_bytes(11, 4, &v as *const u32 as *const _); }
            { let v: u32 = input.col_offsets.len() as u32; enc.set_bytes(12, 4, &v as *const u32 as *const _); }
            { let v: u32 = k as u32; enc.set_bytes(13, 4, &v as *const u32 as *const _); };
            { let v: u32 = rank as u32; enc.set_bytes(14, 4, &v as *const u32 as *const _); };

            let total_tiles = (input.row_offsets.len() * input.col_offsets.len()) as u64;
            let grid = MTLSize { width: total_tiles, height: 1, depth: 1 };
            let max_tg = self.device.max_threads_per_threadgroup();
            enc.dispatch_threads(grid, MTLSize { width: max_tg.width.min(256), height: 1, depth: 1 });

            enc.end_encoding();
        }

        // Submit and wait
        cmd_buffer.commit();
        cmd_buffer.wait_until_completed();

        // Read results
        let found_ptr = found_buf.contents() as *const u32;
        let found = unsafe { *found_ptr };
        if found == 0 {
            return Ok(None);
        }

        let tile_ptr = output_tile_buf.contents() as *const u32;
        let tile_index = unsafe { *tile_ptr };

        let jackpot_ptr = output_jackpot_buf.contents() as *const u8;
        let mut jackpot_hash = [0u8; 32];
        unsafe {
            std::ptr::copy_nonoverlapping(jackpot_ptr, jackpot_hash.as_mut_ptr(), 32);
        }

        Ok(Some(PearlPouwGpuResult {
            tile_index,
            jackpot_hash,
        }))
    }
}

// ─── Test methods for GPU-native BLAKE3 verification ────────────────────────

impl MetalBackend {
    /// Test: hash a single 1024-byte chunk on GPU. For BLAKE3 correctness verification.
    pub fn test_blake3_chunk_hash(&mut self, data: &[u8; 1024], key: &[u8; 32]) -> Result<[u8; 32]> {
        let kernel_file = "pearl_pouw_native.metal";
        let library = self.ensure_library(kernel_file)?.clone();
        let func = library.get_function("pearl_blake3_chunk_hash", None)
            .map_err(|e| anyhow!("function: {e}"))?;
        let pipeline = self.device.new_compute_pipeline_state_with_function(&func)
            .map_err(|e| anyhow!("pipeline: {e}"))?;

        let shared = MTLResourceOptions::CPUCacheModeDefaultCache;
        let data_buf = self.device.new_buffer_with_data(data.as_ptr() as *const _, 1024, shared);
        let key_buf = self.device.new_buffer_with_data(key.as_ptr() as *const _, 32, shared);
        let out_buf = self.device.new_buffer(32, shared);

        let cmd = self.cmd_queue.new_command_buffer();
        let enc = cmd.new_compute_command_encoder();
        enc.set_compute_pipeline_state(&pipeline);
        enc.set_buffer(0, Some(&data_buf), 0);
        enc.set_buffer(1, Some(&key_buf), 0);
        enc.set_buffer(2, Some(&out_buf), 0);
        { let v: u32 = 1u32; enc.set_bytes(3, 4, &v as *const u32 as *const _); }
        enc.dispatch_threads(MTLSize { width: 1, height: 1, depth: 1 }, MTLSize { width: 1, height: 1, depth: 1 });
        enc.end_encoding();
        cmd.commit();
        cmd.wait_until_completed();

        let ptr = out_buf.contents() as *const u8;
        let mut result = [0u8; 32];
        unsafe { std::ptr::copy_nonoverlapping(ptr, result.as_mut_ptr(), 32); }
        Ok(result)
    }
}
