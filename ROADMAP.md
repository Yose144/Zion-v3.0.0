# ZION Roadmap — From 3.0.5 to Public Mainnet Launch

> **⚠️ This roadmap is historical / V3-centric. The active 3.2 "One Love" / Mainnet Stable execution plan is [`V31/PLAN_TO_3.2.md`](./V31/PLAN_TO_3.2.md). Previous plan: [`PLAN_TO_3.1_RECONCILED.md`](./docs/3.1/PLAN_TO_3.1_RECONCILED.md). Live status is in [`StatusV3.md`](./StatusV3.md). The current development workspace is `V31/`.**

> **Version:** 3.0.7 "Trinity All Green" (archived) / 3.1.0-beta V31 Mainnet Alpha (LIVE on Edge, protocol 3.1.0-alpha) / 3.2.0 "One Love" (Mainnet Stable) in progress  
> **Last updated:** 2026-08-07
> **One source of truth:** [`V31/PLAN_TO_3.2.md`](./V31/PLAN_TO_3.2.md) · Previous: [`PLAN_TO_3.1_RECONCILED.md`](./docs/3.1/PLAN_TO_3.1_RECONCILED.md) · Live status: [`StatusV3.md`](./StatusV3.md) · V31 rules: [`V31/AGENTS.md`](./V31/AGENTS.md)  
> **Engineering detail:** [`V3/ROADMAP.md`](./archive/V3/ROADMAP.md) (archived)

---

## 0. How to read this roadmap

This is the **forward-looking** root roadmap. Historical detail lives in [`docs/3.0.3/`](./docs/3.0.3/).

| If you want... | Read... |
|----------------|---------|
| Complete 3.0.4 state | [`3.0.4.md`](./docs/3.0.4/3.0.4.md) |
| Live status + blockers | [`StatusV3.md`](./StatusV3.md) |
| Engineering tasks per layer | [`archive/V3/ROADMAP.md`](./archive/V3/ROADMAP.md) |
| Start scripts | [`archive/ZionStart/README.md`](./archive/ZionStart/README.md) |
| Agent rules | [`AGENTS.md`](./AGENTS.md) |
| Historical context | [`docs/3.0.3/README.md`](./docs/3.0.3/README.md) |

---

## 0.5 Next Milestones — 3.0.7 → 3.1.0

The project is now driving toward **Mainnet Alpha (3.1.0)** in three planned steps:

| Version | Name | Goal | Plan |
|---------|------|------|------|
| **3.0.7** | Trinity All Green | Every active mining stream has verified accepted shares | [`TRINITY_ALL_GREEN_PLAN.md`](docs/3.0.7/TRINITY_ALL_GREEN_PLAN.md) / [`3.0.7.md`](docs/3.0.7/3.0.7.md) |
| **3.0.8** | Full Stack Stable | All active components work; no placeholders in hot paths | [`3.0.8.md`](./docs/3.0.6/3.0.8.md) |
| **3.0.9** | Pre-Alpha Hardening | Security audit, chaos tests, repo purification, public sync | [`3.0.9.md`](./docs/3.0.6/3.0.9.md) |
| **3.1.0** | Mainnet Alpha | Clean repo, feature freeze, release ready | [`3.1.0.md`](./docs/3.0.6/3.1.0.md) |

Overall coordination: [`MAINNET_ALPHA_PLAN.md`](./docs/3.0.6/MAINNET_ALPHA_PLAN.md).  
**V3.1 migration (post-3.0.9):** [`V3.1_MIGRATION_PLAN.md`](./docs/3.0.6/V3.1_MIGRATION_PLAN.md) — migrate clean code into a new `V31/` directory. WARP → L2, ZionDex → L2, AuxPoW → miner, L3 → AI/orchestration/automation/NCL/PoC; L4 Oasis / L5 Free World / L6 Issobella stay as superstructures. Native integration seams: [`V3.1_INTEGRATION_PLAN.md`](./docs/3.0.6/V3.1_INTEGRATION_PLAN.md).

---

