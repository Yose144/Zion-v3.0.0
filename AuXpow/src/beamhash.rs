//! BeamHash III — PoW algorithm for Beam (BEAM) cryptocurrency.
//!
//! BeamHash III is a modified Equihash-based PoW that uses SipHash-2-4
//! with a 256-bit pre-state (4 × 64-bit words) instead of BLAKE2b.
//!
//! Parameters (from reference implementation):
//!   workBitSize      = 448 (7 × 64-bit SipHash outputs)
//!   collisionBitSize = 24  (bits per collision digit)
//!   numRounds        = 5   (K = 5, Wagner's algorithm rounds)
//!   M                = 2^25 = 33,554,432 initial entries
//!   Solution         = 2^K = 32 indices
//!   Solution size    = 100 bytes (compressed: 32 × 25 bits)
//!
//! Hash computation per index:
//!   For j = 0..7: h[j] = siphash24(prePow[0..3], (index << 3) + j)
//!   workBits = h[6] || h[5] || h[4] || h[3] || h[2] || h[1] || h[0]  (448 bits)
//!   (h[7] is computed but shifted out — only 7 × 64 = 448 bits fit)
//!
//! Wagner's algorithm:
//!   For each round: apply BeamHash III mix, find pairs with matching first
//!   24 bits, XOR, shift right by 24, then mask to the remaining bits.
//!   After 5 rounds only the final 24 collision bits are checked for zero.
//!
//! References:
//!   - https://github.com/btccom/btcpool-ABANDONED (beamHashIII_impl.cpp)
//!   - https://docs.beam.mw/beamHash_III_spec.pdf
//!   - https://github.com/BeamMW/opencl-miner (BeamHash I/II GPU reference)

// ── BeamHash III parameters ─────────────────────────────────────────

pub const BEAMHASH_WORK_BITS: usize = 448;
pub const BEAMHASH_COLLISION_BITS: usize = 24;
pub const BEAMHASH_K: u32 = 5;
pub const BEAMHASH_NUM_INDICES: usize = 1 << BEAMHASH_K; // 32
pub const BEAMHASH_M: u32 = 1 << 25; // 2^25 = 33,554,432
pub const BEAMHASH_INDEX_BITS: u32 = 25;
pub const BEAMHASH_SOLUTION_SIZE: usize = (BEAMHASH_NUM_INDICES * BEAMHASH_INDEX_BITS as usize) / 8; // 100

// ── SipHash-2-4 with 256-bit state ──────────────────────────────────

/// SipHash-2-4 with a 256-bit pre-state (4 × 64-bit words).
///
/// This is the variant used by BeamHash III. Unlike standard SipHash
/// which uses a 128-bit key XORed with magic constants, BeamHash III
/// uses the prePow state directly as the initial SipHash state.
#[derive(Clone, Copy)]
struct SipHash24State {
    v0: u64,
    v1: u64,
    v2: u64,
    v3: u64,
}

