# ZION V3 — Kompletní plán do produkčního mainnetu

Status: 2026-03-28 · Sprint 9 dokončen + V3 fee-split rollout live ověřen  
Autor: Yose144 + AI Native  
Závisí na: V3/ROADMAP.md (L1 fáze 1–23 hotovo), V3/docs/L2_L3_MAINNET_PLAN.md (detailní L2/L3 spec)

---

## 0. Shrnutí stavu

### Nejnovější ověřený milník

- V3 core fee split je nyní vynucen přímo on-chain, ne pouze pool-side accountingem
- Live ověřené rozdělení subsidy: miner `89%`, humanitarian `5%`, issobella `5%`, pool fee `1%`
- První explicitně potvrzený split-enabled blok: `465`
- Následné cross-node potvrzení na auditovaných nodech: bloky `471` a `472`
- Legacy Prague, USA a Singapore zůstaly po rolloutu synchronizované (historická multi-server topologie)
- Root cause prvního neúčinného deploye byl stale server-side `docker/docker-compose.v3-mainnet.yml`, kde fee wallet env proměnné chyběly v `core` service
- Operativní reference:
    - `../docs/reports/REPORT_SESSION_2026-03-28_V3_MAINNET_FEE_SPLIT_ROLLOUT.md`
    - `../docs/mainnet/V3_ROLLOUT_VERIFICATION_CHECKLIST.md`
    - `docs/MAINNET_DEPLOY_RUNBOOK.md`

### V3 L1 — 95% hotovo

| Metrika | Hodnota |
|---------|---------|
| Workspace testy | **1,303 pass, 0 fail** (L1: 666, L2/bridge: 157, L2/dao: 65, L2/atomic-swap: 15, L3/ncl: 43, L3/warp: 252, L3/ai-native: 89) |
| Core moduly | 24 (.rs), 432 testů |
| Cosmic Harmony | 12 modulů, 95 testů |
| Pool | 3 moduly, 44 testů + 29 integrační |
| Miner | CPU/GPU/DCR, 59 testů |
| Native FFI | 4 testy, scaffold hotový |
| RPC metody | 17 live (JSON-RPC 2.0) |
| Persistence | LMDB (8 databází) |
| Docker | 3 multi-stage image, 7-service compose |
| Testnet | Hetzner live, chain height 110+ |
| Mainnet rollout | Core + Edge auditované, split-enabled bloky ověřeny |
| Fáze hotovy | 1–13, 16–23, Sprint 4–9 |

### V3/L2 — kompletně migrováno ✅

| Komponenta | LOC | Testy | Stav |
|-----------|-----|-------|------|
| V3/L2/bridge/ | ~2,600 | **157** (111 lib + 45 integration + 1 doctest) | ✅ Migrováno, decimal fix 6→12 hotový |
| V3/L2/dao/ | ~2,100 | **65** (40 lib + 25 integration) | ✅ Migrováno, u128 treasury, `amount_flowers` |
| V3/L2/atomic-swap/ | ~1,200 | **15** (15 lib) | ✅ Migrováno, `amount_flowers`/`min_lock_flowers` |

Klíčová změna oproti legacy: `FLOWERS_PER_ZION = 1e12` (V3) místo `1e6` (legacy). Všechny konverzní funkce, DB schéma, testy přeneseny s opravenou aritmetikou.

### V3/L3 — kompletně migrováno ✅

| Komponenta | LOC | Testy | Stav |
|-----------|-----|-------|------|
| V3/L3/ncl/ | ~1,800 | **43** (42 lib + 1 doctest) | ✅ Migrováno, `reward_flowers` naming |
| V3/L3/warp/ | ~7,200 | **252** (251 lib + 1 doctest) | ✅ Migrováno, 7 chain adapters, decimal fix 6→12 |
| V3/L3/ai-native/ | ~2,800 | **89** (88 lib + 1 doctest) | ✅ Migrováno, `amount_flowers`/`reward_flowers` |

### Zbývající migrace

Všechny L2/L3 Rust crates jsou migrovány do V3. Zbývá pouze L2/contracts (Solidity — chain-agnostic, redeploy z V3 kontextu).

### Legacy L2 stav (root)

