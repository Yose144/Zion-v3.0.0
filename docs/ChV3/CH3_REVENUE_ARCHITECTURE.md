# CH v3 Revenue Architecture — 50/25/25 Model

> **ZION TerraNova v2.9.5 — Cosmic Harmony v3**  
> 5 revenue streamů ze 3 compute nákladů

---

## 🎯 Princip

Externí miner se připojí na ZION Pool (port 3333) přes standardní Stratum protokol. **Miner neví a neřeší**, co přesně těží — pool rozhoduje kam jeho hashrate směruje. Pool mu pošle job (buď ZION CosmicHarmony, nebo ext-ERG ethash, nebo ext-RVN kawpow) a miner to prostě počítá. Share se pak routuje zpátky na správný pool.

---

## 📊 Alokace compute (50/25/25)

| Skupina | Compute | Co dělá | Revenue |
|---------|---------|---------|---------|
| **ZION** | 50% | CosmicHarmony pipeline (Keccak→SHA3→Matrix→Fusion) | ZION bloky + **FREE** ETC + **FREE** NXS |
| **Revenue** | 25% | Auto-detect: GPU → profit-switch (ERG/RVN/KAS) \| CPU → XMR/RandomX (MoneroOcean) | BTC payouty z externích poolů |
| **NCL** | 25% | AI inference tasky (embeddings, LLM, image) | ZION bonus + AI compute credits |

### 5 Revenue streamů:

1. **ZION** (50% compute) — nativní L1 blockchain mining
2. **ETC/Keccak** (FREE) — byproduct Keccak fáze CosmicHarmony pipeline
3. **NXS/SHA3** (FREE) — byproduct SHA3 fáze CosmicHarmony pipeline
4. **Revenue** (25% compute) — GPU: ERG/RVN/KAS/ALPH přes externí pooly | CPU: XMR/RandomX na MoneroOcean
5. **NCL AI** (25% compute) — Neural Compute Layer inference

---

## 🔄 Celý tok — krok za krokem

### 1. Miner se připojí

```
Miner (xmrig/custom) ──Stratum TCP──→ ZION Pool :3333
                                        │
                                        └── login → SessionManager → register_miner()
```

Soubor: `pool/src/stratum.rs` (Stratum server)

### 2. StreamScheduler přiřadí minera do skupiny

```
register_miner(session_id)
  │
  ├── Spočítá aktuální poměr minerů v každé skupině
  ├── Přiřadí do skupiny s největším deficitem vůči 50/25/25
  └── Vrátí (MinerGroup, ScheduledJob) — skupinu + první job
```

Soubor: `pool/src/stream_scheduler.rs`

**Dva módy:**

| Mód | Podmínka | Jak funguje |
|-----|----------|-------------|
| **TimeSplit** | <4 mineři | VŠICHNI střídají: 50% času ZION, 25% Revenue, 25% NCL |
| **PerMiner** | ≥4 mineři | Každý miner pevně přiřazen do jedné skupiny |

### 3. Odkud přicházejí joby

#### ZION joby:
```
ZION Core RPC (port 18081)
  └── BlockTemplateManager.on_template_change()
        └── scheduler.update_zion_job(ScheduledJob)
              └── broadcast na ZION group minery
```

#### Externí joby:
```
RevenueProxyManager
  ├── Stratum klient → etc.2miners.com:1010      (ETC/ethash)
  ├── Stratum klient → erg.2miners.com:8888       (ERG/autolykos)
  ├── Stratum klient → rvn.2miners.com:6060       (RVN/kawpow)
  └── Stratum klient → gulf.moneroocean.stream    (XMR/auto-algo)
       │
       └── mining.notify → ExternalJob → broadcast
             └── scheduler.update_external_job()
                   └── broadcast na Revenue group minery
```

Soubor: `pool/src/revenue_proxy.rs`

### 4. ProfitSwitcher vybírá nejziskovější coin

```
ProfitSwitcher (běží každých ~60s)
  ├── Stáhne ceny z CoinGecko / WhatToMine
  ├── Spočítá profitabilitu: hashrate × cena / difficulty
  ├── Vybere nejlepší coin
  └── coin_rx.send("ERG") → StreamScheduler.set_best_coin()
        └── Revenue mineři dostanou nový job pro ERG
```

Soubor: `pool/src/profit_switcher.rs`

### 5. Share routing — kam jde share zpět

```
Miner odesílá share (nonce) → ZION Pool Stratum
  │
  └── stream_scheduler.route_share(job_id, nonce, worker)
        │
        ├── job_id = "ext-erg-abc123"
        │     └── strip prefix → "abc123"
        │     └── revenue_proxy.submit_share(coin="erg", job_id="abc123", nonce)
        │     └── → přepošle na erg.2miners.com jako mining.submit
        │
        ├── job_id = "ext-rvn-xyz789"
        │     └── stejný flow → rvn.2miners.com
        │
        └── job_id = "h12345-a1b2c3d4" (ZION)
              └── ShareRoute::Zion → ShareProcessor → PPLNS → ZION reward
```

