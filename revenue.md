# ZION V3 Revenue System

> **Status:** Production-ready (mainnet-track)  
> **Model:** 50/25/25 (ZION / Multi-Algo / NCL)  
> **Slot fee:** 2–10 % depending on source  
> **Canonical source:** `V3/docs/REVENUE_SYSTEM.md`, `V3/L1/cosmic-harmony/src/revenue.rs`  
> **Config:** `config/ch3_revenue_settings.json`  

---

## 1. Philosophy

The revenue system separates user mining (ZION-first) from backend revenue streams. When a miner connects to the pool, the pool decides where the share is credited. The miner does not need to know the internal revenue logic.

**Default behaviour:**
- User sessions are pinned to the ZION group
- Backend sessions may enter the auto multistream scheduler
- Auto assignment happens at connect time (session pinning), not per-share rotation

---

## 2. The 50/25/25 Model

| Stream | Allocation | Description |
|--------|-----------|-------------|
| **ZION** | 50 % | CosmicHarmony pipeline (Keccak → SHA3 → GoldenMatrix → MemoryHard → NPU Mix → CosmicFusion) |
| **Multi-Algo External** | 25 % | Profit-switch mining on external pools → BTC payout |
| **NCL AI** | 25 % | Neural Compute Layer — AI inference tasks |

**Free byproducts** (no extra compute cost):
- ETC — Keccak256 export from Stage 1
- NXS — SHA3-512 export from Stage 2

---

## 3. Revenue Sources (`RevenueSource`)

| Source | Fee Rate | Description |
|--------|----------|-------------|
| `Zion` | 5 % | Canonical ZION mining |
| `KeccakBonus` | 5 % | Merged mining byproduct (ETC) |
| `Sha3Bonus` | 5 % | Merged mining byproduct (NXS) |
| `Blake3External` | 2 % | DCR, ALPH — shares Blake3 with ZION internals |
| `KHeavyHashExternal` | 2 % | KASPA |
| `EthashExternal` | 2 % | ETC, EVR, MEWC |
| `KawPowExternal` | 2 % | RVN, CLORE |
| `AutolykosExternal` | 2 % | ERGO |
| `RandomXExternal` | 2 % | XMR |
| `ZelHashExternal` | 2 % | FLUX |
| `NclAi` | 10 % | AI compute layer |
| `ProfitSwitch` | 2 % | Auto-switch algorithm selection |

**Protocol-level ZION block fee split:**
- 89 % miner
- 5 % humanitarian
- 5 % issobella
- 1 % pool fee

---

## 4. Architecture

### 4.1 Session Classification (Pool)

On `hello` message the pool determines `SessionGroup`:

| Group | Revenue Source | Rule |
|-------|---------------|------|
| `zion` | `RevenueSource::Zion` | Default for users |
| `revenue` | `RevenueSource::Blake3External` | Backend revenue stream |
| `ncl` | `RevenueSource::NclAi` | AI compute |
| `auto` | Lane assignment | Automatic selection |

**Decision chain:**
1. Explicit hint in `miner_id` or `worker_name`: `g=zion`, `g=revenue`, `g=ncl`, `g=auto`
2. Backend allowlist by `miner_id`
3. Backend hint substring in `worker_name`
4. Fallback to `ZION_USER_DEFAULT_GROUP` (default `zion`)

### 4.2 Lane Routing (`RevenueScheduler`)

- **Single lane mode:** everything goes through one source/value
- **Multistream mode:** weighted round robin over lane plan

**Canonical pool-side distribution:**
- Zion lane: 50 %
- Blake3External lane: 25 %
- NclAi lane: 25 %

**Auto assignment:** session gets its lane at connect time and stays pinned.

### 4.3 Submission Flow

1. Pool selects lane/source based on session group
2. Pool validates share + optional node `submit_candidate`
3. `record_revenue(source, value_usd, qualifies)` into `CoreRuntime`
4. Result goes back to miner

---

## 5. Code Components

### 5.1 `zion-cosmic-harmony` — Revenue Module

`V3/L1/cosmic-harmony/src/revenue.rs`

