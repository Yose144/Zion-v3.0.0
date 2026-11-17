# 📋 Publikační plán — `Zion-TerraNova/2.9.6`

> **Datum:** 13. února 2026  
> **Aktualizace:** 12. března 2026  
> **Cílový repo:** https://github.com/Zion-TerraNova/2.9.6  
> **Zdrojový repo (private):** `Yose144/2.9.6`

---

## 🎯 Cíl

Zveřejnit čistou verzi ZION TerraNova v2.9.6 jako workspace baseline pro současnou release větev 2.9.8. Rust node, miner, pool, mining algoritmus, dokumentace. **Žádné privátní klíče, hesla, IP adresy serverů, SSH přístupy, ani interní ops skripty.**

---

## 🟢 PUBLIKOVAT

### Rust Workspace (jádro projektu)

| # | Složka / Soubor | Obsah | Stav |
|---|----------------|-------|------|
| 1 | `Cargo.toml` (root) | Workspace definice — core, pool, miner, cosmic-harmony | ⚠️ Scrubovat `repository` URL |
| 2 | `Cargo.lock` | Závislosti | ✅ Čistý |
| 3 | `LICENSE` | MIT licence | ✅ Čistý |
| 4 | `core/` celý | Blockchain node — P2P, RPC, mempool, UTXO, wallet, state, storage, crypto | ⚠️ Scrubovat IP v `p2p/mod.rs` (H1) |
| 5 | `core/tests/` | chain_consensus, config_validation, genesis_verification, IBD, payout, stress suite | ⚠️ Scrubovat IP v testech (H3, H4) |
| 6 | `core/benches/` | chain, mempool, validation benchmarky | ✅ Čistý |
| 7 | `cosmic-harmony/` celý | Cosmic Harmony v3 mining algoritmus — build.rs, engine, GPU, FFI, NCL | ⚠️ Scrubovat wallet adresy v `profit_router.rs` (C1, C2, M1) |
| 8 | `cosmic-harmony/benches/` | Benchmarky algoritmu | ✅ Čistý |
| 9 | `miner/` celý | Stratum klient, miner logika, consciousness, NCL, telemetry | ⚠️ Scrubovat IP v `config.rs` (H2) |
| 10 | `pool/` celý | Stratum server, PPLNS, payout, vardiff, metrics, buyback, revenue | ⚠️ Scrubovat wallet v `config.rs` (C3) + PG creds v `payout/` (H5) |
| 11 | `pool/benches/` | Pool benchmarky | ✅ Čistý |

### Konfigurace

| # | Soubor | Obsah | Stav |
|---|--------|-------|------|
| 12 | `config/mainnet.toml` | Mainnet config — používá DNS jména (`seed1.zionterranova.com`) | ✅ Čistý |
| 13 | `config/devnet.toml` | Devnet config — localhost | ✅ Čistý |

### Docker

| # | Soubor | Obsah | Stav |
|---|--------|-------|------|
| 14 | `docker/Dockerfile.core` | Core node image | ✅ Čistý |
| 15 | `docker/Dockerfile.miner` | Miner image | ✅ Čistý |
| 16 | `docker/Dockerfile.pool` | Pool image | ✅ Čistý |
| 17 | `docker/docker-compose.mainnet.yml` | Mainnet compose | ⚠️ Ověřit env vars |

### Legal

| # | Soubor | Obsah | Stav |
|---|--------|-------|------|
| 18 | `legal/DISCLAIMER.md` | Právní vyloučení odpovědnosti | ✅ Čistý |
| 19 | `legal/TOKEN_NOT_SECURITY.md` | Token není cenný papír | ✅ Čistý |
| 20 | `legal/RISK_DISCLOSURE.md` | Upozornění na rizika | ✅ Čistý |
| 21 | `legal/PREMINE_DISCLOSURE.md` | Transparentnost premine | ✅ Čistý |
| 22 | `legal/NO_INVESTMENT.md` | Nejde o investiční nabídku | ✅ Čistý |
| 23 | `legal/INFRASTRUCTURE_FUNDING.md` | Financování infrastruktury | ✅ Čistý |
| 24 | `legal/README.md` | Přehled legal dokumentů | ✅ Čistý |

### Dokumentace

