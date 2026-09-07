# 🏗️ ZION TerraNova — L1→L4 Layer Roadmap

**Verze: 1.0 | Datum: 16. února 2026**  
**Master Plan pro čtyřvrstvou architekturu**

> *Tento dokument je jediný autoritativní zdroj pro organizaci vrstev.*  
> *Každá vrstva má jasný scope, vlastní crate(y), vlastní testy a vlastní deploy.*  
> *L1 bude ZAMČENA pro MainNet. Vrstvy L2-L4 se vyvíjejí nezávisle.*

---

## 📐 Pravidla Separace Vrstev

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ZION TERRANOVA STACK                              │
│                                                                     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃  L4  🎮 OASIS — Consciousness Mining Game                    ┃  │
│  ┃  Crates: oasis/                                               ┃  │
│  ┃  XP · Levels · Guilds · Territories · UE5 · 8.25B pool       ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                         ↕ XP rewards, level multipliers             │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃  L3  🧠 WARP + AI — Cross-Chain & Intelligence               ┃  │
│  ┃  Crates: warp/ · ncl/ · ai-native/                            ┃  │
│  ┃  Warp Bridges · NCL Compute · AI Agents · Knowledge · SDK     ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                         ↕ cross-chain messages, AI tasks            │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃  L2  💱 DeFi + Governance                                    ┃  │
│  ┃  Crates: bridge/ · dao/                                       ┃  │
│  ┃  wZION ERC-20 · DEX · Liquidity · DAO Voting · Treasury      ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                         ↕ lock/unlock, fee burn, governance TXs     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃  L1  ⛓️  BLOCKCHAIN — 🔒 LOCKED FOR MAINNET                  ┃  │
│  ┃  Crates: core/ · pool/ · miner/ · cosmic-harmony/             ┃  │
│  ┃          native-libs/verushash-native                          ┃  │
│  ┃  PoW · UTXO · 5400 ZION/block · Fee Burn · LWMA DAA          ┃  │
│  ┃  ⚠️  ŽÁDNÉ ZMĚNY po MainNet launchi bez hard-fork vote!       ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
└─────────────────────────────────────────────────────────────────────┘
```

### ⚠️ Klíčové Pravidlo: L1 IMMUTABILITY

```
L1 crates (core, pool, miner, cosmic-harmony, native-libs):
  ├── NESMÍ záviset na L2/L3/L4 crates
  ├── NESMÍ importovat dao/, warp/, ncl/, ai-native/, oasis/
  ├── Komunikace přes L1 jen pomocí TX memo fields
  ├── Po MainNet launchi: LOCK — změny jen přes hard-fork
  └── Výjimka: miner/src/ncl/ je STUB (disabled, feature-gated)
```

### 📦 Závislostní Graf (Crate Dependencies)

```
                    ┌──────────┐
                    │  oasis/  │  L4
                    └─┬──────┬─┘
                      │      │
              ┌───────┘      └────────┐
              ▼                       ▼
        ┌──────────┐          ┌────────────┐
        │   ncl/   │          │ ai-native/ │  L3
        └─────┬────┘          └──────┬─────┘
              │                      │
              ▼                      │
        ┌──────────┐                 │
        │  warp/   │ ◄───────────────┘  L3
        └─────┬────┘
              │
              ▼
        ┌──────────┐          ┌──────────┐
        │ bridge/  │          │   dao/   │  L2
        └─────┬────┘          └─────┬────┘
              │                     │
              ▼                     ▼
        ┌──────────────────────────────────┐
        │  core/ (READ-ONLY from L2+)     │  L1
        │  pool/ miner/ cosmic-harmony/    │
        └──────────────────────────────────┘
          ⚠️ L1 NIKDY neimportuje L2/L3/L4
