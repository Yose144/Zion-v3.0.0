# ZION TerraNova v2.9.5 - Deployment Guide

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ZION Production Stack                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Pool EU   │  │   Pool US   │  │  Pool Asia  │         │
│  │  Helsinki   │  │   Ashburn   │  │  Singapore  │         │
│  │ 77.42.31.72 │  │5.78.145.234 │  │5.223.56.122 │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                ┌─────────▼─────────┐                        │
│                │  Blockchain Node  │                        │
│                │   (Primary)       │                        │
│                └───────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Deploy (Docker)

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM
- 50GB+ disk space

### 1. Clone Repository
```bash
git clone https://github.com/Yose144/Zion-2.9.git
cd Zion-2.9
```

### 2. Configure Environment
```bash
cp config/pool_config.example.json config/pool_config.json
# Edit configuration
nano config/pool_config.json
```

### 3. Start Stack
```bash
docker-compose -f docker-compose-v2.9-production.yml up -d
```

### 4. Verify Services
```bash
docker-compose ps
# All services should show "Up"

# Check pool API
curl http://localhost:8080/stats
```

---

## 📦 Component Deployment

### Blockchain Node

```bash
cd 2.9.5/zion-blockchain

# Build
cargo build --release

# Run
./target/release/zion-node \
  --data-dir /var/lib/zion \
  --rpc-bind 0.0.0.0:8545 \
  --p2p-bind 0.0.0.0:30303 \
  --log-level info
```

**Configuration** (`node_config.json`):
```json
{
  "network": "testnet",
  "data_dir": "/var/lib/zion",
  "rpc": {
    "enabled": true,
    "bind": "0.0.0.0",
    "port": 8545
  },
  "p2p": {
    "bind": "0.0.0.0",
    "port": 30303,
    "max_peers": 50
  },
  "mining": {
    "enabled": false
  }
}
```

### Mining Pool

```bash
cd src/pool

# Install dependencies
pip install -r requirements.txt

# Run pool
python zion_pool_v2_9.py --config ../../config/pool_config.json
```

**Pool Configuration** (`pool_config.json`):
```json
{
  "pool": {
    "host": "0.0.0.0",
    "stratum_port": 3333,
    "api_port": 8080,
    "fee_percent": 1.0
  },
  "blockchain": {
    "rpc_url": "http://localhost:8545",
    "wallet": "zion1pool_wallet_address"
  },
  "vardiff": {
    "min_diff": 1000,
    "max_diff": 1000000,
    "target_time": 15,
    "retarget_time": 60
  },
  "rewards": {
    "base_reward": 50,
    "consciousness_bonus": 1569.63,
    "humanitarian_percent": 10
  },
  "redis": {
    "host": "localhost",
    "port": 6379
  }
}
```

### API Gateway

```bash
cd src/api

# Run FastAPI
uvicorn router_v2_9:app --host 0.0.0.0 --port 8001
```

---

## 🐳 Docker Compose Production

Full `docker-compose-v2.9-production.yml`:

```yaml
version: '3.8'

services:
  blockchain:
    image: zion/blockchain:2.9.5
    container_name: zion-blockchain
    restart: always
    volumes:
      - blockchain_data:/var/lib/zion
      - ./config:/app/config
    ports:
      - "8545:8545"
      - "30303:30303"
    environment:
      - RUST_LOG=info
    networks:
      - zion-network

  pool:
    image: zion/pool:2.9.5
    container_name: zion-pool
    restart: always
    depends_on:
      - blockchain
      - redis
    volumes:
      - pool_data:/app/data
      - ./config:/app/config
    ports:
      - "3333:3333"
      - "8080:8080"
    environment:
      - BLOCKCHAIN_RPC=http://blockchain:8545
      - REDIS_URL=redis://redis:6379
    networks:
      - zion-network

  redis:
    image: redis:7-alpine
    container_name: zion-redis
    restart: always
    volumes:
      - redis_data:/data
    networks:
      - zion-network

  nginx:
    image: nginx:alpine
    container_name: zion-nginx
    restart: always
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./public_html:/var/www/html
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - pool
    networks:
      - zion-network

volumes:
  blockchain_data:
  pool_data:
  redis_data:

networks:
  zion-network:
    driver: bridge
```

---

## 🌐 Multi-Region Setup

### Region: Europe (Helsinki)

```bash
ssh root@77.42.31.72

# Deploy
docker-compose -f docker-compose-v2.9-production.yml up -d

# Configure as EU region
docker exec zion-pool bash -c "
  echo 'REGION=eu' >> /app/.env
  echo 'POOL_NAME=ZION-EU-Helsinki' >> /app/.env
"
```

### Region: US East

```bash
ssh root@5.78.145.234

# Same deployment, different region config
docker exec zion-pool bash -c "
  echo 'REGION=us' >> /app/.env
  echo 'POOL_NAME=ZION-US-East' >> /app/.env
"
```

### Region: Asia (Singapore)

