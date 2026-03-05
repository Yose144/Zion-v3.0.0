# CHvDeeksha — Technická architektura (v2.9.8)

> Canonical name: `cosmic_harmony` (Deeksha profil)  
> Crate: `zion-cosmic-harmony-v3` (název crate zůstane pro zpětnou kompatibilitu)  
> Datum: 2026-03-06  
> Status: ARCH FREEZE — podléhá code review

---

## 0) TL;DR pro urgentní čtení

| Otázka | Odpověď |
|--------|---------|
| Kolik aktivních pipeline větví? | **1** — `cosmic_harmony_deeksha()` |
| Scratchpad? | **64 KiB, 2 průchody, 64 random reads** — golden middle, beze změny |
| Merkabah (backward passes + kabala)? | **Feature-gated**, mimo default chain |
| NPU? | **Akcelerace**, stejný výstup jako CPU (bitová shoda) |
| Fork height konstanta? | **`CHV_DEEKSHA_FORK_HEIGHT`** — jedno místo |
| Revenue? | CHv3 revenue model zachován beze změny (Rule D) |
| Nová veřejná API funkce? | `cosmic_harmony_deeksha(header, nonce) -> Hash32` |
| Zpětná kompatibilita dispatche? | `cosmic_harmony_with_height()` přesměruje ≥ DEEKSHA_FORK_HEIGHT na Deeksha |

---

## 1) Modul mapa (co existuje a co se mění)

```
L1/cosmic-harmony/src/
├── algorithms_opt.rs     ← ZMĚNA: přidat cosmic_harmony_deeksha(), aktualizovat dispatch
├── algorithms_npu.rs     ← ZMĚNA: přidat NpuBackend trait + CircuitBreaker wrapper
├── scratchpad.rs         ← BEZ ZMĚNY (64KiB golden middle je správně)
├── hic.rs                ← BEZ ZMĚNY (HIC konstanty zachovány pro feature-gated Merkabah)
├── engine.rs             ← MOŽNÁ ZMĚNA: fork height reference
├── lib.rs                ← BEZ ZMĚNY (jen re-export)
├── ffi.rs                ← ZMĚNA: přidat FFI export pro deeksha
├── config.rs             ← ZMĚNA: CHV_DEEKSHA_FORK_HEIGHT
└── [nový] deeksha.rs     ← NOVÝ SOUBOR: canonical Deeksha dispatch modul
```

### Co se NEtýká Deeksha baseline (zachovat pro kompatibilitu, neaktivovat v default chain):
- `cosmic_harmony_v3_legacy()` → legacy tests only
- `cosmic_harmony_v3()` → legacy tests only
- `cosmic_harmony_v4()` → legacy tests only
- `cosmic_harmony_v4_2()` → přejmenovat na `cosmic_harmony_merkabah()` + `#[cfg(feature = "merkabah")]`
- `memory_hard_transform_v4_2()` v scratchpad.rs → `#[cfg(feature = "merkabah")]`

---

## 2) Pipeline — Deeksha canonical path

```
Input: block_header (≤80 bytes) + nonce (u64 LE)
       ┌─────────────────────────────────────────┐
       │  Vstup: header[0..80] || nonce[0..8]    │
       └──────────────────┬──────────────────────┘
                          │
              ┌───────────▼────────────┐
              │   Step 1: Keccak-256   │  32 bytes
              │   keccak256_opt()      │
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │   Step 2: SHA3-512     │  64 bytes
              │   sha3_512_opt()       │
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │   Step 3: Golden       │  64 bytes
              │   Matrix               │
              │   golden_matrix_opt()  │
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │   Step 4: MemoryHard   │  64 bytes
              │   64 KiB scratchpad    │
              │   2 passes / 64 reads  │
              │   memory_hard_transform│
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │   Step 5: NpuMix       │  64 bytes
              │   INT8 MLP 64→128→64   │
              │   + residual conn.     │
              │   NpuBackend trait     │  ← CPU nebo NPU, identický výstup
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │   Step 6: CosmicFusion │  32 bytes
              │   Keccak + AES-NI XOR  │
              │   4 kola fusion rounds │
              │   cosmic_fusion_opt()  │
              └───────────┬────────────┘
                          │
                    Hash32 výstup
```

