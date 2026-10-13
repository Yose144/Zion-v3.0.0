//! Pearl (PRL) PoUW miner-side helpers: mining config, job_key, keyed-BLAKE3
//! Merkle tree + multi-leaf proof builder, and `PlainProof` bincode encoding.
//!
//! This is the producer half of the pipeline — the pool's verifier
//! (`zion_pool::pearl`) independently recomputes everything this module emits,
//! so both sides were ported separately from the canonical upstream:
//!   - `zk-pow/src/ffi/mine.rs`        — try_mine_one, compute_job_key, threads_partition
//!   - `zk-pow/src/ffi/plain_proof.rs` — PlainProof/MatrixMerkleProof layout
//!   - `zk-pow/src/api/proof.rs`       — MiningConfiguration::to_bytes, PeriodicPattern
//!   - `pearl-blake3/src/merkle.rs`    — MerkleTree, get_multileaf_proof (sibling order)

use anyhow::{ensure, Context, Result};

pub const CHUNK_LEN: usize = 1024;

// ============================================================================
// PeriodicPattern (api/proof.rs port — list form, serialization, valid offsets)
// ============================================================================

/// A periodic index pattern: `shape[i] = (stride, length)`, innermost last.
/// `to_list()` expands to the sorted set of indices the pattern covers within
/// one period.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PeriodicPattern {
    shape: [(u32, u32); 3],
}

impl PeriodicPattern {
    pub fn period(&self) -> u32 {
        self.shape.iter().map(|&(s, l)| s * l).last().unwrap_or(1)
    }

    pub fn size(&self) -> usize {
        self.shape.iter().map(|&(_, l)| l).product::<u32>() as usize
    }

    /// MiningConfiguration 6-byte encoding: (factor-1, length-1) byte pairs.
    pub fn to_bytes(&self) -> [u8; 6] {
        let mut data = [0u8; 6];
        let mut min_stride = 1u32;
        for (i, &(stride, length)) in self.shape.iter().enumerate() {
            let factor = stride / min_stride;
            data[2 * i] = (factor - 1) as u8;
            data[2 * i + 1] = (length - 1) as u8;
            min_stride = stride * length;
        }
        data
    }

    /// Expand the pattern into its sorted index list (one period).
    /// Inverse of `from_list`: index = sum over dims of digit * stride.
    pub fn to_list(&self) -> Vec<u32> {
        let mut out = Vec::with_capacity(self.size());
        for i0 in 0..self.shape[0].1 {
            for i1 in 0..self.shape[1].1 {
                for i2 in 0..self.shape[2].1 {
                    out.push(i0 * self.shape[0].0 + i1 * self.shape[1].0 + i2 * self.shape[2].0);
                }
            }
        }
        out.sort_unstable();
        out
    }

    /// `offset_is_valid` — the offset folds into every (stride, length) dim
    /// landing < stride, i.e. the whole tile stays inside its period cell.
    pub fn offset_is_valid(&self, mut offset: u32) -> bool {
        for &(stride, length) in self.shape.iter().rev() {
            offset %= stride * length;
            if offset >= stride {
                return false;
            }
        }
        true
    }

    /// `from_list` — sorted-unique indices starting at 0, decomposed into
    /// nested periods (innermost first), padded to 3 dims.
    pub fn from_list(pattern: &[u32]) -> Result<Self> {
        ensure!(!pattern.is_empty(), "empty pattern");
        ensure!(
            pattern.windows(2).all(|w| w[0] < w[1]),
            "pattern not strictly increasing"
        );
        ensure!(pattern[0] == 0, "pattern must start at 0");
        let mut p: Vec<u32> = pattern.to_vec();
        let mut shape_vec = Vec::new();
        while p.len() > 1 {
            let mut found = false;
            for period in 1..p.len() {
                if p.len() % period == 0 {
                    let s = p[period];
                    if (0..p.len() - period).all(|i| p[i] + s == p[i + period]) {
                        shape_vec.push((s, (p.len() / period) as u32));
                        p.truncate(period);
                        found = true;
                        break;
                    }
                }
            }
            ensure!(found, "indices not periodic");
        }
        shape_vec.reverse();
        let period = shape_vec.last().map_or(1, |&(s, l)| s * l);
        while shape_vec.len() < 3 {
            shape_vec.push((period, 1));
        }
        let result = Self {
            shape: shape_vec.try_into().unwrap(),
        };
        // `is_valid` — must roundtrip through the 6-byte encoding.
        let bytes = result.to_bytes();
        let mut min_stride = 1u32;
        for (i, &(stride, length)) in result.shape.iter().enumerate() {
            ensure!(
                stride / min_stride - 1 == bytes[2 * i] as u32
                    && length - 1 == bytes[2 * i + 1] as u32,
                "pattern does not roundtrip serialization"
            );
            min_stride = stride * length;
        }
        Ok(result)
    }
}

// ============================================================================
// Mining configuration
// ============================================================================

/// Hash-tile geometry compiled into `pearl_pouw_native.cl`
/// (`#define TILE_H/TILE_W` — change requires kernel rebuild).
pub const KERNEL_TILE_H: usize = 4;
pub const KERNEL_TILE_W: usize = 8;

/// Pearl mining configuration — the miner chooses the matrix geometry; the
/// gateway job carries only (header, target, cert_version). Patterns must
/// produce `KERNEL_TILE_H`/`KERNEL_TILE_W` elements.
#[derive(Debug, Clone)]
pub struct PearlMineConfig {
    pub m: usize,
    pub n: usize,
    /// common_dim — inner dimension (A is m×k, B is k×n).
    pub k: usize,
    /// noise rank — pow2, multiple of 32, >= 128 (`PENALTY_BASE_RANK`).
    pub rank: usize,
    pub rows_pattern: PeriodicPattern,
    pub cols_pattern: PeriodicPattern,
}

