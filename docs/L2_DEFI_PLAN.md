# 💱 L2 DeFi — Implementační Plán

> **Vrstva:** L2 — DEX & DeFi Layer  
> **Crate:** `L2/bridge/`, `L2/dao/`, `L2/contracts/`  
> **Timeline:** ~~Post-MainNet → 2027 Q1-Q2~~ **Probouzeno: Březen 2026 (rok napřed)**  
> **Prerekvizita:** ✅ Bridge live na Base Sepolia, wZION deployed  
> **Poslední aktualizace:** 4. dubna 2026

---

## 📊 Aktuální stav L2

```
CELKOVÝ PROGRESS:

Bridge (Rust)     ████████████████████  100% ✅ LIVE na Base Sepolia testnet
Contracts (Sol)   ███████████████████▀   96% kompilace OK, 94/96 testů
DAO (Rust)        ██████████████████▀▀   90% daemon+SQLite+API+scanner hotový
Atomic Swaps      ░░░░░░░░░░░░░░░░░░░░    0% následující faze

LOC:   bridge 2,663 | dao ~2,200 | contracts 2,400+
Testů: bridge 71    | dao 18   | contracts 94/96
```

### Co je live ✅ (březen 2026)

| Komponenta | Adresa | Stav |
|-----------|--------|------|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ LIVE Base Sepolia |
| ZIONBridge | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | ✅ LIVE Base Sepolia |
| Bridge relay | `77.42.31.72` (Helsinki) | ✅ Běží |
| 700 wZION | `0xdde17506...` | ✅ Zmintováno |
| ZIONGovernance.sol | `0x039F730e3e1c3f36da95187697118791762290a1` | ✅ LIVE Base Sepolia |
| ZIONTreasury.sol | `0x178d85323dC94Ce2477269Dfb93a12D04B9bE537` | ✅ LIVE Base Sepolia (1-of-1) |
| ZIONStaking.sol | `0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913` | ✅ LIVE Base Sepolia (APR 12%) |
| Uniswap V3 pool | `0xcCEaD51568E8d701f7db7e6699F3986031F07C7B` | ✅ LIVE Base Sepolia — seed pending |
| ZIONAtomicSwap.sol | `0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc` | ✅ LIVE Base Sepolia |
| ZIONFarm.sol | `0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843` | ✅ LIVE Base Sepolia (500 wZION) |
| DAO daemon | lokální | ☔ Kód hotový, nestřílí |

---

## 🗓️ Nová Timeline — Aktualizace 2. března 2026

> Bridge je live **rok před plánovaným termínem**. Nový plán:

```
HOTOVO (Q1 2026):
  ✅ wZION + ZIONBridge LIVE na Base Sepolia
  ✅ 700 wZION zmintováno, E2E ověřeno
  ✅ ZIONStaking.sol — APR 12%, 7-day cooldown, gov. váha
  ✅ ZIONGovernance.sol — stake-weighted voting
  ✅ ZIONTreasury.sol — multi-sig treasury (1-of-1 testnet)
  ✅ ZIONAtomicSwap.sol — EVM HTLC (19/19 testů)
  ✅ ZIONFarm.sol — MasterChef yield farming (17/17 testů, Pool 0 seeded 500 wZION)
  ✅ evm_watcher.rs — Rust EVM watcher (15/15 testů)
  ✅ Uniswap V3 wZION/WETH pool — inicializován (0.3%, tick -99040)
  ✅ Hardhat viaIR + OZ v5 compat, deployed-defi.json uložen

NEJBLIŽŠÍ KROKY (Březen 2026):
  □ Seed Uni V3 likvidity (100 wZION + ETH z faucetu)
            npx hardhat run scripts/seed-liquidity.ts --network base-sepolia
  □ Fund ZIONStaking rewardPool (staking.fundRewardPool)
  □ DAO daemon: Spustit zion-dao daemon na serveru (docker-compose)
  □ E2E atomic swap test (ZION ↔ ETH testnet)

MAINNET PŘÍPRAVA (Q2-Q3 2026):
  □ ZIONBridge + ZIONStaking + ZIONGovernance mainnet audit
  □ L1 MainNet launch (finální checklist)
  □ Redeploy DeFi stack na Base Mainnet (3-of-5 treasury)
  □ Uniswap V3 mainnet pool + seed likvidita
  □ Staking program live
```

