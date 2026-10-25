# ZION — External Audit Package (commit manifest + reproducible build)

> **Status:** prepared for operator hand-off — auditors NOT yet engaged (👤 selects firm, budget, NDA, kickoff)
> **Companion docs:** `EXTERNAL_AUDIT_SCOPE.md` (v2.0 scope), `SECURITY_AUDIT_3.2.md` + `REPORTS/INTERNAL_AUDIT_2026-10-05.md` (baseline findings)
> **Generated:** 2026-10-25 — **re-pinned to current HEAD** (previous pin `663c10be2` was 169 commits behind; post-pin history includes the ZIS rewrite, pearl PoUW, pool/outbox rework and contract-tree changes, so a fresh baseline was required)

---

## 1. Pinned commit manifest

> **⚠️ History rewrite 2026-10-21:** the repository history was rewritten with `git filter-repo` to purge committed build/backup artifacts (`V3/target2..target4`, `V3/target-check`, `V3/target-vega-fix`, `scripts/finetune/outputs`, `ZION_OS/dashboard/infra/target`, `BACKUP/`). All commit IDs after those points changed. Auditors holding SHA references from earlier revisions must re-resolve them against current `main` — the full old→new mapping is committed at [`docs/3.2/ops/SHA-REMAP-2026-10-21.json`](ops/SHA-REMAP-2026-10-21.json) (711 commits).

| Item | Value |
|---|---|
| Repository | `github.com/Yose144/Zion-v3.0.0` (public mirror is a subset — auditors should work from the full tree) |
| Branch | `main` |
| Pinned HEAD | `63d29ff567c65b22f21310f1a21a1972062f5c07` |
| Short | `63d29ff56` |
| Supersedes | `ebde4bd2af333ca0063f1bc0c6ed614268c52565` (+4 commits: ZIS secret removal, IA-17 API scrub, warning cleanup, wallet.ts hardening) |

**Production-relevant commits in the +169 delta (highlights):**

| Commit | Content |
|---|---|
| `edb7ddbaf` | Pool L1 RPC timeout 4s→12s, pre-orphan removal, watchdog 15s/2f→30s/3f (carried from previous pin) |
| ZIS hardening 21.10 | `apps/identity` full rewrite — EdDSA/Ed25519 JWT + JWKS, DB-backed challenges/sessions, audit log, admin API, `/metrics` |
| Pearl PoUW | v13 packed-k kernels promoted default on SM80+, `pearl_gateway`/`pearl_upstream` in pool |
| Pool/PPLNS | `v3_pplns` native-coin legs, coin-revenue oracle + SQLite outbox, `pearl_gateway`, `qtc_native`, stratum v3/ZIS binding |
| Multichain | warp btc_swap rework, `prl_payout`/`qtc_payout` durable-outbox sweepers, evm/quantus/solana adapter refreshes |
| `b1d9e2118` | Alpha→beta (3.2.0-beta.1), repo F0–F6 cleanup, `PUBLIC/` → `archive/PUBLIC` |
| `ebde4bd2a` | **Audit remediations:** IA-13 AEAD preimage store, IA-14 durable payout ledger, IA-18 pool dedup |
| vendored deps commit | **IA-22:** `contracts/lib/` minimal subtrees vendored → `git archive` exports reproduce `forge build`/`forge test` offline |
| `f0b129c16` | **ZIS hardening:** `'change-me-in-production'` HS256 default removed — `JWT_PRIVATE_KEY` or `JWT_SECRET` now required; EdDSA cookie secret derived from private key (domain-separated SHA-256) |
| `b49494ed9` | **IA-17/IA-05:** public API scrub — private/loopback peers masked, `error.message` no longer echoed (transport errors embed internal RPC URLs), `ncl/status` POST requires `ZION_NCL_STATUS_KEY` |
| `ddf56ca30` | Warning cleanup — workspace compiles warning-free |
| `63d29ff56` | **ZIS wallet.ts:** integer-amount validation (BigInt throw → 400 not 500), order-cache userId guard |

