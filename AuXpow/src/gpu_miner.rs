//! GPU miner harness for OpenCL-accelerated external hashing.
//!
//! This module provides a GPU-accelerated mining backend using OpenCL.
//! It loads kernel source files from `csrc/opencl/` and dispatches them
//! on the GPU based on the requested algorithm.
//!
//! Currently supported GPU algorithms (when `gpu-opencl` is enabled):
//!   - `blake3` / `blake3_alph` — Alephium double-Blake3 PoW
//!   - `kheavyhash` / `kheavyhash_kas` — Kaspa kHeavyHash PoW (full consensus)
//!
//! Other algorithms return `Ok(None)` or an unsupported error and fall back
//! to the CPU miner.
//!
//! The GPU miner is gated behind the `gpu-opencl` feature.  When the feature
//! is disabled, the CPU miner in `miner_harness.rs` is used instead.
//!
//! ## Usage
//!
//! ```no_run
//! use zion_auxpow::gpu_miner::GpuMiner;
//!
//! // Create a GPU miner for the first available OpenCL device
//! let mut miner = GpuMiner::new().unwrap();
//!
//! // Mine a batch of nonces (simple API, no extra data)
//! let result = miner.mine_simple("blake3", &[0u8; 80], &[0u8; 32], 0, 1_000_000).unwrap();
//! ```

use anyhow::{anyhow, Context, Result};
use ocl::builders::ProgramBuilder;
use ocl::{Buffer, Device, Kernel, Platform, ProQue};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Instant;

/// A found share from GPU mining.
#[derive(Debug, Clone)]
pub struct GpuFoundShare {
    pub nonce: u64,
    pub hash: [u8; 32],
}

/// OpenCL GPU miner for external PoW algorithms.
pub struct GpuMiner {
    platform: Platform,
    device: Device,
    #[allow(dead_code)]
    device_name: String,
    #[allow(dead_code)]
    platform_name: String,
    /// Per-kernel ProQue instances, lazily compiled.
    proques: HashMap<String, ProQue>,
    /// Default work size (number of work-items per batch).
    work_size: usize,
}

/// Maps an algorithm name to its kernel file and entry function.
fn kernel_info(algorithm: &str) -> Option<(&'static str, &'static str)> {
    match algorithm {
        "blake3" | "blake3_alph" | "blake3_dcr" => {
            Some(("blake3_kernel.cl", "blake3_alph_mine"))
        }
        "kheavyhash" | "kheavyhash_kas" => {
            Some(("kheavyhash_kernel.cl", "kheavyhash_mine"))
        }
        "autolykos" | "autolykos_erg" => Some(("autolykos_kernel.cl", "autolykos_mine")),
        "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc" => {
            Some(("kawpow_kernel.cl", "kawpow_mine"))
        }
        "ethash" | "etchash" | "ethash_etc" => Some(("ethash_kernel.cl", "ethash_mine")),
        _ => None,
    }
}

// ── kHeavyHash matrix generation (host side) ─────────────────────────
//
// Generates the fixed 64×64 matrix of 4-bit values used by the Kaspa
// kHeavyHash algorithm.  Matches rusty-kaspa's `Matrix::generate`:
//   1. seed = SHA3-256("KHeavyHash")
//   2. XoShiRo256++ PRNG seeded with `seed`
//   3. Generate a 64×64 matrix where each entry is 4 bits (0–15)
//   4. Retry until the matrix has full rank (64) over the reals

struct XoShiRo256PlusPlus {
    s: [u64; 4],
}

impl XoShiRo256PlusPlus {
    fn new(seed: [u8; 32]) -> Self {
        let mut s = [0u64; 4];
        for i in 0..4 {
            s[i] = u64::from_le_bytes(seed[i * 8..(i + 1) * 8].try_into().unwrap());
        }
        Self { s }
    }

    #[inline(always)]
    fn next(&mut self) -> u64 {
        let res = self.s[0].wrapping_add(self.s[0].wrapping_add(self.s[3]).rotate_left(23));
        let t = self.s[1] << 17;
        self.s[2] ^= self.s[0];
        self.s[3] ^= self.s[1];
        self.s[1] ^= self.s[2];
        self.s[0] ^= self.s[3];
        self.s[2] ^= t;
        self.s[3] = self.s[3].rotate_left(45);
        res
    }
}

