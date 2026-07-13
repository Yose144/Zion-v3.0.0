# AuxPow Multi-Algorithm GPU Mining — Complete Report & Plan

> **Status:** 2026-07-13 (rev2.2 — stream profit system implemented) | DCR Blake3 E2E verified (share accepted by WoolyPooly)
> **Author:** Devin + Yose | **Repo:** `Zion-v3.0.0`
> **Main goal:** Rozchodit revenue system ze stream multi-algo GPU miningu v Deeksha Chv3 — všechny streamy uvnitř Deeksha Chv3 pipeline

---

## 1. Executive Summary

ZION AuxPow B2b bridge umožňuje pool-side merge mining external coinů
(DCR, KAS, ALPH, ERG, RVN, ETC, …) přes GPU kernely. Pool přijímá
joby z external poolů, přeposílá je minerům jako `external_job`,
miner hasheje GPU kernelem, a pool forwarduje share zpět do
external poolu.

**DCR Blake3 je plně funkční E2E** — share accepted WoolyPooly
(2026-07-13, nonce=388, hash=001f350a9fd731c9).

### Hlavní cíl (rev2)

Rozchodit **revenue system ze stream multi-algo GPU miningu** v Deeksha Chv3.
To znamená:

1. **Pool automaticky přepíná mezi externími pooly podle profitability** —
   ne statický `force_coin`, ale dynamický profit-based switching s live API
   daty (WhatToMine / CoinGecko / pool APIs).
2. **CHv3 stream telemetry** jako backbone revenue accounting — `DeekshaStreamTelemetry`
   mapuje každý pipeline step na `RevenueSource` (KeccakBonus, Zion, NclAi, …).
3. **AuxPow B2b** jako externí revenue stream — GPU minery těží DCR/KAS/ALPH,
   pool forwarduje shares, BTC revenue se trackuje v `RevenueCollector`.
4. **RevenueScheduler** (50/25/25 model) dispatchuje minery do session groups
   (Zion / Revenue / Ncl) podle váhových lane konfigurace.
5. **Sjednocený revenue report** — ZION block rewards + external BTC revenue +
   NCL AI revenue → jeden `RevenueStats` snapshot.

### ⚠️ Klíčový gap: Automatické profit switching NENÍ implementováno

**Aktuální stav (z git historie a kódu):**

`run_auxpow_bridge()` v `server.rs:371` se připojí k `force_coin` (nebo KAS
default) a **zůstane tam navždy**. Na konci funkce je komentář:

```rust
// Reconnect to a different coin if force_coin changed (not implemented).
// Coin switching based on revenue scheduler will be added in a later phase.
```

**Co existuje ale není napojené:**
- `AuXpow/src/auxpow_scheduler.rs` — `AuxPowScheduler::select_coin()` s
  `select_best_coin()` + hysteresis. Ale tento scheduler **mines sám na serveru**
  (CPU hashing), neposílá joby minerům přes B2b bridge.
- `AuXpow/src/types.rs:226` — `fallback_estimates()` — **STATIC** odhady
  (KAS $0.85, ETC $0.60, ALPH $0.55, …). Žádná live API data.
- `V3/L1/cosmic-harmony/src/profit_router.rs:400` — stejné statické estimates.
- `V3/L1/pool/src/bin/server.rs:3016` — `RevenueScheduler` dělá weighted
  round-robin (50/25/25), **NE profit-based** selection.

**Co chybí:**
1. **Live profitability API** — žádné WhatToMine / CoinGecko / pool API volání.
   `reqwest` není ani v dependencies (`AuXpow/Cargo.toml`, `V3/L1/pool/Cargo.toml`).
2. **Profit-based coin switching v B2b bridge** — `run_auxpow_bridge()` nemá
   žádnou logiku pro přepínání coinů. Potřebuje periodicky volat `select_best_coin()`
   a reconnectovat k novému poolu.
3. **Propojení RevenueScheduler ↔ profit data** — `RevenueScheduler` rotuje
   přes statické váhy, ne podle aktuální profitability.

### ⚠️ Aktuální broken config na Edge (2026-07-13)

Edge pool běží s `ZION_POOL_AUXPOW_COIN=ETC`, ale **ETC vyžaduje EthStratum
protokol** (`eth_getWork` / `eth_submitWork`), který **není implementován**
(viz Phase 8 TODO). DCR wallet je nakonfigurovaný (`ZION_POOL_AUXPOW_WALLET_DCR`),
ale coin je nastaven na ETC. **Akce:** Přepnout na `ZION_POOL_AUXPOW_COIN=DCR`
(Blake3, Stratum v1, E2E verified).

---

## 1A. CHv3 Stream Architecture — Kontext pro AuxPow integraci

### 1A.1 Cosmic Harmony v3 — Historický původ

CHv3 (Cosmic Harmony v3) byl od začátku (2.5–2.9.5) **revenue systém**, ne jen
algoritmus. Původní vize (z `docs/ChV3.md`, `docs/docs2.9/2.9.4/reports/COSMIC_HARMONY_V3_REVENUE_PLAN.md`):

```
50/25/25 Model — 5 revenue streams z 3 compute costs:

Stream 1: ZION (50% compute) → CHv3 pipeline → ZION block rewards
Stream 2: ETC/Keccak (FREE byproduct) → Keccak-256 intermediate z Phase 1
Stream 3: NXS/SHA3 (FREE byproduct) → SHA3-512 intermediate z Phase 2
Stream 4: Multi-Algo (25% compute) → profit-switch ERG/RVN/KAS/ALPH → BTC
Stream 5: NCL AI (25% compute) → AI inference tasks → NCL rewards
```

**Lekce z historie:** "FREE byproduct" streamy (ETC/NXS) **selhaly**, protože
Keccak/SHA3 intermediates z CHv3 pipeline NEJSOU validní Ethash/SHA3 work pro
cílové blockchainy. True merge mining vyžaduje stejný PoW algoritmus na obou
řetězcích. → Viz `AUXPOW_TRUE_MERGE_MINING_PLAN.md` §4.4.

### 1A.2 CHv3 Pipeline (aktuální mainnet — deeksha_lite_v1 / deeksha_chv3)

```
Input: block_header[0..80] || nonce_le[0..8]
  │
  ├─ Step 1: Keccak-256          → RevenueSource::KeccakBonus  (5 work units)
  ├─ Step 2: MemoryHard (256KiB) → RevenueSource::Zion         (55 work units)
  ├─ Step 3: AesMix (3 rounds)   → RevenueSource::DeekshaLite  (5 work units)
  ├─ Step 4: ThermalLoop         → RevenueSource::DeekshaLite  (3 work units)
  ├─ Step 5: KeccakFinal         → RevenueSource::Zion         (2 work units)
  │
  └─ Output: Hash32 (deeksha_chv3 = deeksha_lite bit-identical)
```

