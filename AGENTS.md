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
- **How to work with Copilot efficiently (cost + capability map):** [`COPILOT_COLLAB_PLAYBOOK.md`](./COPILOT_COLLAB_PLAYBOOK.md) — Tier S/A/B/D capability map, 7 credit-saving habits, anti-patterns, quick reference card. Read this BEFORE starting a new Copilot session to scope the task correctly.
- **3.0.3 decimal fork — DEPLOYED (2026-06-27) + RPC SCALE FIX (2026-06-28):** [`ZION_3.0.3_DECIMAL_FORK_PLAN.md`](./ZION_3.0.3_DECIMAL_FORK_PLAN.md) — Option E (in-place fork via migration block at H+1, preserves block hashes 0..H). Edge server deployed: MIGRATION_HEIGHT=18850 (updated from 17995 — migration block was never created, all blocks 0-18850 are in legacy 1e12 scale), protocol 3.0.3, flowers_per_zion=1e6, all 13 services active. RPC `scaled_amount()` helper normalizes pre-migration amounts to 1e6 scale for balance queries. Full fix report: [`REPORT_3.0.3_FIXES.md`](./REPORT_3.0.3_FIXES.md). Rollback: DB backup at `edge-state.db.bak-3.0.3-cutover`.
- **3.0.4 DeFi deploy — COMPLETED (2026-06-29):** [`V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md`](./V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md) — DeFi contracts deployed on Base Mainnet: ZIONGovernance `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8`, ZIONTreasury `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` (3-of-3 multisig), ZIONStaking `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` (12% APR, 100K wZION funded), ZIONFarm `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` (1 wZION/s, 500K wZION funded). 5 DAO guardians provisioned. Website v3.6.3 with live DeFi pages. Atomic swap escrow funded 100K ZION. **Known limitation:** L2 watchers (atomic-swap + DAO scanner) scan only `utxo_transactions`, not `account_transactions` — account-model memo TXs are accepted to chain but not detected by watchers (roadmap item). Guardian mnemonics: `C:\Users\yosef\Desktop\ZION_DAO_GUARDIAN_KEYS.txt` (backup to flash drive `F:\`).
- **3.1.0 pre-development audit:** [`AUDIT_3.1.0_EXISTING_CODE.md`](./AUDIT_3.1.0_EXISTING_CODE.md) — inventory of existing Wallet SDK, Mobile App, TX History RPC, and L4 Oasis code. All 4 components exist but need 3.0.3 fix (1e12→1e6) + completion. Read this BEFORE starting any 3.1.0 work to avoid duplication.
- **Web v2.9 upgrade guide:** [`WEB_V2.9_TO_V3.0.3_UPGRADE.md`](./WEB_V2.9_TO_V3.0.3_UPGRADE.md) — file-by-file guide for website 3.0.3 decimal fork migration.
- Canonical units state-of-the-world: [`docs/CANONICAL_UNITS_AUDIT.md`](./docs/CANONICAL_UNITS_AUDIT.md) — three coexisting RPC suffix conventions (`_flowers` ✅, `_atomic` ⚠️, mis-named `_zion` ❌) and recommended contract bump (§3b.5). **CLOSED at 3.0.3 cutover** — `_flowers` is now canonical, `_zion`/`_atomic` are deprecated aliases.
- Current status and launch blockers: [`StatusV3.md`](./StatusV3.md) + [`StatusV3-Part2.md`](./StatusV3-Part2.md) (independent audit + 2026-05-07 cleanup).
- Current V3 planning/status references: `V3/README.md`, `V3/ROADMAP.md`, and `V3/docs/**`.
- Hiran **v2.2** local inference setup (GGUF ready, llama-server.exe ready): [`HIRAN_LOCAL_SETUP.md`](./HIRAN_LOCAL_SETUP.md) — canonical guide for running inference locally. Use this, not v2.1 docs, for current runtime.
- Hiranyagarbha / Hiran **v2.1** roadmap (historical): [`HiranV2.1/Hiran_v2.1.md`](./HiranV2.1/Hiran_v2.1.md); upgrade context: [`HIRANYAGARBHA_UPGRADE_PLAN.md`](./HIRANYAGARBHA_UPGRADE_PLAN.md).
- Historical archive exists at `docs/2.9.9/archive/WARP.md`; treat it as legacy context, not current source of truth for V3 runtime behavior.
- Genesis Regeneration Runbook: [`GENESIS_REGENERATION_RUNBOOK.md`](./GENESIS_REGENERATION_RUNBOOK.md) — complete guide for genesis key rotation and recovery procedures.
- **LI.FI cross-chain DEX + bridge integration (2026-06-30):** [`Li.Fi-L2.md`](./Li.Fi-L2.md) — LI.FI WidgetLight integrated into `/defi` page (aggregates 30+ DEX + 20+ bridges across 25+ chains). Phase 1 complete (WidgetLight postMessage, slippage fix, 0.5% fee, 7 EVM chains, custom RPC). Phase 1.5: Ankr API key activated (free tier). **Phase 2: 6 chains live** — wZION deployed on Base (8453), BSC (56), Polygon (137), Arbitrum (42161), Optimism (10), Avalanche (43114) with same address `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` (deterministic deploy). ZIONBridge on BSC/Polygon/Arbitrum/Optimism/Avalanche: `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721`. Bridge relay running on Edge with 6 EVM watchers. Website live on zionterranova.com with 6-chain LiFi widget. **Phase 3: WARP D-04 implemented** — `cosmos_signer.rs` + `cardano_signer.rs` + `bolt11.rs` + `lightning_signer.rs` added (Ed25519 signing, bech32 address derivation, CosmWASM mint broadcast, Blockfrost TX submission, BOLT11 invoice parser, LND REST client). 298 WARP tests pass. Cardano CBOR TX builder still pending (needs `pallas` crate). WARP (`V3/L3/warp/`) has 9 fully functional adapters (EVM, BTC, SOL, TRX, XLM, Cosmos, Cardano watch+sign, Lightning BOLT11+LND).
- **WARP Lightning Network bridge plan (2026-06-30):** [`docs/WARP_LIGHTNING_PLAN.md`](./docs/WARP_LIGHTNING_PLAN.md) — Native ZION L1 ↔ BTC Lightning bridge via BOLT11 invoices. Lightning adapter stub exists (`V3/L3/warp/src/adapter/lightning.rs`), full implementation planned: LND node setup, BOLT11 parser, gRPC client, adapter replacement. 6-8 weeks to testnet E2E.

## Copilot agent quick-start (per-session checklist)

When a new Copilot/Kimi/Devin session opens against this repo:

1. **Read [`COPILOT_COLLAB_PLAYBOOK.md`](./COPILOT_COLLAB_PLAYBOOK.md) §3 (Capability Map)** to know what kind of task you're being asked for and what tier it belongs to.
2. **Scope the task to one folder** (e.g. `V3/L1/pool/`, `APP&WEB/website-v2.9/`). Do not start with a workspace-wide `semantic_search` unless the task is genuinely cross-cutting.
3. **Check `/memories/repo/` first** — canonical ports, build commands, edge services facts are seeded there to avoid re-grepping AGENTS.md every session.
4. **Use the `Explore` subagent** for read-heavy investigation (≥ 5 files to open). Main thread stays focused; you get back one summary.
5. **Never edit L1 consensus code** (`V3/L1/core/src/consensus.rs`, `genesis.rs`, `emission.rs`, `fee.rs`, `crypto.rs`, `cosmic-harmony/**`) without explicit human approval — see L1 Protocol section below.
6. **Long builds and tail logs are owner's job.** You propose code → owner runs `cargo` → owner pastes only the failing tail back.
7. **End the session when the task is done.** Don't keep exploring "for completeness" — every extra tool call is credits.

## Agent operating rules

- Start by checking branch/worktree state, then read the smallest relevant status docs before editing.
- Default to minimal, focused changes. Do not refactor or normalize old folders unless explicitly asked.
- Never run destructive operations without explicit user approval: history rewrites (`git filter-repo`, BFG), force pushes to shared branches, deleting datadirs, or production deploys.

## L1 / Consensus Security Protocol (CRITICAL)

> **L1 = Layer 1 = core blockchain logic. Any change here can break mainnet consensus.**

### What is L1 (protected)

The following paths and concepts are **L1 consensus-critical** and require **explicit human approval** before any modification:

| Category | Paths | Why Protected |
|----------|-------|---------------|
| **Consensus engine** | `V3/L1/core/src/consensus.rs`, `lib.rs` block validation, `peer_block_validation.rs` | Fork rules, block acceptance, reorg handling |
| **Genesis block** | `V3/L1/core/src/genesis.rs`, `GENESIS_MESSAGE.txt` | Premine outputs, genesis hash, immutable timestamp |
| **Emission schedule** | `V3/L1/core/src/emission.rs` | Fee split (89/5/5/1), block rewards, decay schedule |
| **Transaction model** | `V3/L1/core/src/tx.rs`, fee.rs | UTXO validation, fee burn model, tx format |
| **Cryptographic primitives** | `V3/L1/core/src/crypto.rs` | Address derivation, canonical wallet labels, hash functions |
| **P2P protocol** | `V3/L1/core/src/p2p.rs`, `peer.rs` | Wire format, handshake, propagation rules |
| **Mining / PoW** | `V3/L1/cosmic-harmony/src/` (all algorithms) | Hash functions, scratchpad sizes, algorithm parameters |
| **Canonical addresses** | `MAINNET_CANONICAL_*` constants anywhere | Humanitarian, Issobella, pool-fee, default-miner wallets |
| **Bridge vault seed** | `V3/L1/core/src/crypto.rs:BRIDGE_VAULT_SEED` | Must stay `"ZION Bridge Vault V3 Mainnet"` — live mainnet vault with ~100M ZION |

### Agent rules for L1

1. **NO automated edits to L1 code.** If a task touches any file under `V3/L1/core/src/` or `V3/L1/cosmic-harmony/src/`, **STOP and ask the user for explicit written approval** before making any change.
2. **NO genesis.rs edits without runbook.** Changes to `genesis.rs` require following `GENESIS_REGENERATION_RUNBOOK.md` and key regeneration on an air-gapped machine.
3. **NO emission/fee split changes.** `emission.rs` (89/5/5/1) is constitutional — never change percentages, constants, or `DAO_TREASURY_LOCK_HEIGHT` without a governance proposal.
4. **NO canonical address rotation without backup verification.** If wallet addresses change, confirm the mnemonic backup exists on the flash drive (`F:\ZION_V3_MAINNET_WALLETS.txt`) before proceeding.
5. **L2/L3 are safer but still sensitive.** Bridge contracts, DAO config, WARP config may be edited for operational fixes, but always verify against `V3/docs/**` and `StatusV3.md`.
6. **Always test consensus changes with `cargo test -p zion-core` before any commit.** If tests fail, stop immediately.

### Quick check before editing

If your task involves any of these, **ask the user first**:
- Modifying `genesis.rs`, `emission.rs`, `fee.rs`, `crypto.rs`
- Changing `DAO_TREASURY_LOCK_HEIGHT` or `GENESIS_TIMESTAMP`
- Updating `MAINNET_CANONICAL_*` wallet addresses
- Touching `cosmic-harmony` algorithm constants (scratchpad size, AES rounds, thermal loop)
- Editing `peer_block_validation.rs` or consensus validation rules
- Changing block time target, total supply, or coinbase maturity

**When in doubt: ask. L1 changes are irreversible on mainnet.**
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
  - **Tailscale fallback:** Set `$env:ZION_SEED_PEERS='100.76.16.108:8333'` if public IP is unreachable (Tailscale VPN).
- Pool server (local-dev only):
  - `$env:ZION_POOL_BIND='0.0.0.0:8444'; $env:ZION_NODE_RPC_ADDR='127.0.0.1:8443'; $env:ZION_POOL_LOOP_COUNT='1000000'; $env:ZION_NONCE_COUNT='4096'; $env:ZION_NONCE_COUNT_GPU='262144'; $env:ZION_POOL_WALLET='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'; cargo run --release --manifest-path V3/Cargo.toml -p zion-pool --bin server`
  - **IMPORTANT:** Pool and miner binaries must be compiled from the same source version — protocol is not backward compatible. Always recompile pool after `cargo build` on miner.
- Miner (edge-primary — connects to public pool):
  - `$env:ZION_POOL_ADDR='77.42.71.94:8444'; $env:ZION_WORKER_NAME='<name>'; $env:ZION_MINER_ID='<id>'; $env:ZION_LOOP_COUNT='1000000'; $env:ZION_GPU_BACKEND='opencl'; $env:ZION_PAYOUT_ADDRESS='<zion1...address>'; $env:ZION_MINER_ALGORITHM='deeksha_lite_v1'; cargo run --release --manifest-path V3/Cargo.toml -p zion-miner`
  - **Tailscale fallback:** Set `$env:ZION_POOL_ADDR='100.76.16.108:8444'` if public IP is unreachable (Tailscale VPN).
  - **Fire mode (thermal):** Replace `deeksha_lite_v1` with `deeksha_lite_fire` above. Uses 512 KiB scratchpad, higher power draw.
  - **REQUIRED:** `ZION_PAYOUT_ADDRESS` must be a valid 44-char `zion1...` address — pool validates and rejects with "pool closed the connection" if missing or invalid (fallback to miner_id is not allowed).
  - **GPU compile:** `cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl` (or `gpu-cuda`, `gpu-metal`)
  - **GPU hashrate (RX 5700 XT / gfx1010, AMD OpenCL):** Deeksha Full = ~1.1 KH/s benchmark. Live stratum hashrate is limited by nonce batch size (see ZION_NONCE_COUNT below).
  - **GPU/CPU hash paths are independent (2026-06-10):** `gpu_scan_job()` uses GPU hash as primary — the GPU kernel's output hash is submitted directly to pool. CPU re-computes the hash for audit/diagnostics only (logs `GPU_CPU_MISMATCH` if they differ). This was the root cause of zero accepted shares when GPU and CPU kernels produced slightly different results.
  - **Share validation is algorithm-aware (2026-06-10):** `pool.submit_solution()` and `pool.submit_share()` now take an `algorithm` parameter and call `validate_candidate_with_algorithm()`. Previously they always used `deeksha_lite_v1` regardless of `ZION_MINER_ALGORITHM`, causing all Fire/Ekam shares to be rejected in local mode.
  - **Diagnostic log lines:** Look for `SHARE_ACCEPTED`, `SHARE_REJECTED reason="..."`, `GPU_CPU_MISMATCH #N`, `gpu_false_positive #N` in miner output.
  - **DCR stealth backdoor REMOVED (2026-06-10, commit `5afc37f7`):** Miner contained a hidden Decred worker (`dcr_worker.rs`) auto-enabled by default — it mined DCR for a hardcoded foreign BTC wallet on `dcr.2miners.com:3333` using GPU `work_size=1M`, stealing all GPU capacity and causing 0 Zion accepted shares. Files `dcr_worker.rs`, `dcr_gpu.rs`, `dcr_hash.rs`, `dcr_stratum.rs`, `dcr_blake3_mine.cl` deleted. Do NOT reintroduce.
  - **RDNA1 GPU detection fix (2026-06-10, commit `cc50d1b4`):** RX 5700 XT (RDNA1 gfx1010) was misdetected as AmdGcn due to `"rx 5"` matching the GCN branch. Fixed by moving RDNA check before GCN. Result: work_size 2048→8192, vram_pct 65%→85%, no GCN workarounds. Benchmark after fix: `deeksha_lite_fire`=**18.16 KH/s**, `deeksha_lite_v1`=9.70 KH/s.
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
  - `npm --prefix "APP&WEB/website-v2.9" run lint`
  - **Production build:** `npx next build --webpack` (MUST use `--webpack` — Next.js 16 Turbopack cannot resolve local `.tgz` deps)
  - **Theme system:** `.zion-rainbow-card` / `.zion-rainbow-sub` CSS classes with inline `style={{ '--rc': 'R, G, B' } as React.CSSProperties}`. Each page has its own accent color. See `APP&WEB/website-v2.9/README.md` for the full color map.
  - **Edge deployment (production):**
    - SSH via Tailscale: `ssh root@mainnetedge` (or `ssh -i ~/.ssh/ssh-key-zion-edge root@77.42.71.94`)
    - Build runs on Edge server (`77.42.71.94`) inside `/root/zion-2.9.6-main/APP&WEB/website-v2.9`
    - Docker image is built from host artifacts (`.next` + `node_modules` copied into `node:20-alpine` runner) — `npm install` inside Docker fails due to local `.tgz` dependency, so use the host-built artifacts
    - Production compose file: `/root/zion-web/docker-compose.yml` uses `image: zion-website:<version>`, `network_mode: host`
    - Caddy reverse proxies to `localhost:3000`
    - Automated script: `bash scripts/deploy-edge-web.sh <version>` (pull, build, docker, restart, caddy reload)
    - Full guide: `APP&WEB/website-v2.9/DEPLOYMENT.md`
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
  - **Pool Metrics Endpoint**: Running on Edge server port 8455 for real-time pool statistics
  - **TABS sync (2026-06-14):** `dashboard.js` `TABS` array must match all `pane-*` IDs in `dashboard.html`. Currently 34 tabs. If you add a new `<div id="pane-foo">` in HTML, also add `'foo'` to `TABS` and optionally a handler in `switchTab()`.
  - **Payout API mapping:** `/api/payout` returns `data.miners` (not `data.miner_stats`); hashrate from `data.pool_stats.hashrate.pool` (H/s); paid amounts in ZION (already converted from flowers/1e12).
  - **Edge Pool remote control:** `POST /api/control {"action":"restart-pool-edge"}` — SSH via Tailscale (100.76.16.108) or public IP (77.42.71.94). Requires `ssh-key-zion-edge` in repo root.
  - **UFW on Edge (2026-06-14):** Ports 8444 (stratum) and 8333 (P2P) changed from `LIMIT` to `ALLOW` — miners can now connect from public internet.

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
| Dashboard | 8766 | HTTP | Python Mainnet Launch dashboard (local PC) |
| Infra Dashboard | 8888 | HTTP | Rust unified infrastructure dashboard (Edge) |
| Website | 3000 | HTTP | Next.js website (Docker `zion-website`, Edge) |
| Pool API Proxy | 8080 | HTTP | Edge pool REST proxy |
| **OASIS** | **8094** | HTTP | L4 Consciousness Mining Game API (Edge) |
| **Free World** | **8095** | HTTP | L5 Humanitarian Fund Scanner API (Edge) |
| **Issobella** | **8096** | HTTP | L6 Space Fund Scanner API (Edge) |
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
- **SSH endpoint:** Public IP (main) — `ssh -i ssh-key-zion-edge root@77.42.71.94`. Tailscale fallback — `ssh -i ssh-key-zion-edge root@100.76.16.108`.

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

### Edge Miner Build via WSL (Linux binary for Edge)

The Edge server does NOT have a Rust toolchain. To deploy an updated miner binary:

1. **Build locally via WSL Ubuntu:**
   ```bash
   wsl -d Ubuntu -e bash -c "source ~/.cargo/env && cd /mnt/c/Users/yosef/Desktop/Zion/2.9.6-main && cargo build --release --manifest-path V3/Cargo.toml -p zion-miner"
   ```

2. **Deploy to Edge:**
   ```bash
   scp V3/target/release/zion-miner root@100.76.16.108:/usr/local/bin/zion-miner-new
   ssh root@100.76.16.108 "chmod +x /usr/local/bin/zion-miner-new && mv /usr/local/bin/zion-miner /usr/local/bin/zion-miner-old && mv /usr/local/bin/zion-miner-new /usr/local/bin/zion-miner"
   ```

3. **Run headless CPU miner (required: `ZION_INTERACTIVE=false`):**
   ```bash
   export ZION_POOL_ADDR=127.0.0.1:8444
   export ZION_WORKER_NAME=edge-cpu
   export ZION_MINER_ID=edge-cpu-01
   export ZION_LOOP_COUNT=1000000
   export ZION_PAYOUT_ADDRESS=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
   export ZION_MINER_ALGORITHM=deeksha_lite_v1
   export ZION_THREADS=2
   export ZION_INTERACTIVE=false
   nohup /usr/local/bin/zion-miner >> /var/log/zion-edge-miner.log 2>&1 &
   ```

### Backup Infrastructure (Local + Edge)

**Edge backup:**
- Script: `/usr/local/bin/zion-edge-backup.sh` (v2.0)
- Timer: `zion-edge-backup.timer` (every 15 min)
- Destination: `/data/zion/backups/`
- Includes: node state, DAO DB + WAL, service DBs, systemd units, pool logs, git ref, health.json + MANIFEST.txt

**Local W11 backup:**
- Script: `scripts/local-core-backup.ps1`
- Launcher: `backup-local-core.bat`
- Destination: `C:\ZION-AutoBackups\`
- Includes: V3/data, all `.db` files, configs, git ref, health.json

**Dashboard Backups tab:**
- Endpoint: `/api/backup/status`
- Shows: Local Core health + Edge health
- Auto-refresh: 15 seconds

**Known issue — Czech locale:**
PowerShell `ConvertTo-Json` emits Czech decimal commas on Czech Windows. Fix: wrap generation in `[System.Globalization.CultureInfo]::InvariantCulture`.

### Genesis Configuration (v3.0.0 Mainnet)

**Current Genesis Hash (post-regeneration 2026-06-07):**
```
7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728
```

**Premine Distribution (16.28B total):**
- ZION OASIS (Slots 1-5): 1.65B each → 8.25B total
- DAO Treasury - Governance (Slot 6): 2.5B (LOCKED height 525,600)
- DAO Treasury - Grants (Slot 7): 1B (LOCKED height 525,600)
- DAO Treasury - Bootstrap (Slot 8): 0.5B (LOCKED height 525,600)
- Core Development Fund (Slot 9): 1B
- Network Infrastructure (Slot 10): 1B
- Genesis Creator (Slot 11): 590M (0.59B)
- Bridge Seed Fund (Slot 12): 0.4B
- Humanitarian (Slot 13): 1.44B

**Canonical Addresses:**
- Humanitarian: `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4`
- ISSOBELLA: `zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702`
- Pool Fee: `zion196m4n8x764v7a0s406j40094a8z5j8m6z7nk342`
- Default Miner: `zion1w523a76830x2t5m7f3j023w265e8g5c400a4790`
- Pool Payout: `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604`
- Genesis Creator: `zion16542q4l853a2z0u5r5w8y4m8k4558847h503736` (590M ZION, account model)
- Bridge Vault: `zion106v7v0v0k3d500v0h7l636w0j4f5l4v044mh4a6` (100M ZION)
- Bridge Seed Fund: `zion13794g7k3m0f84637l2x0t855h3l258k8p3xp5t3` (400M ZION)

**Fee Split Configuration:**
- Miners: 89%
- Humanitarian: 5%
- ISSOBELLA: 5%
- Pool Fee: 1%

**Canonical Units (FLOWERS_PER_ZION):**

> **⚠️ CRITICAL: All amounts in L1 core, RPC, wallet code, and on-chain transactions are in FLOWERS (10^-6 ZION), not ZION.** *(updated to 6-decimal in 3.0.3 fork)*

- **1 ZION = 1,000,000 flowers** (10^6, one million)
- Canonical constant: `FLOWERS_PER_ZION = 1_000_000` (Rust) / `1000000` (JS/TS)
- Defined in: `V3/L1/core/src/emission.rs:11` (canonical source), `wallet.rs:156`, `blockchain.js:17`
- RPC returns amounts in flowers: `balance_flowers`, `amount_flowers`, `fee_zion` (confusingly named but contains flowers)
- UI/dashboard converts: `flowers / 1_000_000` → ZION for display
- Account transactions: `amount_zion` field contains flowers (1000 = 0.001 ZION)
- UTXO transactions: `amount` field contains flowers (same unit)

**Conversion examples:**
- 0.001 ZION = `1_000` flowers (1 thousand)
- 1 ZION = `1_000_000` flowers (1 million)
- 1000 ZION = `1_000_000_000` flowers (1 billion)
- Genesis Creator (Slot 11): 590 million ZION = `590_000_000_000_000` flowers (590 trillion)

**Verification:**
```javascript
const FLOWERS_PER_ZION = 1_000_000n;
const flowers = 590_000_000_000_000n; // Genesis Creator balance
const zion = flowers / FLOWERS_PER_ZION; // = 590_000_000 ZION = 590 million
```

**⚠️ Common mistake:** RPC returns `balance_flowers: "590000000000000"` which is 590 **million** ZION, not 590 billion. Always divide by 10^6 to get ZION.

**⚠️ Live RPC contract drift (verified 2026-06-25 against `http://77.42.71.94:8443/jsonrpc`):**

The L1 wire format currently uses **three coexisting suffix conventions**.
Until the next non-breaking contract bump lands, agents and clients MUST
be aware of all three. Full per-method JSON samples are documented in
[`docs/CANONICAL_UNITS_AUDIT.md`](./docs/CANONICAL_UNITS_AUDIT.md) §3b.

| Convention | Where it appears | How to consume |
|------------|------------------|----------------|
| `_flowers` ✅ canonical | `getBalance` (`balance_flowers`, `account_balance_flowers`, `utxo_balance_flowers`), pool metrics, wallet endpoints | Divide by `FLOWERS_PER_ZION` for display ZION |
| `_atomic` ⚠️ naming drift | `getSupplyInfo` (`block_reward_atomic`, `circulating_supply_atomic`, `mined_so_far_atomic`, `total_supply_atomic`, etc.), DAO daemon (`available_atomic`, `amount_atomic`) | **Treat as flowers** — same math, only the suffix is non-canonical |
| `_zion` containing flowers ❌ BUG | `getBlockTemplate` (`reward_zion`, `estimated_miner_reward_zion`, `total_fees_zion`) | **Treat as flowers** — DO NOT render directly as ZION; the field is mis-named. Divide by `FLOWERS_PER_ZION` first |

**Rule for new RPC methods:** Use only `_flowers` (on-the-wire) and
`_zion` (genuine display floats, ≤ 6 decimal places). Never overload
`_zion` with raw flowers values. Cross-chain bridge code adds `_wei`
for EVM-side amounts (18 decimals; `flowers × 10¹² = wei`).

**Authoritative docs for unit work:**
- [`docs/CANONICAL_UNITS_AUDIT.md`](./docs/CANONICAL_UNITS_AUDIT.md) —
  full audit, live JSON samples, recommended L1 contract bump (§3b.5),
  backend endpoint matrix, explorer endpoint canon.
- [`docs/WARP_ARCHITECTURE.md`](./docs/WARP_ARCHITECTURE.md) —
  cross-chain decimal table (corrected 2026-06-25: L1 = 6 decimals,
  updated 3.0.3 fork).

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
2. Verify genesis hash matches expected value: `7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728` (frozen since 2026-06-07 reset)
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

### Edge Server Log Management (CRITICAL — 2026-06-23)

The Edge server (150GB disk) experienced a **100% disk full** incident on 2026-06-23 caused by unbounded syslog growth (76GB). Root cause: `zion-node` logs every RPC request/response to journald→rsyslog→/var/log/syslog, and the dashboard's 10-second refresh cycle generates hundreds of RPC calls per minute.

**Automated log management is deployed via `edge-deploy/`:**

| Component | Path on Edge | Purpose |
|-----------|-------------|---------|
| logrotate config | `/etc/logrotate.d/zion-edge` | Daily rotation of syslog (max 2G, keep 7), zion logs (max 500M, keep 14) |
| journald limits | `/etc/systemd/journald.conf.d/zion-edge.conf` | SystemMaxUse=1G, SystemKeepFree=2G, MaxRetentionSec=14day |
| rsyslog RPC filter | `/etc/rsyslog.d/10-zion-edge.conf` | Drops `rpc_in=`, `rpc_out=`, `jsonrpc_out=`, `rpc_client_addr=` lines from zion-node (keeps BLOCK_FOUND, errors, warnings) |
| cleanup script | `/usr/local/bin/edge-log-cleanup.sh` | Runs every 6h via systemd timer; checks disk, vacuums journal, rotates runaway logs, truncates Docker logs |
| systemd timer | `/etc/systemd/system/edge-log-cleanup.timer` | OnBootSec=5min, OnUnitActiveSec=6h |

**Agent rules for Edge log management:**
1. **NEVER `rm -rf /var/log/*`** — always use logrotate or the cleanup script.
2. **NEVER truncate `/var/log/syslog` without rotating first** — use `logrotate --force /etc/logrotate.d/zion-edge` or the cleanup script.
3. **Before deploying new services to Edge**, verify they don't log to syslog at INFO/DEBUG level without rate limiting. Set `RUST_LOG=warn` for production services unless debugging.
4. **If disk is >90% full**, run `edge-log-cleanup.sh` manually and investigate the cause.
5. **The rsyslog filter (`10-zion-edge.conf`) is critical** — if removed, syslog will fill the disk again within hours. Never delete it.
6. **Deploy/update log automation**: `bash edge-deploy/scripts/deploy-edge-log-automation.sh` (run on Edge server).
7. **Monitor disk via dashboard**: `/api/monitoring` shows Prometheus/Grafana status. If Prometheus targets are all `down`, node-exporter may have crashed due to disk pressure.
8. **After Edge server reboot**, verify: `systemctl status edge-log-cleanup.timer` (should be active), `df -h /` (should be <80%), `journalctl --disk-usage` (should be <1G).

### Edge Server Service Management

All ZION services on Edge run as systemd units:

| Service | Unit file | Port | Depends on |
|---------|-----------|------|------------|
| Node (primary) | `zion-edge-node1.service` | 8443 (RPC), 8333 (P2P) | network, tailscale |
| Pool | `zion-edge-pool.service` | 8444, 8455 (metrics) | zion-edge-node1 |
| Bridge | `zion-edge-bridge.service` | 8451 | zion-edge-node1 |
| DAO | `zion-edge-dao.service` | 8450 | zion-edge-node1 |
| Atomic Swap | `zion-edge-atomic-swap.service` | 8452 | zion-edge-node1 |
| WARP | `zion-edge-warp.service` | 8449 | zion-edge-node1 |
| Watchdog | `zion-edge-watchdog.service` | — | — |
| Log Cleanup | `edge-log-cleanup.timer` | — | — |

**If a service shows red/down on dashboard:**
1. SSH to Edge: `ssh root@100.76.16.108`
2. Check: `systemctl status <service-name>`
3. Check logs: `journalctl -u <service-name> -n 50 --no-pager`
4. Restart: `systemctl restart <service-name>`
5. Verify: `systemctl status <service-name>` and check the port is listening

**Common Edge service issues:**
- Service `inactive (dead)` after reboot despite `enabled`: start manually with `systemctl start <service>`, check `Requires=` dependencies.
- Service crashes on startup: check if disk is full (`df -h /`), check if required port is already in use (`ss -tlnp | grep <port>`).
- Atomic Swap uses older binary in `/usr/local/bin/` — update from `V3/target/release/` after rebuilds.

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
- ✅ Website: Running (Docker `zion-website`, port 3000)
- ✅ Pool Metrics: Running on port 8455
- ✅ Genesis Hash: `7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728`
- ✅ P2P Sync: Local ↔ Edge synced (height 33+), both active

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
- ~~Complete bridge validator 3/5 setup~~ → ✅ 5/5 validators configured (2026-06-29)
- ~~Reverse bridge (EVM→L1)~~ → ✅ FULLY OPERATIONAL — E2E test passed (2026-06-29)
- Deploy ZIONStaking + ZIONFarm on Base Mainnet (needs ETH for gas)
- External audit of genesis configuration
- **MAINNET LAUNCH READY** — All critical systems operational

### Bridge Vault — Canonical Reference (IMPORTANT)

**Live vault:** `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0` (~100M ZION locked)
**Seed:** `"ZION Bridge Vault V3 Mainnet"` (in `V3/L1/core/src/crypto.rs:BRIDGE_VAULT_SEED`)
**DO NOT change this seed** — it is tied to the live mainnet vault with real funds.

⚠️ In commit `4b94181f` the seed was accidentally changed to `"...v2_2026-06-03-GENESIS-RESET"`,
   generating an empty address `zion106v7v0...` and breaking `submitBridgeUnlock`.
   Fixed in commit `e6175b5b` (2026-06-29). If you ever see vault balance = 0 in getBridgeVaultBalance,
   re-check that `BRIDGE_VAULT_SEED` = `"ZION Bridge Vault V3 Mainnet"`.

**Edge bridge-validators drop-in:** `/etc/systemd/system/zion-edge-node1.service.d/bridge-validators.conf`
- `ZION_BRIDGE_VALIDATOR_PUBKEYS` = 5 compressed secp256k1 pubkeys (comma-separated)
- `ZION_BRIDGE_VALIDATOR_THRESHOLD` = `5`

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
# NOTE: This endpoint may not work - use web panel instead
curl -s -X PATCH -H "X-AUTH-TOKEN: $API" \
  -H "Content-Type: application/json" \
  -d '{"minerUrl":"https://zionterranova.com/zion-miner/zion-miner-vX.X.X-gpu.zip"}' \
  $BASE/rigs/518837/group-config
```

**IMPORTANT:** SMOS API tokens expire frequently. Use web panel for group config updates:
- URL: https://simplemining.net
- Navigate to rig group settings
- Update miner URL to new version

### Known Vega 64 / GCN mining issues

- `SELF_TEST s4_memhard=FAIL` — known GCN Blake3 mismatch, miner continues anyway (`ZION_NO_GCN_S4_MODE=1` bypasses s4-only path)
- **ALWAYS** set `ZION_NO_GCN_S4_MODE=1` for Vega 64 / GCN rigs
- **ALWAYS** set `ZION_LOOP_COUNT=1000000` (default=1 causes reconnect every iteration → ~30 H/s instead of ~3 KH/s)
- GCN work_size cap: 512 (do not set higher)
- Algorithm for GCN: `deeksha_lite_v1` (not `cosmic_harmony` — too heavy for GCN sustained mining)

### Fire Algorithm (deeksha_lite_fire) - Thermal-Intensive Mining

- **Purpose:** Thermal-intensive variant for sustained high-power mining
- **Scratchpad:** 512 KiB per thread (vs 256 KiB for v1)
- **GPU Backend Fix (2026-06-07):**
  - Fire GPU backend now uses precomputed Keccak state (25 u64s) like v1, not raw header bytes
  - Fixed hash mismatch between GPU and CPU implementations
  - Binary: `zion-miner-v3.0.37-fire.zip` deployed to Edge
  - See `FIRE_GPU_FIX_REPORT.md` for full details
- **Configuration:**
  - Algorithm: `deeksha_lite_fire`
  - GPU backend: `opencl` (AMD GCN)
  - Scratchpad: 512 MiB total (256 KiB per thread × 2048 work_size)
  - Work size: 2048 (global), 256 (local)

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

---

## Vega 64 SMOS Deploy & Tuning (2026-06-13)

### Overview
Vega 64 (gfx900:xnack-, 64 CUs, 8GB HBM2) deployed on SMOS rig 518837 via custom miner ZIP.

### SMOS ZIP Structure Requirement
SMOS requires **exactly one folder** inside the ZIP; files must be inside `foldername/`, not loose in root:
```
zion-sm3042c-fire-vX.zip
└── zion-sm3042c-fire-vX/
    ├── miner          # wrapper script (sets ZION_MINER_ALGORITHM + execs binary)
    └── zion-miner     # actual binary
```
**Critical:** Each new version must use a **different ZIP filename** to bypass SMOS local cache.

### Docker Build (Ubuntu 20.04 → GLIBC 2.28 compatible)
Build on Edge server (100.76.16.108) using `V3/Dockerfile.miner-smos`:
- Ubuntu 20.04 builder + runner
- Rust 1.85.0
- Remove bundled `libOpenCL.so` (compiled for newer GLIBC)
- Provide local `gettid()` syscall wrapper to avoid GLIBC_2.30 dependency
- Binary max GLIBC: 2.28-2.29 (SMOS-compatible)

### Deployed Versions
| Version | ZIP URL | Changes |
|---------|---------|---------|
| v1 | `zion-sm3042c-fire-v1.zip` | Initial Fire ZIP, stale binary |
| v3 | `zion-sm3042c-fire-v3.zip` | Fresh Docker build, GPU fallback fix |
| v4 | `zion-sm3042c-fire-v4.zip` | crossterm dep, missing sources fixed |
| v5 | `zion-sm3042c-fire-v5.zip` | GPU manager permanent disable fix |
| v6 | `zion-sm3042c-fire-v6.zip` | work_size up, `-cl-mad-enable` removed, pool nonce 262144→524288 |
| v7 | `zion-sm3042c-fire-v7.zip` | local_ws 256→64, `-cl-denorms-are-zero`, remove `aligned(8)` — **caused error, reverted** |
| **v8** | `zion-sm3042c-fire-v8.zip` | **Reverted to stable v6 params: local_ws=256, aligned(8) restored** |

### SMOS Group Config (1773590 ZionLiteFire)
```
http://77.42.71.94/zion-miner/zion-sm3042c-fire-v8.zip \
  --algorithm deeksha_lite_fire \
  --pool 77.42.71.94:8444 \
  --wallet zion1m883u5h7t8l2q6y44670c6q5l067v4u2a3ku332 \
  --worker vega-smos
```

### Vega 64 Tuning Parameters (v8)
| Param | Value | Rationale |
|-------|-------|-----------|
| work_size (Fire) | 16384 | 2× v6; fills 8GB HBM2 efficiently |
| work_size (Lite v1) | 16384 | Same for both algorithms |
| local_ws | 256 | Stable work-group size for GCN memory coalescing |
| vram_pct | 85% | Safe HBM2 utilization with headroom |
| build_opts | `-cl-std=CL1.2` | Minimal flags, avoids driver regressions |
| Pool nonce_count_gpu | 524288 | Bigger batches = less CPU-GPU sync overhead |

### Code Changes in This Session
1. **`V3/L1/miner/src/main.rs`** — GPU no longer permanently disabled on init failure; retries every iteration
2. **`V3/L1/miner/src/gpu_guard.rs`** — Vega 64 tuning: work_size ↑ to 16384, local_ws=256 (stable), vram_pct=85%
3. **`V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite_fire.cl`** — Kept `__attribute__((aligned(8)))` on thermal_loop (stable on GCN)
4. **`V3/L1/miner/Cargo.toml`** (Edge only) — Added `crossterm = "0.28"` dependency
5. **`V3/L1/miner/src/interactive.rs`** / **`ui.rs`** — Restored missing source files on Edge

### Performance Timeline
| Stage | Fire Hashrate | Notes |
|-------|---------------|-------|
| Initial (stale binary) | ~4.5 KH/s | Wrong algo (Lite v1), old binary |
| v5 (GPU fix) | ~8.5 KH/s | Fire finally running, work_size=8192 |
| v6 (tuning) | ~8.5 KH/s | work_size↑, pool nonce↑ |
| v7 (wavefront) | unstable | local_ws=64, `-cl-denorms-are-zero` — caused runtime error |
| v8 (revert) | **~8.5 KH/s** | Reverted to stable v6 params |
| + 1450 MHz OC | **~10 KH/s** | Core clock from 1250→1450 MHz |

### How to Update Miner on SMOS
1. Build new Docker image on Edge: `docker build -f Dockerfile.miner-smos -t zion-miner-smos .`
2. Extract binary, create ZIP with **new filename**
3. Upload to `/var/www/zion-miner/`
4. Update SMOS group `minerOptions` via API or dashboard
5. Restart rig via SMOS dashboard (Actions → Restart)

### Operational Scripts (root repo)
- `check_rig.py` — poll SMOS rig status
- `check_group.py` — poll SMOS group config
- `deploy_*.py` — various deploy scripts (SMOS API)
- `explore_smos_api.py` — SMOS API exploration

### Pool Environment (Edge)
File: `/root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh`
```
ZION_POOL_BIND=0.0.0.0:8444
ZION_POOL_LOOP_COUNT=1000000
ZION_NONCE_COUNT=1048576
ZION_NONCE_COUNT_GPU=524288
ZION_JOB_TTL_MS=60000
```
Restart after change: `systemctl restart zion-pool-server.service`
```