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
use cudarc::driver::sys::CUdevice_attribute;
use cudarc::driver::{
    CudaDevice, CudaFunction, CudaSlice, CudaStream, DeviceRepr, LaunchAsync, LaunchConfig,
};
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
    pub const MINE_V4: &str = "pearl_pouw_mine_native_v4";
    pub const MINE_V5: &str = "pearl_pouw_mine_native_v5";
    pub const MINE_V6: &str = "pearl_pouw_mine_native_v6";
    pub const MINE_V7: &str = "pearl_pouw_mine_native_v7";
    pub const MINE_V8: &str = "pearl_pouw_mine_native_v8";
    pub const MINE_V9: &str = "pearl_pouw_mine_native_v9";
    pub const MINE_V10: &str = "pearl_pouw_mine_native_v10";
    pub const DERIVE_SEEDS: &str = "pearl_derive_seeds";
    pub const MERKLE_TREE: &str = "pearl_merkle_tree";
    pub const GEN_DUAL: &str = "pearl_gen_matrix_dual";
    pub const GEN_CHUNK_FUSED: &str = "pearl_gen_chunk_fused";
    pub const GCM_FUSED: &str = "pearl_gen_chunk_merkle_fused";
    pub const CHUNK_DUAL: &str = "pearl_blake3_chunk_hash_dual";
    pub const CHUNK4_DUAL: &str = "pearl_blake3_chunk_hash4_dual";
    pub const MERKLE_DUAL: &str = "pearl_merkle_tree_dual";
    pub const MERKLE_DERIVE: &str = "pearl_merkle_derive_dual";
    pub const UNIFORM_DUAL: &str = "pearl_gen_uniform_dual";
    pub const PERM_DUAL: &str = "pearl_gen_permutation_dual";
    pub const NOISE_FUSED: &str = "pearl_gen_noise_fused";
    pub const APPLY_DUAL: &str = "pearl_apply_noise_dual";
    pub const APPLY_REGEN: &str = "pearl_apply_noise_regen";
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
    kern::MINE_V4,
    kern::MINE_V5,
    kern::MINE_V6,
    kern::MINE_V7,
    kern::MINE_V8,
    kern::MINE_V9,
    kern::MINE_V10,
    kern::DERIVE_SEEDS,
    kern::MERKLE_TREE,
    kern::GEN_DUAL,
    kern::GEN_CHUNK_FUSED,
    kern::GCM_FUSED,
    kern::CHUNK_DUAL,
    kern::CHUNK4_DUAL,
    kern::MERKLE_DUAL,
    kern::MERKLE_DERIVE,
    kern::UNIFORM_DUAL,
    kern::PERM_DUAL,
    kern::NOISE_FUSED,
    kern::APPLY_DUAL,
    kern::APPLY_REGEN,
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
/// Per-attempt pipeline buffers — duplicated per CUDA stream so attempt
/// `i` and `i+1` can overlap on the GPU (attempt i's mine kernel runs
/// while attempt i+1 generates/hashes/noises its own matrices).
struct PearlPipeBufs {
    matrix_a: CudaSlice<i8>,    // num_chunks_a * 1024, zero-padded
    matrix_bt: CudaSlice<i8>,   // num_chunks_b * 1024, zero-padded
    chunk_hashes: CudaSlice<u8>, // max_chunks * 32
    subtree_a: CudaSlice<u8>,    // ceil(max_chunks/1024) * 32 — block subtree roots
    subtree_b: CudaSlice<u8>,
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
}

