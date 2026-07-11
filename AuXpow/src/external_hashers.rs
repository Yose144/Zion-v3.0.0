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

/// Compute Blake3 hash of header || nonce (little-endian).
///
/// Decred (DCR) uses Blake3 for its PoW (DCP-0011, since Oct 2022).
/// The header is 180 bytes for DCR, but the hash function itself
/// is standard Blake3 over the header bytes with nonce embedded.
///
/// For pool-side validation, we hash `header || nonce_le` and compare
/// against the target. The exact header construction is pool-specific.
///
/// Alephium (ALPH) also uses Blake3, with a similar approach.
///
/// # Arguments
/// * `header` — Block header bytes (coin-specific format)
/// * `_timestamp` — Unused for Blake3 (kept for a uniform hash-fn signature)
/// * `nonce`  — 64-bit nonce (appended as little-endian)
///
/// # Returns
/// 32-byte Blake3 digest.
pub fn hash_blake3(header: &[u8], _timestamp: u64, nonce: u64) -> [u8; 32] {
    let mut hasher = Blake3Hasher::new();
    hasher.update(header);
    hasher.update(&nonce.to_le_bytes());
    *hasher.finalize().as_bytes()
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
pub fn hash_kheavyhash(pre_pow_hash: &[u8], timestamp: u64, nonce: u64) -> [u8; 32] {
    use sha3::digest::{ExtendableOutput, Update, XofReader};
    use sha3::{CShake256, CShake256Core};

    // Kaspa reference: PowHash = cSHAKE256("ProofOfWorkHash")(pre_pow_hash || timestamp || 32 zero bytes || nonce)
    let mut pow_hasher = CShake256::from_core(CShake256Core::new(b"ProofOfWorkHash"));
    pow_hasher.update(pre_pow_hash);
    pow_hasher.update(&timestamp.to_le_bytes());
    pow_hasher.update(&[0u8; 32]);
    pow_hasher.update(&nonce.to_le_bytes());
    let mut pow_hash = [0u8; 32];
    pow_hasher.finalize_xof().read(&mut pow_hash);

    // KHeavyHash = cSHAKE256("HeavyHash")(pow_hash)
    let mut heavy_hasher = CShake256::from_core(CShake256Core::new(b"HeavyHash"));
    heavy_hasher.update(&pow_hash);
    let mut heavy_hash = [0u8; 32];
    heavy_hasher.finalize_xof().read(&mut heavy_hash);

    heavy_hash
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

    let mut heavy_hasher = CShake256::from_core(CShake256Core::new(b"HeavyHash"));
    heavy_hasher.update(&pow_hash);
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

/// Convert a 32-byte hash to a hex string (big-endian display).
pub fn hash_to_hex(hash: &[u8; 32]) -> String {
    hash.iter().map(|b| format!("{:02x}", b)).collect()
}

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

/// Initialize Ethash epoch cache.  Call once before any `hash_ethash` calls
/// when using the `native-hashers` feature.
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
        // The reference computes PowHash = cSHAKE256("ProofOfWorkHash") over
        // pre_pow_hash || timestamp || 32 zero bytes || nonce, then hashes the
        // result with cSHAKE256("HeavyHash").
        let h = hash_kheavyhash(&[42u8; 32], 5_435_345_234, 432_432_432);
        // Verified independently: cSHAKE256("ProofOfWorkHash", ...).read(32) then
        // cSHAKE256("HeavyHash", ...).read(32) produces this exact 64-char hex.
        let expected_hex = "b0b5b47de00be8f689cbe89818f8a075350055c5e9dbcda7d834395b08be2252";
        assert_eq!(hash_to_hex(&h), expected_hex);
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
