# ZION Docker Environment - Kompletní návod

## 🐳 Přehled Docker architektury

### Hlavní compose soubory
- `docker/compose.pool-seeds.yml` - Kompletní mining stack (seed nodes + pool + shim)
- `docker/compose.single-node.yml` - Jednoduchý standalone node
- `docker/compose.prod.yml` - Produkční nasazení
- `docker/compose.yml` - Základní development setup

### Klíčové Docker images
- `zion:production-fixed` - Hlavní CryptoNote daemon (ziond + zion_wallet)
- `zion:production-minimal` - Minimalistická verze daemonu
- `zion:rpc-shim` - JSON-RPC proxy pro kompatibilitu s pool software
- `zion:uzi-pool` - Stratum mining pool server

## 🔧 Build proces

### 1. Core daemon build
```bash
# Minimální daemon (doporučeno pro production)
docker build -f docker/Dockerfile.zion-cryptonote.minimal -t zion:production-minimal .

# Nebo full featured verze
docker build -f docker/Dockerfile.zion-cryptonote -t zion:production-fixed .
```

### 2. Supporting services build
```bash
# RPC Shim (JSON-RPC proxy)
docker build -t zion:rpc-shim adapters/zion-rpc-shim/

# Mining Pool
docker build -t zion:uzi-pool -f docker/uzi-pool/Dockerfile.x64 adapters/uzi-pool-config/
```

### 3. Tag management pro kompatibilitu
```bash
# Pokud compose očekává jiný tag
docker tag zion:production-fixed zion:production-minimal
```

## 🚀 Spuštění mining stacku

### Příprava
```bash
# 1. Ověř Docker síť
docker network ls | grep zion-seeds || docker network create zion-seeds

# 2. Zkontroluj images
docker images | grep zion

# 3. Čisti starý stack (pokud potřeba)
docker compose -f docker/compose.pool-seeds.yml down
```

### Postupné spuštění
```bash
cd /path/to/zion-repo

# 1. Core services (seed nodes + infrastruktura)
docker compose -f docker/compose.pool-seeds.yml up -d seed1 seed2 rpc-shim redis

# 2. Pool server (pokud port 3333 volný)
docker compose -f docker/compose.pool-seeds.yml up -d uzi-pool

# 3. Volitelně wallet daemon
docker compose -f docker/compose.pool-seeds.yml up -d walletd wallet-adapter
```

### Troubleshooting portů
```bash
# Zjisti co drží port 3333
sudo lsof -i :3333
sudo ss -tulpn | grep :3333

# Temporary port remap v compose (nedoporučeno)
# ports: - "3334:3333"  # místo - "3333:3333"
```

## 📊 Monitoring & health checks

### Health status
```bash
# Kontejnery status
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

# RPC Shim health
curl -s http://localhost:18089/ | jq

# Blockchain height
curl -s http://localhost:18089/getheight | jq

# Pool status (když běží)
curl -s http://localhost:3333/stats 2>/dev/null || echo "Pool nedostupný"
```

### Logs monitoring
```bash
# RPC Shim (getblocktemplate + submit events)
docker logs -f zion-rpc-shim | grep -E 'getblocktemplate|submitblock'

# Mining Pool
docker logs -f zion-uzi-pool

# Core daemon
docker logs -f zion-seed1

# Všechny najednou (tmux/screen doporučeno)
docker logs -f zion-rpc-shim &
docker logs -f zion-uzi-pool &
docker logs -f zion-seed1 &
```

## ⚙️ Konfigurační parametry

### RPC Shim tuning (pro rychlý bootstrap)
V `docker/compose.pool-seeds.yml` sekce `rpc-shim` -> `environment`:
```yaml
# Cache & performance tuning
- GBT_CACHE_MS=1500              # Agresivní cache pro bootstrap
- GBT_DISABLE_CACHE_AFTER_HEIGHT=80  # Vypni cache po 80 blocích
- BUSY_CACHE_FACTOR=6            # Prodluž cache při busy daemon
- SUBMIT_INITIAL_DELAY_MS=800    # Delay před prvním submitem
- SUBMIT_MAX_BACKOFF_MS=12000    # Max backoff při busy
- PREFETCH_INTERVAL_MS=4000      # Background template prefetch
```

### Pool adresy (klíčové!)
```yaml
# V uzi-pool sekci
- POOL_ADDRESS=Z3222ywic7fGUZHv9EfFwEKf1VJRrEqPbLrHgRiBb43LWaS1Cz2gVwgdF2kvUPsGb9jSvUUf31oNCSZgNEtUiGDT4sBLtXmGzc
```

## 🔧 Development workflow

