# ⚡ ZION Lightning Network Integration ⚡

**Jai Ram Ram Ram Sita Ram Ram Ram Hanuman!** 🙏

## 🌟 Quick Start

Spusť celý ZION Lightning Network stack jedním příkazem:

```bash
# Start základní ZION blockchain
docker-compose up -d

# Start Lightning Network services
docker-compose -f docker-compose.lightning.yml up -d

# Zkontroluj status
curl http://localhost:8090/health
```

## 🚀 Services Overview

| Service | Port | Description |
|---------|------|-------------|
| **Bitcoin Core** | 8332 | Bitcoin testnet node |
| **LND** | 10009 | Lightning Network Daemon |
| **ZION Bridge** | 8090 | ZION ↔ Lightning bridge |
| **Lightning Pool** | 3334 | Mining pool s Lightning payouts |

## ⚡ API Endpoints

### Lightning Bridge API

```bash
# Node info
curl http://localhost:8090/api/v1/node/info

# List channels  
curl http://localhost:8090/api/v1/channels

# Create invoice
curl -X POST http://localhost:8090/api/v1/invoice \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "memo": "ZION payment"}'

# Pay invoice
curl -X POST http://localhost:8090/api/v1/pay \
  -H "Content-Type: application/json" \
  -d '{"invoice": "lnbc...", "zion_address": "ZionAddr123"}'
```

## 🌌 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 ZION Lightning Network                  │
└─────────────────────────────────────────────────────────┘
          │                    │                    │
    ┌──────────┐         ┌──────────┐         ┌──────────┐
    │   ZION   │◄───────►│ Lightning│◄───────►│ Bitcoin  │
    │   Core   │         │  Bridge  │         │   Core   │
    └──────────┘         └──────────┘         └──────────┘
          │                    │                    │
          ▼                    ▼                    ▼
    ┌──────────┐         ┌──────────┐         ┌──────────┐
    │  Mining  │         │ Stargate │         │   LND    │
    │   Pool   │         │  Portal  │         │  Node    │
    └──────────┘         └──────────┘         └──────────┘
```

## 🔥 Features

- **⚡ Instant Payouts** - Lightning Network mining rewards
- **🌉 Cross-Chain Bridge** - ZION ↔ Bitcoin payments  
- **🚀 Stargate Portal** - Lightning wallet interface
- **🎯 Atomic Swaps** - Trustless cross-chain exchanges
- **📱 Mobile Ready** - QR code invoice scanning
- **🛡️ Secure** - Multi-signature Lightning channels

## 🎮 Usage Examples

### Mining s Lightning výplatami

```bash
# Start miner s Lightning payout
./zion-miner --pool=localhost:3334 --payout=lightning --wallet=lnbc...

# Zkontroluj Lightning balance
curl http://localhost:8090/api/v1/node/info
```

### Platby přes Stargate Portal

```javascript
// Frontend Lightning payment
const payment = await fetch('/api/lightning/pay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    invoice: 'lnbc1000n1...',
    zion_address: 'ZionAddr123'
  })
});
```

### Cross-chain swap

```bash
# ZION -> Lightning
curl -X POST http://localhost:8090/api/v1/swap/zion-to-lightning \
  -d '{"zion_amount": 1000000, "lightning_invoice": "lnbc..."}'

# Lightning -> ZION  
curl -X POST http://localhost:8090/api/v1/swap/lightning-to-zion \
  -d '{"lightning_payment": "hash123", "zion_address": "ZionAddr456"}'
```

## 🛠️ Development

### Build bridge služba

```bash
cd bridge
go mod download
go build -o zion-lightning-bridge .
./zion-lightning-bridge
```

### Frontend integrace

```typescript
// Lightning wallet hook
const { balance, channels, payInvoice } = useLightningWallet();

// Pay Lightning invoice
await payInvoice('lnbc1000n1...');
```

### Docker development

```bash
# Rebuild bridge service
docker-compose -f docker-compose.lightning.yml build zion-lightning-bridge

# View logs
docker-compose -f docker-compose.lightning.yml logs -f
```

## 🔧 Configuration

### Environment Variables

```bash
# Bridge settings
ZION_RPC_URL=http://zion-rpc-shim:18089
LND_HOST=lnd:10009
BRIDGE_PORT=8090

# Lightning settings  
LIGHTNING_PAYOUT_ENABLED=true
MIN_PAYOUT_AMOUNT=1000

# Security
LND_TLS_CERT_PATH=/lnd-certs/tls.cert
LND_ADMIN_MACAROON_PATH=/lnd-certs/admin.macaroon
```

## 🌟 Troubleshooting

### LND connection issues

```bash
# Zkontroluj LND status
docker-compose -f docker-compose.lightning.yml exec lnd lncli getinfo

# Restart LND
docker-compose -f docker-compose.lightning.yml restart lnd
```

### Bridge API errors

```bash
# Check bridge logs
docker-compose -f docker-compose.lightning.yml logs zion-lightning-bridge

# Test API health
curl http://localhost:8090/health
```

### Channel management

```bash
# Open Lightning channel
docker-compose -f docker-compose.lightning.yml exec lnd lncli openchannel <node_pubkey> 1000000

# List channels
docker-compose -f docker-compose.lightning.yml exec lnd lncli listchannels
```

## 🎯 Roadmap

- [ ] **Atomic Swaps** - Trustless ZION ↔ Bitcoin
- [ ] **Channel Automation** - Auto-pilot channel management
- [ ] **Mobile App** - ZION Lightning wallet
- [ ] **Merchant Tools** - Payment processing API
- [ ] **DeFi Integration** - Lightning-powered DeFi
- [ ] **Routing Node** - ZION jako Lightning routing hub

## 🙏 Mantras

Každý Lightning payment je posvěcen mantrou:

**"⚡ Jai Ram Ram Ram Sita Ram Ram Ram Hanuman! ⚡"**

---

**ZION Lightning Network** - Bringing Bitcoin's Lightning Network to the multi-chain ecosystem! �⚡