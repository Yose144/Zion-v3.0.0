# ZION TerraNova — Mainnet Whitepaper v3.0.5 (Canonical)

**Version:** 3.0.5 Canonical — Mainnet Beta  
**Date:** July 2026  
**Authors:** ZION Open-Source Contributors  
**License:** MIT  
**Status:** Mainnet Beta — 11/11 services active, protocol `zion-v3-node/3.0.5`, public launch 31 December 2026

> **Canonical source of truth:** This document supersedes all prior whitepaper drafts, including `V3/docs/ZION_Mainnet_Whitepaper_v3.0_Canonical.md`, `docs/WP3.0/WHITEPAPER_v3.0.md` and legacy v2.9.x whitepapers. For implementation truth, verify against `StatusV3.md`, `V3/ROADMAP.md`, `3.0.5.md` and `V3/` code.

---

> *"In code we trust. 144 billion ZION. Not one satoshi more."*

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [Motivation](#2-motivation)
3. [From 2.9 to 3.0.5 — A Brief History](#3-from-29-to-305--a-brief-history)
4. [Live Network Status](#4-live-network-status)
5. [L1 Architecture](#5-l1-architecture)
6. [Consensus — Ekam Deeksha v2](#6-consensus--ekam-deeksha-v2)
7. [Economic Model](#7-economic-model)
8. [L2 — wZION Bridge & DeFi](#8-l2--wzion-bridge--defi)
9. [L3 — NCL, WARP & AI-Native](#9-l3--ncl-warp--ai-native)
10. [L4 — ZION OASIS Game World](#10-l4--zion-oasis-game-world)
11. [L5 — ZION Free World & L6 — ZION Issobella](#11-l5--zion-free-world--l6--zion-issobella)
12. [AuxPoW Merge Mining](#12-auxpow-merge-mining)
13. [ZionDex](#13-ziondex)
14. [Security, Cryptography & Audit History](#14-security-cryptography--audit-history)
15. [DAO Governance](#15-dao-governance)
16. [Revenue System — Multistream Architecture](#16-revenue-system--multistream-architecture)
17. [Mainnet Readiness & Test Coverage](#17-mainnet-readiness--test-coverage)
18. [Roadmap](#18-roadmap)
19. [Legal Disclaimer](#19-legal-disclaimer)
20. [References](#20-references)

---

## 1. Abstract

**ZION TerraNova** is a proof-of-work cryptocurrency with a six-layer architecture (L1–L6) designed for ASIC resistance, fair distribution, built-in humanitarian funding, and a 100-year emission schedule.

This document is the **v3.0.5 canonical mainnet whitepaper**. It reflects the state of the network after the 3.0.3 decimal fork, the 3.0.4 hard genesis reset, and the 3.0.5 "All Green" operationalization. Historical 2.9.x documents are treated as legacy context; technical truth is defined by `V3/` code, `StatusV3.md`, `3.0.5.md`, and `V3/ROADMAP.md`.

Key parameters at a glance:

| Parameter | Value |
|-----------|-------|
| **Total supply** | 144,000,000,000 ZION (hard cap) |
| **Block time** | 60 seconds |
| **Initial block reward** | 5,400.067 ZION |
| **Emission model** | Decade Decay (−20 % every 10 years) |
| **Tail emission** | 724.784723787776 ZION/block from ~2126, forever |
| **Mining algorithm** | Ekam Deeksha v2 (CPU/GPU, ASIC-resistant) |
| **Signing** | Ed25519 |
| **Hashing** | BLAKE3 |
| **Address format** | Bech32 (`zion1…`) |
| **Transaction model** | UTXO + account-model memo extension |
| **Consensus** | Proof-of-Work (Nakamoto) |
| **Atomic unit** | 1 flower; **1 ZION = 1,000,000 flowers** (6 decimals) |
| **L2 wrapped token** | wZION (ERC-20 on Base, Arbitrum, BSC, Polygon, Optimism, Avalanche) |
| **Language** | Rust (Tokio async runtime) |
| **Protocol version** | `zion-v3-node/3.0.5` |
| **Genesis hash** | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |
| **Live height** | 827+ and growing |
| **Live server** | `62.171.141.136` |
| **Public launch target** | 31 December 2026 |

ZION allocates **10 %** of every block reward automatically to humanitarian and scientific purposes: 5 % to a Humanitarian Fund and 5 % to the L5/L6 Issobella Fund. An additional 1 % is protocol-burned. This distribution is enforced at the protocol level and cannot be altered by governance.

---

## 2. Motivation

### 2.1 Problems with the Status Quo

Most cryptocurrency projects share common structural flaws:

- **Insider pre-allocation** — venture capital and team tokens create structural inequality.
- **ASIC centralization** — specialized hardware quickly prices out individual miners.
- **No social impact** — protocol-level giving does not exist; philanthropy is optional and self-reported.
- **Half-life shocks** — halving events (e.g. Bitcoin's 4-year cycle) cause sudden supply-side disruptions.
- **Bridging fragility** — wrapped assets rely on opaque multi-sigs with no on-chain accountability.

### 2.2 ZION's Approach

| Flaw | ZION Solution |
|------|---------------|
| Insider tokens | Fair Launch — no pre-sale, no ICO, no private rounds |
| ASIC centralization | Ekam Deeksha v2 — memory-hard, CPU/GPU optimized |
| No social impact | 10 % of every block reward enforced by code |
| Supply shocks | Decade Decay — gradual −20 %/decade + perpetual tail |
| Opaque bridges | 5/5 validator quorum, on-chain proofs, timelocks, daily limits |

### 2.3 Visionary Framework

ZION's design emerges from spiritually-ethical principles translated into consensus rules:

- **Dharma** — the project has purpose beyond financial gain
- **Ahimsa** — non-harm (Fair Launch, ASIC resistance)
- **Seva** — service (humanitarian tithe)
- **Satya** — truth (open-source, on-chain auditability)
- **Karma** — what you give is what you receive (consciousness mining, loyalty rewards)

---

## 3. From 2.9 to 3.0.5 — A Brief History

### 3.1 The 2.9.x Era

ZION began as a Rust rewrite of a multi-layer blockchain vision. The 2.9.x testnet line proved the core ideas — CosmicHarmony PoW, a six-layer architecture, and a cross-chain bridge — but accumulated technical debt and relied on a 1e12 atomic-unit scaling that was incompatible with EVM bridging.

### 3.2 v3.0.0–v3.0.2 — Mainnet Genesis Path

The V3 mainnet line introduced a clean-room Rust implementation, Ed25519 signing, BLAKE3 hashing, UTXO model with account-model extensions, and the Ekam Deeksha v2 algorithm. The first mainnet genesis block was minted with 14 constitutional premine outputs.

### 3.3 v3.0.3 — Decimal Fork (2026-06-27)

To bridge cleanly to EVM chains (which use 18 decimals) and to simplify user-facing amounts, ZION executed an in-place decimal fork:

- **Before:** 1 ZION = 1,000,000,000,000 flowers (12 decimals)
- **After:** 1 ZION = 1,000,000 flowers (6 decimals)
- **Migration height:** 18,850 on the pre-reset chain
- **RPC compatibility:** `scaled_amount()` helper normalizes pre-migration balances
- **Canonical naming:** `_flowers` is the on-chain unit suffix

This fork preserved all block hashes 0..18,850 while changing the display and contract scaling going forward.

### 3.4 v3.0.4 — Hard Genesis Reset (2026-07-06)

A security incident involving a compromised Edge server and leaked EVM/team keys forced a full hard genesis reset. The reset:

- Moved all services to a new server: `62.171.141.136`
- Regenerated all 14 premine + 5 canonical + bridge vault addresses
- Deployed 7 new Base Mainnet contracts (wZION, ZIONBridge, ZIONGovernance, ZIONTreasury, ZIONStaking, ZIONFarm, ZIONAtomicSwap)
- Implemented the account-model `memo` field and unified L2 watcher scanning
- Fixed two critical consensus bugs:
  - **F1 (ZION-2026-001):** Missing signature verification on P2P account transactions
  - **F5 (ZION-2026-002):** Missing sender balance validation allowing unlimited inflation

The new genesis hash is `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`.

### 3.5 v3.0.5 — "All Green" Operationalization (2026-07-09)

The 3.0.5 upgrade operationalized the entire mainnet stack:

- Bumped protocol version from 3.0.3 to 3.0.5
- Reconciled documentation, removed stale IPs and fake commit hashes
- Built and deployed all L2/L3 services (bridge, DAO, atomic-swap, WARP)
- Repaired web Docker deployment (image reduced from 2.57 GB to 377 MB)
- Enabled a 2-minute watchdog timer with auto-restart
- Verified E2E memo tests in block 752
- Fixed memory leaks with bounded block retention and channels

### 3.6 v3.0.5+ — Current State (2026-07-13)

Recent milestones:

- **AuxPoW merge mining** integrated into pool server and dashboard (11 external coins)
- **Pool scalability** optimizations for 1,000+ miners (F1-F6, P7-P10)
- **Non-EVM tokens** deployed on Solana SPL and Stellar native asset
- **ZionDex** integrated with L3 WARP API and cross-chain AMM routing
- **Lightning Network** LND Docker stack prepared for Edge deployment

---

## 4. Live Network Status

### 4.1 Topology

```
Edge Server (62.171.141.136) — Primary 24/7 node + pool
  ├── zion-node    :8333 P2P, 127.0.0.1:8443 RPC
  ├── zion-node2   :8334 P2P, 127.0.0.1:8448 RPC (follower)
  ├── zion-pool    :8444 Stratum
  ├── zion-bridge  :9101 metrics
  ├── zion-dao     :8450 API
  ├── zion-atomic-swap :8452 API
  ├── zion-warp    :8453 API
  ├── zion-oasis, zion-free-world, zion-issobella
  ├── zion-dashboard :8766 (Basic Auth via nginx)
  ├── nginx        :80/443 → web + RPC proxy
  └── zion-web-next Docker container

Core/Local (109.81.87.10) — Backup node + AI services
  └── zion-backup-node :8333 P2P, 127.0.0.1:8446 RPC
```

### 4.2 Live Metrics (2026-07-13)

| Metric | Value |
|--------|-------|
| Protocol | `zion-v3-node/3.0.5` |
| Chain height | 827+ |
| Genesis hash | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |
| Active services | 11/11 |
| P2P peers | 1 (3-node mesh) |
| Pool miners | 11+ |
| Pool hashrate | ~365 KH/s |
| Circulating supply | 16.78B ZION |
| Total supply | 144B ZION |
| Web image size | 377 MB |
| Disk usage | 34G / 145G (24 %) |
| RAM usage | 2.2G / 7.8G (28 %) |

### 4.3 Public Endpoints

| Service | Endpoint |
|---------|----------|
| Website | `https://zionterranova.com` |
| Dashboard | `https://dashboard.zionterranova.com` |
| Pool | `62.171.141.136:8444` |
| Public RPC | `rpc.zionterranova.com:8443` (nginx TCP proxy) |

---

## 5. L1 Architecture

### 5.1 Technology Stack

```
┌─────────────────────────────────────────────────┐
│  JSON-RPC 2.0 (TCP)           configurable      │
│  Pool Stratum Session Wire    configurable      │
├─────────────────────────────────────────────────┤
│  Consensus Engine (Ekam Deeksha v2)             │
│  Mempool  ·  Block Builder  ·  DAA (LWMA)       │
├─────────────────────────────────────────────────┤
│  UTXO Set  ·  Merkle Tree  ·  Fee Calculator    │
├─────────────────────────────────────────────────┤
│  Persistence (LMDB/heed)                        │
│  P2P Gossip (TCP)              configurable      │
└─────────────────────────────────────────────────┘
```

- **Runtime:** Rust + Tokio async
- **Database:** LMDB (memory-mapped, zero-copy reads) via `heed`
- **API:** JSON-RPC 2.0 over TCP (runtime-configurable bind)
- **Mining protocol:** Stratum-style session wire in `V3/L1/pool` (runtime-configurable bind)
- **Peer-to-peer:** TCP gossip protocol (runtime-configurable bind)

### 5.2 UTXO Model

ZION uses the Unspent Transaction Output model. Each transaction consumes one or more existing UTXOs and produces new ones.

```rust
pub struct TxOutput {
  pub amount: u64,      // Amount in flowers (atomic units)
  pub address: String,  // Destination address (zion1...)
  pub memo: Option<String>,
}
```

Outputs are locked to Ed25519 public keys. Spending requires a valid signature. The v3.0.4 memo hard fork added an optional 256-byte ASCII `memo` field to both UTXO and account-model transactions, enabling L2 watchers to parse intent-based messages such as `BRIDGE:0x...`, `DAO:vote:1:yes`, and `SWAP:LOCK:<hash>:120:base:0x...`.

### 5.3 Address Format

Addresses use **Bech32** encoding with the `zion1` human-readable prefix:

```
zion1q540v6y4f0s4v3n0f8t740t53494z56024u645c
```

Bech32 provides built-in error detection and eliminates ambiguous characters (0/O, l/1).

### 5.4 Fee Policy — 100 % Burn

All transaction fees are **burned** (destroyed). This makes ZION mildly deflationary beyond the emission schedule. Miners are rewarded exclusively through block rewards, keeping incentives aligned with network security rather than fee extraction.

Fee constants (`V3/L1/core/src/fee.rs`):
- `MIN_TX_FEE = 1_000` flowers (0.001 ZION)
- `MIN_FEE_RATE = 1` flower/byte
- `MAX_TX_SIZE = 100_000` bytes
- Burn address: `zion1burn0000000000000000000000000000000dead`

### 5.5 P2P Network

- **Gossip protocol** over TCP (runtime-configurable bind)
- Peer discovery via hardcoded seed peers
- Block propagation within seconds across global topology
- Peer banning for protocol violations
- Rate limiting: max 100 messages/60 s per peer
- Escalating ban durations: 300 s → 1 800 s → 7 200 s (permanent after 3 strikes)
- Max peers: 128
- IBD (Initial Block Download) engine with batch sync (500 blocks/request), stall detection, and peer round-robin

---

## 6. Consensus — Ekam Deeksha v2

### 6.1 Algorithm Name

The proof-of-work algorithm is called **Ekam Deeksha** (Sanskrit: "one initiation"). Version 2 is the mainnet-track algorithm.

### 6.2 Design Goals

1. **ASIC resistance** — memory-hard stages prevent fixed-function hardware from dominating
2. **CPU/GPU friendly** — efficient on consumer hardware, including Apple Silicon NPUs
3. **Multi-stage pipeline** — six sequential stages prevent shortcut optimizations

### 6.3 Pipeline

```
Input: block_header ║ nonce (u64)
  │
  ├─ Stage 1: Keccak-256        → 32-byte digest
  ├─ Stage 2: SHA3-512          → 64-byte expansion
  ├─ Stage 3: Golden Matrix     → matrix multiplication diffusion
  ├─ Stage 4: 256 KiB Scratchpad → memory-hard fill + dependent reads
  ├─ Stage 5: NPU Mixing        → neural processing unit vector ops
  └─ Stage 6: Cosmic Fusion     → final hash reduction
  │
Output: 32-byte PoW hash
```

**Stage 4 (Scratchpad)** is the key ASIC-resistance mechanism. The 256 KiB working set fits in L2 cache but requires pseudo-random dependent reads, defeating both pipelining and memory-latency hiding strategies used by ASICs.

**Stage 5 (NPU Mixing)** can leverage Apple CoreML / NVIDIA TensorRT / Intel OpenVINO / ONNX Runtime for native hardware acceleration on commodity devices.

### 6.4 Difficulty Adjustment Algorithm (DAA)

ZION uses **LWMA (Linearly Weighted Moving Average)** with a 60-block window:

- **Target block time:** 60 seconds
- **Adjustment range:** ±25 % per block (integer arithmetic, no f64)
- **Re-target:** Every block
- **Timestamp sanity:** clamp ±2× target (±120 s)
- **Min difficulty:** 1 000

LWMA reacts smoothly to hashrate changes only seconds old, preventing the oscillation and timestamp-gaming attacks that plague simpler algorithms.

### 6.5 Fork Hooks

`CHV_EKAM_V2_FORK_HEIGHT` is prepared for coordinated future PoW upgrades. In the default production build, Ekam Deeksha v2 is active from genesis (height 0).

---

## 7. Economic Model

### 7.1 Total Supply

The hard cap is **144,000,000,000 ZION** — set in genesis and immutable. No governance vote can increase it.

| Category | Amount | Share |
|----------|--------|-------|
| Mining supply | 127,220,000,000 ZION | 88.35 % |
| Genesis premine | 16,780,000,000 ZION | 11.65 % |
| **Total** | **144,000,000,000 ZION** | **100 %** |

Atomic unit: **1 ZION = 1,000,000 flowers** (6 decimals). All on-chain accounting uses flowers (`u64`).

### 7.2 Decade Decay Emission

Unlike Bitcoin's abrupt 4-year halvings, ZION reduces the block reward by **20 %** every **10 years** (5,256,000 blocks). This creates a smooth, predictable supply curve that sustains mining economics for over a century.

| Decade | Years | Block Reward (ZION) | Decade Emission |
|--------|-------|---------------------|-----------------|
| 1 | 2026–2036 | 5,400.067 | 28,383,712,152 |
| 2 | 2036–2046 | 4,320.054 | 22,706,969,722 |
| 3 | 2046–2056 | 3,456.043 | 18,165,575,777 |
| 4 | 2056–2066 | 2,764.834 | 14,532,460,622 |
| 5 | 2066–2076 | 2,211.867 | 11,625,968,497 |
| 6 | 2076–2086 | 1,769.494 | 9,300,774,798 |
| 7 | 2086–2096 | 1,415.595 | 7,440,619,838 |
| 8 | 2096–2106 | 1,132.476 | 5,952,495,871 |
| 9 | 2106–2116 | 905.981 | 4,761,996,697 |
| 10 | 2116–2126 | 724.784723787776 | 3,809,597,357 |
| **Tail** | **2126+** | **724.784723787776** | **Forever** |

**Tail emission** begins after decade 10. A perpetual minimum reward of **724.784723787776 ZION/block** ensures miners are always incentivized to secure the network — no "fee-only" security model required.

### 7.3 Block Reward Distribution

Every block reward is split automatically by the protocol:

| Recipient | Share | Purpose |
|-----------|-------|---------|
| **Miners (PPLNS)** | 89 % | Network security |
| **Humanitarian Fund** | 5 % | Global humanitarian projects |
| **L5/L6 Issobella Fund** | 5 % | Science & space program |
| **Protocol burn** | 1 % | Burned, never minted |

This distribution is enforced in `V3/L1/core/src/emission.rs` and cannot be altered by governance. The 1 % pool fee is **burned** by the protocol; pool operators do not receive it as revenue. On-chain fee-split enforcement is live: V3 core produces and validates four-output coinbase payouts on mainnet with deterministic split `89/5/5/1`. First explicitly verified split-enabled block: **465**.

### 7.4 Comparison

| | ZION | Bitcoin | Monero | Ethereum |
|---|---|---|---|---|
| Supply | 144B | 21M | ∞ (tail) | ∞ |
| Emission | Decade Decay (−20%/10y) | Halving (−50%/4y) | Tail 0.6 XMR/block | Issuance + burn |
| Block time | 60s | 600s | 120s | 12s |
| Consensus | PoW (Ekam Deeksha) | PoW (SHA-256d) | PoW (RandomX) | PoS |
| ASIC resistance | High (memory-hard) | None | High | N/A |
| Built-in giving | 10 % enforced | None | None | None |
| Fee model | 100 % burn | Market auction | Market auction | EIP-1559 burn |

### 7.5 Genesis Premine Distribution

13 wallets defined in `PREMINE_ADDRESSES_PUBLIC.txt`:

| # | Category | Amount (ZION) | Purpose |
|---|----------|---------------|---------|
| 1–5 | OASIS + Golden Egg/XP (5 slots × 1.65B) | 8,250,000,000 | L4 game world reward pool |
| 6 | DAO Treasury (main) | 2,500,000,000 | Community governance reserve |
| 7 | DAO Grants & Bounties | 1,000,000,000 | Developer grants |
| 8 | DAO Ecosystem Bootstrap | 500,000,000 | Ecosystem growth |
| 9 | Core Development Fund | 1,000,000,000 | Ongoing development |
| 10 | Network Infrastructure | 1,000,000,000 | Seed nodes & infrastructure |
| 11 | Genesis Projects Steward | 590,000,000 | Lifetime project stewardship |
| 12 | Humanitarian — Children Future Fund | 1,440,000,000 | Immediate humanitarian seed |
| 13 | Bridge Seed Fund | 400,000,000 | Bridge operational budget |
| 14 | Bridge Vault UTXO Seed | 100,000,000 | UTXO liquidity for bridge unlocks |

**DAO Treasury time-lock:** All 4,000,000,000 ZION in the DAO treasury (#6–8) is locked until block height **525,600** (~1 year after genesis). On-chain enforcement in `V3/L1/core/src/validation.rs` Step 11.

---

## 8. L2 — wZION Bridge & DeFi

### 8.1 Architecture

**wZION** is an ERC-20 wrapped token representing ZION value on EVM chains. The bridge enables liquidity movement without requiring L1 infrastructure on the EVM chain.

```
ZION L1  ──[lock]──→  Bridge Contract  ──[mint]──→  wZION (EVM)
wZION    ──[burn]──→  Bridge Contract  ──[unlock]──→  ZION L1
```

### 8.2 Bridge Security

- **Validator quorum:** 5-of-5 multi-sig for cross-chain attestations on mainnet
- L1 block header verification and Merkle proof validation
- Rate limiting on cross-border transfers
- Daily limit, max single amount, and timelock threshold enforced by contract
- Relayer fail-closed: if signers < threshold or duplicate `validator_id` → error **before** L1 RPC call
- Account-model memo field used for lock intent (e.g. `BRIDGE:0x<evm>`)

### 8.3 Supported Networks

| Network | Status | Chain ID |
|---------|--------|----------|
| Base Mainnet | Live | 8453 |
| Arbitrum One | Live | 42161 |
| BNB Smart Chain | Configured | 56 |
| Polygon | Configured | 137 |
| Optimism | Live | 10 |
| Avalanche C-Chain | Configured | 43114 |

### 8.4 L2 Smart Contracts (Base Mainnet)

All contracts are verified on Basescan:

| Contract | Address | Description |
|----------|---------|-------------|
| **wZION** | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ERC-20 wrapped ZION (same address on all 6 EVM chains) |
| **ZionBridge (Base)** | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | Lock/mint and burn/unlock bridge, 5/5 validators |
| **ZionBridge (non-Base)** | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | Bridge proxy on Arb/BSC/Poly/Opt/Avax |
| **ZionStaking** | `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` | Stake wZION for 12 % APR |
| **ZionFarm** | `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` | Liquidity farming, 1 wZION/s |
| **ZionGovernance** | `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8` | On-chain DAO voting |
| **ZionTreasury** | `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` | 3-of-3 multisig treasury |
| **ZionAtomicSwap** | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` | Trustless HTLC swaps |
| **UniV4 Pool** | `0xcCEaD51568E8d701f7db7e6699F3986031F07C7B` | wZION/USDT + wZION/WETH |

### 8.5 DeFi Ecosystem

The L2 DeFi ecosystem provides:

- **Staking** — stake wZION to earn protocol yield (12 % APR, 7d cooldown, 100K wZION reward pool funded)
- **Farming** — provide liquidity and earn LP rewards (500K wZION pool funded)
- **DEX trading** — wZION/USDT and wZION/WETH via Uniswap V4 concentrated liquidity
- **Atomic swaps** — trustless HTLC-based cross-chain swaps (100K ZION escrow funded)
- **Governance** — DAO proposals and voting with wZION (5 guardians)

---

## 9. L3 — NCL, WARP & AI-Native

L3 comprises three interlinked modules:

| Module | Crate | Purpose |
|--------|-------|---------|
| NCL | `zion-ncl` | Distributed AI inference marketplace |
| WARP | `zion-warp` | Universal cross-chain bridge protocol |
| AI-native | `zion-ai-native` | On-chain AI agents |

### 9.1 NCL — Neural Compute Layer

NCL transforms mining infrastructure into a distributed AI computing network. Miners can process AI inference tasks alongside mining and earn additional NCL rewards.

**Protocol lifecycle:**

```
ncl.register   → miner announces NCL capacity
ncl.get_task   → receives AI task from pool
ncl.submit     → submits result
ncl.status     → pool verifies and pays
```

### 9.2 NPU Runtime Detection

NCL auto-detects the fastest available AI backend:

| Platform | Backend |
|----------|---------|
| Apple M-series | CoreML |
| NVIDIA GPU | TensorRT |
| Intel CPU/GPU | OpenVINO |
| Other | ONNX Runtime (fallback) |

### 9.3 WARP — Cross-chain Bridge Protocol

WARP enables native ZION transfers to and from 12 chain families:

| Chain Family | Status |
|---|---|
| EVM (Base, Arbitrum, BSC, Polygon, Optimism, Avalanche) | Live / configured |
| Bitcoin | Implemented |
| Solana | SPL token deployed |
| Tron | Contract ready, pending deploy |
| Stellar | Native asset deployed |
| Cardano | CBOR TX builder ready |
| Cosmos | CosmWasm contract ready |
| Aptos | BCS TX builder ready |
| Sui | BCS TX builder ready |
| NEAR | borsh TX builder ready |
| TON | TL-B/BOC TX builder ready |
| Lightning | LND Docker stack ready |

WARP REST API runs on port **8453** (Axum). Persistence via SQLite. Validator quorum: 3/5.

### 9.4 AI-Native & Hiran v2.2

The AI-native layer implements AI agents as first-class protocol objects: on-chain model registry, AI-assisted governance for DAO decisions, and on-chain data analysis.

**Hiran v2.2** is a domain-specific fine-tuned model for the ZION ecosystem:

- **Base model:** `unsloth/Meta-Llama-3.1-8B-Instruct`
- **Method:** QLoRA (curriculum, 5 stages)
- **Inference:** Ollama/llama.cpp, ports 11434 / 8001 / 8002

---

## 10. L4 — ZION OASIS Game World

**OASIS** is a metaverse/game layer linked to the ZION blockchain — where game economy meets real L1 tokens.

**Key concepts:**

- **8 Genesis Territories**
- **9 Consciousness Levels** (Kabbalah Sefira: Malkuth → Keter)
- **8.25B ZION reward pool** (5 genesis slots × 1.65B, 10-year distribution)
- **XP off-chain** — SQLite `oasis.db`, L1 remains pure

**REST API** (port 8094): health, player, XP award, leaderboard, guild CRUD, territory map, reward pools.

**Status:** Live daemon; game implementation ongoing.

---

## 11. L5 — ZION Free World & L6 — ZION Issobella

### 11.1 L5 — ZION Free World

> *"Freedom is not given — it is built, block by block."*

**Target:** 2030

L5 is the humanitarian and scientific layer funded directly by the blockchain protocol. Its purpose is to build infrastructure for free communities, research free energy, and execute humanitarian missions.

**Pillars:**

1. Free Energy Research
2. Humanitarian Missions
3. Free Communities
4. Education & Awareness

**Funding:** 5 % per block → L5/L6 Issobella Fund + 5 % per block → Humanitarian Fund + DAO grants + L4 OASIS revenue.

### 11.2 L6 — ZION Issobella

> *"The star is not the destination — it is the beginning."*

**Target:** 2040+

**ZION Issobella** is the apex layer — a scientific observatory and research program. Missions include astronomical research, climate monitoring, satellite mesh networking, microgravity experiments, and education.

**Funding:** L5/L6 Issobella Fund (5 % per block), tail emission (2126+), DAO Treasury, L4 OASIS NFTs.

---

## 12. AuxPoW Merge Mining

ZION's pool server supports **AuxPoW merge mining** through a standalone `AuXpow` crate. This allows ZION miners to simultaneously mine up to 11 external proof-of-work coins without reducing ZION hashrate.

### 12.1 Supported Parent Coins

| Coin | Algorithm | Status |
|------|-----------|--------|
| DCR | Blake3 (DCP-0011) | Primary target |
| ALPH | Blake3 | Secondary target |
| KAS | kHeavyHash | Supported |
| ERG | Autolykos v2 | Supported |
| RVN | KawPow | Supported |
| ETC | Etchash | Supported |
| EVR | KawPow | Supported |
| MEWC | KawPow | Supported |
| FLUX | ZelHash | Supported |
| CLORE | KawPow | Supported |
| XMR | RandomX | Supported |

### 12.2 Architecture

- `AuXpow/` crate provides Stratum v1 proxy, external hasher dispatch, and profit switching
- Pool server spawns an `AuxPowScheduler` on a dedicated Tokio runtime
- External pool jobs are multiplexed into ZION miner work
- Valid external shares are forwarded upstream to the parent pool
- Profit-switching uses 15 % hysteresis and a circuit breaker (5 failures → 300 s cooldown)

### 12.3 Activation

AuxPoW is disabled by default. To enable:

```bash
ZION_AUXPOW_ENABLED=1
ZION_AUXPOW_WALLET=<real-wallet-address>
```

### 12.4 True AuxPoW Future

The current implementation is a **pool-side proxy** (Phase 1). A future hard fork will introduce **true AuxPoW** where ZION blocks carry parent-chain block headers, allowing DCR/ALPH hashrate to directly secure ZION. See `AUXPOW_TRUE_MERGE_MINING_PLAN.md`.

---

## 13. ZionDex

**ZionDex** is ZION's cross-chain decentralized exchange layer. Combined with WARP, it enables swaps between any token on any chain using ZION as native settlement.

### 13.1 Components

| Component | Status | Details |
|---|---|---|
| ZionDex Router | Live Beta | Dijkstra path finding, top 3 routes, 30 s price cache |
| Intent crate | Built | SwapIntent, EIP-712 + Ed25519 signing, Dutch auction |
| Solver daemon | Built | REST API port 8455, off-chain solver |
| AMM contracts | Built | Foundry-tested PoolManager + Hooks + Router + ZDX |
| TypeScript SDK | Built | `@zion/dex-sdk` |
| Web UI | Live Beta | `/dex`, `/ziondex`, `/dex/liquidity`, `/dex/portfolio` |
| Mobile/Desktop | Built | React Native + Electron screens |

### 13.2 Integration

- ZionDex Router connects to L3 WARP API (`127.0.0.1:8453`)
- Cross-chain AMM routing queries WARP `/chains` and computes optimal paths
- Execution via `POST /transfers/outbound` and polling `GET /transfers/:id`

### 13.3 Roadmap

- Deploy ZionDex Router service on Edge (port 8454)
- Deploy IntentSettlement + SolverRegistry on Base (pending ETH budget)
- Frontend intent UI
- Custom AMM deployment

---

## 14. Security, Cryptography & Audit History

### 14.1 Cryptographic Primitives

| Primitive | Usage |
|-----------|-------|
| **BLAKE3** | Transaction hashing, Merkle utilities, core hashing |
| **Ed25519** | Transaction and block signing |
| **Keccak-256 + SHA3-512** | Ekam Deeksha v2 consensus pipeline stages |
| **RIPEMD-160** | Address derivation intermediate step |
| **secp256k1 (k256)** | EVM bridge validator signatures |

### 14.2 Security Features

- **Max reorg depth:** 10 blocks
- **Soft finality:** 60 blocks (~60 minutes)
- **Coinbase maturity:** 100 blocks
- **Peer banning:** automatic ban on invalid blocks (escalating durations)
- **Rate limiting:** max 100 messages/s per peer
- **Wallet secret key zeroize** after signing
- **LMDB atomic writes** — single transaction for block + UTXO updates
- **F4.7 max TX cap:** 144B ZION limit active from height 1
- **F5 balance check:** sender balance validation active from genesis

### 14.3 Security Incidents & Remediation

Between 2026-07-02 and 2026-07-03, the ZION network experienced security incidents disclosed in `docs/security/SECURITY_DISCLOSURE_2026-07.md`:

| ID | Severity | Issue | Fix |
|---|---|---|---|
| ZION-2026-001 | HIGH | Forged account TX via P2P (missing `verify_signature`) | Fixed v3.0.4, height-gated |
| ZION-2026-002 | CRITICAL | Account model balance validation bypass | Fixed v3.0.4, height-gated |
| ZION-2026-003 | CRITICAL | Edge server compromise via TeamViewer | Hard reset + new server |
| ZION-2026-005 | CRITICAL | EVM key compromise | Pending contract redeploy |

No external user funds were at risk. ZION is pre-launch with no third-party token distribution.

### 14.4 Audit History

- **Internal audit:** Ongoing; all findings above remediated or pending
- **External audit:** Planned for Q4 2026 before public launch
- **Basescan verification:** 7/7 Base Mainnet contracts verified (2026-07-09)

---

## 15. DAO Governance

### 15.1 DAO Treasury

| Allocation | ZION | Purpose |
|------------|------|---------|
| Community Governance (main) | 2,500,000,000 | Primary reserve |
| Grants & Bounties | 1,000,000,000 | Developer grants |
| Ecosystem Bootstrap | 500,000,000 | Ecosystem growth |

Treasury locked until block height **525,600**.

### 15.2 Voting Mechanism

- 1 ZION = 1 vote (snapshot-weighted)
- Delegation supported by governance layer policies
- Pre-execution lock: 48 hours

| Proposal Type | Quorum | Duration |
|---------------|--------|----------|
| Parameter proposal | 10 % | 7 days |
| Treasury proposal | 15 % | 7 days |
| Emergency proposal | 20 % | 3 days |
| Pass condition | votes_for > votes_against | — |

### 15.3 Treasury Spending

Multi-sig protection: **5-of-7 signatures** historically; current L2 Treasury contract is a **3-of-3 multisig**. DAO on-chain voting uses 5 guardians.

### 15.4 Immutable Parameters

The DAO **cannot** change:

- Total supply (144B ZION)
- Genesis allocation (16.78B ZION)
- Block time (60 seconds)
- Mining algorithm (Ekam Deeksha v2)
- Consensus type (Proof-of-Work)
- Block reward distribution ratios (89/5/5/1 %)

### 15.5 Decentralization Phases

| Phase | Timeline | Features |
|-------|----------|----------|
| Phase 1 | 2025–2026 | Snapshot voting, off-chain signaling |
| Phase 2 | 2026–2027 | On-chain proposal lifecycle (MainNet) |
| Phase 3 | 2027+ | Full decentralization; optional quadratic-voting R&D |

---

## 16. Revenue System — Multistream Architecture

The ZION V3 revenue system is a **multi-stream economic engine** with three primary channels:

| Stream | Allocation | State |
|--------|-----------|-------|
| **ZION Canonical Mining** | 50 % | On-chain payouts live (fee split 89/5/5/1) |
| **Multi-Algo External (AuxPoW)** | 25 % | Pool-side proxy live; true AuxPoW fork planned |
| **NCL AI Compute** | 25 % | Telemetry & tracking live; AI gateway integration in progress |

### 16.1 Verified Working Components

- `RevenueCollector` — thread-safe, idempotent blocks, circuit breaker
- `RevenueJournal` — append-only JSONL, daily rotation, replayable
- `RevenueHealth` — per-source circuit breaker (10 fails / 60s reset)
- `ProfitRouter` — 11+ coins, pool preference hierarchy, hysteresis
- `StreamLayers` — consensus-safe telemetry wrappers

### 16.2 On-Chain Fee Payouts

When a ZION block is found, the pool submits a batch UTXO transaction paying:

- 5 % humanitarian tithe
- 5 % Issobella fund
- 1 % burned

On failure, fees are restored via `restore_fees()` and retried next round.

---

## 17. Mainnet Readiness & Test Coverage

### 17.1 Test Pyramid (2026-07-13)

| Crate | Tests | Notes |
|---|---|---|
| `zion-core` (L1) | 432 | Consensus, validation, RPC, LMDB |
| `zion-cosmic-harmony` (L1 PoW) | 95 | Ekam Deeksha, GPU kernels |
| `zion-pool` (L1) | 106 | 73 lib + 33 bin, PPLNS, AuxPoW |
| `zion-miner` (L1) | 59 | GPU/CPU, external algorithms |
| `zion-native-ffi` | 4 | Native acceleration scaffold |
| `zion-bridge` (L2) | 157 | L1↔EVM relay |
| `zion-dao` (L2) | 65 | Governance |
| `zion-atomic-swap` (L2) | 15 | HTLC swaps |
| `zion-warp` (L3) | 499 | 12 chain adapters |
| `zion-ncl` (L3) | 43 | AI compute marketplace |
| `zion-ai-native` (L3) | 89 | Agent framework |
| `zion-auxpow` | 40 | Merge mining proxy |
| ZionDex Router | 37 | 20 unit + 8 integration + 9 intent |
| ZionDex Intent | 12 | SwapIntent, signing, Dutch auction |
| ZionDex Solver | 19 | Off-chain solver |
| ZionDex AMM | 20 | PoolManager + IntentSettlement |
| **Total** | **~1,600+** | **0 failures** |

### 17.2 Clean Gate

- `cargo fmt --all --check` ✅
- `cargo clippy --workspace --all-targets` ✅
- `cargo test --workspace --release` ✅
- `cargo audit` ✅ 0 vulnerabilities

### 17.3 Production Blockers

| Priority | Item | Status |
|----------|------|--------|
| P0 | EVM contract redeploy (ZION-2026-005) | Pending owner decision |
| P0 | External security audit | Planned Q4 2026 |
| P1 | Non-EVM chain deployments (7/9 remaining) | In progress |
| P1 | Lightning Network LND deploy on Edge | In progress |
| P1 | ZionDex Router service on Edge | Pending |
| P2 | `systemd User=zion` hardening | Not deployed |
| P2 | DEX liquidity depth | Pending ETH budget |

### 17.4 Live Infrastructure

**Edge server (`62.171.141.136`) — ACTIVE:**
- V3 mainnet node: height 827+
- RPC endpoint: `127.0.0.1:8443` (public via nginx proxy)
- Pool server: `0.0.0.0:8444`
- Prometheus metrics: `0.0.0.0:9115/metrics`
- Website: `https://zionterranova.com`
- Dashboard: `https://dashboard.zionterranova.com`
- 11 active systemd services + watchdog timer + web Docker container

---

## 18. Roadmap

### 18.1 Release History

| Version | Date | Status | Key Deliverables |
|---------|------|--------|------------------|
| v2.9.5 | 2025 | Archived | TestNet genesis, Rust L1 stack |
| v2.9.7 | Early 2026 | Archived | Code freeze, 168h stability |
| v3.0.3 | 2026-06-27 | Live | Decimal fork (1e12 → 1e6 flowers) |
| v3.0.4 | 2026-07-06 | Live | Hard genesis reset, DeFi deploy, security fixes |
| **v3.0.5** | **2026-07-09** | **Mainnet Beta** | **All Green — 11/11 services active** |
| v3.1.0 | Q4 2026 | Planned | Wallet SDK, mobile app, L4 OASIS backend, external audit |
| **v3.x Public Launch** | **2026-12-31** | **Target** | **Public mainnet launch** |

### 18.2 Key Milestones

| Milestone | Date | Success Criteria |
|-----------|------|------------------|
| Decimal fork | 2026-06-27 | 1 ZION = 1,000,000 flowers |
| Hard genesis reset | 2026-07-06 | New server, new keys, 7 contracts deployed |
| All Green | 2026-07-09 | 11/11 services active, E2E memo tests |
| AuxPoW integration | 2026-07-11 | Pool + dashboard live test |
| Non-EVM Solana + Stellar | 2026-07-13 | SPL token + native asset live |
| Security audit | Q4 2026 | No critical vulnerabilities |
| Mobile wallet | Q4 2026 | iOS + Android App Store submission |
| **Public Mainnet Launch** | **31 Dec 2026** | **General public mining and usage** |
| 1st Decade Decay | 2036 | Block reward → 4,320 ZION |
| L5 Free World | 2030 | Foundation + research lab |
| L6 Issobella start | 2040 | Space Division initiated |
| Tail emission | 2126 | 724.784723787776 ZION/block forever |

---

## 19. Legal Disclaimer

ZION is **open-source software** and **experimental technology** released under the MIT license. ZION is **not**:

- A security under MiCA or any other regulatory framework
- An investment product with guaranteed returns
- A licensed financial instrument

Participation in the ZION network is **voluntary** and occurs **at your own risk**. Token value is not guaranteed. Price may decline to zero. The regulatory environment may change.

ZION is a **community-run open-source protocol** and is **not operated by a single company issuer** in this V3 line.

**Mainnet Beta status:** Mining is active at your own risk. The network may contain bugs — no warranty. Genesis block and chain history are permanent.

See also:

- `../../docs/legal/DISCLAIMER.md`
- `../../docs/legal/TOKEN_NOT_SECURITY.md`
- `../../docs/legal/RISK_DISCLOSURE.md`
- `../../docs/legal/LEGAL_DISCLAIMER.md`

---

## 20. References

| Resource | Description |
|----------|-------------|
| `V3/L1/core/src/emission.rs` | Constitutional emission constants |
| `V3/L1/core/src/genesis.rs` | Genesis validation and reserve integrity |
| `V3/L1/core/src/difficulty.rs` | LWMA difficulty algorithm |
| `V3/L1/cosmic-harmony/src/deeksha.rs` | Ekam Deeksha v2 canonical PoW |
| `V3/L2/dao/src/proposal.rs` | DAO proposal types, quorum, voting windows |
| `StatusV3.md` | Current operational status and launch blockers |
| `3.0.5.md` | 3.0.5 "All Green" canonical summary |
| `V3/ROADMAP.md` | Implementation phases and gap inventory |
| `ZionDex.md` | Cross-chain DEX status and architecture |
| `AGENTS.md` | Developer/operator runbook |
| `docs/security/SECURITY_DISCLOSURE_2026-07.md` | Public vulnerability disclosure |
| `AUXPOW_TRUE_MERGE_MINING_PLAN.md` | AuxPoW hard-fork strategy |
| `github.com/Zion-TerraNova/v3-Mainnet` | Public source code (MIT license) |

---

> *"Gate, Gate, Paragate, Parasamgate, Bodhi Svaha"*  
> — Genesis block dedication, 2026

**ZION TerraNova v3.0.5 — Mainnet Beta**
