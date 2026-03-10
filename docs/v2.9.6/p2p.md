# 🌐 P2P síťový protokol v2.9.6

> *Peer-to-peer komunikace ZION mainnetu.*
> **Operational note (2026-03-10):** Aktuální live testnet běží jako 3-node mesh Helsinki + USA + Asia na 2.9.8 Deeksha canonical path. Níže uvedený 5-node model je historický kontext v2.9.6.

---

## 1. Přehled sítě

ZION používá vlastní P2P protokol nad TCP s JSON-RPC zprávami.

| Parametr | Testnet | Mainnet |
|----------|---------|---------|
| P2P port | 8334 | 8333 |
| RPC port | 8444 | 8443 |
| Seed nody | 3 live / 5 historicky | 3+ DNS (plán) |
| Max peers | 32 | 128 (plán) |
| Block time | 60 s | 60 s |

---

## 2. Aktuální seed nody

### Testnet (live 2026-03-10)

| Server | IP | Lokace | Role |
|--------|------|--------|------|
| Helsinki | `77.42.31.72:8334` | Finsko | Seed + web + pool |
| USA | `178.156.240.160:8334` | USA East | Seed + miner |
| Asia | `5.223.43.93:8334` | Asie (SG) | Seed + miner |

Historicky decommissioned: `46.225.126.243` (SeedDE), `5.78.178.227` (Usa1).

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
          Helsinki (pool + seed)
              77.42.31.72
               /       \
              /         \
             /           \
  USA seed + miner     Asia seed + miner
   178.156.240.160        5.223.43.93
```

    Aktuálně 3 live nody na 3 kontinentech.

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
    "178.156.240.160:8334",
    "5.223.43.93:8334",
]

[network.limits]
max_peers = 32
connection_timeout = 10
ping_interval = 30
ban_duration = 3600
```
