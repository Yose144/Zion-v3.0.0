# ZION 2.8.3 Testnet - Quick Start Guide

**Version:** 2.8.3 "Terra Nova"  
**Launch Date:** November 15, 2025  
**Platform:** Linux, macOS, Windows  
**Updated:** October 29, 2025  

## 🎯 Overview

Welcome to ZION Testnet! This guide will get you up and running in **5 minutes**. ZION is a humanitarian blockchain with GPU mining, multi-signature wallets, and a focus on global prosperity.

### What You'll Learn
- ✅ Create a ZION wallet
- ✅ Connect to testnet
- ✅ Start mining ZION tokens
- ✅ Use RPC API
- ✅ Monitor your progress

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- **OS:** Linux, macOS, or Windows 10+
- **RAM:** 2 GB minimum (4 GB recommended)
- **Disk:** 5 GB free space
- **Network:** Stable internet connection

### Option 1: CLI Binary (Fastest) ⭐

Perfect for most users - no installation required!

#### 1. Download Binary
```bash
# Linux (AMD64)
wget https://github.com/estrelaisabellazion3/Zion-2.8/releases/download/v2.8.3/zion-cli-2.8.3-linux-amd64.tar.gz

# macOS (Intel)
wget https://github.com/estrelaisabellazion3/Zion-2.8/releases/download/v2.8.3/zion-cli-2.8.3-macos-amd64.tar.gz

# macOS (Apple Silicon)
wget https://github.com/estrelaisabellazion3/Zion-2.8.3/zion-cli-2.8.3-macos-arm64.tar.gz

# Windows
wget https://github.com/estrelaisabellazion3/Zion-2.8.3/zion-cli-2.8.3-windows-amd64.zip
```

#### 2. Extract and Setup
```bash
# Linux/macOS
tar -xzf zion-cli-2.8.3-*.tar.gz
cd zion-cli-2.8.3

# Windows (PowerShell)
Expand-Archive zion-cli-2.8.3-windows-amd64.zip .
cd zion-cli-2.8.3
```

#### 3. Create Wallet
```bash
# Create new wallet
./zion-cli wallet --create

# Expected output:
# Wallet created successfully!
# Address: zion1abc123def456...
# Private key saved to: wallet_private_key.txt
# ⚠️  BACKUP THIS FILE SECURELY!
```

#### 4. Check Node Status
```bash
# Connect to testnet
./zion-cli node --status --rpc https://api.zionterranova.com

# Expected output:
# Node Status: Connected
# Block Height: 1
# Network: testnet-2.8.3
# Peers: 1
```

#### 5. Start Mining
```bash
# Start mining (replace with your wallet address)
./zion-cli mine --start --pool pool.zionterranova.com:3333 --wallet YOUR_WALLET_ADDRESS

# Expected output:
# Mining started!
# Pool: pool.zionterranova.com:3333
# Wallet: zion1abc123...
# Hashrate: Calculating...
```

### Option 2: Docker (Recommended for Full Node)

Best for developers and advanced users.

#### 1. Install Docker
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install docker.io docker-compose

# macOS (Homebrew)
brew install docker docker-compose

# Windows: Download from docker.com
```

#### 2. Clone Repository
```bash
git clone https://github.com/estrelaisabellazion3/Zion-2.8.git
cd Zion-2.8
```

#### 3. Start Services
```bash
# Start full node
docker-compose -f docker-compose.testnet.yml up -d zion-node

# Or start node + mining pool
docker-compose -f docker-compose.testnet.yml up -d
```

#### 4. Verify Installation
```bash
# Check logs
docker-compose -f docker-compose.testnet.yml logs -f zion-node

# Test RPC API
curl http://localhost:8545/api/status
```

#### 5. Create Wallet via Docker
```bash
# Access container
docker exec -it zion-node bash

# Create wallet
python cli_simple.py wallet --create
```

### Option 3: From Source (Developers)

For developers who want to modify the code.

#### 1. Install Dependencies
```bash
# Python 3.13+
python3 --version

# Git
git --version

# Clone repository
git clone https://github.com/estrelaisabellazion3/Zion-2.8.git
cd Zion-2.8
```

#### 2. Setup Virtual Environment
```bash
# Create venv
python3 -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt
```

#### 3. Build Cosmic Harmony (GPU Mining)
```bash
# Build GPU library
cd build_zion/cosmic_harmony
make

# Verify build
ls -la *.so
```

#### 4. Run Node
```bash
# Start blockchain node
python new_zion_blockchain.py

