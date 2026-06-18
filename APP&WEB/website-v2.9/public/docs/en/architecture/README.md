# ZION TerraNova — 6-Layer Architecture

**Version:** 2.9.7 · Pre-MainNet Gate  
**Status:** L1 Phase 1 complete · L2–L6 in development

---

## Overview

ZION TerraNova is a vertically integrated blockchain ecosystem built natively in **Rust** across six distinct but interconnected layers. Each layer has a specific domain of responsibility and communicates with adjacent layers through defined interfaces.

```text
┌─────────────────────────────────────────────────────────┐
│  L6  🔭 ZION Issobella                                 │
│      Orbital observatory · Research station · 2040+    │
├─────────────────────────────────────────────────────────┤
│  L5  🌍 ZION Free World                                │
│      Humanitarian missions · Free energy · Communities │
├─────────────────────────────────────────────────────────┤
│  L4  🎮 ZION Oasis                                     │
│      Golden Egg · XP economy · Game layer · 2029       │
├─────────────────────────────────────────────────────────┤
│  L3  🏛️ ZION DAO                                       │
│      Governance · Treasury 4B ZION · proposals · 2028  │
├─────────────────────────────────────────────────────────┤
│  L2  🧠 NCL — Neural Conscious Layer                   │
│      AI-native protocol · wZION bridge · on-chain      │
├─────────────────────────────────────────────────────────┤
│  L1  ⛏️ ZION TerraNova                                 │
│      Rust blockchain · CHv3/CHv4 · pool · P2P · LMDB   │
└─────────────────────────────────────────────────────────┘
```

---

## L1 — Core Protocol

**Language:** Rust (100%)  
**LOC:** 52,590  
**Tests:** 780+  
**Status:** ✅ Phase 1 — TestNet Live

### Components

| Component | Status | Description |
|-----------|--------|-------------|
| `core/` | ✅ Live | Block engine, mempool, UTXO, LMDB |
| `miner/` | ✅ Live | CHv3 native GPU/CPU miner |
| `pool/` | ✅ Live | Stratum v2 mining pool |
| `native-libs/` | ✅ Live | FFI bindings, CHv3 kernel |

### Protocol parameters

| Parameter | Value |
|-----------|-------|
| Block time | 60 seconds |
| Block reward | 5,400.067 ZION |
| Algorithm | Cosmic Harmony v3 (-> v4 in development) |
| Address prefix | Z3 |
| Signature scheme | Ed25519 |
| Storage | LMDB |
| Network | P2P over TCP/TLS |
| DAA | LWMA (Linearly Weighted Moving Avg) |

---

## L2 — NCL (Neural Conscious Layer)

**Status:** 🔄 In development  
**Target:** 2027

### Neural Conscious Layer

- AI-native protocol directly inside the blockchain
- On-chain model registry — models recorded as L1 transactions
- Proof-of-Inference: hash(model + input) -> deterministic output

### wZION Bridge (part of L2)

- Native ZION ↔ wZION (ERC-20) wrapping
- Current target: **Base Sepolia** testnet
- Smart contract: `L2/contracts/wZION.sol`
- Bridge UI: `/bridge`
- Public launch target window for bridge rollout: Base, Ethereum (Q3-Q4 2026, gated)

---

## L3 — ZION DAO (Governance)

**Status:** 📋 Design phase  
**Target:** 2028

- On-chain governance smart contracts (`L2/dao/`)
- Treasury: 4,000,000,000 ZION (DAO fund from premine)
- Proposal lifecycle: Draft -> Vote -> Execute
- Quorum: 10% of staked ZION supply
- Community grants, protocol upgrades, treasury allocations

---

## L4 — ZION Oasis (Gaming & XP Economy)

**Status:** 📋 Design phase  
**Target:** 2029

- **Golden Egg** — game economy built on ZION
- **XP system** — experience points for mining, bridge, and DAO activity
- **Winners** — competitive layer with ZION rewards
- 8,250,000,000 ZION reserved from premine for ZION OASIS + Winners

---

## L5 — ZION Free World (Humanitarian)

**Status:** 📋 Vision & planning  
**Target:** 2030

- **Free Energy Research** — quantum and free-energy research, open-source hardware
- **Humanitarian Missions** — 5% of block reward routed automatically to the Humanitarian Fund
- **Free Communities** — off-grid communities using ZION as a native medium of exchange
- **Education** — open-source learning platforms
- Funding base: 1,440,000,000 ZION from premine + 5% of every block

---

## L6 — ZION Issobella (Orbital Observatory)

**Status:** 📋 Long-term vision  
**Target:** 2040+

- **Earth Orbital Observatory** in low Earth orbit (LEO)
- Scientific research station governed by ZION DAO
- Open data — all observations public and recorded on-chain
- **ZION Space Network** — satellite mesh network for P2P redundancy
- **Name:** derived from ISS (International Space Station) + the proper name Issobella
- Funding: 1% block reward (Issobella Fund) + shared fund with L5

---

## Layer summary

| Layer | Name | Year | Purpose |
|-------|------|------|---------|
| **L1** | ZION TerraNova ⛏️ | 2026 | PoW blockchain — CHv3/CHv4, UTXO, fee burn, LWMA |
| **L2** | NCL 🧠 | 2027 | Neural Conscious Layer — AI-native, wZION bridge |
| **L3** | ZION DAO 🏛️ | 2028 | Governance, 4B ZION treasury, community grants |
| **L4** | ZION Oasis 🎮 | 2029 | Golden Egg, XP system, Winners, game layer |
| **L5** | ZION Free World 🌍 | 2030 | Quantum energy, humanitarian missions, free communities |
| **L6** | ZION Issobella 🔭 | 2040+ | Orbital observatory and research station |

---

## Development priorities 2026

```text
Q1 2026 (now):  L1 stabilisation · docs · launch gate
Q2 2026:        CHv4 upgrade · wZION bridge testnet -> gated rollout
Q3 2026:        L2 NCL prototype · wallet binaries · CoinGecko prep
Q4 2026:        Public launch decision window · L2/listing only after GO
```

---

*See also: [Consensus CHv3→CHv4](consensus.md) · [Public Launch Path](../mainnet/README.md)*