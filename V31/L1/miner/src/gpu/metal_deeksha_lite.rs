//! Canonical Ekam Deeksha / DeekshaLite v2 Metal backend.
//!
//! Uses `kernels/metal/deeksha_lite.metal` — a 128 KiB, 1-pass, 32-reads,
//! 2-AES-rounds, Keccak256-final pipeline that is bit-identical to the CPU
//! `EkamDeeksha` implementation.

use super::*;
use metal::{Device, MTLResourceOptions, MTLSize};
use std::time::Instant;

const SENTINEL: u64 = 0xFFFF_FFFF_FFFF_FFFF;
const SENTINEL_U32: u32 = 0xFFFF_FFFF;

pub struct MetalDeekshaLiteMiner {
    device: Device,
    queue: metal::CommandQueue,
    pipeline: metal::ComputePipelineState,
    header_buf: metal::Buffer,
    params_buf: metal::Buffer,
    nonce_base_buf: metal::Buffer,
    scratchpad_buf: metal::Buffer,
    result_nonce_buf: metal::Buffer,
    result_hash_buf: metal::Buffer,
    batch_size: usize,
    threads_per_tg: usize,
    device_name_cached: String,
}

impl MetalDeekshaLiteMiner {
    pub fn new(work_size: usize) -> Result<Self> {
        let device =
            Device::system_default().ok_or_else(|| anyhow::anyhow!("no Metal device found"))?;
        let device_name = device.name().to_string();
        let queue = device.new_command_queue();

        let shader_src = include_str!("kernels/metal/deeksha_lite.metal");
        let options = metal::CompileOptions::new();
        let library = device
            .new_library_with_source(shader_src, &options)
            .map_err(|e| anyhow::anyhow!("Metal Lite shader compilation failed: {:?}", e))?;

        let func = library
            .get_function("deeksha_lite_mine", None)
            .map_err(|e| anyhow::anyhow!("Lite kernel function not found: {:?}", e))?;

        let pipeline = device
            .new_compute_pipeline_state_with_function(&func)
            .map_err(|e| anyhow::anyhow!("Metal Lite pipeline creation failed: {:?}", e))?;

        let max_tpg = pipeline.max_total_threads_per_threadgroup() as usize;
        let threads_per_tg = if device_name.contains("Pro")
            || device_name.contains("Max")
            || device_name.contains("Ultra")
        {
            256
        } else {
            128
        }
        .min(max_tpg);

        let device_recommended = device.recommended_max_working_set_size();
        let budget_bytes = claim_gpu_memory_budget(device_recommended);
        let max_threads_by_mem = (budget_bytes / 131_072) as usize;
        let batch_size = work_size
            .max(threads_per_tg)
            .min(max_threads_by_mem.max(threads_per_tg));
        let opts = MTLResourceOptions::StorageModeShared;

        let header_buf = device.new_buffer(80, opts);
        let params_buf = device.new_buffer(12, opts);
        let nonce_base_buf = device.new_buffer(8, opts);
        let result_nonce_buf = device.new_buffer(12, opts);
        let result_hash_buf = device.new_buffer(32, opts);

        let mut batch_size = batch_size;
        let mut scratchpad_buf;
        let mut scratch_bytes;
        loop {
            scratch_bytes = (batch_size as u64) * 131_072u64;
            scratchpad_buf = device.new_buffer(scratch_bytes, opts);
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
            params_buf,
            nonce_base_buf,
            scratchpad_buf,
            result_nonce_buf,
            result_hash_buf,
            batch_size,
            threads_per_tg,
            device_name_cached: device_name,
        })
    }

    fn dispatch_batch_async(
        &mut self,
        nonce_start: u64,
        count: usize,
    ) -> std::sync::mpsc::Receiver<()> {
        unsafe {
            let ptr = self.nonce_base_buf.contents() as *mut u64;
            *ptr = nonce_start;
        }
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

        unsafe {
            let ptr = self.header_buf.contents() as *mut u8;
            std::ptr::copy_nonoverlapping(header_bytes.as_ptr(), ptr, header_bytes.len().min(80));
        }

        let target_u32 = u32::from_be_bytes([
            target.bytes[0],
            target.bytes[1],
            target.bytes[2],
            target.bytes[3],
        ]);

        let mut all_solutions = Vec::new();
        let mut total_tested = 0u64;
        let mut current_nonce = nonce_start;
        let mut left = batch_size;

        while left > 0 {
            let chunk = (left as usize).min(self.batch_size);

            unsafe {
                let ptr = self.params_buf.contents() as *mut u32;
                *ptr = 80u32;
                *ptr.add(1) = chunk as u32;
                *ptr.add(2) = target_u32;
            }

            let rx = self.dispatch_batch_async(current_nonce, chunk);
            rx.recv()
                .map_err(|_| anyhow::anyhow!("Metal Lite async wait failed"))?;

            if let Some((nonce, hash)) = self.read_result() {
                all_solutions.push((nonce, hash, None));
                total_tested += (nonce.saturating_sub(current_nonce) + 1).min(chunk as u64);
            }

            total_tested += chunk as u64;
            current_nonce = current_nonce.wrapping_add(chunk as u64);
            left = left.saturating_sub(chunk as u64);
        }

        Ok(GpuBatchResult {
            solutions: all_solutions,
            nonces_tested: total_tested,
            device_name: self.device_name_cached.clone(),
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
        unsafe {
            let ptr = self.header_buf.contents() as *mut u8;
            std::ptr::copy_nonoverlapping(header_bytes.as_ptr(), ptr, 80);
        }
        unsafe {
            let ptr = self.params_buf.contents() as *mut u32;
            *ptr = 80u32;
            *ptr.add(1) = self.batch_size as u32;
            *ptr.add(2) = 0u32;
        }

        let start = Instant::now();
        let mut total = 0u64;
        let mut nonce = 0u64;

        while start.elapsed().as_secs_f64() < secs {
            let rx = self.dispatch_batch_async(nonce, self.batch_size);
            let _ = rx.recv();
            total += self.batch_size as u64;
            nonce = nonce.wrapping_add(self.batch_size as u64);
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