# In another terminal, start mining pool
python src/core/zion_universal_pool_v2.py
```

#### 5. Test Installation
```bash
# Check RPC API
curl http://localhost:8545/api/status

# Create wallet
python cli_simple.py wallet --create
```

---

## 🔧 Configuration

### Wallet Configuration
```bash
# View wallet info
./zion-cli wallet --info

# Export wallet (encrypted)
./zion-cli wallet --export --password your_password

# Import wallet
./zion-cli wallet --import wallet_backup.json --password your_password
```

### Mining Configuration
```bash
# Check mining status
./zion-cli mine --status

# Stop mining
./zion-cli mine --stop

# Change mining pool
./zion-cli mine --pool new-pool.com:3333
```

### Node Configuration
```bash
# View node info
./zion-cli node --info

# Add peer
./zion-cli node --add-peer 192.168.1.100:8333

# View peers
./zion-cli node --peers
```

---

## 🌐 Network Information

### Testnet Endpoints
- **RPC API:** `https://api.zionterranova.com`
- **Mining Pool:** `pool.zionterranova.com:3333`
- **Explorer:** `https://explorer.zionterranova.com`
- **Seed Node:** `91.98.122.165:8333`

### Network Stats
- **Network ID:** testnet-2.8.3
- **Block Time:** ~2 minutes
- **Block Reward:** 50 ZION
- **Total Supply:** 21 billion (planned)

---

## 📊 Monitoring & Troubleshooting

### Check System Status
```bash
# Node health
./zion-cli node --status

# Mining performance
./zion-cli mine --status

# Wallet balance
./zion-cli wallet --balance
```

### View Logs
```bash
# Docker logs
docker-compose -f docker-compose.testnet.yml logs -f

# Application logs (source install)
tail -f logs/zion_node.log
```

### Common Issues

#### ❌ "Connection refused"
```bash
# Check if services are running
docker-compose -f docker-compose.testnet.yml ps

# Restart services
docker-compose -f docker-compose.testnet.yml restart
```

#### ❌ "Mining not starting"
```bash
# Check GPU drivers
nvidia-smi  # NVIDIA
rocm-smi    # AMD

# Verify wallet address format
./zion-cli wallet --validate YOUR_ADDRESS
```

#### ❌ "Low hashrate"
```bash
# Check system resources
top  # Linux/macOS
# Task Manager  # Windows

# Update GPU drivers
# Ensure adequate cooling
```

---

## 🎓 Next Steps

### Learn More
- **[Mining Guide](./MINING_GUIDE.md)** - Advanced mining setup
- **[RPC API Reference](./RPC_API.md)** - Developer API docs
- **[Architecture Overview](./ARCHITECTURE.md)** - Technical deep-dive
- **[FAQ](./FAQ.md)** - Frequently asked questions
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues

### Join Community
- **Website:** [zionterranova.com](https://zionterranova.com)
- **GitHub:** [Issues & Discussions](https://github.com/estrelaisabellazion3/Zion-2.8)
- **Explorer:** [Live Network Stats](https://explorer.zionterranova.com)

### Development
```bash
# Run tests
pytest tests/

# Build documentation
mkdocs build

# Contribute code
git checkout -b feature/your-feature
```

---

## ⚠️ Important Notes

### Testnet Tokens
- **No monetary value** - for testing only
- **Reset possible** - testnet may be reset during development
- **Mining rewards** - 45 ZION per block (90% miner, 10% humanitarian fund)

### Security
- **Backup wallet** - Save private keys securely
- **Use strong passwords** - For wallet encryption
- **Keep software updated** - Security patches released regularly

### Performance
- **GPU recommended** - For meaningful mining hashrate
- **Stable internet** - Required for mining pool connection
- **Monitor resources** - Mining uses significant CPU/GPU

---

## 🆘 Need Help?

### Quick Support
1. Check this guide first
2. Review [FAQ](./FAQ.md)
3. Review [Troubleshooting Guide](./TROUBLESHOOTING.md)
4. Search [GitHub Issues](https://github.com/estrelaisabellazion3/Zion-2.8/issues)

### Report Issues
- **Bug reports:** [Open GitHub Issue](https://github.com/estrelaisabellazion3/Zion-2.8/issues/new)
- **Security issues:** security@zionterranova.com (encrypted)

---

**Ready to mine ZION? Start with Option 1 above! ⛏️**

*Built with ❤️ for humanitarian blockchain technology*  
*ZION 2.8.3 "Terra Nova" - October 2025*