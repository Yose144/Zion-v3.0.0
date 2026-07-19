# PPLNS Composite Key Fix — Canonical Report

> **Status:** DEPLOYED & VERIFIED on Edge (62.171.141.136)
> **Date:** 2026-07-14
> **Severity:** CRITICAL — payout misrouting (funds sent to wrong miner)
> **Related:** `StatusV3.md`, `AGENTS.md` § "PPLNS Composite Key Fix", `V3/L1/pool/src/bin/server.rs`, `ZION_OS/dashboard/app.py`, `APP&WEB/website-v2.9/src/components/PoolDashboard.tsx`

## 1. Summary

A critical bug in the ZION V3 pool server caused **all workers sharing the same
`miner_id` to have their PPLNS payouts routed to whichever worker registered
last**. The PPLNS engine, telemetry registry, dashboard backend, and web
frontend were all keyed by `miner_id` alone — meaning multiple workers (e.g.
`5070Ti`, `vega-smos`, `barker`) connecting with the same `miner_id`
(`local-miner`) overwrote each other's payout addresses, share counts, and
hashrate telemetry.

**Impact:** Misrouted payouts. One miner (barker) received ~3,743,089 ZION
belonging to other miners. The other miners' shares were silently overwritten.

**Fix:** All PPLNS and telemetry keys changed from `miner_id` to a composite
key `format!("{miner_id}/{worker_name}")`, ensuring each worker is tracked
independently with its own payout address, share count, and hashrate.

## 2. Root Cause

The Stratum protocol allows miners to connect with a username in the format
`miner_id.worker_name`. The pool server correctly parsed both fields but used
only `miner_id` as the key in:

1. **PPLNS engine** — `register_address()`, `record_share_with_diff()`,
   `record_block_found()` all keyed by `miner_id`
2. **Telemetry registry** — `touch_session()`, `record_job_result()`,
   `record_block_found()`, `record_no_solution()` all keyed by `miner_id`
3. **Dashboard backend** (`app.py`) — `fetch_pool_miners()`,
   `get_pool_miners()`, `_get_pool_active_miner_map()`,
   `get_pool_registered_miners()` all keyed by `miner_id`
4. **Web frontend** — API routes and React components used `address` (= `miner_id`)
   as row identity and display key

When worker B connected with the same `miner_id` as worker A, worker B's
payout address overwrote worker A's in the PPLNS engine. All subsequent
payouts for that `miner_id` went to worker B's address, regardless of which
worker actually contributed the shares.

## 3. Changes

### 3.1 Pool Server (`V3/L1/pool/src/bin/server.rs`)

**Commit `bd6f1dfb3`** — PPLNS composite keys (4 locations):

| Location | Function | Old Key | New Key |
|----------|----------|---------|---------|
| ~L1958 | `register_address` | `miner_id` | `format!("{miner_id}/{worker_name}")` |
| ~L1893 | `record_share_with_diff` (ShareRelay) | `miner_id` | `format!("{miner_id}/{worker_name}")` |
| ~L2511 | `record_share_with_diff` (valid share) | `miner_id` | `format!("{miner_id}/{worker_name}")` |
| ~L2833 | `record_block_found` | `miner_id` | `format!("{miner_id}/{worker_name}")` |

Dashboard API `address_for()` updated to use composite key with fallback to
plain `miner_id` for legacy compatibility.

**Commit `85250086d`** — Telemetry registry composite keys (4 locations):

| Function | Old Key | New Key |
|----------|---------|---------|
| `touch_session` | `miner_id` | `format!("{miner_id}/{worker_name}")` |
| `record_job_result` | `miner_id` | `format!("{miner_id}/{worker_name}")` |
| `record_block_found` | `miner_id` | `format!("{miner_id}/{worker_name}")` |
| `record_no_solution` | `miner_id` | `format!("{miner_id}/{worker_name}")` |

