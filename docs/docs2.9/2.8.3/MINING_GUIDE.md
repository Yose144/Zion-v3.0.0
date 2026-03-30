# ZION Mining Guide

**Version:** 2.8.3 "Terra Nova"  
**Platform:** Linux, macOS, Windows  
**Updated:** October 29, 2025  

## ⛏️ Overview

ZION uses the revolutionary **Cosmic Harmony** algorithm - a GPU-optimized, memory-hard mining algorithm designed for fairness and ASIC resistance. This guide covers everything you need to start mining ZION tokens.

### Mining Algorithm Features
- **GPU Optimized** - CUDA/OpenCL support
- **Memory Hard** - 2GB+ VRAM required
- **ASIC Resistant** - Custom Autolykos2 variant
- **Fair Distribution** - No mining pools needed (but supported)
- **Eco-Friendly** - Efficient power usage

---

## 🚀 Quick Mining Start (3 Steps)

### 1. Get Mining Software
```bash
# Download ZION CLI
wget https://github.com/estrelaisabellazion3/Zion-2.8/releases/download/v2.8.3/zion-cli-2.8.3-linux-amd64.tar.gz
tar -xzf zion-cli-2.8.3-linux-amd64.tar.gz
cd zion-cli-2.8.3
```

### 2. Create Wallet
```bash
./zion-cli wallet --create
# Save your address: zion1abc123def456...
```

### 3. Start Mining
```bash
./zion-cli mine --start --pool pool.zionterranova.com:3333 --wallet YOUR_WALLET_ADDRESS
```

**That's it!** You're now mining ZION tokens.

---

## 🔧 Hardware Requirements

### Minimum Requirements (CPU Mining)
- **CPU:** Quad-core 2.0 GHz (Intel i3/AMD Ryzen 3)
- **RAM:** 2 GB
- **Storage:** 5 GB SSD
- **Power:** 200W PSU
- **Expected Hashrate:** 1-2 MH/s

### Recommended Setup (GPU Mining)
- **GPU:** NVIDIA GTX 1060 6GB or AMD RX 580 8GB
- **VRAM:** 2 GB minimum
- **RAM:** 4 GB system RAM
- **CPU:** Dual-core 2.4 GHz
- **Storage:** 10 GB SSD
- **Power:** 400W PSU
- **Expected Hashrate:** 25-35 MH/s

### Optimal Mining Rig (High-End GPU)
- **GPU:** NVIDIA RTX 3060+ or AMD RX 6600 XT
- **VRAM:** 8 GB+
- **RAM:** 8 GB system RAM
- **CPU:** Quad-core 3.0 GHz+
- **Storage:** 20 GB NVMe SSD
- **Power:** 650W PSU with 8-pin GPU connector

### Optimal Mining Rig
- **GPU:** NVIDIA RTX 4070 Ti or AMD RX 7900 XT
- **VRAM:** 12 GB+
- **RAM:** 16 GB DDR4
- **CPU:** 6-core Ryzen 5 5600X
- **Storage:** 500 GB NVMe SSD
- **Power:** 850W PSU
- **Cooling:** Good airflow, GPU undervolting

---

## 📦 Mining Software Options

### Option 1: ZION CLI (Recommended)
```bash
# Download and extract
wget https://github.com/estrelaisabellazion3/Zion-2.8/releases/download/v2.8.3/zion-cli-2.8.3-linux-amd64.tar.gz
tar -xzf zion-cli-2.8.3-linux-amd64.tar.gz
cd zion-cli-2.8.3

# Start mining
./zion-cli mine --start --pool pool.zionterranova.com:3333 --wallet YOUR_ADDRESS
```

### Option 2: Docker Mining
```bash
# Clone repo
git clone https://github.com/estrelaisabellazion3/Zion-2.8.git
cd Zion-2.8

# Start mining container
docker run -d \
  --name zion-miner \
  --gpus all \
  -e WALLET=YOUR_ADDRESS \
  -e POOL=pool.zionterranova.com:3333 \
  zionterranova/zion-miner:2.8.3
```

### Option 3: CPU Mining (Budget/Testing)

Best for testing or if you don't have a GPU.

```bash
# Download CLI
wget https://github.com/estrelaisabellazion3/Zion-2.8/releases/download/v2.8.3/zion-cli-2.8.3-linux-amd64.tar.gz
tar -xzf zion-cli-2.8.3-linux-amd64.tar.gz

# Start CPU mining
./zion-cli mine --start \
  --pool pool.zionterranova.com:3333 \
  --wallet YOUR_ADDRESS \
  --cpu-only \
  --threads 8  # Number of CPU cores - 2

# Expected hashrate:
# 4-core CPU: ~1-2 MH/s
# 8-core CPU: ~3-5 MH/s
# 16-core CPU: ~8-12 MH/s
```

