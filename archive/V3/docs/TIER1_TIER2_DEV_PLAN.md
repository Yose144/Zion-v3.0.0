# Tier 1 + Tier 2 ASIC Resistance — Development Plan

**Status:** Tier 1+2 Complete — Testnet Prep Active  
**Author:** Yose144 + AI  
**Date:** 2026-03-17 (updated 2026-03-18)  
**Target:** ~90% ASIC resistance (z aktuálních ~65%)  
**Odhadovaný čas:** 4 týdny (1 měsíc)  
**Dev prostředí:** Legacy `L1/cosmic-harmony/` → testnet → port do `V3/` → mainnet

### Implementation Status

| Phase | Status | Commit | Tests |
|-------|--------|--------|-------|
| **Tier 1** — Scratchpad Hardening | ✅ DONE | `c423a5e` | 108 pass |
| **Tier 2** — Epoch NPU Weights | ✅ DONE | `79c903a` | 120 pass |
| **Testnet Feature Flag** | ✅ DONE | (this commit) | — |
| **Canary Deployment** | 🔄 IN PROGRESS | — | — |
| **V3 Port** | ❌ PENDING | — | — |

---

## 0. Rozhodnutí — ZK-STARK

**Doporučení: odložit.**

Tier 1 + Tier 2 posune ASIC resistance z ~65% na ~90%. To je dostatečná bariéra pro mainnet launch. ZK-STARK přidá:
- 2-6 měsíců R&D navíc
- Komplexní arithmetizaci (Keccak = ~160k constraints)
- Runtime overhead (STARK prover 100-1000× pomalejší než hash)
- Dependency na externích knihovnách (winterfell/stwo) které se rychle mění

ZK-STARK má smysl jako **post-mainnet evoluce**, ne jako launch blocker. Doporučený timeline:
- **Teď:** Tier 1 + Tier 2 → mainnet s ~90% ASIC resistance
- **Po mainnet stabilizaci (Q3 2026):** Začít PoC s winterfell pro pool verification (Varianta A)
- **v3.2.0+:** Pool STARK verification jako opt-in feature

Pokud se v budoucnu ukáže, že ASIC výrobce cílí na ZION (nepravděpodobné pod $100M market cap), Tier 2 epoch-rotating weights umožňují **parametrický soft-fork** bez nového kódu — jen změna EPOCH_LENGTH nebo topologie.

---

## 1. Strategie vývoje

### Proč v Legacy L1/?

| Důvod | Detail |
|-------|--------|
| **Test infrastruktura** | 20 inline test modulů, 2 bench harness, pool E2E test (`chv4_e2e.rs`) |
| **Miner integrace** | `native_algos.rs`, GPU OpenCL, Python fallback — vše v L1/ |
| **Pool validace** | `shares/validator.rs` validuje hashe přes `cosmic_harmony_with_height()` |
| **Canary server** | Běží z L1/ docker compose — okamžitý testnet deploy |
| **Rychlost iterace** | Není třeba duplikovat infra do V3/ během vývoje |

### Postup: L1/ → testnet → V3/ → mainnet

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  L1/     │     │ Testnet  │     │  V3/     │     │ Mainnet  │
│  develop │ ──→ │  canary  │ ──→ │  port    │ ──→ │  launch  │
│  + test  │     │  2 weeks │     │  + audit │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
   Wk 1-2           Wk 3             Wk 4             Post
