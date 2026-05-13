# ZION TerraNova — Operational Server Topology

> **Datum:** květen 2026
> **Provozní server:** Prague Hetzner (91.98.122.165)
> **Účel:** Dokumentace kontejnerové topologie, portů, závislostí a deploymentu pro multi-server mainnet

---

## Přehled

Tento dokument popisuje aktuální provozní topologii ZION V3 na Praha serveru. Slouží jako blueprint pro nasazení identické konfigurace na nové servery (USA, Singapore, Helsinki) před mainnet Genesis #0.

---

## Docker Networky

| Síť | Driver | Popis |
|-----|--------|-------|
| `zion-net` | bridge | Hlavní interní síť pro všechny služby (bridge) |
| `zion-v3`  | bridge | Izolovaná síť pro node-seed peerování (interní P2P) |

---

## Kompletní Portová Mapa

### Externí Porty (zvenčí dostupné)

| Port | Protokol | Služba | Kontejner | Popis |
|------|----------|--------|-----------|-------|
| **3000** | TCP HTTP | Next.js website | `zion-website` | Web frontend + API routes |
| **3333** | TCP | Stratum Pool | `zion-pool` | Miner TCP pool (Stratum v2) |
| **8080** | TCP HTTP | Pool API | `zion-pool` | Pool stats / REST API |
| **8001** | TCP HTTP | AI Native | `zion-ai-native` | Hiran inference API |
| **8335** | TCP | P2P Node | `zion-v3-node` | Externí P2P port (mapováno z 8333) |
| **8448** | TCP | WebSocket | `zion-v3-node` | Node WebSocket feed (mapováno z 8445) |
| **9090** | TCP HTTP | Prometheus | `zion-prometheus` | Metrics scraping |
| **9093** | TCP HTTP | Alertmanager | `zion-alertmanager` | Alerting UI |
| **3001** | TCP HTTP | Grafana | `zion-grafana` | Dashboards (mapováno z 3000→3001) |
| **9100** | TCP HTTP | Node Exporter | `zion-node-exporter` | System metrics |
| **9101** | TCP HTTP | Bridge Metrics | `zion-v3-bridge` | Prometheus bridge metrics (host network) |
| **9121** | TCP HTTP | Redis Exporter | `zion-redis-exporter` | Redis metrics |

### Interní Porty (pouze v `zion-net`)

| Port | Protokol | Služba | Kontejner | Popis |
|------|----------|--------|-----------|-------|
| **8333** | TCP | P2P | `zion-v3-node` | Interní P2P mesh |
| **8443** | TCP | JSON-RPC | `zion-v3-node` | Node RPC API |
| **8445** | TCP | WebSocket | `zion-v3-node` | WS feed (nové bloky, mempool) |
| **6379** | TCP | Redis | `zion-redis` | Cache / pub-sub |
| **9116** | TCP HTTP | Miner Metrics | `zion-miner` | Interní miner telemetry |

### Lokální Porty (host-only)

| Port | Mapování | Popis |
|------|----------|-------|
| **8447** | `127.0.0.1:8447` → `zion-v3-node:8443` | Lokální RPC pro host-only nástroje |

---

## Kontejnerové Topologie

### Závislostní Graf

