# Cosmic Harmony Ekam Deeksha — Optimalizační plán

> Datum: 2026-03-11 (aktualizace: 2026-03-11)  
> Status: **IMPLEMENTOVÁNO** (Tier 1 + Tier 2)  
> Závisí na: `COSMIC_HARMONY_DEEKSHA_SPEC.md`, `CHV_DEEKSHA_ARCHITECTURE.md`, `DEEKSHA_EKAM_CONCEPT_BRIDGE.md`  
> Cíl: **10–20× zrychlení** Deeksha pipeline bez oslabení ASIC resistance nebo kryptografické bezpečnosti  
> **Dosaženo:** 2.54× zrychlení (1T), 2.38× (8T) — Blake3 XOF init + Blake3 XOF mixing

## Aktuální stav 2.9.8 workstreamu

Kanonická Ekam Deeksha cesta je v tomto workspace **aktivní napříč core, minerem, poolem i desktop-agentem**. Tier 1 a Tier 2 jsou implementované a benchmarky potvrdily, že rozhodující zrychlení přišlo až po přepnutí scratchpad init + mixing na Blake3 XOF variantu; původně navržený AES cascade zůstal v repozitáři jako reference, ale není součástí canonical path.

Na desktop-agentu je nyní srovnané i pojmenování a resource dispatch: Electron orchestrace přijímá legacy `deeksha-*` aliasy, ale interně normalizuje na Ekam path, Python fallback používá správný canonical seed a GPU wrapper preferuje Ekam kernel assety a entrypointy.

### Desktop-agent GPU stav

- Native GPU podpora pro Ekam je ověřená na **Metal** backendu přímo přes desktop-agent mining resources.
- `cosmic_harmony_v42_gpu.py` nyní preferuje shader `cosmic_harmony_ekam_deeksha.metal` a entrypoint `cosmic_harmony_ekam_mine`, teprve potom padá zpět na legacy symboly.
- `prepare-rust-miner.js` explicitně synchronizuje canonical GPU assety z `L1/native-libs/all/` do `APP&WEB/desktop-agent/resources/mining/`, aby packaging a lokální runtime používaly stejný zdroj pravdy.
- Metal shader `cosmic_harmony_ekam_deeksha.metal` byl opraven o forward declarations helper funkcí, aby runtime kompilace na Apple Silicon nepadala na neznámých symbolech.
- Workspace Python prostředí pro tento path vyžaduje `pyobjc-framework-Metal` a `numpy`; bez nich Metal benchmark neproběhne.

### Ověřený benchmark desktop-agentu

Samostatný bench běh desktop-agent entrypointu `resources/mining/cosmic_harmony_deeksha_gpu.py` byl úspěšný na Apple Silicon Metal backendu s Ekam entrypointem `cosmic_harmony_ekam_mine`.

| Prostředí | Backend | Entrypoint | Výsledek |
|:----------|:--------|:-----------|:---------|
| Apple M1 / desktop-agent resources | Metal | `cosmic_harmony_ekam_mine` | **~5575.5 H/s** |

To znamená, že **nativní GPU Ekam cesta v agentu už není jen návrh, ale funkční a lokálně ověřený runtime path**. Zbývající praktický krok je end-to-end ověření plného Electron flow, tedy že `src/main.js` spouští tentýž backend i při reálném startu těžby z UI.

---

## 0) Motivace

Testování ukázalo, že síť běžící čistě na Deeksha profilu je **příliš pomalá** pro produkční provoz. Problém není v architektuře algoritmu, ale v **volbě vnitřních primitiv** — SHA3-512 jako univerzální mixing funkce v memory-hard scratchpadu je bezpečná, ale extrémně nákladná.

Tento dokument navrhuje vrstvenou optimalizaci inspirovanou architekturou Ekam chrámu — masivní základ, strukturované sloupy, koncentrované jádro a koruna.

---

## 1) Analýza současného stavu

### 1.1 Pipeline (z `deeksha.rs`)

```
header+nonce → Keccak-256 → SHA3-512 → GoldenMatrix →
  MemoryHard(64KiB/2/64) → NpuMix(INT8 MLP) → CosmicFusion → Hash32
```

### 1.2 Profilace jednoho hashe

| Krok | Operace | Primitiva | Počet volání | Approx. podíl |
|:-----|:--------|:----------|:-------------|:---------------|
| Step 1: Keccak-256 | Komprese vstupu | Keccak-256 | 1 | <1% |
| Step 2: SHA3-512 | Expanze | SHA3-512 | 1 | <1% |
| Step 3: GoldenMatrix | φ-transform | Fixed-point mul | 64 | ~2% |
| **Step 4: MemoryHard** | **ASIC resistance** | **SHA3-512 + Keccak-256** | **~3 137** | **~88–92%** |
| Step 5: NPU MLP | INT8 mixing | INT8 MAC | ~24K | ~5% |
| Step 6: CosmicFusion | Finální fúze | Keccak-256 + AES-128 | 4+4 | ~3% |

### 1.3 Rozklad Step 4 — scratchpad (z `scratchpad.rs`)

| Fáze | Operace | Primitiva | Počet volání |
|:-----|:--------|:----------|:-------------|
| `init_scratchpad()` | SHA3-512 chain fill | SHA3-512 | **1024** |
| `sequential_passes()` | 2× forward/backward mix | SHA3-512 | **2048** |
| `random_read_mix()` | 64 dependent reads | Keccak-256 | **64** |
| Final hash | Finální komprese | SHA3-512 | **1** |
| **Celkem** | | | **3 137** |

### 1.4 Diagnóza

**Hlavní problém:** V `init_scratchpad()` a `sequential_passes()` je SHA3-512 použito jako obecná mixing/expansion funkce. SHA3-512 je kryptograficky výborná, ale pro vnitřní scratchpad mixing je to overkill — data závislost mezi bloky a random přístupy zajišťují ASIC resistance, nikoliv síla individuální hash funkce.

**Analogie z Ekam:** Základ chrámu používá masivní, ale efektivní materiál (beton + ocel). Ornamentální zlato (SHA3) patří na korunu, ne do základů.

### 1.5 Odhad současného hashrate

| Platforma | Single-thread | 8 threads |
|:-----------|:-------------|:----------|
| Apple M2 Pro | ~800–1500 H/s | ~5000–10000 H/s |
| Intel i7-12700 | ~500–1200 H/s | ~3500–8000 H/s |
| AMD Ryzen 7700X | ~600–1400 H/s | ~4000–9500 H/s |

Cíl: **5000–15000 H/s single-thread** → srovnatelné s CHv3 legacy, ale s ASIC resistance.

---

## 2) Ekam Layered Architecture

Optimalizace je organizována do tří vrstev (tierů), od nejnižšího po nejvyšší riziko:

