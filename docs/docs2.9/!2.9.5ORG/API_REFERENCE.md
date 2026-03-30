# ZION TerraNova v2.9.5 - API Reference

## Overview

ZION provides multiple API interfaces for interacting with the blockchain, mining pool, and consciousness gaming system.

---

## 🌐 Blockchain RPC API

**Endpoint:** `http://localhost:8545` (ETH-style) or `http://localhost:18081` (Monero-style)

### Standard Methods

#### `getblockcount`
Returns the current block height.

```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getblockcount","params":[],"id":1}'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": 12345,
  "id": 1
}
```

#### `getblock`
Returns block data by height or hash.

```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getblock","params":[12345],"id":1}'
```

#### `getbalance`
Returns wallet balance.

```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getbalance","params":["zion1abc..."],"id":1}'
```

#### `sendtransaction`
Sends ZION tokens.

```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"sendtransaction","params":{"from":"zion1...","to":"zion1...","amount":100},"id":1}'
```

---

## ⛏️ Mining Pool API

**Endpoint:** `http://localhost:8080`

### Pool Statistics

#### `GET /stats`
Returns current pool statistics.

```bash
curl http://localhost:8080/stats
```

**Response:**
```json
{
  "pool_hashrate": 15000,
  "pool_hashrate_unit": "H/s",
  "connected_miners": 42,
  "blocks_found": 156,
  "last_block_time": "2026-01-21T10:30:00Z",
  "difficulty": 100000,
  "fee_percent": 1.0
}
```

#### `GET /blocks`
Returns list of found blocks.

```bash
curl http://localhost:8080/blocks
```

**Response:**
```json
{
  "blocks": [
    {
      "height": 12345,
      "hash": "0x...",
      "finder": "zion1...",
      "reward": 1619.63,
      "timestamp": "2026-01-21T10:30:00Z"
    }
  ]
}
```

#### `GET /miners`
Returns connected miners list.

```bash
curl http://localhost:8080/miners
```

#### `GET /miner/{address}`
Returns specific miner statistics.

```bash
curl http://localhost:8080/miner/zion1abc123...
```

**Response:**
```json
{
  "address": "zion1abc123...",
  "hashrate": 500,
  "shares_valid": 1234,
  "shares_invalid": 2,
  "last_share": "2026-01-21T10:29:55Z",
  "consciousness_level": "MENTAL",
  "consciousness_xp": 15000,
  "pending_balance": 50.5
}
```

#### `GET /payouts`
Returns payout history.

```bash
curl http://localhost:8080/payouts
```

---

## 🎮 Consciousness Gaming API

**Endpoint:** `http://localhost:8080/consciousness`

### NCL (Non-Linear Consciousness Level) System

#### `GET /consciousness/level/{address}`
Returns miner's consciousness level and XP.

```bash
curl http://localhost:8080/consciousness/level/zion1abc...
```

**Response:**
```json
{
  "address": "zion1abc...",
  "level": "COSMIC",
  "xp": 150000,
  "multiplier": 2.0,
  "next_level": "ON_THE_STAR",
  "xp_to_next": 350000
}
```

### Consciousness Levels

| Level | XP Required | Reward Multiplier |
|-------|-------------|-------------------|
| PHYSICAL | 0 | 1.0x |
| EMOTIONAL | 10,000 | 1.05x |
| MENTAL | 50,000 | 1.1x |
| INTUITIONAL | 100,000 | 1.25x |
| SPIRITUAL | 250,000 | 1.5x |
| COSMIC | 500,000 | 2.0x |
| ON_THE_STAR | 1,000,000 | 15.0x |

### XP Earning

- **Valid Share:** +10 XP
- **Block Found:** +1,000 XP
- **Streak Bonus:** +5% per consecutive day
- **Community Bonus:** Variable

---

## 🔌 Stratum Protocol

**Endpoint:** `stratum+tcp://pool.zionterranova.com:3333`

### Connection Flow

1. **Login**
```json
{"id":1,"method":"login","params":{"login":"WALLET_ADDRESS","pass":"x","agent":"miner/1.0"}}
```

2. **Receive Job**
```json
{"id":1,"jsonrpc":"2.0","result":{"id":"worker_id","job":{"blob":"...","job_id":"...","target":"...","height":12345},"status":"OK"}}
```

3. **Submit Share**
```json
{"id":2,"method":"submit","params":{"id":"worker_id","job_id":"...","nonce":"...","result":"..."}}
```

### Supported Algorithms

| Algorithm | Param | Description |
|-----------|-------|-------------|
| `cosmic_harmony` | Default | ZION native algorithm |
| `randomx` | `algo=rx/0` | Monero-compatible |
| `yescrypt` | `algo=yescrypt` | Memory-hard |
| `kheavyhash` | `algo=kheavyhash` | Kaspa-compatible |
| `argon2d` | `algo=argon2d` | Memory-hard |
| `ethash` | `algo=ethash` | ETC-compatible |
| `equihash` | `algo=equihash` | ZEC-compatible |

---

## 🛡️ Error Codes

| Code | Description |
|------|-------------|
| `-1` | Unknown error |
| `-2` | Invalid JSON |
| `-3` | Method not found |
| `-4` | Invalid params |
| `-21` | Job not found |
| `-22` | Duplicate share |
| `-23` | Low difficulty share |
| `-24` | Invalid nonce |
| `-25` | Stale share |
| `-31` | Unauthenticated |
| `-32` | Invalid wallet address |

---

## 📡 WebSocket API

**Endpoint:** `ws://localhost:8080/ws`

### Subscribe to Events

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    method: 'subscribe',
    params: ['blocks', 'stats', 'consciousness']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data.payload);
};
```

### Event Types

- `new_block` - New block found
- `stats_update` - Pool stats updated (every 10s)
- `consciousness_levelup` - Miner leveled up
- `payout` - Payout processed

---

## 🔐 Authentication

For administrative endpoints, use API key authentication:

```bash
curl -H "X-API-Key: your_api_key" http://localhost:8080/admin/stats
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Public API | 100 req/min |
| Miner API | 1000 req/min |
| Admin API | 50 req/min |

---

## SDK Examples

### Python
```python
import requests

class ZionAPI:
    def __init__(self, pool_url="http://localhost:8080"):
        self.pool_url = pool_url
    
    def get_stats(self):
        return requests.get(f"{self.pool_url}/stats").json()
    
    def get_miner(self, address):
        return requests.get(f"{self.pool_url}/miner/{address}").json()

# Usage
api = ZionAPI("http://pool.zionterranova.com:8080")
print(api.get_stats())
```

### JavaScript
```javascript
const axios = require('axios');

class ZionAPI {
  constructor(poolUrl = 'http://localhost:8080') {
    this.poolUrl = poolUrl;
  }

  async getStats() {
    const { data } = await axios.get(`${this.poolUrl}/stats`);
    return data;
  }

  async getMiner(address) {
    const { data } = await axios.get(`${this.poolUrl}/miner/${address}`);
    return data;
  }
}

// Usage
const api = new ZionAPI('http://pool.zionterranova.com:8080');
api.getStats().then(console.log);
```

---

**Version:** 2.9.5  
**Last Updated:** January 2026
