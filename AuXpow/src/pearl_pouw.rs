//! Pearl PoUW (Proof-of-Useful-Work) kernel — CPU reference implementation.
//!
//! Implements the full Pearl mining algorithm:
//!   1. Generate random matrices A (m×k) and B (k×n) with int7 entries [-64, 64]
//!   2. Compute BLAKE3 commitment hash → noise seeds
//!   3. Generate low-rank noise matrices (EL·ER for A, FL·FR for B)
//!   4. Add noise: A' = A + E, B' = B + F
//!   5. Tiled MatMul with jackpot hash accumulation
//!   6. Check jackpot hash ≤ difficulty target
//!   7. Build Merkle proofs for sampled matrix rows
//!   8. Serialize PlainProof via bincode → base64
//!
//! Source: pearl/zk-pow/src/ffi/mine.rs (try_mine_one)
//!         pearl/zk-pow/src/circuit/pearl_noise.rs (compute_noise_for_indices)
//!         pearl-blake3/src/merkle.rs (MerkleTree)
//!         pearl/zk-pow/src/api/proof_utils.rs (compute_jackpot_hash)

use blake3::OUT_LEN as BLAKE3_DIGEST_SIZE;
use blake3::CHUNK_LEN as BLAKE3_CHUNK_LEN;

// ─── Constants ──────────────────────────────────────────────────────────────

pub const JACKPOT_SIZE: usize = 16;
pub const LROT_PER_TILE: u32 = 13;
pub const SIGNAL_MIN: i8 = -64;
pub const SIGNAL_MAX: i8 = 64;

const NOISE_RANGE: usize = 128;
const IDXS_PER_COL: usize = 2;
const UNIFORM_NOISE_RANGE: usize = NOISE_RANGE / IDXS_PER_COL; // 64
const ZERO_POINT_TRANSLATION: i8 = (UNIFORM_NOISE_RANGE / 2) as i8; // 32
const RANGE_MASK: u8 = (UNIFORM_NOISE_RANGE - 1) as u8; // 63

const fn padded_seed_label(label: &[u8; 8]) -> [u8; 32] {
    let mut result = [0u8; 32];
    let mut i = 0;
    while i < 8 {
        result[i] = label[i];
        i += 1;
    }
    result
}
const SEED_LABEL_A: [u8; 32] = padded_seed_label(b"A_tensor");
const SEED_LABEL_B: [u8; 32] = padded_seed_label(b"B_tensor");

// ─── BLAKE3 helpers ─────────────────────────────────────────────────────────

/// BLAKE3 keyed hash (keyed_hash mode).
pub fn blake3_digest(data: &[u8], key: Option<&[u8; 32]>) -> [u8; 32] {
    let hash = match key {
        Some(k) => blake3::keyed_hash(k, data),
        None => blake3::hash(data),
    };
    let bytes: &[u8; 32] = hash.as_bytes();
    *bytes
}

/// Zero-pad data to a multiple of BLAKE3_CHUNK_LEN (1024 bytes).
pub fn pad_to_chunk_boundary(data: &[u8]) -> Vec<u8> {
    let padded_len = data.len().div_ceil(BLAKE3_CHUNK_LEN) * BLAKE3_CHUNK_LEN;
    let mut padded = data.to_vec();
    padded.resize(padded_len, 0);
    padded
}

// ─── Merkle Tree (BLAKE3) ───────────────────────────────────────────────────

use blake3::hazmat::{merge_subtrees_non_root, merge_subtrees_root, HasherExt, Mode};

/// BLAKE3 Merkle tree with multi-leaf proof generation.
/// Mirrors pearl-blake3/src/merkle.rs using blake3::hazmat API.
pub struct MerkleTree {
    key: [u8; 32],
    layers: Vec<Vec<[u8; 32]>>,
    data: Vec<u8>,
}

impl MerkleTree {
    pub fn key(&self) -> &[u8; 32] { &self.key }

    fn mode(&self) -> Mode<'_> {
        Mode::KeyedHash(&self.key)
    }

    /// Compute chunk CV (non-root) using blake3::hazmat.
    fn chunk_cv(&self, data: &[u8], chunk_index: u64) -> [u8; 32] {
        let mut hasher = blake3::Hasher::new_keyed(&self.key);
        hasher.set_input_offset(chunk_index * BLAKE3_CHUNK_LEN as u64);
        hasher.update(data);
        hasher.finalize_non_root()
    }

    /// Combine two child CVs into parent CV (non-root).
    fn parent_cv(&self, left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
        merge_subtrees_non_root(left, right, self.mode())
    }

    pub fn new(data: &[u8], key: [u8; 32]) -> Self {
        if data.is_empty() {
            return Self { key, layers: vec![vec![]], data: vec![] };
        }

        // Single chunk or less: hash directly (with ROOT flag)
        if data.len() <= BLAKE3_CHUNK_LEN {
            let root = *blake3::keyed_hash(&key, data).as_bytes();
            return Self { key, layers: vec![vec![root]], data: data.to_vec() };
        }

        // Multi-chunk: hash each chunk using hazmat chunk_cv (non-root)
        let chunk_cvs: Vec<[u8; 32]> = data
            .chunks(BLAKE3_CHUNK_LEN)
            .enumerate()
            .map(|(i, chunk)| {
                let mut hasher = blake3::Hasher::new_keyed(&key);
                hasher.set_input_offset(i as u64 * BLAKE3_CHUNK_LEN as u64);
                hasher.update(chunk);
                hasher.finalize_non_root()
            })
            .collect();

        let mut layers: Vec<Vec<[u8; 32]>> = vec![chunk_cvs];

        // Build tree: combine pairs using hazmat merge_subtrees_non_root
        while layers.last().unwrap().len() > 2 {
            let prev = layers.last().unwrap();
            let mode = Mode::KeyedHash(&key);
            let next: Vec<[u8; 32]> = prev
                .chunks(2)
                .map(|pair| {
                    if pair.len() == 2 {
                        merge_subtrees_non_root(&pair[0], &pair[1], mode)
                    } else {
                        pair[0]
                    }
                })
                .collect();
            layers.push(next);
        }

        // Root: if exactly 2, combine with merge_subtrees_root
        let last = layers.last().unwrap();
        if last.len() == 2 {
            let mode = Mode::KeyedHash(&key);
            let root = *merge_subtrees_root(&last[0], &last[1], mode).as_bytes();
            layers.push(vec![root]);
        }

        Self { key, layers, data: data.to_vec() }
    }

    pub fn root(&self) -> [u8; 32] {
        if self.layers.is_empty() || self.layers.last().unwrap().is_empty() {
            return [0u8; 32];
        }
        self.layers.last().unwrap()[0]
    }

    pub fn num_leaves(&self) -> usize {
        self.layers[0].len()
    }

    /// Generate a multi-leaf proof.
    pub fn get_multileaf_proof(&self, leaf_indices: &[usize]) -> MerkleProof {
        assert!(!leaf_indices.is_empty(), "leaf_indices must be non-empty");

        let unique: std::collections::BTreeSet<usize> = leaf_indices.iter().copied().collect();
        let total_leaves = self.num_leaves();
        assert!(*unique.last().unwrap() < total_leaves, "leaf index out of bounds");

        let sorted_indices: Vec<usize> = unique.iter().copied().collect();
        let leaf_data: Vec<Blake3Chunk> = sorted_indices
            .iter()
            .map(|&i| {
                let start = i * BLAKE3_CHUNK_LEN;
                let end = (start + BLAKE3_CHUNK_LEN).min(self.data.len());
                let mut chunk = [0u8; BLAKE3_CHUNK_LEN];
                chunk[..end - start].copy_from_slice(&self.data[start..end]);
                Blake3Chunk(chunk)
            })
            .collect();

        // Walk tree to collect sibling hashes
        let mut siblings: Vec<[u8; 32]> = Vec::new();
        let mut current_set = unique;
        let mut level_len = total_leaves;
        let mut level = 0;

        while level_len > 1 && !current_set.is_empty() {
            let level_nodes = &self.layers[level];
            for &i in &current_set {
                if i % 2 == 1 {
                    if !current_set.contains(&(i - 1)) {
                        siblings.push(level_nodes[i - 1]);
                    }
                } else if !current_set.contains(&(i + 1)) && (i + 1) < level_len {
                    siblings.push(level_nodes[i + 1]);
                }
            }
            current_set = current_set.iter().map(|&i| i / 2).collect();
            level_len = level_len.div_ceil(2);
            level += 1;
        }

        MerkleProof {
            leaf_data,
            leaf_indices: sorted_indices,
            total_leaves,
            root: self.root(),
            siblings,
        }
    }

    /// Compute which leaf indices are needed to prove the given matrix rows.
    pub fn compute_leaf_indices_from_rows(row_indices: &[usize], shape: (usize, usize)) -> Vec<usize> {
        let cols = shape.1;
        let mut indices = std::collections::BTreeSet::new();
        for &row in row_indices {
            let first = (row * cols) / BLAKE3_CHUNK_LEN;
            let last = ((row + 1) * cols - 1) / BLAKE3_CHUNK_LEN;
            for i in first..=last {
                indices.insert(i);
            }
        }
        indices.into_iter().collect()
    }
}