```

---

## ⛓️ L1 — BLOCKCHAIN (🔒 MAINNET LOCK)

### Scope
Základní blockchain vrstva — PoW mining, UTXO transakce, consensus, síťová komunikace.

### Crates
| Crate | Popis | Stav |
|-------|-------|------|
| `core/` | Blockchain jádro (bloky, TX, validace, genesis, DAA) | ✅ Production |
| `pool/` | Mining pool server | ✅ Production |
| `miner/` | Solo/pool miner (VerusHash + CPU) | ✅ Production |
| `cosmic-harmony/` | Revenue engine (50/25/25) | ✅ Production |
| `native-libs/verushash-native/` | VerusHash FFI bindings | ✅ Production |

### L1 Parametry (NEMĚNNÉ po MainNet)
| Parametr | Hodnota | Dokument |
|----------|---------|----------|
| Block reward | 5,400.067 ZION (konstantní) | MAINNET_CONSTITUTION.md |
| Block time | ~15 sec target | MAINNET_CONSTITUTION.md |
| DAA | LWMA ±25%, 60 bloků | MAINNET_CONSTITUTION.md |
| TX model | UTXO | WP2.9.5 |
| Fee burning | 100% fees → burn 🔥 | MAINNET_CONSTITUTION.md |
| Premine | 16.78B (transparentní) | PREMINE_DISCLOSURE.md |
| Max supply | ∞ (deflationary via burn) | WP2.9.5 |
| Reorg depth | max 10 bloků | core/src/blockchain |
| Coinbase maturity | 100 bloků | core/src/tx |

### L1 Timeline
| Sprint | Úkol | Stav |
|--------|------|------|
| 0.1–0.5 | Core implementace | ✅ HOTOVO |
| 1.0–1.5 | TestNet + 729 testů | ✅ HOTOVO |
| 1.6 | 72h stability run | ⬜ DALŠÍ |
| 2.0 | Security audit | ⬜ |
| 3.0 | MainNet Genesis | ⬜ Cíl: Q4 2026 |
| 3.1+ | **🔒 LOCK** — hard-fork only | — |

### L1 Komunikační Interface (pro L2+)
```
L2/L3/L4 komunikují s L1 POUZE přes:
  1. TX memo field:  "BRIDGE:chain:address" (L2 bridge)
                     "WARP:1:chain:address" (L3 warp)
                     "DAO:vote:proposal_id"  (L2 governance)
  2. RPC API:        getblock, gettransaction, sendrawtransaction
  3. Block events:   new block notification (websocket/polling)
  4. UTXO queries:   getutxos for address
```

---

## 💱 L2 — DeFi + Governance

### Scope
Finanční vrstva — wZION bridging, cross-chain přístupy, DEX, liquidity, a DAO governance.

### Crates
| Crate | Popis | Stav |
|-------|-------|------|
| `bridge/` | wZION ERC-20 lock/mint/burn relay (EVM only) | ✅ Implementováno |
| `dao/` | On-chain governance, proposals, voting, treasury | ✅ Implementováno |
| `atomic-swap/` | HTLC daemon, SHA-256 preimage, EVM watcher | ✅ Implementováno |

### L2 Komponenty

#### 2.1 Bridge (`bridge/`) — ✅ HOTOVÝ
- wZION ERC-20 na Base, Arbitrum, BSC, Polygon
- Lock na L1 → Mint na EVM
- Burn na EVM → Unlock na L1
- 0.1% fee (50% burn, 25% DAO, 25% validators)
- Dokumentace: `docs/L2_WZION_BRIDGE.md`

#### 2.2 DAO Governance (`dao/`) — 🟡 SKELETON POTŘEBA
```
dao/
├── Cargo.toml
└── src/
    ├── lib.rs              # Module exports
    ├── proposal.rs         # Proposal types (Parameter, Treasury, Emergency, Grant)
    ├── voting.rs           # Token-weighted voting (1 ZION = 1 vote)
    ├── treasury.rs         # Multi-sig treasury management (4B ZION)
    ├── timelock.rs         # 48h execution timelock
    ├── quorum.rs           # Quorum rules (10% participation)
    ├── executor.rs         # Proposal execution engine
    ├── humanitarian.rs     # Humanitarian DAO categories (water, food, shelter...)
    ├── config.rs           # DAO parameters
    └── error.rs            # Error types
