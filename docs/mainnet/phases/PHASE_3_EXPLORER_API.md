# 🔍 FÁZE 3: Explorer API — Technická Specifikace

**Priorita:** P1 (Required pro exchange listing)  
**Trvání:** 2-3 týdny  
**Owner:** Backend Lead

---

## 🎯 Cíl

Implementovat REST API endpointy potřebné pro:
1. Block explorers (webové UI)
2. CMC/CoinGecko supply tracking
3. Exchange integration

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Explorer API Layer                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              zion-core (existing)                    │    │
│  │  ┌─────────────┐                                    │    │
│  │  │  Axum HTTP  │◀── /api/v1/*                       │    │
│  │  │  Server     │                                    │    │
│  │  └─────────────┘                                    │    │
│  │         │                                           │    │
│  │         ▼                                           │    │
│  │  ┌─────────────┐    ┌─────────────┐                │    │
│  │  │  Handlers   │───▶│  Storage    │                │    │
│  │  │  (new)      │    │  (existing) │                │    │
│  │  └─────────────┘    └─────────────┘                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Endpoints:                                                  │
│  - /api/v1/blocks       - Block info                        │
│  - /api/v1/txs          - Transaction info                  │
│  - /api/v1/addresses    - Address balance/history           │
│  - /api/v1/supply       - CMC/CoinGecko supply              │
│  - /api/v1/stats        - Network statistics                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📋 API Specification

### 1. Block Endpoints

#### GET /api/v1/block/:hash_or_height
```json
// Request: GET /api/v1/block/12345
// Response:
{
  "hash": "0x1234...abcd",
  "height": 12345,
  "timestamp": 1740000000,
  "timestamp_iso": "2026-02-20T00:00:00Z",
  "miner": "zion1abc...xyz",
  "difficulty": "1234567890",
  "nonce": 98765,
  "algorithm": "cosmic_harmony",
  "tx_count": 5,
  "size": 1234,
  "reward": "5479.45000000",
  "fees": "0.01234567",
  "prev_hash": "0x5678...efgh",
  "merkle_root": "0x9abc...ijkl"
}
```

#### GET /api/v1/blocks
```json
// Request: GET /api/v1/blocks?limit=10&offset=0
// Response:
{
  "blocks": [
    {
      "hash": "0x...",
      "height": 12345,
      "timestamp": 1740000000,
      "tx_count": 5,
      "miner": "zion1...",
      "reward": "5479.45000000"
    },
    // ... more blocks
  ],
  "total": 12345,
  "limit": 10,
  "offset": 0
}
```

#### GET /api/v1/block/:height/txs
```json
// Request: GET /api/v1/block/12345/txs
// Response:
{
  "txs": [
    {
      "txid": "0x...",
      "type": "coinbase",
      "amount": "5479.45000000"
    },
    {
      "txid": "0x...",
      "type": "transfer",
      "from": "zion1...",
      "to": "zion1...",
      "amount": "100.00000000",
      "fee": "0.00100000"
    }
  ],
  "block_height": 12345
}
```

### 2. Transaction Endpoints

#### GET /api/v1/tx/:txid
```json
// Request: GET /api/v1/tx/0x1234...
// Response:
{
  "txid": "0x1234...",
  "status": "confirmed",
  "confirmations": 6,
  "block_hash": "0x...",
  "block_height": 12345,
  "timestamp": 1740000000,
  "type": "transfer",
  "inputs": [
    {
      "address": "zion1...",
      "amount": "100.50000000",
      "prev_txid": "0x...",
      "prev_vout": 0
    }
  ],
  "outputs": [
    {
      "address": "zion1...",
      "amount": "100.00000000",
      "vout": 0
    },
    {
      "address": "zion1...",
      "amount": "0.49900000",
      "vout": 1,
      "is_change": true
    }
  ],
  "fee": "0.00100000",
  "size": 256
}
```

#### GET /api/v1/tx/pending
```json
// Request: GET /api/v1/tx/pending
// Response:
{
  "pending_count": 5,
  "pending_txs": [
    {
      "txid": "0x...",
      "from": "zion1...",
      "to": "zion1...",
      "amount": "10.00000000",
      "fee": "0.00050000",
      "received_at": 1740000000
    }
  ]
}
```

### 3. Address Endpoints

#### GET /api/v1/address/:address
```json
// Request: GET /api/v1/address/zion1abc...
// Response:
{
  "address": "zion1abc...",
  "balance": "1234.56789000",
  "balance_pending": "0.00000000",
  "tx_count": 42,
  "received_total": "5000.00000000",
  "sent_total": "3765.43211000",
  "first_seen_block": 100,
  "last_seen_block": 12345
}
```

#### GET /api/v1/address/:address/txs
```json
// Request: GET /api/v1/address/zion1.../txs?limit=10&offset=0
// Response:
{
  "address": "zion1...",
  "txs": [
    {
      "txid": "0x...",
      "block_height": 12345,
      "timestamp": 1740000000,
      "type": "received",
      "amount": "100.00000000",
      "from": "zion1..."
    },
    {
      "txid": "0x...",
      "block_height": 12340,
      "timestamp": 1739990000,
      "type": "sent",
      "amount": "50.00000000",
      "to": "zion1...",
      "fee": "0.00100000"
    }
  ],
  "total": 42,
  "limit": 10,
  "offset": 0
}
```

#### GET /api/v1/address/:address/utxos
```json
// Request: GET /api/v1/address/zion1.../utxos
// Response:
{
  "address": "zion1...",
  "utxos": [
    {
      "txid": "0x...",
      "vout": 0,
      "amount": "100.00000000",
      "block_height": 12345,
      "confirmations": 6
    },
    {
      "txid": "0x...",
      "vout": 1,
      "amount": "34.56789000",
      "block_height": 12300,
      "confirmations": 51
    }
  ],
  "total_balance": "134.56789000"
}
```

### 4. Supply Endpoints (CMC/CoinGecko)

#### GET /api/v1/supply
```json
// Request: GET /api/v1/supply
// Response:
{
  "total_supply": "144000000000.00000000",
  "circulating_supply": "16358857143.12345678",
  "max_supply": "144000000000.00000000",
  "premine": "16282857143.00000000",
  "mined": "76000000.12345678",
  "burned": "0.00000000",
  "locked": "1500000000.00000000",
  "updated_at": 1740000000
}
```

#### GET /api/v1/supply/circulating (plain text for CMC)
```
// Request: GET /api/v1/supply/circulating
// Response (text/plain):
16358857143.12345678
```

#### GET /api/v1/supply/total (plain text for CMC)
```
// Request: GET /api/v1/supply/total
// Response (text/plain):
144000000000.00000000
```

### 5. Network Statistics

#### GET /api/v1/stats
```json
// Request: GET /api/v1/stats
// Response:
{
  "chain_id": "zion-mainnet-1",
  "height": 12345,
  "best_hash": "0x...",
  "difficulty": "1234567890",
  "hashrate_estimated": "500000000",
  "hashrate_unit": "H/s",
  "block_time_avg": 60.5,
  "block_time_target": 60,
  "peer_count": 25,
  "mempool_size": 5,
  "mempool_bytes": 1280,
  "version": "2.9.5",
  "protocol_version": 1,
  "syncing": false,
  "sync_progress": 100.0
}
```

#### GET /api/v1/stats/chart/hashrate
```json
// Request: GET /api/v1/stats/chart/hashrate?period=7d
// Response:
{
  "period": "7d",
  "data": [
    {"timestamp": 1739500000, "hashrate": 450000000},
    {"timestamp": 1739600000, "hashrate": 480000000},
    // ... more data points
  ]
}
```

### 6. Health Check

#### GET /api/v1/health
```json
{
  "status": "healthy",
  "version": "2.9.5",
  "uptime_seconds": 86400,
  "components": {
    "database": "ok",
    "p2p": "ok",
    "rpc": "ok"
  }
}
```

---

## 📋 Task Breakdown

### Task 3.1: OpenAPI Specification

**Čas:** 4h

Vytvořit `docs/mainnet/api/openapi.yaml`:

```yaml
openapi: 3.0.3
info:
  title: ZION Explorer API
  version: 1.0.0
  description: REST API for ZION blockchain explorer
  
servers:
  - url: https://api.zionterranova.com/api/v1
    description: MainNet
  - url: https://api-testnet.zionterranova.com/api/v1
    description: TestNet

paths:
  /block/{hash_or_height}:
    get:
      summary: Get block by hash or height
      parameters:
        - name: hash_or_height
          in: path
          required: true
          schema:
            oneOf:
              - type: string
                pattern: '^0x[a-f0-9]{64}$'
              - type: integer
      responses:
        200:
          description: Block details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Block'
        404:
          description: Block not found
  # ... more paths

components:
  schemas:
    Block:
      type: object
      properties:
        hash:
          type: string
        height:
          type: integer
        # ... more properties
```

### Task 3.2: Block Handlers

**Čas:** 8h

```rust
// src/api/handlers/blocks.rs
use axum::{
    extract::{Path, Query, State},
    Json,
};

pub async fn get_block(
    State(state): State<AppState>,
    Path(hash_or_height): Path<String>,
) -> Result<Json<BlockResponse>, ApiError> {
    let block = if hash_or_height.starts_with("0x") {
        state.storage.get_block_by_hash(&hash_or_height)?
    } else {
        let height: u64 = hash_or_height.parse()?;
        state.storage.get_block_by_height(height)?
    };
    
    let block = block.ok_or(ApiError::NotFound("Block not found"))?;
    
    Ok(Json(BlockResponse::from(block)))
}

pub async fn list_blocks(
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<BlocksResponse>, ApiError> {
    let limit = params.limit.unwrap_or(10).min(100);
    let offset = params.offset.unwrap_or(0);
    
    let blocks = state.storage.list_blocks(limit, offset)?;
    let total = state.storage.get_block_count()?;
    
    Ok(Json(BlocksResponse {
        blocks: blocks.into_iter().map(BlockSummary::from).collect(),
        total,
        limit,
        offset,
    }))
}
```

### Task 3.3: Transaction Handlers

**Čas:** 8h

```rust
// src/api/handlers/transactions.rs
pub async fn get_transaction(
    State(state): State<AppState>,
    Path(txid): Path<String>,
) -> Result<Json<TransactionResponse>, ApiError> {
    let tx = state.storage.get_transaction(&txid)?
        .ok_or(ApiError::NotFound("Transaction not found"))?;
    
    let block_info = state.storage.get_tx_block_info(&txid)?;
    let current_height = state.storage.get_current_height()?;
    
    let confirmations = block_info.as_ref()
        .map(|b| current_height.saturating_sub(b.height) + 1)
        .unwrap_or(0);
    
    Ok(Json(TransactionResponse {
        txid: tx.txid,
        status: if confirmations > 0 { "confirmed" } else { "pending" },
        confirmations,
        block_hash: block_info.as_ref().map(|b| b.hash.clone()),
        block_height: block_info.as_ref().map(|b| b.height),
        // ... more fields
    }))
}
```

### Task 3.4: Address Handlers

**Čas:** 8h

```rust
// src/api/handlers/addresses.rs
pub async fn get_address(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> Result<Json<AddressResponse>, ApiError> {
    // Validate address format
    if !validate_address(&address) {
        return Err(ApiError::BadRequest("Invalid address format"));
    }
    
    let utxos = state.storage.get_utxos(&address)?;
    let balance: u64 = utxos.iter().map(|u| u.amount).sum();
    
    let tx_count = state.storage.get_address_tx_count(&address)?;
    let stats = state.storage.get_address_stats(&address)?;
    
    Ok(Json(AddressResponse {
        address,
        balance: format_amount(balance),
        balance_pending: "0.00000000".to_string(),
        tx_count,
        received_total: format_amount(stats.received),
        sent_total: format_amount(stats.sent),
        first_seen_block: stats.first_block,
        last_seen_block: stats.last_block,
    }))
}

pub async fn get_address_utxos(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> Result<Json<UtxosResponse>, ApiError> {
    let utxos = state.storage.get_utxos(&address)?;
    let current_height = state.storage.get_current_height()?;
    
    let utxo_list: Vec<UtxoItem> = utxos.iter().map(|u| {
        UtxoItem {
            txid: u.txid.clone(),
            vout: u.vout,
            amount: format_amount(u.amount),
            block_height: u.block_height,
            confirmations: current_height.saturating_sub(u.block_height) + 1,
        }
    }).collect();
    
    let total_balance: u64 = utxos.iter().map(|u| u.amount).sum();
    
    Ok(Json(UtxosResponse {
        address,
        utxos: utxo_list,
        total_balance: format_amount(total_balance),
    }))
}
```

### Task 3.5: Supply Calculator

**Čas:** 6h

```rust
// src/api/handlers/supply.rs
use crate::core::premine::PREMINE_WALLETS;

pub async fn get_supply(
    State(state): State<AppState>,
) -> Result<Json<SupplyResponse>, ApiError> {
    let current_height = state.storage.get_current_height()?;
    
    // Calculate mined supply
    let base_reward_per_block = 5_479_450_000u64; // atomic units
    let mined_base = current_height * base_reward_per_block;
    
    // Add consciousness bonuses (simplified)
    let bonus_estimate = (mined_base as f64 * 0.15) as u64;
    let total_mined = mined_base + bonus_estimate;
    
    // Premine
    let premine = 16_282_857_143_000_000u64;
    
    // Locked amount (team wallet until 2030)
    let locked = 1_500_000_000_000_000u64;
    
    // Circulating = premine - locked + mined
    let circulating = premine - locked + total_mined;
    
    // Total supply (minted so far)
    let total = premine + total_mined;
    
    // Max supply
    let max_supply = 144_000_000_000_000_000u64;
    
    Ok(Json(SupplyResponse {
        total_supply: format_amount(total),
        circulating_supply: format_amount(circulating),
        max_supply: format_amount(max_supply),
        premine: format_amount(premine),
        mined: format_amount(total_mined),
        burned: "0.00000000".to_string(),
        locked: format_amount(locked),
        updated_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs(),
    }))
}

/// Plain text endpoint for CMC
pub async fn get_circulating_plain(
    State(state): State<AppState>,
) -> Result<String, ApiError> {
    let supply = get_supply(State(state)).await?;
    Ok(supply.0.circulating_supply)
}
```

### Task 3.6: Router Setup

**Čas:** 4h

```rust
// src/api/router.rs
use axum::{
    routing::get,
    Router,
};

pub fn explorer_router() -> Router<AppState> {
    Router::new()
        // Blocks
        .route("/block/:hash_or_height", get(handlers::blocks::get_block))
        .route("/blocks", get(handlers::blocks::list_blocks))
        .route("/block/:height/txs", get(handlers::blocks::get_block_txs))
        
        // Transactions
        .route("/tx/:txid", get(handlers::transactions::get_transaction))
        .route("/tx/pending", get(handlers::transactions::get_pending))
        
        // Addresses
        .route("/address/:address", get(handlers::addresses::get_address))
        .route("/address/:address/txs", get(handlers::addresses::get_address_txs))
        .route("/address/:address/utxos", get(handlers::addresses::get_address_utxos))
        
        // Supply (CMC/CoinGecko)
        .route("/supply", get(handlers::supply::get_supply))
        .route("/supply/circulating", get(handlers::supply::get_circulating_plain))
        .route("/supply/total", get(handlers::supply::get_total_plain))
        
        // Stats
        .route("/stats", get(handlers::stats::get_stats))
        .route("/stats/chart/hashrate", get(handlers::stats::get_hashrate_chart))
        
        // Health
        .route("/health", get(handlers::health::check))
}
```

### Task 3.7: CORS & Rate Limiting

**Čas:** 4h

```rust
// src/api/middleware.rs
use tower_http::cors::{CorsLayer, Any};
use tower::ServiceBuilder;

pub fn api_middleware() -> ServiceBuilder<...> {
    ServiceBuilder::new()
        // CORS for browser access
        .layer(CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any))
        // Rate limiting
        .layer(RateLimitLayer::new(100, Duration::from_secs(60)))
        // Request tracing
        .layer(TraceLayer::new_for_http())
}
```

---

## 🧪 Testing

### Integration Tests

```rust
#[tokio::test]
async fn test_get_block_by_height() {
    let app = create_test_app().await;
    
    let response = app
        .oneshot(Request::get("/api/v1/block/0"))
        .await
        .unwrap();
    
    assert_eq!(response.status(), StatusCode::OK);
    
    let body: BlockResponse = response.json().await.unwrap();
    assert_eq!(body.height, 0);
    assert!(body.hash.starts_with("0x"));
}

#[tokio::test]
async fn test_supply_endpoints() {
    let app = create_test_app().await;
    
    // JSON endpoint
    let response = app
        .oneshot(Request::get("/api/v1/supply"))
        .await
        .unwrap();
    
    assert_eq!(response.status(), StatusCode::OK);
    
    let body: SupplyResponse = response.json().await.unwrap();
    assert!(body.circulating_supply.parse::<f64>().unwrap() > 0.0);
    
    // Plain text for CMC
    let response = app
        .oneshot(Request::get("/api/v1/supply/circulating"))
        .await
        .unwrap();
    
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers().get("content-type").unwrap(),
        "text/plain"
    );
}
```

---

## 📦 Deliverables

| Soubor | Popis |
|--------|-------|
| `src/api/handlers/` | API handlers |
| `src/api/router.rs` | Router setup |
| `docs/mainnet/api/openapi.yaml` | OpenAPI spec |
| `docs/mainnet/API_REFERENCE.md` | Human-readable docs |

---

## ⏱️ Time Estimate

| Task | Čas |
|------|-----|
| OpenAPI Spec | 4h |
| Block Handlers | 8h |
| TX Handlers | 8h |
| Address Handlers | 8h |
| Supply Calculator | 6h |
| Router Setup | 4h |
| CORS/Rate Limit | 4h |
| Testing | 8h |
| Documentation | 4h |
| **Total** | **54h (~2-3 týdny)** |

---

## ✅ Exit Criteria

1. Všech 15+ endpointů implementováno
2. OpenAPI spec kompletní
3. Integration testy passing
4. `/supply/circulating` vrací správnou hodnotu
5. CORS funguje pro browser access

---

## 🔗 Dependencies

- Fáze 0: Core RPC běží
- Core storage: get_block, get_tx, get_utxos metody

---

*Dokument aktualizován: 2026-02-03*