/// Merkle proof structure (matches pearl-blake3 MerkleProof for bincode).
#[derive(Clone, serde::Serialize)]
pub struct MerkleProof {
    pub leaf_data: Vec<Blake3Chunk>,
    pub leaf_indices: Vec<usize>,
    pub total_leaves: usize,
    pub root: [u8; BLAKE3_DIGEST_SIZE],
    pub siblings: Vec<[u8; BLAKE3_DIGEST_SIZE]>,
}

/// Wrapper for [u8; 1024] with manual Serialize matching pearl-blake3's serde_chunk_vec.
/// pearl-blake3 serializes Vec<[u8; 1024]> as Vec<&[u8]> (i.e. Vec<Vec<u8>> in bincode),
/// which means each chunk gets a u64 length prefix (1024) + 1024 bytes.
#[derive(Clone)]
pub struct Blake3Chunk(pub [u8; BLAKE3_CHUNK_LEN]);

impl serde::Serialize for Blake3Chunk {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        // Serialize as Vec<u8> (matches serde_chunk_vec: Vec<&[u8]>.serialize)
        self.0.as_slice().serialize(serializer)
    }
}

impl From<[u8; BLAKE3_CHUNK_LEN]> for Blake3Chunk {
    fn from(v: [u8; BLAKE3_CHUNK_LEN]) -> Self {
        Self(v)
    }
}

// ─── PeriodicPattern ────────────────────────────────────────────────────────

/// A periodic pattern of indices (generalized arithmetic progression).
/// Mirrors pearl/zk-pow/src/api/proof.rs PeriodicPattern.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
pub struct PeriodicPattern {
    pub shape: [(u32, u32); 3], // (stride, length) tuples
}

impl PeriodicPattern {
    pub const NUM_DIMS: usize = 3;

    /// Create from a sorted list of indices (must start at 0, be periodic).
    pub fn from_list(pattern: &[u32]) -> Self {
        assert!(!pattern.is_empty(), "Pattern cannot be empty");
        assert!(pattern[0] == 0, "Pattern must start at 0");
        assert!(pattern.windows(2).all(|w| w[0] < w[1]), "Pattern must be sorted");

        let mut p: Vec<u32> = pattern.to_vec();
        let mut shape_vec = Vec::new();

        while p.len() > 1 {
            let mut found = false;
            for period in 1..p.len() {
                if p.len() % period == 0 {
                    let s = p[period];
                    let is_periodic = (0..p.len() - period).all(|i| p[i] + s == p[i + period]);
                    if is_periodic {
                        shape_vec.push((s, (p.len() / period) as u32));
                        p.truncate(period);
                        found = true;
                        break;
                    }
                }
            }
            assert!(found, "Pattern is not periodic");
        }

        shape_vec.reverse();
        let period = shape_vec.last().map_or(1, |&(s, l)| s * l);
        while shape_vec.len() < Self::NUM_DIMS {
            shape_vec.push((period, 1));
        }
        Self { shape: shape_vec.try_into().unwrap() }
    }

    /// Convert pattern to a list of indices.
    pub fn to_list(&self) -> Vec<u32> {
        let mut res = vec![0u32];
        for &(stride, length) in &self.shape {
            let mut new_res = Vec::with_capacity(res.len() * length as usize);
            for i in 0..length {
                for &r in &res {
                    new_res.push(r + i * stride);
                }
            }
            res = new_res;
        }
        res
    }

    /// Check if an offset is valid for this pattern.
    pub fn offset_is_valid(&self, mut offset: u32) -> bool {
        for &(stride, length) in self.shape.iter().rev() {
            offset %= stride * length;
            if offset >= stride {
                return false;
            }
        }
        true
    }

    pub fn period(&self) -> u32 {
        let &(stride, length) = self.shape.last().unwrap();
        stride * length
    }

    pub fn size(&self) -> u32 {
        self.shape.iter().map(|&(_, length)| length).product()
    }

    pub fn max(&self) -> u32 {
        self.to_list().into_iter().max().unwrap()
    }

    /// Serialize to 6 bytes (2 per dim: factor-1, length-1).
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
}

// ─── IncompleteBlockHeader (76 bytes) ───────────────────────────────────────