```
┌─────────────────────────────────────────────────────────────────────┐
│                         zion-net (bridge)                            │
│                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐   │
│  │ zion-v3-node│◄────│ zion-pool   │◄────│   zion-miner        │   │
│  │  172.18.0.9 │ RPC │  172.18.0.3 │Stratum│ 172.18.0.?        │   │
│  │ :8443 (RPC) │     │ :3333/:8080 │     │ :9116 (metrics)     │   │
│  └──────┬──────┘     └──────┬──────┘     └─────────────────────┘   │
│         │                   │                                       │
│  :8333  │ P2P             │ HTTP API                              │
│         │                   │                                       │
│  ┌──────▼──────┐     ┌──────▼──────┐     ┌─────────────────────┐   │
│  │ zion-seed-1 │     │ zion-website│     │   zion-ai-native    │   │
│  │ 172.18.0.5  │     │ 172.18.0.8  │     │   172.18.0.13       │   │
│  │ :8333/:8443 │     │ :3000       │     │   :8001             │   │
│  └─────────────┘     └─────────────┘     └─────────────────────┘   │
│                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐   │
│  │ zion-redis  │     │ zion-promet │     │   zion-grafana      │   │
│  │ 172.18.0.2  │     │ 172.18.0.6  │     │   172.18.0.12       │   │
│  │ :6379       │     │ :9090       │     │   :3000→3001        │   │
│  └─────────────┘     └─────────────┘     └─────────────────────┘   │
│                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐   │
│  │ zion-alert  │     │ zion-redis- │     │   zion-node-exp     │   │
│  │ 172.18.0.11 │     │ 172.18.0.10 │     │   172.18.0.7        │   │
│  │ :9093       │     │ :9121       │     │   :9100             │   │
│  └─────────────┘     └─────────────┘     └─────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ zion-v3-bridge  (host network)                              │   │
│  │  9101 (Prometheus metrics, host-only)                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Docker Run Příkazy (Production)

### 1. Node (`zion-v3-node`)

```bash
docker run -d \
  --name zion-v3-node \
  --network zion-net \
  -p 8335:8333 \
  -p 8447:8443 \
  -p 8448:8445 \
  -e ZION_NODE_ID=v3-mainnet-primary \
  -e ZION_P2P_BIND=0.0.0.0:8333 \
  -e ZION_RPC_BIND=0.0.0.0:8443 \
  -e ZION_WEBSOCKET_BIND=0.0.0.0:8445 \
  -e ZION_NODE_STATE_PATH=/data/zion/state \
  -e ZION_SEED_PEERS="<peer1>:8333,<peer2>:8333" \
  -e ZION_HUMANITARIAN_WALLET=zion1m4v5z8z850u480c5c208z274e334369275n5y20 \
  -e ZION_ISSOBELLA_WALLET=zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702 \
  -e ZION_POOL_FEE_WALLET=zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5 \
  -e ZION_MINER_ADDRESS=zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3 \
  --restart unless-stopped \
  zion-core:v3-mainnet
```

**⚠️ DŮLEŽITÉ:** Po startu musíš připojit node do `zion-net`:
```bash
docker network connect zion-net zion-v3-node
```
(Pokud node startuje s `--network zion-net`, není třeba. Ale pokud používáš existující docker-compose, ověř přítomnost v síti.)

### 2. Seed Node (`zion-seed-1`)

```bash
docker run -d \
  --name zion-seed-1 \
  --network zion-net \
  -e ZION_NODE_ID=v3-seed-1 \
  -e ZION_P2P_BIND=0.0.0.0:8333 \
  -e ZION_RPC_BIND=0.0.0.0:8443 \
  -e ZION_SEED_PEERS=zion-v3-node:8333 \
  -e ZION_NETWORK=mainnet \
  -e ZION_DATA_DIR=/data/zion \
  --restart unless-stopped \
  zion-core:v3-mainnet
```

### 3. Pool (`zion-pool`)

```bash
docker run -d \
  --name zion-pool \
  --network zion-net \
  -p 3333:3333 \
  -p 8080:8080 \
  -e ZION_POOL_BIND=0.0.0.0:3333 \
  -e ZION_NODE_RPC_ADDR=zion-v3-node:8443 \
  -e ZION_POOL_WALLET=zion1n7n5t28663h3f3d8s8y596h5f3z582z8638d073 \
  -e ZION_POOL_PAYOUT_SK_HEX="<hex>" \
  -e ZION_POOL_PAYOUT_FEE_FLOWERS=10000 \
  -e ZION_POOL_FEE_PCT=0 \
  --restart unless-stopped \
  zion-pool:v3-mainnet
```

**⚠️ DNS závislost:** Pool MUSÍ vidět node jako `zion-v3-node:8443`.

### 4. Miner (`zion-miner`)

```bash
docker run -d \
  --name zion-miner \
  --network zion-net \
  -e ZION_POOL_ADDR=zion-pool:3333 \
  -e ZION_WORKER_NAME=mainnet-miner \
  -e ZION_MINER_ID=zion1n7n5t28663h3f3d8s8y596h5f3z582z8638d073 \
  -e ZION_LOOP_COUNT=4294967295 \
  -e ZION_NONCE_COUNT=100000 \
  -e ZION_MINER_VERBOSE=1 \
  -e ZION_RECONNECT=true \
  -e ZION_MAX_RECONNECT=0 \
  -e ZION_READ_TIMEOUT_SECS=1200 \
  --restart unless-stopped \
  zion-miner:v3-mainnet
```

**⚠️ DNS závislost:** Miner MUSÍ vidět pool jako `zion-pool:3333`.

### 5. Website (`zion-website`)

```bash
docker run -d \
  --name zion-website \
  --network zion-net \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e ZION_NETWORK_NODES_JSON='[{"id":"prague-local","name":"Prague (Docker)","host":"zion-v3-node","region":"EU","lat":50.08,"lon":14.44,"ports":{"p2p":8333,"rpc":8443,"stratum":3333,"pool_api":8080},"poolApiUrl":"http://zion-pool:8080"}]' \
  --restart unless-stopped \
  zion-website:2.9.10
