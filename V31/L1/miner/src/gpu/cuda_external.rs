/// CUDA miner for external AuxPoW algorithms (kheavyhash, blake3, autolykos, zelhash,
/// ethash, kawpow).
///
/// Uses the existing CUDA kernels from AuXpow/csrc/cuda/ and compiles them
/// via NVRTC at runtime. This eliminates the CPU fallback for external
/// algorithms when using the CUDA backend.
///
/// Supported algorithms:
///   - kheavyhash / kheavyhash_kas (Kaspa)
///   - blake3 / blake3_alph (Alephium)
///   - blake3_dcr (Decred)
///   - autolykos / autolykos_erg (Ergo)
///   - zelhash / zelhash_flux (FLUX)
///   - ethash / ethash_etc (Ethereum Classic / ETHW)
///   - kawpow / kawpow_rvn (Ravencoin / CLORE / EVR / MEWC)
use anyhow::Result;
use cudarc::driver::sys::CUdevice_attribute;
use cudarc::driver::{CudaDevice, CudaSlice, LaunchAsync, LaunchConfig};
use cudarc::nvrtc::{compile_ptx_with_opts, CompileOptions};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;

/// Detect the GPU's compute capability and return an NVRTC-compatible arch string
/// (e.g. "compute_61" for Pascal, "compute_86" for Ampere, "compute_89" for Ada).
/// NVRTC requires virtual arch (compute_XX) — the generated PTX is JIT-compiled
/// to SASS by the driver.  Falls back to the ZION_CUDA_ARCH env var, then to
/// "compute_86" if detection fails.
pub(crate) fn detect_cuda_arch(dev: &CudaDevice) -> String {
    if let Ok(arch) = std::env::var("ZION_CUDA_ARCH") {
        return arch;
    }
    let major = dev.attribute(CUdevice_attribute::CU_DEVICE_ATTRIBUTE_COMPUTE_CAPABILITY_MAJOR);
    let minor = dev.attribute(CUdevice_attribute::CU_DEVICE_ATTRIBUTE_COMPUTE_CAPABILITY_MINOR);
    match (major, minor) {
        (Ok(maj), Ok(min)) => {
            let arch = format!("compute_{}{}", maj, min);
            crate::ext_warn!(
                "cuda_arch_detect: compute_capability={}.{} => arch={}",
                maj,
                min,
                arch
            );
            arch
        }
        _ => {
            crate::ext_warn!(
                "cuda_arch_detect: failed to query compute capability, falling back to compute_86"
            );
            "compute_86".to_string()
        }
    }
}

use crate::gpu::{GpuBackendKind, GpuBatchResult, GpuMiner};
use zion_core::{MiningHeader, V3DifficultyTarget as DifficultyTarget};

const SENTINEL_NONCE: u64 = 0xFFFF_FFFF_FFFF_FFFF;
const SENTINEL_FOUND: u32 = 0;

// Kernel sources — included at compile time from AuXpow/csrc/cuda/
const KHEAVYHASH_CU: &str = include_str!("../../csrc/cuda/kheavyhash_kernel.cu");
const BLAKE3_CU: &str = include_str!("../../csrc/cuda/blake3_kernel.cu");
const AUTOLYKOS_CU: &str = include_str!("../../csrc/cuda/autolykos_kernel.cu");
const ZELHASH_CU: &str = include_str!("../../csrc/cuda/zelhash_kernel.cu");
const ETHASH_CU: &str = include_str!("../../csrc/cuda/ethash_kernel.cu");
const KAWPOW_CU: &str = include_str!("../../csrc/cuda/kawpow_kernel.cu");
const PROGPOW_CU: &str = include_str!("../../csrc/cuda/progpow_kernel.cu");
const ETHASH_DAG_GEN_CU: &str = include_str!("../../csrc/cuda/ethash_dag_gen.cu");
const VERUSHASH_CU: &str = include_str!("../../csrc/cuda/verushash_kernel.cu");
const KERYXHASH_CU: &str = include_str!("../../csrc/cuda/keryxhash_kernel.cu");

/// Preprocess kernel source: strip #pragma once and #include lines,
/// prepend standard typedefs, fix NVRTC-incompatible constructs.
pub(crate) fn preprocess_kernel(src: &str) -> String {
    let mut out = String::new();
    // Prepend typedefs that the kernels need
    out.push_str("typedef unsigned char uint8_t;\n");
    out.push_str("typedef unsigned short uint16_t;\n");
    out.push_str("typedef unsigned int uint32_t;\n");
    out.push_str("typedef int int32_t;\n");
    out.push_str("typedef unsigned long long uint64_t;\n");
    out.push_str("typedef long long int64_t;\n");

    for line in src.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("#pragma once")
            || trimmed.starts_with("#include <cuda_runtime.h>")
            || trimmed.starts_with("#include <stdint.h>")
        {
            continue;
        }
        // Fix: __constant__ cannot be used as a function parameter qualifier
        // or local variable qualifier in NVRTC — only for global declarations.
        // Strategy: keep __constant__ only on unindented lines (global
        // declarations like arrays). Remove it from all indented lines
        // (local variables inside device functions) and function parameters.
        let line = if line.starts_with("__constant__") {
            // Global declaration (no indentation) — keep as-is
            line.to_string()
        } else {
            // Indented line or function parameter — strip __constant__
            line.replace("__constant__ ", "")
        };
        out.push_str(&line);
        out.push('\n');
    }
    out
}

/// Algorithm type for CUDA external mining.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum CudaExtAlgo {
    Kheavyhash,
    Blake3Alph,
    Blake3Dcr,
    Autolykos,
    Zelhash,
    Ethash,
    Kawpow,
    Progpow,
    Verushash,
    Keryxhash,
}

impl CudaExtAlgo {
    pub fn from_name(algorithm: &str) -> Option<Self> {
        match algorithm {
            "kheavyhash" | "kheavyhash_kas" => Some(Self::Kheavyhash),
            "blake3" | "blake3_alph" => Some(Self::Blake3Alph),
            "blake3_dcr" => Some(Self::Blake3Dcr),
            "autolykos" | "autolykos_erg" => Some(Self::Autolykos),
            "zelhash" | "zelhash_flux" => Some(Self::Zelhash),
            "ethash" | "ethash_etc" | "ethash_ethw" => Some(Self::Ethash),
            "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc" => {
                Some(Self::Kawpow)
            }
            "progpow" | "progpow_epic" | "progpow_zano" | "progpowz" => Some(Self::Progpow),
            "verushash" | "verushash_vrsc" | "verus" => Some(Self::Verushash),
            "keryxhash" | "keryxhash_krx" | "keryx" => Some(Self::Keryxhash),
            _ => None,
        }
    }

    fn kernel_name(&self) -> &'static str {
        match self {
            Self::Kheavyhash => "kheavyhash_mine",
            Self::Blake3Alph => "blake3_alph_mine",
            Self::Blake3Dcr => "blake3_dcr_mine",
            Self::Autolykos => "autolykos_mine",
            Self::Zelhash => "zelhash_mine",
            Self::Ethash => "ethash_mine",
            // kawpow_kernel.cu exports the upstream kawpowminer name
            // `progpow_search` (there is no `kawpow_mine` symbol).
            Self::Kawpow => "progpow_search",
            Self::Progpow => "progpow_mine",
            Self::Verushash => "verus_mine",
            Self::Keryxhash => "keryxhash_mine",
        }
    }

    fn module_name(&self) -> &'static str {
        match self {
            Self::Kheavyhash => "kheavyhash",
            Self::Blake3Alph => "blake3_alph",
            Self::Blake3Dcr => "blake3_dcr",
            Self::Autolykos => "autolykos",
            Self::Zelhash => "zelhash",
            Self::Ethash => "ethash",
            Self::Kawpow => "kawpow",
            Self::Progpow => "progpow",
            Self::Verushash => "verushash",
            Self::Keryxhash => "keryxhash",
        }
    }

    fn kernel_source(&self) -> &'static str {
        match self {
            Self::Kheavyhash => KHEAVYHASH_CU,
            Self::Blake3Alph | Self::Blake3Dcr => BLAKE3_CU,
            Self::Autolykos => AUTOLYKOS_CU,
            Self::Zelhash => ZELHASH_CU,
            Self::Ethash => ETHASH_CU,
            Self::Kawpow => KAWPOW_CU,
            Self::Progpow => PROGPOW_CU,
            Self::Verushash => VERUSHASH_CU,
            Self::Keryxhash => KERYXHASH_CU,
        }
    }

    /// Returns true if this algorithm requires a DAG buffer.
    fn needs_dag(&self) -> bool {
        matches!(self, Self::Ethash | Self::Kawpow | Self::Progpow)
    }

    /// Epoch length for DAG-based algorithms.
    fn epoch_length(&self) -> u32 {
        match self {
            Self::Ethash => 30000,
            Self::Kawpow => 7500,
            Self::Progpow => 30000,
            _ => 0,
        }
    }

    /// Returns true if this algorithm requires period-based kernel recompilation
    /// (random math changes every PERIOD blocks). KawPow/ProgPoW share the
    /// XMRIG_INCLUDE_* codegen path, so both compile deferred.
    fn needs_period_recompile(&self) -> bool {
        matches!(self, Self::Progpow | Self::Kawpow)
    }
}

