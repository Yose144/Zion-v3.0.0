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
- Desktop agent:
  - `npm --prefix "APP&WEB/desktop-agent" install`
  - `npm --prefix "APP&WEB/desktop-agent" run start`
  - `npm --prefix "APP&WEB/desktop-agent" run test`

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

Current live topology is **Core + Edge over Tailscale VPN**. Do not reference old multi-server topologies (Praha, SG, Helsinki, US) — those are deprecated.

```
Core (Windows 11)          Edge (Hetzner VPS)
100.86.102.5              100.66.162.125
    | Tailscale VPN            |
Node + Pool (Master)    Node + Pool (Relay)
Miner (GPU)               Public P2P: 8333
                          Public Pool: 8444
```

| Role | Host | VPN IP | Public IP | Ports |
|------|------|--------|-----------|-------|
| Core | Local PC | 100.86.102.5 | (dynamic) | P2P: 8333, RPC: 8443 |
| Edge | Hetzner VPS | 100.66.162.125 | 77.42.71.94 | P2P: 8333, Pool: 8444, RPC: 8443 |

### Canonical Ports & Services

| Service | Port | Protocol | Notes |
|---------|------|----------|-------|
| Node P2P | 8333 | TCP | Peer-to-peer sync |
| Node RPC | 8443 | TCP | JSON-RPC 2.0, wallet queries |
| Pool Stratum | 8444 | TCP | Miner connections (Edge public-facing) |
| Pool metrics | 9100 | HTTP | Prometheus metrics (pool) |
| Node metrics | 9115 | HTTP | Prometheus metrics (node) |
| Dashboard | 8766 | HTTP | Python stdlib dashboard |
| Website | 3000 | HTTP | Next.js dev server |
| **Hiranyagarbha API** | **8001** | HTTP | Orchestrator · RAG · Consciousness · Axum (Rust) |
| **Hiran Inference** | **8002** | HTTP | OpenAI-compatible LLM API (llama-server.exe / serve.py) |

### Canonical URLs & Endpoints

| Purpose | URL |
|---------|-----|
| **Edge Pool (public mining)** | `77.42.71.94:8444` |
| **Edge RPC (public)** | `http://77.42.71.94:8443/jsonrpc` |
| **Edge RPC (VPN fallback)** | `http://100.66.162.125:8443/jsonrpc` |
| **Local RPC (default)** | `http://127.0.0.1:8443/jsonrpc` |
| **Desktop agent default RPC** | `http://127.0.0.1:8443/jsonrpc` (auto-fallback to Edge VPN) |
| **Website production** | `https://zionterranova.com` |
| **Dashboard** | `http://127.0.0.1:8766` |

### SSH Access

- **Edge server SSH key:** `ssh-key-zion-edge` (private), `ssh-key-zion-edge.pub` (public) — kept in root for operational access.
- **Never commit private keys.** The existing keys in root are grandfathered; rotate if compromised.
- **SSH endpoint:** Use Tailscale SSH (`100.66.162.125`) or direct Hetzner console for Edge server management.

### Dashboard Configuration

The Python dashboard (`dashboard/app.py`) monitors Core + Edge services:

| Config | Value |
|--------|-------|
| Host | `127.0.0.1` |
| Port | `8766` |
| Services monitored | `node1`, `node2` (via VPN), `pool`, `pool-edge`, `miner` |
| Auto-start | See `DASHBOARD_AUTOSTART.md` + `install-dashboard-autostart.bat` |

### Desktop Agent Defaults

```javascript
// src/main.js constants
const PRIMARY_MAINNET_HOST = '77.42.71.94';
const PRIMARY_POOL_PORT = 8444;
const PRIMARY_RPC_PORT = 8443;
const EDGE_VPN_HOST = '100.66.162.125';
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
003529805e9b47babb9ac0f26b27b1aad0a1cf3c483181857daf3269f7088923
```

Verify against `PREMINE_ADDRESSES_PUBLIC.txt` and `V3/L1/core/src/genesis.rs`.

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
  │
  └── ▶ Start Hiran Inference  →  scripts/start-hiran-inference.ps1
          └── llama-server.exe (preferred) OR serve.py  →  http://127.0.0.1:8002
              Backend priority: llama-server.exe > LM Studio (1234) > Ollama (11434) > serve.py

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
