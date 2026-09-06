# ⚠️ SUPERSEDED — Tento soubor byl nahrazen

> **Tento soubor je zastaralý quick draft ze session 2026-03-01.**
>
> Aktuální whitepapery jsou:
> - [`WHITEPAPER_v3.0_TECHNICAL.md`](WHITEPAPER_v3.0_TECHNICAL.md) — technická verze pro CoinGecko/vývojáře
> - [`WHITEPAPER_v3.0_LAYMAN.md`](WHITEPAPER_v3.0_LAYMAN.md) — laická verze pro veřejnost
>
> Tento soubor je zachován pouze pro archivní účely.

---

# ZION TerraNova v3.0 "MainNet Genesis"
## Whitepaper — DRAFT (SUPERSEDED)

**Verze:** 3.0 DRAFT ARCHIV | **Datum:** Březen 2026 | **Status:** ❌ ZASTARALÝ  
**Autoři:** ZION Core Team | **Jazyk:** CS/EN bilingual summary (CS primární)

---

> *"Nestavili jsme banku. Postavili jsme most."*  
> — ZION Genesis Message, 2026

---

## Obsah

1. [Executive Summary](#1-executive-summary)
2. [Vize a Mise](#2-vize-a-mise)
3. [Architektura — L1 až L4](#3-architektura--l1-až-l4)
4. [L1 — Core Blockchain](#4-l1--core-blockchain)
5. [L2 — DeFi Bridge & wZION](#5-l2--defi-bridge--wzion)
6. [L3 — Intelligence Layer](#6-l3--intelligence-layer)
7. [L4 — OASIS](#7-l4--oasis)
8. [Tokenomika](#8-tokenomika)
9. [Bezpečnost](#9-bezpečnost)
10. [Governance a DAO](#10-governance-a-dao)
11. [Roadmapa: cesta k v3.0](#11-roadmapa-cesta-k-v30)
12. [Právní rámec](#12-právní-rámec)
13. [Závěr](#13-závěr)

---

## 1. Executive Summary

**ZION TerraNova** je open-source Layer 1 blockchain s vícevrstvou architekturou (L1–L4), psaný v Rustu, s cílem vytvořit decentralizovanou infrastrukturu sloužící lidem — ne bankám, ne spekulantům, ne korporacím.

**Klíčové vlastnosti:**

| Vlastnost | Hodnota |
|-----------|---------|
| Konsensus | Proof of Useful Work (PoUW) + CosmicHarmony v3 |
| Jazyk | Rust (L1–L3), Solidity (L2 bridge), TypeScript (UI) |
| Emise | 5 400,067 ZION/blok · ~45 let · bez halvingu |
| Celková nabídka | 144 000 000 000 ZION |
| Block time | 60 sekund |
| Fair Launch | ✅ Žádné presale, žádné ICO |
| Open Source | ✅ MIT License |
| L2 Bridge | wZION na Base / Arbitrum / BNB Chain |
| L3 AI | Neural Compute Layer (NCL) + WARP Engine |

**Versioning:** TestNet (v2.9.x) → Bug-fix kola (v2.9.8, v2.9.9) → **MainNet Genesis (v3.0)**

---

## 2. Vize a Mise

### 2.1 Proč ZION existuje

Současný kryptografický svět trpí systémovými problémy:

- **ASIC dominance** → centralizace těžby do korporátních farem
- **Presale/ICO model** → early investors profitují, komunita platí
- **Pure financialization** → žádný skutečný užitek, žádný dopad
- **VC dependency** → projekty slouží investorům, ne uživatelům

ZION byl navržen jako odpověď: technologie, která **slouží lidem**.

### 2.2 Základní principy

1. **Fair Launch** — Žádné presale, žádné VC, žádné team vesting cliffs skryté v kódu. Vše je těženo nebo transparentně přiděleno.
2. **Proof of Useful Work** — Těžba generuje nejen bezpečnost sítě, ale i reálnou compute hodnotu (NCL AI tasks).
3. **Vrstvená architektura** — L1 bezpečnost + L2 DeFi likvidita + L3 AI intelligence + L4 consciousness gaming.
4. **Humanitarian Tithe** — 8,8 % preminingu (1,44B ZION) je permanentně vyhrazeno na humanitární projekty.

### 2.3 Mise

> Vytvořit decentralizovanou infrastrukturu, kde **práce má hodnotu**, **vědomí má cenu** a **technologie slouží evoluci**.

---

## 3. Architektura — L1 až L4

```
┌─────────────────────────────────────────────────────────┐
│  L4 — OASIS           Consciousness Gaming + XP Economy  │
├─────────────────────────────────────────────────────────┤
│  L3 — Intelligence    AI Native · NCL · WARP Engine      │
├─────────────────────────────────────────────────────────┤
│  L2 — DeFi Bridge     wZION · Base · Arbitrum · BSC      │
├─────────────────────────────────────────────────────────┤
│  L1 — Core Chain      PoUW · CHv3 · LMDB · Stratum v2   │
└─────────────────────────────────────────────────────────┘
              ZION TerraNova v3.0 — vrstvená architektura
```

Každá vrstva je **nezávisle funkční** a přidává hodnotu bez závislosti na vyšší vrstvě. L1 může běžet bez L4; L3 bez L2.

---

## 4. L1 — Core Blockchain

### 4.1 CosmicHarmony v3 (CHv3)

**CosmicHarmony v3** je ZION-nativní Proof-of-Work algoritmus navržený s důrazem na:

- **ASIC resistenci** — memory-hard scratchpad 512 KiB, dynamická XOR maska, rotující selektor funkce
- **CPU přívětivost** — optimalizovaný pro moderní CPU s AES-NI instrukcemi
- **GPU kompatibilitu** — efektivní paralelizace, OpenCL/CUDA podpora
- **Odolnost vůči specializovanému HW** — fork mechanismus při detekci centralizace (trigger @ height 100 000)

**Technické parametry CHv3:**

```
Scratchpad:     512 KiB (4 fáze, 256 iterací)
Haraka hash:    512-bit, AES-NI accelerated
XOR maska:      dynamická, odvozená z block headeru
Fúzní kolo:     ARX (Add-Rotate-XOR) + Haraka kombinace
Výstup:         256-bit PoW hash
```

**Testovaná výkonnost:**
- Intel i9 (CPU): ~2 MH/s single
- AMD Ryzen 9: ~1.8 MH/s single
- Pool (Helsinki testnet): ~1.9 MH/s stabilně po 7+ dní

### 4.2 Proof of Useful Work (PoUW)

PoUW je CHv4 rozšíření (implementované jako Phase B), kde mining přináší **dvojí hodnotu**:

1. **Bezpečnost sítě** — standardní PoW consensus
2. **Compute provoz** — těžaři zpracovávají zadání z Neural Compute Layer (NCL)

Architektura PoUW:

```
Těžař obdrží mining job ze Stratum v2 serveru.
Job obsahuje:
  - block header pro standard PoW nonce hledání
  - NCL task payload (AI inference / matrix op / data validation)

Důkaz práce = HASH(block_header || ncl_result || nonce)

Validace obou částí je povinná.
Blok bez validního NCL výsledku je odmítnut.
```

Benefit pro těžaře: NCL odměna navíc k block rewardu.  
Benefit pro síť: distribuovaná AI compute infrastruktura.

### 4.3 Konsensus a DAA

| Parametr | Hodnota |
|----------|---------|
| Algoritmus | CosmicHarmony v3 |
| Block time target | 60 sekund |
| DAA typ | LWMA (Linear Weighted Moving Average) |
| DAA okno | 60 bloků (~60 minut) |
| Max. změna difficulty | 25% per okno |
| Min. difficulty | 1 000 |
| Soft finálnost | 60 bloků |
| Max. reorg depth | 10 bloků |
| Coinbase maturita | 100 bloků |

**LWMA** (Digishield variant) byl zvolen pro odolnost vůči difficulty bomb útokům a smooth adaptaci při skokových změnách hashrate.

### 4.4 Technický stack L1

```
L1/core/
├── src/blockchain/     Block processing, validation, consensus
├── src/tx/             Transakce, UTXO model, memo field
├── src/p2p/            Gossip protokol, peer management
├── src/jsonrpc/        JSON-RPC 2.0 API (Axum)
├── src/mempool/        Mempool, fee policy (burn model)
├── src/storage/        LMDB persistence
└── src/premine.rs      Premine time-lock (DAO_TREASURY_LOCK_HEIGHT)

L1/pool/
├── src/stratum/        Stratum v2 server
├── src/revenue_proxy.rs  Multi-coin revenue stream (ETC/ERG/RVN/XMR/VRSC)
├── src/stream_scheduler.rs  50/25/25 ZION/Revenue/NCL split
└── src/profit_switcher.rs   WhatToMine API, GPU detection

L1/miner/              CPU + GPU miner (Rayon + CUDA/OpenCL)
L1/cosmic-harmony/     CHv3 algoritmus (Rust + C pro AES-NI)
L1/native-libs/        Low-level optimizations
```

**Statistiky kódu (v2.9.7):**
- Celkem Rust: ~45 000+ LOC
- Unit testy: 267 (zion-core) + 95 (zion-bridge) + 54 (zion-pool)
- Nul compile errors na main branch

---

## 5. L2 — DeFi Bridge & wZION

### 5.1 Co je wZION

**wZION** (Wrapped ZION) je ERC-20 token na EVM řetězcích, přesně zrcadlící L1 hodnotu:

```
1 wZION = 1 ZION uzamčene na L1 bridge adrese
```

Decimálový přepočet:
```
L1:  1 ZION = 1 000 000 atomických jednotek (6 decimálů)
EVM: 1 wZION = 1 × 10^18 wei              (18 decimálů)
```

Smart kontrakty:
- `wZION.sol` — ERC-20 + ERC-2612 Permit, AccessControl, Pausable
- `ZIONBridge.sol` — Lock/Mint + Burn/Release mechanismus, multisig guardian

### 5.2 Jak bridge funguje

```
ZION L1 ──lock──► Bridge Lock Addr ──event──► Relay Daemon
                                                    │
                                              Validátoři (2/3 multisig)
                                                    │
                                              EVM Chain (mint)
                                                    ▼
                                              wZION na Base/Arbitrum/BSC
```

Obrácená cesta (wZION → ZION):

```
Uživatel burní wZION na EVM ──event──► Relay Daemon
                                             │
                                       Validátoři
                                             │
                                       L1 release TX
                                             ▼
                                       ZION na L1 adresu
```

### 5.3 Podporované EVM řetězce

| Řetězec | Chain ID | Priorita | Status |
|---------|----------|----------|--------|
| Base | 8453 | 1. (Uniswap v3, nízké poplatky) | ✅ TestNet live |
| Arbitrum | 42161 | 2. (Uniswap v3, micro-fees) | 🔧 Mainnet deploy |
| BNB Chain | 56 | 3. (PancakeSwap, retail) | 🔧 Mainnet deploy |
| Polygon | 137 | 4. (QuickSwap, ekosystém) | 📋 Planned |

### 5.4 Bezpečnostní parametry bridge

| Parametr | Hodnota |
|----------|---------|
| Min. bridge | 100 wZION |
| Max. single TX | 5 000 000 wZION |
| Daily limit | 10 000 000 wZION |
| Timelock threshold | 1 000 000 wZION (→ 24h delay) |
| Validator threshold | 2/3 multisig (mainnet: 3/5) |
| Auto-pause | Ano, při anomálii |
| Finalizace L1 | 60 bloků (~60 minut) |
| Finalizace EVM | 12 bloků Base, 10 bloků ARB |

### 5.5 RPC infrastruktura

Bridge využívá **Ankr Premium RPC** (API klíč nakonfigurován) pro:
- Spolehlivý přístup k EVM node-ům bez rate limit problémů
- Fallback na public endpoints při nedostupnosti
- Monitoring přes Prometheus metriky

---

## 6. L3 — Intelligence Layer

### 6.1 Neural Compute Layer (NCL)

NCL umožňuje těžařům zpracovávat **smysluplné výpočetní úlohy** jako součást PoUW:

- AI inference (malé modely, 1-7B parametrů)
- Matrix operace pro výzkumné výpočty  
- Validace dat pro L2 bridge eventy
- Distribuované zpracování datasetu

**Princip odměňování:**
```
Block reward = BASE_REWARD + NCL_BONUS × (ncl_tasks_completed / ncl_difficulty)
```

Těžař, který zpracuje více NCL tasků, dostane vyšší skutečnou odměnu. Síť tak přirozeně motivuje k upgradu HW.

### 6.2 AI Native

**AI Native** je L3 subsystém pro self-learning AI:
- Trénink z konverzací a interakcí komunity
- Lokální inference (Ollama + ChromaDB)
- Privacy-preserving — data zůstávají distribuovaná

### 6.3 WARP Engine

**WARP** (Wide-Area RPC Protocol) poskytuje:
- Multichainový RPC přístup k 23 blockchainům
- Unified API pro cross-chain queries
- Používán bridges a DeFi vrstvou

RPC backend: Ankr ($299/měsíc premium, pokrývá 23 mainnet chainů).

---

## 7. L4 — OASIS

**OASIS** (Open Autonomous Spiritual Intelligence System) je consciousness gaming vrstva:

- 9 úrovní vědomí s XP systémem
- NFT certifikáty za milníky
- Humanitární gamifikace (donace = XP)
- Golden Egg reward pool (4,95B ZION vyhrazeno; Slots 4 & 5 repurposed to L5 Free World Projects — 3.3B ZION)

OASIS je navržen jako **opt-in** — síť funguje plně bez L4. OASIS přidává engagement vrstvu pro komunitu.

---

## 8. Tokenomika

### 8.1 Celková nabídka

```
Total supply:    144 000 000 000 ZION  (144 miliard)
  ├── Mining supply:  127 720 000 000 ZION  (88.7%)
  └── Premine:         16 280 000 000 ZION  (11.3%)
```

### 8.2 Emise

| Parametr | Hodnota |
|----------|---------|
| Block reward | 5 400,067 ZION / blok |
| Block time | 60 sekund |
| Mining period | ~45 let (~23 652 000 bloků) |
| Halving | **Žádný** — konstantní emise |
| Fee policy | **Burn** — poplatky jsou spalovány |

Konstantní emise bez halvingu byl záměrný design choice: předvídatelná inflace, stabilní incentiv pro těžaře, žádné supply shock události.

### 8.3 Premine — detailní rozdělení

| Kategorie | ZION | % z preminingu | Použití |
|-----------|------|----------------|---------|
| OASIS Golden Egg | 8 250 000 000 | 50,7% | Reward pool pro L4 winners + XP holdery |
| DAO Treasury | 4 000 000 000 | 24,6% | Governance fund (time-locked 525 600 bloků = 1 rok) |
| Infrastructure | 2 590 000 000 | 15,9% | Servery, vývoj, ops |
| Humanitarian | 1 440 000 000 | 8,8% | Permanentní humanitární fond |

**Time-lock:** DAO Treasury je uzamčen na bloky 0–525 600 (`DAO_TREASURY_LOCK_HEIGHT`). Jakýkoliv pokus o transfer před dosažením výšky je odmítnut on-chain v `premine.rs::is_transfer_allowed()`.

### 8.4 Cirkulační nabídka — Year 1

```
Rok 1 po spuštění mainnetu (525 600 bloků, ~12 měsíců):
  Mining output:  ~2 840 M ZION (524 K bloků × 5 400)
  Premine unlock: 0 (DAO locked), ostatní ihned
  Celkem v oběhu: ~14 570 M ZION (10,1% z total supply)
```

### 8.5 Fee model

Všechny transakční poplatky sono **spáleny** (fee_policy = "burn"). Nemíří na těžaře ani DAO — jdou permanentně mimo oběh.  
Důsledek: mírný defláční tlak na čím dál větší cirkling supply.

---

## 9. Bezpečnost

### 9.1 Algoritmus — ASIC ochrana

CHv3 obsahuje fork mechanismus aktivovaný při detekci centralizace hashrate (threshold nastavitelný governance). Při forknutí se změní parametry scratchpadu, čímž se stávající ASICs znehodnotí.

### 9.2 Konsensus bezpečnost

- **Max. reorg depth 10 bloků** — ochrana před long-range útoky
- **Soft finálnost 60 bloků** — blok je ekonomicky finální po ~60 minutách
- **Peer banning** — automatický ban při detekci neplatných bloků (ban_duration_secs = 3600)
- **Rate limiting** — max. 100 zpráv/s per peer

### 9.3 Premine bezpečnost

- DAO Treasury time-lock: on-chain enforcement v `premine.rs`
- Premine adresy publikovány v `PREMINE_ADDRESSES_PUBLIC.txt` před genesis
- Genesis ceremonie: offline generování klíčů, 2-party nezávislé ověření
- Ceremonie postup: `docs/2.9.7/GENESIS_CEREMONY.md`

### 9.4 Bridge bezpečnost

- Multisig validátorský set (testnet 2/2, mainnet 3/5)
- Auto-pause při anomálii (`auto_pause_on_anomaly = true`)
- Timelock pro velké TX (threshold 1M wZION → 24h delay)
- Daily bridge limit 10M wZION

### 9.5 CHv4 fáze (implementovány, aktivovány na mainnet)

| Fáze | Popis | Status |
|------|-------|--------|
| Phase A | NPU mixing — výpočetní diversifikace | ✅ Implementováno |
| Phase B | NCL PoUW — dual-work mining | ✅ Implementováno |
| Phase C | ZK-Shark | ❌ Záměrně přeskočeno (prove time 1–30s/share = fatal) |

---

## 10. Governance a DAO

### 10.1 Přechodné období (Year 0–1)

V prvním roce po spuštění mainnetu (525 600 bloků) spravuje síť **Core Team**:
- Technické rozhodnutí (hard forky, parametry)
- DAO Treasury uzamčen (žádné výdaje)
- Communit zapojení prostřednictvím Discord + GitHub Issues

### 10.2 DAO aktivace (Year 1+)

Po dosažení výšky 525 600 bloků DAO Treasury se odemkne a spustí se:
- **On-chain hlasování** — token-weighted (1 ZION = 1 hlas)
- **Proposal systém** — min. 1M ZION stake pro vytvoření návrhu
- **Execution timelock** — 7 dní mezi schválením a provedením
- **Guardian multisig** — 3/5 Core Team override pro bezpečnostní incidenty

### 10.3 Decentralizace roadmapa

```
Year 0-1:   Core Team správa (DAO treasury locked)
Year 1-2:   Hybrid — DAO hlasuje, Core Team veto
Year 2-5:   DAO primární — Core Team minority guardian
Year 5+:    Plná decentralizace — Core Team = community member
```

Cíl: 20-letý transparentní přechod k plné decentralizaci.

---

## 11. Roadmapa: cesta k v3.0

### Versioning filozofie

```
v2.9.x = TestNet / Staging (bug hunting, infra stabilizace)
v3.0   = MainNet Genesis (produkce)
```

### Milníky

| Verze | Status | Klíčové deliverables |
|-------|--------|----------------------|
| v2.9.5 | ✅ Archived | Rust native přechod, 108 testů, NCL základ |
| v2.9.6 | ✅ Current | CHv3 ASIC hardening, CHv4 A+B, bridge testnet live |
| **v2.9.7** | 🔧 Code Freeze | 267+95+54 testů ✅, Discord alerts, Ankr, 168h stability ✅ |
| v2.9.8 | 📋 Planned | Bug fix kolo #1 — unwrap() audit, clippy -D warnings |
| v2.9.9 | 📋 Planned | Bug fix kolo #2 — final pre-mainnet stabilizace, stress test |
| **v3.0** | 🎯 MainNet | Genesis ceremonie, produkční deployment, public launch |

### Co zbývá před v3.0

1. **v2.9.8** — Systematický audit `unwrap()` / `expect()` → proper error handling, `cargo clippy -- -D warnings` čistý, Hardhat testy 96+
2. **v2.9.9** — Stress test (24h high-hashrate), mainnet genesis blocku simulace na stagingu, Docker SHA manifesty, MAINNET_CONSTITUTION.md freeze + SHA256
3. **v3.0** — Genesis ceremonie (offline, air-gapped), seed nodes deployment, public announcement

---

## 12. Právní rámec

ZION TerraNova je **software infrastruktura** — open-source protokol. Neprovádíme:
- ICO ani presale tokenů
- Nabídku investičních instrumentů
- Finanční poradenství

Před interakcí s ZION si přečtěte:
- `legal/DISCLAIMER.md`
- `legal/TOKEN_NOT_SECURITY.md`
- `legal/RISK_DISCLOSURE.md`
- `legal/NO_INVESTMENT.md`

ZION CoZ s.r.o. (Praha) poskytuje software a infrastrukturní služby. Veškeré transakce na síti jsou peer-to-peer a plně na zodpovědnosti uživatele.

---

## 13. Závěr

ZION TerraNova v3.0 není další spekulativní kryptoměna. Je to technologická infrastruktura navržená pro dlouhodobé přežití a evoluci:

- **Rust-native** pro maximální spolehlivost a bezpečnost
- **Fair Launch** pro maximální férovost komunity
- **Proof of Useful Work** pro reálnou hodnotu těžby
- **Vrstvená architektura** pro flexibilitu a budoucí rozšíření
- **DAO governance** pro dlouhodobou decentralizaci

Kód je otevřený. Genesis je transparentní. Pravidla jsou zakotvena on-chain.

> *"Gate, Gate, Pāragate, Pārasaṃgate, Bodhi Svāhā"*  
> — Genesis blok dedicace, 2026

**ZION TerraNova v3.0 — MainNet Genesis**

---

## Přílohy

| Dokument | Umístění |
|----------|----------|
| API Reference | `docs/2.9.7/API_ENDPOINTS.md` |
| Genesis Ceremony | `docs/2.9.7/GENESIS_CEREMONY.md` |
| Genesis Message | `docs/2.9.7/GENESIS_MESSAGE.txt` |
| Architecture (Bridge) | `docs/WARP_ARCHITECTURE.md` |
| Architecture (CH) | `L1/cosmic-harmony/README.md` |
| Legal Disclaimer | `legal/DISCLAIMER.md` |
| Premine Addresses | `PREMINE_ADDRESSES_PUBLIC.txt` |
| Code Freeze Checklist | `docs/2.9.7/CODE_FREEZE.md` |
| Stability Log | `docs/ops/STABILITY_LOG.md` |

---

*Whitepaper v3.0 — Březen 2026 — ZION TerraNova Core Team*  
*Licencováno pod MIT — https://github.com/Yose144/2.9.6*
