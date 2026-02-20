//! Optimized algorithm implementations with SIMD and parallel processing
//!
//! Performance optimizations:
//! - Target-specific SIMD intrinsics (AVX2 on x86_64, NEON on ARM)
//! - Pre-computed lookup tables
//! - Cache-friendly memory layout
//! - Inline critical paths
//! - Zero-copy operations where possible

use sha3::{Digest, Keccak256, Sha3_512};

use crate::scratchpad;

/// Fork height pro aktivaci memory-hard scratchpad fáze v CHv3.
///
/// Poznámka: ponecháno na 0 => aktivní ihned (aktuální chování).
/// Pro staged rollout změňte na plánovanou výšku hard-forku.
pub const CHV3_MEMORY_HARD_FORK_HEIGHT: u64 = 50_000;

/// Runtime override pro memory-hard scratchpad fázi.
///
/// Bezpečnostní poznámka:
/// - Default chování je řízeno výškou (`CHV3_MEMORY_HARD_FORK_HEIGHT`).
/// - Tyto override jsou určené pro TESTING / staged rollout.
/// - Na mainnetu musí být aktivace memory-hard deterministická a konzistentní
///   pro všechny uzly (tj. typicky jen přes fork-height / chain parametry).
#[inline]
fn runtime_memory_hard_override() -> Option<bool> {
    // 1) Explicitní disable má přednost
    if let Ok(v) = std::env::var("ZION_CHV3_MEMORY_HARD_DISABLE") {
        let v = v.trim().to_ascii_lowercase();
        if v == "1" || v == "true" || v == "yes" {
            return Some(false);
        }
    }

    // 2) Force enable
    if let Ok(v) = std::env::var("ZION_CHV3_MEMORY_HARD_FORCE") {
        let v = v.trim().to_ascii_lowercase();
        if v == "1" || v == "true" || v == "yes" {
            return Some(true);
        }
    }

    None
}

// SIMD intrinsics for x86_64 (AVX2)

// SIMD intrinsics for ARM (NEON)

// ============================================================================
// CONSTANTS & LOOKUP TABLES (Pre-computed at compile time)
// ============================================================================

/// Golden ratio constant
pub const PHI: f64 = 1.618033988749895;

/// Pre-computed golden ratio powers (φ^0 to φ^15) — used only as reference
pub const PHI_POWERS: [f64; 16] = [
    1.0,                  // φ^0
    1.618033988749895,    // φ^1
    2.618033988749895,    // φ^2
    4.23606797749979,     // φ^3
    6.854101966249685,    // φ^4
    11.090169943749475,   // φ^5
    17.94427190999916,    // φ^6
    29.034441853748636,   // φ^7
    46.978_713_763_747_8, // φ^8
    76.01315561749643,    // φ^9
    122.99186938124423,   // φ^10
    199.00502499874066,   // φ^11
    321.9968943799849,    // φ^12
    521.0019193787256,    // φ^13
    842.9988137587105,    // φ^14
    1364.000733137436,    // φ^15
];

/// Fixed-point golden ratio powers (φ^n * 2^32) for cross-platform determinism
/// Computed as: round(PHI_POWERS[i] * 4294967296)
pub const PHI_POWERS_FP: [u64; 16] = [
    4294967296,    // φ^0 * 2^32
    6949403065,    // φ^1 * 2^32
    11244370361,   // φ^2 * 2^32
    18193773427,   // φ^3 * 2^32
    29438143788,   // φ^4 * 2^32
    47631917215,   // φ^5 * 2^32
    77070061004,   // φ^6 * 2^32
    124701978219,  // φ^7 * 2^32
    201772039223,  // φ^8 * 2^32
    326474017443,  // φ^9 * 2^32
    528246056666,  // φ^10 * 2^32
    854720074109,  // φ^11 * 2^32
    1382966130776, // φ^12 * 2^32
    2237686204885, // φ^13 * 2^32
    3620652335660, // φ^14 * 2^32
    5858338540545, // φ^15 * 2^32
];

/// XOR mask for cosmic fusion (pre-computed)
pub const COSMIC_XOR_MASK: [u8; 32] = [
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
];

// ============================================================================
// OPTIMIZED HASH OUTPUT (Fixed-size, stack-allocated)
// ============================================================================

/// Fixed-size hash output (no heap allocation)
#[derive(Clone, Copy)]
#[repr(C, align(32))] // Cache-line aligned
pub struct Hash32 {
    pub data: [u8; 32],
}

#[derive(Clone, Copy)]
#[repr(C, align(64))]
pub struct Hash64 {
    pub data: [u8; 64],
}

impl Hash32 {
    #[inline(always)]
    pub const fn new() -> Self {
        Self { data: [0u8; 32] }
    }

    #[inline(always)]
    pub fn as_slice(&self) -> &[u8] {
        &self.data
    }
}

impl Hash64 {
    #[inline(always)]
    pub const fn new() -> Self {
        Self { data: [0u8; 64] }
    }

