//! Metal GPU backend for macOS/iOS — CHv4 (Cosmic Harmony v4)
//!
//! Uses Apple Metal API for native GPU acceleration on Apple Silicon.
//! Full CHv4 pipeline on GPU:
//!   Keccak-256 → SHA3-512 → Golden Matrix
//!   → Memory-Hard Scratchpad (512 KiB/thread)
//!   → NPU Mixing (INT8 MLP 64→128→64 + residual)
//!   → Cosmic Fusion
//! CHV4_NPU_FORK_HEIGHT = 0: CHv4 always active from genesis.
//!
//! Buffer layout matches Metal shader structs:
//!   buffer(0) = CHv4MiningParams { start_nonce, header_len, header[80], target[32], block_height }
//!   buffer(1) = CHv4MiningResult { found_nonce, found_hash[32], found }
//!   buffer(2) = scratchpad_buf  (batch_size × 512 KiB)
//!   buffer(3) = npu_w1   [128×64  i8]  Layer-1 weights
//!   buffer(4) = npu_b1   [128     i8]  Layer-1 bias
//!   buffer(5) = npu_w2   [64×128  i8]  Layer-2 weights
//!   buffer(6) = npu_b2   [64      i8]  Layer-2 bias
//!   buffer(7) = npu_scale1 [128   i16] Layer-1 scale
//!   buffer(8) = npu_scale2 [64    i16] Layer-2 scale

use std::path::Path;

#[cfg(target_os = "macos")]
use metal::{
    Buffer, CommandQueue, ComputePipelineState, Device, Library, MTLResourceOptions, MTLSize,
};

use super::{GpuBackend, GpuDevice};

/// CHv4 Mining Parameters — matches Metal shader CHv4MiningParams exactly
/// Metal MSL layout (uint8_t has alignment 1, NO padding after u32):
///   offset   0: uint64_t start_nonce   (8 bytes, align 8)
///   offset   8: uint32_t header_len    (4 bytes, align 4)
///   offset  12: uint8_t  header[80]    (80 bytes, align 1) ← NO PADDING
///   offset  92: uint8_t  target[32]    (32 bytes, align 1)
///   offset 124: uint32_t block_height  (4 bytes)
///   Total: 128 bytes (struct alignment 8, naturally aligned)
#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone)]
pub struct CHv3MiningParams {
    pub start_nonce:  u64,    // offset   0, size 8
    pub header_len:   u32,    // offset   8, size 4
    pub header:       [u8; 80], // offset 12, size 80
    pub target:       [u8; 32], // offset 92, size 32
    pub block_height: u32,    // offset 124, size 4
} // total: 128 bytes

/// CHv3 Mining Result — matches Metal shader struct exactly
/// Metal MSL layout:
///   offset 0:  uint64_t found_nonce  (8 bytes)
///   offset 8:  uint8_t found_hash[32](32 bytes)
///   offset 40: uint32_t found        (4 bytes)
///   Total: 44 bytes (padded to 48)
#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone)]
pub struct CHv3MiningResult {
    pub found_nonce: u64,     // offset 0,  size 8
    pub found_hash: [u8; 32], // offset 8,  size 32
    pub found: u32,           // offset 40, size 4
} // total: 44 → padded to 48

/// Metal miner for Cosmic Harmony v4
#[cfg(target_os = "macos")]
pub struct MetalMiner {
    device: Device,
    command_queue: CommandQueue,
    pipeline_mine: ComputePipelineState,
    pipeline_benchmark: ComputePipelineState,

    // Core buffers
    params_buf: Buffer,
    result_buf: Buffer,
    hashes_buf: Option<Buffer>,

    // CHv4: per-thread scratchpad (batch_size × 512 KiB)
    scratchpad_buf: Buffer,