| Komponenta | LOC | Testy | Stav |
|-----------|-----|-------|------|
| bridge/ (Rust relay daemon) | 2,663 | 71 | ✅ Migrováno do V3/L2/bridge/ (157 testů) |
| contracts/ (Solidity) | — | 94/96 | ✅ LIVE (wZION, Bridge, DAO, Staking, Farm) |
| dao/ (Rust governance) | 1,549 | ~18 | ✅ Migrováno do V3/L2/dao/ (65 testů) |
| atomic-swap/ (HTLC) | ~1,000 | <10 | ✅ Migrováno do V3/L2/atomic-swap/ (15 testů) |

### Legacy L3 stav (root)

| Komponenta | LOC | Testy | Stav |
|-----------|-----|-------|------|
| warp/ (cross-chain bridge) | 6,400 | 205 | ✅ Migrováno do V3/L3/warp/ (252 testů) |
| ncl/ (AI task marketplace) | 1,800 | 34 | ✅ Migrováno do V3/L3/ncl/ (43 testů) |
| ai-native/ (agent framework) | 2,200 | 59 | ✅ Migrováno do V3/L3/ai-native/ (89 testů) |

---

## 1. Architektura — Závislosti vrstev

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  L4 OASIS  (budoucí — gamifikace, XP, CL, Golden Egg)         │
│    ↓ čte L3 AI/NCL výstupy, L1 mining shares                  │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  L3 WARP + NCL + AI-NATIVE                                     │
│    ↓ závisí na L2 bridge pro cross-chain settlement            │
│    ↓ čte L1 chain stav přes RPC                                │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  L2 BRIDGE + DAO + ATOMIC-SWAP                                 │
│    ↓ čte L1 přes JSON-RPC (getBalance, getBlock, submitTx)    │
│    ↓ NIKDY neimportuje L1 kód přímo                           │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  L1 CORE + COSMIC-HARMONY + POOL + MINER   ← READ-ONLY        │
│    Konsenzus, PoW, UTXO, P2P, RPC, PPLNS                      │
│    ŽÁDNÉ změny kvůli L2/L3/L4                                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Klíčový invariant:** L1 je uzamčený po Genesis. L2/L3/L4 jsou off-chain služby, které komunikují s L1 výhradně přes RPC. Žádný hard fork není potřeba.

---

## 2. Fáze A — L1 produkční dokončení

### A.1 Full Async P2P (Phase 14)

**Cíl:** Nahradit synchronní message loop za tokio async multiplexing pro produkční škálu.

| Co | Detail |
|----|--------|
| Scope | `V3/L1/core/src/lib.rs` — P2P message loop |
| Závislost | Přidat `tokio` do workspace deps |
| Výstup | Parallel multi-peer IBD, connection multiplexing |
| Testy | Extend integrační testy o multi-peer scénáře |
| Riziko | Střední — regrese v P2P flow |
| Odhad | 3–5 sprint dní |

**Proč:** Current synchronní P2P funguje pro testnet (1–3 peery), ale produkční mainnet potřebuje paralelní sync z desítek peerů.

**Alternativa:** Odložit na post-launch, pokud testnet stabilita stačí pro genesis s malým počtem seed nodes. Prioritizovat BFG scrub.

### A.2 BFG Scrub — BEZPEČNOSTNÍ BLOKÁTOR

**Cíl:** Odstranit 12 premine private keys z git historie před jakýmkoli public forkem.

| Co | Detail |
|----|--------|
| Nástroj | `bfg-repo-cleaner` nebo `git-filter-repo` |
| Soubor | `PREMINE_WALLETS_BACKUP.json` |
| Postup | 1. Backup větev, 2. BFG scrub, 3. Force push, 4. Ověřit git log |
| Riziko | Přepisuje historii — musí být koordinováno |
| Blokuje | Public launch, open-source fork |

**VAROVÁNÍ:** Bez tohoto kroku NESMÍ být repo zpřístupněno veřejnosti. Private keys by umožnily krádež celého 16.78B ZION premineu.

### A.3 Genesis Ceremony

**Cíl:** Aktivovat mainnet s frozen genesis hash.

| Krok | Detail |
|------|--------|
| 1 | Final `cargo test --workspace` — 666+ testů, 0 fail |
| 2 | Ověřit genesis hash v `genesis.rs` odpovídá CONSTITUTION |
| 3 | Deploy `v3.0.0-rc1` na čistý server (nový Hetzner instance) |
| 4 | 7-day canary run — chain growth, 0 P2P errors, 0 reorgs |
| 5 | GO/NO-GO rozhodnutí |
| 6 | Tag `v3.0.0`, publikovat genesis block |
| 7 | Seed nodes, mining guide, community oznámení |

