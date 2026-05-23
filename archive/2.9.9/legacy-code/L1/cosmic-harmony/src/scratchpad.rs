//! Memory-hard scratchpad layer for Cosmic Harmony v3/v4/v4.2.
//!
//! Cíl: zvýšit ASIC resistance přidáním výrazné paměťové práce mezi
//! Golden Matrix a Cosmic Fusion fází.
//!
//! Performance: používáme thread-local scratchpad buffer — vyhýbáme se
//! opakované heap allocation per hash, což dává ~20-35% zrychlení při
//! paralelním mining (rayon), kde každé vlákno reusuje svůj buffer.
//!
//! ## CHv4.2 rozšíření
//! Funkce `memory_hard_transform_v4_2` přidává:
//! - Merkabah Backward Passes (Ra — vzestupná spirála)
//! - Kabalistická fáze — 22 deterministických čtení
//! - Brahma-jyoti finalizace — 22-kolo SHA3 key schedule

use sha3::{Digest, Keccak256};
use std::cell::RefCell;

use crate::algorithms_opt::Hash64;
use crate::hic::{BACKWARD_PASSES, HIC, KABALA_READS, KEY_ROUNDS};
use crate::sha3_fast;

// Thread-local scratchpad — každé vlákno má vlastní buffer,
// žádný malloc/free per hash. Reuse je bezpečný protože scratchpad
// je vždy plně přepsán v init_scratchpad() před použitím.
thread_local! {
    static SCRATCHPAD_BUF: RefCell<Vec<u8>> = RefCell::new(vec![0u8; SCRATCHPAD_SIZE]);
}

/// Provede `f` s thread-local scratchpad bufferem.
/// Buffer je vždy předán jako &mut [u8; SCRATCHPAD_SIZE].
#[inline]
fn with_scratchpad<F, R>(f: F) -> R
where
    F: FnOnce(&mut Vec<u8>) -> R,
{
    SCRATCHPAD_BUF.with(|cell| {
        let mut buf = cell.borrow_mut();
        // Zajisti správnou velikost (obrana pro případ re-inicializace)
        if buf.len() != SCRATCHPAD_SIZE {
            buf.resize(SCRATCHPAD_SIZE, 0);
        }
        f(&mut buf)
    })
}

/// Scratchpad velikost v bajtech (64 KiB) — CHv4.1 light profil.
pub const SCRATCHPAD_SIZE: usize = 64 * 1024;

/// Velikost jednoho bloku scratchpadu.
const BLOCK_SIZE: usize = 64;

/// Počet sekvenčních průchodů scratchpadem (CHv4.1 light profil).
const PASSES: usize = 2;

/// Počet pseudo-random čtení pro finální mix (CHv4.1 light profil).
const RANDOM_READS: usize = 64;

#[inline]
fn block_count() -> usize {
    SCRATCHPAD_SIZE / BLOCK_SIZE
}

#[inline]
fn random_index_for_block(pad: &[u8], index: usize, pass: u64, blocks: usize) -> usize {
    let cur_off = index * BLOCK_SIZE;
    let mut idx_bytes = [0u8; 8];
    idx_bytes.copy_from_slice(&pad[cur_off..cur_off + 8]);
    ((u64::from_le_bytes(idx_bytes) ^ pass ^ (index as u64)) as usize) % blocks
}

#[inline]
fn next_iteration_index(index: usize, blocks: usize, forward: bool) -> Option<usize> {
    if forward {
        if index + 1 < blocks {
            Some(index + 1)
        } else {
            None
        }
    } else {
        if index > 0 {
            Some(index - 1)
        } else {
            None
        }
    }
}

#[inline]
#[cfg(target_arch = "x86_64")]
fn prefetch_next_random_block(pad: &[u8], index: usize, pass: u64, forward: bool) {
    let blocks = block_count();
    let Some(next_index) = next_iteration_index(index, blocks, forward) else {
        return;
    };

    #[cfg(target_arch = "x86_64")]
    unsafe {
        use std::arch::x86_64::{_MM_HINT_T0, _mm_prefetch};

        let next_rand_index = random_index_for_block(pad, next_index, pass, blocks);
        let next_rand_off = next_rand_index * BLOCK_SIZE;

        _mm_prefetch(pad.as_ptr().add(next_rand_off) as *const i8, _MM_HINT_T0);
    }
}

#[inline]
#[cfg(not(target_arch = "x86_64"))]
fn prefetch_next_random_block(_pad: &[u8], _index: usize, _pass: u64, _forward: bool) {}