**Total work units: 70** (deeksha_lite_v1 pipeline).
Pro v2 pipeline (cosmic_harmony_ekam_deeksha_v2): **100 work units**
(Keccak256=5, Sha3_512=5, GoldenMatrix=10, MemoryHard=55, NpuMix=15, CosmicFusion=10).

### 1A.3 DeekshaStreamTelemetry — Consensus-safe revenue accounting

`stream_layers.rs` poskytuje **consensus-safe** telemetrii — nemění hash output,
jen zaznamenává které pipeline kroky byly provedeny a mapuje je na `RevenueSource`:

```rust
pub struct DeekshaStreamTelemetry {
    pub steps: Vec<(DeekshaStep, u64)>,        // (step, work_units)
    pub total_work: u64,                       // sum of all work units
    pub stream_breakdown: HashMap<String, u64>, // per-RevenueSource aggregation
}
```

Pool volá `revenue_collector.track_deeksha_streams(telemetry, value_usd, height)`
po každém accepted ZION bloku → granular per-stream revenue accounting.

### 1A.4 RevenueSource enum — 14 revenue streamů

Z `revenue.rs`:

| RevenueSource | Fee | Algo | Popis |
|---------------|-----|------|-------|
| `Zion` | 5% | deeksha_chv3 | Canonical ZION mining (50% allocation) |
| `KeccakBonus` | 5% | — | FREE byproduct (historický, ne aktivní) |
| `Sha3Bonus` | 5% | — | FREE byproduct (historický, ne aktivní) |
| `Blake3External` | 2% | Blake3 | **DCR, ALPH** — AuxPow B2b |
| `KHeavyHashExternal` | 2% | kHeavyHash | **KAS** — AuxPow B2b |
| `EthashExternal` | 2% | Ethash | ETC, EVR, MEWC — vyžaduje EthStratum |
| `KawPowExternal` | 2% | KawPow | RVN, CLORE — vyžaduje EthStratum + DAG |
| `AutolykosExternal` | 2% | Autolykos v2 | ERG — vyžaduje EthStratum |
| `RandomXExternal` | 2% | RandomX | XMR — CPU-only |
| `ZelHashExternal` | 2% | ZelHash | FLUX — TODO |
| `DeekshaLite` | 5% | deeksha_lite_v1 | Lite v1 mining |
| `ThermalBonus` | 5% | deeksha_lite_fire | Fire thermal mining |
| `NclAi` | 10% | NCL | AI/NCL compute (25% allocation) |
| `ProfitSwitch` | 2% | — | Legacy profit-switch (deprecated) |

### 1A.5 RevenueScheduler — Pool-side 50/25/25 dispatch

`V3/L1/pool/src/bin/server.rs:3016` — weighted round-robin lane dispatch:

```
SessionGroup::Zion     → RevenueSource::Zion lane (50% default)
SessionGroup::Revenue  → rotate through external lanes (25% default)
SessionGroup::Ncl      → RevenueSource::NclAi lane (25% default)
SessionGroup::Auto     → weighted round-robin across all lanes
```

**Env vars:**
- `ZION_REVENUE_MULTISTREAM=1` — enable multistream dispatch
- `ZION_STREAM_ZION_PCT=50` — ZION lane weight
- `ZION_STREAM_BLAKE3_PCT=25` — Blake3 external (DCR/ALPH) lane weight
- `ZION_STREAM_NCL_PCT=25` — NCL AI lane weight
- `ZION_STREAM_KHEAVYHASH_PCT=0` — KAS lane (default 0, enable explicit)
- `ZION_STREAM_ETHASH_PCT=0` — ETC lane (default 0)
- `ZION_STREAM_KAWPOW_PCT=0` — RVN lane (default 0)
- `ZION_STREAM_AUTOLYKOS_PCT=0` — ERG lane (default 0)
- `ZION_STREAM_RANDOMX_PCT=0` — XMR lane (default 0)
- `ZION_BACKEND_AUTO_INCLUDE_ZION=1` — auto-assign includes ZION lane

### 1A.6 Jak AuxPow B2b napojuje na CHv3 streamy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ZION POOL (server.rs)                            │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  RevenueScheduler (50/25/25)                                 │   │
│  │  ├── Zion lane (50%) → deeksha_chv3 jobs → ZION blocks      │   │
│  │  ├── Blake3External lane (25%) → AuxPow B2b DCR/ALPH jobs  │   │
│  │  └── NclAi lane (25%) → NCL AI tasks                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼──────────────────────────────────┐   │
│  │  AuxPowBridge (B2b)                                          │   │
│  │  ├── AuxPowClient → Stratum v1 → external pool (WoolyPooly) │   │
│  │  ├── JobMultiplexer → queue external jobs                   │   │
│  │  ├── Session thread → issue external_job to Revenue miners  │   │
│  │  └── ShareForwarder → validate + forward to external pool   │   │
│  └───────────────────────────┬──────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼──────────────────────────────────┐   │
│  │  RevenueCollector                                            │   │
│  │  ├── track_zion_block(height, subsidy, fee_pct, tx_hash)    │   │
│  │  ├── track_deeksha_streams(telemetry, value_usd, height)    │   │
│  │  ├── track_event(RevenueEvent { source, value_usd, ... })   │   │
│  │  ├── track_ncl_task(value_usd)                              │   │
│  │  └── get_stats() → RevenueStats snapshot                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ZION Blockchain      External Pool         NCL Gateway
   (deeksha_chv3)       (DCR/KAS/ALPH)       (AI tasks)
        │                    │                    │
        ▼                    ▼                    ▼
   ZION block reward    BTC revenue           NCL rewards
   + stream telemetry   (2% fee)             (10% fee)