| # | Soubor | Obsah | Stav |
|---|--------|-------|------|
| 25 | `docs/whitepaper/` (12 souborů) | Whitepaper v10 kapitolách + full.md | ⚠️ Scrubovat IP v `full.md` a `02_TECHNICAL_ARCHITECTURE.md` |
| 26 | `docs/whitepaper-v2.9.5/` (12 souborů) | Whitepaper v2.9.5 verze | ⚠️ Scrubovat IP totéž |
| 27 | `docs/mainnet/phases/` (9 souborů) | PHASE_0 – PHASE_7 + README | ✅ Čistý (hesla jen v kódu wallet encryption) |
| 28 | `docs/mainnet/MAINNET_CONSTITUTION.md` | Mainnet ústava | ✅ Čistý |
| 29 | `docs/mainnet/README.md` | Přehled mainnet fází | ✅ Čistý |
| 30 | `docs/MAINNET_ROADMAP_2026.md` | Hlavní roadmapa 2026 | ✅ Čistý |

### Vybrané guides z `docs/2.9.5/` (čisté)

| # | Soubor | Obsah |
|---|--------|-------|
| 31 | `API_REFERENCE.md` | RPC API dokumentace |
| 32 | `BLOCKCHAIN_CORE_AUDIT.md` | Bezpečnostní audit kódu |
| 33 | `BUILD_SYSTEM.md` | Build systém |
| 34 | `CH3_MULTICHAIN_NATIVE_IMPLEMENTATION.md` | Cosmic Harmony multichain |
| 35 | `CH3_NATIVE_LIBS_PLAN.md` | Plán nativních knihoven |
| 36 | `CH3_UNIFIED_STATUS.md` | Status report |
| 37 | `COSMIC_HARMONY_V3_ROADMAP.md` | Roadmapa algoritmu |
| 38 | `LOAD_TESTING_GUIDE.md` | Load testing |
| 39 | `METRICS_GUIDE.md` | Metriky / monitoring |
| 40 | `MILESTONES_v2.9.5.md` | Milníky |
| 41 | `NATIVE_DEPLOYMENT_GAP_ANALYSIS.md` | Gap analýza |
| 42 | `NATIVE_LIBRARIES_OVERVIEW.md` | Přehled nativních knihoven |
| 43 | `NCL_CONTRACT_v1.0.md` | NCL smart contract spec |
| 44 | `POOL_ALGO_MANAGER_PROPOSAL.md` | Pool algo manager |
| 45 | `QUICKSTART.md` | Quick start guide |
| 46 | `REWRITE_GAPS_AND_MILESTONES_v2.9.5_2026-01-19.md` | Rewrite status |
| 47 | `Rust22.9.md` | Rust poznámky |
| 48 | `ZION_NCL_WHITEPAPER_v1.0.md` | NCL whitepaper |
| 49 | `E2E_TEST_REPORT.md` | E2E testy |
| 50 | `EXTERNAL_POOL_INTEGRATION.md` | Externí pool integrace |

### Root soubory

| # | Soubor | Obsah | Stav |
|---|--------|-------|------|
| 51 | `README.md` | Hlavní README | ⚠️ Nový — opravit URLs, badges |
| 52 | `QUICK_START.md` | Quick start | ⚠️ Scrubovat IP → DNS |
| 53 | `ROADMAP.md` | Roadmapa | ✅ Čistý |
| 54 | `PREMINE_ADDRESSES_PUBLIC.txt` | Veřejné premine adresy | ✅ Čistý (jen veřejné klíče) |
| 55 | `MAINNET_PREFLIGHT_CHECKLIST.md` | Mainnet checklist | ✅ Čistý |

---

## 🔴 NEPUBLIKOVAT

### 🔑 Kritické (privátní klíče, hesla)

| Soubor | Důvod |
|--------|-------|
| `PREMINE_WALLETS_BACKUP.json` | **Privátní klíče + seed fráze 16.78B ZION** — NIKDY nezveřejnit |
| `docker/.env.example` | Hardcoded seed peer IP |
| `config/testnet.toml` | Hardcoded IP jako seed peer |
| `config/ch3_revenue_settings.json` | BTC/XMR payout wallet adresy |

### 🌐 Infrastruktura (IP, SSH, deploy)

| Soubor / Složka | Důvod |
|-----------------|-------|
| `REPORT.md` | Interní session report s IPs |
| `AUDIT.md` | Interní audit |
| `AUDIT_SERVERS_2026-02-12.md` | Kompletní serverová mapa |
| `ops/runbook.md` | SSH příkazy, root přístup, infrastruktura |
| `scripts/` celý adresář | deploy-testnet.sh, collect_stats.sh, stability_monitor.sh — IPs, SSH klíče |
| `monitoring/` celý adresář | Prometheus targets s hardcoded IPs |
| `docker/docker-compose.testnet.yml` | Redis hesla, hardcoded IPs |
| `docker/docker-compose.monitoring.yml` | Monitoring s IPs |

