# ZION V3 — Mainnet Launch Dashboard

A zero-dependency, live HTML dashboard for monitoring the ZION V3 mainnet launch stack on Windows 11.

## Features

- **Service Cards** — Live status for Node 1, Node 2, Pool, and GPU Miner
- **Chain Metrics** — Block height, tip hash, peer count, sync status
- **Mining Stats** — Hashrate (KH/s), GPU backend, device, shares A/R
- **Launch Checklist** — 10-point readiness tracker with auto-detection
- **Payout Monitor** — Pool wallet, fee split (89/5/5/1), recent payout events
- **Live Log Tails** — Real-time pool & miner log streaming
- **Env Quick-Ref** — One-click copy for required environment variables
- **Auto-Refresh** — Polls every 3 seconds; toggle on/off

## Quick Start

```powershell
# From repo root
dashboard\start-dashboard.ps1
```

Or manually:

```bash
python dashboard/app.py
# Then open http://127.0.0.1:8765 in your browser
```

## Requirements

- Python 3.10+ (already installed on W11 dev boxes)
- Log files in `../logs/` (auto-created if missing)
- No pip packages — uses only Python stdlib

## How It Works

`app.py` runs a tiny `http.server` on `127.0.0.1:8765`. It:

1. Parses the **first 50 lines** of each log for startup config (static values)
2. Parses the **last 200-300 lines** for runtime metrics (dynamic values)
3. Serves a single-page dashboard with embedded Tailwind CSS + vanilla JS
4. Exposes JSON API endpoints for external consumption:
   - `/api/status` — full parsed state
   - `/api/checklist` — readiness score
   - `/api/logs/<service>` — tail of a log file (`node1`, `node2`, `pool`, `miner`)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 8765 in use | `Get-Process python \| Stop-Process -Force` then restart |
| Dashboard shows all DOWN | Verify `../logs/*.log` exist and are writable |
| node2 shows no peers | Node2 log format differs; check `discovery_connect_ok` lines |
| hashrate seems wrong | Dashboard uses the most recent `speed 10s/60s/15m` line; verify miner is running |

## File Layout

```
dashboard/
  app.py                 — Python stdlib HTTP server + log parsers + HTML
  start-dashboard.ps1    — One-click Windows launcher (kills orphans, opens browser)
  README.md              — This file
```