## 1. Current State — 3.0.7 "Trinity All Green" (2026-07-27)

✅ **3.0.7 "Trinity All Green" Done (2026-07-27)**
- Protocol version bumped to `zion-v3-node/3.0.7` (`V3/L1/core/src/lib.rs`)
- Workspace version bumped to `3.0.7` (`Cargo.toml`, `V3/Cargo.toml`)
- Miner UI / pool JSON / CLI update version strings bumped to 3.0.7
- DAO integration test fix (`VoteChoice` clone in `V3/L2/dao/tests/integration.rs`)
- All Green matrix verified: ZION Deeksha, EPIC/RVN/DCR/ERG/VTC/ZCL/RTM/QTC/NEXA/BEAM/QUAI GPU streams, VRSC/RTM CPU streams — accepted shares on upstream pools
- ETC Ethash CPU reference aligned with `ethash` 0.4 crate and CUDA kernel (`ETHASH_CPU_GPU_MATCH`)
- XMR RandomX hash verify OK (native-randomx), stale job_id propagation fix pending
- Pearl (PRL) officially deferred to 3.1.0
- Chain height 7101+ on Edge, 14/15 services active

✅ **3.0.5 Done (2026-07-09)**
- Protocol version bumped to `zion-v3-node/3.0.5` (from stale 3.0.3)
- All core services active on live server (62.171.141.136): node, node2, pool, bridge, dao, atomic-swap, warp, ziondex, oasis, rtm-debug-pool, dashboard, nginx, web
- Watchdog timer active (2 min interval)
- Web (Docker zion-web) Up — zionterranova.com: 200
- E2E memo tests: 3 account-model TXs with memos confirmed in block 752 (BRIDGE/DAO/SWAP)
- L2/L3 config fixes: bridge start height 0, backup RPC IP, DB paths unified to /data/zion/
- Docs reconciled: fake commit hash fixed, activation height 0, old IPs replaced
- **Web deploy optimalizace:** Docker image 2.57 GB → 377 MB (85% redukce) via standalone output + cache fix + build cache prune (23 GB freed)
- **Health check 2026-07-23:** Chain height 2584+, ~16.69B ZION circulating, 14/15 monitored services active (free-world, issobella disabled), RAM ~2.7G/7.8G, disk 66G/145G
- Report: [`docs/3.0.5/REPORT_3.0.5_ALL_GREEN_CZ.md`](./docs/3.0.5/REPORT_3.0.5_ALL_GREEN_CZ.md)

✅ **3.0.6 "Triple Parallel" Done (2026-07-15)**
- **Claymore-style triple parallel mining LIVE:** ZION (GPU DeekshaChv3) + EPIC (GPU ProgPow) + VRSC (CPU VerusHash) simultaneously
- Second AuxPow bridge (`cpu_auxpow_bridge`) for CPU-only coins — connects to LuckPool (VRSC)
- `external_stream_cpu` field in `PoolMessage::Job` — miners receive both GPU + CPU external streams
- OpenMP-parallel DAG generation (19 threads, epoch 120 ~2GB in ~4 min)
- `native-hashers` feature enabled in miner build — `DagManager` + `generate_ethash_dag()` active
- Share routing: VRSC → `cpu_auxpow_bridge.forward()`, EPIC → `auxpow_bridge.forward()`
- Verified live: 99.7% ZION accept rate, EPIC ProgPow 7169+ batches, VRSC CPU VerusHash 4 threads
- **BeamHash III implemented:** SipHash-2-4 + Equihash 144,5 CPU hasher (`beamhash.rs`, 13 tests) + OpenCL kernel (`beamhash_kernel.cl`) + GPU dispatch wired
- **8 new no-DAG GPU-mineable coins OpenCL kernels (2026-07-16):**
  - IRON (FishHash) — `fishhash_kernel.cl` (532 lines), DAG-based, fully integrated
  - KLS (KarlsenHashV2) — `karlsenhash_kernel.cl` (608 lines), FishHashPlus+Blake3, fully integrated
  - NEXA (NexaPow) — `nexapow_kernel.cl` (6164 lines), secp256k1 Schnorr from UltrafastSecp256k1 (MIT), fully integrated
  - VTC (Verthash) — `verthash_kernel.cl` (289 lines) + SHA3 kernels, kernel ready, host-side 1.2GB data file loader TODO
  - ZCL (Equihash 192,7) — `equihash_kernel.cl` (851 lines) from silentarmy, kernel ready, multi-kernel Wagner dispatch TODO
  - RTM (GhostRider) — placeholder, 15 algos + 6 CN variants (~72K lines to port)
  - QTC (Qhash) — placeholder, quantum circuit simulation (cuQuantum is CUDA-only)
  - DNX (DynexSolve) — placeholder, neuromorphic PoUW (CUDA-only reference)
  - 24 total external coins, 173/173 AuXpow tests pass, 3 commits (`f6df75b64`, `646d14f59`, `77613ad50`)
