# ZION TerraNova — Operational Server Topology

> **ARCHIVNÍ DOKUMENT — HISTORICKÁ TOPOLOGIE**
>
> **Datum:** květen 2026
> **Původní provozní server:** Prague Hetzner (91.98.122.165) — **VYŘAZEN**
> **Účel:** Historická dokumentace kontejnerové topologie z období před konsolidací na Core + Edge.
>
> **Aktuální živá topologie:** Core (Windows 11, Tailscale 100.86.102.5) + Edge (Hetzner VPS, Tailscale 100.76.16.108).
> Veškeré odkazy na Prahu / USA / Singapore / Helsinki v tomto dokumentu jsou archivní.

---

## Přehled

Tento dokument popisuje **historickou** provozní topologii ZION V3 na Praha serveru. Sloužil jako blueprint pro nasazení identické konfigurace na nové servery (USA, Singapore, Helsinki) před mainnet Genesis #0. Aktuální provoz je konsolidován na **Core + Edge** topologii.

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
  -e ZION_HUMANITARIAN_WALLET=zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4 \
  -e ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702 \
  -e ZION_POOL_FEE_WALLET=zion196m4n8x764v7a0s406j40094a8z5j8m6z7nk342 \
  -e ZION_MINER_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790 \
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
  -e ZION_NETWORK_NODES_JSON='[{"id":"edge-local","name":"Edge (Docker)","host":"zion-v3-node","region":"EU","lat":50.08,"lon":14.44,"ports":{"p2p":8333,"rpc":8443,"stratum":8444,"pool_api":8080},"poolApiUrl":"http://zion-pool:8080"}]' \
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

## Server Role Map (Historical Multi-Host — ARCHIVNÍ)

> Tato sekce popisuje plánovanou multi-server topologii z května 2026, která **nebyla realizována**. Aktuální provoz je **Core + Edge**.

| Server | Role | Porty navíc | Poznámka |
|--------|------|-------------|----------|
| **Prague (EU)** | Core + Pool + Web + Bridge + AI | — | Hlavní, běží všechno |
| **USA (Hillsboro)** | Core + Pool | 3333, 8080 | Miner pool pro US region |
| **Singapore (APAC)** | Core + Pool | 3333, 8080 | Miner pool pro APAC region |
| **Helsinki (Backup)** | Core + Seed | 8335 | Backup seed node |

### Multi-Host DNS / Seed Peers (historický plán)

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

## 🚀 MainNet Genesis #0 Launch Specifika

> **Zdroj:** `docs/mainnet/MAINNET_CHECKLIST.md`, `docs/mainnet/MAINNET_CONSTITUTION.md`, `V3/docs/MAINNET_DEPLOY_RUNBOOK.md`, `StatusV3.md`

### Klíčové zásady pro Genesis #0

| Zásada | Popis | Zdroj |
|--------|-------|-------|
| **Čistý datadir** | Každý nový server musí mít **prázdný** `/data/zion/` — žádný carry-over z testnetu | `StatusV3.md` §1.4 |
| **Nové SSH klíče** | Nepoužívat staré deployment klíče (`zion_hetzner_key` apod.) — rotovat před launch | `StatusV3.md` §1.4 |
| **Genesis offline** | Genesis blok se vytváří **OFFLINE** a pak se deployuje na seed nody | `PHASE_7_LAUNCH.md` |
| **TX_HASH_V2 + BODY_ROOT_V2** | Od genesis height **0** — aktivní ve všech build od května 2026 | `StatusV3.md` §2 |
| **Chain ID** | `zion-mainnet-1` (locked) | `MAINNET_CONSTITUTION.md` §1 |
| **Fee split 89/5/5/1** | Miner 89% / Humanitarian 5% / Issobella 5% / Pool 1% — on-chain enforced | `MAINNET_CHECKLIST.md` |
| **No presale** | ❌ NEEXISTUJE — fair launch only | `MAINNET_CONSTITUTION.md` §4 |
| **No admin key** | ❌ NEEXISTUJE — plně permissionless | `MAINNET_CONSTITUTION.md` §6 |

### Genesis Premine — 13 Wallets

> **16.78B ZION** vytvořeno v genesis bloku do 13 peněženek. **Privátní klíče musí být offline** (USB, trezor, papír).