impl SipHash24State {
    /// Create from 4 × 64-bit prePow state words.
    fn from_prepow(pre_pow: &[u64; 4]) -> Self {
        Self {
            v0: pre_pow[0],
            v1: pre_pow[1],
            v2: pre_pow[2],
            v3: pre_pow[3],
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

    /// SipHash-2-4 for a single 64-bit nonce/message word.
    /// Returns 64-bit hash.
    #[inline]
    fn hash(&self, nonce: u64) -> u64 {
        let mut s = *self;
        // Compression: 2 Sip rounds
        s.v3 ^= nonce;
        s.sipround();
        s.sipround();
        s.v0 ^= nonce;

        // Finalization: 4 Sip rounds
        s.v2 ^= 0xFF;
        s.sipround();
        s.sipround();
        s.sipround();
        s.sipround();

        s.v0 ^ s.v1 ^ s.v2 ^ s.v3
    }
}

// ── PrePow computation ──────────────────────────────────────────────

/// Compute the 4-word prePow state from the block header.
///
/// The prePow is derived from the block header using BLAKE2b-256.
/// The 32-byte BLAKE2b output is split into 4 × 64-bit little-endian words.
///
/// Reference: beamHashIII_impl.cpp → InitialiseState(blake2b_state& base_state)
/// The base_state is initialized with personalization and then fed the
/// pre-PoW data (block header without solution).
pub(crate) fn compute_prepow(header: &[u8]) -> [u64; 4] {
    // BeamHash III uses BLAKE2b-256 with a 16-byte personalization:
    //   bytes 0-7:  "Beam-PoW"
    //   bytes 8-11: workBitSize (little-endian u32)
    //   bytes 12-15: numRounds (little-endian u32)
    // Reference: beamHashIII_impl.cpp → InitialiseState()
    use blake2b_simd::Params;
    let mut personal = [0u8; 16];
    personal[..8].copy_from_slice(b"Beam-PoW");
    personal[8..12].copy_from_slice(&(BEAMHASH_WORK_BITS as u32).to_le_bytes());
    personal[12..16].copy_from_slice(&(BEAMHASH_K as u32).to_le_bytes());

    let hash = Params::new()
        .hash_length(32)
        .personal(&personal)
        .hash(header);
    let result: [u8; 32] = hash.as_bytes().try_into().unwrap();

    let mut pre_pow = [0u64; 4];
    for i in 0..4 {
        pre_pow[i] = u64::from_le_bytes(result[i * 8..(i + 1) * 8].try_into().unwrap());
    }
    pre_pow
}

// ── Work bits (448-bit hash per index) ──────────────────────────────

/// A 448-bit work bitset, stored as 7 × 64-bit words (little-endian).
/// work_bits[0] = h[0] (lowest 64 bits)
/// work_bits[6] = h[6] (highest 64 bits)
#[derive(Clone, Copy)]
struct WorkBits {
    words: [u64; 7],
}

impl WorkBits {
    #[cfg(test)]
    fn zero() -> Self {
        Self { words: [0u64; 7] }
    }

    /// Compute the 448-bit work bits for a given index.
    /// h[j] = siphash24(prePow, (index << 3) + j) for j = 0..7
    /// workBits = h[6] || h[5] || ... || h[0] (448 bits, h[7] discarded)
    fn from_index(pre_pow: &[u64; 4], index: u32) -> Self {
        let state = SipHash24State::from_prepow(pre_pow);
        let base = (index as u64) << 3;
        let h: [u64; 8] = [
            state.hash(base),
            state.hash(base + 1),
            state.hash(base + 2),
            state.hash(base + 3),
            state.hash(base + 4),
            state.hash(base + 5),
            state.hash(base + 6),
            state.hash(base + 7),
        ];
        // h[7] is discarded (shifted out of 448-bit bitset)
        Self {
            words: [h[0], h[1], h[2], h[3], h[4], h[5], h[6]],
        }
    }

    /// XOR two WorkBits (used in Wagner's collision finding).
    fn xor(&self, other: &Self) -> Self {
        let mut words = [0u64; 7];
        for i in 0..7 {
            words[i] = self.words[i] ^ other.words[i];
        }
        Self { words }
    }

    /// Shift right by `bits` positions.
    fn shr(&self, bits: usize) -> Self {
        if bits == 0 {
            return self.clone();
        }
        let word_shift = bits / 64;
        let bit_shift = bits % 64;
        let mut words = [0u64; 7];
        for i in 0..7 {
            let lo = if i + word_shift < 7 {
                self.words[i + word_shift]
            } else {
                0
            };
            let hi = if i + word_shift + 1 < 7 {
                self.words[i + word_shift + 1]
            } else {
                0
            };
            if bit_shift == 0 {
                words[i] = lo;
            } else {
                words[i] = (lo >> bit_shift) | (hi << (64 - bit_shift));
            }
        }
        Self { words }
    }

    /// Keep only the lowest `rem_len` bits, zero all higher bits.
    fn mask(&self, rem_len: usize) -> Self {
        if rem_len >= BEAMHASH_WORK_BITS {
            return self.clone();
        }
        let full_words = rem_len / 64;
        let rem_bits = rem_len % 64;
        let mut words = [0u64; 7];
        for i in 0..full_words {
            words[i] = self.words[i];
        }
        if full_words < 7 && rem_bits > 0 {
            let m = (1u64 << rem_bits) - 1;
            words[full_words] = self.words[full_words] & m;
        }
        Self { words }
    }

    /// Apply the BeamHash III mix function (from reference applyMix).
    ///
    /// Mixes the index tree bits into the work bits, then computes a 64-bit
    /// SipHash-style rotation over eight 64-bit chunks and replaces the
    /// lowest 64 bits with the result.
    fn apply_mix(&mut self, indices: &[u32], rem_len: usize) {
        // The reference applyMix uses a 512-bit temporary bitset so that
        // padding index tree bits can live above the 448 work bits.
        // The 448-bit work bits occupy the lowest 448 bits, the upper 64
        // bits start as zero and may receive index bits.
        let mut temp = [0u64; 8];
        temp[..7].copy_from_slice(&self.words);

        // padNum = ((512 - remLen) + collisionBitSize) / (collisionBitSize + 1)
        let pad_num = ((512 - rem_len) + BEAMHASH_COLLISION_BITS)
            / (BEAMHASH_COLLISION_BITS + 1);
        let pad_num = pad_num.min(indices.len());

        for i in 0..pad_num {
            let offset = rem_len + i * (BEAMHASH_COLLISION_BITS + 1);
            if offset >= 512 {
                break;
            }
            let value = indices[i] as u64;
            let word_idx = offset / 64;
            let bit_offset = offset % 64;
            let low_bits = 32.min(64 - bit_offset);
            let mask = (1u64 << low_bits) - 1;
            temp[word_idx] |= (value & mask) << bit_offset;
            if bit_offset + 32 > 64 && word_idx + 1 < 8 {
                let remaining = 32 - low_bits;
                let mask2 = (1u64 << remaining) - 1;
                temp[word_idx + 1] |= (value >> low_bits) & mask2;
            }
        }

        // Apply mix: sum rotl(chunk, 29*(i+1) mod 64) for each 64-bit chunk.
        let mut result = 0u64;
        for i in 0..8 {
            let rot = ((29 * (i + 1)) & 0x3F) as u32;
            result = result.wrapping_add(temp[i].rotate_left(rot));
        }
        result = result.rotate_left(24);

        // Replace the lowest 64 bits with the mixed result.
        self.words[0] = result;
    }

    /// Extract the first `n` bits (from the low end).
    fn first_bits(&self, n: usize) -> u64 {
        if n == 0 {
            return 0;
        }
        if n <= 64 {
            return self.words[0] & ((1u64 << n) - 1);
        }
        // For n > 64, combine multiple words
        let mut result = self.words[0];
        let mut remaining = n - 64;
        let mut word_idx = 1;
        let mut shift = 64;
        while remaining > 0 && word_idx < 7 {
            let take = remaining.min(64);
            result |= (self.words[word_idx] & ((1u64 << take) - 1)) << shift;
            remaining -= take;
            shift += take;
            word_idx += 1;
        }
        result
    }

    /// Check if all bits are zero.
    fn is_zero(&self) -> bool {
        self.words.iter().all(|&w| w == 0)
    }
}

// ── Wagner's algorithm node ─────────────────────────────────────────

/// A node in the Wagner's algorithm tree.
struct BeamNode {
    work_bits: WorkBits,
    indices: Vec<u32>,
}

impl BeamNode {
    fn new(pre_pow: &[u64; 4], index: u32) -> Self {
        Self {
            work_bits: WorkBits::from_index(pre_pow, index),
            indices: vec![index],
        }
    }

    fn from_children(a: &BeamNode, b: &BeamNode, rem_len: usize) -> Self {
        let xor = a.work_bits.xor(&b.work_bits);
        let shifted = xor.shr(BEAMHASH_COLLISION_BITS);
        let masked = shifted.mask(rem_len);

        let mut indices = Vec::with_capacity(a.indices.len() + b.indices.len());
        if a.indices[0] < b.indices[0] {
            indices.extend_from_slice(&a.indices);
            indices.extend_from_slice(&b.indices);
        } else {
            indices.extend_from_slice(&b.indices);
            indices.extend_from_slice(&a.indices);
        }

        Self {
            work_bits: masked,
            indices,
        }
    }

    fn collision_bits(&self) -> u64 {
        self.work_bits.first_bits(BEAMHASH_COLLISION_BITS)
    }
}

// ── Index compression/decompression ─────────────────────────────────

/// Compress 32 indices (each 25 bits) into 100 bytes.
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
    let mut bits = vec![false; BEAMHASH_NUM_INDICES * BEAMHASH_INDEX_BITS as usize];
    for (i, &byte) in data.iter().take(BEAMHASH_SOLUTION_SIZE).enumerate() {
        for b in 0..8 {
            let bit_idx = i * 8 + b;
            if bit_idx < bits.len() {
                bits[bit_idx] = (byte >> b) & 1 == 1;
            }
        }
    }
    let mut indices = Vec::with_capacity(BEAMHASH_NUM_INDICES);
    for i in 0..BEAMHASH_NUM_INDICES {
        let mut idx = 0u32;
        for b in 0..BEAMHASH_INDEX_BITS as usize {
            if bits[i * BEAMHASH_INDEX_BITS as usize + b] {
                idx |= 1 << b;
            }
        }
        indices.push(idx);
    }
    Ok(indices)
}

// ── Round helper functions ────────────────────────────────────────────

/// Remaining bit length used by applyMix before the round's collision check.
/// Matches the reference verifier/solver `remLen` for applyMix.
fn apply_mix_rem_len(round: u32) -> usize {
    if round + 1 == BEAMHASH_K {
        // Round 5: drop an extra 64 bits before mixing.
        BEAMHASH_WORK_BITS - ((BEAMHASH_K - 1) as usize) * BEAMHASH_COLLISION_BITS - 64
    } else {
        BEAMHASH_WORK_BITS - (round as usize) * BEAMHASH_COLLISION_BITS
    }
}

/// Remaining bit length used when constructing a parent node from a pair.
/// Matches the reference verifier/solver `remLen` passed to the stepElem
/// constructor.
fn constructor_rem_len(round: u32) -> usize {
    if round + 1 == BEAMHASH_K {
        // Final round: keep only the collision bits.
        BEAMHASH_COLLISION_BITS
    } else if round + 1 == BEAMHASH_K - 1 {
        // Round 4: drop an extra 64 bits.
        BEAMHASH_WORK_BITS - ((BEAMHASH_K - 1) as usize) * BEAMHASH_COLLISION_BITS - 64
    } else {
        BEAMHASH_WORK_BITS - ((round + 1) as usize) * BEAMHASH_COLLISION_BITS
    }
}

// ── Solution validation ─────────────────────────────────────────────

/// Check if a solution is valid for the given header.
///
/// Reconstructs the Wagner's tree from the 32 indices and verifies
/// that the final XOR is zero.
pub fn is_valid_solution(header: &[u8], solution: &[u8]) -> Result<(), String> {
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
            return Err("duplicate indices in solution".to_string());
        }
    }

    let pre_pow = compute_prepow(header);

    // Build the tree bottom-up
    let mut nodes: Vec<BeamNode> = indices.iter().map(|&i| BeamNode::new(&pre_pow, i)).collect();

    for round in 0..BEAMHASH_K {
        let mix_len = apply_mix_rem_len(round);
        let mut next_nodes: Vec<BeamNode> = Vec::new();
        let mut buckets: std::collections::HashMap<u64, Vec<usize>> =
            std::collections::HashMap::new();

        // Apply BeamHash III mix before checking collisions.
        for node in nodes.iter_mut() {
            node.work_bits.apply_mix(&node.indices, mix_len);
        }

        for (idx, node) in nodes.iter().enumerate() {
            let coll = node.collision_bits();
            buckets.entry(coll).or_default().push(idx);
        }

        let construct_len = constructor_rem_len(round);
        for (_, group) in buckets {
            if group.len() < 2 {
                continue;
            }
            for i in 0..group.len() {
                for j in (i + 1)..group.len() {
                    let a = &nodes[group[i]];
                    let b = &nodes[group[j]];

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
                        let merged = BeamNode::from_children(a, b, construct_len);
                        next_nodes.push(merged);
                    }
                }
            }
        }

        nodes = next_nodes;
    }

    // After K rounds, check if any node has all-zero work bits
    for node in &nodes {
        if node.is_zero() {
            return Ok(());
        }
    }

    Err("solution does not produce zero hash after Wagner's algorithm".to_string())
}

