# 🛠️ ZION TerraNova — Operations Runbook

> **Version:** 1.0  
> **Last Updated:** 11. března 2026  
> **Environment:** TestNet (transition to MainNet planned 31.12.2026)

> **Archival note:** This docs copy is retained for historical context. The canonical operational source is `ops/runbook.md`, and the current live topology is the single-host Zion2 model on `91.98.122.165`.

---

## 📋 Table of Contents

1. [Infrastructure Overview](#infrastructure-overview)
2. [SSH Access](#ssh-access)
3. [Docker Services](#docker-services)
4. [Common Operations](#common-operations)
5. [Monitoring](#monitoring)
6. [Incident Response](#incident-response)
7. [Backup & Recovery](#backup--recovery)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

---

## Infrastructure Overview

| Server | IP | Location | Role | Specs |
|--------|-----|----------|------|-------|
| **Zion2** | `91.98.122.165` | current primary host | Core + Pool + Web + Redis | production VM |

### Network Ports

| Port | Service | Protocol |
|------|---------|----------|
| 8334 | P2P (TestNet) | TCP |
| 8333 | P2P (MainNet) | TCP |
| 8444 | RPC (TestNet) | HTTP |
| 8443 | RPC (MainNet) | HTTP |
| 3333 | Stratum (Mining Pool) | TCP |
| 8080 | Pool REST API | HTTP |
| 3000 | Website (Next.js) | HTTP |
| 9090 | Prometheus | HTTP |
| 3001 | Grafana | HTTP |
| 9100 | Node Exporter | HTTP |
| 9121 | Redis Exporter | HTTP |
| 6379 | Redis (internal) | TCP |

---

## SSH Access

```bash
# Current primary server
ssh -i ~/.ssh/zion_hetzner_key root@91.98.122.165
```

### SSH between servers

Aktuálně nepoužívat. Infrastruktura je dočasně konsolidovaná na jeden host.

---

## Docker Services

### List all services
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Service map

| Container | Image | Ports | Healthcheck |
|-----------|-------|-------|-------------|
| `zion-core` | `zion-core:2.9.8` | 8334, 8444 | `curl http://localhost:8444/stats` |
| `zion-pool` | `zion-pool:2.9.8` | 3333, 8080 | `curl http://localhost:8080/health` |
| `zion-miner` | `zion-miner:2.9.8` | — | CPU mining process |
| `zion-seed-1` | `zion-core:2.9.8` | — | internal seed role |
| `zion-seed-2` | `zion-core:2.9.8` | — | internal seed role |
| `zion-redis` | `redis:7-alpine` | 6379 | `redis-cli ping` |
| `zion-website` | `zion-website:2.9.6` | 3000 | HTTP GET / |
| `zion-prometheus` | `prom/prometheus:v2.53.0` | 9090 | `wget http://localhost:9090/-/healthy` |
| `zion-grafana` | `grafana/grafana:11.1.0` | 3001 | `wget http://localhost:3000/api/health` |
| `zion-node-exporter` | `prom/node-exporter:v1.8.1` | 9100 | — |
| `zion-redis-exporter` | `oliver006/redis_exporter:v1.61.0` | 9121 | — |

---

## Common Operations

### View logs
```bash
# Real-time logs
docker logs -f zion-core
docker logs -f zion-pool
docker logs -f zion-website

# Last 100 lines
docker logs --tail 100 zion-core

# With timestamps
docker logs -f --timestamps zion-pool
```

### Restart a service
```bash
docker restart zion-core
docker restart zion-pool
docker restart zion-website
```

### Full stack restart
```bash
cd /root/zion-2.9.6
docker compose -f docker/docker-compose.testnet.yml --env-file .env down
docker compose -f docker/docker-compose.testnet.yml --env-file .env up -d
```

### Check blockchain height
```bash
curl -s http://localhost:8444/stats | jq '.block_height'
```

### Check pool status
```bash
curl -s http://localhost:8080/health | jq .
curl -s http://localhost:8080/metrics | head -20
```

### Check peer count
```bash
curl -s http://localhost:8444/stats | jq '.peer_count'
```

### Check Redis
```bash
docker exec zion-redis redis-cli -a zion_testnet_2026 INFO server | head -10
docker exec zion-redis redis-cli -a zion_testnet_2026 DBSIZE
```

### Check memory usage
```bash
free -h
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}"
```

### Check disk usage
```bash
df -h /
docker system df
```

---

## Monitoring

### Prometheus
- URL: `http://server:9090`
- Config: `/root/zion-2.9.6/monitoring/prometheus/prometheus.yml`
- Rules: `/root/zion-2.9.6/monitoring/prometheus/rules/alerts.yml`
- Data: Docker volume `zion-prometheus-data`

### Grafana
- URL: `http://server:3001` or `https://zionterranova.com/grafana/`
- Login: `admin` / `ZionTerra2026!`
- Anonymous viewer: enabled
- Dashboards:
  - **ZION Pool Overview** — hashrate, shares, blocks, per-miner metrics
  - **ZION Infrastructure** — CPU, RAM, disk, network

### Key metrics to watch

| Metric | Normal Range | Alert Threshold |
|--------|-------------|-----------------|
| CPU usage | < 50% | > 90% for 10m |
| Memory usage | < 70% | > 90% for 10m |
| Disk usage | < 70% | > 85% |
| Peer count | 3-10 | < 3 |
| Pool connections | 1+ | 0 for 5m |
| Share reject rate | < 5% | > 15% |
| Block template freshness | Updated every block | Stale > 10m |

### Start monitoring stack
```bash
cd /root/zion-2.9.6
docker compose -f docker/docker-compose.monitoring.yml up -d
```

---

## Incident Response

### Level 1 — Service Down

**Symptom:** One container stopped  
**Action:**
```bash
docker restart <container-name>
docker logs --tail 50 <container-name>
```

### Level 2 — Node Out of Sync

**Symptom:** Block height not increasing, peers = 0  
**Action:**
```bash
# Check peers
curl -s http://localhost:8444/stats | jq '{height: .block_height, peers: .peer_count}'

# Force reconnect
docker restart zion-core
sleep 30
curl -s http://localhost:8444/stats | jq '.peer_count'
```

### Level 3 — Fork Detected

**Symptom:** Different block heights / hashes between containers or against an external observer  
**Action:**
```bash
# Check current public host
PRIMARY=$(curl -s http://91.98.122.165:8444/stats | jq '.block_height')
echo "Primary: $PRIMARY"

# If diverged > 10 blocks, verify compose state and restart core/pool cleanly
# Monitor logs for reorg activity:
docker logs --tail 100 zion-core | grep -i "reorg\|fork\|stronger"
```

### Level 4 — Server Unreachable

**Symptom:** Cannot SSH, server down  
**Action:**
1. Check Hetzner Cloud Console for server status
2. Perform hard reboot via Hetzner Console
3. SSH in after reboot, check Docker services
4. Verify chain sync

### Level 5 — Pool Redis Down

**Symptom:** `redis_up = 0`, pool not accepting shares  
**Action:**
```bash
docker restart zion-redis
sleep 5
docker exec zion-redis redis-cli -a zion_testnet_2026 ping
docker restart zion-pool
```

---

## Backup & Recovery

### LMDB Database (Blockchain Data)

**Location:** Inside `zion-core` container at `/data/`  
**Backup:**
```bash
# Stop core node first (to ensure consistency)
docker stop zion-core

# Copy LMDB data
docker cp zion-core:/data/blockchain.lmdb /opt/zion/backups/blockchain-$(date +%Y%m%d).lmdb

# Restart
docker start zion-core
```

### Redis Data

**Backup:**
```bash
# Trigger Redis save
docker exec zion-redis redis-cli -a zion_testnet_2026 BGSAVE

# Copy dump
docker cp zion-redis:/data/dump.rdb /opt/zion/backups/redis-$(date +%Y%m%d).rdb
```

### Configuration Backup
```bash
# Backup all configs
tar czf /opt/zion/backups/config-$(date +%Y%m%d).tar.gz \
  /opt/zion/config/ \
  /opt/zion/docker/ \
  /opt/zion/monitoring/
```

### Recovery from Backup
```bash
# 1. Stop services
docker compose -f docker/docker-compose.testnet.yml down

# 2. Restore LMDB
docker cp /opt/zion/backups/blockchain-YYYYMMDD.lmdb zion-core:/data/blockchain.lmdb

# 3. Restore Redis
docker cp /opt/zion/backups/redis-YYYYMMDD.rdb zion-redis:/data/dump.rdb

# 4. Restart services
docker compose -f docker/docker-compose.testnet.yml up -d
```

---

## Deployment

### Website (Next.js)
```bash
# From local machine:
rsync -avz --delete \
  -e "ssh -i ~/.ssh/zion_hetzner_key" \
  APP\&WEB/website-v2.9/ root@91.98.122.165:/root/zion-web-deploy/website-v2.9/ \
  --exclude node_modules --exclude .next --exclude .git

# On server — rebuild:
ssh -i ~/.ssh/zion_hetzner_key root@91.98.122.165
mkdir -p /root/zion-web-deploy/docker
cd /root/zion-web-deploy
docker network create zion-net 2>/dev/null || true
docker compose -f docker/docker-compose.website.yml build website
docker rm -f zion-website || true
docker compose -f docker/docker-compose.website.yml up -d website
```

### Pool (Rust)
```bash
# On server:
cd /root/zion-2.9.5
docker build --no-cache -f Dockerfile.pool -t zion-pool:2.9.5-testnet .
docker stop zion-pool && docker rm zion-pool
# Use docker-compose to restart with correct env:
docker compose -f docker/docker-compose.testnet.yml up -d zion-pool
```

### Core Node (Rust)
```bash
cd /root/zion-2.9.5
docker build --no-cache -f Dockerfile.core -t zion-core:2.9.5-testnet .
docker compose -f docker/docker-compose.testnet.yml up -d zion-core
```

### Monitoring Stack
```bash
# From local machine:
./scripts/deploy-monitoring.sh helsinki   # or germany or all
```

---

## Troubleshooting

### Docker build fails — out of memory
```bash
# Check available memory
free -h

# Clean Docker cache
docker system prune -a --volumes
docker builder prune -a

# Build with memory limit
docker build --memory=4g -t zion-web:latest .
```

### Website build hangs (ARM64 / swap)
```bash
# Check if swap is active
swapon --show

# Create swap if needed
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Build in background screen
screen -dmS web-build bash -c 'cd /opt/zion/website-v2.9 && docker build -t zion-web:latest . > /tmp/web-build.log 2>&1; echo DONE >> /tmp/web-build.log'
tail -f /tmp/web-build.log
```

### Pool "Job not found" (Error 21)
This was fixed in the stratum server. If it reoccurs:
```bash
docker logs --tail 50 zion-pool | grep "Job not found"
# Restart pool
docker restart zion-pool
```

### Redis connection refused
```bash
# Check if Redis is running
docker ps | grep redis

# Check Redis password
docker exec zion-redis redis-cli -a zion_testnet_2026 ping

# Restart Redis and pool
docker restart zion-redis
sleep 3
docker restart zion-pool
```

### Nginx 502 Bad Gateway
```bash
# Check if upstream service is running
docker ps | grep zion-web
curl -s http://localhost:3000/ | head -5

# Check Nginx config
nginx -t
systemctl reload nginx
```

### Revenue blockers (Helsinki + SeedDE) — 23.02.2026

#### 1) DERO: `unregistered miner or you need to wait 15 mins`
```bash
# Check logs on both servers
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72  'docker logs --tail 80 zion-dero-miner | tail -30'
ssh -i ~/.ssh/zion_hetzner_key root@46.225.126.243 'docker logs --tail 80 zion-dero-miner | tail -30'

# Verify wallet value in env on server
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72  'grep -n "^DERO_WALLET=" /root/revenue-stack/.env.revenue'
ssh -i ~/.ssh/zion_hetzner_key root@46.225.126.243 'grep -n "^DERO_WALLET=" /root/revenue-stack/.env.revenue'

# Action: wait 15+ min after registration/first connect, then recheck logs.
```

#### 2) EPIC: `connect error: operation canceled` (`fastepic.eu:3416`)
```bash
# DNS + TCP check from SeedDE
ssh -i ~/.ssh/zion_hetzner_key root@46.225.126.243 'getent hosts fastepic.eu || true; timeout 8 bash -lc "cat < /dev/null > /dev/tcp/fastepic.eu/3416" && echo epic-port-open || echo epic-port-fail'

# Runtime logs
ssh -i ~/.ssh/zion_hetzner_key root@46.225.126.243 'docker logs --tail 120 zion-epic-miner | tail -40'

# If unreachable persists: switch to alternate EPIC pool endpoint in docker-compose.revenue.yml,
# redeploy only epic service:
# COMPOSE_PROFILES=germany docker compose --env-file .env.revenue -f docker-compose.revenue.yml up -d --force-recreate epic-miner
```

#### 3) NKN wallet init flow (currently disabled)
```bash
# One-time wallet creation in isolated test (no compose)
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 'docker run --rm -v /opt/nkn/data:/nkn/data nknorg/nkn:latest nknd -c --password-file /nkn/data/wallet.pswd --wallet /nkn/data/wallet.json --no-nat'

# Then enable nkn service in revenue compose and start only nkn:
# docker compose --env-file .env.revenue -f docker-compose.revenue.yml up -d nkn
```

---

## Contacts & Escalation

| Role | Contact |
|------|---------|
| Infrastructure | GitHub Issues |
| Community | Discord: discord.gg/zion-terranova |
| Source Code | github.com/Yose144/Zion-2.9.5 |

---

*🌟 ZION TerraNova — "Keep the nodes running, keep the chain alive."*
