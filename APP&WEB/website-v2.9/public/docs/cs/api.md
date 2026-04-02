# API Reference — ZION v2.9.6

ZION node poskytuje JSON-RPC 2.0 API na portu **8444** (testnet) a **8443** (mainnet).

---

## Endpoint

```text
POST http://localhost:8444/jsonrpc
Content-Type: application/json
```

---

## Metody

### get_info

Vrátí základní informace o nodu.

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

Vrátí informace o token supply.

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
    "mining_supply": 127720000000,
    "premine": 16280000000,
    "block_reward": 5400.067,
    "blocks_mined": 465
  }
}
```

---

### get_block

Vrátí blok podle výšky nebo hashe.

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_block","params":{"height":100}}' \
  -H 'Content-Type: application/json'
```

---

### get_block_header

Vrátí pouze hlavičku bloku, tedy rychlejší lehkou variantu.

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_block_header","params":{"height":100}}' \
  -H 'Content-Type: application/json'
```

---

### get_peer_info

Vrátí seznam připojených peerů.

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_peer_info"}' \
  -H 'Content-Type: application/json'
```

---

### get_mempool

Vrátí transakce čekající v mempoolu.

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_mempool"}' \
  -H 'Content-Type: application/json'
```

---

### get_balance

Vrátí zůstatek adresy.

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_balance","params":{"address":"zion1qADRESA"}}' \
  -H 'Content-Type: application/json'
```

---

### submit_block

Odešle nový blok, typicky pro mining workflow.

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"submit_block","params":{"block_data":"HEX_DATA"}}' \
  -H 'Content-Type: application/json'
```

---

## Porty

| Síť | P2P | RPC |
|-----|-----|-----|
| Testnet | 8334 | 8444 |
| Mainnet | 8333 | 8443 |

---

## Rate limiting

- Max. 100 spojení na RPC port
- Rate limit: 100 zpráv/s na P2P

---

## Pool API

Pool provozovaný přes `zion-pool` poskytuje REST API na portu **8080**:

```text
GET /api/stats          # Pool statistiky
GET /api/blocks         # Nalezené bloky
GET /api/miners/:addr   # Statistiky minera
```

---

*ZION TerraNova v2.9.6*