**Note:** CPU mining is ~100x slower than GPU but still contributes to network!

### Option 4: Solo Mining (Advanced)
```bash
# Connect directly to node
./zion-cli mine --solo --rpc https://api.zionterranova.com --wallet YOUR_ADDRESS
```

---

## ⚙️ Configuration & Optimization

### Basic Configuration
```bash
# Start with basic settings
./zion-cli mine --start \
  --pool pool.zionterranova.com:3333 \
  --wallet YOUR_ADDRESS \
  --threads 4 \
  --intensity 100
```

### Advanced Configuration
```bash
# Full configuration with CPU mining
./zion-cli mine --start \
  --pool pool.zionterranova.com:3333 \
  --wallet YOUR_ADDRESS \
  --cpu-only \
  --threads 12 \
  --intensity 90

# Or GPU + CPU hybrid mining
./zion-cli mine --start \
  --pool pool.zionterranova.com:3333 \
  --wallet YOUR_ADDRESS \
  --gpu 0 \
  --cpu-threads 4 \
  --gpu-intensity 100 \
  --cpu-intensity 80
```

### Configuration Parameters

| Parameter | Description | Default | Range |
|-----------|-------------|---------|-------|
| `--cpu-only` | CPU mining mode (no GPU) | false | true/false |
| `--threads` | CPU threads for mining | Auto | 1-64 |
| `--cpu-threads` | CPU threads (hybrid mode) | 0 | 0-64 |
| `--intensity` | GPU/CPU workload intensity | 100 | 1-100 |
| `--worksize` | GPU work group size | 64 | 32-512 |
| `--gpu` | GPU device ID | 0 | 0-N |
| `--temperature-limit` | GPU temperature limit (°C) | 80 | 60-90 |
| `--power-limit` | GPU power limit (W) | Auto | 50-400 |

### Multi-GPU Setup
```bash
# Mine on GPU 0
./zion-cli mine --start --gpu 0 --wallet YOUR_ADDRESS &

# Mine on GPU 1
./zion-cli mine --start --gpu 1 --wallet YOUR_ADDRESS &
```

### CPU + GPU Hybrid Mining
```bash
# Maximize all hardware resources
./zion-cli mine --start \
  --wallet YOUR_ADDRESS \
  --gpu 0 \
  --gpu-intensity 100 \
  --cpu-threads 4 \
  --cpu-intensity 75

# This uses:
# - Full GPU power (100% intensity)
# - 4 CPU cores (75% intensity to avoid thermal issues)
```

### CPU-Only Multi-Core Optimization
```bash
# For high-core-count CPUs (16+ cores)
./zion-cli mine --start \
  --cpu-only \
  --threads 14 \  # Leave 2 cores for system
  --intensity 90 \  # 90% to prevent thermal throttling
  --affinity 0-13  # Pin to specific cores

# Monitor with:
htop  # Linux
# Task Manager  # Windows
```

---

## 📊 Monitoring Performance

### Real-time Stats
```bash
# Check mining status
./zion-cli mine --status

# Output:
# Mining Status: Active
# Pool: pool.zionterranova.com:3333
# Hashrate: 45.2 MH/s
# Shares: 125 accepted, 2 rejected
# Efficiency: 98.4%
# Temperature: 68°C
# Power: 185W
```

### Performance Metrics
- **Hashrate:** Mining speed (MH/s, GH/s)
- **Shares:** Accepted/rejected work units
- **Efficiency:** Share acceptance rate
- **Temperature:** GPU temperature
- **Power:** Power consumption
- **Uptime:** Mining session duration

### Web Dashboard
Visit `https://pool.zionterranova.com` to monitor:
- Real-time hashrate
- Worker statistics
- Payment history
- Pool efficiency

---

## 💰 Mining Rewards & Payouts

### Reward Structure
- **Block Reward:** 50 ZION per block
- **Miner Share:** 45 ZION (90%)
- **Humanitarian Fund:** 5 ZION (10%)
- **Block Time:** ~2 minutes
- **Difficulty:** Auto-adjusting

### Payout System
- **Minimum Payout:** 10 ZION
- **Payout Frequency:** Every 30 minutes
- **Transaction Fee:** 0.1 ZION
- **Payment Method:** Automatic to wallet

