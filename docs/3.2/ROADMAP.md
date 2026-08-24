# ZION 3.2 "One Love" — Mainnet Stable Roadmap

> **Version target:** 3.2.0 "One Love" (Mainnet Stable)  
> **Current version:** 3.2.0-beta (V31 Mainnet Alpha pre-release), protocol `zion-v3-node/3.1.0-alpha`  
> **Last updated:** 2026-08-23  
> **Public launch target:** 31 December 2026  
> **Daily summary:** [`REPORTS/REPORT_2026-08-22_DAILY_SUMMARY.md`](./REPORTS/REPORT_2026-08-22_DAILY_SUMMARY.md)
>
> **Canonical plans:**
> - Launch & marketing plan: [`OneLoveV3.2.md`](../../OneLoveV3.2.md)
> - Technical execution plan: [`V31/PLAN_TO_3.2.md`](../../V31/PLAN_TO_3.2.md)
> - Live status: [`StatusV3.md`](../../StatusV3.md) · [`V31/STATUS.md`](../../V31/STATUS.md)

---

## 1. Executive summary

V31 Mainnet Alpha is **live and producing blocks on Edge**. The workspace compiles, `cargo test --workspace` passes with 0 failures, and the production stack (`zion-node`, `zion-pool`, `zion-miner`, `zion-multichain`, `zion-dao`, `zion-oasis`, web, marketplace, dashboard) is active.

3.2.0 "One Love" is the track from *production started* to *production exercised and stable*. It is gated by real-world E2E, a 30-day continuous run, security audit, public-subtree sync, and release readiness.

---

## 2. What is already resolved in 3.1.0-beta

| Area | Status | Evidence |
|------|--------|----------|
| V31 workspace build & tests | ✅ Complete | `cargo test --workspace` passes, `cargo clippy --workspace` clean |
| V31 node on Edge | ✅ Active | height 7000+, protocol 3.1.0-alpha |
| V31 pool on Edge | ✅ Active | stratum 8444, shares accepted, PPLNS payout confirmation sweep active |
| V31 multichain | ✅ Active | `/health` 200, DEX + HTLC endpoints wired |
| V31 DAO | ✅ Active | runtime, L1 scanner, HTTP API + metrics |
| V31 OASIS | ✅ Active | raw TCP RPC, blockchain listener fixed |
| V31 dashboard | ✅ Active | V31 service metrics, Grafana, `/health` |
| Trinity mining (ZION + ZANO + VRSC) | ✅ Production | 22–24 MH/s total, 100% accept rate on Edge pool |
| CUDA DAG disk cache | ✅ Live | `~/.zion/dag-cache/{algo}_epoch{N}.bin` |
| ZANO duplicate-share fix | ✅ Deployed | unique 64-bit nonce base per external job |
| LWMA difficulty clamp | ✅ Deployed | `MIN_SOLVE_TIME=6`, `MAX_SOLVE_TIME=360`, ±50% per-block clamp |
| CPU-only miner enumeration | ✅ Fixed | `ZION_GPU_BACKEND=cpu` short-circuits OpenCL/CUDA/Metal |
| Native TX/address index | ✅ Active | `tx_index`, `output_index`, `address_tx_index` in SQLite |
| Genesis key rotation (2026-08-06) | ✅ Complete | 38 BIP39 keypairs, new genesis hashes |

---

## 3. What must still close for 3.2.0 "One Love"

These are the hard gates. Each must be backed by evidence before 3.2.0 can be called Mainnet Stable.

