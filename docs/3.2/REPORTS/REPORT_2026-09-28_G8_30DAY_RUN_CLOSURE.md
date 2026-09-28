# G8 — 30-Day Continuous Run: Closure Report (run #1)

> **Date:** 2026-09-28
> **Gate:** G8 / F6 — 30-day continuous run, acceptance "uptime ≥ 99.9 %, no critical incidents"
> **Window:** 2026-08-23 07:00 CEST → 2026-09-22 07:00 CEST (2026-08-23T05:00Z → 2026-09-22T05:00Z, exactly 30.0 days)
> **Verdict:** ❌ **Window elapsed, acceptance NOT met.** Chain-liveness uptime is 97.0–99.7 % depending on stall threshold (all < 99.9 %), and service-level evidence for the first ~21 days no longer exists.
> **Start report:** [`REPORT_2026-08-23_G8_30DAY_CONTINUOUS_RUN_STARTED.md`](./REPORT_2026-08-23_G8_30DAY_CONTINUOUS_RUN_STARTED.md)

---

## 1. Why this report exists

`/api/g8` reports `"status": "completed"` and `progress_percent: 100`, but that status is purely clock-based: `uptime_percent` is still `null` and `critical_incidents` is still `[]` in `/opt/zion/data/g8_run.json`. Neither field was ever populated during the run. This report adds the missing measurement from the sources that still exist.

## 2. Evidence sources and coverage

| Source | Covers | Notes |
|---|---|---|
| L1 chain (`blocks` table, `/opt/zion/data/v31/node.db`, read-only) | **Full window** | Permanent. Block header timestamps (miner-set, 0 non-monotonic in window). |
| Prometheus (`127.0.0.1:9090`) | 2026-09-13 18:04Z → window end (**8.45 of 30 days**) | `storageRetention = 15d`; older data has been deleted. Scrapes only `zion_v31_pool` (:8080), `node_exporter`, `prometheus`, `warp_btc_swap`. **No scrape of node RPC, multichain `/health`, DAO or ZIS.** |
| journald | **Nothing in window** | Oldest entry is 2026-09-28 07:33 CEST (194 MB cap, rotated by debug-level pool logs). |
| Git history + `AGENTS.md` incident notes | Full window | Used for incident attribution only. |

## 3. Chain liveness (full window)

Read-only queries against `blocks` for heights 13357–53077 (last block before the window through first block after it; timestamp span 2 592 080 s).

| Metric | Value |
|---|---|
| Blocks in window | **39 719** (heights 13 358 → 53 076) |
| Mean block interval | **65.3 s** (target 60 s, `difficulty.rs::TARGET_BLOCK_TIME`) |
| Non-monotonic timestamps | 0 |
| Gaps > 10 min / > 15 min / > 30 min / > 60 min | 139 / 59 / 15 / 3 |

With a 60 s exponential target, a gap above 15 min has probability ≈ e⁻¹⁵ per block (≈ 0.01 expected over 40 k blocks), so essentially every long gap below is a real stall or hashrate collapse, not luck.

**Liveness = 1 − Σ(gap − T) / window** for gaps longer than threshold T:

| Stall threshold T | Gaps > T | Σ excess over T | Liveness |
|---|---|---|---|
| 10 min | 139 | 77 055 s (21.4 h) | **97.03 %** |
| 15 min | 59 | 48 149 s (13.4 h) | **98.14 %** |
| 30 min | 15 | 18 684 s (5.2 h) | **99.28 %** |
| 60 min | 3 | 7 420 s (2.1 h) | **99.71 %** |

99.9 % of 30 days is a 43.2-minute budget. The single largest stall alone exceeds it under every threshold.

### Largest stalls

| After height | From (UTC) | To (UTC) | Gap | Attribution |
|---|---|---|---|---|
| 51 828 → 51 829 | 2026-09-21 04:15 | 2026-09-21 06:38 | **2 h 22 m 55 s** | **Confirmed:** watchdog restart loop during node full-state rebuild. Commit `1e96a4599` (authored 07:42 CEST, mid-stall): *"observed live: chain stalled at 51828, RPC dead"* — the 900 s startup grace expired mid-rebuild and the watchdog killed the node every ~15 min, so the ~55 min UTXO rebuild never finished. |
| 22 951 → 22 952 | 2026-08-30 08:50 | 2026-08-30 10:13 | 1 h 23 m | Unattributed (no logs left). |
| 24 713 → 24 714 | 2026-08-31 16:17 | 2026-08-31 17:34 | 1 h 18 m | Unattributed. Same day as several multichain/miner-service deploys (`c675fdb6e`, `0ce844064`, `1b798c628`). |
| 24 825 → 24 826 | 2026-08-31 20:10 | 2026-08-31 21:05 | 56 m | Unattributed. |
| 26 069 → 26 070 | 2026-09-01 20:33 | 2026-09-01 21:22 | 49 m | Unattributed. |
| 31 078 → 31 079 | 2026-09-05 15:51 | 2026-09-05 16:37 | 46 m | Unattributed. |

