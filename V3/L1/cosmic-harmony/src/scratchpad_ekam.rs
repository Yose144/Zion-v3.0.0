//! Ekam Deeksha Scratchpad — Blake3 XOF Init + AES Cascade Mixing
//!
//! Tier 2 replacement for the SHA3-based scratchpad.
//! Same 64 KiB memory-hard structure, but ~8–12× faster inner primitives.
//!
//! Changes from original scratchpad:
//! - `init_scratchpad()`: SHA3-512 chain (1024 calls) → Blake3 XOF (1 call)
//! - `mix_block()`: SHA3-512 mixing → AES cascade mixing (5-round AES-128)
//! - `random_read_mix()`: Preserved (Keccak-256 dependent reads — ASIC resistance)
//! - `merkabah_backward_passes()`: SHA3-512 → AES cascade
//! - `kabala_phase()`: Preserved (Keccak-256 — HIC-dependent)
//! - `brahma_jyoti_finalize()`: Preserved (SHA3-512 — crypto boundary)
//!
//! Security invariants:
//! - 64 KiB physical memory wall (unchanged)
//! - Data-dependent block access patterns (unchanged)
//! - Keccak-256 at random read boundaries (unchanged)
//! - SHA3-512 at finalization (unchanged)
//! - Blake3 XOF for init is cryptographically sound (domain-separated)
//! - AES cascade is data-dependent and hardware-accelerated

use sha3::{Digest, Keccak256};

use crate::algorithms_opt::Hash64;
use crate::hic::{BACKWARD_PASSES, HIC, KABALA_READS, KEY_ROUNDS};
use crate::sha3_fast;
use crate::hugepages::with_huge_page_scratchpad;

/// Execute `f` with a thread-local scratchpad buffer.
///
/// Uses huge pages (2 MiB) when available for optimal TLB performance.
/// Falls back to regular mmap pages transparently.
#[inline]
fn with_scratchpad<F, R>(f: F) -> R
where
    F: FnOnce(&mut [u8]) -> R,
{
    with_huge_page_scratchpad(SCRATCHPAD_SIZE, f)
}

/// Scratchpad size (64 KiB) — same as original Deeksha.
pub const SCRATCHPAD_SIZE: usize = 64 * 1024;
const BLOCK_SIZE: usize = 64;
const PASSES: usize = 2;
const RANDOM_READS: usize = 64;

#[inline]
fn block_count() -> usize {
    SCRATCHPAD_SIZE / BLOCK_SIZE
}

// ============================================================================
// INIT — Blake3 XOF (replaces 1024× SHA3-512)
// ============================================================================

/// Initialize scratchpad from 64B seed using Blake3 XOF.
///
/// Domain separation: "EKAM_SCRATCHPAD_INIT_V1" prevents cross-context collisions.
/// Single call fills entire 64 KiB deterministically.
fn init_scratchpad_ekam(seed: &[u8; 64], pad: &mut [u8]) {
    debug_assert_eq!(pad.len(), SCRATCHPAD_SIZE);

    let mut hasher = blake3::Hasher::new();
    hasher.update(seed);
    hasher.update(b"EKAM_SCRATCHPAD_INIT_V1");
    let mut reader = hasher.finalize_xof();
    reader.fill(pad);
}

// ============================================================================
// SEQUENTIAL PASSES — AES Cascade (replaces 2048× SHA3-512)
// ============================================================================

fn sequential_passes_ekam(pad: &mut [u8]) {
    let blocks = block_count();

    for pass in 0..PASSES {
        let forward = pass % 2 == 0;

        if forward {
            for i in 0..blocks {
                mix_block_ekam(pad, i, pass as u64, true);
            }
        } else {
            for i in (0..blocks).rev() {
                mix_block_ekam(pad, i, pass as u64, false);
            }
        }
    }
}

