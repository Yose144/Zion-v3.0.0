# ZION — External Audit Package (commit manifest + reproducible build)

> **Status:** prepared for operator hand-off — auditors NOT yet engaged (👤 selects firm, budget, NDA, kickoff)
> **Companion docs:** `EXTERNAL_AUDIT_SCOPE.md`, `SECURITY_AUDIT_3.2.md` + `REPORTS/INTERNAL_AUDIT_2026-10-05.md` (historical baseline), `REPORTS/AUDIT_RECHECK_2026-10-25.md` (money-path corrections and remaining risks)
> **Generated:** 2026-10-25 — pinned to the reviewed source commit. The manifest/report commit follows as documentation only; a document cannot contain its own commit hash.

---

## 1. Pinned commit manifest

> **⚠️ History rewrite 2026-10-21:** the repository history was rewritten with `git filter-repo` to purge committed build/backup artifacts (`V3/target2..target4`, `V3/target-check`, `V3/target-vega-fix`, `scripts/finetune/outputs`, `ZION_OS/dashboard/infra/target`, `BACKUP/`). All commit IDs after those points changed. Auditors holding SHA references from earlier revisions must re-resolve them against current `main` — the full old→new mapping is committed at [`docs/3.2/ops/SHA-REMAP-2026-10-21.json`](ops/SHA-REMAP-2026-10-21.json) (711 commits).

| Item | Value |
|---|---|
| Repository | `github.com/Yose144/Zion-v3.0.0` (public mirror is a subset — auditors should work from the full tree) |
| Branch | `main` |
| Pinned source HEAD | `4108a52d0b47702dd97fbd1d6f4919ceb1aca6a4` |
| Short | `4108a52d0` |
| Supersedes | `e9088b128fbccaf493c3e786360002a6025aa957` (wave-5 documentation plus the money-path recheck) |

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
| `1efc5d37c` | **ZIS attestation binding:** QTU/PRL link + account-delete re-proof now require the attesting `zionAddress` to be linked to the account (any-ZION-key bypass closed) |
| `5f868dac6` | **Withdrawal credit-back:** `request_withdraw` debited the ledger before `record_withdrawal`; a DB write failure propagated without restoring balance — now credits back (logs error if credit-back also fails) |
| `13e57f624` | **Deposit atomicity (double-credit fix):** ledger credit ran BEFORE `record_deposit` — a crash/DB failure between them caused re-credit on next poll. Now record-first + `atomic_credit_and_mark_deposit_credited` in one SQLite tx; replay is a no-op |
| `bffc3d51e` | **`execute_payouts` triple fix:** paid zion entries never left `pending_payouts` (latent double-pay + unbounded queue), escrow credit leaked on settlement failure (phantom credits per failed tick), and external-chain legs were iterated through the ZionL1 adapter — now `settle_payout` drains+marks+persists, failure debits back, zion-only filter |
| `2add3e93e` | **BtcToZion min-duration:** `offer_btc_to_zion` accepted near-future `zion_timeout_ts` — now requires remaining duration `> margin_blocks * BTC_BLOCK_SECS`, symmetric with the ZionToBtc direction |
| `c000a5d3c` | **WARP outbound executor crash-safety:** mint ran before `Executing` was persisted — a crash between broadcast and persist re-minted on restart, and persisted `Executing` transfers were never resumed. Now advance-before-mint, deterministic nonce/message hash, `dest_tx_hash` persisted immediately after submission, `Executing` resumes via confirmation; `Executing` without tx hash is held for operator recovery (no blind resubmission) |
| `490df2b71` | **WARP inbound Executing resume:** `poll_once` ignored persisted `Executing` transfers — a restart after `submitBridgeUnlock` stranded them forever; now resumes confirmation on stored `dest_tx_hash`, else holds for `zion-bridge-unlock` |
| `a0eeb3b5e` | **WARP deposit-proof binding:** `verify_deposit_proof` only checked existence+finality and its amount cross-check read a nonexistent field — any confirmed tx could be claimed as a vault deposit with a fabricated memo, and one tx_hash could be replayed. Now verifies the on-chain `transaction` body: vault-payment (`l1_vault_address`), memo equality, amount ≥ claim, sender match (account model) + `source_tx_hash` uniqueness |
| `d0ce0fe5c` | **Release error classification:** every `release()` failure → `Failed`, including transport timeouts where the unlock may already be broadcast. `ReleaseError::{Rejected,Transport}` — rejected is terminal (Failed), transport holds Executing for operator recovery (L1 dedupes on `burn_id`) |
| `0017a5084` | **Chain-scoped seen-tx dedup:** `seen_txs` keyed on `tx_hash` alone — cross-chain hash collisions dropped deposits, and `mark_seen` for a second chain silently no-oped → reprocessing. Composite PK `(tx_hash, chain)` + idempotent table rebuild; in-memory fallback keyed `chain:hash` |
| `61ec0ce01` | **Quorum duplicate-signer counting:** `verify_quorum` counted each `(id, sig)` entry — one valid signature repeated quorum-times satisfied quorum. Now each validator counts once (covers `bridge/consensus.rs` too, same code path) |
| `7cdb330ab` | **Timelock base:** hold duration measured from `created_at` — a transfer entering `TimelockHold` long after creation released instantly; now uses `updated_at` (bumped on every status transition = hold entry) |
| `3d559964c` | **Inbound replay dedup:** `/transfers/inbound` bypassed watcher dedup — one source burn could spawn multiple transfers. `initiate_inbound` dedupes on `burn_id` (distinct burns per tx allowed) with `tx_hash` fallback + representation-shift guard |
| `e9088b128` | **Deferred/fee payout response handling:** processor dropped payouts on first retry — read `tx_id` at envelope top level (node returns `result.tx_id`) and never checked the `error` field, so rejections were removed as "success". `execute_fee_payout` fabricated `Ok("unknown")` likewise |
| `4108a52d0` | **Money-path recheck R6-01...R6-07:** authoritative EVM burn verification and ABI/units fix; fail-closed router persistence; direction/config-driven execution; strict confirmation parsing and non-EVM/TON safety holds; atomic withdrawal creation plus durable pre-submit claim; payout response/maturity regressions |

