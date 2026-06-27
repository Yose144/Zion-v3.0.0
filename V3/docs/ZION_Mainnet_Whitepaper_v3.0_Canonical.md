# ZION TerraNova — Mainnet Whitepaper v3.0 (Canonical)

**Version:** 3.0 Canonical — Mainnet Genesis Ready  
**Date:** May 2026  
**Authors:** ZION Open-Source Contributors  
**License:** MIT  
**Status:** V3 mainnet-track — consensus, emission, bridge, revenue, and AI layers implemented; production deployment in progress  

> **Canonical source of truth:** This document supersedes all prior whitepaper drafts, including `docs/WP3.0/WHITEPAPER_v3.0.md` (superseded) and legacy v2.9.x whitepapers. For implementation truth, verify against `StatusV3.md`, `V3/ROADMAP.md`, and `V3/` code.

---

> *"In code we trust. 144 billion ZION. Not one satoshi more."*

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [Motivation](#2-motivation)
3. [L1 Architecture](#3-l1-architecture)
4. [Consensus — Ekam Deeksha v2](#4-consensus--ekam-deeksha-v2)
5. [Economic Model](#5-economic-model)
6. [L2 — wZION Bridge & DeFi](#6-l2--wzion-bridge--defi)
7. [L3 — NCL, WARP & AI-Native](#7-l3--ncl-warp--ai-native)
8. [L4 — ZION OASIS Game World](#8-l4--zion-oasis-game-world)
9. [L5 — ZION Free World & L6 — ZION Issobella](#9-l5--zion-free-world--l6--zion-issobella)
10. [Security, Cryptography & Audit](#10-security-cryptography--audit)
11. [DAO Governance](#11-dao-governance)
12. [Revenue System — Multistream Architecture](#12-revenue-system--multistream-architecture)
13. [Mainnet Readiness & Test Coverage](#13-mainnet-readiness--test-coverage)
14. [Roadmap](#14-roadmap)
15. [Legal Disclaimer](#15-legal-disclaimer)
16. [References](#16-references)

---

## 1. Abstract

**ZION TerraNova** is a proof-of-work cryptocurrency with a six-layer architecture (L1–L6) designed for ASIC resistance, fair distribution, built-in humanitarian funding, and a 100-year emission schedule.

This document is **V3-oriented**. Historical 2.9.x documents are treated as legacy context; technical truth is defined by `V3/` code, `StatusV3.md`, `V3/ROADMAP.md`, and `docs/mainnet/MAINNET_CONSTITUTION.md`.

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
| **Transaction model** | UTXO |
| **Consensus** | Proof-of-Work (Nakamoto) |
| **L2 wrapped token** | wZION (ERC-20 on Base) |
| **Language** | Rust (Tokio async runtime) |

ZION allocates **10 %** of every block reward automatically to humanitarian and scientific purposes: 5 % to a Humanitarian Fund and 5 % to the L5/L6 Issobella Fund. This allocation is enforced at the protocol level and cannot be altered by governance.

---

## 2. Motivation

### 2.1 Problems with the Status Quo

Most cryptocurrency projects share common structural flaws:

- **Insider pre-allocation** — venture capital and team tokens create structural inequality.
- **ASIC centralization** — specialized hardware quickly prices out individual miners.
- **No social impact** — protocol-level giving does not exist; philanthropy is optional and self-reported.
- **Half-life shocks** — halving events (e.g. Bitcoin's 4-year cycle) cause sudden supply-side disruptions.

### 2.2 ZION's Approach

| Flaw | ZION Solution |
|------|---------------|
| Insider tokens | Fair Launch — no pre-sale, no ICO, no private rounds |
| ASIC centralization | Ekam Deeksha v2 — memory-hard, CPU/GPU optimized |
| No social impact | 10 % of every block reward enforced by code |
| Supply shocks | Decade Decay — gradual −20 %/decade + perpetual tail |

### 2.3 Visionary Framework

ZION's design emerges from spiritually-ethical principles:

- **Dharma** — the project has purpose beyond financial gain
- **Ahimsa** — non-harm (Fair Launch, ASIC resistance)
- **Seva** — service (humanitarian tithe)
- **Satya** — truth (open-source, on-chain auditability)
- **Karma** — what you give is what you receive (consciousness mining)

---

## 3. L1 Architecture

### 3.1 Technology Stack

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

### 3.2 UTXO Model

ZION uses the Unspent Transaction Output model. Each transaction consumes one or more existing UTXOs and produces new ones.

```rust
pub struct TxOutput {
  pub amount: u64,      // Amount in flowers (atomic units)
  pub address: String,  // Destination address (zion1...)
  pub memo: Option<String>,
}
```

Outputs are locked to Ed25519 public keys. Spending requires a valid signature.

### 3.3 Address Format

Addresses use **Bech32** encoding with the `zion1` human-readable prefix:

```
zion1q540v6y4f0s4v3n0f8t740t53494z56024u645c
```

Bech32 provides built-in error detection and eliminates ambiguous characters (0/O, l/1).

### 3.4 Fee Policy — 100 % Burn

All transaction fees are **burned** (destroyed). This makes ZION mildly deflationary beyond the emission schedule. Miners are rewarded exclusively through block rewards, keeping incentives aligned with network security rather than fee extraction.

Fee constants (`V3/L1/core/src/fee.rs`):
- `MIN_TX_FEE = 1_000` flowers (0.001 ZION)
- `MIN_FEE_RATE = 1` flower/byte
- `MAX_TX_SIZE = 100_000` bytes
- Burn address: `zion1burn0000000000000000000000000000000dead`

### 3.5 P2P Network

- **Gossip protocol** over TCP (runtime-configurable bind)
- Peer discovery via DNS seeds + hardcoded bootstrap nodes
- Block propagation within seconds across global topology
- Peer banning for protocol violations
- Rate limiting: max 100 messages/60 s per peer
- Escalating ban durations: 300 s → 1 800 s → 7 200 s (permanent after 3 strikes)
- Max peers: 128

---

## 4. Consensus — Ekam Deeksha v2

### 4.1 Algorithm Name

The proof-of-work algorithm is called **Ekam Deeksha** (Sanskrit: "one initiation"). Version 2 is the mainnet-track algorithm.

### 4.2 Design Goals

1. **ASIC resistance** — memory-hard stages prevent fixed-function hardware from dominating
2. **CPU/GPU friendly** — efficient on consumer hardware, including Apple Silicon NPUs
3. **Multi-stage pipeline** — six sequential stages prevent shortcut optimizations

### 4.3 Pipeline

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

**Stage 5 (NPU Mixing)** leverages Apple CoreML / NVIDIA TensorRT / Intel OpenVINO / ONNX Runtime (auto-detected) for native hardware acceleration on commodity devices.

### 4.4 Difficulty Adjustment Algorithm (DAA)

ZION uses **LWMA (Linearly Weighted Moving Average)** with a 60-block window:

- **Target block time:** 60 seconds
- **Adjustment range:** ±25 % per block (integer arithmetic, no f64)
- **Re-target:** Every block
- **Timestamp sanity:** clamp ±2× target (±120 s)
- **Min difficulty:** 1 000

LWMA reacts smoothly to hashrate changes only seconds old, preventing the oscillation and timestamp-gaming attacks that plague simpler algorithms.

### 4.5 ASIC Resistance Score

Internal assessment: **90/100** (rated against CryptoRating ASIC-resistance methodology criteria).

### 4.6 Fork Hooks

`CHV_EKAM_V2_FORK_HEIGHT` is prepared for coordinated future PoW upgrades. In the default production build, Ekam Deeksha v2 is active from genesis (height 0).

---

## 5. Economic Model

### 5.1 Total Supply

The hard cap is **144,000,000,000 ZION** — set in genesis and immutable. No governance vote can increase it.

| Category | Amount | Share |
|----------|--------|-------|
| Mining supply | 127,220,000,000 ZION | 88.35 % |
| Genesis premine | 16,780,000,000 ZION | 11.65 % |
| **Total** | **144,000,000,000 ZION** | **100 %** |

Atomic unit: **1 ZION = 1,000,000 flowers** (6 decimals) (updated to 6-decimal in 3.0.3 fork). All on-chain accounting uses flowers (`u64`).

### 5.2 Decade Decay Emission

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

### 5.3 Block Reward Distribution

Every block reward is split automatically by the protocol:

| Recipient | Share | Purpose |
|-----------|-------|---------|
| **Miners (PPLNS)** | 89 % | Network security |
| **Humanitarian Fund** | 5 % | Global humanitarian projects |
| **L5/L6 Issobella Fund** | 5 % | Science & space program |
| **Pool operator** | 1 % | Pool infrastructure |

This distribution is enforced in `V3/L1/core/src/emission.rs` (`fee_split`) and cannot be altered by governance. On-chain fee-split enforcement is live: V3 core produces and validates four-output coinbase payouts on mainnet with deterministic split `89/5/5/1`. First explicitly verified split-enabled block: **465**.

### 5.4 Comparison

| | ZION | Bitcoin | Monero | Ethereum |
|---|---|---|---|---|
| Supply | 144B | 21M | ∞ (tail) | ∞ |
| Emission | Decade Decay (−20%/10y) | Halving (−50%/4y) | Tail 0.6 XMR/block | Issuance + burn |
| Block time | 60s | 600s | 120s | 12s |
| Consensus | PoW (Ekam Deeksha) | PoW (SHA-256d) | PoW (RandomX) | PoS |
| ASIC resistance | High (memory-hard) | None | High | N/A |
| Built-in giving | 10 % enforced | None | None | None |
| Fee model | 100 % burn | Market auction | Market auction | EIP-1559 burn |

### 5.5 Genesis Premine Distribution

13 wallets defined in `PREMINE_ADDRESSES_PUBLIC.txt`:

| # | Category | Amount (ZION) | Purpose |
|---|----------|---------------|---------|
| 1–5 | OASIS + Golden Egg/XP (5 slots × 1.65B) | 8,250,000,000 | L4 game world reward pool |
| 6 | DAO Treasury (main) | 2,500,000,000 | Community governance reserve |
| 7 | DAO Grants & Bounties | 1,000,000,000 | Developer grants |
| 8 | DAO Ecosystem Bootstrap | 500,000,000 | Ecosystem growth |
| 9 | Core Development Fund | 1,000,000,000 | Ongoing development |
| 10 | Network Infrastructure | 1,000,000,000 | Seed nodes & infrastructure |
| 11 | Genesis Creator | 590,000,000 | Lifetime project stewardship |
| 12 | Humanitarian — Children Future Fund | 1,440,000,000 | Immediate humanitarian seed |
|| 13 | Bridge Seed Fund | 400,000,000 | Bridge operational budget |
| 14 | Bridge Vault UTXO Seed | 100,000,000 | UTXO liquidity for bridge unlocks |

**DAO Treasury time-lock:** All 4,000,000,000 ZION in the DAO treasury (#6–8) is locked until block height **525,600** (~1 year after genesis). On-chain enforcement in `V3/L1/core/src/validation.rs` Step 11.

---

## 6. L2 — wZION Bridge & DeFi

### 6.1 Architecture

**wZION** is an ERC-20 wrapped token representing ZION value on EVM chains. The bridge enables liquidity movement without requiring L1 infrastructure on the EVM chain.

```
ZION L1  ──[lock]──→  Bridge Contract  ──[mint]──→  wZION (EVM)
wZION    ──[burn]──→  Bridge Contract  ──[unlock]──→  ZION L1
```

### 6.2 Bridge Security

- **Validator quorum:** 3-of-5 multi-sig for cross-chain attestations (staging currently 1/2; production target 3/5)
- L1 block header verification and Merkle proof validation
- Rate limiting on cross-border transfers
- Relayer fail-closed: `build_validator_proofs` returns `Result`; if `signers.len() < threshold` or duplicate `validator_id` → `Err` **before** L1 RPC call
- RPC: Ankr Premium (mainnet), publicnode.com (testnet)

### 6.3 Supported Networks

| Network | Status |
|---------|--------|
| Base Sepolia (testnet) | Live |
| Base Mainnet | MainNet launch |
| Arbitrum One | MainNet launch |
| BNB Smart Chain | MainNet launch |

### 6.4 L2 Smart Contracts

| Contract | Description |
|----------|-------------|
| **wZION** | ERC-20 wrapped ZION token |
| **ZionBridge** | Lock/mint and burn/unlock bridge |
| **ZionStaking** | Stake wZION for yield |
| **ZionFarm** | Liquidity farming with LP tokens |
| **AtomicSwap** | Trustless cross-chain atomic swaps |
| **ZionGovernance** | On-chain DAO voting (L2 mirror) |
| **ZionTreasury** | Multi-sig treasury management |
| **UniV3Pool** | wZION/USDC concentrated liquidity on Uniswap V3 |

### 6.5 DeFi Ecosystem

The L2 DeFi ecosystem provides:

- **Staking** — stake wZION to earn protocol yield (12 % APR, 7d cooldown)
- **Farming** — provide liquidity and earn LP rewards
- **DEX trading** — wZION/USDC via Uniswap V3 concentrated liquidity
- **Atomic swaps** — trustless HTLC-based cross-chain swaps
- **Governance** — DAO proposals and voting with wZION

---

## 7. L3 — NCL, WARP & AI-Native

L3 comprises three interlinked modules:

| Module | Crate | Purpose |
|--------|-------|---------|
| NCL | `zion-ncl` | Distributed AI inference marketplace |
| WARP | `zion-warp` | Cross-chain swap protocol |
| AI-native | `zion-ai-native` | On-chain AI agents |

### 7.1 NCL — Neural Compute Layer

NCL transforms mining infrastructure into a distributed AI computing network. Miners can process AI inference tasks alongside mining and earn additional NCL rewards.

**Protocol lifecycle:**

```
ncl.register   → miner announces NCL capacity
ncl.get_task   → receives AI task from pool
ncl.submit     → submits result
ncl.status     → pool verifies and pays
```

**Task Types & Rewards:**

| Task Type | Base Reward | Verification |
|-----------|-------------|--------------|
| Hash Chaining v1 | ~0.001 ZION | Deterministic (BLAKE3) |
| Embeddings | ~0.001 ZION | Sampling |
| LLM Inference | ~0.010 ZION | Sampling + reputation |
| Image Classification | ~0.002 ZION | Model hash |
| Image Generation | ~0.020 ZION | Perceptual hash |
| Speech to Text | ~0.005 ZION | CER/WER scoring |
| Model Training | ~0.100 ZION | Loss convergence |

### 7.2 NPU Runtime Detection

NCL auto-detects the fastest available AI backend:

| Platform | Backend |
|----------|---------|
| Apple M-series | CoreML |
| NVIDIA GPU | TensorRT |
| Intel CPU/GPU | OpenVINO |
| Other | ONNX Runtime (fallback) |

**Time allocation:** Default 70 % mining / 30 % NCL. Configurable from 50–90 % mining. Mining always has priority.

### 7.3 WARP — Cross-chain Swap Protocol

WARP enables atomic swaps between ZION and tokens across 7 chain families:

| Chain Family | Examples | Status |
|---|---|---|
| EVM (via Ankr) | Base, Arbitrum, BSC, ETH | Implemented |
| Cosmos IBC | ATOM, OSMO | Implemented |
| Bitcoin | BTC, LTC | Implemented |
| Solana | SOL, SPL | Implemented |
| NEAR | NEAR | Implemented |
| Polkadot | DOT | Implemented |
| TON | TON | Implemented |

WARP REST API runs on port **8092** (Axum). Persistence via SQLite.

### 7.4 AI-Native & Hiran v2.2

The AI-native layer implements AI agents as first-class protocol objects: on-chain model registry, AI-assisted governance for DAO decisions, and on-chain data analysis.

**Hiran v2.2** is a domain-specific fine-tuned model for the ZION ecosystem:

- **Base model:** `unsloth/Meta-Llama-3.1-8B-Instruct`
- **Method:** QLoRA (curriculum, 5 stages, max rank 64)
- **Dataset:** 22,181 instruction/output pairs
- **Inference speed:** ~40 tokens/s on RTX 4090 (FP16)
- **Integration:** `zion hiran` CLI commands, Docker service `hiran-inference` (llama.cpp + CUDA, port 8002)

---

## 8. L4 — ZION OASIS Game World

**OASIS** is an Unreal Engine 5 open-world linked to the ZION blockchain — a layer where game economy meets real L1 tokens.

**Key concepts:**

- **8 Genesis Territories** (Mount Zion, Cedar Forest, …)
- **9 Consciousness Levels** (Kabbalah Sefira: Malkuth → Keter)
- **8.25B ZION reward pool** (5 genesis slots × 1.65B, 10-year distribution)
- **XP off-chain** — SQLite `oasis.db`, L1 remains pure

**REST API** (port 8094): health, player, XP award, leaderboard, guild CRUD, territory map, reward pools — 9 endpoints.

**Status:** Specification Q3 2026, game implementation Q4 2026+.

### 8.1 Consciousness Mining Multipliers (2026–2035)

In the first decade, OASIS bonus pool adds extra rewards:

| Consciousness Level | Multiplier | Total Reward/block |
|--------------------|------------|---------------------|
| Physical (L1) | 1.0× | 5,400.07 ZION |
| Mental (L2) | 1.1× | 7,127.67 ZION |
| Aware (L3) | 1.2× | 7,283.82 ZION |
| Conscious (L4) | 1.3× | 7,440.00 ZION |
| Awakened (L5) | 1.5× | 7,754.51 ZION |
| Enlightened (L6) | 2.0× | 8,539.33 ZION |
| Transcendent (L7) | 3.0× | 10,108.96 ZION |
| Cosmic (L8) | 5.0× | 13,248.22 ZION |
| On The Star (L9) | 10.0× | 21,096.37 ZION |

After 2035 the bonus pool is exhausted; mining proceeds at base reward only.

---

## 9. L5 — ZION Free World & L6 — ZION Issobella

### 9.1 L5 — ZION Free World

> *"Freedom is not given — it is built, block by block."*

**Target:** 2030 | **Status:** Vision & Specification

L5 is the humanitarian and scientific layer funded directly by the blockchain protocol. Its purpose is to build infrastructure for free communities, research quantum free energy, and execute humanitarian missions.

**Pillars:**

1. **Free Energy Research** — quantum and free energy research, open-source hardware
2. **Humanitarian Missions** — clean water, education, healthcare, food security
3. **Free Communities** — energy-independent villages, mesh networks, local ZION economies
4. **Education & Awareness** — open-source educational platforms, consciousness mining outreach

**Funding Sources:**

| Source | Mechanism |
|--------|-----------|
| Block reward | 5 % per block → L5/L6 Issobella Fund (automatic) |
| Humanitarian tithe | 5 % per block (automatic) |
| DAO Grants | Community vote (variable) |
| L4 OASIS revenue | % of game economic activity (variable) |

### 9.2 L6 — ZION Issobella

> *"The star is not the destination — it is the beginning."*

**Target:** 2040+ | **Status:** Long-term vision

**ZION Issobella** (from ISS + proper name) is the apex layer — a scientific observatory and research station in Low Earth Orbit (LEO). Decentralized governance via ZION DAO, all scientific data public.

**Missions:**

- Astronomical research (no atmospheric distortion)
- Climate monitoring (supporting L5 Free World)
- Satellite mesh network — redundant P2P ZION nodes in orbit
- Research center — microgravity, quantum experiments
- Education — live-streams from space for the community

**Funding:** L5/L6 Issobella Fund (5 % per block), tail emission (2126+), DAO Treasury, L4 OASIS NFTs.

---

## 10. Security, Cryptography & Audit

### 10.1 Cryptographic Primitives

| Primitive | Usage |
|-----------|-------|
| **BLAKE3** | Transaction hashing, Merkle utilities, core hashing |
| **Ed25519** | Transaction and block signing |
| **Keccak-256 + SHA3-512** | Ekam Deeksha v2 consensus pipeline stages |
| **RIPEMD-160** | Address derivation intermediate step |

### 10.2 Security Features

- **Max reorg depth:** 10 blocks
- **Soft finality:** 60 blocks (~60 minutes)
- **Coinbase maturity:** 100 blocks
- **Peer banning:** automatic ban on invalid blocks (escalating durations)
- **Rate limiting:** max 100 messages/s per peer
- **Wallet secret key zeroize** after signing (audit P1-17)
- **LMDB atomic writes** — single transaction for block + UTXO updates

### 10.3 Audit History

Independent security audit scheduled for Q3 2026 (Trail of Bits / Halborn / OtterSec).

Internal audit findings (all resolved as of 2026-05-07):

| Finding | Severity | Status |
|---------|----------|--------|
| F1 — UTXO conservation-of-value | Critical | PR #20 ✅ |
| F2 — XOR Merkle root → BLAKE3 | High | Dispatcher + genesis activation ✅ |
| F3 — leaked wallet keys | Critical | PR #18 ✅ |
| F3b — leaked credentials in git | Critical | `git filter-repo` + rotation ✅ |
| F4 — bridge unlock multisig on L1 | Medium | PR #22 ✅ |
| F5 — unwrap/expect density | Medium | PR #23 + #24 ✅ |
| F6 — V3-src archives in repo | Medium | Cleanup + history rewrite ✅ |
| §3.2 — tx-hash malleability | Medium | PR #25 + v2 from genesis ✅ |
| §13 — native-ffi safety contracts | Medium | PR #28 ✅ |
| Relayer synthetic-proof kill | Medium | PR #27 ✅ |

---

## 11. DAO Governance

### 11.1 DAO Treasury

| Allocation | ZION | Purpose |
|------------|------|---------|
| Community Governance (main) | 2,500,000,000 | Primary reserve |
| Grants & Bounties | 1,000,000,000 | Developer grants |
| Ecosystem Bootstrap | 500,000,000 | Ecosystem growth |

### 11.2 Voting Mechanism

- 1 ZION = 1 vote (snapshot-weighted)
- Delegation: Supported by governance layer policies
- Pre-execution lock: 48 hours

| Proposal Type | Quorum | Duration |
|---------------|--------|----------|
| Parameter proposal | 10 % | 7 days |
| Treasury proposal | 15 % | 7 days |
| Emergency proposal | 20 % | 3 days |
| Pass condition | votes_for > votes_against | — |

### 11.3 Treasury Spending

Multi-sig protection: **5-of-7 signatures** required for any treasury transaction.

### 11.4 Immutable Parameters

The DAO **cannot** change:

- Total supply (144B ZION)
- Genesis allocation (16.78B ZION)
- Block time (60 seconds)
- Mining algorithm (Ekam Deeksha v2)
- Consensus type (Proof-of-Work)
- Block reward distribution ratios (89/5/5/1 %)

### 11.5 Decentralization Phases

| Phase | Timeline | Features |
|-------|----------|----------|
| Phase 1 | 2025–2026 | Snapshot voting, off-chain signaling |
| Phase 2 | 2026–2027 | On-chain proposal lifecycle (MainNet) |
| Phase 3 | 2027+ | Full decentralization; optional quadratic-voting R&D (non-consensus layer) |

---

## 12. Revenue System — Multistream Architecture

The ZION V3 revenue system is a **multi-stream economic engine** with three primary channels:

| Stream | Allocation | State |
|--------|-----------|-------|
| **ZION Canonical Mining** | 50 % | On-chain payouts live (fee split 89/5/5/1) |
| **Multi-Algo External** | 25 % | External Pool Proxy operational (revenue-proxy binary) |
| **NCL AI Compute** | 25 % | Telemetry & tracking live; AI gateway integration in progress |

### 12.1 Verified Working Components

- `RevenueCollector` — thread-safe (Arc<RwLock>), idempotent blocks, circuit breaker
- `RevenueJournal` — append-only JSONL, daily rotation, replayable, atomic sync
- `RevenueHealth` — per-source circuit breaker (10 fails / 60s reset)
- `ProfitRouter` — 11 coins, pool preference hierarchy, hysteresis
- `StreamLayers` — consensus-safe telemetry wrappers, 100 work-unit model

### 12.2 External Pool Proxy

`revenue-proxy` binary provides transparent Stratum bridges to external pools (2miners, MoneroOcean, ZPool) with:

- Wallet substitution in `mining.authorize`/`mining.subscribe`/`login`
- Share queue and reconnect loop with exponential backoff
- IP-ban detection and auto-failover
- Multi-coin startup via `ZION_PROXY_COINS` (e.g., `KAS,ETC,ALPH`)
- Per-coin listen ports (base 9000)

### 12.3 On-Chain Fee Payouts

When a ZION block is found, the pool submits a batch UTXO transaction paying:

- 5 % humanitarian tithe
- 5 % Issobella fund
- 1 % pool fee

On failure, fees are restored via `restore_fees()` and retried next round.

### 12.4 Startup Replay

The pool server reconstructs accumulated revenue state from `RevenueJournal` JSONL files on restart, preventing loss of accounting across crashes or deploys.

---

## 13. Mainnet Readiness & Test Coverage

### 13.1 Test Pyramid (2026-05-18)

| Crate | Lib Tests | Integration | Active (dev) | Ignored | Fail |
|---|---|---:|---:|---:|---:|
| `zion-core` (L1) | 488 | — | 475 | 13 slow PoW | 0 |
| `zion-cosmic-harmony` (L1 PoW) | ~100 | — | 100 | 0 | 0 |
| `zion-pool` (L1) | 53 | 29 | 82 | 0 | 0 |
| `zion-miner` (L1) | 59 | — | 59 | 0 | 0 |
| `zion-native-ffi` (no-default) | 13 | — | 13 | 0 | 0 |
| `zion-native-ffi` (native-all, `--test-threads=1`) | 28 | — | 28 | 0 | 0 |
| `zion-bridge` (L2) | 130 | 63 | 193 | 0 | 0 |
| `zion-dao` (L2) | 40 | 25 | 65 | 0 | 0 |
| `zion-atomic-swap` (L2) | 18 | — | 18 | 0 | 0 |
| `zion-warp` (L3) | 251 | — | 251 | 0 | 0 |
| `zion-ncl` (L3) | 42 | 1 doc | 43 | 0 | 0 |
| `zion-ai-native` (L3) | 195 | — | 195 | 2 ignored | 0 |
| `zion-cli` | 21 | — | 21 | 0 | 0 |
| **Total** | | | **~1,470** | **15** | **0** |

### 13.2 Clean Gate (2026-05-18)

- `cargo fmt --all --check` ✅
- `cargo clippy --workspace --all-targets -j1` ✅ (exit 0; warnings only)
- `cargo test --workspace --release -- --test-threads=1` ✅
- `cargo audit` ✅ 0 vulnerabilities

### 13.3 Production Blockers

| Priority | Item | Status |
|----------|------|--------|
| P0 | Credential rotation + history scrub | ✅ Done 2026-05-07 |
| P1 | Deploy new chain (clean datadir, genesis #0) | In progress |
| P1 | Bridge 3/5 validator provisioning | Pending ops |
| P2 | External security audit (Q3 2026) | Planned |
| P2 | CI infrastructure (GitHub Actions billing) | Pending |
| P2 | E2E mainnet stress test (10k+ TX) | Planned |
| P3 | lib.rs monolith refactor | Planned |
| P3 | Prometheus SLO + alert rules | Planned |

### 13.4 Live Infrastructure (2026-05-12)

**Edge node (Hetzner VPS, Core + Edge topology) — ACTIVE:**
- V3 mainnet node (height: 26,910+)
- RPC endpoint: http://100.76.16.108:8443 (Tailscale VPN)
- Prometheus metrics: http://100.76.16.108:9115/metrics
- Next.js website: https://77.42.71.94
- Pool server running (ports 8444 Stratum + 8080 API)
- 12 Docker containers
- Core + Edge mode (2 peers — Core and Edge)

---

## 14. Roadmap

### 14.1 Release History

| Version | Status | Key Deliverables |
|---------|--------|------------------|
| v2.9.5 | Archived | TestNet genesis, Rust L1 stack |
| v2.9.6 | Archived | L2/L3/L4 implementation, Decade Decay, WARP 7-chain |
| v2.9.7 | Archived | Code freeze, 168h stability, API docs |
| v2.9.8 | Done | Ekam Deeksha canonical path, bug fix round 1 |
| v2.9.9 | In progress | Pure code cleanup, migration strategy |
| **v3.0** | **Target Q4 2026** | **MainNet Genesis (Block #0)** |

### 14.2 Key Milestones

| Milestone | Date | Success Criteria |
|-----------|------|------------------|
| 168h stability | Mar 2026 | 0 critical alerts, pool running 7+ days |
| GPU miner alpha | Q2 2026 | CUDA/OpenCL functional |
| Security audit | Q3 2026 | No critical vulnerabilities |
| Mobile wallet | Q3 2026 | iOS + Android App Store |
| **MainNet Genesis** | **Q4 2026** | **Block #0 and genesis reserve activation** |
| wZION mainnet | Q4 2026 | Live on Base/Arbitrum/BSC |
| NCL + WARP live | Q1 2027 | 1,000 NCL tasks/day, WARP swaps active |
| L3 DAO (Phase 2) | 2027 | On-chain voting |
| L4 OASIS XP rollout | 2028 | XP/economy features launched |
| L5 Free World | 2030 | Foundation + research lab |
| 1st Decade Decay | 2036 | Block reward → 4,320 ZION |
| L6 Issobella start | 2040 | Space Division initiated |
| Tail emission | 2126 | 724.784723787776 ZION/block forever |

---

## 15. Legal Disclaimer

ZION is **open-source software** and **experimental technology** released under the MIT license. ZION is **not**:

- A security under MiCA or any other regulatory framework
- An investment product with guaranteed returns
- A licensed financial instrument

Participation in the ZION network is **voluntary** and occurs **at your own risk**. Token value is not guaranteed. Price may decline to zero. The regulatory environment may change.

ZION is a **community-run open-source protocol** and is **not operated by a single company issuer** in this V3 line.

See also:

- `../../docs/legal/DISCLAIMER.md`
- `../../docs/legal/TOKEN_NOT_SECURITY.md`
- `../../docs/legal/RISK_DISCLOSURE.md`

---

## 16. References

| Resource | Description |
|----------|-------------|
| `V3/L1/core/src/emission.rs` | Constitutional emission constants (flowers, decay, tail, fee split) |
| `V3/L1/core/src/genesis.rs` | Genesis validation and reserve integrity |
| `V3/L1/core/src/difficulty.rs` | LWMA difficulty algorithm |
| `V3/L1/cosmic-harmony/src/deeksha.rs` | Ekam Deeksha v2 canonical PoW |
| `V3/L2/dao/src/proposal.rs` | DAO proposal types, quorum, voting windows |
| `docs/mainnet/MAINNET_CONSTITUTION.md` | Mainnet Constitution (frozen SHA-256) |
| `StatusV3.md` | Current operational status and launch blockers |
| `V3/ROADMAP.md` | Implementation phases and gap inventory |
| `REVENUE_IMPLEMENTATION_PLAN.md` | Revenue pipeline delivery tracker |
| `AGENTS.md` | Developer/operator runbook |
| `github.com/Yose144/2.9.6` | Source code (MIT license) |

---

> *"Gate, Gate, Paragate, Parasamgate, Bodhi Svaha"*  
> — Genesis block dedication, 2026

**ZION TerraNova v3.0 — MainNet Genesis**  
**© 2026 ZION Open-Source Contributors. MIT License.**