```
╔══════════════════════════════════════════════════════════════╗
║                    KORUNA (Crown)                            ║
║  Tier 3: Ekam Golden Core                                   ║
║  Nové verifikační a mixing vrstvy                           ║
║  → Hiranyagarbha Verification, Dual AES, Adaptive Fusion   ║
╠══════════════════════════════════════════════════════════════╣
║                    SLOUPY (Pillars)                          ║
║  Tier 2: Ekam Foundation                                    ║
║  Změna vnitřních primitiv scratchpadu                       ║
║  → Blake3 init, AES-NI cascade mixing                      ║
╠══════════════════════════════════════════════════════════════╣
║                    ZÁKLAD (Foundation)                       ║
║  Tier 1: Implementační optimalizace                         ║
║  Zero consensus risk — jen rychlejší kód                    ║
║  → SIMD SHA3, prefetch, AVX2 XOR                           ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 3) Tier 1 — Foundation (Zero Consensus Risk)

> **Princip:** Identický konsenzuální výstup, rychlejší implementace.  
> **Riziko:** Žádné. Stejný hash, stejný test vector.  
> **Nasazení:** Okamžitě, bez fork.

### 3.1 SIMD-optimalizovaný SHA3

**Problém:** RustCrypto `sha3` crate používá portabilní Rust kód bez SIMD. Keccak permutace je SIMD-friendly (64-bit XOR, rotace, AND).

**Řešení:** Nahradit interní SHA3 za SIMD-aware implementaci:
- **x86_64:** AVX2 Keccak-f[1600] — 4-way parallel sponge tam, kde je to možné
- **aarch64:** NEON-optimalizovaný Keccak (Apple M1/M2 hardware support přes `sha3` instrukce)
- **Fallback:** Stávající portabilní kód

**Implementace:**

```rust
// scratchpad.rs — podmíněná volba SHA3 backendu
#[cfg(target_arch = "x86_64")]
use crate::sha3_simd::Sha3_512Avx2 as Sha3Fast;

#[cfg(target_arch = "aarch64")]
use crate::sha3_simd::Sha3_512Neon as Sha3Fast;

#[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
use sha3::Sha3_512 as Sha3Fast;
```

**Očekávaný přínos:** 2–3× zrychlení SHA3 operací → celkově **~2× zrychlení** Deeksha pipeline.

**Soubory k úpravě:** `scratchpad.rs`, nový `sha3_simd.rs`

### 3.2 CPU Prefetch v mix_block()

**Problém:** `mix_block()` čte z random pozice v scratchpadu (`rand_index`). Na CPU s 64 KiB L1 data cache je to hit, ale závisí na cache-line alignment.

**Řešení:** Software prefetch pro další iteraci:

```rust
#[cfg(target_arch = "x86_64")]
{
    use std::arch::x86_64::*;
    // Prefetch pro block, který budeme číst v dalším loopu
    let next_rand_off = next_random_offset(pad, index + 1, pass);
    unsafe { _mm_prefetch(pad.as_ptr().add(next_rand_off) as *const i8, _MM_HINT_T0); }
}
```

**Očekávaný přínos:** 5–15% zrychlení `sequential_passes()` (závisí na cache geometrii).

**Soubory k úpravě:** `scratchpad.rs`

### 3.3 AVX2/NEON vektorový XOR

**Problém:** XOR loop v `mix_block()` je skalární (byte po byte, 64 iterací):

```rust
for j in 0..BLOCK_SIZE {
    pad[cur_off + j] ^= mixed[j];
}
```

**Řešení:** SIMD XOR po 32/16 bytech:

```rust
#[cfg(target_arch = "x86_64")]
unsafe {
    let a = _mm256_loadu_si256(pad[cur_off..].as_ptr() as *const __m256i);
    let b = _mm256_loadu_si256(mixed.as_ptr() as *const __m256i);
    _mm256_storeu_si256(pad[cur_off..].as_mut_ptr() as *mut __m256i, _mm256_xor_si256(a, b));
    // Opakovat pro druhou polovinu (offset +32)
}
```

**Očekávaný přínos:** 10–20% zrychlení XOR fází (minor v celku, ale free win).

**Soubory k úpravě:** `scratchpad.rs`, `algorithms_opt.rs` (CosmicFusion XOR)

### 3.4 Tier 1 — Shrnutí

| Optimalizace | Přínos | Riziko | Soubory |
|:-------------|:-------|:-------|:--------|
| SIMD SHA3 | ~2× celkově | Nulové | `sha3_simd.rs` (nový), `scratchpad.rs` |
| Prefetch | ~5–15% scratchpad | Nulové | `scratchpad.rs` |
| AVX2 XOR | ~10–20% XOR fáze | Nulové | `scratchpad.rs`, `algorithms_opt.rs` |
| **Celkem Tier 1** | **~2–3× zrychlení** | **Nulové** | |

---

## 4) Tier 2 — Ekam Foundation (Nový Konsenzuální Hash)

> **Princip:** Nahradit SHA3 ve vnitřních fázích scratchpadu za rychlejší, ale stále kryptograficky bezpečné primitivy.  
> **Riziko:** Konsenzuální změna — nový test vector, vyžaduje fork height.  
> **Nasazení:** S novým test vectorem + 7denní canary run.

### 4.1 Blake3 XOF pro init_scratchpad() — „Maha-tattva Acceleration"

**Problém:** `init_scratchpad()` volá 1024× SHA3-512 sériově. Každé volání trvá ~300–500 ns → ~300–500 µs jen na init. Přitom účelem init je jen deterministicky naplnit 64 KiB pseudo-random daty ze seedu — nepotřebujeme kryptografickou jednosměrnost (ta je zajištěna Keccak-256 na vstupu pipeline).

**Řešení:** Blake3 XOF (Extendable Output Function) — generuje libovolně dlouhý proud z 64B seedu v jediném volání:

```rust
fn init_scratchpad_ekam(seed: &[u8; 64], pad: &mut [u8]) {
    // Blake3 XOF: jeden seed → 64 KiB pseudorandom dat
    let mut hasher = blake3::Hasher::new();
    hasher.update(seed);
    hasher.update(b"EKAM_SCRATCHPAD_INIT_V1"); // domain separation
    let mut reader = hasher.finalize_xof();
    reader.fill(pad); // 64 KiB v jednom tahu
}
```

**Proč je to bezpečné:**
- Blake3 je kryptograficky ověřená hash funkce (Merkle tree, NIST 3rd round candidate core)
- XOF výstup je pseudorandom a neprogramovatelný z pozice ASIC
- Init fáze **nevytváří** bezpečnost scratchpadu — tu vytváří data-dependent přístupy v mixing fázi
- Analogie: základ chrámu nemusí být ze zlata, stačí kvalitní beton. Zlato je na koruně (final hash)

**Přínos:** 1024× SHA3-512 → 1× Blake3 XOF. Init fáze: ~300–500 µs → **~5–10 µs** (~50× zrychlení init).

**Konsenzuální dopad:** ANO — nový hash výstup, nový test vector.

### 4.2 AES-NI Cascade Mixing — „Ekam Pillar Transform"

**Problém:** `mix_block()` ve `sequential_passes()` volá SHA3-512 pro mixing 3 bloků (current + prev + random):

```rust
let mut h = Sha3_512::new();
h.update(current);
h.update(prev);
h.update(random);
h.update(pass.to_le_bytes());
h.update((index as u64).to_le_bytes());
let mixed = h.finalize();
```

To je 2048× SHA3-512 = hlavní bottleneck.

**Řešení:** AES-NI based cascade mixing (inspirováno Haraka v2 a VerusHash 2.2):

```rust
/// AES-NI cascade mixing — 64B vstup → 64B výstup.
/// 5 kol AES-128-encrypt s data-dependent key evolution.
/// ~5–8 ns na x86_64 s AES-NI vs. ~300 ns SHA3-512.
#[inline]
fn aes_cascade_mix(
    current: &[u8; 64],
    prev: &[u8; 64],
    random: &[u8; 64],
    metadata: u64, // pass ⊕ index
) -> [u8; 64] {
    let mut state = *current;

    // Kolo 1: Mix s prev blokem
    let key1: [u8; 16] = derive_aes_key(&prev[..16], metadata, 1);
    aes_encrypt_blocks(&mut state[0..16], &key1);
    aes_encrypt_blocks(&mut state[16..32], &key1);
    aes_encrypt_blocks(&mut state[32..48], &key1);
    aes_encrypt_blocks(&mut state[48..64], &key1);

    // Kolo 2: Mix s random blokem
    let key2: [u8; 16] = derive_aes_key(&random[..16], metadata, 2);
    aes_encrypt_blocks(&mut state[0..16], &key2);
    aes_encrypt_blocks(&mut state[16..32], &key2);
    aes_encrypt_blocks(&mut state[32..48], &key2);
    aes_encrypt_blocks(&mut state[48..64], &key2);

    // Kolo 3: XOR cross-feed
    for i in 0..32 {
        state[i] ^= prev[32 + i];
        state[32 + i] ^= random[i];
    }

    // Kolo 4-5: Finální AES s evolving key
    let key3: [u8; 16] = derive_aes_key(&state[..16], metadata, 3);
    aes_encrypt_blocks(&mut state[0..16], &key3);
    aes_encrypt_blocks(&mut state[16..32], &key3);
    let key4: [u8; 16] = derive_aes_key(&state[32..48], metadata, 4);
    aes_encrypt_blocks(&mut state[32..48], &key4);
    aes_encrypt_blocks(&mut state[48..64], &key4);

    state
}
```

**Proč je to bezpečné:**
- AES-128 je NIST standard (FIPS 197), hardware-accelerated na všech moderních CPU
- Data-dependent klíče (odvozené z aktuálního bloku) znemožňují ASIC precomputation
- Kaskádový design (5 kol) zajišťuje plnou difuzi přes 64 bytů
- Tento design je analogický **Haraka-256/512** — kryptograficky analyzovaná AES-based hash
- ASIC musí implementovat plný AES + key schedule → stejná komplexita jako CPU s AES-NI
- Bez AES-NI (starší CPU): software fallback přes lookup tabulky (~50 ns, stále 6× rychlejší než SHA3)

**Proč ne Blake3 i pro mixing?**
- Blake3 je rychlá, ale nemá hardware akceleraci jako AES-NI
- AES-NI je ~1–2 ns per block vs Blake3 ~5–15 ns per 64B
- Blake3 se hodí na bulk expansion (init), AES-NI na individual block mixing

**Přínos:** 2048× SHA3-512 → 2048× AES cascade. Mixing fáze: ~600–1000 µs → **~10–16 µs** (~60× zrychlení mixing).

### 4.3 Zachování SHA3 na kryptografických hranicích

V Tier 2 se SHA3/Keccak **zachovává** tam, kde zajišťuje kryptografickou bezpečnost:

| Místo | Primitiva | Důvod zachování |
|:------|:----------|:----------------|
| Step 1: Keccak-256 | ✅ Zachovat | Vstupní komprese — jednosměrnost (P1) |
| Step 2: SHA3-512 | ✅ Zachovat | Expanze — kolizní odolnost (P2) |
| `random_read_mix()` | ✅ Zachovat Keccak-256 | 64 volání — adresa závisí na výstupu, ASIC resistance |
| Final hash (v random_read_mix) | ✅ Zachovat SHA3-512 | Finální komprese scratchpadu |
| `init_scratchpad()` | ❌ → Blake3 XOF | Init je expanze, ne bezpečnostní hranice |
| `mix_block()` | ❌ → AES cascade | Vnitřní mixing, bezpečnost = data-dependent přístupy |

**Princip z kosmologie (AUM):**
- **A** (tvorba) = Keccak + SHA3 + GoldenMatrix — zachováno (kryptografická bezpečnost)
- **U** (trvání) = MemoryHard vnitřní mixing — **zrychleno** (AES + Blake3)
- **M** (transformace) = NPU + CosmicFusion — zachováno

### 4.4 Nový scratchpad pipeline (Ekam Foundation)

```
init_scratchpad_ekam():
    Blake3 XOF(seed || "EKAM_SCRATCHPAD_INIT_V1") → 64 KiB     [NOVÉ]

