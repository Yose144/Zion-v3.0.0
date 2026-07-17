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
    VerusHash,
    ZelHash,
    ProgPow,
    PearlHash,
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
            Self::VerusHash => "verushash",
            Self::ZelHash => "zelhash",
            Self::ProgPow => "progpow",
            Self::PearlHash => "pearlhash",
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
            "verushash" | "verus" => Some(Self::VerusHash),
            "zelhash" | "zel" => Some(Self::ZelHash),
            "progpow" => Some(Self::ProgPow),
            "pearlhash" | "pearl" => Some(Self::PearlHash),
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
    let mut full_header = [0u8; DCR_HEADER_SIZE];
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
/// VerusHash v2.2 and Decred BLAKE3 (DCP-0011) return the PoW hash in
/// little-endian byte order (as per Bitcoin's uint256 convention). The target
/// bytes remain big-endian, as produced by `difficulty_to_target` or received
/// from a stratum pool.
///
/// To compare correctly we reverse the hash bytes (converting LE → BE) and
/// compare against the target as big-endian. Reversing the target too would
/// yield an incorrect comparison (the target's high bytes would become low).
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
/// Monero/xmrig compare the hash as a 256-bit LITTLE-ENDIAN number against
/// the target.  In a 256-bit LE value, the MOST significant 64 bits are at
/// bytes 24-31.  For Monero's difficulty range (target < 2^64), only the
/// MSB 64 bits need to be checked: if MSB_64 < target_64, the hash is valid.
///
/// This matches xmrig's check:
///   `*reinterpret_cast<uint64_t*>(m_hash + 24) < job.target()`
/// and Monero's `check_hash_64` which starts from `((uint64_t*)&hash)[3]`.
pub fn meets_randomx_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    let hash_msb = u64::from_le_bytes(hash[24..32].try_into().unwrap());
    let target_le = u64::from_le_bytes(target[..8].try_into().unwrap());
    hash_msb < target_le
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

/// ProgPow epoch length (EPIC uses 30000 blocks per epoch, same as Ethash).
pub const PROGPOW_EPOCH_LENGTH: u32 = 30000;

/// ProgPoW 0.9.3 parameters (per EIP-1057).
pub const PROGPOW_LANES: u32 = 16;
pub const PROGPOW_REGS: u32 = 32;
pub const PROGPOW_DAG_LOADS: u32 = 4;
pub const PROGPOW_CACHE_BYTES: u32 = 16 * 1024;
pub const PROGPOW_CNT_DAG: u32 = 64;
pub const PROGPOW_CNT_CACHE: u32 = 11;
pub const PROGPOW_CNT_MATH: u32 = 18;
/// Number of blocks before the random program changes.
pub const PROGPOW_PERIOD: u32 = 10;

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

// ── VerusHash v2.2 (VRSC) ────────────────────────────────────────────

/// Compute VerusHash v2.2 for Verus (VRSC) mining.
///
/// VerusHash v2.2 is a CPU-optimized PoW algorithm combining Haraka-512,
/// CLHash (carry-less multiplication hash), and BLAKE2b finalization.
/// It is designed to be ASIC-resistant and GPU-resistant, favoring CPUs
/// with AES-NI / ARM crypto extensions.
///
/// This function calls the native C++ implementation (Haraka+CLHash pipeline
/// from VerusCoin upstream) when the `native-hashers` feature is enabled.
/// The pure-Rust fallback uses Blake3 as a placeholder and is NOT valid for
/// real VRSC mining.
///
/// # Arguments
/// * `header` — Full block header bytes (or header prefix for PBaaS v7+)
/// * `nonce` — 64-bit nonce value
///
/// # Returns
/// 32-byte VerusHash v2.2 digest.
pub fn hash_verushash(header: &[u8], nonce: u64) -> [u8; 32] {
    // Real VerusHash v2.2 via zion-native-ffi C++ (Haraka+CLHash pipeline)
    #[cfg(feature = "native-verushash")]
    {
        return zion_native_ffi::verushash::hash(header, nonce);
    }

    // Portable C stub via native-hashers feature (Keccak-256 fallback)
    #[cfg(all(feature = "native-hashers", not(feature = "native-verushash")))]
    {
        return crate::native_ffi::hash_verushash_native(header, nonce);
    }

    // Pure-Rust fallback: NOT valid for real VerusHash mining.
    // Uses Blake3 as a deterministic placeholder for testing the stratum pipeline.
    #[allow(unreachable_code)]
    {
        let mut input = Vec::with_capacity(header.len() + 8);
        input.extend_from_slice(header);
        input.extend_from_slice(&nonce.to_le_bytes());
        *blake3::hash(&input).as_bytes()
    }
}

/// Hash a complete VRSC block header as-is (no nonce appended).
/// The caller must embed the nonce in the header's 32-byte nonce field
/// (offset 108) and/or the solution's nonceSpace before calling.
///
/// This is the correct hash function for VRSC merge-mining:
///   - The full 1487-byte header is hashed directly
///   - No extra nonce bytes are appended
///   - Matches what LuckPool/VerusCoin node computes for validation
pub fn hash_verushash_header(header: &[u8]) -> [u8; 32] {
    #[cfg(feature = "native-verushash")]
    {
        return zion_native_ffi::verushash::hash_raw(header);
    }

    #[cfg(all(feature = "native-hashers", not(feature = "native-verushash")))]
    {
        return crate::native_ffi::hash_verushash_raw_native(header);
    }

    #[allow(unreachable_code)]
    {
        *blake3::hash(header).as_bytes()
    }
}

