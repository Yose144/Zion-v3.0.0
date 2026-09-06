# ZION TerraNova — API Endpoints Reference (v2.9.7)

> **Single source of truth.** All HTTP/WebSocket endpoints exposed by L1 Core,
> L1 Pool, and L2 Bridge. Monitoring probes, explorer integrations and
> desktop-agent calls MUST use these definitions.
>
> Last updated: 2026-03-01 · Mainnet ports in this document.

---

## Table of Contents

1. [Ports Overview](#1-ports-overview)
2. [L1 Core — Health & Metrics](#2-l1-core--health--metrics)
3. [L1 Core — REST API](#3-l1-core--rest-api)
4. [L1 Core — RPC (legacy)](#4-l1-core--rpc-legacy)
5. [L1 Core — JSON-RPC 2.0](#5-l1-core--json-rpc-20)
6. [L2 Bridge — Metrics & Health](#6-l2-bridge--metrics--health)
7. [Authentication](#7-authentication)
8. [Response formats](#8-response-formats)

---

## 1. Ports Overview

| Service | Port | Protocol | Auth |
|---------|------|----------|------|
| L1 Core P2P | 8333 | TCP/P2P | — |
| L1 Core RPC / REST / JSON-RPC | **8443** | HTTP | Bearer (write) |
| L2 Bridge metrics | **9100** | HTTP | — |

> Testnet uses the same ports on separate servers (Helsinki / USA / Asia).

---

## 2. L1 Core — Health & Metrics

All endpoints on port **8443**. No authentication required.

### `GET /health`

Full node health status in JSON.

**Response `200 OK` (healthy/degraded):**
```json
{
  "status":               "healthy",
  "peers":                4,
  "current_height":       142350,
  "time_since_last_block": 38,
  "mempool_size":         12,
  "version":              "2.9.7"
}
```

**Response `503 Service Unavailable` (unhealthy):** same body, status field = `"unhealthy"`.

| Field | Type | Notes |
|-------|------|-------|
| `status` | string | `healthy` / `degraded` / `unhealthy` |
| `peers` | integer | Active P2P peer count |
| `current_height` | integer | Chain tip height |
| `time_since_last_block` | integer | Seconds since last block |
| `mempool_size` | integer | Pending transactions count |
| `version` | string | Node software version |

> `peers` is the canonical field name (Rust field `peers_connected` is renamed
> via `#[serde(rename = "peers")]`).

---

### `GET /readiness`

Kubernetes readiness probe. Returns `200 ready` when:
- `peers > 0`
- `time_since_last_block < 900` (15 min)
- `mempool_size < 50 000`

Returns `503 not ready` otherwise.

**Response body:** plain text `ready` or `not ready`

---

### `GET /liveness`

Kubernetes liveness probe. Returns `200 alive` if node event loop responds.

**Response body:** plain text `alive`

---

### `GET /metrics`

Prometheus metrics (text/plain version 0.0.4).

**Content-Type:** `text/plain; version=0.0.4`

Key metric families:

| Metric | Type | Description |
|--------|------|-------------|
| `zion_blocks_processed_total` | counter | Total valid blocks ingested |
| `zion_blocks_rejected_total` | counter | Total invalid blocks rejected |
| `zion_peers_connected` | gauge | Active P2P peers |
| `zion_mempool_size` | gauge | Mempool transaction count |
| `zion_chain_height` | gauge | Current chain tip height |
| `zion_hashrate_estimate` | gauge | Estimated network hashrate |

**Prometheus alert rules** (monitoring/prometheus/rules/alerts.yml):

| Alert | Threshold | Severity |
|-------|-----------|----------|
| `CoreBlocksRejectedHigh` | reject ratio > 5 % for 10 min | warning |
| `CoreBlocksRejectedSurge` | > 10 rejected/min for 3 min | critical |
| `CoreNodeDown` | node unreachable for 2 min | critical |

---

## 3. L1 Core — REST API

Base URL: `http://<node>:8443`

All REST endpoints are **public (no auth)** unless marked 🔒.

### Blocks

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/block/hash/:hash` | Block by hex hash |
| `GET` | `/api/block/height/:height` | Block by height (u64) |
| `GET` | `/api/blocks/range/:start/:end` | Block headers range (max 100) |

**Response — single block:**
```json
{
  "hash": "000000…",
  "height": 142350,
  "timestamp": 1740825600,
  "transactions": [ … ],
  "difficulty": 12345678,
  "nonce": 987654321
}
```

---

### Transactions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tx/:txid` | Transaction by ID |
| `GET` | `/api/mempool/info` | Mempool stats |

**Response — transaction:**
```json
{
  "id": "deadbeef…",
  "version": 1,
  "inputs": [ { "prev_tx_hash": "…", "output_index": 0 } ],
  "outputs": [ { "amount": 1000000, "address": "zion1…", "memo": null } ],
  "fee": 1000,
  "timestamp": 1740825600
}
```

> `memo` is `null` for regular transfers. Bridge lock transactions use
> `"memo": "BRIDGE:base:0x<evm_address>"`.

**Response — mempool info:**
```json
{ "size": 12, "min_fee_rate": 1000 }
```

---

### Address

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/address/:address/balance` | Balance in atomic units |
| `GET` | `/api/address/:address/utxos` | UTXO set for address |

**Response — balance:**
```json
{ "address": "zion1…", "balance": 1000000000, "utxo_count": 5 }
```

**Response — utxos:**
```json
[
  { "key": "txid:0", "amount": 500000000, "address": "zion1…", "memo": null }
]
```

---

### Sync / Status

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/stats` | Quick node stats (height, peers, difficulty) |
| `GET` | `/api/sync/status` | Sync progress |

**Response — stats:**
```json
{
  "height": 142350,
  "best_hash": "000000…",
  "difficulty": 12345678,
  "peers": 4,
  "mempool": 12
}
```

---

### Premine

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rpc/get_premine_total` | Total premine in atomic units |
| `GET` | `/rpc/get_premine_summary` | Per-category summary |
| `GET` | `/rpc/get_premine_list` | Full premine allocation list |

**Response — premine_total:**
```json
{ "total_atomic": 16780000000000000, "total_zion": 16780000000 }
```

**Response — premine_summary:**
```json
{
  "oasis_golden_egg":  { "total_zion": 8250000000, "count": 5 },
  "dao_treasury":      { "total_zion": 4000000000, "count": 3, "unlock_height": 525600 },
  "infrastructure":    { "total_zion": 2590000000, "count": 3 },
  "humanitarian":      { "total_zion": 1440000000, "count": 1 }
}
```

> `dao_treasury.unlock_height` = 525 600 (≈ 1 year at 1 block/min).
> Enforced via `premine::is_transfer_allowed()` — see B-01.

---

### Mining

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rpc/get_block_template` | Template for solo mining |

**Response:**
```json
{
  "blob":        "0100…hex…",
  "difficulty":  12345678,
  "target_u32":  "1d00ffff",
  "target_u128": "00000000ffff0000…",
  "height":      142351,
  "prev_hash":   "000000…"
}
```

---

### Write endpoints 🔒 (require Bearer token)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/rpc/submit_block` | Submit mined block (binary blob + nonce) |
| `POST` | `/rpc/submit_tx` | Submit signed transaction |
| `POST` | `/api/bridge/unlock` | Bridge relay: unlock L1 funds after EVM burn |

**`POST /rpc/submit_block` body:**
```json
{ "blob_hex": "0100…", "nonce": 12345678 }
```

**`POST /rpc/submit_tx` body:**
```json
{
  "from":             "zion1…",
  "recipient":        "zion1…",
  "amount_atomic":    1000000,
  "fee_atomic":       1000,
  "private_key_hex":  "deadbeef…"
}
```

**`POST /api/bridge/unlock` body:**
```json
{
  "evm_tx_hash":   "0x…",
  "l1_recipient":  "zion1…",
  "amount_atomic": 1000000,
  "chain":         "base"
}
```

---

## 4. L1 Core — RPC (legacy)

Same port **8443**. Kept for miner pool compatibility. Prefer REST or JSON-RPC.

| Endpoint | Notes |
|----------|-------|
| `GET /rpc/get_block_template` | Alias for REST equivalent above |
| `POST /rpc/submit_block` 🔒 | Alias for REST equivalent above |
| `POST /rpc/submit_tx` 🔒 | Alias for REST equivalent above |

---

## 5. L1 Core — JSON-RPC 2.0

**Endpoint:** `POST /jsonrpc` 🔒

**Request format:**
```json
{ "jsonrpc": "2.0", "id": 1, "method": "<method>", "params": { … } }
```

**Response format:**
```json
{ "jsonrpc": "2.0", "id": 1, "result": { … } }
```

### Method reference

All methods support camelCase, snake_case, and lowercase aliases.

#### Node info

| Method | Aliases | Params | Description |
|--------|---------|--------|-------------|
| `getInfo` | `get_info` | — | Chain info: height, hash, difficulty, version |
| `getNetworkInfo` | `get_network_info`, `getnetworkinfo` | — | Network: peers, version, protocol |
| `getPeerInfo` | `get_peer_info`, `getpeerinfo` | — | Connected peer list |
| `getHealthCheck` | `get_health_check`, `health` | — | Health status (same as GET /health) |
| `getMetrics` | `get_metrics`, `metrics` | — | Metrics snapshot as JSON |
| `getConsensusParams` | — | — | Block reward, halving interval, algo params |
| `getSupplyInfo` | `get_supply_info`, `getsupplyinfo` | — | Circulating, premine, mining emission |
| `getBuybackStats` | `get_buyback_stats`, `getbuybackstats` | `limit?` | Revenue buyback statistics |

#### Blockchain

| Method | Aliases | Params | Description |
|--------|---------|--------|-------------|
| `getBlockTemplate` | `get_block_template`, `getblocktemplate` | `wallet_address` | Mining template |
| `getBlockByHash` | `get_block_by_hash` | `hash` | Block by hash |
| `getBlockByHeight` | `get_block_by_height` | `height` | Block by height |
| `getBlockHeadersRange` | `get_block_headers_range`, `getblockheadersrange` | `start`, `end` | Headers range |
| `getMempoolInfo` | — | — | Mempool size + min fee |
| `getMempool` | `get_mempool` | — | Full mempool contents |

#### Transactions

| Method | Aliases | Params | Description |
|--------|---------|--------|-------------|
| `getTx` | `get_tx`, `gettransaction` | `txid` | Transaction lookup |
| `sendTransaction` | `sendtransaction` | `from`, `to`, `amount_atomic`, `fee_atomic`, `private_key_hex`, `memo?` | Sign + broadcast |
| `submitTransaction` | `submit_transaction` | `tx` (signed Transaction object) | Broadcast pre-signed tx |
| `submitBlock` | `submitblock` | `[blob_hex, nonce, wallet]` | Submit mined block |

#### Address

| Method | Aliases | Params | Description |
|--------|---------|--------|-------------|
| `getBalance` | `getbalance` | `address` | Balance in atomic units |
| `getUtxos` | `get_utxos` | `address` | UTXO set for address |

#### Bridge

| Method | Aliases | Params | Description |
|--------|---------|--------|-------------|
| `getUtxosForBridgeLocks` | (internal) | `bridge_address` | UTXOs with BRIDGE memo |

---

#### `sendTransaction` — memo (bridge lock)

To initiate an L1 → EVM bridge transfer, set `memo` to `"BRIDGE:<chain>:<evm_addr>"`:

```json
{
  "method": "sendTransaction",
  "params": {
    "from":            "zion1…",
    "to":              "zion1bridge_escrow…",
    "amount_atomic":   10000000,
    "fee_atomic":      1000,
    "private_key_hex": "…",
    "memo":            "BRIDGE:base:0xAbCd…"
  }
}
```

Supported chains: `base`, `eth`, `bsc`, `polygon`, `arbitrum`

---

## 6. L2 Bridge — Metrics & Health

Port **9100**. Public, no authentication.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/metrics` | Prometheus metrics (text/plain 0.0.4) |
| `GET` | `/health` | Bridge relay health status |

**Key bridge metrics:**

| Metric | Type | Description |
|--------|------|-------------|
| `zion_bridge_locks_detected_total` | counter | L1 BRIDGE memo UTXOs found |
| `zion_bridge_mints_total` | counter | Successful EVM mints |
| `zion_bridge_burns_detected_total` | counter | EVM burns detected |
| `zion_bridge_unlocks_total` | counter | Successful L1 unlocks |
| `zion_bridge_relay_errors_total` | counter | Relay errors |
| `zion_bridge_pending_locks` | gauge | Locks awaiting EVM confirmation |

---

## 7. Authentication

Write endpoints require a Bearer token when `ZION_RPC_TOKEN` environment variable is set.

```
Authorization: Bearer <token>
```

If `ZION_RPC_TOKEN` is not set, write endpoints accept any (or no) token — **only use this in testnet/dev**.

Monitoring (`/health`, `/metrics`, `/readiness`, `/liveness`) and all `GET /api/*` endpoints are always **public**.

---

## 8. Response formats

### Units

| Value | Unit | Notes |
|-------|------|-------|
| Amounts | atomic units | 1 ZION = 1 000 000 atomic units |
| Heights | u64 | 0-indexed from genesis |
| Timestamps | Unix seconds | u64 |
| Hashes | hex string | 64 chars (32 bytes) |
| Addresses | bech32 `zion1` | 44 chars: `zion1` + 39 alphanum |

### Error response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": { "code": -32601, "message": "Method not found" }
}
```

Standard JSON-RPC error codes: `-32700` parse error · `-32600` invalid request ·
`-32601` method not found · `-32602` invalid params · `-32603` internal error.

### HTTP status codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 400 | Bad request / invalid params |
| 401 | Unauthorized (missing/invalid token) |
| 404 | Block/tx not found |
| 503 | Node unhealthy / not ready |

---

*Document maintained in `docs/2.9.7/API_ENDPOINTS.md` · generated from source
`L1/core/src/rpc/server.rs`, `L1/core/src/jsonrpc/mod.rs`,
`L1/core/src/metrics/endpoints.rs`, `L2/bridge/src/metrics.rs`.*