    // CHv4: NPU weight buffers (uploaded once at init, never change)
    npu_w1_buf:     Buffer,   // [128 × 64  i8]  8 192 bytes
    npu_b1_buf:     Buffer,   // [128       i8]    128 bytes
    npu_w2_buf:     Buffer,   // [64  × 128 i8]  8 192 bytes
    npu_b2_buf:     Buffer,   // [64        i8]     64 bytes
    npu_scale1_buf: Buffer,   // [128       i16]   256 bytes
    npu_scale2_buf: Buffer,   // [64        i16]   128 bytes

    // Config
    batch_size: usize,
    threads_per_threadgroup: usize,

    // Stats
    total_hashes: u64,
    solutions_found: u64,
}

#[cfg(target_os = "macos")]
impl MetalMiner {
    /// Create new Metal miner
    pub fn new(batch_size: usize) -> Result<Self, MetalError> {
        // Get default Metal device
        let device = Device::system_default().ok_or(MetalError::NoDevice)?;

        log::debug!("Metal device: {}", device.name());
        log::debug!(
            "   Max threads per threadgroup: {}",
            device.max_threads_per_threadgroup().width
        );
        log::debug!(
            "   Recommended working set size: {} MB",
            device.recommended_max_working_set_size() / (1024 * 1024)
        );

        // Create command queue
        let command_queue = device.new_command_queue();

        // Load shader library
        let library = Self::load_shader_library(&device)?;

        // Create compute pipelines — kernel names match metal_shader.metal
        let mine_fn = library
            .get_function("cosmic_harmony_v3_mine", None)
            .map_err(|e| {
                MetalError::FunctionNotFound(format!("cosmic_harmony_v3_mine: {:?}", e))
            })?;
        let benchmark_fn = library
            .get_function("cosmic_harmony_v3_benchmark", None)
            .map_err(|e| {
                MetalError::FunctionNotFound(format!("cosmic_harmony_v3_benchmark: {:?}", e))
            })?;

        let pipeline_mine = device
            .new_compute_pipeline_state_with_function(&mine_fn)
            .map_err(|e| MetalError::PipelineError(format!("{:?}", e)))?;
        let pipeline_benchmark = device
            .new_compute_pipeline_state_with_function(&benchmark_fn)
            .map_err(|e| MetalError::PipelineError(format!("{:?}", e)))?;

        // Calculate optimal threads per threadgroup
        // M1/M2/M3 support up to 1024 threads per threadgroup.
        // Use the pipeline's maximum to maximize GPU occupancy.
        let max_threads = pipeline_mine.max_total_threads_per_threadgroup();
        let threads_per_threadgroup = max_threads as usize;

        log::debug!("   Threads per threadgroup: {}", threads_per_threadgroup);
        log::debug!("   Batch size: {}", batch_size);

        // ── Core struct buffers ──
        let options = MTLResourceOptions::StorageModeShared;

        let params_size = std::mem::size_of::<CHv3MiningParams>() as u64;
        let result_size = std::mem::size_of::<CHv3MiningResult>() as u64;

        let params_buf = device.new_buffer(params_size, options);
        let result_buf = device.new_buffer(result_size, options);

        // Verify struct sizes and field offsets at runtime
        log::debug!("   Params struct: {} bytes (expected 128)", params_size);
        log::debug!("   Result struct: {} bytes (expected 44-48)", result_size);

        let dummy_params = CHv3MiningParams {
            start_nonce:  0,
            header_len:   0,
            header:       [0u8; 80],
            target:       [0u8; 32],
            block_height: 0,
        };
        let base = &dummy_params as *const _ as usize;
        let header_offset = &dummy_params.header as *const _ as usize - base;
        let target_offset = &dummy_params.target as *const _ as usize - base;
        log::debug!("   Header offset: {} (Metal expects 12)", header_offset);
        log::debug!("   Target offset: {} (Metal expects 92)", target_offset);

        if header_offset != 12 {
            return Err(MetalError::BufferError(
                format!("CHv3MiningParams.header at offset {} but Metal expects 12! Struct alignment mismatch.", header_offset)
            ));
        }

        // ── CHv4: derive NPU weights from genesis seed (deterministic) ──
        let weights = crate::algorithms_npu::chv4_npu_weights_flat();

        // w1: [128×64 i8] — 8 192 bytes
        let npu_w1_buf = device.new_buffer_with_data(
            weights.w1.as_ptr() as *const _,
            8192u64,
            options,
        );
        // b1: [128 i8] — 128 bytes
        let npu_b1_buf = device.new_buffer_with_data(
            weights.b1.as_ptr() as *const _,
            128u64,
            options,
        );
        // w2: [64×128 i8] — 8 192 bytes
        let npu_w2_buf = device.new_buffer_with_data(
            weights.w2.as_ptr() as *const _,
            8192u64,
            options,
        );
        // b2: [64 i8] — 64 bytes
        let npu_b2_buf = device.new_buffer_with_data(
            weights.b2.as_ptr() as *const _,
            64u64,
            options,
        );
        // scale1: [128 i16] — 256 bytes
        let npu_scale1_buf = device.new_buffer_with_data(
            weights.scale1.as_ptr() as *const _,
            256u64,
            options,
        );
        // scale2: [64 i16] — 128 bytes
        let npu_scale2_buf = device.new_buffer_with_data(
            weights.scale2.as_ptr() as *const _,
            128u64,
            options,
        );

        log::debug!("   NPU weights uploaded ({} bytes total)", 8192 + 128 + 8192 + 64 + 256 + 128);

        // ── CHv4: scratchpad buffer — each thread gets 512 KiB ──
        let scratchpad_bytes = (batch_size as u64) * 524_288u64;
        let scratchpad_buf = device.new_buffer(scratchpad_bytes, options);
        log::debug!(
            "   Scratchpad: {} MiB total ({} threads × 512 KiB)",
            scratchpad_bytes / (1024 * 1024),
            batch_size
        );

        Ok(Self {
            device,
            command_queue,
            pipeline_mine,
            pipeline_benchmark,
            params_buf,
            result_buf,
            hashes_buf: None,
            scratchpad_buf,
            npu_w1_buf,
            npu_b1_buf,
            npu_w2_buf,
            npu_b2_buf,
            npu_scale1_buf,
            npu_scale2_buf,
            batch_size,
            threads_per_threadgroup,
            total_hashes: 0,
            solutions_found: 0,
        })
    }