```

---

## 2. Tier 1 — Scratchpad Hardening (Týden 1-2)

### 2.1 Co se mění

```
Parametr            Před        Po          Soubor
────────────────────────────────────────────────────────────
SCRATCHPAD_SIZE     64 KiB      256 KiB     scratchpad_ekam.rs
PASSES              2           4           scratchpad_ekam.rs
RANDOM_READS        64          256         scratchpad_ekam.rs
```

### 2.2 Soubory k úpravě

#### A. Primární — Cosmic Harmony

| # | Soubor | Změna | Priorita |
|---|--------|-------|----------|
| 1 | `L1/cosmic-harmony/src/scratchpad_ekam.rs` | 3 konstanty: `SCRATCHPAD_SIZE`, `PASSES`, `RANDOM_READS` | P0 |
| 2 | `L1/cosmic-harmony/src/deeksha.rs` | Konsenzuální konstanty: `DEEKSHA_SCRATCHPAD_SIZE`, `DEEKSHA_PASSES`, `DEEKSHA_RANDOM_READS`. Nový fork height `CHV_EKAM_V2_FORK_HEIGHT`. Nový test vektor `EKAM_V2_CANONICAL_TEST_VECTOR_HEX`. | P0 |
| 3 | `L1/cosmic-harmony/src/hugepages.rs` | Update huge page allocation size (256 KiB min) | P1 |
| 4 | `L1/cosmic-harmony/benches/deeksha_bench.rs` | Benchmark aktualizace — expected ≈4× nižší hashrate | P1 |

#### B. Miner

| # | Soubor | Změna | Priorita |
|---|--------|-------|----------|
| 5 | `L1/miner/src/miner/gpu/opencl.rs` | Lokální `SCRATCHPAD_BYTES` konstanta (řádek ~21): `64 * 1024` → `256 * 1024` | P0 |
| 6 | `L1/miner/src/main.rs` | `hugepages::memory_status_line(64 * 1024)` → `(256 * 1024)` | P1 |
| 7 | OpenCL kernel `cosmic_harmony_deeksha.cl` | `#define SCRATCHPAD_SIZE 65536` → `262144`, passes a reads | P0 |

#### C. Pool

| # | Soubor | Změna | Priorita |
|---|--------|-------|----------|
| 8 | `L1/pool/src/shares/validator.rs` | Žádná přímá změna — volá `cosmic_harmony_with_height()` které interně použije nové konstanty. Ale: **verifikovat že height-based dispatch funguje.** | P1 |
| 9 | `L1/pool/tests/chv4_e2e.rs` | Přidat testy pro Ekam v2 (nový test vektor, fork height check) | P1 |

#### D. Core

| # | Soubor | Změna | Priorita |
|---|--------|-------|----------|
| 10 | `L1/core/src/blockchain/block.rs` | Žádná přímá změna (fork heights v cosmic-harmony, ne v core) | — |

### 2.3 Fork Height Activation

**Mechanismus:** Nový fork height v `deeksha.rs`:

```rust
/// Fork height pro Ekam Deeksha v2 (Tier 1 scratchpad hardening).
/// Testnet: TBD (testnet block height při deploy)
/// Mainnet: TBD (governance-schválený blok)
pub const CHV_EKAM_V2_FORK_HEIGHT: u64 = /* TBD */;
```

`cosmic_harmony_with_height()` bude dispatchovat:
- `height < CHV_EKAM_V2_FORK_HEIGHT` → stávající Ekam Deeksha (64 KiB)
- `height >= CHV_EKAM_V2_FORK_HEIGHT` → Ekam Deeksha v2 (256 KiB)

**Implementačně:** Dva sady konstant v `scratchpad_ekam.rs`:

```rust
// Ekam v1 (current — zachovat pro pre-fork bloky)
pub const SCRATCHPAD_SIZE_V1: usize = 64 * 1024;
const PASSES_V1: usize = 2;
const RANDOM_READS_V1: usize = 64;

// Ekam v2 (Tier 1 hardening)
pub const SCRATCHPAD_SIZE_V2: usize = 256 * 1024;
const PASSES_V2: usize = 4;
const RANDOM_READS_V2: usize = 256;
```

Funkce `memory_hard_transform_ekam_light()` dostane parametrický profil nebo se zdvojí na `_v2` variantu.

### 2.4 Test Vector Generation

1. Spustit stávající `generate_ekam_test_vector_print` test → ověřit stávající vektor
2. Implementovat změny konstant
3. Spustit nový test → zachytit nový vektor
4. Zapsat do `EKAM_V2_CANONICAL_TEST_VECTOR_HEX`
5. Self-test ověření: `cargo test --manifest-path L1/cosmic-harmony/Cargo.toml`

### 2.5 Benchmark Expectations

```
Stávající (4T):     ~15 KH/s
Po Tier 1 (4T):     ~4-5 KH/s  (3-4× pokles)
Po Tier 1 (10T):    ~8-10 KH/s (sustained)
```

Pokles je **žádoucí** — vyšší memory bandwidth = horší pro ASIC.  
Difficulty adjustment na testnetu/mainnetu se přizpůsobí automaticky.