pub struct CudaExternalMiner {
    dev: Arc<CudaDevice>,
    algo: CudaExtAlgo,
    algorithm: String,
    work_size: usize,
    device_name_cached: String,
    // Common buffers
    header_buf: CudaSlice<u8>,
    target_buf: CudaSlice<u8>,
    output_nonce: CudaSlice<u64>,
    output_hash: CudaSlice<u8>,
    output_solution: CudaSlice<u8>, // 52-byte Equihash solution (zelhash only)
    output_mix: CudaSlice<u8>,      // 32-byte mix hash (ethash/kawpow)
    found_flag: CudaSlice<u32>,
    // Algorithm-specific buffers
    kheavy_matrix: Option<CudaSlice<u16>>,
    /// Pre-PoW hash the current `kheavy_matrix` was generated from — the
    /// matrix is seeded by pre_pow (rusty-kaspa `Matrix::generate`), so it
    /// must be regenerated whenever a new job's pre_pow differs.
    kheavy_pre_pow: [u8; 32],
    /// Autolykos R-table on device: N × 8 u32 (32 bytes per element,
    /// layout expected by `autolykos_mine`'s `r_table[i*2]` uint4 reads).
    autolykos_table: Option<CudaSlice<u32>>,
    autolykos_table_size: u32,
    /// Autolykos M constant buffer: 1024 × i64-BE = 8192 bytes.
    autolykos_m_buf: Option<CudaSlice<u8>>,
    autolykos_height: u32,
    // DAG buffer for ethash/kawpow
    dag_buf: Option<CudaSlice<u64>>,
    dag_size_entries: u64,
    dag_epoch: u32, // 0xFFFFFFFF = no DAG loaded
    // Light cache for DAG generation (uploaded to GPU for on-GPU DAG gen)
    light_cache_buf: Option<CudaSlice<u64>>,
    light_cache_items: u64,
    // DAG generation kernel module (separate from mining kernel)
    dag_gen_loaded: bool,
    // Cached timestamp for kheavyhash
    kheavy_timestamp: u64,
    /// KeryxHash DAA score — selects the active matrix salt (v1/v2/v4).
    keryx_daa_score: u64,
    /// DAA score the current matrix buffer was generated with.
    kheavy_matrix_daa: u64,
    // Block height set by update_epoch(); used for algorithms that need height
    // in mine_batch_raw where the MiningHeader timestamp is not available.
    current_height: u64,
    // Verushash: precomputed key (552 uint4 = 8832 bytes) and blockhash_half (4 uint4 = 64 bytes)
    verus_vkey: Option<CudaSlice<u32>>,
    verus_blockhash_half: Option<CudaSlice<u32>>,
    // Verushash: per-thread scratch buffer for key workspace
    // TOTAL_MAX (0x10000) * VERUS_KEY_SIZE128 (552) uint4 = 0x10000 * 552 * 16 bytes = ~578 MB
    // This is too large — use a smaller buffer that covers threads_per_block * blocks
    verus_scratch: Option<CudaSlice<u32>>,
    /// ZION_VERUS_DEBUG=1: per-thread CLHash intermediate dump (u64/thread)
    verus_debug_im: Option<CudaSlice<u64>>,
    verus_nonce_space: Option<CudaSlice<u32>>,
    // ProgPoW: current period for random math recompilation.
    // 0xFFFFFFFF = no ProgPoW kernel compiled yet.
    progpow_period: u32,
    // ProgPoW: current DAG elements for PROGPOW_DAG_ELEMENTS define.
    // 0 = not set yet.
    progpow_dag_elements: u64,
    // ProgPoW: g_output buffer for the kernel's compatibility output slots.
    progpow_g_output: Option<CudaSlice<u32>>,
    // KawPow: job_blob (10 u32), results (16 u32), stop (2 u32)
    kawpow_job_blob: Option<CudaSlice<u32>>,
    kawpow_results: Option<CudaSlice<u32>>,
    kawpow_stop: Option<CudaSlice<u32>>,
}

impl CudaExternalMiner {
    pub fn new(algorithm: &str, work_size: usize) -> Result<Self> {
        let dev =
            CudaDevice::new(0).map_err(|e| anyhow::anyhow!("CUDA device init failed: {e}"))?;
        Self::new_with_device(algorithm, work_size, dev)
    }

    /// Create a CudaExternalMiner using a shared CUDA device (e.g. the same
    /// device used by the main ZION deeksha miner). This avoids creating a
    /// second CUDA context on the same GPU, which causes deadlocks on
    /// consumer GPUs (GTX 1080, etc.) that don't support MPS.
    pub fn new_with_device(
        algorithm: &str,
        work_size: usize,
        dev: Arc<CudaDevice>,
    ) -> Result<Self> {
        let algo = CudaExtAlgo::from_name(algorithm)
            .ok_or_else(|| anyhow::anyhow!("unsupported CUDA external algorithm: {}", algorithm))?;

        let device_name = dev
            .name()
            .unwrap_or_else(|_| "unknown CUDA device".to_string());

        // Compile kernel via NVRTC — auto-detect GPU compute capability.
        // ProgPoW defers compilation because it needs block_height for random
        // math codegen injection (period-based recompilation).
        let arch = detect_cuda_arch(&dev);
        let progpow_deferred = algo.needs_period_recompile();
        if !progpow_deferred {
            let processed = preprocess_kernel(algo.kernel_source());
            let ptx = compile_ptx_with_opts(
                &processed,
                CompileOptions {
                    options: vec![
                        "--use_fast_math".to_string(),
                        format!("-arch={}", arch),
                        "--std=c++14".to_string(),
                    ],
                    ..Default::default()
                },
            )
            .map_err(|e| anyhow::anyhow!("NVRTC compile failed for {}: {e}", algorithm))?;

            let module_name = algo.module_name();
            let kernel_name = algo.kernel_name();
            // Autolykos also uses the device-side R-table precompute kernel
            // from the same module.
            let func_names: &[&str] = if algo == CudaExtAlgo::Autolykos {
                &[kernel_name, "autolykos_precompute"]
            } else {
                &[kernel_name]
            };
            dev.load_ptx(ptx, module_name, func_names)
                .map_err(|e| anyhow::anyhow!("PTX load failed for {}: {e}", algorithm))?;
        }

        // Allocate common buffers
        let header_buf = dev
            .alloc_zeros::<u8>(256)
            .map_err(|e| anyhow::anyhow!("header alloc: {e}"))?;
        let target_buf = dev
            .alloc_zeros::<u8>(32)
            .map_err(|e| anyhow::anyhow!("target alloc: {e}"))?;
        let output_nonce = dev
            .htod_copy(vec![SENTINEL_NONCE])
            .map_err(|e| anyhow::anyhow!("output_nonce alloc: {e}"))?;
        let output_hash = dev
            .alloc_zeros::<u8>(32)
            .map_err(|e| anyhow::anyhow!("output_hash alloc: {e}"))?;
        let output_solution = dev
            .alloc_zeros::<u8>(52)
            .map_err(|e| anyhow::anyhow!("output_solution alloc: {e}"))?;
        let output_mix = dev
            .alloc_zeros::<u8>(32)
            .map_err(|e| anyhow::anyhow!("output_mix alloc: {e}"))?;
        let found_flag = dev
            .htod_copy(vec![SENTINEL_FOUND])
            .map_err(|e| anyhow::anyhow!("found_flag alloc: {e}"))?;

        // Algorithm-specific buffers — kheavyhash matrix is regenerated
        // per job (seeded by pre_pow_hash); start with a zero seed.
        let kheavy_matrix = if matches!(algo, CudaExtAlgo::Kheavyhash | CudaExtAlgo::Keryxhash) {
            let matrix = generate_kheavy_matrix_cuda(&[0u8; 32]);
            Some(
                dev.htod_copy(matrix.to_vec())
                    .map_err(|e| anyhow::anyhow!("kheavy_matrix alloc: {e}"))?,
            )
        } else {
            None
        };

        let autolykos_table = None; // Generated on first mine_batch

        // ProgPoW: allocate g_output buffer (18 × u32: 10 compatibility + 8 debug)
        let progpow_g_output = if algo == CudaExtAlgo::Progpow {
            Some(
                dev.htod_copy(vec![0u32; 18])
                    .map_err(|e| anyhow::anyhow!("progpow_g_output alloc: {e}"))?,
            )
        } else {
            None
        };

        // KawPow: allocate job_blob (10 u32), results (16 u32), stop (2 u32)
        let (kawpow_job_blob, kawpow_results, kawpow_stop) = if algo == CudaExtAlgo::Kawpow {
            (
                Some(
                    dev.htod_copy(vec![0u32; 10])
                        .map_err(|e| anyhow::anyhow!("kawpow_job_blob alloc: {e}"))?,
                ),
                Some(
                    dev.htod_copy(vec![0u32; 16])
                        .map_err(|e| anyhow::anyhow!("kawpow_results alloc: {e}"))?,
                ),
                Some(
                    dev.htod_copy(vec![0u32; 2])
                        .map_err(|e| anyhow::anyhow!("kawpow_stop alloc: {e}"))?,
                ),
            )
        } else {
            (None, None, None)
        };

        // Allow larger work sizes for ProgPoW to reduce kernel launch
        // overhead and improve occupancy on Pascal+.  The previous 1M cap
        // was conservative; 4M gives the GPU bigger batches to chew on
        // without exceeding reasonable launch grid limits.
        let max_work_size = std::env::var("ZION_CUDA_MAX_WORK_SIZE")
            .ok()
            .and_then(|v| v.trim().parse::<usize>().ok())
            .unwrap_or(1 << 22); // 4M default
        let actual_work_size = work_size.max(256).min(max_work_size);

        crate::ext_info!(
            "gpu_cuda_ext_init device=\"{}\" algorithm={} work_size={}",
            device_name,
            algorithm,
            actual_work_size,
        );

        Ok(Self {
            dev,
            algo,
            algorithm: algorithm.to_string(),
            work_size: actual_work_size,
            device_name_cached: device_name,
            header_buf,
            target_buf,
            output_nonce,
            output_hash,
            output_solution,
            output_mix,
            found_flag,
            kheavy_matrix,
            kheavy_pre_pow: [0u8; 32],
            autolykos_table,
            autolykos_table_size: 0,
            autolykos_m_buf: None,
            autolykos_height: 0,
            dag_buf: None,
            dag_size_entries: 0,
            dag_epoch: 0xFFFFFFFF,
            light_cache_buf: None,
            light_cache_items: 0,
            dag_gen_loaded: false,
            kheavy_timestamp: 0,
            keryx_daa_score: 0,
            kheavy_matrix_daa: u64::MAX, // force first-job regen
            current_height: 0,
            verus_vkey: None,
            verus_blockhash_half: None,
            verus_scratch: None,
            verus_debug_im: None,
            verus_nonce_space: None,
            progpow_period: 0xFFFFFFFF,
            progpow_dag_elements: 0,
            progpow_g_output,
            kawpow_job_blob,
            kawpow_results,
            kawpow_stop,
        })
    }