impl PearlMineConfig {
    /// Defaults match the kernel tile (4×8) and upstream's reference config
    /// (common_dim 1024, rank 128). Env overrides:
    /// `ZION_PEARL_M`/`_N`/`_K`/`_RANK`, patterns via
    /// `ZION_PEARL_ROWS_PATTERN`/`ZION_PEARL_COLS_PATTERN` (comma-separated).
    pub fn from_env() -> Result<Self> {
        let dim = |name: &str, default: usize| -> usize {
            std::env::var(name)
                .ok()
                .and_then(|v| v.trim().parse().ok())
                .unwrap_or(default)
        };
        let pattern = |name: &str, default: &[u32]| -> Result<PeriodicPattern> {
            match std::env::var(name) {
                Ok(v) => {
                    let list: Vec<u32> = v
                        .split(',')
                        .map(|s| s.trim().parse::<u32>())
                        .collect::<std::result::Result<_, _>>()
                        .with_context(|| format!("{name}: bad pattern list"))?;
                    PeriodicPattern::from_list(&list)
                        .with_context(|| format!("{name}: invalid pattern"))
                }
                Err(_) => PeriodicPattern::from_list(default),
            }
        };
        let cfg = Self {
            m: dim("ZION_PEARL_M", 1024),
            n: dim("ZION_PEARL_N", 1024),
            k: dim("ZION_PEARL_K", 1024),
            rank: dim("ZION_PEARL_RANK", 128),
            rows_pattern: pattern("ZION_PEARL_ROWS_PATTERN", &[0, 8, 64, 72])?,
            cols_pattern: pattern("ZION_PEARL_COLS_PATTERN", &[0, 1, 8, 9, 64, 65, 72, 73])?,
        };
        ensure!(
            cfg.rows_pattern.size() == KERNEL_TILE_H,
            "rows pattern size {} != kernel TILE_H {KERNEL_TILE_H}",
            cfg.rows_pattern.size()
        );
        ensure!(
            cfg.cols_pattern.size() == KERNEL_TILE_W,
            "cols pattern size {} != kernel TILE_W {KERNEL_TILE_W}",
            cfg.cols_pattern.size()
        );
        ensure!(
            cfg.rank >= 128 && cfg.rank.is_power_of_two() && cfg.rank % 32 == 0,
            "rank {} must be pow2 >=128 divisible by 32",
            cfg.rank
        );
        ensure!(cfg.k % cfg.rank == 0, "k {} not divisible by rank", cfg.k);
        ensure!(
            cfg.m % cfg.rows_pattern.period() as usize == 0,
            "m {} not divisible by rows period {}",
            cfg.m,
            cfg.rows_pattern.period()
        );
        ensure!(
            cfg.n % cfg.cols_pattern.period() as usize == 0,
            "n {} not divisible by cols period {}",
            cfg.n,
            cfg.cols_pattern.period()
        );
        Ok(cfg)
    }

    /// `MiningConfiguration::to_bytes` — 52 bytes:
    /// common_dim u32LE | rank u16LE | mma_type u16LE(0=Int7xInt7ToInt32) |
    /// rows_pattern 6B | cols_pattern 6B | 32B zero trailer (MoE fields).
    pub fn to_bytes(&self) -> [u8; 52] {
        let mut cfg = [0u8; 52];
        cfg[0..4].copy_from_slice(&(self.k as u32).to_le_bytes());
        cfg[4..6].copy_from_slice(&(self.rank as u16).to_le_bytes());
        cfg[8..14].copy_from_slice(&self.rows_pattern.to_bytes());
        cfg[14..20].copy_from_slice(&self.cols_pattern.to_bytes());
        cfg
    }

    /// `compute_job_key` = blake3(header.to_bytes() ‖ config.to_bytes()).
    pub fn job_key(&self, header: &[u8; 76]) -> [u8; 32] {
        let mut data = Vec::with_capacity(128);
        data.extend_from_slice(header);
        data.extend_from_slice(&self.to_bytes());
        *blake3::hash(&data).as_bytes()
    }

    /// `penalized_target_bound` adjustment: `tile_size * (dpl/rank) *
    /// PENALTY_BASE_RANK`. The miner compares the jackpot against
    /// `share_target * adjustment` (same as the pool verifier).
    pub fn adjustment_factor(&self) -> num_bigint::BigUint {
        let tile_size = (self.rows_pattern.size() * self.cols_pattern.size()) as u64;
        let dpl = self.k - self.k % self.rank;
        num_bigint::BigUint::from(tile_size)
            * num_bigint::BigUint::from((dpl / self.rank) as u64)
            * num_bigint::BigUint::from(128u64)
    }

    /// `threads_partition` offsets: 0..dim filtered by `offset_is_valid`
    /// (validity already guarantees the tile stays in-bounds since
    /// period | dim).
    pub fn row_offsets(&self) -> Vec<u32> {
        (0..self.m as u32)
            .filter(|&o| self.rows_pattern.offset_is_valid(o))
            .collect()
    }
    pub fn col_offsets(&self) -> Vec<u32> {
        (0..self.n as u32)
            .filter(|&o| self.cols_pattern.offset_is_valid(o))
            .collect()
    }
    pub fn rows_base(&self) -> Vec<u32> {
        self.rows_pattern.to_list()
    }
    pub fn cols_base(&self) -> Vec<u32> {
        self.cols_pattern.to_list()
    }
}

// ============================================================================
// GPU mining input/result types (feature-agnostic — the OpenCL implementation
// lives in `gpu_opencl_full`, but these plain data types must be reachable
// without the `gpu-opencl` feature for runtime dispatch).
// ============================================================================

/// How noise seeds are bound to the matrix Merkle roots — mirrors upstream
/// `zk-pow::api::seed::SeedDerivation`. `Salted` is required by cert_version=3
/// (current chain); `Legacy` only verifies pre-V3 jobs.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum PearlSeedDerivation {
    /// Pre-V3: raw Merkle roots feed the noise-seed chain.
    #[default]
    Legacy,
    /// V3: roots are first bound to dimensions via
    /// `blake3_keyed(SEED_SALT_{A,B}, root || dim_u32le || 28×00)`.
    Salted,
}

/// V3 domain-separation salt for A's root:
/// `blake3("pearl/cert-v3/noise-seed/A")` (upstream `api/seed.rs`).
pub const PEARL_SEED_SALT_A: [u8; 32] = [
    0x82, 0x49, 0x40, 0x6c, 0xa0, 0xed, 0x15, 0x16, 0x96, 0x16, 0xf6, 0x92, 0xfc, 0xf0, 0x76, 0xf8,
    0x92, 0xdb, 0xdb, 0x2a, 0x70, 0x23, 0xb8, 0x52, 0xf0, 0xd4, 0x77, 0x19, 0xc3, 0x90, 0x01, 0x7b,
];