/// Pearl block header (76 bytes, matches pearl/zk-pow/src/api/proof.rs).
#[derive(Clone, Copy, Debug)]
#[repr(C)]
pub struct IncompleteBlockHeader {
    pub version: u32,
    pub prev_block: [u8; 32],
    pub merkle_root: [u8; 32],
    pub timestamp: u32,
    pub nbits: u32,
}

impl IncompleteBlockHeader {
    /// Parse from 76 bytes (little-endian).
    pub fn from_bytes(data: &[u8]) -> Self {
        assert!(data.len() >= 76, "Header must be at least 76 bytes");
        Self {
            version: u32::from_le_bytes(data[0..4].try_into().unwrap()),
            prev_block: data[4..36].try_into().unwrap(),
            merkle_root: data[36..68].try_into().unwrap(),
            timestamp: u32::from_le_bytes(data[68..72].try_into().unwrap()),
            nbits: u32::from_le_bytes(data[72..76].try_into().unwrap()),
        }
    }

    /// Serialize to 76 bytes (little-endian).
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut data = Vec::with_capacity(76);
        data.extend_from_slice(&self.version.to_le_bytes());
        data.extend_from_slice(&self.prev_block);
        data.extend_from_slice(&self.merkle_root);
        data.extend_from_slice(&self.timestamp.to_le_bytes());
        data.extend_from_slice(&self.nbits.to_le_bytes());
        data
    }
}

// ─── MiningConfiguration ────────────────────────────────────────────────────

/// Mining configuration (52 bytes serialized).
#[derive(Clone, Copy, Debug)]
pub struct MiningConfiguration {
    pub common_dim: u32,      // k
    pub rank: u16,            // noise_rank
    pub mma_type: u16,        // 0 = Int7xInt7ToInt32
    pub rows_pattern: PeriodicPattern,
    pub cols_pattern: PeriodicPattern,
    pub moe: Option<(u16, u16)>, // (e, top_k) — None for dense
}

impl MiningConfiguration {
    /// Default Pearl mainnet config (from node/zkpow/miner.go).
    /// k=1024, rank=32, rows=[0,8,64,72], cols=[0,1,8,9,32,33,40,41]
    pub fn default_mainnet() -> Self {
        Self {
            common_dim: 1024,
            rank: 32,
            mma_type: 0,
            rows_pattern: PeriodicPattern::from_list(&[0, 8, 64, 72]),
            cols_pattern: PeriodicPattern::from_list(&[0, 1, 8, 9, 32, 33, 40, 41]),
            moe: None,
        }
    }

    /// Serialize to 52 bytes (matches pearl node format).
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut data = Vec::with_capacity(52);
        data.extend_from_slice(&self.common_dim.to_le_bytes()); // 4
        data.extend_from_slice(&self.rank.to_le_bytes());       // 2
        data.extend_from_slice(&self.mma_type.to_le_bytes());   // 2
        data.extend_from_slice(&self.rows_pattern.to_bytes());  // 6
        data.extend_from_slice(&self.cols_pattern.to_bytes());  // 6
        // 32-byte reserved/MoE trailer
        let mut trailer = [0u8; 32];
        if let Some((e, top_k)) = self.moe {
            trailer[0..2].copy_from_slice(&e.to_le_bytes());
            trailer[2..4].copy_from_slice(&top_k.to_le_bytes());
        }
        data.extend_from_slice(&trailer);
        data
    }

    pub fn dot_product_length(&self) -> usize {
        let k = self.common_dim as usize;
        let r = self.rank as usize;
        k - k % r
    }
}

// ─── Noise Generation ───────────────────────────────────────────────────────
// Source: pearl/zk-pow/src/circuit/pearl_noise.rs

/// Generate random hash for noise: blake3(prepend_index || seed, key=key)
fn get_random_hash(index: usize, seed: &[u8; 32], key: &[u8; 32], prepend_index: usize) -> [u8; 32] {
    let mut message = vec![0u8; 64]; // 32 bytes for prepend slots + 32 bytes for seed
    let prepend_value = (1 + index) as i32;
    message[prepend_index * 4..(prepend_index * 4 + 4)].copy_from_slice(&prepend_value.to_le_bytes());
    message[32..64].copy_from_slice(seed);
    blake3_digest(&message, Some(key))
}

/// Generate uniform random matrix (E_AL or E_BR_transposed).
/// Values in [-32, 31] (UNIFORM_NOISE_RANGE=64, ZERO_POINT_TRANSLATION=32).
fn generate_uniform_random_matrix(
    seed: &[u8; 32],
    key: &[u8; 32],
    row_indices: &[usize],
    num_cols: usize,
) -> Vec<Vec<i8>> {
    row_indices
        .iter()
        .map(|&row_idx| {
            let start_idx = row_idx * num_cols;
            (start_idx / BLAKE3_DIGEST_SIZE
                ..(start_idx + num_cols).div_ceil(BLAKE3_DIGEST_SIZE))
                .flat_map(|block| {
                    let hash = get_random_hash(block, seed, key, 0);
                    hash.into_iter().enumerate().filter_map(move |(k, byte)| {
                        let idx = block * BLAKE3_DIGEST_SIZE + k;
                        (idx >= start_idx && idx < start_idx + num_cols)
                            .then(|| (byte & RANGE_MASK) as i8 - ZERO_POINT_TRANSLATION)
                    })
                })
                .collect()
        })
        .collect()
}

/// High 32 bits of 64-bit product of two u32s.
fn mul_hi_u32(a: u32, b: u32) -> u32 {
    ((a as u64 * b as u64) >> 32) as u32
}

/// Generate sparse permutation matrix (E_AR_transposed or B_L).
/// Returns k pairs of indices.
fn generate_permutation_matrix(
    seed: &[u8; 32],
    key: &[u8; 32],
    k: usize,
    noise_rank: usize,
) -> Vec<[u32; 2]> {
    const BYTES_PER_LINE: usize = 4;
    const LINES_PER_HASH: usize = BLAKE3_DIGEST_SIZE / BYTES_PER_LINE; // 8

    let rank_mask = (noise_rank - 1) as u32;
    let mut res = vec![[0u32; 2]; k];

    for (i, chunk) in res.chunks_mut(LINES_PER_HASH).enumerate() {
        let random_hash = get_random_hash(i, seed, key, 1);
        for (j, slot) in chunk.iter_mut().enumerate() {
            let random_uint32 = u32::from_le_bytes([
                random_hash[j * 4],
                random_hash[j * 4 + 1],
                random_hash[j * 4 + 2],
                random_hash[j * 4 + 3],
            ]);
            let first_idx = random_uint32 & rank_mask;
            let second_idx = first_idx ^ (1 + mul_hi_u32((noise_rank - 1) as u32, random_uint32));
            *slot = [first_idx, second_idx];
        }
    }
    res
}