    #[inline(always)]
    pub fn as_slice(&self) -> &[u8] {
        &self.data
    }
}

// ============================================================================
// OPTIMIZED KECCAK-256 (Step 1)
// ============================================================================

/// Keccak-256 optimized - zero allocation
#[inline]
pub fn keccak256_opt(input: &[u8]) -> Hash32 {
    let mut hasher = Keccak256::new();
    hasher.update(input);
    let result = hasher.finalize();

    let mut hash = Hash32::new();
    hash.data.copy_from_slice(&result);
    hash
}

/// Keccak-256 with pre-allocated output
#[inline]
pub fn keccak256_into(input: &[u8], output: &mut Hash32) {
    let mut hasher = Keccak256::new();
    hasher.update(input);
    let result = hasher.finalize();
    output.data.copy_from_slice(&result);
}

// ============================================================================
// OPTIMIZED SHA3-512 (Step 2)
// ============================================================================

/// SHA3-512 optimized - zero allocation
#[inline]
pub fn sha3_512_opt(input: &[u8]) -> Hash64 {
    let mut hasher = Sha3_512::new();
    hasher.update(input);
    let result = hasher.finalize();

    let mut hash = Hash64::new();
    hash.data.copy_from_slice(&result);
    hash
}

/// SHA3-512 with pre-allocated output
#[inline]
pub fn sha3_512_into(input: &[u8], output: &mut Hash64) {
    let mut hasher = Sha3_512::new();
    hasher.update(input);
    let result = hasher.finalize();
    output.data.copy_from_slice(&result);
}

// ============================================================================
// OPTIMIZED GOLDEN MATRIX (Step 3) - SIMD accelerated
// ============================================================================

/// Golden Matrix with fixed-point integer arithmetic for cross-platform determinism
#[inline]
pub fn golden_matrix_opt(input: &[u8]) -> Hash64 {
    const MATRIX_SIZE: usize = 8;

    // Stack-allocated matrix (cache-friendly)
    let mut matrix = [[0u64; MATRIX_SIZE]; MATRIX_SIZE];
    let input_len = input.len();

    // Unrolled matrix fill
    for i in 0..MATRIX_SIZE {
        let base = i * MATRIX_SIZE;
        for j in 0..MATRIX_SIZE {
            matrix[i][j] = input[(base + j) % input_len] as u64;
        }
    }

    // Apply golden ratio with fixed-point integer powers (deterministic across platforms)
    let mut result = [0u64; MATRIX_SIZE];

    for i in 0..MATRIX_SIZE {
        let mut sum: u128 = 0;

        // Fixed-point: PHI_POWERS_FP[k] = φ^k * 2^32
        // sum = Σ(matrix[i][j] * PHI_POWERS_FP[i+j]) → result in fixed-point (scaled by 2^32)
        sum += (matrix[i][0] as u128) * (PHI_POWERS_FP[i] as u128);
        sum += (matrix[i][1] as u128) * (PHI_POWERS_FP[i + 1] as u128);
        sum += (matrix[i][2] as u128) * (PHI_POWERS_FP[i + 2] as u128);
        sum += (matrix[i][3] as u128) * (PHI_POWERS_FP[i + 3] as u128);
        sum += (matrix[i][4] as u128) * (PHI_POWERS_FP[i + 4] as u128);
        sum += (matrix[i][5] as u128) * (PHI_POWERS_FP[i + 5] as u128);
        sum += (matrix[i][6] as u128) * (PHI_POWERS_FP[i + 6] as u128);
        sum += (matrix[i][7] as u128) * (PHI_POWERS_FP[i + 7] as u128);

        // Shift right by 32 to get the integer part (equivalent to dividing by 2^32)
        result[i] = (sum >> 32) as u64;
    }

    // Convert to bytes (cache-friendly)
    let mut hash = Hash64::new();
    for (i, &val) in result.iter().enumerate() {
        let bytes = val.to_le_bytes();
        hash.data[i * 8..(i + 1) * 8].copy_from_slice(&bytes);
    }

    hash
}

/// Golden Matrix with SIMD (AVX2/NEON)
#[cfg(target_feature = "avx2")]
#[inline]
pub fn golden_matrix_simd(input: &[u8]) -> Hash64 {
    // AVX2 optimized version
    golden_matrix_opt(input) // Fallback for now
}

#[cfg(target_feature = "neon")]
#[inline]
pub fn golden_matrix_simd(input: &[u8]) -> Hash64 {
    // NEON optimized version for ARM
    golden_matrix_opt(input) // Fallback for now
}

// ============================================================================
// OPTIMIZED COSMIC FUSION (Step 4) - SIMD XOR
// ============================================================================

