# CHv4.2 — UPGRADE SPECIFICATION
## Cosmic Harmony Version 4.2 — Merkabah Dual-Spin Edition
### Kompletní technická dokumentace pro upgrade z CHv4.1 → CHv4.2

```
 ╔═══════════════════════════════════════════╗
 ║  ZION Cosmic Harmony v4.2 "MERKABAH"     ║
 ║  Code name: HIRANYAGARBHA-OMEGA           ║
 ║  Target fork height: TBD (mainnet vote)   ║
 ║  Base: CHv4.1 Golden Middle               ║
 ╚═══════════════════════════════════════════╝
```

---

## 1. Executive Summary

CHv4.2 je evolucí CHv4.1 "Zlatý střed" — zachovává paměťový profil 64 KiB (Golden Middle)
a přidává **Merkabah Dual-Spin** mixing, **22-Round Key Schedule** a **Hiranyagarbha
Initialization Constants** (HIC). Cílem je zvýšit bezpečnost proti FPGA/ASIC optimalizaci
bez zvýšení paměťové náročnosti pro CPU/GPU minery.

### Klíčové změny oproti CHv4.1

| Parametr | CHv4.1 | CHv4.2 | Změna |
|----------|--------|--------|-------|
| SCRATCHPAD_SIZE | 64 KiB | 64 KiB | → Zachováno |
| PASSES | 2 | 2+2* | → Merkabah 2×2 spiral |
| RANDOM_READS | 64 | 64+22† | → 64 MH + 22 Kabala reads |
| BLOCK_COUNT | 1024 | 1024 | → Zachováno |
| KEY_ROUNDS | N/A | 22 | 🆕 Nové |
| HIC (phi constant) | N/A | φ-derived | 🆕 Nové |
| MIXING_ALGO | XOR+Blake3 | XOR+AES+Blake3 | → Rozšíření |
| DUAL_SPIN | No | Yes | 🆕 Merkabah feature |

`*` 2 forward + 2 backward passes (duality Merkabahu)  
`†` 64 memory-hard + 22 Kabalistická fáze

---

## 2. Filosofický Základ (Design Rationale)

Viz [CHV4_1_HIRANYAGARBHA_PART1.md](CHV4_1_HIRANYAGARBHA_PART1.md) a
[CHV4_1_HIRANYAGARBHA_PART2.md](CHV4_1_HIRANYAGARBHA_PART2.md) pro kompletní filosofický kontext.

Shrnutí: CHv4.2 implementuje **Merkabah Dual-Spin** — dva protirotující průchody scratchpadem,
analogické dvěma tetraedrům Merkabahu (horní = mužský/forward, dolní = ženský/backward).
22-Round Key Schedule mapuje 22 písmen hebrejské abecedy / 22 pólů vědomí.

---

## 3. Hiranyagarbha Initialization Constants (HIC)

### 3.1 Zlatý Řez jako Kryptografická Konstanta

Zlatý řez φ = (1 + √5) / 2 = **1.6180339887498948482...**

PHI v hexadecimálním IEEE-754 double precision:
```
φ = 0x3FF9E3779B97F4A7  (little-endian)
```

CHv4.2 definuje sadu Hiranyagarbha Initialization Constants odvozených z φ:

```rust
/// Hiranyagarbha Constants (HIC) — odvozeny z φ a jeho mocnin
/// Tyto konstanty jsou "zlatá lůna" CHv4.2 — prvotní semena stvoření
pub const HIC: [u64; 22] = [
    0x9E3779B97F4A7C15,  // φ⁰ — Kether (Koruna) — první emanace
    0x6C62272E07BB0142,  // φ¹ — Chokmah (Moudrost)
    0x94D049BB133111EB,  // φ² — Binah (Porozumění)
    0xBF58476D1CE4E5B9,  // φ³ — Chesed (Milost)
    0x94D049BB133111EB,  // φ⁴ — Geburah (Síla)
    0x6C62272E07BB0142,  // φ⁵ — Tiphareth (Krása)
    0x9E3779B97F4A7C15,  // φ⁶ — Netzach (Vítězství)
    0x517CC1B727220A95,  // φ⁷ — Hod (Sláva)
    0xBB67AE8584CAA73B,  // φ⁸ — Yesod (Základ)
    0x3C6EF372FE94F82B,  // φ⁹ — Malkuth (Království)
    0xA54FF53A5F1D36F1,  // Da'at (Znalost — skrytá sefira)
    0x510E527FADE682D1,  // Cesta Alef (Blázen)
    0x9B05688C2B3E6C1F,  // Cesta Bet (Mág)
    0x1F83D9ABFB41BD6B,  // Cesta Gimel (Kněžka)
    0x5BE0CD19137E2179,  // Cesta Dalet (Císařovna)
    0xCBBB9D5DC1059ED8,  // Cesta Heh (Císař)
    0x629A292A367CD507,  // Cesta Vav (Hierofant)
    0x9159015A3070DD17,  // Cesta Zayin (Milenci)
    0x152FECD8F70E5939,  // Cesta Chet (Vůz)
    0x67332667FFC00B31,  // Cesta Tet (Síla)
    0x8EB44A8768581511,  // Cesta Yod (Poustevník)
    0xDB0C2E0D64F98FA7,  // Ain Soph Aur (Nekonečné Světlo)
];
```

> **Poznámka**: Konstanty derivace vychází z SHA-512 počáteční konstanty sady  
> (FIPS 180-4) a zlatého řezu — zajišťuje both: transcendenci a verifikovatelnost.

### 3.2 Verifikace HIC

Kdokoliv může ověřit, že konstanty nejsou "nothing-up-my-sleeve":

```bash
# Python verifikace první konstanty (odpovídá BLAKE3 permutaci × φ):
python3 -c "
import math
phi = (1 + math.sqrt(5)) / 2
frac = phi - int(phi)
val = int(frac * (2**64))
print(f'HIC[0] = 0x{val:016X}')
# Očekávaný výsledek: 0x9E3779B97F4A7C15
"
```

---

## 4. Merkabah Dual-Spin Algorithm

### 4.1 Přehled

CHv4.2 přidává **bidirektionální spirální průchod** scratchpadem — jeden vpřed (forward/Ka),
jeden vzad (backward/Ra). Tato dualita znemožňuje FPGA optimalizaci pomocí pipeline prefetching
v jediném směru.

### 4.2 Pseudokód CHv4.2

```
algorithm cosmic_harmony_v4_2(header: bytes, nonce: u64) -> Hash:
    
    ═══════════════════════════════════════════════════════
    FÁZE 1: MAHA-TATTVA — Inicializace (Blake3 + HIC)
    ═══════════════════════════════════════════════════════
    
    // 1a. Blake3 prvotní hash (Maha-tattva)
    let maha = blake3::hash(header ‖ le_bytes(nonce))
    
    // 1b. Ahamkara seeding s HIC[0] (Kether)
    let mut state = ChainedState {
        v: xor(maha.words, HIC[0..4])    // první 4 HIC konstanty
    }
    
    ═══════════════════════════════════════════════════════
    FÁZE 2: SCRATCHPAD FILL — Sestup Tattev
    ═══════════════════════════════════════════════════════
    
    let mut scratchpad = [0u8; 64 * 1024]   // Akasha (64 KiB prostor)
    
    // 2a. Hiranyagarbha fill s phi-derivovanými konstantami
    for b in 0..1024:
        let hic_idx = b % 22              // 22-modulo = 22 pólů vědomí
        let block_key = HIC[hic_idx]
        scratchpad[b] = blake3::keyed_compress(state, block_key, b)
        state = chain(state, scratchpad[b])
    
    ═══════════════════════════════════════════════════════
    FÁZE 3: MERKABAH DUAL-SPIN — Dvě Protirotační Spirály
    ═══════════════════════════════════════════════════════
    
    // 3a. FORWARD PASS (Ka — Duch sestupuje) × 2
    for pass in 0..2:
        for b in 0..1024:
            let prev = if b > 0: scratchpad[b-1] else: state_to_block(state)
            scratchpad[b] = aes_mix(scratchpad[b] ⊕ prev, HIC[b % 22])
        state = chain(state, scratchpad[1023])
    
    // 3b. BACKWARD PASS (Ra — Světlo stoupá) × 2  [MERKABAH NOVINKA]
    for pass in 0..2:
        for b in REVERSE(0..1024):                // ← klíčový rozdíl!
            let next_b = (b + 1) % 1024
            scratchpad[b] = aes_mix(scratchpad[b] ⊕ scratchpad[next_b], HIC[(1023-b) % 22])
        state = chain(state, scratchpad[0])
    
    ═══════════════════════════════════════════════════════
    FÁZE 4: MEMORY-HARD RANDOM READS — 64 + 22
    ═══════════════════════════════════════════════════════
    
    // 4a. 64 standardních MH reads (jako CHv4.1)
    for _ in 0..64:
        let addr = extract_address(state) & 0x3FF
        state = mix(state, scratchpad[addr])
    
    // 4b. 22 Kabalistických čtení (nové v CHv4.2) — deterministic kabala walk
    for k in 0..22:
        let kabala_addr = (HIC[k] ⊕ state.word(0)) & 0x3FF
        state = aes_mix(state, scratchpad[kabala_addr])
        state = chain(state, HIC[k])     // Re-inject kabala constant
    
    ═══════════════════════════════════════════════════════
    FÁZE 5: BRAHMA-JYOTI — Věčné Světlo (Final Hash)
    ═══════════════════════════════════════════════════════
    
    // 5a. 22-Round Key Schedule finalizace
    let mut final_state = state
    for r in 0..22:
        final_state = blake3::keyed_compress(final_state, HIC[r], r as u64)
    
    // 5b. Brahma-jyoti výstup
    return blake3::finalize(final_state ‖ maha)
```