- **EvrProgPow/MeowPow correct params:** PERIOD=3 (EVR), PERIOD=6+REGS=16+CNT_MATH=9 (MEWC) — no longer using KawPow fallback
- **GPU benchmark (M1 Metal):** blake3 24.7 GH/s, kheavyhash 22.2 GH/s, autolykos 23.7 GH/s, zelhash 23.8 GH/s, pearl 25.2 GH/s
- **E2E Edge audit:** Pool embeds EPIC+VRSC streams ✓, but miners not submitting external shares (old binary) — deploy fix needed
- **Tests:** 159 AuXpow + 38 miner + 38 pool + 562 core = 797 direct crate tests
- Plan: [`docs/3.0.6/AuxPowTriplePlan.md`](./docs/3.0.6/AuxPowTriplePlan.md) §11 Live Verification
- Next milestone: [`TRINITY_ALL_GREEN_PLAN.md`](docs/3.0.7/TRINITY_ALL_GREEN_PLAN.md)

✅ **Done (3.0.4 and earlier)**
- DeFi contracts deployed on Base Mainnet: ZIONGovernance, ZIONTreasury, ZIONStaking, ZIONFarm
- 5/5 validator bridge operational, ~100M wZION minted, reverse bridge E2E verified
- Atomic swap daemon live, escrow funded, LOCK/CLAIM E2E passed
- Multi-chain wZION on 6 EVM chains (Base, BSC, Polygon, Arbitrum, Optimism, Avalanche)
- LI.FI WidgetLight integrated on `/defi` page
- WARP D-04 complete: 12 chain adapters registered, 499 tests pass, pure-Rust encoders (BCS, CBOR, TL-B)
- Lightning Network bridge code complete (BOLT11 + LND REST client)
- Native ZION naming convention established: wZION on EVM, ZION on non-EVM
- 3.0.3 decimal fork deployed, RPC scale normalization active
- Documentation canonicalized: `docs/3.0.4/3.0.4.md` is the single source of truth for the release
- Root cleaned: `docs/3.0.3/`, `ZionStart/`, `scripts/audit/`, `scripts/ops/`, `V3/docker/`

✅ **Resolved in 3.0.4**
- Account-model TX memo field added (L1 hard fork); L2 watchers (bridge, DAO, atomic-swap) now scan `account_transactions` with memo.

✅ **Security hardening (2026-07-02)** — viz [`SecurityFirst.md`](./docs/3.0.4/SecurityFirst.md) · [`F5_SECURITY_INCIDENT_REPORT_2026-07-02.md`](./docs/3.0.4/F5_SECURITY_INCIDENT_REPORT_2026-07-02.md)
- F1 exploit fix: `validate_peer_block` now calls `verify_signature()` for non-coinbase account TX (commit `9341344d`)
- **F5 CRITICAL fix: Account-model sender balance validation** — `insert_transaction()` and `validate_peer_block()` now reject TX where `sender_balance < amount + fee`. Height-gated via `ZION_BALANCE_CHECK_HEIGHT=22394` on Edge mainnet. Commits `69d12c7`, `fe8d449`, `9863747`.
- **Escrow key rotation:** New escrow keypair generated, `edge-environment.sh` updated, atomic-swap restarted. Inflationary 100,002 ZION burned to unspendable address.
- UFW hardened: only SSH/HTTP/HTTPS/Tailscale, Docker monitoring ports explicit deny
- Private keys scrubbed from 5 files, file permissions 600, SSH keys-only
- 13/18 services on 127.0.0.1, dashboard on Tailscale IP
- AppArmor profile for zion-node (enforce mode)
- 3 monitoring cron jobs (forged TX, balance, P2P peer alert)
- RPC audit log code change (pending rebuild)
- Tailscale ACL documentation (pending admin console apply)

