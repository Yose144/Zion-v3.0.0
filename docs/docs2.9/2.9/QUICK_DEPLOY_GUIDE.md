# 🚀 ZION v2.9 Quick Deployment Guide

## 📋 Prerequisites

- [x] Server: Ubuntu 24.04 LTS at 91.98.122.165
- [x] SSH access with key authentication
- [x] Docker & Docker Compose installed on server
- [x] Nginx installed with SSL certificates
- [x] Domain: www.zionterranova.com pointing to server

## ⚡ Quick Start (5 Minutes)

### 1. Build Website Locally
```bash
cd website-v2.9
npm install
npm run build
# Output: website-v2.9/out/
```

### 2. Deploy Complete Stack
```bash
# Make script executable
chmod +x scripts/deploy-complete-stack.sh

# Run deployment
./scripts/deploy-complete-stack.sh
```

**That's it!** The script will:
- ✅ Upload Docker Compose stack
- ✅ Upload Dockerfiles & source code
- ✅ Build all Docker images
- ✅ Start all services
- ✅ Deploy website
- ✅ Configure Nginx
- ✅ Run health checks

### 3. Verify Deployment
```bash
# Check website
curl -I https://www.zionterranova.com

# Check API
curl https://www.zionterranova.com/api/health

# Check pool
nc -zv zionterranova.com 3333
```

---

## 📦 Manual Deployment (Step-by-Step)

### Step 1: Prepare Local Environment

```bash
# Clone repository (if not already)
cd ~/Desktop
git clone <your-repo> Zion-2.9
cd Zion-2.9

# Build website
cd website-v2.9
npm install
npm run build
cd ..
```

### Step 2: Upload Files to Server

```bash
# Upload Docker stack
rsync -avz docker-compose-v2.9-production.yml root@91.98.122.165:/root/zion-v2.9/docker-compose.yml

# Upload Dockerfiles
rsync -avz --delete docker/ root@91.98.122.165:/root/zion-v2.9/docker/

# Upload source code
rsync -avz --exclude='__pycache__' --exclude='.venv' --exclude='node_modules' \
    src/ zion/ core/ api/ wallet/ mining/ network/ ai/ requirements.txt \
    root@91.98.122.165:/root/zion-v2.9/

# Upload configs
rsync -avz config/ root@91.98.122.165:/root/zion-v2.9/config/
rsync -avz monitoring/ root@91.98.122.165:/root/zion-v2.9/monitoring/
```

### Step 3: Build & Start Docker Stack

```bash
# SSH to server
ssh root@91.98.122.165

# Navigate to project
cd /root/zion-v2.9

# Build images (takes ~10 minutes first time)
docker-compose build --parallel

# Start services
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

### Step 4: Deploy Website

```bash
# From local machine
rsync -avz --delete website-v2.9/out/ root@91.98.122.165:/var/www/zionterranova.com/
```

### Step 5: Configure Nginx

```bash
# Upload Nginx config
scp deployment/nginx-zionterranova.conf root@91.98.122.165:/etc/nginx/sites-available/zionterranova.com

# On server: test & reload
ssh root@91.98.122.165 'nginx -t && systemctl reload nginx'
```

---

## 🔧 Configuration Files

### Required Files

1. **docker-compose-v2.9-production.yml** - Main stack definition
2. **docker/blockchain-v2.9/Dockerfile** - Blockchain node
3. **docker/pool-v2.9/Dockerfile** - Mining pool
4. **docker/api-v2.9/Dockerfile** - API gateway
5. **deployment/nginx-zionterranova.conf** - Nginx config
6. **config/blockchain_production.json** - Blockchain settings
7. **config/pool_production.json** - Pool settings
8. **monitoring/prometheus.yml** - Metrics config

### Optional Files

- **.env** - Environment variables (from .env.template)
- **monitoring/grafana/** - Dashboard configs
- **scripts/backup.sh** - Automated backups

---

## 🐳 Docker Services

| Service | Container | Port(s) | Purpose |
|---------|-----------|---------|---------|
| **blockchain** | zion-blockchain-v2.9 | 8545, 18081 | Core blockchain node |
| **pool** | zion-pool-v2.9 | 3333, 8080 | Mining pool + stats |
| **api** | zion-api-v2.9 | 8001 | REST API + agents |
| **redis** | zion-redis-v2.9 | 6379 | Cache & pub/sub |
| **prometheus** | zion-prometheus-v2.9 | 9090 | Metrics storage |
| **grafana** | zion-grafana-v2.9 | 3000 | Dashboards |

All services are on internal network `zion-internal`. Only port 3333 is exposed publicly.

---

## 🔍 Health Checks

### Automatic Health Checks (Docker)
```bash
docker-compose ps
# Should show all services as "Up (healthy)"
```

### Manual Health Checks
```bash
# API
curl http://localhost:8001/health
# {"status":"healthy","version":"2.9.0"}

# Pool
nc -zv localhost 3333
# Connection to localhost 3333 port [tcp/*] succeeded!

# Redis
docker exec zion-redis-v2.9 redis-cli ping
# PONG

# Blockchain
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Website Health
```bash
curl -I https://www.zionterranova.com
# HTTP/2 200

curl https://www.zionterranova.com/api/health
# {"status":"healthy"}
```