/// V3 domain-separation salt for B's root:
/// `blake3("pearl/cert-v3/noise-seed/B")` (upstream `api/seed.rs`).
pub const PEARL_SEED_SALT_B: [u8; 32] = [
    0x11, 0x30, 0x06, 0x32, 0xec, 0x63, 0x01, 0xca, 0x2b, 0xe2, 0xaf, 0x71, 0x8b, 0x3f, 0x4d, 0x4f,
    0x1a, 0xe9, 0xc6, 0x39, 0x88, 0xe8, 0xcc, 0x04, 0x48, 0x44, 0x30, 0x1d, 0x71, 0xb8, 0x9a, 0xa9,
];

/// Canonical noise seed labels (`padded_seed_label(b"A_tensor"/b"B_tensor")`) —
/// they go into the *message body* (bytes 32..64) of `get_random_hash`; the
/// noise seed is the BLAKE3 *key*.
pub const PEARL_SEED_LABEL_A: [u8; 32] = {
    let mut l = [0u8; 32];
    l[0] = b'A';
    l[1] = b'_';
    let rest = *b"tensor";
    let mut i = 0;
    while i < 6 {
        l[2 + i] = rest[i];
        i += 1;
    }
    l
};

/// See [`PEARL_SEED_LABEL_A`].
pub const PEARL_SEED_LABEL_B: [u8; 32] = {
    let mut l = [0u8; 32];
    l[0] = b'B';
    l[1] = b'_';
    let rest = *b"tensor";
    let mut i = 0;
    while i < 6 {
        l[2 + i] = rest[i];
        i += 1;
    }
    l
};

/// Input for GPU-native Pearl PoUW mining (no CPU data prep needed).
pub struct PearlPouwNativeInput<'a> {
    pub nonce: u64,
    pub m: usize,
    pub n: usize,
    pub k: usize,
    pub rank: usize,
    pub job_key: [u8; 32],
    /// Big-endian U256 target (byte 0 = MSB); kernel reverses the LE jackpot
    /// hash for the comparison — same convention as the gateway `target` field.
    pub target: [u8; 32],
    pub row_offsets: &'a [u32],
    pub col_offsets: &'a [u32],
    pub rows_base: &'a [u32],
    pub cols_base: &'a [u32],
    /// Pass [`PEARL_SEED_LABEL_A`]/[`PEARL_SEED_LABEL_B`] — upstream
    /// `padded_seed_label` constants, embedded in `get_random_hash` messages.
    pub seed_label_a: [u8; 32],
    pub seed_label_b: [u8; 32],
    /// cert_version ≥3 requires [`PearlSeedDerivation::Salted`].
    pub seed_derivation: PearlSeedDerivation,
}

/// Result of GPU-native Pearl PoUW mining (includes matrices for Merkle proof).
pub struct PearlPouwNativeResult {
    pub tile_index: u32,
    pub jackpot_hash: [u8; 32],
    pub nonce: u64,
    pub matrix_a: Vec<i8>,
    pub matrix_bt: Vec<i8>,
}

// ============================================================================
// Keyed-BLAKE3 Merkle tree (pearl-blake3 MerkleTree port)
// ============================================================================

fn chunk_cv(data: &[u8], chunk_index: u64, key: &[u8; 32]) -> [u8; 32] {
    use blake3::hazmat::HasherExt;
    debug_assert!(data.len() <= CHUNK_LEN);
    // `hash_chunks` semantics: every chunk compressed with counter = its
    // chunk index (non-root CV), zero-padded tail.
    let mut block = [0u8; CHUNK_LEN];
    block[..data.len()].copy_from_slice(data);
    blake3::Hasher::new_keyed(key)
        .set_input_offset(chunk_index * CHUNK_LEN as u64)
        .update(&block)
        .finalize_non_root()
}

fn parent_cv(left: &[u8; 32], right: &[u8; 32], key: &[u8; 32]) -> [u8; 32] {
    blake3::hazmat::merge_subtrees_non_root(left, right, blake3::hazmat::Mode::KeyedHash(key))
}

fn root_cv(left: &[u8; 32], right: &[u8; 32], key: &[u8; 32]) -> [u8; 32] {
    *blake3::hazmat::merge_subtrees_root(left, right, blake3::hazmat::Mode::KeyedHash(key))
        .as_bytes()
}

/// Equivalent of `pearl_blake3::MerkleTree` — layered CV tree over a
/// chunk-padded byte blob, keyed by `job_key`.
pub struct PearlMerkleTree {
    layers: Vec<Vec<[u8; 32]>>,
    /// Chunk-padded matrix bytes (exactly `num_leaves * CHUNK_LEN`).
    data: Vec<u8>,
}

impl PearlMerkleTree {
    /// `data` must be exactly the flat matrix bytes (m*k or n*k); padding to
    /// the chunk boundary happens here (canonical `pad_to_chunk_boundary`).
    pub fn new(data: &[u8], key: &[u8; 32]) -> Self {
        let padded_len = data.len().div_ceil(CHUNK_LEN) * CHUNK_LEN;
        let mut padded = vec![0u8; padded_len];
        padded[..data.len()].copy_from_slice(data);
        let num_chunks = padded.len() / CHUNK_LEN;

        // Single chunk: canonical `MerkleTree::new` returns `hash(data)` — the
        // chunk CV *with* the ROOT flag, i.e. a plain keyed hash of the block.
        if num_chunks == 1 {
            let root = *blake3::keyed_hash(key, &padded).as_bytes();
            return Self {
                layers: vec![vec![root]],
                data: padded,
            };
        }

        let chunk_cvs: Vec<[u8; 32]> = (0..num_chunks)
            .map(|i| {
                let s = i * CHUNK_LEN;
                chunk_cv(&padded[s..s + CHUNK_LEN], i as u64, key)
            })
            .collect();
        let mut layers = vec![chunk_cvs];
        while layers.last().unwrap().len() > 2 {
            let prev = layers.last().unwrap();
            // combine_layer: pair-merge; odd tail propagates unchanged.
            let mut next = Vec::with_capacity(prev.len().div_ceil(2));
            for pair in prev.chunks(2) {
                next.push(if pair.len() == 2 {
                    parent_cv(&pair[0], &pair[1], key)
                } else {
                    pair[0]
                });
            }
            layers.push(next);
        }
        if layers.last().unwrap().len() == 2 {
            let last = layers.last().unwrap();
            layers.push(vec![root_cv(&last[0], &last[1], key)]);
        }
        Self {
            layers,
            data: padded,
        }
    }

