# ZION Cryptocurrency - Mainnet Launch Guide

> ⚠️ **LEGACY DOKUMENT (není pro v2.9.5 native)**
>
> Tento návod je historický (jiné datum/porty/build systém) a **není kanonický pro ZION v2.9.5**.
> Pokud řešíš MainNet/TestNet pro v2.9.5 native stack, použij:
> - Stav reality: [2.9.5/docs/REAL_STATUS_v2.9.5.md](../../2.9.5/docs/REAL_STATUS_v2.9.5.md)
> - Port matrix: [docs/2.9.4/meta/PORT_MATRIX_TESTNET_v2.9.5.md](../2.9.4/meta/PORT_MATRIX_TESTNET_v2.9.5.md)
> - MainNet readiness: [docs/2.9.4/roadmaps/MAINNET_READINESS_v2.9.5.md](../2.9.4/roadmaps/MAINNET_READINESS_v2.9.5.md)
> - Native compose: [2.9.5/docker-compose.native-2.9.5.yml](../../2.9.5/docker-compose.native-2.9.5.yml)

## 🚀 Official Mainnet Launch

**Launch Date**: December 16, 2024 12:00:00 UTC  
**Genesis Block**: #0  
**Network ID**: zion-mainnet-v1

---

## 📋 Pre-Launch Checklist

### System Requirements
- **OS**: Linux (Ubuntu 20.04+) or macOS 12+
- **CPU**: 4+ cores recommended (RandomX optimized for modern CPUs)
- **RAM**: Minimum 4GB, 8GB recommended for mining
- **Storage**: 50GB+ free space for blockchain data
- **Network**: Stable internet connection, open ports 18080 (P2P) and 18081 (RPC)

### Security Checklist
- [ ] Firewall configured with only necessary ports open
- [ ] System updates installed
- [ ] Secure wallet backup strategy in place
- [ ] Private keys stored offline
- [ ] 2FA enabled on server access (if applicable)

---

## 🛠 Installation

### Quick Install (Recommended)
```bash
# Download and run deployment script
curl -O https://zion.network/deploy.sh
chmod +x deploy.sh
./deploy.sh mainnet
```

### Manual Installation
```bash
# 1. Clone repository
git clone https://github.com/zion-network/zion-cryptocurrency.git
cd zion-cryptocurrency

# 2. Install dependencies
# Ubuntu/Debian:
sudo apt update
sudo apt install -y build-essential cmake libssl-dev libleveldb-dev

# macOS:
brew install cmake openssl leveldb

# 3. Build
mkdir build && cd build
cmake ..
make -j$(nproc)

# 4. Install
sudo make install
```

---

## 🔧 Configuration

### Mainnet Configuration File
Create `~/.zion/config/zion.conf`:

```ini
[network]
network_id = "zion-mainnet-v1"
chain_id = 1
p2p_port = 18080
rpc_port = 18081
max_peers = 50

[blockchain]
genesis_timestamp = 1734355200
genesis_difficulty = 10000
initial_block_reward = 50000000

[mining]
enable_mining = false  # Set true to mine
mining_threads = 0     # 0 = auto-detect
mining_address = ""    # Your ZION address

[security]
enable_ssl = true
max_connections_per_ip = 3
ban_threshold = 100
```

---

## 💼 Wallet Setup

### Create New Wallet
```bash
zion_wallet new
# Save the output securely!
```

### Backup Wallet
```bash
# Backup wallet file
cp ~/.zion/wallets/wallet.dat ~/zion-wallet-backup-$(date +%Y%m%d).dat

# Encrypt backup
openssl enc -aes-256-cbc -salt -in wallet.dat -out wallet.dat.enc
```

### Import Existing Wallet
```bash
zion_wallet import --file=wallet.dat
```

---

## 🌐 Running a Full Node

### Start Node
```bash
# Start daemon
ziond --config=~/.zion/config/zion.conf --daemon

# Check status
ziond status
```

### Systemd Service (Linux)
```bash
# Create service file
sudo nano /etc/systemd/system/ziond.service

[Unit]
Description=ZION Cryptocurrency Daemon
After=network.target

[Service]
Type=simple
User=zion
ExecStart=/usr/local/bin/ziond
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable ziond
sudo systemctl start ziond
```

### Docker Deployment
```bash
# Pull official image
docker pull zionnetwork/ziond:latest

# Run container
docker run -d \
  --name ziond \
  -p 18080:18080 \
  -p 18081:18081 \
  -v ~/.zion:/root/.zion \
  zionnetwork/ziond:latest
```

---

## ⛏ Mining

### Solo Mining
```bash
# Start mining with auto-detected threads
zion_miner --address=YOUR_ZION_ADDRESS

# Specify thread count
zion_miner --address=YOUR_ZION_ADDRESS --threads=8
```

### Pool Mining
```bash
# Connect to mining pool
zion_miner --pool=stratum+tcp://pool.zion.network:3333 \
           --user=YOUR_ZION_ADDRESS \
           --pass=x
```

