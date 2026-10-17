//! Dedicated CUDA backend for the Pearl (PRL) PoUW pipeline.
//!
//! Mirrors `ExtGpuMiner::pearl_pouw_mine_native` (OpenCL) step-for-step on
//! top of `cudarc` + NVRTC, using the same kernel port as the OpenCL path:
//!   1. `pearl_gen_matrix`            — PCG32 matrixgen (A, B^T)
//!   2. `pearl_blake3_chunk_hash`     — keyed chunk CVs (counter = chunk idx)
//!   3. `pearl_blake3_merge`          — keyed merkle parents (odd-leaf passthrough)
//!   4. `pearl_blake3_small_hash`     — noise seed derivation (roots bound on CPU)
//!   5. `pearl_gen_uniform_noise`/`pearl_gen_permutation` — low-rank noise
//!   6. `pearl_apply_noise_a`/`pearl_apply_noise_b` — A' / B'^T
//!   7. `pearl_pouw_mine_native_v3`   — tile matmul + jackpot + target check
//!
//! The canonical salted-root bind (SeedDerivation::Salted) is two BLAKE3
//! hashes per attempt — cheaper on CPU than two 1-thread kernel launches +
//! readbacks, so it stays host-side exactly like the OpenCL host.

use anyhow::Result;
use cudarc::driver::{CudaDevice, CudaFunction, CudaSlice, LaunchAsync, LaunchConfig};
use cudarc::nvrtc::{compile_ptx_with_opts, CompileOptions};
use std::sync::Arc;
use std::time::Instant;

use super::cuda_external::{detect_cuda_arch, preprocess_kernel};
use crate::auxpow::pearl::{
    PearlPouwNativeInput, PearlPouwNativeResult, PearlSeedDerivation, PEARL_SEED_LABEL_A,
    PEARL_SEED_LABEL_B, PEARL_SEED_SALT_A, PEARL_SEED_SALT_B,
};
use crate::gpu::{GpuBackendKind, GpuBatchResult, GpuMiner};
use zion_core::{MiningHeader, V3DifficultyTarget as DifficultyTarget};

const PEARL_CU: &str = include_str!("../../csrc/cuda/pearl_pouw_native.cu");

const MODULE: &str = "pearl_pouw_native";

mod kern {
    pub const GEN_MATRIX: &str = "pearl_gen_matrix";
    pub const CHUNK_HASH: &str = "pearl_blake3_chunk_hash";
    pub const MERGE: &str = "pearl_blake3_merge";
    pub const SMALL_HASH: &str = "pearl_blake3_small_hash";
    pub const GEN_PERM: &str = "pearl_gen_permutation";
    pub const GEN_UNIFORM: &str = "pearl_gen_uniform_noise";
    pub const APPLY_A: &str = "pearl_apply_noise_a";
    pub const APPLY_B: &str = "pearl_apply_noise_b";
    pub const MINE_V3: &str = "pearl_pouw_mine_native_v3";
    pub const DERIVE_SEEDS: &str = "pearl_derive_seeds";
    pub const MERKLE_TREE: &str = "pearl_merkle_tree";
    pub const GEN_DUAL: &str = "pearl_gen_matrix_dual";
    pub const CHUNK_DUAL: &str = "pearl_blake3_chunk_hash_dual";
    pub const MERKLE_DUAL: &str = "pearl_merkle_tree_dual";
    pub const UNIFORM_DUAL: &str = "pearl_gen_uniform_dual";
    pub const PERM_DUAL: &str = "pearl_gen_permutation_dual";
    pub const APPLY_DUAL: &str = "pearl_apply_noise_dual";
}

const KERNELS: &[&str] = &[
    kern::GEN_MATRIX,
    kern::CHUNK_HASH,
    kern::MERGE,
    kern::SMALL_HASH,
    kern::GEN_PERM,
    kern::GEN_UNIFORM,
    kern::APPLY_A,
    kern::APPLY_B,
    kern::MINE_V3,
    kern::DERIVE_SEEDS,
    kern::MERKLE_TREE,
    kern::GEN_DUAL,
    kern::CHUNK_DUAL,
    kern::MERKLE_DUAL,
    kern::UNIFORM_DUAL,
    kern::PERM_DUAL,
    kern::APPLY_DUAL,
];

/// Max attempts queued per `mine_native_batch` call — found/tile/jackpot
/// buffers are allocated for this many slots up front.
const MAX_BATCH: usize = 64;

/// BLAKE3 IV as little-endian bytes — the "key" for unkeyed small_hash calls.
const IV_BYTES: [u8; 32] = [
    0x67, 0xE6, 0x09, 0x6A, 0x85, 0xAE, 0x67, 0xBB, 0x72, 0xF3, 0x6E, 0x3C, 0x3A, 0xF5, 0x4F, 0xA5,
    0x7F, 0x52, 0x0E, 0x51, 0x8C, 0x68, 0x05, 0x9B, 0xAB, 0xD9, 0x83, 0x1F, 0x19, 0xCD, 0xE0, 0x5B,
];