```

**Klíčový integrace bod:** AuxPow B2b revenue se trackuje přes
`RevenueCollector::track_event()` s `RevenueSource::Blake3External` (nebo
`KHeavyHashExternal` pro KAS). ZION block revenue se trackuje přes
`track_zion_block()` + `track_deeksha_streams()`. Oboje končí v jednom
`RevenueStats` snapshotu → sjednocený revenue report.

---

## 2. Current State — Co funguje, co chybí

### 2.1 Per-Coin Status Matrix

| Coin | Algo | GPU Kernel | CPU Hash | Pool Submit | E2E Test | Status |
|------|------|-----------|----------|-------------|----------|--------|
| **DCR** | Blake3 | `blake3_dcr_mine` | `hash_blake3` | 5-param Stratum v1 | **ACCEPTED** | **DONE** |
| **ALPH** | Blake3 (double) | `blake3_alph_mine` | `hash_blake3_alph` | JSON object | Unit test | **READY** |
| **KAS** | kHeavyHash | `kheavyhash_mine` | `hash_kheavyhash` | 3-param Stratum v1 | Unit test | **READY** |
| **ERG** | Autolykos v2 | `autolykos_mine` | `hash_autolykos` + FFI | `eth_submitWork` | Unit test | **PARTIAL** |
| **RVN** | KawPow | `kawpow_mine` | FFI w/ DAG | `eth_submitWork` | — | **PARTIAL** |
| **ETC** | Etchash | `ethash_mine` | FFI w/ DAG | `eth_submitWork` | — | **PARTIAL** |
| **EVR** | KawPow | `kawpow_mine` | FFI w/ DAG | `eth_submitWork` | — | **PARTIAL** |
| **MEWC** | KawPow | `kawpow_mine` | FFI w/ DAG | `eth_submitWork` | — | **PARTIAL** |
| **CLORE** | KawPow | `kawpow_mine` | FFI w/ DAG | `eth_submitWork` | — | **PARTIAL** |
| **FLUX** | ZelHash | **MISSING** | **MISSING** | Stratum v1 | — | **TODO** |
| **XMR** | RandomX | **MISSING** | **STUB** | Stratum v1 | — | **TODO** (CPU-only) |

### 2.2 Infrastructure Status

| Component | Status | Notes |
|-----------|--------|-------|
| Pool B2b bridge | **WORKING** | DCR jobs issued to miners, share routing active |
| AuxPow scheduler | **WORKING** | Profit switching + circuit breaker + hysteresis |
| Reconnect logic | **WORKING** | Inline read fix (no more deadlock) |
| Read timeout | **WORKING** | 300s (DCR 5-min blocks) |
| Multiplexer | **WORKING** | Single-coin active, multi-coin TODO |
| Dual stratum | **EXISTS** | ZION + external nonce split, untested E2E |
| Share forwarder | **WORKING** | Local target check → pool submit |
| GPU backend (OpenCL) | **WORKING** | All algo kernels compile + dispatch |
| GPU backend (CUDA) | **STUB** | Scaffold only |
| GPU backend (Metal) | **STUB** | Scaffold only |
| EthStratum protocol | **PARTIAL** | `eth_submitLogin` works, `eth_getWork`/`eth_submitWork` TODO |
| True AuxPow (Phase 3) | **POC** | DCR validation exists, not consensus-integrated |
| Parent chain parsing | **DCR DONE** | ALPH header stub |
| SMOS deploy | **BLOCKED** | API execute-command unreliable, binary replace problematic |

### 2.3 DCR Fixes Applied (2026-07-13)

| Fix | Problem | Solution |
|-----|---------|----------|
| Read timeout 90s→300s | DCR 5-min blocks → spurious reconnects | `auxpow_client.rs:375` |
| Reconnect deadlock | `send_request` waits on dead poll loop | `send_request_inline()` |
| Notify parsing | Used arr[1] (prevhash 32B) as header | Use arr[2] (coinbase1 = 144B header) |
| Blake3 hash | `header \|\| nonce_le` (wrong) | Full 180B header, nonce@offset 140, 4B LE |
| Share target | Used nbits (network target) | Use difficulty-based target (like KAS) |
| Submit format | 3-param `[worker, job_id, nonce_hex]` | 5-param `[worker, job_id, "", ntime, nonce_le_hex]` |

---

## 3. Architecture

### 3.1 B2b Flow (Phase 1 — Current)

```
External Pool (WoolyPooly/2miners)
    ↕ Stratum v1
ZION Pool (62.171.141.136:8444)
    ├── AuxPowClient → subscribe + authorize + receive jobs
    ├── JobMultiplexer → queue external jobs
    ├── Session thread → issue external_job to miner
    ├── Share routing → validate + forward to external pool
    └── RoutingStats → track per-algorithm shares
    ↕ Wire protocol
ZION Miner (GPU rig)
    ├── gpu_backend → OpenCL kernel dispatch
    ├── blake3_dcr_mine / kheavyhash_mine / autolykos_mine / ...
    └── Submit share → pool validates → forwards
```

### 3.2 GPU Kernel Inventory

| Kernel File | Entry Point | Algorithm | Coins |
|-------------|-------------|-----------|-------|
| `blake3_kernel.cl` | `blake3_alph_mine` | Double-Blake3 | ALPH |
| `blake3_kernel.cl` | `blake3_dcr_mine` | Single-Blake3 | DCR |
| `kheavyhash_kernel.cl` | `kheavyhash_mine` | cSHAKE256 + matrix | KAS |
| `autolykos_kernel.cl` | `autolykos_mine` | BLAKE2b + memory-hard | ERG |
| `kawpow_kernel.cl` | `kawpow_mine` | Keccak + DAG + FNV | RVN, CLORE, EVR, MEWC |
| `ethash_kernel.cl` | `ethash_mine` | Keccak + DAG + FNV | ETC |

### 3.3 CPU Hasher Inventory

| Function | File | Algorithm | Status |
|----------|------|-----------|--------|
| `hash_blake3()` | `external_hashers.rs:83` | DCR Blake3 (180B header) | **WORKING** |
| `hash_blake3_alph()` | `external_hashers.rs:99` | ALPH double-Blake3 | **WORKING** |
| `hash_kheavyhash()` | `external_hashers.rs` | KAS kHeavyHash | **WORKING** |
| `hash_autolykos()` | `external_hashers.rs` | ERG Autolykos v2 | **WORKING** |
| `hash_kawpow()` | `external_hashers.rs` | KawPow (no DAG) | **STUB** |
| `hash_ethash()` | `external_hashers.rs` | Ethash (no DAG) | **STUB** |
| `hash_autolykos_native()` | `native_ffi.rs` | ERG (C FFI) | **WORKING** |
| `hash_kawpow_native_with_dag()` | `native_ffi.rs` | KawPow (C FFI + DAG) | **EXISTS** |
| `hash_ethash_native_with_dag()` | `native_ffi.rs` | Ethash (C FFI + DAG) | **EXISTS** |
| RandomX | `randomx_stub.c` | XMR | **STUB** |

### 3.4 Coin Profiles (11 coins)

| Coin | Ticker | Algo | Default Pool | Protocol | Wallet |
|------|--------|------|-------------|----------|-------|
| Decred | DCR | blake3 | pool.woolypooly.com:3152 | Stratum v1 | DCR wallet |
| Alephium | ALPH | blake3 | alph.2miners.com:4545 | Stratum v1 | BTC wallet |
| Kaspa | KAS | kheavyhash | kas.2miners.com:2020 | Stratum v1 | BTC wallet |
| Ergo | ERG | autolykos | erg.2miners.com:8888 | EthStratum | BTC wallet |
| Ravencoin | RVN | kawpow | rvn.2miners.com:6060 | EthStratum | BTC wallet |
| Eth Classic | ETC | etchash | etc.2miners.com:1010 | EthStratum | BTC wallet |
| Evrmore | EVR | kawpow | zpool.ca:1330 | EthStratum | BTC wallet |
| MeowCoin | MEWC | kawpow | zpool.ca:1327 | EthStratum | BTC wallet |
| Flux | FLUX | zelhash | flux.woolypooly.com:3000 | Stratum v1 | BTC wallet |
| Clore.ai | CLORE | kawpow | clore.woolypooly.com:3090 | EthStratum | BTC wallet |
| Monero | XMR | randomx | moneroocean.stream:10001 | Stratum v1 | XMR wallet |

### 3.5 Pool Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ZION_POOL_AUXPOW_ENABLED` | false | Enable B2b bridge |
| `ZION_POOL_AUXPOW_COIN` | auto | Force specific coin |
| `ZION_POOL_AUXPOW_POOL_PREFERENCE` | Default | Pool endpoint preference |
| `ZION_POOL_AUXPOW_REGION` | eu | Geographic region |
| `ZION_POOL_AUXPOW_WALLET` | BTC wallet | Default payout wallet |
| `ZION_POOL_AUXPOW_WORKER_NAME` | zion_auxpow | Worker name suffix |
| `ZION_POOL_AUXPOW_WALLET_{TICKER}` | — | Per-coin wallet override |

