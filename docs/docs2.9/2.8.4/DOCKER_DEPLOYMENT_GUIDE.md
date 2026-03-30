# ZION v2.8.4 Docker Deployment Guide

Kompletní průvodce nasazením ZION blockchain pomocí Docker Compose.

---

## ✅ Předpoklady

- **Docker Desktop** (macOS/Windows) nebo **Docker Engine** (Linux)
- **Docker Compose** v2.0+
- **8 GB RAM** (minimum), 16 GB doporučeno
- **20 GB volného místa** na disku
- **Porty**: 8545, 8333, 8080, 3000, 9090 (volné)

---

## 🚀 Rychlý start

### 1. Stažení repozitáře

```bash
git clone https://github.com/estrelaisabellazion3/Zion-2.8.git
cd Zion-2.8
git checkout v2.8.4
```

### 2. Build Docker image

```bash
docker compose -f deployment/docker-compose.2.8.4-production.yml build zion-node
```

**Build trvá 3-5 minut** (stahování Python base image, instalace závislostí, kopírování kódu).

### 3. Spuštění node

```bash
docker compose -f deployment/docker-compose.2.8.4-production.yml up -d zion-node
```

### 4. Ověření stavu

```bash
# Zkontroluj běžící kontejnery
docker ps | grep zion

# Čti logy
docker logs -f zion-2.8.4-node

# Testuj RPC endpoint
curl http://localhost:8545/api/status
```

---

## 📡 RPC API Reference

### REST Endpoints

```bash
# Status blockchainu
curl http://localhost:8545/api/status

# Vrátí:
{
  "blockchain": {
    "height": 1,
    "total_supply": 15782857143.0,
    "difficulty": 2,
    "block_reward": 50
  },
  "network": {
    "connected_peers": 0,
    "total_peers": 0,
    "listening_port": 8333
  },
  "version": "2.7.4"
}
```

### JSON-RPC 2.0 Endpoints

```bash
# Získej podporované algoritmy
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "getalgorithms",
    "params": [],
    "id": 1
  }'

# Vrátí:
{
  "result": {
    "supported": {
      "cosmic_harmony": true,
      "randomx": true,
      "yescrypt": true,
      "autolykos_v2": true
    },
    "default": "cosmic_harmony",
    "active": "cosmic_harmony",
    "asic_resistant": true,
    "note": "SHA256 not supported (ASIC resistance policy)"
  },
  "error": null,
  "id": 1
}
```

---

## 🔧 Pokročilá konfigurace

### Proměnné prostředí

Upravit v `docker-compose.2.8.4-production.yml`:

```yaml
environment:
  - ZION_ENV=production          # Prostředí (production/development)
  - ZION_VERSION=2.8.4           # Verze
  - ZION_LOG_LEVEL=info          # Úroveň logování (debug/info/warning/error)
  - ZION_RPC_PORT=8545           # RPC port
  - ZION_P2P_PORT=8333           # P2P port
  - ZION_WS_PORT=8080            # WebSocket port
  - ZION_DEFAULT_ALGO=cosmic_harmony  # Výchozí algoritmus
  - ZION_ASIC_RESISTANT=true     # ASIC resistance policy
```

### Porty

| Služba | Port | Popis |
|--------|------|-------|
| RPC | 8545 | JSON-RPC 2.0 + REST API |
| P2P | 8333 | Peer-to-peer network |
| WebSocket | 8080 | Real-time updates |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3000 | Monitoring dashboards |

---

## 📊 Monitoring Stack (volitelné)

### Spuštění Prometheus + Grafana

```bash
docker compose -f deployment/docker-compose.2.8.4-production.yml up -d prometheus grafana
```

### Přístup

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin / zion_admin_2.8.4)

---

## 🐛 Troubleshooting

### Kontejner neustále restartuje

```bash
# Zkontroluj logy
docker logs zion-2.8.4-node

# Častá chyba: chybějící závislost
# Řešení: Rebuild image
docker compose -f deployment/docker-compose.2.8.4-production.yml build --no-cache zion-node
```

### Port již používán

```bash
# Zjisti, co používá port 8545
lsof -i :8545  # macOS/Linux
netstat -ano | findstr :8545  # Windows

# Změň port v docker-compose.yml
ports:
  - "8546:8545"  # Změněno z 8545 na 8546
```

### Healthcheck selhal

```bash
# Zkontroluj, zda endpoint odpovídá
docker exec zion-2.8.4-node curl http://localhost:8545/api/status

# Pokud neodpovídá, zkontroluj logy
docker logs zion-2.8.4-node | grep ERROR
```

### Nízká rychlost buildu (macOS Docker Desktop)

```bash
# Použij BuildKit
export DOCKER_BUILDKIT=1
docker compose -f deployment/docker-compose.2.8.4-production.yml build
```

---

## 🔄 Správa služeb

### Zastavení služeb

```bash
docker compose -f deployment/docker-compose.2.8.4-production.yml down
```

### Restart konkrétní služby

```bash
docker compose -f deployment/docker-compose.2.8.4-production.yml restart zion-node
```

### Odstranění dat (reset)

```bash
# VAROVÁNÍ: Smaže všechna blockchain data
docker compose -f deployment/docker-compose.2.8.4-production.yml down -v
```

### Zobrazení logů

```bash
# Všechny služby
docker compose -f deployment/docker-compose.2.8.4-production.yml logs -f

# Jen node
docker compose -f deployment/docker-compose.2.8.4-production.yml logs -f zion-node

# Posledních 100 řádků
docker logs --tail 100 zion-2.8.4-node
```

---

## 📈 Performance Tuning

### Optimalizace pro produkci

1. **Zvýšení paměti pro Docker Desktop**:
   - macOS: Docker Desktop → Preferences → Resources → 8 GB RAM
   - Windows: Docker Desktop → Settings → Resources → 8 GB RAM

2. **CPU limity** (upravit v docker-compose.yml):
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2.0'
         memory: 4G
       reservations:
         cpus: '1.0'
         memory: 2G
   ```

3. **Persistence dat** (přidat volumes):
   ```yaml
   volumes:
     - zion-blockchain-data:/app/data
     - zion-logs:/app/logs
   ```

---

## 🔐 Bezpečnost

### Firewall pravidla (Linux)

```bash
# Povolení pouze RPC z localhost
sudo ufw allow from 127.0.0.1 to any port 8545

# Povolení P2P ze všech IP
sudo ufw allow 8333/tcp
```

### SSL/TLS (Nginx reverse proxy)

Pro produkční nasazení doporučujeme Nginx s Let's Encrypt:

```nginx
server {
    listen 443 ssl;
    server_name blockchain.example.com;

    ssl_certificate /etc/letsencrypt/live/blockchain.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blockchain.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8545;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 📝 Další kroky

1. **Testování**: Spusť testy `pytest tests/integration/`
2. **Monitoring**: Nastav Grafana dashboardy
3. **Backup**: Pravidelně zálohuj `/app/data` složku
4. **Updates**: Sleduj GitHub releases pro nové verze

---

## 🆘 Podpora

- **GitHub Issues**: https://github.com/estrelaisabellazion3/Zion-2.8/issues
- **Dokumentace**: `/docs/2.8.4/`
- **Release Notes**: `RELEASE_NOTES_v2.8.4.md`

---

**Postaveno s ❤️ pro ZION v2.8.4 "Cosmic Harmony"**