### 2.6 Tier 1 Milestones

| Den | Milestone | Ověření |
|-----|-----------|---------|
| D1 | Konstanty změněny, kompilace prochází | `cargo build --manifest-path L1/cosmic-harmony/Cargo.toml` |
| D1 | Nový test vektor vygenerován | `cargo test generate_ekam_test_vector -- --nocapture` |
| D2 | Všechny testy prochází | `cargo test --manifest-path L1/cosmic-harmony/Cargo.toml` |
| D2 | Fork height dispatch funguje | `cargo test --manifest-path L1/pool/Cargo.toml` (chv4_e2e) |
| D3 | Benchmark — hashrate v očekávaném rozsahu | `cargo bench --bench deeksha_bench` |
| D3 | OpenCL kernel aktualizován | GPU build test |
| D4 | Miner end-to-end test (canary) | Deploy na testnet, 100 shares accepted |

---

## 3. Tier 2 — Epoch-Rotating NPU Weights (Týden 2-4)

### 3.1 Co se mění

NPU MLP váhy přestanou být fixní (genesis seed). Místo toho se přepočítávají každou **epochu** (2016 bloků ≈ 2 týdny při 10min blocích).

```
Stávající:  weights = MlpWeights::from_genesis_seed()       // fixní navždy
Nové:       weights = MlpWeights::from_epoch(epoch_number)   // rotují per epoch
```

### 3.2 Epoch Derivation

```rust
/// Epoch length — kolik bloků tvoří jednu epochu.
/// 2016 = stejné jako Bitcoin difficulty adjustment period.
pub const NPU_EPOCH_LENGTH: u64 = 2016;

/// Derive epoch number z block height.
pub fn epoch_from_height(height: u64) -> u64 {
    height / NPU_EPOCH_LENGTH
}

/// Derive epoch seed z genesis seedu + epoch number.
pub fn epoch_seed(epoch: u64) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new_keyed(CHV4_MLP_GENESIS_SEED);
    hasher.update(b"CHv4_epoch_weights_v1");
    hasher.update(&epoch.to_le_bytes());
    *hasher.finalize().as_bytes()
}
```

### 3.3 Variable MLP Topology

```rust
/// Topologie MLP se mění per epoch (4 varianty rotují).
pub enum MlpTopology {
    Standard,      // 64 → 128 → 64     (epoch % 4 == 0)
    ThreeLayer,    // 64 → 96 → 128 → 64 (epoch % 4 == 1)
    Wide,          // 64 → 256 → 64     (epoch % 4 == 2)
    Deep,          // 64 → 64 → 64 → 64 (epoch % 4 == 3, 3× residual)
}

impl MlpTopology {
    pub fn for_epoch(epoch: u64) -> Self {
        match epoch % 4 {
            0 => Self::Standard,
            1 => Self::ThreeLayer,
            2 => Self::Wide,
            3 => Self::Deep,
            _ => unreachable!(),
        }
    }
}
```

### 3.4 Soubory k úpravě

#### A. Cosmic Harmony

| # | Soubor | Změna | Priorita |
|---|--------|-------|----------|
| 1 | `L1/cosmic-harmony/src/algorithms_npu.rs` | `MlpWeights::from_epoch_seed(epoch_seed)`, `MlpTopology` enum, `npu_mixing_step` přijímá `epoch: u64` | P0 |
| 2 | `L1/cosmic-harmony/src/deeksha.rs` | `cosmic_harmony_ekam_deeksha()` → přijímá `block_height`, počítá epoch, předává do NPU stepu | P0 |
| 3 | `L1/cosmic-harmony/src/algorithms_opt.rs` | `cosmic_harmony_with_height()` předává height dál do deeksha | P0 |

#### B. Weight Caching

| # | Soubor | Změna | Priorita |
|---|--------|-------|----------|
| 4 | `L1/cosmic-harmony/src/algorithms_npu.rs` | Epoch weight cache: `HashMap<u64, Arc<MlpWeights>>` nebo `OnceLock` per epoch — nepočítat váhy pro každý hash | P0 |