    /// Build the Autolykos v2 R-table on device via the `autolykos_precompute`
    /// kernel: `R[j] = takeRight(31, Blake2b256(j_BE4 || height_BE4 || M))`,
    /// stored as 8 big-endian u32 per element. The table depends only on
    /// (height, M) — NOT on the block header — so it is cached per height.
    fn ensure_autolykos_table(&mut self, _header: &[u8], height: u32) -> Result<()> {
        let n = autolykos_table_size_cuda();
        if self.autolykos_table.is_some()
            && self.autolykos_height == height
            && self.autolykos_table_size == n as u32
        {
            return Ok(());
        }

        // M = i64-BE words 0..1024 (8192 bytes), constant per spec.
        if self.autolykos_m_buf.is_none() {
            let mut m = vec![0u8; 8192];
            for i in 0..1024u64 {
                m[i as usize * 8..i as usize * 8 + 8].copy_from_slice(&(i as i64).to_be_bytes());
            }
            self.autolykos_m_buf = Some(
                self.dev
                    .htod_copy(m)
                    .map_err(|e| anyhow::anyhow!("autolykos M upload: {e}"))?,
            );
        }

        // Allocate R-table on device: N elements × 8 u32 (32B each).
        let r_table = self
            .dev
            .alloc_zeros::<u32>(n * 8)
            .map_err(|e| anyhow::anyhow!("autolykos r_table alloc: {e}"))?;

        let func = self
            .dev
            .get_func("autolykos", "autolykos_precompute")
            .ok_or_else(|| anyhow::anyhow!("autolykos_precompute kernel not found"))?;
        let m_buf = self.autolykos_m_buf.as_ref().unwrap();
        let cfg = LaunchConfig {
            grid_dim: ((n as u32).div_ceil(256), 1, 1),
            block_dim: (256, 1, 1),
            shared_mem_bytes: 0,
        };
        unsafe {
            func.clone()
                .launch(cfg, (height, n as u32, m_buf, &r_table))
                .map_err(|e| anyhow::anyhow!("autolykos_precompute launch: {e}"))?;
        }
        self.dev
            .synchronize()
            .map_err(|e| anyhow::anyhow!("autolykos_precompute sync: {e}"))?;

        self.autolykos_table = Some(r_table);
        self.autolykos_table_size = n as u32;
        self.autolykos_height = height;
        Ok(())
    }

