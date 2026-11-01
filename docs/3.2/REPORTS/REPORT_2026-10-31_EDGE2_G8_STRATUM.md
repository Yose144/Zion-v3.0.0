# REPORT — EDGE2 G8 stratum false-fail + stale run #3

> **Datum:** 2026-10-31T15:16Z · **Host:** EDGE2 (`vmi3684458`)

## Problem

1. `zion-g8-probe` on EDGE2 defaulted `G8_STRATUM_HOST=127.0.0.1:8444`, but
   stratum listens only on EDGE. Result: **`pool_stratum=0` permanently** while
   `pool_http=1` (tunneled `:8080`).
2. `/data/zion/g8_run.json` on EDGE2 still held **failed run #3**
   (`g8-20261010T063655Z`, uptime ~94.8 %) from 21. 10. — not the gate authority
   (canonical run #6 is on EDGE).

## Fix (deployed)

| Change | Detail |
|---|---|
| Drop-in | `/etc/systemd/system/zion-g8-probe.service.d/10-edge2-stratum.conf` → `G8_STRATUM_HOST=62.171.141.136` `G8_STRATUM_PORT=8444` |
| Repo | [`V31/deploy/systemd/zion-g8-probe.service.d/10-edge2-stratum.conf`](../../../V31/deploy/systemd/zion-g8-probe.service.d/10-edge2-stratum.conf) |
| Probe doc | `scripts/ops/g8_probe_exporter.py` env note |
| Archive | `/data/zion/archive/g8_run.run3-MOVED-*.json` + `/data/zion/G8_EDGE2_NOTE.txt` |
| Restart | `zion-g8-probe` (metrics-only — does **not** touch EDGE run #6) |

TCP from EDGE2 → EDGE `:8444` was already open; no tunnel change required.

## Verify

```
Environment=… G8_STRATUM_HOST=62.171.141.136 G8_STRATUM_PORT=8444
zion_g8_probe_success{service="pool_stratum"} 1
```

Gate remains: EDGE `/data/zion/g8_run.json` → `g8-20261029T234617Z`.
