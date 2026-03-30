# 🐳 ZION Docker Deployment - Dokumentace

## Obsah
1. [Přehled](#přehled)
2. [Služby](#služby)
3. [Quick Start](#quick-start)
4. [Konfigurace](#konfigurace)
5. [Volumes](#volumes)
6. [Networks](#networks)
7. [Health Checks](#health-checks)
8. [Troubleshooting](#troubleshooting)
9. [Produkční deployment](#produkční-deployment)

---

## Přehled

ZION využívá Docker Compose pro orchestraci všech služeb:

```
┌─────────────────────────────────────────────────────────────┐
│                    ZION DOCKER STACK                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │ Blockchain  │  │    Pool     │  │     API     │        │
│   │  :8545      │  │   :3333     │  │   :8001     │        │
│   │  :18081     │  │   :8080     │  │             │        │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│          │                │                │               │
│          └────────────────┼────────────────┘               │
│                           │                                │
│   ┌─────────────┐  ┌──────┴──────┐  ┌─────────────┐        │
│   │   Redis     │  │  zion-net   │  │ Prometheus  │        │
│   │   :6379     │  │  (bridge)   │  │   :9090     │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│   ┌─────────────┐                                          │
│   │  Grafana    │                                          │
│   │   :3000     │                                          │
│   └─────────────┘                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Služby

### 1. Blockchain (`zion-blockchain`)

ZION Blockchain Core v2.9.

| Parametr | Hodnota |
|----------|---------|
| Dockerfile | `docker/core-v2.9/Dockerfile` |
| Porty | 8545 (ETH RPC), 18081 (Monero RPC) |
| Volumes | `blockchain-data:/app/data` |
| Health check | 30s interval |

**Environment:**
```bash
PYTHONUNBUFFERED=1
PYTHONPATH=/app
LOG_LEVEL=INFO
NETWORK=mainnet
```

### 2. Pool (`zion-pool-v2.9`)

Mining Pool v2.9.

| Parametr | Hodnota |
|----------|---------|
| Dockerfile | `docker/pool-v2.9/Dockerfile` |
| Porty | 3333 (Stratum), 8080 (Stats) |
| Volumes | `pool-data:/app/data` |
| Depends on | blockchain (healthy) |

**Environment:**
```bash
BLOCKCHAIN_HOST=blockchain
BLOCKCHAIN_PORT=18081
POOL_PORT=3333
API_PORT=8080
```

### 3. Redis (`zion-redis`)

Cache a Pub/Sub messaging.

| Parametr | Hodnota |
|----------|---------|
| Image | `redis:7-alpine` |
| Port | 6379 |
| Volumes | `redis-data:/data` |

### 4. Prometheus (`zion-prometheus`)

Metriky a monitoring.

| Parametr | Hodnota |
|----------|---------|
| Image | `prom/prometheus:latest` |
| Port | 9090 |
| Retention | 30 dní |
| Config | `monitoring/prometheus.yml` |

### 5. Grafana (`zion-grafana`)

Dashboardy a vizualizace.

| Parametr | Hodnota |
|----------|---------|
| Image | `grafana/grafana:latest` |
| Port | 3000 |
| Admin user | admin |
| Admin pass | zion2025 |

### 6. API (`zion-api-v2.9`)

FastAPI REST gateway.

| Parametr | Hodnota |
|----------|---------|
| Dockerfile | `docker/api-v2.9/Dockerfile` |
| Port | 8001 |
| Depends on | blockchain, pool |

**Environment:**
```bash
ZION_API_HOST=0.0.0.0
ZION_API_PORT=8001
RPC_URL=http://blockchain:8545
POOL_HOST=pool
POOL_PORT=3333
```

---

## Quick Start

### Development

```bash
# Klonování repozitáře
git clone https://github.com/your-org/zion.git
cd zion

# Build a start všech služeb
docker compose build
docker compose up -d

# Sledování logů
docker compose logs -f

# Status služeb
docker compose ps
```

### Produkce

```bash
# Build s produkčním konfiguračním souborem
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start v pozadí
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Scaling pool (více instancí)
docker compose up -d --scale pool=3
```

---

## Konfigurace

### docker-compose.override.yml (local dev)

```yaml
version: '3.8'

services:
  blockchain:
    build:
      context: .
      args:
        - DEBUG=1
    ports:
      - "8545:8545"
      - "18081:18081"
    environment:
      - LOG_LEVEL=DEBUG

  pool:
    environment:
      - LOG_LEVEL=DEBUG
      - SKIP_RPC_INIT=true  # Dev mode bez blockchain
```

### docker-compose.prod.yml

```yaml
version: '3.8'

services:
  blockchain:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G

  pool:
    restart: always
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 4G

  api:
    restart: always
    environment:
      - ZION_ENV=production
```

### .env soubor

```bash
# .env
COMPOSE_PROJECT_NAME=zion
LOG_LEVEL=INFO

# Blockchain
NETWORK=mainnet
RPC_PORT=18081

# Pool
POOL_PORT=3333
POOL_DIFFICULTY=1000

# Grafana
GF_SECURITY_ADMIN_PASSWORD=your_secure_password

# API
ZION_API_PORT=8001
```

---

## Volumes

### Přehled

| Volume | Služba | Popis |
|--------|--------|-------|
| `blockchain-data` | blockchain | Blockchain databáze |
| `pool-data` | pool | Pool databáze a logy |
| `redis-data` | redis | Redis persistence |
| `prometheus-data` | prometheus | Metriky (30 dní) |
| `grafana-data` | grafana | Dashboardy, uživatelé |

### Správa volumes

```bash
# Seznam volumes
docker volume ls | grep zion

# Inspekce volume
docker volume inspect zion_blockchain-data

# Backup volume
docker run --rm -v zion_blockchain-data:/data -v $(pwd)/backup:/backup \
  alpine tar czf /backup/blockchain-backup.tar.gz -C /data .

# Restore volume
docker run --rm -v zion_blockchain-data:/data -v $(pwd)/backup:/backup \
  alpine tar xzf /backup/blockchain-backup.tar.gz -C /data

# Smazání volume (POZOR!)
docker volume rm zion_blockchain-data
```

### Bind mounts (konfigurační soubory)

```yaml
volumes:
  # Read-only konfigurace
  - ./config/pool_production.json:/app/config/pool_production.json:ro
  - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
  
  # Logy (read-write)
  - ./logs/blockchain:/app/logs
  - ./logs/pool:/app/logs
```

---

## Networks

### Default network

```yaml
networks:
  zion-network:
    driver: bridge
```

### Custom network s IPAM

```yaml
networks:
  zion-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
          gateway: 172.28.0.1
```

### Service discovery

Uvnitř sítě se služby oslovují jménem:

```python
# Python
blockchain_url = "http://blockchain:18081"
redis_url = "redis://redis:6379"
pool_url = "http://pool:3333"
```

```bash
# Shell (uvnitř kontejneru)
curl http://blockchain:18081/json_rpc
redis-cli -h redis ping
```

---

## Health Checks

### Blockchain

```yaml
healthcheck:
  test: ["CMD", "pgrep", "-f", "src.core.new_zion_blockchain"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 60s
```

### Pool

```yaml
healthcheck:
  test: ["CMD", "pgrep", "-f", "src.pool.zion_pool_v2_9"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 60s
```

### Redis

```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 5s
  retries: 3
```

### API

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 60s
```

### Sledování zdraví

```bash
# Status všech služeb
docker compose ps

# Detailní health status
docker inspect --format='{{json .State.Health}}' zion-blockchain | jq

# Čekání na healthy stav
docker compose up -d --wait
```

---

## Troubleshooting

### Služba nestaruje

```bash
# Zkontrolovat logy
docker compose logs blockchain | tail -50

# Zkontrolovat exit code
docker inspect --format='{{.State.ExitCode}}' zion-blockchain

# Interaktivní debug
docker compose run --rm blockchain bash
```

### Pool se nepřipojí k blockchain

```bash
# Ověřit síťovou komunikaci
docker exec zion-pool-v2.9 ping blockchain

# Test RPC
docker exec zion-pool-v2.9 curl http://blockchain:18081/json_rpc \
  -d '{"jsonrpc":"2.0","method":"getinfo"}'

# Zkontrolovat environment
docker exec zion-pool-v2.9 env | grep BLOCKCHAIN
```

### Redis problémy

```bash
# Test připojení
docker exec zion-redis redis-cli ping

# Memory usage
docker exec zion-redis redis-cli INFO memory

# Vyčištění cache
docker exec zion-redis redis-cli FLUSHALL
```

### Prometheus nescrapuje

```bash
# Zkontrolovat targets
curl http://localhost:9090/api/v1/targets | jq

# Zkontrolovat config
docker exec zion-prometheus cat /etc/prometheus/prometheus.yml
```

### Nedostatek místa

```bash
# Vyčistit nepoužívané Docker objekty
docker system prune -a --volumes

# Zkontrolovat velikost volumes
docker system df -v
```

---

## Produkční Deployment

### Checklist

- [ ] SSL/TLS terminace (nginx/traefik před API)
- [ ] Silná hesla (Grafana, případně Redis)
- [ ] Firewall pravidla
- [ ] Log rotation
- [ ] Monitoring alerting
- [ ] Backup strategie
- [ ] Resource limits

### Doporučená architektura

```
                    Internet
                        │
                   ┌────┴────┐
                   │  nginx  │  (SSL termination, load balancing)
                   │  :443   │
                   └────┬────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
    │   API   │   │   API   │   │  Static │
    │ :8001   │   │ :8002   │   │  :80    │
    └────┬────┘   └────┬────┘   └─────────┘
         │              │
         └──────┬───────┘
                │
         ┌──────┴──────┐
         │  Internal   │
         │   Network   │
         └──────┬──────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───┴───┐  ┌───┴───┐  ┌───┴───┐
│Blkchain│  │ Pool  │  │ Redis │
│:18081  │  │:3333  │  │:6379  │
└────────┘  └───────┘  └───────┘
```

### Docker Swarm deployment

```bash
# Inicializace Swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml -c docker-compose.prod.yml zion

# Scaling
docker service scale zion_pool=3

# Status
docker stack services zion
```

### Kubernetes (budoucnost)

Připraveno v `k8s/` složce:
- `k8s/deployment.yaml`
- `k8s/service.yaml`
- `k8s/ingress.yaml`
- `k8s/configmap.yaml`

---

## Užitečné příkazy

```bash
# Build jednotlivé služby
docker compose build blockchain
docker compose build pool

# Restart služby
docker compose restart pool

# Shell do kontejneru
docker exec -it zion-blockchain bash

# Sledování resource usage
docker stats

# Export logů
docker compose logs --no-color > logs/docker-$(date +%Y%m%d).log

# Aktualizace image
docker compose pull
docker compose up -d

# Úplný reset (POZOR - smaže data!)
docker compose down -v
docker system prune -a
docker compose up -d --build
```

---

**ZION Docker Stack v2.9** - Kontejnerizovaná budoucnost 🐳
