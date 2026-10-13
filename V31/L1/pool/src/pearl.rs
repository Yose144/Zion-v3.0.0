//! Pearl (PRL) PoUW share verification + gateway wire types.
//!
//! Self-contained port of the canonical `zk-pow` verification path used for
//! pool share accounting: decode a `PlainProof` (bincode), rebuild the mining
//! config from the proved tile indices, verify both keyed-BLAKE3 Merkle
//! proofs, recompute noise seeds (V3 salted bind), apply low-rank noise to the
//! proved strips, run the jackpot transcript and compare the resulting hash
//! against the rank-penalized bound.
//!
//! References (upstream `/tmp/pearl` clone):
//!   - `zk-pow/src/ffi/plain_proof.rs`    — PlainProof/MerkleProof wire layout
//!   - `zk-pow/src/ffi/mine.rs`           — jackpot loop, compute_job_key
//!   - `zk-pow/src/circuit/pearl_noise.rs` — noise generation
//!   - `zk-pow/src/api/seed.rs`           — V3 salted root bind
//!   - `zk-pow/src/api/sanity_checks.rs`  — penalized_target_bound
//!   - `pearl-blake3/src/merkle.rs`       — MerkleProof::compute_root

use anyhow::{bail, ensure, Context, Result};
use blake3::hazmat::{merge_subtrees_non_root, merge_subtrees_root, HasherExt, Mode};
use num_bigint::BigUint;

pub const PEARL_CHUNK_LEN: usize = 1024;
pub const PENALTY_BASE_RANK: usize = 128;
pub const JACKPOT_SIZE: usize = 16;
pub const LROT_PER_TILE: u32 = 13;

/// V3 salted-bind keys (`api/seed.rs::SEED_SALT_A/B` = blake3 of context strs).
pub const PEARL_SEED_SALT_A: [u8; 32] = [
    0x82, 0x49, 0x40, 0x6c, 0xa0, 0xed, 0x15, 0x16, 0x96, 0x16, 0xf6, 0x92, 0xfc, 0xf0, 0x76, 0xf8,
    0x92, 0xdb, 0xdb, 0x2a, 0x70, 0x23, 0xb8, 0x52, 0xf0, 0xd4, 0x77, 0x19, 0xc3, 0x90, 0x01, 0x7b,
];
pub const PEARL_SEED_SALT_B: [u8; 32] = [
    0x11, 0x30, 0x06, 0x32, 0xec, 0x63, 0x01, 0xca, 0x2b, 0xe2, 0xaf, 0x71, 0x8b, 0x3f, 0x4d, 0x4f,
    0x1a, 0xe9, 0xc6, 0x39, 0x88, 0xe8, 0xcc, 0x04, 0x48, 0x44, 0x30, 0x1d, 0x71, 0xb8, 0x9a, 0xa9,
];
const SEED_LABEL_A: [u8; 32] = [
    b'A', b'_', b't', b'e', b'n', b's', b'o', b'r', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
];
const SEED_LABEL_B: [u8; 32] = [
    b'B', b'_', b't', b'e', b'n', b's', b'o', b'r', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
];

// ============================================================================
// Mining job (gateway getMiningInfo)
// ============================================================================

/// Pearl mining job as served by `pearl-gateway` `getMiningInfo`
/// (`{"incomplete_header_bytes": b64, "target": int, "cert_version": int}`).
#[derive(Debug, Clone)]
pub struct PearlJob {
    /// 76-byte serialized IncompleteBlockHeader.
    pub header: [u8; 76],
    /// Block target as arbitrary-precision integer (JSON number, U256 range).
    pub target: BigUint,
    pub cert_version: u32,
    /// Original base64 of the header — echoed back inside `mining_job` on
    /// submit so the gateway can match the template.
    pub header_b64: String,
    /// Original decimal string of `target` (echoed back verbatim).
    pub target_dec: String,
}

impl PearlJob {
    pub fn from_rpc_result(v: &serde_json::Value) -> Result<Self> {
        use base64::Engine;
        let header_b64 = v
            .get("incomplete_header_bytes")
            .and_then(|x| x.as_str())
            .context("getMiningInfo: missing incomplete_header_bytes")?
            .to_string();
        let header_bytes = base64::engine::general_purpose::STANDARD
            .decode(&header_b64)
            .context("getMiningInfo: bad base64 header")?;
        ensure!(
            header_bytes.len() == 76,
            "getMiningInfo: header {} bytes, expected 76",
            header_bytes.len()
        );
        let (target, target_dec) = match v.get("target") {
            // Gateway sends a bare JSON number; `rpc_raw` rewrites U256-range
            // values to strings so digits survive serde_json::Number's f64 path.
            Some(serde_json::Value::String(s)) => (
                s.parse::<BigUint>().context("getMiningInfo: bad target")?,
                s.clone(),
            ),
            Some(serde_json::Value::Number(n)) => {
                let s = n.to_string();
                (
                    s.parse::<BigUint>().context("getMiningInfo: bad target")?,
                    s,
                )
            }
            other => bail!("getMiningInfo: missing/non-numeric target {other:?}"),
        };
        let cert_version = v
            .get("cert_version")
            .and_then(|x| x.as_u64())
            .context("getMiningInfo: missing cert_version")? as u32;
        ensure!(
            (1..=3).contains(&cert_version),
            "getMiningInfo: cert_version {cert_version} unsupported"
        );
        Ok(Self {
            header: header_bytes.try_into().unwrap(),
            target,
            cert_version,
            header_b64,
            target_dec,
        })
    }
}

