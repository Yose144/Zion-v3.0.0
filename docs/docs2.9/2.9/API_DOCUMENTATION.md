# ZION TerraNova API Documentation v2.9

**Base URL (Production):** `https://www.zionterranova.com/api`  
**Base URL (Local):** `http://localhost:8001/api`

## Overview

ZION v2.9 provides REST API endpoints for blockchain interaction, pool statistics, consciousness tracking, and WARP bridge operations.

## Authentication

Most read-only endpoints are public. Write operations require API key authentication:

```http
Authorization: Bearer YOUR_API_KEY
```

Request API key via [Discord](https://discord.gg/zion) or [Telegram](https://t.me/zionterranova).

---

## Health & Status

### GET `/health`

Check API service health and version.

**Request:**
```bash
curl https://www.zionterranova.com/api/health
```

**Response:**
```json
{
  "status": "ok",
  "version": "2.8.4",
  "uptime_seconds": 64751,
  "dependencies": {
    "blockchain": "healthy",
    "pool": "healthy",
    "redis": "healthy"
  }
}
```

---

## Pool Statistics

### GET `/pool/stats`

Retrieve current pool statistics.

**Request:**
```bash
curl https://www.zionterranova.com/api/pool/stats
```

**Response:**
```json
{
  "pool": {
    "hashrate": 12450.67,
    "hashrate_unit": "H/s",
    "miners_active": 42,
    "workers_online": 67,
    "blocks_found": 1523,
    "last_block": 1523,
    "last_block_time": "2025-12-17T10:45:32Z"
  },
  "network": {
    "difficulty": 125000,
    "block_height": 1523,
    "block_time": 60,
    "next_block_eta": 45
  }
}
```

### GET `/pool/miners`

List active miners (paginated).

**Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 50, max: 100)

**Request:**
```bash
curl "https://www.zionterranova.com/api/pool/miners?page=1&limit=20"
```

**Response:**
```json
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "miners": [
    {
      "address": "ZION_abc123...",
      "workers": 2,
      "hashrate": 245.67,
      "shares_accepted": 1523,
      "shares_rejected": 12,
      "consciousness_level": "MENTAL",
      "consciousness_xp": 2450,
      "last_seen": "2025-12-17T11:30:00Z"
    }
  ]
}
```

### GET `/pool/miner/:address`

Get detailed stats for specific miner address.

**Request:**
```bash
curl https://www.zionterranova.com/api/pool/miner/ZION_abc123...
```

**Response:**
```json
{
  "address": "ZION_abc123...",
  "total_hashrate": 245.67,
  "workers": [
    {
      "name": "desktop-1",
      "hashrate": 123.45,
      "shares_accepted": 850,
      "shares_rejected": 5,
      "last_seen": "2025-12-17T11:30:00Z"
    },
    {
      "name": "laptop-2",
      "hashrate": 122.22,
      "shares_accepted": 673,
      "shares_rejected": 7,
      "last_seen": "2025-12-17T11:29:55Z"
    }
  ],
  "consciousness": {
    "level": "MENTAL",
    "xp": 2450,
    "next_level_xp": 3000,
    "multiplier": 1.1
  },
  "earnings": {
    "total": 1523.45,
    "pending": 12.34,
    "paid": 1511.11
  }
}
```

---

## Blockchain

### GET `/blockchain/info`

Get current blockchain information.

**Request:**
```bash
curl https://www.zionterranova.com/api/blockchain/info
```

**Response:**
```json
{
  "chain": "ZION TerraNova",
  "version": "2.9.0",
  "block_height": 1523,
  "difficulty": 125000,
  "hashrate_estimate": 12450.67,
  "total_supply": 76150,
  "premine": 14340000000,
  "block_reward": 50,
  "consciousness_bonus": 1569.63,
  "algorithm": "Cosmic Harmony"
}
```

### GET `/blockchain/block/:height`

Get block details by height.

**Request:**
```bash
curl https://www.zionterranova.com/api/blockchain/block/1500
```

**Response:**
```json
{
  "height": 1500,
  "hash": "0x1a2b3c...",
  "timestamp": "2025-12-15T14:30:00Z",
  "difficulty": 124500,
  "nonce": 12345678,
  "transactions": 3,
  "reward": 50,
  "consciousness_bonus": 1569.63,
  "miner": "ZION_abc123...",
  "size": 2048
}
```

### GET `/blockchain/transaction/:txid`

Get transaction details.

**Request:**
```bash
curl https://www.zionterranova.com/api/blockchain/transaction/0xabcd1234...
```

**Response:**
```json
{
  "txid": "0xabcd1234...",
  "block_height": 1500,
  "timestamp": "2025-12-15T14:30:00Z",
  "confirmations": 23,
  "from": "ZION_sender...",
  "to": "ZION_receiver...",
  "amount": 100.5,
  "fee": 0.001,
  "status": "confirmed"
}
```

---

