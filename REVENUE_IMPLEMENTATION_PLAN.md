# ZION V3 Revenue — Implementation Plan & Progress Tracker

> **Date:** 2026-05-18
> **Status:** COMPLETE — Phases A, B (core), C, and D delivered
> **Auto-mode:** Devin executed A → B → C autonomously; Phase D bug fixes applied manually.

---

## Phase A: Payout Engine (Mainnet Blocker #1)
**Goal:** On-chain payout execution for ZION block rewards (humanitarian, issobella, pool fee, miner PPLNS).

| Step | Task | Status | Notes |
|------|------|--------|-------|
| A1 | Explore PplnsEngine + fee/payout flow in pool server | COMPLETED | Miner payouts (89%) already on-chain via `execute_pool_payout`. Fee payouts (5/5/1%) were only accumulated, never settled. |
| A2 | Add `drain_fees` / `restore_fees` to PplnsEngine | COMPLETED | `PplnsEngine::drain_fees()` returns & resets fee accumulators; `restore_fees()` re-adds on failure. |
| A3 | Implement `execute_fee_payout` in pool server | COMPLETED | Batch UTXO transaction with humanitarian + issobella + pool-fee outputs, submitted via node RPC. |
| A4 | Integrate fee payout trigger after block found | COMPLETED | Triggered only when miner payout succeeds; rollback restores fees on failure. |
| A5 | Telemetry hooks (`record_fee_payout`, `record_failed_fee_payout`) | COMPLETED | Added to `MinerTelemetryRegistry`. |
| A6 | Tests & validation | COMPLETED | `cargo test -p zion-pool` passes. |

**Commits:**
- `9b5ac89b` — `feat(pool): drain_fees + restore_fees for on-chain fee payouts`

---

## Phase B: External Pool Proxy (Mainnet Blocker #2)
**Goal:** Stratum proxy to forward backend miner shares to external pools (2miners, MoneroOcean, ZPool).

| Step | Task | Status | Notes |
|------|------|--------|-------|
| B1 | Survey legacy `revenue_proxy.rs` + `profit_router.rs` | COMPLETED | |
| B2 | V3 proxy module + `ExternalPoolClient` scaffolding | COMPLETED | Async tokio client with Stratum handshake, share queue, reconnect loop. |
| B3 | `ProxyListener` — transparent Stratum bridge | COMPLETED | Accepts GPU-miner connections, forwards JSON-RPC lines to external pool with wallet substitution in authorize/login/subscribe. |
| B4 | `PoolMessage::ProxyRedirect` + pool-server integration | COMPLETED | Pool server sends `ProxyRedirect` to miners in `Revenue` / `Auto` groups when `ZION_REVENUE_PROXY_ADDR` is set. |
| B5 | Multi-coin `revenue-proxy` binary | COMPLETED | Supports `ZION_PROXY_COINS=KAS,ETC,ALPH` with per-coin listen ports (base 9000). |
| B6 | Health check + auto-failover | COMPLETED | Exponential backoff, IP-ban detection, transparent reconnection. |
| B7 | Tests & validation | COMPLETED | `proxy_redirect_roundtrip_is_stable` + `cargo test -p zion-pool` passes (52 lib + 29 bin tests). |

**Commits:**
- `8157e72c` — `feat(pool): External Pool Proxy scaffolding (revenue-proxy binary)`
- `eb252b33` — `feat(pool): ProxyRedirect message + pool-server integration for Revenue/Auto`

---

## Phase C: Startup Replay (High Impact, Quick Win)
**Goal:** Automatic state recovery from `RevenueJournal` on startup.

| Step | Task | Status | Notes |
|------|------|--------|-------|
| C1 | Add `RevenueCollector::replay()` | COMPLETED | |
| C2 | Add `CoreRuntime::new_with_journal_replay()` | COMPLETED | |
| C3 | Activate replay in pool server `main()` | COMPLETED | |
| C4 | Tests & validation | COMPLETED | `cargo test -p zion-core -p zion-pool` passes (494 core + 80 pool tests). |

**Commits:**
- `106b4b97` — `feat(core/pool): startup replay from RevenueJournal`

---

## Phase D: Revenue Bug Fixes & Hardening
**Goal:** Fix discovered bugs in the revenue pipeline that could cause data loss or incorrect accounting.

| Step | Task | Status | Notes |
|------|------|--------|-------|
| D1 | Circuit breaker auto-reset | COMPLETED | `CIRCUIT_BREAKER_RESET_SECS` was defined but `reset()` was never called — circuit stayed open forever after 10 consecutive failures. Added `RevenueHealth::maybe_auto_reset()` which checks cooldown and is called automatically before `record_failure()`. |
| D2 | `pool_fee_pct` parameter now used | COMPLETED | `track_zion_block` accepted but ignored `_pool_fee_pct`, always using hardcoded `ZION_POOL_PCT=1`. Now dynamically computes `miner_pct = 100 - humanitarian - issobella - pool`. Falls back to `ZION_POOL_PCT` when 0 is passed. |
| D3 | `replay_zion_block` sets `last_block_ts` | COMPLETED | Missing field caused empty timestamp after journal replay. Now sets `last_block_ts` during replay. |
| D4 | Journal append errors logged | COMPLETED | Replaced 4× `let _ = journal.append(...)` with `if let Err(e) = ... { eprintln!(...) }` — disk-full / I/O errors are now visible in logs instead of silently dropped. |
| D5 | Clippy warnings fixed | COMPLETED | `collapsible_if` in revenue.rs, `identity_op` (`* 1 / 100` → `/ 100`) in pplns.rs, `needless_borrow` in revenue-proxy.rs. |
| D6 | New tests | COMPLETED | `circuit_breaker_auto_resets_after_cooldown`, `pool_fee_pct_is_used_when_nonzero`. All 96 revenue tests pass. |

---

## Summary

### What was delivered
1. **Fee payouts are now on-chain** — every time a ZION block is found, the pool submits a batch UTXO transaction paying the 5% humanitarian tithe, 5% issobella fund, and 1% pool fee to their configured wallets. On failure, fees are restored and retried next round.
2. **Startup replay is live** — the pool server now reconstructs its accumulated revenue state from `RevenueJournal` JSONL files on restart, preventing loss of accounting across crashes or deploys.
3. **External Pool Proxy is operational** — `revenue-proxy` binary provides transparent Stratum bridges to external pools (2miners, MoneroOcean, ZPool, etc.) with wallet substitution and auto-reconnect. The pool server can redirect `Revenue`/`Auto` miners to these proxies via `PoolMessage::ProxyRedirect`.
4. **Revenue pipeline hardened** — circuit breaker now auto-resets after cooldown, `pool_fee_pct` is respected, journal errors are logged, and replay preserves timestamps.

### What remains for full Mainnet readiness
- **Runtime profit-switching** — the proxy currently serves the coins configured at startup (`ZION_PROXY_COINS`). Automatic switching to the most profitable coin based on `profit_router` estimates is future work.
- **NCL AI task dispatch** (25% stream) — connect `track_ncl_task` to an AI gateway or compute marketplace. Waiting for Hiran v2.2.
- **End-to-end Mainnet rehearsal** — run the full stack (node + pool + proxy) on testnet with real external pool connections.