/// Sparse matrix-vector multiply: result[i] = v[perm[i][0]] - v[perm[i][1]]
fn matvec_sparse_perm(perm: &[[u32; 2]], vec: &[i8]) -> Vec<i8> {
    perm.iter()
        .map(|&[first_idx, second_idx]| {
            let pos_val = vec[first_idx as usize] as i32;
            let neg_val = vec[second_idx as usize] as i32;
            (pos_val - neg_val) as i8
        })
        .collect()
}

/// Noise matrices for A and B^T.
pub struct Noise {
    pub a: Vec<Vec<i8>>, // m×k
    pub b: Vec<Vec<i8>>, // n×k (columns of B as rows)
}

/// Compute noise for given row/column indices.
pub fn compute_noise_for_indices(
    k: usize,
    noise_rank: usize,
    commitment_hash: ([u8; 32], [u8; 32]),
    a_rows_indices: &[usize],
    b_cols_indices: &[usize],
) -> Noise {
    let (b_noise_seed, a_noise_seed) = commitment_hash;

    let e_al = generate_uniform_random_matrix(&SEED_LABEL_A, &a_noise_seed, a_rows_indices, noise_rank);
    let e_ar_transposed = generate_permutation_matrix(&SEED_LABEL_A, &a_noise_seed, k, noise_rank);
    let e_bl = generate_permutation_matrix(&SEED_LABEL_B, &b_noise_seed, k, noise_rank);
    let e_br_transposed = generate_uniform_random_matrix(&SEED_LABEL_B, &b_noise_seed, b_cols_indices, noise_rank);

    // noise_a[i] = E_AR · E_AL[i] (sparse matvec)
    let noise_a: Vec<Vec<i8>> = e_al.iter().map(|row| matvec_sparse_perm(&e_ar_transposed, row)).collect();

    // noise_b_t[j] = E_BL · E_BR_T[j] (sparse matvec)
    let noise_b: Vec<Vec<i8>> = e_br_transposed.iter().map(|col| matvec_sparse_perm(&e_bl, col)).collect();

    Noise { a: noise_a, b: noise_b }
}

// ─── Jackpot Hash ───────────────────────────────────────────────────────────

/// Compute blake3(jackpot_msg, key=a_noise_seed) where jackpot_msg is 16 u32 words LE.
pub fn compute_jackpot_hash(jackpot: &[u32; JACKPOT_SIZE], a_noise_seed: [u8; 32]) -> [u8; 32] {
    let mut msg = [0u8; 64];
    for (i, &val) in jackpot.iter().enumerate() {
        msg[i * 4..(i + 1) * 4].copy_from_slice(&val.to_le_bytes());
    }
    blake3_digest(&msg, Some(&a_noise_seed))
}

// ─── Difficulty ─────────────────────────────────────────────────────────────

/// Convert Bitcoin compact nbits to U256 difficulty target.
pub fn nbits_to_difficulty(nbits: u32) -> [u8; 32] {
    let exponent = (nbits >> 24) as usize;
    let mantissa = nbits & 0x00ffffff;
    if mantissa == 0 || exponent == 0 || mantissa & 0x00800000 != 0 {
        return [0u8; 32];
    }
    let mut target = [0u8; 32];
    if exponent <= 3 {
        let mantissa_bytes = mantissa.to_le_bytes();
        for i in 0..exponent {
            target[i] = mantissa_bytes[i];
        }
    } else {
        let mantissa_bytes = mantissa.to_le_bytes();
        for i in 0..3 {
            target[exponent - 3 + i] = mantissa_bytes[i];
        }
    }
    target
}

/// Extract difficulty bound: nbits_to_difficulty * h * w * dot_product_length.
pub fn extract_difficulty_bound(nbits: u32, config: &MiningConfiguration) -> [u8; 32] {
    let base = nbits_to_difficulty(nbits);
    let h = config.rows_pattern.size() as u64;
    let w = config.cols_pattern.size() as u64;
    let dpl = config.dot_product_length() as u64;
    let factor = h * w * dpl;

    // Multiply U256 (LE bytes) by u64
    let mut result = [0u8; 32];
    let mut carry: u128 = 0;
    for i in 0..32 {
        carry += base[i] as u128 * factor as u128;
        result[i] = carry as u8;
        carry >>= 8;
    }
    // If overflow, saturate to max
    if carry > 0 {
        return [0xFFu8; 32];
    }
    result
}

/// Compare two 32-byte LE values (returns true if a <= b)
pub fn le_compare(a: &[u8; 32], b: &[u8; 32]) -> bool {
    for i in (0..32).rev() {
        if a[i] < b[i] { return true; }
        if a[i] > b[i] { return false; }
    }
    true
}

// ─── Matrix helpers ─────────────────────────────────────────────────────────

fn flatten_matrix(matrix: &[Vec<i8>]) -> Vec<u8> {
    matrix.iter().flatten().map(|&x| x as u8).collect()
}

/// Partition indices using periodic pattern.
fn threads_partition(pattern: &PeriodicPattern, total_dimension: usize) -> Vec<Vec<usize>> {
    let period = pattern.period() as usize;
    assert!(total_dimension % period == 0, "total_dimension must be divisible by pattern period");
    let base_indices: Vec<usize> = pattern.to_list().iter().map(|&i| i as usize).collect();
    (0..total_dimension)
        .filter(|&i| pattern.offset_is_valid(i as u32))
        .map(|offset| base_indices.iter().map(|&d| offset + d).collect())
        .collect()
}

// ─── PlainProof (bincode-serializable) ──────────────────────────────────────

#[derive(serde::Serialize)]
pub struct PearlMatrixMerkleProof {
    pub proof: MerkleProof,
    pub row_indices: Vec<usize>,
}

#[derive(serde::Serialize)]
pub struct PearlPlainProof {
    pub m: usize,
    pub n: usize,
    pub k: usize,
    pub noise_rank: usize,
    pub a: PearlMatrixMerkleProof,
    pub bt: PearlMatrixMerkleProof,
    pub moe: Option<()>,
}

// ─── Mining ─────────────────────────────────────────────────────────────────

/// Build a MatrixMerkleProof for the given matrix and row indices.
fn build_matrix_proof(
    matrix: &[Vec<i8>],
    job_key: &[u8; 32],
    row_indices: &[usize],
    num_cols: usize,
) -> PearlMatrixMerkleProof {
    let padded = pad_to_chunk_boundary(&flatten_matrix(matrix));
    let tree = MerkleTree::new(&padded, *job_key);
    let leaf_indices = MerkleTree::compute_leaf_indices_from_rows(row_indices, (matrix.len(), num_cols));
    let proof = tree.get_multileaf_proof(&leaf_indices);
    PearlMatrixMerkleProof {
        proof,
        row_indices: row_indices.to_vec(),
    }
}