---

## 📊 Monitoring

### Access Grafana
```
URL: https://www.zionterranova.com/grafana/
User: admin
Password: (from .env GRAFANA_ADMIN_PASSWORD)
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f blockchain
docker-compose logs -f pool
docker-compose logs -f api

# Last 100 lines
docker-compose logs --tail=100 blockchain
```

### View Metrics
```bash
# Prometheus UI
open https://www.zionterranova.com/prometheus/

# Quick stats
docker stats
```

---

## 🔄 Common Operations

### Restart Service
```bash
docker-compose restart blockchain
docker-compose restart pool
docker-compose restart api
```

### Update Code (Without Rebuild)
```bash
# Upload new code
rsync -avz src/ root@91.98.122.165:/root/zion-v2.9/src/

# Restart affected service
ssh root@91.98.122.165 'cd /root/zion-v2.9 && docker-compose restart api'
```

### Update Website
```bash
# Build locally
cd website-v2.9 && npm run build

# Deploy
npm run deploy
# Or manually:
rsync -avz --delete out/ root@91.98.122.165:/var/www/zionterranova.com/
```

### Rebuild Service
```bash
# Rebuild specific service
docker-compose build blockchain
docker-compose up -d blockchain

# Rebuild all
docker-compose build --parallel
docker-compose up -d
```

### Stop Stack
```bash
# Stop all services (data preserved)
docker-compose stop

# Stop and remove containers (data preserved)
docker-compose down

# DANGER: Remove everything including volumes
docker-compose down -v
```

---

## 🛡️ Security

### Firewall Rules
```bash
# On server
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS
ufw allow 3333/tcp   # Pool
ufw enable
```

### SSL Certificate Renewal
```bash
# Certbot auto-renews, but to force:
certbot renew --force-renewal
systemctl reload nginx
```

### Update Secrets
```bash
# Edit .env file
nano .env

# Restart affected services
docker-compose up -d
```

---

## 🐛 Troubleshooting

### Service Won't Start
```bash
# Check logs
docker-compose logs <service>

# Check if port is already in use
netstat -tulpn | grep <port>

# Rebuild image
docker-compose build --no-cache <service>
docker-compose up -d <service>
```

### API Returns 502
```bash
# Check API container
docker-compose ps api
docker-compose logs api

# Check Nginx
nginx -t
systemctl status nginx
tail -f /var/log/nginx/error.log
```

### Pool Not Accepting Connections
```bash
# Check pool logs
docker-compose logs pool

# Check blockchain connection
docker-compose exec pool nc -zv blockchain 18081

# Test locally
nc -zv localhost 3333
```

### Website Shows Old Version
```bash
# Clear browser cache
# Or force refresh: Ctrl+Shift+R

# Verify files on server
ssh root@91.98.122.165 'ls -lh /var/www/zionterranova.com/index.html'

# Re-deploy
cd website-v2.9 && npm run build && npm run deploy
```

---

## 📦 Backup & Restore

### Manual Backup
```bash
# On server
cd /root/zion-v2.9

# Backup volumes
docker run --rm -v zion-v2.9_blockchain-data:/data -v /root/backups:/backup \
  alpine tar czf /backup/blockchain-$(date +%F).tar.gz /data

docker run --rm -v zion-v2.9_pool-data:/data -v /root/backups:/backup \
  alpine tar czf /backup/pool-$(date +%F).tar.gz /data
```

### Automated Backup (Cron)
```bash
# Add to crontab
crontab -e

# Daily at 2 AM
0 2 * * * /root/zion-v2.9/scripts/backup.sh
```

### Restore Backup
```bash
# Stop services
docker-compose down

# Restore volume
docker run --rm -v zion-v2.9_blockchain-data:/data -v /root/backups:/backup \
  alpine sh -c "cd /data && tar xzf /backup/blockchain-2025-12-15.tar.gz --strip 1"

# Start services
docker-compose up -d
```

---

## 🎯 Production Checklist

Before going live:

- [ ] All environment variables set in `.env`
- [ ] SSL certificates valid and auto-renewing
- [ ] Firewall configured (ufw)
- [ ] Backup script running (cron)
- [ ] Monitoring alerts configured (Discord/Telegram)
- [ ] Grafana dashboards imported
- [ ] API rate limiting tested
- [ ] Pool whitelist configured
- [ ] Genesis block validated
- [ ] Website builds without errors
- [ ] All health checks passing for 24h
- [ ] Logs show no errors
- [ ] Disk space sufficient (>50GB free)
- [ ] RAM usage normal (<80%)
- [ ] CPU usage acceptable (<50% avg)

---

## 📞 Support

### Get Help
- **Logs:** `docker-compose logs -f`
- **Status:** `docker-compose ps`
- **Metrics:** https://www.zionterranova.com/grafana/

### Useful Links
- Deployment Plan: `DEPLOYMENT_PLAN_v2.9_COMPLETE.md`
- Docker Compose: `docker-compose-v2.9-production.yml`
- Nginx Config: `deployment/nginx-zionterranova.conf`

---

**Last Updated:** December 15, 2025  
**Version:** 2.9.0 "Quantum Leap"  
**Status:** 🟢 Ready for Production
