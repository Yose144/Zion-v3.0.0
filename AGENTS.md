# AGENTS.md

This file provides operating guidance to Devin, WARP, Copilot, and future automated agents working in this repository.

> **⚠️ SERVER MIGRATION 2026-07-07:** The old Edge server (`77.42.71.94`) is **DECOMMISSIONED**. All services have been rebuilt on a new server at **`62.171.141.136`** following the 3.0.4 hard genesis reset. New genesis hash: `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`. SSH: `ssh zion-new` (key: `~/.ssh/zion-new-server`). All references to `77.42.71.94` or `100.76.16.108` below are **historical** unless explicitly marked as updated. See [`StatusV3.md`](./StatusV3.md) § "Topology Update — 3-Node P2P Mesh" for current live topology (3 nodes: Edge primary + Edge follower + Local backup, all at height 827+). Web: `https://zionterranova.com` (Next.js Docker, image 377 MB standalone). Dashboard: `https://dashboard.zionterranova.com` (Basic Auth). Pool: `62.171.141.136:8444`. RPC: `rpc.zionterranova.com:8443` (public, nginx TCP stream proxy → `127.0.0.1:9443` internally). All L2 services (bridge, dao, warp, swap, dashboard) updated to use `127.0.0.1:9443` internally (2026-07-11).

## Scope and working area

- This is a multi-layer monorepo, but **active mainnet-track development is in `V3/`**.
- **ZionDex backend** lives in `ZionDex/` (standalone, not under `V3/`) — cross-chain DEX router (Rust), AMM contracts (Solidity/Foundry), TypeScript SDK, and `/dex` frontend page. See `ZionDex/README.md` and `ZionDex.md` for details. Tests: 28/28 Rust (`cargo test` in `ZionDex/router/`), 7/7 Solidity (`forge test` in `ZionDex/contracts/`). **Status: Live Beta** — Router integrated with L3 WARP API (port 8453), web UI live at `/dex` and `/ziondex` on zionterranova.com. Cross-chain AMM routing implemented (`aggregator.rs` — Dijkstra path finding, top 3 paths, 30s price cache). Multi-path quote API: `GET /quote/multi`. Pending: ZionDex Router service na Edge (port 8454), custom AMM deploy, intent-based execution. Contract addresses template: [`docs/3.0.5/CONTRACT_ADDRESSES.md`](./docs/3.0.5/CONTRACT_ADDRESSES.md).
- Treat legacy root trees (`L1/`, `L2/`, `L3/`, older docs/archive content) as migration/reference material unless a task explicitly targets them.
- For `V3` work, prefer changing only `V3/**` unless the task explicitly requires cross-tree sync.
- Avoid incidental edits in `APP&WEB/**` when the task is unrelated to website, desktop, or mobile work.
- If deployment behavior changes, update every source of operational truth together: compose files, Docker docs, runbooks, scripts, and status docs.
- If docs disagree, use this order of truth: `StatusV3.md` → `ROADMAP.md` / `V3/README.md` / `V3/ROADMAP.md` → `V3/docs/**` → older `STATUS.md`, root README, and archived docs.
- Root README / older plans may still mention historical multi-server topology. Verify live topology against `StatusV3.md` before making operational claims.

## public/ — Open-source public repository (git subtree)

The `public/` directory is a **git subtree** of the public repository `github.com/Zion-TerraNova/v3-Mainnet`, embedded directly in the private repo. Both repos are kept in sync via subtree push/pull — no separate clone needed.

- **Remote name:** `public` → `https://github.com/Zion-TerraNova/v3-Mainnet.git` (public, MIT license)
- **Remote name:** `origin` → `https://github.com/Yose144/Zion-v3.0.0.git` (private)
- **Local path:** `public/` (in repo root, tracked by `origin`)
- **Current status:** **Mainnet Beta** — v3.0.5-beta live, official public launch 2026-12-31
- **Network status badge:** `![Status: Mainnet Beta](https://img.shields.io/badge/Status-Mainnet_Beta-orange.svg)`

### Subtree commands

```bash
# Pull latest changes from public repo into public/
git subtree pull --prefix=public public/main --squash

# Push local changes in public/ to the public repo
git subtree push --prefix=public public main

# Fetch public remote (update refs without merging)
git fetch public
```

### What's in public/

The public repo contains a **curated subset** of the private repo — only files safe for public release:
- `V3/` — L1 core, L2 contracts, bridge, DAO, atomic-swap, cosmic-harmony, pool, miner, CLI, SDK, docs
- `docs/` — Whitepaper, Ethics & Philosophy, Bodhisattva Vow codex, genesis.md, legal docs (disclaimer, terms, privacy, jurisdiction, token disclosure), security disclosures, multilingual READMEs (EN/CS/ES/FR/PT), stargate assets
- `evoluZionV2.md` — PoW → Proof-of-Care vision
- Root files: `README.md`, `README_FULL.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE` (MIT), `Cargo.toml`, `.gitignore`

### What's NOT in public/ (stays private)

- `APP&WEB/` — website, desktop agent, mobile app source
- `ZION_OS/` — dashboard, monitoring, operational scripts
- `ZionStart/` — bootstrap tooling
- `PoC-lab/` — research/proof-of-concept code
- `HiranV2.x/` — AI layer (IP protection)
- `edge-deploy/` — server deploy configs
- `scripts/` — ops scripts (285 files)
- `docs/3.0.4/`, `docs/3.0.5/` — internal docs
- `docs/TerraNova/` — full TerraNova book manuscripts
- `docs/Zohar/` — internal Zohar documentation
- `docs/docs2.9/`, `docs/2.9.7/`, `archive/` — legacy/historical docs
- `3.0.5.md`, `StatusV3.md`, `ROADMAP.md`, `AGENTS.md` — internal status and planning
- Server configs, deploy scripts, environment files
- Private keys, mnemonics, GPG private keys

### Rules for public/ edits

1. **Never push secrets** — no private keys, mnemonics, server IPs (except public RPC `62.171.141.136`), internal hostnames, SSH keys
2. **Sync after private repo changes** — if you change `V3/` code or docs that also exist in `public/`, sync the change to `public/` and push to both remotes
3. **Two-step push** — commit to `origin` (private) first, then `git subtree push --prefix=public public main` to publish
4. **GPG signing** — if `docs/genesis.md` is edited, re-sign with `gpg --detach-sign` using the Yose creator key (`9018F94ACE7C93CF549612E225557B7072678D25`, GNUPGHOME `/tmp/zion_gpg/`)
5. **Release process** — see "GitHub Release process" below

### GitHub Release process

For future releases (e.g. v3.0.4-beta, v3.1.0, etc.):

1. **Build binaries:** `cargo build --release` → binaries in `target/release/`
2. **Create archives:** Package binaries into tar.gz archives per platform (e.g. `zion-all-3.0.4-linux-x86_64.tar.gz`, `zion-cli-macos-aarch64.tar.gz`)
3. **Compute SHA256:** `shasum -a 256 *.tar.gz > SHA256SUMS.txt`
4. **Create release on GitHub:**
   - Via `gh` CLI: `gh release create v3.0.4-beta --title "..." --notes "..." *.tar.gz SHA256SUMS.txt`
   - Or via curl API if `gh` not available (needs PAT token)
5. **Release notes template:** Include features list, download table with SHA256, installation instructions, platform availability
6. **Cross-platform:**
   - **Linux x86_64** — built natively on server
   - **Windows x86_64** — cross-compiled with `x86_64-pc-windows-gnu` target + mingw-w64 linker
   - **macOS aarch64** (Apple Silicon) — built natively on macOS
   - **macOS x86_64** (Intel) — cross-compiled with `x86_64-apple-darwin` target
7. **Binaries to package:** Single `zion` binary (community CLI with wallet + node + mine + pool + status + doctor + monitor). Windows version has node + pool + miner embedded.

### Current release: v3.0.5-beta (2026-07-10)

- **Tag:** `v3.0.5-beta` (prerelease)
- **Name:** ZION v3.0.5-beta — Simplified Community CLI
- **Assets:** 4 platform binaries + SHA256SUMS.txt
  - `zion-cli-linux-x86_64.tar.gz` (2.3 MB)
  - `zion-cli-macos-aarch64.tar.gz` (2.1 MB) — Apple Silicon
  - `zion-cli-macos-x86_64.tar.gz` (2.3 MB) — Intel
  - `zion-cli-windows-x86_64.zip` (4.7 MB) — node + pool + miner embedded
- **Key change:** Single `zion` binary with interactive menu (replaces 8 separate binaries)
- **Missing:** ARM64 (Raspberry Pi) — build from source: `cargo build --release -p zion-public`
- **URL:** `https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.0.5-beta`

### Mainnet Beta announcement (2026-07-09)

public/ README files (EN + 4 translations) include a **Network Status** section declaring:
- ZION v3.0.4 is live as **Mainnet Beta**
- Mining is active **at your own risk**
- Network may contain bugs — no warranty
- Genesis block and chain history are **permanent** (will not be reset if network passes security verification)
- Official public launch: **31 December 2026**
- LEGAL_DISCLAIMER.md §2.1 covers the Beta status legally

## Existing guidance files to know

