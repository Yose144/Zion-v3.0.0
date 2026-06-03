# AGENTS.md

This file provides operating guidance to Devin, WARP, Copilot, and future automated agents working in this repository.

## Scope and working area

- This is a multi-layer monorepo, but **active mainnet-track development is in `V3/`**.
- Treat legacy root trees (`L1/`, `L2/`, `L3/`, older docs/archive content) as migration/reference material unless a task explicitly targets them.
- For `V3` work, prefer changing only `V3/**` unless the task explicitly requires cross-tree sync.
- Avoid incidental edits in `APP&WEB/**` when the task is unrelated to website, desktop, or mobile work.
- If deployment behavior changes, update every source of operational truth together: compose files, Docker docs, runbooks, scripts, and status docs.
- If docs disagree, use this order of truth: `KeyforLaunch.md` (live operational state) → `StatusV3.md` → `V3/README.md` / `V3/ROADMAP.md` → `V3/docs/**` → older `STATUS.md`, root README, and archived docs.
- Root README / older plans may still mention historical multi-server topology. Verify live topology against `StatusV3.md` before making operational claims.

## Existing guidance files to know

- Root guidance baseline: `.github/copilot-instructions.md` (applies repo-wide).
- Current status and launch blockers: [`StatusV3.md`](./StatusV3.md) + [`StatusV3-Part2.md`](./StatusV3-Part2.md) (independent audit + 2026-05-07 cleanup).
- **Operational launch cheat-sheet (confidential — never commit):** `KeyforLaunch.md` — canonical single-source summary of live topology, wallet addresses, bridge contracts, ports, systemd configs, and P0/P1/P2 blockers. Generated from `StatusV3.md` + live state. Agents should read this first for any operational / mainnet task.
- Current V3 planning/status references: `V3/README.md`, `V3/ROADMAP.md`, and `V3/docs/**`.
- Hiran **v2.2** local inference setup (GGUF ready, llama-server.exe ready): [`HIRAN_LOCAL_SETUP.md`](./HIRAN_LOCAL_SETUP.md) — canonical guide for running inference locally. Use this, not v2.1 docs, for current runtime.
- Hiranyagarbha / Hiran **v2.1** roadmap (historical): [`HiranV2.1/Hiran_v2.1.md`](./HiranV2.1/Hiran_v2.1.md); upgrade context: [`HIRANYAGARBHA_UPGRADE_PLAN.md`](./HIRANYAGARBHA_UPGRADE_PLAN.md).
- Historical archive exists at `docs/2.9.9/archive/WARP.md`; treat it as legacy context, not current source of truth for V3 runtime behavior.

## Agent operating rules

- Start by checking branch/worktree state, then read the smallest relevant status docs before editing.
- Default to minimal, focused changes. Do not refactor or normalize old folders unless explicitly asked.
- Never run destructive operations without explicit user approval: history rewrites (`git filter-repo`, BFG), force pushes to shared branches, deleting datadirs, or production deploys.
- Do not open, copy, print, or reintroduce leaked private keys or credential values. Refer to documented secret-bearing paths by filename only, and recommend rotation/scrub.
- Keep launch/security blockers visible: credential rotation, history scrub, clean Genesis #0 rollout, bridge 3/5 validator provisioning, CI billing, external audit, and bug bounty.
- Prefer `V3/cli` and documented runbooks over ad-hoc scripts for operations.
- For Hiran v2.2 work, keep `V3/` + `StatusV3.md` as the technical canon; use external corpora through licensed, cited RAG snapshots rather than dumping copyrighted material into SFT weights.
- Hiran v2.2 GGUF files live at `HiranV2.2/models/hiran-v2.2-merged/` — do NOT regenerate unless explicitly asked; conversion took ~10 min.
- The canonical inference start script is `scripts/start-hiran-inference.ps1` — it auto-detects backend priority (llama-server.exe > LM Studio > Ollama > serve.py).

## Common commands

Run from repository root unless noted.

### V3 Rust workspace (main path)

- Build/check workspace:
  - `cargo check --manifest-path V3/Cargo.toml --workspace`
- Run tests (CI-style):
  - `cargo test --manifest-path V3/Cargo.toml --workspace -- --test-threads=1`
- Run one crate’s tests:
  - `cargo test --manifest-path V3/Cargo.toml -p zion-core`
- Run a single test function:
  - `cargo test --manifest-path V3/Cargo.toml -p zion-core <test_name> -- --exact`
- Run one integration test target:
  - `cargo test --manifest-path V3/Cargo.toml -p zion-pool --test chv4_e2e`
- Lint:
  - `cargo clippy --manifest-path V3/Cargo.toml --workspace --all-targets`
- Format check:
  - `cargo fmt --manifest-path V3/Cargo.toml --all --check`
- Security audit:
  - `cargo audit --file V3/Cargo.lock`
- Pre-commit checks:
  - `pre-commit validate-config`
  - `pre-commit run --all-files`