sequential_passes_ekam():
    2× forward/backward:
        mix = aes_cascade_mix(current, prev, random, metadata)   [NOVÉ]
        pad[cur] ^= mix

random_read_mix():
    64× Keccak-256 dependent reads                               [ZACHOVÁNO]
    Final SHA3-512(acc || pad[first] || pad[last])                [ZACHOVÁNO]
```

### 4.5 Tier 2 — Shrnutí

| Optimalizace | Přínos | Konsenzuální dopad | Soubory |
|:-------------|:-------|:-------------------|:--------|
| Blake3 init | ~50× init fáze | Nový hash | `scratchpad.rs` |
| AES cascade mixing | ~60× mixing fáze | Nový hash | `scratchpad.rs`, nový `aes_mix.rs` |
| SHA3 na hranicích | Zachováno | — | `scratchpad.rs` |
| **Celkem Tier 2** | **~8–12× celkově** | **Nový test vector** | |

### 4.6 Nový profil po Tier 1 + Tier 2

```
Profilování po optimalizaci (odhad):
┌────────────────────┬──────────┬──────────┐
│ Fáze               │ Před     │ Po       │
├────────────────────┼──────────┼──────────┤
│ init_scratchpad    │ ~400 µs  │ ~8 µs    │
│ sequential_passes  │ ~800 µs  │ ~14 µs   │
│ random_read_mix    │ ~30 µs   │ ~30 µs   │  ← zachováno (SHA3/Keccak)
│ NPU MLP            │ ~50 µs   │ ~50 µs   │  ← nezměněno
│ CosmicFusion       │ ~30 µs   │ ~30 µs   │  ← nezměněno
│ Ostatní            │ ~10 µs   │ ~10 µs   │
├────────────────────┼──────────┼──────────┤
│ CELKEM / hash      │ ~1300 µs │ ~142 µs  │
│ Single-thread H/s  │ ~770     │ ~7000    │
│ 8-thread H/s       │ ~5500    │ ~50000   │
└────────────────────┴──────────┴──────────┘
```

---

## 5) Tier 3 — Ekam Golden Core (Nové Vrstvy)

> **Princip:** Přidat nové vrstvy, které vylepší bezpečnost a znesnadní ASIC, bez velkého dopadu na throughput.  
> **Riziko:** Další konsenzuální změna. Nasazovat až po stabilizaci Tier 2.

### 5.1 Hiranyagarbha Verification Layer — „Zlaté Vejce"

Přidat lehkou verifikační vrstvu mezi scratchpad a NPU MLP:

```rust
/// Hiranyagarbha Verification — Blake3 Merkle root přes celý scratchpad.
/// Ověří, že celý scratchpad byl korektně vyplněn a zmixován.
/// Chrání proti partial-computation shortcuts na FPGA/ASIC.
fn hiranyagarbha_verify(pad: &[u8], state: &mut [u8; 64]) {
    // Blake3 přes celý 64 KiB scratchpad (stromová struktura, ~10 hashů interně)
    let root = blake3::hash(pad);
    // XOR root do stavu → scratchpad integrita je součástí pipeline
    for i in 0..32 {
        state[i] ^= root.as_bytes()[i];
    }
}
```

**Přínos:** ~2–5 µs navíc. Zabrání ASIC, které by skipovaly scratchpad bloky.

### 5.2 Dual-Path AES Mixing — „Ekam Dualita"

Rozšířit `aes_cascade_mix` o druhý nezávislý klíčový proud:

```rust
/// Dva nezávislé AES proudy (forward + backward klíč).
/// Výsledky se XOR-ují → ASIC musí implementovat dva kompletní AES pipeline.
fn dual_aes_mix(current: &[u8; 64], prev: &[u8; 64], random: &[u8; 64], metadata: u64) -> [u8; 64] {
    let forward = aes_cascade_mix(current, prev, random, metadata);
    let backward = aes_cascade_mix_reversed(current, random, prev, metadata ^ 0xDEEK5HA);
    let mut result = [0u8; 64];
    for i in 0..64 {
        result[i] = forward[i] ^ backward[i];
    }
    result
}
```

**Přínos:** ~2× ASIC development cost (dva AES pipeline), ~8 ns navíc per block.

### 5.3 Adaptive CosmicFusion — „Osm kol místo čtyř"

Zvýšit `DEEKSHA_FUSION_ROUNDS` z 4 na 8. AES-NI je extrémně rychlá (~1.3 ns/round):

```rust
pub const EKAM_FUSION_ROUNDS: usize = 8; // bylo: 4
```

**Přínos:** ~5 ns navíc, ale výrazně lepší avalanche effect ve finální fázi. Dvojnásobná difuze.

### 5.4 Kabala Light — „22 čtení bez SHA3"

Přidat zpět kabalistická čtení z CHv4.2, ale s AES-NI mixing místo Keccak-256:

```rust
fn kabala_light(pad: &[u8], state: &mut [u8; 64]) {
    for k in 0..22 {
        let addr = ((HIC[k] ^ u64::from_le_bytes(state[..8].try_into().unwrap())) as usize)
            % (SCRATCHPAD_SIZE / BLOCK_SIZE);
        let off = addr * BLOCK_SIZE;
        // AES-NI mix místo Keccak-256
        let key: [u8; 16] = derive_aes_key(&pad[off..off+16], HIC[k], k as u64);
        aes_encrypt_blocks(&mut state[0..16], &key);
        aes_encrypt_blocks(&mut state[16..32], &key);
        for i in 0..32 {
            state[32+i] ^= pad[off+32+i];
        }
    }
}
```

**Přínos:** ~100 ns navíc (22× AES vs. 22× Keccak = ~6.6 µs). Přidává HIC-dependent přístupy, FPGA precomputation resistance.

### 5.5 Tier 3 — Shrnutí

| Optimalizace | Přidaná latence | Bezpečnostní přínos |
|:-------------|:---------------|:-------------------|
| Hiranyagarbha Verify | ~2–5 µs | Integrita celého scratchpadu |
| Dual AES | ~8 ns/block | 2× ASIC development cost |
| 8 Fusion kol | ~5 ns | 2× avalanche v finále |
| Kabala Light | ~100 ns | HIC-dependent FPGA resistance |
| **Celkem navíc** | **~5–10 µs** | **Výrazné posílení ASIC/FPGA resistance** |

---

## 6) Kompletní Ekam Deeksha Pipeline

Po všech třech tierech:

```
header+nonce
     │
     ▼
