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

/// Cached ProgPow DAG uploaded to the GPU device.
/// Same structure as EthashDag — ProgPow uses the same DAG format (16 ulongs
/// per entry = 128 bytes) but with a different mixing loop.
#[derive(Clone)]
struct ProgpowDag {
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
    /// Cached ProgPow DAG buffer (set via `set_progpow_dag` before mining EPIC).
    progpow_dag: Option<ProgpowDag>,
    /// Cached Pearl PoUW buffers (reused across nonces to avoid allocation overhead).
    #[cfg(feature = "gpu-opencl")]
    pearl_buffers: Option<PearlPouwBufferCache>,
}

/// Cached OpenCL buffers for Pearl PoUW pipeline, reused across nonces.
/// Keyed by (m, n, k, rank) — if parameters change, a new cache is created.
#[cfg(feature = "gpu-opencl")]
struct PearlPouwBufferCache {
    m: usize,
    n: usize,
    k: usize,
    rank: usize,
    num_row_offsets: usize,
    num_col_offsets: usize,
    matrix_a_buf: Buffer<i8>,
    matrix_bt_buf: Buffer<i8>,
    chunk_hashes_buf: Buffer<u8>,
    merkle_buf: Buffer<u8>,
    root_a_buf: Buffer<u8>,
    root_b_buf: Buffer<u8>,
    b_noise_seed_buf: Buffer<u8>,
    a_noise_seed_buf: Buffer<u8>,
    e_al_buf: Buffer<i8>,
    e_br_buf: Buffer<i8>,
    e_ar_perm_buf: Buffer<u32>,
    e_bl_perm_buf: Buffer<u32>,
    noised_a_buf: Buffer<i32>,
    noised_b_buf: Buffer<i32>,
    iv_buf: Buffer<u8>,
    seed_label_a_buf: Buffer<u8>,
    seed_label_b_buf: Buffer<u8>,
    row_off_buf: Buffer<u32>,
    col_off_buf: Buffer<u32>,
    rows_base_buf: Buffer<u32>,
    cols_base_buf: Buffer<u32>,
    output_tile_buf: Buffer<u32>,
    output_jackpot_buf: Buffer<u8>,
    found_buf: Buffer<u32>,
    // Batch buffers for persistent mining (allocated lazily)
    batch_noised_a: Option<Buffer<i32>>,
    batch_noised_b: Option<Buffer<i32>>,
    batch_noise_seeds: Option<Buffer<u8>>,
    batch_output_nonce: Option<Buffer<u8>>,
    batch_size: usize,
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
        "progpow" | "progpow_epic" => Some(("progpow_kernel.cl", "progpow_mine")),
        "pearlhash" | "pearlhash_prl" => Some(("pearl_kernel.cl", "pearl_mine")),
        _ => None,
    }
}

// ── kHeavyHash matrix generation (host side) ─────────────────────────
//
// Re-exports from gpu_backend for backward compatibility.
pub(crate) use crate::gpu_backend::{generate_kheavy_matrix, autolykos_table_size, generate_autolykos_table};

// ── Autolykos v2 table cache (process-wide) ──────────────────────────

/// Process-wide cache of Autolykos v2 tables, keyed by `(height, table_size)`.
type AutolykosTableCache = std::collections::HashMap<(u32, usize), Vec<u64>>;