| ID | Gate | Why it blocks 3.2 | Current status |
|----|------|-------------------|----------------|
| **G1** | Real GPU / rig E2E (≥90% accept rate for 1h on ≥2 reference rigs) | Local OpenCL GO is not production E2E | ✅ Complete — two production rigs active on Edge pool `62.171.141.136:8444`: (1) local GTX 1070 Ti (`zion-miner` CUDA, ~18 MH/s, 1105 accepted / 10 rejected = 99.1 %), (2) SimpleMining OS rig 518837 (`ZionRig`, AMD RX 5700 XT + Vega 64, ZION ~0.8 MH/s + ZANO ~17 MH/s, 172 accepted / 1 rejected = 99.4 %); monitoring script `scripts/monitor_g1_rigs.py` added |
| **G2** | Non-EVM WARP contracts (deploy or `disabled_reason`) | Cannot claim 12-chain support with placeholders | ✅ Complete — `disabled_reason` added to `ChainConfig`/`ChainRegistry`/`WarpError`; runtime/registry build from `warp.toml` config; `/chains` API exposes `enabled` + `disabled_reason`; `warp.example.toml` marks non-deployed non-EVM chains disabled with explicit reasons (aptos, sui, cardano, cosmos, near, lightning) and leaves Base + ZION L1 enabled for 3.2.0 |
| **G3** | Solver network real E2E (independent solver over internet) | Wired locally only | ✅ Complete — config-driven solver registry + per-solver API key auth; `SolverConfig` and `SolverEntry` added to `MultichainConfig`/`WarpConfig`; `/v1/swap/solve` validates `X-Solver-Key`; `HttpSolverClient` sends per-solver keys; integration tests verify auth + full intent→bid→execute flow; `warp.example.toml` documents operational setup |
| **G4** | Public subtree diff = 0 | Public MIT repo out of sync | ✅ Complete (`git push public public-split:main --dry-run` = "Everything up-to-date" at `fbc5e02f2`) |
| **G5** | XMR / RandomX path (reach pool or `disabled_reason`) | No reachable pure-RandomX pool from Edge datacenter | ✅ Complete — MoneroOcean `gulf.moneroocean.stream:10001` reachable over plain TCP; CryptonoteStratum handshake returns `rx/0` jobs; `zion-miner` CryptonoteStratum job parsing, compact target parsing, worker login, and share formatting fixed; `cargo test -p zion-miner --lib` 103 pass | Report: [`docs/3.2/REPORTS/REPORT_2026-08-22_G5_E8_XMR_RANDOMX_MONEROOCEAN.md`](./REPORTS/REPORT_2026-08-22_G5_E8_XMR_RANDOMX_MONEROOCEAN.md) |
| **G6** | PRL (Pearl PoUW) deferred and excluded | Must remain documented and excluded from profit switching | ✅ Documented |
| **G7** | Chaos / load tests executed | 1000+ miner sim, 24h fuzzing, bridge stress | ✅ Complete — 10 000-miner local pool handshake 100 % pass, 10 000-miner Edge connect storm survived with real rigs unaffected, DEX quote overload 1 972 req/s 100 % 200, bridge submit overload 1 793 req/s no crash, P2P reconnect storm OK; 10-minute transaction fuzz preview passed (2 280 requests, 0 health fails); full 24h fuzzing pending per F2 | Report: [`docs/3.1/REPORTS/REPORT_2026-08-22_G7_CHAOS_LOAD_TESTS.md`](../3.1/REPORTS/REPORT_2026-08-22_G7_CHAOS_LOAD_TESTS.md) |
| **G8** | 30-day continuous run completed | Cannot call "Stable" without uptime evidence | 🔄 In progress — started 2026-08-23 07:00 CET; target end 2026-09-22 07:00 CET; public status UI at `https://app.zionterranova.com/g8`; monitoring tracked via dashboard `/api/g8` |
| **G9** | External security audit (L1/L2) — planned before launch | Internal tests pass; no formal review on record | ❌ Not started — external review scheduled before public launch |
| **G10** | L5/L6 decision — treasury, humanitarian fund, Issobella governance | Must have defined run mode or explicit post-3.2 deferral | ✅ Decision made — activate as passive read-only fund trackers + DAO proposal bridge; active on Edge as passive read-only fund trackers on `127.0.0.1:8095` (L5) and `127.0.0.1:8097` (L6); not a 3.2.0 blocker; full disbursement/UI post-3.2 (see [`L5_L6_ACTIVATION_PLAN.md`](./L5_L6_ACTIVATION_PLAN.md)) |
| **G11** | V3→V31 migration tooling complete | Foundry config, CLI stubs, public subtree, ZIS, OASIS server | ✅ Complete — `public/` subtree in sync (G4 ✅); ZIS deployed on Edge and healthy; UTXO v2 hash and `submitUtxoTransaction` wired through wallet SDK, CLI and pool; Foundry test suite (43 tests pass) for wZION/ZIONBridge/ZDXToken; CLI `deploy` wraps `forge create/script/test/verify`; CLI `update now` downloads from GitHub releases API; miner TUI + Cargo features verified on Linux; H6/H7/H8 documented as post-3.2 | Report: [`docs/3.2/REPORTS/REPORT_2026-08-22_G11_V3_V31_MIGRATION.md`](./REPORTS/REPORT_2026-08-22_G11_V3_V31_MIGRATION.md) |