## Consciousness System

### GET `/consciousness/levels`

Get all consciousness levels and requirements.

**Request:**
```bash
curl https://www.zionterranova.com/api/consciousness/levels
```

**Response:**
```json
{
  "levels": [
    {
      "name": "PHYSICAL",
      "xp_required": 0,
      "multiplier": 1.0,
      "description": "Material realm foundation"
    },
    {
      "name": "MENTAL",
      "xp_required": 1000,
      "multiplier": 1.1,
      "description": "Intellectual awakening"
    },
    {
      "name": "COSMIC",
      "xp_required": 3000,
      "multiplier": 2.0,
      "description": "Universal consciousness"
    },
    {
      "name": "ON_THE_STAR",
      "xp_required": 10000,
      "multiplier": 15.0,
      "description": "Ascended master state"
    }
  ]
}
```

### GET `/consciousness/leaderboard`

Get top consciousness miners.

**Parameters:**
- `limit` (optional): Number of results (default: 100, max: 1000)

**Request:**
```bash
curl "https://www.zionterranova.com/api/consciousness/leaderboard?limit=10"
```

**Response:**
```json
{
  "updated_at": "2025-12-17T11:30:00Z",
  "leaderboard": [
    {
      "rank": 1,
      "address": "ZION_master1...",
      "level": "ON_THE_STAR",
      "xp": 25000,
      "hashrate": 500.0
    },
    {
      "rank": 2,
      "address": "ZION_cosmic2...",
      "level": "COSMIC",
      "xp": 8500,
      "hashrate": 350.0
    }
  ]
}
```

---

## WARP Bridge (Liquidity)

### GET `/warp/stats`

Get WARP bridge statistics.

**Request:**
```bash
curl https://www.zionterranova.com/api/warp/stats
```

**Response:**
```json
{
  "total_liquidity_zion": 1000000,
  "total_liquidity_usd": 250000,
  "supported_chains": ["Ethereum", "BSC", "Polygon"],
  "total_bridges": 523,
  "avg_bridge_time": 12,
  "avg_bridge_time_unit": "seconds"
}
```

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": {
    "code": "INVALID_ADDRESS",
    "message": "Invalid ZION address format",
    "details": "Address must start with ZION_ and be 42 characters"
  }
}
```

**Common Error Codes:**
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid API key)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error
- `503` - Service Unavailable

---

## Rate Limits

- **Public endpoints:** 100 requests/minute per IP
- **Authenticated:** 1000 requests/minute per API key

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1702814400
```

---

## WebSocket API (Real-time)

Connect to WebSocket for live updates:

```javascript
const ws = new WebSocket('wss://www.zionterranova.com/api/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'new_block':
      console.log('New block:', data.block_height);
      break;
    case 'pool_stats':
      console.log('Hashrate:', data.hashrate);
      break;
    case 'consciousness_update':
      console.log('Level up:', data.address, data.new_level);
      break;
  }
};

// Subscribe to events
ws.send(JSON.stringify({
  action: 'subscribe',
  events: ['new_block', 'pool_stats']
}));
```

**Event Types:**
- `new_block` - New block mined
- `pool_stats` - Pool statistics update (every 30s)
- `consciousness_update` - Miner consciousness level change
- `warp_bridge` - Cross-chain bridge event

---

## Code Examples

### Python

```python
import requests

# Get pool stats
response = requests.get('https://www.zionterranova.com/api/pool/stats')
data = response.json()
print(f"Pool hashrate: {data['pool']['hashrate']} H/s")

# Get miner stats
address = 'ZION_abc123...'
response = requests.get(f'https://www.zionterranova.com/api/pool/miner/{address}')
miner = response.json()
print(f"Your level: {miner['consciousness']['level']}")
```

### JavaScript

```javascript
// Fetch pool stats
fetch('https://www.zionterranova.com/api/pool/stats')
  .then(res => res.json())
  .then(data => {
    console.log(`Active miners: ${data.pool.miners_active}`);
  });

// Async/await
const getBlockInfo = async (height) => {
  const response = await fetch(
    `https://www.zionterranova.com/api/blockchain/block/${height}`
  );
  return response.json();
};
```

### cURL

```bash
# Get blockchain info
curl -X GET https://www.zionterranova.com/api/blockchain/info

# Get miner stats with authentication
curl -X GET \
  -H "Authorization: Bearer YOUR_API_KEY" \
  https://www.zionterranova.com/api/pool/miner/ZION_abc123...
```

---

## Support

- **Documentation:** [zionterranova.com/docs](https://zionterranova.com/docs)
- **Discord:** [discord.gg/zion](https://discord.gg/zion)
- **Telegram:** [t.me/zionterranova](https://t.me/zionterranova)
- **GitHub:** [github.com/zionterranova](https://github.com/zionterranova)

---

**Version:** v2.9.0  
**Last Updated:** December 17, 2025  
**License:** MIT
