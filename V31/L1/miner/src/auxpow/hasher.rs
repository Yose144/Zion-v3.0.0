//! External algorithm hashing dispatcher.
//!
//! By default the runtime uses the pure-Rust stubs in `pure.rs`. Enabling the
//! `native-hashers` feature switches to `native.rs`, which is a placeholder for
//! real FFI/GPU kernels and currently delegates back to `pure.rs`.

#![allow(clippy::needless_range_loop, clippy::type_complexity)]

use blake3::Hasher as Blake3Hasher;
use sha3::digest::{ExtendableOutput, Update, XofReader};
use sha3::{CShake256, CShake256Core, Digest, Keccak256, Keccak512, Sha3_256};
use zion_cosmic_harmony::ExternalCoin;

/// Hash `header || nonce_le` with the algorithm used by `coin`.
pub fn hash_for_coin(coin: ExternalCoin, header: &[u8], nonce: u64) -> [u8; 32] {
    #[cfg(feature = "native-hashers")]
    {
        crate::auxpow::native::hash_for_coin(coin, header, nonce)
    }
    #[cfg(not(feature = "native-hashers"))]
    {
        crate::auxpow::pure::hash_for_coin(coin, header, nonce)
    }
}

/// Check whether `hash` meets the 32-byte `target` (big-endian comparison).
pub fn meets_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash <= target
}

/// Check whether `hash` meets the 32-byte `target` (little-endian comparison).
#[inline]
pub fn meets_target_little_endian(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    let mut h_be = [0u8; 32];
    h_be.copy_from_slice(hash);
    h_be.reverse();
    let mut t_be = [0u8; 32];
    t_be.copy_from_slice(target);
    t_be.reverse();
    h_be <= t_be
}

// ── Blake3 ───────────────────────────────────────────────────────────

pub const DCR_NONCE_OFFSET: usize = 140;
pub const DCR_HEADER_SIZE: usize = 180;
pub const DCR_NONCE_SIZE: usize = 4;

pub fn hash_blake3(header: &[u8], _timestamp: u64, nonce: u64) -> [u8; 32] {
    let mut full_header = [0u8; DCR_HEADER_SIZE];
    let copy_len = header.len().min(DCR_HEADER_SIZE);
    full_header[..copy_len].copy_from_slice(&header[..copy_len]);
    let nonce_bytes = (nonce as u32).to_le_bytes();
    full_header[DCR_NONCE_OFFSET..DCR_NONCE_OFFSET + DCR_NONCE_SIZE].copy_from_slice(&nonce_bytes);
    blake3::hash(&full_header).into()
}

pub fn hash_blake3_raw(input: &[u8]) -> [u8; 32] {
    let mut hasher = Blake3Hasher::new();
    hasher.update(input);
    *hasher.finalize().as_bytes()
}

pub fn hash_blake3_alph(header_blob: &[u8], extranonce1: &[u8], nonce: u64) -> [u8; 32] {
    let mut base_bytes = [0u8; 8];
    let en1_len = extranonce1.len().min(8);
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

pub fn hash_kheavyhash(pre_pow_hash: &[u8], timestamp: u64, nonce: u64) -> [u8; 32] {
    let mut pow_hasher = CShake256::from_core(CShake256Core::new(b"ProofOfWorkHash"));
    pow_hasher.update(pre_pow_hash);
    pow_hasher.update(&timestamp.to_le_bytes());
    pow_hasher.update(&[0u8; 32]);
    pow_hasher.update(&nonce.to_le_bytes());
    let mut pow_hash = [0u8; 32];
    pow_hasher.finalize_xof().read(&mut pow_hash);

    let matrix = kheavy_matrix();
    let product = matrix.heavy_hash(&pow_hash);

    let mut heavy_hasher = CShake256::from_core(CShake256Core::new(b"HeavyHash"));
    heavy_hasher.update(&product);
    let mut heavy_hash = [0u8; 32];
    heavy_hasher.finalize_xof().read(&mut heavy_hash);

    heavy_hash
}

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

    let mut pow_hasher = CShake256::from_core(CShake256Core::new(b"ProofOfWorkHash"));
    pow_hasher.update(pre_pow_hash);
    pow_hasher.update(&timestamp.to_le_bytes());
    pow_hasher.update(&[0u8; 32]);
    pow_hasher.update(&full_nonce);
    let mut pow_hash = [0u8; 32];
    pow_hasher.finalize_xof().read(&mut pow_hash);

    let matrix = kheavy_matrix();
    let product = matrix.heavy_hash(&pow_hash);

    let mut heavy_hasher = CShake256::from_core(CShake256Core::new(b"HeavyHash"));
    heavy_hasher.update(&product);
    let mut heavy_hash = [0u8; 32];
    heavy_hasher.finalize_xof().read(&mut heavy_hash);

    heavy_hash
}

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