### Konsenzusní parametry (single source of truth → `deeksha.rs`):

```rust
pub const DEEKSHA_SCRATCHPAD_KB:  usize = 64;
pub const DEEKSHA_PASSES:         usize = 2;
pub const DEEKSHA_RANDOM_READS:   usize = 64;
pub const DEEKSHA_MLP_INPUT_DIM:  usize = 64;
pub const DEEKSHA_MLP_HIDDEN_DIM: usize = 128;
pub const DEEKSHA_MLP_OUTPUT_DIM: usize = 64;
pub const DEEKSHA_FUSION_ROUNDS:  usize = 4;
```

Poznámka: `BACKWARD_PASSES = 0`, `KABALA_READS = 0` v Deeksha baseline.  
Všechny CHv4.2 Merkabah konstanty zůstávají v `hic.rs` pro `#[cfg(feature = "merkabah")]`.

---

## 3) NpuBackend trait — design

### 3.1 Trait interface (`algorithms_npu.rs`)

```rust
/// Veřejný trait pro NPU backend. Implementují jej:
///   - CpuNpuBackend (vždy dostupný, reference truth)
///   - OnnxNpuBackend (Apple ANE / CoreML, feature = "native-npu")
///   - SimdNpuBackend (AVX2/NEON INT8, feature = "simd-npu")
pub trait NpuBackend: Send + Sync {
    /// Deterministický mix 64-bytového vstupu → 64-bytový výstup.
    /// MUSÍ být bitově identický s CpuNpuBackend pro stejný vstup.
    fn mix(&self, input: &[u8; 64]) -> [u8; 64];

    /// Jméno backendu pro telemetru a diagnostiku.
    fn name(&self) -> &'static str;

    /// Self-test: ověř výstup na referenčním vektoru.
    /// Vrátí Ok(()) pokud shoda, Err(mismatch) jinak.
    fn self_test(&self) -> Result<(), NpuSelfTestError>;
}
```

### 3.2 CircuitBreaker wrapper

```
NpuBackend (OnnxNpuBackend/SimdNpuBackend)
     │
     ▼
CircuitBreaker
  ├── stav: Closed | Open(since) | HalfOpen
  ├── error_count: AtomicU32
  ├── threshold: 3 chyby → Open
  ├── cooldown: 30s → HalfOpen
  └── při Open: fallback na CpuNpuBackend
     │
     ▼
Deeksha pipeline (Step 5)
```

```rust
pub struct DeekshaCircuitBreaker {
    primary: Box<dyn NpuBackend>,
    fallback: CpuNpuBackend,
    state: AtomicU8,          // 0=Closed 1=Open 2=HalfOpen
    error_count: AtomicU32,
    opened_at: AtomicU64,     // unix timestamp ms
    miss_counter: AtomicU64,  // telemetry: kolik hashů šlo přes fallback
}

impl NpuBackend for DeekshaCircuitBreaker {
    fn mix(&self, input: &[u8; 64]) -> [u8; 64] {
        match self.state() {
            State::Closed | State::HalfOpen => {
                match self.primary.mix(input) { // panics caught via std::panic::catch_unwind
                    Ok(out) => { self.record_success(); out }
                    Err(_) => { self.record_failure(); self.fallback.mix(input) }
                }
            }
            State::Open => {
                self.miss_counter.fetch_add(1, Ordering::Relaxed);
                self.fallback.mix(input)
            }
        }
    }
}
```

### 3.3 Inicializace (singleton, lazy_static / OnceLock)