### Nasazení DeFi kontraktů na Base Sepolia

```bash
# 1. Ujistit se že .env obsahuje DEPLOYER_PRIVATE_KEY
cd L2/contracts

# 2. Uniswap V3 pool (wZION/WETH 0.3%)
npx hardhat run scripts/deploy-pool.ts --network base-sepolia

# 3. Governance + Treasury + Staking
npx hardhat run scripts/deploy-defi.ts --network base-sepolia
# → uloží adresy do deployed-defi.json

# 4. Seed liquidity (volitelné)
POOL_ADDRESS=<addr> npx hardhat run scripts/seed-liquidity.ts --network base-sepolia
```

---

## 🌉 L2.2 — wZION Bridge (skeleton → produkce)

### Co je hotovo ✅

| Modul | LOC | Testů | Stav |
|-------|-----|-------|------|
| `config.rs` | ~150 | 5 | ✅ TOML loading, multi-chain, security limits |
| `types.rs` | ~200 | 16 | ✅ L1↔EVM konverze (×1e12), status enum, events |
| `l1_watcher.rs` | ~180 | 12 | ✅ Poll L1 RPC, BRIDGE memo parser, finality 60 bloků |
| `evm_watcher.rs` | ~120 | 2 | ✅ HTTP polling + Ankr fallback, auto-reconnect (exp. backoff 5→80s) |
| `relayer.rs` | ~200 | 2 | ✅ Lock→Mint + Burn→Unlock + rate limit + amount enforcement + metrics |
| `validator.rs` | ~100 | 3 | ✅ ConsensusTracker (N-of-M, dedup) |
| `rate_limiter.rs` | ~120 | 4 | ✅ Sliding-window (global + per-address), Mutex-based thread-safe |
| `db.rs` | ~300 | 12 | ✅ SQLite CRUD (locks, burns, confirmations, state) |
| `metrics.rs` | ~150 | 5 | ✅ Atomic countery, thread-safe snapshot |
| `main.rs` | ~120 | — | ✅ Tokio runtime, mpsc channels, graceful shutdown |
| **Integration** | 479 | 16 | ✅ Full flow, security, persistence, roundtrip |

### Co chybí do produkce ⬜

> **Aktualizace 03/2026:** B-01, B-04, B-05, B-06 jsou ✅ HOTOVÉ. Bridge je LIVE.

| # | Úkol | Priorita | Odhad | Stav |
|---|------|----------|-------|------|
| **B-01** | L1 `/api/bridge/unlock` endpoint | 🔴 P0 | — | ✅ HOTOVO (`ZION_BRIDGE_VAULT_KEY` funguje) |
| **B-02** | EVM WebSocket auto-reconnect | 🟡 P1 | 1 den | ✅ HOTOVO (exp. backoff 5→80s, 5 retries, Ankr fallback) |
| **B-03** | Prometheus /metrics HTTP endpoint | 🟡 P1 | — | ✅ HOTOVO (port 9100) |
| **B-04** | Private key management (ne plaintext) | 🔴 P0 | — | ✅ HOTOVO (env var) |
| **B-05** | Testnet deploy (Base Sepolia) | 🔴 P0 | — | ✅ HOTOVO (wZION + ZIONBridge live) |
| **B-06** | E2E test na testnet | 🔴 P0 | — | ✅ HOTOVO (700 wZION zmintováno) |
| **B-07** | Rate limiter pro bridge requests | 🟡 P1 | 1 den | ✅ HOTOVO (sliding-window global + per-address, amount min/max, recipient validation) |
| **B-08** | Operational runbook | 🟡 P1 | — | ✅ HOTOVO (`ops/runbook.md`) |
| **B-09** | Bridge dashboard (Grafana) | 🟢 P2 | — | ✅ HOTOVO (Grafana + Prometheus monitoring) |
| **B-10** | Mainnet deploy (Base + Arbitrum) | 🔴 P0 | 1 den | 🔄 Po L1 mainnet launch |

