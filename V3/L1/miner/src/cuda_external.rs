/// CUDA miner for external AuxPoW algorithms (kheavyhash, blake3, autolykos, zelhash).
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
///
/// Ethash/KawPow/ProgPow still fall back to CPU (DAG management is complex
/// and those coins are less profitable on RTX 3090 vs dedicated ASICs).

use anyhow::{Context, Result};
use cudarc::driver::{CudaDevice, CudaSlice, LaunchAsync, LaunchConfig};
use cudarc::nvrtc::{compile_ptx_with_opts, CompileOptions};
use std::sync::Arc;
use std::time::Instant;

use crate::gpu_backend::{GpuBatchResult, GpuMiner, GpuBackendKind};
use zion_core::{DifficultyTarget, MiningHeader};

const SENTINEL_NONCE: u64 = 0xFFFF_FFFF_FFFF_FFFF;
const SENTINEL_FOUND: u32 = 0;

// Kernel sources — included at compile time from AuXpow/csrc/cuda/
const KHEAVYHASH_CU: &str = include_str!("../../../../AuXpow/csrc/cuda/kheavyhash_kernel.cu");
const BLAKE3_CU: &str = include_str!("../../../../AuXpow/csrc/cuda/blake3_kernel.cu");
const AUTOLYKOS_CU: &str = include_str!("../../../../AuXpow/csrc/cuda/autolykos_kernel.cu");
const ZELHASH_CU: &str = include_str!("../../../../AuXpow/csrc/cuda/zelhash_kernel.cu");

/// Preprocess kernel source: strip #pragma once and #include lines,
/// prepend standard typedefs, fix NVRTC-incompatible constructs.
fn preprocess_kernel(src: &str) -> String {
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
        // Remove __constant__ from function parameters and local variables.
        let line = line
            .replace(
                "__constant__ const unsigned char *custom",
                "const unsigned char *custom",
            )
            .replace(
                "__constant__ const unsigned char *s =",
                "const unsigned char *s =",
            );
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
}

impl CudaExtAlgo {
    pub fn from_name(algorithm: &str) -> Option<Self> {
        match algorithm {
            "kheavyhash" | "kheavyhash_kas" => Some(Self::Kheavyhash),
            "blake3" | "blake3_alph" => Some(Self::Blake3Alph),
            "blake3_dcr" => Some(Self::Blake3Dcr),
            "autolykos" | "autolykos_erg" => Some(Self::Autolykos),
            "zelhash" | "zelhash_flux" => Some(Self::Zelhash),
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
        }
    }

    fn module_name(&self) -> &'static str {
        match self {
            Self::Kheavyhash => "kheavyhash",
            Self::Blake3Alph => "blake3_alph",
            Self::Blake3Dcr => "blake3_dcr",
            Self::Autolykos => "autolykos",
            Self::Zelhash => "zelhash",
        }
    }

    fn kernel_source(&self) -> &'static str {
        match self {
            Self::Kheavyhash => KHEAVYHASH_CU,
            Self::Blake3Alph | Self::Blake3Dcr => BLAKE3_CU,
            Self::Autolykos => AUTOLYKOS_CU,
            Self::Zelhash => ZELHASH_CU,
        }
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
    found_flag: CudaSlice<u32>,
    // Algorithm-specific buffers
    kheavy_matrix: Option<CudaSlice<u16>>,
    autolykos_table: Option<CudaSlice<u64>>,
    autolykos_table_size: u32,
    // Cached timestamp for kheavyhash
    kheavy_timestamp: u64,
}

