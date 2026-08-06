# ZION 3.2 "One Love" — Mainnet Stable Canonical Execution Plan

> **Version:** 3.2.0 "One Love" — Mainnet Stable / production ready  
> **Datum:** 2026-08-07  
> **Status:** canonical plan, supersedes `PLAN_TO_3.1_RECONCILED.md` for forward work  
> **Update 2026-08-07:** CLI migration, miner TUI, native Cargo features, and V3/V31 Solidity + ZionDex contracts are now present in code. Non-EVM WARP placeholders, OASIS static export, ZIS Edge deploy, public subtree sync, real GPU E2E, and 30d run remain open.  
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
| V31 node on Edge | `zion-v31-node` P2P 8335, RPC 9445, fresh chain from 2026-08-06 reset | verified 2026-08-07 |
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
| G11 | **V3→V31 migration — code present, deployment/tooling incomplete** | §10 deep audit | Solidity contracts, miner TUI, Cargo features, and CLI commands are now in V31 code. Missing: Foundry/Hardhat project config for `zion deploy`, some CLI subcommands are stubs, non-EVM WARP contracts are placeholders, `public/` subtree is out of sync, ZIS is not installed by `deploy-edge.sh`, OASIS Web uses static export. See §10 for full gap analysis and Phase H for remediation. |

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

## 10. V3 → V31 Migration Gap Analysis (2026-08-07 re-audit)

> **Method:** systematic comparison of `archive/V3/` + `archive/AuXpow/` + `archive/ZionDex/` vs `V31/` — every crate, every source file, every Cargo feature, every GPU kernel, every Solidity contract, every CLI command. **Re-audit result:** most of the originally flagged "missing" items (CLI commands, miner TUI, Cargo features, EVM/ZionDex contracts) are now present in code; the remaining gaps are mostly tooling/deployment integration (Foundry/Hardhat, non-EVM WARP contracts, OASIS static export, ZIS Edge deploy, public subtree sync).

### 10.1 Migration status summary

| Layer | V3 crates | V31 equivalent | Status |
|-------|-----------|----------------|--------|
| L1/core | `archive/V3/L1/core` (49 files) | `V31/L1/core` (66 files, incl. v3_* compat + new block/chain_state/consensus/node_runtime) | ✅ MIGRATED + enhanced |
| L1/cosmic-harmony | `archive/V3/L1/cosmic-harmony` (19 files) | `V31/L1/cosmic-harmony` (21 files) + `V31/L1/cosmic-harmony-v3` (19 files) | ✅ MIGRATED (split into new + v3 legacy) |
| L1/native-ffi | `archive/V3/L1/native-ffi` | `V31/L1/native-ffi` (identical features: 9 native-* + native-all) | ✅ MIGRATED |
| L1/native-libs | `archive/V3/L1/native-libs/` (OpenCL.lib, algorithms/, build scripts, ABI header) | — | ❌ MISSING |
| L1/pool | `archive/V3/L1/pool` (8 files) | `V31/L1/pool` (32 files) | ✅ MIGRATED + massively expanded |
| L1/miner | `archive/V3/L1/miner` (15 files) | `V31/L1/miner` (30+ files + auxpow/ + gpu/ + csrc/) | ✅ MIGRATED + expanded; TUI wired behind `tui` feature (see §10.3) |
| AuXpow | `archive/AuXpow/` (25 Rust files + 90+ GPU kernels) | merged into `V31/L1/miner/src/auxpow/` + `V31/L1/miner/csrc/` | ⚠️ PARTIAL (see §10.4) |
| L2/bridge | `archive/V3/L2/bridge` (14 files) | `V31/L2/multichain/src/bridge/` | ✅ MIGRATED (unified into multichain) |
| L2/atomic-swap | `archive/V3/L2/atomic-swap` (10 files) | `V31/L2/multichain/src/swap/htlc.rs` | ✅ MIGRATED (unified into multichain) |
| L2/swap-aggregator | `archive/V3/L2/swap-aggregator` (6 files) | `V31/L2/multichain/src/swap/dex/aggregator.rs` | ✅ MIGRATED (unified into multichain) |
| L2/dao | `archive/V3/L2/dao` (20 files) | `V31/L2/dao` (21 files, + runtime.rs) | ✅ MIGRATED + enhanced |
| L2/contracts | `archive/V3/L2/contracts/hardhat/sol/` (9 .sol files) | `V31/L2/multichain/contracts/evm/` (8 .sol) + `contracts/dex/` (7 .sol) | ✅ MIGRATED; Foundry/Hardhat project config missing (blocks `zion deploy`) |
| L3/warp | `archive/V3/L3/warp` (49 files) | `V31/L2/multichain/src/warp/` (49+ files) | ✅ MIGRATED (moved to L2 multichain) |
| L3/ai-native | `archive/V3/L3/ai-native` (29 files) | `V31/L3/ai-native` (29 files, identical) | ✅ MIGRATED |
| L3/ncl | `archive/V3/L3/ncl` (9 files) | `V31/L3/ncl` (9 files, identical) | ✅ MIGRATED |
| L4/oasis | `archive/V3/L4/oasis` (28 files) | `V31/L4/oasis` (28 files, identical) | ✅ MIGRATED |
| L4/docs | `archive/V3/L4/docs/` (AVATARS, GAME_SYSTEMS, TECH, README) | — | ❌ MISSING (design docs) |
| L5/free-world | `archive/V3/L5/free-world` (10 files) | `V31/L5/free-world` (10 files, identical) | ✅ MIGRATED |
| L5/docs | `archive/V3/L5/docs/` (ARCHITECTURE, COMMUNITIES, GOVERNANCE, PROTOCOLS, TECH, TEMPLATES) | — | ❌ MISSING (design docs) |
| L6/issobella | `archive/V3/L6/issobella` (10 files) | `V31/L6/issobella` (10 files, identical) | ✅ MIGRATED |
| ZionDex | `archive/ZionDex/` (contracts + router + solver + intent + sdk) | `V31/L2/multichain/src/swap/dex/` (aggregator, executor, intent, intent_engine, solver_network) + `V31/L2/multichain/contracts/dex/` (7 .sol) | ✅ MIGRATED (contracts + Rust logic in multichain; see §10.5) |
| sdk | `archive/V3/sdk` (7 files) | `V31/sdk` (7 files, identical) | ✅ MIGRATED |
| cli | `archive/V3/cli` (35 files: 25 commands + rpc + ui + auto_detect + config) | `V31/cli` (`main.rs` + `menu.rs` + `commands/` + `ui/` + `rpc/`) | ✅ MIGRATED; 21 subcommands present, some are stubs (see §10.2) |
| smoke | — | `V31/smoke` (new, 8 cross-layer tests) | ✅ NEW in V31 |