⚠️ **Pending security tasks**
- F2.3: Tailscale ACL — apply via admin console (doc ready in docs/3.0.4/SecurityFirst.md)
- F2.6: systemd `User=zion` — test on one service first
- F4.x: Key rotation (premine, pool, bridge, EVM) — air-gapped operation
- Rebuild: bridge metrics (9101), DAO (8450) — env var code changes pending
- Max TX amount cap (100M ZION) — L1 consensus change, needs spec + audit
- **F5: Deploy to zion-edge-node2** (follower node needs same binary + env var)
- **F5: Fuzzing** — submit random TXs from random addresses to verify rejection
- **F5: Pre-existing test failures** — 10 tests fail unrelated to F5 (port conflicts), investigate separately
- **Long-term: UTXO-backed account model** (3.1.0+) to eliminate account-model balance bugs

⚠️ **Known limitations**
- Bridge contract addresses have a 3-way inconsistency across config/docs that needs owner decision
- ~66.47M wZION locked in a Uniswap CCA auction with an immutable 184-day end block (intended 30 days)

---

## 2. Owner Decision Matrix — choose before we proceed

These block all or part of the engineering work below.

| # | Decision | Context | Where documented |
|---|----------|---------|------------------|
| D1 | **Bridge addresses** | Which contract is live on each non-Base chain? `bridge-mainnet.toml` points to revoked `0xa5a09b2...`; `V3/docs/BRIDGE_MAINNET_DEPLOY.md` shows a newer 5/5 bridge. | [`3.0.4.md`](./docs/3.0.4/3.0.4.md) §5, [`docs/3.0.3/CODE_VS_DOCS_AUDIT.md`](./docs/3.0.3/CODE_VS_DOCS_AUDIT.md) H1 |
| D2 | **TX unification activation** | ✅ Approved + implemented — `memo` field added, height-gated activation, watchers updated. Deploy/E2E pending. | [`3.0.4.md`](./docs/3.0.4/3.0.4.md) §3.5 |
| D3 | **ETH budget for liquidity** | Need ≥0.80 ETH to seed wZION/WETH pool at target $0.00002/ZION. | [`docs/3.0.3/LIQUIDITY_PLAN.md`](./docs/3.0.3/LIQUIDITY_PLAN.md) |
| D4 | **CCA auction** | 66.47M wZION locked until block 55,959,126 (~184 days). Immutable contract. Wait it out or run a new auction? | [`docs/3.0.3/AUCTION_CCA_BASE.md`](./docs/3.0.3/AUCTION_CCA_BASE.md) |
| D5 | **Repo cleanup Phase 1+2** | Approve deleting `V3/config/` stale templates and creating `V3/L1/types` crate for shared watcher types. | [`3.0.4.md`](./docs/3.0.4/3.0.4.md) §12 |

---

## 3. Phase 1 — 3.0.4 Closure (Q3 2026)

Goal: resolve all owner blockers and operational gaps so the chain is fully consistent.

### 3.1 L1 / Consensus

| # | Task | Status | Detail |
|---|------|--------|--------|
| 1.1 | **TX unification (L1 hard fork)** | ✅ Implemented | Add `memo` to account-model `Transaction`, height-gated activation, extend 3 L2 watchers to scan `account_transactions`. See [`3.0.4.md`](./docs/3.0.4/3.0.4.md) §3. |
| 1.2 | **DAO_TREASURY_LOCK_HEIGHT guard** | ✅ Done | Confirmed `144_000` in code; docs updated. |
| 1.3 | **Migration height guard** | ✅ Done | Already implemented in `node.rs` (lines 114-131): fatal error on production with existing state, warning on fresh chain. |