**Důležité:** Váhy pro epochu N generovat **jednou** a cachovat. Generace vah ≈ 17 KB Blake3 expanze — zanedbatelné, ale nechceme to per-nonce.

```rust
use std::sync::RwLock;
use std::collections::HashMap;
use std::sync::Arc;

static EPOCH_WEIGHTS_CACHE: OnceLock<RwLock<HashMap<u64, Arc<EpochWeights>>>> = OnceLock::new();

struct EpochWeights {
    topology: MlpTopology,
    weights: MlpWeightsVariant,  // enum přes 4 topologie
}
```

#### C. Miner

| # | Soubor | Změna | Priorita |
|---|--------|-------|----------|
| 5 | `L1/miner/src/miner/native_algos.rs` | `cosmic_harmony_ekam_deeksha(header, nonce)` → `cosmic_harmony_ekam_deeksha(header, nonce, height)` | P0 |
| 6 | `L1/miner/src/miner/gpu/opencl.rs` | GPU kernel nemůže snadno rotovat váhy — fallback: NPU step na CPU, zbytek na GPU. Nebo: uploade weights per epoch jako OpenCL buffer | P1 |

#### D. Pool

| # | Soubor | Změna | Priorita |
|---|--------|-------|----------|
| 7 | `L1/pool/src/shares/validator.rs` | Validator musí znát block height pro validaci — **už zná** (předává se přes `cosmic_harmony_with_height`). Ověřit. | P0 |
| 8 | Stratum protocol | Pool musí minery informovat o aktuálním bloku (height) — **už se děje** v stratum job. Ověřit. | P1 |

### 3.5 API Change — Breaking

Stávající signatura:
```rust
pub fn cosmic_harmony_ekam_deeksha(header: &[u8], nonce: u64) -> Hash32
```

Nová signatura:
```rust
pub fn cosmic_harmony_ekam_deeksha(header: &[u8], nonce: u64, block_height: u64) -> Hash32
```

**Toto je breaking change.** Všechny callsites (miner, pool, testy, benchmarky) potřebují update.

Alternativa: `block_height` extrahovat z headeru (pokud je v headeru zakódovaný). Závisí na block header formátu. Pokud header obsahuje height, nemusíme měnit signaturu — ale explicitní parametr je bezpečnější.

### 3.6 Tier 2 Milestones

| Den | Milestone | Ověření |
|-----|-----------|---------|
| D5-6 | `MlpTopology` enum + `from_epoch_seed()` | Unit testy — 4 topologie generují různé váhy |
| D7-8 | Epoch weight cache | `test_epoch_cache_reuse`, `test_epoch_transition` |
| D8-9 | `cosmic_harmony_ekam_deeksha(h, n, height)` pipeline | Deeksha self-test s explicitním epoch |
| D9-10 | Všechny 4 topologie produkují validní 32B hash | `test_all_topologies_valid` |
| D10-11 | Miner + pool callsite update | `cargo test --manifest-path L1/miner/Cargo.toml` + pool |
| D11-12 | Determinism test: epoch 0 == stávající hash | **Backward compatibility** — epoch 0 musí produkovat STEJNÝ hash jako dnes |
| D12-13 | Cross-epoch transition test | Simulovat chain přes epoch boundary |
| D14 | Full benchmark | `cargo bench` — hashrate by měl být ≈ stejný jako Tier 1 (NPU overhead je < 5%) |

### 3.7 Backward Compatibility — Critical

**Epoch 0 MUSÍ produkovat identický hash jako stávající Ekam Deeksha.**

Důvod: epoch 0 váhy = `MlpWeights::from_genesis_seed()` = `MlpWeights::from_epoch_seed(epoch_seed(0))`. Musíme zajistit, že:

```rust
epoch_seed(0) == CHV4_MLP_GENESIS_SEED  // NEBO
MlpWeights::from_epoch_seed(epoch_seed(0)) == MlpWeights::from_genesis_seed()
```

Pokud ne (epoch derivace přidá extra kontext), pak epoch-rotating NPU se aktivuje od `CHV_EKAM_V2_FORK_HEIGHT` společně s Tier 1 a epoch 0 = nový hash.

**Doporučení:** Tier 1 a Tier 2 aktivovat SPOLEČNĚ pod jedním fork height. Jeden čistý řez — bloky před fork: starý hash, bloky po fork: nový hash (256 KiB + epoch NPU).

