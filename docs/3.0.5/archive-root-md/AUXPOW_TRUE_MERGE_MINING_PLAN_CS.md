# ZION True AuxPoW Merge Mining — Komplexní analýza a implementační plán

> **Datum:** 2026-07-11 (rev3 — DCR-primary, ALPH-secondary, multi-algo future)
> **Status:** PLÁN — dokumentace před implementací
> **Požadavky:** Dual-algo, fork-based (height-gated), multi-parent, DCR-primary + ALPH-secondary + multi-algo future
> **Závislost:** Hard fork ZION L1 consensus + pool + miner

---

## Obsah

1. [Exekutivní shrnutí](#1-executive-summary)
2. [Uživatelské požadavky](#2-user-requirements)
3. [Současná ZION architektura — Hluboká analýza](#3-current-zion-architecture--deep-analysis)
4. [Historický kontext — CH v3 výnosový systém (2.5–2.9.5)](#4-historical-context--ch-v3-revenue-system-25295)
5. [Pravý AuxPoW vs současná AuxPow proxy](#5-true-auxpow-vs-current-auxpow-proxy)
6. [Blake3 krajina mincí a kompatibilita algoritmů](#6-blake3-coin-landscape--algorithm-compatibility)
7. [Strategie rodičovského řetězce — Revidována po hlubokém skenu](#7-parent-chain-strategy--revised-after-deep-scan)
8. [DeFi a DEX integrační roadmapa](#8-defi--dex-integration-roadmap)
9. [Doporučená architektura](#9-recommended-architecture)
10. [Formát bloku a validace](#10-block-format--validation)
11. [Úprava obtížnosti](#11-difficulty-adjustment)
12. [Pool merge-mining proxy](#12-pool-merge-mining-proxy)
13. [Podpora mineru](#13-miner-support)
14. [Analýza GPU kernelu](#14-gpu-kernel-analysis)
15. [Integrace výnosového systému](#15-revenue-system-integration)
16. [Fáze implementace](#16-implementation-phases)
17. [Analýza rizik](#17-risk-analysis)
18. [Testovací plán](#18-test-plan)
19. [Soubory ke změně](#19-files-to-change)
20. [Otevřené otázky](#20-open-questions)

---

## 1. Exekutivní shrnutí

ZION aktuálně používá `deeksha_lite_v1` — vlastní memory-hard PoW algoritmus (256 KiB scratchpad, pipeline Keccak256→SHA3-512→AES-128). Žádný externí blockchain tento algoritmus nepoužívá, což z pravého merge miningu dělá s aktuálním jednoalgo designem nemožnost.

Tento dokument analyzuje codebase a navrhuje **dual-algo, height-gated fork, multi-parent** AuxPoW merge mining systém s **Decred (DCR) jako primární rodičovský řetězec**, Alephium (ALPH) jako sekundární, a dlouhodobou cestou rozšíření na více algoritmů:

- **Dual-algo:** ZION akceptuje jak `deeksha_lite` bloky (stávající CPU mineři), tak `blake3` AuxPoW bloky (merge-mined s DCR/ALPH)
- **Fork-based:** Aktivace na výšce bloku X (bez resetu genesis — historie řetězce zůstává zachována)
- **Multi-parent:** DCR (primární — standardní 180-byte header, 4-byte nonce, masivní ASIC hashrate, prověřený Stratum) + ALPH (sekundární — DeFi ekosystém, GPU mining, aligned economics) + podpora budoucích více algoritmů
- **DeFi integrace:** Listování ZION tokenu na Powfi DEX (ALPH ekosystém), integrace ALPH Bridge pro cross-chain, sdílená likvidita

**Proč DCR primární (ne ALPH):**
- DCR má ~5 PH/s hashrate — masivní bezpečnost pro ZION řetězec zdarma
- DCR má standardní 180-byte block header, 4-byte nonce, 32-byte `ExtraData` — jednodušší AuxPoW integrace
- DCR Stratum protokol je dobře pochopen a již používán mining pooly
- DCR ASIC mineři jsou stabilní a oddaní; DCR je zralý merge-mining hostitel
- Rychlejší nasazení než ALPH a poskytuje větší bezpečnost než složitý sharded, 24-byte-nonce, double-Blake3 protokol ALPH

**Proč ALPH sekundární:**
- ALPH má rostoucí DeFi ekosystém (Powfi DEX s CLMM+CPMM, AlphBanX CDP, půjčky, launchpad)
- ALPH používá sUTXO model + Ralph smart kontrakty — podobná architektura jako ZION
- ALPH je GPU-minable (přístupné pro komunitu, není ovládnut ASICy jako DCR)
- ALPH má "Aligned Economics" — 100% spalování poplatků, buybacky, staking rewards (stejná filosofie jako ZION)
- ALPH Bridge již propojuje 3 řetězce — přirozená cesta pro ZION cross-chain integraci
- Nejlepší strategický partner pro DeFi/bridge integraci, jakmile bude jádro AuxPoW architektury ověřeno s DCR

To dělá ZION **dual merge-mined chain** — nejprve zabezpečený DCR ASIC hashratem, později ALPH GPU hashratem, s cestou k multi-algorithm security a DeFi integraci skrze ALPH ekosystém.

---

## 2. Uživatelské požadavky

| Požadavek | Detail | Rozdíl oproti původnímu plánu |
|-------------|--------|---------------------------|
| **Dual-algo** | NENÍ pouze Blake3 náhrada. ZION akceptuje jak deeksha_lite, tak blake3 AuxPoW bloky | Původní plán doporučoval pouze Blake3 (možnost A) |
| **Fork-based** | Height-gated aktivace na bloku X. ŽÁDNÝ reset genesis. Historie řetězce zachována | Původní plán doporučoval reset genesis |
| **Multi-parent** | DCR (primární) + ALPH (sekundární) + budoucí multi-algo. Není uzamčen na jeden rodičovský řetězec | Původní plán doporučoval pouze DCR; rev2 draft doporučoval ALPH primární |
| **DCR primární** | Decred jako primární rodič — standardní 180-byte header, 4-byte nonce, dobře pochopený Stratum, masivní ASIC hashrate | Rev2 draft měl ALPH jako primární |
| **DeFi integrace** | Cesta k listování ZION na Powfi DEX, ALPH Bridge, sdílená likvidita | Nebylo v původním plánu |
| **Revenue = ZION only** | Žádný výnos z externích mincí. Merge mining přináší ZDARMA bezpečnost řetězce, ne BTC výplaty | Původní plán se zaměřoval na BTC výplaty |
| **Documentation first** | Komplexní analýza PŘED jakoukoliv implementací | — |

---

## 3. Současná ZION architektura — Hluboká analýza

### 3.1 Zásobník PoW algoritmů

```
V3/L1/cosmic-harmony/src/
├── lib.rs                    — Profile selection, fork heights
├── deeksha.rs                — Ekam Deeksha v2 (mainnet canonical, fork height 0)
├── deeksha_lite.rs           — DeekshaLite v1 (256 KiB scratchpad, CPU reference)
├── deeksha_lite_fire.rs      — DeekshaLite Fire (v1 + thermal loop, GPU-optimized)
├── algorithms_opt.rs         — Keccak256, SHA3-512, Golden Matrix, Cosmic Fusion, difficulty check
├── algorithms_npu.rs         — INT8 MLP NPU mixing step (CHv4), epoch-rotating weights
├── stream_layers.rs          — Revenue-aware telemetry, 6-step pipeline → RevenueSource mapping
├── revenue.rs                — RevenueCollector, RevenueEvent, RevenueSource enum (14 variants)
├── revenue_journal.rs        — Append-only JSONL audit log, crash-safe replay
├── profit_router.rs          — ExternalCoin enum (11 coins), CoinProfile, profit switching
├── ncl_integration.rs        — NCL AI compute layer (25% allocation), consciousness levels
├── sha3_fast.rs              — Optimized SHA3-512
├── scratchpad_ekam.rs        — Memory-hard transform (Ekam variant)
├── hic.rs                    — Hardware integrity check
├── hugepages.rs              — Huge pages support
└── gpu/
    ├── mod.rs                — Module declaration
    ├── opencl_kernel.rs      — OpenCL kernel loader/runner
    └── kernels/
        ├── cosmic_harmony_deeksha.cl  — OpenCL kernel for Ekam Deeksha
        ├── deeksha_lite.cl            — OpenCL kernel for DeekshaLite v1
        ├── deeksha_lite_fire.cl       — OpenCL kernel for DeekshaLite Fire
        ├── deeksha_lite_fire.cu       — CUDA kernel for DeekshaLite Fire
        └── sha3_test.cl               — OpenCL SHA3 test kernel
```

### 3.2 Kanonické hash dispatch

```rust
// algorithms_opt.rs:172
pub fn cosmic_harmony_with_height(header: &[u8], nonce: u64, block_height: u64) -> Hash32 {
    crate::deeksha::cosmic_harmony_ekam_deeksha_v2(header, nonce, block_height)
}
```

**Klíčový poznatek:** `cosmic_harmony_with_height()` je jediný vstupní bod pro konsenzuální validaci. Vždy směruje na `cosmic_harmony_ekam_deeksha_v2` (fork height 0 = aktivní od genesis).

### 3.3 Precedenty fork height

Codebase již obsahuje height-gated forky:

```rust
// deeksha.rs
pub const CHV_EKAM_FORK_HEIGHT: u64 = 0;           // v1 active from genesis
pub const CHV_EKAM_V2_FORK_HEIGHT: u64 = 0;        // v2 active from genesis
pub const CHV42_DUAL_SPIN_FORK_HEIGHT: u64 = u64::MAX;  // dormant, not activated

// lib.rs
pub const FIRE_FORK_HEIGHT: u64 = 5000;             // deeksha_lite_fire planned at H=5000

// algorithms_npu.rs
pub const CHV4_NPU_FORK_HEIGHT: u64 = 0;            // NPU mixing active from genesis
pub const NPU_EPOCH_LENGTH: u64 = 2016;             // Weight rotation every 2016 blocks

// TX hash v2 + body root v2 — both active from genesis (height 0)
```

**Závěr:** Height-gated forky jsou dobře zavedený vzor. Můžeme přidat `AUXPOW_FORK_HEIGHT` podle stejného vzoru.

### 3.4 Hlavička bloku (80 bytes)

```rust
// V3/L1/core/src/lib.rs
pub const HEADER_SIZE: usize = 80;

pub struct MiningHeader {
    pub version: u32,            // 4 bytes
    pub previous_hash: [u8; 32], // 32 bytes
    pub merkle_root: [u8; 32],   // 32 bytes
    pub timestamp: u64,          // 8 bytes
    pub difficulty_bits: u32,    // 4 bytes
}
// Total: 80 bytes
```

### 3.5 Tok validace bloku

```
V3/L1/core/src/peer_block_validation.rs

1. Checkpoint validation
2. Recompute hash from header + nonce using algorithm
3. Verify hash == block.hash_hex
4. Verify hash meets difficulty target (big-endian comparison)
5. Timestamp sanity check
6. Transaction validation
7. Merkle root verification
```

### 3.6 Validace pool share

```
V3/L1/pool/src/lib.rs (ShareSubmission)

1. Look up job by job_id (TTL check — 90s default)
2. Verify header matches job template
3. Recompute hash with algorithm field from submission
4. Check hash meets share target (vardiff two-tier)
5. If hash meets network target → finalize callback → submit to node
```

**Klíč:** `ShareSubmission` již má `algorithm` pole — pool může již dispatchovat různé algoritmy na share.

### 3.7 Obtížnost

```rust
// V3/L1/core/src/difficulty.rs
// LWMA (Linear Weighted Moving Average)
// Target block time: 60 seconds
// Window: 60 blocks
// Min difficulty: 1000
// ±25% clamp per block (anti time-warp)
```

### 3.8 Výnosový systém (14 variant RevenueSource)

```rust
// revenue.rs:46-74
pub enum RevenueSource {
    Zion,                  // Canonical ZION blocks
    KeccakBonus,           // FREE byproduct of CH pipeline
    Sha3Bonus,             // FREE byproduct of CH pipeline
    ProfitSwitch,          // Dynamic profit switching
    Blake3External,        // DCR, ALPH
    KHeavyHashExternal,    // KAS
    EthashExternal,        // ETC, EVR, MEWC
    KawPowExternal,        // RVN, CLORE
    AutolykosExternal,     // ERG
    RandomXExternal,       // XMR
    ZelHashExternal,       // FLUX
    DeekshaLite,           // DeekshaLite v1 stream
    ThermalBonus,          // DeekshaLite Fire stream
    NclAi,                 // AI compute layer
}
```

**Klíč:** Výnosový systém již má `Blake3External` pro DCR/ALPH — výnos z merge mining může být sledován skrze tento existující zdroj.

### 3.9 Definice externích mincí (profit_router.rs)

```rust
// profit_router.rs:44-69
pub enum ExternalCoin {
    DCR,   // blake3, 2miners
    ALPH,  // blake3, 2miners
    KAS,   // kheavyhash, 2miners
    ERG,   // autolykos, 2miners
    RVN,   // kawpow, 2miners
    ETC,   // ethash, 2miners
    EVR,   // evrprogpow, zpool
    MEWC,  // meowpow, zpool
    FLUX,  // zelhash, woolypooly
    CLORE, // kawpow, 2miners
    XMR,   // randomx, moneroocean
}
```

**Klíč:** `ExternalCoin::blake3_coins()` vrací `[DCR, ALPH]` — toto jsou kandidáti na merge mining.

### 3.10 Stream Layers (výnosově orientovaná telemetrie)

```
// stream_layers.rs — DeekshaStreamTelemetry

6-step pipeline mapping:
  Step 1 (Keccak256)   → KeccakBonus (FREE ETC byproduct)
  Step 2 (SHA3-512)    → Sha3Bonus (FREE NXS byproduct)
  Step 3 (GoldenMatrix)→ Zion (primary ZION mining)
  Step 4 (MemoryHard)  → DeekshaLite (stream telemetry)
  Step 5 (AES Mix)     → ThermalBonus (Fire variant)
  Step 6 (NPU Mixing)  → NclAi (AI compute layer)

DeekshaStep enum with work_units() weights for proportional revenue splitting.
```

---

## 4. Historický kontext — CH v3 výnosový systém (2.5–2.9.5)

### 4.1 Původní vize (2.9.3–2.9.5)

CH v3 výnosová architektura byla navržena jako **50/25/25 model**:

| Stream | Výpočet | Zdroj | Výnos |
|--------|---------|--------|---------|
| ZION | 50% | CosmicHarmony pipeline (Keccak→SHA3→Matrix→Fusion) | ZION bloky + FREE ETC + FREE NXS |
| Výnos | 25% | GPU: profit-switch (ERG/RVN/KAS/ALPH) / CPU: XMR | BTC výplaty z externích poolů |
| NCL AI | 25% | AI inference tasks (embeddings, LLM, image) | ZION bonus + AI compute credits |

**5 výnosových streamů z 3 výpočetních nákladů** — Keccak a SHA3 meziprodukty jsou ZDARMA vedlejšími produkty ZION pipeline.

### 4.2 Co bylo skutečně postaveno (V3 mainnet)

V3 mainnet implementace se odchýlila od původní vize:

- **ZION mining:** ✅ Plně implementováno (deeksha_lite / Ekam Deeksha v2)
- **Revenue proxy (external pool mining):** ⚠️ Implementováno jako `AuXpow` crate — Stratum proxy, která se připojuje k externím poolům a těží nezávisle (NENÍ merge mining)
- **NCL AI:** ✅ Framework existuje (`ncl_integration.rs`), ale není živé AI task dispatch
- **FREE byproduct streams (ETC/NXS):** ❌ Neimplementováno — původní nápad odesílat Keccak/SHA3 meziprodukty do externích poolů byl opuštěn, protože mezihashy NEJSOU platnou prací Ethash/SHA3 pro cílové blockchainy

### 4.3 Současný AuXpow Crate (Fáze 1 — Stratum Proxy)

`AuXpow` crate (commity `44371aa10` až pending) je **Stratum proxy** — NENÍ pravé merge mining:

```
AuXpow architecture (current):
  Pool server spawns background scheduler
  Scheduler picks most profitable coin (KAS, ERG, RVN, ETC, CLORE, EVR, MEWC)
  Connects to external pool as Stratum client
  Receives mining.notify jobs
  Forwards to connected miners OR mines on server
  Submits shares back to external pool
  Revenue tracked via RevenueCollector

Problem: This is SOLO mining on external pools, NOT merge mining.
         ZION blockchain gets NO benefit from this hashrate.
```

Problém: Toto je SOLO mining na externích pooloch, NENÍ merge mining. ZION blockchain z této hashrate nemá ŽÁDNÝ prospěch.

### 4.4 Proč selhaly "FREE byproduct" streemy

Původní CH v3 design navrhoval odesílat Keccak/SHA3 meziprodukty z ZION pipeline do ETC/NXS poolů. Toto bylo opuštěno, protože:

1. **ETC používá Ethash** — nikoli Keccak256. Keccak256 meziprodukt z ZION pipeline NENÍ platným Ethash hashem.
2. **Nexus (NXS) používá SHA3-256** — ale SHA3-512 meziprodukt z ZION pipeline NENÍ ve formátu, který Nexus očekává.
3. **Odmítnutí poolem** — externí pooly odmítají share, které nesplňují jejich očekávaný PoW algoritmus.

**Poučení:** Pravé merge mining vyžaduje STEJNÝ PoW algoritmus na obou řetězcích. "FREE byproduct" streemy fungují pouze tehdy, když mezihash náhodně platí pro cílový řetězec — což se téměř nikdy nestává.

---

## 5. Pravý AuxPoW vs současná AuxPow proxy

| Aspekt | Současný AuXpow (Fáze 1) | Pravý AuxPoW (tento plán) |
|--------|--------------------------|--------------------------|
| **Co to dělá** | Těží externí mince nezávisle přes Stratum proxy | Těží rodičovský řetězec, ZION akceptuje PoW jako platný aux block |
| **Přínos pro ZION řetězec** | Žádný — ZION řetězec nedostává hashrate | ZION řetězec zabezpečen hashratem rodičovského řetězce |
| **Algoritmus** | Algoritmus externí mince (kheavyhash, autolykos, atd.) | Musí odpovídat mezi rodičem a aux chainem (Blake3) |
| **Formát bloku** | Pouze standardní ZION bloky | Standard + AuxPoW bloky (s rodičovským důkazem) |
| **Změna konsensu** | Žádná — pouze pool-side | Hard fork — konsensus akceptuje AuxPoW bloky |
| **Výnos** | BTC z externích poolů | ZION bloky (zdarma) + BTC z rodičovského poolu |
| **Zkušenost mineře** | Miner těží externí minci | Miner těží rodičovskou minci, ZION block je zdarma vedlejší produkt |

---

## 6. Blake3 krajina mincí a kompatibilita algoritmů

### 6.1 Kompletní Blake3 ekosystém mincí

Aktualizace hlubokého skenu (červenec 2026): Pouze **2 aktivní blockchainy** používají Blake3 pro PoW:

| Mince | Ticker | Tržní kapitalizace | Síťový hashrate | Těžební hardware | Čas bloku | DeFi / Likvidita |
|------|--------|-----------|-----------------|----------------|------------|------------------|
| **Decred** | DCR | ~$195M | ~5 PH/s | ASIC (Goldshell, Antminer AL1) | ~5 min | DCRDEX (atomic swaps) |
| **Alephium** | ALPH | ~$4.7M | ~1 TH/s (est.) | GPU (RTX 4090 ~3.5 GH/s) + ASIC | ~16s | ~$615K TVL (DefiLlama) |

**Důležitá oprava:** Quai Network (QUAI) již **není Blake3**. QUAI mainnet (únor 2025) byl spuštěn s ProgPoW, poté přešel na **KawPoW + SHA-256 + Scrypt** merge mining (Project SOAP, 2026). QUAI nemůže být Blake3 rodičovským řetězcem pro ZION.

**Agregovaný Blake3 hashrate:** ~5 PH/s z DCR plus ALPH GPU/ASIC hashrate. DCR dominuje o řády.

### 6.2 Proč je Blake3 jedinou možností merge miningu (pro současný codebase)

| Algoritmus | Mince | Merge mining proveditelný? | Problém |
|-----------|-------|----------------------|---------|
| kHeavyHash | KAS | ❌ | Pouze Kaspa jej používá |
| Autolykos | ERG | ❌ | Pouze Ergo jej používá |
| KawPow | RVN, CLORE | ❌ | Žádná AuxPoW infrastruktura |
| Ethash | ETC | ❌ | ETC nepodporuje AuxPoW |
| RandomX | XMR | ❌ | Monero nepodporuje AuxPoW |
| **Blake3** | **DCR, ALPH** | **✅** | **2 aktivní řetězce, pooly, GPU+ASIC mining** |

### 6.3 Technická proveditelnost AuxPoW s DCR vs ALPH

Toto je kritický nález hlubokého skenu.

#### Decred (DCR) — Technicky jednodušší

**Hlavička bloku:** Přesně 180 bytes, pevné rozložení.

```rust
// Decred header fields (180 bytes total)
Version:        i32     4 bytes
PrevBlock:      [u8;32] 32 bytes
MerkleRoot:     [u8;32] 32 bytes
StakeRoot:      [u8;32] 32 bytes
VoteBits:       u16     2 bytes
FinalState:     [u8;6]  6 bytes
Voters:         u16     2 bytes
FreshStake:     u8      1 byte
Revocations:    u8      1 byte
PoolSize:       u32     4 bytes
Bits:           u32     4 bytes
SBits:          i64     8 bytes
Height:         u32     4 bytes
Size:           u32     4 bytes
Timestamp:      u32     4 bytes
Nonce:          u32     4 bytes
ExtraData:      [u8;32] 32 bytes
StakeVersion:   u32     4 bytes
```

**PoW hash:** `blake3(serialize(header))` (DCP-0011, `PowHashV2` v `dcrd/wire/blockheader.go`).
**Coinbase:** Bitcoin-like UTXO. Standardní Stratum pooly mohou upravit `scriptSig` tak, aby obsahoval AuxPoW commitment (`0xfa 0xbe 'm' 'm' + 32-byte ZION hash + 4-byte merkle size + 4-byte nonce`).
**Merkle root:** Vypočten z běžného stromu transakcí (`MerkleRoot`), nikoli `StakeRoot`.
**Nonce:** 4 bytes. `ExtraData` (32 bytes) je k dispozici pro extra nonce / pool data.
**Závěr:** DCR je dobře pochopený, Stratum-kompatibilní rodičovský řetězec pro standardní AuxPoW.

#### Alephium (ALPH) — Technicky složitější

**Hlavička bloku:** Proměnná velikost kvůli `BlockDeps` (sharding). Mainnet má 4 groups, 16 chains, `depsNum = 2 * groups - 1 = 7`. Serializace hlavičky:

```rust
// Alephium header fields (mainnet, groups = 4)
nonce:         24 bytes
version:       1 byte
blockDeps:     7 * 32 bytes = 224 bytes  // depends on group config
depStateHash:  32 bytes
txsHash:       32 bytes
timestamp:     8 bytes
target:        4 bytes
-----------------------------------------
headerBlob:    301 bytes (without nonce)
full header:   325 bytes (with nonce)
```

**PoW hash:** `blake3(blake3(serialize(header)))` (double Blake3). `headerBlob` z `MinerApi` neobsahuje 24-byte nonce; miner připojí nonce na začátek a vypočítá `blake3(blake3(nonce || headerBlob))`.
**Coinbase:** sUTXO model. `coinbase = transactions.last` v bloku. Coinbase je `AssetOutput` s `additionalData` (používá se pro ghost/uncle data). Ve smyslu Bitcoinu zde není `scriptSig`.
**Pool protokol:** ALPH používá vlastní `MinerApi` (push-based JSON-RPC přes TCP). Full node posílá `headerBlob`, `txsBlob`, `targetBlob` poolu. Pro vložení ZION commitment musí pool:
1. Deserializovat `txsBlob` a upravit `AssetOutput.additionalData` coinbase (nebo přidat samostatný data output)
2. Přepočítat `txsHash` a `depStateHash`
3. Přestavět `headerBlob`
4. Udržovat vlastní ALPH pool protokol v ZION merge mining proxy

**Závěr:** ALPH AuxPoW je proveditelný, ale vyžaduje vlastní ALPH pool/node integraci. Není to "drop-in" Stratum rodič jako DCR.

### 6.4 Alephium (ALPH) — Hluboký ponor

**Proč je ALPH ideální strategický partner pro ZION (navzdory technické složitosti):**

#### Technologie
- **sUTXO model:** Stateful UTXO — kombinuje bezpečnost UTXO se statefulness smart kontraktů.
- **Ralph jazyk:** Vytvořený přímo pro sUTXO, auditován Trail of Bits.
- **Sharded L1:** 4 groups, 16 chains na mainnetu.
- **PoLW (Proof-of-Less-Work):** Snižuje spotřebu energie, když je bezpečnost dostatečná.

#### DeFi ekosystém (živý na mainnetu)
```
ALPH DeFi TVL: ~$615K (DefiLlama, July 2026)
├── AlphBanX           $329K   CDP
├── Nightshade Finance  $95K   DEX
├── Linx App            $81K   Lending
├── Elexium             $68K   DEX
├── AYIN                 $39K   DEX
├── Alephium Bridge   $855K   Cross-chain (ETH, BSC, ALPH)
└── 24h DEX volume:     ~$930   (very low, nascent)
```

#### Aligned Economics
- 100% transakčních poplatků je SPÁLENO (deflační — stejně jako ZION)
- Poplatky Powfi DEX → ALPH buybacks & burns + xALPH staking
- Žádný zprostředkovatelský token pro akumulaci poplatků DEX

#### Těžba
- **Algoritmus:** Blake3 (double Blake3 hlavičky pro PoW)
- **GPU:** RTX 4090 ~3.5 GH/s, RTX 3080 Ti ~2.1 GH/s, RX 7900 XTX ~2.6 GH/s
- **ASIC:** Bitmain Antminer AL1 Pro (15.6 TH/s), Goldshell AL-BOX series
- **Pooly:** 2miners (BTC výplata), HeroMiners
- **Block reward:** ~0.143 ALPH na blok, klesající

#### Infrastruktura bridge
- Alephium Bridge spojuje Ethereum, BSC a Alephium
- ZION by se mohl integrovat s bridge jako 4. řetězec (dlouhodobě)

### 6.5 Decred (DCR) — Hluboký ponor

**Proč je DCR technicky nejjednodušší rodič pro ZION:**

#### Technologie
- **Hybrid PoW/PoS:** 60% PoW / 30% PoS / 10% treasury
- **DCP-0011:** Přepnuto na Blake3 v říjnu 2022
- **BLAKE-256 (14 rounds):** Používá se pro block ID, Blake3 pro PoW
- **UTXO model:** Bitcoin-like

#### DeFi / DEX
- **DCRDEX:** Decentralizovaná burza pomocí atomic swaps — žádné obchodní poplatky, non-custodial
- **Bison Wallet:** Multi-wallet se zabudovaným DEX
- **Atomic swaps:** BTC, LTC, BCH, ZEC, DCR a další
- **Cesta k listování ZION:** Integrace atomic swap (dlouhodobě)

#### Těžba
- **Algoritmus:** Blake3 (single Blake3 180-byte hlavičky pro PoW)
- **ASIC mining:** Goldshell AL series, Antminer AL1
- **Síťový hashrate:** ~5 PH/s — masivní bezpečnost pro ZION, pokud je merge-mined
- **Pooly:** 2miners (BTC výplata), suprnova, f2pool, HeroMiners
- **Čas bloku:** ~5 minut
- **Nonce:** 4 bytes (uint32)

#### Trh a likvidita
- **Tržní kapitalizace:** ~$195M (CoinMarketCap, červenec 2026)
- **24h objem:** ~$581K (nízký, ale mnohem vyšší než ALPH)
- **64% nabídky stakováno** v governance — nízký float, tenké order booky
- **Treasury:** ~873K DCR (~$9,8M) self-funded z block rewards

#### Governance
- **Politeia:** On-chain governance systém
- **DCP-0013 (leden 2026):** Strop výdajů treasury schválen (99,98 % podpory)

### 6.6 Quai Network (QUAI) — Aktualizace stavu

**QUAI již není Blake3.** Mainnet spuštěn v únoru 2025 s ProgPoW, poté přešel na **KawPoW + SHA-256 + Scrypt** (Project SOAP, 2026). QUAI má vlastní nativní merge-mined hierarchii (Prime → Region → Zone) a merge-mined parachains.

**Pro ZION:**
- QUAI nemůže být Blake3 rodičovský řetězec.
- QUAI by mohl být multi-algorithm rodič (KawPoW/SHA/Scrypt) v budoucnosti.
- To by vyžadovalo, aby ZION implementoval KawPoW, SHA-256 nebo Scrypt AuxPoW validaci.

**Doporučení:** Sledovat QUAI pro budoucí multi-algorithm rozšíření, nikoli Blake3.

### 6.7 Multi-Algorithm AuxPoW: Za hranice Blake3

Hluboký sken zjistil, že multi-algorithm AuxPoW je technicky možný, i když vzácný:

| Projekt | Algoritmy | AuxPoW status | Připraveno pro produkci? |
|---------|-----------|---------------|-------------------|
| **Myriadcoin** | 5 (SHA256d, Scrypt, Yescrypt, Argon2d, Myr-Groestl) | AuxPoW na SHA256d/Scrypt od 2014 | Ano (zavedený) |
| **WATTxChain** | 7 (SHA256d, Scrypt, Ethash, RandomX, Equihash, X11, kHeavyHash) | v0.1.7-dev, "compiles, ready for testing" | Ne (nový, 2 hvězdy, 1 přispěvatel) |
| **Quai Network** | 3 (KawPoW, SHA256, Scrypt) | Nativní merge-mined hierarchy + parachains | Ano (mainnet) |

**Důsledek pro ZION:** ZION by teoreticky mohl merge-mine s řetězci používajícími tyto algoritmy:

| Algoritmus | Příklady rodičovských řetězců | Hardware | Implementační úsilí ZION |
|-----------|----------------------|----------|---------------------------|
| SHA256d | BTC, BCH, BSV, NMC, DOGE | ASIC | Vysoké (potřeba SHA256d validátor + pool) |
| Scrypt | LTC, DOGE | ASIC | Vysoké |
| Ethash | ETC, CLO | GPU | Vysoké |
| RandomX | XMR, WOW | CPU | Vysoké |
| Equihash | ZEC, ZEN, KMD | GPU/ASIC | Vysoké |
| X11 | DASH, DGB-X11 | ASIC | Vysoké |
| kHeavyHash | KAS, KLS, PYI | GPU/ASIC | Vysoké |

**Tradeoff:** Multi-algorithm by dal ZION přístup k 100× více hashrate a likviditě, ale je to 10-20× větší rozsah než jednoduchý Blake3 AuxPoW. `profit_router.rs` ZION již tyto algoritmy uvádí pro externí pool mining, ale **AuxPoW validace** (prokázání práce na jiném řetězci) je samostatný a větší úkol.

**Doporučení:** Implementovat nejprve jednoduchý Blake3 AuxPoW. Multi-algorithm považovat za Fázi 2 (post-mainnet) poté, co bude jádro architektury ověřeno.

### 6.8 Aktuální ZION pool hashrate (živá data, červenec 2026)

```
ZION Pool Metrics (live):
  Active miners:     20 sessions (15 in PPLNS)
  Total hashrate:    ~1.17 MH/s (1,166,024 H/s)
  Algorithm:         deeksha_lite_v1 (100% ZION)
  Blocks found:      33
  Block height:      ~2521
  Accept rate:       99.88%
  Hardware:          All CPU (AMD 7950X, 9950X Threadripper/Ryzen)

Top miners:
  worker-03          141 KH/s   (3 blocks)
  rig7950x-05        112 KH/s   (4 blocks)
  Rig-Grimes         112 KH/s   (2 blocks)
  Rig-Dangerous      105 KH/s   (2 blocks)
  9950X-14           105 KH/s   (2 blocks)
  Rig-Cantoney       102 KH/s   (1 block)
  7950X-01/27/16     ~68 KH/s   (0-4 blocks each)
  9950X-03/13        ~65 KH/s   (0-3 blocks each)
  worker-04           47 KH/s   (4 blocks)
  Acidminer5060       28 KH/s   (0 blocks)
  local-miner         16 KH/s   (2 blocks)
```

**Klíčový poznatek:** ZION 1,17 MH/s je dostatečný pro současnou obtížnost, ale merge mining s DCR (~5 PH/s) a ALPH (~1 TH/s) by zvýšil efektivní bezpečnost o ~4 000 000× — i kdyby pouze 0,01 % rodičovského hashrate obsahovalo ZION commitment.

### 6.9 DeekshaLite — nativní algoritmus ZION (zachován)

- **Memory-hard:** 256 KiB scratchpad, 2 průchody, 64 náhodných čtení
- **Pipeline:** Keccak256 → SHA3-512 → AES-128 CTR mix → Keccak256
- **ASIC-resistant:** Memory-hardness brání ASIC optimalizaci
- **GPU kernel:** OpenCL (`deeksha_lite.cl`), CUDA (`deeksha_lite_fire.cu`)
- **Fire variant:** Přidává thermal loop (16384 iters, 8 ulong chains) pro teplo GPU
- **KAT vektory:** Known-answer testy uzamykají přesný výstup (CPU↔GPU se musí shodovat)
- **Status:** Zachován v dual-algo designu — stávající CPU mineři pokračují beze změny

---

## 7. Strategie rodičovského řetězce — Revidována po hlubokém skenu

### 7.1 Přehled strategie

Hluboký sken změnil prostředí:

- Pouze **2** Blake3 mince: DCR a ALPH. **QUAI již není Blake3** (KawPoW + SHA/Scrypt).
- **DCR** je technicky nejjednodušší AuxPoW rodič: pevná 180-byte hlavička, standardní Stratum, `blake3(header)`.
- **ALPH** je technicky složitější: proměnná hlavička (`BlockDeps`), vlastní `MinerApi`, double `blake3(blake3(header))`.
- **ALPH** má silnější DeFi / bridge integrační potenciál pro ZION.
- **Multi-algorithm** AuxPoW je možný (Myriad, WATTx, QUAI), ale je 10-20× větší rozsah.

```
┌──────────────────────────────────────────────────────────────────────┐
│         ZION MERGE MINING STRATEGY (REVISED AFTER DEEP SCAN)          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  PHASE 1 PRIMARY: Decred (DCR)                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • Blake3 PoW, 180-byte fixed header                        │     │
│  │  • Standard Stratum pools (2miners, f2pool)                 │     │
│  │  • ~5 PH/s ASIC hashrate = massive security boost           │     │
│  │  • Fastest path to live AuxPoW blocks                       │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  PHASE 2 SECONDARY: Alephium (ALPH)                                  │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • Blake3 PoW, but custom MinerApi & sharded header         │     │
│  │  ~1 TH/s GPU hashrate + ASIC emergence                      │     │
│  │  • DeFi ecosystem: Powfi, AlphBanX, Bridge                  │     │
│  │  • Strategic partner for ZION cross-chain DeFi              │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  PHASE 3 (FUTURE): Multi-Algorithm                                    │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • KawPoW, SHA256d, Scrypt, Ethash, RandomX, etc.           │     │
│  │  • Quai, WATTx, Myriadcoin as reference models              │     │
│  │  • 100× hashrate potential, but 10-20× scope               │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 Revidované doporučení: DCR primární, ALPH sekundární, multi-algo budoucnost

| Fáze | Rodič | Hashrate | Technické riziko | DeFi hodnota | Priorita |
|-------|--------|----------|----------------|------------|----------|
| **Fáze 1** | **DCR** | ~5 PH/s | Nízké | Nízká | **Primární** |
| **Fáze 2** | **ALPH** | ~1 TH/s | Vysoké | Vysoká | **Sekundární** |
| **Fáze 3** | **QUAI / Multi-algo** | Proměnná | Velmi vysoké | TBD | **Budoucnost** |

**Proč se to změnilo oproti rev2 (ALPH-primary):** Hluboký sken odhalil, že vlastní pool protokol ALPH a proměnná sharded hlavička z něj dělají špatnou volbu pro *první* AuxPoW implementaci. DCR je rychlejší k nasazení a poskytuje větší bezpečnost. ALPH je stále správný strategický partner pro DeFi, ale měl by následovat DCR, jakmile bude jádro architektury ověřeno.

### 7.3 DCR vs ALPH — Technické srovnání

| Faktor | DCR | ALPH |
|--------|-----|------|
| **Velikost hlavičky** | 180 bytes fixed | 325 bytes (mainnet, 4 groups) — proměnná podle group config |
| **PoW hash** | `blake3(serialize(header))` | `blake3(blake3(serialize(header)))` |
| **Nonce** | 4 bytes | 24 bytes |
| **Coinbase** | Bitcoin UTXO s `scriptSig` | sUTXO `AssetOutput` s `additionalData` |
| **Umístění commitment** | `scriptSig` (standardní Stratum) | `additionalData` nebo extra output (vlastní protokol) |
| **Pool protokol** | Standardní Stratum (2miners) | Vlastní `MinerApi` (JSON-RPC přes TCP, push-based) |
| **Přestavění hlavičky** | Zaměnit `MerkleRoot`, zachovat 180 bytes | Přepočítat `txsHash`, `depStateHash`, přestavět `headerBlob` |
| **Zralost** | Prokázáno od 2016, DCP-0011 2022 | Mainnet od 2024, zralý mining pool ekosystém |
| **Implementační úsilí** | ~3-4 dny | ~7-10 dní (vlastní ALPH integrace) |

### 7.4 DCR vs ALPH — Strategické srovnání

| Faktor | DCR | ALPH | Vítěz |
|--------|-----|------|--------|
| **Tržní kapitalizace** | ~$195M | ~$4,7M | DCR (větší, likvidnější) |
| **Síťový hashrate** | ~5 PH/s | ~1 TH/s | DCR (5 000× více bezpečnosti) |
| **DeFi ekosystém** | Pouze DCRDEX | Powfi, AlphBanX, Bridge | ALPH |
| **Smart kontrakty** | Omezené | Ralph (sUTXO, auditováno) | ALPH |
| **Těžební hardware** | ASIC | GPU + ASIC | ALPH (přístupnější) |
| **Model poplatků** | 10 % treasury | 100 % burn + buybacks | ALPH (více zarovnané se ZION) |
| **Bridge** | Pouze atomic swaps | 3-chain bridge | ALPH |
| **Čas bloku** | ~300 s | ~16 s | ALPH (blíže ZION 60 s) |
| **Technické riziko** | Nízké | Vysoké | DCR |

### 7.5 Podpora multi-parent (nezměněno, aktualizováno)

```rust
pub enum ParentChain {
    Decred,     // DCR — Phase 1 primary (lowest technical risk)
    Alephium,   // ALPH — Phase 2 secondary (DeFi integration)
    // Future: Quai (KawPoW), Bitcoin (SHA256d), Litecoin (Scrypt), etc.
}
```

**Jak funguje multi-parent (Fáze 1 → 2):**
1. Fáze 1: Pool se připojuje pouze k DCR poolu. ZION akceptuje DCR-based AuxPoW bloky.
2. Fáze 2: Pool přidá ALPH pool. ZION akceptuje jak DCR, tak ALPH AuxPoW bloky.
3. Fáze 2+ (budoucnost): Pool přidá další rodičovské řetězce (multi-algorithm).

### 7.6 Dual-algo design (nezměněn)

```
Pre-fork (height < AUXPOW_FORK_HEIGHT):
  - Only deeksha_lite blocks accepted
  - Existing CPU miners continue normally

Post-fork (height >= AUXPOW_FORK_HEIGHT):
  - deeksha_lite blocks: ACCEPTED (existing CPU miners continue)
  - blake3 AuxPoW blocks: ACCEPTED (merge-mined with DCR or ALPH)
  - Both block types compete on the same chain
  - Separate difficulty LWMA for each algorithm
```

### 7.7 Vyvážení obtížnosti pro dual-algo (nezměněno)

**Oddělené LWMA na algoritmus (doporučeno):**
- Sledovat `deeksha_lite` obtížnost a `blake3_auxpow` obtížnost nezávisle.
- Každý algoritmus má vlastní 60-block okno.
- Cílový čas bloku: 60 s dohromady (30 s průměrně na algoritmus).

### 7.8 Výnosový model — Pouze ZION

**Kritický princip:** Výnosový systém je pouze pro ZION. Merge mining přináší ZDARMA bezpečnost řetězce, nikoli externí výnos.

```
Merge mining revenue flow:
  DCR/ALPH miner hashes Blake3
    → if meets parent target: parent block (miner keeps DCR/ALPH reward)
    → if meets ZION aux target: ZION AuxPoW block (ZION block reward)
    → if meets both: BOTH blocks (miner gets DCR/ALPH + ZION block reward)

ZION block reward split (same as standard blocks):
  89% → miner (who found the AuxPoW block)
  5%  → humanitarian fund
  5%  → issobella fund
  1%  → pool fee
```

ŽÁDNÝ externí BTC výnos v ZION block reward. Stávající `AuXpow` Stratum proxy pro non-Blake3 mince zůstává samostatným výnosovým streamem.

---

## 8. DeFi a DEX integrační roadmapa

### 8.1 Vize — ZION v ALPH ekosystému

```
┌──────────────────────────────────────────────────────────────────────┐
│           ZION ↔ ALPH DeFi INTEGRATION ROADMAP                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Phase A: Merge Mining (this plan)                                   │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • ZION AuxPoW blocks secured by DCR (primary) + ALPH       │     │
│  │    (secondary) hashrate                                     │     │
│  │  • Pool connects to DCR pool (primary) + ALPH pool (sec)    │     │
│  │    and inserts ZION commitment in parent coinbase           │     │
│  │  • DCR ASICs + ALPH GPU miners produce ZION blocks as       │     │
│  │    free byproduct                                           │     │
│  │  • No DeFi integration yet — just chain security            │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                              ↓                                       │
│  Phase B: ALPH Bridge Integration                                    │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • Integrate ZION into Alephium Bridge (4th chain)          │     │
│  │  • Cross-chain transfers: ALPH ↔ ZION                        │     │
│  │  • Wrapped ZION (wZION) on ALPH chain                        │     │
│  │  • Wrapped ALPH (wALPH) on ZION chain                        │     │
│  │  • Requires: ZION Bridge contract on ALPH (Ralph)           │     │
│  │            + ALPH Bridge contract on ZION (existing EVM)    │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                              ↓                                       │
│  Phase C: Powfi DEX Listing                                          │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • wZION/ALPH liquidity pool on Powfi DEX                   │     │
│  │  • ZION token tradeable on ALPH's main DEX                  │     │
│  │  • Powfi DEX fees from ZION trading → ALPH buybacks/burns   │     │
│  │  • ZION liquidity providers earn trading fees                │     │
│  │  • Requires: wZION Ralph contract on ALPH                   │     │
│  │            + initial liquidity provision (ZION treasury)    │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                              ↓                                       │
│  Phase D: Cross-Chain DeFi                                           │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • wZION as collateral on AlphBanX (CDP)                    │     │
│  │  • wZION lending/borrowing on Linx App                       │     │
│  │  • wZION/ALPH yield farming strategies                       │     │
│  │  • xALPH stakers earn fees from ZION trading volume          │     │
│  │  • Shared liquidity between ZION and ALPH ecosystems         │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                              ↓                                       │
│  Phase E: DCRDEX Atomic Swaps                                        │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • ZION listed on DCRDEX (Decred's atomic swap DEX)         │     │
│  │  • Trustless ZION ↔ DCR ↔ BTC ↔ LTC trading                 │     │
│  │  • No intermediary token, no custody, no trading fees        │     │
│  │  • Requires: ZION atomic swap protocol implementation       │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 Fáze A — Merge Mining (Okamžitá)

**Toto implementujeme nyní.** Žádná DeFi integrace zatím — pouze bezpečnost řetězce.

- ZION AuxPoW bloky zabezpečené DCR (primární) + ALPH (sekundární) hashratem
- Pool zajišťuje merge mining proxy
- ZION řetězec roste z deeksha_lite i Blake3 AuxPoW bloků
- **Není vyžadována ALPH DeFi integrace** — pouze Stratum pool připojení

### 8.3 Fáze B — ALPH Bridge integrace (Budoucnost, post-merge-mining)

**Cíl:** Cross-chain transfery mezi ZION a ALPH.

**Co je potřeba:**
1. **ZION Bridge contract na ALPH** (napsaný v Ralph) — drží wZION na ALPH řetězci
2. **ALPH Bridge contract na ZION** (napsaný v Solidity, nasazený na ZION EVM vrstvě nebo Base) — drží wALPH na ZION řetězci
3. **Validator set** — monitoruje oba řetězce, podepisuje cross-chain transfery
4. **Počáteční likvidita** — ZION treasury financuje bridge počáteční zásobou wZION

**Stávající ZION infrastruktura:**
- ZION již má bridge na Base Mainnet (`ZIONBridge` contract, 5 validatorů, threshold 5/5)
- Stejná architektura může být rozšířena na ALPH bridge
- ZION již má `wZION` (wrapped ZION) na Base — stejný koncept pro ALPH

**ALPH Bridge infrastruktura:**
- Alephium Bridge již propojuje 3 řetězce (BTC, ETH, BSC pravděpodobně)
- Přidání ZION jako 4. řetězce je přirozené rozšíření
- ALPH bridge používá atomic swap / lock-mint pattern

### 8.4 Fáze C — Listování na Powfi DEX (Budoucnost)

**Cíl:** ZION token obchodovatelný na hlavním DEX ALPH (Powfi).

**Co je potřeba:**
1. **wZION Ralph contract** — wrapped ZION token na ALPH řetězci (podobné ERC20, ale v jazyce Ralph)
2. **Likviditní pool** — pár wZION/ALPH na Powfi DEX (CLMM nebo CPMM)
3. **Počáteční likvidita** — ZION treasury + ALPH partner poskytnou počáteční LP
4. **Price discovery** — trh určuje ZION/ALPH směnný kurz

**Výhody:**
- ZION se stává obchodovatelným bez centralizované burzy
- Poplatky Powfi DEX z obchodování ZION → ALPH buybacks & burns (aligned economics)
- ZION poskytovatelé likvidity získávají obchodní poplatky
- Price oracle: Cena Powfi DEX může napájet ZION výnosový systém

**Specifikace Powfi DEX:**
- CLMM (Concentrated Liquidity Market Maker) — jako Uniswap V3
- CPMM (Constant Product Market Maker) — jako Uniswap V2
- 100 % swap poplatků → xALPH stakers + ALPH buybacks/burns
- Auditoováno Trail of Bits (interní + externí)
- Postaveno v Ralph (smart contract jazyk ALPH)

### 8.5 Fáze D — Cross-Chain DeFi (Budoucnost)

**Cíl:** wZION použité v širším DeFi ekosystému ALPH.

| Protokol | Typ | ZION integrace |
|----------|------|-----------------|
| **AlphBanX** | CDP (collateralized debt) | wZION jako zástava → půjčit ALPH |
| **Linx App** | Půjčky | wZION lending/borrowing trh |
| **Nightshade / Elexium / AYIN** | DEX | Další wZION obchodní páry |
| **AlphPad** | Launchpad | ZION projekty spuštěny na ALPH |
| **xALPH staking** | Sdílení poplatků | xALPH stakers vydělávají z objemu obchodování ZION |

**Výsledek:** ZION token má užitečnost nad rámec těžby — stává se DeFi aktivem v ALPH ekosystému. To žene poptávku po ZION, což prospívá všem držitelům ZION a minerům.

### 8.6 Fáze E — DCRDEX Atomic Swaps (Budoucnost)

**Cíl:** Trustless obchodování ZION na DCRDEX (DEX Decred).

**Co je potřeba:**
1. **ZION atomic swap protokol** — implementovat HTLC (Hash Time-Locked Contracts) na ZION řetězci
2. **DCRDEX market integrace** — zařadit ZION jako obchodovatelný asset
3. **Bison Wallet integrace** — podpora ZION wallet v Bison Wallet

**Výhody:**
- Trustless obchodování: ZION ↔ DCR ↔ BTC ↔ LTC ↔ BCH (všechna DCRDEX-listovaná aktiva)
- Žádné obchodní poplatky (DCRDEX je bez poplatků)
- Non-custodial (mince nikdy neopustí vaši peněženku)
- Žádný zprostředkovatelský token

**Poznámka:** ZION již má atomic swap escrow na Base Mainnet (`ZIONAtomicSwap` contract, 100K ZION financováno). Stejný koncept může být implementován na ZION L1 pro DCRDEX integraci.

### 8.7 Synergie výnosů

```
ZION ↔ ALPH revenue synergy:

1. Merge mining (Phase A):
   ZION chain security ← ALPH/DCR hashrate (FREE)

2. Bridge (Phase B):
   Cross-chain transfers → bridge fees → ZION treasury

3. Powfi DEX (Phase C):
   wZION/ALPH trading → DEX fees → ALPH buybacks/burns
   (ALPH stakers benefit from ZION trading volume)

4. Cross-chain DeFi (Phase D):
   wZION as collateral → CDP fees → AlphBanX protocol
   wZION lending → interest → Linx App lenders

5. DCRDEX (Phase E):
   ZION atomic swaps → no fees, but increases ZION liquidity

Net result:
  ZION gets: chain security + token utility + liquidity + price discovery
  ALPH gets: DEX fees from ZION trading + bridge volume + ecosystem growth
  Both get:  stronger ecosystem, shared community, aligned incentives
```

### 8.8 Proč to záleží na ZION likviditě

**Současná ZION likvidita:** Omezena na Base Mainnet DEX (ZIONStaking, ZIONFarm) a atomic swap escrow.

**S ALPH DeFi integrací:**
- ZION obchodovatelný na Powfi DEX (hlavní DEX ALPH) — nový trh
- wZION jako zástava na AlphBanX — půjčky proti ZION
- Cross-chain bridge ALPH ↔ ZION — plynulý pohyb kapitálu
- DCRDEX atomic swaps — trustless obchodování s BTC, LTC atd.

**To vytváří více likviditních míst pro ZION bez spoléhání na centralizované burzy.**

---

## 9. Doporučená architektura

### 9.1 High-level design

```
┌──────────────────────────────────────────────────────────────────────┐
│                    ZION DUAL-ALGO MERGE MINING                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  PRE-FORK (height < AUXPOW_FORK_HEIGHT):                             │
│  ┌─────────────────────┐                                              │
│  │  deeksha_lite PoW   │ → ZION blocks (existing miners)             │
│  └─────────────────────┘                                              │
│                                                                       │
│  POST-FORK (height >= AUXPOW_FORK_HEIGHT):                           │
│                                                                       │
│  ┌─────────────────────┐    ┌──────────────────────────────────────┐ │
│  │  deeksha_lite PoW   │    │  Blake3 AuxPoW                       │ │
│  │  (standard blocks)  │    │                                      │ │
│  │                     │    │  Parent: DCR (primary) or ALPH (sec) │ │
│  │  Existing miners    │    │  Pool inserts ZION commitment        │ │
│  │  continue normally  │    │  into parent coinbase TX             │ │
│  │                     │    │                                      │ │
│  │  Difficulty: LWMA-1 │    │  Miner hashes parent header (Blake3) │ │
│  │  (deeksha_lite)     │    │  → if meets aux target: ZION block   │ │
│  └─────────────────────┘    │  → if meets parent target: parent    │ │
│                             │    block too (bonus!)                 │ │
│                             │                                       │ │
│                             │  Difficulty: LWMA-2 (blake3_auxpow)  │ │
│                             └───────────────────────────────────────┘ │
│                                       │                               │
│                                       ▼                               │
│                             ┌─────────────────────┐                   │
│                             │  ZION Chain          │                   │
│                             │  (accepts both       │                   │
│                             │   block types)       │                   │
│                             └─────────────────────┘                   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.2 Aktivace fork

```rust
// New constant in cosmic-harmony/src/lib.rs or core/src/lib.rs
pub const AUXPOW_FORK_HEIGHT: u64 = <TBD>;  // e.g., current_height + 1000

pub fn auxpow_active(height: u64) -> bool {
    height >= AUXPOW_FORK_HEIGHT
}
```

**Chování před fork:** Akceptovány pouze deeksha_lite bloky (stávající chování nezměněno).

**Chování po fork:**
- `deeksha_lite` bloky: Akceptovány, pokud splňují deeksha_lite obtížnost
- `blake3` AuxPoW bloky: Akceptovány, pokud splňují blake3_auxpow obtížnost A projdou AuxPoW proof validací

### 9.3 Detekce typu bloku

```rust
pub enum BlockType {
    /// Standard deeksha_lite block — hash computed from ZION header
    Standard,
    /// AuxPoW block — PoW proven on parent chain (Blake3)
    AuxPow { parent_chain: ParentChain },
}

impl BlockType {
    pub fn from_block(block: &AcceptedBlock) -> Self {
        if block.auxpow_proof.is_some() {
            BlockType::AuxPow { parent_chain: block.auxpow_proof.as_ref().unwrap().parent_chain }
        } else {
            BlockType::Standard
        }
    }
}
```

---

## 10. Formát bloku a validace

### 10.1 Standardní blok (nezměněn)

```rust
// Existing — no changes
pub struct AcceptedBlock {
    pub header: MiningHeader,      // 80 bytes
    pub nonce: u64,
    pub transactions: Vec<Transaction>,
    pub hash_hex: String,          // deeksha_lite hash
    pub auxpow_proof: None,        // Standard blocks have no AuxPoW proof
}
```

### 10.2 AuxPoW blok (nový)

```rust
pub struct AcceptedBlock {
    pub header: MiningHeader,      // 80 bytes — standard ZION header
    pub nonce: u64,                // Not used for AuxPoW (parent nonce is used)
    pub transactions: Vec<Transaction>,
    pub hash_hex: String,          // ZION block hash (for merkle/previous_hash linking)
    pub auxpow_proof: Option<AuxPowProof>,  // Present for AuxPoW blocks
}

pub struct AuxPowProof {
    /// Which parent chain was used for this proof
    pub parent_chain: ParentChain,
    /// Parent chain coinbase transaction (contains ZION block hash commitment)
    pub parent_coinbase_tx: Vec<u8>,
    /// Merkle branch: coinbase TX → parent block merkle root
    pub parent_merkle_branch: Vec<[u8; 32]>,
    /// Parent block header (raw bytes — DCR header is ~180 bytes, ALPH varies)
    pub parent_header: Vec<u8>,
    /// Parent block nonce (the nonce that solved the parent PoW)
    pub parent_nonce: u64,
    /// ZION chain merkle branch (for multi-chain merge mining support)
    pub chain_merkle_branch: Vec<[u8; 32]>,
    /// Index of ZION in the aux chain list (0 for single-chain)
    pub chain_index: u32,
}

pub enum ParentChain {
    Decred,
    Alephium,
}
```

### 10.3 Formát coinbase commitment

Podle Namecoin/Bitcoin AuxPoW standardu:

```
Parent coinbase scriptSig contains:
  [magic bytes: 0xfa 0xbe 'm' 'm']    — 4 bytes (merge mining magic)
  [ZION block hash: 32 bytes]          — hash of ZION aux block header
  [aux merkle size: 4 bytes LE]        — number of leaves in aux merkle tree
  [merkle nonce: 4 bytes LE]           — nonce for aux merkle tree computation

Total: 44 bytes inserted into parent coinbase
```

### 10.4 AuxPoW validace

```rust
fn validate_auxpow_block(
    block: &AcceptedBlock,
    aux_target: &DifficultyTarget,
    height: u64,
) -> Result<()> {
    // 0. Check fork is active
    if !auxpow_active(height) {
        return Err("AuxPoW not active at this height");
    }

    let proof = block.auxpow_proof.as_ref()
        .ok_or("block claims AuxPoW but has no proof")?;

    // 1. Compute parent block hash (Blake3)
    let parent_hash = blake3_pow(&proof.parent_header, proof.parent_nonce);

    // 2. Verify parent PoW meets ZION aux target (NOT parent target)
    if !meets_difficulty(&parent_hash, aux_target.as_bytes()) {
        return Err("parent PoW does not meet ZION aux target");
    }

    // 3. Verify parent coinbase contains ZION block hash commitment
    let zion_block_hash = block.header.hash();  // standard ZION header hash
    let aux_merkle_root = compute_aux_merkle_root(
        &zion_block_hash,
        &proof.chain_merkle_branch,
        proof.chain_index,
    );
    if !coinbase_contains_commitment(&proof.parent_coinbase_tx, &aux_merkle_root) {
        return Err("parent coinbase missing ZION commitment");
    }

    // 4. Verify parent coinbase TX is in parent block merkle tree
    let coinbase_tx_hash = blake256(&proof.parent_coinbase_tx);
    let computed_merkle_root = compute_merkle_root(
        &coinbase_tx_hash,
        &proof.parent_merkle_branch,
    );
    let parent_header_merkle_root = extract_merkle_root(&proof.parent_header, proof.parent_chain);
    if computed_merkle_root != parent_header_merkle_root {
        return Err("parent merkle branch invalid");
    }

    // 5. Standard ZION validation (transactions, merkle root, difficulty, etc.)
    validate_zion_transactions(&block.header, &block.transactions)?;
    validate_zion_merkle_root(&block.header, &block.transactions)?;

    // 6. Verify ZION header difficulty_bits matches blake3_auxpow difficulty
    let expected_bits = blake3_auxpow_difficulty_bits(height);
    if block.header.difficulty_bits != expected_bits {
        return Err("AuxPoW block difficulty_bits mismatch");
    }

    Ok(())
}
```

### 10.5 Dispatch validace

```rust
// peer_block_validation.rs (modified)
fn validate_peer_block(block: &AcceptedBlock, height: u64) -> Result<()> {
    // ... existing checkpoint validation ...

    if auxpow_active(height) && block.auxpow_proof.is_some() {
        // AuxPoW block — validate with blake3_auxpow difficulty
        let aux_target = blake3_auxpow_target(height);
        validate_auxpow_block(block, &aux_target, height)?;
    } else {
        // Standard block — validate with deeksha_lite (existing behavior)
        let hash = cosmic_harmony_with_height(&block.header.to_bytes(), block.nonce, height);
        if !meets_difficulty(&hash.data, &target) {
            return Err("PoW does not meet target");
        }
    }

    // ... rest of validation (timestamp, transactions, etc.) ...
    Ok(())
}
```

---

## 11. Úprava obtížnosti

### 11.1 Dual tracking obtížnosti

```rust
// difficulty.rs (modified)

pub struct DualDifficultyState {
    /// deeksha_lite difficulty (for standard blocks)
    pub standard: DifficultyState,
    /// blake3 AuxPoW difficulty (for AuxPoW blocks)
    pub auxpow: DifficultyState,
}

impl DualDifficultyState {
    pub fn next_target(&self, block_type: BlockType, height: u64) -> DifficultyTarget {
        match block_type {
            BlockType::Standard => self.standard.next_target(height),
            BlockType::AuxPow { .. } => self.auxpow.next_target(height),
        }
    }

    pub fn record_block(&mut self, block_type: BlockType, timestamp: u64, height: u64) {
        match block_type {
            BlockType::Standard => self.standard.record_block(timestamp, height),
            BlockType::AuxPow { .. } => self.auxpow.record_block(timestamp, height),
        }
    }
}
```

### 11.2 Parametry obtížnosti

| Parametr | Standard (deeksha_lite) | AuxPoW (blake3) |
|-----------|------------------------|------------------|
| Cílový čas bloku | 120 s (každý druhý blok) | 120 s (každý druhý blok) |
| Kombinovaný cíl | 60 s průměrně | 60 s průměrně |
| Okno | 60 bloků | 60 bloků |
| Min obtížnost | 1 000 | 1 (Blake3 je rychlý — nižší obtížnost) |
| Algoritmus | LWMA | LWMA |

**Odůvodnění:** S dual-algo se očekává, že každý algoritmus vyprodukuje ~50 % bloků. Nastavení cíle každého algoritmu na 120 s dává dohromady 60 s průměrně. LWMA se upravuje nezávisle na základě skutečných časů bloků pro každý algoritmus.

### 11.3 Uložení obtížnosti

Stav řetězce musí ukládat dva trackery obtížnosti. To vyžaduje změnu databázového schématu:

```
chain_state:
  height: u64
  standard_difficulty: DifficultyState  // existing field
  auxpow_difficulty: DifficultyState    // NEW field
  auxpow_fork_height: u64               // NEW field
```

---

## 12. Pool merge-mining proxy

### 12.1 Architektura

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ZION POOL (Merge Mining Proxy)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ ZION Node    │    │ DCR Pool     │    │ ALPH Pool    │          │
│  │ RPC          │    │ (2miners)    │    │ (2miners)    │          │
│  │ 127.0.0.1:   │    │ Stratum v1   │    │ Stratum v1   │          │
│  │ 8443         │    │ (primary)    │    │ (secondary)  │          │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘          │
│         │                   │                   │                   │
│         │ getauxblock       │ mining.notify     │ mining.notify     │
│         │ (ZION template)   │ (DCR template)    │ (ALPH template)   │
│         ▼                   ▼                   ▼                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              MERGE MINING ORCHESTRATOR                       │  │
│  │                                                              │  │
│  │  1. Get ZION aux template (getauxblock RPC)                 │  │
│  │  2. Get parent template (DCR or ALPH, profit-switch)        │  │
│  │  3. Insert ZION block hash into parent coinbase script      │  │
│  │  4. Build composite job: parent header + ZION commitment    │  │
│  │  5. Send composite job to miners via Stratum                │  │
│  │  6. Receive shares from miners                              │  │
│  │  7. If share meets parent target → submit to parent pool    │  │
│  │  8. If share meets ZION aux target → submit to ZION node    │  │
│  │     (submitauxblock RPC with AuxPoW proof)                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                │                                    │
│                                ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              STRATUM SERVER (:8444)                          │  │
│  │                                                              │  │
│  │  Mining modes:                                               │  │
│  │  1. Standard mode: deeksha_lite jobs (existing)             │  │
│  │  2. AuxPoW mode: composite DCR/ALPH jobs (new)              │  │
│  │                                                              │  │
│  │  Miner connects → pool decides which mode to assign          │  │
│  │  based on miner capabilities and profit optimization         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 12.2 Nové RPC metody

```json
// getauxblock — returns ZION aux template for merge mining
// Request:
{ "method": "getauxblock", "params": [] }

// Response:
{
  "result": {
    "hash": "<ZION block hash hex>",
    "header_hex": "<80-byte ZION header hex>",
    "target_hex": "<32-byte aux target hex>",
    "height": <current ZION height>,
    "difficulty": <auxpow difficulty>
  }
}

// submitauxblock — submits AuxPoW block to ZION node
// Request:
{
  "method": "submitauxblock",
  "params": [
    "<ZION block hash hex>",
    "<parent coinbase TX hex>",
    "<parent merkle branch hex[]>",
    "<parent header hex>",
    "<parent nonce>",
    "<chain merkle branch hex[]>",
    "<chain index>"
  ]
}

// Response:
{ "result": true }
```

### 12.3 Konstrukce pool job

```rust
// pool/src/bin/server.rs (new merge mining proxy)

async fn build_composite_job(
    zion_template: &AuxBlockTemplate,
    parent_template: &ParentBlockTemplate,
    parent_chain: ParentChain,
) -> CompositeJob {
    // 1. Compute ZION block hash from aux template
    let zion_block_hash = hash_zion_header(&zion_template.header);

    // 2. Build aux commitment for parent coinbase
    let commitment = build_aux_commitment(
        &zion_block_hash,
        chain_merkle_size,  // 1 for single-chain
        chain_merkle_nonce, // random
    );

    // 3. Insert commitment into parent coinbase scriptSig
    let modified_coinbase = insert_commitment(&parent_template.coinbase_tx, &commitment);

    // 4. Recompute parent merkle root with modified coinbase
    let modified_merkle_root = compute_merkle_root_with_coinbase(
        &modified_coinbase,
        &parent_template.merkle_branches,
    );

    // 5. Build composite parent header with modified merkle root
    let composite_header = parent_template.header.with_merkle_root(modified_merkle_root);

    CompositeJob {
        parent_header: composite_header,
        parent_chain,
        zion_block_hash,
        aux_target: zion_template.target,
        parent_target: parent_template.target,
    }
}
```

### 12.4 Zpracování share

```rust
async fn process_merge_share(share: &MergeShare) -> ShareResult {
    // 1. Recompute parent hash (Blake3)
    let parent_hash = blake3_pow(&share.parent_header, share.parent_nonce);

    // 2. Check if meets parent target → submit to parent pool
    if meets_difficulty(&parent_hash, &share.parent_target) {
        submit_to_parent_pool(share).await;
        // Parent block found! ZION AuxPoW block is also valid.
    }

    // 3. Check if meets ZION aux target → submit to ZION node
    if meets_difficulty(&parent_hash, &share.aux_target) {
        let auxpow_proof = build_auxpow_proof(share);
        submit_auxblock_to_zion_node(&share.zion_block_hash, &auxpow_proof).await;
        // ZION block found!
    }

    // 4. Check if meets share target (vardiff) → count as share
    if meets_difficulty(&parent_hash, &share.share_target) {
        return ShareResult::Accepted;
    }

    ShareResult::RejectedLowDifficulty
}
```

---

## 13. Podpora mineru

### 13.1 Standardní mineři (bez změny)

Stávající deeksha_lite mineři pokračují v těžbě ZION bloků jako dříve. Nejsou potřeba žádné změny.

### 13.2 Blake3 mineři (noví)

Mineři, kteří chtějí merge-minovat, se připojí k ZION poolu a obdrží composite jobs (rodičovská hlavička se ZION commitment). Hashují Blake3 a odesílají share.

**Kompatibilní mineři:**
- Jakýkoliv Blake3 miner (CPU, GPU, ASIC)
- DCR ASIC (pokud směřovány na ZION pool místo DCR poolu)
- ALPH GPU mineři (např. T-Rex, lolminer)
- Vlastní Blake3 CPU miner (můžeme jeden postavit)

### 13.3 ZION miner binárka (nový režim)

```rust
// V3/L1/miner/src/main.rs (new --merge-mining flag)

fn main() {
    let args = parse_args();
    if args.merge_mining {
        // Connect to ZION pool in AuxPoW mode
        // Receive composite jobs (parent header + ZION commitment)
        // Hash Blake3
        // Submit shares
        run_blake3_miner(args).await;
    } else {
        // Standard deeksha_lite mining (existing)
        run_deeksha_miner(args).await;
    }
}
```

### 13.4 Blake3 CPU mining

```rust
// V3/L1/miner/src/blake3_cpu.rs (new)

pub fn blake3_mine(header: &[u8], start_nonce: u64, count: u64, target: &[u8; 32]) -> Option<(u64, [u8; 32])> {
    for offset in 0..count {
        let nonce = start_nonce.wrapping_add(offset);
        let mut input = Vec::with_capacity(header.len() + 8);
        input.extend_from_slice(header);
        input.extend_from_slice(&nonce.to_le_bytes());
        let hash = blake3::hash(&input);
        let hash_bytes = hash.as_bytes();
        if meets_difficulty(hash_bytes, target) {
            return Some((nonce, *hash_bytes));
        }
    }
    None
}
```

### 13.5 Blake3 GPU mining

Blake3 je mnohem jednodušší než deeksha_lite — základní OpenCL kernel lze napsat asi v 200 řádcích. Alternativně lze přizpůsobit stávající Blake3 GPU implementace.

---

## 14. Analýza GPU kernelu

### 14.1 Stávající GPU kernel

| Kernel | Soubor | Algoritmus | Status |
|--------|------|-----------|--------|
| Ekam Deeksha v2 | `cosmic_harmony_deeksha.cl` | Plný CHv4 pipeline (Keccak→SHA3→Matrix→Fusion→NPU) | ✅ Produkce |
| DeekshaLite v1 | `deeksha_lite.cl` | 256 KiB scratchpad, Keccak+SHA3+AES | ✅ Produkce |
| DeekshaLite Fire | `deeksha_lite_fire.cl` | v1 + thermal loop | ✅ Produkce |
| DeekshaLite Fire CUDA | `deeksha_lite_fire.cu` | CUDA variant Fire | ✅ Produkce |
| SHA3 test | `sha3_test.cl` | SHA3-512 testovací kernel | ✅ Test |

### 14.2 Blake3 GPU kernel (k implementaci)

Blake3 je výrazně jednodušší než deeksha_lite:
- Žádný krok scratchpad (memory-hard)
- Žádné AES šifrování
- Žádný thermal loop
- Jen Blake3 hash hlavičky + nonce

**Možnosti implementace:**
1. **Napsat vlastní OpenCL kernel** (~200-300 řádků, na základě Blake3 reference)
2. **Použít stávající Blake3 GPU implementaci** (např. z DCR mining softwaru)
3. **Použít `blake3` crate na CPU** (jednodušší, ale pomalejší než GPU)

**Doporučení:** Začít s CPU `blake3` crate (nejjednodušší, okamžité). GPU kernel přidat později, pokud to hashrate vyžaduje.

### 14.3 OpenCL integrace

```rust
// V3/L1/cosmic-harmony/src/gpu/opencl_kernel.rs (existing pattern)
// Already has infrastructure for loading/running OpenCL kernels
// Can be extended to load blake3.cl kernel
```

---

## 15. Integrace výnosového systému

### 15.1 Stávající RevenueSource mapování

Výnosový systém již má `Blake3External` pro sledování DCR/ALPH výnosů. Pro merge mining:

```rust
// New RevenueSource variant (or reuse existing)
pub enum RevenueSource {
    // ... existing variants ...
    /// Revenue from AuxPoW merge mining (ZION blocks found via parent chain PoW)
    AuxPowMergeMining,
}
```

**Nebo znovu použít `Blake3External`** — protože výnos z merge mining JE z Blake3 externích mincí.

### 15.2 Sledování výnosů pro AuxPoW bloky

```rust
// When an AuxPoW block is accepted on ZION chain:
revenue_collector.track_zion_block(
    height: block.height,
    subsidy: block.reward,
    pool_fee_pct: 1,
    tx_hash: Some(block.hash_hex),
);

// Additionally track the parent chain revenue (BTC payout from parent pool)
revenue_collector.track_event(
    RevenueEvent::new(RevenueSource::Blake3External, estimated_btc_value, true)
        .with_height(block.height)
        .with_external_coin(parent_chain.ticker()),
);
```

### 15.3 Integrace Stream Layers

`stream_layers.rs` DeekshaStreamTelemetry mapuje 6-krokový pipeline na výnosové streamy. Pro AuxPoW bloky je potřeba samostatná cesta telemetrie:

```rust
// AuxPoW blocks don't go through the deeksha pipeline
// They use Blake3 on the parent chain
// Revenue tracking is simpler: ZION block reward + parent pool BTC payout

pub enum MiningMode {
    Standard,  // deeksha_lite — full pipeline telemetry
    AuxPow,    // blake3 — simple revenue tracking
}
```

### 15.4 Integrace profit router

`profit_router.rs` již má `ExternalCoin::DCR` a `ExternalCoin::ALPH` s Blake3 algoritmem. Merge mining proxy může použít stávající funkci `select_best_coin()` pro volbu mezi DCR a ALPH jako rodičovským řetězcem:

```rust
// Use existing profit router to pick best parent chain
let entries = vec![
    ProfitEntry { coin: ExternalCoin::DCR, revenue_per_day_usd: dcr_revenue, power_cost_usd: dcr_cost },
    ProfitEntry { coin: ExternalCoin::ALPH, revenue_per_day_usd: alph_revenue, power_cost_usd: alph_cost },
];
let best_parent = select_best_coin(&entries, current_parent, 5.0);  // 5% hysteresis
```

---

## 16. Fáze implementace

### Fáze 1 — Blake3 PoW modul (2-3 dny)

**Cíl:** Přidat Blake3 hashovací schopnost do cosmic-harmony crate.

**Soubory:**
- `V3/L1/cosmic-harmony/src/blake3_pow.rs` (NEW) — `blake3_pow(header, nonce) -> [u8; 32]`
- `V3/L1/cosmic-harmony/src/lib.rs` — export `blake3_pow` module

**Testy:**
- Blake3 hash determinismus
- Known-answer test vektory
- Kontrola difficulty target

**Zatím žádný hard fork** — pouze přidání schopnosti.

### Fáze 2 — Formát a typy AuxPoW bloku (3-4 dny)

**Cíl:** Definovat AuxPoW block types a validační logiku.

**Soubory:**
- `V3/L1/core/src/lib.rs` — `AuxPowProof`, `ParentChain`, `BlockType`, extend `AcceptedBlock`
- `V3/L1/core/src/peer_block_validation.rs` — `validate_auxpow()` function
- `V3/L1/core/src/aux_merkle.rs` (NEW) — aux merkle root computation, coinbase commitment

**Testy:**
- Valid/invalid AuxPoW proof konstrukce
- Coinbase commitment encoding/decoding
- Merkle branch verification
- Edge cases (prázdné větve, jediný list)

**Zatím žádný hard fork** — validační kód existuje, ale není aktivován.

### Fáze 3 — Dual difficulty systém (2-3 dny)

**Cíl:** Implementovat oddělené sledování obtížnosti pro standardní a AuxPoW bloky.

**Soubory:**
- `V3/L1/core/src/difficulty.rs` — `DualDifficultyState`, separate LWMA for each algorithm
- `V3/L1/core/src/chain.rs` — store/retrieve dual difficulty state

**Testy:**
- Dual LWMA adjustment
- Independent difficulty tracking
- Fork height activation

### Fáze 4 — RPC a Node integrace (3-4 dny)

**Cíl:** Přidat RPC metody `getauxblock` a `submitauxblock` do ZION node.

**Soubory:**
- `V3/L1/core/src/rpc.rs` (or equivalent) — new RPC methods
- `V3/L1/core/src/chain.rs` — accept both standard and AuxPoW blocks
- `V3/L1/core/src/peer_block_validation.rs` — dispatch standard vs AuxPoW validation

**Testy:**
- End-to-end AuxPoW block submission přes RPC
- Standard + AuxPoW bloky na stejném řetězci
- Fork height enforcement

### Fáze 5 — Pool merge mining proxy (4-5 dny)

**Cíl:** Pool orchestruje merge mining mezi ZION a rodičovskými řetězci.

**Soubory:**
- `V3/L1/pool/src/bin/server.rs` — merge mining orchestrator
- `V3/L1/pool/src/merge_proxy.rs` (NEW) — parent pool Stratum client, composite job builder
- `AuXpow/src/merge_miner.rs` (NEW) — merge mining orchestrator (alternative location)
- `AuXpow/src/types.rs` — AuxPoW proof types

**Testy:**
- Mock parent pool → composite job construction
- Share submission → parent pool + ZION node
- Profit switching mezi DCR a ALPH

### Fáze 6 — Blake3 podpora mineru (2-3 dny)

**Cíl:** ZION miner může hashovat Blake3 pro AuxPoW jobs.

**Soubory:**
- `V3/L1/miner/src/main.rs` — `--merge-mining` flag
- `V3/L1/miner/src/blake3_cpu.rs` (NEW) — CPU Blake3 mining
- `V3/L1/miner/src/blake3_gpu.rs` (NEW, optional) — GPU Blake3 mining (OpenCL)

**Testy:**
- Blake3 hashrate benchmark
- Share submission do poolu

### Fáze 7 — Aktivace fork a deploy (1-2 dny)

**Cíl:** Nastavit fork height, nasadit, aktivovat.

**Kroky:**
1. Nastavit `AUXPOW_FORK_HEIGHT` na `current_height + ~1000` bloků (~16 hodin)
2. Nasadit aktualizovanou node binárku na všechny nody
3. Nasadit aktualizovanou pool binárku
4. Monitorovat aktivaci fork
5. Ověřit, že jsou akceptovány standardní i AuxPoW bloky

### Fáze 8 — Živý test (1-2 dny)

**Cíl:** Ověřit, že merge mining funguje na živé síti.

**Kroky:**
1. Pool se připojí k DCR poolu (2miners nebo jiný DCR pool) — primární rodič
2. Pool obdrží DCR templates + ZION aux templates
3. Miner hashuje Blake3 na composite jobs
4. Ověřit: DCR share akceptovány na rodičovském poolu
5. Ověřit: ZION AuxPoW bloky akceptovány na ZION řetězci
6. Monitorovat: ZION chain height roste z standardních i AuxPoW bloků
7. (Sekundární) Opakovat s ALPH poolem pro ověření multi-parent podpory

**Odhadovaný celkový čas: 18-26 dní**

---

## 17. Analýza rizik

| Riziko | Dopad | Pravděpodobnost | Mitigace |
|------|--------|-------------|------------|
| **Nesoulad bezpečnosti dual-algo** | Jeden algoritmus by mohl dominovat, centralizovat těžbu | Střední | Oddělené LWMA zajišťuje spravedelné rozdělení bloků |
| **Podvržení AuxPoW proof** | Útočník odesílá falešné AuxPoW bloky | Nízká | Přísná validace: rodičovský PoW + coinbase commitment + merkle branch |
| **Reorg rodičovského řetězce** | ZION AuxPoW bloky osiřejí při reorg rodiče | Střední | ZION by neměl vyžadovat rodičovská potvrzení — AuxPoW bloky jsou finální, jakmile jsou akceptovány na ZION (stejné jako Namecoin model) |
| **Selhání aktivace fork** | Nody se včas neupgradují, řetězec se rozštěpí | Nízká | Nastavit fork height dostatečně dopředu (~1000 bloků = 16 hodin). Jasně komunikovat. |
| **Oscilace obtížnosti** | Dual difficulty způsobuje kolísající časy bloků | Střední | LWMA se samovolně koriguje. Monitorovat a případně upravit parametry. |
| **Závislost na rodičovském poolu** | Výpadek DCR/ALPH poolu zastaví AuxPoW mining | Nízká | Multi-parent podpora (DCR + ALPH) poskytuje fallback. Standardní těžba pokračuje. |
| **Chyba v implementaci Blake3** | Neplatné hash, selhání konsensu | Střední | Rozsáhlé test vektory. Použít dobře auditovaný `blake3` crate. |
| **Parsování coinbase commitment** | Rodičovský pool změní formát coinbase | Nízká | Formát commitment je standardní (Namecoin model). Testovat se skutečnými pool templates. |
| **Zmatení mineře** | Mineři nerozumí dual-algo | Střední | Jasná dokumentace. Pool zajišťuje výběr režimu — mineři se jen připojí. |

### 17.1 Bezpečnostní úvahy

**AuxPoW vektory útoku:**
1. **Falešný rodičovský blok:** Útočník vytvoří falešnou rodičovskou hlavičku bloku s platným Blake3 PoW, ale bez reálného rodičovského řetězce. **Mitigace:** Toto je ve skutečnosti VALID v Namecoin modelu — ZION nevyžaduje, aby rodičovský blok byl na rodičovském řetězci. Bezpečnost pochází z Blake3 PoW obtížnosti, nikoli z akceptace rodičovským řetězcem.

2. **Manipulace commitment:** Útočník se pokouší nárokovat rodičovský blok pro jiný ZION blok. **Mitigace:** Coinbase commitment kryptograficky váže rodičovský PoW na konkrétní ZION block hash.

3. **Replay útoky:** Stejný AuxPoW proof odeslaný pro různé ZION výšky. **Mitigace:** ZION block hash obsahuje `previous_hash` a `height`, čímž je každý proof unikátní pro konkrétní pozici na ZION řetězci.

---

## 18. Testovací plán

### 18.1 Unit testy

| Test | Popis | Validace |
|------|-------------|------------|
| `blake3_pow_determinism` | Stejný vstup → stejný hash | Hash se shoduje napříč běhy |
| `blake3_pow_kat_vectors` | Known-answer test vektory | Hash odpovídá známým hodnotám |
| `blake3_pow_meets_difficulty` | Porovnání hash vs target | Lehký hash projde, těžký neprojde |
| `auxpow_proof_construction` | Sestavení validního AuxPoW proof | Všechna pole správně naplněna |
| `auxpow_proof_validation_valid` | Validace správně sestaveného proof | Validace projde |
| `auxpow_proof_validation_invalid_pow` | Rodičovský PoW nesplňuje aux target | Validace selže |
| `auxpow_proof_validation_missing_commitment` | Coinbase nemá ZION commitment | Validace selže |
| `auxpow_proof_validation_bad_merkle` | Merkle branch neodpovídá | Validace selže |
| `aux_merkle_root_single_chain` | Single aux chain merkle root | Root = leaf hash |
| `aux_merkle_root_multi_chain` | Multi aux chain merkle root | Root správně vypočítán |
| `coinbase_commitment_encode_decode` | Round-trip encoding | Dekódované odpovídá původnímu |
| `dual_difficulty_lwma` | Dual LWMA adjustment | Každý algoritmus se upravuje nezávisle |
| `fork_height_activation` | Chování před fork vs po fork | AuxPoW odmítnut před fork, akceptován po fork |

### 18.2 Integrační testy

| Test | Popis | Validace |
|------|-------------|------------|
| `submit_auxblock_rpc` | Odeslání AuxPoW bloku přes RPC | Blok akceptován, řetězec postupuje |
| `standard_and_auxpow_same_chain` | Oba typy bloků na stejném řetězci | Řetězec akceptuje oba, height roste |
| `mock_parent_pool_composite_job` | Mock DCR pool → composite job | Job má správnou rodičovskou hlavičku + ZION commitment |
| `mock_merge_share_submission` | Share → parent pool + ZION node | Oba submissiony úspěšné |
| `profit_switch_dcr_alph` | Přepínat mezi DCR a ALPH | Pool správně přepíná rodičovský řetězec |

### 18.3 Živé testy

| Test | Popis | Validace |
|------|-------------|------------|
| `live_dcr_merge_mining` | Pool se připojí k 2miners DCR | DCR share akceptovány |
| `live_auxpow_block` | Nalezen ZION AuxPoW blok | Blok akceptován na ZION řetězci |
| `live_dual_algo` | Standardní i AuxPoW bloky | Oba typy se objeví v řetězci |

---

## 19. Soubory ke změně

### 19.1 Core (V3/L1/core/)

| Soubor | Změna | Popis |
|------|--------|-------------|
| `src/lib.rs` | NOVÉ typy | `AuxPowProof`, `ParentChain`, `BlockType`, extend `AcceptedBlock` with `auxpow_proof: Option<AuxPowProof>` |
| `src/lib.rs` | NOVÁ konstanta | `AUXPOW_FORK_HEIGHT` |
| `src/lib.rs` | NOVÁ funkce | `auxpow_active(height) -> bool` |
| `src/lib.rs` | ZMĚNA | `hash_with_algorithm()` — přidat `"blake3"` algoritmus |
| `src/peer_block_validation.rs` | NOVÁ | `validate_auxpow()` funkce |
| `src/peer_block_validation.rs` | ZMĚNA | Dispatch standard vs AuxPoW validace |
| `src/difficulty.rs` | NOVÝ | `DualDifficultyState` struct |
| `src/difficulty.rs` | ZMĚNA | Oddělené LWMA pro standard a AuxPoW |
| `src/chain.rs` | ZMĚNA | Uložit dual difficulty state, akceptovat oba typy bloků |
| `src/rpc.rs` | NOVÉ | `getauxblock`, `submitauxblock` RPC metody |
| `src/aux_merkle.rs` | NOVÝ | Výpočet aux merkle root, coinbase commitment |

### 19.2 Cosmic Harmony (V3/L1/cosmic-harmony/)

| Soubor | Změna | Popis |
|------|--------|-------------|
| `src/blake3_pow.rs` | NOVÝ | `blake3_pow(header, nonce) -> [u8; 32]` |
| `src/lib.rs` | ZMĚNA | Export `blake3_pow` modulu, přidat `AUXPOW_FORK_HEIGHT` |

### 19.3 Pool (V3/L1/pool/)

| Soubor | Změna | Popis |
|------|--------|-------------|
| `src/lib.rs` | ZMĚNA | `ShareSubmission` s `auxpow_proof` polem, dispatch standard vs AuxPoW |
| `src/bin/server.rs` | ZMĚNA | Merge mining orchestrator, composite job builder |
| `src/merge_proxy.rs` | NOVÝ | Parent pool Stratum client, profit switching mezi DCR/ALPH |

### 19.4 Miner (V3/L1/miner/)

| Soubor | Změna | Popis |
|------|--------|-------------|
| `src/main.rs` | ZMĚNA | `--merge-mining` flag, dispatch blake3 vs deeksha_lite |
| `src/blake3_cpu.rs` | NOVÝ | CPU Blake3 mining |
| `src/blake3_gpu.rs` | NOVÝ (volitelný) | GPU Blake3 mining (OpenCL) |

### 19.5 AuXpow crate

| Soubor | Změna | Popis |
|------|--------|-------------|
| `src/types.rs` | ZMĚNA | Přidat `AuxPowProof`, `ParentChain` typy (pokud nejsou v core) |
| `src/merge_miner.rs` | NOVÝ | Merge mining orchestrator (alternativa k pool/src/merge_proxy.rs) |

### 19.6 GPU kernel

| Soubor | Změna | Popis |
|------|--------|-------------|
| `V3/L1/cosmic-harmony/src/gpu/kernels/blake3.cl` | NOVÝ | OpenCL Blake3 kernel (volitelný, Fáze 6+) |

---

## 20. Otevřené otázky

### Q1: Jaká by měla být AUXPOW_FORK_HEIGHT?

**Možnosti:**
- **Současná výška + 1000** (~16 hodin předstihu) — rychlé nasazení
- **Současná výška + 4320** (~3 dny předstihu) — více času pro upgrade mineřů
- **Fixní budoucí výška** (např. blok 10000) — předvídatelné, ale může být příliš daleko

**Doporučení:** Současná výška + 1000 (rychlé nasazení, ale dostatek času pro upgrade všech nod).

### Q2: Měly by být deeksha_lite bloky časem deprecated?

**Možnosti:**
- **Zachovat dual-algo navždy** — oba algoritmy vždy akceptovány
- **Sunset deeksha_lite po X blocích** — nakonec pouze Blake3
- **Nechat trh rozhodnout** — pokud AuxPoW dominuje, deeksha_lite přirozeně zanikne

**Doporučení:** Zachovat dual-algo navždy. Žádný nucený sunset. Nechat mineře, ať si vyberou.

### Q3: Formát DCR block header — je kompatibilní?

DCR block headery jsou ~180 bytes (odlišné od ZION 80 bytes). AuxPoW proof ukládá raw bytes rodičovské hlavičky, takže to není problém — ZION nemusí parsovat DCR header, pouze ho hashovat Blake3 a extrahovat merkle root.

**Potřebná akce:** Ověřit formát DCR header a extrakci merkle root během Fáze 2.

### Q4: Formát ALPH block header — je kompatibilní?

ALPH používá jiný formát bloku než DCR. Potřeba ověřit:
- Velikost a rozložení ALPH header
- Formát ALPH coinbase TX
- Výpočet ALPH merkle root

**Potřebná akce:** Prozkoumat formát ALPH bloku během Fáze 5.

### Q5: Měl by být zachován stávající AuXpow Stratum proxy?

Současný `AuXpow` crate těží externí mince nezávisle (solo mining na externích pooloch). To je oddělené od merge mining.

**Možnosti:**
- **Zachovat oba** — AuXpow proxy pro non-Blake3 mince (KAS, ERG, RVN atd.) + merge mining pro Blake3 mince (DCR, ALPH)
- **Nahradit AuXpow** — merge mining dělá proxy redundantní pro Blake3 mince, ale non-Blake3 mince stále potřebují proxy

**Doporučení:** Zachovat oba. Slouží různým účelům:
- `AuXpow` proxy: Výnos z non-Blake3 externích mincí (KAS, ERG, RVN, ETC atd.)
- Merge mining: Bezpečnost ZION řetězce z Blake3 rodičovských řetězců (DCR, ALPH)

### Q6: Jak zachovat rodičovskou obtížnost vs ZION aux obtížnost?

ZION aux obtížnost bude typicky NIŽŠÍ než DCR obtížnost. To znamená:
- Každý nalezený DCR blok také splňuje ZION aux target → ZION blok
- Ale ne každý hash splňující ZION aux target je DCR blok

Toto je standardní AuxPoW model (stejné jako Namecoin/Bitcoin). Pool musí zvládnout oba případy:
- Hash splňuje rodičovský target → odeslat jak rodičovi, tak ZION
- Hash splňuje pouze aux target → odeslat pouze ZION (rodičovský pool to nechce)

### Q7: Rozdělení výnosu — jak kompenzovat merge minery?

**Možnosti:**
- **Stejné jako standardní bloky** — merge miner získá plný ZION block reward (89 % miner, 5 % humanitarian, 5 % issobella, 1 % pool)
- **Snížená odměna** — merge mineři dostanou méně ZION, protože také vydělávají z rodičovského řetězce
- **Bonusová odměna** — merge mineři dostanou VÍCE ZION k incentivaci merge mining

**Doporučení:** Stejné jako standardní bloky. ZION block reward je nezávislý na výnosech rodičovského řetězce. Merge mineři vydělávají ZION (z AuxPoW bloků) + BTC (z rodičovského poolu) — oba jsou legitimní výnosy.

---

## Příloha A: Namecoin AuxPoW reference

### A.1 Coinbase commitment

```
Script format in parent coinbase:
  0xfa 0xbe 'm' 'm'           — 4 bytes magic (0xfabe6d6d)
  [aux_block_hash: 32 bytes]   — hash of aux block (ZION block hash)
  [merkle_size: 4 bytes LE]    — number of aux chains being merge-mined
  [merkle_nonce: 4 bytes LE]   — nonce for aux merkle tree

Total: 44 bytes
```

### A.2 Aux merkle root

For single-chain merge mining (ZION only):
```
aux_merkle_root = zion_block_hash  (single leaf = root)
```

For multi-chain merge mining (ZION + others):
```
aux_merkle_root = merkle_root([chain_0_hash, chain_1_hash, ...])
```

### A.3 Chain merkle branch

The chain merkle branch proves that ZION's block hash is included in the aux merkle root:
```
chain_merkle_branch = [sibling_hashes...]
chain_index = position of ZION in the aux chain list
```

For single-chain: `chain_merkle_branch = []`, `chain_index = 0`.

---

## Příloha B: Detaily DCR Blake3 PoW

### B.1 DCR block header (180 bytes)

```
Version:      4 bytes (uint32)
Previous:    32 bytes (hash)
MerkleRoot:  32 bytes (merkle root of transactions)
StakeRoot:   32 bytes (merkle root of stake transactions)
VoteBits:     2 bytes (uint16)
FinalState:   6 bytes
Voters:       2 bytes (uint16)
StakeVersion: 4 bytes (uint32)
Timestamp:    4 bytes (uint32, Unix seconds)
Bits:         4 bytes (uint32, difficulty bits)
Nonce:        4 bytes (uint32)  — NOTE: only 4 bytes, not 8!
```

**DŮLEŽITÉ:** DCR nonce je 4 bytes (uint32), nikoli 8 bytes jako ZION. Pole `parent_nonce` v `AuxPowProof` by mělo zvládnout obě velikosti.

### B.2 DCR PoW hash

```rust
// DCR PoW: Blake3(header[0..180])
// Note: DCR uses BLAKE3 for PoW hash since DCP-0011
let pow_hash = blake3::hash(&dcr_header[..180]);
```

### B.3 DCR merkle root

DCR používá BLAKE-256 (14 rounds) pro hash transakcí, poté Bitcoin-style merkle tree pro merkle root.

---

## Příloha C: Detaily ALPH Blake3 PoW

### C.1 ALPH block header

ALPH používá jiný formát hlavičky než DCR. Výzkum potřebný během Fáze 5 pro určení:
- Přesná velikost a rozložení header
- Velikost a pozice nonce
- Umístění pole merkle root
- Formát coinbase transakce

### C.2 ALPH PoW hash

```rust
// ALPH PoW: Blake3(header + nonce)
// Exact input format TBD — research needed
```

---

## Příloha D: Reference existujícího codebase

| Komponenta | Soubor | Význam |
|-----------|------|------------|
| PoW dispatch | `cosmic-harmony/src/algorithms_opt.rs:172` | `cosmic_harmony_with_height()` — jediný vstupní bod |
| Fork heights | `cosmic-harmony/src/deeksha.rs:14-22` | Height-gated fork pattern |
| Fire fork | `cosmic-harmony/src/lib.rs` | `FIRE_FORK_HEIGHT = 5000` — precedenta pro budoucí fork |
| Block header | `V3/L1/core/src/lib.rs:142` | `MiningHeader` (80 bytes) |
| Block validation | `V3/L1/core/src/peer_block_validation.rs` | `validate_peer_block()` |
| Difficulty | `V3/L1/core/src/difficulty.rs` | Implementace LWMA |
| Pool share validation | `V3/L1/pool/src/lib.rs:420-455` | `ShareSubmission` s `algorithm` polem |
| Revenue system | `cosmic-harmony/src/revenue.rs` | `RevenueSource::Blake3External` |
| Profit router | `cosmic-harmony/src/profit_router.rs` | `ExternalCoin::DCR`, `ExternalCoin::ALPH` |
| External coin pools | `profit_router.rs:138-152` | DCR/ALPH pool adresy |
| AuXpow crate | `AuXpow/src/` | Stávající Stratum proxy (Fáze 1) |
| GPU kernels | `cosmic-harmony/src/gpu/kernels/` | Stávající OpenCL/CUDA kernel |
| NPU mixing | `cosmic-harmony/src/algorithms_npu.rs` | INT8 MLP (není relevantní pro merge mining) |
| Stream telemetry | `cosmic-harmony/src/stream_layers.rs` | Revenue-aware pipeline telemetry |
| Revenue journal | `cosmic-harmony/src/revenue_journal.rs` | Append-only audit log |
| NCL integration | `cosmic-harmony/src/ncl_integration.rs` | AI compute layer (25% alokace) |

---

*Tento dokument je komplexní analýza a implementační plán pro pravé AuxPoW merge mining. Žádná implementace by neměla začít, dokud nebudou vyřešeny otevřené otázky v §20 a uživatel schválí plán.*

*Související: [`docs/3.0.5/AUXPOW_INTEGRATION_REPORT_2026-07-11.md`](./docs/3.0.5/AUXPOW_INTEGRATION_REPORT_2026-07-11.md) (Zpráva o Stratum proxy Fáze 1), [`StatusV3.md`](./StatusV3.md) (aktuální stav)*
