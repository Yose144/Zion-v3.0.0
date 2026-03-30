# ZION Troubleshooting Guide

**Version:** 2.8.3 "Terra Nova"  
**Updated:** October 29, 2025  

---

## 📋 Table of Contents

1. [Installation Issues](#installation-issues)
2. [Wallet Problems](#wallet-problems)
3. [Mining Issues](#mining-issues)
4. [Network & Connectivity](#network--connectivity)
5. [Performance Problems](#performance-problems)
6. [Docker Issues](#docker-issues)
7. [Error Messages](#error-messages)
8. [Advanced Debugging](#advanced-debugging)

---

## Installation Issues

### Binary Won't Extract

**Problem:** `tar: Error is not recoverable: exiting now`

**Solution:**
```bash
# Verify file integrity
sha256sum zion-cli-2.8.3-linux-amd64.tar.gz

# Compare with official hash from GitHub releases
# If mismatch, re-download:
wget -c https://github.com/estrelaisabellazion3/Zion-2.8/releases/download/v2.8.3/zion-cli-2.8.3-linux-amd64.tar.gz

# Extract with verbose mode to see errors
tar -xzvf zion-cli-2.8.3-linux-amd64.tar.gz
```

### Binary Won't Run - Permission Denied

**Problem:** `bash: ./zion-cli: Permission denied`

**Solution:**
```bash
# Make executable
chmod +x zion-cli

# Verify permissions
ls -la zion-cli
# Should show: -rwxr-xr-x

# Run again
./zion-cli --help
```

### Binary Won't Run - Wrong Architecture

**Problem:** `cannot execute binary file: Exec format error`

**Solution:**
```bash
# Check your system architecture
uname -m
# Output: x86_64 (AMD64) or arm64 (ARM)

# Download correct version:
# For x86_64 (Intel/AMD):
wget https://github.com/estrelaisabellazion3/Zion-2.8/releases/download/v2.8.3/zion-cli-2.8.3-linux-amd64.tar.gz

# For ARM (Raspberry Pi, Apple M1):
wget https://github.com/estrelaisabellazion3/Zion-2.8/releases/download/v2.8.3/zion-cli-2.8.3-linux-arm64.tar.gz
```

### Missing Dependencies

**Problem:** `error while loading shared libraries: libssl.so.1.1`

**Solution:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install libssl1.1 libcrypto++6

# If libssl1.1 not available (Ubuntu 22.04+):
sudo apt install libssl3

# Fedora/RHEL
sudo dnf install openssl-libs

# Arch Linux
sudo pacman -S openssl

# Verify installation
ldconfig -p | grep ssl
```

### Python Version Issues (Source Install)

**Problem:** `SyntaxError: invalid syntax` or `python: command not found`

**Solution:**
```bash
# Check Python version
python3 --version
# Requires: Python 3.10+

# Install Python 3.13 (Ubuntu)
sudo apt update
sudo apt install software-properties-common
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt install python3.13 python3.13-venv

# Create venv with correct version
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## Wallet Problems

### Can't Create Wallet

**Problem:** `Error: Failed to create wallet`

**Solution:**
```bash
# Check if wallet already exists
ls ~/.zion/wallet/

# If exists and you want new wallet:
# 1. Backup old wallet
cp -r ~/.zion/wallet ~/.zion/wallet_backup_$(date +%Y%m%d)

# 2. Remove old wallet
rm -rf ~/.zion/wallet

# 3. Create new wallet
./zion-cli wallet --create

# If permission issues:
chmod 700 ~/.zion
chmod 700 ~/.zion/wallet
```

### Lost Private Key

**Problem:** Can't find `wallet_private_key.txt`

**Solution:**
```bash
# Search for backup locations
find ~ -name "wallet_private_key.txt" 2>/dev/null

# Check common locations
ls ~/.zion/wallet/
ls ~/Downloads/
ls ~/Documents/

# If truly lost:
# ⚠️ FUNDS ARE UNRECOVERABLE
# You must create a new wallet
./zion-cli wallet --create
```

### Wallet Balance Shows 0

**Problem:** Balance is 0 but should have funds

**Solutions:**

**1. Check if node is synced:**
```bash
./zion-cli node --status

# If not synced:
# - Wait for sync to complete
# - Check "Block Height" matches network
```

**2. Verify correct network:**
```bash
# Make sure connected to testnet
./zion-cli node --info | grep network
# Should show: testnet-2.8.3
```

**3. Check correct wallet address:**
```bash
# Verify your address
./zion-cli wallet --info

# Check balance on explorer
# Visit: https://explorer.zionterranova.com
# Enter your address
```

**4. Query balance via RPC:**
```bash
curl -X POST https://api.zionterranova.com \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get_balance",
    "params": {"address": "YOUR_ADDRESS"},
    "id": 1
  }'
```

### Transaction Stuck Pending

**Problem:** Transaction shows "pending" for > 30 minutes

**Solutions:**

**1. Check transaction status:**
```bash
./zion-cli tx --status TX_HASH
```

**2. Verify fee is sufficient:**
```bash
# Minimum fee: 0.001 ZION
# If fee too low, resend with higher fee:
./zion-cli send \
  --to RECIPIENT \
  --amount AMOUNT \
  --fee 0.01  # 10x higher
```

**3. Check if double-spend:**
```bash
# Query transaction on explorer
curl https://api.zionterranova.com/api/transaction/TX_HASH
```

**4. Rebroadcast transaction:**
```bash
./zion-cli tx --rebroadcast TX_HASH
```

### Can't Import Wallet

**Problem:** `Error: Invalid wallet format`

**Solution:**
```bash
# Check backup file format
cat wallet_backup.json

# Should be valid JSON with:
# - "address"
# - "encrypted_private_key" or "private_key"

# Try importing with password:
./zion-cli wallet --import wallet_backup.json --password YOUR_PASSWORD

# If encrypted, decrypt first:
openssl enc -aes-256-cbc -d -in wallet_backup.json.enc -out wallet_backup.json
```

---

## Mining Issues

### Mining Won't Start

**Problem:** `Error: Failed to start mining`

**Solutions:**

**1. Check wallet exists:**
```bash
./zion-cli wallet --info
# If no wallet: ./zion-cli wallet --create
```

**2. Verify pool connection:**
```bash
# Test pool connectivity
telnet pool.zionterranova.com 3333
# Should connect (Ctrl+C to exit)

# If fails, check firewall:
sudo ufw status
sudo ufw allow out 3333
```

**3. Check mining software:**
```bash
# Verify Cosmic Harmony library
ls build_zion/cosmic_harmony/*.so

# If missing, rebuild:
cd build_zion/cosmic_harmony
make clean && make
```

### GPU Not Detected

**Problem:** `Error: No GPU found`

**Solutions:**

**NVIDIA:**
```bash
# Check GPU status
nvidia-smi

# If not found, install drivers:
# Ubuntu
sudo apt install nvidia-driver-535

# Check installation
nvidia-smi

# Reboot if necessary
sudo reboot
```

**AMD:**
```bash
# Check GPU status
rocm-smi

# If not found, install drivers:
# Ubuntu
sudo apt install rocm-dkms

# Or download from AMD:
wget https://repo.radeon.com/amdgpu-install/latest/ubuntu/jammy/amdgpu-install_*.deb
sudo apt install ./amdgpu-install_*.deb
sudo amdgpu-install --usecase=rocm

# Reboot
sudo reboot
```

**Integrated GPU (Intel/AMD APU):**
```bash
# Not supported for mining
# Use CPU mining instead:
./zion-cli mine --cpu-only --threads 4
```

### Low Hashrate

**Problem:** Hashrate much lower than expected

**Solutions:**

**1. GPU underperforming:**
```bash
# Check GPU clock speeds
nvidia-smi -q -d CLOCK  # NVIDIA
rocm-smi --showclocks   # AMD

# Check power limit
nvidia-smi -q -d POWER  # NVIDIA

# Increase power limit (NVIDIA)
nvidia-smi -i 0 -pl 250  # 250W
```

**2. Thermal throttling:**
```bash
# Check temperature
nvidia-smi -q -d TEMPERATURE  # NVIDIA
rocm-smi --showtemp           # AMD

# If > 80°C:
# - Increase fan speed
# - Improve case airflow
# - Reduce intensity
./zion-cli mine --intensity 80
```

**3. Other apps using GPU:**
```bash
# Check GPU processes
nvidia-smi  # Look for other processes

# Kill competing processes
sudo kill -9 PID
```

**4. CPU mining too slow:**
```bash
# Check CPU frequency
cat /proc/cpuinfo | grep MHz

# Set to performance mode
sudo cpupower frequency-set -g performance

# Verify change
cpupower frequency-info

# Optimize threads
./zion-cli mine --cpu-only --threads $(nproc --ignore=2)
```

### Mining Pool Connection Failed

**Problem:** `Error: Connection to pool failed`

**Solutions:**

**1. Test network connectivity:**
```bash
# Ping pool
ping pool.zionterranova.com

# Test port
nc -zv pool.zionterranova.com 3333
# Or: telnet pool.zionterranova.com 3333
```

**2. Check firewall:**
```bash
sudo ufw status
sudo ufw allow out 3333

# For corporate networks, try HTTP proxy:
./zion-cli mine --proxy http://proxy.company.com:8080
```

**3. Try backup pool:**
```bash
./zion-cli mine --pool backup-pool.zionterranova.com:3333
```

**4. DNS issues:**
```bash
# Test DNS resolution
nslookup pool.zionterranova.com

# If fails, use IP directly:
./zion-cli mine --pool 91.98.122.165:3333
```

### No Shares Accepted

**Problem:** Mining running but 0 shares accepted

**Solutions:**

**1. Check miner status:**
```bash
./zion-cli mine --status
# Look for "Shares: X accepted, Y rejected"
```

**2. Verify wallet address:**
```bash
# Confirm address format
./zion-cli wallet --info

# Should start with: zion1
# Length: 62 characters
```

**3. Check difficulty:**
```bash
# Pool may have increased difficulty
# Wait 5-10 minutes for share submission

# Check pool stats:
curl http://pool.zionterranova.com/api/stats
```

**4. Restart miner:**
```bash
./zion-cli mine --stop
sleep 5
./zion-cli mine --start --pool pool.zionterranova.com:3333 --wallet YOUR_ADDRESS
```

---

## Network & Connectivity

### Can't Connect to RPC API

**Problem:** `Connection refused` to api.zionterranova.com

**Solutions:**

**1. Check internet connection:**
```bash
ping 8.8.8.8
```

**2. Test RPC endpoint:**
```bash
curl -v https://api.zionterranova.com/api/status

# If SSL error:
curl -k https://api.zionterranova.com/api/status  # Ignore SSL
```

**3. DNS issues:**
```bash
# Check DNS resolution
nslookup api.zionterranova.com

# If fails, use IP:
curl http://91.98.122.165:8545/api/status
```

**4. Firewall blocking:**
```bash
sudo ufw allow out 443  # HTTPS
sudo ufw allow out 8545  # RPC
```

**5. Use different RPC endpoint:**
```bash
# Configure alternative endpoint
./zion-cli config --rpc http://91.98.122.165:8545
```

### Node Won't Sync

**Problem:** Blockchain sync stuck at specific block

**Solutions:**

**1. Check peer connections:**
```bash
./zion-cli node --peers

# Should show 1+ peers
# If 0 peers:
./zion-cli node --add-peer 91.98.122.165:8333
```

**2. Check network connectivity:**
```bash
# Test P2P port
nc -zv 91.98.122.165 8333
```

**3. Reset blockchain data:**
```bash
# ⚠️ Warning: Will re-download entire blockchain

# Backup wallet first!
cp -r ~/.zion/wallet ~/wallet_backup

# Remove blockchain data
rm -rf ~/.zion/blockchain

# Restart sync
./zion-cli node --resync
```

**4. Check disk space:**
```bash
df -h ~/.zion
# Should have 10+ GB free
```

### Firewall Blocking Connections

**Problem:** Node can't connect to peers

**Solutions:**

**Ubuntu/Debian (UFW):**
```bash
# Allow ZION ports
sudo ufw allow 8333/tcp  # P2P
sudo ufw allow 8545/tcp  # RPC (if running server)

# Check rules
sudo ufw status numbered
```

**Fedora/RHEL (firewalld):**
```bash
sudo firewall-cmd --permanent --add-port=8333/tcp
sudo firewall-cmd --permanent --add-port=8545/tcp
sudo firewall-cmd --reload
```

**iptables:**
```bash
sudo iptables -A INPUT -p tcp --dport 8333 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 8545 -j ACCEPT
sudo iptables-save
```

---

## Performance Problems

### High CPU Usage

**Problem:** ZION using 100% CPU

**Solutions:**

**1. Reduce mining threads:**
```bash
# If CPU mining
./zion-cli mine --stop
./zion-cli mine --start --cpu-only --threads 4  # Use fewer threads
```

**2. Lower mining intensity:**
```bash
./zion-cli mine --intensity 75  # Reduce from 100
```

**3. Check for runaway processes:**
```bash
top  # Look for high CPU processes
htop  # Better interface (install: sudo apt install htop)

# Kill specific process
kill -9 PID
```

### High Memory Usage

**Problem:** System running out of RAM

**Solutions:**

**1. Check memory usage:**
```bash
free -h
# Look at "available" memory

# Check ZION processes
ps aux | grep zion
```

**2. Increase swap:**
```bash
# Create swap file (4GB)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**3. Reduce blockchain cache:**
```bash
# Edit config
nano ~/.zion/config.json

# Change:
"cache_size_mb": 512  # Reduce from default 2048
```

### Slow Transaction Processing

**Problem:** Transactions taking > 5 minutes

**Solutions:**

**1. Check network congestion:**
```bash
curl https://api.zionterranova.com/api/mining/info
# Look at "pooled_tx" (pending transactions)
```

**2. Increase transaction fee:**
```bash
./zion-cli send \
  --to RECIPIENT \
  --amount AMOUNT \
  --fee 0.01  # Higher fee = faster confirmation
```

**3. Check node sync status:**
```bash
./zion-cli node --status
# Verify "Block Height" is current
```

---

## Docker Issues

### Docker Container Won't Start

**Problem:** `Error: Cannot start container zion-node`

**Solutions:**

**1. Check container logs:**
```bash
docker logs zion-node

# Follow logs in real-time
docker logs -f zion-node
```

**2. Check port conflicts:**
```bash
# See what's using port 8545
sudo lsof -i :8545
# Or: sudo netstat -tulpn | grep 8545

# Kill conflicting process
sudo kill -9 PID
```

**3. Remove and recreate:**
```bash
docker-compose -f docker-compose.testnet.yml down
docker-compose -f docker-compose.testnet.yml up -d
```

**4. Check Docker daemon:**
```bash
sudo systemctl status docker

# If not running:
sudo systemctl start docker
```

### Permission Denied in Container

**Problem:** `Permission denied: '/data/blockchain'`

**Solution:**
```bash
# Check volume permissions
docker exec zion-node ls -la /data

# Fix permissions
docker exec -u root zion-node chown -R zion:zion /data

# Or recreate volume
docker-compose -f docker-compose.testnet.yml down -v
docker-compose -f docker-compose.testnet.yml up -d
```

### Out of Disk Space (Docker)

**Problem:** `no space left on device`

**Solutions:**

**1. Check Docker disk usage:**
```bash
docker system df
```

**2. Clean up:**
```bash
# Remove unused containers
docker container prune

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Or clean everything:
docker system prune -a --volumes
```

**3. Change Docker data directory:**
```bash
# Edit daemon config
sudo nano /etc/docker/daemon.json

# Add:
{
  "data-root": "/mnt/large-disk/docker"
}

# Restart Docker
sudo systemctl restart docker
```

---

## Error Messages

### "Invalid address format"

**Problem:** Wallet address rejected

**Solution:**
```bash
# ZION addresses must:
# - Start with "zion1"
# - Be 62 characters long
# - Contain only alphanumeric characters

# Verify address:
./zion-cli wallet --validate zion1abc123...

# Get your correct address:
./zion-cli wallet --info
```

### "Insufficient funds"

**Problem:** Transaction fails due to low balance

**Solution:**
```bash
# Check balance
./zion-cli wallet --balance

# Remember: Amount + Fee must be ≤ Balance
# Example:
# Balance: 10 ZION
# Amount: 10 ZION
# Fee: 0.001 ZION
# Total needed: 10.001 ZION ❌

# Solution: Send less
./zion-cli send --to ADDRESS --amount 9.99 --fee 0.001
```

### "Block validation failed"

**Problem:** Node rejecting blocks

**Solution:**
```bash
# Usually indicates corrupted blockchain

# 1. Stop node
./zion-cli node --stop

# 2. Backup wallet
cp -r ~/.zion/wallet ~/wallet_backup

# 3. Remove blockchain
rm -rf ~/.zion/blockchain

# 4. Resync
./zion-cli node --start --resync
```

### "Nonce too low"

**Problem:** Transaction nonce error

**Solution:**
```bash
# Clear pending transactions
./zion-cli wallet --clear-pending

# Restart node
./zion-cli node --restart

# Resend transaction
./zion-cli send --to ADDRESS --amount AMOUNT
```

---

## Advanced Debugging

### Enable Debug Logging

```bash
# Set log level to DEBUG
./zion-cli config --log-level DEBUG

# View logs
tail -f ~/.zion/logs/debug.log

# Or for mining logs
tail -f ~/.zion/logs/mining.log
```

### Collect Diagnostic Information

```bash
# System info
uname -a
lsb_release -a

# ZION version
./zion-cli --version

# Node status
./zion-cli node --status --verbose

# Mining status
./zion-cli mine --status --verbose

# Network info
./zion-cli node --peers
./zion-cli node --info

# Save to file
./zion-cli diagnostics --output ~/zion-diagnostics.txt
```

### Test RPC API Manually

```bash
# Test basic connectivity
curl -v https://api.zionterranova.com/api/status

# Test specific endpoint
curl -X POST https://api.zionterranova.com \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get_blockchain_info",
    "params": {},
    "id": 1
  }' | jq .
```

### Check System Resources

```bash
# CPU usage
top -bn1 | grep "Cpu(s)"

# Memory usage
free -h

# Disk usage
df -h

# Network usage
sudo iftop  # Install: sudo apt install iftop

# GPU status
nvidia-smi  # NVIDIA
rocm-smi    # AMD
```

### Verify Binary Integrity

```bash
# Check SHA256 hash
sha256sum zion-cli

# Compare with official hash from:
# https://github.com/estrelaisabellazion3/Zion-2.8/releases/tag/v2.8.3

# If mismatch, re-download from official source
```

---

## Still Need Help?

### Documentation
- **[Quick Start Guide](./QUICK_START.md)** - Basic setup
- **[Mining Guide](./MINING_GUIDE.md)** - Mining help
- **[RPC API Reference](./RPC_API.md)** - API docs
- **[FAQ](../FAQ.md)** - Common questions

### Community Support

**GitHub Issues:**
```bash
# Search existing issues
https://github.com/estrelaisabellazion3/Zion-2.8/issues

# Create new issue with:
# - Problem description
# - Steps to reproduce
# - Error messages
# - System info (OS, version)
# - Log files
```

**Email Support:**
- General: admin@zionterranova.com
- Security: security@zionterranova.com
- Technical: support@zionterranova.com

### Reporting Bugs

**Include in your report:**
1. ZION version (`./zion-cli --version`)
2. Operating system (Ubuntu 22.04, macOS 14, etc.)
3. Hardware (CPU, GPU model)
4. Complete error message
5. Steps to reproduce
6. Log files (`~/.zion/logs/debug.log`)

**Create diagnostic bundle:**
```bash
# Automated diagnostic collection
./zion-cli diagnostics --bundle ~/zion-bug-report.tar.gz

# Attach to GitHub issue or email
```

---

**Most problems can be solved by:**
1. 📖 Reading error messages carefully
2. 🔍 Checking logs (`~/.zion/logs/`)
3. 🔄 Restarting the service
4. 📥 Updating to latest version
5. 🆘 Asking for help with detailed info

*ZION Troubleshooting Guide - We're here to help!*  
*Version 2.8.3 "Terra Nova" - October 2025*