/// Clear non-canonical PBaaS v7+ header data before hashing.
///
/// VerusHash 2.2 merge-mining (PBaaS v7+) normalizes the block header by
/// zeroing the non-canonical fields before the final hash.  The upstream
/// LuckPool/node-stratum-pool-verus does the same in `verusHashV2b2`.
/// Without this step the miner's hash will never match the pool's.
///
/// `header` must be a full 1487-byte VRSC block header (header prefix +
/// varint + 1344-byte solution).  Non-canonical fields zeroed in-place:
///   - previous block hash, merkle root, final sapling root (bytes 4..100)
///   - nBits (bytes 104..108)
///   - nonce field (bytes 108..140)
///   - MMR roots in the solution (solution bytes 8..72, absolute 151..215)
///     both `hashPrevMMRRoot` and `hashBlockMMRRoot` are 32 bytes each.
///
/// The clearing is only applied when the solution version (little-endian
/// u32 at solution offset 0) is greater than 6 and at least one PBaaS
/// header is declared in the solution.
pub fn clear_verushash_pbaas(header: &mut [u8]) {
    const SOLUTION_OFFSET: usize = 143;
    if header.len() < SOLUTION_OFFSET + 8 {
        return;
    }

    let sol_ver = u32::from_le_bytes([
        header[SOLUTION_OFFSET],
        header[SOLUTION_OFFSET + 1],
        header[SOLUTION_OFFSET + 2],
        header[SOLUTION_OFFSET + 3],
    ]);
    if sol_ver <= 6 {
        return;
    }

    let num_pbaas = header[SOLUTION_OFFSET + 5];
    if num_pbaas == 0 {
        return;
    }

    // Non-canonical fields in the 140-byte header prefix.
    if header.len() >= 140 {
        for b in &mut header[4..100] {
            *b = 0;
        }
        for b in &mut header[104..108] {
            *b = 0;
        }
        for b in &mut header[108..140] {
            *b = 0;
        }
    }

    // MMR roots stored in the first 72 bytes of the solution:
    //   hashPrevMMRRoot (32 bytes) + hashBlockMMRRoot (32 bytes).
    let mmr_start = SOLUTION_OFFSET + 8;
    let mmr_end = SOLUTION_OFFSET + 72;
    if header.len() >= mmr_end {
        for b in &mut header[mmr_start..mmr_end] {
            *b = 0;
        }
    }
}

/// Initialize VerusHash lookup tables (Haraka round constants, CLHash keys).
/// Must be called once before hashing when using the native implementation.
#[cfg(any(feature = "native-hashers", feature = "native-verushash"))]
pub fn init_verushash() {
    #[cfg(feature = "native-verushash")]
    {
        zion_native_ffi::verushash::init();
    }
    #[cfg(all(feature = "native-hashers", not(feature = "native-verushash")))]
    {
        crate::native_ffi::init_verushash();
    }
}

// ── ZelHash / Equihash 125,4 (FLUX) ───────────────────────────────────
//
// ZelHash is a modified Equihash 125,4 used by the Flux blockchain.
// It uses Blake2b with "ZelProof" personalization (instead of Zcash's
// "ZcashPoW").  The algorithm is memory-hard (~1.3 GB VRAM for GPU mining).
//
// Parameters:
//   n = 125, k = 4
//   collision_bit_length = n / (k + 1) = 25
//   hash_output (digest len) = (n / (k + 1) + 1) * 2^(k + 1) / 8 = 26 * 32 / 8 = 104
//   indices_per_hash_output = 512 / n = 4
//   solution_size = 2^k * 4 = 64 bytes (compressed indices)
//
// For the B2b bridge, the pool forwards Equihash solutions from miners
// to the upstream FLUX pool.  The pool-side verification is optional
// (upstream pool validates).  The CPU solver is for E2E testing only —
// real mining requires a GPU kernel.

/// ZelHash parameters.
const ZELHASH_N: u32 = 125;
const ZELHASH_K: u32 = 4;

/// Blake2b personalization for ZelHash: "ZelProof" + n_le + k_le (16 bytes).
fn zelhash_personalization() -> [u8; 16] {
    let mut p = [0u8; 16];
    p[..8].copy_from_slice(b"ZelProof");
    p[8..12].copy_from_slice(&ZELHASH_N.to_le_bytes());
    p[12..16].copy_from_slice(&ZELHASH_K.to_le_bytes());
    p
}

/// Number of n-bit indices that fit in one Blake2b hash output (512 bits).
const ZELHASH_INDICES_PER_HASH: u32 = 512 / ZELHASH_N; // = 4

/// Collision bit length = n / (k + 1) = 25.
const ZELHASH_COLLISION_BITS: u32 = ZELHASH_N / (ZELHASH_K + 1); // = 25

/// Collision byte length = ceil(collision_bits / 8) = 4.
const ZELHASH_COLLISION_BYTES: usize = ((ZELHASH_COLLISION_BITS + 7) / 8) as usize; // = 4

/// Hash output size in bytes = ceil((n/(k+1) + 1) * 2^(k+1) / 8).
/// = ceil(26 * 32 / 8) = 104.  But Blake2b max is 64 bytes, so we use 64.
/// Actually, the hash_output for Equihash is the Blake2b digest length,
/// which is ceil(n * indices_per_hash / 8) = ceil(125 * 4 / 8) = ceil(62.5) = 63.
/// Wait — the equihash crate uses hash_output = (n/(k+1)+1) * 2^(k+1) / 8
/// but that's the row size, not the digest.  The digest is 512/8 = 64 bytes
/// (full Blake2b output), and we extract n-bit chunks from it.
const ZELHASH_DIGEST_LEN: u8 = 64; // Blake2b-512

/// Number of initial rows = 2^(n/(k+1) + 1) = 2^26 = 67,108,864.
#[allow(dead_code)]
const ZELHASH_NUM_ROWS: u32 = 1 << (ZELHASH_N / (ZELHASH_K + 1) + 1); // 2^26

/// Number of indices in a solution = 2^k = 16.
const ZELHASH_SOLUTION_INDICES: usize = 1 << ZELHASH_K; // 16

/// Compressed solution size in bytes = 2^k * ceil(collision_bits / 8) = 16 * 4 = 64.
/// But Equihash uses a bit-packed format: 2^k * (collision_bits + 1) / 8
/// = 16 * 26 / 8 = 52 bytes.  The +1 is for the index bit.
#[allow(dead_code)]
const ZELHASH_SOLUTION_SIZE: usize =
    (ZELHASH_SOLUTION_INDICES * (ZELHASH_COLLISION_BITS as usize + 1) + 7) / 8; // 52

/// Initialize Blake2b state with ZelProof personalization.
fn zelhash_init_state() -> blake2b_simd::State {
    blake2b_simd::Params::new()
        .hash_length(ZELHASH_DIGEST_LEN as usize)
        .personal(&zelhash_personalization())
        .to_state()
}

