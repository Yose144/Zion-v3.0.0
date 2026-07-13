# AuxPow Live Deployment Report — 2026-07-13

## Summary

This report covers the implementation of two critical gaps for live AuxPow deployment:
1. **Pool revenue tracking** for accepted external shares (`record_external_revenue()`)
2. **Automatic profit-based coin switching** in the AuxPow bridge loop

## Audit Findings (Pre-Implementation)

### What's Already Working
- **Miner share submission**: Miner already submits external shares via `PoolMessage::Submit` with `mix_hash_hex` for Ethash/KawPow. The submit path is fully wired.
- **Pool external share handling**: `handle_external_share()` (server.rs:1419) forwards shares to upstream pool via `ShareForwarder::try_forward()`. Accepted/rejected results are correctly mapped to `ShareStatus`.
- **PPLNS credit**: External shares are recorded in PPLNS with difficulty weight (server.rs:1938). Miners get fair credit for external work.
- **Job multiplexing**: `JobMultiplexer` connects to external pools, receives jobs, and queues them for miners.
- **Revenue source routing**: `routed_source` correctly maps external coins to their `RevenueSource` (e.g. RVN→KawPowExternal).

### What Was Missing (Gaps Addressed)

#### GAP 1: Pool Revenue Tracking for External Shares — FIXED
**Problem**: `record_external_revenue()` was defined in `CoreRuntime` but never called when an external share was accepted by the upstream pool. External mining produced no revenue accounting.

**Fix**: Added revenue recording block after the pool stats tracking (server.rs:2146-2170):
- When `ShareStatus::Accepted` and `WorkAssignment::External`, calls `record_external_revenue()` with:
  - `ext_source`: mapped from external coin via `external_coin_to_revenue_source()`
  - `est_usd`: estimated USD value per share via `estimate_external_share_usd()`
  - `external_coin.ticker()`: coin ticker for multi-coin revenue tracking
- Logs `auxpow_revenue_recorded` with coin, source, and estimated USD

**Helper function**: `estimate_external_share_usd(coin)` — uses `fallback_estimates()` daily revenue divided by 10000 shares/day to get per-share value (~$0.00001–$0.0001).

#### GAP 2: Automatic Profit-Based Coin Switching — FIXED
**Problem**: `run_auxpow_bridge()` connected to `force_coin` (or default KAS) and never switched, even when profitability changed. Comment at line 502 said "not implemented".

**Fix**: Implemented auto coin switching in the bridge loop (server.rs:500-535):
- When `force_coin` is `None`, periodically checks profitability every `profit_check_interval_secs` (default: 60s)
- Uses `zion_cosmic_harmony::select_best_coin()` with hysteresis (default: 15%)
- On coin switch: disconnects from old coin, connects to new coin, logs `profit_switch` with old/new profit comparison
- Initial coin selection also uses profit-based selection when `force_coin` is `None`

**New config fields** in `AuxPowIntegrationConfig`:
- `profit_check_interval_secs: u64` (default: 60) — env: `ZION_POOL_AUXPOW_PROFIT_CHECK_INTERVAL`
- `hysteresis_pct: f64` (default: 15.0) — env: `ZION_POOL_AUXPOW_HYSTERESIS_PCT`

**Type bridge functions**: Added `auxpow_to_ch_external_coin()` and `ch_to_auxpow_external_coin()` to convert between `zion_auxpow::ExternalCoin` and `zion_cosmic_harmony::ExternalCoin` (identical enums in separate crates).

## Test Results

- **Pool tests**: 38/38 passed (0 failed)
- **Build**: Clean (only warnings: unused imports, dead code — pre-existing)

## Remaining Gaps for Full Production

| Gap | Status | Effort |
|-----|--------|--------|
| ~~Pool revenue tracking~~ | ✅ DONE | — |
| ~~Auto coin switching~~ | ✅ DONE | — |
| Live API integration (WhatToMine/CoinGecko) in bridge | Pending | Currently uses `fallback_estimates()`. `fetch_profit_snapshot()` exists in stream_profit.rs but bridge uses static estimates. |
| CLI AuxPow commands | Pending | 5-10h |
| Edge config fix (ETC→DCR) | Pending | Config change only |
| GPU kernels for external algorithms | R5 in progress | Separate workstream |
| EthStratum protocol (R6) | Done | — |
| True AuxPow consensus (R7/Phase 3) | Future | 20-40h |

## Files Modified

- `V3/L1/pool/src/bin/server.rs` — revenue tracking + auto coin switching + type bridge functions + config fields
- `AuXpow/csrc/opencl/blake3_kernel.cl` — Blake3 kernel counter/flags offset fix (from R5 GPU work)
- `AuXpow/src/external_hashers.rs` — trailing newline (cosmetic)
- `AuXpow/examples/dcr_gpu_check.rs` — new DCR GPU check example (from R5 GPU work)

## Next Steps

1. Deploy updated pool binary to Edge server
2. Fix Edge config: `ZION_POOL_AUXPOW_COIN=ETC` → `DCR` or remove (use auto-switching)
3. Set `ZION_POOL_AUXPOW_ENABLED=1` with valid wallet
4. Monitor `journalctl -u zion-pool.service -f | grep auxpow` for:
   - `auxpow_revenue_recorded` — confirms revenue tracking works
   - `profit_switch` — confirms auto coin switching works
5. Implement CLI AuxPow commands (`zion auxpow status`, `zion auxpow config`)
6. Integrate live API (`fetch_profit_snapshot`) into bridge loop for real-time profitability