- `RevenueCollector` — thread-safe collector (`Arc<RwLock<RevenueStats>>`)
- `track_event()` — external revenue in USD
- `track_zion_block()` — canonical ZION blocks (flowers), idempotent by height
- `track_deeksha_streams()` — granular per-pipeline-step accounting
- `process_payout()` / `process_payout_zion()` — flush pending fees
- Circuit breaker: 10 consecutive failures → open, 60 s reset

### 5.2 `RevenueJournal` — Audit Log

`V3/L1/cosmic-harmony/src/revenue_journal.rs`

- Append-only JSON Lines (`revenue_YYYY-MM-DD.jsonl`)
- Daily rotation, 90-day retention (configurable via `ZION_REVENUE_JOURNAL_DAYS`)
- Replay on startup to reconstruct state
- Payload types: `ZionBlock`, `Event`, `Payout`, `PayoutZion`

### 5.3 `StreamLayers` — Deeksha Telemetry

`V3/L1/cosmic-harmony/src/stream_layers.rs`

Maps each pipeline step to a revenue stream:

| Step | Revenue Stream | Work Units |
|------|---------------|------------|
| Keccak256 | `KeccakBonus` | 5 |
| SHA3-512 | `Sha3Bonus` | 5 |
| GoldenMatrix | `Zion` | 10 |
| MemoryHard | `Zion` | 40 |
| NPU Mix | `NclAi` | 25 |
| CosmicFusion | `Zion` | 15 |

### 5.4 `ProfitRouter` — External Coins

`V3/L1/cosmic-harmony/src/profit_router.rs`

- 11 supported external coins: DCR, ALPH, KAS, ERG, RVN, ETC, EVR, MEWC, FLUX, CLORE, XMR
- Pool preference hierarchy: NiceHash → HeroMiners → ZPool → Default
- `select_best_coin()` with hysteresis to avoid flip-flopping

### 5.5 Pool Server

`V3/L1/pool/src/bin/server.rs`

- `RevenueScheduler` with weighted lane plan
- Session group resolution from env + miner hints
- In-memory routing stats (total/per-group/per-source submits & accepts)
- Periodic `routing_snapshot` logs

### 5.6 Miner DCR Worker

`V3/L1/miner/src/dcr_worker.rs`

- Background thread inside `zion-miner`
- Blake3 hash (shares hash function with ZION pipeline)
- Stratum v1 protocol → 2miners
- Revenue tracking in micro-cents (1 USD = 100_000_000)
- GPU autotune + configurable work size
- CPU fallback via `blake3` crate (SSE2/AVX2/AVX-512/NEON)

---

## 6. Configuration

### 6.1 JSON Config

`config/ch3_revenue_settings.json`

Key sections:
- `streams` — 5 streams (zion, etc, nxs, dynamic_gpu, ncl)
- `profit_switching` — intervals, thresholds, pool preference
- `buyback` — auto-convert BTC → ZION via MoneroOcean
- `pool_dashboards` — 9 API endpoints for external pool monitoring
- `desktop_agent_dual_mining` — model: ZION (N-1)T + Revenue 1T

### 6.2 Environment Variables

**Pool routing:**

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_REVENUE_MULTISTREAM` | `false` | Enable multistream mode |
| `ZION_STREAM_ZION_PCT` | `50` | ZION lane weight |
| `ZION_STREAM_BLAKE3_PCT` | `25` | Blake3 lane weight |
| `ZION_STREAM_NCL_PCT` | `25` | NCL lane weight |
| `ZION_USER_DEFAULT_GROUP` | `zion` | Default session group |
| `ZION_BACKEND_WORKER_HINTS` | — | Substrings marking backend workers |
| `ZION_BACKEND_AUTO_INCLUDE_ZION` | `false` | Whether auto-assignment includes ZION lane |
| `ZION_ROUTING_LOG_EVERY` | `25` | Log snapshot every N submits |
| `ZION_ROUTING_METRICS_BIND` | — | TCP bind for routing metrics JSON |

**Miner:**

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_DCR_ENABLED` | — | Enable DCR stealth worker |
| `ZION_DCR_POOL` | `dcr.2miners.com:3333` | DCR pool address |
| `ZION_DCR_THREADS` | `1` | DCR worker threads |
| `ZION_DCR_BACKEND` | `auto` | `auto`/`cpu`/`gpu` |
| `ZION_BTC_WALLET` | — | BTC payout address |
| `ZION_GPU_WORK_SIZE` | `1<<20` | GPU work size |
| `ZION_GPU_AUTOTUNE` | — | Enable GPU autotune |

