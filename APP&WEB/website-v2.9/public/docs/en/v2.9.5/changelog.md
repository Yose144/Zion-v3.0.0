# Changelog — v2.9.5 "Native Awakening"

> Released: January 2026  
> Previous release: v2.9 "Quantum Leap" (December 2025)

---

## Summary

v2.9.5 is a **complete ground-up rewrite** of the ZION blockchain in native Rust. The Python/FastAPI stack from the v2.9 era was entirely replaced. This is not a feature release — it is a correctness and foundation release.

---

## Major Changes

### Complete Rust Rewrite

The previous v2.9 codebase was Python (119 source files, 56k+ LOC) with a FastAPI server, Python mining loop, and TypeScript pool components. The honest internal post-mortem in December 2025 found:

- 76+ `NotImplementedError` stubs across the codebase
- Broken pytest configuration (requires pytest-cov, not installed)
- Blockchain at genesis block only — no actual blocks mined in production
- Pool not running on production server

The decision was made to rewrite from scratch in Rust.

**Result after rewrite:**

| Crate | Lines of Rust | Status |
|-------|---------------|--------|
| `core` (blockchain, P2P, UTXO, LMDB) | ~6,550 | ✅ Production |
| `pool` (Stratum v2, PPLNS) | ~6,861 | ✅ Production |
| `miner` (CHv3, CPU/GPU) | ~1,834 | ✅ Production |
| **Total** | **~15,245** | ✅ TestNet Live |

108 unit tests passing. 0 stubs. 0 NotImplementedErrors.

### Presale Cancelled → Fair Launch

Planned 500M ZION presale allocation was cancelled on January 15, 2026 due to EU MiCA (Markets in Crypto-Assets) and AML compliance concerns. The allocation was returned to DAO Treasury.

**Impact:**
- No token holders received preferential pricing
- All ZION must be bought on secondary market or earned by mining
- Truly fair distribution from genesis

### Cosmic Harmony v3 — Rust Implementation

First production Rust implementation of the CHv3 PoW algorithm. Previous TypeScript/Python prototypes achieved ~500 KH/s. The Rust implementation achieves **~2 MH/s** on a standard CPU with AVX2 instructions.

### NCL — Neural Compute Layer (Prototype)

First introduction of the NCL concept — an optional protocol layer where miners contribute AI inference compute in exchange for bonus ZION rewards. In v2.9.5 this was a prototype design only. Formal architecture was not published until v2.9.6.

### CryptoNote Privacy Layer

v2.9.5 included an early implementation of CryptoNote ring signatures (stealth addresses, ring CT). This was experimental. The privacy layer was deprioritized in v2.9.6 as the project focused on the 6-layer architecture and MainNet readiness.

### LMDB — Persistent Storage

The blockchain now uses LMDB (Lightning Memory-Mapped Database) for persistent block and UTXO storage. Previous Python versions used SQLite or in-memory stores.

### Ed25519 Signatures

Moved from ECDSA/secp256k1 to Ed25519 for all transaction signatures. Faster, simpler, better security properties.

### Dual Mining

Support for simultaneous CHv3 (ZION) + VerusHash (VRSC) mining from a single hardware pass.

---

## TestNet Status at v2.9.5 Launch

| Metric | Value |
|--------|-------|
| Seed nodes | 3 (Helsinki, USA, Asia) |
| Unit tests | 108 passing |
| E2E mining | ✅ Verified |
| P2P sync | ✅ IBD working |
| Pool PPLNS | ✅ Payouts verified |
| Block time | 60s target (LWMA stabilized) |
| Hashrate | ~10–15 MH/s aggregate TestNet |

---

## What v2.9.5 Did NOT Change

These parameters are identical to the original design and remain unchanged through all subsequent versions:

- Total supply: 144,000,000,000 ZION
- Block time: 60 seconds
- LWMA DAA: 60-block window
- 100% fee burn
- UTXO transaction model
- Genesis premine: 16.28B ZION (11.31%)
- No presale — Fair Launch
