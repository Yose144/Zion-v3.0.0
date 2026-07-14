//! Real Pearl (PRL) Proof-of-Useful-Work pipeline.
//!
//! Implements the actual pearlhash PoUW algorithm:
//!   1. Derive job_key from block header + mining config
//!   2. Build BLAKE3 Merkle trees for matrices A and B^T
//!   3. Derive noise seeds from job_key and Merkle roots
//!   4. Generate noise matrices (E = E_AL * E_AR, F = E_BL * E_BR)
//!   5. Perform noisy GEMM: C' = (A+E) * (B+F), checking jackpot hash per tile
//!   6. On block opening: create PlainProof with sampled rows/cols + Merkle proofs
//!   7. Serialize PlainProof as bincode + base64 for stratum submission
//!
//! Reference: pearl-research-labs/pearl open-source node (zk-pow, pearl-blake3, miner-base)

use anyhow::{bail, ensure, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use blake3::hazmat::{merge_subtrees_non_root, merge_subtrees_root, HasherExt, Mode};
use blake3::{Hasher, CHUNK_LEN, OUT_LEN};
use serde::{Deserialize, Serialize};

// ─── Constants ───────────────────────────────────────────────────────────────

pub const BLAKE3_DIGEST_SIZE: usize = OUT_LEN;       // 32
pub const BLAKE3_CHUNK_LEN: usize = CHUNK_LEN;       // 1024
pub const BLAKE3_BLOCK_LEN: usize = 64;              // BLAKE3 compression block

/// Transcript size: 64 bytes = 16 × uint32 (matches blake3::MSG_BLOCK_SIZE_U32)
const TRANSCRIPT_SIZE_U32: usize = 16;
/// Rotation amount for hash accumulation mixing
const HASH_ACCUMULATE_ROTATION: u32 = 13;

/// Default mining configuration dimensions.
/// Reference config: m=512, n=512, k=4096, noise_rank=256
pub const DEFAULT_M: usize = 512;
pub const DEFAULT_N: usize = 512;
pub const DEFAULT_K: usize = 4096;
pub const DEFAULT_NOISE_RANK: usize = 256;
pub const DEFAULT_NOISE_RANGE: usize = 128;
pub const DEFAULT_HASH_TILE_H: usize = 16;
pub const DEFAULT_HASH_TILE_W: usize = 16;

// ─── Block Header ────────────────────────────────────────────────────────────

/// Pearl incomplete block header (76 bytes, little-endian on the wire).
/// The full header is 108 bytes; the trailing 32-byte ProofCommitment is
/// constructed by the miner during mining.
#[derive(Debug, Clone, Copy)]
pub struct IncompleteBlockHeader {
    pub version: u32,
    pub prev_block: [u8; 32],
    pub merkle_root: [u8; 32],
    pub timestamp: u32,
    pub nbits: u32,
}

impl IncompleteBlockHeader {
    pub const SERIALIZED_SIZE: usize = 76;

    pub fn from_bytes(data: &[u8]) -> Result<Self> {
        ensure!(data.len() == Self::SERIALIZED_SIZE, "Expected 76 bytes, got {}", data.len());
        Ok(Self {
            version: u32::from_le_bytes(data[0..4].try_into().unwrap()),
            prev_block: {
                // Stored internally LE; wire has reversed bytes
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&data[4..36]);
                arr.iter().rev().copied().collect::<Vec<_>>().try_into().unwrap()
            },
            merkle_root: {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&data[36..68]);
                arr.iter().rev().copied().collect::<Vec<_>>().try_into().unwrap()
            },
            timestamp: u32::from_le_bytes(data[68..72].try_into().unwrap()),
            nbits: u32::from_le_bytes(data[72..76].try_into().unwrap()),
        })
    }

    pub fn to_bytes(&self) -> [u8; Self::SERIALIZED_SIZE] {
        let mut bytes = Vec::with_capacity(Self::SERIALIZED_SIZE);
        bytes.extend_from_slice(&self.version.to_le_bytes());
        bytes.extend(self.prev_block.iter().rev().copied());
        bytes.extend(self.merkle_root.iter().rev().copied());
        bytes.extend_from_slice(&self.timestamp.to_le_bytes());
        bytes.extend_from_slice(&self.nbits.to_le_bytes());
        bytes.try_into().unwrap()
    }

    /// Parse from hex string (as received from stratum mining.notify)
    pub fn from_hex(hex: &str) -> Result<Self> {
        let bytes = hex::decode(hex)?;
        Self::from_bytes(&bytes)
    }
}

// ─── Mining Configuration ────────────────────────────────────────────────────

/// Periodic pattern — generalized arithmetic progression for index sets.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PeriodicPattern {
    pub shape: [(u32, u32); 3], // (stride, length) pairs
}

impl PeriodicPattern {
    pub const NUM_DIMS: usize = 3;

    pub fn to_bytes(&self) -> [u8; 2 * Self::NUM_DIMS] {
        let mut data = [0u8; 2 * Self::NUM_DIMS];
        let mut min_stride = 1u32;
        for (i, &(stride, length)) in self.shape.iter().enumerate() {
            let factor = stride / min_stride;
            data[2 * i] = (factor - 1) as u8;
            data[2 * i + 1] = (length - 1) as u8;
            min_stride = stride * length;
        }
        data
    }

    pub fn from_bytes(data: &[u8]) -> Result<Self> {
        ensure!(data.len() == 2 * Self::NUM_DIMS, "Expected 6 bytes");
        let mut shape = [(0u32, 0u32); Self::NUM_DIMS];
        let mut min_stride = 1u32;
        let mut is_done = false;
        for (i, chunk) in data.chunks(2).enumerate() {
            let factor = 1 + (chunk[0] as u32);
            let length = 1 + (chunk[1] as u32);
            if length == 1 || is_done {
                ensure!(factor == 1 && length == 1, "Non-canonical representation");
                is_done = true;
            } else if factor <= 1 && min_stride != 1 {
                bail!("A single stride must not be broken");
            }
            ensure!(min_stride <= (1 << 24) / (factor * length), "Pattern period > 2^24");
            let stride = factor * min_stride;
            shape[i] = (stride, length);
            min_stride = stride * length;
        }
        Ok(Self { shape })
    }

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