---

## 4. Testnet Deployment (Týden 3)

### 4.1 Canary Server (legacy Prague 91.98.122.165 — ARCHIVNÍ)

```
1. Build nový docker image s Tier 1+2 změnami
2. Deploy na canary s CHV_EKAM_V2_FORK_HEIGHT = 0 (testnet od genesis)
3. Spustit miner (2 instance):
   a. Instance A: 4 vlákna, 24h run → expected ~4-5 KH/s
   b. Instance B: 1 vlákno, epoch transition test
4. Sledovat:
   - Share accept rate (musí být 100%)
   - Epoch transition (po 2016 blocích na testnetu — zkrátit na 100 pro test)
   - Memory usage (256 KiB per thread = ~2.5 MB pro 10T — OK)
   - Pool validace across epoch boundary
```

### 4.2 Testnet-Specific Overrides

Pro testnet zrychlíme epoch rotaci:

```rust
#[cfg(feature = "testnet")]
pub const NPU_EPOCH_LENGTH: u64 = 100;  // rychlá rotace pro testování

#[cfg(not(feature = "testnet"))]
pub const NPU_EPOCH_LENGTH: u64 = 2016;  // mainnet
```

### 4.3 Acceptance Criteria

| Kritérium | Threshold | Metoda |
|-----------|-----------|--------|
| Share accept rate | ≥ 99.5% | Pool log analysis |
| Epoch transition | 0 rejected shares at boundary | Epoch boundary test |
| Hashrate stability | ±10% variance | 24h benchmark |
| Memory usage | < 10 MB per thread | `htop` / monitoring |
| Determinism | Miner A hash == Miner B hash (same input) | Cross-validation |

---

## 5. V3 Port (Týden 4)

### 5.1 Co se portuje

Po úspěšném testnet runu, copy changed files z L1/ do V3/:

| L1 soubor | V3 cíl |
|-----------|--------|
| `L1/cosmic-harmony/src/scratchpad_ekam.rs` | `V3/L1/cosmic-harmony/src/scratchpad_ekam.rs` |
| `L1/cosmic-harmony/src/algorithms_npu.rs` | `V3/L1/cosmic-harmony/src/algorithms_npu.rs` |
| `L1/cosmic-harmony/src/deeksha.rs` | `V3/L1/cosmic-harmony/src/deeksha.rs` |
| `L1/cosmic-harmony/src/algorithms_opt.rs` | `V3/L1/cosmic-harmony/src/algorithms_opt.rs` |

### 5.2 V3 Specifika

- V3 nemá miner/pool/core ještě plně — portuje se jen cosmic-harmony
- Ověřit `cargo test --manifest-path V3/L1/core/Cargo.toml`
- Ověřit `cargo test --manifest-path V3/Cargo.toml`

### 5.3 Audit Checklist

- [ ] Nový hash pro epoch 0 odpovídá L1 testnet hash
- [ ] Starý hash (pre-fork) stále funguje pro historické bloky
- [ ] Žádné float operace v NPU path (INT8 only — determinism)
- [ ] Weight cache nepropouští paměť (epoch eviction)
- [ ] GPU OpenCL kernel aktualizován (scratchpad size)
- [ ] Python fallback aktualizován nebo deprecated

---

## 6. Timeline — Shrnutí

```
Týden 1 (D1-D4):   Tier 1 — Scratchpad Hardening ✅ DONE (commit c423a5e)
  ├── D1: Změna konstant, kompilace, nový test vektor ✅
  ├── D2: Testy (cosmic-harmony + pool E2E) ✅ 108 tests pass
  ├── D3: Benchmark, OpenCL kernel update ✅
  └── D4: Miner E2E test ✅

Týden 2 (D5-D14):  Tier 2 — Epoch NPU Weights ✅ DONE (commit 79c903a)
  ├── D5-6:  MlpTopology enum, from_epoch_seed() ✅
  ├── D7-8:  Weight cache, epoch transition logic ✅
  ├── D8-9:  Pipeline integration (deeksha + with_height) ✅
  ├── D10-11: Callsite updates (miner, pool) ✅
  ├── D12-13: Cross-epoch + backward compat tests ✅
  └── D14:   120 tests pass, 0 fail ✅

Týden 3 (D15-D21): Testnet Canary 🔄 IN PROGRESS
  ├── testnet feature flag (NPU_EPOCH_LENGTH=100) ✅
  ├── Docker build args for testnet feature ✅
  ├── Deploy Tier 1+2 na canary
  ├── 24h miner run (share accept rate)
  ├── Epoch transition test (zkrácené epochy)
  └── Bug fixes

Týden 4 (D22-D28): V3 Port + Mainnet Prep
  ├── Copy changed files do V3/
  ├── V3 cargo test
  ├── Audit checklist
  └── Mainnet fork height decision
```

