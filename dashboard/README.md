# ZION V3 — Mainnet Launch Dashboard 2.0

A **zero-dependency**, autonomous, intuitive live HTML dashboard for monitoring **and controlling** the ZION V3 mainnet launch stack on Windows 11.

## What's new in 2.0

- **🎛️ Tabbed UI** — Overview · Controls · Charts · Events · Env · Wizard · Logs
- **🚀 Stack Control Center** — One-click launch/stop full stack + per-service start/restart buttons (executes PowerShell scripts via `POST /api/control`)
- **📈 Live Charts (Chart.js)** — Hashrate, chain height (Node1 vs Node2), shares accepted/rejected, sessions & peers (in-memory ring buffer, 5s sampling, last 10 min)
- **🚨 Alerts & Recommendations** — Auto-detects: stuck chain, node drift, wrong fee split, payouts disabled, low nonce window, low hashrate, share rejection rate, log errors. Each actionable alert has a **Fix** button that triggers a control action.
- **🧱 Block Events Feed** — Real-time stream of `relay_block` and `BLOCK_FOUND` events parsed from logs, color-coded by source.
- **⚙️ Env File Viewer** — Lists all `.env*` files, validates required variables, **redacts sensitive values** (`*PRIVKEY*`, `*SK_HEX*`), highlights missing required vars.
- **🧙 Launch Wizard** — 7-step guided flow with status detection per step and quick-action buttons.
- **📈 Mini hashrate sparkline** in the overview tab.
- **Toast notifications** for control actions.

## Quick Start

```powershell
# From repo root
dashboard\start-dashboard.ps1
```

Or manually:

```bash
python dashboard/app.py
# Opens http://127.0.0.1:8765 automatically
```

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | HTML dashboard |
| `/api/status` | GET | Parsed live state of all services |
| `/api/checklist` | GET | 10-point readiness score |
| `/api/alerts` | GET | Auto-detected alerts & recommendations |
| `/api/history` | GET | Last ~10 min of sampled metrics for charts |
| `/api/events` | GET | Recent block discovery / relay events |
| `/api/env` | GET | List of `.env*` files in repo root |
| `/api/env/load?name=<file>` | GET | Parsed contents of an env file (with redaction) |
| `/api/controls` | GET | List of allowed control actions |
| `/api/control` | POST | Execute action: `{"action": "launch-stack"}` |
| `/api/logs/<service>` | GET | Tail of `node1`/`node2`/`pool`/`miner` log |

## Allowed Control Actions

| Action | Script |
|--------|--------|
| `launch-stack` | `scripts/launch-stack.ps1` |
| `stop-stack` | `scripts/stop-stack.ps1` |
| `start-node1` | `scripts/start-node.ps1` |
| `start-node2` | `scripts/start-node2.ps1` |
| `start-pool` | `scripts/start-pool.ps1` |
| `start-miner` | `scripts/start-miner.ps1` |
| `restart-node2` | `scripts/start-node2.ps1` |
| `restart-miner` | `scripts/start-miner.ps1` |

Control actions are **whitelisted** — only the actions above can be executed; arbitrary script paths are rejected.

## Architecture

```
dashboard/app.py
├── MetricsHistory       ring buffer (deque, max 120 samples, ~10 min)
├── BLOCK_EVENTS         deque of detected block events (last 50)
├── background_sampler   thread polling status & events every 5s
├── parse_*              log parsers (node, pool, miner) — head + tail
├── build_alerts         heuristic alert engine
├── load_env_file        env file viewer with sensitive-value redaction
├── run_control          subprocess executor (whitelisted actions only)
└── DashboardHandler     HTTP server (GET + POST endpoints)
```

The HTML is a single embedded template using:
- **Tailwind CDN** for styling
- **Chart.js 4.4** for live charts
- **Vanilla JS** for state & polling (no framework)

## Requirements

- Python 3.10+ (already on W11 dev box)
- Powerful enough: dashboard runs alongside the mining stack with negligible CPU/RAM
- No pip packages — uses only `http.server`, `subprocess`, `json`, `re`, `deque`

## Security Notes

- Server binds to **127.0.0.1 only** (localhost) — never expose publicly
- Control actions are **whitelisted**; no arbitrary shell execution
- Sensitive env values (`PRIVKEY`, `SK_HEX`) are **redacted** in the API response
- The dashboard does not modify env files (read-only viewer)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 8765 in use | `Get-Process python \| Stop-Process -Force` then restart |
| Charts empty | Wait 15-30s for the background sampler to accumulate samples |
| Control action fails | Check `scripts/*.ps1` exists; allow PowerShell execution policy |
| Sensitive values shown | Update parser to add to `SENSITIVE` set in `load_env_file` |