// ============================================================================
// Bincode decode — PlainProof
// ============================================================================

struct Cursor<'a> {
    b: &'a [u8],
    pos: usize,
}

impl<'a> Cursor<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8]> {
        ensure!(
            self.b.len() - self.pos >= n,
            "bincode: need {n} bytes at {}, have {}",
            self.pos,
            self.b.len() - self.pos
        );
        let s = &self.b[self.pos..self.pos + n];
        self.pos += n;
        Ok(s)
    }
    fn u8(&mut self) -> Result<u8> {
        Ok(self.take(1)?[0])
    }
    /// bincode fixint: `usize` and Vec lengths serialize as u64 LE.
    fn u64(&mut self) -> Result<u64> {
        Ok(u64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }
    fn usize(&mut self) -> Result<usize> {
        usize::try_from(self.u64()?).context("bincode: usize overflows")
    }
    fn vec_usize(&mut self) -> Result<Vec<usize>> {
        let n = self.usize()?;
        ensure!(n <= 1 << 24, "bincode: vec len {n} absurd");
        (0..n).map(|_| self.usize()).collect()
    }
}

#[derive(Debug, Clone)]
pub struct PearlMerkleProof {
    pub leaf_data: Vec<[u8; PEARL_CHUNK_LEN]>,
    pub leaf_indices: Vec<usize>,
    pub total_leaves: usize,
    pub root: [u8; 32],
    pub siblings: Vec<[u8; 32]>,
}

#[derive(Debug, Clone)]
pub struct PearlMatrixProof {
    pub proof: PearlMerkleProof,
    /// Row indices (of A) / column indices (of B^T) this proof covers.
    pub row_indices: Vec<usize>,
}

/// Decoded dense (non-MoE) `PlainProof`.
#[derive(Debug, Clone)]
pub struct PearlPlainProof {
    pub m: usize,
    pub n: usize,
    pub k: usize,
    pub noise_rank: usize,
    pub a: PearlMatrixProof,
    pub bt: PearlMatrixProof,
}

fn decode_merkle_proof(c: &mut Cursor) -> Result<PearlMerkleProof> {
    // leaf_data: Vec<&[u8]> — u64 count, then per element u64 len + bytes
    let leaf_count = c.usize()?;
    ensure!(leaf_count <= 1 << 20, "bincode: leaf_data len {leaf_count}");
    let mut leaf_data = Vec::with_capacity(leaf_count);
    for _ in 0..leaf_count {
        let len = c.usize()?;
        ensure!(len == PEARL_CHUNK_LEN, "bincode: leaf chunk len {len}");
        leaf_data.push(c.take(PEARL_CHUNK_LEN)?.try_into().unwrap());
    }
    let leaf_indices = c.vec_usize()?;
    let total_leaves = c.usize()?;
    let root: [u8; 32] = c.take(32)?.try_into().unwrap();
    let sib_count = c.usize()?;
    ensure!(sib_count <= 1 << 16, "bincode: siblings len {sib_count}");
    let mut siblings = Vec::with_capacity(sib_count);
    for _ in 0..sib_count {
        siblings.push(c.take(32)?.try_into().unwrap());
    }
    Ok(PearlMerkleProof {
        leaf_data,
        leaf_indices,
        total_leaves,
        root,
        siblings,
    })
}

fn decode_matrix_proof(c: &mut Cursor) -> Result<PearlMatrixProof> {
    let proof = decode_merkle_proof(c)?;
    let row_indices = c.vec_usize()?;
    Ok(PearlMatrixProof {
        proof,
        row_indices,
    })
}

/// Decode `PlainProof` from raw bincode bytes (fixint encoding).
/// Mirrors upstream `deserialize_compat`: if the trailing `moe` Option tag is
/// absent the proof is the legacy V1 layout (dense).
pub fn decode_plain_proof(bytes: &[u8]) -> Result<PearlPlainProof> {
    let mut c = Cursor { b: bytes, pos: 0 };
    let m = c.usize()?;
    let n = c.usize()?;
    let k = c.usize()?;
    let noise_rank = c.usize()?;
    let a = decode_matrix_proof(&mut c)?;
    let bt = decode_matrix_proof(&mut c)?;
    let moe_tag = if c.pos < bytes.len() { c.u8()? } else { 0 };
    ensure!(
        moe_tag == 0,
        "MoE proofs not supported by pool verifier (tag {moe_tag})"
    );
    ensure!(
        c.pos == bytes.len(),
        "bincode: {} trailing bytes",
        bytes.len() - c.pos
    );
    Ok(PearlPlainProof {
        m,
        n,
        k,
        noise_rank,
        a,
        bt,
    })
}

