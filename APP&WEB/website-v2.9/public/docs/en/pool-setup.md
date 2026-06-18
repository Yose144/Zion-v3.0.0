# Pool Setup — ZION

How to run your own ZION mining pool.

---

## Architecture

```text
Miners -> [Stratum :3333] -> zion-pool -> [RPC :8444] -> zion-core
                             |
                             v
                           Redis
                             |
                             v
                      Pool API (:8080)
```

---

## Quick start (Docker)

```bash
git clone https://github.com/Zion-TerraNova/2.9.6.git
cd 2.9.6/docker

docker compose -f docker-compose.testnet.yml up -d
```

The stack includes: `zion-core`, `zion-pool`, `zion-miner`, `zion-redis`.

---

## Manual setup

### 1. Start the node

```bash
./zion-core \
  --data-dir /data/zion \
  --rpc-port 8444 \
  --p2p-port 8334 \
  --network testnet \
  --peers "91.98.122.165:8334"
```

### 2. Start Redis

```bash
redis-server --port 6379
```

### 3. Start the pool

```bash
./zion-pool \
  --node http://127.0.0.1:8444 \
  --stratum-port 3333 \
  --api-port 8080 \
  --redis redis://127.0.0.1:6379
```

---

## Ports

| Service | Port | Purpose |
|---------|------|---------|
| Stratum | 3333 | Miner connections |
| Pool API | 8080 | Pool and miner statistics |
| RPC | 8444 | Pool-to-node communication |
| P2P | 8334 | Node network synchronization |

---

## Operational recommendations

- keep RPC private and bound to localhost,
- separate wallet and payout keys from the public host,
- monitor accept rate, orphan rate, and block-template latency,
- deploy Prometheus/Grafana and log rotation,
- regularly rehearse payout flow on testnet.

---

## Next steps

- [Mining Guide →](#mining-guide)
- [API Reference →](#api)
- [Advanced Setup →](#setup)

---

*ZION TerraNova pool setup guide*