# ZION V31 Report: ZIS Deployment, UTXO v2 Wallet/CLI/Pool, and WARP Test Stability

**Date:** 2026-08-22
**Target:** Edge server (`62.171.141.136` / `vmi3425821.contaboserver.net`), local V31 workspace `2.9.6-main`
**Scope:** ZION Identity Service (ZIS) production deployment, UTXO v2 transaction alignment across wallet SDK / CLI / pool, WARP non-EVM `disabled_reason` hardening, and flaky NEAR env-var test fix.

---

## 1. Executive Summary

- **ZIS is live on Edge.** `zion-zis.service` is `active`, `/health` returns OK both locally and via `https://auth.zionterranova.com`.
- **UTXO v2 transaction hashing and `submitUtxoTransaction` are wired end-to-end** through `APP&WEB/zion-wallet-sdk`, `V31/cli`, and `V31/L1/pool`.
- **WARP G2 non-EVM hardening is complete and committed.** `ChainConfig`/`ChainRegistry`/`WarpError` carry `disabled_reason`; runtime builds from `warp.toml`; `/chains` API exposes chain status with reasons.
- **`cargo test -p zion-multichain` is stable again** after serializing NEAR env-var tests that were racing on `WARP_NEAR_RPC`.

---

## 2. ZION Identity Service (ZIS) Deployment

### 2.1 Source

- Location: `APP&WEB/identity/`
- Stack: Fastify 4 + Prisma + PostgreSQL + `noble-ed25519`
- Edge path: `/opt/zion/identity`
- Public endpoint: `https://auth.zionterranova.com` (nginx → `127.0.0.1:8096`)

### 2.2 Issues Found and Fixed

1. **Dependency version mismatch:** `@fastify/rate-limit` was `^10.3.0`, which requires Fastify 5. Fastify is pinned at `^4.28.1`, causing `FST_ERR_PLUGIN_VERSION_MISMATCH` on startup.
   - **Fix:** Pin `@fastify/rate-limit` to `^9.1.0`.
2. **Missing package:** `noble-ed25519 ^1.3.0` does not exist.
   - **Fix:** Pin to `^1.2.6` (deprecated but available and sufficient for the current usage).
3. **Systemd `ExecStart` path stale:** Service pointed to `dist/server.js`, but the build emits `server.js` at the project root.
   - **Fix:** `ExecStart=/usr/bin/node /opt/zion/identity/server.js`.
4. **Deployment transport intermittent:** SSH/SCP to Edge on port 2222 was refused at first and an IPv6 quoting issue broke `scp`.
   - **Fix:** Use explicit IPv6 address `2a02:c207:2342:5821::1` with correct quoting; restart service after `npm install` and `prisma migrate deploy`.

### 2.3 Verification

```text
systemctl is-active zion-zis  # active
curl -s http://127.0.0.1:8096/health
# {"status":"ok","service":"zis","version":"0.1.0","timestamp":"..."}

curl -sk https://auth.zionterranova.com/health
# {"status":"ok","service":"zis","version":"0.1.0","timestamp":"..."}
```

### 2.4 Files Changed

- `APP&WEB/identity/package.json`
- `APP&WEB/identity/package-lock.json`
- `APP&WEB/identity/deploy/zion-zis.service`

---

## 3. UTXO v2 Transaction Alignment

### 3.1 Problem

Wallet SDK, CLI, and pool were using mismatched transaction builders and RPC methods:
- Wallet SDK was producing legacy v1 BLAKE3 transaction hashes.
- CLI was using `build_send_with_memo` and `submitTransaction`.
- Pool `deferred_payout.rs` was using `zion_core::v3_wallet` with a `chain_height` argument and reading `tx_id` from the top-level RPC response.

### 3.2 Changes

1. **Wallet SDK (`APP&WEB/zion-wallet-sdk/src/core/transaction.ts`)**
   - `calculateTxHash` now uses the v2 length-prefixed preimage matching `V31/L1/core/src/v3_tx.rs`:
     - `ZION_TX_V2\0` domain tag
     - `fee` and `timestamp` before inputs/outputs
     - `u32` length prefixes on variable fields and vectors
     - explicit memo-present / memo-absent tags
   - `transactionToRpcPayload` now sends byte arrays instead of hex strings.