/// Device buffers for one (m, n, k, rank, tile-set) configuration. Recreated
/// whenever the mining config changes; reused across nonces otherwise —
/// matrices are zero-padded once up front so the tail beyond m·k / n·k stays
/// the canonical BLAKE3 zero-padding forever (gen_matrix only writes the
/// first m·k / n·k elements).
struct PearlCudaBufs {
    m: usize,
    n: usize,
    k: usize,
    rank: usize,
    num_row_offsets: usize,
    num_col_offsets: usize,
    matrix_a: CudaSlice<i8>,    // num_chunks_a * 1024, zero-padded
    matrix_bt: CudaSlice<i8>,   // num_chunks_b * 1024, zero-padded
    chunk_hashes: CudaSlice<u8>, // max_chunks * 32
    merkle: CudaSlice<u8>,       // max_chunks * 32 — merge ping-pong scratch (A)
    merkle2: CudaSlice<u8>,      // max_chunks * 32 — B leaf layer (no aliasing)
    merkle_b: CudaSlice<u8>,     // max_chunks * 32 — B tree scratch (dual launch)
    root_a: CudaSlice<u8>,
    root_b: CudaSlice<u8>,
    a_noise_seed: CudaSlice<u8>,
    b_noise_seed: CudaSlice<u8>,
    e_al: CudaSlice<i8>,
    e_br: CudaSlice<i8>,
    e_ar_perm: CudaSlice<u32>,
    e_bl_perm: CudaSlice<u32>,
    noised_a: CudaSlice<i8>,    // m*k i8 — noised values fit [-127,127]
    noised_b: CudaSlice<i8>,
    iv: CudaSlice<u8>,
    seed_label_a: CudaSlice<u8>,
    seed_label_b: CudaSlice<u8>,
    row_off: CudaSlice<u32>,
    col_off: CudaSlice<u32>,
    rows_base: CudaSlice<u32>,
    cols_base: CudaSlice<u32>,
    job_key: CudaSlice<u8>,
    target: CudaSlice<u8>,
    seed_msg: CudaSlice<u8>,
    /// [num_row_offsets, num_col_offsets, k_dim, rank] for the mine kernel —
    /// packed into a buffer to keep the launch tuple under the cudarc limit.
    mine_params: CudaSlice<u32>,
    output_tile: CudaSlice<u32>,    // MAX_BATCH slots — batch readback
    output_jackpot: CudaSlice<u8>,  // 32 * MAX_BATCH
    found: CudaSlice<u32>,          // MAX_BATCH flags — one per queued attempt
    salt_a: CudaSlice<u8>,          // PEARL_SEED_SALT_A — uploaded once (constant)
    salt_b: CudaSlice<u8>,
}

/// Persistent CUDA miner for `pearlhash`. One attempt = one full pipeline
/// (steps 1–7); the caller rebuilds `PlainProof` on the CPU when a tile wins.
pub struct PearlCudaMiner {
    dev: Arc<CudaDevice>,
    work_size: usize,
    device_name_cached: String,
    f_gen_matrix: CudaFunction,
    f_chunk_hash: CudaFunction,
    f_merge: CudaFunction,
    f_merkle_tree: CudaFunction,
    f_gen_dual: CudaFunction,
    f_chunk_dual: CudaFunction,
    f_merkle_dual: CudaFunction,
    f_uniform_dual: CudaFunction,
    f_perm_dual: CudaFunction,
    f_apply_dual: CudaFunction,
    f_small_hash: CudaFunction,
    f_gen_perm: CudaFunction,
    f_gen_uniform: CudaFunction,
    f_apply_a: CudaFunction,
    f_apply_b: CudaFunction,
    f_mine_v3: CudaFunction,
    f_derive: CudaFunction,
    bufs: Option<PearlCudaBufs>,
}

impl PearlCudaMiner {
    pub fn new(work_size: usize) -> Result<Self> {
        let dev =
            CudaDevice::new(0).map_err(|e| anyhow::anyhow!("CUDA device init failed: {e}"))?;
        Self::new_with_device(work_size, dev)
    }