```rust
// V deeksha.rs:
static NPU_BACKEND: OnceLock<DeekshaCircuitBreaker> = OnceLock::new();

pub fn init_npu_backend() {
    let backend = NPU_BACKEND.get_or_init(|| {
        // 1) Try ONNX (feature = "native-npu")
        // 2) Try SIMD INT8 (feature = "simd-npu")
        // 3) Fallback: CPU INT8 (vždy dostupný)
        let primary = build_best_available_backend();
        
        // Self-test: pokud selže → log + fallback
        if let Err(e) = primary.self_test() {
            tracing::warn!("NPU self-test failed ({}): {e:?}, using CPU fallback", primary.name());
            return DeekshaCircuitBreaker::cpu_only();
        }
        
        DeekshaCircuitBreaker::new(primary, CpuNpuBackend::new())
    });
}
```

---

## 4) Fork dispatch policy

### 4.1 Konstanta — jeden soubor, jedno místo

V novém `deeksha.rs`:

```rust
/// Fork výška pro aktivaci Cosmic Harmony Deeksha (v2.9.8).
///
/// Pro mainnet: nastavit na konkrétní blok po upgrade governance vote.
/// Pro testnet: 0 (aktivní od genesis).
///
/// NIKDY NESMĚROVAT AUB PRAVIDEL JINDE. Toto je single source of truth.
pub const CHV_DEEKSHA_FORK_HEIGHT: u64 = 0; // TODO: mainnet = konkrétní číslo bloku
```

### 4.2 Dispatch funkce (upgrade `algorithms_opt.rs`)

```rust
/// Hlavní dispatch funkce pro konsenzus hashovku.
///
/// Dispatch tabulka (od nejnovějšího k nejstaršímu):
///   height ≥ CHV_DEEKSHA_FORK_HEIGHT  → cosmic_harmony_deeksha()   [v2.9.8]
///   height ≥ CHV4_2_FORK_HEIGHT        → cosmic_harmony_v4_2()      [legacy, arch. only]
///   jinak                              → cosmic_harmony_v4()         [legacy, arch. only]
///
/// Pro mainnet 2.9.8: CHV_DEEKSHA_FORK_HEIGHT = CHV4_2_FORK_HEIGHT = 0
/// → efektivně vždy Deeksha, všechny legacy větve csak v testech.
pub fn cosmic_harmony_with_height(header: &[u8], nonce: u64, height: u64) -> Hash32 {
    use crate::deeksha::CHV_DEEKSHA_FORK_HEIGHT;
    if height >= CHV_DEEKSHA_FORK_HEIGHT {
        return crate::deeksha::cosmic_harmony_deeksha(header, nonce);
    }
    // Legacy paths — nikdy nedosaženy při CHV_DEEKSHA_FORK_HEIGHT=0
    // Zachovány pro unit testy specifických verzí.
    if height >= CHV4_2_FORK_HEIGHT {
        return cosmic_harmony_v4_2(header, nonce);
    }
    cosmic_harmony_v4(header, nonce)
}
```

---

## 5) Nový soubor `deeksha.rs` — kostra

