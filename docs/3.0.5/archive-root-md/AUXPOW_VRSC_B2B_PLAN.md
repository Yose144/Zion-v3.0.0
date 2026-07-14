# AuxPow VRSC B2b Revenue Integration Plan

> **Status:** 2026-07-13 — Planning + Implementation
> **Author:** Devin + Yose | **Repo:** `Zion-v3.0.0`
> **Scope:** Přidat Verus (VRSC) jako 12. external coin do B2b AuxPow revenue systému
> **Approach:** B2b revenue only — ZION si ponechá Deeksha PoW, VRSC je pouze revenue stream
> **Prerequisite:** Reálný VerusHash v2.2 hasher (Haraka+CLHash) z 2.9.9 archivu

---

## 1. Proč Verus (VRSC)?

### 1.1 VerusHash v2.2 — ASIC/GPU Resistant

| Vlastnost | Detail |
|-----------|--------|
| **Algoritmus** | VerusHash v2.2 (Haraka-512 + CLHash + BLAKE2b) |
| **Design** | CPU-optimized — využívá AES-NI / ARM crypto extensions |
| **ASIC resistant** | ✅ ANO — memory-hard + instruction-specific design |
| **GPU resistant** | ✅ ANO — CPU má výhodu nad GPU (sequential, memory-intensive) |
| **FPGA resistant** | ✅ ANO — VerusHash 2.0 fork specifically killed FPGA advantage (2019) |
| **Output** | 32-byte (256-bit) hash |

### 1.2 Verus ekosystém

| Vlastnost | Hodnota |
|-----------|---------|
| **Ticker** | VRSC |
| **Cena (2026-07-13)** | $0.35–0.43 |
| **Market cap** | ~$35M |
| **Nethash** | 750 GH/s – 1 TH/s |
| **Block time** | 1 minuta |
| **Block reward** | 3.0 VRSC |
| **Max supply** | 83,540,184 VRSC |
| **Konsenzus** | 50/50 PoW/PoS (VerusPoP — 51% attack resistant) |
| **Fair launch** | ✅ Žádný premine, žádné ICO, žádné dev fees |
| **Launch** | 2018-05-21 |

### 1.3 Proč B2b revenue only (ne true merge mining)

ZION chce zachovat:
- **Deeksha PoW** — vlastní algoritmus, ASIC resistant
- **Plnou nezávislost** — žádný parent chain
- **Vlastní konsenzus** — žádné dědění Verus pravidel

True merge mining vyžaduje **stejný PoW algoritmus** na obou chainech. Pokud by ZION
přepnul na VerusHash, ztratil by Deeksha. Proto volíme **B2b revenue only**:

- ZION pool se připojí k VRSC poolu (LuckPool) jako klient
- Pool stáhne VRSC joby, přepošle je minerům
- Minery hashejí VerusHash (CPU nebo GPU)
- Pool forwarduje shares do LuckPool
- Revenue přichází jako VRSC (nebo BTC payout)
- **ZIO chain zůstává netčený** — Deeksha PoW, vlastní bloky

### 1.4 Historický kontext — ZION už měl VRSC v 2.9.9

ZION 2.9.9 měl **kompletní Verus integraci**:

| Komponenta | Soubor (2.9.9) | Stav |
|------------|----------------|------|
| VerusHash C++ | `L1/native-libs/verushash-native/csrc/` | ✅ Full Haraka+CLHash |
| Revenue proxy | `L1/pool/src/revenue_proxy.rs` | ✅ ZcashStratum, LuckPool |
| CPU miner | `L1/miner/src/miner/cpu.rs` | ✅ PBaaS v7+ nonce iterace |
| Profit switcher | `L1/pool/src/profit_switcher.rs` | ✅ VRSC/XMR switching |
| Stream scheduler | `L1/pool/src/stream_scheduler.rs` | ✅ 50/25/25 s VRSC |

V3 už má **VerusHash FFI infrastrukturu** (stub):
- `V3/L1/native-ffi/src/lib.rs` — FFI deklarace, safe wrapper, self-tests
- `V3/L1/native-ffi/csrc/verushash/verushash_portable.c` — Keccak-256 placeholder
- `V3/L1/miner/src/parallel.rs` — Algorithm dispatch pro `"verushash"`
- `V3/L1/miner/Cargo.toml` — `native-verushash` feature flag

---

## 2. Technický design

