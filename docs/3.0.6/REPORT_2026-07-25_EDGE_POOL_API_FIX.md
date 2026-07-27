# Edge Pool API Stale Confirmation Fix — Deployment Report

> **Date:** 2026-07-25
> **Scope:** Edge server (`62.171.141.136`), `zion-edge-pool`, SQLite `share_store`, `/api/v1/blocks`, `/api/v1/payouts`
> **Engineer:** Devin
> **Methodology:** Live RPC/metrics inspection, source-code grep, local release build, binary deployment to Edge, SQLite backfill, post-deploy API verification.

---

## 1. Executive Summary

The Edge pool was correctly **finding blocks and broadcasting payouts**, but the REST endpoints `/api/v1/blocks` and `/api/v1/payouts` reported **every block as `pending` and every payout as `confirmed: false`**. Pool metrics and node RPC showed the real state advancing.

Root cause: the pool orphan monitor and payout confirmation sweep only updated in-memory telemetry (`BlockTracker` / `MinerTelemetryRegistry`); they did not write confirmation status back to the SQLite `share_store` used by the API. After a restart the in-memory tracker also started empty, so pre-restart pending blocks were never re-evaluated.

The fix:
- Pool orphan monitor now calls `share_store.update_block_status()` when a block is confirmed/orphaned.
- Payout confirmation sweep now calls `share_store.confirm_payout()` when a TX is seen on chain.
- Pool now reloads pending blocks from `share_store` into `BlockTracker` on startup, so orphan monitoring resumes after a restart.
- Existing stale DB rows were backfilled from the live chain.
- A lingering `ThreadPoolExecutor` shutdown hang in `ZION_OS/dashboard/app.py` (line ~11833) was also patched.

Result: the API now reflects live confirmation state. At the time of writing, chain height is **5151** and blocks older than `height + 10` are shown as `confirmed` with `confirmed_at` set.

---

## 2. Symptoms Observed

- Pool metrics/log showed continuous `block_confirmed height=...` and `payout_confirmed_sweep confirmed=...` messages.
- `/api/v1/blocks?limit=5` returned all blocks with `"status": "pending"` and `"confirmed_at": null`.
- `/api/v1/payouts?limit=5` returned all payouts with `"confirmed": false` and `"confirmations": 0`.
- Pool `metrics` endpoint showed `zion_pool_blocks_found_total` and `zion_pool_blocks_confirmed_total` increasing, confirming the in-memory tracker was correct.

---

## 3. Root Cause

In `V3/L1/pool/src/bin/server.rs`:

- The **orphan monitor** resolved blocks via `BlockTracker::resolve_block()` but did not update `share_store`.
- The **payout confirmation sweep** confirmed payouts in `MinerTelemetryRegistry` but did not update `share_store`.
- `BlockTracker` did not load historical pending blocks from `share_store` on startup, so after a restart the orphan monitor had no backlog to confirm.

The API endpoints `/api/v1/blocks`, `/api/v1/payouts`, and `/api/v1/miners` are served directly from `share_store`, so they stayed stale.

---

## 4. Code Changes

### 4.1 Pool server (`V3/L1/pool/src/bin/server.rs`)

- Added `ShareStore` persistence in the orphan monitor: after `bt.resolve_block(...)` the block status is also written to SQLite via `ss.update_block_status(height, "confirmed"/"orphaned")`.
- Added `ShareStore` persistence in the payout confirmation sweep: after `telemetry.confirm_payout()` the payout is confirmed in SQLite via `ss.confirm_payout(tx_id, confirmations)`.
- Added `BlockTracker::load_pending_block()` and startup logic that queries pending blocks from `share_store` and loads them into the tracker.

These changes are also mirrored in `public/V3/L1/pool/src/bin/server.rs`.

### 4.2 Dashboard (`ZION_OS/dashboard/app.py`)

- The third `ThreadPoolExecutor` around line 11833 (P2P node probe) used `with ThreadPoolExecutor(...) as ex`, which can hang on `as_completed` timeout because `__exit__` waits for workers. Replaced with explicit `try/finally` and `ex.shutdown(wait=False, cancel_futures=True)`.

---

## 5. Build and Deployment

The `/opt/zion/V3/L1/pool` source on Edge was older than the local repo, so the release binary was built locally and copied to the server:

```bash
# Local build
cd /home/zionserver/2.9.6-main/V3
CARGO_TARGET_DIR=/tmp/cargo-build cargo build --release -p zion-pool

# Deploy to Edge
scp -P 2222 /tmp/cargo-build/release/server root@62.171.141.136:/opt/zion/V3/target/release/server.new2
# On Edge: mv existing binary, copy new binary, SIGKILL the unit so systemd restarts it with the new binary
```

The running pool service `zion-edge-pool` was restarted and is now executing the updated binary.

---

## 6. SQLite Backfill

A one-time backfill script `/tmp/backfill_pool.py` was run against `/data/zion/pool-store.db`:

- Marked blocks with `height + 10 <= chain_height` as `confirmed` (chain height was **5145** at the time).
- Queried every unique unconfirmed `tx_id` via `getTransaction` and updated `payouts.confirmed`, `confirmations`, and `block_hash` where the TX was on chain.

Results:

```text
blocks_updated=4321
payouts_updated=4909
not_found=1
```

The single `not_found` TX (`951431cb1bf9f1367c6f6c7e793e6a711e385c717663786582a508d29b180352`, height 5145) remains in the DB as `confirmed=false`. The pool payout retry/deferred logic should resolve it on a subsequent round.

---

## 7. Verification

### 7.1 Service and metrics

```text
zion_pool_active_sessions 2
zion_pool_blocks_found_total 2       (since this restart)
zion_pool_blocks_confirmed_total 6
zion_pplns_payout_rounds 5097
zion_pool_miner_paid_total_atomic{miner_id="vega-smos"} 9610598006
```

### 7.2 `/api/v1/blocks` (chain height 5151)

```text
height 5151 pending
height 5150 pending
...
height 5142 pending
height 5141 confirmed confirmed_at=1784980621
height 5140 confirmed confirmed_at=1784980591
```

### 7.3 `/api/v1/payouts`

Top payouts now show `confirmed: true` and incrementing `confirmations` for entries that have on-chain TXs, e.g.:

```json
{
  "tx_id": "3f70a7eacbf8f1367c6f6c7e793e6a71cc5953717663786533820fd29b180352",
  "height": 5142,
  "confirmations": 3,
  "confirmed": true
}
```

### 7.4 Startup reload log

```text
share_store: opened /data/zion/pool-store.db
block_tracker: loaded 14 pending blocks from DB
```

---

## 8. Follow-up / Notes

- The `/opt/zion/V3/L1/pool` source tree on Edge drifted from the local repo. Future deployments should either rebuild locally and copy the binary, or re-sync `/opt/zion` with the repo and build on Edge.
- The dashboard `app.py` fix was committed as `11610da58`.
- One payout TX (height 5145) is still not found on chain; monitor `journalctl -u zion-edge-pool` for deferred/retry messages.
- The local backup node and Edge nodes should continue to be monitored via the dashboard and `systemctl`.

---

## 9. References

- `V3/L1/pool/src/bin/server.rs` — orphan monitor, payout confirmation sweep, startup block reload.
- `V3/L1/pool/src/store.rs` — `update_block_status()`, `confirm_payout()`, `query_blocks()`.
- `ZION_OS/dashboard/app.py` — P2P node probe `ThreadPoolExecutor` fix.
- `AGENTS.md` — Edge server topology and operational truth sources.