```

**⚠️ DNS závislost:** Web MUSÍ vidět node jako `zion-v3-node:8443` a pool jako `zion-pool:8080`.

### 6. Bridge (`zion-v3-bridge`)

```bash
docker run -d \
  --name zion-v3-bridge \
  --network host \
  -e ZION_BRIDGE_CONFIG=/etc/zion/bridge-mainnet.toml \
  -e RUST_LOG=zion_bridge=debug,info \
  --restart unless-stopped \
  zion-v3-bridge:latest
```

**⚠️ Bridge běží v `host` network módu** — má přímý přístup k localhost:8443 a host networking.

### 7. AI Native (`zion-ai-native`)

```bash
docker run -d \
  --name zion-ai-native \
  --network zion-net \
  -p 8001:8001 \
  -e HIRANYAGARBHA_BIND=0.0.0.0:8001 \
  -e RUST_LOG=info \
  --restart unless-stopped \
  zion-ai-native:v3-mainnet
```

### 8. Monitoring Stack

```bash
# Redis
docker run -d \
  --name zion-redis \
  --network zion-net \
  --restart unless-stopped \
  redis:7-alpine

# Prometheus
docker run -d \
  --name zion-prometheus \
  --network zion-net \
  -p 9090:9090 \
  --restart unless-stopped \
  prom/prometheus:v2.53.0

# Grafana
docker run -d \
  --name zion-grafana \
  --network zion-net \
  -p 3001:3000 \
  --restart unless-stopped \
  grafana/grafana:11.1.0

# Alertmanager
docker run -d \
  --name zion-alertmanager \
  --network zion-net \
  -p 9093:9093 \
  --restart unless-stopped \
  prom/alertmanager:v0.27.0

# Exporters
docker run -d \
  --name zion-node-exporter \
  --network zion-net \
  -p 9100:9100 \
  --restart unless-stopped \
  prom/node-exporter:v1.8.1

docker run -d \
  --name zion-redis-exporter \
  --network zion-net \
  -p 9121:9121 \
  -e REDIS_ADDR=redis://zion-redis:6379 \
  --restart unless-stopped \
  oliver006/redis_exporter:v1.61.0
```

---

## Docker Image Registry / Build

| Image | Zdroj | Build |
|-------|-------|-------|
| `zion-core:v3-mainnet` | V3 workspace | `cargo build --release -p zion-core` |
| `zion-pool:v3-mainnet` | V3 workspace | `cargo build --release -p zion-pool` |
| `zion-miner:v3-mainnet` | V3 workspace | `cargo build --release -p zion-miner` |
| `zion-v3-bridge:latest` | V3 workspace | `cargo build --release -p zion-bridge` |
| `zion-website:2.9.10` | `APP&WEB/website-v2.9` | `docker build -t zion-website:2.9.10 .` |
| `zion-ai-native:v3-mainnet` | V3 workspace | `cargo build --release -p zion-ai-native` |

**Website build závislosti:**
- `zion-wallet-sdk-1.0.0.tgz` musí být v build contextu (zkopírován vedle `package.json`)
- Dockerfile musí obsahovat: `COPY zion-wallet-sdk-1.0.0.tgz ./` před `RUN npm install`

---

## Známé Problémy a Opravy (květen 2026)

### 1. DNS Mismatch — Pool → Node

**Příznak:** Pool přijímá miner `hello` ale neposílá `job`. Pool logy ukazují `wire_hello` ale žádné `wire_job`.

**Příčina:** Původní konfigurace měla `ZION_NODE_RPC_ADDR=core:8443`, ale kontejner se jmenuje `zion-v3-node`.

**Oprava:**
```bash
docker stop zion-pool
docker rm zion-pool
docker run ... -e ZION_NODE_RPC_ADDR=zion-v3-node:8443 ...
```

### 2. DNS Mismatch — Miner → Pool

**Příznak:** Miner se připojí, dostane `welcome`, ale pool zavře spojení. Miner se reconnectuje v nekonečné smyčce.

**Příčina:** Původní konfigurace měla `ZION_POOL_ADDR=pool:3333`, ale kontejner se jmenuje `zion-pool`.

**Oprava:**
```bash
docker stop zion-miner
docker rm zion-miner
docker run ... -e ZION_POOL_ADDR=zion-pool:3333 ...
```

### 3. Node není v zion-net

**Příznak:** Web API `/api/blockchain/stats` vrací 503. Node RPC není dostupné přes interní síť.

**Příčina:** `zion-v3-node` není připojen do `zion-net`. RPC je bindované jen na `127.0.0.1:8447` (host).

**Oprava:**
```bash
docker network connect zion-net zion-v3-node
```

### 4. Bridge — host network

**Poznámka:** Bridge běží v `--network host`, protože potřebuje přístup k localhost node RPC a externím EVM RPCs. Bridge metrics jsou na `localhost:9101`.

### 5. Website build — zion-wallet-sdk tarball

**Příznak:** Docker build failuje na `npm install` s `ENOENT: zion-wallet-sdk-1.0.0.tgz`.

**Příčina:** `package.json` reference `file:../zion-wallet-sdk/...` nefunguje v Docker build contextu (soubor je mimo context).

**Oprava:**
1. Zkopírovat `zion-wallet-sdk-1.0.0.tgz` do build contextu (`APP&WEB/website-v2.9/`)
2. Upravit `package.json`: `"zion-wallet-sdk": "file:./zion-wallet-sdk-1.0.0.tgz"`
3. Upravit Dockerfile:
   ```dockerfile
   COPY package*.json ./
   COPY zion-wallet-sdk-1.0.0.tgz ./
   RUN npm install
   ```

---

## Deployment Checklist pro Nový Server

### Krok 1: Infrastruktura
- [ ] Hetzner / jiný provider — Ubuntu 22.04 LTS
- [ ] SSH key `zion_hetzner_key` nebo ekvivalent
- [ ] Docker + Docker Compose nainstalováno
- [ ] UFW firewall — otevřít porty: 3000, 3333, 8080, 8001, 8335, 8448, 9090, 9093, 3001, 9100, 9101, 9121
- [ ] DNS záznam `zionterranova.com` → server IP

### Krok 2: Docker Síť
```bash
docker network create zion-net
docker network create zion-v3
```

### Krok 3: Images
```bash
# Build nebo pull
for img in zion-core:v3-mainnet zion-pool:v3-mainnet zion-miner:v3-mainnet \
           zion-v3-bridge:latest zion-ai-native:v3-mainnet; do
  docker pull ghcr.io/zion-terranova/$img || echo "build locally"
