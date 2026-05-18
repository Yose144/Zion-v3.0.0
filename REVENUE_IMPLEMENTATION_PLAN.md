# ZION V3 Revenue — Implementation Plan & Progress Tracker

> **Date:** 2026-05-18
> **Status:** ACTIVE — Phases A & C completed; Phase B in progress
> **Auto-mode:** Devin executes A → B → C autonomously, documenting progress here.

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
| B2 | Design V3 proxy architecture | IN_PROGRESS | Likely a separate `tokio`-based binary (e.g. `revenue-proxy.rs`) to avoid mixing async into the sync pool server. |
| B3 | Implement share translation (ZION → external pool format) | PENDING | |
| B4 | Implement job aggregation (external notify → ZION job) | PENDING | |
| B5 | Health check + auto-failover per pool | PENDING | |
| B6 | Tests & validation | PENDING | |

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

## Progress Log

### 2026-05-18
- Created `REVENUE_DEEP_ANALYSIS.md` — comprehensive audit with gap analysis.
- Created `REVENUE_IMPLEMENTATION_PLAN.md` — this tracking document.
- **Phase A completed:** On-chain fee payouts for humanitarian (5%), issobella (5%), pool fee (1%) implemented and tested.
- **Phase C completed:** Startup replay from `RevenueJournal` implemented and tested.
- Starting Phase B: External Pool Proxy design & implementation.
