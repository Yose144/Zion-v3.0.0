//! GPU miner harness for OpenCL-accelerated external hashing.
//!
//! This module provides a GPU-accelerated mining backend using OpenCL.
//! It loads kernel source files from `csrc/opencl/` and dispatches them
//! on the GPU based on the requested algorithm.
//!
//! Currently supported GPU algorithms (when `gpu-opencl` is enabled):
//!   - `blake3` / `blake3_alph` — Alephium double-Blake3 PoW
//!   - `kheavyhash` / `kheavyhash_kas` — Kaspa kHeavyHash PoW (full consensus)
//!   - `autolykos` / `autolykos_erg` — Ergo Autolykos v2 PoW (BLAKE2b-256 +
//!     memory-hard table lookups; table precomputed on the host)
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
    /// Mix hash for Ethash/KawPow (the intermediate compressed mix hash
    /// needed for `eth_submitWork`).  None for algorithms that don't
    /// produce a mix hash (blake3, kheavyhash, autolykos).
    pub mix_hash: Option<[u8; 32]>,
    /// Equihash solution for ZelHash/FLUX (52 bytes compressed).
    /// None for non-Equihash algorithms.
    pub solution: Option<Vec<u8>>,
}

/// Cached Ethash DAG uploaded to the GPU device.
///
/// The DAG is a per-epoch precomputed buffer of 128-byte entries (16 × u64
/// words each).  It is generated on the host and uploaded once via
/// [`GpuMiner::set_ethash_dag`].  `size_entries` is the number of 128-byte
/// entries (matches the `dag_size` kernel argument).
#[derive(Clone)]
struct EthashDag {
    buf: Buffer<u64>,
    size_entries: u64,
    epoch: u32,
}

/// Cached KawPow DAG uploaded to the GPU device.
/// Same structure as EthashDag but tracked separately because KawPow
/// uses a different epoch length (7500 vs 30000) and may be loaded
/// concurrently with an Ethash DAG.
#[derive(Clone)]
struct KawpowDag {
    buf: Buffer<u64>,
    size_entries: u64,
    epoch: u32,
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
    /// Cached Ethash DAG buffer (set via `set_ethash_dag` before mining ETC).
    ethash_dag: Option<EthashDag>,
    /// Cached KawPow DAG buffer (set via `set_kawpow_dag` before mining RVN).
    kawpow_dag: Option<KawpowDag>,
}

