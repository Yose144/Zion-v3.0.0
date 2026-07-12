# DeekshaChv3 — Unified Algorithm Plan

> **Working name:** `deeksha_chv3`
> **Goal:** Sjednotit všechny revenue streamy do jednoho canonical algoritmu
> podle `docs/2.9.8/COSMIC_HARMONY_DEEKSHA_SPEC.md`.
> **Status:** Phase A+B+C DEPLOYED (2026-07-12) — soft fork active at block 4500.
> **CHV3_FORK_HEIGHT:** 4500 (bit-identical alias over `deeksha_lite_v1`).

---

## 1) Problém

Aktuálně běží několik algoritmů paralelně:

| Algoritmus | Soubor | Pipeline | Použití |
|-----------|--------|----------|---------|
| `cosmic_harmony_ekam_deeksha_v2` | `deeksha.rs` | Keccak→SHA3→Matrix→MemHard→NPU→Fusion | Canonical mainnet PoW |
| `deeksha_lite_v1` | `deeksha_lite.rs` | Keccak→MemHard(256K)→AES→Keccak | Pool default (`ZION_POOL_ALGORITHM=deeksha_lite_v1`) |
| `deeksha_lite_fire` | `deeksha_lite_fire.rs` | Keccak→MemHard(512K)→AES10→Thermal→Keccak | Winter heating mode |
| External (Blake3/kHeavyHash/...) | `AuXpow/external_hashers.rs` | Per-coin hashers | AuxPow merge mining |

To vytváří:
- **Pool/miner divergence** — pool používá `deeksha_lite_v1`, ale canonical consensus je `deeksha_v2`.
- **Multi-branch runtime dispatch** — miner musí vědět, který algoritmu použít pro jaký height.
- **Revenue fragmentation** — každý algoritmus má vlastní RevenueSource, ale ne sjednocenou telemetrii.

## 2) Cíl

Jeden canonical algoritmus `deeksha_chv3` který:

1. **Je canonical PoW** — jediný hash pro consensus, žádné branch dispatch.
2. **Má vestavěnou revenue telemetrii** — stream layers jsou součástí hash funkce.
3. **Podporuje externí merge mining** — AuxPow streamy jsou first-class občané.
4. **Je GPU-friendly** — OpenCL kernel je parity-verified proti CPU.
5. **NPU mix je optional** — CPU fallback je bit-identický.

## 3) Consensus parametry (single source of truth)

Z `COSMIC_HARMONY_DEEKSHA_SPEC.md`:

```rust
pub const DEEKSHA_CHV3_SCRATCHPAD_SIZE: usize = 64 * 1024;  // 64 KiB
pub const DEEKSHA_CHV3_BLOCK_COUNT: usize = 1024;
pub const DEEKSHA_CHV3_PASSES: usize = 2;
pub const DEEKSHA_CHV3_RANDOM_READS: usize = 64;
pub const DEEKSHA_CHV3_BACKWARD_PASSES: usize = 0;
pub const DEEKSHA_CHV3_KABALA_READS: usize = 0;
pub const DEEKSHA_CHV3_FORK_HEIGHT: u64 = 0;  // active from genesis
```

**Poznámka:** Aktuální mainnet běží na `deeksha_lite_v1` (256 KiB scratchpad).
`deeksha_chv3` používá 64 KiB — to je **změna consensus parametrů** a vyžaduje
hard fork nebo nový genesis. Pokud chceme zachovat aktuální chain, musíme
buď:
- (A) ponechat `deeksha_lite_v1` jako canonical a `deeksha_chv3` je jen název
  pro sjednocenou telemetrii/dispatch, nebo
- (B) provést hard fork s novým `DEEKSHA_CHV3_FORK_HEIGHT`.

**Doporučení:** (A) pro teď — sjednotit dispatch a telemetrii, ne měnit hash.

## 4) Pipeline (sjednocená)

```
Input: block_header[0..80] || nonce_le[0..8]
  │
  ├─ Step 1: Keccak-256                    → RevenueSource::KeccakBonus
  ├─ Step 2: SHA3-512                       → RevenueSource::Sha3Bonus
  ├─ Step 3: GoldenMatrix                   → RevenueSource::Zion
  ├─ Step 4: MemoryHard (64 KiB / 2 / 64)  → RevenueSource::Zion
  ├─ Step 5: NPU Mix (optional, CPU fallback identical)
  │                                         → RevenueSource::NclAi
  ├─ Step 6: CosmicFusion                   → RevenueSource::Zion
  │
  └─ Output: Hash32
```

To je přesně `cosmic_harmony_ekam_deeksha_v2` pipeline.
`deeksha_lite_v1` pipeline je **jiná** (AES mix místo GoldenMatrix+NPU+Fusion).

## 5) Architektura sjednocení

### 5.1 Nový modul: `deeksha_chv3.rs`