### Running core binaries from source

- Node:
  - `ZION_NODE_ID=local-node ZION_P2P_BIND=0.0.0.0:8333 ZION_RPC_BIND=0.0.0.0:8443 cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node`
- Pool server:
  - `ZION_POOL_BIND=0.0.0.0:8444 ZION_NODE_RPC_ADDR=127.0.0.1:8443 cargo run --release --manifest-path V3/Cargo.toml -p zion-pool --bin server`
- Miner:
  - `ZION_POOL_ADDR=127.0.0.1:8444 ZION_WORKER_NAME=<name> ZION_MINER_ID=<id> cargo run --release --manifest-path V3/Cargo.toml -p zion-miner`
  - **Important:** For sustained GPU mining, also set `ZION_LOOP_COUNT=1000000` on the miner and `ZION_POOL_LOOP_COUNT=1000000` on the pool. The pool default was historically `1`, which caused a `Bye` after every iteration and forced expensive reconnects/GPU self-tests, collapsing effective hashrate from ~3 KH/s to ~30 H/s.
  - **GPU batch size:** The pool default `ZION_NONCE_COUNT=1024` sends small batches to miners. For better GPU utilisation, raise this to `4096` (or match `ZION_GPU_WORK_SIZE`) on the pool. Benchmark `--ekam-bench` uses `work_size` directly and therefore reports higher hashrate than live stratum mining with the default 1024 nonce window.
- Unified operator CLI:
  - `cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help`

### Running core binaries from source (Windows 11)

PowerShell equivalents for W11 development. Build first: `cargo build --release --manifest-path V3/Cargo.toml --workspace`.

- Node (backup, edge-primary — uses public IP if Tailscale down):
  - `$env:ZION_NODE_ID='local-backup-node'; $env:ZION_P2P_BIND='0.0.0.0:8333'; $env:ZION_RPC_BIND='0.0.0.0:8443'; $env:ZION_SEED_PEERS='77.42.71.94:8333'; $env:ZION_NODE_STATE_PATH='V3/data/zion-node-state.db'; $env:ZION_MINER_ADDRESS='zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3'; $env:ZION_HUMANITARIAN_WALLET='zion1m4v5z8z850u480c5c208z274e334369275n5y20'; $env:ZION_ISSOBELLA_WALLET='zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702'; cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node`
- Pool server (local-dev only):
  - `$env:ZION_POOL_BIND='0.0.0.0:8444'; $env:ZION_NODE_RPC_ADDR='127.0.0.1:8443'; cargo run --release --manifest-path V3/Cargo.toml -p zion-pool --bin server`
- Miner (edge-primary — connects to public pool):
  - `$env:ZION_POOL_ADDR='77.42.71.94:8444'; $env:ZION_WORKER_NAME='<name>'; $env:ZION_MINER_ID='<id>'; $env:ZION_LOOP_COUNT='1000000'; $env:ZION_GPU_BACKEND='opencl'; cargo run --release --manifest-path V3/Cargo.toml -p zion-miner`
  - **GPU compile:** `cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl` (or `gpu-cuda`, `gpu-metal`)
- Unified operator CLI:
  - `cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help`

### Docker (V3 stack) — Updated 2026-05

**Recommended (new unified setup):**

```bash
# Development / Mainnet with profiles
docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d
docker compose -f V3/docker/docker-compose.yml logs -f node

# With monitoring
docker compose -f V3/docker/docker-compose.yml --profile mainnet --profile monitoring up -d

# Legacy (still works)
docker compose -f V3/docker/docker-compose.v3-mainnet.yml up -d
```

**Documentation:**
- `V3/docker/DOCKER.md` — complete guide with profiles, env vars, healthchecks
- `V3/docker/HARDENING.md` — production hardening (ufw, log rotation, non-root)

**New features:**
- Docker Compose profiles (`dev`, `mainnet`, `monitoring`)
- Healthchecks on all services
- Unified `.env` management
- Resource limits and proper depends_on conditions
- Non-root containers (already in Dockerfiles)

### App/Web subprojects (when task explicitly targets them)

- Website:
  - `npm --prefix "APP&WEB/website-v2.9" install`
  - `npm --prefix "APP&WEB/website-v2.9" run dev`
  - `npm --prefix "APP&WEB/website-v2.9" run build`
  - `npm --prefix "APP&WEB/website-v2.9" run lint`
  - **Edge deployment (production):**
    - Build runs on Edge server (`77.42.71.94`) inside `/root/zion-2.9.6-main/APP&WEB/website-v2.9`
    - Docker image is built from host artifacts (`.next` + `node_modules` copied into `node:20-alpine` runner) — `npm install` inside Docker fails due to local `.tgz` dependency, so use the host-built artifacts
    - Production compose file: `/root/zion-web/docker-compose.yml` uses `image: zion-website:<version>`
    - Caddy reverse proxies to `localhost:3000`