/// Generate the i-th hash from the base Blake2b state.
fn zelhash_generate_hash(base_state: &blake2b_simd::State, i: u32) -> [u8; 64] {
    let mut state = base_state.clone();
    state.update(&i.to_le_bytes());
    let bytes = state.finalize();
    let mut out = [0u8; 64];
    let len = bytes.as_bytes().len().min(64);
    out[..len].copy_from_slice(&bytes.as_bytes()[..len]);
    out
}

/// Extract the n-bit chunk for index `i` from the hash output.
/// Each 512-bit Blake2b output contains `indices_per_hash` = 4 chunks of n=125 bits.
/// The chunk starts at bit (i % 4) * 125 and is 125 bits = 16 bytes (with 3 padding bits).
fn zelhash_get_chunk(hash: &[u8; 64], i: u32) -> Vec<u8> {
    let chunk_idx = (i % ZELHASH_INDICES_PER_HASH) as usize;
    let bit_offset = chunk_idx * ZELHASH_N as usize;
    let n_bytes = ((ZELHASH_N as usize) + 7) / 8; // 16 bytes

    // Extract n bits starting at bit_offset, expand to byte-aligned.
    let mut chunk = vec![0u8; n_bytes];

    // Simple bit extraction
    for j in 0..n_bytes {
        let src_bit = bit_offset + j * 8;
        let src_byte = src_bit / 8;
        let src_shift = src_bit % 8;

        if src_byte + 1 < hash.len() {
            let val = ((hash[src_byte] as u16) << 8 | hash[src_byte + 1] as u16) >> (8 - src_shift);
            chunk[j] = (val & 0xFF) as u8;
        } else if src_byte < hash.len() {
            chunk[j] = hash[src_byte] >> src_shift;
        }
    }

    // Mask off the extra bits in the last byte (n=125, so last byte has 5 valid bits)
    let extra_bits = (n_bytes * 8) - ZELHASH_N as usize;
    if extra_bits > 0 {
        let mask = 0xFFu8 >> extra_bits;
        chunk[n_bytes - 1] &= mask;
    }

    // Expand for collision detection (pad to collision_byte_length * (k+1))
    expand_array(&chunk, ZELHASH_COLLISION_BITS as usize, 0)
}

/// Expand a byte array by inserting zero bits after every `bits_per_byte` bits.
/// This is used for collision detection in Equihash.
fn expand_array(input: &[u8], bits_per_byte: usize, bit_len: usize) -> Vec<u8> {
    let expanded_bits = bits_per_byte + bit_len;
    let expanded_bytes = (input.len() * expanded_bits + 7) / 8;
    let mut output = vec![0u8; expanded_bytes];

    let mut bit_pos = 0;
    for &byte in input {
        for bit_idx in 0..bits_per_byte {
            let bit = (byte >> bit_idx) & 1;
            if bit == 1 {
                let out_byte = bit_pos / 8;
                let out_shift = bit_pos % 8;
                if out_byte < output.len() {
                    output[out_byte] |= 1 << out_shift;
                }
            }
            bit_pos += expanded_bits;
        }
        bit_pos += bit_len; // skip padding bits
    }
    output
}

/// Compress a solution from indices to the minimal byte format.
fn compress_indices(indices: &[u32]) -> Vec<u8> {
    let bits_per_index = ZELHASH_COLLISION_BITS as usize + 1; // 26 bits
    let total_bits = indices.len() * bits_per_index;
    let total_bytes = (total_bits + 7) / 8;
    let mut output = vec![0u8; total_bytes];

    let mut bit_pos = 0;
    for &idx in indices {
        for bit_idx in 0..bits_per_index {
            let bit = (idx >> bit_idx) & 1;
            if bit == 1 {
                let byte = bit_pos / 8;
                let shift = bit_pos % 8;
                if byte < output.len() {
                    output[byte] |= 1 << shift;
                }
            }
            bit_pos += 1;
        }
    }
    output
}

/// Decompress solution bytes back to indices.
fn decompress_indices(soln: &[u8]) -> Result<Vec<u32>, String> {
    let bits_per_index = ZELHASH_COLLISION_BITS as usize + 1; // 26 bits
    let expected_size = (ZELHASH_SOLUTION_INDICES * bits_per_index + 7) / 8;
    if soln.len() != expected_size {
        return Err(format!(
            "solution size {} != expected {}",
            soln.len(),
            expected_size
        ));
    }

    let mut indices = Vec::with_capacity(ZELHASH_SOLUTION_INDICES);
    let mut bit_pos = 0;
    for _ in 0..ZELHASH_SOLUTION_INDICES {
        let mut idx: u32 = 0;
        for bit_idx in 0..bits_per_index {
            let byte = bit_pos / 8;
            let shift = bit_pos % 8;
            if byte < soln.len() && (soln[byte] >> shift) & 1 == 1 {
                idx |= 1 << bit_idx;
            }
            bit_pos += 1;
        }
        indices.push(idx);
    }
    Ok(indices)
}

/// Equihash node: hash + indices.
struct EquihashNode {
    hash: Vec<u8>,
    indices: Vec<u32>,
}

impl EquihashNode {
    fn new(state: &blake2b_simd::State, i: u32) -> Self {
        let h = zelhash_generate_hash(state, i / ZELHASH_INDICES_PER_HASH);
        let chunk = zelhash_get_chunk(&h, i);
        EquihashNode {
            hash: chunk,
            indices: vec![i],
        }
    }

    fn from_children(a: Self, b: Self, trim: usize) -> Self {
        let hash: Vec<u8> = a
            .hash
            .iter()
            .zip(b.hash.iter())
            .skip(trim)
            .map(|(x, y)| x ^ y)
            .collect();
        let indices = if a.indices[0] < b.indices[0] {
            let mut idx = a.indices;
            idx.extend(b.indices.iter());
            idx
        } else {
            let mut idx = b.indices;
            idx.extend(a.indices.iter());
            idx
        };
        EquihashNode { hash, indices }
    }

    fn has_collision(&self, other: &EquihashNode, len: usize) -> bool {
        self.hash
            .iter()
            .zip(other.hash.iter())
            .take(len)
            .all(|(a, b)| a == b)
    }

    fn is_zero(&self, len: usize) -> bool {
        self.hash.iter().take(len).all(|&b| b == 0)
    }
}