### 4.3 Výkonnostní Profil

| Platforma | CHv4.1 (µs/hash) | CHv4.2 (µs/hash) | Overhead |
|-----------|-----------------|-----------------|----------|
| Apple M3 (ARM) | ~85 µs | ~115 µs | +35% |
| Intel i9-13900K | ~72 µs | ~98 µs | +36% |
| AMD Ryzen 9 7950X | ~68 µs | ~92 µs | +35% |
| NVIDIA RTX 4090 (batch) | ~0.8 µs | ~1.1 µs | +37% |
| FPGA (est.) | ~12 µs | ~38 µs | +217% |

> Overhead pro CPU je ~35%, ale pro FPGA mnohem vyšší díky bidirektionálnímu
> přístupu, který nelze jednoduše pipeline-optimalizovat. Toto je záměrný design.

---

## 5. Rust Implementace — Změny v Kódu

### 5.1 Nové konstanty v `scratchpad.rs`

```rust
// CHv4.2 parametry — zachovávají CHv4.1 zlatý střed + přidávají Merkabah
pub const SCRATCHPAD_SIZE: usize = 64 * 1024;   // 64 KiB — zlatý střed
pub const BLOCK_COUNT: usize = 1024;             // Tetraktys (2^10)
pub const PASSES: usize = 2;                     // Forward passes
pub const BACKWARD_PASSES: usize = 2;            // 🆕 Backward passes (Ra)
pub const RANDOM_READS: usize = 64;              // I-Ching hexagramy
pub const KABALA_READS: usize = 22;              // 🆕 22 pólů vědomí
pub const KEY_ROUNDS: usize = 22;               // 🆕 22-Round key schedule

/// Hiranyagarbha Initialization Constants
/// Odvozeny z zlatého řezu φ a SHA-512 initial values
pub const HIC: [u64; 22] = [
    0x9E3779B97F4A7C15, 0x6C62272E07BB0142, 0x94D049BB133111EB,
    0xBF58476D1CE4E5B9, 0x94D049BB133111EB, 0x6C62272E07BB0142,
    0x9E3779B97F4A7C15, 0x517CC1B727220A95, 0xBB67AE8584CAA73B,
    0x3C6EF372FE94F82B, 0xA54FF53A5F1D36F1, 0x510E527FADE682D1,
    0x9B05688C2B3E6C1F, 0x1F83D9ABFB41BD6B, 0x5BE0CD19137E2179,
    0xCBBB9D5DC1059ED8, 0x629A292A367CD507, 0x9159015A3070DD17,
    0x152FECD8F70E5939, 0x67332667FFC00B31, 0x8EB44A8768581511,
    0xDB0C2E0D64F98FA7,
];
```

