# ZION V3 Dashboard — API Endpoints

## Base URL
```
http://127.0.0.1:8766
```

## Core Status & Config

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Full service status (node, pool, miner, edge) |
| `/api/v2/status` | GET | Batch endpoint for v2 dashboard (status + checklist) |
| `/api/v2/batch` | POST | Batch endpoint for v2 dashboard |
| `/api/config` | GET | Current dashboard config (read-only) |
| `/api/checklist` | GET | Launch readiness checklist |
| `/api/alerts` | GET | Current active alerts |
| `/api/alerts/history` | GET | Historical alerts (from alert-history.json) |
| `/api/history` | GET | Metrics history samples |
| `/api/events` | GET | Block events (last 30) |
| `/api/blockers` | GET | P0 launch blockers |
| `/api/mainnet-status` | GET | Mainnet readiness status |

## Services & Controls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/services` | GET | All services health status |
| `/api/readiness` | GET | Overall readiness score |
| `/api/service-history` | GET | Service health history buckets |
| `/api/controls` | GET | Available control actions |
| `/api/controls/<action>` | POST | Execute control action (start/stop/restart) |
| `/api/watchdog/toggle` | POST | Toggle watchdog auto-restart |
| `/api/processes` | GET | Process registry snapshot |

## Logs & Terminal

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/logs/rotate` | POST | Rotate all log files |
| `/api/logs/stream` | GET | SSE live log streaming (`?svc=node1&lines=200`) |
| `/api/log-files` | GET | List all log files with size + mtime |
| `/api/log-search` | GET | Search across all log files (`?q=error`) |
| `/api/terminal/open` | GET | Open native terminal window (`?svc=node1`) |
| `/api/logs/<svc>` | GET | Get service log tail (`?lines=100`) |

## Resources & Monitoring

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/resources` | GET | CPU, RAM, disk usage |
| `/api/monitoring/status` | GET | Monitoring system status |
| `/api/metrics/scrape` | GET | Scrape Prometheus metrics (`?svc=node1`) |
| `/api/metrics/collector` | GET | Read metrics.json from Rust collector |

## Environment

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/env` | GET | List available env files |
| `/api/env/load` | GET | Load specific env file (`?name=.env.mainnet`) |

## Layer Status (L1-L6)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/layer-status` | GET | Aggregate status for any layer (`?layer=l1`) |

## AI Layer (Hiran v2.2 + Hiranyagarbha)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/hiran/health` | GET | Hiran inference server health (port 8002) |
| `/api/hiran/status` | GET | Combined inference + orchestrator status |
| `/api/hiran/agents` | GET | Agent list from Hiranyagarbha orchestrator |
| `/api/hiranyagarbha/health` | GET | Hiranyagarbha orchestrator health (port 8001) |
| `/api/ncl/submit` | POST | Submit NCL job to Hiranyagarbha |

## L2 Services

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bridge/health` | GET | Bridge service health |
| `/api/swap/health` | GET | Atomic swap service health |
| `/api/swap/initiate` | POST | Initiate atomic swap |

## L3 Services

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/warp/health` | GET | WARP relay service health (port 9333) |

## L4+ Layers (Planned)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/oasis/stats` | GET | OASIS stats (port 8094) |
| `/api/oasis/quests` | GET | OASIS quests |
| `/api/freeworld/stats` | GET | Free World stats |
| `/api/space/stats` | GET | Issobella Space stats |
| `/api/space/missions` | GET | Issobella Space missions |

## Chain & Mining

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mempool` | GET | Mempool details |
| `/api/genesis` | GET | Genesis block info (premine, outputs) |
| `/api/miner/shares` | GET | Miner shares history |

## Topology & Network

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/topology` | GET | Real topology (ping Core+Edge, Tailscale) |

## Launch & Deployment

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/launch/status` | GET | Dependency launch state |
| `/api/launch-day-prepare` | POST | Prepare launch day (stop network, backup) |
| `/api/launch-day-execute` | POST | Execute launch day (rotate genesis, restart) |

## Wallets & Explorer

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wallets` | GET | Wallet status |
| `/api/explorer` | GET | Explorer data |
| `/api/block` | GET | Block details (`?hash=...`) |

## Health Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Simple health check |
| `/api/health` | GET | v2 client health map |

## Static Files

| Route | Description |
|-------|-------------|
| `/` | Dashboard v1/v2 (HTML) |
| `/v3/` | Dashboard v3 (HTML) |
| `/dashboard.js` | v1 JavaScript |
| `/ui.js` | v1 UI JavaScript |
| `/api.js` | v1 API JavaScript |
| `/assets/*` | v2 SPA assets |
| `/v3/*` | v3 static files |

## SSH Edge Server Status

**Current Status:** ❌ SSH connection failed (permission denied)

**Edge Server Details:**
- Public IP: `77.42.71.94`
- VPN IP: `100.76.16.108` (Tailscale)
- SSH Keys tested:
  - `~/.ssh/zion_hetzner_key` ❌
  - `~/.ssh/zion_mainnet_key` ❌

**To fix SSH:**
1. Verify correct SSH key for Edge server
2. Add key to Edge server's `~/.ssh/authorized_keys`
3. Test: `ssh -i <correct_key> root@77.42.71.94`

**Alternative:** Use Tailscale SSH if Tailscale is installed:
```bash
tailscale ssh root@100.76.16.108
```

## Port Summary

| Service | Port | Protocol |
|---------|------|----------|
| Dashboard | 8766 | HTTP |
| Node P2P | 8333 | TCP |
| Node RPC | 8443 | TCP |
| Pool Stratum | 8444 | TCP |
| Pool Metrics | 8455 | HTTP |
| Hiran API | 8001 | HTTP |
| Hiran Inference | 8002 | HTTP |
| WARP | 9333 | HTTP |
| OASIS | 8094 | HTTP |
