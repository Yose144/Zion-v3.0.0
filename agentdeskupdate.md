# Desktop Agent — Triple Stream Integration Update

**Datum:** 2026-07-19
**Autor:** Devin (GLM-5.2 High)
**Verze agenta:** 3.0.5 → 3.0.6 "Triple Parallel" (aligned with Edge protocol)
**Stav:** Implementováno + build ověřen · Edge redeploy pending

---

## Co bylo uděláno

Kompletní integrace **DeekshaChv3 Triple Stream** architektury do desktop agenta.
Agent dnes umí paralelně těžit ZION (GPU) + externí GPU coin (Stream 2) + externí CPU coin (Stream 3) současně, vizualizovat per-stream telemetrii a nechat uživatele vybrat coiny.

### Problém (před změnami)

- Agent verze 3.0.5 byl výrazně pozadu za V3 minerem (3.0.6)
- `ZION_ENABLE_STREAM_SWITCH: '0'` — triple stream explicitně vypnutý
- Nepředával `--algorithm`, `--cpu-coin`, `--gpu-coin` CLI flagy
- UI nabízelo jen 3 ZION algoritmy, žádné externí coiny
- Žádná per-stream vizualizace (jen jedno `active-algo` pole)
- Miner Rust strana neměla per-stream telemetrii v stats file / HTTP `/stats` (jen v TUI ASCII boxu)

---

## Změny

### 1. Rust miner (`V3/L1/miner/src/main.rs`)

**Nový serializovatelný struct `StreamStatsInfo`** — mirror `ui::StreamStats` s `#[derive(serde::Serialize)]`:
```rust
struct StreamStatsInfo {
    index: u8,           // 1=ZION, 2=GPU ext, 3=CPU ext
    label: String,       // "ZION", "GPU PROFIT", "CPU PROFIT"
    coin: String,        // "ZION", "KAS", "VRSC", ...
    algorithm: String,   // "deeksha_lite_v1", "verushash", ...
    hashrate_10s: f64,
    hashrate_60s: f64,
    hashrate_15m: f64,
    accepted: u64,
    rejected: u64,
    active: bool,
}
```

**`MinerMetricsSnapshot`** — přidáno pole `streams: Vec<StreamStatsInfo>`:
- Inicializace v `from_config()` jako prázdný vec
- Nová metoda `set_streams(&mut self, stats: &[ui::StreamStats])` — konvertuje z `HashrateTracker::build_stream_stats()`

**Expozice telemetrie (3 cesty):**
- `write_stats_file()` — `"streams": snapshot.streams` do JSON souboru (agent polling)
- `build_miner_stats_payload()` — `"streams": snapshot.streams` do HTTP `/stats` endpointu
- `maybe_print_status()` — volá `snapshot.set_streams(stream_stats)` před zápisem stats souboru

**Bug fix (pre-existing, blocking build):** `JobPackage` v main.rs:4158 — přidáno chybějící pole `share_target_bytes: target_bytes` (necommittednuté AuXpow změny přidaly field do structu, ale usage nebyl updatenut → `cargo check` fail).

### 2. Agent main.js (`APP&WEB/desktop-agent/src/main.js`)

**DEFAULT_CONFIG** — nová pole:
```js
cpuCoin: 'auto',      // Stream 3 CPU coin: "auto"|"VRSC"|"XMR"|"RTM"
gpuCoin: 'auto',      // Stream 2 GPU coin: "auto"|"KAS"|"ALPH"|...
tripleStream: true,   // master toggle
```

**Spawn args** (`startMiningV3`, main.js:2166-2193):
- `--algorithm <algo>` — z UI selectu (přes `normalizeAlgorithmName`)
- `--cpu-coin <coin>` — pokud není "auto"
- `--gpu-coin <coin>` — pokud není "auto" a GPU je zapnuté

**Env vars:**
- `ZION_ENABLE_STREAM_SWITCH` — `'1'` když tripleStream je zapnutý (dříve natvrdo `'0'`)
- `ZION_MINER_CPU_COIN` / `ZION_MINER_GPU_COIN` — forward přes env pro autonomous profit router a `CoinPreference` message

