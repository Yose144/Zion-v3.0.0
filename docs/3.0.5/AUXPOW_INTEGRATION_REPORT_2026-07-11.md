# AuxPow Merge Mining Integration Report

**Date:** 2026-07-11
**Commits:** `44371aa10` (AuXpow crate), `0a49a3f48` (pool + dashboard integration)
**Server:** Edge `62.171.141.136` — deployed and verified
**Tests:** 146/146 pass (40 auxpow + 73 pool lib + 33 pool server)

---

## 1. Overview

ZION's mining power (deeksha_lite_v1 algorithm) is custom — no external coin uses it directly. The AuxPow (Auxiliary Proof-of-Work) merge mining system bridges this gap by running a Stratum v1 proxy that connects to external mining pools (DCR, ALPH, KAS, ERG, RVN, ETC, EVR, MEWC, FLUX, CLORE, XMR) and mines the most profitable coin using the pool server's own compute.

The system is **env-gated** (`ZION_AUXPOW_ENABLED=1`) and runs on a dedicated tokio runtime, completely isolated from the pool's std::thread-based architecture. When disabled (default), it adds zero overhead — the scheduler is a no-op that returns empty stats.

### 3-Phase Plan

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 1** | Pool mines external coin directly via Stratum proxy | **IMPLEMENTED** |
| **Phase 2** | Miner dual-stratum (miners connect to both ZION + external pool) | Planned |
| **Phase 3** | True AuxPow protocol hard fork (byproduct in coinbase) | Planned |