/// Generate the 64×64 kHeavyHash matrix as a flat array of 4096 u16 values
/// (each in range 0–15).  The matrix is generated once and cached.
fn generate_kheavy_matrix() -> [u16; 4096] {
    use std::sync::OnceLock;
    static MATRIX: OnceLock<[u16; 4096]> = OnceLock::new();
    *MATRIX.get_or_init(|| {
        use sha3::{Digest, Sha3_256};
        let seed = Sha3_256::digest(b"KHeavyHash");
        let mut rng = XoShiRo256PlusPlus::new(seed.into());

        loop {
            // Generate a 64×64 matrix of 4-bit values
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

            // Check rank == 64 (Gaussian elimination over the reals)
            if compute_rank_64(&mat) == 64 {
                // Flatten to [u16; 4096] (row-major: matrix[row*64 + col])
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

/// Compute the rank of a 64×64 matrix over the reals using Gaussian
/// elimination.  Matches rusty-kaspa's `compute_rank`.
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

impl GpuMiner {
    /// Create a new GPU miner, initializing OpenCL on the first available
    /// GPU device.
    pub fn new() -> Result<Self> {
        let (platform, device, platform_name, device_name) = Self::pick_opencl_device()?;
        let work_size = Self::detect_work_size(&device)?;

        println!(
            "auxpow_gpu_opencl platform=\"{}\" device=\"{}\" work_size={}",
            platform_name, device_name, work_size
        );

        Ok(Self {
            platform,
            device,
            device_name,
            platform_name,
            proques: HashMap::new(),
            work_size,
        })
    }

    /// Mine a batch of nonces for the requested algorithm.
    ///
    /// Scans `batch_size` nonces starting from `base_nonce`.  Returns the
    /// first nonce whose hash meets `target`.  The `header` interpretation
    /// depends on the algorithm:
    ///   - blake3: header_blob appended to the nonce (80 bytes is typical)
    ///   - kheavyhash: 32-byte pre_pow_hash; timestamp is taken from `extra`
    ///     (first 8 bytes as little-endian u64)
    ///
    /// The `extra` parameter is algorithm-specific auxiliary data.
    pub fn mine(
        &mut self,
        algorithm: &str,
        header: &[u8],
        extra: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        batch_size: u64,
    ) -> Result<Option<GpuFoundShare>> {
        let (kernel_file, kernel_name) = kernel_info(algorithm)
            .with_context(|| format!("GPU kernel not available for algorithm {algorithm}"))?;

        let pro_que = self.ensure_proque(kernel_file)?;
        let q = pro_que.queue().clone();

        let output_nonce_buf: Buffer<u64> = Buffer::builder()
            .queue(q.clone())
            .len(1)
            .fill_val(u64::MAX)
            .build()?;
        let output_hash_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone())
            .len(32)
            .build()?;
        let found_flag_buf: Buffer<u32> = Buffer::builder()
            .queue(q.clone())
            .len(1)
            .fill_val(0u32)
            .build()?;

        // Build a kernel for this call.
        let kernel = match algorithm {
            "blake3"
            | "blake3_alph"
            | "blake3_dcr"
            | "autolykos"
            | "autolykos_erg"
            | "ethash"
            | "etchash"
            | "ethash_etc" => Self::build_header_nonce_kernel(
                pro_que,
                kernel_name,
                header,
                target,
                base_nonce,
                batch_size,
                &output_nonce_buf,
                &output_hash_buf,
                &found_flag_buf,
            )?,
            "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc" => {
                Self::build_kawpow_kernel(
                    pro_que,
                    kernel_name,
                    header,
                    extra,
                    target,
                    base_nonce,
                    batch_size,
                    &output_nonce_buf,
                    &output_hash_buf,
                    &found_flag_buf,
                )?
            }
            "kheavyhash" | "kheavyhash_kas" => Self::build_kheavyhash_kernel(
                pro_que,
                kernel_name,
                header,
                extra,
                target,
                base_nonce,
                batch_size,
                &output_nonce_buf,
                &output_hash_buf,
                &found_flag_buf,
            )?,
            other => anyhow::bail!("unsupported GPU algorithm: {other}"),
        };

        let global_work_size = (batch_size as usize).min(self.work_size).max(1);
        let start = Instant::now();
        unsafe {
            kernel
                .cmd()
                .global_work_size(global_work_size)
                .enq()
                .map_err(|e| anyhow!("OpenCL enqueue failed: {e}"))?;
        }
        q.finish().map_err(|e| anyhow!("OpenCL finish failed: {e}"))?;

        let mut found_flag = vec![0u32; 1];
        found_flag_buf.read(&mut found_flag).enq()?;

        if found_flag[0] == 0 {
            return Ok(None);
        }

        let mut nonce = vec![0u64; 1];
        output_nonce_buf.read(&mut nonce).enq()?;
        let mut hash = vec![0u8; 32];
        output_hash_buf.read(&mut hash).enq()?;

        let hash_arr: [u8; 32] = hash.try_into().expect("32 bytes from GPU");
        println!(
            "auxpow_gpu_share_found algorithm={} nonce={} hash_first8={:016x} elapsed_ms={}",
            algorithm,
            nonce[0],
            u64::from_le_bytes(hash_arr[0..8].try_into().unwrap()),
            start.elapsed().as_millis()
        );

        Ok(Some(GpuFoundShare {
            nonce: nonce[0],
            hash: hash_arr,
        }))
    }

    /// Convenience: mine with a 32-byte header and no extra data.
    pub fn mine_simple(
        &mut self,
        algorithm: &str,
        header: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        batch_size: u64,
    ) -> Result<Option<GpuFoundShare>> {
        self.mine(algorithm, header, &[], target, base_nonce, batch_size)
    }

    /// Get the path to the OpenCL kernel source files.
    fn kernel_dir() -> Result<PathBuf> {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."));
        let dir = manifest_dir.join("csrc").join("opencl");
        if dir.exists() {
            Ok(dir)
        } else {
            Err(anyhow!("OpenCL kernel directory not found: {:?}", dir))
        }
    }

    /// List available OpenCL kernel source files.
    pub fn list_kernels() -> Result<Vec<String>> {
        let dir = Self::kernel_dir()?;
        let mut kernels = Vec::new();
        for entry in std::fs::read_dir(&dir)
            .with_context(|| format!("reading kernel dir {:?}", dir))?
        {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".cl") {
                kernels.push(name);
            }
        }
        Ok(kernels)
    }

    fn pick_opencl_device() -> Result<(Platform, Device, String, String)> {
        let platforms = Platform::list();
        if platforms.is_empty() {
            anyhow::bail!("no OpenCL platforms found");
        }

        for platform in platforms {
            let platform_name = platform
                .name()
                .unwrap_or_else(|_| "unknown-platform".to_string());
            let gpus = Device::list(platform, Some(ocl::flags::DeviceType::GPU));
            if let Ok(gpus) = gpus {
                if let Some(device) = gpus.into_iter().next() {
                    let device_name = device
                        .name()
                        .unwrap_or_else(|_| "unknown-device".to_string());
                    return Ok((platform, device, platform_name, device_name));
                }
            }
        }

        anyhow::bail!("no OpenCL GPU devices found")
    }

    fn detect_work_size(device: &Device) -> Result<usize> {
        let global_mem = device
            .info(ocl::enums::DeviceInfo::GlobalMemSize)
            .ok()
            .and_then(|v| match v {
                ocl::enums::DeviceInfoResult::GlobalMemSize(n) => Some(n as usize),
                _ => None,
            })
            .unwrap_or(2_000_000_000);

        // Use up to 50% of VRAM for scratchpad/buffers.
        let vram_pct: usize = std::env::var("ZION_AUXPOW_GPU_VRAM_PCT")
            .ok()
            .and_then(|v| v.trim().parse().ok())
            .unwrap_or(50)
            .clamp(10, 90);
        let usable = (global_mem * vram_pct) / 100;

        // Each work item needs ~1 KiB working state for our kernels.
        let ws = (usable / 1024).clamp(64, 4_194_304);
        let env_cap = std::env::var("ZION_AUXPOW_GPU_WORK_SIZE")
            .ok()
            .and_then(|v| v.trim().parse::<usize>().ok())
            .unwrap_or(usize::MAX);
        Ok(ws.min(env_cap))
    }

    fn ensure_proque(&mut self, kernel_file: &str) -> Result<&ProQue> {
        if self.proques.contains_key(kernel_file) {
            return Ok(self.proques.get(kernel_file).unwrap());
        }

        let path = Self::kernel_dir()?.join(kernel_file);
        let src = std::fs::read_to_string(&path)
            .with_context(|| format!("reading OpenCL kernel {:?}", path))?;

        let mut prog_builder = ProgramBuilder::new();
        prog_builder.src(src);
        // Conservative build options; fast-relaxed-math can break integer hashing.
        prog_builder.cmplr_opt("-cl-std=CL1.2 -cl-mad-enable");

        let pro_que = ProQue::builder()
            .platform(self.platform)
            .device(self.device)
            .prog_bldr(prog_builder)
            .dims(self.work_size)
            .build()
            .map_err(|e| anyhow!("OpenCL compile failed for {kernel_file}: {e}"))?;

        self.proques.insert(kernel_file.to_string(), pro_que);
        Ok(self.proques.get(kernel_file).unwrap())
    }

    #[allow(clippy::too_many_arguments)]
    fn build_header_nonce_kernel(
        pro_que: &ProQue,
        kernel_name: &str,
        header: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        batch_size: u64,
        output_nonce_buf: &Buffer<u64>,
        output_hash_buf: &Buffer<u8>,
        found_flag_buf: &Buffer<u32>,
    ) -> Result<Kernel> {
        let q = pro_que.queue().clone();

        // Limit header length to what the kernel can handle (128 bytes).
        let header_len = header.len().min(128);
        let mut header_padded = vec![0u8; 128];
        header_padded[..header_len].copy_from_slice(&header[..header_len]);

        let header_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone())
            .len(header_padded.len())
            .copy_host_slice(&header_padded)
            .build()?;
        let target_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone())
            .len(32)
            .copy_host_slice(target.as_slice())
            .build()?;

        let kernel = Kernel::builder()
            .program(pro_que.program())
            .name(kernel_name)
            .arg(&header_buf)
            .arg(header_len as u32)
            .arg(&target_buf)
            .arg(base_nonce)
            .arg(output_nonce_buf)
            .arg(output_hash_buf)
            .arg(found_flag_buf)
            .build()
            .map_err(|e| anyhow!("kernel build failed: {e}"))?;

        let _ = batch_size;

        Ok(kernel)
    }

    /// Build the KawPow kernel with a DAG buffer.
    ///
    /// The `header` is the 32-byte header hash.  The `extra` buffer carries
    /// the DAG data: the first 8 bytes are the number of DAG entries
    /// (little-endian u64), followed by the DAG itself as an array of
    /// `u64` lanes (16 lanes = 128 bytes per entry).  If `extra` is empty
    /// or too small, a minimal 1-entry DAG is used (for testing only).
    #[allow(clippy::too_many_arguments)]
    fn build_kawpow_kernel(
        pro_que: &ProQue,
        kernel_name: &str,
        header: &[u8],
        extra: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        batch_size: u64,
        output_nonce_buf: &Buffer<u64>,
        output_hash_buf: &Buffer<u8>,
        found_flag_buf: &Buffer<u32>,
    ) -> Result<Kernel> {
        let q = pro_que.queue().clone();

        // 32-byte header hash
        let mut header_hash = [0u8; 32];
        let copy_len = header.len().min(32);
        header_hash[..copy_len].copy_from_slice(&header[..copy_len]);

        let header_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone())
            .len(32)
            .copy_host_slice(&header_hash)
            .build()?;
        let target_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone())
            .len(32)
            .copy_host_slice(target.as_slice())
            .build()?;

        // Parse DAG from `extra`:
        //   bytes 0..8   : dag_entries (u64 LE)
        //   bytes 8..    : DAG data as u64 lanes (16 lanes per entry)
        let (dag_entries, dag_data): (u64, &[u8]) = if extra.len() >= 8 {
            let n = u64::from_le_bytes(extra[..8].try_into().unwrap());
            let d = &extra[8..];
            (n.max(1), d)
        } else {
            (1u64, &[][..])
        };

        // Number of u64 lanes needed = dag_entries * 16
        let lanes_needed = (dag_entries as usize) * 16;
        let mut dag_lanes = vec![0u64; lanes_needed];
        let avail_bytes = dag_data.len();
        for i in 0..lanes_needed {
            let off = i * 8;
            if off + 8 <= avail_bytes {
                dag_lanes[i] = u64::from_le_bytes(dag_data[off..off + 8].try_into().unwrap());
            }
        }

        let dag_buf: Buffer<u64> = Buffer::builder()
            .queue(q.clone())
            .len(lanes_needed)
            .copy_host_slice(&dag_lanes)
            .build()?;

        let kernel = Kernel::builder()
            .program(pro_que.program())
            .name(kernel_name)
            .arg(&header_buf)
            .arg(&target_buf)
            .arg(base_nonce)
            .arg(&dag_buf)
            .arg(dag_entries)
            .arg(output_nonce_buf)
            .arg(output_hash_buf)
            .arg(found_flag_buf)
            .build()
            .map_err(|e| anyhow!("kernel build failed: {e}"))?;

        let _ = batch_size;

        Ok(kernel)
    }

    #[allow(clippy::too_many_arguments)]
    fn build_kheavyhash_kernel(
        pro_que: &ProQue,
        kernel_name: &str,
        header: &[u8],
        extra: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        batch_size: u64,
        output_nonce_buf: &Buffer<u64>,
        output_hash_buf: &Buffer<u8>,
        found_flag_buf: &Buffer<u32>,
    ) -> Result<Kernel> {
        let q = pro_que.queue().clone();

        let mut pre_pow_hash = [0u8; 32];
        let copy_len = header.len().min(32);
        pre_pow_hash[..copy_len].copy_from_slice(&header[..copy_len]);

        let timestamp: u64 = if extra.len() >= 8 {
            u64::from_le_bytes(extra[..8].try_into().unwrap())
        } else {
            0
        };

        let pre_pow_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone())
            .len(32)
            .copy_host_slice(&pre_pow_hash)
            .build()?;
        let target_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone())
            .len(32)
            .copy_host_slice(target.as_slice())
            .build()?;

        // Generate the 64×64 kHeavyHash matrix (4096 u16 values) on the host.
        // This matches rusty-kaspa's Matrix::generate: seed = SHA3-256("KHeavyHash"),
        // XoShiRo256++ PRNG, retry until full rank (64).
        let matrix = generate_kheavy_matrix();
        let matrix_buf: Buffer<u16> = Buffer::builder()
            .queue(q.clone())
            .len(4096)
            .copy_host_slice(&matrix)
            .build()?;

        let kernel = Kernel::builder()
            .program(pro_que.program())
            .name(kernel_name)
            .arg(&pre_pow_buf)
            .arg(timestamp)
            .arg(&target_buf)
            .arg(base_nonce)
            .arg(&matrix_buf)
            .arg(output_nonce_buf)
            .arg(output_hash_buf)
            .arg(found_flag_buf)
            .build()
            .map_err(|e| anyhow!("kernel build failed: {e}"))?;

        let _ = batch_size;

        Ok(kernel)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kernel_sources_exist() {
        let kernels = GpuMiner::list_kernels();
        if let Ok(kernels) = kernels {
            assert!(
                kernels.iter().any(|k| k.contains("blake3")),
                "blake3 kernel should exist"
            );
            assert!(
                kernels.iter().any(|k| k.contains("kheavyhash")),
                "kheavyhash kernel should exist"
            );
        }
    }
}