struct PearlCudaBufs {
    m: usize,
    n: usize,
    k: usize,
    rank: usize,
    num_row_offsets: usize,
    num_col_offsets: usize,
    pipes: Vec<PearlPipeBufs>,   // one per stream in `streams`
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
    /// Merkle→derive epilogue counter — one per queued attempt, zeroed in
    /// prep_job; the last-finishing merkle block derives the noise seeds.
    derive_ctr: CudaSlice<u32>,
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
    f_gen_chunk_fused: CudaFunction,
    f_gcm_fused: CudaFunction,
    f_chunk_dual: CudaFunction,
    f_chunk4_dual: CudaFunction,
    f_merkle_dual: CudaFunction,
    f_merkle_derive: CudaFunction,
    f_uniform_dual: CudaFunction,
    f_perm_dual: CudaFunction,
    f_noise_fused: CudaFunction,
    f_apply_dual: CudaFunction,
    f_apply_regen: CudaFunction,
    f_small_hash: CudaFunction,
    f_gen_perm: CudaFunction,
    f_gen_uniform: CudaFunction,
    f_apply_a: CudaFunction,
    f_apply_b: CudaFunction,
    f_mine_v3: CudaFunction,
    f_mine_v4: CudaFunction,
    f_mine_v5: CudaFunction,
    f_mine_v6: CudaFunction,
    f_mine_v7: CudaFunction,
    f_mine_v8: CudaFunction,
    f_mine_v9: CudaFunction,
    f_mine_v10: CudaFunction,
    f_derive: CudaFunction,
    bufs: Option<PearlCudaBufs>,
    /// Concurrent non-blocking streams for attempt pipelining — attempt
    /// `i % streams.len()` runs its whole pipeline on `streams[i % len]`
    /// with `bufs.pipes[i % len]`. Empty → serialized default-stream path.
    streams: Vec<CudaStream>,
    /// Optional per-stage CUDA events (ZION_PEARL_STAGE_TIMING=1):
    /// 8 timestamps → 7 stage deltas [gen, chunk, merkle, derive, noise,
    /// apply, mine]. Read back after the post-batch sync. Stored as usize
    /// so the miner stays Send (events are used on the owning thread only).
    stage_ev: Option<[usize; 8]>,
    stage_ms: [f64; 7],
    stage_n: u64,
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
        let f_gen_chunk_fused = get(&dev, kern::GEN_CHUNK_FUSED)?;
        let f_gcm_fused = get(&dev, kern::GCM_FUSED)?;
        let f_chunk_dual = get(&dev, kern::CHUNK_DUAL)?;
        let f_chunk4_dual = get(&dev, kern::CHUNK4_DUAL)?;
        let f_merkle_dual = get(&dev, kern::MERKLE_DUAL)?;
        let f_merkle_derive = get(&dev, kern::MERKLE_DERIVE)?;
        let f_uniform_dual = get(&dev, kern::UNIFORM_DUAL)?;
        let f_perm_dual = get(&dev, kern::PERM_DUAL)?;
        let f_noise_fused = get(&dev, kern::NOISE_FUSED)?;
        let f_apply_dual = get(&dev, kern::APPLY_DUAL)?;
        let f_apply_regen = get(&dev, kern::APPLY_REGEN)?;
        let f_small_hash = get(&dev, kern::SMALL_HASH)?;
        let f_gen_perm = get(&dev, kern::GEN_PERM)?;
        let f_gen_uniform = get(&dev, kern::GEN_UNIFORM)?;
        let f_apply_a = get(&dev, kern::APPLY_A)?;
        let f_apply_b = get(&dev, kern::APPLY_B)?;
        let f_mine_v3 = get(&dev, kern::MINE_V3)?;
        let f_mine_v4 = get(&dev, kern::MINE_V4)?;
        let f_mine_v5 = get(&dev, kern::MINE_V5)?;
        let f_mine_v6 = get(&dev, kern::MINE_V6)?;
        let f_mine_v7 = get(&dev, kern::MINE_V7)?;
        let f_mine_v8 = get(&dev, kern::MINE_V8)?;
        let f_mine_v9 = get(&dev, kern::MINE_V9)?;
        let f_mine_v10 = get(&dev, kern::MINE_V10)?;
        let f_derive = get(&dev, kern::DERIVE_SEEDS)?;

        // Occupancy probe for kernel tuning: ZION_PEARL_OCC_DEBUG=1 prints
        // max active blocks/SM for the mine variants at their launch cfgs.
        if std::env::var_os("ZION_PEARL_OCC_DEBUG").is_some() {
            for (name, f, tpb) in [
                ("v6", &f_mine_v6, 128u32),
                ("v9", &f_mine_v9, 128u32),
                ("v10", &f_mine_v10, 128u32),
            ] {
                match f.occupancy_max_active_blocks_per_multiprocessor(tpb, 0, None) {
                    Ok(b) => eprintln!("[pearl-occ] {name}: {b} blocks/SM @{tpb}thr"),
                    Err(e) => eprintln!("[pearl-occ] {name}: {e}"),
                }
            }
        }

