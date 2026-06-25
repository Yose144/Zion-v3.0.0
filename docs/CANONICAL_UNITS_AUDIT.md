# ZION Canonical Units Audit — 2026-06-25

> **Source of truth:** `AGENTS.md` → "Canonical Units (FLOWERS_PER_ZION)"
> defines **flowers** as the on-chain sub-unit name, used by L1 core
> (Rust), JSON-RPC, pool payouts, wallets, bridges, and explorer.
> Higher layers (UI, dashboards) must convert flowers → ZION at the
> system boundary only.

This document audits unit naming and conversion consistency across:
- L1 core (`V3/L1/core`)
- Pool + wallet RPC
- ZionOS dashboard (`ZION_OS/dashboard/app.py`)
- Website (`APP&WEB/website-v2.9`)
- Bridge / DAO / Atomic-Swap / WARP daemons

It also captures the verified backend endpoint matrix that the website
and dashboards consume, so cross-layer integrations stay coherent.

---

## 1. Canonical Definitions

| Concept | Canonical name | Value |
|---------|----------------|-------|
| ZION (display unit) | `ZION` | 1 ZION |
| Sub-unit (on-chain) | `flowers` | 1 ZION = **10¹² flowers** |
| Conversion constant | `FLOWERS_PER_ZION` | `1_000_000_000_000` |
| Decimal places | 12 | — |

**Rule:** Anything that crosses the network (RPC payload, P2P message,
DB row, ledger entry) **MUST** be in flowers and the field name **MUST**
end with `_flowers`. UI/dashboard converts at the rendering boundary.

### Reference constants (Rust / TS)

| Layer | File | Constant |
|-------|------|----------|
| L1 core | `V3/L1/core/src/emission.rs:11` | `FLOWERS_PER_ZION: u64 = 1_000_000_000_000` |
| L1 wallet | `V3/L1/core/src/wallet.rs:156` | `FLOWERS_PER_ZION` |
| Pool | `V3/L1/pool/src/payout.rs` | `FLOWERS_PER_ZION` |
| Website | `APP&WEB/website-v2.9/src/lib/constants.ts` | `FLOWERS_PER_ZION` (added 2026-06-25); `ATOMIC_UNITS_PER_ZION` retained as deprecated alias |
| Website RPC | `APP&WEB/website-v2.9/src/lib/zion-rpc.ts` | `ATOMIC_PER_ZION` (local) — to migrate to `FLOWERS_PER_ZION` |

### Conversion helpers (TS)

```ts
import { FLOWERS_PER_ZION, flowersToZion, zionToFlowers } from '@/lib/constants';

// Render balance from RPC payload
const balanceZion = flowersToZion(rpc.balance_flowers);

// Build a transfer amount
const amount_flowers = zionToFlowers(userInputZion);
```

`atomicToZion` / `zionToAtomic` are **deprecated** aliases — new code
must use the `flowers` variants. The deprecated names are kept only so
existing call sites keep building during the migration.

---

## 2. Field Naming Convention (RPC, REST, DB)

| Field suffix | Type | Meaning |
|--------------|------|---------|
| `_flowers` | integer (u64 / string for large values) | On-chain amount in flowers |
| `_zion` | float (max 12 fractional digits) | Pre-converted display amount in ZION |
| `_pct` | integer 0..100 or float 0..1 | Percentage |
| `_h` / `_hashrate` | integer | Hashes per second |

**Examples (canonical):**

```json
{
  "balance_flowers": "590000000000000000000",
  "amount_flowers": 5400067000000000,
  "fee_flowers": 5000000000,
  "miner_reward_zion": 4806.0596,
  "block_reward_zion": 5400.067
}
```

**Anti-patterns to remove during migration:**

- `amount_zion` returning flowers (legacy mis-naming in account model)
- `fee_zion` returning flowers (same)
- Bare `amount` / `balance` numeric fields without an explicit suffix
- `atomic` / `atomic_units` / `_atomic` field names — these still
  appear in `dao-api.ts` (`available_atomic`, `amount_atomic`) and
  should be renamed to `_flowers` when the DAO API contract is next
  versioned

