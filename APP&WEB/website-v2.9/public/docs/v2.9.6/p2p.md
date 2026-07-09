# 🌐 P2P síťový protokol v2.9.6

> *Peer-to-peer komunikace ZION mainnetu.*
> **Operational note (2026-03-12):** Aktuální live testnet běží na jednom veřejném hostu Zion2 (seed.zionterranova.com) s interními seed kontejnery, na 2.9.8 Deeksha canonical path. Dřívější 3-node Helsinki/USA/Asia topologie je archivována.

---

## 1. Přehled sítě

ZION používá vlastní P2P protokol nad TCP s JSON-RPC zprávami.

| Parametr | Testnet | Mainnet |
|----------|---------|---------|
| P2P port | 8334 | 8333 |
| RPC port | 8444 | 8443 |
| Seed nody | 1 public + 2 internal | 3+ DNS (plán) |
| Max peers | 32 | 128 (plán) |
| Block time | 60 s | 60 s |

---

## 2. Aktuální seed nody

### Testnet (live 2026-03-12)

| Server | IP | Lokace | Role |
|--------|------|--------|------|
| Zion2 (Primary) | `seed.zionterranova.com:8334` | Německo (cloud VPS) | Public host + pool + web |
| Internal seed 1 | — | Za primárním hostem | Seed kontejner |
| Internal seed 2 | — | Za primárním hostem | Seed kontejner |

Archivováno: `seed.zionterranova.com` (Helsinki), `seed-us.zionterranova.com` (USA), `seed-asia.zionterranova.com` (Asia), `seed-de.zionterranova.com` (SeedDE), `seed-us1.zionterranova.com` (USA1).

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
         Zion2 public host
          seed.zionterranova.com
            /      \
           /        \
          /          \
   seed1 internal   seed2 internal
   DNS/container    DNS/container
```

    Aktuálně 1 veřejný host + interní seed kontejnery. Starší multi-node topologie je archivována.

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
    "seed.zionterranova.com:8334",
    "seed1.zionterranova.com:8334",
    "seed2.zionterranova.com:8334",
    "seed3.zionterranova.com:8334",
]

[network.limits]
max_peers = 32
connection_timeout = 10
ping_interval = 30
ban_duration = 3600
```