    pub fn from_list(pattern: &[u32]) -> Result<Self> {
        ensure!(!pattern.is_empty(), "Pattern cannot be empty");
        ensure!(pattern.windows(2).all(|w| w[0] < w[1]), "Pattern must be sorted");
        ensure!(pattern[0] == 0, "Pattern must start at 0");
        let mut p: Vec<u32> = pattern.to_vec();
        let mut shape_vec = Vec::new();
        while p.len() > 1 {
            let mut found = false;
            for period in 1..p.len() {
                if p.len().is_multiple_of(period) {
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
            ensure!(found, "Pattern is not periodic");
        }
        shape_vec.reverse();
        let period = shape_vec.last().map_or(1, |&(s, l)| s * l);
        while shape_vec.len() < Self::NUM_DIMS {
            shape_vec.push((period, 1));
        }
        Ok(Self { shape: shape_vec.try_into().unwrap() })
    }

    pub fn size(&self) -> u32 {
        self.shape.iter().map(|&(_, length)| length).product()
    }

    pub fn indices_with_offset(&self, offset: u32) -> Vec<u32> {
        self.to_list().into_iter().map(|i| i + offset).collect()
    }
}

/// Matrix multiply-accumulate type.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u16)]
pub enum MMAType {
    Int7xInt7ToInt32 = 0,
}

/// Mining configuration (52 bytes serialized).
#[derive(Debug, Clone, Copy)]
pub struct MiningConfiguration {
    pub common_dim: u32,    // k
    pub rank: u16,          // noise_rank
    pub mma_type: MMAType,
    pub rows_pattern: PeriodicPattern,
    pub cols_pattern: PeriodicPattern,
    pub moe: Option<MoEConfig>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MoEConfig {
    pub e: u16,
    pub top_k: u16,
}

impl MiningConfiguration {
    pub const SERIALIZED_SIZE: usize = 52;

    pub fn to_bytes(&self) -> [u8; Self::SERIALIZED_SIZE] {
        let mut bytes = Vec::with_capacity(Self::SERIALIZED_SIZE);
        bytes.extend_from_slice(&self.common_dim.to_le_bytes());
        bytes.extend_from_slice(&self.rank.to_le_bytes());
        bytes.extend_from_slice(&(self.mma_type as u16).to_le_bytes());
        bytes.extend_from_slice(&self.rows_pattern.to_bytes());
        bytes.extend_from_slice(&self.cols_pattern.to_bytes());
        // 32-byte trailer: e(2) | top_k(2) | zero-padding(28)
        let mut trailer = [0u8; 32];
        if let Some(moe) = self.moe {
            trailer[0..2].copy_from_slice(&moe.e.to_le_bytes());
            trailer[2..4].copy_from_slice(&moe.top_k.to_le_bytes());
        }
        bytes.extend_from_slice(&trailer);
        bytes.try_into().unwrap()
    }

    pub fn dot_product_length(&self) -> usize {
        let cd = self.common_dim as usize;
        let r = self.rank as usize;
        cd - cd % r
    }
}

// ─── BLAKE3 Merkle Tree ──────────────────────────────────────────────────────

type Digest = [u8; OUT_LEN];

/// One-shot BLAKE3 keyed hash.
fn blake3_digest(data: &[u8], key: Option<[u8; 32]>) -> Digest {
    match key {
        Some(k) => *blake3::keyed_hash(&k, data).as_bytes(),
        None => *blake3::hash(data).as_bytes(),
    }
}

/// Pad data to next multiple of CHUNK_LEN (1024 bytes).
fn pad_to_chunk_boundary(data: &[u8]) -> Vec<u8> {
    let padded_len = data.len().div_ceil(CHUNK_LEN) * CHUNK_LEN;
    let mut padded = data.to_vec();
    padded.resize(padded_len, 0);
    padded
}

/// BLAKE3 Merkle tree with multi-leaf proof generation.
pub struct MerkleTree {
    key: Digest,
    layers: Vec<Vec<Digest>>,
    data: Vec<u8>,
}

impl MerkleTree {
    /// Build a Merkle tree from padded data using keyed BLAKE3.
    pub fn new(data: &[u8], key: Digest) -> Self {
        if data.is_empty() {
            return Self { key, layers: vec![vec![]], data: vec![] };
        }
        if data.len() <= CHUNK_LEN {
            let root = blake3_digest(data, Some(key));
            return Self { key, layers: vec![vec![root]], data: data.to_vec() };
        }
        // Hash each chunk
        let num_chunks = data.len().div_ceil(CHUNK_LEN);
        let chunk_cvs: Vec<Digest> = (0..num_chunks)
            .map(|i| {
                let start = i * CHUNK_LEN;
                let end = (start + CHUNK_LEN).min(data.len());
                let chunk = &data[start..end];
                // chunk_cv: non-root hash of a single chunk
                let mut h = Hasher::new_keyed(&key);
                h.set_input_offset((i * CHUNK_LEN) as u64);
                h.update(chunk);
                h.finalize_non_root()
            })
            .collect();

        let mut layers: Vec<Vec<Digest>> = vec![chunk_cvs];

        // Build tree layers
        while layers.last().unwrap().len() > 2 {
            let prev = layers.last().unwrap();
            let mode = Mode::KeyedHash(&key);
            let next: Vec<Digest> = prev
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

        // Root layer
        let last = layers.last().unwrap();
        if last.len() == 2 {
            let mode = Mode::KeyedHash(&key);
            let root = *merge_subtrees_root(&last[0], &last[1], mode).as_bytes();
            layers.push(vec![root]);
        }

        Self { key, layers, data: data.to_vec() }
    }

    pub fn root(&self) -> Digest {
        self.layers.last().map(|l| l[0]).unwrap_or([0u8; OUT_LEN])
    }

    pub fn num_leaves(&self) -> usize {
        self.layers.first().map(|l| l.len()).unwrap_or(0)
    }

    /// Generate a multi-leaf Merkle proof.
    pub fn get_multileaf_proof(&self, leaf_indices: &[usize]) -> MerkleProof {
        use std::collections::BTreeSet;
        assert!(!leaf_indices.is_empty());
        let unique: BTreeSet<usize> = leaf_indices.iter().copied().collect();
        let total_leaves = self.num_leaves();
        let sorted_indices: Vec<usize> = unique.iter().copied().collect();

        // Collect leaf data (each 1024 bytes)
        let leaf_data: Vec<Vec<u8>> = sorted_indices
            .iter()
            .map(|&i| {
                let start = i * CHUNK_LEN;
                let end = (start + CHUNK_LEN).min(self.data.len());
                let mut chunk = vec![0u8; CHUNK_LEN];
                chunk[..end - start].copy_from_slice(&self.data[start..end]);
                chunk
            })
            .collect();

        // Walk tree to collect sibling hashes and side flags
        let mut siblings: Vec<Digest> = Vec::new();
        let mut side_flags: Vec<usize> = Vec::new();
        let mut current_set = unique;
        let mut level_len = total_leaves;

        let mut level = 0;
        while level_len > 1 && !current_set.is_empty() {
            let level_nodes = &self.layers[level];
            for &i in &current_set {
                if i % 2 == 1 {
                    // Current node is right child → sibling is left
                    if !current_set.contains(&(i - 1)) {
                        siblings.push(level_nodes[i - 1]);
                        side_flags.push(1); // sibling is left child
                    }
                } else if !current_set.contains(&(i + 1)) && (i + 1) < level_len {
                    // Current node is left child → sibling is right
                    siblings.push(level_nodes[i + 1]);
                    side_flags.push(0); // sibling is right child
                }
            }
            current_set = current_set.iter().map(|&i| i / 2).collect();
            level_len = level_len.div_ceil(2);
            level += 1;
        }

        // Leaf hash = hash of the first selected leaf
        let leaf_hash = if !sorted_indices.is_empty() {
            self.layers[0][sorted_indices[0]]
        } else {
            [0u8; 32]
        };

        MerkleProof {
            leaf_data,
            leaf_indices: sorted_indices,
            total_leaves,
            root: self.root(),
            siblings,
            leaf_hash,
            side_flags,
        }
    }

    /// Compute which leaf indices are needed to prove the given matrix rows.
    pub fn compute_leaf_indices_from_rows(row_indices: &[usize], cols: usize) -> Vec<usize> {
        use std::collections::BTreeSet;
        let mut indices = BTreeSet::new();
        for &row in row_indices {
            let first = (row * cols) / CHUNK_LEN;
            let last = ((row + 1) * cols - 1) / CHUNK_LEN;
            for i in first..=last {
                indices.insert(i);
            }
        }
        indices.into_iter().collect()
    }
}

/// Generic multi-leaf Merkle proof.
#[derive(Clone, Serialize, Deserialize)]
pub struct MerkleProof {
    pub leaf_data: Vec<Vec<u8>>,
    pub leaf_indices: Vec<usize>,
    pub total_leaves: usize,
    pub root: Digest,
    pub siblings: Vec<Digest>,
    /// Hash of the first selected leaf (for the official proof format).
    #[serde(default)]
    pub leaf_hash: Digest,
    /// Side flags for each sibling: 0 = sibling is right child, 1 = sibling is left child.
    #[serde(default)]
    pub side_flags: Vec<usize>,
}

impl std::fmt::Debug for MerkleProof {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MerkleProof")
            .field("leaf_indices", &self.leaf_indices)
            .field("total_leaves", &self.total_leaves)
            .field("leaf_count", &self.leaf_data.len())
            .field("sibling_count", &self.siblings.len())
            .finish()
    }
}

// ─── PlainProof ──────────────────────────────────────────────────────────────

/// Merkle proof data for a single matrix, with row indices.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MatrixMerkleProof {
    pub proof: MerkleProof,
    pub row_indices: Vec<usize>,
}

/// Plain proof — the binary structure submitted to the pool.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PlainProof {
    pub m: usize,
    pub n: usize,
    pub k: usize,
    pub noise_rank: usize,
    pub a: MatrixMerkleProof,
    pub bt: MatrixMerkleProof,
    pub moe: Option<MoEProofParams>,
    /// First 64 bytes of the noised A row (for jackpot verification).
    /// Populated by the GPU mining path; None for legacy CPU-only proofs.
    #[serde(default)]
    pub noised_a_fragment: Vec<u8>,
    /// First 64 bytes of the noised B^T row.
    #[serde(default)]
    pub noised_b_fragment: Vec<u8>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MoEProofParams {
    pub e: usize,
    pub top_k: usize,
    pub expert_idx: u16,
    pub routing_end_offsets: Vec<u32>,
    pub inner_a_rows: Vec<usize>,
    pub routing_proof: MerkleProof,
}

impl PlainProof {
    /// Serialize to the official flat binary format then base64.
    ///
    /// Format (matches alpha-miner-amd v1.7.5 `append_matrix_proof`):
    /// ```text
    /// Header (32 bytes = 4 × u64 LE):
    ///   u64 LE: m
    ///   u64 LE: n
    ///   u64 LE: k
    ///   u64 LE: noise_rank
    ///
    /// A matrix proof (append_matrix_proof):
    ///   u64 LE: num_leaves (= data_size / 1024, one per selected chunk)
    ///   For each chunk:
    ///     u64 LE: chunk_size (= 1024 = k, or remainder for last chunk)
    ///     [chunk_size] bytes: raw int8 data
    ///   u64 LE: row_indices_count
    ///   For each row index: u64 LE: row_index
    ///   u64 LE: total_leaves (total leaves in full tree)
    ///   [32] bytes: leaf_hash (hash of first selected leaf)
    ///   u64 LE: num_siblings
    ///   For each sibling: [32] bytes: sibling_hash
    ///   u64 LE: side_flags_count
    ///   For each side flag: u64 LE: side_flag (0=sibling right, 1=sibling left)
    ///
    /// B^T matrix proof (same format as A)
    /// ```
    pub fn to_flat_binary(&self) -> Result<Vec<u8>> {
        let mut buf = Vec::with_capacity(256);

        // Header (4 × u64 = 32 bytes)
        buf.extend_from_slice(&(self.m as u64).to_le_bytes());
        buf.extend_from_slice(&(self.n as u64).to_le_bytes());
        buf.extend_from_slice(&(self.k as u64).to_le_bytes());
        buf.extend_from_slice(&(self.noise_rank as u64).to_le_bytes());

        // Append A matrix proof
        Self::append_matrix_proof_bytes(
            &mut buf,
            &self.a.proof,
            &self.a.row_indices,
            self.k,
        );

        // Append B^T matrix proof
        Self::append_matrix_proof_bytes(
            &mut buf,
            &self.bt.proof,
            &self.bt.row_indices,
            self.k,
        );

        Ok(buf)
    }

    /// Append a single matrix proof in the official `append_matrix_proof` format.
    fn append_matrix_proof_bytes(
        buf: &mut Vec<u8>,
        proof: &MerkleProof,
        row_indices: &[usize],
        k: usize,
    ) {
        // u64: num_leaves (= number of chunks in the proof data)
        let num_leaves = proof.leaf_data.len() as u64;
        buf.extend_from_slice(&num_leaves.to_le_bytes());

        // For each chunk: u64 chunk_size + raw data
        for (i, chunk) in proof.leaf_data.iter().enumerate() {
            let chunk_size = if i == proof.leaf_data.len() - 1 && k < CHUNK_LEN {
                k as u64 // last chunk might be smaller
            } else {
                chunk.len() as u64
            };
            buf.extend_from_slice(&chunk_size.to_le_bytes());
            buf.extend_from_slice(chunk);
        }

        // append_usize_vec(row_indices): u64 count + u64[] values
        buf.extend_from_slice(&(row_indices.len() as u64).to_le_bytes());
        for &idx in row_indices {
            buf.extend_from_slice(&(idx as u64).to_le_bytes());
        }

        // u64: total_leaves
        buf.extend_from_slice(&(proof.total_leaves as u64).to_le_bytes());

        // 32 bytes: leaf_hash
        buf.extend_from_slice(&proof.leaf_hash);

        // u64: num_siblings
        buf.extend_from_slice(&(proof.siblings.len() as u64).to_le_bytes());

        // For each sibling: 32 bytes hash
        for sib in &proof.siblings {
            buf.extend_from_slice(sib);
        }

        // append_usize_vec(side_flags): u64 count + u64[] values
        buf.extend_from_slice(&(proof.side_flags.len() as u64).to_le_bytes());
        for &flag in &proof.side_flags {
            buf.extend_from_slice(&(flag as u64).to_le_bytes());
        }
    }

    /// Serialize to flat binary format then base64 (official format).
    pub fn to_base64(&self) -> Result<String> {
        // Try flat binary format first (official alpha-miner format)
        let bytes = self.to_flat_binary()?;
        Ok(B64.encode(bytes))
    }

    /// Serialize to legacy bincode format then base64.
    pub fn to_base64_bincode(&self) -> Result<String> {
        let bytes = bincode::serialize(self)?;
        Ok(B64.encode(bytes))
    }

    /// Deserialize from base64 (via bincode, for internal testing).
    pub fn from_base64(data: &str) -> Result<Self> {
        let bytes = B64.decode(data)?;
        // Try current format, then legacy V1 (append Option::None tag)
        match bincode::deserialize::<Self>(&bytes) {
            Ok(p) => Ok(p),
            Err(_) => {
                let mut padded = Vec::with_capacity(bytes.len() + 1);
                padded.extend_from_slice(&bytes);
                padded.push(0x00); // bincode Option::None tag
                bincode::deserialize(&padded)
                    .map_err(|e| anyhow::anyhow!("PlainProof deserialize failed: {e}"))
            }
        }
    }
}

// ─── Commitment Hash (Noise Seed Derivation) ─────────────────────────────────

/// Commitment hash = (noise_seed_A, noise_seed_B)
#[derive(Debug, Clone)]
pub struct CommitmentHash {
    pub noise_seed_a: Digest,
    pub noise_seed_b: Digest,
}

/// Compute the job_key from block header + mining config.
/// job_key = blake3(header_bytes || mining_config_bytes)
pub fn compute_job_key(header: &IncompleteBlockHeader, config: &MiningConfiguration) -> Digest {
    let mut input = Vec::with_capacity(128);
    input.extend_from_slice(&header.to_bytes());
    input.extend_from_slice(&config.to_bytes());
    blake3_digest(&input, None)
}

/// Compute commitment hash (noise seeds) from job_key and Merkle roots.
/// b_noise_seed = blake3(job_key || hash_b)
/// a_noise_seed = blake3(b_noise_seed || hash_a)
pub fn compute_commitment_hash(job_key: &Digest, hash_a: &Digest, hash_b: &Digest) -> CommitmentHash {
    let noise_seed_b = blake3_digest(&[job_key.as_slice(), hash_b.as_slice()].concat(), None);
    let noise_seed_a = blake3_digest(&[noise_seed_b.as_slice(), hash_a.as_slice()].concat(), None);
    CommitmentHash {
        noise_seed_a,
        noise_seed_b,
    }
}

// ─── Noise Generation ────────────────────────────────────────────────────────

/// Generate noise matrices for Pearl PoUW.
///
/// E = E_AL * E_AR (noise for A, shape m×k)
/// F = E_BL * E_BR (noise for B, shape k×n)
///
/// E_AL: m×r uniform random int8
/// E_AR: r×k permutation matrix (int8, ±1 entries)
/// E_BL: k×r permutation matrix (int8, ±1 entries)
/// E_BR: r×n uniform random int8 (transposed to n×r then transposed back)
pub struct NoiseMatrices {
    pub e_al: Vec<i8>, // m × r (row-major)
    pub e_ar: Vec<i8>, // r × k (row-major)
    pub e_bl: Vec<i8>, // k × r (row-major)
    pub e_br: Vec<i8>, // r × n (row-major)
}

fn is_power_of_two(n: usize) -> bool {
    n != 0 && (n & (n - 1)) == 0
}

/// BLAKE3 PRNG: hash(index || seed) with key to get random bytes.
fn get_random_hash(index: usize, seed: &[u8], key: &[u8; 32], prepend_index: usize) -> Digest {
    let mut message = vec![0u8; 32]; // 8 × int32
    let val = (1 + index) as u32;
    message[prepend_index * 4..(prepend_index + 1) * 4].copy_from_slice(&val.to_le_bytes());
    message.extend_from_slice(seed);
    blake3_digest(&message, Some(*key))
}

/// Generate uniform random matrix (int8) from BLAKE3 PRNG.
/// Values in range [-noise_range/2, noise_range/2 - 1]
fn generate_uniform_random_matrix(
    seed: &[u8],
    key: &[u8; 32],
    rows: usize,
    noise_rank: usize,
    noise_range: usize,
) -> Vec<i8> {
    let cols = noise_rank;
    let total = rows * cols;
    let draws = total.div_ceil(BLAKE3_DIGEST_SIZE);
    let range_mask = (noise_range / 2 - 1) as u8; // noise_range/2 - 1
    let zero_point_translation = (noise_range / 2) as i8;

    let mut result = vec![0i8; total];
    let mut offset = 0;
    for i in 0..draws {
        let hash = get_random_hash(i, seed, key, 0);
        for &byte in &hash {
            if offset >= total {
                break;
            }
            let masked = (byte & range_mask) as i8;
            result[offset] = masked.wrapping_sub(zero_point_translation);
            offset += 1;
        }
    }
    result
}

/// Generate permutation matrix (int8) from BLAKE3 PRNG.
/// Each row/column has exactly one +1 and one -1 entry, rest zeros.
fn generate_permutation_matrix(
    seed: &[u8],
    key: &[u8; 32],
    rows: usize,
    cols: usize,
    assign_columns: bool,
    noise_rank: usize,
) -> Vec<i8> {
    let required_lines = if assign_columns { cols } else { rows };
    let bytes_per_line = 4;
    let draws = (required_lines * bytes_per_line).div_ceil(BLAKE3_DIGEST_SIZE);
    let rank_mask = (noise_rank - 1) as u32;

    let mut matrix = vec![0i8; rows * cols];

    let mut assignment_index = 0usize;
    'outer: for i in 0..draws {
        let hash = get_random_hash(i, seed, key, 1);
        let u32_array: &[u32] = unsafe {
            std::slice::from_raw_parts(
                hash.as_ptr() as *const u32,
                BLAKE3_DIGEST_SIZE / bytes_per_line,
            )
        };
        for &random_uint32 in u32_array {
            if assignment_index >= required_lines {
                break 'outer;
            }
            let first_idx = (random_uint32 & rank_mask) as usize;
            // second_idx = first_idx ^ (1 + mul_hi(noise_rank-1, random_uint32))
            let prod64 = (noise_rank as u64 - 1) * (random_uint32 as u64);
            let mul_hi = (prod64 >> 32) as u32;
            let second_idx = (first_idx ^ (1 + mul_hi as usize)) & (noise_rank - 1);

            if assign_columns {
                // matrix[:, assignment_index] — set first_idx and second_idx in column
                matrix[first_idx * cols + assignment_index] = 1;
                matrix[second_idx * cols + assignment_index] = -1;
            } else {
                // matrix[assignment_index, :] — set first_idx and second_idx in row
                matrix[assignment_index * cols + first_idx] = 1;
                matrix[assignment_index * cols + second_idx] = -1;
            }
            assignment_index += 1;
        }
    }

    matrix
}

/// Generate all four noise matrices.
pub fn generate_noise(
    key_a: &[u8; 32],
    key_b: &[u8; 32],
    m: usize,
    k: usize,
    n: usize,
    noise_rank: usize,
    noise_range: usize,
) -> Result<NoiseMatrices> {
    ensure!(is_power_of_two(noise_range), "noise_range must be power of two");
    ensure!(is_power_of_two(noise_rank), "noise_rank must be power of two");

    // Fixed seeds
    let mut seed_a = [0u8; 32];
    seed_a[..8].copy_from_slice(b"A_tensor");
    let mut seed_b = [0u8; 32];
    seed_b[..8].copy_from_slice(b"B_tensor");

    // E_AL: m × r uniform random
    let e_al = generate_uniform_random_matrix(&seed_a, key_a, m, noise_rank, noise_range);

    // E_AR: r × k permutation matrix (assign_columns=true)
    let e_ar = generate_permutation_matrix(&seed_a, key_a, noise_rank, k, true, noise_rank);

    // E_BL: k × r permutation matrix (assign_columns=false)
    let e_bl = generate_permutation_matrix(&seed_b, key_b, k, noise_rank, false, noise_rank);

    // E_BR: r × n uniform random, then transpose to n × r and back
    // In the reference: B_R = generate_uniform_random_matrix(seed_B, key_B, B_cols).T
    // So we generate n × r and transpose to r × n
    let e_br_raw = generate_uniform_random_matrix(&seed_b, key_b, n, noise_rank, noise_range);
    // Transpose from n×r to r×n
    let mut e_br = vec![0i8; noise_rank * n];
    for row in 0..n {
        for col in 0..noise_rank {
            e_br[col * n + row] = e_br_raw[row * noise_rank + col];
        }
    }

    Ok(NoiseMatrices { e_al, e_ar, e_bl, e_br })
}

// ─── Noisy GEMM + Jackpot Hash ───────────────────────────────────────────────

/// Transcript: 64-byte buffer (16 × uint32) for accumulating inner hash results.
#[derive(Clone)]
struct Transcript {
    data: [u32; TRANSCRIPT_SIZE_U32],
}

impl Transcript {
    fn new() -> Self {
        Self { data: [0u32; TRANSCRIPT_SIZE_U32] }
    }