    /// Create the miner on an existing device (e.g. the shared Stream-1
    /// `CudaDevice` — mandatory on consumer GPUs without MPS).
    pub fn new_with_device(work_size: usize, dev: Arc<CudaDevice>) -> Result<Self> {
        let device_name = dev
            .name()
            .unwrap_or_else(|_| "unknown CUDA device".to_string());
        let arch = detect_cuda_arch(&dev);
        let processed = preprocess_kernel(PEARL_CU);
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
        .map_err(|e| anyhow::anyhow!("NVRTC compile failed for pearl: {e}"))?;
        dev.load_ptx(ptx, MODULE, KERNELS)
            .map_err(|e| anyhow::anyhow!("PTX load failed for pearl: {e}"))?;

        fn get(dev: &Arc<CudaDevice>, name: &str) -> Result<CudaFunction> {
            dev.get_func(MODULE, name)
                .ok_or_else(|| anyhow::anyhow!("pearl kernel {} not found", name))
        }
        let f_gen_matrix = get(&dev, kern::GEN_MATRIX)?;
        let f_chunk_hash = get(&dev, kern::CHUNK_HASH)?;
        let f_merge = get(&dev, kern::MERGE)?;
        let f_merkle_tree = get(&dev, kern::MERKLE_TREE)?;
        let f_gen_dual = get(&dev, kern::GEN_DUAL)?;
        let f_chunk_dual = get(&dev, kern::CHUNK_DUAL)?;
        let f_merkle_dual = get(&dev, kern::MERKLE_DUAL)?;
        let f_uniform_dual = get(&dev, kern::UNIFORM_DUAL)?;
        let f_perm_dual = get(&dev, kern::PERM_DUAL)?;
        let f_apply_dual = get(&dev, kern::APPLY_DUAL)?;
        let f_small_hash = get(&dev, kern::SMALL_HASH)?;
        let f_gen_perm = get(&dev, kern::GEN_PERM)?;
        let f_gen_uniform = get(&dev, kern::GEN_UNIFORM)?;
        let f_apply_a = get(&dev, kern::APPLY_A)?;
        let f_apply_b = get(&dev, kern::APPLY_B)?;
        let f_mine_v3 = get(&dev, kern::MINE_V3)?;
        let f_derive = get(&dev, kern::DERIVE_SEEDS)?;

        crate::ext_info!(
            "gpu_pearl_cuda_init device=\"{}\" work_size={}",
            device_name,
            work_size,
        );

        Ok(Self {
            dev,
            work_size,
            device_name_cached: device_name,
            f_gen_matrix,
            f_chunk_hash,
            f_merge,
            f_merkle_tree,
            f_gen_dual,
            f_chunk_dual,
            f_merkle_dual,
            f_uniform_dual,
            f_perm_dual,
            f_apply_dual,
            f_small_hash,
            f_gen_perm,
            f_gen_uniform,
            f_apply_a,
            f_apply_b,
            f_mine_v3,
            f_derive,
            bufs: None,
        })
    }

    pub fn device_name(&self) -> String {
        self.device_name_cached.clone()
    }

    /// Return the underlying CUDA device so sibling backends can share the
    /// context instead of creating a second one (deadlock on consumer GPUs).
    pub fn shared_cuda_device(&self) -> Option<Arc<CudaDevice>> {
        Some(self.dev.clone())
    }

    fn grid_for(n: usize, tpb: u32) -> u32 {
        ((n as u64) + (tpb as u64) - 1).div_euclid(tpb as u64) as u32
    }

    /// Ensure device buffers match the current mining config; reallocates
    /// when dims change. Mirrors `PearlPouwBufferCache` from the OpenCL host.
    fn ensure_bufs(&mut self, input: &PearlPouwNativeInput<'_>) -> Result<()> {
        let m = input.m;
        let n = input.n;
        let k = input.k;
        let rank = input.rank;
        let match_cache = self.bufs.as_ref().is_some_and(|b| {
            b.m == m
                && b.n == n
                && b.k == k
                && b.rank == rank
                && b.num_row_offsets == input.row_offsets.len()
                && b.num_col_offsets == input.col_offsets.len()
        });
        if match_cache {
            return Ok(());
        }

        let mk = m * k;
        let nk = n * k;
        let num_chunks_a = mk.div_ceil(1024);
        let num_chunks_b = nk.div_ceil(1024);
        let max_chunks = num_chunks_a.max(num_chunks_b);

        let d = &self.dev;
        let az = |n_: usize| -> Result<CudaSlice<i8>> {
            d.alloc_zeros::<i8>(n_)
                .map_err(|e| anyhow::anyhow!("pearl cuda alloc i8[{n_}]: {e}"))
        };
        let azu = |n_: usize| -> Result<CudaSlice<u8>> {
            d.alloc_zeros::<u8>(n_)
                .map_err(|e| anyhow::anyhow!("pearl cuda alloc u8[{n_}]: {e}"))
        };
        let azu32 = |n_: usize| -> Result<CudaSlice<u32>> {
            d.alloc_zeros::<u32>(n_)
                .map_err(|e| anyhow::anyhow!("pearl cuda alloc u32[{n_}]: {e}"))
        };
        let up_u8 = |v: &[u8]| -> Result<CudaSlice<u8>> {
            d.htod_copy(v.to_vec())
                .map_err(|e| anyhow::anyhow!("pearl cuda upload u8: {e}"))
        };
        let up_u32 = |v: &[u32]| -> Result<CudaSlice<u32>> {
            d.htod_copy(v.to_vec())
                .map_err(|e| anyhow::anyhow!("pearl cuda upload u32: {e}"))
        };

        self.bufs = Some(PearlCudaBufs {
            m,
            n,
            k,
            rank,
            num_row_offsets: input.row_offsets.len(),
            num_col_offsets: input.col_offsets.len(),
            matrix_a: az(num_chunks_a * 1024)?,
            matrix_bt: az(num_chunks_b * 1024)?,
            chunk_hashes: azu(max_chunks * 32)?,
            merkle: azu(max_chunks * 32)?,
            merkle2: azu(max_chunks * 32)?,
            merkle_b: azu(max_chunks * 32)?,
            root_a: azu(32)?,
            root_b: azu(32)?,
            a_noise_seed: azu(32)?,
            b_noise_seed: azu(32)?,
            e_al: az(m * rank)?,
            e_br: az(n * rank)?,
            e_ar_perm: azu32(k * 2)?,
            e_bl_perm: azu32(k * 2)?,
            noised_a: az(mk)?,
            noised_b: az(nk)?,
            iv: up_u8(&IV_BYTES)?,
            seed_label_a: up_u8(&input.seed_label_a)?,
            seed_label_b: up_u8(&input.seed_label_b)?,
            row_off: up_u32(input.row_offsets)?,
            col_off: up_u32(input.col_offsets)?,
            rows_base: up_u32(input.rows_base)?,
            cols_base: up_u32(input.cols_base)?,
            job_key: azu(32)?,
            target: azu(32)?,
            seed_msg: azu(64)?,
            mine_params: azu32(4)?,
            output_tile: azu32(MAX_BATCH)?,
            output_jackpot: azu(32 * MAX_BATCH)?,
            found: azu32(MAX_BATCH)?,
            salt_a: up_u8(&PEARL_SEED_SALT_A)?,
            salt_b: up_u8(&PEARL_SEED_SALT_B)?,
        });
        Ok(())
    }