fn autolykos_table_cache() -> &'static std::sync::Mutex<AutolykosTableCache> {
    use std::sync::OnceLock;
    static CACHE: OnceLock<std::sync::Mutex<AutolykosTableCache>> = OnceLock::new();
    CACHE.get_or_init(|| std::sync::Mutex::new(AutolykosTableCache::new()))
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
            progpow_dag: None,
            #[cfg(feature = "gpu-opencl")]
            pearl_buffers: None,
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
        let progpow_dag = if matches!(algorithm, "progpow" | "progpow_epic") {
            self.progpow_dag.clone()
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
            "blake3" | "blake3_alph" | "blake3_dcr" | "pearlhash" | "pearlhash_prl" => {
                Self::build_header_nonce_kernel(
                    pro_que,
                    kernel_name,
                    header,
                    target,
                    base_nonce,
                    batch_size,
                    &output_nonce_buf,
                    &output_hash_buf,
                    &found_flag_buf,
                )?
            },
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
            "progpow" | "progpow_epic" => {
                // ProgPow requires the per-epoch DAG to be uploaded first.
                let dag = progpow_dag.ok_or_else(|| {
                    anyhow!(
                        "ProgPow DAG not set; call GpuMiner::set_progpow_dag() \
                         before mining EPIC"
                    )
                })?;
                Self::build_progpow_kernel(
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

        // Batch nonce scanning: optimized kernels scan multiple nonces per
        // work-item (8 for blake3/kheavyhash/zelhash, 4 for autolykos/ethash/kawpow).
        // Adjust global_work_size accordingly.
        let batch_factor = match algorithm {
            "autolykos" | "autolykos_erg" | "ethash" | "etchash" | "ethash_etc"
            | "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc"
            | "progpow" | "progpow_epic" => 4,
            _ => 8, // blake3, kheavyhash, zelhash
        };
        // Work-group size: 128 for memory-bound algos, 256 for compute-bound.
        let wg_size = match algorithm {
            "autolykos" | "autolykos_erg" | "ethash" | "etchash" | "ethash_etc"
            | "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc"
            | "progpow" | "progpow_epic" => 128,
            _ => 256,
        };
        // Round global_work_size up to a multiple of wg_size (required by
        // reqd_work_group_size attribute in the optimized kernels).
        let raw_gws = ((batch_size as usize) / batch_factor)
            .min(self.work_size)
            .max(1);
        let global_work_size = ((raw_gws + wg_size - 1) / wg_size) * wg_size;
        let start = Instant::now();
        unsafe {
            kernel
                .cmd()
                .global_work_size(global_work_size)
                .local_work_size(wg_size)
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

        // Read mix hash for Ethash/KawPow/ProgPow (needed for share submission).
        let mix_hash = if matches!(algorithm, "ethash" | "etchash" | "ethash_etc"
            | "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc"
            | "progpow" | "progpow_epic")
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

    /// Upload the per-epoch ProgPow DAG to the GPU device.
    ///
    /// Same semantics as `set_kawpow_dag` but for ProgPow (EPIC).
    /// The DAG is generated with `PROGPOW_EPOCH_LENGTH=30000`.
    pub fn set_progpow_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()> {
        let expected_len = (size_entries as usize)
            .checked_mul(16)
            .ok_or_else(|| anyhow!("dag_size_entries overflow"))?;
        if dag.len() != expected_len {
            return Err(anyhow!(
                "ProgPow DAG length mismatch: got {} u64 words, expected {} (16 * {} entries)",
                dag.len(),
                expected_len,
                size_entries
            ));
        }

        let q = {
            let pro_que = self.ensure_proque("progpow_kernel.cl")?;
            pro_que.queue().clone()
        };

        let buf: Buffer<u64> = Buffer::builder()
            .queue(q)
            .len(dag.len())
            .copy_host_slice(dag)
            .build()
            .map_err(|e| anyhow!("failed to allocate ProgPow DAG buffer: {e}"))?;

        self.progpow_dag = Some(ProgpowDag {
            buf,
            size_entries,
            epoch,
        });

        Ok(())
    }

    /// Returns the epoch of the currently uploaded ProgPow DAG, if any.
    pub fn progpow_dag_epoch(&self) -> Option<u32> {
        self.progpow_dag.as_ref().map(|d| d.epoch)
    }

    /// Generate the KawPow DAG **on the GPU** from a light cache.
    ///
    /// This is the standard approach used by professional miners (kawpowminer,
    /// ethminer): the light cache (~16–100 MB) is generated on the CPU and
    /// uploaded, then the full DAG (~1–6 GB) is computed in parallel on the
    /// GPU using a `GenerateDAG` OpenCL kernel.  The DAG stays on the GPU —
    /// no multi-GB readback is needed.
    ///
    /// The generated DAG buffer is stored in `self.kawpow_dag` and can be
    /// used immediately for mining.
    ///
    /// **Requires** the `native-hashers` feature (for light cache generation).
    #[cfg(feature = "native-hashers")]
    pub fn generate_kawpow_dag_on_gpu(&mut self, epoch: u32) -> Result<()> {
        use crate::native_ffi::generate_kawpow_light_cache;

        eprintln!(
            "dag_manager: generating KawPow light cache epoch={} on CPU...",
            epoch
        );
        let light_cache = generate_kawpow_light_cache(epoch)
            .ok_or_else(|| anyhow!("kawpow_generate_light_cache returned NULL for epoch {}", epoch))?;

        let cache_items = light_cache.cache_items;
        let dag_size_entries = light_cache.dag_size_entries;
        let dag_nodes = dag_size_entries * 2; // each 128-byte entry = 2 nodes
        let dag_ulongs = dag_nodes * 8;       // each 64-byte node = 8 ulongs

        eprintln!(
            "dag_manager: light cache ready ({} items = {:.1} MB), DAG will be {} nodes = {:.1} GB",
            cache_items,
            light_cache.cache_size as f64 / (1024.0 * 1024.0),
            dag_nodes,
            (dag_nodes as f64 * 64.0) / (1024.0 * 1024.0 * 1024.0)
        );

        // Get the ProQue for kawpow_kernel.cl (which now has both kawpow_mine
        // and kawpow_generate_dag kernels).
        // Copy work_size before borrowing self for ensure_proque.
        let batch_size = self.work_size;
        let pro_que = self.ensure_proque("kawpow_kernel.cl")?;
        let q = pro_que.queue().clone();

        // Upload the light cache to the GPU.
        // The cache is stored as bytes; we need it as u64 words for the kernel.
        let cache_bytes = light_cache.as_slice();
        let cache_u64_count = cache_bytes.len() / 8;
        let cache_u64: Vec<u64> = (0..cache_u64_count)
            .map(|i| {
                u64::from_le_bytes(cache_bytes[i*8..i*8+8].try_into().unwrap())
            })
            .collect();

        eprintln!(
            "dag_manager: uploading light cache to GPU ({} ulongs = {:.1} MB)...",
            cache_u64.len(),
            (cache_u64.len() * 8) as f64 / (1024.0 * 1024.0)
        );

        let cache_buf: Buffer<u64> = Buffer::builder()
            .queue(q.clone())
            .len(cache_u64.len())
            .copy_host_slice(&cache_u64)
            .build()
            .map_err(|e| anyhow!("failed to allocate light cache buffer: {e}"))?;

        // Allocate the DAG buffer on the GPU (no host data — will be filled by kernel).
        eprintln!(
            "dag_manager: allocating DAG buffer on GPU ({} ulongs = {:.1} GB)...",
            dag_ulongs,
            (dag_ulongs * 8) as f64 / (1024.0 * 1024.0 * 1024.0)
        );

        let dag_buf: Buffer<u64> = Buffer::builder()
            .queue(q.clone())
            .len(dag_ulongs as usize)
            .build()
            .map_err(|e| anyhow!("failed to allocate GPU DAG buffer: {e}"))?;

        // Run the GenerateDAG kernel in batches.
        // Each work-item generates one 64-byte node.
        // Batch size = work_size (typically 4M+ for Vega).
        let total_nodes = dag_nodes as usize;
        let num_batches = (total_nodes + batch_size - 1) / batch_size;

        eprintln!(
            "dag_manager: generating DAG on GPU ({} batches of {} nodes)...",
            num_batches, batch_size
        );

        let start_time = std::time::Instant::now();

        for batch in 0..num_batches {
            let start_node = (batch * batch_size) as u64;
            let nodes_this_batch = std::cmp::min(batch_size, total_nodes - batch * batch_size);

            let dag_kernel = Kernel::builder()
                .queue(q.clone())
                .program(pro_que.program())
                .name("kawpow_generate_dag")
                .arg(&cache_buf)
                .arg(cache_items)
                .arg(&dag_buf)
                .arg(dag_nodes)
                .arg(start_node)
                .build()
                .map_err(|e| anyhow!("DAG kernel build failed (batch {}): {e}", batch))?;

            unsafe {
                dag_kernel
                    .cmd()
                    .global_work_size(nodes_this_batch)
                    .enq()
                    .map_err(|e| anyhow!("DAG kernel enqueue failed (batch {}): {e}", batch))?;
            }
            q.finish()
                .map_err(|e| anyhow!("DAG kernel finish failed (batch {}): {e}", batch))?;

            // Progress report every 10% or on the last batch
            let pct = ((batch + 1) * 100) / num_batches;
            if pct % 10 == 0 || batch + 1 == num_batches {
                let elapsed = start_time.elapsed().as_secs_f64();
                let eta = if batch > 0 {
                    (elapsed / (batch + 1) as f64) * (num_batches - batch - 1) as f64
                } else {
                    0.0
                };
                eprintln!(
                    "dag_manager: DAG generation {}% (batch {}/{}, {:.1}s elapsed, ~{:.0}s ETA)",
                    pct, batch + 1, num_batches, elapsed, eta
                );
            }
        }

        // The DAG is now on the GPU. Store it.
        self.kawpow_dag = Some(KawpowDag {
            buf: dag_buf,
            size_entries: dag_size_entries,
            epoch,
        });

        eprintln!(
            "dag_manager: KawPow DAG epoch={} ready on GPU ({:.1}s total)",
            epoch,
            start_time.elapsed().as_secs_f64()
        );

        Ok(())
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
                    "progpow_kernel.cl" => include_str!("../csrc/opencl/progpow_kernel.cl"),
                    "zelhash_kernel.cl" => include_str!("../csrc/opencl/zelhash_kernel.cl"),
                    "pearl_kernel.cl" => include_str!("../csrc/opencl/pearl_kernel.cl"),
                    "pearl_pouw_native.cl" => include_str!("../csrc/opencl/pearl_pouw_native.cl"),
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

    /// Build the ProgPow kernel with a DAG buffer.
    ///
    /// Similar to KawPow but with an additional `prog_seed` parameter
    /// (height / PROGPOW_PERIOD) for the KISS99 RNG that drives the
    /// random math sequence.
    #[allow(clippy::too_many_arguments)]
    fn build_progpow_kernel(
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

        // ProgPow kernel signature:
        //   progpow_mine(header, target, dag, dag_entries, prog_seed,
        //               base_nonce, batch_size, out_nonce, out_hash, out_mix, found)
        // prog_seed = 0 for now (simplified — no random math sequence)
        let prog_seed: u32 = 0;

        let kernel = Kernel::builder()
            .queue(q.clone())
            .program(pro_que.program())
            .name(kernel_name)
            .arg(&header_buf)
            .arg(&target_buf)
            .arg(dag_buf)
            .arg(dag_entries)
            .arg(prog_seed)
            .arg(base_nonce)
            .arg(batch_size)
            .arg(output_nonce_buf)
            .arg(output_hash_buf)
            .arg(output_mix_buf)
            .arg(found_flag_buf)
            .build()
            .map_err(|e| anyhow!("ProgPow kernel build failed: {e}"))?;

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
use crate::native_ffi::generate_ethash_dag;

/// Manages DAG generation and GPU upload for Ethash, KawPow, and ProgPow.
#[cfg(feature = "native-hashers")]
pub struct DagManager {
    /// Currently loaded Ethash epoch (None = not loaded).
    ethash_epoch: Option<u32>,
    /// Currently loaded KawPow epoch (None = not loaded).
    kawpow_epoch: Option<u32>,
    /// Currently loaded ProgPow epoch (None = not loaded).
    progpow_epoch: Option<u32>,
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
            progpow_epoch: None,
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
    ///
    /// Uses on-GPU DAG generation (the standard approach used by kawpowminer/
    /// ethminer): the light cache is generated on CPU and uploaded, then the
    /// full DAG is computed in parallel on the GPU.  This avoids the
    /// multi-minute CPU DAG generation that was the previous bottleneck.
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

        // Try disk cache first (for subsequent startups).
        // The first time, we generate on GPU and optionally save to disk.
        let cache_path = self.cache_dir.join(format!("kawpow_epoch{}.bin", epoch));
        if cache_path.exists() {
            eprintln!("dag_manager: loading KawPow DAG from disk cache: {}", cache_path.display());
            let (dag_u64, dag_entries) = Self::load_dag_from_disk(&cache_path)?;
            eprintln!(
                "dag_manager: uploading KawPow DAG to GPU ({} entries = {:.1} MB)",
                dag_entries,
                dag_entries as f64 * 128.0 / (1024.0 * 1024.0)
            );
            miner.set_kawpow_dag(&dag_u64, dag_entries, epoch)?;
        } else {
            // Generate the DAG on the GPU (no CPU generation, no readback).
            miner.generate_kawpow_dag_on_gpu(epoch)?;

            // Optionally save the DAG to disk for future startups.
            // This requires reading the DAG back from the GPU, which is slow
            // (~5.7 GB readback), so we skip it by default.  Set
            // ZION_DAG_DISK_CACHE=1 to enable.
            if std::env::var("ZION_DAG_DISK_CACHE").is_ok() {
                eprintln!("dag_manager: ZION_DAG_DISK_CACHE=1, reading DAG back from GPU for disk cache...");
                // Clone the buffer handle and size out first to avoid borrowing conflict
                let (dag_size_entries, dag_buf) = miner.kawpow_dag.as_ref()
                    .map(|d| (d.size_entries, d.buf.clone()))
                    .ok_or_else(|| anyhow!("kawpow_dag not set after GPU generation"))?;
                let q = {
                    let pro_que = miner.ensure_proque("kawpow_kernel.cl")?;
                    pro_que.queue().clone()
                };
                let total_ulongs = (dag_size_entries * 16) as usize;
                let mut dag_u64 = vec![0u64; total_ulongs];
                dag_buf.read(&mut dag_u64).enq()
                    .map_err(|e| anyhow!("failed to read DAG from GPU: {e}"))?;
                q.finish().map_err(|e| anyhow!("GPU read finish failed: {e}"))?;
                self.save_dag_to_disk(&cache_path, &dag_u64, dag_size_entries)?;
            }
        }

        self.kawpow_epoch = Some(epoch);
        eprintln!("dag_manager: KawPow DAG epoch={} ready", epoch);
        Ok(())
    }

    /// Ensure the GPU miner has the correct ProgPow DAG loaded for `epoch`.
    ///
    /// ProgPow uses the same DAG format as Ethash (128-byte entries, 16 u64
    /// words per entry, epoch length 30000).  The DAG is generated via the
    /// same C FFI (`ethash_generate_dag`) and cached on disk under
    /// `progpow_epoch{N}.bin` (separate from the Ethash cache so that
    /// switching coins doesn't invalidate each other's cache).
    pub fn ensure_progpow_dag(
        &mut self,
        miner: &mut GpuMiner,
        epoch: u32,
    ) -> Result<()> {
        if self.progpow_epoch == Some(epoch) && miner.progpow_dag_epoch() == Some(epoch) {
            return Ok(()); // already loaded
        }

        eprintln!(
            "dag_manager: loading ProgPow DAG epoch={} (cache_dir={})",
            epoch, self.cache_dir.display()
        );

        // Try disk cache first (separate file from Ethash)
        let cache_path = self.cache_dir.join(format!("progpow_epoch{}.bin", epoch));
        let (dag_u64, dag_entries) = if cache_path.exists() {
            eprintln!("dag_manager: loading ProgPow DAG from disk cache: {}", cache_path.display());
            Self::load_dag_from_disk(&cache_path)?
        } else {
            eprintln!("dag_manager: generating ProgPow DAG epoch={} via FFI...", epoch);
            let dag = generate_ethash_dag(epoch)
                .ok_or_else(|| anyhow!("ethash_generate_dag returned NULL for epoch {}", epoch))?;
            let entries = dag.dag_size_entries;
            let u64_slice = dag.as_u64_slice().to_vec();
            self.save_dag_to_disk(&cache_path, &u64_slice, entries)?;
            (u64_slice, entries)
        };

        eprintln!(
            "dag_manager: uploading ProgPow DAG to GPU ({} entries = {:.1} MB)",
            dag_entries,
            dag_entries as f64 * 128.0 / (1024.0 * 1024.0)
        );
        miner.set_progpow_dag(&dag_u64, dag_entries, epoch)?;
        self.progpow_epoch = Some(epoch);
        eprintln!("dag_manager: ProgPow DAG epoch={} ready", epoch);
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
            "progpow" | "progpow_epic" => {
                // ProgPow uses the same DAG format as Ethash (epoch 30000),
                // but uploads to a separate GPU buffer (progpow_dag, not
                // ethash_dag) so both algorithms can mine simultaneously.
                self.ensure_progpow_dag(miner, epoch)
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

    /// Returns the currently loaded ProgPow epoch, if any.
    pub fn progpow_epoch(&self) -> Option<u32> {
        self.progpow_epoch
    }
}

// ─── Pearl PoUW GPU-Native Pipeline (OpenCL) ─────────────────────────────

/// Input for GPU-native Pearl PoUW mining (no CPU data prep needed).
/// Mirrors `gpu_metal::PearlPouwNativeInput` for the OpenCL backend.
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

/// Result of GPU-native Pearl PoUW mining (includes matrices for Merkle proof).
/// Mirrors `gpu_metal::PearlPouwNativeResult` for the OpenCL backend.
pub struct PearlPouwNativeResult {
    pub tile_index: u32,
    pub jackpot_hash: [u8; 32],
    pub nonce: u64,
    pub matrix_a: Vec<i8>,
    pub matrix_bt: Vec<i8>,
}

/// Result of real Pearl PoUW GPU GEMM mining (CPU-prep + GPU dispatch).
/// Contains the winning hash tile index and jackpot hash, plus dimension
/// metadata needed to decode the tile index back to row/column indices.
pub struct PearlRealGpuResult {
    pub tile_index: u32,
    pub jackpot_hash: [u8; 32],
    pub m: usize,
    pub n: usize,
    pub k: usize,
    pub noise_rank: usize,
    pub hash_tile_h: usize,
    pub hash_tile_w: usize,
    pub num_ht_h: usize,
    pub num_ht_w: usize,
    pub num_output_tiles_i: usize,
    pub num_output_tiles_j: usize,
}

impl PearlRealGpuResult {
    /// Decode the tile_index into (a_row_indices, b_col_indices) for the
    /// winning hash tile. These are the rows of A and columns of B that
    /// need to be included in the Merkle proof.
    pub fn decode_tile_indices(&self) -> (Vec<usize>, Vec<usize>) {
        let hash_tiles_per_output = self.num_ht_h * self.num_ht_w;
        let output_tile_idx = self.tile_index as usize / hash_tiles_per_output;
        let ht_idx = self.tile_index as usize % hash_tiles_per_output;

        let i_out = output_tile_idx / self.num_output_tiles_j;
        let j_out = output_tile_idx % self.num_output_tiles_j;

        let ht_h_idx = ht_idx / self.num_ht_w;
        let ht_w_idx = ht_idx % self.num_ht_w;

        let i_off = i_out * self.noise_rank + ht_h_idx * self.hash_tile_h;
        let j_off = j_out * self.noise_rank + ht_w_idx * self.hash_tile_w;

        let a_row_indices: Vec<usize> = (0..self.hash_tile_h)
            .map(|u| i_off + u)
            .collect();
        let b_col_indices: Vec<usize> = (0..self.hash_tile_w)
            .map(|v| j_off + v)
            .collect();

        (a_row_indices, b_col_indices)
    }
}

/// Compute a safe (power-of-2) local work size that divides the global work size.
/// OpenCL requires `global_work_size % local_work_size == 0` and `local_work_size <= global_work_size`.
#[cfg(feature = "gpu-opencl")]
fn safe_lws(global: usize, max_lws: usize) -> usize {
    let mut lws = max_lws.min(global);
    while lws > 1 && global % lws != 0 {
        lws /= 2;
    }
    lws.max(1)
}

/// Round global work size up to a multiple of local work size.
#[cfg(feature = "gpu-opencl")]
fn round_up_gws(global: usize, lws: usize) -> usize {
    ((global + lws - 1) / lws) * lws
}

impl GpuMiner {
    /// Fully GPU-native Pearl PoUW mining pipeline (OpenCL).
    ///
    /// All 7 steps run on GPU:
    /// 1. Matrix generation (PCG32 PRNG from nonce)
    /// 2. BLAKE3 chunk hashing (keyed with job_key)
    /// 3. BLAKE3 Merkle tree reduction → root hashes
    /// 4. Noise seed derivation
    /// 5. Noise generation (E_AL, E_AR, E_BL, E_BR)
    /// 6. Noised matrix computation
    /// 7. MatMul + jackpot + target check
    ///
    /// CPU only provides job_key, nonce, and mining config.
    /// Returns winning tile index + jackpot hash + matrices (for Merkle proof).
    pub fn pearl_pouw_mine_native(
        &mut self,
        input: &PearlPouwNativeInput<'_>,
    ) -> Result<Option<PearlPouwNativeResult>> {
        let kernel_file = "pearl_pouw_native.cl";
        let m = input.m;
        let n = input.n;
        let k = input.k;
        let rank = input.rank;
        let mk = m * k;
        let nk = n * k;

        let pro_que = self.ensure_proque(kernel_file)?;
        let q = pro_que.queue().clone();
        let program = pro_que.program().clone();
        let _ = pro_que; // release mutable borrow of self before accessing self.pearl_buffers

        let profile = std::env::var("PEARL_PROFILE").is_ok();
        let mut prof_timings: Vec<(&str, f64)> = Vec::new();
        let prof_t0 = std::time::Instant::now();
        let mut prof_last = prof_t0;

        // ── Buffer management: reuse cached buffers across nonces ─────────
        let num_chunks_a = mk.div_ceil(1024);
        let num_chunks_b = nk.div_ceil(1024);
        let max_chunks = num_chunks_a.max(num_chunks_b);

        let cache_match = self.pearl_buffers.as_ref().map_or(false, |c| {
            c.m == m && c.n == n && c.k == k && c.rank == rank &&
            c.num_row_offsets == input.row_offsets.len() &&
            c.num_col_offsets == input.col_offsets.len()
        });

        // Take cache out of self (will put it back before returning)
        let cache = if cache_match {
            self.pearl_buffers.take().unwrap()
        } else {
            // Create all new buffers
            let matrix_a_buf: Buffer<i8> = Buffer::builder().queue(q.clone()).len(mk).build()?;
            let matrix_bt_buf: Buffer<i8> = Buffer::builder().queue(q.clone()).len(nk).build()?;
            let chunk_hashes_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(max_chunks * 32).build()?;
            let merkle_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(max_chunks * 32).build()?;
            let root_a_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).build()?;
            let root_b_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).build()?;
            let b_noise_seed_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).build()?;
            let a_noise_seed_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).build()?;
            let e_al_buf: Buffer<i8> = Buffer::builder().queue(q.clone()).len(m * rank).build()?;
            let e_br_buf: Buffer<i8> = Buffer::builder().queue(q.clone()).len(n * rank).build()?;
            let e_ar_perm_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(k * 2).build()?;
            let e_bl_perm_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(k * 2).build()?;
            let noised_a_buf: Buffer<i32> = Buffer::builder().queue(q.clone()).len(mk).build()?;
            let noised_b_buf: Buffer<i32> = Buffer::builder().queue(q.clone()).len(nk).build()?;
            let iv_bytes: [u8; 32] = [
                0x67, 0xE6, 0x09, 0x6A, 0x85, 0xAE, 0x67, 0xBB,
                0x72, 0xF3, 0x6E, 0x3C, 0x3A, 0xF5, 0x4F, 0xA5,
                0x7F, 0x52, 0x0E, 0x51, 0x8C, 0x68, 0x05, 0x9B,
                0xAB, 0xD9, 0x83, 0x1F, 0x19, 0xCD, 0xE0, 0x5B,
            ];
            let iv_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).copy_host_slice(&iv_bytes).build()?;
            let seed_label_a_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).copy_host_slice(&input.seed_label_a).build()?;
            let seed_label_b_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).copy_host_slice(&input.seed_label_b).build()?;
            let row_off_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(input.row_offsets.len()).copy_host_slice(input.row_offsets).build()?;
            let col_off_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(input.col_offsets.len()).copy_host_slice(input.col_offsets).build()?;
            let rows_base_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(input.rows_base.len()).copy_host_slice(input.rows_base).build()?;
            let cols_base_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(input.cols_base.len()).copy_host_slice(input.cols_base).build()?;
            let output_tile_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(1).build()?;
            let output_jackpot_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).build()?;
            let found_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(1).build()?;
            PearlPouwBufferCache {
                m, n, k, rank,
                num_row_offsets: input.row_offsets.len(),
                num_col_offsets: input.col_offsets.len(),
                matrix_a_buf, matrix_bt_buf, chunk_hashes_buf, merkle_buf,
                root_a_buf, root_b_buf, b_noise_seed_buf, a_noise_seed_buf,
                e_al_buf, e_br_buf, e_ar_perm_buf, e_bl_perm_buf,
                noised_a_buf, noised_b_buf, iv_buf, seed_label_a_buf, seed_label_b_buf,
                row_off_buf, col_off_buf, rows_base_buf, cols_base_buf,
                output_tile_buf, output_jackpot_buf, found_buf,
                batch_noised_a: None, batch_noised_b: None,
                batch_noise_seeds: None, batch_output_nonce: None,
                batch_size: 0,
            }
        };

        // Per-nonce: upload job_key, target, and reset found/output_tile
        let job_key_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone()).len(32).copy_host_slice(&input.job_key).build()?;
        let target_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone()).len(32).copy_host_slice(&input.target).build()?;
        let zero: [u32; 1] = [0u32];
        cache.found_buf.write(&zero[..]).enq()?;
        cache.output_tile_buf.write(&zero[..]).enq()?;

        // Reference cached buffers for kernel args (use &cache.field directly to avoid &&Buffer)
        let matrix_a_buf = &cache.matrix_a_buf;
        let matrix_bt_buf = &cache.matrix_bt_buf;
        let chunk_hashes_buf = &cache.chunk_hashes_buf;
        let merkle_buf = &cache.merkle_buf;
        let root_a_buf = &cache.root_a_buf;
        let root_b_buf = &cache.root_b_buf;
        let b_noise_seed_buf = &cache.b_noise_seed_buf;
        let a_noise_seed_buf = &cache.a_noise_seed_buf;
        let e_al_buf = &cache.e_al_buf;
        let e_br_buf = &cache.e_br_buf;
        let e_ar_perm_buf = &cache.e_ar_perm_buf;
        let e_bl_perm_buf = &cache.e_bl_perm_buf;
        let noised_a_buf = &cache.noised_a_buf;
        let noised_b_buf = &cache.noised_b_buf;
        let iv_buf = &cache.iv_buf;
        let seed_label_a_buf = &cache.seed_label_a_buf;
        let seed_label_b_buf = &cache.seed_label_b_buf;
        let output_tile_buf = &cache.output_tile_buf;
        let output_jackpot_buf = &cache.output_jackpot_buf;
        let found_buf = &cache.found_buf;
        let row_off_buf = &cache.row_off_buf;
        let col_off_buf = &cache.col_off_buf;
        let rows_base_buf = &cache.rows_base_buf;
        let cols_base_buf = &cache.cols_base_buf;

        // ── Step 1: Generate matrices A and B^T ────────────────────────
        {
            let kern_gen_a = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_gen_matrix")
                .arg(matrix_a_buf).arg(input.nonce)
                .arg(m as u32).arg(k as u32).arg(0u32)
                .build()?;
            unsafe { kern_gen_a.cmd().global_work_size(mk as usize).local_work_size(256).enq()?; }

            let kern_gen_bt = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_gen_matrix")
                .arg(matrix_bt_buf).arg(input.nonce)
                .arg(n as u32).arg(k as u32).arg(1u32)
                .build()?;
            unsafe { kern_gen_bt.cmd().global_work_size(nk as usize).local_work_size(256).enq()?; }
        }
        if profile { q.finish()?; prof_timings.push(("step1_gen_matrix", prof_last.elapsed().as_secs_f64() * 1000.0)); prof_last = std::time::Instant::now(); }

        // ── Step 2: BLAKE3 chunk hashing ────────────────────────────────
        {
            let kern_chunk_a = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_blake3_chunk_hash")
                .arg(matrix_a_buf).arg(&job_key_buf).arg(chunk_hashes_buf)
                .arg(num_chunks_a as u32)
                .build()?;
            unsafe { kern_chunk_a.cmd().global_work_size(num_chunks_a).local_work_size(64).enq()?; }

            let kern_chunk_b = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_blake3_chunk_hash")
                .arg(matrix_bt_buf).arg(&job_key_buf).arg(merkle_buf)
                .arg(num_chunks_b as u32)
                .build()?;
            unsafe { kern_chunk_b.cmd().global_work_size(num_chunks_b).local_work_size(64).enq()?; }
        }
        if profile { q.finish()?; prof_timings.push(("step2_blake3_chunk", prof_last.elapsed().as_secs_f64() * 1000.0)); prof_last = std::time::Instant::now(); }

        // ── Step 3: Merkle tree reduction ──────────────────────────────
        // Reduce A: chunk_hashes_buf → root_a_buf
        // Reduce B: merkle_buf → root_b_buf
        {
            // Reduce A
            let mut num_nodes = num_chunks_a;
            let mut src_a: &Buffer<u8> = chunk_hashes_buf;
            let mut dst_a: &Buffer<u8> = merkle_buf;
            let mut level = 0u32;
            while num_nodes > 1 {
                let num_parents = num_nodes / 2;
                let is_root = num_parents == 1;
                let dst = if is_root { root_a_buf } else { dst_a };

                let kern_merge = Kernel::builder()
                    .queue(q.clone()).program(&program).name("pearl_blake3_merge")
                    .arg(src_a).arg(dst)
                    .arg(num_parents as u32).arg(if is_root { 1u32 } else { 0u32 })
                    .build()?;
                let lws = safe_lws(num_parents, 64);
                let gws = round_up_gws(num_parents, lws);
                unsafe { kern_merge.cmd().global_work_size(gws).local_work_size(lws).enq()?; }

                std::mem::swap(&mut src_a, &mut dst_a);
                num_nodes = num_parents;
                level += 1;
            }

            // Reduce B
            let mut num_nodes = num_chunks_b;
            let mut src_b: &Buffer<u8> = merkle_buf;
            let mut dst_b: &Buffer<u8> = chunk_hashes_buf;
            let mut level = 0u32;
            while num_nodes > 1 {
                let num_parents = num_nodes / 2;
                let is_root = num_parents == 1;
                let dst = if is_root { root_b_buf } else { dst_b };

                let kern_merge = Kernel::builder()
                    .queue(q.clone()).program(&program).name("pearl_blake3_merge")
                    .arg(src_b).arg(dst)
                    .arg(num_parents as u32).arg(if is_root { 1u32 } else { 0u32 })
                    .build()?;
                let lws = safe_lws(num_parents, 64);
                let gws = round_up_gws(num_parents, lws);
                unsafe { kern_merge.cmd().global_work_size(gws).local_work_size(lws).enq()?; }

                std::mem::swap(&mut src_b, &mut dst_b);
                num_nodes = num_parents;
                level += 1;
            }
        }
        if profile { q.finish()?; prof_timings.push(("step3_merkle", prof_last.elapsed().as_secs_f64() * 1000.0)); prof_last = std::time::Instant::now(); }

        // ── Step 4: Derive noise seeds ─────────────────────────────────
        // b_noise_seed = blake3(job_key || hash_b)  — unkeyed, 64-byte input
        // a_noise_seed = blake3(b_noise_seed || hash_a)  — unkeyed, 64-byte input
        // We need to assemble seed_msg = job_key || hash_b on the CPU, then upload.
        {
            // Read root_b from GPU
            let mut root_b = [0u8; 32];
            root_b_buf.read(&mut root_b[..]).enq()?;
            // Read root_a from GPU
            let mut root_a = [0u8; 32];
            root_a_buf.read(&mut root_a[..]).enq()?;

            // seed_msg = job_key || hash_b
            let mut seed_msg = [0u8; 64];
            seed_msg[..32].copy_from_slice(&input.job_key);
            seed_msg[32..].copy_from_slice(&root_b);
            let seed_msg_buf_tmp: Buffer<u8> = Buffer::builder()
                .queue(q.clone()).len(64).copy_host_slice(&seed_msg).build()?;

            let kern_seed_b = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_blake3_small_hash")
                .arg(&seed_msg_buf_tmp).arg(64u32).arg(iv_buf).arg(0u32).arg(b_noise_seed_buf)
                .build()?;
            unsafe { kern_seed_b.cmd().global_work_size(1).local_work_size(1).enq()?; }

            // Read b_noise_seed
            let mut b_seed = [0u8; 32];
            b_noise_seed_buf.read(&mut b_seed[..]).enq()?;

            // seed_msg = b_noise_seed || hash_a
            seed_msg[..32].copy_from_slice(&b_seed);
            seed_msg[32..].copy_from_slice(&root_a);
            let seed_msg_buf2: Buffer<u8> = Buffer::builder()
                .queue(q.clone()).len(64).copy_host_slice(&seed_msg).build()?;

            let kern_seed_a = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_blake3_small_hash")
                .arg(&seed_msg_buf2).arg(64u32).arg(iv_buf).arg(0u32).arg(a_noise_seed_buf)
                .build()?;
            unsafe { kern_seed_a.cmd().global_work_size(1).local_work_size(1).enq()?; }
        }
        if profile { q.finish()?; prof_timings.push(("step4_seed_derive", prof_last.elapsed().as_secs_f64() * 1000.0)); prof_last = std::time::Instant::now(); }

        // ── Step 5: Generate noise ─────────────────────────────────────
        {
            // E_AL: m×rank uniform random int8 (key=seed_label_a, seed=a_noise_seed)
            let kern_eal = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_gen_uniform_noise")
                .arg(e_al_buf).arg(a_noise_seed_buf).arg(seed_label_a_buf)
                .arg(m as u32).arg(rank as u32)
                .build()?;
            unsafe { kern_eal.cmd().global_work_size(m * rank).local_work_size(256).enq()?; }

            // E_BR: n×rank uniform random int8 (key=seed_label_b, seed=b_noise_seed)
            let kern_ebr = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_gen_uniform_noise")
                .arg(e_br_buf).arg(b_noise_seed_buf).arg(seed_label_b_buf)
                .arg(n as u32).arg(rank as u32)
                .build()?;
            unsafe { kern_ebr.cmd().global_work_size(n * rank).local_work_size(256).enq()?; }

            // E_AR: k×2 permutation pairs (key=seed_label_a, seed=a_noise_seed)
            let kern_ear = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_gen_permutation")
                .arg(e_ar_perm_buf).arg(a_noise_seed_buf).arg(seed_label_a_buf)
                .arg(k as u32).arg(rank as u32)
                .build()?;
            unsafe { kern_ear.cmd().global_work_size(k).local_work_size(64).enq()?; }

            // E_BL: k×2 permutation pairs (key=seed_label_b, seed=b_noise_seed)
            let kern_ebl = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_gen_permutation")
                .arg(e_bl_perm_buf).arg(b_noise_seed_buf).arg(seed_label_b_buf)
                .arg(k as u32).arg(rank as u32)
                .build()?;
            unsafe { kern_ebl.cmd().global_work_size(k).local_work_size(64).enq()?; }
        }
        if profile { q.finish()?; prof_timings.push(("step5_noise_gen", prof_last.elapsed().as_secs_f64() * 1000.0)); prof_last = std::time::Instant::now(); }

        // ── Step 6: Apply noise to matrices ────────────────────────────
        {
            let kern_na = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_apply_noise_a")
                .arg(noised_a_buf).arg(matrix_a_buf).arg(e_al_buf).arg(e_ar_perm_buf)
                .arg(m as u32).arg(k as u32).arg(rank as u32).arg(0u32)
                .build()?;
            unsafe { kern_na.cmd().global_work_size(mk).local_work_size(256).enq()?; }

            let kern_nb = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_apply_noise_b")
                .arg(noised_b_buf).arg(matrix_bt_buf).arg(e_br_buf).arg(e_bl_perm_buf)
                .arg(n as u32).arg(k as u32).arg(rank as u32).arg(0u32)
                .build()?;
            unsafe { kern_nb.cmd().global_work_size(nk).local_work_size(256).enq()?; }
        }
        if profile { q.finish()?; prof_timings.push(("step6_apply_noise", prof_last.elapsed().as_secs_f64() * 1000.0)); prof_last = std::time::Instant::now(); }

        // ── Step 7: MatMul + jackpot + target check ────────────────────
        {
            let total_tiles = input.row_offsets.len() * input.col_offsets.len();
            let kern_mine = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_pouw_mine_native_v3")
                .arg(noised_a_buf).arg(noised_b_buf).arg(a_noise_seed_buf).arg(&target_buf)
                .arg(row_off_buf).arg(col_off_buf).arg(rows_base_buf).arg(cols_base_buf)
                .arg(output_tile_buf).arg(output_jackpot_buf).arg(found_buf)
                .arg(input.row_offsets.len() as u32)
                .arg(input.col_offsets.len() as u32)
                .arg(k as u32).arg(rank as u32)
                .build()?;
            // v2: one work-group per tile, TILE_H*TILE_W=32 work-items per group
            let lws = 32usize; // TILE_H * TILE_W
            let gws = total_tiles * lws;
            unsafe { kern_mine.cmd().global_work_size(gws).local_work_size(lws).enq()?; }
        }
        if profile { q.finish()?; prof_timings.push(("step7_mine", prof_last.elapsed().as_secs_f64() * 1000.0)); prof_last = std::time::Instant::now(); }

        // ── Read results ───────────────────────────────────────────────
        let mut found = [0u32; 1];
        found_buf.read(&mut found[..]).enq()?;
        if found[0] == 0 {
            if profile {
                q.finish()?;
                prof_timings.push(("readback", prof_last.elapsed().as_secs_f64() * 1000.0));
                let total = prof_t0.elapsed().as_secs_f64() * 1000.0;
                eprint!("PEARL_PROFILE nonce={:>3} |", input.nonce);
                for (name, ms) in &prof_timings {
                    eprint!(" {}={:.2}ms", name, ms);
                }
                eprintln!(" | TOTAL={:.2}ms", total);
            }
            self.pearl_buffers = Some(cache);
            return Ok(None);
        }

        let mut tile = [0u32; 1];
        output_tile_buf.read(&mut tile[..]).enq()?;
        let mut jackpot_hash = [0u8; 32];
        output_jackpot_buf.read(&mut jackpot_hash[..]).enq()?;

        // Read back matrices for Merkle proof construction
        let mut matrix_a = vec![0i8; mk];
        matrix_a_buf.read(&mut matrix_a).enq()?;
        let mut matrix_bt = vec![0i8; nk];
        matrix_bt_buf.read(&mut matrix_bt).enq()?;

        self.pearl_buffers = Some(cache);
        Ok(Some(PearlPouwNativeResult {
            tile_index: tile[0],
            jackpot_hash,
            nonce: input.nonce,
            matrix_a,
            matrix_bt,
        }))
    }

    /// Batched persistent mining: process `batch_size` nonces in a single
    /// mining kernel launch. Steps 1-6 run per-nonce (reusing cached buffers),
    /// then noised matrices are copied to batch buffers. One persistent mining
    /// kernel checks all nonces × tiles in parallel (full GPU occupancy).
    ///
    /// If a share is found, the winning nonce's matrices are regenerated by
    /// re-running steps 1-6 for that nonce (adds ~0.3ms, rare event).
    #[cfg(feature = "gpu-opencl")]
    pub fn pearl_pouw_mine_batched(
        &mut self,
        input: &PearlPouwNativeInput<'_>,
        batch_size: u32,
    ) -> Result<Option<PearlPouwNativeResult>> {
        if batch_size == 0 {
            return Err(anyhow!("batch_size must be > 0"));
        }
        if batch_size == 1 {
            // Fall back to single-nonce path
            return self.pearl_pouw_mine_native(input);
        }

        let kernel_file = "pearl_pouw_native.cl";
        let m = input.m;
        let n = input.n;
        let k = input.k;
        let rank = input.rank;
        let mk = m * k;
        let nk = n * k;
        let bs = batch_size as usize;

        let pro_que = self.ensure_proque(kernel_file)?;
        let q = pro_que.queue().clone();
        let program = pro_que.program().clone();
        let _ = pro_que;

        let profile = std::env::var("PEARL_PROFILE").is_ok();
        let prof_t0 = std::time::Instant::now();

        // ── Ensure cache exists (same logic as single-nonce) ──
        let num_chunks_a = mk.div_ceil(1024);
        let num_chunks_b = nk.div_ceil(1024);
        let max_chunks = num_chunks_a.max(num_chunks_b);

        let cache_match = self.pearl_buffers.as_ref().map_or(false, |c| {
            c.m == m && c.n == n && c.k == k && c.rank == rank &&
            c.num_row_offsets == input.row_offsets.len() &&
            c.num_col_offsets == input.col_offsets.len()
        });

        let mut cache = if cache_match {
            self.pearl_buffers.take().unwrap()
        } else {
            // Create all new single-nonce buffers (same as pearl_pouw_mine_native)
            let matrix_a_buf: Buffer<i8> = Buffer::builder().queue(q.clone()).len(mk).build()?;
            let matrix_bt_buf: Buffer<i8> = Buffer::builder().queue(q.clone()).len(nk).build()?;
            let chunk_hashes_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(max_chunks * 32).build()?;
            let merkle_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(max_chunks * 32).build()?;
            let root_a_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).build()?;
            let root_b_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).build()?;
            let b_noise_seed_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).build()?;
            let a_noise_seed_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).build()?;
            let e_al_buf: Buffer<i8> = Buffer::builder().queue(q.clone()).len(m * rank).build()?;
            let e_br_buf: Buffer<i8> = Buffer::builder().queue(q.clone()).len(n * rank).build()?;
            let e_ar_perm_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(k * 2).build()?;
            let e_bl_perm_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(k * 2).build()?;
            let noised_a_buf: Buffer<i32> = Buffer::builder().queue(q.clone()).len(mk).build()?;
            let noised_b_buf: Buffer<i32> = Buffer::builder().queue(q.clone()).len(nk).build()?;
            let iv_bytes: [u8; 32] = [
                0x67, 0xE6, 0x09, 0x6A, 0x85, 0xAE, 0x67, 0xBB,
                0x72, 0xF3, 0x6E, 0x3C, 0x3A, 0xF5, 0x4F, 0xA5,
                0x7F, 0x52, 0x0E, 0x51, 0x8C, 0x68, 0x05, 0x9B,
                0xAB, 0xD9, 0x83, 0x1F, 0x19, 0xCD, 0xE0, 0x5B,
            ];
            let iv_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).copy_host_slice(&iv_bytes).build()?;
            let seed_label_a_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).copy_host_slice(&input.seed_label_a).build()?;
            let seed_label_b_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).copy_host_slice(&input.seed_label_b).build()?;
            let row_off_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(input.row_offsets.len()).copy_host_slice(input.row_offsets).build()?;
            let col_off_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(input.col_offsets.len()).copy_host_slice(input.col_offsets).build()?;
            let rows_base_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(input.rows_base.len()).copy_host_slice(input.rows_base).build()?;
            let cols_base_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(input.cols_base.len()).copy_host_slice(input.cols_base).build()?;
            let output_tile_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(1).build()?;
            let output_jackpot_buf: Buffer<u8> = Buffer::builder().queue(q.clone()).len(32).build()?;
            let found_buf: Buffer<u32> = Buffer::builder().queue(q.clone()).len(1).build()?;
            PearlPouwBufferCache {
                m, n, k, rank,
                num_row_offsets: input.row_offsets.len(),
                num_col_offsets: input.col_offsets.len(),
                matrix_a_buf, matrix_bt_buf, chunk_hashes_buf, merkle_buf,
                root_a_buf, root_b_buf, b_noise_seed_buf, a_noise_seed_buf,
                e_al_buf, e_br_buf, e_ar_perm_buf, e_bl_perm_buf,
                noised_a_buf, noised_b_buf, iv_buf, seed_label_a_buf, seed_label_b_buf,
                row_off_buf, col_off_buf, rows_base_buf, cols_base_buf,
                output_tile_buf, output_jackpot_buf, found_buf,
                batch_noised_a: None, batch_noised_b: None,
                batch_noise_seeds: None, batch_output_nonce: None,
                batch_size: 0,
            }
        };

        // ── Ensure batch buffers exist with correct size ──
        if cache.batch_size != bs || cache.batch_noised_a.is_none() {
            cache.batch_noised_a = Some(Buffer::builder().queue(q.clone()).len(bs * mk).build()?);
            cache.batch_noised_b = Some(Buffer::builder().queue(q.clone()).len(bs * nk).build()?);
            cache.batch_noise_seeds = Some(Buffer::builder().queue(q.clone()).len(bs * 32).build()?);
            cache.batch_output_nonce = Some(Buffer::builder().queue(q.clone()).len(8).build()?);
            cache.batch_size = bs;
        }

        let batch_noised_a = cache.batch_noised_a.as_ref().unwrap();
        let batch_noised_b = cache.batch_noised_b.as_ref().unwrap();
        let batch_noise_seeds = cache.batch_noise_seeds.as_ref().unwrap();
        let batch_output_nonce = cache.batch_output_nonce.as_ref().unwrap();

        // ── Upload target and reset found ──
        let target_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone()).len(32).copy_host_slice(&input.target).build()?;
        let zero: [u32; 1] = [0u32];
        cache.found_buf.write(&zero[..]).enq()?;
        cache.output_tile_buf.write(&zero[..]).enq()?;

        // Reference cached buffers
        let matrix_a_buf = &cache.matrix_a_buf;
        let matrix_bt_buf = &cache.matrix_bt_buf;
        let chunk_hashes_buf = &cache.chunk_hashes_buf;
        let merkle_buf = &cache.merkle_buf;
        let root_a_buf = &cache.root_a_buf;
        let root_b_buf = &cache.root_b_buf;
        let b_noise_seed_buf = &cache.b_noise_seed_buf;
        let a_noise_seed_buf = &cache.a_noise_seed_buf;
        let e_al_buf = &cache.e_al_buf;
        let e_br_buf = &cache.e_br_buf;
        let e_ar_perm_buf = &cache.e_ar_perm_buf;
        let e_bl_perm_buf = &cache.e_bl_perm_buf;
        let noised_a_buf = &cache.noised_a_buf;
        let noised_b_buf = &cache.noised_b_buf;
        let iv_buf = &cache.iv_buf;
        let seed_label_a_buf = &cache.seed_label_a_buf;
        let seed_label_b_buf = &cache.seed_label_b_buf;
        let row_off_buf = &cache.row_off_buf;
        let col_off_buf = &cache.col_off_buf;
        let rows_base_buf = &cache.rows_base_buf;
        let cols_base_buf = &cache.cols_base_buf;
        let output_tile_buf = &cache.output_tile_buf;
        let output_jackpot_buf = &cache.output_jackpot_buf;
        let found_buf = &cache.found_buf;

        let prof_steps_start = std::time::Instant::now();

        // ── Steps 1-6 for each nonce, copy noised matrices to batch buffers ──
        for nonce_idx in 0..bs {
            let nonce = input.nonce + nonce_idx as u64;

            // Upload job_key for this nonce
            let job_key_buf: Buffer<u8> = Buffer::builder()
                .queue(q.clone()).len(32).copy_host_slice(&input.job_key).build()?;

            // Step 1: Generate matrices
            {
                let kern_gen_a = Kernel::builder()
                    .queue(q.clone()).program(&program).name("pearl_gen_matrix")
                    .arg(matrix_a_buf).arg(nonce)
                    .arg(m as u32).arg(k as u32).arg(0u32)
                    .build()?;
                unsafe { kern_gen_a.cmd().global_work_size(mk).local_work_size(256).enq()?; }

                let kern_gen_bt = Kernel::builder()
                    .queue(q.clone()).program(&program).name("pearl_gen_matrix")
                    .arg(matrix_bt_buf).arg(nonce)
                    .arg(n as u32).arg(k as u32).arg(1u32)
                    .build()?;
                unsafe { kern_gen_bt.cmd().global_work_size(nk).local_work_size(256).enq()?; }
            }

            // Step 2: BLAKE3 chunk hashing (A→chunk_hashes, B→merkle_buf)
            {
                let kern_chunk_a = Kernel::builder()
                    .queue(q.clone()).program(&program).name("pearl_blake3_chunk_hash")
                    .arg(matrix_a_buf).arg(&job_key_buf).arg(chunk_hashes_buf)
                    .arg(num_chunks_a as u32)
                    .build()?;
                unsafe { kern_chunk_a.cmd().global_work_size(num_chunks_a).local_work_size(64).enq()?; }

                let kern_chunk_b = Kernel::builder()
                    .queue(q.clone()).program(&program).name("pearl_blake3_chunk_hash")
                    .arg(matrix_bt_buf).arg(&job_key_buf).arg(merkle_buf)
                    .arg(num_chunks_b as u32)
                    .build()?;
                unsafe { kern_chunk_b.cmd().global_work_size(num_chunks_b).local_work_size(64).enq()?; }
            }

            // Step 3: Merkle tree reduction (A: chunk_hashes→root_a, B: merkle_buf→root_b)
            {
                // Reduce A
                let mut num_nodes = num_chunks_a;
                let mut src_a: &Buffer<u8> = chunk_hashes_buf;
                let mut dst_a: &Buffer<u8> = merkle_buf;
                while num_nodes > 1 {
                    let num_parents = num_nodes / 2;
                    let is_root = num_parents == 1;
                    let dst = if is_root { root_a_buf } else { dst_a };
                    let kern_merge = Kernel::builder()
                        .queue(q.clone()).program(&program).name("pearl_blake3_merge")
                        .arg(src_a).arg(dst)
                        .arg(num_parents as u32).arg(if is_root { 1u32 } else { 0u32 })
                        .build()?;
                    let lws = safe_lws(num_parents, 64);
                    let gws = round_up_gws(num_parents, lws);
                    unsafe { kern_merge.cmd().global_work_size(gws).local_work_size(lws).enq()?; }
                    std::mem::swap(&mut src_a, &mut dst_a);
                    num_nodes = num_parents;
                }

                // Reduce B
                let mut num_nodes = num_chunks_b;
                let mut src_b: &Buffer<u8> = merkle_buf;
                let mut dst_b: &Buffer<u8> = chunk_hashes_buf;
                while num_nodes > 1 {
                    let num_parents = num_nodes / 2;
                    let is_root = num_parents == 1;
                    let dst = if is_root { root_b_buf } else { dst_b };
                    let kern_merge = Kernel::builder()
                        .queue(q.clone()).program(&program).name("pearl_blake3_merge")
                        .arg(src_b).arg(dst)
                        .arg(num_parents as u32).arg(if is_root { 1u32 } else { 0u32 })
                        .build()?;
                    let lws = safe_lws(num_parents, 64);
                    let gws = round_up_gws(num_parents, lws);
                    unsafe { kern_merge.cmd().global_work_size(gws).local_work_size(lws).enq()?; }
                    std::mem::swap(&mut src_b, &mut dst_b);
                    num_nodes = num_parents;
                }
            }

            // Step 4: Derive noise seeds (reads roots from GPU, assembles on CPU)
            {
                let mut root_b = [0u8; 32];
                root_b_buf.read(&mut root_b[..]).enq()?;
                let mut root_a = [0u8; 32];
                root_a_buf.read(&mut root_a[..]).enq()?;

                // b_noise_seed = blake3(job_key || hash_b) — unkeyed, 64-byte input
                let mut seed_msg = [0u8; 64];
                seed_msg[..32].copy_from_slice(&input.job_key);
                seed_msg[32..].copy_from_slice(&root_b);
                let seed_msg_buf: Buffer<u8> = Buffer::builder()
                    .queue(q.clone()).len(64).copy_host_slice(&seed_msg).build()?;

                let kern_seed_b = Kernel::builder()
                    .queue(q.clone()).program(&program).name("pearl_blake3_small_hash")
                    .arg(&seed_msg_buf).arg(64u32).arg(iv_buf).arg(0u32).arg(b_noise_seed_buf)
                    .build()?;
                unsafe { kern_seed_b.cmd().global_work_size(1).local_work_size(1).enq()?; }

                // Read b_noise_seed
                let mut b_seed = [0u8; 32];
                b_noise_seed_buf.read(&mut b_seed[..]).enq()?;

                // a_noise_seed = blake3(b_noise_seed || hash_a) — unkeyed, 64-byte input
                seed_msg[..32].copy_from_slice(&b_seed);
                seed_msg[32..].copy_from_slice(&root_a);
                let seed_msg_buf2: Buffer<u8> = Buffer::builder()
                    .queue(q.clone()).len(64).copy_host_slice(&seed_msg).build()?;

                let kern_seed_a = Kernel::builder()
                    .queue(q.clone()).program(&program).name("pearl_blake3_small_hash")
                    .arg(&seed_msg_buf2).arg(64u32).arg(iv_buf).arg(0u32).arg(a_noise_seed_buf)
                    .build()?;
                unsafe { kern_seed_a.cmd().global_work_size(1).local_work_size(1).enq()?; }
            }

            // Step 5: Generate noise (E_AL, E_BR, E_AR_perm, E_BL_perm)
            {
                let kern_eal = Kernel::builder()
                    .queue(q.clone()).program(&program).name("pearl_gen_uniform_noise")
                    .arg(e_al_buf).arg(a_noise_seed_buf).arg(seed_label_a_buf)
                    .arg(m as u32).arg(rank as u32)
                    .build()?;
                unsafe { kern_eal.cmd().global_work_size(m * rank).local_work_size(256).enq()?; }

                let kern_ebr = Kernel::builder()
                    .queue(q.clone()).program(&program).name("pearl_gen_uniform_noise")
                    .arg(e_br_buf).arg(b_noise_seed_buf).arg(seed_label_b_buf)
                    .arg(n as u32).arg(rank as u32)
                    .build()?;
                unsafe { kern_ebr.cmd().global_work_size(n * rank).local_work_size(256).enq()?; }

                let kern_ear = Kernel::builder()
                    .queue(q.clone()).program(&program).name("pearl_gen_permutation")
                    .arg(e_ar_perm_buf).arg(a_noise_seed_buf).arg(seed_label_a_buf)
                    .arg(k as u32).arg(rank as u32)
                    .build()?;
                unsafe { kern_ear.cmd().global_work_size(k).local_work_size(64).enq()?; }

                let kern_ebl = Kernel::builder()
                    .queue(q.clone()).program(&program).name("pearl_gen_permutation")
                    .arg(e_bl_perm_buf).arg(b_noise_seed_buf).arg(seed_label_b_buf)
                    .arg(k as u32).arg(rank as u32)
                    .build()?;
                unsafe { kern_ebl.cmd().global_work_size(k).local_work_size(64).enq()?; }
            }

            // Step 6: Apply noise — write directly to batch buffers at nonce offset
            {
                let a_off = (nonce_idx * mk) as u32;
                let b_off = (nonce_idx * nk) as u32;

                let kern_apply_a = Kernel::builder()
                    .queue(q.clone()).program(&program).name("pearl_apply_noise_a")
                    .arg(batch_noised_a).arg(matrix_a_buf).arg(e_al_buf).arg(e_ar_perm_buf)
                    .arg(m as u32).arg(k as u32).arg(rank as u32).arg(a_off)
                    .build()?;
                unsafe { kern_apply_a.cmd().global_work_size(mk).local_work_size(256).enq()?; }

                let kern_apply_b = Kernel::builder()
                    .queue(q.clone()).program(&program).name("pearl_apply_noise_b")
                    .arg(batch_noised_b).arg(matrix_bt_buf).arg(e_br_buf).arg(e_bl_perm_buf)
                    .arg(n as u32).arg(k as u32).arg(rank as u32).arg(b_off)
                    .build()?;
                unsafe { kern_apply_b.cmd().global_work_size(nk).local_work_size(256).enq()?; }
            }

            // Copy noise seed (32 bytes) to batch buffer via host
            {
                let mut seed_host = [0u8; 32];
                a_noise_seed_buf.read(&mut seed_host[..]).enq()?;
                batch_noise_seeds.cmd().write(&seed_host[..])
                    .offset(nonce_idx * 32).enq()?;
            }
        }

        if profile { q.finish()?; eprintln!("PEARL_BATCH steps1-6 for {} nonces: {:.2}ms", bs, prof_steps_start.elapsed().as_secs_f64() * 1000.0); }

        let prof_mine_start = std::time::Instant::now();

        // ── Step 7: Persistent batched mining kernel ──
        {
            let total_tiles = input.row_offsets.len() * input.col_offsets.len();
            let lws = 32usize;
            let gws = bs * total_tiles * lws;

            let kern_mine = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_pouw_mine_persistent")
                .arg(batch_noised_a)
                .arg(batch_noised_b)
                .arg(batch_noise_seeds)
                .arg(&target_buf)
                .arg(row_off_buf)
                .arg(col_off_buf)
                .arg(rows_base_buf)
                .arg(cols_base_buf)
                .arg(output_tile_buf)
                .arg(output_jackpot_buf)
                .arg(batch_output_nonce)
                .arg(found_buf)
                .arg(batch_size)
                .arg(input.nonce as u32)
                .arg(input.row_offsets.len() as u32)
                .arg(input.col_offsets.len() as u32)
                .arg(k as u32)
                .arg(rank as u32)
                .arg(m as u32)
                .arg(n as u32)
                .build()?;
            unsafe { kern_mine.cmd().global_work_size(gws).local_work_size(lws).enq()?; }
        }

        // ── Read results ──
        let mut found = [0u32; 1];
        found_buf.read(&mut found[..]).enq()?;

        if profile {
            q.finish()?;
            eprintln!("PEARL_BATCH step7_mine+readback for {} nonces: {:.2}ms ({:.2}ms/nonce)",
                bs, prof_mine_start.elapsed().as_secs_f64() * 1000.0,
                prof_mine_start.elapsed().as_secs_f64() * 1000.0 / bs as f64);
            eprintln!("PEARL_BATCH total for {} nonces: {:.2}ms ({:.2}ms/nonce)",
                bs, prof_t0.elapsed().as_secs_f64() * 1000.0,
                prof_t0.elapsed().as_secs_f64() * 1000.0 / bs as f64);
        }

        if found[0] == 0 {
            self.pearl_buffers = Some(cache);
            return Ok(None);
        }

        // Read winning nonce + tile + jackpot
        let mut tile = [0u32; 1];
        output_tile_buf.read(&mut tile[..]).enq()?;
        let mut jackpot_hash = [0u8; 32];
        output_jackpot_buf.read(&mut jackpot_hash[..]).enq()?;
        let mut nonce_bytes = [0u8; 8];
        batch_output_nonce.read(&mut nonce_bytes[..]).enq()?;
        let winning_nonce = u64::from_le_bytes(nonce_bytes);

        // Regenerate matrices for the winning nonce (re-run steps 1 only)
        let mut matrix_a = vec![0i8; mk];
        let mut matrix_bt = vec![0i8; nk];
        {
            let kern_gen_a = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_gen_matrix")
                .arg(matrix_a_buf).arg(winning_nonce)
                .arg(m as u32).arg(k as u32).arg(0u32)
                .build()?;
            unsafe { kern_gen_a.cmd().global_work_size(mk).local_work_size(256).enq()?; }

            let kern_gen_bt = Kernel::builder()
                .queue(q.clone()).program(&program).name("pearl_gen_matrix")
                .arg(matrix_bt_buf).arg(winning_nonce)
                .arg(n as u32).arg(k as u32).arg(1u32)
                .build()?;
            unsafe { kern_gen_bt.cmd().global_work_size(nk).local_work_size(256).enq()?; }

            matrix_a_buf.read(&mut matrix_a).enq()?;
            matrix_bt_buf.read(&mut matrix_bt).enq()?;
        }

        self.pearl_buffers = Some(cache);
        Ok(Some(PearlPouwNativeResult {
            tile_index: tile[0],
            jackpot_hash,
            nonce: winning_nonce,
            matrix_a,
            matrix_bt,
        }))
    }

    // ─── Real Pearl PoUW: CPU-prep + GPU GEMM dispatch ───────────────────

    /// Run the GEMM + jackpot + target check on GPU for the REAL Pearl PoUW
    /// algorithm. CPU pre-computes the noised matrices (A' and B'^T as int8)
    /// using the real Pearl algorithm (BLAKE3 PRNG, proper noise), then this
    /// function uploads them and runs the mining kernel.
    ///
    /// Returns `Some(result)` if a winning hash tile was found, `None` otherwise.
    /// The caller is responsible for building the Merkle proof from the
    /// original matrices (A, B) and the decoded tile indices.
    #[cfg(feature = "gpu-opencl")]
    pub fn pearl_pouw_gpu_mine_real(
        &mut self,
        noised_a: &[i8],     // m×k int8 (A' = A + E_AL·E_AR, wrapped to int8)
        noised_bt: &[i8],    // n×k int8 (B'^T)
        pow_key: &[u8; 32],  // noise_seed_a (BLAKE3 key for jackpot)
        target: &[u8; 32],   // little-endian U256 target
        m: usize,
        n: usize,
        k: usize,
        noise_rank: usize,
        hash_tile_h: usize,
        hash_tile_w: usize,
    ) -> Result<Option<PearlRealGpuResult>> {
        let kernel_file = "pearl_pouw_native.cl";
        let pro_que = self.ensure_proque(kernel_file)?;
        let q = pro_que.queue().clone();
        let program = pro_que.program().clone();
        let _ = pro_que;

        // Validate dimensions
        if noised_a.len() != m * k {
            return Err(anyhow!("noised_a length mismatch: {} != {}", noised_a.len(), m * k));
        }
        if noised_bt.len() != n * k {
            return Err(anyhow!("noised_bt length mismatch: {} != {}", noised_bt.len(), n * k));
        }
        if m % noise_rank != 0 {
            return Err(anyhow!("m must be divisible by noise_rank"));
        }
        if n % noise_rank != 0 {
            return Err(anyhow!("n must be divisible by noise_rank"));
        }
        if noise_rank % hash_tile_h != 0 {
            return Err(anyhow!("noise_rank must be divisible by hash_tile_h"));
        }
        if noise_rank % hash_tile_w != 0 {
            return Err(anyhow!("noise_rank must be divisible by hash_tile_w"));
        }

        let num_ht_h = noise_rank / hash_tile_h;
        let num_ht_w = noise_rank / hash_tile_w;
        let num_output_tiles_i = m / noise_rank;
        let num_output_tiles_j = n / noise_rank;
        let hash_tiles_per_output = num_ht_h * num_ht_w;
        let total_output_tiles = num_output_tiles_i * num_output_tiles_j;
        let total_hash_tiles = total_output_tiles * hash_tiles_per_output;

        // Upload noised matrices (as i8 bytes)
        let noised_a_buf: Buffer<i8> = Buffer::builder()
            .queue(q.clone()).len(m * k)
            .copy_host_slice(noised_a).build()?;
        let noised_bt_buf: Buffer<i8> = Buffer::builder()
            .queue(q.clone()).len(n * k)
            .copy_host_slice(noised_bt).build()?;
        let pow_key_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone()).len(32)
            .copy_host_slice(pow_key).build()?;
        let target_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone()).len(32)
            .copy_host_slice(target).build()?;

        // Output buffers
        let output_tile_buf: Buffer<u32> = Buffer::builder()
            .queue(q.clone()).len(1).build()?;
        let output_jackpot_buf: Buffer<u8> = Buffer::builder()
            .queue(q.clone()).len(32).build()?;
        let found_buf: Buffer<u32> = Buffer::builder()
            .queue(q.clone()).len(1).fill_val(0u32).build()?;

        // Launch kernel
        let lws = hash_tile_h * hash_tile_w;  // 256 for 16×16
        let gws = total_hash_tiles * lws;

        let kern = Kernel::builder()
            .queue(q.clone())
            .program(&program)
            .name("pearl_pouw_mine_real_v1")
            .arg(&noised_a_buf)
            .arg(&noised_bt_buf)
            .arg(&pow_key_buf)
            .arg(&target_buf)
            .arg(&output_tile_buf)
            .arg(&output_jackpot_buf)
            .arg(&found_buf)
            .arg(m as u32)
            .arg(n as u32)
            .arg(k as u32)
            .arg(noise_rank as u32)
            .arg(hash_tile_h as u32)
            .arg(hash_tile_w as u32)
            .arg(num_ht_h as u32)
            .arg(num_ht_w as u32)
            .arg(num_output_tiles_i as u32)
            .arg(num_output_tiles_j as u32)
            .build()?;

        unsafe {
            kern.cmd()
                .global_work_size(gws)
                .local_work_size(lws)
                .enq()?;
        }
        q.finish()?;

        // Read results
        let mut found = [0u32; 1];
        found_buf.read(&mut found[..]).enq()?;
        if found[0] == 0 {
            return Ok(None);
        }

        let mut tile = [0u32; 1];
        output_tile_buf.read(&mut tile[..]).enq()?;
        let mut jackpot_hash = [0u8; 32];
        output_jackpot_buf.read(&mut jackpot_hash[..]).enq()?;

        Ok(Some(PearlRealGpuResult {
            tile_index: tile[0],
            jackpot_hash,
            m, n, k, noise_rank, hash_tile_h, hash_tile_w,
            num_ht_h, num_ht_w, num_output_tiles_i, num_output_tiles_j,
        }))
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

    fn set_progpow_dag(&mut self, dag: &[u64], size_entries: u64, epoch: u32) -> Result<()> {
        GpuMiner::set_progpow_dag(self, dag, size_entries, epoch)
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