| # | Účel | Adresa | Částka | Zamčeno? |
|---|------|--------|--------|----------|
| 1 | OASIS Golden Egg 1 | `zion166e6v3k204h8p5w4w3a7m0x790q5m7z5z6n252p` | 1.65B | NE |
| 2 | OASIS Golden Egg 2 | `zion1l2h8h0e3h7m6p8e297m6n624c5m7r2k364v684a` | 1.65B | NE |
| 3 | OASIS Golden Egg 3 | `zion1e6r0q3g6t0r0v5f6h7k7c5f3v562j0v7e5e5d0a` | 1.65B | NE |
| 4 | OASIS Golden Egg 4 | `zion1l7e4c4c5x8l440t295a7m4k5p5x8v8z7r043s23` | 1.65B | NE |
| 5 | OASIS Golden Egg 5 | `zion1n8h2a8p386z274859833h7v6c5n687f7a6k523u` | 1.65B | NE |
| 6 | DAO Treasury | `zion176u8r6w53768e2k04035d4d3c2z5g555n6l4r3s` | 2.50B | ANO — 1 rok |
| 7 | DAO Grants | `zion12643n776r3m8f340484756q06485h5w4c2l405m` | 1.00B | ANO — 1 rok |
| 8 | DAO Bootstrap | `zion1k8w734x422f3t6t536r287k2c6n3z0e05257606` | 500M | ANO — 1 rok |
| 9 | Core Dev Fund | `zion1q540v6y4f0s4v3n0f8t740t53494z56024u645c` | 1.00B | NE |
| 10 | Seed Nodes | `zion1h4w39686t8w376g0x0y426e775q6p2q0v698v43` | 1.00B | NE |
| 11 | Genesis Creator | `zion1x638z5x6d2d0y6u3f7y8g7j56054a4a2a2c7l8f` | 590M | NE |
| 12 | Children Future Fund | `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4` | 1.44B | NE |
|| 13 | Bridge Seed Fund | `zion1f6m2j0h0l773j4074324q5r528y475w4j7m9685` | 400M | NE |
| 14 | Bridge Vault UTXO Seed | `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0` | 100M | NE |

> **Soubor `PREMINE_WALLETS_BACKUP.json`** obsahuje privátní klíče. **Nikdy na serveru, vždy offline.** BFG scrub před zveřejněním repa.

### Node Runtime Env Variables (required for fee split)

Každý `zion-core` kontejner MUSÍ mít tyto env vars (live env inside container, ne jen v compose file):

```bash
ZION_MINER_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790
ZION_HUMANITARIAN_WALLET=zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4
ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702
ZION_POOL_FEE_WALLET=zion196m4n8x764v7a0s406j40094a8z5j8m6z7nk342
```

> **Chyba z 2026-03-28:** Pool měl fee-wallet env vars, ale node je neměl → single-output coinbase blocks. Vždy ověřit live env uvnitř `zion-core` containeru.

### Launch Sequence (T-0)

```
T-7 days:   Code freeze — tag v2.9.5-mainnet, build binaries + Docker images
T-3 days:   Pre-announcement (Discord, Twitter, Telegram, blog)
T-1 day:    Final checks — seed nodes ready, pool ready, explorer ready, monitoring ready
T-30min:    Genesis block creation OFFLINE
T-15min:    Deploy genesis to all seed nodes
T-5min:     Announce genesis hash
T-0:        🌟 GENESIS TIME — mining opens
T+1min:     First block expected
T+10min:    Chain stability check
T+1hr:      Launch announcement
```

### Post-Deploy Verification (mandatory)

```bash
# 1. Live env inside every zion-core
for host in $NODES; do
  ssh root@$host "docker exec zion-v3-node env | grep '^ZION_' | grep -E 'MINER|HUMANITARIAN|ISSOBELLA|POOL_FEE'"
done

# 2. Cross-node chain health
for host in $NODES; do
  ssh root@$host "echo '{\"jsonrpc\":\"2.0\",\"method\":\"getChainInfo\",\"params\":[],\"id\":1}' | nc -w 2 127.0.0.1 8443"
done
# → all nodes must agree on chain_height and tip_hash

# 3. First proof block
# Wait for block #1, then:
echo '{"jsonrpc":"2.0","method":"getBlockByHeight","params":[1],"id":1}' | nc -w 2 127.0.0.1 8443
# → verify: 4 coinbase transactions, amounts sum to subsidy, addresses populated

# 4. Pool & miner sanity
curl -s http://localhost:8080/stats | head -c 200
# → accepted shares flowing

# 5. Non-primary node audit
# Same checks on USA, Singapore, Helsinki — no divergence, no validation failures
```