/// Cosmic Fusion optimized - zero allocation, SIMD XOR
#[inline]
pub fn cosmic_fusion_opt(input: &[u8]) -> Hash32 {
    // Pre-allocated state buffer (stack)
    let mut state = [0u8; 64];
    let copy_len = input.len().min(64);
    state[..copy_len].copy_from_slice(&input[..copy_len]);

    // 4 rounds of fusion (unrolled)
    fusion_round(&mut state, 0);
    fusion_round(&mut state, 1);
    fusion_round(&mut state, 2);
    fusion_round(&mut state, 3);

    // Final SHA3-512 and truncate
    let mut hasher = Sha3_512::new();
    hasher.update(&state[..32]);
    let full = hasher.finalize();

    let mut hash = Hash32::new();
    hash.data.copy_from_slice(&full[..32]);
    hash
}

/// Single fusion round - inlined
#[inline(always)]
fn fusion_round(state: &mut [u8; 64], round: u8) {
    // Keccak round
    let mut hasher = Keccak256::new();
    hasher.update(&state[..32]);
    hasher.update([round]);
    let intermediate = hasher.finalize();

    // SIMD XOR with mask
    #[cfg(target_feature = "avx2")]
    {
        use std::arch::x86_64::*;
        unsafe {
            let a = _mm256_loadu_si256(intermediate.as_ptr() as *const __m256i);
            let b = _mm256_loadu_si256(COSMIC_XOR_MASK.as_ptr() as *const __m256i);
            let result = _mm256_xor_si256(a, b);
            _mm256_storeu_si256(state.as_mut_ptr() as *mut __m256i, result);
        }
    }

    #[cfg(not(target_feature = "avx2"))]
    {
        // Fallback: manual XOR
        for i in 0..32 {
            state[i] = intermediate[i] ^ COSMIC_XOR_MASK[i];
        }
    }
}

// ============================================================================
// FULL PIPELINE - OPTIMIZED
// ============================================================================

/// Legacy CHv3 pipeline bez memory-hard fáze (Keccak→SHA3→GoldenMatrix→Fusion).
#[inline]
pub fn cosmic_harmony_v3_legacy(block_header: &[u8], nonce: u64) -> Hash32 {
    // Prepare input with nonce
    let mut input = [0u8; 88]; // 80 byte header + 8 byte nonce
    let copy_len = block_header.len().min(80);
    input[..copy_len].copy_from_slice(&block_header[..copy_len]);
    input[80..88].copy_from_slice(&nonce.to_le_bytes());

    // Step 1: Keccak-256
    let step1 = keccak256_opt(&input);

    // Step 2: SHA3-512
    let step2 = sha3_512_opt(&step1.data);

    // Step 3: Golden Matrix
    let step3 = golden_matrix_opt(&step2.data);

    // Step 4: Cosmic Fusion
    cosmic_fusion_opt(&step3.data)
}

/// Full Cosmic Harmony v3 pipeline - memory-hard variant
#[inline]
pub fn cosmic_harmony_v3(block_header: &[u8], nonce: u64) -> Hash32 {
    // Prepare input with nonce
    let mut input = [0u8; 88]; // 80 byte header + 8 byte nonce
    let copy_len = block_header.len().min(80);
    input[..copy_len].copy_from_slice(&block_header[..copy_len]);
    input[80..88].copy_from_slice(&nonce.to_le_bytes());

    // Step 1: Keccak-256
    let step1 = keccak256_opt(&input);

    // Step 2: SHA3-512
    let step2 = sha3_512_opt(&step1.data);

    // Step 3: Golden Matrix
    let step3 = golden_matrix_opt(&step2.data);

    // Step 4: Memory-hard scratchpad (ASIC resistance)
    let step4 = scratchpad::memory_hard_transform(&step3.data);

    // Step 5: Cosmic Fusion
    cosmic_fusion_opt(&step4.data)
}

/// Height-aware CHv3 selector pro bezpečný fork rollout.
#[inline]
pub fn cosmic_harmony_v3_with_height(block_header: &[u8], nonce: u64, height: u64) -> Hash32 {
    if let Some(force) = runtime_memory_hard_override() {
        if force {
            return cosmic_harmony_v3(block_header, nonce);
        }
        return cosmic_harmony_v3_legacy(block_header, nonce);
    }

    if height >= CHV3_MEMORY_HARD_FORK_HEIGHT {
        cosmic_harmony_v3(block_header, nonce)
    } else {
        cosmic_harmony_v3_legacy(block_header, nonce)
    }
}

/// Intermediates z CHv3 pipeline pro "4-layer streams" bez timeswitch.
///
/// Praktický use-case:
/// - (1) Keccak-256 byproduct → potenciální merged/aux mining stream
/// - (2) SHA3-512 byproduct → potenciální merged/aux mining stream
/// - (3) GoldenMatrix output → seed pro memory-hard scratchpad
///
/// Toto API nic nemění na konsenzu ani na defaultní hash funkci.
#[derive(Clone, Copy)]
pub struct Chv3Intermediates {
    pub keccak256: Hash32,
    pub sha3_512: Hash64,
    pub golden_matrix: Hash64,
    pub memory_hard_enabled: bool,
}

