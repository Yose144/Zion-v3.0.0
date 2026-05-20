# ZION V3 — Mainnet Launch Dashboard 4.0

A **zero-dependency**, autonomous, intuitive **command center** for the entire ZION V3 mainnet stack — designed so **a kid can use it but a pro can master it**.

## What's new in 4.0 (2026-05-20)

- **🎛️ Controls tab overhaul** — 4 large action cards (Launch Full Stack, Open Terminal, Install/Build, Stop All) with strong visible gradients + individual service grid
- **📦 Install / Build** — One-click dependency check: Rust, cargo, npm, Docker, then builds V3 release. Live log polling every 2s.
- **🖥️ Open Terminal** — Opens 4 visible PowerShell windows tailing node1/node2/pool/miner logs; auto-close after 5 min of inactivity
- **🧱 Genesis & Premine tab** — Canonical on-chain data: 144B supply, 16.28B premine (12 outputs), Decade Decay, fee split 89/5/5/1
- **🔥 P0 Blockers tab** — 10 launch blockers with severity, owner, deadline, status; `ready_for_launch` boolean
- **🚀 Launch reliability** — `launch-stack` and `launch-full` automatically stop existing node/server/miner processes before starting new ones so ports are never blocked
- **👁️ UI visibility fixes** — `switchTab('overview')` on startup; stronger panel/button contrast (removed glassmorphism orbs that caused transparency bugs)
- **📊 Auto-refresh** — 3s polling with toast feedback; launch actions show "may take ~15s" hint and auto-refresh Overview after 12s

## What's new in 3.0

- **🧩 Full Service Registry** — 13 services across L1 (Consensus), L2 (Bridge/DAO/Swap), L3 (WARP/NCL/AI), L4 (OASIS), and Infrastructure (Prometheus/Grafana)
- **🩺 Real-time health checks** — TCP port probes + log-mtime fallback, cached 5s, parallelized by background sampler
- **🗄️ Database Explorer** — Read-only inspector for both SQLite databases (Pool PPLNS, Bridge, DAO, WARP) and JSON state files (Node state) with table schema + sample rows
- **📊 Prometheus Metrics Scraper** — Direct scrape of `/metrics` endpoints for any service, parsed into key/value display
- **📈 Embedded Grafana** — Live iframe of Grafana dashboards inside the UI, with one-click "Start Monitoring" if not running
- **🧒 Kid Mode / Pro Mode** — Toggle between plain-language explanations ("⚡ The pool helps lots of computers work together!") and technical descriptions
- **🚀 Launch FULL Stack** — One-click button starts core (Node1+Node2+Pool+Miner) AND monitoring (Prometheus+Grafana via Docker)
- **🧵 Threading HTTP server** — Parallel request handling for instant UI even with slow probes

## All Services

| Layer | Service | Icon | Ports | Purpose |
|-------|---------|------|-------|---------|
| L1 | Node 1 (Genesis) | 🔷 | p2p 8333, rpc 8443, ws 8445, metrics 9115 | Chain truth |
| L1 | Node 2 (Follower) | 🔶 | p2p 8334, rpc 8446, ws 8447 | Backup/sync |
| L1 | Mining Pool | ⚡ | stratum 8444, metrics 9550 | Share coord + payouts |
| L1 | GPU Miner | ⛏️ | — | PoW hashing |
| L2 | ZION Bridge | 🌉 | api 8550, metrics 9551 | Cross-chain relay |
| L2 | ZION DAO | 🗳️ | api 8560, metrics 9552 | Governance |
| L2 | Atomic Swap | 🔄 | api 8570, metrics 9553 | HTLC swaps |
| L3 | WARP Relay | 🌀 | api 8580, metrics 9554 | Multi-chain msgs |
| L3 | NCL Gateway | 🧠 | api 8590 | Compute fabric |
| L3 | AI Native (Hiran) | 🤖 | api 8002 | LLM inference |
| L4 | OASIS Avatar Hub | 🪷 | api 8600 | Avatar registry |
| Infra | Prometheus | 📊 | web 9090 | Metrics store |
| Infra | Grafana | 📈 | web 3000 | Dashboards |

## API Reference (full)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | HTML dashboard |
| `/api/status` | GET | Parsed live state (core services) |
| `/api/services` | GET | **All 13 services + health** |
| `/api/checklist` | GET | 10-point readiness score |
| `/api/alerts` | GET | Auto-detected alerts |
| `/api/history` | GET | Sampled metrics for charts |
| `/api/events` | GET | Block discovery events |
| `/api/env` | GET | List `.env*` files |
| `/api/env/load?name=` | GET | Parsed env w/ redaction |
| `/api/db` | GET | **List all databases** |
| `/api/db/inspect?path=` | GET | **Inspect DB tables/JSON** |
| `/api/metrics/<service>` | GET | **Scrape Prometheus metrics** |
| `/api/controls` | GET | Whitelisted actions |
| `/api/control` | POST | Execute action |
| `/api/logs/<service>` | GET | Log tail |
| `/api/genesis` | GET | Constants + premine outputs (12) |
| `/api/blockers` | GET | P0 launch blockers + `ready_for_launch` |
| `/api/install/log` | GET | Live install-deps build log |