### 3.6 Test Coverage

**78 unit tests** — all passing:
- `auxpow_client.rs`: 4 tests (connect, subscribe, authorize, submit)
- `auxpow_scheduler.rs`: 5 tests (circuit breaker, stats)
- `dual_stratum.rs`: 7 tests (nonce split, scan)
- `external_hashers.rs`: 21 tests (blake3, kheavyhash, autolykos, targets)
- `miner_harness.rs`: 5 tests (blake3 share finding)
- `multiplexer.rs`: 2 tests (DCR job, switch)
- `parent_chains.rs`: 7 tests (DCR header, commitment)
- `share_forwarder.rs`: 3 tests (target check, accept, reject)
- `true_auxpow.rs`: 7 tests (validation, proof builder)
- `types.rs`: 15 tests (coin profiles, config, selection)

**1 E2E test** — DCR share accepted by WoolyPooly.

---

## 4. Plan — Dokončení všech multi-algo AuxPow s GPU kernely

### Phase 1: DCR Blake3 — COMPLETE

- [x] GPU kernel `blake3_dcr_mine`
- [x] CPU hasher `hash_blake3` (180B header, nonce@140)
- [x] Pool notify parsing (coinbase1 = 144B header)
- [x] Submit format (5-param Stratum v1)
- [x] Read timeout 300s
- [x] Reconnect deadlock fix
- [x] E2E test — share ACCEPTED

### Phase 2: ALPH + KAS — READY (E2E test needed)

#### 2a. ALPH (Alephium, double-Blake3)

**Status:** GPU kernel + CPU hasher + submit format exist. Unit tests pass.

- [ ] E2E test s `AUXPOW_E2E_COIN=alph` na 2miners pool
- [ ] Verify share accepted
- [ ] Pool config `ZION_POOL_AUXPOW_COIN=ALPH`
- [ ] Per-coin wallet (ALPH uses BTC payout)

**Key files:**
- `blake3_kernel.cl` → `blake3_alph_mine` entry point
- `external_hashers.rs:99` → `hash_blake3_alph` (double-Blake3 with extranonce1)
- `auxpow_client.rs:937-965` → JSON object submit `{jobId, fromGroup, toGroup, nonce, worker}`

**Estimated effort:** 1-2h (E2E test + verify)

#### 2b. KAS (Kaspa, kHeavyHash)

**Status:** GPU kernel + CPU hasher + submit format exist. Unit tests pass.

- [ ] E2E test s `AUXPOW_E2E_COIN=kas` na 2miners pool
- [ ] Verify share accepted
- [ ] Pool config `ZION_POOL_AUXPOW_COIN=KAS`
- [ ] Verify extranonce1 handling (KAS uses 4-byte extranonce1 prefix)

**Key files:**
- `kheavyhash_kernel.cl` → `kheavyhash_mine` entry point
- `external_hashers.rs` → `hash_kheavyhash` (cSHAKE256 + 64×64 matrix)
- `auxpow_client.rs:966-984` → 3-param Stratum v1 submit `[worker, job_id, nonce_hex]`

**Estimated effort:** 1-2h (E2E test + verify)

### Phase 3: ERG (Autolykos) — PARTIAL

**Status:** GPU kernel + CPU hasher + FFI exist. EthStratum `eth_submitWork` TODO.

- [ ] Implement `eth_getWork` notification handler in `auxpow_client.rs`
- [ ] Implement `eth_submitWork` submit in `auxpow_client.rs`
- [ ] Autolykos table precomputation on GPU host side
- [ ] E2E test s `AUXPOW_E2E_COIN=erg` na 2miners pool
- [ ] Verify share accepted

**Key files:**
- `autolykos_kernel.cl` → `autolykos_mine` entry point
- `external_hashers.rs` → `hash_autolykos` (BLAKE2b-256 + memory-hard table)
- `native_ffi.rs` → `hash_autolykos_native` (C FFI)
- `gpu_miner.rs:411-422` → `build_autolykos_kernel` (table buffer)

**Blocker:** EthStratum protocol support (`eth_getWork` / `eth_submitWork`)

**Estimated effort:** 4-6h

### Phase 4: KawPow coins (RVN, CLORE, EVR, MEWC) — PARTIAL

**Status:** GPU kernel + FFI with DAG exist. EthStratum TODO. DAG management needed.

- [ ] EthStratum protocol (shared with ERG)
- [ ] DAG generation + epoch management for GPU
- [ ] Mix hash support in submit (eth_submitWork needs mix_hash)
- [ ] E2E test s `AUXPOW_E2E_COIN=rvn` na 2miners pool
- [ ] E2E test s `AUXPOW_E2E_COIN=clore` na woolypooly pool
- [ ] Verify shares accepted

**Key files:**
- `kawpow_kernel.cl` → `kawpow_mine` entry point
- `native_ffi.rs` → `hash_kawpow_native_with_dag` (C FFI + DAG)
- `gpu_miner.rs:780-848` → `build_kawpow_kernel` (DAG buffer)
- `gpu_backend.rs:3396-3466` → DAG management (epoch-based)

**Estimated effort:** 6-8h (DAG + EthStratum + 4 coin E2E tests)

### Phase 5: ETC (Etchash) — PARTIAL

**Status:** GPU kernel + FFI with DAG exist. Same EthStratum blocker as KawPow.

- [ ] EthStratum protocol (shared with Phase 3/4)
- [ ] DAG generation (Etchash DAG differs slightly from Ethash)
- [ ] E2E test s `AUXPOW_E2E_COIN=etc` na 2miners pool
- [ ] Verify share accepted

**Key files:**
- `ethash_kernel.cl` → `ethash_mine` entry point
- `native_ffi.rs` → `hash_ethash_native_with_dag` (C FFI + DAG)
- `gpu_miner.rs:432-444` → `build_ethash_kernel` (DAG buffer)

**Estimated effort:** 3-4h (after EthStratum is done)

### Phase 6: FLUX (ZelHash) — TODO

**Status:** Coin profile exists. No GPU kernel, no CPU hasher.

