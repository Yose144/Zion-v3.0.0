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

> **⚠️ 3.0.3 fork note:** The 3.0.3 decimal fork changed `FLOWERS_PER_ZION`
> from 1e12 to 1e6. This audit was originally written for the pre-3.0.3
> state (12 decimals). Values below have been updated to reflect the
> 6-decimal post-fork reality. See
> [`ZION_3.0.3_DECIMAL_FORK_PLAN.md`](../ZION_3.0.3_DECIMAL_FORK_PLAN.md)
> for the cutover details.

| Concept | Canonical name | Value |
|---------|----------------|-------|
| ZION (display unit) | `ZION` | 1 ZION |
| Sub-unit (on-chain) | `flowers` | 1 ZION = **10⁶ flowers** |
| Conversion constant | `FLOWERS_PER_ZION` | `1_000_000` |
| Decimal places | 6 | — |

**Rule:** Anything that crosses the network (RPC payload, P2P message,
DB row, ledger entry) **MUST** be in flowers and the field name **MUST**
end with `_flowers`. UI/dashboard converts at the rendering boundary.

### Reference constants (Rust / TS)

| Layer | File | Constant |
|-------|------|----------|
| L1 core | `V3/L1/core/src/emission.rs:11` | `FLOWERS_PER_ZION: u64 = 1_000_000` |
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
| `_zion` | float (max 6 fractional digits) | Pre-converted display amount in ZION |
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
| `src/components/MinerDashboard.tsx:103,116,452` | raw `1e6` divisions | Magic number forbidden per file header in `constants.ts` | Follow-up: import `FLOWERS_PER_ZION` |
| `src/components/NetworkStatus.tsx:335` | raw `1e12` for hashrate `TH/s` | Different domain (hashrate, not flowers); kept as-is | — |

Search command to find remaining offenders:

```sh
grep -nE "atomic|/\\s*1e6|\\* 1e6|FLOWERS_PER_ZION|ATOMIC" \
  -r APP\&WEB/website-v2.9/src
```

---

## 3b. CRITICAL — Live RPC Contract Inconsistencies (probed 2026-06-25)

> **Status:** Verified against the live Edge RPC at
> `http://77.42.71.94:8443/jsonrpc`. **The L1 RPC wire format mixes
> three different unit-naming conventions simultaneously**, in
> violation of the single-source rule in §2.

### 3b.1 `getBalance` — canonical ✅

```jsonc
{
  "address": "zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604",
  "balance_flowers": "2434492936030751903",
  "account_balance_flowers": "2434492936030751903",
  "utxo_balance_flowers": "0",
  "utxo_count": 0,
  "balance_scope": "confirmed_chain_only",
  "chain_height": 15259,
  "transaction_model": "hybrid"
}
```

`getBalance` is the **reference implementation** — every other method
should follow this naming.

### 3b.2 `getSupplyInfo` — uses `_atomic` ❌

```jsonc
{
  "block_reward_atomic": 5400067000000000,        // should be _flowers
  "block_reward_zion": 5400.067,                  // ✅ correct
  "circulating_supply_atomic": "168623996223...", // should be _flowers
  "circulating_supply_zion": 16862399622,         // ✅ correct
  "mined_so_far_atomic": "8239962235...",         // should be _flowers
  "mining_emission_atomic": "1272200...",         // should be _flowers
  "premine_atomic": "16780000000000...",          // should be _flowers
  "remaining_supply_atomic": "127137600377...",   // should be _flowers
  "total_supply_atomic": "1440000000000...",      // should be _flowers
  "height": 15259,
  "supply_mined_percent": "0.064769"
}
```

**Severity:** medium. The values are correct, only the suffix is
non-canonical. Conversion `atomic / 10⁶ = ZION` is identical to
`flowers / 10⁶ = ZION`, so this is a naming problem, not a math
problem.

### 3b.3 `getBlockTemplate` — uses `_zion` for flowers ❌❌

```jsonc
{
  "reward_zion": 5400067000000000,                // ❌ this is flowers, not ZION
  "estimated_miner_reward_zion": 4806059630000000,// ❌ this is flowers
  "total_fees_zion": 2000,                        // ❌ ambiguous — likely flowers
  "total_utxo_fees": 0,
  "transaction_count": 5,
  "height": 15260,
  "template_id": 15260,
  "target_hex": "0000...",
  "header_hex": "0300...",
  "body_hash_hex": "d9fe..."
}
```

**Severity: HIGH.** The `_zion` suffix promises a converted display
value (≤ 6 decimal places), but the value `5400067000000000` is the
flowers form of `5400.067 ZION`. Any UI consumer doing
`displayValue = data.reward_zion` would render `5.4 × 10¹⁵ ZION`
instead of `5400.067 ZION`. The only consumer that gets this right
today is the Rust pool, which knows to divide by 10⁶ regardless of
the suffix.