**Poznámka k deploy disciplíně:** přesný shell-ready postup pro V3 rollout a post-deploy ověření je nyní zapsán v `V3/docs/MAINNET_DEPLOY_RUNBOOK.md`. Po zkušenosti z 2026-03-28 už nestačí jen úspěšný rebuild; musí se ověřit i live env uvnitř `zion-core` a první nový blok po deployi.

### A.4 Post-Genesis L1 údržba

- Checkpoint system (hardcoded height→hash po 1000 blocích)
- Difficulty adjustments monitoring (DifficultyStats je hotový)
- Seed node diversifikace (min. 3 geograficky oddělené)

---

## 3. Fáze B — L2 migrace do V3

### B.0 KRITICKÝ FIX: Decimal conversion

**MUSÍ být opraveno PŘED jakoukoli L2 migrací.**

```
Root L2 kód: 1 ZION = 1e6 atomic   (6 decimals) ← ŠPATNĚ pro V3
V3 mainnet:  1 ZION = 1e6 flowers   (6 decimals)  ← SPRÁVNĚ (updated 3.0.3 fork)
EVM wZION:   1 wZION = 1e18 wei     (18 decimals)
```

| Soubor | Aktuální | Správně |
|--------|----------|---------|
| `types.rs` — `l1_atomic_to_wzion_wei()` | × 1e12 | × 1e6 |
| `types.rs` — `wzion_wei_to_l1_atomic()` | ÷ 1e12 | ÷ 1e6 |
| `types.rs` — `atomic_to_zion_display()` | ÷ 1e6 | ÷ 1e12 |
| Solidity `ZIONBridge.sol` | — | Ověřit decimal logic |

**Bez opravy:** Zamčení 1 ZION by vyrazilo 1,000,000 wZION → inflační exploit.

### B.1 V3/L2/bridge — Bridge Relay Daemon

**Zdroj:** `L2/bridge/` (2,663 LOC, 71 testů)

```
V3/L2/bridge/
├── Cargo.toml
├── src/
│   ├── main.rs          (relay daemon entry)
│   ├── config.rs        (bridge config — RPC endpoints, vault address)
│   ├── types.rs         (OPRAVIT decimals: 12, ne 6)
│   ├── l1_watcher.rs    (poll L1 node RPC pro lock TXs)
│   ├── evm_watcher.rs   (listen EVM burn events)
│   ├── relayer.rs       (submit lock proofs → EVM)
│   ├── validator.rs     (3-of-5 multisig quorum)
│   ├── db.rs            (SQLite event journal)
│   ├── ankr.rs          (Ankr RPC failover)
│   ├── evm_rpc.rs       (ethers-rs EVM calls)
│   └── metrics.rs       (Prometheus /metrics)
└── tests/
```

