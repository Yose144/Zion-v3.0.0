# Session Report — 2026-02-27 (v2) — CHv3 Revenue System Complete (2.9.7)

**Datum:** 27. února 2026  
**Branch:** `main`  
**Commity této session:** `b70efac`, `c3dd4a8`, `b3eb3c8`, `d1a2697`, `fff2061`, `e39faa7`

---

## Souhrn session

Kompletní implementace CHv3 revenue systému pro verzi 2.9.7.  
Přidány 4 commity, celkem ~700 insertions.

Začali jsme od stavu kde profit switcher tahá data pouze z WhatToMine (Tier 1a)  
a pošli přes multi-source data feeds až po kompletní pool routing hierarchii.

---

## 1. HeroMiners Tier 1c Profit Feed (`b70efac`)

**Soubory:** `L1/pool/src/profit_switcher.rs`, `L1/miner/src/stratum/ethstratum.rs`

### Co bylo přidáno:
- `ExternalCoin::herominers_url(region)` — stratum URL pro 7 coinů
- `fetch_herominers()` — paralelní tokio::spawn per coin, daily USD/TH výpočet
- Tokio join rozšířen na 3-way: `join!(WTM, ZPool, HeroMiners)`

### HeroMiners endpoint mapa (ověřeno 02.2026):
| Coin | Subdomain | Port | coinUnits |
|------|-----------|------|-----------|
| ETC | etc | 1150 | 1e18 |
| KAS | kaspa | 1206 | 1e8 |
| ALPH | alephium | 1220 | 1e18 |
| ERG | ergo | 1180 | 1e9 |
| CFX | conflux | 1170 | 1e18 |
| RVN | ravencoin | 1140 | 1e8 |
| ZANO | zano | 1110 | 1e12 |

EPIC — endpoint nedostupný → fallback ZPool firopow:1326  
FLUX/DCR/EVR/MEWC — není na HeroMiners

### ZPool opravy:
- `algo_map` doplněn: `evrprogpow → EVR`, `meowpow → MEWC`
- EVR/MEWC nyní dostávají profit score z ZPool API

---

## 2. NiceHash Tier 1d + CoinGecko Price Oracle (`c3dd4a8`)

**Soubory:** `L1/pool/src/profit_switcher.rs`

### NiceHash (Tier 1d):
- API: `api2.nicehash.com/main/api/v2/public/simplemultialgo/info` — bez API klíče
- `fetch_nicehash()` — algo mapa: KAWPOW→RVN, ETCHASH→ETC, OCTOPUS→CFX, AUTOLYKOS→ERG
- Nové structs: `NhResponse`, `NhAlgo`
- `paying` field v BTC/speed-unit/day → normalizace na GH/s

### CoinGecko Price Oracle:
- API: `api.coingecko.com/api/v3/simple/price` — bez API klíče, volná tier
- `COINGECKO_IDS` const — 16 coinů + BTC
- `fetch_coingecko_prices()` + `enrich_prices()` — přepisuje `price_usd` na všech coinech
- Řeší problém `price_usd=0` na ZPool/NiceHash feedech

### Výsledná architektura Tier 1:
```
tokio::join!(WTM, ZPool, HeroMiners, NiceHash, CoinGecko)  ← 5-way paralelně
     ↓
Merge všech feedů → enrich_prices(CoinGecko) → best coin
```

---

## 3. NiceHash Stratum URL (`b3eb3c8`)

**Soubory:** `L1/miner/src/stratum/ethstratum.rs`, `L1/miner/src/miner/dual_stream.rs`

### `ExternalCoin::nicehash_url(region)`:
| Coin | Algo | Port |
|------|------|------|
| ETC | etchash | 9013 |
| RVN | kawpow | 9017 |
| ERG | autolykos | 9018 |
| KAS | kheavyhash | 9024 |
| CFX | octopus | 9020 |

Region mapa: `"eu"` → `eu`, `"na"/"us"` → `usa`, ostatní → `auto`  
Formát: `<algo>.<region>.nicehash.com:<port>` — username = BTC adresa, password = `x`

### `DualMode`:
- Přidáno `DualMode::nicehash_url()` delegace
- Přidáno `DualMode::herominers_url()` delegace (dříve chybělo)

---

## 4. Kompletní CHv3 Revenue System (`d1a2697`) — 2.9.7