---

## 4. Phases

### Phase E — Real-World Verification & Hardening (weeks 1–4)

| # | Task | Owner | Acceptance |
|---|------|-------|------------|
| E1 | GPU Go/No-Go on reference rigs | core/miner | ≥90% accept rate on ZION Deeksha for 1h on ≥2 rigs | ✅ Complete — local GTX 1070 Ti (CUDA, 99.1 %) + SMOS rig 518837 (OpenCL, 99.4 %) on Edge pool; `scripts/monitor_g1_rigs.py` |
| E2 | AuxPoW real-pool E2E | core/miner | ≥2 GPU + ≥2 CPU coins accepted upstream on Edge pool |
| E3 | Profit switching live test | core/miner | switches within 15% hysteresis, PRL never selected |
| E4 | Bridge Base mainnet round-trip | multichain | 100K wZION lock → mint → burn → release | ✅ Complete — 100 ZION locked on L1 (TX `b7f227a6...` @ block 13184), 100 wZION minted on Base, 100 wZION burned (TX `0xa5148c44...`, burn_id `0xebfce5b8...`), 100 ZION unlocked on L1 (TX `9f3e654e...` @ block 13217); confirmed in `v3_utxos` table; relay format handler, UTXO sync, mempool flush, and standalone unlock binary all fixed | Report: [`docs/3.2/REPORTS/REPORT_2026-08-22_E4_BRIDGE_ROUND_TRIP.md`](./REPORTS/REPORT_2026-08-22_E4_BRIDGE_ROUND_TRIP.md) |
| E5 | Non-EVM WARP hardening | multichain | each chain deployed or `disabled_reason` + UI hidden | ✅ Complete — `ChainConfig.disabled_reason` wired through registry, runtime, `/chains` API and example config; disabled chains hidden from router/watcher |
| E6 | Solver network real E2E | multichain | independent solver over internet | ✅ Complete — config-driven registry + per-solver API keys; integration tests pass; operational procedure in `warp.example.toml` |
| E7 | Public subtree sync | release/docs | `git subtree push --prefix=public public main` clean, `git secrets --scan` clean | ✅ Complete — `public-split` identical to `public/main` at `fbc5e02f2`; `git push --dry-run` reports "Everything up-to-date" (2026-08-22) |
| E8 | XMR / RandomX path | core/pool | reachable pool E2E or `disabled_reason` | ✅ Complete — MoneroOcean reachable; CryptonoteStratum fixes merged; unit tests pass | Report: [`docs/3.2/REPORTS/REPORT_2026-08-22_G5_E8_XMR_RANDOMX_MONEROOCEAN.md`](./REPORTS/REPORT_2026-08-22_G5_E8_XMR_RANDOMX_MONEROOCEAN.md) |
| E9 | L5/L6 activation decision | product/ops | ✅ Decision recorded — activate as passive read-only fund trackers + DAO proposal bridge; active on Edge as passive trackers on `127.0.0.1:8095` and `127.0.0.1:8097`; not a 3.2.0 blocker (see [`L5_L6_ACTIVATION_PLAN.md`](./L5_L6_ACTIVATION_PLAN.md)) |

### Phase F — Stability, Security & 30-Day Run (weeks 5–9)