**Telemetrie čtení:**
- `minerStats.streams` — nové pole v globálním stats objektu (main.js:644-649)
- HTTP `/stats` polling (main.js:5850-5866) — mapuje `stats.streams` do `minerStats.streams`
- `tryUpdateStatsFromFile()` (main.js:2569-2586) — fallback čtení `streams` ze stats souboru
- `resetMinerTelemetryForNewSpawn()` — resetuje `streams` na `[]`
- `composeStatsPayload()` — automaticky forwarduje `streams` do rendereru (přes spread `...minerStats`)

### 3. Agent UI (`APP&WEB/desktop-agent/src/ui/index.html`)

**Dashboard Quick Controls** (index.html:4015-4034) — 2 nové selecty vedle algo selectu:
- `gpu-coin-select-dashboard` — 12 GPU coinů: Auto, KAS, ALPH, DCR, ERG, ETC, RVN, CLORE, MEWC, EVR, FLUX, EPIC
- `cpu-coin-select-dashboard` — 4 CPU coiny: Auto, VRSC, XMR, RTM

**Triple Stream Panel** (index.html:4123-4176) — nová sekce pod stats gridem:
- 3 stream karty (Stream 1 ZION / Stream 2 GPU Profit / Stream 3 CPU Profit)
- Každá karta: coin badge, hashrate, algoritmus, shares (accepted/rejected), status (active/inactive/skipped)
- Status pill v headeru: "Idle" / "Single Stream" / "N/3 active"

**Settings → Performance** (index.html:5260-5307) — nová "Triple Stream" settings card:
- GPU coin select s algoritmus popisky (KAS — kheavyhash, ALPH — blake3, ...)
- CPU coin select
- Triple Stream toggle checkbox

**CSS** (index.html:1085-1198) — kompletní stylování:
- Barvy per stream: zelená/ZION, indigo/GPU, amber/CPU
- Active/inactive/skipped stavy
- Responsive (1 sloupec pod 900px)

### 4. Agent renderer.js (`APP&WEB/desktop-agent/src/ui/renderer.js`)

**Coin select binding** (renderer.js:833-861):
- `syncCoinSelect()` helper — binduje select na `config[key]` + mirror do druhého selectu
- Bind pro `gpuCoin`, `cpuCoin` (dashboard ↔ settings obousměrně)
- Bind pro `tripleStream` checkbox

**`updateTripleStreamPanel(stats)`** (renderer.js:2823-2915) — nová render funkce:
- Čte `stats.streams` pole
- Renderuje per-stream hashrate (preferuje 10s window, fallback 60s), coin, algoritmus, shares
- Active/inactive/skipped styling (skipped = coin je přiřazen ale stream není aktivní, např. DAG-based algo na Metal)
- Status pill v headeru panelu

**`buildStatsSignature()`** (renderer.js:1864-1891) — přidán streams signature:
```js
const streamsSig = stats.streams.map(s =>
  `${s.index}:${s.coin}:${s.algorithm}:${s.hashrate_10s}:${s.hashrate_60s}:${s.accepted}:${s.rejected}:${s.active ? 1 : 0}`
).join(',');
```
aby se UI aktualizovalo při změně per-stream dat (nejen agregátních).

---

## Podporované coiny

### Stream 2 — GPU external (12 coinů)
| Coin | Algoritmus | Poznámka |
|------|-----------|----------|
| Auto | (pool profit router) | WhatToMine API, 120s interval, 15% hysterese |
| KAS | kheavyhash | Kaspa |
| ALPH | blake3 | Alephium |
| DCR | blake3 | Decred |
| ERG | autolykos | Ergo |
| ETC | ethash | Ethereum Classic |
| RVN | kawpow | Ravencoin |
| CLORE | kawpow | Clore.ai |
| MEWC | kawpow | MeowCoin |
| EVR | kawpow | Evrmore |
| FLUX | zelhash | Flux (deprecated, viz StatusV3) |
| EPIC | progpow | Epic Cash |

### Stream 3 — CPU external (4 coiny)
| Coin | Algoritmus | Poznámka |
|------|-----------|----------|
| Auto | (pool profit router) | |
| VRSC | verushash | Verus Coin (LuckPool EU) |
| XMR | randomx | Monero |
| RTM | ghosstrider | Raptoreum |

