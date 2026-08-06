# ZION 3.2 "One Love" — Mainnet Stable Canonical Execution Plan

> **Version:** 3.2.0 "One Love" — Mainnet Stable / production ready  
> **Datum:** 2026-08-06  
> **Status:** canonical plan, supersedes `PLAN_TO_3.1_RECONCILED.md` for forward work  
> **Update 2026-08-06:** pulled latest remote; DEX HTTP solver client, local GPU OpenCL build/benchmark, and Desktop Agent V31 binaries are now GO.  
> **Active workspace:** `V31/`  
> **Live status:** [`StatusV3.md`](../StatusV3.md) · [`V31/STATUS.md`](./STATUS.md)  
> **Agent rules:** [`V31/AGENTS.md`](./AGENTS.md) · [`../AGENTS.md`](../AGENTS.md)

---

## 1. Executive Summary

`3.1.0-alpha.2` is **live on Edge** and has passed the V31 cut-over. Public RPC, pool stratum, multichain, dashboard and miner are running on V31. The code-vs-docs reconciliation work from `3.0.6` through `3.0.9`, the V31 migration, and the Phase A-D cut-over are complete in the sense that **the modules compile, the workspace tests pass, and the production services start**.

**However, "compiles and tests pass" is not "production ready".** `PLAN_TO_3.1_RECONCILED.md` already warned that many items marked "complete" meant *library modules ported*, not *production binaries fully exercised*. `3.2.0 "One Love" / Mainnet Stable` is the track that closes that gap.

This document is the **single canonical plan** for moving from `3.1.0-alpha.2/beta` to `3.2.0 "One Love" (Mainnet Stable)`. It is a code-vs-docs-grounded plan, not a wishlist. Every gate is testable, every phase has an owner, and every "complete" claim must be backed by evidence.

---

## 2. Current state at the start of 3.2 planning

### 2.1 What is genuinely running

| Area | Evidence | Status |
|------|----------|--------|
| V31 workspace | `cargo test --workspace` 2079 pass, `cargo clippy --workspace` clean | verified 2026-08-06 |
| V31 node on Edge | `zion-v31-node` P2P 8335, RPC 9445, height ~11270, sync_lag 0 | verified 2026-08-05 |
| V31 pool on Edge | `zion-v31-pool` stratum 8444, HTTP API 8080, shares accepted | verified 2026-08-05 |
| V31 multichain | `/health` 200, DEX + HTLC endpoints wired | verified 2026-08-06 |
| V31 DAO | runtime loads/persists proposals, L1 scanner, HTTP API + metrics | verified 2026-08-05 |
| V31 dashboard | `/api/services`, `/api/readiness`, V31 metrics, Grafana | verified 2026-08-05 |
| V31 miner binary | builds with OpenCL/CUDA/Metal/native features, triple-stream runtime | code complete |
| V31 miner GPU OpenCL (local) | `gpu_opencl_detect` test passes on GTX 1070 Ti, ~132 kh/s | GO 2026-08-06 |
| DEX solver network | `HttpSolverClient` + `/v1/swap/solve` + `/v1/swap/intent/:id/broadcast` wired; integration tests pass | GO 2026-08-06 |
| Desktop Agent V31 binaries | `prepare-rust-miner.js` copies V31 `zion-miner`, `node`, `zion`; `npm test` + `build:linux` pass | GO 2026-08-06 |
| GitHub release | `v3.1.0-beta` published with binaries + SHA256 | done 2026-08-04 |

### 2.2 What the code-vs-docs audit still shows as incomplete

| ID | Gap | Where | Why it blocks "Mainnet Stable" |
|----|-----|-------|--------------------------------|
| G1 | **Real GPU/rig E2E Go/No-Go pending** | `V31/STATUS.md`, `PLAN_TO_3.1_RECONCILED.md` | Local OpenCL build/benchmark GO (GTX 1070 Ti), but real rig E2E on Edge pool with ≥90% accept rate is still pending. |
| G2 | **Non-EVM WARP contracts are placeholders** | `V31/L2/multichain/src/warp/adapter/{solana,tron,stellar,cardano,cosmos,aptos,sui,near}.rs` | Adapters warn about placeholder addresses. Mainnet-stable bridge cannot claim 12-chain support with undeployed contracts. |
| G3 | **Solver network needs real E2E** | `V31/L2/multichain/src/swap/dex/solver_network.rs` | `HttpSolverClient` and solver-side `/v1/swap/solve` endpoint are wired and tested locally. Real multi-party E2E with an independent solver over the internet is still pending. |
| G4 | **Public subtree diff is not zero** | `docs/3.0.6/PUBLIC_SUBTREE_AUDIT_2026-07-30.md` | 113 files differ; `profit_router.rs` is visibly behind. Public MIT-safe repo is out of sync. |
| G5 | **XMR / RandomX pool reachability blocked** | `StatusV3.md`, `3.0.7.md` | All pure-RandomX pools are unreachable or auto-switch to KawPow from Edge datacenter. |
| G6 | **PRL (Pearl PoUW) deferred / disabled** | `ExternalCoin::disabled_reason` | Officially out of 3.1/3.2 scope, but must remain documented and excluded from profit switching. |
| G7 | **Chaos/load tests pending** | `V31/CHAOS_TEST_PLAN.md`, `LAUNCH_CHECKLIST.md` 2.x | 1000+ miner simulation, 24h fuzzing, bridge reconnect stress, pool reconnect storm not yet executed. |
| G8 | **30d continuous run not started** | `V31/30D_RUN_PLAN.md` §4 | Cannot call 3.2 "Stable" without 30 days of production uptime evidence. |
| G9 | **External audit / security review not done** | `ROADMAP.md` 5.7, `LAUNCH_CHECKLIST.md` 1.1 | Internal tests pass; no external security review is on record. |
| G10 | **L5 Free World / L6 Issobella inactive** | `StatusV3.md` service table | Layer 5 and 6 services are disabled in production. For a full L1-L6 mainnet, they must at least have a defined run mode. |
| G11 | **V3→V31 migration incomplete** | §10 deep audit | 8 Solidity contracts, miner TUI, 11 Cargo features, 18 CLI commands, ZionDex contracts, native-libs all missing from V31. See §10 for full gap analysis and Phase H for remediation. |

