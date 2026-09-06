# ✅ ZION TerraNova — MainNet Launch Checklist

> **Cíl:** MainNet Genesis **31. prosince 2026**  
> **Dokument:** Operační go/no-go checklist — aktualizuje se průběžně  
> **Zdroj pravdy:** Sjednocuje `ROADMAP.md` Fáze 1-5 + `docs/MAINNET_READINESS-ROADMAP.md`  
> **Poslední aktualizace:** 17. února 2026

---

## 🔴 STAV: 72% ready | 11 blokerů | 12 důležitých | cíl 31.12.2026

```
CELKOVÝ PROGRESS:

P0 BLOKERY    ████████░░░░░░░░░░░░  3/14 hotovo (21%)
P1 DŮLEŽITÉ   ██████████░░░░░░░░░░  6/18 hotovo (33%)
P2 NICE       ██░░░░░░░░░░░░░░░░░░  1/7  hotovo (14%)
SECURITY      ██████████████░░░░░░  14/19 hotovo (74%)

L1 kód:       ██████████████████░░  ~94% ready
Infra:        ████████████░░░░░░░░  ~60% ready
Audit:        ░░░░░░░░░░░░░░░░░░░░   0% (Q3-Q4)
Launch:       ░░░░░░░░░░░░░░░░░░░░   0% (Q4)
```

---

## 📋 P0 — BLOKUJÍCÍ (bez těchto NESPOUŠTÍME MainNet)

### Fáze 1 — Exit Criteria (únor–březen 2026)

| # | Úkol | Odhad | Deadline | Stav | Poznámka |
|---|------|-------|----------|------|----------|
| **P0-01** | 14 dní bez critical bugu | passive | 2. března 2026 | 🔄 countdown | Od 16.2. — jakýkoli critical bug resetuje |
| **P0-02** | Orphan rate < 2% formální metrika | 1 den | březen 2026 | ⬜ | Reorg rate je nízký, potřeba Prometheus metrika |
| **P0-03** | 72h stability run (2 nody, nepřetržitě) | 72h+ | březen 2026 | 🔄 běží | Restart #3, od 10.2. 23:59 UTC |

**Co je potřeba udělat pro P0-02:**
```
1. Přidat do pool/src/metrics.rs:
   - counter: orphan_blocks_total
   - counter: total_blocks_mined
   - gauge: orphan_rate_percent = orphan/total × 100
2. Prometheus scrape (už běží, jen přidat metriky)
3. Grafana dashboard — nový panel "Orphan Rate"
4. Alert rule: orphan_rate > 2% → fire
5. 7 dní sledování → formální zápis výsledku
```

**Co je potřeba udělat pro P0-03:**
```
1. Oba servery (Helsinki + Germany) musí běžet 72h+ bez restartu
2. Žádný crash, žádný panic, žádný OOM
3. Blockchain výška roste normálně (~1440 bloků/den)
4. P2P synchronizace funguje (obě strany converge)
5. Po dokončení zapsat: datum, výšky, uptime, výsledek
```

### Fáze 3 — Infrastruktura (Q2-Q3 2026)

| # | Úkol | Odhad | Deadline | Stav | Poznámka |
|---|------|-------|----------|------|----------|
| **P0-04** | 5+ seed nodů (EU 2, USA 2, Asia 1) | 2 týdny | srpen 2026 | ✅ | Aktivní: Helsinki, SeedDE, Usa1, Usa2, Asia3 |
| **P0-05** | Premine adresy — reálné bech32 klíče | 1 den | září 2026 | ⬜ | HSM/air-gapped generace, NIKDY online |
| **P0-06** | RPC autentizace (API key pro write endpointy) | 2 dny | září 2026 | ⬜ | Ochrana před neautorizovaným submitTx |

**Seed nodů plán:**
```
Uzel 1: Helsinki 🇫🇮   77.42.31.72       ✅ BĚŽÍ
Uzel 2: SeedDE 🇩🇪     46.225.126.243    ✅ BĚŽÍ
Uzel 3: Usa1 🇺🇸       5.78.178.227      ✅ BĚŽÍ
Uzel 4: Usa2 🇺🇸       178.156.240.160   ✅ BĚŽÍ
Uzel 5: Asia3 🌏       5.223.43.93       ✅ BĚŽÍ
Cíl: minimálně 5 seed nodů ve 3 regionech (EU, NA, Asia) — SPLNĚNO
Další krok: DNS seed1-3 + health-check automatizace
```