/// Compute job_key = blake3(header_bytes || mining_config_bytes)
fn compute_job_key(header: &IncompleteBlockHeader, config: &MiningConfiguration) -> [u8; 32] {
    let mut data = Vec::with_capacity(128);
    data.extend_from_slice(&header.to_bytes());
    data.extend_from_slice(&config.to_bytes());
    blake3_digest(&data, None)
}

/// Compute commitment hash: (b_noise_seed, a_noise_seed)
fn compute_commitment_hash(
    job_key: &[u8; 32],
    a_row_major: &[u8],
    b_col_major: &[u8],
) -> ([u8; 32], [u8; 32]) {
    let hash_a = blake3_digest(a_row_major, Some(job_key));
    let hash_b = blake3_digest(b_col_major, Some(job_key));
    let b_noise_seed = blake3_digest(&[&job_key[..], &hash_b[..]].concat(), None);
    let a_noise_seed = blake3_digest(&[&b_noise_seed[..], &hash_a[..]].concat(), None);
    (b_noise_seed, a_noise_seed)
}

/// Result of a mining attempt.
pub struct MinedProof {
    pub plain_proof_b64: String,
    pub jackpot_hash: [u8; 32],
}

/// Try to mine one proof. Returns None if no share found in this attempt.
/// Uses a deterministic RNG seeded by `nonce` so each nonce gives different matrices.
pub fn try_mine_one(
    nonce: u64,
    m: usize,
    n: usize,
    k: usize,
    rank: usize,
    header: &IncompleteBlockHeader,
    config: &MiningConfiguration,
    difficulty_bound: &[u8; 32],
) -> Option<MinedProof> {
    // Deterministic RNG from nonce (simple LCG seeded by nonce)
    let mut rng = SimpleRng::new(nonce);

    // Generate random matrices A (m×k) and B (k×n) with int7 entries [-64, 64]
    let a_matrix: Vec<Vec<i8>> = (0..m)
        .map(|_| (0..k).map(|_| rng.range(SIGNAL_MIN, SIGNAL_MAX)).collect())
        .collect();
    let b_matrix: Vec<Vec<i8>> = (0..k)
        .map(|_| (0..n).map(|_| rng.range(SIGNAL_MIN, SIGNAL_MAX)).collect())
        .collect();

    // Transpose B → B^T (n×k)
    let b_transposed: Vec<Vec<i8>> = (0..n)
        .map(|i| (0..k).map(|j| b_matrix[j][i]).collect())
        .collect();

    // Compute job_key and commitment hash
    let job_key = compute_job_key(header, config);
    let a_row_major = pad_to_chunk_boundary(&flatten_matrix(&a_matrix));
    let b_col_major = pad_to_chunk_boundary(&flatten_matrix(&b_transposed));
    let (b_noise_seed, a_noise_seed) = compute_commitment_hash(&job_key, &a_row_major, &b_col_major);

    // Compute noise for all rows/cols
    let a_all_rows: Vec<usize> = (0..m).collect();
    let b_all_cols: Vec<usize> = (0..n).collect();
    let noise = compute_noise_for_indices(k, rank, (b_noise_seed, a_noise_seed), &a_all_rows, &b_all_cols);

    // Add noise: A' = A + E, B'^T = B^T + F
    let a_noised: Vec<Vec<i32>> = a_matrix
        .iter()
        .zip(&noise.a)
        .map(|(a_row, n_row)| a_row.iter().zip(n_row).map(|(&a, &n)| a as i32 + n as i32).collect())
        .collect();
    let b_noised_t: Vec<Vec<i32>> = b_transposed
        .iter()
        .zip(&noise.b)
        .map(|(bt_row, n_row)| bt_row.iter().zip(n_row).map(|(&b, &n)| b as i32 + n as i32).collect())
        .collect();

    // Mine using pattern partitions
    for a_rows in threads_partition(&config.rows_pattern, m) {
        for b_cols in threads_partition(&config.cols_pattern, n) {
            let tile_h = a_rows.len();
            let tile_w = b_cols.len();
            let mut jackpot_tile: Vec<Vec<i32>> = vec![vec![0; tile_w]; tile_h];
            let mut jackpot: [u32; JACKPOT_SIZE] = [0; JACKPOT_SIZE];

            for ll in (rank..=k).step_by(rank) {
                for (u, &a_idx) in a_rows.iter().enumerate() {
                    for (v, &b_idx) in b_cols.iter().enumerate() {
                        for l in ll - rank..ll {
                            jackpot_tile[u][v] += a_noised[a_idx][l] * b_noised_t[b_idx][l];
                        }
                    }
                }
                let xored_tile = jackpot_tile.iter().flatten().fold(0u32, |a, &x| a ^ x as u32);
                let tid = (ll / rank - 1) % JACKPOT_SIZE;
                jackpot[tid] = jackpot[tid].rotate_left(LROT_PER_TILE) ^ xored_tile;
            }

            let jackpot_hash = compute_jackpot_hash(&jackpot, a_noise_seed);
            if le_compare(&jackpot_hash, difficulty_bound) {
                // Found a valid share! Build Merkle proofs.
                let a_proof = build_matrix_proof(&a_matrix, &job_key, &a_rows, k);
                let bt_proof = build_matrix_proof(&b_transposed, &job_key, &b_cols, k);

                let proof = PearlPlainProof {
                    m, n, k,
                    noise_rank: rank,
                    a: a_proof,
                    bt: bt_proof,
                    moe: None,
                };

                let proof_bytes = bincode::serialize(&proof).ok()?;
                let plain_proof_b64 = base64::Engine::encode(
                    &base64::engine::general_purpose::STANDARD,
                    &proof_bytes,
                );

                return Some(MinedProof {
                    plain_proof_b64,
                    jackpot_hash,
                });
            }
        }
    }

    None
}

/// Mine a proof by scanning nonces. Returns the first valid proof found.
pub fn mine(
    m: usize,
    n: usize,
    k: usize,
    rank: usize,
    header: &IncompleteBlockHeader,
    config: &MiningConfiguration,
    difficulty_bound: &[u8; 32],
    max_attempts: u64,
) -> Option<MinedProof> {
    for nonce in 0..max_attempts {
        if let Some(proof) = try_mine_one(nonce, m, n, k, rank, header, config, difficulty_bound) {
            return Some(proof);
        }
    }
    None
}

// ─── Simple deterministic RNG ───────────────────────────────────────────────

struct SimpleRng {
    state: u64,
}

impl SimpleRng {
    fn new(seed: u64) -> Self {
        Self { state: seed.wrapping_add(0x9E3779B97F4A7C15) }
    }