done

# Website build (z lokálního repa)
cd /tmp/zion-web
docker build -t zion-website:2.9.10 .
```

### Krok 4: Start v pořadí závislostí
1. `zion-v3-node` (základ)
2. `zion-seed-1` (peer)
3. `zion-pool` (závisí na node RPC)
4. `zion-miner` (závisí na pool)
5. `zion-redis` (cache)
6. `zion-website` (závisí na node + pool)
7. `zion-v3-bridge` (závisí na node)
8. `zion-ai-native` (závisí na docs)
9. Monitoring stack (prometheus, grafana, alertmanager, exporters)

### Krok 5: Ověření
```bash
# Všechny kontejnery běží
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

# API health
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/network
curl -s http://localhost:3000/api/blockchain/stats

# Mining handshake
printf '{"type":"hello","miner_id":"test","worker_name":"test","algorithm":"cosmic_harmony_ekam_deeksha_v2"}\n' | nc -w 3 localhost 3333

# Pool stats
curl -s http://localhost:8080/stats | head -c 200

# Bridge metrics
curl -s http://localhost:9101/metrics | head -5

# Prometheus scrape
curl -s http://localhost:9090/api/v1/status/targets | head -c 100
```

---

## Server Role Map (Future Multi-Host)

| Server | Role | Porty navíc | Poznámka |
|--------|------|-------------|----------|
| **Prague (EU)** | Core + Pool + Web + Bridge + AI | — | Hlavní, běží všechno |
| **USA (Hillsboro)** | Core + Pool | 3333, 8080 | Miner pool pro US region |
| **Singapore (APAC)** | Core + Pool | 3333, 8080 | Miner pool pro APAC region |
| **Helsinki (Backup)** | Core + Seed | 8335 | Backup seed node |

### Multi-Host DNS / Seed Peers

```
Prague:  ZION_SEED_PEERS="usa:8333,singapore:8333,helsinki:8333"
USA:     ZION_SEED_PEERS="prague:8333,singapore:8333,helsinki:8333"
Singapore: ZION_SEED_PEERS="prague:8333,usa:8333,helsinki:8333"
Helsinki: ZION_SEED_PEERS="prague:8333,usa:8333,singapore:8333"
```

---

## Reference

- `V3/docker/docker-compose.yml` — Docker Compose definice
- `V3/docker/docker-compose.v3-mainnet.yml` — Mainnet profil
- `V3/docker/docker-compose.monitoring.yml` — Monitoring stack
- `APP&WEB/website-v2.9/Dockerfile` — Web build
- `V3/L2/bridge/config/bridge-mainnet.toml` — Bridge konfigurace

---

*Vygenerováno květen 2026 z aktuální provozní topologie Praha serveru (91.98.122.165).*
