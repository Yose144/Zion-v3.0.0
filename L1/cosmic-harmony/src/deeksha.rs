//! # Cosmic Harmony Deeksha — canonical consensus hash (v2.9.8)
//!
//! Jeden soubor, jeden algoritmus, jedna aktivační konstanta.
//!
//! Filosofické základy: Ekam / Oneness University — sjednocení místo fragmentace.
//!
//! ## Design rules (A–E)
//! - Rule A: One Canonical Path — žádné runtime větvení v konsenzu
//! - Rule B: Stability Before Complexity — Merkabah je feature-gated, ne default
//! - Rule C: Deterministic Unity — NPU == CPU výstup (bitová shoda)
//! - Rule D: Revenue Dharma Continuity — CHv3 revenue beze změny
//! - Rule E: Operational Compassion — graceful degradation při výpadku NPU
//!
//! ## Pipeline
//! ```text
//! header+nonce → Keccak256 → SHA3-512 → GoldenMatrix →
//!   MemoryHard(64KiB/2/64) → NpuMix(INT8 MLP) → CosmicFusion → Hash32
//! ```

use std::sync::OnceLock;

use crate::algorithms_npu::{DeekshaCircuitBreaker, NpuBackend};
use crate::algorithms_opt::{
    cosmic_fusion_opt, golden_matrix_opt, keccak256_opt, sha3_512_opt, Hash32,
};
use crate::scratchpad::memory_hard_transform;

// ============================================================================
// FORK HEIGHT — SINGLE SOURCE OF TRUTH
// ============================================================================

/// Fork výška pro aktivaci Cosmic Harmony Deeksha (v2.9.8).
///
/// Testnet / devnet: 0 (aktivní od genesis).
/// Mainnet: nastavit na governance-schválený blok před release taggem v2.9.8.0.
///
/// NIKDE JINDE — toto je jediné definitivní místo.
pub const CHV_DEEKSHA_FORK_HEIGHT: u64 = 0;

// ============================================================================
// CONSENSUS PARAMETERS (single source of truth)
// ============================================================================

/// Scratchpad velikost — 64 KiB, golden middle (ASIC resistant, CPU-friendly).
pub const DEEKSHA_SCRATCHPAD_SIZE: usize = 64 * 1024;

/// Počet průchodů scratchpadem (forward/backward alternace).
pub const DEEKSHA_PASSES: usize = 2;

/// Počet pseudo-random dependent čtení pro finální mix.
pub const DEEKSHA_RANDOM_READS: usize = 64;

/// NPU MLP vstupní dimenze.
pub const DEEKSHA_MLP_DIM_IN: usize = 64;

/// NPU MLP hidden dimenze.
pub const DEEKSHA_MLP_DIM_HIDDEN: usize = 128;

/// NPU MLP výstupní dimenze.
pub const DEEKSHA_MLP_DIM_OUT: usize = 64;

/// Počet CosmicFusion kol.
pub const DEEKSHA_FUSION_ROUNDS: usize = 4;

// ============================================================================
// CANONICAL TEST VECTOR (code-freeze, 2025-01-xx)
// ============================================================================

/// Kanonický test vektor — vygenerován `cargo test generate_test_vector_print -- --nocapture`.
/// header = b"ZION_DEEKSHA_GENESIS_V298_CANONICAL", nonce = 0x2980_0001_0000_0001
/// Jakákoli změna v pipeline MUSÍ přinést nový test vektor + migration note.
pub const DEEKSHA_CANONICAL_TEST_VECTOR_HEX: &str =
    "f72031a1f648050f05e6719fd6df895bbd319590277267857316ba6e6444f700";

// ============================================================================
// NPU BACKEND SINGLETON
// ============================================================================

static DEEKSHA_NPU: OnceLock<DeekshaCircuitBreaker> = OnceLock::new();

/// Inicializuj NPU backend. Bezpečné opakované volání (OnceLock).
/// Volat jednou při startu mineru (nebo poolového validátoru).
pub fn init_npu() {
    DEEKSHA_NPU.get_or_init(DeekshaCircuitBreaker::build_best_available);
}

#[inline]
fn npu() -> &'static DeekshaCircuitBreaker {
    DEEKSHA_NPU.get_or_init(DeekshaCircuitBreaker::build_best_available)
}

// ============================================================================
// CANONICAL PIPELINE
// ============================================================================

