# ZION v2.9 Production Server - Přístupové Informace

## 🔐 SSH Přístup

### Test Server (91.98.122.165) - Development/TestNet
- **Server IP**: `91.98.122.165`
- **Hostname**: `TestNet-Zion`
- **User**: `root`
- **SSH Port**: `22` (default)
- **OS**: Ubuntu 24.04 LTS
- **Purpose**: Development, testing, TestNet
- **Website**: ✅ **ZION Web v2.9 deployed** - http://91.98.122.165/

### Production Server (dw214.webglobe.com) - Live Website & Presale
- **Server IP**: `dw214.webglobe.com`
- **SSH Host**: `dw214.webglobe.com`
- **User**: `ssh-685961`
- **SSH Port**: `20002`
- **Home Directory**: `/home/html/newearth.cz`
- **Web Root**: `/home/html/newearth.cz/public_html/`
- **OS**: Linux (Webglobe hosting)
- **Purpose**: Live website, presale system, production API
- **Domain**: `newearth.cz`

Helsinky ! 
77.42.31.72 ssh klic v .ssh
Credentials
User	root
Password	HNjCgPtsqP9d

USA - 
5.78.138.238
User	root
Password	7UgempXHNEws




### SSH Klíče (doporučený přístup)
```bash
# Test Server
ssh -i ~/.ssh/zion_server_key root@91.98.122.165

# Production Server
ssh -p 20002 ssh-685961@dw214.webglobe.com
```

### Hesla (fallback)
```
Test Server: (password redacted — use secure channel)
Production Server: XGOaFUYs (uživatel ssh-685961)
```

### SSH Klíče (doporučený přístup)
```bash
# Připojení s SSH klíčem (WSL)
wsl -- ssh -i /home/anaha/.ssh/zion_server_key root@91.98.122.165

# Připojení s SSH klíčem (běžný bash)
ssh -i ~/.ssh/zion_server_key root@91.98.122.165
```

**Umístění klíčů:**
- **Private key**: `/home/anaha/.ssh/zion_server_key` (WSL)
- **Public key**: `/home/anaha/.ssh/zion_server_key.pub` (WSL)
- **Windows cesta**: `\\wsl$\Ubuntu\home\anaha\.ssh\`

### Heslo (fallback)
```
Password: (redacted)
```

### Quick SSH Commands
```bash
# === TEST SERVER ===
# Status všech Docker služeb
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 'docker ps'

# Logy z blockchain
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 'docker logs zion-blockchain-v2.9 --tail 50'

# Restart služby
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 'cd /root/zion-v2.9 && docker compose restart pool'

# Celkový status stacku
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 'cd /root/zion-v2.9 && docker compose ps'

# === PRODUCTION SERVER ===
# Presale API status
ssh -p 20002 ssh-685961@dw214.webglobe.com 'curl -s https://newearth.cz/V2/api/presale-order.php | head -5'

# Wallet ledger test
ssh -p 20002 ssh-685961@dw214.webglobe.com 'curl -s -X POST https://newearth.cz/V2/api/wallet-ledger.php -H "Content-Type: application/json" -d "{}"'

# Check presale config
ssh -p 20002 ssh-685961@dw214.webglobe.com 'grep -A 10 "PRESALE_" ~/public_html/V2/api/config.php'
```

---

## 🐳 Docker Stack v2.9

### Služby (všech 6 běží HEALTHY!)
1. **zion-blockchain-v2.9** - Blockchain node
   - Ports: `127.0.0.1:8545`, `127.0.0.1:18081`
   - Image: `zion/blockchain:2.9.0`

2. **zion-pool-v2.9** - Mining pool
   - Ports: `0.0.0.0:3333`, `127.0.0.1:8080`
   - Image: `zion/pool:2.9.0`

3. **zion-api-v2.9** - FastAPI gateway
   - Port: `127.0.0.1:8001`
   - Image: `zion/api:2.9.0`

4. **zion-redis-v2.9** - Cache
   - Port: `127.0.0.1:6379`
   - Image: `redis:7-alpine`

5. **zion-prometheus-v2.9** - Monitoring
   - Port: `127.0.0.1:9090`
   - Image: `prom/prometheus:v2.48.0`

6. **zion-grafana-v2.9** - Dashboards
   - Port: `127.0.0.1:3000`
   - Image: `grafana/grafana:10.2.2`
   - Admin: `admin` / `zion_secure_2024`

### Docker Compose příkazy
```bash
# Status
cd /root/zion-v2.9 && docker compose ps