**Premine klíče — postup:**
```
1. Air-gapped laptop (nikdy připojený k internetu)
2. Vygenerovat 4× Ed25519 keypair (jeden pro každou premine kategorii)
3. Zapsat bech32 adresy → config/mainnet.toml genesis_premine
4. Private keys → 2× offline záloha (papír + encrypted USB)
5. Žádný private key NIKDY na online stroji
6. Testovat na testnet s identickým kódem
```

### Fáze 4 — Dress Rehearsal (Q4 2026)

| # | Úkol | Odhad | Deadline | Stav | Poznámka |
|---|------|-------|----------|------|----------|
| **P0-07** | Genesis block test (staging, reálné premine adresy) | 2 dny | říjen 2026 | ⬜ | Ověřit 16.78B premine správně rozděleno |
| **P0-08** | 168h (7-day) stability run na staging s mainnet configem | 7+ dní | říjen 2026 | ⬜ | Mainnet config, 5+ nodů, reálný mining |
| **P0-09** | 1000 miners load test | 2 dny | říjen 2026 | ⬜ | 60 ✅, potřeba škálovat skript |
| **P0-10** | Disaster recovery test (pád 50% nodů) | 1 den | říjen 2026 | ⬜ | Partition test ✅, disaster = větší scope |
| **P0-11** | External security audit — žádný critical/high otevřený | 4-6 týdnů | listopad 2026 | ⬜ | Trail of Bits / OtterSec / Halborn |
| **P0-12** | Code freeze + tag `v2.9.6-mainnet` | 1 den | listopad 2026 | ⬜ | Po auditu, žádné další změny |
| **P0-13** | Binární releasy (Linux x86_64, macOS arm64, Windows x86_64) | 2 dny | prosinec 2026 | ⬜ | CI release workflow existuje, chybí Win target |
| **P0-14** | Genesis block — offline vytvoření + SHA-256 publikace | 1 den | prosinec 2026 | ⬜ | Air-gapped, hash zveřejněn komunity |

---

## 🟡 P1 — DŮLEŽITÉ (silně doporučeno před / při launchi)

### Bezpečnost & Hardening

| # | Úkol | Odhad | Stav | Poznámka |
|---|------|-------|------|----------|
| **P1-01** | Block size limit (max 1 MB) | 1 den | ⬜ | Ochrana proti block stuffing |
| **P1-02** | TX size limit (max 100 KB) | 0.5 dne | ⬜ | Ochrana proti giant TX |
| **P1-03** | Peer limit enforcement (96 in / 32 out) | 0.5 dne | ⬜ | Config existuje, potřeba enforce |
| **P1-04** | DDoS ochrana seed nodů (firewall, rate-limit) | 2 dny | ⬜ | iptables / fail2ban / cloudflare |
| **P1-05** | LMDB backup strategie + offsite záloha | 1 den | ⬜ | Snapshot cron → S3/B2 |
| **P1-06** | Bug bounty program | 3 dny | ⬜ | Setup + policy + rewards tabulka |

### Test Coverage

| # | Úkol | Odhad | Stav | Poznámka |
|---|------|-------|------|----------|
| **P1-07** | Pool testy zvýšit: 31 → 60+ | 3 dny | ⬜ | Pool má nejnižší test hustotu (1/466 LOC) |
| **P1-08** | Miner testy zvýšit: 20 → 40+ | 2 dny | ⬜ | Miner 1/512 LOC |
| **P1-09** | Cosmic Harmony testy zvýšit: 46 → 70+ | 2 dny | ⬜ | CHv3 1/270 LOC |

### Infrastruktura & Deploy

