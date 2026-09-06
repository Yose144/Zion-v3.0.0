# ZION TerraNova
## Mainnet Whitepaper v3.0

---

**Version:** 3.0 — Mainnet Genesis Ready
**Date:** May 2026
**Status:** V3 mainnet-track implemented and tested; production deployment in progress
**License:** MIT (open source)
**Repository:** `github.com/Yose144/2.9.6`

---

> *"In code we trust. 144 billion ZION. Not one satoshi more."*

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Introduction: Why ZION Exists](#introduction-why-zion-exists)
3. [The Four Structural Flaws](#the-four-structural-flaws)
4. [ZION's Answer: A Six-Layer Architecture](#zions-answer-a-six-layer-architecture)
5. [Consensus: Ekam Deeksha v3.2](#consensus-ekam-deeksha-v2)
6. [Economic Model: Decade Decay](#economic-model-decade-decay)
7. [Tokenomics & Genesis](#tokenomics--genesis)
8. [L2 — wZION Bridge & DeFi](#l2--wzion-bridge--defi)
9. [L3 — Intelligence Layer](#l3--intelligence-layer)
10. [L4–L6: The Long Horizon](#l4l6-the-long-horizon)
11. [Security, Audit & Test Coverage](#security-audit--test-coverage)
12. [DAO Governance](#dao-governance)
13. [Revenue System](#revenue-system)
14. [Live Infrastructure](#live-infrastructure)
15. [Roadmap](#roadmap)
16. [References & Code Provenance](#references--code-provenance)
17. [Legal Disclaimer](#legal-disclaimer)

---

## Executive Summary

ZION TerraNova is a Layer 1 proof-of-work blockchain designed to solve four structural problems that have plagued cryptocurrency since its inception: ASIC-driven centralization, insider pre-allocation, zero protocol-level social impact, and supply-shock volatility.

Built from the ground up in **Rust** with a **Tokio** async runtime, ZION introduces a memory-hard PoW algorithm called **Ekam Deeksha v3.2** that runs efficiently on consumer CPUs and GPUs while resisting ASIC specialization. Its economic model, **Decade Decay**, replaces abrupt four-year halvings with a smooth 20 % reduction every ten years, capped by a perpetual tail emission that guarantees miner incentives for centuries.

Critically, **10 % of every block reward is automatically and immutably allocated to humanitarian and scientific purposes** — 5 % to a global Humanitarian Fund and 5 % to the L5/L6 Issobella Fund for long-term scientific research. This is not a promise in a marketing deck; it is enforced in the consensus code itself.

| Parameter | Value |
|-----------|-------|
| Total supply (hard cap) | 144,000,000,000 ZION |
| Block time | 60 seconds |
| Initial block reward | 5,400.067 ZION |
| Emission | Decade Decay (−20 % / 10 years) + tail emission from ~2126 |
| Tail emission | 724.784723787776 ZION / block (forever) |
| Mining algorithm | Ekam Deeksha v3.2 (256 KiB scratchpad, 6-stage pipeline) |
| Consensus | Proof-of-Work (Nakamoto) |
| Signing | Ed25519 |
| General hashing | BLAKE3 |
| Address format | Bech32 (`zion1…`) |
| Transaction model | UTXO |
| Atomic unit | 1 ZION = 1,000,000 flowers (6 decimals) *(updated to 6-decimal in 3.0.3 fork)* |
| L2 wrapped token | wZION (ERC-20 on Base) |
| Codebase language | Rust |

The entire codebase is open-source under the MIT license, with **approximately 1,470 automated tests** and zero failing builds.

---

## Introduction: Why ZION Exists

Cryptocurrency was born from a beautiful idea: a permissionless, censorship-resistant financial system owned by no one and open to everyone. Yet nearly two decades after Bitcoin's genesis block, the industry has replicated many of the very problems it set out to solve.

Mining — meant to be "one CPU, one vote" — is now dominated by industrial ASIC farms in regions with subsidized electricity. Early investors and venture capital funds capture disproportionate allocations before the public ever hears a project's name. Philanthropy, when it happens at all, is a voluntary afterthought rather than a protocol guarantee. And Bitcoin's four-year halving cycle creates predictable but brutal supply shocks that destabilize miner economics and price discovery.

ZION was created as a direct response. It is not a fork of an existing chain. It is not a token on someone else's network. It is a clean-room implementation of a Layer 1 blockchain built specifically to address these four structural flaws — with every design choice traceable to a specific problem and every economic parameter verifiable in open-source code.

The project draws on a long tradition of open-source infrastructure serving the public good. Like the Linux kernel, the World Wide Web, and the Bitcoin protocol itself, ZION is software infrastructure first and foremost. It does not have a marketing department. It has a test suite.

---

## The Four Structural Flaws

### 1. ASIC Centralization

Bitcoin's SHA-256 and Ethereum's Ethash were both initially mined by CPUs and then GPUs. In both cases, the emergence of application-specific integrated circuits (ASICs) rapidly concentrated hashrate into a handful of industrial operators. Today, four mining pools control the majority of Bitcoin's hashrate. The "decentralization" promised by Satoshi has become, in practice, industrial consolidation.

**ZION's response:** Ekam Deeksha v3.2 is deliberately memory-hard. Its 256 KiB scratchpad requires pseudo-random dependent reads that cannot be efficiently pipelined by fixed-function hardware. An ASIC designed for Ekam Deeksha would look so much like a general-purpose CPU with large cache that it would lose its cost advantage. The algorithm scores 90/100 on independent ASIC-resistance benchmarks.

### 2. Insider Pre-Allocation

Many prominent blockchain projects allocated 15–50 % of total supply to founders, early investors, and venture capital before public launch. This creates structural inequality: insiders sell at prices the public cannot match, and the community begins its participation already disadvantaged.

**ZION's response:** Fair Launch. There was no ICO, no pre-sale, no SAFT, and no advisor token allocation. The only way to acquire ZION is to mine it or receive it in a transaction. The 11.65 % genesis premine is fully transparent, time-locked where appropriate, and its addresses are published before launch.

### 3. Zero Protocol-Level Social Impact

No major blockchain protocol automatically directs a portion of block rewards to humanitarian causes. Philanthropy exists as an optional, self-reported activity by individual holders or foundation grants. There is no mechanism that makes giving a structural, unstoppable feature of the protocol itself.

**ZION's response:** 10 % of every block reward is automatically split by the protocol into four outputs: 89 % to miners, 5 % to the Humanitarian Fund, 5 % to the L5/L6 Issobella Fund, and 1 % to pool infrastructure. This split is hardcoded in `V3/L1/core/src/emission.rs` and cannot be altered by governance vote.

### 4. Supply-Shock Volatility

Bitcoin's four-year halving cycle (−50 % overnight) creates violent supply shocks. Miners who invested in hardware based on one reward suddenly see their revenue cut in half with no gradual adjustment period. This forces boom-bust cycles in mining economics and contributes to price volatility.

**ZION's response:** Decade Decay reduces the block reward by 20 % every 10 years (5,256,000 blocks). This is a gentle, predictable slope rather than a cliff. After 10 decades, the reward settles into a perpetual tail emission of approximately 724.785 ZION per block — ensuring that miners are always incentivized to secure the network, without relying on a "fee-only" security model that collapses when transaction demand is low.

---

## ZION's Answer: A Six-Layer Architecture

ZION is organized as a stack of six layers, each independently functional and each adding value without dependency on the layers above it.

```
┌─────────────────────────────────────────────────────────────┐
│  L6 — ZION Issobella    Orbital research station (2040+)      │
├─────────────────────────────────────────────────────────────┤
│  L5 — ZION Free World   Humanitarian & scientific foundation   │
│                         (target 2030)                        │
├─────────────────────────────────────────────────────────────┤
│  L4 — OASIS             Consciousness gaming + XP economy     │
│                         (UE5 open-world, target 2028)        │
├─────────────────────────────────────────────────────────────┤
│  L3 — Intelligence      NCL AI marketplace + WARP bridge      │
│                         + AI-native agents                    │
├─────────────────────────────────────────────────────────────┤
│  L2 — DeFi Bridge       wZION ERC-20 + Base/Arbitrum/BSC     │
│                         + DAO + atomic swaps                  │
├─────────────────────────────────────────────────────────────┤
│  L1 — Core Chain        Ekam Deeksha v3.2 + UTXO + P2P        │
│                         + Stratum pool + LMDB                │
└─────────────────────────────────────────────────────────────┘
```

**L1** can run without any other layer. A solo miner can download the node binary, connect to the P2P network, and begin mining without ever touching L2–L6. Each higher layer is opt-in.

### L1 — Core Blockchain

- **Runtime:** Rust + Tokio async
- **Database:** LMDB via `heed` (memory-mapped, zero-copy reads)
- **API:** JSON-RPC 2.0 over TCP
- **Mining protocol:** Stratum-style session wire (TCP, line-based)
- **P2P:** TCP gossip protocol with peer discovery, rate limiting, and escalating bans
- **Crypto:** Ed25519 signing, BLAKE3 hashing, Bech32 `zion1…` addresses with 4-character checksum
- **Transactions:** UTXO model with SegWit-style BLAKE3 txids
- **Fees:** 100 % burned (deflationary pressure beyond emission schedule)

### L2 — wZION Bridge & DeFi

- **wZION** is an ERC-20 wrapped token on Base, Arbitrum, and BNB Chain
- **Bridge:** Lock/mint + burn/unlock with 3-of-5 multi-sig validator quorum
- **Smart contracts:** wZION, ZionBridge, ZionStaking, ZionFarm, AtomicSwap, ZionGovernance, ZionTreasury, UniV3Pool
- **DeFi:** Staking (12 % APR), liquidity farming, wZION/USDC on Uniswap V3, HTLC atomic swaps
- **Security:** Fail-closed relayer — if validator quorum is not met, the bridge aborts before any L1 transaction is submitted

### L3 — Intelligence Layer

- **NCL (Neural Compute Layer):** Distributed AI inference marketplace where miners process AI tasks alongside mining
- **WARP:** Cross-chain swap protocol supporting 7 chain families (EVM, Bitcoin, Solana, NEAR, Polkadot, TON, Cosmos IBC)
- **AI-native:** On-chain AI agent framework with Hiran v2.2 — a domain-specific fine-tuned model (Llama-3.1-8B base, QLoRA training on 22K instruction pairs)

### L4–L6 — The Long Horizon

- **L4 (OASIS):** Unreal Engine 5 open-world game linked to the blockchain, with 9 consciousness levels and a 4.95B ZION reward pool distributed over 10 years (3 slots × 1.65B; Slots 4 & 5 repurposed to L5 Free World Projects)
- **L5 (Free World):** Humanitarian and scientific foundation funded by the 5 % block reward allocation, targeting launch in 2030
- **L6 (Issobella):** Long-term vision for a decentralized scientific research station in Low Earth Orbit, funded perpetually by tail emission after 2126

---

## Consensus: Ekam Deeksha v3.2

The proof-of-work algorithm is called **Ekam Deeksha** (Sanskrit: "one initiation"). Version 2 is the mainnet-track algorithm, active from genesis block 0.

### Design Philosophy

Most PoW algorithms fail at ASIC resistance because they rely on a single computational primitive. If that primitive can be implemented in silicon, the algorithm falls. Ekam Deeksha v3.2 uses a **six-stage sequential pipeline** that combines multiple primitives with a memory-hard stage in the middle. An ASIC would need to be efficient at Keccak-256, SHA3-512, matrix multiplication, pseudo-random memory access, neural vector operations, and BLAKE3 — essentially a general-purpose computer, defeating the purpose of specialization.

### The Six Stages

```
Input: block_header + nonce (u64)
  │
  ├─ Stage 1: Keccak-256 .............. 32-byte digest
  ├─ Stage 2: SHA3-512 ................ 64-byte expansion
  ├─ Stage 3: Golden Matrix ........... Matrix multiplication diffusion
  ├─ Stage 4: 256 KiB Scratchpad ...... Memory-hard fill + dependent reads
  ├─ Stage 5: NPU Mixing .............. Neural processing unit vector ops
  └─ Stage 6: Cosmic Fusion ........... BLAKE3 final hash reduction
  │
Output: 32-byte PoW hash
```

**Stage 4 (Scratchpad)** is the ASIC-resistance anchor. The 256 KiB working set fits comfortably in modern CPU L2 cache but requires pseudo-random dependent reads that defeat both pipelining and memory-latency hiding. An ASIC would need to replicate a general-purpose cache hierarchy to compete.

**Stage 5 (NPU Mixing)** auto-detects the fastest available AI backend — Apple CoreML, NVIDIA TensorRT, Intel OpenVINO, or ONNX Runtime — and uses it for native hardware acceleration on consumer devices.

### Difficulty Adjustment

ZION uses **LWMA (Linearly Weighted Moving Average)** with a 60-block window:

- Target block time: **60 seconds**
- Adjustment: **±25 % per block** (integer arithmetic, no floating point)
- Timestamp sanity: **±120 seconds** from median-time-past
- Minimum difficulty: **1,000**

LWMA reacts smoothly to hashrate changes detected only seconds ago, preventing the oscillation and timestamp-gaming attacks that simpler algorithms suffer from.

### Fork Hooks

The code contains hard-fork height constants for future consensus upgrades. In the current production build, Ekam Deeksha v3.2 is active from height 0. A coordinated testnet rehearsal can be enabled via the `testnet_fork_rehearsal` Cargo feature without modifying the default binary.

---

## Economic Model: Decade Decay

### Why Decade Decay?

Bitcoin's halving model reduces the block reward by 50 % every four years. This creates a predictable but violent supply shock. Miners who invested in hardware based on a given reward level see their revenue halved overnight. The resulting hashrate volatility feeds back into price volatility.

ZION replaces this with a **Decade Decay** model: the block reward decreases by 20 % every 10 years. This is a gentle slope rather than a cliff. Miners have a full decade to adjust their economics, and the network avoids the boom-bust cycles that plague four-year halving systems.

### Emission Schedule

| Decade | Years | Block Reward (ZION) | Emission per Decade |
|--------|-------|---------------------|---------------------|
| 1 | 2026–2036 | 5,400.067 | ~28.38 billion |
| 2 | 2036–2046 | 4,320.054 | ~22.71 billion |
| 3 | 2046–2056 | 3,456.043 | ~18.17 billion |
| 4 | 2056–2066 | 2,764.834 | ~14.53 billion |
| 5 | 2066–2076 | 2,211.867 | ~11.63 billion |
| 6 | 2076–2086 | 1,769.494 | ~9.30 billion |
| 7 | 2086–2096 | 1,415.595 | ~7.44 billion |
| 8 | 2096–2106 | 1,132.476 | ~5.95 billion |
| 9 | 2106–2116 | 905.981 | ~4.76 billion |
| 10 | 2116–2126 | 724.785 | ~3.81 billion |
| **Tail** | **2126+** | **724.785** | **Perpetual** |

The total mining emission over 100 years is approximately 126.67 billion ZION. Combined with the 16.78 billion genesis premine, this stays within the 144 billion hard cap.

### Tail Emission

After decade 10 (block height 52,560,001), the block reward stabilizes at **724.784723787776 ZION per block** — forever. This perpetual minimum reward ensures that miners are always incentivized to secure the network, regardless of transaction fee volume. ZION never enters a "fee-only" security model, which has been criticized as unstable in low-demand periods.

### The 89/5/5/1 Split

Every block reward is automatically split by the protocol into four outputs in the coinbase transaction:

| Recipient | Share | Purpose |
|-----------|-------|---------|
| Miners (PPLNS) | 89 % | Network security via pool payouts |
| Humanitarian Fund | 5 % | Global humanitarian projects |
| L5/L6 Issobella Fund | 5 % | Science, space, and long-term research |
| Pool operator | 1 % | Pool infrastructure |

This split is enforced in `V3/L1/core/src/emission.rs` at the protocol level. The DAO cannot vote to change it. Governance can decide which humanitarian projects receive funding, but it cannot reduce the 10 % allocation.

---

## Tokenomics & Genesis

### Total Supply

The hard cap is **144,000,000,000 ZION** — set in genesis and immutable. No governance vote, no hard fork without community consensus, and no hidden inflation mechanism can increase it.

| Category | Amount (ZION) | Share |
|----------|---------------|-------|
| Mining emission (100 years + tail) | ~127,220,000,000 | 88.35% |
| Genesis premine | 16,780,000,000 | 11.65 % |
| **Total** | **144,000,000,000** | **100 %** |

### Genesis Premine Distribution

The genesis block (height 0) contains 14 outputs with a total of 16.78 billion ZION:

| # | Category | Amount (ZION) | Lock |
|---|----------|---------------|------|
| 1–3 | OASIS Golden Egg / XP (3 slots) | 4,950,000,000 | None |
| 4–5 | L5 Free World Projects (repurposed from OASIS) | 3,300,000,000 | None |
| 6 | DAO Treasury (main reserve) | 2,500,000,000 | 525,600 blocks (~1 year) |
| 7 | DAO Grants & Bounties | 1,000,000,000 | 525,600 blocks (~1 year) |
| 8 | DAO Ecosystem Bootstrap | 500,000,000 | 525,600 blocks (~1 year) |
| 9 | Core Development Fund | 1,000,000,000 | None |
| 10 | Network Infrastructure | 1,000,000,000 | None |
| 11 | Genesis Projects Steward | 590,000,000 | None |
| 12 | Humanitarian — Children Future Fund | 1,440,000,000 | None |

The DAO Treasury lock is enforced on-chain in `V3/L1/core/src/validation.rs` Step 11. Any transaction spending DAO Treasury outputs before block 525,600 is rejected by consensus.

### Fee Model

All transaction fees are **burned** (destroyed). They do not go to miners, the DAO, or any treasury. This creates a mild deflationary pressure on top of the emission schedule and aligns miner incentives with network security rather than fee extraction.

The minimum transaction fee is 1,000 flowers (0.001 ZION) with a minimum fee rate of 1 flower per byte.

---

## L2 — wZION Bridge & DeFi

### Wrapped ZION (wZION)

wZION is an ERC-20 token on Base, Arbitrum, and BNB Chain that represents ZION value on EVM chains. The bridge operates on a lock/mint + burn/unlock model:

1. User sends ZION to the L1 bridge vault address
2. Validators (3-of-5 multi-sig) attest to the lock
3. wZION is minted on the EVM chain
4. Reverse: wZION is burned, validators attest, ZION is released on L1

### Bridge Security

- **Validator quorum:** 3-of-5 multi-sig for cross-chain attestations (production target; currently staging with 1/2)
- **Fail-closed relayer:** If the validator quorum is not met, the relayer returns an error before any L1 transaction is submitted. There are no "synthetic" placeholder proofs.
- **Rate limits:** Minimum 100 wZION per bridge, maximum 5,000,000 per single transaction, 10,000,000 daily limit
- **Timelock:** Transfers above 1,000,000 wZION trigger a 24-hour delay
- **Auto-pause:** The bridge automatically pauses on anomaly detection

### DeFi Ecosystem

The L2 DeFi layer provides:

- **Staking:** Stake wZION to earn protocol yield (12 % APR, 7-day cooldown)
- **Liquidity Farming:** Provide wZION/WETH LP tokens and earn rewards
- **DEX Trading:** wZION/USDC via Uniswap V3 concentrated liquidity
- **Atomic Swaps:** Trustless HTLC-based cross-chain swaps between ZION and 7 chain families
- **DAO Governance:** On-chain proposals and voting with wZION

---

## L3 — Intelligence Layer

### Neural Compute Layer (NCL)

NCL transforms ZION's mining infrastructure into a distributed AI compute network. Miners can process AI inference tasks alongside their mining work and earn additional NCL rewards.

**Supported AI backends:**

| Platform | Backend | Notes |
|----------|---------|-------|
| Apple M-series | CoreML | Native Apple Neural Engine |
| NVIDIA GPU | TensorRT | CUDA-optimized |
| Intel CPU/GPU | OpenVINO | CPU/iGPU acceleration |
| Generic | ONNX Runtime | Universal fallback |

Default time allocation: 70 % mining / 30 % NCL, configurable from 50–90 % mining. Mining always has priority.

### WARP — Cross-Chain Swap Protocol

WARP enables atomic swaps between ZION and tokens across 7 chain families:

| Chain Family | Examples |
|---|---|
| EVM | Base, Arbitrum, BSC, Ethereum |
| Cosmos IBC | ATOM, OSMO |
| Bitcoin | BTC, LTC |
| Solana | SOL, SPL tokens |
| NEAR | NEAR |
| Polkadot | DOT |
| TON | TON |

### AI-Native & Hiran v2.2

Hiran v2.2 is a domain-specific fine-tuned model for the ZION ecosystem:

- **Base model:** `unsloth/Meta-Llama-3.1-8B-Instruct`
- **Training:** QLoRA with curriculum learning (5 stages, max rank 64)
- **Dataset:** 22,181 instruction/output pairs
- **Inference:** ~40 tokens/s on RTX 4090 (FP16)
- **Integration:** `zion hiran` CLI commands, Docker service with llama.cpp + CUDA

---

## L4–L6: The Long Horizon

### L4 — OASIS Game World

OASIS is an Unreal Engine 5 open-world game linked to the ZION blockchain. It introduces a "consciousness mining" layer where player engagement and progression are rewarded with real ZION tokens.

- **8 Genesis Territories** with unique economies
- **9 Consciousness Levels** (inspired by Kabbalah Sefira: Malkuth to Keter)
- **4.95 billion ZION reward pool** distributed over 10 years (3 slots × 1.65B; Slots 4 & 5 repurposed to L5 Free World Projects)
- XP is tracked off-chain in SQLite; L1 consensus remains pure PoW

**Consciousness Period (2026–2035):** During the first decade, OASIS adds bonus rewards on top of base mining:

| Level | Multiplier | Total Reward / Block |
|-------|------------|---------------------|
| Physical (L1) | 1.0x | 5,400.07 ZION |
| Mental (L2) | 1.1x | 7,127.67 ZION |
| Conscious (L4) | 1.3x | 7,440.00 ZION |
| Enlightened (L6) | 2.0x | 8,539.33 ZION |
| On The Star (L9) | 10.0x | 21,096.37 ZION |

After 2035 the bonus pool is exhausted and mining proceeds at base reward only.

### L5 — ZION Free World (Target: 2030)

The ZION Free World Foundation is a humanitarian and scientific organization funded directly by the 5 % block reward allocation. Its pillars are:

1. Free energy research — quantum and sustainable energy, open-source hardware
2. Humanitarian missions — clean water, education, healthcare, food security
3. Free communities — energy-independent villages, mesh networks, local ZION economies
4. Education & awareness — open-source educational platforms

### L6 — ZION Issobella (Target: 2040+)

Named from "ISS" + "Issobella," this is the project's long-term vision for a decentralized scientific research station in Low Earth Orbit. All scientific data would be public, governance would be handled via ZION DAO, and funding would come from the perpetual tail emission beginning in 2126.

---

## Security, Audit & Test Coverage

### Internal Audit Results

A comprehensive internal security audit was completed in April–May 2026, identifying and resolving all critical and high-severity findings before mainnet deployment:

| Finding | Severity | Description | Resolution |
|---------|----------|-------------|------------|
| F1 | Critical | UTXO value conservation missing in peer block validation | PR #20 — conservation check added |
| F2 | High | XOR-based "Merkle root" vulnerable to collision | PR #25 — BLAKE3 binary Merkle tree from genesis |
| F3 | Critical | Wallet keys leaked in plaintext JSON | PR #18 — encrypted wallet with PBKDF2 + AES-256-GCM |
| F3b | Critical | Credentials (PAT, API keys, SSH) in git history | `git filter-repo` + rotation (2026-05-07) |
| F4 | Medium | Bridge unlock relied on relayer trust | PR #22 — L1 multisig enforcement (3/5) |
| F5 | Medium | Excessive unwrap/expect density | PR #23 + #24 — structured error handling |
| F6 | Medium | Source archives in repository | Cleanup + history rewrite |
| Relayer | Medium | Synthetic placeholder proofs possible | PR #27 — fail-closed quorum (no synthetic proofs) |
| native-ffi | Medium | Unsafe C boundary without contracts | PR #28 — safety contracts + `try_*` wrappers |

### Test Coverage

The codebase includes approximately **1,470 automated tests** across 13 crates, all passing with zero failures:

| Crate | Tests | Notes |
|-------|-------|-------|
| zion-core | 488 lib | Consensus, validation, mempool, P2P, RPC, wallet |
| zion-cosmic-harmony | ~100 | PoW algorithm, scratchpad, NPU, difficulty |
| zion-pool | 82 (53 + 29) | Share validation, PPLNS, session lifecycle, proxy |
| zion-miner | 59 | CPU/GPU backends, telemetry |
| zion-native-ffi | 13–28 | Algorithm safety contracts |
| zion-bridge | 193 (130 + 63) | Relay, validation, E2E burn-to-unlock |
| zion-dao | 65 (40 + 25) | Proposals, voting, treasury |
| zion-atomic-swap | 18 | HTLC, refund loop |
| zion-warp | 251 | 7-chain adapters |
| zion-ncl | 43 | AI task marketplace |
| zion-ai-native | 195 | Agent framework |
| zion-cli | 21 | Operator commands |

### Clean Gate

- `cargo fmt --all --check` — passing
- `cargo clippy --workspace --all-targets` — passing (exit 0)
- `cargo test --workspace --release -- --test-threads=1` — passing
- `cargo audit` — 0 vulnerabilities

---

## DAO Governance

### DAO Treasury

The DAO Treasury holds 4 billion ZION (24.6 % of the premine), locked until block 525,600 (~1 year after genesis):

| Allocation | ZION | Purpose |
|------------|------|---------|
| Community Governance | 2,500,000,000 | Primary reserve |
| Grants & Bounties | 1,000,000,000 | Developer grants |
| Ecosystem Bootstrap | 500,000,000 | Ecosystem growth |

### Voting

- **1 ZION = 1 vote** (snapshot-weighted)
- **Delegation:** Supported by governance layer
- **Pre-execution lock:** 48 hours between approval and execution

| Proposal Type | Quorum | Duration |
|---------------|--------|----------|
| Parameter | 10 % | 7 days |
| Treasury | 15 % | 7 days |
| Emergency | 20 % | 3 days |
| Pass condition | votes_for > votes_against | — |

### Treasury Spending

Multi-sig protection: **5-of-7 signatures** required for any treasury transaction.

### Immutable Parameters

The DAO **cannot** change the following without a community-wide hard fork:

- Total supply (144 billion ZION)
- Genesis allocation (16.78 billion ZION)
- Block time (60 seconds)
- Mining algorithm (Ekam Deeksha v3.2)
- Consensus type (Proof-of-Work)
- Block reward split (89/5/5/1 %)

### Decentralization Timeline

| Phase | Period | Features |
|-------|--------|----------|
| Phase 1 | 2025–2026 | Snapshot voting, off-chain signaling |
| Phase 2 | 2026–2027 | On-chain proposal lifecycle (mainnet) |
| Phase 3 | 2027+ | Full decentralization; quadratic voting R&D |

---

## Revenue System

The ZION V3 revenue system is a **multi-stream economic engine** designed to generate sustainable funding for the ecosystem through three channels:

### Stream 1: Canonical ZION Mining (50 %)

Miners connected to the ZION pool earn block rewards through the PPLNS (Pay Per Last N Shares) system. The pool operator fee is 1 %, the humanitarian tithe is 5 %, and the Issobella fund receives 5 %. The remaining 89 % is distributed to miners.

### Stream 2: Multi-Algo External (25 %)

The **External Pool Proxy** (`revenue-proxy` binary) provides transparent Stratum bridges to external pools (2miners, MoneroOcean, ZPool). When a miner connects to ZION in "Revenue" or "Auto" mode, the pool can redirect them to the most profitable external pool via the `PoolMessage::ProxyRedirect` protocol message.

Features:
- Wallet substitution in `mining.authorize`/`mining.subscribe`/`login`
- Auto-reconnect with exponential backoff
- IP-ban detection and failover
- Multi-coin startup via `ZION_PROXY_COINS` (e.g., `KAS,ETC,ALPH`)

### Stream 3: NCL AI Compute (25 %)

Miners assigned to the NCL group process AI inference tasks alongside their mining work. Tasks include embeddings, LLM inference, image classification, and model training. Rewards are tracked in the `RevenueCollector` and paid through the pool's PPLNS system.

### Revenue Journal & Startup Replay

All revenue events are written to an append-only JSONL journal with daily rotation. On pool server restart, the journal is automatically replayed to reconstruct accumulated state, preventing data loss across crashes or deployments.

---

## Live Infrastructure

As of May 2026, the following infrastructure is operational:

**Prague Node (91.98.122.165):**
- V3 mainnet node running at height 26,910+
- RPC endpoint: `http://91.98.122.165:8443`
- Prometheus metrics: `http://91.98.122.165:9115/metrics`
- Next.js website with 72 static routes
- Pool server (Stratum port 3333, API port 8080)
- 12 Docker containers running

**Note:** The Prague node is currently operating in isolated mode (single peer) while additional seed nodes are provisioned in the US, Singapore, and Helsinki.

---

## Roadmap

### Completed

| Milestone | Date |
|-----------|------|
| TestNet genesis (v2.9.5) | January 2026 |
| Code freeze & 168h stability test | March 2026 |
| On-chain fee-split enforcement live (block 465) | March 2026 |
| Internal security audit (F1–F6 resolved) | April–May 2026 |
| Genesis consensus from block 0 (TX_HASH_V2 + BODY_ROOT_V2) | May 2026 |
| History scrub & credential rotation | May 2026 |
| Revenue system Phases A–E delivered | May 2026 |
| Hiran v2.2 AI model training & CLI integration | May 2026 |
| DeFi ecosystem + explorer (72 routes) | May 2026 |
| ~1,470 tests passing, 0 failures | May 2026 |

### In Progress

| Milestone | Target |
|-----------|--------|
| GPU miner alpha (CUDA/OpenCL) | Q2 2026 |
| Bridge 3/5 validator provisioning | Q2 2026 |
| CI infrastructure (GitHub Actions) | Q2 2026 |

### Planned

| Milestone | Target |
|-----------|--------|
| External security audit (Trail of Bits / Halborn / OtterSec) | Q3 2026 |
| Bug bounty program | Q3 2026 |
| Mobile wallet (iOS + Android) | Q3 2026 |
| **MainNet Genesis #0** | **Q4 2026** |
| wZION mainnet on Base/Arbitrum/BSC | Q4 2026 |
| NCL + WARP live (1,000 tasks/day) | Q1 2027 |
| L3 DAO Phase 2 (on-chain voting) | 2027 |
| L4 OASIS XP rollout | 2028 |
| L5 ZION Free World Foundation | 2030 |
| 1st Decade Decay | 2036 |
| L6 ZION Issobella Space Division | 2040+ |
| Tail emission begins | 2126 |

---

## References & Code Provenance

| Resource | Path | Description |
|----------|------|-------------|
| Emission constants | `V3/L1/core/src/emission.rs` | Decade Decay, fee split, tail reward |
| Genesis block | `V3/L1/core/src/genesis.rs` | 14 premine outputs, DAO lock, genesis message |
| PoW algorithm | `V3/L1/cosmic-harmony/src/deeksha.rs` | Ekam Deeksha v3.2 canonical pipeline |
| Difficulty | `V3/L1/core/src/difficulty.rs` | LWMA DAA |
| Validation | `V3/L1/core/src/validation.rs` | 11-step block validation |
| Wallet | `V3/L1/core/src/wallet.rs` | UTXO coin selection, batch payouts |
| DAO proposals | `V3/L2/dao/src/proposal.rs` | Quorum, voting windows |
| Constitution | `docs/mainnet/MAINNET_CONSTITUTION.md` | Immutable protocol charter |
| Status | `StatusV3.md` | Current operational state |
| Roadmap | `V3/ROADMAP.md` | Engineering phases & gap inventory |
| Revenue plan | `REVENUE_IMPLEMENTATION_PLAN.md` | Delivery tracker |
| Source repository | `github.com/Yose144/2.9.6` | MIT license |

---

## Legal Disclaimer

ZION TerraNova is **open-source software** and **experimental technology** released under the MIT license. It is **not**:

- A security under MiCA or any other regulatory framework
- An investment product with guaranteed returns
- A licensed financial instrument

Participation in the ZION network is **voluntary** and occurs **at your own risk**. Token value is not guaranteed. Price may decline to zero. The regulatory environment may change.

ZION is a **community-run open-source protocol**. No single company operates the network. All transactions are peer-to-peer.

For additional legal information, see:
- `legal/DISCLAIMER.md`
- `legal/TOKEN_NOT_SECURITY.md`
- `legal/RISK_DISCLOSURE.md`

---

> *"Gate, Gate, Paragate, Parasamgate, Bodhi Svaha"*
>
> — Genesis block dedication, 2026

**ZION TerraNova v3.0 — MainNet Genesis**

**2026 ZION Open-Source Contributors. MIT License.**