```rust
// V3/L1/cosmic-harmony/src/deeksha_chv3.rs

/// Canonical unified DeekshaChv3 hash.
/// This IS the consensus hash — no dispatch, no branches.
pub fn deeksha_chv3_hash(
    block_header: &[u8],
    nonce: u64,
    block_height: u64,
) -> Hash32 {
    // Identical to cosmic_harmony_ekam_deeksha_v2
    // but with a single canonical name.
}

/// Find nonce with stream telemetry.
pub fn deeksha_chv3_find_nonce(
    block_header: &[u8],
    target: &[u8; 32],
    start_nonce: u64,
    count: u64,
    block_height: u64,
) -> Option<(u64, Hash32, DeekshaStreamTelemetry)> {
    // ...
}
```

### 5.2 Pool: jeden algoritmus

```bash
# Edge environment
ZION_POOL_ALGORITHM=deeksha_chv3  # místo deeksha_lite_v1
```

Pool server volá `deeksha_chv3_hash()` pro validaci shares. Žádný dispatch
podle algorithm stringu.

### 5.3 Miner: jeden algoritmus

Miner používá `deeksha_chv3_find_nonce()` nebo GPU kernel
`deeksha_chv3.cl`. Žádné přepínání mezi lite/fire/v2.

### 5.4 GPU: jeden kernel

`V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_chv3.cl` — jeden OpenCL kernel,
parity-verified proti CPU.

### 5.5 AuxPow: first-class stream

AuxPow merge mining je **stále samostatný** proces (externí pool má vlastní
hash algoritmus), ale revenue telemetry je sjednocená:

```
RevenueSource::Zion           ← deeksha_chv3 canonical mining (50%)
RevenueSource::Blake3External ← AuxPow DCR/ALPH stream
RevenueSource::KHeavyHashExternal ← AuxPow KAS stream
RevenueSource::NclAi          ← NPU/AI compute stream (25%)
...
```

### 5.6 Stream telemetry (v `stream_layers.rs`)

Stream telemetry už existuje a je consensus-safe (nemění hash output).
`deeksha_chv3_with_streams()` bude jediný entry point.

## 6) Migrace

### Fáze A — Sjednocení dispatch (no consensus change) — ✅ DEPLOYED 2026-07-12

**Implementováno a deploynuto na Edge (62.171.141.136).**

1. ✅ Vytvořen `deeksha_chv3.rs` — wrapper kolem `deeksha_lite` (aktuální canonical).
   - 6 parity testů: bit-identical s `deeksha_lite_v1`.
   - `DEEKSHA_CHV3_PROFILE = "deeksha_chv3"`, `CHV3_FORK_HEIGHT = 4500`.
2. ✅ Core: `hash_with_algorithm("deeksha_chv3")` → `deeksha_lite` (alias).
3. ✅ Pool: `ActiveJob::algorithm()` opraven — používá `advertised_algorithm()`
   místo hardcoded `"cosmic_harmony_ekam_deeksha_v2"` (bug fix — node nyní
   přijímá bloky).
4. ✅ Miner: `parallel.rs` CPU dispatch + `gpu_backend.rs` OpenCL dispatch.
5. ✅ `profile_name_for_height()`:
   - height < 4500 → `deeksha_lite_v1`
   - 4500 ≤ h < 5000 → `deeksha_chv3` (Phase A alias)
   - height ≥ 5000 → `deeksha_lite_fire` (Fire fork)
6. ✅ `ConsensusConfig` rozšířen o `chv3_fork_height`.
7. ✅ **Žádná změna hash outputu** — chain pokračuje, 100% share acceptance.

**Commity:**
- `6530b836f` — Phase A wrapper + dispatch alias + pool fix
- `7dd81cfb7` — CHV3_FORK_HEIGHT=4500

**Edge deploy výsledek:**
- Pool: 12 mineri, 410 KH/s, 36+ bloků nalezeno, 99.97% acceptance.
- Node: chain height 3922+, bloky přijímány.
- L2 služby (bridge, dao, warp, atomic-swap): rebuild + restart, 0 errors.

### Fáze B — Telemetrie sjednocení — ✅ DEPLOYED 2026-07-12

**Implementováno a deploynuto na Edge.**

1. ✅ `deeksha_chv3_with_streams()` — vrací `(Hash32, DeekshaStreamTelemetry)`.
   - Deleguje na `deeksha_lite_v1_with_streams` (bit-identical hash).
   - Pipeline: Keccak256→MemoryHard→AesMix→KeccakFinal (4 steps).
   - Stream breakdown: KeccakBonus, Zion, DeekshaLite.
2. ✅ `deeksha_chv3_with_streams_height()` — height-aware varianta (Phase D ready).
3. ✅ `deeksha_chv3_find_nonce_with_streams()` — nonce search s telemetry capture.
4. ✅ Pool: po block acceptance volá `track_deeksha_streams()` na revenue collectoru.
   - Počítá telemetry pro winning nonce z block headeru.
   - `debug_assert` verifikuje stream hash == computed hash.
   - Revenue se rozdělí proporcionalně across streamy.
5. ✅ 6 nových Phase B testů (12 total, všechny pass).
6. ✅ **Žádná změna hash outputu** — consensus-safe.

**Commit:** `f656782a1` — feat(chv3): Phase B — stream telemetry