See [`AUXPOW_MERGE_MINING_PLAN.md`](../../AUXPOW_MERGE_MINING_PLAN.md) for the full 3-phase design document.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Pool Server (std::thread)               │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Stratum    │  │  PPLNS      │  │  Metrics :8455  │  │
│  │  :8444      │  │  Engine     │  │  /stats         │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
│         │                │                   │           │
│         │    ┌───────────┴────────────┐      │           │
│         │    │  AuxPow Scheduler      │      │           │
│         │    │  (dedicated tokio RT)  │      │           │
│         │    │                        │      │           │
│         │    │  ┌──────────────────┐  │      │           │
│         │    │  │  Profit Switcher │  │      │           │
│         │    │  │  (hysteresis)    │  │      │           │
│         │    │  └───────┬──────────┘  │      │           │
│         │    │          │             │      │           │
│         │    │  ┌───────┴──────────┐  │      │           │
│         │    │  │  Stratum v1      │  │      │           │
│         │    │  │  Client          │──┼──────┼──→ External Pool
│         │    │  │  (subscribe,     │  │      │   (e.g. DCR.2miners)
│         │    │  │   authorize,     │  │      │           │
│         │    │  │   submit)        │  │      │           │
│         │    │  └───────┬──────────┘  │      │           │
│         │    │          │             │      │           │
│         │    │  ┌───────┴──────────┐  │      │           │
│         │    │  │  External        │  │      │           │
│         │    │  │  Hashers         │  │      │           │
│         │    │  │  (Blake3,        │  │      │           │
│         │    │  │   kHeavyHash)    │  │      │           │
│         │    │  └──────────────────┘  │      │           │
│         │    └────────────────────────┘      │           │
│         │                         │          │           │
│         └─────────────────────────┘          │           │
│                                              ▼           │
│                                    /stats "auxpow"       │
│                                    { 13 fields }         │
│                                              │           │
│                                              ▼           │
│                                    Dashboard             │
│                                    AuxPow Card           │
└─────────────────────────────────────────────────────────┘
```

---

## 3. AuXpow Crate

**Location:** `AuXpow/` (workspace member)
**Crate name:** `zion-auxpow`
**Deps:** blake3, serde, serde_json, tokio (rt-multi-thread, net, io-util, time, sync), sha3, tracing, anyhow, chrono

### 3.1 Files

| File | Purpose |
|------|---------|
| `src/lib.rs` | Module declarations + re-exports |
| `src/types.rs` | `ExternalCoin` enum (11 coins), `CoinProfile`, `ProfitEntry`, `AuxPowConfig`, `AuxPowStats`, `select_best_coin()` with hysteresis, `fallback_estimates()` |
| `src/external_hashers.rs` | `hash_blake3()`, `hash_blake3_raw()`, `hash_kheavyhash()`, `meets_target()`, `parse_target_hex()`, `ExternalAlgorithm` enum |
| `src/auxpow_client.rs` | `AuxPowClient` Stratum v1 client (subscribe, authorize, submit, poll_messages), `ExternalJob`, `ShareResult` |
| `src/auxpow_scheduler.rs` | `AuxPowScheduler` with profit-switching, circuit breaker, nonce mining loop, `spawn()` / `spawn_on()` / `stats_sync()` / `is_enabled_sync()` |

### 3.2 Supported External Coins (11)

| Coin | Ticker | Algorithm | Default Pool |
|------|--------|-----------|--------------|
| Decred | DCR | Blake3 | dcr.2miners.com:3333 |
| Alephium | ALPH | Blake3 | alph.2miners.com:4545 |
| Kaspa | KAS | kHeavyHash | kas.2miners.com:4444 |
| Ergo | ERG | Autolykos | erg.2miners.com:3056 |
| Ravencoin | RVN | KawPow | rvn.2miners.com:6060 |
| Ethereum Classic | ETC | Etchash | etc.2miners.com:1010 |
| Evrmore | EVR | KawPow | meowpow.eu.mine.zpool.ca:1327 |
| Flux | FLUX | ZelHash | flux.woolypooly.com:3000 |
| Clore.ai | CLORE | KawPow | clore.woolypooly.com:3090 |
| Monero | XMR | RandomX | gulf.moneroocean.stream:10001 |

### 3.3 Key Design Decisions

1. **Dedicated tokio runtime** — The pool server uses `std::thread`, not tokio. The scheduler runs on its own `tokio::runtime::Runtime` with `enable_all()` and thread name "auxpow".

2. **Sync access methods** — `stats_sync()` and `is_enabled_sync()` use `blocking_lock()` / `blocking_read()` for use from non-tokio threads (the pool's metrics handler runs in a std::thread).

3. **Circuit breaker** — After `ZION_AUXPOW_CB_THRESHOLD` (default 5) consecutive failures, the circuit opens and the scheduler pauses for `ZION_AUXPOW_CB_RESET_SECS` (default 300s) before retrying.

4. **Hysteresis** — `select_best_coin()` requires a new coin to be at least `ZION_AUXPOW_HYSTERESIS_PCT` (default 15%) more profitable than the current coin before switching. Prevents flapping.

5. **Profit estimates** — `fallback_estimates()` provides static USD/hashrate estimates for all 11 coins. In production, these should be replaced with live API calls to CoinGecko/WhatToMine.

---

## 4. Pool Server Integration

### 4.1 Changes to `V3/L1/pool/src/bin/server.rs`

- **Import:** `use zion_auxpow::{AuxPowScheduler, AuxPowStats};` (line 22)
- **Scheduler creation:** Before metrics thread (line 416-437), creates `AuxPowScheduler::from_env()`, spawns on dedicated tokio runtime if enabled
- **Metrics thread:** `auxpow_scheduler` Arc passed to `serve_routing_metrics()`
- **`/stats` handler:** Calls `auxpow_scheduler.stats_sync()`, passes to `build_stats_payload()`
- **`build_stats_payload()`:** New `auxpow: &AuxPowStats` parameter, emits 13-field JSON section

### 4.2 `/stats` API — New `auxpow` Section

```json
{
  "auxpow": {
    "enabled": false,
    "current_coin": null,
    "current_pool": null,
    "current_algorithm": null,
    "shares_submitted": 0,
    "shares_accepted": 0,
    "shares_rejected": 0,
    "revenue_usd": 0.0,
    "consecutive_failures": 0,
    "circuit_open": false,
    "uptime_secs": 13,
    "coin_switches": 0,
    "last_switch_ts": null
  }
}
```

### 4.3 Changes to `V3/L1/pool/Cargo.toml`

```toml
zion-auxpow = { path = "../../../AuXpow" }
```

---

## 5. Dashboard Integration

### 5.1 `ZION_OS/dashboard/app.py`

- `get_pool_miners_dashboard()` — New section 9b: extracts `auxpow` from pool `/stats` response and passes through as `result["auxpow"]`

### 5.2 `ZION_OS/dashboard/dashboard.html`

New **"AuxPow Merge Mining"** card in the Pool Miners tab (between Routing Breakdown and Miner Leaderboard), with 3 rows of 4 metrics:

| Row | Fields |
|-----|--------|
| 1 | Status, Current Coin, Algorithm, Pool |
| 2 | Shares Submitted, Accepted/Rejected, Revenue (USD), Uptime |
| 3 | Coin Switches, Last Switch, Consecutive Failures, Circuit Breaker |

Status badge: green (Active), red (Circuit Open), gray (Disabled).

### 5.3 `ZION_OS/dashboard/dashboard.js`

New AuxPow panel population logic in `loadPoolMinersTab()`:
- Reads from `data.auxpow` (or `stats.auxpow` fallback)
- Sets all 12 DOM elements with proper formatting and color coding
- Badge updates: `🟢 Active` / `⛔ Circuit Open` / `⚪ Disabled`

---

## 6. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_AUXPOW_ENABLED` | `0` | Master switch — set to `1` to enable |
| `ZION_AUXPOW_WALLET` | `""` | Wallet address for external pool payouts |
| `ZION_AUXPOW_WORKER_NAME` | `zion-auxpow` | Worker name reported to external pool |
| `ZION_AUXPOW_ALLOCATION` | `0.3` | Fraction of compute allocated to external mining (0.0-1.0) |
| `ZION_AUXPOW_POOL_PREFERENCE` | `""` | Preferred coin (overrides profit switching) |
| `ZION_AUXPOW_REGION` | `eu` | Region for pool selection |
| `ZION_AUXPOW_CHECK_INTERVAL` | `60` | Profit re-evaluation interval (seconds) |
| `ZION_AUXPOW_HYSTERESIS_PCT` | `15` | Min profit advantage to switch coins (%) |
| `ZION_AUXPOW_CB_THRESHOLD` | `5` | Consecutive failures to open circuit breaker |
| `ZION_AUXPOW_CB_RESET_SECS` | `300` | Circuit breaker cooldown (seconds) |

