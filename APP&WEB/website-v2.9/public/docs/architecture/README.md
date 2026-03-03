# ZION TerraNova — 6-Layer Architecture

**Version:** 2.9.7 · Pre-MainNet Gate  
**Status:** L1 Phase 1 complete · L2–L6 in development

---

## Overview

ZION TerraNova is a vertically integrated blockchain ecosystem built in native **Rust** across six distinct but interconnected layers. Each layer has a specific domain of responsibility and communicates via defined interfaces with adjacent layers.

```
┌─────────────────────────────────────────────────────────┐
│  L6  GOVERNANCE / CIVILIZATION LAYER                      │
│       DAO · Constitutional rules · upgrade votes          │
├─────────────────────────────────────────────────────────┤
│  L5  SOCIAL / CONSCIOUSNESS LAYER                         │
│       Guardians · identity · reputation                   │
├─────────────────────────────────────────────────────────┤
│  L4  OASIS — REAL WORLD BRIDGE                            │
│       Legal anchoring · RWA · off-chain oracle            │
├─────────────────────────────────────────────────────────┤
│  L3  WARP / AI-NATIVE LAYER                               │
│       AI inference · NCL contracts · warp bridges         │
├─────────────────────────────────────────────────────────┤
│  L2  DEFI / BRIDGE LAYER                                  │
│       wZION ERC-20 · DEX · liquidity · DAO contracts      │
├─────────────────────────────────────────────────────────┤
│  L1  CORE PROTOCOL                                        │
│       Rust blockchain · CHv3/CHv4 · pool · P2P · LMDB    │
└─────────────────────────────────────────────────────────┘
```

---

## L1 — Core Protocol

**Language:** Rust (100%)  
**LOC:** 52 590  
**Tests:** 780+  
**Status:** ✅ Phase 1 — TestNet Live

### Components

| Component | Status | Description |
|-----------|--------|-------------|
| `core/` | ✅ Live | Block engine, mempool, UTXO, LMDB |
| `miner/` | ✅ Live | CHv3 native GPU/CPU miner |
| `pool/` | ✅ Live | Stratum v2 mining pool |
| `native-libs/` | ✅ Live | FFI bindings, CHv3 kernel |

### Protocol Parameters

| Parameter | Value |
|-----------|-------|
| Block time | 60 seconds |
| Block reward | 5 400.067 ZION |
| Algorithm | Cosmic Harmony v3 (→ v4 in dev) |
| Address prefix | Z3 |
| Signature scheme | Ed25519 |
| Storage | LMDB |
| Network | P2P over TCP/TLS |
| DAA | LWMA (Linearly Weighted Moving Avg) |

---

## L2 — DeFi / Bridge Layer

**Status:** 🔄 In development  
**Target:** Q2–Q3 2026

### wZION Bridge

- Native ZION ↔ wZION (ERC-20) wrapping
- Deployed on **Base Sepolia** testnet
- Smart contract: `L2/contracts/wZION.sol`
- Bridge UI: `/bridge` page

### DEX Integration

- Uniswap V3 compatible liquidity pool (wZION/USDC, wZION/ETH)
- AMM: constant product formula $x \cdot y = k$
- Target TVL at MainNet: seed $500k

### DAO Contracts

- On-chain governance smart contracts (`L2/dao/`)
- Proposal lifecycle: Draft → Vote → Execute
- Quorum: 10% of staked ZION supply

---

## L3 — WARP / AI-Native Layer

**Status:** 🔄 Prototype phase  
**Target:** Q3 2026

### WARP Protocol

- Cross-chain message passing (not just token bridging)
- Inspired by IBC (Cosmos) but ZION-native
- WARP nodes relay messages with proof-of-relay rewards

### NCL — Native Contract Language

- Domain-specific language compiled to ZION bytecode
- Designed for simplicity: no gas-heavy EVM overhead
- Focus: payment contracts, oracle subscriptions, DAO actions

### AI Inference Node

- L3 nodes can serve AI inference (edge model hosting)
- Results recorded as L1 transactions
- Proof-of-Inference: hash of model + input → deterministic output hash

---

## L4 — Oasis (Real World Bridge)

**Status:** 📋 Design phase  
**Target:** 2027

- Legal anchoring of real-world assets on-chain
- Oracle network for off-chain data (price feeds, identity, etc.)
- Designed to interface with L2 contracts

---

## L5 — Social / Consciousness Layer

**Status:** 📋 Design phase  
**Target:** 2027

- Guardian identity system — pseudonymous on-chain reputation
- Consciousness score: accumulated through mining, DAO participation, bridge activity
- Foundation for future humanitarían impact allocation

---

## L6 — Governance / Civilization Layer

**Status:** 📋 Constitutional draft phase  
**Target:** 2027

- Supreme constitutional rules encoded on-chain
- Immutable core principles (cannot be voted away)
- Upgrade process: L6 vote → L1 hard fork
- Guardian council: multi-sig emergency key

---

## Development Priorities 2026

```
Q1 2026 (current): L1 stability · docs · MainNet Gate
Q2 2026:           L2 wZION bridge mainnet · L1 CHv4 upgrade
Q3 2026:           L3 WARP beta · NCL v0.1 · DEX liquidity
Q4 2026:           MainNet Launch · L2 full · CoinGecko listing
```

---

*See also: [Consensus CHv3→CHv4](consensus.md) · [MainNet Launch Plan](../mainnet/README.md)*