```

**Existující kód k migraci:**
- `2.9-History/dao/governance_v2.py` (970 ř.) → Rust
- `2.9-History/dao/humanitarian_dao.py` (659 ř.) → Rust
- `2.9-History/dao/contracts/ZionGovernance.sol` (436 ř.) → Reference
- `2.9-History/dao/contracts/ZionTreasury.sol` (539 ř.) → Reference

#### 2.3 DEX (budoucí)
- Atomic Swaps (HTLC)
- AMM / Orderbook
- Liquidity Pools

### L2 Timeline
| Sprint | Úkol | Crate | Stav |
|--------|------|-------|------|
| 3.4.5-11 | wZION Bridge relay | bridge/ | ✅ HOTOVO |
| **3.5.1** | **DAO Skeleton crate** | **dao/** | **🟡 PRÁVĚ TEĎ** |
| 3.5.2 | DAO Proposal + Voting | dao/ | ⬜ |
| 3.5.3 | DAO Treasury multi-sig | dao/ | ⬜ |
| 3.5.4 | DAO Humanitarian module | dao/ | ⬜ |
| 3.6.1 | DEX Atomic Swaps | (future) | ⬜ |
| 3.6.2 | Liquidity Pools | (future) | ⬜ |

---

## 🧠 L3 — Warp + AI Native

### Scope
Inteligentní vrstva — cross-chain interoperabilita (WARP), decentralizovaný AI compute (NCL), a autonomní agenti (AI Native).

### Crates
| Crate | Popis | Stav |
|-------|-------|------|
| `warp/` | Universal cross-chain bridges (7 chain families) | ✅ Implementováno |
| `ncl/` | Neural Compute Layer (AI task marketplace) | ✅ Implementováno |
| `ai-native/` | AI Agent orchestration, memory, knowledge | ✅ Implementováno |

### L3 Komponenty

#### 3.1 WARP Bridges (`warp/`) — ✅ SKELETON HOTOVÝ
- 7 chain families: EVM, Solana, Tron, Stellar, Cardano, Cosmos, Bitcoin
- Universal adapter trait, router, validator quorum, fee engine
- Dokumentace: `docs/WARP_ARCHITECTURE.md`

#### 3.2 NCL — Neural Compute Layer (`ncl/`) — 🟡 SKELETON POTŘEBA
```
ncl/
├── Cargo.toml
└── src/
    ├── lib.rs              # Module exports
    ├── task.rs             # Task types (Embedding, LLM, ImageClassification, Training)
    ├── scheduler.rs        # Task scheduling + priority queue
    ├── runtime.rs          # Compute runtime manager
    ├── runtime/
    │   ├── mod.rs
    │   ├── onnx.rs         # ONNX Runtime backend
    │   ├── coreml.rs       # CoreML backend (macOS/iOS)
    │   ├── tensorrt.rs     # TensorRT backend (NVIDIA)
    │   └── openvino.rs     # OpenVINO backend (Intel)
    ├── marketplace.rs      # Task marketplace (miners sell GPU cycles)
    ├── pricing.rs          # Dynamic pricing per compute unit
    ├── validation.rs       # Result validation + consensus
    ├── rewards.rs          # NCL reward distribution
    ├── protocol.rs         # NCL wire protocol (stratum extension)
    ├── config.rs           # NCL configuration
    └── error.rs            # Error types
