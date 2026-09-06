# 🎯 ZION TerraNova — MainNet Readiness & Unified Roadmap

> **Datum:** 17. února 2026 (aktualizováno 12. března 2026)  
> **Verze:** 2.9.6 → 2.9.8 Deeksha  
> **Branch:** `main`  
> **Cíl:** MainNet Genesis **31. prosince 2026**  
> **Repo:** [github.com/Zion-TerraNova/2.9.6](https://github.com/Zion-TerraNova/2.9.6)  
> **Sjednocuje:** `ROADMAP.md` + `docs/L1-L4_ROADMAP.md` (oba dokumenty zůstávají jako reference)

---

## 📋 Obsah

1. [Live stav serverů](#-live-stav-serverů-17-února-2026)
2. [Workspace metriky](#-workspace-metriky)
3. [Co je HOTOVO](#-co-je-hotovo)
4. [Co CHYBÍ do MainNetu](#-co-chybí-do-mainnetu)
5. [Layer Architecture](#-layer-architecture)
6. [MainNet Constitution](#-mainnet-constitution)
7. [L1 Roadmap — Fáze 0-5](#-l1-roadmap--fáze-05)
8. [L2-L4 Roadmap — Post-MainNet](#-l2l4-roadmap--post-mainnet)
9. [L5-L6 Roadmap — Vize 2030+](#-l5l6-roadmap--vize-2030)
10. [Timeline](#-master-timeline)
11. [Prioritní akční plán](#-prioritní-akční-plán)

---

## 🖥️ Live stav serverů (12. března 2026)

### Zion2 🇨🇿 (`91.98.122.165`) — Primární host

| Metrika | Hodnota |
|---------|---------|
| **Role** | core + pool + miner + website + monitoring + 2× internal seed |
| **Image verze** | 2.9.8 (Deeksha canonical) |
| **Blockchain** | Aktivní, Cosmic Harmony Deeksha od výšky 0 |
| **Pool** | ZION (Cosmic Harmony Deeksha) |
| **Website** | healthy, port 3000 |

> Původní 3-server topologie (Helsinki/Germany/USA/Asia) byla konsolidována
> na jeden primární host během března 2026. Staré IPs jsou historické.

---

## 📊 Workspace metriky

### Kód

| Crate | Vrstva | LOC | Testů | Stav |
|-------|--------|-----|-------|------|
| `L1/core/` | L1 ⛓️ | 22,684 | 433 | ✅ Produkční |
| `L1/pool/` | L1 ⛏️ | 19,546 | 115 | ✅ Produkční |
| `L1/cosmic-harmony/` | L1 🔐 | 17,944 | 95 | ✅ Produkční |
| `L1/miner/` | L1 ⛏️ | 14,480 | 79 | ✅ Produkční |
| `L3/warp/` | L3 🌐 | ~8,000 | 237 | ✅ Implementováno (7 chainů) |
| `L2/bridge/` | L2 🌉 | ~7,000 | 167 | ✅ Implementováno |
| `L2/dao/` | L2 🏛️ | ~5,000 | 63 | ✅ Implementováno |
| `L2/atomic-swap/` | L2 🔄 | ~4,000 | 15 | ✅ Implementováno |
| `L3/ai-native/` | L3 🤖 | ~3,500 | 82 | ✅ Implementováno |
| `L4/oasis/` | L4 🎮 | 3,494 | 49 | ✅ Implementováno |
| `L3/ncl/` | L3 🧠 | ~3,100 | 37 | ✅ Implementováno |
| **Rust celkem** | | **~114,520** | **1,379** | |
| `L2/contracts/` | L2 📜 | 7 kontrakty | 5 test suites | ✅ Testováno |
| **CELKEM** | | **~115,000+** | **1,379+** | |

### Infrastruktura

| Kategorie | Soubory | Detail |
|-----------|---------|--------|
| **CI/CD** | 3 workflows | `ci.yml` (5 jobs), `audit.yml` (weekly), `release.yml` (3 targets + SHA256) |
| **Docker** | 3 Dockerfile + 5 compose | core, pool, miner; mainnet, testnet, monitoring, revenue, website |
| **Scripts** | 14 | deploy, monitoring, testing, wallets |
| **Config** | 3 TOML | mainnet, testnet, devnet |
| **Legal** | 6 docs | disclaimer, token, risk, premine, no-investment, infrastructure |

### Kvalita kódu

| Metrika | Hodnota | Hodnocení |
|---------|---------|-----------|
| TODO/FIXME v L1 | **6** (všechny `v2.10` post-mainnet) | 🟢 Čistý |
| Compiler warningy | **0** (CI: `-D warnings`) | 🟢 |
| Clippy | **0** warnings (CI enforced) | 🟢 |
| Cargo audit | Weekly automated | 🟢 |
| Test hustota | 1 test / 78 LOC | 🟡 Dobrá |

---

## ✅ Co je HOTOVO

### Fáze 0 — Spec Freeze & Core Rewrite ✅ COMPLETE

| Sprint | Obsah | Commit | Stav |
|--------|-------|--------|------|
| 0.0 | Repo migrace, workspace, Docker | `c1d8e34` | ✅ |
| 0.1 | Emission 5,400.067 + genesis 16.28B | `cad8a62` | ✅ |
| 0.2 | LWMA DAA, fork-choice, timestamp | `be0beb0` | ✅ |
| 0.3 | Fee burning, double-spend, mempool | `4ed3a04` | ✅ |
| 0.4 | UTXO wallet, Ed25519, broadcast | `b8112eb` | ✅ |
| 0.5 | Coinbase maturity 100, max reorg 10 | `19787a7` | ✅ |

### Fáze 1 — Hardened TestNet ✅ COMPLETE (exit criteria zbývají 2)

| Sprint | Obsah | Testů | Commit | Stav |
|--------|-------|-------|--------|------|
| 1.0 | Network identity, testnet/mainnet | — | `6e07b3f` | ✅ |
| 1.1 | Config validation | 70 | `16438a7` | ✅ |
| 1.2 | Security & edge-case | 29 | `7e85e84` | ✅ |
| 1.3 | IBD hardening | 42 | `9bd901b` | ✅ |
| 1.4 | Pool payout integration | 23 | `967a36b` | ✅ |
| 1.5 | Buyback + DAO Treasury | 28 | `f5554a9` | ✅ |
| 1.6 | Supply + Buyback + Network API | 15 | `9af7162` | ✅ |
| 1.7 | P2P rate-limiting | 13 | `aa1b7df` | ✅ |
| 1.8 | Health check & metrics | 8 | `9cfa58f` | ✅ |
| 1.9 | Stress test suite | 21 | `5b1c1ea` | ✅ |
| 1.10 | **72h stability run** | live | `f9dc8dc` | ✅ Germany 168h+ |
| 1.11 | **Live partition test** | live | `f9dc8dc` | ✅ Reorg convergence OK |
| 1.12 | **60 miners stress test** | live | `f9dc8dc` | ✅ 100% conn, 0 disconnect |

**Zbývá:**
- 🔄 Orphan rate < 2% — monitoring (nízký reorg rate potvrzován)
- 🔄 14 dní bez critical bugu — countdown od 16.2. → cíl **2. březen 2026**

### Fáze 2 — Node UX & Mining ✅ COMPLETE

| Sprint | Obsah | Stav |
|--------|-------|------|
| 2.1 | Node UX — 10-min setup, config, logging, graceful shutdown, RPC docs | ✅ Live na `/node-setup` |
| 2.2 | Mining polish — CPU/GPU benchmark, pool failover, solo mining, guides | ✅ Live na `/mining/guides` |
| 2.3 | Block explorer — indexer, frontend, supply API, rich list, network stats | ✅ Live na `/explorer` |

### Další dokončené milníky

| Oblast | Detail | Commity |
|--------|--------|---------|
| **CHv3 Unification** | Odstranění CH v1/v2, single PoW algorithm | `171e1a3` |
| **GPU Mining** | Metal 2.44 MH/s (Apple M1), OpenCL 53 MH/s | `9079ef3`, `a33e650` |
| **Multi-Mining** | Per-miner groups, 4 streamy (ZION+XMR+VRSC+ETC) | `733e1c6`, `e95a16b` |
| **Desktop Agent** | Electron 39, one-click mining, Metal GPU, P2P panel | `84afbda`, `4518531` |
| **Website v2.9** | Next.js, SEO, responsive, explorer, dashboard | `ba7729e`, `8ab2870` |
| **Audit** | 54/77 nálezů opraveno, skóre 5/10 → ~8.5/10 | `50d3739`..`85eae85` |
| **Monitoring** | Prometheus + Grafana + 15 alert rules | `deploy-monitoring.sh` |
| **Legal** | 6/6 právních dokumentů + web footer disclaimer | ✅ |
| **L2-L4 Skeleton** | 6 nových crate, všechny kompilují | `c46228b`, `d06e4db` |
| **wZION Bridge** | Solidity + Rust relay, 71 + 95 testů | `86c9f45`, `b9d1967` |
| **WARP tests** | 215 → 192 testů (po refaktoru) | `d4d73c4` |
| **Revenue Plan** | Docker Compose, 3 deploy skripty | `a007a80` |
| **README L2-L4** | 7 nových README.md dokumentací | `402a7e0` |
| **CI/CD** | 4 GitHub Actions (ci, audit, release, dependabot) | `.github/workflows/` |

---

## 🔴 Co CHYBÍ do MainNetu

### 🔴 P0 — BLOKUJÍCÍ (musí být hotovo před MainNet)

| # | Úkol | Fáze | Odhad | Stav | Detail |
|---|------|------|-------|------|--------|
| **B1** | 14 dní bez critical bugu | 1.x | countdown | 🔄 | Od 16.2. → cíl 2.3.2026 |
| **B2** | Orphan rate formální metrika | 1.x | 1 den | 🔄 | Reorg rate je nízký, potřeba formální tracking |
| **B3** | 5+ seed nodů (EU 2, USA 1, Asia 2) | 3.1 | 2 týdny | ⬜ | Máme 2 (Helsinki + Germany), chybí 3+ |
| **B4** | Premine adresy — reálné bech32 klíče | 4.1 | 1 den | ⬜ | Aktuálně placeholder, nutná HSM/air-gapped generace |
| **B5** | Genesis block test (premine verifikace) | 4.1 | 2 dny | ⬜ | Na staging env s reálnými adresami |
| **B6** | 7-day stability run (dress rehearsal) | 4.1 | 7+ dní | ⬜ | Na staging s mainnet configem |
| **B7** | External security audit | 4.2 | 4-6 týdnů | ⬜ | Trail of Bits / OtterSec / Halborn |
| **B8** | Code freeze + tag `v2.9.6-mainnet` | 4.3 | 1 den | ⬜ | Po auditu |
| **B9** | Binární releasy (Linux, macOS, Win) | 4.3 | 2 dny | ⬜ | CI release workflow existuje, chybí Windows target |
| **B10** | SHA-256 hash + reproducible builds | 4.3 | 3 dny | ⬜ | SHA-256 v CI ✅, reproducibility ⬜ |
| **B11** | Genesis block — offline vytvoření | 5 | 1 den | ⬜ | Air-gapped, hash publikován |

### 🟡 P1 — DŮLEŽITÉ (silně doporučeno)

| # | Úkol | Fáze | Odhad | Stav | Detail |
|---|------|------|-------|------|--------|
| **I1** | DDoS ochrana seed nodů | 3.1 | 2 dny | ⬜ | Firewall rules, rate limiting na infra úrovni |
| **I2** | LMDB backup strategie | 3.1 | 1 den | ⬜ | Snapshot skript + offsite záloha |
| **I3** | Docker images na Docker Hub / GHCR | 3.2 | 1 den | ⬜ | Dockerfile existují, chybí push workflow |
| **I4** | Node setup guide pro burzy | 3.4 | 2 dny | ⬜ | Integrace specifická dokumentace |
| **I5** | Whitepaper PDF pro CMC/CoinGecko | 3.4 | 1 den | ⬜ | MD existuje (4,508 řádků), potřeba PDF export |
| **I6** | Logo pack SVG/PNG všechny rozměry | 3.4 | 1 den | ⬜ | Loga existují, chybí standardizovaný pack |
| **I7** | Bug bounty program | 4.2 | 3 dny | ⬜ | Setup + policy + rewards |
| **I8** | Communication guidelines | 3.3 | 1 den | ⬜ | Chybí jediný legal doc |
| **I9** | 1000 miners load test | 4.1 | 2 dny | ⬜ | 60 miners ✅, 1000 = škálování skriptu |
| **I10** | Disaster recovery test (50% nodů pád) | 4.1 | 1 den | ⬜ | Partition test ✅, disaster = větší scope |
| **I11** | Pool testy — zvýšit z 31 na 60+ | — | 3 dny | ⬜ | Pool má nejnižší test hustotu |
| **I12** | Windows binární build + test | 4.3 | 2 dny | ⬜ | CI nemá Windows target |

### 🟢 P2 — NICE-TO-HAVE (post-mainnet OK)

| # | Úkol | Target | Detail |
|---|------|--------|--------|
| N1 | wZION ERC-20 deploy na Base/Arbitrum | 6B | Kontrakty + testy hotovy, potřeba deploy |
| N2 | Bridge backend (ZION L1 ↔ wZION) | 6B | Rust relay 71 testů, potřeba produkční deploy |
| N3 | Uniswap pool (wZION/ETH) | 6B | Po bridge deploy |
| N4 | DAO governance v1 activation | 6E | Skeleton 1,549 LOC, potřeba testy + audit |
| N5 | Revenue mining deploy (DERO+ZEPH+EPIC) | revenue | Docker compose ready, potřeba wallets |
| N6 | CMC / CoinGecko listing | 6C | Po DEX + volume |
| N7 | Tier-3 CEX outreach (MEXC, XT) | 6D | Po CG/CMC listing |

---

## 🏗️ Layer Architecture

```
╔══════════════════════════════════════════════════════════════════════╗
║                 ZION TERRANOVA — 6-LAYER STACK                      ║
║                     "On the Star" Vision                            ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  L6  🔭 ZION ISSOBELLA       (vize)    Earth Orbit        [2040+]  ║
║      └── Orbitální stanice, vědecká observatoř, vesmírný výzkum      ║
║                          ▲                                           ║
║  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ║
║                          │                                           ║
║  L5  🌍 ZION FREE WORLD  (vize)    Save Planet         [2030]     ║
║      └── Kvantový motor, humanitární mise, svobodné komunity         ║
║                          ▲                                           ║
║  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ║
║                          │                                           ║
║  L4  🎮 ZION OASIS           L4/oasis/    2,335 LOC  39 testů  [2029+]║
║      ├── UE5 open-world (consciousness mining as gameplay)           ║
║      ├── XP / Consciousness Level (9 Kabbalah Sefira, offchain)      ║
║      ├── Guildy, territory wars, challenges                          ║
║      └── 4.95B reward pool (3 sloty × 1.65B, 10-letá distribuce;     ║
║          Slots 4 & 5 → L5 Free World Projects — 3.3B ZION)          ║
║                          ▲                                           ║
║  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ║
║                          │                                           ║
║  L3  🧠 WARP             L3/warp/     4,859 LOC  192 testů [2027 Q3+] ║
║      🧠 NCL              L3/ncl/      1,034 LOC    9 testů             ║
║      🤖 AI-Native        L3/ai-native/  752 LOC    5 testů             ║
║      ├── 7 chain families (EVM/Solana/Tron/Stellar/Cardano/Cosmos)   ║
║      ├── NCL task marketplace (6 typů, 4 backendy, 70/20/10 split)   ║
║      └── AI Agent SDK (9 consciousness levels, async plugin trait)    ║
║                          ▲                                           ║
║  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ║
║                          │                                           ║
║  L2  🌉 Bridge           L2/bridge/   2,663 LOC   71 testů [2027 Q1]  ║
║      📜 Contracts         L2/contracts/  686 LOC   95 testů             ║
║      🏛️ DAO              L2/dao/      1,549 LOC   18 testů             ║
║      ├── wZION ERC-20 + ZIONBridge.sol (Hardhat, Base/Arbitrum)      ║
║      ├── Rust relay (8 modulů, decimal ×1e12, validator consensus)   ║
║      └── DAO Governance (treasury 4B, voting, 7 humanitarian cats)   ║
║                          ▲                                           ║
║  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ║
║                          │                                           ║
║  L1  ⛓️ BLOCKCHAIN       L1/core/    16,202 LOC  419 testů  [2026] ←  ║
║      ⛏️ POOL             L1/pool/    14,441 LOC   31 testů    ZDE     ║
║      🔐 COSMIC HARMONY   L1/c-h/     12,421 LOC   46 testů             ║
║      ⛏️ MINER            L1/miner/   10,233 LOC   20 testů             ║
║      ├── PoW Cosmic Harmony v3 — ASIC-resistant (memory-hard)        ║
║      ├── UTXO + Ed25519, 5,400.067 ZION/block, LWMA DAA             ║
║      ├── Mining pool (Stratum v2, PPLNS, multi-algo revenue)         ║
║      └── P2P síť, IBD, reorg, fee burning, 100 coinbase maturity    ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝

PRAVIDLA:
• L1 NIKDY neimportuje L2+ (žádný `use zion_dao::*` v core/)
• Komunikace přes TX memo: DAO:vote:42:yes, TITHE:Water:500:addr
• Dependency: L4→L3→L2→L1 (nikdy obráceně)
• L5/L6 jsou off-chain vize — financovány přes L1 tithe + L5/L6 fond
• L5 governance přes L3 DAO, data přes L2 NCL
• Každý crate kompiluje samostatně: cargo check -p zion-xxx
```

| Layer | Crates | LOC | Testů | Readiness |
|-------|--------|-----|-------|-----------|
| **L1** ⛓️ | L1/core, L1/pool, L1/cosmic-harmony, L1/miner | 53,297 | 516 | **~94%** |
| **L2** 💱 | L2/bridge, L2/contracts, L2/dao | 4,898 | 184 | **~25%** |
| **L3** 🧠 | L3/warp, L3/ncl, L3/ai-native | 6,645 | 206 | **~15%** |
| **L4** 🎮 | L4/oasis | 2,335 | 39 | **~10%** |
| **L5** 🌍 | *(vize — off-chain)* | — | — | 📋 Vize dokumentace |
| **L6** 🔭 | *(vize — 2040+)* | — | — | 📋 Vize dokumentace |
| **CELKEM** | **11 crates + 2 vize** | **67,175** | **945** | L1 ✅ / L2-L4 skeleton / L5-L6 vize |

---

## 🔒 MainNet Constitution (zmrazené parametry)

| Parametr | Hodnota | Zdroj |
|----------|---------|-------|
| Chain ID | `zion-mainnet-1` | `config/mainnet.toml` |
| Total Supply | 144,000,000,000 ZION | 🔒 |
| Mining Supply | 127,720,000,000 ZION | 🔒 |
| Genesis Premine | 16,280,000,000 ZION | 🔒 |
| Block Reward | 5,400.067 ZION (konstantní, žádný halving) | 🔒 |
| Block Time | 60 sekund | 🔒 |
| DAA | LWMA (60 bloků, ±25%) | 🔒 |
| Max Reorg | 10 bloků (testnet: 50) | 🔒 |
| Soft Finality | 60 bloků | 🔒 |
| Coinbase Maturity | 100 bloků | 🔒 |
| Consensus | PoW — Cosmic Harmony v3 | 🔒 |
| Halving | ❌ ŽÁDNÝ | 🔒 |
| Presale | ❌ NEEXISTUJE | 🔒 |
| Atomic Units | 1 ZION = 1,000,000 atomic | 🔒 |
| Mining Horizon | 23,652,000 bloků (~45 let) | 🔒 |
| Fee Policy | **Burn** (100% zničeno) | 🔒 |
| Max Peers | 128 (96 in / 32 out) | `mainnet.toml` |
| Storage | LMDB, max 100 GB | `mainnet.toml` |

### Genesis Premine — 16.28B ZION

| Kategorie | ZION | Podíl | Lock |
|-----------|------|-------|------|
| ZION OASIS + Winners Golden Egg/XP | 4,950,000,000 | 29.5% | Okamžitě |
| L5 Free World Projects | 3,300,000,000 | 19.7% | Okamžitě |
| DAO Treasury | 4,000,000,000 | 24.6% | Okamžitě |
| Infrastructure & Dev | 2,500,000,000 | 15.4% | Okamžitě |
| Humanitarian Fund | 1,530,000,000 | 9.4% | Okamžitě |

---

## 🗺️ L1 Roadmap — Fáze 0–5

### Fáze 0 — Spec Freeze ✅ (únor 2026)

6 sprintů, 155 testů. Základ blockchainu — emission, DAA, fee burning, wallet. **COMPLETE.**

### Fáze 1 — Hardened TestNet ✅ (únor 2026)

12 sprintů, 249 testů + live testy. Network hardening, security, IBD, pool payout, stress test. **COMPLETE** (2 exit criteria v monitoringu).

### Fáze 3 — Infrastructure & Legal (srpen–září 2026)

| Sprint | Obsah | Stav | Detail |
|--------|-------|------|--------|
| 3.1.1 | 5+ seed nodů | ⬜ | Máme 2, potřeba 3 další (USA, Asia) |
| 3.1.2 | Prometheus + Grafana | ✅ | 4 kontejnery, 2 dashboardy |
| 3.1.3 | Alert rules | ✅ | 15 pravidel ve 4 skupinách |
| 3.1.4 | Backup strategie | ⬜ | LMDB snapshots |
| 3.1.5 | DDoS ochrana | ⬜ | Firewall na seed nodech |
| 3.2.1 | docker-compose.mainnet.yml | ✅ | |
| 3.2.2 | Runbook | ✅ | |
| 3.2.3 | Docker images (Hub/GHCR) | ⬜ | Dockerfile hotové, chybí push |
| 3.2.4 | SHA-256 checksums | ✅ | V release.yml workflow |
| 3.2.5 | CI/CD pipeline | ✅ | 4 workflows (ci, audit, release, dependabot) |
| 3.3.1-7 | Legal docs | ✅ 6/7 | Chybí communication guidelines |
| 3.4.1 | Exchange node guide | ⬜ | |
| 3.4.2 | Whitepaper PDF | ⬜ | MD ready, potřeba PDF |
| 3.4.3 | wZION ERC-20 | ✅ kód | Kontrakty + 95 testů, deploy ⬜ |
| 3.4.4 | Bridge backend | ✅ kód | 71 Rust testů, deploy ⬜ |
| 3.4.5 | Logo pack | ⬜ | |
| 3.4.6 | Supply API | ✅ | Live |

**Progress: ~60% hotovo** (monitoring, CI/CD, legal, supply API)

### Fáze 4 — Dress Rehearsal (říjen–listopad 2026)

| Sprint | Obsah | Stav |
|--------|-------|------|
| 4.1.1 | Dress rehearsal chain (staging) | ⬜ |
| 4.1.2 | Genesis block test | ⬜ |
| 4.1.3 | 1000 miners load test | ⬜ |
| 4.1.4 | Disaster recovery | ⬜ |
| 4.1.5 | 168h (7-day) stability run | ⬜ |
| 4.2.1-5 | External security audit | ⬜ |
| 4.3.1 | Feature freeze | ⬜ |
| 4.3.2 | Code freeze + tag | ⬜ |
| 4.3.3 | Binary builds (Linux, macOS, Win) | ⬜ |
| 4.3.4 | Reproducible builds | ⬜ |
| 4.3.5 | SHA-256 publikace | ⬜ |

**Progress: 0%** — plánováno na říjen 2026

### Fáze 5 — MainNet Launch (prosinec 2026)

| Den | Aktivita |
|-----|----------|
| T-14 | Genesis freeze — parametry zmrazeny |
| T-10 | Seed nody deployed a synced |
| T-7 | Community announcement + wallety |
| T-5 | Wallet release (desktop + CLI) |
| T-3 | Mining guide publikován |
| T-2 | Final node software release |
| T-1 | Genesis block vytvořen OFFLINE (air-gapped) |
| **T-0** | **🚀 MAINNET GENESIS — 31. 12. 2026** |

---

## 🌐 L2-L4 Roadmap — Post-MainNet

### L2 — DEX & DeFi (2027 Q1–Q2)

| # | Komponenta | Crate | LOC | Testů | Target |
|---|-----------|-------|-----|-------|--------|
| L2.1 | Atomic Swaps (ZION ↔ BTC/ETH/XMR) | — | — | — | 2027 Q1 |
| L2.2 | wZION Bridge (EVM deploy) | `L2/bridge/` + `L2/contracts/` | 3,349 | 166 | 2027 Q1 |
| L2.3 | ZION DEX (on-chain AMM) | — | — | — | 2027 Q2 |
| L2.4 | Liquidity Mining | — | — | — | 2027 Q2 |
| L2.5 | DAO Governance v1 | `L2/dao/` | 1,549 | 18 | 2027 Q2 |

### L3 — Warp & AI Native (2027 Q3+)

| # | Komponenta | Crate | LOC | Testů | Target |
|---|-----------|-------|-----|-------|--------|
| L3.1 | NCL — AI task marketplace | `L3/ncl/` | 1,034 | 9 | 2027 Q3 |
| L3.2 | AI Orchestrátor | `L3/ai-native/` | 752 | 5 | 2027 Q3 |
| L3.3 | Warp Bridges (7 chains) | `L3/warp/` | 4,859 | 192 | 2027 Q4 |
| L3.4 | AI Native SDK | `L3/ai-native/` | — | — | 2028 Q1 |
| L3.5 | Compute Marketplace | `L3/ncl/` | — | — | 2028 Q1 |

### L4 — ZION Oasis (2029+)

| Milestone | Target | Stav |
|-----------|--------|------|
| L4-M0: OASIS Skeleton | 2026 Q1 | ✅ 2,335 LOC, 13 modulů |
| L4-M1: XP Service | 2029 Q1 | 🏗️ Skeleton |
| L4-M2: Consciousness Calculator | 2029 Q1 | 🏗️ Skeleton |
| L4-M3: Pool bonus (4.95B premine; Slots 4 & 5 → L5) | 2029 Q2 | 🏗️ Skeleton |
| L4-M4: Oasis UE5 prototyp | 2029 Q2 | ⬜ |
| L4-M5: Wallet integration | 2029 Q3 | ⬜ |
| L4-M6: Quest system + NPC AI | 2029 Q3 | 🏗️ Skeleton |
| L4-M7: Territory wars (PvP) | 2029 Q4 | 🏗️ Skeleton |
| L4-M8: NFT Marketplace | 2029 Q4 | ⬜ |
| L4-M9: Oasis public beta | 2030 Q1 | ⬜ |

---

## 🌍 L5-L6 Roadmap — Vize 2030+

> **Tyto vrstvy jsou zatím čistě vizionářské** — součást 6-vrstvé "On the Star" architektury
> definované v `docs/v2.9.6/layer-architecture.md`. Žádný kód zatím neexistuje.

### L5 — ZION Free World 🌍 (2030)

**Mise:** Zachránit planetu. Osvobodit energii. Posílit lidstvo.

| Milník | Rok | Popis |
|--------|-----|-------|
| L5-M0 | 2030 | Založení ZION Free World Foundation |
| L5-M1 | 2031 | První výzkumná laboratoř (kvantová energie) |
| L5-M2 | 2033 | Prototyp kvantového generátoru |
| L5-M3 | 2035 | Pilotní nasazení v 10 komunitách |
| L5-M4 | 2037 | Open-source release hardware specifikací |
| L5-M5 | 2040 | Masová produkce — energie pro miliony |

**Hlavní směry:**
- 🔬 Kvantový motor na volnou energii (R&D → open-source hardware)
- 🌱 Humanitární mise (čistá voda, vzdělávání, zdravotnictví)
- 🏘️ Svobodné komunity (energeticky nezávislé, permakultura)

**Financování:** Humanitarian Tithe (5% block reward) + L5/L6 Fund (5%) + DAO granty + L4 Oasis revenue

### L6 — ZION Issobella 🔭 (2040+)

**Mise:** Lidstvo na oběžné dráze. Věda bez hranic.
**Název:** ZION Issobella ✅ (schváleno)

| Milník | Rok | Popis |
|--------|-----|-------|
| L6-M0 | 2040 | Založení ZION Space Division |
| L6-M1 | 2042 | Design stanice ZION Issobella |
| L6-M2 | 2045 | Výroba komponent (L5 kvantová energie) |
| L6-M3 | 2048 | První modul na orbitě |
| L6-M4 | 2050 | Plně operační stanice |
| L6-M5 | 2055 | Rozšíření — 2. a 3. modul |

**Hlavní směry:**
- 🔭 Vědecká observatoř (astronomie, klimatický monitoring)
- 🛸 Výzkumné centrum (kvantový motor v mikrogravitaci, materiálový výzkum)
- 🌍 Symbol pro lidstvo (live-streamy z vesmíru, inspirace)

**Financování:** L5/L6 Fund + DAO Treasury + Tail emission (post-2126: 725 ZION/block navěky) + partnerství se space agencies

### Tok hodnoty L1 → L6

```
L1 Mining (5,400 ZION/block)
  ├── 90% → Miners
  ├── 5%  → Humanitarian Tithe → L5 Free World
  └── 5%  → L5/L6 Issobella Fund → L5 + L6
              │
              ├── L3 DAO governance rozhoduje o alokaci
              ├── L4 Oasis revenue doplňuje fondy
              ├── L5 Free World výnosy (kvantová energie) → L6
              └── Tail emission (post-2126) → L6 long-term
```

> 📋 Kompletní specifikace: `docs/v2.9.6/layer-architecture.md` | `L5/README.md` | `L6/README.md`

---

## 📅 Master Timeline

```
2026                              2027                             2028-2030+
Q1    Q2    Q3    Q4     Q1    Q2    Q3    Q4     Q1    ...   Q1+
╔═══════════════════════╗
║ L1 BLOCKCHAIN          ║
║ F0 ✅ F1 ✅            ║
║      F2 ✅  F3   F4   ║──▶ 🚀 MainNet 31.12.
╚═══════════════════════╝
                          ╔═══════════════╗
                          ║ L2 DEX/DeFi   ║
                          ║ wZION → DEX   ║
                          ╚═══════════════╝
                                    ╔═══════════════╗
                                    ║ L3 WARP & AI  ║
                                    ║ NCL → SDK     ║
                                    ╚═══════════════╝
                                                       ╔═══════════════════╗
                                                       ║ L4 OASIS         ║
                                                       ║ UE5 → Beta 2030  ║
                                                       ╚═══════════════════╝

2030                              2033                             2040+
╔═══════════════════════════════════════════════════════════════════════╗
║ L5 🌍 ZION FREE WORLD — Save Planet Earth                            ║
║ Foundation → Lab → Prototype → Pilot (10 communities) → Mass prod.  ║
╚═══════════════════════════════════════════════════════════════════════╝
                                                       ╔══════════════════════╗
                                                       ║ L6 🔭 ZION ISSOBELLA ║
                                                       ║ Design → Build →     ║
                                                       ║ Orbit 2048 → Op 2050║
                                                       ╚══════════════════════╝

L1 Detail:
ÚNO      BŘE      DUB      KVĚ      ČER      ČEC      SRP      ZÁŘ      ŘÍJ      LIS      PRO
╔════════════════╗
║ F0 ✅ F1 ✅    ║ ← JSME ZDE (17. únor 2026)
╚════════════════╝
         ╔═══════════════════════╗
         ║  (buffer / hardening)  ║ ← margin pro bugy, testy
         ╚═══════════════════════╝
                                  ╔══════════════╗
                                  ║ F3 INFRA     ║
                                  ╚══════════════╝
                                                  ╔══════════════╗
                                                  ║ F4 REHEARSAL ║
                                                  ╚══════════════╝
                                                                  ╔════╗
                                                                  ║ 🚀║
                                                                  ╚════╝
```

---

## 🎯 Prioritní akční plán

### Teď (únor–březen 2026)

| # | Úkol | Priorita | Odhad |
|---|------|----------|-------|
| 1 | Počkat na 14-day bug-free window (do 2.3.) | 🔴 P0 | passive |
| 2 | Formalizovat orphan rate metriku | 🔴 P0 | 1 den |
| 3 | Deploy revenue mining (DERO/ZEPH/EPIC) | 🟢 | 1 den (wallets) |
| 4 | Pool test coverage zvýšit (31 → 60+) | 🟡 | 3 dny |
| 5 | Miner test coverage zvýšit (20 → 40+) | 🟡 | 2 dny |

### Q2 2026 (duben–červen) — Hardening & Infra

| # | Úkol | Priorita | Odhad |
|---|------|----------|-------|
| 6 | Pronájem 3 dalších seed nodů (USA, Asia ×2) | 🔴 P0 | 2 týdny |
| 7 | DDoS ochrana + firewall rules | 🟡 P1 | 2 dny |
| 8 | LMDB backup strategie + skript | 🟡 P1 | 1 den |
| 9 | Docker image push workflow (GHCR) | 🟡 P1 | 1 den |
| 10 | Communication guidelines (legal) | 🟡 P1 | 1 den |
| 11 | Whitepaper PDF export | 🟡 P1 | 1 den |
| 12 | Logo pack standardizace | 🟡 P1 | 1 den |

### Q3 2026 (červenec–září) — Pre-Audit

| # | Úkol | Priorita | Odhad |
|---|------|----------|-------|
| 13 | Exchange node setup guide | 🟡 P1 | 2 dny |
| 14 | External audit RFP odeslat | 🔴 P0 | 1 den |
| 15 | Bug bounty program setup | 🟡 P1 | 3 dny |
| 16 | Windows binary CI target | 🟡 P1 | 2 dny |
| 17 | Premine adresy — HSM/air-gapped generace | 🔴 P0 | 1 den |

### Q4 2026 (říjen–prosinec) — Dress Rehearsal & Launch

| # | Úkol | Priorita | Odhad |
|---|------|----------|-------|
| 18 | Dress rehearsal chain (staging env) | 🔴 P0 | 1 týden |
| 19 | Genesis block test + verifikace | 🔴 P0 | 2 dny |
| 20 | 1000 miners load test | 🔴 P0 | 2 dny |
| 21 | Disaster recovery test | 🔴 P0 | 1 den |
| 22 | 168h (7-day) stability run | 🔴 P0 | 7+ dní |
| 23 | Security audit — průběh + opravy | 🔴 P0 | 4-6 týdnů |
| 24 | Code freeze + tag `v2.9.6-mainnet` | 🔴 P0 | 1 den |
| 25 | Binary builds + SHA-256 publikace | 🔴 P0 | 2 dny |
| 26 | 🚀 **MAINNET GENESIS** | 🔴 | **31. 12. 2026** |

---

## 📊 Celkový progress

```
L1 MainNet Readiness:

Fáze 0  ████████████████████ 100%  ✅ Spec Freeze
Fáze 1  ██████████████████░░  92%  ✅ TestNet (2 exit criteria monitoring)
Fáze 2  ████████████████████ 100%  ✅ Node UX & Mining
Fáze 3  ████████████░░░░░░░░  60%  🔄 Infra (monitoring ✅, seed nody ⬜)
Fáze 4  ░░░░░░░░░░░░░░░░░░░░   0%  ⬜ Dress Rehearsal (Q4)
Fáze 5  ░░░░░░░░░░░░░░░░░░░░   0%  ⬜ MainNet Launch (prosinec)

Overall: ████████████████░░░░ ~72%
```

### Rizika

| Riziko | Dopad | Mitigace |
|--------|-------|----------|
| External audit se protáhne | Launch delay | RFP odeslat brzy (Q3), mít backup auditora |
| Critical bug v 14-day window | Reset countdown | Máme 10 měsíců buffer |
| Nedostatek seed nodů | Centralizace | Komunita + pronájem cloud VPS |
| Premine key kompromitace | Katastrofální | HSM + multi-sig + air-gapped |

---

## 📚 Referenční dokumenty

| Dokument | Popis |
|----------|-------|
| `ROADMAP.md` | Originální roadmapa (historická reference) |
| `docs/L1-L4_ROADMAP.md` | L2-L4 layer roadmap (historická reference) |
| `REPORT.md` | Session report (4,240 řádků, chronologické záznamy) |
| `docs/REVENUE_PLAN.md` | Revenue monetizace serverů |
| `docs/reports/WORK_REPORT_16_FEB_2026_PHASE1_EXIT.md` | Phase 1 exit test výsledky |
| `config/mainnet.toml` | MainNet konfigurace (autoritativní) |
| `config/testnet.toml` | TestNet konfigurace |
| `docs/v2.9.6/layer-architecture.md` | 6-vrstvá "On the Star" architektura (v2.9.6) |
| `L5/README.md` | L5 ZION Free World — vize 2030 |
| `L6/README.md` | L6 ZION Issobella — vize 2040+ |

---

*Generováno: 17. února 2026 | Chain height: Helsinki 3169, Germany 3148 | 945 testů, 67k LOC Rust | Repo: L1–L6 složky*
