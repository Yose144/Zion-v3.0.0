# ZION — External Audit Package (commit manifest + reproducible build)

> **Status:** prepared for operator hand-off — auditors NOT yet engaged (👤 selects firm, budget, NDA, kickoff)
> **Companion docs:** `EXTERNAL_AUDIT_SCOPE.md` (v2.0 scope), `SECURITY_AUDIT_3.2.md` + `REPORTS/INTERNAL_AUDIT_2026-10-05.md` (baseline findings)
> **Generated:** 2026-10-21

---

## 1. Pinned commit manifest

| Item | Value |
|---|---|
| Repository | `github.com/Yose144/Zion-v3.0.0` (public mirror is a subset — auditors should work from the full tree) |
| Branch | `main` |
| Pinned HEAD | `adfbd4f2a78dc0220c2318dcab683632a7801dc5` |
| Short | `adfbd4f2a` |

**Production-relevant commits included in HEAD:**

| Commit | Content |
|---|---|
| `2b20217c4` | Pool L1 RPC timeout 4s→12s (`ZION_L1_RPC_TIMEOUT_MS`), pool-side pre-orphan removal, watchdog 15s/2f→30s/3f; G8 stall RCA + disk audit reports |
| `94f785035` | `zion-ncl` daemon binary + SQLite job persistence + systemd unit |
| `b659224a0` | `scripts/prl-payout-review.sh` PRL payout readiness audit |
| `adfbd4f2a` | Checklist updates (EDGE2 topology guard, QV/map verified live) |

**⚠️ Deployed-vs-source divergence auditors must know:**
- Old-Edge pool binary is built from worktree `/root/build/pool-F5`, not `/opt/zion` checkout (the latter is a stale pre-PoolNG tree). After EDGE2 cutover all builds originate on EDGE2 from a clean checkout — `INFRA-SPLIT-PLAN.md`.
- `zion-v31-ncl` on old Edge is a stopgap deployment; P3 migrates it to EDGE2.

## 2. Reproducible build procedure

```bash
# Toolchain (no rust-toolchain.toml pinned — record used version)
rustc 1.95.0 (59807616e 2026-04-14) · cargo 1.95.0
# Host: Ubuntu 24.04, x86_64, glibc 2.39

git clone <repo> && cd Zion-v3.0.0 && git checkout adfbd4f2a
cd V31

# Full workspace check (fast)
cargo check --workspace --locked

# Production binaries
cargo build --release --locked -p zion-node      # L1 node
cargo build --release --locked -p zion-pool      # stratum pool (F6 failover + 12s timeout)
cargo build --release --locked -p zion-miner     # miner (CPU; GPU kernels need CUDA/OpenCL/Metal SDKs)
cargo build --release --locked -p warpd          # multichain/WARP daemon
cargo build --release --locked -p zion-ncl       # NCL job daemon
cargo build --release --locked -p zion-free-world
cargo build --release --locked -p zion-cli

# Test suites (currently green on amd64)
cargo test -p zion-pool          # 333 passed
cargo test -p zion-ncl           # 42 passed

# Web app
cd APP&WEB/website-v2.9
npm ci && npm run build          # Next.js 16.2.9, output: standalone
```

**Notes for reproducibility:**
- `Cargo.lock` is committed — use `--locked`.
- GPU kernels (`*.cu`/`*.cl`/`*.metal`) are compiled at runtime via NVRTC/driver; audit the sources in `V31/L1/miner/csrc/` and `src/gpu/kernels/`.
- WASM/site builds are NOT bit-reproducible yet (no pinned Node toolchain) — flag in scope as ops finding if required.

## 3. Scope size — measured at pinned HEAD (non-blank lines)

| Area | Lines |
|---|---:|
| L1 core (`V31/L1/core/src`) | 29,736 |
| L1 cosmic-harmony (PoW) | 9,658 |
| L1 pool | 27,070 |
| L1 miner (Rust src) | 54,801 |
| L1 miner GPU kernels (.cu/.cl/.metal) | 64,585 |
| L2 multichain | 49,007 |
| L2 DAO | 9,276 |
| L3 ai-native / ncl | 15,576 / 2,088 |
| L4 oasis / L5 free-world / L6 issobella | 8,656 / 2,782 / 2,105 |
| Web API routes (`website-v2.9/src/app/api`) | 9,447 |
| ZIS identity TS (`APP&WEB/identity`, excl. generated) | 5,091 |
| Solidity live contracts (`contracts/src` + `V31/contracts`) | 4,934 |

Changes vs scope doc v2.0 (`29a6b8a8a`): pool +12.4k (Pool NG F1–F6 + PRL/QTC legs), miner +19k, ncl +0.8k (daemon). Re-verify before kickoff if HEAD moves.

## 4. Updated known-issue baseline (verify these)

Carried over from scope v2.0, plus new items since:

1. `MAX_REORG_DEPTH` still has three values (10 / 64 / 500) — reconcile.
2. DAO premine `unlock_height` 144,000 vs admin-lock-only premine outputs.
3. **NEW — pool submit path (2026-10-21):** pre-orphan check removed by design — node consensus now decides validity of `submitBlock`. Auditor should confirm no DoS/amplification surface (submit flood → node validation cost).
4. **NEW — watchdog policy:** `getTemplate` timeout 30 s / 3 consecutive fails triggers node restart (configurable). Verify restart logic cannot be gamed into a restart loop.
5. **NEW — BTC swap feature-disabled:** `WARP_BTC_SWAP_ENABLED=0` on prod; signed-quote path (`btc_swap.rs`, ed25519, `WARP_BTC_SWAP_OFFER_KEY` + `_PREV` rotation, outstanding caps) is dormant — audit before mainnet pilot.
6. **NEW — PRL payout dry-run:** `PRL_PAYOUT_ENABLED=1, DRY_RUN=1`, revenue oracle watching oyster; zero PRL miners so far → payout path untested with real volume. QTC payouts deferred (treasury_free=0).
7. **NEW — NCL daemon:** persistence + scheduler use first-eligible-worker (no shared live reputation registry — by design, documented in `zion-ncl.rs`).

## 5. Ops facts auditors need

- Production topology is mid-migration old Edge → EDGE2 (`INFRA-SPLIT-PLAN.md`); audit the target-state units in `edge-deploy/systemd/`.
- Secrets live in `/etc/zion/edge-environment.sh` (not in repo) — verify handling, not contents.
- UFW allowlists (not SSH tunnels) for cross-host RPC per split plan.