- [ ] Research ZelHash algorithm (ZelHash = double SHA-256 variant for Flux)
- [ ] Implement CPU hasher in `external_hashers.rs`
- [ ] Write OpenCL kernel `zelhash_kernel.cl`
- [ ] Add kernel_info mapping in `gpu_miner.rs`
- [ ] Implement Stratum v1 notify parsing for FLUX
- [ ] E2E test s `AUXPOW_E2E_COIN=flux` na woolypooly pool

**Estimated effort:** 8-12h (new algorithm implementation)

### Phase 7: XMR (RandomX) — TODO (CPU-only)

**Status:** Coin profile exists. RandomX stub only. RandomX is CPU-only (no GPU).

- [ ] Integrate `randomx-rs` crate or native RandomX library
- [ ] Replace `randomx_stub.c` with real implementation
- [ ] Implement CPU miner thread (not GPU)
- [ ] E2E test s `AUXPOW_E2E_COIN=xmr` na moneroocean pool

**Note:** RandomX is intentionally CPU-only (anti-ASIC, anti-GPU). No GPU kernel needed.

**Estimated effort:** 4-8h (library integration + CPU thread)

### Phase 8: EthStratum Protocol — BLOCKER for ERG/RVN/ETC/EVR/MEWC/CLORE

**Status:** `eth_submitLogin` works. `eth_getWork` / `eth_submitWork` TODO.

- [ ] Implement `eth_getWork` notification handler in `poll_messages()`
  - Parse `[seed_hash, header_hash, boundary]`
  - Build ExternalJob from eth_getWork params
- [ ] Implement `eth_submitWork` in `submit_share()`
  - Format: `[nonce_hex, header_hash, mix_hash]`
  - Mix hash from GPU kernel (KawPow/Ethash) or final hash (Autolykos)
- [ ] Test with ERG pool (Autolykos, no mix hash needed)
- [ ] Test with RVN pool (KawPow, mix hash from DAG)

**Key file:** `auxpow_client.rs` — `poll_messages()` + `submit_share()`

**Estimated effort:** 4-6h (unblocks Phase 3, 4, 5)

### Phase 9: SMOS Miner Deploy — BLOCKED

**Status:** Pool vydává blake3_dcr joby, ale SMOS rig běží se starou binárkou.

- [ ] Build new miner binary with all algorithm support
- [ ] Package as SMOS custom miner zip
- [ ] Upload to `zionterranova.com/zion-miner/`
- [ ] Update SMOS group config via API to point to new zip
- [ ] Reload rig via SMOS API
- [ ] Verify miner connects + mines blake3_dcr
- [ ] Verify share accepted by WoolyPooly through pool

**Alternative:** SSH na rig (pokud dostupný) + ruční binary replace

**Estimated effort:** 2-4h (po vyřešení SMOS API přístupu)

### Phase 10: Multi-Coin Profit Switching — ENHANCEMENT

**Status:** Scheduler exists with static fallback estimates. Single-coin active.

- [ ] Connect to multiple external pools simultaneously
- [ ] Real-time revenue estimation from pool APIs
- [ ] Dynamic coin switching based on live profitability
- [ ] Per-miner algorithm assignment (not all miners on same coin)
- [ ] Multi-pool per coin support (preference/region mapping)

**Estimated effort:** 8-12h

### Phase 11: True AuxPow (Phase 3) — FUTURE

**Status:** POC validation exists for DCR. Not consensus-integrated.

- [ ] ALPH header parsing (research exact layout)
- [ ] Integrate `true_auxpow.rs` into `V3/L1/core` consensus
- [ ] Height-gated fork logic for AuxPoW blocks
- [ ] New ZION header fields for AuxPoW data
- [ ] Coinbase commitment scanning in ZION blocks
- [ ] Aux Merkle tree validation

**Estimated effort:** 20-40h (consensus-level work)

---

## 5. Priority Order

### Revenue System Priority (rev2 — CHv3 stream integrace)

| Priority | Fáze | Effort | Impact |
|----------|------|--------|--------|
| **R0** | Opravit broken Edge config (ETC→DCR) | 30min | Unblocks DCR revenue |
| **R1** | **Stream profit system — weighted pipeline** | **DONE ✅** | **Stream weights v job messages, profit computation** |
| **R1b** | **Live API fetching (WhatToMine/CoinGecko)** | **DONE ✅** | **Reálná profit data místo fallback** |
| **R1c** | **GPU kernel parametrizace** | **DONE ✅** | **Kernel aplikuje weights na work distribution** |
| **R2** | DCR revenue live | 1-2h | 1st external revenue stream |
| **R3** | ALPH + KAS E2E | 2-4h | 3 external coins live |
| **R4** | Stream telemetry revenue report | 2-4h | Sjednocený revenue accounting |
| **R5** | SMOS deploy + GPU mining | 2-4h | Real GPU hashrate (blocked) |
| **R6** | **EthStratum protocol** | **DONE ✅** | **Unblocks ERG/EVR/MEWC/CLORE** |
| **R7** | True AuxPow consensus | 20-40h | Free chain security (future) |

### Original Phase Priority (multi-algo GPU mining completion)

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| **P0** | Phase 9: SMOS deploy | 2-4h | Unblocks real GPU mining |
| **P1** | Phase 2a: ALPH E2E | 1-2h | 2nd coin live |
| **P1** | Phase 2b: KAS E2E | 1-2h | 3rd coin live |
| **P2** | Phase 8: EthStratum | 4-6h | Unblocks 6 coins |
| **P2** | Phase 3: ERG E2E | 4-6h | 4th coin live |
| **P3** | Phase 4: KawPow E2E | 6-8h | 4 coins live |
| **P3** | Phase 5: ETC E2E | 3-4h | 5th coin live |
| **P4** | Phase 6: FLUX | 8-12h | New algorithm |
| **P4** | Phase 7: XMR | 4-8h | CPU-only coin |
| **P5** | Phase 10: Multi-coin | 8-12h | Profit optimization |
| **P6** | Phase 11: True AuxPow | 20-40h | Consensus integration |

**Total estimated effort:** ~70-120h pro všechny phases

---

## 6. Key File Locations

| Purpose | File |
|---------|------|
| GPU kernels (OpenCL) | `AuXpow/csrc/opencl/*.cl` |
| CPU hashers | `AuXpow/src/external_hashers.rs` |
| Native FFI hashers | `AuXpow/src/native_ffi.rs` |
| Coin profiles | `AuXpow/src/types.rs` |
| AuxPow Stratum client | `AuXpow/src/auxpow_client.rs` |
| GPU miner (kernel builder) | `AuXpow/src/gpu_miner.rs` |
| Scheduler (profit switching) | `AuXpow/src/auxpow_scheduler.rs` |
| Job multiplexer | `AuXpow/src/multiplexer.rs` |
| Dual stratum | `AuXpow/src/dual_stratum.rs` |
| Share forwarder | `AuXpow/src/share_forwarder.rs` |
| True AuxPow validation | `AuXpow/src/true_auxpow.rs` |
| Parent chain parsing | `AuXpow/src/parent_chains.rs` |
| Pool server | `V3/L1/pool/src/bin/server.rs` |
| Miner main | `V3/L1/miner/src/main.rs` |
| GPU backend | `V3/L1/miner/src/gpu_backend.rs` |
| E2E test | `AuXpow/examples/e2e_pool_test.rs` |
| SMOS deploy script | `scripts/deploy_zion_smos.py` |
| Systemd service | `edge-deploy/systemd/zion-edge-pool.service` |
| Docker pool | `V3/docker/Dockerfile.pool` |

