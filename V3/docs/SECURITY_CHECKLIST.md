# V3 Security Checklist — Sprint 5 F1

**Last audited:** 2026-03-21  
**Auditor:** autopilot  
**Scope:** V3/L1 pool, miner, core, node

---

## 1. Dependency Audit

| Check | Status | Notes |
|-------|--------|-------|
| `cargo audit` clean | ✅ | bincode unmaintained (transitive via heed) — no vulnerability |
| No yanked crates | ✅ | |
| Lockfile committed | ✅ | `V3/Cargo.lock` in repo |

## 2. Panic Audit — Pool

| Check | Status | Notes |
|-------|--------|-------|
| No `.unwrap()` in production code | ✅ | All `.unwrap()` confined to `#[cfg(test)]` modules |
| No `panic!` / `todo!` / `unimplemented!` in production | ✅ | Only in test code |
| No `unsafe` blocks | ✅ | Pool crate has zero unsafe |
| `expect()` only on lock poisoning (unrecoverable) | ✅ | Pattern: `.lock().expect("…lock poisoned")` — appropriate |

## 3. Panic Audit — Core

| Check | Status | Notes |
|-------|--------|-------|
| Single `unsafe` block | ✅ | `storage.rs:181` — heed LMDB `EnvOpenOptions::open()` — required by API |
| Hash functions use safe wrappers | ✅ | cosmic-harmony via `zion_core` |
| Block validation rejects invalid candidates deterministically | ✅ | `validate_candidate()` returns `Option` |

## 4. Input Validation — Pool Server

| Boundary | Protection | Status |
|----------|-----------|--------|
| Miner Hello — algorithm mismatch | Rejects connection immediately | ✅ |
| Share Submit — unknown job_id | Returns `InvalidJob`, increments rejected_shares | ✅ |
| Share Submit — stale job (TTL expired) | Returns `StaleJob`, removes job, notifies miner | ✅ |
| Share Submit — header mismatch | Returns `JobMismatch`, increments rejected_shares | ✅ |
| Share Submit — low difficulty | Returns `RejectedLowDifficulty` | ✅ |
| Wire protocol — malformed JSON | `serde_json::from_str` returns `Err`, connection dropped | ✅ |
| Wire protocol — empty line | `read_line` returns 0 → "peer closed" error | ✅ |
| Hex parsing — wrong length | Returns descriptive error | ✅ |
| Hex parsing — non-hex chars | Returns descriptive error | ✅ |
| Max sessions per IP | `ZION_MAX_SESSIONS_PER_IP` (default 10) rate limiting | ✅ |

## 5. Input Validation — Node RPC

| Boundary | Protection | Status |
|----------|-----------|--------|
| RPC request decode | `decode_rpc_request()` returns `Result` | ✅ |
| Template ID validation | Node checks template_id matches current | ✅ |
| Stale template rejection | Includes reason string for miner feedback | ✅ |

## 6. Rate Limiting & DoS

| Protection | Status | Config |
|-----------|--------|--------|
| Per-IP session limit | ✅ | `ZION_MAX_SESSIONS_PER_IP=10` |
| Accept limit | ✅ | `ZION_ACCEPT_LIMIT` (optional) |
| Job TTL expiration | ✅ | `ZION_JOB_TTL_MS=15000` |
| SIGTERM graceful shutdown | ✅ | ctrlc handler with drain |
| Non-blocking listener accept | ✅ | 50ms sleep loop, avoids accept-storm |

## 7. Cryptographic Safety

| Check | Status | Notes |
|-------|--------|-------|
| No custom crypto implementations | ✅ | Uses standard `sha2`, `sha3`, `blake3` crates |
| Cosmic Harmony hash function pinned | ✅ | `consensus_profile()` = `cosmic_harmony_ekam_deeksha_v2` |
| Difficulty target comparison is constant-time safe | ✅ | Byte array comparison in `validate_candidate()` |
| No secret material in wire protocol | ✅ | Only hashes, nonces, job IDs |

## 8. BFG / Secret Scrub

| Check | Status | Notes |
|-------|--------|-------|
| Premine backup never entered git history | ❌ | `git log --all --name-only` still shows `PREMINE_WALLETS_BACKUP.json`; BFG/history scrub remains required before any public launch or public fork |
| No private keys in source tree | ✅ | Only public addresses in `PREMINE_ADDRESSES_PUBLIC.txt` |
| `.env` files gitignored | ✅ | Server `.env` never committed |

## 9. Fuzzing Readiness

| Target | Priority | Status |
|--------|----------|--------|
| `decode_message()` — pool wire protocol | HIGH | 🔲 Ready (pure function, easy fuzz target) |
| `parse_fixed_hex()` — hex parsing | MEDIUM | 🔲 Ready |
| `validate_candidate()` — block validation | HIGH | 🔲 Ready |
| P2P message parsing (node) | HIGH | 🔲 Ready |

> **Note:** `cargo-fuzz` harnesses already exist in `V3/L1/core/fuzz/` and `V3/L1/pool/fuzz/`.
> What remains is a deliberate pre-launch fuzz campaign, corpus seeding, and sign-off on runtime fuzz coverage.

## 10. Test Coverage Summary

| Crate | Tests | Coverage Focus |
|-------|-------|----------------|
| zion-core | 393 | Consensus, validation, chain state, P2P, storage |
| cosmic-harmony | 81 | Hash function, SIMD, correctness vectors |
| zion-miner | 59 | Config profiles, nonce scan, autotune, error handling |
| zion-pool | 73 | Wire protocol, PPLNS, revenue routing, share lifecycle, stats |
| **Total** | **606** | |

---

## Summary

- **No known vulnerabilities** in dependency tree
- **Zero unsafe** in pool/miner code, one justified unsafe in core (LMDB)
- **All user-facing inputs validated** with typed error returns
- **Rate limiting active** per-IP with configurable limit
- **Fuzzing harnesses exist**, but sustained fuzz execution and sign-off are still pending
- **73 pool tests** cover wire protocol edge cases, share lifecycle, revenue routing, PPLNS payouts, and Prometheus metrics output