```

**Existující kód k migraci:**
- `2.9.5OLD/zion-ncl/` — kompletní Rust crate (archivní)
- `miner/src/ncl/` — klient stub (715 ř., production)
- `cosmic-harmony/src/ncl_integration.rs` — revenue stream (583 ř.)
- `2.9-History/ai/ncl_gateway/` — Python gateway

#### 3.3 AI Native (`ai-native/`) — 🟡 SKELETON POTŘEBA
```
ai-native/
├── Cargo.toml
└── src/
    ├── lib.rs              # Module exports
    ├── agent.rs            # Agent definition + lifecycle
    ├── orchestrator.rs     # Multi-agent orchestration
    ├── memory.rs           # Agent memory system (short/long-term)
    ├── knowledge.rs        # RAG knowledge base
    ├── reasoning.rs        # Reasoning engine (chain-of-thought)
    ├── consciousness.rs    # Consciousness scoring + evolution
    ├── sdk.rs              # AI Native SDK for 3rd party agents
    ├── api.rs              # REST/gRPC API endpoints
    ├── config.rs           # AI Native configuration
    └── error.rs            # Error types
```

**Existující kód k migraci:**
- `2.9-History/ai/` — ~50 Python souborů
- `2.9-History/ai/ai_native.py` — hlavní modul
- `2.9-History/ai/orchestrator_v3.py` — orchestrátor
- `desktop-agent/resources/ai_native_bridge.py` — bridge

### L3 Timeline
| Sprint | Úkol | Crate | Stav |
|--------|------|-------|------|
| 3.4.15-20 | WARP Skeleton (7 chains) | warp/ | ✅ HOTOVO |
| **3.7.1** | **NCL Skeleton crate** | **ncl/** | **🟡 PRÁVĚ TEĎ** |
| 3.7.2 | NCL Task types + Scheduler | ncl/ | ⬜ |
| 3.7.3 | NCL Runtime backends | ncl/ | ⬜ |
| 3.7.4 | NCL Marketplace + Pricing | ncl/ | ⬜ |
| **3.8.1** | **AI Native Skeleton** | **ai-native/** | **🟡 PRÁVĚ TEĎ** |
| 3.8.2 | Agent + Orchestrator | ai-native/ | ⬜ |
| 3.8.3 | Memory + Knowledge (RAG) | ai-native/ | ⬜ |
| 3.8.4 | AI Native SDK | ai-native/ | ⬜ |
| 3.9.1 | WARP Phase 3 — Solana SPL | warp/ | ⬜ |
| 3.9.2 | WARP Phase 4 — Tron TRC-20 | warp/ | ⬜ |

---

## 🎮 L4 — OASIS (Consciousness Mining Game)

### Scope
Herní vrstva — consciousness mining jako hra, XP systém, levely, guildy, teritoria, UE5 svět.

### Crates
| Crate | Popis | Stav |
|-------|-------|------|
| `oasis/` | Consciousness mining game engine | 🟡 **VYTVOŘIT** |

### L4 Komponenty

#### 4.1 OASIS Game Engine (`oasis/`) — 🟡 SKELETON POTŘEBA
```
oasis/
├── Cargo.toml
└── src/
    ├── lib.rs              # Module exports
    ├── consciousness.rs    # 9 consciousness levels (Physical → On The Star)
    ├── xp.rs               # XP system (awards, thresholds, decay)
    ├── levels.rs           # Level progression + multipliers (1.0× → 15.0×)
    ├── player.rs           # Player profile + achievements
    ├── guild.rs            # Guild system (create, join, quests)
    ├── territory.rs        # Territory control (mining zones)
    ├── challenges.rs       # AI challenges, quizzes, meditation
    ├── rewards.rs          # Reward distribution (8.25B pool, 10-year)
    ├── leaderboard.rs      # Global + guild leaderboards
    ├── tithe.rs            # Humanitarian tithe (7 categories)
    ├── api.rs              # OASIS API (for UE5 client + mobile)
    ├── config.rs           # OASIS configuration
    └── error.rs            # Error types
