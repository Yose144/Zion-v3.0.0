# ZION AuxPow — Merge Mining Plan

**Datum:** 2026-07-11
**Stav:** Draft — k implementaci po schválení
**Autor:** Zion TerraNova team

---

## 1. Cíl

Obohatit ZION pool o **AuxPow (Auxiliary Proof of Work) merge mining** — těžba externích coinů jako vedlejší produkt ZION těžby, **bez snížení ZION hashrate**.

### Proč teď

- Pool běží (18+ minerů, 929 KH/s, 14 bloků, 95 payout rounds)
- PPLNS engine optimalizován pro 10k minerů (P7-P10)
- Revenue infrastruktura už existuje (`RevenueCollector`, `profit_router`, `stream_layers`)
- Máme 3 algoritmy: `deeksha_lite_v1`, `deeksha_lite_fire`, `cosmic_harmony_ekam_deeksha_v2`
- Legacy kód (2.9.9) měl `MergedMiningManager` — scaffolding pro byproduct export
- **ZION pipeline už počítá Keccak256 a SHA3-512 jako intermediates** → free byproducts

---

## 2. Architektura — 3 vrstvy

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ZION MINER (GPU/CPU)                          │
│                                                                      │
│  ┌───────────── Deeksha Pipeline ──────────────────────────────┐    │
│  │                                                              │    │
│  │  Input: 80B header + 8B nonce                                │    │
│  │    │                                                         │    │
│  │    ▼                                                         │    │
│  │  Step 1: Keccak256(header||nonce) → s1[32]                  │    │
│  │    │                    ↳ BYPRODUCT: Keccak hash             │    │
│  │    ▼                                                         │    │
│  │  Step 2: Memory-hard scratchpad (256 KiB) → s2[32]          │    │
│  │    │                                                         │    │
│  │    ▼                                                         │    │
│  │  Step 3: AES-128 CTR mix → s3[32]                           │    │
│  │    │                                                         │    │
│  │    ▼                                                         │    │
│  │  Step 4: [Fire only] Thermal loop → s3'[32]                 │    │
│  │    │                                                         │    │
│  │    ▼                                                         │    │
│  │  Step 5: Keccak256(s3) → final hash[32]                     │    │
│  │                                                              │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Miner submituje: nonce + hash + intermediates (s1, s2)              │
└──────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        ZION POOL SERVER                              │
│                                                                      │
│  ┌─ Share Validation ─┐   ┌─ AuxPow Manager ───────────────────┐   │
│  │                     │   │                                    │   │
│  │  1. Recompute hash  │──▶│  For each valid share:             │   │
│  │  2. Check target    │   │    • Extract s1 (Keccak256)        │   │
│  │  3. PPLNS record    │   │    • Check vs aux coin targets     │   │
│  │  4. Block? → node   │   │    • If meets → submit to aux pool │   │
│  │                     │   │    • Track revenue                 │   │
│  └─────────────────────┘   └────────────────────────────────────┘   │
│                                                                      │
│  ┌─ Revenue Collector ──────────────────────────────────────────┐   │
│  │  RevenueSource::Zion           → ZION block rewards            │   │
│  │  RevenueSource::KeccakBonus    → Keccak byproduct (FREE)       │   │
│  │  RevenueSource::Blake3External → DCR/ALPH (stratum proxy)      │   │
│  │  RevenueSource::KHeavyHashExternal → KAS (stratum proxy)       │   │
│  │  RevenueSource::EthashExternal → ETC (stratum proxy)           │   │
│  └────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                    │                        │
                    ▼                        ▼
             ZION Blockchain          External Pools
             (canonical)             (2miners, HeroMiners, ZPool)
                                              │
                                              ▼
                                     BTC/USDT payout
                                     → PPLNS distribution