### Implementační sekvence

```
FÁZE B1: Testnet Ready (2027 leden — 2 týdny)
  ├── B-04: Key management refactor
  ├── B-01: L1 bridge/unlock endpoint (POST-MAINNET L1 úprava!)
  ├── B-05: Testnet deploy (Base Sepolia)
  └── B-06: E2E test na testnet

FÁZE B2: Hardened (2027 leden — 1 týden)
  ├── B-02: WS auto-reconnect
  ├── B-03: Prometheus metrics endpoint
  ├── B-07: Rate limiter
  └── B-08: Operational runbook

FÁZE B3: Production (2027 únor)
  ├── B-10: Mainnet deploy (Base + Arbitrum)
  ├── B-09: Bridge dashboard
  └── 🎉 wZION bridge LIVE
```

### ⚠️ Kritická závislost: L1 Bridge Unlock API

```
PROBLÉM: L1 core (LOCKED pro MainNet) nemá /api/bridge/unlock endpoint.
Bridge potřebuje, aby L1 node přijal unlock request a vytvořil TX.

ŘEŠENÍ: Post-MainNet L1 soft fork (backwards compatible):
1. Nový RPC endpoint: POST /api/bridge/unlock
   - Input: { burn_id, amount, recipient_l1_addr, validator_proofs[] }
   - Validace: 3-of-5 validator signatures
   - Output: L1 TX hash
2. Toto je NON-CONSENSUS změna (jen RPC), žádný hard fork
3. Implementovat v L1/core/src/rpc/ — nový modul bridge_rpc.rs
4. Audit tohoto endpointu zvlášť (menší scope)
```

---

## 🏛️ L2.5 — DAO Governance (skeleton → produkce)

### Co je hotovo ✅

| Modul | LOC | Testů | Stav |
|-------|-----|-------|------|
| `types.rs` | ~200 | 4 | ✅ Konstanty, DaoMemo parser, enums |
| `proposal.rs` | ~180 | 4 | ✅ 5 typů návrhů, 8 stavů lifecycle |
| `voting.rs` | ~120 | 3 | ✅ VotingEngine, dedup, token-weighted |
| `treasury.rs` | ~180 | 3 | ✅ Multi-sig 5/7, daily limit 100M |
| `timelock.rs` | ~80 | — | ✅ 48h delay |
| `quorum.rs` | ~60 | 2 | ✅ Quorum check vs. circulating |
| `executor.rs` | ~100 | — | 🟡 Dispatch, 3× TODO (parameter/emergency/multisig) |
| `humanitarian.rs` | ~120 | 2 | ✅ 7 kategorií, alokace/distribuce |
| `config.rs` | ~50 | — | ✅ DaoConfig struct (žádný TOML load) |
| `error.rs` | ~60 | — | ✅ 14 DaoError variant |

### Co chybí do produkce ⬜

| # | Úkol | Priorita | Odhad | Detail |
|---|------|----------|-------|--------|
| **D-01** | SQLite persistence vrstva | 🔴 P0 | 3 dny | Proposals, votes, treasury ops — aktuálně vše in-memory HashMap |
| **D-02** | DAO daemon (main.rs) | 🔴 P0 | 2 dny | Tokio runtime, L1 RPC polling, REST API, graceful shutdown |
| **D-03** | L1 memo parser integration | 🔴 P0 | 2 dny | Skenovat bloky pro `DAO:vote:42:yes`, `DAO:propose:...` mema |
| **D-04** | Balance check přes L1 RPC | 🟡 P1 | 1 den | Ověřit voter balance pro token-weighted voting |
| **D-05** | Executor TODO opravit (3×) | 🟡 P1 | 2 dny | Parameter change, emergency, guardian multisig |
| **D-06** | TOML config loading | 🟢 P2 | 0.5 dne | Config::load_from_file() — aktuálně jen Default |
| **D-07** | Integrační testy | 🔴 P0 | 3 dny | E2E: propose → vote → quorum → timelock → execute |
| **D-08** | REST API (JSON-RPC nebo REST) | 🟡 P1 | 2 dny | GET /proposals, POST /vote, GET /treasury/balance |
| **D-09** | Prometheus metriky | 🟢 P2 | 1 den | Proposals active, votes cast, treasury balance, humanitarian distributed |
| **D-10** | Operational runbook | 🟢 P2 | 0.5 dne | Guardian setup, emergency procedures, upgrade path |
| **D-11** | Testy zvýšit: 18 → 50+ | 🟡 P1 | 3 dny | Timelock, executor, error paths, edge cases |

