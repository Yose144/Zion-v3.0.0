//! Ekam Deeksha v3.2 Metal backend.
//!
//! Uses `kernels/metal/ekam_deeksha.metal` — bit-identical to CPU
//! `EkamDeeksha::hash_bytes` (v3.2: 512 KiB, 16384 blocks, 2 passes, 128 reads).

use super::*;
use metal::{Device, MTLResourceOptions, MTLSize};
use std::time::Instant;

const SENTINEL: u64 = 0xFFFF_FFFF_FFFF_FFFF;
const SENTINEL_U32: u32 = 0xFFFF_FFFF;

/// Precompute Keccak state after absorbing the 80-byte header.
/// The kernel only needs to XOR the nonce (at byte offset 80 = u64[10]),
/// apply padding, and run one f1600 permutation.
/// This matches the CUDA/OpenCL `precompute_header_keccak_state`.
fn precompute_header_keccak_state(header_80: &[u8]) -> [u64; 25] {
    let mut state = [0u64; 25];
    for (i, &b) in header_80.iter().enumerate().take(80) {
        let word_idx = i / 8;
        let shift = (i % 8) * 8;
        state[word_idx] ^= (b as u64) << shift;
    }
    state
}

pub struct MetalDeekshaLiteMiner {
    device: Device,
    queue: metal::CommandQueue,
    pipeline: metal::ComputePipelineState,
    header_buf: metal::Buffer,
    scratchpad_buf: metal::Buffer,
    result_nonce_buf: metal::Buffer,
    result_hash_buf: metal::Buffer,
    batch_size: usize,
    threads_per_tg: usize,
    device_name_cached: String,
    cur_target_u32: u32,
}

impl MetalDeekshaLiteMiner {
    pub fn new(work_size: usize) -> Result<Self> {
        let device =
            Device::system_default().ok_or_else(|| anyhow::anyhow!("no Metal device found"))?;
        let device_name = device.name().to_string();
        let queue = device.new_command_queue();

        let shader_src = include_str!("kernels/metal/ekam_deeksha.metal");
        let options = metal::CompileOptions::new();
        options.set_fast_math_enabled(true);
        let library = device
            .new_library_with_source(shader_src, &options)
            .map_err(|e| anyhow::anyhow!("Metal Lite shader compilation failed: {:?}", e))?;

        let func = library
            .get_function("ekam_deeksha_mine", None)
            .map_err(|e| anyhow::anyhow!("Ekam Deeksha kernel function not found: {:?}", e))?;

        let pipeline = device
            .new_compute_pipeline_state_with_function(&func)
            .map_err(|e| anyhow::anyhow!("Metal Lite pipeline creation failed: {:?}", e))?;

        let max_tpg = pipeline.max_total_threads_per_threadgroup() as usize;
        // For register-heavy keccak kernels, smaller threadgroups can improve
        // occupancy by reducing register pressure. Allow override via env var.
        // Default: 128 (good balance for M1's 128 ALU/core).
        let threads_per_tg = std::env::var("ZION_METAL_TPG")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(128)
            .min(max_tpg);

        let device_recommended = device.recommended_max_working_set_size();
        let budget_bytes = claim_gpu_memory_budget(device_recommended);
        // 512 KiB scratchpad per thread (v3.2)
        // M1: 8 GPU cores → optimal = 8 threadgroups × threads_per_tg
        // M1 Pro: 10-16 cores, M1 Max: 24-32 cores → scale up
        let gpu_core_count = if device_name.contains("Max") || device_name.contains("Ultra") {
            32
        } else if device_name.contains("Pro") {
            16
        } else {
            8 // M1 (base)
        };
        let optimal_batch = gpu_core_count * threads_per_tg;
        let max_threads_by_mem = (budget_bytes / 524_288) as usize;
        // Use the larger of work_size and optimal_batch (one threadgroup per GPU core)
        // capped by available memory. This ensures full GPU occupancy on M1.
        let batch_size = work_size
            .max(optimal_batch)
            .min(max_threads_by_mem.max(threads_per_tg));
        let shared_opts = MTLResourceOptions::StorageModeShared;
        let private_opts = MTLResourceOptions::StorageModePrivate;

        let header_buf = device.new_buffer(200, shared_opts); // precomputed Keccak state, CPU writes
        let result_nonce_buf = device.new_buffer(12, shared_opts); // CPU reads result
        let result_hash_buf = device.new_buffer(32, shared_opts); // CPU reads result

        let mut batch_size = batch_size;
        let mut scratchpad_buf;
        let mut scratch_bytes;
        loop {
            scratch_bytes = (batch_size as u64) * 524_288u64;
            // Scratchpad is GPU-only — CPU never reads/writes it.
            // Private storage can improve cache behavior on unified memory.
            scratchpad_buf = device.new_buffer(scratch_bytes, private_opts);
            if scratchpad_buf.length() >= scratch_bytes {
                break;
            }
            if batch_size <= threads_per_tg {
                anyhow::bail!(
                    "Lite scratchpad allocation failed: need {} MiB, got {} bytes (budget {} MiB)",
                    scratch_bytes / (1024 * 1024),
                    scratchpad_buf.length(),
                    budget_bytes / (1024 * 1024),
                );
            }
            batch_size = (batch_size * 9 / 10).max(threads_per_tg);
        }

        // Round the batch down to a multiple of threads_per_tg so the Metal
        // dispatch grid has no idle tail threads.
        batch_size = (batch_size / threads_per_tg) * threads_per_tg;

        println!(
            "gpu_metal_lite_init device=\"{}\" batch_size={} threads_per_tg={} scratchpad_mib={}",
            device_name,
            batch_size,
            threads_per_tg,
            scratch_bytes / (1024 * 1024)
        );

        Ok(Self {
            device,
            queue,
            pipeline,
            header_buf,
            scratchpad_buf,
            result_nonce_buf,
            result_hash_buf,
            batch_size,
            threads_per_tg,
            device_name_cached: device_name,
            cur_target_u32: 0,
        })
    }