### Rychlý restart specifické služby
```bash
# Restart jen shim (zachová data ostatních)
docker compose -f docker/compose.pool-seeds.yml up -d --force-recreate --no-deps rpc-shim

# Restart celého stacku
docker compose -f docker/compose.pool-seeds.yml restart
```

### Debug kontejneru
```bash
# Bash do running kontejneru
docker exec -it zion-seed1 bash
docker exec -it zion-rpc-shim sh

# Inspect network
docker network inspect zion-seeds

# Volume content
docker volume ls | grep zion
docker volume inspect docker_seed1-data
```

### Rebuild po změnách kódu
```bash
# Rebuild konkrétní image
docker compose -f docker/compose.pool-seeds.yml build --no-cache rpc-shim

# Nebo manuální build
docker build --no-cache -t zion:rpc-shim adapters/zion-rpc-shim/

# Restart s novým image
docker compose -f docker/compose.pool-seeds.yml up -d --force-recreate rpc-shim
```

## 🎯 Mining client připojení

### XMRig (external)
```bash
# CPU mining
xmrig -o HOST_IP:3333 -a rx/0 -u POOL_ADDRESS --tls=false --keepalive

# Nebo přes config file
xmrig -c /config/xmrig-zion.json
```

### Docker miner (interní)
```bash
# Pokud máš XMRig compose service
docker compose -f docker/compose.pool-seeds.yml up -d xmrig-cpu
```

## 📈 Metriky a sledování

### Prometheus endpoints
```bash
# RPC Shim metrics
curl -s http://localhost:18089/metrics

# JSON format
curl -s http://localhost:18089/metrics.json | jq '.metrics'

# Konkrétní counters
curl -s http://localhost:18089/metrics | grep -E 'submit_(ok|error|busy_retries)'
```

### Height monitoring
```bash
# Watch script (čeká na 60 bloků)
./tools/watch_height.sh 60

# Manuální check
curl -s http://localhost:18089/getheight | jq '.height'
```

## 🛠️ Známé problémy a řešení

### 1. Port 3333 obsazen
```bash
# Najdi proces
sudo lsof -i :3333

# Kill específic PID
sudo kill -9 PID

# Nebo kill všechny Python (opatrně!)
pkill -f "python.*pool"
```

### 2. Image neexistuje
```bash
# Zkontroluj dostupné images
docker images | grep zion

# Build chybějící
docker build -t CHYBĚJÍCÍ_TAG .
```

### 3. Network connectivity
```bash
# Ověř síť
docker network ls | grep zion-seeds

# Vytvoř síť
docker network create zion-seeds

# Debug network
docker network inspect zion-seeds
```

### 4. Health check fails
```bash
# Manuální health test
curl -f http://localhost:18089/ || echo "Shim nedostupný"
curl -f http://localhost:18081/getheight || echo "Daemon nedostupný"

# Container internal health
docker exec zion-seed1 curl -f http://127.0.0.1:18081/getheight
```

## 🎯 Quick Start příkazy

### Kompletní setup from scratch
```bash
#!/bin/bash
cd /path/to/zion

# Build všechny images
docker build -f docker/Dockerfile.zion-cryptonote.minimal -t zion:production-minimal .
docker build -t zion:rpc-shim adapters/zion-rpc-shim/
docker build -t zion:uzi-pool -f docker/uzi-pool/Dockerfile.x64 adapters/uzi-pool-config/
docker tag zion:production-minimal zion:production-fixed

# Create network
docker network create zion-seeds 2>/dev/null || true

# Start core
docker compose -f docker/compose.pool-seeds.yml up -d seed1 seed2 rpc-shim redis

# Wait for health
sleep 30

# Start pool (pokud port volný)
docker compose -f docker/compose.pool-seeds.yml up -d uzi-pool

# Status check
docker ps --format 'table {{.Names}}\t{{.Status}}'
curl -s http://localhost:18089/ | jq '.status'
```

### Monitoring setup
```bash
# Terminal 1: Height watch
./tools/watch_height.sh 60

# Terminal 2: Submit logs
docker logs -f zion-rpc-shim | grep submitblock

# Terminal 3: Pool logs
docker logs -f zion-uzi-pool

# Terminal 4: Metrics
watch -n 5 'curl -s http://localhost:18089/metrics | grep submit_ok'
```

## 📝 Poznámky

- **Adresy**: ✅ Wallet nyní správně generuje `Z3...` adresy po opravě prefixu
- **Port 3333**: Často obsazen development servery, check před spuštěním
- **Cache tuning**: Pro bootstrap použij agresivní cache settings, pak zmírni
- **Health checks**: Seed1 má 180s start_period, počkej na healthy status

---

*Dokument vytvořen automaticky na základě GPT5 analýzy a praktických zkušeností s live mining stackem.*