```

---

## 3. Tři přístupy — od nejjednoduššího

### 3A. Byproduct Export (FREE — nulové extra compute)

**Princip:** Deeksha pipeline už počítá Keccak256 v Step 1. Tento 32B intermediate hash je **volný vedlejší produkt**. Pokud splňuje difficulty target nějakého externího coinu, pool ho submitne.

**Co už máme:**
- `stream_layers.rs` → `extract_keccak_byproduct(s1)` a `extract_sha3_byproduct(s2)`
- `revenue.rs` → `RevenueSource::KeccakBonus` a `RevenueSource::Sha3Bonus` (fee 5%)
- Legacy `MergedMiningManager` → sampling logika pro byproduct hits

**Omezení:**
- Keccak256 hash ZION headeru (80B) **není** validní share pro žádný existující coin
- ETC používá Ethash (Keccak + DAG), ne čistý Keccak
- Nexus (NXS) používá SHA3-based hashing, ale s jiným header formátem
- **Závěr:** Byproduct export je užitečný pro telemetry a future use, ale **samo o sobě negeneruje revenue** — externí pooly potřebují svůj header format

**Akce:** Zachovat jako telemetry vrstvu. Poslouží jako základ pro 3B.

### 3B. Stratum Proxy — Profit-Switch Mining (REAL revenue)

**Princip:** Pool redirectne **část hashrate** (nebo idle hashrate) na externí pool přes Stratum proxy. Minér dostane dva joby — ZION + externí — a střídá nonce space.

**Co už máme:**
- `profit_router.rs` → `ExternalCoin` enum (11 coinů: DCR, ALPH, KAS, ERG, RVN, ETC, EVR, MEWC, FLUX, CLORE, XMR)
- `profit_router.rs` → `CoinProfile` (pool endpoint, protocol, algorithm)
- `profit_router.rs` → `select_best_coin()` s hysteresis
- `profit_router.rs` → `fallback_estimates()` (USD/day per coin)
- `revenue.rs` → `RevenueSource::Blake3External`, `KHeavyHashExternal`, `EthashExternal`, atd.
- `revenue.rs` → `RevenueCollector::track_event()` pro USD revenue tracking
- `revenue.rs` → Circuit breaker (10 failures → open, 60s reset)

**Jak to funguje:**
1. Pool se připojí k externímu poolu (např. `dcr.2miners.com:3333`) jako **stratum client**
2. Pool dostává externí joby (header + target)
3. Pool rozdělí minerům: 75% ZION joby, 25% externí joby (multi-algo slot)
4. Minér hashuje externí header **cizím algoritmem** (např. Blake3 pro DCR)
5. Pool forwarduje shares na externí pool
6. Externí pool vyplácí BTC/USDT → pool wallet
7. Pool rozdělí přes PPLNS jako USD-denominated revenue

**Problém:** Minér musí umět **cizí algoritmus** (Blake3, kHeavyHash, KawPow, atd.). ZION miner umí jen `deeksha_lite_v1` / `deeksha_lite_fire` / `ekam_deeksha_v2`.

**Řešení:**
- **Fáze 1:** Pool sám těží externí coiny (pool server má GPU/CPU) — nepotřebuje minery
- **Fáze 2:** Miner software upgrade — přidat Blake3/kHeavyHash kernel (OpenCL)
- **Fáze 3:** "Dual-stratum" — miner dostává ZION job i externí job, hashuje obojí

### 3C. True AuxPow — Protocol-Level Merge Mining (HARD FORK)

**Princip:** ZION protokol podporuje AuxPow — ZION block obsahuje auxiliary chain reference v coinbase tx. Miner těží ZION block a zároveň aux chain block se stejným nonce.

**Inspirace:** Bitcoin/Namecoin merge mining — Bitcoin coinbase obsahuje Merkle root of Namecoin block, takže každý Bitcoin hash je zároveň Namecoin hash.

**Implementace:**
1. ZION coinbase tx přidá `aux_merkle_root` field (hash auxiliary chain block)
2. ZION block header se nemění — aux root je v coinbase, ne v headeru
3. Miner dostává ZION job + aux chain job
4. Miner vloží aux Merkle root do ZION coinbase
5. Miner hashuje ZION header → pokud splňuje ZION target → ZION block
6. Stejný hash + aux proof → pokud splňuje aux target → aux block
7. **Jeden hash, dvě block rewards** — nulové extra compute

**Problém:**
- Vyžaduje **ZION hard fork** (consensus change)
- Vyžaduje **aux chain** který podporuje ZION's deeksha_lite jako PoW
- Žádný existující coin nepoužívá deeksha_lite → **museli bychom vytvořit vlastní aux chain**
- Nebo: najít coin který používá Keccak256/SHA3 a adaptovat AuxPow

**Závěr:** 3C je nejlepší long-term, ale vyžaduje hard fork + aux chain. **3B je pragmatická cesta.**

---

## 4. Implementační plán — 3 fáze

### FÁZE 1: Pool-Side Stratum Proxy (1-2 týdny)

**Cíl:** Pool server sám těží externí coiny pomocí vlastního GPU/CPU, revenue rozdělí přes PPLNS.

#### 1.1 AuxPowClient — Stratum client pro externí pooly

**Nový soubor:** `V3/L1/pool/src/auxpow.rs`

```rust
pub struct AuxPowClient {
    coin: ExternalCoin,
    profile: CoinProfile,
    stratum: StratumConnection,
    current_job: Option<ExternalJob>,
    revenue_collector: Arc<RevenueCollector>,
}