`build_miners_payload()` updated to split composite key for display:
```rust
let (display_miner_id, display_worker) = key
    .split_once('/')
    .map(|(mid, wn)| (mid.to_string(), wn.to_string()))
    .unwrap_or((key.clone(), miner.worker_name.clone()));
```

Prometheus metrics updated to emit `miner_id` and `worker_name` as separate
labels (split from composite key).

**Commit `49f8bfb57`** — NoSolution reconnect cooldown (related hardening):
- New config `no_solution_reconnect_cooldown_secs` (env
  `ZION_POOL_NO_SOLUTION_RECONNECT_COOLDOWN_SECS`, Edge: 300s)
- IPs exceeding NoSolution rate limit are banned from reconnecting

### 3.2 Dashboard Backend (`ZION_OS/dashboard/app.py`)

**Commit `a43d4f20f`** — 5 functions updated for composite key support:

| Function | Change |
|----------|--------|
| `fetch_pool_miners()` | `paid_map` keyed by composite `miner_id/worker_name` |
| `get_pool_miners()` | Dict keyed by composite key |
| `_get_pool_active_miner_map()` | Composite key for active miner tracking |
| `get_pool_registered_miners()` | Splits composite key for display |
| Merge logic | Handles composite keys when merging pool + telemetry data |

`dashboard.js` `payoutByKey` updated to use composite key for payout display.

### 3.3 Web Frontend (`APP&WEB/website-v2.9/`)

**Commit `899887663`** — Composite key support for pool miner display:

**`src/app/api/pool/stats/route.ts`:**
- Expanded miners payload type to include `worker_name`, `payout_address`,
  `hashrate`, `valid_shares`, `invalid_shares`, `blocks_found`,
  `pending_balance`, `algorithm`, `backend`, `last_seen`, `hashrate_1h`,
  `hashrate_24h`
- All fields passed through from pool `/miners` API to frontend

**`src/components/PoolDashboard.tsx`:**
- `Miner` interface expanded with all per-worker fields
- Added `formatHashrate()` helper
- Miner table: 8 columns (was 5) — added Payout Address, Hashrate, Shares
- Worker name shown below miner address in Miner/Worker column
- Composite key `${m.address}/${m.worker_name}` for React row identity

**`src/components/pool/PoolMinersClient.tsx`:**
- `Miner` and `MinerRow` interfaces expanded with `worker_name`, `payout_address`
- `minerRows` useMemo uses **real** per-worker hashrate and share counts from
  pool telemetry when available (falls back to estimation when telemetry
  returns 0)
- Podium and leaderboard table show worker_name and payout_address
- Miner detail links point to `payout_address` (not `miner_id`)
- Composite keys for all React row identities
- Donut chart labels include worker_name

### 3.4 Public Repo Sync

**Commit `ee1c810ba`** — Synced `public/V3/L1/pool/src/bin/server.rs` with
latest pool server changes (898 insertions, 89 deletions).

## 4. Deployment History

| Date | Action | Binary MD5 |
|------|--------|------------|
| 2026-07-14 ~20:00 | Initial deploy with PPLNS fix | (first deploy) |
| 2026-07-14 22:19 | **Binary overwritten by stale build** (no PPLNS fix) | `78bc0ae9a0cf59cae6525d488bf91b2f` |
| 2026-07-14 22:27 | Rebuilt locally from fixed source | `802b16249a115d80069183af66c7c51d` |
| 2026-07-14 22:30 | Redeployed fixed binary to Edge | `802b16249a115d80069183af66c7c51d` |

The 22:19 incident occurred because the Edge source tree
(`/root/zion/2.9.6/V3/L1/pool/src/bin/server.rs`) did not contain the composite
key changes — only the local development repo had them. A rebuild on Edge
produced a binary without the fix. The fix was to sync the corrected `server.rs`
to Edge, build locally (where the full dependency tree is consistent), and
deploy the binary directly.

## 5. Verification

### 5.1 Pool API (post-fix, 2026-07-14 22:31)