    /// Per-job uploads shared by all queued attempts: job_key, target,
    /// mine_params — plus a one-shot `found` flag reset over `slots` slots.
    fn prep_job(&mut self, input: &PearlPouwNativeInput<'_>, slots: usize) -> Result<()> {
        let b = self.bufs.as_mut().expect("bufs ensured");
        self.dev
            .htod_copy_into(input.job_key.to_vec(), &mut b.job_key)
            .map_err(|e| anyhow::anyhow!("pearl job_key upload: {e}"))?;
        self.dev
            .htod_copy_into(input.target.to_vec(), &mut b.target)
            .map_err(|e| anyhow::anyhow!("pearl target upload: {e}"))?;
        self.dev
            .memset_zeros(&mut b.found.slice_mut(0..slots))
            .map_err(|e| anyhow::anyhow!("pearl found reset: {e}"))?;
        self.dev
            .memset_zeros(&mut b.output_tile.slice_mut(0..slots))
            .map_err(|e| anyhow::anyhow!("pearl output_tile reset: {e}"))?;
        self.dev
            .htod_copy_into(
                vec![
                    input.row_offsets.len() as u32,
                    input.col_offsets.len() as u32,
                    input.k as u32,
                    input.rank as u32,
                ],
                &mut b.mine_params,
            )
            .map_err(|e| anyhow::anyhow!("pearl mine_params upload: {e}"))?;
        Ok(())
    }