### 2.1 VRSC coin profile

| Pole | Hodnota |
|------|---------|
| **Ticker** | VRSC |
| **Algorithm** | verushash |
| **Default pool** | eu.luckpool.net:3956 (LuckPool, 1% fee, merge-mining ✅) |
| **Protocol** | ZcashStratum (3rd protocol variant) |
| **Wallet** | VRSC wallet (nebo BTC payout přes p2pool) |
| **Password** | `d=0.01` (starting difficulty) |
| **Submit format** | 5-param: `[worker, job_id, ntime, nonce2, solution]` |

### 2.2 ZcashStratum protokol

VRSC používá **Zcash/Equihash-style Stratum** — třetí protokolová varianta
(vedle Stratum v1 a EthStratum).

**Rozdíly od standard Stratum v1:**

| Aspekt | Stratum v1 | ZcashStratum (VRSC) |
|--------|-----------|---------------------|
| **Subscribe** | `mining.subscribe` | `mining.subscribe` (stejné) |
| **Authorize** | `mining.authorize` | `mining.authorize` (stejné) |
| **Notify params** | `[job_id, header, target, clean]` | `[job_id, prevhash, merkleroot, reserved, ntime, nbits, extranonce1, extranonce2_size, solution, clean_jobs]` |
| **Job blob** | header hex | `header_prefix(108B) + varint(fd4005) + solution(1344B) = 1455B` |
| **Submit** | `[worker, job_id, nonce]` | `[worker, job_id, ntime, nonce2, solution_with_varint]` |
| **Nonce iterace** | v header nonce field | v solution nonceSpace (last 15 bytes) |
| **Hash** | přes header | přes `header(140B) + solution(1347B) = 1487B` |

### 2.3 PBaaS v7+ nonce iterace

Verus PBaaS v7+ merge mining protokol:

1. Pool pošle: `header_prefix(108B) + varint(3B) + solution(1344B) = 1455B`
2. Miner buildí: `header_prefix(108B) + nonce(32B) + varint(3B) + solution(1344B) = 1487B`
3. **Header nonce** je z daemonu (pool ignoruje miner nonce)
4. Pool **zeroes nonce v headeru** pro hashing (ClearNonCanonicalData)
5. Miner iteruje **counting nonce v SOLUTION** (last 15 bytes = nonceSpace):
   - Layout: `extranonce1(4B) + padding(7B) + counting_nonce(4B)`
   - Pool checkuje extraNonce1 v last 15 bytes solution
6. VerusHash se počítá přes celý blok: `header(140B) + solution(1347B) = 1487B`

### 2.4 ClearNonCanonicalData

Pool zeroing před hashing:
- `hashPrevBlock` (32B)
- `hashMerkleRoot` (32B)
- `hashFinalSaplingRoot` (32B) — 96B total
- `nBits` (4B)
- `nNonce` (32B)
- MMR roots (64B)

---

## 3. Implementační fáze

### Fáze 2a: VerusHash C++ port (reálný hasher)

**Cíl:** Nahradit `verushash_portable.c` (Keccak stub) reálnou Haraka+CLHash implementací.

**Zdroj:** `archive/2.9.9/legacy-code/L1/native-libs/verushash-native/csrc/`
- `verus_slhash1.cpp` — Haraka + CLHash pipeline (800+ řádků)
- `ffi_wrapper.cpp` — C FFI wrapper
- `compat.h`, `compat1.h` — kompatibilita
- `tinyformat.h` — utility

**Cíl v V3:** `V3/L1/native-ffi/csrc/verushash/`
- `verushash.c` (nebo `.cpp`) — reálná implementace
- Zachovat existující FFI signatures z `verushash_portable.c`

**AES-NI / ARM detekce:**
- x86_64: `-maes -msse4 -mpclmul` flagy
- aarch64: `-march=armv8-a+crypto` flagy
- Fallback: portable C bez AES-NI (pomalejší, ale funkční)

**Effort:** ~2-4 hod

### Fáze 2b: build.rs update

**Cíl:** Kompilace VerusHash C++ s platform-specific flagy.

**Změny v** `V3/L1/native-ffi/build.rs`:
- Detekce x86_64 → AES-NI flagy
- Detekce aarch64 → ARM crypto flagy
- Kompilace `verushash.c` místo `verushash_portable.c`
- Linkování potřebných systémových knihoven

**Effort:** ~30 min

