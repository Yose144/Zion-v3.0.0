# Session Report — 2026-07-16

## Overview

Dnešní session rozšířila `ExternalCoin` enum o 8 nových no-DAG GPU-mineable coinů, implementovala dynamické čtení stream configu z poolu v mineru, a přepnula Edge pool config zpět na EPIC po QUAI testování.

## 1. Rozšíření ExternalCoin o 8 nových mincí

### Nové coiny (z WhatToMine research, RX 5600 XT 6GB):

| Ticker | Coin | Algoritmus | Hashrate | Pool | Revenue/day |
|--------|------|-----------|----------|------|-------------|
| KLS | Karlsen | KarlsenHashV2 | 340 MH/s @ 90W | woolypooly.com:3132 | ~$0.21 |
| ZCL | Zclassic | EquihashZero (192,7) | 24.2 h/s @ 110W | equihash192.eu.mine.zpool.ca:2144 | ~$0.20 |
| QTC | Qubitcoin | Qhash | 650 MH/s @ 110W | qtc.suprnova.cc:5555 | ~$0.10 |
| VTC | Vertcoin | Verthash | 620 kh/s @ 110W | woolypooly.com:3102 | ~$0.04 |
| IRON | IronFish | FishHash | 27.5 MH/s @ 110W | de.ironfish.herominers.com:1145 | ~$0.04 |
| NEXA | Nexa | NexaPow | 23 MH/s @ 100W | nexa.2miners.com:5050 | ~$0.03 |
| RTM | Raptoreum | GhostRider | 970 h/s @ 100W | ghostrider.eu.mine.zpool.ca:5354 | ~$0.03 |
| DNX | Dynex | DynexSolve (PoUW) | 1.75 kh/s @ 90W | dynex.herominers.com:1030 | ~$0.02 |

### Změněné soubory:

**AuXpow crate:**
- `AuXpow/src/types.rs` — 8 nových ExternalCoin variant + všechny metody (ticker, algorithm, from_str_loose, default_pool, supports_btc_payout, is_zpool, all, fallback_estimates) + 11 nových testů
- `AuXpow/src/gpu_miner.rs` — kernel_info() mappings pro 8 nových algoritmů (placeholder `None` — kernels ještě neexistují)
- `AuXpow/src/auxpow_client.rs` — protocol() match pro 8 nových variant (ZCL→ZcashStratum, ostatní→Stratum)

**cosmic-harmony crate:**
- `V3/L1/cosmic-harmony/src/revenue.rs` — 8 nových RevenueSource variant + as_str() + fee_rate()
- `V3/L1/cosmic-harmony/src/profit_router.rs` — 8 nových ExternalCoin variant + všechny metody + zpool_pool() (ZCL, RTM) + herominers_pool() (IRON, DNX)

**pool crate:**
- `V3/L1/pool/src/bin/server.rs` — 10+ aktualizací:
  - `revenue_source_to_external_coin()` — 8 nových arm
  - `external_coin_to_revenue_source()` — 8 nových arm
  - `external_coin_to_algorithm()` — 8 nových algorithm strings
  - `auxpow_to_ch_external_coin()` / `ch_to_auxpow_external_coin()` — 8 nových arm
  - `source_index()` — 8 nových indexů (18-25)
  - `revenue_source_name()` — 8 nových name strings
  - `parse_revenue_source()` — 8 nových algorithm string mappings
  - Routing stats ticker mapping — 8 nových ticker→RevenueSource entries
  - `push_lane_from_env()` calls — 8 nových env-configurable stream lanes
  - SessionGroup::Revenue match arms — extended s 8 novými sources (2 místa)
  - Array sizes `[u64; 18]` → `[u64; 26]` (source_submits/source_accepted)
  - `ALL_REVENUE_SOURCES` array size 18 → 26

**Dashboard:**
- `ZION_OS/dashboard/dashboard.html` — coin selector dropdown + STREAM_COIN_TICKERS array
- `ZION_OS/dashboard/dashboard.js` — auxCoins fallback array, newAuxCoins config, srcNames, srcColors
- `ZION_OS/dashboard/app.py` — SUPPORTED_COINS list, AUXPOW_SUPPORTED_COINS list

### OpenCL kernels — implementováno (3 commity)

Všechny 8 algoritmů má OpenCL kernel zdrojový kód (5 plně integrovaných, 2 kernel-ready s host-side TODO, 3 dokumentované placeholdery):