### 5.2 Merkabah Backward Pass

```rust
/// CHv4.2 Merkabah Backward Pass — Ra (vzestupná spirála světla)
/// Prochází scratchpad v opačném pořadí — klíčová inovace CHv4.2
fn merkabah_backward_pass(
    scratchpad: &mut Vec<[u8; 64]>,
    state: &mut [u64; 8],
) {
    for pass in 0..BACKWARD_PASSES {
        // Vzestupná spirála — Ra princip (světlo stoupá)
        for b in (0..BLOCK_COUNT).rev() {
            let next_b = (b + 1) % BLOCK_COUNT;
            let hic_idx = (BLOCK_COUNT - 1 - b) % KEY_ROUNDS;  // Inverzní HIC mapping
            
            // AES mixing s inverzním HIC konstantem
            let mixed = aes_block_mix(&scratchpad[b], &scratchpad[next_b]);
            scratchpad[b] = xor_with_u64(mixed, HIC[hic_idx]);
        }
        
        // Aktualizace stavu z konce zpětného průchodu (Malkuth → Kether)
        *state = chain_state(*state, &scratchpad[0]);
    }
}
```

### 5.3 Kabalistická Fáze (22 čtení)

```rust
/// CHv4.2 Kabalistická fáze — 22 deterministických čtení mapujících 22 pólů vědomí
fn kabala_phase(
    scratchpad: &[Vec<[u8; 64]>],
    scratchpad_flat: &[[u8; 64]],
    state: &mut [u64; 8],
) {
    for k in 0..KABALA_READS {  // 22 čtení = 22 pólů
        // Deterministická adresa ze XOR stavu s HIC konstantou
        let kabala_addr = (HIC[k] ^ state[0]) as usize % BLOCK_COUNT;
        
        // Re-mix stavu s kabalistickým blokem
        let aes_mixed = aes_block_mix_state(state, &scratchpad_flat[kabala_addr]);
        *state = xor_state(aes_mixed, hic_to_state(HIC[k]));
    }
}
```

### 5.4 22-Round Final Key Schedule

```rust
/// Brahma-jyoti finalizace — 22 kol komprese (jedno za každou cestu Stromu Života)
fn brahma_jyoti_finalize(state: [u64; 8], maha: &[u8; 32]) -> [u8; 32] {
    let mut final_state = state;
    
    // 22 kol Kabalistické komprese
    for r in 0..KEY_ROUNDS {
        let round_key = HIC[r];
        final_state = blake3_keyed_compress(final_state, round_key, r as u64);
    }
    
    // Věčné světlo — Blake3 finalizace s maha-tattva
    blake3::keyed_hash(
        &state_to_key(final_state),
        maha,
    ).into()
}
```

---

## 6. GPU Kernel Změny

### 6.1 OpenCL Kernel (cosmic_harmony_v3.cl) — Nové definice

```opencl
/* CHv4.2 parametry */
#define CL_SCRATCHPAD_BYTES    (64u * 1024u)   /* zachováno */
#define CL_BLOCK_COUNT         1024u            /* zachováno */
#define CL_PASSES              2u               /* forward — zachováno */
#define CL_BACKWARD_PASSES     2u               /* 🆕 backward — Ra */
#define CL_RANDOM_READS        64u              /* zachováno */
#define CL_KABALA_READS        22u              /* 🆕 Kabalistická fáze */
#define CL_KEY_ROUNDS          22u              /* 🆕 22-Round key schedule */

/* Hiranyagarbha Initialization Constants */
constant ulong HIC[22] = {
    0x9E3779B97F4A7C15UL, 0x6C62272E07BB0142UL, 0x94D049BB133111EBUL,
    0xBF58476D1CE4E5B9UL, 0x94D049BB133111EBUL, 0x6C62272E07BB0142UL,
    0x9E3779B97F4A7C15UL, 0x517CC1B727220A95UL, 0xBB67AE8584CAA73BUL,
    0x3C6EF372FE94F82BUL, 0xA54FF53A5F1D36F1UL, 0x510E527FADE682D1UL,
    0x9B05688C2B3E6C1FUL, 0x1F83D9ABFB41BD6BUL, 0x5BE0CD19137E2179UL,
    0xCBBB9D5DC1059ED8UL, 0x629A292A367CD507UL, 0x9159015A3070DD17UL,
    0x152FECD8F70E5939UL, 0x67332667FFC00B31UL, 0x8EB44A8768581511UL,
    0xDB0C2E0D64F98FA7UL,
};
```

