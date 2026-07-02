# ZION Roadmap — From 3.0.4 to Public Mainnet Launch

> **Version:** 3.0.4 canonical + security hardening  
> **Last updated:** 2026-07-02  
> **One source of truth:** [`3.0.4.md`](./3.0.4.md) · Live status: [`StatusV3.md`](./StatusV3.md) · Security: [`SecurityFirst.md`](./SecurityFirst.md)  
> **Engineering detail:** [`V3/ROADMAP.md`](./V3/ROADMAP.md)

---

## 0. How to read this roadmap

This is the **forward-looking** root roadmap. Historical detail lives in [`docs/3.0.3/`](./docs/3.0.3/).

| If you want... | Read... |
|----------------|---------|
| Complete 3.0.4 state | [`3.0.4.md`](./3.0.4.md) |
| Live status + blockers | [`StatusV3.md`](./StatusV3.md) |
| Engineering tasks per layer | [`V3/ROADMAP.md`](./V3/ROADMAP.md) |
| Start scripts | [`ZionStart/README.md`](./ZionStart/README.md) |
| Agent rules | [`AGENTS.md`](./AGENTS.md) |
| Historical context | [`docs/3.0.3/README.md`](./docs/3.0.3/README.md) |

---

## 1. Current State — 3.0.4 Canonical (2026-07-01)

✅ **Done**
- DeFi contracts deployed on Base Mainnet: ZIONGovernance, ZIONTreasury, ZIONStaking, ZIONFarm
- 5/5 validator bridge operational, ~100M wZION minted, reverse bridge E2E verified
- Atomic swap daemon live, escrow funded, LOCK/CLAIM E2E passed
- Multi-chain wZION on 6 EVM chains (Base, BSC, Polygon, Arbitrum, Optimism, Avalanche)
- LI.FI WidgetLight integrated on `/defi` page
- WARP D-04 complete: 12 chain adapters registered, 499 tests pass, pure-Rust encoders (BCS, CBOR, TL-B)
- Lightning Network bridge code complete (BOLT11 + LND REST client)
- Native ZION naming convention established: wZION on EVM, ZION on non-EVM
- 3.0.3 decimal fork deployed, RPC scale normalization active
- Documentation canonicalized: `3.0.4.md` is the single source of truth for the release
- Root cleaned: `docs/3.0.3/`, `ZionStart/`, `scripts/audit/`, `scripts/ops/`, `V3/docker/`

✅ **Resolved in 3.0.4**
- Account-model TX memo field added (L1 hard fork); L2 watchers (bridge, DAO, atomic-swap) now scan `account_transactions` with memo.

✅ **Security hardening (2026-07-02)** — viz [`SecurityFirst.md`](./SecurityFirst.md) · [`F5_SECURITY_INCIDENT_REPORT_2026-07-02.md`](./F5_SECURITY_INCIDENT_REPORT_2026-07-02.md)
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
- F2.3: Tailscale ACL — apply via admin console (doc ready in SecurityFirst.md)
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
| D1 | **Bridge addresses** | Which contract is live on each non-Base chain? `bridge-mainnet.toml` points to revoked `0xa5a09b2...`; `V3/docs/BRIDGE_MAINNET_DEPLOY.md` shows a newer 5/5 bridge. | [`3.0.4.md`](./3.0.4.md) §5, [`docs/3.0.3/CODE_VS_DOCS_AUDIT.md`](./docs/3.0.3/CODE_VS_DOCS_AUDIT.md) H1 |
| D2 | **TX unification activation** | ✅ Approved + implemented — `memo` field added, height-gated activation, watchers updated. Deploy/E2E pending. | [`3.0.4.md`](./3.0.4.md) §3.5 |
| D3 | **ETH budget for liquidity** | Need ≥0.80 ETH to seed wZION/WETH pool at target $0.00002/ZION. | [`docs/3.0.3/LIQUIDITY_PLAN.md`](./docs/3.0.3/LIQUIDITY_PLAN.md) |
| D4 | **CCA auction** | 66.47M wZION locked until block 55,959,126 (~184 days). Immutable contract. Wait it out or run a new auction? | [`docs/3.0.3/AUCTION_CCA_BASE.md`](./docs/3.0.3/AUCTION_CCA_BASE.md) |
| D5 | **Repo cleanup Phase 1+2** | Approve deleting `V3/config/` stale templates and creating `V3/L1/types` crate for shared watcher types. | [`3.0.4.md`](./3.0.4.md) §12 |