# Logy všech služeb
cd /root/zion-v2.9 && docker compose logs -f

# Restart stacku
cd /root/zion-v2.9 && docker compose restart

# Stop stack
cd /root/zion-v2.9 && docker compose down

# Start stack
cd /root/zion-v2.9 && docker compose up -d

# Rebuild a restart
cd /root/zion-v2.9 && docker compose build && docker compose up -d
```

---

## 🌐 Website & Nginx

### Website
- **URL**: https://www.zionterranova.com
- **Local URL**: https://zionterranova.com
- **Location**: `/var/www/zionterranova.com/`
- **Version**: v2.9.0 (Next.js static export)

### Nginx
- **Config**: `/etc/nginx/sites-available/zionterranova`
- **Test config**: `nginx -t`
- **Reload**: `systemctl reload nginx`
- **Status**: `systemctl status nginx`

### Endpoints
- **Website**: https://www.zionterranova.com
- **API**: https://www.zionterranova.com/api/
- **Pool API**: https://www.zionterranova.com/pool/
- **Grafana**: https://www.zionterranova.com/grafana/

---

## 📁 Důležité cesty na serveru

```
/root/zion-v2.9/
├── docker-compose.yml           # Main orchestration
├── .env                          # Environment variables
├── config/
│   ├── blockchain_production.json
│   └── pool_production.json
├── monitoring/
│   ├── prometheus.yml
│   └── alerts.yml
├── docker/
│   ├── blockchain-v2.9/Dockerfile
│   ├── api-v2.9/Dockerfile
│   └── pool-v2.9/Dockerfile
├── logs/
│   ├── blockchain/
│   ├── pool/
│   └── api/
└── src/                         # Source code
    ├── core/
    ├── api/
    ├── wallet/
    ├── mining/
    └── zion/
```

---

## 🔧 Monitoring & Diagnostics

### Prometheus
```bash
# Otevřít Prometheus UI
ssh -i ~/.ssh/zion_server_key -L 9090:localhost:9090 root@91.98.122.165

# Pak v browseru: http://localhost:9090
```

### Grafana
```bash
# Otevřít Grafana UI
ssh -i ~/.ssh/zion_server_key -L 3000:localhost:3000 root@91.98.122.165

# Pak v browseru: http://localhost:3000
# Login: admin / zion_secure_2024
```

### Health Checks
```bash
# API health
curl http://localhost:8001/health

# Blockchain RPC
curl -X POST http://localhost:8545/json_rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_info"}'

# Pool stats
curl http://localhost:8080/stats
```

---

## 📊 System Status

### Disk Usage
```bash
df -h
# Result: 20% used, 29GB free (po formátování)
```

### Docker Resources
```bash
docker system df
```

### Logs
```bash
# System logs
journalctl -u docker -f

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Docker compose logs
cd /root/zion-v2.9 && docker compose logs -f
```

---

## 🚀 Quick Deployment Commands

### Upload files z lokálního Windows
```powershell
# Upload celého stacku
wsl -- rsync -avz --exclude 'node_modules' --exclude '.git' \
  /mnt/c/Users/anaha/OneDrive/Plocha/Zion-2.9/ \
  root@91.98.122.165:/root/zion-v2.9/

# Upload jen configs
wsl -- rsync -avz ./config/ root@91.98.122.165:/root/zion-v2.9/config/

# Upload website
wsl -- rsync -avz ./website-v2.9/out/ \
  root@91.98.122.165:/var/www/zionterranova.com/
```

### Rebuild & Deploy
```bash
# Na serveru
cd /root/zion-v2.9
docker compose build --no-cache
docker compose down
docker compose up -d
docker compose ps
```

---

## 🔒 Bezpečnost

### Firewall (UFW)
```bash
ufw status
# Allowed: 22/tcp, 80/tcp, 443/tcp, 3333/tcp (pool)
```

### SSH Hardening
- ✅ SSH klíče nakonfigurovány
- ✅ Root přístup povolen (production server)
- Port: 22 (default)

### SSL Certifikáty
- **Let's Encrypt** ready (Nginx konfigurace připravena)
- Instalace: `certbot --nginx -d www.zionterranova.com -d zionterranova.com`

---

## 📞 Emergency Commands

### Pokud stack nefunguje
```bash
# 1. Stop vše
docker compose down