impl BeamNode {
    fn is_zero(&self) -> bool {
        self.work_bits.is_zero()
    }
}

// ── PoW hash computation ─────────────────────────────────────────────

/// Compute the PoW hash for a (header, solution) pair.
///
/// The PoW hash is computed by:
/// 1. Reconstructing the Wagner's tree from the solution indices
/// 2. Verifying the solution is structurally valid
/// 3. Hashing the header and solution with BLAKE2b-256
///
/// Returns a 32-byte hash. If the solution is not valid, the hash is
/// set to all 0xff so it will not meet any reasonable target.
pub fn hash_beamhash(header: &[u8], solution: &[u8]) -> [u8; 32] {
    if is_valid_solution(header, solution).is_err() {
        return [0xffu8; 32];
    }

    let mut hasher = blake2b_simd::Params::new().hash_length(32).to_state();
    hasher.update(header);
    hasher.update(solution);
    hasher.finalize().as_bytes().try_into().unwrap()
}

// ── Mining ──────────────────────────────────────────────────────────

/// Mine a BeamHash III solution for the given header and target.
///
/// This is a CPU implementation using Wagner's algorithm.
/// It scans nonces and for each nonce, tries to find a solution.
///
/// For production mining, use the GPU-accelerated path instead.
pub fn mine_beamhash(
    header: &[u8],
    target: &[u8; 32],
    max_nonces: u64,
) -> Option<(Vec<u8>, Vec<u8>, [u8; 32])> {
    for nonce_val in 0..max_nonces {
        let mut nonce_header = header.to_vec();
        nonce_header.extend_from_slice(&nonce_val.to_le_bytes());

        if let Some(solution) = solve_beamhash(&nonce_header) {
            let hash = hash_beamhash(&nonce_header, &solution);
            if hash_le_target(&hash, target) {
                let nonce = nonce_val.to_le_bytes().to_vec();
                return Some((nonce, solution, hash));
            }
        }
    }
    None
}

