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
];

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
    merkle: CudaSlice<u8>,       // max_chunks * 32 — merge ping-pong scratch
    merkle2: CudaSlice<u8>,      // max_chunks * 32 — B leaf layer (no aliasing)
    root_a: CudaSlice<u8>,
    root_b: CudaSlice<u8>,
    a_noise_seed: CudaSlice<u8>,
    b_noise_seed: CudaSlice<u8>,
    e_al: CudaSlice<i8>,
    e_br: CudaSlice<i8>,
    e_ar_perm: CudaSlice<u32>,
    e_bl_perm: CudaSlice<u32>,
    noised_a: CudaSlice<i32>,
    noised_b: CudaSlice<i32>,
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
    output_tile: CudaSlice<u32>,
    output_jackpot: CudaSlice<u8>,
    found: CudaSlice<u32>,
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
    f_small_hash: CudaFunction,
    f_gen_perm: CudaFunction,
    f_gen_uniform: CudaFunction,
    f_apply_a: CudaFunction,
    f_apply_b: CudaFunction,
    f_mine_v3: CudaFunction,
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
        let f_small_hash = get(&dev, kern::SMALL_HASH)?;
        let f_gen_perm = get(&dev, kern::GEN_PERM)?;
        let f_gen_uniform = get(&dev, kern::GEN_UNIFORM)?;
        let f_apply_a = get(&dev, kern::APPLY_A)?;
        let f_apply_b = get(&dev, kern::APPLY_B)?;
        let f_mine_v3 = get(&dev, kern::MINE_V3)?;

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
            f_small_hash,
            f_gen_perm,
            f_gen_uniform,
            f_apply_a,
            f_apply_b,
            f_mine_v3,
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
        let azi = |n_: usize| -> Result<CudaSlice<i32>> {
            d.alloc_zeros::<i32>(n_)
                .map_err(|e| anyhow::anyhow!("pearl cuda alloc i32[{n_}]: {e}"))
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
            root_a: azu(32)?,
            root_b: azu(32)?,
            a_noise_seed: azu(32)?,
            b_noise_seed: azu(32)?,
            e_al: az(m * rank)?,
            e_br: az(n * rank)?,
            e_ar_perm: azu32(k * 2)?,
            e_bl_perm: azu32(k * 2)?,
            noised_a: azi(mk)?,
            noised_b: azi(nk)?,
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
            output_tile: azu32(1)?,
            output_jackpot: azu(32)?,
            found: azu32(1)?,
        });
        Ok(())
    }

    /// One GPU-native Pearl PoUW attempt — CUDA twin of
    /// `ExtGpuMiner::pearl_pouw_mine_native`.
    pub fn mine_native(
        &mut self,
        input: &PearlPouwNativeInput<'_>,
    ) -> Result<Option<PearlPouwNativeResult>> {
        self.ensure_bufs(input)?;
        let m = input.m;
        let n = input.n;
        let k = input.k;
        let rank = input.rank;
        let mk = m * k;
        let nk = n * k;
        let num_chunks_a = mk.div_ceil(1024);
        let num_chunks_b = nk.div_ceil(1024);

        let profile = std::env::var("PEARL_PROFILE").is_ok();
        let mut prof_timings: Vec<(&str, f64)> = Vec::new();
        let prof_t0 = std::time::Instant::now();
        let mut prof_last = prof_t0;

        let b = self.bufs.as_mut().expect("bufs ensured");

        // Per-attempt uploads: job_key, target, found/output resets.
        self.dev
            .htod_copy_into(input.job_key.to_vec(), &mut b.job_key)
            .map_err(|e| anyhow::anyhow!("pearl job_key upload: {e}"))?;
        self.dev
            .htod_copy_into(input.target.to_vec(), &mut b.target)
            .map_err(|e| anyhow::anyhow!("pearl target upload: {e}"))?;
        self.dev
            .htod_copy_into(vec![0u32], &mut b.found)
            .map_err(|e| anyhow::anyhow!("pearl found reset: {e}"))?;
        self.dev
            .htod_copy_into(vec![0u32], &mut b.output_tile)
            .map_err(|e| anyhow::anyhow!("pearl output_tile reset: {e}"))?;

        let cfg_1d = |n_: usize, tpb: u32| LaunchConfig {
            grid_dim: (Self::grid_for(n_, tpb), 1, 1),
            block_dim: (tpb, 1, 1),
            shared_mem_bytes: 0,
        };

        // ── Step 1: Generate matrices A and B^T ────────────────────────
        unsafe {
            self.f_gen_matrix.clone().launch(
                cfg_1d(mk, 256),
                (&mut b.matrix_a, input.nonce, m as u32, k as u32, 0u32),
            )
        }
        .map_err(|e| anyhow::anyhow!("pearl gen_matrix A launch: {e}"))?;
        unsafe {
            self.f_gen_matrix.clone().launch(
                cfg_1d(nk, 256),
                (&mut b.matrix_bt, input.nonce, n as u32, k as u32, 1u32),
            )
        }
        .map_err(|e| anyhow::anyhow!("pearl gen_matrix Bt launch: {e}"))?;
        if profile {
            self.dev.synchronize().ok();
            prof_timings.push(("step1_gen_matrix", prof_last.elapsed().as_secs_f64() * 1000.0));
            prof_last = std::time::Instant::now();
        }

        // ── Step 2: BLAKE3 chunk hashing ───────────────────────────────
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
            unsafe {
                self.f_chunk_hash.clone().launch(
                    cfg_1d(num_chunks_a, 64),
                    (
                        &b.matrix_a,
                        &b.job_key,
                        &mut *dst_a,
                        num_chunks_a as u32,
                        single_a as u32,
                    ),
                )
            }
            .map_err(|e| anyhow::anyhow!("pearl chunk_hash A launch: {e}"))?;

            let single_b = num_chunks_b == 1;
            let dst_b: &mut CudaSlice<u8> = if single_b {
                &mut b.root_b
            } else {
                &mut b.merkle2
            };
            unsafe {
                self.f_chunk_hash.clone().launch(
                    cfg_1d(num_chunks_b, 64),
                    (
                        &b.matrix_bt,
                        &b.job_key,
                        &mut *dst_b,
                        num_chunks_b as u32,
                        single_b as u32,
                    ),
                )
            }
            .map_err(|e| anyhow::anyhow!("pearl chunk_hash B launch: {e}"))?;
        }
        if profile {
            self.dev.synchronize().ok();
            prof_timings.push(("step2_blake3_chunk", prof_last.elapsed().as_secs_f64() * 1000.0));
            prof_last = std::time::Instant::now();
        }

        // ── Step 3: Merkle tree reduction ──────────────────────────────
        // Canonical layer build: pairs merge (keyed PARENT CVs), a lone last
        // child propagates up unchanged; ROOT flag only on the final 2→1
        // merge. Each tree ping-pongs between its leaf store and `merkle`;
        // B's leaf layer lives in `merkle2` so A's merges cannot clobber B's
        // chunk CVs. (Duplicated per-tree — keeps the field borrows simple.)
        {
            let f_merge = self.f_merge.clone();
            let mut num_nodes = num_chunks_a;
            let mut src_leaf = true; // true: src=chunk_hashes dst=merkle
            while num_nodes > 1 {
                let num_parents = num_nodes.div_ceil(2);
                let is_root = num_nodes == 2;
                let cfg = cfg_1d(num_parents, 64);
                let res = unsafe {
                    match (src_leaf, is_root) {
                        (true, true) => f_merge.clone().launch(
                            cfg,
                            (&b.chunk_hashes, &b.job_key, &mut b.root_a, num_nodes as u32, 1u32),
                        ),
                        (true, false) => f_merge.clone().launch(
                            cfg,
                            (&b.chunk_hashes, &b.job_key, &mut b.merkle, num_nodes as u32, 0u32),
                        ),
                        (false, true) => f_merge.clone().launch(
                            cfg,
                            (&b.merkle, &b.job_key, &mut b.root_a, num_nodes as u32, 1u32),
                        ),
                        (false, false) => f_merge.clone().launch(
                            cfg,
                            (&b.merkle, &b.job_key, &mut b.chunk_hashes, num_nodes as u32, 0u32),
                        ),
                    }
                };
                res.map_err(|e| anyhow::anyhow!("pearl merge A launch: {e}"))?;
                src_leaf = !src_leaf;
                num_nodes = num_parents;
            }

            let mut num_nodes = num_chunks_b;
            let mut src_leaf = true; // true: src=merkle2 dst=merkle
            while num_nodes > 1 {
                let num_parents = num_nodes.div_ceil(2);
                let is_root = num_nodes == 2;
                let cfg = cfg_1d(num_parents, 64);
                let res = unsafe {
                    match (src_leaf, is_root) {
                        (true, true) => f_merge.clone().launch(
                            cfg,
                            (&b.merkle2, &b.job_key, &mut b.root_b, num_nodes as u32, 1u32),
                        ),
                        (true, false) => f_merge.clone().launch(
                            cfg,
                            (&b.merkle2, &b.job_key, &mut b.merkle, num_nodes as u32, 0u32),
                        ),
                        (false, true) => f_merge.clone().launch(
                            cfg,
                            (&b.merkle, &b.job_key, &mut b.root_b, num_nodes as u32, 1u32),
                        ),
                        (false, false) => f_merge.clone().launch(
                            cfg,
                            (&b.merkle, &b.job_key, &mut b.merkle2, num_nodes as u32, 0u32),
                        ),
                    }
                };
                res.map_err(|e| anyhow::anyhow!("pearl merge B launch: {e}"))?;
                src_leaf = !src_leaf;
                num_nodes = num_parents;
            }
        }
        if profile {
            self.dev.synchronize().ok();
            prof_timings.push(("step3_merkle", prof_last.elapsed().as_secs_f64() * 1000.0));
            prof_last = std::time::Instant::now();
        }

        // ── Step 4: Derive noise seeds ─────────────────────────────────
        // b_noise_seed = blake3(job_key || hash_b)  — unkeyed, 64-byte input
        // a_noise_seed = blake3(b_noise_seed || hash_a) — unkeyed, 64-byte input
        // Salted (cert_version ≥3): hash_eff = keyed(SEED_SALT_*, root||dim||0s).
        {
            let root_a: Vec<u8> = self
                .dev
                .dtoh_sync_copy(&b.root_a)
                .map_err(|e| anyhow::anyhow!("pearl root_a read: {e}"))?;
            let root_b: Vec<u8> = self
                .dev
                .dtoh_sync_copy(&b.root_b)
                .map_err(|e| anyhow::anyhow!("pearl root_b read: {e}"))?;

            let (hash_a_eff, hash_b_eff) = match input.seed_derivation {
                PearlSeedDerivation::Legacy => (root_a, root_b),
                PearlSeedDerivation::Salted => {
                    let mut bind_a = [0u8; 64];
                    bind_a[..32].copy_from_slice(&root_a);
                    bind_a[32..36].copy_from_slice(&(m as u32).to_le_bytes());
                    let bound_a = *blake3::keyed_hash(&PEARL_SEED_SALT_A, &bind_a).as_bytes();
                    let mut bind_b = [0u8; 64];
                    bind_b[..32].copy_from_slice(&root_b);
                    bind_b[32..36].copy_from_slice(&(n as u32).to_le_bytes());
                    let bound_b = *blake3::keyed_hash(&PEARL_SEED_SALT_B, &bind_b).as_bytes();
                    (bound_a.to_vec(), bound_b.to_vec())
                }
            };

            // b_noise_seed = blake3(job_key || hash_b)
            let mut seed_msg = [0u8; 64];
            seed_msg[..32].copy_from_slice(&input.job_key);
            seed_msg[32..].copy_from_slice(&hash_b_eff);
            self.dev
                .htod_copy_into(seed_msg.to_vec(), &mut b.seed_msg)
                .map_err(|e| anyhow::anyhow!("pearl seed_msg upload: {e}"))?;
            unsafe {
                self.f_small_hash.clone().launch(
                    cfg_1d(1, 1),
                    (&b.seed_msg, 64u32, &b.iv, 0u32, &mut b.b_noise_seed),
                )
            }
            .map_err(|e| anyhow::anyhow!("pearl small_hash b launch: {e}"))?;

            let b_seed: Vec<u8> = self
                .dev
                .dtoh_sync_copy(&b.b_noise_seed)
                .map_err(|e| anyhow::anyhow!("pearl b_seed read: {e}"))?;

            // a_noise_seed = blake3(b_noise_seed || hash_a)
            seed_msg[..32].copy_from_slice(&b_seed);
            seed_msg[32..].copy_from_slice(&hash_a_eff);
            self.dev
                .htod_copy_into(seed_msg.to_vec(), &mut b.seed_msg)
                .map_err(|e| anyhow::anyhow!("pearl seed_msg2 upload: {e}"))?;
            unsafe {
                self.f_small_hash.clone().launch(
                    cfg_1d(1, 1),
                    (&b.seed_msg, 64u32, &b.iv, 0u32, &mut b.a_noise_seed),
                )
            }
            .map_err(|e| anyhow::anyhow!("pearl small_hash a launch: {e}"))?;
        }
        if profile {
            self.dev.synchronize().ok();
            prof_timings.push(("step4_seed_derive", prof_last.elapsed().as_secs_f64() * 1000.0));
            prof_last = std::time::Instant::now();
        }

        // ── Step 5: Generate noise ─────────────────────────────────────
        // Canonical order (compute_noise_for_indices): seed LABEL goes into
        // the message body; the NOISE SEED is the BLAKE3 key.
        unsafe {
            self.f_gen_uniform.clone().launch(
                cfg_1d(m * rank, 256),
                (&mut b.e_al, &b.seed_label_a, &b.a_noise_seed, m as u32, rank as u32),
            )
        }
        .map_err(|e| anyhow::anyhow!("pearl gen_uniform e_al launch: {e}"))?;
        unsafe {
            self.f_gen_uniform.clone().launch(
                cfg_1d(n * rank, 256),
                (&mut b.e_br, &b.seed_label_b, &b.b_noise_seed, n as u32, rank as u32),
            )
        }
        .map_err(|e| anyhow::anyhow!("pearl gen_uniform e_br launch: {e}"))?;
        unsafe {
            self.f_gen_perm.clone().launch(
                cfg_1d(k, 64),
                (&mut b.e_ar_perm, &b.seed_label_a, &b.a_noise_seed, k as u32, rank as u32),
            )
        }
        .map_err(|e| anyhow::anyhow!("pearl gen_perm e_ar launch: {e}"))?;
        unsafe {
            self.f_gen_perm.clone().launch(
                cfg_1d(k, 64),
                (&mut b.e_bl_perm, &b.seed_label_b, &b.b_noise_seed, k as u32, rank as u32),
            )
        }
        .map_err(|e| anyhow::anyhow!("pearl gen_perm e_bl launch: {e}"))?;
        if profile {
            self.dev.synchronize().ok();
            prof_timings.push(("step5_noise_gen", prof_last.elapsed().as_secs_f64() * 1000.0));
            prof_last = std::time::Instant::now();
        }

        // ── Step 6: Apply noise to matrices ────────────────────────────
        unsafe {
            self.f_apply_a.clone().launch(
                cfg_1d(mk, 256),
                (
                    &mut b.noised_a,
                    &b.matrix_a,
                    &b.e_al,
                    &b.e_ar_perm,
                    m as u32,
                    k as u32,
                    rank as u32,
                    0u32,
                ),
            )
        }
        .map_err(|e| anyhow::anyhow!("pearl apply_noise_a launch: {e}"))?;
        unsafe {
            self.f_apply_b.clone().launch(
                cfg_1d(nk, 256),
                (
                    &mut b.noised_b,
                    &b.matrix_bt,
                    &b.e_br,
                    &b.e_bl_perm,
                    n as u32,
                    k as u32,
                    rank as u32,
                    0u32,
                ),
            )
        }
        .map_err(|e| anyhow::anyhow!("pearl apply_noise_b launch: {e}"))?;
        if profile {
            self.dev.synchronize().ok();
            prof_timings.push(("step6_apply_noise", prof_last.elapsed().as_secs_f64() * 1000.0));
            prof_last = std::time::Instant::now();
        }

        // ── Step 7: MatMul + jackpot + target check ────────────────────
        {
            let total_tiles = input.row_offsets.len() * input.col_offsets.len();
            self.dev
                .htod_copy_into(
                    vec![
                        input.row_offsets.len() as u32,
                        input.col_offsets.len() as u32,
                        k as u32,
                        rank as u32,
                    ],
                    &mut b.mine_params,
                )
                .map_err(|e| anyhow::anyhow!("pearl mine_params upload: {e}"))?;
            let cfg = LaunchConfig {
                grid_dim: (total_tiles as u32, 1, 1),
                block_dim: (32, 1, 1), // TILE_H × TILE_W
                shared_mem_bytes: 0,
            };
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
                        &mut b.output_tile,
                        &mut b.output_jackpot,
                        &mut b.found,
                        &b.mine_params,
                    ),
                )
            }
            .map_err(|e| anyhow::anyhow!("pearl mine_v3 launch: {e}"))?;
        }
        if profile {
            self.dev.synchronize().ok();
            prof_timings.push(("step7_mine", prof_last.elapsed().as_secs_f64() * 1000.0));
            prof_last = std::time::Instant::now();
        }

        // ── Read results ───────────────────────────────────────────────
        let found: Vec<u32> = self
            .dev
            .dtoh_sync_copy(&b.found)
            .map_err(|e| anyhow::anyhow!("pearl found read: {e}"))?;
        if found[0] == 0 {
            if profile {
                self.dev.synchronize().ok();
                prof_timings.push(("readback", prof_last.elapsed().as_secs_f64() * 1000.0));
                let total = prof_t0.elapsed().as_secs_f64() * 1000.0;
                eprint!("PEARL_PROFILE nonce={:>3} |", input.nonce);
                for (name, ms) in &prof_timings {
                    eprint!(" {}={:.2}ms", name, ms);
                }
                crate::ext_warn!(" | TOTAL={:.2}ms", total);
            }
            return Ok(None);
        }

        let tile: Vec<u32> = self
            .dev
            .dtoh_sync_copy(&b.output_tile)
            .map_err(|e| anyhow::anyhow!("pearl tile read: {e}"))?;
        let jackpot_vec: Vec<u8> = self
            .dev
            .dtoh_sync_copy(&b.output_jackpot)
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
        let mut miner = match PearlCudaMiner::new(8192) {
            Ok(m) => m,
            Err(e) => {
                eprintln!("skipping — no CUDA device: {e}");
                return;
            }
        };

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
}