### Mining Optimization
- **AMD Ryzen**: Enable huge pages for 10-15% performance boost
- **Intel**: Disable hyper-threading for better efficiency
- **Apple Silicon**: Use native ARM build for optimal performance

```bash
# Enable huge pages (Linux)
sudo sysctl -w vm.nr_hugepages=1280
```

---

## 📊 Monitoring

### Node Monitoring
```bash
# Check sync status
ziond getinfo

# View blockchain info
ziond getblockchaininfo

# Monitor peer connections
ziond getpeerinfo

# Check mempool
ziond getmempoolinfo
```

### Performance Metrics
```bash
# System resources
htop

# Network traffic
iftop -i eth0

# Disk usage
df -h ~/.zion

# Log monitoring
tail -f ~/.zion/logs/ziond.log
```

---

## 🔐 Security Best Practices

### Firewall Configuration
```bash
# Ubuntu/Debian
sudo ufw allow 18080/tcp  # P2P
sudo ufw allow 18081/tcp  # RPC (only if needed externally)
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=18080/tcp
sudo firewall-cmd --permanent --add-port=18081/tcp
sudo firewall-cmd --reload
```

### SSL/TLS Setup
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Configure in zion.conf
[security]
enable_ssl = true
ssl_cert = "/path/to/cert.pem"
ssl_key = "/path/to/key.pem"
```

### Cold Storage
```bash
# Generate offline wallet
zion_wallet generate --offline > cold_wallet.txt

# Create paper wallet
qrencode -o wallet_qr.png < cold_wallet.txt
```

---

## 🌍 Network Information

### Official Resources
- **Website**: https://zion.network
- **Explorer**: https://explorer.zion.network
- **GitHub**: https://github.com/zion-network
- **Discord**: https://discord.gg/zion
- **Twitter**: https://twitter.com/zionnetwork

### Seed Nodes
```
seed1.zion.network:18080
seed2.zion.network:18080
seed3.zion.network:18080
45.32.156.78:18080
139.59.234.156:18080
```

### Mining Pools
- **Official Pool**: https://pool.zion.network
- **Community Pool 1**: https://zionpool.com
- **Community Pool 2**: https://mine-zion.net

---

## 📈 Economic Parameters

| Parameter | Value |
|-----------|-------|
| Max Supply | 144,000,000,000 ZION |
| Initial Block Reward | 333 ZION |
| Block Time | 2 minutes |
| Halving Interval | 210,000 blocks (~291 days) |
| Difficulty Adjustment | Every 720 blocks (~24 hours) |
| Transaction Fee (min) | 0.001 ZION |
| Confirmation Required | 6 blocks (~12 minutes) |

---

## 🔧 Troubleshooting

### Common Issues

**Node won't sync:**
```bash
# Check peer connections
ziond getpeerinfo

# Add nodes manually
ziond addnode seed1.zion.network add
```

**High memory usage:**
```bash
# Reduce cache size in zion.conf
[database]
db_cache_size = 268435456  # 256MB instead of 512MB
```

**Mining not finding blocks:**
```bash
# Check difficulty
ziond getmininginfo

# Verify address is valid
ziond validateaddress YOUR_ADDRESS
```

### Debug Mode
```bash
# Run with debug logging
ziond --debug --loglevel=debug
```

---

## 📱 Mobile & Light Clients

### Mobile Wallets
- **ZION Wallet** (iOS/Android) - Official light wallet
- **Trust Wallet** - Multi-currency support (coming soon)

### Light Client Setup
```bash
# Connect to remote node
zion_wallet --node=https://rpc.zion.network:18081
```

---

## 🚨 Emergency Procedures

### Chain Fork Recovery
```bash
# Reindex blockchain
ziond --reindex

# Resync from scratch
rm -rf ~/.zion/data/blocks
rm -rf ~/.zion/data/chainstate
ziond --resync
```

### Wallet Recovery
```bash
# From seed phrase
zion_wallet recover --seed="your twelve word seed phrase here"

# From backup
zion_wallet import --file=wallet-backup.dat
```

---

## 📞 Support Channels

- **Technical Support**: support@zion.network
- **Discord**: https://discord.gg/zion
- **Telegram**: https://t.me/zionnetwork
- **GitHub Issues**: https://github.com/zion-network/zion-cryptocurrency/issues

---

## ⚖️ Legal & Compliance

ZION is a decentralized cryptocurrency. Users are responsible for complying with local regulations regarding cryptocurrency usage, mining, and taxation.

---

## 🎉 Launch Events

### Mainnet Launch Party
- **Date**: December 16, 2024
- **Time**: 12:00 UTC
- **Location**: Virtual (Discord)
- **Activities**: 
  - Genesis block mining ceremony
  - First transaction celebration
  - Airdrop for early adopters
  - Q&A with development team

### Mining Competition (Week 1)
- **Prize Pool**: 10,000 ZION
- **Categories**:
  - Most blocks mined
  - Largest mining pool
  - Best mining setup

---

**Welcome to the ZION Network! 🚀**

*May your hashes be low and your rewards be high!*
