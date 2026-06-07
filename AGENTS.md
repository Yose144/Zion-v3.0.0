# AGENTS.md

This file provides operating guidance to Devin, WARP, Copilot, and future automated agents working in this repository.

## Scope and working area

- This is a multi-layer monorepo, but **active mainnet-track development is in `V3/`**.
- Treat legacy root trees (`L1/`, `L2/`, `L3/`, older docs/archive content) as migration/reference material unless a task explicitly targets them.
- For `V3` work, prefer changing only `V3/**` unless the task explicitly requires cross-tree sync.
- Avoid incidental edits in `APP&WEB/**` when the task is unrelated to website, desktop, or mobile work.
- If deployment behavior changes, update every source of operational truth together: compose files, Docker docs, runbooks, scripts, and status docs.
- If docs disagree, use this order of truth: `StatusV3.md` → `V3/README.md` / `V3/ROADMAP.md` → `V3/docs/**` → older `STATUS.md`, root README, and archived docs.
- Root README / older plans may still mention historical multi-server topology. Verify live topology against `StatusV3.md` before making operational claims.

## Existing guidance files to know

- Root guidance baseline: `.github/copilot-instructions.md` (applies repo-wide).
- Current status and launch blockers: [`StatusV3.md`](./StatusV3.md) + [`StatusV3-Part2.md`](./StatusV3-Part2.md) (independent audit + 2026-05-07 cleanup).
- Current V3 planning/status references: `V3/README.md`, `V3/ROADMAP.md`, and `V3/docs/**`.
- Hiran **v2.2** local inference setup (GGUF ready, llama-server.exe ready): [`HIRAN_LOCAL_SETUP.md`](./HIRAN_LOCAL_SETUP.md) — canonical guide for running inference locally. Use this, not v2.1 docs, for current runtime.
- Hiranyagarbha / Hiran **v2.1** roadmap (historical): [`HiranV2.1/Hiran_v2.1.md`](./HiranV2.1/Hiran_v2.1.md); upgrade context: [`HIRANYAGARBHA_UPGRADE_PLAN.md`](./HIRANYAGARBHA_UPGRADE_PLAN.md).
- Historical archive exists at `docs/2.9.9/archive/WARP.md`; treat it as legacy context, not current source of truth for V3 runtime behavior.
- Genesis Regeneration Runbook: [`GENESIS_REGENERATION_RUNBOOK.md`](./GENESIS_REGENERATION_RUNBOOK.md) — complete guide for genesis key rotation and recovery procedures.

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
- Run one crate's tests:
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
  - **Dual-algo:** The pool no longer enforces a single global algorithm. Each miner session advertises its algorithm in the `Hello` message, and the pool validates shares using the session's algorithm. Set `ZION_NONCE_COUNT_GPU=262144` for GPU miners (OpenCL/CUDA/Metal) while keeping `ZION_NONCE_COUNT=4096` for CPU miners.
- Miner:
  - `ZION_POOL_ADDR=127.0.0.1:8444 ZION_WORKER_NAME=<name> ZION_MINER_ID=<id> cargo run --release --manifest-path V3/Cargo.toml -p zion-miner`
  - **Algorithm:** Set `ZION_MINER_ALGORITHM=deeksha_lite_v1` (default), `cosmic_harmony_ekam_deeksha_v2`, or `deeksha_lite_fire` (thermal-intensive), or pass `--algorithm <algo>` on the CLI. The miner advertises this to the pool in its `Hello` message.
  - **Important:** For sustained GPU mining, also set `ZION_LOOP_COUNT=1000000` on the miner and `ZION_POOL_LOOP_COUNT=1000000` on the pool. The pool default was historically `1`, which caused a `Bye` after every iteration and forced expensive reconnects/GPU self-tests, collapsing effective hashrate from ~3 KH/s to ~30 H/s.
  - **GPU batch size:** The pool default `ZION_NONCE_COUNT=4096` sends batches to CPU miners. For GPU miners, the pool uses `ZION_NONCE_COUNT_GPU` (default 262144). Benchmark `--ekam-bench` uses `work_size` directly and therefore reports higher hashrate than live stratum mining with the default nonce window.
- Unified operator CLI:
  - `cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help`

### Running core binaries from source (Windows 11)

PowerShell equivalents for W11 development. Build first: `cargo build --release --manifest-path V3/Cargo.toml --workspace`.

