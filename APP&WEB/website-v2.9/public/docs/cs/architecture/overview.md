# Architektura — ZION v2.9.5

---

## Vrstvy protokolu

```
┌─────────────────────────────────────┐
│           Aplikační vrstva          │
│  Wallet CLI · Pool API · Explorer  │
├─────────────────────────────────────┤
│             RPC vrstva              │
│   JSON-RPC 2.0 (port 8444/8443)    │
├─────────────────────────────────────┤
│          Konsenzus vrstva           │
│   Cosmic Harmony v3 · LWMA DAA     │
├─────────────────────────────────────┤
│            P2P vrstva               │
│   libp2p · gossip · peer mgmt      │
│   (port 8334/8333)                 │
├─────────────────────────────────────┤
│          Úložiště dat               │
│       LMDB · blockchain data       │
└─────────────────────────────────────┘
```

---

## Konsenzus: Cosmic Harmony v3

- **Typ**: Proof-of-Work (multi-algo, CPU-friendly)
- **Block time**: 60 sekund
- **DAA**: LWMA (Linearly Weighted Moving Average)
  - Okno: 60 bloků
  - Max změna: ±25 % za blok
- **Soft finality**: 60 bloků
- **Max reorg depth**: 10 bloků
- **Min difficulty**: 1000

---

## Emisní model

| Parametr | Hodnota |
|----------|---------|
| Block reward | 5 400,067 ZION |
| Halving | Ne (konstantní) |
| Mining supply | 127,22 mld ZION |
| Max mining bloků | 23 652 000 (~45 let) |
| Celková emise | 144 mld ZION |
| Atomické jednotky | 1 ZION = 1 000 000 |
| Fee policy | Burn (spalování) |

---

## Premine (16,78 mld ZION)

Distribuováno při genesi (Jan 1, 2024 UTC):

| Fond | Množství | Účel |
|------|----------|------|
| Oasis + Golden Egg | 4,95 mld | Ekosystém, early adopter odměny |
| L5 Free World Projects | 3,30 mld | Komunitní projekty (přesunuto ze Slotů 4 & 5) |
| DAO Treasury | 4,00 mld | Komunitní správa |
| Infrastruktura | 2,59 mld | Servery, vývoj, audit |
| Humanitární | 1,44 mld | Charitativní projekty |

---

## P2P síť

| Parametr | Mainnet | Testnet |
|----------|---------|---------|
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

- **Maturity**: 100 bloků (coinbase transakce je utratitelná po 100 potvrzeních)

---

## Mempool

| Parametr | Mainnet | Testnet |
|----------|---------|---------|
| Max size | 300 MB | 100 MB |
| Min fee/byte | 1 atomic | 1 atomic |

---

## Další

- [Mining architektura →](#arch-mining)
- [API Reference →](#api)
- [Quick Start →](#getting-started)

---

*ZION TerraNova v2.9.5*