    pub fn root(&self) -> [u8; 32] {
        self.layers.last().and_then(|l| l.first()).copied().unwrap_or([0; 32])
    }

    pub fn num_leaves(&self) -> usize {
        self.layers[0].len()
    }

    /// `get_multileaf_proof` — collects sibling CVs level-by-level in
    /// ascending index order (the order the verifier's `compute_root`
    /// consumes them).
    pub fn multileaf_proof(&self, leaf_indices: &[usize]) -> Result<PearlMerkleProof> {
        use std::collections::BTreeSet;
        ensure!(!leaf_indices.is_empty(), "leaf_indices empty");
        let unique: BTreeSet<usize> = leaf_indices.iter().copied().collect();
        let total_leaves = self.num_leaves();
        ensure!(
            *unique.iter().next_back().unwrap() < total_leaves,
            "leaf index out of bounds"
        );

        let sorted_indices: Vec<usize> = unique.iter().copied().collect();
        let leaf_data: Vec<[u8; CHUNK_LEN]> = sorted_indices
            .iter()
            .map(|&i| self.data[i * CHUNK_LEN..(i + 1) * CHUNK_LEN].try_into().unwrap())
            .collect();

        let mut siblings = Vec::new();
        let mut current_set = unique;
        let mut level_len = total_leaves;
        let mut level = 0usize;
        while level_len > 1 && !current_set.is_empty() {
            let level_nodes = &self.layers[level];
            for &i in &current_set {
                if i % 2 == 1 {
                    if !current_set.contains(&(i - 1)) {
                        siblings.push(level_nodes[i - 1]);
                    }
                } else if !current_set.contains(&(i + 1)) && i + 1 < level_len {
                    siblings.push(level_nodes[i + 1]);
                }
            }
            current_set = current_set.iter().map(|&i| i / 2).collect();
            level_len = level_len.div_ceil(2);
            level += 1;
        }

        Ok(PearlMerkleProof {
            leaf_data,
            leaf_indices: sorted_indices,
            total_leaves,
            root: self.root(),
            siblings,
        })
    }
}

/// `compute_leaf_indices_from_rows` — every chunk spanned by each row
/// (`row*cols .. (row+1)*cols - 1`), deduped + sorted.
pub fn leaf_indices_from_rows(row_indices: &[usize], cols_per_row: usize) -> Vec<usize> {
    use std::collections::BTreeSet;
    let mut set = BTreeSet::new();
    for &row in row_indices {
        let first = (row * cols_per_row) / CHUNK_LEN;
        let last = ((row + 1) * cols_per_row - 1) / CHUNK_LEN;
        for i in first..=last {
            set.insert(i);
        }
    }
    set.into_iter().collect()
}

#[derive(Debug, Clone)]
pub struct PearlMerkleProof {
    pub leaf_data: Vec<[u8; CHUNK_LEN]>,
    pub leaf_indices: Vec<usize>,
    pub total_leaves: usize,
    pub root: [u8; 32],
    pub siblings: Vec<[u8; 32]>,
}

#[derive(Debug, Clone)]
pub struct PearlMatrixProof {
    pub proof: PearlMerkleProof,
    pub row_indices: Vec<usize>,
}

// ============================================================================
// PlainProof bincode encoding (fixint LE — `bincode::serialize` legacy format)
// ============================================================================

fn w_usize(out: &mut Vec<u8>, v: usize) {
    out.extend_from_slice(&(v as u64).to_le_bytes());
}
fn w_vec_usize(out: &mut Vec<u8>, v: &[usize]) {
    w_usize(out, v.len());
    for &x in v {
        w_usize(out, x);
    }
}
fn w_merkle(out: &mut Vec<u8>, p: &PearlMerkleProof) {
    w_usize(out, p.leaf_data.len());
    for chunk in &p.leaf_data {
        w_usize(out, chunk.len());
        out.extend_from_slice(chunk);
    }
    w_vec_usize(out, &p.leaf_indices);
    w_usize(out, p.total_leaves);
    out.extend_from_slice(&p.root);
    w_usize(out, p.siblings.len());
    for s in &p.siblings {
        out.extend_from_slice(s);
    }
}
fn w_matrix(out: &mut Vec<u8>, mp: &PearlMatrixProof) {
    w_merkle(out, &mp.proof);
    w_vec_usize(out, &mp.row_indices);
}

/// `bincode::serialize(&PlainProof)` byte layout — dense (moe = None → 0x00).
pub fn encode_plain_proof(
    m: usize,
    n: usize,
    k: usize,
    noise_rank: usize,
    a: &PearlMatrixProof,
    bt: &PearlMatrixProof,
) -> Vec<u8> {
    let mut out = Vec::with_capacity(64 + a.proof.leaf_data.len() * 1040);
    w_usize(&mut out, m);
    w_usize(&mut out, n);
    w_usize(&mut out, k);
    w_usize(&mut out, noise_rank);
    w_matrix(&mut out, a);
    w_matrix(&mut out, bt);
    out.push(0u8); // moe: Option::None
    out
}

// ============================================================================
// Winning-tile → proof assembly
// ============================================================================

