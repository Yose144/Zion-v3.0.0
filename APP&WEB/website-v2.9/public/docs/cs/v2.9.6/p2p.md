# 🌐 P2P síťový protokol v2.9.6

> *Peer-to-peer komunikace ZION mainnetu.*
> **Provozní poznámka (2026-03-12):** Aktuální live testnet běží na jednom veřejném hostu Zion2 (seed.zionterranova.com) s interními seed kontejnery, na 2.9.8 Deeksha kanonické cestě. Dřívější 3-node topologie Helsinki/USA/Asia je archivována.

---

## 1. Přehled sítě

ZION používá vlastní P2P protokol nad TCP s JSON-RPC zprávami.

| Parametr | Testnet | Mainnet |
|----------|---------|---------|
| P2P port | 8334 | 8333 |
| RPC port | 8444 | 8443 |
| Seed nody | 1 veřejný + 2 interní | 3+ DNS (plán) |
| Max peers | 32 | 128 (plán) |
| Čas bloku | 60 s | 60 s |

---

## 2. Aktuální seed nody

### Testnet (live 2026-03-12)

| Server | IP | Lokace | Role |
|--------|------|--------|------|
| Zion2 (Primary) | `seed.zionterranova.com:8334` | Německo (cloud VPS) | Veřejný host + pool + web |
| Interní seed 1 | — | Za primárním hostem | Seed kontejner |
| Interní seed 2 | — | Za primárním hostem | Seed kontejner |

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

1. **Bootstrap** — uzel se připojí k seedům z `config/*.toml`
2. **Peer exchange** — po handshake si uzly vymění známé peers
3. **Periodic ping** — keep-alive (interval 30 s)
4. **Ban list** — špatné chování (neplatné bloky, spam) → dočasný ban

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

## 4. Šíření bloků

1. Miner najde platný blok (hash < target)
2. Uzel validuje blok (PoW + transakce + časové razítko)
3. Pokud OK → `new_block` broadcast všem peers
4. Peers validují a dál šíří (flood fill)

```json
{
    "method": "new_block",
    "params": {
        "block": { },
        "height": 12346
    }
}
```

### Orphan handling

- Blok s neznámým `prev_hash` → uložen jako orphan
- Uzel vyžádá chybějící bloky přes `get_blocks`
- Po doplnění řetězce se orphan znovu validuje

---

## 5. Šíření transakcí

```json
{
    "method": "new_transaction",
    "params": {
        "tx": { }
    }
}
```

Transakce: mempool → broadcast peers. Duplicity přes tx ID.

---

## 6. Topologie sítě

```
         Zion2 veřejný host
          seed.zionterranova.com
            /      \
           /        \
          /          \
   interní seed1   interní seed2
   DNS/kontejner   DNS/kontejner
```

Nyní 1 veřejný host + interní seed kontejnery. Starší multi-node topologie je archivována.

---

## 7. Bezpečnost

| Ochrana | Implementace |
|---------|--------------|
| Posun času | max ±24 h (testnet), ±2 h (mainnet) |
| Eclipse | více seedů, rotace peers |
| Sybil | PoW jako ekonomická bariéra |
| DoS | rate limiting, ban, max spojení |
| Withholding bloků | LWMA (okno 60 bloků) |

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
