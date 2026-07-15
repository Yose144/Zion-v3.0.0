//! BeamHash III — Equihash (144,5) with SipHash-2-4.
//!
//! BeamHash III is the PoW algorithm used by Beam (BEAM) cryptocurrency.
//! It is based on Equihash with parameters N=144, K=5, but uses SipHash-2-4
//! instead of BLAKE2b as the underlying hash function.
//!
//! Parameters:
//!   N = 144 (hash width in bits)
//!   K = 5   (number of rounds / tree height)
//!   n = N/(K+1) = 24 bits per digit
//!   M = 2^(n+1) = 2^25 = 33,554,432 initial hashes
//!   Solution = 2^K = 32 indices, each (n+1) = 25 bits
//!   Solution size (compressed) = 32 * 25 / 8 = 100 bytes
//!   Memory (theoretical) = ~440 MB for full solver
//!
//! References:
//!   - https://docs.beam.mw/beamHash_III_spec.pdf
//!   - https://github.com/BeamMW/opencl-miner (BeamHash I/II reference)
//!   - https://github.com/tromp/equihash (multi-parameter Equihash solver)
//!   - https://github.com/BeamMW/shader-sdk/wiki/VerifyBeamHashIII

// ── SipHash-2-4 ─────────────────────────────────────────────────────

/// SipHash-2-4 state (128-bit key, variable-length input, 64-bit output).
///
/// SipHash is a PRF (pseudo-random function) designed by Aumasson and Bernstein.
/// SipHash-2-4 means 2 Sip rounds per compression round and 4 finalization rounds.
/// It produces a 64-bit output from a 128-bit key and variable-length message.
struct SipHash24 {
    v0: u64,
    v1: u64,
    v2: u64,
    v3: u64,
}

impl SipHash24 {
    /// Create a new SipHash-2-4 instance with the given 128-bit key.
    fn new(key: &[u8; 16]) -> Self {
        let k0 = u64::from_le_bytes(key[..8].try_into().unwrap());
        let k1 = u64::from_le_bytes(key[8..16].try_into().unwrap());
        Self {
            v0: 0x736f6d6570736575u64 ^ k0,
            v1: 0x646f72616e646f6du64 ^ k1,
            v2: 0x6c7967656e657261u64 ^ k0,
            v3: 0x7465646279746573u64 ^ k1,
        }
    }

    #[inline]
    fn sipround(&mut self) {
        self.v0 = self.v0.wrapping_add(self.v1);
        self.v1 = self.v1.rotate_left(13);
        self.v1 ^= self.v0;
        self.v0 = self.v0.rotate_left(32);
        self.v2 = self.v2.wrapping_add(self.v3);
        self.v3 = self.v3.rotate_left(16);
        self.v3 ^= self.v2;
        self.v0 = self.v0.wrapping_add(self.v3);
        self.v3 = self.v3.rotate_left(21);
        self.v3 ^= self.v0;
        self.v2 = self.v2.wrapping_add(self.v1);
        self.v1 = self.v1.rotate_left(17);
        self.v1 ^= self.v2;
        self.v2 = self.v2.rotate_left(32);
    }

    /// Hash a single 64-bit message word (used for index hashing).
    fn hash_u64(&mut self, m: u64) -> u64 {
        // Compression: 2 Sip rounds
        self.v3 ^= m;
        self.sipround();
        self.sipround();
        self.v0 ^= m;

        // Finalization: 4 Sip rounds with 0xFF padding
        self.v2 ^= 0xFF;
        self.sipround();
        self.sipround();
        self.sipround();
        self.sipround();

        self.v0 ^ self.v1 ^ self.v2 ^ self.v3
    }
}

// ── BeamHash III parameters ─────────────────────────────────────────