**Action:** In the next non-breaking RPC version, add
`reward_flowers`, `estimated_miner_reward_flowers`,
`total_fees_flowers`, plus genuine ZION floats
`reward_zion_amount`, etc. Keep the old fields as deprecated for one
release, then remove.

### 3b.4 Three coexisting conventions

| Convention | Where it lives | Status |
|------------|----------------|--------|
| `_flowers` (canonical per AGENTS.md) | `getBalance`, pool metrics, wallet endpoints | ✅ keep, expand |
| `_atomic` (synonym for flowers) | `getSupplyInfo`, DAO daemon (`available_atomic`, `amount_atomic`) | Migrate to `_flowers` (one breaking release) |
| `_zion` containing flowers | `getBlockTemplate.reward_zion`, `total_fees_zion`, `estimated_miner_reward_zion` | **BUG** — must add `_flowers` siblings; `_zion` field name reserved for actual ZION floats |

### 3b.5 Recommended L1 RPC contract bump (non-breaking phase)

```jsonc
// getSupplyInfo (add canonical _flowers fields, keep _atomic as alias)
{
  "block_reward_flowers": 5400067000000000,  // NEW canonical
  "block_reward_atomic":  5400067000000000,  // legacy alias
  "block_reward_zion":    5400.067,          // display ZION
  // ...
}

// getBlockTemplate (rename, keep legacy)
{
  "reward_flowers": 5400067000000000,        // NEW canonical
  "reward_zion_display": 5400.067,           // NEW genuine ZION
  "reward_zion": 5400067000000000,           // legacy (== reward_flowers)
  "estimated_miner_reward_flowers": 4806059630000000,
  "estimated_miner_reward_zion_display": 4806.05963,
  // ...
}
```

---

## 4. Backend Endpoint Matrix

### 4.1 Edge server topology

| Host | Role | Public IP | Internal (Tailscale) |
|------|------|-----------|----------------------|
| Edge | Primary node, pool, DAO, bridge, swap, WARP | `77.42.71.94` | `100.76.16.108` |

Source: `ZION_OS/dashboard/nodes.json`, `ZION_OS/dashboard/app.py`
(`EDGE_HOST` / `EDGE_PUBLIC_IP`).

**UFW exposure (verified 2026-06-25):** Only **ports 8333 (P2P),
8443 (node JSON-RPC), 8444 (pool stratum) and SSH** are reachable
from the public Internet. All L2/L3 daemons (DAO 8450, Bridge 8451,
Swap 8452, WARP 8453, Pool metrics 8455, OASIS/Free-World/Issobella
8094-8096, Hiranyagarbha 8001) are listening on localhost or the
Tailscale interface only. The website's Next.js proxy routes reach
them via Caddy reverse-proxy on the same host, NOT directly from
visitors' browsers.

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

> **Reality check (probed 2026-06-25):** Edge node `:8443` exposes
> only the JSON-RPC endpoint at `POST /jsonrpc`. The REST routes
> `/blockchain/stats`, `/blockchain/blocks`, etc. **do not exist** on
> the public RPC port — every `GET /*` returns the same handshake
> stub `{"status":"ok","service":"zion-v3-rpc","protocol":"jsonrpc-2.0"}`.
> The explorer must therefore go through either (a) JSON-RPC calls or
> (b) the ZionOS dashboard aggregator at `:8766`.

| Explorer page / panel | Recommended source | RPC method / REST path | Returned amounts |
|-----------------------|--------------------|------------------------|------------------|
| `/explorer` (home) | JSON-RPC | `getSupplyInfo` | `*_atomic` (= flowers), `*_zion` (display) — see §3b.2 |
| `/explorer/blocks` | Dashboard `:8766/api/blocks` | aggregated | per-block `reward_flowers`, `fees_flowers` |
| `/explorer/transactions` | Dashboard `:8766/api/explorer` | aggregated | `amount_flowers`, `fee_flowers` |
| `/explorer/supply` | JSON-RPC | `getSupplyInfo` | mix of `_atomic` + `_zion` (see §3b.2) |
| `/explorer/fee-estimator` | Dashboard `:8766/api/mempool` | aggregated | `fee_stats.{min,max,avg,median}` in flowers/byte |
| `/explorer/address/<addr>` | JSON-RPC | `getBalance` | `balance_flowers`, `account_balance_flowers`, `utxo_balance_flowers` ✅ canonical |
| `/explorer/block/<hash>` | JSON-RPC | `getBlock` / `getBlockByHeight` | tx outputs in flowers |
| `/explorer/tx/<hash>` | JSON-RPC | `getTransaction` / `getAccountTransaction` | `amount_flowers`, `fee_flowers` |
| `/explorer/mempool` | Dashboard `:8766/api/mempool` | aggregated | pending tx list |
| Block template (debug) | JSON-RPC | `getBlockTemplate` | ⚠️ `reward_zion` contains flowers — see §3b.3 |