---

## 7. Revenue Estimates (Static Fallback)

| Coin | Revenue /100MH/s/day | Power | Profit |
|------|---------------------|-------|--------|
| KAS | $0.85 | $0.10 | $0.75 |
| ETC | $0.60 | $0.12 | $0.48 |
| ALPH | $0.55 | $0.08 | $0.47 |
| FLUX | $0.50 | $0.10 | $0.40 |
| DCR | $0.45 | $0.08 | $0.37 |
| ERG | $0.40 | $0.10 | $0.30 |
| RVN | $0.35 | $0.12 | $0.23 |
| CLORE | $0.30 | $0.10 | $0.20 |
| EVR | $0.20 | $0.08 | $0.12 |
| MEWC | $0.15 | $0.06 | $0.09 |
| XMR | $0.12 | $0.03 | $0.09 |

---

## 8. DCR E2E Test Log (2026-07-13)

```
coin:      DCR
algorithm: blake3
pool:      pool.woolypooly.com:3152
wallet:    DsdVsPZpXTCtNFNnHN68L6ajYTabxDcEmMp

[1/4] Connected and authorized.
[2/4] Received job: id=00000f57 algorithm=blake3 header_len=144 difficulty=128
[3/4] Found potential share: job_id=00000f57 nonce=388 hash=001f350a9fd731c9
[4/4] Submitting share...
auxpow: submitting share request {"id":100,"method":"mining.submit",
  "params":["DsdVsPZpXTCtNFNnHN68L6ajYTabxDcEmMp.zion_e2e","00000f57","","ddc8546a","84010000"]}
[4/4] Submit result: Accepted
=== E2E test finished ===
```

**Submit format:** 5-param Stratum v1
- `[worker, job_id, extranonce2="", ntime, nonce_le_hex]`
- nonce=388 → `0x84010000` (4-byte LE)

---

## 9. Next Actions — Revenue System Priority (rev2)

### Fáze R0: Opravit broken Edge config (IHned)

**Problém:** `ZION_POOL_AUXPOW_COIN=ETC` ale ETC vyžaduje EthStratum (neimplementováno).

- [ ] Přepnout `ZION_POOL_AUXPOW_COIN=DCR` (Blake3, Stratum v1, E2E verified)
- [ ] Zapnout `ZION_REVENUE_MULTISTREAM=1` pro multistream dispatch
- [ ] Nastavit `ZION_STREAM_ZION_PCT=50`, `ZION_STREAM_BLAKE3_PCT=25`, `ZION_STREAM_NCL_PCT=25`
- [ ] Restart pool, ověřit DCR jobs flow + share forwarding
- [ ] Ověřit `RevenueCollector::track_event(Blake3External)` se volá při accepted share

### Fáze R1: Stream profit system — weighted pipeline (IMPLEMENTED ✅)

**Commit:** `50df9b414` — `feat(chv3): stream profit system — weighted pipeline for Deeksha Chv3`

**Architektura:** Všechny revenue streamy žijí UVNITR Deeksha Chv3 pipeline.
GPU vždy běží Deeksha Chv3, ale pipeline se parametrizuje podle ziskovosti
streamů. Pool posílá stream weights minerovi v job messages.

**Co bylo implementováno:**

1. **`V3/L1/cosmic-harmony/src/stream_profit.rs`** (566 řádků, nový modul):
   - `StreamProfitEntry` / `StreamProfitSnapshot` — profit data per stream
   - `StreamWeights` — normalizované váhy (0.0–1.0) pro pipeline kroky
   - `StreamProfitConfig` — konfigurace z env proměnných
   - `from_profit()` — výpočet vah z profit dat s hysteresí (15% default)
   - `to_step_multipliers()` — mapování vah na `DeekshaStep` work multipliers
   - Fallback estimates pro 6 interních streamů: Zion, KeccakBonus, Sha3Bonus,
     NclAi, DeekshaLite, ThermalBonus

2. **`PoolMessage::Job`** rozšířeno o `stream_weights` pole:
   - Formát: `"zion:50.0,keccak_bonus:15.0,ncl_ai:25.0"`
   - `#[serde(default)]` — backward kompatibilní s minery, které pole neznají

3. **`RevenueScheduler`** v `server.rs`:
   - Drží `StreamProfitConfig` + `StreamWeights`
   - `stream_weights_string()` — serializuje váhy do job messages
   - `update_stream_weights()` — aplikuje nový profit snapshot s hysteresí
   - Background thread pravidelně (120s) aktualizuje profit data

4. **Miner** (`main.rs`):
   - `read_next_job` přijímá a loguje `stream_weights` z job messages

**Env proměnné:**
```
ZION_STREAM_PROFIT_SWITCH=true          # enable profit-based weights
ZION_STREAM_PROFIT_API_PROVIDER=fallback # nicehash|whattomine|coingecko|fallback
ZION_STREAM_PROFIT_INTERVAL=120          # refresh interval (sekundy)
ZION_STREAM_HYSTERESIS_PCT=15.0          # min improvement % pro switch
ZION_STREAM_PROFIT_SOURCES=zion,keccak_bonus,sha3_bonus,ncl_ai
```

**Testy:** 8 nových stream_profit testů, 201 cosmic-harmony, 38 pool, workspace ✓

**Co chybí (další fáze):**
- [x] ~~Live API fetching (WhatToMine/CoinGecko)~~ — DONE v R1b
- [x] ~~GPU kernel parametrizace~~ — DONE v R1c
- [x] ~~Pipeline step multipliers v OpenCL kernelu~~ — DONE v R1c

### Fáze R1b: Live API fetching (DONE ✅)

**Commit:** `e1c28689b` — `feat(stream-profit): R1b — live API fetching for profit snapshots`

**Cíl:** Naplnit `StreamProfitSnapshot` z reálných API dat místo fallback estimates.

**Co bylo implementováno:**

1. **`reqwest` + `tokio` deps** v `V3/L1/cosmic-harmony/Cargo.toml`
   - `reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }`
   - `tokio = { version = "1", features = ["rt"] }`

2. **API clients** v `stream_profit.rs`:
   - `fetch_profit_snapshot()` — dispatcher podle `api_provider`
   - `fetch_whattomine()` — WhatToMine coins.json, mapuje DCR/ALPH→KeccakBonus, KAS→Sha3Bonus
   - `fetch_coingecko()` — CoinGecko spot ceny (DCR, ALPH, KAS)
   - `fetch_url_blocking()` — HTTP client přes tokio runtime + reqwest async (10s timeout)
   - `parse_whattomine_response()` / `parse_coingecko_response()` — JSON parsery
   - Fallback: static estimates při API chybě (live=false)

