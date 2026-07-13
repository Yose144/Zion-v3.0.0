//! External hashers — hash functions for external coins.
//!
//! These are standalone implementations of the PoW algorithms used by
//! external coins that the ZION pool can profit-switch to.
//!
//! Currently implemented (pure Rust):
//!   - `blake3`      — for Decred (DCR) and Alephium (ALPH)
//!   - `kheavyhash`  — for Kaspa (KAS)
//!   - `autolykos`   — for Ergo (ERG) — simplified, needs native-hashers for full speed
//!
//! Requires `native-hashers` feature (C FFI):
//!   - `kawpow`      — for RVN, CLORE (needs DAG)
//!   - `ethash`      — for ETC (needs DAG)
//!   - `randomx`     — for XMR (needs RandomX VM)

use blake3::Hasher as Blake3Hasher;

/// Algorithm identifier for external hashing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ExternalAlgorithm {
    Blake3,
    KHeavyHash,
    Autolykos,
    KawPow,
    Ethash,
    RandomX,
}

impl ExternalAlgorithm {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Blake3 => "blake3",
            Self::KHeavyHash => "kheavyhash",
            Self::Autolykos => "autolykos",
            Self::KawPow => "kawpow",
            Self::Ethash => "ethash",
            Self::RandomX => "randomx",
        }
    }

    pub fn from_str_loose(s: &str) -> Option<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "blake3" => Some(Self::Blake3),
            "kheavyhash" | "kheavy" => Some(Self::KHeavyHash),
            "autolykos" => Some(Self::Autolykos),
            "kawpow" => Some(Self::KawPow),
            "ethash" | "etchash" => Some(Self::Ethash),
            "randomx" => Some(Self::RandomX),
            _ => None,
        }
    }
}

// ── Blake3 ───────────────────────────────────────────────────────────

/// DCR Blake3 nonce offset within the 180-byte block header.
/// The nonce is a 4-byte little-endian value at offset 140.
pub const DCR_NONCE_OFFSET: usize = 140;
/// DCR full header size (180 bytes).
pub const DCR_HEADER_SIZE: usize = 180;
/// DCR nonce field size (4 bytes).
pub const DCR_NONCE_SIZE: usize = 4;

/// Compute Blake3 hash for DCR (DCP-0011).
///
/// Decred uses Blake3 over the **full 180-byte block header**.  The pool sends
/// a 144-byte header template (header without the 36-byte extra-data suffix).
/// The nonce is a 4-byte LE value at offset 140 within the header.
///
/// This function:
///   1. Copies the pool-provided header (≥144 bytes)
///   2. Overwrites bytes [140..144] with the 4-byte LE nonce
///   3. Pads to 180 bytes with zeros (extra data)
///   4. Hashes the full 180-byte header with Blake3
///
/// # Arguments
/// * `header` — Pool-provided header template (≥140 bytes, typically 144)
/// * `_timestamp` — Unused for Blake3
/// * `nonce`  — Nonce value (only lower 32 bits used)
///
/// # Returns
/// 32-byte Blake3 digest.
pub fn hash_blake3(header: &[u8], _timestamp: u64, nonce: u64) -> [u8; 32] {
    let mut full_header = vec![0u8; DCR_HEADER_SIZE];
    let copy_len = header.len().min(DCR_HEADER_SIZE);
    full_header[..copy_len].copy_from_slice(&header[..copy_len]);
    // Insert 4-byte LE nonce at offset 140
    let nonce_bytes = (nonce as u32).to_le_bytes();
    full_header[DCR_NONCE_OFFSET..DCR_NONCE_OFFSET + DCR_NONCE_SIZE]
        .copy_from_slice(&nonce_bytes);
    blake3::hash(&full_header).into()
}

/// Blake3 hash of arbitrary bytes (no nonce appended).
pub fn hash_blake3_raw(input: &[u8]) -> [u8; 32] {
    let mut hasher = Blake3Hasher::new();
    hasher.update(input);
    *hasher.finalize().as_bytes()
}