- Node (edge-primary — local dev only, connects to Edge seed):
  - `$env:ZION_NODE_ID='local-dev-node'; $env:ZION_P2P_BIND='0.0.0.0:8333'; $env:ZION_RPC_BIND='0.0.0.0:8443'; $env:ZION_SEED_PEERS='77.42.71.94:8333'; $env:ZION_NODE_STATE_PATH='V3/data/zion-node-state.db'; $env:ZION_MINER_ADDRESS='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'; $env:ZION_HUMANITARIAN_WALLET='zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4'; $env:ZION_ISSOBELLA_WALLET='zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702'; cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node`
- Pool server (local-dev only):
  - `$env:ZION_POOL_BIND='0.0.0.0:8444'; $env:ZION_NODE_RPC_ADDR='127.0.0.1:8443'; $env:ZION_POOL_LOOP_COUNT='1000000'; $env:ZION_NONCE_COUNT='4096'; $env:ZION_NONCE_COUNT_GPU='262144'; $env:ZION_POOL_WALLET='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'; cargo run --release --manifest-path V3/Cargo.toml -p zion-pool --bin server`
  - **IMPORTANT:** Pool and miner binaries must be compiled from the same source version — protocol is not backward compatible. Always recompile pool after `cargo build` on miner.
- Miner (edge-primary — connects to public pool):
  - `$env:ZION_POOL_ADDR='77.42.71.94:8444'; $env:ZION_WORKER_NAME='<name>'; $env:ZION_MINER_ID='<id>'; $env:ZION_LOOP_COUNT='1000000'; $env:ZION_GPU_BACKEND='opencl'; $env:ZION_PAYOUT_ADDRESS='<zion1...address>'; $env:ZION_MINER_ALGORITHM='deeksha_lite_v1'; cargo run --release --manifest-path V3/Cargo.toml -p zion-miner`
  - **Fire mode (thermal):** Replace `deeksha_lite_v1` with `deeksha_lite_fire` above. Uses 512 KiB scratchpad, higher power draw.
  - **REQUIRED:** `ZION_PAYOUT_ADDRESS` must be a valid 44-char `zion1...` address — pool validates and rejects with "pool closed the connection" if missing or invalid (fallback to miner_id is not allowed).
  - **GPU compile:** `cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl` (or `gpu-cuda`, `gpu-metal`)
  - **GPU hashrate (RX 5700 XT / gfx1010, AMD OpenCL):** Deeksha Full = ~1.1 KH/s benchmark. Live stratum hashrate is limited by nonce batch size (see ZION_NONCE_COUNT below).
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
  - `npm --prefix "ZION_OS/desktop" install`
  - `cargo tauri dev --manifest-path "ZION_OS/desktop/src-tauri/Cargo.toml"`
  - `cargo tauri build --manifest-path "ZION_OS/desktop/src-tauri/Cargo.toml"`
  - Features: system tray, native Rust IPC, hybrid refresh (native probes + HTTP fallback), L1-L6 service grid, chain/pool/miner panels, log viewer, alerts
- Web dashboard (Python):
  - `python ZION_OS/dashboard/app.py` → `http://127.0.0.1:8766`
  - `python ZION_OS/dashboard/metrics-collector/` — standalone Rust binary for native metrics polling
  - **Dashboard Payout Section**: Enhanced error handling and fallback values for pool monitoring
  - **Pool Metrics Endpoint**: Running on Edge server port 8455 for real-time pool statistics

## High-level architecture (big picture)

## 0) Zion OS - ZION Mainnet Operations System

**Zion OS** is the unified operations system for managing the entire ZION Mainnet. It centralizes dashboard, desktop agent, mobile app, auto-update, monitoring, and mining into a single cohesive platform.

**Location:** `ZION_OS/`

**Components:**
- **Central Dashboard:** Python Flask + React v1/v2 (multi-node detection, monitoring, alerts)
- **Desktop Dashboard:** Tauri v2 + React (native system tray, IPC, service grid)
- **Mobile App:** React Native (mobile monitoring, push notifications)
- **Mining Agent:** Rust multi-GPU (CUDA, AMD, Metal support)
- **Auto-Update:** Rust semantic versioning with rollback
- **Monitoring:** Prometheus + Grafana + Alertmanager