**⚠️ Deployed-vs-source divergence auditors must know:**
- Old-Edge pool binary is built from worktree `/root/build/pool-F5`, not `/opt/zion` checkout. EDGE2 services are built from clean checkouts on EDGE2 — `INFRA-SPLIT-PLAN.md`.
- The remediation commits (`ebde4bd2a`…`63d29ff56` + vendored-deps) are **source-only at pin time** — not deployed to production services.
- `zion-v31-ncl` on old Edge is a stopgap deployment; P3 migrates it to EDGE2.

## 2. Reproducible build procedure

```bash
# Toolchain (no rust-toolchain.toml pinned — record used version)
# Production binaries: rust:1.97-bullseye container (glibc 2.30 constraint)
# Package verified with: rustc 1.95.0 + cargo 1.95.0, also checked on 1.90 (macOS, dev)
# Host: Ubuntu 24.04, x86_64, glibc 2.39

git clone <repo> && cd Zion-v3.0.0 && git checkout 63d29ff567c65b22f21310f1a21a1972062f5c07
cd V31

# Full workspace check (fast) — verified green at pin
cargo check --workspace --locked

# Production binaries
cargo build --release --locked -p zion-node      # L1 node
cargo build --release --locked -p zion-pool      # stratum pool (F6 failover + 12s timeout)
cargo build --release --locked -p zion-miner     # miner (CPU; GPU kernels need CUDA/OpenCL/Metal SDKs)
cargo build --release --locked -p warpd          # multichain/WARP daemon
cargo build --release --locked -p zion-ncl       # NCL job daemon
cargo build --release --locked -p zion-free-world
cargo build --release --locked -p zion-cli

# Test suites (verified at pin)
cargo test -p zion-pool --lib       # 345 passed (incl. payout_ledger_survives_restart)
cargo test -p zion-multichain --lib # 744 passed, 4 ignored

# Contracts — buildable from a bare `git archive` export since IA-22:
cd V31/L2/multichain/contracts
forge build && forge test            # 48 passed; OZ contracts/ + forge-std src/ vendored in-tree

# Web app
cd apps/website-v2.9
npm ci && npm run build          # Next.js 16.2.9, output: standalone
```

**Notes for reproducibility:**
- `Cargo.lock` is committed — use `--locked`.
- `new_chacha20poly1305` dep added in `ebde4bd2a` — lockfile updated in the same commit.
- GPU kernels (`*.cu`/`*.cl`/`*.metal`) are compiled at runtime via NVRTC/driver; audit the sources in `V31/L1/miner/csrc/` and `src/gpu/kernels/`.
- WASM/site builds are NOT bit-reproducible yet (no pinned Node toolchain) — flag in scope as ops finding if required.
- Other foundry projects (`archive/*`, `apps/MarketPlace`) still do not build from archives — out of external scope; only `V31/L2/multichain/contracts` is in-scope and was fixed.

## 3. Scope size — measured at pinned HEAD `63d29ff56` (figures from `ebde4bd2a` re-measurement; the +4 delta touches only the rows noted)

Method: `git grep -c . HEAD -- <path>` (non-blank lines of tracked files), summed per area.

| Area | Lines | Path measured |
|---|---:|---|
| L1 core | 29,769 | `V31/L1/core/src` |
| L1 cosmic-harmony (PoW) | 10,767 | `V31/L1/cosmic-harmony/src` |
| L1 pool | 28,340 | `V31/L1/pool/src` |
| L1 miner (Rust src) | 56,510 | `V31/L1/miner/src` |
| L1 miner GPU kernels | 64,329 | `*.cu/.cl/.metal` under `V31/L1/miner` |
| L2 multichain | 49,672 | `V31/L2/multichain/src` |
| L2 DAO | 9,276 | `V31/L2/dao/src` |
| L3 ai-native | 15,675 | `V31/L3/ai-native/src` |
| L3 ncl | 2,088 | `V31/L3/ncl/src` |
| L4 oasis | 8,662 | `V31/L4/oasis/src` |
| L5 free-world | 2,782 | `V31/L5/free-world/src` |
| L6 issobella | 2,113 | `V31/L6/issobella/src` |
| Web API routes | 9,501 | `website-v2.9/src/app/api` |
| ZIS identity TS | 3,769 | `apps/identity/src` (source only) |
| Solidity live | 6,109 | `V31/L2/multichain/contracts/src` + `V31/contracts` (excl. vendored `lib/`) |