---

## 3. Inconsistencies Found in the Website

| File | Symbol | Issue | Action |
|------|--------|-------|--------|
| `src/lib/constants.ts` | `ATOMIC_UNITS_PER_ZION`, `atomicToZion`, `zionToAtomic` | "atomic" instead of canonical "flowers" | ✅ Fixed 2026-06-25 — added `FLOWERS_PER_ZION`, `flowersToZion`, `zionToFlowers`; old names kept as `@deprecated` aliases |
| `src/lib/zion-rpc.ts:282` | local `ATOMIC_PER_ZION` | Duplicates the constant; should import canonical | Follow-up: import from `constants.ts` |
| `src/lib/dao-api.ts` | `available_atomic`, `amount_atomic` | Mixed with `weightFlowers` in same file | Follow-up: align with DAO daemon's next contract bump (rename to `_flowers`) |
| `src/lib/swap-api.ts:8` | `amount_flowers` | ✅ Already canonical | — |
| `src/components/MinerDashboard.tsx:103,116,452` | raw `1e12` divisions | Magic number forbidden per file header in `constants.ts` | Follow-up: import `FLOWERS_PER_ZION` |
| `src/components/NetworkStatus.tsx:335` | raw `1e12` for hashrate `TH/s` | Different domain (hashrate, not flowers); kept as-is | — |

Search command to find remaining offenders:

```sh
grep -nE "atomic|/\\s*1e12|\\* 1e12|FLOWERS_PER_ZION|ATOMIC" \
  -r APP\&WEB/website-v2.9/src
```

---

## 4. Backend Endpoint Matrix

### 4.1 Edge server topology

| Host | Role | Public IP | Internal (Tailscale) |
|------|------|-----------|----------------------|
| Edge | Primary node, pool, DAO, bridge, swap, WARP | `77.42.71.94` | `100.76.16.108` |

Source: `ZION_OS/dashboard/nodes.json`, `ZION_OS/dashboard/app.py` (`EDGE_HOST` / `EDGE_PUBLIC_IP`).

### 4.2 Layer-1 (Node + Pool)

| Port | Service | Protocol | Owner | Consumed by |
|------|---------|----------|-------|-------------|
| 8333 | Node P2P | TCP | `zion-edge-node1` | Other nodes |
| 8334 | Node 2 P2P | TCP | `zion-edge-node2` | — |
| 8443 | Node JSON-RPC | TCP | `zion-edge-node1` | Pool, dashboard, website explorer |
| 8444 | Pool Stratum | TCP | `zion-edge-pool` | Miners |
| 8445 | Node 1 WS | TCP | `zion-edge-node1` | Dashboard live feed |
| 8446 | Node 2 RPC | TCP | `zion-edge-node2` | Dashboard |
| 8455 | Pool metrics (Prometheus) | HTTP | `zion-edge-pool` | Dashboard, Prometheus |

### 4.3 Layer-2 / Layer-3

| Port | Service | API | Owner | Consumed by |
|------|---------|-----|-------|-------------|
| 8450 | DAO daemon | `/api/dao/*` (Axum) | `zion-edge-dao` | Website (`dao-api.ts`), dashboard |
| 8451 | Bridge daemon | `/api/bridge/*` | `zion-edge-bridge` | Website (`bridge-api.ts`), dashboard |
| 8452 | Atomic-Swap | `/api/swap/*` | `zion-edge-atomic-swap` | Website (`swap-api.ts`) |
| 8453 | WARP relay | `/api/warp/*` | `zion-edge-warp` | Website, dashboard |
| 8094 | OASIS (L4) | `/avatars`, `/quests` | `zion-oasis` | L4 page, dashboard |
| 8095 | Free World (L5) | `/stats`, `/missions` | `zion-free-world` | L5 page, dashboard |
| 8096 | Issobella (L6) | `/stats`, `/missions` | `zion-issobella` | L6 page, dashboard |
| 8001 | Hiranyagarbha | Orchestrator + NCL + RAG | `zion-ai-native-api` | L3 page, dashboard |
| 8002 | Hiran LLM | OpenAI-compatible | `hiran-inference` | Hiranyagarbha |