**Journal:**

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_REVENUE_JOURNAL_DIR` | `./data/revenue_journal` | Journal directory |
| `ZION_REVENUE_JOURNAL_DAYS` | `90` | Retention period |

### 6.3 Recommended Production Config

```bash
ZION_REVENUE_MULTISTREAM=true
ZION_STREAM_ZION_PCT=50
ZION_STREAM_BLAKE3_PCT=25
ZION_STREAM_NCL_PCT=25
ZION_USER_DEFAULT_GROUP=zion
ZION_BACKEND_WORKER_HINTS=backend,revenue,ncl
ZION_BACKEND_AUTO_INCLUDE_ZION=false
ZION_ROUTING_LOG_EVERY=25
```

Backend miners should use worker names like:
- `backend-revenue-01`
- `backend-ncl-01`

User miners should have no group hint or explicitly `g=zion`.

---

## 7. DCR Dual Mining

**One BTC address = all 2miners pools**

2miners always pays out in BTC to the provided Bitcoin address. No need for DCR/ALPH/KAS/etc. wallets.

| Coin | Pool | Algorithm | Payout |
|------|------|-----------|--------|
| DCR | `dcr.2miners.com:3333` | Blake3 | → BTC |
| ALPH | `alph.2miners.com:4545` | Blake3 | → BTC |
| KAS | `kas.2miners.com:4444` | kHeavyHash | → BTC |
| ERG | `erg.2miners.com:3056` | Autolykos | → BTC |
| RVN | `rvn.2miners.com:6060` | KawPow | → BTC |
| ETC | `etc.2miners.com:1010` | Ethash | → BTC |
| FLUX | `flux.woolypooly.com:3000` | ZelHash | → BTC |

Stratum authorize format: `BTC_ADDRESS.worker_name` — pool auto-detects BTC payout from address format (`bc1q...`, `1...`, `3...`).

---

## 8. Web Interface

### Admin Panel (`/admin/revenue-v3`)

`APP&WEB/website-v2.9/src/app/admin/revenue-v3/page.tsx`

- NCL AI settings (NPU allocation, target share)
- ZION Native Chain (target share)
- ETC Stream (pool URL, wallet)
- NXS Stream (pool URL, wallet)
- Save / refresh config

### API Endpoint (`/api/v2.9/revenue/config`)

`APP&WEB/website-v2.9/src/app/api/v2.9/revenue/config/route.ts`

- **GET:** load JSON config from `config/ch3_revenue_settings.json`
- **POST:** merge + save config (deep merge on `streams`)

---

## 9. Safety Features

- **Circuit breaker:** 10 consecutive failures → open, 60 s cooldown before retry
- **Idempotence:** `track_zion_block` deduplicates by block height (`seen_heights` HashSet)
- **Audit journal:** append-only JSONL, daily rotation, replayable on startup
- **Overflow protection:** `checked_add` fold on all summations
- **Fee minimum:** enforced for UTXO transactions (except bridge unlock)
- **Session pinning:** auto sessions assigned at connect time, no per-share rotation

---

## 10. Test Coverage

| Crate | Tests | Coverage |
|-------|-------|----------|
| `zion-cosmic-harmony` | merged mining fee rate, profit switch fee, blake3 external fee, non-qualifying revenue, ZION block split | ✅ |
| `zion-pool` | session group resolution, weighted scheduler, revenue tracking in share submission, routing stats | ✅ |
| `zion-core` | runtime revenue tracking, RPC `GetRevenue` endpoint | ✅ |

---

## 11. Key Files

| File | Purpose |
|------|---------|
| `V3/docs/REVENUE_SYSTEM.md` | Full revenue system documentation |
| `V3/L1/cosmic-harmony/src/revenue.rs` | RevenueCollector, RevenueSource, RevenueStats |
| `V3/L1/cosmic-harmony/src/revenue_journal.rs` | Append-only audit log |
| `V3/L1/cosmic-harmony/src/profit_router.rs` | External coin routing & profitability |
| `V3/L1/cosmic-harmony/src/stream_layers.rs` | Deeksha pipeline telemetry |
| `V3/L1/pool/src/bin/server.rs` | Pool scheduler, session classification |
| `V3/L1/pool/src/lib.rs` | Share submission with revenue tracking |
| `V3/L1/miner/src/dcr_worker.rs` | DCR stealth worker |
| `V3/L1/miner/src/dcr_gpu.rs` | DCR OpenCL GPU backend |
| `V3/L1/core/src/lib.rs` | CoreRuntime revenue integration |
| `V3/docs/DCR.md` | DCR dual-mining specification |
| `config/ch3_revenue_settings.json` | Revenue configuration JSON |
| `APP&WEB/website-v2.9/src/app/admin/revenue-v3/page.tsx` | Web admin UI |
| `APP&WEB/website-v2.9/src/app/api/v2.9/revenue/config/route.ts` | Config REST API |

---

## 12. Roadmap Context

From the master roadmap (`ROADMAP.md`):

**Revenue is part of Phase 3 — DeFi Ecosystem (Q2-Q3 2026):**

- Wave 3: DEX & Swap (May–June)
  - [ ] Uniswap V3 seed liquidity (wZION/ETH)
  - [x] Swap UI on web — Uniswap widget (ETH↔wZION)
  - [x] Price feed oracle — `/api/defi/price` (Uni V3 slot0 + Chainlink WETH/USD)
  - [x] Swap Aggregator backend — `V3/L2/swap-aggregator/` Rust/Axum
  - [ ] Swap integration into desktop/mobile
  - [ ] Best-route calculation (multi-hop)

- The revenue system feeds into the broader DeFi ecosystem through:
  - Pool dashboard monitoring (`/explorer`, `/dashboard`)
  - Buyback pipeline (BTC → ZION via MoneroOcean)
  - DAO treasury contributions from pool fees

**Target:** MainNet Genesis — 31 December 2026

---

## 13. Test Results (2026-05-18)

### Unit Tests — 21/21 PASSED

| Crate | Tests | Status |
|-------|-------|--------|
| `zion-cosmic-harmony` | 11 | fee rates, block split, idempotence, health, deeksha streams |
| `zion-pool` | 8 | session routing, weighted scheduler, revenue tracking |
| `zion-core` | 2 | runtime revenue, ZION block revenue |

Run with:
```bash
cargo test --manifest-path V3/Cargo.toml -p zion-cosmic-harmony -- revenue
cargo test --manifest-path V3/Cargo.toml -p zion-pool -- revenue
cargo test --manifest-path V3/Cargo.toml -p zion-core --lib -- runtime_tracks
```

### E2E Smoke Test — 12/12 PASSED

Test script: `tests/revenue_e2e_smoke.py`

| Scenario | Session Group | Share | Routing Snapshot |
|----------|--------------|-------|------------------|
| **A — User Session** (`rig-01`) | `zion` | Accepted | `zion={submits:1,accepted:1,pct:100.0%}` |
| **B — Backend Session** (`backend-revenue`) | `revenue` | Accepted | `revenue={submits:1,accepted:1,pct:100.0%}`, `src_blake3={submits:1,accepted:1,pct:100.0%}` |
| **C — Explicit Hint** (`rig-g=revenue`) | `revenue` | Accepted | `revenue={submits:1,accepted:1,pct:100.0%}`, `src_blake3={submits:1,accepted:1,pct:100.0%}` |

Run with:
```bash
python tests/revenue_e2e_smoke.py
```

---

*Generated with [Devin](https://cli.devin.ai/docs)*
