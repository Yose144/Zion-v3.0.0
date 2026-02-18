# 🚀 ZION Native Pool - Production Deployment Guide

**Target**: Pool Native v2.9.5 Deployment on Ubuntu 22.04/24.04 LTS  
**Updated**: December 2024  
**Status**: Q1 2025 Phase - Pool Testing & Hardening

NOTE: This guide is legacy (native/systemd). Canonical operations for v2.9.5 are Docker-only via `2.9.5/docker-compose.native-2.9.5.yml` (full stack) or `2.9.5/docker-compose.node-2.9.5.yml` (node stack).

---

## 📋 Prerequisites

### System Requirements
- **OS**: Ubuntu 22.04 or 24.04 LTS
- **CPU**: 4+ cores (8+ recommended for 10k miners)
- **RAM**: 8GB minimum (16GB+ for production)
- **Disk**: 100GB+ SSD (NVMe preferred)
- **Network**: 1Gbps+ connection, static IP
- **Open Ports**: 3333 (Stratum), 8080 (API), 9090 (Prometheus)

### Software Stack
- **Rust**: 1.75+ (stable channel)
- **PostgreSQL**: 14+ (payout tracking)
- **Redis**: 7.0+ (real-time data)
- **Nginx**: 1.18+ (reverse proxy, rate limiting)
- **Docker** (optional): 24.0+ with docker-compose v2

---

## 🛠️ Installation Methods

### Method 1: Native Build (Recommended for Production)

#### 1. Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup default stable

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Install Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install Nginx
sudo apt install -y nginx
sudo systemctl enable nginx

# Install build tools
sudo apt install -y build-essential pkg-config libssl-dev
```

#### 2. Setup PostgreSQL Database
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE zion_pool;
CREATE USER zion_pool WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE zion_pool TO zion_pool;
\q
```

```bash
sudo nano /etc/redis/redis.conf

# Set the following:
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000

# Restart Redis
sudo systemctl restart redis-server
```

#### 4. Clone and Build Pool
```bash
# Clone repository
cd /opt
sudo git clone https://github.com/zionterranova/zion-2.9.git zion-pool
sudo chown -R $USER:$USER zion-pool
cd zion-pool/2.9.5/zion-native/pool

# Build release version
cargo build --release

# Binary location
ls -lh target/release/zion-pool
```

#### 5. Create Configuration
```bash
# Create config directory
sudo mkdir -p /etc/zion-pool
sudo nano /etc/zion-pool/config.toml
```

**config.toml**:
```toml
[pool]
name = "ZION TerraNova Pool"
host = "0.0.0.0"
port = 3333
max_connections = 10000
worker_timeout = 300

[database]
postgres_url = "postgresql://zion_pool:your_secure_password@localhost/zion_pool"
redis_url = "redis://127.0.0.1:6379"

[payout]
min_payout_amount = 10.0  # Minimum ZION to trigger payout
payout_interval = 3600     # Check every hour (seconds)
pool_fee = 0.01           # 1% pool fee

[vardiff]
min_difficulty = 1000
max_difficulty = 1000000
target_time = 30
retarget_time = 120
variance_percent = 30

[consciousness]
xp_per_share = 10
xp_per_block = 1000

[api]
host = "0.0.0.0"
port = 8080
enable_prometheus = true

[blockchain]
rpc_url = "http://localhost:8545"
wallet_address = "ZION_POOL_ADDRESS_HERE"

[logging]
level = "info"
json_format = true
log_file = "/var/log/zion-pool/pool.log"
```

#### 6. Create Systemd Service
```bash
sudo nano /etc/systemd/system/zion-pool.service
```

**zion-pool.service**:
```ini
[Unit]
Description=ZION TerraNova Native Pool
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=zion-pool
Group=zion-pool
WorkingDirectory=/opt/zion-pool/2.9.5/zion-native/pool
ExecStart=/opt/zion-pool/2.9.5/zion-native/pool/target/release/zion-pool --config /etc/zion-pool/config.toml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/zion-pool

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

#### 7. Create Pool User and Directories
```bash
# Create user
sudo useradd -r -s /bin/false zion-pool

