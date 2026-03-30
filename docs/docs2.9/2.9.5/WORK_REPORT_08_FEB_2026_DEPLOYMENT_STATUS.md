# ZION TerraNova v2.9.5 — Status Report
**Datum:** 8. února 2026, 19:15 CET  
**Verze:** v2.9.5 L1 MainNet s CH v3 Revenue Orchestration  
**Git:** `967a36b` (Sprint 1.4: Pool Payout Integration)

---

## 🌐 Infrastruktura — 3 servery, plně nasazeno

### Přehled kontejnerů

| Server | Lokace | IP | Kontejnery | Status |
|--------|--------|-----|------------|--------|
| **Helsinki** | Finsko | `77.42.31.72` | core, pool, miner | ✅ Všechny UP |
| **USA** | Ashburn | `5.78.145.234` | core, pool, miner (+redis nativně) | ✅ Všechny UP |
| **Singapore** | Singapur | `5.223.56.124` | core, pool, redis, miner | ✅ Všechny UP |

### Docker image verze
| Image | Tag | Popis |
|-------|-----|-------|
| `zion-core` | `2.9.5-testnet` | Blockchain node s PoW, JSONRPC, P2P |
| `zion-pool` | `2.9.5-revenue` | Pool + CH v3 Revenue Orchestration (5 modulů) |
| `zion-miner` | `2.9.5` | Rust miner, lite mode (1 CPU vlákno) |
| `redis` | `7-alpine` | Share tracking, cache |

---

## ⛏️ Mining — Lite Mode (1 jádro/server)

| Server | Worker | Hashrate | Shares (Acc/Rej) | Blocks | Uptime |
|--------|--------|----------|-------------------|--------|--------|
| Helsinki | `helsinki-lite` | ~130 kH/s | 7 / 2 | 0 | ~6 min |
| USA | `usa-lite` | ~126 kH/s | 7 / 2 | 0 | ~6 min |
| Singapore | `singapore-lite` | ~154 kH/s | 7 / 2 | 0 | ~6 min |
| **Celkem** | **3 workery** | **~410 kH/s** | **21 / 6** | **0** | — |

### Poznámky k miningu
- Algoritmus: **Cosmic Harmony v3** (`cosmic_harmony_v3`)
- NCL (Neural Compute Layer): Aktivní, ale NCL server neběží → timeout (neškodný warning)
- Block target: `00000e2d` (Helsinki/USA) / `00000b57` (Singapore)
- Difficulty: ~900K–1.4M → s ~410 kH/s celkovým hashratem se blok najde statisticky za ~37–57 minut

---

## ⛓️ Blockchain

| Parametr | Hodnota |
|----------|---------|
| **Block height** | 169 |
| **Sync state** | Steady (synced) |
| **Block time** | ~60–120s (adaptivní) |
| **Difficulty** | 904,515 (height 169) |
| **Algoritmus** | Cosmic Harmony v3 |
| **Konsensus** | Proof-of-Work |
| **Mining wallet** | `zion1q893q6c5j7y0e3r062g4m7c240t5g294k7z6729` |

### Blockchain ověření
- ✅ Všechny 3 nody synchronizované na height 169
- ✅ Stejný `prev_hash` na všech nodech (`7d080000258c2db6`)
- ✅ Pool ověřuje každý share vůči block target (`🔍 Block check`)
- ✅ Payout systém aktivní — kontroluje kandidáty každých 30s
- ❌ Zatím žádný blok nalezen poolem (čekáme na první hit)

---

## 💰 CH v3 Revenue Orchestration

### Moduly (všechny aktivní na 3 serverech)