    fn next_u64(&mut self) -> u64 {
        // xorshift64*
        self.state ^= self.state >> 12;
        self.state ^= self.state << 25;
        self.state ^= self.state >> 27;
        self.state.wrapping_mul(0x2545F4914F6CDD1D)
    }

    fn range(&mut self, min: i8, max: i8) -> i8 {
        let range = (max as i32 - min as i32 + 1) as u64;
        let val = self.next_u64() % range;
        (min as i32 + val as i32) as i8
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_periodic_pattern_from_list() {
        let p = PeriodicPattern::from_list(&[0, 8, 64, 72]);
        assert_eq!(p.to_list(), vec![0, 8, 64, 72]);
        assert_eq!(p.size(), 4);
        assert_eq!(p.period(), 128);
    }

    #[test]
    fn test_periodic_pattern_cols() {
        let p = PeriodicPattern::from_list(&[0, 1, 8, 9, 32, 33, 40, 41]);
        assert_eq!(p.to_list(), vec![0, 1, 8, 9, 32, 33, 40, 41]);
        assert_eq!(p.size(), 8);
    }

    #[test]
    fn test_header_roundtrip() {
        let header = IncompleteBlockHeader {
            version: 1,
            prev_block: [0xAA; 32],
            merkle_root: [0xBB; 32],
            timestamp: 1234567890,
            nbits: 0x1E01FFFF,
        };
        let bytes = header.to_bytes();
        assert_eq!(bytes.len(), 76);
        let parsed = IncompleteBlockHeader::from_bytes(&bytes);
        assert_eq!(parsed.version, 1);
        assert_eq!(parsed.timestamp, 1234567890);
        assert_eq!(parsed.nbits, 0x1E01FFFF);
    }

    #[test]
    fn test_mining_config_bytes() {
        let config = MiningConfiguration::default_mainnet();
        let bytes = config.to_bytes();
        assert_eq!(bytes.len(), 52);
        // common_dim = 1024 = 0x400
        assert_eq!(&bytes[0..4], &[0x00, 0x04, 0x00, 0x00]);
        // rank = 32 = 0x20
        assert_eq!(&bytes[4..6], &[0x20, 0x00]);
    }

    #[test]
    fn test_merkle_tree_single_chunk() {
        let data = vec![42u8; 100];
        let key = [7u8; 32];
        let tree = MerkleTree::new(&data, key);
        let root = tree.root();
        // Should equal blake3::keyed_hash
        let expected = blake3::keyed_hash(&key, &data);
        assert_eq!(root, *expected.as_bytes());
    }

    #[test]
    fn test_merkle_tree_multi_chunk() {
        let data = vec![42u8; 2048]; // 2 chunks
        let key = [7u8; 32];
        let tree = MerkleTree::new(&data, key);
        assert_eq!(tree.num_leaves(), 2);
        // Root = merge_subtrees_root(chunk0_cv, chunk1_cv) = blake3::keyed_hash(data)
        let expected_root = blake3::keyed_hash(&key, &data);
        assert_eq!(tree.root(), *expected_root.as_bytes());
    }

    #[test]
    fn test_noise_generation() {
        let k = 1024;
        let rank = 32;
        let seed_a = [1u8; 32];
        let seed_b = [2u8; 32];
        let a_rows = vec![0, 1, 2, 3];
        let b_cols = vec![0, 1, 2, 3];
        let noise = compute_noise_for_indices(k, rank, (seed_b, seed_a), &a_rows, &b_cols);
        assert_eq!(noise.a.len(), 4);
        assert_eq!(noise.a[0].len(), k);
        assert_eq!(noise.b.len(), 4);
        assert_eq!(noise.b[0].len(), k);
    }

    #[test]
    fn test_jackpot_hash() {
        let jackpot = [42u32; 16];
        let key = [7u8; 32];
        let hash = compute_jackpot_hash(&jackpot, key);
        // Verify it's a valid blake3 hash
        assert_ne!(hash, [0u8; 32]);
    }

    #[test]
    fn test_plain_proof_serialization() {
        // Build a minimal PlainProof with empty Merkle proofs
        let proof = PearlPlainProof {
            m: 256,
            n: 512,
            k: 1024,
            noise_rank: 32,
            a: PearlMatrixMerkleProof {
                proof: MerkleProof {
                    leaf_data: vec![],
                    leaf_indices: vec![],
                    total_leaves: 256,
                    root: [0u8; 32],
                    siblings: vec![],
                },
                row_indices: vec![],
            },
            bt: PearlMatrixMerkleProof {
                proof: MerkleProof {
                    leaf_data: vec![],
                    leaf_indices: vec![],
                    total_leaves: 512,
                    root: [0u8; 32],
                    siblings: vec![],
                },
                row_indices: vec![],
            },
            moe: None,
        };
        let bytes = bincode::serialize(&proof).unwrap();
        assert!(!bytes.is_empty());
        // Verify base64 encoding works
        let b64 = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            &bytes,
        );
        assert!(!b64.is_empty());
    }

    #[cfg(feature = "gpu-metal")]
    #[test]
    fn test_gpu_pouw_kernel_compiles() {
        // Verify the Metal kernel compiles by running a minimal mining call
        use crate::gpu_metal::{MetalBackend, PearlPouwGpuInput};
        let mut backend = MetalBackend::new(256).expect("Metal backend");
        // Minimal input: 1×1 matrices, easy target
        let a = vec![0i32; 1];
        let b = vec![0i32; 1];
        let row_off = vec![0u32];
        let col_off = vec![0u32];
        let rows_base = vec![0u32];
        let cols_base = vec![0u32];
        let input = PearlPouwGpuInput {
            noised_a: &a,
            noised_b: &b,
            a_noise_seed: [0u8; 32],
            target: [0xFFu8; 32],
            row_offsets: &row_off,
            col_offsets: &col_off,
            rows_base: &rows_base,
            cols_base: &cols_base,
        };
        // This should compile the kernel and run (may or may not find a share)
        let result = backend.pearl_pouw_mine(&input);
        assert!(result.is_ok(), "GPU mining call failed: {:?}", result.err());
    }