/// CPU Wagner's algorithm solver for BeamHash III.
///
/// Uses reduced row count for CPU testing (2^16 instead of 2^25).
/// This means solutions are rare, but it works for low-difficulty testing.
fn solve_beamhash(header: &[u8]) -> Option<Vec<u8>> {
    let pre_pow = compute_prepow(header);

    // Phase 1: Generate initial list (reduced for CPU testing)
    let num_rows: u32 = 1 << 16; // 2^16 = 65K rows (reduced from 2^25)
    let mut nodes: Vec<BeamNode> = Vec::with_capacity(num_rows as usize);
    for i in 0..num_rows {
        nodes.push(BeamNode::new(&pre_pow, i));
    }

    // Phase 2: Wagner's algorithm — K=5 rounds of collision finding
    for round in 0..BEAMHASH_K {
        let mix_len = apply_mix_rem_len(round);
        let construct_len = constructor_rem_len(round);
        let mut next_nodes: Vec<BeamNode> = Vec::new();
        let mut buckets: std::collections::HashMap<u64, Vec<usize>> =
            std::collections::HashMap::new();

        // Apply BeamHash III mix before checking collisions.
        for node in nodes.iter_mut() {
            node.work_bits.apply_mix(&node.indices, mix_len);
        }

        for (idx, node) in nodes.iter().enumerate() {
            let coll = node.collision_bits();
            buckets.entry(coll).or_default().push(idx);
        }

        for (_, group) in buckets {
            if group.len() < 2 {
                continue;
            }
            for i in 0..group.len() {
                for j in (i + 1)..group.len() {
                    let a = &nodes[group[i]];
                    let b = &nodes[group[j]];

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
                        let merged = BeamNode::from_children(a, b, construct_len);
                        next_nodes.push(merged);
                    }
                }
            }
        }

        nodes = next_nodes;
    }

    // Phase 3: Find nodes with all-zero work bits
    for node in &nodes {
        if node.is_zero() {
            let mut indices = node.indices.clone();
            indices.sort();
            return Some(compress_indices(&indices));
        }
    }

    None
}

