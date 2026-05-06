# Consensus: Cosmic Harmony v3

> **Algorithm:** Cosmic Harmony v3 (CHv3)  
> **First Rust implementation:** v2.9.5, January 2026  
> **Algorithm origin:** September 26, 2025

---

## Overview

Cosmic Harmony v3 is ZION's Proof-of-Work algorithm. It is:

- **CPU-friendly** — balanced for commodity x86 and ARM hardware
- **GPU-competitive** — OpenCL/CUDA implementations are viable but not dominant
- **ASIC-resistant** — memory-hard design increases ASIC development cost significantly
- **Anti-botnet** — calibrated so botnet farms are not economically attractive

The algorithm was designed on **September 26, 2025** — the project's "genesis day" for its core PoW design. The TypeScript/Python prototype was replaced by a production Rust implementation in v2.9.5.

---

## Algorithm Design

CHv3 is a 4-phase sequential hash function:

```
Input: Block Header (height + prev_hash + merkle_root + timestamp + nonce)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: QUANTUM SEED                                           │
│   Blake3(header) → Keccak256(result) → SHA3-512(result)        │
│   Triple-layer hash for quantum-resistance foundation           │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 2: GALACTIC MATRIX (Memory Hard)                         │
│   Allocate 2MB matrix from Phase 1 seed                        │
│   Traverse using Fibonacci spiral path derived from nonce      │
│   Memory reads are non-sequential → ASIC cache defeats itself  │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 3: STELLAR HARMONY                                        │
│   Golden ratio (φ = 1.6180339...) mixing across matrix output  │
│   Introduces mathematical beauty — non-trivial to short-circuit │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 4: COSMIC PROOF                                           │
│   Final Blake3 pass over all phase outputs                     │
│   Compare result against difficulty target                      │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
                      Valid Block Hash
```

---

## Memory Hardness

Phase 2 allocates a **2MB per-nonce matrix**. This is the ASIC-resistance mechanism:

- Static scratchpad (like Scrypt) can be implemented cheaply in hardware  
- CHv3 uses **dynamic Fibonacci-spiral access patterns** where the access sequence depends on both the nonce and the intermediate hash — making memory access unpredictable
- Optimal ASIC design would require ~2MB high-speed SRAM per core, which rapidly increases die area and cost

---

## Performance Reference

| Hardware | Approximate Hashrate |
|----------|---------------------|
| Modern CPU (4 cores, AVX2) | ~2–8 MH/s |
| GPU (RTX 3070) | ~80–120 MH/s |
| GPU (RX 6700) | ~60–90 MH/s |

*Figures from v2.9.5 reference benchmarks. Performance improves with optimized miner versions.*

---

## Difficulty Adjustment (DAA)

ZION uses **LWMA** — Linearly Weighted Moving Average:

- **Window:** 60 blocks (~1 hour)
- **Adjustment cap:** ±25% per window
- **Target:** 60-second average block time

LWMA applies higher weight to more recent blocks, making it responsive to sudden hash rate changes (e.g., large miner joining or leaving) without oscillating.

---

## Dual Mining

v2.9.5 introduced support for dual mining: running CHv3 alongside **VerusHash** (VRSC) simultaneously. The miner submits shares to both pools from the same hardware pass, with minimal performance overhead. This was implemented in the Rust miner crate.

---

## Block Validation

A valid block must satisfy:

1. `CHv3(header) ≤ target` (difficulty target met)
2. `timestamp ∈ [prev_block_time, now + 2h]` (within time bounds)
3. All transactions in merkle tree are valid UTXO spends
4. Block reward ≤ protocol-defined maximum for current height
5. Coinbase split correct: 89/5/5/1% distribution verified

---

## Algorithm History

| Date | Version | Notes |
|------|---------|-------|
| Sep 26, 2025 | ZH-2025 prototype | TypeScript design, first GPU mine |
| Oct 2025 | CHv1 | Python implementation, first multi-node |
| Nov–Dec 2025 | CHv2 | Improved memory hardness, GPU tuned |
| Jan 2026 | **CHv3 Rust** | **Production Rust — ships in v2.9.5** |
| Feb 2026+ | CHv3 (unchanged) | v2.9.6, v2.9.7 — algorithm unchanged |