    #[cfg(feature = "gpu-metal")]
    #[test]
    fn test_gpu_pouw_matches_cpu() {
        // Generate one nonce's data on CPU, run GPU, and verify the GPU
        // finds the same winning tile as CPU (with a very easy target).
        use crate::gpu_metal::{MetalBackend, PearlPouwGpuInput};

        let m = 256;
        let n = 512;
        let k = 1024;
        let rank = 32;
        let nonce = 42u64;

        let header = IncompleteBlockHeader {
            version: 1,
            prev_block: [0xAA; 32],
            merkle_root: [0xBB; 32],
            timestamp: 1234567890,
            nbits: 0x1E01FFFF,
        };
        let config = MiningConfiguration::default_mainnet();

        // Generate matrices on CPU
        let mut rng = SimpleRng::new(nonce);
        let a_matrix: Vec<Vec<i8>> = (0..m)
            .map(|_| (0..k).map(|_| rng.range(SIGNAL_MIN, SIGNAL_MAX)).collect())
            .collect();
        let b_matrix: Vec<Vec<i8>> = (0..k)
            .map(|_| (0..n).map(|_| rng.range(SIGNAL_MIN, SIGNAL_MAX)).collect())
            .collect();
        let b_transposed: Vec<Vec<i8>> = (0..n)
            .map(|i| (0..k).map(|j| b_matrix[j][i]).collect())
            .collect();

        let job_key = compute_job_key(&header, &config);
        let a_row_major = pad_to_chunk_boundary(&flatten_matrix(&a_matrix));
        let b_col_major = pad_to_chunk_boundary(&flatten_matrix(&b_transposed));
        let (b_noise_seed, a_noise_seed) = compute_commitment_hash(&job_key, &a_row_major, &b_col_major);

        let a_all_rows: Vec<usize> = (0..m).collect();
        let b_all_cols: Vec<usize> = (0..n).collect();
        let noise = compute_noise_for_indices(k, rank, (b_noise_seed, a_noise_seed), &a_all_rows, &b_all_cols);

        let a_noised: Vec<Vec<i32>> = a_matrix
            .iter()
            .zip(&noise.a)
            .map(|(a_row, n_row)| a_row.iter().zip(n_row).map(|(&a, &n)| a as i32 + n as i32).collect())
            .collect();
        let b_noised_t: Vec<Vec<i32>> = b_transposed
            .iter()
            .zip(&noise.b)
            .map(|(bt_row, n_row)| bt_row.iter().zip(n_row).map(|(&b, &n)| b as i32 + n as i32).collect())
            .collect();

        // Compute all jackpot hashes on CPU
        let row_offsets: Vec<u32> = (0..m as u32)
            .filter(|&i| config.rows_pattern.offset_is_valid(i))
            .collect();
        let col_offsets: Vec<u32> = (0..n as u32)
            .filter(|&i| config.cols_pattern.offset_is_valid(i))
            .collect();
        let rows_base: Vec<u32> = config.rows_pattern.to_list();
        let cols_base: Vec<u32> = config.cols_pattern.to_list();

        // Find the best (lowest) jackpot hash on CPU
        let mut best_hash: Option<([u8; 32], usize)> = None;
        for (tile_idx, &row_off) in row_offsets.iter().enumerate() {
            for (col_idx, &col_off) in col_offsets.iter().enumerate() {
                let a_rows: Vec<usize> = rows_base.iter().map(|&d| row_off as usize + d as usize).collect();
                let b_cols: Vec<usize> = cols_base.iter().map(|&d| col_off as usize + d as usize).collect();

                let mut jackpot_tile: Vec<Vec<i32>> = vec![vec![0; b_cols.len()]; a_rows.len()];
                let mut jackpot: [u32; JACKPOT_SIZE] = [0; JACKPOT_SIZE];

                for ll in (rank..=k).step_by(rank) {
                    for (u, &a_idx) in a_rows.iter().enumerate() {
                        for (v, &b_idx) in b_cols.iter().enumerate() {
                            for l in ll - rank..ll {
                                jackpot_tile[u][v] += a_noised[a_idx][l] * b_noised_t[b_idx][l];
                            }
                        }
                    }
                    let xored = jackpot_tile.iter().flatten().fold(0u32, |a, &x| a ^ x as u32);
                    let tid = (ll / rank - 1) % JACKPOT_SIZE;
                    jackpot[tid] = jackpot[tid].rotate_left(LROT_PER_TILE) ^ xored;
                }

                let jh = compute_jackpot_hash(&jackpot, a_noise_seed);
                let flat_idx = tile_idx * 64 + col_idx;
                if best_hash.is_none() || jh < best_hash.unwrap().0 {
                    best_hash = Some((jh, flat_idx));
                }
            }
        }

        let (cpu_best_hash, cpu_best_tile) = best_hash.unwrap();

        // Run GPU with a target that accepts the best hash
        // Target = all 0xFF (accept everything) to find the first winning tile
        let easy_target = [0xFFu8; 32];

        let a_flat: Vec<i32> = a_noised.iter().flat_map(|r| r.iter().copied()).collect();
        let b_flat: Vec<i32> = b_noised_t.iter().flat_map(|r| r.iter().copied()).collect();

        let mut backend = MetalBackend::new(256).expect("Metal backend");
        let gpu_input = PearlPouwGpuInput {
            noised_a: &a_flat,
            noised_b: &b_flat,
            a_noise_seed,
            target: easy_target,
            row_offsets: &row_offsets,
            col_offsets: &col_offsets,
            rows_base: &rows_base,
            cols_base: &cols_base,
        };

        let gpu_result = backend.pearl_pouw_mine(&gpu_input).expect("GPU mine").expect("GPU should find a share");

        // The GPU should find a tile (first one that meets the easy target)
        // Verify the GPU jackpot hash matches the CPU-computed hash for that tile
        let gpu_tile = gpu_result.tile_index as usize;
        let gpu_hash = gpu_result.jackpot_hash;

        // Recompute CPU hash for the GPU's winning tile
        let gpu_row_off_idx = gpu_tile / 64;
        let gpu_col_off_idx = gpu_tile % 64;
        let gpu_row_off = row_offsets[gpu_row_off_idx] as usize;
        let gpu_col_off = col_offsets[gpu_col_off_idx] as usize;
        let gpu_a_rows: Vec<usize> = rows_base.iter().map(|&d| gpu_row_off + d as usize).collect();
        let gpu_b_cols: Vec<usize> = cols_base.iter().map(|&d| gpu_col_off + d as usize).collect();

        let mut jackpot_tile: Vec<Vec<i32>> = vec![vec![0; gpu_b_cols.len()]; gpu_a_rows.len()];
        let mut jackpot: [u32; JACKPOT_SIZE] = [0; JACKPOT_SIZE];
        for ll in (rank..=k).step_by(rank) {
            for (u, &a_idx) in gpu_a_rows.iter().enumerate() {
                for (v, &b_idx) in gpu_b_cols.iter().enumerate() {
                    for l in ll - rank..ll {
                        jackpot_tile[u][v] += a_noised[a_idx][l] * b_noised_t[b_idx][l];
                    }
                }
            }
            let xored = jackpot_tile.iter().flatten().fold(0u32, |a, &x| a ^ x as u32);
            let tid = (ll / rank - 1) % JACKPOT_SIZE;
            jackpot[tid] = jackpot[tid].rotate_left(LROT_PER_TILE) ^ xored;
        }
        let cpu_hash_for_gpu_tile = compute_jackpot_hash(&jackpot, a_noise_seed);

        assert_eq!(
            gpu_hash, cpu_hash_for_gpu_tile,
            "GPU jackpot hash mismatch at tile {} — GPU={:?} CPU={:?}",
            gpu_tile, gpu_hash, cpu_hash_for_gpu_tile
        );

        // Also verify the GPU found the same best tile as CPU
        // (with easy target, GPU finds first tile that meets, which should be tile 0
        // since all tiles meet the easy target — but the hash should still match)
        eprintln!("CPU best tile={} hash={:02x?}", cpu_best_tile, cpu_best_hash);
        eprintln!("GPU found tile={} hash={:02x?}", gpu_tile, gpu_hash);
    }
}