**Soubory:** `L1/pool/src/profit_switcher.rs`, `L1/pool/src/config.rs`,  
`L1/miner/src/stratum/ethstratum.rs`, `L1/miner/src/miner/dual_stream.rs`,  
`config/ch3_revenue_settings.json`

### PoolPreference enum:
```rust
pub enum PoolPreference {
    NiceHash,    // BTC payout přes NH stratum
    HeroMiners,  // default — multi-coin pool
    ZPool,       // auto-algo v rámci algoritmu, BTC výplata
    Default,     // 2miners / built-in hardcoded
}
```

Env var overrides:
- `ZION_POOL_PREFERENCE` — `nicehash | herominers | zpool | default`
- `ZION_POOL_REGION` — `eu` (default) / `na` / `hk`
- `ZION_NH_BTC_ADDR` — BTC adresa pro NiceHash stratum

### `ExternalCoin::best_pool_url(preference, region, nh_btc_addr)`:
```
nicehash  → NiceHash → HeroMiners → ZPool → default_pool_url
herominers→ HeroMiners → ZPool → default_pool_url
zpool     → ZPool → default_pool_url
default   → 2miners/built-in
```

### Pool URL upgrade (config.rs + ch3_revenue_settings.json):
| Coin | Dřív | Teď |
|------|------|-----|
| ETC | `etc.2miners.com:1010` | `de.etc.herominers.com:1150` |
| ERG | `erg.2miners.com:8888` | `de.ergo.herominers.com:1180` |
| RVN | `rvn.2miners.com:6060` | `de.ravencoin.herominers.com:1140` |
| KAS | `woolypooly.com:3112` | `de.kaspa.herominers.com:1206` |
| ALPH | `alph.2miners.com:2020` | `de.alephium.herominers.com:1220` |
| CFX | ❌ chyběl | `de.conflux.herominers.com:1170` ✨ |
| ZANO | ❌ chyběl | `de.zano.herominers.com:1110` ✨ |
| EVR | ❌ chyběl | `evrprogpow.eu.mine.zpool.ca:1330` ✨ |
| MEWC | ❌ chyběl | `meowpow.eu.mine.zpool.ca:1327` ✨ |

### ch3_revenue_settings.json v3.1.0:
- `preferred_coins`: 9 → 13 coinů: KAS/ETC/ALPH/ERG/RVN/CFX/ZANO/EVR/MEWC/FLUX/CLORE/NEXA/XMR
- `pool_preference: "herominers"` + `pool_region: "eu"` (nová pole)
- `pool_dashboards`: přepsány na HeroMiners API + ZPool pro EVR/MEWC
- Komentáře jak zapnout NiceHash mode

---

## Architektura po session (kompletní CHv3)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ProfitSwitcher (5-way parallel)                   │
│  WTM (Tier1a) + ZPool (Tier1b) + HeroMiners (Tier1c) + NiceHash (Tier1d) │
│  CoinGecko (price oracle) → enrich_prices() na všechno                   │
│  13 GPU coinů: KAS/ETC/ALPH/ERG/RVN/CFX/ZANO/EVR/MEWC/FLUX/CLORE/…     │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ coin_rx (watch channel)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     StreamScheduler (pool side)                          │
│  set_best_coin(new_coin) → broadcast_job_to_sessions(revenue_miners)    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌────────────────┐  ┌─────────────────────┐  ┌───────────────┐
│ RevenueProxy   │  │  ExternalCoin::      │  │  DualMode::   │
│ 13 live pool   │  │  best_pool_url()    │  │  best_pool_url│
│ connections    │  │  preference hier.   │  │  delegation   │
│ (vždy ready)   │  │  NH→HM→ZP→default  │  │               │
└────────────────┘  └─────────────────────┘  └───────────────┘

Pool priority (default: herominers):
  HeroMiners (7 coinů: ETC/KAS/ALPH/ERG/CFX/RVN/ZANO)
  ZPool      (4 coinů: RVN/EPIC/EVR/MEWC)
  NiceHash   (5 coinů: ETC/RVN/ERG/KAS/CFX — BTC payout)
  2miners    (fallback pro vše)
```

---

## Jak zapnout NiceHash mode

```bash
# Env var (docker/systemd)
ZION_POOL_PREFERENCE=nicehash
ZION_NH_BTC_ADDR=bc1qYOUR_BTC_ADDRESS
ZION_POOL_REGION=eu