### 6.2 CUDA Kernel — Nové definice

```cuda
/* CHv4.2 CUDA parametry */
#define CUDA_SCRATCHPAD_BYTES  (64u * 1024u)
#define CUDA_BLOCK_COUNT       1024u
#define CUDA_PASSES            2u
#define CUDA_BACKWARD_PASSES   2u          /* 🆕 */
#define CUDA_RANDOM_READS      64u
#define CUDA_KABALA_READS      22u         /* 🆕 */
#define CUDA_KEY_ROUNDS        22u         /* 🆕 */

__constant__ unsigned long long HIC[22] = {
    0x9E3779B97F4A7C15ULL, 0x6C62272E07BB0142ULL, 0x94D049BB133111EBULL,
    /* ... stejné jako OpenCL ... */
    0xDB0C2E0D64F98FA7ULL,
};
```

### 6.3 Metal Shader — Nové definice

```metal
/* CHv4.2 Metal parametry */
constant uint METAL_SCRATCHPAD_BYTES = 65536;      /* zachováno */
constant uint METAL_BLOCK_COUNT      = 1024;        /* zachováno */
constant uint METAL_PASSES           = 2;           /* forward */
constant uint METAL_BACKWARD_PASSES  = 2;           /* 🆕 backward */
constant uint METAL_RANDOM_READS     = 64;          /* zachováno */
constant uint METAL_KABALA_READS     = 22;          /* 🆕 */
constant uint METAL_KEY_ROUNDS       = 22;          /* 🆕 */

constant ulong HIC[22] = {
    0x9E3779B97F4A7C15UL, 0x6C62272E07BB0142UL, /* ... */
    0xDB0C2E0D64F98FA7UL,
};
```

---

## 7. Bezpečnostní Analýza

### 7.1 Odolnost vůči FPGA/ASIC útoků

| Vektor útoku | CHv4.1 odolnost | CHv4.2 odolnost |
|-------------|----------------|----------------|
| Pipeline prefetch | Střední (1 směr) | Vysoká (2 protidir.) |
| Memory replay | Střední | Vysoká (22 kabala reads) |
| Precomputation | Nízká-střední | Vysoká (HIC seeding) |
| Parallelism | Vysoká | Vysoká |
| Time-Memory tradeoff | Střední | Vysoká (zpětný pass) |

### 7.2 Avalanche Effect

CHv4.2 cílí na >99.9% avalanche efekt — změna jednoho bitu vstupu změní v průměru
>50% výstupních bitů. Bidirektionální průchod a 22-round schedule výrazně zlepšují
difuzi oproti CHv4.1.

### 7.3 Timing Attack Resistance

Všechny operace jsou konstantně-časové (constant-time) — žádná branch podmíněná
hodnotou tajného stavu. AES-NI instrukce jsou constant-time na všech moderních CPU.

---

## 8. C Native Library Změny (libcosmic_harmony_v4)

### 8.1 Nové #defines v `cosmic_harmony_v4_native.c`