### 📋 Interní docs (neveřejné)

| Soubor / Složka | Důvod |
|-----------------|-------|
| `ChV3.md` | Interní poznámky |
| `FIX.md` | Interní fix log |
| `PLAN_POOL_METRICS.md` | Interní plán |
| `docs/2.9.5/SERVERS_SSH.md` | **Kompletní SSH playbook všech serverů** |
| `docs/2.9.5/PRODUCTION_DEPLOYMENT.md` | Deploy skripty s IPs, hesly |
| `docs/2.9.5/PRODUCTION_DEPLOYMENT_POOL.md` | Pool deploy s POSTGRES_PASSWORD |
| `docs/2.9.5/DEPLOYMENT_GUIDE.md` | Deploy s IPs |
| `docs/2.9.5/P2P_BOOTSTRAP_GUIDE.md` | Seed peer IPs |
| `docs/2.9.5/VERIFY_USA_NATIVE_STACK_v2.9.5.md` | Server profil |
| `docs/2.9.5/TREE_OF_LIFE_SERVER.md` | Server profil |
| `docs/2.9.5/SESSION_SUMMARY_*.md` | Interní session logy |
| `docs/2.9.5/REPORT_2026-02-09.md` | Interní denní report |
| `docs/2.9.5/REAL_STATUS_v2.9.5.md` | Server status s IPs |
| `docs/2.9.5/DEEP_SCAN_REPORT_v2.9.5_2026-01-29.md` | Interní scan |
| `docs/2.9.5/ZivotniReset.md` | Osobní text |
| `docs/2.9.5/REWRITE_PLAN_v2.9.5.md` | Interní plán |
| `docs/2.9.5/MINING_GUIDE.md` | ⚠️ Pool IP hardcoded — scrubovat nebo nepublikovat |
| `docs/2.9.5/GPU_MINING_GUIDE.md` | ⚠️ Pool IP hardcoded — scrubovat nebo nepublikovat |

### 📦 Legacy / nedokončené

| Složka | Důvod |
|--------|-------|
| `2.9-History/` celý | Starý kód, skripty s hesly, IPs |
| `2.9.5OLD/` celý | Starý kód |
| `desktop-agent/` | Nedokončený, node_modules |
| `mobile-app/` | Nedokončený, node_modules |
| `public_html/` | Starý web s IPs |
| `website-v2.9/` | Produkční web — zveřejnit později samostatně |
| `target/` | Build artefakty |
| `native-libs` | Binární soubory |
| `Genesis` | Prověřit obsah — zřejmě genesis block data |

---

## ⚠️ SCRUBOVAT PŘED PUBLIKACÍ

### 🔴 CRITICAL — Rust zdrojový kód (nalezeno v bezpečnostním auditu 13.2.2026)

| # | Soubor | Co opravit | Priorita |
|---|--------|-----------|----------|
| C1 | `cosmic-harmony/src/profit_router.rs` | Hardcoded **reálná BTC adresa** `bc1qvujra09...` → nahradit za `"YOUR_BTC_WALLET"` | 🔴 |
| C2 | `cosmic-harmony/src/profit_router.rs` | Hardcoded **reálná XMR adresa** `42m86RBW...` → nahradit za `"YOUR_XMR_WALLET"` | 🔴 |
| C3 | `pool/src/config.rs` | Tatáž **BTC adresa** jako fallback → nahradit za `"YOUR_BTC_WALLET"` | 🔴 |

### 🟠 HIGH — Hardcoded IP adresy v kódu

| # | Soubor | Co opravit | Priorita |
|---|--------|-----------|----------|
| H1 | `core/src/p2p/mod.rs` | Seed peers `77.42.31.72:8334`, `195.201.31.201:8334` → ponechat jen DNS (`seed1.zionterranova.com:8334`) | 🟠 |
| H2 | `miner/src/config.rs` | Default pool `77.42.31.72:3333` → `pool.zionterranova.com:3333` | 🟠 |
| H3 | `core/tests/sprint_1_3_ibd_suite.rs` | Produkční IP v testech → `127.0.0.1` | 🟠 |
| H4 | `core/tests/sprint_1_2_test_suite.rs` | Produkční IP v testech → `127.0.0.1` | 🟠 |
| H5 | `pool/src/payout/` | PostgreSQL test credentials `zion:zion@` → `user:password@localhost/testdb` | 🟠 |

### 🟡 MEDIUM — Komentáře