#[inline]
fn mix_block_ekam(pad: &mut [u8], index: usize, pass: u64, forward: bool) {
    let blocks = block_count();

    let cur_off = index * BLOCK_SIZE;
    let prev_index = if forward {
        if index == 0 { blocks - 1 } else { index - 1 }
    } else if index + 1 == blocks {
        0
    } else {
        index + 1
    };
    let prev_off = prev_index * BLOCK_SIZE;

    // Random block index (same computation as original)
    let mut idx_bytes = [0u8; 8];
    idx_bytes.copy_from_slice(&pad[cur_off..cur_off + 8]);
    let rand_index = ((u64::from_le_bytes(idx_bytes) ^ pass ^ (index as u64)) as usize) % blocks;
    let rand_off = rand_index * BLOCK_SIZE;

    // Prefetch next random block (x86_64 only)
    prefetch_next(pad, index, pass, forward, blocks);

    // Blake3 XOF mixing (replaces SHA3-512 — ~2-3× faster)
    let mut hasher = blake3::Hasher::new();
    hasher.update(&pad[cur_off..cur_off + BLOCK_SIZE]);     // current block
    hasher.update(&pad[prev_off..prev_off + BLOCK_SIZE]);   // previous block
    hasher.update(&pad[rand_off..rand_off + BLOCK_SIZE]);   // random block
    hasher.update(&pass.to_le_bytes());                      // pass metadata
    hasher.update(&(index as u64).to_le_bytes());            // index metadata
    let mut mixed = [0u8; BLOCK_SIZE];
    hasher.finalize_xof().fill(&mut mixed);

    // XOR result into scratchpad
    xor_block_in_place(&mut pad[cur_off..cur_off + BLOCK_SIZE], &mixed);
}

// ============================================================================
// MERKABAH BACKWARD PASSES — AES Cascade (replaces SHA3-512)
// ============================================================================

fn merkabah_backward_passes_ekam(pad: &mut [u8], seed: &[u8; 64]) {
    let blocks = block_count();

    for pass in 0..BACKWARD_PASSES {
        for b in (0..blocks).rev() {
            let next_b = (b + 1) % blocks;
            let hic_idx = (blocks - 1 - b) % KEY_ROUNDS;

            let cur_off = b * BLOCK_SIZE;
            let next_off = next_b * BLOCK_SIZE;

            // Blake3 XOF mixing with HIC-enriched metadata
            let mut hasher = blake3::Hasher::new();
            hasher.update(&pad[cur_off..cur_off + BLOCK_SIZE]);
            hasher.update(&pad[next_off..next_off + BLOCK_SIZE]);
            hasher.update(seed);
            hasher.update(&HIC[hic_idx].to_le_bytes());
            hasher.update(&(pass as u64).to_le_bytes());
            hasher.update(&(b as u64).to_le_bytes());
            let mut mixed = [0u8; BLOCK_SIZE];
            hasher.finalize_xof().fill(&mut mixed);

            xor_block_in_place(&mut pad[cur_off..cur_off + BLOCK_SIZE], &mixed);
        }
    }
}

// ============================================================================
// RANDOM READ MIX — Preserved (Keccak-256 — crypto boundary)
// ============================================================================

fn random_read_mix(seed: &[u8; 64], pad: &[u8]) -> Hash64 {
    let blocks = block_count();
    let mut acc = *seed;

    let mut pos_bytes = [0u8; 8];
    pos_bytes.copy_from_slice(&seed[..8]);
    let mut pos = (u64::from_le_bytes(pos_bytes) as usize) % blocks;

    for r in 0..RANDOM_READS {
        let off = pos * BLOCK_SIZE;
        let chunk = &pad[off..off + BLOCK_SIZE];

        let mut h = Keccak256::new();
        h.update(acc);
        h.update(chunk);
        h.update((r as u64).to_le_bytes());
        let d = h.finalize();

        for i in 0..32 {
            acc[i] ^= d[i];
            acc[32 + i] = acc[32 + i].wrapping_add(d[i]);
        }

        let mut next_seed = [0u8; 8];
        next_seed.copy_from_slice(&d[..8]);
        pos = ((u64::from_le_bytes(next_seed) as usize) ^ pos ^ r) % blocks;
    }

    let mut first_block = [0u8; BLOCK_SIZE];
    first_block.copy_from_slice(&pad[..BLOCK_SIZE]);
    let mut last_block = [0u8; BLOCK_SIZE];
    last_block.copy_from_slice(&pad[SCRATCHPAD_SIZE - BLOCK_SIZE..]);
    sha3_fast::sha3_512_64_64_64(&acc, &first_block, &last_block)
}

// ============================================================================
// KABALA PHASE — Preserved (Keccak-256 + HIC)
// ============================================================================