    fn rotl_xor_into(&mut self, reduction_count: usize, combined_hash: u32) {
        let idx = reduction_count % TRANSCRIPT_SIZE_U32;
        let val = self.data[idx];
        self.data[idx] = val.rotate_left(HASH_ACCUMULATE_ROTATION) ^ combined_hash;
    }

    fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(TRANSCRIPT_SIZE_U32 * 4);
        for &w in &self.data {
            bytes.extend_from_slice(&w.to_le_bytes());
        }
        bytes
    }
}

/// XOR all int32 (uint32) elements in a tile → single uint32.
fn xor_reduction(tile: &[i32]) -> u32 {
    let mut acc: u32 = 0;
    for &v in tile {
        acc ^= v as u32;
    }
    acc
}

/// Check if a transcript hash meets the PoW target.
/// hash = blake3(transcript_bytes, key=pow_key)
/// Returns true if hash (as little-endian U256) <= target (as little-endian U256).
fn check_pow_target(transcript: &Transcript, pow_key: &[u8; 32], target: &[u8; 32]) -> bool {
    let transcript_bytes = transcript.to_bytes();
    let hash = blake3::keyed_hash(pow_key, &transcript_bytes);
    let hash_bytes = hash.as_bytes();
    // Compare as little-endian U256: byte 0 is least significant
    // hash <= target iff for the first differing byte (from MSB), hash byte < target byte
    for i in (0..32).rev() {
        if hash_bytes[i] != target[i] {
            return hash_bytes[i] < target[i];
        }
    }
    true // equal
}

