# ZION 3.2 "One Love" — Security Audit Summary

> **Audit date:** 26 August 2026  
> **Remediation complete:** 1 September 2026  
> **Scope:** Core consensus, multi-chain service, pool, contracts, dependencies  
> **Status:** 43 of 44 findings fixed or accepted with mitigations

---

## Overview

An internal security audit of the ZION 3.2 "One Love" codebase was completed in late August 2026. The audit covered the L1 core, multi-chain service, pool, miner, EVM contracts, and the Rust dependency tree.

**No catastrophic fund-loss bugs were found in production code paths.** All critical and high-severity findings that could lead to fund loss were fixed before this summary was published.

---

## Findings summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 10 |
| Medium | 20 |
| Low / Info | 12 |
| **Total** | **44** |

| Outcome | Count |
|---------|-------|
| Fixed | 35 |
| Accepted with mitigation | 5 |
| Deferred to v3.3 | 4 |
| **Total addressed** | **44** |

---

## Critical and high-priority fixes

| Finding | What it was | Fix |
|---------|-------------|-----|
| **Pool share difficulty** | Pool could accept shares with too little work | Minimum share difficulty of 1000 enforced across the pool |
| **Block payout idempotency** | A block-found payout could be processed more than once | `paid_block_heights` guard and per-address payout deduplication |
| **Contract minter role** | Token minter role was fixed at deploy time | `AccessControl` with `MINTER_ROLE`, `SLASHER_ROLE`, and safe transfer |
| **Token burn** | Token contract had no burn, breaking slashing | `burn()` added and restricted to slasher role |
| **Bridge replay** | Bridge could match the same deposit more than once | Source `tx_hash` added to the deposit matching key |
| **HTLC source verification** | Target-side lock could be created before source lock | Source lock is now confirmed before the target lock is created |
| **HTLC preimage strength** | Preimage was derived from a weak source | Preimage is now generated from OS-grade CSPRNG |
| **HTLC preimage storage** | Preimage stored in plaintext | Preimage encrypted at rest with a configured key |
| **Solver bid signatures** | Solver bid signatures were not verified | Bid signatures verified against registered solver public keys |
| **Wallet sign phishing** | Wallet could sign arbitrary attacker messages | Typed signing with a `ZION_WALLET_SIGN:v1` domain tag |
| **Deposit proof validation** | Deposit proofs were trusted without on-chain check | Proofs now verified against the source chain before acceptance |
| **Rate limiter memory** | Per-IP / per-user buckets never evicted | TTL-based eviction with size caps |

---

## Items accepted or deferred

A small number of findings were accepted with documented mitigations or deferred to v3.3:

| Finding | Reason |
|---------|--------|
| Merkle root construction | Non-standard flat hash; risk low in the current single-pool model. Proper Merkle tree planned for v3.3. |
| Dependency advisories | Selected Rust networking dependencies carry known advisories. Compensating controls (reverse proxy, rate limiting, minimal external exposure) are in place. Full migration to the successor library stack is planned for v3.3. |
| HTLC memo replay | `SWAP:LOCK` memo uses a unique hashlock per swap. Additional explicit nonce deferred to avoid breaking existing swaps. |
| Swap executor atomicity | Two-phase commit deferred to v3.3; current flow is protected by an audit journal and idempotent order states. |

---

## Verification

All Rust code compiles cleanly and the relevant test suites pass:

- Core node tests
- Pool tests
- Multi-chain tests

The audit report is part of the open-source repository. External review before the 31 December 2026 public launch is still recommended.