### 3.2 L2 / DeFi

| # | Task | Status | Detail |
|---|------|--------|--------|
| 2.1 | **Resolve bridge addresses** | ✅ Done | All bridge configs synced to on-chain state (Basescan verified 2026-07-10). Base=0x72c8f0Dc..., non-Base=0xa5a09b2C..., 0x89504D6e... is stale. Validators: 0xdde17506..., 0x24d98684..., 0x665c55eD..., 0x8E644b3E..., 0x7e0D2eD7... |
| 2.2 | **Basescan verification** | ✅ Done | **7/7 contracts verified** (wZION, ZIONAtomicSwap already verified; ZIONGovernance, ZIONTreasury, ZIONStaking, ZIONFarm verified 2026-07-02; ZIONBridge verified 2026-07-09 via `forge verify-contract`). |
| 2.3 | **Validator ETH top-up** | ✅ Done | All 5 on-chain validators have ETH. Gas on Base is 0.006 Gwei. **16.67M wZION minted successfully** (2026-07-10) after fixing: wrong validator keys, L1 block gap, case-sensitive DB status, recipient mismatch. TX: `0xb98bba3216...` |
| 2.4 | **Atomic swap escrow fees** | ✅ Done | 10 ZION sent from pool wallet to escrow `zion1y0j484d5e8r49785d253e8w0c2x4t3n792m5724` (TXID `03a1e060...`, confirmed block 1377). |
| 2.5 | **ZIONStaking / ZIONFarm UI verify** | ✅ Done | Deployed; verify live data on website. |
| 2.6 | **More DEX liquidity** | 🔵 Pending | Seed wZION/WETH (needs D3) and/or wZION/USDC. |
| 2.7 | **Blockaid false-positive report** | ✅ Done | Report prepared at `docs/3.0.4/BLOCKAID_FALSE_POSITIVE_REPORT.md`. Submit at `report.blockaid.io`. |

### 3.3 L3 / WARP

| # | Task | Status | Detail |
|---|------|--------|--------|
| 3.1 | **Deploy non-EVM contracts** | 🟡 In Progress | All 9 contract source files created in `V3/L2/bridge/contracts/non-evm/`: Solana (SPL Anchor), Tron (TRC-20), Stellar (native asset), Cardano (Plutus), Cosmos (CosmWasm CW20), Aptos (Move Coin), Sui (Move Coin), NEAR (NEP-141), TON (TEP-74 jetton). All implement bridgeMint/bridgeBurn with 5/5 quorum. 9 WARP adapters updated with contract references. Pending: deploy to mainnet (relay keys + chain-specific deploy). |
| 3.2 | **Set relay keys on Edge** | 🔵 Pending | `WARP_<CHAIN>_RELAY_KEY` env vars for each non-EVM chain. |
| 3.3 | **TON execute_mint fix** | ✅ Done | Full TX construction implemented via custom TL-B cell serialization (`ton_cell.rs`) + Ed25519 signing + BOC encoding + TON Center `sendBase64Transaction`. No external `ton-sdk`/`tonweb`/`tonlib` dependency needed. 60/60 tests pass. |
| 3.4 | **Lightning Fáze A** | 🟡 In Progress | Docker setup created: `V3/L3/warp/docker/lightning/` (bitcoind testnet + LND + Redis). LND config: REST 8080, gRPC 10009, keysend enabled. Channel management scripts at `V3/L3/warp/scripts/lightning/`. `lightning.rs` adapter updated with Docker-aware error messages + enhanced health_check (LND connectivity, channel balance, on-chain balance). systemd service at `edge-deploy/systemd/zion-edge-lnd.service`. Pending: deploy to Edge, sync testnet, open channels, extract macaroon, configure WARP env vars. |
| 3.5 | **WARP UI activation** | ✅ Done | `/warp` transfer form live; activate multi-chain as contracts deploy. |