/// Result of a noisy GEMM mining attempt.
pub struct MiningResult {
    pub found_block: bool,
    /// Row indices of the opened hash tile in A
    pub a_row_indices: Vec<usize>,
    /// Column indices of the opened hash tile in B
    pub b_column_indices: Vec<usize>,
}

/// Perform noisy GEMM and check for block opening.
///
/// This is the CPU implementation. For GPU, see the OpenCL kernel.
///
/// Steps:
/// 1. A' = A + E_AL * E_AR (noised A)
/// 2. B' = B + E_BL * E_BR (noised B)
/// 3. C' = A' * B' (tiled, checking jackpot per hash tile)
/// 4. C = C' - A*E_BL*E_BR - E_AL*E_AR*B' (denoise — not needed for mining)
pub fn noisy_gemm_mine(
    a: &[i8],       // m × k (row-major)
    b: &[i8],       // k × n (row-major)
    noise: &NoiseMatrices,
    m: usize,
    k: usize,
    n: usize,
    noise_rank: usize,
    hash_tile_h: usize,
    hash_tile_w: usize,
    pow_key: &[u8; 32],
    target: &[u8; 32],
) -> MiningResult {
    // 1. Noise A: A' = A + E_AL * E_AR
    // E_A = E_AL (m×r) * E_AR (r×k) → m×k int8
    // Compute E_A = E_AL * E_AR (int32 intermediate, then cast to int8)
    let mut e_a = vec![0i32; m * k];
    for row in 0..m {
        for col in 0..k {
            let mut sum: i32 = 0;
            for r in 0..noise_rank {
                sum += noise.e_al[row * noise_rank + r] as i32
                    * noise.e_ar[r * k + col] as i32;
            }
            e_a[row * k + col] = sum;
        }
    }
    // A' = A + E_A (cast to int8)
    let a_prime: Vec<i8> = (0..m * k)
        .map(|i| a[i].wrapping_add(e_a[i] as i8))
        .collect();

    // 2. Noise B: B' = B + E_BL * E_BR
    let mut e_b = vec![0i32; k * n];
    for row in 0..k {
        for col in 0..n {
            let mut sum: i32 = 0;
            for r in 0..noise_rank {
                sum += noise.e_bl[row * noise_rank + r] as i32
                    * noise.e_br[r * n + col] as i32;
            }
            e_b[row * n + col] = sum;
        }
    }
    let b_prime: Vec<i8> = (0..k * n)
        .map(|i| b[i].wrapping_add(e_b[i] as i8))
        .collect();

    // 3. Tiled GEMM: C' = A' * B', checking jackpot per hash tile
    let mut found_block = false;
    let mut found_rows = Vec::new();
    let mut found_cols = Vec::new();

    // Process output tiles of size noise_rank × noise_rank
    for i in 0..(m / noise_rank) {
        for j in 0..(n / noise_rank) {
            let i_off = i * noise_rank;
            let j_off = j * noise_rank;

            // Number of hash tiles in this output tile
            let num_ht_h = noise_rank / hash_tile_h;
            let num_ht_w = noise_rank / hash_tile_w;

            // Initialize transcripts for each hash tile
            let mut transcripts: Vec<Vec<Transcript>> = (0..num_ht_h)
                .map(|_| (0..num_ht_w).map(|_| Transcript::new()).collect())
                .collect();

            // Accumulate C_block over k dimension, noise_rank at a time
            let mut c_block = vec![0i32; noise_rank * noise_rank];
            let mut reduction_count = 0;

            for p in (0..k).step_by(noise_rank) {
                let p_end = (p + noise_rank).min(k);
                let p_len = p_end - p;

                // C_tile = A'[i_off..i_off+nr, p..p_end] * B'[p..p_end, j_off..j_off+nr]
                for ri in 0..noise_rank {
                    for ci in 0..noise_rank {
                        let mut sum: i32 = 0;
                        for pi in 0..p_len {
                            sum += a_prime[(i_off + ri) * k + p + pi] as i32
                                * b_prime[(p + pi) * n + j_off + ci] as i32;
                        }
                        c_block[ri * noise_rank + ci] += sum;
                    }
                }

                // Only full tiles contribute to transcript
                if p_len == noise_rank {
                    // Hash each hash tile in c_block
                    for ht_h in 0..num_ht_h {
                        for ht_w in 0..num_ht_w {
                            let tile_start_h = ht_h * hash_tile_h;
                            let tile_start_w = ht_w * hash_tile_w;
                            // XOR all int32 elements in the hash tile
                            let mut tile_vals = Vec::with_capacity(hash_tile_h * hash_tile_w);
                            for th in 0..hash_tile_h {
                                for tw in 0..hash_tile_w {
                                    tile_vals.push(c_block[(tile_start_h + th) * noise_rank + tile_start_w + tw]);
                                }
                            }
                            let inner_hash = xor_reduction(&tile_vals);
                            transcripts[ht_h][ht_w].rotl_xor_into(reduction_count, inner_hash);
                        }
                    }
                    reduction_count += 1;
                }
            }

            // Check each transcript against PoW target
            if !found_block {
                for ht_h in 0..num_ht_h {
                    for ht_w in 0..num_ht_w {
                        if check_pow_target(&transcripts[ht_h][ht_w], pow_key, target) {
                            found_block = true;
                            found_rows = (0..hash_tile_h)
                                .map(|th| i_off + ht_h * hash_tile_h + th)
                                .collect();
                            found_cols = (0..hash_tile_w)
                                .map(|tw| j_off + ht_w * hash_tile_w + tw)
                                .collect();
                            break;
                        }
                    }
                    if found_block { break; }
                }
            }
        }
    }

    MiningResult {
        found_block,
        a_row_indices: found_rows,
        b_column_indices: found_cols,
    }
}

