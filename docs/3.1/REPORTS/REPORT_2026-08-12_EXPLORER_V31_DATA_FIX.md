# ZION Explorer V31 Data Accuracy Fix Report

**Date:** 2026-08-12
**Target:** `app.zionterranova.com` (Next.js website-v2.9) + live Edge V31 node/pool
**Auditor:** Devin
**Scope:** Explorer block rewards, address transaction history, transaction from/to mapping, mempool count, miners hashrate, build/lint/deploy verification

---

## 1. Executive Summary

The V31 cutover changed the on-chain data model and pool metrics shape. The explorer was still relying on V3 assumptions (e.g. `total_output` of all TXs, pool `hashrate_hps`, mempool `tx_hashes`), which produced inconsistent or empty values. This session fixed the data pipelines and UI to match the live V31 node RPC and pool HTTP API.

**Result:**
- All explorer pages pass the UI audit (`explorer_ui_audit.cjs`).
- All key API endpoints pass the API audit (`explorer_api_audit.cjs`).
- Build and lint pass (`0 errors`, `3 pre-existing warnings`).
- Changes are committed and pushed to `main` (`d47a621c9`).

**Remaining limitations / follow-up:**
1. `/api/blockchain/address` for UTXO addresses with many UTXOs (e.g. 916) still takes ~5 s because `getTransaction` scans the chain linearly for each hash. Only the first 20 UTXOs are enriched with height/timestamp; a future node RPC extension (`getUtxos` returning `height`) would eliminate this.
2. Mempool returns `count` correctly, but no individual transactions — V31 `getTransactionPool` exposes only `size`, `template_transactions` and `template_total_fees_zion`.
3. Address transaction history for `zion1` UTXO addresses cannot be obtained from `getTransactionHistory` (it returns 0 results). The explorer falls back to UTXO-derived transactions.

---

## 2. Fixes Applied

### 2.1 Block reward (block detail + block list + stats)

**Problem:** `total_output` was summing all transaction outputs, not just coinbase emissions. The block reward showed incorrect values and the reward breakdown was missing.

**Files:**
- `src/app/api/blockchain/block/route.ts`
- `src/app/api/blockchain/blocks/route.ts`
- `src/app/api/blockchain/stats/route.ts`
- `src/app/explorer/block/BlockDetailClient.tsx`
- `src/lib/constants.ts`

**Changes:**
- `total_output` now only sums coinbase outputs (`miner_tx` + V31 native coinbase transactions).
- `reward` API field uses `subsidy_zion` (full 5,400.067 ZION block reward).
- Block detail added a new “Rozdělení odměny” (Reward Breakdown) panel showing miner, humanitarian, Issobella, and pool fee (burned) shares.
- Block list and stats `reward` now consistently uses `subsidy_zion`.

**Verification:**
```bash
curl -s "https://app.zionterranova.com/api/blockchain/block?height=2745" | jq '.reward, .total_output'
# 5400.067
# 5346.06633
```

### 2.2 Address detail timestamps and block heights

**Problem:** UTXO transactions showed `timestamp: 0` and `block_height: 0` because `getUtxos` does not return height/timestamp metadata. `getTransactionHistory` for `zion1` addresses returns 0 transactions in V31. Client-side aggregation only used the first 50 UTXOs and produced wrong `total_received`/`total_sent`.

**Files:**
- `src/lib/zion-rpc.ts`
- `src/app/api/blockchain/address/route.ts`
- `src/app/explorer/address/AddressDetailClient.tsx`

**Changes:**
- Added `enrichUtxoMetadata()` in `zion-rpc.ts` to look up a small list of UTXO tx hashes via `getTransaction` and cache height/timestamp/inputs/outputs.
- Address API enriches the first 20 UTXOs and builds the recent transaction list with real `timestamp`, `block_height`, and coinbase/transfer detection.
- Address detail client now uses `data.total_received` and `data.total_sent` from the API instead of recalculating from the first 50 client-side transactions.

**Verification:**
```bash
curl -s "https://app.zionterranova.com/api/blockchain/address?address=zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2" | jq '.transactions[0]'
# {
#   "tx_hash": "025adf73aee2ed27fcaa9cfd884157e037732a3d7218f887bf37269bf0877623",
#   "block_height": 2824,
#   "timestamp": 1786513751,
#   "type": "transfer",
#   "amount": 4805.816934
# }
```

### 2.3 Transaction detail from/to for UTXO transfers

**Problem:** V31 UTXO transactions have no explicit `from`/`to` fields. `getTransaction` returns only `inputs` with `previous_output` and `outputs` with addresses. The explorer left `from` empty and `to` as only the first output.

**Files:**
- `src/lib/zion-rpc.ts`

**Changes:**
- `parseV31Input()` now preserves `output_index`.
- `getTransactions()` enriches input addresses by resolving each input’s `previous_output` transaction and picking the output at `output_index`.
- `parseV31NativeTransaction()` builds `from` from unique input addresses and `to` from all output addresses.

**Verification:**
```bash
curl -s "https://app.zionterranova.com/api/blockchain/tx?hash=72866dc899f68a6ec77a562dc481df36c20f957a3f4e4fd75a4b12ec42aed8bb" | jq '.from, .to'
# "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2"
# "zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6, zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2"
```

### 2.4 Mempool API