    /// Precompute the Verushash key and blockhash_half from the block header,
    /// then upload to GPU. Uses the native-ffi VerusHash CPU implementation
    /// for key generation (haraka256 chain hashing).
    fn ensure_verus_key(&mut self, header: &[u8]) -> Result<()> {
        // The Verushash V2.2 key is derived from the block header via:
        //   1. hash_half: Haraka512 chain → 64-byte intermediate
        //   2. prepare_key: GenNewCLKey from intermediate → 8832-byte key
        //   3. get_gpu_keydata: extract key + blockhash_half
        //
        // This must be called on the mining thread (thread-local state).
        #[cfg(feature = "native-verushash")]
        {
            // Use at most 64 bytes of header for hash_half
            let header_padded = {
                let mut buf = vec![0u8; 64];
                let len = header.len().min(64);
                buf[..len].copy_from_slice(&header[..len]);
                buf
            };
            let intermediate = zion_native_ffi::verushash::hash_half(&header_padded);
            zion_native_ffi::verushash::prepare_key(&intermediate);
            let (key_bytes, blockhash_half_bytes) =
                zion_native_ffi::verushash::get_gpu_keydata()
                    .ok_or_else(|| anyhow::anyhow!("verus key precomputation failed"))?;

            // Upload key as u32 array (552 uint4 = 2208 uint32 = 8832 bytes)
            let key_u32: Vec<u32> = key_bytes
                .chunks_exact(4)
                .map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]]))
                .collect();
            let blockhash_half_u32: Vec<u32> = blockhash_half_bytes
                .chunks_exact(4)
                .map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]]))
                .collect();

            let key_buf = self
                .dev
                .htod_copy(key_u32)
                .map_err(|e| anyhow::anyhow!("verus vkey upload: {e}"))?;
            let blockhash_buf = self
                .dev
                .htod_copy(blockhash_half_u32)
                .map_err(|e| anyhow::anyhow!("verus blockhash_half upload: {e}"))?;

            // Allocate scratch buffer: TOTAL_MAX (4096) * VERUS_KEY_SIZE128 (552) uint4
            // = 4096 * 552 * 4 uint32 = 9,043,968 uint32 = ~36MB
            let scratch_size = 4096 * 552 * 4; // uint32 elements
            let scratch_zeros = vec![0u32; scratch_size];
            let scratch_buf = self
                .dev
                .htod_copy(scratch_zeros)
                .map_err(|e| anyhow::anyhow!("verus scratch alloc: {e}"))?;

            // Default nonceSpace template: 11 zero bytes (en1) + u32 nonce at
            // offset 11 — matches VRSC stratum en1‖nonce layout. A live pool
            // path can overwrite this buffer with the real template.
            let ns_buf = self
                .dev
                .htod_copy(vec![0u32; 4])
                .map_err(|e| anyhow::anyhow!("verus nonce_space upload: {e}"))?;
            self.verus_nonce_space = Some(ns_buf);

            self.verus_vkey = Some(key_buf);
            self.verus_blockhash_half = Some(blockhash_buf);
            self.verus_scratch = Some(scratch_buf);
            Ok(())
        }

        #[cfg(not(feature = "native-verushash"))]
        {
            let _ = header;
            anyhow::bail!(
                "Verushash CUDA kernel requires native-verushash feature for key precomputation"
            )
        }
    }

    /// Ensure the DAG for the current epoch is loaded on the GPU.
    /// Generates the light cache on CPU (~16-100MB, fast), uploads it,
    /// then computes the full DAG (1-6GB) IN PARALLEL ON THE GPU using
    /// the ethash_calculate_dag kernel. No multi-GB CPU→GPU transfer.
    ///
    /// Generated DAGs are persisted to disk so that the next miner startup can
    /// load the DAG from cache instead of regenerating it.  This saves the
    /// ~10 second ProgPoW DAG generation on each restart.  Cache files are
    /// named `$ZION_DAG_CACHE_DIR/{algo}_epoch{epoch}.bin` (default
    /// `~/.zion/dag-cache/`).  Set `ZION_DAG_CACHE_DISABLE=1` to skip cache I/O.
    fn ensure_dag(&mut self, epoch: u32) -> Result<()> {
        if self.dag_epoch == epoch && self.dag_buf.is_some() {
            return Ok(());
        }

        let algo_name = self.algo.module_name();
        let cache_path = Self::dag_cache_path(algo_name, epoch);

        // Try loading a previously generated DAG from disk cache first.
        if Self::dag_cache_enabled() && cache_path.exists() {
            crate::ext_warn!(
                "dag_manager: loading {} DAG epoch={} from disk cache ({})...",
                algo_name,
                epoch,
                cache_path.display()
            );
            match Self::load_dag_from_disk(&cache_path) {
                Ok((dag_u64, dag_size_entries)) => {
                    let dag_bytes = dag_u64.len() * 8;
                    crate::ext_warn!(
                        "dag_manager: uploading {} cached DAG to GPU ({} entries = {:.1} MB)",
                        algo_name,
                        dag_size_entries,
                        dag_bytes as f64 / (1024.0 * 1024.0)
                    );
                    let dag_buf = self
                        .dev
                        .htod_copy(dag_u64)
                        .map_err(|e| anyhow::anyhow!("DAG upload from cache: {e}"))?;
                    self.dag_buf = Some(dag_buf);
                    self.dag_size_entries = dag_size_entries;
                    self.dag_epoch = epoch;
                    self.light_cache_buf = None;
                    self.light_cache_items = 0;
                    crate::ext_warn!(
                        "dag_manager: {} DAG epoch={} ready from disk cache",
                        algo_name,
                        epoch
                    );
                    return Ok(());
                }
                Err(e) => {
                    crate::ext_warn!(
                        "dag_manager: corrupt/mismatched {} DAG cache, deleting and regenerating on GPU: {}",
                        algo_name, e
                    );
                    let _ = std::fs::remove_file(&cache_path);
                }
            }
        }

        crate::ext_warn!(
            "dag_manager: generating {} DAG epoch={} on GPU...",
            algo_name,
            epoch,
        );
        let start = Instant::now();

        // Step 1: Generate light cache on CPU (small, ~16-100MB, fast)
        let cache_bytes = generate_light_cache(epoch);
        let cache_items = cache_bytes.len() / 64;
        let dag_size_entries = dataset_size_for_epoch(epoch) / 128;
        let dag_nodes = dag_size_entries * 2; // each 128-byte entry = 2 nodes
        let dag_u64s = dag_nodes * 8; // each 64-byte node = 8 u64

        crate::ext_warn!(
            "dag_manager: light cache ready ({} items = {:.1} MB), DAG will be {} nodes = {:.2} GB",
            cache_items,
            cache_bytes.len() as f64 / (1024.0 * 1024.0),
            dag_nodes,
            (dag_u64s as f64 * 8.0) / (1024.0 * 1024.0 * 1024.0),
        );

        // Step 2: Convert cache to u64 array and upload to GPU
        let cache_u64s = cache_items * 8;
        let mut cache_u64 = Vec::with_capacity(cache_u64s);
        for i in 0..cache_u64s {
            let off = i * 8;
            cache_u64.push(u64::from_le_bytes(
                cache_bytes[off..off + 8].try_into().unwrap(),
            ));
        }
        let light_cache_buf = self
            .dev
            .htod_copy(cache_u64)
            .map_err(|e| anyhow::anyhow!("light cache upload: {e}"))?;
        self.light_cache_buf = Some(light_cache_buf);
        self.light_cache_items = cache_items as u64;

        // Step 3: Allocate DAG buffer on GPU (zero-initialized)
        crate::ext_warn!(
            "dag_manager: allocating DAG buffer on GPU ({:.2} GB)...",
            (dag_u64s as f64 * 8.0) / (1024.0 * 1024.0 * 1024.0),
        );
        let dag_buf = self
            .dev
            .alloc_zeros::<u64>(dag_u64s as usize)
            .map_err(|e| anyhow::anyhow!("DAG alloc on GPU: {e}"))?;

        // Step 4: Compile and load DAG generation kernel if not already loaded
        if !self.dag_gen_loaded {
            let arch = detect_cuda_arch(&self.dev);
            let processed = preprocess_kernel(ETHASH_DAG_GEN_CU);
            let ptx = compile_ptx_with_opts(
                &processed,
                CompileOptions {
                    options: vec![
                        "--use_fast_math".to_string(),
                        format!("-arch={}", arch),
                        "--std=c++14".to_string(),
                    ],
                    ..Default::default()
                },
            )
            .map_err(|e| anyhow::anyhow!("NVRTC compile failed for dag_gen: {e}"))?;
            self.dev
                .load_ptx(ptx, "dag_gen", &["ethash_calculate_dag"])
                .map_err(|e| anyhow::anyhow!("PTX load failed for dag_gen: {e}"))?;
            self.dag_gen_loaded = true;
        }

        // Step 5: Launch DAG generation kernel in batches
        let dag_gen_func = self
            .dev
            .get_func("dag_gen", "ethash_calculate_dag")
            .ok_or_else(|| anyhow::anyhow!("dag_gen kernel not found"))?;

        let threads_per_block: u32 = 256;
        // Default to 64K nodes per launch (8x the previous 8,192). A larger
        // batch keeps the GPU better occupied and can be tuned via env.
        let batch_nodes: u32 = std::env::var("ZION_AUXPOW_GPU_DAG_BATCH")
            .ok()
            .and_then(|v| v.trim().parse::<u32>().ok())
            .unwrap_or(65_536)
            .max(1_024);
        let light_cache_ref = self.light_cache_buf.as_ref().unwrap();

        crate::ext_warn!(
            "dag_manager: computing DAG on GPU ({} nodes in batches of {})...",
            dag_nodes,
            batch_nodes,
        );

        let mut node_start: u64 = 0;
        while node_start < dag_nodes {
            let chunk = (dag_nodes - node_start).min(batch_nodes as u64);
            let blocks = (chunk as u32).div_ceil(threads_per_block);
            let cfg = LaunchConfig {
                grid_dim: (blocks, 1, 1),
                block_dim: (threads_per_block, 1, 1),
                shared_mem_bytes: 0,
            };

            unsafe {
                dag_gen_func
                    .clone()
                    .launch(
                        cfg,
                        (
                            node_start,
                            light_cache_ref,
                            self.light_cache_items,
                            &dag_buf,
                            dag_nodes,
                        ),
                    )
                    .map_err(|e| anyhow::anyhow!("dag_gen launch: {e}"))?;
            }

            self.dev
                .synchronize()
                .map_err(|e| anyhow::anyhow!("dag_gen sync: {e}"))?;

            node_start += chunk;

            let pct = (node_start * 100 / dag_nodes).min(100);
            if pct.is_multiple_of(10) || node_start == dag_nodes {
                crate::ext_warn!(
                    "dag_manager: DAG generation {}% ({}/{}, {:.1}s)",
                    pct,
                    node_start,
                    dag_nodes,
                    start.elapsed().as_secs_f64(),
                );
            }
        }

        self.dag_buf = Some(dag_buf);
        self.dag_size_entries = dag_size_entries;
        self.dag_epoch = epoch;

        crate::ext_warn!(
            "dag_manager: {} DAG epoch={} ready on GPU ({:.1}s total)",
            algo_name,
            epoch,
            start.elapsed().as_secs_f64(),
        );

        // Persist to disk cache so the next miner start can load the DAG
        // instead of regenerating it.
        if Self::dag_cache_enabled() {
            if let Some(dag_buf) = self.dag_buf.as_ref() {
                if let Err(e) =
                    Self::save_dag_to_disk(&self.dev, &cache_path, dag_buf, self.dag_size_entries)
                {
                    crate::ext_warn!(
                        "dag_manager: failed to save {} DAG disk cache: {}",
                        algo_name,
                        e
                    );
                }
            }
        }

        Ok(())
    }

    /// Recompile the ProgPoW kernel via NVRTC when the period or DAG size changes.
    /// The random math sequence changes every PROGPOW_PERIOD (50) blocks, and
    /// PROGPOW_DAG_ELEMENTS changes when the DAG epoch changes.
    /// Uses the AuXpow codegen to inject random math + data load code into the
    /// CUDA kernel template, then compiles with NVRTC.
    fn ensure_progpow_kernel(&mut self, block_height: u64) -> Result<()> {
        let params = crate::auxpow::progpow_codegen::select_progpow_params(&self.algorithm);
        let period = (block_height / params.period as u64) as u32;
        let dag_elements = if self.dag_buf.is_some() {
            self.dag_size_entries / 2 // PROGPOW_DAG_ELEMENTS = dag_entries / 2
        } else {
            1 // fallback (will be recompiled when DAG is loaded)
        };

        // Check if recompilation is needed
        if self.progpow_period == period && self.progpow_dag_elements == dag_elements {
            return Ok(());
        }

        tlog!(
            "progpow_cuda: recompiling kernel period={} dag_elements={} block_height={}",
            period,
            dag_elements,
            block_height,
        );
        let start = Instant::now();

        // Step 1: Get the base CUDA kernel source
        let base_src = self.algo.kernel_source();

        // Step 2: Inject random math + data loads via codegen.
        // The codegen produces backend-agnostic C code using mul_hi(), clz(),
        // popcount(), ROTL32(), ROTR32() — all mapped to CUDA intrinsics via
        // #defines in the kernel header.
        // PROGPOW_INCLUDE_PROGPOW_LOOP is not in the CUDA template, so the
        // .replace() for it is a no-op (the function-based codegen uses OpenCL
        // constructs that won't compile in CUDA). Only the inline placeholders
        // are present in the CUDA template.
        let prepared_src = if self.algo == CudaExtAlgo::Kawpow {
            crate::auxpow::progpow_codegen::prepare_kawpow_kernel_source_for_algo(
                base_src,
                &self.algorithm,
                block_height,
            )
        } else {
            crate::auxpow::progpow_codegen::prepare_progpow_kernel_source_for_algo(
                base_src,
                &self.algorithm,
                block_height,
            )
        };

        // Step 3: Preprocess (strip #pragma once, #include, fix NVRTC issues)
        let processed = preprocess_kernel(&prepared_src);

        // Debug: dump the preprocessed source for inspection
        let _ = std::fs::write("/tmp/progpow_cuda_source.cu", &processed);

        // Step 4: Compile via NVRTC with PROGPOW_DAG_ELEMENTS define
        let arch = detect_cuda_arch(&self.dev);
        let ptx = compile_ptx_with_opts(
            &processed,
            CompileOptions {
                options: vec![
                    "--use_fast_math".to_string(),
                    format!("-arch={}", arch),
                    "--std=c++14".to_string(),
                    format!("-DPROGPOW_DAG_ELEMENTS={}", dag_elements),
                ],
                ..Default::default()
            },
        )
        .map_err(|e| anyhow::anyhow!("NVRTC compile failed for progpow period={}: {e}", period))?;

        // Step 5: Load the PTX (replaces any previously loaded module)
        let module_name = self.algo.module_name();
        let kernel_name = self.algo.kernel_name();
        self.dev
            .load_ptx(ptx, module_name, &[kernel_name])
            .map_err(|e| anyhow::anyhow!("PTX load failed for progpow period={}: {e}", period))?;

        self.progpow_period = period;
        self.progpow_dag_elements = dag_elements;

        tlog!(
            "progpow_cuda: kernel ready period={} dag_elements={} ({:.1}s)",
            period,
            dag_elements,
            start.elapsed().as_secs_f64(),
        );

        Ok(())
    }

    fn run_kernel(
        &mut self,
        header: &[u8],
        target: &[u8; 32],
        nonce_start: u64,
        batch_size: u64,
    ) -> Result<GpuBatchResult> {
        // Reset found flag and sentinel
        self.dev
            .htod_copy_into(vec![SENTINEL_FOUND], &mut self.found_flag)
            .map_err(|e| anyhow::anyhow!("reset found: {e}"))?;
        self.dev
            .htod_copy_into(vec![SENTINEL_NONCE], &mut self.output_nonce)
            .map_err(|e| anyhow::anyhow!("reset nonce: {e}"))?;

        // Upload header (pad to buffer size — htod_copy_into requires matching lengths)
        let header_len = header.len().min(256);
        let mut header_padded = vec![0u8; 256];
        header_padded[..header_len].copy_from_slice(&header[..header_len]);
        self.dev
            .htod_copy_into(header_padded, &mut self.header_buf)
            .map_err(|e| anyhow::anyhow!("header upload: {e}"))?;

        // Upload target
        self.dev
            .htod_copy_into(target.to_vec(), &mut self.target_buf)
            .map_err(|e| anyhow::anyhow!("target upload: {e}"))?;

        // kHeavyHash: the 64×64 matrix is seeded by the block's pre_pow_hash
        // (rusty-kaspa Matrix::generate) — regenerate + reupload on job change.
        // KeryxHash uses the salted variant (pre_pow_hash XOR salt(daa_score)).
        if matches!(self.algo, CudaExtAlgo::Kheavyhash | CudaExtAlgo::Keryxhash) {
            let mut pp = [0u8; 32];
            let n = header.len().min(32);
            pp[..n].copy_from_slice(&header[..n]);
            let daa = self.keryx_daa_score;
            if pp != self.kheavy_pre_pow || daa != self.kheavy_matrix_daa {
                let matrix = if self.algo == CudaExtAlgo::Keryxhash {
                    let m2d = crate::auxpow::hasher::generate_keryx_matrix(&pp, daa);
                    let mut flat = [0u16; 4096];
                    for i in 0..64 {
                        flat[i * 64..i * 64 + 64].copy_from_slice(&m2d[i]);
                    }
                    flat
                } else {
                    generate_kheavy_matrix_cuda(&pp)
                };
                self.kheavy_matrix = Some(
                    self.dev
                        .htod_copy(matrix.to_vec())
                        .map_err(|e| anyhow::anyhow!("kheavy_matrix upload: {e}"))?,
                );
                self.kheavy_pre_pow = pp;
                self.kheavy_matrix_daa = daa;
            }
        }

        let func = self
            .dev
            .get_func(self.algo.module_name(), self.algo.kernel_name())
            .ok_or_else(|| anyhow::anyhow!("kernel {} not found", self.algo.kernel_name()))?;

        let threads_per_block: u32 = if self.algo == CudaExtAlgo::Verushash {
            128 // Verushash kernel uses __launch_bounds__(128)
        } else if self.algo == CudaExtAlgo::Autolykos {
            64 // autolykos_mine uses __launch_bounds__(64, 4)
        } else if self.algo == CudaExtAlgo::Kawpow {
            // kawpow_kernel.cu sizes __shared__ share[HASHES_PER_GROUP] to
            // GROUP_SIZE/16 with GROUP_SIZE=128 — a 256-thread launch would
            // index group_id 8..15 out of bounds and corrupt c_dag.
            128
        } else {
            // Configurable via ZION_CUDA_BLOCK_SIZE env var.
            // Default 256 (optimal for Ampere/Ada). For Pascal/Turing (GTX 1080, etc.),
            // 128 or 192 may give better occupancy due to smaller register file.
            // The kernel __launch_bounds__(256) allows up to 256; lower values are safe.
            std::env::var("ZION_CUDA_BLOCK_SIZE")
                .ok()
                .and_then(|v| v.trim().parse::<u32>().ok())
                .filter(|&v| v > 0 && v <= 256)
                .unwrap_or(256)
        };
        // Run multiple kernel launches to cover the full batch_size.
        // Each launch covers at most self.work_size nonces.
        let mut total_tested: u64 = 0;
        let mut current_nonce = nonce_start;
        let mut left = batch_size;

        while left > 0 {
            // Verushash per-thread key workspace is capped at TOTAL_MAX=4096
            // threads by the kernel (thread & 0xfff aliases scratch) — never
            // launch more than that in one go.
            let max_chunk = if self.algo == CudaExtAlgo::Verushash {
                4096u32
            } else {
                self.work_size as u32
            };
            let chunk = (left as u32).min(self.work_size as u32).min(max_chunk);
            let blocks = chunk.div_ceil(threads_per_block);
            let cfg = LaunchConfig {
                grid_dim: (blocks, 1, 1),
                block_dim: (threads_per_block, 1, 1),
                shared_mem_bytes: 0,
            };

            unsafe {
                match self.algo {
                    CudaExtAlgo::Kheavyhash | CudaExtAlgo::Keryxhash => {
                        let matrix = self.kheavy_matrix.as_ref().unwrap();
                        func.clone()
                            .launch(
                                cfg,
                                (
                                    &self.header_buf,
                                    self.kheavy_timestamp,
                                    &self.target_buf,
                                    current_nonce,
                                    matrix,
                                    &mut self.output_nonce,
                                    &mut self.output_hash,
                                    &mut self.found_flag,
                                ),
                            )
                            .map_err(|e| anyhow::anyhow!("{} launch: {e}", self.algorithm))?;
                    }
                    CudaExtAlgo::Blake3Alph => {
                        let header_len_u32 = header_len as u32;
                        func.clone()
                            .launch(
                                cfg,
                                (
                                    &self.header_buf,
                                    header_len_u32,
                                    &self.target_buf,
                                    current_nonce,
                                    &mut self.output_nonce,
                                    &mut self.output_hash,
                                    &mut self.found_flag,
                                ),
                            )
                            .map_err(|e| anyhow::anyhow!("blake3_alph launch: {e}"))?;
                    }
                    CudaExtAlgo::Blake3Dcr => {
                        let header_len_u32 = header_len as u32;
                        func.clone()
                            .launch(
                                cfg,
                                (
                                    &self.header_buf,
                                    header_len_u32,
                                    &self.target_buf,
                                    current_nonce,
                                    &mut self.output_nonce,
                                    &mut self.output_hash,
                                    &mut self.found_flag,
                                ),
                            )
                            .map_err(|e| anyhow::anyhow!("blake3_dcr launch: {e}"))?;
                    }
                    CudaExtAlgo::Autolykos => {
                        // autolykos_mine(header, header_len, height, N,
                        //   target, base_nonce, M_raw, r_table,
                        //   output_nonce, output_hash, found)
                        let table = self
                            .autolykos_table
                            .as_ref()
                            .ok_or_else(|| anyhow::anyhow!("autolykos table not generated"))?;
                        let m_buf = self
                            .autolykos_m_buf
                            .as_ref()
                            .ok_or_else(|| anyhow::anyhow!("autolykos M not uploaded"))?;
                        let header_len_u32 = header_len as u32;
                        let height_u32 = self.autolykos_height;
                        let table_size_u32 = self.autolykos_table_size;
                        func.clone()
                            .launch(
                                cfg,
                                (
                                    &self.header_buf,
                                    header_len_u32,
                                    height_u32,
                                    table_size_u32,
                                    &self.target_buf,
                                    current_nonce,
                                    m_buf,
                                    table,
                                    &mut self.output_nonce,
                                    &mut self.output_hash,
                                    &mut self.found_flag,
                                ),
                            )
                            .map_err(|e| anyhow::anyhow!("autolykos launch: {e}"))?;
                    }
                    CudaExtAlgo::Zelhash => {
                        let header_len_u32 = header_len as u32;
                        func.clone()
                            .launch(
                                cfg,
                                (
                                    &self.header_buf,
                                    header_len_u32,
                                    &self.target_buf,
                                    current_nonce,
                                    &mut self.output_nonce,
                                    &mut self.output_hash,
                                    &mut self.output_solution,
                                    &mut self.found_flag,
                                ),
                            )
                            .map_err(|e| anyhow::anyhow!("zelhash launch: {e}"))?;
                    }
                    CudaExtAlgo::Ethash => {
                        let dag = self
                            .dag_buf
                            .as_ref()
                            .ok_or_else(|| anyhow::anyhow!("ethash DAG not loaded"))?;
                        let dag_size = self.dag_size_entries;
                        func.clone()
                            .launch(
                                cfg,
                                (
                                    &self.header_buf,
                                    &self.target_buf,
                                    current_nonce,
                                    1u64, // stride
                                    dag,
                                    dag_size,
                                    &mut self.output_nonce,
                                    &mut self.output_hash,
                                    &mut self.output_mix,
                                    &mut self.found_flag,
                                ),
                            )
                            .map_err(|e| anyhow::anyhow!("ethash launch: {e}"))?;
                    }
                    CudaExtAlgo::Kawpow => {
                        let dag = self
                            .dag_buf
                            .as_ref()
                            .ok_or_else(|| anyhow::anyhow!("kawpow DAG not loaded"))?;
                        let job_blob = self
                            .kawpow_job_blob
                            .as_mut()
                            .ok_or_else(|| anyhow::anyhow!("kawpow job_blob not allocated"))?;
                        let results = self
                            .kawpow_results
                            .as_mut()
                            .ok_or_else(|| anyhow::anyhow!("kawpow results not allocated"))?;
                        let stop = self
                            .kawpow_stop
                            .as_mut()
                            .ok_or_else(|| anyhow::anyhow!("kawpow stop not allocated"))?;

                        // Build job_blob: header[32] + nonce[8] = 40 bytes = 10 uint32
                        // The kernel adds gid to job_blob[8], so we put base_nonce there.
                        let mut blob = [0u32; 10];
                        for i in 0..8 {
                            blob[i] = u32::from_le_bytes([
                                header[i * 4],
                                header[i * 4 + 1],
                                header[i * 4 + 2],
                                header[i * 4 + 3],
                            ]);
                        }
                        blob[8] = (current_nonce & 0xFFFFFFFF) as u32;
                        blob[9] = (current_nonce >> 32) as u32;
                        self.dev
                            .htod_copy_into(blob.to_vec(), job_blob)
                            .map_err(|e| anyhow::anyhow!("kawpow job_blob upload: {e}"))?;

                        // Reset results and stop buffers
                        self.dev
                            .htod_copy_into(vec![0u32; 16], results)
                            .map_err(|e| anyhow::anyhow!("kawpow results reset: {e}"))?;
                        self.dev
                            .htod_copy_into(vec![0u32; 2], stop)
                            .map_err(|e| anyhow::anyhow!("kawpow stop reset: {e}"))?;

                        // Convert 32-byte big-endian target to u64
                        let target_u64 = u64::from_be_bytes([
                            target[0], target[1], target[2], target[3], target[4], target[5],
                            target[6], target[7],
                        ]);
                        let hack_false: u32 = 0;
                        func.clone()
                            .launch(
                                cfg,
                                (
                                    dag,
                                    job_blob,
                                    target_u64,
                                    hack_false,
                                    results,
                                    stop,
                                    &mut self.output_nonce,
                                    &mut self.output_mix,
                                    &mut self.found_flag,
                                    &mut self.output_hash,
                                ),
                            )
                            .map_err(|e| anyhow::anyhow!("kawpow launch: {e}"))?;
                    }
                    CudaExtAlgo::Progpow => {
                        let dag = self
                            .dag_buf
                            .as_ref()
                            .ok_or_else(|| anyhow::anyhow!("progpow DAG not loaded"))?;
                        // Convert 32-byte big-endian target to u64 (first 8 bytes)
                        let target_u64 = u64::from_be_bytes([
                            target[0], target[1], target[2], target[3], target[4], target[5],
                            target[6], target[7],
                        ]);
                        let g_output = self
                            .progpow_g_output
                            .as_mut()
                            .ok_or_else(|| anyhow::anyhow!("progpow g_output not allocated"))?;
                        // Reset g_output[0] (solution counter)
                        self.dev
                            .htod_copy_into(vec![0u32; 18], g_output)
                            .map_err(|e| anyhow::anyhow!("progpow g_output reset: {e}"))?;
                        let hack_false: u32 = 0;
                        func.clone()
                            .launch(
                                cfg,
                                (
                                    g_output,
                                    &self.header_buf,
                                    dag,
                                    current_nonce,
                                    target_u64,
                                    hack_false,
                                    &mut self.output_nonce,
                                    &mut self.output_mix,
                                    &mut self.found_flag,
                                    &mut self.output_hash,
                                ),
                            )
                            .map_err(|e| anyhow::anyhow!("progpow launch: {e}"))?;
                    }
                    CudaExtAlgo::Verushash => {
                        let vkey = self
                            .verus_vkey
                            .as_ref()
                            .ok_or_else(|| anyhow::anyhow!("verus vkey not precomputed"))?;
                        let blockhash_half = self
                            .verus_blockhash_half
                            .as_ref()
                            .ok_or_else(|| anyhow::anyhow!("verus blockhash_half not set"))?;
                        let scratch = self
                            .verus_scratch
                            .as_ref()
                            .ok_or_else(|| anyhow::anyhow!("verus scratch not allocated"))?;
                        let nonce_space = self
                            .verus_nonce_space
                            .as_ref()
                            .ok_or_else(|| anyhow::anyhow!("verus nonce_space not set"))?;
                        if self.verus_debug_im.is_none() {
                            let dbg = std::env::var("ZION_VERUS_DEBUG")
                                .map(|v| v == "1")
                                .unwrap_or(false);
                            let buf = self
                                .dev
                                .alloc_zeros::<u64>(if dbg { 4096 } else { 0 })
                                .map_err(|e| anyhow::anyhow!("verus debug alloc: {e}"))?;
                            self.verus_debug_im = Some(buf);
                        }
                        let debug_im = self.verus_debug_im.as_ref().unwrap();
                        func.clone()
                            .launch(
                                cfg,
                                (
                                    vkey,
                                    blockhash_half,
                                    nonce_space,
                                    11u32, // ns_off: nonce u32 at bytes 11..14
                                    &self.target_buf,
                                    scratch,
                                    current_nonce,
                                    &mut self.output_nonce,
                                    &mut self.output_hash,
                                    &mut self.found_flag,
                                    debug_im,
                                ),
                            )
                            .map_err(|e| anyhow::anyhow!("verushash launch: {e}"))?;
                    }
                }
            }

            total_tested += chunk as u64;
            current_nonce += chunk as u64;
            left = left.saturating_sub(chunk as u64);
        }

        // Single sync point: wait for ALL chunks to complete
        self.dev
            .synchronize()
            .map_err(|e| anyhow::anyhow!("device sync: {e}"))?;

        if self.algo == CudaExtAlgo::Verushash
            && std::env::var("ZION_VERUS_DEBUG").ok().as_deref() == Some("1")
        {
            if let Some(buf) = self.verus_debug_im.as_ref() {
                if let Ok(ims) = self.dev.dtoh_sync_copy(buf) {
                    let dump: Vec<String> = ims
                        .iter()
                        .take(64)
                        .enumerate()
                        .map(|(i, v)| format!("{i}:{v:016x}"))
                        .collect();
                    eprintln!("VERUS_IM {}", dump.join(" "));
                }
            }
        }

        let found_host = self
            .dev
            .dtoh_sync_copy(&self.found_flag)
            .map_err(|e| anyhow::anyhow!("found download: {e}"))?;

        if found_host[0] != 0 {
            let nonce_host = self
                .dev
                .dtoh_sync_copy(&self.output_nonce)
                .map_err(|e| anyhow::anyhow!("nonce download: {e}"))?;
            let hash_host = self
                .dev
                .dtoh_sync_copy(&self.output_hash)
                .map_err(|e| anyhow::anyhow!("hash download: {e}"))?;
            let mut hash = [0u8; 32];
            hash.copy_from_slice(&hash_host);

            // Read mix hash for ethash/kawpow/progpow (needed for pool submission)
            let mix_hash = if self.algo == CudaExtAlgo::Ethash
                || self.algo == CudaExtAlgo::Kawpow
                || self.algo == CudaExtAlgo::Progpow
            {
                let mix_host = self
                    .dev
                    .dtoh_sync_copy(&self.output_mix)
                    .map_err(|e| anyhow::anyhow!("mix download: {e}"))?;
                let mut mix = [0u8; 32];
                mix.copy_from_slice(&mix_host);
                Some(mix)
            } else {
                None
            };

            // ProgPoW debug: read g_output[10..17] for seed, final hash, initial seed, header
            if self.algo == CudaExtAlgo::Progpow {
                if let Some(g_out) = &self.progpow_g_output {
                    if let Ok(g_host) = self.dev.dtoh_sync_copy(g_out) {
                        if g_host.len() >= 18 {
                            let cuda_seed = (g_host[10] as u64) | ((g_host[11] as u64) << 32);
                            let cuda_final = (g_host[12] as u64) | ((g_host[13] as u64) << 32);
                            let cuda_initial_seed =
                                (g_host[14] as u64) | ((g_host[15] as u64) << 32);
                            let cuda_hdr0 = g_host[16];
                            let cuda_hdr1 = g_host[17];
                            tlog!(
                                "cuda_progpow_debug nonce={} cuda_seed=0x{:016x} cuda_final_u64=0x{:016x} initial_seed=0x{:016x} hdr0=0x{:08x} hdr1=0x{:08x}",
                                nonce_host[0],
                                cuda_seed,
                                cuda_final,
                                cuda_initial_seed,
                                cuda_hdr0,
                                cuda_hdr1,
                            );
                        }
                    }
                }
            }

            // ZelHash (Equihash 125,4) writes a 52-byte solution to output_solution.
            let solution_blob = if self.algo == CudaExtAlgo::Zelhash {
                let sol_host = self
                    .dev
                    .dtoh_sync_copy(&self.output_solution)
                    .map_err(|e| anyhow::anyhow!("zelhash solution download: {e}"))?;
                Some(sol_host)
            } else {
                None
            };

            Ok(GpuBatchResult {
                solutions: vec![(nonce_host[0], hash, mix_hash)],
                solution_blob,
                nonces_tested: total_tested,
                device_name: self.device_name_cached.clone(),
            })
        } else {
            Ok(GpuBatchResult {
                solutions: Vec::new(),
                solution_blob: None,
                nonces_tested: total_tested,
                device_name: self.device_name_cached.clone(),
            })
        }
    }
}