**Quick Start:**
```bash
# Central Dashboard
cd ZION_OS/dashboard
python3 app.py

# Desktop Dashboard
cd ZION_OS/desktop
npm install
cargo tauri dev --manifest-path src-tauri/Cargo.toml

# ZION Agent (rig lifecycle manager — miner control, telemetry, watchdog)
cd ZION_OS/agent
cargo build --release
sudo cp target/release/zion-agent /usr/local/bin/
sudo systemctl enable --now zion-edge-agent
```

**Documentation:**
- `ZION_OS/README.md` - Complete system documentation
- `ZION_OS/docs/ARCHITECTURE.md` - System architecture & design decisions
- `ZION_OS/docs/ROADMAP.md` - Development roadmap & milestones

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

Current live topology is **Edge-only (Hetzner VPS)**. The Core (local Windows PC) is currently unreachable due to Tailscale VPN failure and ISP issues. All canonical services run on Edge. Do not reference old multi-server topologies (Praha, SG, Helsinki, US, or Core-as-Backup) — those are deprecated.

```
Edge (Hetzner VPS)
77.42.71.94
    |
Node + Pool (PRIMARY)
DAO + WARP + Website
Public P2P: 8333/8334
Public Pool: 8444
```

| Role | Host | Public IP | Ports |
|------|------|-----------|-------|
| Edge | Hetzner VPS | 77.42.71.94 | P2P: 8333/8334, RPC: 8443/8446, Pool: 8444, DAO: 8450, WARP: 8453, Web: 3000, Metrics: 8455/9090/9100/9102/9115/9116 |

### Canonical Ports & Services

| Service | Port | Protocol | Notes |
|---------|------|----------|-------|
| Node P2P | 8333 | TCP | Peer-to-peer sync (Edge primary) |
| Node 2 P2P | 8334 | TCP | Edge follower node |
| Node RPC | 8443 | TCP | JSON-RPC 2.0, wallet queries (Edge) |
| Node 1 WebSocket | 8445 | TCP | Node event stream (Edge) |
| Node 2 RPC | 8446 | TCP | Edge follower node JSON-RPC |
| Node 2 WebSocket | 8447 | TCP | Edge follower node event stream |
| Pool Stratum | 8444 | TCP | Miner connections (Edge public-facing) |
| DAO API | 8450 | HTTP | Edge DAO daemon Axum API |
| Atomic Swap API | 8452 | HTTP | Edge HTLC swap daemon API (optional) |
| WARP Relay API | 8453 | HTTP | Edge cross-chain relay Axum API |
| Pool metrics | 8455 | HTTP | Prometheus metrics (pool, Edge) |
| Node metrics | 9115 | HTTP | Prometheus metrics (Edge node) |
| Node 2 metrics | 9116 | HTTP | Prometheus metrics (Edge follower node) |
| Bridge metrics | 9102 | HTTP | Prometheus metrics (Edge bridge, optional) |
| Prometheus | 9090 | HTTP | Edge monitoring stack (Docker host network) |
| Grafana | 3100 | HTTP | Edge monitoring dashboards (Docker host network) |
| Node Exporter | 9100 | HTTP | Edge host system metrics (Docker host network) |
| Dashboard | 8766 | HTTP | Python stdlib dashboard (currently offline) |
| Website | 3000 | HTTP | Next.js website (PM2, Edge) |
| Pool API Proxy | 8080 | HTTP | Edge pool REST proxy |
| **Hiranyagarbha API** | **8001** | HTTP | Orchestrator · RAG · Consciousness · NCL · Axum (Rust) |
| **NCL (via Hiranyagarbha)** | **8001** | HTTP | Neural Compute Layer at `/ncl/*` (jobs, workers, leaderboard) |
| **Hiran Inference** | **8002** | HTTP | OpenAI-compatible LLM API (llama-server.exe / serve.py) |

### Canonical URLs & Endpoints

| Purpose | URL |
|---------|-----|
| **Edge Pool (public mining)** | `77.42.71.94:8444` |
| **Edge RPC (public)** | `http://77.42.71.94:8443/jsonrpc` |
| **DAO API** | `http://77.42.71.94:8450` |
| **WARP API** | `http://77.42.71.94:8453` |
| **Website production** | `https://zionterranova.com` |
| **Dashboard** | (offline — Core unreachable) |
| **Edge Grafana** | `http://77.42.71.94:3100` |
| **Edge Prometheus** | `http://77.42.71.94:9090` |

### SSH Access

