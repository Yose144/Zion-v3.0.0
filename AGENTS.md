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
- Hiranyagarbha / Hiran **v2.1** roadmap (ZION-domain model + curated non-ZION RAG corpora): [`HiranV2.1/Hiran_v2.1.md`](./HiranV2.1/Hiran_v2.1.md) (oddíl 3.6 / § 1.1 agent contract); prováděcí plán: [`HiranV2.1/PLAN_v2.1.md`](./HiranV2.1/PLAN_v2.1.md); LoRA / Vast fine-tune: [`HiranV2.1/finetune/README.md`](./HiranV2.1/finetune/README.md); upgrade context: [`HIRANYAGARBHA_UPGRADE_PLAN.md`](./HIRANYAGARBHA_UPGRADE_PLAN.md) § 0.2.1.
- Historical archive exists at `docs/2.9.9/archive/WARP.md`; treat it as legacy context, not current source of truth for V3 runtime behavior.

## Agent operating rules

- Start by checking branch/worktree state, then read the smallest relevant status docs before editing.
- Default to minimal, focused changes. Do not refactor or normalize old folders unless explicitly asked.
- Never run destructive operations without explicit user approval: history rewrites (`git filter-repo`, BFG), force pushes to shared branches, deleting datadirs, or production deploys.
- Do not open, copy, print, or reintroduce leaked private keys or credential values. Refer to documented secret-bearing paths by filename only, and recommend rotation/scrub.
- Keep launch/security blockers visible: credential rotation, history scrub, clean Genesis #0 rollout, bridge 3/5 validator provisioning, CI billing, external audit, and bug bounty.
- Prefer `V3/cli` and documented runbooks over ad-hoc scripts for operations.
- For Hiran v2.1 work, keep `V3/` + `StatusV3.md` as the technical canon; use external corpora through licensed, cited RAG snapshots rather than dumping copyrighted material into SFT weights.

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

## 6) Hiran v2.2 AI Model Training (Completed 2026-05-18)

Hiran v2.2 is a domain-specific fine-tuned model for the Zion ecosystem. Training artifacts and evaluation reports live in `HiranV2.2/`.

### Training stack
- **Base model:** `unsloth/Meta-Llama-3.1-8B-Instruct`
- **Method:** QLoRA (curriculum, 5 stages)
- **Dataset:** 22,181 instruction/output pairs across:
  - `foundation` (3,869) → rank 16, 2 epochs, final loss ~1.297
  - `zion_core` (2,368) → rank 32, 3 epochs
  - `zion_advanced` (2,458) → rank 32, 2 epochs, final loss ~1.040
  - `cross_domain` (11,434) → rank 64, 2 epochs, final loss ~1.246
  - `rag_synthesis` (2,052) → rank 64, 1 epoch, final loss ~2.469
- **Hardware:** Vast.ai RTX 4090 (contract #37028568, IP 213.181.123.6:32264)
- **Merged model size:** ~15 GB (FP16)
- **Training script:** `HiranV2.2/scripts/train_v2.2.py`
- **Merge script:** `HiranV2.2/scripts/merge_and_quantize.py`

### Key learnings from this run
1. **QLoRA limits:** With 22K pairs and max rank 64, the model learned *concepts* and *style* but did **not** reliably memorize exact numeric facts (e.g. fee split 89/5/5/1). Base model parameters dominated for precise percentages.
2. **Temperature sensitivity:** Low temperatures (`<0.3`) without system prompts triggered base model contamination (e.g. hallucinating Mormon church associations with "Zion").
3. **System prompt anchoring works:** Adding an explicit system prompt ("You are the Zion DAO technical assistant...") eliminated religious contamination and anchored responses to the crypto project.
4. **Few-shot is inconsistent:** Even with explicit examples of correct percentages, the model sometimes invented new numbers (e.g. 6% instead of 5% for Issobella).
5. **Adversarial safety:** Model refused to assist with attack scenarios (manipulating fee splits), which is a positive safety signal.
6. **Inference speed:** ~40 tokens/s on RTX 4090 with FP16, ~16 GB VRAM usage.

### Evaluation artifacts
- `HiranV2.2/MODEL_INTERVIEW_REPORT.md` — 20-question structured interview
- `HiranV2.2/model_interview_results.json` — machine-readable responses
- `HiranV2.2/gpu_experiment_results.json` — benchmark + temperature sweep + factual recall
- `HiranV2.2/gpu_experiment_results_v2.json` — system prompt + few-shot + chain-of-thought tests

### Vast.ai workflow (for future runs)
1. Provision instance via `vastai create instance` (prefer RTX 4090/3090, ~$0.46/hr)
2. Attach SSH key: `vastai attach ssh <contract_id> $(cat ~/.ssh/vast_hiran_key.pub)`
3. Get actual endpoint: `vastai ssh-url <contract_id>` (advertised endpoint != actual!)
4. Sync: use `HiranV2.2/scripts/sync_to_current_vast.sh` or manual `scp -r`
5. Training: `cd /workspace/hiran-v2.2 && bash scripts/run_training.sh`
6. Post-training: merge with `scripts/merge_and_quantize.py`, evaluate with `scripts/interview_model.py`
7. Keep instance alive for evaluation; artifacts can stay remote if bandwidth is concern

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