Soubor: `pool/src/stream_scheduler.rs` → `route_share()`

### 6. FREE byproducty z CosmicHarmony pipeline

```
CosmicHarmony Pipeline (ZION mining):
  │
  │  Fáze 1: Keccak-256
  │  ├── Hlavní: input pro další fázi
  │  └── BONUS: Keccak hash → submit na ETC pool (ethash-kompatibilní)
  │             └── FREE revenue, žádný extra compute
  │
  │  Fáze 2: SHA3-256
  │  ├── Hlavní: input pro Golden Matrix
  │  └── BONUS: SHA3 hash → submit na Nexus pool
  │             └── FREE revenue, žádný extra compute
  │
  │  Fáze 3: Golden Matrix Transformation
  │  └── ZION-specifická matice
  │
  │  Fáze 4: Cosmic Fusion
  │  └── Finální ZION block hash
```

Soubor: `cosmic-harmony/src/pipeline.rs`, `cosmic-harmony/src/ncl_integration.rs`

### 7. BTC Revenue → 100% DAO Treasury

```
Externí pooly (2miners, MoneroOcean) vyplácí v BTC
  └── BTC wallet: bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw
        │
        └── BuybackEngine monitoruje BTC balance
              └── 100% → DAO Treasury (zion1dao...treasury)
                    ├── Development & infrastruktura
                    ├── Marketing & komunita
                    ├── ZION OASIS + Winners Golden Egg
                    ├── Liquidity provision
                    └── Humanitarian fund
```

**Žádný burn z BTC revenue.** Každý satoshi vydělaný z externího miningu
posiluje ekosystém ZION. Deflace je zajištěna pouze L1 fee burning
(transakční poplatky jsou spalovány, viz `fee.rs`).

Soubor: `pool/src/buyback.rs`, `core/src/blockchain/burn.rs`

### 8. Automatická GPU detekce — CPU-only mód

Pool při startu automaticky detekuje, jestli server má GPU:

```
detect_gpu_available()
  ├── ZION_HAS_GPU env var? → manual override
  ├── nvidia-smi? → NVIDIA GPU found
  ├── rocm-smi? → AMD GPU found
  └── žádné GPU → CPU-only mode
```

**CPU-only mode (automaticky na serverech bez GPU):**

```
ProfitSwitcher
  └── cpu_only_mode = true
        ├── Revenue 25% LOCKED to XMR (RandomX)
        ├── WhatToMine API se NEVOLÁ (šetří CPU)
        └── Miner řeší RandomX nativně (zion_core::algorithms::randomx)
             └── Žádný xmrig subprocess → šetří paměť + CPU
```

> **Poznámka k produkčnímu infra deploy (23. února 2026):**
> Samostatný serverový `docker-compose.revenue.yml` (Helsinki/Germany) je pomocný revenue stack mimo CH3 scheduler a aktuálně používá oddělené kontejnery (`dero-miner`, `zeph-miner`, `epic-miner`) se `xmrig` build/run flow. Tento dokument popisuje cílovou CH3 integrovanou architekturu v poolu.

**GPU mode (když je GPU dostupné):**

```
ProfitSwitcher
  └── cpu_only_mode = false
        ├── WhatToMine API každých 5 min
        ├── Vybere nejziskovější GPU coin (ERG/RVN/KAS)
        └── PoolExternalMiner spustí xmrig (pokud potřeba)
```

Soubor: `pool/src/profit_switcher.rs` (`detect_gpu_available()`)

---

## 🏗️ Architektura — diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       ZION Pool Server                          │
│                                                                 │
│  ┌───────────────┐    ┌────────────────────┐                    │
│  │ Stratum :3333 │◄───│ Externí Mineři     │                    │
│  │ (TCP server)  │    │ (xmrig, custom...) │                    │
│  └───────┬───────┘    └────────────────────┘                    │
│          │                                                      │
│          ▼                                                      │
│  ┌───────────────────────────────┐                              │
│  │     StreamScheduler (CH v3)   │                              │
│  │     50% / 25% / 25% model    │                              │
│  └───┬──────────┬──────────┬────┘                              │
│      │          │          │                                    │
│   50%│       25%│       25%│                                    │
│      ▼          ▼          ▼                                    │
│  ┌───────┐ ┌─────────┐ ┌───────┐                               │
│  │ ZION  │ │ Revenue │ │  NCL  │                               │
│  │ group │ │  group  │ │ group │                               │
│  └───┬───┘ └────┬────┘ └───┬───┘                               │
│      │          │          │                                    │
│      │          │          └──→ ZION joby + AI inference        │
│      │          │                                               │
│      │          └──→ RevenueProxyManager                        │
│      │                │                                          │
│      │                ├── GPU mode:                              │
│      │                │   ├── → 2miners ERG (autolykos)          │
│      │                │   ├── → 2miners RVN (kawpow)            │
│      │                │   └── → 2miners ETC (ethash)            │
│      │                │                                          │
│      │                └── CPU mode (auto-detected):              │
│      │                    └── → MoneroOcean XMR (RandomX)      │
│      │                         │                                │
│      │                         └── Miner řeší RandomX nativně   │
│      │                              (zion_core, NO xmrig)       │
│      │                                                          │
│      │                         BTC payout → BuybackEngine       │
│      │                            └── 100% DAO Treasury           │
│      │                                                          │
│      └──→ ZION Core RPC → CosmicHarmony bloky                   │
│            ├── FREE: Keccak intermediate → ETC pool             │
│            └── FREE: SHA3 intermediate → Nexus pool             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Klíčové soubory

