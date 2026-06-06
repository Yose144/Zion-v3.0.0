# ZION OS Architecture

## Overview

ZION OS is a multi-component operations system that unifies monitoring, control, and deployment for the ZION Mainnet Edge infrastructure. It follows an **Edge-first, agent-centric** design.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ZION OS v2.0.0                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
│  │   Desktop    │    │    Mobile    │    │   Browser    │         │
│  │  (Tauri v2)  │    │(React Native)│    │  (Next.js)   │         │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘         │
│         │                   │                   │                 │
│         └───────────────────┼───────────────────┘                   │
│                             │                                       │
│         ┌───────────────────┴───────────────────┐                   │
│         │         Unified Dashboard             │                   │
│         │         (Axum, port 8888)             │                   │
│         │  ┌────────┐┌────────┐┌────────┐       │                   │
│         │  │  Node  ││  Pool  ││  DAO   │       │                   │
│         │  │ Proxy  ││ Proxy  ││ Proxy  │       │                   │
│         │  └────────┘└────────┘└────────┘       │                   │
│         └───────────────────┬───────────────────┘                   │
│                             │                                       │
│         ┌───────────────────┴───────────────────┐                   │
│         │            Agent (port 8767)          │                   │
│         │  - Telemetry collector                │                   │
│         │  - Miner control (start/stop/restart) │                   │
│         │  - Watchdog rules                     │                   │
│         └───────────────────┬───────────────────┘                   │
│                             │                                       │
│  ┌──────────────────────────┴──────────────────────────────────┐   │
│  │                    V3 Mainnet Stack                         │   │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐           │   │
│  │  │  Node  │  │  Pool  │  │  DAO   │  │  WARP  │           │   │
│  │  │ 8443   │  │ 8444   │  │ 8450   │  │ 8453   │           │   │
│  │  └────────┘  └────────┘  └────────┘  └────────┘           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Design

### dashboard/unified (Port 8888)

**Purpose:** Single pane of glass for all Edge infrastructure.

**Backend (Rust/Axum):**
- `GET /api/infra` — Aggregated health check (node, pool, dao, warp, agent, website)
- `GET /api/node` → proxies to `http://127.0.0.1:8443/health`
- `GET /api/dao` → proxies to `http://127.0.0.1:8450/health`
- `GET /api/warp` → proxies to `http://127.0.0.1:8453/health`
- `GET /api/agent` → proxies to `http://127.0.0.1:8767/api/status`
- `POST /api/agent/miner/:action` → proxies miner control commands
- `GET /api/rigs` — Fleet rig registry (from persisted state.json)
- `GET /ws/live` — WebSocket broadcast for real-time updates

**Frontend (Vanilla JS):**
- No build step — raw HTML/CSS/JS served by Axum `ServeDir`
- Infra panel: service cards + latency table + agent controls
- Rig panel: fleet management, flight sheets, batch operations
- Pool panel: stats from pool `/stats` endpoint
- Wallet panel: earnings estimates based on hashrate

**Upstream Configuration (env vars):**
```bash
ZIONOS_BIND=0.0.0.0:8888
ZIONOS_NODE_RPC=http://127.0.0.1:8443
ZIONOS_POOL_METRICS=http://127.0.0.1:8444
ZIONOS_DAO_API=http://127.0.0.1:8450
ZIONOS_WARP_API=http://127.0.0.1:8453
ZIONOS_AGENT_API=http://127.0.0.1:8767
```

---

### agent (Port 8767)

**Purpose:** Rig lifecycle manager — runs on every mining machine.

**Modules:**
- `api.rs` — HTTP handlers (`/health`, `/api/status`, `/api/miner/*`)
- `miner_ctl.rs` — Spawns/stops `zion-miner` process (CPU, OpenCL, CUDA, Metal)
- `telemetry.rs` — Collects system metrics (CPU, memory) + GPU telemetry
- `watchdog.rs` — Evaluates rules, triggers actions (restart miner on failure)
- `gpu_telemetry/` — AMD (sysfs) + NVIDIA (NVML) GPU probes

**Configuration:**
```toml
rig_id = "zion-edge-hetzner"
api_bind = "0.0.0.0:8767"
autonomous_mode = true
auto_start_miner = false

[miner]
binary_path = "/usr/local/bin/zion-miner"
default_pool = "127.0.0.1:8444"
default_gpu_backend = "cpu"
extra_args = ["--threads", "2"]

[watchdog]
enabled = true
check_interval_sec = 60
```

---

### infra/ (Deployment Automation)

**Scripts:**
- `deploy-edge.sh` — Full stack deploy (V3 + web + agent + dashboard)
- `autopilot-v3.sh` — 4-phase pipeline: preflight → sync → build → verify

**Systemd Services:**
- `zion-edge-node1.service` — Primary node
- `zion-edge-node2.service` — Follower node
- `zion-edge-pool.service` — Mining pool
- `zion-edge-dao.service` — DAO daemon
- `zion-edge-warp.service` — WARP relay
- `zion-edge-miner.service` — CPU miner (with `--cpu` flag)
- `zion-edge-agent.service` — Rig agent
- `zion-edge-dashboard.service` — Unified dashboard
- `zion-edge-watchdog.service` — Health monitor (2-minute timer)

---

## Data Flow

```
User → Dashboard (8888) → Agent (8767) → Miner process
                │
                ├→ Node (8443) → health / RPC
                ├→ Pool (8444) → stats / metrics
                ├→ DAO (8450) → proposals / treasury
                └→ WARP (8453) → transfers / status
```

1. Dashboard polls all upstreams every 5s via `fetchAll()`
2. Agent pushes telemetry every 30s (when enabled)
3. Watchdog evaluates rules every 60s
4. WebSocket `/ws/live` broadcasts share events + rig actions

---

## Security Model

- Dashboard POST endpoints require `ZIONOS_CONTROL_TOKEN` (optional)
- Agent runs as `root` (required for miner process control)
- Dashboard serves static files + API — no SSR, no secrets in frontend
- All upstreams bind to `127.0.0.1` except Node P2P and Pool Stratum

---

## Error Handling Strategy

1. **Upstream unreachable** — Dashboard shows "OFFLINE" in infra panel, does not crash
2. **Agent miner spawn failure** — Watchdog retries with cooldown, logs to journald
3. **Pool stats endpoint down** — Dashboard falls back to cached data
4. **Dashboard crash** — systemd `Restart=always`, state persisted to `state.json`

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend | Rust + Axum | Performance, type safety, async |
| Frontend | Vanilla JS + HTML/CSS | Zero build step, fast iteration |
| HTTP Client | reqwest | Async, built-in JSON, timeout support |
| State | `state.json` (serde) | Simple, no external DB dependency |
| Process Control | tokio::process | Async miner spawn/kill |
| Metrics | sysinfo | Cross-platform system telemetry |
| GPU | sysfs (AMD), NVML (NVIDIA) | Native, no runtime dependencies |
