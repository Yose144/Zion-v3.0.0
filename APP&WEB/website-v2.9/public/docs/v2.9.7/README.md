# ZION TerraNova v2.9.7 — Pre-MainNet Gate

> **"On the Star" — from blockchain to the stars.**

[![Network](https://img.shields.io/badge/Network-TestNet-blue)](https://zionterranova.com)
[![Build](https://img.shields.io/badge/Build-Passing-green)](https://github.com/Zion-TerraNova)
[![Tests](https://img.shields.io/badge/Tests-780%2B-brightgreen)](https://github.com/Zion-TerraNova)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What is ZION?

ZION is a **Layer 1 Proof-of-Work blockchain** built from scratch in Rust. It uses the custom **Cosmic Harmony v3** mining algorithm — CPU-friendly, GPU-accelerated, ASIC-resistant. All transaction fees are permanently burned.

v2.9.7 is the **Pre-MainNet Gate** release — a stability and documentation iteration on top of v2.9.6. No consensus rules, emission schedule, or cryptographic primitives were changed. The network is live on TestNet with three seed nodes running continuously.

---

## Protocol at a Glance

| Parameter | Value |
|-----------|-------|
| **Total Supply** | 144,000,000,000 ZION (hard cap) |
| **Initial Block Reward** | 5,400.067 ZION |
| **Emission Decay** | −20% every 10 years (Decade Decay) |
| **Tail Emission** | 725 ZION/block (permanent, post-decay) |
| **Mining Horizon** | 100+ years |
| **Block Time** | 60 seconds |
| **Consensus** | Cosmic Harmony v3 (PoW) |
| **Transaction Model** | UTXO — Ed25519 signatures |
| **Storage** | LMDB |
| **DAA** | LWMA — 60-block window, ±25% |
| **Fee Policy** | 100% burn |
| **Presale / ICO** | None — Fair Launch |
| **Network** | TestNet — Helsinki · USA · Asia |

---

## Genesis Premine

11.31% of total supply (16.28B ZION) was created in the genesis block.  
The remaining **88.69%** (127.72B ZION) is emitted entirely through Proof-of-Work mining.

| Category | ZION | % of Supply |
|----------|------|-------------|
| ZION OASIS + Winners | 8,250,000,000 | 5.73% |
| DAO Treasury | 4,000,000,000 | 2.78% |
| Infrastructure | 2,590,000,000 | 1.80% |
| Humanitarian Reserve | 1,440,000,000 | 1.00% |
| **Total** | **16,280,000,000** | **11.31%** |

All premine addresses are publicly disclosed in `/PREMINE_ADDRESSES_PUBLIC.txt` and verifiable on-chain from the genesis block.  
No private or hidden allocations. Governance of DAO Treasury is community-controlled.

---

## 6-Layer "On the Star" Architecture

ZION is designed as a multi-layer civilization infrastructure — from a PoW blockchain to an Earth orbital station.

```
                   ╭─────────────────────────────╮
              L6   │  🔭  ZION Issobella          │  2040+
                   ╰─────────────┬───────────────╯
                   ╭─────────────┴───────────────╮
              L5   │  🌍  ZION Free World         │  2030
                   ╰─────────────┬───────────────╯
                   ╭─────────────┴───────────────╮
              L4   │  🎮  ZION Oasis              │  2029
                   ╰─────────────┬───────────────╯
                   ╭─────────────┴───────────────╮
              L3   │  🏛️  ZION DAO + Warp         │  2027–2028
                   ╰─────────────┬───────────────╯
                   ╭─────────────┴───────────────╮
              L2   │  🧠  NCL Neural Layer        │  2027
                   ╰─────────────┬───────────────╯
              ╭────────────────────────────────────╮
         L1   │  ⛏️  ZION TerraNova               │  2026
              ╰────────────────────────────────────╯
```

| Layer | Name | Target | Status |
|-------|------|--------|--------|
| **L1** | ZION TerraNova — PoW blockchain | 2026 | ✅ TestNet Live |
| **L2** | NCL — Neural Conscious Layer (AI) | 2027 | 🔄 Design Phase |
| **L2** | wZION Bridge (Base EVM) | 2026 | 🔄 Testnet contracts deployed |
| **L3** | ZION DAO — Governance + Warp Corridors | 2027–2028 | 📐 Architecture |
| **L4** | ZION Oasis — Game + Economy layer | 2029 | 📋 Planned |
| **L5** | ZION Free World — Free energy + Humanitarian | 2030 | 📋 Planned |
| **L6** | ZION Issobella — Orbital observatory | 2040+ | 📋 Planned |

---

## Network Endpoints

| Region | RPC | P2P | Pool (Stratum) |
|--------|-----|-----|----------------|
| Zion2 | `91.98.122.165:8444` | `91.98.122.165:8334` | `91.98.122.165:3333` |
| DNS seed 1 | — | `seed1.zionterranova.com:8334` | — |
| DNS seed 2 | — | `seed2.zionterranova.com:8334` | — |

RPC: `POST /jsonrpc` — standard JSON-RPC 2.0.

---

## Quick Start

```bash
# Mine ZION on the public pool
zion-miner --pool stratum+tcp://91.98.122.165:3333 --wallet YOUR_ZION_ADDRESS

# Generate a new wallet
zion-wallet gen-mnemonic --out my-wallet.json --print

# Run a full node
zion-node --network testnet --rpc-port 8444 --p2p-port 8334
```

Download CLI binaries: [zionterranova.com/download](https://zionterranova.com/download)

---

## Block Reward Distribution

Each block reward is split automatically by the protocol:

| Recipient | Share | Purpose |
|-----------|-------|---------|
| **Miners** | 89% | Proof-of-Work reward |
| Humanitarian Fund | 5% | Clean water, healthcare, education missions |
| Issobella Foundation | 5% | L6 — Earth orbital research station |
| Mining Pool | 1% | Pool infrastructure and operations |

All transaction fees are **burned** (100%). No developer fee, no foundation pre-tax.

---

## MainNet Gate

Three blocking criteria must be cleared before MainNet launch:

- [ ] **B-CRIT-01** — Security audit complete (zero critical findings)
- [ ] **B-CRIT-02** — 3-week TestNet stability window (no consensus splits)
- [ ] **B-CRIT-03** — Community governance vote (quorum reached)

Additional targets: 50+ distributed seed nodes, pool tested at 100+ MH/s, bridge audit complete.

Historical target window in this snapshot: **31 December 2026**

---

## Links

- Website: [zionterranova.com](https://zionterranova.com)
- Explorer: [zionterranova.com/explorer](https://zionterranova.com/explorer)
- Mining Pool: [zionterranova.com/pool](https://zionterranova.com/pool)
- GitHub: [github.com/Zion-TerraNova](https://github.com/Zion-TerraNova)
- Download: [zionterranova.com/download](https://zionterranova.com/download)