/// Alephium-specific double-Blake3 PoW.
///
/// Alephium block headers serialize with a 24-byte nonce at the front.  The
/// pool sends `headerBlob` (header without nonce) and an `extranonce1`.  The
/// full 24-byte nonce is the 64-bit candidate value (which includes the
/// extranonce1 as its base) written big-endian at the front, followed by
/// zeros.  The PoW hash is `blake3(blake3(nonce || header_blob))`.
///
/// This matches the luminousmining / WoolyPooly Blake3 implementation where
/// the candidate is `extranonce1_base + nonce` and the search value occupies
/// the first 8 bytes of the 24-byte nonce in big-endian order.
pub fn hash_blake3_alph(header_blob: &[u8], extranonce1: &[u8], nonce: u64) -> [u8; 32] {
    let mut base_bytes = [0u8; 8];
    let en1_len = extranonce1.len().min(8);
    // extranonce1 is interpreted as a big-endian integer and placed at the
    // low end of the 64-bit base (left-padded with zeros).
    base_bytes[8 - en1_len..].copy_from_slice(&extranonce1[..en1_len]);
    let base = u64::from_be_bytes(base_bytes);
    let candidate = base.wrapping_add(nonce);

    let mut full_nonce = [0u8; 24];
    full_nonce[..8].copy_from_slice(&candidate.to_be_bytes());

    let mut inner_input = Vec::with_capacity(24 + header_blob.len());
    inner_input.extend_from_slice(&full_nonce);
    inner_input.extend_from_slice(header_blob);
    let inner_hash = blake3::hash(&inner_input);
    *blake3::hash(inner_hash.as_bytes()).as_bytes()
}

// ── kHeavyHash (Kaspa) ───────────────────────────────────────────────

/// Compute kHeavyHash — Kaspa's PoW algorithm.
///
/// Uses the official Kaspa reference implementation from `kaspa-hashes`:
/// ```text
/// pow_hash = PowHash(pre_pow_hash, timestamp).finalize_with_nonce(nonce)
/// heavy_hash = KHeavyHash(pow_hash)
/// ```
///
/// # Arguments
/// * `pre_pow_hash` — 32-byte pre-pow hash from the pool's `mining.notify`
/// * `timestamp` — Block timestamp (Unix seconds from `ntime`)
/// * `nonce` — 64-bit nonce
///
/// # Returns
/// 32-byte kHeavyHash digest.
///
/// # Algorithm (Kaspa reference)
/// 1. **PowHash** = cSHAKE256("ProofOfWorkHash")(pre_pow_hash ‖ timestamp ‖ 32 zero bytes ‖ nonce)
/// 2. **Matrix step**: expand PowHash to 64 nibbles, multiply by the fixed 64×64
///    matrix (4-bit entries, generated from SHA3-256("KHeavyHash") via
///    XoShiRo256++), reduce each sum to 4 bits (bits 10–13), recombine to 32
///    bytes, XOR with PowHash.
/// 3. **HeavyHash** = cSHAKE256("HeavyHash")(matrix_output)
pub fn hash_kheavyhash(pre_pow_hash: &[u8], timestamp: u64, nonce: u64) -> [u8; 32] {
    use sha3::digest::{ExtendableOutput, Update, XofReader};
    use sha3::{CShake256, CShake256Core};

    // Step 1: PowHash
    let mut pow_hasher = CShake256::from_core(CShake256Core::new(b"ProofOfWorkHash"));
    pow_hasher.update(pre_pow_hash);
    pow_hasher.update(&timestamp.to_le_bytes());
    pow_hasher.update(&[0u8; 32]);
    pow_hasher.update(&nonce.to_le_bytes());
    let mut pow_hash = [0u8; 32];
    pow_hasher.finalize_xof().read(&mut pow_hash);

    // Step 2: Matrix heavy hash
    let matrix = kheavy_matrix();
    let product = matrix.heavy_hash(&pow_hash);

    // Step 3: HeavyHash = cSHAKE256("HeavyHash")(product)
    let mut heavy_hasher = CShake256::from_core(CShake256Core::new(b"HeavyHash"));
    heavy_hasher.update(&product);
    let mut heavy_hash = [0u8; 32];
    heavy_hasher.finalize_xof().read(&mut heavy_hash);

    heavy_hash
}

// ── kHeavyHash matrix (Kaspa consensus) ──────────────────────────────

/// XoShiRo256++ PRNG, matching rusty-kaspa's implementation.
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

/// The fixed 64×64 matrix of 4-bit values used by kHeavyHash.
struct KheavyMatrix([[u16; 64]; 64]);

impl KheavyMatrix {
    /// Generate the matrix from SHA3-256("KHeavyHash") seed, retrying until
    /// the matrix has full rank (64).  Matches rusty-kaspa's `Matrix::generate`.
    fn generate() -> Self {
        use sha3::{Digest, Sha3_256};
        let seed = Sha3_256::digest(b"KHeavyHash");
        let mut rng = XoShiRo256PlusPlus::new(seed.into());
        loop {
            let mat = Self::rand_matrix(&mut rng);
            if mat.compute_rank() == 64 {
                return mat;
            }
        }
    }

    fn rand_matrix(rng: &mut XoShiRo256PlusPlus) -> Self {
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
        Self(mat)
    }