/// Cosmic Harmony Deeksha — canonical consensus hash.
///
/// Thread-safe:
/// - thread-local scratchpad buffer (v `memory_hard_transform`)
/// - NPU singleton je `Sync` přes `DeekshaCircuitBreaker`
///
/// # Arguments
/// * `block_header` — surový blokový hlavičkový buffer (≤ 80 B)
/// * `nonce` — těžební nonce (u64 little-endian)
///
/// # Returns
/// [`Hash32`] — 32 B výsledný hash
#[inline]
pub fn cosmic_harmony_deeksha(block_header: &[u8], nonce: u64) -> Hash32 {
    // Vstupní buffer: header (≤80 B) + nonce (8 B LE)
    let mut input = [0u8; 88];
    let len = block_header.len().min(80);
    input[..len].copy_from_slice(&block_header[..len]);
    input[80..88].copy_from_slice(&nonce.to_le_bytes());

    // Step 1: Keccak-256 (32 B)
    let s1 = keccak256_opt(&input);

    // Step 2: SHA3-512 (64 B) — expanze, Brahma moment
    let s2 = sha3_512_opt(&s1.data);

    // Step 3: Golden Matrix — φ-based transform, geometrický zákon
    let s3 = golden_matrix_opt(&s2.data);

    // Step 4: Memory-Hard scratchpad (64 KiB / 2 průchody / 64 random reads)
    // ASIC resistance — žádná zkratka přes fyzikální paměťový wall
    let s4 = memory_hard_transform(&s3.data);

    // Step 5: NPU Deterministic Mix (INT8 MLP 64→128→64 + residual)
    // CPU fallback je bitově identický — konsenzus závisí na výstupu, ne backendu.
    let s5_bytes: [u8; 64] = npu().mix(&s4.data);
    let mut s5 = crate::algorithms_opt::Hash64::new();
    s5.data.copy_from_slice(&s5_bytes);

    // Step 6: Cosmic Fusion (Keccak + AES-NI, 4 kola) → Hash32
    cosmic_fusion_opt(&s5.data)
}

// ============================================================================
// PARALLEL MINING HELPERS
// ============================================================================

/// Hledání nonce paralelně přes rayon.
///
/// Vrátí první `(nonce, hash)`, který splňuje `hash ≤ target`, nebo `None`.
#[cfg(feature = "parallel")]
pub fn deeksha_find_nonce_parallel(
    header: &[u8],
    start_nonce: u64,
    count: u64,
    target: &[u8; 32],
) -> Option<(u64, Hash32)> {
    use rayon::prelude::*;
    (0..count).into_par_iter().find_map_any(|i| {
        let nonce = start_nonce.wrapping_add(i);
        let hash = cosmic_harmony_deeksha(header, nonce);
        if meets_target(&hash.data, target) {
            Some((nonce, hash))
        } else {
            None
        }
    })
}

/// Sekvenční batch — vrátí první nonce splňující target, nebo `None`.
pub fn deeksha_find_nonce(
    header: &[u8],
    start_nonce: u64,
    count: u64,
    target: &[u8; 32],
) -> Option<(u64, Hash32)> {
    for i in 0..count {
        let nonce = start_nonce.wrapping_add(i);
        let hash = cosmic_harmony_deeksha(header, nonce);
        if meets_target(&hash.data, target) {
            return Some((nonce, hash));
        }
    }
    None
}

#[inline(always)]
fn meets_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash <= target
}

// ============================================================================
// SELF-TEST VECTORS
// ============================================================================

/// Self-test — ověří determinismus pipeline na pevném vektoru.
///
/// Vrátí `true` pokud pipeline produkuje konzistentní výstup (dvě volání = stejný hash).
/// Před mainnet release přidat konkrétní expected hash (viz `generate_test_vector()`).
pub fn self_test() -> bool {
    const TEST_HEADER: &[u8] = b"ZION_DEEKSHA_GENESIS_V298_CANONICAL";
    const TEST_NONCE: u64 = 0x2980_0001_0000_0001;

    let h1 = cosmic_harmony_deeksha(TEST_HEADER, TEST_NONCE);
    let h2 = cosmic_harmony_deeksha(TEST_HEADER, TEST_NONCE);

    // Determinismus
    if h1.data != h2.data {
        return false;
    }

    // Výstup nesmí být celý nulový
    if h1.data.iter().all(|&b| b == 0) {
        return false;
    }

    // Kanonický test vektor — code-freeze ověření
    let hex: String = h1.data.iter().map(|b| format!("{:02x}", b)).collect();
    if hex != DEEKSHA_CANONICAL_TEST_VECTOR_HEX {
        return false;
    }

    true
}

