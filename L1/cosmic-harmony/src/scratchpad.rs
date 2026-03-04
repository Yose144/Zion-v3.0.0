//! Memory-hard scratchpad layer for Cosmic Harmony v3/v4.
//!
//! Cíl: zvýšit ASIC resistance přidáním výrazné paměťové práce mezi
//! Golden Matrix a Cosmic Fusion fází.
//!
//! Performance: používáme thread-local scratchpad buffer — vyhýbáme se
//! 512 KiB heap allocation per hash, což dává ~20-35% zrychlení při
//! paralelním mining (rayon), kde každé vlákno reusuje svůj buffer.

use sha3::{Digest, Keccak256, Sha3_512};
use std::cell::RefCell;

use crate::algorithms_opt::Hash64;

// Thread-local 512 KiB scratchpad — každé vlákno má vlastní buffer,
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

/// Scratchpad velikost v bajtech (512 KiB).
///
/// 512 KiB přesahuje L1/L2 cache reálných ASIC čipů a většiny FPGA —
/// útočník musí použít pomalou DRAM nebo eDRAM, čímž ztrácí výhodu paralelismu.
/// Oproti 2 MiB variantě zachovává ASIC odolnost při praktickém hashratu ~50–100 H/s.
/// (Benchmark: 256 KiB → ~300–600 H/s, 512 KiB → ~50–100 H/s, 2 MiB → ~1 H/s)
pub const SCRATCHPAD_SIZE: usize = 512 * 1024;

/// Velikost jednoho bloku scratchpadu.
const BLOCK_SIZE: usize = 64;

/// Počet sekvenčních průchodů scratchpadem.
/// 4 průchody × 512 KiB = 2 MiB sekvenčního čtení/zápisu per hash.
const PASSES: usize = 4;

/// Počet pseudo-random čtení pro finální mix.
/// 256 reads při 8192 blocích = 3.1% pokrytí per hash — dostatečné pro data-dependency.
const RANDOM_READS: usize = 256;

#[inline]
fn block_count() -> usize {
    SCRATCHPAD_SIZE / BLOCK_SIZE
}

/// Inicializuje scratchpad ze seedu (64B) deterministicky přes SHA3-512 chain.
fn init_scratchpad(seed: &[u8; 64], pad: &mut [u8]) {
    debug_assert_eq!(pad.len(), SCRATCHPAD_SIZE);

    let mut state = *seed;
    let mut counter: u64 = 0;

    for chunk in pad.chunks_exact_mut(BLOCK_SIZE) {
        let mut h = Sha3_512::new();
        h.update(state);
        h.update(counter.to_le_bytes());
        let out = h.finalize();
        chunk.copy_from_slice(&out[..BLOCK_SIZE]);
        state.copy_from_slice(&out[..BLOCK_SIZE]);
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

    let mut idx_bytes = [0u8; 8];
    idx_bytes.copy_from_slice(&pad[cur_off..cur_off + 8]);
    let mut rand_index = (u64::from_le_bytes(idx_bytes) ^ pass ^ (index as u64)) as usize;
    rand_index %= blocks;
    let rand_off = rand_index * BLOCK_SIZE;

    // Snapshot blocků před zápisem
    let mut current = [0u8; BLOCK_SIZE];
    let mut prev = [0u8; BLOCK_SIZE];
    let mut random = [0u8; BLOCK_SIZE];
    current.copy_from_slice(&pad[cur_off..cur_off + BLOCK_SIZE]);
    prev.copy_from_slice(&pad[prev_off..prev_off + BLOCK_SIZE]);
    random.copy_from_slice(&pad[rand_off..rand_off + BLOCK_SIZE]);

    // Hash dependent na current + prev + random + metadata
    let mut h = Sha3_512::new();
    h.update(current);
    h.update(prev);
    h.update(random);
    h.update(pass.to_le_bytes());
    h.update((index as u64).to_le_bytes());
    let mixed = h.finalize();

    for j in 0..BLOCK_SIZE {
        pad[cur_off + j] ^= mixed[j];
    }
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

    let mut final_h = Sha3_512::new();
    final_h.update(acc);
    final_h.update(&pad[..BLOCK_SIZE]);
    final_h.update(&pad[SCRATCHPAD_SIZE - BLOCK_SIZE..]);
    let out = final_h.finalize();

    let mut hash = Hash64::new();
    hash.data.copy_from_slice(&out[..64]);
    hash
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
