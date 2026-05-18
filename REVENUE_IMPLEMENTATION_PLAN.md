# ZION V3 Revenue — Implementation Plan & Progress Tracker

> **Date:** 2026-05-18
> **Status:** ACTIVE — Phase A in progress
> **Auto-mode:** Devin will execute A → B → C autonomously, documenting progress here.

---

## Phase A: Payout Engine (Mainnet Blocker #1)
**Goal:** On-chain payout execution for ZION block rewards (humanitarian, issobella, pool fee, miner PPLNS).

| Step | Task | Status | Notes |
|------|------|--------|-------|
| A1 | Explore PplnsEngine + fee/payout flow in pool server | IN_PROGRESS | |
| A2 | Explore transaction system in zion-core (wallet, tx, signing) | PENDING | |
| A3 | Implement PayoutExecutor module | PENDING | |
| A4 | Integrate payout scheduler into pool server | PENDING | |
| A5 | Tests & validation | PENDING | |

---

## Phase B: External Pool Proxy (Mainnet Blocker #2)
**Goal:** Stratum proxy to forward backend miner shares to external pools (2miners, MoneroOcean, ZPool).

| Step | Task | Status | Notes |
|------|------|--------|-------|
| B1 | Port/RevenueProxy from legacy L1 to V3 | PENDING | |
| B2 | Implement share translation (ZION → external pool format) | PENDING | |
| B3 | Implement job aggregation (external notify → ZION job) | PENDING | |
| B4 | Health check + auto-failover per pool | PENDING | |
| B5 | Tests & validation | PENDING | |

---

## Phase C: Startup Replay (High Impact, Quick Win)
**Goal:** Automatic state recovery from RevenueJournal on startup.

| Step | Task | Status | Notes |
|------|------|--------|-------|
| C1 | Add replay call in CoreRuntime / MiningPool init | PENDING | |
| C2 | Add replay_zion_blocks + replay_events to startup flow | PENDING | |
| C3 | Tests & validation | PENDING | |

---

## Progress Log

### 2026-05-18
- Created `REVENUE_DEEP_ANALYSIS.md` — comprehensive audit with gap analysis.
- Created `REVENUE_IMPLEMENTATION_PLAN.md` — this tracking document.
- Starting Phase A: exploring PplnsEngine and transaction system.