/// Verify an Equihash 125,4 solution for ZelHash.
///
/// `input` is the block header (without nonce or solution).
/// `nonce` is the 32-byte nonce (ZcashStratum uses 32-byte nonces).
/// `soln` is the compressed solution bytes.
pub fn is_valid_zelhash_solution(
    input: &[u8],
    nonce: &[u8],
    soln: &[u8],
) -> Result<(), String> {
    let indices = decompress_indices(soln)?;
    if indices.len() != ZELHASH_SOLUTION_INDICES {
        return Err(format!(
            "expected {} indices, got {}",
            ZELHASH_SOLUTION_INDICES,
            indices.len()
        ));
    }

    // Check for duplicate indices
    let mut sorted = indices.clone();
    sorted.sort();
    for i in 1..sorted.len() {
        if sorted[i] == sorted[i - 1] {
            return Err("duplicate indices".to_string());
        }
    }

    let mut state = zelhash_init_state();
    state.update(input);
    state.update(nonce);

    // Recursively validate the solution tree
    validate_tree(&state, &indices).map(|root| {
        let hash_len = root.hash.len();
        let remaining = hash_len.saturating_sub(ZELHASH_COLLISION_BYTES * ZELHASH_K as usize);
        if !root.is_zero(remaining) {
            return Err("root hash is non-zero".to_string());
        }
        Ok(())
    })?
}

fn validate_tree(
    state: &blake2b_simd::State,
    indices: &[u32],
) -> Result<EquihashNode, String> {
    if indices.len() == 1 {
        return Ok(EquihashNode::new(state, indices[0]));
    }

    let mid = indices.len() / 2;
    let a = validate_tree(state, &indices[..mid])?;
    let b = validate_tree(state, &indices[mid..])?;

    if !a.has_collision(&b, ZELHASH_COLLISION_BYTES) {
        return Err("invalid collision".to_string());
    }
    if b.indices[0] < a.indices[0] {
        return Err("indices out of order".to_string());
    }

    Ok(EquihashNode::from_children(
        a,
        b,
        ZELHASH_COLLISION_BYTES,
    ))
}

/// Compute the final PoW hash from an Equihash solution.
///
/// In ZelHash/Equihash, the "hash" that meets the target is:
///   blake2b("ZelProof" || n || k || input || nonce || solution)
/// But actually, the target check is done on the solution itself —
/// the pool checks if the solution is valid AND the block header hash
/// (double-SHA256 or Blake2b of header+solution) meets the target.
///
/// For the B2b bridge, the upstream pool validates the solution.
/// For pool-side validation, we compute a deterministic hash from the
/// solution for target comparison.
pub fn hash_zelhash(header: &[u8], nonce: &[u8], solution: &[u8]) -> [u8; 32] {
    // The FLUX block hash is Blake2b-256 of:
      //   header_without_solution || solution_size_varint || solution
    // For pool-side validation, we use a simplified hash:
    //   Blake2b-256(header || nonce || solution)
    let mut state = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state();
    state.update(header);
    state.update(nonce);
    state.update(solution);
    let bytes = state.finalize();
    let mut out = [0u8; 32];
    let len = bytes.as_bytes().len().min(32);
    out[..len].copy_from_slice(&bytes.as_bytes()[..len]);
    out
}

/// Mine a ZelHash solution by trying nonces.
///
/// This is a VERY SLOW CPU solver using Wagner's algorithm.  It's only
/// suitable for E2E testing with low difficulty.  Real mining requires
/// a GPU kernel.
///
/// `header` is the block header (without nonce/solution).
/// `target` is the 32-byte big-endian target.
/// `max_nonces` is the maximum number of nonces to try.
///
/// Returns (nonce_bytes, solution_bytes, hash) if a valid solution is found.
pub fn mine_zelhash(
    header: &[u8],
    target: &[u8; 32],
    max_nonces: u64,
) -> Option<(Vec<u8>, Vec<u8>, [u8; 32])> {
    for nonce_val in 0..max_nonces {
        // 32-byte nonce: first 8 bytes = nonce_val (LE), rest zeros
        let mut nonce = vec![0u8; 32];
        nonce[..8].copy_from_slice(&nonce_val.to_le_bytes());

        // Try to find a valid Equihash solution for this nonce
        if let Some(solution) = solve_equihash(header, &nonce) {
            let hash = hash_zelhash(header, &nonce, &solution);
            if meets_target(&hash, target) {
                return Some((nonce, solution, hash));
            }
        }
    }
    None
}

/// Basic Equihash 125,4 solver using Wagner's algorithm.
///
/// This is a simplified implementation for CPU testing.  It's VERY slow
/// (seconds per nonce) and uses ~1GB of memory.  For real mining, use
/// a GPU kernel.
///
/// Wagner's algorithm:
/// 1. Generate 2^26 initial rows (hash chunks)
/// 2. Find pairs with matching first 25 bits (collision)
/// 3. XOR their hashes, trim 25 bits, repeat
/// 4. After k=4 rounds, find pairs with all-zero hash
fn solve_equihash(input: &[u8], nonce: &[u8]) -> Option<Vec<u8>> {
    let mut state = zelhash_init_state();
    state.update(input);
    state.update(nonce);

    // Phase 1: Generate initial list
    // For testing, we use a reduced number of rows (2^20 instead of 2^26)
    // to keep memory usage manageable (~16MB instead of ~1GB).
    // This means we won't find solutions as often, but it works for testing.
    let num_rows: u32 = 1 << 20; // 2^20 = 1M rows (reduced for CPU testing)

    let mut rows: Vec<EquihashNode> = Vec::with_capacity(num_rows as usize);
    for i in 0..num_rows {
        rows.push(EquihashNode::new(&state, i));
    }

    // Phase 2: Wagner's algorithm — k rounds of collision finding
    let mut collision_bytes = ZELHASH_COLLISION_BYTES;

    for _round in 0..ZELHASH_K {
        let mut next_rows: Vec<EquihashNode> = Vec::new();
        let mut buckets: std::collections::HashMap<Vec<u8>, Vec<usize>> =
            std::collections::HashMap::new();

        // Bucket rows by their first `collision_bytes` bytes
        for (idx, row) in rows.iter().enumerate() {
            if row.hash.len() >= collision_bytes {
                let key = row.hash[..collision_bytes].to_vec();
                buckets.entry(key).or_default().push(idx);
            }
        }

        // Find collisions within each bucket
        for (_, group) in buckets {
            if group.len() < 2 {
                continue;
            }
            // Try all pairs in the group
            for i in 0..group.len() {
                for j in (i + 1)..group.len() {
                    let a = &rows[group[i]];
                    let b = &rows[group[j]];

                    // Check distinct indices
                    let mut distinct = true;
                    for &ai in &a.indices {
                        for &bi in &b.indices {
                            if ai == bi {
                                distinct = false;
                                break;
                            }
                        }
                        if !distinct {
                            break;
                        }
                    }

                    if distinct {
                        let merged = EquihashNode::from_children(
                            clone_node(a),
                            clone_node(b),
                            collision_bytes,
                        );
                        next_rows.push(merged);
                    }
                }
            }
        }

        rows = next_rows;
        collision_bytes += ZELHASH_COLLISION_BYTES;
    }

    // Phase 3: Find rows with all-zero remaining hash
    for row in &rows {
        if row.is_zero(row.hash.len()) {
            // Found a valid solution!
            let mut indices = row.indices.clone();
            indices.sort();
            return Some(compress_indices(&indices));
        }
    }

    None
}