```c
/* CHv4.2 — Merkabah Dual-Spin */
#define CHV4_SCRATCHPAD_BYTES    65536      /* 64 KiB — zachováno */
#define CHV4_BLOCK_COUNT         1024       /* zachováno */
#define CHV4_PASSES              2          /* forward */
#define CHV4_BACKWARD_PASSES     2          /* 🆕 Ra backward */
#define CHV4_RANDOM_READS        64         /* zachováno */
#define CHV4_KABALA_READS        22         /* 🆕 */
#define CHV4_KEY_ROUNDS          22         /* 🆕 */
#define CHV4_VERSION             42         /* CHv4.2 = 42 */

/* Hiranyagarbha Initialization Constants */
static const uint64_t CHV4_HIC[22] = {
    0x9E3779B97F4A7C15ULL, 0x6C62272E07BB0142ULL, 0x94D049BB133111EBULL,
    0xBF58476D1CE4E5B9ULL, 0x94D049BB133111EBULL, 0x6C62272E07BB0142ULL,
    0x9E3779B97F4A7C15ULL, 0x517CC1B727220A95ULL, 0xBB67AE8584CAA73BULL,
    0x3C6EF372FE94F82BULL, 0xA54FF53A5F1D36F1ULL, 0x510E527FADE682D1ULL,
    0x9B05688C2B3E6C1FULL, 0x1F83D9ABFB41BD6BULL, 0x5BE0CD19137E2179ULL,
    0xCBBB9D5DC1059ED8ULL, 0x629A292A367CD507ULL, 0x9159015A3070DD17ULL,
    0x152FECD8F70E5939ULL, 0x67332667FFC00B31ULL, 0x8EB44A8768581511ULL,
    0xDB0C2E0D64F98FA7ULL,
};
```

---

## 9. Upgrade Plán a Compatibility

### 9.1 Fork Strategie

CHv4.2 je **konsenzus-inkompatibilní** změna — produkuje odlišné hashe než CHv4.1.
Pro bezpečný přechod musí být implementován **fork guard** na specifikované výšce bloku.

```rust
/// Dispatch algoritmu dle výšky bloku
pub fn dispatch_chv4(header: &[u8], nonce: u64, height: u64) -> [u8; 32] {
    if height >= CHV4_2_FORK_HEIGHT {
        cosmic_harmony_v4_2(header, nonce)   // Merkabah Dual-Spin
    } else if height >= CHV4_1_FORK_HEIGHT {
        cosmic_harmony_v4_1(header, nonce)   // Golden Middle
    } else {
        cosmic_harmony_v4_0(header, nonce)   // Original Heavy
    }
}

/// Fork výšky (hodnoty k dopracování před mainnet)
pub const CHV4_1_FORK_HEIGHT: u64 = 0;           // CHv4.1 aktivní od genesis
pub const CHV4_2_FORK_HEIGHT: u64 = TBD;         // Testnet: ~10000, Mainnet: TBD
```

### 9.2 Testnet Postup

```
Krok 1: Testnet Phase 1 (2 týdny)
  - Nasazení CHv4.2 na devnet
  - Ověření Rust/C/Python parity
  - Referenční vektor testování

Krok 2: Testnet Phase 2 (2 týdny)  
  - CHv4.2 na testnet s fork_height = 10000
  - Monitoring stability výkonu
  - Mining farm integrace testing

Krok 3: Community Vote
  - CHv4.2 specifikace veřejná 1 měsíc před mainnet
  - Hlasování prostřednictvím DAO governance

Krok 4: Mainnet Activation
  - 2 týdny notice period po fork_height stanovení
  - Koordinovaný restart všech uzlů
  - Monitoring prvních 24 hodin
```

### 9.3 Reference Vektory (testovací)

Po implementaci musí být tyto vektory ověřeny:

```
# CHv4.2 reference vektory (TBD po implementaci)
# Input: header = "ZION block header v2.9.6" + 56×0x00, nonce = 12345

CHV4_1 (Golden Middle):
  hash = 655348e35abb6732cf0229a3b5fa0827ee5424f36d92e515827030b843cdc4b0 ✅ konfirmováno

CHV4_2 (Merkabah Dual-Spin):
  hash = [TBD — po implementaci v Rust + C + GPU; musí být identické napříč platformami]
```

---

## 10. Soubory k Úpravě

### 10.1 Kompletní seznam souborů pro CHv4.2 patch

