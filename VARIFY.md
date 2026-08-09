# VARIFY — Trinity Engine External Mining Verification Report

**Datum:** 2026-08-09
**Commit:** `5ad3d3d8b` — fix(trinity): external mining nonce cursor + share target + bridge timeout
**Status:** LIVE — VRSC shery potvrzeny a forwardovány do LuckPool

---

## Shrnutí

Trinity engine paralelní mining je **funkční a potvrzený**. Tři kritické bugy byly opraveny a nasazeny na produkci. VRSC (VerusCoin) shery se těží na Mac M1 a Edge serveru, forwardují se přes ZION pool do LuckPool (`eu.luckpool.net:3956`). ZION share submission a block finding běží normálně.

### Klíčová čísla (posledních 10 minut, 07:35–07:45 CEST)

| Metrika | Hodnota |
|---|---|
| VRSC shery forwardovány do LuckPool | **110** |
| ZION shery akceptováno | **88** |
| Chain výška | **774** |
| Chain difficulty | **39 918** |
| Pool uptime | od 07:28:05 CEST |

### VRSC shery per miner (10 min)

| Miner | VRSC shery |
|---|---|
| Mac M1 (`zion1d2k5v0p6p2z...`) | 44 |
| zionserver-gpu (`zion1f0t4x372x2x...`) | 34 |
| local-miner (Edge CPU) | 32 |

### ZION shery per miner (10 min)

| Miner | ZION shery |
|---|---|
| zion1pool (v31-miner) | 63 |
| zionserver-gpu | 20 |
| Mac M1 | 5 |

---

## Opravené bugy

### 1. Nonce Cursor Bug — `parallel.rs` + `runtime.rs`

**Problém:** External stream miners (Stream 2 = ZANO/GPU, Stream 3 = VRSC/CPU) skenovaly pořád stejné nonce range (0..1M) na každé iteraci. Po každém batchi miner čekal na nový job broadcast místo posunu na další nonce range.

**Root cause:** `find_auxpow_share()` a `find_verushash_share()` vždy začínaly od nonce 0. Žádný `start_nonce` parametr neexistoval.

**Fix:**
- Přidán `find_auxpow_share_from(job, threads, batch, start_nonce)` — wrapper s `start_nonce=0` pro zpětnou kompatibilitu
- `find_verushash_share()` přijímá `start_nonce` — thread chunky začínají od `start_nonce + thread_idx * chunk_size`
- `mine_auxpow_share_batch_from(stream, job, batch, start_nonce)` — async wrapper
- `mine_v3_external_share()` přijímá `start_nonce` parametr
- Stream 2 a Stream 3 loops mají `nonce_cursor: u64` který se po každém batchi zvýší o `batch_size`
- Cursor se resetuje na 0 při příchodu nového jobu

**Soubory:**
- `V31/L1/miner/src/parallel.rs` — `find_auxpow_share_from()`, `find_verushash_share()` s `start_nonce`
- `V31/L1/miner/src/runtime.rs` — `mine_auxpow_share_batch_from()`, `mine_v3_external_share()` s `start_nonce`, nonce cursor v Stream 2/3 loops

### 2. Share Target vs Block Target — `auxpow/client.rs`

**Problém:** VRSC ZcashStratum handler používal block target z `nbits` (extrémně těžký — `0x00068db8...`) místo share target z `mining.set_difficulty`. LuckPool neposílá `mining.set_difficulty` pro ZcashStratum, takže miner defaultoval na difficulty=1.0 (max target `0xFFFFFFFF...`) — každý hash byl solution, pool byl flooderán.

**Root cause:** `current_difficulty` default = 1.0, LuckPool neposílá `mining.set_difficulty`, handler fallbackoval na `nbits` block target.

**Fix:**
- VRSC handler nyní používá share difficulty z `current_difficulty`
- Pokud pool neposlal `mining.set_difficulty` (diff ≤ 1.0), použije se **minimální difficulty 10000**
- `difficulty_to_target_with_max(effective_diff, max_target)` generuje správný share target
- Log `vrsc_min_difficulty_applied` při aplikování min difficulty

**Soubor:** `V31/L1/miner/src/auxpow/client.rs` — VRSC ZcashStratum handler (řádky ~872–895)

### 3. Bridge Forward Timeout — `auxpow_bridge.rs` + `stratum.rs`

**Problém:** AuxPoW bridge `forward()` blokoval na `rx.recv()` (synchronous, bez timeoutu). Pokud LuckPool pomalu odpovídal, pool V3 handler thread se zablokoval — žádné další zprávy od minerů se nezpracovaly. Mac M1 ExternalSubmit timeoutoval (30s).

**Root cause:** `std::sync::mpsc::channel()` + `rx.recv()` v async contextu bez timeoutu.