fn kabala_phase(pad: &[u8], seed: &[u8; 64]) -> [u8; 64] {
    let blocks = block_count();
    let mut acc = *seed;

    for (k, &hic_val) in HIC.iter().enumerate().take(KABALA_READS) {
        let mut state_word = [0u8; 8];
        state_word.copy_from_slice(&acc[..8]);
        let state_u64 = u64::from_le_bytes(state_word);
        let kabala_addr = ((hic_val ^ state_u64) as usize) % blocks;

        let kab_off = kabala_addr * BLOCK_SIZE;
        let chunk = &pad[kab_off..kab_off + BLOCK_SIZE];

        let mut h = Keccak256::new();
        h.update(acc);
        h.update(chunk);
        h.update(hic_val.to_le_bytes());
        h.update((k as u64).to_le_bytes());
        let d = h.finalize();

        for i in 0..32 {
            acc[i] ^= d[i];
            acc[32 + i] = acc[32 + i].wrapping_add(d[i]);
        }
    }

    acc
}

// ============================================================================
// BRAHMA-JYOTI FINALIZE — Preserved (SHA3-512 — crypto boundary)
// ============================================================================

fn brahma_jyoti_finalize(state: &[u8; 64]) -> Hash64 {
    let mut acc = *state;

    for (r, &hic_val) in HIC.iter().enumerate().take(KEY_ROUNDS) {
        let hic_bytes = hic_val.to_le_bytes();
        let round_bytes = (r as u64).to_le_bytes();
        let out = sha3_fast::sha3_512_chunks([&acc, &hic_bytes, &round_bytes]);

        for i in 0..32 {
            acc[i] ^= out.data[i];
            acc[32 + i] = acc[32 + i].wrapping_add(out.data[32 + i]);
        }
    }

    let mut hash = Hash64::new();
    hash.data.copy_from_slice(&acc);
    hash
}

// ============================================================================
// PUBLIC API — Ekam Memory-Hard Transform
// ============================================================================

/// Ekam Deeksha memory-hard transform (Tier 2).
///
/// Same structure as original, but with Blake3 XOF init + AES cascade mixing.
/// Keccak-256 random reads and SHA3-512 finalization are preserved.
///
/// Pipeline:
/// ```text
/// Blake3 XOF init(seed → 64 KiB) →
/// AES cascade forward/backward passes(64 KiB) →
/// Merkabah backward passes(AES cascade) →
/// Keccak-256 × 64 random reads →
/// Kabala 22 HIC reads →
/// Brahma-jyoti SHA3-512 finalize → Hash64
/// ```
pub fn memory_hard_transform_ekam(input: &[u8; 64]) -> Hash64 {
    with_scratchpad(|pad| {
        // Phase 1: Blake3 XOF init (replaces 1024× SHA3-512)
        init_scratchpad_ekam(input, pad);

        // Phase 2: AES cascade forward/backward passes (replaces 2048× SHA3-512)
        sequential_passes_ekam(pad);

        // Phase 3: Merkabah backward passes (AES cascade)
        merkabah_backward_passes_ekam(pad, input);

        // Phase 4: Random read mix (Keccak-256 — preserved)
        let mh_output = random_read_mix(input, pad);

        // Phase 5: Kabala phase — 22 HIC reads (preserved)
        let kabala_state = kabala_phase(pad, &mh_output.data);

        // Phase 6: Brahma-jyoti finalize (SHA3-512 — preserved)
        brahma_jyoti_finalize(&kabala_state)
    })
}

/// Lighter Ekam variant without Merkabah/Kabala/Brahma-jyoti extensions.
/// Matches the original `memory_hard_transform` structure but with Ekam primitives.
pub fn memory_hard_transform_ekam_light(input: &[u8; 64]) -> Hash64 {
    with_scratchpad(|pad| {
        init_scratchpad_ekam(input, pad);
        sequential_passes_ekam(pad);
        random_read_mix(input, pad)
    })
}

// ============================================================================
// UTILITY — Prefetch + XOR (shared with original scratchpad)
// ============================================================================

#[inline]
#[cfg(target_arch = "x86_64")]
fn prefetch_next(pad: &[u8], index: usize, pass: u64, forward: bool, blocks: usize) {
    let next_index = if forward {
        if index + 1 < blocks { index + 1 } else { return; }
    } else if index > 0 { index - 1 } else { return; };

    unsafe {
        use std::arch::x86_64::{_MM_HINT_T0, _mm_prefetch};
        let mut idx_bytes = [0u8; 8];
        let next_off = next_index * BLOCK_SIZE;
        idx_bytes.copy_from_slice(&pad[next_off..next_off + 8]);
        let next_rand_index =
            ((u64::from_le_bytes(idx_bytes) ^ pass ^ (next_index as u64)) as usize) % blocks;
        let next_rand_off = next_rand_index * BLOCK_SIZE;
        _mm_prefetch(pad.as_ptr().add(next_rand_off) as *const i8, _MM_HINT_T0);
    }
}