---

## Datový tok (architektura)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  V3 Miner       │────▶│  Stats File      │────▶│  Agent main.js  │
│  (Rust)         │     │  /tmp/zion-stats │     │  tryUpdateStats │
│                 │     │  .json           │     │  FromFile()     │
│  HashrateTracker│     └──────────────────┘     └────────┬────────┘
│  .build_stream_ │                                       │
│  stats()        │     ┌──────────────────┐              │
│       │         │────▶│  HTTP /stats     │────▶─────────┤
│       ▼         │     │  127.0.0.1:9116  │              │
│  MinerMetrics   │     └──────────────────┘              ▼
│  Snapshot       │                              ┌─────────────────┐
│  .streams       │                              │  minerStats     │
│  :Vec<Stream    │                              │  .streams       │
│  StatsInfo>     │                              │  :Array         │
└─────────────────┘                              └────────┬────────┘
                                                          │ composeStatsPayload()
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  Renderer       │
                                                 │  updateTriple   │
                                                 │  StreamPanel()  │
                                                 │  → 3 karty      │
                                                 └─────────────────┘
```

---

## Ověření

| Check | Výsledek |
|-------|----------|
| `cargo check -p zion-miner` | ✅ Finished (jen pre-existing warnings) |
| `cargo test -p zion-miner` | ✅ 37 passed, 7 pre-existing failures (env test lock PoisonError — ne moje) |
| `node --check src/main.js` | ✅ OK |
| `node --check src/ui/renderer.js` | ✅ OK |
| HTML struktura | ✅ 3 stream karty, 18 stream IDs, 4 coin selecty |
| Pool protokol | ✅ "accept any algorithm the miner advertises" (dual-algo support, server.rs:2230) |

---

## Co zbyvá (next steps)

### Edge redeploy (kritické)
Miner binárka na Edge serveru (`/opt/zion/V3/target/release/zion-miner`) musí být přestavena s novým `streams` telemetrií, aby agent viděl per-stream data při připojení k poolu.

```bash
# Na Edge serveru:
cd /opt/zion
git pull
cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features full
sudo systemctl restart zion-edge-miner
```

### Agent build (pro distribuci)
```bash
cd APP&WEB/desktop-agent
npm run prepare:rust-miner   # buildí V3 miner s GPU featurami
npm run build                # electron-builder (mac/win/linux)
```

### Public repo sync
`public/V3/L1/miner/src/main.rs` by se měl syncnout s `V3/L1/miner/src/main.rs` pokud je `streams` telemetrie relevantní pro veřejné vydání (ano — komunitní mineri také chtějí per-stream data).

```bash
# Sync do public repa
cp V3/L1/miner/src/main.rs public/V3/L1/miner/src/main.rs
git subtree push --prefix=public public main
```

### Bump agent version
`package.json` verze 3.0.5 → 3.0.6 s popisem "Triple Parallel" pro konzistenci s Edge protokolem.

---

## Soubory změněné v tomto update

| Soubor | Změna |
|--------|-------|
| `V3/L1/miner/src/main.rs` | +`StreamStatsInfo` struct, +`streams` pole v `MinerMetricsSnapshot`, +`set_streams()`, exponováno v stats file + HTTP /stats, bug fix `share_target_bytes` |
| `APP&WEB/desktop-agent/src/main.js` | +`cpuCoin`/`gpuCoin`/`tripleStream` v DEFAULT_CONFIG, +CLI flagy `--algorithm`/`--cpu-coin`/`--gpu-coin`, `ZION_ENABLE_STREAM_SWITCH=1`, čtení `streams` z /stats + stats file |
| `APP&WEB/desktop-agent/src/ui/index.html` | +2 coin selecty v dashboardu, +Triple Stream Panel (3 karty), +Triple Stream settings card, +CSS |
| `APP&WEB/desktop-agent/src/ui/renderer.js` | +`updateTripleStreamPanel()`, +coin select binding, +streams v `buildStatsSignature()` |
| `agentdeskupdate.md` | tento dokument |

---

*Generated with [Devin](https://devin.ai)*