- Mobile app:
  - `npm --prefix "APP&WEB/mobile-app" install`
  - `npm --prefix "APP&WEB/mobile-app" run test`
  - `npm --prefix "APP&WEB/mobile-app" run lint`
- Desktop agent (legacy Electron):
  - `npm --prefix "APP&WEB/desktop-agent" install`
  - `npm --prefix "APP&WEB/desktop-agent" run start`
  - `npm --prefix "APP&WEB/desktop-agent" run test`
- Desktop dashboard (Tauri v2 + React — new):
  - `npm --prefix "APP&WEB/desktop-dashboard" install`
  - `cargo tauri dev --manifest-path "APP&WEB/desktop-dashboard/src-tauri/Cargo.toml"`
  - `cargo tauri build --manifest-path "APP&WEB/desktop-dashboard/src-tauri/Cargo.toml"`
  - Features: system tray, native Rust IPC, hybrid refresh (native probes + HTTP fallback), L1-L6 service grid, chain/pool/miner panels, log viewer, alerts
- Web dashboard (Python):
  - `python dashboard/app.py` → `http://127.0.0.1:8766`
  - `python dashboard/metrics-collector/` — standalone Rust binary for native metrics polling

## High-level architecture (big picture)

## 1) Repository shape

- `V3/` is the clean-room mainnet code line and the operational core.
- Legacy root (`L1`..`L6`, older docs, archived WARP docs) remains valuable for migration history and audit evidence, but not default implementation target.
- `APP&WEB/` hosts operator-facing applications (desktop agent, mobile app, website) and is loosely coupled to the V3 Rust runtime.

## 2) V3 runtime topology (L1)

- `V3/L1/core` (`zion-core`, `node` bin):
  - Owns chain state, consensus validation, mempool, P2P, and RPC surfaces.
  - Exposes P2P listener, RPC listener, and metrics endpoint.
  - Persists/loads state and manages peer discovery/sync/propagation.
- `V3/L1/pool` (`server` bin):
  - Accepts miner sessions over TCP.
  - Pulls block templates from node RPC and submits solved candidates back to node RPC.
  - Handles share validation/session lifecycle and PPLNS payout logic.
- `V3/L1/miner` (`zion-miner` bin):
  - Mines in local mode or remote pool mode.
  - Supports CPU/GPU backends and emits telemetry/metrics.
  - Talks to pool using line-based protocol messages (`hello`/`job`/`submit`/`result`/etc.).

In practice: **node is source of chain truth**, pool is coordination layer, miner is hash producer.

## 3) V3 service layers above L1

- `V3/L2/bridge`:
  - Relay daemon with L1 watcher + EVM watcher(s) + relayer loop.
  - Uses SQLite persistence and exposes Prometheus metrics.
- `V3/L2/dao`:
  - DAO daemon combining L1 scanner and Axum HTTP API.
  - Uses SQLite backend and treasury/governance modules.
- `V3/L2/atomic-swap`:
  - HTLC swap daemon with config-driven startup, L1 watcher, refund loop, optional EVM watcher, and Axum API.
- `V3/L3/warp`:
  - Cross-chain relay daemon (Axum API + background watcher), config-first startup with optional SQLite persistence.

## 4) Operator/control surface

- `V3/cli` (`zion` binary) is the unified operator entrypoint.
- It orchestrates lifecycle actions (`start/stop/restart/logs/status/doctor`) and routes into L1/L2/L3 subcommands.
- Prefer this CLI for operational tasks before writing ad-hoc scripts.

## 5) Validation workflow expectations

- For Rust changes in `V3`, start with targeted crate tests, then escalate to workspace checks.
- For doc-only changes, at minimum run `git diff --check`; run `pre-commit validate-config` when touching `.pre-commit-config.yaml`.
- For desktop-agent JS changes, run:
  - `node --check "APP&WEB/desktop-agent/src/main.js"`
- For desktop-agent Python mining fallback changes, run:
  - `python3 -m py_compile <touched_python_file>`
- `scripts/autopilot-2.9.8.sh` encodes a practical validation/deploy sequence when tasks touch miner/desktop-agent/deploy pipelines.
- If GitHub Actions jobs finish in seconds with no runner/steps, treat it as the known billing/infrastructure issue in `StatusV3.md`, not as code validation.

## 6) Canonical Operational Settings (v3.0.0 Mainnet)

### Network Topology

Current live topology is **Edge-as-Primary (Hetzner) + Core-as-Backup (Local PC) over Tailscale VPN**. Edge runs the canonical 24/7 node and pool. Core (local) acts as a backup node and GPU miner host. Do not reference old multi-server topologies (Praha, SG, Helsinki, US) — those are deprecated.

```
Edge (Hetzner VPS)          Core (Windows 11)
100.76.16.108               100.86.102.5
    | Tailscale VPN               |
Node + Pool (PRIMARY)    Node (backup sync)
Public P2P: 8333         GPU Miner -> Edge pool
Public Pool: 8444
```

