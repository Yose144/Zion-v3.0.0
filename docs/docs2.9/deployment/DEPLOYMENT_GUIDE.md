# ZION Deployment Guide

Kompletní průvodce pro deployment ZION mining pool a blockchain platformy do produkčního prostředí.

## 📋 Obsah

- [Prerekvizity](#prerekvizity)
- [Příprava serveru](#příprava-serveru)
- [Instalace závislostí](#instalace-závislostí)
- [Deployment pomocí Docker](#deployment-pomocí-docker)
- [Deployment ze zdrojů](#deployment-ze-zdrojů)
- [Konfigurace](#konfigurace)
- [SSL/TLS setup](#ssltls-setup)
- [Monitoring setup](#monitoring-setup)
- [Backup strategie](#backup-strategie)
- [Scaling](#scaling)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

---

## Prerekvizity

### Hardwarové požadavky

**Minimální (Testnet):**
- CPU: 4 cores (2.5 GHz+)
- RAM: 8 GB
- Disk: 50 GB SSD
- Network: 100 Mbps

**Doporučené (Production):**
- CPU: 8+ cores (3.0 GHz+)
- RAM: 16 GB
- Disk: 200 GB NVMe SSD
- Network: 1 Gbps

**Enterprise (High-load):**
- CPU: 16+ cores (3.5 GHz+)
- RAM: 32+ GB
- Disk: 500 GB NVMe SSD (RAID 10)
- Network: 10 Gbps

### Softwarové požadavky

- Ubuntu 22.04 LTS nebo Debian 12 (doporučeno)
- Python 3.11+
- Docker 24.0+ & Docker Compose 2.20+
- Git 2.40+
- Nginx 1.24+
- Redis 7.0+
- PostgreSQL 15+ (volitelné, pro vyšší výkon místo SQLite)

---

## Příprava serveru

### 1. Update systému

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y \
    build-essential \
    curl \
    wget \
    git \
    vim \
    htop \
    net-tools \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release
```

### 2. Konfigurace firewall

```bash
# Install UFW (pokud ještě není nainstalován)
sudo apt install -y ufw

# Povolit SSH
sudo ufw allow 22/tcp

# Povolit HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Povolit API port
sudo ufw allow 8000/tcp

# Povolit Stratum mining port (pokud provozujete pool)
sudo ufw allow 3333/tcp

# Povolit P2P port (blockchain node)
sudo ufw allow 8333/tcp

# Enable firewall
sudo ufw --force enable

# Verify status
sudo ufw status verbose
```

### 3. Konfigurace swap (doporučeno pro servery s <16GB RAM)

```bash
# Check current swap
free -h

# Create 8GB swap file
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimize swap usage
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
```

### 4. Optimalizace síťových parametrů

```bash
# Increase max connections
sudo tee -a /etc/sysctl.conf <<EOF
# ZION Network Optimizations
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
EOF

# Apply changes
sudo sysctl -p
```

---

## Instalace závislostí

### 1. Python 3.11

```bash
# Add deadsnakes PPA
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update

# Install Python 3.11
sudo apt install -y python3.11 python3.11-venv python3.11-dev

# Verify installation
python3.11 --version
```

### 2. Docker & Docker Compose

```bash
# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Enable Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Verify installation
docker --version
docker compose version
```

### 3. Redis

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis
sudo sed -i 's/supervised no/supervised systemd/' /etc/redis/redis.conf
sudo sed -i 's/bind 127.0.0.1 ::1/bind 127.0.0.1/' /etc/redis/redis.conf

# Set password (IMPORTANT!)
REDIS_PASSWORD=$(openssl rand -base64 32)
echo "requirepass $REDIS_PASSWORD" | sudo tee -a /etc/redis/redis.conf
echo "Redis password: $REDIS_PASSWORD" > ~/redis_password.txt
chmod 600 ~/redis_password.txt

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Verify
redis-cli ping
# Should return: PONG
```

### 4. Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Enable Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Verify
sudo systemctl status nginx
```

---

## Deployment pomocí Docker

### 1. Clone repository

```bash
# Create deployment directory
sudo mkdir -p /opt/zion
sudo chown $USER:$USER /opt/zion
cd /opt/zion

# Clone repository
git clone https://github.com/Yose144/Zion-2.9.git .

# Checkout specific version (pro production)
git checkout tags/v2.8.9
```

### 2. Konfigurace environment

```bash
# Create .env file
cat > .env <<EOF
# Environment
NODE_ENV=production

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=4

# Database
DB_PATH=/data/zion.db
HISTORICAL_DB_PATH=/data/historical_stats.db

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=${REDIS_PASSWORD}

# WebSocket
WS_MAX_CONNECTIONS=1000
WS_HEARTBEAT_INTERVAL=30

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# Security
SECRET_KEY=$(openssl rand -hex 32)
API_KEY=$(openssl rand -hex 32)
EOF

# Secure .env file
chmod 600 .env
```

### 3. Build Docker images

```bash
# Build production image
cd deployment
docker compose -f docker-compose.2.8.7-production.yml build

# Verify images
docker images | grep zion
```

### 4. Start services

```bash
# Start all services
docker compose -f docker-compose.2.8.7-production.yml up -d

# Verify services are running
docker compose -f docker-compose.2.8.7-production.yml ps

# Check logs
docker compose -f docker-compose.2.8.7-production.yml logs -f
```

### 5. Verify deployment

```bash
# Health check
curl http://localhost:8000/health

# API status
curl http://localhost:8000/v2.8.8/health

# Prometheus metrics
curl http://localhost:8000/metrics

# Expected output: {"status":"healthy","version":"2.8.9"}
```

---

## Deployment ze zdrojů

### 1. Clone a setup

```bash
# Create deployment directory
sudo mkdir -p /opt/zion
sudo chown $USER:$USER /opt/zion
cd /opt/zion

# Clone repository
git clone https://github.com/Yose144/Zion-2.9.git .
git checkout tags/v2.8.9

# Create virtual environment
python3.11 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Konfigurace

```bash
# Create configuration
cp .env.example .env
nano .env  # Edit configuration

# Create data directories
mkdir -p data logs

# Initialize database
python -c "from src.database.historical_stats import historical_db; print('DB initialized')"
```

### 3. Systemd service

```bash
# Create systemd service
sudo tee /etc/systemd/system/zion-api.service <<EOF
[Unit]
Description=ZION API Server
After=network.target redis-server.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/zion
Environment="PATH=/opt/zion/.venv/bin"
ExecStart=/opt/zion/.venv/bin/uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=10

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/zion/data /opt/zion/logs

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable zion-api
sudo systemctl start zion-api

# Check status
sudo systemctl status zion-api

# View logs
sudo journalctl -u zion-api -f
```

---

## SSL/TLS Setup

### 1. Certbot instalace

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (nahraďte yourdomain.com)
sudo certbot --nginx -d api.zionterranova.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

### 2. Nginx konfigurace

```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/zion-api <<EOF
# Rate limiting
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=10r/s;

upstream zion_api {
    server 127.0.0.1:8000;
    keepalive 32;
}

server {
    listen 80;
    server_name api.zionterranova.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.zionterranova.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.zionterranova.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.zionterranova.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/zion-api-access.log;
    error_log /var/log/nginx/zion-api-error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # API endpoints
    location / {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://zion_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket endpoint
    location /v2.8.8/ws/ {
        proxy_pass http://zion_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }

    # Metrics endpoint (restrict access)
    location /metrics {
        allow 127.0.0.1;
        deny all;
        proxy_pass http://zion_api;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/zion-api /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Monitoring Setup

### 1. Prometheus

```bash
# Create Prometheus directory
sudo mkdir -p /etc/prometheus
sudo mkdir -p /var/lib/prometheus

# Create Prometheus config
sudo tee /etc/prometheus/prometheus.yml <<EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: []

rule_files:
  - "alerts.yml"

scrape_configs:
  - job_name: 'zion-api'
    static_configs:
      - targets: ['localhost:8000']
EOF

# Copy alerts
sudo cp deployment/prometheus/alerts.yml /etc/prometheus/

# Run Prometheus (Docker)
docker run -d \
  --name prometheus \
  --network host \
  -v /etc/prometheus:/etc/prometheus \
  -v /var/lib/prometheus:/prometheus \
  --restart unless-stopped \
  prom/prometheus:latest \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/prometheus
```

### 2. Grafana

```bash
# Run Grafana (Docker)
docker run -d \
  --name grafana \
  -p 3000:3000 \
  -v grafana-storage:/var/lib/grafana \
  -e "GF_SECURITY_ADMIN_PASSWORD=<STRONG_PASSWORD>" \
  --restart unless-stopped \
  grafana/grafana:latest

# Import dashboard
# 1. Visit http://yourserver:3000
# 2. Login (admin / password from above)
# 3. Add Prometheus data source (http://localhost:9090)
# 4. Import deployment/grafana-dashboards/pool-overview.json
```

### 3. Log aggregation (volitelné)

```bash
# Install Loki & Promtail pro log aggregation
# Viz: https://grafana.com/docs/loki/latest/installation/
```

---

## Backup Strategie

### 1. Database backup

```bash
# Create backup script
cat > /opt/zion/scripts/backup.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/opt/zion/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup databases
cp /opt/zion/data/zion.db $BACKUP_DIR/zion_${DATE}.db
cp /opt/zion/data/historical_stats.db $BACKUP_DIR/historical_${DATE}.db

# Backup configuration
cp /opt/zion/.env $BACKUP_DIR/env_${DATE}.bak

# Compress
tar -czf $BACKUP_DIR/backup_${DATE}.tar.gz $BACKUP_DIR/*_${DATE}.*
rm $BACKUP_DIR/*_${DATE}.db $BACKUP_DIR/*_${DATE}.bak

# Remove backups older than 30 days
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +30 -delete

echo "Backup completed: backup_${DATE}.tar.gz"
EOF

chmod +x /opt/zion/scripts/backup.sh
```

### 2. Automatické backupy

```bash
# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/zion/scripts/backup.sh >> /opt/zion/logs/backup.log 2>&1") | crontab -
```

### 3. Offsite backup (doporučeno)

```bash
# Sync to S3 (příklad)
aws s3 sync /opt/zion/backups s3://your-bucket/zion-backups/ --delete
```

---

## Scaling

### Horizontal scaling (Load balancing)

```nginx
# Nginx load balancer config
upstream zion_cluster {
    least_conn;
    server server1.zion.com:8000 weight=1 max_fails=3 fail_timeout=30s;
    server server2.zion.com:8000 weight=1 max_fails=3 fail_timeout=30s;
    server server3.zion.com:8000 weight=1 max_fails=3 fail_timeout=30s;
    keepalive 32;
}
```

### Database scaling

```bash
# Migrate to PostgreSQL for better performance
# Update .env:
DATABASE_URL=postgresql://user:pass@localhost/zion

# Run migration
python scripts/migrate_to_postgres.py
```

---

## Troubleshooting

### Service not starting

```bash
# Check logs
sudo journalctl -u zion-api -n 100 --no-pager

# Check port
sudo lsof -i :8000

# Check permissions
ls -la /opt/zion/data/
```

### High memory usage

```bash
# Check memory
free -h

# Restart services
sudo systemctl restart zion-api

# Reduce workers
# Edit /etc/systemd/system/zion-api.service
# Change --workers 4 to --workers 2
```

### Database locked

```bash
# Enable WAL mode
sqlite3 /opt/zion/data/zion.db "PRAGMA journal_mode=WAL;"
```

---

## Maintenance

### Regular tasks

```bash
# Weekly: Update dependencies
cd /opt/zion
source .venv/bin/activate
pip list --outdated
pip install --upgrade <package>

# Monthly: Vacuum database
sqlite3 /opt/zion/data/zion.db "VACUUM;"

# Monthly: Review logs
journalctl --vacuum-time=30d
```

### Updates

```bash
# Backup before update
/opt/zion/scripts/backup.sh

# Pull latest version
cd /opt/zion
git fetch --tags
git checkout tags/v2.8.9

# Update dependencies
source .venv/bin/activate
pip install -r requirements.txt

# Restart service
sudo systemctl restart zion-api
```

---

**Production deployment úspěšný! 🚀**

Pro další pomoc kontaktujte: admin@zionterranova.com