### 2.3 What is deliberately **not** a 3.2 blocker

| Item | Rationale | Tracking |
|------|-----------|----------|
| CHv4.2 Merkabah Dual-Spin | Fork height is `u64::MAX`; governance vote required. | `StatusV3.md` §1 |
| Full 12-chain non-EVM WARP | Mainnet-stable scope is EVM + Bitcoin + one non-EVM pilot. Rest can be post-3.2. | This plan §4.3 |
| Mobile app store submission | Out of 3.2 scope; mobile can ship in 3.2.x. | `ROADMAP.md` 5.3 |
| Pearl PoUW | Already officially deferred. | `StatusV3.md` |

---

## 3. Definition of "3.2.0 One Love (Mainnet Stable)"

`3.2.0 "One Love" (Mainnet Stable)` means:

1. **The production stack has run for 30 continuous days on Edge with no critical incident.**
2. **Real GPU miners on reference rigs (AMD Vega/GTX 1070 Ti/RTX 3090/Apple M1) find accepted ZION shares at ≥90% accept rate** for at least one of OpenCL/CUDA/Metal.
3. **All production binaries are fully wired**, not just library modules: `zion-node`, `zion-pool`, `zion-miner`, `zion-multichain`, `zion-dao`, `zion-cli`.
4. **Bridge wZION round-trip works on Base mainnet** with real lock/mint/burn/release and no manual intervention.
5. **No placeholder addresses or mock clients are in the hot path** for EVM/Bitcoin/ZionL1; non-EVM chains are either deployed-and-tested or explicitly disabled with `disabled_reason`.
6. **Public `github.com/Zion-TerraNova/v3-Mainnet` subtree is in sync** and contains no secrets or internal-only IP addresses.
7. **Security audit and chaos/load tests are complete** with findings either mitigated or accepted as documented risk.
8. **GitHub `v3.2.0` release** has multi-platform binaries, SHA256SUMS, signed tags, and SMOS package.
9. **Monitoring, alerting, backup/DR, and runbooks are tested and documented.**
10. **Public docs and community channels are ready** for a broader public mainnet launch.

---

## 4. Phase E — Real-World Verification & Hardening (weeks 1-4)

Goal: close G1-G6 before any "stability" claim.

| # | Task | Owner | Acceptance | Evidence |
|---|------|-------|------------|----------|
| E1 | **GPU Go/No-Go on reference rigs** | core/miner | Local OpenCL build/benchmark GO on GTX 1070 Ti. Real E2E: ≥90% accept rate on ZION Deeksha for 1h on at least 2 rigs (AMD OpenCL, NVIDIA CUDA/Apple Metal). | `RIG_GPU_TEST_REPORT.md` with hashrate, accept/reject, hardware, driver versions. |
| E2 | **AuxPoW real-pool E2E** | core/miner | At least 2 GPU coins and 2 CPU coins produce accepted upstream shares on Edge pool. | Pool `routing_snapshot` + upstream pool logs. |
| E3 | **Miner profit switching live test** | core/miner | Miner switches coins within 15% hysteresis, no oscillation, PRL never selected. | `autonomous.rs` metrics + 2h run log. |
| E4 | **Bridge Base mainnet round-trip** | multichain | 100K wZION lock → mint → burn → release round-trip with 5/7 validator consensus. | Multichain DB log + Etherscan TXs. |
| E5 | **Non-EVM WARP hardening** | multichain | For each non-EVM chain: either (a) contract deployed and address wired, or (b) `disabled_reason` set and UI hidden. | Per-chain status table. |
| E6 | **Solver network real E2E** | multichain | `HttpSolverClient` + solver-side `/v1/swap/solve` wired and unit-tested. Real multi-party E2E with an independent solver over the internet. | `SOLVER_NETWORK_E2E_REPORT.md`. |
| E7 | **Public subtree sync** | release/docs | `git subtree push --prefix=public public main --dry-run` clean; diff = 0 for MIT-safe files; `git secrets --scan` clean. | Subtree commit + scan report. |
| E8 | **XMR/RandomX path resolution** | core/pool | Either (a) a reachable RandomX pool is configured and E2E tested, or (b) XMR is `disabled_reason` in profit router and UI. | Decision record + config. |
| E9 | **L5/L6 activation decision** | product/ops | Decide whether Free World and Issobella run as services in 3.2; if yes, enable and test; if no, document as post-3.2. | Decision record. |

**Phase E Go/No-Go:**
- [ ] E1 and E2 pass on at least one reference rig.
- [ ] E4 passes on Base mainnet.
- [ ] E5 leaves zero undeclared placeholder mainnet addresses in `V31/L2/multichain/src/warp/adapter/`.
- [ ] E7 public subtree is clean and pushed.