    /// Queue one full attempt pipeline (steps 1–7) on the device stream.
    /// Every launch is async — the only synchronization happens in the
    /// caller after the whole batch is queued. `slot` picks which
    /// found/tile/jackpot slot the mine kernel writes.
    fn queue_attempt(
        &mut self,
        input: &PearlPouwNativeInput<'_>,
        nonce: u64,
        slot: usize,
    ) -> Result<()> {
        let m = input.m;
        let n = input.n;
        let k = input.k;
        let rank = input.rank;
        let mk = m * k;
        let nk = n * k;
        let num_chunks_a = mk.div_ceil(1024);
        let num_chunks_b = nk.div_ceil(1024);

        let b = self.bufs.as_mut().expect("bufs ensured");

        let cfg_1d = |n_: usize, tpb: u32| LaunchConfig {
            grid_dim: (Self::grid_for(n_, tpb), 1, 1),
            block_dim: (tpb, 1, 1),
            shared_mem_bytes: 0,
        };

        // ── Step 1: Generate matrices A and B^T (fused, one launch) ─────
        unsafe {
            self.f_gen_dual.clone().launch(
                cfg_1d(mk + nk, 256),
                (
                    &mut b.matrix_a,
                    &mut b.matrix_bt,
                    nonce,
                    m as u32,
                    n as u32,
                    k as u32,
                ),
            )
        }
        .map_err(|e| anyhow::anyhow!("pearl gen_matrix_dual launch: {e}"))?;

        // ── Step 2: BLAKE3 chunk hashing (fused, one launch) ───────────
        // Single-chunk matrices write the chunk CV straight into the root
        // buffer with the ROOT flag (canonical MerkleTree hashes <=1024B
        // directly, skipping the tree).
        {
            let single_a = num_chunks_a == 1;
            let dst_a: &mut CudaSlice<u8> = if single_a {
                &mut b.root_a
            } else {
                &mut b.chunk_hashes
            };
            let single_b = num_chunks_b == 1;
            let dst_b: &mut CudaSlice<u8> = if single_b {
                &mut b.root_b
            } else {
                &mut b.merkle2
            };
            unsafe {
                self.f_chunk_dual.clone().launch(
                    cfg_1d(num_chunks_a + num_chunks_b, 64),
                    (
                        &b.matrix_a,
                        &b.matrix_bt,
                        &b.job_key,
                        &mut *dst_a,
                        &mut *dst_b,
                        num_chunks_a as u32,
                        num_chunks_b as u32,
                        single_a as u32,
                        single_b as u32,
                    ),
                )
            }
            .map_err(|e| anyhow::anyhow!("pearl chunk_hash_dual launch: {e}"))?;
        }

        // ── Step 3: Merkle tree reduction ──────────────────────────────
        // One dual launch folds BOTH trees — block 0 = A (chunk_hashes ↔
        // merkle), block 1 = B (merkle2 ↔ merkle_b). Per level: grid-stride,
        // __syncthreads between levels; odd-leaf passthrough + ROOT-flag
        // semantics identical to the old per-level merge launches.
        {
            let cfg_tree1 = LaunchConfig {
                grid_dim: (1, 1, 1),
                block_dim: (1024, 1, 1),
                shared_mem_bytes: 0,
            };
            let need_a = num_chunks_a > 1;
            let need_b = num_chunks_b > 1;
            if need_a && need_b {
                unsafe {
                    self.f_merkle_dual.clone().launch(
                        LaunchConfig {
                            grid_dim: (2, 1, 1),
                            block_dim: (1024, 1, 1),
                            shared_mem_bytes: 0,
                        },
                        (
                            &mut b.chunk_hashes,
                            &mut b.merkle2,
                            &mut b.merkle,
                            &mut b.merkle_b,
                            &b.job_key,
                            &mut b.root_a,
                            &mut b.root_b,
                            num_chunks_a as u32,
                            num_chunks_b as u32,
                        ),
                    )
                }
                .map_err(|e| anyhow::anyhow!("pearl merkle_tree_dual launch: {e}"))?;
            } else {
                if need_a {
                    unsafe {
                        self.f_merkle_tree.clone().launch(
                            cfg_tree1,
                            (
                                &mut b.chunk_hashes,
                                &b.job_key,
                                &mut b.merkle,
                                &mut b.root_a,
                                num_chunks_a as u32,
                            ),
                        )
                    }
                    .map_err(|e| anyhow::anyhow!("pearl merkle_tree A launch: {e}"))?;
                }
                if need_b {
                    unsafe {
                        self.f_merkle_tree.clone().launch(
                            cfg_tree1,
                            (
                                &mut b.merkle2,
                                &b.job_key,
                                &mut b.merkle_b,
                                &mut b.root_b,
                                num_chunks_b as u32,
                            ),
                        )
                    }
                    .map_err(|e| anyhow::anyhow!("pearl merkle_tree B launch: {e}"))?;
                }
            }
        }

        // ── Step 4: Derive noise seeds (fully on-device) ───────────────
        // salted: hash_eff = keyed(SEED_SALT_*, root||dim||0s); legacy: root.
        // b_noise_seed = blake3(job_key || hash_b) — unkeyed, 64-byte input
        // a_noise_seed = blake3(b_noise_seed || hash_a) — unkeyed, 64-byte
        // input. Replaces the old dtoh→CPU-hash→htod roundtrip (3 syncs).
        {
            let salted = match input.seed_derivation {
                PearlSeedDerivation::Salted => 1u32,
                PearlSeedDerivation::Legacy => 0u32,
            };
            unsafe {
                self.f_derive.clone().launch(
                    cfg_1d(1, 1),
                    (
                        &b.root_a,
                        &b.root_b,
                        &b.job_key,
                        &b.salt_a,
                        &b.salt_b,
                        m as u32,
                        n as u32,
                        salted,
                        &mut b.a_noise_seed,
                        &mut b.b_noise_seed,
                    ),
                )
            }
            .map_err(|e| anyhow::anyhow!("pearl derive_seeds launch: {e}"))?;
        }

        // ── Step 5: Generate noise (fused duals) ───────────────────────
        // Canonical order (compute_noise_for_indices): seed LABEL goes into
        // the message body; the NOISE SEED is the BLAKE3 key.
        unsafe {
            self.f_uniform_dual.clone().launch(
                cfg_1d(m * rank + n * rank, 256),
                (
                    &mut b.e_al,
                    &mut b.e_br,
                    &b.seed_label_a,
                    &b.a_noise_seed,
                    m as u32,
                    &b.seed_label_b,
                    &b.b_noise_seed,
                    n as u32,
                    rank as u32,
                ),
            )
        }
        .map_err(|e| anyhow::anyhow!("pearl gen_uniform_dual launch: {e}"))?;
        unsafe {
            self.f_perm_dual.clone().launch(
                cfg_1d(2 * k, 64),
                (
                    &mut b.e_ar_perm,
                    &b.seed_label_a,
                    &b.a_noise_seed,
                    &mut b.e_bl_perm,
                    &b.seed_label_b,
                    &b.b_noise_seed,
                    k as u32,
                    rank as u32,
                ),
            )
        }
        .map_err(|e| anyhow::anyhow!("pearl gen_perm_dual launch: {e}"))?;

        // ── Step 6: Apply noise to matrices (fused, one launch) ────────
        unsafe {
            self.f_apply_dual.clone().launch(
                cfg_1d(mk + nk, 256),
                (
                    &mut b.noised_a,
                    &b.matrix_a,
                    &b.e_al,
                    &b.e_ar_perm,
                    m as u32,
                    &mut b.noised_b,
                    &b.matrix_bt,
                    &b.e_br,
                    &b.e_bl_perm,
                    n as u32,
                    k as u32,
                    rank as u32,
                ),
            )
        }
        .map_err(|e| anyhow::anyhow!("pearl apply_noise_dual launch: {e}"))?;

        // ── Step 7: MatMul + jackpot + target check ────────────────────
        {
            let total_tiles = input.row_offsets.len() * input.col_offsets.len();
            let cfg = LaunchConfig {
                grid_dim: (total_tiles as u32, 1, 1),
                block_dim: (32, 1, 1), // TILE_H × TILE_W
                shared_mem_bytes: 0,
            };
            let mut tile_view = b.output_tile.slice_mut(slot..slot + 1);
            let mut jackpot_view = b.output_jackpot.slice_mut(slot * 32..(slot + 1) * 32);
            let mut found_view = b.found.slice_mut(slot..slot + 1);
            unsafe {
                self.f_mine_v3.clone().launch(
                    cfg,
                    (
                        &b.noised_a,
                        &b.noised_b,
                        &b.a_noise_seed,
                        &b.target,
                        &b.row_off,
                        &b.col_off,
                        &b.rows_base,
                        &b.cols_base,
                        &mut tile_view,
                        &mut jackpot_view,
                        &mut found_view,
                        &b.mine_params,
                    ),
                )
            }
            .map_err(|e| anyhow::anyhow!("pearl mine_v3 launch: {e}"))?;
        }

        Ok(())
    }