- **Edge server SSH key:** `ssh-key-zion-edge` (private), `ssh-key-zion-edge.pub` (public) — kept in root for operational access. Copy also exists at `~/.ssh/ssh-key-zion-edge` (non-empty).
- **Never commit private keys.**
- **SSH endpoint:** Direct public IP only — `ssh -i ssh-key-zion-edge root@77.42.71.94`. Tailscale is currently down.

### Edge Server Deployment (Autonomous 24/7)

The Edge server runs as the canonical primary node + pool. It must survive reboots without local PC intervention.

**Systemd services** (installed via `edge-deploy/deploy-edge.sh`):
- `zion-edge-node1.service` — Core node (P2P:8333, RPC:8443)
- `zion-edge-node2.service` — Follower node (P2P:8334, RPC:8446)
- `zion-edge-pool.service` — Mining pool (Stratum:8444)
- `zion-edge-dao.service` — DAO daemon (API:8450)
- `zion-edge-warp.service` — Cross-chain relay (API:8453)
- `zion-edge-miner.service` — CPU miner (connects to localhost:8444)
- `zion-edge-watchdog.service` — Health monitor (2-minute timer)
- `hiran-inference.service` — LLM inference (API:8002, optional)
- `hiranyagarbha.service` — Orchestrator (API:8001, optional)

**PM2 process:**
- `zion-website` — Next.js website on port 3000

**Docker stack** (Edge-only, optional):
- Prometheus (9090), Grafana (3100), Node Exporter (9100)
- Alertmanager (configurable Discord/Slack/Email webhooks)

**Persistence:**
- Node state: `/root/zion-2.9.6-main/V3/data/zion-node-state.db`
- Pool state: `/root/zion-2.9.6-main/V3/data/zion-pool-state.db`
- DAO DB: `/root/zion-2.9.6-main/V3/data/dao.db`
- Bridge DB: `/root/zion-2.9.6-main/V3/data/bridge.db`
- Logs: `/root/zion-2.9.6-main/V3/logs/`

### Genesis Configuration (v3.0.0 Mainnet)

**Current Genesis Hash (post-regeneration 2026-06-03):**
```
d28dc404abfd4e22b313d3a7e8b680453328a77ace68b47466a14d18aff6df5d
```

**Premine Distribution (16.28B total):**
- ZION OASIS (Slots 1-5): 1.65B each → 8.25B total
- DAO Treasury - Governance (Slot 6): 2.5B (LOCKED height 525,600)
- DAO Treasury - Grants (Slot 7): 1B (LOCKED height 525,600)
- DAO Treasury - Bootstrap (Slot 8): 0.5B (LOCKED height 525,600)
- Core Development Fund (Slot 9): 1B
- Network Infrastructure (Slot 10): 1B
- Genesis Creator (Slot 11): 0.59B
- Bridge Seed Fund (Slot 12): 0.4B
- Humanitarian (Slot 13): 1.44B

**Canonical Addresses:**
- Humanitarian: `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4`
- ISSOBELLA: `zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702`
- Pool Fee: `zion196m4n8x764v7a0s406j40094a8z5j8m6z7nk342`
- Default Miner: `zion1w523a76830x2t5m7f3j023w265e8g5c400a4790`
- Pool Payout: `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604`
- Bridge Vault: `zion106v7v0v0k3d500v0h7l636w0j4f5l4v044mh4a6` (100M ZION)
- Bridge Seed Fund: `zion13794g7k3m0f84637l2x0t855h3l258k8p3xp5t3` (400M ZION)

**Fee Split Configuration:**
- Miners: 89%
- Humanitarian: 5%
- ISSOBELLA: 5%
- Pool Fee: 1%

### Genesis Backup/Restore (Dashboard Integration)

**New Feature (2026-06-03):**
- **Location:** Dashboard tab "Launch Day" → "💾 Genesis Backup/Restore"
- **API Endpoint:** `/api/genesis-backup` with actions: list, create, restore, delete
- **Encryption:** 256-bit AES with HMAC verification
- **Multi-redundancy:** 3 copies per backup (original + 2 redundant copies)
- **Backup Location:** `backups/genesis-backup/` in repository root
- **Supported Files:**
  - Encrypted wallet keys (PREMINE_KEYS_ENCRYPTED_2026-06-03.txt, POOL_PAYOUT_KEY_ENCRYPTED_2026-06-03.txt, BRIDGE_VALIDATOR_KEYS_ENCRYPTED_2026-06-03.txt)
  - Genesis configuration (genesis.rs, fee.rs, crypto.rs)
  - Public addresses (PREMINE_ADDRESSES_PUBLIC.txt)
  - Documentation (AGENTS.md)