```

**Existující kód k migraci:**
- `2.9-History/src/core/consciousness_mining_game.py` (885 ř.)
- `2.9.5OLD/zion-native/pool/src/consciousness/xp_tracker.rs` (522 ř.)
- `2.9.5OLD/zion-native/pool/src/consciousness/tithe.rs` (271 ř.)
- `miner/src/consciousness/` — level tracker (production)
- `core/src/blockchain/premine.rs` — 8.25B OASIS alokace

### Consciousness Levels (9 stupňů)
```
Level  Name              XP Threshold    Multiplier    Premine Slot
─────  ────────────────  ─────────────   ──────────    ────────────
  1    PHYSICAL          0               1.0×          Slot 1: 1.65B
  2    EMOTIONAL         1,000           1.2×          ↑
  3    MENTAL            5,000           1.5×          Slot 2: 1.65B
  4    INTUITIONAL       15,000          2.0×          ↑
  5    SPIRITUAL         50,000          3.0×          Slot 3: 1.65B
  6    COSMIC            150,000         5.0×          ↑
  7    DIVINE            500,000         8.0×          Slot 4: 1.65B
  8    UNITY             2,000,000       12.0×         ↑
  9    ON THE STAR       10,000,000      15.0×         Slot 5: 1.65B
                                                    ─────────────
                                                    Total: 8.25B
```

### L4 Timeline
| Sprint | Úkol | Crate | Stav |
|--------|------|-------|------|
| **4.1.1** | **OASIS Skeleton crate** | **oasis/** | **🟡 PRÁVĚ TEĎ** |
| 4.1.2 | Consciousness levels + XP | oasis/ | ⬜ |
| 4.1.3 | Player + Achievements | oasis/ | ⬜ |
| 4.1.4 | Guild system | oasis/ | ⬜ |
| 4.1.5 | Territory + Leaderboard | oasis/ | ⬜ |
| 4.2.1 | OASIS API (REST) | oasis/ | ⬜ |
| 4.2.2 | UE5 integration | ZionOasis_UE5/ | ⬜ |
| 4.3.1 | 8.25B reward distribution | oasis/ | ⬜ |
| 4.3.2 | Humanitarian tithe | oasis/ | ⬜ |

---

## 📦 Workspace Organizace — Cargo.toml

```toml
[workspace]
members = [
    # ═══════════════════════════════════════════
    # L1 ⛓️  BLOCKCHAIN — 🔒 LOCKED FOR MAINNET
    # ═══════════════════════════════════════════
    "core",
    "pool",
    "miner",
    "cosmic-harmony",
    "native-libs/verushash-native",

    # ═══════════════════════════════════════════
    # L2 💱 DeFi + Governance
    # ═══════════════════════════════════════════
    "bridge",
    "dao",

    # ═══════════════════════════════════════════
    # L3 🧠 WARP + AI Native
    # ═══════════════════════════════════════════
    "warp",
    "ncl",
    "ai-native",

    # ═══════════════════════════════════════════
    # L4 🎮 OASIS
    # ═══════════════════════════════════════════
    "oasis",
]
```

---

## 🔗 Inter-Layer Communication Rules

### L1 → L2 (Blockchain → DeFi)
```
Method:   TX memo field + RPC polling
Examples: "BRIDGE:base:0xABC..."
          "DAO:vote:42"
Direction: L2 READS from L1, never writes directly
```

### L2 → L3 (DeFi → Warp/AI)
```
Method:   Internal crate dependency + async channels
Examples: bridge::types → warp::adapter::evm (shared types)
          dao::treasury → warp::fees (DAO gets 25% of WARP fees)
Direction: L3 depends on L2 types
```

### L3 → L4 (AI → OASIS)
```
Method:   API calls + shared consciousness model
Examples: ncl::rewards → oasis::xp (NCL tasks give XP)
          ai-native::consciousness → oasis::levels (AI judges level-up)