# 2. Zkontroluj logs
docker compose logs

# 3. Restart
docker compose up -d

# 4. Sleduj logy
docker compose logs -f
```

### Pokud zabírá moc místa
```bash
# Clean Docker cache
docker system prune -a --volumes -f

# Clean logs
journalctl --vacuum-time=7d
```

### Restart celého serveru
```bash
# Graceful restart
docker compose down
reboot
# Po restartu:
cd /root/zion-v2.9 && docker compose up -d
```

---

## 🌐 Production Server - Presale & Website

### Server Details
- **Provider**: Webglobe (Czech hosting)
- **Domain**: `newearth.cz`
- **Web Root**: `/home/html/newearth.cz/public_html/`
- **Presale API**: `/home/html/newearth.cz/public_html/V2/api/`
- **PHP Version**: 7.4+
- **SSL**: Let's Encrypt ready

### Presale System Status
- **P0 Security Fixes**: ✅ DEPLOYED (16. prosince 2025)
  - Presale enable/disable check
  - Server-side token validation
  - Wallet-ledger API authentication
- **Config Flags**:
  - `PRESALE_ENABLED`: `false` (safety default)
  - `PRESALE_TOKEN_PRICE`: `0.008` EUR/token
  - `WALLET_LEDGER_API_KEY`: Empty (admin must set)
- **API Endpoints**:
  - Presale orders: `https://newearth.cz/V2/api/presale-order.php`
  - Wallet ledger: `https://newearth.cz/V2/api/wallet-ledger.php`
  - Stripe webhooks: `https://newearth.cz/V2/api/stripe-webhook.php`

### Quick Production Commands
```bash
# Check presale API health
curl -s https://newearth.cz/V2/api/presale-order.php | jq .

# Test P0 security (should return 403)
curl -s -X POST https://newearth.cz/V2/api/presale-order.php \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","tokens":1000,"priceEur":8}'

# Test wallet API auth (should return 401)
curl -s -X POST https://newearth.cz/V2/api/wallet-ledger.php \
  -H "Content-Type: application/json" \
  -d '{"status":"sent"}'

# View presale config
ssh -p 20002 ssh-685961@dw214.webglobe.com 'grep -A 15 "PRESALE_" ~/public_html/V2/api/config.php'
```

### Deployment Notes
- **Last P0 Deploy**: 16. prosince 2025
- **Files Updated**: presale-order.php, wallet-ledger.php, presale-utils.php, config.php
- **Git Branch**: feature/ci-api-smoke (ready for PR)
- **Security**: API keys in config.php (not in git)

---

## 📝 Poznámky

- **Test Server**: Development/TestNet (91.98.122.165) - Docker stack
- **Production Server**: Live website/presale (dw214.webglobe.com) - Shared hosting
- **Datum nasazení**: 15. prosince 2025 (TestNet), 16. prosince 2025 (P0 fixes production)
- **Poslední format serveru**: 15. prosince 2025 (3.7GB uvolněno)
- **Docker build**: Všechny 3 image builduty úspěšně
- **Stack status**: Všech 6 služeb HEALTHY ✅ (TestNet)
- **Website**: Nasazený v2.9.0 ✅
- **Presale Security**: P0 fixes deployed ✅
- **SSH klíče**: Nakonfigurovány ✅

---

## 🎯 Další kroky

1. ✅ Dokončit P0 bezpečnostní fixy (HOTOVO)
2. ⏳ Nastavit WALLET_LEDGER_API_KEY na production
3. ⏳ Dokončit Nginx konfiguraci s SSL
4. ⏳ Nastavit automatické zálohy
5. ⏳ Nastavit monitoring alerts (email/Discord)
6. ⏳ Agent client development
7. ⏳ Dashboard UI pro agenty

---

**Vytvořeno**: 15. prosince 2025, 23:20 CET  
**Poslední aktualizace**: 16. prosince 2025, 14:35 CET  
**Verze dokumentu**: 1.1