| Modul | Status | Popis |
|-------|--------|-------|
| **RevenueProxy** | ✅ Connected | Připojen k ETC 2miners (stratum+tcp://etc.2miners.com:1010) |
| **ProfitSwitcher** | ✅ Active | Monitoruje WhatToMine, aktuálně na RVN (+828% vs XMR) |
| **StreamScheduler** | ✅ TimeSplit | Hybridní ZION↔Revenue, 50/50 split, ~48% ZION actual |
| **BuybackEngine** | ✅ Monitoring | Sleduje 2miners balance (KAS, ETC, RVN) |
| **PoolExternalMiner** | ⚠️ xmrig chybí | Server-side mining nedostupný (xmrig není v containeru) |

### ProfitSwitcher — Profitabilita coinů

| Coin | Algoritmus | Score | BTC/24h | Status |
|------|-----------|-------|---------|--------|
| **RVN** | KawPow | 230.0 | 2.82e-6 | ✅ Aktivní |
| ETC | Etchash | 100.0 | 1.33e-6 | Záloha |
| XMR | RandomX | 25.0 | 8.13e-5 | Nejhorší |

> Switch: XMR → RVN s výhodou **+828%** (score 232 vs 25)

### StreamScheduler — TimeSplit

| Parametr | Hodnota |
|----------|---------|
| Mód | TimeSplit (hybridní v2) |
| ZION target | 50% |
| ZION actual | ~48% |
| Revenue coin | RVN |
| Přepnutí | ZION→RVN→ZION každých ~4–5 minut |

### BTC payout wallet
```
bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw
```

---

## 🔌 API Endpoints (port 8080)

| Endpoint | Helsinki | USA | Singapore |
|----------|----------|-----|-----------|
| `/health` | ✅ | ✅ | ✅ (localhost) |
| `/api/v1/external/stats` | ✅ | ✅ | ✅ |
| `/api/v1/profit/status` | ✅ | ✅ | ✅ |
| `/api/v1/scheduler/status` | ✅ | ✅ | ✅ |
| `/api/v1/buyback/status` | ✅ | ✅ | ✅ |

> ⚠️ Singapore: Port 8080 není otevřen ve firewallu pro externí přístup (funguje přes localhost)

---

## 📊 Pool Statistiky

| Metrika | Helsinki | USA | Singapore |
|---------|----------|-----|-----------|
| Block checks | 9 | 8 | 8 |
| Payout candidates | 3 | 0 | 0 |
| Blocks found | 0 | 0 | 0 |
| Pool fee | 1% | 1% | 1% |
| Min payout | 1.0 ZION | 1.0 ZION | 1.0 ZION |

---

## 🏗️ Architektura — Co běží

```
┌─────────────────────────────────────────────────────┐
│                    KAŽDÝ SERVER                      │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │zion-core │  │  zion-pool   │  │ zion-miner   │   │
│  │  :8444   │←→│  :3333/:8080 │←─│ 1 CPU thread │   │
│  │ PoW Node │  │ CH v3 Revenue│  │ ~130-150kH/s │   │
│  └──────────┘  └──────┬───────┘  └──────────────┘   │
│                       │                              │
│              ┌────────┴────────┐                     │
│              │   zion-redis    │                     │
│              │     :6379       │                     │
│              └─────────────────┘                     │
│                                                      │
│  Revenue Orchestration (v poolu):                    │
│  ├── RevenueProxy → ETC 2miners                     │
│  ├── ProfitSwitcher → WhatToMine API                │
│  ├── StreamScheduler → TimeSplit 50/50              │
│  └── BuybackEngine → 2miners balance monitoring     │
└─────────────────────────────────────────────────────┘
```

---

## ✅ Co funguje end-to-end

1. **Blockchain consensus** — 3 nody synchronizované, bloky se tvoří každých ~60-120s
2. **Pool Stratum** — Přijímá připojení minerů, posílá joby, validuje shares
3. **Block verification** — Každý share se ověřuje vůči block target (CosmicHarmonyV3)
4. **Revenue orchestration** — TimeSplit střídá ZION↔RVN těžbu, ProfitSwitcher monitoruje trhy
5. **Payout systém** — Aktivní, kontroluje kandidáty (čeká na první nalezený blok)
6. **Docker autorestart** — Všechny kontejnery mají `--restart unless-stopped`

## ⏳ Co čeká na první blok

- **Block reward**: 50 ZION (base) + consciousness bonus
- **Distribution**: 89% miner, 10% humanitarian tithe, 1% pool fee
- **Payout trigger**: Po dosažení min_payout (1.0 ZION)
- **Očekávaná doba do prvního bloku**: ~37–57 minut při ~410 kH/s a difficulty ~1M

## ⚠️ Známé issues (nízká priorita)

| Issue | Severity | Poznámka |
|-------|----------|----------|
| NCL timeout | 🟡 Low | NCL server neběží, miner pokračuje bez AI bonusu |
| xmrig chybí v pool containeru | 🟡 Low | Server-side external mining nefunkční |
| Singapore port 8080 firewall | 🟡 Low | API funguje přes localhost |
| USA Redis nativní vs Docker | 🟢 Info | Funguje, jen jiná architektura |
| 2 rejected shares na miner | 🟡 Low | Normální při startu (difficulty adjustment) |

---

## 🎯 Další kroky (roadmapa)

| Priorita | Úkol | Fáze |
|-----------|------|------|
| 🔴 | Počkat na první nalezený blok z poolu | L1 TestNet |
| 🔴 | Ověřit payout pipeline (block → reward → wallet) | L1 TestNet |
| 🟡 | Přidat xmrig do pool containeru pro server-side mining | L1 |
| 🟡 | Otevřít firewall port 8080 na Singapore | L1 |
| 🟢 | Git commit revenue integrace | L1 |
| 🟢 | Monitoring dashboard (Grafana) | L1.5 |
| 🟢 | P2P peer discovery mezi nody | L2 |

---

**Status: 🟢 OPERATIONAL — Všechny systémy běží, čekáme na první blok z poolu**

*ZION TerraNova v2.9.5 — "Where technology meets spirit" 🌟*