---

## 3. Phase 1 — 3.0.4 Closure (Q3 2026)

Goal: resolve all owner blockers and operational gaps so the chain is fully consistent.

### 3.1 L1 / Consensus

| # | Task | Status | Detail |
|---|------|--------|--------|
| 1.1 | **TX unification (L1 hard fork)** | ✅ Implemented | Add `memo` to account-model `Transaction`, height-gated activation, extend 3 L2 watchers to scan `account_transactions`. See [`3.0.4.md`](./3.0.4.md) §3. |
| 1.2 | **DAO_TREASURY_LOCK_HEIGHT guard** | ✅ Done | Confirmed `144_000` in code; docs updated. |
| 1.3 | **Migration height guard** | 🔵 Pending | Add fatal/warning if `ZION_MIGRATION_HEIGHT=0` outside dev/test. |

### 3.2 L2 / DeFi

| # | Task | Status | Detail |
|---|------|--------|--------|
| 2.1 | **Resolve bridge addresses** | 🔴 Blocked on D1 | Update `bridge-mainnet.toml`, mobile/desktop clients, website, docs to one consistent set per chain. |
| 2.2 | **Basescan verification** | ✅ Done | 6/7 contracts verified (wZION, ZIONAtomicSwap already verified; ZIONGovernance, ZIONTreasury, ZIONStaking, ZIONFarm verified 2026-07-02). ZIONBridge ❌ — source changed post-deploy, bytecode mismatch. |
| 2.3 | **Validator ETH top-up** | 🔵 Pending | Top up 5 validators to ≥0.01 ETH each (~0.05 ETH total). |
| 2.4 | **Atomic swap escrow fees** | 🔵 Pending | Send ~5-10 ZION to escrow `zion1y0j484d5e8r49785d253e8w0c2x4t3n792m5724` for L1 release TX fees. |
| 2.5 | **ZIONStaking / ZIONFarm UI verify** | ✅ Done | Deployed; verify live data on website. |
| 2.6 | **More DEX liquidity** | 🔵 Pending | Seed wZION/WETH (needs D3) and/or wZION/USDC. |
| 2.7 | **Blockaid false-positive report** | 🔵 Pending | Submit "honeypot" warning appeal. |

### 3.3 L3 / WARP

| # | Task | Status | Detail |
|---|------|--------|--------|
| 3.1 | **Deploy non-EVM contracts** | 🔵 Planned | Aptos Move module, NEAR contract, Sui package, TON jetton, Cardano native token, Cosmos CosmWASM. |
| 3.2 | **Set relay keys on Edge** | 🔵 Pending | `WARP_<CHAIN>_RELAY_KEY` env vars for each non-EVM chain. |
| 3.3 | **TON execute_mint fix** | 🔵 Pending | Replace watch-only with full TX construction via `ton-sdk`/`tonweb`/`tonlib`. |
| 3.4 | **Lightning Fáze A** | 🔵 Pending | LND node Docker + bitcoind backend + channel opening on Edge. |
| 3.5 | **WARP UI activation** | ✅ Done | `/warp` transfer form live; activate multi-chain as contracts deploy. |

### 3.4 Infrastructure / Repo