3. **Background fetcher** v `server.rs`:
   - `fetch_profit_snapshot(&cfg_clone)` nahradil `StreamProfitSnapshot::fallback()`
   - Error handling: API timeout → fallback s live=false

### Fáze R1c: GPU kernel parametrizace (DONE ✅)

**Commits:** `74a353205` + `87bb2b2f0`

**Cíl:** GPU kernel aplikuje stream weights na work distribution.

**Co bylo implementováno:**

1. **OpenCL kernel parametrizace** (`deeksha_lite.cl`, `deeksha_chv3.cl`, `deeksha_lite_fire.cl`):
   - Přidán `__constant float *stream_weights` 6. argument kernelu
   - `stream_byproduct_keccak/sha3/aes` — extra byproduct práce AFTER base hash
   - `SW_*` indexy (0-5): ZION, KECCAK_BONUS, SHA3_BONUS, NCL_AI, DEEKSHA_LITE, THERMAL
   - `STREAM_ITERS_SCALE = 16.0f` — max 16 extra kol per stream
   - Base PoW hash se nemění — výsledky byproductů se zapisují do scratchpadu (zahozeny)

2. **Miner GPU backend** (`gpu_backend.rs`):
   - `stream_weights_f32()` — konverze `StreamWeights` → `[f32; 6]`
   - `set_stream_weights()` — trait metoda pro `opencl_deeksha_lite` i `opencl_deeksha_lite_fire`
   - `stream_weights_buf: Buffer<f32>` — inicializován na `[0.0; 6]`, aktualizován při novém jobu
   - Kernel build předává `stream_weights_buf` jako 6. argument

3. **Miner** (`main.rs`):
   - Parsuje `stream_weights_str` z pool message přes `StreamWeights::parse()`
   - Volá `g.set_stream_weights(&weights)` na GPU backendu

4. **Byproduct submission** (future):
   - Extra Keccak hashe → NiceHash Keccak hash-power orders
   - Extra NPU work → NCL AI compute marketplace

**Testy:** 201 cosmic-harmony + 38 pool = 239/239 prošlo ✅

### Fáze R2: DCR revenue live (1-2h, po R0)

- [ ] Pool se připojí k WoolyPooly DCR pool (pool.woolypooly.com:3152)
- [ ] Revenue minery dostávají DCR blake3 jobs
- [ ] Shares forwardovány a acceptovány WoolyPooly
- [ ] BTC revenue se objeví na WoolyPooly dashboardu
- [ ] `RevenueStats.by_source["blake3_external"]` > 0
- [ ] Dashboard widget: external revenue per coin

### Fáze R3: ALPH + KAS E2E (2-4h)

- [ ] ALPH E2E test s `AUXPOW_E2E_COIN=alph` na 2miners pool
- [ ] KAS E2E test s `AUXPOW_E2E_COIN=kas` na 2miners pool
- [ ] Pool config: podpora multi-coin (nebo force_coin switch)
- [ ] `ZION_STREAM_KHEAVYHASH_PCT=10` — KAS lane aktivní
- [ ] Revenue stream breakdown: ZION 50% / DCR 15% / ALPH 10% / KAS 10% / NCL 15%

### Fáze R4: Stream telemetry revenue report (2-4h)

- [ ] Pool: po každém ZION bloku volat `track_deeksha_streams()`
- [ ] Pool: po každém accepted external share volat `track_event(Blake3External)`
- [ ] Dashboard: sjednocený revenue report (ZION + external + NCL)
- [ ] API endpoint: `GET /api/v1/revenue/stats` → `RevenueStats` JSON
- [ ] API endpoint: `GET /api/v1/revenue/streams` → per-stream breakdown
- [ ] Per-stream 24h/7d/30d grafy

### Fáze R5: SMOS deploy + GPU mining (2-4h, blocked)

- [ ] Build new miner binary s all algorithm support
- [ ] Package as SMOS custom miner zip
- [ ] Upload to `zionterranova.com/zion-miner/`
- [ ] Update SMOS group config via API
- [ ] Verify miner connects + mines blake3_dcr
- [ ] Verify share accepted by WoolyPooly through pool

### Fáze R6: EthStratum protocol (DONE ✅)

**Commit:** `5baa76d60` — `feat(auxpow): R6 — EthStratum protocol support`

**Co bylo implementováno:**
- [x] `eth_getWork` polling — background task posílá `eth_getWork` request každé 3s
- [x] `eth_getWork` response parsing — parsuje `[seed_hash, header_hash, target]` do `ExternalJob`
- [x] `eth_getWork` notification handler — refaktorováno do sdíleného `parse_eth_getwork_params()`
- [x] `eth_submitWork` submit — již existoval, nyní testováno
- [x] `eth_submitHashrate` — nová metoda pro hashrate reporty
- [x] Test s ERG mock server (Autolykos, no mix hash needed)
- [x] Test eth_getWork push notification path
- [x] Test eth_submitHashrate

**Odblokováno:** 4 coiny — ERG (Autolykos), EVR, MEWC, CLORE (KawPow)
**Testy:** 81/81 prošlo (3 nové EthStratum testy)

### Fáze R7: True AuxPow consensus (20-40h, future)

- [ ] DCR header parsing + coinbase commitment
- [ ] Integrate `true_auxpow.rs` into `V3/L1/core` consensus
- [ ] Height-gated fork logic pro AuxPoW blocks
- [ ] New ZION header fields pro AuxPoW data
- [ ] Aux Merkle tree validation
- [ ] Viz `AUXPOW_TRUE_MERGE_MINING_PLAN.md` pro detaily

---

## 10. CHv3 Stream Integration — Detailní plán

### 10.1 RevenueCollector wiring (co už funguje vs co chybí)

**Funguje:**
- `RevenueCollector::track_zion_block()` — voláno po každém accepted ZION bloku
- `RevenueCollector::track_deeksha_streams()` — voláno po bloku s telemetry
- `RevenueCollector::track_ncl_task()` — voláno po NCL task completion
- `RevenueCollector::get_stats()` → `RevenueStats` snapshot
- `RevenueJournal` persistence (optional, via env)

**Chybí (R3):**
- `RevenueCollector::track_event(Blake3External)` — **není voláno** při accepted
  external share. Pool forwarduje share do WoolyPooly, ale nezaznamená revenue
  do collectoru. → **Akce:** Přidat `track_event()` call v `auxpow_bridge`
  share forward callbacku.
- API endpointy pro revenue stats — `/api/v1/revenue/stats` neexistuje
- Dashboard widget pro external revenue

### 10.2 Stream telemetry → RevenueSource mapping

