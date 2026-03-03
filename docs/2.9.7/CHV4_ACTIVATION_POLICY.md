# CHv4 Activation Policy — ZION TerraNova v2.9.7

> **Status:** ✅ FINALIZED — 2026-03-03  
> **Platí pro:** MainNet genesis → trvalá platnost  
> **Canonical reference:** tento dokument (`docs/2.9.7/CHV4_ACTIVATION_POLICY.md`)  
> **Implementace:** `L1/cosmic-harmony/src/algorithms_npu.rs`, `algorithms_opt.rs`  
> **Konfigurace:** `L1/core/src/blockchain/block.rs::Algorithm::CosmicHarmony` dispatch  
> **Report:** `docs/CHV4_IMPLEMENTATION_REPORT.md`

---

## 1. Shrnutí

CHv4 (CosmicHarmony v4) je vertikální upgrade uvnitř jediného mainnet PoW algoritmu CosmicHarmony.  
Přidává **deterministický INT8 MLP (NPU Mixing Step)** mezi MemoryHard a CosmicFusion fáze.  
Aktivace je **plně hardcoded** v konsensuální konstantě — nevyžaduje governance hlasování po spuštění.

---

## 2. Výšková politika (fork-height schedule)

> **Update 2026-03-03:** CHv4 aktivní od genesis. `CHV4_NPU_FORK_HEIGHT = 0` FROZEN.

| Výška bloků | Algoritmus | Popis |
|-------------|------------|-------|
| **0 → ∞** | **CHv4** (aktivní od genesis) | memory-hard scratchpad + NPU Mixing Step (INT8 MLP 64→128→64 + residual) |

Konstanty v kódu:
```rust
// L1/cosmic-harmony/src/algorithms_npu.rs
pub const CHV4_NPU_FORK_HEIGHT: u64 = 0;  // CHv4 aktivní od genesis (2026-03-03)
pub const CHV4_MLP_GENESIS_SEED: &[u8; 32] = b"ZION_CHv4_mixing_v1_genesis_seed";

// L1/cosmic-harmony/src/algorithms_opt.rs
pub const CHV3_MEMORY_HARD_FORK_HEIGHT: u64 = 0;  // memory-hard od genesis

// L1/core/src/blockchain/block.rs
// cosmic_harmony_with_height() → CHv4 pro všechny výšky (≥ 0)
```

**Fork height je FROZEN na 0** (aktivní od genesis, 2026-03-03) — změna vyžaduje:
1. Nový governance návrh v `docs/mainnet/MAINNET_CONSTITUTION.md`
2. Dva nezávislé podpisy (Lead Dev + Infra)
3. Patch release s novým fork height + chain reset

---

## 3. Rollout pravidla

### 3.1 Rollout (nody)
CHv4 je hardcoded od genesis — žádný postupný rollout potřeba.  
Všechny nody od genesis (blok 0) používají CHv4; není zpětně kompatibilní s hypotetickým starším chainem.

### 3.2 Pool
Pool validuje shares přes `cosmic_harmony_with_height()` — CHv4 pro všechny výšky (≥ 0).  
žádná height-based větev — vždy CHv4 path.

### 3.3 Miner
Minéř má vždy `chv4=1` a `memory_hard=1` — výška nerozhoduje.  
Kernel (CUDA/OpenCL/Python GPU) dostane flag `chv4=1` pro každý job bez ohledu na height.

### 3.4 Nouzový rollback
Pokud by CHv4 způsobil síťovou nestabilitu:
- Nastavit `CHV4_NPU_FORK_HEIGHT` na velkou hodnotu (patch release + chain reset)
- Nouzový: `--disable-chv4` flag (runtime override, pouze pro emergency)

---

## 4. Testování před aktivací

### 4.1 Unit testy (DONE ✅)
- 8/8 NPU unit testů OK — `cargo test -p zion-cosmic-harmony-v3 -- npu`
- Deterministické testy (identický output CPU vs. CPU, různé threadsafe paths)
- Residual connection test, fallback test, genesis seed expansion test

### 4.2 E2E production run (B-CRIT-01 zbývající)
- [ ] Spustit integrační test syncem s mock height ≥ 200 000 (testnet nebo simulace)
- [ ] Ověřit: pool přijímá CHv4 sdílenky od výšky 200k; core node validuje CHv4 bloky
- [ ] Logy: žádné `invalid hash`, `chain divergence` incidenty po simulaci výšky 200k

### 4.3 Acceptance kritéria E2E
- Pool: 100% share acceptance rate u CHv4 sdílenek (testovací minery s ZSTRESS adresami)
- Core: block validation OK pro uměle vytvořené CHv4 bloky
- Latency: p99 hash time < 1 000ms (benchmark: CHv4 je ~3x pomalejší než CHv3 na CPU)

---

## 5. Governance sign-off

Fork height je **finální** (rozhodnutí Lead Dev 2026-03-03 — bez veřejného governance hlasování):

| Role | Rozhodnutí | Datum |
|------|-----------|-------|
| Lead Dev | `CHV4_NPU_FORK_HEIGHT = 0` — CHv4 od genesis CONFIRMED | 2026-03-03 |
| Infra | Protocol kompatibilní — pool/core/miner otestovány, chain reset proveden | 2026-03-03 |

**Odůvodnění volby výšky 0 (od genesis):**
- Žádný hard-fork risk — všichni nody startují se stejným algoritmem
- Žádná přechodová fáze — není třeba spravovat CHv3/CHv4 legacy větve
- Nový genesis hash `bacd6027` generován 2026-03-03 — čistý start s CHv4

---

## 6. Technická specifikace NPU Mixing Step

```
Input:  64-byte tensor (výstup MemoryHard Phase 4)
│
├── INT8 квантizace: každý byte interpretován jako INT8 [-128, 127]
│
├── Linear(64→128): váhy W1[128×64] + bias b1[128], generovány z CHV4_MLP_GENESIS_SEED
│   + LayerNorm(128) + GELU
│
├── Linear(128→64): váhy W2[64×128] + bias b2[64]
│   + LayerNorm(64)
│
├── Residual add: out += input (64 bytes)
│
└── Output: 64-byte tensor → předán CosmicFusion (Phase 6)
```

**Deterministický v každém prostředí:**
- Váhy jsou FROZEN genesis seedem — nemohou být měněny za runtime
- INT8 integer aritmetika — žádná floating point divergence
- Identický výsledek: ARM NEON / x86 AVX2 / RISC-V scalar / WebAssembly

---

## 7. Souvisící soubory

| Soubor | Popis |
|--------|-------|
| `L1/cosmic-harmony/src/algorithms_npu.rs` | NPU Mixing Step, konstanta CHV4_NPU_FORK_HEIGHT |
| `L1/cosmic-harmony/src/algorithms_opt.rs` | `cosmic_harmony_with_height()`, `cosmic_harmony_v4()` |
| `L1/core/src/blockchain/block.rs` | Dispatch na height-aware hasher (B-CRIT-01 fix) |
| `docs/CHV4_IMPLEMENTATION_REPORT.md` | Implementační report (2026-03-01) |
| `docs/COSMIC_HARMONY_V4_UPGRADE_CS.md` | Původní design document |
| `docs/2.9.7/MAINNET_READINESS_UNIFIED.md` | B-CRIT-01 tracking |