**Usage:**
1. Open dashboard at `http://127.0.0.1:8766`
2. Navigate to "Launch Day" tab
3. Scroll to "💾 Genesis Backup/Restore" section
4. Use buttons: List Backups, Create Backup, Restore Backup, Delete Backup
5. Automatic 3-copy redundancy for data safety

## Verification Steps

### Before making changes

1. Check current branch: `git branch --show-current`
2. Read relevant status docs: `StatusV3.md`, `V3/README.md`
3. Verify topology matches current operational state
4. Check for running services that might be affected

### After making changes

1. Run appropriate validation commands based on change type
2. Test affected services locally if possible
3. Verify no breaking changes to existing functionality
4. Update documentation if behavior changes

### For Rust changes

1. `cargo check --manifest-path V3/Cargo.toml --workspace`
2. `cargo test --manifest-path V3/Cargo.toml --workspace -- --test-threads=1`
3. `cargo clippy --manifest-path V3/Cargo.toml --workspace --all-targets`
4. `cargo fmt --manifest-path V3/Cargo.toml --all --check`

### For deployment changes

1. Update all relevant files (compose files, docs, runbooks)
2. Test deployment in development environment first
3. Verify service health after deployment
4. Update operational documentation

## Emergency Procedures

### Genesis Recovery

If genesis corruption is suspected:
1. Use dashboard Genesis Backup/Restore to restore from encrypted backup
2. Verify genesis hash matches expected value: `d28dc404abfd4e22b313d3a7e8b680453328a77ace68b47466a14d18aff6df5d`
3. Check all premine addresses and balances
4. Restart nodes if necessary
5. Verify network synchronization

### Edge Server Recovery

If Edge server becomes unresponsive:
1. SSH directly: `ssh -i ssh-key-zion-edge root@77.42.71.94`
2. If SSH fails, use Hetzner console
3. Check systemd services: `systemctl status zion-edge-node1 zion-edge-pool zion-edge-dao zion-edge-warp`
4. Restart services if needed: `systemctl restart zion-node.service`
5. Verify network connectivity and VPN status
6. Check Hetzner snapshot if complete recovery needed

### Pool Issues

If pool stops accepting connections:
1. Check pool logs: `journalctl -u zion-pool.service -f`
2. Verify node RPC is accessible: `curl http://127.0.0.1:8443/jsonrpc`
3. Check pool configuration: `V3/config/pool-mainnet.toml`
4. Restart pool service: `systemctl restart zion-pool.service`
5. Verify miners can reconnect

## Current Status (2026-06-06 01:30 UTC)

**System Status:**
- ✅ Genesis Regeneration: Complete (2026-06-05 final reset)
- ✅ Edge Node 1: Running (primary)
- ✅ Edge Node 2: Running (follower)
- ✅ Edge Pool: Running (fee split 89/5/5/1, PPLNS payouts active)
- ✅ Edge DAO: Running (port 8450)
- ✅ Edge WARP: Running (port 8453)
- ✅ Edge Server: Operational (77.42.71.94)
- ✅ Website: Running (PM2, port 3000)
- ✅ Pool Metrics: Running on port 8455
- ✅ Genesis Hash: `d28dc404abfd4e22b313d3a7e8b680453328a77ace68b47466a14d18aff6df5d`
- ⚠️  P2P Sync: Core (Local) offline — Edge runs solo

**Code Fixes DEPLOYED to Edge:**
- ✅ `emission.rs`: `MINING_EMISSION` corrected to 127.22B (was 127.72B)
- ✅ `genesis.rs`: Tests updated for 14 premine outputs + label derivation
- ✅ `launch.rs`: Premine count check updated to 14 + diagnostic prints
- ✅ `node_builder.rs`: Seed peer threshold for Edge-only topology
- ✅ `rpc.rs`: Supply info test updated for 16.78B premine
- ✅ `lib.rs`: Seed peer snapshot updated to 77.42.71.94
- ✅ `miner/Cargo.toml`: `hex` crate added for `sha3_debug` build

**Known Issues:**
- Auto-backup script produces empty state (height=0) — use manual backup before any restart

