# Zion OS — Unified Operations System

> **Version:** 2.1.0 (Canonical Rebuild 2026-06-06)
>
> **Status:** Active — Dashboard + Agent + Infra Dashboard operational

Zion OS is the unified operations layer for the ZION Mainnet. It centralizes monitoring, control, and deployment for all Edge infrastructure — nodes, pools, DAO, WARP, miners, and agents — into a single cohesive platform.

---

## Quick Start

```bash
# 1. Start the primary dashboard (Python, port 8766)
cd ZION_OS/dashboard
python3 app.py

# 2. Start the infrastructure dashboard (Rust/Axum, port 8888)
cd ZION_OS/dashboard/infra
cargo build --release
./target/release/zionos-dashboard

# 3. Build the agent
cd ../../agent
cargo build --release

# 4. Deploy full stack to Edge
bash ../../scripts/autopilot-v3.sh
```

---

## Directory Structure

```
ZION_OS/
├── README.md                    # This file
├── docs/
│   ├── ARCHITECTURE.md          # System architecture & design decisions
│   ├── ROADMAP.md               # Development roadmap
│   └── OPERATIONS.md            # Runbooks & procedures
│
├── dashboard/                   # PRIMARY: Python Flask Mainnet Dashboard
│   ├── app.py                   # Zero-dependency stdlib server (port 8766)
│   ├── dashboard.html           # v1 HTML UI
│   ├── dashboard.js             # v1 JS logic
│   ├── api.js, ui.js, auth.py # Supporting modules
│   ├── routes/                  # API route modules (health, logs, rpc...)
│   ├── services/                # Service helpers
│   ├── services.json            # Service manifest (13 services L1-L4+Infra)
│   ├── nodes.json               # Node detection config
│   ├── data/                    # Runtime data
│   ├── v2/, v3/                 # React SPA variants (optional)
│   ├── MacOS/, Ubuntu/, Windows/ # Platform-specific setup
│   ├── metrics-collector/       # Standalone Rust metrics poller
│   ├── zion-dashboard.service   # systemd unit for Python dashboard
│   └── infra/                   # SECONDARY: Rust/Axum infra health (port 8888)
│       ├── Cargo.toml
│       ├── src/
│       ├── static/              # Vanilla JS frontend (warp.js starfield)
│       └── zion-edge-dashboard.service
│
├── agent/                       # ZION Agent — rig lifecycle manager
│   ├── Cargo.toml               # Independent workspace
│   ├── src/                     # API, miner_ctl, telemetry, watchdog...
│   ├── config/
│   │   ├── edge-agent.toml      # CPU-only Edge config
│   │   └── watchdog-edge.yaml   # Edge watchdog rules
│   ├── systemd/
│   │   └── zion-edge-agent.service
│   ├── build.sh, build.ps1
│   ├── README.md, ROADMAP.md
│   └── Cargo.lock + target/     # Built artifacts
│
├── orchestrator/                # Service orchestration manifest
│   ├── manifest.yaml            # Canonical service definitions (used by app.py)
│   └── orchestrator.py          # Orchestrator logic
│
├── desktop/                     # Tauri v2 desktop dashboard
│   ├── src/                     # React frontend
│   └── src-tauri/               # Rust backend
│
├── infra/                       # Deployment & infrastructure automation
│   ├── systemd/                 # ALL systemd service files (consolidated)
│   ├── scripts/                 # Deploy helpers
│   └── config/                  # Edge environment configs
│
├── mining/                      # Mining integration layer (planned)
├── fleet/                       # Multi-rig fleet management (planned)
└── mobile/                      # React Native mobile app (planned)
```

---

## Active Components

| Component | Status | Port | Language | Notes |
|-----------|--------|------|----------|-------|
| **dashboard/app.py** | Active | 8766 | Python stdlib | Primary command center — 13 services, health, logs, DB explorer, backup, CLI console |
| **dashboard/infra** | Active | 8888 | Rust/Axum + JS | Infrastructure health — upstream proxies to node/DAO/WARP/agent |
| **agent** | Active | 8767 | Rust | CPU/GPU telemetry, miner start/stop, watchdog, OC |
| **desktop** | Planned | — | Tauri v2 | Native desktop dashboard with system tray |
| **mobile** | Planned | — | React Native | iOS/Android monitoring app |
| **fleet** | Planned | — | Rust + React | Multi-rig fleet orchestration |

---

## Edge Server Deployment

All services run on the Edge server (`62.171.141.136`, Contabo VPS):

| Service | Port | Systemd Unit | Role |
|---------|------|-------------|------|
| Node | 8443 | `zion-edge-node1` | Primary P2P + RPC |
| Pool | 8444 | `zion-edge-pool` | Stratum mining pool |
| DAO | 8450 | `zion-edge-dao` | Governance API |
| WARP | 8453 | `zion-edge-warp` | Cross-chain relay |
| Agent | 8767 | `zion-edge-agent` | Rig lifecycle manager |
| Dashboard (Python) | 8766 | `zion-dashboard` | Primary mainnet dashboard |
| Dashboard (Infra) | 8888 | `zion-edge-dashboard` | Unified infrastructure view |
| Website | 3000 | PM2 `zion-website` | Next.js public site |

### Deploy from local machine

```bash
# Full stack deploy
cd scripts
bash autopilot-v3.sh

# Or deploy individual components
bash edge-deploy/deploy-edge.sh --skip-sync --skip-build  # just restart services
```

---

## Architecture Philosophy

1. **Primary dashboard is Python.** `app.py` is the mature, feature-complete command center. Do not replace it.
2. **Infra dashboard is Rust.** Lightweight Axum proxy for infrastructure health — complements, not replaces, the primary dashboard.
3. **Edge-first.** All production services run on Edge (24/7 VPS). Local PC is dev/backup only.
4. **Agent-centric.** Every rig runs an agent that reports telemetry and accepts commands.
5. **Static frontend for infra.** No React bundler for the Rust dashboard — vanilla JS for zero build step.
6. **Rust backend for agent.** Axum + Tokio for async performance.

---

## Legacy Archive

All previous messy ZION_OS code lives in `archive/ZION_OS/` (outside git). See `archive/ZION_OS/README.md` for legacy documentation if needed.

Key legacy components (kept for reference only):
- `archive/ZION_OS/agent/` → old agent (superseded by `/agent`)
- `archive/ZION_OS/dashboard/` → same Python dashboard, but in the messy tree
- `archive/ZION_OS/ZionOSsmos/` → external SMOS fork

---

## Contributing

1. Changes go to the **new** directories (`dashboard/`, `dashboard/infra/`, `agent/`, etc.)
2. Do NOT modify `archive/ZION_OS/` — it is frozen for historical reference
3. Follow existing Rust conventions (Axum handlers, `anyhow` errors, `tracing` logs)
4. Update `docs/ARCHITECTURE.md` when adding new upstream integrations
5. **Never remove or replace `dashboard/app.py` functionality** — it is the canonical UI

---

## License

MIT — see root `LICENSE`

---

*ZION OS v2.1.0 — Canonical, clean, and dashboard-first.*