    /// Compute the rank of the matrix over the reals (Gaussian elimination).
    /// Matches rusty-kaspa's `compute_rank`.
    fn compute_rank(&self) -> usize {
        const EPS: f64 = 1e-9;
        let mut m = [[0.0f64; 64]; 64];
        for i in 0..64 {
            for j in 0..64 {
                m[i][j] = self.0[i][j] as f64;
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

    /// Matrix-vector multiply: expand 32-byte hash to 64 nibbles, multiply,
    /// reduce to 4 bits, recombine, XOR with input.  Matches rusty-kaspa's
    /// `heavy_hash`.
    fn heavy_hash(&self, hash: &[u8; 32]) -> [u8; 32] {
        // Expand to 64 nibbles
        let mut vec = [0u8; 64];
        for (i, &byte) in hash.iter().enumerate() {
            vec[2 * i] = byte >> 4;
            vec[2 * i + 1] = byte & 0x0F;
        }

        // Matrix-vector multiplication, reduce to 4 bits, combine to bytes
        let mut product = [0u8; 32];
        for i in 0..32 {
            let mut sum1: u32 = 0;
            let mut sum2: u32 = 0;
            for (j, &elem) in vec.iter().enumerate() {
                sum1 += (self.0[2 * i][j] * (elem as u16)) as u32;
                sum2 += (self.0[2 * i + 1][j] * (elem as u16)) as u32;
            }
            product[i] = (((sum1 >> 10) << 4) as u8) | ((sum2 >> 10) as u8);
        }

        // XOR with original hash
        for (p, h) in product.iter_mut().zip(hash.iter()) {
            *p ^= h;
        }
        product
    }
}

/// Return the cached kHeavyHash matrix (generated once on first use).
fn kheavy_matrix() -> &'static KheavyMatrix {
    use std::sync::OnceLock;
    static MATRIX: OnceLock<KheavyMatrix> = OnceLock::new();
    MATRIX.get_or_init(KheavyMatrix::generate)
}

/// Compute kHeavyHash with an explicit 8-byte nonce prefix.
///
/// Stratum pools (e.g. 2miners KAS) split the 64-bit nonce into a pool-fixed
/// `extranonce1` prefix and a miner-scanned suffix.  `suffix` is a `u64` whose
/// low bytes are appended after `extranonce1` to form the full 8-byte nonce.
pub fn hash_kheavyhash_extranonce(
    pre_pow_hash: &[u8],
    timestamp: u64,
    extranonce1: &[u8],
    suffix: u64,
) -> [u8; 32] {
    let mut full_nonce = [0u8; 8];
    let en1_len = extranonce1.len().min(8);
    full_nonce[..en1_len].copy_from_slice(&extranonce1[..en1_len]);
    let suffix_len = 8 - en1_len;
    if suffix_len > 0 {
        full_nonce[en1_len..8].copy_from_slice(&suffix.to_le_bytes()[..suffix_len]);
    }

    use sha3::digest::{ExtendableOutput, Update, XofReader};
    use sha3::{CShake256, CShake256Core};

    let mut pow_hasher = CShake256::from_core(CShake256Core::new(b"ProofOfWorkHash"));
    pow_hasher.update(pre_pow_hash);
    pow_hasher.update(&timestamp.to_le_bytes());
    pow_hasher.update(&[0u8; 32]);
    pow_hasher.update(&full_nonce);
    let mut pow_hash = [0u8; 32];
    pow_hasher.finalize_xof().read(&mut pow_hash);

    // Matrix step
    let matrix = kheavy_matrix();
    let product = matrix.heavy_hash(&pow_hash);

    // HeavyHash
    let mut heavy_hasher = CShake256::from_core(CShake256Core::new(b"HeavyHash"));
    heavy_hasher.update(&product);
    let mut heavy_hash = [0u8; 32];
    heavy_hasher.finalize_xof().read(&mut heavy_hash);

    heavy_hash
}

// ── Target comparison ────────────────────────────────────────────────

/// Check if a hash meets the given target (hash <= target in big-endian comparison).
#[inline]
pub fn meets_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash <= target
}

/// Check if a hash meets the target when the hash is interpreted as a
/// little-endian 256-bit integer.
///
/// Decred BLAKE3 (DCP-0011) requires the PoW hash to be treated as a little
/// endian unsigned integer when comparing against the target difficulty.  The
/// target bytes themselves remain big-endian, as produced by
/// `difficulty_to_target`.
#[inline]
pub fn meets_target_little_endian(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash.iter().rev().cmp(target.iter()).is_le()
}

/// Parse a hex target string (big-endian) into a 32-byte array.
pub fn parse_target_hex(hex: &str) -> Option<[u8; 32]> {
    let hex = hex.trim_start_matches("0x");
    let bytes = hex::decode(hex).ok()?;
    if bytes.len() > 32 {
        return None;
    }
    let mut target = [0u8; 32];
    // Right-align: the hex string is big-endian, so fill from the right
    let offset = 32 - bytes.len();
    target[offset..].copy_from_slice(&bytes);
    Some(target)
}

/// Parse a Monero/RandomX 64-bit little-endian target (16 hex chars) into a
/// 32-byte target array.
///
/// RandomX pools (xmrig-compatible Stratum) send the target as an 8-byte
/// little-endian value.  Only the first 8 bytes of the returned array are
/// populated; the remaining bytes are zero.  Use `meets_randomx_target`
/// for the corresponding partial comparison.
pub fn parse_randomx_target_hex(hex: &str) -> Option<[u8; 32]> {
    let hex = hex.trim_start_matches("0x");
    let bytes = hex::decode(hex).ok()?;
    if bytes.len() != 8 {
        return None;
    }
    let mut target = [0u8; 32];
    target[..8].copy_from_slice(&bytes);
    Some(target)
}

/// Check whether a RandomX hash meets the upstream pool target.
///
/// xmrig-compatible pools compare only the first 8 bytes of the hash
/// (interpreted as little-endian) against the 8-byte little-endian target.
pub fn meets_randomx_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    let hash_le = u64::from_le_bytes(hash[..8].try_into().unwrap());
    let target_le = u64::from_le_bytes(target[..8].try_into().unwrap());
    hash_le <= target_le
}

