//! GPU backend abstraction for multi-platform mining.
//!
//! Provides a trait-based dispatch layer supporting:
//! - OpenCL (via `ocl` crate, feature `gpu-opencl`) — AMD + NVIDIA
//! - CUDA   (via `cudarc` crate, feature `gpu-cuda`) — NVIDIA native
//! - Metal  (via `metal` crate, feature `gpu-metal`) — Apple Silicon
//!
//! The backend is selected at compile time via feature flags.
//! At runtime, `GpuBackend::new()` auto-detects the best available
//! backend and returns a boxed trait object.

use anyhow::Result;

/// A found share from GPU mining.
/// Re-exported from gpu_miner for OpenCL, duplicated for CUDA/Metal.
#[derive(Debug, Clone)]
pub struct GpuFoundShare {
    pub nonce: u64,
    pub hash: [u8; 32],
    /// Mix hash for Ethash/KawPow (needed for `eth_submitWork`).
    pub mix_hash: Option<[u8; 32]>,
    /// Equihash solution for ZelHash/FLUX (52 bytes compressed).
    pub solution: Option<Vec<u8>>,
}

#[cfg(feature = "gpu-opencl")]
impl From<crate::gpu_miner::GpuFoundShare> for GpuFoundShare {
    fn from(s: crate::gpu_miner::GpuFoundShare) -> Self {
        Self {
            nonce: s.nonce,
            hash: s.hash,
            mix_hash: s.mix_hash,
            solution: s.solution,
        }
    }
}

/// DAG buffer handle (backend-agnostic).
/// The backend stores the DAG internally; this is just a marker.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DagHandle(pub u64);

/// GPU backend trait — implemented by OpenCL, CUDA, and Metal backends.
pub trait GpuBackend: Send {
    /// Mine a batch of nonces.
    ///
    /// - `algorithm`: e.g. "blake3", "kheavyhash", "autolykos", "ethash",
    ///   "kawpow", "zelhash"
    /// - `header`: block header bytes (without nonce for most algos;
    ///   for ethash/kawpow this is the 32-byte header hash)
    /// - `extra`: algorithm-specific data (e.g. height for autolykos,
    ///   extranonce for kheavyhash)
    /// - `target`: 32-byte big-endian target
    /// - `base_nonce`: first nonce to try
    /// - `batch_size`: number of nonces to scan
    ///
    /// Returns `Ok(Some(share))` if a nonce meeting the target was found.
    fn mine(
        &mut self,
        algorithm: &str,
        header: &[u8],
        extra: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        batch_size: u64,
    ) -> Result<Option<GpuFoundShare>>;

    /// Convenience: mine with no extra data.
    fn mine_simple(
        &mut self,
        algorithm: &str,
        header: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        batch_size: u64,
    ) -> Result<Option<GpuFoundShare>> {
        self.mine(algorithm, header, &[], target, base_nonce, batch_size)
    }

    /// Upload the per-epoch Ethash DAG (16 × size_entries u64 words).
    fn set_ethash_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()>;

    /// Upload the per-epoch KawPow DAG.
    fn set_kawpow_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()>;

    /// Upload the per-epoch ProgPow DAG (EPIC — same format as Ethash).
    fn set_progpow_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()>;

    /// Get the device name.
    fn device_name(&self) -> &str;

    /// Get the backend type name ("opencl", "cuda", "metal").
    fn backend_name(&self) -> &str;

    /// Get the current work size.
    fn work_size(&self) -> usize;

    /// Set the work size (number of work-items per batch).
    fn set_work_size(&mut self, size: usize);

    /// Benchmark: run `secs` seconds of mining and return (hashes, hashrate, temp).
    fn benchmark(&mut self, secs: f64) -> Result<(u64, f64, f64)> {
        let _ = secs;
        Ok((0, 0.0, 0.0))
    }
}