| Role | Host | VPN IP | Public IP | Ports |
|------|------|--------|-----------|-------|
| Edge | Hetzner VPS | 100.76.16.108 | 77.42.71.94 | P2P: 8333/8334, RPC: 8443/8446, Pool: 8444, Metrics: 8455/9090/9100/9102/9115/9116 |
| Core | Local PC | 100.86.102.5 | (dynamic) | P2P: 8333, RPC: 8443, Metrics: 9115 |

### Canonical Ports & Services

| Service | Port | Protocol | Notes |
|---------|------|----------|-------|
| Node P2P | 8333 | TCP | Peer-to-peer sync (both Edge + Local) |
| Node 2 P2P | 8334 | TCP | Edge follower node only |
| Node RPC | 8443 | TCP | JSON-RPC 2.0, wallet queries |
| Node 1 WebSocket | 8445 | TCP | Node event stream (Edge public, Local 127.0.0.1) |
| Node 2 RPC | 8446 | TCP | Edge follower node JSON-RPC |
| Node 2 WebSocket | 8447 | TCP | Edge follower node event stream |
| Pool Stratum | 8444 | TCP | Miner connections (Edge public-facing) |
| DAO API | 8450 | HTTP | Edge DAO daemon Axum API |
| Atomic Swap API | 8452 | HTTP | Edge HTLC swap daemon API |
| WARP Relay API | 8453 | HTTP | Edge cross-chain relay Axum API |
| Pool metrics | 8455 | HTTP | Prometheus metrics (pool, Edge public) |
| Node metrics | 9115 | HTTP | Prometheus metrics (node, local) |
| Node 2 metrics | 9116 | HTTP | Prometheus metrics (Edge follower node) |
| Bridge metrics | 9102 | HTTP | Prometheus metrics (Edge bridge) |
| Prometheus | 9090 | HTTP | Edge monitoring stack (Docker host network) |
| Grafana | 3100 | HTTP | Edge monitoring dashboards (Docker host network) |
| Node Exporter | 9100 | HTTP | Edge host system metrics (Docker host network) |
| Dashboard | 8766 | HTTP | Python stdlib dashboard (Local only, 127.0.0.1) |
| Website | 3000 | HTTP | Next.js dev server (Edge) |
| Pool API Proxy | 8080 | HTTP | Edge pool REST proxy |
| **Hiranyagarbha API** | **8001** | HTTP | Orchestrator · RAG · Consciousness · NCL · Axum (Rust) |
| **NCL (via Hiranyagarbha)** | **8001** | HTTP | Neural Compute Layer at `/ncl/*` (jobs, workers, leaderboard) |
| **Hiran Inference** | **8002** | HTTP | OpenAI-compatible LLM API (llama-server.exe / serve.py) |

### Canonical URLs & Endpoints

| Purpose | URL |
|---------|-----|
| **Edge Pool (public mining)** | `77.42.71.94:8444` |
| **Edge RPC (public)** | `http://77.42.71.94:8443/jsonrpc` |
| **Edge RPC (VPN fallback)** | `http://100.76.16.108:8443/jsonrpc` |
| **Local RPC (default)** | `http://127.0.0.1:8443/jsonrpc` |
| **Desktop agent default RPC** | `http://127.0.0.1:8443/jsonrpc` (auto-fallback to Edge VPN) |
| **Website production** | `https://zionterranova.com` |
| **Dashboard** | `http://127.0.0.1:8766` |
| **Edge Grafana** | `http://100.76.16.108:3100` |
| **Edge Prometheus** | `http://100.76.16.108:9090` |

### SSH Access

- **Edge server SSH key:** `ssh-key-zion-edge` (private), `ssh-key-zion-edge.pub` (public) — kept in root for operational access.
- **Never commit private keys.** The existing keys in root are grandfathered; rotate if compromised.
- **SSH endpoint:** Use Tailscale SSH (`100.76.16.108`) or direct Hetzner console for Edge server management.

### Edge Server Deployment (Autonomous 24/7)

The Edge server runs as the canonical primary node + pool. It must survive reboots without local PC intervention.

**Systemd services** (installed by `edge-deploy/setup-edge.sh` or `edge-deploy/deploy-edge.sh`):

| Service | Binary | Role | Auto-restart |
|---------|--------|------|-------------|
| `zion-edge-node1.service` | `V3/target/release/node` | Primary chain node (Genesis) | `Restart=always` |
| `zion-edge-node2.service` | `V3/target/release/node` | Follower / P2P peer | `Restart=always` |
| `zion-edge-bridge.service` | `V3/target/release/zion-bridge` | L2 cross-chain relay | `Restart=always` |
| `zion-edge-dao.service` | `V3/target/release/zion-dao` | L2 governance | `Restart=always` |
| `zion-edge-atomic-swap.service` | `V3/target/release/zion-atomic-swap` | L2 HTLC swap | `Restart=always` |
| `zion-edge-warp.service` | `V3/target/release/zion-warp-server` | L3 cross-chain relay | `Restart=always` |
| `zion-edge-pool.service` | `V3/target/release/server` | Primary mining pool | `Restart=always` |
| `zion-edge-watchdog.timer` | `edge-deploy/watchdog.sh` | Healthcheck every 2 min | systemd timer |