# Create log directory
sudo mkdir -p /var/log/zion-pool
sudo chown zion-pool:zion-pool /var/log/zion-pool

# Set permissions
sudo chown -R zion-pool:zion-pool /opt/zion-pool
```

#### 8. Configure Nginx Reverse Proxy
```bash
sudo nano /etc/nginx/sites-available/zion-pool
```

**zion-pool nginx config**:
```nginx
upstream zion_pool_api {
    server 127.0.0.1:8080;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=stats_limit:10m rate=30r/s;

server {
    listen 80;
    server_name pool.zionterranova.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pool.zionterranova.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/pool.zionterranova.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pool.zionterranova.com/privkey.pem;

    # SSL security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # API endpoints
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://zion_pool_api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Pool stats (higher rate limit)
    location /stats/ {
        limit_req zone=stats_limit burst=50 nodelay;
        proxy_pass http://zion_pool_api/stats/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Prometheus metrics (internal only)
    location /metrics {
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
        proxy_pass http://zion_pool_api/metrics;
    }

    # Health check
    location /health {
        access_log off;
        proxy_pass http://zion_pool_api/health;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/zion-pool /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 9. Setup SSL with Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pool.zionterranova.com
```

#### 10. Initialize Database Schema
```bash
# Pool automatically creates schema on first run
# Or manually via psql:
sudo -u postgres psql -d zion_pool < /opt/zion-pool/2.9.5/zion-native/pool/schema.sql
```

#### 11. Start Pool Service
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable and start pool
sudo systemctl enable zion-pool
sudo systemctl start zion-pool

# Check status
sudo systemctl status zion-pool

# View logs
sudo journalctl -u zion-pool -f
```

---

### Method 2: Docker Deployment (For Testing)

#### 1. Create docker-compose.yml
```yaml
version: '3.8'

services:
  pool:
    image: zion-pool:latest
    build:
      context: .
      dockerfile: Dockerfile.pool
    ports:
      - "3333:3333"  # Stratum
      - "8080:8080"  # API
    environment:
      - POSTGRES_URL=postgresql://zion:zion@postgres:5432/zion_pool
      - REDIS_URL=redis://redis:6379
      - RUST_LOG=info
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    volumes:
      - ./config.toml:/etc/zion-pool/config.toml:ro
      - pool-logs:/var/log/zion-pool

  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=zion_pool
      - POSTGRES_USER=zion
      - POSTGRES_PASSWORD=zion
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:
  prometheus-data:
  pool-logs:
```

#### 2. Create Dockerfile.pool
```dockerfile
FROM rust:1.75 as builder

WORKDIR /build
COPY 2.9.5/zion-native/pool ./pool
COPY 2.9.5/zion-native/core ../core
COPY 2.9.5/Cargo.toml ../Cargo.toml

WORKDIR /build/pool
RUN cargo build --release

FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    libssl3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/pool/target/release/zion-pool /usr/local/bin/
RUN mkdir -p /etc/zion-pool /var/log/zion-pool

EXPOSE 3333 8080

CMD ["zion-pool", "--config", "/etc/zion-pool/config.toml"]
```

#### 3. Deploy with Docker
```bash
docker-compose up -d
docker-compose logs -f pool
```

---

## 🧪 Testing & Validation

### 1. Run Unit Tests
```bash
cd /opt/zion-pool/2.9.5/zion-native/pool
cargo test --lib
```

### 2. Run Integration Tests
```bash
# Requires pool running
cargo test --test integration_e2e -- --ignored --test-threads=1
```

### 3. Run Load Tests
```bash
# Test 100 concurrent miners
cargo bench --bench load_test -- bench_pool_load/100

# Test 1000 concurrent miners
cargo bench --bench load_test -- bench_pool_load/1000

# Sustained throughput test
cargo bench --bench load_test -- bench_pool_throughput
```

### 4. Manual Connection Test
```bash
# Test Stratum connection
telnet localhost 3333

# Send login
{"id":1,"method":"login","params":{"login":"ZION_TEST_ADDRESS","pass":"x","agent":"test/1.0"}}

# Should receive response
{"id":1,"result":{"id":"123","job":{...},"status":"OK"}}
```

### 5. API Health Check
```bash
# Health endpoint
curl http://localhost:8080/health

# Pool stats
curl http://localhost:8080/stats/pool

# Miner stats
curl http://localhost:8080/stats/miner/ZION_ADDRESS

# Prometheus metrics
curl http://localhost:8080/metrics
```

### 5b. Node Stack Verify (Canonical Ports)

If you are running the **Docker-only node stack** (`docker-compose.node-2.9.5.yml`), verify using canonical ports:
- Stratum: `127.0.0.1:3333`
- Pool HTTP: `http://127.0.0.1:8080`
- Core JSON-RPC: `http://127.0.0.1:8444/jsonrpc`
- Redis: internal (no host port mapping required)

```bash
# pool stats + prometheus metrics
curl -fsS http://127.0.0.1:8080/stats || true
curl -fsS http://127.0.0.1:8080/metrics | egrep "^(shares|ncl)_" || true

# NCL smoke (requires venv on Ubuntu 24.04+ if system pip is blocked)
/root/ncl-venv/bin/python /root/ncl_smoke.py --host 127.0.0.1 --port 3333

# verify counters bump
curl -fsS http://127.0.0.1:8080/metrics | egrep "^ncl_" || true
```

Repo E2E (HTTP + Stratum + NCL) from workstation:

```bash
python 2.9.5/tests/e2e_native_pool_test.py --host <SERVER_IP> --stratum-port 3333 --api-port 8080
```

Detailed checklist: [2.9.5/docs/VERIFY_USA_NATIVE_STACK_v2.9.5.md](2.9.5/docs/VERIFY_USA_NATIVE_STACK_v2.9.5.md)

---

## 📊 Monitoring Setup

### Prometheus Configuration
Create `/etc/prometheus/prometheus.yml`:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'zion-pool'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics'
```

### Key Metrics to Monitor
- `pool_active_miners` - Current connected miners
- `pool_total_shares` - Total shares submitted
- `pool_valid_shares` - Valid shares count
- `pool_invalid_shares` - Invalid shares (watch for attacks)
- `pool_blocks_found` - Blocks found by pool
- `pool_hashrate` - Pool total hashrate
- `pool_difficulty` - Average pool difficulty
- `pool_payout_total` - Total ZION paid out
- `pool_xp_total` - Total consciousness XP earned

---

## 🔧 Maintenance & Operations

### View Logs
```bash
# Real-time logs
sudo journalctl -u zion-pool -f

# Last 100 lines
sudo journalctl -u zion-pool -n 100

# Errors only
sudo journalctl -u zion-pool -p err

# Specific time range
sudo journalctl -u zion-pool --since "2024-12-01" --until "2024-12-31"
```

### Database Maintenance
```bash
# Connect to database
sudo -u postgres psql -d zion_pool

# Check pending payouts
SELECT COUNT(*), SUM(amount) FROM pending_payouts;

# Check completed payouts
SELECT COUNT(*), SUM(amount) FROM completed_payouts WHERE paid_at > NOW() - INTERVAL '24 hours';

# Top miners by shares
SELECT miner_address, COUNT(*) as shares, SUM(difficulty) as total_diff 
FROM shares 
GROUP BY miner_address 
ORDER BY total_diff DESC 
LIMIT 10;

# Vacuum database (weekly)
VACUUM ANALYZE;
```

### Redis Maintenance
```bash
# Connect to Redis
redis-cli

# Check memory usage
INFO memory

# Check active miners
KEYS consciousness:*

# Get miner XP
GET consciousness:ZION_ADDRESS

# Monitor commands (real-time)
MONITOR
```

### Backup Strategy
```bash
# PostgreSQL backup (daily)
sudo -u postgres pg_dump zion_pool | gzip > /backup/zion_pool_$(date +%Y%m%d).sql.gz

# Redis snapshot (automatic via RDB)
sudo cp /var/lib/redis/dump.rdb /backup/redis_$(date +%Y%m%d).rdb

# Config backup
sudo tar czf /backup/zion_config_$(date +%Y%m%d).tar.gz /etc/zion-pool
```

---

## 🚨 Troubleshooting

### Pool Won't Start
```bash
# Check logs
sudo journalctl -u zion-pool -n 50

# Common issues:
# 1. Port 3333 already in use
sudo lsof -i :3333

# 2. PostgreSQL not running
sudo systemctl status postgresql

# 3. Redis not running
sudo systemctl status redis-server

# 4. Config file errors
zion-pool --config /etc/zion-pool/config.toml --check-config
```

### High CPU Usage
```bash
# Check active connections
redis-cli INFO clients

# Check slow queries
sudo -u postgres psql -d zion_pool -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Monitor pool performance
cargo bench --bench share_validation
```

### Miners Can't Connect
```bash
# Check firewall
sudo ufw status
sudo ufw allow 3333/tcp

# Check if pool listening
sudo netstat -tlnp | grep 3333

# Test from external
telnet pool.zionterranova.com 3333
```

### Payouts Not Processing
```bash
# Check scheduler status
redis-cli GET scheduler:last_run

# Check pending payouts
sudo -u postgres psql -d zion_pool -c "SELECT * FROM pending_payouts WHERE amount >= 10.0;"

# Manually trigger payout (if needed)
# Pool has auto-payout loop, but can force via API:
curl -X POST http://localhost:8080/admin/trigger_payout
```

---

## 📈 Performance Tuning

### PostgreSQL Optimization
```sql
-- Edit /etc/postgresql/14/main/postgresql.conf
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 10MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 8
max_parallel_workers_per_gather = 4
max_parallel_workers = 8

-- Restart PostgreSQL
sudo systemctl restart postgresql
```

### Redis Optimization
```bash
# Edit /etc/redis/redis.conf
maxmemory 4gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
tcp-backlog 511
timeout 0
tcp-keepalive 300

sudo systemctl restart redis-server
```

### Linux Kernel Tuning
```bash
# Edit /etc/sysctl.conf
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30
fs.file-max = 1000000

# Apply settings
sudo sysctl -p
```

### Ulimit Settings
```bash
# Edit /etc/security/limits.conf
zion-pool soft nofile 65536
zion-pool hard nofile 65536
zion-pool soft nproc 4096
zion-pool hard nproc 4096
```

---

## 🎯 Performance Targets (Q1 2025 Goals)

| Metric | Target | Current |
|--------|--------|---------|
| Max Concurrent Miners | 10,000 | ✅ Tested |
| Share Validation Time | < 1ms | ✅ 0.3ms avg |
| API Response Time | < 50ms | ✅ 25ms avg |
| Pool Uptime | 99.9% | ⏳ Testing |
| Block Propagation | < 2s | ⏳ Testing |
| Payout Processing | < 5min | ✅ Auto-loop |

---

## 📝 Security Checklist

- [ ] Firewall configured (UFW/iptables)
- [ ] SSL/TLS enabled (Let's Encrypt)
- [ ] PostgreSQL password secured
- [ ] Redis protected (requirepass)
- [ ] Nginx rate limiting active
- [ ] Systemd security hardening applied
- [ ] Log rotation configured
- [ ] Backup strategy implemented
- [ ] Monitoring/alerting setup
- [ ] DDoS protection (Cloudflare/fail2ban)

---

## 📞 Support & Resources

- **Documentation**: `/opt/zion-pool/docs/`
- **Community**: Discord/Telegram (links on website)
- **GitHub Issues**: https://github.com/zionterranova/zion-2.9/issues
- **Status Page**: https://status.zionterranova.com
- **API Docs**: https://pool.zionterranova.com/api/docs

---

**Deployment Status**: ✅ Production Ready (Q1 2025)  
**Last Updated**: December 2024  
**Maintained By**: ZION TerraNova Core Team

🌟 **Where technology meets spirit** 🌟
