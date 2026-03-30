# 🚀 Production Deployment Guide - ZION Universal Miner

Complete guide for deploying ZION miner in production environments.

## 📋 Table of Contents

- [System Requirements](#system-requirements)
- [Installation Methods](#installation-methods)
- [Configuration](#configuration)
- [Systemd Service](#systemd-service)
- [Docker Deployment](#docker-deployment)
- [Monitoring & Alerts](#monitoring--alerts)
- [Security Hardening](#security-hardening)
- [Performance Tuning](#performance-tuning)
- [Troubleshooting](#troubleshooting)

## 💻 System Requirements

### Minimum Requirements

| Component | Specification |
|-----------|---------------|
| **CPU** | 2 cores, 2 GHz |
| **RAM** | 4 GB (8 GB for RandomX) |
| **Storage** | 1 GB free space |
| **Network** | 1 Mbps stable connection |
| **OS** | Linux (Ubuntu 20.04+), macOS 11+, Windows 10+ |

### Recommended Requirements

| Component | Specification |
|-----------|---------------|
| **CPU** | 8+ cores, 3+ GHz |
| **RAM** | 16 GB+ |
| **GPU** | NVIDIA RTX 30/40 series or AMD RX 6000/7000 |
| **Storage** | 10 GB SSD |
| **Network** | 10 Mbps fiber/cable |

## 📦 Installation Methods

### Method 1: Pre-built Binary (Recommended)

```bash
# Download latest release
wget https://github.com/Yose144/Zion-2.9/releases/latest/download/zion-miner-linux-x64.tar.gz

# Extract
tar xzf zion-miner-linux-x64.tar.gz

# Install to system
sudo mv zion-miner-linux-x64 /usr/local/bin/zion-miner
sudo chmod +x /usr/local/bin/zion-miner

# Verify installation
zion-miner --version
```

### Method 2: Build from Source

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Clone repository
git clone https://github.com/Yose144/Zion-2.9.git
cd Zion-2.9/2.9.5/zion-native

# Build optimized release
cargo build --release

# Install
sudo cp target/release/zion-miner /usr/local/bin/
```

### Method 3: Docker (Isolated)

```bash
# Pull image
docker pull ghcr.io/yose144/zion-miner:latest

# Or build locally
docker build -t zion-miner:latest .
```

## ⚙️ Configuration

### Create Configuration File

```bash
# Create config directory
mkdir -p ~/.zion

# Generate default config
zion-miner --generate-config > ~/.zion/miner-config.json

# Edit configuration
nano ~/.zion/miner-config.json
```

### Example Production Config

```json
{
  "pool": {
    "url": "stratum+tcp://pool.zionterranova.com:3333",
    "backup_urls": [
      "stratum+tcp://eu.pool.zionterranova.com:3333",
      "stratum+tcp://us.pool.zionterranova.com:3333"
    ],
    "wallet": "ZION_YOUR_PRODUCTION_WALLET_ADDRESS",
    "worker": "production-rig-01",
    "reconnect_attempts": 10,
    "reconnect_delay_secs": 30
  },
  "mining": {
    "algorithm": "cosmic_harmony",
    "auto_switch": false,
    "difficulty": null
  },
  "hardware": {
    "cpu_threads": 0,
    "gpu_enabled": true,
    "gpu_devices": [0],
    "gpu_intensity": 20,
    "cpu_affinity": []
  },
  "logging": {
    "level": "info",
    "no_color": false,
    "quiet": false,
    "log_file": "/var/log/zion-miner/miner.log"
  }
}
```

## 🔄 Systemd Service (Linux)

### Create Service File

```bash
sudo nano /etc/systemd/system/zion-miner.service
```

```ini
[Unit]
Description=ZION Universal Miner
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=miner
Group=miner
WorkingDirectory=/home/miner
ExecStart=/usr/local/bin/zion-miner --config /home/miner/.zion/miner-config.json
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

# Security hardening
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
NoNewPrivileges=true
ReadWritePaths=/home/miner/.zion /var/log/zion-miner

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

### Enable and Start Service

```bash
# Create miner user
sudo useradd -r -s /bin/false miner
sudo mkdir -p /home/miner/.zion
sudo chown -R miner:miner /home/miner

# Create log directory
sudo mkdir -p /var/log/zion-miner
sudo chown miner:miner /var/log/zion-miner

# Enable service
sudo systemctl daemon-reload
sudo systemctl enable zion-miner.service
sudo systemctl start zion-miner.service

# Check status
sudo systemctl status zion-miner.service

# View logs
sudo journalctl -u zion-miner.service -f
```

## 🐳 Docker Deployment

### Dockerfile

```dockerfile
FROM rust:1.75-slim as builder

WORKDIR /build
COPY . .

# Build miner
RUN cd 2.9.5/zion-native && \
    cargo build --release && \
    strip target/release/zion-miner

FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        libssl3 && \
    rm -rf /var/lib/apt/lists/*

# Create miner user
RUN useradd -r -s /bin/false miner

# Copy binary
COPY --from=builder /build/2.9.5/zion-native/target/release/zion-miner /usr/local/bin/

# Create directories
RUN mkdir -p /home/miner/.zion /var/log/zion-miner && \
    chown -R miner:miner /home/miner /var/log/zion-miner

USER miner
WORKDIR /home/miner

ENTRYPOINT ["/usr/local/bin/zion-miner"]
CMD ["--config", "/home/miner/.zion/miner-config.json"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  zion-miner:
    image: zion-miner:latest
    container_name: zion-miner
    restart: unless-stopped
    
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '8'
          memory: 16G
        reservations:
          cpus: '4'
          memory: 8G
    
    # GPU support (NVIDIA)
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=0
    
    # Configuration
    volumes:
      - ./config/miner-config.json:/home/miner/.zion/miner-config.json:ro
      - miner-logs:/var/log/zion-miner
      - miner-data:/home/miner/.zion/data
    
    # Networking
    network_mode: host
    
    # Logging
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"

volumes:
  miner-logs:
  miner-data:
```

### Run with Docker

```bash
# Build image
docker-compose build

# Start miner
docker-compose up -d

# View logs
docker-compose logs -f

# Stop miner
docker-compose down
```

## 📊 Monitoring & Alerts

### Prometheus Metrics (Future)

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'zion-miner'
    static_configs:
      - targets: ['localhost:8080']
```

### Grafana Dashboard (Future)

- Hashrate over time
- Share acceptance rate
- GPU temperature & power
- Network latency to pool

### Health Check Script

```bash
#!/bin/bash
# health-check.sh

MINER_PID=$(pgrep zion-miner)

if [ -z "$MINER_PID" ]; then
    echo "CRITICAL: Miner not running"
    systemctl restart zion-miner.service
    exit 2
fi

# Check if miner is mining (hashrate > 0)
HASHRATE=$(journalctl -u zion-miner.service -n 50 | grep -oP 'Hashrate: \K[0-9.]+' | tail -1)

if [ -z "$HASHRATE" ] || (( $(echo "$HASHRATE < 1" | bc -l) )); then
    echo "WARNING: Low or zero hashrate: $HASHRATE"
    exit 1
fi

echo "OK: Miner running with hashrate $HASHRATE H/s"
exit 0
```

### Cron Job for Monitoring

```bash
# Add to crontab
*/5 * * * * /opt/zion/health-check.sh >> /var/log/zion-miner/health.log 2>&1
```

## 🔒 Security Hardening

### 1. Dedicated User Account

```bash
# Create unprivileged user
sudo useradd -r -s /bin/false -d /opt/zion miner

# Set permissions
sudo chown -R miner:miner /opt/zion
```

### 2. Firewall Rules

```bash
# UFW (Ubuntu)
sudo ufw default deny outgoing
sudo ufw allow out 3333/tcp  # Pool connection
sudo ufw allow out 53/udp    # DNS
sudo ufw enable

# iptables
sudo iptables -P OUTPUT DROP
sudo iptables -A OUTPUT -p tcp --dport 3333 -j ACCEPT
sudo iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
```

### 3. AppArmor Profile (Ubuntu)

```bash
# /etc/apparmor.d/usr.local.bin.zion-miner
#include <tunables/global>

/usr/local/bin/zion-miner {
  #include <abstractions/base>
  #include <abstractions/nameservice>

  /usr/local/bin/zion-miner r,
  /home/miner/.zion/** rw,
  /var/log/zion-miner/** rw,
  
  # Network
  network inet stream,
  network inet6 stream,
  
  # Deny everything else
  deny /** wx,
}
```

### 4. SELinux Policy (RHEL/CentOS)

```bash
# Create custom policy
semodule -i zion-miner.pp
```

## ⚡ Performance Tuning

### CPU Optimization

```bash
# Disable CPU frequency scaling
sudo cpupower frequency-set -g performance

# Set CPU affinity (cores 0-7)
taskset -c 0-7 zion-miner --threads 8

# Increase process priority
sudo nice -n -10 su miner -c "zion-miner --config ..."
```

### Memory Optimization

```bash
# Increase memory limits
ulimit -l unlimited
ulimit -s 65536

# Configure huge pages (for RandomX)
echo 1280 | sudo tee /proc/sys/vm/nr_hugepages
```

### GPU Optimization

See [GPU_MINING_GUIDE.md](../zion-universal-miner/GPU_MINING_GUIDE.md)

## 🐛 Troubleshooting

### Miner Won't Start

```bash
# Check binary
zion-miner --version

# Check permissions
ls -la /usr/local/bin/zion-miner

# Check config
zion-miner --config ~/.zion/miner-config.json --validate

# Check logs
sudo journalctl -u zion-miner.service -n 100
```

### Low Hashrate

```bash
# Check CPU usage
top -H -p $(pgrep zion-miner)

# Check thermal throttling
sensors

# Check system load
uptime
```

### Connection Issues

```bash
# Test pool connectivity
telnet pool.zionterranova.com 3333

# Check DNS
nslookup pool.zionterranova.com

# Check firewall
sudo iptables -L -v -n
```

## 📞 Support

- **Documentation**: [docs.zionterranova.com](https://docs.zionterranova.com)
- **Discord**: [discord.gg/zionterranova](https://discord.gg/zionterranova)
- **GitHub Issues**: [github.com/Yose144/Zion-2.9/issues](https://github.com/Yose144/Zion-2.9/issues)

---

**Happy Mining in Production!** 🚀⛏️💎
