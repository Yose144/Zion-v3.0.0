# 🚀 ZION v2.9.5 — MainNet Launch Plan

**Datum:** 8. února 2026 (aktualizováno)  
**Verze:** 2.9.5 "Clean L1 → Full Stack"  
**Target:** L1 MainNet Launch 31.12.2026  
**Nové repo:** [github.com/Yose144/Zion-2.9.5](https://github.com/Yose144/Zion-2.9.5)  
**Stav L1:** ✅ Fáze 0 DOKONČENA — 3 nody online, 155 testů

---

## 🏛️ ZION Layer Architecture — L1 → L4

> **"Jednoduchý L1 blockchain, který funguje bezchybně, je základem pro nekonečný ekosystém nad ním."**

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
║      └── Buyback Engine (BTC revenue → 100% DAO Treasury 🏛️)                   ║
║                          ▲                                           ║
║  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ║
║                          │                                           ║
║  L1  ⛓️ ZION BLOCKCHAIN (MainNet)                     [2026] ✅     ║
║      ├── PoW Cosmic Harmony v3 — ASIC-resistant                      ║
║      ├── UTXO model + Ed25519 signatures                             ║
║      ├── 5,400.067 ZION/block konstantní emise                       ║
║      ├── 16.78B genesis premine (immediately unlocked)               ║
║      ├── LWMA DAA (60-block, ±25%)                                   ║
║      ├── Fee burning — ALL fees destroyed                            ║
║      ├── Max reorg 10 bloků, soft finality 60                        ║
║      ├── Coinbase maturity 100 bloků                                 ║
║      ├── P2P síť, IBD sync, seed nodes                               ║
║      └── Mining pool (Stratum v2, PPLNS)                             ║
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

---

## 🎯 L1 — Mainnet Blockchain (AKTUÁLNÍ FOKUS)

### Co JE L1:
- ✅ Nativní Rust blockchain (PoW, UTXO, Ed25519)
- ✅ Konstantní emise 5,400.067 ZION/block (žádný halving)
- ✅ Genesis premine 16.78B (4 UTXOs, immediately unlocked)
- ✅ LWMA DAA (60-block window, ±25%)
- ✅ Fee burning (all fees destroyed)
- ✅ Mining pool (Stratum v2, PPLNS)
- ✅ Universal miner (CPU + GPU)
- ✅ Wallet CLI (generace, send, receive)
- ✅ P2P síť s IBD synchronizací
- ✅ Block explorer API
- ✅ 3 seed nody (Helsinki, USA, Singapore) — **ONLINE**

### Co NENÍ na L1 (vyšší layery):
- ❌ XP / Consciousness systém → **L4 Oasis**
- ❌ NCL (Neural Compute Layer) → **L3 Warp/AI**
- ❌ DEX / Atomic Swaps → **L2 DeFi**
- ❌ AI Orchestrátor → **L3 AI Native**
- ❌ Gamifikace → **L4 Oasis**
- ❌ DAO governance → **L2/L3** (post-launch)

---

## 📊 Aktuální stav vs. potřeba

| Komponenta | Stav | Potřeba pro MainNet | Práce |
|------------|------|---------------------|-------|
| **Block structure** | ✅ Hotovo | Ponechat | — |
| **UTXO model + Ed25519** | ✅ Hotovo | Ponechat | — |
| **LMDB Storage** | ✅ Hotovo | Ponechat | — |
| **Block validation (9 kroků)** | ✅ Hotovo | Ponechat | — |
| **Cosmic Harmony PoW** | ✅ Hotovo | Ponechat | — |
| **Reorg / Fork choice** | ✅ Hotovo | Napojit na P2P | Střední |
| **DAA (difficulty)** | ✅ Hotovo | Ponechat | — |
| **Premine definice** | ✅ Hotovo | Reálné adresy | Nízká |
| **Wallet CLI (gen/sign)** | ✅ Hotovo | + send příkaz | Střední |
| **Stratum Pool** | ✅ Hotovo | Odstranit XP/NCL | Nízká |
| **PPLNS Payouts** | ✅ Hotovo | + wallet signing | Střední |
| **Share validation** | ✅ Hotovo | Ponechat | — |
| **Miner CPU/GPU** | ✅ Hotovo | Ponechat | — |
| **Revenue Proxy** | ✅ Hotovo | Ponechat | — |
| **Profit Switcher** | ✅ Hotovo | Ponechat | — |
| **Buyback Engine** | ✅ Hotovo | + DEX integrace | Střední |
| **P2P Handshake** | ✅ Hotovo | Ponechat | — |
| **P2P Block relay** | ✅ Hotovo | Ponechat | — |
| **P2P IBD (Initial Block Download)** | ❌ Chybí | **KRITICKÉ** | Vysoká |
| **Emission schedule / halving** | ❌ Chybí | **KRITICKÉ** | Střední |
| **Coinbase maturity lock** | ❌ Chybí | **KRITICKÉ** | Nízká |
| **Mempool double-spend** | ⚠️ Partial | Zapnout validaci | Nízká |
| **Fee market** | ❌ Chybí | Implementovat | Střední |
| **Wallet send command** | ❌ Chybí | **KRITICKÉ** | Střední |
| **Block explorer API** | ⚠️ Partial | Doplnit endpointy | Nízká |
| **Genesis block (mainnet)** | ❌ Chybí | Vytvořit | Nízká |

---

## 🏗️ Architektura Čistého Repo

```
zion-2.9.5-mainnet/
├── Cargo.toml                    # Workspace root
├── README.md                     # Mainnet documentation
├── LICENSE
│
├── zion-core/                    # L1 Blockchain Node
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs               # Node entry point
│       ├── lib.rs                # Module registry
│       ├── blockchain/
│       │   ├── block.rs          # Block + BlockHeader
│       │   ├── chain.rs          # Chain management
│       │   ├── consensus.rs      # DAA + difficulty
│       │   ├── validation.rs     # 9-step block validation
│       │   ├── reward.rs         # ⚡ PŘEPSAT: emission schedule + halving
│       │   ├── premine.rs        # Premine with real addresses
│       │   └── reorg.rs          # Chain reorganization
│       ├── state/
│       │   └── mod.rs            # BlockchainState + mempool
│       ├── storage/
│       │   └── lmdb.rs           # LMDB persistence
│       ├── tx/
│       │   └── mod.rs            # Transaction + UTXO model
│       ├── crypto/
│       │   ├── keys.rs           # Ed25519 + zion1 addresses
│       │   └── hash.rs           # Blake3 hashing
│       ├── mempool/
│       │   ├── pool.rs           # ⚡ PŘEPSAT: fee ordering + double-spend
│       │   └── eviction.rs       # Eviction policy
│       ├── p2p/
│       │   ├── mod.rs            # P2P server + handler
│       │   ├── messages.rs       # Protocol messages
│       │   ├── peers.rs          # Peer manager
│       │   ├── security.rs       # Rate limiter + blacklist
│       │   ├── seeds.rs          # Seed nodes
│       │   ├── heartbeat.rs      # Keep-alive
│       │   ├── persistence.rs    # Peer persistence
│       │   └── sync.rs           # ⚡ NOVÝ: IBD + chain sync
│       ├── rpc/
│       │   ├── server.rs         # Axum REST API
│       │   └── methods.rs        # RPC handlers
│       ├── jsonrpc/
│       │   └── mod.rs            # JSON-RPC 2.0
│       ├── algorithms/
│       │   ├── cosmic_harmony.rs # CHv1
│       │   ├── cosmic_harmony_v2.rs # CHv2
│       │   ├── randomx.rs        # RandomX
│       │   ├── yescrypt.rs       # Yescrypt
│       │   └── blake3_algo.rs    # Blake3
│       ├── metrics/
│       │   └── mod.rs            # Prometheus
│       └── bin/
│           └── zion-wallet.rs    # ⚡ ROZŠÍŘIT: + send command
│
├── zion-pool/                    # Mining Pool
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs               # Pool entry (BEZ NCL)
│       ├── config.rs             # Pool configuration
│       ├── stratum/
│       │   ├── server.rs         # Stratum v2 server (BEZ XP)
│       │   ├── session.rs        # Session management
│       │   ├── vardiff.rs        # Variable difficulty
│       │   ├── revenue_proxy.rs  # ✅ External pool proxy
│       │   ├── profit_switcher.rs # ✅ Algo switching
│       │   ├── buyback_engine.rs  # ✅ BTC→ZION buyback
│       │   └── pool_external_miner.rs # ✅ xmrig subprocess
│       ├── shares/
│       │   ├── validator.rs      # Share validation
│       │   ├── storage.rs        # Redis share storage (BEZ XP)
│       │   └── processor.rs      # Share pipeline (BEZ XP)
│       ├── pplns/
│       │   └── calculator.rs     # PPLNS rewards
│       ├── payout/
│       │   ├── scheduler.rs      # Payout scheduler
│       │   └── manager.rs        # ⚡ ROZŠÍŘIT: wallet signing
│       ├── blockchain/
│       │   ├── rpc_client.rs     # Core RPC client
│       │   └── template_manager.rs # Block templates
│       └── metrics/
│           └── prometheus.rs     # Pool metrics
│
├── zion-miner/                   # Universal Miner
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs               # Miner CLI (BEZ NCL)
│       ├── miner/
│       │   ├── mod.rs            # Miner orchestration
│       │   ├── cpu.rs            # CPU mining
│       │   ├── gpu/              # GPU mining (Metal/OpenCL/CUDA)
│       │   ├── native_algos.rs   # Native algorithm bindings
│       │   └── multichain.rs     # Multi-chain support
│       └── stratum/
│           ├── mod.rs            # Stratum client
│           └── ethstratum.rs     # EthStratum client
│
├── zion-cosmic-harmony-v3/       # PoW Algorithm Crate
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs                # Algorithm library
│       ├── algorithms_opt.rs     # Optimized hashers
│       ├── ffi.rs                # C-FFI interface
│       └── gpu/
│           ├── metal.rs          # Metal GPU miner
│           ├── opencl.rs         # OpenCL GPU miner
│           ├── cosmic_harmony_v3.metal
│           └── cosmic_harmony_v3.cl
│
├── config/
│   ├── mainnet_genesis.json      # ⚡ NOVÝ: Mainnet genesis block
│   ├── pool_config.json          # Pool configuration
│   └── ch3_revenue_settings.json # Revenue streams config
│
├── docker/
│   ├── Dockerfile.core           # Core node image
│   ├── Dockerfile.pool           # Pool image
│   └── Dockerfile.miner          # Miner image
│
├── docker-compose.yml            # Full stack
├── scripts/
│   ├── deploy.sh                 # Production deploy
│   ├── build-all-platforms.sh    # Cross-compile
│   └── genesis-generator.sh      # Generate mainnet genesis
│
└── docs/
    ├── WHITEPAPER.md             # Economic model
    ├── MINING_GUIDE.md           # How to mine
    ├── API_REFERENCE.md          # RPC/API docs
    ├── DEPLOYMENT_GUIDE.md       # Node operator guide
    └── GPU_MINING_GUIDE.md       # GPU mining
```

### Co se NEMĚŘÍ z 2.9.5:
```
❌ consciousness/          — celý modul (XP tracker, rewards, blockchain integration)
❌ ncl.rs                  — NCL manager (AI tasks)
❌ miner/src/ncl/           — NCL client
❌ miner/src/consciousness/ — consciousness display
❌ ai/                      — AI orchestrator, knowledge extractor
❌ desktop-agent/           — Electron app
❌ frontend/                — Next.js dashboard (until explorer needed)
❌ website-v2.9/            — Marketing web
❌ golden_egg/              — Gamification
❌ dao/                     — DAO governance
```

---

## 📋 Milníky (M0–M8)

### M0: Repo Setup + Clean Migration (1 týden)
**Target:** Čistý Rust workspace s funkčním `cargo build + cargo test`

- [ ] Vytvořit workspace Cargo.toml (zion-core, zion-pool, zion-miner, zion-cosmic-harmony-v3)
- [ ] Migrovat core src/ — **bez** consciousness konstant ve validaci
- [ ] Migrovat pool src/ — **bez** ncl.rs, consciousness/, XP importů
- [ ] Migrovat miner src/ — **bez** ncl/, consciousness/
- [ ] Migrovat zion-cosmic-harmony-v3 — as-is (algoritmy)
- [ ] Opravit všechny importy a feature flags
- [ ] `cargo build --release` ✅
- [ ] `cargo test` — všechny relevantní testy procházejí ✅
- [ ] CI/CD pipeline (GitHub Actions)

**Done:** Clean repo compiles and passes tests.

---

### M1: Emission Schedule + Reward Model (3 dny)
**Target:** Deterministická, ověřitelná emission curve

**Ekonomický model:**
```
Total Supply:        144,000,000,000 ZION (144B)
Premine:              16,780,000,000 ZION (11.65%)
Mineable:            127,220,000,000 ZION (88.35%)

Block Time:          60 seconds
Blocks per Day:      1,440
Blocks per Year:     525,960

Initial Block Reward: 5,400 ZION
Halving Interval:    2,100,000 blocks (~4 roky)
Halvings:            ~6 (poté tail emission)
Tail Emission:       84.375 ZION/block (permanentní)

Reward Distribution:
  89% → Miner
  10% → Humanitarian Pool (ZION_HUMANITARIAN)
   1% → Pool Fee
```

**Halving schedule:**
| Era | Bloky | Reward | Kumulativní |
|-----|-------|--------|-------------|
| 0 | 0 – 2,099,999 | 5,400 ZION | 11.34B |
| 1 | 2,100,000 – 4,199,999 | 2,700 ZION | 16.98B + premine |
| 2 | 4,200,000 – 6,299,999 | 1,350 ZION | 19.81B |
| 3 | 6,300,000 – 8,399,999 | 675 ZION | 21.22B |
| 4 | 8,400,000 – 10,499,999 | 337.5 ZION | 21.93B |
| 5 | 10,500,000 – 12,599,999 | 168.75 ZION | 22.28B |
| 6+ | 12,600,000+ | 84.375 ZION (tail) | ∞ (deflační díky buyback) |

- [ ] Přepsat `reward.rs` — `get_block_reward(height) → u64` s halving logikou
- [ ] Přidat `COINBASE_MATURITY = 100` — coinbase UTXO nelze utratit 100 bloků
- [ ] Přidat coinbase maturity check do `validation.rs`
- [ ] Sjednotit pool reward kalkulátor s core
- [ ] 10 unit testů na reward boundaries
- [ ] Dokumentovat v WHITEPAPER.md

**Done:** `cargo test -- reward` all pass, emission je deterministická.

---

### M2: Mempool Security + Fee Market (3 dny)
**Target:** Bezpečný mempool s fee-based prioritizací

- [ ] Implementovat double-spend detekci v mempoolu (track spent UTXOs)
- [ ] Odmítat tx s neexistujícími UTXOs (zapnout strict mode)
- [ ] Fee-based ordering (higher fee = vyšší priorita v bloku)
- [ ] Minimum fee: 0.001 ZION per tx (anti-spam)
- [ ] Maximum mempool size: 50,000 tx s fee-based eviction
- [ ] Replace-by-fee (RBF) podpora
- [ ] Unit testy: double-spend rejection, fee ordering, eviction

**Done:** Mempool bezpečně odmítá nevalidní transakce.

---

### M3: Wallet Send Command (5 dní)
**Target:** `zion-wallet send --to zion1... --amount 100 --fee 0.01`

- [ ] UTXO selection (coin selection algorithm — smallest-first)
- [ ] Transaction building (inputs, outputs, change address)
- [ ] Ed25519 signing všech inputů
- [ ] Broadcast přes RPC (`submit_tx`)
- [ ] Confirmation tracking
- [ ] `zion-wallet balance` — zobrazit confirmed + unconfirmed
- [ ] `zion-wallet history` — zobrazit tx historii
- [ ] `zion-wallet utxos` — zobrazit nepoužité UTXOs
- [ ] Integration test: send → receive → verify balance

**Done:** Uživatel může poslat ZION z CLI.

---

### M4: P2P Initial Block Download (1 týden)
**Target:** Nový node se kompletně synchronizuje ze sítě

**Protokol:**
```
Nový node                    Seed node
    │                            │
    │──── Handshake ────────────▶│
    │◀─── Handshake + height ───│
    │                            │
    │──── GetBlocks(0, 500) ───▶│  // "dej mi bloky od výšky 0"
    │◀─── Blocks([b0..b499]) ──│
    │                            │
    │──── GetBlocks(500, 500) ─▶│
    │◀─── Blocks([b500..b999]) ─│
    │                            │
    │     ... opakuj ...         │
    │                            │
    │──── GetBlocks(tip, 500) ─▶│
    │◀─── Blocks([]) ───────────│  // prázdný = jsme v syncu
    │                            │
    │◀─── NewBlock(live) ───────│  // normální relay
```

- [ ] Implementovat `sync.rs` — IBD state machine
- [ ] `GetBlocks { start_height, limit }` → `Blocks { blocks: Vec<Block> }`
- [ ] Odpovídat na `GetBlocks` — posílat bloky z storage
- [ ] Batch validace příchozích bloků (PoW + chain)
- [ ] Sync progress reporting (% complete)
- [ ] Paralelní download z více peerů
- [ ] Přechod z IBD do normal mode po dosažení tip
- [ ] Fork detection během syncu
- [ ] Integration test: 2 nody, sync 1000 bloků

**Done:** `./zion-core` startne, najde seed, synchronizuje celý chain.

---

### M5: Pool Payout Integration (5 dní)
**Target:** Pool automaticky vyplácí minery on-chain

- [ ] Pool wallet — dedikovaný klíčový pár pro payout transakce
- [ ] Payout trigger: po každém nalezeném bloku + coinbase maturity (100 bloků)
- [ ] UTXO selection z pool wallet
- [ ] Batch payout — 1 tx s N výstupy (efektivní)
- [ ] Min payout threshold: 10 ZION
- [ ] Payout confirmation tracking
- [ ] Failsafe: retry při neúspěchu, neposílat duplicitně
- [ ] PostgreSQL evidence: payout_id, txid, amount, status
- [ ] API endpoint: `/api/payouts` — historie payoutů

**Done:** Miner po nalezení bloku obdrží ZION na svou adresu.

---

### M6: Buyback + DAO Treasury System (3 dny)
**Target:** BTC revenue z externích poolů → 100% do DAO Treasury (OASIS, development, infrastruktura)

**Revenue Split — 100% DAO Model:**
```
External Mining (ETC/RVN/XMR/FLUX...)
         │
         ▼
    BTC Payouts (2miners, NiceHash, ...)
         │
         ▼
    Revenue Engine (sledování příjmů)
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
         │
         ▼
  zion1dao...treasury
         │
         ▼
  Ekosystém roste → Hodnota roste
```

**Klíčová adresa:**
- **DAO Treasury:** `zion1dao00000000000000000000000000000treasury` (DAO multisig)
- **Burn Address:** `zion1burn0000000000000000000000000000000dead` (L1 fee burning only)

**Ekonomika:**
| Podíl | Příjemce | Účel |
|-------|----------|------|
| **100%** | 🏛️ DAO Treasury | Veškerý BTC revenue posiluje ekosystém — OASIS, vývoj, infrastruktura, marketing, tým |

**Proč 100% DAO?**
- Každý BTC v systému posiluje ekosystém a zvyšuje hodnotu pro všechny
- DAO transparentně řídí alokaci prostředků (OASIS, dev, infra, marketing)
- Deflace zajišťuje L1 fee burning (všechny transakční poplatky jsou páleny)
- On-chain ověřitelné — jedna adresa, plná transparence

**Implementace:**
- [x] DAO Treasury address — dedicovaná adresa pro veškerý BTC revenue
- [x] Burn address zachována pro L1 fee burning (bez privátního klíče)
- [x] Revenue split konstanty: `BURN_SHARE = 0%`, `DAO_SHARE = 100%`
- [x] Buyback tracking — kolik BTC vyděláno, vše jde do DAO Treasury
- [x] On-chain proof — TX na DAO adresu je veřejně ověřitelná
- [ ] API endpoint: `/api/buyback/stats` — aktuální statistiky (DAO treasury)
- [ ] Monthly report generator (transparentní přehledy)

**Done:** 100% DAO model je implementován v kódu, transparentně zdokumentovaný a on-chain ověřitelný.

---

### M7: Mainnet Genesis + Network Launch (1 týden)
**Target:** 3+ nody synchronizované, genesis block, network live

- [ ] Generovat mainnet genesis block (height 0, timestamp, premine TXs)
- [ ] Premine transakce — reálné zion1 adresy pro všechny kategorie
- [ ] Deploy na 3 servery (Helsinki, USA, Singapore)
- [ ] P2P bootstrap — ověřit IBD ze všech regionů
- [ ] DNS seeds — `seed1.zionterranova.com`, `seed2.`, `seed3.`
- [ ] Mining test — 100 bloků, verifikace rewards
- [ ] Payout test — end-to-end miner → block → payout
- [ ] Stress test — 1000 simulated miners
- [ ] Security audit — penetration test na P2P + RPC
- [ ] Firewall rules — RPC omezen, P2P otevřen
- [ ] Monitoring — Grafana dashboard pro všechny nody

**Done:** Network běží, synchronizuje, těží, vyplácí.

---

### M8: Release + Dokumentace (5 dní)
**Target:** Veřejně dostupný release pro komunitu

- [ ] GitHub release — binárky pro Linux/macOS/Windows
- [ ] Mining pool veřejně přístupný (pool.zionterranova.com:3333)
- [ ] Block explorer — základní web UI (výška, bloky, transakce, adresy)
- [ ] Aktualizovat WHITEPAPER.md — finální ekonomický model
- [ ] MINING_GUIDE.md — jak začít těžit (5 minut)
- [ ] NODE_OPERATOR_GUIDE.md — jak provozovat node
- [ ] API_REFERENCE.md — kompletní RPC dokumentace
- [ ] Security disclosure policy
- [ ] Community channels (Discord, Telegram)

**Done:** Kdokoliv může stáhnout, spustit node, začít těžit.

---

## ⏰ Časový plán

```
               FEB 2026          MAR          APR          MAY
               ┌─────────┬──────────┬──────────┬──────────┐
  M0: Repo     │████████░│          │          │          │  1 týden
  M1: Emission │         │██████░░░│          │          │  3 dny
  M2: Mempool  │         │░░░██████│          │          │  3 dny
  M3: Wallet   │         │         │████████░░│          │  5 dní
  M4: IBD Sync │         │         │░░████████│██░░░░░░░│  7 dní
  M5: Payouts  │         │         │          │░░██████░│  5 dní
  M6: Buyback  │         │         │          │░░░░░████│  3 dny
               └─────────┴──────────┴──────────┴──────────┘

               JUN          JUL          AUG–NOV       DEC 2026
               ┌──────────┬──────────┬──────────┬──────────┐
  M7: Genesis  │████████░░│          │          │          │  7 dní
  M7: TestNet  │░░████████│██████████│          │          │  TestNet soak
  M8: Release  │          │          │          │████████░│  5 dní
  🚀 MAINNET   │          │          │          │░░░░░░░░█│  31.12.2026
               └──────────┴──────────┴──────────┴──────────┘
```

| Milestone | Start | Konec | Délka |
|-----------|-------|-------|-------|
| **M0: Clean Repo** | 10.2.2026 | 16.2.2026 | 1 týden |
| **M1: Emission** | 17.2.2026 | 19.2.2026 | 3 dny |
| **M2: Mempool** | 20.2.2026 | 22.2.2026 | 3 dny |
| **M3: Wallet Send** | 1.3.2026 | 5.3.2026 | 5 dní |
| **M4: IBD Sync** | 6.3.2026 | 14.3.2026 | 7 dní |
| **M5: Pool Payouts** | 15.3.2026 | 19.3.2026 | 5 dní |
| **M6: Buyback** | 20.3.2026 | 22.3.2026 | 3 dny |
| **M7: Genesis + TestNet** | 1.6.2026 | 30.11.2026 | 6 měsíců soak |
| **M8: Release** | 1.12.2026 | 5.12.2026 | 5 dní |
| **🚀 MAINNET** | **31.12.2026** | — | — |

---

## 🔧 Migrace z 2.9.5 → Čisté Repo

### Krok za krokem:

#### 1. Core migrace
```bash
# Kopírovat core src
cp -r 2.9.5/zion-native/core/src/ zion-core/src/

# SMAZAT:
rm -rf zion-core/src/security_audit.rs    # Dev-only tooling
rm -rf zion-core/src/load_test*.rs        # Test tooling

# VYČISTIT consciousness z validation.rs:
# - Odstranit MAX_CONSCIOUSNESS_BONUS check
# - Reward validace → jen get_block_reward(height)

# PŘEPSAT reward.rs:
# - 3 řádky → plný emission schedule s halving
```

#### 2. Pool migrace
```bash
# Kopírovat pool src
cp -r 2.9.5/zion-native/pool/src/ zion-pool/src/

# SMAZAT celé moduly:
rm -rf zion-pool/src/consciousness/     # XP tracker, consciousness rewards
rm -rf zion-pool/src/ncl.rs             # NCL manager

# VYČISTIT z main.rs:
# - Odstranit NCL init + spawn
# - Odstranit consciousness::XpTracker init

# VYČISTIT z stratum/server.rs:
# - Odstranit ncl.* method handlers
# - Odstranit XP awarding po share submit

# VYČISTIT z shares/processor.rs:
# - Odstranit XP import a volání

# PONECHAT:
# ✅ revenue_proxy.rs
# ✅ profit_switcher.rs
# ✅ buyback_engine.rs
# ✅ pool_external_miner.rs
```

#### 3. Miner migrace
```bash
# Kopírovat miner src
cp -r 2.9.5/zion-universal-miner/src/ zion-miner/src/

# SMAZAT:
rm -rf zion-miner/src/ncl/              # NCL client
rm -rf zion-miner/src/consciousness/     # Consciousness display
rm -rf zion-miner/src/miner/python_fallback.rs  # Legacy

# VYČISTIT z main.rs:
# - Odstranit --ncl CLI flags
# - Odstranit NCL client init
```

#### 4. Verify
```bash
cargo build --release          # Must compile
cargo test                     # Must pass
cargo clippy -- -D warnings    # No warnings
```

---

## 💰 Ekonomika: Multichain Revenue → ZION Deflace

```
┌─────────────────────────────────────────────────────────────┐
│           ZION DEFLATIONARY FLYWHEEL                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Mining Revenue:                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│  │ ETC Pool │    │ RVN Pool │    │ XMR Pool │               │
│  │ (Ethash) │    │ (KawPow) │    │(RandomX) │               │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘               │
│       └───────────────┼───────────────┘                      │
│                       ▼                                      │
│              ┌─────────────────┐                             │
│              │   BTC Revenue   │100% ZANECHAT. RentaproZionCreators                       │              │  () │     na wallet               │
│              └────────┬────────┘                   bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw                  │
│                       ▼                                      │
│              ┌─────────────────┐                             │
│              │  Buyback ZION   │  ← Buy on DEX/OTC          │
│              │  (automated)    │                             │
│              └────────┬────────┘                             │
│                       ▼                                      │
│              ┌─────────────────┐                             │
│              │  BURN 🔥 zruseno       │  ← Send to burn address    │
│              │  (on-chain)     │                             │
│              └────────┬────────┘                             │
│                       ▼                                      │
│              ┌─────────────────┐                             │
│              │  Supply ↓       │                             │
│              │  Demand ↑       │  ← Miners want ZION        │
│              │  Price ↑        │                             │
│              └────────┬────────┘                             │
│                       ▼                                      │
│              ┌─────────────────┐                             │
│              │  More miners    │  ← Higher reward value     │
│              │  More hashrate  │                             │
│              │  More security  │                             │
│              └─────────────────┘                             │
│                                                              │
│  🔄 FLYWHEEL: More miners → more BTC → more buyback         │
│              → more burn → less supply → higher price        │
│              → more miners → ...                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## � L2 — DEX & DeFi Layer
**📅 2027 Q1–Q2 | Po stabilním L1 MainNetu**

L2 rozšiřuje ZION o finanční primitiva — výměna, likvidita, deflationary flywheel.

### Komponenty

| # | Komponenta | Popis | Technologie |
|---|-----------|-------|-------------|
| L2.1 | **Atomic Swaps** | ZION ↔ BTC/ETH/XMR bez prostředníka | HTLC (Hash Time-Locked Contracts) |
| L2.2 | **ZION DEX** | On-chain decentralizovaná burza | Orderbook nebo AMM |
| L2.3 | **Wrapped ZION (wZION)** | ERC-20/BEP-20 token na EVM chains | Bridge + multisig custody |
| L2.4 | **Liquidity Pools** | AMM pooly pro ZION/BTC, ZION/ETH | Uniswap-style |
| L2.5 | **Buyback Engine v2** | Automatický BTC→ZION buyback + burn | On-chain verifiable burns |
| L2.6 | **DAO Governance v1** | Read-only → proposal → vote | Token-weighted voting |

### Architektura Atomic Swap (HTLC)
```
Alice (ZION)                              Bob (BTC)
    │                                         │
    │── 1. Generuj secret S, hash H=sha256(S) │
    │                                         │
    │── 2. Lock 100 ZION (HTLC: H, timeout 2h)│
    │──────────────────────────────────────────▶│
    │                                         │
    │   3. Lock 0.001 BTC (HTLC: H, timeout 1h)
    │◀──────────────────────────────────────────│
    │                                         │
    │── 4. Claim BTC (reveal S) ──────────────▶│
    │                                         │
    │   5. Claim ZION (use S from chain)       │
    │◀──────────────────────────────────────────│
    │                                         │
    ✅ Trustless swap complete                  ✅
```

### L2 Milníky
| Milestone | Target | Délka |
|-----------|--------|-------|
| L2-M1: Atomic Swap prototyp (ZION↔BTC) | 2027 Q1 | 6 týdnů |
| L2-M2: wZION bridge (Ethereum) | 2027 Q1 | 4 týdny |
| L2-M3: DEX launch (AMM) | 2027 Q2 | 8 týdnů |
| L2-M4: Liquidity mining program | 2027 Q2 | 2 týdny |
| L2-M5: DAO governance v1 | 2027 Q2 | 4 týdny |

---

## 🧠 L3 — Warp & AI Native Systems
**📅 2027 Q3+ | Po stabilním L2**

L3 přidává AI vrstvu a cross-chain mosty — ZION se stává platformou pro conscious AI agents.

### Komponenty

| # | Komponenta | Popis | Repo |
|---|-----------|-------|------|
| L3.1 | **NCL (Neural Compute Layer)** | Decentralizovaný AI task marketplace — miners poskytují GPU compute | `zion-ncl/` |
| L3.2 | **AI Orchestrátor** | Autonomous agent routing — úlohy → nejlepší AI model/miner | `ai/orchestrator/` |
| L3.3 | **Knowledge Extractor** | Self-learning systém — učí se z konverzací a session reportů | `ai/knowledge/` |
| L3.4 | **Warp Bridges** | Cross-chain asset teleportation — ZION ↔ ETH/SOL/COSMOS | `zion-warp/` |
| L3.5 | **AI Native SDK** | Framework pro stavbu conscious agents na ZION síti | `ai-native-sdk/` |
| L3.6 | **Compute Marketplace** | Miners prodávají GPU cykly za ZION, kupující platí za AI inference | `zion-compute/` |

### NCL Architecture
```
┌──────────────────────────────────────────────────┐
│                  NCL LAYER (L3)                   │
├──────────────────────────────────────────────────┤
│                                                   │
│  Task Submitter                 Compute Provider  │
│  (AI Developer)                 (GPU Miner)        │
│       │                              │             │
│       │── Submit Task ──────────────▶│             │
│       │   (model, data, budget ZION)  │             │
│       │                              │             │
│       │   ┌─────────────────┐        │             │
│       │   │  Task Registry  │        │             │
│       │   │  (on-chain L1)  │        │             │
│       │   └────────┬────────┘        │             │
│       │            │                 │             │
│       │            ▼                 │             │
│       │   ┌─────────────────┐        │             │
│       │   │  Orchestrátor   │───────▶│             │
│       │   │  (match task →  │        │             │
│       │   │   best miner)   │        │  Execute    │
│       │   └─────────────────┘        │  AI Task    │
│       │                              │             │
│       │◀── Result + Proof ───────────│             │
│       │                              │             │
│       │── Verify + Pay ZION ────────▶│             │
│                                                   │
│  Revenue: Miners earn ZION for AI compute         │
│  Burn: 5% of task fees burned → deflace           │
│                                                   │
└──────────────────────────────────────────────────┘
```

### Warp Bridge Types
| Bridge | Směr | Mechanismus | Security |
|--------|------|-------------|----------|
| **ZION → ETH** | Lock ZION → mint wZION | Multisig validators | 5-of-7 threshold |
| **ETH → ZION** | Burn wZION → unlock ZION | Event relay + proof | SPV light client |
| **ZION → SOL** | Lock ZION → mint sZION | Wormhole-style | Guardian set |
| **ZION → COSMOS** | IBC protocol | Tendermint light client | IBC standard |

### L3 Milníky
| Milestone | Target | Délka |
|-----------|--------|-------|
| L3-M1: NCL prototyp (single AI task) | 2027 Q3 | 8 týdnů |
| L3-M2: AI Orchestrátor v1 | 2027 Q3 | 6 týdnů |
| L3-M3: Knowledge Extractor v2 | 2027 Q4 | 4 týdny |
| L3-M4: Warp Bridge (ZION↔ETH) | 2027 Q4 | 8 týdnů |
| L3-M5: AI Native SDK beta | 2028 Q1 | 6 týdnů |
| L3-M6: Compute Marketplace launch | 2028 Q1 | 4 týdny |

---

## 🎮 L4 — ZION Oasis + XP/Consciousness System
**📅 2027 Q4 — 2028+ | Plný stack L1+L2+L3 potřeba**

L4 je **koruna ekosystému** — Unreal Engine 5 open-world hra kde mining se stává herním zážitkem a consciousness level má reálný dopad.

### Vize
> **"Miners nejsou jen čísla v hashratu. Jsou hrdinové ve světě, kde každý hash má smysl."**

ZION Oasis transformuje mining z nudné utility na **immersive RPG experience** kde:
- Každý miner má **avatar** ve 3D světě
- Mining = **exploration, crafting, building** v herním prostředí
- XP a consciousness level = **reálné benefity** (pool bonus, governance weight)
- Komunita tvoří **města, cechy, aliance**

### 🏆 XP & Consciousness Level System

```
╔══════════════════════════════════════════════════════════════════╗
║              CONSCIOUSNESS EVOLUTION PATH                        ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Level 0: PHYSICAL         0 XP        1.0× multiplier          ║
║  ├── Nový miner, právě připojený                                 ║
║  ├── Základní mining, žádné bonusy                               ║
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

### XP Sources (jak získat XP)

| Aktivita | XP Reward | Kde se děje | Layer |
|----------|-----------|-------------|-------|
| **Share submitted** | 10 XP | Pool mining | L1 pool |
| **Block found** | 1,000 XP | Pool mining | L1 pool |
| **Uptime bonus** (24h nonstop) | 500 XP | Pool mining | L1 pool |
| **Referral** (nový miner) | 200 XP | Pool/Web | L2 |
| **Quest completed** (Oasis) | 50–5,000 XP | ZION Oasis game | L4 |
| **Territory captured** | 2,000 XP | ZION Oasis PvP | L4 |
| **AI task completed** (NCL) | 100–10,000 XP | NCL marketplace | L3 |
| **Knowledge contribution** | 500 XP | AI Native docs/code | L3 |
| **DAO vote cast** | 100 XP | Governance | L2 |
| **Bug bounty** | 10,000 XP | Security | L1 |

### XP → Real Benefits

```
XP je OFFCHAIN (pool-level databáze, NE na L1 blockchainu).
L1 zůstává čistý — žádné XP v konsensus pravidlech.

Benefity XP:
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. POOL BONUS (z Mining Operators premine 8.25B)       │
│     └── Pool distribuuje bonus ZION z premine           │
│         proporcionálně k XP multiplieru                 │
│         Bonus = base_share × consciousness_multiplier   │
│         Zdroj: 8,250,000,000 ZION over 10 let           │
│                                                         │
│  2. DAO GOVERNANCE WEIGHT                               │
│     └── Vyšší consciousness = silnější hlas             │
│         vote_weight = zion_balance × xp_multiplier      │
│         Zabraňuje plutokracii (whale kontrole)          │
│                                                         │
│  3. OASIS IN-GAME PERKS                                 │
│     └── Lepší avatar, větší území, rare items           │
│         Quest difficulty scaling                        │
│         NPC army size                                   │
│         Building slots                                  │
│                                                         │
│  4. NCL PRIORITY                                        │
│     └── Vyšší level = přednost v AI task assignmentu    │
│         Lepší GPU miners dostávají lukrativnější úlohy  │
│                                                         │
│  5. SOCIAL STATUS                                       │
│     └── Badges, titles, leaderboard                     │
│         Community recognition                           │
│         Mentor matching                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### ZION Oasis — Game Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ZION OASIS (UE5)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CLIENT (UE5)                    SERVER                     │
│  ┌───────────────┐               ┌───────────────┐          │
│  │ 3D World      │               │ Game Server   │          │
│  │ ├── Terrain   │               │ ├── World sim │          │
│  │ ├── NPCs      │◀─── WebSocket ──▶├── Combat    │          │
│  │ ├── Players   │               │ ├── Economy   │          │
│  │ ├── Buildings │               │ └── Quests    │          │
│  │ └── Effects   │               └───────┬───────┘          │
│  └───────────────┘                       │                  │
│                                          │ REST/gRPC        │
│  BLOCKCHAIN BRIDGE                       │                  │
│  ┌───────────────┐               ┌───────▼───────┐          │
│  │ Wallet UI     │               │ XP Service    │          │
│  │ ├── Balance   │               │ ├── XP DB     │          │
│  │ ├── Send/Recv │◀─── RPC ─────▶│ ├── Level calc│          │
│  │ ├── NFT view  │               │ └── Pool sync │          │
│  │ └── History   │               └───────┬───────┘          │
│  └───────────────┘                       │                  │
│                                          │                  │
│                                  ┌───────▼───────┐          │
│                                  │ ZION L1 Node  │          │
│                                  │ (RPC: 8444)   │          │
│                                  └───────────────┘          │
│                                                             │
│  OASIS FEATURES:                                            │
│  🏠 Territory — mine, build, defend                         │
│  ⚔️  PvP — territory wars, resource competition             │
│  🎭 Quests — story-driven consciousness journey             │
│  🏪 Marketplace — trade items, NFTs, resources (ZION)       │
│  🌍 World Events — community-wide challenges                │
│  🎨 Crafting — mine materials → create items/buildings       │
│  👥 Guilds — pool-based teams, shared territories            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### L4 Milníky
| Milestone | Target | Délka | Prerekvizita |
|-----------|--------|-------|-------------|
| L4-M1: XP Service (offchain, pool-integrated) | 2027 Q2 | 4 týdny | L1 stable |
| L4-M2: Consciousness Level Calculator | 2027 Q2 | 2 týdny | L4-M1 |
| L4-M3: Pool bonus distribution (z 8.25B premine) | 2027 Q3 | 4 týdny | L4-M2 |
| L4-M4: Oasis UE5 prototyp (terrain + avatar) | 2027 Q3 | 12 týdnů | — |
| L4-M5: Oasis wallet integration | 2027 Q4 | 4 týdny | L4-M4 + L1 |
| L4-M6: Quest system + NPC AI | 2027 Q4 | 8 týdnů | L4-M4 + L3 |
| L4-M7: Territory wars (PvP) | 2028 Q1 | 8 týdnů | L4-M6 |
| L4-M8: Marketplace (NFT + items) | 2028 Q1 | 6 týdnů | L4-M5 + L2 |
| L4-M9: Oasis public beta | 2028 Q2 | — | All above |

### XP Anti-Abuse Safeguards

| Hrozba | Ochrana |
|--------|--------|
| XP farming (fake shares) | Share validace na pool úrovni — invalid shares = 0 XP + ban |
| Sybil attack (100 fake minerů) | Min hashrate threshold pro XP earning |
| AFK farming | Uptime bonus vyžaduje skutečné shares, ne jen connection |
| XP inflation | Hard cap na denní XP per miner (max 50,000 XP/den) |
| Whale XP buying | XP is non-transferable, non-tradeable — musíš to odmajnovat |

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
                      ║ AMM DEX      ║
                      ╚══════════════╝
                                      ╔══════════════╗
                                      ║ L3 WARP/AI   ║
                                      ║ NCL Launch   ║
                                      ║ AI Orchestr. ║
                                      ║ Warp Bridges ║
                                      ╚══════════════╝
                                ╔════════════════════════════╗
                                ║ L4 ZION OASIS              ║
                                ║ XP Service    UE5 World    ║
                                ║ Pool Bonus    Quests       ║
                                ║ Territories   Public Beta  ║
                                ╚════════════════════════════╝
```

---

## �🛡️ Security Checklist (pre-MainNet)

- [ ] **Ed25519 signature verification** — unit + fuzz testy
- [ ] **Double-spend ochrana** — mempool + UTXO
- [ ] **Overflow ochrana** — u64 reward kalkulace s checked_add
- [ ] **P2P rate limiting** — DDoS ochrana
- [ ] **RPC autentizace** — API key pro write operace
- [ ] **Coinbase maturity** — 100 bloků lock
- [ ] **Reorg limit** — max 500 bloků reorg
- [ ] **Timestamp validace** — ±2h od median time
- [ ] **Block size limit** — max 1 MB
- [ ] **TX size limit** — max 100 KB
- [ ] **Mempool limits** — max 50k TX, min fee
- [ ] **Peer limit** — max 50 inbound, 8 outbound
- [ ] **External audit** — třetí strana před MainNet

---

## 📝 Závěr

### L1 Status — ✅ FÁZE 0 DOKONČENA
Máme **funkční blockchain** na 3 serverech:
- ✅ 155 unit testů passing
- ✅ Konstantní emise 5,400.067 ZION/block
- ✅ Genesis premine 16.78B (immediately unlocked)
- ✅ LWMA DAA, fee burning, coinbase maturity
- ✅ Max reorg 10, soft finality 60, fork-choice
- ✅ 3 nody online — Helsinki, USA, Singapore
- ✅ Stejný genesis hash, consensus OK

### Další kroky
| Priorita | Co | Kdy |
|----------|----|----|  
| **L1 Fáze 1** | Hardened TestNet (stability, stress) | Únor–Duben 2026 |
| **L1 Fáze 2-4** | Node UX, Explorer, Audit, Freeze | Květen–Listopad 2026 |
| **L1 🚀** | **MAINNET LAUNCH** | **31.12.2026** |
| **L2** | DEX, Atomic Swaps, wZION | 2027 Q1-Q2 |
| **L3** | NCL, Warp, AI Native | 2027 Q3-Q4 |
| **L4** | ZION Oasis, XP System | 2029+ |

### Layer Stack Summary
```
L4  🎮 OASIS      — Consciousness mining jako hra, XP, guilds, territories
L3  🧠 WARP/AI    — NCL, AI agents, cross-chain bridges
L2  💱 DEX/DeFi   — Atomic swaps, AMM, DAO governance
L1  ⛓️  BLOCKCHAIN — PoW, UTXO, 5400 ZION/block, fee burn ← JSME ZDE ✅
```

> **L1 je srdce. Stavíme zdola nahoru. Žádné zkratky.**

---

*🌟 ZION TerraNova — L1 Blockchain · L2 DeFi · L3 AI · L4 Oasis — The Full Stack of Consciousness 🌟*