---

## 5. Phase F — Stability, Security & 30-Day Run (weeks 5-9)

Goal: earn the right to call it Stable.

| # | Task | Owner | Acceptance | Evidence |
|---|------|-------|------------|----------|
| F1 | **Security audit (internal + external)** | security | L1 consensus, account model, bridge contracts, multichain reviewed; findings tracked with mitigations. | `SECURITY_AUDIT_3.2.md`. |
| F2 | **24h transaction fuzzing** | QA/automation | `cargo test` still passes; no crashes; final state checksum consistent. | Fuzzing log + checksum. |
| F3 | **Chaos tests** | QA/ops | Execute `V31/CHAOS_TEST_PLAN.md` rounds 1-5. | Chaos test report. |
| F4 | **1000+ miner simulation** | pool/QA | Pool memory flat, CPU <80%, no panics, reconnect rate limit holds. | Load test report. |
| F5 | **Backup / DR drill** | ops | Restore from latest off-site backup; node syncs to current height. | DR drill log. |
| F6 | **30-day continuous run** | ops | Start after F1-F5; monitor via `V31/30D_RUN_PLAN.md`. | Daily status in `StatusV3.md`. |

**Phase F Go/No-Go:**
- [ ] F1-F5 complete.
- [ ] 30d run started with all alert channels active.

---

## 6. Phase G — Release & Launch Readiness (weeks 9-10)

Goal: ship `v3.2.0` and prepare public mainnet launch.

| # | Task | Owner | Acceptance | Evidence |
|---|------|-------|------------|----------|
| G1 | **Feature freeze** | product | No new coins, algorithms, or chain adapters after this point. | `DEFERRED_3.2.md` frozen. |
| G2 | **GitHub `v3.2.0` release** | release | Linux x86_64, Windows x86_64, macOS arm64/x86_64 binaries; SHA256SUMS; signed tag. | Release page. |
| G3 | **SMOS package** | release | `zion-miner-v3.2.0-mainnet-stable.zip` tested on a reference rig. | SMOS group config. |
| G4 | **Desktop App bundle** | APP&WEB | Linux build GO. `v3.2.0-desktop` with V31 binaries; builds and passes tests on macOS/Windows/Linux. | Release assets. |
| G5 | **Public docs update** | docs | `public/README.md` and translations reflect 3.2.0 status. | Public subtree commit. |
| G6 | **Community + bug bounty** | community | Beta announcement, Discord/Telegram channels, bug bounty process published. | Posts + process doc. |
| G7 | **Monitoring & alerting** | ops | Grafana/alertmanager or equivalent; page on downtime; runbooks updated. | Dashboard alert test. |

**Phase G Go/No-Go (3.2.0 "One Love"):**
- [ ] 30d continuous run completed with no critical incident.
- [ ] All workspace tests and E2E smoke tests pass.
- [ ] GitHub release published with multi-platform binaries and SHA256.
- [ ] Public subtree in sync, no secrets.
- [ ] Monitoring, alerting, backup/DR tested.

---

## 7. Priority order of execution

```
Week 1:  E1  GPU Go/No-Go on first reference rig
        E2  AuxPoW real-pool E2E
        E3  Profit switching live test
        E4  Bridge Base mainnet round-trip (small amount first)

Week 2:  E5  Non-EVM WARP hardening
        E6  Solver network real E2E
        E7  Public subtree sync
        E8  XMR/RandomX decision

Week 3:  E9  L5/L6 activation decision
        F1  Internal security audit
        F2  Fuzzing infrastructure + 24h run

Week 4:  F3  Chaos tests (local testnet)
        F4  1000+ miner simulation
        F5  Backup / DR drill

Week 5:  F6  Start 30-day continuous run
        (parallel) G1 Feature freeze, G2 release prep

Weeks 6-9: 30d run monitoring + bugfix sprints

Week 10: G2-G7 release and launch readiness
```

---

## 8. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| GPU Go/No-Go fails on a specific vendor | Document supported hardware matrix; disable problematic backend with `disabled_reason`; do not ship untested backend. |
| Bridge mainnet round-trip loses funds | Test with small amount first; use 5/7 multisig; pause and investigate any `BurnRelease` failure. |
| 30d run interrupted by non-critical bug | Distinguish critical vs non-critical incidents; only critical (consensus, payout, bridge safety) resets the clock. |
| Public subtree push reveals secret | Always `--dry-run` first; run manual IP/key scan; use `git secrets --scan`. |
| External audit finds critical issue | Keep 4-week buffer before 31.12.2026 public launch; fix or accept as documented deferred risk. |
| Desktop App bundle delays release | Ship CLI + web first; desktop can follow in 3.2.x. |

---

## 9. Definition of "Done" for 3.2.0 "One Love"

1. 30d continuous run on Edge completed, uptime ≥99.9% for pool, no critical incidents.
2. Real GPU mining pass on at least two reference rigs with ≥90% accept rate.
3. Bridge wZION round-trip verified on Base mainnet.
4. No undeclared placeholder addresses or mock clients in hot paths.
5. Public subtree fully in sync and clean.
6. Security audit and chaos tests complete with mitigations.
7. `v3.2.0` GitHub release with multi-platform binaries and SHA256SUMS.
8. Monitoring, alerting, backup/DR, and runbooks tested and current.
9. Public docs and community channels ready for public mainnet.
10. `cargo test --workspace` and `cargo clippy --workspace` remain clean.