struct KheavyMatrix([[u16; 64]; 64]);

impl KheavyMatrix {
    fn generate() -> Self {
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

    fn heavy_hash(&self, hash: &[u8; 32]) -> [u8; 32] {
        let mut vec = [0u8; 64];
        for (i, &byte) in hash.iter().enumerate() {
            vec[2 * i] = byte >> 4;
            vec[2 * i + 1] = byte & 0x0F;
        }

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

        for (p, h) in product.iter_mut().zip(hash.iter()) {
            *p ^= h;
        }
        product
    }
}

fn kheavy_matrix() -> &'static KheavyMatrix {
    use std::sync::OnceLock;
    static MATRIX: OnceLock<KheavyMatrix> = OnceLock::new();
    MATRIX.get_or_init(KheavyMatrix::generate)
}

pub fn kheavyhash_matrix_flat() -> [u16; 4096] {
    let m = kheavy_matrix();
    let mut flat = [0u16; 4096];
    for i in 0..64 {
        for j in 0..64 {
            flat[i * 64 + j] = m.0[i][j];
        }
    }
    flat
}

// ── KeryxHash (Keryx / KRX) ──────────────────────────────────────────

pub const KERYX_MATRIX_SALT_V1: [u8; 32] = *b"KERYX:KeryxHash-v1:2026-04-12:xx";
pub const KERYX_MATRIX_SALT_V2: [u8; 32] = *b"KERYX:KeryxHash-v2:2026-05-29:xx";
pub const KERYX_MATRIX_SALT_V4: [u8; 32] = *b"KERYX:KeryxHash-v4:2026-06-07:xx";
pub const KERYX_SALT_V2_ACTIVATION_DAA: u64 = 17_275_000;
pub const KERYX_SALT_V4_ACTIVATION_DAA: u64 = 21_932_751;

#[inline(always)]
pub fn keryx_active_salt_version(daa_score: u64) -> u8 {
    if daa_score >= KERYX_SALT_V4_ACTIVATION_DAA {
        4
    } else if daa_score >= KERYX_SALT_V2_ACTIVATION_DAA {
        2
    } else {
        1
    }
}

#[inline(always)]
pub fn keryx_active_salt(daa_score: u64) -> &'static [u8; 32] {
    match keryx_active_salt_version(daa_score) {
        1 => &KERYX_MATRIX_SALT_V1,
        2 => &KERYX_MATRIX_SALT_V2,
        _ => &KERYX_MATRIX_SALT_V4,
    }
}

const KERYX_WAVE_MIX_KEYS: [u64; 4] = [
    0x9e3779b97f4a7c15,
    0x6c62272e07bb0142,
    0xb5ad4eceda1ce2a9,
    0x243f6a8885a308d3,
];

const KERYX_WAVE_MIX_ROTATIONS: [u32; 4] = [17, 31, 47, 13];

#[inline(always)]
fn keryx_wave_mix(bytes: [u8; 32]) -> [u8; 32] {
    let mut w = [
        u64::from_le_bytes(bytes[0..8].try_into().unwrap()),
        u64::from_le_bytes(bytes[8..16].try_into().unwrap()),
        u64::from_le_bytes(bytes[16..24].try_into().unwrap()),
        u64::from_le_bytes(bytes[24..32].try_into().unwrap()),
    ];
    for r in 0..4usize {
        w[0] = w[0]
            .wrapping_add(w[1])
            .rotate_left(KERYX_WAVE_MIX_ROTATIONS[0])
            ^ KERYX_WAVE_MIX_KEYS[r & 3];
        w[2] = w[2]
            .wrapping_add(w[3])
            .rotate_left(KERYX_WAVE_MIX_ROTATIONS[2])
            ^ KERYX_WAVE_MIX_KEYS[(r + 2) & 3];
        w[1] = w[1]
            .wrapping_add(w[2])
            .rotate_left(KERYX_WAVE_MIX_ROTATIONS[1])
            ^ KERYX_WAVE_MIX_KEYS[(r + 1) & 3];
        w[3] = w[3]
            .wrapping_add(w[0])
            .rotate_left(KERYX_WAVE_MIX_ROTATIONS[3])
            ^ KERYX_WAVE_MIX_KEYS[(r + 3) & 3];
    }
    let mut out = [0u8; 32];
    out[0..8].copy_from_slice(&w[0].to_le_bytes());
    out[8..16].copy_from_slice(&w[1].to_le_bytes());
    out[16..24].copy_from_slice(&w[2].to_le_bytes());
    out[24..32].copy_from_slice(&w[3].to_le_bytes());
    out
}

