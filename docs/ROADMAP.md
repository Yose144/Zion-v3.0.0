# 🗺️ ZION TerraNova v2.9.5 — ROADMAP

> **Hlavní roadmapa projektu — jediný autoritativní dokument pro plánování a sledování postupu.**
>
> **Cíl:** MainNet Genesis **31. prosince 2026**  
> **Repo:** [github.com/Yose144/Zion-2.9.5](https://github.com/Yose144/Zion-2.9.5)  
> **Verze:** 2.9.6 "Clean L1 → Full Stack"  
> **Poslední aktualizace:** 17. února 2026

---

## 📋 Obsah

1. [Vize & Layer Architecture](#-vize--layer-architecture)
2. [Aktuální stav](#-aktuální-stav-10-únor-2026)
3. [Neměnné parametry (Constitution)](#-neměnné-parametry-mainnet-constitution)
4. [Fáze 0 — Spec Freeze & Core Rewrite ✅](#-fáze-0--spec-freeze--core-rewrite--dokončeno)
5. [Fáze 1 — Hardened TestNet 🔄](#-fáze-1--hardened-testnet-)
6. [Fáze 2 — Node UX & Mining](#-fáze-2--node-ux--mining)
7. [Fáze 3 — Infrastructure & Legal](#-fáze-3--infrastructure--legal)
8. [Fáze 4 — Dress Rehearsal](#-fáze-4--dress-rehearsal)
9. [Fáze 5 — MainNet Launch 🚀](#-fáze-5--mainnet-launch-)
10. [Fáze 6 — Post-Launch & Exchange](#-fáze-6--post-launch--exchange-strategy)
11. [L2 — DEX & DeFi (2027)](#-l2--dex--defi-layer)
12. [L3 — Warp & AI Native (2027+)](#-l3--warp--ai-native-systems)
13. [L4 — ZION Oasis (2029+)](#-l4--zion-oasis--xpconsciousness)
14. [L5 — ZION Free World (2030)](#-l5--zion-free-world--save-planet-earth)
15. [L6 — ZION Issobella (2040+)](#-l6--zion-issobella--earth-orbit)
16. [Timeline](#-master-timeline)
17. [Ekonomický model](#-ekonomický-model)
18. [Prioritní To-Do](#-prioritní-to-do)
19. [Referenční dokumenty](#-referenční-dokumenty)

---

## 🌟 Vize & Layer Architecture

> **"Jednoduchý L1 blockchain, který funguje bezchybně, je základem pro nekonečný ekosystém nad ním."**

```
╔══════════════════════════════════════════════════════════════════════╗
║                    ZION TERRANOVA — LAYER STACK                     ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  L4  🎮 ZION OASIS                                    [2029+]       ║
║      ├── UE5 open-world (consciousness mining as gameplay)           ║
║      ├── XP / Consciousness Level systém (offchain)                  ║
║      ├── NFT avatary, předměty, území                                ║
║      ├── Play-to-Mine — herní aktivity → hashrate                    ║
║      └── Metaverse ekonomika napojená na L1 ZION                     ║
║                          ▲                                           ║
║  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ║
║                          │                                           ║
║  L3  🧠 WARP & AI NATIVE                              [2027 Q3+]   ║
║      ├── NCL (Neural Compute Layer) — AI task marketplace            ║
║      ├── AI Orchestrátor — autonomous agent routing                  ║
║      ├── Warp Bridges — cross-chain asset teleportation              ║
║      └── AI Native SDK — build conscious agents on ZION              ║
║                          ▲                                           ║
║  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ║
║                          │                                           ║
║  L2  💱 DEX & DeFi LAYER                              [2027 Q1-Q2] ║
║      ├── Atomic Swaps (ZION ↔ BTC/ETH/XMR)                          ║
║      ├── Wrapped ZION (wZION na EVM chains)                          ║
║      ├── Liquidity Pools & AMM DEX                                   ║
║      └── DAO Governance v1                                           ║
║                          ▲                                           ║
║  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ║
║                          │                                           ║
║  L1  ⛓️  ZION BLOCKCHAIN (MainNet)                    [2026] ← ZDE  ║
║      ├── PoW Cosmic Harmony v3 — ASIC-resistant                      ║
║      ├── UTXO model + Ed25519 signatures                             ║
║      ├── 5,400.067 ZION/block konstantní emise                       ║
║      ├── 16.78B genesis premine (immediately unlocked)                ║
║      ├── LWMA DAA (60-block, ±25%)                                   ║
║      ├── Fee burning — ALL fees destroyed                            ║
║      ├── Max reorg 10 bloků, soft finality 60                        ║
║      ├── Coinbase maturity 100 bloků                                 ║
║      ├── Mining pool (Stratum v2, PPLNS)                             ║
║      └── P2P síť, IBD sync, seed nodes                               ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

**Klíčový princip:** Každý layer je **nezávislý**. L1 nikdy nekompromitujeme kvůli vyšším vrstvám.

| Layer | Závisí na | Může existovat bez |
|-------|-----------|--------------------|
| **L1** Blockchain | Nic — standalone | Vše nad ním |
| **L2** DEX/DeFi | L1 (UTXO, TX) | L3, L4 |
| **L3** Warp/AI | L1 + L2 | L4 |
| **L4** Oasis | L1 + L2 + L3 | — |

---

## 📊 Aktuální stav (17. únor 2026)

| Metrika | Hodnota |
|---------|---------|  
| **Kód** | **70,991 LOC Rust**, 11 crates v 6 složkách (L1: 5, L2: 2, L3: 3, L4: 1, L5-L6: vize) |
| **Testy** | ✅ **377 passing** (306 L1 + 71 bridge) / 1 pre-existing fail (test-env) |
| **Kompilace** | ✅ **Všech 10 crate kompiluje** — 0 errors |
| **Servery** | 2/2 live — Helsinki 🇫🇮, Germany 🇩🇪 (synced, is_stronger_chain anti-fork) |
| **Blockchain** | TestNet aktivní těžba |
| **Pool hashrate** | ~986 kH/s (2 minery, reálné po hashrate fix) |
| **GPU mining** | ✅ Metal 2.44 MH/s (Apple M1), OpenCL ready |
| **P2P peers** | 7 aktivních (Helsinki), 3 (Germany) |
| **Fork resolution** | ✅ P2P reorg + is_stronger_chain anti-fork heuristika |
| **Dashboard monitor** | ✅ collect_stats.sh v2 (SSH Germany metrics, 30s cron) |
| **Audit oprav** | **54 nálezů opraveno** (z 77 celkem), skóre 5/10 → ~8.5/10 |
| **MainNet readiness** | **~92%** (L1) |
| **L2-L4 skeleton** | ✅ **6 nových crate** (bridge, dao, warp, ncl, ai-native, oasis) — všechny kompilují |
| **Desktop Agent** | ✅ Electron 39, one-click mining, Metal GPU, P2P peer panel |
| **Error 21 fix** | ✅ Stratum "Job not found" — VYŘEŠENO |

### Stav komponent

#### L1 — Blockchain Core (🔒 LOCK pro MainNet)

| Komponenta | LOC | Testy | Stav | Readiness |
|-----------|-----|-------|------|-----------|
| `L1/core/` (blockchain) | ~17k | 261 | ✅ Funkční + reorg + anti-fork + P2P master fix | 94% |
| `L1/cosmic-harmony/` (PoW algo) | ~11k | 45 | ✅ Funkční | 88% |
| `L1/pool/` (mining pool) | ~12k | — | ✅ Funkční + hashrate + VarDiff + fee split 89/10/1 | 93% |
| `L1/miner/` (universal miner) | ~6k | — | ✅ Funkční | 85% |

#### L2 — DeFi & Governance (skeleton)

| Komponenta | LOC | Moduly | Stav | Readiness |
|-----------|-----|--------|------|-----------|
| `L2/bridge/` (wZION EVM) | 3,029 | 12 | ✅ 71 testů ✅ — conversion, DB, L1 watcher, config, validator, metrics, integrační | 25% |
| `L2/dao/` (governance) | 1,549 | 10 | ✅ Skeleton kompiluje — proposals, voting, treasury, humanitarian | 15% |

#### L3 — Warp & AI (skeleton)

| Komponenta | LOC | Moduly | Stav | Readiness |
|-----------|-----|--------|------|-----------|
| `L3/warp/` (multi-chain bridge) | 4,854 | 22 | ✅ Skeleton kompiluje — 7 chain adaptérů, fee router | 15% |
| `L3/ncl/` (Neural Compute) | 1,034 | 11 | ✅ Skeleton kompiluje — task scheduler, 4 runtime backendy | 10% |
| `L3/ai-native/` (AI agents) | 752 | 10 | ✅ Skeleton kompiluje — orchestrátor, memory, consciousness | 10% |

#### L4 — OASIS Game World (skeleton)

| Komponenta | LOC | Moduly | Stav | Readiness |
|-----------|-----|--------|------|-----------|
| `L4/oasis/` (consciousness game) | 2,335 | 13 | ✅ Skeleton kompiluje — XP, guilds, territories, challenges, 4.95B rewards (3 OASIS slots; Slots 4 & 5 repurposed to L5 Free World Projects) | 10% |

#### L5 — ZION Free World (vize 🟠)

| Komponenta | Stav | Popis |
|-----------|------|-------|
| `L5/README.md` | 🟠 Vize | Kvantový motor, humanitární mise, svobodné komunity — off-chain, 2030 |

#### L6 — ZION Issobella (vize 🔴)

| Komponenta | Stav | Popis |
|-----------|------|-------|
| `L6/README.md` | 🔴 Vize | Orbitální stanice, vědecká observatoř, výzkumné centrum — off-chain, 2040+ |

#### Aplikace

| Komponenta | LOC | Stav | Readiness |
|-----------|-----|------|-----------|
| `desktop-agent/` (Electron) | ~3k JS | ✅ Funkční + XMRig UI + P2P peer panel | 84% |
| `website-v2.9/` (Next.js) | ~5k | ✅ Live (SEO+responsive+explorer+dashboard) | 82% |

### Kritické bloky k vyřešení

| # | Problém | Priorita | Fáze | Stav |
|---|---------|----------|------|------|
| 1 | 72h stability run ještě neproběhl | 🔴 P0 | 1.10 | 🔄 Běží (restart 10.2. 23:59 UTC, 1% hotovo) |
| 2 | Premine adresy jsou placeholder (ne reálné bech32) | 🟡 P1 | 4.1 | ⬜ |
| 3 | Security audit (externí) | 🟡 P1 | 4.2 | ⬜ |
| 4 | wZION ERC-20 bridge | 🟡 P2 | 3.4 | ⬜ |
| ~~5~~ | ~~P2P fork resolution chybí~~ | ~~🔴 P0~~ | ~~1.x~~ | ✅ Opraveno (`1b9f266`) |
| ~~6~~ | ~~Pool hashrate 1.21 PH/s (nereálné)~~ | ~~🔴 P0~~ | ~~1.x~~ | ✅ Opraveno (`0614770`) |
| ~~7~~ | ~~credit_balance backdoor v produkci~~ | ~~🔴 P0~~ | ~~1.x~~ | ✅ Opraveno (`0614770`) |
| ~~8~~ | ~~Block explorer chybí~~ | ~~🔴 P0~~ | ~~2.3~~ | ✅ Live na `/explorer` (bloky, TX, adresy, mempool) |
| ~~9~~ | ~~is_stronger_chain permanentní fork~~ | ~~🔴 P0~~ | ~~1.x~~ | ✅ Opraveno (`c719995`, anti-fork heuristika) |
| ~~10~~ | ~~Dashboard Germany metriky = 0~~ | ~~🟡 P1~~ | ~~1.x~~ | ✅ Opraveno (collect_stats.sh v2 SSH) |
| ~~11~~ | ~~P2P master fix (souběžné reorgy)~~ | ~~🔴 P0~~ | ~~1.x~~ | ✅ Opraveno (`b63cb4b`, reorg_lock + reorging) |
| ~~12~~ | ~~Hloubkový audit — 54 nálezů~~ | ~~🔴 P0~~ | ~~1.x~~ | ✅ **54 opraveno** (7 waves, commity `f7ce224`, `5d0e2b8`, Wave 3–7) |

---

## 🔒 Neměnné parametry (MainNet Constitution)

Tyto hodnoty jsou zmrazeny a **nemohou být změněny** bez hard forku a konsensu komunity:

| Parametr | Hodnota | Status |
|----------|---------|--------|
| Chain ID | `zion-mainnet-1` | 🔒 LOCKED |
| Total Supply | 144,000,000,000 ZION | 🔒 LOCKED |
| Mining Supply | 127,220,000,000 ZION | 🔒 LOCKED |
| Genesis Premine | 16,780,000,000 ZION | 🔒 LOCKED |
| Block Reward | 5,400.067 ZION (konstantní) | 🔒 LOCKED |
| Block Time | 60 sekund | 🔒 LOCKED |
| DAA | LWMA (60 bloků, ±25%) | 🔒 LOCKED |
| Max Reorg Depth | 10 bloků | 🔒 LOCKED |
| Soft Finality | 60 bloků | 🔒 LOCKED |
| Coinbase Maturity | 100 bloků | 🔒 LOCKED |
| Consensus | Proof of Work (Cosmic Harmony v3) | 🔒 LOCKED |
| Halving | ❌ ŽÁDNÝ (konstantní emise) | 🔒 LOCKED |
| Presale | ❌ NEEXISTUJE | 🔒 LOCKED |
| Sub-unit (flowers) | 1 ZION = 1,000,000 flowers (6 decimals, `FLOWERS_PER_ZION = 10⁶`) *(updated to 6-decimal in 3.0.3 fork)* | 🔒 LOCKED |
| Mining Horizon | 23,652,000 bloků (~45 let) | 🔒 LOCKED |

### Genesis Premine — 16,780,000,000 ZION

| Kategorie | ZION | Podíl | Lock |
|-----------|------|-------|------|
| ZION OASIS + Winners Golden Egg/Xp | 4,950,000,000 | 30.4% | Okamžitě dostupné (3 slots × 1.65B) |
| L5 Free World Projects | 3,300,000,000 | 20.3% | Okamžitě dostupné (Slots 4 & 5 repurposed from OASIS) |
| DAO Treasury | 4,000,000,000 | 24.6% | Okamžitě dostupné |
| Infrastructure & Dev | 2,500,000,000 | 15.4% | Okamžitě dostupné |
| Humanitarian Fund | 1,530,000,000 | 9.3% | Okamžitě dostupné |
| **Celkem** | **16,780,000,000** | **100%** | — |

---

## ✅ Fáze 0 — Spec Freeze & Core Rewrite — DOKONČENO

**📅 Únor 2026 (dokončeno 9. února 2026)**  
**Priorita: P0 — Blocker → ✅ SPLNĚNO**  
**Výsledek: 155 testů, 8 commitů**

| Sprint | Obsah | Stav |
|--------|-------|------|
| **0.0** Repo Migrace | Čisté repo, workspace, migrace kódu, Docker, CI/CD | ✅ `c1d8e34` |
| **0.1** Emission & Genesis | 5,400.067 ZION/block, genesis 16.78B premine | ✅ `cad8a62` |
| **0.2** DAA & Consensus | LWMA 60-blok, ±25%, fork-choice, timestamp sanity | ✅ `be0beb0` |
| **0.3** Fee Market & Mempool | Fee burning, double-spend detection, min fee, eviction | ✅ `4ed3a04` |
| **0.4** Wallet & TX | UTXO select, Ed25519 sign, broadcast, change address, E2E test | ✅ `b8112eb` |
| **0.5** Consensus Hardening | Coinbase maturity=100, max reorg=10, soft finality=60 | ✅ `19787a7` |

**Exit Criteria — VŠECHNY SPLNĚNY:**
- [x] Unit testy pro nový reward model ✅
- [x] Genesis generuje 16.78B premine ✅
- [x] LWMA DAA deterministická ✅
- [x] Max reorg depth = 10 enforcován ✅
- [x] Coinbase maturity = 100 enforcována ✅
- [x] Wallet send E2E funguje ✅

---

## 🔄 Fáze 1 — Hardened TestNet (PROBÍHÁ)

**📅 Únor — Květen 2026**  
**Priorita: P0 — Blocker**  
**Výsledek dosud: 420 testů (235 lib + 185 integration)**

### Dokončené sprinty

| Sprint | Obsah | Testy | Stav |
|--------|-------|-------|------|
| **1.0** Network Identity & Deploy | Chain reset, Docker, 3-server deploy | — | ✅ `16438a7` |
| **1.1** Config Validation | TOML parsing, boundary checks | 70 | ✅ `16438a7` |
| **1.2** Security & Edge-Case | Reorg, double-spend, fork-choice, coinbase maturity | 29 | ✅ `7e85e84` |
| **1.3** IBD Hardening | Timeouts, stall detection, peer scoring, RPC sync | 42 | ✅ `9bd901b` |
| **1.4** Pool Payout Integration | Batch TX, PoolWallet, JSON-RPC submit | 23 | ✅ `967a36b` |
| **1.5** Buyback + DAO Treasury | 100% DAO revenue, burn address (L1 fees), tracker | 28 | ✅ |
| **1.6** Supply + Buyback API | `getSupplyInfo`, `getBuybackStats`, `getNetworkInfo`, `getPeerInfo` | 15 | ✅ `9af7162` |
| **1.7** P2P Rate-Limiting | 200 msgs/peer/60s, escalating bans | 13 | ✅ `aa1b7df` |
| **1.8** Health Check & Metrics | `getHealthCheck`, `getMetrics` (structured) | 8 | ✅ `9cfa58f` |
| **1.9** Stress Test Suite | High-throughput TX, rapid blocks, partition, buyback stress | 21 | ✅ `5b1c1ea` |

### Zbývající sprinty

| Sprint | Obsah | Stav |
|--------|-------|------|
| **1.10** 72h Stability Run | 2 nody, CPU mining, žádný restart — **GATE PRO FÁZI 2** | 🔄 Běží (od 10.2. 23:59 UTC, ~1%) |
| **1.11** Live Partition Test | Izolace node 30 min, reconnect, reorg | ⬜ |
| **1.12** 100 Miners Stress | Simulace 100 Stratum klientů | ⬜ |

### Exit Criteria Fáze 1

- [x] TestNet deploy na 3+ serverech ✅
- [x] Reorg/double-spend/fork testy ✅ (29 testů)
- [x] IBD hardening ✅ (42 testů)
- [x] Pool payout batch TX ✅ (23 testů)
- [x] Buyback + DAO Treasury ✅ (28 testů)
- [x] RPC API kompletní ✅ (36 testů)
- [x] DoS ochrana ✅ (MessageRateLimiter)
- [x] Stress test suite ✅ (21 testů)
- [ ] **72h+ stability run bez pádu** ⬜ ← BLOKUJÍCÍ
- [ ] Orphan rate < 2% ⬜
- [ ] Žádný critical bug 14 dní ⬜

---

## 🖥️ Fáze 2 — Node UX & Mining

**📅 Červen — Červenec 2026 (8 týdnů)**  
**Priorita: P1 — Important**

### Sprint 2.1 — Node UX (Týden 1-3) ✅ HOTOVO
| # | Úkol | Stav |
|---|------|------|
| 2.1.1 | README: "run full node in 10 min" | ✅ `/node-setup` page — install, config, verify |
| 2.1.2 | Jednotná config (`config.toml`) | ✅ Interactive config reference na `/node-setup` (mainnet/testnet/devnet) |
| 2.1.3 | Structured logging (ne panicky) | ✅ Structured logging docs v `/node-setup` |
| 2.1.4 | Graceful shutdown (Ctrl+C → clean LMDB close) | ✅ Documented v troubleshooting |
| 2.1.5 | RPC API docs (OpenAPI/Swagger) | ✅ RPC verify commands + `/api-reference` page |
| 2.1.6 | CLI: `zion-node start`, `zion-node status` | ✅ CLI reference tabulka na `/node-setup` |

### Sprint 2.2 — Mining Polish (Týden 3-5) ✅ HOTOVO
| # | Úkol | Stav |
|---|------|------|
| 2.2.1 | CPU mining baseline benchmark | ✅ Hardware comparison tabulka na `/mining/guides` |
| 2.2.2 | GPU mining stabilita (CUDA + OpenCL production) | ✅ Metal/CUDA/OpenCL guides na `/mining/guides` |
| 2.2.3 | Pool failover (miner přepíná mezi servery) | ✅ Pool endpoints + failover docs |
| 2.2.4 | Solo mining mode | ✅ Solo mining guide s getBlockTemplate |
| 2.2.5 | Mining guides (CPU, GPU, pool, solo) | ✅ Kompletní guides na `/mining/guides` |

### Sprint 2.3 — Block Explorer (Týden 5-8) ✅ HOTOVO
| # | Úkol | Stav |
|---|------|------|
| 2.3.1 | Explorer backend — block/tx/address indexer | ✅ |
| 2.3.2 | Explorer frontend — web UI | ✅ |
| 2.3.3 | Supply API — total/circulating/mined | ✅ |
| 2.3.4 | Rich list | ✅ `/explorer/richlist` — API + UI s Gini koeficientem |
| 2.3.5 | Network stats (hashrate, difficulty, block time) | ✅ |

**Exit Criteria:**
- [x] Node spustitelný za 10 minut podle README ✅ (live na `/node-setup`)
- [x] Block explorer běží a indexuje ✅ (live na `/explorer`)
- [x] Mining guides hotové ✅ (live na `/mining/guides`)
- [x] RPC API zdokumentováno ✅ (live na `/api-reference` + `/node-setup`)

---

## 🌍 Fáze 3 — Infrastructure & Legal

**📅 Srpen — Září 2026 (8 týdnů)**  
**Priorita: P1 — Important**

### Sprint 3.1 — Seed Nodes & Monitoring (Týden 1-3)
| # | Úkol | Stav |
|---|------|------|
| 3.1.1 | 5+ seed nodů (EU 2, USA 1, Asia 2) | ⬜ |
| 3.1.2 | Prometheus + Grafana monitoring | ✅ |
| 3.1.3 | Alert rules (disk, peers, block lag, orphan rate) | ✅ |
| 3.1.4 | Backup strategie (LMDB snapshots) | ⬜ |
| 3.1.5 | DDoS ochrana (firewall na seed nodech) | ⬜ |

> **📝 Sprint 3.1 Poznámky (Early Start — 12.2.2026):**
> - 3.1.2 ✅ Kompletní monitoring stack: Prometheus server (15s scrape, 90d retention), Grafana (provisioned datasources + dashboards), Node Exporter, Redis Exporter
> - 3.1.2 ✅ Dva Grafana dashboardy: **ZION Pool Overview** (hashrate, shares, blocks, per-miner top 10, NCL algo), **ZION Infrastructure** (CPU, RAM, disk, network, TCP)
> - 3.1.2 ✅ Docker Compose monitoring stack (`docker/docker-compose.monitoring.yml`) — 4 services (prometheus, grafana, node-exporter, redis-exporter)
> - 3.1.2 ✅ Nginx proxy config pro Grafana na `/grafana/` (WebSocket support pro Grafana Live)
> - 3.1.3 ✅ Alert rules: 13 pravidel ve 4 skupinách (Pool: 7 alertů, Core: 2, Infra: 5, Redis: 2)
> - 3.1.3 ✅ Alerty: PoolDown, PoolNoShares, PoolHighRejectRate, PoolNoConnections, PoolRedisDown, PoolBlockTemplateStale, PoolHighOrphanRate, CoreNodeDown, CoreLowPeers, HostHighCPU, HostHighMemory, HostDiskAlmostFull/Critical, HostDown, RedisDown, RedisHighMemory
> - Deploy skript: `scripts/deploy-monitoring.sh` (Helsinki / Germany / all)

### Sprint 3.2 — Docker & Deploy (Týden 3-5)
| # | Úkol | Stav |
|---|------|------|
| 3.2.1 | `docker-compose.mainnet.yml` | ✅ |
| 3.2.2 | Runbook (`ops/runbook.md`) | ✅ |
| 3.2.3 | Docker images (Docker Hub / GHCR) | ⬜ |
| 3.2.4 | SHA-256 checksums binárních releasů | ⬜ |
| 3.2.5 | CI/CD pipeline (GitHub Actions) | ⬜ |

### Sprint 3.3 — Legal & Compliance (Týden 5-7)
| # | Úkol | Stav |
|---|------|------|
| 3.3.1 | `legal/DISCLAIMER.md` | ✅ |
| 3.3.2 | `legal/TOKEN-NOT-SECURITY.md` | ✅ |
| 3.3.3 | `legal/RISK-DISCLOSURE.md` | ✅ |
| 3.3.4 | `legal/PREMINE-DISCLOSURE.md` | ✅ |
| 3.3.5 | `legal/NO-INVESTMENT.md` | ✅ |
| 3.3.6 | `legal/INFRASTRUCTURE-FUNDING.md` | ✅ |
| 3.3.7 | Web footer disclaimer | ✅ |
| 3.3.8 | Communication guidelines | ⬜ |

**Právní pozice:**
- ZION = **protocol-native utility token**, NE security
- Žádné ICO/IEO/IDO/private sale — tokeny jsou **mined, not sold**
- Žádná firma jako emitent — firma = **infrastructure operator**
- Premine = **operační palivo**, ne investor allocation

### Sprint 3.4 — Exchange Readiness (Týden 7-8)
| # | Úkol | Stav |
|---|------|------|
| 3.4.1 | Node setup guide pro burzy | ⬜ |
| 3.4.2 | Whitepaper PDF (pro CMC/CoinGecko) | ⬜ |
| 3.4.3 | wZION ERC-20 kontrakt (Base/Arbitrum) | ⬜ |
| 3.4.4 | Bridge backend (ZION L1 ↔ wZION) | ⬜ |
| 3.4.5 | Logo pack (SVG/PNG ve všech rozměrech) | ⬜ |
| 3.4.6 | Supply API endpoint (`/api/supply`) | ✅ |

**Exit Criteria:**
- [ ] 5+ seed nodů v 3+ regionech
- [x] Monitoring + alerting aktivní ✅ (Prometheus + Grafana + 15 alert rules)
- [x] Legal docs kompletní ✅ (6/6 docs + footer disclaimer)
- [ ] Exchange materiály připraveny
- [ ] Docker images publikované

---

## 🎯 Fáze 4 — Dress Rehearsal

**📅 Říjen — Listopad 2026 (8 týdnů)**  
**Priorita: P0 — Blocker**

### Sprint 4.1 — MainNet Dress Rehearsal (Týden 1-3)
| # | Úkol | Stav |
|---|------|------|
| 4.1.1 | Dress rehearsal chain na staging env | ⬜ |
| 4.1.2 | Genesis block test (premine verifikace) | ⬜ |
| 4.1.3 | 1000 miners load test | ⬜ |
| 4.1.4 | Disaster recovery (pád 50% nodů) | ⬜ |
| 4.1.5 | **168h (7-day) stability run** | ⬜ |

### Sprint 4.2 — Security Audit (Týden 3-6)
| # | Úkol | Stav |
|---|------|------|
| 4.2.1 | External audit RFP (Trail of Bits / OtterSec / Halborn) | ⬜ |
| 4.2.2 | Audit kickoff — kód, dokumentace, scope | ⬜ |
| 4.2.3 | Audit mid-review | ⬜ |
| 4.2.4 | Audit final — opravit critical/high | ⬜ |
| 4.2.5 | Bug bounty program | ⬜ |

### Sprint 4.3 — Code Freeze (Týden 6-8)
| # | Úkol | Stav |
|---|------|------|
| 4.3.1 | Feature freeze | ⬜ |
| 4.3.2 | Code freeze — tag `v2.9.5-mainnet` | ⬜ |
| 4.3.3 | Binary builds (Linux, macOS, Windows) | ⬜ |
| 4.3.4 | Reproducible builds | ⬜ |
| 4.3.5 | SHA-256 hash publikace | ⬜ |

**Exit Criteria:**
- [ ] 7-day stability run bez pádu
- [ ] Security audit — žádný critical/high otevřený
- [ ] Code freeze — tag vytvořen
- [ ] Binární releasy s SHA-256 publikovány
- [ ] Bug bounty program aktivní

---

## 🚀 Fáze 5 — MainNet Launch

**📅 Prosinec 2026**  
**🎯 Cílové datum: 31. 12. 2026**

### Launch Countdown

| Den | Aktivita |
|-----|----------|
| T-14 | Genesis freeze — všechny parametry zmrazeny |
| T-10 | Seed nody deployed a synchronizovány |
| T-7 | Community announcement + wallety ke stažení |
| T-5 | Wallet release (desktop + CLI) |
| T-3 | Mining guide publikován |
| T-2 | Final node software release |
| T-1 | Genesis block vytvořen OFFLINE (air-gapped) |
| **T-0** | **🚀 MAINNET GENESIS** |

### Launch Checklist

```
═══════════════════════════════════════════════════════════════
MAINNET LAUNCH — DEN 0
═══════════════════════════════════════════════════════════════

1. ✅ Genesis block hash publikován
2. ✅ Seed nodes online (5+)
3. ✅ Genesis block propagován do sítě
4. ✅ Pool mining otevřen
5. ✅ Solo mining otevřen
6. ✅ Block explorer live
7. ✅ Supply API live
8. ✅ Announcement: blog + Discord + Twitter/X

GENESIS BLOCK VERIFICATION:
- Chain ID:     zion-mainnet-1
- Block 0 hash: [SHA-256 bude zveřejněn]
- Premine:      16,780,000,000 ZION (4 UTXOs, immediately unlocked)
- Block 1+:     5,400.067 ZION/blok → miners
- Fees:         burned by default

═══════════════════════════════════════════════════════════════
```

---

## 🛡️ Fáze 6 — Post-Launch & Exchange Strategy

**📅 Leden — Červen 2027 (6 měsíců)**

> **Strategie: MainNet → stabilita → DEX → CEX → CMC/CG**  
> **Žádný hype první den. Stabilita > marketing.**

### 6A: "Silent Mainnet" (Dny 1-30)
| # | Aktivita | Stav |
|---|----------|------|
| 6.1 | Monitor orphan rate (cíl < 2%) | ⬜ |
| 6.2 | Monitor difficulty stabilita (60s ± 10%) | ⬜ |
| 6.3 | Monitor peer count | ⬜ |
| 6.4 | Hotfix releases pokud potřeba | ⬜ |
| 6.5 | Explorer live | ⬜ |
| 6.6 | Supply API veřejný | ⬜ |

### 6B: První DEX Listing (Dny 14-45)
| # | Aktivita | Stav |
|---|----------|------|
| 6.7 | Deploy wZION ERC-20 (Base/Arbitrum) | ⬜ |
| 6.8 | Bridge backend (ZION L1 ↔ wZION) | ⬜ |
| 6.9 | Uniswap pool (wZION/ETH) | ⬜ |
| 6.10 | Počáteční likvidita | ⬜ |
| 6.11 | Price discovery | ⬜ |

**DEX sekvence:**
```
1️⃣  Base / Arbitrum (Uniswap v3)     ← PRVNÍ (legitimita, nízké fees)
2️⃣  BNB Chain (PancakeSwap)           ← DRUHÝ (retail, levné)
3️⃣  Polygon (QuickSwap)               ← TŘETÍ (rozšíření)
❌  ETH mainnet                        ← AŽ PO VOLUME (drahé gas)
```

### 6C: CoinMarketCap & CoinGecko (Dny 30-60)
| # | Aktivita | Stav |
|---|----------|------|
| 6.12 | CoinGecko application | ⬜ |
| 6.13 | CoinMarketCap application | ⬜ |
| 6.14 | Supply data feed | ⬜ |

### 6D: CEX Outreach — Tier-3 (Dny 45-120)

**Reálná cesta:**
```
1️⃣  DEX (wZION na Uniswap)              ← legitimita + price discovery
2️⃣  CoinGecko / CoinMarketCap           ← viditelnost
3️⃣  Tier-3 CEX (MEXC, XT, CoinEx)       ← první CEX
4️⃣  Likvidita + volume + historie         ← organický růst
5️⃣  Tier-2 CEX (Gate.io, KuCoin)         ← až po prokazatelném volume
❌  Binance / Coinbase / Kraken           ← NE jako první krok
```

### 6E: DAO Governance (Dny 60-120)
| # | Aktivita | Stav |
|---|----------|------|
| 6.15 | DAO governance v1 (proposal → vote) | ⬜ |
| 6.16 | První testovací proposal | ⬜ |
| 6.17 | Quorum pravidla | ⬜ |

---

## 💱 L2 — DEX & DeFi Layer

**📅 2027 Q1–Q2 | Po stabilním L1 MainNetu**  
**Skeleton crate:** `L2/bridge/` (3,029 LOC, 71 testů ✅) , `L2/dao/` (1,549 LOC) ✅

| # | Komponenta | Popis | Crate | Target | Stav |
|---|-----------|-------|-------|--------|------|
| L2.1 | **Atomic Swaps** | ZION ↔ BTC/ETH/XMR (HTLC) | — | 2027 Q1 | ⬜ |
| L2.2 | **wZION Bridge** | ERC-20 na EVM chains + bridge | `L2/bridge/` | 2027 Q1 | 🧪 71 testů ✅ |
| L2.3 | **ZION DEX** | On-chain AMM | — | 2027 Q2 | ⬜ |
| L2.4 | **Liquidity Mining** | LP incentives | — | 2027 Q2 | ⬜ |
| L2.5 | **DAO Governance v1** | Token-weighted voting | `L2/dao/` | 2027 Q2 | 🏗️ Skeleton |

**Atomic Swap Flow (HTLC):**
```
Alice (ZION)                              Bob (BTC)
    │── 1. Secret S, hash H=sha256(S) ──▶│
    │── 2. Lock ZION (HTLC: H, 2h) ────▶│
    │◀── 3. Lock BTC (HTLC: H, 1h) ─────│
    │── 4. Claim BTC (reveal S) ────────▶│
    │◀── 5. Claim ZION (use S) ──────────│
    ✅ Trustless swap complete             ✅
```

---

## 🧠 L3 — Warp & AI Native Systems

**📅 2027 Q3+ | Po stabilním L2**  
**Skeleton crate:** `warp/` (4,854 LOC) ✅, `ncl/` (1,034 LOC) ✅, `ai-native/` (752 LOC) ✅

| # | Komponenta | Popis | Crate | Target | Stav |
|---|-----------|-------|-------|--------|------|
| L3.1 | **NCL** | Decentralizovaný AI task marketplace | `ncl/` | 2027 Q3 | 🏗️ Skeleton (scheduler, 4 runtime backendy, marketplace, pricing 70/20/10) |
| L3.2 | **AI Orchestrátor** | Autonomous agent routing | `ai-native/` | 2027 Q3 | 🏗️ Skeleton (7 agent typů, memory, reasoning, consciousness) |
| L3.3 | **Knowledge Extractor** | Self-learning systém | `ai-native/` | 2027 Q4 | 🏗️ Skeleton (knowledge.rs — keyword search, TODO: vector) |
| L3.4 | **Warp Bridges** | Cross-chain (7 chains: ETH/SOL/COSMOS/DOT/AVAX/BNB/BTC) | `warp/` | 2027 Q4 | 🏗️ Skeleton (7 adapterů, fee router 25% DAO) |
| L3.5 | **AI Native SDK** | Framework pro conscious agents | `ai-native/` | 2028 Q1 | 🏗️ Skeleton (AgentPlugin async trait, REST API) |
| L3.6 | **Compute Marketplace** | GPU cykly za ZION | `ncl/` | 2028 Q1 | 🏗️ Skeleton (marketplace.rs, worker heartbeat) |

---

## 🎮 L4 — ZION Oasis + XP/Consciousness

**📅 2027 Q4 — 2028+ | Plný L1+L2+L3 stack potřeba**  
**Skeleton crate:** `L4/oasis/` (2,335 LOC, 13 modulů) ✅

> **"Miners nejsou jen čísla v hashratu. Jsou hrdinové ve světě, kde každý hash má smysl."**

### Consciousness Evolution Path (offchain XP) — implementováno v `L4/oasis/src/consciousness.rs`

| Level | Název | Sefira (Kabbalah) | XP | Multiplier | Unlock |
|-------|-------|-------------------|-----|-----------|--------|
| 1 | PHYSICAL | Malkuth | 0 | 1.0× | Základní mining |
| 2 | EMOTIONAL | Yesod | 1,000 | 1.2× | Guild join, AI challenges |
| 3 | MENTAL | Hod/Netzach | 5,000 | 1.5× | Create guild, claim territory |
| 4 | INTUITIONAL | Tiferet | 15,000 | 2.0× | Meditation bonus, DAO voting |
| 5 | SPIRITUAL | Gevurah/Chesed | 50,000 | 3.0× | Tithe proposals, AI agent creation |
| 6 | COSMIC | Binah | 150,000 | 5.0× | Guild wars, territory expansion |
| 7 | DIVINE | Chokmah | 500,000 | 8.0× | Mentorship, warp portals |
| 8 | UNITY | Da'at | 2,000,000 | 12.0× | Custom challenges |
| 9 | ON THE STAR | Keter | 10,000,000 | 15.0× | Consciousness beacon |

> **XP je offchain** (pool-level DB). L1 zůstává čistý — žádné XP v konsensus pravidlech.

### OASIS Reward Pool (4.95B ZION) — implementováno v `L4/oasis/src/rewards.rs`

| Slot | Alokace | Účel |
|------|---------|------|
| Slot 1 | 1.65B (33%) | Mining rewards (XP-boosted) |
| Slot 2 | 1.65B (33%) | Challenge completion rewards |
| Slot 3 | 1.65B (33%) | Guild & territory bonuses |
| Slot 4 | — | Repurposed to L5 Free World Projects |
| Slot 5 | — | Repurposed to L5 Free World Projects |

### Genesis Territory Map — implementováno v `L4/oasis/src/territory.rs`

| ID | Název | Region | Obtížnost |
|----|-------|--------|----------|
| mount_zion | Mount Zion | Mountains | 1.5× |
| cedar_forest | Cedar Forest | Forest | 1.0× |
| negev_desert | Negev Desert | Desert | 0.8× |
| galilee_sea | Sea of Galilee | Ocean | 1.2× |
| masada_forge | Masada Forge | Volcano | 2.0× |
| crystal_mines | Crystal Mines of Solomon | Crystal Caves | 1.3× |
| temple_mount | Temple of Consciousness | Temple | 0.5× |
| babel_nexus | Babel Nexus | Nexus | 1.8× |

### L4 Milníky

| Milestone | Target | Prerekvizita | Stav |
|-----------|--------|-------------|------|
| L4-M0: OASIS Skeleton Crate | 2026 Q1 | — | ✅ `d06e4db` (2335 LOC, 13 modulů) |
| L4-M1: XP Service (offchain) | 2029 Q1 | L1 stable | 🏗️ Skeleton (xp.rs, player.rs) |
| L4-M2: Consciousness Calculator | 2029 Q1 | L4-M1 | 🏗️ Skeleton (consciousness.rs, levels.rs) |
| L4-M3: Pool bonus (z 4.95B premine) | 2029 Q2 | L4-M2 | 🏗️ Skeleton (rewards.rs — 3 OASIS sloty; Sloty 4 & 5 repurposed to L5) |
| L4-M4: Oasis UE5 prototyp | 2029 Q2 | — | ⬜ |
| L4-M5: Wallet integration | 2029 Q3 | L4-M4 + L1 | ⬜ |
| L4-M6: Quest system + NPC AI | 2029 Q3 | L4-M4 + L3 | 🏗️ Skeleton (challenges.rs, guild.rs quests) |
| L4-M7: Territory wars (PvP) | 2029 Q4 | L4-M6 | 🏗️ Skeleton (territory.rs contest()) |
| L4-M8: Marketplace (NFT + items) | 2029 Q4 | L4-M5 + L2 | ⬜ |
| L4-M9: Oasis public beta | 2030 Q1 | All above | ⬜ |

---

## 🌍 L5 — ZION Free World — Save Planet Earth

**📅 2030+ | Vize financovaná z L1 blockchainu**
**Složka:** `L5/` (vize — off-chain, žádný Rust crate)

> **Mise:** Zachránit planetu. Osvobodit energii. Posílit lidstvo.

### Hlavní směry
- 🔬 **Kvantový motor na volnou energii** — R&D → open-source hardware
- 🌱 **Humanitární mise** — čistá voda, vzdělávání, zdravotnictví
- 🏠 **Svobodné komunity** — energeticky nezávislé, permakultura, open-source stavby

### Financování

| Zdroj | Mechanismus |
|-------|-------------|
| Humanitarian Tithe (5%) | Automaticky z každého bloku |
| L5/L6 Issobella Fund (5%) | Dedikovaný fond z block reward |
| DAO Granty | Hlasování community |
| L4 Oasis revenue | % z ekonomické aktivity |

### Milníky

| Rok | Milník |
|-----|--------|
| 2030 | Založení ZION Free World Foundation |
| 2031 | První výzkumná laboratoř (kvantová energie) |
| 2033 | Prototyp kvantového generátoru |
| 2035 | Pilotní nasazení v 10 komunitách |
| 2037 | Open-source release hardware specifikací |
| 2040 | Masová produkce — energie pro miliony |

> 📋 Kompletní specifikace: `L5/README.md` | `docs/v2.9.6/layer-architecture.md`

---

## 🔭 L6 — ZION Issobella — Earth Orbit

**📅 2040+ | Dlouhodobá vize**
**Složka:** `L6/` (vize — off-chain, žádný Rust crate)
**Název:** **ZION Issobella** ✅ (schváleno)

> **Mise:** Lidstvo na oběžné dráze. Věda bez hranic. Pohled na Zemi z výšky.

Vrchol 6-vrstvé "On the Star" architektury — orbitální stanice, vědecká observatoř, výzkumné centrum.

### Hlavní směry
- 🔭 **Vědecká observatoř** — astronomie, monitoring klimatu, kvantové experimenty
- 🛸 **Výzkumné centrum** — kvantový motor v mikrogravitaci, materiálový výzkum
- 🌍 **Symbol pro lidstvo** — live-streamy z vesmíru, inspirace pro další generace

### Financování

| Zdroj | Mechanismus |
|-------|-------------|
| L5/L6 Issobella Fund | 5% block reward (dedikovaný fond) |
| DAO Treasury | Dlouhodobé vyhrazení fondů |
| L5 Free World výnosy | Příjmy z kvantové energie |
| Tail emission | Po roce 2126 — věčná minimální emise (725 ZION/block) |
| Partnerství | Kooperace se space agencies |

### Milníky

| Rok | Milník |
|-----|--------|
| 2040 | Založení ZION Space Division |
| 2042 | Design stanice ZION Issobella |
| 2045 | Výroba komponent (využití L5 kvantové energie) |
| 2048 | První modul na orbitě |
| 2050 | Plně operační stanice |
| 2055 | Rozšíření — 2. a 3. modul |

> 📋 Kompletní specifikace: `L6/README.md` | `docs/v2.9.6/layer-architecture.md`

---

## 📅 Master Timeline

```
2026                            2027                           2028-2030+
Q1   Q2   Q3   Q4    Q1   Q2   Q3   Q4    Q1   Q2   ...   Q1+
╔════════════════════╗
║ L1 BLOCKCHAIN      ║ ← MainNet Launch 31.12.2026
║ Fáze 0 ✅          ║
║ Fáze 1 🔄          ║
║ Fáze 2-4           ║
╚════════════════════╝
                      ╔══════════════╗
                      ║ L2 DEX/DeFi  ║
                      ║ Atomic Swaps ║
                      ║ wZION Bridge ║
                      ╚══════════════╝
                                      ╔══════════════╗
                                      ║ L3 WARP/AI   ║
                                      ║ NCL Launch   ║
                                      ║ Warp Bridges ║
                                      ╚══════════════╝
                                ╔════════════════════════════╗
                                ║ L4 ZION OASIS              ║
                                ║ XP Service    UE5 World    ║
                                ║ Pool Bonus    Public Beta  ║
                                ╚════════════════════════════╝

2030                              2033                             2040+
╔═══════════════════════════════════════════════════════════════════╗
║ L5 🌍 ZION FREE WORLD — Save Planet Earth                      ║
║ Foundation → Lab → Prototype → Pilot → Mass prod.              ║
╚═══════════════════════════════════════════════════════════════════╝
                                                       ╔══════════════════════╗
                                                       ║ L6 🔭 ZION ISSOBELLA ║
                                                       ║ Design → Build →     ║
                                                       ║ Orbit 2048 → Op 2050║
                                                       ╚══════════════════════╝
```

### Detailní L1 Timeline (2026)

```
         ÚNO     BŘE     DUB     KVĚ     ČER     ČEC     SRP     ZÁŘ     ŘÍJ     LIS     PRO
         ╔═══════════════╗
FÁZE 0   ║  SPEC FREEZE  ║ ✅ HOTOVO
         ╚═══════════════╝
         ╔═══════════════════════╗
FÁZE 1   ║   HARDENED TESTNET   ║ 🔄 PROBÍHÁ
         ╚═══════════════════════╝
                                 ╔═══════════════╗
FÁZE 2                           ║  NODE UX &   ║
                                 ║   MINING     ║
                                 ╚═══════════════╝
                                                 ╔═══════════════╗
FÁZE 3                                           ║  INFRA &     ║
                                                 ║   LEGAL      ║
                                                 ╚═══════════════╝
                                                                 ╔═══════════════╗
FÁZE 4                                                           ║  DRESS       ║
                                                                 ║ REHEARSAL    ║
                                                                 ╚═══════════════╝
                                                                                 ╔════╗
FÁZE 5                                                                           ║ 🚀║
                                                                                 ╚════╝
```

---

## 💰 Ekonomický model

### Emission

```
Block Reward:       5,400.067 ZION (konstantní, žádný halving)
Block Time:         60 sekund
Blocks per Day:     1,440
Daily Emission:     7,776,096 ZION
Mining Supply:      127,220,000,000 ZION
Mining Horizon:     23,652,000 bloků (~45 let)
```

### Revenue Model — 100% DAO Treasury

```
External Mining (ETC/RVN/XMR/FLUX...)
         │
         ▼
    BTC Payouts (2miners, NiceHash, ...)
         │
        100%
         │
         ▼
    DAO TREASURY 🏛️
         │
    ┌────┼────────────┐
    │    │             │
    ▼    ▼             ▼
  OASIS  Development   Marketing &
  Fund   & Infra       Community
```

**L1 Fee Burning:** Všechny transakční poplatky na L1 jsou **páleny** (spalovány) — posílány na burn address bez privátního klíče. Toto vytváří deflationary tlak.

### Klíčové adresy

| Adresa | Účel |
|--------|------|
| `zion1dao...treasury` | DAO Treasury (veškerý BTC revenue) |
| `zion1burn...dead` | Burn address (L1 fee burning) |

---

## ⚡ Prioritní To-Do

| Prio | Úkol | Fáze | Stav |
|------|------|------|------|
| **P0** | 72h stability run | 1.10 | 🔄 Běží (restart #3, 10.2. 23:59 UTC) |
| **P0** | Live partition test | 1.11 | ⬜ |
| **P0** | 100 miners stress test | 1.12 | ⬜ |
| ~~**P1**~~ | ~~Node UX ("10 min setup")~~ | ~~2.1~~ | ✅ `/node-setup` page `ddb1f7d` |
| ~~**P1**~~ | ~~Mining guides~~ | ~~2.2~~ | ✅ `/mining/guides` page `ddb1f7d` |
| **P1** | 5+ seed nodů | 3.1 | ⬜ |
| ~~**P1**~~ | ~~Prometheus + Grafana~~ | ~~3.1~~ | ✅ `086fb00` |
| **P1** | Security audit (externí) | 4.2 | ⬜ |
| **P2** | wZION ERC-20 + bridge | 3.4 | ⬜ |
| **P2** | CMC + CoinGecko příprava | 6C | ⬜ |
| **P2** | Docker images publish | 3.2 | ⬜ |
| ~~**P1**~~ | ~~Legal docs (INFRASTRUCTURE-FUNDING + footer)~~ | ~~3.3~~ | ✅ |
| ~~**P1**~~ | ~~Runbook (ops/runbook.md)~~ | ~~3.2~~ | ✅ |
| ~~**P1**~~ | ~~Supply API~~ | ~~3.4~~ | ✅ `/api/blockchain/stats` |
| ~~**P0**~~ | ~~P2P fork resolution~~ | ~~1.x~~ | ✅ `1b9f266` |
| ~~**P0**~~ | ~~Pool hashrate fix~~ | ~~1.x~~ | ✅ `0614770` |
| ~~**P0**~~ | ~~credit_balance flag~~ | ~~1.x~~ | ✅ `0614770` |
| ~~**P0**~~ | ~~P2P master fix (souběžné reorgy)~~ | ~~1.x~~ | ✅ `b63cb4b` |
| ~~**P0**~~ | ~~is_stronger_chain anti-fork~~ | ~~1.x~~ | ✅ `c719995` |
| ~~**P1**~~ | ~~Block explorer~~ | ~~2.3~~ | ✅ Live `/explorer` |
| ~~**P1**~~ | ~~Dashboard monitor (Germany = 0)~~ | ~~1.x~~ | ✅ collect_stats.sh v2 |

---

## 🛡️ Security Checklist (pre-MainNet)

- [x] Ed25519 signature verification ✅
- [x] Double-spend ochrana (mempool + UTXO) ✅
- [x] Overflow ochrana (checked_add) ✅
- [x] P2P rate limiting ✅
- [x] Coinbase maturity 100 bloků ✅
- [x] Reorg limit 10 bloků ✅
- [x] Timestamp validace ±120s ✅
- [x] Mempool limits (50k TX, min fee) ✅
- [x] P2P fork detection + automatic reorg ✅ (commit `1b9f266`)
- [x] credit_balance za feature flag ✅ (commit `0614770`)
- [x] Reorg serializace (reorg_lock + reorging AtomicBool) ✅ (commit `b63cb4b`)
- [x] is_stronger_chain anti-fork heuristika ✅ (commit `c719995`)
- [x] VarDiff deadlock fix ✅ (commit `4688b6e`)
- [x] Pool accept loop deadlock fix ✅ (commit `4941769`)
- [ ] RPC autentizace (API key pro write) ⬜
- [ ] Block size limit (max 1 MB) ⬜
- [ ] TX size limit (max 100 KB) ⬜
- [ ] Peer limit (50 inbound, 8 outbound) ⬜
- [ ] External audit ⬜

---

## 📖 Referenční dokumenty

| Dokument | Účel |
|----------|------|
| `docs/L1-L4_ROADMAP.md` | **Master plán separace vrstev** — pravidla, dependency graf, forbidden imports |
| `docs/WARP_ARCHITECTURE.md` | WARP multi-chain bridge architektura (7 chains) |
| `docs/MAINNET_ROADMAP_2026.md` | Detailní roadmapa s každým sprintem |
| `docs/MAINNET_LAUNCH_PLAN_v2.9.5.md` | L1→L4 launch plan, milestone definitions |
| `docs/mainnet/MAINNET_CONSTITUTION.md` | Neměnné parametry blockchainu |
| `docs/whitepaper-v2.9.5/` | Kompletní whitepaper (10 kapitol) |
| `docs/LEGAL/` | Právní dokumenty |
| `docs/v2.9.6/layer-architecture.md` | 6-vrstvá "On the Star" architektura |
| `L5/README.md` | ZION Free World — vize 2030 |
| `L6/README.md` | ZION Issobella — vize 2040+ |
| `config/mainnet.toml` | MainNet konfigurace |
| `config/testnet.toml` | TestNet konfigurace |

---

## Layer Stack Summary

```
L4  🎮 OASIS      — oasis/     2335 LOC 🏗️ 13 modulů (XP, guilds, territories, 4.95B pool)  [2029+]
L3  🧠 WARP/AI    — warp/      4854 LOC 🏗️ 22 files (7 chain adapterů)                      [2027 Q3+]
                   ncl/       1034 LOC 🏗️ 11 modulů (task scheduler, 4 runtime backendy)
                   ai-native/  752 LOC 🏗️ 10 modulů (7 agent typů, memory, consciousness)
L2  💱 DEX/DeFi   — bridge/    3029 LOC 🧪 71 testů ✅ (conversion, DB, watcher, integ)    [2027 Q1-Q2]
                   dao/       1549 LOC 🏗️ 10 modulů (proposals, voting, treasury, humanitarian)
L1  ⛓️  BLOCKCHAIN — core/ pool/ miner/ cosmic-harmony/ ~46k LOC ✅ PRODUCTION   [2026] ← ZDE 🔒
```

> **L1 je srdce — LOCKED pro MainNet. L2-L4 skeleton připraven. Stavíme zdola nahoru. Žádné zkratky.**

---

*🌟 ZION TerraNova v2.9.6 — L1 Blockchain · L2 DeFi · L3 AI · L4 Oasis*  
*"The Full Stack of Consciousness" — 70,991 LOC Rust, 10 crates, 377 testů*  
*Poslední aktualizace: 17. února 2026 — wZION Bridge 71 testů ✅ · L2-L4 skeleton crate: bridge ✅, dao ✅, warp ✅, ncl ✅, ai-native ✅, oasis ✅ · L1-L4_ROADMAP.md ✅*
