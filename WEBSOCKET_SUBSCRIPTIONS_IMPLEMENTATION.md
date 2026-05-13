# WebSocket Subscriptions Implementation

## Přehled

Tento dokument popisuje implementaci WebSocket subscriptions pro ZION V3, která umožňuje real-time streamování událostí z blockchainu do frontend aplikace.

## Architektura

### Backend (V3/L1/core/src/websocket.rs)

**Komponenty:**
- `WebSocketServer` - hlavní server pro WebSocket připojení
- `ClientSession` - správa jednotlivých klientů a jejich subscriptions
- `SubscriptionType` - enum pro typy subscriptions
- `WsMessage` / `ClientMessage` - message protokol

**Funkcionalita:**
- WebSocket server běží na samostatném portu (default: 8445)
- Podpora pro více typů subscriptions:
  - `NewBlocks` - stream nových bloků
  - `PendingTransactions` - stream pending TX v mempoolu
  - `Address` - stream pro konkrétní adresu
  - `NetworkStatus` - stream změn network statusu
- Auto-reconnect pro klienty
- Ping/Pong pro keepalive

**Konfigurace:**
- Environment variable: `ZION_WEBSOCKET_BIND` (default: `0.0.0.0:8445`)
- V `NodeConfig` přidáno `websocket_bind` pole

### Frontend (web2.9/src/lib/zion-rpc.ts)

**Komponenty:**
- `ZionWebSocketClient` - WebSocket klient pro browser
- `SubscriptionType` - enum pro typy subscriptions
- `WsMessage` / `ClientMessage` - TypeScript interfaces pro message protokol

**Funkcionalita:**
- Automatický reconnect při odpojení
- Správa subscriptions
- Typed message handling
- Connection state tracking

**API:**
```typescript
const ws = getZionWebSocket('ws://localhost:8445');

// Subscribe to new blocks
ws.subscribeToNewBlocks((data) => {
  console.log('New block:', data);
});

// Subscribe to pending transactions
ws.subscribeToPendingTransactions((data) => {
  console.log('Pending TX:', data);
});

// Subscribe to address updates
ws.subscribeToAddress('zion1...', (data) => {
  console.log('Address update:', data);
});

// Subscribe to network status
ws.subscribeToNetworkStatus((data) => {
  console.log('Network status:', data);
});
```

### React Hooks (web2.9/src/hooks/useWebSocketSubscription.ts)

**Custom Hooks:**
- `useWebSocketSubscription` - obecný hook pro subscriptions
- `useNewBlocks` - specifický hook pro nové bloky
- `usePendingTransactions` - specifický hook pro pending TX
- `useAddressSubscription` - specifický hook pro adresu
- `useNetworkStatus` - specifický hook pro network status
- `useWebSocketSubscriptions` - hook pro multiple subscriptions

**Příklad použití:**
```typescript
// Single subscription
const { data: networkStatus, isConnected } = useNetworkStatus(true);

// Address subscription
const { data: addressData } = useAddressSubscription('zion1...', true);

// Multiple subscriptions
const { isConnected } = useWebSocketSubscriptions([
  { type: SubscriptionType.NewBlocks, handler: handleNewBlocks },
  { type: SubscriptionType.PendingTransactions, handler: handlePendingTx },
]);
```

## Integrace do DeFi stránky

V `web2.9/src/app/defi/page.tsx` byl přidán:
- Import `useNetworkStatus` hook
- WebSocket connection status indikátor (Live/Polling)
- Real-time network status updates

**UI Changes:**
- Přidán indikátor WebSocket stavu vedle wallet bar
- Zelená ikona WiFi = připojeno (Live)
- Oranžová ikona WiFiOff = odpojeno (Polling)

## Message Protokol

### Client → Server

```json
{
  "subscribe": {
    "subscription": "new_blocks"
  }
}
```

```json
{
  "unsubscribe": {
    "subscription": "new_blocks"
  }
}
```

```json
{
  "ping": true
}
```

### Server → Client

**Notification:**
```json
{
  "notification": {
    "subscription": "new_blocks",
    "data": {
      "height": 12345,
      "hash": "0x...",
      "timestamp": 1715620800,
      "transaction_count": 42,
      "miner_address": "zion1...",
      "reward": 5400.067
    }
  }
}
```

**Subscription confirmation:**
```json
{
  "subscribed": {
    "subscription": "new_blocks"
  }
}
```

**Error:**
```json
{
  "error": {
    "code": -32000,
    "message": "Invalid subscription"
  }
}
```

## Backend Notifikace

**Implementované notifikace:**
1. ✅ `ws_server.notify_new_block()` při `import_peer_block()` a `import_peer_blocks()`
2. ✅ `ws_server.notify_pending_transaction()` při `submit_transaction_rpc()` a `submit_utxo_transaction_rpc()`
3. ⏳ `ws_server.notify_address_update()` při balance změně (future)
4. ⏳ `ws_server.notify_network_status()` při peer/mempool změně (future)