### Implementační sekvence

```
FÁZE D1: Core Infrastructure (2027 Q1 — 3 týdny)
  ├── D-01: SQLite persistence (proposals, votes, treasury, humanitarian)
  ├── D-02: DAO daemon s Tokio runtime
  ├── D-03: L1 block scanner (memo parser: DAO:vote, DAO:propose, TITHE:...)
  └── D-04: Balance check přes L1 RPC

FÁZE D2: Feature Complete (2027 Q1-Q2 — 2 týdny)
  ├── D-05: Executor TODO opravit (parameter, emergency, multisig)
  ├── D-08: REST API pro frontend
  ├── D-06: TOML config loading
  └── D-07: Integrační testy (propose→vote→execute)

FÁZE D3: Hardened (2027 Q2 — 2 týdny)
  ├── D-11: Testy 18 → 50+
  ├── D-09: Prometheus metriky
  ├── D-10: Runbook
  └── 🎉 DAO Governance v1 LIVE
```

### DAO Memo Protocol (L1 TX memo → DAO akce)

```
Formát:  DAO:<action>:<params>

Příklady:
  DAO:propose:treasury:1000000:zion1abc...:Water project funding
  DAO:vote:42:yes
  DAO:vote:42:no
  DAO:delegate:zion1delegate_addr
  TITHE:Water:500000:zion1humanitarian_addr
  TITHE:Education:200000:zion1edu_addr

Kategorie desátků:
  💧 Water     🍞 Food        🏠 Shelter
  🌍 Environment  🏥 Medical  📚 Education  🚨 Emergency
```

---

## 💱 L2.1 — Atomic Swaps (HTLC)

### Stav: ⬜ Zatím žádný kód

### Architektura (plán)

```
Alice (ZION L1)                        Bob (BTC/ETH/XMR)
    │                                      │
    │── 1. Generate secret S               │
    │      hash H = SHA-256(S)             │
    │── 2. Lock ZION in HTLC ─────────▶  │
    │      memo: SWAP:LOCK:H:2h:btc_addr  │
    │                                      │
    │  ◀─── 3. Lock BTC in HTLC ──────── │
    │         script: IF (SHA256==H) THEN  │
    │         ELSE AFTER 1h REFUND         │
    │                                      │
    │── 4. Claim BTC (reveal S) ──────▶  │
    │                                      │
    │  ◀─── 5. Claim ZION (use S) ─────── │
    │                                      │
    ✅ Trustless swap complete              ✅
```

### Implementační plán

| # | Úkol | Odhad | Prerekvizita |
|---|------|-------|-------------|
| **S-01** | HTLC typy a struktury | 2 dny | — |
| **S-02** | L1 HTLC lock TX (SWAP:LOCK memo) | 3 dny | S-01 |
| **S-03** | L1 HTLC claim TX (SWAP:CLAIM memo + secret reveal) | 2 dny | S-02 |
| **S-04** | L1 HTLC refund TX (SWAP:REFUND po expiry) | 1 den | S-02 |
| **S-05** | BTC HTLC integration (bitcoin-rpc) | 5 dní | S-01 |
| **S-06** | ETH HTLC integration (ethers-rs) | 3 dny | S-01, contracts |
| **S-07** | XMR swap integration (monero-rpc) | 5 dní | S-01 |
| **S-08** | Swap coordinator service | 3 dny | S-02-S-04 |
| **S-09** | CLI pro swap operace | 2 dny | S-08 |
| **S-10** | Testy (unit + integration) | 3 dny | S-01-S-08 |

**Target:** 2027 Q2 (~30 dní práce)

