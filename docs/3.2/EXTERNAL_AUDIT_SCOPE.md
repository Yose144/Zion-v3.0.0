# ZION 3.2 "One Love" — External Security Audit Scope

> **Version:** 1.0 · **Prepared:** 2026-10-05 · **Status:** READY TO SEND
> **Contact:** ops@zionterranova.com
> **Repository:** https://github.com/Yose144/Zion-v3.0.0 (branch `main`)

---

## 1. What is being audited

ZION is a Layer-1 blockchain (UTXO model, Ed25519 signatures, custom PoW) with a live mainnet in Alpha. The audit covers the code and deployment that constitutes the 3.2 "One Love" stable-release candidate.

**What is live and in scope:**

| Component | Layer | Language | Where |
|---|---|---|---|
| Consensus, UTXO, premine, PoW | L1 | Rust | `V31/L1/core/` |
| P2P networking, IBD, mempool | L1 | Rust | `V31/L1/core/src/p2p.rs`, `node.rs` |
| Mining pool (stratum, PPLNS, payouts) | L1 ops | Rust | `V31/L1/pool/` |
| Miner (CPU/GPU triple-stream) | L1 ops | Rust | `V31/L1/miner/` |
| Bridge (ZION ↔ wZION on Base) | L2 | Rust | `V31/L2/multichain/src/bridge/` |
| HTLC atomic swaps | L2 | Rust | `V31/L2/multichain/src/swap/` |
| DEX / solver network | L2 | Rust | `V31/L2/multichain/src/dex/`, `solver/` |
| DAO + treasury | L2 | Rust | `V31/L2/dao/` |
| ZIS identity (sessions, WebAuthn) | L2 | TypeScript | `APP&WEB/website-v2.9/src/lib/zis-client.ts`, `identity/` |
| Release supply chain | ops | — | `scripts/`, `V31/deploy/`, GitHub workflows |

**Explicitly out of scope for this engagement:** L3 AI-native orchestration (`zion-ai-native-api`, RAG — operator tool, no fund custody), L4 OASIS game client, L5 Free World portal, marketing website UI.

---

## 2. Pre-existing audit status

An internal audit was completed 2026-08-26 → 2026-09-01 (report: `docs/3.2/SECURITY_AUDIT_3.2.md`).

- **44 findings:** 2 Critical, 10 High, 20 Medium, 12 Low
- **Remediation:** 37 fixed, 7 accepted with documented mitigations, 4 deferred to v3.3 (`ethers→alloy` migration)
- Criticals fixed: pool difficulty-1 share acceptance, non-idempotent payout, ZDXToken immutable owner + missing burn

The internal report and its remediation log are the starting baseline — the external firm should verify the fixes and probe for issues the internal pass missed.

---

## 3. Highest-risk areas (priorities for the auditor)

1. **Premine / admin unlock** — 14 genesis outputs, `admin_locked` flag, time-locks at block 144,000. Verify no path releases them early. `V31/L1/core/src/v3_compat.rs`, `genesis.rs`, `chain_state.rs`.
2. **Consensus / UTXO integrity** — coinbase maturity (100), reorg limit (10), soft finality (60), double-spend in mempool + UTXO, overflow (checked math). `node.rs`, `chain_state.rs`.
3. **PoW verification** — Ekam Deeksha 512 KiB scratchpad, 2 passes, 128 reads, KAT-locked across CPU/CUDA/OpenCL/Metal. `V31/L1/core/src/pow*`, `V31/L1/miner/src/`.
4. **Pool payout** — PPLNS window, share validation, batch TX, payout confirmation sweep. `V31/L1/pool/src/payout*.rs`, `api.rs`.
5. **Bridge / HTLC** — preimage generation, timelock expiry, refund path, claimer enforcement, non-ZION chain branches. `multichain/src/swap/htlc.rs`, `bridge/`.
6. **WARP solvency** — reconciliation vs. on-chain balances, deposit-address accounting. `multichain/src/reconciliation*`, `solvency*`.
7. **DAO treasury** — spendable vs. locked split, approval records, L1 interaction. `V31/L2/dao/src/treasury*`, `api.rs`.
8. **ZIS** — session issuance, WebAuthn credential storage/verification, passkey flow. `identity/` + web `zis-client`.
9. **Supply chain** — build reproducibility, checksums, signed tags, deploy scripts, CI.

---

## 4. Deliverables expected

- Written report: finding ID, severity, file:line, PoC description, recommended fix.
- Severity classification: Critical / High / Medium / Low / Informational.
- Re-test of any findings we remediate during the engagement.
- Final attestation letter suitable for public reference.

---

## 5. Access & logistics

- **Read-only source access** via GitHub (`main` branch, commit-pinned tag `v3.2.0-rc*` once cut).
- **Testnet / sandbox** node + pool can be provided for live probing (no production access).
- **Point of contact:** ops@zionterranova.com — response SLA <24h.
- **Preferred format:** GitHub Issues draft or PDF report; findings tracked in `docs/3.2/REPORTS/`.

---

## 6. Rough size estimate for quoting

| Area | Approx LOC |
|---|---|
| L1 core (consensus, UTXO, PoW) | ~22,700 |
| Pool | ~19,500 |
| Miner | ~14,500 |
| L2 multichain (bridge, HTLC, DEX, solver, WARP) | ~29,000 |
| DAO | ~5,000 |
| ZIS / web glue | ~6,000 |
| **Total** | **~96,700** |

---

## 7. Reference reports & docs

- Internal audit + remediation: `docs/3.2/SECURITY_AUDIT_3.2.md`
- WARP-specific audit prep + findings log: `WarpBeta/AUDIT_PREP.md`
- G8 30-day stability run (live): `https://app.zionterranova.com/g8`
- Public token disclosure: `APP&WEB/website-v2.9/public/docs/en/v3.2.0/security-audit.md`
- Full 3.2 roadmap with gate definitions: `docs/3.2/ROADMAP.md`