### Calculating Profits
```bash
# Estimate daily earnings
# Formula: (Your Hashrate / Network Hashrate) * Blocks per Day * Block Reward

# Example:
# Your Hashrate: 50 MH/s
# Network Hashrate: 500 GH/s (500,000 MH/s)
# Blocks per Day: 720 (1440 minutes / 2 minutes per block)
# Block Reward: 50 ZION

# Daily Earnings: (50 / 500000) * 720 * 50 = 3.6 ZION/day
```

### Pool Fees
- **Pool Fee:** 1% of mining rewards
- **Transaction Fees:** Covered by pool
- **Listing Fee:** None

---

## 🔧 Troubleshooting

### Low Hashrate Issues

#### GPU Not Detected
```bash
# Check GPU status
nvidia-smi  # NVIDIA
rocm-smi    # AMD

# Install drivers
# Ubuntu NVIDIA:
sudo apt install nvidia-driver-470

# Ubuntu AMD:
sudo apt install amdgpu-pro
```

#### High Temperature
```bash
# Monitor temperature
nvidia-smi -q -d temperature

# Reduce intensity
./zion-cli mine --intensity 80

# Improve cooling
# - Clean GPU fans
# - Improve case airflow
# - Use aftermarket cooler
```

#### Driver Issues
```bash
# Check driver version
nvidia-smi --query-gpu=driver_version --format=csv

# Update drivers
# NVIDIA: Download from nvidia.com
# AMD: Download from amd.com
```

### Connection Problems

#### Pool Connection Failed
```bash
# Test connection
ping pool.zionterranova.com

# Check firewall
sudo ufw status
sudo ufw allow 3333

# Try different pool
./zion-cli mine --pool backup-pool.zionterranova.com:3333
```

#### RPC Connection Issues
```bash
# Test RPC endpoint
curl https://api.zionterranova.com/api/status

# Check SSL certificate
openssl s_client -connect api.zionterranova.com:443
```

### Performance Optimization

#### NVIDIA GPU Tuning
```bash
# Set power limit
nvidia-smi -i 0 -pl 200

# Set fan speed
nvidia-settings -a [fan:0]/GPUTargetFanSpeed=70

# Overclock (advanced)
nvidia-settings -a [gpu:0]/GPUGraphicsClockOffset[3]=100
```

#### AMD GPU Tuning
```bash
# Set fan speed
echo 2000 > /sys/class/drm/card0/device/hwmon/hwmon0/fan1_target

# Monitor with rocm-smi
rocm-smi --showtemp --showpower
```

#### CPU Mining Optimization
```bash
# Set CPU to performance mode
sudo cpupower frequency-set -g performance

# Monitor CPU usage and temperature
htop  # Install: sudo apt install htop
sensors  # Install: sudo apt install lm-sensors

# Optimize thread count (experiment for best results)
# Rule of thumb: Total cores - 2
# Example for 16-core CPU:
./zion-cli mine --cpu-only --threads 14

# Enable huge pages (5-10% speedup)
echo 128 | sudo tee /proc/sys/vm/nr_hugepages

# Disable CPU throttling
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

#### Hybrid (CPU + GPU) Optimization
```bash
# Balance workload between GPU and CPU
./zion-cli mine --start \
  --gpu 0 --gpu-intensity 100 \
  --cpu-threads 4 --cpu-intensity 75

# Monitor combined hashrate
./zion-cli mine --status

# Adjust based on temperature:
# - If GPU hot: reduce --gpu-intensity to 85
# - If CPU hot: reduce --cpu-threads or --cpu-intensity
```

#### System Optimization
```bash
# Disable CPU scaling
sudo cpupower frequency-set -g performance

# Increase virtual memory
sudo sysctl -w vm.swappiness=10

# Disable sleep
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

---

## 🛡️ Security Best Practices

### Wallet Security
```bash
# Use strong password
./zion-cli wallet --create --password "StrongPass123!"

# Backup wallet regularly
./zion-cli wallet --export --encrypt

# Store backups offline
# - External drive
# - Paper wallet
# - Hardware wallet (future)
```

### Mining Security
- **Use official software** - Download from GitHub releases only
- **Verify checksums** - Check SHA256 hashes
- **Keep software updated** - Security patches released regularly
- **Monitor for malware** - Use antivirus software
- **Secure RPC access** - Use HTTPS endpoints only

### Network Security
```bash
# Use firewall
sudo ufw enable
sudo ufw allow 3333  # Mining pool port

# Use VPN for public WiFi
# Avoid mining on compromised networks
```

---

## 📈 Advanced Mining