# nebo v ch3_revenue_settings.json:
"pool_preference": "nicehash",
"nicehash_btc_addr": "bc1qYOUR_BTC_ADDRESS"
```

---

## Build status

```
cargo build --release -p zion-miner -p zion-pool
→ Finished release profile in 1m 13s ✅
→ Only: warning: unused import: `error` (pre-existing, non-blocking)
```

---

## Git log (tato session)

| Commit | Popis |
|--------|-------|
| `b70efac` | feat: HeroMiners Tier1c profit feed + herominers_url() |
| `c3dd4a8` | feat: NiceHash Tier1d + CoinGecko price oracle |
| `b3eb3c8` | feat: nicehash_url() on ExternalCoin + DualMode |
| `d1a2697` | feat(2.9.7): complete CHv3 revenue system — PoolPreference + all GPU coins |
| `fff2061` | agent: CHv3 pool preference + 11-coin GPU switcher in desktop agent |
| `e39faa7` | tests: add local_pool_stream_test.py for local pool stratum validation |

---

## 5. CHv3 implementace do Desktop Agenta (`fff2061`)

**Soubory:** `APP&WEB/desktop-agent/src/main.js`, `APP&WEB/desktop-agent/src/ui/renderer.js`, `APP&WEB/desktop-agent/src/ui/index.html`  
**Rozsah:** +204 −19 lines (3 soubory)

### main.js — backend změny:

**`GPU_COIN_POOLS`** — kompletně přepsáno (9 → 13 coinů, HeroMiners EU jako default):
| Coin | Pool | Algo |
|------|------|------|
| ETC | `de.etc.herominers.com:1150` | ethash |
| KAS | `de.kaspa.herominers.com:1206` | kheavyhash |
| ALPH | `de.alephium.herominers.com:1220` | blake3 |
| ERG | `de.ergo.herominers.com:1180` | autolykos |
| CFX | `de.conflux.herominers.com:1170` | octopus ✨ |
| RVN | `de.ravencoin.herominers.com:1140` | kawpow |
| ZANO | `de.zano.herominers.com:1110` | progpowz ✨ |
| EVR | `evrprogpow.eu.mine.zpool.ca:1330` | evrprogpow ✨ |
| MEWC | `meowpow.eu.mine.zpool.ca:1327` | meowpow ✨ |
| EPIC | `firopow.eu.mine.zpool.ca:1326` | firopow |
| FLUX | `flux.woolypooly.com:3000` | zelhash |
| CLORE | `clore.woolypooly.com:3090` | kawpow |
| XMR | `gulf.moneroocean.stream:10001` | randomx |

**`NICEHASH_COIN_POOLS`** — nový const (NiceHash stratum pro 5 coinů: ETC/RVN/ERG/KAS/CFX)

**`getBestPoolInfo(coin, preference, region, nhBtcAddr)`** — nová funkce (mirrors Rust `ExternalCoin::best_pool_url()`):
```
nicehash  → NiceHash → HeroMiners → ZPool → default
herominers→ HeroMiners → ZPool → default
zpool     → ZPool → default
default   → 2miners/built-in
```
Region switching: eu/de → na/us → hk (HeroMiners) + eu/na (ZPool) + eu/usa (NiceHash)

**`DEFAULT_REVENUE_PROFILE.gpu.coins`**: `['KAS','ETC','ALPH','ERG','RVN','CFX','ZANO','EVR','MEWC','FLUX','CLORE']` (bylo 5, teď 11)

**`normalizeRevenueProfile()`**: gpu sekce rozšířena o `poolPreference`, `poolRegion`, `nicehashBtcAddr`

**`DEFAULT_CONFIG`**: nová pole `poolPreference`, `poolRegion`, `nicehashBtcAddr`, `revenueWallet`

**`env` objektu** (miner spawn): přidány `ZION_POOL_PREFERENCE`, `ZION_POOL_REGION`, `ZION_NH_BTC_ADDR`

**`spawnGpuRevenueDirect()`**: přepsáno — volá `getBestPoolInfo()` místo hardcoded `GPU_COIN_POOLS[coin]`

### index.html — Revenue Routing UI:
- Mode pill text: `PROFIT SWITCH • KAS/ETC/ERG/RVN/CFX/ZANO/EVR/MEWC`
- `#pool-preference` select: herominers / nicehash / zpool / default
- `#pool-region` select: eu / na / hk
- `#nicehash-btc-addr` text input (BTC adresa pro NiceHash)
- `#revenue-wallet` text input (BTC výplatní adresa)
- GPU coins placeholder: `KAS,ETC,ALPH,ERG,RVN,CFX,ZANO,EVR,MEWC`