```bash
ssh root@5.223.56.122

docker exec zion-pool bash -c "
  echo 'REGION=asia' >> /app/.env
  echo 'POOL_NAME=ZION-Asia-Singapore' >> /app/.env
"
```

---

## 🔒 Security Hardening

### Firewall Rules

```bash
# UFW setup
ufw default deny incoming
ufw default allow outgoing

# Allow SSH
ufw allow 22/tcp

# Allow Stratum (mining)
ufw allow 3333/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow P2P
ufw allow 30303/tcp
ufw allow 30303/udp

# Enable
ufw enable
```

### SSL/TLS Setup

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d pool.zionterranova.com

# Auto-renewal
certbot renew --dry-run
```

### Rate Limiting (nginx)

```nginx
# /etc/nginx/conf.d/rate_limit.conf
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
limit_conn_zone $binary_remote_addr zone=conn:10m;

server {
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        limit_conn conn 10;
        proxy_pass http://localhost:8001/;
    }
}
```

---

## 📊 Monitoring

### Prometheus + Grafana

```yaml
# docker-compose-monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=secure_password
```

### Health Checks

```bash
# Check all services
./scripts/health_check.sh

# Output:
# ✅ Blockchain: Running (height: 12345)
# ✅ Pool: Running (42 miners connected)
# ✅ Redis: Running
# ✅ API: Running (latency: 15ms)
```

### Log Aggregation

```bash
# View pool logs
docker logs -f zion-pool --tail 100

# View blockchain logs
docker logs -f zion-blockchain --tail 100

# Export to file
docker logs zion-pool > /var/log/zion/pool.log 2>&1
```

---

## 🔄 Backup & Recovery

### Database Backup

```bash
# Backup blockchain data
docker exec zion-blockchain tar -czf /backup/blockchain_$(date +%Y%m%d).tar.gz /var/lib/zion

# Backup pool database
docker exec zion-pool sqlite3 /app/data/pool.db ".backup '/backup/pool_$(date +%Y%m%d).db'"

# Backup Redis
docker exec zion-redis redis-cli BGSAVE
docker cp zion-redis:/data/dump.rdb ./backup/redis_$(date +%Y%m%d).rdb
```

### Automated Backup Script

```bash
#!/bin/bash
# /opt/zion/backup.sh

BACKUP_DIR="/backup/zion"
DATE=$(date +%Y%m%d_%H%M)

mkdir -p $BACKUP_DIR

# Blockchain
docker exec zion-blockchain tar -czf - /var/lib/zion > $BACKUP_DIR/blockchain_$DATE.tar.gz

# Pool DB
docker cp zion-pool:/app/data/pool.db $BACKUP_DIR/pool_$DATE.db

# Config
tar -czf $BACKUP_DIR/config_$DATE.tar.gz ./config

# Cleanup old backups (keep 7 days)
find $BACKUP_DIR -mtime +7 -delete

echo "Backup completed: $DATE"
```

Cron:
```bash
# Daily at 3 AM
0 3 * * * /opt/zion/backup.sh >> /var/log/zion/backup.log 2>&1
```

### Recovery

```bash
# Stop services
docker-compose down

# Restore blockchain
docker run --rm -v blockchain_data:/data -v $(pwd)/backup:/backup alpine \
  tar -xzf /backup/blockchain_20260121.tar.gz -C /data

# Restore pool
docker cp backup/pool_20260121.db zion-pool:/app/data/pool.db

# Restart
docker-compose up -d
```

---

## 🔧 Troubleshooting

### Pool Not Starting

```bash
# Check logs
docker logs zion-pool

# Common issues:
# - Redis not ready: Add depends_on with healthcheck
# - Port in use: Check with `netstat -tlnp | grep 3333`
# - Config error: Validate JSON with `jq . config/pool_config.json`
```

### Miners Can't Connect

```bash
# Test stratum port
telnet pool.zionterranova.com 3333

# Check firewall
ufw status | grep 3333

# Check pool is listening
ss -tlnp | grep 3333
```

### High Stale Rate

```bash
# Check block propagation time
curl http://localhost:8080/stats | jq '.block_propagation_ms'

# If > 500ms, check:
# - Network latency between nodes
# - Blockchain sync status
# - Redis performance
```

---

## 📋 Checklist

### Pre-Launch

- [ ] All services running
- [ ] SSL certificates valid
- [ ] Firewall configured
- [ ] Monitoring active
- [ ] Backups scheduled
- [ ] DNS configured
- [ ] Rate limiting enabled

### Post-Launch

- [ ] Monitor error rates
- [ ] Check miner connections
- [ ] Verify block discovery
- [ ] Test payouts
- [ ] Review logs daily

---

## 📞 Support

- **Technical Issues:** github.com/Yose144/Zion-2.9/issues
- **Security Reports:** security@zionterranova.com
- **DevOps Chat:** Discord #infrastructure

---

**Version:** 2.9.5  
**Last Updated:** January 2026