impl CudaExternalMiner {
    /// Return the configured DAG disk cache directory.
    /// `$ZION_DAG_CACHE_DIR` or `~/.zion/dag-cache` by default.
    fn dag_cache_dir() -> PathBuf {
        std::env::var("ZION_DAG_CACHE_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
                PathBuf::from(home).join(".zion").join("dag-cache")
            })
    }

    /// Return whether DAG disk caching is enabled.
    /// Set `ZION_DAG_CACHE_DISABLE=1` to opt out.
    fn dag_cache_enabled() -> bool {
        std::env::var("ZION_DAG_CACHE_DISABLE")
            .ok()
            .map(|v| v.trim() != "1" && v.trim().to_lowercase() != "true")
            .unwrap_or(true)
    }

    /// Cache file path for a given algorithm and epoch.
    fn dag_cache_path(algo: &str, epoch: u32) -> PathBuf {
        Self::dag_cache_dir().join(format!("{}_epoch{}.bin", algo, epoch))
    }

    /// Load a DAG from a disk cache file.
    /// File layout: 8 bytes little-endian `dag_size_entries`, then the DAG data
    /// as little-endian u64 words (128 bytes = 16 u64 per entry).
    fn load_dag_from_disk(path: &Path) -> Result<(Vec<u64>, u64)> {
        let metadata = std::fs::metadata(path)
            .map_err(|e| anyhow::anyhow!("failed to stat DAG cache {}: {e}", path.display()))?;
        let total_bytes = metadata.len() as usize;
        if total_bytes < 8 {
            return Err(anyhow::anyhow!(
                "DAG cache file too small: {} bytes",
                total_bytes
            ));
        }
        let data_bytes = total_bytes - 8;
        if data_bytes % 8 != 0 {
            return Err(anyhow::anyhow!(
                "DAG cache data size is not a multiple of 8: {}",
                data_bytes
            ));
        }

        let file = std::fs::File::open(path)
            .map_err(|e| anyhow::anyhow!("failed to open DAG cache {}: {e}", path.display()))?;
        let mut reader = BufReader::with_capacity(8 * 1024 * 1024, file);

        let mut header = [0u8; 8];
        reader
            .read_exact(&mut header)
            .map_err(|e| anyhow::anyhow!("failed to read DAG cache header: {e}"))?;
        let dag_size_entries = u64::from_le_bytes(header);

        let expected_data_bytes = (dag_size_entries as u128)
            .checked_mul(128)
            .ok_or_else(|| anyhow::anyhow!("DAG entries count overflow: {}", dag_size_entries))?;
        if expected_data_bytes as usize != data_bytes {
            return Err(anyhow::anyhow!(
                "DAG cache size mismatch: header says {} entries ({} bytes), file has {} bytes",
                dag_size_entries,
                expected_data_bytes,
                data_bytes
            ));
        }

        let u64_count = data_bytes / 8;
        let chunk_u64s = 1024 * 1024; // 1M u64s = 8 MB
        let mut chunk_bytes = vec![0u8; chunk_u64s * 8];
        let mut dag_u64 = Vec::with_capacity(u64_count);

        let start = Instant::now();
        let mut remaining = u64_count;
        while remaining > 0 {
            let n = remaining.min(chunk_u64s);
            reader
                .read_exact(&mut chunk_bytes[..n * 8])
                .map_err(|e| anyhow::anyhow!("failed to read DAG cache data: {e}"))?;
            for i in 0..n {
                dag_u64.push(u64::from_le_bytes(
                    chunk_bytes[i * 8..i * 8 + 8].try_into().unwrap(),
                ));
            }
            remaining -= n;
        }

        crate::ext_warn!(
            "dag_manager: loaded DAG from {} ({:.1}s)",
            path.display(),
            start.elapsed().as_secs_f64()
        );
        Ok((dag_u64, dag_size_entries))
    }

    /// Save a GPU-resident DAG to disk cache.
    /// Downloads the DAG to host memory, then writes it using a buffered
    /// little-endian u64 layout.  Set `ZION_DAG_CACHE_DISABLE=1` to skip.
    fn save_dag_to_disk(
        dev: &Arc<CudaDevice>,
        path: &Path,
        dag_buf: &CudaSlice<u64>,
        dag_size_entries: u64,
    ) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| anyhow::anyhow!("failed to create DAG cache dir: {e}"))?;
        }

        let start = Instant::now();
        crate::ext_warn!(
            "dag_manager: downloading {} DAG from GPU for disk cache ({} entries)...",
            path.display(),
            dag_size_entries
        );
        let dag_u64 = dev
            .dtoh_sync_copy(dag_buf)
            .map_err(|e| anyhow::anyhow!("DAG download for disk cache: {e}"))?;

        let expected_u64s = (dag_size_entries as u128)
            .checked_mul(16)
            .ok_or_else(|| anyhow::anyhow!("DAG entries count overflow: {}", dag_size_entries))?;
        if dag_u64.len() as u128 != expected_u64s {
            return Err(anyhow::anyhow!(
                "DAG buffer size mismatch: expected {} u64s, got {}",
                expected_u64s,
                dag_u64.len()
            ));
        }

        let file = std::fs::File::create(path)
            .map_err(|e| anyhow::anyhow!("failed to create DAG cache {}: {e}", path.display()))?;
        let mut writer = BufWriter::with_capacity(8 * 1024 * 1024, file);

        // Header: dag_size_entries (u64 LE)
        writer
            .write_all(&dag_size_entries.to_le_bytes())
            .map_err(|e| anyhow::anyhow!("failed to write DAG cache header: {e}"))?;

        // Data: u64 words in little-endian, written in 8 MB chunks.
        let chunk_u64s = 1024 * 1024; // 1M u64s = 8 MB
        let mut chunk_bytes = vec![0u8; chunk_u64s * 8];
        let mut written = 0usize;
        while written < dag_u64.len() {
            let n = (dag_u64.len() - written).min(chunk_u64s);
            for i in 0..n {
                chunk_bytes[i * 8..i * 8 + 8].copy_from_slice(&dag_u64[written + i].to_le_bytes());
            }
            writer
                .write_all(&chunk_bytes[..n * 8])
                .map_err(|e| anyhow::anyhow!("failed to write DAG cache data: {e}"))?;
            written += n;
        }

        writer
            .flush()
            .map_err(|e| anyhow::anyhow!("failed to flush DAG cache: {e}"))?;

        crate::ext_warn!(
            "dag_manager: saved DAG cache to {} ({:.1}s)",
            path.display(),
            start.elapsed().as_secs_f64()
        );
        Ok(())
    }
}