### 4.4 Operations

| Port | Service | Notes |
|------|---------|-------|
| 9090 | Prometheus | Edge Docker, host network |
| 3100 | Grafana | Edge Docker, host network |
| 9100 | Node exporter | Host system metrics |
| 9115 / 9116 | Node metrics | Per-node Prometheus |
| 8766 | ZionOS dashboard | Local PC (Python HTTP) — aggregates Edge state |
| 8888 | Infra dashboard (Rust) | Edge — unified service grid |

### 4.5 Website ⇄ Backend mapping

Website is statically built (Next.js), but a small set of API routes
under `src/app/api/*` proxies upstream daemons over HTTPS via Caddy on
Edge. The proxy targets are configured via env (e.g. `DAO_UPSTREAM_BASE`).

| Website call | Proxy route | Edge upstream |
|--------------|-------------|---------------|
| `GET /api/bridge/status` | `src/app/api/bridge/status/route.ts` | Bridge daemon `:8451` |
| `GET/POST /api/dao/*` | `src/app/api/dao/[...path]/route.ts` | DAO daemon `:8450` (`DAO_UPSTREAM_BASE`) |
| `GET/POST /api/swap/*` | (proxy) | Atomic-Swap `:8452` |
| `GET /api/pool/stats` | `src/app/api/pool/stats/route.ts` (or `:8455`) | Pool metrics `:8455` |
| `GET /api/pool/miner/<addr>` | proxy | Pool metrics `:8455/miners/<addr>` |
| `GET /api/miner/<addr>` | proxy | Same as above |
| `GET/POST /api/wallet` | `src/app/api/wallet/route.ts` | Node RPC `:8443` (signed via SDK) |
| `apiClient('/blockchain/...')` (explorer) | direct (zion-rpc.ts) | Node RPC `:8443` |

### 4.6 ZionOS dashboard (`ZION_OS/dashboard/app.py`)

The local-PC dashboard exposes ~150 routes that aggregate Edge state.
Key endpoints relevant to backend verification:

- `/api/edge/infra`, `/api/edge/overview`, `/api/edge-status`
- `/api/edge-agent/status`, `/api/edge-agent/telemetry`
- `/api/bridge/status|history|chains|validators`
- `/api/dao/*` (proxied)
- `/api/swap/*`, `/api/swap-aggregator/*`
- `/api/warp/health`
- `/api/oasis/stats|quests`, `/api/freeworld/stats`, `/api/space/stats|missions`
- `/api/mempool`, `/api/blocks`, `/api/block/<hash>`
- `/api/pool/miners`, `/api/payout`, `/api/miner/live|log-tail|shares`
- `/api/explorer`, `/api/wallets`
- `/api/hiran/status|health|chat`, `/api/hiranyagarbha/health`
- `/api/ncl/submit|jobs`
- `/api/metrics/scrape|collector`, `/api/topology`
- `/api/launch-day/status`, `/api/launch-day-prepare|execute`

---

## 5. Explorer Endpoint Canonical Matrix

The website explorer talks to Node RPC `:8443` through the
`apiClient(...)` helper, NOT to the ZionOS dashboard. This is intentional
so the public website can be deployed standalone against any Edge.