### 10.2 CLI — commands present, some stubs / supporting modules partial

V31 CLI (`V31/cli/src/main.rs`) now defines **21 subcommands** and `V31/cli/src/commands/` contains per-command modules. The original "all missing" audit is out of date; the remaining gaps are functional depth (some subcommands are stubs) and supporting infrastructure (`auto_detect.rs`, full `config.rs`, `rpc/` module).

**Subcommands present in `V31/cli/src/main.rs`:**

| Subcommand | Purpose | V31 status | Priority |
|------------|---------|------------|----------|
| `menu` | Interactive operator menu | ✅ functional | — |
| `status` | Multi-Chain layer status | ✅ functional | — |
| `wallet` | Wallet file management (create/load/send) | ✅ functional | — |
| `bridge` | Cross-chain bridge commands | ✅ wired to multichain | — |
| `swap` | DEX swap commands | ✅ wired to multichain | — |
| `pool` | Mining pool commands | ✅ functional | — |
| `miner` | Miner commands | ✅ functional | — |
| `doctor` | Config / adapter connectivity check | ✅ present | — |
| `api` | Serve V31 HTTP API gateway | ✅ present | — |
| `node` | Start/stop/status L1 node | ✅ functional | — |
| `service` | Manage V31 systemd services + logs | ✅ functional | — |
| `dao` | DAO proposal/vote/treasury commands | ✅ present; may be stub | High |
| `atomic-swap` | HTLC atomic swap commands | ✅ present; may be stub | High |
| `warp` | Cross-chain WARP transfer commands | ✅ present; may be stub | High |
| `monitor` | Live monitoring dashboard | ✅ present; may be stub | Medium |
| `topology` | Network topology visualization | ✅ present; may be stub | Medium |
| `explorer` | Block explorer queries | ✅ present; may be stub | Medium |
| `onboard` | First-run onboarding wizard | ✅ present; may be stub | Medium |
| `deploy` | Smart-contract / Edge deployment | ✅ present; **needs Foundry/Hardhat config to be functional** | High |
| `update` | Self-update / version check | ✅ present | Low |
| `compose` | Docker Compose management | ✅ present | Medium |
| `auxpow` | AuxPoW merged mining commands | ✅ present | Medium |
| `completions` | Shell completion generation | ✅ present | Low |
| `agent` / `hiran` / `issobella` / `free-world` / `ncl` | L4/L5/L6 migration stubs | ⚠️ placeholder / not yet migrated | Low |

**Still incomplete / missing supporting modules:**
- `auto_detect.rs` — hardware/config auto-detection is not present.
- `config.rs` — full config file management module is not present.
- `rpc/` — `agent_rpc.rs`, `hiran_rpc.rs` are missing; `node_rpc.rs` exists via `V31/cli/src/rpc/`.
- `ui.rs` — exists as `V31/cli/src/ui.rs`, but coverage is partial.

### 10.3 Miner — features and TUI present, Ekam v3.2 constants landed (HIGH)

#### 10.3.1 Cargo features

`V31/L1/miner/Cargo.toml` now exposes the full feature matrix:

| Feature | Purpose | Status |
|---------|---------|--------|
| `auxpow` | AuxPoW merged mining | ✅ default |
| `native-hashers` | Enables RandomX, Ghostrider, VerusHash, Autolykos, kHeavyHash, Blake3, Ethash, KawPow, Cosmic Harmony via `zion-native-ffi` | ✅ present |
| `native-etchash` | Etchash (ETC) native C hasher | ✅ present |
| `native-kawpow` | KawPow (RVN) native C hasher | ✅ present |
| `native-autolykos` | Autolykos (ERG) native C hasher | ✅ present |
| `native-cosmic-harmony` | Cosmic Harmony native C hasher | ✅ present |
| `native-randomx` | RandomX (XMR) native C hasher | ✅ present |
| `native-ghostrider` | GhostRider (RTM) native C hasher | ✅ present |
| `native-all` | Convenience: all native algorithms | ✅ present |
| `gpu-opencl` / `gpu-cuda` / `gpu-metal` | GPU backends | ✅ present |
| `gpu` / `gpu-all` | Convenience: all GPU backends | ✅ present |
| `full` | GPU + all native + hashers (unified binary) | ✅ present |
| `public_build` | Hides Trinity/AuxPow details in TUI for public release | ✅ present |
| `tui` | Interactive terminal UI (`crossterm`) | ✅ present |
| `testnet_fork_rehearsal` | Hard-fork rehearsal gates | ❌ not exposed (deferred / low priority) |