**First-time setup (run on Edge server as root):**
```bash
cd /root/zion-2.9.6-main
bash edge-deploy/setup-edge.sh
systemctl start zion-edge-node1 zion-edge-node2 zion-edge-pool zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp
systemctl start zion-edge-watchdog.timer
```

**Deploy updates from local PC:**
```bash
cd /root/zion-2.9.6-main   # or wherever repo lives locally
bash edge-deploy/deploy-edge.sh
```

**Operational commands:**
```bash
# Status
systemctl status zion-edge-node1 zion-edge-node2 zion-edge-pool zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp

# Logs (journalctl)
journalctl -u zion-edge-node1 -f
journalctl -u zion-edge-pool -f

# Restart
systemctl restart zion-edge-node1
systemctl restart zion-edge-pool

# Stop (for maintenance)
systemctl stop zion-edge-pool zion-edge-node1 zion-edge-node2 zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp
```

**Important:** Edge uses `ZION_SEED_PEERS=none` because it is the greenfield genesis source. Never point Edge to a local PC as seed unless you are intentionally reversing the topology.

### Bridge Configuration (Base Mainnet)

The bridge connects ZION L1 to Base Mainnet (chain 8453). Canonical addresses and flow:

| Component | Address | Role |
|-----------|---------|------|
| **wZION** | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ERC-20 wrapper, minted by bridge |
| **ZIONBridge** | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | 3/5 validator multisig controller |
| **Bridge Vault (L1)** | `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0` | Keyless vault — **no private key exists** |
| **Bridge Seed Fund** | `zion1f6m2j0h0l773j4074324q5r528y475w4j7m9685` | Genesis slot 13 (0.4B ZION), operational bridge budget |
| **Bridge Vault UTXO Seed** | `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0` | Genesis slot 14 (0.1B ZION), UTXO liquidity for bridge unlocks |

**Validator setup:**
- Threshold: 3-of-5
- Existing validators: `0xdde17506...`, `0x8cc6F931...`
- New validators: `0x0279C8e3...`, `0x294942Cf...`, `0x8CA71cA7...`
- Upgrade script: `V3/scripts/upgrade-bridge-mainnet.sh`

**E2E bridge flow:**
1. User sends ZION to keyless vault with memo `BRIDGE:base:0x<evm_recipient>`
2. L1 watcher detects lock (60-block finality)
3. Each validator calls `submitLockProof()` on Base
4. At 3 confirmations, `wZION.bridgeMint()` executes automatically
5. For EVM→L1: user calls `wZION.bridgeBurn()` → validators submit L1 unlock TX with multisig proofs

**Bridge relay startup:**
```bash
ZION_BRIDGE_CONFIG=V3/config/bridge-mainnet.toml cargo run --release --manifest-path V3/Cargo.toml -p zion-bridge
```

**Metrics:** `curl http://localhost:9102/metrics | grep zion_bridge`

---

### Dashboard Configuration

The Python dashboard (`dashboard/app.py`) monitors Edge (primary) + Core (backup) services:

| Config | Value |
|--------|-------|
| Host | `127.0.0.1` |
| Port | `8766` |
| Services monitored | L1–L6: edge-node, local backup node, edge pool, miner, bridge, DAO, atomic-swap, WARP, OASIS, Hiranyagarbha, Hiran |
| Edge RPC fallback | Tailscale VPN (`100.76.16.108:8443`) → public IP (`77.42.71.94:8443`) |
| Rust metrics collector | `dashboard/metrics-collector/` — standalone binary polling Edge + Local + pool Prometheus |
| Auto-start | See `DASHBOARD_AUTOSTART.md` + `install-dashboard-autostart.bat` |

**Tauri desktop dashboard** (`APP&WEB/desktop-dashboard/`):
- System tray integration, hide-on-close
- Native Rust IPC: TCP probe, JSON-RPC, log tail, process control
- Hybrid refresh: native probes first, HTTP fallback
- L1–L6 service grid, chain/pool/miner panels, alerts, charts

### Launch Scripts

| Script | Topology | Purpose |
|--------|----------|---------|
| `scripts/launch-stack.sh` | Full local | Runs node1 + node2 + pool + miners on one host. Use for local dev/testing only. |
| `scripts/launch-local-backup.sh` | Edge-primary | Local PC runs backup node (syncs from Edge) + miners (connect to Edge pool). This is the production topology. |

### Desktop Agent Defaults