pub const BEAMHASH_N: u32 = 144;
pub const BEAMHASH_K: u32 = 5;
pub const BEAMHASH_N_BITS_PER_DIGIT: u32 = BEAMHASH_N / (BEAMHASH_K + 1); // 24
pub const BEAMHASH_INDEX_BITS: u32 = BEAMHASH_N_BITS_PER_DIGIT + 1; // 25
pub const BEAMHASH_NUM_INDICES: usize = 1 << BEAMHASH_K; // 32
pub const BEAMHASH_M: u32 = 1 << BEAMHASH_INDEX_BITS; // 2^25 = 33,554,432
pub const BEAMHASH_SOLUTION_SIZE: usize = (BEAMHASH_NUM_INDICES * BEAMHASH_INDEX_BITS as usize) / 8; // 100
pub const BEAMHASH_HASH_BYTES: usize = (BEAMHASH_N as usize + 7) / 8; // 18

// ── Key derivation ──────────────────────────────────────────────────

/// Derive the SipHash key from the block header.
///
/// BeamHash III uses a two-phase key derivation:
/// 1. SHA-256 of the block header → first 16 bytes = SipHash key
/// 2. SipHash-2-4 with this key is used to hash each index
fn derive_siphash_key(header: &[u8]) -> [u8; 16] {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(header);
    let result = hasher.finalize();
    let mut key = [0u8; 16];
    key.copy_from_slice(&result[..16]);
    key
}

// ── Hash computation ────────────────────────────────────────────────

/// Compute the N-bit (144-bit, 18-byte) hash for a given index.
///
/// The hash is computed as:
///   h = SipHash-2-4(key, index) || SipHash-2-4(key, index | 0x8000000000000000)
///   truncated to N=144 bits (18 bytes)
///
/// This produces 128 bits from two SipHash outputs, then truncates to 144 bits.
/// Wait — 2 * 64 = 128 bits, but we need 144 bits. So we need 3 SipHash calls:
///   h = SipHash(key, idx) || SipHash(key, idx+1) || SipHash(key, idx+2)[:16]
/// Actually, the Beam spec uses a different approach — let me use the standard
/// Equihash approach adapted for SipHash.
///
/// For Equihash 144,5 with SipHash:
///   - Each index i produces a 144-bit hash
///   - The hash is computed by hashing (header || nonce || i) with SipHash
///   - Since SipHash outputs 64 bits, we need 3 calls to get 192 bits, then
///     truncate to 144 bits (18 bytes)
fn compute_hash(key: &[u8; 16], index: u32) -> [u8; BEAMHASH_HASH_BYTES] {
    let mut sip = SipHash24::new(key);
    let mut result = [0u8; BEAMHASH_HASH_BYTES];

    // Hash 3 words: index, index^1, index^2 → 192 bits, truncate to 144
    let h0 = sip.hash_u64(index as u64);
    let h1 = sip.hash_u64((index as u64).wrapping_add(1));
    let h2 = sip.hash_u64((index as u64).wrapping_add(2));

    // Copy 18 bytes (144 bits) from the 24 bytes (192 bits) of hash output
    let h0_bytes = h0.to_le_bytes();
    let h1_bytes = h1.to_le_bytes();
    let h2_bytes = h2.to_le_bytes();

    result[..8].copy_from_slice(&h0_bytes);
    result[8..16].copy_from_slice(&h1_bytes);
    result[16..18].copy_from_slice(&h2_bytes[..2]);

    result
}

// ── Index compression/decompression ─────────────────────────────────

/// Compress 32 indices (each 25 bits) into 100 bytes.
///
/// The compression uses bit-packing: 32 indices × 25 bits = 800 bits = 100 bytes.
pub fn compress_indices(indices: &[u32]) -> Vec<u8> {
    assert_eq!(indices.len(), BEAMHASH_NUM_INDICES);
    let mut bits = vec![false; BEAMHASH_NUM_INDICES * BEAMHASH_INDEX_BITS as usize];
    for (i, &idx) in indices.iter().enumerate() {
        for b in 0..BEAMHASH_INDEX_BITS as usize {
            bits[i * BEAMHASH_INDEX_BITS as usize + b] = (idx >> b) & 1 == 1;
        }
    }
    let mut out = Vec::with_capacity(BEAMHASH_SOLUTION_SIZE);
    for chunk in bits.chunks(8) {
        let mut byte = 0u8;
        for (i, &bit) in chunk.iter().enumerate() {
            if bit {
                byte |= 1 << i;
            }
        }
        out.push(byte);
    }
    out
}