**Fix:**
- `forward()` nyní používá `rx.recv_timeout(Duration::from_secs(5))` — po 5s vrací `None` (share je dropped, ale handler se odblokuje)
- `stratum.rs` volá `forward_by_ticker()` přes `tokio::task::spawn_blocking()` — async handler není blokován
- Pool pošle `ExternalResult` i při timeoutu (status = "channel_closed" nebo "unknown")

**Soubory:**
- `V31/L1/pool/src/auxpow_bridge.rs` — `forward()` s 5s timeoutem
- `V31/L1/pool/src/stratum.rs` — `spawn_blocking` wrapper pro bridge forward

---

## Topologie

```
┌─────────────────────────────────────────────────────────────────┐
│                        ZION Pool (Edge)                         │
│                   62.171.141.136:8444                           │
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────────┐  │
│  │ V3 Handler  │───▶│ AuxPoW Bridge│───▶│ LuckPool VRSC      │  │
│  │ (stratum.rs)│    │ (bridge.rs)  │    │ eu.luckpool.net    │  │
│  └──────┬──────┘    └──────┬───────┘    │ :3956              │  │
│         │                  │            └────────────────────┘  │
│         │                  │            ┌────────────────────┐  │
│         │                  └───────────▶│ HeroMiners ZANO    │  │
│         │                               │ de.zano.herominers │  │
│         │                               │ :1110              │  │
│         │                               └────────────────────┘  │
│         │                                                       │
│  ┌──────▼──────┐                                                │
│  │ ZION Node   │                                                │
│  │ RPC 9445    │                                                │
│  └─────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
    ┌────┴────┐         ┌────┴─────┐        ┌──────┴──────┐
    │ Mac M1  │         │ zionserver│       │ v31-miner   │
    │ Metal   │         │ -gpu (Edge│       │ (Edge CPU)  │
    │ VRSC+ZION│        │ VRSC+ZION │       │ ZION only   │
    └─────────┘         └──────────┘        └─────────────┘
```

## Připojení minery

| Miner | IP | Coin | Backend | Status |
|---|---|---|---|---|
| Mac M1 (`mac-m1-metal`) | 109.81.87.8 | ZION + VRSC | Metal GPU (ZION) / CPU (VRSC) | LIVE |
| zionserver-gpu | 127.0.0.1 | ZION + VRSC | CPU | LIVE |
| v31-miner (`zion1pool`) | 127.0.0.1 | ZION | CPU | LIVE |
| barker | 82.66.171.130 | ZION | CPU | Reconnect loop (client-side) |

## Externí pooly

| Pool | Coin | URL | Status |
|---|---|---|---|
| LuckPool | VRSC | `stratum+tcp://eu.luckpool.net:3956` | Connected, shares forwarded |
| HeroMiners | ZANO | `de.zano.herominers.com:1110` | Connected, no shares (needs GPU) |

## ZANO poznámka

ZANO používá ProgPoW algoritmus který vyžaduje GPU. Edge server nemá GPU, Mac M1 Metal nepodporuje ProgPoW. ZANO external mining produkuje `gpu_ext_batch_failed: GPU backend requested but kind=cpu`. To je **očekávané chování** — pro ZANO mining je potřeba dedikované GPU (AMD/NVIDIA) s OpenCL/CUDA podporou.

---

## Diff statistiky

```
 V31/L1/miner/src/auxpow/client.rs |  33 +++++++---
 V31/L1/miner/src/parallel.rs      |  17 ++++-
 V31/L1/miner/src/runtime.rs       | 130 ++++++++++++++++++++++++++++----------
 V31/L1/pool/src/auxpow_bridge.rs  |   5 +-
 V31/L1/pool/src/stratum.rs        |   6 +-
 5 files changed, 142 insertions(+), 49 deletions(-)
```

## Git historie (Trinity engine fixes)

| Commit | Popis |
|---|---|
| `5ad3d3d8b` | fix(trinity): external mining nonce cursor + share target + bridge timeout |
| `8a26b6026` | fix(pool): double newline in stratum v1 broadcast path |
| `87670ed38` | fix(v3-protocol): double newline in write_v3_message causing decode errors |
| `abff6874b` | fix(miner): respect ZION_STREAM{1,2,3}_ENABLED env vars |
| `4b37b4c11` | fix(pool): forwarding logy + header_bytes fix pro ZANO |

---

## Závěr

Trinity engine paralelní mining je **potvrzeně funkční na produkci**:

- ✅ VRSC shery těženy na Mac M1 + Edge, forwardovány do LuckPool (110 sherů / 10 min)
- ✅ ZION shery akceptovány poolem (88 sherů / 10 min)
- ✅ Chain roste (height 774)
- ✅ Pool stabilní (uptime od 07:28 CEST)
- ✅ LuckPool + HeroMiners připojení aktivní
- ⚠️ ZANO vyžaduje dedikované GPU (očekávané)
- ⚠️ barker miner v reconnect loop (client-side issue)