impl GpuMiner for CudaExternalMiner {
    fn device_name(&self) -> String {
        self.device_name_cached.clone()
    }

    fn backend_kind(&self) -> GpuBackendKind {
        GpuBackendKind::Cuda
    }

    fn algorithm(&self) -> String {
        self.algorithm.clone()
    }

    fn update_epoch(&mut self, height: u64) -> Result<()> {
        self.current_height = height;
        if self.algo.needs_dag() {
            let epoch = (height / self.algo.epoch_length() as u64) as u32;
            self.ensure_dag(epoch)?;
        }
        // ProgPoW: recompile kernel when period or DAG size changes
        if self.algo.needs_period_recompile() {
            self.ensure_progpow_kernel(height)?;
        }
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

        if matches!(self.algo, CudaExtAlgo::Kheavyhash | CudaExtAlgo::Keryxhash) {
            let pre_pow_hash = &header_bytes[..32];
            self.kheavy_timestamp = header.timestamp;
            // MiningHeader has no DAA field — default to the current mainnet
            // salt (v4) for keryx, matching the OpenCL extra.len()<16 default.
            self.keryx_daa_score = crate::auxpow::hasher::KERYX_SALT_V4_ACTIVATION_DAA;
            return self.run_kernel(pre_pow_hash, &target.bytes, nonce_start, batch_size);
        }

        if self.algo == CudaExtAlgo::Autolykos {
            let height = header.timestamp as u32;
            self.ensure_autolykos_table(&header_bytes, height)?;
        }

        // Verushash: precompute key from block header
        if self.algo == CudaExtAlgo::Verushash {
            self.ensure_verus_key(&header_bytes)?;
        }

        // Ethash/Kawpow/Progpow: header is 32-byte block header hash, epoch from height
        if self.algo.needs_dag() {
            // NOTE: update_epoch(height) is called by the external GPU thread
            // before mine_batch, which loads the correct DAG for the block's
            // epoch and recompiles the ProgPoW kernel if the period changed.
            // Do NOT recompute epoch from header.timestamp here — for
            // external ethash/kawpow/progpow jobs, the header is just a 32-byte
            // hash padded to 80 bytes, so timestamp=0 → epoch=0, which would
            // overwrite the correct DAG with the wrong one.
            // Only call ensure_dag if no DAG is loaded yet (e.g. benchmark).
            if self.dag_epoch == 0xFFFFFFFF {
                self.ensure_dag(0)?;
            }
            // ProgPoW: compile kernel if not yet compiled (first run)
            if self.algo.needs_period_recompile() && self.progpow_period == 0xFFFFFFFF {
                self.ensure_progpow_kernel(0)?;
            }
            // For ethash/kawpow/progpow, only the first 32 bytes (header hash) are used
            let header_hash = &header_bytes[..32.min(header_bytes.len())];
            return self.run_kernel(header_hash, &target.bytes, nonce_start, batch_size);
        }

        self.run_kernel(&header_bytes, &target.bytes, nonce_start, batch_size)
    }

