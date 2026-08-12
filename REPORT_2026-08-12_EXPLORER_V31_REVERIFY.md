# Report: V31 Explorer Re-verification & Backend/Frontend Fixes

**Date:** 2026-08-12  
**Scope:** `APP&WEB/website-v2.9` (Next.js explorer) + `V31/L1/core` (Rust node)  
**Deployed to:** `https://app.zionterranova.com`  

## Summary

Re-verified the deployed V31 explorer after the previous data-accuracy round. Found and fixed three live issues:

1. **Transaction list total count** showed `0` because `getInfo()` only computed `tx_count` when `difficulty === 0`. Node now uses `accepted_blocks` from `getChainInfo` as a fallback, so `/explorer/txs` displays the real total.
2. **Peer / Status page** showed no useful peer metadata (all `height —`, `idle —`) because `getPeerInfo` returned only `address`. Backend now emits `host`, `port`, `connected`, `source`, `good`, `bad`, `idle_seconds`; frontend consumes these fields.
3. **Miners leaderboard** was empty because the live telemetry endpoint `/miners` only returned a single `local-miner` worker. Frontend now falls back to the persistent `/api/v1/miners` history endpoint and normalizes its records.

## Changes

### Backend (`V31/L1/core`)

- `src/peer_manager.rs`
  - Added `known_peers_with_metadata()` returning `HashMap<SocketAddr, PeerInfo>`.
  - Refactored `known_peers_list()` to reuse the new helper.

- `src/rpc.rs`
  - `getPeerInfo` now builds rich peer objects instead of bare addresses.
  - Uses `active_set` to flag truly active/connected peers.
  - Includes `source`, `good`, `bad`, `idle_seconds` from `PeerInfo`.

### Frontend (`APP&WEB/website-v2.9`)

- `src/lib/zion-rpc.ts`
  - `ZionPeer` interface extended with `source`, `idle_seconds`, `good`, `bad`, `connected`.
  - `getInfo()` now derives `tx_count` from `accepted_blocks` when the tip-block branch does not run.
  - `getConnections()` parses the new `getPeerInfo` fields.

- `src/app/api/blockchain/peers/route.ts`
  - Returns `source`, `idle_seconds`, `good`, `bad` and correct `connected`/`state`.

- `src/lib/miners/helpers.ts`
  - `fetchMinersFromPool()` tries live `/miners` then persistent `/api/v1/miners`.
  - Normalizes historical records (`miner_id`, `total_paid_flowers`, `accepted_shares`, `rejected_shares`, `last_seen_s`) into the live telemetry shape.

- `explorer_api_audit.cjs`
  - Hardened fail-printer against undefined `res.json`/`res.body`.

## Verification

- `npm run build` — passed
- `npm run lint` — passed (3 pre-existing warnings)
- `cargo test -p zion-core` — passed (303 tests)
- `node explorer_ui_audit.cjs` — **ALL UI CHECKS PASSED**
- `node explorer_api_audit.cjs` — **9/9 API checks passed**

## Live checks after deploy

- `/api/blockchain/stats` — `tx_count` now correct
- `/api/blockchain/peers` — returns 70+ peers with `idle_seconds`, `source`, `good`/`bad`
- `/api/blockchain/miners` — returns historical miners with balances and paid amounts
- `/explorer/txs` — displays total TX count and loads quickly
- `/explorer/status` — peer table now shows idle time and peer direction

## Notes

- `getPeerInfo` `connected` is still mostly `false` because V31 P2P peers connect briefly, exchange status, and disconnect; `idle_seconds` accurately reflects last-seen time.
- Miner hashrate is `0` for historical records because the share-store does not persist per-miner hashrate; payouts and balances are correct.

---

Generated with [Devin](https://devin.ai)