| Soubor | Účel |
|--------|------|
| `pool/src/main.rs` | Entry point — spouští vše, API endpointy |
| `pool/src/stream_scheduler.rs` | **Jádro 50/25/25** — přiřazení minerů, time-split, routing |
| `pool/src/revenue_proxy.rs` | Stratum klienty k externím poolům, příjem jobů |
| `pool/src/pool_external_miner.rs` | Server-side xmrig subprocess (MoneroOcean) |
| `pool/src/profit_switcher.rs` | Auto-switch na nejziskovější coin |
| `pool/src/buyback.rs` | BTC revenue monitoring → 100% DAO treasury |
| `pool/src/config.rs` | Konfigurace všech streamů, defaulty 50/25/25 |
| `config/ch3_revenue_settings.json` | JSON config pro produkci |
| `cosmic-harmony/src/ncl_integration.rs` | NCL AI vrstva, consciousness levels |
| `cosmic-harmony/src/config.rs` | Kanonické alokace (0.50/0.25/0.25) |

---

## ⚙️ Konfigurace

### config/ch3_revenue_settings.json

```json
{
  "streams": {
    "zion": { "target_share": 0.50 },
    "etc":  { "enabled": true, "target_share": 0.05 },
    "nxs":  { "enabled": false },
    "dynamic_gpu": {
      "enabled": true,
      "target_share": 0.20,
      "pools": [
        { "coin": "ERG", "pool": "erg.2miners.com:8888" },
        { "coin": "RVN", "pool": "rvn.2miners.com:6060" },
        { "coin": "XMR", "pool": "gulf.moneroocean.stream:10001" }
      ]
    },
    "ncl": { "enabled": true, "target_share": 0.25 }
  }
}
```

### Environment proměnné

| Proměnná | Default | Popis |
|----------|---------|-------|
| `ZION_REVENUE_CONFIG` | `config/ch3_revenue_settings.json` | Cesta ke config souboru |
| `ZION_CORE_RPC` | `http://127.0.0.1:18081/jsonrpc` | ZION Core RPC endpoint |
| `ZION_HAS_GPU` | auto-detect | `1`/`true` = GPU mode, `0`/`false` = CPU-only (XMR locked) |
| `POOL_HOST` | `0.0.0.0` | Stratum bind adresa |
| `POOL_PORT` | `3333` | Stratum port |

---

## 🔌 API Endpointy (CH v3)

| Endpoint | Popis |
|----------|-------|
| `GET /api/v1/scheduler/status` | Stav StreamScheduleru (50/25/25 alokace, módy, mineři) |
| `GET /api/v1/external/stats` | Statistiky externího miningu a RevenueProxy |
| `GET /api/v1/profit/status` | Stav profit switchingu (aktuální coin, profitabilita) |
| `GET /api/v1/profit/switch/:coin` | Ruční přepnutí na konkrétní coin |
| `GET /api/v1/buyback/status` | Stav BTC buyback engine |

---

## 🧠 FAQ

**Q: Miner musí něco speciálního nastavit?**  
A: Ne. Připojí se na `pool:3333` jako na jakýkoliv jiný pool. Pool rozhoduje o jobech.

**Q: Co když je málo minerů?**  
A: TimeSplit mód — všichni se střídají v čase (50/25/25 poměr).

**Q: Co když miner neumí ethash/kawpow?**  
A: Pool automaticky detekuje, zda server má GPU. Pokud ne (CPU-only mode), Revenue 25% se zamkne na XMR/RandomX — miner řeší hashe nativně bez xmrig. Přepsání: `ZION_HAS_GPU=1`.

**Q: Proč ne xmrig na serveru?**  
A: xmrig subprocess brzdil server (paměť, CPU, I/O). V CH3 miner řeší RandomX přímo ve svém procesu přes `zion_core::algorithms::randomx` — efektivnější a jednodušší.

**Q: Kde končí BTC z externích poolů?**  
A: 2miners/MoneroOcean vyplácí BTC → BuybackEngine → 100% DAO Treasury (development, infrastruktura, OASIS, marketing, humanitarian fund). Žádný burn z BTC revenue — deflace je zajištěna pouze L1 fee burning.

**Q: Co je NCL group?**  
A: Mineři v NCL skupině primárně dostávají ZION joby. Když přijde AI inference task (embeddings, LLM), přepnou se na něj. AI vrstva využívá NPU (CoreML/TensorRT/ONNX).

---

*Poslední aktualizace: 9. února 2026*  
*CH3 CPU-only mode: GPU auto-detect, Revenue 25% → XMR/RandomX (MoneroOcean)*