/// Auto-detect and create the best available GPU backend.
///
/// Tries backends in this order (based on compile-time features):
/// 1. CUDA (NVIDIA native — best perf on NVIDIA)
/// 2. Metal (Apple Silicon — best perf on Mac)
/// 3. OpenCL (cross-platform — works on AMD, NVIDIA, Intel)
///
/// Returns the first backend that initializes successfully.
pub fn detect_backend(_work_size: usize) -> Result<Box<dyn GpuBackend>> {
    // Try CUDA first (best perf on NVIDIA)
    #[cfg(feature = "gpu-cuda")]
    {
        match crate::gpu_cuda::CudaBackend::new(_work_size) {
            Ok(backend) => {
                println!(
                    "gpu_backend: using CUDA device: {}",
                    backend.device_name()
                );
                return Ok(Box::new(backend));
            }
            Err(e) => {
                println!("gpu_backend: CUDA unavailable: {e}");
            }
        }
    }

    // Try Metal (Apple Silicon)
    #[cfg(all(feature = "gpu-metal", target_os = "macos"))]
    {
        match crate::gpu_metal::MetalBackend::new(_work_size) {
            Ok(backend) => {
                println!(
                    "gpu_backend: using Metal device: {}",
                    backend.device_name()
                );
                return Ok(Box::new(backend));
            }
            Err(e) => {
                println!("gpu_backend: Metal unavailable: {e}");
            }
        }
    }

    // Try OpenCL (cross-platform fallback)
    #[cfg(feature = "gpu-opencl")]
    {
        match crate::gpu_opencl::new_backend(_work_size) {
            Ok(backend) => {
                println!(
                    "gpu_backend: using OpenCL device: {}",
                    backend.device_name()
                );
                return Ok(Box::new(backend));
            }
            Err(e) => {
                println!("gpu_backend: OpenCL unavailable: {e}");
            }
        }
    }

    anyhow::bail!(
        "no GPU backend available — compile with --features gpu-opencl, gpu-cuda, or gpu-metal"
    )
}

/// List all available GPU devices across all backends.
#[allow(unused_mut)]
pub fn list_devices() -> Vec<String> {
    let mut devices = Vec::new();

    #[cfg(feature = "gpu-cuda")]
    {
        devices.extend(crate::gpu_cuda::list_cuda_devices());
    }

    #[cfg(all(feature = "gpu-metal", target_os = "macos"))]
    {
        devices.extend(crate::gpu_metal::list_metal_devices());
    }

    #[cfg(feature = "gpu-opencl")]
    {
        devices.extend(crate::gpu_opencl::list_opencl_devices());
    }

    devices
}

// ── Shared GPU helper functions (available to all backends) ───────────
//
// These functions are used by Metal/CUDA backends that don't have access
// to gpu_miner.rs (which is OpenCL-only).

/// XoShiRo256++ PRNG for kHeavyHash matrix generation.
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

/// Generate the 64×64 kHeavyHash matrix as a flat array of 4096 u16 values
/// (each in range 0–15).  The matrix is generated once and cached.
pub fn generate_kheavy_matrix() -> [u16; 4096] {
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

/// Default Autolykos v2 table size (number of u64 entries).
pub fn autolykos_table_size() -> usize {
    std::env::var("ZION_AUTOLYKOS_TABLE_SIZE")
        .ok()
        .and_then(|v| v.trim().parse::<usize>().ok())
        .unwrap_or(1 << 23)
}

/// Generate a single Autolykos v2 table element via BLAKE2b-256.
pub(crate) fn gen_autolykos_element(i: u64, seed: &[u8; 32], height: u32) -> u64 {
    use blake2::digest::{Update, VariableOutput};
    let mut hasher = blake2::Blake2bVar::new(32).expect("blake2b256");
    hasher.update(seed);
    hasher.update(&i.to_be_bytes());
    hasher.update(&height.to_be_bytes());
    let mut out = [0u8; 32];
    hasher.finalize_variable(&mut out).expect("blake2b256 finalize");
    u64::from_be_bytes(out[0..8].try_into().unwrap())
}

/// Generate the full Autolykos v2 table (M u64 entries) from header + height.
pub fn generate_autolykos_table(header: &[u8], height: u32, table_size: usize) -> Vec<u64> {
    use sha2::Digest;
    let mut h = sha2::Sha256::new();
    h.update(header);
    let seed: [u8; 32] = h.finalize().into();
    (0..table_size)
        .map(|i| gen_autolykos_element(i as u64, &seed, height))
        .collect()
}