```rust
//! Cosmic Harmony Deeksha — canonical consensus hash (v2.9.8)
//!
//! Jeden soubor, jeden algoritmus, jedna aktivační konstanta.
//! Inspirace: Ekam / Oneness — sjednocení místo fragmentace.
//!
//! Rule A: One Canonical Path
//! Rule B: Stability Before Complexity (Merkabah = feature-gated)
//! Rule C: Deterministic Unity (NPU == CPU výstup)
//! Rule D: Revenue Dharma Continuity
//! Rule E: Operational Compassion (graceful degradation)

use std::sync::OnceLock;
use crate::algorithms_opt::{keccak256_opt, sha3_512_opt, golden_matrix_opt, cosmic_fusion_opt};
use crate::algorithms_npu::{NpuBackend, DeekshaCircuitBreaker};
use crate::scratchpad::memory_hard_transform;

// ============================================================================
// FORK HEIGHT — SINGLE SOURCE OF TRUTH
// ============================================================================

/// Fork výška pro aktivaci CHvDeeksha.
/// Mainnet: bude upřesněna governance vote před merge do main.
pub const CHV_DEEKSHA_FORK_HEIGHT: u64 = 0;

// ============================================================================
// CONSENSUS PARAMETERS
// ============================================================================

/// Scratchpad velikost (64 KiB — golden middle, ASIC resistant, CPU-friendly).
pub const DEEKSHA_SCRATCHPAD_SIZE: usize = 64 * 1024;
/// Počet průchodů scratchpadem (forward + backward alternace).
pub const DEEKSHA_PASSES: usize = 2;
/// Počet pseudo-random dependent čtení pro final mix.
pub const DEEKSHA_RANDOM_READS: usize = 64;
/// NPU MLP vstupní dimenze.
pub const DEEKSHA_MLP_DIM_IN: usize = 64;
/// NPU MLP hidden dimenze.
pub const DEEKSHA_MLP_DIM_HIDDEN: usize = 128;
/// NPU MLP výstupní dimenze.
pub const DEEKSHA_MLP_DIM_OUT: usize = 64;

// ============================================================================
// NPU BACKEND SINGLETON
// ============================================================================

static DEEKSHA_NPU: OnceLock<DeekshaCircuitBreaker> = OnceLock::new();

/// Inicializuj NPU backend. Volat jednou při startu mineru.
/// Bezpečné opakované volání (OnceLock).
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
/// Pipeline:
///   Keccak256 → SHA3-512 → GoldenMatrix → MemoryHard(64KiB) → NpuMix → CosmicFusion
///
/// Thread-safe: thread-local scratchpad v memory_hard_transform, NPU je Sync.
#[inline]
pub fn cosmic_harmony_deeksha(block_header: &[u8], nonce: u64) -> crate::algorithms_opt::Hash32 {
    // Vstupní buffer: header (≤80B) + nonce (8B LE)
    let mut input = [0u8; 88];
    let len = block_header.len().min(80);
    input[..len].copy_from_slice(&block_header[..len]);
    input[80..88].copy_from_slice(&nonce.to_le_bytes());

    // Step 1: Keccak-256
    let s1 = keccak256_opt(&input);

    // Step 2: SHA3-512
    let s2 = sha3_512_opt(&s1.data);

    // Step 3: Golden Matrix (φ-based transform)
    let s3 = golden_matrix_opt(&s2.data);

    // Step 4: Memory-Hard scratchpad (64 KiB, 2 passes, 64 random reads)
    let s4 = memory_hard_transform(&s3.data);

    // Step 5: NPU Deterministic Mix (INT8 MLP 64→128→64 + residual)
    // CPU fallback je bitově identický — konsenzus je na výstupu, ne backendu.
    let s5_bytes: [u8; 64] = npu().mix(&s4.data);
    let mut s5 = crate::algorithms_opt::Hash64::new();
    s5.data.copy_from_slice(&s5_bytes);

    // Step 6: Cosmic Fusion (Keccak + AES-NI, 4 rounds)
    cosmic_fusion_opt(&s5.data)
}

// ============================================================================
// PARALLEL MINING HELPERS
// ============================================================================

/// Batch hashovka pro mining (rayon parallel).
pub fn deeksha_find_nonce_parallel(
    header: &[u8],
    start_nonce: u64,
    count: u64,
    target: &[u8; 32],
) -> Option<(u64, crate::algorithms_opt::Hash32)> {
    use rayon::prelude::*;
    (0..count)
        .into_par_iter()
        .find_map_any(|i| {
            let nonce = start_nonce.wrapping_add(i);
            let hash = cosmic_harmony_deeksha(header, nonce);
            if meets_target(&hash.data, target) {
                Some((nonce, hash))
            } else {
                None
            }
        })
}

#[inline]
fn meets_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash <= target
}

// ============================================================================
// SELF-TEST VECTORS (compile-time verified při unit testu)
// ============================================================================

/// Self-test vektor — ověř pipeline na genesis vektoru.
///
/// Vektor se generuje z canonical CPU run před merge — stane se pevnou
/// součástí protokolu. Jakákoliv změna v pipeline = jiný výstup = fail.
pub fn self_test_deeksha_pipeline() -> bool {
    // Placeholder: po code freeze nahradit skutečnými hex hodnotami.
    // Generování: cargo test -- deeksha_generate_test_vectors --nocapture
    const TEST_HEADER: &[u8] = b"ZION_DEEKSHA_GENESIS_V298_TEST_VEC_HEADER";
    const TEST_NONCE: u64 = 0x2980_0001_0000_0000;
    // TODO: const EXPECTED_HASH: &str = "..."; (fill after first canonical run)
    let _ = cosmic_harmony_deeksha(TEST_HEADER, TEST_NONCE);
    // Po freeze: assert_eq!(hex::encode(hash.data), EXPECTED_HASH);
    true // zatím vždy true — nahradit po code freeze
}
```