2. **Wallet SDK RPC (`APP&WEB/zion-wallet-sdk/src/rpc/zion-rpc.ts`)**
   - `broadcastTransaction` now calls `submitUtxoTransaction`.

3. **CLI (`V31/cli/src/main.rs`)**
   - `wallet send` now uses `zion_core::v3_wallet::build_and_sign` with `SendParams`.
   - Fetches current chain tip height for the v2 hash via `getChainInfo`.
   - Submits via `submit_utxo_tx_json` → `submitUtxoTransaction`.
   - Updates `fetch_utxos` to use `zion_core::v3_wallet::SpendableUtxo`.

4. **Pool (`V31/L1/pool/src/payout.rs` and `deferred_payout.rs`)**
   - `payout.rs`: added operational logging, batch-cap overflow warning, and detailed broadcast/confirmation logs.
   - `deferred_payout.rs`: aligned with `zion_core::v31_wallet` for V31-native `crate::Transaction`, fixed `submitUtxoTransaction` response extraction (`result.tx_id`), and fixed `getUtxos` response extraction.

### 3.3 Verification

- `cargo test -p zion-pool` — 165 tests pass.
- `cargo clippy -p zion-multichain -p zion-pool` — 0 errors.

---

## 4. WARP Non-EVM `disabled_reason` Hardening

### 4.1 Summary

Gate G2 required that all non-EVM WARP chains either be production-ready or carry an explicit `disabled_reason`. A previous session implemented this across the multichain crate.

### 4.2 Changes

- `V31/L2/multichain/src/warp/config.rs` — `ChainConfig` gained `disabled_reason: Option<String>`.
- `V31/L2/multichain/src/warp/error.rs` — `ChainDisabled` carries `reason`.
- `V31/L2/multichain/src/warp/types.rs` — new `ChainStatus`.
- `V31/L2/multichain/src/warp/registry.rs` — `ChainEntry` stores `disabled_reason`; `register_with_reason`, `from_config`, and `list_chain_status` added.
- `V31/L2/multichain/src/warp/runtime.rs` and `server.rs` — `WarpRuntime`/`WarpState` build registry from `WarpConfig::chains`; `/chains` returns `list_chain_status()`.
- `V31/L2/multichain/warp.example.toml` — only `base` and `zion-l1` enabled; all non-deployed non-EVM chains disabled with explicit reasons.

### 4.3 Verification

- `cargo test -p zion-multichain` — 573 passed, 1 ignored.
- `cargo clippy -p zion-multichain` — 0 errors.

---

## 5. WARP NEAR Env-Var Test Flakiness

### 5.1 Problem

`cargo test -p zion-multichain` failed intermittently on `warp::adapter::near::tests::test_from_env_respects_override` because two NEAR tests were racing on the process-global `WARP_NEAR_RPC` environment variable.

### 5.2 Fix

Added `NEAR_ENV_LOCK: Mutex<()>` in `V31/L2/multichain/src/warp/adapter/near.rs` and acquired it in all NEAR tests that touch `WARP_NEAR_*` env vars.

### 5.3 Result

`cargo test -p zion-multichain` now passes 573 tests reliably.

---

## 6. Commits

```text
a1bdcfeaf fix(pool): align deferred payout with v31 wallet and JSON-RPC response shape
adee9ac6b docs: update status for ZIS deployment, UTXO v2 fixes, and WARP test stability
7ed20d07d chore(smos): bump Trinity SMOS package to v3.2.0 and add rig monitor
b7fecc6ef fix(wallet/cli): align UTXO transaction hash and submission with V3 v2
93b206441 fix(zis): align rate-limit version and systemd ExecStart for Fastify 4
504d44e00 fix(warp): serialize NEAR env-var tests to prevent flaky failures
```

---

## 7. Follow-up Items

1. **Foundry / Hardhat config for multichain contracts** — still missing, blocking `zion deploy` for EVM contracts.
2. **CLI `dao`/`atomic-swap`/`warp` stubs** — several subcommands are present but not fully wired.
3. **G1 real GPU / rig E2E** — not started; need ≥2 reference rigs with ≥90% accept rate for 1 hour.
4. **G7 chaos / load tests** — not started.
5. **G8 30-day continuous run** — not started.
6. **G9 external / internal security audit** — not started.