Hypothesis (not verified): part of the unattributed stalls may be hashrate collapses rather than node downtime — the miner reconnect bug fixed on 2026-09-20 (`run_v3_trinity_session` never propagated a dropped pool connection, so a miner could hash offline indefinitely with `reconnects=0`) would produce exactly this pattern. There are no logs left to confirm it.

## 4. Service-level availability (partial window, Prometheus)

Evaluated at the window end over the 8.45 days of data that still exist (`avg_over_time(up[9d])`).

| Target | `up` ratio | Downtime equivalent |
|---|---|---|
| Host (`node_exporter`) | 99.998 % | ~15 s |
| Pool HTTP API (`zion_v31_pool`, 10 s scrape) | **98.39 %** | ~3.3 h |
| WARP BTC-swap metrics | 100 % | — (only since 2026-09-20) |

Pool API downtime is spread over 723 short minute-level failures (longest 9 min, 2026-09-21 07:50Z), consistent with the single-threaded pool HTTP API freeze that was diagnosed and fixed on 2026-09-27 (per-connection threads + socket timeouts). This measures the monitoring API, **not** stratum; stratum availability was never measured.

## 5. Incidents in the window

| Date | Incident | Class |
|---|---|---|
| 2026-09-21 | Node restart → watchdog restart loop during rebuild → 2 h 23 m chain stall + balance/network API outage (web fix `642bb2092` returns 503 instead of fake 0) | **Availability — breaks the 99.9 % budget** |
| 2026-09-20 | WARP BTC-swap safety hold: public offer endpoint allowed unquoted BTC/ZION offers. Disabled before any swap was active; hardening deployed. | Security finding, no funds lost, not an uptime event |
| 2026-09-20 | Pool telemetry counters broken + miner reconnect bug (miner hashing offline forever) | Monitoring / mining correctness |
| 2026-08-30 → 2026-09-18 | 14 further stalls of 30–83 min (§3) | Unattributed |

Note: the pool wedges of 2026-09-27 (bridge-lock regression from Edge tree drift) are **after** the window and do not count against run #1, but they would have broken a run in progress.

## 6. Verdict

- **G8 run #1 does not pass.** The 30 days elapsed, but the measured uptime is below 99.9 % on every reasonable definition, and there is a confirmed multi-hour availability incident inside the window.
- `/api/g8` `"completed"` should be read as "window elapsed", not "gate passed".

## 7. Before starting run #2 (recommended)

1. **Measure what the gate measures.** Add blackbox/HTTP probes to Prometheus for node RPC (`getStatus`), multichain `/health`, DAO `/health`, ZIS `/health`, stratum TCP connect, plus a chain-tip-age alert (no block for > 15 min).
2. **Keep the evidence for the whole run.** Raise Prometheus retention to ≥ 35 d (`--storage.tsdb.retention.time=35d` in `/etc/default/prometheus` `ARGS`), and either lower pool log level or raise the journald cap so 30 days of service logs survive.
3. **Populate `g8_run.json` automatically** (uptime from Prometheus, incidents list) instead of leaving `null` / `[]`.
4. **Remove the 55-minute restart cliff.** Any single node restart currently costs more than the whole 43-minute budget. Persist a UTXO snapshot (or skip signature re-verification when replaying the node's own DB), and never restart all three nodes at once.
5. **Reconcile the Edge build tree** (`/opt/zion/V31` is dirty and behind `main`) so the 2026-09-27 pool fixes cannot regress on the next rebuild.
6. Then restart the clock. Starting run #2 and writing `g8_run.json` on Edge is an operator decision and was **not** done as part of this report.

---

*Measured 2026-09-28 by Devin with read-only queries (SQLite `mode=ro`, Prometheus HTTP API). No production state was modified.*