Direction: L4 depends on L3 for AI features
```

### ⛔ FORBIDDEN Dependencies
```
L1 → L2  ❌  (L1 NESMÍ importovat bridge, dao)
L1 → L3  ❌  (L1 NESMÍ importovat warp, ncl, ai-native)
L1 → L4  ❌  (L1 NESMÍ importovat oasis)
L2 → L4  ❌  (L2 NESMÍ přeskočit L3 na L4)
```

---

## 📊 Celkový Stav — Layer Maturity Matrix (17. únor 2026)

```
Layer  Crate            Lines   Tests   Status        Next Step
─────  ───────────────  ──────  ──────  ────────────  ──────────────────
L1     core/            ~17000  261     ✅ Production  🔒 Stability run
L1     pool/            ~12000  ~50     ✅ Production  🔒 Lock
L1     miner/           ~6000   ~30     ✅ Production  🔒 Lock
L1     cosmic-harmony/  ~11000  45      ✅ Production  🔒 Lock
L1     native-libs/     ~500    ~10     ✅ Production  🔒 Lock
─────  ───────────────  ──────  ──────  ────────────  ──────────────────
L2     bridge/          3029    71      🟢 Tested ✅   Deploy contracts
L2     dao/             1549    ~15     🟡 Skeleton ✅ Treasury, voting, humanitarian
─────  ───────────────  ──────  ──────  ────────────  ──────────────────
L3     warp/            4854    ~40     🟡 Skeleton    Chain deployment (7 adapters)
L3     ncl/             1034    ~10     🟡 Skeleton ✅ Scheduler, 4 runtimes, marketplace
L3     ai-native/       752     ~8      🟡 Skeleton ✅ 7 agent types, memory, consciousness
─────  ───────────────  ──────  ──────  ────────────  ──────────────────
L4     oasis/           2335    ~20     🟡 Skeleton ✅ XP, guilds, territories, 8.25B pool

TOTAL: 70,991 LOC Rust · 10 crates · ALL compile clean · 377 tests passing
```

---

## 📅 Master Timeline

```
2026 Q1-Q2          2026 Q3-Q4           2027 Q1-Q2          2027 Q3+
┌────────────┐    ┌────────────────┐    ┌──────────────┐    ┌──────────┐
│ L1 TestNet │    │ L1 MainNet 🚀  │    │ L2 Bridge    │    │ L3 WARP  │
│ + Stability│    │ 🔒 LOCK        │    │ L2 DAO       │    │ L3 NCL   │
│ + Audit    │    │                │    │ L3 Skeletons │    │ L3 AI    │
│ L2 Bridge  │    │ L2 Deploy      │    │              │    │ L4 OASIS │
│ L2 DAO skel│    │                │    │              │    │          │
│ L3 Warp sk │    │                │    │              │    │          │
│ L3 NCL sk  │    │                │    │              │    │          │
│ L4 Oasis sk│    │                │    │              │    │          │
└────────────┘    └────────────────┘    └──────────────┘    └──────────┘
     ▲ JSME ZDE
```

---

## 📖 Referenční Dokumenty per Layer

| Layer | Dokument | Popis |
|-------|----------|-------|
| ALL | `docs/L1-L4_ROADMAP.md` | **TENTO DOKUMENT** — master plan |
| ALL | `docs/MAINNET_ROADMAP_2026.md` | Celkový MainNet roadmap |
| L1 | `docs/mainnet/MAINNET_CONSTITUTION.md` | Neměnné L1 parametry |
| L1 | `docs/mainnet/MAINNET_CHECKLIST.md` | L1 launch checklist |
| L2 | `docs/L2_WZION_BRIDGE.md` | wZION Bridge architektura |
| L2 | `dao/README.md` | DAO governance design |
| L3 | `docs/WARP_ARCHITECTURE.md` | WARP multi-chain architektura |
| L3 | `ncl/README.md` | NCL compute design |
| L3 | `ai-native/README.md` | AI Native design |
| L4 | `oasis/README.md` | OASIS game design |

---

**Vytvořeno: 16. února 2026**  
**Odpovědnost: Core team**  
**Princip: L1 se ZAMKNE. L2-L4 se staví nezávisle. Žádný misch-masch.** 🔒

---

*"L1 Blockchain · L2 DeFi · L3 AI · L4 Oasis — čtyři vrstvy, jeden sen."* 🌟