/// Check if hash <= target (big-endian byte comparison).
fn hash_le_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash <= target
}

// ── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_siphash24_deterministic() {
        let state = SipHash24State { v0: 1, v1: 2, v2: 3, v3: 4 };
        let h1 = state.hash(42);
        let h2 = state.hash(42);
        assert_eq!(h1, h2, "SipHash should be deterministic");
    }

    #[test]
    fn test_siphash24_different_inputs() {
        let state = SipHash24State { v0: 1, v1: 2, v2: 3, v3: 4 };
        let h1 = state.hash(0);
        let h2 = state.hash(1);
        assert_ne!(h1, h2, "Different inputs should produce different hashes");
    }

    #[test]
    fn test_workbits_xor() {
        let a = WorkBits { words: [0xFF, 0, 0, 0, 0, 0, 0] };
        let b = WorkBits { words: [0x0F, 0, 0, 0, 0, 0, 0] };
        let c = a.xor(&b);
        assert_eq!(c.words[0], 0xF0);
    }

    #[test]
    fn test_workbits_shr() {
        // 0xFFFFFFFFFFFFFFFF shr 32 = 0x00000000FFFFFFFF (in word 0)
        // But shr shifts the ENTIRE 448-bit value right.
        // words[0] = 0xFFFFFFFFFFFFFFFF, rest = 0
        // After shr 32: words[0] = 0xFFFFFFFFFFFFFFFF >> 32 = 0x00000000FFFFFFFF
        let a = WorkBits { words: [0xFFFFFFFFFFFFFFFF, 0, 0, 0, 0, 0, 0] };
        let b = a.shr(32);
        assert_eq!(b.words[0], 0x00000000FFFFFFFFu64);
    }

    #[test]
    fn test_workbits_first_bits() {
        // 0x123456789ABCDEF0 — lower 24 bits = 0xCDEF0 & 0xFFFFFF = 0xBCDEF0
        let a = WorkBits { words: [0x123456789ABCDEF0, 0, 0, 0, 0, 0, 0] };
        assert_eq!(a.first_bits(24), 0x123456789ABCDEF0u64 & 0xFFFFFF);
    }

    #[test]
    fn test_workbits_zero() {
        let a = WorkBits::zero();
        assert!(a.is_zero());
        let b = WorkBits { words: [1, 0, 0, 0, 0, 0, 0] };
        assert!(!b.is_zero());
    }

    #[test]
    fn test_compress_decompress_indices() {
        let indices: Vec<u32> = (0..32).map(|i| i * 1000 + 42).collect();
        let compressed = compress_indices(&indices);
        assert_eq!(compressed.len(), BEAMHASH_SOLUTION_SIZE);
        let decompressed = decompress_indices(&compressed).unwrap();
        assert_eq!(decompressed, indices);
    }

    #[test]
    fn test_workbits_from_index() {
        let pre_pow = [1u64, 2, 3, 4];
        let wb = WorkBits::from_index(&pre_pow, 0);
        // Should not be zero
        assert!(!wb.is_zero());
    }

    #[test]
    fn test_beamhash_solver_runs_and_verifier_rejects_invalid() {
        // The full BeamHash III solver needs 2^25 rows to find solutions
        // reliably. The reduced CPU test (2^16 rows) should run without panic.
        let header = [0x42u8; 32];
        let _solution = solve_beamhash(&header); // may be None

        // A random/all-zeros compressed solution must be rejected.
        let fake_solution = [0u8; BEAMHASH_SOLUTION_SIZE];
        assert!(is_valid_solution(&header, &fake_solution).is_err(),
            "random solution must be rejected");

        let hash = hash_beamhash(&header, &fake_solution);
        assert_eq!(hash, [0xffu8; 32], "invalid solution hash must be all 0xff");
    }

    #[test]
    fn test_rem_len_helpers_match_reference() {
        // Values taken from upstream beamHashIII_impl.cpp verifier/solver.
        assert_eq!(apply_mix_rem_len(0), 448);
        assert_eq!(apply_mix_rem_len(1), 424);
        assert_eq!(apply_mix_rem_len(2), 400);
        assert_eq!(apply_mix_rem_len(3), 376);
        assert_eq!(apply_mix_rem_len(4), 288);

        assert_eq!(constructor_rem_len(0), 424);
        assert_eq!(constructor_rem_len(1), 400);
        assert_eq!(constructor_rem_len(2), 376);
        assert_eq!(constructor_rem_len(3), 288);
        assert_eq!(constructor_rem_len(4), 24);
    }

    #[test]
    fn test_apply_mix_matches_upstream_reference() {
        // Independent bit-array reference for the upstream applyMix behavior.
        fn reference_apply_mix(words: [u64; 7], indices: &[u32], rem_len: usize) -> u64 {
            let mut bits = vec![false; 512];

            // 448-bit work bits occupy the lowest 448 bits (word 0 = LSBs).
            for w in 0..7 {
                for b in 0..64 {
                    bits[w * 64 + b] = (words[w] >> b) & 1 == 1;
                }
            }

            // Index tree padding: padNum = ((512 - remLen) + 24) / 25.
            let pad_num = ((512 - rem_len) + BEAMHASH_COLLISION_BITS)
                / (BEAMHASH_COLLISION_BITS + 1);
            let pad_num = pad_num.min(indices.len());
            for i in 0..pad_num {
                let offset = rem_len + i * (BEAMHASH_COLLISION_BITS + 1);
                if offset >= 512 {
                    break;
                }
                let value = indices[i];
                for b in 0..32 {
                    let pos = offset + b;
                    if pos < 512 && (value >> b) & 1 == 1 {
                        bits[pos] = true;
                    }
                }
            }

            let mut result = 0u64;
            for i in 0..8 {
                let mut chunk = 0u64;
                for b in 0..64 {
                    if bits[i * 64 + b] {
                        chunk |= 1u64 << b;
                    }
                }
                let rot = ((29 * (i + 1)) & 0x3F) as u32;
                result = result.wrapping_add(chunk.rotate_left(rot));
            }
            result.rotate_left(24)
        }

        let words = [
            0x123456789ABCDEF0u64,
            0xFEDCBA9876543210u64,
            0xA5A5A5A5A5A5A5A5u64,
            0x5C5C5C5C5C5C5C5Cu64,
            0x0F0F0F0F0F0F0F0Fu64,
            0xF0F0F0F0F0F0F0F0u64,
            0xAA55AA55AA55AA55u64,
        ];
        let indices = [
            0x01234567u32,
            0x89ABCDEFu32,
            0x13579BDFu32,
            0x2468ACE0u32,
            0xFEDCBA98u32,
            0x76543210u32,
            0xAABBCCDDu32,
            0x11223344u32,
        ];

        for rem_len in [0usize, 24, 100, 200, 300, 400, 424, 448] {
            let mut wb = WorkBits { words };
            wb.apply_mix(&indices, rem_len);
            let expected = reference_apply_mix(words, &indices, rem_len);
            assert_eq!(
                wb.words[0], expected,
                "apply_mix mismatch for rem_len={}", rem_len
            );
        }
    }
}