```javascript
// src/main.js constants
const PRIMARY_MAINNET_HOST = '77.42.71.94';
const PRIMARY_POOL_PORT = 8444;
const PRIMARY_RPC_PORT = 8443;
const EDGE_VPN_HOST = '100.76.16.108';
const DEFAULT_RPC_URL = 'http://127.0.0.1:8443/jsonrpc';  // localhost first, Edge VPN fallback
```

### Environment Variables (canonical)

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_NODE_ID` | `local-node` | Node identifier |
| `ZION_P2P_BIND` | `0.0.0.0:8333` | P2P listener |
| `ZION_RPC_BIND` | `0.0.0.0:8443` | RPC listener |
| `ZION_POOL_BIND` | `0.0.0.0:8444` | Pool stratum listener |
| `ZION_NODE_RPC_ADDR` | `127.0.0.1:8443` | Pool → node RPC upstream |
| `ZION_POOL_ADDR` | `127.0.0.1:8444` | Miner → pool address |
| `ZION_WORKER_NAME` | `desktop-agent` | Miner worker name |
| `ZION_LOOP_COUNT` | `1000000` | Miner sustained GPU loops (avoid reconnects) |
| `ZION_POOL_LOOP_COUNT` | `1000000` | Pool sustained loops |
| `ZION_NONCE_COUNT` | `4096` | Pool nonce batch size (raise from 1024 for GPU) |
| `ZION_GPU_WORK_SIZE` | `4096` | GPU work batch size |

### Fee Split Addresses (canonical, on-chain)

| Type | Address | Share |
|------|---------|-------|
| Miner | `zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3` | 89% |
| Humanitarian | `zion1m4v5z8z850u480c5c208z274e334369275n5y20` | 5% |
| Issobella | `zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702` | 5% |
| Pool Fee | `zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5` | 1% |

### Genesis Hash (canonical)

```
60b5ff78ec7797c79b79069b3bea5553441d201d23329b389828b869723998da
```

Verify against `PREMINE_ADDRESSES_PUBLIC.txt` and `V3/L1/core/src/genesis.rs`.

**2026-06-03 upgrade note:** Genesis changed from 13 → 14 premine outputs. Bridge Seed Fund split into:
- Slot 13: 400M ZION (account model) → `zion1f6m2j0h0l773j4074324q5r528y475w4j7m9685`
- Slot 14: 100M ZION (UTXO coinbase, 6 outputs) → `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0`

This gives the keyless bridge vault native UTXO liquidity for unlock operations without requiring any wallet private key. Both local PC and Edge server were hard-reset with the new genesis.

---

## 7) AI Layer — Hiran v2.2 + Hiranyagarbha (Live, 2026-05-23)

The ZION AI layer consists of two services. Both are started via the dashboard or PowerShell scripts.

### Architecture

```
Dashboard (port 8766)
  ├── ▶ Start Hiranyagarbha  →  scripts/start-hiranyagarbha.ps1
  │       └── zion-ai-native-api (Rust/Axum)  →  http://127.0.0.1:8001
  │           Endpoints: /agents, /tasks/dispatch, /orchestrator/status,
  │                      /health, /v1/chat/completions, /v1/embeddings
  │           NCL routes: /ncl/health, /ncl/jobs, /ncl/workers, /ncl/leaderboard,
  │                       /ncl/schedule, /ncl/price, /ncl/status
  │
  └── ▶ Start Hiran Inference  →  scripts/start-hiran-inference.ps1
          └── llama-server.exe (preferred) OR serve.py  →  http://127.0.0.1:8002
              Backend priority: llama-server.exe > LM Studio (1234) > Ollama (11434) > serve.py

