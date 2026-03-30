# 🌐 ZION REST API - Dokumentace

## Obsah
1. [Přehled](#přehled)
2. [Autentizace](#autentizace)
3. [Rate Limiting](#rate-limiting)
4. [Endpointy](#endpointy)
5. [Příklady](#příklady)
6. [Chybové kódy](#chybové-kódy)

---

## Přehled

ZION REST API poskytuje přístup k blockchain, peněžence, těžbě a AI systému.

**Base URL:** `http://localhost:8000`  
**Verze:** 2.8.4  
**Dokumentace:** `http://localhost:8000/docs` (Swagger UI)

### Podporované algoritmy
- `cosmic_harmony`
- `randomx`
- `yescrypt`
- `autolykos_v2`

---

## Autentizace

V současné verzi není vyžadována autentizace. Pro produkci doporučeno implementovat:
- API klíče
- JWT tokeny
- OAuth 2.0

---

## Rate Limiting

```
Limit: 60 požadavků / minutu / IP
HTTP status při překročení: 429 Too Many Requests
```

---

## Endpointy

### Root

#### GET /
Základní informace o API.

**Response:**
```json
{
  "name": "ZION Blockchain API",
  "version": "2.8.4",
  "status": "operational",
  "algorithms": ["cosmic_harmony", "randomx", "yescrypt", "autolykos_v2"],
  "endpoints": ["/blockchain/stats", "/wallet/addresses", "..."]
}
```

---

### Health

#### GET /health
Kontrola stavu služby a závislostí.

**Response 200:**
```json
{
  "status": "ok",
  "version": "2.8.4",
  "environment": "production",
  "uptime_seconds": 86400,
  "dependencies": {
    "rpc": {
      "host": "blockchain",
      "port": 18081,
      "healthy": true,
      "error": null
    },
    "mining_pool": {
      "host": "zion-pool-v2.9",
      "port": 3333,
      "healthy": true,
      "error": null
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response 503:**
```json
{
  "status": "degraded",
  "dependencies": {
    "rpc": {"healthy": false, "error": "Connection refused"}
  }
}
```

#### GET /health/summary
Shrnutí pro starší klienty.

**Response:**
```json
{
  "status": "healthy",
  "ai_available": true,
  "blockchain_blocks": 12345,
  "mempool_size": 42,
  "wallet_addresses": 5,
  "ai_components": 11,
  "ai_active": 3,
  "timestamp": "2024-01-15T10:30:00"
}
```

---

### Blockchain

#### GET /blockchain/stats
Statistiky blockchainu.

**Response:**
```json
{
  "total_blocks": 12345,
  "circulating_supply": 15780000000.0,
  "max_supply": 144000000000.0,
  "total_transactions": 54321,
  "mempool_size": 42,
  "difficulty": 1.5,
  "latest_block": {
    "height": 12345,
    "hash": "abc123...",
    "timestamp": 1705312200,
    "consciousness_level": "AWAKENED",
    "sacred_multiplier": 1.618
  },
  "consciousness_distribution": {
    "PHYSICAL": 5000,
    "EMOTIONAL": 3000,
    "MENTAL": 2000,
    "AWAKENED": 1500,
    "COSMIC": 845
  }
}
```

#### GET /blockchain/blocks
Seznam bloků.

**Query parametry:**
- `limit` (int, default=10): Počet bloků
- `offset` (int, default=0): Offset od konce

**Response:**
```json
[
  {
    "height": 12345,
    "hash": "abc123...",
    "previous_hash": "def456...",
    "timestamp": 1705312200,
    "nonce": 123456789,
    "difficulty": 1.5,
    "transactions": [...],
    "reward": 10.0,
    "miner_address": "zion1...",
    "consciousness_level": "AWAKENED",
    "sacred_multiplier": 1.618
  }
]
```

#### GET /blockchain/blocks/{height}
Blok podle výšky.

**Response:** Stejné jako položka v seznamu bloků.

**Error 404:**
```json
{"detail": "Block not found"}
```

#### POST /blockchain/verify
Verifikace integrity blockchainu.

**Response:**
```json
{"valid": true}
```

---

### Wallet

#### GET /wallet/addresses
Seznam adres v peněžence.

**Response:**
```json
[
  {
    "address": "zion1qyfe883hey...",
    "label": "Main wallet",
    "created_at": "2024-01-01T00:00:00",
    "balance": 1000.5
  }
]
```

#### POST /wallet/addresses
Vytvoření nové adresy.

**Query parametry:**
- `label` (string, optional): Popisek

**Response:**
```json
{
  "address": "zion1newaddress...",
  "label": "My new address"
}
```

#### GET /wallet/balance/{address}
Zůstatek adresy.

**Response:**
```json
{
  "address": "zion1qyfe883hey...",
  "balance": 1000.5
}
```

**Error 400:**
```json
{"detail": "Invalid address: Invalid ZION address format"}
```

#### GET /wallet/transactions/{address}
Historie transakcí adresy.

**Response:**
```json
{
  "address": "zion1...",
  "transactions": [
    {
      "tx_id": "tx123...",
      "type": "received",
      "amount": 10.0,
      "timestamp": 1705312200
    }
  ]
}
```

#### POST /wallet/transactions
Vytvoření transakce.

**Request body:**
```json
{
  "from_address": "zion1from...",
  "to_address": "zion1to...",
  "amount": 100,
  "fee": 1000
}
```

**Response:**
```json
{
  "tx_id": "tx123...",
  "from_address": "zion1from...",
  "to_address": "zion1to...",
  "amount": 100,
  "fee": 1000,
  "timestamp": 1705312200
}
```

#### POST /wallet/encrypt
Zapnutí šifrování peněženky.

**Query parametry:**
- `password` (string): Heslo

**Response:**
```json
{"message": "Wallet encryption enabled"}
```

#### POST /wallet/unlock
Odemknutí šifrované peněženky.

**Query parametry:**
- `password` (string): Heslo

**Response 200:**
```json
{"message": "Wallet unlocked successfully"}
```

**Error 401:**
```json
{"detail": "Invalid password"}
```

#### POST /wallet/backup
Vytvoření zálohy peněženky.

**Query parametry:**
- `filename` (string, default="zion_wallet_backup.json")

**Response:**
```json
{"message": "Backup created: zion_wallet_backup.json"}
```

#### POST /wallet/restore
Obnovení peněženky ze zálohy.

**Query parametry:**
- `filename` (string): Soubor zálohy
- `password` (string, optional): Heslo

**Response:**
```json
{"message": "Wallet restored from: backup.json"}
```

---

### Mining

#### POST /mining/start
Spuštění těžby bloků.

**Request body:**
```json
{
  "address": "zion1miner...",
  "blocks": 10,
  "consciousness_level": "AWAKENED"
}
```

**Response:**
```json
{
  "message": "Started mining 10 blocks to zion1miner...",
  "consciousness_level": "AWAKENED"
}
```

#### GET /mining/status
Stav těžby.

**Response:**
```json
{
  "algorithm": "cosmic_harmony",
  "difficulty": 1.5,
  "asic_resistance": true,
  "gpu_enabled": true,
  "max_threads": 8
}
```

---

### Network

#### GET /network/peers
Seznam síťových peerů.

**Response:**
```json
{
  "peer_count": 25,
  "connected_peers": 12,
  "known_peers": 50,
  "peers": [
    {
      "host": "192.168.1.100",
      "port": 8333,
      "connected": true,
      "last_seen": "2024-01-15T10:30:00"
    }
  ]
}
```

#### POST /network/connect
Připojení k peerovi.

**Query parametry:**
- `host` (string): IP/hostname
- `port` (int): Port

**Response:**
```json
{"message": "Attempting to connect to 192.168.1.100:8333"}
```

#### POST /network/broadcast-transaction
Broadcast transakce do sítě.

**Request body:**
```json
{
  "tx_id": "tx123...",
  "from_address": "zion1from...",
  "to_address": "zion1to...",
  "amount": 100
}
```

**Response:**
```json
{"message": "Transaction broadcasted to 12 peers"}
```

#### POST /network/sync
Trigger synchronizace blockchainu.

**Response:**
```json
{"message": "Blockchain synchronization initiated"}
```

---

### Mempool

#### GET /mempool/stats
Statistiky mempoolu.

**Response:**
```json
{
  "size": 42,
  "min_fee_per_byte": 1,
  "max_fee_per_byte": 100,
  "avg_fee_per_byte": 10
}
```

#### GET /mempool/transactions
Transakce v mempoolu.

**Query parametry:**
- `limit` (int, default=50): Počet transakcí

**Response:**
```json
[
  {
    "tx_id": "tx123...",
    "from_address": "zion1from...",
    "to_address": "zion1to...",
    "amount": 100,
    "fee": 1000,
    "timestamp": 1705312200
  }
]
```

#### GET /mempool/transaction/{tx_id}
Konkrétní transakce v mempoolu.

**Response:** Stejné jako položka v seznamu.

**Error 404:**
```json
{"detail": "Transaction not found in mempool"}
```

#### POST /mempool/submit
Odeslání transakce do mempoolu.

**Request body:**
```json
{
  "from_address": "zion1from...",
  "to_address": "zion1to...",
  "amount": 100,
  "fee": 1000
}
```

**Response:**
```json
{
  "message": "Transaction submitted successfully",
  "tx_id": "tx123..."
}
```

---

### AI

#### GET /api/ai/overview
Přehled AI systému.

**Response:**
```json
{
  "ai_enabled": true,
  "components": {
    "consciousness": "active",
    "pool_orchestrator": "active",
    "warp_engine": "active"
  },
  "total_components": 11
}
```

#### GET /api/ai/status
#### GET /api/ai/status/{system_name}
Status AI systému nebo konkrétní komponenty.

**Response:**
```json
{
  "consciousness": {
    "running": true,
    "consciousness_level": 0.72,
    "optimization_cycles": 1543
  }
}
```

#### POST /api/ai/activate/{system_name}
Aktivace AI komponenty.

**Request body:**
```json
{
  "optimization_interval": 30
}
```

**Response:**
```json
{
  "status": "activated",
  "component": "consciousness"
}
```

#### POST /api/ai/deactivate/{system_name}
Deaktivace AI komponenty.

**Response:**
```json
{
  "status": "deactivated",
  "component": "consciousness"
}
```

#### POST /api/ai/execute/{system_name}
Spuštění AI úlohy.

**Request body:**
```json
{
  "task_type": "optimize",
  "parameters": {
    "target": "efficiency"
  }
}
```

**Response:**
```json
{
  "status": "completed",
  "result": {...}
}
```

#### GET /api/ai/metrics
Performance metriky AI.

**Response:**
```json
{
  "inference_time_avg_ms": 15.2,
  "optimization_cycles": 1543,
  "consciousness_level": 0.72,
  "accuracy": 0.89
}
```

#### GET /ai/status
Status AI orchestrátoru (legacy).

**Response:**
```json
{
  "ai_available": true,
  "orchestrator_status": {...},
  "timestamp": "2024-01-15T10:30:00"
}
```

#### POST /ai/sacred-mining
Sacred mining s AI podporou.

**Response:**
```json
{
  "sacred_mining_result": {...},
  "status": "completed",
  "timestamp": "2024-01-15T10:30:00"
}
```

#### GET /ai/analysis
Unified AI analýza.

**Response:**
```json
{
  "ai_analysis": {...},
  "status": "completed",
  "timestamp": "2024-01-15T10:30:00"
}
```

#### GET /ai/resources
AI resource usage.

**Response:**
```json
{
  "resource_usage": {
    "cpu_percent": 45.2,
    "memory_mb": 512,
    "gpu_utilization": 78.5
  },
  "optimization": {...},
  "timestamp": "2024-01-15T10:30:00"
}
```

---

### Legacy (Kompatibilita s 2.7)

#### GET /api/zion-2-7-stats
Statistiky pro 2.7 frontend.

**Response:**
```json
{
  "data": {
    "blockchain": {
      "block_height": 12345,
      "total_transactions": 54321,
      "difficulty": 1.5,
      "network_hashrate": "1500000 H/s",
      "status": "active",
      "total_supply": 15780000000
    },
    "mining": {
      "status": "active",
      "hashrate": 50000,
      "algorithm": "cosmic_harmony"
    },
    "wallet": {
      "addresses_count": 5,
      "total_balance": 1000.5,
      "encrypted": true
    },
    "ai": {
      "status": "active",
      "components": 11,
      "orchestrator": "active"
    },
    "system": {
      "api_version": "2.7.1",
      "uptime": "active"
    },
    "timestamp": "2024-01-15T10:30:00",
    "version": "2.7.1"
  },
  "message": "🌟 ZION 2.7.1 Real Data Active! 🌟",
  "success": true
}
```

#### GET /health/legacy
Legacy health check.

**Response:**
```json
{
  "service": "ZION 2.7.1 Frontend Bridge",
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00",
  "uptime": "0d 0h 0m",
  "version": "2.7.1"
}
```

---

## Příklady

### cURL

```bash
# Blockchain stats
curl http://localhost:8000/blockchain/stats

# Vytvoření adresy
curl -X POST "http://localhost:8000/wallet/addresses?label=Test"

# Odeslání transakce
curl -X POST http://localhost:8000/wallet/transactions \
  -H "Content-Type: application/json" \
  -d '{"from_address":"zion1from...","to_address":"zion1to...","amount":100}'

# Spuštění těžby
curl -X POST http://localhost:8000/mining/start \
  -H "Content-Type: application/json" \
  -d '{"address":"zion1miner...","blocks":5}'
```

### Python

```python
import requests

BASE_URL = "http://localhost:8000"

# Blockchain stats
stats = requests.get(f"{BASE_URL}/blockchain/stats").json()
print(f"Blocks: {stats['total_blocks']}")

# Balance
balance = requests.get(f"{BASE_URL}/wallet/balance/zion1...").json()
print(f"Balance: {balance['balance']} ZION")

# Transakce
tx = requests.post(f"{BASE_URL}/wallet/transactions", json={
    "from_address": "zion1from...",
    "to_address": "zion1to...",
    "amount": 100
}).json()
print(f"TX ID: {tx['tx_id']}")
```

### JavaScript

```javascript
const BASE_URL = "http://localhost:8000";

// Blockchain stats
const stats = await fetch(`${BASE_URL}/blockchain/stats`)
  .then(r => r.json());
console.log(`Blocks: ${stats.total_blocks}`);

// Balance
const balance = await fetch(`${BASE_URL}/wallet/balance/zion1...`)
  .then(r => r.json());
console.log(`Balance: ${balance.balance} ZION`);

// Transakce
const tx = await fetch(`${BASE_URL}/wallet/transactions`, {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({
    from_address: "zion1from...",
    to_address: "zion1to...",
    amount: 100
  })
}).then(r => r.json());
console.log(`TX ID: ${tx.tx_id}`);
```

---

## Chybové kódy

| HTTP Status | Význam | Příčina |
|-------------|--------|---------|
| 200 | OK | Úspěšný požadavek |
| 400 | Bad Request | Neplatné parametry (např. špatná adresa) |
| 401 | Unauthorized | Neplatné heslo |
| 404 | Not Found | Blok/transakce nenalezena |
| 429 | Too Many Requests | Překročen rate limit |
| 500 | Internal Server Error | Chyba serveru |
| 503 | Service Unavailable | AI/RPC není dostupné |

### Formát chyby

```json
{
  "detail": "Popis chyby"
}
```

---

## Environment Variables

```bash
ZION_API_HOST=127.0.0.1    # API host (default: localhost)
ZION_API_PORT=8000         # API port
ZION_LOG_LEVEL=INFO        # Log level (DEBUG, INFO, WARNING, ERROR)
ZION_ENV=production        # Environment name
RPC_URL=http://blockchain:8545  # Blockchain RPC
POOL_HOST=zion-pool-v2.9   # Pool host
POOL_PORT=3333             # Pool port
```

---

**ZION REST API v2.8.4** - Powered by FastAPI 🚀