    /// Load Metal shader library
    fn load_shader_library(device: &Device) -> Result<Library, MetalError> {
        // Try to load pre-compiled metallib first
        let metallib_paths = [
            "cosmic_harmony_v3.metallib",
            "src/gpu/cosmic_harmony_v3.metallib",
            "../cosmic_harmony_v3.metallib",
        ];

        for path in &metallib_paths {
            if Path::new(path).exists() {
                if let Ok(lib) = device.new_library_with_file(path) {
                    log::debug!("   Loaded pre-compiled shader: {}", path);
                    return Ok(lib);
                }
            }
        }

        // Compile from source
        let shader_source = include_str!("metal_shader.metal");
        let options = metal::CompileOptions::new();

        let library = device
            .new_library_with_source(shader_source, &options)
            .map_err(|e| MetalError::CompileError(format!("{:?}", e)))?;

        log::debug!("   Compiled shader from source");
        Ok(library)
    }

    /// Get device info
    pub fn device_info(&self) -> GpuDevice {
        GpuDevice {
            id: 0,
            name: self.device.name().to_string(),
            vendor: "Apple".to_string(),
            backend: GpuBackend::Metal,
            compute_units: 0, // Metal doesn't expose this directly
            max_work_group_size: self.threads_per_threadgroup,
            global_memory: self.device.recommended_max_working_set_size(),
            local_memory: 32768, // Typical for Apple GPUs
        }
    }

    /// Get batch size
    pub fn batch_size(&self) -> usize {
        self.batch_size
    }

