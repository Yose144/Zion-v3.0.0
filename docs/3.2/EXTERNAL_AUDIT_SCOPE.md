# ZION 3.2 "One Love" — External Security Audit Scope (DRAFT)

> **Version:** 2.2 (measurements refreshed 2026-10-25 against `4108a52d0`) · **Status:** DRAFT — **not sent; no audit firm selected or engaged**
> **Contact / SLA:** _to be filled in by the operator before sending_ (v1.0 contained an invented address and SLA — withdrawn)
> **Repository:** https://github.com/Yose144/Zion-v3.0.0 (public) — **pinned source commit `4108a52d0b47702dd97fbd1d6f4919ceb1aca6a4`** (see `AUDIT_PACKAGE.md`; the subsequent manifest commit is documentation-only)

---

## 1. System overview

ZION is a Layer-1 blockchain: UTXO/hybrid transaction model, Ed25519 signatures, custom PoW "Ekam Deeksha". The mainnet is live in Beta. Services run on two production hosts (EDGE2 = primary + web ingress, Edge = pool + ops followers, split completed 2026-10-22 — see `INFRA-SPLIT-PLAN.md`):

- three L1 nodes (one primary, two followers)
- the mining pool
- the multichain/WARP daemon
- DAO, ZIS identity, L3–L6 services
- the Next.js web app behind nginx

**Requested scope: the whole project.** Areas are listed below by priority.

## 2. In scope

| # | Component | Layer | Lang | Paths |
|---|---|---|---|---|
| 1 | Consensus, block/tx validation, UTXO, premine and admin-unlock rules, difficulty | L1 | Rust | `V31/L1/core/src/` (`chain_state.rs`, `node.rs`, `v3_compat.rs`, `genesis.rs`, `utxo.rs`, `v3_tx.rs`) |
| 2 | P2P sync, reorg/rollback, mempool | L1 | Rust | `V31/L1/core/src/p2p.rs`, `v3_p2p.rs`, `node.rs` (`rollback_to_height`), `storage.rs` |
| 3 | PoW implementation and miner kernels (CPU/CUDA/OpenCL/Metal KAT parity) | L1 | Rust/C/CUDA/OpenCL | `V31/L1/cosmic-harmony/`, `V31/L1/miner/` (excluding vendored `csrc/ref/`) |
| 4 | Mining pool: stratum, share validation, vardiff, PPLNS, payouts | L1 | Rust | `V31/L1/pool/src/` |
| 5 | Multichain API authorization and operator routes | L2 | Rust | `V31/L2/multichain/src/server.rs`, `rate_limit.rs`, `zis_auth.rs` |
| 6 | Bridge, HTLC, DEX/intents/solvers, WARP runtime + BTC swap (feature disabled) | L2 | Rust | `V31/L2/multichain/src/bridge/`, `swap/htlc.rs`, `swap/dex/`, `warp/` |
| 7 | Custodial wallet, deposit/withdrawal ledger, reconciliation, solvency | L2 | Rust | `V31/L2/multichain/src/multichain_wallet/`, `wallet/`, `reconciliation.rs`, `solvency.rs` |
| 8 | DAO service and treasury lock | L2 | Rust | `V31/L2/dao/` |
| 9 | ZIS identity: sessions, WebAuthn/passkeys, API keys | — | TypeScript | `apps/identity/` |
| 10 | Public web API routes and proxies | — | TypeScript | `apps/website-v2.9/src/app/api/` |
| 11 | L3 AI-native API + RAG (public chat proxy, prompt-injection and data exposure) | L3 | Rust | `V31/L3/ai-native/`, `V31/L3/ncl/` |
| 12 | L4 OASIS, L5 Free World (projects, quadratic voting), L6 Issobella services | L4–L6 | Rust | `V31/L4/oasis/`, `V31/L5/free-world/`, `V31/L6/issobella/` |
| 13 | Contracts (bridge token, DEX, intent settlement) | L2 | Solidity | `V31/L2/multichain/contracts/src/`, `V31/contracts/` |
| 14 | Deployment and operations: nginx, systemd units, backups, secret handling, build reproducibility, dependencies | ops | — | `V31/deploy/`, `ZION_OS/infra/scripts/`, `scripts/ops/`, lockfiles |

**Out of scope (unless requested):**

- mobile app, MarketPlace, desktop agent UI
- `archive/`, `public/` mirror
- marketing pages (non-API)

## 3. Measured size (nonempty tracked text lines incl. inline tests, commit `4108a52d0`)