---

## 7. Deployment Verification

### 7.1 Edge Server (62.171.141.136)

| Check | Result |
|-------|--------|
| Pool binary deployed | `/usr/local/bin/zion-pool-server` (2.2 MB, 48 auxpow strings) |
| Pool service active | `systemctl is-active zion-pool.service` → `active` |
| Pool startup log | `auxpow: disabled (set ZION_AUXPOW_ENABLED=1 to enable)` |
| `/stats` auxpow section | 13 fields, `enabled: false` |
| Dashboard service active | `systemctl is-active zion-dashboard.service` → `active` |
| Dashboard API auxpow | `/api/pool/miners-dashboard` → `auxpow.enabled=False`, 13 keys |
| Binary backup | `/usr/local/bin/zion-pool-server.bak-20260711-*` (2 backups) |
| Dashboard backup | `/root/zion-dashboard/*.bak-20260711-*` (3 backups) |

### 7.2 Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| AuXpow crate (types, hashers, client, scheduler) | 40 | ALL PASS |
| Pool lib (pplns, routing, bridge) | 73 | ALL PASS |
| Pool server (integration) | 33 | ALL PASS |
| **Total** | **146** | **ALL PASS** |

---

## 8. Activation Procedure

To enable AuxPow merge mining on the edge server:

```bash
ssh zion-new

# 1. Edit the pool service to add env vars
sudo systemctl edit zion-pool.service

# Add in the override section:
[Service]
Environment="ZION_AUXPOW_ENABLED=1"
Environment="ZION_AUXPOW_WALLET=<your-external-pool-wallet>"
Environment="ZION_AUXPOW_WORKER_NAME=zion-pool"
Environment="ZION_AUXPOW_ALLOCATION=0.3"

# 2. Reload systemd + restart pool
sudo systemctl daemon-reload
sudo systemctl restart zion-pool.service

# 3. Verify
journalctl -u zion-pool.service --since '1 min ago' | grep auxpow
curl -s http://127.0.0.1:8455/stats | python3 -m json.tool | grep -A15 auxpow
```