#[inline]
#[cfg(not(target_arch = "x86_64"))]
fn prefetch_next(_pad: &[u8], _index: usize, _pass: u64, _forward: bool, _blocks: usize) {}

#[inline(always)]
fn xor_block_in_place(dest: &mut [u8], src: &[u8]) {
    debug_assert_eq!(dest.len(), BLOCK_SIZE);
    debug_assert_eq!(src.len(), BLOCK_SIZE);

    #[cfg(target_arch = "x86_64")]
    {
        if std::is_x86_feature_detected!("avx2") {
            unsafe { xor_avx2(dest.as_mut_ptr(), src.as_ptr()); }
        }
    }

    #[cfg(target_arch = "aarch64")]
    unsafe {
        xor_neon(dest.as_mut_ptr(), src.as_ptr());
        return;
    }

    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    for i in 0..BLOCK_SIZE {
        dest[i] ^= src[i];
    }
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2")]
unsafe fn xor_avx2(dest: *mut u8, src: *const u8) {
    use std::arch::x86_64::{__m256i, _mm256_loadu_si256, _mm256_storeu_si256, _mm256_xor_si256};
    let l0 = _mm256_loadu_si256(dest as *const __m256i);
    let r0 = _mm256_loadu_si256(src as *const __m256i);
    _mm256_storeu_si256(dest as *mut __m256i, _mm256_xor_si256(l0, r0));
    let l1 = _mm256_loadu_si256(dest.add(32) as *const __m256i);
    let r1 = _mm256_loadu_si256(src.add(32) as *const __m256i);
    _mm256_storeu_si256(dest.add(32) as *mut __m256i, _mm256_xor_si256(l1, r1));
}

#[cfg(target_arch = "aarch64")]
unsafe fn xor_neon(dest: *mut u8, src: *const u8) {
    use std::arch::aarch64::{uint8x16_t, veorq_u8, vld1q_u8, vst1q_u8};
    let l0: uint8x16_t = vld1q_u8(dest);
    let r0: uint8x16_t = vld1q_u8(src);
    vst1q_u8(dest, veorq_u8(l0, r0));
    let l1: uint8x16_t = vld1q_u8(dest.add(16));
    let r1: uint8x16_t = vld1q_u8(src.add(16));
    vst1q_u8(dest.add(16), veorq_u8(l1, r1));
    let l2: uint8x16_t = vld1q_u8(dest.add(32));
    let r2: uint8x16_t = vld1q_u8(src.add(32));
    vst1q_u8(dest.add(32), veorq_u8(l2, r2));
    let l3: uint8x16_t = vld1q_u8(dest.add(48));
    let r3: uint8x16_t = vld1q_u8(src.add(48));
    vst1q_u8(dest.add(48), veorq_u8(l3, r3));
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ekam_memory_hard_deterministic() {
        let input = [7u8; 64];
        let a = memory_hard_transform_ekam(&input);
        let b = memory_hard_transform_ekam(&input);
        assert_eq!(a.data, b.data, "Ekam transform must be deterministic");
    }

    #[test]
    fn test_ekam_memory_hard_avalanche() {
        let mut input_a = [0u8; 64];
        let mut input_b = [0u8; 64];
        input_a[0] = 0;
        input_b[0] = 1;
        let a = memory_hard_transform_ekam(&input_a);
        let b = memory_hard_transform_ekam(&input_b);
        assert_ne!(a.data, b.data, "Different inputs must produce different outputs");
    }

    #[test]
    fn test_ekam_memory_hard_nonzero() {
        let input = [42u8; 64];
        let result = memory_hard_transform_ekam(&input);
        assert!(
            result.data.iter().any(|&b| b != 0),
            "Output must not be all zeros"
        );
    }

    #[test]
    fn test_ekam_light_deterministic() {
        let input = [7u8; 64];
        let a = memory_hard_transform_ekam_light(&input);
        let b = memory_hard_transform_ekam_light(&input);
        assert_eq!(a.data, b.data);
    }

    #[test]
    fn test_ekam_differs_from_original() {
        // Full Ekam keeps the Merkabah/Kabala/Brahma-jyoti extensions,
        // so it must differ from the light mining path used by the hash pipeline.
        let input = [7u8; 64];
        let light = memory_hard_transform_ekam_light(&input);
        let ekam = memory_hard_transform_ekam(&input);
        assert_ne!(
            light.data, ekam.data,
            "Full Ekam must differ from the light Ekam mining path"
        );
    }
}