| # | Úkol | Odhad | Stav | Poznámka |
|---|------|-------|------|----------|
| **P1-10** | Docker images na GHCR (push workflow) | 1 den | ⬜ | Dockerfile existují |
| **P1-11** | Reproducible builds (deterministic) | 3 dny | ⬜ | SHA-256 v CI ✅, reproducibility ⬜ |
| **P1-12** | Windows binary build + test | 2 dny | ⬜ | CI nemá Windows target |

### Dokumentace & Legal

| # | Úkol | Odhad | Stav | Poznámka |
|---|------|-------|------|----------|
| **P1-13** | Node setup guide pro burzy | 2 dny | ⬜ | Integrace-specifická dokumentace |
| **P1-14** | Whitepaper PDF export | 1 den | ⬜ | MD existuje (4,508 řádků) |
| **P1-15** | Logo pack SVG/PNG standardizovaný | 1 den | ⬜ | Loga existují, chybí pack |
| **P1-16** | Communication guidelines | 1 den | ⬜ | Jediný chybějící legal doc |

### Monitoring & Alerting (rozšíření)

| # | Úkol | Odhad | Stav | Poznámka |
|---|------|-------|------|----------|
| **P1-17** | Orphan rate Grafana panel | 0.5 dne | ⬜ | Závisí na P0-02 |
| **P1-18** | Chain height divergence alert | 0.5 dne | ⬜ | Pokud Helsinki vs Germany > 5 bloků |

---

## 🟢 P2 — NICE-TO-HAVE (post-mainnet OK)

| # | Úkol | Target | Stav | Poznámka |
|---|------|--------|------|----------|
| **P2-01** | wZION ERC-20 deploy (Base/Arbitrum) | 2027 Q1 | ⬜ | Kontrakty + 95 testů hotovy |
| **P2-02** | Bridge backend produkční deploy | 2027 Q1 | ⬜ | 71 Rust testů hotovo |
| **P2-03** | Uniswap pool (wZION/ETH) | 2027 Q1 | ⬜ | Po bridge deploy |
| **P2-04** | DAO governance v1 activation | 2027 Q2 | ⬜ | Skeleton 1,549 LOC |
| **P2-05** | Revenue mining deploy (DERO+ZEPH+EPIC) | kdykoliv | ⬜ | Docker ready, potřeba wallets |
| **P2-06** | CMC / CoinGecko listing | 2027 Q1 | ⬜ | Po DEX + volume |
| **P2-07** | Tier-3 CEX outreach | 2027 Q2 | ⬜ | Po CG/CMC listing |

---

## 🛡️ Security Checklist

### ✅ Hotovo (14/19)

- [x] Ed25519 signature verification
- [x] Double-spend ochrana (mempool + UTXO)
- [x] Overflow ochrana (checked_add/checked_mul)
- [x] P2P rate limiting (200 msgs/peer/60s, escalating bans)
- [x] Coinbase maturity 100 bloků
- [x] Reorg limit 10 bloků
- [x] Timestamp validace ±120s
- [x] Mempool limits (50k TX, min fee, eviction)
- [x] P2P fork detection + automatic reorg (`1b9f266`)
- [x] credit_balance za feature flag (`0614770`)
- [x] Reorg serializace — reorg_lock + AtomicBool (`b63cb4b`)
- [x] is_stronger_chain anti-fork heuristika (`c719995`)
- [x] VarDiff deadlock fix (`4688b6e`)
- [x] Pool accept loop deadlock fix (`4941769`)

### ⬜ Zbývá (5/19)

- [ ] **RPC autentizace** — API key pro write endpointy (submitTx, submitBlock)
- [ ] **Block size limit** — max 1 MB hard limit
- [ ] **TX size limit** — max 100 KB hard limit
- [ ] **Peer limit enforcement** — 96 inbound / 32 outbound
- [ ] **External security audit** — nezávislý třetí strana

---

## 📅 Operační timeline — Co kdy dělat

### TEĎ → březen 2026 (passive monitoring + quick wins)