// ─── GPU-accelerated mining (Metal) ─────────────────────────────────────────

/// Try to mine one proof using GPU for MatMul + jackpot scanning.
/// CPU handles matrix generation, noise, and Merkle proof construction.
/// GPU handles the 4096-tile MatMul + jackpot hash computation.
#[cfg(feature = "gpu-metal")]
pub fn try_mine_one_gpu(
    nonce: u64,
    m: usize,
    n: usize,
    k: usize,
    rank: usize,
    header: &IncompleteBlockHeader,
    config: &MiningConfiguration,
    difficulty_bound: &[u8; 32],
    gpu_backend: &mut crate::gpu_metal::MetalBackend,
) -> Option<MinedProof> {
    use crate::gpu_metal::{PearlPouwGpuInput, PearlPouwGpuResult};

    // Deterministic RNG from nonce
    let mut rng = SimpleRng::new(nonce);

    // Generate random matrices A (m×k) and B (k×n) with int7 entries
    let a_matrix: Vec<Vec<i8>> = (0..m)
        .map(|_| (0..k).map(|_| rng.range(SIGNAL_MIN, SIGNAL_MAX)).collect())
        .collect();
    let b_matrix: Vec<Vec<i8>> = (0..k)
        .map(|_| (0..n).map(|_| rng.range(SIGNAL_MIN, SIGNAL_MAX)).collect())
        .collect();

    // Transpose B → B^T (n×k)
    let b_transposed: Vec<Vec<i8>> = (0..n)
        .map(|i| (0..k).map(|j| b_matrix[j][i]).collect())
        .collect();

    // Compute job_key and commitment hash
    let job_key = compute_job_key(header, config);
    let a_row_major = pad_to_chunk_boundary(&flatten_matrix(&a_matrix));
    let b_col_major = pad_to_chunk_boundary(&flatten_matrix(&b_transposed));
    let (b_noise_seed, a_noise_seed) = compute_commitment_hash(&job_key, &a_row_major, &b_col_major);

    // Compute noise for all rows/cols
    let a_all_rows: Vec<usize> = (0..m).collect();
    let b_all_cols: Vec<usize> = (0..n).collect();
    let noise = compute_noise_for_indices(k, rank, (b_noise_seed, a_noise_seed), &a_all_rows, &b_all_cols);

    // Add noise: A' = A + E, B'^T = B^T + F
    let a_noised: Vec<Vec<i32>> = a_matrix
        .iter()
        .zip(&noise.a)
        .map(|(a_row, n_row)| a_row.iter().zip(n_row).map(|(&a, &n)| a as i32 + n as i32).collect())
        .collect();
    let b_noised_t: Vec<Vec<i32>> = b_transposed
        .iter()
        .zip(&noise.b)
        .map(|(bt_row, n_row)| bt_row.iter().zip(n_row).map(|(&b, &n)| b as i32 + n as i32).collect())
        .collect();

    // Flatten noised matrices for GPU (row-major)
    let a_flat: Vec<i32> = a_noised.iter().flat_map(|r| r.iter().copied()).collect();
    let b_flat: Vec<i32> = b_noised_t.iter().flat_map(|r| r.iter().copied()).collect();

    // Compute valid row/col offsets
    let row_offsets: Vec<u32> = (0..m as u32)
        .filter(|&i| config.rows_pattern.offset_is_valid(i))
        .collect();
    let col_offsets: Vec<u32> = (0..n as u32)
        .filter(|&i| config.cols_pattern.offset_is_valid(i))
        .collect();

    let rows_base: Vec<u32> = config.rows_pattern.to_list();
    let cols_base: Vec<u32> = config.cols_pattern.to_list();

    // Run GPU mining
    let gpu_input = PearlPouwGpuInput {
        noised_a: &a_flat,
        noised_b: &b_flat,
        a_noise_seed,
        target: *difficulty_bound,
        row_offsets: &row_offsets,
        col_offsets: &col_offsets,
        rows_base: &rows_base,
        cols_base: &cols_base,
    };

    let gpu_result = gpu_backend.pearl_pouw_mine(&gpu_input).ok()??;

    // GPU found a valid tile — reconstruct Merkle proof on CPU
    let tile_idx = gpu_result.tile_index as usize;
    let row_off_idx = tile_idx / 64;
    let col_off_idx = tile_idx % 64;

    let row_off = row_offsets[row_off_idx] as usize;
    let col_off = col_offsets[col_off_idx] as usize;

    let a_rows: Vec<usize> = rows_base.iter().map(|&d| row_off + d as usize).collect();
    let b_cols: Vec<usize> = cols_base.iter().map(|&d| col_off + d as usize).collect();

    // Build Merkle proofs
    let a_proof = build_matrix_proof(&a_matrix, &job_key, &a_rows, k);
    let bt_proof = build_matrix_proof(&b_transposed, &job_key, &b_cols, k);

    let proof = PearlPlainProof {
        m, n, k,
        noise_rank: rank,
        a: a_proof,
        bt: bt_proof,
        moe: None,
    };

    let proof_bytes = bincode::serialize(&proof).ok()?;
    let plain_proof_b64 = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &proof_bytes,
    );

    Some(MinedProof {
        plain_proof_b64,
        jackpot_hash: gpu_result.jackpot_hash,
    })
}

/// Mine using GPU. Scans nonces, each nonce = one GPU dispatch.
#[cfg(feature = "gpu-metal")]
pub fn mine_gpu(
    m: usize,
    n: usize,
    k: usize,
    rank: usize,
    header: &IncompleteBlockHeader,
    config: &MiningConfiguration,
    difficulty_bound: &[u8; 32],
    max_attempts: u64,
    gpu_backend: &mut crate::gpu_metal::MetalBackend,
) -> Option<MinedProof> {
    for nonce in 0..max_attempts {
        if let Some(proof) = try_mine_one_gpu(nonce, m, n, k, rank, header, config, difficulty_bound, gpu_backend) {
            return Some(proof);
        }
    }
    None
}