### Fáze 1: Typy a konfigurace

**Změny v** `AuXpow/src/types.rs`:
- Přidat `VRSC` do `ExternalCoin` enum
- `ticker()` → `"VRSC"`
- `algorithm()` → `"verushash"`
- `is_cpu()` → `true` (VRSC je CPU-friendly)
- `from_str_loose("vrsc" | "verus")` → `Some(Self::VRSC)`
- `default_pool()` → `"eu.luckpool.net:3956"`
- `supports_btc_payout()` → `false` (LuckPool platí VRSC)
- `is_zpool()` → `false`
- `all()` → přidat VRSC
- `fallback_estimates()` → přidat VRSC entry

**Změny v** `AuXpow/src/external_hashers.rs`:
- Přidat `VerusHash` do `ExternalAlgorithm` enum
- `as_str()` → `"verushash"`
- `from_str_loose("verushash" | "verus")` → `Some(Self::VerusHash)`
- Přidat `hash_verushash()` funkci (volá native FFI)

**Změny v** `AuXpow/src/auxpow_client.rs`:
- Přidat `ZcashStratum` do `StratumProtocol` enum
- `ExternalCoin::protocol()` → VRSC vrací `ZcashStratum`
- `as_str()` → `"zcashstratum"`

**Změny v** `V3/L1/cosmic-harmony/src/profit_router.rs`:
- Přidat `VRSC` do `ExternalCoin` enum (zrcadlo AuXpow)
- Update `ch_to_auxpow_external_coin()` a `auxpow_to_ch_external_coin()`

**Effort:** ~30 min

### Fáze 3: ZcashStratum protokol handler

**Změny v** `AuXpow/src/auxpow_client.rs`:

**3.1 Subscribe** — standard `mining.subscribe`, extranonce1 parsing OK.

**3.2 Authorize** — `mining.authorize` s password `d=0.01` pro VRSC.

**3.3 Notify parser** — Zcash-style 10-param:
```
[job_id, prevhash, merkleroot, reserved, ntime, nbits,
 extranonce1, extranonce2_size, solution, clean_jobs]
```
- Reconstruct blob: `header_prefix(108B) + varint(fd4005) + solution(1344B)`
- Pad solution na 1344 bytes (2688 hex chars)
- Store: header_prefix, solution, ntime per job_id

**3.4 Submit** — 5-param:
```
[worker, job_id, ntime, nonce2, solution_with_varint]
```
- Reconstruct full 1487B: `header_prefix + nonce + varint + solution`
- Apply ClearNonCanonicalData zeroing
- Embed extranonce1 v nonceSpace (last 15 bytes solution)
- Compute nonce2 z remaining nonce bytes

**3.5 PBaaS v7+ detekce:**
- Detekce z solution version byte a flag
- nonceSpace iterace (last 15 bytes)
- extranonce1 embedding

**Effort:** ~2-3 hod

### Fáze 4: Bridge a profit router

**Změny v** `V3/L1/pool/src/bin/server.rs`:
- Update `auxpow_to_ch_external_coin()` a `ch_to_auxpow_external_coin()`
- VRSC v profit rotation

**Změny v** `V3/L1/cosmic-harmony/src/stream_profit.rs`:
- VRSC do WhatToMine/CoinGecko fetch (pokud API podporuje)

**Testy:**
- VRSC coin profile test
- VRSC protocol test (ZcashStratum)
- VRSC notify parsing test
- VRSC submit format test
- VRSC v select_best_coin test

**Effort:** ~30 min

---

## 4. LuckPool VRSC pool details

| Parametr | Hodnota |
|----------|---------|
| **URL** | `eu.luckpool.net:3956` |
| **Fee** | 1% |
| **Merge mining** | ✅ ANO |
| **Payout** | VRSC (ne BTC) |
| **Min payout** | 0.1 VRSC |
| **Protocol** | ZcashStratum |
| **Difficulty** | auto-vardiff, start `d=0.01` |

**Alternativní pooly (merge-mining capable):**
- Verus Pool (5% fee, donates to Verus Foundation)
- Paddy Pool (3% fee)
- An Interesting Hole (1% fee)
- Verus Farm (0.3% fee)
- CiscoTech (1% fee)

---

## 5. Revenue expectations