impl CudaExternalMiner {
    pub fn new(algorithm: &str, work_size: usize) -> Result<Self> {
        let algo = CudaExtAlgo::from_name(algorithm)
            .ok_or_else(|| anyhow::anyhow!("unsupported CUDA external algorithm: {}", algorithm))?;

        let dev = CudaDevice::new(0)
            .map_err(|e| anyhow::anyhow!("CUDA device init failed: {e}"))?;

        let device_name = dev
            .name()
            .unwrap_or_else(|_| "unknown CUDA device".to_string());

        // Compile kernel via NVRTC
        let arch = std::env::var("ZION_CUDA_ARCH")
            .unwrap_or_else(|_| "sm_86".to_string());
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
        dev.load_ptx(ptx, module_name, &[kernel_name])
            .map_err(|e| anyhow::anyhow!("PTX load failed for {}: {e}", algorithm))?;

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
        let found_flag = dev
            .htod_copy(vec![SENTINEL_FOUND])
            .map_err(|e| anyhow::anyhow!("found_flag alloc: {e}"))?;

        // Algorithm-specific buffers
        let kheavy_matrix = if algo == CudaExtAlgo::Kheavyhash {
            let matrix = generate_kheavy_matrix_cuda();
            Some(
                dev.htod_copy(matrix.to_vec())
                    .map_err(|e| anyhow::anyhow!("kheavy_matrix alloc: {e}"))?,
            )
        } else {
            None
        };

        let autolykos_table = None; // Generated on first mine_batch

        let actual_work_size = work_size.max(256).min(1 << 20);

        println!(
            "gpu_cuda_ext_init device=\"{}\" algorithm={} work_size={}",
            device_name, algorithm, actual_work_size,
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
            found_flag,
            kheavy_matrix,
            autolykos_table,
            autolykos_table_size: 0,
            kheavy_timestamp: 0,
        })
    }

    /// Generate the Autolykos v2 table on the host and upload to GPU.
    fn ensure_autolykos_table(&mut self, header: &[u8], height: u32) -> Result<()> {
        let table_size = autolykos_table_size_cuda();
        let table = generate_autolykos_table_cuda(header, height, table_size);
        self.autolykos_table_size = table_size as u32;
        let table_buf = self
            .dev
            .htod_copy(table)
            .map_err(|e| anyhow::anyhow!("autolykos_table upload: {e}"))?;
        self.autolykos_table = Some(table_buf);
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

        let func = self
            .dev
            .get_func(self.algo.module_name(), self.algo.kernel_name())
            .ok_or_else(|| {
                anyhow::anyhow!("kernel {} not found", self.algo.kernel_name())
            })?;

        let threads_per_block: u32 = 256;
        // Run multiple kernel launches to cover the full batch_size.
        // Each launch covers at most self.work_size nonces.
        let mut total_tested: u64 = 0;
        let mut current_nonce = nonce_start;
        let mut left = batch_size;

        while left > 0 {
            let chunk = (left as u32).min(self.work_size as u32);
            let blocks = (chunk + threads_per_block - 1) / threads_per_block;
            let cfg = LaunchConfig {
                grid_dim: (blocks, 1, 1),
                block_dim: (threads_per_block, 1, 1),
                shared_mem_bytes: 0,
            };

            unsafe {
                match self.algo {
                    CudaExtAlgo::Kheavyhash => {
                        let matrix = self.kheavy_matrix.as_ref().unwrap();
                        func
                            .clone()
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
                            .map_err(|e| anyhow::anyhow!("kheavyhash launch: {e}"))?;
                    }
                    CudaExtAlgo::Blake3Alph => {
                        let header_len_u32 = header_len as u32;
                        func
                            .clone()
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
                        func
                            .clone()
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
                        let table = self
                            .autolykos_table
                            .as_ref()
                            .ok_or_else(|| anyhow::anyhow!("autolykos table not generated"))?;
                        let header_len_u32 = header_len as u32;
                        let table_size_u32 = self.autolykos_table_size;
                        func
                            .clone()
                            .launch(
                                cfg,
                                (
                                    &self.header_buf,
                                    header_len_u32,
                                    &self.target_buf,
                                    current_nonce,
                                    table,
                                    table_size_u32,
                                    &mut self.output_nonce,
                                    &mut self.output_hash,
                                    &mut self.found_flag,
                                ),
                            )
                            .map_err(|e| anyhow::anyhow!("autolykos launch: {e}"))?;
                    }
                    CudaExtAlgo::Zelhash => {
                        let header_len_u32 = header_len as u32;
                        func
                            .clone()
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
            Ok(GpuBatchResult {
                solutions: vec![(nonce_host[0], hash, None)],
                nonces_tested: total_tested,
            })
        } else {
            Ok(GpuBatchResult {
                solutions: Vec::new(),
                nonces_tested: total_tested,
            })
        }
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

        if self.algo == CudaExtAlgo::Kheavyhash {
            let pre_pow_hash = &header_bytes[..32];
            self.kheavy_timestamp = header.timestamp;
            return self.run_kernel(pre_pow_hash, &target.bytes, nonce_start, batch_size);
        }

        if self.algo == CudaExtAlgo::Autolykos {
            let height = header.timestamp as u32;
            self.ensure_autolykos_table(&header_bytes, height)?;
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
        if self.algo == CudaExtAlgo::Kheavyhash {
            let pre_pow_hash = &raw_header[..32.min(raw_header.len())];
            self.kheavy_timestamp = 0;
            return self.run_kernel(pre_pow_hash, &target.bytes, nonce_start, batch_size);
        }

        if self.algo == CudaExtAlgo::Autolykos {
            let height = 0u32;
            self.ensure_autolykos_table(raw_header, height)?;
        }

        self.run_kernel(raw_header, &target.bytes, nonce_start, batch_size)
    }

    fn benchmark(&mut self, secs: f64) -> Result<(u64, f64, f64)> {
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
        let target = DifficultyTarget { bytes: [0xFFu8; 32] };
        while start.elapsed().as_secs_f64() < secs {
            let result = self.mine_batch(header, target, nonce, self.work_size as u64)?;
            total += result.nonces_tested;
            nonce = nonce.wrapping_add(self.work_size as u64);
        }
        let elapsed = start.elapsed().as_secs_f64();
        let hps = if elapsed > 0.0 { total as f64 / elapsed } else { 0.0 };
        Ok((total, elapsed, hps))
    }
}

// ── Host-side helper functions ─────────────────────────────────────────────

/// Generate the 64x64 kHeavyHash matrix (4096 u16 values).
fn generate_kheavy_matrix_cuda() -> [u16; 4096] {
    use std::sync::OnceLock;
    static MATRIX: OnceLock<[u16; 4096]> = OnceLock::new();
    *MATRIX.get_or_init(|| {
        use sha3::{Digest, Sha3_256};
        let seed = Sha3_256::digest(b"KHeavyHash");
        let mut rng = XoShiRo256PlusPlus::new(seed.into());
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
    })
}

fn autolykos_table_size_cuda() -> usize {
    std::env::var("ZION_AUTOLYKOS_TABLE_SIZE")
        .ok()
        .and_then(|v| v.trim().parse::<usize>().ok())
        .unwrap_or(1 << 23)
}

fn generate_autolykos_table_cuda(header: &[u8], height: u32, table_size: usize) -> Vec<u64> {
    use sha2::Digest;
    let mut h = sha2::Sha256::new();
    h.update(header);
    let seed: [u8; 32] = h.finalize().into();
    (0..table_size)
        .map(|i| gen_autolykos_element_cuda(i as u64, &seed, height))
        .collect()
}

fn gen_autolykos_element_cuda(i: u64, seed: &[u8; 32], height: u32) -> u64 {
    use blake2::digest::{Update, VariableOutput};
    let mut hasher = blake2::Blake2bVar::new(32).expect("blake2b256");
    hasher.update(seed);
    hasher.update(&i.to_be_bytes());
    hasher.update(&height.to_be_bytes());
    let mut out = [0u8; 32];
    hasher.finalize_variable(&mut out).expect("blake2b256 finalize");
    u64::from_be_bytes(out[0..8].try_into().unwrap())
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
        Self { state: s }
    }

    fn next(&mut self) -> u64 {
        let result = Self::rotl(self.state[0].wrapping_add(self.state[3]), 23)
            .wrapping_add(self.state[0]);
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
        (x << k) | (x >> (64 - k))
    }
}

/// Compute the rank of a 64x64 matrix over GF(2^4) (4-bit entries).
fn compute_rank_64(mat: &[[u16; 64]; 64]) -> usize {
    let mut m = mat.map(|row| row.map(|v| v as u32));
    let mut rank = 0;
    let mut col = 0;
    while col < 64 && rank < 64 {
        let mut pivot = None;
        for r in rank..64 {
            if m[r][col] != 0 {
                pivot = Some(r);
                break;
            }
        }
        if let Some(p) = pivot {
            m.swap(rank, p);
            let pivot_val = m[rank][col];
            if pivot_val != 0 {
                let inv = mod_inv_15(pivot_val);
                for c in col..64 {
                    m[rank][c] = (m[rank][c] * inv) & 0x0F;
                }
            }
            for r in 0..64 {
                if r != rank && m[r][col] != 0 {
                    let factor = m[r][col];
                    for c in col..64 {
                        m[r][c] = ((m[r][c] + 16) - ((m[rank][c] * factor) & 0x0F)) & 0x0F;
                    }
                }
            }
            rank += 1;
        }
        col += 1;
    }
    rank
}

fn mod_inv_15(a: u32) -> u32 {
    for x in 1..16u32 {
        if (a * x) & 0x0F == 1 {
            return x;
        }
    }
    1
}
