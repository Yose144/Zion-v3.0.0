# ZION V3 Revenue — Implementation Plan & Progress Tracker

> **Date:** 2026-05-18
> **Status:** COMPLETE — Phases A, B (scaffolding), and C delivered
> **Auto-mode:** Devin executed A → B → C autonomously, documenting progress here.

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
| A6 | Tests & validation | COMPLETED | `cargo test -p zion-pool` passes (51 lib + 29 bin tests). |

**Commits:**
- `9b5ac89b` — `feat(pool): drain_fees + restore_fees for on-chain fee payouts`
- Pool server `server.rs` already contained `execute_pool_payout` and fee-payout integration from prior work.

---

## Phase B: External Pool Proxy (Mainnet Blocker #2)
**Goal:** Stratum proxy to forward backend miner shares to external pools (2miners, MoneroOcean, ZPool).

| Step | Task | Status | Notes |
|------|------|--------|-------|
| B1 | Survey legacy `revenue_proxy.rs` + `profit_router.rs` | COMPLETED | Legacy proxy uses `tokio` (`ExternalPoolClient`, `RevenueProxyManager`). V3 `profit_router.rs` has coin profiles / pool endpoints / profitability logic but no active proxy. |
| B2 | V3 proxy module + binary scaffolding | COMPLETED | `revenue_proxy.rs` + `revenue-proxy.rs` binary with `ExternalPoolClient`, Stratum handshake, share queue, reconnect loop, stats. |
| B3 | Job translation (external notify → ZION job) | PENDING | Requires mapping external `mining.notify` params to ZION `MiningJob`. |
| B4 | Share translation (ZION → external pool format) | PENDING | Requires protocol-specific share packing (EthStratum vs Stratum vs CryptoNote). |
| B5 | Health check + auto-failover per pool | PARTIAL | Reconnect loop with exponential backoff + IP-ban detection already in `run_loop()`. |
| B6 | Integrate into pool server (auto-coin-switch) | PENDING | Pool server still routes `Revenue`/`Auto` groups but does not forward shares to proxy. |
| B7 | Tests & validation | PENDING | Binary compiles; unit tests to be added once translation logic is complete. |

**Commits:**
- `8157e72c` — `feat(pool): External Pool Proxy scaffolding (revenue-proxy binary)`

---

## Phase C: Startup Replay (High Impact, Quick Win)
**Goal:** Automatic state recovery from `RevenueJournal` on startup.

| Step | Task | Status | Notes |
|------|------|--------|-------|
| C1 | Add `RevenueCollector::replay()` | COMPLETED | Replays `ZionBlock` and `Event` entries from journal into collector state. |
| C2 | Add `CoreRuntime::new_with_journal_replay()` | COMPLETED | Creates collector with env journal and runs replay before returning. |
| C3 | Activate replay in pool server `main()` | COMPLETED | `CoreRuntime::new_with_journal_replay(ConsensusConfig::default())` replaces `CoreRuntime::default()`. |
| C4 | Tests & validation | COMPLETED | `cargo test -p zion-core -p zion-pool` passes (494 core + 80 pool tests). |

**Commits:**
- `106b4b97` — `feat(core/pool): startup replay from RevenueJournal`

---

## Summary

### What was delivered today
1. **Fee payouts are now on-chain** — every time a ZION block is found, the pool submits a batch UTXO transaction paying the 5% humanitarian tithe, 5% issobella fund, and 1% pool fee to their configured wallets. On failure, fees are restored and retried next round.
2. **Startup replay is live** — the pool server now reconstructs its accumulated revenue state from `RevenueJournal` JSONL files on restart, preventing loss of accounting across crashes or deploys.
3. **External Pool Proxy scaffolding** — a new `revenue-proxy` binary (async tokio) connects to external Stratum pools, subscribes for jobs, and queues share submissions. This is the foundation for the 25% multi-algo revenue stream.

### What remains for full Mainnet readiness
- **Phase B completion:** job/share translation, profit-switch coin selection, and pool-server integration so that `Revenue`/`Auto` session groups actually forward shares to the external proxy.
- **NCL AI task dispatch** (25% stream) — connect `track_ncl_task` to an AI gateway or compute marketplace.
- **End-to-end Mainnet rehearsal** — run the full stack (node + pool + proxy) on testnet with real external pool connections.