**Integration points:**
- ✅ `NodeRuntime::import_peer_block()` - pro nové bloky
- ✅ `NodeRuntime::import_peer_blocks()` - pro batch import bloků
- ✅ `NodeRuntime::submit_transaction_rpc()` - pro account model pending TX
- ✅ `NodeRuntime::submit_utxo_transaction_rpc()` - pro UTXO pending TX
- ⏳ `wallet::build_and_sign()` - pro balance změny (future)
- ⏳ `peer_manager` heartbeat - pro network status (future)

## Deployment

### Environment Variables
```bash
# WebSocket server bind address
ZION_WEBSOCKET_BIND=0.0.0.0:8445

# Pro frontend (pokud není na localhost)
NEXT_PUBLIC_WS_URL=ws://your-server.com:8445
```

### Docker
Přidat do Docker compose:
```yaml
services:
  node:
    environment:
      - ZION_WEBSOCKET_BIND=0.0.0.0:8445
    ports:
      - "8445:8445"
```

### Firewall
Otevřít port 8445:
```bash
sudo ufw allow 8445/tcp
```

## Testing

### Backend
```bash
# Build
cargo build --release --manifest-path V3/Cargo.toml -p zion-core

# Run s WebSocket enabled
ZION_WEBSOCKET_BIND=0.0.0.0:8445 cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node
```

### Frontend
```bash
# Start dev server
cd APP&WEB/website-v2.9
npm run dev

# Test v browser console
const ws = new WebSocket('ws://localhost:8445');
ws.onopen = () => ws.send(JSON.stringify({ subscribe: { subscription: 'new_blocks' }}));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

## Bezpečnost

**Current state:**
- Bez autentizace (public access)
- Bez rate limiting
- Bez message size limits

**Future improvements:**
- JWT autentizace
- Rate limiting per IP
- Message size limits
- CORS configuration
- WSS (TLS) pro production

## Performance

**Optimalizace:**
- Tokio async runtime pro non-blocking I/O
- Unbounded channels pro message passing (future: bounded channels)
- Connection pooling (future)

**Monitoring:**
- Connection count tracking
- Message rate metrics
- Error rate tracking

## Troubleshooting

**WebSocket se nepřipojuje:**
- Check jestli backend běží na portu 8445
- Check firewall rules
- Check CORS (pokud cross-origin)
- Check browser console pro error messages

**Žádné notifikace:**
- Check jestli backend volá notify metody
- Check subscription type
- Check message format v browser console

**Reconnect loop:**
- Check backend logs
- Check network stability
- Zvýšit reconnect interval

## Future Work

1. ✅ **Backend notifikace** - implementovat volání notify metod v NodeRuntime (DONE)
2. ⏳ **CLI WebSocket streaming** - implementovat skutečné WebSocket streamování v CLI (zatím jen placeholder)
3. ⏳ **Autentizace** - JWT token validation
4. ⏳ **Rate limiting** - per-IP limits
5. ⏳ **Message filtering** - client-side filtering pro redukci traffic
6. ⏳ **Persistence** - subscriptions přes reconnects
7. ⏳ **WSS** - TLS pro production
8. ⏳ **Monitoring** - Prometheus metrics pro WebSocket server
9. ⏳ **Testing** - integration tests pro WebSocket flow
10. ⏳ **Address balance notifikace** - implementovat notify_address_update při balance změně
11. ⏳ **Network status notifikace** - implementovat notify_network_status při peer/mempool změně

## Reference

- WebSocket spec: https://tools.ietf.org/html/rfc6455
- tokio-tungstenite: https://docs.rs/tokio-tungstenite
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket

## CLI Integration (V3/cli)

**Příkazy:**
```bash
# Subscribe to events
zion node websocket subscribe new_blocks
zion node websocket subscribe pending_transactions
zion node websocket subscribe address --address zion1...
zion node websocket subscribe network_status

# Unsubscribe
zion node websocket unsubscribe <subscription_id>

# Listen to subscriptions (streaming)
zion node websocket listen --host 0.0.0.0 --port 8445
```

**Config:**
```toml
[node]
websocket_port = 8445
```

**Environment variable:**
```bash
ZION_WEBSOCKET_BIND=0.0.0.0:8445
```

## Status

- ✅ WebSocket server backend (V3/L1/core/src/websocket.rs)
- ✅ WebSocket client frontend (web2.9/src/lib/zion-rpc.ts)
- ✅ React hooks (web2.9/src/hooks/useWebSocketSubscription.ts)
- ✅ DeFi page integration (web2.9/src/app/defi/page.tsx)
- ✅ CLI WebSocket commands (V3/cli/src/commands/node.rs)
- ✅ Backend notifikace (NodeRuntime integration)
- ⏳ End-to-end testing
- ⏳ Production hardening