| Area | Lines |
|---|---:|
| L1 core | 29,769 |
| L1 cosmic-harmony (PoW) | 10,742 |
| L1 pool | 28,649 |
| L1 miner (tracked src) | 56,510 |
| L1 miner GPU kernels (excluding vendored reference) | 64,141 |
| L2 multichain | 52,953 |
| L2 DAO | 9,276 |
| L3 ai-native / ncl | 15,675 / 2,088 |
| L4 / L5 / L6 | 8,662 / 2,782 / 2,113 |
| Web API routes (`apps/website-v2.9/src/app/api`) | 9,501 |
| ZIS identity (`apps/identity/src`) | 3,796 |
| Authored contract trees (excl. vendored `lib/`) | 6,109 |

Exact path boundaries and commands are documented in `AUDIT_PACKAGE.md` §3. Rows can overlap and are not a unique LOC total; the contract-tree count is not a Solidity-only count. These measurements supersede carried-forward values in older versions.

## 4. Baseline: known issues the auditor should verify

1. `docs/3.2/SECURITY_AUDIT_3.2.md`: internal audit of 2026-08/09, 44 findings.
   - Re-classified by the internal audit of 2026-10-05: FIND-002 is *partially fixed*; POL-002 is *partially verified*.
2. `docs/3.2/REPORTS/INTERNAL_AUDIT_2026-10-05.md`: whole-project internal audit, findings IA-01…IA-22. These include:
   - multichain/WARP authorization fixes
   - ZIS session-binding fix and secret rotation
   - P2P fork-choice fix
   - open operator items: allowlists, backups, secrets in history, dependencies
   - **Source remediations at `ebde4bd2a`:** IA-13 (AEAD), IA-18 (DEX pool dedup), IA-22 (vendored contract dependencies). **IA-14 is partially remediated/reopened:** best-effort sidecar writes and fail-open loading do not establish unconditional at-most-once payout safety.
3. Constants the auditor should reconcile:
   - ~~Three different `MAX_REORG_DEPTH` values exist: 10 (`v3_chain.rs`, V3-compat path), 64 (`p2p.rs`, native sync), 500 (`node_runtime.rs`).~~ Resolved 31.10.: single definition site `v3_chain.rs` — `MAX_REORG_DEPTH=10` (v3 rollback), `P2P_SYNC_WALK_LIMIT=64` (ancestor search), `NATIVE_MAX_REORG_DEPTH=500` (native exec cap, re-exported as `MAX_REORG_DEPTH` via node_runtime). Values unchanged; layering documented + invariant comment.
   - The DAO treasury premine output has `unlock_height` 144,000 (`v3_compat.rs`). The other premine outputs have no height lock and depend on admin-lock rules.
4. New review notes from the 2026-10-25 remediation pass (`AUDIT_PACKAGE.md` §4 items 8–10): ZIS HS256 fallback literal; QTU/PRL link attestation proves ZION-key ownership only; pearl `dust` entries are ACKed/dropped permanently; Quantus genesis-anchored mortal era untested against mainnet semantics (QTC payouts disabled).
5. `REPORTS/AUDIT_RECHECK_2026-10-25.md` supersedes overstated money-path conclusions: burn authorization is separate from confirmations; router writes must succeed before submission; non-EVM inbound/TON safety holds and uncertain-withdrawal reconciliation require rollout review. Pool durability, deferred outbox and daily-cap atomicity were addressed 2026-10-31 (4.B3): warp transfer+daily_volume now commit in one sqlite tx; pool `take_*_payouts` drain-persist is fail-closed; `DeferredPayoutQueue` is durable via `<state_path>.deferred.json`. See `REPORTS/REPORT_2026-10-31_4B3_DURABLE_OUTBOX_DAILY_CAP.md` — deploy pending next pool/warpd release.

## 5. Deliverables requested

- Report with finding ID, severity, file:line, reproduction/PoC description, recommended fix.
- Severities: Critical / High / Medium / Low / Informational.
- Re-test of remediated findings.
- Attestation letter suitable for public reference.

## 6. Access and logistics (to be confirmed by the operator)

- Source: public GitHub repository, pinned commit.
- A sandbox/testnet environment for live probing can be discussed. Not yet prepared; no production access.
- The point of contact, the response times and the report channel are filled in by the operator before sending.

## 7. Reference documents

- `docs/3.2/SECURITY_AUDIT_3.2.md`, `docs/3.2/REPORTS/INTERNAL_AUDIT_2026-10-05.md`
- `archive/WarpBeta/AUDIT_PREP.md` (WARP / BTC swap preparation)
- `docs/3.2/ROADMAP.md` (gate definitions)
- G8 stability-run status (public): https://app.zionterranova.com/g8