---

## 6) FFI export (`ffi.rs`) — přidat Deeksha entry point

```c
// C-compatible FFI pro Python/Node.js/desktop-agent

// Nová funkce:
uint32_t zion_deeksha_hash(
    const uint8_t* header,   // block header bytes
    size_t         header_len,
    uint64_t       nonce,
    uint8_t*       out_hash  // caller-allocated 32 bytes
);
```

Rust implementace:

```rust
/// FFI: Deeksha canonical hash.
/// Bezpečný pro volání z C/Python/Node.js.
#[no_mangle]
pub extern "C" fn zion_deeksha_hash(
    header: *const u8,
    header_len: usize,
    nonce: u64,
    out_hash: *mut u8,
) -> u32 {
    if header.is_null() || out_hash.is_null() { return 1; }
    let header = unsafe { std::slice::from_raw_parts(header, header_len.min(80)) };
    let result = crate::deeksha::cosmic_harmony_deeksha(header, nonce);
    unsafe { std::ptr::copy_nonoverlapping(result.data.as_ptr(), out_hash, 32) };
    0 // success
}
```

---

## 7) Revenue integrace (Rule D — žádná změna)

Revenue model **není součástí consensus algoritmu** — je orchestrován nad ním.

```
desktop-agent (main.js)
   │
   ├── CHv4.2 fast-path → cosmic_harmony_deeksha() [nonce range: +0x00000000]
   ├── CPU revenue       → cosmic_harmony_deeksha() [nonce range: +0x40000000]
   └── GPU revenue       → cosmic_harmony_deeksha() [nonce range: +0x80000000]
                                    │
                              Pool scheduler
                              ├── zion stream       (ZION mining)
                              ├── revenue stream    (CH3 fee)
                              └── ncl stream        (AI tasks)
```

**Co se nemění:**
- `sessionNonceBaseRevenue`, `sessionNonceBaseGpuRevenue` — zachovány v main.js
- Pool stratum protokol — beze změny
- `cosmic_harmony_v42_fallback.py` — pouze hash funkci switout na FFI `zion_deeksha_hash` (v dalším PR)

---

## 8) Test strategie (parity discipline)

| Test | Popis | Cíl |
|------|-------|-----|
| `test_deeksha_cpu_npu_parity` | CPU fallback == NPU backend na 1000 náhodných vstupech | bitová shoda |
| `test_deeksha_determinism` | 2× volání se stejnými vstupy = stejný hash | deterministický |
| `test_deeksha_dispatch` | `with_height(N)` → Deeksha pro N ≥ DEEKSHA_FORK_HEIGHT | routing správný |
| `test_deeksha_circuit_breaker` | simulate NPU failure → fallback, hash stejný | graceful degradation |
| `test_deeksha_revenue_nonce_separation` | main/revenue/gpu-revenue nonce ranges nepřekrývají | žádná kolize |
| `test_deeksha_self_test_vector` | genesis test vektor přesně odpovídá | code freeze ověření |
| `test_deeksha_parallel_parity` | parallel find_nonce == sequential | rayon safe |