    fn mine_batch_raw(
        &mut self,
        raw_header: &[u8],
        target: DifficultyTarget,
        nonce_start: u64,
        batch_size: u64,
    ) -> Result<GpuBatchResult> {
        if matches!(self.algo, CudaExtAlgo::Kheavyhash | CudaExtAlgo::Keryxhash) {
            let pre_pow_hash = &raw_header[..32.min(raw_header.len())];
            // For live KaspaStratum the raw header is the 32-byte pre_pow_hash
            // followed by the 8-byte little-endian block timestamp.
            self.kheavy_timestamp = if raw_header.len() >= 40 {
                u64::from_le_bytes(raw_header[32..40].try_into().unwrap_or([0u8; 8]))
            } else {
                0
            };
            // KeryxHash: raw_header[40..48] carries the DAA score (same layout
            // as the OpenCL `extra` buffer); absent → current mainnet salt v4.
            self.keryx_daa_score = if raw_header.len() >= 48 {
                u64::from_le_bytes(raw_header[40..48].try_into().unwrap_or([0u8; 8]))
            } else {
                crate::auxpow::hasher::KERYX_SALT_V4_ACTIVATION_DAA
            };
            return self.run_kernel(pre_pow_hash, &target.bytes, nonce_start, batch_size);
        }

        if self.algo == CudaExtAlgo::Autolykos {
            let height = self.current_height as u32;
            self.ensure_autolykos_table(raw_header, height)?;
        }

        // Verushash: precompute key from raw header
        if self.algo == CudaExtAlgo::Verushash {
            self.ensure_verus_key(raw_header)?;
        }

        // Ethash/Kawpow/Progpow: use the DAG already loaded by update_epoch().
        // Only load epoch-0 DAG if none is loaded yet (e.g. benchmark mode).
        // Calling ensure_dag(0) unconditionally would overwrite the real DAG
        // (e.g. epoch 126) with a dummy epoch-0 DAG → wrong mix_hash → rejected.
        if self.algo.needs_dag() {
            if self.dag_epoch == 0xFFFFFFFF {
                self.ensure_dag(0)?;
            }
            if self.algo.needs_period_recompile() && self.progpow_period == 0xFFFFFFFF {
                self.ensure_progpow_kernel(0)?;
            }
            let header_hash = &raw_header[..32.min(raw_header.len())];
            return self.run_kernel(header_hash, &target.bytes, nonce_start, batch_size);
        }

        self.run_kernel(raw_header, &target.bytes, nonce_start, batch_size)
    }