### 3.4 Infrastructure / Repo

| # | Task | Status | Detail |
|---|------|--------|--------|
| 4.1 | **Guardian mnemonic backup** | 🔵 Pending | Copy `C:\Users\yosef\Desktop\ZION_DAO_GUARDIAN_KEYS.txt` to flash drive `F:\`. |
| 4.2 | **Repo cleanup Fáze 1** | ✅ Done | `V3/config/` deleted; bridge config canonical path is `V3/L2/bridge/config/`; Edge env updated + bridge restarted. |
| 4.3 | **Repo cleanup Fáze 2** | ✅ Done | `V3/L1/types` crate created (`zion-l1-types`); bridge/dao/atomic-swap refactored to use shared `bytes_to_hex`, `normalize_rpc_addr`, `zion_address_from_public_key`. All 171+ tests pass. |
| 4.4 | **Edge pool systemd** | ✅ Done | `zion-pool.service` active (enabled, running) on Edge. No orphaned manual pool. GPU miner `vega-smos` connected. |
| 4.5 | **CI/CD** | 🔵 Planned | GitHub Actions billing + automated builds. |
| 4.6 | **systemd User=zion** | ✅ Done | All 11/11 services running as `User=zion` (was root). Config in `/etc/zion/`, dashboard in `/opt/zion-dashboard/`. |
| 4.7 | **AppArmor for zion-node** | ✅ Done | Profile loaded in complain mode. Covers binary, config, state, network, SSL. Deny rules for `/home/`, `/root/`, `/etc/shadow`. |
| 4.8 | **Stale IP cleanup** | ✅ Done | 69 files updated: `77.42.71.94` + `100.76.16.108` → `62.171.141.136` (commit `8d55287f9`). |
| 4.9 | **Key rotation F4.x** | ✅ Done | Owner air-gapped. Pool payout SK, escrow SK applied. EVM/guardian SKs on flash drive. |

---

## 4. Phase 2 — 3.1.0 Pre-Mainnet (Q4 2026)

Goal: ship the user-facing stack (wallet, mobile, explorer, L4) before public launch.

| # | Initiative | Status | Detail |
|---|------------|--------|--------|
| 5.1 | **Wallet SDK** (`@zion/sdk`) | ✅ Memo support added | TypeScript SDK with memo support, tx signing, balance/history. Base for mobile + web. |
| 5.2 | **TX history RPC** | ✅ Done | `getTransactionHistory` RPC implemented with O(1) in-memory `address_tx_index` (HashMap<address, Vec<block_idx>>). Covers account-model TXs, UTXO TXs (sender/recipient), and coinbase rewards. Pagination (offset/limit, cap 1000). 3/3 tests pass. |
| 5.3 | **Mobile app** | 🔵 Planned | QR, biometrics, deep linking, EAS build, device testing, store submission. |
| 5.4 | **L4 OASIS backend** | 🔵 Planned | Guild wars, raid boss, OASIS token bridge, wallet signature auth. |
| 5.5 | **Desktop agent** | 🔵 Planned | Unify wallet core with mobile; Tauri v2 migration. |
| 5.6 | **Explorer bridge tracker** | 🔵 Planned | Live lock → confirm → mint UI. |
| 5.7 | **Security audit** | 🔵 Planned | External firm review of L1/L2/L3 contracts and node. |
| 5.8 | **CoinGecko / CMC listing** | 🔵 Planned | `docs/listings/` prep ready. |
| 5.9 | **RandomX / XMR CPU mining** | ✅ Done | Native RandomX via `tevador/RandomX` C++ library with JIT + hardware AES (ARMv8 Crypto), per-thread VM (lock-free), seed_hash epoch plumbing, `--randomx-bench` benchmark (1546 H/s M1, 387 H/s/thread). Build passes: miner + pool + auxpow. Pool E2E test TODO. See `RandomXReport.md`. |
| 5.10 | **VRSC LuckPool fix** | 🔵 Pending | Pool server rebuild + header hash mismatch debug (MMR root restoration, PBaaS v7+ solution encoding). See `VerusHashReport.md` §5.2, §7.1. |

---

## 5. Phase 3 — Public Mainnet Launch (31 December 2026)

Final checklist. Full procedure in [`docs/3.0.0/MAINNET_LAUNCH_SEQUENCE.md`](./docs/3.0.0/MAINNET_LAUNCH_SEQUENCE.md) if available, otherwise derive from `StatusV3.md`.

| # | Gate | Status |
|---|------|--------|
| 6.1 | TX unification deployed and stable | ✅ Account-model memo field deployed, E2E tested (block 752) |
| 6.2 | Bridge/wZION addresses consistent across all clients | ✅ wZION 0x0c49... on all 6 EVM chains |
| 6.3 | DeFi contracts verified + liquidity seeded | ✅ 7/7 verified on Basescan; Staking 100K + Farm 500K wZION funded; Bridge burn→unlock E2E confirmed (100 wZION→100 ZION block 891) |
| 6.4 | Wallet SDK + mobile app published | 🔵 |
| 6.5 | TX history RPC + explorer live | ✅ getTransactionHistory RPC live (O(1) address index) |
| 6.6 | L4 OASIS backend complete | 🔵 |
| 6.7 | External audit complete | 🔵 |
| 6.8 | 3 fresh mainnet nodes deployed, genesis hash consistent | 🔵 |
| 6.9 | Public mining opened | 🔵 |

---

## 6. Phase 4 — Post-Launch 2027+

| Initiative | Target | Detail |
|------------|--------|--------|
| **ZionDex** | Q4 2026 → Q3 2027 | ✅ **Live Beta** — Cross-chain DEX router powered by L3 WARP (port 8453). Router (Rust, 28 tests), AMM contracts (7 tests), SDK, web/mobile/desktop UI all built. Cross-chain AMM routing with Dijkstra path finding (aggregator.rs). Custom AMM deploy + intent-based execution pending. |
| **More EVM chains** | 2027 | Additional wZION deployments and bridge relays. |
| **Non-EVM expansion** | 2027 | ✅ Contract source files created for 9 chains (Solana, Tron, Stellar, Cardano, Cosmos, Aptos, Sui, NEAR, TON). Pending: mainnet deploy + relay keys. |
| **L5 Free World** | 2027–2028 | Genesis Garden, community blueprint, off-grid mesh. |
| **L6 Issobella** | 2030+ | Space station concept, funding via 5% fee split. |
| **Governance decentralization** | 2028–2030 | Move from Co-Admin to on-chain DAO. |
| **Hardware wallets** | 2028 | Ledger/Trezor integration. |
| **Privacy / quantum research** | 2028+ | zk-SNARK shielded txs, post-quantum signatures. |

---

## 7. Metrics

| Metric | Value |
|--------|-------|
| V31 workspace tests | `cargo test --workspace` pass (0 failures) |
| V3 workspace tests (archived) | ~2,066+ |
| WARP tests | 499 |
| Edge services | V31 primary node + pool + multichain + DAO + OASIS + web + marketplace + dashboard (V3 legacy masked) |
| Chain height | 1000+ (2026-08-09) |
| Protocol | `zion-v3-node/3.1.0-alpha` |
| Circulating supply | ~16.78B ZION |
| Web image size | 377 MB (was 2.57 GB) |
| Mainnet launch | 31 December 2026 |

---

*Generated from [`docs/3.0.3/`](./docs/3.0.3/) + [`3.0.4.md`](./docs/3.0.4/3.0.4.md) + [`archive/V3/ROADMAP.md`](./archive/V3/ROADMAP.md) + [`StatusV3.md`](./StatusV3.md) + [`PLAN_TO_3.1_RECONCILED.md`](./docs/3.1/PLAN_TO_3.1_RECONCILED.md).*
*V31 is the active mainnet track in [`V31/`](./V31/).*