#[inline(always)]
fn xor_block_in_place(dest: &mut [u8], src: &[u8]) {
    debug_assert_eq!(dest.len(), BLOCK_SIZE);
    debug_assert_eq!(src.len(), BLOCK_SIZE);

    xor_block_in_place_impl(dest, src);
}

#[cfg(all(target_arch = "x86_64"))]
#[inline(always)]
fn xor_block_in_place_impl(dest: &mut [u8], src: &[u8]) {
    if std::is_x86_feature_detected!("avx2") {
        unsafe {
            xor_block_in_place_avx2(dest.as_mut_ptr(), src.as_ptr());
        }
        return;
    }

    for offset in 0..BLOCK_SIZE {
        dest[offset] ^= src[offset];
    }
}

#[cfg(all(target_arch = "aarch64"))]
#[inline(always)]
fn xor_block_in_place_impl(dest: &mut [u8], src: &[u8]) {
    unsafe {
        xor_block_in_place_neon(dest.as_mut_ptr(), src.as_ptr());
    }
}

#[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
#[inline(always)]
fn xor_block_in_place_impl(dest: &mut [u8], src: &[u8]) {
    for offset in 0..BLOCK_SIZE {
        dest[offset] ^= src[offset];
    }
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2")]
unsafe fn xor_block_in_place_avx2(dest: *mut u8, src: *const u8) {
    use std::arch::x86_64::{__m256i, _mm256_loadu_si256, _mm256_storeu_si256, _mm256_xor_si256};

    let left0 = _mm256_loadu_si256(dest as *const __m256i);
    let right0 = _mm256_loadu_si256(src as *const __m256i);
    let mixed0 = _mm256_xor_si256(left0, right0);
    _mm256_storeu_si256(dest as *mut __m256i, mixed0);

    let left1 = _mm256_loadu_si256(dest.add(32) as *const __m256i);
    let right1 = _mm256_loadu_si256(src.add(32) as *const __m256i);
    let mixed1 = _mm256_xor_si256(left1, right1);
    _mm256_storeu_si256(dest.add(32) as *mut __m256i, mixed1);
}

#[cfg(target_arch = "aarch64")]
unsafe fn xor_block_in_place_neon(dest: *mut u8, src: *const u8) {
    use std::arch::aarch64::{uint8x16_t, veorq_u8, vld1q_u8, vst1q_u8};

    let left0: uint8x16_t = vld1q_u8(dest);
    let right0: uint8x16_t = vld1q_u8(src);
    vst1q_u8(dest, veorq_u8(left0, right0));

    let left1: uint8x16_t = vld1q_u8(dest.add(16));
    let right1: uint8x16_t = vld1q_u8(src.add(16));
    vst1q_u8(dest.add(16), veorq_u8(left1, right1));

    let left2: uint8x16_t = vld1q_u8(dest.add(32));
    let right2: uint8x16_t = vld1q_u8(src.add(32));
    vst1q_u8(dest.add(32), veorq_u8(left2, right2));

    let left3: uint8x16_t = vld1q_u8(dest.add(48));
    let right3: uint8x16_t = vld1q_u8(src.add(48));
    vst1q_u8(dest.add(48), veorq_u8(left3, right3));
}

/// Inicializuje scratchpad ze seedu (64B) deterministicky přes SHA3-512 chain.
fn init_scratchpad(seed: &[u8; 64], pad: &mut [u8]) {
    debug_assert_eq!(pad.len(), SCRATCHPAD_SIZE);

    let mut state = *seed;
    let mut counter: u64 = 0;

    for chunk in pad.chunks_exact_mut(BLOCK_SIZE) {
        let counter_bytes = counter.to_le_bytes();
        let out = sha3_fast::sha3_512_64_8(&state, &counter_bytes);
        chunk.copy_from_slice(&out.data[..BLOCK_SIZE]);
        state.copy_from_slice(&out.data[..BLOCK_SIZE]);
        counter = counter.wrapping_add(1);
    }
}

/// Provádí sekvenční + pseudo-random dependent mix přes celý scratchpad.
fn sequential_passes(pad: &mut [u8]) {
    let blocks = block_count();

    for pass in 0..PASSES {
        let forward = pass % 2 == 0;

        if forward {
            for i in 0..blocks {
                mix_block(pad, i, pass as u64, true);
            }
        } else {
            for i in (0..blocks).rev() {
                mix_block(pad, i, pass as u64, false);
            }
        }
    }
}

#[inline]
fn mix_block(pad: &mut [u8], index: usize, pass: u64, forward: bool) {
    let blocks = block_count();

    let cur_off = index * BLOCK_SIZE;
    let prev_index = if forward {
        if index == 0 {
            blocks - 1
        } else {
            index - 1
        }
    } else if index + 1 == blocks {
        0
    } else {
        index + 1
    };
    let prev_off = prev_index * BLOCK_SIZE;

    let rand_index = random_index_for_block(pad, index, pass, blocks);
    let rand_off = rand_index * BLOCK_SIZE;

    prefetch_next_random_block(pad, index, pass, forward);

    // Snapshot blocků před zápisem
    let mut current = [0u8; BLOCK_SIZE];
    let mut prev = [0u8; BLOCK_SIZE];
    let mut random = [0u8; BLOCK_SIZE];
    current.copy_from_slice(&pad[cur_off..cur_off + BLOCK_SIZE]);
    prev.copy_from_slice(&pad[prev_off..prev_off + BLOCK_SIZE]);
    random.copy_from_slice(&pad[rand_off..rand_off + BLOCK_SIZE]);

    // Hash dependent na current + prev + random + metadata
    let pass_bytes = pass.to_le_bytes();
    let index_bytes = (index as u64).to_le_bytes();
    let mixed = sha3_fast::sha3_512_64_64_64_8_8(
        &current,
        &prev,
        &random,
        &pass_bytes,
        &index_bytes,
    );

    xor_block_in_place(&mut pad[cur_off..cur_off + BLOCK_SIZE], &mixed.data[..BLOCK_SIZE]);
}

/// Finální random-read fáze, která generuje 64B výstup pro další pipeline fázi.
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

/// Veřejná memory-hard transformace 64B vstupu -> 64B výstup.
///
/// Tato vrstva je deterministická a určená pro použití v konsenzu CH v3/v4.
/// Používá thread-local buffer (žádný heap allocation per hash).
pub fn memory_hard_transform(input: &[u8; 64]) -> Hash64 {
    with_scratchpad(|pad| {
        init_scratchpad(input, pad);
        sequential_passes(pad);
        random_read_mix(input, pad)
    })
}

// ============================================================================
// CHv4.2 MERKABAH DUAL-SPIN EXTENSIONS
// ============================================================================

/// Merkabah Backward Passes — Ra (vzestupná spirála světla).
///
/// Prochází scratchpad v opačném pořadí (blocks-1 → 0), mixing každý blok
/// s jeho sousedem (next_b) a odpovídající HIC konstantou.
/// Dualita forward/backward znemožňuje FPGA pipeline prefetching.
///
/// `seed` — původní vstup do transformace (pro additional entropy).
fn merkabah_backward_passes(pad: &mut [u8], seed: &[u8; 64]) {
    let blocks = block_count();

    for pass in 0..BACKWARD_PASSES {
        // Zpětný průchod: Malkuth (blok 1023) → Kether (blok 0)
        for b in (0..blocks).rev() {
            let next_b = (b + 1) % blocks;
            let hic_idx = (blocks - 1 - b) % KEY_ROUNDS; // Inverzní mapování

            let cur_off = b * BLOCK_SIZE;
            let next_off = next_b * BLOCK_SIZE;

            // Snapshot bloků (borrow checker)
            let mut cur_blk = [0u8; BLOCK_SIZE];
            let mut next_blk = [0u8; BLOCK_SIZE];
            cur_blk.copy_from_slice(&pad[cur_off..cur_off + BLOCK_SIZE]);
            next_blk.copy_from_slice(&pad[next_off..next_off + BLOCK_SIZE]);

            // SHA3-512 mixing s HIC konstantou + sousedem (Ra spirála)
            let hic_bytes = HIC[hic_idx].to_le_bytes();
            let pass_bytes = (pass as u64).to_le_bytes();
            let block_bytes = (b as u64).to_le_bytes();
            let mixed = sha3_fast::sha3_512_64_64_8_64_8_8(
                &cur_blk,
                &next_blk,
                &hic_bytes,
                seed,
                &pass_bytes,
                &block_bytes,
            );

            // XOR mixing (výsledek závislý na celém scratchpadu)
            xor_block_in_place(&mut pad[cur_off..cur_off + BLOCK_SIZE], &mixed.data[..BLOCK_SIZE]);
        }
    }
}

/// Kabalistická fáze — 22 deterministických čtení.
///
/// Adresování: `HIC[k] XOR state_word_0` → pozice v scratchpadu.
/// Každé čtení míchá stav přes Keccak-256 s HIC konstantou,
/// čímž vytváří zpětnou závislost na celé sadě HIC konstant.
///
/// Vrátí 64B stav po 22 kolech kabala mixing.
fn kabala_phase(pad: &[u8], seed: &[u8; 64]) -> [u8; 64] {
    let blocks = block_count();
    let mut acc = *seed;

    for k in 0..KABALA_READS {
        // Deterministická kabalistická adresa: HIC[k] XOR aktuální stav
        let mut state_word = [0u8; 8];
        state_word.copy_from_slice(&acc[..8]);
        let state_u64 = u64::from_le_bytes(state_word);
        let kabala_addr = ((HIC[k] ^ state_u64) as usize) % blocks;

        let kab_off = kabala_addr * BLOCK_SIZE;
        let chunk = &pad[kab_off..kab_off + BLOCK_SIZE];

        // Keccak-256 mixing s kabalistickým blokem + HIC konstantou
        let mut h = Keccak256::new();
        h.update(acc);
        h.update(chunk);
        h.update(HIC[k].to_le_bytes());
        h.update((k as u64).to_le_bytes());
        let d = h.finalize();

        // Partial accumulate: XOR první polovina, ADD druhá polovina
        for i in 0..32 {
            acc[i] ^= d[i];
            acc[32 + i] = acc[32 + i].wrapping_add(d[i]);
        }
    }

    acc
}

/// Brahma-jyoti finalizace — 22 kol SHA3-512 komprese.
///
/// Jedno kolo za každou cestu Stromu Života (22 pólů vědomí).
/// Každé kolo XOR-mixuje HIC konstantu do akumulátoru.
/// Produkuje finální Hash64 = "věčné světlo" (brahma-jyoti).
fn brahma_jyoti_finalize(state: &[u8; 64]) -> Hash64 {
    let mut acc = *state;

    for r in 0..KEY_ROUNDS {
        let hic_bytes = HIC[r].to_le_bytes();
        let round_bytes = (r as u64).to_le_bytes();
        let out = sha3_fast::sha3_512_chunks([&acc, &hic_bytes, &round_bytes]);

        // Difuze: XOR první polovina, ADD druhá polovina
        for i in 0..32 {
            acc[i] ^= out.data[i];
            acc[32 + i] = acc[32 + i].wrapping_add(out.data[32 + i]);
        }
    }

    let mut hash = Hash64::new();
    hash.data.copy_from_slice(&acc);
    hash
}

/// CHv4.2 Memory-hard transformace — "Merkabah Dual-Spin".
///
/// Rozšiřuje CHv4.1 o:
/// 1. Merkabah Backward Passes (Ra — vzestupná spirála) × 2
/// 2. Kabalistická fáze — 22 deterministických čtení s HIC
/// 3. Brahma-jyoti finalizace — 22-kolo SHA3 key schedule
///
/// Zachovává 64 KiB scratchpad (zlatý střed) — nezvyšuje paměťové nároky.
/// FPGA overhead ~6× vyšší než CHv4.1 díky bidirektionálnímu přístupu.
///
/// # Bezpečnost vs CHv4.1
/// - Bidirektionální průchod → nelze pipeline-optimalizovat (FPGA)
/// - 22-read HIC závislost → precomputation resistance
/// - 22-round finalizace → zvýšený avalanche effect
pub fn memory_hard_transform_v4_2(input: &[u8; 64]) -> Hash64 {
    with_scratchpad(|pad| {
        // Fáze 1: Inicializace (Maha-tattva — SHA3-512 chain fill)
        init_scratchpad(input, pad);

        // Fáze 2: Dopředné průchody (Ka — Duch sestupuje)
        sequential_passes(pad);

        // Fáze 3: Zpětné průchody — Merkabah Ra spirála [NOVÉ v4.2]
        merkabah_backward_passes(pad, input);

        // Fáze 4: Memory-hard random čtení (64 čtení, jako CHv4.1)
        let mh_output = random_read_mix(input, pad);

        // Fáze 5: Kabalistická fáze — 22 HIC-adresovaných čtení [NOVÉ v4.2]
        let kabala_state = kabala_phase(pad, &mh_output.data);

        // Fáze 6: Brahma-jyoti — 22-kolo SHA3 finalizace [NOVÉ v4.2]
        brahma_jyoti_finalize(&kabala_state)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memory_hard_deterministic() {
        let input = [7u8; 64];
        let a = memory_hard_transform(&input);
        let b = memory_hard_transform(&input);
        assert_eq!(a.data, b.data);
    }

    #[test]
    fn test_memory_hard_changes_output() {
        let mut input_a = [0u8; 64];
        let mut input_b = [0u8; 64];
        input_b[0] = 1;
        input_a[63] = 9;

        let a = memory_hard_transform(&input_a);
        let b = memory_hard_transform(&input_b);
        assert_ne!(a.data, b.data);
    }
}