pub struct ExternalJob {
    job_id: String,
    header_hex: String,
    target_hex: String,
    algorithm: String,  // "blake3", "kheavyhash", etc.
}

impl AuxPowClient {
    pub async fn connect(coin: ExternalCoin, profile: CoinProfile) -> Result<Self>;
    pub async fn get_job(&self) -> Option<&ExternalJob>;
    pub async fn submit_share(&self, nonce: u64, hash: &[u8; 32]) -> Result<ShareResult>;
    pub async fn disconnect(&self) -> Result<()>;
}
```

**Funkce:**
- Stratum v1 (mining.subscribe / mining.authorize / mining.submit)
- EthStratum (eth_submitWork / eth_getWork) pro ETC/RVN/ERG
- Auto-reconnect s circuit breaker
- Revenue tracking přes `RevenueCollector::track_event()`

#### 1.2 ExternalHasher — algoritmy pro externí coiny

**Nový soubor:** `V3/L1/cosmic-harmony/src/external_hashers.rs`

```rust
pub fn hash_blake3(header: &[u8], nonce: u64) -> [u8; 32];
pub fn hash_kheavyhash(header: &[u8], nonce: u64) -> [u8; 32];
pub fn hash_kawpow(header: &[u8], nonce: u64, dag: &Dag) -> [u8; 32];
pub fn hash_ethash(header: &[u8], nonce: u64, dag: &Dag) -> [u8; 32];
pub fn hash_autolykos(header: &[u8], nonce: u64) -> [u8; 32];
pub fn hash_randomx(header: &[u8], nonce: u64, vm: &RandomXVM) -> [u8; 32];
```

**Závislosti:**
- `blake3` crate (již v Cargo.toml pro Merkle tree)
- `kheavyhash` — jednoduchá implementace (Blake3 + heavy hash matrix)
- `ethash` / `kawpow` — použít `ethash` crate nebo vlastní OpenCL kernel
- `autolykos` — vlastní implementace (ergo-lib reference)
- `randomx` — `randomx-rs` crate (CPU only)

**Priorita:** Blake3 (DCR/ALPH) jako první — nejjednodušší, nejvyšší profit.

#### 1.3 AuxPowScheduler — orchestrace

**Nový soubor:** `V3/L1/pool/src/auxpow_scheduler.rs`

```rust
pub struct AuxPowScheduler {
    clients: HashMap<ExternalCoin, AuxPowClient>,
    profit_entries: Vec<ProfitEntry>,
    current_coin: Option<ExternalCoin>,
    allocation_pct: f64,  // default 0.25 (25% multi-algo slot)
    check_interval_secs: u64,  // default 300 (5 min)
}

