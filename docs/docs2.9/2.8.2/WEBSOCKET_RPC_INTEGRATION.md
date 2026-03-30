# WebSocket-RPC Integration Guide

## Overview

ZION 2.8.2 now includes integrated WebSocket support in the RPC server, providing real-time communication capabilities for mining pools, blockchain monitoring, and live dashboards.

## Architecture

- **HTTP RPC Server**: Port 8545 (JSON-RPC 2.0 API)
- **WebSocket Server**: Port 8080 (Real-time events & subscriptions)
- **Unified Server**: Both services run from the same `ZIONRPCServer` instance

## Quick Start

```python
from core.zion_rpc_server import ZIONRPCServer
from core.new_zion_blockchain import NewZionBlockchain

# Create blockchain and RPC server
blockchain = NewZionBlockchain()
rpc_server = ZIONRPCServer(blockchain)

# Start both HTTP RPC and WebSocket servers
rpc_server.start()

print("🌐 HTTP RPC: http://localhost:8545")
print("🌐 WebSocket: ws://localhost:8080")
```

## WebSocket API

### Connection
```javascript
const ws = new WebSocket('ws://localhost:8080');
```

### Events
- `welcome` - Connection established with server info
- `event` - Custom broadcast events
- `metrics_update` - Periodic system metrics
- `error` - Error messages

### Client Messages
```javascript
// Ping/Pong for keep-alive
ws.send(JSON.stringify({type: 'ping'}));

// Subscribe to channels
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['blockchain', 'mining']
}));

// Request current status
ws.send(JSON.stringify({type: 'get_status'}));
```

### Event Handling
```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch(data.type) {
    case 'welcome':
      console.log('Connected:', data.server);
      break;
    case 'event':
      console.log('Event:', data.event_type, data.data);
      break;
    case 'metrics_update':
      console.log('Metrics:', data.data);
      break;
  }
};
```

## RPC API Extensions

### New RPC Methods

#### `subscribe_events`
Subscribe to real-time events via WebSocket.

```json
{
  "jsonrpc": "2.0",
  "method": "subscribe_events",
  "params": [["blockchain", "mining"]],
  "id": 1
}
```

**Response:**
```json
{
  "result": {
    "status": "subscribed",
    "channels": ["blockchain", "mining"],
    "websocket_url": "ws://localhost:8080",
    "message": "Use WebSocket connection for real-time updates"
  },
  "error": null,
  "id": 1
}
```

#### `get_websocket_status`
Get WebSocket server status.

```json
{
  "jsonrpc": "2.0",
  "method": "get_websocket_status",
  "params": [],
  "id": 2
}
```

**Response:**
```json
{
  "result": {
    "websocket_enabled": true,
    "websocket_host": "0.0.0.0",
    "websocket_port": 8080,
    "connected_clients": 3,
    "server_running": true
  },
  "error": null,
  "id": 2
}
```

#### `broadcast_event` (Admin)
Broadcast custom event to all WebSocket clients.

```json
{
  "jsonrpc": "2.0",
  "method": "broadcast_event",
  "params": ["custom_event", {"message": "Hello World"}],
  "id": 3
}
```

## Testing

### Manual Testing

1. **Start Server:**
```bash
cd /path/to/zion
python3 -c "
import sys
sys.path.insert(0, 'src')
from core.zion_rpc_server import ZIONRPCServer
from core.new_zion_blockchain import NewZionBlockchain
b = NewZionBlockchain()
s = ZIONRPCServer(b)
s.start()
input('Press Enter to stop')
"
```

2. **Test WebSocket:**
```bash
# Install wscat for testing
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:8080

# Send messages
{"type": "ping"}
{"type": "get_status"}
{"type": "subscribe", "channels": ["blockchain"]}
```

3. **Test RPC:**
```bash
# Get WebSocket status
curl -X POST http://localhost:8545 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"get_websocket_status","params":[],"id":1}'

# Subscribe to events
curl -X POST http://localhost:8545 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"subscribe_events","params":[["mining"]],"id":2}'
```

## Integration Points

### Mining Pool Integration
```python
# In mining pool, broadcast new blocks
rpc_server.broadcast_websocket_event('block_found', {
    'height': block_height,
    'hash': block_hash,
    'reward': block_reward
})
```

### Dashboard Integration
```javascript
// Real-time mining stats
ws.onmessage = (event) => {
  if (event.data.type === 'metrics_update') {
    updateDashboard(event.data.data.mining);
  }
};
```

## Roadmap Integration

This implementation provides the foundation for:

- **Phase 5.4**: Real-Time Infrastructure (Dec 2025)
- **Apache Kafka**: High-throughput event streaming
- **Monitoring Stack**: Prometheus + Grafana integration
- **Live Dashboards**: Real-time mining statistics

## Security

- WebSocket connections inherit RPC authentication
- Rate limiting applies to both HTTP and WebSocket
- Automatic cleanup of disconnected clients
- JSON message validation

## Dependencies

- `websockets` - WebSocket server library
- `asyncio` - Async event loop management
- `threading` - Concurrent server operation

Install with:
```bash
pip install websockets
```

---

**Status**: ✅ **COMPLETE** - WebSocket-RPC integration ready for production use in ZION 2.8.2