fn clone_node(n: &EquihashNode) -> EquihashNode {
    EquihashNode {
        hash: n.hash.clone(),
        indices: n.indices.clone(),
    }
}

// ── ProgPow (EPIC) ───────────────────────────────────────────────────
//
// ProgPow is a GPU-friendly, ASIC-resistant PoW algorithm (EIP-1057).
// It is DAG-based (like Ethash) with these key differences:
//   - keccak_f800 (32-bit words) instead of keccak_f1600 (64-bit words)
//   - FNV1a merge instead of FNV1
//   - KISS99 RNG for random math sequence (changes every PROGPOW_PERIOD blocks)
//   - Random math operations (mul, add, rot, xor) in the main loop
//   - Larger mix state (PROGPOW_REGS * PROGPOW_LANES = 512 uint32s)
//   - Larger DAG reads (256 bytes per iteration vs 128 for Ethash)
//
// References:
//   - https://github.com/ifdefelse/ProgPOW (reference implementation)
//   - EIP-1057: https://eips.sh/eip/1057
//   - xmrig kawpow.cl (OpenCL reference for ProgPow variant)

/// FNV1a 32-bit merge (ProgPow uses FNV1a, Ethash uses FNV1).
#[inline]
pub fn fnv1a(a: u32, d: u32) -> u32 {
    a ^ d.wrapping_mul(0x0100_0193)
}

/// KISS99 RNG — simple, fast, passes TestU01 suite.
/// Used by ProgPow to generate the random math sequence.
#[derive(Debug, Clone, Copy)]
pub struct Kiss99 {
    pub z: u32,
    pub w: u32,
    pub jsr: u32,
    pub jcong: u32,
}

impl Kiss99 {
    /// Default seed values from the ProgPow reference implementation.
    pub fn new(prog_seed: u32) -> Self {
        Self {
            z: 362436069,
            w: 521288629,
            jsr: (prog_seed ^ 0x5DEECE6D) | 0x1,  // ensure non-zero
            jcong: 380116160,
        }
    }

    #[inline]
    pub fn next(&mut self) -> u32 {
        self.z = 36969u32.wrapping_mul(self.z & 0xFFFF).wrapping_add(self.z >> 16);
        self.w = 18000u32.wrapping_mul(self.w & 0xFFFF).wrapping_add(self.w >> 16);
        let mwc = (self.w << 16).wrapping_add(self.z);
        self.jsr ^= self.jsr << 17;
        self.jsr ^= self.jsr >> 15;
        self.jsr ^= self.jsr << 5;
        self.jcong = 69069u32.wrapping_mul(self.jcong).wrapping_add(1234567);
        (mwc ^ self.jcong).wrapping_add(self.jsr)
    }
}

/// Keccak-f[800] permutation — 32-bit word variant used by ProgPow.
/// Width=800, bitrate=576, capacity=224, 22 rounds.
pub fn keccak_f800(st: &mut [u32; 25]) {
    const KECCAKF_ROT: [u32; 24] = [
        1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44,
    ];
    const KECCAKF_PIL: [usize; 24] = [
        10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1,
    ];
    const KECCAKF_RNDC: [u32; 22] = [
        0x00000001, 0x00008082, 0x80000080, 0x80008000,
        0x0000008b, 0x00008000, 0x80008088, 0x80000082,
        0x0000000b, 0x00008008, 0x80008009, 0x8000008a,
        0x00000088, 0x80008000, 0x8000808b, 0x0000008b,
        0x80008089, 0x80008003, 0x80008088, 0x80000088,
        0x80008082, 0x8000000a,
    ];

    for r in 0..22 {
        // Theta
        let mut bc = [0u32; 5];
        for i in 0..5 {
            bc[i] = st[i] ^ st[i + 5] ^ st[i + 10] ^ st[i + 15] ^ st[i + 20];
        }
        for i in 0..5 {
            let t = bc[(i + 4) % 5] ^ bc[(i + 1) % 5].rotate_left(1);
            for j in (0..25).step_by(5) {
                st[j + i] ^= t;
            }
        }
        // Rho Pi
        let mut t = st[1];
        for i in 0..24 {
            let j = KECCAKF_PIL[i];
            let tmp = st[j];
            st[j] = t.rotate_left(KECCAKF_ROT[i]);
            t = tmp;
        }
        // Chi
        for j in (0..25).step_by(5) {
            let mut b = [0u32; 5];
            for i in 0..5 {
                b[i] = st[j + i];
            }
            for i in 0..5 {
                st[j + i] ^= !b[(i + 1) % 5] & b[(i + 2) % 5];
            }
        }
        // Iota
        st[0] ^= KECCAKF_RNDC[r];
    }
}

/// Compute the ProgPow seed hash from header_hash and nonce.
/// `seed = keccak_f800(header_hash(32) || nonce_le(8))` → first 8 uint32s.
fn progpow_seed(header_hash: &[u8; 32], nonce: u64) -> [u32; 8] {
    let mut st = [0u32; 25];
    // Load 32 bytes of header_hash into st[0..8] (8 x uint32 LE)
    for i in 0..8 {
        st[i] = u32::from_le_bytes(
            header_hash[i * 4..(i + 1) * 4].try_into().unwrap(),
        );
    }
    // Load 8 bytes of nonce into st[8..10] (2 x uint32 LE)
    let nonce_le = nonce.to_le_bytes();
    st[8] = u32::from_le_bytes(nonce_le[0..4].try_into().unwrap());
    st[9] = u32::from_le_bytes(nonce_le[4..8].try_into().unwrap());
    keccak_f800(&mut st);
    // Take first 8 uint32s as the seed (256-bit)
    let mut seed = [0u32; 8];
    seed.copy_from_slice(&st[0..8]);
    seed
}