---

## 10. V3 → V31 Migration Gap Analysis (2026-08-06 deep audit)

> **Method:** systematic comparison of `archive/V3/` + `archive/AuXpow/` + `archive/ZionDex/` vs `V31/` — every crate, every source file, every Cargo feature, every GPU kernel, every Solidity contract, every CLI command.

### 10.1 Migration status summary

| Layer | V3 crates | V31 equivalent | Status |
|-------|-----------|----------------|--------|
| L1/core | `archive/V3/L1/core` (49 files) | `V31/L1/core` (66 files, incl. v3_* compat + new block/chain_state/consensus/node_runtime) | ✅ MIGRATED + enhanced |
| L1/cosmic-harmony | `archive/V3/L1/cosmic-harmony` (19 files) | `V31/L1/cosmic-harmony` (21 files) + `V31/L1/cosmic-harmony-v3` (19 files) | ✅ MIGRATED (split into new + v3 legacy) |
| L1/native-ffi | `archive/V3/L1/native-ffi` | `V31/L1/native-ffi` (identical features: 9 native-* + native-all) | ✅ MIGRATED |
| L1/native-libs | `archive/V3/L1/native-libs/` (OpenCL.lib, algorithms/, build scripts, ABI header) | — | ❌ MISSING |
| L1/pool | `archive/V3/L1/pool` (8 files) | `V31/L1/pool` (32 files) | ✅ MIGRATED + massively expanded |
| L1/miner | `archive/V3/L1/miner` (15 files) | `V31/L1/miner` (30+ files + auxpow/ + gpu/ + csrc/) | ⚠️ PARTIAL (see §10.3) |
| AuXpow | `archive/AuXpow/` (25 Rust files + 90+ GPU kernels) | merged into `V31/L1/miner/src/auxpow/` + `V31/L1/miner/csrc/` | ⚠️ PARTIAL (see §10.4) |
| L2/bridge | `archive/V3/L2/bridge` (14 files) | `V31/L2/multichain/src/bridge/` | ✅ MIGRATED (unified into multichain) |
| L2/atomic-swap | `archive/V3/L2/atomic-swap` (10 files) | `V31/L2/multichain/src/swap/htlc.rs` | ✅ MIGRATED (unified into multichain) |
| L2/swap-aggregator | `archive/V3/L2/swap-aggregator` (6 files) | `V31/L2/multichain/src/swap/dex/aggregator.rs` | ✅ MIGRATED (unified into multichain) |
| L2/dao | `archive/V3/L2/dao` (20 files) | `V31/L2/dao` (21 files, + runtime.rs) | ✅ MIGRATED + enhanced |
| L2/contracts | `archive/V3/L2/contracts/hardhat/sol/` (9 .sol files) | `V31/L2/multichain/contracts/non-evm/tron/ZionToken.sol` | ❌ MISSING (8 of 9 contracts) |
| L3/warp | `archive/V3/L3/warp` (49 files) | `V31/L2/multichain/src/warp/` (49+ files) | ✅ MIGRATED (moved to L2 multichain) |
| L3/ai-native | `archive/V3/L3/ai-native` (29 files) | `V31/L3/ai-native` (29 files, identical) | ✅ MIGRATED |
| L3/ncl | `archive/V3/L3/ncl` (9 files) | `V31/L3/ncl` (9 files, identical) | ✅ MIGRATED |
| L4/oasis | `archive/V3/L4/oasis` (28 files) | `V31/L4/oasis` (28 files, identical) | ✅ MIGRATED |
| L4/docs | `archive/V3/L4/docs/` (AVATARS, GAME_SYSTEMS, TECH, README) | — | ❌ MISSING (design docs) |
| L5/free-world | `archive/V3/L5/free-world` (10 files) | `V31/L5/free-world` (10 files, identical) | ✅ MIGRATED |
| L5/docs | `archive/V3/L5/docs/` (ARCHITECTURE, COMMUNITIES, GOVERNANCE, PROTOCOLS, TECH, TEMPLATES) | — | ❌ MISSING (design docs) |
| L6/issobella | `archive/V3/L6/issobella` (10 files) | `V31/L6/issobella` (10 files, identical) | ✅ MIGRATED |
| ZionDex | `archive/ZionDex/` (contracts + router + solver + intent + sdk) | `V31/L2/multichain/src/swap/dex/` (aggregator, executor, intent, intent_engine, solver_network) | ⚠️ PARTIAL (see §10.5) |
| sdk | `archive/V3/sdk` (7 files) | `V31/sdk` (7 files, identical) | ✅ MIGRATED |
| cli | `archive/V3/cli` (35 files: 25 commands + rpc + ui + auto_detect + config) | `V31/cli` (2 files: main.rs + menu.rs) | ❌ MISSING (see §10.2) |
| smoke | — | `V31/smoke` (new, 8 cross-layer tests) | ✅ NEW in V31 |

### 10.2 CLI — missing commands (CRITICAL)

V31 CLI (`V31/cli/src/main.rs`) has inline subcommands: Menu, Status, Wallet, Bridge, Swap, Pool, Miner, Doctor, Api, Node, Service.

V3 CLI had **25 command modules** in `archive/V3/cli/src/commands/` — the following are **MISSING** from V31:

| V3 command | Purpose | V31 status | Priority |
|------------|---------|------------|----------|
| `agent.rs` | AI agent control (start/stop/status maestro) | MISSING | Medium |
| `atomic_swap.rs` | HTLC atomic swap initiation/claim/refund | MISSING | High |
| `auxpow.rs` | AuxPoW merged mining status/control | MISSING | High |
| `completions.rs` | Shell completion generation (bash/zsh/fish) | MISSING | Low |
| `compose.rs` | Docker Compose orchestration | MISSING | Medium |
| `dao.rs` | DAO proposal/vote/treasury commands | MISSING | High |
| `deploy.rs` | Edge deployment commands | MISSING | Medium |
| `explorer.rs` | Block explorer queries | MISSING | Low |
| `free_world.rs` | L5 Free World service control | MISSING | Low |
| `hiran.rs` | AI/Hiran layer control | MISSING | Low |
| `issobella.rs` | L6 Issobella service control | MISSING | Low |
| `mine.rs` | Mining start/stop/status (standalone) | MISSING (partially in Miner subcommand) | Medium |
| `monitor.rs` | Live monitoring dashboard | MISSING | Medium |
| `ncl.rs` | NCL (Network Compute Layer) commands | MISSING | Low |
| `onboard.rs` | Interactive onboarding wizard | MISSING | Medium |
| `topology.rs` | Network topology visualization | MISSING | Low |
| `update.rs` | Self-update / version check | MISSING | Medium |
| `warp.rs` | Cross-chain WARP transfer commands | MISSING | High |

Also missing supporting modules:
- `auto_detect.rs` — hardware/config auto-detection
- `config.rs` — config file management
- `rpc/` — `agent_rpc.rs`, `hiran_rpc.rs`, `node_rpc.rs`
- `ui.rs` — CLI UI helpers

### 10.3 Miner — missing features and TUI (HIGH)

#### 10.3.1 Missing Cargo features

V31 miner Cargo.toml exposes: `auxpow`, `native-hashers`, `native-kheavyhash`, `native-blake3-algo`, `native-verushash`, `gpu-opencl`, `gpu-cuda`, `gpu-metal`, `gpu`.

V3 miner exposed additionally (all supported by `V31/L1/native-ffi` but NOT wired in miner):

| Feature | Purpose | Status |
|---------|---------|--------|
| `native-etchash` | Etchash (ETC) native C hasher | ❌ not exposed in V31 miner |
| `native-kawpow` | KawPow (RVN) native C hasher | ❌ not exposed |
| `native-autolykos` | Autolykos (ERG) native C hasher | ❌ not exposed |
| `native-cosmic-harmony` | Cosmic Harmony native C hasher | ❌ not exposed |
| `native-randomx` | RandomX (XMR) native C hasher | ❌ not exposed |
| `native-ghostrider` | GhostRider (RTM) native C hasher | ❌ not exposed |
| `native-all` | Convenience: all native algorithms | ❌ not exposed |
| `gpu-all` | Convenience: all GPU backends | ❌ not exposed |
| `full` | GPU + all native + hashers (unified binary) | ❌ not exposed |
| `public_build` | Hides Trinity/AuxPow details in TUI for public release | ❌ not exposed |
| `testnet_fork_rehearsal` | Hard-fork rehearsal gates | ❌ not exposed |

**Action:** Add all missing features to `V31/L1/miner/Cargo.toml [features]`, wiring them to `zion-native-ffi` like V3 did.

#### 10.3.2 Missing TUI / interactive UI

V3 miner had professional TUI modules — **ALL MISSING** from V31:

| V3 file | Purpose | Lines | V31 status |
|---------|---------|-------|------------|
| `ui.rs` | Professional colored miner UI (XMRig/GMiner style), ANSI, sticky header, /dev/tty redirect | ~500+ | ❌ MISSING |
| `interactive.rs` | Cross-platform keyboard TUI (crossterm): h=hashrate, a=algorithm cycle, c=CPU toggle, g=GPU toggle, d=dual mode, i=hardware, p=pause, r=reconnect, v=verbose, 1-9=threads, q=quit | ~400+ | ❌ MISSING |
| `setup_menu.rs` | Interactive setup menu for first-run (asks pool/wallet/threads, writes env vars) | ~200+ | ❌ MISSING |
| `banner.rs` | ASCII art banner + version display | ~100+ | ❌ MISSING |
| `gpu_backend.rs` | GPU backend abstraction (V31 has `gpu/mod.rs` instead) | — | ✅ replaced |
| `gpu_kat_bench.rs` | GPU KAT benchmark binary | — | ❌ MISSING |

**Action:** Port `ui.rs`, `interactive.rs`, `setup_menu.rs`, `banner.rs` from `archive/V3/L1/miner/src/` to `V31/L1/miner/src/`. Add `crossterm` dependency. Wire TUI into `zion-miner.rs` binary.

### 10.4 AuXpow — merged but standalone tooling lost (MEDIUM)

AuXpow was a standalone crate with:
- 25 Rust source files (all logic merged into `V31/L1/miner/src/auxpow/`)
- 90+ GPU kernel files (all migrated to `V31/L1/miner/csrc/`)
- `build.rs` — custom build script for C compilation
- `examples/` — example binaries
- `run_e2e_8coins.sh` — end-to-end 8-coin mining test script
- `REVENUE_B2B_AND_TRUE_AUXPOW_DESIGN.md` — revenue system design doc