/// Convert a 32-byte hash to a hex string (big-endian display).
pub fn hash_to_hex(hash: &[u8; 32]) -> String {
    hash.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Derive the Ethash epoch from a seed hash.
///
/// Ethash seed hashes are generated by keccak256-chaining from the zero hash:
///   epoch 0 → [0; 32]
///   epoch 1 → keccak256([0; 32])
///   epoch 2 → keccak256(keccak256([0; 32]))
///   ...
///
/// This function tries up to `max_epoch` (default 2048) keccak256 iterations
/// to find which epoch the given seed hash belongs to.
///
/// Returns `Some(epoch)` if found, `None` if no match within `max_epoch`.
pub fn ethash_epoch_from_seed_hash(seed: &[u8; 32], max_epoch: u32) -> Option<u32> {
    use sha3::{Digest, Keccak256};

    let mut current = [0u8; 32];
    for epoch in 0..max_epoch {
        if &current == seed {
            return Some(epoch);
        }
        let mut hasher = Keccak256::new();
        hasher.update(current);
        current = hasher.finalize().into();
    }
    None
}

/// Default max epoch for seed hash search (2048 epochs × 30000 blocks = 61M blocks).
pub const ETHASH_MAX_EPOCH_SEARCH: u32 = 2048;

/// KawPow epoch length (7500 blocks per epoch, vs Ethash's 30000).
pub const KAWPOW_EPOCH_LENGTH: u32 = 7500;

/// Ethash epoch length (30000 blocks per epoch).
pub const ETHASH_EPOCH_LENGTH: u32 = 30000;

// ── Autolykos v2 (ERG) ───────────────────────────────────────────────

/// Compute Autolykos v2 hash for Ergo (ERG) mining.
///
/// Autolykos v2 is a memory-hard PoW based on Blake2b-256.  The algorithm:
///   1. Compute `prei8 = Blake2b256(msg || nonce_BE8).takeRight(8)` as u64 BE
///   2. Compute `i4 = prei8 mod N` as 4-byte BE
///   3. Compute `f31 = Blake2b256(i4 || height_BE4 || M).drop(1)` (31 bytes)
///   4. Generate permutation indices from `Blake2b256(f31 || msg || nonce_BE8)`
///   5. Sum selected elements from the M table
///   6. Final hash = `Blake2b256(f2_as_32bytes)`
///
/// For CPU mining this simplified version uses a small M table.  For full
/// speed, use the `native-hashers` feature which calls the C implementation.
///
/// `header` is the message (block header without nonce), `height` is the
/// block height, and `nonce` is the 64-bit nonce.
pub fn hash_autolykos(header: &[u8], nonce: u64, height: u32) -> [u8; 32] {
    // Use the native C implementation if available
    #[cfg(feature = "native-hashers")]
    {
        return crate::native_ffi::hash_autolykos_native(header, nonce, height);
    }

    // Pure-Rust fallback: simplified autolykos using blake3 as a stand-in
    // for blake2b (blake3 crate is already a dependency; blake2b would need
    // an additional crate).  This produces a deterministic but NOT
    // Ergo-valid hash — it's only useful for testing the stratum pipeline.
    // For real ERG mining, enable the `native-hashers` feature.
    #[allow(unreachable_code)]
    {
        let mut input = Vec::with_capacity(header.len() + 8 + 4);
        input.extend_from_slice(header);
        input.extend_from_slice(&nonce.to_be_bytes());
        input.extend_from_slice(&height.to_be_bytes());
        let h1 = blake3::hash(&input);
        *blake3::hash(h1.as_bytes()).as_bytes()
    }
}

// ── KawPow (RVN, CLORE) ──────────────────────────────────────────────

/// Compute KawPow hash for Ravencoin (RVN) / Clore.ai (CLORE) mining.
///
/// KawPow is a ProgPow variant that requires a DAG (directed acyclic graph)
/// computed per-epoch.  The pure-Rust fallback is NOT valid for real mining;
/// enable the `native-hashers` feature for the C implementation with DAG.
///
/// Returns (mix_hash, final_hash), each 32 bytes.
pub fn hash_kawpow(header: &[u8; 32], nonce: u64, height: u32) -> ([u8; 32], [u8; 32]) {
    #[cfg(feature = "native-hashers")]
    {
        return crate::native_ffi::hash_kawpow_native(header, nonce, height);
    }

    // Pure-Rust fallback: NOT valid for real KawPow mining.
    #[allow(unreachable_code)]
    {
        let mut input = Vec::with_capacity(32 + 8 + 4);
        input.extend_from_slice(header);
        input.extend_from_slice(&nonce.to_le_bytes());
        input.extend_from_slice(&height.to_le_bytes());
        let mix = *blake3::hash(&input).as_bytes();
        let final_hash = *blake3::hash(&mix).as_bytes();
        (mix, final_hash)
    }
}

/// Compute the real KawPow hash over a precomputed DAG (requires the
/// `native-hashers` feature).
///
/// This is the full KawPow (ProgPoW-derived) algorithm:
///   1. `seed = Keccak-512(header_hash || nonce_le)`  → 64 bytes
///   2. `mix  = seed` (16 × u32, little-endian)
///   3. 32 DAG accesses with FNV-1a mixing (`hash = (hash ^ elem) * 0x01000193`)
///   4. FNV-fold each pair → 8 × u32 (32 bytes)
///   5. `hash = Keccak-256(seed || compressed_mix)`   → 32 bytes
///
/// `header_hash` is the 32-byte block header hash, `dag` is the raw DAG buffer
/// (128 bytes per entry), and `dag_size_entries` is the number of 128-byte
/// entries.  Returns (mix_hash, final_hash), each 32 bytes.
pub fn hash_kawpow_with_dag(
    header_hash: &[u8; 32],
    nonce: u64,
    dag: &[u8],
    dag_size_entries: u64,
) -> ([u8; 32], [u8; 32]) {
    #[cfg(feature = "native-hashers")]
    {
        return crate::native_ffi::hash_kawpow_native_with_dag(
            header_hash,
            nonce,
            dag,
            dag_size_entries,
        );
    }

    // Pure-Rust fallback: NOT valid for real KawPow mining.
    #[allow(unreachable_code)]
    {
        let _ = (dag, dag_size_entries);
        let mut input = Vec::with_capacity(32 + 8);
        input.extend_from_slice(header_hash);
        input.extend_from_slice(&nonce.to_le_bytes());
        let mix = *blake3::hash(&input).as_bytes();
        let final_hash = *blake3::hash(&mix).as_bytes();
        (mix, final_hash)
    }
}

/// Mine a single KawPow nonce against a precomputed DAG (requires the
/// `native-hashers` feature).
///
/// Returns `Some(hash)` if `hash <= target` (big-endian comparison), else
/// `None`.  This is the real DAG-based KawPow used by RVN/CLORE.
pub fn mine_kawpow(
    header_hash: &[u8; 32],
    nonce: u64,
    dag: &[u8],
    dag_size_entries: u64,
    target: &[u8; 32],
) -> Option<[u8; 32]> {
    #[cfg(feature = "native-hashers")]
    {
        return crate::native_ffi::mine_kawpow_native(
            header_hash,
            nonce,
            dag,
            dag_size_entries,
            target,
        );
    }

    // Pure-Rust fallback: NOT valid for real KawPow mining.
    #[allow(unreachable_code)]
    {
        let _ = (dag, dag_size_entries, target);
        let (mix, _final) = hash_kawpow_with_dag(header_hash, nonce, dag, dag_size_entries);
        // Without a real DAG this is not a valid KawPow hash; just return None.
        let _ = mix;
        None
    }
}

// ── Ethash/EtcHash (ETC) ─────────────────────────────────────────────

/// Compute Ethash/EtcHash mix hash for Ethereum Classic (ETC) mining.
///
/// Ethash requires a DAG computed per-epoch (~3GB for current epochs).  The
/// pure-Rust fallback is NOT valid for real mining; enable the
/// `native-hashers` feature for the C implementation with DAG.
pub fn hash_ethash(header: &[u8], nonce: u64, height: u32) -> [u8; 32] {
    #[cfg(feature = "native-hashers")]
    {
        return crate::native_ffi::hash_ethash_native(header, nonce, height);
    }

    // Pure-Rust fallback: NOT valid for real Ethash mining.
    #[allow(unreachable_code)]
    {
        let mut input = Vec::with_capacity(header.len() + 8 + 4);
        input.extend_from_slice(header);
        input.extend_from_slice(&nonce.to_le_bytes());
        input.extend_from_slice(&height.to_le_bytes());
        *blake3::hash(&input).as_bytes()
    }
}

/// Compute the real Ethash hash over a precomputed DAG (requires the
/// `native-hashers` feature).
///
/// This is the full Dagger-Hashimoto algorithm:
///   1. `seed   = Keccak-512(header_hash || nonce_le)`        → 64 bytes
///   2. `mix    = seed || seed`                                → 128 bytes (32 × u32)
///   3. 64 DAG accesses with FNV-1a mixing (`hash = (hash ^ elem) * 0x01000193`)
///   4. FNV-fold each 4-word group                             → 32 bytes
///   5. `hash   = Keccak-256(seed || compressed_mix)`          → 32 bytes
///
/// `header_hash` is the 32-byte block header hash, `dag` is the raw DAG buffer
/// (128 bytes per entry), and `dag_size_entries` is the number of 128-byte
/// entries.  Returns the 32-byte final Ethash hash.
pub fn hash_ethash_with_dag(
    header_hash: &[u8; 32],
    nonce: u64,
    dag: &[u8],
    dag_size_entries: u64,
) -> [u8; 32] {
    #[cfg(feature = "native-hashers")]
    {
        return crate::native_ffi::hash_ethash_with_dag_native(
            header_hash,
            nonce,
            dag,
            dag_size_entries,
        );
    }

    // Pure-Rust fallback: NOT valid for real Ethash mining.
    #[allow(unreachable_code)]
    {
        let _ = (dag, dag_size_entries);
        let mut input = Vec::with_capacity(32 + 8);
        input.extend_from_slice(header_hash);
        input.extend_from_slice(&nonce.to_le_bytes());
        *blake3::hash(&input).as_bytes()
    }
}

/// Mine a single Ethash nonce against a precomputed DAG (requires the
/// `native-hashers` feature).
///
/// Returns `Some(hash)` if `hash <= target` (big-endian comparison), else
/// `None`.  This is the real DAG-based Ethash used by ETC/ETHW.
pub fn mine_ethash(
    header_hash: &[u8; 32],
    nonce: u64,
    dag: &[u8],
    dag_size_entries: u64,
    target: &[u8; 32],
) -> Option<[u8; 32]> {
    #[cfg(feature = "native-hashers")]
    {
        return crate::native_ffi::mine_ethash_native(
            header_hash,
            nonce,
            dag,
            dag_size_entries,
            target,
        );
    }

    // Pure-Rust fallback: NOT valid for real Ethash mining.
    #[allow(unreachable_code)]
    {
        let hash = hash_ethash_with_dag(header_hash, nonce, dag, dag_size_entries);
        if meets_target(&hash, target) {
            Some(hash)
        } else {
            None
        }
    }
}

/// Register a precomputed DAG for use by the legacy `hash_ethash` path
/// (requires the `native-hashers` feature).
///
/// `dag` is the raw DAG buffer (128 bytes per entry), `dag_size_entries` is the
/// number of 128-byte entries.  The buffer is borrowed and must outlive
/// subsequent `hash_ethash` calls.
#[cfg(feature = "native-hashers")]
pub fn set_ethash_dag(dag: &[u8], dag_size_entries: u64) {
    crate::native_ffi::set_ethash_dag(dag, dag_size_entries);
}

/// Initialize Ethash epoch cache.  Call once before any `hash_ethash` calls
/// when using the `native-hashers` feature (only needed for the light-mode
/// fallback; the DAG-based `hash_ethash_with_dag` / `mine_ethash` do not
/// require it).
#[cfg(feature = "native-hashers")]
pub fn init_ethash() {
    crate::native_ffi::init_ethash();
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Blake3 ───────────────────────────────────────────────────────

    #[test]
    fn blake3_deterministic() {
        let h1 = hash_blake3(b"test_header", 0, 42);
        let h2 = hash_blake3(b"test_header", 0, 42);
        assert_eq!(h1, h2);
    }

    #[test]
    fn blake3_nonzero() {
        let h = hash_blake3(b"test_header", 0, 0);
        assert_ne!(h, [0u8; 32]);
    }

    #[test]
    fn blake3_nonce_sensitive() {
        let h0 = hash_blake3(b"header", 0, 0u64);
        let h1 = hash_blake3(b"header", 0, 1u64);
        assert_ne!(h0, h1);
    }

    #[test]
    fn blake3_header_sensitive() {
        let h0 = hash_blake3(b"header_a", 0, 0u64);
        let h1 = hash_blake3(b"header_b", 0, 0u64);
        assert_ne!(h0, h1);
    }

    #[test]
    fn blake3_raw_deterministic() {
        let h1 = hash_blake3_raw(b"test");
        let h2 = hash_blake3_raw(b"test");
        assert_eq!(h1, h2);
    }

    #[test]
    fn blake3_raw_known_vector() {
        // Blake3 of empty input (verified via blake3::hash(b""))
        let h = hash_blake3_raw(b"");
        let expected_hex = "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262";
        assert_eq!(hash_to_hex(&h), expected_hex);
    }

    // ── kHeavyHash ───────────────────────────────────────────────────

    #[test]
    fn kheavyhash_deterministic() {
        let h1 = hash_kheavyhash(&[42u8; 32], 0, 42);
        let h2 = hash_kheavyhash(&[42u8; 32], 0, 42);
        assert_eq!(h1, h2);
    }

    #[test]
    fn kheavyhash_nonzero() {
        let h = hash_kheavyhash(&[42u8; 32], 0, 0);
        assert_ne!(h, [0u8; 32]);
    }

    #[test]
    fn kheavyhash_nonce_sensitive() {
        let h0 = hash_kheavyhash(&[0u8; 32], 0, 0u64);
        let h1 = hash_kheavyhash(&[0u8; 32], 0, 1u64);
        assert_ne!(h0, h1);
    }

    #[test]
    fn kheavyhash_header_sensitive() {
        let h0 = hash_kheavyhash(&[0u8; 32], 0, 0u64);
        let h1 = hash_kheavyhash(&[1u8; 32], 0, 0u64);
        assert_ne!(h0, h1);
    }

    #[test]
    fn kheavyhash_known_vector() {
        // Replicates the reference vector from rusty-kaspa's pow_hashers tests:
        // timestamp = 5435345234, nonce = 432432432, pre_pow_hash = [42; 32].
        // The full kHeavyHash includes: PowHash → matrix multiply → HeavyHash.
        // The old test (without matrix) produced b0b5b47d… which was WRONG.
        // This test now verifies the hash is deterministic and non-zero;
        // the exact value depends on the matrix generated from SHA3-256("KHeavyHash").
        let h = hash_kheavyhash(&[42u8; 32], 5_435_345_234, 432_432_432);
        let h2 = hash_kheavyhash(&[42u8; 32], 5_435_345_234, 432_432_432);
        assert_eq!(hash_to_hex(&h), hash_to_hex(&h2), "kHeavyHash must be deterministic");
        assert_ne!(h, [0u8; 32], "kHeavyHash must not be all zeros");
        // The old (incorrect, no-matrix) hash was b0b5b47d… — verify we differ
        let old_wrong = "b0b5b47de00be8f689cbe89818f8a075350055c5e9dbcda7d834395b08be2252";
        assert_ne!(hash_to_hex(&h), old_wrong, "kHeavyHash with matrix must differ from no-matrix version");
        // Verified against GPU OpenCL kernel: both produce
        // 430ee3e8261c539b1ff403cc0adc3587e74753a24f628be52b9dea8a6cfe3e66
        assert_eq!(
            hash_to_hex(&h),
            "430ee3e8261c539b1ff403cc0adc3587e74753a24f628be52b9dea8a6cfe3e66",
            "kHeavyHash must match the verified GPU reference vector"
        );
    }

    #[test]
    fn kheavyhash_differs_from_blake3() {
        // kHeavyHash wraps Blake3 but adds the matrix step, so output must differ
        let header = &[42u8; 32];
        let nonce = 42u64;
        let blake = hash_blake3(header, 0, nonce);
        let heavy = hash_kheavyhash(header, 0, nonce);
        assert_ne!(blake, heavy, "kHeavyHash must differ from raw Blake3");
    }

    // ── Avalanche ────────────────────────────────────────────────────

    #[test]
    fn blake3_avalanche() {
        let h1 = hash_blake3(b"avalanche\x00", 0, 0u64);
        let h2 = hash_blake3(b"avalanche\x01", 0, 0u64);
        let diff = h1.iter().zip(h2.iter()).filter(|(a, b)| a != b).count();
        assert!(diff >= 8, "Blake3 avalanche: >= 8 bytes must differ (got {})", diff);
    }

    #[test]
    fn kheavyhash_avalanche() {
        let h1 = hash_kheavyhash(&[0u8; 32], 0, 0u64);
        let h2 = hash_kheavyhash(&[1u8; 32], 0, 0u64);
        let diff = h1.iter().zip(h2.iter()).filter(|(a, b)| a != b).count();
        assert!(diff >= 4, "kHeavyHash avalanche: >= 4 bytes must differ (got {})", diff);
    }

    // ── Target comparison ────────────────────────────────────────────

    #[test]
    fn meets_target_all_ff_always_passes() {
        let target = [0xFFu8; 32];
        let h = hash_blake3(b"target_test", 0, 0);
        assert!(meets_target(&h, &target));
    }

    #[test]
    fn meets_target_all_zero_never_passes() {
        let target = [0x00u8; 32];
        let h = hash_blake3(b"target_test", 0, 0);
        assert!(!meets_target(&h, &target));
    }

    #[test]
    fn meets_target_little_endian_reverses_byte_order() {
        // Hash [0x01, 0x00, ...] (BE) is greater than target [0x00, ..., 0x01]
        // in BE comparison, but when interpreted as LE it equals target.
        let mut hash = [0u8; 32];
        hash[0] = 0x01;
        let mut target = [0u8; 32];
        target[31] = 0x01;
        assert!(!meets_target(&hash, &target));
        assert!(meets_target_little_endian(&hash, &target));

        // Hash [0x00, ..., 0x01] (BE) is below target in BE but greater when
        // interpreted as LE.
        let mut hash2 = [0u8; 32];
        hash2[31] = 0x01;
        assert!(meets_target(&hash2, &target));
        assert!(!meets_target_little_endian(&hash2, &target));
    }

    #[test]
    fn parse_target_hex_short() {
        // "00ff" → right-aligned: [0...0, 0x00, 0xFF]
        let target = parse_target_hex("00ff").unwrap();
        assert_eq!(target[30], 0x00);
        assert_eq!(target[31], 0xFF);
        assert_eq!(target[0], 0x00);
    }

    #[test]
    fn parse_target_hex_full() {
        let hex = "ff".repeat(32);
        let target = parse_target_hex(&hex).unwrap();
        assert_eq!(target, [0xFFu8; 32]);
    }

    #[test]
    fn parse_target_hex_with_0x_prefix() {
        let target = parse_target_hex("0xffff").unwrap();
        assert_eq!(target[31], 0xFF);
        assert_eq!(target[30], 0xFF);
    }

    #[test]
    fn parse_randomx_target_hex_le() {
        // 16-char LE target: value = 0x00000000ffffff00
        let target = parse_randomx_target_hex("00ffffff00000000").unwrap();
        // First 8 bytes are the LE value; remaining bytes are zero.
        assert_eq!(target[..8], [0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00]);
        assert!(target[8..].iter().all(|b| *b == 0x00));

        // A hash whose low 64 bits (LE) are below the target passes.
        let mut hash = [0xFFu8; 32];
        hash[..8].copy_from_slice(&[0x00, 0x00, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00]);
        assert!(meets_randomx_target(&hash, &target));

        // A hash whose low 64 bits are above the target fails.
        hash[..8].copy_from_slice(&[0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]);
        assert!(!meets_randomx_target(&hash, &target));
    }

    #[test]
    fn parse_randomx_target_hex_rejects_wrong_length() {
        assert!(parse_randomx_target_hex("ffffff00").is_none()); // 4 bytes
        assert!(parse_randomx_target_hex("00").is_none()); // 1 byte
    }

    #[test]
    fn hash_to_hex_roundtrip() {
        let h = hash_blake3(b"roundtrip", 0, 0);
        let hex = hash_to_hex(&h);
        assert_eq!(hex.len(), 64);
        let bytes = hex::decode(&hex).unwrap();
        assert_eq!(bytes, h.to_vec());
    }

    // ── Algorithm enum ───────────────────────────────────────────────

    #[test]
    fn algorithm_from_str() {
        assert_eq!(
            ExternalAlgorithm::from_str_loose("blake3"),
            Some(ExternalAlgorithm::Blake3)
        );
        assert_eq!(
            ExternalAlgorithm::from_str_loose("kheavyhash"),
            Some(ExternalAlgorithm::KHeavyHash)
        );
        assert_eq!(ExternalAlgorithm::from_str_loose("unknown"), None);
    }
}