### ⚠️ Poznámka k L1 impaktu

```
HTLC vyžaduje rozšíření L1 TX modelu:
- Nový TX typ nebo memo prefix: SWAP:LOCK / SWAP:CLAIM / SWAP:REFUND
- Timelock logika v konsensus pravidlech (→ SOFT FORK)
- Alternativa: off-chain escrow service (žádná L1 změna, ale trust)

DOPORUČENÍ: Začít s wZION bridge (žádná L1 změna),
atomic swaps řešit jako fáze 2 po mainnet stabilizaci.
```

---

## 💱 L2.3-L2.4 — ZION DEX & Liquidity Mining

### Stav: ⬜ Zatím žádný kód (plánováno 2027 Q2)

### Koncept

```
Varianty DEX:

A) ON-CHAIN AMM (jako Uniswap na L1)
   + Plně decentralizované
   - Vyžaduje smart contract support na L1 (aktuálně nemáme)
   - Velká L1 modifikace → NE pro 2027

B) wZION DEX na EVM (Uniswap pool)  ← DOPORUČENO PRO START
   + Žádná L1 změna
   + Existující infrastruktura (Uniswap, PancakeSwap)
   + Bridge je skoro hotový
   - Závisí na bridge

C) ORDER BOOK DEX (off-chain matching, L1 settlement)
   + Přesnější ceny
   - Komplexnější implementace
   - Target: 2028
```

### Doporučená sekvence

```
2027 Q1:  wZION Bridge LIVE → wZION/ETH pool na Uniswap (Varianta B)
2027 Q2:  Liquidity mining program (incentivizace LP)
2027 Q3:  PancakeSwap pool (BNB Chain)
2028 Q1:  Order book DEX (L3 NCL compute pro matching engine)
```

---

## 📅 Souhrnná L2 Timeline

```
2027 Q1                          2027 Q2                         2027 Q3+
╔════════════════════════════╗
║ wZION Bridge               ║
║ B-01→B-10 (6 týdnů)       ║
║ Testnet → Mainnet deploy   ║
╚════════════════════════════╝
     ╔════════════════════════════╗
     ║ DAO Governance v1          ║
     ║ D-01→D-11 (7 týdnů)      ║
     ║ Persistence + API + tests ║
     ╚════════════════════════════╝
                              ╔════════════════════════════╗
                              ║ DEX & Liquidity            ║
                              ║ wZION/ETH Uniswap pool    ║
                              ║ LP incentives              ║
                              ╚════════════════════════════╝
                                                      ╔══════════════╗
                                                      ║ Atomic Swaps ║
                                                      ║ S-01→S-10   ║
                                                      ╚══════════════╝
```

### Celkový odhad práce (L2 komplet)

| Komponenta | Dní práce | LOC odhad | Testů cíl |
|-----------|-----------|-----------|-----------|
| Bridge → prod | ~15 dní | +800 LOC | 71 → 100+ |
| DAO → prod | ~25 dní | +2,000 LOC | 18 → 50+ |
| DEX (wZION pools) | ~5 dní | +200 LOC (skripty) | — |
| Atomic Swaps | ~30 dní | +3,000 LOC | 40+ |
| **CELKEM** | **~75 dní** | **+6,000 LOC** | **190+** |

---

## 🔗 Reference

| Dokument | Účel |
|----------|------|
| [L2/bridge/README.md](../L2/bridge/README.md) | Bridge architektura, moduly, testy |
| [L2/dao/README.md](../L2/dao/README.md) | DAO governance specifikace |
| [L2/contracts/README.md](../L2/contracts/README.md) | Solidity kontrakty (wZION, ZIONBridge) |
| [MAINNET_CHECKLIST.md](MAINNET_CHECKLIST.md) | MainNet launch requirements |
| [ROADMAP.md](../ROADMAP.md) | Hlavní roadmapa |

---

*L2 DeFi Layer — 4,898 LOC, 184 testů | Bridge 80% → DAO 55% → DEX 0% → Swaps 0%*  
*Target: 2027 Q1-Q2 po stabilním MainNet | ~75 dní práce, +6k LOC*