    /// One GPU-native Pearl PoUW attempt — CUDA twin of
    /// `ExtGpuMiner::pearl_pouw_mine_native`.
    pub fn mine_native(
        &mut self,
        input: &PearlPouwNativeInput<'_>,
    ) -> Result<Option<PearlPouwNativeResult>> {
        self.ensure_bufs(input)?;
        self.prep_job(input, 1)?;
        self.queue_attempt(input, input.nonce, 0)?;

        let m = input.m;
        let n = input.n;
        let k = input.k;
        let mk = m * k;
        let nk = n * k;
        let b = self.bufs.as_mut().expect("bufs ensured");

        // ── Read results ───────────────────────────────────────────────
        let found: Vec<u32> = self
            .dev
            .dtoh_sync_copy(&b.found.slice(0..1))
            .map_err(|e| anyhow::anyhow!("pearl found read: {e}"))?;
        if found[0] == 0 {
            return Ok(None);
        }

        let tile: Vec<u32> = self
            .dev
            .dtoh_sync_copy(&b.output_tile.slice(0..1))
            .map_err(|e| anyhow::anyhow!("pearl tile read: {e}"))?;
        let jackpot_vec: Vec<u8> = self
            .dev
            .dtoh_sync_copy(&b.output_jackpot.slice(0..32))
            .map_err(|e| anyhow::anyhow!("pearl jackpot read: {e}"))?;
        let mut jackpot_hash = [0u8; 32];
        jackpot_hash.copy_from_slice(&jackpot_vec[..32]);

        // Read back matrices for the CPU Merkle-proof build — only the
        // unpadded m·k / n·k prefixes are meaningful to the proof builder.
        let mut matrix_a = vec![0i8; mk];
        {
            let padded: Vec<i8> = self
                .dev
                .dtoh_sync_copy(&b.matrix_a)
                .map_err(|e| anyhow::anyhow!("pearl matrix_a read: {e}"))?;
            matrix_a.copy_from_slice(&padded[..mk]);
        }
        let mut matrix_bt = vec![0i8; nk];
        {
            let padded: Vec<i8> = self
                .dev
                .dtoh_sync_copy(&b.matrix_bt)
                .map_err(|e| anyhow::anyhow!("pearl matrix_bt read: {e}"))?;
            matrix_bt.copy_from_slice(&padded[..nk]);
        }

        Ok(Some(PearlPouwNativeResult {
            tile_index: tile[0],
            jackpot_hash,
            nonce: input.nonce,
            matrix_a,
            matrix_bt,
        }))
    }

    /// Queue `batch` sequential-nonce attempts back-to-back with a single
    /// synchronization at the end — removes the ~4 mid-attempt host
    /// roundtrips per try (the dominant cost under GPU timesharing).
    /// On a hit the winning pipeline is re-run once to materialize the
    /// matrices needed for the CPU Merkle-proof build (buffers are
    /// overwritten by later queued attempts).
    /// Returns (result, attempts_executed).
    pub fn mine_native_batch(
        &mut self,
        input: &PearlPouwNativeInput<'_>,
        batch: usize,
    ) -> Result<(Option<PearlPouwNativeResult>, usize)> {
        self.ensure_bufs(input)?;
        let batch = batch.clamp(1, MAX_BATCH);
        self.prep_job(input, batch)?;
        for i in 0..batch {
            self.queue_attempt(input, input.nonce.wrapping_add(i as u64), i)?;
        }

        let found: Vec<u32> = self
            .dev
            .dtoh_sync_copy(&self.bufs.as_ref().unwrap().found.slice(0..batch))
            .map_err(|e| anyhow::anyhow!("pearl batch found read: {e}"))?;
        let Some(win) = found.iter().position(|&f| f != 0) else {
            return Ok((None, batch));
        };
        let win_input = PearlPouwNativeInput {
            nonce: input.nonce.wrapping_add(win as u64),
            m: input.m,
            n: input.n,
            k: input.k,
            rank: input.rank,
            job_key: input.job_key,
            target: input.target,
            row_offsets: input.row_offsets,
            col_offsets: input.col_offsets,
            rows_base: input.rows_base,
            cols_base: input.cols_base,
            seed_label_a: input.seed_label_a,
            seed_label_b: input.seed_label_b,
            seed_derivation: input.seed_derivation,
        };
        let res = self.mine_native(&win_input)?;
        Ok((res, batch))
    }
}

impl GpuMiner for PearlCudaMiner {
    fn device_name(&self) -> String {
        self.device_name_cached.clone()
    }