**Problem:** V31 `getTransactionPool` no longer returns a list of individual mempool transactions, causing `mempool` and `count` to be `None`.

**Files:**
- `src/lib/zion-rpc.ts`
- `src/app/api/blockchain/mempool/route.ts`

**Changes:**
- `getTransactionPool()` now maps V31 fields: `size`, `template_transactions`, `template_total_fees_zion`.
- `mempool` API returns `count` from `size`, `transactions` as an empty array (consistent with available data), and fee stats.

**Verification:**
```bash
curl -s "https://app.zionterranova.com/api/blockchain/mempool" | jq '.count, .transactions | length'
# 1
# 0
```

### 2.5 Miners leaderboard hashrate

**Problem:** Pool metrics changed field names to `hashrate_1h`, `hashrate_24h`, etc. The leaderboard showed 0 or stale hashrate.

**Files:**
- `src/lib/miners/helpers.ts`
- `src/app/api/pool/stats/route.ts`

**Changes:**
- Updated `PoolMinerRaw` and `MinerEntry` interfaces to include `hashrate_1h`, `hashrate_24h`, and related raw fields.
- `convertPoolMinersToLeaderboard()` now correctly extracts and combines hashrate from `hashrate_hps` / `hashrate_1h_hps` / `hashrate_24h_hps`.
- Pool stats API maps the raw fields to the correct `hashrate` and `hashrate_1h/24h` fields.

**Verification:**
```bash
curl -s "https://app.zionterranova.com/api/blockchain/miners?limit=5" | jq '.miners[0]'
# {
#   "address": "zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6",
#   "hashrate": 804.45...,
#   "hashrate_formatted": "804.45 kH/s",
#   "shares_accepted": 110378,
#   "blocks_found": 1208
# }
```

---

## 3. Verification

### 3.1 Build

```bash
cd APP\&WEB/website-v2.9 && npm run build
# ✓ Compiled successfully in 10.5s
# 110 static pages generated
```

### 3.2 Lint

```bash
npm run lint
# 3 warnings (pre-existing), 0 errors
```

### 3.3 UI Audit

```bash
node explorer_ui_audit.cjs
# ALL UI CHECKS PASSED
```

Pages verified:
- `/explorer`, `/explorer/transactions`, `/explorer/blocks`, `/explorer/block`, `/explorer/tx`, `/explorer/address`, `/explorer/mempool`, `/explorer/search`, `/explorer/charts`, `/explorer/emission`, `/explorer/supply`, `/explorer/consensus`, `/explorer/network-stats`, `/explorer/richlist`, `/explorer/miners`, `/explorer/bridge`, `/explorer/broadcast`, `/explorer/fee-estimator`, `/explorer/verify-message`, `/explorer/status`, `/explorer/txs`.

### 3.4 API Audit

```bash
node explorer_api_audit.cjs
# 9/9 API checks passed
```

Endpoints verified:
- `GET /api/blockchain/stats`
- `GET /api/blockchain/blocks?limit=5`
- `GET /api/blockchain/block?height=2745`
- `GET /api/blockchain/transactions?hash=...`
- `GET /api/blockchain/address?address=...`
- `GET /api/blockchain/mempool`
- `GET /api/blockchain/miners?limit=5`
- `GET /api/blockchain/emission`
- `GET /api/blockchain/consensus?chart=false`

### 3.5 Deploy

```bash
rsync -az --delete -e "ssh -o StrictHostKeyChecking=accept-new" \
  src .next public package.json next.config.ts tsconfig.json \
  postcss.config.mjs tailwind.config.ts \
  zion-post-wipe:/opt/zion/APP\&WEB/website-v2.9/

ssh -o StrictHostKeyChecking=accept-new zion-post-wipe 'systemctl restart zion-website'
```

Service restarted cleanly; pages reachable with HTTP 200.

---

## 4. Git

Commit: `d47a621c9 explorer V31 data accuracy: rewards, address history, tx inputs, mempool, miners`

Files changed:
- `src/app/api/blockchain/address/route.ts`
- `src/app/api/blockchain/block/route.ts`
- `src/app/api/blockchain/blocks/route.ts`
- `src/app/api/blockchain/mempool/route.ts`
- `src/app/api/blockchain/stats/route.ts`
- `src/app/api/pool/stats/route.ts`
- `src/app/explorer/address/AddressDetailClient.tsx`
- `src/app/explorer/block/BlockDetailClient.tsx`
- `src/lib/constants.ts`
- `src/lib/miners/helpers.ts`
- `src/lib/zion-rpc.ts`
- `explorer_api_audit.cjs` (new)
- `explorer_ui_audit.cjs` (new)

Pushed to `main` on `https://github.com/Yose144/Zion-v3.0.0.git`.

---

## 5. Recommendations

1. **Node RPC improvement:** Add `height` and `timestamp` to `getUtxos` response so the explorer does not need N `getTransaction` calls for UTXO metadata.
2. **Transaction history for UTXO addresses:** Implement `getTransactionHistory` for `zion1` addresses or a dedicated `getAddressTransactions` RPC to avoid UTXO-only fallback.
3. **Mempool transaction list:** If the pool/node should expose individual mempool transactions, extend `getTransactionPool` with a `transactions` array; otherwise keep the current template-based summary.
4. **Periodic audit:** Run `explorer_ui_audit.cjs` + `explorer_api_audit.cjs` after each deploy to catch data model drift.