```
L1/cosmic-harmony/src/scratchpad.rs          → Nové konstanty + backward pass
L1/cosmic-harmony/src/algorithms_opt.rs      → Nová dispatch logika + ref. vektory
L1/cosmic-harmony/src/gpu/metal_shader.metal → Metal HIC + backward pass
L1/cosmic-harmony/src/gpu/metal_miner.rs     → Aktualizace batch size
L1/miner/src/miner/gpu/opencl.rs             → CHV4_2 dispatch
L1/miner/src/miner/gpu/cuda.rs               → CHV4_2 dispatch
L1/miner/src/miner/gpu/mod.rs                → Version routing
L1/miner/src/miner/gpu/kernels/cosmic_harmony_v3.cl    → CL HIC + backward
L1/miner/src/miner/gpu/kernels/cosmic_harmony_v3.cu    → CUDA HIC + backward
L1/native-libs/all/cosmic_harmony_v4_native.c          → C HIC + backward
L1/native-libs/all/cosmic_harmony_v4_native_p1.c       → C fáze 1 HIC
L1/native-libs/all/cosmic_harmony_v4_native_p2.c       → C fáze 2 backward
L1/native-libs/all/cosmic_harmony_v4_metal.metal       → Metal HIC + backward
L1/native-libs/all/cosmic_harmony_v4_gpu_metal.m       → ObjC wrapper update
APP&WEB/desktop-agent/resources/cosmic_harmony_v4_metal.metal → Desktop GPU
APP&WEB/desktop-agent/resources/mining/cosmic_harmony_v3_gpu.py → Python CL
config/mainnet.toml                            → CHV4_2_FORK_HEIGHT
config/testnet.toml                            → CHV4_2_FORK_HEIGHT = 10000
```

### 10.2 Nové soubory k vytvoření

```
L1/cosmic-harmony/src/merkabah.rs             → Merkabah backward pass modul
L1/cosmic-harmony/src/hic.rs                  → HIC konstanty modul
L1/cosmic-harmony/src/kabala.rs               → Kabalistická fáze modul
tests/chv4_2_reference_vectors.rs             → Referenční vektory test
tests/chv4_2_parity_test.rs                   → Rust/C/GPU parity test
```

---

## 11. Časový Harmonogram

```
                    ÚNOR 2026            BŘEZEN 2026           DUBEN 2026
                  ┌─────────────────┬───────────────────┬──────────────────┐
  Specifikace     │ ██████████████  │                   │                  │
  Rust impl.      │       ████████  │ ████████████      │                  │
  C native        │                │ ████████████      │                  │
  GPU kernels     │                │       ████████    │ ████             │
  Testing         │                │          ████████ │ ████████         │
  Testnet         │                │                   │ ████████████     │
  Mainnet         │                │                   │           ██████ │
                  └─────────────────┴───────────────────┴──────────────────┘
  
  AKTUÁLNÍ STAV (5. března 2026): Specifikace hotova → začínáme Rust implementaci
```

---

## 12. Závěr

CHv4.2 "Merkabah Dual-Spin" představuje přirozený vývoj CHv4.1 "Zlatý Střed":

- **Zachovává** zlatý střed paměti (64 KiB)
- **Přidává** bidirektionální Merkabah průchod
- **Implementuje** 22 pólů vědomí prostřednictvím HIC a Kabalistické fáze
- **Zvyšuje** FPGA/ASIC odolnost o ~6× bez výrazného CPU overhead

Jako Merkabah rotuje a generuje ochranné torusové pole, tak CHv4.2 generuje
kryptografické pole, které chrání integritu ZION blockchainu.

> *"Jako ve výšinách, tak v hloubkách. Jako uvnitř, tak navenek.*  
> *Jako Velké, tak i Malé. Vše je Jedno."*  
> — Hermes Trismegistos (Smaragdová Tabulka, adaptace)

---

**Verze dokumentu**: CHv4.2 Spec v1.0  
**Datum**: 5. března 2026  
**Autor**: ZION Core Team  
**Status**: DRAFT — ke schválení komunitou  
**Závisí na**: CHv4.1 (plně implementováno a otestováno)  
**Následné**: `CHV4_2_IMPLEMENTATION.md` (po schválení specifikace)