---

## 9. Existing Infrastructure Leveraged

The AuxPow system builds on existing ZION infrastructure:

| Component | Location | Role |
|-----------|----------|------|
| `profit_router.rs` | `V3/L1/cosmic-harmony/src/profit_router.rs` | 11 external coins, pool endpoints, `select_best_coin()` — AuXpow reuses the same coin list + hysteresis pattern |
| `revenue.rs` | `V3/L1/cosmic-harmony/src/revenue.rs` | 13 `RevenueSource` variants, `RevenueCollector` with USD tracking, circuit breaker, fee structure (merged_mining 5%, profit_switch 2%, blake3_external 2%) |
| `stream_layers.rs` | `V3/L1/cosmic-harmony/src/stream_layers.rs` | Byproduct extractors for Keccak256/SHA3-512 intermediates, stream-aware hash wrappers |
| Legacy `merged_mining.rs` | `archive/2.9.9/legacy-code/L1/pool/src/merged_mining.rs` | `MergedMiningManager` scaffolding — reference for byproduct sampling pattern |

---

## 10. Future Work

### Phase 2: Miner Dual-Stratum
Miners connect to both ZION pool and an external pool simultaneously. The ZION pool injects the external coin's block header into the ZION coinbase, enabling true merge mining without the pool server doing the external hashing itself.

### Phase 3: True AuxPow Protocol
Hard fork that embeds an external coin's byproduct hash in the ZION coinbase transaction. Miners find a ZION block that also satisfies the external coin's target, submitting to both chains. Requires consensus changes + height gating.

### Live Profit Estimates
Replace `fallback_estimates()` with live API calls to CoinGecko/WhatToMine for real-time USD/hashrate data. Cache results with 60s TTL.

### Dashboard Enhancements
- Historical revenue chart (24h/7d/30d)
- Per-coin breakdown table
- Profit switching timeline visualization

---

## 11. Files Changed

| File | Commit | Lines |
|------|--------|-------|
| `AuXpow/Cargo.toml` | `44371aa10` | New (crate manifest) |
| `AuXpow/src/lib.rs` | `44371aa10` | New (module declarations) |
| `AuXpow/src/types.rs` | `44371aa10` | New (11 coins, config, stats, profit switching) |
| `AuXpow/src/external_hashers.rs` | `44371aa10` | New (Blake3, kHeavyHash, target validation) |
| `AuXpow/src/auxpow_client.rs` | `44371aa10` | New (Stratum v1 client) |
| `AuXpow/src/auxpow_scheduler.rs` | `44371aa10` + `0a49a3f48` | New + `spawn_on()`/`stats_sync()` methods |
| `Cargo.toml` | `44371aa10` | +`"AuXpow"` workspace member |
| `V3/L1/pool/Cargo.toml` | `0a49a3f48` | +`zion-auxpow` dependency |
| `V3/L1/pool/src/bin/server.rs` | `0a49a3f48` | +46 lines (scheduler spawn, stats integration) |
| `ZION_OS/dashboard/app.py` | `0a49a3f48` | +9 lines (auxpow passthrough) |
| `ZION_OS/dashboard/dashboard.html` | `0a49a3f48` | +62 lines (AuxPow card) |
| `ZION_OS/dashboard/dashboard.js` | `0a49a3f48` | +38 lines (AuxPow panel logic) |
| `AUXPOW_MERGE_MINING_PLAN.md` | `44371aa10` | New (3-phase plan document) |

---

## 12. Commits

1. **`44371aa10`** — `feat(auxpow): standalone merge-mining crate — stratum proxy + external hashers`
2. **`0a49a3f48`** — `feat(auxpow): integrate merge-mining into pool server + dashboard`

Both pushed to `origin/main`.
