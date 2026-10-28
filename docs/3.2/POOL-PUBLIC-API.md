# Pool public API — `/public/v1/*` reference

Base URL: `https://pool.zionterranova.com`
Source of truth: `V31/L1/pool/src/api.rs`. Verified against the deployed
binary (EDGE `zion-v31-pool`).

## Access model

| Tier | Paths | Auth |
|---|---|---|
| Public | `/public/v1/*` (the only surface nginx proxies) | none — per-IP rate limit (429 on exceed) |
| Internal | `/api/v1/*` (except `/api/v1/state/*`) | `X-Api-Key: <key>` or `Authorization: Bearer <key>` (`ZION_POOL_API_KEY`) |
| Admin | `/api/v1/admin/*`, `/admin/*` | `ZION_POOL_API_ADMIN_KEY` |
| HA export | `/api/v1/state/{pplns,payouts,db}` | API key, `application/octet-stream` bodies |

The public tier deliberately omits: internal leg addresses/ports,
upstream endpoints, worker login names (miners shown as public aliases),
wallet-existence internals, and anything admin.

**Note:** on `pool.zionterranova.com`, nginx proxies **only**
`/public/v1/*` (plus the pool-ui static routes like `/stats/`).
`/stats`, `/miners`, `/health`, `/metrics` are reachable on the API bind
(loopback / tunnel), not on the public vhost.

## Conventions

- All amounts in **flowers** (`1 ZION = 1e6 flowers`) unless stated —
  returned as **strings** (`"unpaid": "58457578"`) because they exceed
  f64 integer precision. `unpaid_unit` disambiguates external coins.
- Timestamps = unix seconds; `age_s`/`job_age_ms` are relative.
- Hashrate in H/s (synthetic work-equivalent for external streams —
  expected-hashes/s, not physical).
- `?limit=N` caps rows (defaults below; history endpoints cap at 1440).
- Coin ids: `zion` (native), `qtu`, `prl`, `zano`, `vrsc`, `xmr`
  (upstream legs). Empty `{coin}` path segment = `zion`.
- `active`/`online` window = a share in the last **600 s**.

## Public endpoints

### `GET /stats` (alias `/`, `/pool`) — *API bind only*
Full pool snapshot — same payload the ops dashboard uses. Served on the
API bind (`127.0.0.1:8080` on EDGE, `:8090` standby); the public
`pool.zionterranova.com/stats` path is the pool-ui page, not this API.

```json
{
  "ok": true, "uptime_s": 12345,
  "sessions": 4, "total_connections": 120,
  "shares": {"accepted": 1000, "rejected": 12, "total": 1012},
  "pplns": {
    "window_size": 20160, "window_used": 19900,
    "window_total_difficulty": "...",
    "registered_miners": 40, "miners_with_unpaid": 12,
    "total_unpaid_flowers": "...", "total_paid_flowers": "...",
    "payout_rounds": 30
  },
  "pool": {"fee_bps": 100, "miner_pct": 89, "humanitarian_pct": 5,
           "issobella_pct": 5, "port": 8444},
  "blocks": {...}, "external_payouts": {"quantus": {"pending": 0},
                                        "pearl": {"pending": 0}},
  "auxpow": {...}, "routing": {...}
}
```

### `GET /miners?limit=200` — *API bind only*
Miner roster (alias fields only, no login internals).

### `GET /public/v1/coins`
Coin list + protocol fee split.

```json
{
  "ok": true,
  "fees": {"miner_pct": 89, "humanitarian_pct": 5,
           "issobella_pct": 5, "pool_fee_pct": 1},
  "vardiff": {"start": 1000, "min": 1000, "max": 100000,
              "target_secs": 15, "retarget_shares": 8},
  "coins": [
    {"coin": "zion", "payout_mode": "native",
     "min_payout": "10000000", "fee_bps": 100,
     "legs": [{"id": "zion", "kind": "native", "enabled": true,
               "connected": true, "job_age_ms": 420}]}
  ]
}
```

`payout_mode`: `native` = paid in ZION; `unified` = merged into the
ZION slice. `fee_bps` = pool-fee basis points (1 %).

`vardiff` is the difficulty policy the stratum actually enforces (both
are built from the same `VarDiffConfig::from_env` — the advertised
values cannot drift from the enforced ones). The pool runs vardiff
only: there is **no static-difficulty parameter** and
`mining.suggest_difficulty` is accepted purely as a hint. `max` is
`null` when the ceiling is disabled (`ZION_VARDIFF_MAX_DIFF=0`).

### `GET /public/v1/coins/{coin}/stats`
```json
{"ok": true, "coin": "zion",
 "miners_online": 4, "active_miners": 4,
 "shares": {"accepted": 5000, "rejected": 30},
 "window_weight": "...", "accepted_total": 5000,
 "hashrate": {"live": 123.4, "1h": 118.0},
 "blocks": {...}   // zion only
}
```

### `GET /public/v1/coins/{coin}/blocks?limit=50`
`{"ok": true, "coin": "…", "tip": <height>, "blocks": [block…]}` — same
row shape as `/public/v1/blocks`. `503` when the store is disabled.

### `GET /public/v1/blocks?coin=&limit=50`
```json
{"ok": true, "tip": 97402, "blocks": [
  {"coin": "zion", "height": 97300, "hash": "…",
   "miner": "s6m2…",            // public alias, never worker login
   "share_difficulty": 12.3, "network_difficulty": 10.1,
   "shares_since_prev": 421, "luck_pct": 2.4,
   "status": "confirmed",       // pending|confirmed|orphaned (sticky)
   "ts": 1761600000, "confirmed_at": 1761600300}
]}
```