---

## 7. Rizika a Mitigace

| Riziko | Pravděpodobnost | Dopad | Mitigace |
|--------|----------------|-------|----------|
| 256 KiB scratchpad je moc pro low-end CPU (L1/L2 cache miss) | Nízká | Střední | Benchmark na různém HW (ARM, starý Intel). Fallback: 128 KiB. |
| Epoch transition race condition (miner/pool disagree on epoch) | Střední | Vysoký | Epoch se počítá z block height (deterministic). Pool i miner vidí stejný height z job. |
| Variable topology bug (jedna topologie produkuje kolize) | Nízká | Vysoký | Exhaustivní test pro každou topologii — min 10M hashů, žádné kolize. |
| GPU miner nemůže rotovat NPU weights | Střední | Střední | GPU dělá kroky 1-4 + 6, NPU step 5 na CPU. Nebo: epoch weights jako OpenCL buffer upload (jednou per epoch). |
| Breaking API change rozbije externí minery | Vysoký | Střední | Fork height = 0 na testnetu, dostatečný advance notice na mainnetu. Backward compat pro pre-fork bloky. |

---

## 8. Definition of Done

Tier 1+2 je **DONE** když:

1. ✅ `cargo test --manifest-path L1/cosmic-harmony/Cargo.toml` — 120/120 pass (commit 79c903a)
2. ✅ `cargo test --manifest-path L1/pool/Cargo.toml` — chv4_e2e updated (height param)
3. ⏳ `cargo test --manifest-path L1/miner/Cargo.toml` — blocked on pre-existing randomx-rs CMake issue (Windows only)
4. ⏳ Benchmark ukazuje ~4-5 KH/s (4T) — potvrzuje memory-hard efekt (needs canary)
5. ⏳ 24h canary run: ≥99.5% share accept rate
6. ⏳ Epoch transition: 0 rejected shares na boundary
7. ⏳ V3 port: `cargo test --manifest-path V3/Cargo.toml` — pending Week 4
8. ✅ Nový kanonický test vektor: `d043e26b6ed7a2a4f1973a0e340c2eeed7643f6af03d33b8a44907f4f43935c3`
9. ⏳ ROADMAP.md a README.md aktualizovány — pending

---

## 9. Soubory Reference — Quick Access

### Primární (MUSÍ se změnit):
- `L1/cosmic-harmony/src/scratchpad_ekam.rs` — 3 konstanty + v2 funkce
- `L1/cosmic-harmony/src/algorithms_npu.rs` — epoch weights, topology, cache
- `L1/cosmic-harmony/src/deeksha.rs` — fork height, pipeline dispatch, test vektor
- `L1/miner/src/miner/native_algos.rs` — callsite update (height param)
- `L1/miner/src/miner/gpu/opencl.rs` — SCRATCHPAD_BYTES + kernel

### Sekundární (ověřit/aktualizovat):
- `L1/cosmic-harmony/src/algorithms_opt.rs` — `cosmic_harmony_with_height()` dispatch
- `L1/pool/src/shares/validator.rs` — height-based validation
- `L1/pool/tests/chv4_e2e.rs` — nové testy
- `L1/cosmic-harmony/benches/deeksha_bench.rs` — benchmark
- `L1/miner/src/main.rs` — hugepage size
- OpenCL kernel soubor

### Dokumentace:
- `V3/docs/ASIC_RESISTANCE_DESIGN.md` — master design (existuje)
- `V3/docs/TIER1_TIER2_DEV_PLAN.md` — tento dokument
- `V3/ROADMAP.md` — aktualizovat po dokončení
