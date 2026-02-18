# 🌐 P2P síťový protokol v2.9.6

> *Peer-to-peer komunikace ZION mainnetu.*

---

## 1. Přehled sítě

ZION používá vlastní P2P protokol nad TCP s JSON-RPC zprávami.

| Parametr | Testnet | Mainnet |
|----------|---------|---------|
| P2P port | 8334 | 8333 |
| RPC port | 8444 | 8443 |
| Seed nody | 2 | 3 (plán) |
| Max peers | 32 | 128 (plán) |
| Block time | 60 s | 60 s |

---

## 2. Aktuální seed nody

### Testnet (aktivní)

| Server | IP | Lokace | Role |
|--------|------|--------|------|
| Helsinki | `77.42.31.72:8334` | Finsko | Seed + web + pool |
| Germany | `195.201.31.201:8334` | Německo | Peer node |

### Mainnet (plánováno)

```toml
# config/mainnet.toml
[network.seeds]
nodes = [
    "seed1.zionterranova.com:8333",
    "seed2.zionterranova.com:8333",
    "seed3.zionterranova.com:8333",
]
```

---

## 3. Peer discovery

1. **Bootstrap** — node se připojí k seed nodům definovaným v `config/*.toml`
2. **Peer exchange** — po handshake si nody vymění seznam známých peers
3. **Periodic ping** — keep-alive heartbeat (30 s interval)
4. **Ban list** — misbehaving peers (invalid blocks, spam) dočasně banovány

### Handshake

```json
{
    "method": "handshake",
    "params": {
        "version": "2.9.6",
        "network": "testnet",
        "height": 12345,
        "genesis_hash": "...",
        "user_agent": "zion-core/2.9.6"
    }
}
```

---

## 4. Block propagation

1. Miner najde platný blok (hash < target)
2. Node validuje blok (PoW + transactions + timestamp)
3. Pokud validní → `new_block` broadcast všem peers
4. Peers validují a propagují dál (flood fill)

```json
{
    "method": "new_block",
    "params": {
        "block": { ... },
        "height": 12346
    }
}
```

### Orphan handling

- Pokud přijatý blok odkazuje na neznámý `prev_hash` → uložen jako orphan
- Node požádá peers o chybějící blok(y) přes `get_blocks`
- Po doplnění chain se orphan revaliduje

---

## 5. Transaction propagation

```json
{
    "method": "new_transaction",
    "params": {
        "tx": { ... }
    }
}
```

Transakce se šíří mempool → peers broadcasting. Duplicate detection přes tx ID.

---

## 6. Síťová topologie

```
                    ┌─────────────┐
                    │  Seed Node  │
                    │  Helsinki   │
                    │ 77.42.31.72 │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌───┴───┐ ┌──────┴──────┐
        │  Germany   │ │ Miner │ │  Pool Node  │
        │195.201.31. │ │  (1)  │ │  Helsinki   │
        │   201      │ └───────┘ └─────────────┘
        └────────────┘
```

Aktuálně 2 nody. Pro mainnet cíl: minimálně 5 seed nodů na 3 kontinentech.

---

## 7. Bezpečnostní opatření

| Ochrana | Implementace |
|---------|-------------|
| Timestamp drift | Max ±24 h (testnet), ±2 h (mainnet) |
| Eclipse attack | Multiple seed nody, peer rotation |
| Sybil attack | PoW = ekonomická bariéra |
| DoS | Rate limiting, peer ban, max connections |
| Block withholding | LWMA difficulty adjustment (60-blokové okno) |

---

## 8. Konfigurace

```toml
# config/testnet.toml
[network]
network_type = "testnet"
p2p_port = 8334
rpc_port = 8444

[network.seeds]
nodes = [
    "77.42.31.72:8334",
    "195.201.31.201:8334",
]

[network.limits]
max_peers = 32
connection_timeout = 10
ping_interval = 30
ban_duration = 3600
```