/// Height-aware CHv3 selector + intermediates.
#[inline]
pub fn cosmic_harmony_v3_with_height_intermediates(
    block_header: &[u8],
    nonce: u64,
    height: u64,
) -> (Hash32, Chv3Intermediates) {
    // Prepare input with nonce
    let mut input = [0u8; 88];
    let copy_len = block_header.len().min(80);
    input[..copy_len].copy_from_slice(&block_header[..copy_len]);
    input[80..88].copy_from_slice(&nonce.to_le_bytes());

    let step1 = keccak256_opt(&input);
    let step2 = sha3_512_opt(&step1.data);
    let step3 = golden_matrix_opt(&step2.data);

    let memory_hard_enabled = if let Some(force) = runtime_memory_hard_override() {
        force
    } else {
        height >= CHV3_MEMORY_HARD_FORK_HEIGHT
    };

    let out = if memory_hard_enabled {
        let step4 = scratchpad::memory_hard_transform(&step3.data);
        cosmic_fusion_opt(&step4.data)
    } else {
        cosmic_fusion_opt(&step3.data)
    };

    (
        out,
        Chv3Intermediates {
            keccak256: step1,
            sha3_512: step2,
            golden_matrix: step3,
            memory_hard_enabled,
        },
    )
}

/// Batch mining - process multiple nonces in parallel
#[inline]
pub fn cosmic_harmony_v3_batch(
    block_header: &[u8],
    start_nonce: u64,
    count: usize,
    results: &mut [Hash32],
) {
    debug_assert!(results.len() >= count);

    for i in 0..count {
        results[i] = cosmic_harmony_v3(block_header, start_nonce + i as u64);
    }
}

/// Parallel batch mining using rayon
#[cfg(feature = "parallel")]
pub fn cosmic_harmony_v3_parallel(
    block_header: &[u8],
    start_nonce: u64,
    count: usize,
) -> Vec<Hash32> {
    use rayon::prelude::*;

    (0..count)
        .into_par_iter()
        .map(|i| cosmic_harmony_v3(block_header, start_nonce + i as u64))
        .collect()
}

// ============================================================================
// DIFFICULTY CHECKING - SIMD accelerated
// ============================================================================

/// Check if hash meets difficulty target (hash <= target, big-endian)
///
/// AUDIT-FIX C-01 (16 Feb 2026): Fixed byte order — iterate MSB→LSB (index 0→31)
/// for correct big-endian comparison. SHA3/Keccak outputs are big-endian.
#[inline(always)]
pub fn meets_difficulty(hash: &Hash32, target: &[u8; 32]) -> bool {
    for i in 0..32 {
        if hash.data[i] < target[i] {
            return true;
        }
        if hash.data[i] > target[i] {
            return false;
        }
    }
    true // Equal → meets target
}