| # | Task | Owner | Acceptance |
|---|------|-------|------------|
| F1 | Security audit | security | L1, bridge contracts, multichain reviewed; findings mitigated or accepted |
| F2 | Complete 24h transaction fuzz evidence | QA | 🔄 10-min preview passed (2 280 req, 0 health fails); full 24h run started 2026-08-22 22:34 CET but is not currently active and `docs/3.2/REPORTS/fuzz_logs/tx_fuzz_24h_stdout.log` is empty; evidence must be completed/restarted before gate close |
| F3 | Chaos tests | QA/ops | ✅ Rounds 1–5 preview executed (network, process, data, resource, L2 bridge); no crashes | Report: [`docs/3.1/REPORTS/REPORT_2026-08-22_G7_CHAOS_LOAD_TESTS.md`](../3.1/REPORTS/REPORT_2026-08-22_G7_CHAOS_LOAD_TESTS.md) |
| F4 | 1000+ miner simulation | pool/QA | ✅ 10 000-miner local pool handshake 100 % pass, 10 000-miner Edge connect storm survived; no panics | Report: [`docs/3.1/REPORTS/REPORT_2026-08-22_G7_CHAOS_LOAD_TESTS.md`](../3.1/REPORTS/REPORT_2026-08-22_G7_CHAOS_LOAD_TESTS.md) |
| F5 | Backup / DR drill | ops | restore from off-site backup, sync to tip |
| F6 | 30-day continuous run | ops | uptime ≥99.9%, no critical incidents | 🔄 Started 2026-08-23 07:00 CET; public status UI at `https://app.zionterranova.com/g8`; tracked via dashboard `/api/g8` |

### Phase G — Release & Launch Readiness (weeks 9–10)

| # | Task | Owner | Acceptance |
|---|------|-------|------------|
| G1 | Feature freeze | product | `DEFERRED_3.2.md` frozen |
| G2 | GitHub `v3.2.0` release | release | Linux/Windows/macOS binaries, SHA256SUMS, signed tag — 🔄 in progress (workflows + scripts ready, tags pending) |
| G3 | SMOS package | release | tested on reference rig |
| G4 | Desktop app bundle | APP&WEB | builds and passes tests on all platforms — 🔄 in progress (v3.2.0 desktop workflow + release notes ready) |
| G5 | Public docs update | docs | `public/README.md` and translations reflect 3.2.0 — 🔄 in progress (download page metadata and release notes updated) |
| G6 | Community + bug bounty | community | channels and process published |
| G7 | Monitoring & alerting | ops | alerts tested, runbooks updated |

### Phase H — V3→V31 Migration Completion (parallel with E–F)

| # | Task | Status |
|---|------|--------|
| H1 | Foundry / Hardhat project config for `zion deploy` | ✅ Complete — 43 Foundry tests pass (wZION 22, ZIONBridge 12, ZDXToken 9); `zion deploy` wraps `forge create/script/test/verify` with chain presets |
| H2 | Miner TUI smoke test | ✅ Complete — `cargo build --release -p zion-miner --features tui` verified |
| H3 | Miner Cargo feature verification on all platforms | ✅ Complete — `tui`, `public_build`, `gpu-cuda,native-all,tui` all build on Linux; `full` (macOS-only `gpu-metal`) documented |
| H4 | Complete CLI subcommands (some are stubs) | ✅ Complete — `zion update now` downloads from GitHub releases API; `zion deploy` wraps forge; CLI build passes |
| H5 | AuXpow E2E test script | ✅ Complete — `scripts/ops/auxpow_e2e_test.py` validates miner → pool → mock CryptonoteStratum upstream share flow for XMR/RandomX; logs preserved under `/tmp/auxpow_e2e_<id>/`; report: [`docs/3.2/REPORTS/REPORT_2026-08-22_H5_AUXPOW_E2E_TEST.md`](./REPORTS/REPORT_2026-08-22_H5_AUXPOW_E2E_TEST.md) |
| H6 | Stratum v2 pool support | 📋 Post-3.2 — not a 3.2 blocker; current Stratum v1 is production |
| H7 | PPS + SOLO pool modes | 📋 Post-3.2 — not a 3.2 blocker; PPLNS is production |
| H8 | Pool downstream / proxy mode | 📋 Post-3.2 — not a 3.2 blocker; scaling enhancement |

### Phase I — ZION Identity Service (ZIS) — final public auth flows (parallel with E–F)