### Immutable Parameters (locked)

| Parametr | Hodnota | Status |
|----------|---------|--------|
| Chain ID | `zion-mainnet-1` | 🔒 |
| Total Supply | 144,000,000,000 ZION | 🔒 |
| Initial Block Reward | 5,400.067 ZION | 🔒 |
| Block Time | 60 s | 🔒 |
| DAA | LWMA, window 60, ±25% | 🔒 |
| Max Reorg | 10 blocks | 🔒 |
| Soft Finality | 60 blocks | 🔒 |
| Fee Policy | 100% burn (deflationary) | 🔒 |
| Consensus | PoW Cosmic Harmony v3 | 🔒 |

### Open Blockers před Launch

| Blocker | Status | Poznámka |
|---------|--------|----------|
| Genesis block vytvořen OFFLINE | ⬜ | Nutné — ručně nebo skriptem |
| `MAINNET_EXIT_CRITERIA.md` sign-off | ⬜ | DRAFT, potřeba schválení |
| CI launch-gating workflow | ⬜ | `mainnet_correctness_suite` |
| BFG repo scrub (premine keys) | ✅ | `git filter-repo` proveden 2026-05-07 |
| 3rd party security audit | ⬜ | Q3 2026 |
| Docker images published | ⬜ | Registry + SHA256 checksums |
| 72h rehearsal closure report | ⬜ | Restart / recovery appendix |

---

## Multi-Host Role Map (Historical — ARCHIVNÍ)

> Tato sekce popisuje plánovanou multi-server topologii z května 2026. Aktuální provoz je **Core + Edge**.

| Server | Location | Role | Porty navíc | Poznámka |
|--------|----------|------|-------------|----------|
| **Prague (EU)** | `91.98.122.165` | Core + Pool + Web + Bridge + AI | — | Hlavní, běží všechno |
| **USA** | `5.78.194.94` | Core + Pool | 3333, 8080 | Miner pool pro US region |
| **Singapore** | `5.223.84.191` | Core + Pool | 3333, 8080 | Miner pool pro APAC region |
| **Helsinki** | `157.180.41.213` | Core + Seed | 8335 | Backup seed node |

### Seed Peer Konfigurace (per host — historický plán)

```bash
# Prague
ZION_SEED_PEERS="5.78.194.94:8333,5.223.84.191:8333,157.180.41.213:8333"

# USA
ZION_SEED_PEERS="91.98.122.165:8333,5.223.84.191:8333,157.180.41.213:8333"

# Singapore
ZION_SEED_PEERS="91.98.122.165:8333,5.78.194.94:8333,157.180.41.213:8333"

# Helsinki
ZION_SEED_PEERS="91.98.122.165:8333,5.78.194.94:8333,5.223.84.191:8333"
```

> **Pravidlo:** Každý host v `ZION_SEED_PEERS` nesmí obsahovat vlastní public IP:port.

---

## Bezpečnostní Checklist

- [ ] **Premine klíče** — offline (USB ×2 + papír), nikdy na serveru
- [ ] **SSH klíče** — nové pro každý server, žádné staré deployment klíče
- [ ] **Firewall** — `ufw allow` jen potřebné porty (22, 3000, 3333, 8080, 8001, 8335, 8448, 9090, 9093, 3001, 9100, 9101, 9121)
- [ ] **Repo scrub** — `git filter-repo` + force-push hotovo 2026-05-07 ✅
- [ ] **Docker images** — build z release tagu, ne z `main`
- [ ] **Node jako non-root** — uživatel `zion`, ne `root`
- [ ] **RPC port 8443** — nikdy neotevírat do internetu (pouze localhost + Docker síť)

---

*Vygenerováno květen 2026 z historické provozní topologie Praha serveru (91.98.122.165).*
*Dokument slouží jako archivní blueprint; aktuální provoz je konsolidován na Core + Edge topologii.*