    fn dispatch_batch_async(
        &mut self,
        nonce_start: u64,
        count: usize,
    ) -> std::sync::mpsc::Receiver<()> {
        // Use set_bytes for nonce_base and params so each command buffer
        // has its own copy — enables back-to-back dispatch without sync.
        let nonce_bytes = nonce_start.to_le_bytes();
        let params_bytes = [count as u32, self.cur_target_u32].map(|v| v.to_le_bytes());
        let params_flat: [u8; 8] = [
            params_bytes[0][0],
            params_bytes[0][1],
            params_bytes[0][2],
            params_bytes[0][3],
            params_bytes[1][0],
            params_bytes[1][1],
            params_bytes[1][2],
            params_bytes[1][3],
        ];

        let cb = self.queue.new_command_buffer();
        let enc = cb.new_compute_command_encoder();
        enc.set_compute_pipeline_state(&self.pipeline);
        enc.set_buffer(0, Some(&self.header_buf), 0);
        enc.set_bytes(
            1,
            params_flat.len() as u64,
            params_flat.as_ptr() as *const std::ffi::c_void,
        );
        enc.set_bytes(
            2,
            nonce_bytes.len() as u64,
            nonce_bytes.as_ptr() as *const std::ffi::c_void,
        );
        enc.set_buffer(3, Some(&self.scratchpad_buf), 0);
        enc.set_buffer(4, Some(&self.result_nonce_buf), 0);
        enc.set_buffer(5, Some(&self.result_hash_buf), 0);

        let grid = MTLSize::new(count as u64, 1, 1);
        let tg = MTLSize::new(self.threads_per_tg as u64, 1, 1);
        enc.dispatch_threads(grid, tg);
        enc.end_encoding();

        let (tx, rx) = std::sync::mpsc::channel();
        let block = block::ConcreteBlock::new(move |_buffer: &metal::CommandBufferRef| {
            let _ = tx.send(());
        })
        .copy();
        cb.add_completed_handler(&block);
        cb.commit();
        rx
    }