Z WhatToMine (2026-07-13):
- VRSC block reward: 3.0 VRSC
- VRSC price: ~$0.43
- Nethash: ~750 GH/s
- Daily emission: 4320 VRSC = ~$1,860
- Revenue per 100 MH/s: ~$0.14/day (speculative)

**Poznámka:** VRSC revenue je nízký vzhledem k vysokému nethash. Hlavní
hodnota není v revenue, ale v:
1. **ASIC-resistant revenue stream** (CPU-friendly)
2. **Diverzifikace** — ne jen Blake3/KawPow coinů
3. **Ekosystémové spojenectví** s Verus komunitou
4. **Future option** — pokud ZION později chce PBaaS chain, má už integraci

---

## 6. Soubory k úpravě

| Soubor | Změna | Fáze |
|--------|-------|------|
| `V3/L1/native-ffi/csrc/verushash/verushash_portable.c` | Nahradit reálnou Haraka+CLHash | 2a |
| `V3/L1/native-ffi/build.rs` | AES-NI/ARM flagy pro verushash | 2b |
| `AuXpow/src/types.rs` | VRSC enum, profile, estimates | 1 |
| `AuXpow/src/external_hashers.rs` | VerusHash algorithm, hash function | 1 |
| `AuXpow/src/auxpow_client.rs` | ZcashStratum protocol, notify/submit | 1+3 |
| `V3/L1/cosmic-harmony/src/profit_router.rs` | VRSC enum mirror, conversion | 4 |
| `V3/L1/pool/src/bin/server.rs` | VRSC conversion functions | 4 |
| `V3/L1/cosmic-harmony/src/stream_profit.rs` | VRSC v API fetch | 4 |

---

## 7. Test plan

### 7.1 Unit testy
- `VRSC` coin profile (ticker, algo, pool, protocol)
- `VerusHash` algorithm enum
- `ZcashStratum` protocol enum
- VRSC notify parsing (10-param, blob reconstruction)
- VRSC submit format (5-param, ClearNonCanonicalData)
- VRSC v `select_best_coin()` s hysteresis
- VRSC v `fallback_estimates()`

### 7.2 Integration testy
- VerusHash hasher determinism (same input → same output)
- VerusHash hasher non-zero output
- VerusHash v `parallel.rs` algorithm dispatch

### 7.3 E2E test
- Connect to LuckPool `eu.luckpool.net:3956`
- Subscribe + authorize
- Receive job, reconstruct blob
- Mine (CPU), find share
- Submit share, verify accepted
- Verify v pool dashboard

---

## 8. Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| VerusHash C++ nepůjde zkompilovat na serveru | Low | High | Portable fallback bez AES-NI |
| LuckPool odmítne shares (protocol mismatch) | Medium | Medium | Test s `d=0.01` low diff |
| PBaaS v7+ detekce fail | Medium | Medium | Fallback na legacy nonce iterace |
| VRSC revenue příliš nízký | High | Low | Hlavní hodnota v diversifikaci, ne revenue |
| VerusHash stub (Keccak) produkuje invalid hashe | Certain | High | Fáze 2a musí být first (reálný hasher) |

---

## 9. Související plány

| Plán | Focus | Status |
|------|-------|--------|
| `AuxPlan.md` | B2b multi-algo GPU mining + CHv3 stream | **AKTIVNÍ** |
| `AUXPOW_TRUE_MERGE_MINING_PLAN.md` | True AuxPoW consensus (DCR/ALPH) | Referenční (zastaralý — ASIC conflict) |
| `AuXpow/REVENUE_B2B_AND_TRUE_AUXPOW_DESIGN.md` | B2b + true AuxPoW design | Referenční |
| **Tento plán** | **VRSC B2b revenue integration** | **AKTIVNÍ** |

---

## 10. Rozhodnutí o R7 (True AuxPoW)

**Původní R7 plán** (DCR/Blake3 true merge mining) je **zastaralý** — Blake3 je
ASIC-dominated (5 PH/s DCR ASICs), což by zabilo ZION ASIC resistance.

**Nová R7 vize:** ZION zůstává s Deeksha PoW. True merge mining není prioritou.
B2b revenue (VRSC, RVN, KAS, etc.) pokrývá revenue potřeby bez consensus změn.

Pokud ZION v budoucnu chce true merge mining, ideální partner je **Verus PBaaS
chain** — ale to vyžaduje přepnutí ZION PoW na VerusHash, což je velké rozhodnutí
mimo scope tohoto plánu.