/// SIMD difficulty check (AVX2)
///
/// AUDIT-FIX C-02 (16 Feb 2026): Replaced broken _mm256_cmpgt_epi8 which used
/// SIGNED byte comparison (0xFF = -1, causing 0x01 > 0xFF = true).
/// Now delegates to the correct scalar meets_difficulty() implementation.
/// TODO: Implement proper unsigned SIMD comparison using _mm256_cmpeq + subtract.
#[cfg(target_feature = "avx2")]
#[inline]
pub fn meets_difficulty_simd(hash: &Hash32, target: &Hash32) -> bool {
    // Delegate to correct scalar implementation — signed SIMD comparison was
    // fundamentally broken for unsigned difficulty checks.
    meets_difficulty(hash, &target.data)
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keccak256_opt() {
        let input = b"test input";
        let hash = keccak256_opt(input);
        assert_eq!(hash.data.len(), 32);
    }

    #[test]
    fn test_sha3_512_opt() {
        let input = b"test input";
        let hash = sha3_512_opt(input);
        assert_eq!(hash.data.len(), 64);
    }

    #[test]
    fn test_golden_matrix_opt() {
        let input = [0u8; 64];
        let hash = golden_matrix_opt(&input);
        assert_eq!(hash.data.len(), 64);
    }

    #[test]
    fn test_cosmic_fusion_opt() {
        let input = [0u8; 64];
        let hash = cosmic_fusion_opt(&input);
        assert_eq!(hash.data.len(), 32);
    }

    #[test]
    fn test_full_pipeline() {
        let header = b"ZION block header v2.9.5";
        let hash = cosmic_harmony_v3(header, 12345);
        assert_eq!(hash.data.len(), 32);

        // Verify determinism
        let hash2 = cosmic_harmony_v3(header, 12345);
        assert_eq!(hash.data, hash2.data);
    }

    #[test]
    fn test_batch() {
        let header = b"ZION block header";
        let mut results = [Hash32::new(); 100];
        cosmic_harmony_v3_batch(header, 0, 100, &mut results);

        // All hashes should be unique
        for i in 0..99 {
            assert_ne!(results[i].data, results[i + 1].data);
        }
    }

    #[test]
    fn test_difficulty() {
        let easy_target = [0xFF; 32];
        let hard_target = [0x00; 32];

        let hash = Hash32 { data: [0x7F; 32] };

        assert!(meets_difficulty(&hash, &easy_target));
        assert!(!meets_difficulty(&hash, &hard_target));
    }

    // ============================================================================
    // GPU Kernel Algorithm Reimplementation (for comparison testing)
    // ============================================================================

    const KECCAK_RC: [u64; 24] = [
        0x0000000000000001, 0x0000000000008082, 0x800000000000808A,
        0x8000000080008000, 0x000000000000808B, 0x0000000080000001,
        0x8000000080008081, 0x8000000000008009, 0x000000000000008A,
        0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
        0x000000008000808B, 0x800000000000008B, 0x8000000000008089,
        0x8000000000008003, 0x8000000000008002, 0x8000000000000080,
        0x000000000000800A, 0x800000008000000A, 0x8000000080008081,
        0x8000000000000001, 0x8000000080008008, 0x0000000000000000,
    ];
    const KECCAK_PILN: [usize; 24] = [
        10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4,
        15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1,
    ];
    const KECCAK_ROTC: [u32; 24] = [
        1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14,
        27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44,
    ];

    fn gpu_keccak_f1600(state: &mut [u64; 25]) {
        let mut bc = [0u64; 5];
        for round in 0..24 {
            // Theta
            for i in 0..5 {
                bc[i] = state[i] ^ state[i+5] ^ state[i+10] ^ state[i+15] ^ state[i+20];
            }
            for i in 0..5 {
                let t = bc[(i+4) % 5] ^ bc[(i+1) % 5].rotate_left(1);
                for j in (0..25).step_by(5) {
                    state[j+i] ^= t;
                }
            }
            // Rho + Pi
            let mut t = state[1];
            for i in 0..24 {
                let j = KECCAK_PILN[i];
                bc[0] = state[j];
                state[j] = t.rotate_left(KECCAK_ROTC[i]);
                t = bc[0];
            }
            // Chi
            for j in (0..25).step_by(5) {
                for i in 0..5 { bc[i] = state[j+i]; }
                for i in 0..5 {
                    state[j+i] ^= (!bc[(i+1) % 5]) & bc[(i+2) % 5];
                }
            }
            // Iota
            state[0] ^= KECCAK_RC[round];
        }
    }

    /// Reference Keccak-f[1600] from FIPS 202 spec (2D representation)
    fn reference_keccak_f1600(state: &mut [u64; 25]) {
        // Rotation offsets: rot_offsets[y][x] = r[x,y]
        const ROT: [[u32; 5]; 5] = [
            [ 0,  1, 62, 28, 27],  // y=0
            [36, 44,  6, 55, 20],  // y=1
            [ 3, 10, 43, 25, 39],  // y=2
            [41, 45, 15, 21,  8],  // y=3
            [18,  2, 61, 56, 14],  // y=4
        ];
        for round in 0..24 {
            // θ (Theta)
            let mut c = [0u64; 5];
            for x in 0..5 {
                c[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
            }
            let mut d = [0u64; 5];
            for x in 0..5 {
                d[x] = c[(x + 4) % 5] ^ c[(x + 1) % 5].rotate_left(1);
            }
            for y in 0..5 {
                for x in 0..5 {
                    state[x + 5*y] ^= d[x];
                }
            }
            // ρ (Rho) + π (Pi) combined
            let mut b = [0u64; 25];
            for y in 0..5 {
                for x in 0..5 {
                    let rotated = state[x + 5*y].rotate_left(ROT[y][x]);
                    let new_x = y;
                    let new_y = (2 * x + 3 * y) % 5;
                    b[new_x + 5*new_y] = rotated;
                }
            }
            // χ (Chi)
            for y in 0..5 {
                for x in 0..5 {
                    state[x + 5*y] = b[x + 5*y] ^ ((!b[(x+1)%5 + 5*y]) & b[(x+2)%5 + 5*y]);
                }
            }
            // ι (Iota)
            state[0] ^= KECCAK_RC[round];
        }
    }

    /// GPU-style Keccak-256 (pad byte 0x01, rate=136)
    fn gpu_keccak256(input: &[u8]) -> [u8; 32] {
        let mut state = [0u64; 25];
        let full_words = input.len() / 8;
        for i in 0..full_words {
            let mut w = 0u64;
            for b in 0..8 {
                w |= (input[i*8+b] as u64) << (b*8);
            }
            state[i] ^= w;
        }
        let rem = input.len() % 8;
        let pw = full_words;
        let mut pad = 0u64;
        for b in 0..rem {
            pad |= (input[pw*8+b] as u64) << (b*8);
        }
        pad |= 0x01u64 << (rem * 8);
        state[pw] ^= pad;
        state[16] ^= 0x8000000000000000u64;
        gpu_keccak_f1600(&mut state);
        let mut output = [0u8; 32];
        for i in 0..4 {
            for b in 0..8 {
                output[i*8+b] = (state[i] >> (b*8)) as u8;
            }
        }
        output
    }

    /// GPU-style SHA3-512 (pad byte 0x06, rate=72) for 32-byte input
    fn gpu_sha3_512_words(input: &[u8; 32]) -> [u64; 8] {
        let mut state = [0u64; 25];
        for i in 0..4 {
            let mut w = 0u64;
            for b in 0..8 {
                w |= (input[i*8+b] as u64) << (b*8);
            }
            state[i] ^= w;
        }
        state[4] ^= 0x06;
        state[8] ^= 0x8000000000000000u64;
        gpu_keccak_f1600(&mut state);
        let mut out = [0u64; 8];
        for i in 0..8 { out[i] = state[i]; }
        out
    }

    /// GPU-style GoldenMatrix
    fn gpu_golden_matrix(sha3_words: &[u64; 8]) -> [u64; 8] {
        let mut result = [0u64; 8];
        for i in 0..8 {
            let mut sum = 0u64;
            for j in 0..8 {
                let byte_val = (sha3_words[i] >> (j * 8)) & 0xFF;
                sum += byte_val * PHI_POWERS_FP[i + j];
            }
            result[i] = sum >> 32;
        }
        result
    }

    /// GPU-style CosmicFusion
    fn gpu_cosmic_fusion(gm_words: &[u64; 8]) -> [u8; 32] {
        // Convert golden-matrix u64 words -> 64 bytes (LE)
        let mut state = [0u8; 64];
        for i in 0..8 {
            for b in 0..8 {
                state[i*8+b] = (gm_words[i] >> (b*8)) as u8;
            }
        }
        // 4 fusion rounds
        for round in 0..4u8 {
            let mut kin = [0u8; 33];
            kin[..32].copy_from_slice(&state[..32]);
            kin[32] = round;
            let intermediate = gpu_keccak256(&kin);
            for i in 0..32 {
                state[i] = intermediate[i] ^ COSMIC_XOR_MASK[i];
            }
        }
        // Final: SHA3-512(state[0..32]) -> first 32 bytes
        gpu_sha3_512_trunc32(&state[..32])
    }

    /// GPU-style SHA3-512 truncated to 32 bytes
    fn gpu_sha3_512_trunc32(input: &[u8]) -> [u8; 32] {
        let mut state = [0u64; 25];
        for i in 0..4 {
            let mut w = 0u64;
            for b in 0..8 {
                w |= (input[i*8+b] as u64) << (b*8);
            }
            state[i] ^= w;
        }
        state[4] ^= 0x06;
        state[8] ^= 0x8000000000000000u64;
        gpu_keccak_f1600(&mut state);
        let mut output = [0u8; 32];
        for i in 0..4 {
            for b in 0..8 {
                output[i*8+b] = (state[i] >> (b*8)) as u8;
            }
        }
        output
    }

    /// Full GPU pipeline reimplemented in Rust
    fn gpu_cosmic_harmony_v3_legacy(block_header: &[u8], nonce: u64) -> [u8; 32] {
        let mut input = [0u8; 88];
        let copy_len = block_header.len().min(80);
        input[..copy_len].copy_from_slice(&block_header[..copy_len]);
        input[80..88].copy_from_slice(&nonce.to_le_bytes());

        let step1 = gpu_keccak256(&input);
        let step2 = gpu_sha3_512_words(&step1);
        let step3 = gpu_golden_matrix(&step2);
        gpu_cosmic_fusion(&step3)
    }

    #[test]
    fn test_gpu_vs_cpu_keccak256() {
        // Known Keccak-256 (pad=0x01) test vectors (Ethereum keccak256)
        let known_vectors: Vec<(&[u8], &str)> = vec![
            // Empty string
            (b"", "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"),
            // "abc"  -- well-known test vector
            (b"abc", "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"),
        ];

        for (input, expected_hex) in &known_vectors {
            let cpu_hash = keccak256_opt(input);
            let gpu_hash = gpu_keccak256(input);
            println!(
                "Input: {:?} ({} bytes)\n  expected: {}\n  cpu:      {}\n  gpu:      {}",
                String::from_utf8_lossy(input),
                input.len(),
                expected_hex,
                hex::encode(cpu_hash.data),
                hex::encode(gpu_hash),
            );
            // Check CPU matches known vector
            assert_eq!(
                hex::encode(cpu_hash.data), *expected_hex,
                "CPU Keccak-256 does not match known vector for {:?}",
                String::from_utf8_lossy(input),
            );
        }

        // Debug: compare gpu_keccak_f1600 vs reference_keccak_f1600 round by round
        {
            println!("\n--- Comparing gpu_keccak_f1600 vs reference_keccak_f1600 ---");
            let mut gpu_state = [0u64; 25];
            let mut ref_state = [0u64; 25];
            gpu_state[0] = 0x01;
            gpu_state[16] = 0x8000000000000000;
            ref_state[0] = 0x01;
            ref_state[16] = 0x8000000000000000;

            // Run both ONE round at a time and compare
            for round in 0..24 {
                // GPU: one round
                {
                    let state = &mut gpu_state;
                    let mut bc = [0u64; 5];
                    for i in 0..5 {
                        bc[i] = state[i] ^ state[i+5] ^ state[i+10] ^ state[i+15] ^ state[i+20];
                    }
                    for i in 0..5 {
                        let t = bc[(i+4) % 5] ^ bc[(i+1) % 5].rotate_left(1);
                        for j in (0..25).step_by(5) { state[j+i] ^= t; }
                    }
                    let mut t = state[1];
                    for i in 0..24 {
                        let j = KECCAK_PILN[i];
                        bc[0] = state[j];
                        state[j] = t.rotate_left(KECCAK_ROTC[i]);
                        t = bc[0];
                    }
                    for j in (0..25).step_by(5) {
                        for i in 0..5 { bc[i] = state[j+i]; }
                        for i in 0..5 { state[j+i] ^= (!bc[(i+1)%5]) & bc[(i+2)%5]; }
                    }
                    state[0] ^= KECCAK_RC[round];
                }
                // Reference: one round
                {
                    const ROT: [[u32; 5]; 5] = [
                        [ 0,  1, 62, 28, 27],
                        [36, 44,  6, 55, 20],
                        [ 3, 10, 43, 25, 39],
                        [41, 45, 15, 21,  8],
                        [18,  2, 61, 56, 14],
                    ];
                    let state = &mut ref_state;
                    let mut c = [0u64; 5];
                    for x in 0..5 { c[x] = state[x]^state[x+5]^state[x+10]^state[x+15]^state[x+20]; }
                    let mut d = [0u64; 5];
                    for x in 0..5 { d[x] = c[(x+4)%5] ^ c[(x+1)%5].rotate_left(1); }
                    for y in 0..5 { for x in 0..5 { state[x+5*y] ^= d[x]; } }
                    let mut b = [0u64; 25];
                    for y in 0..5 {
                        for x in 0..5 {
                            let rotated = state[x+5*y].rotate_left(ROT[y][x]);
                            let nx = y; let ny = (2*x + 3*y) % 5;
                            b[nx + 5*ny] = rotated;
                        }
                    }
                    for y in 0..5 {
                        for x in 0..5 {
                            state[x+5*y] = b[x+5*y] ^ ((!b[(x+1)%5+5*y]) & b[(x+2)%5+5*y]);
                        }
                    }
                    state[0] ^= KECCAK_RC[round];
                }
                // Compare
                if gpu_state != ref_state {
                    println!("  DIVERGENCE at round {}!", round);
                    for i in 0..25 {
                        if gpu_state[i] != ref_state[i] {
                            println!("    state[{:2}]: gpu={:016x} ref={:016x}", i, gpu_state[i], ref_state[i]);
                        }
                    }
                    panic!("f1600 diverges at round {}", round);
                }
            }
            println!("  All 24 rounds match! ✅");

            // Now verify output
            let mut out = [0u8; 32];
            for i in 0..4 {
                for b in 0..8 { out[i*8+b] = (ref_state[i] >> (b*8)) as u8; }
            }
            let expected = "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
            println!("  ref_hash(empty) = {}", hex::encode(out));
            assert_eq!(hex::encode(out), expected, "Reference f1600 should produce correct Keccak-256 of empty string");
        }

        // Test with various input sizes
        for input in &[
            b"hello world".to_vec(),
            vec![0u8; 88],
            vec![0xAB; 33],
        ] {
            let cpu_hash = keccak256_opt(input);
            let gpu_hash = gpu_keccak256(input);
            println!(
                "Input {} bytes: cpu={} gpu={} match={}",
                input.len(),
                hex::encode(cpu_hash.data),
                hex::encode(gpu_hash),
                cpu_hash.data == gpu_hash,
            );
        }
    }

    #[test]
    fn test_gpu_vs_cpu_sha3_512() {
        // Test SHA3-512 with 32-byte input
        let input = [0x42u8; 32];
        let cpu_hash = sha3_512_opt(&input);
        let gpu_words = gpu_sha3_512_words(&input);
        // Convert GPU words to bytes
        let mut gpu_bytes = [0u8; 64];
        for i in 0..8 {
            for b in 0..8 {
                gpu_bytes[i*8+b] = (gpu_words[i] >> (b*8)) as u8;
            }
        }
        assert_eq!(
            cpu_hash.data, gpu_bytes,
            "SHA3-512 mismatch:\n  cpu={}\n  gpu={}",
            hex::encode(cpu_hash.data),
            hex::encode(gpu_bytes),
        );
        println!("✅ SHA3-512: GPU matches CPU");
    }

    #[test]
    fn test_gpu_vs_cpu_golden_matrix() {
        // Set up a known SHA3-512 output
        let keccak_input = [0x42u8; 32];
        let sha3_out = sha3_512_opt(&keccak_input);

        let cpu_gm = golden_matrix_opt(&sha3_out.data);

        // Convert SHA3 output to u64 words (same as GPU)
        let mut sha3_words = [0u64; 8];
        for i in 0..8 {
            for b in 0..8 {
                sha3_words[i] |= (sha3_out.data[i*8+b] as u64) << (b*8);
            }
        }
        let gpu_gm = gpu_golden_matrix(&sha3_words);

        // Compare: CPU uses u128 accumulator, GPU uses u64. Both should give same result.
        let mut gpu_gm_bytes = [0u8; 64];
        for i in 0..8 {
            for b in 0..8 {
                gpu_gm_bytes[i*8+b] = (gpu_gm[i] >> (b*8)) as u8;
            }
        }
        assert_eq!(
            cpu_gm.data, gpu_gm_bytes,
            "GoldenMatrix mismatch:\n  cpu={}\n  gpu={}",
            hex::encode(cpu_gm.data),
            hex::encode(gpu_gm_bytes),
        );
        println!("✅ GoldenMatrix: GPU matches CPU");
    }

    #[test]
    fn test_gpu_vs_cpu_full_pipeline() {
        let header = b"ZION block header v2.9.5";
        let nonce = 12345u64;

        let cpu_hash = cosmic_harmony_v3_legacy(header, nonce);
        let gpu_hash = gpu_cosmic_harmony_v3_legacy(header, nonce);

        assert_eq!(
            cpu_hash.data, gpu_hash,
            "Full pipeline mismatch:\n  cpu={}\n  gpu={}",
            hex::encode(cpu_hash.data),
            hex::encode(gpu_hash),
        );
        println!("✅ Full pipeline: GPU matches CPU");
    }

    #[test]
    fn test_gpu_vs_cpu_with_real_data() {
        // Real blob from miner logs (first 20 bytes: 01000000ee020000000000003365303130303030)
        // Full blob is 165 bytes, but we only use first 80 for CHv3
        let blob_hex = "01000000ee020000000000003365303130303030";
        let blob_bytes = hex::decode(blob_hex).unwrap();
        let nonce = 196001088u64;

        let cpu_hash = cosmic_harmony_v3_with_height(&blob_bytes, nonce, 750);
        let gpu_hash = gpu_cosmic_harmony_v3_legacy(&blob_bytes, nonce);

        // Also test with intermediates
        let (cpu_final, intermediates) =
            cosmic_harmony_v3_with_height_intermediates(&blob_bytes, nonce, 750);

        println!("Real data test (nonce={}, blob_len={}, height=750):", nonce, blob_bytes.len());
        println!("  CPU final hash: {}", hex::encode(cpu_final.data));
        println!("  GPU final hash: {}", hex::encode(gpu_hash));
        println!("  CPU Keccak256:  {}", hex::encode(intermediates.keccak256.data));
        println!("  CPU SHA3-512:   {}", hex::encode(intermediates.sha3_512.data));
        println!("  CPU GoldenMat:  {}", hex::encode(intermediates.golden_matrix.data));
        println!("  memory_hard:    {}", intermediates.memory_hard_enabled);

        // Step-by-step GPU comparison
        let mut input = [0u8; 88];
        let copy_len = blob_bytes.len().min(80);
        input[..copy_len].copy_from_slice(&blob_bytes[..copy_len]);
        input[80..88].copy_from_slice(&nonce.to_le_bytes());

        let gpu_step1 = gpu_keccak256(&input);
        println!("  GPU Keccak256:  {}", hex::encode(gpu_step1));
        assert_eq!(
            intermediates.keccak256.data, gpu_step1,
            "Step 1 (Keccak-256) mismatch!"
        );

        let gpu_step2 = gpu_sha3_512_words(&gpu_step1);
        let mut gpu_step2_bytes = [0u8; 64];
        for i in 0..8 {
            for b in 0..8 {
                gpu_step2_bytes[i*8+b] = (gpu_step2[i] >> (b*8)) as u8;
            }
        }
        println!("  GPU SHA3-512:   {}", hex::encode(gpu_step2_bytes));
        assert_eq!(
            intermediates.sha3_512.data, gpu_step2_bytes,
            "Step 2 (SHA3-512) mismatch!"
        );

        let gpu_step3 = gpu_golden_matrix(&gpu_step2);
        let mut gpu_step3_bytes = [0u8; 64];
        for i in 0..8 {
            for b in 0..8 {
                gpu_step3_bytes[i*8+b] = (gpu_step3[i] >> (b*8)) as u8;
            }
        }
        println!("  GPU GoldenMat:  {}", hex::encode(gpu_step3_bytes));
        assert_eq!(
            intermediates.golden_matrix.data, gpu_step3_bytes,
            "Step 3 (GoldenMatrix) mismatch!"
        );

        let gpu_step4 = gpu_cosmic_fusion(&gpu_step3);
        println!("  GPU Fusion:     {}", hex::encode(gpu_step4));
        assert_eq!(
            cpu_final.data, gpu_step4,
            "Step 4 (CosmicFusion) mismatch!"
        );
    }
}