/// Kernel tile enumeration: `tile_id = row_off_idx * num_col_offsets +
/// col_off_idx`; tile rows = `row_offsets[row_off_idx] + rows_base[i]`.
pub fn tile_row_col_indices(
    tile_index: u32,
    row_offsets: &[u32],
    col_offsets: &[u32],
    rows_base: &[u32],
    cols_base: &[u32],
) -> Result<(Vec<usize>, Vec<usize>)> {
    let nco = col_offsets.len();
    let roi = tile_index as usize / nco;
    let coi = tile_index as usize % nco;
    ensure!(roi < row_offsets.len(), "tile index out of range");
    let row_off = row_offsets[roi];
    let col_off = col_offsets[coi];
    let rows: Vec<usize> = rows_base.iter().map(|&b| (row_off + b) as usize).collect();
    let cols: Vec<usize> = cols_base.iter().map(|&b| (col_off + b) as usize).collect();
    Ok((rows, cols))
}

/// Build a wire-ready dense `PlainProof` from a winning mining result.
/// `matrix_a`/`matrix_bt` are the flat row-major i8 matrices (len m*k / n*k)
/// read back from the GPU.
pub fn build_plain_proof(
    cfg: &PearlMineConfig,
    job_key: &[u8; 32],
    matrix_a: &[i8],
    matrix_bt: &[i8],
    tile_index: u32,
    row_offsets: &[u32],
    col_offsets: &[u32],
) -> Result<Vec<u8>> {
    let (a_rows, b_cols) = tile_row_col_indices(
        tile_index,
        row_offsets,
        col_offsets,
        &cfg.rows_base(),
        &cfg.cols_base(),
    )?;
    let a_bytes: Vec<u8> = matrix_a.iter().map(|&x| x as u8).collect();
    let b_bytes: Vec<u8> = matrix_bt.iter().map(|&x| x as u8).collect();
    let tree_a = PearlMerkleTree::new(&a_bytes, job_key);
    let tree_b = PearlMerkleTree::new(&b_bytes, job_key);
    let a_proof = PearlMatrixProof {
        proof: tree_a.multileaf_proof(&leaf_indices_from_rows(&a_rows, cfg.k))?,
        row_indices: a_rows,
    };
    let bt_proof = PearlMatrixProof {
        proof: tree_b.multileaf_proof(&leaf_indices_from_rows(&b_cols, cfg.k))?,
        row_indices: b_cols,
    };
    Ok(encode_plain_proof(cfg.m, cfg.n, cfg.k, cfg.rank, &a_proof, &bt_proof))
}

// ============================================================================
// mining_job echo (advisory — the pool forwards its own stored job)
// ============================================================================