**Action:** `testnet_fork_rehearsal` remains low priority; verify `cargo build --features full` works on all target platforms.

#### 10.3.2 TUI / interactive UI

V3 miner TUI modules are now present in V31 and wired behind the `tui` Cargo feature:

| V3/V31 file | Purpose | V31 status |
|-------------|---------|------------|
| `ui.rs` | Professional colored miner UI (XMRig/GMiner style), ANSI, sticky header, `/dev/tty` redirect | ✅ present in `V31/L1/miner/src/ui.rs` |
| `interactive.rs` | Cross-platform keyboard TUI (`crossterm`): h=hashrate, a=algorithm cycle, c=CPU toggle, g=GPU toggle, d=dual mode, i=hardware, p=pause, r=reconnect, v=verbose, 1-9=threads, q=quit | ✅ present in `V31/L1/miner/src/interactive.rs` |
| `setup_menu.rs` | Interactive setup menu for first-run (asks pool/wallet/threads, writes env vars) | ✅ present in `V31/L1/miner/src/setup_menu.rs` |
| `banner.rs` | ASCII art banner + version display | ✅ present in `V31/L1/miner/src/banner.rs` |
| `gpu/mod.rs` | GPU backend abstraction | ✅ V31-native replacement for V3 `gpu_backend.rs` |
| `gpu_kat_bench.rs` | GPU KAT benchmark binary | ❌ not present |

**Action:** Verify `cargo build -p zion-miner --features tui` and run an interactive TUI session. Port `gpu_kat_bench.rs` or integrate KAT GPU benchmark into `zion-miner` test suite.

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

### 10.5 ZionDex — migrated into multichain (MEDIUM)

ZionDex components are now present in V31:

| Component | V3 path | V31 status |
|-----------|---------|------------|
| **contracts/** | 7 Solidity contracts: `IntentSettlement`, `SolverRegistry`, `ZDXToken`, `ZionDexHooks`, `ZionDexPoolManager`, `ZionDexRouter`, `ZionDexStaking` + `DeployBase.s.sol` | ✅ present in `V31/L2/multichain/contracts/dex/` |
| **router/** | 13 Rust files: aggregator, api, config, db, executor, intent, monitor, price, quote, router, types | ✅ absorbed into `V31/L2/multichain/src/swap/dex/` (`aggregator.rs`, `executor.rs`, `intent.rs`, `intent_engine.rs`, quote/multi endpoint) |
| **solver/** | 9 Rust files: api, config, errors, node, router_client, strategy, types | ✅ `solver_network.rs` + `HttpSolverClient` + solver-side `/v1/swap/solve` endpoint |
| **intent/** | 6 Rust files: auction, errors, signing, solver, types | ✅ `intent.rs` + `intent_engine.rs` with SQLite persistence, auction, bid, settle, execute |
| **sdk/** | empty | — |

**Remaining gaps:**
- Standalone price oracle / quote API service can remain absorbed into multichain if `GET /quote/multi` and `POST /v1/swap/solve` are sufficient.
- Real multi-party E2E with an independent solver over the internet is still pending.

**Action:** Add Foundry/Hardhat project config so `zion deploy` can compile/deploy ZionDex contracts. Run a real solver-network E2E test.

### 10.6 Solidity smart contracts — present, missing Foundry/Hardhat tooling (CRITICAL)

V3/V31 EVM contracts are now in `V31/L2/multichain/contracts/evm/`:

| Contract | Purpose | V31 status |
|----------|---------|------------|
| `wZION.sol` | Wrapped ZION ERC-20 on Base L2 | ✅ present |
| `ZIONBridge.sol` | Bridge lock/mint/burn/release contract | ✅ present |
| `ZIONAtomicSwap.sol` | HTLC atomic swap contract | ✅ present |
| `ZIONGovernance.sol` | DAO governance contract | ✅ present |
| `ZIONTreasury.sol` | DAO treasury contract | ✅ present |
| `ZIONStaking.sol` | Staking contract | ✅ present |
| `ZIONFarm.sol` | Liquidity farming contract | ✅ present |
| `SefirotVowRegistry.sol` | Sefirot vow registry | ✅ present |
| `SefirotVowToken.sol` | Sefirot vow token | ✅ present |

**Note:** The AGENTS.md mentions wZION address `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` on Base. Contract sources are now in V31, but there is **no Foundry/Hardhat project** (`foundry.toml`, `hardhat.config.*`, `package.json`) in `V31/L2/multichain/contracts/`. This blocks the `zion deploy` subcommand from compiling or deploying EVM and ZionDex contracts.

**Action:** Add a Foundry (or Hardhat) project structure under `V31/L2/multichain/contracts/` with remappings, dependencies, and a `forge test` / `forge script` workflow. Wire the build/deploy output into `V31/cli/src/commands/deploy.rs`.

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
| H1 | **Port Solidity contracts + Foundry setup** | CRITICAL | All 9 V3 contracts + 7 ZionDex contracts in `V31/L2/multichain/contracts/`. Foundry project setup. | `forge test` passes; `zion deploy` compiles & deploys. |
| H2 | **Verify miner TUI** | HIGH | `ui.rs`, `interactive.rs`, `setup_menu.rs`, `banner.rs` in V31 miner. Keyboard controls work. | TUI demo screenshot. |
| H3 | **Verify miner Cargo features** | HIGH | All native-* features exposed in miner Cargo.toml. `full` and `gpu-all` convenience features work. | `cargo build --features full` succeeds. |
| H4 | **Verify / complete CLI commands** | HIGH | `dao`, `warp`, `atomic-swap`, `auxpow`, `onboard`, `update`, `monitor`, `deploy`, `compose` in V31 CLI. | `zion <cmd> --help` works for each; deploy compiles contracts. |
| H5 | **Port CLI infrastructure** | MEDIUM | `auto_detect.rs`, `config.rs`, `rpc/` module, `ui.rs` in V31 CLI. | CLI auto-detection works. |
| H6 | **Verify ZionDex solver network E2E** | MEDIUM | Router price oracle + solver strategy engine in V31 (absorbed into multichain). | DEX quote API returns live prices; real solver bid/execute over internet works. |
| H7 | **Port native-libs** | LOW | `zion_native_abi.h` + build scripts in V31. | Cross-platform build works. |
| H8 | **Port L4/L5 design docs** | LOW | OASIS + Free World design docs in V31 or `docs/`. | Docs accessible. |
| H9 | **Port AuXpow E2E test script** | MEDIUM | `run_e2e_8coins.sh` adapted for V31 miner. | Script runs and tests 8 coins. |
| H10 | **Stratum v2 pool support** | MEDIUM | SRI-compatible stratum v2 server. | v2 client connects and mines. |
| H11 | **PPS + SOLO pool modes** | MEDIUM | Pool supports PPLNS + PPS + SOLO payment schemes. | Config switchable, payouts correct. |
| H12 | **Pool downstream/proxy mode** | MEDIUM | V31 pool can act as upstream for downstream pools. | Proxy chain test passes. |
| H13 | **B2B revenue sharing** | LOW | Implement B2B revenue split from `REVENUE_B2B_AND_TRUE_AUXPOW_DESIGN.md`. | Revenue split test passes. |
| H14 | **True AuxPoW consensus integration** | LOW | Wire `true_auxpow.rs` validation into L1 consensus. | Merge-mined block accepted by node. |

**Phase H Go/No-Go:**
- [x] H1 sources present (contracts in `V31/L2/multichain/contracts/`); open: Foundry/Hardhat setup.
- [x] H2 sources present (miner TUI files exist); open: interactive TUI smoke test.
- [x] H3 features present (`full`, `native-all`, `gpu-all`, `public_build`); open: platform build verification.
- [x] H4 commands present in CLI; open: stubs and deploy functionality.
- [ ] H5 (CLI infrastructure) still needs `auto_detect.rs`, full `config.rs`, `rpc/`.
- [ ] H6 real DEX solver E2E over internet.
- [ ] H9, H10, H11 pass (pool + DEX feature completeness).
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
         I1  Design ZIS API (parallel)
         I2  Implement ZIS server (parallel)
         I3  Unified Prisma schema (parallel)
         J5  OASIS ↔ Market artifact sync (parallel)

Week 2:  E5  Non-EVM WARP hardening
         E6  Solver network real E2E
         E7  Public subtree sync
         E8  XMR/RandomX decision
         H2  Port miner TUI (parallel)
         H4  Port missing CLI commands (parallel)
         I4  Deploy ZIS on Edge (parallel)
         I5  Cross-domain cookie config (parallel)

Week 3:  E9  L5/L6 activation decision
         F1  Internal security audit
         F2  Fuzzing infrastructure + 24h run
         H6  Port ZionDex standalone services (parallel)
         H9  Port AuXpow E2E test script (parallel)
         J1  Web 2.9 → ZIS migration (parallel)
         J2  Market → ZIS migration (parallel)

Week 4:  F3  Chaos tests (local testnet)
         F4  1000+ miner simulation
         F5  Backup / DR drill
         H10 Stratum v2 pool support (parallel)
         H11 PPS + SOLO pool modes (parallel)
         J3  OASIS → server + ZIS (parallel)
         J4  Dashboard → ZIS (parallel)

Week 5:  F6  Start 30-day continuous run
         G1  Feature freeze, G2 release prep
         H5  Port CLI infrastructure (parallel)
         H12 Pool downstream/proxy mode (parallel)
         J6  Dashboard ↔ all apps (parallel)
         J7  Mining stats → shared DB (parallel)

Weeks 6-7: 30d run monitoring + bugfix sprints
           K1  Dashboard "My Ecosystem" view
           K3  Dashboard real-time updates (SSE)
           K4-K7 Dashboard panels
           J8  DAO → shared DB
           J9  Notifications system
           J10 Unified profile page

Weeks 8-9: 30d run continues
           I6  EVM wallet auth (SIWE)
           I7  Link EVM + ZION addresses
           I8  API key for programmatic access
           K2  Dashboard admin → ZIS roles
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
16. **Unified ecosystem auth** — single ZION wallet login across dashboard, web, market, and OASIS.
17. **Shared ecosystem database** — PostgreSQL backing all apps with synchronized user profiles, OASIS game state, marketplace listings, and mining stats.

---

## 14. Unified Ecosystem — Auth, Database & Cross-App Integration

> **Goal:** One login, one database, one user identity across the entire ZION ecosystem — dashboard, web 2.9, marketplace, OASIS, and future apps.

### 14.1 Current state — fragmented auth & data

| App | URL | Auth method | Storage | Tech |
|-----|-----|-------------|---------|------|
| **Dashboard** | `dashboard.zionterranova.com` | API key (`DASHBOARD_API_KEY`) + Basic Auth | JSON files, no user DB | Python stdlib HTTP |
| **Web 2.9** | `app.zionterranova.com` | JWT (jose) + Ed25519 wallet signature challenge | JSON files (`data/auth/users.json`, `data/auth/nonces.json`) | Next.js 16 |
| **Market** | `market.zionterranova.com` | env-based admin (`ADMIN_USERS=user:pass`) + wagmi/MetaMask wallet | PostgreSQL (Prisma ORM) | Next.js 14 |
| **OASIS** | `oasis.zionterranova.com` | own wallet impl (`@noble/ed25519`), no server auth | zustand persist (localStorage), OASIS game service SQLite | Next.js 16 (static export) |

**Problems:**
1. **4 different auth systems** — user must log in separately on each app.
2. **No shared user identity** — Web 2.9 has JSON users, Market has Prisma users, OASIS has game service players, Dashboard has API key only.
3. **No cross-app data** — can't show "your OASIS achievements + market purchases + mining stats" in one place.
4. **OASIS is static export** (`output: 'export'`) — no server-side API routes, no auth backend.
5. **Dashboard is Python** — different stack from the 3 Next.js apps.

**Existing integrations (partial):**
- Market → OASIS: `/api/oasis/sync` fetches avatars/quests/prizes/territories from OASIS API (`127.0.0.1:8094`) → upserts to Prisma DB. Works but one-directional.
- Market → Base L2: wagmi + ERC-1155 contracts, wZION payment (`0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`).
- Dashboard → V31 node/pool: RPC scraping for metrics.
- Web 2.9 → L1 RPC: blockchain API, explorer, wallet, bridge, DAO, DEX.

### 14.2 Target architecture — ZION Identity Service (ZIS)

```
                    ┌─────────────────────────────────────────┐
                    │     ZION Identity Service (ZIS)          │
                    │     auth.zionterranova.com               │
                    │                                          │
                    │  • Ed25519 wallet challenge (ZION L1)    │
                    │  • EVM wallet challenge (Base L2)        │
                    │  • JWT issuance + refresh                │
                    │  • Session management                    │
                    │  • User profile CRUD                     │
                    │  • API key generation for programmatic   │
                    └──────────────┬───────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │   Shared PostgreSQL DB       │
                    │   (Prisma, single instance)  │
                    │                              │
                    │  • users (wallet → profile)  │
                    │  • sessions (JWT blacklist)  │
                    │  • oasis_players             │
                    │  • oasis_achievements        │
                    │  • oasis_inventory           │
                    │  • market_artifacts          │
                    │  • market_listings           │
                    │  • market_sales              │
                    │  • mining_stats              │
                    │  • mining_workers            │
                    │  • dao_proposals             │
                    │  • dao_votes                 │
                    │  • bridge_transactions       │
                    │  • dex_orders                │
                    │  • notifications             │
                    └──────────────┬──────────────┘
                                   │
        ┌──────────────┬───────────┼───────────┬──────────────┐
        ▼              ▼           ▼           ▼              ▼
   Dashboard       Web 2.9     Market      OASIS         Future
   (Python)        (Next.js)   (Next.js)   (Next.js)     apps
```

**Key principles:**
1. **ZIS is the single source of truth** for auth — all apps delegate to it.
2. **One PostgreSQL database** — Prisma schema covers all apps.
3. **Wallet-based identity** — primary key is wallet address (ZION L1 `zion1...` or EVM `0x...`).
4. **Cross-domain SSO** — JWT in httpOnly cookie, validated by ZIS, shared across `*.zionterranova.com` subdomains.
5. **OASIS gets a server** — convert from static export to full Next.js with API routes (or add a thin BFF proxy).

### 14.3 Phase I — ZION Identity Service (ZIS)

| # | Task | Priority | Acceptance | Evidence |
|---|------|----------|------------|----------|
| I1 | **Design ZIS API** | CRITICAL | OpenAPI spec for: `/auth/nonce`, `/auth/wallet-verify` (Ed25519), `/auth/evm-verify` (EIP-4361), `/auth/session`, `/auth/refresh`, `/auth/logout`, `/profile`, `/profile/:address`. | OpenAPI spec committed. |
| I2 | **Implement ZIS server** | CRITICAL | Next.js 16 app at `APP&WEB/identity/`. Uses `jose` for JWT (same as Web 2.9). Supports both ZION L1 Ed25519 and EVM wallet challenges. | `npm run dev` works, auth flow tested. |
| I3 | **Unified Prisma schema** | CRITICAL | Single `schema.prisma` in `APP&WEB/shared/prisma/` covering: User, Session, OasisPlayer, OasisAchievement, OasisInventory, Artifact, Listing, Sale, MiningWorker, MiningStats, DaoProposal, DaoVote, BridgeTransaction, DexOrder, Notification. Merges Market's existing schema + new tables. | `prisma migrate dev` succeeds. |
| I4 | **Deploy ZIS on Edge** | HIGH | `auth.zionterranova.com` nginx vhost → `127.0.0.1:3101`. systemd `zion-identity.service`. TLS via Let's Encrypt. | `curl https://auth.zionterranova.com/health` = 200. |
| I5 | **Cross-domain cookie config** | HIGH | JWT cookie domain = `.zionterranova.com` (all subdomains). httpOnly, secure, sameSite=lax. 7-day expiry with refresh. | Browser devtools show cookie on all subdomains. |
| I6 | **EVM wallet auth (EIP-4361)** | MEDIUM | "Sign-In with Ethereum" for Market users. Uses `siwe` library. Binds EVM address to ZION user profile. | MetaMask login flow works. |
| I7 | **Link EVM + ZION addresses** | MEDIUM | User can link their EVM wallet to their ZION wallet in profile. One user, multiple addresses. | Profile page shows linked addresses. |
| I8 | **API key for programmatic access** | LOW | Users can generate API keys for CLI/scripts. Stored hashed in DB. | `curl -H "X-API-Key: ..." ` works. |

### 14.4 Phase J — Cross-App Integration

| # | Task | Priority | Acceptance | Evidence |
|---|------|----------|------------|----------|
| J1 | **Web 2.9 → ZIS migration** | HIGH | Replace Web 2.9's `auth-storage.ts` (JSON files) with ZIS API calls. Keep `AuthContext.tsx` interface, swap backend. | Login on `app.zionterranova.com` uses ZIS. |
| J2 | **Market → ZIS migration** | HIGH | Replace Market's `admin-auth.ts` (env-based) with ZIS. Keep Prisma but point to shared DB. wagmi stays for on-chain ops. | Login on `market.zionterranova.com` uses ZIS. |
| J3 | **OASIS → server + ZIS** | HIGH | Convert OASIS from `output: 'export'` to full Next.js with API routes. Add ZIS auth. OASIS game service (`127.0.0.1:8094`) keeps game logic, OASIS web gets auth layer. | Login on `oasis.zionterranova.com` uses ZIS. |
| J4 | **Dashboard → ZIS** | MEDIUM | Dashboard Python app validates JWT from ZIS instead of API key. Or: replace Python dashboard with Next.js dashboard that uses ZIS. Admin operations require ZIS admin role. | Dashboard login uses ZIS. |
| J5 | **OASIS ↔ Market artifact sync** | HIGH | Bidirectional: Market syncs OASIS game items as NFTs (exists). OASIS shows market listings for player's artifacts. Player can mint OASIS achievement → NFT → list on market. | Round-trip: OASIS quest complete → mint NFT → list on market → visible in OASIS. |
| J6 | **Dashboard ↔ all apps** | HIGH | Dashboard shows: user's OASIS player stats, market portfolio, mining stats, DAO proposals, bridge history — all from shared DB. | Dashboard "My Ecosystem" tab. |
| J7 | **Mining stats → shared DB** | MEDIUM | Pool writes per-miner stats (hashrate, shares, earnings) to shared DB. Dashboard and Web 2.9 can query. | Miner stats visible in dashboard + web. |
| J8 | **DAO → shared DB** | MEDIUM | DAO proposals/votes synced to shared DB. Web 2.9 DAO page and dashboard show same data. | DAO proposal visible in both. |
| J9 | **Notifications system** | MEDIUM | Shared notifications table. Events: OASIS achievement, market sale, mining payout, DAO vote result, bridge completion. Web 2.9 + dashboard show notifications. | Notification bell works. |
| J10 | **Unified profile page** | MEDIUM | One profile page (on Web 2.9 or ZIS) showing: wallet addresses, OASIS level/XP, market portfolio, mining stats, DAO participation, bridge history. | Profile page loads all data. |

### 14.5 Phase K — Dashboard Enhancement

| # | Task | Priority | Acceptance | Evidence |
|---|------|----------|------------|----------|
| K1 | **Dashboard "My Ecosystem" view** | HIGH | Authenticated user sees personalized: mining stats, OASIS player, market portfolio, DAO votes, bridge txs. | Screenshot. |
| K2 | **Dashboard admin → ZIS roles** | MEDIUM | Admin operations (service control, config) require ZIS admin role. RBAC in ZIS. | Non-admin user can't access admin panel. |
| K3 | **Dashboard real-time updates** | MEDIUM | WebSocket or SSE for live: block height, pool hashrate, OASIS events, market sales. | Live updates without page refresh. |
| K4 | **Dashboard OASIS panel** | MEDIUM | Live OASIS game state: active players, golden egg status, leaderboard, territory control. | OASIS panel renders. |
| K5 | **Dashboard market panel** | MEDIUM | Live market: recent sales, floor prices, active listings, volume. | Market panel renders. |
| K6 | **Dashboard mining panel** | HIGH | Pool hashrate, active miners, share rate, block finds, AuxPoW coin routing. | Mining panel renders (partially exists). |
| K7 | **Dashboard bridge/DeFi panel** | LOW | Bridge TVL, wZION supply, DEX volume, liquidity pools. | DeFi panel renders. |

### 14.6 Shared Prisma schema — initial design

```prisma
// ── User identity ──────────────────────────────────────────────────

model User {
  id              String   @id @default(cuid())
  primaryAddress  String   @unique  // zion1... or 0x...
  displayName     String?
  email           String?
  avatar          String?
  bio             String?
  role            String   @default("user") // "user" | "admin" | "moderator"
  createdAt       DateTime @default(now())
  lastLogin       DateTime?
  loginCount      Int      @default(0)

  linkedAddresses LinkedAddress[]
  sessions        Session[]
  apiKeys         ApiKey[]
  oasisPlayer     OasisPlayer?
  miningWorkers   MiningWorker[]
  daoVotes        DaoVote[]
  notifications   Notification[]

  @@index([role])
}

model LinkedAddress {
  id          String   @id @default(cuid())
  userId      String
  address     String   @unique
  chainType   String   // "zion-l1" | "evm" | "bitcoin"
  chainId     String?  // "base" | "ethereum" | etc.
  verifiedAt  DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])

  @@index([userId])
}

model Session {
  id          String   @id @default(cuid())
  userId      String
  jwtJti      String   @unique  // JWT ID for revocation
  createdAt   DateTime @default(now())
  expiresAt   DateTime
  revoked     Boolean  @default(false)
  userAgent   String?
  ipAddress   String?
  user        User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([expiresAt])
}

model ApiKey {
  id          String   @id @default(cuid())
  userId      String
  keyHash     String   @unique  // SHA256 of API key
  label       String   // "CLI" | "Script" | etc.
  createdAt   DateTime @default(now())
  lastUsed    DateTime?
  user        User     @relation(fields: [userId], references: [id])

  @@index([userId])
}

// ── OASIS game ─────────────────────────────────────────────────────

model OasisPlayer {
  id              String   @id @default(cuid())
  userId          String   @unique
  address         String   @unique  // game service player address
  totalXp         Int      @default(0)
  level           String   @default("Physical")
  guildId         String?
  blocksMined     Int      @default(0)
  zionEarned      BigInt   @default(0)
  titheTotal      BigInt   @default(0)
  challengesDone  Int      @default(0)
  dailyStreak     Int      @default(0)
  bestStreak      Int      @default(0)
  lastActive      DateTime?
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id])
  achievements    OasisAchievement[]
  inventory       OasisInventory[]

  @@index([level])
  @@index([guildId])
}

model OasisAchievement {
  id              String   @id @default(cuid())
  playerId        String
  achievementType String
  milestone       Int
  earnedAt        DateTime @default(now())
  player          OasisPlayer @relation(fields: [playerId], references: [id])

  @@unique([playerId, achievementType, milestone])
}

model OasisInventory {
  id              String   @id @default(cuid())
  playerId        String
  itemType        String   // "avatar" | "quest_item" | "prize" | "territory" | "ship"
  itemId          String
  quantity        Int      @default(1)
  acquiredAt      DateTime @default(now())
  player          OasisPlayer @relation(fields: [playerId], references: [id])

  @@unique([playerId, itemType, itemId])
}

// ── Marketplace (from existing Market schema) ──────────────────────

model Artifact {
  id              String   @id @default(cuid())
  tokenId         BigInt
  contractAddress String
  category        String   @default("quest_item")
  name            String
  description     String   @db.Text
  rarity          String   @default("common")
  source          String   @default("oasis")
  imageUri        String
  assetUri        String?
  metadataUri     String   @default("")
  stats           Json?
  creator         String
  createdAt       DateTime @default(now())
  mintedAt        DateTime?
  totalSupply     Int      @default(1)
  circulatingSupply Int    @default(1)
  listings        Listing[]
  sales           Sale[]
  @@unique([contractAddress, tokenId])
  @@index([category])
  @@index([rarity])
  @@index([creator])
  @@index([source])
}

model Listing {
  id              String   @id @default(cuid())
  artifactId      String
  tokenId         BigInt
  contractAddress String
  seller          String
  saleType        String   @default("fixed")
  price           BigInt
  priceUsd        Float?
  quantity        Int      @default(1)
  status          String   @default("active")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @default(now())
  expiresAt       DateTime?
  artifact        Artifact @relation(fields: [artifactId], references: [id])
  @@index([seller])
  @@index([status])
  @@index([saleType])
}

model Sale {
  id              String   @id @default(cuid())
  artifactId      String
  tokenId         BigInt
  contractAddress String
  buyer           String
  seller          String
  price           BigInt
  priceUsd        Float?
  quantity        Int      @default(1)
  txHash          String?
  createdAt       DateTime @default(now())
  artifact        Artifact @relation(fields: [artifactId], references: [id])
  @@index([buyer])
  @@index([seller])
  @@index([createdAt])
}

// ── Mining ─────────────────────────────────────────────────────────

model MiningWorker {
  id          String   @id @default(cuid())
  userId      String?
  address     String   @unique  // pool wallet address
  workerName  String
  pool        String   @default("zion-pool")
  coin        String   @default("ZION")
  algorithm   String   @default("ekam_deeksha")
  hashrate    Float    @default(0)  // H/s
  shares      Int      @default(0)
  accepted    Int      @default(0)
  rejected    Int      @default(0)
  stale       Int      @default(0)
  lastShareAt DateTime?
  createdAt   DateTime @default(now())
  user        User?    @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([pool])
  @@index([coin])
}

model MiningStats {
  id          String   @id @default(cuid())
  workerId    String
  timestamp   DateTime @default(now())
  hashrate    Float
  shares      Int
  accepted    Int
  rejected    Int
  stale       Int
  uptime      Int      // seconds

  @@index([workerId, timestamp])
}

// ── DAO ────────────────────────────────────────────────────────────

model DaoProposal {
  id          String   @id @default(cuid())
  proposalId  Int      @unique
  title       String
  description String   @db.Text
  proposer    String
  status      String   @default("active")
  yesVotes    Int      @default(0)
  noVotes     Int      @default(0)
  createdAt   DateTime @default(now())
  expiresAt   DateTime
  votes       DaoVote[]

  @@index([status])
}

model DaoVote {
  id          String   @id @default(cuid())
  proposalId  Int
  voter       String
  vote        Boolean  // true=yes, false=no
  weight      BigInt
  votedAt     DateTime @default(now())
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])

  @@unique([proposalId, voter])
}

// ── Bridge ─────────────────────────────────────────────────────────

model BridgeTransaction {
  id          String   @id @default(cuid())
  txType      String   // "lock" | "mint" | "burn" | "release"
  sourceChain String
  destChain   String
  amount      BigInt
  sender      String
  recipient   String
  sourceTxHash String?
  destTxHash   String?
  status      String   @default("pending")
  createdAt   DateTime @default(now())
  completedAt DateTime?

  @@index([sender])
  @@index([recipient])
  @@index([status])
}

// ── DEX ────────────────────────────────────────────────────────────

model DexOrder {
  id          String   @id @default(cuid())
  orderType   String   // "swap" | "add_liquidity" | "remove_liquidity"
  tokenIn     String
  tokenOut    String
  amountIn    BigInt
  amountOut   BigInt?
  trader      String
  txHash      String?
  status      String   @default("pending")
  createdAt   DateTime @default(now())

  @@index([trader])
  @@index([status])
}

// ── Notifications ──────────────────────────────────────────────────

model Notification {
  id          String   @id @default(cuid())
  userId      String
  type        String   // "oasis_achievement" | "market_sale" | "mining_payout" | "dao_vote" | "bridge_complete"
  title       String
  body        String
  data        Json?
  read        Boolean  @default(false)
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])

  @@index([userId, read])
  @@index([createdAt])
}
```

### 14.7 Implementation order

```
Week 1-2 (parallel with Phase E/H):
  I1  Design ZIS API
  I2  Implement ZIS server
  I3  Unified Prisma schema
  J5  OASIS ↔ Market artifact sync (bidirectional)

Week 3-4:
  I4  Deploy ZIS on Edge
  I5  Cross-domain cookie config
  J1  Web 2.9 → ZIS migration
  J2  Market → ZIS migration

Week 5-6:
  J3  OASIS → server + ZIS
  J4  Dashboard → ZIS
  J6  Dashboard ↔ all apps
  J7  Mining stats → shared DB

Week 7-8:
  K1  Dashboard "My Ecosystem" view
  K3  Dashboard real-time updates
  K4-K7 Dashboard panels
  J8  DAO → shared DB
  J9  Notifications system
  J10 Unified profile page

Week 9-10:
  I6  EVM wallet auth (SIWE)
  I7  Link EVM + ZION addresses
  I8  API key for programmatic access
  K2  Dashboard admin → ZIS roles
```

### 14.8 Technical decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth server tech | Next.js 16 (same as Web 2.9 + OASIS) | Unified stack, shared code |
| JWT library | `jose` (already in Web 2.9) | Edge-compatible, proven |
| Database | PostgreSQL (already in Market) | Single instance, Prisma ORM |
| Schema management | Prisma (already in Market) | Migrations, type safety |
| ZION wallet auth | Ed25519 challenge-response (already in Web 2.9) | Same flow, just centralized |
| EVM wallet auth | EIP-4361 (SIWE) via `siwe` lib | Standard, MetaMask compatible |
| Cross-domain SSO | JWT cookie on `.zionterranova.com` | All subdomains share cookie |
| OASIS backend | Convert to full Next.js (remove `output: 'export'`) | Need server for auth + API |
| Dashboard | Keep Python for now, add ZIS JWT validation | Don't rewrite working code |
| Real-time | SSE (Server-Sent Events) | Simpler than WebSocket, works with Next.js |
| Notifications | DB-backed, polled or SSE | Simple, no extra infra |

### 14.9 Risks

| Risk | Mitigation |
|------|------------|
| OASIS conversion from static export breaks deploy | Keep static export as fallback; add server-only routes behind feature flag |
| Dashboard Python can't validate JWT easily | Add a `/auth/verify` endpoint in ZIS that Dashboard calls; or replace Dashboard with Next.js |
| Shared DB becomes bottleneck | Use read replicas for dashboard/web; connection pooling (PgBouncer) |
| Cross-domain cookie blocked by browser | Use `.zionterranova.com` domain cookie; all apps on same root domain |
| EVM + ZION address linking confusion | Clear UI: "Link your MetaMask wallet to your ZION account"; one primary, multiple linked |
| Migration breaks existing Market users | Port existing Prisma data to shared DB; no data loss |

---

## 15. Canonical references

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

*Generated with [Devin](https://devin.ai) — 2026-08-06, updated 2026-08-06 with V3→V31 gap analysis + unified ecosystem plan*  
*Dedicated to the vision of unity — 3.2.0 "One Love".