| # | Soubor | Co opravit | Priorita |
|---|--------|-----------|----------|
| M1 | `cosmic-harmony/src/profit_router.rs` | Komentář `"Helsinki is ARM64"` → `"Detect architecture"` | 🟡 |

### ⚠️ Dokumentace + konfigurace

| Soubor | Co opravit |
|--------|-----------|
| `Cargo.toml` (root) | `repository = "https://github.com/Zion-TerraNova/2.9.5-NativeAwakening"` |
| `README.md` | Nový — badge URLs na nový repo, git clone URL, odstranit `Yose144` |
| `QUICK_START.md` | `SEED_PEERS` → `seed1.zionterranova.com:8334` místo hardcoded IPs |
| `docker/docker-compose.mainnet.yml` | Ověřit env vars, žádné hardcoded IPs |
| `docs/whitepaper/full.md` | `77.42.31.72` → `seed1.zionterranova.com` |
| `docs/whitepaper/02_TECHNICAL_ARCHITECTURE.md` | Totéž |
| `docs/whitepaper-v2.9.5/full.md` | Totéž |
| `docs/whitepaper-v2.9.5/02_TECHNICAL_ARCHITECTURE.md` | Totéž |
| `docs/mainnet/COMPLETE_ROADMAP_TO_MAINNET.md` | IP + SSH → DNS |
| `docs/mainnet/phases/PHASE_7_LAUNCH.md` | IP + SSH → DNS |

### ✅ Ověřeno jako bezpečné (audit 13.2.2026)

| Položka | Verdikt |
|---------|---------|
| Dev-mode bypass (`dev.set_difficulty`, skip PoW) | ✅ Chráněno `#[cfg(feature = "dev-tools")]` — v release buildu neexistuje |
| Premine adresy (`zion1q...`) v genesis | ✅ Veřejné adresy — MAJÍ být v kódu |
| `unsafe` bloky (~80) | ✅ Vše FFI do C knihoven (RandomX, Ethash, Metal GPU) |
| Hex stringy v kódu | ✅ Nulové hashe / difficulty targety, žádné klíče |
| Env vars (`ZION_*`) | ✅ Správný pattern, žádné leaky |
| Redis `127.0.0.1` default | ✅ Přepsatelný env varem `ZION_REDIS_URL` |
| Stratum `password` pole | ✅ Worker/algo hint (`x`), ne reálné heslo |
| Testovací klíče (`[42u8; 32]`) | ✅ Dummy hodnoty |

---

## 📁 Cílová struktura public repo

```
2.9.5-NativeAwakening/
├── Cargo.toml                      # workspace root
├── Cargo.lock
├── LICENSE                         # MIT
├── README.md                       # nový, čistý
├── QUICK_START.md                  # scrubnutý
├── ROADMAP.md
├── PREMINE_ADDRESSES_PUBLIC.txt
├── MAINNET_PREFLIGHT_CHECKLIST.md
│
├── core/                           # 🧠 Blockchain Node
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── network.rs
│   │   ├── algorithms/
│   │   ├── bin/
│   │   ├── blockchain/
│   │   ├── crypto/
│   │   ├── jsonrpc/
│   │   ├── mempool/
│   │   ├── metrics/
│   │   ├── miner/
│   │   ├── p2p/
│   │   ├── rpc/
│   │   ├── state/
│   │   ├── storage/
│   │   ├── tx/
│   │   └── wallet/
│   ├── tests/
│   │   ├── chain_consensus.rs
│   │   ├── config_validation.rs
│   │   ├── genesis_verification.rs
│   │   ├── sprint_1_2_test_suite.rs
│   │   ├── sprint_1_3_ibd_suite.rs
│   │   ├── sprint_1_4_payout_suite.rs
│   │   └── sprint_1_9_stress_suite.rs
│   └── benches/
│
├── cosmic-harmony/                 # ⚡ Mining Algorithm
│   ├── Cargo.toml
│   ├── build.rs
│   ├── src/
│   └── benches/
│
├── miner/                          # ⛏️ Stratum Miner
│   ├── Cargo.toml
│   └── src/
│
├── pool/                           # 🏊 Mining Pool
│   ├── Cargo.toml
│   ├── src/
│   └── benches/
│
├── config/                         # ⚙️ Konfigurace
│   ├── mainnet.toml
│   └── devnet.toml
│
├── docker/                         # 🐳 Docker
│   ├── Dockerfile.core
│   ├── Dockerfile.miner
│   ├── Dockerfile.pool
│   └── docker-compose.mainnet.yml
│
├── legal/                          # ⚖️ Právní dokumenty
│   ├── DISCLAIMER.md
│   ├── TOKEN_NOT_SECURITY.md
│   ├── RISK_DISCLOSURE.md
│   ├── PREMINE_DISCLOSURE.md
│   ├── NO_INVESTMENT.md
│   ├── INFRASTRUCTURE_FUNDING.md
│   └── README.md
│
└── docs/                           # 📖 Dokumentace
    ├── whitepaper/                 # Whitepaper (scrubnutý)
    ├── whitepaper-v2.9.5/          # Whitepaper v2.9.5 (scrubnutý)
    ├── mainnet/                    # Mainnet plány + fáze
    │   ├── phases/                 # PHASE_0 – PHASE_7
    │   ├── MAINNET_CONSTITUTION.md
    │   └── README.md
    ├── MAINNET_ROADMAP_2026.md
    └── guides/                     # Technické příručky
        ├── API_REFERENCE.md
        ├── BLOCKCHAIN_CORE_AUDIT.md
        ├── BUILD_SYSTEM.md
        ├── QUICKSTART.md
        ├── LOAD_TESTING_GUIDE.md
        ├── METRICS_GUIDE.md
        ├── MILESTONES_v2.9.5.md
        ├── E2E_TEST_REPORT.md
        ├── NCL_CONTRACT_v1.0.md
        ├── ZION_NCL_WHITEPAPER_v1.0.md
        └── ... (dalších ~10 čistých docs)
```