/// Generování testovacího vektoru pro code-freeze fixaci.
/// Výstup zkopírovat do `EXPECTED_CANONICAL_HASH` po prvním produkčním run.
///
/// ```text
/// cargo test -- deeksha::tests::generate_test_vector --nocapture
/// ```
pub fn generate_test_vector() -> String {
    const TEST_HEADER: &[u8] = b"ZION_DEEKSHA_GENESIS_V298_CANONICAL";
    const TEST_NONCE: u64 = 0x2980_0001_0000_0001;
    let h = cosmic_harmony_deeksha(TEST_HEADER, TEST_NONCE);
    h.data.iter().map(|b| format!("{:02x}", b)).collect()
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Vygeneruj a vytiskni kanonický testovací vektor pro fixaci.
    #[test]
    fn generate_test_vector_print() {
        let hex = generate_test_vector();
        println!("\n=== DEEKSHA CANONICAL TEST VECTOR ===");
        println!("header: ZION_DEEKSHA_GENESIS_V298_CANONICAL");
        println!("nonce:  0x2980_0001_0000_0001");
        println!("hash:   {}", hex);
        println!("=====================================\n");
    }

    #[test]
    fn test_deeksha_self_test() {
        assert!(self_test(), "Deeksha self-test failed");
    }

    #[test]
    fn test_deeksha_determinism() {
        let header = b"test block header for deeksha v298";
        let nonce = 0x1234_5678_9abc_def0u64;
        let h1 = cosmic_harmony_deeksha(header, nonce);
        let h2 = cosmic_harmony_deeksha(header, nonce);
        assert_eq!(h1.data, h2.data, "Deeksha musí být deterministická");
    }

    #[test]
    fn test_deeksha_avalanche() {
        // Změna 1 bitu nonce → výstup se musí lišit
        let header = b"avalanche test header for deeksha";
        let h1 = cosmic_harmony_deeksha(header, 1000);
        let h2 = cosmic_harmony_deeksha(header, 1001);
        assert_ne!(h1.data, h2.data, "Různé nonce musí dát různé hashe");
    }

    #[test]
    fn test_deeksha_header_sensitivity() {
        let h1 = cosmic_harmony_deeksha(b"header_A", 42);
        let h2 = cosmic_harmony_deeksha(b"header_B", 42);
        assert_ne!(h1.data, h2.data, "Různé headery musí dát různé hashe");
    }

    #[test]
    fn test_deeksha_output_nonzero() {
        let h = cosmic_harmony_deeksha(b"nonzero test", 0);
        assert!(
            h.data.iter().any(|&b| b != 0),
            "Deeksha výstup nesmí být celý nulový"
        );
    }

    #[test]
    fn test_deeksha_dispatch_height() {
        // Pro height >= CHV_DEEKSHA_FORK_HEIGHT musí dispatch volat Deeksha.
        // Ověříme nepřímo: výstup dispatch == přímé volání deeksha.
        use crate::algorithms_opt::cosmic_harmony_with_height;
        let header = b"dispatch height test";
        let nonce = 999u64;

        let direct = cosmic_harmony_deeksha(header, nonce);
        let dispatched = cosmic_harmony_with_height(header, nonce, CHV_DEEKSHA_FORK_HEIGHT);
        assert_eq!(
            direct.data, dispatched.data,
            "Dispatch na fork height musí vrátit Deeksha hash"
        );
    }

    #[test]
    fn test_deeksha_npu_parity() {
        // NPU backend (přes CircuitBreaker) musí dát stejný výsledek jako
        // přímé CPU volání npu_mixing_step().
        use crate::algorithms_npu::npu_mixing_step;

        let scratchpad_input = [0x7fu8; 64];
        let via_npu = npu().mix(&scratchpad_input);
        let cpu_direct = npu_mixing_step(&scratchpad_input);
        assert_eq!(
            via_npu, cpu_direct,
            "NPU backend musí být bitově identický s CPU path"
        );
    }

    #[test]
    fn test_deeksha_sequential_find_nonce() {
        // Najdi nonce se všemi bity target = 0xFF (splní každý hash)
        let header = b"find nonce test";
        let target = [0xffu8; 32];
        let result = deeksha_find_nonce(header, 0, 10, &target);
        assert!(result.is_some(), "Musí najít nonce když target = 0xFF...FF");
        let (found_nonce, hash) = result.unwrap();
        // Ověř, že nalezený hash odpovídá nonce
        let verify = cosmic_harmony_deeksha(header, found_nonce);
        assert_eq!(hash.data, verify.data, "Nalezený hash musí odpovídat nonce");
    }
}