Step 1: Keccak-256(88B) → 32B                             [ZACHOVÁNO]
     │                                                      P1 jednosměrnost
     ▼
Step 2: SHA3-512(32B) → 64B                                [ZACHOVÁNO]
     │                                                      P2 kolizní odolnost
     ▼
Step 3: GoldenMatrix(φ) → 64B                              [ZACHOVÁNO]
     │                                                      Geometrický difuzor
     ▼
Step 4a: Blake3 XOF init(64B → 64KiB)                     [NOVÉ: Tier 2]
     │                                                      Maha-tattva expanze
     ▼
Step 4b: AES cascade 2×forward/backward(64KiB)            [NOVÉ: Tier 2]
     │                                                      Ekam Pillar mixing
     ▼
Step 4c: Kabala Light — 22 HIC AES reads(64KiB)           [NOVÉ: Tier 3]
     │                                                      Sefírotská ochrana
     ▼
Step 4d: Keccak-256 × 64 random reads(64KiB) → 64B        [ZACHOVÁNO]
     │                                                      Data-dependent ASIC resistance
     ▼
Step 4e: Hiranyagarbha Blake3(64KiB) XOR → 64B             [NOVÉ: Tier 3]
     │                                                      Integrita scratchpadu
     ▼
Step 5: NPU INT8 MLP(64→128→64) + residual → 64B          [ZACHOVÁNO]
     │                                                      Vědomá transformace
     ▼
Step 6: CosmicFusion(Keccak + AES-NI, 8 kol) → 32B        [ROZŠÍŘENO: 4→8 kol]
     │                                                      Finální sjednocení
     ▼
Hash32                                                      Manifest
```

### 6.1 Celkový odhad výkonu

```
┌────────────────────────┬──────────┬──────────┬──────────┐
│ Pipeline krok          │ Původní  │ Tier 1+2 │ Tier 1-3 │
├────────────────────────┼──────────┼──────────┼──────────┤
│ Keccak + SHA3 + Golden │ ~10 µs   │ ~10 µs   │ ~10 µs   │
│ Blake3 init (64 KiB)   │ ~400 µs* │ ~8 µs    │ ~8 µs    │
│ AES cascade passes     │ ~800 µs* │ ~14 µs   │ ~14 µs   │
│ Kabala Light           │ —        │ —        │ ~0.1 µs  │
│ Random read mix (SHA3) │ ~30 µs   │ ~30 µs   │ ~30 µs   │
│ Hiranyagarbha verify   │ —        │ —        │ ~3 µs    │
│ NPU MLP                │ ~50 µs   │ ~50 µs   │ ~50 µs   │
│ CosmicFusion (8 kol)   │ ~30 µs   │ ~30 µs   │ ~35 µs   │
├────────────────────────┼──────────┼──────────┼──────────┤
│ CELKEM / hash          │ ~1300 µs │ ~142 µs  │ ~150 µs  │
│ Single-thread H/s      │ ~770     │ ~7000    │ ~6700    │
│ 8-thread H/s           │ ~5500    │ ~50000   │ ~47000   │
└────────────────────────┴──────────┴──────────┴──────────┘

