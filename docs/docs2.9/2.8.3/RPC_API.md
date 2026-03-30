# ZION RPC API Reference

**Version:** 2.8.3 "Terra Nova"  
**Protocol:** JSON-RPC 2.0  
**Updated:** October 29, 2025  

## 🌐 Overview

The ZION RPC API provides programmatic access to blockchain functionality including wallet operations, transaction management, mining controls, and network information. All API calls use JSON-RPC 2.0 over HTTPS.

### Endpoints
- **Mainnet:** `https://api.zionblockchain.com` (planned)
- **Testnet:** `https://api.zionterranova.com`
- **Local Node:** `http://localhost:8545`

### Authentication
- **Method:** None required for read operations
- **SSL:** All endpoints use HTTPS with Let's Encrypt certificates
- **Rate Limits:** 100 requests per minute per IP

---

## 📋 API Methods

### Wallet Methods

#### `create_wallet`
Creates a new ZION wallet with public/private key pair.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "create_wallet",
  "params": {
    "password": "optional_password",
    "encrypt": true
  },
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "address": "zion1abc123def456ghi789jkl012mno345pqr678stu",
    "public_key": "04abc123...",
    "encrypted_private_key": "U2FsdGVkX1+abc123...",
    "mnemonic": "word1 word2 word3 ... word12"
  },
  "id": 1
}
```

#### `get_balance`
Retrieves the balance for a given address.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "get_balance",
  "params": {
    "address": "zion1abc123def456ghi789jkl012mno345pqr678stu"
  },
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "address": "zion1abc123def456ghi789jkl012mno345pqr678stu",
    "balance": "123.456789",
    "pending": "0.100000",
    "total": "123.556789"
  },
  "id": 1
}
```

#### `send_transaction`
Sends ZION tokens to another address.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "send_transaction",
  "params": {
    "from_address": "zion1abc123...",
    "to_address": "zion1def456...",
    "amount": "10.000000",
    "private_key": "your_private_key_here",
    "fee": "0.001000"
  },
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tx_hash": "0xabc123def456...",
    "block_height": 12345,
    "confirmations": 0,
    "fee": "0.001000"
  },
  "id": 1
}
```

### Transaction Methods

#### `get_transaction`
Retrieves details of a specific transaction.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "get_transaction",
  "params": {
    "tx_hash": "0xabc123def456..."
  },
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "hash": "0xabc123def456...",
    "block_height": 12345,
    "timestamp": 1638360000,
    "from": "zion1abc123...",
    "to": "zion1def456...",
    "amount": "10.000000",
    "fee": "0.001000",
    "confirmations": 12,
    "status": "confirmed"
  },
  "id": 1
}
```

#### `get_transaction_history`
Retrieves transaction history for an address.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "get_transaction_history",
  "params": {
    "address": "zion1abc123...",
    "limit": 50,
    "offset": 0
  },
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "address": "zion1abc123...",
    "total_transactions": 156,
    "transactions": [
      {
        "hash": "0xabc123...",
        "timestamp": 1638360000,
        "type": "sent",
        "amount": "-10.001000",
        "counterparty": "zion1def456...",
        "confirmations": 12
      }
    ]
  },
  "id": 1
}
```

### Blockchain Methods

#### `get_block`
Retrieves information about a specific block.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "get_block",
  "params": {
    "block_height": 12345
  },
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "height": 12345,
    "hash": "0xabc123def456...",
    "previous_hash": "0xdef789ghi012...",
    "timestamp": 1638360000,
    "transactions": 25,
    "size": 2048,
    "difficulty": "123456789",
    "nonce": "abc123def456",
    "miner": "zion1miner123...",
    "reward": "50.000000"
  },
  "id": 1
}
```

#### `get_blockchain_info`
Retrieves general blockchain information.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "get_blockchain_info",
  "params": {},
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "chain": "testnet-2.8.3",
    "blocks": 12345,
    "headers": 12345,
    "best_block_hash": "0xabc123...",
    "difficulty": "123456789",
    "median_time": 1638360000,
    "verification_progress": 1.0,
    "chain_work": "0x123456...",
    "size_on_disk": 1073741824,
    "pruned": false
  },
  "id": 1
}
```

### Mining Methods

#### `get_mining_info`
Retrieves current mining information.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "get_mining_info",
  "params": {},
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "blocks": 12345,
    "current_block_size": 2048,
    "current_block_tx": 25,
    "difficulty": "123456789",
    "network_hash_ps": 1234567890,
    "pooled_tx": 15,
    "chain": "testnet-2.8.3",
    "warnings": ""
  },
  "id": 1
}
```

