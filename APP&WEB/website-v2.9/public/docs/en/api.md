# API Reference — ZION v2.9.6

The ZION node exposes a JSON-RPC 2.0 API on port **8444** (testnet) and **8443** (the mainnet profile on the public rehearsal line).

---

## Endpoint

```text
POST http://localhost:8444/jsonrpc
Content-Type: application/json
```

---

## Methods

### get_info

Returns basic node information.

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_info"}' \
  -H 'Content-Type: application/json'
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "height": 465,
    "difficulty": 1648877,
    "network_hashrate": 27481,
    "peers": 12,
    "status": "OK",
    "version": "2.9.6",
    "chain_id": "zion-testnet-1"
  }
}
```

---

### get_supply

Returns token supply information.

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_supply"}' \
  -H 'Content-Type: application/json'
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "total_supply": 144000000000,
    "circulating_supply": 18791031,
    "mining_supply": 127220000000,
    "premine": 16780000000,
    "block_reward": 5400.067,
    "blocks_mined": 465
  }
}
```

---

### get_block

Returns a block by height or hash.

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_block","params":{"height":100}}' \
  -H 'Content-Type: application/json'
```

---

### get_block_header

Returns only the block header, which is a lighter and faster query.

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_block_header","params":{"height":100}}' \
  -H 'Content-Type: application/json'
```

---

### get_peer_info

Returns the list of connected peers.

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_peer_info"}' \
  -H 'Content-Type: application/json'
```

---

### get_mempool

Returns transactions currently waiting in the mempool.

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_mempool"}' \
  -H 'Content-Type: application/json'
```

---

### get_balance

Returns the balance for a specific address.

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_balance","params":{"address":"zion1qADDRESS"}}' \
  -H 'Content-Type: application/json'
```

---

### submit_block

Submits a new block, typically as part of a mining workflow.

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"submit_block","params":{"block_data":"HEX_DATA"}}' \
  -H 'Content-Type: application/json'
```

---

## Ports

| Network | P2P | RPC |
|---------|-----|-----|
| Testnet | 8334 | 8444 |
| Mainnet | 8333 | 8443 |

---

## Rate limiting

- Max 100 connections on the RPC port
- Rate limit: 100 messages/s on P2P

---

## Pool API

The pool run via `zion-pool` exposes a REST API on port **8080**:

```text
GET /api/stats          # Pool statistics
GET /api/blocks         # Found blocks
GET /api/miners/:addr   # Miner statistics
```

---

*ZION TerraNova v2.9.6*