    fn backend_kind(&self) -> GpuBackendKind {
        GpuBackendKind::Cuda
    }

    fn algorithm(&self) -> String {
        "pearlhash".to_string()
    }

    fn work_size(&self) -> usize {
        self.work_size
    }

    /// Pearl is a PoUW attempt pipeline, not a nonce-range hasher — the
    /// V3 external-stream path calls `mine_pearl` directly. `mine_batch`
    /// exists only to satisfy the trait and is never reached.
    fn mine_batch(
        &mut self,
        _header: MiningHeader,
        _target: DifficultyTarget,
        _nonce_start: u64,
        _batch_size: u64,
    ) -> Result<GpuBatchResult> {
        anyhow::bail!("pearlhash uses mine_pearl (PoUW attempt pipeline), not mine_batch")
    }

    fn mine_pearl(
        &mut self,
        input: &PearlPouwNativeInput<'_>,
    ) -> Result<Option<PearlPouwNativeResult>> {
        self.mine_native(input)
    }

    /// CUDA batch path — queues all `batch` attempt pipelines back-to-back
    /// with a single sync at the end (per-attempt host roundtrips were the
    /// dominant cost, especially under GPU timesharing with other streams).
    fn mine_pearl_batch(
        &mut self,
        input: &PearlPouwNativeInput<'_>,
        batch: usize,
    ) -> Result<(Option<PearlPouwNativeResult>, usize)> {
        self.mine_native_batch(input, batch)
    }

    fn benchmark(&mut self, secs: f64) -> Result<(u64, f64, f64)> {
        // One attempt ≈ one full-matrix PoUW try; rate counts attempts.
        let cfg = crate::auxpow::pearl::PearlMineConfig::from_env()?;
        let (ro, co, rb, cb) = (
            cfg.row_offsets(),
            cfg.col_offsets(),
            cfg.rows_base(),
            cfg.cols_base(),
        );
        let job_key = [0xAAu8; 32];
        let target = [0xFFu8; 32];
        let mut total: u64 = 0;
        let start = Instant::now();
        while start.elapsed().as_secs_f64() < secs {
            let inp = PearlPouwNativeInput {
                nonce: total,
                m: cfg.m,
                n: cfg.n,
                k: cfg.k,
                rank: cfg.rank,
                job_key,
                target,
                row_offsets: &ro,
                col_offsets: &co,
                rows_base: &rb,
                cols_base: &cb,
                seed_label_a: PEARL_SEED_LABEL_A,
                seed_label_b: PEARL_SEED_LABEL_B,
                seed_derivation: PearlSeedDerivation::Salted,
            };
            let _ = self.mine_native(&inp)?;
            total += 1;
        }
        let elapsed = start.elapsed().as_secs_f64();
        let aps = if elapsed > 0.0 {
            total as f64 / elapsed
        } else {
            0.0
        };
        Ok((total, elapsed, aps))
    }

    #[cfg(feature = "gpu-cuda")]
    fn shared_cuda_device(&self) -> Option<Arc<CudaDevice>> {
        Some(self.dev.clone())
    }
}

// ─── On-device parity (needs a CUDA device; ignored by default) ──────────

#[cfg(test)]
mod pearl_cuda_kat {
    use super::*;
    use crate::auxpow::pearl::pearl_kat::*;

    /// End-to-end CUDA vs CPU reference — same fixture as the OpenCL parity
    /// test. Requires a CUDA device; run with:
    ///   cargo test --features gpu-cuda pearl_cuda_parity -- --ignored --nocapture
    #[test]
    #[ignore]
    fn pearl_cuda_parity_vs_cpu_reference() {
        let mut miner =
            PearlCudaMiner::new(8192).expect("CUDA device required for pearl parity test");

        // Small dims; A tree = 3 chunks (odd-leaf propagation), B tree = 4.
        let (m, n, k, rank) = (48usize, 64usize, 64usize, 32usize);
        let nonce = 0x5150u64;
        let job_key = [0x77u8; 32];
        let target = [0xFFu8; 32]; // max target → any tile accepted
        let row_offsets: Vec<u32> = vec![0, 16, 32];
        let col_offsets: Vec<u32> = vec![0, 32];
        let rows_base: Vec<u32> = vec![0, 4, 8, 12]; // +row_off ≤ 44 < m
        let cols_base: Vec<u32> = vec![0, 4, 8, 12, 16, 20, 24, 28]; // +col_off ≤ 60 < n

        for salted in [false, true] {
            let input = PearlPouwNativeInput {
                nonce,
                m,
                n,
                k,
                rank,
                job_key,
                target,
                row_offsets: &row_offsets,
                col_offsets: &col_offsets,
                rows_base: &rows_base,
                cols_base: &cols_base,
                seed_label_a: PEARL_SEED_LABEL_A,
                seed_label_b: PEARL_SEED_LABEL_B,
                seed_derivation: if salted {
                    PearlSeedDerivation::Salted
                } else {
                    PearlSeedDerivation::Legacy
                },
            };

            let res = miner
                .mine_native(&input)
                .expect("mine failed")
                .expect("max-target must find");

            // Matrix gen parity (result carries the matrices back)
            for (i, &v) in res.matrix_a.iter().enumerate() {
                assert_eq!(v, gen_int7_ref(nonce, i as u32), "matrix A[{i}]");
            }
            for (i, &v) in res.matrix_bt.iter().enumerate() {
                assert_eq!(v, gen_int7_ref(nonce + 1, i as u32), "matrix BT[{i}]");
            }

            // Jackpot parity for the winning tile
            let tile = res.tile_index as usize;
            let nco = col_offsets.len();
            let row_off = row_offsets[tile / nco];
            let col_off = col_offsets[tile % nco];
            let expected = tile_jackpot_ref(
                nonce, m, n, k, rank, &job_key, row_off, col_off, &rows_base, &cols_base,
                salted,
            );
            assert_eq!(
                res.jackpot_hash, expected,
                "jackpot mismatch (salted={salted}, tile={tile})"
            );
        }
    }