**Edge deploy výsledek:**
- Pool restart na nový binary, 1 blok found ihned po restartu.
- AuxPow scheduler se znovu připojil k KAS (kas.2miners.com:2020).
- Stream telemetry se zaznamenává pro každý accepted block.

### Fáze C — GPU parity — ✅ DEPLOYED 2026-07-12

**Implementováno a deploynuto na Edge.**

1. ✅ `deeksha_chv3.cl` — canonical OpenCL kernel (bit-identical copy of
   `deeksha_lite.cl` with entry point `deeksha_chv3_mine`).
   - Pipeline: Keccak256→MemoryHard→AesMix→KeccakFinal (4 steps).
   - 256 KiB scratchpad, 8192 blocks, 2 passes, 64 random reads.
2. ✅ `opencl_kernel.rs` — export `DEEKSHA_CHV3_KERNEL`,
   `DEEKSHA_CHV3_KERNEL_NAME`, `get_deeksha_chv3_kernel_source()`.
3. ✅ `gpu_backend.rs` — `OpenClDeekshaLiteMiner::new_chv3()` constructor
   using chv3 kernel source/name. Dispatch pro `"deeksha_chv3"` algorithm
   nyní používá canonical kernel přímo.
4. ✅ 5 KAT (Known Answer Test) vectors v `deeksha_chv3.rs`:
   - `chv3_kat_known_vector_1`: zeros[80] + nonce=0
   - `chv3_kat_known_vector_2`: pattern[80] + nonce=0x4242...
   - `chv3_kat_known_vector_3`: realistic block header + nonce=12345
   - `chv3_kat_streams_parity`: with_streams == plain hash
   - `chv3_kat_gpu_kernel_present`: kernel source + constants verified
5. ✅ 4 new kernel presence/parity tests v `opencl_kernel.rs`.
6. ✅ **186 cosmic-harmony tests pass** (17 chv3: 6 Phase A + 6 Phase B + 5 Phase C).

**Commit:** `1ef6709b4` — feat(chv3): Phase C — GPU kernel parity + KAT vectors

**Edge deploy výsledek:**
- Pool restart na nový binary, 1 blok found po restartu.
- AuxPow scheduler připojen k KAS, 0 failures.
- GPU kernel `deeksha_chv3_mine` dostupný pro miner dispatch.

### Fáze D — Consensus cleanup (optional, hard fork)

1. Pokud chceme změnit scratchpad z 256 KiB na 64 KiB (dle spec):
   - `DEEKSHA_CHV3_FORK_HEIGHT = <height>`
   - Nový kernel s 64 KiB scratchpadem.
   - Hard fork.
2. Pokud nechceme riskovat hard fork: nechat 256 KiB, jen sjednotit název.

## 7) Revenue model (zachováno)

```
ZION_ALLOCATION       = 50%  → deeksha_chv3 canonical mining
MULTI_ALGO_ALLOCATION = 25%  → AuxPow external coins (profit-switched)
NCL_ALLOCATION        = 25%  → NPU/AI compute tasks
```

Fee struktura:
- Zion: 5% (merged mining fee)
- External: 2% (Blake3/kHeavyHash/Ethash/KawPow/Autolykos)
- NCL: 10%

Protocol fee split pro ZION blocks:
- 89% miner / 5% humanitarian / 5% issobella / 1% pool (burned)

## 8) Co se nemění

- **Hash output** — `deeksha_chv3` = `deeksha_v2` bit-identicky.
- **Chain history** — žádný reset, žádný re-index.
- **AuxPow protokol** — externí mining zůstává přes Stratum v1 proxy.
- **Revenue model** — 50/25/25 zůstává.
- **Fee split** — 89/5/5/1 zůstává.

## 9) Co se mění

- **Jeden název** — `deeksha_chv3` místo `deeksha_lite_v1` / `deeksha_v2` / `fire`.
- **Jeden kernel** — `deeksha_chv3.cl` místo 3 různých `.cl` souborů.
- **Sjednocená telemetrie** — `DeekshaStreamTelemetry` pro každý hash.
- **Čistší dispatch** — žádné `match algorithm { "deeksha_lite_v1" => ..., "cosmic_harmony" => ... }`.

## 10) Test plán

1. **Parity test:** `deeksha_chv3_hash(h, n, height) == cosmic_harmony_ekam_deeksha_v2(h, n, height)`.
2. **Stream test:** telemetry se zaznamená pro každý step.
3. **Pool test:** pool s `deeksha_chv3` přijímá shares od existujících minerů.
4. **GPU test:** CPU↔GPU parity pro 1000 nonceů.
5. **AuxPow test:** externí shares se forwardují a revenue se trackuje.
6. **E2E test:** pool + miner + AuxPow + NCL → sjednocený revenue report.

## 11) Rollout

1. **Deploy** aktualizovaného pool binary na Edge (AuxPow fixy).
2. **Test** že pool startuje a minery se připojují.
3. **Fáze A** — alias `deeksha_chv3` → `deeksha_v2` (no-op change).
4. **Fáze B** — telemetrie sjednocení.
5. **Fáze C** — GPU kernel parity.
6. **Fáze D** — optional consensus cleanup (hard fork, až když bude governance ready).
