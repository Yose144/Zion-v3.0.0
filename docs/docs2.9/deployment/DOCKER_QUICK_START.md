# ZION 2.8.3 Testnet - Docker Quick Start

**Version:** 2.8.3 "Terra Nova"  
**Platform:** Docker (Linux, macOS, Windows)  
**Updated:** October 29, 2025  

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- 5 GB free disk space
- Ports 8545, 8333, 3333 available

### 1. Clone Repository
```bash
git clone https://github.com/estrelaisabellazion3/Zion-2.8.git
cd Zion-2.8
```

### 2. Start ZION Node
```bash
# Start node only
docker-compose -f docker-compose.testnet.yml up -d zion-node

# Or start node + mining pool
docker-compose -f docker-compose.testnet.yml up -d zion-node zion-pool
```

### 3. Verify Status
```bash
# Check logs
docker-compose -f docker-compose.testnet.yml logs -f zion-node

# Check RPC endpoint
curl http://localhost:8545/api/status
```

### 4. Stop Services
```bash
docker-compose -f docker-compose.testnet.yml down
```

## 📦 What's Included

### zion-node
Full blockchain node with WARP Engine:
- **Image:** `zionterranova/zion-node:2.8.3`
- **Ports:** 8545 (RPC), 8333 (P2P)
- **Data:** Persistent volumes for blockchain data
- **Size:** ~500 MB (compressed)

### zion-pool (Optional)
Mining pool service:
- **Image:** `zionterranova/zion-pool:2.8.3`
- **Port:** 3333 (Stratum)
- **Connects to:** zion-node RPC

### Monitoring (Optional)
Prometheus + Grafana stack:
- **Prometheus:** Port 9090
- **Grafana:** Port 3000 (default password: zion_admin_change_me)

## 🔧 Configuration

### Environment Variables

**Node Configuration:**
```yaml
environment:
  - ZION_RPC_PORT=8545
  - ZION_P2P_PORT=8333
  - ZION_NETWORK=testnet
  - ZION_DATA_DIR=/data/blockchain
```

**Pool Configuration:**
```yaml
environment:
  - ZION_POOL_PORT=3333
  - ZION_RPC_HOST=zion-node
  - ZION_RPC_PORT=8545
```

### Custom Configuration

Edit `docker-compose.testnet.yml`:
```yaml
services:
  zion-node:
    ports:
      - "8545:8545"  # Change left side for host port
    volumes:
      - ./my-blockchain:/data/blockchain  # Use local directory
```

## 📊 Monitoring Setup

### Enable Monitoring
```bash
# Start with monitoring
docker-compose -f docker-compose.testnet.yml --profile monitoring up -d

# Access Grafana
open http://localhost:3000
# Login: admin / zion_admin_change_me
```

### Prometheus Metrics
```bash
# View metrics
curl http://localhost:9090/metrics

# Check targets
open http://localhost:9090/targets
```

## 🔍 Troubleshooting

### Check Container Status
```bash
docker-compose -f docker-compose.testnet.yml ps
```

### View Logs
```bash
# Node logs
docker-compose -f docker-compose.testnet.yml logs -f zion-node

# Pool logs
docker-compose -f docker-compose.testnet.yml logs -f zion-pool

# All logs
docker-compose -f docker-compose.testnet.yml logs -f
```

### Restart Services
```bash
docker-compose -f docker-compose.testnet.yml restart zion-node
```

### Reset Everything
```bash
# Stop and remove containers + volumes
docker-compose -f docker-compose.testnet.yml down -v

# Remove images
docker rmi zionterranova/zion-node:2.8.3
```

## 🌐 Network Access

### Connect from Host
```bash
# RPC API
curl http://localhost:8545/api/status

# CLI from host
docker exec -it zion-node python cli_simple.py node --status
```

### Connect from Other Containers
```yaml
services:
  my-miner:
    environment:
      - ZION_NODE=zion-node:8545
    networks:
      - zion-testnet
```

## 💾 Data Persistence

### Volumes
```bash
# List volumes
docker volume ls | grep zion

# Backup blockchain data
docker run --rm -v zion-blockchain:/data -v $(pwd):/backup \
  alpine tar czf /backup/blockchain-backup.tar.gz /data

# Restore blockchain data
docker run --rm -v zion-blockchain:/data -v $(pwd):/backup \
  alpine tar xzf /backup/blockchain-backup.tar.gz -C /
```

## 🔐 Security

### Production Recommendations

**1. Change Default Passwords:**
```yaml
grafana:
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=your_secure_password
```

**2. Restrict Ports:**
```yaml
ports:
  - "127.0.0.1:8545:8545"  # Localhost only
```

**3. Use Secrets:**
```bash
# Create .env file
echo "GRAFANA_PASSWORD=secure_pass" > .env

# Reference in compose
environment:
  - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
```

## 🏗️ Building Custom Image

### Build Locally
```bash
# Build image
docker build -f Dockerfile.testnet -t my-zion:latest .

# Update compose file
services:
  zion-node:
    image: my-zion:latest
```

### Multi-Architecture Build
```bash
# Setup buildx
docker buildx create --use

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f Dockerfile.testnet \
  -t zionterranova/zion-node:2.8.3 \
  --push .
```

## 📈 Performance Tuning

### Resource Limits
```yaml
services:
  zion-node:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

### Optimize Volume Performance
```yaml
volumes:
  zion-blockchain:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /fast/ssd/path
```

## 🧪 Development Mode

### Development Override
Create `docker-compose.override.yml`:
```yaml
version: '3.8'
services:
  zion-node:
    volumes:
      - ./src:/app/src:ro  # Live code reload
    environment:
      - ZION_DEBUG=true
```

### Use Override
```bash
# Automatically uses override file
docker-compose -f docker-compose.testnet.yml up -d
```

## 📋 Commands Reference

### Common Operations
```bash
# Start
docker-compose -f docker-compose.testnet.yml up -d

# Stop
docker-compose -f docker-compose.testnet.yml down

# Restart
docker-compose -f docker-compose.testnet.yml restart

# Update images
docker-compose -f docker-compose.testnet.yml pull
docker-compose -f docker-compose.testnet.yml up -d

# Scale (if needed)
docker-compose -f docker-compose.testnet.yml up -d --scale zion-node=3

# Execute commands
docker-compose -f docker-compose.testnet.yml exec zion-node python cli_simple.py --help
```

## 🆘 Support

**Issues:** https://github.com/estrelaisabellazion3/Zion-2.8/issues  
**Email:** admin@zionterranova.com  
**Website:** https://zionterranova.com  

---

**ZION 2.8.3 "Terra Nova" Testnet**  
*Easy blockchain deployment with Docker*
