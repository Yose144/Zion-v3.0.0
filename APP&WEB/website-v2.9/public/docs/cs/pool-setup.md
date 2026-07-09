# Pool Setup — ZION

Jak provozovat vlastní ZION mining pool.

---

## Architektura

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

## Rychlý start (Docker)

```bash
git clone https://github.com/Zion-TerraNova/2.9.6.git
cd 2.9.6/docker

docker compose -f docker-compose.testnet.yml up -d
```

Stack obsahuje: `zion-core`, `zion-pool`, `zion-miner`, `zion-redis`.

---

## Manuální setup

### 1. Spusť node

```bash
./zion-core \
  --data-dir /data/zion \
  --rpc-port 8444 \
  --p2p-port 8334 \
  --network testnet \
  --peers "seed.zionterranova.com:8334"
```

### 2. Spusť Redis

```bash
redis-server --port 6379
```

### 3. Spusť pool

```bash
./zion-pool \
  --node http://127.0.0.1:8444 \
  --stratum-port 3333 \
  --api-port 8080 \
  --redis redis://127.0.0.1:6379
```

---

## Porty

| Služba | Port | Účel |
|--------|------|------|
| Stratum | 3333 | Připojení minerů |
| Pool API | 8080 | Statistiky poolu a minerů |
| RPC | 8444 | Komunikace poolu s nodem |
| P2P | 8334 | Síťová synchronizace nodu |

---

## Doporučení pro provoz

- držet RPC neveřejné a bindovat ho na localhost,
- oddělit wallet a payout klíče od veřejného hostu,
- sledovat accept rate, orphan rate a latenci block template,
- nasadit Prometheus/Grafana a log rotaci,
- pravidelně testovat payout flow na testnetu.

---

## Další kroky

- [Mining Guide →](#mining-guide)
- [API Reference →](#api)
- [Advanced Setup →](#setup)

---

*ZION TerraNova pool setup guide*