// ============================================================================
// Keyed BLAKE3 helpers (pearl-blake3 Blake3Hasher port)
// ============================================================================

fn chunk_cv(data: &[u8; PEARL_CHUNK_LEN], chunk_index: u64, key: &[u8; 32]) -> [u8; 32] {
    blake3::Hasher::new_keyed(key)
        .set_input_offset(chunk_index * PEARL_CHUNK_LEN as u64)
        .update(data)
        .finalize_non_root()
}

fn parent_cv(left: &[u8; 32], right: &[u8; 32], key: &[u8; 32]) -> [u8; 32] {
    merge_subtrees_non_root(left, right, Mode::KeyedHash(key))
}

fn root_cv(left: &[u8; 32], right: &[u8; 32], key: &[u8; 32]) -> [u8; 32] {
    *merge_subtrees_root(left, right, Mode::KeyedHash(key)).as_bytes()
}

/// Port of `MerkleProof::compute_root` — rebuild the root from proved leaves
/// and sibling CVs. Returns `None` on malformed proofs.
fn merkle_compute_root(p: &PearlMerkleProof, key: &[u8; 32]) -> Option<[u8; 32]> {
    use std::collections::BTreeMap;
    if p.leaf_indices.is_empty() || p.leaf_indices.len() != p.leaf_data.len() {
        return None;
    }
    let leaf_hashes: Vec<[u8; 32]> = p
        .leaf_indices
        .iter()
        .zip(&p.leaf_data)
        .map(|(&i, d)| chunk_cv(d, i as u64, key))
        .collect();
    let mut current: BTreeMap<usize, [u8; 32]> =
        p.leaf_indices.iter().copied().zip(leaf_hashes).collect();
    let mut level_len = p.total_leaves;
    if level_len == 1 {
        return if p.siblings.is_empty() {
            current.get(&0).copied()
        } else {
            None
        };
    }
    let mut sib = p.siblings.iter();
    while level_len > 2 {
        let mut next: BTreeMap<usize, [u8; 32]> = BTreeMap::new();
        for (&i, &cv) in &current {
            if i % 2 == 0 {
                let right = if let Some(&r) = current.get(&(i + 1)) {
                    Some(r)
                } else if i + 1 < level_len {
                    Some(*sib.next()?)
                } else {
                    None
                };
                next.insert(i / 2, right.map_or(cv, |r| parent_cv(&cv, &r, key)));
            } else if !current.contains_key(&(i - 1)) {
                next.insert(i / 2, parent_cv(sib.next()?, &cv, key));
            }
        }
        current = next;
        level_len = level_len.div_ceil(2);
    }
    let left = match current.get(&0) {
        Some(&v) => v,
        None => *sib.next()?,
    };
    let right = match current.get(&1) {
        Some(&v) => v,
        None => *sib.next()?,
    };
    if sib.next().is_some() {
        return None;
    }
    Some(root_cv(&left, &right, key))
}

// ============================================================================
// PeriodicPattern (proof_utils.rs port — only what verification needs)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct PeriodicPattern {
    shape: [(u32, u32); 3],
}