    fn read_result(&self) -> Option<(u64, [u8; 32])> {
        let flag = unsafe { *(self.result_nonce_buf.contents() as *const u32) };
        if flag == SENTINEL_U32 {
            return None;
        }
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

impl GpuMiner for MetalDeekshaLiteMiner {
    fn device_name(&self) -> String {
        self.device_name_cached.clone()
    }

    fn backend_kind(&self) -> GpuBackendKind {
        GpuBackendKind::Metal
    }

    fn algorithm(&self) -> String {
        "ekam_deeksha".to_string()
    }

    fn update_epoch(&mut self, _height: u64) -> Result<()> {
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
        let keccak_state = precompute_header_keccak_state(&header_bytes);

        unsafe {
            let ptr = self.header_buf.contents() as *mut u64;
            std::ptr::copy_nonoverlapping(keccak_state.as_ptr(), ptr, 25);
        }

        let target_u32 = u32::from_be_bytes([
            target.bytes[0],
            target.bytes[1],
            target.bytes[2],
            target.bytes[3],
        ]);
        self.cur_target_u32 = target_u32;

        // Reset result_flag ONCE — atomic early-exit handles subsequent chunks
        unsafe {
            let ptr = self.result_nonce_buf.contents() as *mut u32;
            *ptr = SENTINEL_U32;
        }

        // Launch all chunks back-to-back (no inter-chunk sync).
        // Metal command buffers within a queue execute in order, so
        // scratchpad reuse between chunks is safe.
        let mut receivers: Vec<std::sync::mpsc::Receiver<()>> = Vec::new();
        let mut total_tested = 0u64;
        let mut current_nonce = nonce_start;
        let mut left = batch_size;

        while left > 0 {
            let chunk = (left as usize).min(self.batch_size);
            let rx = self.dispatch_batch_async(current_nonce, chunk);
            receivers.push(rx);
            total_tested += chunk as u64;
            current_nonce = current_nonce.wrapping_add(chunk as u64);
            left = left.saturating_sub(chunk as u64);
        }

        // Single sync — wait for ALL chunks to complete
        for rx in &receivers {
            rx.recv()
                .map_err(|_| anyhow::anyhow!("Metal Lite async wait failed"))?;
        }

        // Read result ONCE — only the winning nonce+hash (12 + 32 bytes)
        let mut all_solutions = Vec::new();
        if let Some((nonce, hash)) = self.read_result() {
            all_solutions.push((nonce, hash, None));
        }

        Ok(GpuBatchResult {
            solutions: all_solutions,
            nonces_tested: total_tested,
            device_name: self.device_name_cached.clone(),
            solution_blob: None,
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

        let header_bytes = header.to_bytes();
        let keccak_state = precompute_header_keccak_state(&header_bytes);
        unsafe {
            let ptr = self.header_buf.contents() as *mut u64;
            std::ptr::copy_nonoverlapping(keccak_state.as_ptr(), ptr, 25);
        }
        self.cur_target_u32 = 0; // benchmark mode

        let start = Instant::now();
        let mut total = 0u64;
        let mut nonce = 0u64;

        // Back-to-back dispatch: dispatch multiple batches before waiting.
        // This keeps the GPU fed and eliminates inter-batch CPU sync overhead.
        const PIPELINE_DEPTH: usize = 3;
        while start.elapsed().as_secs_f64() < secs {
            let mut receivers: Vec<std::sync::mpsc::Receiver<()>> = Vec::new();
            for _ in 0..PIPELINE_DEPTH {
                if start.elapsed().as_secs_f64() >= secs {
                    break;
                }
                let rx = self.dispatch_batch_async(nonce, self.batch_size);
                receivers.push(rx);
                total += self.batch_size as u64;
                nonce = nonce.wrapping_add(self.batch_size as u64);
            }
            // Wait for all pipelined batches
            for rx in &receivers {
                let _ = rx
                    .recv()
                    .map_err(|_| anyhow::anyhow!("Metal Lite async wait failed"));
            }
        }

        let elapsed = start.elapsed().as_secs_f64();
        let khps = if elapsed > 0.0 {
            total as f64 / elapsed / 1_000.0
        } else {
            0.0
        };
        Ok((total, elapsed, khps))
    }
}