    fn benchmark(&mut self, secs: f64) -> Result<(u64, f64, f64)> {
        // For DAG-based algorithms, use mine_batch_raw which calls ensure_dag(0)
        if self.algo.needs_dag() {
            self.ensure_dag(0)?;
            // ProgPoW: also compile the kernel for period 0
            if self.algo.needs_period_recompile() {
                self.ensure_progpow_kernel(0)?;
            }
            let start = Instant::now();
            let mut total: u64 = 0;
            let mut nonce: u64 = 0;
            let header = [0xAAu8; 32];
            let target = DifficultyTarget {
                bytes: [0xFFu8; 32],
            };
            while start.elapsed().as_secs_f64() < secs {
                let result =
                    self.run_kernel(&header, &target.bytes, nonce, self.work_size as u64)?;
                total += result.nonces_tested;
                nonce = nonce.wrapping_add(self.work_size as u64);
            }
            let elapsed = start.elapsed().as_secs_f64();
            let hps = if elapsed > 0.0 {
                total as f64 / elapsed
            } else {
                0.0
            };
            return Ok((total, elapsed, hps));
        }

        let start = Instant::now();
        let mut total: u64 = 0;
        let mut nonce: u64 = 0;
        let header = MiningHeader {
            version: 3,
            previous_hash: [0xAA; 32],
            merkle_root: [0xBB; 32],
            timestamp: 1_762_000_200,
            difficulty_bits: 0x1f00ffff,
        };
        let target = DifficultyTarget {
            bytes: [0xFFu8; 32],
        };
        while start.elapsed().as_secs_f64() < secs {
            let result = self.mine_batch(header, target, nonce, self.work_size as u64)?;
            total += result.nonces_tested;
            nonce = nonce.wrapping_add(self.work_size as u64);
        }
        let elapsed = start.elapsed().as_secs_f64();
        let hps = if elapsed > 0.0 {
            total as f64 / elapsed
        } else {
            0.0
        };
        Ok((total, elapsed, hps))
    }
}

// ── Host-side helper functions ─────────────────────────────────────────────

/// Generate the 64x64 kHeavyHash matrix (4096 u16 values) seeded by the
/// block's `pre_pow_hash` — matches rusty-kaspa `Matrix::generate`.
fn generate_kheavy_matrix_cuda(pre_pow_hash: &[u8; 32]) -> [u16; 4096] {
    let mut rng = XoShiRo256PlusPlus::new(*pre_pow_hash);
    loop {
        let mut mat = [[0u16; 64]; 64];
        for row in &mut mat {
            let mut val = 0u64;
            for (j, elem) in row.iter_mut().enumerate() {
                let shift = j % 16;
                if shift == 0 {
                    val = rng.next();
                }
                *elem = ((val >> (4 * shift)) & 0x0F) as u16;
            }
        }
        if compute_rank_64(&mat) == 64 {
            let mut flat = [0u16; 4096];
            for i in 0..64 {
                for j in 0..64 {
                    flat[i * 64 + j] = mat[i][j];
                }
            }
            return flat;
        }
    }
}

fn autolykos_table_size_cuda() -> usize {
    std::env::var("ZION_AUTOLYKOS_TABLE_SIZE")
        .ok()
        .and_then(|v| v.trim().parse::<usize>().ok())
        .unwrap_or(1 << 23)
}

// ── XoShiRo256++ PRNG ──────────────────────────────────────────────────────

struct XoShiRo256PlusPlus {
    state: [u64; 4],
}

impl XoShiRo256PlusPlus {
    fn new(seed: [u8; 32]) -> Self {
        let mut s = [0u64; 4];
        for i in 0..4 {
            s[i] = u64::from_le_bytes(seed[i * 8..(i + 1) * 8].try_into().unwrap());
        }
        if s.iter().all(|&x| x == 0) {
            // xoshiro256++ degenerates on an all-zero state (next() = 0
            // forever) — generate_kheavy_matrix_cuda would retry the rank
            // check forever. Same guard as hasher.rs / the C FFI copies.
            s[0] = 0x9E37_79B9_7F4A_7C15;
        }
        Self { state: s }
    }

    fn next(&mut self) -> u64 {
        let result =
            Self::rotl(self.state[0].wrapping_add(self.state[3]), 23).wrapping_add(self.state[0]);
        let t = self.state[1] << 17;
        self.state[2] ^= self.state[0];
        self.state[3] ^= self.state[1];
        self.state[1] ^= self.state[2];
        self.state[0] ^= self.state[3];
        self.state[2] ^= t;
        self.state[3] = Self::rotl(self.state[3], 45);
        result
    }

    fn rotl(x: u64, k: u32) -> u64 {
        x.rotate_left(k)
    }
}

/// Compute the rank of a 64×64 matrix over the reals via Gaussian
/// elimination — matches rusty-kaspa `Matrix::compute_rank`.
fn compute_rank_64(mat: &[[u16; 64]; 64]) -> usize {
    const EPS: f64 = 1e-9;
    let mut m = [[0.0f64; 64]; 64];
    for i in 0..64 {
        for j in 0..64 {
            m[i][j] = mat[i][j] as f64;
        }
    }
    let mut rank = 0;
    let mut row_selected = [false; 64];
    for i in 0..64 {
        let mut j = 0;
        while j < 64 {
            if !row_selected[j] && m[j][i].abs() > EPS {
                break;
            }
            j += 1;
        }
        if j != 64 {
            rank += 1;
            row_selected[j] = true;
            for p in (i + 1)..64 {
                m[j][p] /= m[j][i];
            }
            for k in 0..64 {
                if k != j && m[k][i].abs() > EPS {
                    for p in (i + 1)..64 {
                        m[k][p] -= m[j][p] * m[k][i];
                    }
                }
            }
        }
    }
    rank
}

// ── Ethash/Kawpow DAG generation (CPU-side) ────────────────────────────────
//
// These functions implement the Ethash light cache + full DAG generation
// in pure Rust, matching the algorithm in AuXpow/src/native_ffi.rs.
// The DAG is generated on the CPU and uploaded to the GPU as a u64 buffer.

const DAG_CACHE_ROUNDS: usize = 3;

const CACHE_BYTES_INIT: u64 = 1 << 24; // 16 MB
const CACHE_BYTES_GROWTH: u64 = 1 << 17; // 128 KB
const HASH_BYTES: u64 = 64;
const DATASET_BYTES_INIT: u64 = 1 << 30; // 1 GB
const DATASET_BYTES_GROWTH: u64 = 1 << 23; // 8 MB
const MIX_BYTES: u64 = 128;

/// Primality test for u64 using trial division (sufficient for cache/dataset
/// item counts, which are < 2^64 and whose square roots are small).
fn is_prime_u64(n: u64) -> bool {
    if n < 2 {
        return false;
    }
    if n.is_multiple_of(2) {
        return n == 2;
    }
    if n.is_multiple_of(3) {
        return n == 3;
    }
    let mut i = 5u64;
    while i * i <= n {
        if n.is_multiple_of(i) || n.is_multiple_of(i + 2) {
            return false;
        }
        i += 6;
    }
    true
}

/// Compute the cache size for a given epoch.
///
/// Follows the Ethash/ProgPoW spec: linear growth rounded down to the largest
/// size whose number of 64-byte items is prime.
pub(crate) fn cache_size_for_epoch(epoch: u32) -> u64 {
    let mut items =
        (CACHE_BYTES_INIT + (epoch as u64) * CACHE_BYTES_GROWTH - HASH_BYTES) / HASH_BYTES;
    while !is_prime_u64(items) {
        items = items.saturating_sub(2).max(1);
    }
    items * HASH_BYTES
}

/// Compute the dataset (DAG) size for a given epoch.
///
/// Follows the Ethash/ProgPoW spec: linear growth rounded down to the largest
/// size whose number of 128-byte items is prime.
pub(crate) fn dataset_size_for_epoch(epoch: u32) -> u64 {
    let mut items =
        (DATASET_BYTES_INIT + (epoch as u64) * DATASET_BYTES_GROWTH - MIX_BYTES) / MIX_BYTES;
    while !is_prime_u64(items) {
        items = items.saturating_sub(2).max(1);
    }
    items * MIX_BYTES
}

/// Compute the seed hash for an epoch by keccak-256 chaining.
fn seed_hash_for_epoch(epoch: u32) -> [u8; 32] {
    use sha3::{Digest, Keccak256};
    let mut seed = [0u8; 32];
    for _ in 0..epoch {
        let mut hasher = Keccak256::new();
        hasher.update(seed);
        seed = hasher.finalize().into();
    }
    seed
}

/// Generate the Ethash/Kawpow light cache for a given epoch.
/// Returns a Vec<u8> of size cache_size_for_epoch(epoch).
pub(crate) fn generate_light_cache(epoch: u32) -> Vec<u8> {
    use sha3::{Digest, Keccak512};

    let cache_size = cache_size_for_epoch(epoch) as usize;
    let cache_items = cache_size / 64;
    let seed = seed_hash_for_epoch(epoch);

    let mut cache = vec![0u8; cache_size];

    // First item = keccak512(seed)
    {
        let mut hasher = Keccak512::new();
        hasher.update(seed);
        let hash = hasher.finalize();
        cache[..64].copy_from_slice(&hash);
    }

    // Chain: each item = keccak512(prev_item)
    for i in 1..cache_items {
        let mut hasher = Keccak512::new();
        hasher.update(&cache[(i - 1) * 64..i * 64]);
        let hash = hasher.finalize();
        cache[i * 64..(i + 1) * 64].copy_from_slice(&hash);
    }

    // RANDMEMOHASH mixing rounds
    for _r in 0..DAG_CACHE_ROUNDS {
        for i in 0..cache_items {
            let v = u32::from_le_bytes([
                cache[i * 64],
                cache[i * 64 + 1],
                cache[i * 64 + 2],
                cache[i * 64 + 3],
            ]) % cache_items as u32;
            let prev = (i + cache_items - 1) % cache_items;

            let mut tmp = [0u8; 64];
            for j in 0..64 {
                tmp[j] = cache[prev * 64 + j] ^ cache[v as usize * 64 + j];
            }

            let mut hasher = Keccak512::new();
            hasher.update(tmp);
            let hash = hasher.finalize();
            cache[i * 64..(i + 1) * 64].copy_from_slice(&hash);
        }
    }

    cache
}

/// FNV-1a hash for u32 pairs (used in light cache generation only).
fn fnv1a_u32(a: u32, b: u32) -> u32 {
    a.wrapping_mul(0x01000193) ^ b
}