/// Assemble the `mining_job` object miners echo inside `PearlSubmit`
/// (`{"incomplete_header_bytes","target","cert_version"}`). The pool's
/// verifier is server-authoritative and ignores this field; it is sent for
/// forward compatibility with any gateway that cross-checks it.
pub fn mining_job_json(header: &[u8; 76], target_dec: &str, cert_version: u32) -> String {
    use base64::Engine as _;
    format!(
        "{{\"incomplete_header_bytes\":\"{}\",\"target\":{},\"cert_version\":{}}}",
        base64::engine::general_purpose::STANDARD.encode(header),
        target_dec,
        cert_version
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pattern_roundtrips_and_offsets() {
        let rows = PeriodicPattern::from_list(&[0, 8, 64, 72]).unwrap();
        assert_eq!(rows.size(), 4);
        assert_eq!(rows.to_bytes(), [7, 1, 3, 1, 0, 0]);
        assert_eq!(rows.to_list(), vec![0, 8, 64, 72]);
        assert!(rows.offset_is_valid(0));
        assert!(rows.offset_is_valid(16));
        assert!(!rows.offset_is_valid(8)); // folds into (8,2) as >=8
        assert!(!rows.offset_is_valid(64)); // folds into (64,2) as >=64
        assert!(!rows.offset_is_valid(120)); // 120%128=120>=64

        let cols = PeriodicPattern::from_list(&[0, 1, 8, 9, 64, 65, 72, 73]).unwrap();
        assert_eq!(cols.size(), 8);
        assert_eq!(cols.to_bytes(), [0, 1, 3, 1, 3, 1]);
        assert!(cols.offset_is_valid(0));
        assert!(!cols.offset_is_valid(1)); // innermost (1,2): offset%2 must be 0
        assert!(cols.offset_is_valid(2));
    }

    #[test]
    fn tile_counts_match_upstream_partition() {
        // Default patterns expand to the full periodic partition:
        // upstream threads_partition yields 256 row-groups × 128 col-groups.
        let cfg = PearlMineConfig::from_env().unwrap();
        assert_eq!(cfg.row_offsets().len(), 256);
        assert_eq!(cfg.col_offsets().len(), 128);
    }

    #[test]
    fn default_config_is_valid() {
        let cfg = PearlMineConfig::from_env().unwrap();
        assert_eq!(cfg.m, 1024);
        assert!(!cfg.row_offsets().is_empty());
        assert!(!cfg.col_offsets().is_empty());
        // Every tile's max index stays in-bounds.
        let max_row = *cfg.row_offsets().last().unwrap() + 72;
        assert!((max_row as usize) < cfg.m);
        let max_col = *cfg.col_offsets().last().unwrap() + 73;
        assert!((max_col as usize) < cfg.n);
    }

    #[test]
    fn merkle_root_matches_keyed_blake3() {
        // Single chunk: tree root = keyed hash of the padded blob.
        let key = [7u8; 32];
        let data = vec![0xABu8; 100];
        let tree = PearlMerkleTree::new(&data, &key);
        let mut padded = [0u8; CHUNK_LEN];
        padded[..100].copy_from_slice(&data);
        let expect = *blake3::keyed_hash(&key, &padded).as_bytes();
        assert_eq!(tree.root(), expect);

        // Multi-chunk: root must equal the tree built from chunk CVs.
        let data = vec![0x5Au8; CHUNK_LEN * 3 + 7];
        let tree = PearlMerkleTree::new(&data, &key);
        assert_eq!(tree.num_leaves(), 4);
    }

    #[test]
    fn multileaf_proof_shape() {
        let key = [9u8; 32];
        let data: Vec<u8> = (0..CHUNK_LEN * 8).map(|i| (i % 256) as u8).collect();
        let tree = PearlMerkleTree::new(&data, &key);
        let p = tree.multileaf_proof(&[1, 2, 6]).unwrap();
        assert_eq!(p.leaf_indices, vec![1, 2, 6]);
        assert_eq!(p.leaf_data.len(), 3);
        assert_eq!(p.total_leaves, 8);
        assert_eq!(p.root, tree.root());
        assert!(!p.siblings.is_empty());
    }

    #[test]
    fn proof_encoding_layout() {
        // Hand-rolled layout check: usize fields are u64 LE, leaf data carries
        // u64 length prefixes, the moe tag terminates the blob.
        let a = PearlMatrixProof {
            proof: PearlMerkleProof {
                leaf_data: vec![[0x11; CHUNK_LEN]],
                leaf_indices: vec![3],
                total_leaves: 5,
                root: [0x22; 32],
                siblings: vec![[0x33; 32]],
            },
            row_indices: vec![1, 2],
        };
        let bytes = encode_plain_proof(10, 20, 30, 128, &a, &a);
        let mut off = 0;
        let rd = |b: &[u8], o: &mut usize| -> u64 {
            let v = u64::from_le_bytes(b[*o..*o + 8].try_into().unwrap());
            *o += 8;
            v
        };
        assert_eq!(rd(&bytes, &mut off), 10); // m
        assert_eq!(rd(&bytes, &mut off), 20); // n
        assert_eq!(rd(&bytes, &mut off), 30); // k
        assert_eq!(rd(&bytes, &mut off), 128); // rank
        assert_eq!(rd(&bytes, &mut off), 1); // leaf_data len
        assert_eq!(rd(&bytes, &mut off), CHUNK_LEN as u64); // chunk len
        off += CHUNK_LEN;
        assert_eq!(rd(&bytes, &mut off), 1); // leaf_indices len
        assert_eq!(rd(&bytes, &mut off), 3);
        assert_eq!(rd(&bytes, &mut off), 5); // total_leaves
        assert_eq!(&bytes[off..off + 32], &[0x22; 32]);
        off += 32;
        assert_eq!(rd(&bytes, &mut off), 1); // siblings len
        assert_eq!(&bytes[off..off + 32], &[0x33; 32]);
        off += 32;
        assert_eq!(rd(&bytes, &mut off), 2); // row_indices len
        assert_eq!(rd(&bytes, &mut off), 1);
        assert_eq!(rd(&bytes, &mut off), 2);
        // bt proof (same) + moe tag
        assert_eq!(bytes[bytes.len() - 1], 0);
    }

    #[test]
    fn tile_index_decodes_kernel_layout() {
        let row_offsets = vec![0u32, 16, 32];
        let col_offsets = vec![0u32, 8];
        let rows_base = vec![0u32, 8, 64, 72];
        let cols_base = vec![0u32, 1];
        // tile_id = roi * nco + coi → tile 3 = roi1,coi1
        let (rows, cols) =
            tile_row_col_indices(3, &row_offsets, &col_offsets, &rows_base, &cols_base).unwrap();
        assert_eq!(rows, vec![16, 24, 80, 88]);
        assert_eq!(cols, vec![8, 9]);
    }

    #[test]
    fn leaf_indices_cover_full_rows() {
        // k=1024: row r covers chunk r exactly; two adjacent rows → 2 chunks.
        assert_eq!(leaf_indices_from_rows(&[5], 1024), vec![5]);
        assert_eq!(leaf_indices_from_rows(&[0, 2], 1024), vec![0, 2]);
        // k=500: row 0 spans chunk 0 (bytes 0..500), row 3 = 1500..2000 → chunks 0,1,2 wait:
        // 1500..1999 → 1500/1024=1, 1999/1024=1 → chunk 1 only? 1500..1999 in chunk 1 (1024..2048). yes chunk 1.
        assert_eq!(leaf_indices_from_rows(&[3], 500), vec![1]);
        // row 2 = 1000..1499 → chunks 0 and 1.
        assert_eq!(leaf_indices_from_rows(&[2], 500), vec![0, 1]);
    }
}

// ─── Pearl PoUW KAT — CPU reference vs canonical vectors ──────────────────
// Cross-implementation tests against upstream zk-pow semantics. The CPU
// reference below mirrors `zk-pow` (pearl_noise.rs, api/seed.rs, ffi/mine.rs)
// and `pearl-blake3::MerkleTree` — which is byte-identical to standard keyed
// BLAKE3 because keyed hashing IS that tree (chunk CVs counter=idx +
// keyed parent merges + root). See PEARL-POUW-INTEGRATION.md.
// Helpers are pub(crate) so the OpenCL (`gpu_opencl_full`) and CUDA
// (`gpu/pearl_cuda`) on-device parity tests share one reference — duplicating
// consensus code is how the 0x44/0x48 salt typo class of bugs happens.
#[cfg(test)]
pub(crate) mod pearl_kat {
    use super::*;

    /// `blake3_digest(msg, key)` — unkeyed when None, keyed otherwise.
    pub(crate) fn digest_ref(msg: &[u8], key: Option<[u8; 32]>) -> [u8; 32] {
        match key {
            Some(k) => *blake3::keyed_hash(&k, msg).as_bytes(),
            None => *blake3::hash(msg).as_bytes(),
        }
    }

    /// `MerkleTree::new(pad_to_chunk_boundary(data), key).root()` — identical
    /// to `blake3::keyed_hash` of the zero-padded data (same BLAKE3 tree).
    pub(crate) fn merkle_root_ref(data: &[u8], key: &[u8; 32]) -> [u8; 32] {
        let mut padded = data.to_vec();
        padded.resize(data.len().div_ceil(1024) * 1024, 0);
        *blake3::keyed_hash(key, &padded).as_bytes()
    }

    fn bind_root_a_ref(root: &[u8; 32], m: u32) -> [u8; 32] {
        let mut msg = [0u8; 64];
        msg[..32].copy_from_slice(root);
        msg[32..36].copy_from_slice(&m.to_le_bytes());
        digest_ref(&msg, Some(PEARL_SEED_SALT_A))
    }

    fn bind_root_b_ref(root: &[u8; 32], n: u32) -> [u8; 32] {
        let mut msg = [0u8; 64];
        msg[..32].copy_from_slice(root);
        msg[32..36].copy_from_slice(&n.to_le_bytes());
        digest_ref(&msg, Some(PEARL_SEED_SALT_B))
    }

    /// `PublicProofParams::commitment_hash(job_key)` → (b_noise_seed, a_noise_seed).
    pub(crate) fn commitment_hash_ref(
        job_key: &[u8; 32],
        hash_a: &[u8; 32],
        hash_b: &[u8; 32],
        m: u32,
        n: u32,
        salted: bool,
    ) -> ([u8; 32], [u8; 32]) {
        let (ha, hb) = if salted {
            (bind_root_a_ref(hash_a, m), bind_root_b_ref(hash_b, n))
        } else {
            (*hash_a, *hash_b)
        };
        let mut msg = [0u8; 64];
        msg[..32].copy_from_slice(job_key);
        msg[32..].copy_from_slice(&hb);
        let b_seed = digest_ref(&msg, None);
        msg[..32].copy_from_slice(&b_seed);
        msg[32..].copy_from_slice(&ha);
        (b_seed, digest_ref(&msg, None))
    }

    /// `get_random_hash(index, seed, key, prepend_index)` — label in the
    /// message body, key = noise seed (see kernel arg order fix).
    pub(crate) fn get_random_hash_ref(
        index: usize,
        seed: &[u8; 32],
        key: &[u8; 32],
        prepend_index: usize,
    ) -> [u8; 32] {
        let mut msg = [0u8; 64];
        let pv = (1 + index) as i32;
        msg[prepend_index * 4..prepend_index * 4 + 4].copy_from_slice(&pv.to_le_bytes());
        msg[32..].copy_from_slice(seed);
        digest_ref(&msg, Some(*key))
    }

    /// Uniform noise element at flat row-major index `idx` over `num_cols`
    /// (canonical `generate_uniform_random_matrix` start_idx scheme).
    fn uniform_at(start_idx: usize, seed: &[u8; 32], key: &[u8; 32]) -> i8 {
        let block = start_idx / 32;
        let byte = start_idx % 32;
        let h = get_random_hash_ref(block, seed, key, 0);
        ((h[byte] & 63) as i8).wrapping_sub(32)
    }

    /// Permutation pair for sparse row `l` (canonical `generate_permutation_matrix`).
    fn perm_pair(l: usize, rank: usize, seed: &[u8; 32], key: &[u8; 32]) -> (u32, u32) {
        let h = get_random_hash_ref(l / 8, seed, key, 1);
        let u = u32::from_le_bytes([
            h[(l % 8) * 4],
            h[(l % 8) * 4 + 1],
            h[(l % 8) * 4 + 2],
            h[(l % 8) * 4 + 3],
        ]);
        let mask = (rank - 1) as u32;
        let first = u & mask;
        let second = first ^ (1u32 + ((((rank as u64 - 1) * u as u64) >> 32) as u32));
        (first, second)
    }

    /// Kernel `pcg32` mirror.
    fn pcg32_ref(state: u64) -> u32 {
        let xorshifted = (((state >> 18) ^ state) as u32) >> 27;
        let rot = (state >> 59) as u32;
        xorshifted.rotate_right(rot)
    }

    /// Kernel `gen_int7` mirror → i8 in [-64, 64].
    pub(crate) fn gen_int7_ref(nonce: u64, index: u32) -> i8 {
        let mut st = (nonce ^ ((index as u64) << 32))
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        st = st
            .wrapping_mul(6364136223846793005)
            .wrapping_add(nonce << 16)
            .wrapping_add(index as u64);
        ((pcg32_ref(st) % 129) as i32 - 64) as i8
    }

    /// Full pipeline reference for one output tile's jackpot hash — mirrors
    /// `pearl_pouw_mine_native` (TILE_H=4 × TILE_W=8 tile at (row_off, col_off)).
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn tile_jackpot_ref(
        nonce: u64,
        m: usize,
        n: usize,
        k: usize,
        rank: usize,
        job_key: &[u8; 32],
        row_off: u32,
        col_off: u32,
        rows_base: &[u32],
        cols_base: &[u32],
        salted: bool,
    ) -> [u8; 32] {
        // 1. Matrices (kernel gen scheme)
        let a: Vec<i8> = (0..m * k).map(|i| gen_int7_ref(nonce, i as u32)).collect();
        let bt: Vec<i8> = (0..n * k)
            .map(|i| gen_int7_ref(nonce.wrapping_add(1), i as u32))
            .collect();

        // 2-3. Keyed merkle roots on zero-padded byte layouts (i8 → raw byte)
        let a_bytes: Vec<u8> = a.iter().map(|&x| x as u8).collect();
        let bt_bytes: Vec<u8> = bt.iter().map(|&x| x as u8).collect();
        let hash_a = merkle_root_ref(&a_bytes, job_key);
        let hash_b = merkle_root_ref(&bt_bytes, job_key);

        // 4. Seed chain (+V3 salted bind)
        let (b_seed, a_seed) = commitment_hash_ref(
            job_key,
            &hash_a,
            &hash_b,
            m as u32,
            n as u32,
            salted,
        );

        // 5-6. Noise for the needed rows/cols → noised matrices (i32 accum)
        let mut a2 = vec![0i32; m * k];
        let mut b2 = vec![0i32; n * k];
        for i in 0..m {
            for l in 0..k {
                let e = |c: usize| uniform_at(i * rank + c, &PEARL_SEED_LABEL_A, &a_seed);
                let (f, s) = perm_pair(l, rank, &PEARL_SEED_LABEL_A, &a_seed);
                let noise = e(f as usize) as i32 - e(s as usize) as i32;
                a2[i * k + l] = a[i * k + l] as i32 + noise;
            }
        }
        for j in 0..n {
            for l in 0..k {
                let e = |c: usize| uniform_at(j * rank + c, &PEARL_SEED_LABEL_B, &b_seed);
                let (f, s) = perm_pair(l, rank, &PEARL_SEED_LABEL_B, &b_seed);
                let noise = e(f as usize) as i32 - e(s as usize) as i32;
                b2[j * k + l] = bt[j * k + l] as i32 + noise;
            }
        }

        // 7. Tile accumulation + jackpot transcript (LROT=13, 16 slots)
        let mut jackpot = [0u32; 16];
        let mut tile = [0i32; 32];
        let mut ll = rank;
        while ll <= k {
            for u in 0..4usize {
                let ar = (row_off + rows_base[u]) as usize;
                for v in 0..8usize {
                    let bc = (col_off + cols_base[v]) as usize;
                    let mut acc = 0i32;
                    for l in (ll - rank)..ll {
                        acc += a2[ar * k + l] * b2[bc * k + l];
                    }
                    tile[u * 8 + v] += acc;
                }
            }
            let xored = tile.iter().fold(0u32, |acc, &x| acc ^ x as u32);
            let tid = (ll / rank - 1) % 16;
            jackpot[tid] = jackpot[tid].rotate_left(13) ^ xored;
            ll += rank;
        }

        // 8. Keyed jackpot hash
        let mut msg = [0u8; 64];
        for (i, w) in jackpot.iter().enumerate() {
            msg[i * 4..i * 4 + 4].copy_from_slice(&w.to_le_bytes());
        }
        digest_ref(&msg, Some(a_seed))
    }

    // ── Pinned-vector tests (run everywhere, no GPU needed) ────────────

    #[test]
    fn pearl_seed_salts_match_context_strings() {
        // Upstream api/seed.rs test: salts are blake3 of domain strings.
        assert_eq!(
            PEARL_SEED_SALT_A,
            *blake3::hash(b"pearl/cert-v3/noise-seed/A").as_bytes()
        );
        assert_eq!(
            PEARL_SEED_SALT_B,
            *blake3::hash(b"pearl/cert-v3/noise-seed/B").as_bytes()
        );
    }

    #[test]
    fn pearl_seed_labels_are_padded() {
        let mut a = [0u8; 32];
        a[..8].copy_from_slice(b"A_tensor");
        let mut b = [0u8; 32];
        b[..8].copy_from_slice(b"B_tensor");
        assert_eq!(PEARL_SEED_LABEL_A, a);
        assert_eq!(PEARL_SEED_LABEL_B, b);
    }

    #[test]
    fn pearl_merkle_root_is_keyed_blake3() {
        // Invariant backing the GPU comparison: the canonical keyed Merkle
        // tree's root equals blake3::keyed_hash(key, padded_data) — including
        // non-power-of-two chunk counts and single-chunk trees.
        let key = [0x42u8; 32];
        for len in [1usize, 512, 1023, 1024, 1025, 2048, 3071, 3072, 3073, 5120] {
            let data: Vec<u8> = (0..len).map(|i| (i * 7 + 3) as u8).collect();
            let mut padded = data.clone();
            padded.resize(len.div_ceil(1024) * 1024, 0);
            // Reference = keyed hash of the padded layout (what the GPU must produce).
            let expected = *blake3::keyed_hash(&key, &padded).as_bytes();
            assert_eq!(merkle_root_ref(&data, &key), expected, "len {len}");
        }
    }

    #[test]
    fn pearl_get_random_hash_layout() {
        // Layout: (1+index) as i32-LE at 4*prepend_index, seed at bytes 32..64,
        // keyed by `key`. Guards against a future seed/key swap regression.
        let seed = [0x5Au8; 32];
        let key = [0xA5u8; 32];
        let mut msg = [0u8; 64];
        msg[4..8].copy_from_slice(&(6i32.to_le_bytes())); // prepend slot 1, index 5
        msg[32..].copy_from_slice(&seed);
        let expected = *blake3::keyed_hash(&key, &msg).as_bytes();
        assert_eq!(get_random_hash_ref(5, &seed, &key, 1), expected);
    }

    #[test]
    fn pearl_commitment_hash_upstream_pinned() {
        // Pinned vectors from upstream zk-pow api/seed.rs
        // (commitment_hash_pinned_vectors) — consensus break detector.
        let job_key = [0x11u8; 32];
        let hash_a = [0xAAu8; 32];
        let hash_b = [0xBBu8; 32];
        let (m, n) = (192u32, 320u32);

        let (b_legacy, a_legacy) =
            commitment_hash_ref(&job_key, &hash_a, &hash_b, m, n, false);
        assert_eq!(
            b_legacy,
            [
                0xad, 0xd6, 0xf7, 0xea, 0x5f, 0xee, 0xbf, 0x89, 0xc8, 0xa7, 0x7e, 0x2e, 0xbf,
                0xa0, 0xd8, 0x24, 0x42, 0xe7, 0xdb, 0xb0, 0x04, 0x6d, 0xbd, 0x48, 0x97, 0x18,
                0x61, 0xd1, 0x2f, 0xcb, 0x01, 0x77
            ]
        );
        assert_eq!(
            a_legacy,
            [
                0x48, 0x3b, 0x07, 0xb6, 0xf7, 0x31, 0x05, 0x03, 0x0b, 0x94, 0x82, 0x25, 0x5f,
                0x37, 0x72, 0x3f, 0x3f, 0xed, 0x69, 0xae, 0x91, 0x67, 0x24, 0xee, 0x82, 0x91,
                0x84, 0x8b, 0x8c, 0x28, 0x79, 0x4b
            ]
        );

        let (b_salted, a_salted) = commitment_hash_ref(&job_key, &hash_a, &hash_b, m, n, true);
        assert_eq!(
            b_salted,
            [
                0x60, 0xed, 0x9b, 0x73, 0xc5, 0xa9, 0x59, 0x9b, 0x20, 0x0b, 0x6c, 0xd5, 0x63,
                0xe7, 0xf0, 0xd5, 0xd9, 0xa6, 0x7d, 0x24, 0x02, 0xd8, 0x5f, 0xd4, 0xef, 0x96,
                0x6c, 0x58, 0x00, 0x80, 0xd0, 0xe5
            ]
        );
        assert_eq!(
            a_salted,
            [
                0x30, 0x17, 0x84, 0x16, 0x80, 0x05, 0xec, 0x83, 0x3a, 0xb0, 0xaa, 0x60, 0x00,
                0x6f, 0x7f, 0xe7, 0xfa, 0xaa, 0x95, 0x30, 0x7d, 0x8c, 0x1f, 0xc6, 0x81, 0x9b,
                0x2f, 0xfd, 0xd7, 0x17, 0xec, 0xcf
            ]
        );
    }
}