## Control Actions (whitelisted)

```
launch-full        — Core stack + monitoring (one-click everything)
launch-stack       — Core only (node1 + node2 + pool + miner)
stop-all           — Stop everything
stop-stack         — Stop core only
start-node1
start-node2 / restart-node2
start-pool
start-miner / restart-miner
open-terminal      — Open 4 visible PowerShell windows tailing all logs
install-deps       — Check Rust, cargo, npm, Docker; build V3 release
start-monitoring   — Prometheus + Grafana via Docker
stop-monitoring
start-prometheus / start-grafana  (alias to start-monitoring)
```

## Database Explorer

| Database | Type | Service |
|----------|------|---------|
| `zion-node-state.db` | JSON | node1 |
| `zion-node2-state.db` | JSON | node2 |
| `V3/data/pool.db` | SQLite | pool |
| `V3/data/bridge.db` | SQLite | bridge |
| `V3/data/dao.db` | SQLite | dao |
| `V3/data/warp.db` | SQLite | warp |

**Whitelisted paths only.** Read-only access. SQLite opened with `mode=ro`.

## Quick Start

```powershell
# Launch dashboard
dashboard\start-dashboard.ps1

# From the dashboard UI, click "🚀 Launch ALL" to start:
#   - Node 1 + Node 2 (P2P + RPC)
#   - Pool (Stratum + metrics)
#   - GPU Miner
#   - Prometheus (collects all metrics)
#   - Grafana (dashboards at http://localhost:3000)
```

## Tabs

1. **📊 Overview** — Service cards, checklist, alerts, mini hashrate, payouts (auto-shown on startup)
2. **🎛️ Controls** — Stack Control Center: Launch Full Stack, Open Terminal, Install/Build, Stop All + individual service grid
3. **📈 Charts** — Hashrate, height, shares, sessions (Chart.js, last 10 min)
4. **🧱 Events** — Block discovery feed
5. **⚙️ Env** — Env file viewer with sensitive redaction
6. **🧙 Wizard** — 7-step guided launch
7. **🧩 Services** — All 13 services with health, ports, descriptions
8. **🗄️ Database** — DB explorer (SQLite + JSON)
9. **📊 Metrics** — Prometheus scraper + Grafana iframe
10. **📜 Logs** — All 4 core service log tails
11. **⚡ Genesis** — Canonical premine data: 144B supply, 16.28B premine (12 outputs), Decade Decay, fee split
12. **🔥 Blockers** — P0 launch blockers with severity, owner, deadline, status and `ready_for_launch` boolean

## Friendly Mode

Click 🧒 **Kid Mode** in the header — service descriptions switch to:
- 🔷 *"This is the boss — it remembers every block ever made."*
- ⚡ *"The pool helps lots of computers work together to find blocks!"*
- 📊 *"A super-memory that remembers all the numbers!"*

Click 🧑‍💻 **Pro Mode** to switch back to technical descriptions.

## Architecture

```
dashboard/app.py (~1600 LOC)
├── SERVICE_REGISTRY      13 services with metadata (purpose, ports, icons, child_says)
├── HEALTH_CACHE          TCP probe + log-mtime fallback (5s TTL)
├── DB_LOCATIONS          whitelist of inspectable databases
├── scrape_metrics()      Prometheus text format parser
├── inspect_database()    SQLite read-only + JSON state inspector
├── MetricsHistory        ring buffer (5s sampling, 10 min retention)
├── BLOCK_EVENTS          deque of detected blocks
├── background_sampler    thread: status + events + health pre-warm
├── build_alerts          9 heuristic alert generators
├── run_control           whitelisted PowerShell action dispatcher
└── ThreadingHTTPServer   parallel request handling
```

## Requirements

- Python 3.10+ (only stdlib: `http.server`, `sqlite3`, `subprocess`, `socket`)
- Docker (only for Prometheus/Grafana monitoring stack)
- PowerShell scripts in `scripts/` for native Windows control

## Security

- Bound to `127.0.0.1` only
- All actions whitelisted (no arbitrary shell exec)
- All DB paths whitelisted (no path traversal)
- Sensitive env values redacted in API
- SQLite opened with `mode=ro`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Overview/Controls tabs invisible on first load | Hard-refresh (Ctrl+F5) to clear old CSS/JS cache |
| Services tab shows everything DOWN | Click "🚀 Launch ALL" in Controls tab or Services tab header |
| Launch button seems stuck / no new processes | Existing processes are stopped automatically before restart; wait ~15s then check Overview |
| Log windows stay open forever | They auto-close after 5 min of inactivity; close manually if needed |
| Grafana iframe blank | Click "▶ Start Monitoring" — Docker must be running |
| SQLite DBs show "Not yet created" | They're created on first run of the L2/L3 services |
| Slow first probe | Initial probe takes ~2s; subsequent are cached 5s |
| Port 8765 in use | `Get-Process python \| Stop-Process -Force` then restart |
