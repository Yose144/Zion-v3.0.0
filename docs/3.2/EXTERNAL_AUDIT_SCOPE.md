# ZION 3.2 "One Love" — External Security Audit Scope (DRAFT)

> **Version:** 2.0 (rewritten 2026-10-05 after the internal audit) · **Status:** DRAFT — **not sent; no audit firm selected or engaged**
> **Contact / SLA:** _to be filled in by the operator before sending_ (v1.0 contained an invented address and SLA — withdrawn)
> **Repository:** https://github.com/Yose144/Zion-v3.0.0 (public) — the audit commit will be pinned when the engagement starts

---

## 1. System overview

ZION is a Layer-1 blockchain: UTXO/hybrid transaction model, Ed25519 signatures, custom PoW "Ekam Deeksha". The mainnet is live in Alpha. A small set of services runs on one production host:

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
| 9 | ZIS identity: sessions, WebAuthn/passkeys, API keys | — | TypeScript | `APP&WEB/identity/` |
| 10 | Public web API routes and proxies | — | TypeScript | `APP&WEB/website-v2.9/src/app/api/` |
| 11 | L3 AI-native API + RAG (public chat proxy, prompt-injection and data exposure) | L3 | Rust | `V31/L3/ai-native/`, `V31/L3/ncl/` |
| 12 | L4 OASIS, L5 Free World (projects, quadratic voting), L6 Issobella services | L4–L6 | Rust | `V31/L4/oasis/`, `V31/L5/free-world/`, `V31/L6/issobella/` |
| 13 | Contracts (bridge token, DEX, intent settlement) | L2 | Solidity | `V31/L2/multichain/contracts/src/`, `V31/contracts/` |
| 14 | Deployment and operations: nginx, systemd units, backups, secret handling, build reproducibility, dependencies | ops | — | `V31/deploy/`, `ZION_OS/infra/scripts/`, `scripts/ops/`, lockfiles |

**Out of scope (unless requested):**

- mobile app, MarketPlace, desktop agent UI
- `archive/`, `public/` mirror
- marketing pages (non-API)

## 3. Measured size (non-blank lines incl. inline tests, `git grep`, commit `29a6b8a8a`)

| Area | Lines |
|---|---:|
| L1 core + types + native-ffi | 33,038 |
| L1 cosmic-harmony (PoW) | 9,657 |
| L1 pool | 14,663 |
| L1 miner (Rust) | 35,881 |
| L1 miner GPU/C kernels (excluding vendored reference) | 61,485 |
| L2 multichain | 48,412 |
| L2 DAO | 9,311 |
| L3 (ai-native + ncl) | 17,303 |
| L4 / L5 / L6 | 8,572 / 3,709 / 2,270 |
| CLI / SDK / smoke | 5,245 |
| ZIS identity (TS) | 2,509 |
| Web API routes | subset of 136,781 lines of TS/TSX in `website-v2.9/src` (API routes only are in scope) |
| Solidity (live contracts) | 4,790 |

## 4. Baseline: known issues the auditor should verify

1. `docs/3.2/SECURITY_AUDIT_3.2.md`: internal audit of 2026-08/09, 44 findings.
   - Re-classified by the internal audit of 2026-10-05: FIND-002 is *partially fixed*; POL-002 is *partially verified*.
2. `docs/3.2/REPORTS/INTERNAL_AUDIT_2026-10-05.md`: whole-project internal audit, findings IA-01…IA-22. These include:
   - multichain/WARP authorization fixes
   - ZIS session-binding fix and secret rotation
   - P2P fork-choice fix
   - open operator items: allowlists, backups, secrets in history, dependencies
3. Constants the auditor should reconcile:
   - Three different `MAX_REORG_DEPTH` values exist: 10 (`v3_chain.rs`, V3-compat path), 64 (`p2p.rs`, native sync), 500 (`node_runtime.rs`).
   - The DAO treasury premine output has `unlock_height` 144,000 (`v3_compat.rs`). The other premine outputs have no height lock and depend on admin-lock rules.

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
- `WarpBeta/AUDIT_PREP.md` (WARP / BTC swap preparation)
- `docs/3.2/ROADMAP.md` (gate definitions)
- G8 stability-run status (public): https://app.zionterranova.com/g8