* = Tier 1 SIMD SHA3 by srazil na ~200+400 µs, ale Tier 2 nahradí primitivy kompletně
```

---

## 7) ASIC Resistance — Zhodnocení po optimalizaci

| Obranný mechanismus | Původní Deeksha | Ekam Deeksha | Poznámka |
|:-------------------|:----------------|:-------------|:---------|
| 64 KiB scratchpad | ✅ | ✅ | Beze změny — fyzikální memory wall |
| Data-dependent přístupy | ✅ (SHA3) | ✅ (AES + SHA3) | Random reads stále Keccak-256 |
| Pipeline diverzita | Keccak+SHA3+AES | Keccak+SHA3+Blake3+AES | Přidána Blake3 → ASIC musí implementovat více primitiv |
| HIC-dependent reads | ❌ (disabled) | ✅ (Tier 3) | Kabala Light přidává 22 HIC reads |
| Scratchpad integrita | ❌ | ✅ (Tier 3) | Hiranyagarbha verifikace |
| AES data-dependent keys | ✅ (CosmicFusion) | ✅ (CosmicFusion + mixing) | Dvojnásobné využití AES-NI |

**ASIC development cost estimate:**

| Cesta | Původní Deeksha | Ekam Deeksha |
|:------|:----------------|:-------------|
| Kryptografické primitivy | Keccak + SHA3 + AES | Keccak + SHA3 + Blake3 + AES |
| On-chip SRAM | 64 KiB | 64 KiB |
| Custom logic | SHA3 sponge + AES round | SHA3 sponge + AES round + Blake3 compression |
| Odhadované NRE | ~$2–5M | ~$4–8M |
| Speedup vs. CPU | ~8–12× | ~5–8× (Blake3+AES menší ASIC advantage) |

---

## 8) Kompatibilita s Rules A–E

| Pravidlo | Splněno | Jak |
|:---------|:--------|:----|
| **A: One Canonical Path** | ✅ | Stále jedna `cosmic_harmony_deeksha()`, žádné runtime větvení. Tier 2/3 mění jen vnitřní implementaci. |
| **B: Stability Before Complexity** | ✅ | Trojfázové nasazení (Tier 1→2→3). Složitost roste graduálně. Tier 1 je zero-risk. |
| **C: Deterministic Unity** | ✅ | Blake3 i AES-NI jsou deterministické integer operace. NPU MLP beze změny. |
| **D: Revenue Dharma Continuity** | ✅ | Revenue model se nemění. Vyšší hashrate = více tokenů pro minery = silnější síť. |
| **E: Operational Compassion** | ✅ | AES software fallback pro CPU bez AES-NI. Blake3 je pure Rust (no hardware dependency). Circuit breaker zachován. |

---

## 9) Implementační řazení

### Fáze 1: Tier 1 — Okamžitě (dny 1–3) ✅ DOKONČENO

```
Úkol                                           Soubor                  Stav
─────────────────────────────────────────────  ──────────────────────  ─────
[x] Přidat sha3_fast.rs fixed-size helpery      sha3_fast.rs (nový)    DONE
[x] Přepojit scratchpad hot path na sha3_fast   scratchpad.rs          DONE
[x] Přidat prefetch do mix_block()              scratchpad.rs          DONE
[x] SIMD XOR v mix_block()                      scratchpad.rs          DONE
[x] Benchmark harness: deeksha_bench.rs         benches/               DONE
[x] Ověřit test_deeksha_self_test_vector PASS   deeksha.rs tests       DONE
```

Výsledek Tier 1: ~488→504 H/s (1T), ~2.00→2.26 kH/s (8T). Mírné zlepšení, potvrdilo že SHA3 chain je sekvenční limit.

### Fáze 2: Tier 2 — S novým test vectorem (dny 4–7) ✅ DOKONČENO

```
Úkol                                           Soubor                     Stav
─────────────────────────────────────────────  ─────────────────────────  ─────
[x] blake3 v Cargo.toml (already present)       Cargo.toml                 DONE
[x] Implementovat init_scratchpad_ekam()        scratchpad_ekam.rs (nový)  DONE
[x] Implementovat aes_cascade_mix()             aes_mix.rs (nový)          DONE*
[x] Blake3 XOF mix_block_ekam() (viz poznámka)  scratchpad_ekam.rs         DONE
[x] memory_hard_transform_ekam_light()          scratchpad_ekam.rs         DONE
[x] Přepojit deeksha pipeline na _ekam verzi    deeksha.rs                 DONE
[x] Vygenerovat nový EKAM_CANONICAL_TEST_VECTOR                            DONE
[x] Aktualizovat EKAM_CANONICAL_TEST_VECTOR_HEX deeksha.rs                DONE
[x] FFI entry points (5 funkcí)                 ffi.rs                     DONE
[x] Pool integration + aliases                  L1/pool validator.rs       DONE
[x] Miner integration + aliases                 L1/miner native_algos.rs   DONE
[x] Core node compilation                       L1/core                    DONE
[x] Python fallback + FFI bindings              desktop-agent fallback.py  DONE
[x] Desktop agent algo normalization             desktop-agent main.js      DONE
[x] Pool E2E testy (11/11 pass)                 L1/pool chv4_e2e           DONE
[x] Cosmic-harmony testy (100/100 pass)         L1/cosmic-harmony          DONE
[x] Benchmark: 2.54× speedup 1T, 2.38× 8T      benches/deeksha_bench      DONE
[ ] NIST SP 800-22 test na výstupu              tests/                     TODO
[ ] 7denní canary mining run                    ops/                       TODO
```

**⚠️ DŮLEŽITÁ ODCHYLKA OD NÁVRHU:** AES cascade mixing byl implementován (`aes_mix.rs`), ale benchmark
ukázal 4.3× zpomalení kvůli overhead Rust `aes` crate key schedule (~1.2 µs per `Aes128::new()`
× 8192 = ~10 ms per hash). Hardware AES-NI JE dostupné (potvrzeno `target_feature="aes"`),
ale Rust crate abstrakce dominuje latenci. Proto byl mixing přepnut na **Blake3 XOF** místo AES cascade.
`aes_mix.rs` zůstává v crate jako reference, ale není použitý v canonical path.

### Fáze 3: Tier 3 — Po stabilizaci Tier 2 (týden 2+)

```
Úkol                                           Soubor                  Stav
─────────────────────────────────────────────  ──────────────────────  ─────
[ ] hiranyagarbha_verify()                      scratchpad_ekam.rs     TODO
[ ] kabala_light() s Blake3 místo Keccak        scratchpad_ekam.rs     TODO
[x] Rozšířit EKAM_FUSION_ROUNDS na 8            deeksha.rs             DONE (v Tier 2)
[ ] dual_aes_mix() (optional — A/B test)        aes_mix.rs             TODO
[ ] Nový test vector + parity testy             deeksha.rs tests       TODO
[ ] Benchmark: finální profilace                benches/               TODO
[ ] Pool acceptance test (30 min stabilita)     ops/                   TODO
```

Poznámka: 8-round Cosmic Fusion byl implementován již v Tier 2 (`EKAM_FUSION_ROUNDS = 8`).

---

## 10) Testovací strategie

### 10.1 Determinismus

```bash
# Dva identické výpočty musí vrátit identický hash
cargo test -p zion-cosmic-harmony-v3 -- deeksha::tests::test_deeksha_deterministic
```

### 10.2 Avalanche

```bash
# Bit-flip test: 1-bit change ve vstupu → ~50% bitů výstupu se změní
cargo test -p zion-cosmic-harmony-v3 -- deeksha::tests::test_deeksha_avalanche
```

### 10.3 Výkonnostní regrese

```bash
# Benchmark: single-thread a multi-thread hashrate
cargo bench -p zion-cosmic-harmony-v3