```
TÝDEN 1-2 (17.2. – 2.3.):
  ├── 🔄 P0-01: Čekat na 14-day bug-free window (do 2.3.)
  ├── 🔄 P0-03: 72h stability run (monitorovat)
  ├── ⬜ P0-02: Implementovat orphan rate metriku (1 den)
  └── ⬜ P1-17: Orphan rate Grafana panel (0.5 dne)

TÝDEN 3-6 (březen):
  ├── ⬜ P1-01: Block size limit 1 MB (1 den)
  ├── ⬜ P1-02: TX size limit 100 KB (0.5 dne)
  ├── ⬜ P1-03: Peer limit enforcement (0.5 dne)
  ├── ⬜ P0-06: RPC autentizace (2 dny)
  └── ⬜ P1-18: Chain height divergence alert (0.5 dne)
```

### Q2 2026 (duben–červen) — Hardening & Infra

```
DUBEN:
  ├── ⬜ P1-07: Pool testy 31 → 60+ (3 dny)
  ├── ⬜ P1-08: Miner testy 20 → 40+ (2 dny)
  └── ⬜ P1-09: CH testy 46 → 70+ (2 dny)

KVĚTEN:
  ├── ⬜ P0-04: Pronájem 3 seed nodů (USA, Asia ×2)
  ├── ⬜ P1-04: DDoS ochrana seed nodů (2 dny)
  └── ⬜ P1-05: LMDB backup strategie (1 den)

ČERVEN:
  ├── ⬜ P1-10: Docker images GHCR push (1 den)
  ├── ⬜ P1-12: Windows binary CI target (2 dny)
  ├── ⬜ P1-16: Communication guidelines (1 den)
  └── ⬜ P1-14: Whitepaper PDF export (1 den)
```

### Q3 2026 (červenec–září) — Pre-Audit

```
ČERVENEC:
  ├── ⬜ P0-05: Premine adresy — HSM/air-gapped generace
  ├── ⬜ P1-13: Exchange node setup guide (2 dny)
  └── ⬜ P1-15: Logo pack standardizace (1 den)

SRPEN:
  ├── ⬜ P0-11: External audit RFP odeslat (1 den)
  ├── ⬜ P1-06: Bug bounty program setup (3 dny)
  └── ⬜ P1-11: Reproducible builds (3 dny)

ZÁŘÍ:
  └── 📋 Buffer / příprava na dress rehearsal
```

### Q4 2026 (říjen–prosinec) — Dress Rehearsal & Launch

```
ŘÍJEN:
  ├── ⬜ P0-07: Genesis block test na staging
  ├── ⬜ P0-08: 168h stability run (mainnet config)
  ├── ⬜ P0-09: 1000 miners load test
  └── ⬜ P0-10: Disaster recovery test

LISTOPAD:
  ├── ⬜ P0-11: Security audit — finalizace + opravy
  ├── ⬜ P0-12: Code freeze + tag v2.9.6-mainnet
  └── ⬜ P0-13: Binary builds (Linux, macOS, Windows)

PROSINEC:
  ├── T-14: Genesis freeze
  ├── T-10: Seed nody synced
  ├── T-7: Community announcement
  ├── T-5: Wallet release
  ├── T-3: Mining guide
  ├── T-2: Final software release
  ├── T-1: P0-14: Genesis block OFFLINE
  └── T-0: 🚀 MAINNET GENESIS — 31. 12. 2026
```

---

## ⚠️ Rizika & Mitigace

| # | Riziko | Dopad | Pravděpodobnost | Mitigace |
|---|--------|-------|----------------|----------|
| R1 | External audit se protáhne | Launch delay 1-3 měsíce | 🟡 Střední | RFP odeslat srpen, mít backup auditora |
| R2 | Critical bug v 14-day window | Reset countdown | 🟢 Nízká | Máme 10 měsíců buffer do launch |
| R3 | Nedostatek seed nodů | Centralizace, slow IBD | 🟡 Střední | Komunita + cloud VPS (Hetzner/Vultr) |
| R4 | Premine key kompromitace | Katastrofální | 🟢 Nízká | HSM + multi-sig + air-gapped |
| R5 | Windows build problémy | Menší audience | 🟡 Střední | Cross-compile CI + Windows test VM |
| R6 | Audit najde critical bug v konsensus | Major rework | 🟡 Střední | Interní audit 54 nálezů opraveno, kód mature |
| R7 | VPS provider výpadek (seed nody) | Dočasný izolace | 🟢 Nízká | Seed nody u 3+ providerů |