| Explorer page / panel | RPC call | Returned amounts |
|-----------------------|----------|------------------|
| `/explorer` (home) | `GET /blockchain/stats` | `total_supply_flowers`, `circulating_supply_flowers`, `block_reward_flowers` |
| `/explorer/blocks` | `GET /blockchain/blocks?from&to` | per-block `reward_flowers`, `fees_flowers` |
| `/explorer/transactions` | `GET /blockchain/transactions?limit&offset` | `amount_flowers`, `fee_flowers` |
| `/explorer/supply` | `GET /blockchain/emission` + `/blockchain/stats` | `mined_supply_flowers`, `emission_pct` |
| `/explorer/fee-estimator` | `GET /blockchain/mempool` | `fee_stats.{min,max,avg,median}` in flowers/byte |
| `/explorer/address/<addr>` | `GET /blockchain/address/<addr>` | `balance_flowers`, `tx_count` |
| `/explorer/block/<hash>` | `GET /blockchain/block/<hash>` | tx outputs in flowers |
| `/explorer/tx/<hash>` | `GET /blockchain/tx/<hash>` | `amount_flowers`, `fee_flowers` |

**Display rule:** Every flowers value in the explorer UI MUST go through
`flowersToZion()` (or be formatted with `formatZion(flowers)` helper)
before rendering. Never render raw `_flowers` values to the user.

---

## 6. Bridge / DAO / Swap Cross-Layer Units

| Layer | Field | Unit | Notes |
|-------|-------|------|-------|
| Bridge L1 lock | `amount_flowers` | flowers | Native ZION locked on L1 |
| Bridge L2 mint (wZION) | EVM `uint256` | wei | 18 decimals (EVM standard), NOT flowers; conversion: `1 ZION = 10¹⁸ wei` in wZION contract |
| DAO proposal weight | `weightFlowers` | flowers | Voting weight = staked balance in flowers |
| DAO treasury op | `amount_atomic` | flowers (mis-named) | Rename to `amount_flowers` in next API version |
| DAO governance balance | `available_atomic` | flowers (mis-named) | Rename to `available_flowers` |
| Atomic-Swap HTLC | `amount_flowers` | flowers | Already canonical |
| WARP relay packet | varies per chain | native unit | Each chain (BTC sats, ETH wei, SOL lamports) keeps its native unit |

**Cross-chain conversion gotcha:** wZION on EVM uses 18 decimals (the
ERC-20 standard), while native ZION uses 12 (flowers). Bridge code at
`V3/L2/bridge/src/relay.rs` performs `flowers × 10⁶` when minting and
`wei / 10⁶` when burning. Any UI showing wZION must NOT use
`flowersToZion()` — it must use `wei / 10¹⁸`.

---

## 7. Verification Checklist (next round)

- [ ] Replace local `ATOMIC_PER_ZION` in `zion-rpc.ts` with import from
      `constants.ts` (`FLOWERS_PER_ZION`).
- [ ] Replace raw `1e12` divisions in `MinerDashboard.tsx`,
      `Pool24hCharts.tsx`, etc. with `flowersToZion()`.
- [ ] Rename DAO daemon fields `available_atomic` /
      `amount_atomic` → `*_flowers` in the next API version, and update
      `dao-api.ts` types in lockstep.
- [ ] Verify Edge endpoints respond as documented:
      ```
      curl -s http://77.42.71.94:8443/blockchain/stats | jq
      curl -s http://77.42.71.94:8450/api/dao/health | jq
      curl -s http://77.42.71.94:8451/api/bridge/status | jq
      curl -s http://77.42.71.94:8452/api/swap/health | jq
      curl -s http://77.42.71.94:8453/api/warp/health | jq
      curl -s http://77.42.71.94:8455/metrics | head -40
      ```
- [ ] Confirm every explorer page renders amounts via `flowersToZion`
      and never displays raw `_flowers` strings.
- [ ] Lock the canonical unit name in a new test:
      `cargo test -p zion-core flowers_per_zion_is_1e12`.

---

## 8. References

- `AGENTS.md` → "Canonical Units (FLOWERS_PER_ZION)" section
- `V3/L1/core/src/emission.rs` — canonical Rust constant
- `APP&WEB/website-v2.9/src/lib/constants.ts` — canonical TS constant
- `ZION_OS/dashboard/app.py` — dashboard endpoint inventory
- `ZIONTHEME.md` §11 — accompanying site-wide theme rollout
