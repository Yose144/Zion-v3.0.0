# Architecture — ZION v2.9.5

---

## Protocol layers

```
┌─────────────────────────────────────┐
│           Application layer         │
│  Wallet CLI · Pool API · Explorer   │
├─────────────────────────────────────┤
│             RPC layer               │
│   JSON-RPC 2.0 (port 8444/8443)     │
├─────────────────────────────────────┤
│          Consensus layer             │
│   Cosmic Harmony v3 · LWMA DAA      │
├─────────────────────────────────────┤
│            P2P layer                │
│   libp2p · gossip · peer mgmt       │
│   (port 8334/8333)                  │
├─────────────────────────────────────┤
│          Data storage               │
│       LMDB · blockchain data       │
└─────────────────────────────────────┘
```

---

## Consensus: Cosmic Harmony v3

- **Type**: Proof-of-Work (multi-algo, CPU-friendly)
- **Block time**: 60 seconds
- **DAA**: LWMA (Linearly Weighted Moving Average)
  - Window: 60 blocks
  - Max change: ±25% per block
- **Soft finality**: 60 blocks
- **Max reorg depth**: 10 blocks
- **Min difficulty**: 1000

---

## Emission model

| Parameter | Value |
|-----------|-------|
| Block reward | 5,400.067 ZION |
| Halving | No (constant reward) |
| Mining supply | 127.22B ZION |
| Max mining blocks | 23,652,000 (~45 years) |
| Total emission | 144B ZION |
| Atomic units | 1 ZION = 1,000,000 |
| Fee policy | Burn |

---

## Premine (16.78B ZION)

Distributed at genesis (Jan 1, 2024 UTC):

| Fund | Amount | Purpose |
|------|--------|---------|
| Oasis + Golden Egg | 4.95B | Ecosystem, early-adopter rewards |
| DAO Treasury | 4.00B | Community governance |
| Infrastructure | 2.59B | Servers, development, audits |
| Humanitarian | 1.44B | Charitable projects |

---

## P2P network

| Parameter | Mainnet | Testnet |
|-----------|---------|---------|
| Max peers | 128 | 64 |
| Max inbound | 96 | 48 |
| Max outbound | 32 | 16 |
| Ban duration | 3600 s | 600 s |
| Rate limit | 100 msg/s | 200 msg/s |

---

## Storage

- **Engine**: LMDB (Lightning Memory-Mapped Database)
- **Data dir**: `/data/zion`
- **Max DB size**: 100 GB (mainnet) / 50 GB (testnet)

---

## Coinbase

- **Maturity**: 100 blocks (coinbase spendable after 100 confirmations)

---

## Mempool

| Parameter | Mainnet | Testnet |
|-----------|---------|---------|
| Max size | 300 MB | 100 MB |
| Min fee/byte | 1 atomic | 1 atomic |

---

## See also

- [Mining architecture](./mining.md)
- Operators: see onboarding docs under `/docs` (mining guide, pool setup)

---

*ZION TerraNova v2.9.5*