| # | Task | Status | Detail |
|---|------|--------|--------|
| 4.1 | **Guardian mnemonic backup** | 🔵 Pending | Copy `C:\Users\yosef\Desktop\ZION_DAO_GUARDIAN_KEYS.txt` to flash drive `F:\`. |
| 4.2 | **Repo cleanup Fáze 1** | 🔵 Pending | Delete `V3/config/` stale templates; archive root `.js` helper scripts. |
| 4.3 | **Repo cleanup Fáze 2** | 🔵 Pending | Create `V3/L1/types` crate for shared watcher types (bridge/dao/atomic-swap). |
| 4.4 | **Edge pool systemd** | 🔵 Pending | Kill orphaned manual pool, re-enable `zion-edge-pool.service`. |
| 4.5 | **CI/CD** | 🔵 Planned | GitHub Actions billing + automated builds. |

---

## 4. Phase 2 — 3.1.0 Pre-Mainnet (Q4 2026)

Goal: ship the user-facing stack (wallet, mobile, explorer, L4) before public launch.

| # | Initiative | Status | Detail |
|---|------------|--------|--------|
| 5.1 | **Wallet SDK** (`@zion/sdk`) | ✅ Memo support added | TypeScript SDK with memo support, tx signing, balance/history. Base for mobile + web. |
| 5.2 | **TX history RPC** | 🔵 Planned | Address-based index in L1 node; blocker for explorer. |
| 5.3 | **Mobile app** | 🔵 Planned | QR, biometrics, deep linking, EAS build, device testing, store submission. |
| 5.4 | **L4 OASIS backend** | 🔵 Planned | Guild wars, raid boss, OASIS token bridge, wallet signature auth. |
| 5.5 | **Desktop agent** | 🔵 Planned | Unify wallet core with mobile; Tauri v2 migration. |
| 5.6 | **Explorer bridge tracker** | 🔵 Planned | Live lock → confirm → mint UI. |
| 5.7 | **Security audit** | 🔵 Planned | External firm review of L1/L2/L3 contracts and node. |
| 5.8 | **CoinGecko / CMC listing** | 🔵 Planned | `docs/listings/` prep ready. |

---

## 5. Phase 3 — Public Mainnet Launch (31 December 2026)

Final checklist. Full procedure in [`V3/docs/MAINNET_LAUNCH_SEQUENCE.md`](./V3/docs/MAINNET_LAUNCH_SEQUENCE.md) if available, otherwise derive from `StatusV3.md`.

| # | Gate | Status |
|---|------|--------|
| 6.1 | TX unification deployed and stable | 🟡 Deployed on Edge; activation height 24000; E2E pending |
| 6.2 | Bridge/wZION addresses consistent across all clients | 🔵 |
| 6.3 | DeFi contracts verified + liquidity seeded | 🔵 |
| 6.4 | Wallet SDK + mobile app published | 🔵 |
| 6.5 | TX history RPC + explorer live | 🔵 |
| 6.6 | L4 OASIS backend complete | 🔵 |
| 6.7 | External audit complete | 🔵 |
| 6.8 | 3 fresh mainnet nodes deployed, genesis hash consistent | 🔵 |
| 6.9 | Public mining opened | 🔵 |

---

## 6. Phase 4 — Post-Launch 2027+

| Initiative | Target | Detail |
|------------|--------|--------|
| **ZionDex** | Q3 2027 | Cross-chain DEX router powered by WARP; custom AMM later. |
| **More EVM chains** | 2027 | Additional wZION deployments and bridge relays. |
| **Non-EVM expansion** | 2027 | Full production WARP routes for Aptos, NEAR, Sui, TON, Cardano, Cosmos. |
| **L5 Free World** | 2027–2028 | Genesis Garden, community blueprint, off-grid mesh. |
| **L6 Issobella** | 2030+ | Space station concept, funding via 5% fee split. |
| **Governance decentralization** | 2028–2030 | Move from Co-Admin to on-chain DAO. |
| **Hardware wallets** | 2028 | Ledger/Trezor integration. |
| **Privacy / quantum research** | 2028+ | zk-SNARK shielded txs, post-quantum signatures. |

---

## 7. Metrics

| Metric | Value |
|--------|-------|
| V3 workspace tests | ~1,650+ |
| WARP tests | 499 |
| Edge services | 13 active |
| Mainnet launch | 31 December 2026 |

---

*Generated from [`docs/3.0.3/`](./docs/3.0.3/) + [`3.0.4.md`](./3.0.4.md) + [`V3/ROADMAP.md`](./V3/ROADMAP.md) + [`StatusV3.md`](./StatusV3.md).*
