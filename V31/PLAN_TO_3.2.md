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

## 10. Canonical references

- Current live status: [`StatusV3.md`](../StatusV3.md)
- V31 status: [`V31/STATUS.md`](./STATUS.md)
- Reconciled 3.1 plan: [`PLAN_TO_3.1_RECONCILED.md`](../PLAN_TO_3.1_RECONCILED.md)
- 30d run: [`V31/30D_RUN_PLAN.md`](./30D_RUN_PLAN.md)
- Chaos tests: [`V31/CHAOS_TEST_PLAN.md`](./CHAOS_TEST_PLAN.md)
- V31 build plan: [`V31/ALPHA_BUILD_PLAN.md`](./ALPHA_BUILD_PLAN.md)
- Cut-over plan: [`V31/CUTOVER_PLAN.md`](./CUTOVER_PLAN.md)
- Launch checklist: [`docs/3.0.8/LAUNCH_CHECKLIST.md`](../docs/3.0.8/LAUNCH_CHECKLIST.md)
- Agent rules: [`V31/AGENTS.md`](./AGENTS.md) · [`../AGENTS.md`](../AGENTS.md)

---

*Generated with [Devin](https://devin.ai) — 2026-08-06*  
*Dedicated to the vision of unity — 3.2.0 "One Love".