    /// Mine for a valid nonce — CHv4 full pipeline
    pub fn mine(
        &mut self,
        header: &[u8],
        target: &[u8; 32],
        start_nonce: u64,
        height: u64,
    ) -> Option<(u64, [u8; 32])> {
        // Build params struct matching Metal CHv4MiningParams
        unsafe {
            let ptr = self.params_buf.contents() as *mut CHv3MiningParams;
            let params = &mut *ptr;
            params.start_nonce  = start_nonce;
            params.header_len   = header.len().min(80) as u32;
            params.header       = [0u8; 80];
            std::ptr::copy_nonoverlapping(
                header.as_ptr(),
                params.header.as_mut_ptr(),
                header.len().min(80),
            );
            params.target.copy_from_slice(target);
            params.block_height = height as u32;
        }

        // Reset result struct
        unsafe {
            let ptr = self.result_buf.contents() as *mut CHv3MiningResult;
            let result = &mut *ptr;
            result.found_nonce = 0;
            result.found_hash  = [0u8; 32];
            result.found       = 0;
        }

        let command_buffer = self.command_queue.new_command_buffer();
        let encoder = command_buffer.new_compute_command_encoder();

        encoder.set_compute_pipeline_state(&self.pipeline_mine);
        // Core buffers
        encoder.set_buffer(0, Some(&self.params_buf),   0);
        encoder.set_buffer(1, Some(&self.result_buf),   0);
        // CHv4 buffers
        encoder.set_buffer(2, Some(&self.scratchpad_buf),  0);
        encoder.set_buffer(3, Some(&self.npu_w1_buf),      0);
        encoder.set_buffer(4, Some(&self.npu_b1_buf),      0);
        encoder.set_buffer(5, Some(&self.npu_w2_buf),      0);
        encoder.set_buffer(6, Some(&self.npu_b2_buf),      0);
        encoder.set_buffer(7, Some(&self.npu_scale1_buf),  0);
        encoder.set_buffer(8, Some(&self.npu_scale2_buf),  0);

        let grid_size        = MTLSize::new(self.batch_size as u64, 1, 1);
        let threadgroup_size = MTLSize::new(self.threads_per_threadgroup as u64, 1, 1);

        encoder.dispatch_threads(grid_size, threadgroup_size);
        encoder.end_encoding();

        command_buffer.commit();
        command_buffer.wait_until_completed();

        self.total_hashes += self.batch_size as u64;

        let result = unsafe { &*(self.result_buf.contents() as *const CHv3MiningResult) };

        if result.found > 0 {
            self.solutions_found += 1;
            let mut found_hash = [0u8; 32];
            found_hash.copy_from_slice(&result.found_hash);
            Some((result.found_nonce, found_hash))
        } else {
            None
        }
    }

