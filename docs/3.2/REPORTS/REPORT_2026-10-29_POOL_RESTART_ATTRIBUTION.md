# Report — Pool restart attribution: no external stop-loop exists (2026-10-29 ~19:15 CET)

## Incident hypothesis (from `POOL-HEROMINERS-PARITY-PLAN.md` ops notes)

"Repeated clean `systemctl stop` ~15 min cadence traced to an EXTERNAL host —
SSH key `zion-edge-post-wipe-2026-07-29` from `109.81.23.46` (operator PC,
674+ logins/day). OPEN: find and kill the source process on the operator
workstation."

**Verdict: hypothesis disproven.** The key and IP belong to `zionserver`
(this ops box), but nothing here issues `systemctl` over SSH. The
correlation was an artifact: this host logs into EDGE every ~70 s
unconditionally, so *any* pool event lands within seconds of an auth entry.

## What actually generates the login flood (942/day)

`vastctl-daemon.service` (user systemd on zionserver):

```
vastctl.py daemon --interval 60 \
  --push zion-new:/var/www/zion-maintenance/vast-rigs/status.json
```

Each cycle performs **2 SSH operations** — `scp` to `.tmp` then `ssh mv` —
matching the observed auth.log pattern exactly (pairs ~2 s apart, ~70 s
cadence). Legit fleet-status push; noisy but harmless. Optimization option:
fold `scp`+`mv` into one `ssh` (stdin redirect) or a ControlMaster socket
to halve sshd churn.

## All 30 pool `Stopping` events today — attribution

From `journalctl -u zion-v31-pool` + watchdog journal + build IDs on
`Started` lines:

| Window | Source | Evidence |
|---|---|---|
| 10:32, 10:53, 11:25, 12:46 | **EDGE `zion-v31-watchdog` — real wedges** of the old `6fae7b60d2b5-dirty` build | watchdog journal: `WARN pool API /stats unresponsive fail 1/2` ×4 then `RESTART: pool TCP 127.0.0.1:8444 not reachable` — the pre-M3 `pool.lock()` convoy wedge (Oct-28 RCA) |
| 12:46–18:47 (~15×) | **Deploy iterations** | every stop followed within seconds by `Started … (build <id>)`: `8a32fae94` → `c95ca3437` (v13 deploy) → `dedup-telem-1239` → `c95ca3437a06-dirty` → `77756ee6647c` → `cc589d926` → `d8190009783c-dirty` (M3 phase 2) |
| 01:10:56 + 01:11:15 (double), 01:30, 03:41, 04:23 | **Unattributed precisely** — no SSH auth entries in the surviving log window, watchdog logged `OK` at the same minute | irregular gaps (16 s, 19 min, 2 h 11 m, 42 min) argue against any periodic loop; consistent with manual/held-session restarts of the same build. All clean drains — benign pattern |

## Exhaustive audit of zionserver (the "suspect" host)

- User timers: `zion-backup-beacon` (15 s, HTTPS POST only),
  `zion-miner-watchdog` (60 s, local process checks + HTTPS beacon),
  `zion-watchdog backup` (5 min, local user-services + TCP probes via
  existing tunnel — **never opens SSH**), `zion-offsite-sync` (hourly),
  `zion-backup` (daily 03:30).
- Only outbound SSH: `vastctl-daemon` push (scp/mv), `pull-edge-backups.sh`
  (hourly rsync at :07), three persistent `-N` tunnels, interactive/agent
  commands.
- **No ControlMaster** (`~/.ssh/cm` empty, no `ControlPath` in config) —
  every ssh invocation produces an auth.log entry; hidden remote commands
  are impossible from here.
- EDGE side: no tmux/screen loops; `zion-pool-wedgewatch.sh` is read-only
  diagnostics (thread dumps on wedge). EDGE2 `pool-ha-watchdog` is
  **alert-only** (Telegram; explicitly never stops/starts). EDGE2
  `zion-edge-watchdog` supervises EDGE2-local services only.

## Operational corrections

1. **Update the parity-plan ops note** — the "external stop source" is
   resolved as: real wedges of the pre-M3 build healed by EDGE watchdog +
   deploy churn. Nothing to kill.
2. **Root cause of the wedges** = the Oct-28 `pool.lock()` convoy — being
   fixed by M3 lock sharding (`cc589d926` phase 1 live, `d8190009783c-dirty`
   phase 2 in canary since 18:47). Watchdog restarts since the M3-p2 deploy:
   **0** (as of 19:0x) — keep monitoring.
3. **Telemetry noise**: `vastctl-daemon` could reuse a persistent
   connection instead of 2 fresh SSH logins/min — reduces sshd noise that
   complicates exactly this kind of incident triage.
4. Overnight unattributed stops: benign (clean drains, same build); if a
   hidden actor concerns us, enable `sshd` `LogLevel VERBOSE` + auditd
   execve on `systemctl` for one night.

## Side observations

- Local backup node (`zion-backup-node`) is **synced**: height 101294,
  tip tracking live.
- EDGE → EDGE2 probe loop exists (`ssh edge2-probe systemctl is-active
  zion-l1-watcher`) — EDGE monitors the market watcher; symmetric to
  EDGE2 → EDGE probes. Both benign.
- auth.log rotation ate pre-05:21 entries — overnight SSH attribution is
  bounded by rotated-file availability (`auth.log.1*`), which is why the
  01:xx–04:xx stops can't be source-pinned exactly.
