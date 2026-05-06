# 🌐 P2P network protocol v2.9.6

> *ZION mainnet peer-to-peer communication.*
> **Operational note (2026-03-12):** The live testnet currently runs on a single public host Zion2 (91.98.122.165) with internal seed containers, on the 2.9.8 Deeksha canonical path. The earlier 3-node Helsinki / USA / Asia topology is archived.

---

## 1. Network overview

ZION uses a custom P2P protocol over TCP with JSON-RPC messages.

| Parameter | Testnet | Mainnet |
|-----------|---------|---------|
| P2P port | 8334 | 8333 |
| RPC port | 8444 | 8443 |
| Seed nodes | 1 public + 2 internal | 3+ DNS (planned) |
| Max peers | 32 | 128 (planned) |
| Block time | 60 s | 60 s |

---

## 2. Current seed nodes

### Testnet (live 2026-03-12)

| Server | IP | Location | Role |
|--------|-----|----------|------|
| Zion2 (Primary) | `91.98.122.165:8334` | Germany (Hetzner) | Public host + pool + web |
| Internal seed 1 | — | Behind primary host | Seed container |
| Internal seed 2 | — | Behind primary host | Seed container |

Archived: `77.42.31.72` (Helsinki), `178.156.240.160` (USA), `5.223.43.93` (Asia), `46.225.126.243` (SeedDE), `5.78.178.227` (USA1).

### Mainnet (planned)

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

1. **Bootstrap** — node connects to seeds from `config/*.toml`
2. **Peer exchange** — after handshake, nodes swap known peers
3. **Periodic ping** — keep-alive (30 s interval)
4. **Ban list** — misbehaviour (invalid blocks, spam) → temporary ban

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

1. Miner finds a valid block (hash < target)
2. Node validates block (PoW + transactions + timestamp)
3. If valid → `new_block` broadcast to all peers
4. Peers validate and flood-fill onward

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

- Incoming block references unknown `prev_hash` → stored as orphan
- Node requests missing blocks via `get_blocks`
- After the chain is filled in, the orphan is revalidated

---

## 5. Transaction propagation

```json
{
    "method": "new_transaction",
    "params": {
        "tx": { }
    }
}
```

Transactions flow mempool → peer broadcast. Duplicates detected by tx ID.

---

## 6. Network topology

```
         Zion2 public host
          91.98.122.165
            /      \
           /        \
          /          \
   internal seed1   internal seed2
   DNS/container    DNS/container
```

Today: one public host + internal seed containers. Older multi-node topology is archived.

---

## 7. Security measures

| Protection | Implementation |
|------------|------------------|
| Timestamp drift | max ±24 h (testnet), ±2 h (mainnet) |
| Eclipse | multiple seeds, peer rotation |
| Sybil | PoW as economic barrier |
| DoS | rate limiting, ban, max connections |
| Block withholding | LWMA difficulty (60-block window) |

---

## 8. Configuration

```toml
# config/testnet.toml
[network]
network_type = "testnet"
p2p_port = 8334
rpc_port = 8444

[network.seeds]
nodes = [
    "91.98.122.165:8334",
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
