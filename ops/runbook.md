# ZION TerraNova — Operations Runbook

> Version: 1.1
> Last Updated: 20. dubna 2026
> Environment: MainNet single-host Prague runtime

Canonical live topology is the Prague primary host at `91.98.122.165`. Older Helsinki/USA/Singapore references elsewhere in the repository are historical audit evidence unless explicitly marked as active.

## Infrastructure Overview

| Server | IP | Location | Role | Status |
|--------|----|----------|------|--------|
| Zion2 | `91.98.122.165` | Prague / Hetzner | Core + Pool + Miner + Website + Monitoring + Bridge | Active source of truth |

### Network Ports

| Port | Service | Protocol |
|------|---------|----------|
| 8333 | P2P (MainNet) | TCP |
| 8443 | RPC (MainNet) | Raw TCP JSON-RPC |
| 3333 | Stratum (Mining Pool) | TCP |
| 8080 | Pool API / metrics | HTTP |
| 3000 | Website (Next.js) | HTTP |
| 9090 | Prometheus | HTTP |
| 3001 | Grafana | HTTP |
| 9100 | Node Exporter | HTTP |
| 9101 | Bridge metrics / health | HTTP |
| 9115 | Core metrics / health | HTTP |
| 9121 | Redis Exporter | HTTP |
| 6379 | Redis (internal) | TCP |

## SSH Access

```bash
ssh -i ~/.ssh/zion_hetzner_key root@91.98.122.165
```

## Docker Services

### List all services

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Service map

| Container | Image | Ports | Healthcheck |
|-----------|-------|-------|-------------|
| `zion-core` | `zion-core:v3-mainnet` | 8333, 8443, 9115 | `curl http://127.0.0.1:9115/health` |
| `zion-pool` | `zion-pool:v3-mainnet` | 3333, 8080 | `curl http://127.0.0.1:8080/health` |
| `zion-miner` | `zion-miner:v3-mainnet` | — | mining process |
| `zion-v3-bridge` | `zion-v3-bridge:latest` | 9101 | `curl http://127.0.0.1:9101/health` |
| `zion-redis` | `redis:7-alpine` | 6379 | `redis-cli ping` |
| `zion-website` | `zion-website:2.9.9` | 3000 | HTTP GET `/` |
| `zion-prometheus` | `prom/prometheus:v2.53.0` | 9090 | `wget http://127.0.0.1:9090/-/healthy` |
| `zion-grafana` | `grafana/grafana:11.1.0` | 3001 | `wget http://127.0.0.1:3000/api/health` |
| `zion-node-exporter` | `prom/node-exporter:v1.8.1` | 9100 | none |
| `zion-redis-exporter` | `oliver006/redis_exporter:v1.61.0` | 9121 | none |

## Common Operations

### View logs

```bash
docker logs -f zion-core
docker logs -f zion-pool
docker logs -f zion-website
docker logs --tail 100 zion-core
docker logs -f --timestamps zion-pool
```

### Restart a service

```bash
docker restart zion-core
docker restart zion-pool
docker restart zion-website
```

### Core stack restart

```bash
cd /opt/zion
docker compose --env-file .env -f docker/docker-compose.v3-mainnet.yml up -d --build core pool miner
```

### Check blockchain height

```bash
printf '%s\n' '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' | nc -w 2 127.0.0.1 8443 | jq '.result.chain_height'
```

### Check peer count

```bash
printf '%s\n' '{"jsonrpc":"2.0","method":"getPeerInfo","params":[],"id":1}' | nc -w 2 127.0.0.1 8443 | jq '.result.count'
```

### Check pool status

```bash
curl -s http://127.0.0.1:8080/health | jq .
curl -s http://127.0.0.1:8080/metrics | head -20
curl -s http://127.0.0.1:8080/stats | jq .
```

### Check bridge health

```bash
curl -s http://127.0.0.1:9101/health | jq .
curl -s http://127.0.0.1:9101/metrics | head -20
```

### Check Redis

```bash
docker exec zion-redis redis-cli -a "$REDIS_PASSWORD" INFO server | head -10
docker exec zion-redis redis-cli -a "$REDIS_PASSWORD" DBSIZE
```

### Check memory and disk

```bash
free -h
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}"
df -h /
docker system df
```

## Monitoring

- Prometheus: `http://server:9090`
- Grafana: `http://server:3001` or `https://zionterranova.com/grafana/`
- Core metrics: `http://127.0.0.1:9115/metrics`
- Bridge metrics: `http://127.0.0.1:9101/metrics`

### Public smoke checks

```bash
curl -s https://zionterranova.com/api/health | jq .
curl -s https://zionterranova.com/api/bridge/status | jq .
```

Expected current production result:

- `/api/health` returns `status: ok` with healthy RPC node and mining pool metadata.
- `/api/bridge/status` returns `online: true` and live bridge metrics fetched through the website proxy.

### Start monitoring stack

```bash
cd /opt/zion
docker compose -f docker/docker-compose.monitoring.yml up -d
```

## Incident Response

### Service down

```bash
docker restart <container-name>
docker logs --tail 50 <container-name>
```

### Node out of sync or stalled

```bash
printf '%s\n' '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' | nc -w 2 127.0.0.1 8443 | jq '.result | {height: .chain_height, tip_hash: .tip_hash}'
printf '%s\n' '{"jsonrpc":"2.0","method":"getPeerInfo","params":[],"id":1}' | nc -w 2 127.0.0.1 8443 | jq '.result | {peers: .count}'
docker restart zion-core
sleep 30
printf '%s\n' '{"jsonrpc":"2.0","method":"getPeerInfo","params":[],"id":1}' | nc -w 2 127.0.0.1 8443 | jq '.result.count'
```

### Fork or divergence suspected

```bash
HEIGHT=$(printf '%s\n' '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' | nc -w 2 127.0.0.1 8443 | jq '.result.chain_height')
TIP=$(printf '%s\n' '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' | nc -w 2 127.0.0.1 8443 | jq -r '.result.tip_hash')
echo "Zion2: $HEIGHT / $TIP"
docker logs --tail 100 zion-core | grep -i "reorg\|fork\|stronger"
```

### Server unreachable

1. Check Hetzner Cloud Console for server status.
2. Perform hard reboot via Hetzner Console.
3. SSH back in and inspect Docker services.
4. Verify RPC, pool, website, and metrics endpoints.

### Pool Redis down

```bash
docker restart zion-redis
sleep 5
docker exec zion-redis redis-cli -a "$REDIS_PASSWORD" ping
docker restart zion-pool
```

## Backup And Recovery

### Chain state and volumes

```bash
docker stop zion-core
docker volume inspect zion-data
docker start zion-core
```

### Website and monitoring config

Keep `/opt/zion/.env`, `docker/`, `monitoring/`, and `ops/` backed up together. Current runtime correctness depends on compose wiring, not just the binaries.