`tip` = current chain height the pool tracks (null when unavailable) —
for client-side coinbase-maturity countdowns (`tip − height + 1`
confirmations; coinbase spends at 100). `shares_since_prev` = accepted
shares between the previous block and this one (0 on rows predating
schema v8). `luck_pct` = per-block luck, same formula as
`pool_luck_100`: `(network_difficulty ÷ share_difficulty) ÷
shares_since_prev × 100` — `>100` = lucky (found with fewer shares
than statistically expected), `null` when inputs are missing.

### `GET /public/v1/payouts?coin=&limit=50`
Merged feed — queued (in-memory PPLNS) + DB rows, newest first.

```json
{"ok": true, "payouts": [
  {"ts": 1761600000, "address": "…", "coin": "zion",
   "amount_flowers": 356000000, "tx_id": "…",
   "height": 97300, "block_hash": "…",
   "confirmations": 3, "confirmed": true,
   "status": "confirmed"}      // queued|sent|confirmed
]}
```

Lifecycle: `queued` = computed, awaiting broadcast (`ts`/`tx_id` = null);
`sent` = broadcast, unconfirmed; `confirmed` = chain-confirmed.

### `GET /public/v1/miner/{coin}/{wallet}`  (coin may be empty → zion)
```json
{
  "ok": true, "coin": "zion", "wallet": "s6m2…",
  "worker_count": 2,
  "workers": [{"name": "rig1", "worker": "rig1", "accepted": 400,
               "rejected": 3, "last_seen_s": 1761600100,
               "hashrate": 57.1}],
  "shares": {"accepted": 900, "rejected": 6},
  "unpaid": "58457578", "unpaid_unit": "flowers",
  "min_payout": "10000000", "payout_eta_s": 0,
  "window_share": 0.12, "est_daily": 42000000,
  "est_per_block": 890000, "last_seen_s": 1761600100,
  "active": true
}
```

- `payout_eta_s`: `0` = at/above threshold (next batch), `null` =
  unestimable (no payout history → `est_daily` null).
- `window_share`: wallet's weight fraction of the coin's PPLNS slice.
- `est_daily`: wallet's fraction × pool's empirical 24 h payout sum.
- `est_per_block`: zion-only (deterministic miner subsidy × share);
  `null` for external coins.
- Wallet matching: miner id, `wallet.worker` logins, and registered
  payout addresses — one row aggregates every bound worker.

### `GET /public/v1/miner/{coin}/{wallet}/payouts?limit=50`
Same row shape as `/public/v1/payouts`, filtered to `address == wallet`
(merged queued + DB). `503` without store.

### `GET /public/v1/miner/{coin}/{wallet}/history?limit=…` (cap 1440)
Persisted 60 s samples aggregated across all the wallet's workers:

```json
{"ok": true, "coin": "zion", "wallet": "…", "interval_s": 60,
 "samples": [{"ts": 1761600000, "hps": 57.1,
              "accepted": 400, "rejected": 3}]}
```

`accepted`/`rejected` are cumulative counters at sample time —
per-interval deltas are derived client-side; counters reset on pool
restart (one dip per bounce).

### `GET /public/v1/history?limit=…` (cap 1440)
Pool-wide 60 s timeseries (24 h ring, persisted):

```json
{"ok": true, "interval_s": 60,
 "samples": [{"ts": 1761600000, "hashrate": 123.4,
              "miners_online": 4,
              "online_by_coin": {"zion": 3, "qtu": 1},
              "hashrate_by_coin": {"zion": 123.4, "qtu": 2.1e8},
              "accepted": 5000, "rejected": 30}]}
```

`hashrate` = ZION-leg live (10-min trailing); `hashrate_by_coin` = same
window per stream (external = expected-work H/s).

### `GET /health` — *API bind only*
`{"ok": true, "status": "ok", …}` — liveness probe.

### `GET /metrics` — *API bind only*
Prometheus text exposition — share counters, session gauges, dedup
dropped, persist timestamps/failures, block tracker, auxpow legs,
routing. Scraped by EDGE prometheus job `zion_v31_pool` (alerts in
`infra/monitoring/rules/zion-pool.rules.yml`).

## Errors

| Status | Meaning |
|---|---|
| 400 | malformed path/params |
| 401 | missing/invalid API key (`/api/*`) |
| 403 | forbidden (admin-tier op on read key, `/api/agent/*` non-ops) |
| 404 | unknown route / state export name not in {pplns,payouts,db} |
| 429 | public per-IP rate limit — back off, honor `Retry-After` if sent |
| 503 | `{"ok":false,"error":"database not configured"}` — store disabled |

## Internal (`/api/v1/*`, key-gated — not for public use)

`/api/v1/blocks`, `/api/v1/payouts`, `/api/v1/miners`,
`/api/v1/miners/{id}` (detail incl. worker names),
`/api/v1/pplns` (raw window state), `/api/v1/auxpow`,
`/api/v1/profit-switch`, `/api/v1/stream-profit`,
`/api/v1/hashrate-history` (alias of public history),
`/api/v1/revenue-stats`, `/api/v1/revenue-streams`,
`/api/v1/routing-metrics`, `/api/v1/admin/*`.

HA warm-standby exports (A4.2, octet-stream): `/api/v1/state/pplns`,
`/api/v1/state/payouts`, `/api/v1/state/db` (WAL-safe `VACUUM INTO`
snapshot). See `docs/3.2/POOL-HA-STANDBY.md`.

## DoS layers

Public tier = rate limit + read-only + field allowlist (see
`docs/3.2/POOL-DOS-LAYERS.md`). The public surface never reads the DB
under the pool lock and never interpolates miner-supplied strings
outside `serde_json`.