#### `submit_block`
Submits a mined block to the network.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "submit_block",
  "params": {
    "block_data": "hex_encoded_block_data",
    "block_hash": "0xabc123..."
  },
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": "accepted"
}
```

### Network Methods

#### `get_network_info`
Retrieves network information and peer connections.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "get_network_info",
  "params": {},
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "version": "2.8.3",
    "subversion": "/ZION:2.8.3/",
    "protocol_version": 70015,
    "connections": 8,
    "networks": [
      {
        "name": "ipv4",
        "limited": false,
        "reachable": true,
        "proxy": "",
        "proxy_randomize_credentials": false
      }
    ],
    "relay_fee": 0.00001,
    "local_services": "0000000000000001",
    "local_relay": true,
    "time_offset": 0,
    "network_active": true,
    "connections_in": 4,
    "connections_out": 4
  },
  "id": 1
}
```

#### `get_peer_info`
Retrieves information about connected peers.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "get_peer_info",
  "params": {},
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": [
    {
      "id": 1,
      "addr": "192.168.1.100:8333",
      "addrbind": "10.0.0.1:8333",
      "addrlocal": "203.0.113.1:8333",
      "services": "0000000000000001",
      "relaytxes": true,
      "lastsend": 1638360000,
      "lastrecv": 1638360000,
      "bytessent": 12345,
      "bytesrecv": 12345,
      "conntime": 1638300000,
      "timeoffset": 0,
      "pingtime": 0.025,
      "minping": 0.021,
      "version": 70015,
      "subver": "/ZION:2.8.3/",
      "inbound": false,
      "addnode": false,
      "startingheight": 12300,
      "banscore": 0,
      "synced_headers": 12345,
      "synced_blocks": 12345,
      "inflight": [],
      "whitelisted": false
    }
  ],
  "id": 1
}
```

### Multisig Methods

#### `create_multisig`
Creates a multisig address requiring M of N signatures.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "create_multisig",
  "params": {
    "n_required": 2,
    "public_keys": [
      "04abc123...",
      "04def456...",
      "04ghi789..."
    ]
  },
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "address": "zion1multisig123...",
    "redeem_script": "522103abc...2103def...2103ghi...53ae",
    "n_required": 2,
    "public_keys": [
      "04abc123...",
      "04def456...",
      "04ghi789..."
    ]
  },
  "id": 1
}
```

#### `create_multisig_transaction`
Creates a multisig transaction requiring multiple signatures.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "create_multisig_transaction",
  "params": {
    "multisig_address": "zion1multisig123...",
    "recipients": [
      {
        "address": "zion1recipient...",
        "amount": "10.000000"
      }
    ],
    "fee": "0.001000"
  },
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tx_hash": "0xmultisig123...",
    "unsigned_tx": "hex_encoded_unsigned_transaction",
    "required_signatures": 2,
    "current_signatures": 0,
    "signers": [
      "zion1signer1...",
      "zion1signer2...",
      "zion1signer3..."
    ]
  },
  "id": 1
}
```

---

## 🔧 Usage Examples

### JavaScript (Node.js)
```javascript
const axios = require('axios');

async function getBalance(address) {
  try {
    const response = await axios.post('https://api.zionterranova.com', {
      jsonrpc: '2.0',
      method: 'get_balance',
      params: { address },
      id: 1
    });
    return response.data.result;
  } catch (error) {
    console.error('RPC Error:', error.message);
  }
}

// Usage
getBalance('zion1abc123...').then(balance => {
  console.log('Balance:', balance);
});
```

### Python
```python
import requests
import json

def get_balance(address):
    payload = {
        "jsonrpc": "2.0",
        "method": "get_balance",
        "params": {"address": address},
        "id": 1
    }
    
    try:
        response = requests.post(
            'https://api.zionterranova.com',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        return response.json()['result']
    except Exception as e:
        print(f"RPC Error: {e}")
        return None

# Usage
balance = get_balance('zion1abc123...')
if balance:
    print(f"Balance: {balance['balance']} ZION")
```

### cURL
```bash
# Get balance
curl -X POST https://api.zionterranova.com \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get_balance",
    "params": {"address": "zion1abc123..."},
    "id": 1
  }'

# Send transaction
curl -X POST https://api.zionterranova.com \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "send_transaction",
    "params": {
      "from_address": "zion1abc123...",
      "to_address": "zion1def456...",
      "amount": "10.000000",
      "private_key": "your_private_key",
      "fee": "0.001000"
    },
    "id": 1
  }'
```

### Go
```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
)

type RPCRequest struct {
    JSONRPC string      `json:"jsonrpc"`
    Method  string      `json:"method"`
    Params  interface{} `json:"params"`
    ID      int         `json:"id"`
}

