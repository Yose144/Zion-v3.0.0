# ZION 3.2 "One Love" — Security Audit Summary

> **Audit date:** 26 August 2026  
> **Remediation complete:** 1 September 2026  
> **Scope:** Core consensus, multi-chain service, pool, contracts, dependencies  
> **Status:** 48 findings reviewed in total: 37 fixed, 7 accepted with mitigations, 4 deferred to v3.3

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
| **Severity-graded total** | **44** |

Severity ratings are assigned to 44 findings. Four additional dependency/deferred items bring the audited total to 48.

| Outcome | Count |
|---------|-------|
| Fixed | 37 |
| Accepted with mitigation | 7 |
| Deferred to v3.3 | 4 |
| **Total addressed** | **48** |

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

A number of findings were accepted with documented mitigations or deferred to v3.3:

| ID | Status | Reason |
|----|--------|--------|
| FIND-014 | Accepted | `swap_executor` debit-before-credit is not atomic; mitigated by `JournalLedger` for a full audit trail. A two-phase commit is planned for v3.3. |
| FIND-015 | Accepted | `X-Solver-Key` travels over HTTP. In production, solver traffic is proxied through nginx with TLS. Enforcing `.https_only()` at code level is planned for v3.3. |
| FIND-022 | Accepted | Reconciliation `expected = internal + pool` was reviewed and confirmed correct. The hot wallet holds both user ledger balances and AMM reserves as separate accounting systems. |
| FIND-024 | Accepted | `SWAP:LOCK` memo uses a unique 32-byte hashlock per swap as replay prevention. An additional explicit nonce is deferred to avoid breaking existing swaps. |
| FIND-L1-001 | Accepted | Flat BLAKE3 Merkle root is non-standard. Risk is low in the current single-pool model; a proper Merkle tree is planned for v3.3. |
| POL-008 | Accepted | Per-session rate limit is adequate for current scale; an IP-global budget is planned for v3.3. |
| CON-004 | Accepted | `IntentSettlement` deploys with a single EOA owner. Docs recommend a multisig or timelock for mainnet deployments. |
| DEP-001 | Deferred | `ethers 2.0.14` pulls in known CVEs via `ring 0.16`, `h2 0.3`, and `rustls-webpki 0.101`. Resolved by migrating to `alloy` in v3.3. |
| DEP-002 | Deferred | Unmaintained crates (`instant`, `fxhash`, `paste`, `rustls-pemfile`) are cleaned up by the `alloy` migration in v3.3. |
| DEP-003 | Deferred | 18 duplicate crate versions coexist because of `ethers 2.0.14`. Resolved by the `alloy` migration in v3.3. |
| Alloy migration | Deferred | The umbrella dependency migration to `alloy` and the modern networking stack is scheduled for v3.3. |

---

## Verification

All Rust code compiles cleanly and the relevant test suites pass:

- Core node tests
- Pool tests
- Multi-chain tests

The audit report is part of the open-source repository. External review before the 31 December 2026 public launch is still recommended.