**Recent Fixes (2026-06-05/06):**
- ✅ Genesis keys regenerated (14 unique premine keypairs, no duplicates)
- ✅ `genesis_tx_id` fixed to depend on address (prevents silent chain splits)
- ✅ Fee split 89/5/5/1 verified on-chain in every block
- ✅ PPLNS payout system tested and working (pool redistributes 89% miner reward)
- ✅ All 10 failing tests fixed and passing locally
- ✅ Canonical subsidy addresses verified deterministic
- ✅ Edge node fully operational
- ✅ **Edge node rebuilt and redeployed with latest code**

**Windows 11 GPU Miner Build Workaround (2026-06-07):**
- `cargo build --release` fails on Windows 11 because `zion-miner.exe` in `V3/target/release/` is locked (Defender/antivirus).
- **Use absolute `CARGO_TARGET_DIR` to a fresh directory:**
  ```bash
  CARGO_TARGET_DIR="/c/Users/yosef/Desktop/Zion/2.9.6-main/V3/target3" cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl
  ```
- Canonical launch script: `start-miner-target3.bat` (reads from `V3/target3/release/`).
- Do NOT commit `target2/` or `target3/` to git.

**GPU Benchmark Results (RX 5700 XT, gfx1010:xnack-, work_size=8192, 2026-06-07):**
- DeekshaLite v1: **7.24 KH/s** (was ~3.89 KH/s before kernel optimization — +86%)
- Cosmic Harmony v2: **3.08 KH/s** (was ~1.1 KH/s before — +180%)
- Optimizations: host-precomputed Keccak256 header state + vectorized `ulong4` scratchpad ops.

**Next Steps:**
- Fix auto-backup script to capture live DB state
- Complete bridge validator 3/5 setup
- External audit of genesis configuration
- **MAINNET LAUNCH READY** — All critical systems operational

---

## SMOS Rig + Edge Deployment (PERMANENT REFERENCE — read every session)

### Access credentials

| Resource | Value |
|---|---|
| Edge SSH | `ssh -i ~/.ssh/ssh-key-zion-edge root@77.42.71.94` |
| Edge source | `/root/zion-2.9.6-main/` |
| Edge Cargo | `source ~/.cargo/env` (must prefix every cargo command) |
| SMOS API key | `api-4c47dab57e0890d3a36527fdd6a487b306f37e813aa254cfae1013588ece513f` |
| SMOS API base | `https://api.simplemining.net` (header: `X-AUTH-TOKEN: <key>`) |
| SMOS rig ID | `518837` (name: ZionRig / vega-smos) |
| SMOS group ID | `1765707` (ZION-Deeksha-AMD) |
| Rig GPU | AMD Vega 64 (gfx900:xnack-), GCN architecture |
| Rig OS | SimpleMining OS, kernel 5.15.80-sm, **GLIBC 2.31** |
| Rig SSH | `miner@<current_ip>` password: `omnity.company@gmail.com` (IP changes, behind NAT — use SMOS API to get it) |
| Rig local IP | typically 192.168.0.x (DHCP), check via SMOS API `/rigs/518837` |
| Pool payout wallet | `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604` |
| Mining wallet (rig) | `zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3` |

### CRITICAL: GLIBC incompatibility — ALWAYS build on rig, NOT on Edge

**Edge runs Ubuntu 26.04 → produces binaries requiring GLIBC 2.32+.**
**SMOS rig has GLIBC 2.31 → Edge-built binaries WILL NOT RUN on rig.**

To verify: `strings <binary> | grep 'GLIBC_' | sort -u` — if you see `GLIBC_2.32` or higher, the binary is incompatible.

**Only valid solutions:**
1. **Build natively on the rig** (preferred) — Rust is installed on rig, build takes ~1 min
2. Cross-compile with `cargo-zigbuild` targeting `x86_64-unknown-linux-gnu.2.31` — requires zig installed on Edge

**How to build on rig:**
```bash
# Get rig IP from SMOS API first
RIG_IP=$(curl -s -H "X-AUTH-TOKEN: api-4c47dab57e0890d3a36527fdd6a487b306f37e813aa254cfae1013588ece513f" \
  https://api.simplemining.net/rigs/518837 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ip',''))")
echo "Rig IP: $RIG_IP"

# SSH onto rig and build
ssh miner@$RIG_IP  # password: omnity.company@gmail.com

# On rig:
source ~/.cargo/env
cd /tmp/zion-build   # or wherever source was synced
cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl
```

### SMOS custom miner package format (EXACT — do not deviate)