pub fn generate_keryx_matrix(pre_pow_hash: &[u8], daa_score: u64) -> [[u16; 64]; 64] {
    let salt = keryx_active_salt(daa_score);
    let mut salted = [0u8; 32];
    salted
        .iter_mut()
        .zip(pre_pow_hash.iter().zip(salt.iter()))
        .for_each(|(out, (h, s))| *out = *h ^ *s);
    let mut rng = XoShiRo256PlusPlus::new(salted);
    loop {
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
        if keryx_matrix_rank(&mat) == 64 {
            return mat;
        }
    }
}

fn keryx_matrix_rank(mat: &[[u16; 64]; 64]) -> usize {
    const EPS: f64 = 1e-9;
    let mut m = [[0.0f64; 64]; 64];
    for i in 0..64 {
        for j in 0..64 {
            m[i][j] = mat[i][j] as f64;
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

pub fn hash_keryxhash(pre_pow_hash: &[u8], timestamp: u64, nonce: u64, daa_score: u64) -> [u8; 32] {
    let mut pow_hasher = CShake256::from_core(CShake256Core::new(b"ProofOfWorkHash"));
    pow_hasher.update(pre_pow_hash);
    pow_hasher.update(&timestamp.to_le_bytes());
    pow_hasher.update(&[0u8; 32]);
    pow_hasher.update(&nonce.to_le_bytes());
    let mut pow_hash = [0u8; 32];
    pow_hasher.finalize_xof().read(&mut pow_hash);

    let matrix = generate_keryx_matrix(pre_pow_hash, daa_score);
    let product = keryx_matrix_heavy_hash(&matrix, &pow_hash);
    let product = keryx_wave_mix(product);

    let mut heavy_hasher = CShake256::from_core(CShake256Core::new(b"HeavyHash"));
    heavy_hasher.update(&product);
    let mut heavy_hash = [0u8; 32];
    heavy_hasher.finalize_xof().read(&mut heavy_hash);

    heavy_hash
}

pub fn hash_keryxhash_extranonce(
    pre_pow_hash: &[u8],
    timestamp: u64,
    extranonce1: &[u8],
    suffix: u64,
    daa_score: u64,
) -> [u8; 32] {
    let mut full_nonce = [0u8; 8];
    let en1_len = extranonce1.len().min(8);
    full_nonce[..en1_len].copy_from_slice(&extranonce1[..en1_len]);
    let suffix_len = 8 - en1_len;
    if suffix_len > 0 {
        full_nonce[en1_len..8].copy_from_slice(&suffix.to_le_bytes()[..suffix_len]);
    }
    hash_keryxhash(
        pre_pow_hash,
        timestamp,
        u64::from_le_bytes(full_nonce),
        daa_score,
    )
}

fn keryx_matrix_heavy_hash(matrix: &[[u16; 64]; 64], hash: &[u8; 32]) -> [u8; 32] {
    let mut vec = [0u8; 64];
    for (i, &byte) in hash.iter().enumerate() {
        vec[2 * i] = byte >> 4;
        vec[2 * i + 1] = byte & 0x0F;
    }
    let mut product = [0u8; 32];
    for i in 0..32 {
        let mut sum1: u32 = 0;
        let mut sum2: u32 = 0;
        for (j, &elem) in vec.iter().enumerate() {
            sum1 += (matrix[2 * i][j] * (elem as u16)) as u32;
            sum2 += (matrix[2 * i + 1][j] * (elem as u16)) as u32;
        }
        product[i] = (((sum1 >> 10) << 4) as u8) | ((sum2 >> 10) as u8);
    }
    for (p, h) in product.iter_mut().zip(hash.iter()) {
        *p ^= h;
    }
    product
}

// ── Autolykos (Ergo) ─────────────────────────────────────────────────

pub const AUTOLYKOS_NONCE_SIZE: usize = 8;

pub fn hash_autolykos(header: &[u8], nonce: u64, _height: u32) -> [u8; 32] {
    let mut input = Vec::with_capacity(header.len() + AUTOLYKOS_NONCE_SIZE);
    input.extend_from_slice(header);
    input.extend_from_slice(&nonce.to_le_bytes());
    let h = blake2b_simd::blake2b(&input);
    let mut out = [0u8; 32];
    out.copy_from_slice(&h.as_bytes()[..32]);
    out
}

pub fn is_valid_autolykos_solution(_header: &[u8], _nonce: u64, _solution: &[u8]) -> bool {
    false
}

// ── VerusHash (Verus) ────────────────────────────────────────────────

pub const VERUS_HEADER_SIZE: usize = 1487;
pub const VERUS_SOLUTION_SIZE: usize = 1344;
pub const VERUS_SOLUTION_OFFSET: usize = 143;
pub const VERUS_NONCE_SPACE_SIZE: usize = 15;
pub const VERUS_NONCE_SPACE_OFFSET: usize = VERUS_SOLUTION_OFFSET + 1329; // 1472
pub const VERUS_NONCE_FIELD_SIZE: usize = 32;

/// Clear non-canonical PBaaS v7+ VerusCoin header fields in-place.
/// This matches what the upstream pool does before hashing a share,
/// so the miner's local hash computation uses the same canonical data.
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

    // Zero non-canonical fields in the 140-byte header prefix.
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

    // Zero MMR roots stored in the first 72 bytes of the solution.
    let mmr_start = SOLUTION_OFFSET + 8;
    let mmr_end = SOLUTION_OFFSET + 72;
    if header.len() >= mmr_end {
        for b in &mut header[mmr_start..mmr_end] {
            *b = 0;
        }
    }
}

/// Build a Zcash compact-size varint for a solution length.
pub fn zcash_varint_for_len(len: usize) -> Vec<u8> {
    if len < 0xfd {
        vec![len as u8]
    } else if len <= 0xffff {
        let mut v = vec![0xfd];
        v.extend_from_slice(&(len as u16).to_le_bytes());
        v
    } else if len <= 0xffff_ffff {
        let mut v = vec![0xfe];
        v.extend_from_slice(&(len as u32).to_le_bytes());
        v
    } else {
        let mut v = vec![0xff];
        v.extend_from_slice(&(len as u64).to_le_bytes());
        v
    }
}

#[cfg(feature = "native-verushash")]
pub fn hash_verushash(header: &[u8], nonce: u64) -> [u8; 32] {
    zion_native_ffi::verushash::hash(header, nonce)
}

#[cfg(not(feature = "native-verushash"))]
pub fn hash_verushash(header: &[u8], nonce: u64) -> [u8; 32] {
    // Stub: without the native C++ implementation we cannot produce a valid
    // VerusHash. Returning a deterministic dummy keeps compilation/tests green
    // but VRSC shares will be rejected by real pools.
    let mut input = Vec::with_capacity(header.len() + 8);
    input.extend_from_slice(header);
    input.extend_from_slice(&nonce.to_le_bytes());
    let mut out = [0u8; 32];
    let h = sha2::Sha256::digest(&input);
    out.copy_from_slice(&h);
    out
}

#[cfg(feature = "native-verushash")]
pub fn hash_verushash_header(header: &[u8]) -> [u8; 32] {
    zion_native_ffi::verushash::hash_raw(header)
}

#[cfg(not(feature = "native-verushash"))]
pub fn hash_verushash_header(header: &[u8]) -> [u8; 32] {
    let h = sha2::Sha256::digest(header);
    let mut out = [0u8; 32];
    out.copy_from_slice(&h);
    out
}

/// Build a VerusHash v2.2 ZcashStratum solution blob from the original header
/// and the found nonce. The pool re-computes the hash from the solution, so
/// the header must contain the found nonce in the 15-byte nonceSpace.
pub fn build_verushash_solution(header: &[u8], nonce: u64, extranonce1: &[u8]) -> Option<Vec<u8>> {
    if header.len() < VERUS_HEADER_SIZE {
        return None;
    }

    // The 15-byte nonceSpace layout: [en1][miner_nonce(4B LE)][padding].
    let en1_len = extranonce1.len().min(VERUS_NONCE_SPACE_SIZE - 4);
    let nonce_le = (nonce as u32).to_le_bytes();
    let mut final_nonce_space = [0u8; VERUS_NONCE_SPACE_SIZE];
    final_nonce_space[..en1_len].copy_from_slice(&extranonce1[..en1_len]);
    final_nonce_space[en1_len..en1_len + 4].copy_from_slice(&nonce_le);

    // MMR roots stay as supplied by the pool; the upstream validator clears
    // non-canonical PBaaS fields before hashing.
    let mut final_header = header.to_vec();
    final_header[VERUS_NONCE_SPACE_OFFSET..VERUS_NONCE_SPACE_OFFSET + VERUS_NONCE_SPACE_SIZE]
        .copy_from_slice(&final_nonce_space);

    let mut solution = zcash_varint_for_len(VERUS_SOLUTION_SIZE);
    solution.extend_from_slice(
        &final_header[VERUS_SOLUTION_OFFSET..VERUS_SOLUTION_OFFSET + VERUS_SOLUTION_SIZE],
    );

    Some(solution)
}

/// Mine VerusHash v2.2 using the two-stage native path.
/// Returns the found nonce, the little-endian PoW hash, and the
/// solution-with-varint bytes ready for ZcashStratum submission.
#[cfg(feature = "native-verushash")]
pub fn mine_verushash(
    header: &[u8],
    target: &[u8; 32],
    start: u64,
    end: u64,
    extranonce1: &[u8],
) -> Option<(u64, [u8; 32], Vec<u8>)> {
    zion_native_ffi::verushash::init();

    if header.len() < VERUS_HEADER_SIZE {
        return None;
    }

    // The 15-byte nonceSpace layout: [en1][miner_nonce(4B LE)][padding].
    let en1_len = extranonce1.len().min(VERUS_NONCE_SPACE_SIZE - 4);
    let mut nonce_space = [0u8; VERUS_NONCE_SPACE_SIZE];
    nonce_space[..en1_len].copy_from_slice(&extranonce1[..en1_len]);

    // Work header: canonical copy with PBaaS non-canonical data cleared.
    let mut work_header = header.to_vec();
    clear_verushash_pbaas(&mut work_header);
    work_header[VERUS_NONCE_SPACE_OFFSET..VERUS_NONCE_SPACE_OFFSET + VERUS_NONCE_SPACE_SIZE]
        .copy_from_slice(&nonce_space);

    // Two-stage scan: hash_half + prepare_key once, scan_nonces for the range.
    let intermediate = zion_native_ffi::verushash::hash_half(&work_header);
    zion_native_ffi::verushash::prepare_key(&intermediate);

    let nonce_offset = en1_len as u32;
    let found = zion_native_ffi::verushash::scan_nonces(
        &intermediate,
        &nonce_space,
        nonce_offset,
        start,
        end,
        target,
    )?;

    // Build the submit solution from the original header with the found nonce
    // embedded in the solution nonceSpace.
    let (nonce, hash) = found;
    let solution = build_verushash_solution(header, nonce, extranonce1)?;

    Some((nonce, hash, solution))
}

#[cfg(not(feature = "native-verushash"))]
pub fn mine_verushash(
    _header: &[u8],
    _target: &[u8; 32],
    _start: u64,
    _end: u64,
    _extranonce1: &[u8],
) -> Option<(u64, [u8; 32], Vec<u8>)> {
    // Without the native VerusHash implementation we cannot produce a valid
    // share. Returning None lets callers fall back cleanly.
    None
}

pub fn init_verushash() {}

// ── ZelHash (Flux) ───────────────────────────────────────────────────

pub fn hash_zelhash(header: &[u8], nonce: u64) -> [u8; 32] {
    let mut input = Vec::with_capacity(header.len() + 8);
    input.extend_from_slice(header);
    input.extend_from_slice(&nonce.to_le_bytes());
    let mut out = [0u8; 32];
    let h = blake3::hash(&input);
    out.copy_from_slice(h.as_bytes());
    out
}

pub fn is_valid_zelhash_solution(_header: &[u8], _nonce: u64, _solution: &[u8]) -> bool {
    false
}

// ── Ethash / Etchash / KawPow stubs ──────────────────────────────────

pub const ETHASH_EPOCH_LENGTH: u32 = 30000;
pub const ETCHASH_EPOCH_LENGTH: u32 = 60000;
pub const KAWPOW_EPOCH_LENGTH: u32 = 7500;
pub const PROGPOW_EPOCH_LENGTH: u32 = 30000;
pub const PEARL_EPOCH_LENGTH: u32 = 0;

pub fn hash_ethash(header: &[u8], nonce: u64, _height: u32) -> [u8; 32] {
    let mut input = Vec::with_capacity(header.len() + 8);
    input.extend_from_slice(header);
    input.extend_from_slice(&nonce.to_le_bytes());
    Keccak256::digest(&input).into()
}

pub fn hash_ethash_with_dag(
    header: &[u8],
    nonce: u64,
    _mix_hash: &[u8; 32],
    _height: u32,
) -> [u8; 32] {
    hash_ethash(header, nonce, _height)
}

pub fn hash_etchash(header: &[u8], nonce: u64, height: u32) -> [u8; 32] {
    hash_ethash(header, nonce, height)
}

pub fn hash_kawpow(header: &[u8; 32], nonce: u64, _height: u32) -> ([u8; 32], [u8; 32]) {
    let h = Keccak256::digest(header);
    let mut mix = [0u8; 32];
    mix.copy_from_slice(&h);
    let mut final_hash = [0u8; 32];
    let combined = Keccak256::digest([h.as_ref(), &nonce.to_le_bytes()[..]].concat());
    final_hash.copy_from_slice(&combined);
    (mix, final_hash)
}

pub fn hash_kawpow_final(header_hash: &[u8; 32], nonce: u64, mix_hash: &[u8; 32]) -> [u8; 32] {
    let mut seed_input = Vec::with_capacity(40);
    seed_input.extend_from_slice(header_hash);
    seed_input.extend_from_slice(&nonce.to_le_bytes());
    let seed = Keccak512::digest(&seed_input);
    let mut final_input = Vec::with_capacity(96);
    final_input.extend_from_slice(&seed);
    final_input.extend_from_slice(mix_hash);
    Keccak256::digest(&final_input).into()
}

// ── PearlHash (Pearl) ────────────────────────────────────────────────

pub fn hash_pearl(header: &[u8; 32], nonce: u64) -> [u8; 32] {
    let mut input = Vec::with_capacity(40);
    input.extend_from_slice(header);
    input.extend_from_slice(&nonce.to_le_bytes());
    blake3::hash(&input).into()
}

// ── Mining helpers ───────────────────────────────────────────────────

pub fn mine_zelhash(
    header: &[u8],
    target: &[u8; 32],
    start: u64,
    count: u64,
) -> Option<(u64, [u8; 32])> {
    for offset in 0..count {
        let nonce = start.wrapping_add(offset);
        let hash = hash_zelhash(header, nonce);
        if meets_target(&hash, target) {
            return Some((nonce, hash));
        }
    }
    None
}

pub fn mine_ethash(
    header: &[u8],
    target: &[u8; 32],
    start: u64,
    count: u64,
    height: u32,
) -> Option<(u64, [u8; 32])> {
    for offset in 0..count {
        let nonce = start.wrapping_add(offset);
        let hash = hash_ethash(header, nonce, height);
        if meets_target(&hash, target) {
            return Some((nonce, hash));
        }
    }
    None
}

// ── Target parsing ───────────────────────────────────────────────────

pub fn parse_target_hex(hex_str: &str) -> Option<[u8; 32]> {
    let hex = hex_str
        .trim()
        .trim_start_matches("0x")
        .trim_start_matches("0X");
    if hex.len() != 64 {
        return None;
    }
    let mut out = [0u8; 32];
    hex::decode_to_slice(hex, &mut out).ok()?;
    Some(out)
}

pub fn nbits_to_target(nbits: &str) -> Option<[u8; 32]> {
    let bytes = hex::decode(nbits.trim_start_matches("0x")).ok()?;
    if bytes.len() != 4 {
        return None;
    }
    let exponent = bytes[0] as usize;
    if !(3..=32).contains(&exponent) {
        return None;
    }
    let mut coefficient = [0u8; 3];
    coefficient.copy_from_slice(&bytes[1..4]);
    let mut out = [0u8; 32];
    let start = 32 - exponent;
    out[start..start + 3].copy_from_slice(&coefficient);
    Some(out)
}

pub fn target_to_difficulty(target: &[u8; 32]) -> f64 {
    let mut target_be = [0u8; 32];
    target_be.copy_from_slice(target);
    target_be.reverse();
    let target_u256 = num_bigint::BigUint::from_bytes_be(&target_be);
    if target_u256 == num_bigint::BigUint::from(0u8) {
        return 0.0;
    }
    let max_target = num_bigint::BigUint::from_slice(&[
        0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF,
        0x7FFFFFFF,
    ]);
    let diff = max_target / target_u256;
    let diff_bytes = diff.to_bytes_be();
    let mut diff_u64 = [0u8; 8];
    let copy_len = diff_bytes.len().min(8);
    diff_u64[8 - copy_len..].copy_from_slice(&diff_bytes[..copy_len]);
    u64::from_be_bytes(diff_u64) as f64
}

pub fn target_to_difficulty_with_max(target: &[u8; 32], _max_target: &[u8; 32]) -> f64 {
    target_to_difficulty(target)
}

pub fn difficulty_to_target(difficulty: f64) -> [u8; 32] {
    if difficulty <= 0.0 {
        return [0xFF; 32];
    }
    let max_target = num_bigint::BigUint::from_slice(&[
        0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF,
        0x7FFFFFFF,
    ]);
    let diff_bigint = num_bigint::BigUint::from(difficulty as u64);
    if diff_bigint == num_bigint::BigUint::from(0u8) {
        return [0xFF; 32];
    }
    let target = max_target / diff_bigint;
    let target_bytes = target.to_bytes_be();
    let mut out = [0u8; 32];
    let copy_len = target_bytes.len().min(32);
    out[32 - copy_len..].copy_from_slice(&target_bytes[..copy_len]);
    out
}

pub fn algorithm_max_target(algorithm: &str) -> [u8; 32] {
    match algorithm {
        "kheavyhash" | "keryxhash" => {
            let mut t = [0u8; 32];
            t[0] = 0x00;
            t[1] = 0x00;
            t[2..].fill(0xFF);
            t
        }
        _ => [0xFF; 32],
    }
}

// ── Algorithm dispatch by coin ───────────────────────────────────────

/// Dispatch hash by algorithm name string (used by dual_stratum).
pub fn dispatch_hash(
    algorithm: &str,
    header: &[u8],
    timestamp: u64,
    nonce: u64,
) -> anyhow::Result<[u8; 32]> {
    match algorithm {
        "blake3" | "blake3_dcr" => Ok(hash_blake3(header, timestamp, nonce)),
        "blake3_alph" => Ok(hash_blake3_alph(header, &[], nonce)),
        "kheavyhash" => Ok(hash_kheavyhash(header, timestamp, nonce)),
        "autolykos" => Ok(hash_autolykos(header, nonce, timestamp as u32)),
        "kawpow" => {
            let mut h32 = [0u8; 32];
            let len = header.len().min(32);
            h32[..len].copy_from_slice(&header[..len]);
            let (_mix, final_hash) = hash_kawpow(&h32, nonce, timestamp as u32);
            Ok(final_hash)
        }
        "ethash" => Ok(hash_ethash(header, nonce, timestamp as u32)),
        "etchash" => Ok(hash_etchash(header, nonce, timestamp as u32)),
        "verushash" => Ok(hash_verushash(header, nonce)),
        "zelhash" => Ok(hash_zelhash(header, nonce)),
        "pearlhash" => {
            let mut h32 = [0u8; 32];
            let len = header.len().min(32);
            h32[..len].copy_from_slice(&header[..len]);
            Ok(hash_pearl(&h32, nonce))
        }
        "keryxhash" => Ok(hash_keryxhash(header, timestamp, nonce, 0)),
        other => Err(anyhow::anyhow!(
            "dual-stratum: algorithm '{}' not supported by auxpow hasher",
            other
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn meets_target_basic() {
        let target = [0xFF; 32];
        let hash = [0x00; 32];
        assert!(meets_target(&hash, &target));
        assert!(!meets_target(&target, &[0x00; 32]));
    }

    #[test]
    fn blake3_dcr_deterministic() {
        let header = [0u8; 144];
        let h1 = hash_blake3(&header, 0, 42);
        let h2 = hash_blake3(&header, 0, 42);
        assert_eq!(h1, h2);
        let h3 = hash_blake3(&header, 0, 43);
        assert_ne!(h1, h3);
    }

    #[test]
    fn kheavyhash_deterministic() {
        let pre_pow = [0xABu8; 32];
        let h1 = hash_kheavyhash(&pre_pow, 1000, 42);
        let h2 = hash_kheavyhash(&pre_pow, 1000, 42);
        assert_eq!(h1, h2);
        let h3 = hash_kheavyhash(&pre_pow, 1000, 43);
        assert_ne!(h1, h3);
    }

    #[test]
    fn kheavyhash_matrix_flat_4096() {
        let flat = kheavyhash_matrix_flat();
        assert_eq!(flat.len(), 4096);
    }

    #[test]
    fn keryx_salt_versions() {
        assert_eq!(keryx_active_salt_version(0), 1);
        assert_eq!(keryx_active_salt_version(KERYX_SALT_V2_ACTIVATION_DAA), 2);
        assert_eq!(keryx_active_salt_version(KERYX_SALT_V4_ACTIVATION_DAA), 4);
    }

    #[test]
    fn keryxhash_deterministic() {
        let pre_pow = [0xCDu8; 32];
        let h1 = hash_keryxhash(&pre_pow, 1000, 42, KERYX_SALT_V4_ACTIVATION_DAA);
        let h2 = hash_keryxhash(&pre_pow, 1000, 42, KERYX_SALT_V4_ACTIVATION_DAA);
        assert_eq!(h1, h2);
    }

    #[test]
    fn parse_target_hex_ok() {
        let t = "f".repeat(64);
        assert_eq!(parse_target_hex(&t), Some([0xff; 32]));
    }

    #[test]
    fn parse_target_hex_short() {
        assert_eq!(parse_target_hex("00"), None);
    }

    #[test]
    fn nbits_to_target_ok() {
        let t = nbits_to_target("1d00ffff").unwrap();
        assert_eq!(t[..3], [0u8; 3]);
        assert_eq!(t[4], 0xff);
        assert_eq!(t[5], 0xff);
    }

    #[test]
    fn dispatch_blake3() {
        let h = dispatch_hash("blake3", b"header", 0, 42).unwrap();
        assert_ne!(h, [0u8; 32]);
    }

    #[test]
    fn dispatch_kheavyhash() {
        let h = dispatch_hash("kheavyhash", &[0xABu8; 32], 1000, 42).unwrap();
        assert_ne!(h, [0u8; 32]);
    }

    #[test]
    fn dispatch_unsupported() {
        assert!(dispatch_hash("unknown_algo", b"header", 0, 0).is_err());
    }

    #[test]
    #[cfg(feature = "native-verushash")]
    fn mine_verushash_finds_share_and_solution_verifies() {
        let en1 = [0x01u8, 0x02, 0x03, 0x04];
        let mut header = vec![0u8; VERUS_HEADER_SIZE];

        // Block version (4 bytes LE)
        header[0..4].copy_from_slice(&[4, 0, 0, 0]);
        // nTime / nBits (will be zeroed by clear_verushash_pbaas, but keep
        // realistic values so the header is well-formed).
        header[100..104].copy_from_slice(&[0x00, 0xC0, 0x5A, 0x5A]);
        header[104..108].copy_from_slice(&[0x1b, 0x00, 0xff, 0xff]);
        // nNonce field: en1 + zeros (matches what the pool expects).
        header[108..108 + en1.len()].copy_from_slice(&en1);
        // Compact varint for 1344-byte solution.
        header[140..143].copy_from_slice(&[0xfd, 0x40, 0x05]);

        // Solution: PBaaS v7+ version and at least one PBaaS header declared.
        header[VERUS_SOLUTION_OFFSET] = 7;
        header[VERUS_SOLUTION_OFFSET + 5] = 1;
        // MMR roots in the solution — must be restored in the submitted solution
        // and cleared by the pool before hashing.
        for b in &mut header[VERUS_SOLUTION_OFFSET + 8..VERUS_SOLUTION_OFFSET + 72] {
            *b = 0xAB;
        }

        // Pre-populate nonceSpace with en1; the scan will embed the nonce.
        header[VERUS_NONCE_SPACE_OFFSET..VERUS_NONCE_SPACE_OFFSET + en1.len()]
            .copy_from_slice(&en1);

        // Very easy target so the first nonce wins.
        let target = [0xffu8; 32];

        let (nonce, hash, solution) = mine_verushash(&header, &target, 0, 1000, &en1)
            .expect("mine_verushash should find a share with max target");

        // Reconstruct the canonical header the pool will hash and verify the
        // reported hash matches.
        let mut verify_header = header.clone();
        clear_verushash_pbaas(&mut verify_header);
        let nonce_le = (nonce as u32).to_le_bytes();
        verify_header
            [VERUS_NONCE_SPACE_OFFSET + en1.len()..VERUS_NONCE_SPACE_OFFSET + en1.len() + 4]
            .copy_from_slice(&nonce_le);
        let verify_hash = hash_verushash_header(&verify_header);
        assert_eq!(verify_hash, hash, "hashed solution must match scan hash");

        // The solution-with-varint must be the correct length and start with the
        // Zcash compact varint for 1344 bytes.
        assert_eq!(solution.len(), 3 + VERUS_SOLUTION_SIZE);
        assert_eq!(&solution[..3], &[0xfd, 0x40, 0x05]);
    }
}