- Root guidance baseline: `.github/copilot-instructions.md` (applies repo-wide).
- **How to work with Copilot efficiently (cost + capability map):** [`docs/3.0.3/COPILOT_COLLAB_PLAYBOOK.md`](./docs/3.0.3/COPILOT_COLLAB_PLAYBOOK.md) — Tier S/A/B/D capability map, 7 credit-saving habits, anti-patterns, quick reference card. Read this BEFORE starting a new Copilot session to scope the task correctly.
- **3.0.3 decimal fork — DEPLOYED (2026-06-27) + RPC SCALE FIX (2026-06-28):** [`docs/3.0.3/ZION_3.0.3_DECIMAL_FORK_PLAN.md`](./docs/3.0.3/ZION_3.0.3_DECIMAL_FORK_PLAN.md) — Option E (in-place fork via migration block at H+1, preserves block hashes 0..H). Edge server deployed: MIGRATION_HEIGHT=18850 (updated from 17995 — migration block was never created, all blocks 0-18850 are in legacy 1e12 scale), protocol 3.0.3, flowers_per_zion=1e6, all 13 services active. RPC `scaled_amount()` helper normalizes pre-migration amounts to 1e6 scale for balance queries. Full fix report: [`docs/3.0.3/REPORT_3.0.3_FIXES.md`](./docs/3.0.3/REPORT_3.0.3_FIXES.md). Rollback: DB backup at `edge-state.db.bak-3.0.3-cutover`.
- **3.0.4 DeFi deploy — COMPLETED (2026-06-29):** [`V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md`](./V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md) — DeFi contracts deployed on Base Mainnet: ZIONGovernance `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8`, ZIONTreasury `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` (3-of-3 multisig), ZIONStaking `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` (12% APR, 100K wZION funded), ZIONFarm `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` (1 wZION/s, 500K wZION funded). 5 DAO guardians provisioned. Website v3.6.3 with live DeFi pages. Atomic swap escrow funded 100K ZION. **Basescan verify — 7/7 COMPLETED (2026-07-09):** All 7 contracts verified on Basescan (wZION, ZIONAtomicSwap already verified; Governance, Treasury, Staking, Farm verified 2026-07-02 via Etherscan V2 API; ZIONBridge verified 2026-07-09 via `forge verify-contract` with correct source `bridge/contracts/src/ZIONBridge.sol` OZ 4.9.6 + 5 validators threshold 5/5). See [`BASESCAN_VERIFY_REPORT.md`](./docs/3.0.4/BASESCAN_VERIFY_REPORT.md). **TX unification — COMPLETED (2026-07-01):** account-model `memo` field added (L1 hard fork, height-gated), all 3 L2 watchers (bridge, atomic-swap, DAO) now scan `account_transactions`. See [`3.0.4.md`](./docs/3.0.4/3.0.4.md) §3. **Guardian mnemonics backup — COMPLETED + VERIFIED (2026-07-09):** zkopírováno z flash disku na `/home/zionserver/Desktop/ZionKeys/` (OpenSSL encrypted). **USB backup audit — COMPLETED (2026-07-09):** 4/4 shodné soubory (SHA256 checksumy identické USB↔Desktop), 4/4 GPG podpisy Good (Yose, key `9018F94A...`), 13/13 premine + 5/5 canonical + 1/1 bridge vault adresy cross-checknuty s `genesis.rs` ✓, všechny soukromé soubory `chmod 600`. **DEPLOY-5/6/7 E2E memo testy — COMPLETED (2026-07-09):** 3 account-model TXs s memos (BRIDGE:base:..., DAO:vote:1:yes, SWAP:LOCK:...) odeslány a potvrzeny v bloku 752 na live mainnetu (62.171.141.136). Memo field intact v block data. Watchers korektně filtrují by recipient address (ne jen memo prefix) — správné security chování. E2E SK shredded po testech.
- **3.1.0 pre-development audit:** [`docs/3.0.3/AUDIT_3.1.0_EXISTING_CODE.md`](./docs/3.0.3/AUDIT_3.1.0_EXISTING_CODE.md) — inventory of existing Wallet SDK, Mobile App, TX History RPC, and L4 Oasis code. All 4 components exist but need 3.0.3 fix (1e12→1e6) + completion. Read this BEFORE starting any 3.1.0 work to avoid duplication.
- **Web v2.9 upgrade guide:** [`docs/3.0.3/WEB_V2.9_TO_V3.0.3_UPGRADE.md`](./docs/3.0.3/WEB_V2.9_TO_V3.0.3_UPGRADE.md) — file-by-file guide for website 3.0.3 decimal fork migration.
- Canonical units state-of-the-world: [`docs/CANONICAL_UNITS_AUDIT.md`](./docs/CANONICAL_UNITS_AUDIT.md) — three coexisting RPC suffix conventions (`_flowers` ✅, `_atomic` ⚠️, mis-named `_zion` ❌) and recommended contract bump (§3b.5). **CLOSED at 3.0.3 cutover** — `_flowers` is now canonical, `_zion`/`_atomic` are deprecated aliases.
- Current status and launch blockers: [`StatusV3.md`](./StatusV3.md) (canonical, 2026-07-13). Historical archive: [`docs/3.0.5/StatusV3_archive_2026-07-13.md`](./docs/3.0.5/StatusV3_archive_2026-07-13.md) (5239 lines, incident reports).
- Current planning/status references: `ROADMAP.md` (forward roadmap), `V3/README.md`, `V3/ROADMAP.md` (engineering detail), and `V3/docs/**`.
- Hiran **v2.2** local inference setup (GGUF ready, llama-server.exe ready): [`HIRAN_LOCAL_SETUP.md`](./HIRAN_LOCAL_SETUP.md) — canonical guide for running inference locally. Use this, not v2.1 docs, for current runtime.
- Hiranyagarbha / Hiran **v2.1** roadmap (historical): [`HiranV2.1/Hiran_v2.1.md`](./HiranV2.1/Hiran_v2.1.md); upgrade context: [`HIRANYAGARBHA_UPGRADE_PLAN.md`](./HIRANYAGARBHA_UPGRADE_PLAN.md).
- Historical archive exists at `docs/2.9.9/archive/WARP.md`; treat it as legacy context, not current source of truth for V3 runtime behavior.
- Genesis Regeneration Runbook: [`GENESIS_REGENERATION_RUNBOOK.md`](./GENESIS_REGENERATION_RUNBOOK.md) — complete guide for genesis key rotation and recovery procedures.
- **3.0.4 Hard Genesis Reset — CANONICAL RUNBOOK (2026-07-06):** [`docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md`](./docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md) — **THE** single source of truth for the complete hard reset. Covers all 10 phases: pre-flight, key generation, genesis.rs update, L2/L3 config, EVM revocation, new server, L1 wipe, verification, documentation, generational transfer. Replaces all prior runbooks (docs/3.0.4/HARDRESETOFFICIAL.md, GENESIS_REGENERATION_RUNBOOK.md, docs/3.0.1Genesis/*) as the canonical procedure. New genesis hash: `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`. All 14 premine + 5 canonical + bridge vault addresses regenerated.
- **Security Disclosure — ZION-2026-001 through ZION-2026-005 (2026-07-06):** [`docs/security/SECURITY_DISCLOSURE_2026-07.md`](./docs/security/SECURITY_DISCLOSURE_2026-07.md) — Public vulnerability disclosure in Ethereum Foundation format. 5 vulnerabilities catalogued (F1 forged P2P signatures, F5 unlimited inflation, C1-C8 server exposure, TeamViewer compromise, EVM key compromise). Disclosure policy, timeline, remediation status, what source code will be published. Machine-readable [`docs/security/vulnerabilities.json`](./docs/security/vulnerabilities.json). See also: [`HARDRESETOFFICIAL.md`](./docs/3.0.4/HARDRESETOFFICIAL.md) (operational hard reset plan, status: EXECUTING).
- **Security hardening — F1 + F5 EXPLOIT + PHASE 2 COMPLETE + L2 PATCH DEPLOYED + F5 FUZZED (2026-07-02):** [`SecurityFirst.md`](./docs/3.0.4/SecurityFirst.md) · [`F5_SECURITY_INCIDENT_REPORT_2026-07-02.md`](./docs/3.0.4/F5_SECURITY_INCIDENT_REPORT_2026-07-02.md) · [`PATCH_L2_SECURITY_2026-07-02.md`](./docs/3.0.4/PATCH_L2_SECURITY_2026-07-02.md) — F1 exploit post-mortem (forged account TX via P2P from 109.81.30.165, rollback to 22180), comprehensive Edge server hardening: UFW (jen SSH/HTTP/HTTPS/Tailscale), private keys scrubbed z 5 souborů, file permissions 600, SSH klíče-only, **ALL služeb na 127.0.0.1**, AppArmor pro zion-node, 3 monitoring cron jobs, RPC audit log (v node binárce), Tailscale ACL doc (pending admin console apply). **L2 security patch DEPLOYED:** Commit `a8b3821e` — claimant guard, threshold 5/5, reorg safety, key hygiene, checked cast, composite dedup, escrow key zeroing, memo cap. MD5 shoda ověřena. **F1 fix deployed:** `validate_peer_block` nyní volá `verify_signature()` pro non-coinbase account TX (commit `9341344d`). **F5 CRITICAL fix deployed:** Account-model sender balance validation — `insert_transaction()` a `validate_peer_block()` nyní rejectují TX kde `sender_balance < amount + fee`. Height-gated via `ZION_BALANCE_CHECK_HEIGHT=22394` na Edge mainnet (obě nody). **F5 fuzz tests:** 5 testů (commit `a5472ec6`) — 100 random senders, double-spend, u64::MAX, rapid-fire, self-send, vše PASS. **Node binary swap:** Nejnovější binárka s fmt/clippy cleanup deploynuta (22:55 UTC), F5 aktivní, height 22539. Commits `69d12c7`, `fe8d449`, `9863747`, `46106f38`, `48bf387f`, `a5472ec6`. **Escrow key rotation:** Nový escrow keypair, inflační 100,002 ZION spáleno na unspendable burn address. **Pending:** ~~Tailscale ACL~~ (Tailscale removed), ~~systemd User=zion~~ ⚠️ NOT DEPLOYED — service files still use User=root, ~~key rotation F4.x~~ ✅ DONE (owner air-gapped), ~~BFG git history scrub~~ ✅ DONE. **WARNING:** Label-derived canonical addresses have PUBLIC keys — nepoužívat pro treasury wallets!
- **Security patch 3.0.4 wave 1-2 + F4.7 aktivace (2026-07-07):** [`SECURITY_PATCH_3.0.4_PLAN.md`](./docs/3.0.4/SECURITY_PATCH_3.0.4_PLAN.md) (kanonický postup, fáze 1-6) · [`SECURITY_TODO_2026-07-03.md`](./docs/3.0.4/SECURITY_TODO_2026-07-03.md) §Audit Delta. **Wave 1 (dependency + code hardening):** quinn-proto ≥0.11.15 (RUSTSEC-2026-0185 remote DoS), crossbeam-epoch ≥0.9.20, anyhow, rand, indicatif/ratatui/lru/metal advisory cleanup; node mainnet guard proti `ZION_SEED_PEERS=none|empty`; pool OASIS hook bez externího `curl` (interní HTTP + localhost-only guard + timeouty); bridge SQL whitelist v `count_by_status`; HTTP timeouty na dao_clientech; miner bez přímé `bincode` závislosti; audit wrapper `V3/scripts/security-audit.sh`. **Wave 2 (F4.7 max-tx-amount cap):** height-gated cap = `emission::TOTAL_SUPPLY` (144B ZION, NE 100M — nekoliduje s premine), výjimky genesis/coinbase, obě validační cesty (`insert_transaction` + `validate_peer_block`), 4 testy PASS. **AKTIVOVÁNO na serveru 62.171.141.136 (2026-07-07 23:16):** `ZION_MAX_TX_AMOUNT_HEIGHT=1` (bare EnvironmentFile formát), log `max_tx_amount_activation_height=1`, genesis hash `4f75a0df...` nezměněn, 7/7 služeb active. F5 (`ZION_BALANCE_CHECK_HEIGHT=0`) aktivní současně. Commity `690b6dfe`, `35e0f6d0`. **Canonicalizace topologie:** hardcoded seed peers (`lib.rs`, `discovery.rs`) + CLI topology defaults přesunuty ze starého Edge (77.42.71.94, decommissioned) na nový server (62.171.141.136), Tailscale odstraněn.
- **LI.FI cross-chain DEX + bridge integration (2026-06-30):** [`docs/3.0.3/Li.Fi-L2.md`](./docs/3.0.3/Li.Fi-L2.md) — LI.FI WidgetLight integrated into `/defi` page (aggregates 30+ DEX + 20+ bridges across 25+ chains). Phase 1 complete (WidgetLight postMessage, slippage fix, 0.5% fee, 7 EVM chains, custom RPC). Phase 1.5: Ankr API key activated (free tier). **Phase 2: 6 chains live** — wZION deployed on Base (8453), BSC (56), Polygon (137), Arbitrum (42161), Optimism (10), Avalanche (43114) with same address `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` (deterministic deploy). ZIONBridge on BSC/Polygon/Arbitrum/Optimism/Avalanche: `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721`. Bridge relay running on Edge with 6 EVM watchers. Website live on zionterranova.com with 6-chain LiFi widget. **Phase 3: WARP D-04 COMPLETE** — WARP přenáší **native L1 ZION**. Token naming: EVM chains → **wZION** (ERC-20 wrapped, jako WBTC), non-EVM chains → **ZION** (nativní reprezentace). Outbound: user pošle ZION na `BRIDGE_VAULT_ADDRESS` s memo `BRIDGE:<chain>:<recipient>` → WARP mintne ZION/wZION na dest chain (1:1 peg). Inbound: user spálí ZION/wZION → WARP odemkne ZION z vault. L1 RPC: `getBridgeLocks` + `submitBridgeUnlock` (3/5 validator quorum). **12 chain adapters registered** (11 fully functional + TON watch-only) with pure-Rust serializers: BCS (`bcs.rs`) for Aptos+Sui, CBOR (`cbor.rs`) for Cardano, TL-B Cell+BOC (`ton_cell.rs`) for TON. **499 WARP tests pass**. WARP (`V3/L3/warp/`) covers all 12 chain families. **Non-EVM contracts created (2026-07-12):** 9 ZION token contract source files in `V3/L2/bridge/contracts/non-evm/` (Solana, Tron, Stellar, Cardano, Cosmos, Aptos, Sui, NEAR, TON) — all implement bridgeMint/bridgeBurn with 5/5 quorum. Pending: deploy to mainnet + relay keys. See [`docs/3.0.5/CONTRACT_ADDRESSES.md`](./docs/3.0.5/CONTRACT_ADDRESSES.md) for address template.
- **WARP Lightning Network bridge (2026-06-30):** [`docs/WARP_LIGHTNING_PLAN.md`](./docs/WARP_LIGHTNING_PLAN.md) — Native ZION L1 ↔ BTC Lightning bridge via BOLT11 invoices. BOLT11 parser + LND REST client + adapter implemented (`bolt11.rs`, `lightning_signer.rs`, `adapter/lightning.rs`). **Fáze A COMPLETE (2026-07-12):** Docker setup created at `V3/L3/warp/docker/lightning/` (bitcoind testnet + LND v0.18.2 + Redis), channel management scripts at `V3/L3/warp/scripts/lightning/`, systemd service `edge-deploy/systemd/zion-edge-lnd.service`. `lightning.rs` updated with Docker-aware errors + enhanced health_check (LND connectivity, channel balance, on-chain balance). Pending: deploy to Edge (`docker compose up`), sync testnet, open channels, extract macaroon.
- **ZionDex L3 WARP Integration + Non-EVM Contracts + Cross-Chain AMM Routing (2026-07-12):** [`ZionDex.md`](./ZionDex.md) + [`docs/3.0.5/CONTRACT_ADDRESSES.md`](./docs/3.0.5/CONTRACT_ADDRESSES.md) — ZionDex Router integrated with L3 WARP API (port 8453). `executor.rs` uses POST /transfers/outbound + /transfers/inbound + polling. `aggregator.rs` (~740 lines) — LiquidityAggregator with Dijkstra path finding, returns top 3 optimal cross-chain paths, 30s price cache. `quote.rs` — MultiPathQuote. `api.rs` — GET /quote/multi. 28/28 Rust tests. Web UI live at `/dex` and `/ziondex` on zionterranova.com. **Non-EVM ZION token contracts created** for 9 chains (Solana SPL, Tron TRC-20, Stellar asset, Cardano Plutus, Cosmos CW20, Aptos Move, Sui Move, NEAR NEP-141, TON jetton) in `V3/L2/bridge/contracts/non-evm/` — all implement bridgeMint/bridgeBurn with 5/5 quorum. Pending: deploy contracts to mainnet, ZionDex Router service on Edge (port 8454), relay keys. Contract address template: [`docs/3.0.5/CONTRACT_ADDRESSES.md`](./docs/3.0.5/CONTRACT_ADDRESSES.md) — vyplň adresy po deploy.
- **Vision documents (2026-06-30):** [`docs/3.0.3/nativeZion.md`](./docs/3.0.3/nativeZion.md) (WARP token naming: wZION EVM, ZION non-EVM) + [`docs/3.0.3/ZionDex.md`](./docs/3.0.3/ZionDex.md) (cross-chain DEX concept powered by WARP — path to Top 100) + [`docs/3.0.3/evoluZion.md`](./docs/3.0.3/evoluZion.md) (ZION as Tree of Life — evolution from PoW to Proof-of-Care / Protokol Péče, NPU-based caring computation, with full source references to TerraNova book + NPU_HARDWARE_MINING_THEORY.md + cosmic-harmony NPU Mix code).
- **Zohar — kabalistický Strom života ZIONu (2026-07-03):** [`docs/Zohar/README.md`](./docs/Zohar/README.md) · [`docs/Zohar/01-SEFIROT-VRSTVY.md`](./docs/Zohar/01-SEFIROT-VRSTVY.md) · [`docs/Zohar/02-ROADMAP.md`](./docs/Zohar/02-ROADMAP.md) · [`docs/Zohar/03-O-KNIZE-ZOHAR.md`](./docs/Zohar/03-O-KNIZE-ZOHAR.md) — Mapování 10 sefirot + Da'at na ZION vrstvy L1-L6 (Keter=L1 Consensus, Chokmah=L1 PoW, Binah=L1 Validation, Chesed=L2 DeFi, Gevurah=L2 DAO, Tiferet=L3 WARP, Netzach=L3 AI/Hiran, Hod=L4 Oasis, Yesod=L5 Komunity, Malkhut=L6 Issobella). Tři pilíře: Milosrdenství (dávání) / Přísnost (disciplína) / Rovnováha (manifestace). Syntéza evoluZion.md (Strom života metafora) + TerraNova kniha (filosofie péče) v jazyce kabaly. **Fáze 0 (manifest) + Fáze 1 (web /app/zohar) + Fáze 2 (sefirot vow — [`V3/L5/docs/GOVERNANCE/sefirot-vow.md`](./V3/L5/docs/GOVERNANCE/sefirot-vow.md), 11 slibů pro validátory) + Fáze 4 (getTreeHealth API — [`/api/zohar/tree-health`](./APP&WEB/website-v2.9/src/app/api/zohar/tree-health/route.ts), živá data z blockchain/DeFi/bridge/NCL API mapovaná na 10 sefirot health score) hotové.** Fáze 2 on-chain: `SefirotVowToken` (soulbound ERC-721, [`V3/L2/contracts/hardhat/sol/SefirotVowToken.sol`](./V3/L2/contracts/hardhat/sol/SefirotVowToken.sol), 19 tests pass) + `SefirotVowRegistry` (proposal lifecycle, [`V3/L2/contracts/hardhat/sol/SefirotVowRegistry.sol`](./V3/L2/contracts/hardhat/sol/SefirotVowRegistry.sol), 10 tests pass) — kompilováno, deploy na Base mainnet pending (vyžaduje owner approval + gas). Fáze 3 (care task kategorie pro Protokol Péče) horizont — závisí na L1 consensus (2028+). Čistá dokumentační/web/governance/L2-contract vrstva — netýká se L1 consensus kódu.
- **Website maintenance mode (2026-07-03):** [`APP&WEB/website-v2.9/public/maintenance.html`](./APP&WEB/website-v2.9/public/maintenance.html) — static maintenance page s animovaným gold starfield canvasem (desktop-agent style: 350 hvězd, line trails, radial gradient overlay, 24 FPS). Deploy script: [`APP&WEB/website-v2.9/deploy/deploy_maintenance.py`](./APP&WEB/website-v2.9/deploy/deploy_maintenance.py) — nahradí Next.js kontejner za `nginx:alpine` servírující maintenance.html na portu 3000. Nginx config: [`APP&WEB/website-v2.9/deploy/maintenance-nginx.conf`](./APP&WEB/website-v2.9/deploy/maintenance-nginx.conf). **Aktuálně LIVE na zionterranova.com** (Security Upgrade 3.0.4). Pro obnovu webu: spusť normální deploy script který přepíše docker-compose.yml zpět na Next.js image. Edge cesty: maintenance page `/root/zion-web/maintenance.html`, nginx config `/root/zion-web/nginx.conf`, compose `/root/zion-web/docker-compose.yml`.
- **Website design system unification (2026-07-03):** `APP&WEB/website-v2.9/src/app/globals.css` definuje unified design třídy: `.zion-container` (max-w-80rem wrapper), `.zion-section` (rounded panel s border + blur), `.zion-tile` (soft inner grid item s hover), `.zion-cta-banner` (gradient CTA sekce), `.zion-rainbow-card` / `.zion-rainbow-sub` (hero/feature cards s per-color `--rc` CSS variable). Audit 73 page.tsx souborů hotový. Refaktorované: `/ai-native`, `/roadmap-295`, `/admin/revenue-v3` (ad-hoc `bg-black/60 backdrop-blur-xl` → `zion-section`/`zion-tile`), `/account` (přidány CZ/EN překlady), `/login` (grid-cols-3 → responsive). Referenční implementace: `/admin/page.tsx`.
- **PoC-lab Fáze 3 — Hiran HTTP integrace, MockHiranServer, live llama-server (2026-07-08):** [`PoC-lab/`](./PoC-lab/) — standalone Rust workspace (mimo `V3/`) implementující Proof-of-Care prototyp. **Fáze 1 (commit `2936fcb1`)** — kompletní základ: INT8 NPU VM (`poc-npu`), multi-backend cross-validace (`poc-verifier`), validator registry + Sefirot Vow lifecycle (`poc-registry`), reward split + slashing (`poc-economics`), E2E síťový simulátor s guardian/Bodhisattva Vow demo (`poc-sim`). **Fáze 2 (commit `5d0aefea`)** — 119 testů PASS: `DharmaValidator` (5-pilířový pipeline) + `HiranAwareVerifier` + `NclReputationRegistry` + `ConsciousnessLevel` enum + multi-epoch stress testy + CLI. **Fáze 3 (commit `75b79256` + nový commit)** — 145 testů PASS: `poc-hiran` nový crate (`HiranClient` trait, `LiveHiranClient` via `ureq` + `/v1/chat/completions`, `StubHiranClient`, `build_client()` factory, `MockHiranServer` via `tiny_http` na náhodném portu); `HiranNpuBackend` v `poc-npu` nyní volá živý HTTP endpoint; `poc-sim` výstup zobrazuje `hiran[live]` vs `hiran[stub]`; integrační testy `poc-sim/tests/integration_mock_hiran.rs` (6 testů — MockServer spawn/shutdown, 3 validátoři, multi-epoch, guardian bonus). **Live Hiran:** llama-server v2.2 Q4_K_M spuštěn lokálně na portu 8002 (`~5 tok/s` CPU), `poc-sim --hiran-url http://127.0.0.1:8002` ověřeno. Spec: [`docs/3.0.4/POC_HIRAN_INTEGRATION_SPEC.md`](./docs/3.0.4/POC_HIRAN_INTEGRATION_SPEC.md). Konceptuální základ: [`docs/3.0.4/PoC_CONCEPT.md`](./docs/3.0.4/PoC_CONCEPT.md). **Netýká se L1 consensus — čistě výzkumný prototyp.**

## Copilot agent quick-start (per-session checklist)

When a new Copilot/Kimi/Devin session opens against this repo:

1. **Read [`docs/3.0.3/COPILOT_COLLAB_PLAYBOOK.md`](./docs/3.0.3/COPILOT_COLLAB_PLAYBOOK.md) §3 (Capability Map)** to know what kind of task you're being asked for and what tier it belongs to.
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

- Node (new server seed — local dev only, connects to new server):
  - `$env:ZION_NODE_ID='local-dev-node'; $env:ZION_P2P_BIND='0.0.0.0:8333'; $env:ZION_RPC_BIND='0.0.0.0:8443'; $env:ZION_SEED_PEERS='62.171.141.136:8333'; $env:ZION_NODE_STATE_PATH='V3/data/zion-node-state.db'; $env:ZION_MINER_ADDRESS='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'; $env:ZION_HUMANITARIAN_WALLET='zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4'; $env:ZION_ISSOBELLA_WALLET='zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702'; $env:ZION_MIGRATION_HEIGHT='1'; cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node`
  - **Note:** `ZION_MIGRATION_HEIGHT=1` is required for fresh chain (genesis reset). Set to actual migration height if syncing existing chain.
- Pool server (local-dev only):
  - `$env:ZION_POOL_BIND='0.0.0.0:8444'; $env:ZION_NODE_RPC_ADDR='127.0.0.1:8443'; $env:ZION_POOL_LOOP_COUNT='1000000'; $env:ZION_NONCE_COUNT='4096'; $env:ZION_NONCE_COUNT_GPU='262144'; $env:ZION_POOL_WALLET='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'; cargo run --release --manifest-path V3/Cargo.toml -p zion-pool --bin server`
  - **IMPORTANT:** Pool and miner binaries must be compiled from the same source version — protocol is not backward compatible. Always recompile pool after `cargo build` on miner.
- Miner (connects to new server pool):
  - `$env:ZION_POOL_ADDR='62.171.141.136:8444'; $env:ZION_WORKER_NAME='<name>'; $env:ZION_MINER_ID='<id>'; $env:ZION_LOOP_COUNT='1000000'; $env:ZION_GPU_BACKEND='opencl'; $env:ZION_PAYOUT_ADDRESS='<zion1...address>'; $env:ZION_MINER_ALGORITHM='deeksha_lite_v1'; cargo run --release --manifest-path V3/Cargo.toml -p zion-miner`
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
  - **Production deployment (v3.0.4 — new server):**
    - SSH: `ssh zion-new` (key: `~/.ssh/zion-new-server`)
    - Source on server: `/root/zion-web-next/` (extracted from tar, Dockerfile.production)
    - Docker image: `zion-web:nextjs` (multi-stage build: node:22-alpine, 73+ Next.js routes)
    - Docker compose: `/root/zion-web-next/docker-compose.yml` — port `127.0.0.1:3001`, restart `unless-stopped`
    - Nginx reverse proxy: `https://zionterranova.com` → `127.0.0.1:3001` (SSL Let's Encrypt, HTTP/2, security headers)
    - Maintenance fallback: `zion-web:maintenance` image (nginx:alpine + maintenance.html)
    - CSP in `next.config.ts` updated to new server IP `62.171.141.136`
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
  - **Pool Metrics Endpoint**: Running on new server, pool metrics via node metrics port 127.0.0.1:9100
  - **TABS sync (2026-06-14):** `dashboard.js` `TABS` array must match all `pane-*` IDs in `dashboard.html`. Currently 34 tabs. If you add a new `<div id="pane-foo">` in HTML, also add `'foo'` to `TABS` and optionally a handler in `switchTab()`.
  - **Payout API mapping:** `/api/payout` returns `data.miners` (not `data.miner_stats`); hashrate from `data.pool_stats.hashrate.pool` (H/s); paid amounts in ZION (already converted from flowers/1e12).
  - **Pool remote control (v3.0.4):** `POST /api/control {"action":"restart-pool"}` — SSH via `ssh zion-new`. Dashboard runs on new server at 127.0.0.1:8766, proxied via nginx at `https://dashboard.zionterranova.com` (Basic Auth).
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
sudo systemctl enable --now zion-agent
```

**Documentation:**
- `ZION_OS/README.md` - Complete system documentation
- `ZION_OS/docs/ARCHITECTURE.md` - System architecture & design decisions
- `ZION_OS/docs/ROADMAP.md` - Development roadmap & milestones

### AppPay — Cross-Platform Monetization + Auto-Update (2026-07-10)

**AppPay** is the unified monetization and auto-update system for Desktop Agent (Electron) and Mobile App (React Native / Expo). See [`AppPay.md`](./AppPay.md) for the full plan.

**Update Server** (`update-server/`): Fastify + SQLite server at `updates.zionterranova.com` that handles:
- **Desktop:** License key validation + electron-updater `latest.yml` serving + binary download (license-gated via `X-License-Key` header)
- **Mobile:** IAP receipt verification (Apple StoreKit 2 + Google Play Billing) + entitlement management
- **Admin:** License generation, revocation, release upload, IAP receipt/entitlement listing

**Desktop Agent auto-update (BUILT + TESTED):**
- `electron-updater` generic provider → `https://updates.zionterranova.com/api/releases`
- License key UI in Settings → Updates (input + Activate button)
- IPC: `getLicenseKey`, `setLicenseKey`, `validateLicense`
- Startup auto-check requires valid license key
- Files: `APP&WEB/desktop-agent/src/main.js`, `preload.js`, `ui/index.html`, `ui/renderer.js`

**Mobile App IAP (BUILT + TESTED):**
- `react-native-iap` for StoreKit 2 (iOS) + Google Play Billing (Android)
- `IAPService.js` — unified purchase flow, product fetching, restore
- `LicenseService.js` — receipt validation with server, entitlement caching (AsyncStorage)
- `IAPContext.js` — React context (isPro, hasMinerBoost, products, purchase, restore)
- `PaywallScreen.js` — full paywall UI (Pro plans, Miner Boost, Donations, Restore)
- `SettingsScreen.js` — Premium section with upgrade/restore
- 6 IAP products: `zion.pro.lifetime` ($29.99), `zion.pro.yearly` ($9.99/yr), `zion.pro.monthly` ($1.99/mo), `zion.miner.boost` ($4.99), `zion.donate.5` ($4.99), `zion.donate.25` ($24.99)
- Server endpoints: `POST /api/iap/validate`, `GET /api/iap/entitlements`, `POST /api/iap/restore`
- Dev mode: server accepts receipts without Apple/Google verification (set `APPLE_SHARED_SECRET` + `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` for production)

**Pending (requires user action):**
- Deploy update server on `62.171.141.136` + DNS `updates.zionterranova.com`
- Buy Apple Developer Program ($99/yr) + Windows Code Signing cert ($60–200/yr)
- Configure IAP products in App Store Connect + Google Play Console
- Set `APPLE_SHARED_SECRET` + `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` on server

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

## 6) Canonical Operational Settings (v3.0.4 Mainnet — Post Hard Reset)

### Network Topology

> **UPDATED 2026-07-09:** 3-node P2P mesh deployed. Edge server has 2 L1 nodes (primary + follower), local backup node is 3rd peer. All synced at height 230. Edge git re-cloned to latest `754fe4a0`.
>
> **UPDATED 2026-07-07:** Old Edge server (`77.42.71.94`) is **DECOMMISSIONED**. All services rebuilt on new server following 3.0.4 hard genesis reset.

Current live topology is **3-node P2P mesh** (Edge primary + Edge follower + Local backup). The old Edge server was decommissioned after security compromise.

```
Edge Server (VPS) — 62.171.141.136
    ├── Node 1 (primary, mining) — RPC 8443, P2P 8333
    ├── Node 2 (follower) — RPC 8448, P2P sync from Node 1
    ├── Pool (Stratum) — 8444
    ├── Bridge (L2) — 9101
    ├── DAO (L2) — 8450
    ├── WARP (L3) — 8453
    ├── OASIS (L4) — 8455
    ├── Free World (L5)
    ├── Dashboard — 8766
    └── nginx — 80/443

Local Machine — zionserver-144 (public IP 109.81.87.10)
    ├── Backup Node — RPC 8446, P2P 8333 (peer to Edge)
    ├── Dashboard — 8766
    ├── Stack (L2/L3: free-world, ai-native-api, issobella, dao, oasis, atomic-swap, ollama)
    └── SSH Tunnel — 9 local + 2 reverse forwards to Edge

Web: https://zionterranova.com (nginx → Docker Next.js)
Dashboard: https://dashboard.zionterranova.com (nginx → Python)
```

| Role | Host | Public IP | Ports |
|------|------|-----------|-------|
| Edge Node 1 (primary) | VPS (Ubuntu 24.04.4) | 62.171.141.136 | P2P: 8333, RPC: 8443 (localhost), Pool: 8444, WS: 8445, DAO: 8450, WARP: 8453, ZionDex: 8454 (pending), OASIS: 8455, LND REST: 8080 (pending), LND gRPC: 10009 (pending), LND P2P: 9735 (pending), Web: 80/443, Dashboard: 8766 |
| Edge Node 2 (follower) | VPS (same) | 62.171.141.136 | RPC: 8448 (localhost) |
| Local Backup Node | zionserver-144 | 109.81.87.10 | RPC: 8446 (localhost), P2P: 8333 |

### Canonical Ports & Services (v3.0.4 — New Server)

| Service | Port | Bind | Protocol | Notes |
|---------|------|------|----------|-------|
| Node 1 P2P | 8333 | 0.0.0.0 | TCP | Peer-to-peer sync (primary) |
| Node 1 RPC | 8443 | 127.0.0.1 | TCP | JSON-RPC 2.0 (via nginx /api/rpc) |
| Node 2 RPC | 8448 | 127.0.0.1 | TCP | Follower node (P2P sync from Node 1) |
| Node WebSocket | 8445 | 127.0.0.1 | TCP | Node event stream |
| Node metrics | 9100 | 127.0.0.1 | HTTP | Prometheus metrics |
| Pool Stratum | 8444 | 0.0.0.0 | TCP | Miner connections (public) |
| Bridge metrics | 9101 | 127.0.0.1 | HTTP | Prometheus metrics (bridge) |
| DAO API | 8450 | 127.0.0.1 | HTTP | DAO daemon API (via nginx /api/dao) |
| WARP Relay | 8453 | 0.0.0.0 | HTTP | Cross-chain relay API |
| ZionDex Router | 8454 | 127.0.0.1 | HTTP | Cross-chain DEX router API (pending deploy) |
| LND REST | 8080 | 127.0.0.1 | HTTP | Lightning Network REST API (Docker, pending) |
| LND gRPC | 10009 | 127.0.0.1 | gRPC | Lightning Network gRPC (Docker, pending) |
| LND P2P | 9735 | 0.0.0.0 | TCP | Lightning Network peer connections (pending) |
| bitcoind RPC | 18332 | 127.0.0.1 | HTTP | Bitcoin testnet RPC (Docker, pending) |
| bitcoind P2P | 18333 | 0.0.0.0 | TCP | Bitcoin testnet peer connections (Docker, pending) |
| OASIS (L4) | 8455 | 127.0.0.1 | HTTP | OASIS Avatar Hub |
| Dashboard | 8766 | 127.0.0.1 | HTTP | ZION_OS Dashboard (via nginx, Basic Auth) |
| Website (Next.js) | 3001 | 127.0.0.1 | HTTP | Docker `zion-web:nextjs` (via nginx) |
| Nginx HTTP | 80 | 0.0.0.0 | HTTP | Redirect to HTTPS |
| Nginx HTTPS | 443 | 0.0.0.0 | HTTP/2 | SSL Let's Encrypt, reverse proxy |
| Local Backup Node RPC | 8446 | 127.0.0.1 | TCP | Backup node on zionserver-144 (via SSH tunnel reverse forward) |

### Canonical URLs & Endpoints (v3.0.4)

| Purpose | URL |
|---------|-----|
| **Pool (public mining)** | `62.171.141.136:8444` |
| **RPC (server localhost only)** | `http://127.0.0.1:8443/jsonrpc` |
| **RPC (via nginx proxy)** | `https://zionterranova.com/api/rpc` |
| **DAO API (via nginx proxy)** | `https://zionterranova.com/api/dao` |
| **WARP API** | `http://127.0.0.1:8453` (internal) / `http://62.171.141.136:8453` (external) |
| **ZionDex Router API** | `http://127.0.0.1:8454` (pending deploy) |
| **Website production** | `https://zionterranova.com` |
| **Dashboard** | `https://dashboard.zionterranova.com` (Basic Auth: Yose/Issy) |

### SSH Access (v3.0.4 — New Server)

- **SSH config:** `ssh zion-new` (alias in `~/.ssh/config`)
- **SSH key:** `~/.ssh/zion-new-server` (ed25519, fingerprint `SHA256:wnq2p9n17icqkpkJMAjPZto0axRtkVTVXPMBuD9tz64`)
- **Password auth:** DISABLED (keys only)
- **Never commit private keys.** Private SSH keys, Ed25519 signing keys, EVM private keys, and mnemonics must NEVER be placed in the repo root or any tracked directory — even if `.gitignore` covers them. The only valid location for SSH keys is `~/.ssh/` (chmod 600). A stray `newzionssh.md` containing the production SSH private key was found and deleted 2026-07-09; do not recreate it.

### New Server Deployment (Autonomous 24/7)

The new server runs as the canonical primary node + pool + full stack. It must survive reboots without local PC intervention.

**Systemd services** (installed via `V3/deploy/new-server/`):
- `zion-node.service` — Core node (P2P:8333, RPC:8443)
- `zion-pool.service` — Mining pool (Stratum:8444)
- `zion-bridge.service` — Bridge relay (L2)
- `zion-dao.service` — DAO scanner (L2)
- `zion-warp.service` — WARP relay (L3)
- `zion-dashboard.service` — ZION_OS Dashboard (Python, port 8766)
- `zion-watchdog.timer` — Health monitor (2-minute timer)
- `nginx` — Reverse proxy + SSL (ports 80/443)

**Docker container:**
- `zion-web-next` — Next.js 16.2.9 website (image `zion-web:nextjs`, port 127.0.0.1:3001)
- `zion-web:maintenance` — Maintenance page fallback image (available, not running)

**Environment file:** `/root/zion/edge-environment.sh` (chmod 600, `<REPLACE_*>` placeholders for air-gapped keys)

**Data directory:** `/data/zion/` (state, bridge DB, DAO DB)

**Persistence:**
- Node state: `/data/zion/state/`
- Bridge DB: `/data/zion/bridge-mainnet.db`
- DAO DB: `/data/zion/dao-mainnet.db`
- Repo: `/root/zion/2.9.6/` (git clone at commit `690b6dfe`)

### Miner Deployment (v3.0.4 — New Server)

The new server HAS a Rust toolchain (1.96.1 stable). To deploy an updated miner binary:

1. **Build on server:**
   ```bash
   ssh zion-new 'cd /root/zion/2.9.6 && source ~/.cargo/env && cargo build --release -p zion-miner'
   ```

2. **Or build locally and scp:**
   ```bash
   scp V3/target/release/zion-miner zion-new:/usr/local/bin/zion-miner
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
   nohup /usr/local/bin/zion-miner >> /var/log/zion-miner.log 2>&1 &
   ```

### Backup Infrastructure (Local + New Server)

**New server backup (v3.0.4):**
- Script: TBD (create `zion-backup.sh` — backup `/data/zion/` + systemd units + nginx config + docker-compose)
- Destination: `/data/zion/backups/`
- Includes: node state, bridge DB, DAO DB, systemd units, nginx config, docker-compose, environment file
- Recommended: `cron` job every 15 min or systemd timer

**Local W11 backup:**
- Script: `scripts/local-core-backup.ps1`
- Launcher: `ZionStart/windows/backup-local-core.bat`
- Destination: `C:\ZION-AutoBackups\`
- Includes: V3/data, all `.db` files, configs, git ref, health.json

**Dashboard Backups tab:**
- Endpoint: `/api/backup/status`
- Shows: Local Core health + server health
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
- Genesis Projects (Slot 11): 590M (0.59B)
- Bridge Seed Fund (Slot 12): 0.4B
- Humanitarian (Slot 13): 1.44B

**Canonical Addresses:**
- Humanitarian: `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4`
- ISSOBELLA: `zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702`
- Pool Fee: `zion196m4n8x764v7a0s406j40094a8z5j8m6z7nk342`
- Default Miner: `zion1w523a76830x2t5m7f3j023w265e8g5c400a4790`
- Pool Payout: `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604`
- Genesis Projects: `zion16542q4l853a2z0u5r5w8y4m8k4558847h503736` (590M ZION, account model)
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
- Genesis Projects (Slot 11): 590 million ZION = `590_000_000_000_000` flowers (590 trillion)

**Verification:**
```javascript
const FLOWERS_PER_ZION = 1_000_000n;
const flowers = 590_000_000_000_000n; // Genesis Projects balance
const zion = flowers / FLOWERS_PER_ZION; // = 590_000_000 ZION = 590 million
```

**⚠️ Common mistake:** RPC returns `balance_flowers: "590000000000000"` which is 590 **million** ZION, not 590 billion. Always divide by 10^6 to get ZION.

**⚠️ Live RPC contract drift (verified 2026-06-25 against old Edge `http://77.42.71.94:8443/jsonrpc` — HISTORICAL, server decommissioned):**

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

### New Server Recovery (v3.0.4)

If the new server (62.171.141.136) becomes unresponsive:
1. SSH directly: `ssh zion-new` (key: `~/.ssh/zion-new-server`)
2. If SSH fails, use VNC console: `95.111.232.25:63061` (RFB protocol, password `h4neV76S`)
3. Check systemd services: `systemctl status zion-node zion-pool zion-bridge zion-dao zion-warp zion-dashboard nginx`
4. Restart services if needed: `systemctl restart zion-node zion-pool`
5. Verify network connectivity and UFW status: `ufw status`
6. Check disk: `df -h /` (should be <80%, 145GB disk)
7. Check Docker: `docker ps` (zion-web-next should be running)

### New Server Log Management (v3.0.4)

The new server uses journald for all ZION services (no rsyslog RPC filter needed — services bind to 127.0.0.1 and dashboard is behind Basic Auth, reducing RPC noise).

**Agent rules for new server log management:**
1. **NEVER `rm -rf /var/log/*`** — always use `journalctl --vacuum-time=7d` or `journalctl --vacuum-size=1G`.
2. **Before deploying new services**, verify they don't log at INFO/DEBUG level without rate limiting. Set `RUST_LOG=warn` for production services unless debugging.
3. **If disk is >90% full**, run `journalctl --vacuum-size=500M` and investigate.
4. **After server reboot**, verify: all services active (`systemctl is-active zion-node zion-pool zion-bridge zion-dao zion-warp zion-dashboard nginx`), `df -h /` < 80%, `docker ps` shows zion-web-next.

### New Server Service Management (v3.0.4)

All ZION services on the new server run as systemd units:

| Service | Unit file | Port(s) | Depends on |
|---------|-----------|---------|------------|
| Node | `zion-node.service` | 8333 (P2P), 8443 (RPC), 8445 (WS), 9100 (metrics) | network-online |
| Pool | `zion-pool.service` | 8444 (Stratum) | zion-node |
| Bridge | `zion-bridge.service` | 9101 (metrics) | zion-node |
| DAO | `zion-dao.service` | 8450 (API) | zion-node |
| WARP | `zion-warp.service` | 8453 | zion-node |
| ZionDex Router | `zion-ziondex-router.service` | 8454 (pending) | zion-warp |
| LND (Lightning) | `zion-edge-lnd.service` | 8080, 10009, 9735 (pending) | docker |
| Dashboard | `zion-dashboard.service` | 8766 | zion-node |
| Watchdog | `zion-watchdog.timer` | — (2-min interval) | — |
| Nginx | `nginx.service` | 80, 443 | — |
| Docker (web) | `docker.service` + compose | 127.0.0.1:3001 | — |

**If a service shows red/down on dashboard:**
1. SSH to new server: `ssh zion-new`
2. Check: `systemctl status <service-name>`
3. Check logs: `journalctl -u <service-name> -n 50 --no-pager`
4. Restart: `systemctl restart <service-name>`
5. Verify: `systemctl status <service-name>` and check the port is listening

**Common service issues (new server):**
- Service `inactive (dead)` after reboot despite `enabled`: start manually with `systemctl start <service>`, check `Requires=` dependencies.
- Service crashes on startup: check if disk is full (`df -h /`), check if required port is already in use (`ss -tlnp | grep <port>`).
- Bridge/DAO fail with "No such file or directory": check that `ZION_BRIDGE_CONFIG` / `DAO_CONFIG` env vars point to correct config paths in `/root/zion/edge-environment.sh`.
- `ProtectHome=true` in systemd unit blocks access to `/root/` — removed in v3.0.4 deploy.

### Pool Issues

If pool stops accepting connections:
1. Check pool logs: `journalctl -u zion-pool.service -f`
2. Verify node RPC is accessible: `curl http://127.0.0.1:8443/jsonrpc`
3. Check pool configuration: `V3/L1/pool/config/pool-mainnet.toml`
4. Restart pool service: `systemctl restart zion-pool.service`
5. Verify miners can reconnect

### Pool Scalability (F1-F6, 2026-07-11)

The pool server has been optimized for 1000+ concurrent miners. Six fixes were applied (commit `673632525`):

- **F1 — Thread handle reaping:** `handles.retain(|h| !h.is_finished())` runs when `handles.len() > 128` in the accept loop, preventing unbounded `Vec<JoinHandle>` memory growth.
- **F2 — Atomic share counters:** `MiningPool` share counters changed from `u64` to `AtomicU64`. `record_accepted_share(&self)`, `record_rejected_share(&self)`, `record_stale_share(&self)` take `&self` (not `&mut self`), enabling lock-free updates.
- **F4 — Batched logging channel (`LogChannel`):** Hot-path `println!` calls in the submit loop replaced with `log_ch.log(format!(...))` — an mpsc sync_channel (4096 capacity) + background thread that batches into 4KB chunks, flushing every 100ms. Eliminates per-share syscall overhead.
- **F4b — LogChannel deadlock fix (post-deploy hotfix):** The original `LogChannel::spawn()` held `stdout.lock()` permanently for the entire lifetime of the background thread, causing any `println!` in the main thread to deadlock. Fixed by acquiring+dropping the lock per write cycle instead.
- **F5 — Async payout execution:** Payout TX submission moved to a background thread (`execute_payout_async`). The miner thread that found a block is no longer blocked for 600ms-50s during N sequential RPC calls to the node.
- **F6 — PPLNS persistence lock-split + dirty flag:** The persistence thread holds the PPLNS mutex only for snapshot clone + dirty-flag check. JSON serialization and file I/O happen outside the lock. A `dirty` flag on `PplnsEngine` skips saves entirely when no shares arrived since the last save cycle.
- **P7 — Miner ID interning (u32 index):** `MinerRegistry` maps `String` miner IDs to compact `u32` indices. `WindowEntry` uses `u32` instead of `String`. All per-miner data (`unpaid`, `paid_per_miner`, `shares_per_miner`, `last_share_time_per_miner`, `addresses`) changed from `HashMap<String, T>` to `Vec<T>` indexed by u32. Zero String allocations in the hot path — critical for 10k miners (50k shares/sec).
- **P8 — Incremental share weights:** Running `Vec<u128>` maintained on each `record_share`/eviction. `distribute_to_miners()` is O(active_miners) instead of O(window_len) — 50× faster at 10k miners with large windows.
- **P9 — Configurable window size:** `ZION_PPLNS_WINDOW_SIZE` env var (default 500,000). For 10k miners, set to 5,000,000+.
- **P10 — Backward-compatible snapshot:** `PplnsSnapshot` format unchanged (String-based HashMaps). u32↔String conversion happens only during `snapshot()`/`restore()`. Existing state files load without migration.
- **F3 (per-session job tracking):** Deferred — too large a refactor for this pass.

Full report: [`docs/3.0.5/POOL_PERF_REPORT_2026-07-11.md`](./docs/3.0.5/POOL_PERF_REPORT_2026-07-11.md)

### Watchdog Fix (2026-07-11)

The deployed watchdog script (`/usr/local/bin/zion-watchdog.sh`) had two bugs causing pool restarts every 2 minutes:
1. `/dev/tcp/127.0.0.1:8444` — bash's `/dev/tcp` uses `/` separator, not `:`. Replaced with `nc -z -w3` (netcat).
2. `getHeight` JSON-RPC method doesn't exist. Fixed to `getChainInfo` (returns `.result.chain_height`).

Fixed script: `V3/deploy/new-server/zion-watchdog.sh`. Report: [`POOL_WATCHDOG_FIX_REPORT_2026-07-11.md`](./POOL_WATCHDOG_FIX_REPORT_2026-07-11.md)

### AuxPow Merge Mining (2026-07-11)

**AuXpow crate** (`AuXpow/`) — standalone merge-mining system integrated into the V3 pool server. Enables the pool to mine external coins (DCR, ALPH, KAS, ERG, RVN, ETC, EVR, MEWC, FLUX, CLORE, XMR) via Stratum v1 proxy with profit-switching and circuit breaker.

- **Crate:** `zion-auxpow` (workspace member, deps: blake3, tokio, sha3, serde, anyhow)
- **Files:** `src/types.rs` (11 coins, config, stats, hysteresis), `src/external_hashers.rs` (Blake3, kHeavyHash), `src/auxpow_client.rs` (Stratum v1), `src/auxpow_scheduler.rs` (profit switcher + circuit breaker + mining loop)
- **Pool integration:** `V3/L1/pool/src/bin/server.rs` — scheduler spawned on dedicated tokio runtime, env-gated `ZION_AUXPOW_ENABLED=1`. `/stats` API exposes 13-field `auxpow` section.
- **Dashboard:** `ZION_OS/dashboard/` — AuxPow card in Pool Miners tab (status, coin, algo, pool, shares, revenue, uptime, circuit breaker, coin switches). **Expanded 2026-07-12** with 8 additional metrics: accept rate (with progress bar), revenue/hour estimate, shares/min, reject rate, supported coins list (KAS · ALPH · DCR), bridge queue depth, external jobs processed, ZION/Aux share ratio.
- **Env vars:** `ZION_AUXPOW_ENABLED`, `ZION_AUXPOW_WALLET`, `ZION_AUXPOW_ALLOCATION`, `ZION_AUXPOW_POOL_PREFERENCE`, `ZION_AUXPOW_HYSTERESIS_PCT`, `ZION_AUXPOW_CB_THRESHOLD`, `ZION_AUXPOW_CB_RESET_SECS` (10 total)
- **Tests:** 146/146 pass (40 auxpow + 73 pool lib + 33 pool server)
- **Deployed:** Edge server `62.171.141.136` — pool binary + dashboard, **LIVE & ACTIVE** (KAS merge-mining via `kas.2miners.com:2020`, kheavyhash algorithm, circuit breaker closed, 0 failures)
- **Live tested:** 2026-07-11 — TCP connect + Stratum subscribe to `kas.2miners.com:2020` succeeded, authorize rejected dummy wallet (expected), circuit breaker tripped correctly after 5 failures. **2026-07-12 — fully operational** with real wallet `bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh`, authorized on KAS, scheduler running stable.
- **Critical design notes:**
  - Tokio runtime MUST be leaked via `std::mem::forget()` — if dropped, all spawned tasks are immediately cancelled
  - Pool server has no `tracing` subscriber — use `println!` not `info!/warn!` for scheduler logging
  - Pool addresses change frequently — 2miners delisted DCR/ALPH, KAS port 4444→2020, ERG port 3056→8888 (verified 2026-07-11)
- **Plan:** [`AUXPOW_MERGE_MINING_PLAN.md`](./AUXPOW_MERGE_MINING_PLAN.md) — 3-phase approach (Phase 1 = stratum proxy ✅, Phase 2 = miner dual-stratum, Phase 3 = true AuxPow protocol hard fork)
- **Report:** [`docs/3.0.5/AUXPOW_INTEGRATION_REPORT_2026-07-11.md`](./docs/3.0.5/AUXPOW_INTEGRATION_REPORT_2026-07-11.md)
- **Commits:** `44371aa10` (crate), `0a49a3f48` (pool + dashboard integration), `7eb9f89cb` (docs), `f14500db3` (3 bug fixes: runtime leak, pool addresses, println logging), `259e662be` (dashboard panel expansion — 8 new metrics)

## Current Status (2026-07-12 — Post Hard Reset + Chv3 + AuxPow Live)

**System Status (new server 62.171.141.136):**
- ✅ Hard Genesis Reset: Complete (2026-07-07) — new genesis hash `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`
- ✅ zion-node: Running (P2P 8333, RPC 127.0.0.1:9443, WS 127.0.0.1:8445, metrics 127.0.0.1:9100) — **height 4036+** (synced from 3886→4035 via P2P + first pool-mined block 4036)
- ✅ zion-node2: Running (follower, P2P 8334, RPC 127.0.0.1:8448)
- ✅ zion-pool: Running (Stratum 0.0.0.0:8444, metrics 127.0.0.1:8455, fee split 89/5/5/1) — 11+ mineri, ~365 KH/s, 100% accept rate
- ✅ zion-bridge: Running (metrics 127.0.0.1:9101, EVM: OP, Base, ARB, AVAX)
- ✅ zion-dao: Running (API 127.0.0.1:8450, scanner → 127.0.0.1:9443)
- ✅ zion-warp: Running (0.0.0.0:8453, 499 tests, 13 chain adapters)
- ✅ zion-atomic-swap: Running (Base HTLC, scanner → 127.0.0.1:9443)
- ✅ zion-dashboard: Running (127.0.0.1:8766, Basic Auth Yose/Issy)
- ✅ zion-free-world: Running
- ✅ zion-issobella: Running
- ✅ zion-oasis: Running
- ✅ zion-watchdog: Running (timer, 2 min interval, RPC → 127.0.0.1:9443)
- 🔲 zion-ziondex-router: Pending deploy (127.0.0.1:8454, 28 tests, cross-chain AMM routing)
- 🔲 zion-edge-lnd: Pending deploy (Docker: LND 8080/10009/9735 + bitcoind 18332/18333)
- ✅ nginx: Running (80/443, SSL Let's Encrypt, HTTP/2)
- ✅ Website: Running (Docker `zion-web:nextjs`, Next.js 16.2.9, 73+ routes, port 127.0.0.1:3001)
- ✅ Dashboard: Running (`https://dashboard.zionterranova.com`, Basic Auth Yose/Issy)
- ✅ AuxPow: **LIVE & ACTIVE** — KAS merge-mining via `kas.2miners.com:2020` (kheavyhash), circuit breaker closed, scheduler stable
- ✅ DeekshaChv3: Phase A deployed (alias, fork at H=4500) + Phase B deployed (stream telemetry)
- ✅ Chain: Height 4036+ (post-hard-reset), premine 16.78B ZION, block reward 5400.067 ZION
- ✅ OS: SSH keys-only, UFW (22/80/443), fail2ban, Docker 29.6.1
- ✅ Monitoring: 3 cron jobs + systemd watchdog timer (2 min)
- ✅ SSL: 3 Let's Encrypt certs (zionterranova.com, www, dashboard) — auto-renew

**Old Edge server (77.42.71.94): DECOMMISSIONED** — all services migrated to new server.

**Pending (owner akce):**
1. ~~Air-gapped klíče~~ ✅ DONE — key rotation proběhla, escrow SK aplikován, EVM/guardian SKs na flash disku
2. Minery — připojit k `62.171.141.136:8444`
3. DNS aplikace — `dns.md` zónový soubor v Webglobe admin console
4. ~~F4.7 aktivace~~ ✅ DONE — `ZION_MAX_TX_AMOUNT_HEIGHT=1` aktivní
5. ~~Key rotation F4.x~~ ✅ DONE — owner air-gapped
6. ~~Git history scrub~~ ✅ DONE — BFG scrub proběhl
7. EVM contract redeploy (ZION-2026-005) — nové kontrakty s novými admin klíči + multisig
8. Externí audit genesis konfigurace — před public launch
9. Re-clone repo (all collaborators) — git history přepsána filter-repo

### F5 Coinbase Balance Fix + Pool Logging + Template Cache (2026-07-12)

**Root cause:** Node stuck at height 3886 — pool repeatedly found block 3887 but node silently rejected it. Debugging via manual RPC `submit_candidate` revealed: `"locally mined block failed validation: peer block TX from zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2 has insufficient balance: 394477888 < 480605963"`. The F5 balance check was incorrectly applied to **coinbase transactions** — coinbase TXs create new coins and have no sender balance to validate.

**Fixes deployed (2026-07-12):**

1. **F5 Coinbase Exempt** (`V3/L1/core/src/lib.rs`):
   - `validate_peer_block()`: Added `transaction.from != "coinbase" && transaction.from != "genesis"` to F5 balance check condition
   - `insert_transaction()`: Same exempt for mempool TXs (defense-in-depth)
   - Coinbase and genesis TXs are now exempt from sender balance validation in both code paths

2. **Pool: Node Rejection Logging** (`V3/L1/pool/src/bin/server.rs`):
   - `submit_candidate_to_node()` now logs `node_rejected_block height=X nonce=Y reason=Z` when node rejects a block (previously silent — root cause was obscured)
   - Also logs `node_accepted_block height=X nonce=Y` on successful submission for full visibility

3. **Pool: Template Cache Invalidation** (`V3/L1/pool/src/bin/server.rs`):
   - `TemplateCache::invalidate()` method added
   - Called immediately after block acceptance (`block_accepted == true`) so miners get fresh template (height+1) without waiting for 3s TTL
   - Prevents miners from working on stale template after a block is found

**Result:** Node synced 3886→4035 via P2P from Node2, then accepted first pool-mined block 4036 (`node_accepted_block height=4036 nonce=21000320582`). Pool: 3100 shares, 100% accept rate, 0 rejected. AuxPow scheduler reconnected to KAS automatically.

**Commits:** `259e662be` (dashboard AuxPow panel expansion — same deploy session)

**Windows 11 GPU Miner Build Workaround (2026-06-07):**
- `cargo build --release` fails on Windows 11 because `zion-miner.exe` in `V3/target/release/` is locked (Defender/antivirus).
- **Use absolute `CARGO_TARGET_DIR` to a fresh directory:**
  ```bash
  CARGO_TARGET_DIR="/c/Users/yosef/Desktop/Zion/2.9.6-main/V3/target3" cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl
  ```
- Canonical launch script: `ZionStart/windows/start-miner-target3.bat` (reads from `V3/target3/release/`).
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

**Live vault (post hard reset 2026-07-06):** `zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7` (100M ZION genesis premine)
**Seed:** `"ZION Bridge Vault V3 Mainnet v2 2026-07-06-HARD-RESET"` (in `V3/L1/core/src/crypto.rs:BRIDGE_VAULT_SEED`)
**DO NOT change this seed** — it is tied to the new genesis vault.

**Old vault (pre-hard-reset):** `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0` (seed: `"ZION Bridge Vault V3 Mainnet"`)
This address is no longer active after the 2026-07-06 hard genesis reset.

**Bridge validators drop-in (v3.0.4):** Validator keys configured via `ZION_BRIDGE_VALIDATOR_SK_1..5` in `/root/zion/edge-environment.sh` (placeholder `<REPLACE_EVM_VALIDATOR_SK_*>` — air-gapped generation pending).
- `ZION_BRIDGE_VALIDATOR_PUBKEYS` = 5 compressed secp256k1 pubkeys (comma-separated)
- `ZION_BRIDGE_VALIDATOR_THRESHOLD` = `5`

---

## SMOS Rig + Edge Deployment (PERMANENT REFERENCE — read every session)

### Access credentials

| Resource | Value |
|---|---|
| New server SSH | `ssh zion-new` (key: `~/.ssh/zion-new-server`, ed25519) |
| New server IP | `62.171.141.136` (Ubuntu 24.04.4 LTS) |
| New server source | `/root/zion/2.9.6/` (git clone at commit `690b6dfe`) |
| New server Cargo | `source ~/.cargo/env` (Rust 1.96.1 stable) |
| New server VNC | `95.111.232.25:63061` (RFB, password `h4neV76S`) — fallback if SSH fails |
| Environment file | `/root/zion/edge-environment.sh` (chmod 600, `<REPLACE_*>` placeholders) |
| SMOS API key | `api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8` (rotated 2026-07-08) |
| SMOS API base | `https://api.simplemining.net` (header: `X-AUTH-TOKEN: <key>`) |
| SMOS rig ID | `518837` (name: ZionRig / vega-smos) |
| SMOS group ID | `1773590` (ZionLiteFire) — updated 2026-07-08 |
| Rig GPU | AMD Vega 64 (gfx900:xnack-), GCN architecture |
| Rig OS | SimpleMining OS, kernel 5.15.80-sm, **GLIBC 2.31** |
| Rig SSH | `miner@<current_ip>` password: `omnity.company@gmail.com` (IP changes, behind NAT — use SMOS API to get it) |
| Rig local IP | typically 192.168.0.x (DHCP), check via SMOS API `/rigs/518837` |
| Pool payout wallet | `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604` |
| Mining wallet (rig) | `zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3` |

### CRITICAL: GLIBC incompatibility — ALWAYS build on rig, NOT on new server

**New server runs Ubuntu 24.04 → produces binaries requiring GLIBC 2.39+.**
**SMOS rig has GLIBC 2.31 → server-built binaries WILL NOT RUN on rig.**

To verify: `strings <binary> | grep 'GLIBC_' | sort -u` — if you see `GLIBC_2.32` or higher, the binary is incompatible.

**Only valid solutions:**
1. **Build natively on the rig** (preferred) — Rust is installed on rig, build takes ~1 min
2. Cross-compile with `cargo-zigbuild` targeting `x86_64-unknown-linux-gnu.2.31` — requires zig installed on Edge

**How to build on rig:**
```bash
# Get rig IP from SMOS API first
RIG_IP=$(curl -s -H "X-AUTH-TOKEN: api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8" \
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
export ZION_POOL_ADDR=62.171.141.136:8444
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
API="api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8"
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

### New server systemd services (v3.0.4)

```bash
# Pool
systemctl status zion-pool.service
journalctl -u zion-pool.service -f

# Node
systemctl status zion-node.service
journalctl -u zion-node.service -f

# All services
systemctl status zion-node zion-pool zion-bridge zion-dao zion-warp zion-dashboard nginx

# Binary locations
/usr/local/bin/zion-node
/usr/local/bin/zion-pool-server
/usr/local/bin/zion-bridge
/usr/local/bin/zion-dao
/usr/local/bin/zion-warp-server

# After rebuild, restart pool:
systemctl restart zion-pool.service

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
Build on new server (62.171.141.136) using `V3/Dockerfile.miner-smos`:
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
http://62.171.141.136/zion-miner/zion-sm3042c-fire-v8.zip \
  --algorithm deeksha_lite_fire \
  --pool 62.171.141.136:8444 \
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

### Pool Environment (New Server v3.0.4)
File: `/root/zion/edge-environment.sh` (v3.0.4 — new server, chmod 600, `<REPLACE_*>` placeholders for air-gapped keys)
```
ZION_POOL_BIND=0.0.0.0:8444
ZION_POOL_LOOP_COUNT=1000000
ZION_NONCE_COUNT=1048576
ZION_NONCE_COUNT_GPU=524288
ZION_JOB_TTL_MS=60000
```
Restart after change: `systemctl restart zion-pool.service`
```

---

## New Server Complete Reference (v3.0.4 — 62.171.141.136)

### Server Specs

| Param | Value |
|-------|-------|
| IP | `62.171.141.136` |
| Hostname | `vmi3425821` |
| OS | Ubuntu 24.04.4 LTS |
| CPU | 4× AMD EPYC |
| RAM | 7.8 GB |
| Disk | 145 GB (6% used) |
| Rust | 1.96.1 stable (rustup) |
| Docker | 29.6.1 + Compose v5.3.1 |

### SSH Access

| Param | Value |
|-------|-------|
| Alias | `ssh zion-new` (in `~/.ssh/config`) |
| Key | `~/.ssh/zion-new-server` (ed25519) |
| Fingerprint | `SHA256:wnq2p9n17icqkpkJMAjPZto0axRtkVTVXPMBuD9tz64` |
| Password auth | DISABLED (keys only) |
| VNC fallback | `95.111.232.25:63061` (RFB, password `h4neV76S`) |

### Firewall (UFW)

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | Anywhere | SSH |
| 80 | TCP | Anywhere | HTTP (nginx redirect) |
| 443 | TCP | Anywhere | HTTPS (nginx SSL) |

All other ports (8333, 8444, 8453) are **not** in UFW — they bind to 0.0.0.0 but are blocked by firewall. P2P (8333) and Pool (8444) need UFW ALLOW when miners/peers connect from public internet.

### fail2ban

- Jail: `sshd` — SSH brute-force protection
- Status: `fail2ban-client status sshd`

### Genesis (v3.0.4 Hard Reset)

| Param | Value |
|-------|-------|
| Genesis hash | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |
| Premine | 16,780,000,000 ZION |
| Block reward | 5400.067 ZION |
| Mining emission | 127,220,000,000 ZION |
| Fee split | 89% miner / 5% humanitarian / 5% issobella / 1% burn |
| Bridge vault seed | `"ZION Bridge Vault V3 Mainnet v2 2026-07-06-HARD-RESET"` |
| Migration height | 1 (fresh chain, `ZION_MIGRATION_HEIGHT=1`) |

### Binaries (in `/usr/local/bin/`)

| Binary | Source | Size |
|--------|--------|------|
| `zion-node` | `cargo build --release -p zion-core --bin node` | 2.96 MB |
| `zion-pool-server` | `cargo build --release -p zion-pool --bin server` | 2.35 MB |
| `zion-bridge` | `cargo build --release -p zion-bridge` | 10.1 MB |
| `zion-dao` | `cargo build --release -p zion-dao` | 5.47 MB |
| `zion-warp-server` | `cargo build --release -p zion-warp` | 9.23 MB |

### Data Directories

| Path | Content |
|------|---------|
| `/data/zion/state/` | Node blockchain state |
| `/data/zion/bridge-mainnet.db` | Bridge relay SQLite DB |
| `/data/zion/dao-mainnet.db` | DAO scanner SQLite DB |
| `/root/zion/2.9.6/` | Git repo (clone at commit `690b6dfe`) |
| `/root/zion/edge-environment.sh` | Environment file (chmod 600) |
| `/root/zion-web-next/` | Next.js web source + Dockerfile + docker-compose.yml |
| `/root/zion-dashboard/` | ZION_OS dashboard (Python) |

### Config Files

| Config | Path | Purpose |
|--------|------|---------|
| Bridge | `/root/zion/2.9.6/V3/L2/bridge/config/bridge-mainnet.toml` | Bridge relay config (6 EVM chains, DB path `/data/zion/bridge-mainnet.db`) |
| DAO | `/root/zion/2.9.6/V3/L2/dao/config/dao-mainnet.toml` | DAO config (DB path `/data/zion/dao-mainnet.db`) |
| WARP | `/root/zion/2.9.6/V3/L3/warp/config/warp-mainnet.toml` | WARP relay config |
| Nginx | `/etc/nginx/sites-available/zion` | Reverse proxy + SSL + security headers |
| Environment | `/root/zion/edge-environment.sh` | All env vars (chmod 600) |

### Environment Variables (`edge-environment.sh`)

Key variables (no `export` prefix — systemd `EnvironmentFile` format):

```
# L1 Node
ZION_NODE_ID="zion-new-mainnet-primary"
ZION_NODE_STATE_PATH="/data/zion/state"
ZION_P2P_BIND="0.0.0.0:8333"
ZION_RPC_BIND="127.0.0.1:8443"
ZION_WEBSOCKET_BIND="127.0.0.1:8445"
ZION_METRICS_BIND="127.0.0.1:9100"
ZION_SEED_PEERS="127.0.0.1:8333"
ZION_MIGRATION_HEIGHT=1

# Pool
ZION_POOL_BIND="0.0.0.0:8444"
ZION_POOL_SK="<REPLACE_POOL_SK>"

# Bridge
ZION_BRIDGE_CONFIG="/root/zion/2.9.6/V3/L2/bridge/config/bridge-mainnet.toml"
ZION_BRIDGE_DB="/data/zion/bridge-mainnet.db"
ZION_BRIDGE_VALIDATOR_SK_1..5="<REPLACE_EVM_VALIDATOR_SK_*>"

# DAO
DAO_CONFIG="/root/zion/2.9.6/V3/L2/dao/config/dao-mainnet.toml"
ZION_DAO_BIND="127.0.0.1:8450"
ZION_DAO_DB="/data/zion/dao-mainnet.db"
ZION_DAO_GUARDIAN_SK_1..7="<REPLACE_GUARDIAN_SK_*>"

# WARP
ZION_WARP_CONFIG="/root/zion/2.9.6/V3/L3/warp/config/warp-mainnet.toml"
ZION_WARP_DB="/data/zion/warp.db"

# Logging
RUST_LOG=info
ZION_LOG_BLOCK_SUBMITTER=1
```

### Docker

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `zion-web-next` | `zion-web:nextjs` | 127.0.0.1:3001 | Next.js 16.2.9 web (73+ routes) |
| (fallback) | `zion-web:maintenance` | 127.0.0.1:3000 | Maintenance page (nginx:alpine) |

**Docker compose:** `/root/zion-web-next/docker-compose.yml`
- `restart: unless-stopped`
- `read_only: true` (maintenance image only)
- tmpfs for nginx cache

### Nginx Reverse Proxy

| Domain | Upstream | SSL Cert |
|--------|----------|----------|
| `zionterranova.com` | `127.0.0.1:3001` (Next.js) | Let's Encrypt (zionterranova.com + www) |
| `dashboard.zionterranova.com` | `127.0.0.1:8766` (Dashboard) | Let's Encrypt (dashboard.zionterranova.com) |
| `/api/rpc` | `127.0.0.1:8443` (node RPC) | (via main domain) |
| `/api/dao` | `127.0.0.1:8450` (DAO API) | (via main domain) |

**Security headers:** HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
**HTTP/2:** enabled
**HTTP→HTTPS redirect:** enabled

### Monitoring

| Job | Interval | Script | Purpose |
|-----|----------|--------|---------|
| Forged TX monitor | 5 min | `/usr/local/bin/zion-monitor-forged.sh` | Scan node logs for forged/invalid signature |
| Height monitor | 5 min | `/usr/local/bin/zion-monitor-height.sh` | Check RPC reachable, auto-restart node if down |
| P2P alert | 2 min | `/usr/local/bin/zion-monitor-p2p.sh` | Alert on high P2P connection rate |
| Watchdog | 2 min | `/usr/local/bin/zion-watchdog.sh` (systemd timer) | RPC + TCP health, auto-restart |

### SSL Certificates (Let's Encrypt)

| Domain | Cert Path | Expiry | Auto-renew |
|--------|-----------|--------|------------|
| `zionterranova.com` + `www.zionterranova.com` | `/etc/letsencrypt/live/zionterranova.com/` | 2026-10-05 | ✅ |
| `dashboard.zionterranova.com` | `/etc/letsencrypt/live/dashboard.zionterranova.com/` | 2026-10-05 | ✅ |

### Dashboard Access

| Param | Value |
|-------|-------|
| URL | `https://dashboard.zionterranova.com` |
| Auth | HTTP Basic Auth (handled by `app.py`) |
| User 1 | `Yose` (password: `3nityOne13`) |
| User 2 | `Issy` (password: `3nityOne13`) |
| Title | "ZION Mainnet — Launch Command Center" |

### Deploy Files (in repo)

All deploy files are in `V3/deploy/new-server/`:

| File | Purpose |
|------|---------|
| `edge-environment.sh` | Environment template (chmod 600, `<REPLACE_*>` placeholders) |
| `zion-node.service` | systemd unit for zion-node |
| `zion-pool.service` | systemd unit for zion-pool |
| `zion-bridge.service` | systemd unit for zion-bridge |
| `zion-dao.service` | systemd unit for zion-dao |
| `zion-warp.service` | systemd unit for zion-warp |
| `zion-watchdog.sh` | Health check script |
| `zion-watchdog.service` | systemd oneshot for watchdog |
| `zion-watchdog.timer` | systemd timer (2-min interval) |

### Common Operations

```bash
# SSH
ssh zion-new

# Check all services
systemctl is-active zion-node zion-pool zion-bridge zion-dao zion-warp zion-dashboard nginx

# Check chain height
curl -s http://127.0.0.1:8443/jsonrpc -d '{"jsonrpc":"2.0","method":"getSupplyInfo","id":1}' | python3 -c "import sys,json; d=json.load(sys.stdin)['result']; print(f'height={d[\"height\"]} supply={d[\"circulating_supply_zion\"]:,}ZION')"

# Check genesis hash
journalctl -u zion-node --no-pager -n 50 | grep tip_hash_hex | tail -1

# Restart web (Docker)
cd /root/zion-web-next && docker compose restart

# Rebuild web from source
cd /root/zion-web-next && docker compose down && docker compose build --no-cache && docker compose up -d

# Switch to maintenance page
cd /root/zion-web && docker compose up -d  # starts maintenance container on :3000
# Then update nginx to proxy to :3000 instead of :3001

# View logs
journalctl -u zion-node -f
journalctl -u zion-pool -f
docker logs zion-web-next -f

# Update environment
vi /root/zion/edge-environment.sh
systemctl daemon-reload
systemctl restart zion-node zion-pool zion-bridge zion-dao zion-warp

# Rebuild binaries after code change
cd /root/zion/2.9.6 && source ~/.cargo/env
cargo build --release -p zion-core --bin node -p zion-pool --bin server -p zion-bridge -p zion-dao -p zion-warp
cp V3/target/release/node /usr/local/bin/zion-node
cp V3/target/release/server /usr/local/bin/zion-pool-server
cp V3/target/release/zion-bridge /usr/local/bin/zion-bridge
cp V3/target/release/zion-dao /usr/local/bin/zion-dao
cp V3/target/release/zion-warp-server /usr/local/bin/zion-warp-server
systemctl restart zion-node zion-pool zion-bridge zion-dao zion-warp
```