### renderer.js — UI logika:
- `DEFAULT_REVENUE_PROFILE.gpu.coins`: 11 coinů (shodné s main.js)
- `normalizeRevenueProfile()`: gpu sekce + poolPreference/poolRegion/nicehashBtcAddr
- Form **read** (save config): 4 nová pole z DOMu → `nextRevenue.gpu` + outer `config`
- Config **populate** (load config): `poolPrefEl`, `poolRegionEl`, `nhBtcEl`, `revWalletEl` z `revenue.gpu.*` / `config.*`

---

## 6. Test miner stream + pool stream (`e39faa7`)

Provedeno lokální testování obou streamů (`zion-pool` + `zion-miner` debug build).

### Build
```
cargo build -p zion-pool -p zion-miner
→ Finished dev profile in 3m 44s ✅
→ zion-pool.exe  19.3 MB  (debug)
→ zion-miner.exe 10.4 MB  (debug)
```

### Pool stream — výsledky
Spuštěno lokálně: `ZION_POOL_WALLET=zion1e2etest... zion-pool.exe`

| Test | Výsledek |
|------|----------|
| Stratum server bind `0.0.0.0:3333` | ✅ LISTENING |
| HTTP API bind `0.0.0.0:8080` | ✅ LISTENING |
| Stratum LOGIN (Python test client) | ✅ `status=OK`, session UUID, `algo=cosmic_harmony`, `diff=500000` |
| Job NOTIFY push (upstream XMR/MoneroOcean) | ✅ `ext-xmr-68875254`, `height=3619206`, `algo=randomx` |
| Upstream ETC (2miners) | ✅ Login accepted, jobs forwarded (`id=a5244..a524a`) |
| Upstream ERG (2miners) | ✅ Subscribed, jobs forwarded (`h=1731057`) |
| Upstream XMR (MoneroOcean) | ✅ CN jobs real-time (`diff=10000`) |
| Upstream KAS (WoolyPooly) | ⚠️ Auth rejected — `bc1q...` testnet wallet format |
| Upstream ALPH/FLUX/CLORE | ⚠️ DNS failure (lokální síť bez přístupu) |
| Stream TimeSplit scheduler | ✅ `Z:50% R:25% N:25%` → rotace každých 5s |
| Buyback engine | ✅ startup OK, XMR earned=0.000330 (MoneroOcean) |

### Miner stream — výsledky
Spuštěno: `zion-miner --pool stratum+tcp://127.0.0.1:3333 --wallet zion1e2etest... --threads 2 --algorithm cosmic_harmony`

| Test | Výsledek |
|------|----------|
| Připojení k lokálnímu poolu | ✅ connected |
| Job přijat | ✅ `cosmic_harmony_v3`, `job_id=initial` |
| Hashrate (debug, 2 threads) | ✅ ~4.5 kH/s |
| NCL | ✅ ENABLED, `0.5 TFLOPS`, 30% alloc |
| Shares | A:0 R:0 — pool `height=0` (bez blockchain node = diff příliš vysoká) |
| Graceful shutdown (Ctrl+C) | ✅ čisté ukončení |

### Live testnet Helsinki (`77.42.31.72:3333`) — referenční
| Test | Výsledek |
|------|----------|
| Stratum login | ✅ `height=7917`, `algo=cosmic_harmony` |
| Share flow | ✅ rejected low-diff (expected) |
| HTTP API `/stats` | ✅ `miners=1`, `height=7917`, `hashrate=3.5 MH/s` |

### Desktop agent miner (`zion-universal-miner` — běžel souběžně)
```
pool      stratum+tcp://77.42.31.72:3333 (Helsinki)
algo      cosmic_harmony_v3
hashrate  ~670 kH/s CPU (5 threads)
hashes    162M+
shares    sent=2, accepted=0, rejected=2
uptime    242s
```

### Nový test skript
[tests/local_pool_stream_test.py](tests/local_pool_stream_test.py) — automatizovaný lokální stratum test:
- Login + session UUID verifikace
- Share submit + reply
- Upstream job notify (12s timeout)
- HTTP API probe (porty 8080/8444/3334)