SMOS expects packages in `/root/miner_org/` on the rig as `custom_<NAME>.tar.gz`.
If the tar.gz MD5 doesn't match or is missing, SMOS re-downloads the ZIP from the URL in `config.json` and repacks it.

**ZIP structure required (what you serve at the URL):**
```
zion-miner-v3.0.XX-gpu.zip
└── zion-miner-v3.0.XX-gpu/       ← folder name = zip name without .zip
    ├── miner                      ← bash wrapper script (executable)
    └── miner.real                 ← actual ELF binary (executable)
```

**`miner` wrapper script content:**
```bash
#!/bin/bash
export ZION_MINER_ALGORITHM=deeksha_lite_v1
export ZION_GPU_BACKEND=opencl
export ZION_NO_GCN_S4_MODE=1
export ZION_LOOP_COUNT=1000000
export ZION_POOL_ADDR=77.42.71.94:8444
export ZION_WORKER_NAME=vega-smos
export ZION_PAYOUT_ADDRESS=zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3
cd "$(dirname "$0")"
exec ./miner.real "$@"
```

**Create zip on Edge (after binary is built on rig and copied to Edge):**
```bash
NAME="zion-miner-v3.0.XX-gpu"
mkdir -p /tmp/$NAME
cp <binary> /tmp/$NAME/miner.real
# write wrapper as /tmp/$NAME/miner
chmod +x /tmp/$NAME/miner /tmp/$NAME/miner.real
cd /tmp && zip -r ${NAME}.zip ${NAME}/
cp /tmp/${NAME}.zip /var/www/zion-miner/
```

**SMOS config.json `miner` field format:**
```
https://zionterranova.com/zion-miner/zion-miner-v3.0.XX-gpu.zip <extra_args>
```
The part before the first space is the URL; SMOS derives `MINER_PKG_NAME` from the filename without `.zip`.

### SMOS API — useful calls

```bash
API="api-4c47dab57e0890d3a36527fdd6a487b306f37e813aa254cfae1013588ece513f"
BASE="https://api.simplemining.net"

# Get rig details (incl. current IP)
curl -s -H "X-AUTH-TOKEN: $API" $BASE/rigs/518837 | python3 -m json.tool

# Get rig list
curl -s -H "X-AUTH-TOKEN: $API" "$BASE/rigs?itemsPerPage=50" | python3 -m json.tool

# Reboot rig
curl -s -X PATCH -H "X-AUTH-TOKEN: $API" $BASE/rigs/518837/reboot

# Reload miner (re-download + restart without full reboot)
curl -s -X PATCH -H "X-AUTH-TOKEN: $API" $BASE/rigs/518837/reload

# Change group config (set new miner URL etc.)
curl -s -X PATCH -H "X-AUTH-TOKEN: $API" \
  -H "Content-Type: application/json" \
  -d '{"minerUrl":"https://zionterranova.com/zion-miner/zion-miner-vX.X.X-gpu.zip"}' \
  $BASE/rigs/518837/group-config
```

### Known Vega 64 / GCN mining issues

- `SELF_TEST s4_memhard=FAIL` — known GCN Blake3 mismatch, miner continues anyway (`ZION_NO_GCN_S4_MODE=1` bypasses s4-only path)
- **ALWAYS** set `ZION_NO_GCN_S4_MODE=1` for Vega 64 / GCN rigs
- **ALWAYS** set `ZION_LOOP_COUNT=1000000` (default=1 causes reconnect every iteration → ~30 H/s instead of ~3 KH/s)
- GCN work_size cap: 512 (do not set higher)
- Algorithm for GCN: `deeksha_lite_v1` (not `cosmic_harmony` — too heavy for GCN sustained mining)

### Web serving (Caddy on Edge)

- Caddy serves `/zion-miner/*` → `/var/www/zion-miner/`
- Base URL: `https://zionterranova.com/zion-miner/`
- Caddyfile: `/etc/caddy/Caddyfile` (or `/root/Caddyfile` — check `systemctl status caddy`)
- After adding new zip: verify with `curl -sI https://zionterranova.com/zion-miner/<filename>.zip`

### Edge systemd services

```bash
# Pool
systemctl status zion-edge-pool.service
journalctl -u zion-edge-pool.service -f

# Node
systemctl status zion-edge-node.service
journalctl -u zion-edge-node.service -f

# Pool binary location
/root/zion-2.9.6-main/V3/target/release/zion-pool-server

# After rebuild, restart pool:
systemctl restart zion-edge-pool.service
```