---

## 🚀 Exekuční kroky

1. **Vytvořit čistou kopii** — `rsync --exclude` vybraných složek do `/tmp/2.9.5-NativeAwakening/`
2. **Scrubovat** — nahradit všechny hardcoded IPs za DNS jména
3. **Opravit URLs** — `Yose144/Zion-2.9.5` → `Zion-TerraNova/2.9.5-NativeAwakening`
4. **Nový `.gitignore`** — target/, node_modules/, *.json s hesly, .env
5. **Nový README.md** — s badges, correct git clone URL, feature highlights
6. **`git init` → first commit → push** na `Zion-TerraNova/2.9.5-NativeAwakening`

---

## 🛡️ Bezpečnostní checklist před push

### IP adresy a infrastruktura
- [ ] **Zero** výskytů `77.42.31.72` / `195.201.31.201` / `5.78.145.234` / `5.223.56.124` / `91.98.122.165`
- [ ] **Zero** výskytů `Yose144` / `yose144`
- [ ] **Zero** výskytů `zion_hetzner_key` / `id_ed25519_hetzner` / SSH klíčových cest
- [ ] **Zero** výskytů `root@` (SSH příkazy)

### Hesla a secrets
- [ ] **Zero** výskytů `POSTGRES_PASSWORD` / `REDIS_PASSWORD` / `JWT_SECRET` (kromě env var čtení)
- [ ] **Zero** výskytů `sacred_dharma` (produkční hesla)
- [ ] **Zero** výskytů `secret_key_hex` / `mnemonic` / `seed_phrase`

### Wallet adresy (reálné)
- [ ] **Zero** výskytů `bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw` (BTC)
- [ ] **Zero** výskytů `42m86RBWf4PeuRf8P5rwA96XvmCKAfF77do` (XMR — prefix stačí)

### Soubory které NESMÍ být v repo
- [ ] **Žádný** `PREMINE_WALLETS_BACKUP.json`
- [ ] **Žádný** `SERVERS_SSH.md`
- [ ] **Žádný** `runbook.md`
- [ ] **Žádný** `.env` / `.env.example` s hesly
- [ ] **Žádný** `testnet.toml` (hardcoded IPs)
- [ ] **Žádný** `ch3_revenue_settings.json` (wallet adresy)
- [ ] **Žádný** soubor z `scripts/`, `monitoring/`, `ops/`
- [ ] **Žádný** soubor z `2.9-History/`, `2.9.5OLD/`, `desktop-agent/`, `mobile-app/`, `public_html/`, `website-v2.9/`

### Build ověření
- [ ] `cargo build --release` → kompiluje OK
- [ ] `cargo test` → testy prochází
- [ ] `grep -rn "77\.42\.31\|195\.201\.31\|5\.78\.145\|5\.223\.56\|91\.98\.122" .` → 0 výsledků
- [ ] `grep -rn "bc1qvujra09\|42m86RBW" .` → 0 výsledků
- [ ] `grep -rn "Yose144\|yose144\|hetzner_key\|sacred_dharma" .` → 0 výsledků