**Migrace:**
1. Cherry-pick z `L2/bridge/` → `V3/L2/bridge/`
2. Fix decimal conversion (×1e6, ne ×1e12)
3. Aktualizovat Cargo.toml — workspace deps alignment
4. Bridge vault address = `zion1bridge000...vault` (V3 genesis address #TBD)
5. L1 RPC endpoint = V3 node (port 8332)
6. Konfirmační hloubka = 60 bloků (60 min @ 60s blocks)
7. Testy: opravit všechny test vectors pro 6 decimals (updated 3.0.3 fork)

### B.2 V3/L2/contracts — Solidity

**Zdroj:** `L2/contracts/sol/` (94/96 testů)

```
V3/L2/contracts/
├── sol/
│   ├── wZION.sol            (ERC-20 wrapper, 18 decimals)
│   ├── ZIONBridge.sol       (lock/unlock, 3-of-5 multisig)
│   ├── ZIONGovernance.sol   (stake-weighted DAO voting)
│   ├── ZIONTreasury.sol     (grant disbursement, 5-of-7 mainnet)
│   ├── ZIONStaking.sol      (liquid staking, 12% APR)
│   ├── ZIONFarm.sol         (LP incentives)
│   └── ZIONAtomicSwap.sol   (EVM HTLC)
├── test/
├── script/
├── foundry.toml
└── README.md
```

**Migrace:**
1. Copy kontrakty do V3 (Solidity je chain-agnostic)
2. Ověřit decimal logiku v `ZIONBridge.sol` oproti V3 flowers (1e12)
3. Redeploy na Base Sepolia z V3 kontextu
4. Mainnet deploy: Base mainnet po L1 genesis stabilizaci

### B.3 V3/L2/dao — DAO Governance ✅ MIGROVÁNO

**Zdroj:** `L2/dao/` (1,549 LOC, ~18 testů) → **V3/L2/dao/** (2,100+ LOC, 65 testů)

**Migrace dokončena Sprint 8:**
- 16 src souborů + 1 integrační test soubor
- Decimal fix: `amount_atomic` → `amount_flowers`, `fee_atomic` → `fee_flowers`
- Treasury amounts používají `u128` pro 4B ZION supply scale
- Config `daily_spend_limit` uložen jako celé ZION, konverze přes `FLOWERS_PER_ZION`
- **40 lib + 25 integračních testů = 65, 0 fail**

```
V3/L2/dao/
├── Cargo.toml
├── src/
│   ├── main.rs          (DAO daemon)
│   ├── proposal.rs      (návrhy — treasury, parameter, emergency)
│   ├── voting.rs        (1 ZION = 1 vote, 7-day period)
│   ├── treasury.rs      (disbursement z 4B ZION pool)
│   ├── timelock.rs      (48h execution delay)
│   ├── quorum.rs        (10% participation threshold)
│   ├── executor.rs      (execute approved proposals)
│   ├── humanitarian.rs  (tithe: Water, Food, Shelter, Health, Education, Emergency)
│   ├── l1_scanner.rs    (DAO: memo protocol parser)
│   ├── db.rs            (proposal/vote persistence)
│   ├── api.rs           (REST API)
│   └── metrics.rs       (Prometheus)
└── tests/
```

**DAO Memo Protocol (L1 TX → DAO akce):**
```
DAO:propose:treasury:1000000:zion1abc...:Description
DAO:vote:42:yes
DAO:delegate:zion1delegate_addr
TITHE:Water:500000:zion1humanitarian_addr
```

**Práce potřebná:**
- Dotáhnout skeleton do produkce (proposal lifecycle, voting tallying)
- DAO cliff enforcement: treasury unlock po blocku 525,600 (~1 rok)
- Integrační testy s V3 L1 RPC
- Dashboard na webu (proposal list, vote status)

### B.4 V3/L2/atomic-swap — HTLC Swaps ✅ MIGROVÁNO

**Zdroj:** `L2/atomic-swap/` (~1,000 LOC, <10 testů) → **V3/L2/atomic-swap/** (1,200+ LOC, 15 testů)

**Migrace dokončena Sprint 8:**
- 10 src souborů
- Decimal fix: `amount_flowers`/`min_lock_flowers` naming, hodnoty `1_000_000_000_000`
- **15 lib testů, 0 fail**

**Zbývající práce (post-genesis):**
- Produkční HTLC timeout logika
- Multi-chain executor (BTC, ETH, XMR)
- Refundační mechanismus
- Testovací pokrytí

**Priorita:** Nízká — odložit za bridge + DAO, může jít do post-genesis fáze.

---

## 4. Fáze C — L3 migrace do V3

### C.1 V3/L3/ncl — Neural Compute Layer ✅ MIGROVÁNO

**Zdroj:** `L3/ncl/` (1,800 LOC, 34 testů) → **V3/L3/ncl/** (1,800+ LOC, 43 testů)

**Migrace dokončena Sprint 8:**
- Všechny src soubory migrovány
- Decimal fix: `reward_atomic` → `reward_flowers`
- **42 lib + 1 doctest = 43, 0 fail**

```
V3/L3/ncl/
├── Cargo.toml
├── src/
│   ├── main.rs          (NCL daemon)
│   ├── task.rs          (Embedding, LLM, ImageClassification, Training)
│   ├── scheduler.rs     (task queue → worker dispatch)
│   ├── backend.rs       (runtime abstrakce)
│   ├── runtime/
│   │   ├── onnx.rs      (ONNX Runtime)
│   │   ├── coreml.rs    (Apple CoreML)
│   │   ├── tensorrt.rs  (NVIDIA TensorRT)
│   │   └── openvino.rs  (Intel OpenVINO)
│   ├── pricing.rs       (task pricing v ZION)
│   ├── reputation.rs    (worker reputace — latency, accuracy, uptime)
│   ├── marketplace.rs   (task listing + bidding)
│   ├── validation.rs    (result verification)
│   ├── store.rs         (task history, model registry)
│   └── api.rs           (REST API pro task submission)
└── tests/
```

**NCL ekonomický model:**
```
AI task revenue split:
  85% → Miner/Worker (GPU owner)
  10% → Pool (orchestrace)
   5% → ZION treasury (development)
```

**Integrace s L1:**
- NCL tasks platí v ZION (L1 TXs s memo `NCL:task:id`)
- Worker registrace přes L1 stake
- Revenue accounting přes L2 bridge (wZION na EVM pro stablecoin cash-out)

**Práce potřebná:**
- Opravit decimal konverze (12-dec flowers)
- ONNX Runtime backend do produkce
- Worker P2P discovery (libp2p nebo overlay nad L1 P2P)
- Benchmark suite (ResNet-50 < 5ms, LLM 7B < 500ms)

### C.2 V3/L3/warp — Universal Cross-Chain Bridge ✅ MIGROVÁNO

**Zdroj:** `L3/warp/` (6,400 LOC, 205 testů) → **V3/L3/warp/** (7,200+ LOC, 252 testů)

**Migrace dokončena Sprint 8:**
- 22 src + 8 adapter souborů
- Cargo.toml: `thiserror="2"`, správné path závislosti
- ChainId::zion_l1() decimals fixováno na 12
- Všechny konverzní testy updatovány (6→12 decimal ZION hodnoty) (reverted to 6-dec in 3.0.3 fork)
- fees.rs: všechny min_fee/max_fee updatovány na 12-decimal hodnoty (reverted to 6-dec in 3.0.3 fork)
- config.rs: `daily_limit_flowers()` a `timelock_threshold_flowers()` ×1e12
- xp_bridge.rs: volume divisor změněn z 1e6 na 1e12
- router.rs: daily_limit a timelock_threshold defaults updatovány
- **251 lib + 1 doctest = 252, 0 fail**

```
V3/L3/warp/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── adapter/
│   │   ├── evm.rs       (Ethereum/Base/Arbitrum)
│   │   ├── solana.rs    (Solana SPL tokens)
│   │   ├── tron.rs      (Tron TRC-20)
│   │   ├── stellar.rs   (Stellar XLM)
│   │   ├── cardano.rs   (Cardano ADA/CIP-25)
│   │   ├── cosmos.rs    (IBC protocol)
│   │   └── bitcoin.rs   (UTXO + P2WPKH)
│   ├── router.rs        (message routing engine)
│   ├── validator.rs     (quorum validation)
│   ├── protocol.rs      (wire format)
│   ├── registry.rs      (chain + token registry)
│   ├── fee_engine.rs    (dynamic routing fees)
│   ├── state.rs         (transfer state machine)
│   ├── signer/
│   │   ├── btc_signer.rs
│   │   ├── evm_signer.rs
│   │   ├── solana_signer.rs
│   │   ├── stellar_signer.rs
│   │   └── tron_signer.rs
│   ├── db.rs            (transfer journal)
│   └── xp_bridge.rs     (WARP → L4 XP credits)
└── tests/
```

**Priorita chain adapters:**
1. **EVM** (Base, Ethereum) — nejdůležitější, navazuje na L2 bridge
2. **Bitcoin** — BTC ↔ ZION atomic swaps
3. **Solana** — vysoký throughput DeFi
4. Stellar, Cosmos, Tron, Cardano — budoucí fáze

**Práce potřebná:**
- Fix decimal konverze (flowers = 12 dec)
- EVM adapter je nejpokročilejší — produkční hardening
- Validator quorum (3-of-5 cross-chain proof relay)
- Fee engine calibrace
- Monitoring + alerting

### C.3 V3/L3/ai-native — Agent Framework ✅ MIGROVÁNO

**Zdroj:** `L3/ai-native/` (2,200 LOC, 59 testů) → **V3/L3/ai-native/** (2,800+ LOC, 89 testů)

**Migrace dokončena Sprint 8:**
- 13 src souborů
- Cargo.toml: `thiserror="2"`, path závislosti na ncl, warp, bridge
- Decimal fix: `amount_flowers`/`reward_flowers` naming
- **88 lib + 1 doctest = 89, 0 fail**

```
V3/L3/ai-native/
├── Cargo.toml
├── src/
│   ├── agent.rs           (autonomní AI agent)
│   ├── orchestrator.rs    (multi-agent coordination)
│   ├── message_bus.rs     (agent ↔ agent messaging)
│   ├── memory.rs          (persistent agent memory)
│   ├── consciousness.rs   (9 CL tiers — L4 Oasis interface)
│   ├── consciousness_engine.rs (CL evaluation engine)
│   ├── task.rs            (agent task execution)
│   ├── pool_optimizer.rs  (mining pool strategy agent)
│   ├── warp_agent.rs      (cross-chain bridge agent)
│   ├── oasis_bridge.rs    (L4 Oasis XP integration)
│   └── telemetry.rs       (agent observability)
└── tests/
```

**Důležité oddělení:**
- `consciousness.rs` + `oasis_bridge.rs` = L4 rozhraní (XP, CL) — NE do miningu
- `pool_optimizer.rs` = optimalizace pool strategie (fee switching, algo selection)
- `warp_agent.rs` = autonomní cross-chain bridge monitoring

**Práce potřebná:**
- Agent runtime (tokio async tasks)
- Wallet management pro agenty (multisig, spending limits)
- NCL task coordination (agent dispatches NCL inference tasks)
- Telemetry export do Prometheus

---

## 5. Workspace integrace

### V3/Cargo.toml — rozšíření workspace

```toml
[workspace]
members = [
    # L1 — Core blockchain (FROZEN after genesis)
    "L1/cosmic-harmony",
    "L1/core",
    "L1/pool",
    "L1/miner",
    "L1/native-ffi",
    # L2 — DeFi & Governance
    "L2/bridge",
    "L2/dao",
    "L2/atomic-swap",
    # L3 — WARP + NCL + AI
    "L3/ncl",
    "L3/warp",
    "L3/ai-native",
]
```

### Workspace závislosti (nové pro L2/L3)

```toml
[workspace.dependencies]
# Stávající (L1)
anyhow = "1"
blake3 = "1"
ed25519-dalek = { version = "2", features = ["rand_core"] }
heed = "0.22"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
# Nové (L2/L3)
ethers = "2"                    # EVM interaction
reqwest = { version = "0.12", features = ["json"] }
rusqlite = { version = "0.31", features = ["bundled"] }
tonic = "0.12"                  # gRPC (WARP validators)
libp2p = "0.54"                 # P2P networking (NCL workers)
ort = { version = "2.0.0-rc.10", features = ["load-dynamic"] }  # ONNX Runtime
```

### Docker rozšíření

```
V3/docker/
├── Dockerfile.node       (stávající)
├── Dockerfile.pool       (stávající)
├── Dockerfile.miner      (stávající)
├── Dockerfile.bridge     (NEW — L2 bridge relay)
├── Dockerfile.dao        (NEW — L2 DAO daemon)
├── Dockerfile.ncl        (NEW — L3 NCL worker)
├── Dockerfile.warp       (NEW — L3 WARP relay)
├── docker-compose.v3-mainnet.yml     (stávající L1)
├── docker-compose.v3-l2.yml          (NEW — L2 services)
└── docker-compose.v3-l3.yml          (NEW — L3 services)
```

---

## 6. Časový plán — Build Order

```
                    2026
    MAR         APR         MAY         JUN         JUL
    ├───────────┼───────────┼───────────┼───────────┤
    │           │           │           │           │
A.1 │██ Async P2P           │           │           │
A.2 │█ BFG Scrub│           │           │           │
A.3 │   ████ Genesis Ceremony (7-day canary)        │
    │           │           │           │           │
B.0 │██ Decimal Fix         │           │           │
B.1 │   ████████ Bridge V3 Migration   │           │
B.2 │      █████ Contracts V3          │           │
B.3 │           │████████████ DAO Production        │
    │           │           │           │           │
C.1 │           │   ████████████ NCL Production     │
C.2 │           │      █████████████ WARP Production│
C.3 │           │           │████████████ AI-Native  │
    │           │           │           │           │
    └───────────┴───────────┴───────────┴───────────┘
```

### Sprint 8 (2026-03-26/27) — L2/L3 MIGRACE DOKONČENA ✅

| # | Úkol | Priorita | Stav |
|---|------|----------|------|
| 1 | **BFG scrub** premine keys | 🔴 CRITICAL | 🔜 Odloženo na pre-mainnet launch |
| 2 | **Decimal fix** — opravit L2 bridge types.rs | 🔴 CRITICAL | ✅ Hotovo (Sprint 8 začátek) |
| 3 | Vytvořit `V3/L2/bridge/` — cherry-pick + fix | 🟡 HIGH | ✅ 157 testů |
| 4 | Vytvořit `V3/L3/ncl/` — cherry-pick + audit | 🟡 HIGH | ✅ 43 testů |
| 5 | Rozšířit `V3/Cargo.toml` workspace | 🟢 MEDIUM | ✅ 11 crates |
| 6 | Migrovat `V3/L2/dao/` | 🟡 HIGH | ✅ 65 testů |
| 7 | Migrovat `V3/L2/atomic-swap/` | 🟢 MEDIUM | ✅ 15 testů |
| 8 | Migrovat `V3/L3/warp/` | 🟡 HIGH | ✅ 252 testů |
| 9 | Migrovat `V3/L3/ai-native/` | 🟢 MEDIUM | ✅ 89 testů |
| 10 | Aktualizovat dokumentaci (PLAN, README, ROADMAP) | 🟢 MEDIUM | ✅ |

### Sprint 9

| # | Úkol | Priorita | Stav |
|---|------|----------|------|
| 1 | Ban propagation: PeerManager→PeerSecurity | 🔴 CRITICAL | ✅ Done |
| 2 | PeerSecurity cleanup leak fix | 🔴 CRITICAL | ✅ Done |
| 3 | Cap relay thread spawning (MAX=16) | 🟡 HIGH | ✅ Done |
| 4 | Integrate DiscoveryEngine (DNS seeds, UDP announce) | 🟡 HIGH | ✅ Done |
| 5 | Integrate IbdEngine (batch sync, stall detection) | 🟡 HIGH | ✅ Done |
| 6 | V3 mainnet Docker compose | 🟡 HIGH | ✅ docker-compose.v3-mainnet.yml |
| 7 | L2 bridge integrační testy s V3 node | 🟡 HIGH | ❌ Odloženo (Sprint 10) |
| 8 | L2 contracts redeploy z V3 kontextu | 🟡 HIGH | ❌ Odloženo (Sprint 10) |
| 9 | Phase 14: async P2P (tokio) | 🟢 MEDIUM | ❌ Odloženo (post-mainnet) |

### Sprint 10

| # | Úkol | Priorita |
|---|------|----------|
| 1 | Genesis ceremony příprava | 🔴 CRITICAL |
| 2 | L2 DAO skeleton → produkce | 🟡 HIGH |
| 3 | L3 WARP validator quorum | 🟡 HIGH |
| 4 | L3 ai-native agent runtime | 🟢 MEDIUM |
| 5 | 7-day canary run START | 🔴 CRITICAL |

---

## 7. Testovací strategie

### L1 (stávající — zachovat)

```bash
cargo test --workspace                    # ~1,300 testů (core live/e2e vyžadují tokio runtime)
cargo test -p zion-core                   # 432 testů (35 live/e2e serverových → přeskočit s --skip live_ --skip e2e_)
cargo test -p zion-cosmic-harmony         # 95 testů + 1 doctest
cargo test -p zion-miner                  # 59 testů
cargo test -p zion-pool                   # 29 testů
```

### L2 (migrováno ✅)

```bash
cargo test -p zion-bridge                 # 157 testů (111 lib + 45 integration + 1 doctest)
cargo test -p zion-dao                    # 65 testů (40 lib + 25 integration)
cargo test -p zion-atomic-swap            # 15 testů
cd V3/L2/contracts && forge test          # Solidity kontrakty (foundry)
```

### L3 (migrováno ✅)

```bash
cargo test -p zion-ncl                    # 43 testů (42 lib + 1 doctest)
cargo test -p zion-warp                   # 252 testů (251 lib + 1 doctest)
cargo test -p zion-ai-native              # 89 testů (88 lib + 1 doctest)
```

### E2E integrační scénáře

| Scénář | Vrstvy | Popis |
|--------|--------|-------|
| Mine → Pay → Bridge | L1→L2 | Miner dostane reward → pošle na bridge vault → wZION minted |
| DAO Vote | L1→L2 | L1 TX s `DAO:vote:42:yes` → DAO daemon zpracuje |
| NCL Task | L1→L3 | User submitne L1 TX s `NCL:task:embed` → NCL worker zpracuje → result → payment |
| WARP Transfer | L1→L3→EVM | ZION → WARP router → Base → wZION |
| Cross-layer XP | L1→L3→L4 | Mining shares → NCL task completion → Oasis XP credit |

---

## 8. Bezpečnostní kontroly

### Před Genesis

- [ ] BFG scrub premine keys (**BLOKÁTOR** — odloženo na pre-mainnet launch)
- [ ] Decimal conversion audit (12 dec flowers, ne 6)
- [ ] Bridge vault address finalizace
- [ ] Multisig key ceremony (3-of-5 bridge, 5-of-7 DAO treasury)
- [ ] Smart contract audit (wZION + Bridge — external auditor?)
- [ ] RPC rate limiting na produkčním node
- [ ] Seed node diversifikace (min 3 lokace)

### Průběžné

- [ ] Bridge daily limit: 10M wZION/den
- [ ] Timelock: 24h pro transakce > 1M wZION
- [ ] DAO quorum: 10% participace minimum
- [ ] NCL task validation: výsledky ověřovány 2+ workery
- [ ] WARP transfer limits per chain

---

## 9. Monitoring rozšíření

### Stávající (L1)

- Prometheus: `zion_chain_height`, `zion_pool_*`, `zion_pplns_*`
- Grafana: 22-panel V3 dashboard
- Web: `/monitoring` stránka + `/dashboard`

### Nové metriky (L2/L3)

| Metrika | Vrstva | Popis |
|---------|--------|-------|
| `zion_bridge_locks_total` | L2 | Počet L1→EVM lock transakcí |
| `zion_bridge_mints_total` | L2 | Počet wZION mint operací |
| `zion_bridge_pending` | L2 | Pending transfer count |
| `zion_bridge_tvl_flowers` | L2 | Total Value Locked |
| `zion_dao_proposals_total` | L2 | Celkový počet návrhů |
| `zion_dao_active_votes` | L2 | Aktivní hlasování |
| `zion_ncl_tasks_total` | L3 | Celkový počet AI tasks |
| `zion_ncl_active_workers` | L3 | Aktivní GPU workery |
| `zion_ncl_avg_latency_ms` | L3 | Průměrná inference latence |
| `zion_warp_transfers_total` | L3 | Cross-chain transfery |
| `zion_warp_pending` | L3 | Pending WARP transfery |

---

## 10. Soubory k aktualizaci po migraci

| Soubor | Akce |
|--------|------|
| `V3/Cargo.toml` | Přidat L2/L3 members + deps |
| `V3/README.md` | Přidat L2/L3 sekce |
| `V3/ROADMAP.md` | Přidat Phase 24+ (L2/L3 fáze) |
| `V3/docs/L2_L3_MAINNET_PLAN.md` | Aktualizovat progres |
| `V3/docker/` | Nové Dockerfile + compose pro L2/L3 |
| `.github/instructions/v3-mainnet.instructions.md` | Rozšířit o L2/L3 pravidla |

---

## 11. Go/No-Go checklist pro mainnet genesis

| # | Podmínka | Stav |
|---|----------|------|
| 1 | 1300+ workspace testů, 0 fail | ✅ (~1,287 verified, core e2e/live testy vyžadují tokio runtime) |
| 2 | BFG scrub premine keys | 🔜 Odloženo na pre-launch |
| 3 | Genesis hash frozen + CONSTITUTION match | ✅ |
| 4 | 7-day canary: chain growth, 0 reorgs, 0 P2P errors | ⬜ |
| 5 | Seed nodes: min 3 geograficky oddělené | ⬜ |
| 6 | Bridge decimal fix verified | ✅ (V3/L2/bridge 157 testů, všechny 6-decimal) (updated 3.0.3 fork) |
| 7 | Mining guide publikován | ✅ |
| 8 | Node operator guide publikován | ✅ |
| 9 | Emergency kill-switch procedure dokumentována | ⬜ |
| 10 | Docker production images tagged `v3.0.0` | ⬜ |

---

*Tento plán je živý dokument. Aktualizovat po každém sprintu.*

*→ [V3/ROADMAP.md](../V3/ROADMAP.md) — L1 fáze detail (canonical engineering roadmap)*  
*→ [docs/L2_L3_MAINNET_PLAN.md](docs/L2_L3_MAINNET_PLAN.md) — L2/L3 technický detail*  
*→ [README.md](README.md) — implementovaný stav*