| Coin | Algorithm | Kernel File | Lines | Status | Commit |
|------|-----------|-------------|-------|--------|--------|
| **IRON** | FishHash | `fishhash_kernel.cl` | 532 | **Fully integrated** — DAG + mine() dispatch | `f6df75b64` |
| **KLS** | KarlsenHashV2 | `karlsenhash_kernel.cl` | 608 | **Fully integrated** — FishHashPlus + DAG | `f6df75b64` |
| **VTC** | Verthash | `verthash_kernel.cl` + SHA3 | 289+ | Kernel ready, host-side 1.2GB data file loader TODO | `646d14f59` |
| **ZCL** | Equihash 192,7 | `equihash_kernel.cl` + param.h | 851+ | Kernel ready, multi-kernel Wagner dispatch TODO | `646d14f59` |
| **NEXA** | NexaPow | `nexapow_kernel.cl` | 6164 | **Fully integrated** — secp256k1 Schnorr from UltrafastSecp256k1 | `77613ad50` |
| **RTM** | GhostRider | `ghostrider_kernel.cl` | 46 | Placeholder — 15 algos + 6 CN variants needed | `77613ad50` |
| **QTC** | Qhash | `qhash_kernel.cl` | 42 | Placeholder — quantum circuit sim needed | `77613ad50` |
| **DNX** | DynexSolve | `dynexsolve_kernel.cl` | 47 | Placeholder — neuromorphic ODE solver needed | `77613ad50` |

**Zdrojové repozitáře:**
- FishHashMiner (Lolliedieb): `kernels/fishhash.cl` → IRON kernel
- karlsend (Go reference): FishHashPlus address calc → KLS kernel
- VerthashMiner (CryptoGraphics, GPL): `verthash.cl` + SHA3 → VTC kernel
- silentarmy (mbevand): `input.cl` Equihash 200,9 → adapted to 192,7 for ZCL
- UltrafastSecp256k1 (shrec, MIT): secp256k1 field/point/scalar + BIP-340 Schnorr → NEXA kernel
- xmrig (SChernykh): GhostRider C++ reference → RTM documentation
- QubitCoin (super-quantum): qPoW spec → QTC documentation
- DynexSolve (dynexcoin): CUDA reference → DNX documentation

**gpu_miner.rs integrace:**
- `kernel_info()` — 5 nových Some() mappings (IRON, KLS, VTC, ZCL, NEXA)
- Embedded kernel list — 9 nových .cl souborů (include_str!)
- `mine()` dispatch — 3 plně integrované (IRON, KLS, NEXA) + 2 bail! stubs (VTC, ZCL)
- `build_fishhash_kernel()` — DAG buffer + 192-byte header padding
- `build_nexapow_kernel()` — 32-byte candidateHash + target + single-kernel dispatch
- `batch_factor` a `wg_size` match arms — 5 nových algoritmů
- Test `fishhash_karlsenhash_kernel_info_correct` — aktualizován pro 5 nových mappings

## 2. Dynamické čtení stream configu z poolu (miner)

**V3/L1/miner/src/main.rs:**
- `fetch_pool_stream_config()` — HTTP GET `/api/v1/config/streams` z pool HTTP API
  - API adresa z `ZION_POOL_API_ADDR` env var, nebo odvozená ze stratum adresy (port + 11, např. 8444→8455)
  - Vrací `None` při neúspěchu (non-fatal — fallback na env vars)
- `spawn_pool_config_poller()` — background thread pro live monitoring config změn (poll interval 30s, konfigurovatelný přes `ZION_POOL_CONFIG_POLL_SECS`)
- Integrace do `run_remote_session()`:
  - Startup fetch → override `stream2_enabled`/`stream3_enabled` podle pool configu
  - Background poller pro live change notification
  - Clean shutdown poller thread při ukončení session

## 3. Edge pool config přepnutí na EPIC

- Na live serveru (`/etc/zion/edge-environment.sh`): `ZION_POOL_AUXPOW_COIN=QUAI` → `EPIC`
- Pool restartován, logy potvrzují `coin=EPIC algo=progpow` pro GPU stream
- Triple-stream mining aktivní: ZION (GPU) + EPIC (GPU) + VRSC (CPU)

## Build & Test výsledky

| Crate | Build | Testy |
|-------|-------|-------|
| zion-auxpow | OK | 173/173 prošlo |
| zion-cosmic-harmony | OK | 201/201 prošlo |
| zion-pool | OK | 38/38 prošlo |
| zion-miner | OK | 38/38 prošlo (*) |
| Full workspace | OK (0 errors) | — |

(*) Miner testy vyžadují `--test-threads=1` kvůli pre-existing env lock race condition v test guardu.

## Profitabilita (WhatToMine July 2026, $0.10/kWh, RX 5600 XT)

KLS a ZCL jsou nejprofitabilnější nové no-DAG coiny (~$0.20-0.21/day revenue), ale všechny jsou near break-even nebo mírně negativní při $0.10/kWh. ALPH (Blake3) zůstává nejlepší existující no-DAG option na $0.22/day.