| Pipeline (deeksha_chv3) | DeekshaStep | RevenueSource | Work units |
|--------------------------|-------------|---------------|------------|
| Step 1 Keccak-256 | Keccak256 | KeccakBonus | 5 |
| Step 2 MemoryHard | MemoryHard | Zion | 55 |
| Step 3 AesMix | AesMix | DeekshaLite | 5 |
| Step 4 ThermalLoop | ThermalLoop | DeekshaLite | 3 |
| Step 5 KeccakFinal | KeccakFinal | Zion | 2 |

| AuxPow B2b (external) | RevenueSource | Fee |
|------------------------|---------------|-----|
| DCR (Blake3) | Blake3External | 2% |
| ALPH (Blake3 double) | Blake3External | 2% |
| KAS (kHeavyHash) | KHeavyHashExternal | 2% |
| ERG (Autolykos) | AutolykosExternal | 2% |
| RVN (KawPow) | KawPowExternal | 2% |
| ETC (Ethash) | EthashExternal | 2% |
| XMR (RandomX) | RandomXExternal | 2% |
| FLUX (ZelHash) | ZelHashExternal | 2% |

### 10.3 Revenue flow — end to end

```
1. Miner se připojí k poolu (stratum :8444)
   ├── password "g=zion" → SessionGroup::Zion
   ├── password "g=revenue" → SessionGroup::Revenue
   └── no hint → SessionGroup::Auto (weighted round-robin)

2. RevenueScheduler dispatch:
   ├── Zion group → deeksha_chv3 job (z node template)
   ├── Revenue group → external job (z AuxPowBridge queue)
   └── Ncl group → NCL AI task

3. Miner hasheje:
   ├── Zion: deeksha_chv3 GPU/CPU kernel → ZION share
   ├── Revenue: blake3_dcr / kheavyhash GPU kernel → external share
   └── Ncl: AI inference → NCL result

4. Pool zpracuje share:
   ├── Zion share → submit to node → block? → track_zion_block() + track_deeksha_streams()
   ├── External share → AuxPowBridge.forward() → WoolyPooly → track_event(Blake3External) [CHYBÍ]
   └── NCL result → track_ncl_task()

5. RevenueCollector agreguje:
   ├── RevenueStats.total_earnings_usd += all sources
   ├── RevenueStats.by_source["zion"] += ZION block value
   ├── RevenueStats.by_source["blake3_external"] += DCR/ALPH share value [CHYBÍ]
   └── RevenueStats.by_source["ncl_ai"] += NCL task value

6. Payout:
   ├── ZION: PPLNS engine → miner payout (89% / 5% humanitarian / 5% issobella / 1% pool)
   ├── External: BTC na WoolyPooly wallet → auto-buyback ZION (TODO)
   └── NCL: NCL token rewards (TODO)
```

### 10.4 Co implementovat pro R3 (stream telemetry revenue report)

**Soubor:** `V3/L1/pool/src/bin/server.rs`

1. V `auxpow_bridge` share forward callbacku (line ~448):
   ```rust
   // Po ShareForwardOutcome::Accepted:
   let value_usd = estimate_share_value_usd(coin, difficulty);
   revenue_collector.track_event(RevenueEvent {
       source: RevenueSource::Blake3External, // nebo coin.algorithm() → RevenueSource
       value_usd,
       qualifies: true,
       timestamp: Some(Utc::now().to_rfc3339()),
   });
   ```

2. Nový API endpoint:
   ```rust
   // GET /api/v1/revenue/stats
   async fn revenue_stats_handler(collector: Arc<RevenueCollector>) -> impl Reply {
       let stats = collector.get_stats();
       warp::reply::json(&stats)
   }
   ```

3. Dashboard widget (app.py):
   - External revenue per coin (24h graf)
   - Stream breakdown pie chart (ZION / Blake3 / NCL / ...)
   - Total earnings USD counter

### 10.5 Historical context — co se naučili z 2.9.x

Z archivních dokumentů (`docs/ChV3.md`, `docs/docs2.9/2.9.5/WORK_REPORT_07_FEB_2026_CH3_STREAM_SCHEDULER.md`):

1. **StreamScheduler v1 (2.9.5)** — deficit-based time-splitting, 50/25/25 model.
   Fungoval, ale jen pro CPU minery (VRSC/XMR). GPU streamy nebyly implementovány.

2. **"FREE byproduct" streams selhaly** — Keccak/SHA3 intermediates nejsou validní
   pro ETC/NXS pools. Lekce: true merge mining vyžaduje stejný PoW algoritmus.

3. **Per-miner groups (2.9.5)** — `g=zion|revenue|ncl` password hint. Paralelní
   multi-mining bez TimeSplit cycling. → V3 používá `SessionGroup` enum.

4. **Revenue Lock (2.9.5)** — miner drží ext-* job po dobu 120s (zabraňuje
   flapping mezi ZION a external). → V3 má `should_issue_external_job()` s
   split config.

5. **Profit Switcher (2.9.5)** — WhatToMine API, hysteresis 30 min. → V3 má
   `AuxPowScheduler` s circuit breaker + hysteresis.

6. **BTC Buyback Engine (2.9.5)** — monitor MoneroOcean balance, auto-convert
   XMR→BTC→ZION. → V3: TODO (manual conversion zatím).

### 10.6 Související plány (reference)

| Plán | Velikost | Focus | Status |
|------|----------|-------|--------|
| `AuxPlan.md` (tento) | 18KB→rev2 | B2b multi-algo GPU mining + CHv3 stream integrace | **AKTIVNÍ** |
| `AUXPOW_TRUE_MERGE_MINING_PLAN.md` | 90KB | True AuxPoW consensus (DCR primary, ALPH secondary) | Referenční |
| `AUXPOW_TRUE_MERGE_MINING_PLAN_CS.md` | 93KB | Czech translation of true merge mining plan | Referenční |
| `AUXPOW_MERGE_MINING_PLAN.md` | 26KB | Starší merge mining plan | Historický |
| `AuXpow/REVENUE_B2B_AND_TRUE_AUXPOW_DESIGN.md` | — | B2b + true AuxPoW design doc | Referenční |
| `docs/3.0.5/DEEKSHA_CHV3_UNIFIED_ALGO_PLAN.md` | 15KB | CHv3 unified algorithm (Phase A-D) | ✅ DEPLOYED |
| `docs/ChV3.md` | 909 lines | CHv3 master plan (2.9.5→3.0) | Historický kontext |
| `docs/CHv3/CH3_MULTICHAIN_NATIVE_IMPLEMENTATION.md` | 790 lines | Native multi-chain mining (Python era) | Historický |
| `docs/docs2.9/2.9.5/WORK_REPORT_07_FEB_2026_CH3_STREAM_SCHEDULER.md` | 227 lines | StreamScheduler v1 deploy report | Historický |
| `docs/docs2.9/2.9.4/reports/COSMIC_HARMONY_V3_REVENUE_PLAN.md` | 35 lines | Revenue rebalancing (50/25/25) | Historický |
| `docs/docs2.9/INTEGRATION_PLAN_CH3_EXTERNAL_MINING.md` | 372 lines | CH3 external mining integration (Python era) | Historický |
