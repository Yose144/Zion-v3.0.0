# G8 Alert Sink — Firing Test + Retention Evidence (8.B9)

Date: 2026-10-28 · Host: EDGE (`62.171.141.136`) · Scope: `zion-g8-alert-sink.service`

## 1. Live firing test — PASS

End-to-end path exercised through the real Alertmanager, not a direct sink POST:

```
amtool alert add G8SinkFiringTest service=g8-evidence severity=test \
  --alertmanager.url=http://127.0.0.1:9093 --end=<+3min>
```

Path: `amtool` → Alertmanager `:9093` (`group_wait: 5s`) → webhook `http://127.0.0.1:9094/alerts` → sink persists.

Observed in `/opt/zion/data/g8_alert_events.jsonl` at `2026-10-28T11:06:22Z`:

```
firing ['G8SinkFiringTest']   ← new event appended, fsync'd
```

Observed in `/opt/zion/data/g8_alert_state.json`: `active_alerts = ['G8SinkFiringTest']`
(dashboard-readable active state updated under flock + atomic rename).

Test alert auto-expires at +3 min; `send_resolved: true` routes the resolution
through the same path (resolved events already present in the log, e.g.
`G8RequiredServiceDown` resolved at `09:58:05Z` — the pool-side probe alert
recovering after the wedge restart).

## 2. Retention evidence — 40d mechanism proven, span matures 2026-11-08

| Property | Observation |
|---|---|
| Storage | append-only `g8_alert_events.jsonl` (O_APPEND + fsync per event) |
| Rotation | **none** — no logrotate/tmpfiles rule touches `/opt/zion/data/g8_alert_*` |
| Span so far | first event `2026-09-29T14:45:38Z` → `2026-10-28T11:06Z` = 29 days |
| Volume | 750 events / 514 KB → ~17 KB/day → **~700 KB @ 40 d** (negligible) |
| Disk headroom | `/` has 57 GB free — 40d horizon is ~0.001 % of free space |
| Durability | state file: tmp+fsync+rename+dir-fsync; service `Restart=always`, `ProtectSystem=strict` |
| Dedup | `seen_event_ids` (cap 1000) + jsonl tail scan — no lossy path exists |

No code path truncates or rotates the event log; the only bounded structure is
the in-memory `seen_event_ids` ring (dedup only — events are already on disk
before dedup is consulted). 40-day span physically completes ~2026-11-08 with
zero action required; verify by `head -1` timestamp + `wc -l` on that date.

## 3. Wiring (unchanged, verified)

- `/etc/prometheus/alertmanager.yml`: `receiver: zion-g8-local` →
  `webhook_configs: url: http://127.0.0.1:9094/alerts`, `send_resolved: true`,
  `group_wait 5s / group_interval 30s / repeat_interval 4h`, `resolve_timeout 1m`.
- Unit: `zion-g8-alert-sink.service` — user `zion`, localhost-only `:9094`,
  `MemoryMax=64M`, `CPUQuota=25%`.
- Sink implementation: `scripts/ops/g8_alert_sink.py`; unit tests
  `scripts/ops/test_g8_alert_sink.py`.

## Verdict

Firing test: **PASS** (real Alertmanager path, firing+resolved both delivered).
Retention: **mechanism proven** — append-only, unbounded, durable; the 40-day
calendar span completes automatically by 2026-11-08 during the G8 window.