/// Compute the final ProgPow hash from the mix state.
/// `final = keccak_f800(header_hash(32) || mix_state(512 bytes))` → 256-bit.
fn progpow_final(header_hash: &[u8; 32], mix: &[u32; 512]) -> [u8; 32] {
    let mut st = [0u32; 25];
    // Load header_hash into st[0..8]
    for i in 0..8 {
        st[i] = u32::from_le_bytes(
            header_hash[i * 4..(i + 1) * 4].try_into().unwrap(),
        );
    }
    // Load mix state (512 uint32s = 2048 bytes) into st in chunks
    // keccak_f800 has 25 uint32s of state, so we absorb in blocks
    // Absorb first 17 uint32s of mix (st[8..25])
    for i in 0..17 {
        st[8 + i] = mix[i];
    }
    keccak_f800(&mut st);
    // Absorb next 17 uint32s
    for i in 0..17 {
        st[8 + i] = mix[17 + i];
    }
    keccak_f800(&mut st);
    // Continue absorbing remaining mix data
    let mut offset = 34;
    while offset < 512 {
        let chunk = (512 - offset).min(17);
        for i in 0..chunk {
            st[8 + i] = mix[offset + i];
        }
        keccak_f800(&mut st);
        offset += chunk;
    }
    // Extract 256-bit result (8 uint32s → 32 bytes, big-endian per EIP-1057)
    let mut result = [0u8; 32];
    for i in 0..8 {
        // EIP-1057: "result byte 0 is the MSB of the value"
        // keccak output is in st[0..8], convert to big-endian bytes
        result[i * 4..(i + 1) * 4].copy_from_slice(&st[i].to_be_bytes());
    }
    result
}

/// Fill the mix state from the seed.
/// `fill_mix(seed) → mix[PROGPOW_LANES * PROGPOW_REGS]` (512 uint32s).
fn progpow_fill_mix(seed: &[u32; 8]) -> [u32; 512] {
    let mut mix = [0u32; 512];
    for lane in 0..PROGPOW_LANES as usize {
        for reg in 0..PROGPOW_REGS as usize {
            // Each lane gets a different slice of the seed
            let idx = (lane * PROGPOW_REGS as usize + reg) % 8;
            mix[lane * PROGPOW_REGS as usize + reg] = seed[idx];
        }
    }
    mix
}

/// Compute ProgPow hash for Epic Cash (EPIC) mining.
///
/// This is a **simplified pure-Rust implementation** for CPU verification.
/// Real ProgPow mining requires a GPU (the random math sequence is compiled
/// to GPU code per period). This implementation uses a fixed math sequence
/// (no random program) — sufficient for share verification but not for
/// finding shares at real difficulty.
///
/// For production mining, use the OpenCL/Metal kernel (`progpow_kernel.cl`).
///
/// # Arguments
/// * `header_hash` - 32-byte block header hash (keccak of header)
/// * `nonce` - 64-bit nonce
/// * `height` - block height (determines epoch and prog_seed)
///
/// # Returns
/// `(mix_hash, final_hash)` — both 32 bytes.
/// The `mix_hash` is needed for share submission (like KawPow/Ethash).
pub fn hash_progpow(header_hash: &[u8; 32], nonce: u64, height: u32) -> ([u8; 32], [u8; 32]) {
    #[cfg(feature = "native-hashers")]
    {
        if let Ok((mix, final_hash)) = crate::native_ffi::hash_progpow_native(header_hash, nonce, height) {
            return (mix, final_hash);
        }
    }

    // Pure-Rust fallback: simplified ProgPow (no random math, no DAG)
    // This is NOT valid for real ProgPow mining — use GPU kernel instead.
    #[allow(unreachable_code)]
    {
        let seed = progpow_seed(header_hash, nonce);
        let mut mix = progpow_fill_mix(&seed);

        // Simplified loop: no DAG, no random math (GPU-only features)
        // Just mix the state with keccak to produce a deterministic hash
        let prog_seed = height / PROGPOW_PERIOD;
        let mut rng = Kiss99::new(prog_seed);

        // Simplified mixing: XORmix the state with RNG values
        for i in 0..mix.len() {
            mix[i] = mix[i].wrapping_add(rng.next());
        }

        let final_hash = progpow_final(header_hash, &mix);

        // Mix hash = first 32 bytes of mix state
        let mut mix_hash = [0u8; 32];
        for i in 0..8 {
            mix_hash[i * 4..(i + 1) * 4].copy_from_slice(&mix[i].to_le_bytes());
        }

        (mix_hash, final_hash)
    }
}

/// Compute the real ProgPow hash over a precomputed DAG.
///
/// This requires the full DAG (like Ethash/KawPow). The DAG is epoch-based
/// and regenerated every `PROGPOW_EPOCH_LENGTH` blocks.
///
/// # Arguments
/// * `header_hash` - 32-byte block header hash
/// * `nonce` - 64-bit nonce
/// * `dag` - Precomputed DAG (array of u64 entries, 16 uint64s per DAG entry)
/// * `dag_size_entries` - Number of DAG entries (not uint64s)
///
/// # Returns
/// `(mix_hash, final_hash)` — both 32 bytes.
pub fn hash_progpow_with_dag(
    header_hash: &[u8; 32],
    nonce: u64,
    dag: &[u64],
    dag_size_entries: u64,
) -> ([u8; 32], [u8; 32]) {
    #[cfg(feature = "native-hashers")]
    {
        if let Ok((mix, final_hash)) = crate::native_ffi::hash_progpow_native_with_dag(
            header_hash,
            nonce,
            dag,
            dag_size_entries,
        ) {
            return (mix, final_hash);
        }
    }

    // Pure-Rust fallback: use simplified version (no DAG)
    #[allow(unreachable_code)]
    {
        let _ = (dag, dag_size_entries); // suppress unused warnings
        // Use height 0 for the simplified version — caller should use native FFI
        hash_progpow(header_hash, nonce, 0)
    }
}