Changes vs previous pin (`663c10be2`): cosmic-harmony +1,109; pool +1,270 (pearl gateway/upstream, qtc_native, outbox); miner +1,705; multichain +670 (warp rework, payout sweepers); ai-native +99; issobella +8; identity **−1,361** (rewrite is leaner: EdDSA lib extraction); Solidity +1,175 (dex/evm split dirs). Vendored `contracts/lib/` is dependency material, not authored scope.

## 4. Updated known-issue baseline (verify these)

**Remediated since the previous pin (source-only at pin time, undeployed):**

- ~~IA-13~~ **FIXED** — XOR "encryption" of HTLC preimages → ChaCha20-Poly1305 AEAD (`enc1:` format, random nonce, `ZION_HTLC_PREIMAGE_KEY`); legacy `enc:` rows decode + migrate on write. Tamper/wrong-key fail closed. **BTC swap remains disabled** (`WARP_BTC_SWAP_ENABLED=0` on prod env, verified 2026-10-25) — enable only after external review of the full swap path.
- ~~IA-14~~ **FIXED** — pool payout idempotency now durable: `<state_path>.payouts.json` sidecar persists `paid_block_heights`/`sent_payouts`/`pending_payouts` on every mutation; restored at start. Semantics: **at-most-once** — a crash between node-accept and mark-sent cannot re-pay (height guard survives); residual = a payout lost in that window requires operator re-trigger (by design: lost payout recoverable, duplicated payout not).
- ~~IA-18~~ **FIXED** — `DexRouter::add_pool` idempotent by pool id; double-load (warpd + ApiServer) no longer duplicates `/v1/swap/pools`.
- ~~IA-22~~ **FIXED (in-scope project)** — `V31/L2/multichain/contracts/lib/` minimal subtrees vendored (`oz contracts/`, `forge-std src/`, ~3.5 MB); `git archive` → `forge build`/`forge test` verified. Other foundry projects (archive/*, MarketPlace) remain non-building from exports — out of scope.
- ~~IA-16~~ **VERIFIED FIXED on hosts** — zero `.bak` files under `sites-enabled` on Edge and EDGE2 (2026-10-25 re-check).

**Carried over / still open:**

1. `MAX_REORG_DEPTH` still has three values (10 / 64 / 500) — reconcile.
2. DAO premine `unlock_height` 144,000 vs admin-lock-only premine outputs.
3. Pool submit path: pre-orphan check removed by design — node consensus decides `submitBlock` validity. Confirm no DoS/amplification surface (submit flood → node validation cost).
4. Watchdog policy: `getTemplate` timeout 30 s / 3 consecutive fails → node restart. Verify restart logic cannot be gamed into a restart loop.
5. BTC swap dormant path: signed-quote flow (`btc_swap.rs`, ed25519 `WARP_BTC_SWAP_OFFER_KEY`+`_PREV`, outstanding caps) — **reviewed post-pin: state machine sound** (CLTV ordering correct both directions, `zion_blocks > margin` enforced for ZionToBtc, on-chain verification of counterparty ZION lock before counter-lock, idempotent coordinator, crash-recovery, AEAD preimage at rest). Minor: `BtcToZion` offer accepts a near-future `zion_timeout_ts` (only `> now` required) — fails safely at LockZion if expired, but a minimum-duration check would be cleaner. Still gated `WARP_BTC_SWAP_ENABLED=0` — audit before mainnet pilot stands.
6. PRL payout dry-run: `PRL_PAYOUT_ENABLED=1, DRY_RUN=1` (verified on EDGE2 env 2026-10-25); durable drain→ledger→ack protocol now in place; zero real PRL volume sent. QTC payouts deferred (treasury_free=0). **Note:** drained entries below `min_units` are ledgered as `dust` and ACKed — permanently dropped by design; confirm acceptable.
7. NCL daemon: first-eligible-worker scheduling (no live reputation registry — by design).
8. **ZIS identity review notes (post-pin rewrite):**
   - ~~`keys.ts` `'change-me-in-production'` HS256 fallback~~ — **fixed `f0b129c16`**: no default secret exists; `JWT_PRIVATE_KEY` or `JWT_SECRET` required; EdDSA cookie secret derived from private key; tests assert missing-config failure.
   - Quantus/pearl account-link attestation proves **ZION-key ownership only** (ZION key signs `challenge\n<chain>:<addr>`); the claimed external-chain address itself is not proven (`zion-l1` links are proven — `verifyEd25519` derives pubkey→address). Current consumers resolve the user's *own* wallet address (`server.rs` wallet_address) or check `can_act_as_zion_address` for zion-l1 only, so impact today is limited: **address squatting** — an attacker can link a victim's QTU/PRL address first, and the `address`-unique `linkedAddresses` row permanently blocks the real owner (409 CONFLICT). **Must be resolved before any flow treats linked QTU/PRL addresses as ownership proof** (rewards claims, payout attribution). Fix direction: require an on-chain proof or a signature under the external-chain key.
   - Sessions are DB-backed with `jti↔sub` binding + revocation — verified correct in `lib/auth.ts`.
   - `admin.ts` — clean: all routes behind `requireAdmin`, allowlisted selects, last-admin lockout + self-delete guards, audit events.
   - `wallet.ts` — **fixed `63d29ff56`**: non-numeric `amount` threw unhandled `BigInt` → 500 (now 400 via zod); order-cache upserts now guard `userId` on orderId collision.
9. **Pool payout sweep ordering:** `take_pending_payouts` persists the drain *before* the batch tx submission — at-most-once by design (see IA-14 note). External sweeps (`prl_payout`/`qtc_payout`) use the SQLite outbox with ledger-before-ACK — verified consistent.
10. ~~Ignored `Result` in `server.rs` `p.restore()`~~ — fixed `ebde4bd2a`; compiler warnings all cleaned `ddf56ca30` (workspace now warning-free).
11. **IA-17 public-response leaks — remediated `b49494ed9`:** `blockchain/peers` masks private/loopback peers (counted, addresses hidden); `network` returns generic `unreachable` instead of raw `error.message` (leaked `ECONNREFUSED 127.0.0.1:port`); `ncl/status` scrubs loopback in proxied JSON + POST gated by `ZION_NCL_STATUS_KEY` (IA-05 defense-in-depth — nginx remains the external block) and no longer echoes fs paths; `wallet/qtc/prl/health/defi/cex/verify-message/tx/block` no longer echo `error.message` (transport errors embed internal RPC URLs) — real errors still logged server-side. **Env note:** `ZION_NCL_STATUS_KEY` is unset on EDGE2 → POST currently denied by default (fail-closed); set it if a legitimate writer exists.
12. Operator-owned items unchanged: IA-07 carrier /16 allowlists (CGNAT), IA-08 plaintext secrets in same-host backups / no off-site copy, IA-09 burned keys in public history pending revocation, IA-10 ops details in public repo, IA-19 chain-liveness single-miner dependency (G8 run #4 pending).

## 5. Ops facts auditors need

- Production topology is mid-migration old Edge → EDGE2 (`INFRA-SPLIT-PLAN.md`); audit the target-state units in `edge-deploy/systemd/`. **EDGE2 is now the primary + web ingress** (apex cutover 2026-10-22).
- Secrets live in `/etc/zion/edge-environment.sh` (not in repo) — verify handling, not contents.
- UFW allowlists (not SSH tunnels) for cross-host RPC per split plan.
- Nginx hazard confirmed fixed but worth a regression check in any deployment audit: `.bak` files inside `sites-enabled/` are parsed by the wildcard include (historical copies live in `/etc/nginx/backups/`).
- `/vast-rigs/status.json` on EDGE2 is refreshed by `zion-vastrigs-sync.timer` pulling `127.0.0.1:8088/api/status` over the existing reverse tunnel (installed 2026-10-25).