**Display rule:** Every flowers value in the explorer UI MUST go
through `flowersToZion()` (or `formatZion()`) before rendering. Never
render raw `_flowers` or `_atomic` strings to the user. For
`getBlockTemplate.reward_zion`, treat it as flowers regardless of the
suffix (until §3b.5 contract bump lands).

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
ERC-20 standard), while native ZION uses 6 (flowers). Bridge code at
`V3/L2/bridge/src/relay.rs` performs `flowers × 10¹²` when minting and
`wei / 10¹²` when burning. Any UI showing wZION must NOT use
`flowersToZion()` — it must use `wei / 10¹⁸`. *(updated to 6-decimal in 3.0.3 fork)*

---

## 7. Verification Checklist (next round)

### Website code

- [ ] Replace local `ATOMIC_PER_ZION` in `zion-rpc.ts` with import from
      `constants.ts` (`FLOWERS_PER_ZION`).
- [ ] Replace raw `1e6` divisions in `MinerDashboard.tsx`,
      `Pool24hCharts.tsx`, etc. with `flowersToZion()`.
- [ ] Add a type-narrowing helper for `getBlockTemplate` responses
      that treats `reward_zion` / `estimated_miner_reward_zion` /
      `total_fees_zion` as **flowers** (workaround for §3b.3 bug
      until L1 contract bump).

### L1 / RPC (next non-breaking release)

- [ ] Add `_flowers` aliases to every `_atomic` field in
      `getSupplyInfo` (see §3b.5).
- [ ] Add `_flowers` siblings to every mis-named `_zion` field in
      `getBlockTemplate`, plus `_zion_display` for genuine floats.
- [ ] Rename DAO daemon fields `available_atomic` /
      `amount_atomic` → `*_flowers` in the next API version, and
      update `dao-api.ts` types in lockstep.
- [ ] Lock the canonical unit name in a new test:
      `cargo test -p zion-core flowers_per_zion_is_1e6` (already
      covered in `emission.rs` consts, add explicit assertion).

### Edge runtime probes (live)

| Endpoint | Reachable from | Verified 2026-06-25 |
|----------|----------------|---------------------|
| `POST http://77.42.71.94:8443/jsonrpc` | Public | ✅ `getBalance`, `getSupplyInfo`, `getBlockTemplate` all 200 |
| `GET http://77.42.71.94:8443/blockchain/stats` | Public | ❌ Returns JSON-RPC stub (route not implemented as REST) |
| `:8450` DAO, `:8451` Bridge, `:8452` Swap, `:8453` WARP | Public | ❌ Firewalled (UFW). Reachable only via Tailscale / on-host. |
| `:8455` Pool metrics, `:8094-8096` Layer APIs, `:8001` Hiranyagarbha | Public | ❌ Firewalled. Reachable via dashboard `:8766` aggregator on local PC. |
| `POST http://77.42.71.94:8443/jsonrpc {getBalance}` → `balance_flowers` | Public | ✅ Canonical |
| `POST http://77.42.71.94:8443/jsonrpc {getSupplyInfo}` → `_atomic` fields | Public | ⚠️ Non-canonical naming (works, but rename pending) |
| `POST http://77.42.71.94:8443/jsonrpc {getBlockTemplate}` → `reward_zion` containing flowers | Public | ❌ **BUG**: mis-named field |

To rerun the probes:

```sh
curl -sX POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getSupplyInfo","params":{}}' \
  http://77.42.71.94:8443/jsonrpc | jq

curl -sX POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":{"address":"zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604"}}' \
  http://77.42.71.94:8443/jsonrpc | jq

curl -sX POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getBlockTemplate","params":{}}' \
  http://77.42.71.94:8443/jsonrpc | jq
```

### Internal daemons (require Tailscale or on-host SSH)

```sh
ssh -i ~/.ssh/ssh-key-zion-edge root@77.42.71.94 -- \
  'for p in 8450 8451 8452 8453 8455 8094 8095 8096 8001; do
     echo "=== :$p ==="; curl -s -m 4 http://127.0.0.1:$p/health || true;
   done'
```

---

## 8. References

- `AGENTS.md` → "Canonical Units (FLOWERS_PER_ZION)" section
- `V3/L1/core/src/emission.rs` — canonical Rust constant
- `APP&WEB/website-v2.9/src/lib/constants.ts` — canonical TS constant
- `ZION_OS/dashboard/app.py` — dashboard endpoint inventory
- `ZIONTHEME.md` §11 — accompanying site-wide theme rollout