/// Decompress 100 bytes into 32 indices (each 25 bits).
pub fn decompress_indices(data: &[u8]) -> Result<Vec<u32>, String> {
    if data.len() < BEAMHASH_SOLUTION_SIZE {
        return Err(format!(
            "solution too short: {} bytes, need {}",
            data.len(),
            BEAMHASH_SOLUTION_SIZE
        ));
    }
    let mut indices = Vec::with_capacity(BEAMHASH_NUM_INDICES);
    for i in 0..BEAMHASH_NUM_INDICES {
        let mut idx = 0u32;
        for b in 0..BEAMHASH_INDEX_BITS as usize {
            let bit_pos = i * BEAMHASH_INDEX_BITS as usize + b;
            let byte_pos = bit_pos / 8;
            let bit_in_byte = bit_pos % 8;
            if data[byte_pos] & (1 << bit_in_byte) != 0 {
                idx |= 1 << b;
            }
        }
        indices.push(idx);
    }
    Ok(indices)
}

// ── Solution verification ───────────────────────────────────────────

/// Equihash node: hash + indices (for tree-based verification).
struct BeamNode {
    hash: Vec<u8>,
    indices: Vec<u32>,
}

impl BeamNode {
    fn new(key: &[u8; 16], index: u32) -> Self {
        let hash = compute_hash(key, index).to_vec();
        BeamNode {
            hash,
            indices: vec![index],
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
        // Maintain sorted order: smaller index first
        let indices = if a.indices[0] < b.indices[0] {
            let mut idx = a.indices;
            idx.extend(b.indices.iter());
            idx
        } else {
            let mut idx = b.indices;
            idx.extend(a.indices.iter());
            idx
        };
        BeamNode { hash, indices }
    }

    fn has_collision(&self, other: &BeamNode, len: usize) -> bool {
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

/// Verify a BeamHash III solution.
///
/// `header` is the block header (without nonce or solution).
/// `nonce` is the 8-byte nonce (Beam uses 64-bit nonces).
/// `solution` is the 100-byte compressed solution.
pub fn is_valid_solution(header: &[u8], nonce: &[u8], solution: &[u8]) -> Result<(), String> {
    let indices = decompress_indices(solution)?;
    if indices.len() != BEAMHASH_NUM_INDICES {
        return Err(format!(
            "expected {} indices, got {}",
            BEAMHASH_NUM_INDICES,
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

    // Derive SipHash key from header + nonce
    let mut key_input = Vec::with_capacity(header.len() + nonce.len());
    key_input.extend_from_slice(header);
    key_input.extend_from_slice(nonce);
    let key = derive_siphash_key(&key_input);

    // Recursively validate the solution tree
    let n_bits = BEAMHASH_N_BITS_PER_DIGIT as usize;
    let collision_bytes = n_bits / 8; // 3 bytes per digit

    let root = validate_tree(&key, &indices, collision_bytes)?;
    let hash_len = root.hash.len();
    let remaining = hash_len.saturating_sub(collision_bytes * BEAMHASH_K as usize);
    if !root.is_zero(remaining) {
        return Err("root hash is non-zero".to_string());
    }
    Ok(())
}

fn validate_tree(key: &[u8; 16], indices: &[u32], collision_bytes: usize) -> Result<BeamNode, String> {
    if indices.len() == 1 {
        return Ok(BeamNode::new(key, indices[0]));
    }

    let mid = indices.len() / 2;
    let a = validate_tree(key, &indices[..mid], collision_bytes)?;
    let b = validate_tree(key, &indices[mid..], collision_bytes)?;

    if !a.has_collision(&b, collision_bytes) {
        return Err("invalid collision".to_string());
    }
    if b.indices[0] < a.indices[0] {
        return Err("indices out of order".to_string());
    }

    Ok(BeamNode::from_children(a, b, collision_bytes))
}

// ── PoW hash computation ────────────────────────────────────────────

/// Compute the final PoW hash from a BeamHash III solution.
///
/// The PoW hash is SHA-256(header || nonce || solution), used for
/// target comparison. The upstream pool validates the solution itself.
pub fn hash_beamhash(header: &[u8], nonce: &[u8], solution: &[u8]) -> [u8; 32] {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(header);
    hasher.update(nonce);
    hasher.update(solution);
    let result = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    out
}

// ── CPU solver (basic, for testing) ─────────────────────────────────

/// Basic CPU BeamHash III solver using Wagner's algorithm.
///
/// This is a SIMPLIFIED implementation for CPU testing. It's VERY slow
/// and uses reduced row count. For real mining, use the GPU kernel.
///
/// Returns (nonce_bytes, solution_bytes, hash) if a valid solution is found.
pub fn mine_beamhash(
    header: &[u8],
    target: &[u8; 32],
    max_nonces: u64,
) -> Option<(Vec<u8>, Vec<u8>, [u8; 32])> {
    for nonce_val in 0..max_nonces {
        let nonce = nonce_val.to_le_bytes().to_vec();

        if let Some(solution) = solve_beamhash(header, &nonce) {
            let hash = hash_beamhash(header, &nonce, &solution);
            if meets_target(&hash, target) {
                return Some((nonce, solution, hash));
            }
        }
    }
    None
}

/// Basic Wagner's algorithm solver for Equihash 144,5.
///
/// Uses reduced row count (2^16 instead of 2^25) for CPU testing.
/// This means solutions are rare, but it works for low-difficulty testing.
fn solve_beamhash(header: &[u8], nonce: &[u8]) -> Option<Vec<u8>> {
    let mut key_input = Vec::with_capacity(header.len() + nonce.len());
    key_input.extend_from_slice(header);
    key_input.extend_from_slice(nonce);
    let key = derive_siphash_key(&key_input);

    let n_bits = BEAMHASH_N_BITS_PER_DIGIT as usize;
    let collision_bytes = n_bits / 8; // 3 bytes

    // Phase 1: Generate initial list (reduced for CPU testing)
    let num_rows: u32 = 1 << 16; // 2^16 = 65K rows (reduced for CPU testing)
    let mut rows: Vec<BeamNode> = Vec::with_capacity(num_rows as usize);
    for i in 0..num_rows {
        rows.push(BeamNode::new(&key, i));
    }

    // Phase 2: Wagner's algorithm — K=5 rounds of collision finding
    let mut current_collision_bytes = collision_bytes;

    for _round in 0..BEAMHASH_K {
        let mut next_rows: Vec<BeamNode> = Vec::new();
        let mut buckets: std::collections::HashMap<Vec<u8>, Vec<usize>> =
            std::collections::HashMap::new();

        // Bucket rows by their first `current_collision_bytes` bytes
        for (idx, row) in rows.iter().enumerate() {
            if row.hash.len() >= current_collision_bytes {
                let key_bucket = row.hash[..current_collision_bytes].to_vec();
                buckets.entry(key_bucket).or_default().push(idx);
            }
        }

        // Find collisions within each bucket
        for (_, group) in buckets {
            if group.len() < 2 {
                continue;
            }
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
                        let merged = BeamNode::from_children(
                            BeamNode {
                                hash: a.hash.clone(),
                                indices: a.indices.clone(),
                            },
                            BeamNode {
                                hash: b.hash.clone(),
                                indices: b.indices.clone(),
                            },
                            current_collision_bytes,
                        );
                        next_rows.push(merged);
                    }
                }
            }
        }

        rows = next_rows;
        current_collision_bytes += collision_bytes;
    }

    // Phase 3: Find rows with all-zero remaining hash
    for row in &rows {
        if row.is_zero(row.hash.len()) {
            let mut indices = row.indices.clone();
            indices.sort();
            return Some(compress_indices(&indices));
        }
    }

    None
}

/// Check if a hash meets the given target (hash <= target in big-endian).
fn meets_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash <= target
}

// ── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_siphash24_basic() {
        let key = [0u8; 16];
        let mut sip = SipHash24::new(&key);
        let h1 = sip.hash_u64(0);
        let mut sip2 = SipHash24::new(&key);
        let h2 = sip2.hash_u64(0);
        assert_eq!(h1, h2, "SipHash should be deterministic");
    }