// ─── Full Mining Pipeline ────────────────────────────────────────────────────

/// Create a PlainProof from the mining result.
///
/// This builds Merkle trees for A and B^T, then generates multi-leaf proofs
/// for the opened hash tile's rows/columns.
pub fn create_plain_proof(
    a: &[i8],           // m × k (row-major)
    b: &[i8],           // k × n (row-major)
    m: usize,
    n: usize,
    k: usize,
    noise_rank: usize,
    a_row_indices: &[usize],
    b_column_indices: &[usize],
    job_key: &Digest,
) -> Result<PlainProof> {
    // Build Merkle tree for A (padded to chunk boundary)
    let a_bytes = pad_to_chunk_boundary(bytemuck::cast_slice(a));
    let a_tree = MerkleTree::new(&a_bytes, *job_key);

    // Build Merkle tree for B^T (transpose B, then pad)
    let mut bt = vec![0i8; n * k];
    for row in 0..n {
        for col in 0..k {
            bt[row * k + col] = b[col * n + row];
        }
    }
    let bt_bytes = pad_to_chunk_boundary(bytemuck::cast_slice(&bt));
    let bt_tree = MerkleTree::new(&bt_bytes, *job_key);

    // Compute leaf indices for the sampled rows
    let a_leaf_indices = MerkleTree::compute_leaf_indices_from_rows(a_row_indices, k);
    let bt_leaf_indices = MerkleTree::compute_leaf_indices_from_rows(b_column_indices, k);

    // Generate Merkle proofs
    let a_proof = MatrixMerkleProof {
        proof: a_tree.get_multileaf_proof(&a_leaf_indices),
        row_indices: a_row_indices.to_vec(),
    };
    let bt_proof = MatrixMerkleProof {
        proof: bt_tree.get_multileaf_proof(&bt_leaf_indices),
        row_indices: b_column_indices.to_vec(),
    };

    Ok(PlainProof {
        m,
        n,
        k,
        noise_rank,
        a: a_proof,
        bt: bt_proof,
        moe: None,
        noised_a_fragment: Vec::new(),
        noised_b_fragment: Vec::new(),
    })
}