type RPCResponse struct {
    JSONRPC string      `json:"jsonrpc"`
    Result  interface{} `json:"result,omitempty"`
    Error   interface{} `json:"error,omitempty"`
    ID      int         `json:"id"`
}

func callRPC(method string, params interface{}) (*RPCResponse, error) {
    req := RPCRequest{
        JSONRPC: "2.0",
        Method:  method,
        Params:  params,
        ID:      1,
    }
    
    jsonData, err := json.Marshal(req)
    if err != nil {
        return nil, err
    }
    
    resp, err := http.Post(
        "https://api.zionterranova.com",
        "application/json",
        bytes.NewBuffer(jsonData),
    )
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }
    
    var rpcResp RPCResponse
    if err := json.Unmarshal(body, &rpcResp); err != nil {
        return nil, err
    }
    
    return &rpcResp, nil
}

func main() {
    // Get balance
    resp, err := callRPC("get_balance", map[string]string{
        "address": "zion1abc123...",
    })
    if err != nil {
        fmt.Printf("Error: %v\n", err)
        return
    }
    
    fmt.Printf("Balance: %v\n", resp.Result)
}
```

---

## 📊 Error Codes

| Code | Message | Description |
|------|---------|-------------|
| -32700 | Parse error | Invalid JSON received |
| -32600 | Invalid request | The JSON sent is not a valid Request object |
| -32601 | Method not found | The method does not exist |
| -32602 | Invalid params | Invalid method parameter(s) |
| -32603 | Internal error | Internal JSON-RPC error |
| -32000 | Server error | Generic server error |
| -32001 | Authentication error | Authentication failed |
| -32002 | Insufficient funds | Not enough balance for transaction |
| -32003 | Invalid address | Invalid ZION address format |
| -32004 | Transaction rejected | Transaction rejected by network |

### Error Response Example
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32002,
    "message": "Insufficient funds",
    "data": {
      "required": "10.000000",
      "available": "5.000000"
    }
  },
  "id": 1
}
```

---

## 🔒 Security Considerations

### Transport Security
- Always use HTTPS endpoints
- Verify SSL certificates
- Use pinned certificates for production

### Authentication
- Never send private keys over HTTP
- Use encrypted connections for sensitive operations
- Implement proper session management

### Rate Limiting
- Respect rate limits (100 req/min)
- Implement exponential backoff for retries
- Cache responses when possible

### Input Validation
- Validate all addresses before use
- Sanitize transaction amounts
- Verify transaction data before signing

---

## 📈 Rate Limits & Quotas

### Public Endpoints
- **Requests per minute:** 100 per IP
- **Requests per hour:** 1000 per IP
- **Concurrent connections:** 10 per IP

### Premium Access (Future)
- Higher rate limits for verified applications
- Dedicated endpoints for high-volume users
- Priority support and SLA guarantees

### Monitoring Usage
Check your current usage:
```json
{
  "jsonrpc": "2.0",
  "method": "get_rate_limit_status",
  "params": {},
  "id": 1
}
```

---

## 🔄 WebSocket Support (Future)

Real-time notifications via WebSocket:
```javascript
const ws = new WebSocket('wss://api.zionterranova.com/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'subscribe',
    params: { topics: ['new_blocks', 'transactions'] },
    id: 1
  }));
};

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log('New event:', notification.params);
};
```

---

## 📚 Additional Resources

### Documentation
- **[Quick Start Guide](./QUICK_START.md)** - Get started quickly
- **[Mining Guide](./MINING_GUIDE.md)** - Mining tutorials
- **[Architecture Overview](./ARCHITECTURE.md)** - Technical details
- **[FAQ](./FAQ.md)** - Frequently asked questions
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues

### Tools & Libraries
- **JavaScript SDK:** [github.com/estrelaisabellazion3/zion-js-sdk](https://github.com/estrelaisabellazion3/zion-js-sdk)
- **Python SDK:** [github.com/estrelaisabellazion3/zion-python-sdk](https://github.com/estrelaisabellazion3/zion-python-sdk)
- **Go SDK:** [github.com/estrelaisabellazion3/zion-go-sdk](https://github.com/estrelaisabellazion3/zion-go-sdk)

### Community
- **GitHub:** [API Issues](https://github.com/estrelaisabellazion3/Zion-2.8/issues)
- **Forum:** [Developer Discussions](https://forum.zionterranova.com/c/developers)
- **Discord:** [Dev Chat](https://discord.gg/zion-dev)

---

**Need help with the API? Check our [FAQ](./FAQ.md) or [Troubleshooting Guide](./TROUBLESHOOTING.md), or open a [GitHub issue](https://github.com/estrelaisabellazion3/Zion-2.8/issues)!**

*ZION RPC API - Powering the humanitarian blockchain*  
*Version 2.8.3 "Terra Nova" - October 2025*