```
Miners: 3
  local-miner/vega-smos  payout=zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5  shares=103  HR=17587.2  blocks=2
  local-miner/barker     payout=zion1g5u0m3j5x5w2t730c8s4h4m5a5v4a7p6p0c07y7  shares=0    HR=0.0      blocks=0
  local-miner/5070Ti     payout=zion1z8h2z256d8w0q6x2l438r8k240h468v764qk073  shares=177  HR=33005.6  blocks=2
```

Each worker has its own payout address, share count, and hashrate — no
overwriting.

### 5.2 Payout Verification

| Worker | Payout Address | Shares | Blocks | Total Paid |
|--------|---------------|--------|--------|------------|
| 5070Ti | `zion1z8h2z...` | 177 | 2 | 10,392.60 Z |
| vega-smos | `zion1s6m2...` | 103 | 2 | 5,563.52 Z |
| barker | `zion1g5u0m3j5...` | 0 | 0 | 0 Z |

Payouts go to the correct per-worker address. Barker (0 shares) receives
nothing. 5070Ti and vega-smos receive their proportional share.

### 5.3 Web Frontend Verification

- `https://zionterranova.com/pool` returns 200
- `/api/pool/stats` returns per-worker data with `worker_name`,
  `payout_address`, `hashrate`, `valid_shares`
- Pool dashboard table shows 8 columns with worker name and payout address
- Miner leaderboard uses composite keys for row identity

### 5.4 On-Chain Verification (pre-fix incident)

5 TXs confirmed going to correct addresses after initial fix deployment:
- 5070Ti → `zion1z8h2z...` (4 TXs)
- vega-smos → `zion1s6m2...` (1 TX)

No new TXs to barker's old stolen address (`zion1g5u0m3j5...`) after fix.
Barker's old balance of 3,743,089 ZION is from pre-fix misrouted payouts.

## 6. Commits

| Commit | Description |
|--------|-------------|
| `bd6f1dfb3` | PPLNS composite keys (4 locations in server.rs) |
| `85250086d` | Telemetry registry composite keys (4 locations) |
| `49f8bfb57` | NoSolution reconnect cooldown config |
| `6105362e3` | Docs: PPLNS composite key fix + NoSolution cooldown |
| `ee1c810ba` | Sync public repo pool server.rs |
| `a43d4f20f` | Dashboard app.py composite key support |
| `899887663` | Web frontend composite key support |

## 7. Lessons Learned

1. **Edge source tree must stay in sync** — The Edge server's source tree
   diverged from the development repo. Any rebuild on Edge produced a binary
   without the fix. Always sync source before building on Edge, or build
   locally and deploy the binary.

2. **Binary MD5 verification** — Always verify MD5 of deployed binary matches
   the expected build. The 22:19 incident was detected by comparing MD5s.

3. **Composite keys for multi-worker miners** — Any system that tracks
   per-worker state must key by a unique worker identifier, not just the
   miner account ID. The Stratum `miner_id.worker_name` format exists
   precisely for this purpose.

4. **PPLNS state is in-memory** — Pool restarts reset PPLNS state (shares,
   window). Miners must reconnect and resubmit shares to rebuild their
   position. This is acceptable but means restarts should be minimized
   during active mining.

## 8. Files Modified

| File | Commits |
|------|---------|
| `V3/L1/pool/src/bin/server.rs` | `bd6f1dfb3`, `85250086d`, `49f8bfb57` |
| `ZION_OS/dashboard/app.py` | `a43d4f20f` |
| `ZION_OS/dashboard/dashboard.js` | `a43d4f20f` |
| `APP&WEB/website-v2.9/src/app/api/pool/stats/route.ts` | `899887663` |
| `APP&WEB/website-v2.9/src/components/PoolDashboard.tsx` | `899887663` |
| `APP&WEB/website-v2.9/src/components/pool/PoolMinersClient.tsx` | `899887663` |
| `public/V3/L1/pool/src/bin/server.rs` | `ee1c810ba` |
| `StatusV3.md` | `6105362e3` |
| `AGENTS.md` | `6105362e3` |
