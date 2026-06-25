# 🚀 ZION MainNet Roadmap 2026

**Verze: 2.0 | Datum: 23. května 2026**  
**Cíl: L1 MainNet Genesis — 31. prosince 2026 (New Year's Eve / Silvestr)**  
**Full Stack: L1 Blockchain → L2 DEX → L3 Warp/AI → L4 Oasis**  
**Kódová verze: v2.9.6 → v2.9.6-mainnet**  
**GitHub: [github.com/Yose144/Zion-2.9.5](https://github.com/Yose144/Zion-2.9.5)**  
**Aktuální stav: ✅ GENESIS + FEE SPLIT KONFIGURACE DOKONČENA | ✅ CORE+EDGE TOPOLOGIE AKTIVNÍ | ✅ READY FOR MAINNET LAUNCH 31.12.2026**

> *Tento dokument je hlavní řídící roadmapa od současného stavu TestNetu k produkčnímu MainNet launchi.*  
> *Autoritativní zdroj: WP2.9.5, MAINNET_CONSTITUTION.md*

---

## 🧹 PRIO ZERO — Čisté Repo `Zion-2.9.5`

### Motivace
Současné repo `Zion-2.9-main` má **2+ roky historie**, stovky experimentálních souborů, starý Python kód, archivní skripty, duplicitní konfigurace. Pro MainNet potřebujeme **chirurgicky čistý codebase** kde každý soubor má smysl.

### Strategie
| Repo | URL | Účel |
|------|-----|------|
| **Zion-2.9** (archiv) | `github.com/Yose144/Zion-2.9-main` | 🗄️ Historický archiv — veškerý vývoj, experimenty, docs, data |
| **Zion-2.9.5** (mainnet) | `github.com/Yose144/Zion-2.9.5` | 🚀 Čistý produkční kód — jen to co jde na MainNet |

### Nová Repo Struktura — `Zion-2.9.5`

```
Zion-2.9.5/
├── README.md                          # "What is ZION" — 1 stránka
├── LICENSE                            # MIT nebo Apache 2.0
├── Cargo.toml                         # Workspace root
├── Cargo.lock
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                     # Build + Test on PR
│   │   ├── release.yml                # Tag → binary release
│   │   └── audit.yml                  # cargo audit (security)
│   └── CODEOWNERS
│
├── core/                              # 🧠 ZION Blockchain Core
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs                    # Node entry point
│       ├── lib.rs                     # Library exports
│       ├── blockchain/
│       │   ├── mod.rs
│       │   ├── block.rs               # Block structure
│       │   ├── chain.rs               # Chain management
│       │   ├── consensus.rs           # LWMA DAA (±25%, 60-blok)
│       │   ├── genesis.rs             # 🆕 Genesis block + 16.28B premine
│       │   ├── reward.rs              # 🔄 5,400.067 ZION konstantní
│       │   ├── reorg.rs               # Max reorg depth = 10
│       │   └── validation.rs          # Block/TX validation (čistý L1)
│       ├── tx/
│       │   ├── mod.rs
│       │   ├── transaction.rs         # UTXO TX model
│       │   └── coinbase.rs            # 🆕 Coinbase maturity (100 bloků)
│       ├── mempool/
│       │   ├── mod.rs
│       │   ├── pool.rs                # Mempool management
│       │   ├── fee.rs                 # 🆕 Fee market + burning
│       │   └── double_spend.rs        # 🆕 Double-spend detection
│       ├── p2p/
│       │   ├── mod.rs
│       │   ├── server.rs              # P2P TCP server
│       │   ├── peer.rs                # Peer management
│       │   ├── sync.rs                # IBD + block sync
│       │   └── messages.rs            # Protocol messages
│       ├── storage/
│       │   ├── mod.rs
│       │   └── lmdb.rs               # LMDB persistence
│       ├── crypto/
│       │   ├── mod.rs
│       │   ├── ed25519.rs             # Signing
│       │   └── hash.rs                # Hashing utilities
│       ├── rpc/
│       │   ├── mod.rs
│       │   └── handlers.rs            # JSON-RPC API
│       └── wallet/
│           ├── mod.rs
│           └── send.rs                # 🆕 UTXO select + sign + broadcast
│
├── pool/                              # ⛏️ Mining Pool
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs                    # Pool entry
│       ├── stratum/
│       │   ├── mod.rs
│       │   └── server.rs              # Stratum v2
│       ├── shares/
│       │   ├── mod.rs
│       │   └── validator.rs           # Share validation
│       ├── payout/
│       │   ├── mod.rs
│       │   └── pplns.rs               # PPLNS reward distribution
│       ├── vardiff.rs                 # Variable difficulty
│       └── config.rs                  # Pool configuration
│
├── miner/                             # ⚡ Universal Miner
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs                    # Miner entry
│       ├── cpu.rs                     # CPU mining
│       ├── gpu.rs                     # GPU mining (CUDA/OpenCL/Metal)
│       └── stratum_client.rs          # Pool connection
│
├── cosmic-harmony/                    # 🌌 PoW Algorithm
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs                     # Algorithm implementation
│       └── v3.rs                      # Cosmic Harmony v3
│
├── explorer/                          # 🔍 Block Explorer (post Fáze 2)
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── indexer.rs                 # Block/TX indexer
│       └── api.rs                     # REST API
│
├── tools/                             # 🔧 CLI Utilities
│   ├── wallet-generator/              # Offline wallet gen
│   └── genesis-builder/               # Genesis block builder
│
├── config/                            # ⚙️ Konfigurace
│   ├── mainnet.toml                   # MainNet config
│   ├── testnet.toml                   # TestNet config
│   └── devnet.toml                    # Local dev config
│
├── docker/                            # 🐳 Docker
│   ├── Dockerfile.core                # Core node image
│   ├── Dockerfile.pool                # Pool image
│   ├── Dockerfile.miner               # Miner image
│   ├── docker-compose.mainnet.yml     # Production compose
│   ├── docker-compose.testnet.yml     # TestNet compose
│   └── docker-compose.dev.yml         # Local dev compose
│
├── docs/                              # 📚 Dokumentace
│   ├── whitepaper/                    # WP2.9.5 (finální)
│   ├── MAINNET_CONSTITUTION.md        # Neměnné parametry
│   ├── ECONOMIC_MODEL.md              # Emisní model vysvětlení
│   ├── RUN_NODE.md                    # "Run a node in 10 min"
│   ├── MINING_GUIDE.md                # CPU/GPU/Pool/Solo guide
│   └── API_REFERENCE.md              # RPC API docs
│
├── legal/                             # ⚖️ Právní dokumenty
│   ├── DISCLAIMER.md
│   ├── TOKEN_NOT_SECURITY.md
│   ├── RISK_DISCLOSURE.md
│   └── PREMINE_DISCLOSURE.md
│
├── tests/                             # 🧪 Integration testy
│   ├── e2e/                           # End-to-end scénáře
│   ├── stress/                        # Load testing
│   └── fixtures/                      # Test data
│
└── scripts/                           # 📜 Operační skripty
    ├── deploy.sh                      # Deploy na server
    ├── backup.sh                      # LMDB backup
    └── health-check.sh                # Node health check
```

### Co se KOPÍRUJE z `Zion-2.9-main` → `Zion-2.9.5`

| Zdroj v 2.9-main | Cíl v 2.9.5 | Akce |
|-------------------|-------------|------|
| `2.9.5/zion-native/core/src/blockchain/` | `core/src/blockchain/` | ✂️ Kopírovat + **přepsat** (reward, consensus, validation) |
| `2.9.5/zion-native/core/src/p2p/` | `core/src/p2p/` | ✂️ Kopírovat (hotové, funguje) |
| `2.9.5/zion-native/core/src/storage/` | `core/src/storage/` | ✂️ Kopírovat (LMDB ok) |
| `2.9.5/zion-native/core/src/crypto/` | `core/src/crypto/` | ✂️ Kopírovat (Ed25519 ok) |
| `2.9.5/zion-native/core/src/tx/` | `core/src/tx/` | ✂️ Kopírovat (UTXO model ok) |
| `2.9.5/zion-native/core/src/rpc/` | `core/src/rpc/` | ✂️ Kopírovat + rozšířit |
| `2.9.5/zion-native/core/src/state/` | `core/src/state/` | ✂️ Kopírovat |
| `2.9.5/zion-native/pool/src/stratum/` | `pool/src/stratum/` | ✂️ Kopírovat (Stratum v2 ok) |
| `2.9.5/zion-native/pool/src/pplns/` | `pool/src/payout/pplns.rs` | ✂️ Kopírovat |
| `2.9.5/zion-native/pool/src/vardiff.rs` | `pool/src/vardiff.rs` | ✂️ Kopírovat |
| `2.9.5/zion-native/pool/src/shares/` | `pool/src/shares/` | ✂️ Kopírovat |
| `2.9.5/zion-universal-miner/src/` | `miner/src/` | ✂️ Kopírovat (CPU miner ok) |
| `2.9.5/zion-cosmic-harmony-v3/src/` | `cosmic-harmony/src/` | ✂️ Kopírovat (algo ok) |
| `docs/whitepaper-v2.9.5/` | `docs/whitepaper/` | ✂️ Kopírovat |
| `docs/mainnet/MAINNET_CONSTITUTION.md` | `docs/MAINNET_CONSTITUTION.md` | ✂️ Kopírovat |
| `legal/*` | `legal/*` | ✂️ Kopírovat (5 souborů hotových!) |
| `2.9.5/zion-native/Dockerfile.*` | `docker/Dockerfile.*` | ✂️ Kopírovat + upravit paths |

### Co se NEKOPÍRUJE (zůstává jen v archivu)

| Obsah | Důvod |
|-------|-------|
| `src/` (starý Python pool/core) | Nahrazeno Rust nativním kódem |
| `ai/`, `ai-native-server/` | Není L1, budoucí layer |
| `frontend/`, `website-v2.9/`, `webV/` | Separátní repo |
| `mobile-app/`, `reactnative/` | Separátní repo |
| `desktop-agent/` | Separátní repo |
| `vscode-extension/` | Separátní repo |
| `ZionOasis_UE5/` | Separátní repo (game) |
| `PREMINE/`, `golden_egg/` | Historické, nahrazeno `genesis.rs` |
| `dao/` | Post-mainnet, separátní |
| `QDL/`, `books/` | Dokumentace, ne kód |
| `archive/`, `V2/` | Historický archiv |
| `blog/`, `Logo/`, `assets/` | Marketing, separátní |
| `WORK_REPORT_*.md` | Historické záznamy |
| `zion_native_miner_v2_9.py` | Nahrazeno Rust minerem |
| `2.9.5/zion-ncl/` | NCL není na L1 (post-mainnet) |
| `2.9.5/zion-native/pool/src/consciousness/` | Consciousness není na L1 |
| `2.9.5/zion-native/pool/src/ncl.rs` | NCL není na L1 |
| `2.9.5/zion-native/pool/src/buyback.rs` | ✅ **Přesunuto do L1** (CH v3 Revenue) |
| `2.9.5/zion-native/pool/src/profit_switcher.rs` | ✅ **Přesunuto do L1** (CH v3 Revenue) |
| `2.9.5/zion-native/pool/src/revenue_proxy.rs` | ✅ **Přesunuto do L1** (CH v3 Revenue) |
| `2.9.5/zion-native/pool/src/stream_scheduler.rs` | ✅ **Přesunuto do L1** (CH v3 Revenue) |
| `2.9.5/zion-native/pool/src/pool_external_miner.rs` | ✅ **Přesunuto do L1** (CH v3 Revenue) |
| `config/*.json` (30+ souborů) | Nahrazeno 3 TOML soubory |
| `*.spec`, `build_scripts/`, `builds/` | Staré build artefakty |
| `test_10_miners.txt`, `out_ab.txt` | Debug artifacts |

### Migrace — Krok za Krokem

```
REPO MIGRATION PLAN:
═══════════════════════════════════════════════════════════════

KROK 1: Init čistého repo (30 min)
├── git init Zion-2.9.5
├── Vytvořit adresářovou strukturu (viz výše)
├── Cargo.toml workspace root
├── README.md s vizí projektu
├── LICENSE (MIT)
├── .gitignore (Rust + Docker + IDE)
└── Push initial commit

KROK 2: Core blockchain (2-4 hodiny)
├── Kopírovat blockchain/ z 2.9-main/2.9.5/zion-native/core/src/
├── Kopírovat p2p/, storage/, crypto/, tx/, state/, rpc/
├── Kopírovat main.rs, lib.rs
├── Aktualizovat Cargo.toml dependencies
├── Odstranit consciousness/NCL importy
├── ✅ cargo build --release
└── ✅ cargo test

KROK 3: Pool (1-2 hodiny)
├── Kopírovat stratum/, shares/, pplns/, vardiff
├── Kopírovat main.rs, config.rs
├── ✅ Kopírovat CH v3 revenue: revenue_proxy, profit_switcher, buyback, stream_scheduler, pool_external_miner
├── NEKOPÍROVAT: consciousness/, ncl.rs
├── Aktualizovat Cargo.toml
├── ✅ cargo build --release
└── ✅ cargo test

KROK 4: Miner + Algorithm (1 hodina)
├── Kopírovat universal-miner src/
├── Kopírovat cosmic-harmony-v3 src/
├── Aktualizovat Cargo.toml
├── ✅ cargo build --release
└── ✅ cargo test

KROK 5: Docker + Config (1 hodina)
├── Kopírovat + upravit Dockerfiles (nové paths)
├── Vytvořit 3 compose soubory (mainnet/testnet/dev)
├── Vytvořit config/*.toml (místo 30+ JSON)
└── ✅ docker-compose build

KROK 6: Docs + Legal (1 hodina)
├── Kopírovat whitepaper-v2.9.5/ → docs/whitepaper/
├── Kopírovat MAINNET_CONSTITUTION.md
├── Kopírovat legal/* (5 souborů)
├── Vytvořit RUN_NODE.md, MINING_GUIDE.md
└── ✅ Review docs

KROK 7: CI/CD (30 min)
├── .github/workflows/ci.yml (build + test na PR)
├── .github/workflows/release.yml (tag → binaries)
├── .github/workflows/audit.yml (cargo audit)
└── ✅ Push → CI zelená

KROK 8: Verifikace (1 hodina)
├── cargo build --release (celý workspace)
├── cargo test (všechny testy)
├── docker-compose up (E2E test)
├── Mine 10 bloků → verify reward = 5,400.067
└── ✅ Vše funguje → v2.9.5-alpha tag

CELKEM: ~8-12 hodin práce
═══════════════════════════════════════════════════════════════
```

### Archivace `Zion-2.9-main`

Po úspěšné migraci:
1. Přidat `⚠️ ARCHIVED` badge do README
2. Přidat odkaz na nové repo: `➡️ Active development moved to Zion-2.9.5`
3. Nastavit repo jako **Archive** na GitHubu (read-only)
4. Zachovat veškerou git historii jako reference

---

## 📊 Aktuální Stav (aktualizováno 9. únor 2026)

### ✅ Co funguje — FÁZE 0 + FÁZE 1 (Sprinty 0.0–1.5)
| Komponenta | Stav | Commit |
|------------|------|--------|
| Čisté repo `Zion-2.9.5` na GitHubu | ✅ Sprint 0.0 | `c1d8e34` |
| Konstantní emise 5,400.067 ZION/blok | ✅ Sprint 0.1 | `cad8a62` |
| Genesis premine 16.28B (4 UTXOs, immediately unlocked) | ✅ Sprint 0.1 | `cad8a62` |
| LWMA DAA (60-blok, ±25%) | ✅ Sprint 0.2 | `be0beb0` |
| Fee Market + Fee Burning | ✅ Sprint 0.3 | `4ed3a04` |
| Wallet Send (UTXO select + Ed25519 sign) | ✅ Sprint 0.4 | `b8112eb` |
| Coinbase maturity = 100 bloků | ✅ Sprint 0.5 | `19787a7` |
| Max reorg depth = 10 | ✅ Sprint 0.5 | `19787a7` |
| Soft finality = 60 bloků | ✅ Sprint 0.5 | `19787a7` |
| Fork-choice (highest accumulated work) | ✅ Sprint 0.5 | `19787a7` |
| Timestamp sanity ±120s | ✅ Sprint 0.5 | `19787a7` |
| Deploy script (rsync) | ✅ Infra | `98cc1b6` |
| Docker (rust:1.85) | ✅ Infra | `6f3cdcd` |
| Network identity + 3-server deploy | ✅ Sprint 1.0 | `16438a7` |
| Config validation (70 testů) | ✅ Sprint 1.1 | `16438a7` |
| Security & Edge-Case Test Suite (29 testů + 3 fixy) | ✅ Sprint 1.2 | `7e85e84` |
| IBD Hardening (42 testů, timeout/stall/RPC sync) | ✅ Sprint 1.3 | `9bd901b` |
| Pool Payout Integration (23 testů, batch TX) | ✅ Sprint 1.4 | `967a36b` |
| Buyback + DAO Treasury — 100% DAO 🏛️ (28 testů) | ✅ Sprint 1.5/M6 | — |
| Supply + Buyback + Network + Peer RPC API (15 testů) | ✅ Sprint 1.6 | `9af7162` |
| P2P Message Rate-Limiting & Security Hardening (13 testů) | ✅ Sprint 1.7 | `aa1b7df` |
| Health Check & Metrics RPC Endpoints (8 testů) | ✅ Sprint 1.8 | `9cfa58f` |
| Stress Test Suite & Network Partition Tests (21 testů) | ✅ Sprint 1.9 | `5b1c1ea` |
| **Celkem testů** | **✅ 420 passing (235 lib + 185 integration)** | — |
| 3 servery: Helsinki, USA, Singapore — pool + miner běží | ✅ | — |
| 72h+ Stability Run (Germany 7 dní uptime, 0 restartů) | ✅ Sprint 1.10 | — |
| Live Network Partition Test (iptables, reorg convergence) | ✅ Sprint 1.11 | — |
| 60 Miners Distributed Stress Test (6 instancí, 3 lokace, 100% PASS) | ✅ Sprint 1.12 | — |

### ✅ Kritické nesoulady kód ↔ WP2.9.5 — VŠECHNY VYŘEŠENY
| Problém | Starý kód | WP2.9.5 | Stav |
|---------|-----------|---------|------|
| Block reward | 50 ZION + halving | 5,400.067 ZION konstantní | ✅ Opraveno (Sprint 0.1) |
| Consciousness bonus | 30% v `validation.rs` | Žádný na L1 | ✅ Odstraněno (Sprint 0.1) |
| DAA | Max 4x / Min 0.25x | LWMA ±25%, 60-block window | ✅ Opraveno (Sprint 0.2) |
| Genesis premine | Neexistoval | 16.28B ve 4 kategoriích | ✅ Implementováno (Sprint 0.1) |
| Max reorg depth | Neimplementováno | 10 bloků | ✅ Implementováno (Sprint 0.5) |
| Coinbase maturity | Neimplementováno | 100 bloků | ✅ Implementováno (Sprint 0.5) |
| Fee market | Základní | Fees burned by default | ✅ Opraveno (Sprint 0.3) |

---

## 🏗️ FÁZE 0 — SPEC FREEZE & CORE REWRITE ✅ DOKONČENO
**📅 Únor 2026 (dokončeno 9. únor 2026)**  
**Priorita: P0 — Blocker → ✅ SPLNĚNO**

Cíl: Vytvořit čisté repo, dostat core blockchain do souladu s WP2.9.5 a MAINNET_CONSTITUTION. **HOTOVO — 155 testů, 8 commitů.**

### Sprint 0.0 — Repo Migrace ✅ (commit `c1d8e34`)
| # | Úkol | Stav |
|---|------|------|
| 0.0.1 | **Vytvořit `Zion-2.9.5` repo** na GitHub — init, LICENSE, .gitignore | ✅ |
| 0.0.2 | **Vytvořit adresářovou strukturu** — core/, pool/, miner/, cosmic-harmony/, docs/ | ✅ |
| 0.0.3 | **Cargo workspace** — root Cargo.toml s members | ✅ |
| 0.0.4 | **Kopírovat core** — blockchain, p2p, storage, crypto, tx, state, rpc (bez consciousness) | ✅ |
| 0.0.5 | **Kopírovat pool** — stratum, shares, pplns, vardiff + **CH v3 revenue orchestrace** (revenue_proxy, profit_switcher, buyback, stream_scheduler, pool_external_miner) | ✅ |
| 0.0.6 | **Kopírovat miner + cosmic-harmony** | ✅ |
| 0.0.7 | **Docker + Config** — 3 Dockerfiles, 3 compose, 3 TOML configs | ✅ |
| 0.0.8 | **Docs + Legal** — whitepaper, constitution, legal (5 souborů) | ✅ |
| 0.0.9 | **CI/CD** — GitHub Actions (build, test, audit, release) | ✅ |
| 0.0.10 | **✅ Verifikace** — `cargo build && cargo test && docker-compose up` | ✅ |
| 0.0.11 | **Archivovat** `Zion-2.9-main` — README badge, GitHub Archive mode | ⬜ |

### Sprint 0.1 — Emission & Genesis ✅ (commit `cad8a62`)
| # | Úkol | Soubor | Stav |
|---|------|--------|------|
| 0.1.1 | **Přepsat `reward.rs`** — 5,400.067 ZION/blok konstantní, žádný halving, mining strop 23,652,000 bloků | `core/src/blockchain/reward.rs` | ✅ |
| 0.1.2 | **Aktualizovat `validation.rs`** — odstranit 30% consciousness bonus, nový reward limit | `core/src/blockchain/validation.rs` | ✅ |
| 0.1.3 | **Vytvořit `genesis.rs`** — Genesis blok s 16.28B premine | `core/src/blockchain/genesis.rs` | ✅ |
| 0.1.4 | **Implementovat time-lock** — premine UTXOs uzamčeny na block height | `core/src/blockchain/genesis.rs` | ✅ |
| 0.1.5 | **Coinbase maturity** — 100-blok lock na coinbase výstupy | `core/src/blockchain/validation.rs` | ✅ *(Sprint 0.5, commit `19787a7`)* |
| 0.1.6 | Aktualizovat všechny unit testy pro nový reward model | `core/src/blockchain/reward.rs` tests | ✅ |

**Genesis Premine Rozdělení (z MAINNET_CONSTITUTION):**

| Kategorie | Částka ZION | Podíl z premine | Lock |
|-----------|-------------|-----------------|------|
| Mining Operators (OASIS, bonusy) | 8,250,000,000 | 50.7% | Okamžitě dostupné |
| DAO Treasury | 4,000,000,000 | 24.6% | Okamžitě dostupné |
| Infrastructure & Development | 2,500,000,000 | 15.4% | Okamžitě dostupné |
| Humanitarian Fund | 1,530,000,000 | 9.4% | Okamžitě dostupné |
| **Celkem** | **16,280,000,000** | **100%** | — |

**Emission Parametry:**
```
Block Reward:       5,400.067 ZION (konstantní)
Block Reward (flowers): 5,400,067,000,000,000 (1 ZION = 1,000,000,000,000 flowers)
FLOWERS_PER_ZION:   10¹² (12 decimals)  -- canonical, viz docs/CANONICAL_UNITS_AUDIT.md
Block Time:         60 sekund
Mining Supply:      127,720,000,000 ZION
Mining Horizon:     23,652,000 bloků (~45 let)
Halving:            ŽÁDNÝ
```

### Sprint 0.2 — DAA & Consensus ✅ (commit `be0beb0` + `19787a7`)
| # | Úkol | Soubor | Stav |
|---|------|--------|------|
| 0.2.1 | **Přepsat DAA na LWMA** — 60-blok okno, ±25% max change per block | `core/src/blockchain/consensus.rs` | ✅ |
| 0.2.2 | **Max reorg depth = 10** — odmítnout chain reorg hlubší než 10 bloků | `core/src/blockchain/chain.rs` | ✅ *(Sprint 0.5)* |
| 0.2.3 | **Soft finality = 60 bloků** — API/wallet považuje za finální | `core/src/blockchain/chain.rs` | ✅ *(Sprint 0.5)* |
| 0.2.4 | **Fork-choice rule** — highest accumulated work | `core/src/blockchain/chain.rs` | ✅ *(Sprint 0.5)* |
| 0.2.5 | **Timestamp sanity** — clamp ±2× target (±120s) | `core/src/blockchain/validation.rs` | ✅ *(Sprint 0.5)* |
| 0.2.6 | LWMA unit testy (deterministické sekvence) | `core/src/blockchain/consensus.rs` tests | ✅ |

### Sprint 0.3 — Fee Market & Mempool ✅ (commit `4ed3a04`)
| # | Úkol | Soubor | Stav |
|---|------|--------|------|
| 0.3.1 | **Min fee implementace** — minimální transakční poplatek | `core/src/mempool/` | ✅ |
| 0.3.2 | **Fee-based ordering** — mempool řadí podle fee/byte | `core/src/mempool/` | ✅ |
| 0.3.3 | **Double-spend detection** v mempoolu | `core/src/mempool/` | ✅ |
| 0.3.4 | **Fee burning** — poplatky se spalují (nejdou minerovi) | `core/src/blockchain/validation.rs` | ✅ |
| 0.3.5 | Mempool size limit + eviction policy | `core/src/mempool/` | ✅ |
| 0.3.6 | Max output amount = total supply clamp | `core/src/blockchain/validation.rs` | ✅ |

### Sprint 0.4 — Wallet & TX ✅ (commit `b8112eb`, 143 testů)
| # | Úkol | Soubor | Stav |
|---|------|--------|------|
| 0.4.1 | **Wallet send** — UTXO výběr, Ed25519 podepisování, broadcast | `core/src/wallet/` | ✅ |
| 0.4.2 | **Change address** — automatický návrat do peněženky | `core/src/wallet/` | ✅ |
| 0.4.3 | **Balance API** — GET balance pro adresu (UTXO scan) | `core/src/api/` | ✅ |
| 0.4.4 | **TX broadcast API** — POST raw TX → mempool → P2P propagace | `core/src/api/` | ✅ |
| 0.4.5 | E2E test: mine → send → confirm → balance check | `tests/` | ✅ |

### Sprint 0.5 — Consensus Hardening ✅ (commit `19787a7`, 155 testů)
| # | Úkol | Soubor | Stav |
|---|------|--------|------|
| 0.5.1 | **Coinbase maturity = 100** — enforce v `process_block()` | `core/src/blockchain/validation.rs` + `core/src/state/mod.rs` | ✅ |
| 0.5.2 | **Max reorg depth = 10** — `try_reorg()` odmítne hlubší reorganizaci | `core/src/blockchain/chain.rs` | ✅ |
| 0.5.3 | **Soft finality = 60** — `is_finalized()`, `finalized_height()` | `core/src/blockchain/chain.rs` | ✅ |
| 0.5.4 | **Fork-choice: highest accumulated work** — `total_work: u128` tracking | `core/src/blockchain/chain.rs` | ✅ |
| 0.5.5 | **Timestamp sanity ±120s** — `MAX_TIMESTAMP_DRIFT = 120` | `core/src/blockchain/validation.rs` | ✅ |
| 0.5.6 | **12 nových testů** (5 validation + 8 chain = 155 celkem) | testy | ✅ |

### 🚪 Fáze 0 Exit Criteria
- [x] Všechny unit testy pro nový reward model procházejí ✅ *(155 testů)*
- [x] Genesis blok generuje správný premine (16.28B) ✅ *(Sprint 0.1)*
- [x] LWMA DAA funguje deterministicky ✅ *(Sprint 0.2)*
- [x] Max reorg depth = 10 je enforcován ✅ *(Sprint 0.5)*
- [x] Coinbase maturity = 100 je enforcována ✅ *(Sprint 0.5)*
- [x] Wallet send E2E funguje ✅ *(Sprint 0.4)*
- [ ] `MAINNET_CONSTITUTION.md` hash zmrazen ⬜ *(plánováno před MainNet)*

---

## 🔬 FÁZE 1 — HARDENED TESTNET
**📅 Únor 2026 (probíhá)**  
**Priorita: P0 — Blocker**

Cíl: Kompletní reset TestNetu s novými parametry, stress testing, odladění, buyback ekonomika.

### Sprint 1.0 — Network Identity & Deploy ✅ (commit `16438a7`)
| # | Úkol | Stav |
|---|------|------|
| 1.0.1 | **Chain reset** — nový genesis s premine na všech 3 serverech | ✅ |
| 1.0.2 | Build Docker image `zion-core:2.9.5-testnet` | ✅ |
| 1.0.3 | Deploy na Helsinki (77.42.31.72) + USA (5.78.145.234) + Singapore (5.223.56.124) | ✅ |
| 1.0.4 | Verifikace: P2P sync, pool mining, block production | ✅ |

### Sprint 1.1 — Config Validation ✅ (commit `16438a7`, 70 testů)
| # | Úkol | Stav |
|---|------|------|
| 1.1.1 | **Config validation framework** — TOML parsing, boundary checks | ✅ |
| 1.1.2 | **70 unit testů** — config edge cases, defaults, invalid values | ✅ |

### Sprint 1.2 — Security & Edge-Case Test Suite ✅ (commit `7e85e84`, 29 testů + 3 fixy)
| # | Úkol | Stav |
|---|------|------|
| 1.2.1 | **Reorg test suite** — short (3 bloky) + long (10 bloků = max) | ✅ |
| 1.2.2 | **Double-spend detection** — intra-block + cross-block | ✅ |
| 1.2.3 | **Fork-choice testy** — competing chains, highest work vítězí | ✅ |
| 1.2.4 | **Strict UTXO validation** — production fix | ✅ |
| 1.2.5 | **Mempool restore on reorg** — production fix | ✅ |
| 1.2.6 | **Coinbase maturity test** — pokus utratit coinbase < 100 bloků | ✅ |

### Sprint 1.3 — IBD Hardening ✅ (commit `9bd901b`, 42 testů)
| # | Úkol | Stav |
|---|------|------|
| 1.3.1 | **IBD timeouts** — 30s per request, stall detection | ✅ |
| 1.3.2 | **Peer tracking** — slow/fast peer scoring, ban on stall | ✅ |
| 1.3.3 | **RPC sync endpoint** — `/api/sync/status` | ✅ |
| 1.3.4 | **42 integration testů** — sync scenarios, edge cases | ✅ |

### Sprint 1.4 — Pool Payout Integration ✅ (commit `967a36b`, 23 testů)
| # | Úkol | Stav |
|---|------|------|
| 1.4.1 | **`build_and_sign_batch()`** — N recipients batch TX | ✅ |
| 1.4.2 | **`submitTransaction` JSON-RPC** — submit signed TX via RPC | ✅ |
| 1.4.3 | **PoolWallet** — local signing, maturity tracker | ✅ |
| 1.4.4 | **23 integration testů** — payout scenarios | ✅ |

### Sprint 1.5 — Buyback + DAO Treasury (M6) ✅ (28 testů)
| # | Úkol | Stav |
|---|------|------|
| 1.5.1 | **Burn address** — `zion1burn...dead`, provably unspendable (L1 fee burning only) | ✅ |
| 1.5.2 | **DAO Treasury address** — `zion1dao...treasury`, DAO multisig | ✅ |
| 1.5.3 | **100% DAO revenue split** — `BURN_SHARE = 0%`, `DAO_SHARE = 100%` | ✅ |
| 1.5.4 | **`calculate_revenue_split()`** — split function + BTC variant (100% DAO) | ✅ |
| 1.5.5 | **BuybackTracker** — event recording, stats, persistence | ✅ |
| 1.5.6 | **BuybackEvent** — tracks DAO treasury allocations | ✅ |
| 1.5.7 | **BuybackStats** — cumulative stats, 100% DAO model | ✅ |
| 1.5.8 | **Burn TX verification** — `verify_burn_tx()` (L1 fee burns) | ✅ |
| 1.5.9 | **Burn address protection** — `process_block()` + `process_transaction()` reject spending | ✅ |
| 1.5.10 | **28 unit testů** — split, addresses, tracker, dedup, edge cases, 100% DAO | ✅ |

### Sprint 1.6 — Supply + Buyback API ✅ (commit `9af7162`, 15 testů)
| # | Úkol | Stav |
|---|------|------|
| 1.6.1 | **`getSupplyInfo` RPC** — total/premine/mining/mined/burned/circulating supply | ✅ |
| 1.6.2 | **`getBuybackStats` RPC** — 100% DAO treasury stats, recent events, DAO totals | ✅ |
| 1.6.3 | **`getNetworkInfo` RPC** — version, network, peers, uptime, hashrate, algorithm | ✅ |
| 1.6.4 | **`getPeerInfo` RPC** — connected/total peers, messages sent/received | ✅ |
| 1.6.5 | **15 unit testů** — aliases, boundary, regression | ✅ |

### Sprint 1.7 — P2P Message Rate-Limiting ✅ (commit `aa1b7df`, 13 testů)
| # | Úkol | Stav |
|---|------|------|
| 1.7.1 | **`MessageRateLimiter`** — 200 msgs/peer/60s, escalating bans (60s→300s→3600s) | ✅ |
| 1.7.2 | **Integration do `handle_connection()`** — per-message flood check | ✅ |
| 1.7.3 | **Integration do `heartbeat`** — reconnection s rate-limiter | ✅ |
| 1.7.4 | **13 security testů** — rate limit, ban threshold, escalation, reset, multi-peer | ✅ |

### Sprint 1.8 — Health Check & Metrics API ✅ (commit `9cfa58f`, 8 testů)
| # | Úkol | Stav |
|---|------|------|
| 1.8.1 | **`getHealthCheck` RPC** — status (healthy/degraded/unhealthy), network, uptime | ✅ |
| 1.8.2 | **`getMetrics` RPC** — structured: blocks{}, transactions{}, p2p{}, performance{} | ✅ |
| 1.8.3 | **8 unit testů** — aliases, sections, initial values | ✅ |

### Sprint 1.9 — Stress Test Suite & Network Partition ✅ (commit `5b1c1ea`, 21 testů)
| # | Úkol | Stav |
|---|------|------|
| 1.9.1 | **High-throughput TX** — 1000 + 5000 TXs, TPS measurement | ✅ |
| 1.9.2 | **Rapid block production** — 100 + 500 bloků chain build stress | ✅ |
| 1.9.3 | **Mempool stress** — fill & evict, duplicate rejection | ✅ |
| 1.9.4 | **Concurrent chain + TX** — 50 bloků × 10 TXs | ✅ |
| 1.9.5 | **Network partition** — diverge/reconverge, short reorg, deep rejection | ✅ |
| 1.9.6 | **Chain consistency** — hash links, sequential heights, monotonic timestamps | ✅ |
| 1.9.7 | **Buyback + Supply stress** — 100 events, supply invariant (circ + burned = total) | ✅ |
| 1.9.8 | **Orphan rate measurement** — simulation, target <2% | ✅ |
| 1.9.9 | **Security under stress** — 100 IPs rate-limiter, flood detection, mass ban/unban | ✅ |
| 1.9.10 | **Stability summary + DAA** — all invariants + DAA consistency 100 iterations | ✅ |

### Sprint 1.10 — 72h Stability Run ✅ (ověřeno 16. únor 2026)
| # | Úkol | Stav |
|---|------|------|
| 1.10.1 | **72h stability run** — 2 nody (Helsinki + Germany), CPU mining, 0 restartů | ✅ |
| 1.10.2 | **Germany uptime 7+ dní** — 0 restartů, 0 crashů, chain height 2408 | ✅ |
| 1.10.3 | **Helsinki uptime 25h+** — 0 restartů (restart z audit práce, ne crash) | ✅ |
| 1.10.4 | **Pool continuous operation** — 0 restartů na obou serverech, jobs forwarded nepřetržitě | ✅ |

### Sprint 1.11 — Live Network Partition Test ✅ (provedeno 16. únor 2026)
| # | Úkol | Stav |
|---|------|------|
| 1.11.1 | **Partition script** — `scripts/test_1_11_live_partition.sh` (iptables-based) | ✅ |
| 1.11.2 | **Live partition** — iptables DROP na P2P portu 8334 mezi Helsinki↔Germany | ✅ |
| 1.11.3 | **Divergence** — nodes pokračovaly v mining nezávisle (Helsinki 2402→2407, Germany 2403→2408) | ✅ |
| 1.11.4 | **Reconnect** — iptables pravidla odstraněna, P2P reconnection | ✅ |
| 1.11.5 | **Convergence** — Germany provdla IBD Reorg na height 2407, oba na 2408 se shodnou difficulty | ✅ |
| 1.11.6 | **Reorg mechanismus** — 23 úspěšných reorgů Helsinki, 18 Germany (celkem za uptime) | ✅ |

### Sprint 1.12 — 60 Miners Distributed Stress Test ✅ (provedeno 16. únor 2026)
| # | Úkol | Stav |
|---|------|------|
| 1.12.1 | **Stress test script** — `scripts/test_1_12_100_miners_stress.py` (asyncio, XMRig protocol) | ✅ |
| 1.12.2 | **60 miners, 3 lokace, 6 instancí** — Helsinki (2×10), Germany (2×10), MacOS local (2×10) | ✅ |
| 1.12.3 | **Connection rate** — 60/60 (100%) across all instances | ✅ |
| 1.12.4 | **Connect latency** — localhost 2-3ms, cross-server 26-28ms, transatlantic 177-300ms | ✅ |
| 1.12.5 | **Job broadcast** — 87 total jobs received, avg 1.0-2.2/miner | ✅ |
| 1.12.6 | **Stability** — 0 disconnects across 300s×6 runs (1800 miner-seconds total) | ✅ |
| 1.12.7 | **Pool stability** — 0 restartů pool/core na obou serverech během testu | ✅ |
| 1.12.8 | **Per-IP limit** — `ZION_MAX_CONNECTIONS_PER_IP` env var override v `server_v2.rs` | ✅ |
| 1.12.9 | **ALL PASS** — 6/6 instancí prošlo 4/4 kritéria | ✅ |

### 🚪 Fáze 1 Exit Criteria
- [x] TestNet deploy na 3+ serverech ✅ *(Sprint 1.0)*
- [x] Všechny reorg/double-spend/fork testy procházejí ✅ *(Sprint 1.2, 29 testů)*
- [x] IBD hardening — timeouts, stall detection ✅ *(Sprint 1.3, 42 testů)*
- [x] Pool payout batch TX ✅ *(Sprint 1.4, 23 testů)*
- [x] Buyback 50% burn + 50% creators rent implementován ✅ *(Sprint 1.5, 26 testů)*
- [x] Supply/Buyback/Network/Peer/Health/Metrics RPC API ✅ *(Sprint 1.6-1.8, 36 testů)*
- [x] DoS basic ochrany funkční ✅ *(Sprint 1.7 — MessageRateLimiter, escalating bans)*
- [x] Stress test suite (chain, mempool, security, partition) ✅ *(Sprint 1.9, 21 testů)*
- [x] 72h+ stability run bez pádu ✅ *(Sprint 1.10 — Germany 7+ dní, Helsinki 25h+)*
- [x] Live network partition + convergence ✅ *(Sprint 1.11 — reorg SUCCESS po reconnect)*
- [x] 60 miners distributed stress test ✅ *(Sprint 1.12 — 100% conn, 0 disconnects, 6/6 PASS)*
- [ ] Orphan rate < 2% ⬜ *(monitorování — reorg rate nízký)*
- [ ] Žádný critical bug v posledních 14 dnech ⬜ *(countdown od 16. únor 2026)*

---

## 🖥️ FÁZE 2 — NODE UX & MINING
**📅 Červen — Červenec 2026 (8 týdnů)**  
**Priorita: P1 — Important**

Cíl: Uživatelsky přívětivý node, stabilní mining, dokumentace.

### Sprint 2.1 — Node UX (Týden 1-3)
| # | Úkol | Stav |
|---|------|------|
| 2.1.1 | **README: "run full node in 10 min"** — kompletní návod | ⬜ |
| 2.1.2 | **Jednotná config** — `config.toml` místo JSON+env mix | ⬜ |
| 2.1.3 | **Čitelné logy** — structured logging, ne panicky | ⬜ |
| 2.1.4 | **Graceful shutdown** — Ctrl+C → clean LMDB close | ⬜ |
| 2.1.5 | **RPC API docs** — OpenAPI/Swagger specifikace | ⬜ |
| 2.1.6 | **CLI interface** — `zion-node start`, `zion-node status` atd. | ⬜ |

### Sprint 2.2 — Mining Polish (Týden 3-5)
| # | Úkol | Stav |
|---|------|------|
| 2.2.1 | **CPU mining baseline** — benchmark na low-end strojích | ⬜ |
| 2.2.2 | **GPU mining stabilita** — CUDA + OpenCL produkční | ⬜ |
| 2.2.3 | **Pool failover** — miner přepíná mezi pool servery | ⬜ |
| 2.2.4 | **Solo mining mode** — mine přímo bez poolu | ⬜ |
| 2.2.5 | **Mining guides** — CPU, GPU, pool, solo | ⬜ |

### Sprint 2.3 — Block Explorer (Týden 5-8)
| # | Úkol | Stav |
|---|------|------|
| 2.3.1 | **Explorer backend** — block/tx/address indexer | ⬜ |
| 2.3.2 | **Explorer frontend** — web UI (Next.js nebo Rust/WASM) | ⬜ |
| 2.3.3 | **Supply API** — total/circulating/mined supply endpoint | ⬜ |
| 2.3.4 | **Rich list** — top adresy | ⬜ |
| 2.3.5 | **Network stats** — hashrate, difficulty, block time graf | ⬜ |

### 🚪 Fáze 2 Exit Criteria
- [ ] Node spustitelný za 10 minut podle README
- [ ] Block explorer běží a indexuje
- [ ] Supply API vrací správné hodnoty
- [ ] Mining guides hotové (CPU + GPU + pool)
- [ ] RPC API zdokumentováno

---

## 🌍 FÁZE 3 — INFRASTRUCTURE & LEGAL
**📅 Srpen — Září 2026 (8 týdnů)**  
**Priorita: P1 — Important**

Cíl: Produkční infrastruktura, právní dokumentace, exchange readiness.

### Sprint 3.1 — Seed Nodes & Monitoring (Týden 1-3)
| # | Úkol | Stav |
|---|------|------|
| 3.1.1 | **5+ seed nodů** — EU (2), USA (1), Asia (2) | ⬜ |
| 3.1.2 | **Prometheus + Grafana** — monitoring všech nodů | ⬜ |
| 3.1.3 | **Alert rules** — disk, peers, block lag, orphan rate | ⬜ |
| 3.1.4 | **Backup strategie** — LMDB snapshots, off-site | ⬜ |
| 3.1.5 | **DDoS ochrana** — Cloudflare/Hetzner firewall na seed nodech | ⬜ |

### Sprint 3.2 — Docker & Deploy (Týden 3-5)
| # | Úkol | Stav |
|---|------|------|
| 3.2.1 | **`docker-compose.mainnet.yml`** — produkční compose | ⬜ |
| 3.2.2 | **`ops/runbook.md`** — provozní příručka | ⬜ |
| 3.2.3 | **Docker images published** — Docker Hub / GHCR | ⬜ |
| 3.2.4 | **Checksums** — SHA-256 hashů binárních releasů | ⬜ |
| 3.2.5 | **CI/CD pipeline** — GitHub Actions pro automatické buildy | ⬜ |

### Sprint 3.3 — Legal & Compliance (Týden 5-7)
| # | Úkol | Stav |
|---|------|------|
| 3.3.1 | `/legal/DISCLAIMER.md` — obecný disclaimer | ✅ hotovo |
| 3.3.2 | `/legal/TOKEN-NOT-SECURITY.md` — proč ZION není security | ✅ hotovo |
| 3.3.3 | `/legal/RISK-DISCLOSURE.md` — rizika pro uživatele | ✅ hotovo |
| 3.3.4 | `/legal/PREMINE-DISCLOSURE.md` — transparentní premine vysvětlení | ✅ hotovo |
| 3.3.5 | `/legal/NO-INVESTMENT.md` — žádné investiční sliby | ✅ hotovo |
| 3.3.6 | `/legal/INFRASTRUCTURE-FUNDING.md` — premine použití na infra | ⬜ |
| 3.3.7 | **Web footer disclaimer** — krátká verze na web | ⬜ |
| 3.3.8 | **Communication guidelines** — nikdy: "investment", "ROI", "returns" | ⬜ |

**Klíčové právní pozice (z PripravaNaMainet.md):**
- ZION = **protocol-native utility token**, NE security
- Žádné ICO/IEO/IDO/private sale — tokeny jsou **mined, not sold**
- Žádná firma jako emitent — firma = **infrastructure operator**
- Premine = **operační palivo**, ne investor allocation
- Nikdy nepoužívat: "founders", "team allocation", "early investors", "ROI"
- Vždy používat: "independent contributors", "infrastructure costs", "development grants"

**Právní status osoby (CZ/EU):**
- Fyzická osoba = nezávislý open-source contributor
- Firma (s.r.o.) = infrastrukturní provozovatel, NE emitent
- Registrace na firmu lze **dodatečně** (post-mainnet)
- Činnost firmy: "Vývoj a provoz open-source softwarové infrastruktury"

**Daňová strategie (minimalistická, CZ):**
- Velké částky → infrastruktura (servery, AI) → **žádná daň** (náklad)
- Osobní granty → §10 Ostatní příjmy (15%), nepravidelně
- Evidence: CSV výpisy z CEX/DEX + grant log + faktury za servery

### Sprint 3.4 — Exchange Readiness (Týden 7-8)
| # | Úkol | Stav |
|---|------|------|
| 3.4.1 | **Node setup guide pro burzy** — jak provozovat ZION node | ⬜ |
| 3.4.2 | **Whitepaper PDF** — finální verze pro CMC/CoinGecko | ⬜ |
| 3.4.3 | **CoinMarketCap application** — připravit všechny podklady | ⬜ |
| 3.4.4 | **CoinGecko application** — připravit všechny podklady | ⬜ |
| 3.4.5 | **wZION ERC-20 kontrakt** — Wrapped ZION pro EVM chains | ✅ `contracts/wZION.sol` (ERC20+Permit+RBAC+Pausable) |
| 3.4.6 | **Bridge controller kontrakt** — ZIONBridge.sol (3-of-5 multisig, timelock, daily limit) | ✅ `contracts/ZIONBridge.sol` |
| 3.4.7 | **Bridge relay crate (Rust)** — L1 watcher + EVM watcher + relayer + SQLite | ✅ `bridge/` (8 modules) |
| 3.4.8 | **L1 bridge vault address** — `BRIDGE_ADDRESS` v `core/src/blockchain/burn.rs` | ✅ |
| 3.4.9 | **Bridge config** — `config/bridge-testnet.toml` (Base/Arb/BSC chains) | ✅ |
| 3.4.10 | **Hardhat deploy script** — `contracts/scripts/deploy.ts` | ✅ |
| 3.4.11 | **L2 Architecture docs** — `docs/L2_WZION_BRIDGE.md` | ✅ |
| 3.4.12 | **Hardhat testy** — unit testy pro wZION + ZIONBridge | ⬜ |
| 3.4.13 | **Deploy na Base Sepolia** — testnet deployment | ⬜ |
| 3.4.14 | **E2E test** — lock → mint → burn → unlock | ⬜ |
| 3.4.7 | **Logo pack** — SVG/PNG ve všech CMC/CG rozměrech | ⬜ |
| 3.4.8 | **Supply API endpoint** — `/api/supply` (max/circulating/mined) | ⬜ |
| 3.4.9 | **Kontaktní email** — exchange-ready contact | ⬜ |
| 3.4.10 | **Exchange Q&A document** — premine, security, node guide | ⬜ |

**CMC/CoinGecko požadavky:**
| Požadavek | Stav | Poznámka |
|-----------|------|----------|
| Oficiální web | ✅ | zionterranova.com |
| GitHub public repo | ✅ | github.com/Yose144/Zion-2.9.5 |
| Běžící MainNet | ⬜ | Nutné — bez toho CMC nepřijme |
| Block explorer (veřejný) | ⬜ | Kritické — bez exploreru žádná burza |
| Logo (SVG/PNG) | ⬜ | Správné rozměry dle CMC spec |
| Supply info endpoint | ⬜ | API: max / circulating / mined |
| Kontaktní email | ⬜ | Musí reagovat do 48h |
| Whitepaper PDF | ⬜ | Finální verze |
| Burza (DEX se počítá!) | ⬜ | Min 1 DEX s reálnou likviditou |

> 📌 **CMC nezkoumá, jestli je projekt "dobrý". Zkoumá, jestli existuje a jestli se obchoduje.**

**CMC Application — klíčová pole (správný wording):**
```
Project Type:     "Decentralized blockchain protocol"
Token Type:       "Native protocol token"
ICO / Sale:       "No ICO / No Token Sale"
Premine:          "Yes – limited genesis premine for development
                   and infrastructure. No tokens were sold."
Company:          "No issuing company. Independent contributors
                   and infrastructure operators."
```

### wZION Bridge Plan (L2 příprava)

```
ZION L1 (nativní)          EVM Chain (Ethereum/Base/Arbitrum)
┌──────────────┐           ┌──────────────┐
│ User sends   │           │              │
│ ZION to      │──lock───▶ │ Bridge mint  │
│ bridge addr  │           │ wZION (ERC20)│
│ on L1        │           │ to user addr │
└──────────────┘           └──────┬───────┘
                                  │
                                  ▼
                           ┌──────────────┐
                           │ Uniswap Pool │
                           │ wZION / ETH  │
                           │ (price disc.)│
                           └──────────────┘
```

**wZION parametry:**
- Name: `Wrapped ZION`
- Symbol: `wZION`
- Decimals: 18
- Mint/Burn: **only bridge** (3/5 multisig)
- Audit: **required before launch**

**Bridge priority (síť):**
| Priorita | Síť | DEX | Proč |
|----------|-----|-----|------|
| 🥇 | Base / Arbitrum | Uniswap v3 | Legitimita, nízké fees |
| 🥈 | BNB Chain (BSC) | PancakeSwap | Retail, levné |
| 🥉 | Polygon | QuickSwap | Nízké fees, velký ekosystém |
| ❌ | Solana (zatím) | Jupiter | Složitost — SPL token, jiný stack |
| ❌ | ETH mainnet | Uniswap | Drahé — až po volume |

> ⚠️ **Nativní ZION L1 se NIKDY nedává přímo na cizí DEX. Vždy jde o wrapped reprezentaci.**

### 🚪 Fáze 3 Exit Criteria
- [ ] 5+ seed nodů v 3+ regionech
- [ ] Monitoring + alerting aktivní
- [ ] Legal docs kompletní (5 souborů v `/legal/`)
- [ ] Exchange application materiály připraveny
- [ ] Docker images publikované
- [ ] wZION ERC-20 kontrakt připraven (audit)
- [ ] Supply API endpoint běží

---

## 🎯 FÁZE 4 — DRESS REHEARSAL
**📅 Říjen — Listopad 2026 (8 týdnů)**  
**Priorita: P0 — Blocker**

Cíl: Plná simulace mainnet launche, code freeze, security review.

### Sprint 4.1 — MainNet Dress Rehearsal (Týden 1-3)
| # | Úkol | Stav |
|---|------|------|
| 4.1.1 | **Dress rehearsal chain** — kompletní spuštění na staging env | ⬜ |
| 4.1.2 | **Genesis block test** — verifikace premine a time-lock | ⬜ |
| 4.1.3 | **1000 miners load test** — simulace produkčního zatížení | ⬜ |
| 4.1.4 | **Disaster recovery** — simulace pádu 50% nodů | ⬜ |
| 4.1.5 | **168h (7-day) stability run** — nepřetržitý provoz | ⬜ |

### Sprint 4.2 — Security Audit (Týden 3-6)
| # | Úkol | Stav |
|---|------|------|
| 4.2.1 | **External audit RFP** — Trail of Bits / OtterSec / Halborn | ⬜ |
| 4.2.2 | **Audit kickoff** — poskytnout kód, dokumentaci, scope | ⬜ |
| 4.2.3 | **Audit mid-review** — reagovat na průběžné findings | ⬜ |
| 4.2.4 | **Audit final report** — opravit critical/high findings | ⬜ |
| 4.2.5 | **Bug bounty program** — spustit veřejný bounty | ⬜ |

### Sprint 4.3 — Code Freeze (Týden 6-8)
| # | Úkol | Stav |
|---|------|------|
| 4.3.1 | **Feature freeze** — žádné nové features, jen bugfixes | ⬜ |
| 4.3.2 | **Code freeze** — finální tag `v2.9.5-mainnet` | ⬜ |
| 4.3.3 | **Binary builds** — Linux, macOS, Windows release binaries | ⬜ |
| 4.3.4 | **Reproducible builds** — ověření deterministických binárních souborů | ⬜ |
| 4.3.5 | **SHA-256 hash publikace** — hashes všech release artefaktů | ⬜ |

### 🚪 Fáze 4 Exit Criteria
- [ ] 7-day stability run bez pádu
- [ ] Security audit — žádný critical/high nezafixovaný
- [ ] Code freeze — tag vytvořen
- [ ] Binární releasy s SHA-256 publikovány
- [ ] Bug bounty program aktivní

---

## 🎆 FÁZE 5 — MAINNET LAUNCH
**📅 Prosinec 2026**  
**Cílové datum: 31. 12. 2026**

### Launch Countdown (T-14 dní)
| Den | Aktivita |
|-----|----------|
| T-14 | Genesis freeze — všechny parametry zmrazeny |
| T-10 | Seed nody deployed a synchronizovány |
| T-7 | Community announcement — datum, návody, wallety ke stažení |
| T-5 | Wallet release (desktop + CLI) |
| T-3 | Mining guide publikován |
| T-2 | Final node software release |
| T-1 | Genesis block vytvořen OFFLINE (air-gapped) |
| **T-0** | **🚀 MAINNET GENESIS** |

### Launch Sequence (Den 0)
```
LAUNCH CHECKLIST:
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
- Premine:      16,280,000,000 ZION (4 UTXOs, time-locked)
- Block 1+:     5,400.067 ZION/blok → miners
- Fees:         burned by default

═══════════════════════════════════════════════════════════════
```

### Neměnné Parametry (z MAINNET_CONSTITUTION)
| Parametr | Hodnota | Status |
|----------|---------|--------|
| Chain ID | `zion-mainnet-1` | 🔒 LOCKED |
| Total Supply | 144,000,000,000 ZION | 🔒 LOCKED |
| Mining Supply | 127,720,000,000 ZION | 🔒 LOCKED |
| Genesis Premine | 16,280,000,000 ZION | 🔒 LOCKED |
| Block Reward | 5,400.067 ZION (konstantní) | 🔒 LOCKED |
| Block Time | 60 sekund | 🔒 LOCKED |
| DAA | LWMA (60 bloků, ±25%) | 🔒 LOCKED |
| Max Reorg Depth | 10 bloků | 🔒 LOCKED |
| Soft Finality | 60 bloků | 🔒 LOCKED |
| Consensus | Proof of Work (Cosmic Harmony v3) | 🔒 LOCKED |
| Halving | ❌ ŽÁDNÝ | 🔒 LOCKED |
| Presale | ❌ NEEXISTUJE | 🔒 LOCKED |

---

## 🛡️ FÁZE 6 — POST-LAUNCH: "Silent Mainnet" → Burzy
**📅 Leden — Červen 2027 (6 měsíců)**

> **Strategie: Mainnet → stabilita → DEX → CEX → CMC/CG**  
> **Žádný hype první den. Stabilita > marketing.**

### 6A: "Silent Mainnet" (Dny 1-30)
**⏱️ Leden 2027 — žádné burzy, jen mining + stabilita**

| # | Úkol | Stav |
|---|------|------|
| 6.1 | Monitor orphan rate (cíl < 2%) | ⬜ |
| 6.2 | Monitor difficulty stabilita (60s ± 10%) | ⬜ |
| 6.3 | Monitor peer count a churn | ⬜ |
| 6.4 | Hotfix releases pokud potřeba | ⬜ |
| 6.5 | Community support (Discord, GitHub Issues) | ⬜ |
| 6.6 | **Explorer live** — blocks, txs, addresses, supply | ⬜ |
| 6.7 | **Supply API** — `/api/supply` endpoint veřejný | ⬜ |

> 💡 **Proč "Silent Mainnet"?** Bitcoin to tak měl. Kaspa taky.  
> Žádné price drama, žádní spekulanti, žádné "kde moon".  
> Cíl: ověřit stabilitu sítě na reálném provozu.

### 6B: První DEX Listing (Dny 14-45)
**⏱️ Únor 2027 — kontrolovaný DEX start**

| # | Úkol | Stav |
|---|------|------|
| 6.8 | **Deploy wZION ERC-20** na Base/Arbitrum | ✅ TESTNET hotovo (`0x0c4937...`) |
| 6.9 | **Bridge backend spuštěn** — ZION L1 ↔ wZION | ✅ TESTNET hotovo |
| 6.10 | **Uniswap pool vytvořen** — wZION/ETH | ✅ TESTNET hotovo (`0xcCEaD5...`, tick -99040) |
| 6.11 | **Počáteční likvidita** — malá, kontrolovaná | 🔲 seed-liquidity.ts připraven |
| 6.12 | **Price discovery** — první reálná cena ZION | 🔲 po seeding |

**DEX strategie (správná sekvence):**
```
1️⃣  Base / Arbitrum (Uniswap v3)     ← PRVNÍ (legitimita, nízké fees)
2️⃣  BNB Chain (PancakeSwap)           ← DRUHÝ (retail, levné)
3️⃣  Polygon (QuickSwap)               ← TŘETÍ (rozšíření)
❌  Solana (Jupiter)                   ← POZDĚJI (jiný stack, SPL token)
❌  ETH mainnet (Uniswap)             ← AŽ PO VOLUME (drahé gas)
```

> ⚠️ **Co NIKDY nedělat:**
> - ❌ DEX hned první den Mainnetu
> - ❌ Marketing "investujte"
> - ❌ Slib ceny
> - ❌ Víc wrapped tokenů než locked ZION
> - ❌ Listing za každou cenu

### 6C: CoinMarketCap & CoinGecko (Dny 30-60)
**⏱️ Únor–Březen 2027**

| # | Úkol | Stav |
|---|------|------|
| 6.13 | **CoinGecko application** — submit s mainnet daty | ⬜ |
| 6.14 | **CoinMarketCap application** — submit s mainnet daty | ⬜ |
| 6.15 | **Supply data feed** — automatický update | ⬜ |
| 6.16 | **Logo + metadata** — dle CMC/CG specifikací | ⬜ |

**CMC/CG komunikace (správná věta):**
```
"ZION is a decentralized, open-source blockchain protocol
 focused on infrastructure, governance and experimentation
 with consciousness-aware systems."
```

### 6D: CEX Outreach — Tier-3 (Dny 45-120)
**⏱️ Březen–Květen 2027**

| # | Úkol | Stav |
|---|------|------|
| 6.17 | **MEXC outreach** — listing application | ⬜ |
| 6.18 | **XT.com outreach** — listing application | ⬜ |
| 6.19 | **CoinEx outreach** — listing application | ⬜ |
| 6.20 | **Node setup guide pro burzy** — technická dokumentace | ⬜ |
| 6.21 | **Deposits/withdrawals test** — end-to-end s burzou | ⬜ |
| 6.22 | **Emergency contact** — 24/7 Telegram/Signal pro burzy | ⬜ |

**Co burzy kontrolují:**
- ✅ MainNet stabilita (min. týdny)
- ✅ Reorg politika (max 10 bloků)
- ✅ Deposits/withdrawals test
- ✅ Node dokumentace
- ✅ Kontakt na core dev ("Kdo to opraví ve 3 ráno?")
- ✅ Premine disclosure + transparentní adresy

**Reálná cesta na burzy:**
```
1️⃣  DEX (wZION na Uniswap)              ← legitimita + price discovery
2️⃣  CoinGecko / CoinMarketCap           ← viditelnost
3️⃣  Tier-3 CEX (MEXC, XT, CoinEx)       ← první CEX
4️⃣  Likvidita + volume + historie         ← organický růst
5️⃣  Tier-2 CEX (Gate.io, KuCoin)         ← až po prokazatelném volume
❌  Binance / Coinbase / Kraken           ← NE jako první krok
```

> 📌 **Zapomeň na Binance jako první krok.** Přijdou až po hashrate + volume.

### 6E: DAO & Governance (Dny 60-120)
| # | Úkol | Stav |
|---|------|------|
| 6.23 | DAO governance v1 — read-only → proposal → vote | ⬜ |
| 6.24 | První testovací proposal | ⬜ |
| 6.25 | Quorum pravidla aktivní | ⬜ |
| 6.26 | DAO Treasury policy (veřejná) | ⬜ |

---

## 💰 Premine Allocation & Funding Model

### Genesis Premine — 16,280,000,000 ZION

| Kategorie | ZION | Podíl | Lock | Použití |
|-----------|------|-------|------|--------|
| ZION OASIS + Winners Golden Egg/Xp | 8,250,000,000 | 50.7% | Okamžitě dostupné | Pool bonusy, XP rewards (L4) |
| DAO Treasury | 4,000,000,000 | 24.6% | Okamžitě dostupné | Granty, bounty, ekosystém |
| Infrastructure & Dev | 2,500,000,000 | 15.4% | Okamžitě dostupné | Servery, AI, vývoj, audity |
| Humanitarian Fund | 1,530,000,000 | 9.4% | Okamžitě dostupné | Humanitární iniciativy |
| **Celkem** | **16,280,000,000** | **100%** | — | — |

### Funding Model (bez firmy)

**3 koše premine použití:**
```
🧱 1. INFRASTRUCTURE (největší část)
   └── Servery, OASIS backend, AI inference, monitoring, security
   └── Peníze jdou PŘÍMO poskytovatelům (Hetzner, OVH, AWS...)
   └── ❌ Nejsou příjem → žádná daň

🛠️ 2. DEVELOPMENT GRANTS
   └── Granty pro nezávislé contributory (včetně core deva)
   └── Vždy: účel + milestone + nepravidelně
   └── Formulace: "development grant for open-source contribution"

🌱 3. COMMUNITY & ECOSYSTEM
   └── Bounty, dokumentace, edukace, překlady, hackathony
```

**Klíčová věta pro burzy:**
> *"Premine funds are used for infrastructure costs and discretionary development grants to independent contributors. There is no company, no payroll, and no profit-sharing."*

### External Revenue Allocation — 50/50 Split

```
External Mining (ETC/RVN/XMR/FLUX...)
         │
         ▼
    BTC Payouts (2miners, NiceHash...)
         │
    ┌────┴────┐
    │         │
   50%       50%
    │         │
    ▼         ▼
  BURN     CREATORS RENT
  ZION →   BTC/ZION přímo
  Burn 🔥  stvořitelům projektu
  address  (dev, infra, marketing, team)
```

**Klíčové adresy:**
- **Burn Address:** `zion1burn0000000000000000000000000000000dead` (bez privátního klíče)
- **Creators Address:** `zion1creators000000000000000000000000000rent` (multisig stvořitelů)
- Veřejná BTC adresa: `bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw`

**Pravidla:**
- Revenue split je **z externího BTC revenue**, NE z block rewardu, NE z emise
- 50% → buyback ZION → burn → deflace (supply klesá)
- 50% → creators rent → vývoj, infrastruktura, marketing, tým
- Nemůže být změněno bez hard forku a konsensu komunity
- Obě strany jsou **on-chain ověřitelné** — transparentní
- Implementováno v kódu: `core/src/blockchain/burn.rs` — `BURN_SHARE_PERCENT = 50`, `CREATORS_SHARE_PERCENT = 50`

> 📌 **Tohle není founder tax. Je to provozní model — 50% deflace pro všechny držitele, 50% renta pro udržitelný rozvoj projektu.**

### Multichain Revenue → 50% Deflace + 50% Creators Rent

```
┌──────────────────────────────────────────────────────────────┐
│          ZION REVENUE & DEFLATIONARY MODEL                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ETC Pool ─┐                                                 │
│  RVN Pool ─┼──▶ BTC Revenue ──┬──▶ 50% Buyback ZION → Burn 🔥│
│  XMR Pool ─┤                  │                              │
│  FLUX Pool─┘                  └──▶ 50% Creators Rent 🏠     │
│                                      │                       │
│                                      ▼                       │
│                    ┌─────────────────────────────┐           │
│                    │ BURN: Supply ↓ → Value ↑   │           │
│                    │ RENT: Dev + Infra + Growth  │           │
│                    └─────────────────────────────┘           │
│                                      │                       │
│                                      ▼                       │
│                          More miners → repeat 🔄            │
│                                                              │
│  🔄 FLYWHEEL: More miners → more BTC → more burn + rent    │
│              → less supply + better product                  │
│              → higher demand → more miners → ...             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📅 Přehled Timeline

```
2026 MAINNET ROADMAP
═══════════════════════════════════════════════════════════════

         ÚNO     BŘE     DUB     KVĚ     ČER     ČEC     SRP     ZÁŘ     ŘÍJ     LIS     PRO
         ╔╗
REPO     ║║  Čisté repo Zion-2.9.5 + migrace kódu
         ╚╝
         ╔═══════════════╗
FÁZE 0   ║  SPEC FREEZE  ║  Reward, Genesis, DAA, Fee, Wallet
         ║  CORE REWRITE ║
         ╚═══════════════╝
                         ╔═══════════════╗
FÁZE 1                   ║   HARDENED    ║  Reset, Tests, Stability, DoS
                         ║   TESTNET    ║
                         ╚═══════════════╝
                                         ╔═══════════════╗
FÁZE 2                                   ║  NODE UX &   ║  CLI, Explorer, Mining
                                         ║   MINING     ║
                                         ╚═══════════════╝
                                                         ╔═══════════════╗
FÁZE 3                                                   ║  INFRA &     ║  Seeds, Legal, Exchange
                                                         ║   LEGAL      ║
                                                         ╚═══════════════╝
                                                                         ╔═══════════════╗
FÁZE 4                                                                   ║  DRESS       ║  Audit, Freeze
                                                                         ║ REHEARSAL    ║
                                                                         ╚═══════════════╝
                                                                                         ╔════╗
FÁZE 5                                                                                   ║ 🚀║  LAUNCH
                                                                                         ╚════╝

REPOZITÁŘE:
├── github.com/Yose144/Zion-2.9-main  → 🗄️  ARCHIVED (historický referenční archiv)
└── github.com/Yose144/Zion-2.9.5    → 🚀  ACTIVE (mainnet produkční kód)

═══════════════════════════════════════════════════════════════
```

---

## 🧭 ZION Layer Architecture — L1 → L4

> **"Čistý L1 blockchain je základ. Nad ním stavíme nekonečný ekosystém."**

```
╔══════════════════════════════════════════════════════════════════════╗
║                    ZION TERRANOVA — LAYER STACK                     ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  L4  🎮 ZION OASIS                                    [2029+]       ║
║      ├── UE5 open-world (consciousness mining as gameplay)           ║
║      ├── XP / Consciousness Level systém                             ║
║      ├── NFT avatary, předměty, území                                ║
║      ├── Play-to-Mine — herní aktivity → hashrate                    ║
║      └── Metaverse ekonomika napojená na L1 ZION                     ║
║                          ▲                                           ║
║  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ║
║                          │                                           ║
║  L3  🧠 WARP & AI NATIVE                              [2027 Q3+]   ║
║      ├── NCL (Neural Compute Layer) — AI task marketplace            ║
║      ├── AI Orchestrátor — autonomous agent routing                  ║
║      ├── Knowledge Extractor — learns from sessions                  ║
║      ├── Warp Bridges — cross-chain asset teleportation              ║
║      └── AI Native SDK — build conscious agents on ZION              ║
║                          ▲                                           ║
║  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ║
║                          │                                           ║
║  L2  💱 DEX & DeFi LAYER                              [2027 Q1-Q2] ║
║      ├── Atomic Swaps (ZION ↔ BTC/ETH/XMR)                          ║
║      ├── ZION DEX — on-chain orderbook / AMM                        ║
║      ├── Wrapped ZION (wZION na EVM chains)                          ║
║      ├── Liquidity Pools & Yield                                     ║
║      └── Buyback Engine (BTC revenue → 50% burn 🔥 + 50% rent 🏠)  ║
║                          ▲                                           ║
║  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ║
║                          │                                           ║
║  L1  ⛓️ ZION BLOCKCHAIN (MainNet)                     [2026] ✅     ║
║      ├── PoW Cosmic Harmony v3 — ASIC-resistant                      ║
║      ├── UTXO model + Ed25519 signatures                             ║
║      ├── 5,400.067 ZION/block konstantní emise                       ║
║      ├── 16.28B genesis premine (time-locked)                        ║
║      ├── LWMA DAA (60-block, ±25%)                                   ║
║      ├── Fee burning — ALL fees destroyed                            ║
║      ├── Max reorg 10 bloků, soft finality 60                        ║
║      ├── Coinbase maturity 100 bloků                                 ║
║      └── P2P síť, IBD sync, seed nodes                               ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

### Klíčový princip: Každý layer je NEZÁVISLÝ

| Layer | Závisí na | Může existovat bez |
|-------|-----------|--------------------|
| **L1** Blockchain | Nic — standalone | Vše nad ním |
| **L2** DEX/DeFi | L1 (UTXO, TX) | L3, L4 |
| **L3** Warp/AI | L1 + L2 (tokeny, swaps) | L4 |
| **L4** Oasis | L1 + L2 + L3 (plný stack) | — |

> **L1 je srdce. Nikdy nekompromitujeme L1 kvůli vyšším vrstvám.**

### Co JE na L1 MainNetu (2026)
- ✅ PoW mining (Cosmic Harmony v3)
- ✅ UTXO model s Ed25519 signaturami
- ✅ 5,400.067 ZION konstantní emise
- ✅ 16.28B genesis premine (time-locked)
- ✅ LWMA DAA (±25%, 60-blok okno)
- ✅ Fee burning
- ✅ P2P decentralizovaná síť
- ✅ Max reorg 10 bloků
- ✅ Coinbase maturity 100 bloků

### Co NENÍ na L1 (patří do vyšších layerů)
- ❌ XP / Consciousness Level systém → **L4 Oasis**
- ❌ NCL (Neural Compute Layer) → **L3 Warp/AI**
- ❌ Consciousness bonus v coinbase → **L4 Pool Bonus (z 8.25B premine)**
- ❌ DEX / Atomic Swaps → **L2 DeFi**
- ❌ AI Orchestrátor → **L3 AI Native**
- ❌ Gamifikace → **L4 Oasis**
- ❌ DAO governance → **L2/L3** (post-launch)
- ❌ Smart contracts → budoucí
- ❌ Presale tokeny → NEEXISTUJÍ

---

## 🎮 L4 — ZION Oasis + XP/Consciousness System
**📅 2027 Q4 — 2028+ | Plný stack L1+L2+L3 potřeba**

### XP & Consciousness Level System

```
╔══════════════════════════════════════════════════════════════════╗
║              CONSCIOUSNESS EVOLUTION PATH                        ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Level 0: PHYSICAL         0 XP        1.0× multiplier          ║
║  ├── Nový miner, právě připojený                                 ║
║  └── Unlock: nic                                                 ║
║                                                                  ║
║  Level 1: EMOTIONAL      1,000 XP      1.05× multiplier         ║
║  ├── Prvních 1000 shares odtěženo                                ║
║  ├── Oasis: základní avatar + starter territory                  ║
║  └── Unlock: pool chat, basic avatar                             ║
║                                                                  ║
║  Level 2: MENTAL        10,000 XP      1.10× multiplier         ║
║  ├── Stabilní miner, 10k+ shares                                 ║
║  ├── Oasis: vlastní dům, NPC interakce, crafting                 ║
║  └── Unlock: DAO voting (read), guild membership                 ║
║                                                                  ║
║  Level 3: SPIRITUAL    100,000 XP      1.25× multiplier         ║
║  ├── Veterán, 100k+ shares, 30+ dní                              ║
║  ├── Oasis: vlastní farma/manufaktura, quest design              ║
║  └── Unlock: DAO proposals, guild creation                       ║
║                                                                  ║
║  Level 4: COSMIC     1,000,000 XP      1.50× multiplier         ║
║  ├── Top miner, 1M+ shares, 180+ dní                             ║
║  ├── Oasis: city builder, NPC army, rare items                   ║
║  └── Unlock: validator nomination, rare gear, mentor role        ║
║                                                                  ║
║  Level 5: ON_THE_STAR 10,000,000 XP    2.0× multiplier          ║
║  ├── Legendární status, 10M+ shares, 1+ rok                      ║
║  ├── Oasis: vlastní realm, world events, unique abilities        ║
║  └── Unlock: council seat, veto power, legendary NFTs            ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

### XP Sources

| Aktivita | XP Reward | Kde | Layer |
|----------|-----------|-----|-------|
| Share submitted | 10 XP | Pool mining | L1 pool |
| Block found | 1,000 XP | Pool mining | L1 pool |
| Uptime bonus (24h) | 500 XP | Pool mining | L1 pool |
| Referral (nový miner) | 200 XP | Pool/Web | L2 |
| Quest completed (Oasis) | 50–5,000 XP | ZION Oasis | L4 |
| Territory captured | 2,000 XP | Oasis PvP | L4 |
| AI task completed (NCL) | 100–10,000 XP | NCL marketplace | L3 |
| DAO vote cast | 100 XP | Governance | L2 |
| Bug bounty | 10,000 XP | Security | L1 |

### XP → Real Benefits

```
XP je OFFCHAIN (pool-level databáze, NE na L1 blockchainu).
L1 zůstává čistý — žádné XP v konsensus pravidlech.

1. POOL BONUS    — z Mining Operators premine 8.25B ZION
                   Bonus = base_share × consciousness_multiplier
2. DAO WEIGHT    — vote_weight = zion_balance × xp_multiplier
3. OASIS PERKS   — lepší avatar, větší území, rare items
4. NCL PRIORITY  — vyšší level = lepší AI tasky
5. SOCIAL STATUS — badges, titles, leaderboard
```

### XP Anti-Abuse
| Hrozba | Ochrana |
|--------|--------|
| Fake shares | Share validace na pool — invalid = 0 XP + ban |
| Sybil attack | Min hashrate threshold pro XP |
| AFK farming | Uptime bonus vyžaduje skutečné shares |
| XP inflation | Hard cap 50,000 XP/den per miner |
| Whale buying | XP je non-transferable, non-tradeable |

### ZION Oasis — UE5 Game Features
- 🏠 **Territory** — mine, build, defend
- ⚔️ **PvP** — territory wars, resource competition
- 🎭 **Quests** — story-driven consciousness journey
- 🏪 **Marketplace** — trade items, NFTs, resources (ZION)
- 🌍 **World Events** — community-wide challenges
- 🎨 **Crafting** — mine materials → create items/buildings
- 👥 **Guilds** — pool-based teams, shared territories

### L4 Milníky
| Milestone | Target | Prerekvizita |
|-----------|--------|-------------|
| L4-M1: XP Service (offchain) | 2027 Q2 | L1 stable |
| L4-M2: Consciousness Level Calculator | 2027 Q2 | L4-M1 |
| L4-M3: Pool bonus distribution | 2027 Q3 | L4-M2 |
| L4-M4: Oasis UE5 prototyp | 2027 Q3 | — |
| L4-M5: Oasis wallet integration | 2027 Q4 | L4-M4 + L1 |
| L4-M6: Quest system + NPC AI | 2027 Q4 | L4-M4 + L3 |
| L4-M7: Territory wars (PvP) | 2028 Q1 | L4-M6 |
| L4-M8: Marketplace (NFT + items) | 2028 Q1 | L4-M5 + L2 |
| L4-M9: Oasis public beta | 2028 Q2 | All above |

---

## 💱 L2 — DEX & DeFi Layer
**📅 2027 Q1–Q2 | Po stabilním L1 MainNetu**

| # | Komponenta | Popis |
|---|-----------|-------|
| L2.1 | **Atomic Swaps** | ZION ↔ BTC/ETH/XMR (HTLC) |
| L2.2 | **ZION DEX** | On-chain AMM / orderbook |
| L2.3 | **Wrapped ZION (wZION)** | ERC-20 na EVM chains |
| L2.4 | **Liquidity Pools** | AMM pooly ZION/BTC, ZION/ETH |
| L2.5 | **Buyback Engine v2** | BTC→ZION: 50% burn 🔥 + 50% creators rent 🏠 |
| L2.6 | **DAO Governance v1** | Token-weighted voting |

---

## 🧠 L3 — Warp & AI Native Systems
**📅 2027 Q3+ | Po stabilním L2**

| # | Komponenta | Popis |
|---|-----------|-------|
| L3.1 | **NCL (Neural Compute Layer)** | Decentralizovaný AI task marketplace |
| L3.2 | **AI Orchestrátor** | Autonomous agent routing |
| L3.3 | **Knowledge Extractor** | Self-learning z konverzací |
| L3.4 | **Warp Bridges** | Cross-chain (ZION↔ETH/SOL/TRX/XLM/ADA/ATOM/BTC) — 🟡 Skeleton HOTOV |
| L3.5 | **AI Native SDK** | Framework pro conscious agents |
| L3.6 | **Compute Marketplace** | Miners prodávají GPU cykly za ZION |

---

## 📅 Full Stack Timeline — L1 → L4

```
2026                            2027                           2028
Q1   Q2   Q3   Q4    Q1   Q2   Q3   Q4    Q1   Q2   Q3   Q4
╔════════════════════╗
║ L1 BLOCKCHAIN      ║ ← MainNet Launch 31.12.2026
║ Fáze 0-5 HOTOVO ✅ ║
║ Fáze 1-4 TestNet   ║
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
```

---

## ⚡ Quick Reference — Prioritizovaný To-Do

| Prio | Úkol | Fáze | Stav |
|------|------|------|------|
| **P0-0** | 🆕 Vytvořit čisté repo `Zion-2.9.5` + migrace kódu | 0.0 | ✅ HOTOVO (`c1d8e34`) |
| **P0-1** | Přepsat `reward.rs` (5,400 ZION konstantní) | 0.1 | ✅ HOTOVO (`cad8a62`) |
| **P0-2** | Vytvořit `genesis.rs` (16.28B premine) | 0.1 | ✅ HOTOVO (`cad8a62`) |
| **P0-3** | Coinbase maturity (100 bloků) | 0.5 | ✅ HOTOVO (`19787a7`) |
| **P0-4** | Přepsat DAA na LWMA (±25%) | 0.2 | ✅ HOTOVO (`be0beb0`) |
| **P0-5** | Max reorg depth = 10 | 0.5 | ✅ HOTOVO (`19787a7`) |
| **P0-6** | Fee burning | 0.3 | ✅ HOTOVO (`4ed3a04`) |
| **P0-7** | Wallet send E2E | 0.4 | ✅ HOTOVO (`b8112eb`) |
| **P1-1** | TestNet reset + deploy 3 servery | 1.0 | ✅ HOTOVO (`16438a7`) |
| **P1-2** | Config validation (70 testů) | 1.1 | ✅ HOTOVO (`16438a7`) |
| **P1-3** | Security & Edge-Case (29 testů) | 1.2 | ✅ HOTOVO (`7e85e84`) |
| **P1-4** | IBD Hardening (42 testů) | 1.3 | ✅ HOTOVO (`9bd901b`) |
| **P1-5** | Pool Payout (23 testů) | 1.4 | ✅ HOTOVO (`967a36b`) |
| **P1-6** | Buyback 50% burn + 50% creators (26 testů) | 1.5/M6 | ✅ HOTOVO |
| **P1-7** | 72h+ stability run | 1.6 | ⬜ |
| **P1-8** | Block explorer | 2.3 | ⬜ |
| **P1-9** | Security audit | 4.2 | ⬜ |
| **P2-1** | Legal docs (5 souborů hotovo ✅) | 3.3 | ✅ HOTOVO |
| **P2-2** | Exchange readiness (wZION + CMC) | 3.4 | ⬜ |
| **P2-3** | wZION ERC-20 kontrakt + bridge relay crate | 3.4 | ✅ HOTOVO (`c46228b`) |
| **P2-3b** | 🌀 WARP Skeleton — 7 chain adapterů (22 souborů) | L3.4 | ✅ HOTOVO |
| **P2-4** | Supply API endpoint | 3.4 | ⬜ |
| **P2-5** | DEX listing (Base/Arbitrum) | 6B | ⬜ |
| **P2-6** | CMC + CoinGecko application | 6C | ⬜ |
| **P2-7** | Tier-3 CEX outreach (MEXC, XT) | 6D | ⬜ |
| **P2-8** | Premine disclosure (exchange-safe) | 3.3 | ✅ HOTOVO |

---

## 📖 Referenční Dokumenty

| Dokument | Účel |
|----------|------|
| `docs/whitepaper-v2.9.5/04_ECONOMIC_MODEL.md` | Autoritativní ekonomický model |
| `docs/mainnet/MAINNET_CONSTITUTION.md` | Neměnné parametry |
| `docs/mainnet/MAINNET_CHECKLIST.md` | Technický checklist |
| `docs/mainnet/EXCHANGE_READINESS.md` | Strategie listingu |
| `docs/whitepaper-v2.9.5/05_FAIR_LAUNCH.md` | Fair Launch rozhodnutí |
| `docs/whitepaper-v2.9.5/09_ROADMAP.md` | WP2.9.5 roadmap |
| `legal/DISCLAIMER.md` | Obecný disclaimer |
| `legal/TOKEN-NOT-SECURITY.md` | Proč ZION není security |
| `legal/NO-INVESTMENT.md` | Žádné investiční sliby |
| `legal/RISK-DISCLOSURE.md` | Rizika pro uživatele |
| `legal/PREMINE-DISCLOSURE.md` | Transparentní premine vysvětlení |
| `docs/L2_WZION_BRIDGE.md` | L2 wZION Bridge architektura |
| `docs/WARP_ARCHITECTURE.md` | L3 WARP multi-chain architektura |
| `Pre-Mainnet.md` | Pre-mainnet analýza (archiv) |
| `PripravaNaMainet.md` | Mapa cesty + legal + exchange strategie (archiv) |

---

**Dokument vytvořen: 8. února 2026**  
**Poslední aktualizace: 9. února 2026 — Fáze 0+1 DOKONČENY | L2 Bridge HOTOV | L3 WARP Skeleton HOTOV (7 chain families, 22 souborů)**  
**Další krok: Fáze 1.6+ — 72h stability run | WARP Phase 3+ — Solana SPL + Anchor deployment**  
**Odpovědnost: Core team**

---

### Layer Stack Summary
```
L4  🎮 OASIS      — Consciousness mining jako hra, XP, guilds, territories
L3  🧠 WARP/AI    — NCL, AI agents, cross-chain bridges
L2  💱 DEX/DeFi   — Atomic swaps, AMM, DAO governance
L1  ⛓️  BLOCKCHAIN — PoW, UTXO, 5400 ZION/block, fee burn ← JSME ZDE ✅
```

🌟 *"L1 Blockchain · L2 DeFi · L3 AI · L4 Oasis — The Full Stack of Consciousness"* 🌟