impl AuxPowScheduler {
    pub async fn run(&mut self);
    pub fn select_best_coin(&self) -> Option<ExternalCoin>;
    pub async fn mine_cycle(&mut self) -> Result<()>;
    pub fn stats_json(&self) -> serde_json::Value;
}
```

**Funkce:**
- Periodicky volá `select_best_coin()` (profit router s hysteresis)
- Připojí se k nejlepšímu poolu
- Těží externí coin poolovým GPU/CPU
- Trackuje revenue přes `RevenueCollector`
- Circuit breaker: 10 failů → switch na další coin
- Auto-switch každých 5 min (configurable)

#### 1.4 Pool server integrace

**Upravit:** `V3/L1/pool/src/bin/server.rs`

- Na startu: vytvoř `AuxPowScheduler` (pokud `ZION_AUXPOW_ENABLED=1`)
- Spusť scheduler v background tokio task
- `/stats` API: přidej `auxpow` sekci (current coin, revenue, shares)
- PPLNS: externí revenue se rozdělí jako USD-denominated bonus k ZION payoutům

**Env vars:**
```
ZION_AUXPOW_ENABLED=1
ZION_AUXPOW_ALLOCATION=0.25        # 25% of pool compute
ZION_AUXPOW_COIN=DCR               # force specific coin (optional)
ZION_AUXPOW_POOL_PREFERENCE=default # nicehash|herominers|zpool|default
ZION_AUXPOW_REGION=eu
ZION_AUXPOW_CHECK_INTERVAL=300     # 5 min
ZION_AUXPOW_WALLET=<BTC wallet>    # pro 2miners BTC payout
```

#### 1.5 Dashboard integrace

**Upravit:** `ZION_OS/dashboard/app.py` + `dashboard.html`

- Nová karta "AuxPow / Multi-Algo"
- Zobrazení: current coin, pool endpoint, hashrate, shares, revenue USD
- Revenue graf: ZION blocks vs external revenue
- Coin switch history

**Výsledek Fáze 1:** Pool těží externí coiny s vlastním GPU, revenue jde do PPLNS. **Zero impact na minery.**

---

### FÁZE 2: Miner-Side Dual-Stratum (2-3 týdny)

**Cíl:** Miner software umí těžit ZION + externí coin současně (dual-stratum).

#### 2.1 Dual-stratum v pool serveru

**Upravit:** `V3/L1/pool/src/bin/server.rs`

- Pool otevírá **druhý stratum endpoint** pro externí joby
- Miner se subscribe na oba — dostává ZION job + externí job
- Miner střídá nonce space: 75% ZION, 25% externí
- Pool validuje a forwarduje externí shares na externí pool

#### 2.2 Miner software upgrade

**Upravit:** `V3/L1/miner/src/` + GPU kernels

- Přidat Blake3 kernel (pro DCR/ALPH) — `blake3.cl`
- Přidat kHeavyHash kernel (pro KAS) — `kheavyhash.cl`
- Stream scheduler: ZION ↔ externí coin switching
- Miner reportuje oba hashrate (ZION + externí)

#### 2.3 GPU kernel implementace

**Nové soubory:** `V3/L1/cosmic-harmony/src/gpu/kernels/`
- `blake3.cl` — Blake3 OpenCL kernel (reference: blake3-opencl, MIT)
- `kheavyhash.cl` — kHeavyHash OpenCL kernel (reference: kaspa-miner, MIT)
- `kawpow.cl` — KawPow OpenCL kernel (reference: kawpowminer, GPL)

**Výsledek Fáze 2:** Mineri těží ZION + externí coin současně. **75% ZION hashrate preserved, 25% external revenue added.**

---

### FÁZE 3: True AuxPow Protocol (future — hard fork)

**Cíl:** ZION protokol nativně podporuje merge mining.

#### 3.1 Zcoinbase tx extension

**Upravit:** `V3/L1/core/src/lib.rs`

```rust
pub struct CoinbaseTx {
    // ... existing fields ...
    pub aux_merkle_root: Option<[u8; 32]>,  // NEW: auxiliary chain Merkle root
    pub aux_chain_id: Option<u32>,          // NEW: identifies which aux chain
}
```

- Height-gated activation (hard fork at block X)
- Backward compatible: `aux_merkle_root = None` pro pre-fork bloky

#### 3.2 Aux chain specification

**Nový dokument:** `V3/docs/AUX_CHAIN_SPEC.md`

- Define auxiliary chain format (block header, PoW = deeksha_lite_v1)
- Aux chain uses **same algorithm** as ZION → zero extra compute
- Aux block header embedded in ZION coinbase
- One hash → two block rewards (ZION + aux)

#### 3.3 Validation

**Upravit:** `V3/L1/core/src/lib.rs` — `validate_peer_block()`
- Pokud `aux_merkle_root` je present, validuj aux chain proof
- Aux chain je optional — mineri bez aux support těží normálně

**Výsledek Fáze 3:** True merge mining — jeden hash, dvě block rewards. **Zero hashrate loss.**

---

## 5. Existující infrastruktura — co už máme

| Komponenta | Soubor | Stav | Co chybí |
|---|---|---|---|
| `ExternalCoin` enum (11 coinů) | `profit_router.rs` | ✅ Hotovo | — |
| `CoinProfile` (pool endpoints) | `profit_router.rs` | ✅ Hotovo | — |
| `select_best_coin()` s hysteresis | `profit_router.rs` | ✅ Hotovo | — |
| `fallback_estimates()` (USD/day) | `profit_router.rs` | ✅ Hotovo | Live WhatToMine API |
| `RevenueSource` (13 zdrojů) | `revenue.rs` | ✅ Hotovo | — |
| `RevenueCollector` (USD tracking) | `revenue.rs` | ✅ Hotovo | — |
| Circuit breaker | `revenue.rs` | ✅ Hotovo | — |
| `RevenueJournal` (persistence) | `revenue_journal.rs` | ✅ Hotovo | — |
| Stream telemetry | `stream_layers.rs` | ✅ Hotovo | — |
| Byproduct extractors | `stream_layers.rs` | ✅ Hotovo | Real submission |
| Legacy `MergedMiningManager` | `archive/2.9.9/.../merged_mining.rs` | 📦 Archiv | Port to V3 |
| `hash_with_algorithm()` | `core/src/lib.rs` | ✅ Hotovo | Externí algoritmy |
| Dual-algo support (lite/fire/ekam) | `core/src/lib.rs` | ✅ Hotovo | — |
| GPU kernels (deeksha) | `gpu/kernels/` | ✅ Hotovo | Blake3/kHeavyHash kernel |
| Pool `/stats` API | `pool/src/bin/server.rs` | ✅ Hotovo | AuxPow sekce |
| Dashboard | `ZION_OS/dashboard/` | ✅ Hotovo | AuxPow karta |

---

## 6. Algoritmy a jejich mapování

### ZION algoritmy (3)

| Algoritmus | Pipeline | Kdy aktivní | Scratchpad |
|---|---|---|---|
| `deeksha_lite_v1` | Keccak256 → MemHard(256K) → AES-128 → Keccak256 | height < 5000 | 256 KiB |
| `deeksha_lite_fire` | Keccak256 → MemHard(256K) → AES-128 → Thermal(16K iters) → Keccak256 | height ≥ 5000 | 256 KiB |
| `cosmic_harmony_ekam_deeksha_v2` | Keccak256 → SHA3-512 → GoldenMatrix → MemHard → NPU mix → CosmicFusion | genesis (V3 mainnet) | 256 KiB |

### Externí algoritmy (pro profit-switch)

| Algoritmus | Coiny | Hash function | Implementace |
|---|---|---|---|
| Blake3 | DCR, ALPH | Blake3 | `blake3` crate (již dostupný) |
| kHeavyHash | KAS | Blake3 + heavy hash matrix | Vlastní impl (~100 řádků) |
| KawPow | RVN, CLORE | Ethash variant + ProgPow | `kawpow` crate / OpenCL |
| Ethash | ETC | Keccak + DAG | `ethash` crate / OpenCL |
| Autolykos | ERG | Autolykos v2 | Vlastní impl (~200 řádků) |
| RandomX | XMR | RandomX VM | `randomx-rs` crate (CPU) |

### Byproduct mapování (FREE)

| ZION step | Byproduct | Potenciální coin | Poznámka |
|---|---|---|---|
| Step 1: Keccak256 | 32B Keccak hash | ETC (Ethash needs DAG) | Není validní standalone |
| Step 2: SHA3-512 | 64B SHA3 hash | NXS (Nexus) | Jiný header format |
| Step 1 (ekam): Keccak256 | 32B Keccak hash | — | Telemetry only |

**Závěr:** Byproducts jsou **volné** ale **nepoužitelné** pro direct submission. Slouží jako telemetry a future AuxPow foundation.

---

## 7. Revenue model

### Allocation (50/25/25)

```
50% — ZION canonical mining (deeksha_lite)
25% — Multi-algo external mining (profit-switch)
25% — NCL AI compute layer (future)
```

### Fee structure (už v `revenue.rs`)

| Source | Fee rate | Poznámka |
|---|---|---|
| ZION block reward | 5% (merged_mining_fee) | 89% miner / 5% humanitarian / 5% issobella / 1% pool |
| KeccakBonus / Sha3Bonus | 5% | Byproduct (FREE compute) |
| Blake3External (DCR/ALPH) | 2% | Profit-switch fee |
| KHeavyHashExternal (KAS) | 2% | Profit-switch fee |
| EthashExternal (ETC) | 2% | Profit-switch fee |
| KawPowExternal (RVN/CLORE) | 2% | Profit-switch fee |
| AutolykosExternal (ERG) | 2% | Profit-switch fee |
| RandomXExternal (XMR) | 2% | Profit-switch fee |
| NclAi | 10% | AI compute layer |

### Payout flow

1. ZION block found → `track_zion_block()` → PPLNS distribution in ZION
2. External share accepted → `track_event(RevenueSource::Blake3External, usd, true)` → PPLNS distribution in USD
3. Pool collects fees → `pending_fees_usd` + `pending_fees_zion`
4. Periodic payout: ZION mined → miner payout in ZION; External revenue → BTC/USDT → convert to ZION or distribute as bonus

---

## 8. Rizika a mitigace

| Riziko | Impact | Mitigace |
|---|---|---|
| Externí pool downtime | Lost revenue | Circuit breaker (10 fail → switch) |
| Profit switch flapping | Miner confusion | Hysteresis (10% improvement threshold) |
| GPU kernel bugs | Invalid shares | CPU validation fallback |
| External coin delisting | Revenue loss | Auto-switch to next best coin |
| Pool wallet compromise | Lost external revenue | Separate wallet for external payouts |
| Regulatory — mining other coins | Legal risk | Check jurisdiction (ZION is humanitarian) |
| Hard fork (Fáze 3) | Chain split | Height-gated, 2 weeks notice, testnet rehearsal |

---

## 9. Priorita a timeline

| Fáze | Co | Kdy | Závislosti |
|---|---|---|---|
| **1A** | `AuxPowClient` stratum client | Ihneď | Žádné |
| **1B** | `ExternalHasher` — Blake3 (DCR/ALPH) | Ihneď | `blake3` crate |
| **1C** | `AuxPowScheduler` + pool integration | Po 1A+1B | — |
| **1D** | Dashboard AuxPow karta | Po 1C | — |
| **2A** | `blake3.cl` GPU kernel | Po Fázi 1 | OpenCL |
| **2B** | Dual-stratum v pool serveru | Po 2A | — |
| **2C** | Miner dual-stratum support | Po 2B | Miner upgrade |
| **3A** | AuxPow protocol spec | Future | Governance approval |
| **3B** | Coinbase tx extension | Future | Hard fork |
| **3C** | Aux chain implementation | Future | 3A + 3B |

---

## 10. Soubory k vytvořit / upravit

### Nové soubory (Fáze 1)

| Soubor | Obsah |
|---|---|
| `V3/L1/pool/src/auxpow.rs` | `AuxPowClient` — Stratum client pro externí pooly |
| `V3/L1/pool/src/auxpow_scheduler.rs` | `AuxPowScheduler` — Profit-switch orchestrator |
| `V3/L1/cosmic-harmony/src/external_hashers.rs` | Hash funkce pro externí coiny (Blake3, kHeavyHash, ...) |
| `V3/docs/AUXPOW_DEPLOY_RUNBOOK.md` | Deploy guide |

### Úpravy (Fáze 1)

| Soubor | Změna |
|---|---|
| `V3/L1/pool/src/bin/server.rs` | AuxPow scheduler start, `/stats` API, env vars |
| `V3/L1/pool/src/lib.rs` | Export `auxpow` module |
| `V3/L1/cosmic-harmony/src/lib.rs` | Export `external_hashers` module |
| `V3/L1/cosmic-harmony/Cargo.toml` | Přidat `blake3` dependency (if not already) |
| `ZION_OS/dashboard/app.py` | AuxPow stats endpoint |
| `ZION_OS/dashboard/dashboard.html` | AuxPow karta |
| `ZION_OS/dashboard/dashboard.js` | AuxPow UI logic |

### Nové soubory (Fáze 2)

| Soubor | Obsah |
|---|---|
| `V3/L1/cosmic-harmony/src/gpu/kernels/blake3.cl` | Blake3 OpenCL kernel |
| `V3/L1/cosmic-harmony/src/gpu/kernels/kheavyhash.cl` | kHeavyHash OpenCL kernel |

---

## 11. Test plán

### Unit tests
- `AuxPowClient::connect()` — mock stratum server
- `AuxPowClient::submit_share()` — valid/invalid share
- `ExternalHasher::hash_blake3()` — KAT vectors
- `AuxPowScheduler::select_best_coin()` — hysteresis test
- Circuit breaker open/reset

### Integration tests
- Pool server + mock external pool → share submission
- Profit switch: coin A → coin B (hysteresis threshold)
- Revenue tracking: external share → `RevenueCollector` → PPLNS

### E2E test
- Pool connected to `dcr.2miners.com:3333` → real share submission → revenue tracked
- Dashboard shows live AuxPow stats

---

## 12. Shrnutí

**Fáze 1** je pragmatická a okamžitě generuje revenue:
- Pool server těží DCR/ALPH (Blake3) s vlastním GPU
- Zero impact na ZION minery
- Revenue jde do PPLNS jako USD bonus
- Profit router automaticky switchuje na nejziskovější coin

**Fáze 2** škáluje na minery:
- Mineri těží ZION + externí coin současně
- 75% ZION hashrate preserved
- 25% external revenue added
- Vyžaduje miner software upgrade + GPU kernels

**Fáze 3** je long-term vision:
- True AuxPow — jeden hash, dvě block rewards
- Zero hashrate loss
- Vyžaduje ZION hard fork + aux chain
- Governance approval needed

---

## A. Reference — existující kód

| Soubor | Řádky | Co |
|---|---|---|
| `V3/L1/cosmic-harmony/src/profit_router.rs` | 1-693 | ExternalCoin, CoinProfile, select_best_coin |
| `V3/L1/cosmic-harmony/src/revenue.rs` | 1-1087 | RevenueCollector, RevenueSource, circuit breaker |
| `V3/L1/cosmic-harmony/src/revenue_journal.rs` | — | Revenue event persistence |
| `V3/L1/cosmic-harmony/src/stream_layers.rs` | 1-457 | DeekshaStep telemetry, byproduct extractors |
| `V3/L1/cosmic-harmony/src/deeksha_lite.rs` | 1-522 | deeksha_lite_v1 (Keccak→MemHard→AES→Keccak) |
| `V3/L1/cosmic-harmony/src/deeksha_lite_fire.rs` | 1-617 | deeksha_lite_fire (+ thermal loop) |
| `V3/L1/cosmic-harmony/src/deeksha.rs` | 1-800 | ekam_deeksha_v2 (Keccak→SHA3→Matrix→MemHard→NPU→Fusion) |
| `V3/L1/core/src/lib.rs` | 194-207 | `hash_with_algorithm()` — dual-algo dispatch |
| `V3/L1/pool/src/bin/server.rs` | 1040-1120 | Share validation flow |
| `archive/2.9.9/.../merged_mining.rs` | 1-147 | Legacy MergedMiningManager (scaffolding) |
| `archive/2.9.9/.../config.rs` | 1-302 | Legacy pipeline config (merged_mining_targets) |
| `docs/ChV3.md` | 100-570 | Cosmic Harmony v3 architecture (merged mining design) |