CLI: zion ncl status/submit/workers/...  →  http://127.0.0.1:8001/ncl/*
Website (/api/ai-chat)  →  cascade: port 8002 → LM Studio → Ollama
Desktop Agent (Hiran AI tab)  →  HIRAN_INFERENCE_URL (default localhost:8002)
```

### Hiran v2.2 Model (✅ GGUF ready, 2026-05-23)

| Artifact | Path | Status |
|----------|------|--------|
| FP16 safetensors | `HiranV2.2/models/hiran-v2.2-merged/` | ✅ 4 × safetensors |
| Q4_K_M GGUF | `HiranV2.2/models/hiran-v2.2-merged/hiran-v2.2.q4_k_m.gguf` | ✅ 4.6 GB |
| F16 GGUF | `HiranV2.2/models/hiran-v2.2-merged/hiran-v2.2.f16.gguf` | ✅ 15 GB |
| llama-server binary | `llama.cpp-bin/llama-server.exe` | ✅ build b4524, AVX2 |
| convert script | `llama.cpp-bin/convert_hf_to_gguf.py` | ✅ b4524 |
| Start script | `scripts/start-hiran-inference.ps1` | ✅ auto-detects backend |

**Do NOT re-run GGUF conversion** unless model weights change — it takes ~10 min.

### Hiranyagarbha Orchestrator API (✅ Rust, port 8001)

- Crate: `V3/L3/ai-native` (`zion-ai-native` binary in `src/bin/zion-ai-native-api.rs`)
- Endpoints: `GET/POST /agents`, `GET/DELETE /agents/:id`, `POST /agents/:id/capabilities`,
  `POST /agents/:id/consciousness`, `GET /orchestrator/status`, `POST /tasks/dispatch`,
  `GET /health`, `POST /v1/chat/completions`, `POST /v1/embeddings`
- Env: `HIRANYAGARBHA_MAX_AGENTS` (default 100), `HIRANYAGARBHA_PORT` (default 8001)
- Start script: `scripts/start-hiranyagarbha.ps1`

### NCL — Neural Compute Layer (✅ Integrated into Hiranyagarbha, port 8001)

NCL is the decentralized AI task marketplace. Workers register GPU/NPU compute and earn ZION for executing inference jobs.

- **Library crate:** `V3/L3/ncl` (`zion-ncl`)
- **Integration:** Mounted at `/ncl/*` inside Hiranyagarbha (`zion-ai-native-api`)
- **CLI:** `zion ncl status|submit|job|jobs|workers|leaderboard|schedule|price`
- **API endpoints (all at port 8001):**
  - `GET /ncl/health` — scheduler status (queued, active, workers)
  - `POST /ncl/jobs` — submit compute job
  - `GET /ncl/jobs/:id` — get job status
  - `POST /ncl/jobs/:id/complete` — mark job done (updates reputation)
  - `POST /ncl/jobs/:id/fail` — mark job failed
  - `POST /ncl/workers` — register compute worker
  - `GET /ncl/workers` — list workers with reputation
  - `GET /ncl/leaderboard` — ranked worker scores
  - `POST /ncl/schedule` — trigger scheduling cycle
  - `GET /ncl/price?model=...` — pricing for model
  - `GET /ncl/status` — high-level status summary
- **Pricing:** 10% protocol fee, 90% to worker. Base price 0.01 ZION per unit.
- **Reputation:** 0-100 scale, weighted by completion time and success rate.
- **Database:** `V3/data/ncl.db` (SQLite)

### Hiran Inference API (✅ llama-server.exe / serve.py, port 8002)

- Primary backend: `llama.cpp-bin/llama-server.exe` with Q4_K_M GGUF (no Python needed)
- Fallback backends: LM Studio (port 1234) → Ollama (port 11434) → serve.py with llama-cpp-python
- Python serve.py: `HiranV2.2/inference/serve.py` — supports backends: `llamaserver:`, `lmstudio:`, `ollama:`, `.gguf`, HuggingFace dir
- GPU offload: set `HIRAN_GPU_LAYERS=<n>` before running start script (0 = CPU only, 33 = full GPU for RX 5600 XT)
- Full setup guide: [`HIRAN_LOCAL_SETUP.md`](./HIRAN_LOCAL_SETUP.md)

### AI Layer env vars

| Variable | Default | Description |
|----------|---------|-------------|
| `HIRAN_GPU_LAYERS` | `0` | GPU layers for llama-server Vulkan/CUDA offload |
| `HIRAN_INFERENCE_URL` | `http://localhost:8002` | Desktop agent → inference URL |
| `HIRAN_API_URL` | `http://127.0.0.1:8002` | Website → inference URL |
| `LMSTUDIO_URL` | `http://127.0.0.1:1234` | Website → LM Studio fallback |
| `OLLAMA_API_URL` | `http://127.0.0.1:11434` | Website → Ollama fallback |
| `HIRAN_MODEL` | `hiran-v2.2` | Model name in API requests |
| `HIRANYAGARBHA_MAX_AGENTS` | `100` | Max agents in orchestrator |
| `HIRANYAGARBHA_PORT` | `8001` | Hiranyagarbha HTTP port |

### Dashboard integration

- `SERVICE_REGISTRY`: `hiranyagarbha` (port 8001, `start-hiranyagarbha`) + `ai-native` (port 8002, `start-hiran-inference`)
- `_ALLOW_BASE`: `start-hiranyagarbha`, `start-hiran-inference`, `restart-hiranyagarbha`, `restart-hiran-inference`
- New GET endpoints: `/api/hiranyagarbha/health`, `/api/hiran/health`, `/api/service-log?id=<svc>&lines=<n>`
- Log files: `logs/hiranyagarbha.log`, `logs/hiran-inference.log`

### Training summary (Hiran v2.2, completed 2026-05-18)

- **Base model:** `unsloth/Meta-Llama-3.1-8B-Instruct`
- **Method:** QLoRA (curriculum, 5 stages), 22,181 instruction pairs
- **Hardware:** Vast.ai RTX 4090 (~$0.46/hr)
- **Key finding:** System prompt anchoring required — low temperature without system prompt causes base model contamination (hallucinated non-ZION associations). Always include system prompt in production.
- Evaluation artifacts: `HiranV2.2/MODEL_INTERVIEW_REPORT.md`, `HiranV2.2/gpu_experiment_results_v2.json`

## 7) Hiran v2.3 AI Model Training (In Progress)

Hiran v2.3 is the next-generation domain model using full fine-tuning on a 32B base model with hybrid RAG architecture. All artifacts live in `HiranV2.3/`.

### Training stack
- **Base model:** `nvidia/OpenReasoning-Nemotron-32B` (Qwen2.5-32B-Instruct derivative, 32K context, reasoning-optimized)
- **Method:** Full Fine-Tuning with DeepSpeed ZeRO-3 (CPU/NVMe offload, BF16)
- **Fallback:** DORA with rank 512 (`scripts/train_v2.3.py`)
- **Hardware target:** 4x A100 80GB (~$6/hr, ~48h = ~$288)
- **Dataset:** 48,436 weighted instruction pairs (20,517 unique) across 9 stages:
  - Stage 1a: 3,200 factual reinforcement (fee split, categories, L1-L6, Issobella)
  - Stage 1b: 5,302 drill patterns (massive repetition, true/false, verification)
  - Stage 2: 1,500 domain expertise (mining, DAO, bridge, consensus, security)
  - Stage 3: 1,000 cross-domain comparisons
  - Stage 4: 500 preference alignment (ORPO pairs)
  - Stage 5: 300 conversation flow
  - Stage 6: 2,015 bilingual Czech/English
  - Stage 7: 3,000 code generation (Rust, Solidity, Python)
  - Stage 8: 2,000 inference/deployment docs
  - Stage 9: 1,700 safety & adversarial (jailbreak refusals, attack refusals, edge cases, multi-turn consistency)

### Hybrid RAG Architecture
Because general knowledge is too large for 32B parameters, v2.3 uses RAG alongside FT:
- **33 knowledge documents** across religion, history, science, culture, philosophy, art, medicine, literature, mythology, languages
- **Vector DB:** ChromaDB + `all-MiniLM-L6-v2` embeddings
- **Query Router:** Classifies queries as `zion_only`, `knowledge_rag`, or `hybrid`
- **Retriever:** Multi-collection cosine-similarity retrieval
- **Inference:** `rag/inference_hybrid.py` combines FT model with retrieved context

### Key files
- `HiranV2.3/PLAN_v2.3.md` — comprehensive training plan
- `HiranV2.3/data/generators/build_v2.3_dataset.py` — master dataset builder
- `HiranV2.3/data/generators/generate_safety_adversarial.py` — Stage 9 generator
- `HiranV2.3/scripts/train_v2.3_fullft.py` — DeepSpeed ZeRO-3 full FT script
- `HiranV2.3/config/deepspeed_zero3.json` — ZeRO-3 configuration
- `HiranV2.3/rag/query_router.py` — query classification
- `HiranV2.3/rag/indexer.py` / `retriever.py` — vector DB operations

---

## Edge Server Operational Notes

### Hard-reset procedure (both local + Edge must agree on genesis)

When genesis changes (premine outputs, merkle root, etc.), ALL nodes must be hard-reset:

**Local PC:**
```powershell
ps aux | grep zion | grep -v grep | awk '{print $1}' | xargs kill
rm -f V3/data/zion-node-state.db V3/data/node.pid V3/data/peers.json
```

**Edge (Hetzner) via SSH:**
```bash
ssh -i ssh-key-zion-edge root@100.76.16.108
systemctl stop zion-node.service zion-pool.service
rm -f /root/zion-2.9.6-main/data/zion-node-state.db /root/zion-2.9.6-main/data/node.pid /root/zion-2.9.6-main/data/peers.json
```

### Edge build from source (no Docker, no pre-built binary)

Edge has no `cargo` in default PATH; Rust is installed under `/root/.cargo`:
```bash
source /root/.cargo/env
cd /root/zion-2.9.6-main/V3
cargo build --release --manifest-path Cargo.toml -p zion-core --bin node
cargo build --release --manifest-path Cargo.toml -p zion-pool --bin server
cp target/release/node /usr/local/bin/zion-node
cp target/release/server /usr/local/bin/zion-pool-server
systemctl daemon-reload
systemctl start zion-node.service zion-pool.service
```

### Edge cleanup after build

```bash
rm -rf /root/zion-2.9.6-main/V3/target /tmp/v3-sources.tar.gz
docker system prune -a -f --volumes
```

### Verifying new genesis on Edge

```bash
curl -s -X POST http://127.0.0.1:8443/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":{}}' | python3 -m json.tool
# tip_hash must match local node exactly
curl -s -X POST http://127.0.0.1:8443/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"getAddressInfo","params":{"address":"zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0"}}' | python3 -m json.tool
# utxo_count == 6, balance_flowers == 100000000000000000000
```