impl PeriodicPattern {
    fn to_bytes(&self) -> [u8; 6] {
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

    fn size(&self) -> u32 {
        self.shape.iter().map(|&(_, l)| l).product()
    }

    /// `offset_is_valid` — offset folds into each (stride, length) dim and
    /// must land < stride.
    fn offset_is_valid(&self, mut offset: u32) -> bool {
        for &(stride, length) in self.shape.iter().rev() {
            offset %= stride * length;
            if offset >= stride {
                return false;
            }
        }
        true
    }

    /// `from_list` — indices must be sorted-unique and start at 0.
    fn from_list(pattern: &[u32]) -> Result<Self> {
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
        // `is_valid` = roundtrips through 6-byte serialization (factor-1 and
        // length-1 must fit u8, first factor == stride since min_stride=1).
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

/// `list_to_pattern`: normalized pattern + offset from absolute indices.
fn list_to_pattern(indices: &[usize]) -> Result<(PeriodicPattern, u32)> {
    ensure!(!indices.is_empty(), "empty indices");
    let idx: Vec<u32> = indices
        .iter()
        .map(|&x| u32::try_from(x).context("index exceeds u32"))
        .collect::<Result<_>>()?;
    ensure!(
        idx.windows(2).all(|w| w[0] < w[1]),
        "indices not strictly increasing"
    );
    let offset = idx[0];
    let normalized: Vec<u32> = idx.iter().map(|&i| i - offset).collect();
    let pattern = PeriodicPattern::from_list(&normalized)?;
    ensure!(
        pattern.offset_is_valid(offset),
        "offset {offset} not valid for pattern"
    );
    Ok((pattern, offset))
}

// ============================================================================
// Noise (pearl_noise.rs port, row-subset variant)
// ============================================================================

fn get_random_hash(index: usize, seed: &[u8; 32], key: &[u8; 32], prepend_index: usize) -> [u8; 32] {
    let mut msg = [0u8; 64];
    let pv = (1 + index) as i32;
    msg[prepend_index * 4..prepend_index * 4 + 4].copy_from_slice(&pv.to_le_bytes());
    msg[32..].copy_from_slice(seed);
    *blake3::keyed_hash(key, &msg).as_bytes()
}

/// Uniform noise element `(byte & 63) - 32` at flat row-major index `idx`.
fn uniform_at(idx: usize, seed: &[u8; 32], key: &[u8; 32]) -> i8 {
    let h = get_random_hash(idx / 32, seed, key, 0);
    ((h[idx % 32] & 63) as i8).wrapping_sub(32)
}

/// Sparse permutation pair for row `l`: `(first, second)` into `0..rank`.
fn perm_pair(l: usize, rank: usize, seed: &[u8; 32], key: &[u8; 32]) -> (u32, u32) {
    let h = get_random_hash(l / 8, seed, key, 1);
    let u = u32::from_le_bytes([
        h[(l % 8) * 4],
        h[(l % 8) * 4 + 1],
        h[(l % 8) * 4 + 2],
        h[(l % 8) * 4 + 3],
    ]);
    let mask = (rank - 1) as u32;
    let first = u & mask;
    let second = first ^ (1u32 + (((rank as u64 - 1) * u as u64) >> 32) as u32);
    (first, second)
}

// ============================================================================
// Share verification
// ============================================================================

/// What a successfully verified share proves.
#[derive(Debug)]
pub struct PearlShareOutcome {
    /// The recomputed jackpot hash (little-endian U256 for comparisons).
    pub jackpot_hash: [u8; 32],
    /// Penalized factor applied to targets (`tile_size * (dpl/rank) * 128`).
    pub adjustment_factor: BigUint,
    /// True when jackpot ≤ block bound (candidate for gateway forward).
    pub is_block: bool,
}

fn expected_leaves(dims: &[usize]) -> Result<usize> {
    let bytes = dims
        .iter()
        .try_fold(1usize, |acc, &d| acc.checked_mul(d))
        .context("dimension product overflows usize")?;
    Ok(bytes.div_ceil(PEARL_CHUNK_LEN))
}

/// Verify a `PearlSubmit` share end-to-end.
///
/// * `proof` — decoded `PlainProof` (dense only).
/// * `job` — the mining job the proof was mined against.
/// * `share_target` — pool share target (U256); the jackpot must satisfy
///   `U256::from_little_endian(hash) <= share_target * adjustment_factor`.
///
/// Mirrors upstream `sanity_checks::check_rank_penalty` +
/// `PlainProof` → public-params reconstruction (`check_declared_tree_sizes`,
/// `commitment_hash`, noise application, jackpot transcript).
pub fn verify_pearl_share(
    proof: &PearlPlainProof,
    job: &PearlJob,
    share_target: &BigUint,
) -> Result<PearlShareOutcome> {
    let (m, n, k, rank) = (proof.m, proof.n, proof.k, proof.noise_rank);
    ensure!(m > 0 && n > 0 && k > 0, "degenerate matrix dims");
    ensure!(rank >= PENALTY_BASE_RANK, "rank {rank} < {PENALTY_BASE_RANK}");
    ensure!(
        rank.is_power_of_two() && rank % 32 == 0,
        "rank {rank} must be a power of two divisible by 32"
    );
    ensure!(k % rank == 0, "k {k} not divisible by rank {rank}");

    // Declared tree sizes bind m/k/n (V3 salt makes them consensus-critical).
    ensure!(
        proof.a.proof.total_leaves == expected_leaves(&[m, k])?,
        "A tree leaf count mismatch"
    );
    ensure!(
        proof.bt.proof.total_leaves == expected_leaves(&[n, k])?,
        "B tree leaf count mismatch"
    );

    // Recover config patterns from the proved tile indices.
    let (rows_pattern, _) = list_to_pattern(&proof.a.row_indices)?;
    let (cols_pattern, _) = list_to_pattern(&proof.bt.row_indices)?;
    ensure!(
        proof.a.row_indices.len() == rows_pattern.size() as usize
            && proof.bt.row_indices.len() == cols_pattern.size() as usize,
        "tile dims do not match pattern sizes"
    );
    ensure!(
        proof.a.row_indices.iter().all(|&r| r < m),
        "A row index out of bounds"
    );
    ensure!(
        proof.bt.row_indices.iter().all(|&c| c < n),
        "B col index out of bounds"
    );

    // MiningConfiguration.to_bytes(): k(4) | rank(2) | mma(2) | rows(6) | cols(6) | 32z
    let mut cfg = [0u8; 52];
    cfg[0..4].copy_from_slice(&(k as u32).to_le_bytes());
    cfg[4..6].copy_from_slice(&(rank as u16).to_le_bytes());
    // mma_type = 0 (Int7xInt7ToInt32)
    cfg[8..14].copy_from_slice(&rows_pattern.to_bytes());
    cfg[14..20].copy_from_slice(&cols_pattern.to_bytes());

    let mut job_input = Vec::with_capacity(128);
    job_input.extend_from_slice(&job.header);
    job_input.extend_from_slice(&cfg);
    let job_key = *blake3::hash(&job_input).as_bytes();

    // Merkle proofs → hash_a / hash_b (roots bind the committed matrices).
    let hash_a = merkle_compute_root(&proof.a.proof, &job_key)
        .context("A merkle proof malformed")?;
    ensure!(
        hash_a == proof.a.proof.root,
        "A merkle root mismatch (invalid proof)"
    );
    let hash_b = merkle_compute_root(&proof.bt.proof, &job_key)
        .context("B merkle proof malformed")?;
    ensure!(
        hash_b == proof.bt.proof.root,
        "B merkle root mismatch (invalid proof)"
    );

    // Seed chain — V3 salted bind, pre-V3 legacy.
    let (bound_a, bound_b) = if job.cert_version >= 3 {
        let mut ma = [0u8; 64];
        ma[..32].copy_from_slice(&hash_a);
        ma[32..36].copy_from_slice(&(m as u32).to_le_bytes());
        let mut mb = [0u8; 64];
        mb[..32].copy_from_slice(&hash_b);
        mb[32..36].copy_from_slice(&(n as u32).to_le_bytes());
        (
            *blake3::keyed_hash(&PEARL_SEED_SALT_A, &ma).as_bytes(),
            *blake3::keyed_hash(&PEARL_SEED_SALT_B, &mb).as_bytes(),
        )
    } else {
        (hash_a, hash_b)
    };
    let mut msg = [0u8; 64];
    msg[..32].copy_from_slice(&job_key);
    msg[32..].copy_from_slice(&bound_b);
    let b_seed = *blake3::hash(&msg).as_bytes();
    msg[..32].copy_from_slice(&b_seed);
    msg[32..].copy_from_slice(&bound_a);
    let a_seed = *blake3::hash(&msg).as_bytes();

    // Strips: extract proved rows/cols from leaf data.
    let strip = |p: &PearlMerkleProof, idx: usize| -> Result<Vec<i8>> {
        let start = idx
            .checked_mul(k)
            .context("strip offset overflow")?;
        let end = start + k;
        let mut out = vec![0u8; k];
        let mut copied = 0usize;
        for (&li, data) in p.leaf_indices.iter().zip(&p.leaf_data) {
            let ls = li * PEARL_CHUNK_LEN;
            let le = ls + PEARL_CHUNK_LEN;
            if ls < end && start < le {
                let cs = start.max(ls);
                let ce = end.min(le);
                out[cs - start..ce - start].copy_from_slice(&data[cs - ls..ce - ls]);
                copied += ce - cs;
            }
        }
        ensure!(copied == k, "strip bytes not covered by leaves");
        Ok(out.into_iter().map(|x| x as i8).collect())
    };
    let s_a: Vec<Vec<i8>> = proof
        .a
        .row_indices
        .iter()
        .map(|&r| strip(&proof.a.proof, r))
        .collect::<Result<_>>()?;
    let s_b: Vec<Vec<i8>> = proof
        .bt
        .row_indices
        .iter()
        .map(|&r| strip(&proof.bt.proof, r))
        .collect::<Result<_>>()?;

    // Noise (E_AL/E_AR for A rows, E_BL/E_BR for B cols) — sparse matvec.
    let noise_rows = |row_idx: usize, l: usize, seed_label: &[u8; 32], seed: &[u8; 32]| -> i32 {
        let (f, s) = perm_pair(l, rank, seed_label, seed);
        let e = |c: u32| uniform_at(row_idx * rank + c as usize, seed_label, seed) as i32;
        e(f) - e(s)
    };
    let a_n: Vec<Vec<i32>> = proof
        .a
        .row_indices
        .iter()
        .enumerate()
        .map(|(u, &row)| {
            (0..k)
                .map(|l| s_a[u][l] as i32 + noise_rows(row, l, &SEED_LABEL_A, &a_seed))
                .collect()
        })
        .collect();
    let b_n: Vec<Vec<i32>> = proof
        .bt
        .row_indices
        .iter()
        .enumerate()
        .map(|(v, &col)| {
            (0..k)
                .map(|l| s_b[v][l] as i32 + noise_rows(col, l, &SEED_LABEL_B, &b_seed))
                .collect()
        })
        .collect();

    // Jackpot transcript (mine.rs): tile accumulates partial dot products per
    // rank-window, each window XOR-folds into a rotated slot.
    let (h, w) = (a_n.len(), b_n.len());
    let mut tile = vec![vec![0i32; w]; h];
    let mut jackpot = [0u32; JACKPOT_SIZE];
    let mut ll = rank;
    while ll <= k {
        for u in 0..h {
            for v in 0..w {
                tile[u][v] += (ll - rank..ll).map(|l| a_n[u][l] * b_n[v][l]).sum::<i32>();
            }
        }
        let xored = tile.iter().flatten().fold(0u32, |acc, &x| acc ^ x as u32);
        let tid = (ll / rank - 1) % JACKPOT_SIZE;
        jackpot[tid] = jackpot[tid].rotate_left(LROT_PER_TILE) ^ xored;
        ll += rank;
    }
    let mut jmsg = [0u8; 64];
    for (i, word) in jackpot.iter().enumerate() {
        jmsg[i * 4..i * 4 + 4].copy_from_slice(&word.to_le_bytes());
    }
    let jackpot_hash = *blake3::keyed_hash(&a_seed, &jmsg).as_bytes();

    // Penalized bound (sanity_checks::penalized_target_bound):
    //   bound = target * tile_size * (dpl/rank) * PENALTY_BASE_RANK
    let dpl = k - k % rank;
    let factor = BigUint::from((h * w) as u64)
        * BigUint::from((dpl / rank) as u64)
        * BigUint::from(PENALTY_BASE_RANK as u64);
    let share_bound = share_target * &factor;
    let block_bound = &job.target * &factor;
    let hash_int = BigUint::from_bytes_le(&jackpot_hash);
    ensure!(
        hash_int <= share_bound,
        "jackpot hash above share bound"
    );

    Ok(PearlShareOutcome {
        jackpot_hash,
        adjustment_factor: factor,
        is_block: hash_int <= block_bound,
    })
}

// ============================================================================
// Tests — generate a real dense proof, verify it, then break it.
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;

    /// Deterministic INT7 matrix bytes (`(i*7+3) % 129 - 64`).
    fn gen_matrix(elems: usize) -> Vec<i8> {
        (0..elems)
            .map(|i| ((i * 7 + 3) % 129) as i32 - 64)
            .map(|x| x as i8)
            .collect()
    }

    /// Build the keyed Merkle layers (pearl-blake3 MerkleTree) over padded data.
    fn tree_layers(data: &[u8], key: &[u8; 32]) -> Vec<Vec<[u8; 32]>> {
        let mut padded = data.to_vec();
        padded.resize(data.len().div_ceil(PEARL_CHUNK_LEN) * PEARL_CHUNK_LEN, 0);
        let chunks: Vec<[u8; 32]> = padded
            .chunks_exact(PEARL_CHUNK_LEN)
            .enumerate()
            .map(|(i, c)| chunk_cv(c.try_into().unwrap(), i as u64, key))
            .collect();
        let mut layers = vec![chunks];
        while layers.last().unwrap().len() > 2 {
            let prev = layers.last().unwrap();
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
        let last = layers.last().unwrap();
        if last.len() == 2 {
            layers.push(vec![root_cv(&last[0], &last[1], key)]);
        }
        layers
    }

    /// `MerkleTree::get_multileaf_proof` port.
    fn multileaf_proof(
        data: &[u8],
        key: &[u8; 32],
        leaf_indices: &[usize],
    ) -> PearlMerkleProof {
        let layers = tree_layers(data, key);
        let total_leaves = layers[0].len();
        let mut unique: std::collections::BTreeSet<usize> = leaf_indices.iter().copied().collect();
        assert!(*unique.iter().next_back().unwrap() < total_leaves);
        let sorted: Vec<usize> = unique.iter().copied().collect();
        let mut padded = data.to_vec();
        padded.resize(data.len().div_ceil(PEARL_CHUNK_LEN) * PEARL_CHUNK_LEN, 0);
        let leaf_data: Vec<[u8; PEARL_CHUNK_LEN]> = sorted
            .iter()
            .map(|&i| padded[i * PEARL_CHUNK_LEN..(i + 1) * PEARL_CHUNK_LEN].try_into().unwrap())
            .collect();
        let mut siblings = Vec::new();
        let mut level_len = total_leaves;
        let mut level = 0;
        while level_len > 1 && !unique.is_empty() {
            let nodes = &layers[level];
            for &i in unique.iter() {
                if i % 2 == 1 {
                    if !unique.contains(&(i - 1)) {
                        siblings.push(nodes[i - 1]);
                    }
                } else if !unique.contains(&(i + 1)) && i + 1 < level_len {
                    siblings.push(nodes[i + 1]);
                }
            }
            unique = unique.iter().map(|&i| i / 2).collect();
            level_len = level_len.div_ceil(2);
            level += 1;
        }
        PearlMerkleProof {
            leaf_data,
            leaf_indices: sorted,
            total_leaves,
            root: *layers.last().unwrap().last().unwrap(),
            siblings,
        }
    }

    /// Leaf indices covering matrix rows (compute_leaf_indices_from_rows).
    fn leaf_indices_for_rows(rows: &[usize], cols: usize) -> Vec<usize> {
        let mut set = std::collections::BTreeSet::new();
        for &r in rows {
            let first = (r * cols) / PEARL_CHUNK_LEN;
            let last = ((r + 1) * cols - 1) / PEARL_CHUNK_LEN;
            for i in first..=last {
                set.insert(i);
            }
        }
        set.into_iter().collect()
    }

    /// bincode-encode a dense PlainProof (mirrors `decode_plain_proof`).
    fn encode_proof(p: &PearlPlainProof) -> Vec<u8> {
        let mut out = Vec::new();
        let put = |out: &mut Vec<u8>, v: usize| out.extend_from_slice(&(v as u64).to_le_bytes());
        let mp = |out: &mut Vec<u8>, m: &PearlMatrixProof| {
            put(out, m.proof.leaf_data.len());
            for d in &m.proof.leaf_data {
                out.extend_from_slice(&(d.len() as u64).to_le_bytes());
                out.extend_from_slice(d);
            }
            put(out, m.proof.leaf_indices.len());
            for &i in &m.proof.leaf_indices {
                put(out, i);
            }
            put(out, m.proof.total_leaves);
            out.extend_from_slice(&m.proof.root);
            put(out, m.proof.siblings.len());
            for s in &m.proof.siblings {
                out.extend_from_slice(s);
            }
            put(out, m.row_indices.len());
            for &r in &m.row_indices {
                put(out, r);
            }
        };
        put(&mut out, p.m);
        put(&mut out, p.n);
        put(&mut out, p.k);
        put(&mut out, p.noise_rank);
        mp(&mut out, &p.a);
        mp(&mut out, &p.b_t());
        out.push(0); // moe = None
        out
    }

    impl PearlPlainProof {
        fn b_t(&self) -> &PearlMatrixProof {
            &self.bt
        }
    }

    /// Build a fully valid dense proof for `job` with our deterministic
    /// matrices. Returns (proof_bytes, bincode PearlPlainProof, job_key).
    fn make_proof(
        m: usize,
        n: usize,
        k: usize,
        rank: usize,
        a_rows: &[usize],
        b_cols: &[usize],
        job: &PearlJob,
    ) -> (Vec<u8>, PearlPlainProof) {
        let a = gen_matrix(m * k);
        let bt = gen_matrix(n * k).iter().map(|&x| x.wrapping_add(7)).collect::<Vec<_>>();
        let a_bytes: Vec<u8> = a.iter().map(|&x| x as u8).collect();
        let bt_bytes: Vec<u8> = bt.iter().map(|&x| x as u8).collect();

        // job_key from the same config the verifier will rebuild.
        let (rows_pattern, _) = list_to_pattern(a_rows).unwrap();
        let (cols_pattern, _) = list_to_pattern(b_cols).unwrap();
        let mut cfg = [0u8; 52];
        cfg[0..4].copy_from_slice(&(k as u32).to_le_bytes());
        cfg[4..6].copy_from_slice(&(rank as u16).to_le_bytes());
        cfg[8..14].copy_from_slice(&rows_pattern.to_bytes());
        cfg[14..20].copy_from_slice(&cols_pattern.to_bytes());
        let mut job_input = Vec::with_capacity(128);
        job_input.extend_from_slice(&job.header);
        job_input.extend_from_slice(&cfg);
        let job_key = *blake3::hash(&job_input).as_bytes();

        let a_leaves = leaf_indices_for_rows(a_rows, k);
        let b_leaves = leaf_indices_for_rows(b_cols, k);
        let proof = PearlPlainProof {
            m,
            n,
            k,
            noise_rank: rank,
            a: PearlMatrixProof {
                proof: multileaf_proof(&a_bytes, &job_key, &a_leaves),
                row_indices: a_rows.to_vec(),
            },
            bt: PearlMatrixProof {
                proof: multileaf_proof(&bt_bytes, &job_key, &b_leaves),
                row_indices: b_cols.to_vec(),
            },
        };
        (encode_proof(&proof), proof)
    }

    fn test_job() -> PearlJob {
        let mut header = [0u8; 76];
        for (i, b) in header.iter_mut().enumerate() {
            *b = (i * 31 + 7) as u8;
        }
        PearlJob {
            header,
            // Huge block target so `is_block` is also exercised.
            target: BigUint::parse_bytes(b"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16).unwrap(),
            cert_version: 3,
            header_b64: base64::engine::general_purpose::STANDARD.encode(header),
            target_dec: String::new(),
        }
    }

    #[test]
    fn pearl_share_roundtrip_accepts_valid_proof() {
        let job = test_job();
        // m=16,k=128 → 2048 B A (2 chunks), n=16 → 2 chunks for B^T.
        let a_rows: Vec<usize> = (4..8).collect();
        let b_cols: Vec<usize> = (8..16).collect();
        let (bytes, proof) = make_proof(16, 16, 128, 128, &a_rows, &b_cols, &job);

        let decoded = decode_plain_proof(&bytes).unwrap();
        assert_eq!(decoded.m, 16);
        assert_eq!(decoded.a.row_indices, a_rows);
        assert_eq!(decoded.a.proof.total_leaves, 2);

        // Any share target ≥ hash works; compute the hash first via the
        // verifier itself by passing an enormous target.
        let huge = BigUint::parse_bytes(
            b"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            16,
        )
        .unwrap();
        let out = verify_pearl_share(&decoded, &job, &huge).unwrap();
        assert!(out.is_block);
        assert_eq!(
            out.adjustment_factor,
            BigUint::from(4u64 * 8) * BigUint::from(1u64) * BigUint::from(128u64)
        );
        drop(proof);
    }

    #[test]
    fn pearl_share_rejects_tampered_leaf() {
        let job = test_job();
        let a_rows: Vec<usize> = (4..8).collect();
        let b_cols: Vec<usize> = (8..16).collect();
        let (bytes, _proof) = make_proof(16, 16, 128, 128, &a_rows, &b_cols, &job);
        let mut decoded = decode_plain_proof(&bytes).unwrap();
        decoded.a.proof.leaf_data[0][5] ^= 0xff;
        let huge = BigUint::parse_bytes(
            b"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            16,
        )
        .unwrap();
        let err = verify_pearl_share(&decoded, &job, &huge).unwrap_err();
        assert!(
            err.to_string().contains("merkle root mismatch") || err.to_string().contains("merkle proof"),
            "unexpected error: {err}"
        );
    }

    #[test]
    fn pearl_share_rejects_low_share_target() {
        let job = test_job();
        let a_rows: Vec<usize> = (4..8).collect();
        let b_cols: Vec<usize> = (8..16).collect();
        let (bytes, _proof) = make_proof(16, 16, 128, 128, &a_rows, &b_cols, &job);
        let decoded = decode_plain_proof(&bytes).unwrap();
        let err = verify_pearl_share(&decoded, &job, &BigUint::from(0u64)).unwrap_err();
        assert!(err.to_string().contains("above share bound"));
    }

    #[test]
    fn pearl_miner_wire_proof_accepted() {
        // Cross-crate E2E: the MINER's production builder (`build_plain_proof`
        // + `encode_plain_proof`) must produce bytes the pool verifier
        // accepts — exercises the real wire path, not the test-local encoder.
        use zion_miner::auxpow::pearl as mp;

        let job = test_job();
        let cfg = mp::PearlMineConfig {
            m: 16,
            n: 16,
            k: 128,
            rank: 128,
            rows_pattern: mp::PeriodicPattern::from_list(&[0, 1, 2, 3]).unwrap(),
            cols_pattern: mp::PeriodicPattern::from_list(&[0, 1, 2, 3, 4, 5, 6, 7]).unwrap(),
        };
        // Single kernel tile at (row_off=4, col_off=8) → rows 4..8, cols 8..16.
        let row_offsets = [4u32];
        let col_offsets = [8u32];
        let job_key = cfg.job_key(&job.header);
        let a = gen_matrix(16 * 128);
        let bt = gen_matrix(16 * 128);
        // tile_index 0 = roi 0 × nco 0 — only tile.
        let bytes =
            mp::build_plain_proof(&cfg, &job_key, &a, &bt, 0, &row_offsets, &col_offsets)
                .unwrap();

        // Same wire shape as PearlSubmit: base64(bincode(PlainProof)).
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        let decoded = decode_plain_proof(
            &base64::engine::general_purpose::STANDARD
                .decode(&b64)
                .unwrap(),
        )
        .unwrap();
        assert_eq!(decoded.m, 16);
        assert_eq!(decoded.a.row_indices, vec![4, 5, 6, 7]);
        assert_eq!(decoded.bt.row_indices, vec![8, 9, 10, 11, 12, 13, 14, 15]);

        let huge = BigUint::parse_bytes(
            b"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            16,
        )
        .unwrap();
        let out = verify_pearl_share(&decoded, &job, &huge).unwrap();
        assert!(out.is_block);
    }

    #[test]
    fn pearl_job_parses_gateway_response() {
        let header = [0xABu8; 76];
        let b64 = base64::engine::general_purpose::STANDARD.encode(header);
        let v = serde_json::json!({
            "incomplete_header_bytes": b64,
            "target": 123456789u64,
            "cert_version": 3,
        });
        let job = PearlJob::from_rpc_result(&v).unwrap();
        assert_eq!(job.header, header);
        assert_eq!(job.target, BigUint::from(123456789u64));
        assert_eq!(job.cert_version, 3);
        assert_eq!(job.header_b64, b64);
        assert_eq!(job.target_dec, "123456789");
    }

    #[test]
    fn pearl_job_parses_u256_string_target() {
        // U256 range target arrives as a string (rewritten by quote_target_digits
        // upstream of serde_json parse) — must survive with all digits intact.
        let header = [0x11u8; 76];
        let b64 = base64::engine::general_purpose::STANDARD.encode(header);
        let dec = "411369862228566123857978459849914418579267864052950501802639360";
        let v = serde_json::json!({
            "incomplete_header_bytes": b64,
            "target": dec,
            "cert_version": 1,
        });
        let job = PearlJob::from_rpc_result(&v).unwrap();
        assert_eq!(job.target.to_str_radix(10), dec);
        assert_eq!(job.target_dec, dec);
        assert_eq!(job.cert_version, 1);
    }
}