/// Maps an algorithm name to its kernel file and entry function.
fn kernel_info(algorithm: &str) -> Option<(&'static str, &'static str)> {
    match algorithm {
        "blake3" | "blake3_alph" => {
            Some(("blake3_kernel.cl", "blake3_alph_mine"))
        }
        "blake3_dcr" => {
            Some(("blake3_kernel.cl", "blake3_dcr_mine"))
        }
        "kheavyhash" | "kheavyhash_kas" => {
            Some(("kheavyhash_kernel.cl", "kheavyhash_mine"))
        }
        "autolykos" | "autolykos_erg" => Some(("autolykos_kernel.cl", "autolykos_mine")),
        "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc" => {
            Some(("kawpow_kernel.cl", "kawpow_mine"))
        }
        "ethash" | "etchash" | "ethash_etc" => Some(("ethash_kernel.cl", "ethash_mine")),
        "zelhash" | "zelhash_flux" => Some(("zelhash_kernel.cl", "zelhash_mine")),
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

// ── Autolykos v2 table generation (host side) ────────────────────────
//
// Generates the precomputed table of M u64 elements used by the Ergo
// Autolykos v2 PoW.  The table is derived from the block header and height:
//   seed = SHA-256(header)                       (32 bytes)
//   table[i] = gen_element(i, seed, height)      for i in 0..M
//
// `gen_element` produces a deterministic 64-bit element via BLAKE2b-256:
//   elem = BLAKE2b256(seed || be64(i) || be32(height))
//   table[i] = u64::from_be_bytes(elem[0..8])
//
// The table is expensive to generate (O(M) BLAKE2b hashes), so it is cached
// keyed by (height, table_size) in a process-wide static map and regenerated
// only when the height (or table size) changes.  Ergo mainnet uses M = 2^26
// (67M entries / 512 MB); the default here is 2^23 (8M entries / 64 MB) for
// practicality, overridable via the `ZION_AUTOLYKOS_TABLE_SIZE` env var.
//
// References:
//   - Ergo Autolykos v2 whitepaper (ErgoPow.tex)
//   - https://docs.ergoplatform.com/mining/algo-technical/

/// Default Autolykos v2 table size (number of u64 entries).  A power of two
/// is required by the kernel (which uses `& (M - 1)` for the modulo).  The
/// Ergo mainnet value is `1 << 26` (512 MB); override with the
/// `ZION_AUTOLYKOS_TABLE_SIZE` environment variable.
fn autolykos_table_size() -> usize {
    std::env::var("ZION_AUTOLYKOS_TABLE_SIZE")
        .ok()
        .and_then(|v| v.trim().parse::<usize>().ok())
        .unwrap_or(1 << 23)
}

/// Process-wide cache of Autolykos v2 tables, keyed by `(height, table_size)`.
type AutolykosTableCache = std::collections::HashMap<(u32, usize), Vec<u64>>;

fn autolykos_table_cache() -> &'static std::sync::Mutex<AutolykosTableCache> {
    use std::sync::OnceLock;
    static CACHE: OnceLock<std::sync::Mutex<AutolykosTableCache>> = OnceLock::new();
    CACHE.get_or_init(|| std::sync::Mutex::new(AutolykosTableCache::new()))
}

/// Generate a single Autolykos v2 table element.
///
/// `elem = BLAKE2b256(seed || be64(i) || be32(height))`, returning the first
/// 8 bytes as a big-endian u64.
fn gen_autolykos_element(i: u64, seed: &[u8; 32], height: u32) -> u64 {
    use blake2::digest::{Update, VariableOutput};
    let mut hasher = blake2::Blake2bVar::new(32).expect("blake2b256");
    hasher.update(seed);
    hasher.update(&i.to_be_bytes());
    hasher.update(&height.to_be_bytes());
    let mut out = [0u8; 32];
    hasher
        .finalize_variable(&mut out)
        .expect("blake2b256 finalize");
    u64::from_be_bytes(out[0..8].try_into().unwrap())
}

/// Generate the full Autolykos v2 table (M u64 entries) from the header and
/// height.  `seed = SHA-256(header)`.
fn generate_autolykos_table(header: &[u8], height: u32, table_size: usize) -> Vec<u64> {
    use sha2::Digest;
    let mut h = sha2::Sha256::new();
    h.update(header);
    let seed: [u8; 32] = h.finalize().into();

    (0..table_size)
        .map(|i| gen_autolykos_element(i as u64, &seed, height))
        .collect()
}

/// Ensure the Autolykos v2 table for `(height, table_size)` is present in the
/// process-wide cache, generating it on a cache miss.  Called from `mine()`
/// before building the kernel (and before borrowing `self` for the ProQue).
fn ensure_autolykos_table(header: &[u8], height: u32, table_size: usize) {
    let mut cache = autolykos_table_cache().lock().unwrap();
    cache
        .entry((height, table_size))
        .or_insert_with(|| generate_autolykos_table(header, height, table_size));
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
            ethash_dag: None,
            kawpow_dag: None,
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

        // Ethash/KawPow need the per-epoch DAG; clone the Arc-backed buffer
        // handle before borrowing `self` for the ProQue below.
        let ethash_dag = if matches!(algorithm, "ethash" | "etchash" | "ethash_etc") {
            self.ethash_dag.clone()
        } else {
            None
        };
        let kawpow_dag = if matches!(
            algorithm,
            "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc"
        ) {
            self.kawpow_dag.clone()
        } else {
            None
        };

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
        let output_mix_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone())
            .len(32)
            .build()?;
        let output_solution_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone())
            .len(52)  // Equihash 125,4 compressed solution
            .build()?;
        let found_flag_buf: Buffer<u32> = Buffer::builder()
            .queue(q.clone())
            .len(1)
            .fill_val(0u32)
            .build()?;

        // Build a kernel for this call.
        let kernel = match algorithm {
            "blake3" | "blake3_alph" | "blake3_dcr" => Self::build_header_nonce_kernel(
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
            "autolykos" | "autolykos_erg" => {
                // Prepare (and cache) the Autolykos v2 precomputed table.
                // `extra` carries the block height as a little-endian u32 in
                // its first 4 bytes, optionally followed by a little-endian
                // u32 table-size override in bytes 4..8.
                let height: u32 = if extra.len() >= 4 {
                    u32::from_le_bytes(extra[..4].try_into().unwrap())
                } else {
                    0
                };
                let table_size: usize = if extra.len() >= 8 {
                    u32::from_le_bytes(extra[4..8].try_into().unwrap()) as usize
                } else {
                    autolykos_table_size()
                };
                let table_size = table_size.next_power_of_two().max(1);

                ensure_autolykos_table(header, height, table_size);
                let table_buf = {
                    let cache = autolykos_table_cache().lock().unwrap();
                    let table = cache
                        .get(&(height, table_size))
                        .expect("autolykos table must be cached");
                    Buffer::<u64>::builder()
                        .queue(q.clone())
                        .len(table.len())
                        .copy_host_slice(table)
                        .build()?
                };

                Self::build_autolykos_kernel(
                    pro_que,
                    kernel_name,
                    header,
                    target,
                    base_nonce,
                    &table_buf,
                    table_size as u32,
                    &output_nonce_buf,
                    &output_hash_buf,
                    &found_flag_buf,
                )?
            }
            "ethash" | "etchash" | "ethash_etc" => {
                // Ethash requires the per-epoch DAG to be uploaded first.
                let dag = ethash_dag.ok_or_else(|| {
                    anyhow!(
                        "Ethash DAG not set; call GpuMiner::set_ethash_dag() \
                         before mining ETC/ETHW"
                    )
                })?;
                Self::build_ethash_kernel(
                    pro_que,
                    kernel_name,
                    header,
                    target,
                    base_nonce,
                    &dag.buf,
                    dag.size_entries,
                    &output_nonce_buf,
                    &output_hash_buf,
                    &output_mix_buf,
                    &found_flag_buf,
                )?
            }
            "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc" => {
                // KawPow requires the per-epoch DAG to be uploaded first.
                let dag = kawpow_dag.ok_or_else(|| {
                    anyhow!(
                        "KawPow DAG not set; call GpuMiner::set_kawpow_dag() \
                         before mining RVN/CLORE/EVR/MEWC"
                    )
                })?;
                Self::build_kawpow_kernel(
                    pro_que,
                    kernel_name,
                    header,
                    target,
                    base_nonce,
                    batch_size,
                    &dag.buf,
                    dag.size_entries,
                    &output_nonce_buf,
                    &output_hash_buf,
                    &output_mix_buf,
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
            "zelhash" | "zelhash_flux" => Self::build_zelhash_kernel(
                pro_que,
                kernel_name,
                header,
                target,
                base_nonce,
                &output_nonce_buf,
                &output_hash_buf,
                &output_solution_buf,
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

        // Read mix hash for Ethash/KawPow (needed for eth_submitWork).
        let mix_hash = if matches!(algorithm, "ethash" | "etchash" | "ethash_etc"
            | "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc")
        {
            let mut mix = vec![0u8; 32];
            output_mix_buf.read(&mut mix).enq()?;
            Some(mix.try_into().expect("32 bytes mix from GPU"))
        } else {
            None
        };

        // Read Equihash solution for ZelHash/FLUX (52 bytes).
        let solution = if matches!(algorithm, "zelhash" | "zelhash_flux") {
            let mut sol = vec![0u8; 52];
            output_solution_buf.read(&mut sol).enq()?;
            Some(sol)
        } else {
            None
        };

        println!(
            "auxpow_gpu_share_found algorithm={} nonce={} hash_first8={:016x} has_mix={} elapsed_ms={}",
            algorithm,
            nonce[0],
            u64::from_le_bytes(hash_arr[0..8].try_into().unwrap()),
            mix_hash.is_some(),
            start.elapsed().as_millis()
        );

        Ok(Some(GpuFoundShare {
            nonce: nonce[0],
            hash: hash_arr,
            mix_hash,
            solution,
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

    /// Upload the per-epoch Ethash DAG to the GPU device.
    ///
    /// The DAG must be generated on the host (from the epoch seed hash via
    /// Keccak-512 graph expansion) and passed here as a slice of little-endian
    /// `u64` words.  Each 128-byte DAG entry is 16 `u64` words, so
    /// `dag.len()` must equal `16 * size_entries`.  `epoch` is stored only to
    /// detect stale DAGs.  Call this once per epoch before mining ETC/ETHW.
    pub fn set_ethash_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()> {
        let expected_len = (size_entries as usize)
            .checked_mul(16)
            .ok_or_else(|| anyhow!("dag_size_entries overflow"))?;
        if dag.len() != expected_len {
            return Err(anyhow!(
                "Ethash DAG length mismatch: got {} u64 words, expected {} (16 * {} entries)",
                dag.len(),
                expected_len,
                size_entries
            ));
        }

        let q = {
            let pro_que = self.ensure_proque("ethash_kernel.cl")?;
            pro_que.queue().clone()
        };

        let buf: Buffer<u64> = Buffer::builder()
            .queue(q)
            .len(dag.len())
            .copy_host_slice(dag)
            .build()
            .map_err(|e| anyhow!("failed to allocate Ethash DAG buffer: {e}"))?;

        self.ethash_dag = Some(EthashDag {
            buf,
            size_entries,
            epoch,
        });

        Ok(())
    }

    /// Returns the epoch of the currently uploaded Ethash DAG, if any.
    pub fn ethash_dag_epoch(&self) -> Option<u32> {
        self.ethash_dag.as_ref().map(|d| d.epoch)
    }

    /// Upload the per-epoch KawPow DAG to the GPU device.
    ///
    /// Same semantics as `set_ethash_dag` but for KawPow (RVN/CLORE/EVR/MEWC).
    /// The DAG is generated with `KAWPOW_EPOCH_LENGTH=7500` instead of 30000.
    pub fn set_kawpow_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()> {
        let expected_len = (size_entries as usize)
            .checked_mul(16)
            .ok_or_else(|| anyhow!("dag_size_entries overflow"))?;
        if dag.len() != expected_len {
            return Err(anyhow!(
                "KawPow DAG length mismatch: got {} u64 words, expected {} (16 * {} entries)",
                dag.len(),
                expected_len,
                size_entries
            ));
        }

        let q = {
            let pro_que = self.ensure_proque("kawpow_kernel.cl")?;
            pro_que.queue().clone()
        };

        let buf: Buffer<u64> = Buffer::builder()
            .queue(q)
            .len(dag.len())
            .copy_host_slice(dag)
            .build()
            .map_err(|e| anyhow!("failed to allocate KawPow DAG buffer: {e}"))?;

        self.kawpow_dag = Some(KawpowDag {
            buf,
            size_entries,
            epoch,
        });

        Ok(())
    }

    /// Returns the epoch of the currently uploaded KawPow DAG, if any.
    pub fn kawpow_dag_epoch(&self) -> Option<u32> {
        self.kawpow_dag.as_ref().map(|d| d.epoch)
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
        match Self::kernel_dir() {
            Ok(dir) => {
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
            Err(_) => {
                // Embedded kernels
                Ok(vec![
                    "kheavyhash_kernel.cl".to_string(),
                    "blake3_kernel.cl".to_string(),
                    "autolykos_kernel.cl".to_string(),
                    "kawpow_kernel.cl".to_string(),
                    "ethash_kernel.cl".to_string(),
                ])
            }
        }
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

        // Try disk first (dev mode), then fall back to embedded kernels (deployed binary)
        let src = match Self::kernel_dir() {
            Ok(dir) => {
                let path = dir.join(kernel_file);
                std::fs::read_to_string(&path)
                    .with_context(|| format!("reading OpenCL kernel {:?}", path))?
            }
            Err(_) => {
                // Embedded kernel sources (compiled into the binary)
                let embedded = match kernel_file {
                    "kheavyhash_kernel.cl" => include_str!("../csrc/opencl/kheavyhash_kernel.cl"),
                    "blake3_kernel.cl" => include_str!("../csrc/opencl/blake3_kernel.cl"),
                    "autolykos_kernel.cl" => include_str!("../csrc/opencl/autolykos_kernel.cl"),
                    "kawpow_kernel.cl" => include_str!("../csrc/opencl/kawpow_kernel.cl"),
                    "ethash_kernel.cl" => include_str!("../csrc/opencl/ethash_kernel.cl"),
                    _ => return Err(anyhow!("Unknown kernel file: {kernel_file} (not on disk and not embedded)")),
                };
                println!("auxpow_gpu_opencl using embedded kernel={kernel_file}");
                embedded.to_string()
            }
        };

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

        // Limit header length to what the kernel can handle (248 bytes for DCR).
        let header_len = header.len().min(248);
        let mut header_padded = vec![0u8; 248];
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
            .queue(q.clone())
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

    /// Build the ZelHash (Equihash 125,4) kernel for FLUX mining.
    ///
    /// The `header` is the block header prefix (without nonce/solution).
    /// The kernel appends a 32-byte nonce, computes Blake2b-512 with
    /// ZelProof personalization, and checks the resulting hash against
    /// the target.  The 52-byte Equihash solution is written to
    /// `output_solution_buf`.
    #[allow(clippy::too_many_arguments)]
    fn build_zelhash_kernel(
        pro_que: &ProQue,
        kernel_name: &str,
        header: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        output_nonce_buf: &Buffer<u64>,
        output_hash_buf: &Buffer<u8>,
        output_solution_buf: &Buffer<u8>,
        found_flag_buf: &Buffer<u32>,
    ) -> Result<Kernel> {
        let q = pro_que.queue().clone();

        // Pad header to 243 bytes (max: 211 header + 32 nonce)
        let header_len = header.len().min(243);
        let mut header_padded = vec![0u8; 243];
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
            .queue(q.clone())
            .program(pro_que.program())
            .name(kernel_name)
            .arg(&header_buf)
            .arg(header_len as u32)
            .arg(&target_buf)
            .arg(base_nonce)
            .arg(output_nonce_buf)
            .arg(output_hash_buf)
            .arg(output_solution_buf)
            .arg(found_flag_buf)
            .build()
            .map_err(|e| anyhow!("ZelHash kernel build failed: {e}"))?;

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
        target: &[u8; 32],
        base_nonce: u64,
        batch_size: u64,
        dag_buf: &Buffer<u64>,
        dag_entries: u64,
        output_nonce_buf: &Buffer<u64>,
        output_hash_buf: &Buffer<u8>,
        output_mix_buf: &Buffer<u8>,
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

        let kernel = Kernel::builder()
            .queue(q.clone())
            .program(pro_que.program())
            .name(kernel_name)
            .arg(&header_buf)
            .arg(&target_buf)
            .arg(base_nonce)
            .arg(dag_buf)
            .arg(dag_entries)
            .arg(output_nonce_buf)
            .arg(output_hash_buf)
            .arg(output_mix_buf)
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
            .queue(q.clone())
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

    /// Build the Autolykos v2 mining kernel.
    ///
    /// The precomputed table (generated on the host from `SHA-256(header)` and
    /// the block height) is passed in as `table_buf`.  The kernel signature
    /// (in `autolykos_kernel.cl`) is, in order:
    ///   header (__global uchar *), header_len (u32), target (__global uchar *),
    ///   base_nonce (u64), table (__global ulong *), table_size (u32),
    ///   output_nonce, output_hash, found.
    #[allow(clippy::too_many_arguments)]
    fn build_autolykos_kernel(
        pro_que: &ProQue,
        kernel_name: &str,
        header: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        table_buf: &Buffer<u64>,
        table_size: u32,
        output_nonce_buf: &Buffer<u64>,
        output_hash_buf: &Buffer<u8>,
        found_flag_buf: &Buffer<u32>,
    ) -> Result<Kernel> {
        let q = pro_que.queue().clone();

        // The kernel reads up to 112 header bytes; pad to a fixed 128-byte
        // buffer (the kernel clamps the length itself).
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
            .queue(q.clone())
            .program(pro_que.program())
            .name(kernel_name)
            .arg(&header_buf)
            .arg(header_len as u32)
            .arg(&target_buf)
            .arg(base_nonce)
            .arg(table_buf)
            .arg(table_size)
            .arg(output_nonce_buf)
            .arg(output_hash_buf)
            .arg(found_flag_buf)
            .build()
            .map_err(|e| anyhow!("kernel build failed: {e}"))?;

        Ok(kernel)
    }

    /// Build the Ethash mining kernel.
    ///
    /// The DAG buffer must already be uploaded via [`Self::set_ethash_dag`]
    /// and is passed in here.  The kernel signature (in `ethash_kernel.cl`)
    /// is, in order:
    ///   header_hash (32 bytes), target (32 bytes), nonce_base (u64),
    ///   stride (u64), dag (__global ulong *), dag_size (u64),
    ///   output_nonce, output_hash, found.
    #[allow(clippy::too_many_arguments)]
    fn build_ethash_kernel(
        pro_que: &ProQue,
        kernel_name: &str,
        header: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        dag_buf: &Buffer<u64>,
        dag_size_entries: u64,
        output_nonce_buf: &Buffer<u64>,
        output_hash_buf: &Buffer<u8>,
        output_mix_buf: &Buffer<u8>,
        found_flag_buf: &Buffer<u32>,
    ) -> Result<Kernel> {
        let q = pro_que.queue().clone();

        // Ethash header_hash is exactly 32 bytes (Keccak-256 of the block
        // header without nonce/mix).
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

        // stride = 1 → contiguous nonces (one per work-item).
        let stride: u64 = 1;

        let kernel = Kernel::builder()
            .queue(q.clone())
            .program(pro_que.program())
            .name(kernel_name)
            .arg(&header_buf)
            .arg(&target_buf)
            .arg(base_nonce)
            .arg(stride)
            .arg(dag_buf)
            .arg(dag_size_entries)
            .arg(output_nonce_buf)
            .arg(output_hash_buf)
            .arg(output_mix_buf)
            .arg(found_flag_buf)
            .build()
            .map_err(|e| anyhow!("kernel build failed: {e}"))?;

        Ok(kernel)
    }
}

// ── DagManager: auto-generates and caches per-epoch DAGs ────────────────
//
// DagManager tracks the current epoch for Ethash and KawPow and regenerates
// the DAG (via FFI to the C implementation) whenever the epoch changes.
// Generated DAGs are persisted to disk so subsequent startups load from
// cache instead of regenerating (saves ~30s for 1GB epoch 0 DAG).
//
// Cache layout:
//   $ZION_DAG_CACHE_DIR/ethash_epoch{N}.bin
//   $ZION_DAG_CACHE_DIR/kawpow_epoch{N}.bin
// Default: ~/.zion/dag-cache/
//
// Only available when both `gpu-opencl` and `native-hashers` features are
// enabled (DAG generation requires the C FFI).

#[cfg(feature = "native-hashers")]
use std::path::Path;
#[cfg(feature = "native-hashers")]
use std::io::{Read, Write};
#[cfg(feature = "native-hashers")]
use crate::native_ffi::{generate_ethash_dag, generate_kawpow_dag};

/// Manages DAG generation and GPU upload for Ethash and KawPow.
#[cfg(feature = "native-hashers")]
pub struct DagManager {
    /// Currently loaded Ethash epoch (None = not loaded).
    ethash_epoch: Option<u32>,
    /// Currently loaded KawPow epoch (None = not loaded).
    kawpow_epoch: Option<u32>,
    /// Directory for DAG disk cache.
    cache_dir: PathBuf,
}

#[cfg(feature = "native-hashers")]
impl DagManager {
    /// Create a new DagManager with the default cache directory.
    pub fn new() -> Self {
        let cache_dir = std::env::var("ZION_DAG_CACHE_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
                PathBuf::from(home).join(".zion").join("dag-cache")
            });
        Self {
            ethash_epoch: None,
            kawpow_epoch: None,
            cache_dir,
        }
    }

    /// Ensure the GPU miner has the correct Ethash DAG loaded for `epoch`.
    /// If the epoch changed (or no DAG is loaded), generates or loads from
    /// cache, then uploads to the GPU via `set_ethash_dag`.
    pub fn ensure_ethash_dag(
        &mut self,
        miner: &mut GpuMiner,
        epoch: u32,
    ) -> Result<()> {
        if self.ethash_epoch == Some(epoch) && miner.ethash_dag_epoch() == Some(epoch) {
            return Ok(()); // already loaded
        }

        eprintln!(
            "dag_manager: loading Ethash DAG epoch={} (cache_dir={})",
            epoch, self.cache_dir.display()
        );

        // Try disk cache first
        let cache_path = self.cache_dir.join(format!("ethash_epoch{}.bin", epoch));
        let (dag_u64, dag_entries) = if cache_path.exists() {
            eprintln!("dag_manager: loading Ethash DAG from disk cache: {}", cache_path.display());
            Self::load_dag_from_disk(&cache_path)?
        } else {
            eprintln!("dag_manager: generating Ethash DAG epoch={} via FFI...", epoch);
            let dag = generate_ethash_dag(epoch)
                .ok_or_else(|| anyhow!("ethash_generate_dag returned NULL for epoch {}", epoch))?;
            let entries = dag.dag_size_entries;
            let u64_slice = dag.as_u64_slice().to_vec();
            // Persist to disk
            self.save_dag_to_disk(&cache_path, &u64_slice, entries)?;
            (u64_slice, entries)
        };

        eprintln!(
            "dag_manager: uploading Ethash DAG to GPU ({} entries = {:.1} MB)",
            dag_entries,
            dag_entries as f64 * 128.0 / (1024.0 * 1024.0)
        );
        miner.set_ethash_dag(&dag_u64, dag_entries, epoch)?;
        self.ethash_epoch = Some(epoch);
        eprintln!("dag_manager: Ethash DAG epoch={} ready", epoch);
        Ok(())
    }

    /// Ensure the GPU miner has the correct KawPow DAG loaded for `epoch`.
    pub fn ensure_kawpow_dag(
        &mut self,
        miner: &mut GpuMiner,
        epoch: u32,
    ) -> Result<()> {
        if self.kawpow_epoch == Some(epoch) && miner.kawpow_dag_epoch() == Some(epoch) {
            return Ok(()); // already loaded
        }

        eprintln!(
            "dag_manager: loading KawPow DAG epoch={} (cache_dir={})",
            epoch, self.cache_dir.display()
        );

        let cache_path = self.cache_dir.join(format!("kawpow_epoch{}.bin", epoch));
        let (dag_u64, dag_entries) = if cache_path.exists() {
            eprintln!("dag_manager: loading KawPow DAG from disk cache: {}", cache_path.display());
            Self::load_dag_from_disk(&cache_path)?
        } else {
            eprintln!("dag_manager: generating KawPow DAG epoch={} via FFI...", epoch);
            let dag = generate_kawpow_dag(epoch)
                .ok_or_else(|| anyhow!("kawpow_generate_dag returned NULL for epoch {}", epoch))?;
            let entries = dag.dag_size_entries;
            let u64_slice = dag.as_u64_slice().to_vec();
            self.save_dag_to_disk(&cache_path, &u64_slice, entries)?;
            (u64_slice, entries)
        };

        eprintln!(
            "dag_manager: uploading KawPow DAG to GPU ({} entries = {:.1} MB)",
            dag_entries,
            dag_entries as f64 * 128.0 / (1024.0 * 1024.0)
        );
        miner.set_kawpow_dag(&dag_u64, dag_entries, epoch)?;
        self.kawpow_epoch = Some(epoch);
        eprintln!("dag_manager: KawPow DAG epoch={} ready", epoch);
        Ok(())
    }

    /// Convenience: ensure the right DAG for the given algorithm.
    /// `epoch` is the pre-computed epoch number (block_number / EPOCH_LENGTH).
    pub fn ensure_dag(
        &mut self,
        miner: &mut GpuMiner,
        algorithm: &str,
        epoch: u32,
    ) -> Result<()> {
        match algorithm {
            "ethash" | "etchash" | "ethash_etc" => self.ensure_ethash_dag(miner, epoch),
            "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc" => {
                self.ensure_kawpow_dag(miner, epoch)
            }
            _ => Ok(()), // non-DAG algorithms
        }
    }

    /// Load a DAG from disk cache. Returns (u64 words, dag_size_entries).
    fn load_dag_from_disk(path: &Path) -> Result<(Vec<u64>, u64)> {
        let mut file = std::fs::File::open(path)
            .map_err(|e| anyhow!("failed to open DAG cache {}: {e}", path.display()))?;
        let metadata = file.metadata()
            .map_err(|e| anyhow!("failed to stat DAG cache: {e}"))?;
        let total_bytes = metadata.len() as usize;
        // First 8 bytes = dag_size_entries (u64 LE), rest = DAG data
        if total_bytes < 8 {
            return Err(anyhow!("DAG cache file too small: {} bytes", total_bytes));
        }
        let mut entries_buf = [0u8; 8];
        file.read_exact(&mut entries_buf)
            .map_err(|e| anyhow!("failed to read DAG entries count: {e}"))?;
        let dag_entries = u64::from_le_bytes(entries_buf);
        let data_bytes = total_bytes - 8;
        let mut data = vec![0u8; data_bytes];
        file.read_exact(&mut data)
            .map_err(|e| anyhow!("failed to read DAG data: {e}"))?;
        // Convert bytes to u64 words (little-endian)
        let u64_count = data_bytes / 8;
        let mut u64_vec = vec![0u64; u64_count];
        for i in 0..u64_count {
            u64_vec[i] = u64::from_le_bytes(data[i*8..i*8+8].try_into().unwrap());
        }
        Ok((u64_vec, dag_entries))
    }

    /// Save a DAG to disk cache.
    fn save_dag_to_disk(&self, path: &Path, dag_u64: &[u64], dag_entries: u64) -> Result<()> {
        // Create cache directory if it doesn't exist
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| anyhow!("failed to create DAG cache dir {}: {e}", parent.display()))?;
        }
        let mut file = std::fs::File::create(path)
            .map_err(|e| anyhow!("failed to create DAG cache file {}: {e}", path.display()))?;
        // Write dag_size_entries as 8-byte LE header
        file.write_all(&dag_entries.to_le_bytes())
            .map_err(|e| anyhow!("failed to write DAG entries: {e}"))?;
        // Write DAG data as u64 LE words
        for word in dag_u64 {
            file.write_all(&word.to_le_bytes())
                .map_err(|e| anyhow!("failed to write DAG data: {e}"))?;
        }
        eprintln!(
            "dag_manager: saved DAG to disk cache ({} entries, {:.1} MB)",
            dag_entries,
            dag_u64.len() as f64 * 8.0 / (1024.0 * 1024.0)
        );
        Ok(())
    }

    /// Returns the currently loaded Ethash epoch, if any.
    pub fn ethash_epoch(&self) -> Option<u32> {
        self.ethash_epoch
    }

    /// Returns the currently loaded KawPow epoch, if any.
    pub fn kawpow_epoch(&self) -> Option<u32> {
        self.kawpow_epoch
    }
}

// ── GpuBackend trait implementation ──────────────────────────────────

#[cfg(feature = "gpu-opencl")]
impl crate::gpu_backend::GpuBackend for GpuMiner {
    fn mine(
        &mut self,
        algorithm: &str,
        header: &[u8],
        extra: &[u8],
        target: &[u8; 32],
        base_nonce: u64,
        batch_size: u64,
    ) -> Result<Option<crate::gpu_backend::GpuFoundShare>> {
        // Delegate to the existing mine() method, then convert.
        let result = GpuMiner::mine(self, algorithm, header, extra, target, base_nonce, batch_size)?;
        Ok(result.map(crate::gpu_backend::GpuFoundShare::from))
    }

    fn set_ethash_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()> {
        GpuMiner::set_ethash_dag(self, dag, size_entries, epoch)
    }

    fn set_kawpow_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()> {
        GpuMiner::set_kawpow_dag(self, dag, size_entries, epoch)
    }

    fn device_name(&self) -> &str {
        &self.device_name
    }

    fn backend_name(&self) -> &str {
        "opencl"
    }

    fn work_size(&self) -> usize {
        self.work_size
    }

    fn set_work_size(&mut self, size: usize) {
        self.work_size = size;
    }
}

/// OpenCL backend module — re-exports for the gpu_backend abstraction.
#[cfg(feature = "gpu-opencl")]
pub mod opencl_backend {
    use super::*;

    /// Create a new OpenCL backend (wraps GpuMiner).
    pub fn new(work_size: usize) -> Result<GpuMiner> {
        let mut miner = GpuMiner::new()?;
        miner.work_size = work_size;
        Ok(miner)
    }

    /// List available OpenCL devices.
    pub fn list_devices() -> Vec<String> {
        // Simplified: just return a placeholder if kernels exist.
        // Full device enumeration requires OpenCL runtime which may not be available.
        match GpuMiner::list_kernels() {
            Ok(kernels) => {
                if kernels.is_empty() {
                    Vec::new()
                } else {
                    vec!["opencl:default".to_string()]
                }
            }
            Err(_) => Vec::new(),
        }
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
            assert!(
                kernels.iter().any(|k| k.contains("autolykos")),
                "autolykos kernel should exist"
            );
            assert!(
                kernels.iter().any(|k| k.contains("zelhash")),
                "zelhash kernel should exist"
            );
        }
    }

    /// Verify zelhash_kernel.cl file exists on disk.
    #[test]
    fn zelhash_kernel_file_exists() {
        let kernel_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("csrc/opencl/zelhash_kernel.cl");
        assert!(
            kernel_path.exists(),
            "zelhash_kernel.cl must exist at csrc/opencl/"
        );
        let source = std::fs::read_to_string(&kernel_path).unwrap();
        assert!(source.contains("zelhash_mine"), "kernel must define zelhash_mine");
        assert!(source.contains("blake2b_compress"), "kernel must have blake2b");
        assert!(source.contains("ZelProof"), "kernel must use ZelProof personalization");
    }

    /// Verify all CUDA kernel files exist.
    #[test]
    fn cuda_kernel_files_exist() {
        let cuda_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("csrc/cuda");
        let kernels = ["blake3_kernel.cu", "kheavyhash_kernel.cu", "autolykos_kernel.cu",
                       "ethash_kernel.cu", "kawpow_kernel.cu", "zelhash_kernel.cu"];
        for k in &kernels {
            let path = cuda_dir.join(k);
            assert!(path.exists(), "CUDA kernel {k} must exist at csrc/cuda/");
            let source = std::fs::read_to_string(&path).unwrap();
            assert!(source.contains("__global__"), "{k} must have __global__ kernel");
            assert!(source.contains("extern \"C\""), "{k} must have extern C for cudarc");
            assert!(source.contains("__launch_bounds__"), "{k} must have launch bounds");
        }
    }

    /// Verify all Metal kernel files exist.
    #[test]
    fn metal_kernel_files_exist() {
        let metal_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("csrc/metal");
        let kernels = ["blake3_kernel.metal", "kheavyhash_kernel.metal", "autolykos_kernel.metal",
                       "ethash_kernel.metal", "kawpow_kernel.metal", "zelhash_kernel.metal"];
        for k in &kernels {
            let path = metal_dir.join(k);
            assert!(path.exists(), "Metal kernel {k} must exist at csrc/metal/");
            let source = std::fs::read_to_string(&path).unwrap();
            assert!(source.contains("kernel void"), "{k} must have kernel void");
            assert!(source.contains("metal_stdlib"), "{k} must include metal_stdlib");
            assert!(source.contains("[[buffer"), "{k} must use Metal buffer syntax");
        }
    }

    /// Verify kernel_info maps zelhash correctly.
    #[test]
    fn zelhash_kernel_info_correct() {
        assert_eq!(
            kernel_info("zelhash"),
            Some(("zelhash_kernel.cl", "zelhash_mine"))
        );
        assert_eq!(
            kernel_info("zelhash_flux"),
            Some(("zelhash_kernel.cl", "zelhash_mine"))
        );
        assert_eq!(kernel_info("unknown_algo"), None);
    }

    /// Verify the host BLAKE2b-256 (used by Autolykos v2 table generation)
    /// against the RFC 7693 test vector for "abc".
    #[test]
    fn autolykos_blake2b256_known_vector() {
        use blake2::digest::{Update, VariableOutput};
        let mut hasher = blake2::Blake2bVar::new(32).unwrap();
        hasher.update(b"abc");
        let mut out = [0u8; 32];
        hasher.finalize_variable(&mut out).unwrap();
        // BLAKE2b-256("abc") per RFC 7693 / official test vectors
        // (cross-checked against Python hashlib.blake2b).
        let expected: [u8; 32] = [
            0xbd, 0xdd, 0x81, 0x3c, 0x63, 0x42, 0x39, 0x72, 0x31, 0x71, 0xef, 0x3f, 0xee, 0x98,
            0x57, 0x9b, 0x94, 0x96, 0x4e, 0x3b, 0xb1, 0xcb, 0x3e, 0x42, 0x72, 0x62, 0xc8, 0xc0,
            0x68, 0xd5, 0x23, 0x19,
        ];
        assert_eq!(out, expected, "BLAKE2b-256(abc) must match RFC 7693 vector");
    }

    /// Autolykos v2 table generation must be deterministic for a fixed
    /// header + height, and elements must depend on the index.
    #[test]
    fn autolykos_table_deterministic() {
        let header = [42u8; 32];
        let t0 = generate_autolykos_table(&header, 1_000_000, 1024);
        let t1 = generate_autolykos_table(&header, 1_000_000, 1024);
        assert_eq!(t0, t1, "table must be deterministic");
        // Different indices produce different elements (overwhelmingly likely).
        assert_ne!(t0[0], t0[1], "neighbouring elements should differ");
        // Different height produces a different table.
        let t2 = generate_autolykos_table(&header, 1_000_001, 1024);
        assert_ne!(t0, t2, "table must depend on height");
    }

    /// `gen_autolykos_element` returns a u64 derived from BLAKE2b-256.
    #[test]
    fn autolykos_element_is_u64() {
        use sha2::Digest;
        let mut h = sha2::Sha256::new();
        h.update(&[1u8; 32]);
        let seed: [u8; 32] = h.finalize().into();
        let e = gen_autolykos_element(7, &seed, 417_792);
        // Should be deterministic.
        assert_eq!(e, gen_autolykos_element(7, &seed, 417_792));
    }
}