### Mining Pool Operation
```bash
# Start your own pool (advanced)
docker-compose -f docker-compose.testnet.yml up -d zion-pool

# Configure pool settings
# Edit docker-compose.testnet.yml
# - Pool fee
# - Minimum payout
# - Worker limits
```

### Solo Mining Setup
```bash
# Run full node
docker-compose -f docker-compose.testnet.yml up -d zion-node

# Mine solo
./zion-cli mine --solo --rpc http://localhost:8545 --wallet YOUR_ADDRESS
```

### Multi-Algorithm Mining
ZION supports multiple algorithms:
- **Primary:** Cosmic Harmony (GPU)
- **Secondary:** Yescrypt (CPU fallback)
- **Future:** Additional algorithms planned

---

## 📊 Profitability Calculator

### Online Calculator
Visit [zionminingcalc.com](https://zionminingcalc.com) for:
- Real-time profitability
- Electricity cost calculator
- ROI projections
- Hardware comparisons

### Manual Calculation
```bash
# Daily Profit Formula:
# (Hashrate × Block Reward × Blocks/Day × Price) - Electricity Cost - Pool Fee

# Example:
# Hashrate: 100 MH/s
# Block Reward: 50 ZION
# Blocks/Day: 720
# ZION Price: $0.10
# Electricity: $0.12/kWh
# Pool Fee: 1%

# Revenue: (100/500000) × 50 × 720 × 0.10 = $7.20
# Electricity: 0.3 kWh × 24h × $0.12 = $0.86
# Pool Fee: $7.20 × 0.01 = $0.07
# Profit: $7.20 - $0.86 - $0.07 = $6.27/day
```

---

## 🎯 Mining Strategies

### Long-term Mining
- **HODL strategy** - Hold mined ZION long-term
- **Dollar-cost averaging** - Mine consistently
- **Hardware upgrades** - Reinvest profits in better GPUs
- **Energy efficiency** - Optimize for lowest cost per ZION

### Pool Selection
- **Large pools** - More consistent payouts, lower variance
- **Small pools** - Higher fees, more decentralization
- **Multi-pool mining** - Switch based on profitability

### Risk Management
- **Diversify hardware** - Don't rely on single GPU
- **Monitor electricity costs** - Mining profitability changes
- **Stay informed** - Follow ZION development updates
- **Security first** - Protect your wallet and mining operation

---

## 📚 Additional Resources

### Documentation
- **[Quick Start Guide](./QUICK_START.md)** - Get started in 5 minutes
- **[RPC API Reference](./RPC_API.md)** - Developer documentation
- **[Architecture Overview](./ARCHITECTURE.md)** - Technical details
- **[FAQ](./FAQ.md)** - Frequently asked questions
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues

### Community
- **GitHub:** [Report issues](https://github.com/estrelaisabellazion3/Zion-2.8/issues)
- **Forum:** [Community discussions](https://forum.zionterranova.com)
- **Discord:** [Live chat](https://discord.gg/zion)

### Tools & Utilities
- **Mining Calculator:** [zionminingcalc.com](https://zionminingcalc.com)
- **Pool Monitor:** [pool.zionterranova.com](https://pool.zionterranova.com)
- **Explorer:** [explorer.zionterranova.com](https://explorer.zionterranova.com)

---

## ❓ FAQ

### General Questions
**Q: Is mining profitable?**  
A: Depends on hardware, electricity costs, and ZION price. Use the calculator above.

**Q: Can I mine with CPU only?**  
A: Yes, but hashrate will be very low. GPU mining is strongly recommended.

**Q: What's the minimum hardware for mining?**  
A: NVIDIA GTX 1060 6GB or AMD RX 580 8GB with 4GB system RAM.

### Technical Questions
**Q: Why is my hashrate low?**  
A: Check GPU drivers, temperature, and power limits. Try reducing intensity.

**Q: Can I mine on multiple GPUs?**  
A: Yes, run separate instances for each GPU or use multi-GPU software.

**Q: What's the best GPU for ZION mining?**  
A: Currently RTX 4070 Ti offers best performance per watt.

### Pool Questions
**Q: How often do payouts occur?**  
A: Every 30 minutes for balances over 10 ZION.

**Q: What are pool fees?**  
A: 1% of mining rewards, deducted automatically.

**Q: Can I switch pools?**  
A: Yes, stop mining and restart with new pool address.

---

**Ready to start mining ZION? Choose your setup above! ⛏️**

*Happy mining! Contribute to the humanitarian blockchain revolution.*  
*ZION 2.8.3 "Terra Nova" - October 2025*