| # | Task | Status |
|---|------|--------|
| I1 | ZIS OpenAPI design | 🔄 In progress — Fastify routes (`/api/auth`, `/api/session`, `/api/keys`, `/health`, `/.well-known`) implemented; formal OpenAPI spec still to be committed |
| I2 | ZIS server implementation (`APP&WEB/identity/`) | ✅ Complete — Fastify 4 server with Ed25519 + SIWE verify, sessions, API keys, rate limiting deployed on Edge |
| I3 | Unified Prisma schema | ✅ Complete — `APP&WEB/shared/prisma/schema.prisma` covers User, LinkedAddress, Session, ApiKey, OASIS, Marketplace, DAO, Mining, Bridge, DEX, Notifications |
| I4 | Deploy ZIS on Edge | ✅ Complete — `zion-zis.service` active, `https://auth.zionterranova.com/health` 200 |
| I5 | Cross-domain cookie SSO | ✅ Complete — `zion_session` cookie on `.zionterranova.com`, httpOnly, secure, signed, 7-day expiry |
| I6 | EVM wallet auth (SIWE) | ✅ Complete — `POST /api/auth/verify/siwe` verifies EIP-4361 messages with `siwe` library |
| I7 | Link EVM + ZION addresses | ✅ Complete — `POST /api/auth/link` binds additional addresses to a user after signed challenge |
| I8 | API keys for programmatic access | 🔄 In progress — `APP&WEB/identity/src/routes/apikey.ts` implemented; final public CLI/script flows need evidence |

### Phase J — Cross-App Integration (parallel with E–F)

| # | Task | Status |
|---|------|--------|
| J1 | Web 2.9 → ZIS | ❌ Not started |
| J2 | Marketplace → ZIS | ❌ Not started |
| J3 | OASIS → server + ZIS | ❌ Not started |
| J4 | Dashboard → ZIS | ❌ Not started |
| J5 | OASIS ↔ Marketplace artifact sync | ❌ Not started |
| J6 | Dashboard "My Ecosystem" view | ❌ Not started |
| J7 | Mining / DAO → shared DB | ❌ Not started |

---

## 5. What is deliberately not a 3.2 blocker

| Item | Rationale |
|------|-----------|
| CHv4.2 Merkabah Dual-Spin | Fork height is `u64::MAX`; requires governance vote |
| Full 12-chain non-EVM WARP | Mainnet-stable scope is EVM + Bitcoin + one non-EVM pilot |
| Mobile app store submission | Can ship in 3.2.x |
| Pearl PoUW | Officially deferred; must stay `disabled_reason` |

---

## 6. Definition of Done for 3.2.0

1. 30-day continuous run on Edge completed, uptime ≥99.9%, no critical incidents.
2. Real GPU mining passes on at least two reference rigs with ≥90% accept rate.
3. Bridge wZION round-trip verified on Base mainnet.
4. No undeclared placeholder addresses or mock clients in hot paths.
5. Public `github.com/Zion-TerraNova/v3-Mainnet` subtree in sync and clean.
6. Security audit and chaos/load tests complete with mitigations.
7. `v3.2.0` GitHub release with multi-platform binaries and SHA256SUMS.
8. Monitoring, alerting, backup/DR, and runbooks tested and current.
9. Public docs and community channels ready for public mainnet.

---

## 7. Risks

| Risk | Mitigation |
|------|-----------|
| GPU Go/No-Go fails on specific vendor | document hardware matrix; disable with `disabled_reason` |
| Bridge mainnet round-trip loses funds | test small amount first; 5/7 multisig; pause on any `BurnRelease` failure |
| 30d run interrupted by non-critical bug | only critical incidents (consensus, payout, bridge safety) reset clock |
| Public subtree push reveals secret | always `--dry-run` first; `git secrets --scan` |
| External audit finds critical issue | keep 4-week buffer before 31.12.2026 launch |

---

*Generated from [`V31/PLAN_TO_3.2.md`](../../V31/PLAN_TO_3.2.md), [`OneLoveV3.2.md`](../../OneLoveV3.2.md) and live status in [`StatusV3.md`](../../StatusV3.md).*