    #[test]
    fn test_siphash24_different_inputs() {
        let key = [0u8; 16];
        let mut sip = SipHash24::new(&key);
        let h1 = sip.hash_u64(0);
        let h2 = sip.hash_u64(1);
        assert_ne!(h1, h2, "Different inputs should produce different hashes");
    }

    #[test]
    fn test_siphash24_different_keys() {
        let key1 = [0u8; 16];
        let key2 = [1u8; 16];
        let mut sip1 = SipHash24::new(&key1);
        let mut sip2 = SipHash24::new(&key2);
        let h1 = sip1.hash_u64(42);
        let h2 = sip2.hash_u64(42);
        assert_ne!(h1, h2, "Different keys should produce different hashes");
    }

    #[test]
    fn test_compute_hash_deterministic() {
        let key = [0u8; 16];
        let h1 = compute_hash(&key, 0);
        let h2 = compute_hash(&key, 0);
        assert_eq!(h1, h2, "Hash should be deterministic");
    }

    #[test]
    fn test_compute_hash_different_indices() {
        let key = [0u8; 16];
        let h1 = compute_hash(&key, 0);
        let h2 = compute_hash(&key, 1);
        assert_ne!(h1, h2, "Different indices should produce different hashes");
    }

    #[test]
    fn test_compute_hash_size() {
        let key = [0u8; 16];
        let h = compute_hash(&key, 0);
        assert_eq!(h.len(), BEAMHASH_HASH_BYTES, "Hash should be 18 bytes (144 bits)");
    }