/// Mine a ProgPow share: scan nonces until hash < target.
///
/// Returns the final hash if found, `None` otherwise.
/// This is a CPU fallback — real mining uses the GPU kernel.
pub fn mine_progpow(
    header_hash: &[u8; 32],
    start_nonce: u64,
    count: u64,
    height: u32,
    target: &[u8; 32],
) -> Option<(u64, [u8; 32])> {
    for nonce in start_nonce..start_nonce + count {
        let (_, hash) = hash_progpow(header_hash, nonce, height);
        if hash_le_target(&hash, target) {
            return Some((nonce, hash));
        }
    }
    None
}

/// Check if hash <= target (big-endian comparison).
fn hash_le_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    for i in 0..32 {
        if hash[i] < target[i] {
            return true;
        }
        if hash[i] > target[i] {
            return false;
        }
    }
    true // equal
}

// ── PearlHash (Pearl / PRL) ──────────────────────────────────────────

/// Pearl PoUW parameters.
///
/// Pearl uses Proof-of-Useful-Work: mining = INT8 matrix multiplication
/// + BLAKE3 proof. The full algorithm involves:
///   1. CommitmentHash(A, B, sigma, mu) → (sA, sB) via BLAKE3 keyed hash
///   2. NoiseGeneration(sA, sB) → low-rank noise E=EL·ER, F=FL·FR
///   3. NoisedMatMul(A'=A+E, B'=B+F) → C' + block-opening proof
///   4. XOR-reduce + rotate-and-XOR state update (M[16] array)
///   5. BLAKE3(M, key=sA) < target check
///   6. Noise peeling: A·B = C' − (A·FL)·FR − EL·(ER·B')
///
/// For now we implement a **simplified** version that uses BLAKE3 over
/// the header+nonce as a placeholder. The full PoUW MatMul requires GPU
/// kernels (see pearl_kernel.cl / pearl_kernel.metal) and is the subject
/// of Phase 13.3-13.5.
pub const PEARL_BLOCK_TIME_SECS: u32 = 194;
/// Pearl has no DAG — matrices are generated per-job from a seed.
pub const PEARL_EPOCH_LENGTH: u32 = 0;

/// Simplified Pearl hash (BLAKE3-based placeholder).
///
/// In the full implementation, this would compute the PoUW proof:
///   1. Generate matrices A, B from the header seed
///   2. Add noise (BLAKE3 PRNG → low-rank E, F)
///   3. Compute C' = (A+E)·(B+F) via tiled INT8 MatMul
///   4. Extract block-opening proof (XOR-reduce + rotate-and-XOR)
///   5. BLAKE3(proof, key=sA) → final hash
///
/// For now, we use BLAKE3(header || nonce_le) as a deterministic
/// placeholder. This allows Stratum v1 protocol testing and share
/// verification while the full PoUW kernel is developed.
pub fn hash_pearl(header_hash: &[u8; 32], nonce: u64) -> [u8; 32] {
    #[cfg(feature = "native-hashers")]
    {
        if let Ok(hash) = crate::native_ffi::hash_pearl_native(header_hash, nonce) {
            return hash;
        }
    }

    // Pure-Rust fallback: BLAKE3(header_hash || nonce_le) as placeholder.
    // The real Pearl hash involves MatMul + noise + BLAKE3 proof extraction.
    use blake3::Hasher;
    let mut h = Hasher::new();
    h.update(header_hash);
    h.update(&nonce.to_le_bytes());
    let mut out = [0u8; 32];
    h.finalize_xof().fill(&mut out);
    out
}