    /// Compute batch of hashes — benchmark kernel, CHv4
    pub fn batch_hash(&mut self, header: &[u8], start_nonce: u64, count: usize) -> Vec<[u8; 32]> {
        let required_size = (count * 32) as u64;
        if self.hashes_buf.is_none() || self.hashes_buf.as_ref().unwrap().length() < required_size {
            self.hashes_buf = Some(
                self.device
                    .new_buffer(required_size, MTLResourceOptions::StorageModeShared),
            );
        }

        unsafe {
            let ptr = self.params_buf.contents() as *mut CHv3MiningParams;
            let params = &mut *ptr;
            params.start_nonce  = start_nonce;
            params.header_len   = header.len().min(80) as u32;
            params.header       = [0u8; 80];
            std::ptr::copy_nonoverlapping(
                header.as_ptr(),
                params.header.as_mut_ptr(),
                header.len().min(80),
            );
            params.target       = [0u8; 32];
            params.block_height = 0u32;
        }

        let command_buffer = self.command_queue.new_command_buffer();
        let encoder = command_buffer.new_compute_command_encoder();

        encoder.set_compute_pipeline_state(&self.pipeline_benchmark);
        // Core buffers
        encoder.set_buffer(0, Some(&self.params_buf), 0);
        encoder.set_buffer(1, self.hashes_buf.as_ref().map(|v| &**v), 0);
        // CHv4 buffers
        encoder.set_buffer(2, Some(&self.scratchpad_buf),  0);
        encoder.set_buffer(3, Some(&self.npu_w1_buf),      0);
        encoder.set_buffer(4, Some(&self.npu_b1_buf),      0);
        encoder.set_buffer(5, Some(&self.npu_w2_buf),      0);
        encoder.set_buffer(6, Some(&self.npu_b2_buf),      0);
        encoder.set_buffer(7, Some(&self.npu_scale1_buf),  0);
        encoder.set_buffer(8, Some(&self.npu_scale2_buf),  0);

        let grid_size        = MTLSize::new(count as u64, 1, 1);
        let threadgroup_size = MTLSize::new(self.threads_per_threadgroup as u64, 1, 1);

        encoder.dispatch_threads(grid_size, threadgroup_size);
        encoder.end_encoding();

        command_buffer.commit();
        command_buffer.wait_until_completed();

        self.total_hashes += count as u64;

        let mut results = Vec::with_capacity(count);
        unsafe {
            let ptr = self.hashes_buf.as_ref().unwrap().contents() as *const u8;
            for i in 0..count {
                let mut hash = [0u8; 32];
                std::ptr::copy_nonoverlapping(ptr.add(i * 32), hash.as_mut_ptr(), 32);
                results.push(hash);
            }
        }
        results
    }

    /// Run benchmark
    pub fn benchmark(&mut self, duration_secs: f64) -> f64 {
        use std::time::Instant;

        let header = b"ZION_BENCHMARK_HEADER_COSMIC_HARMONY_V3_METAL";
        let target = [0xFFu8; 32]; // Easy target for benchmarking

        let start = Instant::now();
        let mut total = 0u64;
        let mut nonce = 0u64;

        while start.elapsed().as_secs_f64() < duration_secs {
            self.mine(header, &target, nonce, 0);
            nonce += self.batch_size as u64;
            total += self.batch_size as u64;
        }

        let elapsed = start.elapsed().as_secs_f64();
        let hashrate = total as f64 / elapsed;

        println!("\n🍎 Metal Benchmark Results:");
        println!("   Total hashes: {:>12}", total);
        println!("   Time: {:.2}s", elapsed);
        println!("   Hashrate: {:.2} MH/s", hashrate / 1_000_000.0);

        hashrate
    }

    /// GPU↔CPU CHv4 parity check (compares GPU output against CPU CHv4 reference).
    pub fn parity_check_legacy(
        &mut self,
        header: &[u8],
        start_nonce: u64,
        count: usize,
    ) -> Result<usize, MetalError> {
        let gpu_hashes = self.batch_hash(header, start_nonce, count);
        let mut mismatches = 0usize;

        for (i, gpu_hash) in gpu_hashes.iter().enumerate() {
            let nonce = start_nonce + i as u64;
            // CHV4_NPU_FORK_HEIGHT = 0, so height 0 already exercises CHv4
            let cpu = crate::algorithms_opt::cosmic_harmony_v3_with_height(header, nonce, 0u64);

            if gpu_hash != &cpu.data {
                mismatches += 1;
                if mismatches <= 3 {
                    log::warn!(
                        "Metal CHv4 parity mismatch at nonce {} (idx={}): gpu={} cpu={}",
                        nonce,
                        i,
                        hex::encode(gpu_hash),
                        hex::encode(cpu.data),
                    );
                }
            }
        }

        Ok(mismatches)
    }