/// Full mining pipeline: given a block header and target, perform PoUW mining.
///
/// 1. Choose A and B matrices (random int8 in valid range)
/// 2. Compute job_key, Merkle roots, noise seeds
/// 3. Generate noise matrices
/// 4. Perform noisy GEMM with jackpot check
/// 5. If block found, create PlainProof
///
/// Returns Some(PlainProof) if a share was found, None otherwise.
pub fn mine_pearl_share(
    header_hex: &str,
    target_hex: &str,
    m: usize,
    n: usize,
    k: usize,
    noise_rank: usize,
    noise_range: usize,
    hash_tile_h: usize,
    hash_tile_w: usize,
) -> Result<Option<PlainProof>> {
    // Parse header and target
    let header = IncompleteBlockHeader::from_hex(header_hex)?;
    let target_bytes = {
        let bytes = hex::decode(target_hex)?;
        ensure!(bytes.len() == 32, "Target must be 32 bytes");
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        arr
    };

    // Create mining configuration
    // For simplicity, use a fixed pattern that covers the hash tile indices
    // The rows_pattern describes the periodic partition of A rows
    // For a 16×16 hash tile, the pattern is [0, 1, ..., 15] → PeriodicPattern
    let row_indices: Vec<u32> = (0..hash_tile_h as u32).collect();
    let col_indices: Vec<u32> = (0..hash_tile_w as u32).collect();
    let rows_pattern = PeriodicPattern::from_list(&row_indices)?;
    let cols_pattern = PeriodicPattern::from_list(&col_indices)?;

    let config = MiningConfiguration {
        common_dim: k as u32,
        rank: noise_rank as u16,
        mma_type: MMAType::Int7xInt7ToInt32,
        rows_pattern,
        cols_pattern,
        moe: None,
    };

    // Compute job_key
    let job_key = compute_job_key(&header, &config);

    // Generate random A and B matrices (int8, in valid range for noise_range=128)
    // Data range: 256 - noise_range = 128, so [-64, 63]
    let data_range = 256 - noise_range;
    let min_data = -(data_range as i16 / 2) as i8;
    let max_data = min_data + (data_range as i8) - 1;
    let range_size = (max_data - min_data + 1) as u8;

    // Use a simple BLAKE3-based PRNG
    let mut rng_state = job_key;
    let mut next_rand = || {
        let hash = blake3_digest(&rng_state, None);
        rng_state = hash;
        hash[0]
    };

    let a: Vec<i8> = (0..m * k)
        .map(|_| {
            let val = next_rand() % range_size;
            min_data.wrapping_add(val as i8)
        })
        .collect();
    let b: Vec<i8> = (0..k * n)
        .map(|_| {
            let val = next_rand() % range_size;
            min_data.wrapping_add(val as i8)
        })
        .collect();

    // Build Merkle trees and compute roots
    let a_bytes = pad_to_chunk_boundary(bytemuck::cast_slice(&a));
    let a_tree = MerkleTree::new(&a_bytes, job_key);
    let hash_a = a_tree.root();

    let mut bt = vec![0i8; n * k];
    for row in 0..n {
        for col in 0..k {
            bt[row * k + col] = b[col * n + row];
        }
    }
    let bt_bytes = pad_to_chunk_boundary(bytemuck::cast_slice(&bt));
    let bt_tree = MerkleTree::new(&bt_bytes, job_key);
    let hash_b = bt_tree.root();

    // Compute commitment hash (noise seeds)
    let commitment = compute_commitment_hash(&job_key, &hash_a, &hash_b);

    // Generate noise matrices
    let noise = generate_noise(
        &commitment.noise_seed_a,
        &commitment.noise_seed_b,
        m, k, n, noise_rank, noise_range,
    )?;

    // Perform noisy GEMM with jackpot check
    let result = noisy_gemm_mine(
        &a, &b, &noise, m, k, n, noise_rank,
        hash_tile_h, hash_tile_w,
        &commitment.noise_seed_a, // pow_key = a_noise_seed
        &target_bytes,
    );

    if result.found_block {
        // Create PlainProof
        let proof = create_plain_proof(
            &a, &b, m, n, k, noise_rank,
            &result.a_row_indices,
            &result.b_column_indices,
            &job_key,
        )?;
        Ok(Some(proof))
    } else {
        Ok(None)
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blake3_merkle_single_chunk() {
        let data = vec![42u8; 100];
        let padded = pad_to_chunk_boundary(&data);
        let key = [1u8; 32];
        let tree = MerkleTree::new(&padded, key);
        let expected = blake3_digest(&padded, Some(key));
        assert_eq!(tree.root(), expected);
    }

    #[test]
    fn test_blake3_merkle_multi_chunk() {
        let data: Vec<u8> = (0..2048).map(|i| (i % 256) as u8).collect();
        let padded = pad_to_chunk_boundary(&data);
        let key = [42u8; 32];
        let tree = MerkleTree::new(&padded, key);
        let expected = blake3_digest(&padded, Some(key));
        assert_eq!(tree.root(), expected);
    }

    #[test]
    fn test_merkle_proof_verification() {
        let data: Vec<u8> = (0..8192).map(|i| (i % 256) as u8).collect();
        let padded = pad_to_chunk_boundary(&data);
        let key = [7u8; 32];
        let tree = MerkleTree::new(&padded, key);

        // Generate proof for leaf 2
        let proof = tree.get_multileaf_proof(&[2]);
        assert_eq!(proof.root, tree.root());
        assert!(!proof.siblings.is_empty());
    }

    #[test]
    fn test_periodic_pattern_roundtrip() {
        let indices = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        let pattern = PeriodicPattern::from_list(&indices).unwrap();
        let recovered = pattern.to_list();
        assert_eq!(recovered, indices);
    }

    #[test]
    fn test_header_roundtrip() {
        let header = IncompleteBlockHeader {
            version: 0x20400000,
            prev_block: [1u8; 32],
            merkle_root: [2u8; 32],
            timestamp: 0x66666666,
            nbits: 0x1d00ffff,
        };
        let bytes = header.to_bytes();
        assert_eq!(bytes.len(), 76);
        let recovered = IncompleteBlockHeader::from_bytes(&bytes).unwrap();
        assert_eq!(recovered.version, header.version);
        assert_eq!(recovered.timestamp, header.timestamp);
        assert_eq!(recovered.nbits, header.nbits);
    }

    #[test]
    fn test_noise_generation() {
        let key_a = [1u8; 32];
        let key_b = [2u8; 32];
        let noise = generate_noise(&key_a, &key_b, 512, 4096, 512, 256, 128).unwrap();
        // E_AL: 512 × 256
        assert_eq!(noise.e_al.len(), 512 * 256);
        // E_AR: 256 × 4096
        assert_eq!(noise.e_ar.len(), 256 * 4096);
        // E_BL: 4096 × 256
        assert_eq!(noise.e_bl.len(), 4096 * 256);
        // E_BR: 256 × 512
        assert_eq!(noise.e_br.len(), 256 * 512);
    }

    #[test]
    fn test_plain_proof_serialization() {
        // Create a minimal PlainProof
        let proof = PlainProof {
            m: 512,
            n: 512,
            k: 4096,
            noise_rank: 256,
            a: MatrixMerkleProof {
                proof: MerkleProof {
                    leaf_data: vec![vec![0u8; CHUNK_LEN]],
                    leaf_indices: vec![0],
                    total_leaves: 1,
                    root: [0u8; 32],
                    siblings: vec![],
                    leaf_hash: [0u8; 32],
                    side_flags: vec![],
                },
                row_indices: vec![0],
            },
            bt: MatrixMerkleProof {
                proof: MerkleProof {
                    leaf_data: vec![vec![0u8; CHUNK_LEN]],
                    leaf_indices: vec![0],
                    total_leaves: 1,
                    root: [0u8; 32],
                    siblings: vec![],
                    leaf_hash: [0u8; 32],
                    side_flags: vec![],
                },
                row_indices: vec![0],
            },
            moe: None,
            noised_a_fragment: Vec::new(),
            noised_b_fragment: Vec::new(),
        };

        let b64 = proof.to_base64_bincode().unwrap();
        let recovered = PlainProof::from_base64(&b64).unwrap();
        assert_eq!(recovered.m, proof.m);
        assert_eq!(recovered.k, proof.k);
        assert_eq!(recovered.noise_rank, proof.noise_rank);
    }

    #[test]
    fn test_transcript_rotl_xor() {
        let mut t = Transcript::new();
        t.rotl_xor_into(0, 0xDEADBEEF);
        assert_eq!(t.data[0], 0xDEADBEEF); // rotl(0, 13) ^ 0xDEADBEEF = 0xDEADBEEF
        t.rotl_xor_into(0, 0x12345678);
        // rotl(0xDEADBEEF, 13) ^ 0x12345678
        let expected = 0xDEADBEEFu32.rotate_left(13) ^ 0x12345678u32;
        assert_eq!(t.data[0], expected);
    }
}

// ─── GPU Mining Support (CPU-prep + GPU GEMM dispatch) ──────────────────────

/// Pre-computed data for GPU-accelerated Pearl PoUW mining.
/// CPU computes everything except the noisy GEMM + jackpot check,
/// which runs on the GPU.
pub struct PearlGpuPrep {
    /// Noised matrix A' = A + E_AL·E_AR, wrapped to int8 (m×k row-major)
    pub noised_a: Vec<i8>,
    /// Noised matrix B'^T, transposed from B' = B + E_BL·E_BR (n×k row-major)
    pub noised_bt: Vec<i8>,
    /// PoW key (noise_seed_a) for BLAKE3 keyed jackpot hash
    pub pow_key: [u8; 32],
    /// Original matrix A (m×k, for Merkle proof construction)
    pub matrix_a: Vec<i8>,
    /// Original matrix B (k×n, for Merkle proof construction)
    pub matrix_b: Vec<i8>,
    /// Job key (for Merkle tree construction)
    pub job_key: Digest,
    /// Matrix dimensions
    pub m: usize,
    pub n: usize,
    pub k: usize,
    pub noise_rank: usize,
    pub hash_tile_h: usize,
    pub hash_tile_w: usize,
}

/// Extract permutation indices from a permutation matrix.
/// For assign_columns=true (E_AR: rank×k), each column has one +1 and one -1.
/// Returns (first_idx[k], second_idx[k]) where first_idx is the row with +1.
/// For assign_columns=false (E_BL: k×rank), each row has one +1 and one -1.
/// Returns (first_idx[k], second_idx[k]) where first_idx is the col with +1.
fn extract_permutation_indices(
    matrix: &[i8],
    rows: usize,
    cols: usize,
    assign_columns: bool,
) -> (Vec<usize>, Vec<usize>) {
    if assign_columns {
        // E_AR: rank×k, each column has +1 at first_idx and -1 at second_idx
        let mut first = vec![0usize; cols];
        let mut second = vec![0usize; cols];
        for col in 0..cols {
            for row in 0..rows {
                let val = matrix[row * cols + col];
                if val == 1 { first[col] = row; }
                else if val == -1 { second[col] = row; }
            }
        }
        (first, second)
    } else {
        // E_BL: k×rank, each row has +1 at first_idx and -1 at second_idx
        let mut first = vec![0usize; rows];
        let mut second = vec![0usize; rows];
        for row in 0..rows {
            for col in 0..cols {
                let val = matrix[row * cols + col];
                if val == 1 { first[row] = col; }
                else if val == -1 { second[row] = col; }
            }
        }
        (first, second)
    }
}

/// Prepare the GPU mining input: compute all CPU-side data (matrices, noise,
/// noised matrices, Merkle roots, noise seeds) and return them for the GPU
/// to run the GEMM + jackpot check.
///
/// This is the CPU-prep half of the CPU-prep + GPU GEMM dispatch pipeline.
/// After the GPU finds a winning tile, call `create_plain_proof` with the
/// original matrices and the decoded tile indices.
///
/// Optimized: uses all 32 bytes per BLAKE3 hash for matrix generation (32x
/// fewer hashes) and permutation index lookup for noise application (O(m×k)
/// instead of O(m×k×rank)).
pub fn prepare_pearl_gpu_input(
    header_hex: &str,
    _target_hex: &str,
    m: usize,
    n: usize,
    k: usize,
    noise_rank: usize,
    noise_range: usize,
    hash_tile_h: usize,
    hash_tile_w: usize,
) -> Result<PearlGpuPrep> {
    // Parse header
    let header = IncompleteBlockHeader::from_hex(header_hex)?;

    // Create mining configuration
    let row_indices: Vec<u32> = (0..hash_tile_h as u32).collect();
    let col_indices: Vec<u32> = (0..hash_tile_w as u32).collect();
    let rows_pattern = PeriodicPattern::from_list(&row_indices)?;
    let cols_pattern = PeriodicPattern::from_list(&col_indices)?;

    let config = MiningConfiguration {
        common_dim: k as u32,
        rank: noise_rank as u16,
        mma_type: MMAType::Int7xInt7ToInt32,
        rows_pattern,
        cols_pattern,
        moe: None,
    };

    // Compute job_key
    let job_key = compute_job_key(&header, &config);

    // Generate random A and B matrices (int8) — optimized: use all 32 bytes
    // of each BLAKE3 hash instead of just byte 0 (32x fewer hash calls)
    let data_range = 256 - noise_range;
    let min_data = -(data_range as i16 / 2) as i8;
    let range_size = (256 - noise_range) as u8;

    let total_elements = m * k + k * n;
    let mut a = vec![0i8; m * k];
    let mut b = vec![0i8; k * n];

    let mut rng_state = job_key;
    let mut offset = 0usize;
    while offset < total_elements {
        let hash = blake3_digest(&rng_state, None);
        rng_state = hash;
        for &byte in &hash[..] {
            if offset >= total_elements { break; }
            let val = byte % range_size;
            let v = min_data.wrapping_add(val as i8);
            if offset < m * k {
                a[offset] = v;
            } else {
                b[offset - m * k] = v;
            }
            offset += 1;
        }
    }

    // Build Merkle trees and compute roots
    let a_bytes = pad_to_chunk_boundary(bytemuck::cast_slice(&a));
    let a_tree = MerkleTree::new(&a_bytes, job_key);
    let hash_a = a_tree.root();

    let mut bt = vec![0i8; n * k];
    for row in 0..n {
        for col in 0..k {
            bt[row * k + col] = b[col * n + row];
        }
    }
    let bt_bytes = pad_to_chunk_boundary(bytemuck::cast_slice(&bt));
    let bt_tree = MerkleTree::new(&bt_bytes, job_key);
    let hash_b = bt_tree.root();

    // Compute commitment hash (noise seeds)
    let commitment = compute_commitment_hash(&job_key, &hash_a, &hash_b);

    // Generate noise matrices
    let noise = generate_noise(
        &commitment.noise_seed_a,
        &commitment.noise_seed_b,
        m, k, n, noise_rank, noise_range,
    )?;

    // Extract permutation indices for O(1) noise application
    // E_AR: rank×k, assign_columns=true → (first_idx[k], second_idx[k])
    let (e_ar_first, e_ar_second) = extract_permutation_indices(
        &noise.e_ar, noise_rank, k, true,
    );
    // E_BL: k×rank, assign_columns=false → (first_idx[k], second_idx[k])
    let (e_bl_first, e_bl_second) = extract_permutation_indices(
        &noise.e_bl, k, noise_rank, false,
    );

    // Compute noised A' = A + E_AL·E_AR (int8, wrapped)
    // Optimized: E_A[row, col] = E_AL[row, e_ar_first[col]] - E_AL[row, e_ar_second[col]]
    let a_prime: Vec<i8> = (0..m * k)
        .map(|idx| {
            let row = idx / k;
            let col = idx % k;
            let noise_val = noise.e_al[row * noise_rank + e_ar_first[col]] as i32
                - noise.e_al[row * noise_rank + e_ar_second[col]] as i32;
            a[idx].wrapping_add(noise_val as i8)
        })
        .collect();

    // Compute noised B' = B + E_BL·E_BR (int8, wrapped)
    // Optimized: E_B[row, col] = E_BR[e_bl_first[row], col] - E_BR[e_bl_second[row], col]
    let b_prime: Vec<i8> = (0..k * n)
        .map(|idx| {
            let row = idx / n;
            let col = idx % n;
            let noise_val = noise.e_br[e_bl_first[row] * n + col] as i32
                - noise.e_br[e_bl_second[row] * n + col] as i32;
            b[idx].wrapping_add(noise_val as i8)
        })
        .collect();

    // Transpose B' to B'^T (n×k) for GPU coalesced access
    let mut noised_bt = vec![0i8; n * k];
    for row in 0..n {
        for col in 0..k {
            noised_bt[row * k + col] = b_prime[col * n + row];
        }
    }

    Ok(PearlGpuPrep {
        noised_a: a_prime,
        noised_bt,
        pow_key: commitment.noise_seed_a,
        matrix_a: a,
        matrix_b: b,
        job_key,
        m, n, k, noise_rank, hash_tile_h, hash_tile_w,
    })
}

/// Full GPU-accelerated mining pipeline: CPU-prep + GPU GEMM + Merkle proof.
///
/// This function:
/// 1. CPU: prepares noised matrices (A', B'^T) and noise seeds
/// 2. GPU: runs noisy GEMM + jackpot hash + target check
/// 3. CPU: if found, builds PlainProof from original matrices + tile indices
///
/// Returns `Ok(Some(PlainProof))` if a winning tile was found, `Ok(None)` otherwise.
#[cfg(feature = "gpu-opencl")]
pub fn mine_pearl_share_gpu(
    header_hex: &str,
    target_hex: &str,
    m: usize,
    n: usize,
    k: usize,
    noise_rank: usize,
    noise_range: usize,
    hash_tile_h: usize,
    hash_tile_w: usize,
    gpu_miner: &mut crate::gpu_miner::GpuMiner,
) -> Result<Option<PlainProof>> {
    // Step 1: CPU prep
    let prep = prepare_pearl_gpu_input(
        header_hex, target_hex,
        m, n, k, noise_rank, noise_range,
        hash_tile_h, hash_tile_w,
    )?;

    // Parse target
    let target_bytes = {
        let bytes = hex::decode(target_hex)?;
        ensure!(bytes.len() == 32, "Target must be 32 bytes");
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        arr
    };

    // Step 2: GPU GEMM + jackpot check
    let gpu_result = gpu_miner.pearl_pouw_gpu_mine_real(
        &prep.noised_a,
        &prep.noised_bt,
        &prep.pow_key,
        &target_bytes,
        prep.m, prep.n, prep.k,
        prep.noise_rank,
        prep.hash_tile_h,
        prep.hash_tile_w,
    )?;

    // Step 3: Build PlainProof if found
    if let Some(result) = gpu_result {
        let (a_row_indices, b_col_indices) = result.decode_tile_indices();
        let mut proof = create_plain_proof(
            &prep.matrix_a,
            &prep.matrix_b,
            prep.m, prep.n, prep.k, prep.noise_rank,
            &a_row_indices,
            &b_col_indices,
            &prep.job_key,
        )?;

        // Populate noised row fragments (first 64 bytes of each selected noised row)
        // These are needed by the verifier to check the jackpot hash
        if let Some(&first_a_row) = a_row_indices.first() {
            let start = first_a_row * prep.k;
            let end = (start + 64).min(prep.noised_a.len());
            if start < prep.noised_a.len() {
                let bytes: &[u8] = bytemuck::cast_slice(&prep.noised_a[start..end]);
                proof.noised_a_fragment = bytes.to_vec();
            }
        }
        if let Some(&first_b_col) = b_col_indices.first() {
            let start = first_b_col * prep.k;
            let end = (start + 64).min(prep.noised_bt.len());
            if start < prep.noised_bt.len() {
                let bytes: &[u8] = bytemuck::cast_slice(&prep.noised_bt[start..end]);
                proof.noised_b_fragment = bytes.to_vec();
            }
        }

        Ok(Some(proof))
    } else {
        Ok(None)
    }
}
