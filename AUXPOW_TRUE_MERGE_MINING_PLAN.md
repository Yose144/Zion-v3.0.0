# ZION True AuxPoW Merge Mining — Comprehensive Analysis & Implementation Plan

> **Datum:** 2026-07-11 (rev2 — ALPH-primary strategy)
> **Status:** PLÁN — dokumentace před implementací
> **Požadavky:** Dual-algo, fork-based (height-gated), multi-parent, ALPH-primary + DeFi integrace
> **Závislost:** Hard fork ZION L1 consensus + pool + miner

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [User Requirements](#2-user-requirements)
3. [Current ZION Architecture — Deep Analysis](#3-current-zion-architecture--deep-analysis)
4. [Historical Context — CH v3 Revenue System (2.5–2.9.5)](#4-historical-context--ch-v3-revenue-system-25295)
5. [True AuxPoW vs Current AuxPow Proxy](#5-true-auxpow-vs-current-auxpow-proxy)
6. [Blake3 Coin Landscape & Algorithm Compatibility](#6-blake3-coin-landscape--algorithm-compatibility)
7. [Parent Chain Strategy — ALPH Primary, DCR Secondary](#7-parent-chain-strategy--alph-primary-dcr-secondary)
8. [DeFi & DEX Integration Roadmap](#8-defi--dex-integration-roadmap)
9. [Recommended Architecture](#9-recommended-architecture)
10. [Block Format & Validation](#10-block-format--validation)
11. [Difficulty Adjustment](#11-difficulty-adjustment)
12. [Pool Merge-Mining Proxy](#12-pool-merge-mining-proxy)
13. [Miner Support](#13-miner-support)
14. [GPU Kernel Analysis](#14-gpu-kernel-analysis)
15. [Revenue System Integration](#15-revenue-system-integration)
16. [Implementation Phases](#16-implementation-phases)
17. [Risk Analysis](#17-risk-analysis)
18. [Test Plan](#18-test-plan)
19. [Files to Change](#19-files-to-change)
20. [Open Questions](#20-open-questions)

---

## 1. Executive Summary

ZION currently uses `deeksha_lite_v1` — a custom memory-hard PoW algorithm (256 KiB scratchpad, Keccak256→SHA3-512→AES-128 pipeline). No external blockchain uses this algorithm, making true merge mining impossible with the current single-algo design.

This document analyzes the codebase and proposes a **dual-algo, height-gated fork, multi-parent** AuxPoW merge mining system with **Alephium (ALPH) as the primary parent chain**:

- **Dual-algo:** ZION accepts both `deeksha_lite` blocks (existing CPU miners) AND `blake3` AuxPoW blocks (merge-mined with ALPH/DCR)
- **Fork-based:** Activation at block height X (no genesis reset — chain history preserved)
- **Multi-parent:** ALPH (primary — DeFi ecosystem, GPU mining, similar scale) + DCR (secondary — ASIC hashrate for chain security)
- **DeFi integration:** ZION token listing on Powfi DEX (ALPH ecosystem), ALPH Bridge cross-chain integration, shared liquidity

**Why ALPH primary (not DCR):**
- ALPH market cap ~$4.7M — similar to ZION (peer-to-peer partnership, not dwarfed by $563M DCR)
- ALPH has a growing DeFi ecosystem (Powfi DEX with CLMM+CPMM, AlphBanX CDP, lending, launchpad)
- ALPH uses sUTXO model + Ralph smart contracts — similar architecture to ZION
- ALPH is GPU-minable (accessible for community, not ASIC-dominated like DCR)
- ALPH has "Aligned Economics" — 100% fee burning, buybacks, staking rewards (same philosophy as ZION)
- ALPH Bridge already connects 3 chains — natural path for ZION cross-chain integration

**Why DCR secondary:**
- DCR has ~5 PH/s hashrate — massive free security for ZION chain
- DCR has DCRDEX (atomic swap DEX) — potential future ZION trading venue
- DCR is ASIC-mined — different miner demographic than ALPH GPU miners

This makes ZION a **dual merge-mined chain** — secured by both ALPH GPU hashrate and DCR ASIC hashrate, with a path to DeFi integration through the ALPH ecosystem.

---

## 2. User Requirements

| Requirement | Detail | Contrast with initial plan |
|-------------|--------|---------------------------|
| **Dual-algo** | NOT Blake3-only replacement. ZION accepts both deeksha_lite AND blake3 AuxPoW blocks | Initial plan recommended Blake3-only (Option A) |
| **Fork-based** | Height-gated activation at block X. NO genesis reset. Chain history preserved | Initial plan recommended genesis reset |
| **Multi-parent** | ALPH (primary) + DCR (secondary). Not locked to single parent chain | Initial plan recommended DCR-only |
| **ALPH primary** | Alephium as primary parent — DeFi ecosystem, similar scale, GPU mining, aligned economics | Initial plan had DCR as primary |
| **DeFi integration** | Path to ZION listing on Powfi DEX, ALPH Bridge, shared liquidity | Not in initial plan |
| **Revenue = ZION only** | No external coin revenue. Merge mining brings FREE chain security, not BTC payouts | Initial plan had BTC payout focus |
| **Documentation first** | Comprehensive analysis BEFORE any implementation | — |

---

## 3. Current ZION Architecture — Deep Analysis

### 3.1 PoW Algorithm Stack

```
V3/L1/cosmic-harmony/src/
├── lib.rs                    — Profile selection, fork heights
├── deeksha.rs                — Ekam Deeksha v2 (mainnet canonical, fork height 0)
├── deeksha_lite.rs           — DeekshaLite v1 (256 KiB scratchpad, CPU reference)
├── deeksha_lite_fire.rs      — DeekshaLite Fire (v1 + thermal loop, GPU-optimized)
├── algorithms_opt.rs         — Keccak256, SHA3-512, Golden Matrix, Cosmic Fusion, difficulty check
├── algorithms_npu.rs         — INT8 MLP NPU mixing step (CHv4), epoch-rotating weights
├── stream_layers.rs          — Revenue-aware telemetry, 6-step pipeline → RevenueSource mapping
├── revenue.rs                — RevenueCollector, RevenueEvent, RevenueSource enum (14 variants)
├── revenue_journal.rs        — Append-only JSONL audit log, crash-safe replay
├── profit_router.rs          — ExternalCoin enum (11 coins), CoinProfile, profit switching
├── ncl_integration.rs        — NCL AI compute layer (25% allocation), consciousness levels
├── sha3_fast.rs              — Optimized SHA3-512
├── scratchpad_ekam.rs        — Memory-hard transform (Ekam variant)
├── hic.rs                    — Hardware integrity check
├── hugepages.rs              — Huge pages support
└── gpu/
    ├── mod.rs                — Module declaration
    ├── opencl_kernel.rs      — OpenCL kernel loader/runner
    └── kernels/
        ├── cosmic_harmony_deeksha.cl  — OpenCL kernel for Ekam Deeksha
        ├── deeksha_lite.cl            — OpenCL kernel for DeekshaLite v1
        ├── deeksha_lite_fire.cl       — OpenCL kernel for DeekshaLite Fire
        ├── deeksha_lite_fire.cu       — CUDA kernel for DeekshaLite Fire
        └── sha3_test.cl               — OpenCL SHA3 test kernel
```

### 3.2 Canonical Hash Dispatch

```rust
// algorithms_opt.rs:172
pub fn cosmic_harmony_with_height(header: &[u8], nonce: u64, block_height: u64) -> Hash32 {
    crate::deeksha::cosmic_harmony_ekam_deeksha_v2(header, nonce, block_height)
}
```

**Key insight:** `cosmic_harmony_with_height()` is the single entry point for consensus validation. It always routes to `cosmic_harmony_ekam_deeksha_v2` (fork height 0 = active from genesis).

### 3.3 Fork Height Precedents

The codebase already has height-gated forks:

```rust
// deeksha.rs
pub const CHV_EKAM_FORK_HEIGHT: u64 = 0;           // v1 active from genesis
pub const CHV_EKAM_V2_FORK_HEIGHT: u64 = 0;        // v2 active from genesis
pub const CHV42_DUAL_SPIN_FORK_HEIGHT: u64 = u64::MAX;  // dormant, not activated

// lib.rs
pub const FIRE_FORK_HEIGHT: u64 = 5000;             // deeksha_lite_fire planned at H=5000

// algorithms_npu.rs
pub const CHV4_NPU_FORK_HEIGHT: u64 = 0;            // NPU mixing active from genesis
pub const NPU_EPOCH_LENGTH: u64 = 2016;             // Weight rotation every 2016 blocks

// TX hash v2 + body root v2 — both active from genesis (height 0)
```

**Conclusion:** Height-gated forks are a well-established pattern. We can add `AUXPOW_FORK_HEIGHT` following the same pattern.

### 3.4 Block Header (80 bytes)

```rust
// V3/L1/core/src/lib.rs
pub const HEADER_SIZE: usize = 80;

pub struct MiningHeader {
    pub version: u32,            // 4 bytes
    pub previous_hash: [u8; 32], // 32 bytes
    pub merkle_root: [u8; 32],   // 32 bytes
    pub timestamp: u64,          // 8 bytes
    pub difficulty_bits: u32,    // 4 bytes
}
// Total: 80 bytes
```

### 3.5 Block Validation Flow

```
V3/L1/core/src/peer_block_validation.rs

1. Checkpoint validation
2. Recompute hash from header + nonce using algorithm
3. Verify hash == block.hash_hex
4. Verify hash meets difficulty target (big-endian comparison)
5. Timestamp sanity check
6. Transaction validation
7. Merkle root verification
```

### 3.6 Pool Share Validation

```
V3/L1/pool/src/lib.rs (ShareSubmission)

1. Look up job by job_id (TTL check — 90s default)
2. Verify header matches job template
3. Recompute hash with algorithm field from submission
4. Check hash meets share target (vardiff two-tier)
5. If hash meets network target → finalize callback → submit to node
```

**Key:** `ShareSubmission` already has an `algorithm` field — the pool can already dispatch different algorithms per share.

### 3.7 Difficulty

```rust
// V3/L1/core/src/difficulty.rs
// LWMA (Linear Weighted Moving Average)
// Target block time: 60 seconds
// Window: 60 blocks
// Min difficulty: 1000
// ±25% clamp per block (anti time-warp)
```

### 3.8 Revenue System (14 RevenueSource variants)

```rust
// revenue.rs:46-74
pub enum RevenueSource {
    Zion,                  // Canonical ZION blocks
    KeccakBonus,           // FREE byproduct of CH pipeline
    Sha3Bonus,             // FREE byproduct of CH pipeline
    ProfitSwitch,          // Dynamic profit switching
    Blake3External,        // DCR, ALPH
    KHeavyHashExternal,    // KAS
    EthashExternal,        // ETC, EVR, MEWC
    KawPowExternal,        // RVN, CLORE
    AutolykosExternal,     // ERG
    RandomXExternal,       // XMR
    ZelHashExternal,       // FLUX
    DeekshaLite,           // DeekshaLite v1 stream
    ThermalBonus,          // DeekshaLite Fire stream
    NclAi,                 // AI compute layer
}
```

**Key:** The revenue system already has `Blake3External` for DCR/ALPH — merge mining revenue can be tracked through this existing source.

### 3.9 External Coin Definitions (profit_router.rs)

```rust
// profit_router.rs:44-69
pub enum ExternalCoin {
    DCR,   // blake3, 2miners
    ALPH,  // blake3, 2miners
    KAS,   // kheavyhash, 2miners
    ERG,   // autolykos, 2miners
    RVN,   // kawpow, 2miners
    ETC,   // ethash, 2miners
    EVR,   // evrprogpow, zpool
    MEWC,  // meowpow, zpool
    FLUX,  // zelhash, woolypooly
    CLORE, // kawpow, 2miners
    XMR,   // randomx, moneroocean
}
```

**Key:** `ExternalCoin::blake3_coins()` returns `[DCR, ALPH]` — these are the merge-mining candidates.

### 3.10 Stream Layers (Revenue-Aware Telemetry)

```
// stream_layers.rs — DeekshaStreamTelemetry

6-step pipeline mapping:
  Step 1 (Keccak256)   → KeccakBonus (FREE ETC byproduct)
  Step 2 (SHA3-512)    → Sha3Bonus (FREE NXS byproduct)
  Step 3 (GoldenMatrix)→ Zion (primary ZION mining)
  Step 4 (MemoryHard)  → DeekshaLite (stream telemetry)
  Step 5 (AES Mix)     → ThermalBonus (Fire variant)
  Step 6 (NPU Mixing)  → NclAi (AI compute layer)

DeekshaStep enum with work_units() weights for proportional revenue splitting.
```

---

## 4. Historical Context — CH v3 Revenue System (2.5–2.9.5)

### 4.1 Original Vision (2.9.3–2.9.5)

The CH v3 revenue architecture was designed as a **50/25/25 model**:

| Stream | Compute | Source | Revenue |
|--------|---------|--------|---------|
| ZION | 50% | CosmicHarmony pipeline (Keccak→SHA3→Matrix→Fusion) | ZION blocks + FREE ETC + FREE NXS |
| Revenue | 25% | GPU: profit-switch (ERG/RVN/KAS/ALPH) / CPU: XMR | BTC payouts from external pools |
| NCL AI | 25% | AI inference tasks (embeddings, LLM, image) | ZION bonus + AI compute credits |

**5 revenue streams from 3 compute costs** — Keccak and SHA3 intermediates are FREE byproducts of the ZION pipeline.

### 4.2 What Was Actually Built (V3 mainnet)

The V3 mainnet implementation diverged from the original vision:

- **ZION mining:** ✅ Fully implemented (deeksha_lite / Ekam Deeksha v2)
- **Revenue proxy (external pool mining):** ⚠️ Implemented as `AuXpow` crate — a Stratum proxy that connects to external pools and mines independently (NOT merge mining)
- **NCL AI:** ✅ Framework exists (`ncl_integration.rs`), but no live AI task dispatch
- **FREE byproduct streams (ETC/NXS):** ❌ Not implemented — the original idea of submitting Keccak/SHA3 intermediates to external pools was abandoned because the intermediate hashes are NOT valid Ethash/SHA3 work for target blockchains

### 4.3 Current AuXpow Crate (Phase 1 — Stratum Proxy)

The `AuXpow` crate (commits `44371aa10` through pending) is a **Stratum proxy** — NOT true merge mining:

```
AuXpow architecture (current):
  Pool server spawns background scheduler
  Scheduler picks most profitable coin (KAS, ERG, RVN, ETC, CLORE, EVR, MEWC)
  Connects to external pool as Stratum client
  Receives mining.notify jobs
  Forwards to connected miners OR mines on server
  Submits shares back to external pool
  Revenue tracked via RevenueCollector

Problem: This is SOLO mining on external pools, NOT merge mining.
         ZION blockchain gets NO benefit from this hashrate.
```

### 4.4 Why "FREE byproduct" Streams Failed

The original CH v3 design proposed submitting Keccak/SHA3 intermediates from the ZION pipeline to ETC/NXS pools. This was abandoned because:

1. **ETC uses Ethash** — not Keccak256. The Keccak256 intermediate from ZION's pipeline is NOT a valid Ethash hash.
2. **Nexus (NXS) uses SHA3-256** — but the SHA3-512 intermediate from ZION's pipeline is NOT in the format Nexus expects.
3. **Pool rejection** — external pools reject shares that don't match their expected PoW algorithm.

**Lesson:** True merge mining requires the SAME PoW algorithm on both chains. "FREE byproduct" streams only work if the intermediate hash happens to be valid for the target chain — which it almost never is.

---

## 5. True AuxPoW vs Current AuxPow Proxy

| Aspect | Current AuXpow (Phase 1) | True AuxPoW (This Plan) |
|--------|--------------------------|--------------------------|
| **What it does** | Mines external coins independently via Stratum proxy | Mines parent chain, ZION accepts the PoW as valid aux block |
| **ZION chain benefit** | None — ZION chain gets no hashrate | ZION chain secured by parent chain hashrate |
| **Algorithm** | External coin's algorithm (kheavyhash, autolykos, etc.) | Must match between parent and aux chain (Blake3) |
| **Block format** | Standard ZION blocks only | Standard + AuxPoW blocks (with parent proof) |
| **Consensus change** | None — pool-side only | Hard fork — consensus accepts AuxPoW blocks |
| **Revenue** | BTC from external pools | ZION blocks (free) + BTC from parent pool |
| **Miner experience** | Miner mines external coin | Miner mines parent coin, ZION block is a free byproduct |

---

## 6. Blake3 Coin Landscape & Algorithm Compatibility

### 6.1 Complete Blake3 Coin Ecosystem

As of July 2026, only 3 active blockchains use Blake3 for PoW:

| Coin | Ticker | Market Cap | Network Hashrate | Mining Hardware | Block Time | DeFi TVL |
|------|--------|-----------|-----------------|----------------|------------|----------|
| **Decred** | DCR | ~$563M | ~5 PH/s | ASIC (Goldshell, Antminer AL) | ~5 min | DCRDEX (atomic swaps) |
| **Alephium** | ALPH | ~$4.7M | ~1 TH/s (est.) | GPU (RTX 4090 ~3 GH/s) | ~128s | $615K (Powfi DEX + others) |
| **Quai Network** | QUAI | ~$15M | GPU (ProgPoW+Blake3) | GPU | ~1.1s | Early (EVM compatible) |

**Aggregated Blake3 hashrate:** ~5.4 PH/s (minerstat estimate)

### 6.2 Why Blake3 Is the Only Merge Mining Option

| Algorithm | Coins | Merge mining viable? | Problem |
|-----------|-------|----------------------|---------|
| kHeavyHash | KAS | ❌ | Only Kaspa uses it — no merge mining partner |
| Autolykos | ERG | ❌ | Only Ergo uses it |
| KawPow | RVN, CLORE | ❌ | Different chains, same algo, but no AuxPoW infrastructure |
| Ethash | ETC | ❌ | ETC doesn't support AuxPoW (unlike Bitcoin) |
| RandomX | XMR | ❌ | Monero doesn't support AuxPoW |
| **Blake3** | **DCR, ALPH, QUAI** | **✅** | **3 active chains, pools, GPU+ASIC mining** |

### 6.3 Alephium (ALPH) — Deep Dive

**Why ALPH is the ideal primary parent for ZION:**

#### Technology
- **sUTXO model:** Stateful Unspent Transaction Output — combines UTXO security with smart contract statefulness. Similar to ZION's account model with memo support.
- **Ralph language:** Purpose-built smart contract language for sUTXO. More secure than Solidity (no reentrancy, no overflow bugs). Audited by Trail of Bits.
- **Sharded L1:** Alephium uses sharding for scalability (unlike DCR which is monolithic)
- **PoLW (Proof-of-Less-Work):** Reduces energy consumption when network security is sufficient — innovative green mining

#### DeFi Ecosystem (live on mainnet)
```
ALPH DeFi TVL: ~$615K (DefiLlama, July 2026)
├── Powfi DEX          $??     CLMM + CPMM (core dApp, audited)
├── AlphBanX           $329K   CDP (collateralized debt position)
├── Nightshade Finance  $95K   DEX
├── Linx App            $81K   Lending
├── Elexium             $68K   DEX
├── AYIN                 $39K   DEX
├── AlphPad              $0    Launchpad
└── Alephium Bridge      —     Cross-chain (3 chains connected)
```

#### Aligned Economics (same philosophy as ZION)
- **100% of transaction fees are BURNED** (deflationary — same as ZION fee burning)
- **Powfi DEX fees → ALPH buybacks & burns + xALPH staker rewards**
- **Staking (xALPH):** Lock ALPH → earn fees from DEX trading volume
- **No intermediary token:** DEX fees go directly to ALPH stakers, not a separate governance token
- **This mirrors ZION's model:** 89% miner / 5% humanitarian / 5% issobella / 1% pool — revenue stays in ecosystem

#### Mining
- **Algorithm:** Blake3
- **GPU mining:** RTX 4090 ~3.1 GH/s, RTX 3080 Ti ~2.6 GH/s, AMD RX 6800 XT ~1.7 GH/s
- **ASICs:** Bitmant Antminer AL1 (15.6 TH/s), Goldshell AL-BOX series — entering market 2026-2027
- **Pools:** 2miners (BTC payout), HeroMiners
- **Block reward:** ~0.143 ALPH per block (decreasing schedule)

#### Bridge Infrastructure
- **Alephium Bridge** already connects 3 chains
- **Cross-chain transfers** are live and tested
- **ZION could become the 4th connected chain** — natural integration path

### 6.4 Decred (DCR) — Deep Dive

**Why DCR is the ideal secondary parent for ZION:**

#### Technology
- **Hybrid PoW/PoS:** 60% PoW / 30% PoS / 10% treasury — unique consensus
- **DCP-0011:** Switched to Blake3 in October 2022
- **BLAKE-256 (14 rounds):** Used for block hash (legacy), Blake3 for PoW
- **UTXO model:** Bitcoin-like with privacy features (CoinShuffle++)

#### DeFi / DEX
- **DCRDEX:** Decentralized exchange using atomic swaps — no trading fees, non-custodial
- **Bison Wallet:** Multi-wallet with built-in DEX trading
- **Atomic swaps:** Support BTC, LTC, BCH, ZEC and others
- **No token:** DCRDEX has no intermediary token — pure peer-to-peer trading
- **ZION could be listed on DCRDEX** via atomic swap integration

#### Mining
- **Algorithm:** Blake3 (since DCP-0011)
- **ASIC mining:** Goldshell AL series, Antminer AL1 — high hashrate
- **Network hashrate:** ~5 PH/s — **massive security for ZION if merge-mined**
- **Pools:** 2miners (BTC payout), suprnova, HeroMiners
- **Block time:** ~5 minutes
- **DCR nonce:** 4 bytes (uint32) — different from ZION's 8-byte nonce

#### Governance
- **Politeia:** On-chain governance system
- **Treasury:** Self-funding from block rewards (10%)
- **DCP-0013 (Jan 2026):** Treasury spending cap approved (99.98% support)
- **Mature governance:** Could provide model for ZION DAO evolution

### 6.5 Quai Network (QUAI) — Tertiary Option

**Why QUAI is interesting but not priority:**
- **Nativa merge mining:** Quai's 13-chain hierarchy IS merge mining (Prime → Region → Zone)
- **EVM compatible:** ZION already has EVM bridge (Base Mainnet) — natural fit
- **50,000 TPS target:** High throughput
- **Blake3 + ProgPoW:** GPU-friendly, ASIC-resistant
- **BUT:** Newer, less proven, smaller DeFi ecosystem, complex architecture

**Recommendation:** Monitor QUAI for future integration. Focus on ALPH + DCR first.

### 6.6 Current ZION Pool Hashrate (Live Data, July 2026)

```
ZION Pool Metrics (live):
  Active miners:     20 sessions (15 in PPLNS)
  Total hashrate:    ~1.17 MH/s (1,166,024 H/s)
  Algorithm:         deeksha_lite_v1 (100% ZION)
  Blocks found:      33
  Block height:      ~2521
  Accept rate:       99.88%
  Hardware:          All CPU (AMD 7950X, 9950X Threadripper/Ryzen)

Top miners:
  worker-03          141 KH/s   (3 blocks)
  rig7950x-05        112 KH/s   (4 blocks)
  Rig-Grimes         112 KH/s   (2 blocks)
  Rig-Dangerous      105 KH/s   (2 blocks)
  9950X-14           105 KH/s   (2 blocks)
  Rig-Cantoney       102 KH/s   (1 block)
  7950X-01/27/16     ~68 KH/s   (0-4 blocks each)
  9950X-03/13        ~65 KH/s   (0-3 blocks each)
  worker-04           47 KH/s   (4 blocks)
  Acidminer5060       28 KH/s   (0 blocks)
  local-miner         16 KH/s   (2 blocks)
```

**Key insight:** ZION's 1.17 MH/s is adequate for chain security at current difficulty, but merge mining with ALPH (~1 TH/s) and DCR (~5 PH/s) would increase effective security by **~4,000,000×** — even if only 0.01% of parent hashrate includes ZION commitment.

### 6.7 DeekshaLite — ZION's Native Algorithm (preserved)

- **Memory-hard:** 256 KiB scratchpad, 2 passes, 64 random reads
- **Pipeline:** Keccak256 → SHA3-512 → AES-128 CTR mix → Keccak256
- **ASIC-resistant:** Memory-hardness prevents ASIC optimization
- **GPU kernels:** OpenCL (`deeksha_lite.cl`), CUDA (`deeksha_lite_fire.cu`)
- **Fire variant:** Adds thermal loop (16384 iters, 8 ulong chains) for GPU heat
- **KAT vectors:** Known-answer tests lock the exact output (CPU↔GPU must match)
- **Status:** Preserved in dual-algo design — existing CPU miners continue unaffected

---

## 7. Parent Chain Strategy — ALPH Primary, DCR Secondary

### 7.1 Strategy Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│              ZION MULTI-PARENT MERGE MINING STRATEGY                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  PRIMARY PARENT: Alephium (ALPH)                                     │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • Blake3 PoW — same algorithm, GPU mining                  │     │
│  │  • Market cap ~$4.7M — peer-to-peer with ZION              │     │
│  │  • DeFi ecosystem: Powfi DEX, AlphBanX, lending, bridge    │     │
│  │  • sUTXO + Ralph smart contracts — similar to ZION         │     │
│  │  • Aligned economics: fee burning, buybacks, staking       │     │
│  │  • GPU mining — accessible for community                   │     │
│  │  • Alephium Bridge → ZION cross-chain integration path     │     │
│  │                                                             │     │
│  │  → ZION AuxPoW blocks from ALPH hashrate (FREE security)   │     │
│  │  → ZION token listing on Powfi DEX (future)                │     │
│  │  → ALPH Bridge integration (future)                        │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  SECONDARY PARENT: Decred (DCR)                                      │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • Blake3 PoW (DCP-0011) — ASIC mining                     │     │
│  │  • Network hashrate ~5 PH/s — massive free security        │     │
│  │  • DCRDEX — atomic swap DEX (future ZION listing)          │     │
│  │  • Mature governance (Politeia) — model for ZION DAO       │     │
│  │  • ASIC miner demographic — different from ALPH GPU miners │     │
│  │                                                             │     │
│  │  → ZION AuxPoW blocks from DCR hashrate (FREE security)    │     │
│  │  → DCRDEX atomic swap listing (future)                     │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  TERTIARY (future): Quai Network (QUAI)                              │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • Blake3 + ProgPoW — EVM compatible                       │     │
│  │  • Native merge mining (13-chain hierarchy)                │     │
│  │  • Monitor for future integration                          │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 Why ALPH Primary (not DCR)

| Factor | ALPH | DCR | Winner |
|--------|------|-----|--------|
| **Market cap** | ~$4.7M | ~$563M | **ALPH** (peer scale, not dwarfed) |
| **DeFi ecosystem** | Powfi DEX, CDP, lending, launchpad, bridge | DCRDEX (atomic swaps) | **ALPH** (richer DeFi) |
| **Smart contracts** | Ralph (sUTXO, audited) | Bitcoin-like (limited) | **ALPH** (more capable) |
| **Mining hardware** | GPU (RTX 4090, RX 6800 XT) | ASIC (Goldshell, Antminer) | **ALPH** (community-accessible) |
| **Hashrate** | ~1 TH/s | ~5 PH/s | DCR (more security) |
| **Fee model** | 100% burn + buybacks + staking | Treasury (10% of rewards) | **ALPH** (aligned with ZION) |
| **Bridge** | 3 chains connected | Atomic swaps | **ALPH** (bridge infrastructure) |
| **Block time** | ~128s | ~300s | **ALPH** (closer to ZION's 60s) |
| **Governance** | DAO framework (planned) | Politeia (mature) | DCR (more mature) |
| **Philosophy** | Aligned economics, deflationary | Hybrid PoW/PoS, treasury | **ALPH** (same as ZION) |

**Decision:** ALPH primary for DeFi integration + community alignment. DCR secondary for raw hashrate security.

### 7.3 Dual-Algo Design (unchanged from rev1)

```
Pre-fork (height < AUXPOW_FORK_HEIGHT):
  - Only deeksha_lite blocks accepted
  - Existing CPU miners continue normally

Post-fork (height >= AUXPOW_FORK_HEIGHT):
  - deeksha_lite blocks: ACCEPTED (existing CPU miners continue)
  - blake3 AuxPoW blocks: ACCEPTED (merge-mined with ALPH or DCR)
  - Both block types compete on the same chain
  - Separate difficulty LWMA for each algorithm
```

### 7.4 Multi-Parent Support

```rust
pub enum ParentChain {
    Alephium,   // ALPH — primary (DeFi ecosystem, GPU mining)
    Decred,     // DCR — secondary (ASIC hashrate, DCRDEX)
    // Future: Quai, other Blake3 chains
}
```

**How multi-parent works:**
1. Pool connects to ALPH pool AND DCR pool simultaneously
2. Pool receives templates from both parent chains
3. Pool picks the best parent based on:
   - Profitability (which parent coin is more valuable?)
   - Block timing (which parent will produce a block sooner?)
   - ZION aux difficulty (which parent's target is closer to ZION's aux target?)
4. Pool inserts ZION commitment into chosen parent's coinbase
5. Miner hashes parent block header (Blake3 — same for both ALPH and DCR)
6. If hash meets ZION aux target → AuxPoW block on ZION
7. If hash meets parent target → block on parent chain too

**Key:** The miner always hashes Blake3 regardless of which parent chain is used. The pool handles the parent selection and commitment insertion. The miner doesn't even need to know which parent chain they're mining for.

### 7.5 Difficulty Balancing for Dual-Algo

**Separate LWMA per algorithm (Recommended):**
- Track deeksha_lite difficulty and blake3_auxpow difficulty independently
- Each algorithm has its own 60-block window
- Block time target: 60s combined (30s average per algorithm)
- This is the approach used by Decred (separate PoW/PoS difficulty)

### 7.6 Revenue Model — ZION Only

**Critical principle:** Revenue system is for ZION only. Merge mining brings FREE chain security, not external revenue.

```
Merge mining revenue flow:
  ALPH/DCR miner hashes Blake3
    → if meets parent target: parent block (miner keeps ALPH/DCP reward)
    → if meets ZION aux target: ZION AuxPoW block (ZION block reward)
    → if meets both: BOTH blocks (miner gets ALPH/DCR + ZION block reward)

ZION block reward split (same as standard blocks):
  89% → miner (who found the AuxPoW block)
  5%  → humanitarian fund
  5%  → issobella fund
  1%  → pool fee

NO external BTC revenue. NO hashrate splitting. NO AuXpow proxy.
The existing AuXpow Stratum proxy can be deprecated or kept for non-Blake3 coins.
```

---

## 8. DeFi & DEX Integration Roadmap

### 8.1 Vision — ZION in the ALPH Ecosystem

```
┌──────────────────────────────────────────────────────────────────────┐
│           ZION ↔ ALPH DeFi INTEGRATION ROADMAP                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Phase A: Merge Mining (this plan)                                   │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • ZION AuxPoW blocks secured by ALPH hashrate              │     │
│  │  • Pool connects to ALPH pool, inserts ZION commitment      │     │
│  │  • ALPH GPU miners produce ZION blocks as free byproduct    │     │
│  │  • No DeFi integration yet — just chain security            │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                              ↓                                       │
│  Phase B: ALPH Bridge Integration                                    │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • Integrate ZION into Alephium Bridge (4th chain)          │     │
│  │  • Cross-chain transfers: ALPH ↔ ZION                        │     │
│  │  • Wrapped ZION (wZION) on ALPH chain                        │     │
│  │  • Wrapped ALPH (wALPH) on ZION chain                        │     │
│  │  • Requires: ZION Bridge contract on ALPH (Ralph)           │     │
│  │            + ALPH Bridge contract on ZION (existing EVM)    │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                              ↓                                       │
│  Phase C: Powfi DEX Listing                                          │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • wZION/ALPH liquidity pool on Powfi DEX                   │     │
│  │  • ZION token tradeable on ALPH's main DEX                  │     │
│  │  • Powfi DEX fees from ZION trading → ALPH buybacks/burns   │     │
│  │  • ZION liquidity providers earn trading fees                │     │
│  │  • Requires: wZION Ralph contract on ALPH                   │     │
│  │            + initial liquidity provision (ZION treasury)    │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                              ↓                                       │
│  Phase D: Cross-Chain DeFi                                           │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • wZION as collateral on AlphBanX (CDP)                    │     │
│  │  • wZION lending/borrowing on Linx App                       │     │
│  │  • wZION/ALPH yield farming strategies                       │     │
│  │  • xALPH stakers earn fees from ZION trading volume          │     │
│  │  • Shared liquidity between ZION and ALPH ecosystems         │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                              ↓                                       │
│  Phase E: DCRDEX Atomic Swaps                                        │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  • ZION listed on DCRDEX (Decred's atomic swap DEX)         │     │
│  │  • Trustless ZION ↔ DCR ↔ BTC ↔ LTC trading                 │     │
│  │  • No intermediary token, no custody, no trading fees        │     │
│  │  • Requires: ZION atomic swap protocol implementation       │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 Phase A — Merge Mining (Immediate)

**This is what we're implementing now.** No DeFi integration yet — just chain security.

- ZION AuxPoW blocks secured by ALPH (and DCR) hashrate
- Pool handles merge mining proxy
- ZION chain grows from both deeksha_lite and Blake3 AuxPoW blocks
- **No ALPH DeFi integration required** — just Stratum pool connection

### 8.3 Phase B — ALPH Bridge Integration (Future, post-merge-mining)

**Goal:** Cross-chain transfers between ZION and ALPH.

**What's needed:**
1. **ZION Bridge contract on ALPH** (written in Ralph) — holds wZION on ALPH chain
2. **ALPH Bridge contract on ZION** (written in Solidity, deployed on ZION's EVM layer or Base) — holds wALPH on ZION chain
3. **Validator set** — monitors both chains, signs cross-chain transfers
4. **Initial liquidity** — ZION treasury funds bridge with initial wZION supply

**Existing ZION infrastructure:**
- ZION already has a bridge on Base Mainnet (`ZIONBridge` contract, 5 validators, threshold 5/5)
- Same architecture can be extended to ALPH bridge
- ZION already has `wZION` (wrapped ZION) on Base — same concept for ALPH

**ALPH Bridge infrastructure:**
- Alephium Bridge already connects 3 chains (BTC, ETH, BSC presumably)
- Adding ZION as 4th chain is a natural extension
- ALPH bridge uses atomic swap / lock-mint pattern

### 8.4 Phase C — Powfi DEX Listing (Future)

**Goal:** ZION token tradeable on ALPH's main DEX (Powfi).

**What's needed:**
1. **wZION Ralph contract** — wrapped ZION token on ALPH chain (similar to ERC20 but in Ralph language)
2. **Liquidity pool** — wZION/ALPH pair on Powfi DEX (CLMM or CPMM)
3. **Initial liquidity** — ZION treasury + ALPH partner provide initial LP
4. **Price discovery** — market determines ZION/ALPH exchange rate

**Benefits:**
- ZION becomes tradeable without a centralized exchange
- Powfi DEX fees from ZION trading → ALPH buybacks & burns (aligned economics)
- ZION liquidity providers earn trading fees
- Price oracle: Powfi DEX price can feed into ZION's revenue system

**Powfi DEX specs:**
- CLMM (Concentrated Liquidity Market Maker) — like Uniswap V3
- CPMM (Constant Product Market Maker) — like Uniswap V2
- 100% of swap fees → xALPH stakers + ALPH buybacks/burns
- Audited by Trail of Bits (internal + external)
- Built in Ralph (ALPH's smart contract language)

### 8.5 Phase D — Cross-Chain DeFi (Future)

**Goal:** wZION used in ALPH's broader DeFi ecosystem.

| Protocol | Type | ZION Integration |
|----------|------|-----------------|
| **AlphBanX** | CDP (collateralized debt) | wZION as collateral → borrow ALPH |
| **Linx App** | Lending | wZION lending/borrowing market |
| **Nightshade / Elexium / AYIN** | DEX | Additional wZION trading pairs |
| **AlphPad** | Launchpad | ZION projects launch on ALPH |
| **xALPH staking** | Fee sharing | xALPH stakers earn from ZION trading volume |

**Result:** ZION token has utility beyond mining — it becomes a DeFi asset in the ALPH ecosystem. This drives demand for ZION, benefiting all ZION holders and miners.

### 8.6 Phase E — DCRDEX Atomic Swaps (Future)

**Goal:** Trustless ZION trading on DCRDEX (Decred's DEX).

**What's needed:**
1. **ZION atomic swap protocol** — implement HTLC (Hash Time-Locked Contracts) on ZION chain
2. **DCRDEX market integration** — list ZION as tradeable asset
3. **Bison Wallet integration** — ZION wallet support in Bison Wallet

**Benefits:**
- Trustless trading: ZION ↔ DCR ↔ BTC ↔ LTC ↔ BCH (all DCRDEX-listed assets)
- No trading fees (DCRDEX is feeless)
- Non-custodial (coins never leave your wallet)
- No intermediary token

**Note:** ZION already has atomic swap escrow on Base Mainnet (`ZIONAtomicSwap` contract, 100K ZION funded). The same concept can be implemented on ZION L1 for DCRDEX integration.

### 8.7 Revenue Synergy

```
ZION ↔ ALPH revenue synergy:

1. Merge mining (Phase A):
   ZION chain security ← ALPH/DCR hashrate (FREE)

2. Bridge (Phase B):
   Cross-chain transfers → bridge fees → ZION treasury

3. Powfi DEX (Phase C):
   wZION/ALPH trading → DEX fees → ALPH buybacks/burns
   (ALPH stakers benefit from ZION trading volume)

4. Cross-chain DeFi (Phase D):
   wZION as collateral → CDP fees → AlphBanX protocol
   wZION lending → interest → Linx App lenders

5. DCRDEX (Phase E):
   ZION atomic swaps → no fees, but increases ZION liquidity

Net result:
  ZION gets: chain security + token utility + liquidity + price discovery
  ALPH gets: DEX fees from ZION trading + bridge volume + ecosystem growth
  Both get:  stronger ecosystem, shared community, aligned incentives
```

### 8.8 Why This Matters for ZION Liquidity

**Current ZION liquidity:** Limited to Base Mainnet DEX (ZIONStaking, ZIONFarm) and atomic swap escrow.

**With ALPH DeFi integration:**
- ZION tradeable on Powfi DEX (ALPH's main DEX) — new market
- wZION as collateral on AlphBanX — borrowing against ZION
- Cross-chain bridge ALPH ↔ ZION — fluid capital movement
- DCRDEX atomic swaps — trustless trading with BTC, LTC, etc.

**This creates multiple liquidity venues for ZION without relying on centralized exchanges.**

---

## 9. Recommended Architecture

### 9.1 High-Level Design

```
┌──────────────────────────────────────────────────────────────────────┐
│                    ZION DUAL-ALGO MERGE MINING                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  PRE-FORK (height < AUXPOW_FORK_HEIGHT):                             │
│  ┌─────────────────────┐                                              │
│  │  deeksha_lite PoW   │ → ZION blocks (existing miners)             │
│  └─────────────────────┘                                              │
│                                                                       │
│  POST-FORK (height >= AUXPOW_FORK_HEIGHT):                           │
│                                                                       │
│  ┌─────────────────────┐    ┌──────────────────────────────────────┐ │
│  │  deeksha_lite PoW   │    │  Blake3 AuxPoW                       │ │
│  │  (standard blocks)  │    │                                      │ │
│  │                     │    │  Parent: ALPH (primary) or DCR (sec) │ │
│  │  Existing miners    │    │  Pool inserts ZION commitment        │ │
│  │  continue normally  │    │  into parent coinbase TX             │ │
│  │                     │    │                                      │ │
│  │  Difficulty: LWMA-1 │    │  Miner hashes parent header (Blake3) │ │
│  │  (deeksha_lite)     │    │  → if meets aux target: ZION block   │ │
│  └─────────────────────┘    │  → if meets parent target: parent    │ │
│                             │    block too (bonus!)                 │ │
│                             │                                       │ │
│                             │  Difficulty: LWMA-2 (blake3_auxpow)  │ │
│                             └───────────────────────────────────────┘ │
│                                       │                               │
│                                       ▼                               │
│                             ┌─────────────────────┐                   │
│                             │  ZION Chain          │                   │
│                             │  (accepts both       │                   │
│                             │   block types)       │                   │
│                             └─────────────────────┘                   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.2 Fork Activation

```rust
// New constant in cosmic-harmony/src/lib.rs or core/src/lib.rs
pub const AUXPOW_FORK_HEIGHT: u64 = <TBD>;  // e.g., current_height + 1000

pub fn auxpow_active(height: u64) -> bool {
    height >= AUXPOW_FORK_HEIGHT
}
```

**Pre-fork behavior:** Only deeksha_lite blocks accepted (existing behavior unchanged).

**Post-fork behavior:**
- `deeksha_lite` blocks: Accepted if they meet deeksha_lite difficulty
- `blake3` AuxPoW blocks: Accepted if they meet blake3_auxpow difficulty AND pass AuxPoW proof validation

### 9.3 Block Type Detection

```rust
pub enum BlockType {
    /// Standard deeksha_lite block — hash computed from ZION header
    Standard,
    /// AuxPoW block — PoW proven on parent chain (Blake3)
    AuxPow { parent_chain: ParentChain },
}

impl BlockType {
    pub fn from_block(block: &AcceptedBlock) -> Self {
        if block.auxpow_proof.is_some() {
            BlockType::AuxPow { parent_chain: block.auxpow_proof.as_ref().unwrap().parent_chain }
        } else {
            BlockType::Standard
        }
    }
}
```

---

## 10. Block Format & Validation

### 10.1 Standard Block (unchanged)

```rust
// Existing — no changes
pub struct AcceptedBlock {
    pub header: MiningHeader,      // 80 bytes
    pub nonce: u64,
    pub transactions: Vec<Transaction>,
    pub hash_hex: String,          // deeksha_lite hash
    pub auxpow_proof: None,        // Standard blocks have no AuxPoW proof
}
```

### 10.2 AuxPoW Block (new)

```rust
pub struct AcceptedBlock {
    pub header: MiningHeader,      // 80 bytes — standard ZION header
    pub nonce: u64,                // Not used for AuxPoW (parent nonce is used)
    pub transactions: Vec<Transaction>,
    pub hash_hex: String,          // ZION block hash (for merkle/previous_hash linking)
    pub auxpow_proof: Option<AuxPowProof>,  // Present for AuxPoW blocks
}

pub struct AuxPowProof {
    /// Which parent chain was used for this proof
    pub parent_chain: ParentChain,
    /// Parent chain coinbase transaction (contains ZION block hash commitment)
    pub parent_coinbase_tx: Vec<u8>,
    /// Merkle branch: coinbase TX → parent block merkle root
    pub parent_merkle_branch: Vec<[u8; 32]>,
    /// Parent block header (raw bytes — DCR header is ~180 bytes, ALPH varies)
    pub parent_header: Vec<u8>,
    /// Parent block nonce (the nonce that solved the parent PoW)
    pub parent_nonce: u64,
    /// ZION chain merkle branch (for multi-chain merge mining support)
    pub chain_merkle_branch: Vec<[u8; 32]>,
    /// Index of ZION in the aux chain list (0 for single-chain)
    pub chain_index: u32,
}

pub enum ParentChain {
    Decred,
    Alephium,
}
```

### 10.3 Coinbase Commitment Format

Following the Namecoin/Bitcoin AuxPoW standard:

```
Parent coinbase scriptSig contains:
  [magic bytes: 0xfa 0xbe 'm' 'm']    — 4 bytes (merge mining magic)
  [ZION block hash: 32 bytes]          — hash of ZION aux block header
  [aux merkle size: 4 bytes LE]        — number of leaves in aux merkle tree
  [merkle nonce: 4 bytes LE]           — nonce for aux merkle tree computation

Total: 44 bytes inserted into parent coinbase
```

### 10.4 AuxPoW Validation

```rust
fn validate_auxpow_block(
    block: &AcceptedBlock,
    aux_target: &DifficultyTarget,
    height: u64,
) -> Result<()> {
    // 0. Check fork is active
    if !auxpow_active(height) {
        return Err("AuxPoW not active at this height");
    }

    let proof = block.auxpow_proof.as_ref()
        .ok_or("block claims AuxPoW but has no proof")?;

    // 1. Compute parent block hash (Blake3)
    let parent_hash = blake3_pow(&proof.parent_header, proof.parent_nonce);

    // 2. Verify parent PoW meets ZION aux target (NOT parent target)
    if !meets_difficulty(&parent_hash, aux_target.as_bytes()) {
        return Err("parent PoW does not meet ZION aux target");
    }

    // 3. Verify parent coinbase contains ZION block hash commitment
    let zion_block_hash = block.header.hash();  // standard ZION header hash
    let aux_merkle_root = compute_aux_merkle_root(
        &zion_block_hash,
        &proof.chain_merkle_branch,
        proof.chain_index,
    );
    if !coinbase_contains_commitment(&proof.parent_coinbase_tx, &aux_merkle_root) {
        return Err("parent coinbase missing ZION commitment");
    }

    // 4. Verify parent coinbase TX is in parent block merkle tree
    let coinbase_tx_hash = blake256(&proof.parent_coinbase_tx);
    let computed_merkle_root = compute_merkle_root(
        &coinbase_tx_hash,
        &proof.parent_merkle_branch,
    );
    let parent_header_merkle_root = extract_merkle_root(&proof.parent_header, proof.parent_chain);
    if computed_merkle_root != parent_header_merkle_root {
        return Err("parent merkle branch invalid");
    }

    // 5. Standard ZION validation (transactions, merkle root, difficulty, etc.)
    validate_zion_transactions(&block.header, &block.transactions)?;
    validate_zion_merkle_root(&block.header, &block.transactions)?;

    // 6. Verify ZION header difficulty_bits matches blake3_auxpow difficulty
    let expected_bits = blake3_auxpow_difficulty_bits(height);
    if block.header.difficulty_bits != expected_bits {
        return Err("AuxPoW block difficulty_bits mismatch");
    }

    Ok(())
}
```

### 10.5 Validation Dispatch

```rust
// peer_block_validation.rs (modified)
fn validate_peer_block(block: &AcceptedBlock, height: u64) -> Result<()> {
    // ... existing checkpoint validation ...

    if auxpow_active(height) && block.auxpow_proof.is_some() {
        // AuxPoW block — validate with blake3_auxpow difficulty
        let aux_target = blake3_auxpow_target(height);
        validate_auxpow_block(block, &aux_target, height)?;
    } else {
        // Standard block — validate with deeksha_lite (existing behavior)
        let hash = cosmic_harmony_with_height(&block.header.to_bytes(), block.nonce, height);
        if !meets_difficulty(&hash.data, &target) {
            return Err("PoW does not meet target");
        }
    }

    // ... rest of validation (timestamp, transactions, etc.) ...
    Ok(())
}
```

---

## 11. Difficulty Adjustment

### 11.1 Dual Difficulty Tracking

```rust
// difficulty.rs (modified)

pub struct DualDifficultyState {
    /// deeksha_lite difficulty (for standard blocks)
    pub standard: DifficultyState,
    /// blake3 AuxPoW difficulty (for AuxPoW blocks)
    pub auxpow: DifficultyState,
}

impl DualDifficultyState {
    pub fn next_target(&self, block_type: BlockType, height: u64) -> DifficultyTarget {
        match block_type {
            BlockType::Standard => self.standard.next_target(height),
            BlockType::AuxPow { .. } => self.auxpow.next_target(height),
        }
    }

    pub fn record_block(&mut self, block_type: BlockType, timestamp: u64, height: u64) {
        match block_type {
            BlockType::Standard => self.standard.record_block(timestamp, height),
            BlockType::AuxPow { .. } => self.auxpow.record_block(timestamp, height),
        }
    }
}
```

### 11.2 Difficulty Parameters

| Parameter | Standard (deeksha_lite) | AuxPoW (blake3) |
|-----------|------------------------|------------------|
| Target block time | 120s (every other block) | 120s (every other block) |
| Combined target | 60s average | 60s average |
| Window | 60 blocks | 60 blocks |
| Min difficulty | 1,000 | 1 (Blake3 is fast — lower difficulty) |
| Algorithm | LWMA | LWMA |

**Rationale:** With dual-algo, each algorithm is expected to produce ~50% of blocks. Setting each algorithm's target to 120s gives a combined 60s average. The LWMA adjusts independently based on actual block times for each algorithm.

### 11.3 Difficulty Storage

The chain state must store two difficulty trackers. This requires a database schema change:

```
chain_state:
  height: u64
  standard_difficulty: DifficultyState  // existing field
  auxpow_difficulty: DifficultyState    // NEW field
  auxpow_fork_height: u64               // NEW field
```

---

## 12. Pool Merge-Mining Proxy

### 12.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ZION POOL (Merge Mining Proxy)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ ZION Node    │    │ ALPH Pool    │    │ DCR Pool     │          │
│  │ RPC          │    │ (2miners)    │    │ (2miners)    │          │
│  │ 127.0.0.1:   │    │ Stratum v1   │    │ Stratum v1   │          │
│  │ 8443         │    │ (primary)    │    │ (secondary)  │          │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘          │
│         │                   │                   │                   │
│         │ getauxblock       │ mining.notify     │ mining.notify     │
│         │ (ZION template)   │ (ALPH template)   │ (DCR template)    │
│         ▼                   ▼                   ▼                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              MERGE MINING ORCHESTRATOR                       │  │
│  │                                                              │  │
│  │  1. Get ZION aux template (getauxblock RPC)                 │  │
│  │  2. Get parent template (ALPH or DCR, profit-switch)        │  │
│  │  3. Insert ZION block hash into parent coinbase script      │  │
│  │  4. Build composite job: parent header + ZION commitment    │  │
│  │  5. Send composite job to miners via Stratum                │  │
│  │  6. Receive shares from miners                              │  │
│  │  7. If share meets parent target → submit to parent pool    │  │
│  │  8. If share meets ZION aux target → submit to ZION node    │  │
│  │     (submitauxblock RPC with AuxPoW proof)                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                │                                    │
│                                ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              STRATUM SERVER (:8444)                          │  │
│  │                                                              │  │
│  │  Mining modes:                                               │  │
│  │  1. Standard mode: deeksha_lite jobs (existing)             │  │
│  │  2. AuxPoW mode: composite ALPH/DCR jobs (new)              │  │
│  │                                                              │  │
│  │  Miner connects → pool decides which mode to assign          │  │
│  │  based on miner capabilities and profit optimization         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 12.2 New RPC Methods

```json
// getauxblock — returns ZION aux template for merge mining
// Request:
{ "method": "getauxblock", "params": [] }

// Response:
{
  "result": {
    "hash": "<ZION block hash hex>",
    "header_hex": "<80-byte ZION header hex>",
    "target_hex": "<32-byte aux target hex>",
    "height": <current ZION height>,
    "difficulty": <auxpow difficulty>
  }
}

// submitauxblock — submits AuxPoW block to ZION node
// Request:
{
  "method": "submitauxblock",
  "params": [
    "<ZION block hash hex>",
    "<parent coinbase TX hex>",
    "<parent merkle branch hex[]>",
    "<parent header hex>",
    "<parent nonce>",
    "<chain merkle branch hex[]>",
    "<chain index>"
  ]
}

// Response:
{ "result": true }
```

### 12.3 Pool Job Construction

```rust
// pool/src/bin/server.rs (new merge mining proxy)

async fn build_composite_job(
    zion_template: &AuxBlockTemplate,
    parent_template: &ParentBlockTemplate,
    parent_chain: ParentChain,
) -> CompositeJob {
    // 1. Compute ZION block hash from aux template
    let zion_block_hash = hash_zion_header(&zion_template.header);

    // 2. Build aux commitment for parent coinbase
    let commitment = build_aux_commitment(
        &zion_block_hash,
        chain_merkle_size,  // 1 for single-chain
        chain_merkle_nonce, // random
    );

    // 3. Insert commitment into parent coinbase scriptSig
    let modified_coinbase = insert_commitment(&parent_template.coinbase_tx, &commitment);

    // 4. Recompute parent merkle root with modified coinbase
    let modified_merkle_root = compute_merkle_root_with_coinbase(
        &modified_coinbase,
        &parent_template.merkle_branches,
    );

    // 5. Build composite parent header with modified merkle root
    let composite_header = parent_template.header.with_merkle_root(modified_merkle_root);

    CompositeJob {
        parent_header: composite_header,
        parent_chain,
        zion_block_hash,
        aux_target: zion_template.target,
        parent_target: parent_template.target,
    }
}
```

### 12.4 Share Processing

```rust
async fn process_merge_share(share: &MergeShare) -> ShareResult {
    // 1. Recompute parent hash (Blake3)
    let parent_hash = blake3_pow(&share.parent_header, share.parent_nonce);

    // 2. Check if meets parent target → submit to parent pool
    if meets_difficulty(&parent_hash, &share.parent_target) {
        submit_to_parent_pool(share).await;
        // Parent block found! ZION AuxPoW block is also valid.
    }

    // 3. Check if meets ZION aux target → submit to ZION node
    if meets_difficulty(&parent_hash, &share.aux_target) {
        let auxpow_proof = build_auxpow_proof(share);
        submit_auxblock_to_zion_node(&share.zion_block_hash, &auxpow_proof).await;
        // ZION block found!
    }

    // 4. Check if meets share target (vardiff) → count as share
    if meets_difficulty(&parent_hash, &share.share_target) {
        return ShareResult::Accepted;
    }

    ShareResult::RejectedLowDifficulty
}
```

---

## 13. Miner Support

### 13.1 Standard Miners (no change)

Existing deeksha_lite miners continue mining ZION blocks as before. No changes needed.

### 13.2 Blake3 Miners (new)

Miners who want to merge-mine connect to the ZION pool and receive composite jobs (parent header with ZION commitment). They hash Blake3 and submit shares.

**Compatible miners:**
- Any Blake3 miner (CPU, GPU, ASIC)
- DCR ASICs (if pointed at ZION pool instead of DCR pool)
- ALPH GPU miners (e.g., T-Rex, lolminer)
- Custom Blake3 CPU miner (we can build one)

### 13.3 ZION Miner Binary (new mode)

```rust
// V3/L1/miner/src/main.rs (new --merge-mining flag)

fn main() {
    let args = parse_args();
    if args.merge_mining {
        // Connect to ZION pool in AuxPoW mode
        // Receive composite jobs (parent header + ZION commitment)
        // Hash Blake3
        // Submit shares
        run_blake3_miner(args).await;
    } else {
        // Standard deeksha_lite mining (existing)
        run_deeksha_miner(args).await;
    }
}
```

### 13.4 Blake3 CPU Mining

```rust
// V3/L1/miner/src/blake3_cpu.rs (new)

pub fn blake3_mine(header: &[u8], start_nonce: u64, count: u64, target: &[u8; 32]) -> Option<(u64, [u8; 32])> {
    for offset in 0..count {
        let nonce = start_nonce.wrapping_add(offset);
        let mut input = Vec::with_capacity(header.len() + 8);
        input.extend_from_slice(header);
        input.extend_from_slice(&nonce.to_le_bytes());
        let hash = blake3::hash(&input);
        let hash_bytes = hash.as_bytes();
        if meets_difficulty(hash_bytes, target) {
            return Some((nonce, *hash_bytes));
        }
    }
    None
}
```

### 13.5 Blake3 GPU Mining

Blake3 is much simpler than deeksha_lite — a basic OpenCL kernel can be written in ~200 lines. Alternatively, existing Blake3 GPU implementations can be adapted.

---

## 14. GPU Kernel Analysis

### 14.1 Existing GPU Kernels

| Kernel | File | Algorithm | Status |
|--------|------|-----------|--------|
| Ekam Deeksha v2 | `cosmic_harmony_deeksha.cl` | Full CHv4 pipeline (Keccak→SHA3→Matrix→Fusion→NPU) | ✅ Production |
| DeekshaLite v1 | `deeksha_lite.cl` | 256 KiB scratchpad, Keccak+SHA3+AES | ✅ Production |
| DeekshaLite Fire | `deeksha_lite_fire.cl` | v1 + thermal loop | ✅ Production |
| DeekshaLite Fire CUDA | `deeksha_lite_fire.cu` | CUDA variant of Fire | ✅ Production |
| SHA3 test | `sha3_test.cl` | SHA3-512 test kernel | ✅ Test |

### 14.2 Blake3 GPU Kernel (to be implemented)

Blake3 is significantly simpler than deeksha_lite:
- No scratchpad (memory-hard) step
- No AES encryption
- No thermal loop
- Just Blake3 hash of header + nonce

**Implementation options:**
1. **Write our own OpenCL kernel** (~200-300 lines, based on Blake3 reference)
2. **Use existing Blake3 GPU implementation** (e.g., from DCR mining software)
3. **Use blake3 crate on CPU** (simpler, but slower than GPU)

**Recommendation:** Start with CPU `blake3` crate (simplest, immediate). Add GPU kernel later if hashrate demands it.

### 14.3 OpenCL Integration

```rust
// V3/L1/cosmic-harmony/src/gpu/opencl_kernel.rs (existing pattern)
// Already has infrastructure for loading/running OpenCL kernels
// Can be extended to load blake3.cl kernel
```

---

## 15. Revenue System Integration

### 15.1 Existing RevenueSource Mapping

The revenue system already has `Blake3External` for DCR/ALPH revenue tracking. For merge mining:

```rust
// New RevenueSource variant (or reuse existing)
pub enum RevenueSource {
    // ... existing variants ...
    /// Revenue from AuxPoW merge mining (ZION blocks found via parent chain PoW)
    AuxPowMergeMining,
}
```

**Or reuse `Blake3External`** — since merge mining revenue IS from Blake3 external coins.

### 15.2 Revenue Tracking for AuxPoW Blocks

```rust
// When an AuxPoW block is accepted on ZION chain:
revenue_collector.track_zion_block(
    height: block.height,
    subsidy: block.reward,
    pool_fee_pct: 1,
    tx_hash: Some(block.hash_hex),
);

// Additionally track the parent chain revenue (BTC payout from parent pool)
revenue_collector.track_event(
    RevenueEvent::new(RevenueSource::Blake3External, estimated_btc_value, true)
        .with_height(block.height)
        .with_external_coin(parent_chain.ticker())
);
```

### 15.3 Stream Layers Integration

The `stream_layers.rs` DeekshaStreamTelemetry maps the 6-step pipeline to revenue streams. For AuxPoW blocks, a separate telemetry path is needed:

```rust
// AuxPoW blocks don't go through the deeksha pipeline
// They use Blake3 on the parent chain
// Revenue tracking is simpler: ZION block reward + parent pool BTC payout

pub enum MiningMode {
    Standard,  // deeksha_lite — full pipeline telemetry
    AuxPow,    // blake3 — simple revenue tracking
}
```

### 15.4 Profit Router Integration

The `profit_router.rs` already has `ExternalCoin::DCR` and `ExternalCoin::ALPH` with Blake3 algorithm. The merge mining proxy can use the existing `select_best_coin()` function to choose between DCR and ALPH as parent chain:

```rust
// Use existing profit router to pick best parent chain
let entries = vec![
    ProfitEntry { coin: ExternalCoin::DCR, revenue_per_day_usd: dcr_revenue, power_cost_usd: dcr_cost },
    ProfitEntry { coin: ExternalCoin::ALPH, revenue_per_day_usd: alph_revenue, power_cost_usd: alph_cost },
];
let best_parent = select_best_coin(&entries, current_parent, 5.0);  // 5% hysteresis
```

---

## 16. Implementation Phases

### Phase 1 — Blake3 PoW Module (2-3 days)

**Goal:** Add Blake3 hashing capability to cosmic-harmony crate.

**Files:**
- `V3/L1/cosmic-harmony/src/blake3_pow.rs` (NEW) — `blake3_pow(header, nonce) -> [u8; 32]`
- `V3/L1/cosmic-harmony/src/lib.rs` — export `blake3_pow` module

**Tests:**
- Blake3 hash determinism
- Known-answer test vectors
- Difficulty target checking

**No hard fork yet** — just adding the capability.

### Phase 2 — AuxPoW Block Format & Types (3-4 days)

**Goal:** Define AuxPoW block types and validation logic.

**Files:**
- `V3/L1/core/src/lib.rs` — `AuxPowProof`, `ParentChain`, `BlockType`, extend `AcceptedBlock`
- `V3/L1/core/src/peer_block_validation.rs` — `validate_auxpow()` function
- `V3/L1/core/src/aux_merkle.rs` (NEW) — aux merkle root computation, coinbase commitment

**Tests:**
- Valid/invalid AuxPoW proof construction
- Coinbase commitment encoding/decoding
- Merkle branch verification
- Edge cases (empty branches, single leaf)

**No hard fork yet** — validation code exists but is not activated.

### Phase 3 — Dual Difficulty System (2-3 days)

**Goal:** Implement separate difficulty tracking for standard and AuxPoW blocks.

**Files:**
- `V3/L1/core/src/difficulty.rs` — `DualDifficultyState`, separate LWMA for each algorithm
- `V3/L1/core/src/chain.rs` — store/retrieve dual difficulty state

**Tests:**
- Dual LWMA adjustment
- Independent difficulty tracking
- Fork height activation

### Phase 4 — RPC & Node Integration (3-4 days)

**Goal:** Add `getauxblock` and `submitauxblock` RPC methods to ZION node.

**Files:**
- `V3/L1/core/src/rpc.rs` (or equivalent) — new RPC methods
- `V3/L1/core/src/chain.rs` — accept both standard and AuxPoW blocks
- `V3/L1/core/src/peer_block_validation.rs` — dispatch standard vs AuxPoW validation

**Tests:**
- End-to-end AuxPoW block submission via RPC
- Standard + AuxPoW blocks on same chain
- Fork height enforcement

### Phase 5 — Pool Merge Mining Proxy (4-5 days)

**Goal:** Pool orchestrates merge mining between ZION and parent chains.

**Files:**
- `V3/L1/pool/src/bin/server.rs` — merge mining orchestrator
- `V3/L1/pool/src/merge_proxy.rs` (NEW) — parent pool Stratum client, composite job builder
- `AuXpow/src/merge_miner.rs` (NEW) — merge mining orchestrator (alternative location)
- `AuXpow/src/types.rs` — AuxPoW proof types

**Tests:**
- Mock parent pool → composite job construction
- Share submission → parent pool + ZION node
- Profit switching between DCR and ALPH

### Phase 6 — Miner Blake3 Support (2-3 days)

**Goal:** ZION miner can hash Blake3 for AuxPoW jobs.

**Files:**
- `V3/L1/miner/src/main.rs` — `--merge-mining` flag
- `V3/L1/miner/src/blake3_cpu.rs` (NEW) — CPU Blake3 mining
- `V3/L1/miner/src/blake3_gpu.rs` (NEW, optional) — GPU Blake3 mining

**Tests:**
- Blake3 hashrate benchmark
- Share submission to pool

### Phase 7 — Fork Activation & Deploy (1-2 days)

**Goal:** Set fork height, deploy, activate.

**Steps:**
1. Set `AUXPOW_FORK_HEIGHT` to current_height + ~1000 blocks (~16 hours)
2. Deploy updated node binary to all nodes
3. Deploy updated pool binary
4. Monitor fork activation
5. Verify both standard and AuxPoW blocks are accepted

### Phase 8 — Live Test (1-2 days)

**Goal:** Verify merge mining works on live network.

**Steps:**
1. Pool connects to ALPH pool (2miners, BTC wallet) — primary parent
2. Pool receives ALPH templates + ZION aux templates
3. Miner hashes Blake3 on composite jobs
4. Verify: ALPH shares accepted on 2miners
5. Verify: ZION AuxPoW blocks accepted on ZION chain
6. Monitor: ZION chain height grows from both standard and AuxPoW blocks
7. (Secondary) Repeat with DCR pool to verify multi-parent support

**Estimated total: 18-26 days**

---

## 17. Risk Analysis

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Dual-algo security imbalance** | One algorithm could dominate, centralizing mining | Medium | Separate difficulty LWMA ensures fair block distribution |
| **AuxPoW proof forgery** | Attacker submits fake AuxPoW blocks | Low | Strict validation: parent PoW + coinbase commitment + merkle branch |
| **Parent chain reorg** | ZION AuxPoW blocks orphaned when parent reorgs | Medium | ZION should not require parent confirmations — AuxPoW blocks are final once accepted on ZION (same as Namecoin model) |
| **Fork activation failure** | Nodes don't upgrade in time, chain splits | Low | Set fork height far enough ahead (~1000 blocks = 16 hours). Communicate clearly. |
| **Difficulty oscillation** | Dual difficulty causes oscillating block times | Medium | LWMA is self-correcting. Monitor and adjust parameters if needed. |
| **Parent pool dependency** | DCR/ALPH pool downtime stops AuxPoW mining | Low | Multi-parent support (DCR + ALPH) provides fallback. Standard mining continues. |
| **Blake3 implementation bug** | Invalid hashes, consensus failure | Medium | Extensive test vectors. Use well-audited `blake3` crate. |
| **Coinbase commitment parsing** | Parent pool changes coinbase format | Low | Commitment format is standard (Namecoin model). Test with real pool templates. |
| **Miner confusion** | Miners don't understand dual-algo | Medium | Clear documentation. Pool handles mode selection — miners just connect. |

### 17.1 Security Considerations

**AuxPoW attack vectors:**
1. **Fake parent block:** Attacker creates a fake parent block header with valid Blake3 PoW but no real parent chain block. **Mitigation:** This is actually VALID in the Namecoin model — ZION doesn't require the parent block to be on the parent chain. The security comes from the Blake3 PoW difficulty, not from the parent chain's acceptance.

2. **Commitment manipulation:** Attacker tries to claim a parent block for a different ZION block. **Mitigation:** The coinbase commitment cryptographically binds the parent PoW to a specific ZION block hash.

3. **Replay attacks:** Same AuxPoW proof submitted for different ZION heights. **Mitigation:** ZION block hash includes `previous_hash` and `height`, making each proof unique to a specific ZION chain position.

---

## 18. Test Plan

### 18.1 Unit Tests

| Test | Description | Validation |
|------|-------------|------------|
| `blake3_pow_determinism` | Same input → same hash | Hash matches across runs |
| `blake3_pow_kat_vectors` | Known-answer test vectors | Hash matches known values |
| `blake3_pow_meets_difficulty` | Hash vs target comparison | Easy hash passes, hard hash fails |
| `auxpow_proof_construction` | Build valid AuxPoW proof | All fields populated correctly |
| `auxpow_proof_validation_valid` | Validate a correctly built proof | Validation passes |
| `auxpow_proof_validation_invalid_pow` | Parent PoW doesn't meet aux target | Validation fails |
| `auxpow_proof_validation_missing_commitment` | Coinbase has no ZION commitment | Validation fails |
| `auxpow_proof_validation_bad_merkle` | Merkle branch doesn't match | Validation fails |
| `aux_merkle_root_single_chain` | Single aux chain merkle root | Root = leaf hash |
| `aux_merkle_root_multi_chain` | Multi aux chain merkle root | Root computed correctly |
| `coinbase_commitment_encode_decode` | Round-trip encoding | Decoded matches original |
| `dual_difficulty_lwma` | Dual LWMA adjustment | Each algorithm adjusts independently |
| `fork_height_activation` | Pre-fork vs post-fork behavior | AuxPoW rejected pre-fork, accepted post-fork |

### 18.2 Integration Tests

| Test | Description | Validation |
|------|-------------|------------|
| `submit_auxblock_rpc` | Submit AuxPoW block via RPC | Block accepted, chain advances |
| `standard_and_auxpow_same_chain` | Both block types on same chain | Chain accepts both, height advances |
| `mock_parent_pool_composite_job` | Mock DCR pool → composite job | Job has correct parent header + ZION commitment |
| `mock_merge_share_submission` | Share → parent pool + ZION node | Both submissions succeed |
| `profit_switch_dcr_alph` | Switch between DCR and ALPH | Pool switches parent chain correctly |

### 18.3 Live Tests

| Test | Description | Validation |
|------|-------------|------------|
| `live_dcr_merge_mining` | Pool connects to 2miners DCR | DCR shares accepted |
| `live_auxpow_block` | ZION AuxPoW block found | Block accepted on ZION chain |
| `live_dual_algo` | Both standard and AuxPoW blocks | Both types appear in chain |

---

## 19. Files to Change

### 19.1 Core (V3/L1/core/)

| File | Change | Description |
|------|--------|-------------|
| `src/lib.rs` | NEW types | `AuxPowProof`, `ParentChain`, `BlockType`, extend `AcceptedBlock` with `auxpow_proof: Option<AuxPowProof>` |
| `src/lib.rs` | NEW constant | `AUXPOW_FORK_HEIGHT` |
| `src/lib.rs` | NEW function | `auxpow_active(height) -> bool` |
| `src/lib.rs` | MODIFY | `hash_with_algorithm()` — add `"blake3"` algorithm |
| `src/peer_block_validation.rs` | NEW | `validate_auxpow()` function |
| `src/peer_block_validation.rs` | MODIFY | Dispatch standard vs AuxPoW validation |
| `src/difficulty.rs` | NEW | `DualDifficultyState` struct |
| `src/difficulty.rs` | MODIFY | Separate LWMA for standard and AuxPoW |
| `src/chain.rs` | MODIFY | Store dual difficulty state, accept both block types |
| `src/rpc.rs` | NEW | `getauxblock`, `submitauxblock` RPC methods |
| `src/aux_merkle.rs` | NEW | Aux merkle root computation, coinbase commitment |

### 19.2 Cosmic Harmony (V3/L1/cosmic-harmony/)

| File | Change | Description |
|------|--------|-------------|
| `src/blake3_pow.rs` | NEW | `blake3_pow(header, nonce) -> [u8; 32]` |
| `src/lib.rs` | MODIFY | Export `blake3_pow` module, add `AUXPOW_FORK_HEIGHT` |

### 19.3 Pool (V3/L1/pool/)

| File | Change | Description |
|------|--------|-------------|
| `src/lib.rs` | MODIFY | `ShareSubmission` with `auxpow_proof` field, dispatch standard vs AuxPoW |
| `src/bin/server.rs` | MODIFY | Merge mining orchestrator, composite job builder |
| `src/merge_proxy.rs` | NEW | Parent pool Stratum client, profit switching between DCR/ALPH |

### 19.4 Miner (V3/L1/miner/)

| File | Change | Description |
|------|--------|-------------|
| `src/main.rs` | MODIFY | `--merge-mining` flag, dispatch blake3 vs deeksha_lite |
| `src/blake3_cpu.rs` | NEW | CPU Blake3 mining |
| `src/blake3_gpu.rs` | NEW (optional) | GPU Blake3 mining (OpenCL) |

### 19.5 AuXpow crate

| File | Change | Description |
|------|--------|-------------|
| `src/types.rs` | MODIFY | Add `AuxPowProof`, `ParentChain` types (if not in core) |
| `src/merge_miner.rs` | NEW | Merge mining orchestrator (alternative to pool/src/merge_proxy.rs) |

### 19.6 GPU Kernels

| File | Change | Description |
|------|--------|-------------|
| `V3/L1/cosmic-harmony/src/gpu/kernels/blake3.cl` | NEW | OpenCL Blake3 kernel (optional, Phase 6+) |

---

## 20. Open Questions

### Q1: What should AUXPOW_FORK_HEIGHT be?

**Options:**
- **Current height + 1000** (~16 hours notice) — fast deployment
- **Current height + 4320** (~3 days notice) — more time for miners to upgrade
- **Fixed future height** (e.g., block 10000) — predictable, but may be too far

**Recommendation:** Current height + 1000 (fast deployment, but enough time for all nodes to upgrade).

### Q2: Should deeksha_lite blocks be deprecated eventually?

**Options:**
- **Keep dual-algo forever** — both algorithms always accepted
- **Sunset deeksha_lite after X blocks** — eventually Blake3-only
- **Let market decide** — if AuxPoW dominates, deeksha_lite naturally fades

**Recommendation:** Keep dual-algo forever. No forced sunset. Let miners choose.

### Q3: DCR block header format — is it compatible?

DCR block headers are ~180 bytes (different from ZION's 80 bytes). The AuxPoW proof stores the raw parent header bytes, so this is not a problem — ZION doesn't need to parse the DCR header, only hash it with Blake3 and extract the merkle root.

**Action needed:** Verify DCR header format and merkle root extraction during Phase 2.

### Q4: ALPH block header format — is it compatible?

ALPH uses a different block format than DCR. Need to verify:
- ALPH header size and layout
- ALPH coinbase TX format
- ALPH merkle root computation

**Action needed:** Research ALPH block format during Phase 5.

### Q5: Should the existing AuXpow Stratum proxy be kept?

The current AuXpow crate mines external coins independently (solo mining on external pools). This is separate from merge mining.

**Options:**
- **Keep both** — AuXpow proxy for non-Blake3 coins (KAS, ERG, RVN, etc.) + merge mining for Blake3 coins (DCR, ALPH)
- **Replace AuXpow** — merge mining makes the proxy redundant for Blake3 coins, but non-Blake3 coins still need the proxy

**Recommendation:** Keep both. They serve different purposes:
- AuXpow proxy: Revenue from non-Blake3 external coins (KAS, ERG, RVN, ETC, etc.)
- Merge mining: ZION chain security from Blake3 parent chains (DCR, ALPH)

### Q6: How to handle parent chain difficulty vs ZION aux difficulty?

ZION's aux difficulty will typically be LOWER than DCR's difficulty. This means:
- Every DCR block found also meets ZION's aux target → ZION block
- But not every ZION aux target meeting hash is a DCR block

This is the standard AuxPoW model (same as Namecoin/Bitcoin). The pool must handle both cases:
- Hash meets parent target → submit to both parent and ZION
- Hash meets only aux target → submit to ZION only (parent pool doesn't want it)

### Q7: Revenue split — how to compensate merge miners?

**Options:**
- **Same as standard blocks** — merge miner gets full ZION block reward (89% miner, 5% humanitarian, 5% issobella, 1% pool)
- **Reduced reward** — merge miners get less ZION since they're also earning from parent chain
- **Bonus reward** — merge miners get MORE ZION to incentivize merge mining

**Recommendation:** Same as standard blocks. The ZION block reward is independent of parent chain revenue. Merge miners earn ZION (from AuxPoW blocks) + BTC (from parent pool) — both are legitimate revenue.

---

## Appendix A: Namecoin AuxPoW Reference

### A.1 Coinbase Commitment

```
Script format in parent coinbase:
  0xfa 0xbe 'm' 'm'           — 4 bytes magic (0xfabe6d6d)
  [aux_block_hash: 32 bytes]   — hash of aux block (ZION block hash)
  [merkle_size: 4 bytes LE]    — number of aux chains being merge-mined
  [merkle_nonce: 4 bytes LE]   — nonce for aux merkle tree

Total: 44 bytes
```

### A.2 Aux Merkle Root

For single-chain merge mining (ZION only):
```
aux_merkle_root = zion_block_hash  (single leaf = root)
```

For multi-chain merge mining (ZION + others):
```
aux_merkle_root = merkle_root([chain_0_hash, chain_1_hash, ...])
```

### A.3 Chain Merkle Branch

The chain merkle branch proves that ZION's block hash is included in the aux merkle root:
```
chain_merkle_branch = [sibling_hashes...]
chain_index = position of ZION in the aux chain list
```

For single-chain: `chain_merkle_branch = []`, `chain_index = 0`.

---

## Appendix B: DCR Blake3 PoW Details

### B.1 DCR Block Header (180 bytes)

```
Version:      4 bytes (uint32)
Previous:    32 bytes (hash)
MerkleRoot:  32 bytes (merkle root of transactions)
StakeRoot:   32 bytes (merkle root of stake transactions)
VoteBits:     2 bytes (uint16)
FinalState:   6 bytes
Voters:       2 bytes (uint16)
StakeVersion: 4 bytes (uint32)
Timestamp:    4 bytes (uint32, Unix seconds)
Bits:         4 bytes (uint32, difficulty bits)
Nonce:        4 bytes (uint32)  — NOTE: only 4 bytes, not 8!
```

**IMPORTANT:** DCR nonce is 4 bytes (uint32), not 8 bytes like ZION. The `parent_nonce` field in `AuxPowProof` should handle both sizes.

### B.2 DCR PoW Hash

```rust
// DCR PoW: Blake3(header[0..180])
// Note: DCR uses BLAKE3 for PoW hash since DCP-0011
let pow_hash = blake3::hash(&dcr_header[..180]);
```

### B.3 DCR Merkle Root

DCR uses BLAKE-256 (14 rounds) for transaction hashes, then Bitcoin-style merkle tree for merkle root.

---

## Appendix C: ALPH Blake3 PoW Details

### C.1 ALPH Block Header

ALPH uses a different header format than DCR. Research needed during Phase 5 to determine:
- Exact header size and layout
- Nonce size and position
- Merkle root field location
- Coinbase transaction format

### C.2 ALPH PoW Hash

```rust
// ALPH PoW: Blake3(header + nonce)
// Exact input format TBD — research needed
```

---

## Appendix D: Existing Codebase References

| Component | File | Relevance |
|-----------|------|-----------|
| PoW dispatch | `cosmic-harmony/src/algorithms_opt.rs:172` | `cosmic_harmony_with_height()` — single entry point |
| Fork heights | `cosmic-harmony/src/deeksha.rs:14-22` | Height-gated fork pattern |
| Fire fork | `cosmic-harmony/src/lib.rs` | `FIRE_FORK_HEIGHT = 5000` — precedent for future fork |
| Block header | `V3/L1/core/src/lib.rs:142` | `MiningHeader` (80 bytes) |
| Block validation | `V3/L1/core/src/peer_block_validation.rs` | `validate_peer_block()` |
| Difficulty | `V3/L1/core/src/difficulty.rs` | LWMA implementation |
| Pool share validation | `V3/L1/pool/src/lib.rs:420-455` | `ShareSubmission` with `algorithm` field |
| Revenue system | `cosmic-harmony/src/revenue.rs` | `RevenueSource::Blake3External` |
| Profit router | `cosmic-harmony/src/profit_router.rs` | `ExternalCoin::DCR`, `ExternalCoin::ALPH` |
| External coin pools | `profit_router.rs:138-152` | DCR/ALPH pool addresses |
| AuXpow crate | `AuXpow/src/` | Current Stratum proxy (Phase 1) |
| GPU kernels | `cosmic-harmony/src/gpu/kernels/` | Existing OpenCL/CUDA kernels |
| NPU mixing | `cosmic-harmony/src/algorithms_npu.rs` | INT8 MLP (not relevant to merge mining) |
| Stream telemetry | `cosmic-harmony/src/stream_layers.rs` | Revenue-aware pipeline telemetry |
| Revenue journal | `cosmic-harmony/src/revenue_journal.rs` | Append-only audit log |
| NCL integration | `cosmic-harmony/src/ncl_integration.rs` | AI compute layer (25% allocation) |

---

*This document is the comprehensive analysis and implementation plan for true AuxPoW merge mining. No implementation should begin until the open questions in §20 are resolved and the user approves the plan.*

*Related: [`docs/3.0.5/AUXPOW_INTEGRATION_REPORT_2026-07-11.md`](./docs/3.0.5/AUXPOW_INTEGRATION_REPORT_2026-07-11.md) (Phase 1 Stratum proxy report), [`StatusV3.md`](./StatusV3.md) (current status)*
