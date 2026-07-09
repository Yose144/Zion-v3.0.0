# Pool Setup — ZION v2.9.5

Jak provozovat vlastní ZION mining pool.

---

## Architektura

```
Miners → [Stratum :3333] → zion-pool → [RPC :8444] → zion-core
                              ↓
                        Redis (shares)
                              ↓
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
  --peers "seed.zionterranova.com:8334,seed1.zionterranova.com:8334,seed2.zionterranova.com:8334,seed3.zionterranova.com:8334"
```

### 2. Spusť pool

```bash
./zion-pool \
  --node localhost:8444 \
  --stratum-port 3333 \
  --api-port 8080 \
  --wallet "zion1qPOOL_ADRESA" \
  --fee 1.0 \
  --min-payout 1000
```

### 3. Připoj minery

```bash
./zion-miner \
  --pool TVOJE_IP:3333 \
  --wallet "zion1qMINER_ADRESA" \
  --worker worker-1
```

---

## Pool konfigurace

| Parametr | Výchozí | Popis |
|----------|---------|-------|
| `--stratum-port` | 3333 | Port pro Stratum protokol |
| `--api-port` | 8080 | HTTP API pro statistiky |
| `--fee` | 1.0 | Pool poplatek (%) |
| `--min-payout` | 1000 | Min. výplata (ZION) |
| `--block-poll` | 500 | Polling interval (ms) |

---

## Systemd služba pro pool

```ini
[Unit]
Description=ZION Mining Pool
After=zion-core.service redis.service
Requires=zion-core.service

[Service]
Type=simple
User=zion
ExecStart=/opt/zion/zion-pool \
  --node localhost:8444 \
  --stratum-port 3333 \
  --api-port 8080
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## Pool API endpointy

```bash
# Statistiky poolu
curl http://localhost:8080/api/stats

# Statistiky minera
curl http://localhost:8080/api/miners/zion1qADRESA

# Posledních 10 bloků
curl http://localhost:8080/api/blocks?limit=10
```

---

## Monitoring

- Sleduj `zion-pool` logy pro accepted/rejected shares
- Kontroluj `zion-core` synchronizaci
- Redis: `redis-cli info keyspace` pro kontrolu dat

---

## Související

- [Mining průvodce →](#mining-guide) — jak těžit
- [Pokročilý Setup →](#setup) — systemd, firewall
- [API Reference →](#api) — RPC endpointy

---

*ZION TerraNova v2.9.5*