---

## 9) Implementační fáze (navazuje na MIGRATION_PLAN_2.9.8.md)

### Fáze A — Spec freeze (HOTOVO)
- ✅ Konzensusní parametry zmrazeny (64KiB/2/64)
- ✅ Concept bridge dokumentován (Deeksha/Ekam pilíře)
- ✅ Architektura (tento dokument)

### Fáze B — Nový `deeksha.rs` + NpuBackend trait (NEXT)
1. Vytvořit `L1/cosmic-harmony/src/deeksha.rs` (kostra výše)
2. Refaktorovat `algorithms_npu.rs`: přidat `NpuBackend` trait + `DeekshaCircuitBreaker`
3. Přidat `CHV_DEEKSHA_FORK_HEIGHT` do `config.rs` nebo přímo do `deeksha.rs`
4. Aktualizovat `algorithms_opt.rs`: `cosmic_harmony_with_height()` → Deeksha dispatch
5. Přidat FFI entry point `zion_deeksha_hash` v `ffi.rs`
6. Přidat do `lib.rs`: `pub mod deeksha;`

### Fáze C — Revenue hardening
1. Ověřit parity testy (CPU/NPU identický výstup)
2. Ověřit nonce partition separation (0x00 / 0x40 / 0x80)
3. Smoke test: start-mining na dev node, zkontrolovat revenue stream aktivaci

### Fáze D — Canary testnet
1. Deploy na testnet s `CHV_DEEKSHA_FORK_HEIGHT = current_height + 100`
2. Monitor: acceptance rate, hash rate, pool rejects
3. Go/No-go: < 0.1% rejectů, žádné divergence mezi CPU/NPU minery

### Fáze E — Mainnet release (v2.9.8.0)
1. `CHV_DEEKSHA_FORK_HEIGHT = governance_approved_height`
2. Release notes + docs cleanup (odstranit staré 512KiB reference)
3. Tag `v2.9.8.0`

---

## 10) Co se nemění z CHv4.2 (zachovat beze změny)

| Komponenta | Soubor | Důvod zachování |
|-----------|--------|----------------|
| `scratchpad.rs` | `scratchpad.rs` | Konstanty už jsou správné (64KiB) |
| HIC konstanty | `hic.rs` | Potřeba pro feature-gated Merkabah |
| `npu_mixing_hash64()` | `algorithms_npu.rs` | Pouze obalíme do NpuBackend trait |
| Revenue orchestrace | `main.js` | Rule D — beze změny |
| Stratum reconnect | `cosmic_harmony_v42_fallback.py` | Opraveno v 5d9a4a2 |
| Pool scheduler | `pool_manager.rs` | Nezávislé na algo verzi |

---

## 11) Open questions (před code freeze Fáze B)

1. **CHV_DEEKSHA_FORK_HEIGHT pro mainnet** — potřeba governance vote, zatím 0 (= alias na CHv4.2)
2. **ONNX backend timeline** — `features = ["native-npu"]` je připraveno v `algorithms_npu.rs`, reálný CoreML backend = Q3 2026
3. **Pool crash na CHv4.2** (user mention: "pool pada na 4.2") — separátní issue, vyšetřit v `L1/pool/src/stratum/server_v2.rs`
4. **Desktop-agent FFI** — přejít z volání Python skriptu na přímé `zion_deeksha_hash` přes native-lib (Fáze C/D)

---

*Dokument slouží jako základ pro implementaci. Implementace začíná Fází B.*