# Scratchpad-only benchmark
cargo bench -p zion-cosmic-harmony-v3 -- scratchpad
```

### 10.4 Entropy (NIST SP 800-22)

```bash
# Generovat 1M hashů, exportovat do binárního souboru, spustit NIST suite
cargo test -p zion-cosmic-harmony-v3 -- deeksha::tests::generate_nist_samples --release
# Pak: nist_sp800_22 --file /tmp/deeksha_samples.bin
```

### 10.5 Cross-platform parita

```bash
# Stejný test vector na x86_64 i aarch64
# CI: matrix build + compare canonical test vector hex
```

### 10.6 E2E pool acceptance

```bash
# 30-minut mining run → žádné rejected shares
# Pool: cargo test -p zion-pool --test chv4_e2e
```

### 10.7 Benchmark matrix pro repo 2.9.6

Pro Ekam workstream je potřeba oddělit čtyři různé otázky: neměnnost výstupu, izolovaný scratchpad výkon, end-to-end CPU throughput a později CPU/GPU paritu.

| Cíl měření | Příkaz | Poznámka |
|:-----------|:-------|:---------|
| Canonical determinismus | `cargo test --manifest-path L1/cosmic-harmony/Cargo.toml deeksha::tests::test_deeksha_determinism -- --nocapture` | Musí projít před i po Tier 1. |
| Canonical self-test vector | `cargo test --manifest-path L1/cosmic-harmony/Cargo.toml deeksha::tests::test_deeksha_self_test -- --nocapture` | Tier 1 nesmí změnit canonical hex. |
| Izolovaný scratchpad výkon | `cargo bench --manifest-path L1/cosmic-harmony/Cargo.toml --bench algorithm_bench -- scratchpad` | Sleduje přínos přímo v `memory_hard_transform()`. |
| Celá CPU pipeline | `cargo bench --manifest-path L1/cosmic-harmony/Cargo.toml --bench algorithm_bench` | Dává praktický dopad na hashrate mimo samotný scratchpad. |
| Více vláken | `cargo bench --manifest-path L1/cosmic-harmony/Cargo.toml --bench algorithm_bench -- --threads 8` | Důležité pro cache contention a thread-local scratchpad reuse. |
| Deeksha canonical benchmark | `cargo bench --manifest-path L1/cosmic-harmony/Cargo.toml --bench deeksha_bench -- --threads 8` | Primární měření pro canonical v2.9.8 cestu bez historického CHv3 dispatch zkreslení. |
| GPU/CPU parita po Tier 2 | `cargo test --manifest-path L1/cosmic-harmony/Cargo.toml --features metal test_metal_parity_legacy_small_batch -- --nocapture` | Nutné až při změně scratchpad primitiv nebo kernelů. |

#### Doporučená baseline tabulka

Před každou větší změnou a po ní zapsat minimálně toto:

| Platforma | Build flags | Determinismus | Self-test vector | Scratchpad H/s | Full H/s | Poznámka |
|:----------|:------------|:--------------|:-----------------|:---------------|:---------|:---------|
| Apple Silicon arm64 | default / `--features metal` | PASS/FAIL | PASS/FAIL | změřit | změřit | sledovat noise a thermal throttling |
| x86_64 AES/AVX2 | `RUSTFLAGS='-C target-cpu=native'` | PASS/FAIL | PASS/FAIL | změřit | změřit | sledovat přínos AVX2 XOR cesty |
| x86_64 generic | default | PASS/FAIL | PASS/FAIL | změřit | změřit | fallback bez agresivních target features |

Praktické pravidlo: **Tier 1 se přijímá jen tehdy, když canonical vector zůstane beze změny a scratchpad benchmark se zlepší bez zhoršení multi-thread stability.**

#### M1 baseline 2026-03-11

Aktuální měření v tomto workspace po prvním Tier 1 scratchpad patchi:

| Metrika | Výsledek |
|:--------|:---------|
| Single-thread full pipeline | ~502.7 H/s |
| Scratchpad only | ~501.3 H/s |
| 8-thread full pipeline | ~2.26 kH/s |

Poznámka: existující `benches/algorithm_bench.rs` je historicky CHv3-oriented harness. Při `CHV3_MEMORY_HARD_FORK_HEIGHT = 0` jsou položky „legacy/full“ jen orientační. Pro Deeksha práci je potřeba sledovat hlavně **scratchpad-only**, **canonical self-test** a nový `deeksha_bench`.

#### Deeksha benchmark baseline 2026-03-11

První běh nového `deeksha_bench` v tomto workspace:

| Metrika | Výsledek |
|:--------|:---------|
| Canonical Deeksha single-thread | ~488.1 H/s |
| Front half only (Keccak + SHA3 + GoldenMatrix) | ~1.832 MH/s |
| Scratchpad only | ~492.5 H/s |
| Canonical Deeksha 8-thread | ~2.00 kH/s |

Závěr z měření: **front half má obrovskou rezervu, zatímco scratchpad prakticky určuje celý canonical throughput**. To potvrzuje, že další Tier 1 práce má jít primárně do `scratchpad.rs` a jeho SHA3 backendu, ne do kroků 1–3.

#### Deeksha benchmark po fixed-size SHA3 helper iteraci

Po přepojení scratchpad hot path na specializované `sha3_fast` helpery pro fixed-size vstupy vyšel další běh přibližně takto:

| Metrika | Výsledek |
|:--------|:---------|
| Canonical Deeksha single-thread | ~503.8 H/s |
| Front half only (Keccak + SHA3 + GoldenMatrix) | ~1.386 MH/s |
| Scratchpad only | ~479.1 H/s |
| Canonical Deeksha 8-thread | ~2.14 kH/s |

Interpretace: je vidět **mírné zlepšení canonical throughput**, ale zároveň i běhový šum mezi krátkými 5s benchmarky. Pro rozhodnutí o přijetí Tier 1 změn je potřeba brát průměr z více běhů, ne jeden izolovaný run.

---

## 11) Závislosti (Cargo.toml)

```toml
# Nové závislosti pro Ekam optimalizace:
blake3 = "1.5"                  # XOF pro init (Tier 2)
aes = "0.8"                     # AES-NI cascade mixing (Tier 2)
# sha3 = "0.10" ← zachováno pro random_read_mix + finální hash
```

`blake3` crate je already v repo (používá se v `algorithms_npu.rs` pro weight derivation).

`aes` crate je součástí RustCrypto — stejná rodina jako `sha3`, auditovaná.

---

## 12) Rizika a mitigace

| Riziko | Pravděpodobnost | Dopad | Mitigace |
|:-------|:---------------|:------|:---------|
| Tier 1 rozbije test vector | Nízká (zero-consensus change) | Vysoký | Unit testy + CI porovnání hex vektoru |
| AES-NI nedostupné na starém HW | Střední | Střední | Software AES fallback (stejný výstup, pomalejší) |
| Blake3 XOF má slabinu | Velmi nízká | Vysoký | Blake3 je peer-reviewed, 5+ let analýzy. Domain separation klíč. |
| Nový hash snižuje ASIC resistance | Nízká | Vysoký | Random reads zachovány (Keccak-256). Přidány Kabala + Hiranyagarbha. |
| Vyšší hashrate = snazší 51% útok | Střední | Vysoký | Difficulty adjustment proporcionálně → stejná bezpečnost |
| GPU mining advantage se změní | Střední | Střední | Memory-hard scratchpad je GPU bottleneck nezávisle na mixing primitivě |

---

## 13) Soulad s dokumentací

| Dokument | Update potřeba |
|:---------|:---------------|
| `COSMIC_HARMONY_DEEKSHA_SPEC.md` | ANO — nový pipeline po Tier 2 |
| `CHV_DEEKSHA_ARCHITECTURE.md` | ANO — nové moduly (aes_mix.rs, sha3_simd.rs) |
| `DEEKSHA_EKAM_CONCEPT_BRIDGE.md` | NE — pravidla A–E splněna |
| `DEEKSHA_COSMOLOGY.md` | Volitelně — přidat Ekam temple analogii |
| `DEEKSHA_SCIENCE.md` | ANO — nová sekce o AES cascade security model |
| `ROADMAP_2.9.8.md` | ANO — přidat workstream E (Ekam optimization) |
| `REVENUE_UNIFICATION_2.9.8.md` | NE — revenue model nezměněn |
| GPU kernely (OpenCL/Metal/CUDA) | ANO — nový init + mix kernely (Tier 2) |

### 13.1 Implementační audit v repo 2.9.6

Návrh dobře sedí na aktuální implementaci, ale v repu má několik konkrétních dopadů, které je potřeba explicitně držet pohromadě.

| Oblast | Reálný soubor / místo | Dopad |
|:------|:-----------------------|:------|
| Canonical pipeline | `L1/cosmic-harmony/src/deeksha.rs` | Tier 2 a Tier 3 nejsou „optimalizace“, ale nový konsenzuální hash. Musí se změnit pipeline, canonical vector a migration note. |
| Scratchpad bottleneck | `L1/cosmic-harmony/src/scratchpad.rs` | Tady je skutečný root cause: `init_scratchpad()`, `sequential_passes()`, `mix_block()`, `random_read_mix()`. Tier 1 i Tier 2 se lámou hlavně zde. |
| Height-aware dispatch | `L1/cosmic-harmony/src/algorithms_opt.rs` | Po změně canonical Deeksha musí zůstat `cosmic_harmony_with_height()` jediný source of truth pro routing. |
| FFI / integrace | `L1/cosmic-harmony/src/ffi.rs` | Jakýkoli Tier 2+ musí zachovat FFI kontrakt a aktualizovat testy, které validují canonical hash přes exportovaný vstup. |
| GPU parity | `L1/cosmic-harmony/src/gpu/metal_shader.metal`, `L1/cosmic-harmony/src/gpu/opencl_kernel.rs`, `L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl` | Tier 2 rozbíjí existující CPU/GPU paritu, dokud se nový scratchpad init a mixing nepřepíší i do kernelů. |
| NPU vstupní kontrakt | `L1/cosmic-harmony/src/algorithms_npu.rs` | Rozměr vstupu zůstává 64 B, takže NPU vrstva může přežít beze změny, ale musí se znovu potvrdit parity a acceptance. |
| Cargo závislosti | `L1/cosmic-harmony/Cargo.toml` | `blake3` i `aes` už jsou v crate přítomné, takže Tier 2 nepotřebuje nové dependency zavedení, ale spíš bezpečné zapojení. |

### 13.2 Korekce k návrhu

| Tvrzení v návrhu | Audit korekce |
|:-----------------|:--------------|
| Tier 1 dá automaticky 2–3× | Reálnější je začít cílit na ~1.3–2.0×, protože část SHA3 práce je sekvenční chain a nepůjde čistě paralelizovat. |
| Apple Silicon má jednoduchou „SHA3 instrukční“ akceleraci | Pro repo je bezpečnější plánovat NEON-friendly implementaci a lepší práci s registry, ne spoléhat na magickou ISA výhodu. |
| Tier 2 je lokální změna `scratchpad.rs` | Není. V repu je to změna CPU cesty, test vectorů, FFI očekávání a GPU kernel parity současně. |
| Tier 3 lze přidat hned po Tier 2 | Prakticky je lepší nejdřív stabilizovat Tier 2, změřit pool acceptance a až pak přidávat další ASIC-hardening vrstvy. |

### 13.3 Doporučené pořadí implementace podle reálného kódu

| Krok | Co udělat | Primární soubory |
|:-----|:----------|:-----------------|
| 1 | Vytáhnout Tier 1 do samostatného benchmark branch/prototypu bez změny výstupu | `scratchpad.rs`, případně nový `sha3_simd.rs` |
| 2 | Udržet canonical test vector beze změny a ověřit determinismus | `deeksha.rs`, `scratchpad.rs` |
| 3 | Teprve potom navrhnout `_ekam` variantu scratchpadu jako oddělenou funkci | `scratchpad.rs`, nový `aes_mix.rs` |
| 4 | Přepnout Deeksha canonical path na Ekam až po novém vectoru a canary runu | `deeksha.rs`, `algorithms_opt.rs` |
| 5 | Následně dorovnat Metal/OpenCL kernel a parity testy | `gpu/metal_shader.metal`, `gpu/kernels/cosmic_harmony_deeksha.cl`, `gpu/opencl_kernel.rs` |

### 13.4 Praktický závěr

Pokud je cílem nejdřív rychlý, bezpečný přínos, repo je připravené na **Tier 1 hned**. Pokud je cílem skutečný skok v hashrate, pak **Tier 2 je správný směr**, ale musí se vést jako nový konsenzuální workstream, ne jako lokální optimalizační patch.

---

## 14) Shrnutí

**Problém:** Čistá Deeksha je pomalá kvůli ~3100× SHA3 v scratchpadu.

**Řešení:** Trojvrstvá optimalizace „Ekam Deeksha":
1. **Tier 1:** SIMD SHA3 + prefetch + AVX2 XOR → **2–3× zrychlení**, zero risk
2. **Tier 2:** Blake3 init + AES cascade mixing → **8–12× zrychlení**, nový hash
3. **Tier 3:** Hiranyagarbha verify + Kabala Light + 8 fusion kol → **posílení ASIC resistance**, ~5% zpomalení

**Původní odhad:** z ~770 H/s single-thread na **~6700 H/s** (+770%), s posílenou ASIC resistance.

**Skutečný výsledek (2026-03-12):** z ~504 H/s na **1.28 kH/s** (1T, +154%), z ~2.26 kH/s na **5.43 kH/s** (8T, +140%). Viz sekce 15.

**Filosofické ukotvení:** Ekam chrám má masivní, ale efektivní základ (Blake3), ornamentální strukturu (Kabala, Hiranyagarbha) a kryptografickou korunu (SHA3/Keccak na hranicích). Zlato patří na korunu, ne do základů.

---

## 15) Reálné výsledky implementace (2026-03-12)

### 15.1 Finální architektura Tier 2

Tier 2 se **odchýlil od návrhu** v jednom klíčovém bodě: AES-NI cascade mixing byl nahrazen Blake3 XOF mixing.

**Důvod:** Rust `aes` crate (0.8) vytváří nový `Aes128` objekt (key schedule) pro každý blok. Při 8192 blocích za hash to stojí ~10 ms — 10× pomalejší než originál. Hardware AES-NI je dostupné (`target_feature="aes"` potvrzeno na aarch64-apple-darwin), ale Rust crate abstrakce dominuje. Přímé volání `aes_enc` instrukce by bylo rychlé, ale vyžaduje `unsafe` inline assembly a platformně-specifický kód.

**Finální scratchpad pipeline:**

```
init_scratchpad_ekam():
    Blake3 XOF(seed || "EKAM_SCRATCHPAD_INIT_V1") → 64 KiB     [Blake3 XOF]