**Deployed-vs-source divergence auditors must know:**
- **Deployed 2026-10-25 ~19:30 UTC** (see `REPORTS/DEPLOY_AUDIT_REMEDIATIONS_2026-10-25.md`): `warpd` SHA256 `bbc353c32b…e54f` on EDGE2 (`zion-v31-multichain`) and `zion-pool` SHA256 `968f56aae…dc36c` on EDGE (`zion-v31-pool`), both built from `6c8165d4a` (source identical to `4108a52d0`). All remediation commits `ebde4bd2a`…`4108a52d0` are now live on those two services. Deliberate behavior changes verified active on EDGE2: non-EVM inbound holds without a burn verifier (`no WARP_L1_RELEASE_KEYS → AwaitingFinality`), TON confirmations unsupported, `WARP_API_KEY` unset (mutating routes disabled), `WARP_BTC_SWAP_ENABLED=0`, `PRL_PAYOUT_DRY_RUN=1`.
- `zion-v31-ncl` on old Edge is a stopgap deployment; P3 migrates it to EDGE2.

## 2. Reproducible build procedure

```bash
# Toolchain (no rust-toolchain.toml pinned — record used version)
# Production binaries: rust:1.97-bullseye container (glibc 2.30 constraint)
# Package verified with: rustc 1.95.0 + cargo 1.95.0, also checked on 1.90 (macOS, dev)
# Host: Ubuntu 24.04, x86_64, glibc 2.39

git clone <repo> && cd Zion-v3.0.0 && git checkout 4108a52d0b47702dd97fbd1d6f4919ceb1aca6a4
REPO_ROOT="$(pwd)"
cd "$REPO_ROOT/V31"

# Workspace verification (dependency cache required for offline execution)
cargo check --workspace --locked

# Build recipes, not evidence of a release build in this recheck
cargo build --release --locked -p zion-core --bin zion-node
cargo build --release --locked -p zion-pool      # stratum pool (F6 failover + 12s timeout)
cargo build --release --locked -p zion-miner     # miner (CPU; GPU kernels need CUDA/OpenCL/Metal SDKs)
cargo build --release --locked -p zion-multichain --bin warpd
cargo build --release --locked -p zion-ncl       # NCL job daemon
cargo build --release --locked -p zion-free-world
cargo build --release --locked -p zion-cli

# Local library checks; do not run ignored live-chain transaction tests
cargo test --offline --locked -p zion-pool --lib -- --test-threads=1
cargo test --offline --locked -p zion-multichain --lib -- --test-threads=1 --skip test_evm_health_check_integ

# Contracts: separate recipe; not re-executed in this money-path recheck
cd "$REPO_ROOT/V31/L2/multichain/contracts"
forge build && forge test

# Web app
cd "$REPO_ROOT/apps/website-v2.9"
npm ci && npm run build          # Next.js 16.2.9, output: standalone
```