---

## 🏗️ Architektura L1 — co je LOCKED

```
L1/core/          16,202 LOC  419 testů  ✅ PRODUCTION
  ├── consensus/     emission, DAA (LWMA), fork-choice, coinbase maturity
  ├── mempool/       double-spend, fee burning, eviction, size limits
  ├── p2p/           peer discovery, IBD, reorg, rate-limiting, anti-fork
  ├── rpc/           JSON-RPC API (supply, health, metrics, peer, wallet)
  ├── wallet/        UTXO, Ed25519, broadcast, change address
  └── storage/       LMDB, block index, UTXO set

L1/pool/          14,441 LOC   31 testů  ✅ PRODUCTION
  ├── stratum/       Stratum v2 protocol, VarDiff, job distribution
  ├── payout/        PPLNS, batch TX, pool wallet
  ├── multi_mining/  per-miner groups (ZION+XMR+VRSC+ETC)
  └── metrics/       hashrate, shares, blocks, orphans

L1/cosmic-harmony/ 12,421 LOC  46 testů  ✅ PRODUCTION
  └── PoW algorithm  CHv3 — memory-hard, ASIC-resistant, CPU/GPU mining

L1/miner/         10,233 LOC   20 testů  ✅ PRODUCTION
  ├── cpu/           CPU mining (multi-threaded)
  ├── gpu/           Metal (Apple), OpenCL (AMD/NVIDIA)
  └── stratum/       Stratum client, pool connection, job handling
```

---

## 📊 Metriky pro GO/NO-GO rozhodnutí

Na konci každé fáze se kontrolují tyto metriky:

### Fáze 1 Exit (březen 2026)
| Metrika | Cíl | Aktuální | GO? |
|---------|-----|----------|-----|
| Stability run | 72h+ | 🔄 running | ⬜ |
| Orphan rate | < 2% | ~low (neformální) | ⬜ |
| Bug-free days | 14+ | countdown od 16.2. | ⬜ |
| Test count L1 | 300+ | 516 ✅ | ✅ |
| Compiler warnings | 0 | 0 ✅ | ✅ |

### Fáze 4 Exit (listopad 2026)
| Metrika | Cíl | Aktuální | GO? |
|---------|-----|----------|-----|
| Stability run | 168h+ | ⬜ | ⬜ |
| Load test | 1000 miners | 60 ✅ | ⬜ |
| Disaster recovery | 50% nodů pád → recovery | ⬜ | ⬜ |
| Security audit | 0 critical/high | ⬜ | ⬜ |
| Seed nodů | 5+ | 2 | ⬜ |
| Binary builds | 3 platformy | 2 (Linux, macOS) | ⬜ |

### Launch GO/NO-GO (prosinec 2026)
| Metrika | Cíl | GO? |
|---------|-----|-----|
| Všechny P0 hotovo | 14/14 | ⬜ |
| Security audit clean | 0 critical/high | ⬜ |
| Code freeze tag | v2.9.6-mainnet | ⬜ |
| Genesis block | offline vytvořen | ⬜ |
| Seed nody | 5+ online + synced | ⬜ |
| Binární releasy | 3 platformy + SHA-256 | ⬜ |
| Komunita informována | 7+ dní předem | ⬜ |

---

## 🔗 Reference

| Dokument | Účel |
|----------|------|
| [ROADMAP.md](../ROADMAP.md) | Hlavní roadmapa (L1-L6, ekonomický model) |
| [MAINNET_READINESS-ROADMAP.md](MAINNET_READINESS-ROADMAP.md) | Kompletní MainNet readiness + sprinty |
| [config/mainnet.toml](../config/mainnet.toml) | MainNet konfigurace (autoritativní) |
| [docs/v2.9.6/layer-architecture.md](v2.9.6/layer-architecture.md) | 6-vrstvá architektura |

---

*Generováno: 17. února 2026 | L1 readiness ~94% | 14 P0 blokerů (3 hotovo, 11 zbývá) | Cíl: 🚀 31.12.2026*