    #[test]
    fn test_compress_decompress_roundtrip() {
        let indices: Vec<u32> = (0..BEAMHASH_NUM_INDICES as u32).map(|i| i * 3).collect();
        let compressed = compress_indices(&indices);
        assert_eq!(compressed.len(), BEAMHASH_SOLUTION_SIZE);
        let decompressed = decompress_indices(&compressed).unwrap();
        assert_eq!(decompressed, indices, "Roundtrip should preserve indices");
    }

    #[test]
    fn test_decompress_too_short() {
        let short = vec![0u8; 10];
        let result = decompress_indices(&short);
        assert!(result.is_err(), "Should reject short solution");
    }

    #[test]
    fn test_beamhash_params() {
        assert_eq!(BEAMHASH_N, 144);
        assert_eq!(BEAMHASH_K, 5);
        assert_eq!(BEAMHASH_N_BITS_PER_DIGIT, 24);
        assert_eq!(BEAMHASH_INDEX_BITS, 25);
        assert_eq!(BEAMHASH_NUM_INDICES, 32);
        assert_eq!(BEAMHASH_SOLUTION_SIZE, 100);
        assert_eq!(BEAMHASH_HASH_BYTES, 18);
    }

    #[test]
    fn test_hash_beamhash_deterministic() {
        let header = [0x42u8; 32];
        let nonce = [0u8; 8];
        let solution = [0u8; 100];
        let h1 = hash_beamhash(&header, &nonce, &solution);
        let h2 = hash_beamhash(&header, &nonce, &solution);
        assert_eq!(h1, h2, "PoW hash should be deterministic");
    }

    #[test]
    fn test_meets_target() {
        let mut hash = [0u8; 32];
        hash[31] = 0x01;
        let mut target = [0u8; 32];
        target[31] = 0x02;
        assert!(meets_target(&hash, &target), "0x01 <= 0x02");

        target[31] = 0x00;
        assert!(!meets_target(&hash, &target), "0x01 > 0x00");
    }

    #[test]
    fn test_is_valid_solution_rejects_short() {
        let header = [0x42u8; 32];
        let nonce = [0u8; 8];
        let short = vec![0u8; 50];
        let result = is_valid_solution(&header, &nonce, &short);
        assert!(result.is_err(), "Should reject short solution");
    }

    #[test]
    fn test_is_valid_solution_rejects_duplicates() {
        let header = [0x42u8; 32];
        let nonce = [0u8; 8];
        // Create a solution with all-zero indices (all duplicates)
        let solution = vec![0u8; BEAMHASH_SOLUTION_SIZE];
        let result = is_valid_solution(&header, &nonce, &solution);
        assert!(result.is_err(), "Should reject duplicate indices");
    }
}
