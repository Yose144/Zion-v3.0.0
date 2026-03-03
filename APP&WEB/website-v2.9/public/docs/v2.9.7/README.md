# ZION TerraNova v2.9.7 — Pre-MainNet Gate

> **"On the Star" — unified, resilient, ready for launch.**

[![Network](https://img.shields.io/badge/Network-TestNet-blue)](https://zionterranova.com)
[![Build](https://img.shields.io/badge/Build-Passing-green)](https://github.com/Zion-TerraNova)
[![Tests](https://img.shields.io/badge/Tests-780%2B-brightgreen)](https://github.com/Zion-TerraNova)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What is v2.9.7?

ZION v2.9.7 is the **Pre-MainNet Gate** release — a precision iteration on the v2.9.6 "On the Star" foundation. It focuses on **stability, visual coherence, and production readiness** across all six protocol layers and the public-facing web infrastructure.

This release does not change the core consensus rules, emission schedule, or cryptographic primitives. It closes operational gaps, unifies the UX surface, and makes the network inspector-ready for the audit cycle leading into MainNet.

---

## Core Protocol (Unchanged from v2.9.6)

| Parameter | Value |
|-----------|-------|
| **Total Supply** | 144,000,000,000 ZION |
| **Block Reward** | 5,400.067 → Decade Decay (-20%/10y), tail 725 ZION |
| **Block Time** | 60 seconds |
| **Mining Horizon** | 100+ years + tail emission |
| **Consensus** | Cosmic Harmony v3 (ASIC-resistant, CPU-friendly) |
| **Transaction Model** | UTXO + Ed25519 signatures |
| **Storage** | LMDB |
| **DAA** | LWMA 60-block (±25%) |
| **Fee Policy** | 100% burn |
| **Network** | TestNet — 3 nodes (Helsinki · USA · Asia) |

---

## What Changed in v2.9.7

### Website & UX — Pre-MainNet Gate Design System

The entire public web surface was unified under a consistent design language:

- **`zion-shell`** — transparent page wrapper preserving the observatory warp background system
- **`zion-container`** — responsive width-constrained layout wrapper (80rem max, auto margins)
- **`zion-panel`** — unified glass panel (blur + border + shadow) applied across all cards
- **Observatory Backgrounds** — Deep Space, Planet Orbit, Galactic Core modes now visible on every page

All 30+ page/component files across Explorer, Dashboard, Admin, Mining, Network, Bridge, DAO, Warp, Docs, Genesis, Download, and API Reference now use the unified design system.

### Stability & Operations

- All 780+ protocol test suites passing (0 failures)
- P2P connectivity stable across 3 seed regions
- Pool PPLNS telemetry: 30s refresh interval
- Block discovery rate normalized

### Documentation

- Version tree: v2.9.7 (Current), v2.9.6 (Previous), v2.9.5 (Archive)
- All public-facing docs reviewed for consistency
- Internal operations data removed from public docs

---

## 6-Layer Architecture — Status

| Layer | Name | Status |
|-------|------|--------|
| **L1** | ZION Blockchain | ✅ TestNet Live |
| **L2** | wZION Bridge (Base EVM) | 🔄 In Progress |
| **L3** | Warp Corridors (BTC·ETH·SOL) | 📐 Architecture |
| **L3** | AI Native | 📐 Design Phase |
| **L4** | OASIS Game Layer | 📋 Planned |
| **L5** | Consciousness Layer | 📋 Planned |
| **L6** | Planetary Infrastructure | 📋 Planned |

---

## Network Endpoints

| Region | RPC | P2P | Pool (Stratum) |
|--------|-----|-----|----------------|
| Helsinki 🇫🇮 | `77.42.31.72:8444` | `77.42.31.72:8334` | `77.42.31.72:3333` |
| USA 🇺🇸 | `178.156.240.160:8444` | `178.156.240.160:8334` | — |
| Asia 🌏 | `5.223.43.93:8444` | `5.223.43.93:8334` | — |

> All RPC endpoints accept `POST /jsonrpc` with standard JSON-RPC 2.0 payload.

---

## Quick Start

```bash
# Mine ZION on the public pool
zion-miner --pool stratum+tcp://77.42.31.72:3333 --wallet YOUR_ZION_ADDRESS

# Generate a new wallet
zion-wallet gen-mnemonic --out my-wallet.json --print

# Run a full node
zion-node --network testnet --rpc-port 8444 --p2p-port 8334
```

Download CLI binaries: [zionterranova.com/download](https://zionterranova.com/download)

---

## Reward Distribution (unchanged)

| Recipient | Share |
|-----------|-------|
| Miners | 89% |
| Humanitarian Fund | 5% |
| Issobella Foundation | 5% |
| Mining Pool | 1% |

All transaction fees are **burned** (deflationary pressure on the 144B supply).

---

## MainNet Gate Criteria

Before MainNet launch the following must be satisfied:

- [ ] **B-CRIT-01** — Security audit complete (no critical findings)
- [ ] **B-CRIT-02** — 3-week TestNet stability window (zero consensus splits)
- [ ] **B-CRIT-03** — Community governance vote (quorum reached)
- [ ] P2P: 50+ geographically distributed seed nodes
- [ ] Mining pool: tested at 100+ MH/s aggregate
- [ ] Bridge: wZION Base Sepolia audit complete

Target: **MainNet 31 December 2026**

---

## Links

- Website: [zionterranova.com](https://zionterranova.com)
- Explorer: [zionterranova.com/explorer](https://zionterranova.com/explorer)
- Mining Pool: [zionterranova.com/pool](https://zionterranova.com/pool)
- GitHub: [github.com/Zion-TerraNova](https://github.com/Zion-TerraNova)
- Download: [zionterranova.com/download](https://zionterranova.com/download)