    #[test]
    #[ignore]
    fn pearl_cuda_default_config_repeated_attempts() {
        use crate::auxpow::pearl::PearlMineConfig;
        use base64::Engine;

        let cfg = PearlMineConfig::from_env().unwrap();
        cfg.validate().unwrap();
        assert_eq!((cfg.m, cfg.n, cfg.k, cfg.rank), (1024, 1024, 2048, 128));
        let mut miner =
            PearlCudaMiner::new(cfg.k).expect("CUDA device required for pearl default-config test");

        let mut header = [0u8; 76];
        header[0..4].copy_from_slice(&0x20000000u32.to_le_bytes());
        header[72..76].copy_from_slice(&0x207fffffu32.to_le_bytes());
        let job_key = cfg.job_key(&header);
        let target = [0xFFu8; 32];
        let row_offsets = cfg.row_offsets();
        let col_offsets = cfg.col_offsets();
        let rows_base = cfg.rows_base();
        let cols_base = cfg.cols_base();
        let nco = col_offsets.len();
        let num_tiles = row_offsets.len() * nco;

        let mut first: Option<PearlPouwNativeResult> = None;
        for nonce in [0x5150u64, 0x5151, 0x5152] {
            let input = PearlPouwNativeInput {
                nonce,
                m: cfg.m,
                n: cfg.n,
                k: cfg.k,
                rank: cfg.rank,
                job_key,
                target,
                row_offsets: &row_offsets,
                col_offsets: &col_offsets,
                rows_base: &rows_base,
                cols_base: &cols_base,
                seed_label_a: PEARL_SEED_LABEL_A,
                seed_label_b: PEARL_SEED_LABEL_B,
                seed_derivation: PearlSeedDerivation::Salted,
            };
            let res = miner
                .mine_native(&input)
                .expect("mine failed")
                .expect("max-target must find");
            assert_eq!(res.nonce, nonce);
            assert!((res.tile_index as usize) < num_tiles);
            for (i, &v) in res.matrix_a.iter().enumerate() {
                assert_eq!(v, gen_int7_ref(nonce, i as u32), "matrix A[{i}]");
            }
            for (i, &v) in res.matrix_bt.iter().enumerate() {
                assert_eq!(v, gen_int7_ref(nonce + 1, i as u32), "matrix BT[{i}]");
            }
            let tile = res.tile_index as usize;
            let row_off = row_offsets[tile / nco];
            let col_off = col_offsets[tile % nco];
            let expected = tile_jackpot_ref(
                nonce, cfg.m, cfg.n, cfg.k, cfg.rank, &job_key, row_off, col_off, &rows_base,
                &cols_base, true,
            );
            assert_eq!(res.jackpot_hash, expected, "jackpot mismatch tile={tile}");
            if first.is_none() {
                first = Some(res);
            }
        }

        let input = PearlPouwNativeInput {
            nonce: 0x5153,
            m: cfg.m,
            n: cfg.n,
            k: cfg.k,
            rank: cfg.rank,
            job_key,
            target: [0u8; 32],
            row_offsets: &row_offsets,
            col_offsets: &col_offsets,
            rows_base: &rows_base,
            cols_base: &cols_base,
            seed_label_a: PEARL_SEED_LABEL_A,
            seed_label_b: PEARL_SEED_LABEL_B,
            seed_derivation: PearlSeedDerivation::Salted,
        };
        assert!(
            miner.mine_native(&input).unwrap().is_none(),
            "zero target must find nothing (found flag reset)"
        );

        if let Ok(path) = std::env::var("ZION_PEARL_KAT_PROOF_OUT") {
            let res = first.expect("no successful attempt recorded");
            let proof = crate::auxpow::pearl::build_plain_proof(
                &cfg,
                &job_key,
                &res.matrix_a,
                &res.matrix_bt,
                res.tile_index,
                &row_offsets,
                &col_offsets,
            )
            .unwrap();
            let out = serde_json::json!({
                "header_hex": hex::encode(header),
                "plain_proof_b64": base64::engine::general_purpose::STANDARD.encode(&proof),
                "jackpot_hex": hex::encode(res.jackpot_hash),
                "cert_version": 3,
                "m": cfg.m,
                "n": cfg.n,
                "k": cfg.k,
                "rank": cfg.rank,
                "nonce": res.nonce,
                "tile_index": res.tile_index,
            });
            std::fs::write(&path, serde_json::to_string_pretty(&out).unwrap()).unwrap();
        }
    }
}