**Notes for reproducibility:**
- `Cargo.lock` is committed — use `--locked`.
- `new_chacha20poly1305` dep added in `ebde4bd2a` — lockfile updated in the same commit.
- GPU kernels (`*.cu`/`*.cl`/`*.metal`) are compiled at runtime via NVRTC/driver; audit the sources in `V31/L1/miner/csrc/` and `src/gpu/kernels/`.
- WASM/site builds are NOT bit-reproducible yet (no pinned Node toolchain) — flag in scope as ops finding if required.
- Other foundry projects (`archive/*`, `apps/MarketPlace`) still do not build from archives — out of external scope; only `V31/L2/multichain/contracts` is in-scope and was fixed.

### Verification Evidence For This Recheck

- `cargo check --offline --locked --workspace`: exit 0; native-ffi emits its existing build-configuration notice.
- `zion-multichain --lib`: 802 passed, 4 ignored, 1 filtered (`test_evm_health_check_integ` performs external RPC and was deliberately skipped).
- `zion-pool --lib`: 356 passed. Both library suites use `--test-threads=1`.
- The broad suites precede a final assertion-only strengthening, test-listener cleanup and log-whitespace change. The affected claim-failure test (1/1) and inbound tests (4/4) passed afterward; workspace check also passed afterward.
- All 22 changed Rust files pass targeted rustfmt. Workspace `cargo fmt --all --check` exits 1 on legacy formatting drift outside this patch; the unchanged `node.rs` baseline also fails directly from the pre-change HEAD. No claim of a globally clean formatting gate.
- `git diff --check`: exit 0. No full workspace test suite, clippy, dependency-advisory refresh, release build, contract build, web build or production probe was performed in this recheck.

Local raw evidence: `/tmp/audit-batch1-evidence/final-gate.log` (broad suite results), `gate-evidence.log` (actual check/format exits), `test-batch2.log` (targeted reruns). These are local artifacts, not committed CI or deployment evidence. Earlier failed attempts remain in older logs and are not counted as final passes.

## 3. Scope size — re-measured at pinned source HEAD `4108a52d0`

Method: `git grep -c -I . 4108a52d0b47702dd97fbd1d6f4919ceb1aca6a4 -- <path>`, summed per area. Counts are **nonempty tracked text lines**, including inline tests and any other tracked files inside the stated trees, not language-only executable LOC. Rows can overlap (notably miner src and GPU kernels); do not sum them into a unique total.

| Area | Lines | Path measured |
|---|---:|---|
| L1 core | 29,769 | `V31/L1/core/src` |
| L1 cosmic-harmony (PoW) | 10,742 | `V31/L1/cosmic-harmony/src` |
| L1 pool | 28,649 | `V31/L1/pool/src` |
| L1 miner (tracked src) | 56,510 | `V31/L1/miner/src` |
| L1 miner GPU kernels | 64,141 | `*.cu/.cl/.metal` under `V31/L1/miner`, excluding `csrc/ref` |
| L2 multichain | 52,953 | `V31/L2/multichain/src` |
| L2 DAO | 9,276 | `V31/L2/dao/src` |
| L3 ai-native | 15,675 | `V31/L3/ai-native/src` |
| L3 ncl | 2,088 | `V31/L3/ncl/src` |
| L4 oasis | 8,662 | `V31/L4/oasis/src` |
| L5 free-world | 2,782 | `V31/L5/free-world/src` |
| L6 issobella | 2,113 | `V31/L6/issobella/src` |
| Web API routes | 9,501 | `apps/website-v2.9/src/app/api` |
| ZIS identity src | 3,796 | `apps/identity/src` |
| Authored contract trees | 6,109 | `V31/L2/multichain/contracts/src` + `V31/contracts` (excl. vendored `lib/`) |

Every row was re-read from the pinned tree; older carried-forward figures are superseded, not assumed to match. The source patch touches only pool/multichain; changes to other reported figures correct the measurement baseline, not code in those areas. Vendored `contracts/lib/` is dependency material, not authored scope.

GPU pathspecs are `:(glob)V31/L1/miner/**/*.cu`, `:(glob)V31/L1/miner/**/*.cl`, `:(glob)V31/L1/miner/**/*.metal`, `:(exclude)V31/L1/miner/csrc/ref/**`. Contract-tree exclusions use `:(glob,exclude)**/lib/**`. Append these as separate quoted arguments after `--`. Local machine-readable measurements, exact commands and matching-file counts are captured in `/tmp/audit-batch1-evidence/scope-4108a52d0.json`.