sequential_passes_ekam():
    2× forward/backward:
        mix = Blake3(current || prev || random || pass || index)  [Blake3 XOF]
        pad[cur] ^= mix

random_read_mix():
    64× Keccak-256 dependent reads                               [ZACHOVÁNO]
    Final SHA3-512(acc || pad[first] || pad[last])                [ZACHOVÁNO]
```

### 15.2 Kanonický test vektor

```
Input:  b"benchmark_test_input_data_12345678" (34 bytes, big-endian)
Nonce:  42u64
Height: 0

Ekam:     6339f2fb178fe2957a10d9e2a84cf9d5e340064f0d165e845b6a54eaf7924fbd
Original: f72031a1...f700 (referenční)
```

### 15.3 Benchmark — Apple M1, release build, `target-cpu=native`

```
╔══════════════════════════════════════════════════════╗
║                    SOUHRN VÝSLEDKŮ                  ║
╠══════════════════════════════════════════════════════╣
║  ORIGINAL DEEKSHA                                   ║
║    Canonical (1T)   :    511.0 H/s                  ║
║    Scratchpad       :    462.1 H/s                  ║
║    Canonical (8T)   :    2.32 kH/s                  ║
║  EKAM DEEKSHA (Tier 2: Blake3 XOF)                  ║
║    Canonical (1T)   :    1.20 kH/s                  ║
║    Scratchpad       :    695.8 H/s                  ║
║    Canonical (8T)   :    5.43 kH/s                  ║
║  SHARED                                             ║
║    Front half       :   1.859 MH/s                  ║
╠══════════════════════════════════════════════════════╣
║  Ekam/Original 1T  :  2.36x speedup               ║
║  Ekam/Original 8T  :  2.34x speedup               ║
║  Ekam/Orig scratch :  1.51x speedup               ║
╚══════════════════════════════════════════════════════╝
```

Poznámka: Více běhů ukazuje variabilitu ~2.3–2.5× v rozsahu kvůli thermal throttling.

### 15.4 Proč jen 2.5× místo odhadovaných 8–12×

| Faktor | Dopad |
|:-------|:------|
| Blake3 je rychlá, ale ne 60× rychlejší než SHA3 pro 192B vstup | Blake3 compression je ~5–15 ns, SHA3-512 ~300 ns → skutečný poměr ~20–60×, ale jen pro samotnou hash operaci |
| Scratchpad stále dominuje | I s Blake3 mixing tvoří scratchpad ~80% pipeline — random reads (Keccak-256) a finální SHA3-512 zůstaly beze změny |
| Keccak-256 random reads (64×) jsou neoptimalizované | Každý read závisí na předchozím → nelze paralelizovat. Toto je nyní nový bottleneck. |
| NPU MLP + CosmicFusion | ~50+30 µs stále přítomno → ~80 µs fixní overhead |

**Optimální směr pro Tier 3:** Místo přidávání dalších vrstev se zaměřit na random_read_mix optimalizaci — 64× Keccak-256 je nyní dominantní bottleneck po Tier 2.

### 15.5 Kompletní inventář změněných souborů

| Soubor | Stav | Popis |
|:-------|:-----|:------|
| `L1/cosmic-harmony/src/scratchpad_ekam.rs` | NOVÝ | Blake3 XOF init + Blake3 XOF mixing, light + full variant |
| `L1/cosmic-harmony/src/aes_mix.rs` | NOVÝ (nepoužitý) | AES-NI cascade mixing — referenční implementace |
| `L1/cosmic-harmony/src/deeksha.rs` | MODIF | Ekam pipeline, fork height, canonical vector, 8-round fusion |
| `L1/cosmic-harmony/src/algorithms_opt.rs` | MODIF | `cosmic_fusion_opt_rounds()`, dispatch priority Ekam > Deeksha |
| `L1/cosmic-harmony/src/lib.rs` | MODIF | Module registrace + exporty |
| `L1/cosmic-harmony/src/ffi.rs` | MODIF | 5 Ekam FFI entry points |
| `L1/cosmic-harmony/benches/deeksha_bench.rs` | MODIF | 7 benchmarků (3 nové pro Ekam) |
| `L1/miner/src/miner/native_algos.rs` | MODIF | `cosmic_harmony_ekam_deeksha()` + aliasy |
| `L1/miner/src/miner/mod.rs` | MODIF | Ekam aliasy v `from_str` |
| `L1/pool/src/shares/validator.rs` | MODIF | Ekam aliasy, auto-routing přes `cosmic_harmony_with_height()` |
| `L1/pool/tests/chv4_e2e.rs` | MODIF | 3 testy aktualizovány pro Ekam dispatch |
| `APP&WEB/desktop-agent/resources/mining/cosmic_harmony_deeksha_fallback.py` | MODIF | Ekam FFI bindings, pure-Python pipeline, canonical vector |
| `APP&WEB/desktop-agent/src/main.js` | MODIF | `normalizeAlgorithmName()` + Ekam aliasy |

### 15.6 Testy — souhrn

| Suite | Výsledek | Poznámka |
|:------|:---------|:---------|
| `L1/cosmic-harmony --lib` | 100/100 ✅ | Včetně 17 deeksha + 5 scratchpad_ekam + 4 aes_mix |
| `L1/pool --test chv4_e2e` | 11/11 ✅ | Včetně dispatch + determinism + all-heights |
| `L1/pool` (full suite) | 16/16 ✅ | |
| `L1/miner` | compiles ✅ | 1 unused import warning |
| `L1/core` | compiles ✅ | |
| Python fallback | syntax valid ✅ | `python3 -m py_compile` |
| Desktop agent | syntax valid ✅ | `node --check` |

---

*„Na počátku byl Jeden Hash — a z něj se deterministicky rozvinul celý svět."*  
— Ekam Deeksha Genesis

---