        // Attempt-pipelining streams: attempt pipelines are independent,
        // so even/odd attempts on separate non-blocking streams overlap
        // the pre-mine stages of attempt i+1 under the mine kernel of
        // attempt i. ZION_PEARL_STREAMS=1 disables pipelining.
        let want_streams: usize = std::env::var("ZION_PEARL_STREAMS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(4)
            .clamp(1, 6);
        let mut streams = Vec::new();
        for _ in 0..want_streams.max(1) {
            match dev.fork_default_stream() {
                Ok(s) => streams.push(s),
                Err(e) => {
                    crate::ext_info!(
                        "gpu_pearl_cuda_stream fork failed ({e}) — {} pipeline stream(s)",
                        streams.len()
                    );
                    break;
                }
            }
        }

        crate::ext_info!(
            "gpu_pearl_cuda_init device=\"{}\" work_size={} streams={}",
            device_name,
            work_size,
            streams.len(),
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
            f_gen_chunk_fused,
            f_gcm_fused,
            f_chunk_dual,
            f_chunk4_dual,
            f_merkle_dual,
            f_merkle_derive,
            f_uniform_dual,
            f_perm_dual,
            f_noise_fused,
            f_apply_dual,
            f_apply_regen,
            f_small_hash,
            f_gen_perm,
            f_gen_uniform,
            f_apply_a,
            f_apply_b,
            f_mine_v3,
            f_mine_v4,
            f_mine_v5,
            f_mine_v6,
            f_mine_v7,
            f_mine_v8,
            f_mine_v9,
            f_mine_v10,
            f_derive,
            bufs: None,
            streams,
            stage_ev: None,
            stage_ms: [0.0; 7],
            stage_n: 0,
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

        let npipes = self.streams.len().max(1);
        let mut pipes = Vec::with_capacity(npipes);
        for _ in 0..npipes {
            pipes.push(PearlPipeBufs {
                matrix_a: az(num_chunks_a * 1024)?,
                matrix_bt: az(num_chunks_b * 1024)?,
                chunk_hashes: azu(max_chunks * 32)?,
                subtree_a: azu(max_chunks.div_ceil(1024).max(1) * 32)?,
                subtree_b: azu(max_chunks.div_ceil(1024).max(1) * 32)?,
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
            });
        }

        self.bufs = Some(PearlCudaBufs {
            m,
            n,
            k,
            rank,
            num_row_offsets: input.row_offsets.len(),
            num_col_offsets: input.col_offsets.len(),
            pipes,
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
            derive_ctr: azu32(MAX_BATCH)?,
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
            .memset_zeros(&mut b.derive_ctr.slice_mut(0..slots))
            .map_err(|e| anyhow::anyhow!("pearl derive_ctr reset: {e}"))?;
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

        // Uploads above ride the default stream — make every pipeline
        // stream wait for them before its first attempt kernel runs.
        for s in &self.streams {
            s.wait_for_default()
                .map_err(|e| anyhow::anyhow!("pearl stream wait_for_default: {e}"))?;
        }
        Ok(())
    }

    /// Queue one full attempt pipeline (steps 1–7) on its pipeline stream.
    /// Every launch is async — the only synchronization happens in the
    /// caller after the whole batch is queued. `slot` picks which
    /// found/tile/jackpot slot the mine kernel writes; `parity` selects
    /// the stream + private buffer set so consecutive attempts overlap.
    fn queue_attempt(
        &mut self,
        input: &PearlPouwNativeInput<'_>,
        nonce: u64,
        slot: usize,
        parity: usize,
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
        let parity = parity % b.pipes.len().max(1);
        let p = &mut b.pipes[parity];

        // Optional per-stage CUDA-event profiling (ZION_PEARL_STAGE_TIMING=1).
        // Events ride the attempt's stream, so deltas measure GPU-side
        // stage time (not host launch latency). Deltas are read back
        // post-sync.
        let ev = if std::env::var_os("ZION_PEARL_STAGE_TIMING").is_some() {
            if self.stage_ev.is_none() {
                let mut a = [0usize; 8];
                for e in a.iter_mut() {
                    if let Ok(created) = cudarc::driver::result::event::create(
                        cudarc::driver::sys::CUevent_flags::CU_EVENT_DEFAULT,
                    ) {
                        *e = created as usize;
                    }
                }
                self.stage_ev = Some(a);
            }
            self.stage_ev
        } else {
            None
        };
        let pipe_stream: Option<&CudaStream> = self.streams.get(parity);
        let stream = pipe_stream
            .map(|s| s.stream)
            .unwrap_or_else(|| *self.dev.cu_stream());
        macro_rules! rec {
            ($i:expr) => {
                if let Some(e) = ev {
                    unsafe {
                        let _ = cudarc::driver::result::event::record(
                            e[$i] as cudarc::driver::sys::CUevent,
                            stream,
                        );
                    }
                }
            };
        }
        // Launch on the attempt's pipeline stream when present, else the
        // device default stream (identical to the pre-pipelining path).
        macro_rules! klaunch {
            ($f:expr, $cfg:expr, $args:expr) => {
                match pipe_stream {
                    Some(s) => unsafe { (*$f).clone().launch_on_stream(s, $cfg, $args) },
                    None => unsafe { (*$f).clone().launch($cfg, $args) },
                }
            };
        }
        // Raw-arg variant for kernels exceeding the 12-tuple LaunchAsync
        // limit — caller builds a Vec<*mut c_void> of as_kernel_param()
        // results (scalar values must be bound to locals that outlive the
        // launch expression).
        macro_rules! klaunch_raw {
            ($f:expr, $cfg:expr, $argv:expr) => {{
                let mut argv = $argv;
                match pipe_stream {
                    Some(s) => unsafe {
                        (*$f).clone().launch_on_stream(s, $cfg, &mut argv)
                    },
                    None => unsafe { (*$f).clone().launch($cfg, &mut argv) },
                }
            }};
        }
        rec!(0);

        let cfg_1d = |n_: usize, tpb: u32| LaunchConfig {
            grid_dim: (Self::grid_for(n_, tpb), 1, 1),
            block_dim: (tpb, 1, 1),
            shared_mem_bytes: 0,
        };

        // ── Steps 1+2: gen + chunk hash ────────────────────────────────
        // When both matrices are an exact multiple of the 1KB BLAKE3
        // chunk, ONE kernel generates each chunk in registers, streams it
        // to global memory, and hashes it in the same pass — saving the
        // full matrix readback and a launch boundary.
        let gen_chunk_fused = mk % 1024 == 0 && nk % 1024 == 0;
        // Subtree-root counts — each 1024-thread block of the fully fused
        // kernel covers a power-of-two-aligned ≤1024-leaf subtree, so the
        // downstream merge kernel runs over subtree roots instead of the
        // raw chunk-leaf layer.
        // PEARL_SUBTREE must equal the .cu define — the launch block size
        // IS the subtree leaf capacity.
        let nsb_a = num_chunks_a.div_ceil(128);
        let nsb_b = num_chunks_b.div_ceil(128);
        if gen_chunk_fused {
            // gen + chunk-hash + in-block subtree Merkle in ONE launch.
            klaunch!(
                &self.f_gcm_fused,
                LaunchConfig {
                    grid_dim: ((nsb_a + nsb_b) as u32, 1, 1),
                    block_dim: (128, 1, 1),
                    shared_mem_bytes: 0,
                },
                (
                    &mut p.matrix_a,
                    &mut p.matrix_bt,
                    &b.job_key,
                    &mut p.subtree_a,
                    &mut p.subtree_b,
                    nonce,
                    num_chunks_a as u32,
                    num_chunks_b as u32,
                    (num_chunks_a == 1) as u32,
                    (num_chunks_b == 1) as u32,
                    nsb_a as u32,
                    nsb_b as u32,
                )
            )
            .map_err(|e| anyhow::anyhow!("pearl gen_chunk_merkle launch: {e}"))?;
            rec!(1);
            rec!(2);
        } else {
            klaunch!(
                &self.f_gen_dual,
                cfg_1d(mk + nk, 256),
                (
                    &mut p.matrix_a,
                    &mut p.matrix_bt,
                    nonce,
                    m as u32,
                    n as u32,
                    k as u32,
                )
            )
            .map_err(|e| anyhow::anyhow!("pearl gen_matrix_dual launch: {e}"))?;
            rec!(1);

            // Single-chunk matrices write the chunk CV straight into the
            // root buffer with the ROOT flag (canonical MerkleTree hashes
            // <=1024B directly, skipping the tree).
            let single_a = num_chunks_a == 1;
            let dst_a: &mut CudaSlice<u8> = if single_a {
                &mut p.root_a
            } else {
                &mut p.chunk_hashes
            };
            let single_b = num_chunks_b == 1;
            let dst_b: &mut CudaSlice<u8> = if single_b {
                &mut p.root_b
            } else {
                &mut p.merkle2
            };
            klaunch!(
                &self.f_chunk_dual,
                cfg_1d(num_chunks_a + num_chunks_b, 64),
                (
                    &p.matrix_a,
                    &p.matrix_bt,
                    &b.job_key,
                    &mut *dst_a,
                    &mut *dst_b,
                    num_chunks_a as u32,
                    num_chunks_b as u32,
                    single_a as u32,
                    single_b as u32,
                )
            )
            .map_err(|e| anyhow::anyhow!("pearl chunk_hash_dual launch: {e}"))?;
            rec!(2);
        }

        // ── Step 3: Merkle tree reduction ──────────────────────────────
        // One dual launch folds BOTH trees — block 0 = A (chunk_hashes ↔
        // merkle), block 1 = B (merkle2 ↔ merkle_b). Per level: grid-stride,
        // __syncthreads between levels; odd-leaf passthrough + ROOT-flag
        // semantics identical to the old per-level merge launches.
        // When the fully fused kernel ran, the "leaf layer" is the subtree
        // roots (nsb entries each) — the same dual merge kernel folds them
        // into the real roots bit-identically (canonical BLAKE3 subtree
        // merge) and still runs the derive epilogue.
        let fused_derive =
            gen_chunk_fused || (num_chunks_a > 1 && num_chunks_b > 1);
        {
            let cfg_tree1 = LaunchConfig {
                grid_dim: (1, 1, 1),
                block_dim: (1024, 1, 1),
                shared_mem_bytes: 0,
            };
            let need_a = num_chunks_a > 1;
            let need_b = num_chunks_b > 1;
            if fused_derive {
                // Fused merkle+derive: the second-finishing block derives
                // the noise seeds inline (derive_ctr[slot] zeroed per job).
                // 17 params > 12-tuple LaunchAsync limit → raw argv.
                let n_chunks_a = if gen_chunk_fused {
                    nsb_a as u32
                } else {
                    num_chunks_a as u32
                };
                let n_chunks_b = if gen_chunk_fused {
                    nsb_b as u32
                } else {
                    num_chunks_b as u32
                };
                let dim_a = m as u32;
                let dim_b = n as u32;
                let salted = match input.seed_derivation {
                    PearlSeedDerivation::Salted => 1u32,
                    PearlSeedDerivation::Legacy => 0u32,
                };
                let mut ctr_view = b.derive_ctr.slice_mut(slot..slot + 1);
                let leaves_a: &mut CudaSlice<u8> = if gen_chunk_fused {
                    &mut p.subtree_a
                } else {
                    &mut p.chunk_hashes
                };
                let leaves_b: &mut CudaSlice<u8> = if gen_chunk_fused {
                    &mut p.subtree_b
                } else {
                    &mut p.merkle2
                };
                let argv: Vec<*mut std::ffi::c_void> = vec![
                    leaves_a.as_kernel_param(),
                    leaves_b.as_kernel_param(),
                    (&mut p.merkle).as_kernel_param(),
                    (&mut p.merkle_b).as_kernel_param(),
                    (&b.job_key).as_kernel_param(),
                    (&mut p.root_a).as_kernel_param(),
                    (&mut p.root_b).as_kernel_param(),
                    n_chunks_a.as_kernel_param(),
                    n_chunks_b.as_kernel_param(),
                    (&b.salt_a).as_kernel_param(),
                    (&b.salt_b).as_kernel_param(),
                    dim_a.as_kernel_param(),
                    dim_b.as_kernel_param(),
                    salted.as_kernel_param(),
                    (&mut p.a_noise_seed).as_kernel_param(),
                    (&mut p.b_noise_seed).as_kernel_param(),
                    (&mut ctr_view).as_kernel_param(),
                ];
                klaunch_raw!(
                    &self.f_merkle_derive,
                    LaunchConfig {
                        grid_dim: (2, 1, 1),
                        block_dim: (1024, 1, 1),
                        shared_mem_bytes: 0,
                    },
                    argv
                )
                .map_err(|e| anyhow::anyhow!("pearl merkle_derive_dual launch: {e}"))?;
            } else {
                if need_a {
                    klaunch!(
                        &self.f_merkle_tree,
                        cfg_tree1,
                        (
                            &mut p.chunk_hashes,
                            &b.job_key,
                            &mut p.merkle,
                            &mut p.root_a,
                            num_chunks_a as u32,
                        )
                    )
                    .map_err(|e| anyhow::anyhow!("pearl merkle_tree A launch: {e}"))?;
                }
                if need_b {
                    klaunch!(
                        &self.f_merkle_tree,
                        cfg_tree1,
                        (
                            &mut p.merkle2,
                            &b.job_key,
                            &mut p.merkle_b,
                            &mut p.root_b,
                            num_chunks_b as u32,
                        )
                    )
                    .map_err(|e| anyhow::anyhow!("pearl merkle_tree B launch: {e}"))?;
                }
            }
        }
        rec!(3);

        // ── Step 4: Derive noise seeds (fully on-device) ───────────────
        // salted: hash_eff = keyed(SEED_SALT_*, root||dim||0s); legacy: root.
        // b_noise_seed = blake3(job_key || hash_b) — unkeyed, 64-byte input
        // a_noise_seed = blake3(b_noise_seed || hash_a) — unkeyed, 64-byte
        // input. Replaces the old dtoh→CPU-hash→htod roundtrip (3 syncs).
        // Skipped when the fused merkle+derive epilogue already ran.
        if !fused_derive {
            let salted = match input.seed_derivation {
                PearlSeedDerivation::Salted => 1u32,
                PearlSeedDerivation::Legacy => 0u32,
            };
            klaunch!(
                &self.f_derive,
                cfg_1d(1, 1),
                (
                    &p.root_a,
                    &p.root_b,
                    &b.job_key,
                    &b.salt_a,
                    &b.salt_b,
                    m as u32,
                    n as u32,
                    salted,
                    &mut p.a_noise_seed,
                    &mut p.b_noise_seed,
                )
            )
            .map_err(|e| anyhow::anyhow!("pearl derive_seeds launch: {e}"))?;
        }
        rec!(4);

        // ── Step 5: Generate noise (one fused launch) ──────────────────
        // Canonical order (compute_noise_for_indices): seed LABEL goes into
        // the message body; the NOISE SEED is the BLAKE3 key. uniform+perm
        // are independent → single launch, threads partition by gid range.
        klaunch!(
            &self.f_noise_fused,
            cfg_1d(
                (m * rank).div_ceil(32) + (n * rank).div_ceil(32) + 2 * k.div_ceil(8),
                256
            ),
            (
                &mut p.e_al,
                &mut p.e_br,
                &mut p.e_ar_perm,
                &mut p.e_bl_perm,
                &b.seed_label_a,
                &p.a_noise_seed,
                &b.seed_label_b,
                &p.b_noise_seed,
                m as u32,
                n as u32,
                rank as u32,
                k as u32,
            )
        )
        .map_err(|e| anyhow::anyhow!("pearl gen_noise_fused launch: {e}"))?;
        rec!(5);

        // ── Step 6: Apply noise to matrices (fused, one launch) ────────
        // Matrices are never materialized in the fused pipeline — apply
        // regenerates each element via gen_int7 (pure function of
        // nonce+index), saving the 4MB matrix readback.
        klaunch!(
            &self.f_apply_regen,
            cfg_1d(mk + nk, 256),
            (
                &mut p.noised_a,
                nonce,
                &p.e_al,
                &p.e_ar_perm,
                m as u32,
                &mut p.noised_b,
                &p.e_br,
                &p.e_bl_perm,
                n as u32,
                k as u32,
                rank as u32,
            )
        )
        .map_err(|e| anyhow::anyhow!("pearl apply_noise_regen launch: {e}"))?;
        rec!(6);

        // ── Step 7: MatMul + jackpot + target check ────────────────────
        {
            // Kernel select: v5 (default) stages the band's A-window in
            // shared memory cooperatively (4 strips/block → ~30cy smem reads
            // replace ~600cy L2 reads); v4 = per-warp strips direct-global;
            // v3 = one tile per warp. ZION_PEARL_MINE=v3|v4|v5 for A/B.
            let nro = input.row_offsets.len() as u32;
            let nco = input.col_offsets.len() as u32;
            let ver = std::env::var("ZION_PEARL_MINE").unwrap_or_else(|_| "v6".into());
            // v5's staged window holds 32 rows × rank/16 int4 per buffer
            // (≤256 slots → rank ≤ 128); larger ranks fall back to v4.
            let ver = if ver == "v5" && input.rank > 128 { "v4".into() } else { ver };
            // v6/v7 need int8 tensor cores (sm_80+) and the canonical window
            // layout (rank==128, k%128==0); otherwise fall back to v4.
            let ver = if ver == "v6" || ver == "v7" || ver == "v8" || ver == "v9" || ver == "v10" {
                let cc_major = self
                    .dev
                    .attribute(CUdevice_attribute::CU_DEVICE_ATTRIBUTE_COMPUTE_CAPABILITY_MAJOR)
                    .unwrap_or(0);
                if cc_major >= 8 && input.rank == 128 && input.k % 128 == 0 {
                    ver
                } else {
                    "v4".into()
                }
            } else {
                ver
            };
            let cfg = if ver == "v3" {
                LaunchConfig {
                    grid_dim: ((nro * nco).div_ceil(4), 1, 1),
                    block_dim: (128, 1, 1),
                    shared_mem_bytes: 0,
                }
            } else if ver == "v6" {
                // warp-strip = 4 col-offsets of one band → bands × ceil(nco/4)
                let wstrips = nco.div_ceil(4) * nro.div_ceil(8);
                LaunchConfig {
                    grid_dim: (wstrips.div_ceil(4), 1, 1),
                    block_dim: (128, 1, 1),
                    shared_mem_bytes: 0,
                }
            } else if ver == "v7" {
                // warp-strip = 8 col-offsets of one band → bands × ceil(nco/8)
                let wstrips = nco.div_ceil(8) * nro.div_ceil(8);
                LaunchConfig {
                    grid_dim: (wstrips.div_ceil(4), 1, 1),
                    block_dim: (128, 1, 1),
                    shared_mem_bytes: 0,
                }
            } else if ver == "v8" {
                // warp-strip = 4 col-offsets of one band (v6 grid), smem
                // carries the double-buffered B stage
                let wstrips = nco.div_ceil(4) * nro.div_ceil(8);
                LaunchConfig {
                    grid_dim: (wstrips.div_ceil(4), 1, 1),
                    block_dim: (128, 1, 1),
                    shared_mem_bytes: 0,
                }
            } else if ver == "v9" || ver == "v10" {
                // block = 1 band (8 tiles) × 16 col-offsets →
                // bands × ceil(nco/16) blocks of 128 threads
                let bands = nro.div_ceil(8);
                let ncib = nco.div_ceil(16);
                LaunchConfig {
                    grid_dim: (bands * ncib, 1, 1),
                    block_dim: (128, 1, 1),
                    shared_mem_bytes: 0,
                }
            } else {
                let strips = nco * nro.div_ceil(8);
                LaunchConfig {
                    grid_dim: (strips.div_ceil(4), 1, 1),
                    block_dim: (128, 1, 1), // 4 strips/block
                    shared_mem_bytes: 0,
                }
            };
            let mut tile_view = b.output_tile.slice_mut(slot..slot + 1);
            let mut jackpot_view = b.output_jackpot.slice_mut(slot * 32..(slot + 1) * 32);
            let mut found_view = b.found.slice_mut(slot..slot + 1);
            klaunch!(
                match ver.as_str() {
                    "v3" => &self.f_mine_v3,
                    "v4" => &self.f_mine_v4,
                    "v5" => &self.f_mine_v5,
                    "v6" => &self.f_mine_v6,
                    "v7" => &self.f_mine_v7,
                    "v8" => &self.f_mine_v8,
                    "v9" => &self.f_mine_v9,
                    "v10" => &self.f_mine_v10,
                    _ => &self.f_mine_v4,
                },
                cfg,
                (
                    &p.noised_a,
                    &p.noised_b,
                    &p.a_noise_seed,
                    &b.target,
                    &b.row_off,
                    &b.col_off,
                    &b.rows_base,
                    &b.cols_base,
                    &mut tile_view,
                    &mut jackpot_view,
                    &mut found_view,
                    &b.mine_params,
                )
            )
            .map_err(|e| anyhow::anyhow!("pearl mine_v3 launch: {e}"))?;
        }
        rec!(7);

        Ok(())
    }

    /// Make the default stream wait for every pipeline stream's queued
    /// work — subsequent `dtoh_sync_copy` readbacks on the default stream
    /// then observe all pipelined attempts as complete.
    fn sync_pipes(&self) -> Result<()> {
        for s in &self.streams {
            self.dev
                .wait_for(s)
                .map_err(|e| anyhow::anyhow!("pearl pipeline stream sync: {e}"))?;
        }
        Ok(())
    }

    /// Read back the last queued attempt's stage deltas (call only after a
    /// stream sync — dtoh_sync_copy qualifies). Averages are logged every
    /// 64 samples: gen/chunk/merkle/derive/noise/apply/mine.
    fn collect_stage_timing(&mut self) {
        let Some(ev) = self.stage_ev else {
            return;
        };
        if ev[0] == 0 || ev[7] == 0 {
            return;
        }
        for (i, acc) in self.stage_ms.iter_mut().enumerate() {
            if let Ok(ms) = unsafe {
                cudarc::driver::result::event::elapsed(
                    ev[i] as cudarc::driver::sys::CUevent,
                    ev[i + 1] as cudarc::driver::sys::CUevent,
                )
            } {
                *acc += ms as f64;
            }
        }
        self.stage_n += 1;
        if self.stage_n % 64 == 0 {
            const NAMES: [&str; 7] = [
                "gen", "chunk", "merkle", "derive", "noise", "apply", "mine",
            ];
            let n = self.stage_n as f64;
            let parts: Vec<String> = NAMES
                .iter()
                .zip(self.stage_ms.iter())
                .map(|(name, sum)| format!("{name}={:.3}", sum / n))
                .collect();
            let total: f64 = self.stage_ms.iter().sum::<f64>() / n;
            eprintln!(
                "[pearl-stage] avg ms/attempt over {} attempts: {} | total={:.3}ms",
                self.stage_n,
                parts.join(" "),
                total
            );
            self.stage_ms = [0.0; 7];
            self.stage_n = 0;
        }
    }

    /// One GPU-native Pearl PoUW attempt — CUDA twin of
    /// `ExtGpuMiner::pearl_pouw_mine_native`.
    pub fn mine_native(
        &mut self,
        input: &PearlPouwNativeInput<'_>,
    ) -> Result<Option<PearlPouwNativeResult>> {
        self.ensure_bufs(input)?;
        self.prep_job(input, 1)?;
        self.queue_attempt(input, input.nonce, 0, 0)?;
        self.sync_pipes()?;

        let m = input.m;
        let n = input.n;
        let k = input.k;
        let mk = m * k;
        let nk = n * k;
        let b = self.bufs.as_mut().expect("bufs ensured");
        let p = &mut b.pipes[0];

        // ── Read results ───────────────────────────────────────────────
        let found: Vec<u32> = self
            .dev
            .dtoh_sync_copy(&b.found.slice(0..1))
            .map_err(|e| anyhow::anyhow!("pearl found read: {e}"))?;
        if found[0] == 0 {
            drop(b);
            self.collect_stage_timing();
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
        // The fused pipeline never stores matrix bytes (hashed in
        // registers), so materialize them now — gen_int7 is deterministic
        // in (nonce, index), this reproduces the exact matrices.
        {
            let cfg_gen = LaunchConfig {
                grid_dim: (Self::grid_for(mk + nk, 256), 1, 1),
                block_dim: (256, 1, 1),
                shared_mem_bytes: 0,
            };
            unsafe {
                self.f_gen_dual
                    .clone()
                    .launch(
                        cfg_gen,
                        (
                            &mut p.matrix_a,
                            &mut p.matrix_bt,
                            input.nonce,
                            m as u32,
                            n as u32,
                            k as u32,
                        ),
                    )
                    .map_err(|e| anyhow::anyhow!("pearl on-hit regen launch: {e}"))?;
            }
        }
        let mut matrix_a = vec![0i8; mk];
        {
            let padded: Vec<i8> = self
                .dev
                .dtoh_sync_copy(&p.matrix_a)
                .map_err(|e| anyhow::anyhow!("pearl matrix_a read: {e}"))?;
            matrix_a.copy_from_slice(&padded[..mk]);
        }
        let mut matrix_bt = vec![0i8; nk];
        {
            let padded: Vec<i8> = self
                .dev
                .dtoh_sync_copy(&p.matrix_bt)
                .map_err(|e| anyhow::anyhow!("pearl matrix_bt read: {e}"))?;
            matrix_bt.copy_from_slice(&padded[..nk]);
        }

        drop(b);
        self.collect_stage_timing();
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
            self.queue_attempt(input, input.nonce.wrapping_add(i as u64), i, i)?;
        }
        self.sync_pipes()?;

        let found: Vec<u32> = self
            .dev
            .dtoh_sync_copy(&self.bufs.as_ref().unwrap().found.slice(0..batch))
            .map_err(|e| anyhow::anyhow!("pearl batch found read: {e}"))?;
        self.collect_stage_timing();
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

// CudaStream holds a raw CUstream handle (!Send in cudarc-0.12) — it is
// only ever used through bind_to_thread'd driver calls (launch_on_stream,
// wait_for_default, wait_for), same guarantee cudarc itself relies on for
// its unsafe Send impls on CudaDevice/CudaFunction.
unsafe impl Send for PearlCudaMiner {}

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