## 4. Updated known-issue baseline (verify these)

**Remediated since the previous pin (deployed 2026-10-25 to `warpd`/`zion-pool` — see `REPORTS/DEPLOY_AUDIT_REMEDIATIONS_2026-10-25.md`):**

- ~~IA-13~~ **FIXED** — XOR "encryption" of HTLC preimages → ChaCha20-Poly1305 AEAD (`enc1:` format, random nonce, `ZION_HTLC_PREIMAGE_KEY`); legacy `enc:` rows decode + migrate on write. Tamper/wrong-key fail closed. **BTC swap remains disabled** (`WARP_BTC_SWAP_ENABLED=0` on prod env, verified 2026-10-25) — enable only after external review of the full swap path.
- **IA-14 PARTIAL / REOPENED** — `<state_path>.payouts.json` improves restart recovery, but writes are best-effort and unreadable/corrupt state loads an empty guard. An unconditional **at-most-once** guarantee is withdrawn. Durable claims, failure handling and post-broadcast reconciliation remain open; see `REPORTS/AUDIT_RECHECK_2026-10-25.md`.
- ~~IA-18~~ **FIXED** — `DexRouter::add_pool` idempotent by pool id; double-load (warpd + ApiServer) no longer duplicates `/v1/swap/pools`.
- ~~IA-22~~ **FIXED (in-scope project)** — `V31/L2/multichain/contracts/lib/` minimal subtrees vendored (`oz contracts/`, `forge-std src/`, ~3.5 MB); `git archive` → `forge build`/`forge test` verified. Other foundry projects (archive/*, MarketPlace) remain non-building from exports — out of scope.
- ~~IA-16~~ **VERIFIED FIXED on hosts** — zero `.bak` files under `sites-enabled` on Edge and EDGE2 (2026-10-25 re-check).

**Carried over / still open:**

1. `MAX_REORG_DEPTH` still has three values (10 / 64 / 500) — reconcile.
2. DAO premine `unlock_height` 144,000 vs admin-lock-only premine outputs.
3. Pool submit path: pre-orphan check removed by design — node consensus decides `submitBlock` validity. Confirm no DoS/amplification surface (submit flood → node validation cost).
4. Watchdog policy: `getTemplate` timeout 30 s / 3 consecutive fails → node restart. Verify restart logic cannot be gamed into a restart loop.
5. BTC swap dormant path: targeted prior review covered CLTV ordering, lock checks, coordinator idempotency and AEAD storage; it is not an independent security verdict. The former `BtcToZion` minimum-duration gap was fixed by `2add3e93e`, symmetrically with `ZionToBtc`. `WARP_BTC_SWAP_ENABLED=0` remains the documented safety hold; this local pass does not change or refresh production configuration.
6. PRL payout dry-run: `PRL_PAYOUT_ENABLED=1, DRY_RUN=1` (verified on EDGE2 env 2026-10-25); durable drain→ledger→ack protocol now in place; zero real PRL volume sent. QTC payouts deferred (treasury_free=0). **Note:** drained entries below `min_units` are ledgered as `dust` and ACKed — permanently dropped by design; confirm acceptable.
7. NCL daemon: first-eligible-worker scheduling (no live reputation registry — by design).
8. **ZIS identity review notes (post-pin rewrite):**
   - ~~`keys.ts` `'change-me-in-production'` HS256 fallback~~ — **fixed `f0b129c16`**: no default secret exists; `JWT_PRIVATE_KEY` or `JWT_SECRET` required; EdDSA cookie secret derived from private key; tests assert missing-config failure.
   - Quantus/pearl account-link attestation proves **ZION-key ownership only** (ZION key signs `challenge\n<chain>:<addr>`); the claimed external-chain address itself is not proven (`zion-l1` links are proven — `verifyEd25519` derives pubkey→address). Current consumers resolve the user's *own* wallet address (`server.rs` wallet_address) or check `can_act_as_zion_address` for zion-l1 only, so impact today is limited: **address squatting** — an attacker can link a victim's QTU/PRL address first, and the `address`-unique `linkedAddresses` row permanently blocks the real owner (409 CONFLICT). **Must be resolved before any flow treats linked QTU/PRL addresses as ownership proof** (rewards claims, payout attribution). Fix direction: require an on-chain proof or a signature under the external-chain key. **Partially mitigated `1efc5d37c`:** the attesting `zionAddress` must now be linked to the account (closes the any-ZION-key bypass on `/link` and `DELETE /me`); the unproven-external-address gap above remains by design (no JS ML-DSA/XMSS impl). **Gated `c7b9a42e1` (2026-10-31):** ZIS emits `proven:false` on quantus/pearl links; the pool gates payout fallbacks AND `owns()`/account-scoped writes on proven links, so squatted addresses no longer satisfy ownership anywhere downstream. Remaining: the unique-row 409 (link-DoS, needs a dispute/unlink or proof-gated flow) and a real external-key proof before QTU/PRL links can become `proven` — see `docs/3.2/REPORTS/REPORT_2026-10-31_3B3_LINK_PROVENANCE.md`.
   - Sessions are DB-backed with `jti↔sub` binding + revocation — verified correct in `lib/auth.ts`.
   - `admin.ts` — clean: all routes behind `requireAdmin`, allowlisted selects, last-admin lockout + self-delete guards, audit events.
   - `wallet.ts` — **fixed `63d29ff56`**: non-numeric `amount` threw unhandled `BigInt` → 500 (now 400 via zod); order-cache upserts now guard `userId` on orderId collision.
9. **L2 ledger atomicity — remediated `5f868dac6` + `13e57f624`:**
   - **Withdrawal** (`request_withdraw`): debited the ledger before `record_withdrawal`; a DB write failure propagated without restoring balance → silent funds loss. Now credits back on record-write failure (error log if credit-back also fails). Post-debit sweep/swap paths already compensated (`process_one` credit-back, swap_refund).
   - **Deposit** (`DepositWatcher::process_event`): credited the ledger BEFORE `record_deposit` — a crash/DB failure between them left no record, so the next poll **double-credited**; `atomic_credit`/`JournalLedger::credit` had no reference-id dedup. Now the durable record is persisted first (pending) and credit+mark happens in one SQLite tx (`atomic_credit_and_mark_deposit_credited`); replay on an already-credited row is a no-op. Regression tests: `deposit_replay_is_idempotent`, `pending_deposit_credits_once_at_finality` (746/746 lib tests).
   - Residual: `reference_id` is still not unique at the `ledger_entries` level — dedup is enforced at the deposit-status transition. A `UNIQUE(reference_id)` partial index would add defense-in-depth (schema migration, operator decision).
   - **`execute_payouts`** (service-level miner payouts, `bffc3d51e`): paid zion entries were never removed from `pending_payouts`/`sent_payouts` (latent double-pay + queue growth), the pre-settlement escrow credit leaked on settlement failure (phantom credit per failed 30 s tick), and all snapshot entries — including quantus/pearl legs owned by external sweepers — were iterated through the ZionL1 adapter. Now: zion-only filter, debit-back on send failure, `Pool::settle_payout` drains+marks+persists on success.
10. **Pool payout sweep ordering:** `take_pending_payouts` attempts to persist the drain before batch submission, but sidecar I/O is best-effort; this alone is not an at-most-once guarantee (see reopened IA-14). External sweeps (`prl_payout`/`qtc_payout`) use separate SQLite outboxes; their earlier review is not new verification of every ambiguity/failure boundary.
11. ~~Ignored `Result` in `server.rs` `p.restore()`~~ — fixed `ebde4bd2a`; compiler warnings all cleaned `ddf56ca30` (workspace now warning-free).
12. **IA-17 public-response leaks — remediated `b49494ed9`:** `blockchain/peers` masks private/loopback peers (counted, addresses hidden); `network` returns generic `unreachable` instead of raw `error.message` (leaked `ECONNREFUSED 127.0.0.1:port`); `ncl/status` scrubs loopback in proxied JSON + POST gated by `ZION_NCL_STATUS_KEY` (IA-05 defense-in-depth — nginx remains the external block) and no longer echoes fs paths; `wallet/qtc/prl/health/defi/cex/verify-message/tx/block` no longer echo `error.message` (transport errors embed internal RPC URLs) — real errors still logged server-side. **Env note:** `ZION_NCL_STATUS_KEY` is unset on EDGE2 → POST currently denied by default (fail-closed); set it if a legitimate writer exists.
13. Operator-owned items unchanged: IA-07 carrier /16 allowlists (CGNAT), IA-08 plaintext secrets in same-host backups / no off-site copy, IA-09 burned keys in public history pending revocation, IA-10 ops details in public repo, IA-19 chain-liveness single-miner dependency (G8 run #4 pending).
14. **WARP bridge money-path review — remediated `2add3e93e`…`7cdb330ab`:**
    - **Crash-safety (double-mint/stranded):** the earlier ordering change requested `Executing` before submission; the router still swallowed SQLite failures. The follow-up recheck makes successful persistence a prerequisite. Restarts resume stored `dest_tx_hash`; absent hashes hold for reconciliation, not blind resubmission.
    - **Deposit-proof binding (was FIND-008 verified only):** any confirmed L1 tx could be presented as a bridge deposit — existence+finality were checked but not vault payment, memo, or sender, and `tx_hash` replayed freely. Now the on-chain `transaction` body must pay `l1_vault_address` ≥ claimed amount with the exact memo, sender cross-checked for account-model txs, one `source_tx_hash` = one transfer.
    - **Error classification:** a `submitBridgeUnlock` node rejection is terminal (`Failed`); a transport failure is ambiguous and holds `Executing` for operator recovery. L1 replay protection depends on the exact canonical source-chain/burn/transaction identity; it does not prove that a submitted source transaction actually burned the stated amount for the stated recipient.
    - **Quorum + dedup correctness:** `verify_quorum` no longer counts repeated `(validator_id, sig)` pairs (one sig could reach quorum); watcher dedup is now per-chain `(tx_hash, chain)` composite key (+SQLite table rebuild on open); timelock duration is measured from hold entry.
    - **Residual / for the external auditor:** dest-chain mint dedup is assumed at contract level keyed by `warp_message_hash` (deterministic now) — verify on each adapter's target contract; `signing_hash` binds transfer_id/chains/recipient/amounts/nonce/proof-hash (no domain-separation tag — assess cross-protocol ambiguity); `Executing`-without-`dest_tx_hash` requires manual settlement by design (safety over liveness); `WARP_BTC_SWAP_ENABLED=0` holds in prod pending this audit.
15. **Payout response-handling + WARP adapter parity — `3d559964c`…`e9088b128`:**
    - **Deferred payouts dropped on first retry (was silent abandonment):** `L1Endpoints::call` returns the raw JSON-RPC envelope. The original processor read top-level `tx_id` and could remove rejected work as `"unknown"`. The shared regression-tested parser now requires an explicit `accepted:true` and nonblank `result.tx_id` for object responses, or the legacy nonblank string result. Non-null RPC errors and incomplete/malformed successes remain queued subject to the existing retry limit. This is not a durable-outbox guarantee.
    - **Inbound replay at router level:** `/transfers/inbound` bypassed watcher dedup — one source burn could create multiple transfers (L1 consensus `burn_id` dedup was the only backstop). `initiate_inbound` now dedupes on `burn_id` (multiple burns per source tx allowed) with `tx_hash` fallback; a no-`burn_id` proof is rejected once the same tx stored a real `burn_id` (representation-shift guard).
    - **Residual (adapter parity):** the EVM payload binds `warp_message_hash` into `bridgeMint(addr,amt,bytes32)`. Equivalent transfer-specific replay binding has not been established for the non-EVM payloads. Their calls and destination semantics differ; the earlier blanket claim that all call a two-argument mint and cannot have any deduplication is withdrawn. Audit each deployed program/interface independently. No destination contract is changed in this pass.
16. **Money-path recheck and corrected conclusions:** `REPORTS/AUDIT_RECHECK_2026-10-25.md` records R6-01 through R6-07, scoped evidence, non-EVM inbound/TON safety holds, and remaining source risks. In particular, confirmations are not burn authorization; the EVM event ABI/18-to-6-decimal conversion must match the contract; SQLite errors must stop pre-submit claims; and ambiguous withdrawals require reconciliation rather than resend/refund.

## 5. Ops facts auditors need

- Production topology is mid-migration old Edge → EDGE2 (`INFRA-SPLIT-PLAN.md`); audit the target-state units in `edge-deploy/systemd/`. **EDGE2 is now the primary + web ingress** (apex cutover 2026-10-22).
- Secrets live in `/etc/zion/edge-environment.sh` (not in repo) — verify handling, not contents.
- UFW allowlists (not SSH tunnels) for cross-host RPC per split plan.
- Nginx hazard confirmed fixed but worth a regression check in any deployment audit: `.bak` files inside `sites-enabled/` are parsed by the wildcard include (historical copies live in `/etc/nginx/backups/`).
- `/vast-rigs/status.json` on EDGE2 is refreshed by `zion-vastrigs-sync.timer` pulling `127.0.0.1:8088/api/status` over the existing reverse tunnel (installed 2026-10-25).