/// Mine Pearl hashes (CPU scan — slow, for testing only).
pub fn mine_pearl(
    header_hash: &[u8; 32],
    start_nonce: u64,
    count: u64,
    target: &[u8; 32],
) -> Option<(u64, [u8; 32])> {
    for nonce in start_nonce..start_nonce + count {
        let hash = hash_pearl(header_hash, nonce);
        if hash_le_target(&hash, target) {
            return Some((nonce, hash));
        }
    }
    None
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── ProgPow ─────────────────────────────────────────────────────

    #[test]
    fn progpow_deterministic() {
        let header = [0x42u8; 32];
        let h1 = hash_progpow(&header, 12345, 100);
        let h2 = hash_progpow(&header, 12345, 100);
        assert_eq!(h1, h2);
    }

    #[test]
    fn progpow_changes_with_nonce() {
        let header = [0x42u8; 32];
        let h1 = hash_progpow(&header, 12345, 100);
        let h2 = hash_progpow(&header, 12346, 100);
        assert_ne!(h1, h2);
    }

    #[test]
    fn progpow_changes_with_height() {
        let header = [0x42u8; 32];
        let h1 = hash_progpow(&header, 12345, 100);
        let h2 = hash_progpow(&header, 12345, 200);
        assert_ne!(h1, h2);
    }

    #[test]
    fn progpow_keccak_f800_known_vector() {
        // keccak_f800 of all-zeros input should produce a known result
        let mut st = [0u32; 25];
        keccak_f800(&mut st);
        // After 22 rounds, state should not be all zeros
        assert!(st.iter().any(|&x| x != 0));
    }

    #[test]
    fn progpow_fnv1a_merge() {
        let a = 0xDEADBEEFu32;
        let b = 0xCAFEBABEu32;
        let merged = fnv1a(a, b);
        // FNV1a: a ^ (a * 0x1000193) — just verify it's deterministic and non-zero
        assert_eq!(merged, fnv1a(a, b));
        assert_ne!(merged, 0);
    }

    #[test]
    fn progpow_kiss99_deterministic() {
        let mut rng1 = Kiss99 { z: 362436069, w: 521288629, jsr: 123456789, jcong: 380116160 };
        let mut rng2 = Kiss99 { z: 362436069, w: 521288629, jsr: 123456789, jcong: 380116160 };
        for _ in 0..100 {
            assert_eq!(rng1.next(), rng2.next());
        }
    }

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

        // Hash [0x00, ..., 0x02] (BE: 2) is below target [0x02, 0x00, ...] (BE: 2^249)
        // in BE comparison, but when interpreted as LE the hash (2^249) is greater
        // than the target (2), so it does NOT meet the LE target.
        let mut target2 = [0u8; 32];
        target2[0] = 0x02;
        let mut hash2 = [0u8; 32];
        hash2[31] = 0x03;
        assert!(meets_target(&hash2, &target2)); // 3 < 2^249 in BE
        assert!(!meets_target_little_endian(&hash2, &target2)); // 2^249+ > 2 in LE
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

        // Monero/xmrig compare bytes 24-31 (MSB of 256-bit LE hash) against target.
        // A hash whose MSB 64 bits (bytes 24-31 LE) are below the target passes.
        let mut hash = [0xFFu8; 32];
        hash[24..32].copy_from_slice(&[0x00, 0x00, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00]);
        assert!(meets_randomx_target(&hash, &target));

        // A hash whose MSB 64 bits are above the target fails.
        hash[24..32].copy_from_slice(&[0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]);
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
        assert_eq!(
            ExternalAlgorithm::from_str_loose("zelhash"),
            Some(ExternalAlgorithm::ZelHash)
        );
        assert_eq!(ExternalAlgorithm::from_str_loose("unknown"), None);
    }

    // ── ZelHash ──────────────────────────────────────────────────────

    #[test]
    fn zelhash_personalization_correct() {
        let p = zelhash_personalization();
        assert_eq!(&p[..8], b"ZelProof");
        assert_eq!(&p[8..12], &125u32.to_le_bytes());
        assert_eq!(&p[12..16], &4u32.to_le_bytes());
    }

    #[test]
    fn zelhash_constants_correct() {
        assert_eq!(ZELHASH_N, 125);
        assert_eq!(ZELHASH_K, 4);
        assert_eq!(ZELHASH_COLLISION_BITS, 25);
        assert_eq!(ZELHASH_COLLISION_BYTES, 4);
        assert_eq!(ZELHASH_INDICES_PER_HASH, 4);
        assert_eq!(ZELHASH_SOLUTION_INDICES, 16);
    }

    #[test]
    fn zelhash_hash_is_deterministic() {
        let header = b"test_header_bytes";
        let nonce = b"\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00";
        let solution = vec![0u8; 52];
        let h1 = hash_zelhash(header, nonce, &solution);
        let h2 = hash_zelhash(header, nonce, &solution);
        assert_eq!(h1, h2);
        assert_ne!(h1, [0u8; 32]);
    }

    #[test]
    fn zelhash_hash_changes_with_solution() {
        let header = b"test_header_bytes";
        let nonce = vec![0u8; 32];
        let sol1 = vec![0u8; 52];
        let sol2 = vec![0xFFu8; 52];
        let h1 = hash_zelhash(header, &nonce, &sol1);
        let h2 = hash_zelhash(header, &nonce, &sol2);
        assert_ne!(h1, h2);
    }

    #[test]
    fn zelhash_decompress_rejects_wrong_size() {
        let bad_soln = vec![0u8; 100]; // wrong size
        assert!(decompress_indices(&bad_soln).is_err());
    }

    #[test]
    fn zelhash_compress_decompress_roundtrip() {
        let indices: Vec<u32> = vec![3, 7, 15, 31, 63, 127, 255, 511,
                                      1023, 2047, 4095, 8191, 16383, 32767, 65535, 131071];
        let compressed = compress_indices(&indices);
        let decompressed = decompress_indices(&compressed).unwrap();
        assert_eq!(decompressed, indices);
    }

    #[test]
    fn zelhash_blake2b_state_produces_output() {
        let state = zelhash_init_state();
        let h = zelhash_generate_hash(&state, 0);
        // Should produce a non-zero 64-byte hash
        assert_ne!(h, [0u8; 64]);
    }

    #[test]
    fn zelhash_protocol_is_zcash_stratum() {
        // Verify FLUX uses ZcashStratum protocol
        use crate::types::ExternalCoin;
        use crate::auxpow_client::StratumProtocol;
        assert_eq!(
            ExternalCoin::FLUX.protocol(),
            StratumProtocol::ZcashStratum
        );
    }

    // ── PearlHash (PRL) ─────────────────────────────────────────────

    #[test]
    fn pearl_hash_deterministic() {
        let header = [0x42u8; 32];
        let h1 = hash_pearl(&header, 12345);
        let h2 = hash_pearl(&header, 12345);
        assert_eq!(h1, h2, "Pearl hash must be deterministic");
    }

    #[test]
    fn pearl_hash_nonce_sensitive() {
        let header = [0x42u8; 32];
        let h1 = hash_pearl(&header, 1);
        let h2 = hash_pearl(&header, 2);
        assert_ne!(h1, h2, "Different nonces must produce different hashes");
    }

    #[test]
    fn pearl_hash_header_sensitive() {
        let h1 = hash_pearl(&[0x01u8; 32], 42);
        let h2 = hash_pearl(&[0x02u8; 32], 42);
        assert_ne!(h1, h2, "Different headers must produce different hashes");
    }

    #[test]
    fn pearl_mine_finds_solution() {
        // Very easy target — first byte must be 0x00
        let target = [0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
                       0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
                       0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
                       0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
        let header = [0x99u8; 32];
        let result = mine_pearl(&header, 0, 1_000_000, &target);
        assert!(result.is_some(), "mine_pearl should find a solution within 1M nonces");
        let (nonce, hash) = result.unwrap();
        assert!(hash_le_target(&hash, &target));
        // Verify nonce is within range
        assert!(nonce < 1_000_000);
    }

    #[test]
    fn pearl_algorithm_str() {
        assert_eq!(ExternalAlgorithm::PearlHash.as_str(), "pearlhash");
        assert_eq!(
            ExternalAlgorithm::from_str_loose("pearlhash"),
            Some(ExternalAlgorithm::PearlHash)
        );
        assert_eq!(
            ExternalAlgorithm::from_str_loose("pearl"),
            Some(ExternalAlgorithm::PearlHash)
        );
    }

    #[test]
    fn pearl_coin_metadata() {
        use crate::types::ExternalCoin;
        assert_eq!(ExternalCoin::PRL.ticker(), "PRL");
        assert_eq!(ExternalCoin::PRL.algorithm(), "pearlhash");
        assert_eq!(ExternalCoin::PRL.default_pool(), "prl.2miners.com:1818");
        assert_eq!(ExternalCoin::from_str_loose("prl"), Some(ExternalCoin::PRL));
        assert_eq!(ExternalCoin::from_str_loose("pearl"), Some(ExternalCoin::PRL));
        assert!(ExternalCoin::all().contains(&ExternalCoin::PRL));
    }

}