    /// GPU↔CPU parity check proti výškově řízené CPU referenci.
    ///
    /// Používá `cosmic_harmony_v3_with_height`, takže:
    /// - pod fork-height porovnává proti legacy CHv3,
    /// - od fork-height porovnává proti memory-hard CHv3.
    pub fn parity_check_with_height(
        &mut self,
        header: &[u8],
        start_nonce: u64,
        count: usize,
        height: u32,
    ) -> Result<usize, MetalError> {
        let gpu_hashes = self.batch_hash(header, start_nonce, count);
        let mut mismatches = 0usize;

        for (i, gpu_hash) in gpu_hashes.iter().enumerate() {
            let nonce = start_nonce + i as u64;
            let cpu =
                crate::algorithms_opt::cosmic_harmony_v3_with_height(header, nonce, height as u64);

            if gpu_hash != &cpu.data {
                mismatches += 1;
                if mismatches <= 3 {
                    log::warn!(
                        "Metal parity-with-height mismatch at nonce {} (idx={}, h={}): gpu={} cpu={}",
                        nonce,
                        i,
                        height,
                        hex::encode(gpu_hash),
                        hex::encode(cpu.data),
                    );
                }
            }
        }

        Ok(mismatches)
    }

    /// Get statistics
    pub fn stats(&self) -> MetalStats {
        MetalStats {
            total_hashes: self.total_hashes,
            solutions_found: self.solutions_found,
            batch_size: self.batch_size,
            threads_per_threadgroup: self.threads_per_threadgroup,
        }
    }
}

/// Metal miner statistics
#[derive(Debug, Clone)]
pub struct MetalStats {
    pub total_hashes: u64,
    pub solutions_found: u64,
    pub batch_size: usize,
    pub threads_per_threadgroup: usize,
}

/// Metal error types
#[derive(Debug)]
pub enum MetalError {
    NoDevice,
    FunctionNotFound(String),
    CompileError(String),
    PipelineError(String),
    BufferError(String),
}

impl std::fmt::Display for MetalError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NoDevice => write!(f, "No Metal device found"),
            Self::FunctionNotFound(s) => write!(f, "Function not found: {}", s),
            Self::CompileError(s) => write!(f, "Shader compile error: {}", s),
            Self::PipelineError(s) => write!(f, "Pipeline error: {}", s),
            Self::BufferError(s) => write!(f, "Buffer error: {}", s),
        }
    }
}

impl std::error::Error for MetalError {}

// Stub for non-macOS platforms
#[cfg(not(target_os = "macos"))]
pub struct MetalMiner;

#[cfg(not(target_os = "macos"))]
impl MetalMiner {
    pub fn new(_batch_size: usize) -> Result<Self, MetalError> {
        Err(MetalError::NoDevice)
    }
}

#[cfg(test)]
#[cfg(target_os = "macos")]
mod tests {
    use super::*;

    #[test]
    fn test_metal_init() {
        let miner = MetalMiner::new(100_000);
        assert!(miner.is_ok(), "Metal should initialize on macOS");

        let miner = miner.unwrap();
        println!("Device: {:?}", miner.device_info());
    }

    #[test]
    fn test_metal_batch_hash() {
        let mut miner = MetalMiner::new(1000).unwrap();
        let header = b"test header";

        let hashes = miner.batch_hash(header, 0, 100);
        assert_eq!(hashes.len(), 100);

        // All hashes should be different
        for i in 0..99 {
            assert_ne!(hashes[i], hashes[i + 1]);
        }
    }

    #[test]
    fn test_metal_benchmark() {
        let mut miner = MetalMiner::new(500_000).unwrap();
        let hashrate = miner.benchmark(2.0);

        println!("Hashrate: {:.2} MH/s", hashrate / 1_000_000.0);
        assert!(hashrate > 1_000_000.0, "Should achieve at least 1 MH/s");
    }

    #[test]
    fn test_metal_parity_legacy_small_batch() {
        let mut miner = MetalMiner::new(8192).unwrap();
        let header = b"ZION_PARITY_TEST_HEADER_LEGACY_CHV3";

        let mismatches = miner.parity_check_legacy(header, 0, 64).unwrap();
        assert_eq!(
            mismatches, 0,
            "Metal legacy parity mismatches: {}",
            mismatches
        );
    }
}
