# REPORT — 2026-10-21 G8 Chain-Stall RCA + Pool Submit-Path Fixes

Live incident reproduced and root-caused on Edge (`vmi3425821`). Fixes implemented
in-repo; **deployment to Edge is pending operator action**.

## 1. Incident (observed live)

| Time (CEST) | Event |
|---|---|
| ~07:37 | Tip reaches **89952**, then `getTemplate` wedges for probes |
| 07:40:52 | Pool `submitBlock failed for v3_43909: all 3 L1 endpoints failed` — **real PoW block dropped** |
| 07:41:20 | `submitBlock` → `consensus error: previous hash mismatch` — another real block lost |
| 07:47:41 | watchdog `getTemplate probe failed (http=000) — fail 1/2` |
| 07:48:42 | watchdog **RESTART** `zion-v31-node` (2× fail, 15 s bound) |
| 07:50 | `getTemplate` answers in ~1.7 s; tip still 89952 |
| 07:45–07:48 | Pool rejects `height=89954 (tip=89952)` blocks as **orphans** — pool-side pre-check discards in-flight PoW |
| ~08:10–08:27 | Chain self-recovers; blocks 89988→89992 accepted at ~1–3 min gaps |

Total stall at tip 89952: **~35–40 min** of zero block production while pool
kept broadcasting jobs and accepting shares.

## 2. Root cause chain

```
4-core host saturation (3 L1 nodes ~80–99 % CPU each + bitcoind IBD + quantus)
  → all 3 L1 RPC endpoints exceed the 4 s pool-side bound simultaneously
  → submitBlock "all 3 L1 endpoints failed"        (real blocks dropped)
  → watchdog 15 s getTemplate bound exceeded        (false "wedge")
  → node restart → tip rolls back (89953→89952)
  → pool template cache still serves tip+2 template (stale reuse on RPC fail)
  → miners mine prev_hash-mismatched blocks → orphans
  → tip_age >900 s → G8 chain_live=0 (70 incidents, run #2 failed, uptime 95.27 %)
```

Three compounding defects:

1. **`L1Endpoints` 4 s per-attempt bound** (`rpc_client.rs`) — under saturation all
   three nodes can simultaneously exceed it; submits died instead of waiting.
2. **Pool-side `tip+1` pre-orphan check** (`stratum.rs::submit_found_block`) —
   pool rejected blocks on a *stale tip query* before the node could run real
   consensus. Duplicated the node's own prev-hash check with a weaker data source.
3. **Watchdog 15 s / 2-fail restart policy** (`scripts/watchdog.sh`) — healthy
   `getTemplate` legitimately takes 15–25 s under load; false wedges triggered
   restarts, and each restart rolls the tip back and orphans in-flight work.

Secondary (not fixed here): `template_feed_loop` reuses the last template on RPC
failure — correct for keeping external AuxPoW jobs alive, but it keeps miners on
a ZION header whose parent may already be orphaned. Bound by RPC recovery time;
the timeout fix shrinks this window materially.

## 3. Fixes implemented (this repo)

| File | Change |
|---|---|
| `V31/L1/pool/src/rpc_client.rs` | Per-attempt bound 4 s → **12 s**, env `ZION_L1_RPC_TIMEOUT_MS` (≥500 ms). `attempt_timeout()` cached via `OnceLock`. |
| `V31/L1/pool/src/stratum.rs` | `submit_found_block` no longer pre-orphans on `height != tip+1`. It logs info and **submits anyway — the node's consensus decides**. Genuine orphans are still rejected node-side (`previous hash mismatch`) and recorded via the Err arm. |
| `scripts/watchdog.sh` | `getTemplate` probe 15 s → **30 s**, fails 2 → **3** (sustained >2–3 min wedge). Env: `ZION_WATCHDOG_TEMPLATE_TIMEOUT_S`, `ZION_WATCHDOG_TEMPLATE_MAX_FAILS`. |

Verification: `cargo check -p zion-pool` clean; `cargo test -p zion-pool --lib`
**333/333 pass** (180 s).

## 4. Not fixed / open

- **Edge deploy pending** — pool binary + watchdog script must be rolled out;
  running pool still exhibits the old pre-orphan behaviour (log line seen at
  08:22 was a *legitimate* orphan — tip had already advanced).
- **Root capacity** — the 4-core host is oversubscribed; bitcoind IBD + 3 L1
  nodes contend. Structural fix (move followers/bitcoind off the box, or raise
  CPU) is an N0 infrastructure item.
- **Node-side `getTemplate` latency** — 15–25 s under load is itself a symptom;
  profile `utxo_set` lock contention during block import (L1/core).
- **pearl-lp-tunnel** still crash-looping on dead vast endpoint (`ssh7.vast.ai:35134`
  refused, >21 k restarts) — needs unit fix or teardown.
- **fail2ban** still failed unit (config test OK; runtime cause undiagnosed).
- **journald retention ~1 day** (claimed 40 d) — forensic depth insufficient.
- **Disk 88 %** on `/dev/sda1`.

## 5. G8 status implication

Run #2 (started 2026-10-09) is **failed** — 70 incidents, uptime 95.27 % vs the
99.9 % gate, dominated by the 10.1 h stall on Oct 10–11 plus today's ~40 min
event. After deploying §3, start **G8 run #3** with clean counters; the metric
target (100 k+ blocks, <1 incident) is unchanged.