**What's lost:**
- `run_e2e_8coins.sh` — automated E2E test for 8 external coins
- `examples/` — standalone test binaries (`rtm_gpu_test.rs`, `rtm_hash_cmp.rs`, `rtm_live_test.rs`, `simd_cmp.rs`)
- `REVENUE_B2B_AND_TRUE_AUXPOW_DESIGN.md` — design documentation
- `pearl_pouw.rs` / `pearl_real_pouw.rs` — Pearl PoUW (officially deferred but code existed)

**Action:** Port `run_e2e_8coins.sh` as a V31 test script. Archive the design doc into `docs/`. The Pearl PoUW code can remain deferred.

### 10.5 ZionDex — partially migrated (MEDIUM)

ZionDex had 4 standalone components:

| Component | V3 path | V31 status |
|-----------|---------|------------|
| **contracts/** | 7 Solidity contracts: IntentSettlement, SolverRegistry, ZDXToken, ZionDexHooks, ZionDexPoolManager, ZionDexRouter, ZionDexStaking + DeployBase.s.sol | ❌ MISSING (not in V31) |
| **router/** | 13 Rust files: aggregator, api, config, db, executor, intent, monitor, price, quote, router, types | ⚠️ PARTIAL (aggregator, executor, intent in multichain swap/dex/) |
| **solver/** | 9 Rust files: api, config, errors, node, router_client, strategy, types | ⚠️ PARTIAL (solver_network.rs in multichain) |
| **intent/** | 6 Rust files: auction, errors, signing, solver, types | ⚠️ PARTIAL (intent.rs, intent_engine.rs in multichain) |
| **sdk/** | empty | — |

**Missing from V31:**
- All 7 ZionDex Solidity contracts (IntentSettlement, SolverRegistry, ZDXToken, ZionDexHooks, ZionDexPoolManager, ZionDexRouter, ZionDexStaking)
- Standalone router service (price oracle, quote API, monitor)
- Standalone solver service (strategy engine, router_client, node)
- Intent auction + signing logic

**Action:** Port ZionDex Solidity contracts into `V31/L2/multichain/contracts/dex/`. Port standalone router/solver services or document that they're absorbed into multichain.

### 10.6 Solidity smart contracts — 8 of 9 missing (CRITICAL)

V3 had 9 Solidity contracts in `archive/V3/L2/contracts/hardhat/sol/`:

| Contract | Purpose | V31 status |
|----------|---------|------------|
| `wZION.sol` | Wrapped ZION ERC-20 on Base L2 | ❌ MISSING |
| `ZIONBridge.sol` | Bridge lock/mint/burn/release contract | ❌ MISSING |
| `ZIONAtomicSwap.sol` | HTLC atomic swap contract | ❌ MISSING |
| `ZIONGovernance.sol` | DAO governance contract | ❌ MISSING |
| `ZIONTreasury.sol` | DAO treasury contract | ❌ MISSING |
| `ZIONStaking.sol` | Staking contract | ❌ MISSING |
| `ZIONFarm.sol` | Liquidity farming contract | ❌ MISSING |
| `SefirotVowRegistry.sol` | Sefirot vow registry | ❌ MISSING |
| `SefirotVowToken.sol` | Sefirot vow token | ❌ MISSING |

V31 has only: `V31/L2/multichain/contracts/non-evm/tron/ZionToken.sol`

**Note:** The AGENTS.md mentions wZION address `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` on Base — so wZION is deployed but the contract source is not in V31.

**Action:** Port all 9 Solidity contracts from `archive/V3/L2/contracts/hardhat/sol/` into `V31/L2/multichain/contracts/evm/`. Set up Foundry/Hardhat project structure.

### 10.7 native-libs directory — missing (LOW)

V3 had `archive/V3/L1/native-libs/` with:
- `OpenCL.lib` — Windows OpenCL import library
- `algorithms/` — per-algorithm READMEs (autolykos, blake3, cosmic-harmony, etchash, kawpow, kheavyhash, randomx, verushash)
- `include/zion_native_abi.h` — C ABI header
- `scripts/` — `build_linux.sh`, `build_windows.ps1`, `smoke_check.ps1`

**Action:** Port `zion_native_abi.h` and build scripts to `V31/L1/native-ffi/`. Algorithm READMEs can go to `docs/`.

### 10.8 L4/L5 design docs — missing (LOW)

V3 had design documentation:
- `archive/V3/L4/docs/` — AVATARS, GAME_SYSTEMS, TECH, README.md (OASIS game design)
- `archive/V3/L5/docs/` — ARCHITECTURE, COMMUNITIES, GOVERNANCE, PROTOCOLS, TECH, TEMPLATES, README.md (Free World design)

**Action:** Port to `V31/L4/docs/` and `V31/L5/docs/` or to `docs/` subtree.

### 10.9 Pool — external pool expansion (already strong, needs hardening)

V31 pool is already MORE capable than V3:

**Already in V31 (NOT in V3):**
- `auxpow_bridge.rs` — bridge between ZION pool and external AuxPoW pools
- `auxpow_runtime.rs` — spawns tokio task per external coin, connects to upstream pools
- `share_forwarder.rs` — forwards shares to external pools (31 coins supported)
- `profit_switcher.rs` — pool-side profit switching with hysteresis
- `share_relay.rs` — share relaying
- `revenue_scheduler.rs` — revenue scheduling with session groups
- `revenue_proxy.rs` — revenue proxy
- `deferred_payout.rs` — deferred payout system
- `payout.rs` — payout engine
- `tls.rs` — TLS support for stratum
- `vardiff.rs` — variable difficulty per miner
- `rate_limit.rs` — rate limiting
- `template_cache.rs` — block template caching
- `block_tracker.rs` — block tracking
- `notifications.rs` — notifications
- `validator.rs` — share validation
- `v3_pplns.rs` / `v3_protocol.rs` — V3 compatibility

**31 external coins supported** (ExternalCoin enum): Kaspa, Alephium, Decred, Vertcoin, Ravencoin, Monero, EpicCash, Zano, Meowcoin, Clore, Flux, Neoxa, EthereumClassic, Bitcoin, Verus, Ergo, Evrmore, Pearl, Quai, Beam, Karlsen, Zclassic, Qubitcoin, IronFish, Nexa, Raptoreum, Dynex, Nervos, Conflux, Zcash, PhoenixCoin, Keryx.

**Pool preferences:** NiceHash, HeroMiners, ZPool, Default.

**What's needed for "maximal expansion to external pools":**

| Item | Status | Action |
|------|--------|--------|
| Stratum v2 protocol support | ❌ MISSING (only v1) | Add stratum v2 (SRI) support |
| Pool-to-pool downstream protocol | ❌ MISSING | Allow V31 pool to serve as upstream for downstream pools (proxy/hub mode) |
| PPS payment scheme | ❌ MISSING (only PPLNS) | Add PPS + SOLO modes |
| Multi-coin merge-mining pool | ⚠️ PARTIAL (auxpow bridge exists but single-coin per stream) | Allow multiple external coins simultaneously |
| Pool API v2 (OpenAPI/Swagger) | ❌ MISSING | Document REST API, add OpenAPI spec |
| Websocket pool stats | ❌ MISSING | Add WS endpoint for live stats |
| Pool difficulty stratification | ⚠️ PARTIAL (vardiff exists) | Add explicit difficulty tiers (low/mid/high) |
| Geographical pool routing | ❌ MISSING | Multiple pool endpoints with geo-DNS |
| Banning / anti-bot | ⚠️ PARTIAL (rate_limit exists) | Add share-bomb detection, IP banning |

### 10.10 Revenue system — status

V31 has a comprehensive revenue system across multiple crates:

- `V31/L1/cosmic-harmony/src/revenue.rs` — RevenueSource enum (26 sources), revenue distribution
- `V31/L1/cosmic-harmony/src/revenue_journal.rs` — Revenue journal (JSONL persistence)
- `V31/L1/cosmic-harmony/src/profit.rs` — ProfitRouter, CoinProfile, ExternalCoin (31 coins), ProfitEntry
- `V31/L1/cosmic-harmony/src/stream_profit.rs` — Stream profit layers
- `V31/L1/cosmic-harmony/src/stream_layers.rs` — Stream layer definitions
- `V31/L1/cosmic-harmony/src/ncl_integration.rs` — NCL revenue integration
- `V31/L1/miner/src/stream_profit.rs` — Live profit oracle (WhatToMine + NiceHash API)
- `V31/L1/miner/src/autonomous.rs` — Autonomous profit router (hardware filtering, profit calc, hysteresis)
- `V31/L1/pool/src/revenue_scheduler.rs` — Pool revenue scheduling
- `V31/L1/pool/src/revenue_proxy.rs` — Pool revenue proxy
- `V31/L1/pool/src/profit_switcher.rs` — Pool-side profit switching
- `V31/L1/pool/src/deferred_payout.rs` — Deferred payouts

**What's working:** Revenue sources defined, profit routing with 31 external coins, live API integration, pool-side switching, journal persistence.

**What's missing:**
- B2B revenue sharing (described in `archive/AuXpow/REVENUE_B2B_AND_TRUE_AUXPOW_DESIGN.md` but not implemented)
- True AuxPoW consensus integration (data structures exist in `true_auxpow.rs` but not wired into L1 consensus)
- Revenue dashboard / analytics UI

---

## 11. Phase H — V3→V31 Migration Completion (parallel with Phase E-F)

Goal: close all migration gaps from §10 so V31 is a true superset of V3.

| # | Task | Priority | Acceptance | Evidence |
|---|------|----------|------------|----------|
| H1 | **Port Solidity contracts** | CRITICAL | All 9 V3 contracts + 7 ZionDex contracts in `V31/L2/multichain/contracts/`. Foundry project setup. | `forge test` passes. |
| H2 | **Port miner TUI** | HIGH | `ui.rs`, `interactive.rs`, `setup_menu.rs`, `banner.rs` in V31 miner. Keyboard controls work. | TUI demo screenshot. |
| H3 | **Complete miner Cargo features** | HIGH | All native-* features exposed in miner Cargo.toml. `full` and `gpu-all` convenience features work. | `cargo build --features full` succeeds. |
| H4 | **Port missing CLI commands** | HIGH | `dao`, `warp`, `atomic_swap`, `auxpow`, `onboard`, `update`, `monitor`, `deploy`, `compose` commands in V31 CLI. | `zion <cmd> --help` works for each. |
| H5 | **Port CLI infrastructure** | MEDIUM | `auto_detect.rs`, `config.rs`, `rpc/` module, `ui.rs` in V31 CLI. | CLI auto-detection works. |
| H6 | **Port ZionDex standalone services** | MEDIUM | Router price oracle + solver strategy engine in V31 (either standalone or in multichain). | DEX quote API returns live prices. |
| H7 | **Port native-libs** | LOW | `zion_native_abi.h` + build scripts in V31. | Cross-platform build works. |
| H8 | **Port L4/L5 design docs** | LOW | OASIS + Free World design docs in V31 or `docs/`. | Docs accessible. |
| H9 | **Port AuXpow E2E test script** | MEDIUM | `run_e2e_8coins.sh` adapted for V31 miner. | Script runs and tests 8 coins. |
| H10 | **Stratum v2 pool support** | MEDIUM | SRI-compatible stratum v2 server. | v2 client connects and mines. |
| H11 | **PPS + SOLO pool modes** | MEDIUM | Pool supports PPLNS + PPS + SOLO payment schemes. | Config switchable, payouts correct. |
| H12 | **Pool downstream/proxy mode** | MEDIUM | V31 pool can act as upstream for downstream pools. | Proxy chain test passes. |
| H13 | **B2B revenue sharing** | LOW | Implement B2B revenue split from `REVENUE_B2B_AND_TRUE_AUXPOW_DESIGN.md`. | Revenue split test passes. |
| H14 | **True AuxPoW consensus integration** | LOW | Wire `true_auxpow.rs` validation into L1 consensus. | Merge-mined block accepted by node. |

**Phase H Go/No-Go:**
- [ ] H1, H2, H3, H4 pass (critical path for feature parity).
- [ ] H6, H9, H10, H11 pass (pool + DEX feature completeness).
- [ ] No V3 source files remain unreferenced (full superset).

---

## 12. Updated priority order of execution

```
Week 1:  E1  GPU Go/No-Go on first reference rig
         E2  AuxPoW real-pool E2E
         E3  Profit switching live test
         E4  Bridge Base mainnet round-trip
         H1  Port Solidity contracts (parallel)
         H3  Complete miner Cargo features (parallel)

Week 2:  E5  Non-EVM WARP hardening
         E6  Solver network real E2E
         E7  Public subtree sync
         E8  XMR/RandomX decision
         H2  Port miner TUI (parallel)
         H4  Port missing CLI commands (parallel)

Week 3:  E9  L5/L6 activation decision
         F1  Internal security audit
         F2  Fuzzing infrastructure + 24h run
         H6  Port ZionDex standalone services (parallel)
         H9  Port AuXpow E2E test script (parallel)

Week 4:  F3  Chaos tests (local testnet)
         F4  1000+ miner simulation
         F5  Backup / DR drill
         H10 Stratum v2 pool support (parallel)
         H11 PPS + SOLO pool modes (parallel)

Week 5:  F6  Start 30-day continuous run
         G1  Feature freeze, G2 release prep
         H5  Port CLI infrastructure (parallel)
         H12 Pool downstream/proxy mode (parallel)

Weeks 6-9: 30d run monitoring + bugfix sprints
           H7, H8, H13, H14 (low priority, post-stable)

Week 10: G2-G7 release and launch readiness
```

---

## 13. Updated Definition of "Done" for 3.2.0 "One Love"

1. 30d continuous run on Edge completed, uptime ≥99.9% for pool, no critical incidents.
2. Real GPU mining pass on at least two reference rigs with ≥90% accept rate.
3. Bridge wZION round-trip verified on Base mainnet.
4. No undeclared placeholder addresses or mock clients in hot paths.
5. Public subtree fully in sync and clean.
6. Security audit and chaos tests complete with mitigations.
7. `v3.2.0` GitHub release with multi-platform binaries and SHA256SUMS.
8. Monitoring, alerting, backup/DR, and runbooks tested and current.
9. Public docs and community channels ready for public mainnet.
10. `cargo test --workspace` and `cargo clippy --workspace` remain clean.
11. **V31 is a true superset of V3** — all V3 crates, features, contracts, CLI commands, and GPU kernels are present in V31 or explicitly documented as deferred.
12. **Miner TUI works** — interactive keyboard control, sticky header, setup menu.
13. **All native algorithm features exposed** — `cargo build --features full` produces a unified miner binary.
14. **All Solidity contracts ported** — wZION, Bridge, AtomicSwap, Governance, Treasury, Staking, Farm, ZionDex contracts.
15. **Pool supports PPLNS + PPS + SOLO** with stratum v1 + v2.

---

## 14. Canonical references

- Current live status: [`StatusV3.md`](../StatusV3.md)
- V31 status: [`V31/STATUS.md`](./STATUS.md)
- Reconciled 3.1 plan: [`PLAN_TO_3.1_RECONCILED.md`](../docs/3.1/PLAN_TO_3.1_RECONCILED.md)
- 30d run: [`V31/30D_RUN_PLAN.md`](./30D_RUN_PLAN.md)
- Chaos tests: [`V31/CHAOS_TEST_PLAN.md`](./CHAOS_TEST_PLAN.md)
- V31 build plan: [`V31/ALPHA_BUILD_PLAN.md`](./ALPHA_BUILD_PLAN.md)
- Cut-over plan: [`V31/CUTOVER_PLAN.md`](./CUTOVER_PLAN.md)
- Launch checklist: [`docs/3.0.8/LAUNCH_CHECKLIST.md`](../docs/3.0.8/LAUNCH_CHECKLIST.md)
- Agent rules: [`V31/AGENTS.md`](./AGENTS.md) · [`../AGENTS.md`](../AGENTS.md)

---

*Generated with [Devin](https://devin.ai) — 2026-08-06, updated 2026-08-06 with deep V3→V31 migration gap analysis*  
*Dedicated to the vision of unity — 3.2.0 "One Love".
